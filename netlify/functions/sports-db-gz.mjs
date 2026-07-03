/**
 * Same-origin proxy for sports-db gzip assets on GitHub Releases.
 * Browsers cannot fetch release URLs directly (CORS). Each chunk stays under Netlify's ~6MB function limit.
 */
const RELEASE_BASE =
  process.env.SPORTS_DB_RELEASE_BASE ??
  "https://github.com/michaelTheKing0616/Tope-s-Portfolio/releases/download/sports-db-latest/sportverse-cdn";

const FILE_PATTERN = /^[a-z0-9-]+(\.chunks\.json|-\d{3}\.json\.gz)$/;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders(), body: "" };
  }

  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers: corsHeaders(), body: "Method not allowed" };
  }

  const file = event.queryStringParameters?.file;
  if (!file || !FILE_PATTERN.test(file)) {
    return { statusCode: 400, headers: corsHeaders(), body: "Invalid file parameter" };
  }

  const upstream = `${RELEASE_BASE}/${file}`;
  try {
    const res = await fetch(upstream, { redirect: "follow" });
    if (!res.ok) {
      return {
        statusCode: res.status,
        headers: corsHeaders(),
        body: `Upstream failed (${res.status}): ${upstream}`,
      };
    }

    const buf = Buffer.from(await res.arrayBuffer());
    const contentType = file.endsWith(".json.gz") ? "application/gzip" : "application/json";

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders(),
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      },
      body: buf.toString("base64"),
      isBase64Encoded: true,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { statusCode: 502, headers: corsHeaders(), body: `Proxy error: ${message}` };
  }
};
