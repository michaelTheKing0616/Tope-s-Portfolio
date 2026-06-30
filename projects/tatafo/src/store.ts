import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { IndexFile } from "./types.js";
import { buildIndex } from "./indexer.js";

export async function saveIndex(path: string, index: IndexFile): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(index, null, 2), "utf8");
}

export async function loadIndex(path: string): Promise<IndexFile> {
  const raw = await readFile(path, "utf8");
  const parsed = JSON.parse(raw) as IndexFile;
  if (parsed.version === 1) {
    return buildIndex(parsed.documents);
  }
  if (parsed.version !== 2) throw new Error("Unsupported index version");
  return parsed;
}
