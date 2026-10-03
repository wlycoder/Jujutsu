(() => {
'use strict';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let W = 0, H = 0, DPR = 1, scale = 1, baseScale = 1;
const WORLD = { w: 1700, h: 1150 };
const clamp = (v,a,b) => v < a ? a : (v > b ? b : v);
const rnd = (a,b) => a + Math.random()*(b-a);
const dist = (a,b) => Math.hypot(a.x-b.x, a.y-b.y);
const TAU = Math.PI*2;
const finite = v => typeof v === 'number' && isFinite(v);

function resize(){
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = Math.floor(W*DPR);
  canvas.height = Math.floor(H*DPR);
  canvas.style.width = W+'px';
  canvas.style.height = H+'px';
  baseScale = clamp(Math.min(W/700, H/760), 0.34, 1.35);
  scale = baseScale;
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize,120));
resize();

/* 领域鸟居贴图（伏魔御厨子中央建筑） */
const TORII_IMG = new Image();
TORII_IMG.src = 'assets/texture/domain/DemonicChef.png';

/* ══════════════════════════════════════════
   角色配置
   ══════════════════════════════════════════ */
const CFG = {
  gojo: {
    name: '五条悟',
    /* ★ 咒力上限：五条悟（145）> 两面宿傩（120）> 十影宿傩（100） */
    maxHp: 1200, maxCe: 145, ceRegen: 7.0, speed: 270, r: 21,
    atkDmg: 32, atkCd: 0.40, atkRange: 64,
    infDrain: 4.5, infDR: 0.65,
    bfCost: 5, bfMult: 2.6,
    reverseCost: 40, reverseHeal: 220, reverseCd: 9, reverseThreshold: 0.55,
    blueFistKb: 0.30,
    blueCost: 18, blueCd: 1.3, blueDmg: 18,
    /* ★ 长按「苍」→ 吸附型引力球：滞空、把敌人拉向球心、减速、存在更久 */
    blueHoldTime: 0.28, blueChargedLife: 6.0, blueChargedPull: 620,
    blueChargedR: 380, blueChargedSlow: 0.45,
    /* ★ 吸附苍 + 赫 → 大范围（480）「茈」爆炸 */
    purpleBlastR: 480, purpleBlastDmg: 260, purpleBlastKb: 1500,
    redCost: 28, redCd: 2.0, redDmg: 90,
    purpleCost: 45, purpleCd: 4.5, purpleDmg: 180,
    domainCost: 60, domainCd: 32,
    domainName: '无量空处',
    domainBaseR: 365, domainOpenTime: 0.45, domainGrowRate: 0,
    domainMaxR: 365, domainDuration: 5.2, domainDps: 0,
    brainBreakCost: 0.18, brainBreakStun: 0.45,
    brainBleed: 0.06, brainBreakMinHp: 0.28,
  },
  sukuna: {
    name: '两面宿傩',
    maxHp: 1600, maxCe: 120, ceRegen: 9.0, speed: 268, r: 24,
    atkCd: 0.30,
    reverseCost: 35, reverseHeal: 240, reverseCd: 5, reverseThreshold: 0.75,
    slashSpeed: 980,
    slashDmg: 60,
    fireCost: 30, fireCd: 2.0, fireDmg: 120,
    dismantleCost: 35, dismantleCd: 3.2, dismantleDmg: 100,
    domainCost: 60, domainCd: 38,
    domainName: '伏魔御厨子',
    domainBaseR: 390, domainOpenTime: 0.5, domainGrowRate: 78,
    domainMaxR: 1600, domainDuration: 8.5, domainDps: 34,
  },
  /* ★ 十影宿傩 —— 伏魔御厨子（削弱版） */
  sukunaTs: {
    name: '十影宿傩',
    maxHp: 1450, maxCe: 100, ceRegen: 8.0, speed: 272, r: 24,
    atkCd: 0.34,
    reverseCost: 35, reverseHeal: 220, reverseCd: 5, reverseThreshold: 0.7,
    slashSpeed: 960,
    slashDmg: 42,
    nueCost: 25, nueCd: 2.4, nueDmg: 75,
    dogCost: 35, dogCd: 5.5, dogDmg: 26, dogDur: 8, dogHp: 120,
    /* ★ 脱兔：每次4只、无召唤上限、无攻击，自动向敌方靠拢 */
    tobiCost: 20, tobiCd: 4.0, tobiHp: 60, tobiDur: 7, tobiCount: 4, tobiSpeed: 300,
    /* ★ 魔虚罗：有血量、会砍击、会适应（无时间限制，每次场上限1只） */
    mahoCost: 55, mahoCd: 17, mahoDmg: 90, mahoHp: 520,
    mahoAdaptStep: 0.12, mahoAdaptMax: 0.85,
    /* ★ 空间斩：需召唤过魔虚罗且其陨落后解锁 */
    spaceCost: 45, spaceCd: 14, spaceDmg: 320,
    domainCost: 60, domainCd: 36,
    /* ★ 领域 = 伏魔御厨子（削弱版）：更小、扩张更慢、DPS 更低 */
    domainName: '伏魔御厨子',
    domainBaseR: 320, domainOpenTime: 0.55, domainGrowRate: 40,
    domainMaxR: 900, domainDuration: 7.0, domainDps: 22,
  },
  /* ★ 日车宽见 —— 审判控制型：领域内禁用敌方一切主动术式 */
  higuruma: {
    name: '日车宽见',
    maxHp: 1350, maxCe: 130, ceRegen: 8.5, speed: 276, r: 22,
    atkDmg: 34, atkCd: 0.42, atkRange: 68,
    reverseCost: 35, reverseHeal: 200, reverseCd: 8, reverseThreshold: 0.6,
    /* 神槌：追击式突进（够得着就贴身）+ 高伤 */
    shinuchiCost: 30, shinuchiCd: 7, shinuchiDmg: 70, shinuchiDash: 480, shinuchiKb: 900,
    /* 死刑宣告：范围内目标 15 秒内受到伤害 +50%、移速 -25% */
    sentenceCost: 35, sentenceCd: 14, sentenceRange: 320, sentenceDuration: 15, sentenceAmp: 0.5,
    sentenceSlow: 0.25,    /* 被宣告者移速 -25% */
    chaseSpeedMul: 1.20,   /* 追诉：场上存在被宣告目标时自身移速 +20% */
    domainPull: 300,       /* 拘传：领域内敌方被拽向法庭中央（px/s） */
    domainCost: 60, domainCd: 36,
    /* 诛伏赐死：固定半径 720 的法庭，不再向外扩张 */
    domainName: '诛伏赐死',
    domainBaseR: 720, domainOpenTime: 0.5, domainGrowRate: 0,
    domainMaxR: 720, domainDuration: 11.0, domainDps: 0,
    domainSeal: 10,        /* 进入领域的敌人 10 秒内无法使用任何主动术式 */
    domainSpeedMul: 1.30,  /* 领域内自身移速 +30% */
    domainDR: 0.30,        /* 领域内自身受到伤害 -30% */
  },
  /* ★ 伏黑甚尔 —— 天与咒缚：没有咒力的体术怪物，领域无法将其「选中」 */
  toji: {
    name: '伏黑甚尔',
    maxHp: 2000, maxCe: 100, ceRegen: 12, speed: 355, r: 23,
    /* 体术：全场最高的近战伤害与最远的拳脚距离 */
    atkDmg: 78, atkCd: 0.30, atkRange: 88,
    bodyDR: 0.25,   /* ★ 天与咒缚：没有咒力可被灌注，一切伤害 -25% */
    /* ★ 无反转术式：甚尔完全靠肉体硬扛，没有回复手段 */
    /* 天逆鉾：白色弧形闪光，命中后目标 5 秒无法使用术式与领域（远程消耗主力） */
    heavenCost: 28, heavenCd: 7, heavenDmg: 130, heavenSeal: 5, heavenSpeed: 900,
    /* 万里锁：钩中目标 → 拽向自己 + 3 秒眩晕（拉近远程的关键） */
    chainCost: 35, chainCd: 10, chainDmg: 60, chainStun: 3,
    chainSpeed: 1250, chainPull: 0.55, chainRange: 900,
    /* 蝇头：与脱兔同类的小型召唤物（棕黄），每次 4 只、无上限、无攻击
       → 朝敌方呈扇形扑出，作为挡弹幕的肉盾 */
    flyCost: 18, flyCd: 5, flyHp: 70, flyDur: 6, flyCount: 4, flySpeed: 340,
    heavenImmuneDomain: true,   /* ★ 无法被领域选中 */
  }
};

const CLASH_DMG_LIMIT = 200;

/* ══════════════════════════════════════════
   开场台词（对决开始前 · 角色头顶打字机对白）
   self   = 该角色作为玩家方时的开场白
   retort = 面对某角色时的开场白（优先于 self）
   ══════════════════════════════════════════ */
const INTRO_CPS = 14;      /* 打字机速度：每秒输出字数 */
const INTRO_HOLD = 1.5;    /* 整句显示完后的停留秒数 */
const INTRO_QUOTES = {
  gojo: {
    self: '事先声明一下，你才是挑战者',
    retort: {
      gojo: '镜子里的人，也想当最强？',
      sukuna: '事先声明一下，你才是挑战者',
      sukunaTs: '十种影子？那就一起上吧，反正结果一样',
      higuruma: '法官先生，我可没打算接受你的审判',
      toji: '术式都省了？那就用拳头说话',
    },
  },
  sukuna: {
    self: '不过是生在没有我的时代的匹夫罢了',
    retort: {
      gojo: '不过是生在没有我的时代的匹夫罢了',
      sukuna: '本王可没有第二个',
      sukunaTs: '区区十影，也配与本王同名',
      higuruma: '你的判决，本王一概不受',
      toji: '没有咒力的杂鱼，也敢挡在本王面前',
    },
  },
  sukunaTs: {
    self: '十种影子，尽归我手',
    retort: {
      gojo: '天上天下，唯我独尊——那就先从你斩起',
      sukuna: '影中之影，今日便吞了你',
      sukunaTs: '影子对影子，看谁的更深',
      higuruma: '法庭？把法官一并斩了便是',
      toji: '没有术式的身体，斩起来最省事',
    },
  },
  higuruma: {
    self: '开庭。被告，请陈述你的姓名与罪状',
    retort: {
      gojo: '开庭。被告，请陈述你的姓名与罪状',
      sukuna: '判决无需被告同意',
      sukunaTs: '藐视法庭，罪加一等',
      higuruma: '同僚？那便由我来审你',
      toji: '被告，天逆鉾不是免罪符',
    },
  },
  toji: {
    self: '术式什么的，我从来不需要',
    retort: {
      gojo: '六眼？那正好，我讨厌天才',
      sukuna: '术式之王？我杀的就是这种',
      sukunaTs: '十影的咒灵，也一并宰了',
      higuruma: '法庭？我连判决一起斩了',
      toji: '两个我？正好，一个也不留',
    },
  },
};

/* 当前进行中的开场对白：{ seq:[{side,text}], idx, chars, hold } */
let introTalk = null;

let player = null, enemy = null;
let projectiles = [];
let summons = [];
let effects = [];
let cam = { x:0, y:0 };
let G = { state:'menu', time:0, shake:0, flash:0, clash:false, clashT:0 };
let keys = {};
let joy = { active:false, id:null, ox:0, oy:0, x:0, y:0 };
let holdAttack = false;
let blueHoldBtn = false;   /* ★ 手机端长按「苍」按钮 */
let selectedPlayerType = null;
let selectedEnemyType = null;
let btns = {};

/* ══════════════════════════════════════════
   战斗者
   ══════════════════════════════════════════ */
function createFighter(type, x, y){
  const c = CFG[type];
  return {
    type, name: c.name,
    x, y, r: c.r,
    hp: c.maxHp, maxHp: c.maxHp,
    ce: c.maxCe, maxCe: c.maxCe,
    speed: c.speed,
    facing: type === 'gojo' ? 0 : Math.PI,
    alive: true,
    attackCd: 0, stun: 0, hitFlash: 0,
    kbx: 0, kby: 0, clashDmg: 0,
    /* ★ 五条悟「无下限」默认开启（其余角色无此状态） */
    infinity: type === 'gojo', blueFist: false, blueUsed: false, redUsed: false,
    blueCharge: 0,                 /* ★ 长按苍的蓄力计时 */
    blueSlow: 0, blueSlowMul: 1,   /* ★ 被吸附型苍减速的剩余时间 / 倍率 */
    brainDamaged: false,
    cd: { blue:0, red:0, purple:0, domain:0, reverse:0, fire:0, dismantle:0, nue:0, dog:0, maho:0, tobi:0, space:0, shinuchi:0, sentence:0, heaven:0, chain:0, fly:0 },
    domainLock: 0,
    skillLock: 0,   /* 审判：术式禁用剩余时间 */
    sentence: 0,    /* 死刑：受到伤害提升剩余时间 */
    pull: null,     /* ★ 万里锁：正在被拖拽 { src, x0, y0, tx, ty, t, dur } */
    domain: null,
    mahoSummoned: false,   // 是否召唤过魔虚罗
    mahoDied: false,       // 召唤的魔虚罗是否已陨落
    spaceUnlocked: false,  // 空间斩是否解锁
  };
}

/* ══════════════════════════════════════════
   菜单 / 选人
   ══════════════════════════════════════════ */
const menuEl = document.getElementById('menu');
const selectEl = document.getElementById('selectScreen');
const overlayEl = document.getElementById('overlay');
const hudEl = document.getElementById('hud');
const ctrlEl = document.getElementById('controls');
const tipsEl = document.getElementById('tips');

function showMenu(){
  G.state = 'menu';
  menuEl.classList.remove('hidden');
  selectEl.classList.add('hidden');
  overlayEl.classList.remove('show');
  hudEl.style.display = 'none';
  ctrlEl.style.display = 'none';
  tipsEl.style.display = 'none';
  player = null; enemy = null;
}

function showSelect(){
  G.state = 'select';
  menuEl.classList.add('hidden');
  selectEl.classList.remove('hidden');
  lastSelect = { side: selectedPlayerType ? 'player' : 'ai', char: selectedPlayerType || selectedEnemyType };
  updateSelectUI();
}

function updateSelectUI(){
  document.querySelectorAll('.char-choice[data-side="player"] .char-card').forEach(c => {
    c.classList.toggle('selected', c.dataset.char === selectedPlayerType);
  });
  document.querySelectorAll('.char-choice[data-side="ai"] .char-card').forEach(c => {
    c.classList.toggle('selected', c.dataset.char === selectedEnemyType);
  });
  document.getElementById('startBtn').disabled = !(selectedPlayerType && selectedEnemyType);
  /* 刷新介绍浮层：优先显示最近点击的角色 */
  const c = lastSelect.char || selectedPlayerType || selectedEnemyType;
  const side = lastSelect.char ? lastSelect.side : (selectedPlayerType ? 'player' : 'ai');
  showCharInfo(c ? side : null, c);
}

document.querySelectorAll('.char-card').forEach(card => {
  card.addEventListener('click', () => {
    const side = card.closest('.char-choice').dataset.side;
    const char = card.dataset.char;
    if (side === 'player') selectedPlayerType = char;
    else selectedEnemyType = char;
    lastSelect = { side, char };
    updateSelectUI();
  });
});

document.getElementById('startBtn').addEventListener('click', () => {
  if (selectedPlayerType && selectedEnemyType)
    startGame(selectedPlayerType, selectedEnemyType);
});
document.getElementById('backBtn').addEventListener('click', () => showMenu());

document.querySelectorAll('.menu-btn[data-mode]').forEach(btn => {
  btn.addEventListener('click', () => {
    const mode = btn.dataset.mode;
    if (mode === 'pve'){
      selectedPlayerType = 'gojo';
      selectedEnemyType = 'sukuna';
      showSelect();
    } else {
      const toast = document.getElementById('menuToast');
      toast.textContent = '联机对战功能开发中 · 敬请期待';
      toast.classList.add('show');
      clearTimeout(toast._t);
      toast._t = setTimeout(() => toast.classList.remove('show'), 2200);
    }
  });
});

document.getElementById('restart').addEventListener('click', () => {
  if (selectedPlayerType && selectedEnemyType)
    startGame(selectedPlayerType, selectedEnemyType);
});
document.getElementById('backToMenu').addEventListener('click', () => showMenu());

/* ══════════════════════════════════════════
   开局
   ══════════════════════════════════════════ */
function startGame(pType, eType){
  G.state = 'playing';
  menuEl.classList.add('hidden');
  selectEl.classList.add('hidden');
  overlayEl.classList.remove('show');
  hudEl.style.display = '';
  ctrlEl.style.display = '';
  tipsEl.style.display = '';
  tipsEl.classList.remove('hide');

  player = createFighter(pType, 520, WORLD.h/2);
  enemy = createFighter(eType, 1200, WORLD.h/2);
  enemy.facing = Math.PI;

  projectiles = []; summons = []; effects = [];
  cam = { x:0, y:0 };
  G.time = 0; G.shake = 0; G.flash = 0; G.clash = false; G.clashT = 0;
  holdAttack = false;
  joy.x = joy.y = 0; joy.active = false; joy.id = null;
  tipsHidden = false;

  renderControls();
  updateHUDElements();
  updateTips();
  updateHUD();
  startIntro();          /* ★ 开场对白：打字机逐字输出，播完才进入战斗 */
}

/* 底部操作提示：按当前角色的实际技能生成（无领域/无反转的角色不会出现错误提示） */
function updateTips(){
  if (!tipsEl || !player) return;
  const list = SKILL_SETS[player.type] || [];
  const parts = ['WASD / 方向键 移动'];
  for (const s of list){
    if (s.act === 'attack') continue;
    parts.push(s.label + ' ' + s.sub);
  }
  /* ★ 五条悟专属提示：长按苍 → 吸附型引力球 → 再接赫 = 大范围茈 */
  if (player.type === 'gojo') parts.push('长按 Q：苍·吸附 → 再按 E 赫 → 大范围茈');
  tipsEl.innerHTML = parts.join(' · ') + '<br>手机：左侧拖动移动，右下按钮释放术式';
}

/* ══════════════════════════════════════════
   开场对白（角色头顶 · 打字机逐字）
   ══════════════════════════════════════════ */
function buildIntro(pType, eType){
  const seq = [];
  const A = INTRO_QUOTES[pType], B = INTRO_QUOTES[eType];
  if (A) seq.push({ side:'player', text: A.self });
  if (B) seq.push({ side:'enemy', text: (B.retort && B.retort[pType]) || B.self });
  return seq.filter(l => !!l.text);
}

function startIntro(){
  const seq = buildIntro(player.type, enemy.type);
  if (!seq.length){ introTalk = null; G.state = 'playing'; return; }
  introTalk = { seq, idx:0, chars:0, hold:0 };
  G.state = 'intro';
}

function endIntro(){
  introTalk = null;
  G.state = 'playing';
  updateCamera();
}

function advanceIntro(){
  if (!introTalk) return;
  introTalk.idx++;
  introTalk.chars = 0;
  introTalk.hold = 0;
  if (introTalk.idx >= introTalk.seq.length) endIntro();
}

/* 点击 / 按键：先补完当前句，再推进到下一句 */
function skipIntro(){
  if (!introTalk) return;
  const cur = introTalk.seq[introTalk.idx];
  if (!cur){ endIntro(); return; }
  if (introTalk.chars < cur.text.length){
    introTalk.chars = cur.text.length;
    introTalk.hold = 0;
  } else {
    advanceIntro();
  }
}

function updateIntro(dt){
  if (!introTalk) return;
  const cur = introTalk.seq[introTalk.idx];
  if (!cur){ endIntro(); return; }
  if (introTalk.chars < cur.text.length){
    introTalk.chars = Math.min(cur.text.length, introTalk.chars + dt * INTRO_CPS);
  } else {
    introTalk.hold += dt;
    if (introTalk.hold >= INTRO_HOLD) advanceIntro();
  }
}

/* 角色主题色（HUD 名牌 / 选人浮层共用） */
const NAME_COLORS = {
  gojo: '#9fd8ff', sukunaTs: '#c9a4ff', higuruma: '#ffd76a', sukuna: '#ff8a8a',
  toji: '#dfe4ea',
};
function nameColor(type){ return NAME_COLORS[type] || '#e7eaee'; }

function updateHUDElements(){
  const pPanel = document.querySelector('.panel.player');
  const ePanel = document.querySelector('.panel.enemy');
  pPanel.querySelector('.pname').textContent = player.name;
  pPanel.querySelector('.pname').style.color = nameColor(player.type);
  ePanel.querySelector('.pname').textContent = enemy.name;
  ePanel.querySelector('.pname').style.color = nameColor(enemy.type);
}

/* ══════════════════════════════════════════
   技能按钮
   ══════════════════════════════════════════ */
const SKILL_SETS = {
  gojo: [
    { act:'domain',     label:'领域',      sub:'SPACE', cls:'gold' },
    { act:'infinity',   label:'无下限',    sub:'F' },
    { act:'bluefist',   label:'苍拳',      sub:'G' },
    { act:'reverse',    label:'反转术式',  sub:'H', cls:'green' },
    { act:'blue',       label:'苍',        sub:'Q' },
    { act:'red',        label:'赫',        sub:'E', cls:'red' },
    { act:'purple',     label:'茈',        sub:'R', cls:'purple' },
    { act:'brainbreak', label:'破脑',      sub:'P', cls:'red' },
    { act:'attack',     label:'普通攻击',  sub:'J', cls:'attackbtn' },
  ],
  sukuna: [
    { act:'domain',    label:'领域',      sub:'SPACE', cls:'gold' },
    { act:'reverse',   label:'反转术式',  sub:'H', cls:'green' },
    { act:'fire',      label:'开',        sub:'E', cls:'red' },
    { act:'dismantle', label:'解',        sub:'Q', cls:'purple' },
    { act:'attack',    label:'斩击',      sub:'J', cls:'attackbtn' },
  ],
  sukunaTs: [
    { act:'domain',   label:'领域',      sub:'SPACE', cls:'gold' },
    { act:'space',    label:'空间斩',    sub:'F', cls:'space' },
    { act:'reverse',  label:'反转术式',  sub:'H', cls:'green' },
    { act:'nue',      label:'鵺',        sub:'Q', cls:'purple' },
    { act:'dog',      label:'玉犬',      sub:'E', cls:'red' },
    { act:'tobi',     label:'脱兔',      sub:'T', cls:'tobi' },
    { act:'mahoraga', label:'魔虚罗',    sub:'R', cls:'shadow' },
    { act:'attack',   label:'斩击',      sub:'J', cls:'attackbtn' },
  ],
  higuruma: [
    { act:'domain',   label:'诛伏赐死',  sub:'SPACE', cls:'gold' },
    { act:'shinuchi', label:'神槌',      sub:'Q', cls:'red' },
    { act:'sentence', label:'死刑宣告',  sub:'E', cls:'purple' },
    { act:'reverse',  label:'反转术式',  sub:'H', cls:'green' },
    { act:'attack',   label:'法槌',      sub:'J', cls:'attackbtn' },
  ],
  toji: [
    { act:'heaven',  label:'天逆鉾',    sub:'Q', cls:'gold' },
    { act:'chain',   label:'万里锁',    sub:'E', cls:'shadow' },
    { act:'fly',     label:'蝇头',      sub:'T', cls:'fly' },
    { act:'attack',  label:'体术',      sub:'J', cls:'attackbtn' },
  ],
};

/* ══════════════════════════════════════════
   角色介绍（选人浮层）
   ══════════════════════════════════════════ */
const CHAR_INFO = {
  gojo: {
    title: '五条悟',
    stats: 'HP 1200 · 咒力 145 · 速度 270 · 攻击 32',
    skills: [
      ['无下限', 'F · 默认开启；减免 65% 受到的伤害，持续消耗咒力'],
      ['苍拳', 'G · 普攻强化为冲拳，每次消耗咒力'],
      ['苍', 'Q · 引力球，吸附并拉扯敌人；长按 → 吸附型：滞空、把敌人拉向球心并减速'],
      ['赫', 'E · 斥力球，命中强力击退；场上若有吸附型苍，则被其牵引'],
      ['茈', 'R · 需先释放 苍+赫，贯穿大伤害；赫 撞上吸附型苍 → 范围 480 紫色冲击波「茈」'],
      ['无量空处', '空格 · 领域，僵直敌方并封印领域 20 秒'],
      ['反转术式', 'H · 回复生命 / 修复受损大脑'],
      ['破脑', 'P · 自伤以重置领域冷却'],
    ],
  },
  sukuna: {
    title: '两面宿傩',
    stats: 'HP 1600 · 咒力 120 · 速度 268 · 斩击 60',
    skills: [
      ['斩击', 'J · 远程斩击'],
      ['解', 'Q · 高速大范围斩击，可贯穿'],
      ['开', 'E · 火焰弹'],
      ['伏魔御厨子', '空格 · 领域，持续灼烧且不断扩张'],
      ['反转术式', 'H · 回复生命'],
    ],
  },
  sukunaTs: {
    title: '十影宿傩',
    stats: 'HP 1450 · 咒力 100 · 速度 272 · 斩击 42',
    skills: [
      ['脱兔', 'T · 每次召唤 4 只脱兔（无上限），自动靠拢敌人'],
      ['鵺', 'Q · 追踪雷电鸟'],
      ['玉犬', 'E · 召唤 2 只玉犬（各 120 HP）'],
      ['魔虚罗', 'R · 白球+法轮，会适应减伤；场上限 1 只'],
      ['空间斩', 'F · 魔虚罗陨落后解锁，命中即巨额伤害'],
      ['伏魔御厨子', '空格 · 领域（削弱版）'],
      ['反转术式', 'H · 回复生命'],
    ],
  },
  higuruma: {
    title: '日车宽见',
    stats: 'HP 1350 · 咒力 130 · 速度 276 · 法槌 34',
    skills: [
      ['法槌', 'J · 近战挥槌 34 伤害（触及约 114）'],
      ['神槌', 'Q · 30 咒力 · 追击突进：够得到就贴身（最长 480）+ 70 伤害击退'],
      ['死刑宣告', 'E · 35 咒力 · 320 范围：目标 15 秒内受伤 +50%、移速 −25%'],
      ['反转术式', 'H · 35 咒力 · 回复 200 生命'],
      ['诛伏赐死', '空格 · 领域：进入者 10 秒禁用所有主动术式，并被「拘传」拽向庭心'],
      ['追诉 / 审判', '有人被宣告死刑时自身移速 +20%；领域内自身移速 +30%、受伤 −30%'],
    ],
  },
  toji: {
    title: '伏黑甚尔',
    stats: 'HP 2000 · 咒力 100 · 速度 355 · 体术 78',
    skills: [
      ['体术', 'J · 近战重击 78 伤害 / 0.30s（触及约 134），出拳自带前压步持续压迫'],
      ['天逆鉾', 'Q · 28 咒力 / 7s · 远程弧形闪光 130 伤害，命中后目标 5 秒内无法使用术式与领域'],
      ['万里锁', 'E · 35 咒力 / 10s · 900 距离钩中敌人：60 伤害 + 拽向自己 + 眩晕 3 秒（对抗远程的核心）'],
      ['蝇头', 'T · 18 咒力 / 5s · 朝敌方扇形扑出 4 只棕黄小飞虫（70 HP、无攻击），替自己挡弹幕'],
      ['天与咒缚', '被动 · 速度 355 全场最高；一切伤害 −25%；无法被任何领域「选中」；没有反转术式'],
    ],
  },
};

let lastSelect = { side: null, char: null };

function showCharInfo(side, char){
  const box = document.getElementById('charInfo');
  if (!box) return;
  if (!char || !CHAR_INFO[char]){
    box.classList.add('hidden');
    box.innerHTML = '';
    return;
  }
  const info = CHAR_INFO[char];
  const sideLabel = side === 'player' ? '你的角色' : '人机角色';
  const color = nameColor(char);
  let html = `<div class="ci-head"><span class="ci-name" style="color:${color}">${info.title}</span><span class="ci-side">${sideLabel}</span></div>`;
  html += `<div class="ci-stats">${info.stats}</div><div class="ci-skills">`;
  for (const [n, d] of info.skills){
    html += `<div class="ci-skill"><b>${n}</b><span>${d}</span></div>`;
  }
  html += `</div>`;
  box.innerHTML = html;
  box.classList.remove('hidden');
}

/* ★ 按键排布优先级：数值越大越靠后（= 越靠近右下角的普攻键 / 拇指自然落点）
   1 = 状态类与低频术式（最上排）  2 = 召唤类中频  3 = 高频输出与保命  9 = 普攻（固定最后） */
const SKILL_PRIORITY = {
  domain:1, infinity:1, brainbreak:1, bluefist:1,
  dog:2, tobi:2, mahoraga:2, fly:2,
  reverse:3, blue:3, red:3, purple:3, fire:3, dismantle:3,
  space:3, nue:3, shinuchi:3, sentence:3, heaven:3, chain:3,
  attack:9,
};
const skillPriority = s => (SKILL_PRIORITY[s.act] !== undefined ? SKILL_PRIORITY[s.act] : 2);

function renderControls(){
  ctrlEl.innerHTML = '';
  btns = {};
  /* ★ 越常用的技能越靠近右下角（拇指落点），普攻单独占一行、贴右下角 */
  const list = (SKILL_SETS[player.type] || []).slice().sort((a, b) => skillPriority(a) - skillPriority(b));
  const cols = 4;
  ctrlEl.style.gridTemplateColumns = `repeat(${cols}, auto)`;

  for (const s of list){
    const btn = document.createElement('button');
    btn.className = 'skill' + (s.cls ? ' ' + s.cls : '');
    btn.dataset.act = s.act;
    btn.innerHTML = `${s.label}<span class="sub">${s.sub}</span>`;
    /* ★ CD 动画：扇形遮罩 + 剩余秒数 */
    const mask = document.createElement('span');
    mask.className = 'cdmask';
    btn.appendChild(mask);
    const cdtxt = document.createElement('span');
    cdtxt.className = 'cdtxt';
    btn.appendChild(cdtxt);
    btn._cdtxt = cdtxt;
    btn.style.setProperty('--p', 0);
    /* ★ 普攻键固定落在最右列的第一个空位：紧贴右下角，并与上方技能对齐 */
    if (s.act === 'attack') btn.style.gridColumn = cols + ' / ' + (cols + 1);
    btn.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      hideTips();
      if (G.state !== 'playing' || !player || !player.alive) return;
      if (s.act === 'attack') holdAttack = true;
      handleAction(s.act);
    });
    if (s.act === 'attack'){
      const off = () => { holdAttack = false; };
      btn.addEventListener('pointerup', off);
      btn.addEventListener('pointercancel', off);
      btn.addEventListener('pointerleave', off);
    }
    if (s.act === 'blue'){
      /* ★ 手机端：长按「苍」按钮同样能蓄力成吸附型引力球 */
      const onB  = () => { blueHoldBtn = true; };
      const offB = () => { blueHoldBtn = false; };
      btn.addEventListener('pointerdown', onB);
      btn.addEventListener('pointerup', offB);
      btn.addEventListener('pointercancel', offB);
      btn.addEventListener('pointerleave', offB);
    }
    ctrlEl.appendChild(btn);
    btns[s.act] = btn;
  }
}

