import { watch } from "node:fs";
import { resolve } from "node:path";
import { indexFile, removeDocument, upsertDocument } from "./indexer.js";
import { loadIndex, saveIndex } from "./store.js";
import type { WatcherStatus } from "./types.js";

export interface WatchOptions {
  root: string;
  indexPath: string;
  debounceMs?: number;
  onReindex?: (path: string) => void;
}

/** Debounced filesystem watcher — incremental BM25 re-index on change. */
export class IndexWatcher {
  private timer?: ReturnType<typeof setTimeout>;
  private watcher?: ReturnType<typeof watch>;
  private status: WatcherStatus;

  constructor(private readonly opts: WatchOptions) {
    this.status = {
      watching: false,
      root: resolve(opts.root),
      indexPath: resolve(opts.indexPath),
      documents: 0,
      chunks: 0,
    };
  }

  getStatus(): WatcherStatus {
    return { ...this.status };
  }

  async start(): Promise<void> {
    const root = resolve(this.opts.root);
    let index = await loadIndex(this.opts.indexPath).catch(() => null);
    if (!index) throw new Error("Index not found — run `tatafo index` first");
    index.watchRoot = root;
    this.refreshCounts(index);

    this.watcher = watch(root, { recursive: true }, (_event, filename) => {
      if (!filename) return;
      this.schedule(async () => {
        const rel = filename.replace(/\\/g, "/");
        const full = resolve(root, rel);
        try {
          const doc = await indexFile(root, full);
          index = upsertDocument(index!, doc);
          this.opts.onReindex?.(rel);
        } catch {
          index = removeDocument(index!, rel);
        }
        index!.watchRoot = root;
        await saveIndex(this.opts.indexPath, index!);
        this.status.lastEvent = new Date().toISOString();
        this.refreshCounts(index!);
      });
    });

    this.status.watching = true;
  }

  stop(): void {
    this.watcher?.close();
    this.status.watching = false;
    if (this.timer) clearTimeout(this.timer);
  }

  private schedule(fn: () => Promise<void>): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void fn().catch(console.error), this.opts.debounceMs ?? 400);
  }

  private refreshCounts(index: { documents: { chunks: unknown[] }[] }): void {
    this.status.documents = index.documents.length;
    this.status.chunks = index.documents.reduce((n, d) => n + d.chunks.length, 0);
  }
}
