'use strict';
/* 7포커 (한국식) — poker.js 다음에 불러옴
   · 참가비를 내고 4장을 받아 1장 버리고 1장을 오픈
   · 4구 · 5구 · 6구는 앞면, 7구(히든)는 뒷면으로 받고 매번 베팅
   · 베팅: 체크 · 삥 · 콜 · 따당 · 하프 · 다이 (한 라운드 레이즈는 4번까지)
   · 족보: 로티플 > 백스트레이트 플러시 > 스트레이트 플러시 > 포카드 > 풀하우스 > 플러시
           > 마운틴 > 백스트레이트 > 스트레이트 > 트리플 > 투페어 > 원페어 > 탑
   · 족보와 숫자가 같으면 무늬로: ♠ > ◆ > ♥ > ♣ (키커 없음) */

const SUIT_RANK = [4, 2, 3, 1]; // 인덱스 ♠ ♥ ♦ ♣ → ♠ 4, ♦ 3, ♥ 2, ♣ 1
const MAX_RAISES = 4;

function sortCards(cs) { return cs.slice().sort((a, b) => b.r - a.r || SUIT_RANK[b.s] - SUIT_RANK[a.s]); }
function fillFive(group, cards) {
  const used = new Set(group);
  return group.concat(sortCards(cards.filter(c => !used.has(c)))).slice(0, 5);
}

// 스트레이트 찾기 (마운틴 2 › 백스트레이트 1 › 일반 0)
function straightsK(pool) {
  const m = new Map();
  for (const c of pool) { const e = m.get(c.r); if (!e || SUIT_RANK[c.s] > SUIT_RANK[e.s]) m.set(c.r, c); }
  const run = rs => rs.every(r => m.has(r)) ? rs.map(r => m.get(r)) : null;
  let f;
  if ((f = run([14, 13, 12, 11, 10]))) return { kind: 2, high: 14, five: f };
  if ((f = run([14, 2, 3, 4, 5]))) return { kind: 1, high: 5, five: f };
  for (let h = 13; h >= 6; h--) if ((f = run([h, h - 1, h - 2, h - 3, h - 4]))) return { kind: 0, high: h, five: f };
  return null;
}

// 한국식 족보 → { s: 비교용 배열, five: 족보 카드 }
function evalK(cards) {
  const byRank = Array.from({ length: 15 }, () => []), bySuit = [[], [], [], []];
  for (const c of cards) { byRank[c.r].push(c); bySuit[c.s].push(c); }
  for (const g of byRank) g.sort((a, b) => SUIT_RANK[b.s] - SUIT_RANK[a.s]);
  const sr = c => SUIT_RANK[c.s];

  for (let s = 0; s < 4; s++) {
    if (bySuit[s].length < 5) continue;
    const st = straightsK(bySuit[s]);
    if (st) {
      if (st.kind === 2) return { s: [12, SUIT_RANK[s]], five: st.five };
      if (st.kind === 1) return { s: [11, SUIT_RANK[s]], five: st.five };
      return { s: [10, st.high, SUIT_RANK[s]], five: st.five };
    }
  }
  const quads = [], trips = [], pairs = [];
  for (let r = 14; r >= 2; r--) {
    if (byRank[r].length === 4) quads.push(r);
    else if (byRank[r].length === 3) trips.push(r);
    else if (byRank[r].length === 2) pairs.push(r);
  }
  if (quads.length) return { s: [9, quads[0]], five: fillFive(byRank[quads[0]], cards) };
  if (trips.length && (trips.length > 1 || pairs.length)) {
    const t = trips[0], p = Math.max(trips[1] || 0, pairs[0] || 0);
    return { s: [8, t], five: byRank[t].concat(byRank[p].slice(0, 2)) };
  }
  for (let s = 0; s < 4; s++) {
    if (bySuit[s].length < 5) continue;
    const f = sortCards(bySuit[s]).slice(0, 5);
    return { s: [7, ...f.map(c => c.r), SUIT_RANK[s]], five: f };
  }
  const st = straightsK(cards);
  if (st) {
    const a = byRank[14][0];
    if (st.kind === 2) return { s: [6, sr(a)], five: st.five };
    if (st.kind === 1) return { s: [5, sr(a)], five: st.five };
    return { s: [4, st.high, sr(byRank[st.high][0])], five: st.five };
  }
  if (trips.length) return { s: [3, trips[0]], five: fillFive(byRank[trips[0]], cards) };
  if (pairs.length >= 2) {
    const [a, b] = pairs;
    return { s: [2, a, b, sr(byRank[a][0])], five: fillFive(byRank[a].concat(byRank[b]), cards) };
  }
  if (pairs.length) return { s: [1, pairs[0], sr(byRank[pairs[0]][0])], five: fillFive(byRank[pairs[0]], cards) };
  const top = sortCards(cards)[0];
  return { s: [0, top.r, sr(top)], five: sortCards(cards).slice(0, 5) };
}

