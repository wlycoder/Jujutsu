(() => {
'use strict';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let W = 0, H = 0, DPR = 1, scale = 1;
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
  scale = clamp(Math.min(W/700, H/760), 0.34, 1.35);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize,120));
resize();

/* ══════════════════════════════════════════
   角色配置
   ══════════════════════════════════════════ */
const CFG = {
  gojo: {
    name: '五条悟',
    maxHp: 1200, maxCe: 100, ceRegen: 7.0, speed: 270, r: 21,
    atkDmg: 32, atkCd: 0.40, atkRange: 64,
    infDrain: 4.5, infDR: 0.65,
    bfCost: 5, bfMult: 2.6,
    reverseCost: 40, reverseHeal: 220, reverseCd: 9, reverseThreshold: 0.55,
    blueFistKb: 0.30,
    blueCost: 18, blueCd: 1.3, blueDmg: 18,
    redCost: 28, redCd: 2.0, redDmg: 90,
    purpleCost: 45, purpleCd: 4.5, purpleDmg: 180,
    domainCost: 60, domainCd: 32,
    domainName: '无量空处',
    domainBaseR: 365, domainOpenTime: 0.45, domainGrowRate: 0,
    domainMaxR: 365, domainDuration: 5.2, domainDps: 0,
    brainBreakCost: 0.18, brainBreakStun: 1.0,
    brainBleed: 0.06, brainBreakMinHp: 0.28,
  },
  sukuna: {
    name: '两面宿傩',
    maxHp: 1600, maxCe: 100, ceRegen: 9.0, speed: 268, r: 24,
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
    dogCost: 35, dogCd: 5.5, dogDmg: 26, dogDur: 6,
    mahoCost: 55, mahoCd: 17, mahoDmg: 90, mahoDur: 6,
    domainCost: 60, domainCd: 36,
    /* ★ 领域 = 伏魔御厨子（削弱版）：更小、扩张更慢、DPS 更低 */
    domainName: '伏魔御厨子',
    domainBaseR: 320, domainOpenTime: 0.55, domainGrowRate: 40,
    domainMaxR: 900, domainDuration: 7.0, domainDps: 22,
  }
};

const CLASH_DMG_LIMIT = 200;

let player = null, enemy = null;
let projectiles = [];
let summons = [];
let effects = [];
let cam = { x:0, y:0 };
let G = { state:'menu', time:0, shake:0, flash:0, clash:false, clashT:0 };
let keys = {};
let joy = { active:false, id:null, ox:0, oy:0, x:0, y:0 };
let holdAttack = false;
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
    infinity: false, blueFist: false, blueUsed: false, redUsed: false,
    brainDamaged: false,
    cd: { blue:0, red:0, purple:0, domain:0, reverse:0, fire:0, dismantle:0, nue:0, dog:0, maho:0 },
    domainLock: 0,
    domain: null,
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
}