function handleAction(act){
  /* ★ 审判：被禁用术式时只能普攻 */
  if (act !== 'attack' && player && player.skillLock > 0){
    addEffect({ type:'text', x:player.x, y:player.y-62, t:0, life:1.0,
      text:'审判 · 术式被禁止', color:'#ff9a9a', size:14 });
    return;
  }
  switch(act){
    case 'attack':     basicAttack(player, enemy); break;
    case 'domain':     castDomain(player, enemy); break;
    case 'reverse':    if (hasReverse(player.type)) castReverse(player); break;
    case 'infinity':   toggleInfinity(player); break;
    case 'bluefist':   toggleBlueFist(player); break;
    case 'blue':       gojoBlue(player, enemy); break;
    case 'red':        gojoRed(player, enemy); break;
    case 'purple':     gojoPurple(player, enemy); break;
    case 'fire':       sukunaFire(player, enemy); break;
    case 'dismantle':  sukunaDismantle(player, enemy); break;
    case 'nue':        tsNue(player, enemy); break;
    case 'dog':        tsDog(player); break;
    case 'tobi':       tsTobi(player); break;
    case 'mahoraga':   tsMahoraga(player); break;
    case 'space':      tsSpaceSlash(player, enemy); break;
    case 'brainbreak': brainBreak(player); break;
    case 'shinuchi':   higurumaShinuchi(player, enemy); break;
    case 'sentence':   higurumaSentence(player); break;
    case 'heaven':     tojiHeavenSpear(player, enemy); break;
    case 'chain':      tojiChain(player, enemy); break;
    case 'fly':        tojiFlyHead(player); break;
  }
}

/* ══════════════════════════════════════════
   输入
   ══════════════════════════════════════════ */
/* ★ 按键 → 技能动作映射：直接由 SKILL_SETS 推导
   （每个技能的 sub 就是它的按键，新增角色/技能无需再改按键逻辑） */
const KEY_ACTION = {};
(function buildKeyAction(){
  for (const type in SKILL_SETS){
    const map = {};
    for (const s of SKILL_SETS[type]){
      const raw = (s.sub || '').toLowerCase();
      if (!raw) continue;
      map[raw === 'space' ? ' ' : raw] = s.act;
    }
    KEY_ACTION[type] = map;
  }
})();

window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if ([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k)) e.preventDefault();
  if (e.repeat) return;
  keys[k] = true;
  /* ★ 开场对白：任意键补完当前句 / 推进 */
  if (G.state === 'intro'){ skipIntro(); return; }
  if (G.state !== 'playing' || !player || !player.alive) return;
  const act = (KEY_ACTION[player.type] || {})[k];
  if (act) handleAction(act);
  hideTips();
});
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
window.addEventListener('blur', () => { keys = {}; holdAttack = false; blueHoldBtn = false; joy.x = joy.y = 0; });

canvas.addEventListener('pointerdown', e => {
  if (G.state === 'intro'){ skipIntro(); return; }
  if (G.state !== 'playing') return;
  if (joy.id !== null) return;
  joy.id = e.pointerId; joy.active = true;
  joy.ox = e.clientX; joy.oy = e.clientY;
  joy.x = joy.y = 0;
  try { canvas.setPointerCapture(e.pointerId); } catch(_){}
  hideTips();
});
canvas.addEventListener('pointermove', e => {
  if (e.pointerId !== joy.id) return;
  let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy;
  const len = Math.hypot(dx, dy), max = 62;
  if (len > max) { dx = dx/len*max; dy = dy/len*max; }
  joy.x = dx/max; joy.y = dy/max;
});
const endJoy = e => {
  if (e.pointerId === joy.id){ joy.id = null; joy.active = false; joy.x = joy.y = 0; }
};
canvas.addEventListener('pointerup', endJoy);
canvas.addEventListener('pointercancel', endJoy);

let tipsHidden = false;
function hideTips(){
  if (tipsHidden) return;
  tipsHidden = true;
  if (!tipsEl) return;
  tipsEl.classList.add('hide');
  setTimeout(() => { tipsEl.style.display = 'none'; }, 1200);
}

/* ══════════════════════════════════════════
   破脑
   ══════════════════════════════════════════ */
function brainBreak(f){
  if (!f || !f.alive || f.stun > 0) return;
  if (f.type !== 'gojo') return;
  const c = CFG.gojo;
  if (f.brainDamaged || f.cd.domain <= 0) return;
  if (f.hp < f.maxHp * c.brainBreakMinHp) return;

  f.hp -= f.maxHp * c.brainBreakCost;
  f.hitFlash = 0.4;
  f.stun = c.brainBreakStun;
  f.brainDamaged = true;
  f.cd.domain = 0;

  addEffect({ type:'brainbreak', x:f.x, y:f.y, t:0, life:1.0 });
  addEffect({ type:'text', x:f.x, y:f.y-88, t:0, life:1.7,
    text:'破坏大脑 · 领域回路重置！', color:'#ff8a3d', size:18 });
  G.shake = 18; G.flash = 0.45;

  if (f.hp <= 0){
    f.hp = 0; f.alive = false;
    if (f === player) endGame('lose'); else endGame('win');
  }
  updateHUD();
}

function tickBrainBleed(f, dt){
  if (!f || !f.alive || !f.brainDamaged) return;
  const c = CFG.gojo;
  f.hp -= f.maxHp * c.brainBleed * dt;
  if (Math.random() < 0.3){
    addEffect({ type:'spark', x:f.x+rnd(-16,16), y:f.y+rnd(-16,16), t:0, life:rnd(.25,.5),
      vx:rnd(-30,30), vy:rnd(-80,-20), color:'#ff6b3d', size:rnd(2,3.5) });
  }
  if (f.hp <= 0){
    f.hp = 0; f.alive = false;
    if (f === player) endGame('lose'); else endGame('win');
  }
}

/* ══════════════════════════════════════════
   基础攻击 / 反转术式 / 领域
   ══════════════════════════════════════════ */
/* ══════════════════════════════════════════
   瞄准：优先锁定靠近的敌方式神
   ══════════════════════════════════════════ */
function acquireAim(attacker, defaultTarget){
  if (!attacker) return defaultTarget;
  const foe = attacker === player ? enemy : player;
  if (!foe) return defaultTarget;
  let best = null, bestD = 400;
  for (const s of summons){
    if (!s || s.owner !== foe) continue;
    if (!finite(s.x) || !finite(s.y) || s.hp <= 0) continue;
    const d = dist(attacker, s);
    if (d < bestD){ best = s; bestD = d; }
  }
  return best || defaultTarget;
}

/* 日车宽见：是否身处自己的「诛伏赐死」领域内 */
function inOwnHigurumaDomain(f){
  return !!(f && f.domain && f.domain.type === 'higuruma' && dist(f, f.domain) < f.domain.r);
}

/* 实际移动速度（领域加成 / 追诉加成 / 死刑减速） */
function moveSpeed(f){
  let spd = f.speed;
  if (f.sentence > 0) spd *= (1 - CFG.higuruma.sentenceSlow);   /* 被宣告死刑：减速 */
  if (f.blueSlow > 0) spd *= (f.blueSlowMul || 1);              /* ★ 被吸附型苍减速 */
  if (f.type === 'higuruma'){
    if (inOwnHigurumaDomain(f)) spd *= CFG.higuruma.domainSpeedMul;
    const foe = f === player ? enemy : player;
    if (foe && foe.sentence > 0) spd *= CFG.higuruma.chaseSpeedMul;  /* 追诉加成 */
  }
  return spd;
}

/* 普攻为「贴身近战」的角色（其余角色普攻为远程斩击） */
const MELEE_TYPES = { gojo: true, higuruma: true, toji: true };
function isMeleeType(type){ return !!MELEE_TYPES[type]; }

function basicAttack(attacker, target){
  if (!attacker || !attacker.alive || attacker.stun > 0 || attacker.attackCd > 0) return;
  if (!target || !target.alive) return;
  const c = CFG[attacker.type];

  if (isMeleeType(attacker.type)){
    const isGojo = attacker.type === 'gojo';
    let dmg = c.atkDmg;
    let isBF = false;

    /* 五条悟专属：苍拳与黑闪 */
    if (isGojo){
      if (attacker.blueFist){
        if (attacker.ce < c.bfCost) return;
        attacker.ce -= c.bfCost;
        dmg *= c.bfMult;
      }
      isBF = Math.random() < 0.12;
      if (isBF){
        dmg *= 2.5;
        attacker.ce = attacker.maxCe;   /* 黑闪直接充满（上限为角色咒力上限） */
        addEffect({ type:'blackflash', x:target.x, y:target.y, t:0, life:0.55 });
        addEffect({ type:'text', x:attacker.x, y:attacker.y-60, t:0, life:1.1, text:'黑 闪！', color:'#ff3b3b', size:26 });
        G.shake = 20; G.flash = 0.45;
      }
    }

    attacker.attackCd = c.atkCd;
    addEffect({ type:'punch', x:attacker.x, y:attacker.y, ang:attacker.facing, t:0, life:0.16,
      color: isGojo ? '#b4e6ff' : (attacker.type === 'toji' ? '#e6ebf1' : '#ffd76a') });
    if (isGojo && attacker.blueFist){
      /* ★ 苍拳冲拳：向前突进 + 能量冲拳特效 */
      const la = attacker.facing;
      attacker.x = clamp(attacker.x + Math.cos(la)*14, attacker.r, WORLD.w-attacker.r);
      attacker.y = clamp(attacker.y + Math.sin(la)*14, attacker.r, WORLD.h-attacker.r);
      addEffect({ type:'bluepunch', x:attacker.x, y:attacker.y, ang:la, t:0, life:0.24 });
    } else if (attacker.type === 'toji'){
      /* ★ 甚尔：出拳带前压步，贴身不脱节（对抗远程时持续压迫） */
      const la = attacker.facing;
      attacker.x = clamp(attacker.x + Math.cos(la)*14, attacker.r, WORLD.w-attacker.r);
      attacker.y = clamp(attacker.y + Math.sin(la)*14, attacker.r, WORLD.h-attacker.r);
    }

    const d = dist(attacker, target);
    if (d <= attacker.r + target.r + c.atkRange){
      damage(target, dmg);
      const ang = Math.atan2(target.y-attacker.y, target.x-attacker.x);
      let kb = isBF ? 26 : 12;
      if (isGojo && attacker.blueFist) kb *= c.blueFistKb;
      target.x = clamp(target.x + Math.cos(ang)*kb, target.r, WORLD.w-target.r);
      target.y = clamp(target.y + Math.sin(ang)*kb, target.r, WORLD.h-target.r);
      addEffect({ type:'ring', x:target.x, y:target.y, t:0, life:0.25,
        r0:6, r1:isBF?70:38, color:isBF?'#ff4444':'#9fd8ff', width:isBF?6:3 });
    }
    /* 近战同样可以打中敌方式神 */
    const foe = attacker === player ? enemy : player;
    for (const sm of summons){
      if (!sm || sm.owner !== foe) continue;
      if (dist(attacker, sm) <= attacker.r + sm.r + c.atkRange) damageSummon(sm, dmg, 'melee');
    }
  } else {
    attacker.attackCd = c.atkCd;
    const aim = acquireAim(attacker, target);
    const ang = Math.atan2(aim.y-attacker.y, aim.x-attacker.x);
    attacker.facing = ang;
    const col = attacker.type === 'sukunaTs' ? '#c9a4ff' : '#ff6b8a';
    spawnSlash(attacker, ang, 0, col);
    addEffect({ type:'punch', x:attacker.x, y:attacker.y, ang, t:0, life:0.16 });
  }
}

/* 是否掌握反转术式（伏黑甚尔没有） */
function hasReverse(type){
  const c = CFG[type];
  return !!(c && finite(c.reverseCost) && finite(c.reverseHeal));
}

function castReverse(f){
  if (!f || !f.alive || f.stun > 0) return;
  const c = CFG[f.type];
  if (!hasReverse(f.type)) return;
  if (f.cd.reverse > 0 || f.ce < c.reverseCost) return;
  if (f.hp >= f.maxHp && !f.brainDamaged) return;

  f.ce -= c.reverseCost;
  f.cd.reverse = c.reverseCd;

  if (f.brainDamaged){
    f.brainDamaged = false;
    addEffect({ type:'text', x:f.x, y:f.y-88, t:0, life:1.5,
      text:'反转术式 · 大脑修复完成', color:'#6dffa0', size:16 });
    for (let i=0;i<14;i++){
      addEffect({ type:'spark', x:f.x+rnd(-22,22), y:f.y+rnd(-22,22), t:0, life:rnd(.5,.9),
        vx:rnd(-40,40), vy:rnd(-120,-40), color:'#6dffa0', size:rnd(2,4) });
    }
    addEffect({ type:'ring', x:f.x, y:f.y, t:0, life:0.7, r0:10, r1:90, color:'#6dffa0', width:4 });
  }

  const before = f.hp;
  f.hp = Math.min(f.maxHp, f.hp + c.reverseHeal);
  addEffect({ type:'heal', x:f.x, y:f.y, t:0, life:0.9, color:'#6dffa0' });
  addEffect({ type:'text', x:f.x, y:f.y-62, t:0, life:1.1,
    text:'反转术式 +' + Math.round(f.hp-before), color:'#6dffa0', size:17 });
}

function castDomain(f, target){
  if (!f || !f.alive || f.stun > 0) return;
  const c = CFG[f.type];

  if (f.brainDamaged){
    if (f === player)
      addEffect({ type:'text', x:f.x, y:f.y-60, t:0, life:1.2,
        text:'大脑受损 · 需反转术式修复', color:'#ff6b6b', size:14 });
    return;
  }
  if (!c.domainName){           /* ★ 没有领域的角色（伏黑甚尔）无法展开领域 */
    if (f === player)
      addEffect({ type:'text', x:f.x, y:f.y-60, t:0, life:1.1,
        text:'天与咒缚 · 无法展开领域', color:'#dfe4ea', size:14 });
    return;
  }
  if (f.skillLock > 0) return;  /* ★ 术式被封印时无法展开领域 */
  if (f.cd.domain > 0 || f.ce < c.domainCost || f.domain) return;
  if (f.domainLock > 0) return;

  f.ce -= c.domainCost;
  f.cd.domain = c.domainCd;
  f.domain = {
    type: f.type,
    x: f.x, y: f.y, r: 0,
    baseR: c.domainBaseR, maxR: c.domainMaxR,
    life: c.domainDuration, maxLife: c.domainDuration, t: 0,
    hitOpponent: false,
  };
  const text = '领域展开 · ' + (c.domainName || '');
  const color = f.type === 'gojo' ? '#c9a4ff' : '#ff5c5c';
  addEffect({ type:'text', x:f.x, y:f.y-90, t:0, life:2.4, text, color, size:26 });
  addEffect({ type:'ring', x:f.x, y:f.y, t:0, life:0.8, r0:10, r1:400, color, width:8 });
  G.shake = 28; G.flash = 0.55;
}

/* ══════════════════════════════════════════
   五条悟术式
   ══════════════════════════════════════════ */
/* ★ 玩家是否正按住「苍」键（键盘 Q / 手机按钮） */
function blueKeyHeld(){ return !!keys['q'] || blueHoldBtn; }

/* ★ 长按「苍」：把刚刚发射的普通苍升级为「吸附型引力球」
   （点按 = 普通苍；按住 ≥ blueHoldTime = 引力球） */
function tickBlueCharge(p, dt){
  if (!p) return;
  if (p.type !== 'gojo' || !blueKeyHeld()){ p.blueCharge = 0; return; }
  p.blueCharge = (p.blueCharge || 0) + dt;
  const c = CFG.gojo;
  if (p.blueCharge < c.blueHoldTime) return;

  let orb = null;
  for (const pr of projectiles){
    if (!pr || pr.dead || pr.type !== 'blue' || pr.owner !== p || pr.charged) continue;
    if ((pr.age || 0) > 0.6) continue;               /* 只升级刚出手的那一颗 */
    if (!orb || (pr.age || 0) < (orb.age || 0)) orb = pr;
  }
  if (!orb) return;

  orb.charged = true;
  orb.life = Math.max(orb.life, c.blueChargedLife);
  orb.maxLife = c.blueChargedLife;
  orb.r = 26;
  orb.vx *= 0.3; orb.vy *= 0.3;                      /* 急停，化作滞空引力球 */
  addEffect({ type:'ring', x:orb.x, y:orb.y, t:0, life:0.5, r0:12, r1:120, color:'#7fd0ff', width:5 });
  addEffect({ type:'text', x:p.x, y:p.y-74, t:0, life:1.1, text:'苍 · 吸附', color:'#8fd4ff', size:18 });
  p.blueCharge = 0;                                  /* 一颗苍只升级一次 */
}

function gojoBlue(gojo, target){
  const c = CFG.gojo;
  if (!gojo.alive || gojo.stun > 0 || gojo.cd.blue > 0 || gojo.ce < c.blueCost) return;
  gojo.ce -= c.blueCost;
  gojo.cd.blue = c.blueCd;
  gojo.blueUsed = true;
  const aim = acquireAim(gojo, target);
  const ang = Math.atan2(aim.y-gojo.y, aim.x-gojo.x);
  projectiles.push({
    type:'blue', owner:gojo,
    x:gojo.x+Math.cos(ang)*32, y:gojo.y+Math.sin(ang)*32,
    vx:Math.cos(ang)*520, vy:Math.sin(ang)*520,
    r:20, life:3.0, maxLife:3.0, age:0,
    charged:false,        /* ★ 长按后由 tickBlueCharge 升级 */
    damage:c.blueDmg, hitCd:0,
  });
  addEffect({ type:'ring', x:gojo.x, y:gojo.y, t:0, life:0.3, r0:8, r1:56, color:'#4aa8ff', width:3 });
}

function gojoRed(gojo, target){
  const c = CFG.gojo;
  if (!gojo.alive || gojo.stun > 0 || gojo.cd.red > 0 || gojo.ce < c.redCost) return;
  gojo.ce -= c.redCost;
  gojo.cd.red = c.redCd;
  gojo.redUsed = true;
  const aim = acquireAim(gojo, target);
  const ang = Math.atan2(aim.y-gojo.y, aim.x-gojo.x);
  /* ★ 场上若存在「吸附型苍」，赫会被它牵引；两者相撞 → 大范围茈爆炸 */
  let orb = null;
  for (const pr of projectiles){
    if (!pr || pr.dead || pr.type !== 'blue' || !pr.charged || pr.owner !== gojo) continue;
    if (!orb || (pr.age || 0) > (orb.age || 0)) orb = pr;
  }
  projectiles.push({
    type:'red', owner:gojo,
    x:gojo.x+Math.cos(ang)*34, y:gojo.y+Math.sin(ang)*34,
    vx:Math.cos(ang)*820, vy:Math.sin(ang)*820,
    r:30, life: orb ? 3.0 : 1.2, damage:c.redDmg,
    homingBlue: orb,
  });
  if (orb) addEffect({ type:'text', x:gojo.x, y:gojo.y-74, t:0, life:1.1,
    text:'赫 → 苍 · 引力共鸣', color:'#ffb37a', size:16 });
  addEffect({ type:'ring', x:gojo.x, y:gojo.y, t:0, life:0.35, r0:8, r1:70, color:'#ff4a4a', width:4 });
}

