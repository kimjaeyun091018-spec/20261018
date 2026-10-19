// ============================================================
//  원소 아레나 — 게임 규칙과 시뮬레이션 (방장이 계산, 화면·네트워크 코드 없음)
//  · 대난투식: 영웅은 체력 대신 %가 쌓이고, 공허(맵 밖·구덩이)에 떨어지면 목숨 -1
//  · 시간이 지나면 땅 모양이 바뀜: 무너지고 · 솟아오르고 · 가로↔세로로 뒤틀림
//  · 스토리: 정해진 스테이지를 깨면 증강 3택1 (보스는 전설), 클리어 후 가운데에 솟은 문으로 다음 스테이지
// ============================================================
import {
  TILE, COLS, ROWS, KNOCK, FEEL, DASH, STATUS, REACTIONS, CLASH, CHARS, ENEMIES, BOSSES,
  CHAPTERS, STAGES_PER_CHAPTER, STORY, TREE, COLOSSEUM, TEAM_COLORS, MAX_PLAYERS,
  COLLAPSE, LEVEL, ITEMS, CHEST_LOOT, COLO_LOOT, AUGMENTS, AUG_STAGES, ALLY, ICE, HERO_GROW, heroStats,
} from './data.js';
import { COLOSSEUM_ARENAS } from './maps.js';
import { genStoryMap, fpOf, planShift, shiftTiles, inFp, CORE } from './mapgen.js';

const R_HERO = 12;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const len = (x, y) => Math.hypot(x, y) || 1;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const rnd = (a, b) => a + Math.random() * (b - a);
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return Math.abs(d); };
const pickWeighted = (list) => { const tot = list.reduce((a, [, w]) => a + w, 0); let r = Math.random() * tot; for (const [k, w] of list) { r -= w; if (r <= 0) return k; } return list[0][0]; };
const VIEW_CENTER = { x: COLS * TILE / 2, y: ROWS * TILE / 2 };

// ============================================================
//  지도: 가장 바깥 줄은 공허, 무너진 줄도 공허 ('o')
// ============================================================
export const ringOf = (tx, ty) => Math.min(tx, ty, COLS - 1 - tx, ROWS - 1 - ty);
// 지도 글자 → 실제 타일 (level 미만의 바깥 줄은 공허)
export function applyCollapse(rows, level = 1) {
  return rows.map((r, ty) => r.split('').map((c, tx) => (ringOf(tx, ty) < level ? 'o' : c)).join(''));
}
function parseMap(rows) {
  const tiles = applyCollapse(rows, 1).map((r) => r.split(''));
  const spawns = [];
  tiles.forEach((row, ty) => row.forEach((c, tx) => { if (c === 'P') spawns.push({ x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE }); }));
  return { rows, tiles, spawns, ver: 1 };
}
export const tileAt = (map, x, y) => {
  const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return 'o';
  return map.tiles[ty][tx];
};
function circleInWall(map, x, y, r) {
  for (let ty = Math.floor((y - r) / TILE); ty <= Math.floor((y + r) / TILE); ty++) {
    for (let tx = Math.floor((x - r) / TILE); tx <= Math.floor((x + r) / TILE); tx++) {
      if (tileAt(map, (tx + 0.5) * TILE, (ty + 0.5) * TILE) !== '#') continue;
      const cx = clamp(x, tx * TILE, (tx + 1) * TILE), cy = clamp(y, ty * TILE, (ty + 1) * TILE);
      if ((x - cx) ** 2 + (y - cy) ** 2 < r * r) return true;
    }
  }
  return false;
}
// 원 전체가 바닥 위에 있는지 (공허·가시·벽 아님)
function safeFloor(map, x, y, r) {
  if (circleInWall(map, x, y, r)) return false;
  for (const [ox, oy] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]]) { const c = tileAt(map, x + ox, y + oy); if (c === 'o' || c === '^') return false; }
  return true;
}
function randomFloor(s, r = 14, avoid = null, minD = 0, nearCenter = false) {
  for (let i = 0; i < 300; i++) {
    const spread = nearCenter ? 0.25 + i / 600 : 1;
    const x = VIEW_CENTER.x + rnd(-1, 1) * (COLS / 2 - 1) * TILE * spread, y = VIEW_CENTER.y + rnd(-1, 1) * (ROWS / 2 - 1) * TILE * spread;
    if (!safeFloor(s.map, x, y, r + 4)) continue;
    if (avoid && avoid.some((a) => Math.hypot(a.x - x, a.y - y) < minD)) continue;
    return { x, y };
  }
  return { x: VIEW_CENTER.x, y: VIEW_CENTER.y };
}

// ============================================================
//  상태
// ============================================================
export function createState(mode, hostId, opt = {}) {
  const s = {
    mode, hostId, time: 0, nextId: 1, runId: Math.floor(Math.random() * 1e9),
    heroes: {}, enemies: [], shots: [], zones: [], hazards: [], pending: [], fx: [], items: [],
    msg: '', msgT: 0, gold: 0, map: null, fp: null, shift: null, warns: [], holes: [], stageN: 0, ice: new Map(), allies: [],
    xp: 0, level: 1, kills: 0,
    story: null, colo: null, opt,
  };
  if (mode === 'story') startStage(s, opt.ch || 0, opt.st || 0);
  else startColosseum(s, opt.arena || 0);
  return s;
}
// fx는 새로 생긴 것만 보냄 (화면 쪽이 수명 동안 그림)
const fxPush = (s, fx) => { fx.id = s.nextId++; fx.t ??= 0.5; fx.life ??= fx.t; fx.born = s.time; s.fx.push(fx); return fx; };
function say(s, text, t = 2.2) { s.msg = text; s.msgT = t; }
const heroList = (s) => Object.values(s.heroes);

// ============================================================
//  영웅
// ============================================================
const BASE_B = { atk: 0, hp: 0, cd: 0, dash: 0, crit: 0.05, critDmg: 0.5, react: 0, reactR: 0, leech: 0, armor: 0, gold: 0, combo: 0, dashCharge: 0, kb: 0,
  spd: 0, endure: 0, weight: 0, multishot: 0, pierce: 0, orbs: 0, orbDmg: 0, thorns: 0, chainEvery: 0, ignite: 0, chill: 0, xp: 0, magnet: 0, size: 0,
  rageDmg: 0, meteor: 0, dashBoom: 0, rebirth: 0 };
export function treeBonus(ids) {
  const b = { ...BASE_B };
  for (const id of ids) { const n = TREE.find((t) => t.id === id); if (n) for (const [k, v] of Object.entries(n.bonus)) b[k] += v; }
  return b;
}
// 스킬 트리 + 증강 → 실제 능력치
function recompute(s, h) {
  const b = treeBonus(s.mode === 'story' ? h.tree : []);
  for (const id of h.augs) {
    const A = AUGMENTS.find((a) => a.id === id);
    if (!A) continue;
    for (const [k, v] of Object.entries(A.b)) {
      if (k === 'chainEvery') b.chainEvery = b.chainEvery ? Math.min(b.chainEvery, v) : v;
      else b[k] += v;
    }
  }
  // 영웅 고유 치명타 + 레벨 성장 (레벨은 스토리에서만)
  const story = s.mode === 'story';
  const lv = story ? h.lv || 1 : 1, k = lv - 1, st = heroStats(h.char, lv);
  b.crit += st.crit / 100 - 0.05; b.critDmg += st.critDmg / 100 - 0.5;
  if (story) { b.hp += HERO_GROW.hp * k; b.atk += HERO_GROW.atk * k; b.spd += HERO_GROW.spd * k; }
  h.shieldMax = story ? st.shield : 0;
  h.b = b;
  const C = CHARS[h.char];
  h.weight = C.weight * (1 + b.weight);
  h.r = R_HERO * (1 + b.size);
  h.dashMax = 1 + b.dashCharge;
  h.dashCh = Math.min(h.dashCh ?? h.dashMax, h.dashMax);
}
export function addHero(s, id, name, char, opt = {}) {
  if (Object.keys(s.heroes).length >= MAX_PLAYERS) return null;
  const C = CHARS[char] ? char : 'knight';
  const slot = opt.slot ?? Object.keys(s.heroes).length;
  const h = {
    kind: 'hero', id, name: String(name || '플레이어').slice(0, 10), char: C, bot: !!opt.bot, slot,
    team: s.mode === 'colosseum' ? (opt.team ?? (slot % 2) + 1) : 1, color: TEAM_COLORS[slot % 4],
    x: 0, y: 0, r: R_HERO, kvx: 0, kvy: 0, pct: 0, weight: CHARS[C].weight, tree: opt.tree || [], augs: [], lv: Math.max(1, Math.min(10, opt.lv | 0 || 1)), shield: 0, ivx: 0, ivy: 0,
    aim: 0, aimD: 200, cds: [0, 0, 0, 0], chainI: -1, chainT: 0, dashCh: 1, dashCd: 0, roll: null,
    dash: null, chan: null, snipe: null, empower: 0, stun: 0, inv: 1, hs: 0, flash: 0, st: {}, slowT: 0,
    fall: 0, alive: true, out: false, respawn: 0, stocks: s.mode === 'story' ? STORY.lives : COLOSSEUM.stocks, moving: false,
    combo: { n: 0, t: 0 }, maxCombo: 0, kos: 0, lastBy: null, lastByT: 0, atkT: 0, buf: {}, hitN: 0, meteorT: 4, orbHit: new Map(),
    choice: null, choiceQ: [], hitPop: 0,
  };
  recompute(s, h);
  h.dashCh = h.dashMax;
  h.shield = h.shieldMax;
  placeHero(s, h);
  s.heroes[id] = h;
  if (s.mode === 'story' && CHAPTERS[s.story?.ch]?.ally) addAlly(s, h);
  return h;
}
export function removeHero(s, id) { delete s.heroes[id]; s.allies = s.allies.filter((a) => a.owner !== id); }
export function setHeroChar(s, id, char, tree, lv) {
  const h = s.heroes[id];
  if (!h || !CHARS[char]) return;
  h.char = char;
  if (tree) h.tree = tree;
  if (lv) h.lv = Math.max(1, Math.min(10, lv | 0));
  recompute(s, h);
}
function placeHero(s, h) {
  const sp = s.map.spawns[h.slot % s.map.spawns.length];
  let p = sp;
  if (!sp || !safeFloor(s.map, sp.x, sp.y, R_HERO)) p = randomFloor(s, R_HERO, heroList(s).filter((o) => o !== h), 40, true);
  h.x = p.x; h.y = p.y; h.kvx = h.kvy = 0;
}

// ---------- 대상 ----------
const isUnit = (u) => u && !u.dead && u.fall <= 0 && u.alive !== false;
const foesOf = (s, team) => {
  const out = [];
  for (const h of Object.values(s.heroes)) if (h.team !== team && isUnit(h)) out.push(h);
  for (const e of s.enemies) if (e.team !== team && isUnit(e) && !e.spawning) out.push(e);
  return out;
};
const alliesOf = (s, team) => heroList(s).filter((h) => h.team === team && isUnit(h));

// ============================================================
//  피격 (타격감의 중심)
//  opt: dmg, kb[base, growth], el, ux, uy, by, noReact, noStop, dot, basic, react, thorn
// ============================================================
function hit(s, t, opt) {
  if (!isUnit(t) || (t.inv > 0 && !opt.dot)) return false;
  const by = opt.by || null;
  const story = s.mode === 'story';
  let dmg = opt.dmg;
  let crit = false;
  if (by?.kind === 'hero' && !opt.dot) {
    if (story) {
      dmg *= 1 + by.b.atk + (by.b.combo ? Math.min(0.2, Math.floor(by.combo.n / 10) * 0.02) : 0);
      if (by.b.rageDmg) dmg *= 1 + by.b.rageDmg * Math.min(1, by.pct / 150);
      if (Math.random() < by.b.crit) { crit = true; dmg *= 1 + by.b.critDmg; }
      if (opt.react) dmg *= 1 + by.b.react;
    }
    if (by.buf.power > 0) dmg *= 1.35;
    if (by.empower > 0 && opt.basic) { dmg *= CHARS.sniper.skills[2].empower; by.empower = 0; }
  }
  if (t.kind === 'hero' && story) dmg *= 1 - t.b.armor;
  if (t.st.frozen > 0 && !opt.dot) dmg *= 1.15;
  const guarded = !opt.dot && t.ai === 'shield' && shieldFront(t, opt.ux, opt.uy);
  if (guarded) { dmg *= ENEMIES.shield.guard; fxPush(s, { k: 'block', x: t.x + Math.cos(t.face) * 16, y: t.y + Math.sin(t.face) * 16, t: 0.3 }); }
  dmg = Math.max(1, Math.round(dmg));
  // 피해 → %
  if (t.kind === 'hero') {
    let add = dmg * (story ? STORY.pctPerDmg / (1 + t.b.hp + t.b.endure) : KNOCK.colosseumPct);
    if (t.buf.aegis > 0) add *= 0.5;
    if (t.shield > 0 && !opt.dot) { // 방어막이 먼저 막아 줌
      const ab = Math.min(t.shield, add);
      t.shield -= ab; add -= ab;
      fxPush(s, { k: t.shield > 0 ? 'shieldhit' : 'shieldbreak', x: t.x, y: t.y, t: 0.4 });
    }
    t.pct = Math.min(999, Math.round((t.pct + add) * 10) / 10);
    t.hitPop = 1;
  } else {
    t.hp -= dmg;
    t.pct = clamp((1 - t.hp / t.maxHp) * 100, 0, 200);
  }
  // 넉백: (기본 + 성장 × %) / 무게
  const kb = opt.kb || [0, 0];
  let lethal = false;
  if (!opt.dot && (kb[0] || kb[1])) {
    let speed = (kb[0] + kb[1] * (t.pct / 100)) / t.weight;
    if (by?.kind === 'hero') {
      if (story) speed *= 1 + by.b.kb;
      speed *= 1 + Math.min(0.2, by.pct / 750); // 분노: 많이 맞은 쪽이 더 세게 침
    } else if (story && t.kind === 'hero') speed *= STORY.enemyKb;
    if (t.kind === 'hero' && story) speed *= 1 - t.b.armor;
    if (t.buf?.aegis > 0) speed *= 0.15;
    if (t.boss) speed *= 0.25;
    if (guarded) speed *= ENEMIES.shield.guard;
    const l = len(opt.ux, opt.uy);
    const ux = opt.ux / l, uy = opt.uy / l;
    t.kvx = ux * speed; t.kvy = uy * speed;
    t.stun = Math.max(t.stun, Math.min(KNOCK.stunMax, Math.abs(speed) * KNOCK.stunPer) * (t.boss ? 0.2 : 1));
    if (t.chan) t.chan = null;
    if (t.snipe) t.snipe = null;
    lethal = !t.boss && speed > 0 && willFall(s, t, ux, uy, speed);
  }
  // 타격감: 히트스톱 · 번쩍임 · 흔들림. "KO 확정" 타격은 길게 멈추고 크게 연출
  if (!opt.dot) {
    let stop = Math.min(FEEL.hitstopMax, FEEL.hitstopBase + dmg * FEEL.hitstopPerDmg);
    if (lethal && (t.kind === 'hero' || (s.lethalCd || 0) <= s.time)) {
      stop = t.kind === 'hero' ? 0.26 : 0.14;
      s.lethalCd = s.time + 0.5;
      fxPush(s, { k: 'lethal', x: t.x, y: t.y, hero: t.kind === 'hero', a: Math.atan2(t.kvy, t.kvx), color: t.color || '#ffffff', t: 0.6, shake: t.kind === 'hero' ? 16 : 8 });
    }
    t.hs = Math.max(t.hs, stop);
    if (by && !opt.noStop) by.hs = Math.max(by.hs || 0, stop * 0.8);
    t.flash = 0.12;
  }
  fxPush(s, { k: 'hit', x: t.x, y: t.y - 6, v: dmg, crit, el: opt.el || null, big: dmg >= 18 || crit, dot: !!opt.dot, react: opt.react || null, t: 0.75, onHero: t.kind === 'hero',
    shake: opt.dot ? 0 : Math.min(FEEL.shakeMax, dmg * FEEL.shakePerDmg * (opt.react ? 1.6 : 1)), ux: opt.ux || 0, uy: opt.uy || 0 });
  // 누가 마지막으로 때렸나 (링아웃 점수)
  if (by?.kind === 'hero') { t.lastBy = by.id; t.lastByT = s.time; }
  // 콤보 · 증강 효과
  if (by?.kind === 'hero' && !opt.dot) {
    by.combo.n = by.combo.t > 0 ? by.combo.n + 1 : 1;
    by.combo.t = 1.6 + (by.b.combo ? 0.6 : 0);
    by.maxCombo = Math.max(by.maxCombo, by.combo.n);
    if (story && !opt.proc) {
      by.hitN++;
      if (by.b.chainEvery && by.hitN % by.b.chainEvery === 0) chainBolt(s, by, t);
      if (by.b.ignite && Math.random() < by.b.ignite) applyElement(s, t, 'fire', by);
      if (by.b.chill && Math.random() < by.b.chill) applyElement(s, t, 'ice', by);
    }
  }
  // 가시 갑옷
  if (t.kind === 'hero' && story && t.b.thorns && !opt.thorn && !opt.dot && opt.src && opt.src.kind === 'enemy' && dist(opt.src, t) < 90) {
    hit(s, opt.src, { dmg: t.b.thorns, kb: [80, 60], ux: opt.src.x - t.x, uy: opt.src.y - t.y, by: t, thorn: true, proc: true, noStop: true });
  }
  if (opt.el && !opt.noReact) applyElement(s, t, opt.el, by);
  if (t.kind !== 'hero' && t.hp <= 0) killEnemy(s, t, by);
  return true;
}
// 이 속도로 날아가면 공허에 떨어지는지 (마찰로 줄어드는 속도를 따라가며 확인)
function willFall(s, t, ux, uy, speed) {
  const total = speed / KNOCK.friction;
  for (let d = 16; d < total; d += 16) {
    const x = t.x + ux * d, y = t.y + uy * d;
    if (circleInWall(s.map, x, y, t.r * 0.6)) return false;
    if (tileAt(s.map, x, y) === 'o') return speed - KNOCK.friction * d >= KNOCK.pitSpeed;
  }
  return false;
}
function chainBolt(s, by, from) {
  let cur = from; const done = new Set([from.id]);
  for (let i = 0; i < 3; i++) {
    const next = foesOf(s, by.team).filter((u) => !done.has(u.id) && dist(u, cur) < 200).sort((a, b) => dist(a, cur) - dist(b, cur))[0];
    if (!next) break;
    fxPush(s, { k: 'chain', x: cur.x, y: cur.y, x2: next.x, y2: next.y, t: 0.3 });
    hit(s, next, { dmg: 10, kb: [90, 120], el: 'lightning', ux: next.x - cur.x, uy: next.y - cur.y, by, proc: true, noStop: true, noReact: true });
    done.add(next.id); cur = next;
  }
}

