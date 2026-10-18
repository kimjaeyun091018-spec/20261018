// ============================================================
//  원소 아레나 — 게임 규칙과 시뮬레이션 (방장이 계산, 화면·네트워크 코드 없음)
// ============================================================
import {
  TILE, COLS, ROWS, KNOCK, FEEL, DASH, ELEMENTS, STATUS, REACTIONS, CLASH, CHARS, ENEMIES, BOSSES,
  CHAPTERS, STAGES_PER_CHAPTER, STORY, TREE, COLOSSEUM, TEAM_COLORS, MAX_PLAYERS,
} from './data.js';
import { STORY_ARENAS, BOSS_ARENA, COLOSSEUM_ARENAS } from './maps.js';

const R_HERO = 12;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const len = (x, y) => Math.hypot(x, y) || 1;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const rnd = (a, b) => a + Math.random() * (b - a);
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return Math.abs(d); };

// ---------- 지도 ----------
function parseMap(rows, theme) {
  const tiles = rows.map((r) => r.split(''));
  const spawns = [];
  tiles.forEach((row, ty) => row.forEach((c, tx) => { if (c === 'P') spawns.push({ x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE }); }));
  return { rows, tiles, spawns, theme };
}
export const tileAt = (map, x, y) => {
  const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return '#';
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
const safeFloor = (map, x, y, r) => !circleInWall(map, x, y, r) && tileAt(map, x, y) !== 'o' && tileAt(map, x, y) !== '^';
function randomFloor(s, r = 14, avoid = null, minD = 0) {
  for (let i = 0; i < 200; i++) {
    const x = rnd(2, COLS - 2) * TILE, y = rnd(2, ROWS - 2) * TILE;
    if (!safeFloor(s.map, x, y, r + 4)) continue;
    if (avoid && avoid.some((a) => Math.hypot(a.x - x, a.y - y) < minD)) continue;
    return { x, y };
  }
  return { x: VIEW_CENTER.x, y: VIEW_CENTER.y };
}
const VIEW_CENTER = { x: COLS * TILE / 2, y: ROWS * TILE / 2 };

// ---------- 상태 만들기 ----------
export function createState(mode, hostId, opt = {}) {
  const s = {
    mode, hostId, time: 0, nextId: 1, runId: Math.floor(Math.random() * 1e9),
    heroes: {}, enemies: [], shots: [], zones: [], hazards: [], pending: [], fx: [],
    msg: '', msgT: 0, gold: 0, map: null,
    story: null, colo: null, opt,
  };
  if (mode === 'story') startStage(s, opt.ch || 0, opt.st || 0);
  else startColosseum(s, opt.arena || 0);
  return s;
}
const fxPush = (s, fx) => { fx.id = s.nextId++; fx.t ??= 0.5; fx.life ??= fx.t; s.fx.push(fx); return fx; };
function say(s, text, t = 2.2) { s.msg = text; s.msgT = t; }

// ---------- 영웅 ----------
export function addHero(s, id, name, char, opt = {}) {
  if (Object.keys(s.heroes).length >= MAX_PLAYERS) return null;
  const C = CHARS[char] ? char : 'knight';
  const slot = opt.slot ?? Object.keys(s.heroes).length;
  const b = s.mode === 'story' ? treeBonus(opt.tree || []) : treeBonus([]);
  const maxHp = Math.round(CHARS[C].hp * (1 + b.hp));
  const h = {
    kind: 'hero', id, name: String(name || '플레이어').slice(0, 10), char: C, bot: !!opt.bot, slot,
    team: s.mode === 'colosseum' ? (opt.team ?? (slot % 2) + 1) : 1, color: TEAM_COLORS[slot % 4],
    x: 0, y: 0, r: R_HERO, kvx: 0, kvy: 0, hp: maxHp, maxHp, pct: 0, weight: CHARS[C].weight,
    aim: 0, aimD: 200, cds: [0, 0, 0, 0], chainI: -1, chainT: 0, dashCh: 1 + b.dashCharge, dashCd: 0, roll: null,
    dash: null, chan: null, snipe: null, empower: 0, stun: 0, inv: 1, hs: 0, flash: 0, st: {}, slowT: 0,
    fall: 0, alive: true, downed: false, reviveT: 0, respawn: 0, stocks: COLOSSEUM.stocks, moving: false,
    combo: { n: 0, t: 0 }, maxCombo: 0, kos: 0, b, lastBy: null, atkT: 0,
  };
  placeHero(s, h);
  s.heroes[id] = h;
  return h;
}
export function removeHero(s, id) { delete s.heroes[id]; }
export function setHeroChar(s, id, char, tree) {
  const h = s.heroes[id];
  if (!h || !CHARS[char]) return;
  h.char = char;
  h.b = s.mode === 'story' ? treeBonus(tree || []) : treeBonus([]);
  h.maxHp = Math.round(CHARS[char].hp * (1 + h.b.hp));
  h.hp = h.maxHp;
  h.weight = CHARS[char].weight;
  h.dashCh = 1 + h.b.dashCharge;
}
function placeHero(s, h) {
  const sp = s.map.spawns[h.slot % s.map.spawns.length];
  h.x = sp.x; h.y = sp.y; h.kvx = h.kvy = 0;
}
export function treeBonus(ids) {
  const b = { atk: 0, hp: 0, cd: 0, dash: 0, crit: 0.05, critDmg: 0.5, react: 0, reactR: 0, leech: 0, armor: 0, gold: 0, combo: 0, dashCharge: 0, kb: 0 };
  for (const id of ids) { const n = TREE.find((t) => t.id === id); if (n) for (const [k, v] of Object.entries(n.bonus)) b[k] += v; }
  return b;
}

// ---------- 대상 ----------
const isUnit = (u) => u && !u.dead && u.fall <= 0 && u.alive !== false && !u.downed;
const foesOf = (s, team) => {
  const out = [];
  for (const h of Object.values(s.heroes)) if (h.team !== team && isUnit(h)) out.push(h);
  for (const e of s.enemies) if (e.team !== team && isUnit(e) && !e.spawning) out.push(e);
  return out;
};
const alliesOf = (s, team) => Object.values(s.heroes).filter((h) => h.team === team && isUnit(h));

// ---------- 피격 (타격감의 중심) ----------
// opt: dmg, kb[base, growth], el, ux, uy, by(때린 영웅), noReact, noStop, tag, pull(중심으로 당김)
function hit(s, t, opt) {
  if (!isUnit(t) || (t.inv > 0 && !opt.dot)) return false;
  const by = opt.by && s.heroes[opt.by.id] === opt.by ? opt.by : opt.by || null;
  let dmg = opt.dmg;
  let crit = false;
  if (by?.kind === 'hero' && s.mode === 'story' && !opt.dot) {
    dmg *= 1 + by.b.atk + (by.b.combo ? Math.min(0.2, Math.floor(by.combo.n / 10) * 0.02) : 0);
    if (by.empower > 0 && opt.basic) { dmg *= CHARS.sniper.skills[2].empower; by.empower = 0; }
    if (Math.random() < by.b.crit) { crit = true; dmg *= 1 + by.b.critDmg; }
    if (opt.react) dmg *= 1 + by.b.react;
  } else if (by?.kind === 'hero' && by.empower > 0 && opt.basic) { dmg *= CHARS.sniper.skills[2].empower; by.empower = 0; }
  if (t.kind === 'hero' && s.mode === 'story') dmg *= 1 - t.b.armor;
  if (t.st.frozen > 0 && !opt.dot) dmg *= 1.15;
  dmg = Math.max(1, Math.round(dmg));
  // 체력 / %
  if (s.mode === 'colosseum' && t.kind === 'hero') t.pct = Math.round((t.pct + dmg * KNOCK.colosseumPct) * 10) / 10;
  else {
    t.hp -= dmg;
    t.pct = clamp((1 - t.hp / t.maxHp) * 100, 0, 200);
  }
  // 넉백
  const kb = opt.kb || [0, 0];
  if (!opt.dot && (kb[0] || kb[1])) {
    let speed = (kb[0] + kb[1] * (t.pct / 100)) / t.weight;
    if (by?.kind === 'hero' && s.mode === 'story') speed *= 1 + by.b.kb;
    if (t.kind === 'hero' && s.mode === 'story') speed *= 1 - t.b.armor;
    if (t.boss) speed *= 0.25;
    const l = len(opt.ux, opt.uy);
    t.kvx = (opt.ux / l) * speed; t.kvy = (opt.uy / l) * speed;
    t.stun = Math.max(t.stun, Math.min(KNOCK.stunMax, Math.abs(speed) * KNOCK.stunPer) * (t.boss ? 0.2 : 1));
    if (t.chan) t.chan = null;
    if (t.snipe) t.snipe = null;
  }
  // 타격감: 히트스톱·번쩍임·흔들림
  if (!opt.dot) {
    const stop = Math.min(FEEL.hitstopMax, FEEL.hitstopBase + dmg * FEEL.hitstopPerDmg);
    t.hs = Math.max(t.hs, stop);
    if (by && !opt.noStop) by.hs = Math.max(by.hs || 0, stop * 0.8);
    t.flash = 0.12;
  }
  fxPush(s, { k: 'hit', x: t.x, y: t.y - 6, v: dmg, crit, el: opt.el || null, big: dmg >= 18 || crit, dot: !!opt.dot, react: opt.react || null, t: 0.75,
    shake: opt.dot ? 0 : Math.min(FEEL.shakeMax, dmg * FEEL.shakePerDmg * (opt.react ? 1.6 : 1)), ux: opt.ux || 0, uy: opt.uy || 0 });
  // 콤보
  if (by?.kind === 'hero' && !opt.dot) {
    by.combo.n = by.combo.t > 0 ? by.combo.n + 1 : 1;
    by.combo.t = 1.6 + (by.b.combo ? 0.6 : 0);
    by.maxCombo = Math.max(by.maxCombo, by.combo.n);
    t.lastBy = by.id;
  }
  if (opt.el && !opt.noReact) applyElement(s, t, opt.el, by);
  // 쓰러짐
  if (t.hp <= 0 && !(s.mode === 'colosseum' && t.kind === 'hero')) {
    if (t.kind === 'hero') downHero(s, t);
    else killEnemy(s, t, by);
  }
  return true;
}

// ---------- 원소 · 반응 ----------
const hasStatus = (t, k) => (k === 'frozen' ? t.st.frozen > 0 : t.st[k] && t.st[k].t > 0);
function applyElement(s, t, el, by) {
  if (!isUnit(t)) return;
  const R = REACTIONS.find((r) => r.el === el && hasStatus(t, r.has) && (!r.self || true));
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
  const hitOpt = (u, dmg, kb) => ({ dmg, kb: kb || R.kb || [0, 0], el: null, ux: u.x - t.x || rnd(-1, 1), uy: u.y - t.y || rnd(-1, 1), by, react: R.id, noReact: true });
  if (R.chain) {
    // 감전 연쇄: 가까운 적에게 차례로 튐
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

// ---------- 이동 (걷기 + 넉백, 벽 튕김, 가시, 구덩이) ----------
function moveBody(s, u, wx, wy, dt) {
  const kSpeed = Math.hypot(u.kvx, u.kvy);
  const flying = kSpeed >= KNOCK.pitSpeed || u.dash || u.roll;
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
          hit(s, u, { dmg: KNOCK.wallHitDmg, kb: [0, 0], ux: 0, uy: 0, noStop: true, dot: false, tag: 'wall' });
          fxPush(s, { k: 'wallhit', x: u.x + (axis ? 0 : Math.sign(kv) * u.r), y: u.y + (axis ? Math.sign(kv) * u.r : 0), t: 0.35, shake: 5 });
        }
        if (axis) u.kvy = -u.kvy * KNOCK.wallBounce; else u.kvx = -u.kvx * KNOCK.wallBounce;
      } else if (axis) u.kvy = 0; else u.kvx = 0;
      continue;
    }
    u.x = nx; u.y = ny;
  }
  const f = Math.exp(-KNOCK.friction * dt);
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
    u.kvx *= 0.2; u.kvy *= 0.2;
    fxPush(s, { k: 'fall', x: u.x, y: u.y, t: 0.6 });
  }
}

