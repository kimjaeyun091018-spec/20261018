// 메뉴 화면들 (DOM)
import { CHARS, CHAR_KEYS, ELEMENTS, TREE, CHAPTERS, REACTIONS, HERO_SPRITE, HERO_SHEETS, AUGMENTS, ITEMS, RARITY, RARITY_ORDER, BOXES, GACHA } from './data.js';
import { COLOSSEUM_ARENAS } from './maps.js';
import * as SV from './save.js';
import { sfx } from './audio.js';

const $menu = document.getElementById('menu');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const V = window.__ASSET_V || 1;
const heroes = new Image();
heroes.src = `assets/heroes.png?v=${V}`;
const busts = new Image();
busts.src = `assets/portraits.png?v=${V}`;
const HS = HERO_SPRITE.size;
const OWN = Object.fromEntries(Object.entries(HERO_SHEETS).map(([k, v]) => { const i = new Image(); i.src = `assets/${v.file}?v=${V}`; return [k, { ...v, img: i }]; }));

// 캐릭터 초상 (움직이는 작은 캔버스)
const portraits = new Set();
function portrait(char, size = 72, bust = false) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  c.className = 'portrait' + (bust ? ' bust' : '');
  c.dataset.char = char;
  if (bust) c.dataset.bust = '1';
  portraits.add(c);
  return c;
}
let animT = 0;
function animPortraits(t) {
  animT = t;
  for (const c of portraits) {
    if (!c.isConnected) { portraits.delete(c); continue; }
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, c.width, c.height);
    const C = CHARS[c.dataset.char];
    const el = ELEMENTS[C.el];
    const locked = c.closest('.locked');
    const gr = g.createRadialGradient(c.width / 2, c.height * 0.6, 2, c.width / 2, c.height * 0.6, c.width / 2);
    gr.addColorStop(0, el.color + (locked ? '22' : '66')); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
    if (c.dataset.bust) {
      const P = HERO_SPRITE.portrait;
      if (busts.complete && busts.naturalWidth) g.drawImage(busts, CHAR_KEYS.indexOf(c.dataset.char) * P, 0, P, P, 0, 0, c.width, c.height);
    } else {
      const on = c.closest('.on');
      const cyc = Math.floor(t / 140) % 14;
      const f = on && cyc >= 10 ? 10 + Math.min(2, cyc - 10) : Math.floor(t / 230) % 4;
      const own = OWN[c.dataset.char];
      if (own && own.img.complete && own.img.naturalWidth) {
        // 발끝 기준으로 맞춰서 기본 영웅과 같은 크기로 보이게
        const k = (c.width / HS) * (own.scale / HERO_SPRITE.draw * HS);
        const D = own.cell * k;
        g.drawImage(own.img, f * own.cell, 0, own.cell, own.cell, (c.width - D) / 2, c.height * (46 / 48) - (own.cell - 2) * k, D, D);
      } else if (heroes.complete) g.drawImage(heroes, f * HS, C.row * HS, HS, HS, 0, 0, c.width, c.height);
    }
    if (locked) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(10,8,20,.55)'; g.fillRect(0, 0, c.width, c.height); g.globalCompositeOperation = 'source-over'; }
  }
  requestAnimationFrame(animPortraits);
}
requestAnimationFrame(animPortraits);

function show(html) { $menu.innerHTML = html; $menu.hidden = false; $menu.scrollTop = 0; }
export function hide() { $menu.hidden = true; $menu.innerHTML = ''; }
function bind(sel, fn) { $menu.querySelectorAll(sel).forEach((el) => el.addEventListener('click', (e) => { sfx('ui'); fn(el, e); })); }

const SKILL_KEYS = ['클릭/J', 'Q/K', 'E/L', 'R/;'];
const TYPE_NAME = { slash: '근접', shot: '투사체', dashstrike: '돌진', stream: '줄기', blink: '이동', nova: '광역', zone: '지대', line: '연속', snipe: '저격', markall: '표식', detonate: '기폭', strikes: '낙뢰' };

// ---------- 1. 시작 화면: 로고 + "눌러서 시작" ----------
export function start(h) {
  show(`
    <div class="start">
      <div class="logo big"><span class="l1">원소</span><span class="l2">아레나</span></div>
      <p class="tag">원소를 엮어 반응을 터뜨리고, 적을 날려 버려라!</p>
      <p class="press">화면을 눌러 시작</p>
      <p class="ver">ELEMENT ARENA · ${String(window.__ASSET_V || '').slice(0, 8)}</p>
    </div>`);
  $menu.classList.add('startbg');
  let gone = false;
  const go = (e) => {
    if (gone) return;
    gone = true;
    e?.preventDefault?.();
    removeEventListener('keydown', go);
    $menu.classList.remove('startbg');
    sfx('ui');
    h.started();
  };
  $menu.querySelector('.start').addEventListener('pointerdown', go);
  addEventListener('keydown', go);
}