document.querySelectorAll('.char-card').forEach(card => {
  card.addEventListener('click', () => {
    const side = card.closest('.char-choice').dataset.side;
    const char = card.dataset.char;
    if (side === 'player') selectedPlayerType = char;
    else selectedEnemyType = char;
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
  updateHUD();
}

function updateHUDElements(){
  const pPanel = document.querySelector('.panel.player');
  const ePanel = document.querySelector('.panel.enemy');
  pPanel.querySelector('.pname').textContent = player.name;
  pPanel.querySelector('.pname').style.color =
    player.type === 'gojo' ? '#9fd8ff' : (player.type === 'sukunaTs' ? '#c9a4ff' : '#ff8a8a');
  ePanel.querySelector('.pname').textContent = enemy.name;
  ePanel.querySelector('.pname').style.color =
    enemy.type === 'gojo' ? '#9fd8ff' : (enemy.type === 'sukunaTs' ? '#c9a4ff' : '#ff8a8a');
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
    { act:'reverse',  label:'反转术式',  sub:'H', cls:'green' },
    { act:'nue',      label:'鵺',        sub:'Q', cls:'purple' },
    { act:'dog',      label:'玉犬',      sub:'E', cls:'red' },
    { act:'mahoraga', label:'魔虚罗',    sub:'R', cls:'shadow' },
    { act:'attack',   label:'斩击',      sub:'J', cls:'attackbtn' },
  ],
};

function renderControls(){
  ctrlEl.innerHTML = '';
  btns = {};
  const list = SKILL_SETS[player.type];
  const cols = player.type === 'gojo' ? 4 : 3;
  ctrlEl.style.gridTemplateColumns = `repeat(${cols}, auto)`;

  for (const s of list){
    const btn = document.createElement('button');
    btn.className = 'skill' + (s.cls ? ' ' + s.cls : '');
    btn.dataset.act = s.act;
    btn.innerHTML = `${s.label}<span class="sub">${s.sub}</span>`;
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
    ctrlEl.appendChild(btn);
    btns[s.act] = btn;
  }
}

function handleAction(act){
  switch(act){
    case 'attack':     basicAttack(player, enemy); break;
    case 'domain':     castDomain(player, enemy); break;
    case 'reverse':    castReverse(player); break;
    case 'infinity':   toggleInfinity(player); break;
    case 'bluefist':   toggleBlueFist(player); break;
    case 'blue':       gojoBlue(player, enemy); break;
    case 'red':        gojoRed(player, enemy); break;
    case 'purple':     gojoPurple(player, enemy); break;
    case 'fire':       sukunaFire(player, enemy); break;
    case 'dismantle':  sukunaDismantle(player, enemy); break;
    case 'nue':        tsNue(player, enemy); break;
    case 'dog':        tsDog(player); break;
    case 'mahoraga':   tsMahoraga(player); break;
    case 'brainbreak': brainBreak(player); break;
  }
}

/* ══════════════════════════════════════════
   输入
   ══════════════════════════════════════════ */
window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if ([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k)) e.preventDefault();
  if (e.repeat) return;
  keys[k] = true;
  if (G.state !== 'playing' || !player || !player.alive) return;
  switch(k){
    case 'j': handleAction('attack'); break;
    case 'q':
      if (player.type === 'gojo') handleAction('blue');
      else if (player.type === 'sukuna') handleAction('dismantle');
      else if (player.type === 'sukunaTs') handleAction('nue');
      break;
    case 'e':
      if (player.type === 'gojo') handleAction('red');
      else if (player.type === 'sukuna') handleAction('fire');
      else if (player.type === 'sukunaTs') handleAction('dog');
      break;
    case 'r':
      if (player.type === 'gojo') handleAction('purple');
      else if (player.type === 'sukunaTs') handleAction('mahoraga');
      break;
    case 'f': if (player.type === 'gojo') handleAction('infinity'); break;
    case 'g': if (player.type === 'gojo') handleAction('bluefist'); break;
    case 'h': handleAction('reverse'); break;
    case 'p': if (player.type === 'gojo') handleAction('brainbreak'); break;
    case ' ': handleAction('domain'); break;
  }
  hideTips();
});
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
window.addEventListener('blur', () => { keys = {}; holdAttack = false; joy.x = joy.y = 0; });