// ============================================================
//  원소 · 반응
// ============================================================
const hasStatus = (t, k) => (k === 'frozen' ? t.st.frozen > 0 : t.st[k] && t.st[k].t > 0);
function applyElement(s, t, el, by) {
  if (!isUnit(t)) return;
  const R = REACTIONS.find((r) => r.el === el && hasStatus(t, r.has));
  if (R && !(t.reactCd > 0)) {
    t.reactCd = 0.35;
    if (R.has === 'frozen') t.st.frozen = 0; else delete t.st[R.has];
    triggerReaction(s, t, R, by);
    return;
  }
  const team = by?.team;
  switch (el) {
    case 'fire': t.st.burn = { t: STATUS.burn.time, tick: STATUS.burn.tick, by: by?.id, team }; break;
    case 'lightning': t.st.shock = { t: STATUS.shock.time }; break;
    case 'water': t.st.wet = { t: STATUS.wet.time }; break;
    case 'shadow': t.st.mark = { t: STATUS.mark.time, by: by?.id }; break;
    case 'ice': {
      const c = t.st.chill || { t: 0, n: 0 };
      c.t = STATUS.chill.time; c.n++;
      t.st.chill = c;
      if (c.n >= STATUS.chill.freezeAt && !t.boss) { delete t.st.chill; t.st.frozen = 1.2; fxPush(s, { k: 'react', x: t.x, y: t.y, name: '빙결', color: '#b3e5fc', r: 30, t: 0.9, rid: 'freeze' }); }
      break;
    }
    case 'poison': {
      const p = t.st.poison || { t: 0, n: 0, tick: STATUS.poison.tick, by: by?.id, team };
      p.t = STATUS.poison.time; p.n = Math.min(STATUS.poison.maxStack, p.n + 1); p.by = by?.id; p.team = team;
      t.st.poison = p;
      break;
    }
    default:
  }
}
function triggerReaction(s, t, R, by) {
  const team = by ? by.team : (t.team === 1 ? 2 : 1);
  const rMul = 1 + (by?.b?.reactR || 0) * (s.mode === 'story' ? 1 : 0);
  fxPush(s, { k: 'react', x: t.x, y: t.y, name: R.name, color: R.color, r: (R.r || 40) * rMul, rid: R.id, t: 1, shake: 9 });
  const hitOpt = (u, dmg, kb) => ({ dmg, kb: kb || R.kb || [0, 0], el: null, ux: u.x - t.x || rnd(-1, 1), uy: u.y - t.y || rnd(-1, 1), by, react: R.id, noReact: true, proc: true });
  if (R.chain) {
    let cur = t; const done = new Set([t.id]);
    hit(s, t, hitOpt(t, R.dmg));
    for (let i = 0; i < R.chain; i++) {
      const next = foesOf(s, team).filter((u) => !done.has(u.id) && dist(u, cur) < 170).sort((a, b) => dist(a, cur) - dist(b, cur))[0];
      if (!next) break;
      fxPush(s, { k: 'chain', x: cur.x, y: cur.y, x2: next.x, y2: next.y, t: 0.3 });
      hit(s, next, { ...hitOpt(next, R.dmg * 0.8), ux: next.x - cur.x, uy: next.y - cur.y });
      if (next.st) next.st.shock = { t: STATUS.shock.time };
      done.add(next.id); cur = next;
    }
  } else if (R.freeze) {
    t.st.frozen = R.freeze;
    hit(s, t, hitOpt(t, R.dmg, [0, 0]));
  } else if (R.r) {
    for (const u of foesOf(s, team)) {
      if (dist(u, t) > R.r * rMul + u.r) continue;
      hit(s, u, hitOpt(u, R.dmg));
      if (R.spread && u !== t) applyElement(s, u, STATUS[R.spread].from, by);
    }
  } else hit(s, t, hitOpt(t, R.dmg));
}

// ============================================================
//  이동 (걷기 + 넉백, 벽 튕김, 가시, 공허)
// ============================================================
function moveBody(s, u, wx, wy, dt) {
  const kSpeed = Math.hypot(u.kvx, u.kvy);
  const flying = kSpeed >= KNOCK.pitSpeed; // 대시로는 공허를 건너지 못함 (가장자리에서 멈춤)
  const vx = wx + u.kvx, vy = wy + u.kvy;
  for (const axis of [0, 1]) {
    const d = (axis ? vy : vx) * dt;
    if (!d) continue;
    const nx = axis ? u.x : u.x + d, ny = axis ? u.y + d : u.y;
    const wall = circleInWall(s.map, nx, ny, u.r);
    const intoPit = tileAt(s.map, nx, ny) === 'o' && tileAt(s.map, u.x, u.y) !== 'o';
    if (wall || (intoPit && (!flying || u.boss || u.ai === 'totem'))) {
      const kv = axis ? u.kvy : u.kvx;
      if (wall && Math.abs(kv) > 60) {
        if (Math.abs(kv) >= KNOCK.wallHitSpeed) {
          hit(s, u, { dmg: KNOCK.wallHitDmg, kb: [0, 0], ux: 0, uy: 0, noStop: true });
          fxPush(s, { k: 'wallhit', x: u.x + (axis ? 0 : Math.sign(kv) * u.r), y: u.y + (axis ? Math.sign(kv) * u.r : 0), t: 0.35, shake: 5 });
        }
        if (axis) u.kvy = -u.kvy * KNOCK.wallBounce; else u.kvx = -u.kvx * KNOCK.wallBounce;
      } else if (axis) u.kvy = 0; else u.kvx = 0;
      continue;
    }
    u.x = nx; u.y = ny;
  }
  const f = Math.exp(-KNOCK.friction * (u.kind === 'hero' && onIce(s, u) ? ICE.kbFriction : 1) * dt);
  u.kvx *= f; u.kvy *= f;
  if (Math.hypot(u.kvx, u.kvy) < 8) u.kvx = u.kvy = 0;
  u.spikeCd = Math.max(0, (u.spikeCd || 0) - dt);
  if (tileAt(s.map, u.x, u.y) === '^' && u.spikeCd <= 0 && !(u.inv > 0) && !u.roll && !u.boss) {
    u.spikeCd = 0.6;
    const a = Math.atan2(u.kvy || rnd(-1, 1), u.kvx || rnd(-1, 1)) + Math.PI + rnd(-0.5, 0.5);
    hit(s, u, { dmg: KNOCK.spikeDmg, kb: KNOCK.spikeKb, ux: Math.cos(a), uy: Math.sin(a), noStop: true });
    fxPush(s, { k: 'spikehit', x: u.x, y: u.y, t: 0.35 });
  }
  if (tileAt(s.map, u.x, u.y) === 'o' && !u.dash && !u.roll && u.fall <= 0 && !u.boss) {
    u.fall = 0.6;
    u.kvx *= 0.25; u.kvy *= 0.25;
    fxPush(s, { k: 'fall', x: u.x, y: u.y, t: 0.6 });
  }
  if (u.boss && tileAt(s.map, u.x, u.y) === 'o') { // 보스는 떨어지지 않고 안쪽으로 밀려남
    const dx = VIEW_CENTER.x - u.x, dy = VIEW_CENTER.y - u.y, l = len(dx, dy);
    u.x += (dx / l) * 120 * dt; u.y += (dy / l) * 120 * dt;
  }
}

// ---------- 상태 이상 ----------
function updateStatus(s, u, dt) {
  u.reactCd = Math.max(0, (u.reactCd || 0) - dt);
  for (const [k, v] of Object.entries(u.st)) {
    if (k === 'frozen') { u.st.frozen = Math.max(0, v - dt); continue; }
    v.t -= dt;
    if (k === 'burn' || k === 'poison') {
      v.tick -= dt;
      if (v.tick <= 0) {
        v.tick = STATUS[k].tick;
        const by = s.heroes[v.by] || null;
        const dmg = k === 'burn' ? STATUS.burn.dmg : STATUS.poison.dmgPerStack * v.n;
        hit(s, u, { dmg, kb: [0, 0], el: null, dot: true, by, noReact: true, ux: 0, uy: 0 });
      }
    }
    if (v.t <= 0) delete u.st[k];
  }
}
const frozenOrStunned = (u) => u.stun > 0 || u.st.frozen > 0;
// 방패병이 방패를 들고 있는가 (돌진 후 비틀거림·기절·빙결 중엔 내려감)
const shieldUp = (e) => e.ai === 'shield' && e.mode !== 3 && !frozenOrStunned(e) && !e.spawning && !e.fall;
const shieldFront = (e, ux, uy) => shieldUp(e) && (ux || uy) && angDiff(Math.atan2(-uy, -ux), e.face) < ENEMIES.shield.arc;
const speedMul = (u) => (u.st.chill ? 1 - STATUS.chill.slow : 1) * (u.slowT > 0 ? 0.6 : 1) * (u.st.frozen > 0 ? 0 : 1);