// ---------- 3. 로비: 계정 · 영웅 · 모드 ----------
export function lobby(h) {
  const s = SV.S();
  const C = CHARS[s.char], E = ELEMENTS[C.el];
  const a = h.accountInfo();
  show(`
    <div class="lobby">
      <header class="lbar">
        <div class="logo small"><span class="l1">원소</span><span class="l2">아레나</span></div>
        <div class="lstat">
          <span class="gold">💰 ${s.gold} G</span>
          <span class="lvchip">🏆 최고 ${(s.stats.best || 0) >= 16 ? '완주' : s.stats.best ? `${Math.floor((s.stats.best - 1) / 5) + 1}-${((s.stats.best - 1) % 5) + 1}` : '-'}</span>
          <button class="achip" data-act="acct">${a ? `<span class="gdot">G</span> ${esc(a.name || '구글 계정')}` : '👤 게스트'}</button>
        </div>
      </header>
      <div class="lmain">
        <section class="showcase" style="--c:${C.color}">
          <div class="stage"><div class="bustslot big"></div></div>
          <div class="sinfo">
            <div class="hero-name"><b>${C.name}</b> <span class="ctitle">${C.title}</span></div>
            <div class="hero-tags"><span class="badge" style="background:${E.color}">${E.name}</span> <span class="role">${C.role}</span></div>
            <p class="quote">“${C.quote}”</p>
            ${a?.nick
              ? `<div class="namerow"><label>닉네임</label><b class="nickfix">${esc(a.nick)}</b><button class="mini" data-act="nick">변경</button></div>`
              : `<div class="namerow"><label>닉네임</label><input id="nick" maxlength="10" placeholder="닉네임" value="${esc(s.name)}"></div>`}
            <button class="swap" data-go="chars">영웅 바꾸기 (${s.owned.length}/${CHAR_KEYS.length})</button>
          </div>
        </section>
        <section class="modes">
          <button class="big story" data-go="story"><b>스토리 모드</b><small>스테이지 돌파 · 증강 · 최대 4명 협동</small></button>
          <button class="big colo" data-go="colo"><b>콜로세움</b><small>친구·봇과 대난투식 대전 · 날려서 링아웃</small></button>
          <button class="big boxbtn" data-go="boxes"><span class="mchest"><i></i></span><span><b>뽑기 상자</b><small>${SV.allOwned() ? '모든 영웅을 모았어요!' : `새 영웅을 뽑아 보세요 · 영웅 ${s.owned.length}/${CHAR_KEYS.length}`}</small></span></button>
          <div class="rowbtns">
            <button data-go="tree">🌳 스킬 트리</button>
            <button data-go="join">🔗 코드로 참가</button>
            <button data-go="guide">📖 도움말</button>
          </div>
          <div class="acct" id="acct"></div>
        </section>
      </div>
      <p class="foot">PC: WASD 이동 · 마우스 조준 · 클릭 공격 · Q E R 스킬 · Space 대시 &nbsp;|&nbsp; 모바일: 왼쪽 조이스틱 · 오른쪽 버튼 (자동 조준)</p>
    </div>`);
  $menu.querySelector('.bustslot').appendChild(portrait(s.char, 160, true));
  const nick = $menu.querySelector('#nick');
  nick?.addEventListener('change', () => SV.setName(nick.value.trim()));
  bind('[data-go]', (el) => { if (nick) SV.setName(nick.value.trim()); h.go(el.dataset.go); });
  bind('[data-act=nick]', () => nickname(h, { first: false }));
  bind('[data-act=acct]', () => $menu.querySelector('#acct').scrollIntoView({ behavior: 'smooth', block: 'center' }));
  account(h);
}
// 계정 줄: 게스트면 구글 로그인 버튼, 구글이면 이름·저장 상태·동기화·로그아웃
export function account(h) {
  const el = $menu.querySelector('#acct');
  if (!el) return;
  const a = h.accountInfo();
  el.innerHTML = a
    ? `<span class="who"><span class="gdot">G</span> <b>${esc(a.name || '구글 계정')}</b> <small>${esc(a.status || '클라우드 저장 켜짐')}</small></span>
       <button class="mini sync">지금 동기화</button><button class="mini out">로그아웃</button>`
    : `<span class="who">👤 <b>게스트</b> <small>이 기기에만 저장돼요</small></span>
       <button class="mini google"><span class="gdot">G</span> 구글 로그인</button>`;
  h.preload?.();
  const msg = (t) => toast(t);
  bind('.google', async (b) => { b.disabled = true; try { msg(await h.google()); } catch (e) { msg(e.message); } h.refresh(); });
  bind('.sync', async (b) => { b.disabled = true; try { msg(await h.sync()); } catch (e) { msg(e.message); } h.refresh(); });
  bind('.out', () => { if (confirm('로그아웃할까요? (진행은 클라우드에 남아 있어요)')) { h.logout(); h.refresh(); } });
}
// 처음 들어왔을 때: 구글로 로그인 / 게스트로 시작
// ---------- 닉네임 정하기 (구글 계정, 다른 사람과 겹치면 안 됨) ----------
export function nickname(h, opt = {}) {
  const a = h.accountInfo();
  show(`
    <div class="loginwrap">
      <div class="panel small loginbox">
        <h2>${opt.first ? '닉네임 정하기' : '닉네임 바꾸기'}</h2>
        <p class="sub">${opt.first ? '처음 오셨네요! 친구들에게 보일 닉네임을 정해 주세요.<br>' : ''}다른 사람과 같은 닉네임은 쓸 수 없어요. 한글·영어·숫자·_ 로 2~10자.</p>
        <input id="nk" class="nkin" maxlength="10" placeholder="닉네임" value="${esc(a?.nick || '')}" autocomplete="off">
        <p class="nkst" id="nkst">&nbsp;</p>
        <div class="col">
          <button class="big go ok" disabled>이 닉네임으로 정하기</button>
          ${opt.first ? '<button class="linkbtn out">다른 계정으로 (로그아웃)</button>' : '<button class="linkbtn back">← 취소</button>'}
        </div>
      </div>
    </div>`);
  const inp = $menu.querySelector('#nk'), st = $menu.querySelector('#nkst'), ok = $menu.querySelector('.ok');
  let timer = 0, seq = 0;
  const setSt = (t, cls) => { st.textContent = t; st.className = 'nkst ' + (cls || ''); };
  const check = () => {
    const v = inp.value.trim();
    ok.disabled = true;
    if (!v) return setSt('\u00a0');
    if (!h.nickRule.test(v)) return setSt('한글·영어·숫자·_ 로 2~10자만 쓸 수 있어요', 'bad');
    if (v === a?.nick) return setSt('지금 쓰고 있는 닉네임이에요', '');
    setSt('확인하는 중…');
    const my = ++seq;
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
        const free = await h.nickFree(v);
        if (my !== seq) return;
        if (free) { setSt('✓ 쓸 수 있는 닉네임이에요', 'good'); ok.disabled = false; } else setSt('✗ 이미 다른 사람이 쓰고 있어요', 'bad');
      } catch (e) { if (my === seq) setSt(e.message, 'bad'); }
    }, 350);
  };
  inp.addEventListener('input', check);
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !ok.disabled) ok.click(); });
  inp.focus();
  check();
  bind('.ok', async () => {
    ok.disabled = true;
    try { toast(await h.setNick(inp.value.trim())); h.done(); } catch (e) { setSt(e.message, 'bad'); }
  });
  bind('.out', () => { h.logout(); h.refresh(); });
  bind('.back', () => h.done());
}