/* ★ 赫撞上吸附型苍：大范围（480）紫色冲击波「茈」 */
function purpleBlast(x, y, owner){
  const c = CFG.gojo;
  const R = c.purpleBlastR;
  const foe = owner === player ? enemy : player;

  addEffect({ type:'bigpurple', x, y, t:0, life:0.85, r0:24, r1:R });
  addEffect({ type:'ring', x, y, t:0, life:0.6, r0:20, r1:R*0.6, color:'#e2c4ff', width:14 });
  addEffect({ type:'text', x, y:y-96, t:0, life:1.3, text:'虚式 · 茈', color:'#d9a6ff', size:26 });
  spawnBurst(x, y, '#c07bff', 32, 260, 900, 3, 8);
  spawnBurst(x, y, '#ffffff', 16, 180, 640, 2, 6);
  G.shake = Math.max(G.shake, 34);
  G.flash = Math.max(G.flash, 0.5);

  if (foe && foe.alive && Math.hypot(foe.x - x, foe.y - y) < R + foe.r){
    damage(foe, c.purpleBlastDmg);
    const a = Math.atan2(foe.y - y, foe.x - x);
    foe.kbx = Math.cos(a) * c.purpleBlastKb;
    foe.kby = Math.sin(a) * c.purpleBlastKb;
  }
  for (const s of summons){
    if (!s || s.owner !== foe) continue;
    if (!finite(s.x) || !finite(s.y) || s.hp <= 0) continue;
    if (Math.hypot(s.x - x, s.y - y) < R + s.r) damageSummon(s, c.purpleBlastDmg, 'purple');
  }
}

function gojoPurple(gojo, target){
  const c = CFG.gojo;
  if (!gojo.alive || gojo.stun > 0 || gojo.cd.purple > 0 || gojo.ce < c.purpleCost) return;
  if (!gojo.blueUsed || !gojo.redUsed) return;
  gojo.ce -= c.purpleCost;
  gojo.cd.purple = c.purpleCd;
  gojo.blueUsed = false;
  gojo.redUsed = false;
  const aim = acquireAim(gojo, target);
  const ang = Math.atan2(aim.y-gojo.y, aim.x-gojo.x);
  projectiles.push({
    type:'purple', owner:gojo,
    x:gojo.x+Math.cos(ang)*40, y:gojo.y+Math.sin(ang)*40,
    vx:Math.cos(ang)*900, vy:Math.sin(ang)*900,
    r:44, life:1.0, damage:c.purpleDmg, pierce:true,
  });
  addEffect({ type:'ring', x:gojo.x, y:gojo.y, t:0, life:0.5, r0:10, r1:120, color:'#c07bff', width:6 });
  addEffect({ type:'text', x:gojo.x, y:gojo.y-70, t:0, life:1.0, text:'虚式 · 茈', color:'#c07bff', size:20 });
}

function toggleInfinity(f){
  if (!f || !f.alive) return;
  if (!f.infinity && f.ce <= 5) return;
  f.infinity = !f.infinity;
  if (f.infinity)
    addEffect({ type:'text', x:f.x, y:f.y-56, t:0, life:0.8, text:'无下限', color:'#7fe0ff', size:16 });
}

function toggleBlueFist(f){
  if (!f || !f.alive) return;
  f.blueFist = !f.blueFist;
  addEffect({ type:'text', x:f.x, y:f.y-56, t:0, life:0.8,
    text: f.blueFist ? '苍拳 · 开' : '苍拳 · 关', color:'#5aa8ff', size:16 });
}

/* ══════════════════════════════════════════
   两面宿傩术式
   ══════════════════════════════════════════ */
function sukunaFire(s, target){
  const c = CFG.sukuna;
  if (!s.alive || s.stun > 0 || s.cd.fire > 0 || s.ce < c.fireCost) return;
  s.ce -= c.fireCost;
  s.cd.fire = c.fireCd;
  const aim = acquireAim(s, target);
  const ang = Math.atan2(aim.y-s.y, aim.x-s.x);
  projectiles.push({
    type:'fire', owner:s,
    x:s.x+Math.cos(ang)*34, y:s.y+Math.sin(ang)*34,
    vx:Math.cos(ang)*480, vy:Math.sin(ang)*480,
    r:30, life:2.0, damage:c.fireDmg,
  });
  addEffect({ type:'text', x:s.x, y:s.y-58, t:0, life:0.9, text:'开', color:'#ff8a3d', size:20 });
}

function sukunaDismantle(s, target){
  const c = CFG.sukuna;
  if (!s.alive || s.stun > 0 || s.cd.dismantle > 0 || s.ce < c.dismantleCost) return;
  s.ce -= c.dismantleCost;
  s.cd.dismantle = c.dismantleCd;
  const aim = acquireAim(s, target);
  const ang = Math.atan2(aim.y-s.y, aim.x-s.x);
  s.facing = ang;
  projectiles.push({
    type:'dismantle', owner:s,
    x:s.x+Math.cos(ang)*36, y:s.y+Math.sin(ang)*36,
    vx:Math.cos(ang)*1100, vy:Math.sin(ang)*1100,
    r:40, life:1.4, damage:c.dismantleDmg, rot:ang, pierce:true,
  });
  addEffect({ type:'ring', x:s.x, y:s.y, t:0, life:0.35, r0:10, r1:80, color:'#c07bff', width:5 });
  addEffect({ type:'text', x:s.x, y:s.y-70, t:0, life:0.9, text:'解', color:'#c07bff', size:22 });
  G.shake = Math.max(G.shake, 8);
}

/* ══════════════════════════════════════════
   十影宿傩术式
   ══════════════════════════════════════════ */
function tsNue(s, target){
  const c = CFG.sukunaTs;
  if (!s.alive || s.stun > 0 || s.cd.nue > 0 || s.ce < c.nueCost) return;
  s.ce -= c.nueCost;
  s.cd.nue = c.nueCd;
  const aim = acquireAim(s, target);
  const ang = Math.atan2(aim.y-s.y, aim.x-s.x);
  projectiles.push({
    type:'nue', owner:s,
    x:s.x+Math.cos(ang)*36, y:s.y+Math.sin(ang)*36,
    vx:Math.cos(ang)*500, vy:Math.sin(ang)*500,
    r:22, life:2.6, damage:c.nueDmg,
    turnRate:6.0, age:0,
  });
  addEffect({ type:'ring', x:s.x, y:s.y, t:0, life:0.35, r0:8, r1:60, color:'#c9a4ff', width:3 });
  addEffect({ type:'text', x:s.x, y:s.y-58, t:0, life:0.8, text:'鵺', color:'#c9a4ff', size:18 });
}

function tsDog(s){
  const c = CFG.sukunaTs;
  if (!s.alive || s.stun > 0 || s.cd.dog > 0 || s.ce < c.dogCost) return;
  s.ce -= c.dogCost;
  s.cd.dog = c.dogCd;

  const facing = finite(s.facing) ? s.facing : 0;
  for (let i = 0; i < 2; i++){
    const side = i === 0 ? 1 : -1;
    const perp = facing + Math.PI / 2 * side;
    const ox = Math.cos(perp) * 32;
    const oy = Math.sin(perp) * 32;
    summons.push({
      type: 'dog',
      owner: s,
      x: s.x + ox,
      y: s.y + oy,
      r: 16,
      speed: 380,
      life: c.dogDur,
      maxLife: c.dogDur,
      hp: c.dogHp, maxHp: c.dogHp,     /* ★ 式神血量：耗尽即消失 */
      damage: c.dogDmg,
      hitCd: 0,
      hitFlash: 0,
      attackInterval: 0.5,
      angle: facing,
    });
  }
  addEffect({ type:'ring', x:s.x, y:s.y, t:0, life:0.5, r0:10, r1:90, color:'#ff8a3d', width:4 });
  addEffect({ type:'text', x:s.x, y:s.y-58, t:0, life:1.0, text:'玉犬', color:'#ff8a3d', size:20 });
}

function tsMahoraga(s){
  const c = CFG.sukunaTs;
  if (!s.alive || s.stun > 0 || s.cd.maho > 0 || s.ce < c.mahoCost) return;

  /* ★ 召唤上限：场上已有己方魔虚罗则无法再次召唤 */
  for (const sm of summons){
    if (sm && sm.owner === s && sm.type === 'mahoraga' && sm.hp > 0){
      if (s === player)
        addEffect({ type:'text', x:s.x, y:s.y-62, t:0, life:1.0,
          text:'已有魔虚罗在场', color:'#ffd76a', size:13 });
      return;
    }
  }

  s.ce -= c.mahoCost;
  s.cd.maho = c.mahoCd;
  const facing = finite(s.facing) ? s.facing : 0;
  summons.push({
    type: 'mahoraga',
    owner: s,
    x: s.x + Math.cos(facing) * 60,
    y: s.y + Math.sin(facing) * 60,
    r: 40,
    speed: 210,
    life: 1, maxLife: 1, noExpire: true,  /* ★ 无时间限制，仅血量耗尽后消失 */
    hp: c.mahoHp, maxHp: c.mahoHp,
    damage: c.mahoDmg,
    hitCd: 0,
    hitFlash: 0,
    stun: 0,
    attackInterval: 1.0,
    angle: facing,
    adapt: {},        /* ★ 适应：伤害来源 → 已适应层数 */
    slashAnim: 0,     /* ★ 砍击动作计时 */
  });
  s.mahoSummoned = true;   /* ★ 记录已召唤过魔虚罗（空间斩解锁条件之一） */
  addEffect({ type:'ring', x:s.x, y:s.y, t:0, life:0.9, r0:20, r1:220, color:'#ffd76a', width:8 });
  addEffect({ type:'text', x:s.x, y:s.y-70, t:0, life:1.6, text:'布瑠部由良由良', color:'#fff3c4', size:22 });
  addEffect({ type:'text', x:s.x, y:s.y-40, t:0, life:1.6, text:'魔虚罗 · 显现', color:'#ffd76a', size:18 });
  G.shake = 24; G.flash = 0.5;
}

/* ★ 脱兔：每次4只、无召唤上限、无攻击，自动向敌方靠拢 */
function tsTobi(s){
  const c = CFG.sukunaTs;
  if (!s.alive || s.stun > 0 || s.cd.tobi > 0 || s.ce < c.tobiCost) return;
  s.ce -= c.tobiCost;
  s.cd.tobi = c.tobiCd;
  const facing = finite(s.facing) ? s.facing : 0;
  for (let i = 0; i < c.tobiCount; i++){
    const a = facing + (i / c.tobiCount) * TAU + rnd(-0.3, 0.3);
    summons.push({
      type: 'tobi',
      owner: s,
      x: s.x + Math.cos(a) * 44,
      y: s.y + Math.sin(a) * 44,
      r: 11,
      speed: c.tobiSpeed,
      life: c.tobiDur, maxLife: c.tobiDur,
      hp: c.tobiHp, maxHp: c.tobiHp,
      damage: 0,          /* 无攻击手段 */
      hitCd: 0, hitFlash: 0,
      attackInterval: 999,
      angle: a,
    });
  }
  addEffect({ type:'ring', x:s.x, y:s.y, t:0, life:0.4, r0:10, r1:80, color:'#cfd8e6', width:3 });
  addEffect({ type:'text', x:s.x, y:s.y-58, t:0, life:0.9, text:'脱兔', color:'#dfe6f2', size:18 });
}

/* ══════════════════════════════════════════
   空间斩（十影宿傩）
   解锁：至少召唤过一次魔虚罗，且该魔虚罗已陨落
   ══════════════════════════════════════════ */
function tsSpaceSlash(s, target){
  const c = CFG.sukunaTs;
  if (!s || !s.alive || s.stun > 0) return;

  if (!s.spaceUnlocked){
    if (s === player)
      addEffect({ type:'text', x:s.x, y:s.y-62, t:0, life:1.3,
        text:'空间斩未解锁 · 需魔虚罗显现并陨落', color:'#ff9a9a', size:13 });
    return;
  }
  if (s.cd.space > 0 || s.ce < c.spaceCost) return;

  s.ce -= c.spaceCost;
  s.cd.space = c.spaceCd;

  const aim = acquireAim(s, target);
  const ang = aim ? Math.atan2(aim.y-s.y, aim.x-s.x) : (finite(s.facing) ? s.facing : 0);
  s.facing = ang;
  projectiles.push({
    type:'space', owner:s,
    x:s.x+Math.cos(ang)*40, y:s.y+Math.sin(ang)*40,
    vx:Math.cos(ang)*1500, vy:Math.sin(ang)*1500,
    r:26, life:1.1, damage:c.spaceDmg, rot:ang,
    pierce:false, color:'#ffe9a8',   /* 命中角色或式神即消失 */
  });
  addEffect({ type:'ring', x:s.x, y:s.y, t:0, life:0.4, r0:10, r1:130, color:'#ffe9a8', width:6 });
  addEffect({ type:'text', x:s.x, y:s.y-74, t:0, life:1.1, text:'空间斩', color:'#fff0b0', size:22 });
  G.shake = Math.max(G.shake, 14);
}

/* ══════════════════════════════════════════
   日车宽见术式 —— 审判
   ══════════════════════════════════════════ */
/* 神槌：短距离突进 + 高伤（70 咒力 / 40 伤害） */
function higurumaShinuchi(s, target){
  const c = CFG.higuruma;
  if (!s || !s.alive || s.stun > 0 || s.cd.shinuchi > 0 || s.ce < c.shinuchiCost) return;
  s.ce -= c.shinuchiCost;
  s.cd.shinuchi = c.shinuchiCd;

  const aim = acquireAim(s, target);
  const ang = aim ? Math.atan2(aim.y-s.y, aim.x-s.x) : (finite(s.facing) ? s.facing : 0);
  s.facing = ang;

  const fromX = s.x, fromY = s.y;
  /* ★ 追击式突进：目标在射程内就落在其身前，够不到则按最大距离冲刺 */
  let dashLen = c.shinuchiDash;
  if (aim){
    const contact = s.r + (aim.r || 20) + 4;
    const gap = Math.hypot(aim.x - s.x, aim.y - s.y) - contact;
    dashLen = clamp(gap, 0, c.shinuchiDash);
  }
  s.x = clamp(s.x + Math.cos(ang)*dashLen, s.r, WORLD.w - s.r);
  s.y = clamp(s.y + Math.sin(ang)*dashLen, s.r, WORLD.h - s.r);

  /* 突进轨迹 */
  for (let i = 1; i <= 10; i++){
    const k = i/10;
    addEffect({ type:'spark', x: fromX + (s.x-fromX)*k, y: fromY + (s.y-fromY)*k,
      t:0, life:rnd(.18,.34), vx:rnd(-50,50), vy:rnd(-50,50), color:'#ffd76a', size:rnd(2,4) });
  }
  addEffect({ type:'ring', x:s.x, y:s.y, t:0, life:0.35, r0:8, r1:96, color:'#ffd76a', width:5 });

  /* 沿途命中敌方本体（只结算一次） */
  const foe = s === player ? enemy : player;
  if (foe && foe.alive){
    for (let i = 1; i <= 12; i++){
      const k = i/12;
      const px = fromX + (s.x-fromX)*k, py = fromY + (s.y-fromY)*k;
      if (Math.hypot(px-foe.x, py-foe.y) <= s.r + foe.r + 18){
        damage(foe, c.shinuchiDmg);
        foe.kbx = Math.cos(ang)*c.shinuchiKb;
        foe.kby = Math.sin(ang)*c.shinuchiKb;
        G.shake = Math.max(G.shake, 16);
        break;
      }
    }
  }
  /* 终点命中的式神 */
  for (const sm of summons){
    if (!sm || sm.owner !== foe) continue;
    if (dist(s, sm) <= s.r + sm.r + 26) damageSummon(sm, c.shinuchiDmg, 'melee');
  }

  addEffect({ type:'text', x:s.x, y:s.y-72, t:0, life:1.0, text:'神槌', color:'#ffd76a', size:20 });
  G.shake = Math.max(G.shake, 8);
}

/* 死刑宣告：范围内目标 15 秒内受到伤害 +50% */
function higurumaSentence(s){
  const c = CFG.higuruma;
  if (!s || !s.alive || s.stun > 0 || s.cd.sentence > 0 || s.ce < c.sentenceCost) return;
  s.ce -= c.sentenceCost;
  s.cd.sentence = c.sentenceCd;

  const foe = s === player ? enemy : player;
  let marked = 0;
  if (foe && foe.alive && dist(s, foe) <= c.sentenceRange + foe.r){
    foe.sentence = c.sentenceDuration;
    marked++;
  }
  for (const sm of summons){
    if (!sm || sm.owner !== foe) continue;
    if (dist(s, sm) <= c.sentenceRange + sm.r){ sm.sentence = c.sentenceDuration; marked++; }
  }

  addEffect({ type:'ring', x:s.x, y:s.y, t:0, life:0.6,
    r0:24, r1:c.sentenceRange, color:'#ff4a4a', width:4 });
  addEffect({ type:'text', x:s.x, y:s.y-72, t:0, life:1.3, text:'死刑宣告', color:'#ff4a4a', size:22 });
  if (marked === 0)
    addEffect({ type:'text', x:s.x, y:s.y-46, t:0, life:1.0, text:'范围内无目标', color:'#ff9a9a', size:12 });
  G.shake = Math.max(G.shake, 10);
}

/* ★ 日车宽见 AI：先贴「死刑」，再开庭，领域内靠普攻收人头 */
function aiHiguruma(ai, target, d, ang){
  const c = CFG.higuruma;
  const marked = target.sentence > 0;

  /* 开庭：把敌人关进法庭 */
  if (ai.cd.domain <= 0 && ai.ce >= c.domainCost && !ai.domain && !player.domain &&
      (d < 320 || target.hp < target.maxHp*0.6)) castDomain(ai, target);

  /* 死刑宣告：没有标记就贴上去宣告 */
  if (!marked && ai.cd.sentence <= 0 && ai.ce >= c.sentenceCost &&
      d < c.sentenceRange + target.r) higurumaSentence(ai);

  /* 神槌：既是突进也是爆发 */
  if (ai.cd.shinuchi <= 0 && ai.ce >= c.shinuchiCost && d < 520 &&
      (marked || d > 220)) higurumaShinuchi(ai, target);

  if (ai.attackCd <= 0 && d < ai.r + target.r + c.atkRange + 16) basicAttack(ai, target);

  /* 走位：领域内/已宣告死刑时贴身，否则维持中距 */
  const press = inOwnHigurumaDomain(ai) || marked;
  let m, strafe;
  if (press){
    m = d > 70 ? 1 : (d < 46 ? -0.2 : 0.06);
    strafe = Math.sin(G.time * 2.2) * 0.25;
  } else {
    m = d > 300 ? 1 : (d < 160 ? -0.7 : 0.15);
    strafe = Math.sin(G.time * 1.6) * 0.45;
  }
  return { x: Math.cos(ang)*m + Math.cos(ang+Math.PI/2)*strafe,
           y: Math.sin(ang)*m + Math.sin(ang+Math.PI/2)*strafe };
}

/* ★ 伏黑甚尔 AI：贴身压制，万里锁留人，天逆鉾封术式 */
function aiToji(ai, target, d, ang){
  const c = CFG.toji;

  /* 万里锁：中远距离先钩住，把敌人拽进自己的近战节奏 */
  if (ai.cd.chain <= 0 && ai.ce >= c.chainCost && d > 120 && d < c.chainRange) tojiChain(ai, target);

  /* 天逆鉾：优先在敌人准备开领域 / 术式未被封时封印他 */
  if (ai.cd.heaven <= 0 && ai.ce >= c.heavenCost && d < 640 &&
      (target.skillLock <= 0 || target.domain || d < 340)) tojiHeavenSpear(ai, target);

  /* 蝇头：撒出一群小虫子骚扰、挡刀 */
  if (ai.cd.fly <= 0 && ai.ce >= c.flyCost && d > 90) tojiFlyHead(ai);

  /* 体术：进入拳脚范围就出手 */
  if (ai.attackCd <= 0 && d < ai.r + target.r + c.atkRange + 16) basicAttack(ai, target);

  /* 走位：被钩住就猛压，否则贴身缠斗 */
  let m, strafe;
  if (target.stun > 0){ m = 1; strafe = 0; }
  else if (d > 220){ m = 1; strafe = Math.sin(G.time*3.0)*0.2; }
  else if (d < 44){ m = -0.15; strafe = Math.sin(G.time*2.4)*0.5; }
  else { m = 0.1; strafe = Math.sin(G.time*2.4)*0.55; }

  return { x: Math.cos(ang)*m + Math.cos(ang+Math.PI/2)*strafe,
           y: Math.sin(ang)*m + Math.sin(ang+Math.PI/2)*strafe };
}

/* ★ 被审判封印术式时的 AI 行为：只能走位 + 普攻 */
function aiMoveOnly(ai, target, d, ang){
  const c = CFG[ai.type];
  const melee = isMeleeType(ai.type);
  const range = melee ? (ai.r + target.r + c.atkRange + 16) : 520;
  if (ai.attackCd <= 0 && d < range) basicAttack(ai, target);

  let m;
  if (melee) m = d > 60 ? 1 : (d < 34 ? -0.2 : 0.05);
  else m = d > 420 ? 0.9 : (d < 200 ? -0.7 : 0.1);
  const strafe = Math.sin(G.time * 2.0) * 0.35;
  return { x: Math.cos(ang)*m + Math.cos(ang+Math.PI/2)*strafe,
           y: Math.sin(ang)*m + Math.sin(ang+Math.PI/2)*strafe };
}

/* ══════════════════════════════════════════
   伏黑甚尔术式（天与咒缚 · 咒具）
   ══════════════════════════════════════════ */
/* ★ 天逆鉾：白色弧形闪光，命中后目标 5 秒无法使用术式与领域 */
function tojiHeavenSpear(t, target){
  if (!t || !t.alive || t.stun > 0) return;
  const c = CFG.toji;
  if (t.cd.heaven > 0 || t.ce < c.heavenCost) return;
  const aim = acquireAim(t, target);
  if (!aim) return;
  const ang = Math.atan2(aim.y - t.y, aim.x - t.x);
  if (!finite(ang)) return;

  t.ce -= c.heavenCost;
  t.cd.heaven = c.heavenCd;
  t.facing = ang;
  projectiles.push({
    type:'heaven', owner:t,
    x: t.x + Math.cos(ang)*(t.r + 16), y: t.y + Math.sin(ang)*(t.r + 16),
    vx: Math.cos(ang)*c.heavenSpeed, vy: Math.sin(ang)*c.heavenSpeed,
    r: 24, life: 0.9, damage: c.heavenDmg, rot: ang, color:'#ffffff',
    pierce: false, hitCd: 0, age: 0, seal: c.heavenSeal,
  });
  addEffect({ type:'ring', x:t.x, y:t.y, t:0, life:0.35, r0:8, r1:58, color:'#ffffff', width:3 });
  addEffect({ type:'text', x:t.x, y:t.y-72, t:0, life:0.9, text:'天逆鉾', color:'#eef2f6', size:16 });
  G.shake = Math.max(G.shake, 8);
}

/* ★ 万里锁：锁链钩中敌人 → 拽向甚尔 + 3 秒眩晕 */
function tojiChain(t, target){
  if (!t || !t.alive || t.stun > 0) return;
  const c = CFG.toji;
  if (t.cd.chain > 0 || t.ce < c.chainCost) return;
  const aim = acquireAim(t, target);
  if (!aim) return;
  const ang = Math.atan2(aim.y - t.y, aim.x - t.x);
  if (!finite(ang)) return;

  t.ce -= c.chainCost;
  t.cd.chain = c.chainCd;
  t.facing = ang;
  projectiles.push({
    type:'chain', owner:t,
    x: t.x + Math.cos(ang)*(t.r + 12), y: t.y + Math.sin(ang)*(t.r + 12),
    vx: Math.cos(ang)*c.chainSpeed, vy: Math.sin(ang)*c.chainSpeed,
    r: 16, life: 1.5, damage: c.chainDmg, rot: ang, color:'#cdd5de',
    pierce: false, hitCd: 0, age: 0, stun: c.chainStun, pullDur: c.chainPull,
  });
  addEffect({ type:'text', x:t.x, y:t.y-72, t:0, life:0.9, text:'万里锁', color:'#dfe4ea', size:16 });
}

/* ★ 蝇头：与脱兔同类的小型召唤物（棕黄），每次 4 只、无上限、无攻击 */
function tojiFlyHead(t){
  if (!t || !t.alive || t.stun > 0) return;
  const c = CFG.toji;
  if (t.cd.fly > 0 || t.ce < c.flyCost) return;
  t.ce -= c.flyCost;
  t.cd.fly = c.flyCd;

  const facing = finite(t.facing) ? t.facing : 0;
  /* ★ 朝敌方呈扇形扑出（挡在甚尔身前，替他吃远程弹幕） */
  for (let i = 0; i < c.flyCount; i++){
    const a = facing + (i - (c.flyCount - 1) / 2) * 0.45 + rnd(-0.12, 0.12);
    summons.push({
      type: 'flyhead',
      owner: t,
      x: t.x + Math.cos(a) * 52,
      y: t.y + Math.sin(a) * 52,
      r: 9,
      speed: c.flySpeed,
      life: c.flyDur, maxLife: c.flyDur,
      hp: c.flyHp, maxHp: c.flyHp,
      damage: 0,          /* 无攻击手段 */
      hitCd: 0, hitFlash: 0,
      attackInterval: 999,
      angle: a,
    });
  }
  addEffect({ type:'ring', x:t.x, y:t.y, t:0, life:0.4, r0:8, r1:70, color:'#d8a24a', width:3 });
  addEffect({ type:'text', x:t.x, y:t.y-58, t:0, life:0.9, text:'蝇头', color:'#e8c07a', size:18 });
}

