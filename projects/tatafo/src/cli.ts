#!/usr/bin/env node
import { resolve } from "node:path";
import { indexDirectory } from "./indexer.js";
import { saveIndex, loadIndex } from "./store.js";
import { ask, search } from "./search.js";
import { IndexWatcher } from "./watcher.js";

const [, , cmd, ...rest] = process.argv;

async function main() {
  if (!cmd || cmd === "help") {
    console.log(`Tatafo — local-first file search (offline, BM25)

Usage:
  tatafo index <directory> [--out .tatafo/index.json]
  tatafo search <query> [--index .tatafo/index.json]
  tatafo ask <query> [--index .tatafo/index.json]
  tatafo watch <directory> [--index .tatafo/index.json]
  tatafo web [--port 8790] [--index .tatafo/index.json]
`);
    process.exit(0);
  }

  const indexFlag = rest.indexOf("--index");
  const indexPath = resolve(indexFlag >= 0 ? (rest[indexFlag + 1] ?? ".tatafo/index.json") : ".tatafo/index.json");

  if (cmd === "index") {
    const dir = resolve(rest[0] ?? ".");
    const outFlag = rest.indexOf("--out");
    const out = resolve(outFlag >= 0 ? (rest[outFlag + 1] ?? indexPath) : indexPath);
    const index = await indexDirectory(dir);
    index.watchRoot = dir;
    await saveIndex(out, index);
    const chunks = index.documents.reduce((n, d) => n + d.chunks.length, 0);
    console.log(`Indexed ${index.documents.length} files, ${chunks} chunks → ${out}`);
    return;
  }

  if (cmd === "watch") {
    const dir = resolve(rest[0] ?? ".");
    const watcher = new IndexWatcher({
      root: dir,
      indexPath,
      onReindex: (p) => console.log(`Re-indexed: ${p}`),
    });
    await watcher.start();
    console.log(`Watching ${dir} — Ctrl+C to stop`);
    process.on("SIGINT", () => {
      watcher.stop();
      process.exit(0);
    });
    return;
  }

  if (cmd === "web") {
    const { startServer } = await import("./server.js");
    const portFlag = rest.indexOf("--port");
    const port = Number(portFlag >= 0 ? rest[portFlag + 1] : process.env.PORT ?? 8790);
    const { port: p } = startServer({ port, indexPath, watchRoot: resolve(".") });
    console.log(`Tatafo UI at http://localhost:${p}`);
    return;
  }

  const index = await loadIndex(indexPath);
  const query = rest.filter((a) => !a.startsWith("--") && a !== indexPath).join(" ").trim();
  if (!query) throw new Error("Query required");

  if (cmd === "search") {
    const hits = search(index, query);
    for (const h of hits) {
      console.log(`${h.score.toFixed(4)}  ${h.chunk.filePath}:${h.chunk.startLine}`);
      console.log(h.chunk.text.slice(0, 160).replace(/\s+/g, " ") + "…\n");
    }
    return;
  }

  if (cmd === "ask") {
    const result = ask(index, query);
    console.log(result.answer);
    return;
  }

  throw new Error(`Unknown command: ${cmd}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