// ---------- 2. 로그인 메뉴 ----------
export function login(h) {
  show(`
    <div class="loginwrap">
      <div class="logo"><span class="l1">원소</span><span class="l2">아레나</span></div>
      <div class="panel small loginbox">
        <h2>로그인</h2>
        <p class="sub">구글로 로그인하면 골드·영웅·스킬 트리가 클라우드에 저장돼서 태블릿·PC 어디서든 이어서 할 수 있어요.</p>
        <div class="col">
          <button class="big google"><span class="gdot">G</span> 구글로 로그인</button>
          <button class="guest">게스트로 시작 (이 기기에만 저장)</button>
        </div>
        <p class="status" id="lst"></p>
        <button class="linkbtn back">← 처음 화면으로</button>
      </div>
    </div>`);
  bind('.back', () => h.toStart());
  h.preload?.();
  bind('.google', async (b) => {
    b.disabled = true;
    try { toast(await h.google()); h.done(); } catch (e) { $menu.querySelector('#lst').textContent = e.message; b.disabled = false; }
  });
  bind('.guest', () => { h.guest(); h.done(); });
}

// ---------- 캐릭터 ----------
export function chars(h) {
  const draw = (sel) => {
    const s = SV.S();
    sel = sel || s.char;
    show(`
      <div class="panel wide">
        <div class="head"><button class="back">← 뒤로</button><h2>영웅</h2><span class="gold">💰 ${s.gold} G</span></div>
        <div class="chargrid">${CHAR_KEYS.map((k) => {
          const C = CHARS[k], E = ELEMENTS[C.el], own = SV.owns(k);
          const R = RARITY[C.rarity] || RARITY.start;
          return `<button class="char ${k === sel ? 'on' : ''} ${own ? '' : 'locked'} ${k === s.char ? 'cur' : ''}" data-c="${k}" style="--c:${C.color};--r:${R.color}">
            <span class="rtag">${R.name}</span>
            <span class="pslot"></span>
            <span class="cname">${C.name}</span>
            <span class="ctitle">${C.title}</span>
            <span class="badge" style="background:${E.color}">${E.name}</span>
            ${own ? (k === s.char ? '<span class="tagcur">사용 중</span>' : '') : '<span class="price">🔒 상자에서 뽑기</span>'}
          </button>`;
        }).join('')}</div>
        <div class="detail hero" id="detail"></div>
      </div>`);
    $menu.querySelectorAll('.char').forEach((b) => b.querySelector('.pslot').appendChild(portrait(b.dataset.c, 64)));
    const C = CHARS[sel], E = ELEMENTS[C.el], own = SV.owns(sel);
    const det = $menu.querySelector('#detail');
    det.innerHTML = `
      <div class="hero-top" style="--c:${C.color}">
        <div class="bustslot"></div>
        <div class="hero-info">
          <div class="hero-name"><b>${C.name}</b> <span class="ctitle">${C.title}</span></div>
          <div class="hero-tags"><span class="badge" style="background:${E.color}">${E.name}</span> <span class="badge rar" style="background:${(RARITY[C.rarity] || RARITY.start).color}">${(RARITY[C.rarity] || RARITY.start).name}</span> <span class="role">${C.role}</span> <small>무게 ${C.weight} · 속도 ${C.speed}</small></div>
          <p class="quote">“${C.quote}”</p>
          <p class="lore">${C.lore}</p>
        </div>
      </div>
      <div class="sklist">${C.skills.map((S, i) => `<div class="skc${i ? '' : ' basic'}"><span class="key">${SKILL_KEYS[i]}</span><b>${S.name}</b>
        <small>${TYPE_NAME[S.type] || ''}${S.el ? ' · ' + ELEMENTS[S.el].name : ''} · ${S.cd}초</small></div>`).join('')}</div>
      <p class="sub">${C.desc}</p>
      <div class="rowbtns">${own
        ? (sel === s.char ? '<button class="big pick" disabled>사용 중</button>' : '<button class="big pick">이 영웅으로 출전</button>')
        : `<button class="big gobox">🎁 뽑기 상자에서 얻기</button><button class="big buy" ${s.gold < C.price ? 'disabled' : ''}>💰 ${C.price.toLocaleString()} G로 바로 영입${s.gold < C.price ? `<small>골드 ${(C.price - s.gold).toLocaleString()} 부족</small>` : ''}</button>`}</div>`;
    det.querySelector('.bustslot').appendChild(portrait(sel, 128, true));
    bind('.char', (el) => draw(el.dataset.c));
    bind('.pick', () => { SV.setChar(sel); h.onChar?.(sel); draw(sel); });
    bind('.buy', () => { if (!confirm(`${C.name}을(를) ${C.price.toLocaleString()} G로 바로 영입할까요?\n(뽑기 상자로 얻는 편이 훨씬 싸요)`)) return; if (SV.buyChar(sel)) { sfx('buy'); toast(`${C.name} 영입 완료!`); h.onChar?.(sel); } draw(sel); });
    bind('.gobox', () => h.go('boxes'));
    bind('.back', () => h.back());
  };
  draw();
}