// ============================================================
//  스킬
// ============================================================
function cdOf(s, h, i) { return CHARS[h.char].skills[i].cd * (s.mode === 'story' ? Math.max(0.35, 1 - h.b.cd) : 1); }
function useSkill(s, h, i) {
  const C = CHARS[h.char];
  let S = C.skills[i];
  if (h.cds[i] > 0 || frozenOrStunned(h) || h.dash || h.chan || h.snipe || h.roll || h.fall > 0 || !h.alive) return;
  h.cds[i] = cdOf(s, h, i);
  h.atkT = 0.18;
  const ux = Math.cos(h.aim), uy = Math.sin(h.aim);
  const story = s.mode === 'story';
  fxPush(s, { k: 'cast', x: h.x, y: h.y, who: h.id, char: h.char, i, a: h.aim, el: S.el || (S.zone && S.zone.el) || null, type: S.type, t: 0.3 });
  switch (S.type) {
    case 'slash': {
      let big = S.big;
      if (S.chain) {
        h.chainI = h.chainT > 0 ? (h.chainI + 1) % S.chain.length : 0;
        h.chainT = 0.7;
        const st = S.chain[h.chainI];
        S = { ...S, dmg: st.dmg, kb: st.kb || S.kb, arc: S.arc * (st.arcMul || 1), range: S.range * (st.rangeMul || 1) };
        big = st.big;
        if (h.chainI === S.chain.length - 1) h.cds[i] = cdOf(s, h, i) * 1.8;
      }
      const range = S.range * (1 + h.b.size * 0.5);
      h.kvx += ux * (big ? 160 : 90); h.kvy += uy * (big ? 160 : 90);
      let any = false;
      for (const t of foesOf(s, h.team)) {
        const dx = t.x - h.x, dy = t.y - h.y;
        if (Math.hypot(dx, dy) > range + t.r || angDiff(Math.atan2(dy, dx), h.aim) > S.arc / 2 + 0.25) continue;
        any = hit(s, t, { dmg: S.dmg, kb: S.kb, el: S.el, ux: dx, uy: dy, by: h, basic: i === 0 }) || any;
      }
      fxPush(s, { k: 'slash', x: h.x, y: h.y, a: h.aim, r: range, arc: S.arc, el: S.el, char: h.char, big: !!big, flip: h.chainI % 2, t: big ? 0.36 : 0.28, hitAny: any });
      break;
    }
    case 'strikes': {
      const ax = h.x + ux * Math.min(h.aimD, S.range * 0.6), ay = h.y + uy * Math.min(h.aimD, S.range * 0.6);
      const foes = foesOf(s, h.team).filter((t) => dist(t, h) < S.range).sort((a, b) => dist(a, { x: ax, y: ay }) - dist(b, { x: ax, y: ay }));
      for (let k = 0; k < S.count; k++) {
        const t = foes[k % Math.max(1, foes.length)];
        const x = t ? t.x + rnd(-14, 14) : ax + rnd(-90, 90), y = t ? t.y + rnd(-14, 14) : ay + rnd(-90, 90);
        s.pending.push({ t: 0.35 + k * S.every, do: 'bolt', x, y, S, team: h.team, owner: h.id });
        fxPush(s, { k: 'warn', x, y, r: S.r, t: 0.35 + k * S.every, el: 'lightning' });
      }
      break;
    }
    case 'shot': {
      const n = (S.count || 1) + (story ? h.b.multishot : 0);
      const spread = S.spread || 0.18 * (n - 1);
      if (S.recoil) { h.kvx -= ux * S.recoil; h.kvy -= uy * S.recoil; }
      for (let k = 0; k < n; k++) {
        const a = h.aim + (n > 1 ? (k / (n - 1) - 0.5) * spread : 0);
        const p = spawnShot(s, h, S, a, i === 0);
        if (story) p.pierce += h.b.pierce;
      }
      break;
    }
    case 'dashstrike':
      h.dash = { vx: ux * (S.dist / S.time), vy: uy * (S.dist / S.time), t: S.time, hit: new Set(), S, i };
      h.inv = Math.max(h.inv, S.time + 0.08);
      fxPush(s, { k: 'dashstart', x: h.x, y: h.y, a: h.aim, el: S.el, look: S.look, len: S.dist, dur: S.time, t: 0.45 });
      break;
    case 'stream':
      h.chan = { S, t: S.time, acc: 0 };
      break;
    case 'blink': {
      const ox = h.x, oy = h.y;
      for (let d = S.dist; d > 20; d -= 10) {
        const sg = S.fwd ? 1 : -1, nx = h.x + ux * d * sg, ny = h.y + uy * d * sg;
        if (safeFloor(s.map, nx, ny, R_HERO)) { h.x = nx; h.y = ny; break; }
      }
      fxPush(s, { k: 'blink', x: ox, y: oy, x2: h.x, y2: h.y, char: h.char, smoke: !!S.smoke, t: S.smoke ? 1.2 : 0.35 });
      if (S.zone) s.zones.push({ id: s.nextId++, x: ox, y: oy, r: S.zone.r, t: S.zone.delay, delayed: S.zone, team: h.team, owner: h.id, look: 'shockzone', life: S.zone.delay });
      if (S.empower) { h.empower = 3; for (const t of foesOf(s, h.team)) if (dist(t, { x: ox, y: oy }) < 80) t.slowT = 1.5; }
      h.inv = Math.max(h.inv, 0.2);
      break;
    }
    case 'nova':
      for (const t of foesOf(s, h.team)) {
        if (dist(t, h) > S.r + t.r) continue;
        const ok = hit(s, t, { dmg: S.dmg, kb: S.kb, el: S.el, ux: t.x - h.x, uy: t.y - h.y, by: h });
        if (S.stun) t.stun = Math.max(t.stun, S.stun);
        if (ok && S.leech) { h.pct = Math.max(0, h.pct - S.leech * (story ? 1 : 0.5)); fxPush(s, { k: 'soul', x: t.x, y: t.y, x2: h.x, y2: h.y, t: 0.5 }); }
      }
      fxPush(s, { k: 'nova', x: h.x, y: h.y, r: S.r, look: S.look, el: S.el, t: 0.6, shake: 8 });
      break;
    case 'zone': {
      let x = h.x, y = h.y;
      if (S.at === 'aim') { const d = Math.min(S.range, h.aimD); x = h.x + ux * d; y = h.y + uy * d; }
      s.zones.push({ id: s.nextId++, x, y, r: S.r, t: S.time, life: S.time, tick: 0, S, team: h.team, owner: h.id, look: S.look, follow: S.follow });
      break;
    }
    case 'line':
      for (let k = 0; k < S.count; k++) {
        s.pending.push({ t: k * S.delay, do: 'spike', x: h.x + ux * (40 + k * S.gap), y: h.y + uy * (40 + k * S.gap), S, team: h.team, owner: h.id, a: h.aim });
      }
      break;
    case 'snipe':
      h.snipe = { t: S.windup, a: h.aim, S };
      fxPush(s, { k: 'aimline', x: h.x, y: h.y, a: h.aim, len: S.len, who: h.id, t: S.windup });
      break;
    case 'markall': {
      const marked = foesOf(s, h.team).filter((t) => dist(t, h) < S.range && angDiff(Math.atan2(t.y - h.y, t.x - h.x), h.aim) < S.arc / 2);
      for (const t of marked) { t.st.mark = { t: S.delay + 1, by: h.id }; fxPush(s, { k: 'markon', x: t.x, y: t.y, target: t.id, t: S.delay }); }
      fxPush(s, { k: 'markcone', x: h.x, y: h.y, a: h.aim, r: S.range, arc: S.arc, t: 0.5 });
      s.pending.push({ t: S.delay, do: 'execute', ids: marked.map((t) => t.id), S, owner: h.id, team: h.team });
      break;
    }
    case 'detonate': {
      let n = 0;
      for (const t of foesOf(s, h.team)) {
        const p = t.st.poison;
        if (!p || dist(t, h) > S.range) continue;
        const stacks = p.n; delete t.st.poison;
        hit(s, t, { dmg: S.perStack * stacks, kb: S.kb, el: null, ux: t.x - h.x, uy: t.y - h.y, by: h, react: 'acid' });
        fxPush(s, { k: 'acid', x: t.x, y: t.y, n: stacks, t: 0.7, shake: 4 });
        n++;
      }
      fxPush(s, { k: 'detocast', x: h.x, y: h.y, r: S.range, n, t: 0.5 });
      break;
    }
    default:
  }
}
function spawnShot(s, src, S, a, basic = false) {
  const sx = src.x + Math.cos(a) * 14, sy = src.y + Math.sin(a) * 14;
  const p = {
    id: s.nextId++, owner: src.id, team: src.team, el: S.el || null, look: S.look, basic, src,
    x: sx, y: sy, vx: Math.cos(a) * S.speed, vy: Math.sin(a) * S.speed, r: S.r, power: S.power || 1, dmg: S.dmg, kb: S.kb,
    life: S.life, pierce: S.pierce || 0, hits: new Map(), hitEvery: S.hitEvery || 0, pull: S.pull || 0,
    explode: S.explode || null, cloud: S.cloud || null, home: S.home || 0, hook: S.hook || 0,
  };
  if (S.lob) {
    const d = Math.min(S.speed * S.life, Math.max(60, src.aimD ?? 200));
    p.lob = { sx, sy, tx: src.x + Math.cos(a) * d, ty: src.y + Math.sin(a) * d, T: Math.max(0.35, d / S.speed), t: 0 };
    p.life = p.lob.T + 0.05;
  }
  s.shots.push(p);
  return p;
}

// ---------- 투사체 · 충돌 ----------
function shotLanded(s, p) {
  const by = s.heroes[p.owner] || null;
  if (p.explode) {
    for (const t of foesOf(s, p.team)) {
      if (Math.hypot(t.x - p.x, t.y - p.y) > p.explode.r + t.r) continue;
      hit(s, t, { dmg: p.explode.dmg, kb: p.explode.kb, el: p.el, ux: t.x - p.x, uy: t.y - p.y, by, src: p.src });
    }
    fxPush(s, { k: 'explosion', x: p.x, y: p.y, r: p.explode.r, el: p.el, look: p.look, t: 0.6, shake: p.explode.r / 8 });
  }
  if (p.cloud) {
    s.zones.push({ id: s.nextId++, x: p.x, y: p.y, r: p.cloud.r, t: p.cloud.time, life: p.cloud.time, tick: 0, team: p.team, owner: p.owner, look: 'poisoncloud',
      S: { tick: p.cloud.tick, dmg: p.cloud.dmg, el: 'poison', kb: [0, 0] } });
    fxPush(s, { k: 'splash', x: p.x, y: p.y, el: p.el, t: 0.5 });
  }
}
function updateShots(s, dt) {
  for (const p of s.shots) {
    if (p.lob) {
      const L = p.lob;
      L.t += dt;
      const k = Math.min(1, L.t / L.T);
      p.x = L.sx + (L.tx - L.sx) * k; p.y = L.sy + (L.ty - L.sy) * k;
      p.z = Math.sin(Math.PI * k) * 60;
      if (k >= 1) { p.life = 0; shotLanded(s, p); }
      continue;
    }
    if (p.home) {
      const t = foesOf(s, p.team).sort((a, b) => dist(a, p) - dist(b, p))[0];
      if (t) {
        const want = Math.atan2(t.y - p.y, t.x - p.x), cur = Math.atan2(p.vy, p.vx), sp = Math.hypot(p.vx, p.vy);
        let d = want - cur; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
        const na = cur + clamp(d, -p.home * dt, p.home * dt);
        p.vx = Math.cos(na) * sp; p.vy = Math.sin(na) * sp;
      }
    }
    p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
    if (p.x < -60 || p.y < -60 || p.x > COLS * TILE + 60 || p.y > ROWS * TILE + 60) { p.life = 0; continue; }
    if (circleInWall(s.map, p.x, p.y, Math.min(p.r, 6)) && p.look !== 'tornado' && p.look !== 'wave') {
      p.life = 0;
      if (p.explode) shotLanded(s, p);
      else fxPush(s, { k: 'shotend', x: p.x, y: p.y, el: p.el, look: p.look, t: 0.25 });
      continue;
    }
    const by = s.heroes[p.owner] || null;
    for (const t of foesOf(s, p.team)) {
      if (Math.hypot(t.x - p.x, t.y - p.y) > p.r + t.r) continue;
      const last = p.hits.get(t.id);
      if (last !== undefined && (!p.hitEvery || s.time - last < p.hitEvery)) continue;
      if (t.ai === 'shield' && !p.pull && shieldFront(t, p.vx, p.vy)) {
        p.life = 0; fxPush(s, { k: 'block', x: t.x + Math.cos(t.face) * 16, y: t.y + Math.sin(t.face) * 16, t: 0.3 }); break;
      }
      p.hits.set(t.id, s.time);
      if (p.hook && by) {
        const dx = by.x - t.x, dy = by.y - t.y, l = len(dx, dy);
        hit(s, t, { dmg: p.dmg, kb: [0, 0], el: p.el, ux: dx, uy: dy, by });
        const sp = Math.min(p.hook, l * 3.2) / (t.boss ? 4 : t.weight);
        t.kvx = (dx / l) * sp; t.kvy = (dy / l) * sp; t.stun = Math.max(t.stun, 0.35);
        fxPush(s, { k: 'hooked', x: t.x, y: t.y, x2: by.x, y2: by.y, look: p.look, t: 0.3 });
        p.life = 0; break;
      }
      if (p.pull) {
        const dx = p.x - t.x, dy = p.y - t.y, l = len(dx, dy);
        t.kvx = (dx / l) * p.pull * 0.6 + p.vx * 0.8; t.kvy = (dy / l) * p.pull * 0.6 + p.vy * 0.8;
        hit(s, t, { dmg: p.dmg, kb: [0, 0], el: p.el, ux: dx, uy: dy, by, noStop: true, src: p.src });
      } else hit(s, t, { dmg: p.dmg, kb: p.kb, el: p.el, ux: p.vx, uy: p.vy, by, basic: p.basic, src: p.src });
      if (p.explode) { p.life = 0; shotLanded(s, p); break; }
      if (p.pierce > 0) p.pierce--; else { p.life = 0; fxPush(s, { k: 'shotend', x: p.x, y: p.y, el: p.el, look: p.look, t: 0.25 }); break; }
    }
  }
  // 원소 충돌
  const list = s.shots.filter((p) => p.life > 0 && !p.lob);
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    for (let j = i + 1; j < list.length && a.life > 0; j++) {
      const b = list[j];
      if (b.life <= 0 || a.team === b.team || Math.hypot(a.x - b.x, a.y - b.y) > a.r + b.r) continue;
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const diff = a.power - b.power;
      if (Math.abs(diff) < CLASH.even) { a.life = 0; b.life = 0; } else if (diff > 0) { a.power = diff; b.life = 0; } else { b.power = -diff; a.life = 0; }
      const streams = ['flame', 'spark'].includes(a.look) && ['flame', 'spark'].includes(b.look);
      if (a.el && b.el && a.el !== b.el && !streams && (a.power + b.power) >= 1.5) {
        for (const u of [...heroList(s), ...s.enemies].filter(isUnit)) {
          if (Math.hypot(u.x - mx, u.y - my) > CLASH.burst.r + u.r) continue;
          hit(s, u, { dmg: CLASH.burst.dmg, kb: CLASH.burst.kb, ux: u.x - mx || 1, uy: u.y - my, noStop: true });
        }
        fxPush(s, { k: 'clashboom', x: mx, y: my, e1: a.el, e2: b.el, r: CLASH.burst.r, t: 0.5, shake: 7 });
      } else fxPush(s, { k: 'clash', x: mx, y: my, e1: a.el, e2: b.el, t: 0.2 });
    }
  }
  for (const p of s.shots) if (p.life <= 0 && p.ice) makeIce(s, p.x, p.y, p.ice);
  s.shots = s.shots.filter((p) => p.life > 0);
}

