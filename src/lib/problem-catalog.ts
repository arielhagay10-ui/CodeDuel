import type { ProblemCatalogItem } from "./client-contracts.ts";
import type { RoundProblem } from "@/types/api";

export const CATALOG_PAGE_SIZE = 12;

export function problemSummary(statement: string): string {
  const text = statement
    .replace(/^#{1,6}\s+[^\n]*$/gm, "")
    .trim()
    .split(/\n\s*\n/)[0]
    .replace(/[`*_]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 150 ? `${text.slice(0, 147).trimEnd()}…` : text;
}

export function parseCatalogSearch(search: string) {
  const tags = [...search.matchAll(/#([a-z0-9-]+)/gi)].map(match => match[1].toLowerCase());
  return { tags: [...new Set(tags)], text: search.replace(/#[a-z0-9-]+/gi, "").trim() };
}

export function toCatalogItem(problem: RoundProblem, tags: string[] = []): ProblemCatalogItem {
  return { id: problem.id, title: problem.title, difficulty: problem.difficulty, summary: problemSummary(problem.statementMarkdown), tags };
}