// ---------- 뽑기 상자 ----------
const pctTxt = (p) => (p >= 0.1 ? (p * 100).toFixed(0) : p >= 0.01 ? (p * 100).toFixed(1) : (p * 100).toFixed(2)) + '%';
function chestHtml(color, cls = '') { return `<div class="chest ${cls}" style="--bc:${color}"><div class="clid"><i></i></div><div class="cbody"><i class="lock"></i></div></div>`; }
export function boxes(h) {
  const s = SV.S();
  const all = SV.allOwned();
  const odds = SV.gachaOdds('small');
  const left = GACHA.pity - s.pity;
  show(`
    <div class="panel wide boxshop">
      <div class="head"><button class="back">← 뒤로</button><h2>뽑기 상자</h2><span class="gold">💰 ${s.gold.toLocaleString()} G</span></div>
      <p class="sub center">상자 한 칸마다 <b>아직 없는 영웅</b>이 나올 수 있어요. 안 나오면 골드! 영웅이 안 나올수록 <b>행운</b>이 쌓여 확률이 올라가요.</p>
      <div class="boxes">${Object.entries(BOXES).map(([k, B]) => `
        <div class="boxcard" style="--bc:${B.color}">
          ${chestHtml(B.color, 'small ' + k)}
          <b>${B.name}</b>
          <small>${B.drops}칸${B.luck > 1 ? ` · 행운 +${Math.round((B.luck - 1) * 100)}%` : ''}</small>
          <button class="big open" data-box="${k}" ${all || s.gold < B.price ? 'disabled' : ''}>💰 ${B.price.toLocaleString()} G</button>
        </div>`).join('')}</div>
      ${all ? '<p class="sub center"><b>🎉 모든 영웅을 모았어요!</b></p>' : `
      <div class="luck"><span>🍀 행운</span><div class="lbar"><i style="width:${Math.min(100, (s.pity / GACHA.pity) * 100)}%"></i></div><span><b>${left}</b>칸 안에 영웅 확정</span></div>
      <div class="odds">${RARITY_ORDER.map((r) => `<div style="--r:${RARITY[r].color}"><b>${RARITY[r].name}</b><span>${odds[r] ? pctTxt(odds[r]) : '모두 보유'}</span></div>`).join('')}</div>
      <p class="sub center tiny">한 칸당 확률 (원소 상자 기준, 지금 행운 포함) · 이미 가진 영웅은 다시 나오지 않아요</p>`}
      <h3>영웅 도감 ${s.owned.length}/${CHAR_KEYS.length}</h3>
      <div class="dex">${CHAR_KEYS.map((k) => { const C = CHARS[k], R = RARITY[C.rarity] || RARITY.start, own = SV.owns(k); return `<div class="dx ${own ? '' : 'locked'}" style="--r:${R.color}" data-c="${k}"><span class="pslot"></span><small>${own ? C.name : '???'}</small></div>`; }).join('')}</div>
    </div>`);
  $menu.querySelectorAll('.dx').forEach((d) => d.querySelector('.pslot').appendChild(portrait(d.dataset.c, 48, true)));
  bind('.back', () => h.back());
  bind('.open', (b) => {
    const drops = SV.openBox(b.dataset.box);
    if (!drops) return;
    h.onGold?.();
    openBox(h, b.dataset.box, drops);
  });
}
// 상자 여는 연출: 누를 때마다 한 칸씩 (영웅이 나올 칸은 상자가 그 등급 색으로 빛남)
function openBox(h, key, drops) {
  const B = BOXES[key];
  let i = -1;
  show(`
    <div class="boxopen" style="--bc:${B.color}">
      <div class="rays"></div>
      <div class="bstage">${chestHtml(B.color, 'huge ' + key)}</div>
      <div class="reveal"></div>
      <p class="left"></p>
      <p class="tap">눌러서 열기</p>
    </div>`);
  const root = $menu.querySelector('.boxopen');
  const chest = root.querySelector('.chest'), rev = root.querySelector('.reveal'), leftEl = root.querySelector('.left'), tap = root.querySelector('.tap');
  // 남은 칸 중 가장 높은 등급 영웅
  const heroLeft = () => drops.slice(i + 1).filter((d) => d.t === 'hero').sort((x, y) => RARITY_ORDER.indexOf(CHARS[y.c].rarity) - RARITY_ORDER.indexOf(CHARS[x.c].rarity))[0];
  const setLeft = () => { const n = drops.length - i - 1; leftEl.textContent = n > 0 ? `남은 칸 ${n}` : ''; };
  // 영웅이 남아 있으면 상자가 그 색으로 빛남 (브롤스타즈 느낌)
  const glow = () => { const d = heroLeft(); chest.style.setProperty('--glow', d ? RARITY[CHARS[d.c].rarity].color : 'transparent'); chest.classList.toggle('hasHero', !!d); };
  setLeft(); glow();
  let busy = false;
  const next = () => {
    if (busy) return;
    i++;
    if (i >= drops.length) return summary();
    const d = drops[i];
    busy = true;
    chest.classList.remove('pop'); void chest.offsetWidth; chest.classList.add('pop');
    sfx(d.t === 'hero' ? 'chest' : 'ui');
    setTimeout(() => {
      busy = false;
      setLeft(); glow();
      if (d.t === 'gold') {
        sfx('gold');
        rev.innerHTML = `<div class="dcard gold ${d.jackpot ? 'jack' : ''}"><span class="coin">💰</span><b>+${d.n} G</b>${d.jackpot ? '<small>잭팟!</small>' : ''}</div>`;
        root.classList.remove('herofx');
      } else {
        const C = CHARS[d.c], R = RARITY[C.rarity], E = ELEMENTS[C.el];
        sfx('buy');
        root.style.setProperty('--hr', R.color);
        root.classList.add('herofx');
        rev.innerHTML = `<div class="dcard hero" style="--r:${R.color};--c:${C.color}">
          <span class="new">새 영웅!</span>
          <span class="rname">${R.name}</span>
          <span class="bslot"></span>
          <b>${C.name}</b><small>${C.title} · <span style="color:${E.color}">${E.name}</span> · ${C.role}</small>
          <p class="quote">“${C.quote}”</p>
        </div>`;
        rev.querySelector('.bslot').appendChild(portrait(d.c, 150, true));
      }
      tap.textContent = i + 1 < drops.length ? '눌러서 다음 칸' : '눌러서 마무리';
    }, d.t === 'hero' ? 650 : 280);
  };
  const summary = () => {
    const gold = drops.filter((d) => d.t === 'gold').reduce((a, d) => a + d.n, 0);
    const hs = drops.filter((d) => d.t === 'hero');
    const s = SV.S();
    root.classList.remove('herofx');
    root.innerHTML = `<div class="panel small sumbox">
      <h2>${B.name}</h2>
      <div class="sumlist">
        ${hs.map((d) => `<div class="sh" style="--r:${RARITY[CHARS[d.c].rarity].color}" data-c="${d.c}"><span class="pslot"></span><b>${CHARS[d.c].name}</b><small>${RARITY[CHARS[d.c].rarity].name}</small></div>`).join('')}
        <div class="sg">💰 <b>+${gold} G</b></div>
      </div>
      ${hs.length ? '' : `<p class="sub">이번엔 영웅이 없었어요… 🍀 행운이 쌓였어요 (${GACHA.pity - s.pity}칸 안에 확정)</p>`}
      <div class="col">
        ${hs.length ? `<button class="big go use" data-c="${hs[hs.length - 1].c}">${CHARS[hs[hs.length - 1].c].name}(으)로 출전</button>` : ''}
        <button class="big again" ${SV.allOwned() || s.gold < B.price ? 'disabled' : ''}>한 번 더 (💰 ${B.price.toLocaleString()} G)</button>
        <button class="linkbtn back">← 상자 목록 (보유 💰 ${s.gold.toLocaleString()} G)</button>
      </div>
    </div>`;
    root.querySelectorAll('.sh').forEach((e) => e.querySelector('.pslot').appendChild(portrait(e.dataset.c, 56, true)));
    bind('.use', (b) => { SV.setChar(b.dataset.c); h.onChar?.(b.dataset.c); toast(`${CHARS[b.dataset.c].name}(으)로 출전!`); boxes(h); });
    bind('.again', () => { const d2 = SV.openBox(key); if (d2) { h.onGold?.(); openBox(h, key, d2); } });
    bind('.back', () => boxes(h));
  };
  root.addEventListener('pointerdown', (e) => { if (i < drops.length && !e.target.closest('button')) next(); });
  const onKey = (e) => { if (!root.isConnected) { removeEventListener('keydown', onKey); return; } if ((e.code === 'Space' || e.code === 'Enter') && i < drops.length) { e.preventDefault(); next(); } };
  addEventListener('keydown', onKey);
}

