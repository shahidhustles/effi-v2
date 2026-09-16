export const SLA_EMBEDDING_MODEL = "alibaba/qwen3-embedding-8b";
export const SLA_EMBEDDING_DIMENSIONS = 4096;
export const SLA_QUERY_INSTRUCTION = "Retrieve the municipal SLA or operating procedure that best answers this query.";

export const SLA_CATEGORIES = [
  "general",
  "potholes",
  "sanitation",
  "streetlights",
] as const;

export type SlaCategory = (typeof SLA_CATEGORIES)[number];

type ManualSection = {
  title: string;
  paragraphs: string[];
  bullets: string[];
};

export type ManualPage = {
  pageNumber: number;
  category: SlaCategory;
  heading: string;
  summary: string;
  sections: ManualSection[];
};

export type SlaManual = {
  documentKey: string;
  title: string;
  subtitle: string;
  version: string;
  effectiveDate: string;
  disclaimer: string;
  pages: ManualPage[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readString = (record: Record<string, unknown>, key: string): string => {
  const value = record[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Manual field ${key} must be a non-empty string.`);
  }
  return value.trim();
};

const readStringArray = (value: unknown, key: string): string[] => {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error(`Manual field ${key} must be an array of non-empty strings.`);
  }
  return value.map((item) => item.trim());
};

const isSlaCategory = (value: unknown): value is SlaCategory =>
  typeof value === "string" && SLA_CATEGORIES.some((category) => category === value);

const parseSection = (value: unknown): ManualSection => {
  if (!isRecord(value)) throw new Error("Every manual section must be an object.");
  const paragraphs = value.paragraphs === undefined ? [] : readStringArray(value.paragraphs, "paragraphs");
  const bullets = value.bullets === undefined ? [] : readStringArray(value.bullets, "bullets");
  if (!paragraphs.length && !bullets.length) throw new Error("A manual section cannot be empty.");
  return { title: readString(value, "title"), paragraphs, bullets };
};

const parsePage = (value: unknown, expectedPageNumber: number): ManualPage => {
  if (!isRecord(value)) throw new Error("Every manual page must be an object.");
  if (value.pageNumber !== expectedPageNumber) {
    throw new Error(`Manual pages must be numbered consecutively from 1. Expected page ${expectedPageNumber}.`);
  }
  if (!isSlaCategory(value.category)) throw new Error(`Unsupported SLA category on page ${expectedPageNumber}.`);
  if (!Array.isArray(value.sections) || !value.sections.length) {
    throw new Error(`Manual page ${expectedPageNumber} requires at least one section.`);
  }
  return {
    pageNumber: expectedPageNumber,
    category: value.category,
    heading: readString(value, "heading"),
    summary: readString(value, "summary"),
    sections: value.sections.map(parseSection),
  };
};

export const parseSlaManual = (value: unknown): SlaManual => {
  if (!isRecord(value)) throw new Error("The SLA manual must be a JSON object.");
  if (!Array.isArray(value.pages) || !value.pages.length) throw new Error("The SLA manual requires pages.");
  return {
    documentKey: readString(value, "documentKey"),
    title: readString(value, "title"),
    subtitle: readString(value, "subtitle"),
    version: readString(value, "version"),
    effectiveDate: readString(value, "effectiveDate"),
    disclaimer: readString(value, "disclaimer"),
    pages: value.pages.map((page, index) => parsePage(page, index + 1)),
  };
};

export const manualPageToText = (manual: SlaManual, page: ManualPage): string => [
  `${manual.title}, version ${manual.version}, effective ${manual.effectiveDate}`,
  `Category: ${page.category}`,
  page.heading,
  page.summary,
  ...page.sections.flatMap((section) => [
    section.title,
    ...section.paragraphs,
    ...section.bullets.map((item) => `- ${item}`),
  ]),
  manual.disclaimer,
].join("\n\n");
