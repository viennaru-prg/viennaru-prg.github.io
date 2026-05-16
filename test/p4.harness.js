// Headless verification for projects/p4/index.html (PARRY).
// Cumulative-feedback property: SKILL ~95%, luck <=5%, never an unfair
// death. Proven by a "perfect parry-bot" that uses ONLY telegraphed info
// (each threat's shown direction + windup) and must survive max difficulty
// through stages + mini-boss + boss with ZERO hits.
// Run: node test/p4.harness.js
"use strict";
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(
  path.join(__dirname, "..", "projects", "p4", "index.html"), "utf8");
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
    moveTo: noop, lineTo: noop, translate: noop, fillStyle: "",
    strokeStyle: "", lineWidth: 0, shadowColor: "", shadowBlur: 0,
    globalAlpha: 1, font: "", textAlign: "" };
}
function elStub() {
  const set = {};
  return { _t: "", set textContent(v){ this._t = String(v); },
    get textContent(){ return this._t; }, set innerHTML(v){}, width: 0,
    height: 0, getContext: () => ctxStub(), onclick: null, appendChild: noop,
    classList: { add:(c)=>{set[c]=1;}, remove:(c)=>{delete set[c];},
      contains:(c)=>!!set[c] } };
}
const els = {};
["c","score","meta","combo","hud","startScreen","upgScreen","overScreen",
 "finalScore","bestMsg","retryHint","upgCards","upgTitle"].forEach(
  i => els[i] = elStub());
global.document = {
  getElementById: (i) => els[i] || elStub(),
  createElement: () => elStub()
};
const store = {};
global.window = {
  innerWidth: 900, innerHeight: 640, addEventListener: noop,
  requestAnimationFrame: noop,
  localStorage: { getItem:(k)=> (k in store ? store[k] : null),
    setItem:(k,v)=>{ store[k] = String(v); } }
};

let err = null;
try { (0, eval)(code); } catch (e) { err = e; }
check("script loads without throwing", !err);
if (err) { console.error(err); process.exit(1); }

const A = global.window.__PARRY__;
const C = A.consts;
check("exposes test API", !!A && !!A.G);
check("starts on 'start' screen", A.G.screen === "start");

// ---- stage structure ----
check("stage 3 = MINI-BOSS", A.stageType(3) === "MINI");
check("stage 6 = BOSS", A.stageType(6) === "BOSS");
check("stage 2 = NORMAL", A.stageType(2) === "NORMAL");

// ---- fairness math: always reactable (skill, not luck) ----
const tt = A.turnTime(C.GUARD_W);     // worst-case frames to half-turn
function fair(stage, type) {
  return A.windupFor(stage, type) >= tt &&
         A.spacingFor(stage, type) >= tt;
}
check("windup & spacing >= turn time (NORMAL 10)", fair(10, "NORMAL"));
check("windup & spacing >= turn time (BOSS 18)", fair(18, "BOSS"));
check("windup & spacing >= turn time (deep 40 BOSS)", fair(40, "BOSS"));

// ---- difficulty STEEPER (cumulative feedback) ----
check("windup shrinks a lot late",
  A.windupFor(1, "NORMAL") - A.windupFor(12, "NORMAL") >= 30);
check("spacing tightens a lot late",
  A.spacingFor(1, "NORMAL") - A.spacingFor(12, "NORMAL") >= 40);
check("parry arc shrinks late",
  A.parryArcFor(1, "NORMAL") - A.parryArcFor(12, "NORMAL") >= 0.15);
check("arc floored (precision, not impossible)",
  A.parryArcFor(99, "BOSS") >= 0.30);

// ---- allowed luck ~5% ----
check("LUCK_RATE within ~5%", C.LUCK_RATE > 0 && C.LUCK_RATE <= 0.05);

// ---- upgrade pool varied each time ----
check("pool has many options (>=7)", A.POOL.length >= 7);
let seen = {}, ok = true;
for (let r = 0; r < 60; r++) {
  const o = A.rollOffers();
  if (o.length !== 3) ok = false;
  const ks = {};
  o.forEach(function (u) {
    ks[u.k] = 1; seen[u.k] = 1;
    if (typeof u.ap !== "function" || typeof u.cost !== "number") ok = false;
  });
  if (Object.keys(ks).length !== 3) ok = false;
}
check("rollOffers gives 3 distinct valid upgrades", ok);
check("offers vary across runs (>=6 seen)", Object.keys(seen).length >= 6);

