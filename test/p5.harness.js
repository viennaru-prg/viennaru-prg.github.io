// Headless verification for projects/p5/index.html (AURORA).
// Bigger game (realms, named bosses, orbs, meta-progression, audio) but the
// cumulative-feedback invariant holds: SKILL ~95%, luck <=5%, no unfair
// death — proven by a perfect dodger surviving max difficulty incl bosses.
// Run: node test/p5.harness.js
"use strict";
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(
  path.join(__dirname, "..", "projects", "p5", "index.html"), "utf8");
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
    moveTo: noop, lineTo: noop, translate: noop,
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
["c","score","meta","combo","hud","startScreen","upgScreen","overScreen",
 "finalScore","bestMsg","ascLine","ascGain","retryHint","upgCards",
 "upgTitle"].forEach(i => els[i] = elStub());
global.document = {
  getElementById: (i) => els[i] || elStub(),
  createElement: () => elStub()
};
const store = {};
global.window = {
  innerWidth: 960, innerHeight: 660, addEventListener: noop,
  requestAnimationFrame: noop,
  localStorage: { getItem:(k)=> (k in store ? store[k] : null),
    setItem:(k,v)=>{ store[k] = String(v); } }
  // no AudioContext -> audio() must no-op without throwing
};

let err = null;
try { (0, eval)(code); } catch (e) { err = e; }
check("script loads without throwing (audio guarded)", !err);
if (err) { console.error(err); process.exit(1); }

const A = global.window.__AURORA__;
const C = A.consts;
check("exposes test API", !!A && !!A.G);

// ---- structure / content (volume) ----
check("stage 3 = MINI", A.stageType(3) === "MINI");
check("stage 6 = BOSS", A.stageType(6) === "BOSS");
check("multiple realms exist (>=4)", C.REALMS >= 4);
check("realm changes across stages",
  A.realmOf(1).n !== A.realmOf(5).n);
check("bosses are named", typeof A.bossName(6) === "string" &&
  A.bossName(6).length > 0 && A.bossName(6) !== A.bossName(36));

// ---- meta progression (persists across runs = replay value) ----
check("ascFromCareer is 0 at start", A.ascFromCareer(0) === 0);
check("ascFromCareer grows with career",
  A.ascFromCareer(10000) > A.ascFromCareer(100) &&
  A.ascFromCareer(100) >= 1);
check("meta default when empty", (function () {
  const m = A.metaLoad(); return m.career === 0 && m.best === 0 && m.asc === 0;
})());
A.metaSave({ career: 1234, best: 77, asc: 5 });
check("meta save/load round-trips", (function () {
  const m = A.metaLoad();
  return m.career === 1234 && m.best === 77 && m.asc === 5;
})());
A.startGame();
check("ascension boosts the new run (vmax up, starts with shield)",
  A.G.vmax > C.BASE_VMAX && A.G.shield >= 2);

// reset meta for the fairness run
store["aurora_meta_v1"] = JSON.stringify({ career: 0, best: 0, asc: 0 });

// ---- fairness math ----
const ar = A.arena();
const midR = ar.AR * 0.5;
check("gap rotation < player turn rate (deep BOSS 18)",
  A.gapRot(18, "BOSS") < C.BASE_VMAX / midR);
check("only one ring imminent (deep BOSS 18)",
  A.ringSpeed(18, "BOSS") * A.ringGap(18, "BOSS") > C.RING_TH + C.PR_BASE);

// ---- difficulty steep but bounded ----
check("ring speed rises steeply",
  A.ringSpeed(10, "NORMAL") - A.ringSpeed(1, "NORMAL") >= 0.8);
check("gap narrows steeply",
  A.gapW(1, "NORMAL") - A.gapW(10, "NORMAL") >= 0.4);
check("gap floored", A.gapW(99, "BOSS") >= 0.44);
check("ring speed capped", A.ringSpeed(99, "BOSS") <= 3.3);

// ---- allowed luck ~5% + varied upgrades ----
check("LUCK_RATE within ~5%", C.LUCK_RATE > 0 && C.LUCK_RATE <= 0.05);
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

// ---- THE proof: perfect dodger survives realms + bosses, no luck ----
A.startGame();
function dodge() {
  const G = A.G, a = A.arena();
  const pr = A.dist(G.px, G.py, a.CX, a.CY);
  let t = null;
  for (let i = 0; i < G.rings.length; i++) {
    const R = G.rings[i];
    if (R.hitChecked) continue;
    if (R.r < pr - (C.RING_TH + G.pr)) continue;
    if (!t || R.r < t.r) t = R;
  }
  const ang = t ? t.gapA : Math.atan2(G.py - a.CY, G.px - a.CX);
  G.tx = a.CX + (a.AR * 0.5) * Math.cos(ang);
  G.ty = a.CY + (a.AR * 0.5) * Math.sin(ang);
}
let died = false, maxStage = 1, realms = {}, sawMini = false,
    sawBoss = false, upg = 0;