// ---------- 상태 이상 진행 ----------
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
const speedMul = (u) => (u.st.chill ? 1 - STATUS.chill.slow : 1) * (u.slowT > 0 ? 0.6 : 1) * (u.st.frozen > 0 ? 0 : 1);

// ---------- 스킬 ----------
function cdOf(s, h, i) { return CHARS[h.char].skills[i].cd * (s.mode === 'story' ? 1 - h.b.cd : 1); }
function useSkill(s, h, i) {
  const C = CHARS[h.char];
  let S = C.skills[i];
  if (h.cds[i] > 0 || frozenOrStunned(h) || h.dash || h.chan || h.snipe || h.roll || h.fall > 0 || !h.alive || h.downed) return;
  h.cds[i] = cdOf(s, h, i);
  h.atkT = 0.18;
  const ux = Math.cos(h.aim), uy = Math.sin(h.aim);
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
        if (h.chainI === S.chain.length - 1) h.cds[i] = cdOf(s, h, i) * 1.8; // 마지막 타 뒤 잠깐 쉼
      }
      // 앞으로 살짝 내딛음 (손맛)
      h.kvx += ux * (big ? 160 : 90); h.kvy += uy * (big ? 160 : 90);
      let any = false;
      for (const t of foesOf(s, h.team)) {
        const dx = t.x - h.x, dy = t.y - h.y;
        if (Math.hypot(dx, dy) > S.range + t.r || angDiff(Math.atan2(dy, dx), h.aim) > S.arc / 2 + 0.25) continue;
        any = hit(s, t, { dmg: S.dmg, kb: S.kb, el: S.el, ux: dx, uy: dy, by: h, basic: i === 0 }) || any;
      }
      fxPush(s, { k: 'slash', x: h.x, y: h.y, a: h.aim, r: S.range, arc: S.arc, el: S.el, char: h.char, big: !!big, flip: h.chainI % 2, t: big ? 0.36 : 0.28, hitAny: any });
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
      const n = S.count || 1;
      if (S.recoil) { h.kvx -= ux * S.recoil; h.kvy -= uy * S.recoil; }
      for (let k = 0; k < n; k++) {
        const a = h.aim + (n > 1 ? (k / (n - 1) - 0.5) * S.spread : 0);
        spawnShot(s, h, S, a, i === 0);
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
        if (ok && S.leech) { if (s.mode === 'colosseum') h.pct = Math.max(0, h.pct - S.leech); else h.hp = Math.min(h.maxHp, h.hp + S.leech); fxPush(s, { k: 'soul', x: t.x, y: t.y, x2: h.x, y2: h.y, t: 0.5 }); }
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
    id: s.nextId++, owner: src.id, team: src.team, el: S.el || null, look: S.look, basic,
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
      hit(s, t, { dmg: p.explode.dmg, kb: p.explode.kb, el: p.el, ux: t.x - p.x, uy: t.y - p.y, by });
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
      // 방패병: 앞에서 오는 투사체 막기
      if (t.ai === 'shield' && angDiff(Math.atan2(-p.vy, -p.vx), t.face) < 1.0 && !p.pull) {
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
        hit(s, t, { dmg: p.dmg, kb: [0, 0], el: p.el, ux: dx, uy: dy, by, noStop: true });
      } else hit(s, t, { dmg: p.dmg, kb: p.kb, el: p.el, ux: p.vx, uy: p.vy, by, basic: p.basic });
      if (p.explode) { p.life = 0; shotLanded(s, p); break; }
      if (p.pierce > 0) p.pierce--; else { p.life = 0; fxPush(s, { k: 'shotend', x: p.x, y: p.y, el: p.el, look: p.look, t: 0.25 }); break; }
    }
  }
  // 원소 충돌: 다른 편끼리 맞부딪히면 힘 비교, 다른 원소면 충돌 폭발
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
        for (const u of [...Object.values(s.heroes), ...s.enemies].filter(isUnit)) {
          if (Math.hypot(u.x - mx, u.y - my) > CLASH.burst.r + u.r) continue;
          hit(s, u, { dmg: CLASH.burst.dmg, kb: CLASH.burst.kb, ux: u.x - mx || 1, uy: u.y - my, noStop: true });
        }
        fxPush(s, { k: 'clashboom', x: mx, y: my, e1: a.el, e2: b.el, r: CLASH.burst.r, t: 0.5, shake: 7 });
      } else fxPush(s, { k: 'clash', x: mx, y: my, e1: a.el, e2: b.el, t: 0.2 });
    }
  }
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
        if (s.mode === 'colosseum') h.pct = Math.max(0, h.pct - z.S.heal * 0.5);
        else h.hp = Math.min(h.maxHp, h.hp + z.S.heal);
        h.pct = s.mode === 'colosseum' ? h.pct : clamp((1 - h.hp / h.maxHp) * 100, 0, 200);
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
  // 예약: 대지 가시, 처형 표식, 적 소환
  for (const q of s.pending) q.t -= dt;
  const due = s.pending.filter((q) => q.t <= 0);
  s.pending = s.pending.filter((q) => q.t > 0);
  for (const q of due) {
    if (q.do === 'spike') {
      if (circleInWall(s.map, q.x, q.y, 4)) continue;
      const by = s.heroes[q.owner] || null;
      for (const t of foesOf(s, q.team)) if (Math.hypot(t.x - q.x, t.y - q.y) < q.S.r + t.r) hit(s, t, { dmg: q.S.dmg, kb: q.S.kb, el: q.S.el, ux: Math.cos(q.a) * 0.6 + (t.x - q.x) / 40, uy: Math.sin(q.a) * 0.6 + (t.y - q.y) / 40, by });
      fxPush(s, { k: 'pillar', x: q.x, y: q.y, r: q.S.r, look: q.S.look, el: q.S.el, t: 0.7, shake: 3 });
    } else if (q.do === 'bolt') {
      const by = s.heroes[q.owner] || null;
      for (const t of foesOf(s, q.team)) if (Math.hypot(t.x - q.x, t.y - q.y) < q.S.r + t.r) hit(s, t, { dmg: q.S.dmg, kb: q.S.kb, el: q.S.el, ux: t.x - q.x || 1, uy: t.y - q.y, by });
      fxPush(s, { k: 'thunder', x: q.x, y: q.y, r: q.S.r, t: 0.5, shake: 5 });
    } else if (q.do === 'execute') {
      const by = s.heroes[q.owner] || null;
      for (const id of q.ids) {
        const t = [...s.enemies, ...Object.values(s.heroes)].find((u) => u.id === id);
        if (!isUnit(t)) continue;
        hit(s, t, { dmg: q.S.dmg, kb: q.S.kb, el: q.S.el, ux: rnd(-1, 1), uy: -1, by });
        fxPush(s, { k: 'execute', x: t.x, y: t.y, t: 0.6, shake: 6 });
      }
    } else if (q.do === 'fn') {
      q.fn();
    } else if (q.do === 'spawn') {
      const e = makeEnemy(s, q.kind, q.x, q.y, q.scale);
      s.enemies.push(e);
    }
  }
}