// ---- THE proof: perfect parry-bot (telegraph-only) never gets hit ----
A.startGame();
function botStep() {
  const G = A.G;
  let tgt = null;
  for (let i = 0; i < G.threats.length; i++) {
    const th = G.threats[i];
    if (th.resolved) continue;
    if (!tgt || th.t < tgt.t) tgt = th;
  }
  if (tgt) G.tf = tgt.dir;
}
let died = false, maxStage = 1, sawMini = false, sawBoss = false,
    upgrades = 0;
for (let f = 0; f < 22000; f++) {
  if (A.G.screen === "upgrade") { upgrades++; A.resumeUpgrade(); }
  botStep();
  A.update();
  if (A.G.screen === "over") { died = true; break; }
  if (A.G.stageType === "MINI") sawMini = true;
  if (A.G.stageType === "BOSS") sawBoss = true;
  if (A.G.stage > maxStage) maxStage = A.G.stage;
}
check("perfect parry-bot NEVER dies (skill, not luck)", !died);
check("ran deep enough (stage >= 7)", maxStage >= 7);
check("encountered MINI-BOSS", sawMini);
check("encountered BOSS", sawBoss);
check("cleared >=1 upgrade screen", upgrades >= 1);
check("scored many parries", A.G.score > 25);

// ---- wrong facing really kills (collision not a no-op) ----
A.startGame();
A.G.threats = [{ dir: Math.PI, t: 1, arc: 0.3, maxT: 1,
  resolved: false, type: "NORMAL" }];
A.G.gf = 0; A.G.tf = 0; A.G.guardW = 0.0001; A.G.shield = 0;
A.update();
check("mistimed/wrong facing -> game over", A.G.screen === "over");

// ---- shield absorbs one bad parry ----
A.startGame();
A.G.threats = [{ dir: Math.PI, t: 1, arc: 0.3, maxT: 1,
  resolved: false, type: "NORMAL" }];
A.G.gf = 0; A.G.tf = 0; A.G.guardW = 0.0001; A.G.shield = 1;
A.update();
check("shield absorbs the miss (no game over)", A.G.screen === "playing");
check("shield consumed", A.G.shield === 0);

// ---- boss HP drains to clear with bonus ----
A.startGame();
A.enterStage(6);
check("BOSS stage activates boss",
  A.G.boss.active && A.G.boss.hp === C.BOSS_HP);
let bonus = false;
for (let p = 0; p < C.BOSS_HP; p++) {
  A.G.threats = [{ dir: 0, t: 1, arc: 1.0, maxT: 1,
    resolved: false, type: "BOSS" }];
  A.G.gf = 0; A.G.tf = 0;
  const before = A.G.score;
  A.update();
  if (A.G.screen === "upgrade") A.resumeUpgrade();
  if (A.G.score - before >= 16) bonus = true;
}
check("boss defeated after BOSS_HP parries", !A.G.boss.active);
check("boss clear grants bonus", bonus);

// ---- restart debounce + best ----
A.G.screen = "over"; A.G.overAt = Date.now();
A.handleTap();
check("instant retry debounced", A.G.screen === "over");
A.G.overAt = Date.now() - 5000;
A.handleTap();
check("retry after delay -> playing", A.G.screen === "playing");

A.startGame();
A.G.score = 150;
A.G.threats = [{ dir: Math.PI, t: 1, arc: 0.2, maxT: 1,
  resolved: false, type: "NORMAL" }];
A.G.gf = 0; A.G.tf = 0; A.G.guardW = 0.0001; A.G.shield = 0;
A.update();
check("best saved to localStorage", store["parry_best"] === "150");

console.log(failures === 0 ? "\nALL CHECKS PASSED"
  : "\n" + failures + " CHECK(S) FAILED");
process.exit(failures === 0 ? 0 : 1);