function handNameK(sc) {
  const [k, a, b] = sc;
  switch (k) {
    case 12: return '로열 스트레이트 플러시';
    case 11: return '백 스트레이트 플러시';
    case 10: return `${rs(a)} 스트레이트 플러시`;
    case 9: return `${rs(a)} 포카드`;
    case 8: return `${rs(a)} 풀하우스`;
    case 7: return `${rs(a)} 플러시`;
    case 6: return '마운틴';
    case 5: return '백 스트레이트';
    case 4: return `${rs(a)} 스트레이트`;
    case 3: return `${rs(a)} 트리플`;
    case 2: return `${rs(a)}·${rs(b)} 투페어`;
    case 1: return `${rs(a)} 원페어`;
    default: return `${rs(a)} 탑`;
  }
}

const ante = () => blinds()[0];
const openCards = p => p.hand.filter(c => c.up);
const roundRaises = () => P().reduce((a, q) => a + q.raises, 0);
const roundAnte = x => Math.max(ante(), Math.round(x / ante()) * ante());

// 보스: 보이는 카드가 가장 좋은 사람이 먼저
function bossSeat() {
  let best = null, seat = -1;
  for (const p of inHand()) {
    const sc = evalK(openCards(p)).s;
    if (!best || cmp(sc, best) > 0) { best = sc; seat = P().indexOf(p); }
  }
  return seat;
}

// ── 버리기 · 오픈 ──
function score3(cs) {
  let v = evalK(cs).s[0] * 100 + Math.max(...cs.map(c => c.r));
  const suits = new Set(cs.map(c => c.s)).size;
  if (suits === 1) v += 18; else if (suits === 2) v += 4;
  const rr = [...new Set(cs.map(c => c.r))].sort((a, b) => a - b);
  if (rr.length === 3 && rr[2] - rr[0] <= 4) v += 8;
  return v;
}
function botChoice(p) {
  let best = -1, bi = 0;
  for (let d = 0; d < p.hand.length; d++) {
    const v = score3(p.hand.filter((_, i) => i !== d)) + Math.random() * 2;
    if (v > best) { best = v; bi = d; }
  }
  const rest = p.hand.filter((_, i) => i !== bi);
  const cnt = r => rest.filter(c => c.r === r).length;
  const open = rest.filter(c => cnt(c.r) === 1).sort((a, b) => a.r - b.r)[0] || rest[rest.length - 1];
  return { discard: p.hand[bi], open };
}
function getChoice(p) {
  if (p.human) return humanChoose(p);
  if (p.remote && hooks.ask) return hooks.ask(p, 'choose');
  return botChoice(p);
}
function applyChoice(p, { discard, open }) {
  p.hand = p.hand.filter(c => c !== discard && c !== open).concat([open]);
  open.up = true;
}