/* ★ 拖拽结算：把目标沿直线拉向施法者（在双方位移之后调用） */
function applyPull(f, dt){
  if (!f || !f.alive || !f.pull) return;
  const p = f.pull;
  p.t += dt;
  const k = Math.min(1, p.t / p.dur);
  const e = k*k*(3 - 2*k);
  const s = p.src;
  if (s && s.alive){
    const a = Math.atan2(f.y - s.y, f.x - s.x);
    const stop = s.r + f.r + 6;
    p.tx = s.x + Math.cos(a)*stop;
    p.ty = s.y + Math.sin(a)*stop;
  }
  f.x = clamp(p.x0 + (p.tx - p.x0)*e, f.r, WORLD.w - f.r);
  f.y = clamp(p.y0 + (p.ty - p.y0)*e, f.r, WORLD.h - f.r);
  if (k >= 1) f.pull = null;
}

/* ══════════════════════════════════════════
   伤害
   ══════════════════════════════════════════ */
function damage(target, amount, silent){
  if (!target || !target.alive) return;
  let d = amount;
  if (target.type === 'gojo' && target.infinity) d *= (1 - CFG.gojo.infDR);
  /* ★ 天与咒缚：伏黑甚尔没有咒力，一切伤害对其效果降低 */
  if (target.type === 'toji') d *= (1 - CFG.toji.bodyDR);
  /* ★ 死刑：受到伤害 +50% */
  if (target.sentence > 0) d *= (1 + CFG.higuruma.sentenceAmp);
  /* ★ 诛伏赐死：领域内自身受到的伤害 -30% */
  if (target.type === 'higuruma' && inOwnHigurumaDomain(target)) d *= (1 - CFG.higuruma.domainDR);
  target.hp -= d;
  target.hitFlash = 0.14;

  const other = target === player ? enemy : player;
  if (target.domain && other && other.domain) target.clashDmg += d;

  if (!silent) addEffect({ type:'text', x:target.x+rnd(-14,14), y:target.y-42, t:0, life:0.7,
    text: Math.round(d), color:'#ffd76a', size:14 });

  if (target.hp <= 0){
    target.hp = 0;
    target.alive = false;
    addEffect({ type:'ring', x:target.x, y:target.y, t:0, life:1.0, r0:10, r1:260, color:'#ff5555', width:8 });
    G.shake = 30; G.flash = 0.7;
    if (target === player) endGame('lose');
    else endGame('win');
  }
  updateHUD();
}

/* ══════════════════════════════════════════
   式神受伤 / 适应
   ══════════════════════════════════════════ */
const ADAPT_LABELS = {
  blue:'苍', red:'赫', purple:'茈', melee:'打击', slash:'斩击',
  fire:'开', dismantle:'解', nue:'鵺', dog:'玉犬', space:'空间斩', domain:'领域', unknown:'攻击',
};

function damageSummon(s, amount, srcType, silent){
  if (!s || !finite(s.hp) || s.hp <= 0) return;
  let d = amount;
  const key = srcType || 'unknown';
  if (s.sentence > 0) d *= (1 + CFG.higuruma.sentenceAmp);   /* ★ 死刑标记 */

  /* ★ 魔虚罗：同一能力每命中一次，就对该能力多一层减伤 */
  if (s.type === 'mahoraga'){
    if (!s.adapt) s.adapt = {};
    const stacks = s.adapt[key] || 0;
    const c = CFG.sukunaTs;
    const dr = Math.min(c.mahoAdaptMax, stacks * c.mahoAdaptStep);
    d *= (1 - dr);
    s.adapt[key] = stacks + 1;
    if (stacks === 0){
      addEffect({ type:'text', x:s.x, y:s.y - s.r - 30, t:0, life:1.3,
        text:'适应 · ' + (ADAPT_LABELS[key] || '能力'), color:'#ffd76a', size:13 });
    }
  }

  s.hp -= d;
  s.hitFlash = 0.14;
  if (!silent) addEffect({ type:'text', x:s.x+rnd(-12,12), y:s.y-28, t:0, life:0.6,
    text: Math.round(d), color:'#ffd76a', size:12 });
  if (s.hp <= 0){ s.hp = 0; s.life = 0; }   /* 交由 updateSummons 移除 */
}

function endGame(result){
  G.state = result;
  setTimeout(() => {
    const t = document.getElementById('ov-title');
    const s = document.getElementById('ov-sub');
    if (!overlayEl || !t || !s) return;
    if (result === 'win'){
      t.textContent = '胜 利';
      t.style.color = '#eef2f6';
      s.textContent = '「天上天下，唯我独尊。」';
    } else {
      t.textContent = '败 北';
      t.style.color = '#ff6b6b';
      s.textContent = '「你还不够强。」';
    }
    overlayEl.classList.add('show');
  }, 700);
}

/* ══════════════════════════════════════════
   特效
   ══════════════════════════════════════════ */
function addEffect(e){ if (!e) return; e.t = e.t || 0; effects.push(e); }

function updateEffects(dt){
  for (let i = effects.length-1; i >= 0; i--){
    const e = effects[i];
    if (!e) { effects.splice(i,1); continue; }
    e.t += dt;
    if (e.type === 'spark'){
      e.x += (e.vx||0)*dt; e.y += (e.vy||0)*dt;
      e.vx = (e.vx||0) * 0.93; e.vy = (e.vy||0) * 0.93;
    }
    if (e.t >= e.life) effects.splice(i,1);
  }
}

/* ══════════════════════════════════════════
   主更新
   ══════════════════════════════════════════ */
function update(dt){
  G.shake *= Math.pow(0.02, dt);
  if (G.shake < 0.4) G.shake = 0;
  G.flash = Math.max(0, G.flash - dt*2.2);
  updateEffects(dt);

  /* ★ 开场对白：世界继续运转，但不结算战斗 */
  if (G.state === 'intro'){
    G.time += dt;
    updateIntro(dt);
    updateCamera();
    return;
  }

  if (G.state !== 'playing') return;
  if (!player || !enemy) return;
  G.time += dt;

  updatePlayer(dt);
  updateAI(dt);
  /* ★ 万里锁拖拽：在双方位移结算之后接管位置 */
  applyPull(player, dt);
  applyPull(enemy, dt);
  updateProjectiles(dt);
  updateSummons(dt);
  updateDomains(dt);
  updateCamera();
  updateHUD();
  updateButtons();
}

function updateCamera(){
  if (!player) return;
  /* ★ 开场对白期间：拉远镜头，把两人同时纳入取景 */
  const framing = !!(introTalk && enemy);
  if (framing){
    const needW = Math.abs(enemy.x - player.x) + 560;
    const needH = 560;
    scale = clamp(Math.min(W/needW, H/needH), 0.30, baseScale);
  } else {
    scale = baseScale;
  }
  const vw = W/scale, vh = H/scale;
  const cx = framing ? (player.x + enemy.x)/2 : player.x;
  const cy = framing ? (player.y + enemy.y)/2 : player.y;
  const tx = cx - vw/2;
  const ty = cy - vh/2;
  cam.x = WORLD.w > vw ? clamp(tx, 0, WORLD.w - vw) : (WORLD.w - vw)/2;
  cam.y = WORLD.h > vh ? clamp(ty, 0, WORLD.h - vh) : (WORLD.h - vh)/2;
}

function updatePlayer(dt){
  const p = player;
  if (!p.alive) return;
  const c = CFG[p.type];

  if (p.stun > 0) p.stun -= dt;
  if (p.hitFlash > 0) p.hitFlash -= dt;
  if (p.domainLock > 0) p.domainLock -= dt;
  if (p.skillLock > 0) p.skillLock -= dt;
  if (p.sentence > 0) p.sentence -= dt;
  if (p.blueSlow > 0) p.blueSlow -= dt;
  for (const k in p.cd) if (p.cd[k] > 0) p.cd[k] = Math.max(0, p.cd[k] - dt);
  if (p.attackCd > 0) p.attackCd -= dt;

  tickBrainBleed(p, dt);
  if (!p.alive) return;

  let mx = 0, my = 0;
  if (keys['w'] || keys['arrowup'])    my -= 1;
  if (keys['s'] || keys['arrowdown'])  my += 1;
  if (keys['a'] || keys['arrowleft'])  mx -= 1;
  if (keys['d'] || keys['arrowright']) mx += 1;
  mx += joy.x; my += joy.y;
  const ml = Math.hypot(mx, my);
  if (ml > 1){ mx /= ml; my /= ml; }

  if (Math.abs(p.kbx) > 1 || Math.abs(p.kby) > 1){
    p.x = clamp(p.x + p.kbx*dt, p.r, WORLD.w - p.r);
    p.y = clamp(p.y + p.kby*dt, p.r, WORLD.h - p.r);
    const damp = Math.pow(0.0009, dt);
    p.kbx *= damp; p.kby *= damp;
    if (Math.abs(p.kbx) < 4) p.kbx = 0;
    if (Math.abs(p.kby) < 4) p.kby = 0;
  }

  if (p.stun <= 0){
    const spd = moveSpeed(p);
    p.x = clamp(p.x + mx*spd*dt, p.r, WORLD.w - p.r);
    p.y = clamp(p.y + my*spd*dt, p.r, WORLD.h - p.r);
  }

  if (enemy.alive) p.facing = Math.atan2(enemy.y-p.y, enemy.x-p.x);

  /* 审判期间一切术式失效（含无下限 / 苍拳） */
  if (p.skillLock > 0){ p.infinity = false; p.blueFist = false; }

  if (p.type === 'gojo' && p.infinity){
    p.ce -= c.infDrain*dt;
    if (p.ce <= 0){ p.ce = 0; p.infinity = false; }
  }

  p.ce = Math.min(p.maxCe, p.ce + c.ceRegen*dt);

  /* ★ 长按「苍」蓄力：把刚发射的苍升级为吸附型引力球 */
  if (p.type === 'gojo') tickBlueCharge(p, dt);

  if (keys['j'] || holdAttack) basicAttack(p, enemy);
}

function updateAI(dt){
  const ai = enemy, target = player;
  if (!ai || !ai.alive) return;
  const c = CFG[ai.type];

  if (ai.hitFlash > 0) ai.hitFlash -= dt;
  if (ai.domainLock > 0) ai.domainLock -= dt;
  if (ai.skillLock > 0) ai.skillLock -= dt;
  if (ai.sentence > 0) ai.sentence -= dt;
  if (ai.blueSlow > 0) ai.blueSlow -= dt;
  for (const k in ai.cd) if (ai.cd[k] > 0) ai.cd[k] = Math.max(0, ai.cd[k] - dt);
  if (ai.attackCd > 0) ai.attackCd -= dt;
  ai.ce = Math.min(ai.maxCe, ai.ce + c.ceRegen*dt);

  tickBrainBleed(ai, dt);
  if (!ai.alive) return;

  if (Math.abs(ai.kbx) > 1 || Math.abs(ai.kby) > 1){
    ai.x = clamp(ai.x + ai.kbx*dt, ai.r, WORLD.w - ai.r);
    ai.y = clamp(ai.y + ai.kby*dt, ai.r, WORLD.h - ai.r);
    const damp = Math.pow(0.0009, dt);
    ai.kbx *= damp; ai.kby *= damp;
    if (Math.abs(ai.kbx) < 4) ai.kbx = 0;
    if (Math.abs(ai.kby) < 4) ai.kby = 0;
  }

  if (ai.stun > 0){ ai.stun -= dt; return; }
  if (!target || !target.alive) return;

  const d = dist(ai, target);
  const ang = Math.atan2(target.y-ai.y, target.x-ai.x);
  if (finite(ang)) ai.facing = ang;

  /* ★ 审判：术式被禁止时只能走位 + 普攻 */
  const sealed = ai.skillLock > 0;

  let mv = { x: 0, y: 0 };
  if (sealed){
    ai.infinity = false;
    ai.blueFist = false;
    mv = aiMoveOnly(ai, target, d, ang);
  } else {
    /* ① 保命优先：大脑受损 / 残血时先修反转术式 */
    const lowHp = hasReverse(ai.type) && ai.hp < ai.maxHp * c.reverseThreshold;
    if ((ai.brainDamaged || lowHp) && ai.cd.reverse <= 0 && ai.ce >= c.reverseCost) castReverse(ai);

    /* ② 玩家展开领域 → 立刻同步展开对冲 */
    if (c.domainName && player.domain && !enemy.domain && enemy.domainLock <= 0 && enemy.ce >= c.domainCost && !enemy.brainDamaged){
      enemy.cd.domain = 0;
      castDomain(enemy, player);
      addEffect({ type:'text', x:enemy.x, y:enemy.y-118, t:0, life:1.8,
        text: enemy.name + ' 同步展开领域！', color:'#ffb0b0', size:16 });
    }

    /* ③ 角色专属决策（各自发挥优势） */
    if (ai.type === 'gojo') mv = aiGojo(ai, target, d, ang);
    else if (ai.type === 'sukuna') mv = aiSukuna(ai, target, d, ang);
    else if (ai.type === 'higuruma') mv = aiHiguruma(ai, target, d, ang);
    else if (ai.type === 'toji') mv = aiToji(ai, target, d, ang);
    else mv = aiSukunaTs(ai, target, d, ang);
  }

  /* ④ 叠加闪避：躲开直射向自己的飞行道具 */
  const dodgeAng = aiDodge(ai, dt);
  if (dodgeAng !== null){
    mv.x = mv.x * 0.3 + Math.cos(dodgeAng);
    mv.y = mv.y * 0.3 + Math.sin(dodgeAng);
  }

  const kbFactor = (Math.abs(ai.kbx) + Math.abs(ai.kby)) > 80 ? 0.15 : 1;
  const len = Math.hypot(mv.x, mv.y);
  if (len > 0.01){
    const nx = mv.x/len, ny = mv.y/len;
    const spd = moveSpeed(ai);
    ai.x = clamp(ai.x + nx*spd*dt*kbFactor, ai.r, WORLD.w - ai.r);
    ai.y = clamp(ai.y + ny*spd*dt*kbFactor, ai.r, WORLD.h - ai.r);
  }
}

/* 闪避检测：返回垂直于威胁投射物的方向；无威胁返回 null */
function aiDodge(ai, dt){
  let threat = null, bestD = 1e9;
  for (const pr of projectiles){
    if (!pr || pr.owner === ai) continue;
    if (pr.type === 'blue') continue;              /* 苍是吸附效果，闪避无意义 */
    const vx = pr.vx || 0, vy = pr.vy || 0;
    const sp = Math.hypot(vx, vy);
    if (sp < 1) continue;
    const dir = Math.atan2(vy, vx);
    const toAi = Math.atan2(ai.y - pr.y, ai.x - pr.x);
    let diff = toAi - dir;
    while (diff > Math.PI) diff -= TAU;
    while (diff < -Math.PI) diff += TAU;
    const dd = dist(pr, ai);
    if (Math.abs(diff) < 0.30 && dd < 380 && dd < bestD){ threat = pr; bestD = dd; }
  }
  if (!threat) return null;
  const dir = Math.atan2(threat.vy || 0, threat.vx || 0);
  return dir + (Math.random() < 0.5 ? Math.PI/2 : -Math.PI/2);
}

/* ★ 五条悟：中远距离压制 · 苍→赫→茈连招 · 无下限防守 · 抓僵直贴身爆发 */
function aiGojo(ai, target, d, ang){
  const c = CFG.gojo;

  /* 机会窗口：玩家被僵直（如无量空处）时立刻贴身爆发，而不是继续拉开距离 */
  const punish = target.stun > 0;

  /* 无下限：咒力充裕且处在威胁距离时开启（带迟滞，避免来回开关） */
  if (!ai.infinity && ai.ce > 58 && d < 470) ai.infinity = true;
  else if (ai.infinity && (ai.ce < 26 || d > 600)) ai.infinity = false;

  /* 破脑：领域在CD且自身安全时重置，换取连续领域压制 */
  if (!ai.brainDamaged && ai.cd.domain > 5 && ai.hp > ai.maxHp * 0.8 &&
      ai.ce < 30 && d < 420 && Math.random() < 0.02) brainBreak(ai);

  /* 领域：玩家残血 / 身处范围内 / 已被僵直 → 直接展开扩大优势 */
  if (ai.cd.domain <= 0 && ai.ce >= c.domainCost && !ai.domain && !player.domain &&
      !ai.brainDamaged && (target.hp < target.maxHp*0.55 || d < 285 || punish))
    castDomain(ai, target);

  /* 连招：苍（吸附）→ 赫（击退）→ 茈（终结） */
  if (ai.blueUsed && ai.redUsed && ai.cd.purple <= 0 && ai.ce >= c.purpleCost && d < 560)
    gojoPurple(ai, target);

  /* 僵直贴脸时不用「赫」，避免把到手的猎物击飞出近身范围 */
  const avoidRed = punish && d < 220;
  if (!avoidRed && !ai.redUsed && ai.cd.red <= 0 && ai.ce >= c.redCost + 14 && d < 470 && Math.random() < 0.7)
    gojoRed(ai, target);

  /* 苍：把玩家吸进拳头范围（僵直时更积极） */
  if (!ai.blueUsed && ai.cd.blue <= 0 && ai.ce >= c.blueCost + 14 &&
      (punish ? d > 60 : d > 130) && Math.random() < (punish ? 0.9 : 0.7))
    gojoBlue(ai, target);

  /* 苍拳：僵直时咒力够就开，并全力贴身输出 */
  ai.blueFist = punish ? ai.ce > 26 : ai.ce > ai.maxCe * 0.6;
  if (ai.attackCd <= 0 && d < ai.r + target.r + c.atkRange + (punish ? 24 : 18))
    basicAttack(ai, target);

  /* 走位：平时维持 240~400 中距离；玩家僵直时冲上去贴脸追击 */
  let m, strafe;
  if (punish){
    m = d > 72 ? 1 : (d < 48 ? -0.2 : 0.05);
    strafe = Math.sin(G.time * 2.6) * 0.18;
  } else {
    m = d > 400 ? 1 : (d < 240 ? -0.9 : 0.12);
    strafe = Math.sin(G.time * 1.7) * 0.5;
  }
  return { x: Math.cos(ang)*m + Math.cos(ang+Math.PI/2)*strafe,
           y: Math.sin(ang)*m + Math.sin(ang+Math.PI/2)*strafe };
}

/* ★ 两面宿傩：贴身连斩 · 斩击压制 · 解/开 收尾 */
function aiSukuna(ai, target, d, ang){
  const c = CFG.sukuna;

  /* 斩击：主要输出手段，频率高 */
  if (ai.attackCd <= 0 && d < 580){
    ai.attackCd = rnd(0.26, 0.40);
    const aim = acquireAim(ai, target);
    const sAng = Math.atan2(aim.y-ai.y, aim.x-ai.x);
    spawnSlash(ai, sAng, rnd(-0.13, 0.13), '#ff6b8a');
  }
  if (ai.cd.dismantle <= 0 && ai.ce >= c.dismantleCost && d < 640 && Math.random() < 0.65)
    sukunaDismantle(ai, target);
  if (ai.cd.fire <= 0 && ai.ce >= c.fireCost && d < 440 && d > 110 && Math.random() < 0.7)
    sukunaFire(ai, target);

  if (ai.cd.domain <= 0 && ai.ce >= c.domainCost && !ai.domain && !player.domain &&
      (d < 400 || target.hp < target.maxHp*0.55)) castDomain(ai, target);

  /* 走位：压近到 95~175，偶尔后撤重置节奏 */
  let m = 0;
  if (d > 175) m = 1;
  else if (d < 95) m = -0.3;
  else m = 0.2;
  const strafe = Math.sin(G.time*2.4 + 1.1) * 0.6;
  return { x: Math.cos(ang)*m + Math.cos(ang+Math.PI/2)*strafe,
           y: Math.sin(ang)*m + Math.sin(ang+Math.PI/2)*strafe };
}

/* ★ 十影宿傩：式神军团消耗战 · 后排输出 · 空间斩斩杀 */
function aiSukunaTs(ai, target, d, ang){
  const c = CFG.sukunaTs;

  let myMaho = 0, myDog = 0;
  for (const s of summons){
    if (!s || s.owner !== ai) continue;
    if (s.type === 'mahoraga') myMaho++;
    else if (s.type === 'dog') myDog++;
  }
  const hurt = ai.hp < ai.maxHp * 0.75;

  /* 先手召唤魔虚罗：既是肉盾，也是解锁空间斩的钥匙 */
  if (myMaho === 0 && ai.cd.maho <= 0 && ai.ce >= c.mahoCost &&
      (hurt || d < 460 || target.hp < target.maxHp*0.85)) tsMahoraga(ai);
  if (myDog < 2 && ai.cd.dog <= 0 && ai.ce >= c.dogCost && d < 560) tsDog(ai);
  if (ai.cd.tobi <= 0 && ai.ce >= c.tobiCost && d < 620 && Math.random() < 0.5) tsTobi(ai);
  if (ai.cd.nue <= 0 && ai.ce >= c.nueCost && d < 640 && Math.random() < 0.7) tsNue(ai, target);

  /* 空间斩：解锁后的主要斩杀手段 */
  if (ai.spaceUnlocked && ai.cd.space <= 0 && ai.ce >= c.spaceCost && d < 640 &&
      (target.hp < target.maxHp*0.7 || Math.random() < 0.45)) tsSpaceSlash(ai, target);

  if (ai.attackCd <= 0 && d < 540){
    ai.attackCd = rnd(0.30, 0.44);
    const aim = acquireAim(ai, target);
    const sAng = Math.atan2(aim.y-ai.y, aim.x-ai.x);
    spawnSlash(ai, sAng, rnd(-0.13, 0.13), '#c9a4ff');
  }

  if (ai.cd.domain <= 0 && ai.ce >= c.domainCost && !ai.domain && !player.domain && d < 440)
    castDomain(ai, target);

  /* 走位：让式神顶在前面，自己保持 280~470 的输出距离 */
  let m = 0;
  if (d < 280) m = -0.9;
  else if (d > 470) m = 0.55;
  else m = 0.1;
  const strafe = Math.sin(G.time*1.25 + 0.6) * 0.8;
  return { x: Math.cos(ang)*m + Math.cos(ang+Math.PI/2)*strafe,
           y: Math.sin(ang)*m + Math.sin(ang+Math.PI/2)*strafe };
}

/* ══════════════════════════════════════════
   投射物
   ══════════════════════════════════════════ */
/* ══════════════════════════════════════════
   通用工具：斩击 / 颜色 / 火花
   ══════════════════════════════════════════ */
function spawnSlash(owner, ang, spread, color){
  const c = CFG[owner.type];
  projectiles.push({
    type:'slash', owner,
    x:owner.x+Math.cos(ang)*30, y:owner.y+Math.sin(ang)*30,
    vx:Math.cos(ang+spread)*c.slashSpeed, vy:Math.sin(ang+spread)*c.slashSpeed,
    r:14, life:1.2, damage:c.slashDmg, rot:ang, color,
  });
}

function projColor(pr){
  return pr.color || (pr.type==='red' ? '#ff5a5a'
    : pr.type==='purple' ? '#c07bff'
    : pr.type==='fire' ? '#ff9a3d'
    : pr.type==='dismantle' ? '#c07bff' : '#ff6b8a');
}

function spawnBurst(x, y, color, n, spdMin, spdMax, sizeMin, sizeMax){
  for (let k=0;k<n;k++){
    addEffect({ type:'spark', x, y, t:0, life:rnd(.2,.5),
      vx:Math.cos(rnd(0,TAU))*rnd(spdMin,spdMax),
      vy:Math.sin(rnd(0,TAU))*rnd(spdMin,spdMax),
      color, size:rnd(sizeMin,sizeMax) });
  }
}

/* 命中敌方式神则返回该式神（飞行道具会被式神挡下） */
function projectileHitsSummon(pr){
  const foe = pr.owner === player ? enemy : player;
  if (!foe) return null;
  for (const s of summons){
    if (!s || s.owner !== foe) continue;
    if (!finite(s.x) || !finite(s.y) || s.hp <= 0) continue;
    if (dist(pr, s) < pr.r + s.r) return s;
  }
  return null;
}