canvas.addEventListener('pointerdown', e => {
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
function basicAttack(attacker, target){
  if (!attacker || !attacker.alive || attacker.stun > 0 || attacker.attackCd > 0) return;
  if (!target || !target.alive) return;
  const c = CFG[attacker.type];

  if (attacker.type === 'gojo'){
    let dmg = c.atkDmg;
    if (attacker.blueFist){
      if (attacker.ce < c.bfCost) return;
      attacker.ce -= c.bfCost;
      dmg *= c.bfMult;
    }
    const isBF = Math.random() < 0.12;
    if (isBF){
      dmg *= 2.5;
      attacker.ce = Math.min(attacker.maxCe*3, attacker.ce*3);
      addEffect({ type:'blackflash', x:target.x, y:target.y, t:0, life:0.55 });
      addEffect({ type:'text', x:attacker.x, y:attacker.y-60, t:0, life:1.1, text:'黑 闪！', color:'#ff3b3b', size:26 });
      G.shake = 20; G.flash = 0.45;
    }
    attacker.attackCd = c.atkCd;
    addEffect({ type:'punch', x:attacker.x, y:attacker.y, ang:attacker.facing, t:0, life:0.16 });

    const d = dist(attacker, target);
    if (d <= attacker.r + target.r + c.atkRange){
      damage(target, dmg);
      const ang = Math.atan2(target.y-attacker.y, target.x-attacker.x);
      let kb = isBF ? 26 : 12;
      if (attacker.blueFist) kb *= c.blueFistKb;
      target.x = clamp(target.x + Math.cos(ang)*kb, target.r, WORLD.w-target.r);
      target.y = clamp(target.y + Math.sin(ang)*kb, target.r, WORLD.h-target.r);
      addEffect({ type:'ring', x:target.x, y:target.y, t:0, life:0.25,
        r0:6, r1:isBF?70:38, color:isBF?'#ff4444':'#9fd8ff', width:isBF?6:3 });
    }
  } else {
    attacker.attackCd = c.atkCd;
    const ang = Math.atan2(target.y-attacker.y, target.x-attacker.x);
    attacker.facing = ang;
    const col = attacker.type === 'sukunaTs' ? '#c9a4ff' : '#ff6b8a';
    projectiles.push({
      type:'slash', owner:attacker,
      x:attacker.x+Math.cos(ang)*30, y:attacker.y+Math.sin(ang)*30,
      vx:Math.cos(ang)*c.slashSpeed, vy:Math.sin(ang)*c.slashSpeed,
      r:14, life:1.2, damage:c.slashDmg, rot:ang, color:col,
    });
    addEffect({ type:'punch', x:attacker.x, y:attacker.y, ang, t:0, life:0.16 });
  }
}

function castReverse(f){
  if (!f || !f.alive || f.stun > 0) return;
  const c = CFG[f.type];
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
function gojoBlue(gojo, target){
  const c = CFG.gojo;
  if (!gojo.alive || gojo.stun > 0 || gojo.cd.blue > 0 || gojo.ce < c.blueCost) return;
  gojo.ce -= c.blueCost;
  gojo.cd.blue = c.blueCd;
  gojo.blueUsed = true;
  const ang = Math.atan2(target.y-gojo.y, target.x-gojo.x);
  projectiles.push({
    type:'blue', owner:gojo,
    x:gojo.x+Math.cos(ang)*32, y:gojo.y+Math.sin(ang)*32,
    vx:Math.cos(ang)*520, vy:Math.sin(ang)*520,
    r:20, life:3.0, maxLife:3.0, age:0,
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
  const ang = Math.atan2(target.y-gojo.y, target.x-gojo.x);
  projectiles.push({
    type:'red', owner:gojo,
    x:gojo.x+Math.cos(ang)*34, y:gojo.y+Math.sin(ang)*34,
    vx:Math.cos(ang)*820, vy:Math.sin(ang)*820,
    r:30, life:1.2, damage:c.redDmg,
  });
  addEffect({ type:'ring', x:gojo.x, y:gojo.y, t:0, life:0.35, r0:8, r1:70, color:'#ff4a4a', width:4 });
}

function gojoPurple(gojo, target){
  const c = CFG.gojo;
  if (!gojo.alive || gojo.stun > 0 || gojo.cd.purple > 0 || gojo.ce < c.purpleCost) return;
  if (!gojo.blueUsed || !gojo.redUsed) return;
  gojo.ce -= c.purpleCost;
  gojo.cd.purple = c.purpleCd;
  gojo.blueUsed = false;
  gojo.redUsed = false;
  const ang = Math.atan2(target.y-gojo.y, target.x-gojo.x);
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
  const ang = Math.atan2(target.y-s.y, target.x-s.x);
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
  const ang = Math.atan2(target.y-s.y, target.x-s.x);
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
  const ang = Math.atan2(target.y-s.y, target.x-s.x);
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
      damage: c.dogDmg,
      hitCd: 0,
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
  s.ce -= c.mahoCost;
  s.cd.maho = c.mahoCd;
  const facing = finite(s.facing) ? s.facing : 0;
  summons.push({
    type: 'mahoraga',
    owner: s,
    x: s.x + Math.cos(facing) * 60,
    y: s.y + Math.sin(facing) * 60,
    r: 40,
    speed: 180,
    life: c.mahoDur,
    maxLife: c.mahoDur,
    damage: c.mahoDmg,
    hitCd: 0,
    attackInterval: 0.9,
    angle: facing,
  });
  addEffect({ type:'ring', x:s.x, y:s.y, t:0, life:0.9, r0:20, r1:220, color:'#a862ff', width:8 });
  addEffect({ type:'text', x:s.x, y:s.y-70, t:0, life:1.6, text:'布瑠部由良由良', color:'#c9a4ff', size:22 });
  addEffect({ type:'text', x:s.x, y:s.y-40, t:0, life:1.6, text:'魔虚罗 · 显现', color:'#a862ff', size:18 });
  G.shake = 24; G.flash = 0.5;
}

/* ══════════════════════════════════════════
   伤害
   ══════════════════════════════════════════ */
function damage(target, amount, silent){
  if (!target || !target.alive) return;
  let d = amount;
  if (target.type === 'gojo' && target.infinity) d *= (1 - CFG.gojo.infDR);
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

function endGame(result){
  G.state = result;
  setTimeout(() => {
    const t = document.getElementById('ov-title');
    const s = document.getElementById('ov-sub');
    if (!overlayEl || !t || !s) return;
    if (result === 'win'){
      t.textContent = '胜 利';
      t.style.color = '#9fd8ff';
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

  if (G.state !== 'playing') return;
  if (!player || !enemy) return;
  G.time += dt;

  updatePlayer(dt);
  updateAI(dt);
  updateProjectiles(dt);
  updateSummons(dt);
  updateDomains(dt);
  updateCamera();
  updateHUD();
  updateButtons();
}

function updateCamera(){
  if (!player) return;
  const vw = W/scale, vh = H/scale;
  const tx = player.x - vw/2;
  const ty = player.y - vh/2;
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
    p.x = clamp(p.x + mx*p.speed*dt, p.r, WORLD.w - p.r);
    p.y = clamp(p.y + my*p.speed*dt, p.r, WORLD.h - p.r);
  }

  if (enemy.alive) p.facing = Math.atan2(enemy.y-p.y, enemy.x-p.x);

  if (p.type === 'gojo' && p.infinity){
    p.ce -= c.infDrain*dt;
    if (p.ce <= 0){ p.ce = 0; p.infinity = false; }
  }

  p.ce = Math.min(p.maxCe*3, p.ce + c.ceRegen*dt);

  if (keys['j'] || holdAttack) basicAttack(p, enemy);
}

function updateAI(dt){
  const ai = enemy, target = player;
  if (!ai || !ai.alive) return;
  const c = CFG[ai.type];

  if (ai.hitFlash > 0) ai.hitFlash -= dt;
  if (ai.domainLock > 0) ai.domainLock -= dt;
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

  if ((ai.hp < ai.maxHp * c.reverseThreshold || ai.brainDamaged) &&
      ai.ce >= c.reverseCost && ai.cd.reverse <= 0){
    castReverse(ai);
  }

  const d = dist(ai, target);
  const ang = Math.atan2(target.y-ai.y, target.x-ai.x);
  ai.facing = ang;

  let mv = 0;
  if (d > 220) mv = 1;
  else if (d < 90) mv = -0.5;
  else mv = 0.3;

  const kbFactor = (Math.abs(ai.kbx) + Math.abs(ai.kby)) > 80 ? 0.15 : 1;
  ai.x = clamp(ai.x + Math.cos(ang)*ai.speed*mv*dt*kbFactor, ai.r, WORLD.w - ai.r);
  ai.y = clamp(ai.y + Math.sin(ang)*ai.speed*mv*dt*kbFactor, ai.r, WORLD.h - ai.r);

  if (ai.type === 'gojo') aiGojo(ai, target, d);
  else if (ai.type === 'sukuna') aiSukuna(ai, target, d);
  else aiSukunaTs(ai, target, d);

  if (player.domain && !enemy.domain && enemy.domainLock <= 0 && enemy.ce >= c.domainCost && !enemy.brainDamaged){
    enemy.cd.domain = 0;
    castDomain(enemy, player);
    addEffect({ type:'text', x:enemy.x, y:enemy.y-118, t:0, life:1.8,
      text: enemy.name + ' 同步展开领域！', color:'#ffb0b0', size:16 });
  }
}

function aiGojo(ai, target, d){
  const c = CFG.gojo;
  if (!ai.brainDamaged && ai.cd.domain > 8 && ai.hp > ai.maxHp * 0.6 &&
      ai.ce > 30 && Math.random() < 0.004) brainBreak(ai);
  if (!ai.infinity && d < 260 && ai.ce > 45) ai.infinity = true;
  if (ai.infinity && ai.ce < 12) ai.infinity = false;
  if (ai.cd.blue <= 0 && ai.ce >= c.blueCost && d > 100 && Math.random() < 0.6) gojoBlue(ai, target);
  if (ai.cd.red <= 0 && ai.ce >= c.redCost && d < 520 && d > 70 && Math.random() < 0.5) gojoRed(ai, target);
  if (ai.blueUsed && ai.redUsed && ai.cd.purple <= 0 && ai.ce >= c.purpleCost) gojoPurple(ai, target);
  if (!ai.blueFist && ai.ce > 60) ai.blueFist = true;
  if (ai.attackCd <= 0 && d < ai.r + target.r + c.atkRange + 12) basicAttack(ai, target);
  if (ai.cd.domain <= 0 && ai.ce >= c.domainCost && d < 420 && !ai.domain && !player.domain && !ai.brainDamaged) castDomain(ai, target);
}

function aiSukuna(ai, target, d){
  const c = CFG.sukuna;
  if (ai.attackCd <= 0 && d < 620){
    ai.attackCd = rnd(0.28, 0.44);
    const ang = Math.atan2(target.y-ai.y, target.x-ai.x);
    const spread = rnd(-0.14, 0.14);
    projectiles.push({
      type:'slash', owner:ai,
      x:ai.x+Math.cos(ang)*30, y:ai.y+Math.sin(ang)*30,
      vx:Math.cos(ang+spread)*c.slashSpeed, vy:Math.sin(ang+spread)*c.slashSpeed,
      r:14, life:1.2, damage:c.slashDmg, rot:ang, color:'#ff6b8a',
    });
  }
  if (ai.cd.fire <= 0 && d < 480 && ai.ce >= c.fireCost) sukunaFire(ai, target);
  if (ai.cd.dismantle <= 0 && ai.ce >= c.dismantleCost && d < 520 && d > 60){
    if (Math.random() < 0.55) sukunaDismantle(ai, target);
  }
  if (ai.cd.domain <= 0 && ai.ce >= c.domainCost && d < 430 && !ai.domain && !player.domain){
    castDomain(ai, target);
  }
}

function aiSukunaTs(ai, target, d){
  const c = CFG.sukunaTs;
  if (ai.attackCd <= 0 && d < 600){
    ai.attackCd = rnd(0.30, 0.46);
    const ang = Math.atan2(target.y-ai.y, target.x-ai.x);
    const spread = rnd(-0.14, 0.14);
    projectiles.push({
      type:'slash', owner:ai,
      x:ai.x+Math.cos(ang)*30, y:ai.y+Math.sin(ang)*30,
      vx:Math.cos(ang+spread)*c.slashSpeed, vy:Math.sin(ang+spread)*c.slashSpeed,
      r:14, life:1.2, damage:c.slashDmg, rot:ang, color:'#c9a4ff',
    });
  }
  if (ai.cd.nue <= 0 && ai.ce >= c.nueCost && d < 600 && Math.random() < 0.6) tsNue(ai, target);
  if (ai.cd.dog <= 0 && ai.ce >= c.dogCost && d < 480 && d > 80) tsDog(ai);
  if (ai.cd.maho <= 0 && ai.ce >= c.mahoCost && d < 520 && (ai.hp < ai.maxHp * 0.75 || Math.random() < 0.3)){
    tsMahoraga(ai);
  }
  if (ai.cd.domain <= 0 && ai.ce >= c.domainCost && d < 440 && !ai.domain && !player.domain){
    castDomain(ai, target);
  }
}

/* ══════════════════════════════════════════
   投射物
   ══════════════════════════════════════════ */
function updateProjectiles(dt){
  for (let i = projectiles.length-1; i >= 0; i--){
    const pr = projectiles[i];
    if (!pr){ projectiles.splice(i,1); continue; }
    pr.age = (pr.age || 0) + dt;
    pr.life -= dt;

    const owner = pr.owner;
    const target = owner === player ? enemy : player;

    /* 苍 */
    if (pr.type === 'blue'){
      if (pr.age > 0.42){
        const drag = Math.pow(0.06, dt);
        pr.vx *= drag; pr.vy *= drag;
      }
      pr.x += pr.vx*dt;
      pr.y += pr.vy*dt;

      if (owner && owner.alive && target && target.alive){
        const R = 400;
        const dd = Math.hypot(owner.x - target.x, owner.y - target.y);
        if (dd < R && dd > 1){
          const a = Math.atan2(owner.y - target.y, owner.x - target.x);
          const strength = (1 - dd/R) * 1300;
          target.x = clamp(target.x + Math.cos(a)*strength*dt, target.r, WORLD.w - target.r);
          target.y = clamp(target.y + Math.sin(a)*strength*dt, target.r, WORLD.h - target.r);
        }
      }
      if (target && target.alive && Math.hypot(pr.x - target.x, pr.y - target.y) < pr.r + target.r + 6){
        pr.hitCd = (pr.hitCd || 0) - dt;
        if (pr.hitCd <= 0){ pr.hitCd = 0.45; damage(target, pr.damage); }
      }
      if (pr.life <= 0){
        addEffect({ type:'ring', x:pr.x, y:pr.y, t:0, life:0.35, r0:6, r1:60, color:'#5ab8ff', width:3 });
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
      if (target && target.alive && dist(pr, target) < pr.r + target.r){
        damage(target, pr.damage);
        addEffect({ type:'ring', x:pr.x, y:pr.y, t:0, life:0.5, r0:8, r1:110, color:'#c9a4ff', width:5 });
        for (let k=0;k<12;k++){
          addEffect({ type:'spark', x:pr.x, y:pr.y, t:0, life:rnd(.25,.55),
            vx:Math.cos(rnd(0,TAU))*rnd(80,340), vy:Math.sin(rnd(0,TAU))*rnd(80,340),
            color:'#d0aaff', size:rnd(2,5) });
        }
        projectiles.splice(i,1);
        continue;
      }
      continue;
    }

    /* 其他直线飞行 */
    pr.x += pr.vx*dt;
    pr.y += pr.vy*dt;
    pr.rot = (pr.rot||0) + dt*8;

    if (Math.random() < 0.7){
      const col = pr.color ||
        (pr.type==='red' ? '#ff5a5a'
        : pr.type==='purple' ? '#c07bff'
        : pr.type==='fire' ? '#ff9a3d'
        : pr.type==='dismantle' ? '#c07bff' : '#ff6b8a');
      addEffect({ type:'spark', x:pr.x, y:pr.y, t:0, life:0.28,
        vx:rnd(-40,40), vy:rnd(-40,40), color:col,
        size: pr.type==='purple'||pr.type==='dismantle' ? 5 : 3 });
    }

    if (pr.life <= 0 || pr.x < -200 || pr.x > WORLD.w+200 || pr.y < -200 || pr.y > WORLD.h+200){
      projectiles.splice(i,1);
      continue;
    }

    if (target && target.alive && dist(pr, target) < pr.r + target.r){
      damage(target, pr.damage);
      const a = Math.atan2(target.y - pr.y, target.x - pr.x);

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
      } else {
        const kb = pr.type==='purple' ? 60 : pr.type==='dismantle' ? 30 : 18;
        target.x = clamp(target.x + Math.cos(a)*kb, target.r, WORLD.w-target.r);
        target.y = clamp(target.y + Math.sin(a)*kb, target.r, WORLD.h-target.r);
      }

      const col = pr.color ||
        (pr.type==='red' ? '#ff5a5a'
        : pr.type==='purple' ? '#c07bff'
        : pr.type==='fire' ? '#ff9a3d'
        : pr.type==='dismantle' ? '#c07bff' : '#ff6b8a');
      addEffect({ type:'ring', x:pr.x, y:pr.y, t:0, life:0.4,
        r0:6, r1: pr.r*(pr.type==='purple'?3.4:2.2), color:col, width:4 });
      for (let k=0;k<8;k++){
        addEffect({ type:'spark', x:pr.x, y:pr.y, t:0, life:rnd(.2,.5),
          vx:Math.cos(rnd(0,TAU))*rnd(60,320), vy:Math.sin(rnd(0,TAU))*rnd(60,320),
          color:col, size:rnd(2,5) });
      }
      if (pr.type === 'purple' || pr.type === 'dismantle') G.shake = Math.max(G.shake, 18);
      if (!pr.pierce) projectiles.splice(i,1);
      continue;
    }
  }
}

/* ══════════════════════════════════════════
   式神 —— 重写为极简、安全版本
   ══════════════════════════════════════════ */
function updateSummons(dt){
  for (let i = summons.length - 1; i >= 0; i--){
    const s = summons[i];
    if (!s || !finite(s.x) || !finite(s.y) || !finite(s.life)){
      summons.splice(i, 1);
      continue;
    }

    s.life -= dt;

    if (s.life <= 0 || !s.owner || !s.owner.alive){
      if (finite(s.x) && finite(s.y)){
        addEffect({ type:'ring', x:s.x, y:s.y, t:0, life:0.4,
          r0:4, r1:(s.r||16)*2.4,
          color: s.type === 'dog' ? '#ff8a3d' : '#a862ff', width:3 });
      }
      summons.splice(i, 1);
      continue;
    }

    const target = s.owner === player ? enemy : player;
    if (!target || !target.alive) continue;
    if (!finite(target.x) || !finite(target.y)) continue;

    const ang = Math.atan2(target.y - s.y, target.x - s.x);
    if (!finite(ang)){ summons.splice(i, 1); continue; }
    s.angle = ang;

    const step = (s.speed || 200) * dt;
    s.x += Math.cos(ang) * step;
    s.y += Math.sin(ang) * step;

    if (dist(s, target) < (s.r||16) + target.r){
      s.hitCd = (s.hitCd || 0) - dt;
      if (s.hitCd <= 0){
        s.hitCd = s.attackInterval || 0.5;
        damage(target, s.damage || 20);

        const col = s.type === 'dog' ? '#ff8a3d' : '#a862ff';
        addEffect({ type:'ring', x:target.x, y:target.y, t:0, life:0.3,
          r0:6, r1:(s.r||16)*2.2, color:col, width:3.5 });
        const cnt = s.type === 'mahoraga' ? 10 : 4;
        for (let k = 0; k < cnt; k++){
          addEffect({ type:'spark', x:target.x, y:target.y, t:0, life:rnd(.2,.45),
            vx:Math.cos(rnd(0,TAU))*rnd(80,280), vy:Math.sin(rnd(0,TAU))*rnd(80,280),
            color:col, size:rnd(2,4) });
        }
      }
    }
  }
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
  if (both){ checkDomainBreak(player); checkDomainBreak(enemy); }
}

function applyDomainEffect(owner, target, dt){
  if (!owner || !owner.domain || !target || !target.alive) return;
  const d = owner.domain;
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
  } else {
    /* 伏魔御厨子（含十影宿傩）：持续伤害，按 CFG.domainDps 决定强度 */
    const c = CFG[d.type];
    const dps = (c && finite(c.domainDps)) ? c.domainDps : 34;
    damage(target, dps * dt, true);
    if (Math.random() < 0.4){
      addEffect({ type:'spark', x:target.x+rnd(-40,40), y:target.y+rnd(-40,40), t:0, life:0.3,
        vx:rnd(-80,80), vy:rnd(-80,80),
        color: d.type === 'sukunaTs' ? '#c07bff' : '#ff4a4a', size:3 });
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
  ctx.fillStyle = '#04060b';
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

  drawClashBanner();
}

function drawWorld(){
  ctx.fillStyle = '#080c16';
  ctx.fillRect(0,0,WORLD.w,WORLD.h);
  ctx.strokeStyle = 'rgba(70,110,170,0.10)';
  ctx.lineWidth = 1;
  const gs = 100;
  ctx.beginPath();
  for (let x = 0; x <= WORLD.w; x += gs){ ctx.moveTo(x,0); ctx.lineTo(x,WORLD.h); }
  for (let y = 0; y <= WORLD.h; y += gs){ ctx.moveTo(0,y); ctx.lineTo(WORLD.w,y); }
  ctx.stroke();
  ctx.save();
  ctx.translate(WORLD.w/2, WORLD.h/2);
  ctx.rotate(G.time*0.06);
  ctx.strokeStyle = 'rgba(90,140,220,0.10)';
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
  ctx.strokeStyle = 'rgba(90,150,240,0.35)';
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
    else if (s.type === 'mahoraga'){
      const R = s.r;
      ctx.save();
      ctx.translate(s.x, s.y);

      // 影子
      ctx.beginPath();
      ctx.arc(0, R * 0.8, R * 1.1, 0, TAU);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fill();

      // 头顶法轮
      ctx.save();
      ctx.translate(0, -R * 1.55);
      ctx.rotate(G.time * 1.8);
      ctx.strokeStyle = 'rgba(200,140,255,0.85)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, R * 0.85, 0, TAU); ctx.stroke();
      for (let i = 0; i < 8; i++){
        const a = i / 8 * TAU;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * R * 0.85, Math.sin(a) * R * 0.85);
        ctx.lineTo(Math.cos(a) * R * 1.05, Math.sin(a) * R * 1.05);
        ctx.stroke();
      }
      ctx.restore();

      // 身体
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, TAU);
      const g = ctx.createRadialGradient(-R*0.3, -R*0.3, 2, 0, 0, R);
      g.addColorStop(0, '#5a2a8a');
      g.addColorStop(0.55, '#2a0848');
      g.addColorStop(1, '#0a0118');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = 'rgba(200,140,255,0.9)';
      ctx.lineWidth = 3;
      ctx.stroke();

      // 内纹
      ctx.save();
      ctx.rotate(G.time * 0.6);
      ctx.strokeStyle = 'rgba(200,150,255,0.5)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++){
        const a = i / 4 * TAU;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * R * 0.25, Math.sin(a) * R * 0.25);
        ctx.lineTo(Math.cos(a) * R * 0.9, Math.sin(a) * R * 0.9);
        ctx.stroke();
      }
      ctx.restore();

      // 眼睛（无 shadowBlur）
      const angle = finite(s.angle) ? s.angle : 0;
      ctx.save();
      ctx.rotate(angle);
      ctx.fillStyle = '#e0b0ff';
      ctx.beginPath(); ctx.arc(R * 0.35, -R * 0.28, 4, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(R * 0.35,  R * 0.28, 4, 0, TAU); ctx.fill();
      ctx.restore();

      // 剩余时间环
      const ratio = clamp(s.life / s.maxLife, 0, 1);
      if (ratio > 0 && ratio <= 1){
        ctx.beginPath();
        ctx.arc(0, 0, R + 8, -Math.PI/2, -Math.PI/2 + TAU * ratio);
        ctx.strokeStyle = 'rgba(200,140,255,0.8)';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}

function drawProjectiles(){
  for (const pr of projectiles){
    ctx.save();
    ctx.translate(pr.x, pr.y);

    if (pr.type === 'blue'){
      if (pr.owner && pr.owner.alive){
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
      g.addColorStop(0,'#ffffff');
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
    ctx.restore();
  }
}

/* ══════════════════════════════════════════
   绘制角色
   ══════════════════════════════════════════ */
function drawFighter(f){
  if (f.type === 'gojo') drawGojo(f);
  else if (f.type === 'sukunaTs') drawSukunaTs(f);
  else drawSukuna(f);
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
      ctx.strokeStyle = `rgba(180,230,255,${a*0.9})`;
      ctx.lineWidth = 7*(1-k);
      ctx.stroke();
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
  const pMax = player.maxCe * 3;
  if (el.pce) el.pce.style.transform = `scaleX(${clamp(player.ce/pMax,0,1)})`;
  if (el.pcet) el.pcet.textContent = `${Math.floor(player.ce)} / ${pMax}`;

  if (el.shp) el.shp.style.transform = `scaleX(${clamp(enemy.hp/enemy.maxHp,0,1)})`;
  if (el.shpt) el.shpt.textContent = `${Math.ceil(enemy.hp)} / ${enemy.maxHp}`;
  const eMax = enemy.maxCe;
  if (el.sce) el.sce.style.transform = `scaleX(${clamp(enemy.ce/eMax,0,1)})`;
  if (el.scet) el.scet.textContent = `${Math.floor(enemy.ce)} / ${eMax}`;
}

function updateButtons(){
  if (!player || !btns) return;
  const p = player;
  if (btns.infinity) btns.infinity.classList.toggle('on', p.infinity);
  if (btns.bluefist) btns.bluefist.classList.toggle('on', p.blueFist);

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
  } else {
    const c = CFG.sukunaTs;
    setCool('nue', p.cd.nue > 0, p.ce < c.nueCost);
    setCool('dog', p.cd.dog > 0, p.ce < c.dogCost);
    setCool('mahoraga', p.cd.maho > 0, p.ce < c.mahoCost);
    setCool('reverse', p.cd.reverse > 0 || p.hp >= p.maxHp, p.ce < c.reverseCost);
    setCool('domain', p.cd.domain > 0 || !!p.domain, p.ce < c.domainCost);
    if (btns.mahoraga)
      btns.mahoraga.classList.toggle('ready', p.cd.maho <= 0 && p.ce >= c.mahoCost);
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