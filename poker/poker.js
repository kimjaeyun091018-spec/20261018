'use strict';
/* 텍사스 홀덤 — 조커 없는 52장 덱, 봇 1~5명과 대결 */

const HAS_DOM = typeof document !== 'undefined';

// ───────────────────────── 카드 · 족보 ─────────────────────────
const SUIT = ['♠', '♥', '♦', '♣'];
const RED = [false, true, true, false];
const HAND_NAMES = ['하이카드', '원페어', '투페어', '트리플', '스트레이트', '플러시', '풀하우스', '포카드', '스트레이트 플러시'];

const rs = r => ({ 14: 'A', 13: 'K', 12: 'Q', 11: 'J' }[r] || String(r));
const cid = c => c.r * 4 + c.s;

function newDeck() {
  const d = [];
  for (let s = 0; s < 4; s++) for (let r = 2; r <= 14; r++) d.push({ r, s });
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d; // 52장, 조커 없음
}

function straightHigh(ranks) {
  const has = new Array(15).fill(false);
  for (const r of ranks) has[r] = true;
  if (has[14]) has[1] = true; // A-2-3-4-5
  for (let h = 14; h >= 5; h--) {
    if (has[h] && has[h - 1] && has[h - 2] && has[h - 3] && has[h - 4]) return h;
  }
  return 0;
}

function kickers(rc, excl, n) {
  const out = [];
  for (let r = 14; r >= 2 && out.length < n; r--) if (rc[r] && !excl.includes(r)) out.push(r);
  return out;
}

// 5~7장 → [족보 등급, 비교용 숫자들...]  (클수록 강함)
function evaluate(cards) {
  const rc = new Array(15).fill(0), bySuit = [[], [], [], []];
  for (const c of cards) { rc[c.r]++; bySuit[c.s].push(c.r); }
  let fs = -1;
  for (let s = 0; s < 4; s++) if (bySuit[s].length >= 5) fs = s;
  if (fs >= 0) {
    const sf = straightHigh(bySuit[fs]);
    if (sf) return [8, sf];
  }
  const quads = [], trips = [], pairs = [];
  for (let r = 14; r >= 2; r--) {
    if (rc[r] === 4) quads.push(r);
    else if (rc[r] === 3) trips.push(r);
    else if (rc[r] === 2) pairs.push(r);
  }
  if (quads.length) return [7, quads[0], ...kickers(rc, [quads[0]], 1)];
  if (trips.length && (trips.length > 1 || pairs.length)) {
    return [6, trips[0], Math.max(trips[1] || 0, pairs[0] || 0)];
  }
  if (fs >= 0) return [5, ...bySuit[fs].slice().sort((a, b) => b - a).slice(0, 5)];
  const st = straightHigh(cards.map(c => c.r));
  if (st) return [4, st];
  if (trips.length) return [3, trips[0], ...kickers(rc, [trips[0]], 2)];
  if (pairs.length >= 2) return [2, pairs[0], pairs[1], ...kickers(rc, [pairs[0], pairs[1]], 1)];
  if (pairs.length) return [1, pairs[0], ...kickers(rc, [pairs[0]], 3)];
  return [0, ...kickers(rc, [], 5)];
}

function cmp(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] || 0) - (b[i] || 0);
    if (d) return d;
  }
  return 0;
}

function handName(sc) {
  const [k, a, b] = sc;
  switch (k) {
    case 8: return a === 14 ? '로얄 플러시' : `${rs(a)} 스트레이트 플러시`;
    case 7: return `${rs(a)} 포카드`;
    case 6: return `${rs(a)} 풀하우스`;
    case 5: return `${rs(a)} 플러시`;
    case 4: return `${rs(a)} 스트레이트`;
    case 3: return `${rs(a)} 트리플`;
    case 2: return `${rs(a)}·${rs(b)} 투페어`;
    case 1: return `${rs(a)} 원페어`;
    default: return `${rs(a)} 하이카드`;
  }
}

// 7장 중 족보를 만드는 5장 찾기 (승자 카드 강조용)
function bestFive(cards, score) {
  const n = cards.length;
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
    const five = cards.filter((_, i) => i !== a && i !== b);
    if (n === 7 && cmp(evaluate(five), score) === 0) return five;
  }
  return cards.slice(0, 5);
}