// ---------- 지대 · 예약된 공격 ----------
function updateZones(s, dt) {
  for (const z of s.zones) {
    z.t -= dt;
    if (z.follow) { const o = s.heroes[z.owner]; if (o) { z.x = o.x; z.y = o.y; } }
    const by = s.heroes[z.owner] || null;
    if (z.delayed) {
      if (z.t <= 0) {
        const D = z.delayed;
        for (const t of foesOf(s, z.team)) if (Math.hypot(t.x - z.x, t.y - z.y) < D.r + t.r) hit(s, t, { dmg: D.dmg, kb: D.kb, el: D.el, ux: t.x - z.x, uy: t.y - z.y, by });
        fxPush(s, { k: 'thunder', x: z.x, y: z.y, r: D.r, t: 0.5, shake: 7 });
      }
      continue;
    }
    z.tick -= dt;
    if (z.tick > 0) continue;
    z.tick = z.S.tick;
    if (z.S.heal) {
      for (const h of alliesOf(s, z.team)) {
        if (Math.hypot(h.x - z.x, h.y - z.y) > z.r) continue;
        h.pct = Math.max(0, h.pct - z.S.heal * (s.mode === 'colosseum' ? 0.5 : 1));
        fxPush(s, { k: 'heal', x: h.x, y: h.y - 10, v: z.S.heal, t: 0.6 });
      }
      continue;
    }
    for (const t of foesOf(s, z.team)) {
      const dx = z.x - t.x, dy = z.y - t.y, d = Math.hypot(dx, dy);
      if (d > z.r + t.r) continue;
      if (z.S.pull && !t.boss) { t.kvx = (dx / (d || 1)) * z.S.pull * Math.min(1, d / 40); t.kvy = (dy / (d || 1)) * z.S.pull * Math.min(1, d / 40); }
      if (z.S.slow) t.slowT = 0.5;
      if (z.S.dmg) hit(s, t, { dmg: z.S.dmg, kb: z.S.spin || z.S.kb || [0, 0], el: z.S.el, ux: -dx || rnd(-1, 1), uy: -dy, by, noStop: true });
    }
  }
  s.zones = s.zones.filter((z) => z.t > 0);
  for (const q of s.pending) q.t -= dt;
  const due = s.pending.filter((q) => q.t <= 0);
  s.pending = s.pending.filter((q) => q.t > 0);
  for (const q of due) {
    const by = s.heroes[q.owner] || null;
    if (q.do === 'spike') {
      if (circleInWall(s.map, q.x, q.y, 4) || tileAt(s.map, q.x, q.y) === 'o') continue;
      for (const t of foesOf(s, q.team)) if (Math.hypot(t.x - q.x, t.y - q.y) < q.S.r + t.r) hit(s, t, { dmg: q.S.dmg, kb: q.S.kb, el: q.S.el, ux: Math.cos(q.a) * 0.6 + (t.x - q.x) / 40, uy: Math.sin(q.a) * 0.6 + (t.y - q.y) / 40, by });
      fxPush(s, { k: 'pillar', x: q.x, y: q.y, r: q.S.r, look: q.S.look, el: q.S.el, t: 0.7, shake: 3 });
    } else if (q.do === 'bolt') {
      for (const t of foesOf(s, q.team)) if (Math.hypot(t.x - q.x, t.y - q.y) < q.S.r + t.r) hit(s, t, { dmg: q.S.dmg, kb: q.S.kb, el: q.S.el, ux: t.x - q.x || 1, uy: t.y - q.y, by });
      fxPush(s, { k: 'thunder', x: q.x, y: q.y, r: q.S.r, t: 0.5, shake: 5 });
    } else if (q.do === 'meteor') {
      for (const t of foesOf(s, q.team)) if (Math.hypot(t.x - q.x, t.y - q.y) < 80 + t.r) hit(s, t, { dmg: 30, kb: [260, 360], el: 'fire', ux: t.x - q.x || 1, uy: t.y - q.y, by, proc: true });
      fxPush(s, { k: 'explosion', x: q.x, y: q.y, r: 80, el: 'fire', t: 0.7, shake: 10 });
    } else if (q.do === 'execute') {
      for (const id of q.ids) {
        const t = [...s.enemies, ...heroList(s)].find((u) => u.id === id);
        if (!isUnit(t)) continue;
        hit(s, t, { dmg: q.S.dmg, kb: q.S.kb, el: q.S.el, ux: rnd(-1, 1), uy: -1, by });
        fxPush(s, { k: 'execute', x: t.x, y: t.y, t: 0.6, shake: 6 });
      }
    } else if (q.do === 'fn') {
      q.fn();
    } else if (q.do === 'spawn') {
      if (!safeFloor(s.map, q.x, q.y, ENEMIES[q.kind].r)) { const p = randomFloor(s, ENEMIES[q.kind].r, heroList(s), 120); q.x = p.x; q.y = p.y; }
      s.enemies.push(makeEnemy(s, q.kind, q.x, q.y, q.scale));
    }
  }
}

// ============================================================
//  영웅 한 틱
// ============================================================
function updateHero(s, h, inp, dt) {
  h.cds = h.cds.map((c) => Math.max(0, c - dt));
  h.inv = Math.max(0, h.inv - dt);
  h.flash = Math.max(0, h.flash - dt);
  h.atkT = Math.max(0, h.atkT - dt);
  h.hitPop = Math.max(0, h.hitPop - dt * 3);
  h.combo.t = Math.max(0, h.combo.t - dt);
  if (h.combo.t <= 0) h.combo.n = 0;
  h.chainT = Math.max(0, h.chainT - dt);
  h.empower = Math.max(0, h.empower - dt);
  h.slowT = Math.max(0, h.slowT - dt);
  for (const k of Object.keys(h.buf)) { h.buf[k] -= dt; if (h.buf[k] <= 0) delete h.buf[k]; }
  // 증강 고르기 (입력의 pick = 0/1/2)
  if (h.choice) {
    h.choice.t -= dt;
    if (Number.isInteger(inp.pick) && inp.pick >= 0 && inp.pick < h.choice.opts.length) chooseAug(s, h, inp.pick);
    else if (h.choice.t <= 0 || h.bot) chooseAug(s, h, Math.floor(Math.random() * h.choice.opts.length));
  } else if (h.choiceQ.length) offerAug(s, h, h.choiceQ.shift());
  // 대시 충전
  if (h.dashCh < h.dashMax) { h.dashCd -= dt; if (h.dashCd <= 0) { h.dashCh++; h.dashCd = DASH.cd * (1 - h.b.dash); } }
  if (!h.alive) {
    if (h.out) return;
    h.respawn -= dt;
    if (h.respawn <= 0 && (s.mode === 'story' || !s.colo.over)) respawnHero(s, h);
    return;
  }
  if (h.fall > 0) { h.fall -= dt; if (h.fall <= 0) heroFell(s, h); return; }
  updateStatus(s, h, dt);
  if (!isUnit(h)) return;
  pickupItems(s, h);
  heroAugTick(s, h, dt);
  if (h.hs > 0) { h.hs -= dt; return; }
  h.stun = Math.max(0, h.stun - dt);
  if (Number.isFinite(inp.aim)) h.aim = inp.aim;
  if (Number.isFinite(inp.ad)) h.aimD = inp.ad;
  const C = CHARS[h.char];
  if (h.dash) {
    const D = h.dash;
    D.t -= dt;
    moveBody(s, h, D.vx, D.vy, dt);
    for (const t of foesOf(s, h.team)) {
      if (D.hit.has(t.id) || dist(t, h) > D.S.width + t.r) continue;
      D.hit.add(t.id);
      hit(s, t, { dmg: D.S.dmg, kb: D.S.kb, el: D.S.el, ux: D.vx, uy: D.vy, by: h });
      if (D.S.resetOnHit) h.cds[D.i] = Math.min(h.cds[D.i], D.S.resetOnHit);
    }
    if (D.t <= 0) {
      h.dash = null; h.kvx = D.vx * 0.15; h.kvy = D.vy * 0.15;
      if (D.S.land) {
        const L = D.S.land;
        for (const t of foesOf(s, h.team)) if (dist(t, h) < L.r + t.r) hit(s, t, { dmg: L.dmg, kb: L.kb, el: D.S.el, ux: t.x - h.x || 1, uy: t.y - h.y, by: h });
        fxPush(s, { k: 'slam', x: h.x, y: h.y, r: L.r, el: D.S.el, hero: true, t: 0.7, shake: 12 });
        h.kvx = h.kvy = 0;
      }
    }
    return;
  }
  if (h.roll) {
    h.roll.t -= dt;
    moveBody(s, h, h.roll.vx, h.roll.vy, dt);
    if (h.roll.t <= 0) h.roll = null;
    return;
  }
  if (h.snipe) {
    h.snipe.t -= dt;
    if (h.snipe.t <= 0) { fireSnipe(s, h, h.snipe); h.snipe = null; }
    moveBody(s, h, 0, 0, dt);
    return;
  }
  if (h.chan) {
    const ch = h.chan;
    ch.t -= dt; ch.acc += dt;
    while (ch.acc >= ch.S.every) { ch.acc -= ch.S.every; spawnShot(s, h, ch.S, h.aim + rnd(-1, 1) * ch.S.spread); }
    if (ch.t <= 0) h.chan = null;
  }
  let mx = clamp(inp.mx || 0, -1, 1), my = clamp(inp.my || 0, -1, 1);
  const ml = Math.hypot(mx, my);
  if (ml > 1) { mx /= ml; my /= ml; }
  if (inp.dash && h.dashCh > 0 && !frozenOrStunned(h)) {
    h.dashCh--;
    if (h.dashCd <= 0) h.dashCd = DASH.cd * (1 - h.b.dash);
    const a = ml > 0.2 ? Math.atan2(my, mx) : h.aim;
    h.roll = { vx: Math.cos(a) * DASH.dist / DASH.time, vy: Math.sin(a) * DASH.dist / DASH.time, t: DASH.time };
    h.inv = Math.max(h.inv, DASH.inv);
    h.stun = 0; h.kvx *= 0.3; h.kvy *= 0.3;
    fxPush(s, { k: 'roll', x: h.x, y: h.y, a, who: h.id, char: h.char, t: 0.3 });
    if (s.mode === 'story' && h.b.dashBoom) {
      for (const t of foesOf(s, h.team)) if (dist(t, h) < 70 + t.r) hit(s, t, { dmg: 14, kb: [200, 260], el: CHARS[h.char].el, ux: t.x - h.x || 1, uy: t.y - h.y, by: h, proc: true });
      fxPush(s, { k: 'explosion', x: h.x, y: h.y, r: 70, el: CHARS[h.char].el, t: 0.5, shake: 5 });
    }
    return;
  }
  const speed = frozenOrStunned(h) ? 0 : C.speed * (1 + (s.mode === 'story' ? h.b.spd : 0)) * (h.buf.swift > 0 ? 1.35 : 1) * speedMul(h) * (h.chan ? h.chan.S.slow : 1);
  h.moving = ml > 0.1 && speed > 0;
  if (onIce(s, h)) {
    // 빙판: 걷기 속도가 천천히 붙고, 손을 떼도 계속 미끄러짐
    const k = 1 - Math.exp(-ICE.accel * dt);
    h.ivx += (mx * speed - h.ivx) * k; h.ivy += (my * speed - h.ivy) * k;
    moveBody(s, h, h.ivx, h.ivy, dt);
  } else {
    h.ivx = mx * speed; h.ivy = my * speed;
    moveBody(s, h, h.ivx, h.ivy, dt);
  }
  if (h.fall > 0 || frozenOrStunned(h)) return;
  if (inp.atk) useSkill(s, h, 0);
  if (inp.s1) useSkill(s, h, 1);
  if (inp.s2) useSkill(s, h, 2);
  if (inp.s3) useSkill(s, h, 3);
}
// 수호 구체 · 운석 (증강)
function heroAugTick(s, h, dt) {
  if (s.mode !== 'story') return;
  const n = h.b.orbs;
  if (n) {
    for (let i = 0; i < n; i++) {
      const a = s.time * 3.2 + (i * Math.PI * 2) / n;
      const ox = h.x + Math.cos(a) * 48, oy = h.y + Math.sin(a) * 48 - 6;
      for (const t of foesOf(s, h.team)) {
        if (Math.hypot(t.x - ox, t.y - oy) > 12 + t.r) continue;
        const key = t.id * 10 + i;
        if ((h.orbHit.get(key) || 0) > s.time) continue;
        h.orbHit.set(key, s.time + 0.45);
        hit(s, t, { dmg: 6 + h.b.orbDmg, kb: [90, 120], ux: t.x - h.x, uy: t.y - h.y, by: h, noStop: true, proc: true });
      }
    }
    if (h.orbHit.size > 400) h.orbHit.clear();
  }
  if (h.b.meteor) {
    h.meteorT -= dt;
    if (h.meteorT <= 0) {
      const t = foesOf(s, h.team).sort((a, b) => dist(a, h) - dist(b, h))[0];
      if (t && dist(t, h) < 520) {
        h.meteorT = 7;
        s.pending.push({ t: 0.8, do: 'meteor', x: t.x, y: t.y, team: h.team, owner: h.id });
        fxPush(s, { k: 'warn', x: t.x, y: t.y, r: 80, t: 0.8, el: 'fire' });
        fxPush(s, { k: 'meteorfall', x: t.x, y: t.y, t: 0.8 });
      } else h.meteorT = 1;
    }
  }
}
function fireSnipe(s, h, sn) {
  const S = sn.S, ux = Math.cos(sn.a), uy = Math.sin(sn.a);
  let L = S.len;
  for (let d = 0; d < S.len; d += 8) if (circleInWall(s.map, h.x + ux * d, h.y + uy * d, 2)) { L = d; break; }
  for (const t of foesOf(s, h.team)) {
    const rx = t.x - h.x, ry = t.y - h.y, along = rx * ux + ry * uy;
    if (along < 0 || along > L) continue;
    if (Math.abs(rx * uy - ry * ux) > S.width + t.r) continue;
    hit(s, t, { dmg: S.dmg, kb: S.kb, el: S.el, ux, uy, by: h });
  }
  h.kvx -= ux * 220; h.kvy -= uy * 220;
  fxPush(s, { k: 'beam', x: h.x, y: h.y, a: sn.a, len: L, t: 0.35, shake: 6 });
}
// 공허에 떨어짐 → 목숨 -1
function heroFell(s, h) {
  const by = h.lastBy && s.time - h.lastByT < 6 ? s.heroes[h.lastBy] : null;
  h.alive = false; h.stocks--;
  h.chan = h.dash = h.snipe = h.roll = null;
  if (by && by !== h) by.kos++;
  fxPush(s, { k: 'ko', x: h.x, y: h.y, color: h.color, t: 1.2, shake: 14 });
  if (s.mode === 'colosseum') {
    if (h.stocks > 0) { h.respawn = COLOSSEUM.respawn; say(s, `${h.name} 링아웃! (남은 목숨 ${h.stocks})`, 1.8); }
    else { h.stocks = 0; h.out = true; say(s, `${h.name} 탈락!`, 1.8); }
    const teamsAlive = new Set(heroList(s).filter((o) => o.stocks > 0).map((o) => o.team));
    if (teamsAlive.size <= 1) {
      const win = [...teamsAlive][0];
      const names = heroList(s).filter((o) => o.team === win).map((o) => o.name).join(', ');
      s.colo.over = true; s.colo.t = COLOSSEUM.restart; s.colo.winner = names || '무승부'; s.colo.winTeam = win;
      say(s, `${names} 승리!`, COLOSSEUM.restart);
    }
  } else {
    if (h.stocks > 0) { h.respawn = STORY.respawn; say(s, `${h.name} 추락! 남은 목숨 ${h.stocks}`, 1.6); }
    else { h.out = true; say(s, `${h.name} 탈락… 다음 스테이지에서 돌아와요`, 2); }
  }
}
function respawnHero(s, h) {
  placeHero(s, h);
  Object.assign(h, { alive: true, out: false, pct: 0, inv: 2, stun: 0, dash: null, chan: null, snipe: null, roll: null, fall: 0, st: {}, lastBy: null, shield: h.shieldMax, ivx: 0, ivy: 0 });
  fxPush(s, { k: 'respawn', x: h.x, y: h.y, color: h.color, t: 0.8 });
  if (s.mode === 'story' && h.b.rebirth) {
    for (const t of foesOf(s, h.team)) if (dist(t, h) < 130 + t.r) hit(s, t, { dmg: 26, kb: [300, 380], el: 'fire', ux: t.x - h.x || 1, uy: t.y - h.y, by: h, proc: true });
    fxPush(s, { k: 'explosion', x: h.x, y: h.y, r: 130, el: 'fire', t: 0.8, shake: 12 });
  }
}