for (let f = 0; f < 26000; f++) {
  if (A.G.screen === "upgrade") { upg++; A.resumeUpgrade(); }
  dodge();
  A.update();
  if (A.G.screen === "over") { died = true; break; }
  if (A.G.realm) realms[A.G.realm.n] = 1;
  if (A.G.stageType === "MINI") sawMini = true;
  if (A.G.stageType === "BOSS") sawBoss = true;
  if (A.G.stage > maxStage) maxStage = A.G.stage;
}
check("perfect dodger NEVER dies (skill, not luck)", !died);
check("ran deep (stage >= 9)", maxStage >= 9);
check("traversed multiple realms (>=2)", Object.keys(realms).length >= 2);
check("encountered MINI-BOSS", sawMini);
check("encountered named BOSS", sawBoss);
check("cleared upgrade screens", upg >= 1);
check("collected score while surviving", A.G.score > 25);

// ---- orbs are pure bonus (never lethal) ----
A.startGame();
const s0 = A.G.shards;
A.G.orbs = [{ x: A.G.px, y: A.G.py, vx: 0, vy: 0, life: 100, r: 9 }];
A.update();
check("touching an orb grants shards (non-lethal)",
  A.G.shards > s0 && A.G.screen === "playing");

// ---- wrong position kills; shield absorbs ----
A.startGame();
A.G.px = ar.CX - 60; A.G.py = ar.CY; A.G.tx = A.G.px; A.G.ty = A.G.py;
A.G.shield = 0;
let prW = A.dist(A.G.px, A.G.py, ar.CX, ar.CY);
A.G.rings = [{ r: prW + 1, v: 2, gapA: 0, gapW: 0.3, rot: 0,
  grazed: false, hitChecked: false, type: "NORMAL" }];
A.update();
check("outside the gap kills (collision real)", A.G.screen === "over");

A.startGame();
A.G.px = ar.CX - 60; A.G.py = ar.CY; A.G.tx = A.G.px; A.G.ty = A.G.py;
A.G.shield = 1;
prW = A.dist(A.G.px, A.G.py, ar.CX, ar.CY);
A.G.rings = [{ r: prW + 1, v: 2, gapA: 0, gapW: 0.3, rot: 0,
  grazed: false, hitChecked: false, type: "NORMAL" }];
A.update();
check("shield absorbs the hit", A.G.screen === "playing" && A.G.shield === 0);

// ---- named boss HP + clear bonus ----
A.startGame();
A.enterStage(6);
check("BOSS stage activates named boss",
  A.G.boss.active && A.G.boss.hp === C.BOSS_HP && A.G.boss.name.length > 0);
let bonus = false;
for (let p = 0; p < C.BOSS_HP; p++) {
  const a = A.arena();
  const pr = A.dist(A.G.px, A.G.py, a.CX, a.CY);
  A.G.rings = [{ r: pr, v: 1, gapA: A.angNorm(Math.atan2(
    A.G.py - a.CY, A.G.px - a.CX)), gapW: 1.1, rot: 0,
    grazed: false, hitChecked: false, type: "BOSS" }];
  const before = A.G.score;
  A.update();
  if (A.G.screen === "upgrade") A.resumeUpgrade();
  if (A.G.score - before >= 21) bonus = true;
}
check("boss defeated after BOSS_HP passes", !A.G.boss.active);
check("boss clear grants big bonus", bonus);

// ---- run shards roll into persistent meta on game over ----
store["aurora_meta_v1"] = JSON.stringify({ career: 0, best: 0, asc: 0 });
A.startGame();
A.G.runShards = 200; A.G.score = 99;
A.G.px = ar.CX - 70; A.G.py = ar.CY; A.G.tx = A.G.px; A.G.ty = A.G.py;
A.G.shield = 0;
const prM = A.dist(A.G.px, A.G.py, ar.CX, ar.CY);
A.G.rings = [{ r: prM + 1, v: 2, gapA: 0, gapW: 0.2, rot: 0,
  grazed: false, hitChecked: false, type: "NORMAL" }];
A.update();
check("game over banks run shards to career",
  A.metaLoad().career >= 200);
check("game over records best score", A.metaLoad().best === 99);

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
