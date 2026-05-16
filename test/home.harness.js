// Headless verification for index.html review system.
// Stubs DOM + localStorage, loads the embedded <script>, exercises the
// pure review logic. Run: node test/home.harness.js
"use strict";
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("FAIL: no <script>"); process.exit(1); }
const code = m[1];

let failures = 0;
function check(name, cond) {
  if (cond) console.log("  PASS  " + name);
  else { console.log("  FAIL  " + name); failures++; }
}

// generic DOM node stub
function node() {
  const n = {
    className: "", _html: "", style: {}, href: "", value: "",
    placeholder: "", textContent: "",
    set innerHTML(v) { this._html = v; },
    get innerHTML() { return this._html; },
    appendChild() {}, insertAdjacentHTML() {}, focus() {}, select() {},
    addEventListener() {},
    querySelector() { return node(); },
    querySelectorAll() { return []; }
  };
  return n;
}
global.document = {
  createElement: () => node(),
  getElementById: () => node()
};
const store = {};
global.window = {
  localStorage: {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); }
  }
};

let loadErr = null;
try { (0, eval)(code); } catch (e) { loadErr = e; }
check("index.html script loads without throwing", !loadErr);
if (loadErr) { console.error(loadErr); process.exit(1); }

const H = global.window.__HOME__;
check("exposes review API", !!H && typeof H.putReview === "function");
H._setStore("test_reviews");

const proj = { id: "p1", n: 1, title: "ORBIT" };

check("no review initially", H.getReview("p1") === null);

const r1 = H.putReview("p1", 4, "재밌는데 좀 쉬워요");
check("putReview stores rating", r1.rating === 4);
check("putReview stores text", r1.text === "재밌는데 좀 쉬워요");
check("savedAt is YYYY-MM-DD", /^\d{4}-\d{2}-\d{2}$/.test(r1.savedAt));
check("getReview returns saved", H.getReview("p1").text === "재밌는데 좀 쉬워요");
check("history empty on first save", r1.history.length === 0);

// re-save identical -> no history growth
const r2 = H.putReview("p1", 4, "재밌는데 좀 쉬워요");
check("identical re-save adds no history", r2.history.length === 0);

// edit -> previous version pushed to history
const r3 = H.putReview("p1", 5, "수정함: 난이도 올리니 더 좋아요");
check("edit keeps new text", H.getReview("p1").text.indexOf("수정함") === 0);
check("edit pushes old to history", r3.history.length === 1);
check("history holds previous text",
  r3.history[0].text === "재밌는데 좀 쉬워요" && r3.history[0].rating === 4);

const msg = H.buildClaudeMessage(proj, H.getReview("p1"));
check("Claude message has header",
  msg.indexOf("[후기] 프로젝트 1 ORBIT · 별점 5/5") === 0);
check("Claude message includes the text",
  msg.indexOf("수정함: 난이도 올리니 더 좋아요") > -1);

// persistence across reload (same store key)
check("persisted to localStorage",
  store["test_reviews"] && store["test_reviews"].indexOf("수정함") > -1);

console.log(failures === 0 ? "\nALL CHECKS PASSED"
  : "\n" + failures + " CHECK(S) FAILED");
process.exit(failures === 0 ? 0 : 1);