// ============================================================
//  아이템
// ============================================================
function dropItem(s, kind, x, y, vx = rnd(-120, 120), vy = rnd(-160, -60)) {
  s.items.push({ id: s.nextId++, kind, x, y, vx, vy, z: 0, vz: 140, t: s.mode === 'colosseum' ? 15 : 40, age: 0 });
}
function updateItems(s, dt) {
  for (const it of s.items) {
    it.t -= dt; it.age += dt;
    if (it.vx || it.vy) {
      const nx = it.x + it.vx * dt, ny = it.y + it.vy * dt;
      if (!circleInWall(s.map, nx, ny, 8)) { it.x = nx; it.y = ny; }
      it.vx *= Math.exp(-4 * dt); it.vy *= Math.exp(-4 * dt);
      if (Math.abs(it.vx) + Math.abs(it.vy) < 4) it.vx = it.vy = 0;
    }
    it.vz -= 600 * dt; it.z = Math.max(0, it.z + it.vz * dt);
    if (tileAt(s.map, it.x, it.y) === 'o' && it.z <= 0) { it.t = 0; fxPush(s, { k: 'fall', x: it.x, y: it.y, t: 0.5 }); }
  }
  s.items = s.items.filter((it) => it.t > 0);
}
function pickupItems(s, h) {
  const R = 24 + (h.b.magnet ? 40 : 0);
  for (const it of s.items) {
    if (it.t <= 0 || it.age < 0.35 || Math.hypot(it.x - h.x, it.y - h.y) > R) continue;
    const I = ITEMS[it.kind];
    it.t = 0;
    if (I.pct) h.pct = Math.max(0, h.pct + I.pct);
    if (I.life) h.stocks = Math.min(STORY.maxLives, h.stocks + I.life);
    if (I.buff) h.buf[I.buff] = I.time;
    if (I.gold && s.mode === 'story') giveGold(s, I.gold, it.x, it.y);
    fxPush(s, { k: 'pickup', x: it.x, y: it.y, kind: it.kind, who: h.id, name: I.name, color: I.color, t: 0.9 });
  }
}

// ============================================================
//  레벨 · 증강
// ============================================================
function giveXp(s, n) {
  // 레벨업 증강은 없앰 (증강은 정해진 스테이지 클리어 때만). 경험치는 기록용으로만 쌓음
  if (s.mode !== 'story') return;
  s.xp += n;
  return;
  const mul = 1 + Math.max(0, ...heroList(s).map((h) => h.b.xp));
  s.xp += n * mul;
  while (s.xp >= LEVEL.need(s.level)) {
    s.xp -= LEVEL.need(s.level);
    s.level++;
    fxPush(s, { k: 'levelup', lv: s.level, t: 1.6 });
    for (const h of heroList(s)) {
      h.choiceQ.push(1);
      fxPush(s, { k: 'heroLevel', x: h.x, y: h.y, t: 1, who: h.id });
    }
  }
}
function offerAug(s, h, tier) {
  const pool = AUGMENTS.filter((a) => a.tier === tier && !h.augs.includes(a.id)); // 같은 증강은 한 번만
  if (!pool.length) return;
  const opts = [];
  while (opts.length < 3 && opts.length < pool.length) { const a = pool[Math.floor(Math.random() * pool.length)]; if (!opts.includes(a.id)) opts.push(a.id); }
  h.choice = { opts, tier, t: LEVEL.autoPick };
}
function chooseAug(s, h, i) {
  const id = h.choice.opts[i];
  const A = AUGMENTS.find((a) => a.id === id);
  h.choice = null;
  if (!A) return;
  h.augs.push(id);
  if (A.lives) h.stocks = Math.min(STORY.maxLives + 2, h.stocks + A.lives);
  recompute(s, h);
  h.dashCh = h.dashMax;
  fxPush(s, { k: 'augpick', x: h.x, y: h.y, who: h.id, aug: id, legend: A.tier === 2, t: 1.2 });
}
export function pickAug(s, id, i) { const h = s.heroes[id]; if (h?.choice && i >= 0 && i < h.choice.opts.length) chooseAug(s, h, i); }
export const choosing = (s) => heroList(s).some((h) => h.choice && !h.bot);

// ============================================================
//  땅 변형: 무너짐 · 솟아오름 · 뒤틀림 · 보스가 뚫는 구멍
//  warns: { fall:[칸], rise:[칸], t, T, big, fp?, hole?, orig? } — 경고가 끝나면 적용
// ============================================================
const setTile = (s, i, c) => { s.map.tiles[(i / COLS) | 0][i % COLS] = c; };
const tileI = (s, i) => s.map.tiles[(i / COLS) | 0][i % COLS];
function mapChanged(s) {
  s.map.ver++;
  s.flowT = 0;
  for (const it of s.items) if (tileAt(s.map, it.x, it.y) === 'o') it.t = 0;
}
function initShift(s, start, every) {
  s.fp = fpOf(s.map.tiles);
  s.shift = { t: start, every, n: 0 };
  s.warns = []; s.holes = [];
}
function applyWarn(s, w) {
  for (const i of w.fall) setTile(s, i, 'o');
  for (const i of w.rise) setTile(s, i, w.orig?.[i] ?? '.');
  if (w.fp) s.fp = w.fp;
  if (w.hole) s.holes.push({ tiles: w.fall, orig: w.holeOrig, t: w.hole });
  if (w.fall.length) fxPush(s, { k: 'collapse', tiles: w.fall, t: 1.2, shake: w.big ? 10 : 6 });
  if (w.rise.length) fxPush(s, { k: 'rise', tiles: w.rise, t: 1, shake: w.big ? 6 : 2 });
  if (w.big) say(s, w.fall.length && w.rise.length ? '땅이 뒤틀렸다!' : w.fall.length ? '땅이 무너졌다!' : '새 땅이 솟아올랐다!', 1.2);
  mapChanged(s);
}
// 구덩이 뚫기 (보스 기술): 경고 → 구멍 → hole초 뒤 다시 메워짐
function digHoles(s, idxs, warn, hole) {
  const fall = [...new Set(idxs)].filter((i) => { const c = tileI(s, i); return c !== 'o' && c !== '#'; });
  if (!fall.length) return;
  const holeOrig = {}; for (const i of fall) holeOrig[i] = tileI(s, i) === 'P' ? '.' : tileI(s, i);
  s.warns.push({ fall, rise: [], t: warn, T: warn, hole, holeOrig });
}
function updateMapEvents(s, dt, active) {
  for (const w of s.warns) { w.t -= dt; if (w.t <= 0) applyWarn(s, w); }
  s.warns = s.warns.filter((w) => w.t > 0);
  for (const h of s.holes) {
    h.t -= dt;
    if (h.t > 0) continue;
    const rise = h.tiles.filter((i) => tileI(s, i) === 'o' && inFp(s.fp, i % COLS, (i / COLS) | 0));
    if (rise.length) s.warns.push({ fall: [], rise, orig: h.orig, t: 0.8, T: 0.8 });
  }
  s.holes = s.holes.filter((h) => h.t > 0);
  const E = s.shift;
  if (!active || !E) return;
  E.t -= dt;
  if (E.t > 0 || s.warns.some((w) => w.big)) return;
  E.t = E.every;
  const plan = planShift(s.fp, E.n);
  if (!plan) return;
  const { fall, rise } = shiftTiles(s.map.tiles, s.fp, plan.fp);
  if (!fall.length && !rise.length) { s.fp = plan.fp; return; }
  E.n++;
  s.warns.push({ big: true, kind: plan.kind, fall, rise, fp: plan.fp, t: COLLAPSE.warn, T: COLLAPSE.warn });
  fxPush(s, { k: 'crumble', t: COLLAPSE.warn });
  say(s, plan.msg, 1.8);
}
// 클리어: 가운데 땅을 단단히 (문 · 상자 자리)
function raiseCore(s) {
  const rise = [], other = [];
  for (let y = CORE.y0 - 1; y <= CORE.y1 + 2; y++) for (let x = CORE.x0 - 1; x <= CORE.x1 + 1; x++) {
    const i = y * COLS + x, c = tileI(s, i);
    if (c === 'o') rise.push(i); else if (c === '#' || c === '^') other.push(i);
  }
  s.warns = s.warns.filter((w) => !w.big);
  s.holes = [];
  for (const i of other) setTile(s, i, '.');
  for (const i of rise) setTile(s, i, '.');
  if (rise.length || other.length) { fxPush(s, { k: 'rise', tiles: [...rise, ...other], t: 1, shake: 3 }); mapChanged(s); }
}