// 몬테카를로로 승률 추정 (봇이 판단할 때 사용)
function equity(hole, board, nOpp, iters) {
  if (nOpp <= 0) return 1;
  const used = new Set(hole.concat(board).map(cid));
  const rest = [];
  for (let s = 0; s < 4; s++) for (let r = 2; r <= 14; r++) if (!used.has(r * 4 + s)) rest.push({ r, s });
  const needB = 5 - board.length, need = needB + 2 * nOpp;
  let score = 0;
  for (let it = 0; it < iters; it++) {
    for (let k = 0; k < need; k++) {
      const j = k + Math.floor(Math.random() * (rest.length - k));
      const t = rest[k]; rest[k] = rest[j]; rest[j] = t;
    }
    const full = board.concat(rest.slice(0, needB));
    const mine = evaluate(hole.concat(full));
    let lost = false, ties = 0;
    for (let o = 0; o < nOpp; o++) {
      const c = cmp(mine, evaluate([rest[needB + 2 * o], rest[needB + 2 * o + 1]].concat(full)));
      if (c < 0) { lost = true; break; }
      if (c === 0) ties++;
    }
    if (!lost) score += 1 / (ties + 1);
  }
  return score / iters;
}

// ───────────────────────── 게임 상태 ─────────────────────────
const BLINDS = [[10, 20], [15, 30], [25, 50], [50, 100], [75, 150], [100, 200], [150, 300], [250, 500], [500, 1000], [1000, 2000]];
const HANDS_PER_LEVEL = 8;
const START_CHIPS = 1000;
const BOT_PROFILES = [
  { name: '민준', avatar: '🦊', tight: 0.04, aggr: 0.30, bluff: 0.07 },
  { name: '서연', avatar: '🐱', tight: 0.10, aggr: 0.20, bluff: 0.03 },
  { name: '도윤', avatar: '🐻', tight: 0.00, aggr: 0.45, bluff: 0.12 },
  { name: '하은', avatar: '🐰', tight: 0.06, aggr: 0.35, bluff: 0.05 },
  { name: '지호', avatar: '🐯', tight: 0.02, aggr: 0.40, bluff: 0.09 },
];

let S = null;
let speed = 1; // 테스트에선 0

const fmt = n => n.toLocaleString('ko-KR');
const sleep = ms => new Promise(r => {
  const me = S && S.players[S.me || 0];
  const fast = S && !S.multi && me && me.human && (me.folded || me.out) ? 0.45 : 1;
  setTimeout(r, ms * speed * fast);
});

// human: 이 브라우저의 사람 · remote: 친구(피어 id) · 둘 다 아니면 봇
function mkPlayer(o) {
  return {
    human: false, remote: null, chips: START_CHIPS, hand: [], bet: 0, total: 0,
    folded: false, allIn: false, out: false, acted: false, raises: 0,
    last: '', show: false, winner: false, score: null, ...o,
  };
}
function startState(players, mode) {
  S = {
    players, dealer: Math.floor(Math.random() * players.length),
    handNo: 0, level: 0, board: [], deck: [], stage: '', currentBet: 0, minRaise: 0,
    toAct: -1, highlight: new Set(), msg: '', bbSeat: -1, sbSeat: -1, mode, stageLabel: '',
    me: 0, multi: false, roomCode: '',
  };
}
function newGame(nBots, allBots = false, mode = 'holdem') {
  const players = [mkPlayer({ name: '나', avatar: '🙂', style: BOT_PROFILES[1], human: !allBots })];
  for (let i = 0; i < nBots; i++) players.push(mkPlayer({ ...BOT_PROFILES[i], style: BOT_PROFILES[i] }));
  startState(players, mode);
}

// multi.js가 채우는 연결 고리
const hooks = { render: null, log: null, ask: null, wait: null, end: null };

function getAction(p) {
  if (p.human) return isSeven() ? humanActionSeven(p) : humanAction(p);
  if (p.remote && hooks.ask) return hooks.ask(p, 'bet');
  return isSeven() ? botActionSeven(p) : botAction(p);
}