// ---------- 스토리 장 선택 ----------
export function story(h) {
  const s = SV.S();
  const best = s.stats.best || 0;
  const bestTxt = best >= 16 ? '모든 장 돌파!' : best ? `${Math.floor((best - 1) / 5) + 1}-${((best - 1) % 5) + 1}` : '아직 없음';
  show(`
    <div class="panel">
      <div class="head"><button class="back">← 뒤로</button><h2>스토리 모드</h2><span class="gold">💰 ${s.gold} G</span></div>
      <p class="sub">모험은 언제나 <b>1-1</b>부터 시작해서, 쓰러지지 않는 한 <b>3-5</b>까지 쉬지 않고 이어집니다.<br>
      증강은 한 판 동안 계속 쌓이고, 전멸하면 처음부터! 모은 골드는 스킬 트리와 영웅 영입에 쓰세요.</p>
      <div class="route">${CHAPTERS.map((C, i) => `<div class="rch" style="--f:${C.floor[0]};--w:${C.wallTop}"><b>${i + 1}장</b><small>${C.name}</small><span>${[1, 2, 3, 4, 5].map((n) => `<i class="${n === 5 ? 'boss' : ''} ${best >= i * 5 + n ? 'done' : ''}"></i>`).join('')}</span></div>`).join('<span class="rarrow">▶</span>')}</div>
      <p class="sub center">🏆 최고 기록: <b>${bestTxt}</b> · 완주 ${s.stats.wins || 0}회</p>
      <div class="col">
        <button class="big go solo">모험 시작 (혼자)</button>
        <button class="big go2 online">방 만들어 친구와 함께 (최대 4명)</button>
      </div>
    </div>`);
  bind('.solo', () => h.start({ mode: 'story', ch: 0, online: false }));
  bind('.online', () => h.start({ mode: 'story', ch: 0, online: true }));
  bind('.back', () => h.back());
}

