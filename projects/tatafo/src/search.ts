import type { Chunk, GroundedAnswer, IndexFile, SearchHit } from "./types.js";
import { tokenize } from "./chunker.js";

const K1 = 1.2;
const B = 0.75;

function queryTerms(query: string): string[] {
  return [...new Set(tokenize(query))];
}

/** BM25 Okapi — stronger ranking than raw TF-IDF cosine for keyword search. */
export function bm25Score(
  terms: string[],
  termFreq: Record<string, number>,
  docLength: number,
  index: IndexFile,
): number {
  const { idf, avgDocLength } = index;
  const avgdl = avgDocLength || 1;
  let score = 0;

  for (const term of terms) {
    const tf = termFreq[term] ?? 0;
    if (!tf) continue;
    const idfVal = idf[term] ?? 0;
    const denom = tf + K1 * (1 - B + (B * docLength) / avgdl);
    score += idfVal * ((tf * (K1 + 1)) / denom);
  }
  return score;
}

function chunkTermFreq(text: string): Record<string, number> {
  const tf: Record<string, number> = {};
  for (const t of tokenize(text)) tf[t] = (tf[t] ?? 0) + 1;
  return tf;
}

export function search(index: IndexFile, query: string, limit = 5): SearchHit[] {
  const terms = queryTerms(query);
  if (!terms.length) return [];

  const hits: SearchHit[] = [];
  for (const doc of index.documents) {
    for (const chunk of doc.chunks) {
      const tf = chunkTermFreq(chunk.text);
      const docLength = Object.values(tf).reduce((a, b) => a + b, 0);
      const score = bm25Score(terms, tf, docLength, index);
      if (score > 0) hits.push({ chunk, score });
    }
  }

  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function ask(index: IndexFile, query: string, limit = 3): GroundedAnswer {
  const hits = search(index, query, limit);
  if (!hits.length) {
    return { query, hits: [], answer: "No relevant passages found in the local index." };
  }

  const body = hits
    .map(
      (h, i) =>
        `[${i + 1}] ${h.chunk.filePath}:${h.chunk.startLine}-${h.chunk.endLine} (score ${h.score.toFixed(3)})\n${h.chunk.text.trim()}`,
    )
    .join("\n\n");

  const answer = `Based on your local files (BM25-ranked):\n\n${body}\n\n— grounded in ${hits.length} passage(s); nothing left your machine.`;
  return { query, hits, answer };
}