function updateProjectiles(dt){
  for (let i = projectiles.length-1; i >= 0; i--){
    const pr = projectiles[i];
    if (!pr || pr.dead){ projectiles.splice(i,1); continue; }
    pr.age = (pr.age || 0) + dt;
    pr.life -= dt;

    const owner = pr.owner;
    const target = owner === player ? enemy : player;

    /* 苍 */
    if (pr.type === 'blue'){
      const gc = CFG.gojo;
      if (pr.charged){
        /* ★ 吸附型苍：急停滞空，化作引力球 */
        const drag = Math.pow(0.004, dt);
        pr.vx *= drag; pr.vy *= drag;
        if (Math.random() < 0.55){
          const sa = rnd(0, TAU), sr = rnd(26, 96);
          addEffect({ type:'spark', x:pr.x + Math.cos(sa)*sr, y:pr.y + Math.sin(sa)*sr, t:0, life:0.34,
            vx:-Math.cos(sa)*rnd(80,220), vy:-Math.sin(sa)*rnd(80,220), color:'#8fd4ff', size:3 });
        }
      } else if (pr.age > 0.42){
        const drag = Math.pow(0.06, dt);
        pr.vx *= drag; pr.vy *= drag;
      }
      pr.x += pr.vx*dt;
      pr.y += pr.vy*dt;

      /* ★ 引力中心：普通苍拉向施法者，吸附型苍拉向球体本身 */
      const anchor = pr.charged ? pr : owner;
      if (owner && owner.alive && target && target.alive){
        const R = pr.charged ? gc.blueChargedR : 400;
        const dd = Math.hypot(anchor.x - target.x, anchor.y - target.y);
        if (dd < R && dd > 1){
          const a = Math.atan2(anchor.y - target.y, anchor.x - target.x);
          const strength = (1 - dd/R) * (pr.charged ? gc.blueChargedPull : 1300);
          target.x = clamp(target.x + Math.cos(a)*strength*dt, target.r, WORLD.w - target.r);
          target.y = clamp(target.y + Math.sin(a)*strength*dt, target.r, WORLD.h - target.r);
        }
        /* ★ 吸附型苍：持续减速 */
        if (pr.charged){ target.blueSlow = 0.3; target.blueSlowMul = 1 - gc.blueChargedSlow; }
      }
      /* ★ 引力球同样拖拽敌方式神 */
      if (pr.charged && owner){
        for (const s of summons){
          if (!s || s.owner === owner) continue;
          if (!finite(s.x) || !finite(s.y) || s.hp <= 0) continue;
          const dd = dist(pr, s);
          if (dd >= gc.blueChargedR || dd <= 1) continue;
          const a = Math.atan2(pr.y - s.y, pr.x - s.x);
          const strength = (1 - dd/gc.blueChargedR) * gc.blueChargedPull;
          s.x = clamp(s.x + Math.cos(a)*strength*dt, s.r, WORLD.w - s.r);
          s.y = clamp(s.y + Math.sin(a)*strength*dt, s.r, WORLD.h - s.r);
        }
      }
      const blueSummon = projectileHitsSummon(pr);
      if (blueSummon){
        pr.hitCd = (pr.hitCd || 0) - dt;
        if (pr.hitCd <= 0){ pr.hitCd = 0.45; damageSummon(blueSummon, pr.damage, pr.type); }
      }
      if (target && target.alive && Math.hypot(pr.x - target.x, pr.y - target.y) < pr.r + target.r + 6){
        pr.hitCd = (pr.hitCd || 0) - dt;
        if (pr.hitCd <= 0){ pr.hitCd = 0.45; damage(target, pr.damage); }
      }
      if (pr.life <= 0){
        addEffect({ type:'ring', x:pr.x, y:pr.y, t:0, life:pr.charged?0.55:0.35,
          r0:6, r1: pr.charged ? 170 : 60, color:'#5ab8ff', width: pr.charged ? 7 : 3 });
        if (pr.charged) spawnBurst(pr.x, pr.y, '#8fd4ff', 14, 90, 340, 2, 5);
        projectiles.splice(i,1);
      }
      continue;
    }

    /* 鵺：追踪 */
    if (pr.type === 'nue'){
      if (target && target.alive){
        const wantAng = Math.atan2(target.y - pr.y, target.x - pr.x);
        const curAng = Math.atan2(pr.vy, pr.vx);
        let diff = wantAng - curAng;
        if (diff > Math.PI) diff -= TAU;
        if (diff < -Math.PI) diff += TAU;
        const speed = Math.hypot(pr.vx, pr.vy) || 480;
        const newAng = curAng + clamp(diff, -(pr.turnRate||6)*dt, (pr.turnRate||6)*dt);
        pr.vx = Math.cos(newAng) * speed;
        pr.vy = Math.sin(newAng) * speed;
      }
      pr.x += pr.vx*dt;
      pr.y += pr.vy*dt;

      if (Math.random() < 0.85){
        addEffect({ type:'spark', x:pr.x, y:pr.y, t:0, life:0.28,
          vx:rnd(-50,50), vy:rnd(-50,50), color:'#c9a4ff', size:3 });
      }
      if (pr.life <= 0 || pr.x < -200 || pr.x > WORLD.w+200 || pr.y < -200 || pr.y > WORLD.h+200){
        projectiles.splice(i,1);
        continue;
      }
      const nueSummon = projectileHitsSummon(pr);
      if (nueSummon){
        damageSummon(nueSummon, pr.damage, pr.type);
        addEffect({ type:'ring', x:pr.x, y:pr.y, t:0, life:0.5, r0:8, r1:110, color:'#c9a4ff', width:5 });
        spawnBurst(pr.x, pr.y, '#d0aaff', 12, 80, 340, 2, 5);
        projectiles.splice(i,1);
        continue;
      }
      if (target && target.alive && dist(pr, target) < pr.r + target.r){
        damage(target, pr.damage);
        addEffect({ type:'ring', x:pr.x, y:pr.y, t:0, life:0.5, r0:8, r1:110, color:'#c9a4ff', width:5 });
        spawnBurst(pr.x, pr.y, '#d0aaff', 12, 80, 340, 2, 5);
        projectiles.splice(i,1);
        continue;
      }
      continue;
    }

    /* ★ 赫 被吸附型苍牵引（飞向球体） */
    if (pr.type === 'red' && pr.homingBlue){
      const orb = pr.homingBlue;
      if (orb.dead || projectiles.indexOf(orb) < 0){
        pr.homingBlue = null;
      } else {
        const wantAng = Math.atan2(orb.y - pr.y, orb.x - pr.x);
        const curAng = Math.atan2(pr.vy, pr.vx);
        let diff = wantAng - curAng;
        if (diff > Math.PI) diff -= TAU;
        if (diff < -Math.PI) diff += TAU;
        const spd = Math.max(Math.hypot(pr.vx, pr.vy), 780);
        const na = curAng + clamp(diff, -9*dt, 9*dt);
        pr.vx = Math.cos(na)*spd;
        pr.vy = Math.sin(na)*spd;
      }
    }

    /* 其他直线飞行 */
    pr.x += pr.vx*dt;
    pr.y += pr.vy*dt;
    pr.rot = (pr.rot||0) + dt*8;

    /* ★ 赫撞上吸附型苍 → 大范围「茈」爆炸 */
    if (pr.type === 'red' && pr.homingBlue && !pr.homingBlue.dead &&
        projectiles.indexOf(pr.homingBlue) >= 0 &&
        dist(pr, pr.homingBlue) < pr.r + pr.homingBlue.r + 12){
      const orb = pr.homingBlue;
      pr.dead = true; orb.dead = true;
      purpleBlast(pr.x, pr.y, pr.owner);
      continue;
    }

    if (Math.random() < 0.7){
      addEffect({ type:'spark', x:pr.x, y:pr.y, t:0, life:0.28,
        vx:rnd(-40,40), vy:rnd(-40,40), color:projColor(pr),
        size: pr.type==='purple'||pr.type==='dismantle' ? 5 : 3 });
    }

    if (pr.life <= 0 || pr.x < -200 || pr.x > WORLD.w+200 || pr.y < -200 || pr.y > WORLD.h+200){
      projectiles.splice(i,1);
      continue;
    }

    /* ★ 式神会替主人挡下飞行道具 */
    const smHit = projectileHitsSummon(pr);
    if (smHit){
      damageSummon(smHit, pr.damage, pr.type);
      const scol = projColor(pr);
      addEffect({ type:'ring', x:pr.x, y:pr.y, t:0, life:0.4,
        r0:6, r1: pr.r*2.2, color:scol, width:4 });
      spawnBurst(pr.x, pr.y, scol, 8, 60, 320, 2, 5);
      if (pr.type === 'space') G.shake = Math.max(G.shake, 20);
      if (!pr.pierce) projectiles.splice(i,1);
      continue;
    }

    if (target && target.alive && dist(pr, target) < pr.r + target.r){
      damage(target, pr.damage);
      const a = Math.atan2(target.y - pr.y, target.x - pr.x);

      /* ★ 天逆鉾：命中后 5 秒内无法使用术式与领域 */
      if (pr.type === 'heaven'){
        const seal = pr.seal || 5;
        target.skillLock = Math.max(target.skillLock || 0, seal);
        target.infinity = false;
        target.blueFist = false;
        addEffect({ type:'text', x:target.x, y:target.y-74, t:0, life:1.4,
          text:'天逆鉾 · 术式封印 ' + seal + 's', color:'#ffffff', size:16 });
        G.shake = Math.max(G.shake, 14);
      }

      /* ★ 万里锁：拽向施法者 + 眩晕（不产生击退，否则会被推开） */
      if (pr.type === 'chain'){
        const stun = pr.stun || 3;
        target.stun = Math.max(target.stun || 0, stun);
        const src = pr.owner;
        target.pull = {
          src, x0: target.x, y0: target.y,
          tx: src ? src.x : target.x, ty: src ? src.y : target.y,
          t: 0, dur: pr.pullDur || 0.55,
        };
        addEffect({ type:'text', x:target.x, y:target.y-74, t:0, life:1.4,
          text:'万里锁 · 拘束 ' + stun + 's', color:'#dfe4ea', size:16 });
        G.shake = Math.max(G.shake, 12);
      }

      if (pr.type === 'red'){
        target.kbx = Math.cos(a) * 3200;
        target.kby = Math.sin(a) * 3200;
        addEffect({ type:'text', x:target.x, y:target.y-70, t:0, life:1.0, text:'赫 · 击退！', color:'#ff6b3d', size:19 });
        for (let k=0;k<16;k++){
          addEffect({ type:'spark', x:target.x, y:target.y, t:0, life:rnd(.25,.6),
            vx:Math.cos(a+rnd(-0.6,0.6))*rnd(200,520),
            vy:Math.sin(a+rnd(-0.6,0.6))*rnd(200,520),
            color:'#ff7a4a', size:rnd(3,6) });
        }
        G.shake = Math.max(G.shake, 16);
      } else if (pr.type !== 'heaven' && pr.type !== 'chain'){
        const kb = pr.type==='purple' ? 60 : pr.type==='dismantle' ? 30 : 18;
        target.x = clamp(target.x + Math.cos(a)*kb, target.r, WORLD.w-target.r);
        target.y = clamp(target.y + Math.sin(a)*kb, target.r, WORLD.h-target.r);
      }

      const col = projColor(pr);
      addEffect({ type:'ring', x:pr.x, y:pr.y, t:0, life:0.4,
        r0:6, r1: pr.r*(pr.type==='purple'?3.4:2.2), color:col, width:4 });
      spawnBurst(pr.x, pr.y, col, 8, 60, 320, 2, 5);
      if (pr.type === 'purple' || pr.type === 'dismantle') G.shake = Math.max(G.shake, 18);
      if (pr.type === 'space'){
        G.shake = Math.max(G.shake, 26);
        addEffect({ type:'text', x:target.x, y:target.y-82, t:0, life:1.1, text:'空间斩！', color:'#fff0b0', size:20 });
      }
      if (!pr.pierce) projectiles.splice(i,1);
      continue;
    }
  }
}

/* ══════════════════════════════════════════
   式神 —— 重写为极简、安全版本
   ══════════════════════════════════════════ */
/* 无攻击手段的召唤物（纯肉盾 / 骚扰） */
const PASSIVE_SUMMONS = { tobi: true, flyhead: true };

function updateSummons(dt){
  for (let i = summons.length - 1; i >= 0; i--){
    const s = summons[i];
    if (!s || !finite(s.x) || !finite(s.y) || !finite(s.life)){
      summons.splice(i, 1);
      continue;
    }
    if (!finite(s.hp)){ s.hp = finite(s.maxHp) ? s.maxHp : 100; }
    if (!finite(s.maxHp) || s.maxHp <= 0) s.maxHp = Math.max(1, s.hp);
    if (s.hitFlash > 0) s.hitFlash -= dt;
    if (s.slashAnim > 0) s.slashAnim -= dt;
    if (s.stun > 0) s.stun -= dt;
    if (s.sentence > 0) s.sentence -= dt;

    if (!s.noExpire) s.life -= dt;

    /* 血量耗尽 / 持续时间结束 / 主人阵亡 → 消失 */
    if (s.hp <= 0 || (!s.noExpire && s.life <= 0) || !s.owner || !s.owner.alive){
      removeSummon(i, s);
      continue;
    }

    /* 僵直中的式神无法行动（但依然会挡下投射物） */
    if (s.stun > 0) continue;

    const target = s.owner === player ? enemy : player;
    if (!target || !target.alive) continue;
    if (!finite(target.x) || !finite(target.y)) continue;

    const ang = Math.atan2(target.y - s.y, target.x - s.x);
    if (!finite(ang)) continue;
    s.angle = ang;

    /* ★ 碰撞体积：贴到接触距离即停下，不与目标重叠 */
    const contact = s.r + target.r + 4;
    const d = dist(s, target);
    if (d > contact){
      const move = Math.min((s.speed || 200) * dt, d - contact);
      s.x += Math.cos(ang) * move;
      s.y += Math.sin(ang) * move;
    } else if (d > 0.001){
      const overlap = contact - d;
      s.x -= Math.cos(ang) * overlap * 0.6;
      s.y -= Math.sin(ang) * overlap * 0.6;
      /* 把目标顶开，形成实体碰撞手感 */
      target.x = clamp(target.x + Math.cos(ang) * overlap * 0.4, target.r, WORLD.w - target.r);
      target.y = clamp(target.y + Math.sin(ang) * overlap * 0.4, target.r, WORLD.h - target.r);
    }

    /* 式神之间互相排开 */
    for (const o of summons){
      if (o === s || !o || o.owner !== s.owner) continue;
      if (!finite(o.x) || !finite(o.y)) continue;
      const od = dist(s, o);
      const minD = (s.r + o.r) * 0.95;
      if (od > 0.001 && od < minD){
        const oa = Math.atan2(s.y - o.y, s.x - o.x);
        const push = (minD - od) * 0.5;
        s.x += Math.cos(oa) * push;
        s.y += Math.sin(oa) * push;
        o.x -= Math.cos(oa) * push * 0.5;
        o.y -= Math.sin(oa) * push * 0.5;
      }
    }

    /* 攻击：进入接触距离后按间隔出手（脱兔 / 蝇头无攻击手段） */
    if (!PASSIVE_SUMMONS[s.type] && dist(s, target) <= contact + Math.max(8, s.r * 0.35)){
      s.hitCd = (s.hitCd || 0) - dt;
      if (s.hitCd <= 0){
        s.hitCd = s.attackInterval || 0.5;
        const isMaho = s.type === 'mahoraga';
        const col = isMaho ? '#ffd76a' : '#ff8a3d';
        if (isMaho) s.slashAnim = 0.22;   /* 魔虚罗：砍击动作 */
        damage(target, s.damage || 20);

        addEffect({ type:'ring', x:target.x, y:target.y, t:0, life:0.3,
          r0:6, r1:(s.r||16)*2.2, color:col, width:3.5 });
        spawnBurst(target.x, target.y, col, isMaho ? 12 : 4, 80, 280, 2, 4);
      }
    }
  }
}

/* 移除式神，并处理魔虚罗陨落 → 空间斩解锁 */
function removeSummon(i, s){
  const killed = s.hp <= 0;
  if (finite(s.x) && finite(s.y)){
    if (s.type === 'mahoraga'){
      if (killed){
        addEffect({ type:'ring', x:s.x, y:s.y, t:0, life:1.1, r0:12, r1:340, color:'#ffffff', width:10 });
        addEffect({ type:'ring', x:s.x, y:s.y, t:0, life:0.9, r0:8, r1:190, color:'#ffd76a', width:6 });
        addEffect({ type:'text', x:s.x, y:s.y-72, t:0, life:1.8, text:'魔虚罗 · 陨落', color:'#ffd76a', size:20 });
        for (let k=0;k<24;k++){
          addEffect({ type:'spark', x:s.x, y:s.y, t:0, life:rnd(.4,.9),
            vx:Math.cos(rnd(0,TAU))*rnd(120,460), vy:Math.sin(rnd(0,TAU))*rnd(120,460),
            color:'#ffe9a8', size:rnd(2,5) });
        }
        G.shake = Math.max(G.shake, 22);
        G.flash = Math.max(G.flash, 0.35);
      } else {
        addEffect({ type:'ring', x:s.x, y:s.y, t:0, life:0.5, r0:6, r1:130, color:'#ffd76a', width:4 });
      }
    } else {
      addEffect({ type:'ring', x:s.x, y:s.y, t:0, life:0.4,
        r0:4, r1:(s.r||16)*2.4,
        color: s.type === 'tobi' ? '#dfe6f2' : (s.type === 'flyhead' ? '#d8a24a' : '#ff8a3d'),
        width:3 });
    }
  }

  /* 魔虚罗已召唤且已战死（血量耗尽）→ 解锁空间斩 */
  if (killed && s.type === 'mahoraga' && s.owner && s.owner.alive && !s.owner.spaceUnlocked){
    s.owner.mahoDied = true;
    s.owner.spaceUnlocked = true;
    addEffect({ type:'text', x:s.owner.x, y:s.owner.y-102, t:0, life:2.4,
      text:'空间斩 · 解锁（F）', color:'#fff0b0', size:18 });
    addEffect({ type:'ring', x:s.owner.x, y:s.owner.y, t:0, life:0.8, r0:10, r1:170, color:'#fff0b0', width:5 });
    G.flash = Math.max(G.flash, 0.25);
  }

  summons.splice(i, 1);
}

/* ══════════════════════════════════════════
   领域
   ══════════════════════════════════════════ */
function updateDomains(dt){
  for (const f of [player, enemy]){
    if (!f || !f.domain) continue;
    const d = f.domain;
    d.t += dt; d.life -= dt;
    const c = CFG[d.type];
    const openT = c.domainOpenTime;
    if (d.t < openT){
      d.r = d.baseR * (d.t / openT);
    } else {
      d.r = Math.min(d.maxR, d.baseR + (d.t - openT) * c.domainGrowRate);
    }
    if (d.life <= 0) f.domain = null;
  }

  const both = !!(player.domain && enemy.domain);
  G.clash = both;
  if (both){
    G.clashT += dt;
    if (Math.random() < 0.6){
      const A = player.domain, B = enemy.domain;
      const mx = (A.x + B.x)/2, my = (A.y + B.y)/2;
      addEffect({ type:'spark', x:mx+rnd(-160,160), y:my+rnd(-160,160), t:0, life:0.4,
        vx:rnd(-260,260), vy:rnd(-260,260),
        color: Math.random()<0.5 ? '#c07bff' : '#ff4a4a', size:4 });
    }
  } else {
    G.clashT = 0;
    if (player) player.clashDmg = 0;
    if (enemy) enemy.clashDmg = 0;
  }

  applyDomainEffect(player, enemy, dt);
  applyDomainEffect(enemy, player, dt);
  applyDomainToSummons(player, dt);
  applyDomainToSummons(enemy, dt);
  if (both){ checkDomainBreak(player); checkDomainBreak(enemy); }
}

/* ══════════════════════════════════════════
   ★ 伏魔御厨子 · 自动斩击特效
   随机角度的刀光，直接劈在角色身上
   两面宿傩：白 / 黄色刀光    十影宿傩：紫 / 灰色刀光
   ══════════════════════════════════════════ */
const DOMAIN_SLASH_STEP = 0.09;      /* 每隔多久劈出一刀（仅影响刀光频率，不改领域 DPS） */

function domainSlashPalette(type){
  if (type === 'sukunaTs') return { a:'#c07bff', b:'#9aa4b2' };   /* 紫 / 灰 */
  return { a:'#ffffff', b:'#ffd24a' };                            /* 白 / 黄 */
}

function spawnDomainSlash(type, x, y){
  const pal = domainSlashPalette(type);
  const n = Math.random() < 0.3 ? 2 : 1;       /* 偶尔来一记交叉斩 */
  for (let i = 0; i < n; i++){
    addEffect({
      type:'sword',
      /* ★ 刀光落在角色身上（只做极小抖动，不是散在周围） */
      x: x + rnd(-4,4), y: y + rnd(-4,4),
      t: 0, life: rnd(0.2, 0.28),
      ang: rnd(0, TAU),                         /* 随机角度 */
      len: rnd(74, 116),                        /* 刀光长度 */
      color: pal.a, color2: pal.b,
      width: rnd(5, 8),
    });
  }
}

function applyDomainEffect(owner, target, dt){
  if (!owner || !owner.domain || !target || !target.alive) return;
  const d = owner.domain;
  /* ★ 天与咒缚：伏黑甚尔没有咒力，领域「选不中」他 */
  const tc = CFG[target.type];
  if (tc && tc.heavenImmuneDomain) return;
  const inThis = dist(target, d) < d.r;
  const inOwn = target.domain && dist(target, target.domain) < target.domain.r;
  if (!inThis || inOwn) return;

  if (d.type === 'gojo'){
    target.stun = Math.max(target.stun, 2);
    if (!d.hitOpponent){
      d.hitOpponent = true;
      target.domainLock = 20;
      addEffect({ type:'text', x:target.x, y:target.y-70, t:0, life:1.6,
        text:'无量空处 · 2秒僵直 / 领域封印20秒', color:'#c9a4ff', size:15 });
      G.flash = 0.5;
    }
  } else if (d.type === 'higuruma'){
    /* 诛伏赐死：领域内敌人 10 秒内无法使用任何主动术式（含领域与反转术式） */
    target.skillLock = Math.max(target.skillLock || 0, CFG.higuruma.domainSeal);
    /* ★ 拘传：把敌人拽向法庭中央，防止远程角色在领域内放风筝 */
    const dd = dist(target, d);
    if (d.r > 10 && dd > 6){
      const strength = CFG.higuruma.domainPull * clamp(dd / d.r, 0.25, 1);
      const pa = Math.atan2(d.y - target.y, d.x - target.x);
      target.x = clamp(target.x + Math.cos(pa)*strength*dt, target.r, WORLD.w - target.r);
      target.y = clamp(target.y + Math.sin(pa)*strength*dt, target.r, WORLD.h - target.r);
    }
    if (!d.hitOpponent){
      d.hitOpponent = true;
      addEffect({ type:'text', x:target.x, y:target.y-70, t:0, life:1.8,
        text:'诛伏赐死 · 10 秒内术式禁止 · 拘传到庭', color:'#ffd76a', size:16 });
      G.flash = 0.5;
    }
  } else {
    /* 伏魔御厨子（含十影宿傩）：持续伤害 + 刀剑劈砍式自动斩击 */
    const c = CFG[d.type];
    const dps = (c && finite(c.domainDps)) ? c.domainDps : 34;
    damage(target, dps * dt, true);
    d.slashT = (d.slashT || 0) + dt;
    while (d.slashT >= DOMAIN_SLASH_STEP){
      d.slashT -= DOMAIN_SLASH_STEP;
      spawnDomainSlash(d.type, target.x, target.y);
    }
  }
}

/* 领域对式神生效：魔虚罗可受攻击/效果影响，并产生适应 */
function applyDomainToSummons(owner, dt){
  if (!owner || !owner.domain) return;
  const d = owner.domain;
  const c = CFG[d.type];
  if (d.type === 'higuruma') return;              /* 审判领域不作用于式神 */
  for (const s of summons){
    if (!s || s.owner === owner) continue;           // 只影响敌方式神
    if (!finite(s.x) || !finite(s.y) || s.hp <= 0) continue;
    const inThis = dist(s, d) < d.r;
    const inOwn = s.owner.domain && dist(s, s.owner.domain) < s.owner.domain.r;
    if (!inThis || inOwn) continue;

    if (d.type === 'gojo'){
      /* 无量空处：僵直式神（魔虚罗可适应，逐渐缩短僵直时间） */
      let stun = 2;
      if (s.type === 'mahoraga'){
        if (!s.adapt) s.adapt = {};
        const stacks = s.adapt['domain'] || 0;
        const c2 = CFG.sukunaTs;
        const dr = Math.min(c2.mahoAdaptMax, stacks * c2.mahoAdaptStep);
        stun *= (1 - dr);
        s.adapt['domain'] = stacks + 1;
      }
      s.stun = Math.max(s.stun || 0, stun);
    } else {
      /* 伏魔御厨子：持续灼烧式神（魔虚罗经 damageSummon 获得对领域的适应） */
      const dps = (c && finite(c.domainDps)) ? c.domainDps : 34;
      damageSummon(s, dps * dt, 'domain', true);
      d.slashT2 = (d.slashT2 || 0) + dt;
      while (d.slashT2 >= DOMAIN_SLASH_STEP){
        d.slashT2 -= DOMAIN_SLASH_STEP;
        spawnDomainSlash(d.type, s.x, s.y);
      }
    }
  }
}

function checkDomainBreak(f){
  if (f.clashDmg > CLASH_DMG_LIMIT){
    const c = CFG[f.type];
    const name = c.domainName || '领域';
    f.domain = null;
    f.stun = 1.5;
    f.cd.domain = 25;
    f.clashDmg = 0;
    addEffect({ type:'text', x:f.x, y:f.y-90, t:0, life:2.0, text:name + ' · 破碎！', color:'#ff5555', size:22 });
    addEffect({ type:'ring', x:f.x, y:f.y, t:0, life:0.9, r0:20, r1:400, color:'#ff5555', width:9 });
    for (let k=0;k<26;k++){
      addEffect({ type:'spark', x:f.x, y:f.y, t:0, life:rnd(.4,.9),
        vx:Math.cos(rnd(0,TAU))*rnd(150,520), vy:Math.sin(rnd(0,TAU))*rnd(150,520),
        color:'#ff7777', size:rnd(3,6) });
    }
    G.shake = 30; G.flash = 0.65;
  }
}

