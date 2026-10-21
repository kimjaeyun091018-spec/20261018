// 메뉴 화면들 (DOM)
import { CHARS, CHAR_KEYS, ELEMENTS, TREE, CHAPTERS, REACTIONS, HERO_SPRITE, HERO_SHEETS, HERO_SIZE, AUGMENTS, ITEMS, RARITY, RARITY_ORDER, BOXES, GACHA, HERO_LV, heroStats, STAT_NAMES, ACCOUNT, ACHIEVEMENTS } from './data.js';
import { COLOSSEUM_ARENAS } from './maps.js';
import * as SV from './save.js';
import * as SIM from './sim.js';
import { createRenderer } from './render.js';
import * as SO from './social.js';
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
      // 인게임과 같은 비율로, 발끝을 맞춰 그림 (모든 영웅 키가 같아 보이게 · 칸 안에 들어오게 살짝 줄임)
      const gp = (c.width / HERO_SPRITE.draw) * 0.86, feet = c.height * 0.95;
      if (own && own.img.complete && own.img.naturalWidth) {
        const k = own.scale * gp, D = own.cell * k;
        g.drawImage(own.img, f * own.cell, 0, own.cell, own.cell, (c.width - D) / 2, feet - (own.cell - 2) * k, D, D);
      } else if (heroes.complete) {
        const D = HERO_SPRITE.draw * gp * (HERO_SIZE[c.dataset.char] || 1);
        g.drawImage(heroes, f * HS, C.row * HS, HS, HS, (c.width - D) / 2, feet - D * (46 / 48), D, D);
      }
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
const TYPE_NAME = { parry: '반격', slash: '근접', shot: '투사체', dashstrike: '돌진', stream: '줄기', blink: '이동', nova: '광역', zone: '지대', line: '연속', snipe: '저격', markall: '표식', detonate: '기폭', strikes: '낙뢰' };

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
          <span class="alv" title="계정 레벨"><b>Lv ${s.alv || 1}</b><i style="width:${Math.min(100, ((s.axp || 0) / ACCOUNT.need(s.alv || 1)) * 100)}%"></i></span>
          <span class="gold">💰 ${s.gold} G</span>
          <span class="keys">🔑 ${s.keys || 0}</span>
          <span class="lvchip">🏆 최고 ${(s.stats.best || 0) > CHAPTERS.length * 5 ? '완주' : s.stats.best ? `${Math.floor((s.stats.best - 1) / 5) + 1}-${((s.stats.best - 1) % 5) + 1}` : '-'}</span>
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
          <button class="big story" data-go="story"><b>스토리 모드</b><small>${SV.getRun() ? `▶ ${SV.getRun().ch + 1}-${SV.getRun().st + 1}부터 이어하기 가능` : '스테이지 돌파 · 증강 · 최대 4명 협동'}</small></button>
          <button class="big colo" data-go="colo"><b>콜로세움</b><small>친구·봇과 대난투식 대전 · 날려서 링아웃</small></button>
          <button class="big boxbtn" data-go="boxes"><span class="mchest"><i></i></span><span><b>뽑기 상자</b><small>${SV.allOwned() ? '영웅 레벨업 재료 ⚡P.P 모으기' : `새 영웅과 ⚡P.P를 뽑아 보세요 · 영웅 ${s.owned.length}/${CHAR_KEYS.length}`}</small></span></button>
          <div class="rowbtns">
            <button data-go="achievements">🏆 업적${SV.achReady() ? ` <span class="dot">${SV.achReady()}</span>` : ''}</button>
            <button data-go="social">👥 친구 · 길드</button>
            <button data-go="tree">🌳 스킬 트리</button>
            <button data-go="join">🔗 코드로 참가</button>
            <button data-go="guide">📖 도움말</button>
            <button data-go="settings">⚙️ 설정</button>
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
            <span class="rtag">${R.name}</span>${own ? `<span class="lvtag">Lv${SV.heroLv(k)}</span>` : ''}
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
      ${levelBox(sel, own)}
      <div class="sklist">${C.skills.map((S, i) => `<button class="skc${i ? '' : ' basic'}" data-i="${i}"><span class="key">${SKILL_KEYS[i]}</span><b>${S.name}</b>
        <small>${TYPE_NAME[S.type] || ''}${S.el ? ' · ' + ELEMENTS[S.el].name : ''} · ${S.cd}초</small><span class="play">▶</span></button>`).join('')}</div>
      <p class="sub tiny center">스킬을 누르면 미리보기 화면이 나와요</p>
      <p class="sub">${C.desc}</p>
      <div class="rowbtns">${own
        ? (sel === s.char ? '<button class="big pick" disabled>사용 중</button>' : '<button class="big pick">이 영웅으로 출전</button>')
        : `<button class="big gobox">🎁 뽑기 상자에서 얻기</button><button class="big buy" ${s.gold < C.price ? 'disabled' : ''}>💰 ${C.price.toLocaleString()} G로 바로 영입${s.gold < C.price ? `<small>골드 ${(C.price - s.gold).toLocaleString()} 부족</small>` : ''}</button>`}</div>`;
    det.querySelector('.bustslot').appendChild(portrait(sel, 128, true));
    bind('.char', (el) => draw(el.dataset.c));
    bind('.pick', () => { SV.setChar(sel); h.onChar?.(sel); draw(sel); });
    bind('.buy', () => { if (!confirm(`${C.name}을(를) ${C.price.toLocaleString()} G로 바로 영입할까요?\n(뽑기 상자로 얻는 편이 훨씬 싸요)`)) return; if (SV.buyChar(sel)) { sfx('buy'); toast(`${C.name} 영입 완료!`); h.onChar?.(sel); } draw(sel); });
    bind('.gobox', () => h.go('boxes'));
    bind('.skc', (el) => skillDemo(sel, Number(el.dataset.i)));
    bind('.lvup', () => { if (SV.levelUp(sel)) { sfx('buy'); toast(`${C.name} 레벨 ${SV.heroLv(sel)}!`); h.onChar?.(sel); } draw(sel); });
    bind('.back', () => h.back());
  };
  draw();
}

// ---------- 스킬 미리보기 (클래시로얄 카드 설명처럼 짧은 시범 화면) ----------
function skillText(S) {
  const p = [];
  if (S.desc) p.push(S.desc);
  if (S.dmg) p.push(`피해 ${S.dmg}${S.count > 1 ? ` × ${S.count}` : ''}`);
  if (S.chain) p.push(`${S.chain.length}연타 (마지막 일격은 강하게)`);
  if (S.explode) p.push(`폭발 범위 ${S.explode.r}`);
  if (S.pierce && S.pierce < 99) p.push(`${S.pierce}명 관통`); else if (S.pierce >= 99) p.push('모두 관통');
  if (S.r && ['nova', 'zone', 'parry'].includes(S.type)) p.push(`범위 ${S.r}`);
  if (S.dist) p.push(`거리 ${S.dist}`);
  if (S.type === 'dashstrike') p.push('건너편에 땅이 있으면 공허를 뛰어넘음');
  if (S.stun) p.push(`기절 ${S.stun}초`);
  if (S.slow && S.type !== 'stream') p.push('둔화');
  if (S.heal) p.push(`초당 % 회복`);
  if (S.hook) p.push('맞은 적을 끌어옴');
  if (S.pull) p.push('주변 적을 빨아들임');
  if (S.leech) p.push(`맞힐 때마다 내 % -${S.leech}`);
  if (S.empower) p.push('다음 기본 공격 강화');
  if (S.home) p.push('적을 따라감');
  if (S.time && ['zone', 'stream'].includes(S.type)) p.push(`${S.time}초 지속`);
  return p.join(' · ');
}
let demoRun = 0;
function skillDemo(char, i) {
  const C = CHARS[char];
  document.querySelector('.skdemo')?.remove();
  const wrap = document.createElement('div');
  wrap.className = 'skdemo';
  wrap.innerHTML = `<div class="sdbox" style="--c:${C.color}">
    <div class="sdhead"><b class="sdname"></b><button class="mini sdx">✕ 닫기</button></div>
    <div class="sdview"><canvas width="960" height="640"></canvas><span class="sdkey"></span></div>
    <p class="sddesc"></p>
    <div class="sdtabs">${C.skills.map((S, k) => `<button data-i="${k}">${SKILL_KEYS[k]}<br><b>${S.name}</b></button>`).join('')}</div>
  </div>`;
  $menu.appendChild(wrap);
  const canvas = wrap.querySelector('canvas');
  const R = createRenderer(canvas);
  const state = SIM.createDemo(char);
  let idx = i, t = 0, last = performance.now(), acc = 0;
  const run = ++demoRun;
  const setSkill = (k) => {
    idx = k; t = 0;
    const S = C.skills[k];
    wrap.querySelector('.sdname').textContent = `${S.name}`;
    wrap.querySelector('.sdkey').textContent = `${SKILL_KEYS[k]} · ${TYPE_NAME[S.type] || ''}${S.el ? ' · ' + ELEMENTS[S.el].name : ''} · 재사용 ${S.cd}초`;
    wrap.querySelector('.sddesc').textContent = skillText(S);
    wrap.querySelectorAll('.sdtabs button').forEach((b) => b.classList.toggle('on', Number(b.dataset.i) === k));
    SIM.demoReset(state, { shots: S.type === 'parry' });
  };
  setSkill(i);
  const CYCLE = 2.8;
  const frame = (now) => {
    if (run !== demoRun || !wrap.isConnected) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    acc += dt;
    while (acc >= 1 / 60) {
      acc -= 1 / 60; t += 1 / 60;
      const S = C.skills[idx];
      const key = ['atk', 's1', 's2', 's3'][idx];
      const castAt = S.type === 'parry' ? 0.75 : 0.35;
      const hold = idx === 0 ? t > castAt && t < castAt + 1.3 : t > castAt && t < castAt + 0.1;
      const inp = { aim: 0, ad: 190, mx: 0, my: 0 };
      if (hold) inp[key] = true;
      SIM.step(state, { me: inp }, 1 / 60);
      const h = state.heroes.me; h.pct = 0; h.inv = 99;
      if (t >= CYCLE) { t = 0; SIM.demoReset(state, { shots: S.type === 'parry' }); }
    }
    R.render(SIM.snapshot(state), 'me', { noHud: true, shakeMul: 0.4, fixedCam: true });
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  wrap.querySelectorAll('.sdtabs button').forEach((b) => b.addEventListener('click', () => { sfx('ui'); setSkill(Number(b.dataset.i)); }));
  const close = () => { demoRun++; wrap.remove(); };
  wrap.querySelector('.sdx').addEventListener('click', close);
  wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
}

// 영웅 레벨: 능력치 표 + P.P 막대 + 레벨업 버튼
function levelBox(c, own) {
  const lv = own ? SV.heroLv(c) : 1, max = lv >= HERO_LV.max;
  const cur = heroStats(c, lv), nxt = heroStats(c, Math.min(HERO_LV.max, lv + 1));
  const pp = SV.heroPP(c), need = HERO_LV.pp[lv] || 0, cost = HERO_LV.gold[lv] || 0, gold = SV.S().gold;
  const fmt = (k, v) => (k === 'crit' ? v.toFixed(1) : Math.round(v)) + (k === 'crit' || k === 'critDmg' ? '%' : '');
  return `<div class="lvbox">
    <div class="lvhead"><b class="lvnum">Lv ${lv}</b><span class="lvmax">/ ${HERO_LV.max}</span>
      ${own && !max ? `<div class="ppbar"><i style="width:${Math.min(100, (pp / need) * 100)}%"></i><span>⚡ ${pp} / ${need} P.P</span></div>` : own ? '<span class="maxed">최고 레벨!</span>' : '<span class="maxed">영입하면 레벨을 올릴 수 있어요</span>'}
    </div>
    <div class="stats">${STAT_NAMES.map(([k, n, ic]) => `<div><span>${ic} ${n}</span><b>${fmt(k, cur[k])}</b>${own && !max ? `<em>→ ${fmt(k, nxt[k])}</em>` : ''}</div>`).join('')}</div>
    ${own && !max ? `<button class="big lvup" ${SV.canLevel(c) ? '' : 'disabled'}>⬆ 레벨업 · 💰 ${cost.toLocaleString()} G${pp < need ? '<small>P.P가 부족해요 — 뽑기 상자에서 모아요</small>' : gold < cost ? `<small>골드 ${(cost - gold).toLocaleString()} 부족</small>` : ''}</button>` : ''}
    <p class="sub tiny">레벨 능력치는 스토리 모드에서만 적용돼요 (콜로세움은 공정하게 Lv1). 방어막은 스테이지 시작·부활 때 가득 차고, 쌓일 %를 먼저 막아 줘요.</p>
  </div>`;
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
      <div class="head"><button class="back">← 뒤로</button><h2>뽑기 상자</h2><span class="keys">🔑 ${s.keys || 0}</span></div>
      <p class="sub center keyhow">🔑 <b>원소 열쇠</b>는 계정 레벨 업 · 처음 도달한 스테이지 · 보스 처치 · 업적으로 얻어요.</p>
      <p class="sub center">상자 한 칸마다 <b>아직 없는 영웅</b>이 나올 수 있어요. 안 나오면 <b>⚡ P.P</b>(영웅 레벨업 재료) 또는 골드! 영웅이 안 나올수록 <b>행운</b>이 쌓여 확률이 올라가요.</p>
      <div class="boxes">${Object.entries(BOXES).map(([k, B]) => `
        <div class="boxcard" style="--bc:${B.color}">
          ${chestHtml(B.color, 'small ' + k)}
          <b>${B.name}</b>
          <small>${B.drops}칸${B.luck > 1 ? ` · 행운 +${Math.round((B.luck - 1) * 100)}%` : ''}</small>
          <button class="big open" data-box="${k}" ${(s.keys || 0) < B.price ? 'disabled' : ''}>🔑 ${B.price}</button>
        </div>`).join('')}</div>
      ${all ? '<p class="sub center"><b>🎉 모든 영웅을 모았어요!</b> 이제 상자에서는 ⚡P.P와 골드가 나와요.</p>' : `
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
      if (d.t === 'pp') {
        sfx('gold');
        const C = CHARS[d.c];
        rev.innerHTML = `<div class="dcard ppc" style="--c:${C.color}"><span class="bslot"></span><b>⚡ +${d.n} P.P</b><small>${C.name}</small></div>`;
        rev.querySelector('.bslot').appendChild(portrait(d.c, 64, true));
        root.classList.remove('herofx');
      } else if (d.t === 'gold') {
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
    const pps = {}; for (const d of drops) if (d.t === 'pp') pps[d.c] = (pps[d.c] || 0) + d.n;
    const s = SV.S();
    root.classList.remove('herofx');
    root.innerHTML = `<div class="panel small sumbox">
      <h2>${B.name}</h2>
      <div class="sumlist">
        ${hs.map((d) => `<div class="sh" style="--r:${RARITY[CHARS[d.c].rarity].color}" data-c="${d.c}"><span class="pslot"></span><b>${CHARS[d.c].name}</b><small>${RARITY[CHARS[d.c].rarity].name}</small></div>`).join('')}
        ${Object.entries(pps).map(([c, n]) => `<div class="sp" data-c="${c}"><span class="pslot"></span><b>⚡+${n}</b><small>${CHARS[c].name}</small></div>`).join('')}
        <div class="sg">💰 <b>+${gold} G</b></div>
      </div>
      ${hs.length || SV.allOwned() ? '' : `<p class="sub">이번엔 영웅이 없었어요… 🍀 행운이 쌓였어요 (${GACHA.pity - s.pity}칸 안에 확정)</p>`}
      <div class="col">
        ${hs.length ? `<button class="big go use" data-c="${hs[hs.length - 1].c}">${CHARS[hs[hs.length - 1].c].name}(으)로 출전</button>` : ''}
        <button class="big again" ${(s.keys || 0) < B.price ? 'disabled' : ''}>한 번 더 (🔑 ${B.price})</button>
        <button class="linkbtn back">← 상자 목록 (보유 🔑 ${s.keys || 0})</button>
      </div>
    </div>`;
    root.querySelectorAll('.sh').forEach((e) => e.querySelector('.pslot').appendChild(portrait(e.dataset.c, 56, true)));
    root.querySelectorAll('.sp').forEach((e) => e.querySelector('.pslot').appendChild(portrait(e.dataset.c, 40, true)));
    bind('.use', (b) => { SV.setChar(b.dataset.c); h.onChar?.(b.dataset.c); toast(`${CHARS[b.dataset.c].name}(으)로 출전!`); boxes(h); });
    bind('.again', () => { const d2 = SV.openBox(key); if (d2) { h.onGold?.(); openBox(h, key, d2); } });
    bind('.back', () => boxes(h));
  };
  root.addEventListener('pointerdown', (e) => { if (i < drops.length && !e.target.closest('button')) next(); });
  const onKey = (e) => { if (!root.isConnected) { removeEventListener('keydown', onKey); return; } if ((e.code === 'Space' || e.code === 'Enter') && i < drops.length) { e.preventDefault(); next(); } };
  addEventListener('keydown', onKey);
}