// ---------- 콜로세움 ----------
export function colo(h) {
  show(`
    <div class="panel">
      <div class="head"><button class="back">← 뒤로</button><h2>콜로세움</h2><span></span></div>
      <p class="sub">체력 대신 <b>%</b>가 쌓이고, %가 높을수록 멀리 날아갑니다. 구덩이로 떨어뜨리면 목숨 -1. 목숨 3개.<br>공정한 대결을 위해 스킬 트리는 꺼집니다.</p>
      <h3>경기장</h3>
      <div class="opts" id="arena">${COLOSSEUM_ARENAS.map((A, i) => `<button class="opt ${i ? '' : 'on'}" data-v="${i}">${A.name}</button>`).join('')}</div>
      <h3>방식</h3>
      <div class="opts" id="fmt">
        <button class="opt on" data-v="1v1">1 : 1 (봇)</button>
        <button class="opt" data-v="2v2">2 : 2 (나+봇 vs 봇)</button>
        <button class="opt" data-v="ffa">4인 난투 (봇)</button>
        <button class="opt" data-v="online">온라인 방 만들기</button>
      </div>
      <button class="go big">입장!</button>
    </div>`);
  const pick = (id) => $menu.querySelector(`#${id} .on`).dataset.v;
  $menu.querySelectorAll('.opts').forEach((g) => g.querySelectorAll('.opt').forEach((b) => b.addEventListener('click', () => { sfx('ui'); g.querySelectorAll('.opt').forEach((x) => x.classList.toggle('on', x === b)); })));
  bind('.go', () => h.start({ mode: 'colosseum', arena: Number(pick('arena')), fmt: pick('fmt'), online: pick('fmt') === 'online' }));
  bind('.back', () => h.back());
}

