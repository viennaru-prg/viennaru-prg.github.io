// Verifies the local feedback bridge: POST /api/review writes a line to
// the inbox, and static files are served. Run: node test/feedback-server.test.js
"use strict";
const os = require("os");
const fs = require("fs");
const path = require("path");
const http = require("http");

const tmp = path.join(os.tmpdir(), "fb_inbox_" + Date.now() + ".jsonl");
process.env.FEEDBACK_INBOX = tmp;

const { createServer } = require("../tools/feedback-server.js");

let failures = 0;
function check(n, c) {
  if (c) console.log("  PASS  " + n);
  else { console.log("  FAIL  " + n); failures++; }
}

function req(opts, body) {
  return new Promise((resolve) => {
    const r = http.request(opts, (res) => {
      let d = "";
      res.on("data", (c) => d += c);
      res.on("end", () => resolve({ status: res.statusCode, body: d }));
    });
    r.on("error", () => resolve({ status: 0, body: "" }));
    if (body) r.write(body);
    r.end();
  });
}

(async () => {
  const srv = createServer().listen(0, "127.0.0.1");
  await new Promise((r) => srv.once("listening", r));
  const port = srv.address().port;

  // 1) static serving
  const idx = await req({ host: "127.0.0.1", port, path: "/", method: "GET" });
  check("serves index.html at /", idx.status === 200 &&
    idx.body.indexOf("프로젝트 갤러리") > -1);

  const game = await req({ host: "127.0.0.1", port,
    path: "/projects/p1/index.html", method: "GET" });
  check("serves project file", game.status === 200 &&
    game.body.indexOf("ORBIT") > -1);

  // 2) path traversal blocked
  const trav = await req({ host: "127.0.0.1", port,
    path: "/../../secret", method: "GET" });
  check("blocks path traversal", trav.status === 403 || trav.status === 404);

  // 3) POST review -> appended to inbox
  const payload = JSON.stringify({
    projectId: "p1", projectN: 1, title: "ORBIT",
    rating: 4, text: "조작은 쉬운데 금방 질려요", savedAt: "2026-05-16"
  });
  const post = await req({
    host: "127.0.0.1", port, path: "/api/review", method: "POST",
    headers: { "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(payload) }
  }, payload);
  check("POST /api/review returns ok",
    post.status === 200 && post.body.indexOf('"ok":true') > -1);

  const written = fs.existsSync(tmp) ? fs.readFileSync(tmp, "utf8") : "";
  const rec = written.trim() ? JSON.parse(written.trim().split("\n").pop()) : {};
  check("inbox line has the review text",
    rec.text === "조작은 쉬운데 금방 질려요");
  check("inbox line has rating + project", rec.rating === 4 && rec.projectId === "p1");
  check("inbox line stamped with receivedAt", typeof rec.receivedAt === "string");

  // 4) bad json rejected
  const bad = await req({ host: "127.0.0.1", port, path: "/api/review",
    method: "POST", headers: { "Content-Type": "application/json" } }, "{nope");
  check("rejects bad json", bad.status === 400);

  srv.close();
  try { fs.unlinkSync(tmp); } catch (e) {}

  console.log(failures === 0 ? "\nALL CHECKS PASSED"
    : "\n" + failures + " CHECK(S) FAILED");
  process.exit(failures === 0 ? 0 : 1);
})();