// ---------- 친구 · 길드 ----------
const ago = (t) => { if (!t) return '오래전'; const m = Math.floor((Date.now() - t) / 60000); return m < 60 ? `${Math.max(1, m)}분 전` : m < 1440 ? `${Math.floor(m / 60)}시간 전` : `${Math.floor(m / 1440)}일 전`; };
function personRow(p, extra = '') {
  const pr = p.prof || {};
  const C = CHARS[pr.char];
  return `<div class="person ${p.online ? 'on' : 'off'}">
    <span class="pslot" data-c="${pr.char || ''}"></span>
    <div class="pinfo"><b>${esc(p.nick || '?')}</b>${p.role === 'owner' ? ' <span class="gm">길드장</span>' : ''}${p.me ? ' <span class="gm me">나</span>' : ''}
      <small><i class="odot"></i>${p.online ? (pr.room ? `게임 중 · 방 ${esc(pr.room)}` : '접속 중') : `오프라인 · ${ago(pr.t)}`}${pr.alv ? ` · Lv ${pr.alv}` : ''}${C ? ` · ${C.name}` : ''}</small></div>
    ${extra}
  </div>`;
}
export function social(h, tab = 'friends') {
  const a = h.accountInfo();
  const head = `<div class="head"><button class="back">← 뒤로</button><h2>친구 · 길드</h2><span></span></div>
    <div class="tabs"><button class="tab ${tab === 'friends' ? 'on' : ''}" data-t="friends">👥 친구</button><button class="tab ${tab === 'guild' ? 'on' : ''}" data-t="guild">🛡️ 길드</button></div>`;
  if (!a?.nick) {
    show(`<div class="panel">${head}<p class="sub center">친구와 길드는 <b>구글 로그인</b>을 하고 닉네임을 정하면 쓸 수 있어요.</p></div>`);
    bind('.back', () => h.back());
    return;
  }
  show(`<div class="panel social">${head}<div class="sbody"><p class="sub center">불러오는 중…</p></div></div>`);
  bind('.back', () => h.back());
  bind('.tab', (b) => social(h, b.dataset.t));
  const body = $menu.querySelector('.sbody');
  const fail = (e) => { body.innerHTML = `<p class="sub center bad">${esc(e.message)}</p>`; };
  const fillPortraits = () => body.querySelectorAll('.pslot[data-c]').forEach((el) => { if (el.dataset.c && CHARS[el.dataset.c]) el.appendChild(portrait(el.dataset.c, 40, true)); });
  if (tab === 'friends') {
    SO.loadFriends().then(({ list, reqs, newly }) => {
      if (!body.isConnected) return;
      if (newly.length) toast(`${newly.join(', ')} 님이 친구 요청을 수락했어요!`);
      body.innerHTML = `
        <div class="addrow"><input id="fnick" maxlength="10" placeholder="친구 닉네임"><button class="mini sendreq">친구 요청</button></div>
        <p class="sub tiny">내 닉네임: <b>${esc(a.nick)}</b> — 친구에게 알려 주세요</p>
        ${reqs.length ? `<h3>받은 요청 ${reqs.length}</h3>${reqs.map((r) => `<div class="person req"><div class="pinfo"><b>${esc(r.nick)}</b><small>${ago(r.t)} 요청</small></div><button class="mini ok" data-u="${r.uid}" data-n="${esc(r.nick)}">수락</button><button class="mini no" data-u="${r.uid}">거절</button></div>`).join('')}` : ''}
        <h3>친구 ${list.length} <small class="sub">· 접속 중 ${list.filter((f) => f.online).length}</small></h3>
        ${list.length ? list.map((f) => personRow(f, `${f.online && f.prof?.room ? `<button class="mini joinf" data-code="${esc(f.prof.room)}">참가</button>` : ''}<button class="mini delf" data-u="${f.uid}" data-n="${esc(f.nick)}">✕</button>`)).join('') : '<p class="sub center">아직 친구가 없어요. 닉네임으로 요청을 보내 보세요!</p>'}
        <button class="linkbtn refresh">↻ 새로 고침</button>`;
      fillPortraits();
      const inp = body.querySelector('#fnick');
      bind('.sendreq', async () => { try { toast(await SO.sendRequest(inp.value.trim(), a.nick)); inp.value = ''; } catch (e) { toast(e.message); } });
      bind('.ok', async (b) => { try { await SO.acceptRequest(b.dataset.u, b.dataset.n, a.nick); toast(`${b.dataset.n} 님과 친구가 됐어요!`); social(h, 'friends'); } catch (e) { toast(e.message); } });
      bind('.no', async (b) => { await SO.declineRequest(b.dataset.u).catch((e) => toast(e.message)); social(h, 'friends'); });
      bind('.delf', async (b) => { if (!confirm(`${b.dataset.n} 님을 친구 목록에서 지울까요?`)) return; await SO.removeFriend(b.dataset.u).catch((e) => toast(e.message)); social(h, 'friends'); });
      bind('.joinf', (b) => h.joinCode(b.dataset.code));
      bind('.refresh', () => social(h, 'friends'));
    }).catch(fail);
    return;
  }
  SO.myGuild().then(async (g) => {
    if (!body.isConnected) return;
    if (g) {
      const on = g.members.filter((m) => m.online).length;
      body.innerHTML = `
        <div class="gcard"><span class="gicon">🛡️</span><div><b>${esc(g.name)}</b><small>${esc(g.desc || '길드 소개가 없어요')}</small></div></div>
        <h3>길드원 ${g.members.length}/${SO.GUILD_MAX} <small class="sub">· 접속 중 ${on}</small></h3>
        ${g.members.map((m) => personRow(m, `${m.online && m.prof?.room && !m.me ? `<button class="mini joinf" data-code="${esc(m.prof.room)}">참가</button>` : ''}${g.mine && !m.me ? `<button class="mini kick" data-u="${m.uid}" data-n="${esc(m.nick)}">내보내기</button>` : ''}`)).join('')}
        <div class="col">
          ${g.mine ? '<button class="mini editdesc">소개 바꾸기</button>' : ''}
          <button class="mini leave">${g.mine && g.members.length === 1 ? '길드 해체' : '길드 나가기'}</button>
          <button class="linkbtn refresh">↻ 새로 고침</button>
        </div>`;
      fillPortraits();
      bind('.joinf', (b) => h.joinCode(b.dataset.code));
      bind('.kick', async (b) => { if (!confirm(`${b.dataset.n} 님을 내보낼까요?`)) return; await SO.kickMember(g, b.dataset.u).catch((e) => toast(e.message)); social(h, 'guild'); });
      bind('.editdesc', async () => { const d = prompt('길드 소개 (60자)', g.desc || ''); if (d === null) return; await SO.setGuildDesc(g, d).catch((e) => toast(e.message)); social(h, 'guild'); });
      bind('.leave', async () => { if (!confirm(g.mine && g.members.length > 1 ? '길드장을 다른 사람에게 넘기고 나갈까요?' : '정말 나갈까요?')) return; try { await SO.leaveGuild(g); toast('길드에서 나왔어요'); } catch (e) { toast(e.message); } social(h, 'guild'); });
      bind('.refresh', () => social(h, 'guild'));
      return;
    }
    const list = await SO.listGuilds().catch(() => []);
    if (!body.isConnected) return;
    body.innerHTML = `
      <p class="sub center">아직 길드가 없어요. 길드에 들어가면 길드원의 접속 상태를 보고 방에 바로 참가할 수 있어요.</p>
      <h3>길드 만들기</h3>
      <div class="addrow"><input id="gname" maxlength="12" placeholder="길드 이름 (2~12자)"><input id="gdesc" maxlength="60" placeholder="소개 (선택)"><button class="mini mkg">만들기</button></div>
      <h3>길드 찾기</h3>
      ${list.length ? list.map((x) => `<div class="person"><span class="gicon">🛡️</span><div class="pinfo"><b>${esc(x.name)}</b><small>${esc(x.desc || '')} · ${x.count}/${SO.GUILD_MAX}명</small></div><button class="mini jg" data-g="${x.id}" ${x.count >= SO.GUILD_MAX ? 'disabled' : ''}>가입</button></div>`).join('') : '<p class="sub center">아직 길드가 없어요. 첫 길드를 만들어 보세요!</p>'}`;
    bind('.mkg', async () => { try { await SO.createGuild(body.querySelector('#gname').value, body.querySelector('#gdesc').value, a.nick); toast('길드를 만들었어요!'); social(h, 'guild'); } catch (e) { toast(e.message); } });
    bind('.jg', async (b) => { try { await SO.joinGuild(b.dataset.g, a.nick); toast('길드에 들어갔어요!'); social(h, 'guild'); } catch (e) { toast(e.message); } });
  }).catch(fail);
}

