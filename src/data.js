// ============================================================
//  원소 아레나 — 수치 모음 (밸런스는 이 파일만 고치면 됩니다)
// ============================================================
export const TILE = 32;
export const COLS = 30;
export const ROWS = 20;
export const VIEW_W = COLS * TILE; // 960
export const VIEW_H = ROWS * TILE; // 640
export const MAX_PLAYERS = 4;

// ---------- 넉백 (대난투식 %) ----------
// 날아가는 속도 = (base + growth × % / 100) / 무게.
// 스토리: % = 잃은 체력 비율 (체력이 적을수록 멀리 날아감) / 콜로세움: % = 받은 피해 누적, 체력 없음
export const KNOCK = {
  friction: 3.4, wallBounce: 0.55, wallHitSpeed: 360, wallHitDmg: 4,
  pitSpeed: 240, spikeDmg: 8, spikeKb: [260, 140],
  stunPer: 1 / 1700, stunMax: 0.75,
  colosseumPct: 0.45, // 콜로세움에서 피해 1당 % 증가량
};
// 타격감: 맞은 쪽·때린 쪽이 잠깐 멈춤 (히트스톱), 화면 흔들림
export const FEEL = { hitstopBase: 0.035, hitstopPerDmg: 0.0025, hitstopMax: 0.12, shakePerDmg: 0.35, shakeMax: 14 };
export const DASH = { dist: 130, time: 0.14, cd: 1.3, inv: 0.2 };

