// controller.js - input only (keyboard + joystick + attack). The arena just reads Ctl.
// Skills: Ctl.sk[i] = a queued cast {ax, ay, drag} for skill slot i (0,1 = skills I, II, 2 = ultimate). ax/ay = aim direction (-1..1), drag = false for a tap.
// Aiming a held attack (Caliber's Deadeye Sniper): Ctl.up / Ctl.dn = W S / arrow keys held, Ctl.sx / Ctl.sy = joystick position (-1..1), Ctl.atkV = vector of a drag on the ATK button (null = not dragging).
// Ctl.skAim[i] = this slot is an AIMED skill (the arena sets it per match). Ctl.aim = the aim being dragged right now (arena draws the preview line).
const Ctl = {
  l:0, r:0, up:0, dn:0, sx:0, sy:0, atkV:null, jump:false, drop:false, atk:false, held:false, on:false, sk:[null, null, null], skAim:[false, false, false], aim:null,
  reset(){ this.l = this.r = this.up = this.dn = this.sx = this.sy = 0; this.atkV = null; this.jump = this.drop = this.atk = this.held = false; this.sk = [null, null, null]; this.aim = null; endStick(); cancelOff(); }
};

addEventListener('keydown', e => {
  if(!Ctl.on || e.repeat) return;
  const k = e.key.toLowerCase();
  if(k === 'arrowleft' || k === 'a') Ctl.l = 1;
  else if(k === 'arrowright' || k === 'd') Ctl.r = 1;
  else if(k === 'arrowup' || k === 'w' || k === ' '){ Ctl.jump = true; if(k !== ' ') Ctl.up = 1; e.preventDefault(); }
  else if(k === 'arrowdown' || k === 's'){ Ctl.drop = true; Ctl.dn = 1; e.preventDefault(); }
  else if(k === 'j' || k === 'f' || k === 'k' || k === 'z'){ Ctl.atk = true; Ctl.held = true; }
  else if(k === '1' || k === '2' || k === '3') Ctl.sk[+k - 1] = {ax:0, ay:0, drag:false};   // keyboard: cast straight ahead (no aiming)
});
addEventListener('keyup', e => {
  const k = e.key.toLowerCase();
  if(k === 'arrowleft' || k === 'a') Ctl.l = 0;
  else if(k === 'arrowright' || k === 'd') Ctl.r = 0;
  else if(k === 'arrowup' || k === 'w') Ctl.up = 0;
  else if(k === 'arrowdown' || k === 's') Ctl.dn = 0;
  else if(k === 'j' || k === 'f' || k === 'k' || k === 'z') Ctl.held = false;   // ATK released (ends a charge)
});
addEventListener('blur', () => { Ctl.l = Ctl.r = Ctl.up = Ctl.dn = 0; Ctl.atkV = null; Ctl.held = false; Ctl.aim = null; cancelOff(); });

// joystick: left/right = move, flick DOWN = drop through. JUMP and ATK are separate buttons (tap JUMP again = double jump).
const stick = document.getElementById('stick'), knob = document.getElementById('knob'),
      atkBtn = document.getElementById('atkBtn'), jumpBtn = document.getElementById('jumpBtn');
let sid = null, dnLatch = false;