function humanChoose(p) {
  return new Promise(done => {
    const el = $('#controls');
    let discard = null;
    const draw = () => {
      const list = discard ? p.hand.filter(c => c !== discard) : p.hand;
      el.innerHTML = `
        <div class="turn">${discard ? '상대에게 <b>보여줄 카드(오픈)</b> 1장을 고르세요' : '<b>버릴 카드</b> 1장을 고르세요'}</div>
        <div class="row pick">${list.map((c, i) => `<button data-i="${i}">${cardHTML(c)}</button>`).join('')}</div>`;
      el.classList.add('on');
      el.onclick = e => {
        const b = e.target.closest('button[data-i]'); if (!b) return;
        const c = list[+b.dataset.i];
        if (!discard) { discard = c; draw(); }
        else { el.innerHTML = ''; el.classList.remove('on'); done({ discard, open: c }); }
      };
    };
    draw();
  });
}

// ── 한 판 ──
async function playHandSeven() {
  beginHand();
  const live = P().filter(p => !p.out);
  for (const p of live) { put(p, ante()); p.bet = 0; }
  S.currentBet = 0; S.minRaise = ante();
  log(`참가비 ${fmt(ante())}씩`);

  S.stage = 'deal'; S.stageLabel = '카드 4장';
  for (let k = 0; k < 4; k++) {
    let i = S.dealer;
    for (let n = 0; n < live.length; n++) {
      i = nextIn(i);
      P()[i].hand.push(S.deck.pop());
      render(); await sleep(70);
    }
  }

  S.stage = 'choose'; S.stageLabel = '버리기 · 오픈';
  // 모두 동시에 고르고, 다 고르면 한꺼번에 오픈
  render();
  const choices = await Promise.all(live.map(p => getChoice(p)));
  live.forEach((p, i) => applyChoice(p, choices[i]));
  render(); await sleep(450);

  for (const n of [4, 5, 6, 7]) {
    if (inHand().length <= 1) break;
    if (canAct().length <= 1) for (const p of inHand()) p.show = true;
    endStreet();
    S.stage = n === 7 ? 'hidden' : `${n}구`;
    S.stageLabel = n === 7 ? '7구 · 히든' : `${n}구`;
    let i = S.dealer;
    for (let k = 0; k < P().length; k++) {
      i = (i + 1) % P().length;
      const p = P()[i];
      if (p.out || p.folded) continue;
      const c = S.deck.pop();
      c.up = n < 7;
      p.hand.push(c);
      render(); await sleep(130);
    }
    await sleep(300);
    if (canAct().length >= 2) {
      const b = bossSeat();
      log(`${S.stageLabel} · 보스 ${P()[b].name}`, 'sys');
      await bettingRound(b);
    }
  }
  endStreet();
  S.stageLabel = '';
  await showdown();
}

// ── 승률 (보이는 카드는 빼고 몬테카를로) ──
function equityK(p, iters) {
  const opps = inHand().filter(q => q !== p);
  if (!opps.length) return 1;
  const known = new Set(p.hand.map(cid));
  for (const q of P()) for (const c of q.hand) if (c.up) known.add(cid(c));
  const pool = [];
  for (let s = 0; s < 4; s++) for (let r = 2; r <= 14; r++) if (!known.has(r * 4 + s)) pool.push({ r, s });
  const myNeed = 7 - p.hand.length;
  const oppOpen = opps.map(openCards);
  const oppNeed = oppOpen.map(o => 7 - o.length); // 상대 최종 7장 = 보이는 카드 + 나머지 무작위
  const total = myNeed + oppNeed.reduce((a, b) => a + b, 0);
  if (total > pool.length) return 1 / (opps.length + 1);
  let score = 0;
  for (let it = 0; it < iters; it++) {
    for (let k = 0; k < total; k++) {
      const j = k + Math.floor(Math.random() * (pool.length - k));
      const t = pool[k]; pool[k] = pool[j]; pool[j] = t;
    }
    let k = myNeed;
    const mine = evalK(p.hand.concat(pool.slice(0, myNeed))).s;
    let lost = false, ties = 0;
    for (let o = 0; o < opps.length; o++) {
      const c = cmp(mine, evalK(oppOpen[o].concat(pool.slice(k, k + oppNeed[o]))).s);
      k += oppNeed[o];
      if (c < 0) { lost = true; break; }
      if (c === 0) ties++;
    }
    if (!lost) score += 1 / (ties + 1);
  }
  return score / iters;
}

