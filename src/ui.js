// 메뉴 화면들 (DOM)
import { CHARS, CHAR_KEYS, ELEMENTS, TREE, CHAPTERS, REACTIONS } from './data.js';
import { COLOSSEUM_ARENAS } from './maps.js';
import * as SV from './save.js';
import { sfx } from './audio.js';

const $menu = document.getElementById('menu');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const V = window.__ASSET_V || 1;
const heroes = new Image();
heroes.src = `assets/heroes.png?v=${V}`;

// 캐릭터 초상 (움직이는 작은 캔버스)
const portraits = new Set();
function portrait(char, size = 72) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  c.className = 'portrait';
  c.dataset.char = char;
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
    const hover = c.closest('.on');
    const f = hover ? 10 + (Math.floor(t / 140) % 3) : Math.floor(t / 230) % 4;
    const el = ELEMENTS[C.el];
    const gr = g.createRadialGradient(c.width / 2, c.height * 0.6, 2, c.width / 2, c.height * 0.6, c.width / 2);
    gr.addColorStop(0, el.color + '66'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
    if (heroes.complete) g.drawImage(heroes, f * 32, C.row * 32, 32, 32, 0, 0, c.width, c.height);
  }
  requestAnimationFrame(animPortraits);
}
requestAnimationFrame(animPortraits);

function show(html) { $menu.innerHTML = html; $menu.hidden = false; $menu.scrollTop = 0; }
export function hide() { $menu.hidden = true; $menu.innerHTML = ''; }
function bind(sel, fn) { $menu.querySelectorAll(sel).forEach((el) => el.addEventListener('click', (e) => { sfx('ui'); fn(el, e); })); }

const SKILL_KEYS = ['클릭/J', 'Q/K', 'E/L', 'R/;'];
const TYPE_NAME = { slash: '근접', shot: '투사체', dashstrike: '돌진', stream: '줄기', blink: '이동', nova: '광역', zone: '지대', line: '연속', snipe: '저격', markall: '표식', detonate: '기폭', strikes: '낙뢰' };

// ---------- 타이틀 ----------
export function title(h) {
  const s = SV.S();
  show(`
    <div class="title">
      <div class="logo"><span class="l1">원소</span><span class="l2">아레나</span></div>
      <p class="tag">원소를 엮어 반응을 터뜨리고, 적을 날려 버려라!</p>
      <div class="namerow">
        <input id="nick" maxlength="10" placeholder="닉네임" value="${esc(s.name)}">
        <span class="gold">💰 ${s.gold} G</span>
      </div>
      <div class="cur" id="curChar"></div>
      <div class="bigbtns">
        <button class="big story" data-go="story"><b>스토리 모드</b><small>스테이지를 돌파하고 골드 모으기 · 최대 4명 협동</small></button>
        <button class="big colo" data-go="colo"><b>콜로세움</b><small>친구·봇과 대난투식 대전 · 날려서 링아웃</small></button>
      </div>
      <div class="rowbtns">
        <button data-go="chars">캐릭터 (${CHAR_KEYS.length})</button>
        <button data-go="tree">스킬 트리</button>
        <button data-go="join">코드로 참가</button>
        <button data-go="guide">도움말</button>
      </div>
      <p class="foot">PC: WASD 이동 · 마우스 조준 · 클릭 공격 · Q E R 스킬 · Space 대시 &nbsp;|&nbsp; 모바일: 왼쪽 조이스틱 · 오른쪽 버튼 (자동 조준)</p>
    </div>`);
  const C = CHARS[s.char];
  const cur = $menu.querySelector('#curChar');
  cur.appendChild(portrait(s.char, 64));
  cur.insertAdjacentHTML('beforeend', `<div><b style="color:${C.color}">${C.name}</b><small>${ELEMENTS[C.el].name} · ${C.role}</small></div>`);
  cur.addEventListener('click', () => h.go('chars'));
  $menu.querySelector('#nick').addEventListener('change', (e) => SV.setName(e.target.value.trim()));
  bind('[data-go]', (el) => { SV.setName($menu.querySelector('#nick').value.trim()); h.go(el.dataset.go); });
}