// ---------- 영웅 한 틱 ----------
function updateHero(s, h, inp, dt) {
  h.cds = h.cds.map((c) => Math.max(0, c - dt));
  h.inv = Math.max(0, h.inv - dt);
  h.flash = Math.max(0, h.flash - dt);
  h.atkT = Math.max(0, h.atkT - dt);
  h.combo.t = Math.max(0, h.combo.t - dt);
  if (h.combo.t <= 0) h.combo.n = 0;
  h.chainT = Math.max(0, h.chainT - dt);
  h.empower = Math.max(0, h.empower - dt);
  h.slowT = Math.max(0, h.slowT - dt);
  // 대시 충전
  const dashMax = 1 + h.b.dashCharge;
  if (h.dashCh < dashMax) { h.dashCd -= dt; if (h.dashCd <= 0) { h.dashCh++; h.dashCd = DASH.cd * (1 - h.b.dash); } }
  if (!h.alive) {
    h.respawn -= dt;
    if (h.respawn <= 0 && s.mode === 'colosseum' && h.stocks > 0 && !s.colo.over) respawnHero(s, h);
    return;
  }
  if (h.downed) return;
  if (h.fall > 0) { h.fall -= dt; if (h.fall <= 0) heroFell(s, h); return; }
  updateStatus(s, h, dt);
  if (!isUnit(h)) return;
  if (h.hs > 0) { h.hs -= dt; return; } // 히트스톱: 잠깐 멈춤
  h.stun = Math.max(0, h.stun - dt);
  if (Number.isFinite(inp.aim)) h.aim = inp.aim;
  if (Number.isFinite(inp.ad)) h.aimD = inp.ad;
  const C = CHARS[h.char];
  // 돌진 베기
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
  // 구르기 대시
  if (h.roll) {
    h.roll.t -= dt;
    moveBody(s, h, h.roll.vx, h.roll.vy, dt);
    if (h.roll.t <= 0) h.roll = null;
    return;
  }
  // 저격 조준 중
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
    return;
  }
  const speed = frozenOrStunned(h) ? 0 : C.speed * speedMul(h) * (h.chan ? h.chan.S.slow : 1);
  h.moving = ml > 0.1 && speed > 0;
  moveBody(s, h, mx * speed, my * speed, dt);
  if (h.fall > 0 || frozenOrStunned(h)) return;
  if (inp.atk) useSkill(s, h, 0);
  if (inp.s1) useSkill(s, h, 1);
  if (inp.s2) useSkill(s, h, 2);
  if (inp.s3) useSkill(s, h, 3);
}
function fireSnipe(s, h, sn) {
  const S = sn.S, ux = Math.cos(sn.a), uy = Math.sin(sn.a);
  // 벽까지 길이
  let L = S.len;
  for (let d = 0; d < S.len; d += 8) if (circleInWall(s.map, h.x + ux * d, h.y + uy * d, 2)) { L = d; break; }
  for (const t of foesOf(s, h.team)) {
    const rx = t.x - h.x, ry = t.y - h.y, along = rx * ux + ry * uy;
    if (along < 0 || along > L) continue;
    if (Math.abs(rx * uy - ry * ux) > S.width + t.r) continue;
    hit(s, t, { dmg: S.dmg, kb: S.kb, el: S.el, ux, uy, by: h });
  }
  h.kvx -= ux * 220; h.kvy -= uy * 220; // 반동
  fxPush(s, { k: 'beam', x: h.x, y: h.y, a: sn.a, len: L, t: 0.35, shake: 6 });
}
function heroFell(s, h) {
  const by = h.lastBy && s.heroes[h.lastBy];
  if (s.mode === 'colosseum') {
    h.alive = false; h.respawn = COLOSSEUM.respawn; h.stocks--;
    if (by && by !== h) by.kos++;
    fxPush(s, { k: 'ko', x: h.x, y: h.y, color: h.color, t: 1.2, shake: 12 });
    say(s, `${h.name} 링아웃! (남은 목숨 ${h.stocks})`, 1.8);
    const teamsAlive = new Set(Object.values(s.heroes).filter((o) => o.stocks > 0).map((o) => o.team));
    if (teamsAlive.size <= 1) {
      const win = [...teamsAlive][0];
      const names = Object.values(s.heroes).filter((o) => o.team === win).map((o) => o.name).join(', ');
      s.colo.over = true; s.colo.t = COLOSSEUM.restart; s.colo.winner = names || '무승부';
      say(s, `${names} 승리!`, COLOSSEUM.restart);
    }
  } else {
    // 스토리: 최대 체력 일부를 잃고 안전한 곳에서 다시
    h.hp -= Math.round(h.maxHp * STORY.fallDmg);
    const p = randomFloor(s, 16, Object.values(s.heroes), 0);
    h.x = p.x; h.y = p.y; h.kvx = h.kvy = 0; h.inv = 1.2;
    h.pct = clamp((1 - h.hp / h.maxHp) * 100, 0, 200);
    if (h.hp <= 0) downHero(s, h);
  }
}
function respawnHero(s, h) {
  placeHero(s, h);
  Object.assign(h, { alive: true, pct: 0, inv: 1.5, stun: 0, dash: null, chan: null, snipe: null, roll: null, fall: 0, st: {}, lastBy: null });
}
function downHero(s, h) {
  h.hp = 0; h.downed = true; h.reviveT = 0; h.chan = null; h.dash = null; h.snipe = null;
  fxPush(s, { k: 'down', x: h.x, y: h.y, t: 0.8, shake: 8 });
  say(s, `${h.name} 쓰러짐! 옆에 서 있으면 부활`, 2);
}

