import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { loadConfig, MeetingStore, MemoryMeetingStore, type IMeetingStore } from "./store.js";
import { createTranscriptionProvider } from "./transcribe.js";
import { createSummarizationProvider } from "./summarize.js";
import { formatMinutes, formatMinutesHtml, MINUTES_STYLES } from "./minutes.js";
import type { Meeting, MinutesStyle } from "./types.js";

export interface AppDeps {
  store: IMeetingStore;
  config: ReturnType<typeof loadConfig>;
}

export function createDeps(overrides?: Partial<AppDeps>): AppDeps {
  const config = loadConfig();
  const store =
    overrides?.store ??
    (process.env.NODE_ENV === "test"
      ? new MemoryMeetingStore()
      : new MeetingStore(config.databasePath));
  return { store, config, ...overrides };
}

export function createMeeting(input: {
  title: string;
  date?: string;
  attendees?: string[];
  style?: MinutesStyle;
}): Meeting {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    title: input.title.trim(),
    date: input.date ?? now.slice(0, 10),
    attendees: input.attendees ?? [],
    transcript: [],
    actionItems: [],
    decisions: [],
    style: input.style ?? "formal",
    createdAt: now,
    updatedAt: now,
  };
}

export function createApp(deps = createDeps()) {
  const { store, config } = deps;
  const transcribe = createTranscriptionProvider(config.openaiKey);
  const summarize = createSummarizationProvider(config.openaiKey, config.chatModel);
  const app = new Hono();
  const uploadDir = join(process.cwd(), "data", "uploads");
  mkdirSync(uploadDir, { recursive: true });

  app.get("/health", (c) =>
    c.json({
      ok: true,
      service: "akowe",
      version: "0.1.0",
      whisper: Boolean(config.openaiKey),
      styles: MINUTES_STYLES,
    }),
  );

  app.get("/api/meetings", (c) => c.json(store.list()));

  app.get("/api/meetings/:id", (c) => {
    const m = store.get(c.req.param("id"));
    if (!m) return c.json({ error: "Not found" }, 404);
    return c.json(m);
  });

  app.post("/api/meetings", async (c) => {
    const body = await c.req.json<{ title: string; date?: string; attendees?: string[]; style?: MinutesStyle }>();
    const meeting = createMeeting(body);
    store.save(meeting);
    return c.json(meeting, 201);
  });

  app.post("/api/meetings/:id/transcribe", async (c) => {
    const meeting = store.get(c.req.param("id"));
    if (!meeting) return c.json({ error: "Not found" }, 404);
    const body = await c.req.json<{ text?: string; audioBase64?: string; filename?: string }>();
    let audioPath: string | undefined;
    if (body.audioBase64) {
      const buf = Buffer.from(body.audioBase64, "base64");
      audioPath = join(uploadDir, `${meeting.id}-${body.filename ?? "audio.webm"}`);
      writeFileSync(audioPath, buf);
    }
    const result = await transcribe.transcribe({ text: body.text, audioPath });
    meeting.transcript = result.segments;
    meeting.rawTranscript = result.raw || body.text;
    meeting.updatedAt = new Date().toISOString();
    store.save(meeting);
    return c.json({ meeting, provider: result.provider });
  });

  app.post("/api/meetings/:id/summarize", async (c) => {
    const meeting = store.get(c.req.param("id"));
    if (!meeting) return c.json({ error: "Not found" }, 404);
    if (!meeting.transcript.length) return c.json({ error: "Transcript required" }, 400);
    const result = await summarize.summarize(meeting);
    meeting.summary = result.summary;
    meeting.actionItems = result.actionItems;
    meeting.decisions = result.decisions;
    meeting.updatedAt = new Date().toISOString();
    store.save(meeting);
    return c.json({ meeting, provider: result.provider });
  });

  app.get("/api/meetings/:id/export", (c) => {
    const meeting = store.get(c.req.param("id"));
    if (!meeting) return c.json({ error: "Not found" }, 404);
    const style = (c.req.query("style") as MinutesStyle) ?? meeting.style;
    const format = c.req.query("format") ?? "md";
    if (format === "html") {
      return c.html(formatMinutesHtml(meeting, style));
    }
    return c.text(formatMinutes(meeting, style), 200, {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${meeting.title.replace(/\s+/g, "-")}-minutes.md"`,
    });
  });

  app.delete("/api/meetings/:id", (c) => {
    const ok = store.delete(c.req.param("id"));
    return c.json({ ok });
  });

  app.get("/", (c) => c.html(renderUi()));

  return app;
}

