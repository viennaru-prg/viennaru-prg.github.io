// Headless verification for projects/p2/index.html (WEAVE).
// The defining property (from user feedback): outcome is SKILL, never luck —
// every consecutive gate must be reachable by a perfect player. Run:
//   node test/p2.harness.js
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
    arc: noop, fill: noop, fillRect: noop, translate: noop,
    fillStyle: "", shadowColor: "", shadowBlur: 0, globalAlpha: 1 };
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
  innerWidth: 500, innerHeight: 800, addEventListener: noop,
  requestAnimationFrame: noop,
  localStorage: { getItem:(k)=> (k in store ? store[k] : null),
    setItem:(k,v)=>{ store[k] = String(v); } }
};

let err = null;
try { (0, eval)(code); } catch (e) { err = e; }
check("script loads without throwing", !err);
if (err) { console.error(err); process.exit(1); }

const A = global.window.__WEAVE__;
const C = A.consts;
check("exposes test API", !!A && !!A.G);
check("starts on 'start' screen", A.G.screen === "start");

A.handleInput();
check("input -> playing", A.G.screen === "playing");
check("score starts at 0", A.G.score === 0);

// run frames; no exception, gates keep flowing
let threw = null;
try { for (let i = 0; i < 600 && A.G.screen === "playing"; i++) {
  A.G.targetX = A.G.px; A.update();
} } catch (e) { threw = e; }
check("no exception over 600 frames (auto-centered survives)", !threw);
if (threw) console.error(threw);

// ---- CORE FAIRNESS: every gate reachable at every level (no luck) ----
function reachabilityHoldsAtLevel(lv) {
  A.reset();
  A.G.speed = A.speedFor(lv);
  A.G.gapW = A.gapForLevel(lv);
  const maxT = A.maxTravel();           // px the player can move between gates
  let prev = A.G.px, worstRatio = 0;
  for (let i = 0; i < 4000; i++) {
    const cx = A.nextCenter(prev);
    const delta = Math.abs(cx - prev);
    worstRatio = Math.max(worstRatio, delta / maxT);
    if (cx < A.G.gapW / 2 || cx > global.window.innerWidth - A.G.gapW / 2) return false;
    prev = cx;
  }
  return worstRatio <= 1.0;             // never demands more than VMAX
}
check("reachable at LV1 (skill, not luck)", reachabilityHoldsAtLevel(0));
check("reachable at LV5", reachabilityHoldsAtLevel(4));
check("reachable at LV10", reachabilityHoldsAtLevel(9));
check("reachable at LV20", reachabilityHoldsAtLevel(19));

// fairness survives a mid-flight level-up (speed rises after gate spawned)
(function () {
  const lv = 6;
  A.G.speed = A.speedFor(lv); A.G.gapW = A.gapForLevel(lv);
  const worstDelta = A.reach();                       // max gap the spawner allows
  const fasterSpeed = A.speedFor(lv + 1);             // speed by the time it arrives
  const framesAvail = C.GATE_GAP / fasterSpeed;
  const neededVel = worstDelta / framesAvail;         // px/frame the player needs
  check("still reachable after a level-up", neededVel <= C.VMAX + 1e-9);
})();

// ---- collision / scoring ----
A.reset();
A.G.targetX = A.G.px;
A.G.gates = [{ y: 800 - 90, cx: A.G.px, w: 160, scored: false }];
const s0 = A.G.score;
A.update();
check("passing through the gap scores", A.G.score === s0 + 1);

A.reset();
A.G.targetX = A.G.px;
A.G.gates = [{ y: 800 - 90, cx: A.G.px + 400, w: 80, scored: false }];
A.update();
check("missing the gap -> game over", A.G.screen === "over");

// difficulty raises demand only (speed up, gap down, floored)
check("speed increases with level", A.speedFor(5) > A.speedFor(0));
check("gap narrows with level", A.gapForLevel(5) < A.gapForLevel(0));
check("gap is floored (never impossible)", A.gapForLevel(99) >= 96);

// restart debounce + best persistence
A.G.overAt = Date.now();
A.handleInput();
check("instant retry debounced", A.G.screen === "over");
A.G.overAt = Date.now() - 5000;
A.handleInput();
check("retry after delay -> playing", A.G.screen === "playing");

A.reset();
A.G.score = 88; A.G.targetX = A.G.px;
A.G.gates = [{ y: 800 - 90, cx: A.G.px + 400, w: 60, scored: false }];
A.update();
check("best saved to localStorage", store["weave_best"] === "88");

console.log(failures === 0 ? "\nALL CHECKS PASSED"
  : "\n" + failures + " CHECK(S) FAILED");
process.exit(failures === 0 ? 0 : 1);
