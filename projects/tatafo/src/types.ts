export interface Chunk {
  id: string;
  filePath: string;
  startLine: number;
  endLine: number;
  text: string;
}

export interface IndexedDocument {
  path: string;
  mtimeMs: number;
  chunks: Chunk[];
}

export interface IndexFile {
  version: 1 | 2;
  documents: IndexedDocument[];
  vocabulary: Record<string, number>;
  idf: Record<string, number>;
  chunkVectors: Record<string, Record<string, number>>;
  /** BM25 average document length (tokens per chunk). */
  avgDocLength?: number;
  chunkCount?: number;
  indexedAt?: string;
  watchRoot?: string;
}

export interface SearchHit {
  chunk: Chunk;
  score: number;
}

export interface GroundedAnswer {
  query: string;
  hits: SearchHit[];
  answer: string;
}

export interface WatcherStatus {
  watching: boolean;
  root: string;
  indexPath: string;
  lastEvent?: string;
  documents: number;
  chunks: number;
}