const P = () => S.players;
const isSeven = () => S && S.mode === 'seven';
const blinds = () => BLINDS[S.level];
const inHand = () => P().filter(p => !p.out && !p.folded);
const canAct = () => inHand().filter(p => !p.allIn);
const potTotal = () => P().reduce((a, p) => a + p.total, 0);
function nextIn(i) {
  const n = P().length;
  for (let k = 1; k <= n; k++) { const j = (i + k) % n; if (!P()[j].out) return j; }
  return i;
}

function put(p, amt) {
  amt = Math.max(0, Math.min(amt, p.chips));
  p.chips -= amt; p.bet += amt; p.total += amt;
  if (p.chips === 0) p.allIn = true;
}

function act(p, a) {
  const toCall = Math.min(S.currentBet - p.bet, p.chips);
  let type = a.type;
  if (type === 'check' && toCall > 0) type = 'call';
  if (type === 'raise') {
    const to = Math.min(a.to, p.bet + p.chips);
    if (to <= S.currentBet || p.chips <= toCall) type = 'call';
    else {
      const wasBet = S.currentBet === 0;
      if (to - S.currentBet >= S.minRaise) S.minRaise = to - S.currentBet;
      put(p, to - p.bet);
      S.currentBet = to;
      for (const q of P()) if (q !== p) q.acted = false;
      p.raises++;
      p.last = p.allIn ? '올인' : (a.label ? `${a.label} ${fmt(to)}` : wasBet ? `베팅 ${fmt(to)}` : `레이즈 ${fmt(to)}`);
      log(`${p.name}: ${p.allIn ? `올인 (${fmt(to)})` : p.last}`);
    }
  }
  if (type === 'fold') {
    if (toCall === 0) type = 'call'; // 공짜로 볼 수 있으면 폴드 대신 체크
    else { const w = isSeven() ? '다이' : '폴드'; p.folded = true; p.last = w; log(`${p.name}: ${w}`); }
  }
  if (type === 'call') {
    if (toCall === 0) { p.last = '체크'; log(`${p.name}: 체크`); }
    else {
      put(p, toCall);
      p.last = p.allIn ? '올인' : `콜 ${fmt(toCall)}`;
      log(`${p.name}: ${p.allIn ? `올인 콜 (${fmt(p.bet)})` : p.last}`);
    }
  }
  p.acted = true;
}

async function bettingRound(start) {
  for (const p of P()) p.acted = false;
  let i = start, guard = 0;
  while (guard++ < 500) {
    if (inHand().length <= 1) break;
    const ca = canAct();
    if (ca.every(p => p.acted && p.bet === S.currentBet)) break;
    if (ca.length === 1 && ca[0].bet >= S.currentBet) break; // 상대가 모두 올인 → 더 걸 사람 없음
    const p = P()[i];
    if (p.out || p.folded || p.allIn || (p.acted && p.bet === S.currentBet)) { i = nextIn(i); continue; }
    S.toAct = i; render();
    const a = await getAction(p);
    act(p, a);
    S.toAct = -1; render();
    i = nextIn(i);
  }
  S.toAct = -1;
}

function endStreet() {
  for (const p of P()) {
    p.bet = 0; p.acted = false; p.raises = 0;
    if (!p.folded && !p.allIn) p.last = '';
  }
  S.currentBet = 0;
  S.minRaise = blinds()[1];
}

function beginHand() {
  for (const p of P()) {
    if (p.chips <= 0) p.out = true;
    Object.assign(p, { hand: [], bet: 0, total: 0, folded: p.out, allIn: false, acted: false, raises: 0, last: '', show: false, winner: false, score: null, _seen: 0, _up: false });
  }
  S.handNo++;
  S.highlight = new Set();
  S.msg = '';
  const lvl = Math.min(BLINDS.length - 1, Math.floor((S.handNo - 1) / HANDS_PER_LEVEL));
  if (lvl !== S.level) {
    S.level = lvl;
    log(isSeven() ? `⬆ 참가비 상승: ${fmt(blinds()[0])}` : `⬆ 블라인드 상승: ${fmt(blinds()[0])} / ${fmt(blinds()[1])}`, 'sys');
  }
  S.dealer = nextIn(S.dealer);
  S.board = []; S.deck = newDeck(); S.stage = 'preflop'; S.stageLabel = '';
  log(`— ${S.handNo}번째 판 —`, 'sys');
}

