// Headless verification for projects/p2/index.html (WEAVE + stages/bosses).
// Defining property (cumulative feedback): SKILL only, never luck — every
// gate reachable; moving gaps trackable; plus stage/mini-boss/boss structure.
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
    arc: noop, fill: noop, fillRect: noop, fillText: noop, translate: noop,
    fillStyle: "", shadowColor: "", shadowBlur: 0, globalAlpha: 1,
    font: "", textAlign: "" };
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
  innerWidth: 520, innerHeight: 800, addEventListener: noop,
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

// run frames; never throws (auto-centered may die — expected, skill game)
let threw = null;
try { for (let i = 0; i < 1500; i++) {
  A.G.targetX = A.G.px; A.update();
  if (A.G.screen === "over") { A.G.overAt = Date.now() - 5000; A.handleInput(); }
} } catch (e) { threw = e; }
check("no exception over 1500 frames across stages", !threw);
if (threw) console.error(threw);

// ---- stage structure ----
check("stageOf: 8 gates per stage",
  A.stageOf(0) === 1 && A.stageOf(7) === 1 && A.stageOf(8) === 2 &&
  A.stageOf(40) === 6);
check("stage 3 is MINI-BOSS", A.stageType(3) === "MINI");
check("stage 6 is BOSS", A.stageType(6) === "BOSS");
check("stage 2 is NORMAL", A.stageType(2) === "NORMAL");

// ---- CORE FAIRNESS: reachable at every stage type ----
function reachOK(stage) {
  A.reset();
  const cfg = A.configFor(stage);
  A.G.speed = cfg.speed; A.G.gapW = cfg.gap;
  const maxT = A.maxTravel();
  let prev = A.G.px, worst = 0;
  for (let i = 0; i < 3000; i++) {
    const c = A.nextCenter(prev, cfg.gim.amp);
    worst = Math.max(worst, Math.abs(c - prev) / maxT);
    const margin = cfg.gap / 2 + cfg.gim.amp;
    if (c < margin - 1 || c > global.window.innerWidth - margin + 1) return false;
    prev = c;
  }
  return worst <= 1.0;
}
check("reachable: NORMAL stage 2", reachOK(2));
check("reachable: MINI-BOSS stage 3", reachOK(3));
check("reachable: BOSS stage 6", reachOK(6));
check("reachable: deep stage 13 (MINI)", reachOK(13));
check("reachable: deep stage 18 (BOSS)", reachOK(18));

// ---- moving gaps must be trackable by a perfect player (skill, not luck) ----
function velOK(stage) {
  const g = A.gimmickFor(stage, A.stageType(stage));
  if (!g.moving) return true;
  const maxVel = g.amp * g.omega;          // max |d cx / d frame|
  return maxVel <= C.MOVE_VEL_CAP + 1e-9 && maxVel < C.VMAX;
}
check("moving gap trackable: MINI stage 3", velOK(3));
check("moving gap trackable: BOSS stage 6", velOK(6));
check("moving gap trackable: NORMAL stage 9", velOK(9));
check("MOVE_VEL_CAP below player max", C.MOVE_VEL_CAP < C.VMAX);

// ---- collision / scoring ----
A.reset(); A.G.targetX = A.G.px;
A.G.gates = [{ y: 800 - 90, base: A.G.px, w: 160, moving: false,
  amp: 0, omega: 0, phase: 0, life: 0, scored: false, type: "NORMAL" }];
const s0 = A.G.score;
A.update();
check("through the gap scores", A.G.score === s0 + 1);

A.reset(); A.G.targetX = A.G.px;
A.G.gates = [{ y: 800 - 90, base: A.G.px + 400, w: 70, moving: false,
  amp: 0, omega: 0, phase: 0, life: 0, scored: false, type: "NORMAL" }];
A.update();
check("missing the gap -> game over", A.G.screen === "over");

// ---- BOSS mechanic: HP drains over required passes, then clears w/ bonus ----
A.reset();
A.G.score = 40;                     // stageOf -> 6 (BOSS range 40..47)
A.enterStage(6);
check("entering BOSS activates boss", A.G.boss.active &&
  A.G.boss.hp === C.BOSS_HP);
let bonusSeen = false;
for (let p = 0; p < C.BOSS_HP; p++) {
  A.G.targetX = A.G.px;
  A.G.gates = [{ y: 800 - 90, base: A.G.px, w: 200, moving: false,
    amp: 0, omega: 0, phase: 0, life: 0, scored: false, type: "BOSS" }];
  const before = A.G.score;
  A.update();
  if (A.G.score - before >= 11) bonusSeen = true;   // +1 pass +10 clear
}
check("boss defeated after BOSS_HP passes", !A.G.boss.active);
check("boss clear grants bonus score", bonusSeen);

// ---- difficulty monotonic (within same stage type) ----
check("speed rises with stage",
  A.speedFor(10, "NORMAL") > A.speedFor(1, "NORMAL"));
check("gap narrows with stage",
  A.gapForStage(10, "NORMAL") < A.gapForStage(1, "NORMAL"));
check("gap floored (never impossible)", A.gapForStage(99, "BOSS") >= 80);

// ---- restart debounce + best persistence ----
A.G.screen = "over"; A.G.overAt = Date.now();
A.handleInput();
check("instant retry debounced", A.G.screen === "over");
A.G.overAt = Date.now() - 5000;
A.handleInput();
check("retry after delay -> playing", A.G.screen === "playing");

A.reset();
A.G.score = 88; A.G.targetX = A.G.px;
A.G.gates = [{ y: 800 - 90, base: A.G.px + 400, w: 60, moving: false,
  amp: 0, omega: 0, phase: 0, life: 0, scored: false, type: "NORMAL" }];
A.update();
check("best saved to localStorage", store["weave_best"] === "88");

console.log(failures === 0 ? "\nALL CHECKS PASSED"
  : "\n" + failures + " CHECK(S) FAILED");
process.exit(failures === 0 ? 0 : 1);
