// main.js - menu, fighter select, fullscreen, refresh
// ---- CHARACTERS come from characters/<id>/info.js (see characters/README.md). Add img:'path.png' there for sprites. ----
const CHARACTERS = Characters.list;
// Opponent AI options: sparring = no win/loss
const AI = [
  {key:'sparring', label:'DUMMY',    sub:'stands still'},
  {key:'Easy',     label:'EASY',     sub:'slow bot'},
  {key:'Normal',   label:'NORMAL',   sub:'fair fight'},
  {key:'Hard',     label:'HARD',     sub:'no mercy'}
];

// ---- STATE ----
const state = {player:null, enemy:null, ai:'Normal', slot:'player', size:1};   // size = team size: 1 (1v1), 2 (2v2), 3 (3v3)

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const charById = id => Characters.get(id);

function show(id){
  if(id !== 'game') stopGame();
  document.body.classList.toggle('ingame', id === 'game');
  $$('.screen').forEach(s => s.classList.toggle('active', s.id === id));
  if(id === 'select') render();
}

function art(c){ return c.img ? `<img src="${c.img}" alt="${c.name}">` : c.name[0]; }

function paint(n, id, animate){
  const c = id ? charById(id) : null;
  const fig = $('#fig'+n);
  if(c){
    fig.style.background = c.img ? 'none' : `linear-gradient(160deg, ${c.color}, ${c.color}77)`;
    fig.className = 'fig'; fig.innerHTML = art(c);
    $('#n'+n).textContent = c.name;
    $('#tg'+n).textContent = c.tag;
    $('#st'+n).textContent = `HP ${c.hp} | ARM ${c.arm} | SPD ${c.spd}`;
    $('#ult'+n).textContent = 'ULT: ' + c.ult;
    if(animate){ void fig.offsetWidth; fig.classList.add('swap'); }
  }else{
    fig.style.background = 'none'; fig.className = 'fig'; fig.innerHTML = '<span class="q">?</span>';
    ['n','tg','st','ult'].forEach(k => $('#'+k+n).textContent = '');
  }
  if(n === 2) $('#h2').classList.toggle('hide', !!c);
}

function render(animate){
  $('#t3').textContent = state.size > 1 ? `${state.size}v${state.size}: your bot allies and the extra opponents are picked at random` : 'select a hero, then press CONFIRM (or ENTER)';
  $('#t2').textContent = state.slot === 'player' ? 'PICK YOUR FIGHTER - THEN CONFIRM' : 'PICK YOUR OPPONENT - THEN CONFIRM';
  $('#pv1').classList.toggle('on', state.slot === 'player');
  $('#pv2').classList.toggle('on', state.slot === 'enemy');
  paint(1, state.player, animate === 'player');
  paint(2, state.enemy, animate === 'enemy');
  $$('#grid .tile').forEach(t => {
    t.classList.toggle('s1', t.dataset.id === state.player);
    t.classList.toggle('s2', t.dataset.id === state.enemy);
  });
  $$('#mrow button').forEach(b => b.classList.toggle('sel', b.dataset.key === state.ai));
  $('#confirm').disabled = !(state.player && state.enemy);
}

let shuffling = false;
function pick(slot, id, animate){
  state[slot] = id;
  if(slot === 'player') state.slot = 'enemy';   // jump to opponent pick
  render(animate);
}
function randomPick(){
  if(shuffling) return;
  shuffling = true;
  const slot = state.slot;
  const final = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)].id;
  let n = 0;
  const t = setInterval(() => {
    n++;
    if(n >= 9){
      clearInterval(t); shuffling = false;
      pick(slot, final, slot);
    }else{
      state[slot] = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)].id;
      render(slot);
    }
  }, 70);
}

function buildGrid(){
  const g = $('#grid'); g.innerHTML = '';
  const r = document.createElement('button');
  r.className = 'tile rnd';
  r.innerHTML = `<span class="no">0</span><div class="av">?</div><b>RANDOM</b>`;
  r.onclick = randomPick;
  g.appendChild(r);
  CHARACTERS.forEach((c, i) => {
    const b = document.createElement('button');
    b.className = 'tile'; b.dataset.id = c.id;
    b.innerHTML = `<span class="no">${i+1}</span><div class="av" style="background:${c.img ? 'none' : c.color}">${art(c)}</div><b>${c.name}</b><span class="tag a">P1</span><span class="tag b">P2</span>`;
    b.onclick = () => {
      const slot = state.slot;
      state[slot] = c.id;
      if(slot === 'player') state.slot = 'enemy';   // jump to opponent pick
      render(slot);
    };
    g.appendChild(b);
  });
}

function buildModes(){
  const r = $('#mrow'); r.innerHTML = '';
  AI.forEach(a => {
    const b = document.createElement('button');
    b.dataset.key = a.key;
    b.innerHTML = `${a.label}<small>${a.sub}</small>`;
    b.onclick = () => { state.ai = a.key; render(); };
    r.appendChild(b);
  });
}

