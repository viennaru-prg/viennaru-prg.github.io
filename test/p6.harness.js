// Headless verification for projects/p6/index.html (ORBITAL).
// Core mechanic is NEW vs prior projects: deterministic gravity-aim, not
// real-time dodging. Fairness invariant becomes: every generated stage is
// SOLVABLE by skill (a winning aim exists) and physics is DETERMINISTIC
// (same input -> same result => no luck). Run: node test/p6.harness.js
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
  const set = {};
  return { _t: "", set textContent(v){ this._t = String(v); },
    get textContent(){ return this._t; }, set innerHTML(v){}, width: 0,
    height: 0, getContext: () => ctxStub(), onclick: null, appendChild: noop,
    classList: { add:(c)=>{set[c]=1;}, remove:(c)=>{delete set[c];},
      contains:(c)=>!!set[c] } };
}
const els = {};
["c","score","meta","shots","hud","startScreen","upgScreen","overScreen",
 "finalScore","bestMsg","ascLine","ascGain","retryHint","upgCards",
 "upgTitle"].forEach(i => els[i] = elStub());
global.document = {
  getElementById: (i) => els[i] || elStub(),
  createElement: () => elStub()
};
const store = {};
global.window = {
  innerWidth: 1024, innerHeight: 680, addEventListener: noop,
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

// ---- NEW core mechanic sanity ----
check("structure: stage 6 is boss", A.isBoss(6) && !A.isBoss(5));
check("structure: stage 3 is mini", A.isMini(3) && !A.isMini(6));
check("realms change across stages", A.realmOf(1).n !== A.realmOf(5).n);
check("bosses are named & vary",
  A.bossName(6).length > 0 && A.bossName(6) !== A.bossName(36));

// ---- DETERMINISM: same input -> same result (=> no luck) ----
const lvlD = A.genStage(7);
const r1 = A.simulate(lvlD, 0.3, 6.2, false);
const r2 = A.simulate(lvlD, 0.3, 6.2, false);
check("simulation is deterministic",
  r1.win === r2.win && r1.steps === r2.steps && r1.crashed === r2.crashed);
const g1 = A.genStage(9), g2 = A.genStage(9);
check("genStage is deterministic",
  g1.wells.length === g2.wells.length &&
  Math.abs(g1.portal.x - g2.portal.x) < 1e-9 &&
  Math.abs(g1.portal.y - g2.portal.y) < 1e-9);

// ---- SOLVABILITY: every stage completable by skill (fairness proof) ----
function solve(level) {
  for (let ang = -1.45; ang <= 1.45; ang += 0.015) {
    for (let pw = C.PMIN; pw <= C.PMAX; pw += 0.1) {
      const r = A.simulate(level, ang, pw, false);
      if (r.win) return { ang: ang, pw: pw };
    }
  }
  return null;
}
[1, 2, 3, 6, 12, 18, 30].forEach(function (s) {
  const lvl = A.genStage(s);
  const sol = solve(lvl);
  check("stage " + s + " is solvable by skill (" +
    (A.isBoss(s) ? "BOSS" : A.isMini(s) ? "MINI" : "norm") + ")", !!sol);
});

// ---- difficulty scales (but stays solvable, shown above) ----
const e = A.genStage(2), late = A.genStage(20);
check("more wells later",
  late.wells.length >= e.wells.length);
check("portal shrinks later", late.portalR < e.portalR);
check("par tightens later", A.genStage(24).par <= A.genStage(1).par);
check("portal radius floored", A.genStage(99).portalR >= 14);

// ---- meta progression (the system the user liked) ----
check("ascFromStars 0 at 0", A.ascFromStars(0) === 0);
check("ascFromStars grows", A.ascFromStars(500) > A.ascFromStars(20) &&
  A.ascFromStars(20) >= 1);
check("meta default empty", (function () {
  const m = A.metaLoad(); return m.stars === 0 && m.best === 0 && m.asc === 0;
})());
A.metaSave({ stars: 321, best: 88, asc: 4 });
check("meta round-trips", (function () {
  const m = A.metaLoad();
  return m.stars === 321 && m.best === 88 && m.asc === 4;
})());
A.startGame();
check("ascension grants extra fuel + longer preview",
  A.G.extraShots >= 4 && A.G.previewLen > 60);

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

// ---- real game loop: a solved aim actually clears the stage ----
store["orbital_meta_v1"] = JSON.stringify({ stars: 0, best: 0, asc: 0 });
A.startGame();
const sol1 = solve(A.G.level);
check("found a solution for stage 1", !!sol1);
A.G.angle = sol1.ang; A.G.power = sol1.pw;
A.fire();
let guard = 0;
while (A.G.comet && guard++ < 5000) A.update();
A.update();   // let pendingUpg open the upgrade screen
check("solved shot clears stage -> upgrade screen",
  A.G.screen === "upgrade" && A.G.runStars > 0);
A.resumeUpgrade();
check("resume advances to stage 2", A.G.stage === 2);

// ---- a bad aim costs a shot; exhausting shots -> game over (banks meta) ----
store["orbital_meta_v1"] = JSON.stringify({ stars: 0, best: 0, asc: 0 });
A.startGame();
A.G.runStars = 5; A.G.score = 42;
let safety = 0;
while (A.G.screen === "playing" && safety++ < 50) {
  A.G.angle = Math.PI;            // fire backwards -> out of bounds, fails
  A.G.power = C.PMAX;
  A.fire();
  let g2 = 0;
  while (A.G.comet && g2++ < 5000) A.update();
}
check("exhausting shots ends the run", A.G.screen === "over");
check("run stars banked into persistent meta",
  A.metaLoad().stars >= 5);
check("best score recorded", A.metaLoad().best === 42);

// ---- restart debounce ----
A.G.screen = "over"; A.G.overAt = Date.now();
A.handleTap();
check("instant retry debounced", A.G.screen === "over");
A.G.overAt = Date.now() - 5000;
A.handleTap();
check("retry after delay -> playing", A.G.screen === "playing");

console.log(failures === 0 ? "\nALL CHECKS PASSED"
  : "\n" + failures + " CHECK(S) FAILED");
process.exit(failures === 0 ? 0 : 1);