/* ══════════════════════════════════════════
   渲染
   ══════════════════════════════════════════ */
function render(){
  ctx.setTransform(DPR,0,0,DPR,0,0);
  ctx.fillStyle = '#121316';
  ctx.fillRect(0,0,W,H);

  if (G.state === 'menu' || G.state === 'select') return;
  if (!player || !enemy) return;

  let shx = 0, shy = 0;
  if (G.shake > 0.5){
    shx = rnd(-1,1)*G.shake;
    shy = rnd(-1,1)*G.shake;
  }

  ctx.save();
  ctx.translate(shx, shy);
  ctx.scale(scale, scale);
  ctx.translate(-cam.x, -cam.y);

  drawWorld();
  if (player.domain) drawDomain(player.domain);
  if (enemy.domain) drawDomain(enemy.domain);
  drawOverlapZone();
  drawSummons();
  drawProjectiles();
  if (enemy.alive) drawFighter(enemy);
  if (player.alive) drawFighter(player);
  drawEffects();

  ctx.restore();

  if (G.flash > 0.01){
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.55, G.flash*0.6)})`;
    ctx.fillRect(0,0,W,H);
  }

  const vg = ctx.createRadialGradient(W/2,H/2, Math.min(W,H)*0.35, W/2,H/2, Math.max(W,H)*0.78);
  vg.addColorStop(0,'rgba(0,0,0,0)');
  vg.addColorStop(1,'rgba(0,0,0,0.72)');
  ctx.fillStyle = vg;
  ctx.fillRect(0,0,W,H);

  drawDialogue(shx, shy);
  drawClashBanner();
}

function drawWorld(){
  /* ★ 深灰场地 */
  ctx.fillStyle = '#191b1f';
  ctx.fillRect(0,0,WORLD.w,WORLD.h);
  ctx.strokeStyle = 'rgba(190,196,206,0.08)';
  ctx.lineWidth = 1;
  const gs = 100;
  ctx.beginPath();
  for (let x = 0; x <= WORLD.w; x += gs){ ctx.moveTo(x,0); ctx.lineTo(x,WORLD.h); }
  for (let y = 0; y <= WORLD.h; y += gs){ ctx.moveTo(0,y); ctx.lineTo(WORLD.w,y); }
  ctx.stroke();
  ctx.save();
  ctx.translate(WORLD.w/2, WORLD.h/2);
  ctx.rotate(G.time*0.06);
  ctx.strokeStyle = 'rgba(210,215,225,0.10)';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0,0,300,0,TAU); ctx.stroke();
  ctx.beginPath(); ctx.arc(0,0,340,0,TAU); ctx.stroke();
  for (let i=0;i<8;i++){
    const a = i/8*TAU;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a)*300, Math.sin(a)*300);
    ctx.lineTo(Math.cos(a)*340, Math.sin(a)*340);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(205,210,220,0.35)';
  ctx.lineWidth = 4;
  ctx.strokeRect(0,0,WORLD.w,WORLD.h);
}

function drawDomain(d){
  const alpha = Math.min(1, d.life/0.8) * 0.55;
  if (d.type === 'gojo'){
    const g = ctx.createRadialGradient(d.x,d.y, d.r*0.1, d.x,d.y, d.r);
    g.addColorStop(0, `rgba(30,10,60,${alpha*0.9})`);
    g.addColorStop(0.55, `rgba(70,30,140,${alpha*0.7})`);
    g.addColorStop(1, `rgba(150,90,255,0)`);
    ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, TAU);
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = `rgba(190,140,255,${alpha*1.6})`;
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, TAU); ctx.stroke();
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(G.time*0.5);
    ctx.strokeStyle = `rgba(200,160,255,${alpha})`;
    ctx.lineWidth = 3;
    for (let i=0;i<5;i++){
      const rr = d.r*(0.28 + i*0.15);
      ctx.beginPath(); ctx.arc(0,0, rr, i*1.3, i*1.3 + 2.1); ctx.stroke();
    }
    ctx.fillStyle = `rgba(255,255,255,${alpha*0.9})`;
    for (let i=0;i<26;i++){
      const a = i*2.399 + G.time*0.35;
      const rr = d.r * ((i*0.137 + Math.sin(G.time*0.7+i)*0.05) % 1);
      ctx.beginPath(); ctx.arc(Math.cos(a)*rr, Math.sin(a)*rr, 1.8, 0, TAU); ctx.fill();
    }
    /* ★ 中央黑洞（无量空处）：事件视界 + 光子环 + 多层光环 + 吸积盘 */
    const bh = d.r * 0.22;
    const bhPulse = 1 + Math.sin(G.time * 2.2) * 0.05;

    /* 外层光晕 */
    const halo = ctx.createRadialGradient(0,0,bh*0.7, 0,0,bh*3.4);
    halo.addColorStop(0, `rgba(190,130,255,${alpha*0.5})`);
    halo.addColorStop(0.45, `rgba(120,70,220,${alpha*0.2})`);
    halo.addColorStop(1, 'rgba(80,40,180,0)');
    ctx.beginPath(); ctx.arc(0,0,bh*3.4,0,TAU); ctx.fillStyle = halo; ctx.fill();

    /* 事件视界 */
    const bg2 = ctx.createRadialGradient(0,0,bh*0.05, 0,0,bh);
    bg2.addColorStop(0, 'rgba(0,0,0,1)');
    bg2.addColorStop(0.7, 'rgba(0,0,0,0.96)');
    bg2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.beginPath(); ctx.arc(0,0,bh,0,TAU); ctx.fillStyle = bg2; ctx.fill();

    /* 极亮光子环 */
    ctx.strokeStyle = `rgba(255,252,255,${Math.min(1, alpha*1.3)})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0,0, bh*1.02*bhPulse, 0, TAU); ctx.stroke();

    /* 多层旋转光环 */
    const halos = [
      { r:0.55, w:3.0, c:'205,165,255', spd:1.6,  gap:2.4 },
      { r:0.78, w:2.2, c:'170,120,255', spd:-1.1, gap:1.9 },
      { r:1.30, w:3.0, c:'150,100,255', spd:0.75, gap:2.6 },
      { r:1.75, w:2.0, c:'215,175,255', spd:-0.55, gap:1.5 },
      { r:2.30, w:2.6, c:'135,85,235',  spd:0.4,  gap:1.1 },
    ];
    for (const h of halos){
      const rot = G.time * h.spd;
      ctx.strokeStyle = `rgba(${h.c},${alpha*0.9})`;
      ctx.lineWidth = h.w;
      ctx.beginPath(); ctx.arc(0,0, bh*h.r*bhPulse, rot, rot + h.gap); ctx.stroke();
      ctx.beginPath(); ctx.arc(0,0, bh*h.r*bhPulse, rot + Math.PI, rot + Math.PI + h.gap); ctx.stroke();
    }

    /* 吸积盘 */
    const discG = ctx.createLinearGradient(-bh*1.3, 0, bh*1.3, 0);
    discG.addColorStop(0, 'rgba(120,60,220,0)');
    discG.addColorStop(0.5, `rgba(235,210,255,${alpha})`);
    discG.addColorStop(1, 'rgba(120,60,220,0)');
    ctx.strokeStyle = discG;
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(0,0, bh*1.05, 0, TAU); ctx.stroke();

    /* 环绕粒子 */
    for (let i=0;i<10;i++){
      const ph = i * 2.399 + G.time * (0.7 + (i%3)*0.25);
      const rr = bh * (1.15 + (i%4)*0.32);
      ctx.beginPath();
      ctx.arc(Math.cos(ph)*rr, Math.sin(ph)*rr, 1.6, 0, TAU);
      ctx.fillStyle = `rgba(240,225,255,${alpha})`;
      ctx.fill();
    }
    ctx.restore();
  } else if (d.type === 'higuruma'){
    /* ★ 诛伏赐死：血色法庭 + 中央金色天平 */
    const gold = 'rgba(255,215,110,';
    const hg = ctx.createRadialGradient(d.x,d.y, d.r*0.08, d.x,d.y, d.r);
    hg.addColorStop(0, `rgba(70,6,10,${alpha*0.95})`);
    hg.addColorStop(0.5, `rgba(120,14,20,${alpha*0.7})`);
    hg.addColorStop(1, 'rgba(200,40,40,0)');
    ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, TAU);
    ctx.fillStyle = hg; ctx.fill();
    ctx.strokeStyle = gold + `${Math.min(0.95, alpha*1.7)})`;
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, TAU); ctx.stroke();

    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(G.time * 0.12);
    /* 席位刻度 */
    ctx.strokeStyle = gold + `${alpha*0.7})`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 16; i++){
      const a = i/16*TAU;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a)*d.r*0.78, Math.sin(a)*d.r*0.78);
      ctx.lineTo(Math.cos(a)*d.r*0.88, Math.sin(a)*d.r*0.88);
      ctx.stroke();
    }
    /* 旋转的「判」字环 */
    ctx.font = '900 22px system-ui,sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = gold + `${Math.min(0.9, alpha*1.6)})`;
    for (let i = 0; i < 4; i++){
      const a = i/4*TAU;
      ctx.fillText('判', Math.cos(a)*d.r*0.6, Math.sin(a)*d.r*0.6 + 8);
    }
    ctx.restore();

    /* 中央天平（尺寸设上限，避免 720 半径下过于巨大） */
    const S = Math.min(d.r * 0.26, 150);
    const sway = Math.sin(G.time * 1.6) * 0.10;
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.strokeStyle = gold + `${Math.min(0.95, alpha*1.8)})`;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, S*0.85); ctx.lineTo(0, -S*0.9); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-S*0.5, S*0.85); ctx.lineTo(S*0.5, S*0.85); ctx.stroke();
    ctx.save();
    ctx.rotate(sway);
    ctx.beginPath(); ctx.moveTo(-S, -S*0.7); ctx.lineTo(S, -S*0.7); ctx.stroke();
    ctx.lineWidth = 2.5;
    for (const sx of [-1, 1]){
      ctx.beginPath();
      ctx.moveTo(sx*S*0.92, -S*0.7);
      ctx.lineTo(sx*S*0.92, -S*0.15);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(sx*S*0.92, -S*0.1, S*0.22, 0, Math.PI);
      ctx.stroke();
    }
    ctx.restore();
    ctx.beginPath(); ctx.arc(0, -S*1.02, S*0.12, 0, TAU);
    ctx.fillStyle = `rgba(255,240,190,${Math.min(1, alpha*1.8)})`; ctx.fill();
    ctx.lineCap = 'butt';
    ctx.restore();

    /* 法庭栅栏光柱 */
    ctx.save();
    ctx.globalAlpha = Math.min(0.5, alpha);
    ctx.strokeStyle = 'rgba(255,190,120,0.28)';
    ctx.lineWidth = 6;
    const hoff = (G.time * 40) % 90;
    for (let x = -d.r; x <= d.r; x += 90){
      ctx.beginPath();
      ctx.moveTo(d.x + x + hoff, d.y - d.r*0.9);
      ctx.lineTo(d.x + x + hoff - 30, d.y + d.r*0.9);
      ctx.stroke();
    }
    ctx.restore();
  } else {
    /* 伏魔御厨子（含十影宿傩版本，颜色略暗） */
    const isTs = d.type === 'sukunaTs';
    const innerC = isTs ? `rgba(40,0,20,${alpha*0.9})` : `rgba(60,0,0,${alpha*0.9})`;
    const midC = isTs ? `rgba(90,20,60,${alpha*0.65})` : `rgba(130,15,15,${alpha*0.65})`;
    const outerC = isTs ? `rgba(180,40,90,0)` : `rgba(255,60,60,0)`;
    const lineC = isTs ? `rgba(200,90,150,${alpha*1.6})` : `rgba(255,70,70,${alpha*1.6})`;
    const g = ctx.createRadialGradient(d.x,d.y, d.r*0.1, d.x,d.y, d.r);
    g.addColorStop(0, innerC);
    g.addColorStop(0.55, midC);
    g.addColorStop(1, outerC);
    ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, TAU);
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = lineC;
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, TAU); ctx.stroke();

    /* ★ 中央鸟居（伏魔御厨子） */
    if (TORII_IMG && TORII_IMG.complete && TORII_IMG.naturalWidth){
      const th = Math.min(d.r * 0.85, 260);
      const tw = th * (TORII_IMG.naturalWidth / TORII_IMG.naturalHeight);
      ctx.save();
      ctx.globalAlpha = Math.min(1, d.life / 0.8) * 0.9;
      ctx.drawImage(TORII_IMG, d.x - tw/2, d.y - th, tw, th);
      ctx.restore();
    }

    const openT = CFG[d.type].domainOpenTime;
    const growRate = CFG[d.type].domainGrowRate;
    if (d.t > openT){
      const pulsePeriod = 0.9;
      const phase = (d.t - openT) % pulsePeriod;
      const k = phase / pulsePeriod;
      const pulseR = d.r - k * Math.min(180, d.r * 0.35);
      if (pulseR > 10){
        ctx.strokeStyle = isTs
          ? `rgba(200,110,180,${alpha * (1 - k) * 0.85})`
          : `rgba(255,120,120,${alpha * (1 - k) * 0.85})`;
        ctx.lineWidth = 3.5 * (1 - k * 0.5);
        ctx.beginPath(); ctx.arc(d.x, d.y, pulseR, 0, TAU); ctx.stroke();
      }
    }

    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(-G.time*0.35);
    ctx.strokeStyle = isTs ? `rgba(200,110,180,${alpha*1.1})` : `rgba(255,110,110,${alpha*1.1})`;
    ctx.lineWidth = 2;
    for (let i=0;i<18;i++){
      const a = i/18*TAU;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a)*d.r*0.12, Math.sin(a)*d.r*0.12);
      ctx.lineTo(Math.cos(a)*d.r*0.96, Math.sin(a)*d.r*0.96);
      ctx.stroke();
    }
    ctx.restore();

    if (d.t > openT && growRate > 0 && d.r < d.maxR){
      const n = 14;
      const rot = G.time * 0.6;
      ctx.strokeStyle = isTs ? `rgba(220,140,200,${alpha * 1.3})` : `rgba(255,160,160,${alpha * 1.3})`;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      for (let i=0;i<n;i++){
        const a = rot + i/n*TAU;
        ctx.beginPath();
        ctx.moveTo(d.x + Math.cos(a)*(d.r+6), d.y + Math.sin(a)*(d.r+6));
        ctx.lineTo(d.x + Math.cos(a)*(d.r+20), d.y + Math.sin(a)*(d.r+20));
        ctx.stroke();
      }
      ctx.lineCap = 'butt';
    }
  }
}

function drawOverlapZone(){
  if (!player.domain || !enemy.domain) return;
  const A = player.domain, B = enemy.domain;
  if (dist(A,B) >= A.r + B.r) return;
  ctx.save();
  ctx.beginPath(); ctx.arc(A.x, A.y, A.r, 0, TAU); ctx.clip();
  ctx.beginPath(); ctx.arc(B.x, B.y, B.r, 0, TAU); ctx.clip();
  ctx.fillStyle = 'rgba(230,240,255,0.075)';
  ctx.fillRect(0,0,WORLD.w,WORLD.h);
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 2;
  const off = (G.time*90) % 60;
  for (let y = -60; y < WORLD.h + 60; y += 60){
    ctx.beginPath();
    ctx.moveTo(0, y + off);
    ctx.lineTo(WORLD.w, y + off - 40);
    ctx.stroke();
  }
  ctx.restore();
}