// ---------- 업적 ----------
export function achievements(h) {
  const s = SV.S();
  const list = [...ACHIEVEMENTS].sort((a, b) => (SV.achClaimed(a) - SV.achClaimed(b)) || ((SV.achDone(b) && !SV.achClaimed(b)) - (SV.achDone(a) && !SV.achClaimed(a))));
  show(`
    <div class="panel">
      <div class="head"><button class="back">← 뒤로</button><h2>업적</h2><span class="keys">🔑 ${s.keys || 0}</span></div>
      <p class="sub center">완료 ${ACHIEVEMENTS.filter((a) => SV.achClaimed(a)).length} / ${ACHIEVEMENTS.length}</p>
      <div class="achs">${list.map((A) => {
        const v = Math.min(A.goal, SV.achValue(A.stat)), done = SV.achDone(A), got = SV.achClaimed(A);
        return `<div class="ach ${got ? 'got' : done ? 'ready' : ''}">
          <span class="aic">${A.icon}</span>
          <div class="ainfo"><b>${A.name}</b><small>${A.desc}</small>
            <div class="abar"><i style="width:${(v / A.goal) * 100}%"></i><span>${v} / ${A.goal}</span></div></div>
          <div class="arew"><small>🔑${A.keys} 💰${A.gold}</small>${got ? '<em>받음 ✓</em>' : `<button class="mini claim" data-id="${A.id}" ${done ? '' : 'disabled'}>받기</button>`}</div>
        </div>`;
      }).join('')}</div>
    </div>`);
  bind('.back', () => h.back());
  bind('.claim', (b) => { const A = SV.claimAch(b.dataset.id); if (A) { sfx('buy'); toast(`업적 「${A.name}」 보상: 🔑 ${A.keys} · 💰 ${A.gold}`); } achievements(h); });
}

