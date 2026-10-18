// 메뉴 화면들 (DOM)
import { CHARS, CHAR_KEYS, ELEMENTS, TREE, CHAPTERS, REACTIONS, HERO_SPRITE, AUGMENTS, ITEMS } from './data.js';
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
      if (heroes.complete) g.drawImage(heroes, f * HS, C.row * HS, HS, HS, 0, 0, c.width, c.height);
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
        <button data-go="chars">영웅 (${SV.S().owned.length}/${CHAR_KEYS.length})</button>
        <button data-go="tree">스킬 트리</button>
        <button data-go="join">코드로 참가</button>
        <button data-go="guide">도움말</button>
      </div>
      <p class="foot">PC: WASD 이동 · 마우스 조준 · 클릭 공격 · Q E R 스킬 · Space 대시 &nbsp;|&nbsp; 모바일: 왼쪽 조이스틱 · 오른쪽 버튼 (자동 조준)</p>
    </div>`);
  const C = CHARS[s.char];
  const cur = $menu.querySelector('#curChar');
  cur.appendChild(portrait(s.char, 64));
  cur.insertAdjacentHTML('beforeend', `<div><b style="color:${C.color}">${C.name}</b> <small class="inl">${C.title}</small><small>${ELEMENTS[C.el].name} · ${C.role} · 눌러서 영웅 바꾸기</small></div>`);
  cur.addEventListener('click', () => h.go('chars'));
  $menu.querySelector('#nick').addEventListener('change', (e) => SV.setName(e.target.value.trim()));
  bind('[data-go]', (el) => { SV.setName($menu.querySelector('#nick').value.trim()); h.go(el.dataset.go); });
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
          return `<button class="char ${k === sel ? 'on' : ''} ${own ? '' : 'locked'} ${k === s.char ? 'cur' : ''}" data-c="${k}" style="--c:${C.color}">
            <span class="pslot"></span>
            <span class="cname">${C.name}</span>
            <span class="ctitle">${C.title}</span>
            <span class="badge" style="background:${E.color}">${E.name}</span>
            ${own ? (k === s.char ? '<span class="tagcur">사용 중</span>' : '') : `<span class="price">🔒 ${C.price} G</span>`}
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
          <div class="hero-tags"><span class="badge" style="background:${E.color}">${E.name}</span> <span class="role">${C.role}</span> <small>무게 ${C.weight} · 속도 ${C.speed}</small></div>
          <p class="quote">“${C.quote}”</p>
          <p class="lore">${C.lore}</p>
        </div>
      </div>
      <div class="sklist">${C.skills.map((S, i) => `<div class="skc${i ? '' : ' basic'}"><span class="key">${SKILL_KEYS[i]}</span><b>${S.name}</b>
        <small>${TYPE_NAME[S.type] || ''}${S.el ? ' · ' + ELEMENTS[S.el].name : ''} · ${S.cd}초</small></div>`).join('')}</div>
      <p class="sub">${C.desc}</p>
      <div class="rowbtns">${own
        ? (sel === s.char ? '<button class="big pick" disabled>사용 중</button>' : '<button class="big pick">이 영웅으로 출전</button>')
        : `<button class="big buy" ${s.gold < C.price ? 'disabled' : ''}>${C.price} G로 영입${s.gold < C.price ? ` (골드 ${C.price - s.gold} 부족)` : ''}</button>`}</div>`;
    det.querySelector('.bustslot').appendChild(portrait(sel, 128, true));
    bind('.char', (el) => draw(el.dataset.c));
    bind('.pick', () => { SV.setChar(sel); h.onChar?.(sel); draw(sel); });
    bind('.buy', () => { if (SV.buyChar(sel)) { sfx('buy'); toast(`${C.name} 영입 완료!`); h.onChar?.(sel); } draw(sel); });
    bind('.back', () => h.back());
  };
  draw();
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
      <h3>대난투 규칙</h3>
      <p class="sub">영웅은 체력 대신 <b>%</b>가 쌓입니다. %가 높을수록 멀리 날아가고, 맵 밖·구덩이(공허)에 떨어지면 목숨이 하나 줄어요. 목숨을 다 잃으면 탈락!<br>
      많이 맞은 쪽은 <b>분노</b>로 조금 더 세게 칩니다. 떨어질 만큼 강하게 맞으면 화면이 멈추며 「KO 확정」 연출이 나와요. 시간이 지나면 바깥 땅부터 무너집니다.</p>
      <h3>성장</h3>
      <p class="sub">스토리에서 적을 처치하면 경험치가 쌓여 <b>레벨 업</b> → 증강 3개 중 1개 선택. 보스를 쓰러뜨리면 <b>전설 증강</b>! 증강은 그 장을 도는 동안 유지됩니다. 상자에서는 골드와 함께 아이템이 나와요.</p>
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
      <h2>${leg ? '전설 증강' : '레벨 업!'}</h2><p class="sub">하나를 고르세요 <span class="augt"></span></p>
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
