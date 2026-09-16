import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  action,
  env,
  internalMutation,
  internalQuery,
} from "./_generated/server";

const embeddingDimensions = 4096;
const maxSearchResults = 8;

type SearchResult = {
  chunkId: Id<"slaChunks">;
  documentKey: string;
  title: string;
  version: string;
  pageNumber: number;
  category: "general" | "potholes" | "sanitation" | "streetlights";
  heading: string;
  text: string;
  score: number;
  sourceUrl: string;
};

type IngestionResult = {
  documentId: Id<"slaDocuments">;
  pageCount: number;
};

type ReplaceDocumentResult = IngestionResult & {
  replacedStorageId?: Id<"_storage">;
};

const categoryValidator = v.union(
  v.literal("general"),
  v.literal("potholes"),
  v.literal("sanitation"),
  v.literal("streetlights"),
);

const ingestionPageValidator = v.object({
  pageNumber: v.number(),
  category: categoryValidator,
  heading: v.string(),
  text: v.string(),
  embedding: v.array(v.float64()),
});

const searchResultValidator = v.object({
  chunkId: v.id("slaChunks"),
  documentKey: v.string(),
  title: v.string(),
  version: v.string(),
  pageNumber: v.number(),
  category: categoryValidator,
  heading: v.string(),
  text: v.string(),
  score: v.number(),
  sourceUrl: v.string(),
});

export const authorizeOfficerSearch = internalQuery({
  args: { tokenIdentifier: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.db
      .query("identities")
      .withIndex("by_external_id", (query) =>
        query.eq("externalId", args.tokenIdentifier),
      )
      .unique();
    if (!identity || (identity.role !== "officer" && identity.role !== "admin")) {
      throw new Error("Officer access required.");
    }
    return null;
  },
});

export const readSearchResults = internalQuery({
  args: {
    matches: v.array(
      v.object({
        id: v.id("slaChunks"),
        score: v.number(),
      }),
    ),
    category: v.optional(categoryValidator),
    limit: v.number(),
  },
  returns: v.array(searchResultValidator),
  handler: async (ctx, args) => {
    const results = await Promise.all(
      args.matches.map(async (match) => {
        const chunk = await ctx.db.get(match.id);
        if (!chunk || !chunk.active) return null;
        if (args.category && chunk.category !== args.category && chunk.category !== "general") return null;
        const document = await ctx.db.get(chunk.documentId);
        if (!document || !document.active) return null;
        const storageUrl = await ctx.storage.getUrl(document.storageId);
        if (!storageUrl) return null;
        return {
          chunkId: chunk._id,
          documentKey: chunk.documentKey,
          title: chunk.title,
          version: chunk.version,
          pageNumber: chunk.pageNumber,
          category: chunk.category,
          heading: chunk.heading,
          text: chunk.text,
          score: match.score,
          sourceUrl: `${storageUrl}#page=${chunk.pageNumber}`,
        };
      }),
    );
    return results.filter((result) => result !== null).slice(0, args.limit);
  },
});

export const search = action({
  args: {
    embedding: v.array(v.float64()),
    category: v.optional(categoryValidator),
    limit: v.number(),
  },
  returns: v.array(searchResultValidator),
  handler: async (ctx, args): Promise<SearchResult[]> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Officer access required.");
    await ctx.runQuery(internal.slaKnowledge.authorizeOfficerSearch, {
      tokenIdentifier: identity.tokenIdentifier,
    });
    if (args.embedding.length !== embeddingDimensions) {
      throw new Error(`Expected a ${embeddingDimensions}-dimension embedding.`);
    }
    const limit = Math.max(1, Math.min(maxSearchResults, Math.floor(args.limit)));
    const vectorLimit = args.category ? Math.min(32, limit * 4) : limit;
    const matches = await ctx.vectorSearch("slaChunks", "by_embedding", {
      vector: args.embedding,
      limit: vectorLimit,
      filter: (query) => query.eq("active", true),
    });
    return await ctx.runQuery(internal.slaKnowledge.readSearchResults, {
      matches: matches.map((match) => ({ id: match._id, score: match._score })),
      ...(args.category ? { category: args.category } : {}),
      limit,
    });
  },
});