// ============================================================
//  적
// ============================================================
function computeFlow(s) {
  const N = COLS * ROWS, d = new Int16Array(N).fill(-1), q = [];
  for (const h of heroList(s)) {
    if (!isUnit(h)) continue;
    const i = Math.floor(h.y / TILE) * COLS + Math.floor(h.x / TILE);
    if (i >= 0 && i < N && d[i] < 0) { d[i] = 0; q.push(i); }
  }
  for (let k = 0; k < q.length; k++) {
    const i = q[k], x = i % COLS, y = (i / COLS) | 0;
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + ox, ny = y + oy;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      const j = ny * COLS + nx, c = s.map.tiles[ny][nx];
      if (d[j] >= 0 || c === '#' || c === 'o') continue;
      d[j] = d[i] + 1; q.push(j);
    }
  }
  s.flow = d; s.flowT = 0.25;
}
function clearLine(s, a, b, r) {
  const L = Math.hypot(b.x - a.x, b.y - a.y), n = Math.ceil(L / 12);
  for (let k = 1; k < n; k++) {
    const x = a.x + (b.x - a.x) * (k / n), y = a.y + (b.y - a.y) * (k / n);
    if (tileAt(s.map, x, y) === 'o' || circleInWall(s.map, x, y, r * 0.8)) return false;
  }
  return true;
}
export function pathDir(s, u, t) {
  const dx = t.x - u.x, dy = t.y - u.y, l = len(dx, dy);
  if (!s.flow || clearLine(s, u, t, u.r)) return [dx / l, dy / l];
  const tx = Math.floor(u.x / TILE), ty = Math.floor(u.y / TILE);
  let best = null, bd = 1e9;
  for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const nx = tx + ox, ny = ty + oy;
    if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
    const v = s.flow[ny * COLS + nx];
    if (v < 0) continue;
    if (ox && oy && (s.flow[ty * COLS + nx] < 0 || s.flow[ny * COLS + tx] < 0)) continue;
    if (v < bd) { bd = v; best = [nx, ny]; }
  }
  if (!best) return [dx / l, dy / l];
  const gx = (best[0] + 0.5) * TILE - u.x, gy = (best[1] + 0.5) * TILE - u.y, gl = len(gx, gy);
  return [gx / gl, gy / gl];
}
const nearestHero = (s, e) => heroList(s).filter(isUnit).sort((a, b) => dist(a, e) - dist(b, e))[0];
function makeEnemy(s, kind, x, y, scale = { hp: 1, dmg: 1 }) {
  const E = ENEMIES[kind];
  const hp = Math.round(E.hp * scale.hp);
  return {
    kind: 'enemy', type: kind, ai: E.ai, id: s.nextId++, team: 'E', x, y, r: E.r, kvx: 0, kvy: 0, hp, maxHp: hp, pct: 0, weight: E.weight,
    stun: 0, inv: 0.4, hs: 0, flash: 0, st: {}, fall: 0, dead: false, cd: rnd(0.3, 1.2), face: 0, t: rnd(0, 5), dmgMul: scale.dmg, slowT: 0, mode: 0, modeT: rnd(0.5, 1.5),
  };
}
function makeBoss(s, key, x, y, scale) {
  const B = BOSSES[key];
  const hp = Math.round(B.hp * scale.hp * (1 + 0.5 * (Object.keys(s.heroes).length - 1)));
  const e0 = {
    kind: 'enemy', boss: key, type: key, ai: 'boss', id: s.nextId++, team: 'E', x, y, r: B.r, kvx: 0, kvy: 0, hp, maxHp: hp, pct: 0, weight: B.weight,
    stun: 0, inv: 0.5, hs: 0, flash: 0, st: {}, fall: 0, dead: false, cd: 0, face: 0, t: 0, dmgMul: scale.dmg, slowT: 0, patT: 2, patI: 0, act: null,
    gen: 0, pool: hp, future: 0,
  };
  // 분열하는 보스: 첫 몸은 전체 체력의 일부만, 나머지는 자식들 몫
  if (B.split) { const P = B.split; e0.maxHp = e0.hp = Math.round(hp * P.share[0]); e0.future = hp * P.share[1] * 2 + hp * P.share[2] * 4; }
  return e0;
}
function killEnemy(s, e, by, fell = false) {
  if (e.dead) return;
  e.dead = true;
  s.kills++;
  const E = e.boss ? null : ENEMIES[e.type];
  fxPush(s, { k: 'die', x: e.x, y: e.y, type: e.type, boss: !!e.boss, fell, t: e.boss ? 1.6 : 0.8, shake: e.boss ? 16 : 3 });
  if (s.mode === 'story') {
    if (E) { giveGold(s, E.gold + (fell ? 1 : 0), e.x, e.y); giveXp(s, E.xp); if (Math.random() < 0.05 && !fell) dropItem(s, 'potion', e.x, e.y); }
    for (const h of heroList(s)) if (h.b.leech && isUnit(h)) h.pct = Math.max(0, h.pct - h.b.leech);
    const killer = by || s.heroes[e.lastBy];
    if (killer?.b?.killCd) { killer.cds = killer.cds.map((c) => Math.max(0, c - killer.b.killCd)); fxPush(s, { k: 'cdr', x: killer.x, y: killer.y, t: 0.5 }); }
  }
  if (e.boss) bossSplit(s, e);
}
// 슬라임 왕 분열: 작은 왕 2마리 (세대마다 작아짐)
function bossSplit(s, e) {
  const B = BOSSES[e.boss];
  if (!B.split || (e.gen || 0) >= B.split.gens) return;
  const g = (e.gen || 0) + 1, P = B.split;
  for (const side of [-1, 1]) {
    const a = Math.random() * Math.PI * 2;
    const c = makeBoss(s, e.boss, e.x + side * e.r * 0.6, e.y, { hp: 1, dmg: e.dmgMul });
    c.gen = g; c.r = B.r * P.size[g]; c.weight = B.weight * P.size[g];
    c.maxHp = c.hp = Math.max(1, Math.round(e.pool * P.share[g]));
    c.pool = e.pool; c.future = g < P.gens ? e.pool * P.share[g + 1] * 2 : 0;
    c.kvx = Math.cos(a) * 60 + side * 320; c.kvy = Math.sin(a) * 160;
    c.inv = 0.6; c.patT = 1.2 + Math.random(); c.patI = Math.floor(Math.random() * 3); c.dmgMul = e.dmgMul;
    s.enemies.push(c);
  }
  fxPush(s, { k: 'bosssplit', x: e.x, y: e.y, color: B.color, t: 0.8, shake: 8 });
  say(s, g === 1 ? '슬라임 왕이 둘로 갈라졌다!' : '더 작게 갈라졌다!', 1.4);
}
function giveGold(s, n, x, y) {
  const mul = 1 + Math.max(0, ...heroList(s).map((h) => h.b.gold));
  const v = Math.round(n * mul);
  s.gold += v;
  fxPush(s, { k: 'gold', x, y, v, t: 0.9 });
}
function enemyShot(s, e, a, F) {
  const S = { speed: F.speed, r: F.r || 7, power: 1, dmg: F.dmg * e.dmgMul, kb: F.kb || [120, 160], life: F.life || 3, look: F.look, home: F.home || 0, el: F.el };
  const p = spawnShot(s, e, S, a);
  if (F.ice) p.ice = F.ice;
  return p;
}
function contact(s, e, t, dmg, kb) {
  if (e.cd > 0 || !t || dist(e, t) > e.r + t.r + 3 || t.inv > 0) return;
  hit(s, t, { dmg: dmg * e.dmgMul, kb, ux: t.x - e.x, uy: t.y - e.y, src: e });
  e.cd = 1;
}
function shieldCharge(s, e, E, dt) {
  const C = E.charge;
  e.modeT -= dt;
  if (e.mode === 3) { // 돌진 후 비틀거림: 방패가 내려가 무방비
    if (e.modeT <= 0) { e.mode = 0; e.modeT = rnd(C.every[0], C.every[1]); }
    moveBody(s, e, 0, 0, dt);
    return;
  }
  const cx = Math.cos(e.ca), cy = Math.sin(e.ca);
  e.face = e.ca;
  const x0 = e.x, y0 = e.y;
  moveBody(s, e, cx * C.speed * speedMul(e), cy * C.speed * speedMul(e), dt);
  for (const u of heroList(s).filter(isUnit)) {
    if (e.hitSet.includes(u.id) || dist(u, e) > e.r + u.r + 6 || u.inv > 0) continue;
    e.hitSet.push(u.id);
    // 돌진 방향 + 옆으로 살짝 밀어냄
    const sx = u.x - e.x, sy = u.y - e.y, side = (sx * -cy + sy * cx) >= 0 ? 1 : -1;
    hit(s, u, { dmg: C.dmg * e.dmgMul, kb: C.kb, ux: cx - cy * side * 0.35, uy: cy + cx * side * 0.35, src: e });
  }
  const moved = Math.hypot(e.x - x0, e.y - y0);
  const bonk = e.modeT < C.time - 0.08 && moved < C.speed * dt * 0.3;
  if (bonk || e.modeT <= 0 || frozenOrStunned(e)) {
    e.mode = 3; e.modeT = bonk ? C.wallStagger : C.stagger;
    if (bonk) { fxPush(s, { k: 'wallhit', x: e.x + cx * e.r, y: e.y + cy * e.r, t: 0.4, shake: 5 }); e.stun = Math.max(e.stun, 0.6); }
  }
}
function updateEnemy(s, e, dt) {
  e.flash = Math.max(0, e.flash - dt);
  e.inv = Math.max(0, e.inv - dt);
  e.slowT = Math.max(0, e.slowT - dt);
  if (e.fall > 0) { e.fall -= dt; if (e.fall <= 0) killEnemy(s, e, s.heroes[e.lastBy], true); return; }
  updateStatus(s, e, dt);
  if (e.dead) return;
  if (e.hs > 0) { e.hs -= dt; return; }
  e.stun = Math.max(0, e.stun - dt);
  e.cd = Math.max(0, e.cd - dt);
  e.t += dt;
  if (e.ai === 'boss') { updateBoss(s, e, dt); return; }
  const E = ENEMIES[e.type];
  if (e.ai === 'shield' && (e.mode === 2 || e.mode === 3)) { shieldCharge(s, e, E, dt); return; }
  if (e.ai === 'shield' && e.mode === 1 && frozenOrStunned(e)) e.mode = 0; // 자세가 끊기면 취소
  const t = nearestHero(s, e);
  let wx = 0, wy = 0;
  if (t && !frozenOrStunned(e)) {
    const dx = t.x - e.x, dy = t.y - e.y, d = len(dx, dy);
    const [ux, uy] = pathDir(s, e, t);
    const sp = E.speed * speedMul(e);
    e.face = Math.atan2(dy, dx);
    switch (e.ai) {
      case 'chase': wx = ux * sp; wy = uy * sp; contact(s, e, t, E.touch, E.kb); break;
      case 'zigzag': { const w = Math.sin(e.t * 6) * 0.9; wx = (ux - uy * w) * sp; wy = (uy + ux * w) * sp; contact(s, e, t, E.touch, E.kb); break; }
      case 'leap':
        e.modeT -= dt;
        if (e.modeT <= 0) { e.mode = e.mode ? 0 : 1; e.modeT = e.mode ? 0.32 : rnd(0.8, 1.3); e.lx = ux; e.ly = uy; }
        if (e.mode) { wx = e.lx * sp * 3.8; wy = e.ly * sp * 3.8; } else { wx = ux * sp * 0.2; wy = uy * sp * 0.2; }
        contact(s, e, t, E.touch, E.kb);
        break;
      case 'bomber':
        if (e.fuse > 0) {
          e.fuse -= dt;
          if (e.fuse <= 0) {
            for (const u of heroList(s).filter(isUnit)) if (dist(u, e) < E.boom.r + u.r) hit(s, u, { dmg: E.boom.dmg * e.dmgMul, kb: E.boom.kb, ux: u.x - e.x, uy: u.y - e.y });
            for (const u of s.enemies) if (u !== e && isUnit(u) && dist(u, e) < E.boom.r) hit(s, u, { dmg: 20, kb: E.boom.kb, ux: u.x - e.x, uy: u.y - e.y });
            fxPush(s, { k: 'explosion', x: e.x, y: e.y, r: E.boom.r, el: 'fire', t: 0.6, shake: 9 });
            e.dead = true;
            return;
          }
        } else if (d < 55) { e.fuse = 0.65; fxPush(s, { k: 'warn', x: e.x, y: e.y, r: E.boom.r, t: 0.65 }); }
        else { wx = ux * sp; wy = uy * sp; }
        break;
      case 'ranged':
        if (Math.random() < dt * 0.5) e.mode = e.mode ? 0 : 1;
        if (d > 280) { wx = ux * sp; wy = uy * sp; } else if (d < 190) { wx = -ux * sp; wy = -uy * sp; } else { const sg = e.mode ? 1 : -1; wx = -uy * sp * sg * 0.7; wy = ux * sp * sg * 0.7; }
        if (e.cd <= 0 && d < 460) { e.cd = E.fire.every * rnd(0.8, 1.2); enemyShot(s, e, e.face, E.fire); fxPush(s, { k: 'ecast', x: e.x, y: e.y, t: 0.25 }); }
        break;
      case 'caster':
        if (d > 300) { wx = ux * sp; wy = uy * sp; } else if (d < 200) { wx = -ux * sp; wy = -uy * sp; }
        if (e.cd <= 0 && d < 480) { e.cd = E.fire.every; for (let k = -1; k <= 1; k++) enemyShot(s, e, e.face + k * 0.4, E.fire); fxPush(s, { k: 'ecast', x: e.x, y: e.y, t: 0.3 }); }
        break;
      case 'slam':
        if (e.slamT > 0) {
          e.slamT -= dt;
          if (e.slamT <= 0) {
            for (const u of heroList(s).filter(isUnit)) if (dist(u, e) < E.slam.r + u.r) hit(s, u, { dmg: E.slam.dmg * e.dmgMul, kb: E.slam.kb, ux: u.x - e.x, uy: u.y - e.y, src: e, el: E.slam.ice ? 'ice' : undefined });
            fxPush(s, { k: 'slam', x: e.x, y: e.y, r: E.slam.r, t: 0.6, shake: 10, el: E.slam.ice ? 'ice' : undefined });
            if (E.slam.ice) makeIce(s, e.x, e.y, E.slam.ice);
          }
        } else {
          wx = ux * sp; wy = uy * sp;
          contact(s, e, t, E.touch, E.kb);
          e.modeT -= dt;
          if (d < 110 && e.modeT <= 0) { e.modeT = E.slam.every; e.slamT = E.slam.warn; fxPush(s, { k: 'warn', x: e.x, y: e.y, r: E.slam.r, t: E.slam.warn }); }
        }
        break;
      case 'shield': {
        const C = E.charge;
        e.modeT -= dt;
        if (e.mode === 0) { // 방패 들고 전진
          wx = ux * sp; wy = uy * sp;
          contact(s, e, t, E.touch, E.kb);
          if (e.modeT <= 0 && d > C.range[0] && d < C.range[1]) {
            e.mode = 1; e.modeT = C.warn; e.ca = e.face; e.hitSet = [];
            fxPush(s, { k: 'warnline', x: e.x, y: e.y, a: e.ca, len: C.speed * C.time + 20, w: e.r * 2, t: C.warn });
          }
        } else if (e.mode === 1) { // 자세 잡기 (조준 고정)
          e.face = e.ca;
          if (e.modeT <= 0) { e.mode = 2; e.modeT = C.time; fxPush(s, { k: 'dashstart', x: e.x, y: e.y, a: e.ca, t: 0.3 }); }
        }
        break;
      }
      case 'totem':
        if (e.cd <= 0) { e.cd = E.fire.every; e.spin = (e.spin || 0) + 0.5; for (let k = 0; k < 3; k++) enemyShot(s, e, e.spin + (k * Math.PI * 2) / 3, E.fire); }
        break;
      default:
    }
    // 공허 앞에서 멈칫 (걸어서는 떨어지지 않음 — moveBody가 막음)
  }
  moveBody(s, e, wx, wy, dt);
}

// ---------- 보스 ----------
function updateBoss(s, e, dt) {
  const B = BOSSES[e.boss];
  if (B.roll) { updateSnowHead(s, e, dt); return; }
  if (B.splitAt && !e.split && e.hp < e.maxHp * B.splitAt && !e.act) { snowSplit(s, e); return; }
  const t = nearestHero(s, e);
  const half = e.hp < e.maxHp / 2;
  let wx = 0, wy = 0;
  if (e.act) {
    const A = e.act;
    A.t -= dt;
    if (A.type === 'jump') {
      const k = 1 - A.t / A.T;
      e.x = A.sx + (A.tx - A.sx) * k; e.y = A.sy + (A.ty - A.sy) * k; e.z = Math.sin(Math.PI * k) * 90;
      if (A.t <= 0) { e.z = 0; bossBlast(s, e, A.r || 120, A.dmg || 26, A.kb || [260, 360]); if (A.ice) makeIce(s, e.x, e.y, A.ice); }
    } else if (A.type === 'dash') {
      if (A.t <= A.go) { wx = Math.cos(A.a) * 520; wy = Math.sin(A.a) * 520; contactBoss(s, e, 22, [280, 380]); }
    } else if (A.type === 'laser') {
      A.a += A.spin * dt;
      if (A.t < A.T - 0.8) {
        for (const h of heroList(s).filter(isUnit)) {
          const rx = h.x - e.x, ry = h.y - e.y, along = rx * Math.cos(A.a) + ry * Math.sin(A.a);
          if (along > 0 && along < 620 && Math.abs(rx * Math.sin(A.a) - ry * Math.cos(A.a)) < 14 + h.r && !(h.inv > 0)) hit(s, h, { dmg: 14 * e.dmgMul, kb: [200, 260], ux: Math.cos(A.a + 1.57), uy: Math.sin(A.a + 1.57) });
        }
      }
    }
    if (A.t <= 0) e.act = null;
  } else if (t) {
    const dx = t.x - e.x, dy = t.y - e.y, d = len(dx, dy);
    e.face = Math.atan2(dy, dx);
    if (d > 140) { const [px, py] = pathDir(s, e, t); wx = px * B.speed * speedMul(e); wy = py * B.speed * speedMul(e); }
    contactBoss(s, e, B.touch, [240, 320]);
    e.patT -= dt;
    if (e.patT <= 0) {
      e.patT = B.every ? B.every[half ? 1 : 0] : half ? 1.9 : 2.6;
      bossPattern(s, e, B.pats[e.patI++ % B.pats.length], t, half);
    }
  }
  moveBody(s, e, wx, wy, dt);
}
function contactBoss(s, e, dmg, kb) {
  for (const h of heroList(s).filter(isUnit)) {
    if (dist(h, e) > e.r + h.r || h.inv > 0 || (h.bossHitT || 0) > s.time) continue;
    h.bossHitT = s.time + 0.8;
    hit(s, h, { dmg: dmg * e.dmgMul, kb, ux: h.x - e.x, uy: h.y - e.y, src: e });
  }
}
function bossBlast(s, e, r, dmg, kb) {
  for (const h of heroList(s).filter(isUnit)) if (dist(h, e) < r + h.r) hit(s, h, { dmg: dmg * e.dmgMul, kb, ux: h.x - e.x, uy: h.y - e.y });
  fxPush(s, { k: 'slam', x: e.x, y: e.y, r, t: 0.7, shake: 14 });
}
function bossPattern(s, e, pat, t, half) {
  const a0 = Math.atan2(t.y - e.y, t.x - e.x);
  const F = (dmg, speed, look) => ({ dmg, speed, look });
  fxPush(s, { k: 'bosscast', x: e.x, y: e.y, t: 0.4 });
  switch (pat) {
    case 'ring': { const n = half ? 22 : 16; for (let i = 0; i < n; i++) enemyShot(s, e, (i / n) * Math.PI * 2 + s.time, F(10, 210, 'eorb')); break; }
    case 'volley': for (let i = -3; i <= 3; i++) enemyShot(s, e, a0 + i * 0.13, F(11, 360, 'ebolt')); break;
    case 'jump': {
      let tx = t.x, ty = t.y;
      if (!safeFloor(s.map, tx, ty, e.r * 0.5)) { const p = randomFloor(s, e.r * 0.5, null, 0, true); tx = p.x; ty = p.y; }
      e.act = { type: 'jump', t: 0.9, T: 0.9, sx: e.x, sy: e.y, tx, ty }; fxPush(s, { k: 'warn', x: tx, y: ty, r: 120, t: 0.9 }); break;
    }
    case 'summon': for (let i = 0; i < (half ? 4 : 3); i++) { const p = randomFloor(s, 14, [e], 60); s.pending.push({ t: 0.6, do: 'spawn', kind: 'slime', x: p.x, y: p.y, scale: { hp: e.dmgMul, dmg: e.dmgMul } }); fxPush(s, { k: 'spawnwarn', x: p.x, y: p.y, t: 0.6 }); } break;
    case 'rain': {
      const tg = heroList(s).filter(isUnit);
      for (let i = 0; i < (half ? 8 : 5); i++) {
        const h = tg[i % Math.max(1, tg.length)] || t;
        s.hazards.push({ x: h.x + rnd(-110, 110), y: h.y + rnd(-110, 110), r: 54, t: 1, dmg: 16 * e.dmgMul, kb: [220, 300] });
      }
      break;
    }
    case 'dash': e.act = { type: 'dash', t: 1.25, go: 0.5, a: a0 }; fxPush(s, { k: 'warnline', x: e.x, y: e.y, a: a0, len: 520, w: e.r * 2, t: 0.75 }); break;
    case 'laser': e.act = { type: 'laser', t: 3, T: 3, a: a0 - 1, spin: half ? 1.1 : 0.8 }; break;
    case 'slam': fxPush(s, { k: 'warn', x: e.x, y: e.y, r: 160, t: 0.9 }); s.hazards.push({ x: e.x, y: e.y, r: 160, t: 0.9, dmg: 24 * e.dmgMul, kb: [300, 420], follow: e.id }); break;
    case 'snowball': { // 커다란 눈덩이를 영웅들 쪽으로 던짐 → 떨어진 자리 빙판
      const tg = heroList(s).filter(isUnit);
      for (let i = 0; i < (half ? 6 : 4); i++) {
        const h = tg[i % Math.max(1, tg.length)] || t;
        s.hazards.push({ x: h.x + rnd(-90, 90), y: h.y + rnd(-90, 90), r: 58, t: 1.1 + i * 0.12, dmg: 14 * e.dmgMul, kb: [230, 300], el: 'ice', ice: 1.6, snow: true });
      }
      break;
    }
    case 'icering': { const n = half ? 18 : 14; for (let i = 0; i < n; i++) enemyShot(s, e, (i / n) * Math.PI * 2 + s.time, { dmg: 9, speed: 230, look: 'shard', el: 'ice', ice: 0.9 }); break; }
    case 'summonsnow': for (let i = 0; i < 2; i++) { const p = randomFloor(s, 14, [e], 80); s.pending.push({ t: 0.7, do: 'spawn', kind: 'frostwisp', x: p.x, y: p.y, scale: { hp: e.dmgMul, dmg: e.dmgMul } }); fxPush(s, { k: 'spawnwarn', x: p.x, y: p.y, t: 0.7 }); } break;
    case 'stomp': { // 몸통: 영웅 쪽으로 뛰어올라 짓밟음
      let tx = t.x + t.kvx * 0.3, ty = t.y + t.kvy * 0.3;
      if (!safeFloor(s.map, tx, ty, e.r * 0.5)) { tx = t.x; ty = t.y; }
      if (!safeFloor(s.map, tx, ty, e.r * 0.5)) { const p = randomFloor(s, e.r * 0.5, null, 0, true); tx = p.x; ty = p.y; }
      const T = half ? 0.75 : 0.9;
      e.act = { type: 'jump', t: T, T, sx: e.x, sy: e.y, tx, ty, r: 100, dmg: 24, kb: [280, 380], ice: 1.5 };
      fxPush(s, { k: 'warn', x: tx, y: ty, r: 100, t: T });
      break;
    }
    case 'drill': { // 영웅들 발밑에 구멍 (3x3, 반피 이하면 5칸 십자 더)
      const idx = [];
      for (const h of heroList(s).filter(isUnit).slice(0, 4)) {
        const tx = Math.floor(h.x / TILE), ty = Math.floor(h.y / TILE);
        for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) idx.push((ty + oy) * COLS + tx + ox);
        if (half) for (const [ox, oy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) idx.push((ty + oy) * COLS + tx + ox);
      }
      digHoles(s, idx.filter((i) => i >= 0 && i < COLS * ROWS), 1.3, half ? 8 : 6.5);
      say(s, '⚠ 발밑이 꺼진다!', 1.2);
      break;
    }
    case 'fissure': { // 보스에서 대상 쪽으로 땅이 갈라짐
      const idx = [], ux = Math.cos(a0), uy = Math.sin(a0);
      for (let d = e.r + 10; d < 15 * TILE; d += TILE / 2) {
        const x = e.x + ux * d, y = e.y + uy * d;
        for (const w of half ? [-1, 0, 1] : [-0.5, 0.5]) {
          const tx = Math.floor((x - uy * w * TILE) / TILE), ty = Math.floor((y + ux * w * TILE) / TILE);
          if (tx >= 0 && ty >= 0 && tx < COLS && ty < ROWS) idx.push(ty * COLS + tx);
        }
      }
      digHoles(s, idx, 1.1, 6);
      break;
    }
    default:
  }
}
function updateHazards(s, dt) {
  for (const z of s.hazards) {
    z.t -= dt;
    if (z.follow) { const e = s.enemies.find((u) => u.id === z.follow); if (e) { z.x = e.x; z.y = e.y; } }
    if (z.t <= 0) {
      for (const h of heroList(s).filter(isUnit)) if (Math.hypot(h.x - z.x, h.y - z.y) < z.r + h.r) hit(s, h, { dmg: z.dmg, kb: z.kb, ux: h.x - z.x || 1, uy: h.y - z.y, el: z.el });
      fxPush(s, { k: z.ice ? 'snowburst' : 'slam', x: z.x, y: z.y, r: z.r, t: 0.5, shake: 6 });
      if (z.ice) makeIce(s, z.x, z.y, z.ice);
    }
  }
  s.hazards = s.hazards.filter((z) => z.t > 0);
}