// ---------- 원소 ----------
export const ELEMENTS = {
  fire: { name: '불', color: '#ff7043', glow: '#ffab40' },
  lightning: { name: '번개', color: '#ffe14d', glow: '#fff59d' },
  ice: { name: '얼음', color: '#81d4fa', glow: '#e1f5fe' },
  wind: { name: '바람', color: '#a5d6a7', glow: '#e8f5e9' },
  earth: { name: '대지', color: '#c49a6c', glow: '#ffe0b2' },
  water: { name: '물', color: '#4fc3f7', glow: '#b3e5fc' },
  shadow: { name: '그림자', color: '#9c64ff', glow: '#d1b3ff' },
  poison: { name: '독', color: '#9ccc65', glow: '#dcedc8' },
};
// 원소를 맞으면 남는 상태
export const STATUS = {
  burn: { from: 'fire', time: 3, tick: 0.5, dmg: 2, name: '화상' },
  shock: { from: 'lightning', time: 2.5, name: '감전' },
  chill: { from: 'ice', time: 3, slow: 0.45, freezeAt: 3, name: '둔화' },
  wet: { from: 'water', time: 4, name: '젖음' },
  poison: { from: 'poison', time: 5, tick: 0.6, dmgPerStack: 1, maxStack: 6, name: '중독' },
  mark: { from: 'shadow', time: 4, name: '표식' },
};
// 원소 반응: [이미 있는 상태, 새로 맞은 원소] → 반응. 같은 편끼리 원소를 엮으면 콤보!
export const REACTIONS = [
  { has: 'wet', el: 'fire', id: 'steam', name: '증기 폭발', color: '#eceff1', r: 70, dmg: 14, kb: [180, 260] },
  { has: 'burn', el: 'water', id: 'steam', name: '증기 폭발', color: '#eceff1', r: 70, dmg: 14, kb: [180, 260] },
  { has: 'wet', el: 'lightning', id: 'electro', name: '감전 연쇄', color: '#fff176', chain: 4, dmg: 12, kb: [90, 140] },
  { has: 'shock', el: 'water', id: 'electro', name: '감전 연쇄', color: '#fff176', chain: 4, dmg: 12, kb: [90, 140] },
  { has: 'wet', el: 'ice', id: 'freeze', name: '빙결', color: '#b3e5fc', freeze: 1.6, dmg: 6 },
  { has: 'chill', el: 'water', id: 'freeze', name: '빙결', color: '#b3e5fc', freeze: 1.6, dmg: 6 },
  { has: 'chill', el: 'fire', id: 'melt', name: '융해', color: '#ffccbc', dmg: 22, kb: [120, 220] },
  { has: 'frozen', el: 'fire', id: 'melt', name: '융해', color: '#ffccbc', dmg: 26, kb: [120, 220] },
  { has: 'burn', el: 'ice', id: 'melt', name: '융해', color: '#ffccbc', dmg: 22, kb: [120, 220] },
  { has: 'burn', el: 'lightning', id: 'plasma', name: '플라즈마 폭발', color: '#e1bee7', r: 90, dmg: 18, kb: [260, 480] },
  { has: 'shock', el: 'fire', id: 'plasma', name: '플라즈마 폭발', color: '#e1bee7', r: 90, dmg: 18, kb: [260, 480] },
  { has: 'frozen', el: 'earth', id: 'shatter', name: '분쇄', color: '#e1f5fe', dmg: 30, kb: [300, 520] },
  { has: 'poison', el: 'fire', id: 'toxic', name: '독 폭발', color: '#c5e1a5', r: 80, dmg: 16, kb: [160, 260] },
  { has: 'mark', el: 'shadow', id: 'umbra', name: '그림자 폭발', color: '#d1b3ff', r: 50, dmg: 20, kb: [200, 360], self: true },
  // 바람은 상태를 퍼뜨림
  { has: 'burn', el: 'wind', id: 'swirl', name: '확산', color: '#c8e6c9', r: 110, spread: 'burn', dmg: 8, kb: [140, 200] },
  { has: 'shock', el: 'wind', id: 'swirl', name: '확산', color: '#c8e6c9', r: 110, spread: 'shock', dmg: 8, kb: [140, 200] },
  { has: 'chill', el: 'wind', id: 'swirl', name: '확산', color: '#c8e6c9', r: 110, spread: 'chill', dmg: 8, kb: [140, 200] },
  { has: 'wet', el: 'wind', id: 'swirl', name: '확산', color: '#c8e6c9', r: 110, spread: 'wet', dmg: 8, kb: [140, 200] },
  { has: 'poison', el: 'wind', id: 'swirl', name: '확산', color: '#c8e6c9', r: 110, spread: 'poison', dmg: 8, kb: [140, 200] },
];
// 투사체끼리 맞부딪힘: 힘 차이가 이보다 작으면 둘 다 사라짐. 서로 다른 원소면 그 자리에서 충돌 폭발
export const CLASH = { even: 0.35, burst: { r: 56, dmg: 5, kb: [150, 220] } };