export const replaceDocumentRecords = internalMutation({
  args: {
    documentKey: v.string(),
    title: v.string(),
    version: v.string(),
    effectiveDate: v.string(),
    disclaimer: v.string(),
    sourceFileName: v.string(),
    storageId: v.id("_storage"),
    checksum: v.string(),
    pages: v.array(ingestionPageValidator),
  },
  returns: v.object({
    documentId: v.id("slaDocuments"),
    pageCount: v.number(),
    replacedStorageId: v.optional(v.id("_storage")),
  }),
  handler: async (ctx, args): Promise<ReplaceDocumentResult> => {
    const existingVersion = await ctx.db
      .query("slaDocuments")
      .withIndex("by_document_key_and_version", (query) =>
        query.eq("documentKey", args.documentKey).eq("version", args.version),
      )
      .unique();

    const activeDocuments = await ctx.db
      .query("slaDocuments")
      .withIndex("by_document_key_and_active", (query) =>
        query.eq("documentKey", args.documentKey).eq("active", true),
      )
      .collect();

    for (const document of activeDocuments) {
      await ctx.db.patch(document._id, { active: false });
      const chunks = await ctx.db
        .query("slaChunks")
        .withIndex("by_document_id_and_page_number", (query) =>
          query.eq("documentId", document._id),
        )
        .collect();
      for (const chunk of chunks) await ctx.db.patch(chunk._id, { active: false });
    }

    if (existingVersion) {
      const oldChunks = await ctx.db
        .query("slaChunks")
        .withIndex("by_document_id_and_page_number", (query) =>
          query.eq("documentId", existingVersion._id),
        )
        .collect();
      for (const chunk of oldChunks) await ctx.db.delete(chunk._id);
      await ctx.db.patch(existingVersion._id, {
        title: args.title,
        effectiveDate: args.effectiveDate,
        disclaimer: args.disclaimer,
        sourceFileName: args.sourceFileName,
        storageId: args.storageId,
        checksum: args.checksum,
        pageCount: args.pages.length,
        active: true,
        createdAt: Date.now(),
      });
    }

    const documentId: Id<"slaDocuments"> = existingVersion?._id ?? await ctx.db.insert("slaDocuments", {
      documentKey: args.documentKey,
      title: args.title,
      version: args.version,
      effectiveDate: args.effectiveDate,
      disclaimer: args.disclaimer,
      sourceFileName: args.sourceFileName,
      storageId: args.storageId,
      checksum: args.checksum,
      pageCount: args.pages.length,
      active: true,
      createdAt: Date.now(),
    });

    for (const page of args.pages) {
      await ctx.db.insert("slaChunks", {
        documentId,
        documentKey: args.documentKey,
        title: args.title,
        version: args.version,
        pageNumber: page.pageNumber,
        category: page.category,
        heading: page.heading,
        text: page.text,
        embedding: page.embedding,
        active: true,
      });
    }
    return {
      documentId,
      pageCount: args.pages.length,
      ...(existingVersion ? { replacedStorageId: existingVersion.storageId } : {}),
    };
  },
});

export const ingest = action({
  args: {
    secret: v.string(),
    documentKey: v.string(),
    title: v.string(),
    version: v.string(),
    effectiveDate: v.string(),
    disclaimer: v.string(),
    sourceFileName: v.string(),
    checksum: v.string(),
    pdfBase64: v.string(),
    pages: v.array(ingestionPageValidator),
  },
  returns: v.object({
    documentId: v.id("slaDocuments"),
    pageCount: v.number(),
  }),
  handler: async (ctx, args): Promise<IngestionResult> => {
    if (!env.SLA_INGESTION_SECRET || args.secret !== env.SLA_INGESTION_SECRET) {
      throw new Error("Invalid ingestion secret.");
    }
    if (!args.pages.length) throw new Error("At least one page is required.");
    if (args.pages.some((page) => page.embedding.length !== embeddingDimensions)) {
      throw new Error(`Every page needs a ${embeddingDimensions}-dimension embedding.`);
    }
    const bytes = Uint8Array.from(atob(args.pdfBase64), (character) => character.charCodeAt(0));
    const storageId = await ctx.storage.store(new Blob([bytes], { type: "application/pdf" }));
    try {
      const result: ReplaceDocumentResult = await ctx.runMutation(internal.slaKnowledge.replaceDocumentRecords, {
        documentKey: args.documentKey,
        title: args.title,
        version: args.version,
        effectiveDate: args.effectiveDate,
        disclaimer: args.disclaimer,
        sourceFileName: args.sourceFileName,
        storageId,
        checksum: args.checksum,
        pages: args.pages,
      });
      if (result.replacedStorageId && result.replacedStorageId !== storageId) {
        await ctx.storage.delete(result.replacedStorageId);
      }
      return { documentId: result.documentId, pageCount: result.pageCount };
    } catch (error) {
      await ctx.storage.delete(storageId);
      throw error;
    }
  },
});