// ---------- 설정 ----------
export function settings(h) {
  const s = SV.S();
  const L = SV.loadLayout();
  show(`
    <div class="panel">
      <div class="head"><button class="back">← 뒤로</button><h2>설정</h2><span></span></div>
      <div class="setrow"><div><b>🔊 소리</b><small>효과음 켜기 / 끄기</small></div><button class="toggle snd ${s.muted ? '' : 'on'}">${s.muted ? '꺼짐' : '켜짐'}</button></div>
      <div class="setrow"><div><b>📳 화면 흔들림</b><small>폭발·강한 타격 때 화면이 흔들리는 정도</small></div><button class="toggle shk ${SV.shakeLevel() ? 'on' : ''}">${['끄기', '약하게', '보통'][SV.shakeLevel()]}</button></div>
      <div class="setrow"><div><b>🕹️ 조작 버튼 배치</b><small>조이스틱과 스킬 버튼의 위치·크기·투명도를 마음대로 (터치 화면용, 이 기기에 저장) · 지금: ${L ? '내 배치' : '기본 배치'}</small></div><button class="edit">편집</button></div>
      ${L ? '<div class="setrow"><div><b>↩️ 기본 배치로</b><small>내가 정한 배치를 지우고 처음 모양으로</small></div><button class="reset">되돌리기</button></div>' : ''}
      <h3>조작</h3>
      <p class="sub">PC: WASD 이동 · 마우스 조준 · 클릭 공격 · Q E R 스킬 · Space 대시 · 증강은 1 2 3<br>모바일: 왼쪽 조이스틱 이동 · 오른쪽 버튼 (가장 가까운 적을 자동 조준)</p>
    </div>`);
  bind('.back', () => h.back());
  bind('.snd', () => { h.setMute(!SV.S().muted); settings(h); });
  bind('.shk', () => { h.setShake((SV.shakeLevel() + 1) % 3); settings(h); });
  bind('.edit', () => layoutEdit(h));
  bind('.reset', () => { SV.saveLayout(null); h.onLayout?.(); toast('기본 배치로 되돌렸어요'); settings(h); });
}
// 조작 배치 편집: 끌어서 옮기고, 고른 것의 크기와 전체 투명도를 슬라이더로
export function layoutEdit(h) {
  const L = structuredClone(SV.loadLayout() || SV.DEFAULT_LAYOUT);
  const names = { stick: '이동', atk: '공격', s1: '스킬1', s2: '스킬2', s3: '궁극기', dash: '대시' };
  let sel = 'atk';
  show(`
    <div class="lay">
      <div class="grid"></div>
      <div class="hint">버튼을 끌어서 옮기세요<br>누른 버튼의 크기는 위에서 조절</div>
      ${Object.keys(names).map((k) => `<div class="ctl ${k}" data-k="${k}"><span>${k === 'stick' ? '' : names[k]}</span></div>`).join('')}
      <div class="bar">
        <b class="selname"></b>
        <label>크기 <input type="range" class="size" min="60" max="170" step="5"></label>
        <label>투명도 <input type="range" class="alpha" min="30" max="100" step="5"></label>
        <button class="mini def">기본값</button>
        <button class="mini cancel">취소</button>
        <button class="mini save" style="background:#2e7d32;border-color:#66bb6a">저장</button>
      </div>
    </div>`);
  const root = $menu.querySelector('.lay');
  const W = () => root.clientWidth, H = () => root.clientHeight;
  const size = root.querySelector('.size'), alpha = root.querySelector('.alpha'), selname = root.querySelector('.selname');
  const draw = () => {
    root.querySelectorAll('.ctl').forEach((el) => {
      const k = el.dataset.k, P = L[k], d = SV.CONTROL_BASE[k] * P.s;
      Object.assign(el.style, { left: `${P.x * W() - d / 2}px`, top: `${P.y * H() - d / 2}px`, width: `${d}px`, height: `${d}px`, opacity: L.alpha });
      el.classList.toggle('sel', k === sel);
    });
    size.value = Math.round(L[sel].s * 100); alpha.value = Math.round((L.alpha ?? 1) * 100);
    selname.textContent = names[sel];
  };
  root.querySelectorAll('.ctl').forEach((el) => {
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      sel = el.dataset.k; draw();
      el.setPointerCapture(e.pointerId);
      const r = root.getBoundingClientRect();
      const move = (ev) => {
        const P = L[sel], half = (SV.CONTROL_BASE[sel] * P.s) / 2;
        P.x = Math.min(1 - half / W(), Math.max(half / W(), (ev.clientX - r.left) / W()));
        P.y = Math.min(1 - half / H(), Math.max(half / H(), (ev.clientY - r.top) / H()));
        draw();
      };
      const up = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); };
      el.addEventListener('pointermove', move); el.addEventListener('pointerup', up);
    });
  });
  size.addEventListener('input', () => { L[sel].s = size.value / 100; draw(); });
  alpha.addEventListener('input', () => { L.alpha = alpha.value / 100; draw(); });
  bind('.def', () => { Object.assign(L, structuredClone(SV.DEFAULT_LAYOUT)); draw(); });
  bind('.cancel', () => settings(h));
  bind('.save', () => { SV.saveLayout(L); h.onLayout?.(); toast('조작 배치를 저장했어요'); settings(h); });
  addEventListener('resize', draw, { once: true });
  draw();
}

