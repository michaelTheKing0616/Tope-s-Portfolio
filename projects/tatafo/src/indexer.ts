import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { randomUUID } from "node:crypto";
import { chunkText, tokenize } from "./chunker.js";
import type { IndexedDocument, IndexFile } from "./types.js";

const TEXT_EXT = new Set([".txt", ".md", ".markdown", ".json", ".csv"]);

export async function walkTextFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  async function visit(dir: string) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const ent of entries) {
      if (ent.name.startsWith(".") && ent.name !== ".") continue;
      const full = join(dir, ent.name);
      if (ent.isDirectory()) await visit(full);
      else if (TEXT_EXT.has(ent.name.slice(ent.name.lastIndexOf(".")).toLowerCase())) out.push(full);
    }
  }
  await visit(root);
  return out.sort();
}

export async function indexDirectory(root: string): Promise<IndexFile> {
  const files = await walkTextFiles(root);
  const documents: IndexedDocument[] = [];

  for (const filePath of files) {
    documents.push(await indexFile(root, filePath));
  }

  return buildIndex(documents);
}

export async function indexFile(root: string, filePath: string): Promise<IndexedDocument> {
  const st = await stat(filePath);
  const raw = await readFile(filePath, "utf8");
  const rel = relative(root, filePath).replace(/\\/g, "/");
  const parts = chunkText(raw, rel);
  return {
    path: rel,
    mtimeMs: st.mtimeMs,
    chunks: parts.map((p) => ({
      id: randomUUID(),
      filePath: rel,
      startLine: p.startLine,
      endLine: p.endLine,
      text: p.text,
    })),
  };
}

export function buildIndex(documents: IndexedDocument[]): IndexFile {
  const vocabulary: Record<string, number> = {};
  const docFreq: Record<string, number> = {};
  const chunkVectors: IndexFile["chunkVectors"] = {};
  let totalLength = 0;
  let chunkCount = 0;

  for (const doc of documents) {
    for (const chunk of doc.chunks) {
      const tokens = tokenize(chunk.text);
      const tf: Record<string, number> = {};
      for (const t of tokens) {
        tf[t] = (tf[t] ?? 0) + 1;
        vocabulary[t] = (vocabulary[t] ?? 0) + 1;
      }
      const unique = new Set(tokens);
      for (const t of unique) docFreq[t] = (docFreq[t] ?? 0) + 1;
      const len = tokens.length || 1;
      totalLength += len;
      chunkCount += 1;
      const vec: Record<string, number> = {};
      for (const [t, c] of Object.entries(tf)) vec[t] = c / len;
      chunkVectors[chunk.id] = vec;
    }
  }

  const n = chunkCount || 1;
  const avgDocLength = totalLength / n;
  const idf: Record<string, number> = {};
  for (const [term, df] of Object.entries(docFreq)) {
    idf[term] = Math.log((n - df + 0.5) / (df + 0.5) + 1);
  }

  return {
    version: 2,
    documents,
    vocabulary,
    idf,
    chunkVectors,
    avgDocLength,
    chunkCount: n,
    indexedAt: new Date().toISOString(),
  };
}

/** Merge a re-indexed document into an existing index. */
export function upsertDocument(index: IndexFile, doc: IndexedDocument): IndexFile {
  const rest = index.documents.filter((d) => d.path !== doc.path);
  return buildIndex([...rest, doc]);
}

export function removeDocument(index: IndexFile, relPath: string): IndexFile {
  return buildIndex(index.documents.filter((d) => d.path !== relPath));
}