// ============================================================
//  빙판 · 아군 꼬마 눈사람
// ============================================================
function onIce(s, u) {
  if (!s.ice.size) return false;
  const i = Math.floor(u.y / TILE) * COLS + Math.floor(u.x / TILE);
  return s.ice.has(i);
}
// (x, y) 둘레 r칸을 얼림 (바닥 칸만)
function makeIce(s, x, y, r, time = ICE.time) {
  const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE), R = Math.ceil(r);
  for (let oy = -R; oy <= R; oy++) for (let ox = -R; ox <= R; ox++) {
    if (ox * ox + oy * oy > r * r + 0.3) continue;
    const nx = tx + ox, ny = ty + oy;
    if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
    const c = s.map.tiles[ny][nx];
    if (c === 'o' || c === '#') continue;
    const i = ny * COLS + nx;
    s.ice.set(i, Math.max(s.ice.get(i) || 0, time));
  }
}
function updateIce(s, dt) {
  if (!s.ice.size) return;
  for (const [i, t] of s.ice) {
    const nt = t - dt;
    if (nt <= 0 || tileI(s, i) === 'o') s.ice.delete(i); else s.ice.set(i, nt);
  }
}
function addAlly(s, h) {
  if (s.allies.some((a) => a.owner === h.id)) return;
  s.allies.push({ id: s.nextId++, kind: 'ally', owner: h.id, team: h.team, x: h.x - 24, y: h.y + 10, r: ALLY.minisnow.r, face: 0, throwT: rnd(0, 1), color: h.color, aimD: 200 });
}
function updateAllies(s, dt) {
  const A = ALLY.minisnow;
  for (const a of s.allies) {
    const h = s.heroes[a.owner];
    if (!h) continue;
    // 주인 곁으로 (공허 위는 건너뛰지 않음: 멀어지면 순간 이동)
    const side = (a.id % 2 ? 1 : -1);
    const gx = h.x + side * 30, gy = h.y + 16;
    const dx = gx - a.x, dy = gy - a.y, d = Math.hypot(dx, dy);
    if (d > 260 || !h.alive) { if (h.alive && safeFloor(s.map, gx, gy, a.r)) { a.x = gx; a.y = gy; } }
    else if (d > 6) {
      const sp = Math.min(A.speed, d * 4) * dt;
      const nx = a.x + (dx / d) * sp, ny = a.y + (dy / d) * sp;
      if (!circleInWall(s.map, nx, ny, a.r) && tileAt(s.map, nx, ny) !== 'o') { a.x = nx; a.y = ny; }
      else if (safeFloor(s.map, gx, gy, a.r) && d > 90) { a.x = gx; a.y = gy; }
    }
    // 가까운 적에게 눈덩이
    a.throwT -= dt;
    const t = foesOf(s, a.team).filter((e) => dist(e, a) < A.range && !e.spawning).sort((x, y) => dist(x, a) - dist(y, a))[0];
    if (t) a.face = Math.atan2(t.y - a.y, t.x - a.x);
    if (t && a.throwT <= 0 && h.alive) {
      a.throwT = A.every;
      const S = { ...A.shot, dmg: A.shot.dmg * (1 + (s.story?.ch || 0) * 0.5) };
      spawnShot(s, a, S, a.face + rnd(-0.05, 0.05));
      fxPush(s, { k: 'allythrow', x: a.x, y: a.y, a: a.face, t: 0.2 });
    }
  }
}
// 보스 체력 막대: [보스 종류, 남은 체력(분열·분리될 몫 포함), 전체]
function bossBar(s) {
  const bs = s.enemies.filter((e) => e.boss && !e.dead);
  if (!bs.length) return null;
  const main = bs.find((e) => !BOSSES[e.boss].part) || bs[0];
  const key = BOSSES[main.boss].part ? 'snowman' : main.boss;
  return [key, Math.ceil(bs.reduce((a, e) => a + Math.max(0, e.hp) + (e.future || 0), 0)), Math.round(main.pool || main.maxHp)];
}
// 눈보라 대왕: 절반 이하 → 몸통 + 머리로 분리
function snowSplit(s, e) {
  e.split = true; e.dead = true;
  const rest = Math.max(1, e.hp);
  const mk = (key, dx, share) => {
    const c = makeBoss(s, key, e.x + dx, e.y, { hp: 1, dmg: e.dmgMul });
    c.maxHp = c.hp = Math.round(rest * share); c.pool = e.pool; c.dmgMul = e.dmgMul; c.inv = 0.8; c.patT = 1.4;
    return c;
  };
  const body = mk('snowbody', -10, 0.55), head = mk('snowhead', 0, 0.45);
  head.y -= 40; head.kvx = 380; head.kvy = -60; head.roll = 0; head.dir = Math.random() * Math.PI * 2;
  s.enemies.push(body, head);
  fxPush(s, { k: 'bosssplit', x: e.x, y: e.y - 30, color: '#e1f5fe', snow: true, t: 1, shake: 14 });
  say(s, '눈보라 대왕이 둘로 갈라졌다! 몸통은 짓밟고, 머리는 굴러다니며 냉기를 뿜는다!', 2.6);
}
// 머리: 굴러다니며 앞으로 냉기 → 지나간 자리·뿜은 자리가 빙판
function updateSnowHead(s, e, dt) {
  const B = BOSSES.snowhead;
  const t = nearestHero(s, e);
  e.breathT = (e.breathT || 0) - dt;
  if (t && !frozenOrStunned(e)) {
    // 대상 주위를 빙글 돌듯이 굴러감 (가끔 방향을 확 꺾음)
    const to = Math.atan2(t.y - e.y, t.x - e.x);
    e.turnT = (e.turnT || 0) - dt;
    if (e.turnT <= 0) { e.turnT = rnd(1.2, 2.2); e.orbit = (Math.random() < 0.5 ? -1 : 1) * rnd(0.6, 1.1); }
    const want = to + (dist(t, e) < 140 ? e.orbit * 1.4 : e.orbit * 0.5);
    let da = want - e.dir; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
    e.dir += clamp(da, -2.6 * dt, 2.6 * dt);
  }
  const sp = B.speed * speedMul(e) * (e.hp < e.maxHp / 2 ? 1.25 : 1);
  const x0 = e.x, y0 = e.y;
  moveBody(s, e, Math.cos(e.dir) * sp, Math.sin(e.dir) * sp, dt);
  const moved = Math.hypot(e.x - x0, e.y - y0);
  if (moved < sp * dt * 0.3) e.dir += Math.PI * rnd(0.6, 1.4); // 벽에 부딪히면 튕김
  e.roll = (e.roll || 0) + moved / e.r;
  e.face = e.dir;
  contactBoss(s, e, B.touch, [220, 300]);
  // 냉기 뿜기 (앞쪽 부채꼴)
  e.act = { type: 'breath', a: e.dir, t: 1 };
  if (e.breathT <= 0) {
    e.breathT = 0.16;
    const L = 120;
    for (let d = 30; d <= L; d += 30) makeIce(s, e.x + Math.cos(e.dir) * d, e.y + Math.sin(e.dir) * d, 0.5 + d / 200, 6);
    for (const h of heroList(s).filter(isUnit)) {
      const rx = h.x - e.x, ry = h.y - e.y, along = rx * Math.cos(e.dir) + ry * Math.sin(e.dir);
      if (along < 0 || along > L + h.r || Math.abs(rx * Math.sin(e.dir) - ry * Math.cos(e.dir)) > 26 + along * 0.35 || (h.breathHitT || 0) > s.time) continue;
      h.breathHitT = s.time + 0.45;
      hit(s, h, { dmg: 4 * e.dmgMul, kb: [90, 110], el: 'ice', ux: Math.cos(e.dir), uy: Math.sin(e.dir) });
    }
  }
}