// ---------- 캐릭터 8명 ----------
// row: assets/heroes.png 디자인 줄 · role: 역할 · 스킬 0 = 기본 공격, 1~3 = 스킬
// 스킬 종류(type): slash 베기 · shot 투사체 · dashstrike 돌진 베기 · stream 줄기 · blink 순간이동 · nova 주변 폭발
//                  zone 지대 · line 줄지어 솟음 · snipe 저격 · markall 표식 · detonate 기폭
export const CHARS = {
  knight: {
    name: '불꽃 기사', row: 0, el: 'fire', role: '근접 돌격', cloth: '#d32f2f', color: '#ff7043', hp: 130, speed: 175, weight: 1.15,
    desc: '3연타 검술로 띄우고, 돌진 베기로 날려 버리는 정면 돌격형.',
    skills: [
      { name: '검 베기', type: 'slash', cd: 0.32, range: 64, arc: 1.5, dmg: 9, kb: [110, 200], el: 'fire', chain: [{ dmg: 9 }, { dmg: 10, arcMul: 1.1 }, { dmg: 16, kb: [220, 380], arcMul: 1.4, rangeMul: 1.2, big: true }] },
      { name: '화염구', type: 'shot', cd: 2.2, el: 'fire', speed: 420, r: 12, power: 2.2, dmg: 18, kb: [170, 300], life: 1.4, look: 'fireball', explode: { r: 48, dmg: 8, kb: [140, 200] } },
      { name: '돌진 베기', type: 'dashstrike', cd: 4.5, dist: 240, time: 0.18, width: 36, dmg: 22, kb: [240, 450], el: 'fire', look: 'flame' },
      { name: '화염 방사', type: 'stream', cd: 7, el: 'fire', time: 1.3, every: 0.045, speed: 320, r: 10, spread: 0.26, power: 0.6, dmg: 3, kb: [40, 70], life: 0.45, look: 'flame', slow: 0.5 },
    ],
  },
  archer: {
    name: '번개 궁수', row: 1, el: 'lightning', role: '원거리 견제', cloth: '#f9a825', color: '#ffe14d', hp: 100, speed: 185, weight: 0.95,
    desc: '꿰뚫는 번개 화살과 10만볼트. 물에 젖은 적에게 감전 연쇄.',
    skills: [
      { name: '화살', type: 'shot', cd: 0.38, el: null, speed: 680, r: 5, power: 1, dmg: 8, kb: [80, 150], life: 0.8, look: 'arrow' },
      { name: '번개 화살', type: 'shot', cd: 2.2, el: 'lightning', speed: 980, r: 7, power: 1.6, dmg: 16, kb: [130, 260], life: 0.75, pierce: 3, look: 'bolt' },
      { name: '번개 도약', type: 'blink', cd: 4.5, dist: 180, zone: { r: 66, delay: 0.3, dmg: 14, kb: [110, 260], el: 'lightning' } },
      { name: '10만볼트', type: 'stream', cd: 7, el: 'lightning', time: 1.1, every: 0.04, speed: 760, r: 8, spread: 0.1, power: 0.6, dmg: 3, kb: [40, 80], life: 0.42, look: 'spark', slow: 0.6 },
    ],
  },
  mage: {
    name: '서리 마법사', row: 2, el: 'ice', role: '제어', cloth: '#1e88e5', color: '#81d4fa', hp: 95, speed: 170, weight: 0.9,
    desc: '얼음으로 느리게 하고 3번 쌓이면 꽁꽁. 대지로 깨면 분쇄!',
    skills: [
      { name: '얼음 조각', type: 'shot', cd: 0.42, el: 'ice', speed: 560, r: 7, power: 1, dmg: 7, kb: [70, 130], life: 0.9, look: 'shard' },
      { name: '얼음 창', type: 'shot', cd: 2.4, el: 'ice', speed: 640, r: 8, power: 1.4, dmg: 12, kb: [120, 220], life: 0.8, count: 3, spread: 0.32, pierce: 1, look: 'spear' },
      { name: '서리 폭발', type: 'nova', cd: 5, r: 120, dmg: 14, kb: [220, 360], el: 'ice', look: 'frost' },
      { name: '눈보라', type: 'zone', cd: 8, at: 'aim', range: 380, r: 110, time: 3, tick: 0.3, dmg: 3, kb: [0, 0], el: 'ice', look: 'blizzard', slow: 0.5 },
    ],
  },
  ninja: {
    name: '바람 닌자', row: 3, el: 'wind', role: '암살', cloth: '#2e7d32', color: '#a5d6a7', hp: 95, speed: 205, weight: 0.85,
    desc: '가장 빠른 캐릭터. 회오리로 적을 모으고 상태 이상을 퍼뜨림.',
    skills: [
      { name: '쌍검', type: 'slash', cd: 0.22, range: 52, arc: 1.7, dmg: 6, kb: [80, 140], el: 'wind', chain: [{ dmg: 6 }, { dmg: 6 }, { dmg: 7 }, { dmg: 12, kb: [200, 320], big: true }] },
      { name: '바람 칼날', type: 'shot', cd: 2, el: 'wind', speed: 600, r: 14, power: 1.6, dmg: 13, kb: [150, 260], life: 0.7, pierce: 99, look: 'crescent' },
      { name: '질풍 연참', type: 'dashstrike', cd: 3.5, dist: 230, time: 0.12, width: 40, dmg: 16, kb: [160, 300], el: 'wind', look: 'wind', resetOnHit: 0.5 },
      { name: '회오리', type: 'shot', cd: 8, el: 'wind', speed: 150, r: 46, power: 4, dmg: 4, kb: [-90, 0], life: 2.6, pierce: 999, hitEvery: 0.22, look: 'tornado', pull: 260 },
    ],
  },
  guardian: {
    name: '대지 수호자', row: 4, el: 'earth', role: '탱커', cloth: '#8d6e63', color: '#c49a6c', hp: 170, speed: 160, weight: 1.45,
    desc: '무겁고 단단함. 지진으로 띄우고, 얼어 있는 적을 산산조각.',
    skills: [
      { name: '대지 망치', type: 'slash', cd: 0.6, range: 74, arc: 1.6, dmg: 16, kb: [200, 340], el: 'earth', big: true },
      { name: '바위 던지기', type: 'shot', cd: 3, el: 'earth', speed: 360, r: 16, power: 3.2, dmg: 22, kb: [260, 420], life: 1.2, look: 'boulder' },
      { name: '지진', type: 'nova', cd: 6, r: 130, dmg: 18, kb: [180, 300], el: 'earth', stun: 0.7, look: 'quake' },
      { name: '대지 가시', type: 'line', cd: 7, el: 'earth', count: 7, gap: 40, delay: 0.06, r: 30, dmg: 14, kb: [170, 300], look: 'spike' },
    ],
  },
  priest: {
    name: '물의 사제', row: 5, el: 'water', role: '지원', cloth: '#0288d1', color: '#4fc3f7', hp: 110, speed: 175, weight: 1,
    desc: '적을 적시고 아군을 치유. 번개·얼음·불과 엮으면 반응이 터짐.',
    skills: [
      { name: '물방울', type: 'shot', cd: 0.4, el: 'water', speed: 520, r: 8, power: 1, dmg: 7, kb: [80, 140], life: 0.9, look: 'bubble' },
      { name: '파도', type: 'shot', cd: 3, el: 'water', speed: 420, r: 26, power: 2.5, dmg: 10, kb: [240, 300], life: 0.9, pierce: 99, look: 'wave' },
      { name: '치유의 샘', type: 'zone', cd: 9, at: 'self', r: 100, time: 3, tick: 0.25, heal: 4, dmg: 0, look: 'heal', follow: true },
      { name: '소용돌이', type: 'zone', cd: 8, at: 'aim', range: 360, r: 100, time: 2.6, tick: 0.25, dmg: 3, kb: [0, 0], el: 'water', pull: 220, look: 'vortex' },
    ],
  },
  sniper: {
    name: '그림자 저격수', row: 6, el: 'shadow', role: '저격', cloth: '#5e35b1', color: '#9c64ff', hp: 90, speed: 180, weight: 0.9,
    desc: '표식을 남기고 저격으로 터뜨리는 한 방 콤보. (쿠키런 저격수처럼)',
    skills: [
      { name: '그림자 탄', type: 'shot', cd: 0.45, el: 'shadow', speed: 760, r: 6, power: 1, dmg: 8, kb: [70, 120], life: 0.9, look: 'umbral' },
      { name: '저격', type: 'snipe', cd: 3, windup: 0.35, len: 900, width: 10, dmg: 32, kb: [260, 460], el: 'shadow' },
      { name: '연막 후퇴', type: 'blink', cd: 5, dist: 200, smoke: true, empower: 1.6 },
      { name: '처형 표식', type: 'markall', cd: 9, range: 520, arc: 1.4, delay: 1.0, dmg: 26, kb: [240, 420], el: 'shadow' },
    ],
  },
  alchemist: {
    name: '독 연금술사', row: 7, el: 'poison', role: '광역', cloth: '#558b2f', color: '#9ccc65', hp: 105, speed: 175, weight: 1,
    desc: '독을 쌓고 한 번에 기폭. 불과 엮으면 독 폭발.',
    skills: [
      { name: '독침', type: 'shot', cd: 0.36, el: 'poison', speed: 600, r: 5, power: 1, dmg: 6, kb: [60, 110], life: 0.8, look: 'needle' },
      { name: '독 플라스크', type: 'shot', cd: 3, el: 'poison', speed: 420, r: 9, power: 1, dmg: 6, kb: [80, 120], life: 0.7, lob: true, look: 'flask', cloud: { r: 85, time: 3, tick: 0.4, dmg: 3 } },
      { name: '산성 기폭', type: 'detonate', cd: 6, range: 380, perStack: 7, kb: [160, 300] },
      { name: '연금 폭탄', type: 'shot', cd: 9, el: 'fire', speed: 380, r: 13, power: 3, dmg: 24, kb: [280, 460], life: 0.85, lob: true, look: 'bomb', explode: { r: 110, dmg: 16, kb: [260, 420] } },
    ],
  },
  berserker: {
    name: '용암 광전사', row: 8, el: 'fire', role: '근접 광역', cloth: '#8b2d1e', color: '#ff5722', hp: 150, speed: 170, weight: 1.3,
    desc: '대도끼를 휘두르며 회전 베기로 적 무리를 쓸어 버림. 도약해 내려찍기.',
    skills: [
      { name: '대도끼', type: 'slash', cd: 0.55, range: 70, arc: 1.9, dmg: 14, kb: [170, 300], el: 'fire', chain: [{ dmg: 13 }, { dmg: 20, kb: [240, 420], arcMul: 1.3, big: true }] },
      { name: '회전 베기', type: 'zone', cd: 6, at: 'self', follow: true, r: 72, time: 1.5, tick: 0.14, dmg: 4, kb: [0, 0], el: 'fire', look: 'whirl', spin: [90, 60] },
      { name: '도약 강타', type: 'dashstrike', cd: 5, dist: 260, time: 0.3, width: 30, dmg: 10, kb: [120, 200], el: 'fire', look: 'leap', land: { r: 95, dmg: 20, kb: [260, 440] } },
      { name: '화산 분출', type: 'line', cd: 8, el: 'fire', count: 6, gap: 46, delay: 0.07, r: 34, dmg: 15, kb: [200, 340], look: 'lava' },
    ],
  },
  miko: {
    name: '폭풍 무녀', row: 9, el: 'lightning', role: '원거리 광역', cloth: '#d32f2f', color: '#ffe14d', hp: 95, speed: 180, weight: 0.9,
    desc: '따라가는 부적과 하늘에서 떨어지는 낙뢰. 젖은 적이 많을수록 강함.',
    skills: [
      { name: '부적', type: 'shot', cd: 0.45, el: 'lightning', speed: 480, r: 7, power: 1, dmg: 7, kb: [70, 120], life: 1.1, home: 4, look: 'talisman' },
      { name: '뇌운 결계', type: 'zone', cd: 7, at: 'aim', range: 380, r: 90, time: 2.6, tick: 0.35, dmg: 4, kb: [60, 60], el: 'lightning', look: 'thunderfield' },
      { name: '번개 걸음', type: 'blink', cd: 4, dist: 170, fwd: true, zone: { r: 60, delay: 0.25, dmg: 12, kb: [110, 220], el: 'lightning' } },
      { name: '천벌', type: 'strikes', cd: 10, range: 460, count: 7, every: 0.13, r: 52, dmg: 16, kb: [150, 300], el: 'lightning' },
    ],
  },
  reaper: {
    name: '심연의 사신', row: 10, el: 'shadow', role: '근접 제어', cloth: '#231b30', color: '#e040fb', hp: 120, speed: 180, weight: 1.05,
    desc: '거대한 낫으로 넓게 베고, 영혼 사슬로 적을 끌어와 수확.',
    skills: [
      { name: '낫 베기', type: 'slash', cd: 0.45, range: 80, arc: 2.5, dmg: 11, kb: [130, 230], el: 'shadow', chain: [{ dmg: 10 }, { dmg: 11 }, { dmg: 18, kb: [200, 380], arcMul: 1.25, big: true }] },
      { name: '영혼 사슬', type: 'shot', cd: 3.5, el: 'shadow', speed: 720, r: 9, power: 1.5, dmg: 10, kb: [0, 0], life: 0.55, hook: 520, look: 'chain' },
      { name: '망령', type: 'shot', cd: 5, el: 'shadow', speed: 230, r: 16, power: 2.5, dmg: 8, kb: [90, 160], life: 2.4, pierce: 99, hitEvery: 0.35, home: 2.2, count: 3, spread: 0.9, look: 'ghost' },
      { name: '영혼 수확', type: 'nova', cd: 8, r: 140, dmg: 24, kb: [-260, -120], el: 'shadow', look: 'reap', leech: 4 },
    ],
  },
  pirate: {
    name: '파도 해적', row: 11, el: 'water', role: '원거리 화력', cloth: '#1565c0', color: '#4fc3f7', hp: 110, speed: 180, weight: 1.05,
    desc: '권총 연사, 반동으로 밀려나는 대포, 닻을 던져 끌어오기.',
    skills: [
      { name: '권총', type: 'shot', cd: 0.34, el: null, speed: 820, r: 5, power: 1, dmg: 7, kb: [90, 150], life: 0.7, look: 'bullet' },
      { name: '대포', type: 'shot', cd: 3.5, el: 'water', speed: 520, r: 14, power: 3, dmg: 20, kb: [280, 460], life: 1, recoil: 340, look: 'cannonball', explode: { r: 70, dmg: 10, kb: [200, 320] } },
      { name: '닻 던지기', type: 'shot', cd: 5, el: 'water', speed: 560, r: 13, power: 2.5, dmg: 14, kb: [0, 0], life: 0.6, hook: 460, look: 'anchor' },
      { name: '해일', type: 'shot', cd: 9, el: 'water', speed: 380, r: 30, power: 4, dmg: 14, kb: [300, 380], life: 1.1, pierce: 99, count: 3, spread: 0.5, look: 'wave' },
    ],
  },
};
export const CHAR_KEYS = Object.keys(CHARS);