// ---------- 스토리 장 선택 ----------
export function story(h) {
  const s = SV.S();
  const run = SV.getRun();
  const best = s.stats.best || 0;
  const bestTxt = best > CHAPTERS.length * 5 ? '모든 장 돌파!' : best ? `${Math.floor((best - 1) / 5) + 1}-${((best - 1) % 5) + 1}` : '아직 없음';
  show(`
    <div class="panel">
      <div class="head"><button class="back">← 뒤로</button><h2>스토리 모드</h2><span class="gold">💰 ${s.gold} G</span></div>
      <p class="sub">모험은 언제나 <b>1-1</b>부터 시작해서, 쓰러지지 않는 한 <b>${CHAPTERS.length}-5</b>까지 쉬지 않고 이어집니다.<br>
      증강은 한 판 동안 계속 쌓이고, 전멸하면 처음부터! 모은 골드는 스킬 트리와 영웅 영입에 쓰세요.</p>
      <div class="route">${CHAPTERS.map((C, i) => `<div class="rch" style="--f:${C.floor[0]};--w:${C.wallTop}"><b>${i + 1}장</b><small>${C.name}</small><span>${[1, 2, 3, 4, 5].map((n) => `<i class="${n === 5 ? 'boss' : ''} ${best >= i * 5 + n ? 'done' : ''}"></i>`).join('')}</span></div>`).join('<span class="rarrow">▶</span>')}</div>
      <p class="sub center">🏆 최고 기록: <b>${bestTxt}</b> · 완주 ${s.stats.wins || 0}회</p>
      ${run ? `<div class="runcard">
        <span class="pslot"></span>
        <div><b>이어하기 · ${run.ch + 1}-${run.st + 1}부터</b><small>${CHARS[run.char]?.name || ''} · 목숨 ${run.stocks} · 증강 ${run.augs.length}개${run.pendingAug?.length ? ' (+ 고를 증강)' : ''}<br>그 스테이지를 처음부터 다시 시작해요</small></div>
      </div>
      <div class="col">
        <button class="big go rsolo">이어하기 (혼자)</button>
        <button class="big go2 ronline">이어하기 · 방 만들기</button>
      </div>
      <h3>새 모험</h3>` : ''}
      <div class="col">
        <button class="big ${run ? '' : 'go'} solo">${run ? '처음부터 새로 (혼자)' : '모험 시작 (혼자)'}</button>
        <button class="big ${run ? '' : 'go2'} online">방 만들어 친구와 함께 (최대 4명)</button>
      </div>
    </div>`);
  if (run) $menu.querySelector('.runcard .pslot').appendChild(portrait(run.char, 56, true));
  const fresh = (online) => { if (run && !confirm(`저장된 진행(${run.ch + 1}-${run.st + 1})이 지워져요. 처음부터 시작할까요?`)) return; h.start({ mode: 'story', ch: 0, online }); };
  bind('.solo', () => fresh(false));
  bind('.online', () => fresh(true));
  bind('.rsolo', () => h.start({ mode: 'story', ch: 0, online: false, resume: true }));
  bind('.ronline', () => h.start({ mode: 'story', ch: 0, online: true, resume: true }));
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
      <p class="sub">콤보 10마다 주는 피해 +1% (최대 +50%).<br>영웅은 체력 대신 <b>%</b>가 쌓입니다. %가 높을수록 멀리 날아가고, 맵 밖·구덩이(공허)에 떨어지면 목숨이 하나 줄어요. 목숨을 다 잃으면 탈락!<br>
      많이 맞은 쪽은 <b>분노</b>로 조금 더 세게 칩니다. 떨어질 만큼 강하게 맞으면 화면이 멈추며 「KO 확정」 연출이 나와요. 시간이 지나면 땅이 무너지고, 새 땅이 솟고, 가로로 긴 땅이 세로로 뒤틀리기도 해요. 지도의 벽·구덩이·가시는 매번 달라집니다.</p>
      <h3>성장</h3>
      <p class="sub"><b>1-1 · 1-3 · 2-3 · 3-3 · 4-3</b>을 깨면 증강 3개 중 1개, <b>1-5 · 2-5 · 3-5 보스</b>를 쓰러뜨리면 <b>전설 증강</b>! 4장에서는 <b>꼬마 눈사람</b>이 함께 싸워 주지만, 곳곳의 <b>빙판</b>에서는 미끄러져요. 같은 증강은 한 번만 고를 수 있어요. 스테이지를 깨면 가운데 바닥에서 <b>빛의 문</b>이 솟아오르고, 증강을 고르면 문이 열립니다. 상자에서는 골드와 함께 아이템이 나와요.</p>
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
        <button class="quit">메뉴로 나가기${info.story ? ' (이 스테이지부터 이어하기 저장)' : ''}</button>
      </div>
    </div>`);
  bind('.resume', () => h.resume());
  bind('.mute', () => h.mute());
  bind('.quit', () => h.quit());
}
function rewardHtml(r) {
  const s = SV.S();
  const rows = [];
  for (const x of r.reach) rows.push(`<div class="rw first"><b>🎉 처음 도달 ${Math.floor((x.k - 1) / 5) + 1}-${((x.k - 1) % 5) + 1}${x.title ? ` · ${x.title}` : ''}</b><span>${x.keys ? `🔑 ${x.keys} ` : ''}💰 ${x.gold}</span></div>`);
  if (r.keys) rows.push(`<div class="rw"><b>보스 처치</b><span>🔑 ${r.keys}</span></div>`);
  for (const u of r.ups) rows.push(`<div class="rw up"><b>⬆ 계정 레벨 ${u.lv}!</b><span>🔑 ${u.keys} 💰 ${u.gold}</span></div>`);
  return `<div class="rewards">
    <div class="axp"><b>계정 Lv ${s.alv}</b><div class="abar"><i style="width:${Math.min(100, (s.axp / ACCOUNT.need(s.alv)) * 100)}%"></i><span>경험치 +${r.xp}</span></div></div>
    ${rows.join('')}
  </div>`;
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
      ${r.rewards ? rewardHtml(r.rewards) : ''}
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
