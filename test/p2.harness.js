// Headless verification for projects/p2/index.html (PIXEL FALL).
// Run: node test/p2.harness.js
"use strict";
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(
  path.join(__dirname, "..", "projects", "p2", "index.html"), "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("FAIL: no <script>"); process.exit(1); }
const code = m[1];

let failures = 0;
function check(n, c) {
  if (c) console.log("  PASS  " + n);
  else { console.log("  FAIL  " + n); failures++; }
}

function noop() {}
function ctxStub() {
  return { clearRect: noop, save: noop, restore: noop, beginPath: noop,
    arc: noop, fill: noop, stroke: noop, translate: noop, moveTo: noop,
    arcTo: noop, closePath: noop, fillStyle: "", strokeStyle: "",
    shadowColor: "", shadowBlur: 0, globalAlpha: 1, lineWidth: 0 };
}
function elStub() {
  const set = {};
  return { _t: "", set textContent(v){ this._t = String(v); },
    get textContent(){ return this._t; }, width: 0, height: 0,
    getContext: () => ctxStub(),
    classList: { add:(c)=>{set[c]=1;}, remove:(c)=>{delete set[c];},
      contains:(c)=>!!set[c] } };
}
const els = {};
["c","score","meta","combo","hud","startScreen","overScreen",
 "finalScore","bestMsg","retryHint"].forEach(i => els[i] = elStub());
global.document = { getElementById: (i) => els[i] || elStub() };
const store = {};
global.window = {
  innerWidth: 600, innerHeight: 800, addEventListener: noop,
  requestAnimationFrame: noop,
  localStorage: { getItem:(k)=> (k in store ? store[k] : null),
    setItem:(k,v)=>{ store[k] = String(v); } }
};

let err = null;
try { (0, eval)(code); } catch (e) { err = e; }
check("script loads without throwing", !err);
if (err) { console.error(err); process.exit(1); }

const A = global.window.__PIXEL__;
check("exposes test API", !!A && !!A.G);
check("starts on 'start' screen", A.G.screen === "start");

A.handleInput();
check("input -> playing", A.G.screen === "playing");
check("score starts at 0", A.G.score === 0);

// run frames with auto-spawn; ensure no exception, items spawn
let threw = null;
try { for (let i = 0; i < 400 && A.G.screen === "playing"; i++) A.update(); }
catch (e) { threw = e; }
check("no exception over 400 frames", !threw);
if (threw) console.error(threw);

// force a coin onto the player -> score up, combo up
if (A.G.screen !== "playing") A.reset();
A.G.items = [{ x: A.G.px, y: 800 - 70 + 4, r: 13, vy: 1, type: "coin" }];
const before = A.G.score;
A.update();
check("collecting coin raises score", A.G.score > before);
check("collecting coin raises combo", A.G.combo >= 1);
check("collected coin removed", A.G.items.length === 0);

// missed coin resets combo
A.G.combo = 5;
A.G.items = [{ x: 30, y: 800 + 50, r: 13, vy: 1, type: "coin" }];
A.update();
check("missed coin resets combo", A.G.combo === 0);

// bomb on player -> game over
A.reset();
A.G.items = [{ x: A.G.px, y: 800 - 70 + 4, r: 16, vy: 1, type: "bomb" }];
A.update();
check("bomb hit -> over", A.G.screen === "over");

// restart debounce
A.G.overAt = Date.now();
A.handleInput();
check("instant retry debounced", A.G.screen === "over");
A.G.overAt = Date.now() - 5000;
A.handleInput();
check("retry after delay -> playing", A.G.screen === "playing");

// best persisted
A.reset();
A.G.score = 77;
A.G.items = [{ x: A.G.px, y: 800 - 70 + 4, r: 16, vy: 1, type: "bomb" }];
A.update();
check("best saved to localStorage", store["pixelfall_best"] === "77");

// difficulty scales
A.G.score = 0;
const l0 = A.level();
A.G.score = 60;
check("level increases with score", A.level() > l0);

console.log(failures === 0 ? "\nALL CHECKS PASSED"
  : "\n" + failures + " CHECK(S) FAILED");
process.exit(failures === 0 ? 0 : 1);
