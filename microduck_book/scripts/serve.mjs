import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".md": "text/markdown; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml" };

export async function startServer({ root, port = 4174, host = "127.0.0.1" }) {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host ?? host}`);
      const decoded = decodeURIComponent(url.pathname);
      if (decoded.includes("..") || decoded.includes("\0")) {
        response.writeHead(403); response.end("forbidden"); return;
      }
      let target = resolve(root, `.${decoded}`);
      const rel = relative(root, target);
      if (rel.startsWith("..") || rel.includes("..")) {
        response.writeHead(403); response.end("forbidden"); return;
      }
      const info = await stat(target).catch(() => null);
      if (info?.isDirectory()) target = resolve(target, "index.html");
      const body = await readFile(target);
      response.writeHead(200, { "content-type": TYPES[extname(target)] ?? "application/octet-stream" });
      response.end(body);
    } catch {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" }); response.end("not found");
    }
  });
  await new Promise((resolvePromise, reject) => { server.once("error", reject); server.listen(port, host, resolvePromise); });
  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;
  return { server, url: `http://${host}:${actualPort}/`, close: () => new Promise((r) => server.close(r)) };
}

function parseArgs(argv = [], env = process.env) {
  let port = env.PORT ?? "4174";
  let host = "127.0.0.1";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--port") port = argv[++i];
    else if (argv[i].startsWith("--port=")) port = argv[i].slice(7);
    else if (argv[i] === "--host") host = argv[++i];
    else if (argv[i].startsWith("--host=")) host = argv[i].slice(7);
  }
  const n = Number(port);
  if (!Number.isInteger(n) || n < 1 || n > 65535) throw new Error(`端口无效: ${port}`);
  return { port: n, host };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const { port, host } = parseArgs(process.argv.slice(2));
  try {
    const { url } = await startServer({ root: resolve(process.cwd(), "site"), port, host });
    console.log(`Microduck Book: ${url}`);
  } catch (error) {
    if (error.code === "EADDRINUSE") { console.error(`端口 ${port} 已被占用，换一个: npm run serve -- --port 4175`); process.exit(1); }
    throw error;
  }
}