// ---------- 캐릭터 ----------
export function chars(h) {
  const s = SV.S();
  show(`
    <div class="panel wide">
      <div class="head"><button class="back">← 뒤로</button><h2>캐릭터 선택</h2><span></span></div>
      <div class="chargrid">${CHAR_KEYS.map((k) => {
        const C = CHARS[k], E = ELEMENTS[C.el];
        return `<button class="char ${k === s.char ? 'on' : ''}" data-c="${k}" style="--c:${C.color}">
          <span class="pslot"></span>
          <span class="cname">${C.name}</span>
          <span class="badge" style="background:${E.color}">${E.name}</span> <span class="role">${C.role}</span>
        </button>`;
      }).join('')}</div>
      <div class="detail" id="detail"></div>
    </div>`);
  $menu.querySelectorAll('.char').forEach((b) => b.querySelector('.pslot').appendChild(portrait(b.dataset.c, 64)));
  const detail = (k) => {
    const C = CHARS[k];
    $menu.querySelector('#detail').innerHTML = `
      <div class="dtop"><b style="color:${C.color}">${C.name}</b> <span class="badge" style="background:${ELEMENTS[C.el].color}">${ELEMENTS[C.el].name}</span>
      <small>체력 ${C.hp} · 속도 ${C.speed} · 무게 ${C.weight}</small></div>
      <p>${C.desc}</p>
      <div class="sklist">${C.skills.map((S, i) => `<div class="sk${i ? '' : ' basic'}"><span class="key">${SKILL_KEYS[i]}</span><b>${S.name}</b>
        <small>${TYPE_NAME[S.type] || ''}${S.el ? ' · ' + ELEMENTS[S.el].name : ''} · ${S.cd}초</small></div>`).join('')}</div>`;
  };
  detail(s.char);
  bind('.char', (el) => { SV.setChar(el.dataset.c); $menu.querySelectorAll('.char').forEach((b) => b.classList.toggle('on', b === el)); detail(el.dataset.c); h.onChar?.(el.dataset.c); });
  bind('.back', () => h.back());
}

// ---------- 스토리 장 선택 ----------
export function story(h) {
  const s = SV.S();
  show(`
    <div class="panel">
      <div class="head"><button class="back">← 뒤로</button><h2>스토리 모드</h2><span class="gold">💰 ${s.gold} G</span></div>
      <p class="sub">장마다 스테이지 5개 (마지막은 보스). 상자를 열어 골드를 모으고 스킬 트리를 강화하세요.<br>구덩이로 날려 보내면 바로 처치! 쓰러진 동료 옆에 서 있으면 부활합니다.</p>
      <div class="chapters">${CHAPTERS.map((C, i) => {
        const lock = i > s.cleared;
        return `<button class="chap ${lock ? 'lock' : ''}" data-ch="${i}" ${lock ? 'disabled' : ''} style="--f:${C.floor[0]};--w:${C.wallTop}">
          <b>${i + 1}장 · ${C.name}</b><small>${lock ? '🔒 이전 장을 클리어하세요' : i < s.cleared ? '✔ 클리어' : '도전!'}</small></button>`;
      }).join('')}</div>
      <label class="chk"><input type="checkbox" id="online"> 방 만들어 친구와 함께 (최대 4명)</label>
    </div>`);
  bind('.chap', (el) => h.start({ mode: 'story', ch: Number(el.dataset.ch), online: $menu.querySelector('#online').checked }));
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
      <h3>날려 보내기</h3>
      <p class="sub">스토리에선 잃은 체력만큼, 콜로세움에선 쌓인 %만큼 더 멀리 날아갑니다. 빠르게 날아가면 구덩이로 떨어지고, 벽에 세게 부딪히면 추가 피해!</p>
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
      </div>
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
export function toast(text) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.getElementById('wrap').appendChild(t); }
  t.textContent = text; t.classList.add('on');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 2600);
}
export { animT };
