// 저장 (이 브라우저에만)
import { TREE, CHARS } from './data.js';

const KEY = 'elementArena.v1';
const DEF = { name: '', char: 'knight', owned: ['knight'], gold: 0, tree: [], cleared: 0, stats: { runs: 0, bestCombo: 0, kos: 0, bestLevel: 0 }, muted: false };
let data = load();

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (d) {
      const o = { ...DEF, ...d, stats: { ...DEF.stats, ...(d.stats || {}) } };
      o.owned = Array.isArray(d.owned) ? d.owned.filter((k) => CHARS[k]) : ['knight'];
      if (!o.owned.includes('knight')) o.owned.unshift('knight');
      if (!o.owned.includes(o.char)) o.char = 'knight';
      return o;
    }
  } catch { /* 무시 */ }
  return structuredClone(DEF);
}
export function save() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* 무시 */ } }
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
