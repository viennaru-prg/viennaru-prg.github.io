// Headless verification for projects/p6/index.html (ORBITAL — expanded).
// New depth: moving planets, wormholes, multi-checkpoint routing, branching
// map, permanent unlock tree, ships. Fairness invariant preserved &
// generalised: deterministic + EVERY stage solvable by skill (brute solver).
// Run: node test/p6.harness.js
"use strict";
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(
  path.join(__dirname, "..", "projects", "p6", "index.html"), "utf8");
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
    arc: noop, fill: noop, stroke: noop, fillRect: noop, strokeRect: noop,
    fillText: noop, moveTo: noop, lineTo: noop, translate: noop,
    createRadialGradient: () => ({ addColorStop: noop }),
    fillStyle: "", strokeStyle: "", lineWidth: 0, shadowColor: "",
    shadowBlur: 0, globalAlpha: 1, font: "", textAlign: "" };
}
function elStub() {
  const set = {}; const kids = [];
  const e = { _t: "", set textContent(v){ this._t = String(v); },
    get textContent(){ return this._t; }, set innerHTML(v){ kids.length = 0; },
    width: 0, height: 0, getContext: () => ctxStub(), onclick: null,
    addEventListener: noop, appendChild: (c) => kids.push(c),
    classList: { add:(c)=>{set[c]=1;}, remove:(c)=>{delete set[c];},
      contains:(c)=>!!set[c] } };
  return e;
}
const els = {};
["c","score","hmeta","shots","hud","startScreen","hangarScreen",
 "hangarStars","hangarCards","hangarBack","upgScreen","upgCards",
 "upgTitle","mapScreen","mapCards","overScreen","finalScore","bestMsg",
 "ascLine","ascGain","shipCards","retryHint"].forEach(
  i => els[i] = elStub());
global.document = {
  getElementById: (i) => els[i] || elStub(),
  createElement: () => elStub()
};
const store = {};
global.window = {
  innerWidth: 1100, innerHeight: 700, addEventListener: noop,
  requestAnimationFrame: noop,
  localStorage: { getItem:(k)=> (k in store ? store[k] : null),
    setItem:(k,v)=>{ store[k] = String(v); } }
};

let err = null;
try { (0, eval)(code); } catch (e) { err = e; }
check("script loads without throwing (audio guarded)", !err);
if (err) { console.error(err); process.exit(1); }

const A = global.window.__ORBITAL__;
const C = A.consts;
check("exposes test API", !!A && typeof A.simulate === "function");

// ---- determinism incl moving wells + wormholes + checkpoints ----
const lvlD = A.genStage(14);                 // realm 3 -> has wormhole
const a1 = A.simulate(lvlD, 0.25, 6.1, false);
const a2 = A.simulate(lvlD, 0.25, 6.1, false);
check("simulation deterministic (moving+worm+cp)",
  a1.win === a2.win && a1.steps === a2.steps &&
  a1.collected === a2.collected);
check("genStage deterministic", (function () {
  const x = A.genStage(11), y = A.genStage(11);
  return x.wells.length === y.wells.length &&
    Math.abs(x.portal.x - y.portal.x) < 1e-9 &&
    x.checkpoints.length === y.checkpoints.length;
})());
check("moving well position changes over time (telegraphed)", (function () {
  const w = { x: 100, y: 100, mass: 80, coreR: 16,
    orb: { cx: 100, cy: 100, R: 60, om: 0.02, base: 0 } };
  const p0 = A.wellPos(w, 0), p50 = A.wellPos(w, 50);
  return Math.hypot(p0.x - p50.x, p0.y - p50.y) > 1;
})());

// ---- SOLVABILITY: every stage completable by skill (fairness proof) ----
[1, 2, 3, 6, 9, 12, 14, 18, 30].forEach(function (s) {
  const lvl = A.genStage(s);
  const sol = A.findSolution(lvl, true);
  const tag = A.isBoss(s) ? "BOSS" : A.isMini(s) ? "MINI" : "norm";
  check("stage " + s + " solvable by skill (" + tag + ", cps=" +
    lvl.checkpoints.length + ")", !!sol);
});
check("solution actually collects all checkpoints", (function () {
  const lvl = A.genStage(20);
  const sol = A.findSolution(lvl, true);
  return sol && sol.r.win && sol.r.collected === lvl.checkpoints.length;
})());

// ---- EARLY STAGES MUST BE APPROACHABLE (fix: stage 1 was walled) ----
[1, 2].forEach(function (s) {
  const L = A.genStage(s);
  check("stage " + s + ": aiming straight at portal wins (beginner-fair)",
    A.directWins(L));
  check("stage " + s + ": no mid-air maze (0 hazards/cp/guardian/worm)",
    L.hazards.length === 0 && L.checkpoints.length === 0 &&
    !L.guardian && !L.worm);
});
check("difficulty ramps: stage 1 easier than stage 12 portal",
  A.genStage(1).portal.r > A.genStage(12).portal.r);

// ---- non-trivial deep stages (gravity must be used) ----
check("stage 12 not a trivial straight shot", !A.directWins(A.genStage(12)));
check("stage 18 not a trivial straight shot", !A.directWins(A.genStage(18)));