/* ★ 式神绘制 —— 极简、安全，无 shadowBlur、无 ellipse */
function drawSummons(){
  for (const s of summons){
    if (!s || !finite(s.x) || !finite(s.y)) continue;

    if (s.type === 'dog'){
      ctx.save();
      ctx.translate(s.x, s.y);

      // 影子
      ctx.beginPath();
      ctx.arc(0, s.r * 0.7, s.r * 0.9, 0, TAU);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fill();

      // 身体
      ctx.beginPath();
      ctx.arc(0, 0, s.r, 0, TAU);
      const g = ctx.createRadialGradient(-s.r*0.3, -s.r*0.3, 1, 0, 0, s.r);
      g.addColorStop(0, '#4a2010');
      g.addColorStop(0.6, '#1a0800');
      g.addColorStop(1, '#080200');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,140,60,0.85)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 朝向尖角
      const angle = finite(s.angle) ? s.angle : 0;
      ctx.save();
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(s.r * 0.95, 0);
      ctx.lineTo(s.r * 0.4, -s.r * 0.4);
      ctx.lineTo(s.r * 0.4, s.r * 0.4);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255,140,60,0.75)';
      ctx.fill();
      // 眼睛
      ctx.fillStyle = '#ff8a3d';
      ctx.beginPath(); ctx.arc(s.r * 0.35, -s.r * 0.3, 2.5, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(s.r * 0.35,  s.r * 0.3, 2.5, 0, TAU); ctx.fill();
      ctx.restore();

      // ★ 血量条
      drawSummonBar(s, s.r + 16, '#ff8a3d');

      // 剩余时间环
      const ratio = clamp(s.life / s.maxLife, 0, 1);
      if (ratio > 0 && ratio <= 1){
        ctx.beginPath();
        ctx.arc(0, 0, s.r + 5, -Math.PI/2, -Math.PI/2 + TAU * ratio);
        ctx.strokeStyle = 'rgba(255,180,80,0.7)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.restore();
    }
    else if (s.type === 'tobi'){
      /* ★ 脱兔：白色小兔，无攻击 */
      ctx.save();
      ctx.translate(s.x, s.y);

      // 影子
      ctx.beginPath();
      ctx.arc(0, s.r * 0.8, s.r * 0.9, 0, TAU);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fill();

      // 耳朵
      const angle = finite(s.angle) ? s.angle : 0;
      ctx.save();
      ctx.rotate(angle);
      ctx.fillStyle = '#e8edf5';
      ctx.beginPath();
      ctx.moveTo(-s.r*0.15, -s.r*0.4); ctx.lineTo(-s.r*0.55, -s.r*1.35); ctx.lineTo(0, -s.r*0.75);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(s.r*0.15, -s.r*0.4); ctx.lineTo(s.r*0.55, -s.r*1.35); ctx.lineTo(0, -s.r*0.75);
      ctx.closePath(); ctx.fill();
      ctx.restore();

      // 身体
      ctx.beginPath();
      ctx.arc(0, 0, s.r, 0, TAU);
      const g = ctx.createRadialGradient(-s.r*0.3, -s.r*0.3, 1, 0, 0, s.r);
      g.addColorStop(0, '#f4f7fb');
      g.addColorStop(0.6, '#d9dfe9');
      g.addColorStop(1, '#aab2c0');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = s.hitFlash > 0 ? '#ff9a9a' : 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 眼睛
      ctx.save();
      ctx.rotate(angle);
      ctx.fillStyle = '#3a414d';
      ctx.beginPath(); ctx.arc(s.r*0.35, -s.r*0.25, 1.6, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(s.r*0.35,  s.r*0.25, 1.6, 0, TAU); ctx.fill();
      ctx.restore();

      drawSummonBar(s, s.r + 14, '#dfe6f2');

      const ratio = clamp(s.life / s.maxLife, 0, 1);
      if (ratio > 0 && ratio <= 1){
        ctx.beginPath();
        ctx.arc(0, 0, s.r + 4, -Math.PI/2, -Math.PI/2 + TAU * ratio);
        ctx.strokeStyle = 'rgba(220,226,236,0.6)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      ctx.restore();
    }
    else if (s.type === 'flyhead'){
      /* ★ 蝇头：棕黄色小飞虫，无攻击 */
      const angle = finite(s.angle) ? s.angle : 0;
      ctx.save();
      ctx.translate(s.x, s.y);

      // 影子
      ctx.beginPath();
      ctx.arc(0, s.r * 0.8, s.r * 0.85, 0, TAU);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fill();

      // 翅膀（半透明，高频扇动）
      ctx.save();
      ctx.rotate(angle);
      const flap = 0.55 + Math.sin(G.time * 22 + s.x * 0.05) * 0.35;
      ctx.fillStyle = 'rgba(255,240,200,0.42)';
      for (const sy of [-1, 1]){
        ctx.save();
        ctx.rotate(sy * flap * 0.6);
        ctx.beginPath();
        ctx.moveTo(0, sy * s.r * 0.2);
        ctx.lineTo(-s.r * 1.15, sy * s.r * 1.25);
        ctx.lineTo(s.r * 0.25, sy * s.r * 0.95);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();

      // 身体
      ctx.beginPath();
      ctx.arc(0, 0, s.r, 0, TAU);
      const g = ctx.createRadialGradient(-s.r*0.3, -s.r*0.3, 1, 0, 0, s.r);
      g.addColorStop(0, '#f0d191');
      g.addColorStop(0.55, '#c9973a');
      g.addColorStop(1, '#7a5518');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = s.hitFlash > 0 ? '#ff9a9a' : 'rgba(120,84,24,0.9)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 复眼
      ctx.save();
      ctx.rotate(angle);
      ctx.fillStyle = '#3a2a08';
      ctx.beginPath(); ctx.arc(s.r*0.4, -s.r*0.3, s.r*0.3, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(s.r*0.4,  s.r*0.3, s.r*0.3, 0, TAU); ctx.fill();
      ctx.restore();

      drawSummonBar(s, s.r + 13, '#d8a24a');

      const ratio = clamp(s.life / s.maxLife, 0, 1);
      if (ratio > 0 && ratio <= 1){
        ctx.beginPath();
        ctx.arc(0, 0, s.r + 4, -Math.PI/2, -Math.PI/2 + TAU * ratio);
        ctx.strokeStyle = 'rgba(216,162,74,0.65)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      ctx.restore();
    }
    else if (s.type === 'mahoraga'){
      /* ★ 白色球体 + 金色法轮 */
      const R = s.r;
      const gold = 'rgba(255,215,110,';
      ctx.save();
      ctx.translate(s.x, s.y);

      // 地面光影
      ctx.beginPath();
      ctx.arc(0, R * 0.85, R * 1.1, 0, TAU);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fill();

      // 金色法轮（头顶，旋转）
      ctx.save();
      ctx.translate(0, -R * 1.6);
      ctx.rotate(G.time * 1.2);
      ctx.strokeStyle = gold + '0.95)';
      ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.arc(0, 0, R * 0.92, 0, TAU); ctx.stroke();
      ctx.strokeStyle = gold + '0.8)';
      ctx.lineWidth = 2.5;
      for (let i = 0; i < 8; i++){
        const a = i / 8 * TAU;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * R * 0.18, Math.sin(a) * R * 0.18);
        ctx.lineTo(Math.cos(a) * R * 0.88, Math.sin(a) * R * 0.88);
        ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(0, 0, R * 0.2, 0, TAU);
      ctx.fillStyle = 'rgba(255,235,160,0.95)';
      ctx.fill();
      ctx.restore();

      // 白色球体本体
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, TAU);
      const g = ctx.createRadialGradient(-R*0.35, -R*0.35, 2, 0, 0, R);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.6, '#f4f7ff');
      g.addColorStop(1, '#c7d0de');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = s.hitFlash > 0 ? '#ff6b6b' : gold + '0.9)';
      ctx.lineWidth = 3;
      ctx.stroke();

      // 金色纹路
      ctx.save();
      ctx.rotate(G.time * 0.5);
      ctx.strokeStyle = 'rgba(230,180,60,0.5)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++){
        const a = i / 4 * TAU;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * R * 0.25, Math.sin(a) * R * 0.25);
        ctx.lineTo(Math.cos(a) * R * 0.9, Math.sin(a) * R * 0.9);
        ctx.stroke();
      }
      ctx.restore();

      // 砍击动作
      if (s.slashAnim > 0){
        const k = clamp(s.slashAnim / 0.22, 0, 1);
        ctx.save();
        ctx.rotate(finite(s.angle) ? s.angle : 0);
        ctx.strokeStyle = `rgba(255,235,160,${0.2 + k*0.8})`;
        ctx.lineWidth = 3 + 7*k;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(0, 0, R * 1.55, -0.7, 0.7);
        ctx.stroke();
        ctx.lineCap = 'butt';
        ctx.restore();
      }

      // 适应层数提示
      const stackCnt = s.adapt ? Object.keys(s.adapt).length : 0;
      if (stackCnt > 0){
        ctx.save();
        ctx.font = '700 10px system-ui,sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255,220,130,0.95)';
        ctx.fillText('适应 ×' + stackCnt, 0, R + 20);
        ctx.restore();
      }

      // ★ 血量条（置于法轮之上，避免遮挡）
      drawSummonBar(s, R * 2.3 + 16, '#ffd76a');

      // 魔虚罗无时间限制，不绘制倒计时环
      ctx.restore();
    }
  }
}

/* 式神血量条 */
function drawSummonBar(s, topOffset, color){
  const ratio = clamp((s.hp || 0) / (s.maxHp || 1), 0, 1);
  if (ratio >= 1) return;
  const w = (s.r || 16) * 2.2, h = 4;
  const y = -(topOffset || (s.r + 16));
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(-w/2, y, w, h);
  ctx.fillStyle = color || '#ff8a3d';
  ctx.fillRect(-w/2, y, w*ratio, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(-w/2, y, w, h);
  ctx.restore();
}

function drawProjectiles(){
  for (const pr of projectiles){
    if (!pr || pr.dead) continue;
    ctx.save();
    ctx.translate(pr.x, pr.y);

    /* ★ 赫 被吸附型苍牵引：绘制红色牵引光丝 */
    if (pr.type === 'red' && pr.homingBlue && !pr.homingBlue.dead){
      const o = pr.homingBlue;
      ctx.beginPath();
      ctx.moveTo(o.x - pr.x, o.y - pr.y);
      ctx.lineTo(0, 0);
      ctx.strokeStyle = 'rgba(255,170,120,0.5)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([9, 7]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (pr.type === 'blue'){
      const gc = CFG.gojo;
      if (pr.charged){
        /* ★ 吸附型苍：以球心为引力中心，带旋转气流环 */
        const R = gc.blueChargedR;
        const g0 = ctx.createRadialGradient(0,0, 4, 0,0, R);
        g0.addColorStop(0,   'rgba(120,205,255,0.20)');
        g0.addColorStop(0.45,'rgba(70,150,255,0.09)');
        g0.addColorStop(1,   'rgba(40,110,255,0)');
        ctx.beginPath(); ctx.arc(0,0,R,0,TAU); ctx.fillStyle = g0; ctx.fill();
        const spin = (pr.age||0) * 3.4;
        for (let k2=0;k2<3;k2++){
          ctx.beginPath();
          ctx.arc(0,0, pr.r + 16 + k2*26, spin + k2*2.1, spin + k2*2.1 + 1.5);
          ctx.strokeStyle = hexA('#8fd4ff', 0.5 - k2*0.12);
          ctx.lineWidth = Math.max(1, 3 - k2*0.7);
          ctx.stroke();
        }
      } else if (pr.owner && pr.owner.alive){
        const R = 400;
        const ox = pr.owner.x - pr.x, oy = pr.owner.y - pr.y;
        const g0 = ctx.createRadialGradient(ox, oy, 4, ox, oy, R);
        g0.addColorStop(0, 'rgba(90,185,255,0.16)');
        g0.addColorStop(0.5, 'rgba(60,140,255,0.07)');
        g0.addColorStop(1, 'rgba(40,110,255,0)');
        ctx.beginPath(); ctx.arc(ox, oy, R, 0, TAU);
        ctx.fillStyle = g0; ctx.fill();
      }
      const g = ctx.createRadialGradient(0,0,1, 0,0,pr.r);
      g.addColorStop(0, pr.charged ? '#ffffff' : '#ffffff');
      g.addColorStop(0.35,'#7fcaff');
      g.addColorStop(1,'rgba(25,80,200,0)');
      ctx.beginPath(); ctx.arc(0,0,pr.r,0,TAU);
      ctx.fillStyle = g; ctx.fill();
    }
    else if (pr.type === 'red'){
      const g = ctx.createRadialGradient(0,0,2, 0,0,pr.r);
      g.addColorStop(0,'#fff2c0');
      g.addColorStop(0.3,'#ff5a3d');
      g.addColorStop(1,'rgba(180,20,20,0)');
      ctx.beginPath(); ctx.arc(0,0,pr.r,0,TAU); ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = 'rgba(255,150,120,0.85)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0,0,pr.r*1.05,0,TAU); ctx.stroke();
    }
    else if (pr.type === 'purple'){
      const g = ctx.createRadialGradient(0,0,3, 0,0,pr.r);
      g.addColorStop(0,'#ffffff');
      g.addColorStop(0.25,'#d9a6ff');
      g.addColorStop(0.6,'#8a3cff');
      g.addColorStop(1,'rgba(60,0,120,0)');
      ctx.beginPath(); ctx.arc(0,0,pr.r,0,TAU); ctx.fillStyle = g; ctx.fill();
    }
    else if (pr.type === 'dismantle'){
      ctx.rotate(pr.rot || 0);
      const g = ctx.createLinearGradient(-pr.r*3, 0, pr.r, 0);
      g.addColorStop(0, 'rgba(200,140,255,0)');
      g.addColorStop(0.6, 'rgba(200,140,255,0.6)');
      g.addColorStop(1, 'rgba(255,255,255,1)');
      ctx.strokeStyle = g;
      ctx.lineWidth = 12;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-pr.r*3.5, 0);
      ctx.lineTo(pr.r*0.6, 0);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-pr.r*0.5, -pr.r*0.9);
      ctx.lineTo(pr.r*0.9, 0);
      ctx.lineTo(-pr.r*0.5, pr.r*0.9);
      ctx.stroke();
    }
    else if (pr.type === 'space'){
      /* ★ 空间斩：白光斩击 + 空间裂隙 */
      ctx.rotate(pr.rot || 0);
      const sg = ctx.createLinearGradient(-pr.r*6, 0, pr.r, 0);
      sg.addColorStop(0, 'rgba(255,255,255,0)');
      sg.addColorStop(0.65, 'rgba(255,240,180,0.85)');
      sg.addColorStop(1, '#ffffff');
      ctx.strokeStyle = sg;
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-pr.r*6, 0);
      ctx.lineTo(pr.r*0.4, 0);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-pr.r*2.2, -pr.r*0.55);
      ctx.lineTo(pr.r*0.5, 0);
      ctx.lineTo(-pr.r*2.2, pr.r*0.55);
      ctx.stroke();
      ctx.lineCap = 'butt';
    }
    else if (pr.type === 'nue'){
      ctx.save();
      ctx.rotate(G.time*8);
      ctx.strokeStyle = 'rgba(200,150,255,0.6)';
      ctx.lineWidth = 2;
      for (let i=0;i<6;i++){
        const a = i/6*TAU;
        const r1 = pr.r * 1.4;
        const r2 = pr.r * (1.9 + Math.sin(G.time*10 + i)*0.3);
        ctx.beginPath();
        ctx.moveTo(Math.cos(a)*r1, Math.sin(a)*r1);
        ctx.lineTo(Math.cos(a + 0.15)*r2, Math.sin(a + 0.15)*r2);
        ctx.stroke();
      }
      ctx.restore();
      const g = ctx.createRadialGradient(0,0,1, 0,0,pr.r);
      g.addColorStop(0,'#ffffff');
      g.addColorStop(0.35,'#d9a6ff');
      g.addColorStop(1,'rgba(120,40,200,0)');
      ctx.beginPath(); ctx.arc(0,0,pr.r,0,TAU); ctx.fillStyle = g; ctx.fill();
    }
    else if (pr.type === 'slash'){
      ctx.rotate(pr.rot || 0);
      const col = pr.color || '#ff6b8a';
      ctx.strokeStyle = col;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-24,-11); ctx.lineTo(26,0); ctx.lineTo(-24,11);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(-16,-5); ctx.lineTo(20,0); ctx.lineTo(-16,5); ctx.stroke();
    }
    else if (pr.type === 'fire'){
      const g = ctx.createRadialGradient(0,0,3, 0,0,pr.r);
      g.addColorStop(0,'#fffbe0');
      g.addColorStop(0.3,'#ffb03d');
      g.addColorStop(0.7,'#ff4a1a');
      g.addColorStop(1,'rgba(120,10,0,0)');
      ctx.beginPath(); ctx.arc(0,0,pr.r,0,TAU); ctx.fillStyle = g; ctx.fill();
      ctx.save();
      ctx.rotate(G.time*6);
      ctx.fillStyle = 'rgba(255,200,80,0.7)';
      for (let i=0;i<5;i++){
        const a = i/5*TAU;
        ctx.beginPath();
        ctx.arc(Math.cos(a)*pr.r*0.9, Math.sin(a)*pr.r*0.9, 5, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
    else if (pr.type === 'heaven'){
      /* ★ 天逆鉾：白色弧形闪光（朝向由 rot 决定，宽弧在前方展开） */
      ctx.rotate(pr.rot || 0);
      ctx.lineCap = 'round';
      const arc = (rad, w, col) => {
        ctx.strokeStyle = col; ctx.lineWidth = w;
        ctx.beginPath(); ctx.arc(0, 0, rad, -1.18, 1.18); ctx.stroke();
      };
      arc(pr.r*1.30, 14, 'rgba(176,190,206,0.32)');
      arc(pr.r*1.00, 8,  'rgba(255,255,255,0.92)');
      arc(pr.r*0.70, 3,  'rgba(255,255,255,1)');
      /* 拖尾 */
      const tg = ctx.createLinearGradient(-pr.r*4.5, 0, 0, 0);
      tg.addColorStop(0, 'rgba(255,255,255,0)');
      tg.addColorStop(1, 'rgba(240,246,252,0.6)');
      ctx.strokeStyle = tg; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(-pr.r*4.5, 0); ctx.lineTo(-pr.r*0.2, 0); ctx.stroke();
      ctx.lineCap = 'butt';
    }
    else if (pr.type === 'chain'){
      /* ★ 万里锁：从施法者一路拖出的锁链 */
      const ow = pr.owner;
      if (ow && finite(ow.x) && finite(ow.y)){
        const ca = Math.atan2(pr.y - ow.y, pr.x - ow.x);
        const clen = Math.hypot(pr.x - ow.x, pr.y - ow.y);
        const cn = Math.max(2, Math.round(clen / 15));
        ctx.save();
        ctx.rotate(ca);
        ctx.strokeStyle = 'rgba(198,208,220,0.9)';
        ctx.lineWidth = 2.4;
        for (let i = 1; i <= cn; i++){
          const dd = -i * (clen / cn);
          ctx.beginPath(); ctx.arc(dd, 0, 3.6, 0, TAU); ctx.stroke();
        }
        ctx.restore();
      }
      /* 钩爪 */
      ctx.rotate(pr.rot || 0);
      ctx.strokeStyle = 'rgba(232,240,248,0.95)';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-11, -10); ctx.lineTo(6, 0); ctx.lineTo(-11, 10); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(15, 0); ctx.stroke();
      ctx.lineCap = 'butt';
    }
    ctx.restore();
  }
}

/* ══════════════════════════════════════════
   绘制角色
   ══════════════════════════════════════════ */
function drawFighter(f){
  drawStatusAuras(f);
  drawPullChain(f);
  if (f.type === 'gojo') drawGojo(f);
  else if (f.type === 'sukunaTs') drawSukunaTs(f);
  else if (f.type === 'higuruma') drawHiguruma(f);
  else if (f.type === 'toji') drawToji(f);
  else drawSukuna(f);
}

/* ★ 通用状态标记：死刑（受伤 +50%） / 术式禁止（审判） */
function drawStatusAuras(f){
  if (!f || (!(f.sentence > 0) && !(f.skillLock > 0))) return;

  ctx.save();
  ctx.translate(f.x, f.y);
  if (f.sentence > 0){
    const pulse = 0.55 + Math.sin(G.time*9)*0.25;
    ctx.beginPath(); ctx.arc(0,0, f.r + 15 + Math.sin(G.time*6)*3, 0, TAU);
    ctx.strokeStyle = `rgba(255,60,60,${pulse})`;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  if (f.skillLock > 0){
    ctx.save();
    ctx.rotate(G.time*1.2);
    ctx.strokeStyle = 'rgba(255,215,110,0.85)';
    ctx.lineWidth = 3;
    if (ctx.setLineDash) ctx.setLineDash([7,7]);
    ctx.beginPath(); ctx.arc(0,0, f.r + 26, 0, TAU); ctx.stroke();
    if (ctx.setLineDash) ctx.setLineDash([]);
    ctx.restore();
  }
  ctx.restore();

  const tags = [];
  if (f.sentence > 0)  tags.push(['死刑 ' + f.sentence.toFixed(1) + 's', 'rgba(255,90,90,0.95)']);
  if (f.skillLock > 0) tags.push(['术式禁止 ' + f.skillLock.toFixed(1) + 's', 'rgba(255,215,110,0.95)']);
  if (!tags.length) return;

  ctx.save();
  ctx.font = '900 12px system-ui,sans-serif';
  ctx.textAlign = 'center';
  tags.forEach((t, i) => {
    ctx.fillStyle = t[1];
    ctx.fillText(t[0], f.x, f.y + f.r + 42 + i*15);
  });
  ctx.restore();
}

function drawGojo(p){
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.infinity){
    const t = G.time;
    ctx.beginPath();
    ctx.arc(0,0, p.r+15+Math.sin(t*4)*2.5, 0, TAU);
    ctx.strokeStyle = 'rgba(150,220,255,0.65)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0,0, p.r+9, 0, TAU);
    ctx.fillStyle = 'rgba(90,170,255,0.13)';
    ctx.fill();
  }
  if (p.blueFist){
    const g = ctx.createRadialGradient(0,0,p.r*0.4, 0,0,p.r+16);
    g.addColorStop(0,'rgba(70,150,255,0)');
    g.addColorStop(1,'rgba(70,150,255,0.55)');
    ctx.beginPath(); ctx.arc(0,0,p.r+16,0,TAU);
    ctx.fillStyle = g; ctx.fill();
  }
  if (p.brainDamaged){
    const pulse = 0.5 + Math.sin(G.time*10)*0.3;
    const r = p.r + 12 + Math.sin(G.time*7)*4;
    ctx.beginPath(); ctx.arc(0,0, r, 0, TAU);
    ctx.strokeStyle = `rgba(255,110,40,${pulse})`;
    ctx.lineWidth = 2.5; ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(0,0,p.r,0,TAU);
  const bg = ctx.createRadialGradient(-p.r*0.35,-p.r*0.35,1, 0,0,p.r);
  bg.addColorStop(0,'#ffffff'); bg.addColorStop(0.55,'#cfe6ff'); bg.addColorStop(1,'#7fa8cc');
  ctx.fillStyle = bg; ctx.fill();
  ctx.strokeStyle = p.hitFlash > 0 ? '#ff4a4a' : '#5b9bd5';
  ctx.lineWidth = 2.5; ctx.stroke();
  ctx.save();
  ctx.rotate(p.facing);
  ctx.beginPath();
  ctx.moveTo(p.r*0.78, 0);
  ctx.lineTo(-p.r*0.12, -p.r*0.46);
  ctx.lineTo(-p.r*0.12, p.r*0.46);
  ctx.closePath();
  ctx.fillStyle = '#2b6fd6'; ctx.fill();
  ctx.restore();
  ctx.restore();

  ctx.save();
  ctx.font = '700 13px system-ui,sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(180,225,255,0.85)';
  ctx.fillText('五条悟', p.x, p.y - p.r - 16);
  let line = p.y - p.r - 32;
  const flags = [];
  if (p.blueUsed) flags.push('苍');
  if (p.redUsed) flags.push('赫');
  if (flags.length){
    ctx.font = '700 11px system-ui,sans-serif';
    ctx.fillStyle = 'rgba(200,150,255,0.95)';
    ctx.fillText('茈条件: ' + flags.join('+'), p.x, line);
    line -= 14;
  }
  if (p.brainDamaged){
    ctx.font = '900 12px system-ui,sans-serif';
    ctx.fillStyle = 'rgba(255,120,60,0.95)';
    ctx.fillText('⚠ 大脑受损', p.x, line);
    line -= 15;
  }
  if (p.stun > 0){
    ctx.fillStyle = 'rgba(255,180,180,0.95)';
    ctx.font = '700 12px system-ui,sans-serif';
    ctx.fillText('僵直 ' + p.stun.toFixed(1) + 's', p.x, p.y + p.r + 22);
  }
  ctx.restore();
}

function drawSukuna(s){
  ctx.save();
  ctx.translate(s.x, s.y);
  const auraG = ctx.createRadialGradient(0,0,s.r*0.5, 0,0,s.r+22);
  auraG.addColorStop(0,'rgba(255,40,40,0)');
  auraG.addColorStop(1,'rgba(200,20,20,0.35)');
  ctx.beginPath(); ctx.arc(0,0,s.r+22,0,TAU);
  ctx.fillStyle = auraG; ctx.fill();
  ctx.beginPath(); ctx.arc(0,0,s.r,0,TAU);
  const bg = ctx.createRadialGradient(-s.r*0.3,-s.r*0.3,1, 0,0,s.r);
  bg.addColorStop(0,'#5a1a1a'); bg.addColorStop(0.6,'#2a0808'); bg.addColorStop(1,'#120303');
  ctx.fillStyle = bg; ctx.fill();
  ctx.strokeStyle = s.hitFlash > 0 ? '#ffffff' : '#ff3b3b';
  ctx.lineWidth = 2.5; ctx.stroke();
  ctx.save();
  ctx.rotate(G.time*0.4);
  ctx.strokeStyle = 'rgba(255,80,80,0.75)';
  ctx.lineWidth = 2;
  for (let i=0;i<4;i++){
    const a = i/4*TAU;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a)*s.r*0.25, Math.sin(a)*s.r*0.25);
    ctx.lineTo(Math.cos(a)*s.r*0.85, Math.sin(a)*s.r*0.85);
    ctx.stroke();
  }
  ctx.restore();
  ctx.save();
  ctx.rotate(s.facing);
  ctx.beginPath();
  ctx.moveTo(s.r*0.95, 0);
  ctx.lineTo(s.r*0.15, -s.r*0.55);
  ctx.lineTo(s.r*0.15, s.r*0.55);
  ctx.closePath();
  ctx.fillStyle = '#ff2b2b'; ctx.fill();
  ctx.restore();
  ctx.restore();
  drawSukunaLabel(s, '两面宿傩', 'rgba(255,150,150,0.85)');
}

function drawSukunaTs(s){
  ctx.save();
  ctx.translate(s.x, s.y);
  const auraG = ctx.createRadialGradient(0,0,s.r*0.5, 0,0,s.r+26);
  auraG.addColorStop(0,'rgba(160,80,255,0.05)');
  auraG.addColorStop(0.6,'rgba(140,60,220,0.25)');
  auraG.addColorStop(1,'rgba(80,20,160,0)');
  ctx.beginPath(); ctx.arc(0,0,s.r+26,0,TAU);
  ctx.fillStyle = auraG; ctx.fill();

  ctx.save();
  ctx.rotate(G.time*0.5);
  ctx.strokeStyle = `rgba(200,140,255,${0.45 + Math.sin(G.time*3)*0.15})`;
  ctx.lineWidth = 2;
  for (let i=0;i<3;i++){
    ctx.beginPath();
    ctx.arc(0, 0, s.r*1.5, i*Math.PI/3, i*Math.PI/3 + Math.PI/3);
    ctx.stroke();
  }
  ctx.restore();

  ctx.beginPath(); ctx.arc(0,0,s.r,0,TAU);
  const bg = ctx.createRadialGradient(-s.r*0.3,-s.r*0.3,1, 0,0,s.r);
  bg.addColorStop(0,'#4a1a7a');
  bg.addColorStop(0.55,'#24063a');
  bg.addColorStop(1,'#0a0118');
  ctx.fillStyle = bg; ctx.fill();
  ctx.strokeStyle = s.hitFlash > 0 ? '#ffffff' : '#c9a4ff';
  ctx.lineWidth = 2.5; ctx.stroke();

  ctx.save();
  ctx.rotate(-G.time*0.4);
  ctx.strokeStyle = 'rgba(200,140,255,0.75)';
  ctx.lineWidth = 2;
  for (let i=0;i<4;i++){
    const a = i/4*TAU;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a)*s.r*0.25, Math.sin(a)*s.r*0.25);
    ctx.lineTo(Math.cos(a)*s.r*0.85, Math.sin(a)*s.r*0.85);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.rotate(s.facing);
  ctx.beginPath();
  ctx.moveTo(s.r*0.95, 0);
  ctx.lineTo(s.r*0.15, -s.r*0.55);
  ctx.lineTo(s.r*0.15, s.r*0.55);
  ctx.closePath();
  ctx.fillStyle = '#c9a4ff'; ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(s.r*0.5, 0, 3, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.restore();
  drawSukunaLabel(s, '十影宿傩', 'rgba(200,160,255,0.9)');
}

function drawHiguruma(h){
  ctx.save();
  ctx.translate(h.x, h.y);

  /* 身体：墨色西装 + 金色法槌 */
  ctx.beginPath(); ctx.arc(0,0,h.r,0,TAU);
  const bg = ctx.createRadialGradient(-h.r*0.35,-h.r*0.35,1, 0,0,h.r);
  bg.addColorStop(0,'#3b4050'); bg.addColorStop(0.55,'#1b1f2c'); bg.addColorStop(1,'#0a0d14');
  ctx.fillStyle = bg; ctx.fill();
  ctx.strokeStyle = h.hitFlash > 0 ? '#ff4a4a' : '#ffd76a';
  ctx.lineWidth = 2.5; ctx.stroke();

  /* 金色领带（朝向指示） */
  ctx.save();
  ctx.rotate(h.facing);
  ctx.strokeStyle = '#c9a05a';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(h.r*0.2, 0); ctx.lineTo(h.r*0.92, 0); ctx.stroke();
  ctx.fillStyle = '#ffd76a';
  ctx.fillRect(h.r*0.86, -6, 13, 12);
  ctx.lineCap = 'butt';
  ctx.restore();

  ctx.restore();

  /* 名牌 */
  ctx.save();
  ctx.font = '700 13px system-ui,sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,215,110,0.9)';
  ctx.fillText('日车宽见', h.x, h.y - h.r - 16);
  if (h.stun > 0){
    ctx.fillStyle = 'rgba(255,180,180,0.95)';
    ctx.font = '700 12px system-ui,sans-serif';
    ctx.fillText('僵直 ' + h.stun.toFixed(1) + 's', h.x, h.y + h.r + 22);
  }
  ctx.restore();
}

/* ★ 伏黑甚尔：黑色作战服 + 银白天逆鉾 */
function drawToji(t){
  ctx.save();
  ctx.translate(t.x, t.y);

  ctx.beginPath(); ctx.arc(0,0,t.r,0,TAU);
  const bg = ctx.createRadialGradient(-t.r*0.35,-t.r*0.35,1, 0,0,t.r);
  bg.addColorStop(0,'#4c525a'); bg.addColorStop(0.55,'#23272d'); bg.addColorStop(1,'#0b0d10');
  ctx.fillStyle = bg; ctx.fill();
  ctx.strokeStyle = t.hitFlash > 0 ? '#ff4a4a' : '#dfe4ea';
  ctx.lineWidth = 2.5; ctx.stroke();

  /* 朝向：手持的银白刃（天逆鉾） */
  ctx.save();
  ctx.rotate(t.facing);
  ctx.strokeStyle = '#98a1ac';
  ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(t.r*0.1, 0); ctx.lineTo(t.r*0.9, 0); ctx.stroke();
  const bl = ctx.createLinearGradient(t.r*0.8, 0, t.r*1.6, 0);
  bl.addColorStop(0,'rgba(255,255,255,0.95)');
  bl.addColorStop(1,'rgba(200,212,226,0.12)');
  ctx.strokeStyle = bl; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(t.r*0.8, 0); ctx.lineTo(t.r*1.6, 0); ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.restore();

  ctx.restore();

  /* 名牌 */
  ctx.save();
  ctx.font = '700 13px system-ui,sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(223,228,234,0.92)';
  ctx.fillText('伏黑甚尔', t.x, t.y - t.r - 16);
  if (t.stun > 0){
    ctx.fillStyle = 'rgba(255,180,180,0.95)';
    ctx.font = '700 12px system-ui,sans-serif';
    ctx.fillText('眩晕 ' + t.stun.toFixed(1) + 's', t.x, t.y + t.r + 22);
  }
  ctx.restore();
}

/* ★ 万里锁拖拽期间，在施法者与目标之间画出一条锁链 */
function drawPullChain(f){
  const p = f && f.pull;
  if (!p || !p.src || !p.src.alive) return;
  const s = p.src;
  const a = Math.atan2(f.y - s.y, f.x - s.x);
  const len = Math.hypot(f.x - s.x, f.y - s.y);
  const n = Math.max(2, Math.round(len / 16));
  ctx.save();
  ctx.strokeStyle = 'rgba(206,216,228,0.85)';
  ctx.lineWidth = 2.2;
  for (let i = 1; i <= n; i++){
    const d = i * (len / n);
    ctx.beginPath(); ctx.arc(s.x + Math.cos(a)*d, s.y + Math.sin(a)*d, 3.2, 0, TAU); ctx.stroke();
  }
  ctx.restore();
}

function drawSukunaLabel(s, name, nameColor){
  ctx.save();
  ctx.font = '700 13px system-ui,sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = nameColor;
  ctx.fillText(name, s.x, s.y - s.r - 16);
  let line = s.y - s.r - 32;
  if (s.stun > 0){
    ctx.fillStyle = 'rgba(200,160,255,0.95)';
    ctx.font = '700 12px system-ui,sans-serif';
    ctx.fillText('僵直 ' + s.stun.toFixed(1) + 's', s.x, line);
    line -= 15;
  }
  if (s.domainLock > 0){
    ctx.fillStyle = 'rgba(255,120,120,0.95)';
    ctx.font = '700 11px system-ui,sans-serif';
    ctx.fillText('领域封印 ' + Math.ceil(s.domainLock) + 's', s.x, line);
  }
  ctx.restore();
}

/* ══════════════════════════════════════════
   特效绘制
   ══════════════════════════════════════════ */