async function playHand() {
  beginHand();
  const [sb, bb] = blinds();

  const live = P().filter(p => !p.out);
  if (live.length === 2) { S.sbSeat = S.dealer; S.bbSeat = nextIn(S.dealer); }
  else { S.sbSeat = nextIn(S.dealer); S.bbSeat = nextIn(S.sbSeat); }
  const SB = P()[S.sbSeat], BB = P()[S.bbSeat];
  put(SB, sb); SB.last = 'SB';
  put(BB, bb); BB.last = 'BB';
  S.currentBet = bb; S.minRaise = bb;

  // 카드 2장씩
  for (let round = 0; round < 2; round++) {
    let i = S.dealer;
    for (let k = 0; k < live.length; k++) {
      i = nextIn(i);
      P()[i].hand.push(S.deck.pop());
      render(); await sleep(110);
    }
  }

  await bettingRound(nextIn(S.bbSeat));

  for (const [stage, n, label] of [['flop', 3, '플랍'], ['turn', 1, '턴'], ['river', 1, '리버']]) {
    if (inHand().length <= 1) break;
    if (canAct().length <= 1) for (const p of inHand()) p.show = true; // 올인 대결 → 카드 공개
    endStreet();
    S.deck.pop(); // 번 카드
    for (let k = 0; k < n; k++) S.board.push(S.deck.pop());
    S.stage = stage;
    render();
    await sleep(stage === 'flop' ? 650 : 550);
    if (canAct().length >= 2) await bettingRound(nextIn(S.dealer));
  }
  endStreet();
  await showdown();
}

function scoreHand(p) { return isSeven() ? evalK(p.hand).s : evaluate(p.hand.concat(S.board)); }
function nameOf(sc) { return isSeven() ? handNameK(sc) : handName(sc); }
function fiveOf(p) { return isSeven() ? evalK(p.hand).five : bestFive(p.hand.concat(S.board), p.score); }

async function showdown() {
  S.stage = 'showdown';
  const contenders = inHand();
  if (contenders.length === 1) {
    const w = contenders[0], amt = potTotal();
    w.chips += amt; w.winner = true;
    for (const p of P()) p.total = 0;
    S.msg = `${w.name} 승리 · +${fmt(amt)}`;
    log(`🏆 ${w.name}이(가) ${fmt(amt)}을(를) 가져감`, 'win');
    render();
    return;
  }

  for (const p of contenders) {
    p.show = true;
    p.score = scoreHand(p);
    p.last = nameOf(p.score);
  }
  render();
  await sleep(500);

  // 메인 팟 · 사이드 팟
  const levels = [...new Set(contenders.map(p => p.total))].sort((a, b) => a - b);
  const pots = [];
  let prev = 0;
  for (const L of levels) {
    let amt = 0;
    for (const p of P()) amt += Math.max(0, Math.min(p.total, L) - prev);
    pots.push({ amt, elig: contenders.filter(p => p.total >= L) });
    prev = L;
  }
  const leftover = potTotal() - pots.reduce((a, x) => a + x.amt, 0);
  pots[pots.length - 1].amt += leftover;

  const order = []; // 딜러 왼쪽부터 (나머지 칩 배분 순서)
  for (let i = nextIn(S.dealer), k = 0; k < P().length; k++, i = (i + 1) % P().length) order.push(P()[i]);

  const msgs = [];
  pots.forEach((pot, idx) => {
    if (pot.amt <= 0) return;
    let best = null;
    for (const p of pot.elig) if (!best || cmp(p.score, best) > 0) best = p.score;
    const winners = order.filter(p => pot.elig.includes(p) && cmp(p.score, best) === 0);
    const share = Math.floor(pot.amt / winners.length);
    let rem = pot.amt - share * winners.length;
    for (const w of winners) {
      const got = share + (rem > 0 ? 1 : 0); if (rem > 0) rem--;
      w.chips += got; w.winner = true;
      for (const c of fiveOf(w)) S.highlight.add(cid(c));
    }
    const potName = pots.length === 1 ? '' : (idx === 0 ? '메인 팟 ' : `사이드 팟 ${idx} `);
    const names = winners.map(w => w.name).join(', ');
    msgs.push(`${potName}${names}${winners.length > 1 ? ' (나눔)' : ''} · ${nameOf(best)}`);
    log(`🏆 ${potName}${fmt(pot.amt)} → ${names} (${nameOf(best)})`, 'win');
  });
  for (const p of P()) p.total = 0;
  S.msg = msgs.join('\n');
  render();
}

