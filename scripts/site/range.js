// HTTP Range support for the hero video (iOS Safari needs 206 to play <video>).

/**
 * Parses a single-range `Range` header against a resource size.
 * Returns [start, end] (inclusive), "unsatisfiable", or null (ignore: no/multi/malformed range).
 */
export function parseRange(header, size) {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return null;
  const [, a, b] = m;
  if (a === "" && b === "") return null;
  if (a === "") {
    const n = Number(b);
    if (n === 0) return "unsatisfiable";
    return [Math.max(0, size - n), size - 1];
  }
  const start = Number(a);
  if (start >= size) return "unsatisfiable";
  const end = b === "" ? size - 1 : Math.min(Number(b), size - 1);
  if (end < start) return null;
  return [start, end];
}

function pick(from, status, extra) {
  const headers = new Headers();
  for (const k of ["content-type", "cache-control", "etag", "last-modified"]) {
    const v = from.headers.get(k);
    if (v) headers.set(k, v);
  }
  headers.set("accept-ranges", "bytes");
  for (const [k, v] of Object.entries(extra)) headers.set(k, v);
  return headers;
}

/** Turns a full (200) asset response into the response the request's Range asks for. */
export async function withRange(request, response) {
  const head = request.method === "HEAD";
  const buf = await response.arrayBuffer();
  const size = buf.byteLength;
  const range = parseRange(request.headers.get("range"), size);

  if (range === "unsatisfiable") {
    return new Response(null, {
      status: 416,
      headers: pick(response, 416, { "content-range": `bytes */${size}` }),
    });
  }
  if (!range) {
    return new Response(head ? null : buf, {
      status: 200,
      headers: pick(response, 200, { "content-length": String(size) }),
    });
  }
  const [start, end] = range;
  return new Response(head ? null : buf.slice(start, end + 1), {
    status: 206,
    headers: pick(response, 206, {
      "content-range": `bytes ${start}-${end}/${size}`,
      "content-length": String(end - start + 1),
    }),
  });
}