// ============================================================
//  스토리 모드
// ============================================================
export function startStage(s, ch, st) {
  const boss = st === STAGES_PER_CHAPTER - 1;
  const gen = genStoryMap(ch, boss); // 벽·구덩이·가시 무작위
  s.map = parseMap(gen.rows);
  s.stageN = (s.stageN || 0) + 1;
  s.mapKey = `${boss ? 'B' : 'S'}${s.stageN}-${ch}`;
  s.story = { ch, st, boss, wave: -1, phase: 'intro', t: 1.4, chest: null, portal: null, cleared: false, totalWaves: boss ? 1 : 3, time: 0 };
  initShift(s, boss ? STORY.bossCollapseAt : STORY.collapseAt, STORY.collapseEvery);
  Object.assign(s, { enemies: [], shots: [], zones: [], hazards: [], pending: [], items: [], flow: null, flowT: 0, ice: new Map() });
  for (const h of heroList(s)) {
    if (h.out || !h.alive) { h.out = false; h.alive = true; h.stocks = Math.max(1, h.stocks); h.pct = 0; }
    placeHero(s, h);
    h.st = {}; h.inv = 1.2; h.chan = null; h.dash = null; h.snipe = null; h.roll = null; h.fall = 0; h.respawn = 0;
    h.shield = h.shieldMax; h.ivx = h.ivy = 0;
  }
  // 4장: 꼬마 눈사람이 영웅마다 하나씩
  s.allies = [];
  if (CHAPTERS[ch].ally) for (const h of heroList(s)) addAlly(s, h);
  say(s, `${ch + 1}-${st + 1} ${CHAPTERS[ch].name}${boss ? ' · 보스' : ''}`, 1.6);
}
function spawnWave(s) {
  const S = s.story, CH = CHAPTERS[S.ch];
  const scale = { hp: STORY.hpScale(S.ch, S.st) * (1 + 0.35 * (Object.keys(s.heroes).length - 1)), dmg: STORY.dmgScale(S.ch, S.st) };
  if (S.boss) {
    const p = { x: VIEW_CENTER.x + 160, y: VIEW_CENTER.y };
    fxPush(s, { k: 'spawnwarn', x: p.x, y: p.y, big: true, t: 0.9 });
    s.enemies.push(Object.assign(makeBoss(s, CH.boss, p.x, p.y, scale), { spawning: true, inv: 1.2 }));
    s.pending.push({ t: 0.9, do: 'fn', fn: () => { const b = s.enemies.find((e) => e.boss); if (b) b.spawning = false; } });
    say(s, BOSSES[CH.boss].name, 2);
    return;
  }
  const list = [...CH.waves[S.wave]];
  for (let i = 0; i < STORY.countAdd(S.ch, S.st); i++) list.push(CH.waves[S.wave][i % CH.waves[S.wave].length]);
  const heroes = heroList(s);
  list.forEach((kind, i) => {
    const p = randomFloor(s, ENEMIES[kind].r, heroes, 170);
    s.pending.push({ t: 0.55 + i * 0.12, do: 'spawn', kind, x: p.x, y: p.y, scale });
    fxPush(s, { k: 'spawnwarn', x: p.x, y: p.y, t: 0.55 + i * 0.12 });
  });
}
function nextStage(s) {
  const S = s.story;
  if (S.st + 1 < STAGES_PER_CHAPTER) startStage(s, S.ch, S.st + 1);
  else if (S.ch + 1 < CHAPTERS.length) {
    // 장이 끝나면 쉬지 않고 다음 장으로 (소울나이트처럼 한 판에 끝까지). 보상: % 회복 + 목숨 +1
    for (const h of heroList(s)) { h.pct = 0; h.stocks = Math.min(STORY.maxLives, h.stocks + 1); }
    startStage(s, S.ch + 1, 0);
    fxPush(s, { k: 'chapter', ch: S.ch + 1, name: CHAPTERS[S.ch + 1].name, t: 2.5 });
    say(s, `${S.ch + 2}장 「${CHAPTERS[S.ch + 1].name}」 — 목숨 +1, % 회복`, 2.6);
  } else { S.phase = 'done'; S.t = 99; say(s, '모든 장을 돌파했다!', 99); }
}
function updateStory(s, dt) {
  const S = s.story;
  const heroes = heroList(s);
  if (S.phase === 'fail' || S.phase === 'done') { S.t -= dt; return; }
  if (heroes.length && heroes.every((h) => h.out)) { S.phase = 'fail'; S.t = 99; say(s, '전멸… 다시 도전!', 99); return; }
  S.t -= dt;
  S.time += dt;
  updateMapEvents(s, dt, S.phase === 'fight');
  if (S.phase === 'intro') { if (S.t <= 0) { S.phase = 'fight'; S.wave = 0; spawnWave(s); } return; }
  if (S.phase === 'fight') {
    const alive = s.enemies.filter((e) => !e.dead).length + s.pending.filter((q) => q.do === 'spawn').length;
    if (alive > 0) return;
    if (S.wave + 1 < S.totalWaves) { S.wave++; spawnWave(s); return; }
    S.phase = 'clear'; S.cleared = true;
    raiseCore(s);
    s.hazards = [];
    S.chest = { x: VIEW_CENTER.x, y: VIEW_CENTER.y + 90, open: false, big: S.boss };
    fxPush(s, { k: 'chestdrop', x: S.chest.x, y: S.chest.y, t: 0.6 });
    // 가운데 바닥에서 거대한 문이 솟아오름 (증강을 다 고르면 빛이 나며 열림)
    const last = S.ch === CHAPTERS.length - 1 && S.st === STAGES_PER_CHAPTER - 1;
    S.portal = { x: VIEW_CENTER.x, y: VIEW_CENTER.y + 14, rise: 0, open: false, last, tier: AUG_STAGES[`${S.ch}-${S.st}`] || 0 };
    fxPush(s, { k: 'portalrise', x: S.portal.x, y: S.portal.y, t: 1.6, shake: 8 });
    say(s, S.boss ? '보스 처치! 바닥에서 문이 솟아오른다' : '스테이지 클리어! 바닥에서 문이 솟아오른다', 2);
    return;
  }
  if (S.phase === 'clear') {
    const c = S.chest;
    if (!c.open && heroes.some((h) => isUnit(h) && dist(h, c) < 40)) {
      c.open = true;
      giveGold(s, S.boss ? STORY.bossGold(S.ch) : STORY.chestGold(S.ch, S.st), c.x, c.y - 10);
      const n = (S.boss ? 4 : 2) + Math.floor(Math.random() * 2);
      for (let i = 0; i < n; i++) { const a = Math.PI / 2 + (i - (n - 1) / 2) * 0.7; dropItem(s, pickWeighted(CHEST_LOOT), c.x, c.y + 6, Math.cos(a) * 170, Math.sin(a) * 90 + 40); }
      fxPush(s, { k: 'chestopen', x: c.x, y: c.y, big: c.big, t: 1.2, shake: 4 });
    }
    const P = S.portal;
    if (P.rise < 1) {
      P.rise = Math.min(1, P.rise + dt / 1.6);
      // 문이 다 솟으면 증강 (정해진 스테이지만)
      if (P.rise >= 1 && P.tier) {
        for (const h of heroes) h.choiceQ.push(P.tier);
        say(s, P.tier === 2 ? '전설 증강을 고르면 문이 열린다' : '증강을 고르면 문이 열린다', 2);
      }
    }
    const waiting = heroes.some((h) => h.choice || h.choiceQ.length);
    if (!P.open && P.rise >= 1 && !waiting) {
      P.open = true;
      fxPush(s, { k: 'portalopen', x: P.x, y: P.y, t: 1.4, shake: 6 });
      say(s, P.last ? '빛의 문이 열렸다! 들어가면 모험 완료' : '빛의 문이 열렸다! 문 안으로 들어가세요', 2.4);
    }
    if (P.open) {
      const h = heroes.find((u) => isUnit(u) && Math.abs(u.x - P.x) < 26 && u.y > P.y - 26 && u.y < P.y + 12);
      if (h) { S.phase = 'warp'; S.t = 0.8; fxPush(s, { k: 'warp', x: P.x, y: P.y, who: h.id, t: 0.9 }); }
    }
    return;
  }
  if (S.phase === 'warp' && S.t <= 0) nextStage(s);
}

// ============================================================
//  콜로세움 (PvP)
// ============================================================
export function startColosseum(s, arena) {
  const A = COLOSSEUM_ARENAS[arena % COLOSSEUM_ARENAS.length];
  s.map = parseMap(A.rows);
  s.mapKey = `C${arena}`;
  s.colo = { arena, over: false, winner: null, t: 0, name: A.name, itemT: 8, time: 0 };
  initShift(s, COLOSSEUM.collapseAt, COLOSSEUM.collapseEvery);
}
function updateColosseum(s, dt) {
  const C = s.colo;
  if (!C.over) {
    C.time += dt;
    updateMapEvents(s, dt, true);
    C.itemT -= dt;
    if (C.itemT <= 0) {
      C.itemT = COLOSSEUM.itemEvery;
      if (s.items.length < 2) { const p = randomFloor(s, 16, heroList(s), 60, true); dropItem(s, pickWeighted(COLO_LOOT), p.x, p.y, 0, 0); s.items[s.items.length - 1].z = 120; fxPush(s, { k: 'itemdrop', x: p.x, y: p.y, t: 0.6 }); }
    }
    return;
  }
  C.t -= dt;
  if (C.t > 0) return;
  C.over = false; C.winner = null; C.time = 0; C.itemT = 8;
  s.map = parseMap(COLOSSEUM_ARENAS[C.arena % COLOSSEUM_ARENAS.length].rows);
  s.colo.restarts = (C.restarts || 0) + 1;
  s.mapKey = `C${C.arena}.${C.restarts}`;
  initShift(s, COLOSSEUM.collapseAt, COLOSSEUM.collapseEvery);
  Object.assign(s, { shots: [], zones: [], pending: [], hazards: [], items: [] });
  for (const h of heroList(s)) { respawnHero(s, h); h.stocks = COLOSSEUM.stocks; h.cds = [0, 0, 0, 0]; h.kos = 0; h.buf = {}; }
  say(s, '다시 시작!', 1.4);
}

// ---------- 봇 ----------
export function botInput(s, h) {
  const inp = { mx: 0, my: 0, aim: h.aim, ad: 200 };
  const foe = foesOf(s, h.team).sort((a, b) => dist(a, h) - dist(b, h))[0];
  const toCenter = () => { const cx = VIEW_CENTER.x - h.x, cy = VIEW_CENTER.y - h.y, cl = len(cx, cy); return [cx / cl, cy / cl]; };
  if (!foe) { if (tileAt(s.map, h.x, h.y) !== '.') [inp.mx, inp.my] = toCenter(); return inp; }
  const dx = foe.x - h.x, dy = foe.y - h.y, d = len(dx, dy);
  inp.aim = Math.atan2(dy + foe.kvy * 0.12, dx + foe.kvx * 0.12);
  inp.ad = d;
  const C = CHARS[h.char];
  const melee = C.skills[0].type === 'slash';
  const want = melee ? 46 : 240;
  let mx = 0, my = 0;
  if (d > want + 30) { const [px, py] = pathDir(s, h, foe); mx = px; my = py; } else if (d < want - 40) { mx = -dx / d; my = -dy / d; }
  h.botT = (h.botT || rnd(0, 9)) + 1 / 60;
  const w = Math.sin(h.botT * 1.6) * 0.75;
  mx += (-dy / d) * w; my += (dx / d) * w;
  // 공허·가장자리 피하기 (가장자리 근처면 가운데로)
  const ahead = (k) => tileAt(s.map, h.x + mx * k, h.y + my * k);
  const edge = ['o', '#'].includes(ahead(48)) || ['o', '#'].includes(ahead(24)) || tileAt(s.map, h.x, h.y) === '^';
  if (edge) [mx, my] = toCenter();
  inp.mx = mx; inp.my = my;
  const danger = s.shots.some((p) => p.team !== h.team && Math.hypot(p.x - h.x, p.y - h.y) < 90 && (p.vx * (h.x - p.x) + p.vy * (h.y - p.y)) > 0);
  inp.dash = danger && Math.random() < 0.08 && !edge;
  const r = Math.random();
  inp.atk = melee ? d < 80 : d < 520 && r < 0.6;
  inp.s1 = d < 480 && r < 0.025;
  inp.s2 = (melee ? d < 220 : d < 130) && r < 0.04 && !(C.skills[2].type === 'blink');
  inp.s3 = d < 330 && r < 0.01;
  return inp;
}

// ============================================================
//  한 틱
// ============================================================
export function step(s, inputs, dt) {
  s.time += dt;
  s.msgT = Math.max(0, s.msgT - dt);
  for (const h of heroList(s)) updateHero(s, h, h.bot ? botInput(s, h) : (inputs[h.id] || {}), dt);
  s.flowT = (s.flowT || 0) - dt;
  if (s.flowT <= 0) computeFlow(s);
  for (const e of s.enemies) updateEnemy(s, e, dt);
  updateShots(s, dt);
  updateZones(s, dt);
  updateHazards(s, dt);
  updateItems(s, dt);
  updateIce(s, dt);
  updateAllies(s, dt);
  s.enemies = s.enemies.filter((e) => !e.dead);
  if (s.mode === 'story') updateStory(s, dt);
  else updateColosseum(s, dt);
  s.fx = s.fx.filter((f) => s.time - f.born < 0.4);
}

// ---------- 전송용 사본 ----------
const r1 = (v) => Math.round(v * 10) / 10;
const stCode = (u) => {
  let c = '';
  if (u.st.burn) c += 'b'; if (u.st.shock) c += 's'; if (u.st.chill) c += 'c'; if (u.st.frozen > 0) c += 'f';
  if (u.st.wet) c += 'w'; if (u.st.poison) c += 'p' + u.st.poison.n; if (u.st.mark) c += 'm';
  return c;
};
export function snapshot(s) {
  return {
    m: s.mode, mk: s.mapKey, t: r1(s.time), rid: s.runId, g: s.gold, lv: s.level, xp: Math.floor(s.xp), xn: LEVEL.need(s.level),
    mv: s.map.ver, mp: s.map.tiles.map((r) => r.join('')),
    wn: s.warns.map((w) => [r1(w.t), w.T, w.fall, w.rise, w.big ? 1 : 0]),
    h: heroList(s).map((h) => ({
      id: h.id, n: h.name, c: h.char, tm: h.team, col: h.color, x: r1(h.x), y: r1(h.y), a: r1(h.aim),
      p: Math.floor(h.pct), hp_: h.hitPop > 0 ? r1(h.hitPop) : 0, sk: h.stocks, al: h.alive ? 1 : 0, out: h.out ? 1 : 0,
      fa: r1(Math.max(0, h.fall)), iv: h.inv > 0 ? 1 : 0, mv: h.moving ? 1 : 0, sn: h.stun > 0 ? 1 : 0, fl: h.flash > 0 ? 1 : 0,
      ch: h.chan ? 1 : 0, ds: h.dash ? (h.dash.S.look || 1) : 0, ro: h.roll ? 1 : 0, sp: h.snipe ? 1 : 0, em: h.empower > 0 ? 1 : 0, st: stCode(h),
      cd: h.cds.map(r1), cm: [0, 1, 2, 3].map((i) => r1(cdOf(s, h, i))), dc: h.dashCh, dm: h.dashMax, cb: h.combo.n, mc: h.maxCombo, ko: h.kos, rs: r1(Math.max(0, h.respawn)), bot: h.bot ? 1 : 0,
      ln: Math.hypot(h.kvx, h.kvy) > 380 ? 1 : 0, ob: s.mode === 'story' ? h.b.orbs : 0, sz: r1(h.b.size || 0),
      lv: h.lv, sh: h.shieldMax ? [Math.ceil(h.shield), h.shieldMax] : 0,
      bf: Object.keys(h.buf).join(','), au: h.augs, cho: h.choice ? { o: h.choice.opts, tier: h.choice.tier, t: Math.ceil(h.choice.t) } : null,
    })),
    e: s.enemies.map((e) => [e.id, e.type, r1(e.x), r1(e.y), Math.ceil(e.hp), e.maxHp, r1(e.fall), e.flash > 0 ? 1 : 0, r1(e.face), stCode(e), e.spawning ? 1 : 0, r1(e.z || 0), e.boss ? 1 : 0, e.act ? e.act.type : 0, e.act?.a !== undefined ? r1(e.act.a) : 0, Math.hypot(e.kvx, e.kvy) > 380 ? 1 : 0, e.ai === 'shield' ? (shieldUp(e) ? e.mode + 1 : 4) : 0, r1(e.r), e.z2 ? r1(e.z2) : 0]),
    ic: [...s.ice.keys()],
    al: s.allies.map((a) => [a.id, r1(a.x), r1(a.y), r1(a.face), a.color, a.throwT > 0.75 ? 1 : 0]),
    bb: bossBar(s),
    s: s.shots.map((p) => [p.id, p.look, r1(p.x), r1(p.y), r1(Math.atan2(p.vy, p.vx)), p.r, p.el || 0, r1(p.z || 0), p.team === 'E' ? 1 : 0]),
    z: s.zones.map((z) => [z.id, z.look, r1(z.x), r1(z.y), z.r, r1(z.t), r1(z.life)]),
    hz: s.hazards.map((z) => [r1(z.x), r1(z.y), z.r, r1(z.t), z.snow ? 1 : 0]),
    it: s.items.map((it) => [it.id, it.kind, r1(it.x), r1(it.y), r1(it.z), r1(it.t)]),
    fx: s.fx,
    msg: s.msgT > 0 ? s.msg : '',
    sto: s.story ? { ch: s.story.ch, st: s.story.st, ph: s.story.phase, w: s.story.wave, tw: s.story.totalWaves, boss: s.story.boss, chest: s.story.chest, cl: s.story.cleared ? 1 : 0,
      pt: s.story.portal ? [s.story.portal.x, s.story.portal.y, r1(s.story.portal.rise), s.story.portal.open ? 1 : 0, s.story.portal.last ? 1 : 0] : null } : null,
    col: s.colo ? { over: s.colo.over, win: s.colo.winner, wt: s.colo.winTeam, name: s.colo.name } : null,
  };
}
// 테스트·연습용: 적 하나 놓기
export function debugSpawn(s, kind, x, y, hpMul = 1) {
  const e = ENEMIES[kind] ? makeEnemy(s, kind, x, y, { hp: hpMul, dmg: 0 }) : makeBoss(s, kind, x, y, { hp: hpMul, dmg: 0 });
  e.inv = 0;
  s.enemies.push(e);
  return e;
}
export function debugAug(s, id, augId) { const h = s.heroes[id]; if (h) { h.augs.push(augId); recompute(s, h); } }
export function debugXp(s, n) { giveXp(s, n); }
export function debugHit(s, id, dmg) { const e = s.enemies.find((u) => u.id === id); if (e) { e.inv = 0; hit(s, e, { dmg, kb: [0, 0], ux: 1, uy: 0, by: Object.values(s.heroes)[0] }); } }