// ───────────────────────── 봇 ─────────────────────────
function roundTo(x) { const u = blinds()[0]; return Math.round(x / u) * u; }

async function botAction(p) {
  await sleep(650 + Math.random() * 650);
  const st = p.style;
  const toCall = Math.min(S.currentBet - p.bet, p.chips);
  const nOpp = inHand().length - 1;
  const eq = equity(p.hand, S.board, nOpp, S.board.length ? 320 : 260);
  const pot = potTotal();
  const strength = eq * (nOpp + 1); // 1보다 크면 평균보다 강함
  const r = Math.random();
  const maxTo = p.bet + p.chips;
  const minTo = Math.min(S.currentBet + S.minRaise, maxTo);
  const sizeTo = frac => Math.max(minTo, Math.min(maxTo, roundTo(S.currentBet + Math.max(S.minRaise, (pot + toCall) * frac))));
  const canRaise = p.chips > toCall && p.raises < (eq > 0.75 ? 4 : 2);

  if (toCall === 0) {
    if (canRaise && ((strength > 1.35 - st.aggr * 0.4 && r < 0.5 + st.aggr) || r < st.bluff)) {
      return { type: 'raise', to: sizeTo(0.4 + Math.random() * 0.45) };
    }
    return { type: 'check' };
  }

  const potOdds = toCall / (pot + toCall);
  const need = potOdds + st.tight;
  if (canRaise && strength > 1.6 - st.aggr * 0.5 && eq > need + 0.12 && r < 0.35 + st.aggr) {
    if (eq > 0.8 && r < 0.25) return { type: 'raise', to: maxTo };
    return { type: 'raise', to: sizeTo(0.6 + Math.random() * 0.5) };
  }
  if (eq >= need) return { type: 'call' };
  if (toCall <= blinds()[1] && eq >= need * 0.75) return { type: 'call' }; // 싸면 따라가 봄
  if (canRaise && S.stage !== 'river' && r < st.bluff * 0.5) return { type: 'raise', to: sizeTo(0.7) };
  return { type: 'fold' };
}

// ───────────────────────── 화면 ─────────────────────────
const $ = s => document.querySelector(s);
const SEAT_POS = {
  2: [[50, 86], [50, 13]],
  3: [[50, 86], [16, 20], [84, 20]],
  4: [[50, 86], [7, 46], [50, 13], [93, 46]],
  5: [[50, 86], [9, 66], [20, 16], [80, 16], [91, 66]],
  6: [[50, 86], [9, 66], [16, 18], [50, 11], [84, 18], [91, 66]],
};

const SEAT_POS_M = { // 세로 화면용
  2: [[50, 87], [50, 12]],
  3: [[50, 87], [25, 19], [75, 19]],
  4: [[50, 87], [21, 69], [50, 12], [79, 69]],
  5: [[50, 87], [21, 69], [24, 22], [76, 22], [79, 69]],
  6: [[50, 87], [21, 69], [21, 27], [50, 10], [79, 27], [79, 69]],
};
if (HAS_DOM) window.addEventListener('resize', () => render());