// ---------- 적 ----------
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
  return {
    kind: 'enemy', boss: key, type: key, ai: 'boss', id: s.nextId++, team: 'E', x, y, r: B.r, kvx: 0, kvy: 0, hp, maxHp: hp, pct: 0, weight: B.weight,
    stun: 0, inv: 0.5, hs: 0, flash: 0, st: {}, fall: 0, dead: false, cd: 0, face: 0, t: 0, dmgMul: scale.dmg, slowT: 0, patT: 2, patI: 0, act: null,
  };
}
function killEnemy(s, e, by) {
  if (e.dead) return;
  e.dead = true;
  const E = e.boss ? null : ENEMIES[e.type];
  fxPush(s, { k: 'die', x: e.x, y: e.y, type: e.type, boss: !!e.boss, t: e.boss ? 1.6 : 0.8, shake: e.boss ? 16 : 3 });
  if (s.mode === 'story') {
    const g = e.boss ? 0 : E.gold;
    if (g) giveGold(s, g, e.x, e.y);
    for (const h of Object.values(s.heroes)) if (h.b.leech && isUnit(h)) h.hp = Math.min(h.maxHp, h.hp + h.b.leech);
  }
}
function giveGold(s, n, x, y) {
  const mul = 1 + Math.max(0, ...Object.values(s.heroes).map((h) => h.b.gold));
  const v = Math.round(n * mul);
  s.gold += v;
  fxPush(s, { k: 'gold', x, y, v, t: 0.9 });
}
// ---------- 길찾기: 영웅들 위치에서 퍼지는 거리 지도 (벽·구덩이 돌아가기) ----------
function computeFlow(s) {
  const N = COLS * ROWS, d = new Int16Array(N).fill(-1), q = [];
  for (const h of Object.values(s.heroes)) {
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
    const c = tileAt(s.map, x, y);
    if (c === 'o' || circleInWall(s.map, x, y, r * 0.8)) return false;
  }
  return true;
}
// 대상까지 갈 방향 (보이면 곧장, 막혔으면 거리 지도를 따라 돌아감)
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
    if (ox && oy && (s.flow[ty * COLS + nx] < 0 || s.flow[ny * COLS + tx] < 0)) continue; // 모서리 끼임 방지
    if (v < bd) { bd = v; best = [nx, ny]; }
  }
  if (!best) return [dx / l, dy / l];
  const gx = (best[0] + 0.5) * TILE - u.x, gy = (best[1] + 0.5) * TILE - u.y, gl = len(gx, gy);
  return [gx / gl, gy / gl];
}
const nearestHero = (s, e) => Object.values(s.heroes).filter(isUnit).sort((a, b) => dist(a, e) - dist(b, e))[0];
function enemyShot(s, e, a, F) {
  const S = { speed: F.speed, r: 7, power: 1, dmg: F.dmg * e.dmgMul, kb: [120, 160], life: 3, look: F.look, home: F.home || 0 };
  return spawnShot(s, e, S, a);
}
function contact(s, e, t, dmg, kb) {
  if (e.cd > 0 || !t || dist(e, t) > e.r + t.r + 3 || t.inv > 0) return;
  hit(s, t, { dmg: dmg * e.dmgMul, kb, ux: t.x - e.x, uy: t.y - e.y });
  e.cd = 1;
}
function updateEnemy(s, e, dt) {
  e.flash = Math.max(0, e.flash - dt);
  e.inv = Math.max(0, e.inv - dt);
  e.slowT = Math.max(0, e.slowT - dt);
  if (e.fall > 0) { e.fall -= dt; if (e.fall <= 0) { if (s.mode === 'story') giveGold(s, 1, e.x, e.y); killEnemy(s, e, s.heroes[e.lastBy]); } return; }
  updateStatus(s, e, dt);
  if (e.dead) return;
  if (e.hs > 0) { e.hs -= dt; return; }
  e.stun = Math.max(0, e.stun - dt);
  e.cd = Math.max(0, e.cd - dt);
  e.t += dt;
  if (e.ai === 'boss') { updateBoss(s, e, dt); return; }
  const E = ENEMIES[e.type];
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
            for (const u of [...Object.values(s.heroes)].filter(isUnit)) if (dist(u, e) < E.boom.r + u.r) hit(s, u, { dmg: E.boom.dmg * e.dmgMul, kb: E.boom.kb, ux: u.x - e.x, uy: u.y - e.y });
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
            for (const u of Object.values(s.heroes).filter(isUnit)) if (dist(u, e) < E.slam.r + u.r) hit(s, u, { dmg: E.slam.dmg * e.dmgMul, kb: E.slam.kb, ux: u.x - e.x, uy: u.y - e.y });
            fxPush(s, { k: 'slam', x: e.x, y: e.y, r: E.slam.r, t: 0.6, shake: 10 });
          }
        } else {
          wx = ux * sp; wy = uy * sp;
          contact(s, e, t, E.touch, E.kb);
          e.modeT -= dt;
          if (d < 110 && e.modeT <= 0) { e.modeT = E.slam.every; e.slamT = E.slam.warn; fxPush(s, { k: 'warn', x: e.x, y: e.y, r: E.slam.r, t: E.slam.warn }); }
        }
        break;
      case 'shield':
        wx = ux * sp; wy = uy * sp;
        contact(s, e, t, E.touch, E.kb);
        break;
      case 'totem':
        if (e.cd <= 0) { e.cd = E.fire.every; e.spin = (e.spin || 0) + 0.5; for (let k = 0; k < 3; k++) enemyShot(s, e, e.spin + (k * Math.PI * 2) / 3, E.fire); }
        break;
      default:
    }
  }
  moveBody(s, e, wx, wy, dt);
}

