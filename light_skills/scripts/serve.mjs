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

export function parseServeArgs(argv = [], env = process.env) {
  let rawPort = env.PORT ?? "4173";
  let host = "127.0.0.1";

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--port") {
      rawPort = argv[index + 1];
      index += 1;
    } else if (arg.startsWith("--port=")) {
      rawPort = arg.slice("--port=".length);
    } else if (arg === "--host") {
      host = argv[index + 1];
      index += 1;
    } else if (arg.startsWith("--host=")) {
      host = arg.slice("--host=".length);
    }
  }

  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`端口无效: ${rawPort}。用法: npm run serve -- --port 8001`);
  }
  if (!host) throw new Error("host 不能为空。用法: npm run serve -- --host 127.0.0.1");
  return { port, host };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const root = resolve(process.cwd(), "site");
  const { port, host } = parseServeArgs(process.argv.slice(2));
  try {
    const { url } = await startServer({ root, port, host });
    console.log(`Skills Book: ${url}`);
  } catch (error) {
    if (error.code === "EADDRINUSE") {
      console.error(`端口 ${port} 已被占用。换一个端口，例如: npm run serve -- --port 8001`);
      process.exit(1);
    }
    throw error;
  }
}