function cardHTML(c, opts = {}) {
  if (!c || opts.back) return `<div class="card back${opts.anim ? ' anim' : ''}"></div>`;
  const cls = ['card', RED[c.s] ? 'red' : 'black'];
  if (opts.anim) cls.push('anim');
  if (opts.flip) cls.push('flip');
  if (opts.hid) cls.push('hid');
  if (S.highlight.size && S.highlight.has(cid(c))) cls.push('hl');
  else if (S.highlight.size && opts.dimNonHl) cls.push('dim');
  return `<div class="${cls.join(' ')}"><span class="cr">${rs(c.r)}</span><span class="cs">${SUIT[c.s]}</span><span class="big">${SUIT[c.s]}</span></div>`;
}

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let boardShown = 0;
let seen = []; // 자리별로 이미 그린 카드 수 (새 카드만 애니메이션)
function render() {
  if (!HAS_DOM || !S) return;
  const players = P();
  const me = S.me || 0, n = players.length;
  const narrow = window.matchMedia('(max-width: 640px)').matches;
  let pos = (narrow ? SEAT_POS_M : SEAT_POS)[players.length];
  // 7포커는 가운데 공용 카드가 없으니, 세로 화면에선 아래쪽 옆자리를 조금 올려 내 카드와 안 겹치게
  if (narrow && isSeven()) pos = pos.map(([x, y]) => [x, y > 60 && y < 80 ? 58 : y]);
  const [sb, bb] = blinds();
  $('#info').textContent = (S.roomCode ? `방 ${S.roomCode} · ` : '') +
    (isSeven() ? `7포커 · ${S.handNo}판 · 참가비 ${fmt(sb)}` : `홀덤 · ${S.handNo}판 · 블라인드 ${fmt(sb)}/${fmt(bb)}`);

  const pot = potTotal();
  $('#pot').innerHTML = pot > 0 ? `팟 <b>${fmt(pot)}</b>` : '';

  // 공용 카드 (새로 깔린 카드만 애니메이션)
  if (S.board.length < boardShown) boardShown = 0;
  let b = '';
  for (let i = 0; i < 5; i++) {
    const c = S.board[i];
    b += c ? cardHTML(c, { anim: i >= boardShown, dimNonHl: true }) : '<div class="card slot"></div>';
  }
  $('#board').innerHTML = isSeven() ? (S.stageLabel ? `<div class="stage">${S.stageLabel}</div>` : '') : b;
  boardShown = S.board.length;

  $('#msg').textContent = S.msg || '';
  $('#msg').classList.toggle('on', !!S.msg);

  let html = '';
  players.forEach((p, i) => {
    const isMe = i === me;
    const [x, y] = pos[(i - me + n) % n];
    const cls = ['seat'];
    if (isMe) cls.push('me');
    if (p.out) cls.push('out');
    if (p.folded && !p.out) cls.push('folded');
    if (S.toAct === i) cls.push('active');
    if (p.winner) cls.push('winner');
    const faceUp = isMe ? !p.out : p.show;
    let cards = '';
    let sn = seen[i];
    if (!sn || sn.hand !== S.handNo || sn.n > p.hand.length) sn = seen[i] = { hand: S.handNo, n: 0, up: false };
    if (!p.out && !(p.folded && !isMe)) {
      p.hand.forEach((c, k) => {
        const anim = k >= sn.n;
        const up = faceUp || (isSeven() && c.up);
        const flip = faceUp && !sn.up && !isMe && !(isSeven() && c.up);
        cards += cardHTML(c, { back: !up, anim, flip, dimNonHl: true, hid: isSeven() && isMe && !c.up && S.stage !== 'choose' });
      });
    }
    sn.n = p.hand.length; sn.up = faceUp;
    const dealer = i === S.dealer && !p.out ? '<span class="dbtn">D</span>' : '';
    const tag = esc(p.out ? '탈락' : (p.last || ''));
    // 베팅 칩은 테이블 가운데 쪽으로
    const bx = x + (50 - x) * 0.42, by = y + (48 - y) * 0.42;
    if (p.bet > 0) html += `<div class="betchip" style="left:${bx}%;top:${by}%"><i></i>${fmt(p.bet)}</div>`;
    html += `<div class="${cls.join(' ')}" style="left:${x}%;top:${y}%">
      <div class="hole${isSeven() ? ' seven' : ''}">${cards}</div>
      <div class="plate">${dealer}<span class="av">${esc(p.avatar)}</span>
        <div class="nm"><b>${esc(p.name)}${isMe && S.multi ? ' (나)' : ''}</b><span>${fmt(p.chips)}</span></div></div>
      ${tag ? `<div class="tag${p.winner ? ' win' : ''}">${tag}</div>` : ''}
    </div>`;
  });
  $('#seats').innerHTML = html;
  if (hooks.render) hooks.render();
}