function renderUi(): string {
  const styles = MINUTES_STYLES.map((s) => `<option value="${s}">${s}</option>`).join("");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Akowe — Meeting Minutes</title>
  <style>
    :root { --bg:#f7f6f2; --ink:#121212; --muted:#6b6962; --accent:#1a4d3e; --gold:#b8954a; --panel:#fff; --border:#ddd9d0; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:Inter,system-ui,sans-serif; background:var(--bg); color:var(--ink); }
    header { background:var(--ink); color:#f4f3ef; padding:28px 24px; }
    h1 { font-family:Georgia,serif; font-weight:300; margin:0; font-size:2.2rem; }
    .sub { color:var(--gold); font-size:11px; letter-spacing:.18em; text-transform:uppercase; margin-bottom:6px; }
    main { max-width:960px; margin:0 auto; padding:24px; display:grid; gap:20px; }
    .card { background:var(--panel); border:1px solid var(--border); border-radius:12px; padding:20px; }
    label { display:block; font-size:12px; color:var(--muted); margin-bottom:6px; text-transform:uppercase; letter-spacing:.1em; }
    input, textarea, select { width:100%; padding:12px; border:1px solid var(--border); border-radius:8px; font:inherit; margin-bottom:12px; }
    textarea { min-height:140px; font-family:ui-monospace,monospace; font-size:13px; }
    button { background:var(--accent); color:#fff; border:none; padding:12px 18px; border-radius:8px; font-weight:600; cursor:pointer; margin-right:8px; margin-bottom:8px; }
    button.secondary { background:transparent; color:var(--ink); border:1px solid var(--border); }
    button.record { background:#8b1e1e; }
    button.record.active { animation:pulse 1.2s infinite; }
    @keyframes pulse { 50% { opacity:.7; } }
    #preview { white-space:pre-wrap; font-size:14px; line-height:1.6; max-height:420px; overflow:auto; }
    .row { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
    @media (max-width:700px) { .row { grid-template-columns:1fr; } }
    #status { font-size:13px; color:var(--muted); }
  </style>
</head>
<body>
  <header><p class="sub">Akowe</p><h1>Minutes that write themselves.</h1></header>
  <main>
    <p id="status">Record or paste a transcript → transcribe → summarize → export.</p>
    <div class="card">
      <div class="row">
        <div><label>Meeting title</label><input id="title" placeholder="Q2 Product Review"/></div>
        <div><label>Date</label><input id="date" type="date"/></div>
      </div>
      <label>Attendees (comma-separated)</label>
      <input id="attendees" placeholder="Amaka, Tunde, Dev team"/>
      <label>Minutes style</label>
      <select id="style">${styles}</select>
      <button type="button" id="btn-create">Create meeting</button>
    </div>
    <div class="card">
      <label>Transcript (paste) or record audio</label>
      <textarea id="transcript" placeholder="Speaker: Discussion text…"></textarea>
      <button type="button" class="record" id="btn-record">● Record</button>
      <button type="button" id="btn-transcribe">Process transcript</button>
      <button type="button" id="btn-summarize">Summarize</button>
      <button type="button" class="secondary" id="btn-export-md">Export Markdown</button>
      <button type="button" class="secondary" id="btn-export-html">Export HTML</button>
    </div>
    <div class="card"><label>Preview</label><div id="preview">—</div></div>
  </main>
  <script>
    let meetingId = null;
    let mediaRecorder = null;
    let chunks = [];
    const dateEl = document.getElementById('date');
    dateEl.value = new Date().toISOString().slice(0,10);

    async function api(path, opts) {
      const r = await fetch(path, opts);
      if (!r.ok) throw new Error(await r.text());
      return r.json().catch(() => r.text());
    }

    document.getElementById('btn-create').onclick = async () => {
      const m = await api('/api/meetings', {
        method: 'POST',
        headers: {'content-type':'application/json'},
        body: JSON.stringify({
          title: document.getElementById('title').value || 'Untitled meeting',
          date: dateEl.value,
          attendees: document.getElementById('attendees').value.split(',').map(s=>s.trim()).filter(Boolean),
          style: document.getElementById('style').value
        })
      });
      meetingId = m.id;
      document.getElementById('status').textContent = 'Meeting created: ' + m.id;
    };

    document.getElementById('btn-transcribe').onclick = async () => {
      if (!meetingId) { alert('Create a meeting first'); return; }
      const text = document.getElementById('transcript').value;
      let body = { text };
      if (chunks.length) {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const buf = await blob.arrayBuffer();
        const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
        body = { audioBase64: b64, filename: 'recording.webm' };
      }
      const res = await api('/api/meetings/' + meetingId + '/transcribe', {
        method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify(body)
      });
      document.getElementById('preview').textContent = res.meeting.transcript.map(t =>
        (t.speaker ? t.speaker + ': ' : '') + t.text).join('\\n');
      chunks = [];
    };

    document.getElementById('btn-summarize').onclick = async () => {
      if (!meetingId) return;
      const res = await api('/api/meetings/' + meetingId + '/summarize', { method: 'POST' });
      document.getElementById('preview').textContent = res.meeting.summary + '\\n\\nDecisions:\\n' +
        res.meeting.decisions.join('\\n') + '\\n\\nActions:\\n' +
        res.meeting.actionItems.map(a => '- ' + a.owner + ': ' + a.task).join('\\n');
    };

    document.getElementById('btn-export-md').onclick = () => {
      if (!meetingId) return;
      window.open('/api/meetings/' + meetingId + '/export?format=md&style=' + document.getElementById('style').value);
    };
    document.getElementById('btn-export-html').onclick = () => {
      if (!meetingId) return;
      window.open('/api/meetings/' + meetingId + '/export?format=html&style=' + document.getElementById('style').value);
    };

    const btnRec = document.getElementById('btn-record');
    btnRec.onclick = async () => {
      if (mediaRecorder?.state === 'recording') {
        mediaRecorder.stop();
        btnRec.classList.remove('active');
        btnRec.textContent = '● Record';
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks = [];
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = e => chunks.push(e.data);
      mediaRecorder.start();
      btnRec.classList.add('active');
      btnRec.textContent = '■ Stop';
    };
  </script>
</body>
</html>`;
}

export function startServer(port?: number, deps?: AppDeps) {
  const d = deps ?? createDeps();
  const p = port ?? d.config.port;
  const app = createApp(d);
  serve({ fetch: app.fetch, port: p });
  return { app, port: p };
}
