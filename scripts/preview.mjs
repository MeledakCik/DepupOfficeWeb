import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { resolve, sep, extname } from "node:path";

const root = resolve("out");
if (!existsSync(resolve(root, "index.html"))) throw new Error("Jalankan npm run build sebelum npm start.");
const port = Number(process.env.PORT ?? 3000);
const types = {
  ".html": "text/html; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".json": "application/json",
  ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript", ".webmanifest": "application/manifest+json",
  ".png": "image/png", ".webp": "image/webp", ".wasm": "application/wasm", ".ttf": "font/ttf", ".woff2": "font/woff2", ".gz": "application/gzip",
};
createServer((request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const file = resolve(root, "." + (pathname.endsWith("/") ? pathname + "index.html" : pathname));
    if (pathname === "/office") {
      response.writeHead(308, { Location: "/office/" + new URL(request.url, "http://localhost").search }).end();
      return;
    }
    if (!file.startsWith(root + sep) || !existsSync(file) || !statSync(file).isFile()) {
      response.writeHead(404).end();
      return;
    }
    response.setHeader("Content-Type", types[extname(file)] ?? "application/octet-stream");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("Cache-Control", pathname.startsWith("/_next/static/") ? "public, max-age=31536000, immutable" : "no-cache");
    if (request.method === "HEAD") response.end();
    else createReadStream(file).pipe(response);
  } catch { response.writeHead(400).end(); }
}).listen(port, "127.0.0.1", () => console.log("Depup Office · http://localhost:" + port));