let logLines = [];
function log(text, kind = '') {
  if (!HAS_DOM) return;
  if (hooks.log) hooks.log(text, kind);
  logLines.push(`<div class="${['sys', 'win'].includes(kind) ? kind : ''}">${esc(text)}</div>`);
  if (logLines.length > 60) logLines = logLines.slice(-60);
  const el = $('#log');
  el.innerHTML = logLines.join('');
  el.scrollTop = el.scrollHeight;
}

function humanAction(p) {
  return new Promise(done => {
    const el = $('#controls');
    const toCall = Math.min(S.currentBet - p.bet, p.chips);
    const maxTo = p.bet + p.chips;
    const minTo = Math.min(S.currentBet + S.minRaise, maxTo);
    const canRaise = p.chips > toCall;
    const isBet = S.currentBet === 0;
    const step = blinds()[0];
    let raiseTo = minTo;

    const callLabel = toCall === 0 ? '체크' : (toCall >= p.chips ? `올인 콜 ${fmt(toCall)}` : `콜 ${fmt(toCall)}`);
    el.innerHTML = `
      <div class="turn">내 차례${toCall > 0 ? ` · 콜하려면 ${fmt(toCall)}` : ''}</div>
      <div class="row">
        ${toCall > 0 ? '<button class="act fold" data-a="fold">폴드</button>' : ''}
        <button class="act call" data-a="call">${callLabel}</button>
        ${canRaise ? `<button class="act raise" data-a="raise">${isBet ? '베팅' : '레이즈'} <span id="rAmt"></span></button>` : ''}
      </div>
      ${canRaise && maxTo > minTo ? `
      <div class="row sizes">
        <button data-q="min">최소</button>
        <button data-q="half">½팟</button>
        <button data-q="pot">팟</button>
        <button data-q="all">올인</button>
      </div>
      <input id="slider" type="range" min="${minTo}" max="${maxTo}" step="${step}" value="${minTo}">` : ''}`;
    el.classList.add('on');

    const setTo = v => {
      raiseTo = Math.max(minTo, Math.min(maxTo, v));
      if (raiseTo !== maxTo && raiseTo !== minTo) raiseTo = Math.max(minTo, Math.round(raiseTo / step) * step);
      const amt = $('#rAmt');
      if (amt) amt.textContent = raiseTo >= maxTo ? `올인 ${fmt(raiseTo)}` : fmt(raiseTo);
      const sl = $('#slider');
      if (sl && +sl.value !== raiseTo) sl.value = raiseTo;
    };
    setTo(minTo);

    const finish = a => { el.innerHTML = ''; el.classList.remove('on'); done(a); };
    el.onclick = e => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const pot = potTotal() + toCall;
      if (btn.dataset.q) {
        const q = btn.dataset.q;
        setTo(q === 'min' ? minTo : q === 'all' ? maxTo : S.currentBet + pot * (q === 'half' ? 0.5 : 1));
        return;
      }
      const a = btn.dataset.a;
      if (a === 'fold') finish({ type: 'fold' });
      else if (a === 'call') finish({ type: 'call' });
      else if (a === 'raise') finish({ type: 'raise', to: raiseTo });
    };
    const sl = $('#slider');
    if (sl) sl.oninput = () => setTo(+sl.value);
  });
}

function waitNext(label, autoMs = 0) {
  return new Promise(done => {
    const el = $('#controls');
    el.innerHTML = `<div class="row"><button class="act next">${label}</button></div>`;
    el.classList.add('on');
    const btn = el.querySelector('button');
    let timer = null;
    const finish = () => { clearTimeout(timer); el.innerHTML = ''; el.classList.remove('on'); done(); };
    if (autoMs) {
      let left = Math.ceil(autoMs / 1000);
      const tick = () => { if (left <= 0) return finish(); btn.textContent = `${label} (${left})`; left--; timer = setTimeout(tick, 1000); };
      tick();
    }
    el.onclick = e => { if (e.target.closest('button')) finish(); };
  });
}