function drawEffects(){
  for (const e of effects){
    if (!e || !e.life || e.life <= 0) continue;
    const k = e.t / e.life;
    const a = 1 - k;
    if (a <= 0) continue;

    if (e.type === 'ring'){
      const r = (e.r0||0) + ((e.r1||e.r0||0)-(e.r0||0))*k;
      ctx.beginPath();
      ctx.arc(e.x, e.y, r, 0, TAU);
      ctx.strokeStyle = hexA(e.color, a*0.9);
      ctx.lineWidth = (e.width||3) * (1-k*0.6);
      ctx.stroke();
    }
    else if (e.type === 'spark'){
      ctx.beginPath();
      ctx.arc(e.x, e.y, (e.size||3)*a, 0, TAU);
      ctx.fillStyle = hexA(e.color, a);
      ctx.fill();
    }
    else if (e.type === 'punch'){
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(e.ang);
      ctx.beginPath();
      ctx.arc(0,0, 46 + k*26, -0.7, 0.7);
      ctx.strokeStyle = hexA(e.color || '#b4e6ff', a*0.9);
      ctx.lineWidth = 7*(1-k);
      ctx.stroke();
      ctx.restore();
    }
    else if (e.type === 'bluepunch'){
      /* ★ 苍拳冲拳特效 */
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(e.ang);
      const reach = 34 + k*34;
      const g = ctx.createRadialGradient(reach,0,2, reach,0,30);
      g.addColorStop(0, 'rgba(170,225,255,0.95)');
      g.addColorStop(1, 'rgba(40,120,255,0)');
      ctx.beginPath(); ctx.arc(reach,0,30,0,TAU); ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = `rgba(140,210,255,${a})`;
      ctx.lineWidth = 10*(1-k);
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(reach, 0); ctx.stroke();
      ctx.lineCap = 'butt';
      ctx.restore();
    }
    else if (e.type === 'heal'){
      ctx.save();
      ctx.translate(e.x, e.y);
      const col = e.color || '#6dffa0';
      const r = 24 + k*70;
      const g = ctx.createRadialGradient(0,0,4, 0,0,r);
      g.addColorStop(0, hexA(col, a*0.55));
      g.addColorStop(1, hexA(col, 0));
      ctx.beginPath(); ctx.arc(0,0,r,0,TAU); ctx.fillStyle = g; ctx.fill();
      ctx.fillStyle = hexA(col, a*0.95);
      for (let i=0;i<7;i++){
        const px = Math.cos(i*2.4 + G.time*1.5) * 26;
        const py = -k*90 - i*12;
        ctx.beginPath();
        ctx.arc(px, py, 3.2*(1-k*0.5), 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
    else if (e.type === 'blackflash'){
      ctx.save();
      ctx.translate(e.x, e.y);
      const r = 20 + k*160;
      const g = ctx.createRadialGradient(0,0,4, 0,0,r);
      g.addColorStop(0, `rgba(255,60,60,${a})`);
      g.addColorStop(0.5, `rgba(120,0,60,${a*0.55})`);
      g.addColorStop(1, `rgba(0,0,0,0)`);
      ctx.beginPath(); ctx.arc(0,0,r,0,TAU); ctx.fillStyle = g; ctx.fill();
      ctx.restore();
    }
    else if (e.type === 'brainbreak'){
      ctx.save();
      ctx.translate(e.x, e.y);
      const r = 20 + k*100;
      const g = ctx.createRadialGradient(0,0,4, 0,0,r);
      g.addColorStop(0, `rgba(255,160,60,${a})`);
      g.addColorStop(0.4, `rgba(255,60,20,${a*0.6})`);
      g.addColorStop(1, `rgba(120,0,0,0)`);
      ctx.beginPath(); ctx.arc(0,0,r,0,TAU); ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = `rgba(255,90,40,${a})`;
      ctx.lineWidth = 4*(1-k);
      ctx.beginPath(); ctx.arc(0,0, 16 + k*40, 0, TAU); ctx.stroke();
      ctx.restore();
    }
    else if (e.type === 'sword'){
      /* ★ 伏魔御厨子的自动斩击：随机角度的刀光，横穿角色身体 */
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(e.ang);
      ctx.globalCompositeOperation = 'lighter';
      const L = (e.len || 90) * (0.70 + k*0.45);        /* 刀光向两侧延展 */
      const w = (e.width || 6) * (1 - k*0.5);
      const blade = e.color || '#ffffff';               /* 主色：白 / 紫 */
      const edge  = e.color2 || e.color || '#ffffff';   /* 副色：黄 / 灰 */

      /* 刀身（中间厚、两端收尖的光带） */
      const lg = ctx.createLinearGradient(-L, 0, L, 0);
      lg.addColorStop(0,    hexA(blade, 0));
      lg.addColorStop(0.20, hexA(edge,  a*0.5));
      lg.addColorStop(0.5,  hexA(blade, a*0.95));
      lg.addColorStop(0.80, hexA(edge,  a*0.5));
      lg.addColorStop(1,    hexA(blade, 0));
      ctx.beginPath();
      ctx.moveTo(-L, 0);
      ctx.quadraticCurveTo(0, -w*1.7, L, 0);
      ctx.quadraticCurveTo(0,  w*1.7, -L, 0);
      ctx.closePath();
      ctx.fillStyle = lg;
      ctx.fill();

      /* 刃口高光（一条细白线） */
      ctx.beginPath();
      ctx.moveTo(-L*0.95, 0);
      ctx.quadraticCurveTo(0, -w*0.6, L*0.95, 0);
      ctx.strokeStyle = hexA('#ffffff', a*0.9);
      ctx.lineWidth = Math.max(1, w*0.4);
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.lineCap = 'butt';

      /* 落刀闪光点（命中角色处） */
      const bs = 22 * (1 - k*0.35);
      const bg = ctx.createRadialGradient(0,0,1, 0,0, bs);
      bg.addColorStop(0,   hexA(blade, a*0.9));
      bg.addColorStop(0.45,hexA(edge,  a*0.4));
      bg.addColorStop(1,   hexA(blade, 0));
      ctx.beginPath(); ctx.arc(0, 0, bs, 0, TAU);
      ctx.fillStyle = bg; ctx.fill();
      ctx.restore();
    }
    else if (e.type === 'bigpurple'){
      /* ★ 大范围「茈」：紫色冲击波 */
      const R = (e.r0||20) + ((e.r1||480)-(e.r0||20)) * Math.pow(k, 0.6);
      const g = ctx.createRadialGradient(e.x, e.y, R*0.15, e.x, e.y, R*1.05);
      g.addColorStop(0,    `rgba(246,228,255,${a*0.85})`);
      g.addColorStop(0.35, `rgba(180,110,255,${a*0.55})`);
      g.addColorStop(0.7,  `rgba(110,40,220,${a*0.28})`);
      g.addColorStop(1,    'rgba(60,0,120,0)');
      ctx.beginPath(); ctx.arc(e.x, e.y, R*1.05, 0, TAU);
      ctx.fillStyle = g; ctx.fill();
      /* 外层冲击波环 */
      ctx.beginPath(); ctx.arc(e.x, e.y, R, 0, TAU);
      ctx.strokeStyle = `rgba(232,205,255,${a*0.95})`;
      ctx.lineWidth = 16*(1-k) + 3;
      ctx.stroke();
      /* 内层白环 */
      ctx.beginPath(); ctx.arc(e.x, e.y, R*0.7, 0, TAU);
      ctx.strokeStyle = `rgba(255,255,255,${a*0.7})`;
      ctx.lineWidth = 5*(1-k) + 1;
      ctx.stroke();
      /* 放射裂纹 */
      ctx.strokeStyle = `rgba(214,168,255,${a*0.6})`;
      ctx.lineWidth = 3*(1-k) + 1;
      for (let i=0;i<12;i++){
        const sa = i*(TAU/12) + k*0.6;
        ctx.beginPath();
        ctx.moveTo(e.x + Math.cos(sa)*R*0.32, e.y + Math.sin(sa)*R*0.32);
        ctx.lineTo(e.x + Math.cos(sa)*R*0.96, e.y + Math.sin(sa)*R*0.96);
        ctx.stroke();
      }
      ctx.save();
      ctx.globalAlpha = a*0.25;
      ctx.globalCompositeOperation = 'lighter';
      ctx.beginPath(); ctx.arc(e.x, e.y, R*0.55, 0, TAU);
      ctx.fillStyle = '#7b2fff'; ctx.fill();
      ctx.restore();
    }
    else if (e.type === 'text'){
      ctx.save();
      ctx.font = `900 ${e.size||16}px system-ui,sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = hexA(e.color, a);
      ctx.fillText(e.text, e.x, e.y - k*46);
      ctx.restore();
    }
  }
}

function hexA(hex, a){
  if (!hex || typeof hex !== 'string') return 'rgba(255,255,255,' + clamp(a,0,1) + ')';
  if (hex.startsWith('rgba') || hex.startsWith('rgb')) return hex;
  const n = parseInt(hex.slice(1), 16);
  if (isNaN(n)) return 'rgba(255,255,255,' + clamp(a,0,1) + ')';
  const r = (n>>16)&255, g = (n>>8)&255, b = n&255;
  return `rgba(${r},${g},${b},${clamp(a,0,1)})`;
}

/* ══════════════════════════════════════════
   开场对白绘制（屏幕空间，气泡跟随角色头顶）
   ══════════════════════════════════════════ */
function roundRectPath(x, y, w, h, r){
  const rr = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x+rr, y);
  ctx.lineTo(x+w-rr, y);   ctx.arcTo(x+w, y,   x+w, y+rr, rr);
  ctx.lineTo(x+w,   y+h-rr); ctx.arcTo(x+w, y+h, x+w-rr, y+h, rr);
  ctx.lineTo(x+rr,  y+h);  ctx.arcTo(x,   y+h, x,   y+h-rr, rr);
  ctx.lineTo(x,     y+rr); ctx.arcTo(x,   y,   x+rr, y,     rr);
  ctx.closePath();
}

/* 按最大宽度逐字折行（以字符为单位，中文安全） */
function wrapDialogue(text, maxW){
  const out = [];
  let line = '';
  for (const ch of Array.from(text)){
    const next = line + ch;
    if (line && ctx.measureText(next).width > maxW){ out.push(line); line = ch; }
    else line = next;
  }
  out.push(line);
  return out;
}

function drawDialogue(shx, shy){
  if (!introTalk || !player || !enemy) return;
  const cur = introTalk.seq[introTalk.idx];
  if (!cur) return;
  const f = cur.side === 'player' ? player : enemy;
  if (!f || !finite(f.x) || !finite(f.y)) return;

  const sx = (f.x - cam.x) * scale + shx;
  const sy = (f.y - cam.y) * scale + shy;
  const headY = sy - f.r * scale;          /* 角色头顶的屏幕 y */

  const n = Math.max(0, Math.floor(introTalk.chars));
  const typing = n < cur.text.length;

  const nameFont = '700 11px system-ui,"PingFang SC","Microsoft YaHei",sans-serif';
  const bodyFont = '700 15px system-ui,"PingFang SC","Microsoft YaHei",sans-serif';
  const padX = 14, padY = 10, lineH = 22, nameH = 17, tail = 9, maxW = Math.min(W*0.66, 360);

  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  ctx.font = bodyFont;
  const lines = wrapDialogue(cur.text, maxW);   /* 按完整台词折行：打字全程排版不跳动 */
  let textW = 0;
  for (const l of lines) textW = Math.max(textW, ctx.measureText(l).width);
  ctx.font = nameFont;
  const nameW = ctx.measureText(f.name).width;

  const bw = Math.max(textW, nameW + 34) + padX*2;
  const bh = nameH + lines.length * lineH + padY*2;
  const bx = clamp(sx - bw/2, 8, Math.max(8, W - bw - 8));
  const by = Math.max(8, headY - 16 - tail - bh);   /* 气泡底 + 尖角 = 头顶上方 16px */

  /* 气泡底 */
  const g = ctx.createLinearGradient(bx, by, bx, by+bh);
  g.addColorStop(0, 'rgba(30,33,37,0.94)');
  g.addColorStop(1, 'rgba(17,18,21,0.94)');
  ctx.fillStyle = g;
  roundRectPath(bx, by, bw, bh, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(214,222,232,0.62)';
  ctx.lineWidth = 1.6;
  ctx.stroke();

  /* 指向头顶的尖角 */
  ctx.beginPath();
  ctx.moveTo(sx - 8, by + bh - 0.8);
  ctx.lineTo(sx + 8, by + bh - 0.8);
  ctx.lineTo(sx, by + bh + tail);
  ctx.closePath();
  ctx.fillStyle = 'rgba(17,18,21,0.94)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(214,222,232,0.62)';
  ctx.stroke();

  /* 角色名（沿用角色主题色） */
  ctx.font = nameFont;
  ctx.fillStyle = nameColor(f.type);
  ctx.fillText(f.name, bx + padX, by + padY + 11);
  ctx.strokeStyle = 'rgba(214,222,232,0.16)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(bx + padX, by + padY + nameH - 2);
  ctx.lineTo(bx + bw - padX, by + padY + nameH - 2);
  ctx.stroke();

  /* 台词：逐字输出 */
  ctx.font = bodyFont;
  ctx.fillStyle = '#eef2f6';
  const textTop = by + padY + nameH + lineH*0.72;
  let remain = n, curLine = 0, curW = 0;
  for (let i = 0; i < lines.length && remain > 0; i++){
    const seg = lines[i].slice(0, remain);
    remain -= lines[i].length;
    if (seg){
      ctx.fillText(seg, bx + padX, textTop + i*lineH);
      curLine = i;
      curW = ctx.measureText(seg).width;
    }
  }

  /* 打字光标 */
  if (typing && Math.floor(G.time * 3) % 2 === 0){
    ctx.fillStyle = 'rgba(226,233,240,0.9)';
    ctx.fillRect(bx + padX + curW + 1, textTop + curLine*lineH - 12, 8, 14);
  }

  /* 跳过提示 */
  ctx.textAlign = 'center';
  ctx.font = '500 11px system-ui,"PingFang SC",sans-serif';
  ctx.fillStyle = 'rgba(186,194,204,0.5)';
  ctx.fillText('点击 / 任意键 继续', W/2, H - 62);
  ctx.restore();
}

function drawClashBanner(){
  if (!G.clash || !player || !enemy) return;
  const a = Math.min(1, G.clashT*3);
  const pulse = 0.7 + Math.sin(G.time*12)*0.3;

  ctx.save();
  ctx.globalAlpha = a;
  ctx.textAlign = 'center';

  ctx.font = '900 clamp(20px,5vw,38px) system-ui,sans-serif';
  ctx.fillStyle = `rgba(230,200,255,${pulse})`;
  ctx.fillText('领 域 对 拼', W/2, H*0.15);

  ctx.font = '700 12px system-ui,sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText('重叠区域效果抵消 · 单方受击超 200 领域破碎', W/2, H*0.15 + 24);

  let growthLabel = '';
  if (enemy.domain && (enemy.type === 'sukuna' || enemy.type === 'sukunaTs') && enemy.domain.r < enemy.domain.maxR){
    growthLabel = '伏魔御厨子扩张中… 半径 ' + Math.round(enemy.domain.r);
  } else if (player.domain && (player.type === 'sukuna' || player.type === 'sukunaTs') && player.domain.r < player.domain.maxR){
    growthLabel = '伏魔御厨子扩张中… 半径 ' + Math.round(player.domain.r);
  }
  if (growthLabel){
    ctx.font = '700 11px system-ui,sans-serif';
    ctx.fillStyle = 'rgba(200,160,255,0.9)';
    ctx.fillText(growthLabel, W/2, H*0.15 + 44);
  }

  const bw = Math.min(W*0.32, 190);
  const barY = H*0.15 + 60;
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(W/2 - bw - 12, barY, bw, 7);
  ctx.fillStyle = 'rgba(180,120,255,0.9)';
  ctx.fillRect(W/2 - bw - 12, barY, bw*clamp((player.clashDmg||0)/CLASH_DMG_LIMIT,0,1), 7);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(W/2 + 12, barY, bw, 7);
  ctx.fillStyle = 'rgba(255,90,90,0.9)';
  ctx.fillRect(W/2 + 12, barY, bw*clamp((enemy.clashDmg||0)/CLASH_DMG_LIMIT,0,1), 7);

  ctx.restore();
}

/* ══════════════════════════════════════════
   HUD / 按钮状态
   ══════════════════════════════════════════ */
const el = {
  php: document.getElementById('p-hp'), phpt: document.getElementById('p-hp-t'),
  pce: document.getElementById('p-ce'), pcet: document.getElementById('p-ce-t'),
  shp: document.getElementById('s-hp'), shpt: document.getElementById('s-hp-t'),
  sce: document.getElementById('s-ce'), scet: document.getElementById('s-ce-t'),
};

function updateHUD(){
  if (!player || !enemy) return;
  if (el.php) el.php.style.transform = `scaleX(${clamp(player.hp/player.maxHp,0,1)})`;
  if (el.phpt) el.phpt.textContent = `${Math.ceil(player.hp)} / ${player.maxHp}`;
  const pMax = player.maxCe;
  if (el.pce) el.pce.style.transform = `scaleX(${clamp(player.ce/pMax,0,1)})`;
  if (el.pcet) el.pcet.textContent = `${Math.floor(player.ce)} / ${pMax}`;

  if (el.shp) el.shp.style.transform = `scaleX(${clamp(enemy.hp/enemy.maxHp,0,1)})`;
  if (el.shpt) el.shpt.textContent = `${Math.ceil(enemy.hp)} / ${enemy.maxHp}`;
  const eMax = enemy.maxCe;
  if (el.sce) el.sce.style.transform = `scaleX(${clamp(enemy.ce/eMax,0,1)})`;
  if (el.scet) el.scet.textContent = `${Math.floor(enemy.ce)} / ${eMax}`;
}

/* ★ 技能动作 → 冷却字段 / 冷却总时长字段 */
const CD_FIELD = {
  blue:['blue','blueCd'], red:['red','redCd'], purple:['purple','purpleCd'],
  reverse:['reverse','reverseCd'], domain:['domain','domainCd'],
  fire:['fire','fireCd'], dismantle:['dismantle','dismantleCd'],
  nue:['nue','nueCd'], dog:['dog','dogCd'], tobi:['tobi','tobiCd'],
  mahoraga:['maho','mahoCd'], space:['space','spaceCd'],
  shinuchi:['shinuchi','shinuchiCd'], sentence:['sentence','sentenceCd'],
  heaven:['heaven','heavenCd'], chain:['chain','chainCd'], fly:['fly','flyCd'],
};

/* ★ 按键 CD 动画：扇形遮罩按剩余比例回填 + 居中倒计时数字
   （带缓存，避免每帧重复写样式造成重绘） */
function paintCooldown(act, f, type){
  const b = btns[act];
  if (!b) return;
  const m = CD_FIELD[act];
  if (!m) return;
  const cfg = CFG[type] || {};
  const total = cfg[m[1]];
  const left = (f.cd && f.cd[m[0]]) || 0;

  if (!finite(total) || total <= 0 || left <= 0){
    if (b._cdp !== 0){
      b._cdp = 0;
      b.style.setProperty('--p', 0);
      b.classList.remove('cdring');
      if (b._cdtxt) b._cdtxt.textContent = '';
    }
    return;
  }
  /* 量化到 2% 一档，避免每帧都触发重绘 */
  const p = Math.ceil(clamp(left / total, 0, 1) * 50) / 50;
  if (b._cdp !== p){
    b._cdp = p;
    b.style.setProperty('--p', p);
    b.classList.add('cdring');
  }
  const txt = left >= 1 ? String(Math.ceil(left)) : left.toFixed(1);
  if (b._cdtxt && b._cdtxt.textContent !== txt) b._cdtxt.textContent = txt;
}

function updateButtons(){
  if (!player || !btns) return;
  const p = player;
  if (btns.infinity) btns.infinity.classList.toggle('on', p.infinity);
  if (btns.bluefist) btns.bluefist.classList.toggle('on', p.blueFist);

  /* ★ 先刷新所有按键的 CD 扇形动画 */
  for (const s of (SKILL_SETS[p.type] || [])) paintCooldown(s.act, p, p.type);

  const setCool = (act, cool, extra) => {
    const b = btns[act];
    if (!b) return;
    b.classList.toggle('cool', cool || !!extra);
  };

  if (p.type === 'gojo'){
    const c = CFG.gojo;
    setCool('blue', p.cd.blue > 0, p.ce < c.blueCost);
    setCool('red', p.cd.red > 0, p.ce < c.redCost);
    setCool('purple', p.cd.purple > 0, !(p.blueUsed && p.redUsed) || p.ce < c.purpleCost);
    setCool('reverse', p.cd.reverse > 0 || (p.hp >= p.maxHp && !p.brainDamaged), p.ce < c.reverseCost);
    setCool('domain', p.cd.domain > 0 || !!p.domain || p.brainDamaged, p.ce < c.domainCost);
    setCool('brainbreak', p.brainDamaged || p.cd.domain <= 0 || p.stun > 0 || p.hp < p.maxHp * c.brainBreakMinHp);
    if (btns.brainbreak)
      btns.brainbreak.classList.toggle('ready',
        !p.brainDamaged && p.cd.domain > 0 && p.hp > p.maxHp * c.brainBreakMinHp);
    if (btns.purple)
      btns.purple.classList.toggle('ready',
        p.blueUsed && p.redUsed && p.cd.purple <= 0 && p.ce >= c.purpleCost);
  } else if (p.type === 'sukuna'){
    const c = CFG.sukuna;
    setCool('fire', p.cd.fire > 0, p.ce < c.fireCost);
    setCool('dismantle', p.cd.dismantle > 0, p.ce < c.dismantleCost);
    setCool('reverse', p.cd.reverse > 0 || p.hp >= p.maxHp, p.ce < c.reverseCost);
    setCool('domain', p.cd.domain > 0 || !!p.domain, p.ce < c.domainCost);
    if (btns.dismantle)
      btns.dismantle.classList.toggle('ready', p.cd.dismantle <= 0 && p.ce >= c.dismantleCost);
  } else if (p.type === 'higuruma'){
    const c = CFG.higuruma;
    /* ★ 审判期间所有主动术式置灰（普攻不受影响） */
    const sealed = p.skillLock > 0;
    setCool('shinuchi', sealed || p.cd.shinuchi > 0, p.ce < c.shinuchiCost);
    setCool('sentence', sealed || p.cd.sentence > 0, p.ce < c.sentenceCost);
    setCool('reverse', sealed || p.cd.reverse > 0 || p.hp >= p.maxHp, p.ce < c.reverseCost);
    setCool('domain', sealed || p.cd.domain > 0 || !!p.domain, p.ce < c.domainCost);
    if (btns.shinuchi)
      btns.shinuchi.classList.toggle('ready', !sealed && p.cd.shinuchi <= 0 && p.ce >= c.shinuchiCost);
    if (btns.sentence)
      btns.sentence.classList.toggle('ready', !sealed && p.cd.sentence <= 0 && p.ce >= c.sentenceCost);
  } else if (p.type === 'toji'){
    const c = CFG.toji;
    /* ★ 天逆鉾封印期间，全部咒具技能一并置灰 */
    const sealed = p.skillLock > 0;
    setCool('heaven', sealed || p.cd.heaven > 0, p.ce < c.heavenCost);
    setCool('chain',  sealed || p.cd.chain > 0,  p.ce < c.chainCost);
    setCool('fly',    sealed || p.cd.fly > 0,    p.ce < c.flyCost);
    if (btns.heaven)
      btns.heaven.classList.toggle('ready', !sealed && p.cd.heaven <= 0 && p.ce >= c.heavenCost);
    if (btns.chain)
      btns.chain.classList.toggle('ready', !sealed && p.cd.chain <= 0 && p.ce >= c.chainCost);
    if (btns.fly)
      btns.fly.classList.toggle('ready', !sealed && p.cd.fly <= 0 && p.ce >= c.flyCost);
  } else {
    const c = CFG.sukunaTs;
    setCool('nue', p.cd.nue > 0, p.ce < c.nueCost);
    setCool('dog', p.cd.dog > 0, p.ce < c.dogCost);
    setCool('tobi', p.cd.tobi > 0, p.ce < c.tobiCost);
    setCool('mahoraga', p.cd.maho > 0, p.ce < c.mahoCost);
    setCool('reverse', p.cd.reverse > 0 || p.hp >= p.maxHp, p.ce < c.reverseCost);
    setCool('domain', p.cd.domain > 0 || !!p.domain, p.ce < c.domainCost);
    /* ★ 空间斩：未解锁 / CD中 / 咒力不足 均置灰 */
    setCool('space', !p.spaceUnlocked || p.cd.space > 0, p.ce < c.spaceCost);
    if (btns.mahoraga)
      btns.mahoraga.classList.toggle('ready', p.cd.maho <= 0 && p.ce >= c.mahoCost);
    if (btns.space)
      btns.space.classList.toggle('ready', p.spaceUnlocked && p.cd.space <= 0 && p.ce >= c.spaceCost);
  }
}

/* ══════════════════════════════════════════
   主循环
   ══════════════════════════════════════════ */
let lastT = performance.now();
function loop(now){
  let dt = (now - lastT) / 1000;
  lastT = now;
  if (dt > 0.06) dt = 0.06;
  if (dt < 0) dt = 0;
  try { update(dt); render(); }
  catch(err){ console.error('loop error:', err); }
  requestAnimationFrame(loop);
}

showMenu();
requestAnimationFrame(loop);

})();