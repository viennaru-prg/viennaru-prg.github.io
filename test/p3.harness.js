// Headless verification for projects/p3/index.html (ECHO).
// Cumulative-feedback property: SKILL only, never luck. Proven by a
// "perfect dodger" that uses ONLY telegraphed info (each ring's shown gap)
// and must survive max difficulty through stages + mini-boss + boss with
// ZERO hits. Run: node test/p3.harness.js
"use strict";
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(
  path.join(__dirname, "..", "projects", "p3", "index.html"), "utf8");
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
    arc: noop, fill: noop, stroke: noop, fillRect: noop, fillText: noop,
    translate: noop, fillStyle: "", strokeStyle: "", lineWidth: 0,
    shadowColor: "", shadowBlur: 0, globalAlpha: 1, font: "", textAlign: "" };
}
function elStub() {
  const set = {};
  return { _t: "", set textContent(v){ this._t = String(v); },
    get textContent(){ return this._t; }, set innerHTML(v){}, width: 0,
    height: 0, getContext: () => ctxStub(), onclick: null,
    appendChild: noop,
    classList: { add:(c)=>{set[c]=1;}, remove:(c)=>{delete set[c];},
      contains:(c)=>!!set[c] } };
}
const els = {};
["c","score","meta","sh","hud","startScreen","upgScreen","overScreen",
 "finalScore","bestMsg","retryHint","upgCards","upgTitle"].forEach(
  i => els[i] = elStub());
global.document = {
  getElementById: (i) => els[i] || elStub(),
  createElement: () => elStub()
};
const store = {};
const WW = 900, HH = 640;
global.window = {
  innerWidth: WW, innerHeight: HH, addEventListener: noop,
  requestAnimationFrame: noop,
  localStorage: { getItem:(k)=> (k in store ? store[k] : null),
    setItem:(k,v)=>{ store[k] = String(v); } }
};

let err = null;
try { (0, eval)(code); } catch (e) { err = e; }
check("script loads without throwing", !err);
if (err) { console.error(err); process.exit(1); }

const A = global.window.__ECHO__;
const C = A.consts;
check("exposes test API", !!A && !!A.G);
check("starts on 'start' screen", A.G.screen === "start");

// ---- stage structure ----
check("stage 3 = MINI-BOSS", A.stageType(3) === "MINI");
check("stage 6 = BOSS", A.stageType(6) === "BOSS");
check("stage 2 = NORMAL", A.stageType(2) === "NORMAL");

// ---- fairness math: gap never out-rotates the player; one ring at a time ----
const ar = A.arena();
const midR = ar.AR * 0.5;
function fairAngular(stage, type) {
  const playerAngular = C.BASE_VMAX / midR;     // rad/frame the player can turn
  return A.gapRot(stage, type) < playerAngular;
}
check("gap rotation < player turn rate (NORMAL 10)", fairAngular(10, "NORMAL"));
check("gap rotation < player turn rate (BOSS 12)", fairAngular(12, "BOSS"));
function singleImminent(stage, type) {
  const spacing = A.ringSpeed(stage, type) * A.ringGap(stage, type);
  return spacing > C.RING_TH + C.PR_BASE;        // rings never overlap at player
}
check("only one ring imminent (NORMAL 10)", singleImminent(10, "NORMAL"));
check("only one ring imminent (BOSS 18)", singleImminent(18, "BOSS"));

// ---- difficulty monotonic but bounded ----
check("ring speed rises with stage",
  A.ringSpeed(15, "NORMAL") > A.ringSpeed(1, "NORMAL"));
check("gap narrows with stage",
  A.gapW(15, "NORMAL") < A.gapW(1, "NORMAL"));
check("gap floored (never impossible)", A.gapW(99, "BOSS") >= 0.62);
check("ring speed capped", A.ringSpeed(99, "BOSS") <= 2.4);

