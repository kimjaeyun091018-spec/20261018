// 저장: 기기(localStorage)에 계정별로 따로, 구글 계정이면 클라우드에도 (cloud.js)
import { TREE, CHARS, CHAR_KEYS, RARITY, RARITY_ORDER, BOXES, GACHA, HERO_LV } from './data.js';

const BASE = 'elementArena.v1';
let account = null; // null = 게스트, 'g-<uid>' = 구글 계정
const keyOf = (acc) => (acc ? `${BASE}:${acc}` : BASE);
let KEY = keyOf(null);
let onWrite = null;
const DEF = { name: '', char: 'knight', owned: ['knight'], gold: 0, tree: [], cleared: 0, pity: 0, boxes: 0, lv: {}, pp: {}, stats: { runs: 0, bestCombo: 0, kos: 0, bestLevel: 0, best: 0, wins: 0 }, muted: false };
let data = load();

function load(raw) {
  try {
    const d = raw || JSON.parse(localStorage.getItem(KEY) || 'null');
    if (d) {
      const o = { ...DEF, ...d, stats: { ...DEF.stats, ...(d.stats || {}) } };
      o.owned = Array.isArray(d.owned) ? d.owned.filter((k) => CHARS[k]) : ['knight'];
      if (!o.owned.includes('knight')) o.owned.unshift('knight');
      if (!o.owned.includes(o.char)) o.char = 'knight';
      o.lv = { ...(d.lv || {}) }; o.pp = { ...(d.pp || {}) };
      return o;
    }
  } catch { /* 무시 */ }
  return structuredClone(DEF);
}
export function save(quiet = false) {
  if (!quiet) data._t = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* 무시 */ }
  if (!quiet) onWrite?.(data);
}
export function onSaveWrite(fn) { onWrite = fn; }
// 계정 바꾸기: 그 계정의 기기 저장을 불러옴
export function useAccount(acc) { account = acc || null; KEY = keyOf(account); data = load(); }
export const currentAccount = () => account;
export const hasLocal = (acc) => { try { return !!localStorage.getItem(keyOf(acc)); } catch { return false; } };
// 다른 곳(클라우드·게스트 진행)에서 받은 저장으로 바꿈
export function replaceWith(raw, t) { data = load(raw); data._t = t || raw?._t || Date.now(); save(true); }
export const S = () => data;
export function setName(n) { data.name = String(n || '').slice(0, 10); save(); }
export function setChar(c) { if (CHARS[c] && data.owned.includes(c)) { data.char = c; save(); } }
export const owns = (c) => data.owned.includes(c);
export function buyChar(c) {
  const C = CHARS[c];
  if (!C || owns(c) || data.gold < C.price) return false;
  data.gold -= C.price; data.owned.push(c); data.char = c; save();
  return true;
}
// ---------- 뽑기 ----------
const unowned = () => CHAR_KEYS.filter((k) => !data.owned.includes(k) && RARITY[CHARS[k].rarity]?.chance > 0);
export const allOwned = () => unowned().length === 0;
// 지금 한 칸에서 각 등급 영웅이 나올 확률 (행운 포함)
export function gachaOdds(box = 'small') {
  const left = unowned();
  const luck = (1 + data.pity * GACHA.luckPer) * BOXES[box].luck;
  const o = {};
  for (const r of RARITY_ORDER) o[r] = left.some((k) => CHARS[k].rarity === r) ? Math.min(0.5, RARITY[r].chance * luck) : 0;
  return o;
}
function rollHero(box, force) {
  const left = unowned();
  if (!left.length) return null;
  const odds = gachaOdds(box);
  let tier = null;
  if (force) {
    // 확정: 남은 등급 중 기본 확률 비율대로
    const tot = RARITY_ORDER.reduce((a, r) => a + (odds[r] ? RARITY[r].chance : 0), 0);
    let x = Math.random() * tot;
    for (const r of RARITY_ORDER) { if (!odds[r]) continue; x -= RARITY[r].chance; if (x <= 0) { tier = r; break; } }
    tier ||= RARITY_ORDER.find((r) => odds[r]);
  } else {
    let x = Math.random();
    for (const r of [...RARITY_ORDER].reverse()) { if (x < odds[r]) { tier = r; break; } x -= odds[r]; }
  }
  if (!tier) return null;
  const pool = left.filter((k) => CHARS[k].rarity === tier);
  return pool[Math.floor(Math.random() * pool.length)];
}
// 상자 열기: 골드를 내고 칸들을 굴림 → [{ t:'hero', c } | { t:'gold', n, jackpot }]
export function openBox(box) {
  const B = BOXES[box];
  if (!B || data.gold < B.price) return null; // 영웅을 다 모아도 열 수 있음 (P.P·골드)
  data.gold -= B.price;
  const drops = [];
  for (let i = 0; i < B.drops; i++) {
    const c = rollHero(box, data.pity + 1 >= GACHA.pity);
    if (c) { data.owned.push(c); data.pity = 0; drops.push({ t: 'hero', c }); continue; }
    data.pity++;
    // 영웅이 아니면: P.P (가진 영웅 중 아직 만렙이 아닌 한 명) 또는 골드
    const ppList = data.owned.filter((k) => heroLv(k) < HERO_LV.max);
    if (ppList.length && Math.random() < GACHA.ppChance) {
      const k = ppList[Math.floor(Math.random() * ppList.length)];
      const n = Math.round(GACHA.pp[0] + Math.random() * (GACHA.pp[1] - GACHA.pp[0]));
      data.pp[k] = (data.pp[k] || 0) + n;
      drops.push({ t: 'pp', c: k, n });
      continue;
    }
    const jackpot = Math.random() < GACHA.jackpot;
    const [a, b] = jackpot ? GACHA.jackpotGold : B.gold;
    const n = Math.round(a + Math.random() * (b - a));
    data.gold += n;
    drops.push({ t: 'gold', n, jackpot });
  }
  data.boxes = (data.boxes || 0) + 1;
  // 영웅이 앞에 오면 김이 새므로 골드·P.P → 영웅 순 (영웅끼리는 낮은 등급 먼저)
  drops.sort((x, y) => (x.t === 'hero') - (y.t === 'hero') || (x.t === 'pp') - (y.t === 'pp') || (x.t === 'hero' ? RARITY_ORDER.indexOf(CHARS[x.c].rarity) - RARITY_ORDER.indexOf(CHARS[y.c].rarity) : 0));
  save();
  return drops;
}
// ---------- 영웅 레벨 ----------
export const heroLv = (c) => Math.max(1, Math.min(HERO_LV.max, data.lv?.[c] || 1));
export const heroPP = (c) => data.pp?.[c] || 0;
export function canLevel(c) { const lv = heroLv(c); return owns(c) && lv < HERO_LV.max && heroPP(c) >= HERO_LV.pp[lv] && data.gold >= HERO_LV.gold[lv]; }
export function levelUp(c) {
  if (!canLevel(c)) return false;
  const lv = heroLv(c);
  data.pp[c] -= HERO_LV.pp[lv]; data.gold -= HERO_LV.gold[lv];
  data.lv[c] = lv + 1; save();
  return true;
}
// ---------- 이어하기 (스토리 진행 중 메뉴로 나간 곳) ----------
export const getRun = () => data.run || null;
export function setRun(r) { data.run = r || null; save(); }
export function addGold(n) { data.gold = Math.max(0, data.gold + Math.round(n)); save(); }
export function canBuy(id) {
  const n = TREE.find((t) => t.id === id);
  if (!n || data.tree.includes(id)) return false;
  return (n.req || []).some((r) => data.tree.includes(r)) || !n.req;
}
export function buy(id) {
  const n = TREE.find((t) => t.id === id);
  if (!canBuy(id) || data.gold < n.cost) return false;
  data.gold -= n.cost; data.tree.push(id); save();
  return true;
}
export function resetTree() {
  const refund = data.tree.reduce((a, id) => a + (TREE.find((t) => t.id === id)?.cost || 0), 0);
  data.gold += refund; data.tree = []; save();
  return refund;
}
export function clearChapter(ch) { data.cleared = Math.max(data.cleared, ch + 1); save(); }
export function stat(k, v, max = false) { data.stats[k] = max ? Math.max(data.stats[k] || 0, v) : (data.stats[k] || 0) + v; save(); }
export function setMuted(m) { data.muted = m; save(); }

// ---------- 조작 배치 (기기마다 따로, 클라우드 X) ----------
// { stick|atk|s1|s2|s3|dash: { x, y, s } (x·y = 화면 가로·세로 비율의 중심, s = 크기 배율), alpha }
const LAYOUT_KEY = 'elementArena.layout';
export const CONTROL_BASE = { stick: 140, atk: 92, s1: 62, s2: 62, s3: 62, dash: 54 };
export const DEFAULT_LAYOUT = {
  stick: { x: 0.12, y: 0.78, s: 1 }, atk: { x: 0.92, y: 0.84, s: 1 }, s1: { x: 0.81, y: 0.88, s: 1 },
  s2: { x: 0.83, y: 0.69, s: 1 }, s3: { x: 0.935, y: 0.6, s: 1 }, dash: { x: 0.72, y: 0.74, s: 1 }, alpha: 1,
};
export function loadLayout() { try { const d = JSON.parse(localStorage.getItem(LAYOUT_KEY) || 'null'); return d && d.stick ? d : null; } catch { return null; } }
export function saveLayout(l) { try { if (l) localStorage.setItem(LAYOUT_KEY, JSON.stringify(l)); else localStorage.removeItem(LAYOUT_KEY); } catch { /* 무시 */ } }
