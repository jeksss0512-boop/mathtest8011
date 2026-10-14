import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { handleChatRequest } = require("./api/chat.js");
const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 8767);
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".json": "application/json; charset=utf-8" };

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => { raw += chunk; if (raw.length > 100000) reject(new Error("request_too_large")); });
    req.on("end", () => { try { resolve(JSON.parse(raw || "{}")); } catch { reject(new Error("invalid_json")); } });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === "/api/chat") {
    if (req.method !== "POST") return sendJson(res, 405, { ok: false, error_code: "method_not_allowed" });
    try {
      const result = await handleChatRequest(await readBody(req));
      return sendJson(res, result.ok ? 200 : (result.error_code === "missing_api_key" ? 503 : 502), result);
    } catch (error) {
      return sendJson(res, 400, { ok: false, error_code: error.message || "invalid_request" });
    }
  }
  const relative = decodeURIComponent(url.pathname === "/" ? "/app/trig-chatbot/index.html" : url.pathname).replace(/^\/+/, "");
  const filename = path.resolve(root, relative);
  if (!filename.startsWith(path.resolve(root))) return sendJson(res, 403, { error: "forbidden" });
  fs.readFile(filename, (error, data) => {
    if (error) return sendJson(res, 404, { error: "not_found" });
    res.writeHead(200, { "Content-Type": types[path.extname(filename)] || "application/octet-stream" });
    res.end(data);
  });
});

server.listen(port, "127.0.0.1", () => console.log(`Serving on http://127.0.0.1:${port}`));