// ---------- 적 (assets/enemies.png 24x24: 종류마다 [걷기1, 걷기2, 쓰러짐]) ----------
export const ENEMY_SHEET = ['slime', 'archer', 'brute', 'bat', 'spider', 'bomber', 'caster', 'shield', 'totem'];
export const ENEMIES = {
  slime: { name: '슬라임', hp: 34, r: 13, speed: 85, weight: 0.9, touch: 9, kb: [130, 200], ai: 'chase', gold: 2 },
  bat: { name: '박쥐', hp: 20, r: 10, speed: 150, weight: 0.7, touch: 7, kb: [110, 160], ai: 'zigzag', gold: 1 },
  bomber: { name: '폭탄 고블린', hp: 26, r: 12, speed: 130, weight: 0.9, ai: 'bomber', boom: { r: 70, dmg: 18, kb: [220, 320] }, gold: 2 },
  archer: { name: '해골 궁수', hp: 30, r: 12, speed: 95, weight: 0.9, ai: 'ranged', fire: { every: 1.8, speed: 300, dmg: 10, look: 'ebolt' }, gold: 3 },
  caster: { name: '해골 마법사', hp: 38, r: 12, speed: 75, weight: 0.9, ai: 'caster', fire: { every: 2.6, speed: 200, dmg: 9, look: 'eorb', count: 3, home: 1.6 }, gold: 4 },
  spider: { name: '거미', hp: 32, r: 11, speed: 80, weight: 0.85, touch: 10, kb: [150, 220], ai: 'leap', gold: 2 },
  brute: { name: '오크 브루트', hp: 110, r: 18, speed: 70, weight: 1.6, touch: 14, kb: [200, 300], ai: 'slam', slam: { r: 90, dmg: 20, kb: [240, 340], warn: 0.8, every: 3.2 }, gold: 8 },
  shield: { name: '방패병', hp: 90, r: 16, speed: 60, weight: 1.5, touch: 12, kb: [160, 240], ai: 'shield', gold: 6 },
  totem: { name: '저주 토템', hp: 70, r: 14, speed: 0, weight: 99, ai: 'totem', fire: { every: 0.5, speed: 190, dmg: 8, look: 'eorb' }, gold: 5 },
};
// 보스 (assets/bosses.png 40x40: [1, 2, 쓰러짐] × 3)
export const BOSSES = {
  kingslime: { name: '거대 슬라임 왕', sheet: 0, hp: 900, r: 34, speed: 70, weight: 4, touch: 16, color: '#66bb6a', pats: ['ring', 'jump', 'summon'] },
  bonelord: { name: '해골 궁수 대장', sheet: 1, hp: 1100, r: 30, speed: 90, weight: 3.5, touch: 14, color: '#e0e0e0', pats: ['volley', 'rain', 'dash'] },
  golem: { name: '심연의 골렘', sheet: 2, hp: 1500, r: 36, speed: 60, weight: 5, touch: 20, color: '#ff7043', pats: ['laser', 'slam', 'ring'] },
};