// ---------- 보스 ----------
function updateBoss(s, e, dt) {
  const B = BOSSES[e.boss];
  const t = nearestHero(s, e);
  const half = e.hp < e.maxHp / 2;
  let wx = 0, wy = 0;
  if (e.act) {
    const A = e.act;
    A.t -= dt;
    if (A.type === 'jump') {
      const k = 1 - A.t / A.T;
      e.x = A.sx + (A.tx - A.sx) * k; e.y = A.sy + (A.ty - A.sy) * k; e.z = Math.sin(Math.PI * k) * 90;
      if (A.t <= 0) { e.z = 0; bossBlast(s, e, 120, 26, [260, 360]); }
    } else if (A.type === 'dash') {
      if (A.t > A.go) { /* 경고 중 */ } else { wx = Math.cos(A.a) * 520; wy = Math.sin(A.a) * 520; contactBoss(s, e, 22, [280, 380]); }
    } else if (A.type === 'laser') {
      A.a += A.spin * dt;
      if (A.t < A.T - 0.8) {
        for (const h of Object.values(s.heroes).filter(isUnit)) {
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
      e.patT = half ? 1.9 : 2.6;
      const pat = B.pats[e.patI++ % B.pats.length];
      bossPattern(s, e, pat, t, half);
    }
  }
  moveBody(s, e, wx, wy, dt);
}
function contactBoss(s, e, dmg, kb) {
  for (const h of Object.values(s.heroes).filter(isUnit)) {
    if (dist(h, e) > e.r + h.r || h.inv > 0 || (h.bossHitT || 0) > s.time) continue;
    h.bossHitT = s.time + 0.8;
    hit(s, h, { dmg: dmg * e.dmgMul, kb, ux: h.x - e.x, uy: h.y - e.y });
  }
}
function bossBlast(s, e, r, dmg, kb) {
  for (const h of Object.values(s.heroes).filter(isUnit)) if (dist(h, e) < r + h.r) hit(s, h, { dmg: dmg * e.dmgMul, kb, ux: h.x - e.x, uy: h.y - e.y });
  fxPush(s, { k: 'slam', x: e.x, y: e.y, r, t: 0.7, shake: 14 });
}
function bossPattern(s, e, pat, t, half) {
  const a0 = Math.atan2(t.y - e.y, t.x - e.x);
  const F = (dmg, speed, look) => ({ dmg, speed, look });
  fxPush(s, { k: 'bosscast', x: e.x, y: e.y, t: 0.4 });
  switch (pat) {
    case 'ring': { const n = half ? 22 : 16; for (let i = 0; i < n; i++) enemyShot(s, e, (i / n) * Math.PI * 2 + s.time, F(10, 210, 'eorb')); break; }
    case 'volley': for (let i = -3; i <= 3; i++) enemyShot(s, e, a0 + i * 0.13, F(11, 360, 'ebolt')); break;
    case 'jump': e.act = { type: 'jump', t: 0.9, T: 0.9, sx: e.x, sy: e.y, tx: t.x, ty: t.y }; fxPush(s, { k: 'warn', x: t.x, y: t.y, r: 120, t: 0.9 }); break;
    case 'summon': for (let i = 0; i < (half ? 4 : 3); i++) { const p = randomFloor(s, 14, [e], 60); s.pending.push({ t: 0.6, do: 'spawn', kind: 'slime', x: p.x, y: p.y, scale: { hp: e.dmgMul, dmg: e.dmgMul } }); fxPush(s, { k: 'spawnwarn', x: p.x, y: p.y, t: 0.6 }); } break;
    case 'rain':
      for (let i = 0; i < (half ? 8 : 5); i++) {
        const tg = Object.values(s.heroes).filter(isUnit)[i % Math.max(1, Object.values(s.heroes).filter(isUnit).length)] || t;
        const x = tg.x + rnd(-110, 110), y = tg.y + rnd(-110, 110);
        s.hazards.push({ x, y, r: 54, t: 1, dmg: 16 * e.dmgMul, kb: [220, 300] });
      }
      break;
    case 'dash': e.act = { type: 'dash', t: 1.25, go: 0.5, a: a0 }; fxPush(s, { k: 'warnline', x: e.x, y: e.y, a: a0, len: 520, w: e.r * 2, t: 0.75 }); break;
    case 'laser': e.act = { type: 'laser', t: 3, T: 3, a: a0 - 1, spin: half ? 1.1 : 0.8 }; break;
    case 'slam': fxPush(s, { k: 'warn', x: e.x, y: e.y, r: 160, t: 0.9 }); s.hazards.push({ x: e.x, y: e.y, r: 160, t: 0.9, dmg: 24 * e.dmgMul, kb: [300, 420], follow: e.id }); break;
    default:
  }
}
function updateHazards(s, dt) {
  for (const z of s.hazards) {
    z.t -= dt;
    if (z.follow) { const e = s.enemies.find((u) => u.id === z.follow); if (e) { z.x = e.x; z.y = e.y; } }
    if (z.t <= 0) {
      for (const h of Object.values(s.heroes).filter(isUnit)) if (Math.hypot(h.x - z.x, h.y - z.y) < z.r + h.r) hit(s, h, { dmg: z.dmg, kb: z.kb, ux: h.x - z.x || 1, uy: h.y - z.y });
      fxPush(s, { k: 'slam', x: z.x, y: z.y, r: z.r, t: 0.5, shake: 6 });
    }
  }
  s.hazards = s.hazards.filter((z) => z.t > 0);
}

// ============================================================
//  스토리 모드
// ============================================================
export function startStage(s, ch, st) {
  const boss = st === STAGES_PER_CHAPTER - 1;
  const CH = CHAPTERS[ch];
  const rows = boss ? BOSS_ARENA : STORY_ARENAS[(ch * 2 + st) % STORY_ARENAS.length];
  s.map = parseMap(rows, { floor: CH.floor, wall: CH.wall, wallTop: CH.wallTop });
  s.mapKey = `${boss ? 'B' : 'S'}${(ch * 2 + st) % STORY_ARENAS.length}-${ch}`;
  s.story = { ch, st, boss, wave: -1, phase: 'intro', t: 1.4, chest: null, cleared: false, nextT: 0, totalWaves: boss ? 1 : 3 };
  Object.assign(s, { enemies: [], shots: [], zones: [], hazards: [], pending: [] });
  for (const h of Object.values(s.heroes)) {
    placeHero(s, h);
    if (h.downed) { h.downed = false; h.hp = Math.round(h.maxHp * 0.5); }
    h.pct = clamp((1 - h.hp / h.maxHp) * 100, 0, 200);
    h.st = {}; h.inv = 1.2; h.chan = null; h.dash = null; h.snipe = null; h.roll = null; h.fall = 0;
  }
  say(s, `${ch + 1}-${st + 1} ${CH.name}${boss ? ' · 보스' : ''}`, 1.6);
}
function spawnWave(s) {
  const S = s.story, CH = CHAPTERS[S.ch];
  const scale = { hp: STORY.hpScale(S.ch, S.st) * (1 + 0.35 * (Object.keys(s.heroes).length - 1)), dmg: STORY.dmgScale(S.ch, S.st) };
  if (S.boss) {
    const p = { x: VIEW_CENTER.x + 160, y: VIEW_CENTER.y };
    s.pending.push({ t: 0.9, do: 'bossin' });
    fxPush(s, { k: 'spawnwarn', x: p.x, y: p.y, big: true, t: 0.9 });
    s.enemies.push(Object.assign(makeBoss(s, CH.boss, p.x, p.y, scale), { spawning: true, inv: 1.2 }));
    setTimeout0(s, 0.9, () => { const b = s.enemies.find((e) => e.boss); if (b) b.spawning = false; });
    say(s, BOSSES[CH.boss].name, 2);
    return;
  }
  const list = [...CH.waves[S.wave]];
  for (let i = 0; i < STORY.countAdd(S.ch, S.st); i++) list.push(CH.waves[S.wave][i % CH.waves[S.wave].length]);
  const heroes = Object.values(s.heroes);
  list.forEach((kind, i) => {
    const p = randomFloor(s, ENEMIES[kind].r, heroes, 170);
    s.pending.push({ t: 0.55 + i * 0.12, do: 'spawn', kind, x: p.x, y: p.y, scale });
    fxPush(s, { k: 'spawnwarn', x: p.x, y: p.y, t: 0.55 + i * 0.12 });
  });
}
function setTimeout0(s, t, fn) { s.pending.push({ t, do: 'fn', fn }); }
function updateStory(s, dt) {
  const S = s.story;
  const heroes = Object.values(s.heroes);
  // 부활: 쓰러진 동료 옆에 서 있으면
  for (const h of heroes) {
    if (!h.downed) continue;
    const helper = heroes.find((o) => o !== h && isUnit(o) && dist(o, h) < 46);
    h.reviveT = helper ? h.reviveT + dt : Math.max(0, h.reviveT - dt);
    if (h.reviveT >= STORY.reviveTime) { h.downed = false; h.hp = Math.round(h.maxHp * 0.4); h.inv = 1.5; h.pct = 60; fxPush(s, { k: 'revive', x: h.x, y: h.y, t: 0.8 }); }
  }
  if (S.phase === 'fail' || S.phase === 'done') { S.t -= dt; return; }
  if (heroes.length && heroes.every((h) => h.downed)) { S.phase = 'fail'; S.t = 99; say(s, '전멸… 다시 도전!', 99); return; }
  S.t -= dt;
  if (S.phase === 'intro') { if (S.t <= 0) { S.phase = 'fight'; S.wave = 0; spawnWave(s); } return; }
  if (S.phase === 'fight') {
    const alive = s.enemies.filter((e) => !e.dead).length + s.pending.filter((q) => q.do === 'spawn').length;
    if (alive > 0) return;
    if (S.wave + 1 < S.totalWaves) { S.wave++; spawnWave(s); return; }
    // 클리어 → 상자
    S.phase = 'clear'; S.cleared = true;
    let cp = { x: VIEW_CENTER.x, y: VIEW_CENTER.y + 80 };
    if (!safeFloor(s.map, cp.x, cp.y, 20)) cp = randomFloor(s, 20);
    S.chest = { x: cp.x, y: cp.y, open: false, big: S.boss };
    fxPush(s, { k: 'chestdrop', x: S.chest.x, y: S.chest.y, t: 0.6 });
    say(s, S.boss ? '보스 처치! 보물 상자를 여세요' : '스테이지 클리어! 상자를 여세요', 2);
    return;
  }
  if (S.phase === 'clear') {
    const c = S.chest;
    if (!c.open && heroes.some((h) => isUnit(h) && dist(h, c) < 40)) {
      c.open = true;
      giveGold(s, S.boss ? STORY.bossGold(S.ch) : STORY.chestGold(S.ch, S.st), c.x, c.y - 10);
      fxPush(s, { k: 'chestopen', x: c.x, y: c.y, big: c.big, t: 1.2, shake: 4 });
      S.nextT = 2.2;
    }
    if (c.open) {
      S.nextT -= dt;
      if (S.nextT <= 0) {
        const lastSt = S.st + 1 >= STAGES_PER_CHAPTER;
        if (lastSt) { S.phase = 'done'; S.t = 99; say(s, `${S.ch + 1}장 「${CHAPTERS[S.ch].name}」 클리어!`, 99); }
        else startStage(s, S.ch, S.st + 1);
      }
    }
  }
}

// ============================================================
//  콜로세움 (PvP)
// ============================================================
export function startColosseum(s, arena) {
  const A = COLOSSEUM_ARENAS[arena % COLOSSEUM_ARENAS.length];
  s.map = parseMap(A.rows, { floor: ['#26201c', '#2c2520'], wall: '#4e3b2e', wallTop: '#6b5240', sand: true });
  s.mapKey = `C${arena}`;
  s.colo = { arena, over: false, winner: null, t: 0, name: A.name };
}
function updateColosseum(s, dt) {
  const C = s.colo;
  if (!C.over) return;
  C.t -= dt;
  if (C.t > 0) return;
  C.over = false; C.winner = null;
  Object.assign(s, { shots: [], zones: [], pending: [], hazards: [] });
  for (const h of Object.values(s.heroes)) { respawnHero(s, h); h.stocks = COLOSSEUM.stocks; h.cds = [0, 0, 0, 0]; h.kos = 0; }
  say(s, '다시 시작!', 1.4);
}

// ---------- 봇 (콜로세움 연습 상대·팀원) ----------
export function botInput(s, h) {
  const inp = { mx: 0, my: 0, aim: h.aim, ad: 200 };
  const foe = foesOf(s, h.team).sort((a, b) => dist(a, h) - dist(b, h))[0];
  if (!foe) return inp;
  const dx = foe.x - h.x, dy = foe.y - h.y, d = len(dx, dy);
  inp.aim = Math.atan2(dy + foe.kvy * 0.12, dx + foe.kvx * 0.12);
  inp.ad = d;
  const C = CHARS[h.char];
  const melee = C.skills[0].type === 'slash';
  const want = melee ? 46 : 240;
  let mx = 0, my = 0;
  if (d > want + 30) { mx = dx / d; my = dy / d; } else if (d < want - 40) { mx = -dx / d; my = -dy / d; }
  h.botT = (h.botT || rnd(0, 9)) + 1 / 60;
  const w = Math.sin(h.botT * 1.6) * 0.75;
  mx += (-dy / d) * w; my += (dx / d) * w;
  const ahead = (k) => tileAt(s.map, h.x + mx * k, h.y + my * k);
  if (ahead(44) === 'o' || ahead(44) === '#' || tileAt(s.map, h.x, h.y) === '^') { const cx = VIEW_CENTER.x - h.x, cy = VIEW_CENTER.y - h.y, cl = len(cx, cy); mx = cx / cl; my = cy / cl; }
  inp.mx = mx; inp.my = my;
  // 날아오는 투사체를 보면 대시로 피함
  const danger = s.shots.some((p) => p.team !== h.team && Math.hypot(p.x - h.x, p.y - h.y) < 90 && (p.vx * (h.x - p.x) + p.vy * (h.y - p.y)) > 0);
  inp.dash = danger && Math.random() < 0.08;
  const r = Math.random();
  inp.atk = melee ? d < 80 : d < 520 && r < 0.6;
  inp.s1 = d < 480 && r < 0.025;
  inp.s2 = (melee ? d < 220 : d < 130) && r < 0.04;
  inp.s3 = d < 330 && r < 0.01;
  return inp;
}

// ============================================================
//  한 틱
// ============================================================
export function step(s, inputs, dt) {
  s.time += dt;
  s.msgT = Math.max(0, s.msgT - dt);
  for (const h of Object.values(s.heroes)) updateHero(s, h, h.bot ? botInput(s, h) : (inputs[h.id] || {}), dt);
  s.flowT = (s.flowT || 0) - dt;
  if (s.flowT <= 0) computeFlow(s);
  for (const e of s.enemies) updateEnemy(s, e, dt);
  updateShots(s, dt);
  updateZones(s, dt);
  updateHazards(s, dt);
  s.enemies = s.enemies.filter((e) => !e.dead);
  if (s.mode === 'story') updateStory(s, dt);
  else updateColosseum(s, dt);
  for (const f of s.fx) f.t -= dt;
  s.fx = s.fx.filter((f) => f.t > 0);
  if (s.fx.length > 260) s.fx = s.fx.slice(-260);
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
    m: s.mode, mk: s.mapKey, t: r1(s.time), rid: s.runId, g: s.gold,
    h: Object.values(s.heroes).map((h) => ({
      id: h.id, n: h.name, c: h.char, tm: h.team, col: h.color, x: r1(h.x), y: r1(h.y), a: r1(h.aim),
      hp: Math.ceil(Math.max(0, h.hp)), mh: h.maxHp, p: Math.round(h.pct), sk: h.stocks, al: h.alive ? 1 : 0, dn: h.downed ? 1 : 0, rv: r1(h.reviveT),
      fa: r1(Math.max(0, h.fall)), iv: h.inv > 0 ? 1 : 0, mv: h.moving ? 1 : 0, sn: h.stun > 0 ? 1 : 0, fl: h.flash > 0 ? 1 : 0, at: h.atkT > 0 ? 1 : 0,
      ch: h.chan ? 1 : 0, ds: h.dash ? (h.dash.S.look || 1) : 0, ro: h.roll ? 1 : 0, sp: h.snipe ? 1 : 0, em: h.empower > 0 ? 1 : 0, st: stCode(h),
      cd: h.cds.map(r1), cm: [0, 1, 2, 3].map((i) => r1(cdOf(s, h, i))), dc: h.dashCh, cb: h.combo.n, mc: h.maxCombo, ko: h.kos, rs: r1(Math.max(0, h.respawn)), bot: h.bot ? 1 : 0,
    })),
    e: s.enemies.map((e) => [e.id, e.type, r1(e.x), r1(e.y), Math.ceil(e.hp), e.maxHp, r1(e.fall), e.flash > 0 ? 1 : 0, r1(e.face), stCode(e), e.spawning ? 1 : 0, r1(e.z || 0), e.boss ? 1 : 0, e.act ? e.act.type : 0, e.act?.a !== undefined ? r1(e.act.a) : 0]),
    s: s.shots.map((p) => [p.id, p.look, r1(p.x), r1(p.y), r1(Math.atan2(p.vy, p.vx)), p.r, p.el || 0, r1(p.z || 0), p.team === 'E' ? 1 : 0]),
    z: s.zones.map((z) => [z.id, z.look, r1(z.x), r1(z.y), z.r, r1(z.t), r1(z.life)]),
    hz: s.hazards.map((z) => [r1(z.x), r1(z.y), z.r, r1(z.t)]),
    fx: s.fx.map((f) => { const o = { ...f }; o.t = r1(f.t); return o; }),
    msg: s.msgT > 0 ? s.msg : '',
    sto: s.story ? { ch: s.story.ch, st: s.story.st, ph: s.story.phase, w: s.story.wave, tw: s.story.totalWaves, boss: s.story.boss, chest: s.story.chest, nt: r1(s.story.nextT), cl: s.story.cleared ? 1 : 0 } : null,
    col: s.colo ? { over: s.colo.over, win: s.colo.winner, name: s.colo.name } : null,
  };
}
export const mapRowsFor = (key) => {
  if (!key) return null;
  if (key[0] === 'C') return COLOSSEUM_ARENAS[Number(key.slice(1)) % COLOSSEUM_ARENAS.length].rows;
  if (key[0] === 'B') return BOSS_ARENA;
  return STORY_ARENAS[Number(key.slice(1).split('-')[0])];
};
// 테스트·연습용: 적 하나 놓기
export function debugSpawn(s, kind, x, y, hpMul = 1) {
  const e = ENEMIES[kind] ? makeEnemy(s, kind, x, y, { hp: hpMul, dmg: 0 }) : makeBoss(s, kind, x, y, { hp: hpMul, dmg: 0 });
  e.inv = 0;
  s.enemies.push(e);
  return e;
}
