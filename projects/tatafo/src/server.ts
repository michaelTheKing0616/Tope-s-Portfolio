import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { resolve } from "node:path";
import { ask, search } from "./search.js";
import { indexDirectory } from "./indexer.js";
import { loadIndex, saveIndex } from "./store.js";
import { IndexWatcher } from "./watcher.js";

export interface TatafoServerOptions {
  port?: number;
  indexPath?: string;
  watchRoot?: string;
}

export function createApp(opts: TatafoServerOptions = {}) {
  const indexPath = resolve(opts.indexPath ?? ".tatafo/index.json");
  const watchRoot = resolve(opts.watchRoot ?? ".");
  const app = new Hono();
  let watcher: IndexWatcher | undefined;

  app.get("/health", (c) => c.json({ ok: true, service: "tatafo", version: "0.2.0" }));

  app.get("/api/status", async (c) => {
    try {
      const index = await loadIndex(indexPath);
      const chunks = index.documents.reduce((n, d) => n + d.chunks.length, 0);
      return c.json({
        indexPath,
        watchRoot: index.watchRoot ?? watchRoot,
        documents: index.documents.length,
        chunks,
        indexedAt: index.indexedAt,
        watcher: watcher?.getStatus() ?? { watching: false },
      });
    } catch {
      return c.json({ indexPath, documents: 0, chunks: 0, indexed: false });
    }
  });

  app.post("/api/index", async (c) => {
    const body = await c.req.json<{ root?: string }>().catch(() => ({}));
    const root = resolve(body.root ?? watchRoot);
    const index = await indexDirectory(root);
    index.watchRoot = root;
    await saveIndex(indexPath, index);
    return c.json({ ok: true, documents: index.documents.length, chunks: index.chunkCount });
  });

  app.get("/api/search", async (c) => {
    const q = c.req.query("q")?.trim();
    if (!q) return c.json({ error: "q required" }, 400);
    const index = await loadIndex(indexPath);
    const limit = Number(c.req.query("limit") ?? 8);
    return c.json({ query: q, hits: search(index, q, limit) });
  });

  app.get("/api/ask", async (c) => {
    const q = c.req.query("q")?.trim();
    if (!q) return c.json({ error: "q required" }, 400);
    const index = await loadIndex(indexPath);
    return c.json(ask(index, q, Number(c.req.query("limit") ?? 3)));
  });

  app.post("/api/watch/start", async (c) => {
    if (watcher) watcher.stop();
    watcher = new IndexWatcher({ root: watchRoot, indexPath });
    await watcher.start();
    return c.json({ ok: true, status: watcher.getStatus() });
  });

  app.post("/api/watch/stop", (c) => {
    watcher?.stop();
    watcher = undefined;
    return c.json({ ok: true });
  });

  app.get("/", (c) => c.html(renderUi()));

  return app;
}

function renderUi(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Tatafo — local search</title>
  <style>
    :root { --bg:#0a0a0b; --panel:#141416; --ink:#f4f3ef; --muted:#9a9890; --accent:#c9a227; --border:#2a2a2e; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:Inter,system-ui,sans-serif; background:var(--bg); color:var(--ink); min-height:100vh; }
    header { padding:32px 24px 16px; border-bottom:1px solid var(--border); }
    h1 { font-family:Georgia,serif; font-weight:400; margin:0 0 6px; font-size:2rem; }
    .sub { color:var(--muted); font-size:12px; letter-spacing:.14em; text-transform:uppercase; }
    main { max-width:820px; margin:0 auto; padding:24px; }
    .search-row { display:flex; gap:10px; margin-bottom:20px; }
    input { flex:1; background:var(--panel); border:1px solid var(--border); color:var(--ink); padding:14px 16px; border-radius:8px; font-size:16px; }
    button { background:var(--accent); color:#0a0a0b; border:none; padding:14px 20px; border-radius:8px; font-weight:600; cursor:pointer; }
    button.ghost { background:transparent; color:var(--muted); border:1px solid var(--border); }
    .hit { background:var(--panel); border:1px solid var(--border); border-radius:10px; padding:16px; margin-bottom:12px; }
    .meta { font-size:11px; color:var(--accent); letter-spacing:.08em; margin-bottom:8px; }
    .text { color:var(--muted); line-height:1.55; white-space:pre-wrap; }
    #status { font-size:13px; color:var(--muted); margin-bottom:16px; }
    .actions { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:20px; }
  </style>
</head>
<body>
  <header><p class="sub">Tatafo</p><h1>Your files, searchable — offline.</h1></header>
  <main>
    <p id="status">Loading index…</p>
    <div class="actions">
      <button type="button" class="ghost" id="btn-index">Re-index</button>
      <button type="button" class="ghost" id="btn-watch">Start watcher</button>
    </div>
    <div class="search-row">
      <input id="q" placeholder="Search your notes, docs, markdown…" autocomplete="off"/>
      <button type="button" id="btn-search">Search</button>
    </div>
    <div id="results"></div>
  </main>
  <script>
    const q = document.getElementById('q');
    const results = document.getElementById('results');
    const status = document.getElementById('status');

    async function refreshStatus() {
      const r = await fetch('/api/status');
      const s = await r.json();
      status.textContent = s.indexed === false
        ? 'No index yet — click Re-index.'
        : s.documents + ' files · ' + s.chunks + ' chunks · BM25 · ' + (s.indexedAt || '');
    }

    async function doSearch() {
      const query = q.value.trim();
      if (!query) return;
      const r = await fetch('/api/search?q=' + encodeURIComponent(query));
      const data = await r.json();
      results.innerHTML = (data.hits || []).map(h =>
        '<article class="hit"><div class="meta">' + h.score.toFixed(3) + ' · ' + h.chunk.filePath + ':' + h.chunk.startLine + '</div><div class="text">' + escapeHtml(h.chunk.text.slice(0,400)) + '</div></article>'
      ).join('') || '<p class="text">No hits.</p>';
    }

    function escapeHtml(s) {
      return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    document.getElementById('btn-search').onclick = doSearch;
    q.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
    document.getElementById('btn-index').onclick = async () => {
      status.textContent = 'Indexing…';
      await fetch('/api/index', { method: 'POST', headers: {'content-type':'application/json'}, body: '{}' });
      await refreshStatus();
    };
    document.getElementById('btn-watch').onclick = async () => {
      await fetch('/api/watch/start', { method: 'POST' });
      await refreshStatus();
    };
    refreshStatus();
  </script>
</body>
</html>`;
}

export function startServer(opts: TatafoServerOptions = {}) {
  const port = opts.port ?? Number(process.env.PORT ?? 8790);
  const app = createApp(opts);
  serve({ fetch: app.fetch, port });
  return { app, port };
}