// ── 베팅 ──
function sevenOptions(p) {
  const toCall = Math.min(S.currentBet - p.bet, p.chips);
  const pot = potTotal();
  const canRaise = p.chips > toCall && roundRaises() < MAX_RAISES;
  return {
    toCall, canRaise,
    bbing: { type: 'raise', to: ante(), label: '삥' },
    ddadang: { type: 'raise', to: S.currentBet * 2, label: '따당' },
    half: { type: 'raise', to: S.currentBet + roundAnte((pot + toCall) / 2), label: '하프' },
  };
}

async function botActionSeven(p) {
  await sleep(600 + Math.random() * 600);
  const st = p.style, o = sevenOptions(p);
  const nOpp = inHand().length - 1;
  const eq = equityK(p, 220);
  const strength = eq * (nOpp + 1);
  const r = Math.random();
  const canRaise = o.canRaise && p.raises < 2;

  if (o.toCall === 0) {
    if (canRaise && strength > 1.3 - st.aggr * 0.4 && r < 0.55 + st.aggr) return strength > 1.7 ? o.half : o.bbing;
    if (canRaise && r < st.bluff) return o.bbing;
    return { type: 'check' };
  }
  const potOdds = o.toCall / (potTotal() + o.toCall);
  const need = potOdds + st.tight;
  if (canRaise && strength > 1.55 - st.aggr * 0.5 && eq > need + 0.12 && r < 0.35 + st.aggr) {
    return (eq > 0.7 || r < 0.4) ? o.half : o.ddadang;
  }
  if (eq >= need) return { type: 'call' };
  if (o.toCall <= ante() * 2 && eq >= need * 0.7) return { type: 'call' };
  return { type: 'fold' };
}

function humanActionSeven(p) {
  return new Promise(done => {
    const el = $('#controls');
    const o = sevenOptions(p);
    const maxTo = p.bet + p.chips;
    const tag = a => Math.min(a.to, maxTo) >= maxTo ? `올인 ${fmt(maxTo)}` : fmt(a.to);
    const btns = [];
    if (o.toCall > 0) btns.push(['fold', 'fold', '다이']);
    if (o.toCall === 0) btns.push(['check', 'call', '체크']);
    else btns.push(['call', 'call', o.toCall >= p.chips ? `올인 콜 ${fmt(o.toCall)}` : `콜 ${fmt(o.toCall)}`]);
    if (o.canRaise) {
      if (S.currentBet === 0) btns.push(['bbing', 'raise', `삥 ${tag(o.bbing)}`]);
      else btns.push(['ddadang', 'raise', `따당 ${tag(o.ddadang)}`]);
      btns.push(['half', 'raise', `하프 ${tag(o.half)}`]);
    }
    const now = handNameK(evalK(p.hand).s);
    el.innerHTML = `
      <div class="turn">내 차례 · 지금 내 패: <b>${now}</b>${o.toCall > 0 ? ` · 콜 ${fmt(o.toCall)}` : ''}${!o.canRaise && p.chips > o.toCall ? ' · 이번 라운드 레이즈 끝' : ''}</div>
      <div class="row">${btns.map(([k, c, t]) => `<button class="act ${c}" data-k="${k}">${t}</button>`).join('')}</div>`;
    el.classList.add('on');
    el.onclick = e => {
      const b = e.target.closest('button[data-k]'); if (!b) return;
      const k = b.dataset.k;
      el.innerHTML = ''; el.classList.remove('on');
      done(k === 'fold' ? { type: 'fold' } : k === 'check' ? { type: 'check' } : k === 'call' ? { type: 'call' } : o[k]);
    };
  });
}
