// 저장: 기기(localStorage)에 계정별로 따로, 구글 계정이면 클라우드에도 (cloud.js)
import { TREE, CHARS } from './data.js';

const BASE = 'elementArena.v1';
let account = null; // null = 게스트, 'g-<uid>' = 구글 계정
const keyOf = (acc) => (acc ? `${BASE}:${acc}` : BASE);
let KEY = keyOf(null);
let onWrite = null;
const DEF = { name: '', char: 'knight', owned: ['knight'], gold: 0, tree: [], cleared: 0, stats: { runs: 0, bestCombo: 0, kos: 0, bestLevel: 0 }, muted: false };
let data = load();

function load(raw) {
  try {
    const d = raw || JSON.parse(localStorage.getItem(KEY) || 'null');
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