async function gameLoop() {
  while (true) {
    await (isSeven() ? playHandSeven() : playHand());
    const me = P()[S.me];
    const alive = P().filter(p => p.chips > 0);
    if (S.multi) {
      const humansLeft = P().some(p => (p.human || p.remote) && p.chips > 0);
      if (alive.length === 1 || !humansLeft) {
        await sleep(900);
        const w = alive.length === 1 ? alive[0] : null;
        if (hooks.end) hooks.end(w ? P().indexOf(w) : -1);
        showEnd(w === me ? '🏆 우승!' : w ? `🏆 ${w.name} 우승` : '게임 끝',
          w ? `${S.handNo}판 만에 끝났어요. 최종 칩 ${fmt(w.chips)}` : '사람은 모두 탈락했어요.');
        return;
      }
      if (hooks.wait) hooks.wait(6000);
      await waitNext('다음 판 ▶', 6000);
      continue;
    }
    if (me.chips <= 0) {
      await sleep(900);
      showEnd('💸 칩을 모두 잃었어요', `${S.handNo}판 동안 버텼어요. 다시 도전해 볼까요?`);
      return;
    }
    if (alive.length === 1) {
      await sleep(900);
      showEnd('🏆 우승!', `${S.handNo}판 만에 모든 상대의 칩을 땄어요. 최종 칩 ${fmt(me.chips)}`);
      return;
    }
    await waitNext('다음 판 ▶');
  }
}

function prepareTable(mode) {
  for (const id of ['#start', '#end', '#lobby']) { const el = $(id); if (el) el.hidden = true; }
  logLines = []; boardShown = 0; seen = [];
  $('#log').innerHTML = ''; $('#controls').innerHTML = '';
  document.title = mode === 'seven' ? '포커 · 7포커' : '포커 · 텍사스 홀덤';
  $('.logo').textContent = mode === 'seven' ? '♣ 7포커' : '♠ 홀덤';
}

function showEnd(title, sub) {
  $('#endTitle').textContent = title;
  $('#endSub').textContent = sub;
  $('#end').hidden = false;
}

if (HAS_DOM) {
  let nBots = 3, mode = 'holdem';
  $('#mode').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    mode = b.dataset.m;
    for (const x of $('#mode').children) x.classList.toggle('on', x === b);
    $('#modeSub').textContent = mode === 'seven'
      ? '한국식 7포커 · 4장 받아 1장 버리고 1장 오픈 · 삥/따당/하프'
      : '조커 없는 52장 · 시작 칩 1,000 · 블라인드는 8판마다 올라가요';
  };
  $('#botCount').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    nBots = +b.dataset.n;
    for (const x of $('#botCount').children) x.classList.toggle('on', x === b);
  };
  const start = () => {
    newGame(nBots, false, mode);
    prepareTable(mode);
    render();
    gameLoop();
  };
  $('#btnStart').onclick = start;
  $('#btnAgain').onclick = () => {
    if (S && S.multi) { location.href = location.pathname; return; }
    $('#end').hidden = true; $('#start').hidden = false;
  };
  $('#btnNew').onclick = () => {
    if (!S || confirm(S.multi ? '방에서 나갈까요?' : '지금 게임을 그만두고 새로 시작할까요?')) location.href = location.pathname;
  };
  const showRule = t => {
    for (const b of $('#ruleTabs').children) b.classList.toggle('on', b.dataset.t === t);
    for (const d of document.querySelectorAll('[data-rule]')) d.hidden = d.dataset.rule !== t;
  };
  $('#ruleTabs').onclick = e => { const b = e.target.closest('button'); if (b) showRule(b.dataset.t); };
  const openRules = () => { showRule(S ? S.mode : mode); $('#rules').hidden = false; };
  $('#btnRules').onclick = openRules;
  document.querySelector('[data-open-rules]').onclick = openRules;
  $('#btnCloseRules').onclick = () => { $('#rules').hidden = true; };
  $('#rules').onclick = e => { if (e.target.id === 'rules') $('#rules').hidden = true; };
} else {
  // 테스트용 (node)
  globalThis.__poker = {
    evaluate, cmp, handName, equity, newDeck, bestFive, newGame, playHand,
    get S() { return S; }, setSpeed: v => { speed = v; },
  };
}