// ---- GAME ENTRY POINT ----
function randomFighters(n, taken){   // n random fighters, no repeats while the roster lasts
  const pool = CHARACTERS.filter(c => !taken.includes(c.id)), out = [];
  while(out.length < n){
    if(!pool.length) pool.push(...CHARACTERS);
    out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  out.forEach(c => taken.push(c.id));
  return out;
}
function confirm(){
  if(!(state.player && state.enemy)) return;
  const sparring = state.ai === 'sparring', n = state.size, taken = [state.player, state.enemy];
  startMatch({
    mode: sparring ? 'sparring' : 'ai',
    difficulty: sparring ? null : state.ai,
    size: n,                                           // team size: you + (n-1) bot allies vs n bots
    player: charById(state.player),
    enemy: charById(state.enemy),
    allies: randomFighters(n - 1, taken),              // your bot teammates
    foes: randomFighters(n - 1, taken)                 // the opponent's bot teammates
  });
}

// ---- FULLSCREEN (needs a user tap; browsers block it on load) ----
const fsEl = document.documentElement;
const fsReq = fsEl.requestFullscreen || fsEl.webkitRequestFullscreen;
const fsExit = document.exitFullscreen || document.webkitExitFullscreen;
const isFs = () => !!(document.fullscreenElement || document.webkitFullscreenElement);

function enterFullscreen(){
  if(!fsReq || isFs()) return;
  try{
    Promise.resolve(fsReq.call(fsEl))
      .then(() => { try{ screen.orientation.lock('landscape').catch(()=>{}); }catch(e){} })
      .catch(()=>{});
  }catch(e){}
}
function toggleFullscreen(){
  if(isFs()){
    try{ screen.orientation.unlock(); }catch(e){}
    try{ fsExit.call(document); }catch(e){}
  }else enterFullscreen();
}
// ---- TOAST (small notification banner) ----
let toastEl = null, toastTimer = 0;
function showToast(msg){
  if(!toastEl){
    toastEl = document.createElement('div');
    toastEl.id = 'toast';
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = msg;
  toastEl.classList.remove('show');
  void toastEl.offsetWidth;                 // restart the animation if one is already showing
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
}
// ---- SYSTEM NOTIFICATION (shows in the phone's notification bar) ----
let swReg = null;
function registerSW(){
  if(!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').then(r => { swReg = r; }).catch(()=>{});
}
registerSW();
function askNotifPermission(){            // must run from a tap, browsers block it otherwise
  try{ if('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); }catch(e){}
}
async function sysNotify(title, body){
  try{
    if(!('Notification' in window)){ showToast('Notifications not supported here'); return; }
    if(!window.isSecureContext){ showToast('Notifications need https'); return; }
    if(Notification.permission === 'default'){ try{ await Notification.requestPermission(); }catch(e){} }
    if(Notification.permission !== 'granted'){ showToast('Notifications blocked - allow them in site settings'); return; }
    if('serviceWorker' in navigator){
      const reg = await Promise.race([navigator.serviceWorker.ready, new Promise((_, rej) => setTimeout(rej, 4000))]);
      await reg.showNotification(title, {body, tag:'vanta-fs'});
    }else new Notification(title, {body, tag:'vanta-fs'});
  }catch(e){ showToast('Notification failed: ' + (e && e.message ? e.message : 'service worker not ready')); }
}
let wasFs = false;
function syncFsBtn(){
  const now = isFs();
  $('#fsBtn').innerHTML = now ? '&#10005; EXIT FS' : '&#9974; FULLSCREEN';
  if(now !== wasFs){
    const msg = now ? 'Fullscreen on' : 'Fullscreen off';
    showToast(msg);
    sysNotify('VANTA CORE', msg);
    wasFs = now;
  }
}
document.addEventListener('fullscreenchange', syncFsBtn);
document.addEventListener('webkitfullscreenchange', syncFsBtn);
if(!fsReq) $('#fsBtn').classList.add('hide');   // e.g. iPhone Safari has no fullscreen API
$('#fsBtn').onclick = () => { askNotifPermission(); toggleFullscreen(); };
// also try once on the first tap anywhere (skipped if the tap is on the fullscreen button)
document.addEventListener('pointerdown', e => { if(!e.target.closest('#fsBtn')){ askNotifPermission(); enterFullscreen(); } }, {once:true});

// ---- VERSION LABEL (bump this each time you push, so you can tell the new code loaded) ----
const APP_VERSION = 'v1.3 notif';
(function(){
  const host = document.querySelector('#menu .menu');
  if(!host) return;
  const v = document.createElement('div');
  v.id = 'ver';
  v.textContent = APP_VERSION;
  host.appendChild(v);
})();

// ---- HARD REFRESH ----
async function hardRefresh(){
  try{
    if('serviceWorker' in navigator){
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
    if(window.caches){
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
  }catch(e){}
  try{
    const u = new URL(location.href);
    u.searchParams.set('_r', Date.now());
    location.replace(u.toString());
  }catch(e){ location.reload(); }
}

// ---- EVENTS ----
$$('[data-go]').forEach(b => b.onclick = () => show(b.dataset.go));
$$('[data-size]').forEach(b => b.onclick = () => { state.size = +b.dataset.size; show('select'); });
$('#refreshBtn').onclick = hardRefresh;
$$('.pv').forEach(p => p.onclick = () => { state.slot = p.dataset.slot; render(); });
$('#confirm').onclick = confirm;
$('#quitBtn').onclick = () => show('menu');
$('#pSelBtn').onclick = () => show('select');
$('#btnHow').onclick = () => $('#howBox').classList.remove('hide');
$('#howClose').onclick = () => $('#howBox').classList.add('hide');
document.addEventListener('keydown', e => {
  if(e.key === 'Enter' && $('#select').classList.contains('active')) confirm();
});

buildGrid();
buildModes();
render();