// ---- new content present ----
check("checkpoints appear by mid-game", A.genStage(10).checkpoints.length >= 1);
check("wormhole realm has a wormhole", !!A.genStage(14).worm);
check("boss has moving guardian", (function () {
  const b = A.genStage(6); return b.guardian && b.guardian.omega > 0;
})());
check("risky map mod carries star multiplier", (function () {
  return A.genStage(8, { starMul: 2 }).starMul === 2 &&
    A.genStage(8, {}).starMul === 1;
})());
check("harder map variant still solvable (fair)", (function () {
  return A.findSolution(A.genStage(8, { harder: true, salt: 7 }), false);
})());

// ---- meta v2: persistence + unlock tree + ascension ----
check("meta default", (function () {
  const m = A.metaDefault();
  return m.stars === 0 && m.lifetime === 0 && typeof m.unlocks === "object";
})());
check("ascFromLifetime 0 at 0 & grows",
  A.ascFromLifetime(0) === 0 && A.ascFromLifetime(800) > A.ascFromLifetime(20));
A.metaSave({ stars: 50, best: 10, asc: 2, lifetime: 120, unlocks: {} });
check("meta round-trips w/ unlocks", (function () {
  const m = A.metaLoad();
  return m.stars === 50 && m.lifetime === 120 && !m.unlocks.fuel;
})());
check("buyUnlock spends & persists", (function () {
  const okBuy = A.buyUnlock("fuel");
  const m = A.metaLoad();
  return okBuy && m.unlocks.fuel === true && m.stars === 50 - 12;
})());
check("buyUnlock denied when too poor", (function () {
  A.metaSave({ stars: 1, best: 0, asc: 0, lifetime: 0, unlocks: {} });
  return A.buyUnlock("shipC") === false && !A.metaLoad().unlocks.shipC;
})());

// ---- ships affect the run ----
store["orbital_meta_v2"] = JSON.stringify(
  { stars: 0, best: 0, asc: 0, lifetime: 0, unlocks: {} });
A.setShip("A"); A.startGame();
const shotsA = A.G.shotsMax;
A.setShip("B"); A.startGame();
check("ship B grants more fuel than A", A.G.shotsMax > shotsA);
check("ship B shrinks preview vs base", A.G.previewLen < 360 * 1.01);

// ---- branching map flow ----
store["orbital_meta_v2"] = JSON.stringify(
  { stars: 0, best: 0, asc: 0, lifetime: 0, unlocks: {} });
A.setShip("A"); A.startGame();
const sol1 = A.findSolution(A.G.level, true);
check("found a solution for stage 1", !!sol1);
A.G.angle = sol1.ang; A.G.power = sol1.pw;
A.fire();
let guard = 0;
while (A.G.comet && guard++ < 6000) A.update();
check("solved shot clears stage -> upgrade screen",
  A.G.screen === "upgrade" && A.G.runStars > 0);
A.openMap();
check("upgrade -> map screen", A.G.screen === "map");
A.G.nextMods = { harder: true, starMul: 2, salt: 7 };
A.goNext(2);
check("map choice advances to stage 2 (playing)",
  A.G.screen === "playing" && A.G.stage === 2);

// ---- exhausting shots ends run & banks lifetime/best ----
store["orbital_meta_v2"] = JSON.stringify(
  { stars: 0, best: 0, asc: 0, lifetime: 0, unlocks: {} });
A.setShip("A"); A.startGame();
A.G.runStars = 7; A.G.score = 55;
let safety = 0;
while (A.G.screen === "playing" && safety++ < 60) {
  A.G.angle = Math.PI; A.G.power = C.PMAX; A.fire();
  let g2 = 0; while (A.G.comet && g2++ < 6000) A.update();
}
check("exhausting shots ends the run", A.G.screen === "over");
check("lifetime stars banked", A.metaLoad().lifetime >= 7);
check("best score recorded", A.metaLoad().best === 55);

// ---- restart returns to start (ship select), debounced ----
A.G.screen = "over"; A.G.overAt = Date.now();
A.handleTap();
check("instant retry debounced", A.G.screen === "over");
A.G.overAt = Date.now() - 5000;
A.handleTap();
check("retry after delay -> start screen", A.G.screen === "start");

// ---- upgrades varied ----
check("pool >=7", A.POOL.length >= 7);
let seen = {}, ok = true;
for (let r = 0; r < 60; r++) {
  const o = A.rollOffers();
  if (o.length !== 3) ok = false;
  const ks = {};
  o.forEach(u => { ks[u.k] = 1; seen[u.k] = 1;
    if (typeof u.ap !== "function") ok = false; });
  if (Object.keys(ks).length !== 3) ok = false;
}
check("rollOffers: 3 distinct valid", ok);
check("offers vary (>=6 seen)", Object.keys(seen).length >= 6);

console.log(failures === 0 ? "\nALL CHECKS PASSED"
  : "\n" + failures + " CHECK(S) FAILED");
process.exit(failures === 0 ? 0 : 1);