// ---- THE proof: a perfect dodger (telegraph-only) survives, no luck ----
A.startGame();
function perfectDodgerStep() {
  const G = A.G;
  const a = A.arena();
  const prNow = A.dist(G.px, G.py, a.CX, a.CY);
  // pick the imminent unresolved ring closest from outside
  let tgt = null;
  for (let i = 0; i < G.rings.length; i++) {
    const R = G.rings[i];
    if (R.hitChecked) continue;
    if (R.r < prNow - (C.RING_TH + G.pr)) continue;   // already passed inward
    if (!tgt || R.r < tgt.r) tgt = R;
  }
  const ang = tgt ? tgt.gapA : Math.atan2(G.py - a.CY, G.px - a.CX);
  G.tx = a.CX + midR * Math.cos(ang);
  G.ty = a.CY + midR * Math.sin(ang);
}
let died = false, maxStage = 1, sawMini = false, sawBoss = false,
    bossCleared = false, upgrades = 0;
for (let f = 0; f < 24000; f++) {
  if (A.G.screen === "upgrade") { upgrades++; A.resumeUpgrade(); }
  if (A.G.screen !== "playing") { if (A.G.screen === "over") { died = true; break; } }
  perfectDodgerStep();
  A.update();
  if (A.G.screen === "over") { died = true; break; }
  if (A.G.stageType === "MINI") sawMini = true;
  if (A.G.stageType === "BOSS") sawBoss = true;
  if (A.G.boss && A.G.boss.active === false && A.G.stage >= 6 && sawBoss)
    bossCleared = bossCleared || A.G.score > 0;
  if (A.G.stage > maxStage) maxStage = A.G.stage;
}
check("perfect dodger NEVER dies (skill, not luck)", !died);
check("ran deep enough to test structure (stage >= 7)", maxStage >= 7);
check("encountered a MINI-BOSS stage", sawMini);
check("encountered a BOSS stage", sawBoss);
check("cleared at least one upgrade screen", upgrades >= 1);
check("scored many waves while surviving", A.G.score > 25);

// ---- a wrong position DOES kill (collision real, not no-op) ----
A.startGame();
// put player on the opposite side of the gap (player angle PI, gap at 0)
A.G.px = ar.CX - 60; A.G.py = ar.CY; A.G.tx = A.G.px; A.G.ty = A.G.py;
const prK = A.dist(A.G.px, A.G.py, ar.CX, ar.CY);
A.G.rings = [{ r: prK + 1, v: 2, gapA: 0, gapW: 0.3, rot: 0,
  grazed: false, hitChecked: false, type: "NORMAL" }];
A.update();
check("being outside the gap kills (collision works)",
  A.G.screen === "over");

// ---- boss HP drains to clear with bonus ----
A.startGame();
A.enterStage(6);
check("BOSS stage activates boss", A.G.boss.active &&
  A.G.boss.hp === C.BOSS_HP);
let bonus = false;
for (let p = 0; p < C.BOSS_HP; p++) {
  const a = A.arena();
  const pr = A.dist(A.G.px, A.G.py, a.CX, a.CY);
  A.G.rings = [{ r: pr, v: 1, gapA: A.angNorm(Math.atan2(
    A.G.py - a.CY, A.G.px - a.CX)), gapW: 1.0, rot: 0,
    grazed: false, hitChecked: false, type: "BOSS" }];
  const before = A.G.score;
  A.update();
  if (A.G.screen === "upgrade") A.resumeUpgrade();
  if (A.G.score - before >= 16) bonus = true;
}
check("boss defeated after BOSS_HP clean passes", !A.G.boss.active);
check("boss clear grants bonus score", bonus);

// ---- restart debounce + best ----
A.G.screen = "over"; A.G.overAt = Date.now();
A.handleTap();
check("instant retry debounced", A.G.screen === "over");
A.G.overAt = Date.now() - 5000;
A.handleTap();
check("retry after delay -> playing", A.G.screen === "playing");

A.startGame();
A.G.score = 123;
A.G.px = ar.CX - 70; A.G.py = ar.CY; A.G.tx = A.G.px; A.G.ty = A.G.py;
const prB = A.dist(A.G.px, A.G.py, ar.CX, ar.CY);
A.G.rings = [{ r: prB + 1, v: 2, gapA: 0, gapW: 0.2, rot: 0,
  grazed: false, hitChecked: false, type: "NORMAL" }];
A.update();
check("best saved to localStorage", store["echo_best"] === "123");

console.log(failures === 0 ? "\nALL CHECKS PASSED"
  : "\n" + failures + " CHECK(S) FAILED");
process.exit(failures === 0 ? 0 : 1);