// ---------- 스킬 트리 ----------
export function tree(h) {
  const draw = () => {
    const s = SV.S();
    const xs = TREE.map((n) => n.x), ys = TREE.map((n) => n.y);
    const minX = Math.min(...xs), minY = Math.min(...ys);
    const cell = 96, W = (Math.max(...xs) - minX + 1) * cell, H = (Math.max(...ys) - minY + 1) * cell;
    const pos = (n) => [(n.x - minX) * cell + cell / 2, (n.y - minY) * cell + cell / 2];
    const lines = TREE.flatMap((n) => (n.req || []).map((r) => { const m = TREE.find((t) => t.id === r); const [x1, y1] = pos(n), [x2, y2] = pos(m); const on = s.tree.includes(n.id) && s.tree.includes(r); return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${on ? 'on' : ''}"/>`; })).join('');
    show(`
      <div class="panel wide">
        <div class="head"><button class="back">← 뒤로</button><h2>스킬 트리</h2><span class="gold">💰 ${s.gold} G</span></div>
        <p class="sub">스토리 모드에만 적용됩니다. 연결된 칸을 따라 열 수 있어요.</p>
        <div class="treewrap"><div class="tree" style="width:${W}px;height:${H}px">
          <svg width="${W}" height="${H}">${lines}</svg>
          ${TREE.map((n) => { const [x, y] = pos(n); const own = s.tree.includes(n.id), can = SV.canBuy(n.id); return `<button class="node ${own ? 'own' : can ? (s.gold >= n.cost ? 'can' : 'poor') : 'lock'}" data-id="${n.id}" style="left:${x}px;top:${y}px"><b>${n.name}</b><small>${own ? '보유' : n.cost + ' G'}</small></button>`; }).join('')}
        </div></div>
        <div class="detail" id="tdesc">칸을 눌러 효과를 보세요.</div>
        <div class="rowbtns"><button class="reset">전부 되돌리기 (골드 환불)</button></div>
      </div>`);
    let sel = null;
    bind('.node', (el) => {
      const n = TREE.find((t) => t.id === el.dataset.id);
      if (sel === n.id && SV.buy(n.id)) { sfx('buy'); draw(); return; }
      sel = n.id;
      const own = s.tree.includes(n.id), can = SV.canBuy(n.id);
      $menu.querySelector('#tdesc').innerHTML = `<b>${n.name}</b> — ${n.desc}<br><small>${own ? '이미 보유' : !can ? '연결된 칸을 먼저 여세요' : s.gold < n.cost ? `골드가 부족해요 (${n.cost} G)` : `한 번 더 누르면 ${n.cost} G로 구매`}</small>`;
    });
    bind('.reset', () => { if (confirm('스킬 트리를 모두 되돌리고 골드를 돌려받을까요?')) { SV.resetTree(); draw(); } });
    bind('.back', () => h.back());
  };
  draw();
}

// ---------- 참가 ----------
export function join(h) {
  show(`
    <div class="panel">
      <div class="head"><button class="back">← 뒤로</button><h2>코드로 참가</h2><span></span></div>
      <p class="sub">친구가 만든 방의 5글자 코드를 입력하세요. 지금 고른 캐릭터로 들어갑니다.</p>
      <div class="namerow"><input id="code" maxlength="5" placeholder="방 코드" autocomplete="off"><button class="go">참가</button></div>
      <p class="status" id="st"></p>
    </div>`);
  const inp = $menu.querySelector('#code');
  inp.focus();
  bind('.go', () => h.join(inp.value.trim().toUpperCase(), (msg) => { $menu.querySelector('#st').textContent = msg; }));
  bind('.back', () => h.back());
}

// ---------- 도움말 ----------
export function guide(h) {
  const uniq = [];
  for (const R of REACTIONS) if (!uniq.find((u) => u.id === R.id)) uniq.push(R);
  const combos = (id) => REACTIONS.filter((r) => r.id === id).map((r) => `${({ wet: '젖음', burn: '화상', shock: '감전', chill: '둔화', frozen: '빙결', poison: '중독', mark: '표식' })[r.has]}+${ELEMENTS[r.el].name}`).join(', ');
  show(`
    <div class="panel">
      <div class="head"><button class="back">← 뒤로</button><h2>도움말</h2><span></span></div>
      <h3>원소 반응</h3>
      <p class="sub">원소 공격을 맞으면 상태가 남고, 다른 원소가 닿으면 반응이 터집니다. 친구와 원소를 엮어 보세요!</p>
      <div class="reacts">${uniq.map((R) => `<div><b style="color:${R.color}">${R.name}</b><small>${combos(R.id)}</small></div>`).join('')}</div>
      <h3>대난투 규칙</h3>
      <p class="sub">영웅은 체력 대신 <b>%</b>가 쌓입니다. %가 높을수록 멀리 날아가고, 맵 밖·구덩이(공허)에 떨어지면 목숨이 하나 줄어요. 목숨을 다 잃으면 탈락!<br>
      많이 맞은 쪽은 <b>분노</b>로 조금 더 세게 칩니다. 떨어질 만큼 강하게 맞으면 화면이 멈추며 「KO 확정」 연출이 나와요. 시간이 지나면 땅이 무너지고, 새 땅이 솟고, 가로로 긴 땅이 세로로 뒤틀리기도 해요. 지도의 벽·구덩이·가시는 매번 달라집니다.</p>
      <h3>성장</h3>
      <p class="sub"><b>1-1 · 1-3 · 2-3 · 3-3</b>을 깨면 증강 3개 중 1개, <b>1-5 · 2-5 보스</b>를 쓰러뜨리면 <b>전설 증강</b>! 같은 증강은 한 번만 고를 수 있어요. 스테이지를 깨면 가운데 바닥에서 <b>빛의 문</b>이 솟아오르고, 증강을 고르면 문이 열립니다. 상자에서는 골드와 함께 아이템이 나와요.</p>
      <div class="reacts">${Object.values(ITEMS).map((I) => `<div><b style="color:${I.color}">${I.name}</b><small>${I.desc}</small></div>`).join('')}</div>
      <h3>원소 충돌</h3>
      <p class="sub">투사체끼리 부딪히면 힘이 센 쪽이 이깁니다. 서로 다른 원소면 그 자리에서 충돌 폭발.</p>
    </div>`);
  bind('.back', () => h.back());
}

// ---------- 일시정지 / 결과 ----------
export function pause(h, info) {
  show(`
    <div class="panel small">
      <h2>일시정지</h2>
      ${info.code ? `<p class="sub">방 코드 <b class="codebig">${info.code}</b><br>친구에게 알려 주면 바로 들어옵니다.</p>` : ''}
      <div class="col">
        <button class="resume big">계속하기</button>
        <button class="mute">${info.muted ? '🔇 소리 켜기' : '🔊 소리 끄기'}</button>
        <button class="quit">메뉴로 나가기</button>
      </div>
    </div>`);
  bind('.resume', () => h.resume());
  bind('.mute', () => h.mute());
  bind('.quit', () => h.quit());
}
export function result(h, r) {
  show(`
    <div class="panel small result ${r.win ? 'win' : 'lose'}">
      <h2>${r.title}</h2>
      <div class="rstats">
        ${r.gold !== undefined ? `<div><small>얻은 골드</small><b class="gold">+${r.gold} G</b></div>` : ''}
        ${r.combo !== undefined ? `<div><small>최대 콤보</small><b>${r.combo}</b></div>` : ''}
        ${r.kos !== undefined ? `<div><small>링아웃</small><b>${r.kos}</b></div>` : ''}
        ${r.level !== undefined ? `<div><small>도달 레벨</small><b>${r.level}</b></div>` : ''}
      </div>
      ${r.augs?.length ? `<div class="auglist">${r.augs.map((id) => { const A = AUGMENTS.find((a) => a.id === id); return A ? `<span class="augchip ${A.tier === 2 ? 'leg' : ''}" title="${A.desc}">${A.icon} ${A.name}</span>` : ''; }).join('')}</div>` : ''}
      ${r.note ? `<p class="sub">${r.note}</p>` : ''}
      <div class="col">
        ${r.next ? '<button class="next big">다음 장으로</button>' : ''}
        ${r.retry ? '<button class="retry big">다시 도전</button>' : ''}
        <button class="tree">스킬 트리</button>
        <button class="quit">메뉴로</button>
      </div>
    </div>`);
  bind('.next', () => h.next());
  bind('.retry', () => h.retry());
  bind('.tree', () => h.go('tree'));
  bind('.quit', () => h.quit());
}
// ---------- 증강 고르기 (게임 위에 카드 3장) ----------
const $aug = document.getElementById('aug');
let augKey = '';
export function showAug(cho, onPick) {
  const key = cho.o.join(',') + cho.tier;
  if (key !== augKey) {
    augKey = key;
    const leg = cho.tier === 2;
    $aug.innerHTML = `<div class="augwrap ${leg ? 'leg' : ''}">
      <h2>${leg ? '전설 증강' : '스테이지 증강'}</h2><p class="sub">하나를 고르세요 <span class="augt"></span></p>
      <div class="augcards">${cho.o.map((id, i) => { const A = AUGMENTS.find((a) => a.id === id); return `<button class="augcard" data-i="${i}"><span class="aicon">${A.icon}</span><b>${A.name}</b><small>${A.desc}</small><span class="akey">${i + 1}</span></button>`; }).join('')}</div>
    </div>`;
    $aug.querySelectorAll('.augcard').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); sfx('buy'); onPick(Number(b.dataset.i)); }));
    $aug.hidden = false;
    sfx('chest');
  }
  const t = $aug.querySelector('.augt');
  if (t) t.textContent = `(${cho.t}초 뒤 자동 선택)`;
}
export function hideAug() { if (!$aug.hidden) { $aug.hidden = true; $aug.innerHTML = ''; augKey = ''; } }
export const augOpen = () => !$aug.hidden;

export function toast(text) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.getElementById('wrap').appendChild(t); }
  t.textContent = text; t.classList.add('on');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 2600);
}
export { animT };
