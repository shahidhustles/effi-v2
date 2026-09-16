import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { embedMany } from "ai";
import {
  manualPageToText,
  parseSlaManual,
  SLA_EMBEDDING_DIMENSIONS,
  SLA_EMBEDDING_MODEL,
  type SlaCategory,
} from "../lib/sla-knowledge.ts";

type IngestionArgs = {
  secret: string;
  documentKey: string;
  title: string;
  version: string;
  effectiveDate: string;
  disclaimer: string;
  sourceFileName: string;
  checksum: string;
  pdfBase64: string;
  pages: Array<{
    pageNumber: number;
    category: SlaCategory;
    heading: string;
    text: string;
    embedding: number[];
  }>;
};

type IngestionResult = { documentId: string; pageCount: number };

const ingestDocument = makeFunctionReference<"action", IngestionArgs, IngestionResult>("slaKnowledge:ingest");

const requireEnvironment = (name: "AI_GATEWAY_API_KEY" | "NEXT_PUBLIC_CONVEX_URL" | "SLA_INGESTION_SECRET"): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
};

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const appDirectory = join(scriptDirectory, "..");
const manualPath = join(appDirectory, "content", "effi-municipal-operations-manual-demo-v1.json");
const pdfPath = join(appDirectory, "public", "manuals", "effi-municipal-operations-manual-demo-v1.pdf");

const main = async (): Promise<void> => {
  requireEnvironment("AI_GATEWAY_API_KEY");
  const convexUrl = requireEnvironment("NEXT_PUBLIC_CONVEX_URL");
  const secret = requireEnvironment("SLA_INGESTION_SECRET");
  const [manualJson, pdf] = await Promise.all([readFile(manualPath, "utf8"), readFile(pdfPath)]);
  const manualValue: unknown = JSON.parse(manualJson);
  const manual = parseSlaManual(manualValue);
  const pageTexts = manual.pages.map((page) => manualPageToText(manual, page));
  const { embeddings } = await embedMany({ model: SLA_EMBEDDING_MODEL, values: pageTexts });
  if (embeddings.length !== manual.pages.length) throw new Error("Embedding response did not contain every page.");

  const pages = manual.pages.map((page, index) => {
    const embedding = embeddings[index];
    if (!embedding || embedding.length !== SLA_EMBEDDING_DIMENSIONS) {
      throw new Error(`Page ${page.pageNumber} returned ${embedding?.length ?? 0} dimensions; expected ${SLA_EMBEDDING_DIMENSIONS}.`);
    }
    return {
      pageNumber: page.pageNumber,
      category: page.category,
      heading: page.heading,
      text: pageTexts[index] ?? "",
      embedding,
    };
  });

  const convex = new ConvexHttpClient(convexUrl);
  const result = await convex.action(ingestDocument, {
    secret,
    documentKey: manual.documentKey,
    title: manual.title,
    version: manual.version,
    effectiveDate: manual.effectiveDate,
    disclaimer: manual.disclaimer,
    sourceFileName: pdfPath.split("/").at(-1) ?? "effi-manual.pdf",
    checksum: createHash("sha256").update(pdf).digest("hex"),
    pdfBase64: pdf.toString("base64"),
    pages,
  });
  process.stdout.write(`Indexed ${result.pageCount} pages as document ${result.documentId}.\n`);
};

await main();
