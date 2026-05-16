// Local feedback bridge: serves the site at http://localhost:8765 and
// accepts POST /api/review, writing each review to feedback/inbox.jsonl
// so Claude can read it directly — no copy/paste, no GitHub submit.
//
// Start:  node tools/feedback-server.js   (then open http://localhost:8765)
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const ROOT = path.join(__dirname, "..");
const INBOX = process.env.FEEDBACK_INBOX ||
  path.join(ROOT, "feedback", "inbox.jsonl");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon"
};

function safePath(reqPath) {
  let p = decodeURIComponent(reqPath.split("?")[0]);
  if (p === "/" || p === "") p = "/index.html";
  const full = path.normalize(path.join(ROOT, p));
  if (!full.startsWith(ROOT)) return null;          // block traversal
  return full;
}

function appendReview(rec) {
  const line = JSON.stringify(Object.assign(
    { receivedAt: new Date().toISOString() }, rec)) + "\n";
  fs.mkdirSync(path.dirname(INBOX), { recursive: true });
  fs.appendFileSync(INBOX, line, "utf8");
  return line;
}

function createServer() {
  return http.createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }

    const parsed = url.parse(req.url);

    if (req.method === "POST" && parsed.pathname === "/api/review") {
      let body = "";
      req.on("data", (c) => {
        body += c;
        if (body.length > 1e6) req.destroy();        // 1MB cap
      });
      req.on("end", () => {
        try {
          const rec = JSON.parse(body);
          if (typeof rec.text !== "string" && typeof rec.rating !== "number") {
            res.writeHead(400, { "Content-Type": "application/json" });
            return res.end('{"ok":false,"error":"invalid"}');
          }
          appendReview(rec);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end('{"ok":true}');
        } catch (e) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end('{"ok":false,"error":"bad json"}');
        }
      });
      return;
    }

    if (req.method === "GET") {
      const file = safePath(parsed.pathname);
      if (!file) { res.writeHead(403); return res.end("forbidden"); }
      fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404); return res.end("not found"); }
        res.writeHead(200, {
          "Content-Type": TYPES[path.extname(file)] || "application/octet-stream"
        });
        res.end(data);
      });
      return;
    }

    res.writeHead(405); res.end("method not allowed");
  });
}

module.exports = { createServer, appendReview, INBOX };

if (require.main === module) {
  const PORT = process.env.PORT || 8765;
  createServer().listen(PORT, "127.0.0.1", () => {
    console.log("Feedback bridge running:  http://localhost:" + PORT);
    console.log("Reviews append to: feedback/inbox.jsonl");
  });
}