// ---------- 스토리 모드 ----------
// 장마다 스테이지 5개, 5번째는 보스. 한 스테이지 = 한 화면 경기장에서 웨이브 2~3번 → 상자(골드) → 다음
export const CHAPTERS = [
  { name: '속삭이는 숲', floor: ['#1d2a1f', '#213024'], wall: '#33402f', wallTop: '#4a5a40', boss: 'kingslime',
    waves: [['slime', 'slime', 'bat'], ['slime', 'bat', 'bat', 'bomber'], ['bomber', 'slime', 'spider', 'bat']] },
  { name: '잊힌 무덤', floor: ['#211d2a', '#252033'], wall: '#3b3352', wallTop: '#4a4166', boss: 'bonelord',
    waves: [['archer', 'slime', 'spider'], ['caster', 'archer', 'bat', 'spider'], ['archer', 'caster', 'spider', 'spider', 'bat']] },
  { name: '불타는 요새', floor: ['#2a1d1b', '#30211f'], wall: '#4e342e', wallTop: '#6d4c41', boss: 'golem',
    waves: [['brute', 'bomber', 'archer'], ['shield', 'caster', 'bomber', 'totem'], ['brute', 'shield', 'archer', 'caster', 'bomber']] },
];
export const STAGES_PER_CHAPTER = 5;
export const STORY = {
  hpScale: (ch, st) => 1 + ch * 0.9 + st * 0.15,   // 적 체력 배율
  dmgScale: (ch, st) => 1 + ch * 0.35 + st * 0.06,
  countAdd: (ch, st) => Math.floor(st / 2) + ch,   // 웨이브마다 추가되는 적 수
  chestGold: (ch, st) => 20 + ch * 25 + st * 6,
  bossGold: (ch) => 120 + ch * 80,
  reviveTime: 2.5,                                  // 쓰러진 동료 옆에 서 있으면 부활
  fallDmg: 0.15,                                    // 구덩이에 떨어지면 최대 체력의 15% 잃고 근처에서 다시
};