function setStick(e){
  const r = stick.getBoundingClientRect(), R = r.width / 2;
  let dx = (e.clientX - (r.left + R)) / R, dy = (e.clientY - (r.top + R)) / R;
  const m = Math.hypot(dx, dy); if(m > 1){ dx /= m; dy /= m; }
  knob.style.transform = `translate(-50%,-50%) translate(${dx * R * .6}px,${dy * R * .6}px)`;
  Ctl.l = dx < -.3 ? 1 : 0; Ctl.r = dx > .3 ? 1 : 0; Ctl.sx = dx; Ctl.sy = dy;   // sx / sy = raw stick position (used to aim a held attack)
  if(dy > .6){ if(!dnLatch){ Ctl.drop = true; dnLatch = true; } } else if(dy < .3) dnLatch = false;
}
function endStick(){
  sid = null; dnLatch = false;
  Ctl.l = Ctl.r = Ctl.sx = Ctl.sy = 0;
  knob.style.transform = 'translate(-50%,-50%)';
}
stick.addEventListener('pointerdown', e => { e.preventDefault(); sid = e.pointerId; stick.setPointerCapture(sid); setStick(e); });
stick.addEventListener('pointermove', e => { if(e.pointerId === sid) setStick(e); });
['pointerup', 'pointercancel'].forEach(t => stick.addEventListener(t, e => { if(e.pointerId === sid) endStick(); }));
let atkPid = null, atkX = 0, atkY = 0;   // drag on the ATK button = aim direction for a held attack (a tap / plain hold sends nothing)
atkBtn.addEventListener('pointerdown', e => { e.preventDefault(); Ctl.atk = true; Ctl.held = true; atkPid = e.pointerId; atkX = e.clientX; atkY = e.clientY; try{ atkBtn.setPointerCapture(e.pointerId); }catch(_){} });
atkBtn.addEventListener('pointermove', e => {
  if(e.pointerId !== atkPid) return;
  const dx = e.clientX - atkX, dy = e.clientY - atkY, m = Math.hypot(dx, dy);
  Ctl.atkV = m > 16 ? {x:dx / m, y:dy / m} : null;
});
['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => atkBtn.addEventListener(t, () => { Ctl.held = false; Ctl.atkV = null; atkPid = null; }));   // hold ATK = charge, let go = release
jumpBtn.addEventListener('pointerdown', e => { e.preventDefault(); Ctl.jump = true; });

// skill buttons I / II / III. AIMED skill: press + drag like a joystick (the arena shows the aim line), release = cast that way. A quick tap = cast straight ahead.
// Skills that do not aim (the ultimate) cast the moment you press.
const skBtns = [1, 2, 3].map(n => document.getElementById('sk' + n + 'Btn'));
// CANCEL ZONE (a box under the enemy HP bar): while you drag an aimed skill it shows up; let go ON it = the skill is cancelled (nothing is cast, no cooldown used).
const cz = document.getElementById('cancelZone');
function cancelOff(){ cz.classList.remove('show', 'on'); }
function inCancel(e){ const r = cz.getBoundingClientRect(), p = 10; return e.clientX >= r.left - p && e.clientX <= r.right + p && e.clientY >= r.top - p && e.clientY <= r.bottom + p; }
const AIM_DEAD = 14;   // px you must drag before it counts as aiming (smaller drag = a tap)
skBtns.forEach((b, i) => {
  let pid = null, sx = 0, sy = 0;
  const vec = e => { const dx = e.clientX - sx, dy = e.clientY - sy, m = Math.hypot(dx, dy); return m > AIM_DEAD ? {ax:dx / m, ay:dy / m, m:Math.min(1, m / 120), drag:true} : {ax:0, ay:0, drag:false}; };   // m = how far you dragged (0..1), used by ground-targeted skills
  b.addEventListener('pointerdown', e => {
    e.preventDefault();
    if(!Ctl.on || b.classList.contains('none')) return;
    pid = e.pointerId; sx = e.clientX; sy = e.clientY;
    try{ b.setPointerCapture(pid); }catch(_){}
    if(Ctl.skAim[i]){ Ctl.aim = {i, ax:0, ay:0, drag:false}; cz.classList.add('show'); }
    else Ctl.sk[i] = {ax:0, ay:0, drag:false};
  });
  b.addEventListener('pointermove', e => {
    if(e.pointerId !== pid || !Ctl.skAim[i]) return;
    const over = inCancel(e);
    if(over && !cz.classList.contains('on') && navigator.vibrate) navigator.vibrate(12);
    cz.classList.toggle('on', over);
    Ctl.aim = {i, ...vec(e), cancel:over};
  });
  const end = (e, cast) => {
    if(e.pointerId !== pid) return; pid = null;
    if(cast && Ctl.on && Ctl.skAim[i] && Ctl.aim && Ctl.aim.i === i && !inCancel(e)) Ctl.sk[i] = vec(e);   // released on the cancel zone = no cast
    cancelOff();
    if(Ctl.aim && Ctl.aim.i === i) Ctl.aim = null;
  };
  b.addEventListener('pointerup', e => end(e, true));
  b.addEventListener('pointercancel', e => end(e, false));
});
[stick, atkBtn, jumpBtn, ...skBtns].forEach(el => el.addEventListener('contextmenu', e => e.preventDefault()));