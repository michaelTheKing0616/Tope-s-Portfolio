const MAX_CHUNK = 480;
const OVERLAP = 80;

/** Split text into overlapping passages sized for retrieval. */
export function chunkText(text: string, filePath: string): { startLine: number; endLine: number; text: string }[] {
  const lines = text.split(/\r?\n/);
  const chunks: { startLine: number; endLine: number; text: string }[] = [];
  let buf: string[] = [];
  let start = 1;

  const flush = (endLine: number) => {
    const body = buf.join("\n").trim();
    if (body) chunks.push({ startLine: start, endLine, text: body });
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    buf.push(line);
    const size = buf.join("\n").length;
    if (size >= MAX_CHUNK) {
      flush(i + 1);
      const tail = buf.join("\n").slice(-OVERLAP);
      buf = tail ? [tail] : [];
      start = Math.max(1, i);
    }
  }
  if (buf.length) flush(lines.length);
  return chunks;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}
