import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

export async function startServer({ root, port = 4173, host = "127.0.0.1" }) {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host ?? host}`);
      const decoded = decodeURIComponent(url.pathname);
      if (decoded.includes("..") || decoded.includes("\0")) {
        response.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
        response.end("forbidden");
        return;
      }

      let target = resolve(root, `.${decoded}`);
      const relativePath = relative(root, target);
      if (relativePath.startsWith("..") || relativePath.includes("..")) {
        response.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
        response.end("forbidden");
        return;
      }

      const info = await stat(target).catch(() => null);
      if (info?.isDirectory()) target = resolve(target, "index.html");

      const body = await readFile(target);
      response.writeHead(200, { "content-type": TYPES[extname(target)] ?? "application/octet-stream" });
      response.end(body);
    } catch {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("not found");
    }
  });

  await new Promise((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolvePromise);
  });

  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;
  return {
    server,
    url: `http://${host}:${actualPort}/`,
    close: () => new Promise((resolvePromise) => server.close(resolvePromise)),
  };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const root = resolve(process.cwd(), "site");
  const port = Number(process.env.PORT ?? 4173);
  const { url } = await startServer({ root, port });
  console.log(`Skills Book: ${url}`);
}