// ---------- 스킬 트리 (골드, 스토리 모드에만 적용 — 콜로세움은 공정하게 끔) ----------
export const TREE = [
  { id: 'atk1', name: '날 선 무기', desc: '피해 +8%', cost: 40, x: 0, y: -1, bonus: { atk: 0.08 } },
  { id: 'hp1', name: '단련', desc: '최대 체력 +10%', cost: 40, x: -1, y: 0, bonus: { hp: 0.1 } },
  { id: 'cd1', name: '집중', desc: '스킬 쿨타임 -6%', cost: 40, x: 1, y: 0, bonus: { cd: 0.06 } },
  { id: 'dash1', name: '날렵함', desc: '대시 쿨타임 -15%', cost: 60, x: 0, y: 1, bonus: { dash: 0.15 }, req: ['hp1', 'cd1'] },
  { id: 'crit1', name: '급소', desc: '치명타 확률 +8%', cost: 80, x: 0, y: -2, bonus: { crit: 0.08 }, req: ['atk1'] },
  { id: 'atk2', name: '전사의 혼', desc: '피해 +10%', cost: 120, x: -1, y: -2, bonus: { atk: 0.1 }, req: ['crit1'] },
  { id: 'critd', name: '치명적 일격', desc: '치명타 피해 +40%', cost: 140, x: 1, y: -2, bonus: { critDmg: 0.4 }, req: ['crit1'] },
  { id: 'react1', name: '원소 공명', desc: '원소 반응 피해 +25%', cost: 100, x: 2, y: -1, bonus: { react: 0.25 }, req: ['cd1'] },
  { id: 'react2', name: '원소 폭주', desc: '원소 반응 피해 +35%, 반응 범위 +15%', cost: 220, x: 3, y: -1, bonus: { react: 0.35, reactR: 0.15 }, req: ['react1'] },
  { id: 'cd2', name: '명상', desc: '스킬 쿨타임 -8%', cost: 160, x: 2, y: 0, bonus: { cd: 0.08 }, req: ['cd1'] },
  { id: 'hp2', name: '강철 심장', desc: '최대 체력 +15%', cost: 120, x: -2, y: 0, bonus: { hp: 0.15 }, req: ['hp1'] },
  { id: 'regen', name: '흡혈', desc: '처치할 때 체력 +3', cost: 140, x: -2, y: 1, bonus: { leech: 3 }, req: ['hp2'] },
  { id: 'armor', name: '굳건함', desc: '받는 피해 -10%, 넉백 -10%', cost: 180, x: -3, y: 0, bonus: { armor: 0.1 }, req: ['hp2'] },
  { id: 'gold1', name: '탐욕', desc: '골드 +20%', cost: 80, x: 1, y: 1, bonus: { gold: 0.2 }, req: ['cd1'] },
  { id: 'gold2', name: '황금 손', desc: '골드 +30%', cost: 200, x: 2, y: 1, bonus: { gold: 0.3 }, req: ['gold1'] },
  { id: 'combo', name: '연계의 달인', desc: '콤보 유지 시간 +0.6초, 10콤보마다 피해 +2% (최대 +20%)', cost: 160, x: 0, y: 2, bonus: { combo: 1 }, req: ['dash1'] },
  { id: 'dash2', name: '잔상', desc: '대시 2번 충전', cost: 240, x: -1, y: 2, bonus: { dashCharge: 1 }, req: ['combo'] },
  { id: 'kb', name: '강타', desc: '주는 넉백 +15%', cost: 180, x: 1, y: 2, bonus: { kb: 0.15 }, req: ['combo'] },
  { id: 'atk3', name: '파괴자', desc: '피해 +15%', cost: 320, x: 0, y: -3, bonus: { atk: 0.15 }, req: ['atk2', 'critd'] },
];

// ---------- 콜로세움 (PvP) ----------
export const COLOSSEUM = { stocks: 3, respawn: 1.8, restart: 4 };
export const TEAM_COLORS = ['#ef5350', '#42a5f5', '#66bb6a', '#ffca28'];
