// Headless verification for projects/p1/index.html (no browser).
// Stubs DOM + canvas, loads the embedded <script>, drives the game,
// and asserts the core mechanics. Run: node test/p1.harness.js
"use strict";
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(
  path.join(__dirname, "..", "projects", "p1", "index.html"), "utf8");

const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("FAIL: no <script> found"); process.exit(1); }
const code = m[1];

let failures = 0;
function check(name, cond) {
  if (cond) console.log("  PASS  " + name);
  else { console.log("  FAIL  " + name); failures++; }
}

// ---- stubs ----
function noop() {}
function makeCtx() {
  return {
    clearRect: noop, save: noop, restore: noop, beginPath: noop,
    arc: noop, stroke: noop, fill: noop, translate: noop,
    strokeStyle: "", fillStyle: "", lineWidth: 0, lineCap: "",
    shadowColor: "", shadowBlur: 0, globalAlpha: 1
  };
}
function makeEl() {
  const set = {};
  return {
    _text: "",
    set textContent(v) { this._text = String(v); },
    get textContent() { return this._text; },
    width: 0, height: 0,
    getContext: () => makeCtx(),
    classList: {
      add: (c) => { set[c] = true; },
      remove: (c) => { delete set[c]; },
      contains: (c) => !!set[c]
    }
  };
}
const els = {};
["c","score","bestLine","hud","startScreen","overScreen","finalScore",
 "bestMsg","retryHint"].forEach(id => { els[id] = makeEl(); });

global.document = { getElementById: (id) => els[id] || makeEl() };

const store = {};
let rafCb = null;
global.window = {
  innerWidth: 800, innerHeight: 600,
  addEventListener: noop,
  requestAnimationFrame: (cb) => { rafCb = cb; },   // do not auto-loop
  localStorage: {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); }
  }
};
global.requestAnimationFrame = global.window.requestAnimationFrame;

// ---- load the game ----
let loadErr = null;
try { (0, eval)(code); } catch (e) { loadErr = e; }
check("script loads without throwing", !loadErr);
if (loadErr) { console.error(loadErr); process.exit(1); }

const API = global.window.__ORBIT__;
check("exposes test API", !!API && !!API.G);

// angDiff sanity
check("angDiff wraps correctly",
  Math.abs(API.angDiff(0.1, 6.18) - (0.1 - 6.18 + Math.PI * 2)) < 1e-9);

// 1) initial state
check("starts on 'start' screen", API.G.screen === "start");

// 2) first input starts the game
API.handleInput();
check("input -> playing", API.G.screen === "playing");
check("score reset to 0", API.G.score === 0);

// 3) run many frames; ball orbits past the fixed dot -> score must rise
let threw = null, sawScore = false;
try {
  for (let i = 0; i < 3000 && API.G.screen === "playing"; i++) {
    API.update();
    if (API.G.score > 0) sawScore = true;
  }
} catch (e) { threw = e; }
check("no exception during 3000 frames", !threw);
if (threw) console.error(threw);
check("score increases by collecting dots", sawScore || API.G.score > 0);

// 4) force a collision -> game over
if (API.G.screen !== "playing") API.startGame();
API.G.obstacles = [{ a: API.G.angle, half: 0.6, rot: 0 }];
API.update();
check("hitting obstacle -> over", API.G.screen === "over");

// 5) restart debounce, then restart works
API.G.overAt = Date.now();           // just died
API.handleInput();
check("instant retry is debounced", API.G.screen === "over");
API.G.overAt = Date.now() - 5000;    // enough time passed
API.handleInput();
check("retry after delay -> playing", API.G.screen === "playing");

// 6) best score persisted
API.G.score = 42;
API.G.obstacles = [{ a: API.G.angle, half: 0.6, rot: 0 }];
API.update();
check("best score saved to localStorage", store["orbit_best"] === "42");

console.log(failures === 0
  ? "\nALL CHECKS PASSED"
  : "\n" + failures + " CHECK(S) FAILED");
process.exit(failures === 0 ? 0 : 1);
