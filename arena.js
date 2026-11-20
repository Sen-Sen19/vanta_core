// arena.js - platform arena: map, fighters, physics, bot AI, drawing. Reads input from Ctl (controller.js).
// ---- ARENA ----
// World size. Smaller world = everything looks bigger on screen (fighters stay the same size in the world).
// Was 1280x720. 880x495 = about 1.45x bigger. Want bigger still? Lower both (keep 16:9). Smaller = bigger on screen.
const W = 880, H = 495, GRAV = 2300;
const cv = $('#cv'), cx = cv.getContext('2d');
let G = null, raf = 0;
const view = {s:1, ox:0, oy:0, w:0, h:0, dpr:1};
const LV = {Easy:{r:.45, atk:.25, chase:.6, jump:.2}, Normal:{r:.25, atk:.5, chase:.85, jump:.4}, Hard:{r:.12, atk:.8, chase:1, jump:.6}};
const approach = (v, t, a) => v < t ? Math.min(v + a, t) : Math.max(v - a, t);

function fit(){
  const r = cv.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 1.5);   // cap the pixel ratio: phones report 3+ = 4x the pixels to draw = lag
  cv.width = Math.max(1, r.width * d); cv.height = Math.max(1, r.height * d);
  view.w = r.width; view.h = r.height; view.dpr = d;
  view.s = Math.min(r.width / W, r.height / H);
  view.ox = (r.width - W * view.s) / 2; view.oy = (r.height - H * view.s) / 2;
}

// random floating platforms: one main island + up to 4 random jump-on platforms
function makeMap(){
  const P = [{x:W/2 - 240, y:Math.round(H * .68), w:480, h:20, main:1}];
  for(let t = 0; P.length < 5 && t < 200; t++){
    // 85-210 px above the main island = reachable with a jump / double jump
    const w = 110 + Math.random() * 110, x = 60 + Math.random() * (W - 120 - w), y = P[0].y - 85 - Math.random() * 125;
    if(P.every(q => x + w + 50 < q.x || x > q.x + q.w + 50 || Math.abs(y - q.y) > 85)) P.push({x, y, w, h:16});
  }
  return P;
}

function mkF(c, idx, team = idx ? 1 : 0){   // idx = index in G.f (unique), team 0 = your side, team 1 = the other side
  const K = Characters.skillsOf(c.id);   // K.skills = [skill I, skill II], K.ultimate, K.passive (see characters/titan/skills.js)
  return {c, idx, K, A:K.basic,
    sk:K.skills.map(d => ({cd:Array(d.charges || 1).fill(0)})),   // skill cooldowns: one timer per charge (each charge recharges on its own)
    uc:0, pn:0, pt:0, bar:0, mag:0, rl:0, rush:null, skq:null, hk:null, slaughter:null, shd:null, shadows:[], onsl:null, fr:0, hLast:0, dv:0, dvKey:null, atkTok:0, tA:null, tAtk:0, vclaw:null, uhand:null, afterimg:null, slam:null, kdT:0, kdDur:0, slowVoidT:0, capturedBy:null, mk:0, bl:0, blDps:0, bt:0, snipe:null, snCd:0, snLock:false, lob:null, mo:0, moT:0, mbT:0, ns:null, ge:null, fc:null, fl:null, rec:0, fs:0, fsRdy:false, fsKey:0, fsGain:0, frz:0, rootT:0, lowG:0, ice:null,                   // uc = ultimate cooldown, pn = passive hit count, pt = passive time left, bar = barrier HP, rush = charge in progress
    team, dead:false, tgt:null, cs:0, comboT:0, aqB:0, w:30, h:52, x:0, y:0, vx:0, vy:0, face: team ? -1 : 1, hp:c.hp, max:c.hp, stocks:3,
    jumps:2, gr:false, atk:0, atkCd:0, hitDone:true, stun:0, inv:0, drop:0, flash:0,
    jq:false, dq:false, aq:false, in:{l:0, r:0}, aiT:0};
}
const SLOT_X = [130, 190, 70];   // spawn distance from the center for the 1st / 2nd / 3rd fighter of a team
function place(f){ const s = G.f.filter(q => q.team === f.team && q.idx < f.idx).length; f.x = W/2 + (f.team ? 1 : -1) * SLOT_X[s]; f.tslot = s; f.y = G.P[0].y; f.vx = f.vy = 0; f.gr = true; f.jumps = 2; }

// TEAMS: G.f = [you, ...your bot allies, the opponent, ...its bot allies]. team 0 = your side, team 1 = the other side. idx = index in G.f.
// foeOf(f) = the enemy f is currently fighting (the nearest living one; locked/captured targets are kept). Skills, bots, art.js all take it as `o`.
const foesOf = f => G.f.filter(q => q.team !== f.team && !q.dead);
function foeOf(f){
  const lk = (f.onsl && f.onsl.target) || (f.slaughter && f.slaughter.target) || (f.shd && f.shd.o) || (f.uhand && f.uhand.target) || (f.sc && f.sc.target) || G.f.find(q => q.capturedBy === f.idx && !q.dead);
  if(lk && !lk.dead && lk.team !== f.team) return lk;   // mid-skill: stay on the same victim
  let best = null, bd = 1e9;
  for(const q of G.f){ if(q.team === f.team || q.dead) continue; const d = Math.hypot(q.x - f.x, q.y - f.y); if(d < bd){ bd = d; best = q; } }
  if(!best) return G.f.find(q => q.team !== f.team) || null;
  const c = f.tgt;
  if(c && !c.dead && c.team !== f.team && c !== best && Math.hypot(c.x - f.x, c.y - f.y) < bd + 90) return c;   // keep the old target unless another is clearly closer
  return f.tgt = best;
}
function startMatch(cfg){
  G = {cfg, mode:cfg.mode, P:makeMap(), t:0, paused:false, last:performance.now(), over:null, parts:[], pops:[], rings:[], waves:[], slaughterFx:[], puddles:[], iceZ:[], errZ:[], cuts:[], shake:0,
       stars:Array.from({length:50}, () => ({x:Math.random()*W, y:Math.random()*H, r:Math.random()*1.6+.4}))};
  const n = cfg.size || 1, mates = cfg.allies || [], foes = cfg.foes || [];
  G.f = [mkF(cfg.player, 0, 0)];
  for(let i = 0; i < n - 1; i++) G.f.push(mkF(mates[i], G.f.length, 0));
  G.f.push(mkF(cfg.enemy, G.f.length, 1));
  for(let i = 0; i < n - 1; i++) G.f.push(mkF(foes[i], G.f.length, 1));
  G.f.forEach(place);
  Ctl.reset(); Ctl.on = true;
  Ctl.skAim = [0, 1, 2].map(i => !!(slotDef(G.f[0], i) || {}).aim);   // which of my skill buttons are drag-to-aim
  $('#endBox').classList.add('hide'); $('#pauseWrap').classList.add('hide'); closeInfo(true);
  show('game'); fit();
  cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
}
function stopGame(){ closeInfo(true); cancelAnimationFrame(raf); G = null; $('#pauseWrap').classList.add('hide'); Ctl.on = false; Ctl.reset(); }

// PASSIVE False Existence (skills.js passive:{kind:'falseExistence', cd}): the first enemy hit (basic OR skill) lands on an illusion: Noctis takes no damage, the WHOLE attack is negated
// (every hit of that one skill), he reappears at a random spot on a random platform, then the passive is on cooldown (`cd` s, f.fe). Bleed / puddles / aura ticks are not hits.
function falseExistence(o, src, f){
  const P = o.K.passive, key = (src.slaughter && src.slaughter.target === o) ? src.slaughter : f.A;
  if(o.feKey === key && G.t < o.feT) return true;                // the rest of the SAME attack (extra beats / projectiles) keeps missing
  if(P.chance != null){                                          // ERROR CORRECTION (Errata, passive kind 'errorCorrection'): a % chance per ATTACK, rolled ONCE for all the hits of that attack
    if(o.feNoKey === key && G.t < o.feNoT) return false;         // this attack already failed its roll
    if(Math.random() >= P.chance){ o.feNoKey = key; o.feNoT = G.t + 1; return false; }
  }
  if(o.fe > 0) return false;                                     // on cooldown: a normal hit (Error Correction has cd 0)
  o.fe = P.cd || 0; o.feKey = key; o.feT = G.t + 1;
  const ox = o.x, oy = o.y, mid = o.h / 2;
  const burst = (x, y, n) => { G.rings.push({x, y:y - mid, life:.25}); for(let i = 0; i < n; i++) G.parts.push({x:x + (Math.random() - .5) * 18, y:y - mid + (Math.random() - .5) * 30, vx:(Math.random() - .5) * 460, vy:(Math.random() - .6) * 420, life:.5, col:(P.cols || ['#5c6bff', '#0b0c10', '#c9d0ff'])[i % 3]}); };
  burst(ox, oy, 26);                                             // the illusion shatters
  G.pops.push({x:ox, y:oy - o.h - 6, txt:P.popTxt || 'ILLUSION', life:.8});
  if(src.slaughter && src.slaughter.target === o){ src.slaughter = null; src.atk = 0; src.A = src.base || src.K.basic; src.atkCd = Math.max(src.atkCd, .25); }   // the execution loses its victim
  o.capturedBy = null; o.capRot = 0;
  if(src.onsl && src.onsl.target === o) endOnslaught(src, true);
  if(src.uhand && src.uhand.target === o) endHand(src);                  // Hand of the Abyss grabbed an illusion
  o.slam = null; o.kdT = 0;   // Phantom Onslaught hit an illusion: the execution loses its victim
  if(src.shd && src.shd.o === o) endShadowHook(src);               // Shadow Hook hit an illusion
  if(src.hk) src.hk = null;                                      // a meat hook does not drag him from his new spot
  let nx = ox, ny = oy;
  for(let t = 0; t < 12; t++){                                   // random platform (wider = likelier), random spot on it, not on top of the attacker
    let r = Math.random() * G.P.reduce((a, p) => a + p.w, 0), pl = G.P[0];
    for(const p of G.P){ if((r -= p.w) <= 0){ pl = p; break; } }
    nx = pl.x + 14 + Math.random() * (pl.w - 28); ny = pl.y;
    if(Math.hypot(nx - src.x, ny - src.y) > 90) break;
  }
  o.x = nx; o.y = ny; o.vx = o.vy = 0; o.gr = true; o.jumps = 2; o.flash = .1;
  o.atk = 0; o.comboT = 0; o.charging = false; o.chg = 0; o.rush = null; o.skq = null; o.hk = null; o.shd = null; o.inv = .35;
  burst(nx, ny, 18);                                             // he steps out of the dark
  return true;
}
const armOf = o => o.c.arm - (o.arE > 0 ? o.arAmt : 0);   // armor, minus the Heaven's Verdict debuff (can go negative = takes MORE damage)
let LASTDMG = 0;   // damage of the hit that just landed (Fulminar's Static Charge bonus reads it)
const KB = {x:450, y:-340, stun:.26};   // knockback tuning (horizontal speed, upward speed, stun seconds)
function hurt(o, f){
  const s0 = f.src || (f.K ? f : null);
  if(o.aegis && o.aegis.on && s0 !== o && f.face === -o.face){ blockHit(o, f); return; }   // AEGIS STANCE planted: a blow coming from the front is blocked (nothing lands: no damage, no knockback, no stun)
  if(s0 && o.K.passive && (o.K.passive.kind === 'falseExistence' || o.K.passive.kind === 'errorCorrection') && falseExistence(o, s0, f)) return;   // hit an illusion: no damage, no knockback, nothing lands
  let dmg = f.A.fixed != null ? f.A.fixed * (s0 && s0.mbT > 0 && s0.K.passive && s0.K.passive.kind === 'momentum' ? 1 + s0.K.passive.atk : 1) : (10 + f.c.hp / 40) * 2.2 * (1 - armOf(o) / 50) * f.A.dmg * (f.A.bleedBonus && o.bl > 0 ? f.A.bleedBonus : 1), shown = Math.round(dmg);   // A.fixed = a flat number (Final Curtain beast): no armor, but the Show Must Go On buff still counts   // bleedBonus = extra damage vs a bleeding (Wounded) enemy
  if(o.mbT > 0 && o.K.passive && o.K.passive.kind === 'momentum'){ dmg *= 1 - o.K.passive.def; shown = Math.round(dmg); }   // Performance buff: takes less damage
  if(o.bar > 0){ const ab = Math.min(o.bar, dmg); o.bar -= ab; dmg -= ab; shown = dmg > 0 ? Math.round(dmg) : 'BLOCK'; }   // barrier soaks damage first
  o.hp -= dmg;
  if(dmg > 0 && s0 && s0 !== o && o.K.passive && o.K.passive.kind === 'retribution') retributionGain(o, s0, f.A);   // Paladin took damage: +1 Divine Charge (once per attack)
  G.pops.push({x:o.x + (Math.random() - .5) * 16, y:o.y - o.h - 6, txt:shown, life:.8});   // floating damage number
  G.rings.push({x:o.x, y:o.y - o.h / 2, life:.25}); G.shake = f.A.noShake ? 0 : .12 * (f.A.shake || 1); G.hs = f.A.noHitstop ? 0 : (f.A.hitstop || 0);                                    // hit ring + screen shake
  o.vx = f.face * KB.x * (f.A.kbx ?? 1); o.vy = KB.y * (f.A.kby ?? 1);   // fixed knockback: same power every hit
  o.stun = KB.stun * (f.A.stunx || 1); o.inv = .15; o.flash = .12; o.gr = false; o.atk = 0; o.comboT = 0; o.charging = false; o.chg = 0; o.rush = null; o.skq = null; o.hk = null; if(o.shd) endShadowHook(o);
  for(let i = 0; i < 9; i++) G.parts.push({x:o.x, y:o.y - o.h/2, vx:(Math.random()-.5)*500 + f.face*200, vy:(Math.random()-.8)*400, life:.4, col:f.c.color});
  LASTDMG = dmg;
  const src = f.src || (f.K ? f : null); if(src) onLanded(src, o, f.A);   // passives react to every landed hit (see onLanded)
  if(o.hp <= 0) ko(o);
}
function ko(f){
  if(G.over || f.dead) return;
  if(f.fc) fcRestore(f);   // Final Curtain: give him his own body and HP back before the reset
  // If either fighter is KO'd during a capture, release the other fighter and cancel the execution cleanly.
  G.f.forEach(q => {
    if(q.slaughter && q.slaughter.target === f){ q.slaughter = null; q.atk = 0; q.A = q.base || q.K.basic; }
    if(q.capturedBy === f.idx) q.capturedBy = null;
    if(q.onsl && q.onsl.target === f){ q.onsl = null; q.atk = 0; q.A = q.base || q.K.basic; }
    if(q.shd && q.shd.o === f) endShadowHook(q);
    if(q.slam && q.slam.src === f) q.slam = null;
    if(q.sc && q.sc.target === f) q.sc.target = null;
    if(q.uhand && q.uhand.target === f) endHand(q);
  });
  if(G.mode === 'ai'){
    f.stocks--;
    if(f.stocks <= 0){
      f.dead = true;                                                       // out of the match (the reset below clears everything, then it is parked off-screen)
      const alive = G.f.filter(q => !q.dead), t0 = alive.some(q => q.team === 0), t1 = alive.some(q => q.team === 1);
      if(!(t0 && t1)){                                                     // a whole team is out = match over
        G.over = alive[0] || f;
        $('#endT').textContent = !t0 && !t1 ? 'DRAW' : t0 ? 'YOU WIN' : 'YOU LOSE';
        $('#endBox').classList.remove('hide');
      }
    }
  }
  f.mag = 0; f.rl = 0; f.hp = f.max; f.x = W/2; f.y = -40; f.vx = f.vy = 0; f.jumps = 2; f.inv = 1.6; f.stun = 0; f.atk = 0; f.gr = false; f.rush = null; f.bar = 0; f.pt = 0; f.pn = 0; f.hk = null; f.slaughter = null; f.capturedBy = null; f.mk = 0; f.bl = 0; f.stench = null; f.slowT = 0; f.vomit = null; f.heldT = 0; f.fe = 0; f.feKey = null; f.shd = null; f.shadows = []; f.onsl = null; f.fr = 0; f.hLast = 0; f.dv = 0; f.dvKey = null; f.vclaw = null; f.uhand = null; f.afterimg = null; f.slam = null; f.kdT = 0; f.slowVoidT = 0; f.holy = null; f.impacted = false; f.slowHolyT = 0; f.sc = null; f.aegis = null; f.arE = 0; f.snipe = null; f.snCd = 0; f.snLock = false; f.lob = null; f.fs = 0; f.fsRdy = false; f.frz = 0; f.rootT = 0; f.lowG = 0; f.ice = null; f.mo = 0; f.moT = 0; f.mbT = 0; f.ns = null; f.ge = null; f.fl = null; f.rec = 0; f.stc = 0; f.stLast = 0; f.ls = null; f.sky = null; f.storm = null;
  if(f.dead){ f.x = -5000; f.y = -5000; f.hp = 0; f.inv = 999; f.stun = 0; }   // eliminated: parked off-screen, skipped by everything
}

function endCharge(f, o){   // ATK let go (or knocked / jumped): turn the held time into a stronger punch
  const A = f.A, L = A.cl || 0;
  f.charging = false; f.chgDone = true;
  if(L > 0 && A.burst){ thunderBurst(f, o, A, L); return; }   // Fulminar: THUNDER BURST (held attack)
  if(L > 0){
    f.A = A.unleash ? unleashA(A, L) : {...A, cl:L, dmg:A.dmg * (1 + 2.6 * L), kbx:(A.kbx ?? 1) * (1 + 2.2 * L), stunx:(A.stunx || 1) * (1 + 1.2 * L),
           shake:(A.shake || 1) + 4 * L, hitstop:(A.hitstop || 0) + .2 * L, lunge:(A.lunge || 0) * (1 + .4 * L), reach:A.reach + 8 * L};
    f.comboT = 0;   // a charged punch ends the combo
    if(A.blink && o) blink(f, o);   // skill flag blink:true = shadow step: appear right behind the enemy, then the strike comes out
  }
}
// ---- PELLORIN: THE SHOW MUST GO ON (passive kind 'momentum') + MONSTROUS UNLEASHING (basic.unleash, the held key) ----
// Gauge f.mo 0..100. Every landed hit (puppet hits count as his) adds gain.basic (skill hits: gain.skill). 100 = the buff starts by itself: f.mbT = dur seconds,
// he takes (1 - def) damage, his puppet hits for (1 + atk) damage (art.js strike), the gauge resets to 0 and cannot fill while the buff runs.
// No hit for decayDelay s = the gauge drains decay points per second.
function momentumHit(src, A, P){
  if(src.mbT > 0) return;                                  // no rebuilding during the buff
  src.mo = Math.min(100, src.mo + (A.skill ? P.gain.skill : P.gain.basic)); src.moT = 0;
  if(src.mo >= 100){
    src.mo = 0; src.mbT = P.dur;
    G.rings.push({x:src.x, y:src.y - src.h / 2, life:.25}); G.pops.push({x:src.x, y:src.y - src.h - 34, txt:'THE SHOW MUST GO ON', life:1.1});
    for(let i = 0; i < 22; i++) G.parts.push({x:src.x + (Math.random() - .5) * 20, y:src.y - Math.random() * src.h, vx:(Math.random() - .5) * 420, vy:-Math.random() * 380, life:.55, col:['#ffd479', '#ff7a9a', '#fff2c4'][i % 3]});
  }
}
function geStep(f, dt){   // THE GRAND ENTRANCE: wind-up (cancelled if he is hit) -> the puppet leaps along an arc -> stomp (area damage + knockback) -> recover
  const S = f.ge, d = S.d; S.t += dt;
  if(S.ph === 'wind'){
    if(f.stun > 0 || f.capturedBy != null || f.frz > 0 || !f.A || f.A.skill !== 'grandentrance'){ f.ge = null; return; }
    if(S.t >= d.wind){ S.ph = 'fly'; S.t = 0; }
  }else if(S.ph === 'fly'){
    const k = Math.min(1, S.t / d.fly);
    S.x = S.x0 + (S.tx - S.x0) * k; S.y = S.y0 + (S.gy - S.y0) * k - 4 * (d.arc + Math.abs(S.tx - S.x0) * .12) * k * (1 - k);
    if(k >= 1){                                                               // IMPACT
      S.ph = 'rec'; S.t = 0; S.x = S.tx; S.y = S.gy;
      G.shake = Math.max(G.shake, .32); G.hs = Math.max(G.hs || 0, .06);
      G.waves.push({x:S.tx, y:S.gy - 4, r:d.radius, life:.28, max:.28, col:'#ffd479', fill:'#c23b5b'}); G.rings.push({x:S.tx, y:S.gy - 6, life:.25});
      for(let i = 0; i < 22; i++){ const a = Math.random() * Math.PI; G.parts.push({x:S.tx + (Math.random() - .5) * d.radius, y:S.gy - 2, vx:Math.cos(a) * (150 + Math.random() * 330), vy:-Math.sin(a) * (120 + Math.random() * 280), life:.45, col:['#d9b38c', '#ffd479', '#c23b5b', '#efe3c8'][i % 4]}); }
      for(const e of foesOf(f)){
        if(e.inv > 0 || e.capturedBy != null) continue;
        const dxe = Math.max(0, Math.abs(e.x - S.tx) - e.w / 2), dye = (e.y - e.h / 2) - (S.gy - e.h / 2);
        if(Math.hypot(dxe, dye) > d.radius) continue;                         // outside the radius (or high in the air): nothing
        const A = skillA(d, {hid:S.hid, kbx:d.kbx, kby:d.kby, stunx:d.stunx, shake:2.5, hitstop:.08});
        hurt(e, {c:f.c, A, face:Math.sign(e.x - S.tx) || S.dir, src:f});
      }
    }
  }else if(S.t >= d.recover) f.ge = null;
}
function nsStep(f, dt){   // NO STRINGS DETACHED: wind-up -> the string flies out (piercing) -> short hold -> retracts -> reconnects to his hand
  const S = f.ns, d = S.d; S.t += dt;
  if(f.stun > 0 || f.capturedBy != null || f.frz > 0 || !f.A || f.A.skill !== 'nostrings'){ f.ns = null; return; }   // hit while casting: the string just snaps back to him
  if(S.ph === 'wind'){ if(S.t >= d.wind){ S.ph = 'out'; G.rings.push({x:S.px, y:S.py, life:.2}); } return; }
  if(S.ph === 'out'){
    S.tip = Math.min(d.range, S.tip + d.speed * dt);
    if(S.tip >= d.range){                                                   // the strings are fully out: count how many pierce each enemy (every string = dmg), one hit per enemy
      S.ph = 'hold'; S.ht = 0;
      for(const e of foesOf(f)){
        if(e.inv > 0 || e.capturedBy != null) continue;
        let n = 0; const bx0 = e.x - e.w / 2 - 3, by0 = e.y - e.h - 3, bx1 = e.x + e.w / 2 + 3, by1 = e.y + 3;
        for(const s of S.ang) if(segHitsBox(S.px, S.py, S.px + Math.cos(s.a) * d.range * s.L, S.py + Math.sin(s.a) * d.range * s.L, bx0, by0, bx1, by1)) n++;
        if(!n) continue;
        const A = skillA(d, {hid:S.hid, dmg:d.dmg * n, kbx:0, kby:0, stunx:d.stunx, shake:.4 + .15 * n, hitstop:.02 + .01 * n});
        hurt(e, {c:f.c, A, face:Math.sign(S.dx) || f.face, src:f});
        G.pops.push({x:e.x, y:e.y - e.h - 22, txt:n + ' STRINGS', life:.7});
        for(let i = 0; i < 6 + n; i++) G.parts.push({x:e.x, y:e.y - e.h / 2, vx:(Math.random() - .5) * 300 + S.dx * 160, vy:(Math.random() - .5) * 300, life:.3, col:i % 2 ? '#ffd479' : '#ff7a9a'});
      }
    }
  }else if(S.ph === 'hold'){ S.ht += dt; if(S.ht >= (d.hold || .04)){ S.ph = 'back'; }
  }else if(S.ph === 'back'){ S.tip = Math.max(0, S.tip - d.speed * dt); if(S.tip <= 0){ S.ph = 'con'; S.ct = 0; }
  }else{ S.ct += dt; S.con = Math.min(1, S.ct / d.reconnect); if(S.con >= 1) f.ns = null; }
}
// ---- PELLORIN ULTIMATE: THE FINAL CURTAIN (kind 'finalcurtain') ----
// While it runs, the FIGHTER'S BODY (f.x / f.y / f.w / f.h) IS THE BEAST: you steer it, its 5-hit combo is f.base.combo, and enemies hit it through the normal hit / knockback / stun rules.
// Pellorin himself is only a floating, untouchable dancer (f.fc.ghost, drawn by art.js fcDraw). His real HP is parked in f.fc.hpSave and f.hp is a big buffer (FC_HP):
// every point the buffer loses (hurt() or any damage-over-time) is moved to the beast's own pool f.fc.hp each frame (fcStep). 0 = the beast is destroyed.
// f.fl = Pellorin gently descending after it ends, f.rec = his recovery time (no actions; skills.js recoverEnd / recoverBreak).
const FC_HP = 100000;
const platBelow = (x, y) => { let b = null; for(const p of G.P) if(x >= p.x && x <= p.x + p.w && p.y >= y - 2 && (!b || p.y < b.y)) b = p; return b; };   // the platform right under (x, y), or null
function fcRestore(f){
  const S = f.fc; if(!S) return;
  f.w = S.w0; f.h = S.h0; f.base = S.base0; f.A = f.base; f.hp = S.hpSave; f.atk = 0; f.comboT = 0; f.charging = false; f.fc = null;
}
function fcStep(f, dt){
  const S = f.fc; S.t += dt;
  const lost = FC_HP - f.hp; if(lost > 0) S.hp -= lost; f.hp = FC_HP;      // everything that hurt the body hurt the beast
  if(S.hp <= 0){ S.hp = 0; endFC(f, 'dead'); return; }
  if(S.t >= S.d.duration) endFC(f, 'time');
}
function endFC(f, why){
  const S = f.fc; if(!S) return;
  const d = S.d, bx = f.x, by = f.y, bpl = platBelow(bx, by - 6) || G.P[0], P = f.pup, hurtEnd = why === 'dead';
  fcRestore(f);
  f.x = S.px; f.y = S.py; f.vx = f.vy = 0; f.gr = false; f.stun = 0; f.flash = 0; f.atkCd = 0;       // the hit that ended it must not throw Pellorin
  f.fl = {t:0, T:d.descend, x:S.px, y0:S.py, y1:S.gy};                                               // he descends safely (untouchable) ...
  f.inv = Math.max(f.inv, d.descend); f.rec = hurtEnd ? d.recoverBreak : d.recoverEnd;                // ... and then cannot act for the recovery time
  f.atkCd = f.rec;
  if(P){ P.x = clampN(bx, bpl.x + 8, bpl.x + bpl.w - 8); P.plat = bpl; P.y = bpl.y; P.tp = S.gpl; P.hop = null; P.mode = 'follow'; P.focus = false; }   // the puppet shrinks back where the beast stood, then hops to him
  G.rings.push({x:bx, y:by - 24, life:.3}); G.shake = Math.max(G.shake, hurtEnd ? .3 : .12);
  G.pops.push({x:bx, y:by - 70, txt:hurtEnd ? 'BEAST DESTROYED' : 'CURTAIN DOWN', life:1});
  for(let i = 0; i < (hurtEnd ? 34 : 14); i++) G.parts.push({x:bx + (Math.random() - .5) * 26, y:by - Math.random() * 50, vx:(Math.random() - .5) * (hurtEnd ? 640 : 380), vy:-Math.random() * (hurtEnd ? 520 : 300), life:.6, col:['#efe3c8', '#5b2a6e', '#ffd479', '#c23b5b'][i % 4]});   // cotton stuffing
}
function flStep(f, dt){   // the slow, safe descent after the ultimate
  const L = f.fl; L.t += dt;
  const k = Math.min(1, L.t / L.T), e = k * k * (3 - 2 * k);
  f.x = L.x; f.y = L.y0 + (L.y1 - L.y0) * e; f.vx = f.vy = 0; f.gr = false;
  if(k >= 1) f.fl = null;
}
function momentumStep(f, dt){
  const P = f.K.passive;
  if(f.mbT > 0){ f.mbT -= dt; if(f.mbT <= 0){ f.mbT = 0; G.rings.push({x:f.x, y:f.y - f.h / 2, life:.2}); } }
  else if(f.mo > 0){ f.moT += dt; if(f.moT > P.decayDelay) f.mo = Math.max(0, f.mo - P.decay * dt); }
}
// Held key: A.cl = charge 0..1 (hold time between chargeMin and chargeMax). 25% is the lowest tier. Damage = base x (1 + charge) = 1.25x .. 2.0x of the puppet's normal attack damage; knockback grows from Moderate to Maximum.
function unleashA(A, L){
  const U = A.unleash, c = Math.max(U.floor, L), k = (c - U.floor) / (1 - U.floor), mix = r => r[0] + (r[1] - r[0]) * k;
  return {...A, cl:L, dmg:U.base * (1 + c), kbx:mix(U.kbx), kby:mix(U.kby), stunx:mix(U.stunx), shake:1 + 3 * c, hitstop:.04 + .1 * c};
}
// ERRATA held attack REALITY COLLAPSE (basic.fan in skills.js): while ATK is held the aim is read here every frame (art.js gathers / throws the shards).
// You: drag the ATK button or push the stick toward the aim (keys: W / S tilt it). No aim input = straight ahead. A bot aims at the enemy. f.erAim = unit vector, f.A.aimEl = how high the arm points.
function fanAim(f, o){
  const i = f.in, hx = f.x + f.face * 18, hy = f.y - 34;
  let ax = f.face, ay = 0;
  if(f.idx === 0){ const v = i.aim; if(v){ ax = v.x; ay = v.y; } else ay = (i.ay || 0) * .6; }
  else if(o){ ax = o.x - hx; ay = (o.y - o.h / 2) - hy; }
  const m = Math.hypot(ax, ay) || 1; ax /= m; ay /= m;
  if(Math.abs(ax) > .3) f.face = ax > 0 ? 1 : -1;
  f.erAim = {x:ax, y:ay}; f.A.aimEl = -Math.atan2(ay, Math.abs(ax));
}
function blink(f, o){   // teleport f to the far side of o and face them (smoke + rings at both spots; art.js draws a streak from f.blinkT / f.blinkDx)
  const side = Math.sign(o.x - f.x) || f.face, ox = f.x, oy = f.y, mid = f.h / 2;
  const puff = (x, y) => { G.rings.push({x, y:y - mid, life:.25}); for(let i = 0; i < 10; i++) G.parts.push({x, y:y - mid, vx:(Math.random() - .5) * 420, vy:(Math.random() - .5) * 420, life:.4, col:f.c.color}); };
  puff(ox, oy);
  f.x = Math.max(24, Math.min(W - 24, o.x + side * (o.w / 2 + f.w / 2 + 4))); f.y = o.y; f.vx = 0; f.vy = 0; f.gr = o.gr; f.face = -side;
  f.blinkT = G.t; f.blinkDx = ox - f.x;
  puff(f.x, f.y);
}
// ---- SKILLS (skills I + II + ultimate, plus the passive) ----
// A hero's skills.js lists them: skills:[I, II], ultimate:{...}, passive:{...}. Each skill has a `kind` that picks what it does (SKILLS below). Nothing here is Titan-only.
//   aim:true = drag-to-aim on the button (see controller.js); a tap casts straight ahead. charges + recharge = N charges, each recharging on its own timer. cd = plain cooldown.
const slotDef = (f, i) => i < 2 ? f.K.skills[i] : f.K.ultimate;
function skillA(d, extra){   // the "attack numbers" of a skill, so hurt() / shots / art.js treat it like a hit (skill = its kind: art.js uses it to pick a pose)
  return {time:d.time || .3, cd:d.time || .3, reach:0, hitFrom:0, hitTo:0, dmg:d.dmg || 1, kbx:d.kbx, kby:d.kby, stunx:d.stunx, shake:d.shake, hitstop:d.hitstop,
          noShake:d.noShake, noHitstop:d.noHitstop, noSlash:true, root:!!d.root, step:0, bleedBonus:d.bleedBonus, skill:d.kind, ...extra};
}
function startSkillA(f, A){ f.A = A; f.atk = A.time; f.atkCd = A.cd; f.hitDone = true; f.fired = 1; f.lunged = true; f.chgDone = true; }
const SKILLS = {
  // SHOCKWAVE (Forcebreaker): instant. Leaves the fist right away, flies along the aim, stops at the first enemy it touches.
  shockwave(f, o, d, ax, ay){
    startSkillA(f, skillA(d, {aimA:Math.atan2(Math.abs(ax), ay)}));
    const m = Math.hypot(ax, ay) || 1; ax /= m; ay /= m;
    (G.sh = G.sh || []).push({id:f.c.id, c:f.c, idx:f.idx, team:f.team, A:f.A, x:f.x + ax * 20, y:f.y - 34 + ay * 20, vx:ax * d.speed, vy:ay * d.speed, r:d.r, life:d.life, age:0, kind:'skill', cl:0});
  },
  // RUSH (Seismic Rush): instant gap closer, straight along the ground (left / right from the aim). Stops at the first enemy: damage + knockback + interrupts them.
  // Hits the side of a platform = he crashes, stuns himself (d.wallStun seconds), no damage.
  rush(f, o, d){
    startSkillA(f, skillA(d, {time:d.dist / d.speed + .2}));
    f.rush = {dir:f.face, left:d.dist, spd:d.speed, d};
  },
  // QUAKE (Total Extinction): short wind-up (arms up, slam), then ONE big area hit around him at d.at (0..1 of the wind-up). Hurt during the wind-up = it is interrupted.
  quake(f, o, d){
    startSkillA(f, skillA(d, {time:d.windup || .8, root:true}));
    f.quaked = false;
  },
  // MELEE (Cleaver's Kiss): a normal melee swing with its own numbers (time, hitFrom/hitTo = hit window, reach, step = which art.js attack pose to play). It lands through the same
  // hit box as basic attacks. bleedBonus = damage multiplier against a bleeding enemy. Hit = counts for the passive like any skill.
  melee(f, o, d){
    startSkillA(f, skillA(d, {hitFrom:d.hitFrom, hitTo:d.hitTo, reach:d.reach, step:d.step || 0, lunge:d.lunge, lungeP:d.lungeP}));
    f.hitDone = false; f.lunged = false;
  },
  // HOOK (Meat Hook): instant. A hook on a chain flies along the aim up to d.range, stops at the first enemy (damage, NO knockback: use kbx:0 kby:0) and drags them next to him at d.pull px/s.
  // A miss flies to max range and comes back. Getting hit while hooking (or while pulling) cuts the chain.
  hook(f, o, d, ax, ay){
    startSkillA(f, skillA(d, {aimA:Math.atan2(Math.abs(ax), ay)}));
    const m = Math.hypot(ax, ay) || 1;
    f.hk = {ax:ax / m, ay:ay / m, len:0, ph:0, d, A:f.A, t:0, ox:f.x, oy:f.y - 30, x:f.x, y:f.y - 30};   // ph: 0 flying out, 1 pulling the enemy, 2 coming back empty
  },
  // DIVINE IMPACT (Paladin I): no aim. He raises the shield and smashes it into the ground (the power-smash pose). At d.at (0..1 of the cast, = the contact point of the pose) a holy shockwave
  // goes off around him: damage + slow on enemies inside d.radius px (see divineImpact below), and his shield glows for d.glow s (f.holy). Hurt during the cast = interrupted, nothing happens.
  divineimpact(f, o, d){
    startSkillA(f, skillA(d, {time:d.time, step:2, root:true, impact:d}));
    f.impacted = false;
  },
  // HEAVEN'S VERDICT (Paladin ultimate): needs an enemy inside d.range. He raises the shield (d.cast s); a giant golden shield manifests over the spot where the enemy STANDS NOW and falls for d.delay s
  // (it does not follow them: they can leave). The landing (verdictLand) hits whoever is inside d.radius px of that spot at that moment. The cast pose can be interrupted, the verdict still falls.
  heavensverdict(f, o, d){
    f.face = Math.sign(o.x - f.x) || f.face;
    startSkillA(f, skillA(d, {time:d.cast, root:true, noSlash:true, step:-1}));
    let gy = null; for(const p of G.P) if(o.x > p.x - 6 && o.x < p.x + p.w + 6 && p.y >= o.y - 6 && (gy == null || p.y < gy)) gy = p.y;   // the floor under them
    (G.verdicts = G.verdicts || []).push({src:f, x:o.x, y:gy == null ? o.y : gy, t:0, d, hit:false});
    G.pops.push({x:o.x, y:o.y - o.h - 22, txt:'JUDGED', life:.9});
  },
  // SACRED CHARGE (Paladin II): no aim. He braces behind the shield for d.windup s (rooted, vibrating), then charges forward for d.duration s (see sacredChargeStep below).
  sacredcharge(f, o, d){
    startSkillA(f, skillA(d, {time:d.windup + d.duration + .2, step:-1, windup:d.windup}));
    f.sc = {t:0, dir:f.face, d, target:null, hit:false};
  },
  // SLAUGHTERHOUSE: needs the enemy CLOSE (d.grab px, see CAN below). If they are too far it does not cast at all (no cooldown spent).
  // Order: the hook chain flies out and wraps the enemy (d.deploy s), drags them in front of him (d.pull s), then he chops and bites them for d.duration s.
  // d.hits = damage beats {p = when (0..1 of the whole animation, same timing as the poses in art.js), dmg = damage multiplier}. At the end he heals d.heal x max HP.
  slaughterhouse(f, o, d){
    f.face = Math.sign(o.x - f.x) || f.face;
    startSkillA(f, skillA(d, {time:d.deploy + d.duration, root:true, noSlash:true}));
    f.slaughter = {target:o, t:0, deploy:d.deploy, pull:d.pull || .38, hold:d.hold || 46, duration:d.duration, heal:d.heal, ox:o.x, oy:o.y, kick:0,
                   hits:(d.hits || []).map(h => ({...h})).sort((a, b) => a.p - b.p)};
    o.capturedBy = f.idx; o.vx = o.vy = 0; o.atk = 0; o.stun = 0; o.rush = null; o.hk = null; o.skq = null; o.capRot = 0;
  },
  // STENCH (Putrid Stench): a TOGGLE. Press = the toxic cloud turns on and follows him. Press again = it turns off (then d.cd is the cooldown before he can turn it on again).
  // Enemies inside d.radius px take d.dps x their max HP per second and are slowed by d.slow (0.4 = 40% slower).
  // He keeps moving freely, but loses d.selfDps x his max HP per second while it is ON. If that takes him to 0 HP he DIES (it is a real KO).
  stench(f, o, d){
    if(f.stench){ if(f.stench.age > .3) endStench(f); return; }   // already on: this press turns it off
    startSkillA(f, skillA(d, {time:d.cast || .45}));
    f.stench = {age:0, d, acc:0, pt:0};
  },
  // SHADOW HOOK (Noctis I): aimed. A hook flies along the aim (d.range px, first enemy it touches). Hit = he pulls himself to them, passes THROUGH them, turns and lands an aerial kick
  // (physical damage + knockback back the way he came), then backflips away and lands at a distance. A miss just reels the hook back. Phases (A.ph, art.js poses): 0 throw, 1 pull, 2 through, 3 kick, 4 backflip.
  shadowhook(f, o, d, ax, ay){
    startSkillA(f, skillA(d, {time:1, aimA:Math.atan2(Math.abs(ax), ay), ph:0, pp:0}));
    const m = Math.hypot(ax, ay) || 1;
    f.shd = {kind:'hook', d, A:f.A, ph:0, t:0, ax:ax / m, ay:ay / m, len:0, ox:f.x, oy:f.y - 30, x:f.x, y:f.y - 30, o:null, run:0, hit:false, fl:0};
  },
  // SHADOW REPLICATION (Noctis II): press = 3 shadows appear at random spots on the platforms (d.count). They stand still and cannot be hurt. While any are left the SAME button teleports him:
  // drag toward a shadow (the one closest to the aim is picked, a tap = the one ahead), release = instant teleport there. That shadow is used up, the others stay (up to d.life s).
  // The cooldown (d.cd) starts when the last shadow is gone. cast = short summon pose (s).
  replicate(f, o, d, ax, ay){
    if(f.shadows.length){ shadowJump(f, o, d, ax, ay); return; }
    startSkillA(f, skillA(d, {time:d.cast || .4}));
    const spots = randomSpots(d.count || 3, [f, o]);
    f.shadows = spots.map((p, i) => ({x:p.x, y:p.y, age:0, seed:Math.random() * 6.28, face:Math.sign(o.x - p.x) || 1, k:i}));
    spots.forEach(p => { G.rings.push({x:p.x, y:p.y - 26, life:.25}); for(let i = 0; i < 9; i++) G.parts.push({x:p.x + (Math.random() - .5) * 14, y:p.y - Math.random() * 50, vx:(Math.random() - .5) * 200, vy:-Math.random() * 160, life:.45, col:['#5c6bff', '#0b0c10', '#c9d0ff'][i % 3]}); });
  },
  // PHANTOM ONSLAUGHT (Noctis ultimate): needs an enemy inside d.range (see CAN). Sequence: he appears BEHIND them (the enemy is locked from this moment: no move / attack / skills) ->
  // d.copies shadows jump up onto his back in a spread fan (d.gather s) -> they leap out around the target and CHAIN it up (d.chain s) -> he slashes without stopping, every d.tick s for d.frenzy s
  // (d.tickDmg each, no knockback), hopping around the target while the shadows hold the chains -> after d.windup s the finishing slash (d.finishDmg, the chains shatter, knockback) -> d.recover s.
  onslaught(f, o, d){
    const back = -(o.face || 1), R = d.radius || 60, ang = [180, 235, 270, 305, 0];   // 5 spots in a ring around the target: left, upper left, above, upper right, right
    const S = {target:o, d, t:0, cxo:o.x, cyo:o.y, back, ticks:0, tickT:0, sw:0, fin:false, finT:0, rb:false, hop:-1, chainK:0,
               tA:d.appear || .25, tG:(d.appear || .25) + (d.gather || .45), tC:(d.appear || .25) + (d.gather || .45) + (d.chain || .3),
               ring:ang.map(a => { const r = a * Math.PI / 180; return {dx:Math.cos(r) * R, dy:Math.min(Math.sin(r) * R * .95 - 8, -6)}; }),
               copies:Array.from({length:d.copies || 5}, (_, i) => ({px:0, py:0, ppx:0, ppy:0, a:0, seed:Math.random() * 6.28, i}))};
    S.tF1 = S.tC + (d.frenzy || 1.5); S.tW1 = S.tF1 + (d.windup || .3); S.tRec = d.recover || .35; S.total = S.tW1 + S.tRec;
    S.home = {x:Math.max(24, Math.min(W - 24, o.x + back * (o.w / 2 + f.w / 2 + 14))), y:o.y};     // where he appears (behind them) and returns for the finish
    const hop = (dx, dy) => ({x:Math.max(24, Math.min(W - 24, o.x + dx)), y:o.y + dy}), side = o.w / 2 + f.w / 2 + 8;
    S.hops = [hop(back * side, 0), hop(-back * side, 0), hop(back * 26, -38), hop(-back * 26, -38)];   // close spots he jumps between while slashing
    startSkillA(f, skillA(d, {time:S.total, root:true, ph:4, pp:0, sw:0}));
    f.onsl = S;
    o.capturedBy = f.idx; o.vx = o.vy = 0; o.atk = 0; o.stun = 0; o.rush = null; o.hk = null; o.skq = null; o.capRot = 0; o.charging = false; o.chg = 0;
    blinkTo(f, S.home.x, S.home.y, o);
    f.vx = f.vy = 0; f.gr = false;
    S.back0 = {x:f.x, y:f.y};
    S.copies.forEach(c => { c.px = c.ppx = f.x; c.py = c.ppy = f.y; });
  },
  // VOID CLAW (Umbra I): ground-targeted. He reaches out, the spot is marked, then a giant claw bursts up from the ground (clawStep).
  // EXPLOSIVE SHOT (Caliber I): ARC aiming. The landing spot is chosen by the player (drag the button: how far = how far it lands, left / right = which side; a tap = the enemy's column, else ahead).
  // After a short wind-up (d.windup s) a shell is lobbed along the arc shown by the preview. It has real travel time (enemies can walk out from under it), and explodes the instant it touches
  // ground (a platform top) or an enemy: everyone enemy within d.radius px takes damage + a small push away from the blast. No fuse, no delay. See lobAim / lobStep / bombBlast.
  lobshot(f, o, d, ax, ay, m){
    const a = lobAim(f, o, d, ax, ay, m);
    f.face = a.dir;
    startSkillA(f, skillA(d, {time:d.cast || .4, root:true, noSlash:true, lobAng:Math.atan2(-a.vy, Math.abs(a.vx))}));
    f.lob = {t:0, at:d.windup || .18, a, d};
  },
  // WINTER'S GRASP (Zerathis I): ground-targeted. He marks the spot (cast pose), the ground freezes for d.warn s (the warning), then ice spikes erupt (graspStep).
  wintergrasp(f, o, d, ax, ay, m){
    const g = groundAim(f, o, d, ax, ay, m); if(!g) return;
    f.face = Math.sign(g.x - f.x) || f.face;
    startSkillA(f, skillA(d, {time:d.cast || .5, cd:d.cast || .5, root:true, tgx:g.x}));
    G.iceZ.push({kind:'grasp', src:f, d, x:g.x, gy:g.y, t:0, hid:++HID});
  },
  // CRYSTAL COFFIN (Zerathis II): ground-targeted. After d.form s every enemy inside d.radius is walled in and immobilized for d.trap s, then the ice shatters (coffinStep).
  crystalcoffin(f, o, d, ax, ay, m){
    const g = groundAim(f, o, d, ax, ay, m); if(!g) return;
    f.face = Math.sign(g.x - f.x) || f.face;
    startSkillA(f, skillA(d, {time:d.cast || .45, cd:d.cast || .45, root:true, tgx:g.x}));
    G.iceZ.push({kind:'coffin', src:f, d, x:g.x, gy:g.y, t:0, hid:++HID});
  },
  // DIMENSIONAL IMPALE (Errata I): ground-targeted. A giant glitching mirror shard materializes above the aimed spot (d.fall s), crashes down (area damage), then stays embedded for d.duration s.
  // While it stands, simply WALKING INTO its area makes her step in automatically and reappear at a random valid spot on the map (dimEnter, checked in impaleStep). Only she can use it.
  dimimpale(f, o, d, ax, ay, m){
    const g = groundAim(f, o, d, ax, ay, m); if(!g) return;
    f.face = Math.sign(g.x - f.x) || f.face;
    startSkillA(f, skillA(d, {time:d.cast || .45, cd:d.cast || .45, root:true, tgx:g.x}));
    G.errZ.push({kind:'impale', src:f, d, x:g.x, gy:g.y, t:0, hid:++HID, up:false, enterCd:0, flash:0});
  },
  // SHATTERED GRAVITY (Errata II): ground-targeted. A gravitational distortion forms at the aimed spot and, for d.duration s, drifts every enemy inside d.radius toward its center (gravityStep).
  // The pull is a drift added on top of their own movement (d.pull px/s, stronger near the center): it is slower than a normal walk, so they can still move and escape.
  shatteredgravity(f, o, d, ax, ay, m){
    const g = groundAim(f, o, d, ax, ay, m); if(!g) return;
    f.face = Math.sign(g.x - f.x) || f.face;
    startSkillA(f, skillA(d, {time:d.cast || .5, cd:d.cast || .5, root:true, tgx:g.x}));
    G.errZ.push({kind:'gravity', src:f, d, x:g.x, gy:g.y, cy:g.y - (d.lift || 34), t:0, hid:++HID});
  },
  // ETERNAL ICE AGE (Zerathis ultimate): d.cast s of casting (rooted, a hit interrupts it), then the arena freezes over for d.duration s (iceAgeStep).
  iceage(f, o, d){
    startSkillA(f, skillA(d, {time:d.cast, cd:d.cast, root:true}));
    f.ice = {ph:'cast', t:0, d, acc:{}};
  },
  // NO STRINGS DETACHED (Pellorin I): the string is cut from his hand (it stays on the puppet), the puppet shoots it along the aim, it PIERCES every enemy on the line (one hit each, no knockback),
  // then it retracts and reconnects to his hand. Drag to aim (from the puppet); a tap = at the enemy if he is in range, else straight ahead. See nsStep.
  nostrings(f, o, d, ax, ay, m){
    const P = f.pup, sc = P ? P.sc : 1, px = P ? P.x : f.x + f.face * 46, py = (P ? P.y - (P.an ? P.an.lift : 0) : f.y) - 12 * sc;
    let dx = ax, dy = ay;
    if(m == null){ const ex = o.x - px; if(Math.abs(ex) <= d.range && ex * f.face > -30){ dx = ex; dy = (o.y - o.h / 2) - py; } else { dx = f.face; dy = 0; } }   // tap: at the enemy, else ahead
    const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
    if(Math.abs(dx) > .12) f.face = dx > 0 ? 1 : -1;
    const T = d.wind + 2 * d.range / d.speed + (d.hold || .04) + d.reconnect;
    startSkillA(f, skillA(d, {time:T, cd:T, noSlash:true}));
    const a0 = Math.atan2(dy, dx), N = d.strings || 10, ang = Array.from({length:N}, () => ({a:a0 + (Math.random() - .5) * (d.fan || 1), L:1 - (d.lenVar || 0) * Math.random()}));   // one string per finger, each in a RANDOM direction inside the fan around the aim, with a random length
    f.ns = {t:0, d, px, py, dx, dy, tip:0, ph:'wind', done:false, con:0, T, ang, hid:++HID};
  },
  // THE FINAL CURTAIN (Pellorin ultimate): the puppet swells into the monster WHERE IT STANDS and becomes the fighter's body (you steer it). Pellorin rises above his own platform and dances, untouchable.
  // See fcStep / endFC above and art.js fcDraw. The beast's combo + numbers: skills.js ultimate.combo.
  finalcurtain(f, o, d){
    const P = f.pup, hop = P && P.hop, bpl = hop ? hop.pl : (P && P.plat) || platBelow(f.x, f.y - 4) || G.P[0];
    const bx = clampN(hop ? hop.x1 : P ? P.x : f.x + f.face * 46, bpl.x + 22, bpl.x + bpl.w - 22);
    const hpl = platBelow(f.x, f.y - 4) || G.P[0], hx = clampN(f.x, hpl.x + 18, hpl.x + hpl.w - 18), hy = Math.max(80, hpl.y - 104);
    f.ge = f.ns = null; f.rush = null;
    const S = {d, t:0, hp:d.hp, max:d.hp, hpSave:f.hp, w0:f.w, h0:f.h, base0:f.base || f.K.basic, x0:f.x, y0:f.y, px:hx, py:hy, gy:hpl.y, gpl:hpl, hid:++HID,
      ghost:{c:f.c, x:f.x, y:f.y, face:f.face, vx:0, vy:0, gr:false, stun:0, atk:.5, A:{time:1, dance:true}, flash:0, inv:0}};
    f.fc = S;
    f.base = {time:.5, cd:.5, reach:60, hitFrom:.2, hitTo:.08, dmg:1, noSlash:true, combo:d.combo}; f.A = f.base; f.atk = 0; f.atkCd = .15; f.cs = 0; f.comboT = 0;
    f.w = d.w; f.h = d.h; f.x = bx; f.y = bpl.y; f.vx = f.vy = 0; f.gr = true; f.jumps = 2; f.hp = FC_HP; f.face = Math.sign(o.x - bx) || f.face;
    G.rings.push({x:bx, y:bpl.y - 20, life:.3}); G.shake = Math.max(G.shake, .25); G.pops.push({x:f.x, y:f.y - 80, txt:d.name, life:1.2});
    for(let i = 0; i < 26; i++) G.parts.push({x:bx + (Math.random() - .5) * 20, y:bpl.y - Math.random() * 30, vx:(Math.random() - .5) * 560, vy:-Math.random() * 420, life:.6, col:['#efe3c8', '#5b2a6e', '#ffd479'][i % 3]});
  },
  // THE GRAND ENTRANCE (Pellorin II): ground-targeted. After a short wind-up the puppet LEAPS in an arc to the aimed spot and stomps: everyone inside d.radius takes damage + knockback away from the impact. No other effect. See geStep.
  grandentrance(f, o, d, ax, ay, m){
    const g = groundAim(f, o, d, ax, ay, m); if(!g) return;
    const P = f.pup, x0 = P ? P.x : f.x + f.face * 46, y0 = P && P.plat ? P.plat.y : f.y, dir = Math.sign(g.x - x0) || f.face;
    f.face = Math.sign(g.x - f.x) || f.face;
    const T = d.wind + d.fly + d.recover;
    startSkillA(f, skillA(d, {time:T, cd:T, noSlash:true}));
    f.ge = {t:0, d, x0, y0, tx:g.x, gy:g.y, x:x0, y:y0, ph:'wind', dir, T, hid:++HID};
  },
  voidclaw(f, o, d, ax, ay, m){
    const g = groundAim(f, o, d, ax, ay, m); if(!g) return;
    f.face = Math.sign(g.x - f.x) || f.face;
    startSkillA(f, skillA(d, {time:d.cast || .45, root:true, tgx:g.x}));
    f.vclaw = {x:g.x, gy:g.y, t:0, hit:false, d, dir:f.face, hid:++HID};
  },
  // SHADOW STEP (Umbra II): dissolve into smoke, appear at the chosen spot. Leaves an afterimage, short dodge window, +1 fragment.
  shadowstep(f, o, d, ax, ay, m){
    const q = stepDest(f, o, d, ax, ay, m); if(!q) return;
    f.afterimg = {x:f.x, y:f.y, face:f.face, t:0, life:.7};
    const smoke = (x, y) => { G.rings.push({x, y:y - f.h / 2, life:.25}); for(let i = 0; i < 14; i++) G.parts.push({x:x + (Math.random() - .5) * 16, y:y - Math.random() * f.h, vx:(Math.random() - .5) * 260, vy:-Math.random() * 220, life:.5, col:i % 2 ? '#6a3cff' : '#0a0614'}); };
    smoke(f.x, f.y);
    f.x = q.x; f.y = q.y; f.vx = f.vy = 0; f.gr = true; f.jumps = 2; f.drop = 0;
    f.face = Math.sign(o.x - f.x) || f.face;
    f.atk = 0; f.A = f.base || f.K.basic; f.rush = null; f.hk = null;
    f.inv = Math.max(f.inv, d.evade || .3);                      // dodge window only: it runs out
    smoke(f.x, f.y);
    hungerGain(f);
  },
  // LIGHTNING STEP (Fulminar I): he turns into a ball of lightning (invulnerable, much faster, can jump, no attacks / skills). See lightStep. Press the skill again to cancel early.
  lightningstep(f, o, d){
    f.atk = 0; f.A = f.base || f.K.basic; f.rush = null; f.hk = null; f.charging = false; f.chg = 0; f.jumps = 2;
    f.ls = {t:0, d, hid:++HID, hitT:0};
    f.inv = Math.max(f.inv, d.dur + .1);
    G.rings.push({x:f.x, y:f.y - f.h / 2, life:.25}); G.waves.push({x:f.x, y:f.y - f.h / 2, r:60, life:.25, max:.25, col:'#7df3ff', fill:'#00e5ff'});
  },
  // SKYFALL (Fulminar II): drag to pick a ground spot. He raises a hand (`cast` s, the circle is marked on the ground), then `strikes` lightning bolts rain down over the circle one after another.
  skyfall(f, o, d, ax, ay, m){
    const g = groundAim(f, o, d, ax, ay, m); if(!g) return;
    f.face = Math.sign(g.x - f.x) || f.face;
    startSkillA(f, skillA(d, {time:d.cast, root:true}));
    const n = d.strikes, xs = [];
    for(let i = 0; i < n; i++) xs.push(g.x - d.radius + (i + .5) / n * 2 * d.radius + (Math.random() - .5) * d.radius / n);
    for(let i = n - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [xs[i], xs[j]] = [xs[j], xs[i]]; }   // random order
    f.sky = {x:g.x, gy:g.y, t:0, d, hid:++HID, hits:xs.map((x, i) => ({x, at:d.cast + i * d.gap, done:false})), total:d.cast + n * d.gap + .4};
  },
  // STORM OF RUIN (Fulminar ultimate): a typhoon covers the arena for `dur` s. Bolts hit random spots (no warning), more often near the enemy, faster and faster. See stormStep.
  stormofruin(f, o, d){
    startSkillA(f, skillA(d, {time:d.cast, root:true}));
    f.storm = {t:0, d, hid:++HID, next:d.cast + .25, ph:0};
    G.pops.push({x:f.x, y:f.y - f.h - 34, txt:'STORM OF RUIN', life:1.1});
  },
  // HAND OF THE ABYSS (Umbra ultimate): see handStep.
  abysshand(f, o, d){
    const c1 = d.rift, c2 = c1 + d.rise, c3 = c2 + d.lift, c4 = c3 + d.close, c5 = c4 + d.crush, c6 = c5 + d.slam, total = c6 + d.sink;
    startSkillA(f, skillA(d, {time:total, root:true, ph:0, pp:0}));
    const gy = groundAt(o.x, o.y);
    f.uhand = {target:o, d, t:0, c1, c2, c3, c4, c5, c6, total, x:o.x, gy:gy == null ? o.y : gy, hasGround:gy != null, y0:o.y, hy:o.y + 40, curl:0, alpha:0, riftK:0, grabbed:false, emp:false, tickN:0, crushed:false, slammed:false, hid:++HID};
    f.vx = 0;
  }
};
const ssupported = (x, y) => G.P.some(p => x > p.x + 8 && x < p.x + p.w - 8 && p.y >= y - 24);   // is there a platform under this x (at or below y)?
function randomSpots(n, avoid){   // n random spots on random platforms (wider = likelier), away from each other and from the fighters
  const out = [], tot = G.P.reduce((a, p) => a + p.w, 0);
  for(let i = 0; i < n; i++){
    let best = null, bd = -1;
    for(let t = 0; t < 40; t++){
      let r = Math.random() * tot, pl = G.P[0];
      for(const p of G.P){ if((r -= p.w) <= 0){ pl = p; break; } }
      const c = {x:pl.x + 16 + Math.random() * Math.max(1, pl.w - 32), y:pl.y};
      const dmin = Math.min(...[...out, ...avoid].map(q => Math.hypot(q.x - c.x, (q.y - c.y) * .6)), 999);
      if(dmin > bd){ bd = dmin; best = c; }
      if(dmin > 80) break;                                          // good enough: spread out
    }
    out.push(best);
  }
  return out;
}
function blinkTo(f, x, y, o){   // like blink() but to an exact spot (smoke + rings at both ends, art.js draws the streak)
  const ox = f.x, oy = f.y, mid = f.h / 2;
  const puff = (px, py) => { G.rings.push({x:px, y:py - mid, life:.25}); for(let i = 0; i < 10; i++) G.parts.push({x:px, y:py - mid, vx:(Math.random() - .5) * 420, vy:(Math.random() - .5) * 420, life:.4, col:f.c.color}); };
  puff(ox, oy);
  f.x = Math.max(24, Math.min(W - 24, x)); f.y = y;
  if(o) f.face = Math.sign(o.x - f.x) || f.face;
  f.blinkT = G.t; f.blinkDx = ox - f.x;
  puff(f.x, f.y);
}
function shadowJump(f, o, d, ax, ay){   // teleport to the shadow closest to the aim (tap = ahead), instantly. That shadow is used up.
  const m = Math.hypot(ax, ay) || 1; ax /= m; ay /= m;
  let bi = 0, bs = -9;
  f.shadows.forEach((q, i) => { const dx = q.x - f.x, dy = q.y - f.y, L = Math.hypot(dx, dy) || 1, sc = (dx * ax + dy * ay) / L - L / 6000; if(sc > bs){ bs = sc; bi = i; } });
  const q = f.shadows.splice(bi, 1)[0];
  f.atk = 0; f.A = f.base || f.K.basic; f.comboT = 0; f.rush = null; f.hk = null;
  blinkTo(f, q.x, q.y, o);
  f.vx = f.vy = 0; f.gr = true; f.jumps = 2; f.drop = 0; f.inv = Math.max(f.inv, .12);
  for(let i = 0; i < 8; i++) G.parts.push({x:q.x + (Math.random() - .5) * 14, y:q.y - Math.random() * 50, vx:(Math.random() - .5) * 260, vy:-Math.random() * 200, life:.4, col:'#0b0c10'});   // the shadow dissolves
  if(!f.shadows.length) shadowsGone(f, d);
}
function shadowsGone(f, d){ const i = f.K.skills.indexOf(d); if(i >= 0) f.sk[i].cd[0] = d.cd || 12; }   // last shadow used / expired: now the cooldown starts
function shadowTick(f, dt){
  if(!f.shadows.length) return;
  const d = f.K.skills.find(q => q && q.kind === 'replicate'), life = (d && d.life) || 30;
  f.shadows.forEach(q => q.age += dt);
  const n = f.shadows.length; f.shadows = f.shadows.filter(q => q.age < life);
  if(!f.shadows.length && n && d) shadowsGone(f, d);
}
function endShadowHook(f, keep){   // release the enemy (if latched) and finish the skill
  const S = f.shd; if(!S) return;
  if(S.o && S.o.capturedBy === f.idx){ S.o.capturedBy = null; S.o.capRot = 0; }
  f.shd = null;
  if(!keep){ f.atk = 0; f.A = f.base || f.K.basic; f.atkCd = Math.max(f.atkCd, .2); }
}
function shadowHookStep(f, o, dt){
  const S = f.shd, d = S.d, A = S.A; S.t += dt;
  f.in.l = f.in.r = 0; f.atk = 1;
  if(f.stun > 0 || o.inv > .5 && S.ph > 0 && S.ph < 4){ endShadowHook(f); return; }   // he got hit / the enemy was knocked out: cut
  const kin = () => { f.vx = f.vy = 0; f.gr = false; };
  if(S.ph === 0 || S.ph === 5){        // hook flies out (0), or reels back after a miss (5)
    S.ox = f.x; S.oy = f.y - 30; f.vx = approach(f.vx, 0, 3000 * dt);
    A.ph = 0; A.pp = 0;
    if(S.ph === 0){
      const total = d.speed * dt, n = Math.max(1, Math.ceil(total / 10)); let hit = false;
      for(let i = 0; i < n && !hit; i++){
        S.len = Math.min(d.range, S.len + total / n); S.x = S.ox + S.ax * S.len; S.y = S.oy + S.ay * S.len;
        if(o.inv <= 0 && o.capturedBy == null && S.x + d.r > o.x - o.w / 2 && S.x - d.r < o.x + o.w / 2 && S.y + d.r > o.y - o.h && S.y - d.r < o.y) hit = true;
      }
      if(hit){
        if(o.K.passive && (o.K.passive.kind === 'falseExistence' || o.K.passive.kind === 'errorCorrection') && falseExistence(o, f, {A})){ S.ph = 5; return; }   // it hooked an illusion
        S.ph = 1; S.o = o; S.d0 = Math.hypot(o.x - f.x, o.y - f.y) || 1; S.t = 0;
        o.capturedBy = f.idx; o.capRot = 0; o.vx = o.vy = 0; o.atk = 0; o.stun = 0; o.rush = null; o.hk = null; o.skq = null; o.charging = false; o.chg = 0;   // the hook latches: they cannot act until the kick lands
        G.rings.push({x:o.x, y:o.y - o.h / 2, life:.25});
      }else if(S.len >= d.range) S.ph = 5;
    }else{
      S.len -= d.speed * 1.5 * dt; if(S.len <= 0){ endShadowHook(f); return; }
      S.x = S.ox + S.ax * S.len; S.y = S.oy + S.ay * S.len;
    }
    return;
  }
  if(S.ph === 1){                      // PULL: he flies at the enemy in a straight line
    kin();
    const tx = o.x, ty = o.y, dx = tx - f.x, dy = ty - f.y, m = Math.hypot(dx, dy), st = (d.pull || 1500) * dt;
    S.ox = f.x; S.oy = f.y - 30; S.x = o.x; S.y = o.y - o.h / 2;
    f.face = Math.sign(dx) || f.face; A.ph = 1; A.pp = 1 - Math.min(1, m / S.d0);
    if(m <= st + 6 || S.t > .6){ S.ph = 2; S.ux = m > 1 ? dx / m : f.face; S.uy = m > 1 ? dy / m : 0; S.run = 0; S.fx0 = f.x; return; }
    f.x += dx / m * st; f.y += dy / m * st;
    return;
  }
  if(S.ph === 2){                      // THROUGH: keeps going and passes through their body
    kin(); const thr = d.through || 40, st = (d.pull || 1500) * dt;
    S.run += st; f.x = Math.max(24, Math.min(W - 24, f.x + S.ux * st)); f.y += S.uy * st * .5;
    A.ph = 2; A.pp = Math.min(1, S.run / thr);
    if(S.run >= thr){ S.ph = 3; S.t = 0; f.face = Math.sign(o.x - f.x) || -f.face; for(let i = 0; i < 8; i++) G.parts.push({x:f.x, y:f.y - 26, vx:(Math.random() - .5) * 380, vy:(Math.random() - .5) * 380, life:.35, col:f.c.color}); }
    return;
  }
  if(S.ph === 3){                      // KICK: turns in the air and kicks them back the way he came
    kin(); const T = d.kick || .34; A.ph = 3; A.pp = Math.min(1, S.t / T); f.face = Math.sign(o.x - f.x) || f.face;
    if(!S.hit && A.pp >= .45){
      S.hit = true; o.capturedBy = null; o.capRot = 0;
      hurt(o, {c:f.c, A, face:f.face, src:f});
      for(let i = 0; i < 12; i++) G.parts.push({x:o.x, y:o.y - o.h / 2, vx:f.face * Math.random() * 420, vy:(Math.random() - .7) * 300, life:.4, col:'#9b1c27'});
      if(!f.shd) return;
    }
    if(S.t >= T){
      S.ph = 4; S.t = 0; A.ph = 4; A.pp = 0;
      const away = -(Math.sign(o.x - f.x) || f.face), vy = d.flipUp || 520, air = 2 * vy / GRAV;   // backflip away from the enemy, land somewhere with ground under it
      let vx = 0; for(const q of [away * (d.flip || 340), away * (d.flip || 340) * .55, -away * (d.flip || 340) * .55, 0]){ if(ssupported(f.x + q * air, f.y)){ vx = q; break; } }
      f.vx = vx; f.vy = -vy; f.gr = false; S.air = air;
    }
    return;
  }
  // BACKFLIP: normal physics (gravity, landing); ends when he lands
  A.ph = 4; A.pp = Math.min(1, S.t / (S.air || .45));
  if((S.t > .12 && f.gr) || S.t > (S.air || .45) + .6) endShadowHook(f);
}
function endOnslaught(f, abort){
  const S = f.onsl; if(!S) return;
  f.onsl = null; f.atk = 0; f.A = f.base || f.K.basic; f.atkCd = Math.max(f.atkCd, .25);
  if(S.target && S.target.capturedBy === f.idx){ S.target.capturedBy = null; S.target.capRot = 0; }
}
function onslaughtStep(f, o, dt){
  const S = f.onsl, d = S.d; S.t += dt; o = S.target;
  f.vx = f.vy = 0; f.in.l = f.in.r = 0; f.gr = false; f.atk = S.total - S.t + .05; f.stun = 0;
  o.vx = o.vy = 0; o.atk = 0; o.x = S.cxo; o.y = S.cyo; if(!S.fin) o.capturedBy = f.idx;
  const A = f.A, cl = (v, a, b) => Math.max(a, Math.min(b, v)), ez = u => u * u * (3 - 2 * u), lp = (a, b, k) => a + (b - a) * k;
  const cut = (x, y, big) => G.cuts.push({x, y, a:Math.random() * Math.PI, len:(big ? 70 : 34) + Math.random() * 26, life:big ? .3 : .16, max:big ? .3 : .16, big});
  const tx = S.cxo, ty = S.cyo - o.h / 2, bx = S.back0.x, by = S.back0.y;
  // ---- the shadows: pop out of the ground, jump onto his back in a fan, leap to the ring around the target, then hold the chains ----
  S.copies.forEach((c, i) => {
    c.ppx = c.px; c.ppy = c.py; const n = S.copies.length, mid = (n - 1) / 2, r = S.ring[i % S.ring.length], rx = S.cxo + r.dx, ry = S.cyo + r.dy;
    const kx = bx + S.back * (8 + (mid - Math.abs(i - mid)) * 5), ky = by - 30 + (i - mid) * 13;   // spot on his back (a spread fan)
    let x, y, a = 1;
    if(S.t < S.tA){ a = 0; x = bx; y = by; }
    else if(S.t < S.tG){ const u = cl((S.t - S.tA - i * .05) / .24, 0, 1); a = cl((S.t - S.tA - i * .05) / .08, 0, 1); x = lp(bx + (i - mid) * 34, kx, ez(u)); y = lp(by, ky, ez(u)) - Math.sin(Math.PI * u) * 34; }
    else if(S.t < S.tC){ const u = cl((S.t - S.tG - i * .03) / ((d.chain || .3) * .6), 0, 1); x = lp(kx, rx, ez(u)); y = lp(ky, ry, ez(u)) - Math.sin(Math.PI * u) * 30; }
    else { x = rx + Math.sin(S.t * 18 + c.seed) * (S.fin ? 0 : 1.2); y = ry + Math.cos(S.t * 15 + c.seed) * (S.fin ? 0 : 1.2); }   // holding the chain: little tugs
    c.px = x; c.py = y; c.a = S.fin ? Math.max(0, 1 - (S.t - S.finT) / (S.tRec * .8)) : a;
  });
  S.chainK = S.fin ? 0 : cl((S.t - S.tG - (d.chain || .3) * .35) / ((d.chain || .3) * .65), 0, 1);   // chains grow from the shadows to the target
  // ---- Noctis ----
  if(S.t < S.tG){ A.ph = 4; A.pp = S.t / S.tG; }                  // appears, shadows jump on his back (arms flung back)
  else if(S.t < S.tC){ A.ph = 5; A.pp = (S.t - S.tG) / (S.tC - S.tG); }   // throws the chains
  else if(S.t < S.tF1){                                           // FRENZY: nonstop slashing, he hops between spots close to the target
    A.ph = 0; A.sw = S.sw; A.pp = S.tickT / (d.tick || .09);
    S.tickT += dt;
    if(S.tickT >= (d.tick || .09)){
      S.tickT = 0; S.ticks++; S.sw ^= 1;
      let h; do h = Math.floor(Math.random() * S.hops.length); while(h === S.hop); S.hop = h;
      const q = S.hops[h], px = f.x;
      f.x = Math.max(24, Math.min(W - 24, q.x)); f.y = q.y; f.face = Math.sign(o.x - f.x) || f.face; f.blinkT = G.t; f.blinkDx = px - f.x;
      cut(o.x + (Math.random() - .5) * 14, o.y - o.h / 2 + (Math.random() - .5) * 20, false);
      const tk = {...A, dmg:d.tickDmg, kbx:0, kby:0, stunx:1, shake:.3, noShake:false, noHitstop:true, hitstop:0};
      hurt(o, {c:f.c, A:tk, face:Math.sign(o.x - f.x) || f.face, src:f});
      if(f.onsl !== S) return;                                      // the hit KO'd them / hit an illusion: handled
      o.capturedBy = f.idx; o.stun = 0; o.inv = 0;
    }
  }else if(S.t < S.tW1){            // WIND-UP: he returns behind them and raises both blades (the chains stay tight)
    A.ph = 1; A.pp = (S.t - S.tF1) / (d.windup || .3);
    if(!S.rb){ S.rb = true; const px = f.x; f.x = S.home.x; f.y = S.home.y; f.face = Math.sign(o.x - f.x) || f.face; f.blinkT = G.t; f.blinkDx = px - f.x; }
  }else if(!S.fin){                 // FINISHING SLASH: the chains shatter
    S.fin = true; S.finT = S.t; A.ph = 2; A.pp = 0;
    o.capturedBy = null; o.capRot = 0;
    const face = Math.sign(o.x - f.x) || f.face;
    cut(o.x, o.y - o.h / 2, true); cut(o.x, o.y - o.h / 2, true);
    S.copies.forEach(c => { for(let i = 0; i < 6; i++){ const k = Math.random(); G.parts.push({x:lp(c.px, tx, k), y:lp(c.py - 26, ty, k), vx:(Math.random() - .5) * 300, vy:(Math.random() - .8) * 260, life:.45, col:'#8f95ff'}); } });
    const fa = {...A, dmg:d.finishDmg, kbx:d.kbx, kby:d.kby, stunx:d.stunx, shake:d.shake || 3, noShake:false, noHitstop:false, hitstop:d.hitstop || .14};
    hurt(o, {c:f.c, A:fa, face, src:f});
    if(f.onsl !== S) return;
    for(let i = 0; i < 16; i++) G.parts.push({x:o.x, y:o.y - o.h / 2, vx:face * Math.random() * 520, vy:(Math.random() - .8) * 420, life:.5, col:i % 2 ? '#9b1c27' : '#c9d0ff'});
  }else{
    A.ph = 3; A.pp = Math.min(1, (S.t - S.tW1) / S.tRec);
    if(S.t >= S.total){ f.vy = 0; endOnslaught(f); }
  }
}
// ================= UMBRA =================
let HID = 0;                                                         // unique id per attack (so one attack never gives two fragments)
const smooth = u => u * u * (3 - 2 * u), clampN = (v, a, b) => Math.max(a, Math.min(b, v));
function groundAt(x, yRef){   // the ground a ground-targeted skill lands on: the highest platform top under x that is not above yRef - 40 (null = nothing there)
  let best = null;
  for(const p of G.P){ if(x > p.x + 4 && x < p.x + p.w - 4 && p.y >= yRef - 40 && (best === null || p.y < best)) best = p.y; }
  return best;
}
function groundAim(f, o, d, ax, ay, m){   // Void Claw spot: tap = the enemy's column (if in range, else straight ahead), drag = the finger's sideways offset x range
  const R = d.range || 340;
  let tx = m == null ? (Math.abs(o.x - f.x) <= R ? o.x : f.x + f.face * R * .8) : f.x + ax * clampN(m, 0, 1) * R;
  tx = clampN(tx, 30, W - 30);
  const gy = groundAt(tx, Math.abs(tx - o.x) < 70 ? o.y : f.y);
  return gy == null ? null : {x:tx, y:gy};
}
function segHitsBox(x0, y0, x1, y1, bx0, by0, bx1, by1){   // does the segment cross the box? (slab test)
  let t0 = 0, t1 = 1; const dx = x1 - x0, dy = y1 - y0;
  for(const [p, q] of [[-dx, x0 - bx0], [dx, bx1 - x0], [-dy, y0 - by0], [dy, by1 - y0]]){
    if(Math.abs(p) < 1e-9){ if(q < 0) return false; }
    else{ const r = q / p; if(p < 0){ if(r > t1) return false; if(r > t0) t0 = r; } else{ if(r < t0) return false; if(r < t1) t1 = r; } }
  }
  return true;
}
function stepDest(f, o, d, ax, ay, m){   // Shadow Step destination: the aim point (limited range) snapped to the nearest ground spot; never into or through the enemy
  const R = d.range || 300;
  let px, py;
  if(m == null){ px = f.x + f.face * R * .7; py = f.y - f.h / 2; }
  else{ const k = clampN(m, .25, 1); px = f.x + ax * k * R; py = f.y - f.h / 2 + ay * k * R; }
  const cands = [];
  for(const p of G.P){
    const sx = clampN(clampN(px, p.x + 16, p.x + p.w - 16), 24, W - 24), sy = p.y;
    if(sx < p.x + 6 || sx > p.x + p.w - 6) continue;
    if(Math.hypot(sx - f.x, sy - f.y) > R + 4 || Math.hypot(sx - f.x, sy - f.y) < 24) continue;
    const dd = Math.hypot(sx - px, (sy - f.h / 2) - py); if(dd <= 110) cands.push({x:sx, y:sy, dd});
  }
  cands.sort((a, b) => a.dd - b.dd);
  for(const c of cands){
    if(Math.abs(c.x - o.x) < (o.w + f.w) / 2 + 6 && c.y > o.y - o.h && c.y - f.h < o.y) continue;                                                         // inside the enemy
    if(segHitsBox(f.x, f.y - f.h / 2, c.x, c.y - f.h / 2, o.x - o.w / 2 - 4, o.y - o.h - 4, o.x + o.w / 2 + 4, o.y + 4)) continue;                          // through the enemy
    return {x:c.x, y:c.y};
  }
  return null;
}
// ---- passive ABYSSAL HUNGER ----
function readyFx(f){ G.rings.push({x:f.x, y:f.y - f.h / 2, life:.25}); G.pops.push({x:f.x, y:f.y - f.h - 16, txt:'READY', life:.9}); for(let i = 0; i < 12; i++) G.parts.push({x:f.x, y:f.y - f.h / 2, vx:(Math.random() - .5) * 360, vy:(Math.random() - .8) * 300, life:.5, col:'#8f6bff'}); }
function hungerGain(f){ const P = f.K.passive; if(!P || P.kind !== 'hunger' || f.fr >= P.max) return; f.fr++; if(f.fr >= P.max) readyFx(f); }
function hungerHit(src, o, A, P){   // every landed hit: 1 fragment (once per attack); at full = the hit is empowered (Abyssal Slam) and eats all of them
  if(A.noHunger) return;
  if(A.hid){ if(src.hLast === A.hid) return; src.hLast = A.hid; }
  if(src.fr >= P.max){
    if(o.slam || o.capturedBy != null || src.uhand || o.hp <= 0) return;           // never two lifts / slams at once
    src.fr = 0; startSlam(src, o, P);
    G.pops.push({x:o.x, y:o.y - o.h - 22, txt:'ABYSSAL SLAM', life:.9});
    return;
  }
  hungerGain(src);
}
function startSlam(src, o, P){   // ABYSSAL SLAM: lift, hang, slam (slamStep)
  const gy = groundAt(o.x, o.y - 10);
  o.slam = {src, P, t:0, x:o.x, y0:o.y, gy, up:Math.max(30, Math.min(P.liftH || 90, o.y - o.h - 30)), fall:0};
  o.capturedBy = src.idx; o.capRot = 0; o.vx = o.vy = 0; o.atk = 0; o.rush = null; o.hk = null; o.skq = null; o.charging = false; o.chg = 0; o.stun = 0; o.shd = null;
  o.kdT = 0;
  for(let i = 0; i < 10; i++) G.parts.push({x:o.x + (Math.random() - .5) * 20, y:o.y - Math.random() * o.h, vx:(Math.random() - .5) * 200, vy:-Math.random() * 260, life:.5, col:i % 2 ? '#6a3cff' : '#0a0614'});
}
function slamLand(o, S, dmg, stunSec, shake){   // the ground impact (shared by Abyssal Slam and the ultimate)
  const src = S.src, gx = o.x, gy = S.gy == null ? o.y : S.gy;
  const A = skillA({kind:'abyssalslam', dmg, kbx:0, kby:.25, stunx:stunSec / KB.stun, shake, hitstop:.12}, {noHunger:true, hid:S.hid});
  o.y = gy; o.capturedBy = null; o.capRot = 0;
  hurt(o, {c:src.c, A, face:src.face, src});
  G.waves.push({x:gx, y:gy - 4, r:90, life:.35, max:.35, col:'#8f6bff', fill:'#3a1a8c'});
  for(let i = 0; i < 16; i++) G.parts.push({x:gx + (Math.random() - .5) * 30, y:gy - 2, vx:(Math.random() - .5) * 520, vy:-Math.random() * 300, life:.5, col:i % 2 ? '#8f6bff' : '#0a0614'});
}
function slamStep(o, dt){
  const S = o.slam, P = S.P, src = S.src; S.t += dt;
  const lift = P.lift || .25, hov = P.hover || 1;
  o.x = S.x; o.capturedBy = src.idx; o.capRot = 0; o.vx = o.vy = 0; o.atk = 0; o.stun = 0; o.gr = false; o.skq = null; o.charging = false;
  if(S.t < lift) o.y = S.y0 - S.up * smooth(S.t / lift);
  else if(S.t < lift + hov){
    o.y = S.y0 - S.up + Math.sin(S.t * 12) * 2;
    if(Math.random() < dt * 30) G.parts.push({x:o.x + (Math.random() - .5) * 26, y:o.y - Math.random() * o.h, vx:0, vy:-60, life:.4, col:'#8f6bff'});
  }else{
    S.fall += dt; o.y += (700 + S.fall * 9000) * dt;
    if(S.gy == null || o.y >= S.gy){ o.slam = null; slamLand(o, S, P.slamDmg || 1.6, P.slamStun || 1, 4); }
  }
}
// ---- Void Claw ----
function clawStep(f, o, dt){
  const C = f.vclaw, d = C.d, tc = d.cast || .45, ts = d.swipe || .18, end = tc + ts + (d.linger || 1) + .25;
  C.t += dt;
  if(C.t < tc && f.stun > 0){ f.vclaw = null; return; }          // he was hit while reaching out: the claw never comes
  if(!C.hit && C.t >= tc + ts * .35){
    C.hit = true;
    G.shake = Math.max(G.shake, .22); G.hs = Math.max(G.hs || 0, .05);
    for(let i = 0; i < 16; i++) G.parts.push({x:C.x + (Math.random() - .5) * d.halfW * 1.6, y:C.gy - 2, vx:(Math.random() - .5) * 420, vy:-Math.random() * 380, life:.5, col:i % 2 ? '#8f6bff' : '#0a0614'});
    if(o.inv <= 0 && o.capturedBy == null && !o.slam && Math.abs(o.x - C.x) < d.halfW + o.w / 2 && o.y > C.gy - d.height && o.y - o.h < C.gy + 6){
      const A = skillA(d, {hid:C.hid, kbx:0, kby:d.kby, stunx:d.stunx, dmg:d.dmg, shake:2.5, hitstop:.1});
      const hp0 = o.hp; hurt(o, {c:f.c, A, face:C.dir, src:f});
      if(o.hp > 0 && o.hp < hp0 && !o.slam){ o.kdT = 2.5; o.kdDur = d.kd || 1; }   // lands = knocked down
    }
  }
  if(C.t >= end) f.vclaw = null;
}
// ---- FULMINAR: lightning effects, Static Charge, Thunder Burst, Lightning Step, Skyfall, Storm of Ruin ----
function mkBolt(x, y1, y0){   // a jagged lightning bolt from the sky (y0) down to y1; drawn by drawBolts
  y0 = y0 == null ? -30 : y0; const n = 9, pts = [[x + (Math.random() - .5) * 40, y0]];
  for(let i = 1; i < n; i++) pts.push([x + (Math.random() - .5) * 34 * (1 - i / n * .6), y0 + (y1 - y0) * i / n]);
  pts.push([x, y1]);
  (G.bolts = G.bolts || []).push({pts, life:.28, max:.28});
  G.waves.push({x, y:y1 - 2, r:34, life:.22, max:.22, col:'#7df3ff', fill:'#00e5ff'});
  for(let i = 0; i < 8; i++) G.parts.push({x:x + (Math.random() - .5) * 16, y:y1 - 2, vx:(Math.random() - .5) * 420, vy:-Math.random() * 360, life:.4, col:i % 2 ? '#7df3ff' : '#ffffff'});
}
function strikeHits(o, x, gy, w){   // does a bolt that lands at (x, gy) hit the enemy? (the whole column above the ground is dangerous)
  return o.inv <= 0 && o.hp > 0 && o.capturedBy == null && !o.slam && Math.abs(o.x - x) < w + o.w / 2 && o.y <= gy + 8;
}
// PASSIVE STATIC CHARGE (passive:{kind:'static', max, bonus}): every landed attack = 1 charge (once per attack, so multi-hit skills count once). At `max` the NEXT landed attack calls a
// lightning strike on the enemy for `bonus` x that attack's damage, and all charges are spent. Missed attacks give nothing.
function staticHit(src, o, A, P){
  if(A.noStatic) return;
  if(A.hid){ if(src.stLast === A.hid) return; src.stLast = A.hid; }
  const max = P.max || 6;
  if((src.stc || 0) >= max){
    src.stc = 0;
    let b = LASTDMG * (P.bonus == null ? .3 : P.bonus);
    if(o.hp <= 0 || b <= 0) return;
    mkBolt(o.x, o.y - 4);
    if(o.bar > 0){ const ab = Math.min(o.bar, b); o.bar -= ab; b -= ab; }
    o.hp -= b; G.pops.push({x:o.x + 12, y:o.y - o.h - 22, txt:b > 0 ? Math.round(b) : 'BLOCK', life:.8});
    G.pops.push({x:src.x, y:src.y - src.h - 34, txt:'STATIC STRIKE', life:.8});
    return;
  }
  src.stc = (src.stc || 0) + 1;
  if(src.stc >= max){
    G.rings.push({x:src.x, y:src.y - src.h / 2, life:.25}); G.pops.push({x:src.x, y:src.y - src.h - 34, txt:'FULLY CHARGED', life:.9});
    for(let i = 0; i < 12; i++) G.parts.push({x:src.x, y:src.y - src.h / 2, vx:(Math.random() - .5) * 360, vy:(Math.random() - .8) * 300, life:.5, col:i % 2 ? '#00e5ff' : '#ffffff'});
  }
}
// HELD ATTACK THUNDER BURST (basic.burst:{norm:{...}, full:{...}}): hold ATK to charge, let go = an expanding shockwave around him. Two stages: released early = `norm`, fully charged = `full`
// (r = radius px, dmg, kbx / kby / stunx / shake / hitstop like any hit). Enemies inside take damage and are pushed away from him.
function thunderBurst(f, o, A, L){
  const full = L >= 1, S = full ? A.burst.full : A.burst.norm;
  f.A = {...A, hitFrom:0, hitTo:0, cl:L}; f.comboT = 0; f.vx = 0;
  const mx = f.x, my = f.y - f.h / 2;
  G.waves.push({x:mx, y:my, r:S.r, life:.34, max:.34, col:'#7df3ff', fill:'#00e5ff'});
  G.waves.push({x:mx, y:my, r:S.r * .6, life:.24, max:.24, col:'#ffffff', fill:'#7df3ff'});
  G.rings.push({x:mx, y:my, life:.25}); G.shake = Math.max(G.shake, full ? .35 : .18); G.hs = Math.max(G.hs || 0, full ? .08 : .04);
  for(let i = 0; i < (full ? 26 : 14); i++){ const a = Math.random() * 7, v = 200 + Math.random() * S.r * 2.2; G.parts.push({x:mx, y:my, vx:Math.cos(a) * v, vy:Math.sin(a) * v - 60, life:.45, col:i % 2 ? '#00e5ff' : '#ffffff'}); }
  if(full){ G.pops.push({x:mx, y:f.y - f.h - 34, txt:'THUNDER BURST', life:.8}); for(let i = 0; i < 3; i++) mkBolt(mx + (i - 1) * S.r * .55, f.y - 2, f.y - 150 - Math.random() * 90); }
  if(!o || o.hp <= 0 || o.inv > 0 || o.capturedBy != null || o.slam) return;
  const dx = o.x - mx, dy = (o.y - o.h / 2) - my;
  if(Math.hypot(dx, dy) > S.r + o.w / 2) return;
  const Ah = skillA({kind:'thunderburst', dmg:S.dmg, kbx:S.kbx, kby:S.kby, stunx:S.stunx, shake:S.shake, hitstop:S.hitstop}, {hid:++HID});
  hurt(o, {c:f.c, A:Ah, face:Math.sign(dx) || f.face, src:f});   // pushed away from him
}
// SKILL I LIGHTNING STEP (see SKILLS.lightningstep): joystick = move (fast), JUMP works, touching the enemy hurts them (small knockback), every `rehit` s. One Static Charge per cast at most.
function lightStep(f, o, dt){
  const L = f.ls, d = L.d; L.t += dt;
  const q = f.skq; f.skq = null;
  const qd = q && slotDef(f, q.i); if(qd && qd.kind === 'lightningstep') L.t = d.dur;   // press the skill again = turn back early
  const dir = f.in.r - f.in.l, sp = f.c.spd * 52 * d.speed;
  if(dir){ f.face = dir; f.vx = approach(f.vx, dir * sp, 7000 * dt); } else f.vx = approach(f.vx, 0, 3500 * dt);
  f.atk = 0; f.charging = false; f.chg = 0; f.A = f.base || f.K.basic;
  if(f.jq && f.jumps > 0){ f.vy = f.jumps === 2 ? -840 : -780; f.jumps--; f.gr = false; }
  if(f.dq && f.gr){ f.drop = .22; f.y += 3; f.gr = false; }
  f.inv = Math.max(f.inv, .1);
  L.hitT -= dt;
  if(L.hitT <= 0 && o && o.inv <= 0 && o.hp > 0 && o.capturedBy == null && !o.slam && Math.abs(f.x - o.x) < (f.w + o.w) / 2 + 6 && f.y - f.h < o.y && f.y > o.y - o.h){
    L.hitT = d.rehit; G.rings.push({x:o.x, y:o.y - o.h / 2, life:.25});
    hurt(o, {c:f.c, A:skillA(d, {hid:L.hid, noShake:true}), face:f.face, src:f});
  }
  if(Math.random() < dt * 60) G.parts.push({x:f.x + (Math.random() - .5) * 14, y:f.y - f.h / 2 + (Math.random() - .5) * 20, vx:-f.face * 80 * Math.random(), vy:(Math.random() - .5) * 120, life:.3, col:Math.random() < .5 ? '#00e5ff' : '#ffffff'});
  if(L.t >= d.dur) endLightStep(f);
}
function endLightStep(f){
  f.ls = null; f.inv = Math.max(.15, 0); f.vx *= .4; f.A = f.base || f.K.basic;
  G.rings.push({x:f.x, y:f.y - f.h / 2, life:.25});
  for(let i = 0; i < 10; i++) G.parts.push({x:f.x, y:f.y - f.h / 2, vx:(Math.random() - .5) * 360, vy:(Math.random() - .5) * 360, life:.4, col:i % 2 ? '#00e5ff' : '#ffffff'});
}
// SKILL II SKYFALL: marked circle on the ground, then bolts land one after another across it (each hits the column above its spot: damage + a short stun).
function skyStep(f, o, dt){
  const C = f.sky, d = C.d; C.t += dt;
  if(C.t < d.cast && f.stun > 0){ f.sky = null; return; }          // hit while calling the storm: nothing comes
  C.hits.forEach(h => {
    if(h.done || C.t < h.at) return; h.done = true;
    const gy = groundAt(h.x, C.gy - 6) ?? C.gy; mkBolt(h.x, gy); G.shake = Math.max(G.shake, .1);
    if(o && strikeHits(o, h.x, gy, d.strikeW) && o.y > gy - d.height){
      hurt(o, {c:f.c, A:skillA(d, {hid:C.hid, kbx:0, kby:d.kby, stunx:d.stunx, dmg:d.dmg, shake:1, hitstop:.03, noShake:true}), face:Math.sign(o.x - h.x) || f.face, src:f});
    }
  });
  if(C.t >= C.total) f.sky = null;
}
// ULTIMATE STORM OF RUIN: strikes at random spots with no warning, `bias` of them near the enemy (off to the side by up to `spread` px, so moving away works), starting every `i0` s and
// getting faster until every `i1` s. Three phases (formation, intensification, maximum tempest) by thirds of the duration.
function stormStep(f, o, dt){
  const C = f.storm, d = C.d; C.t += dt;
  if(C.t < d.cast && f.stun > 0){ f.storm = null; return; }       // hit while summoning it: it fizzles
  const k = Math.max(0, Math.min(1, (C.t - d.cast) / (d.dur - d.cast))), ph = k < 1 / 3 ? 0 : k < 2 / 3 ? 1 : 2;
  if(ph > C.ph){ C.ph = ph; G.pops.push({x:f.x, y:f.y - f.h - 34, txt:ph === 1 ? 'INTENSIFYING' : 'MAXIMUM TEMPEST', life:.9}); }
  while(C.t >= C.next && C.t < d.dur){
    const kk = Math.max(0, Math.min(1, (C.next - d.cast) / (d.dur - d.cast)));
    C.next += d.i0 + (d.i1 - d.i0) * kk;
    let x; const near = o && o.hp > 0 && Math.random() < d.bias;
    if(near) x = o.x + (Math.random() < .5 ? -1 : 1) * (14 + Math.random() * d.spread); else x = 24 + Math.random() * (W - 48);
    x = clampN(x, 20, W - 20);
    const gy = groundAt(x, 0); if(gy == null){ mkBolt(x, H); continue; }
    mkBolt(x, gy); G.shake = Math.max(G.shake, .06);
    if(o && strikeHits(o, x, gy, d.strikeW)){
      hurt(o, {c:f.c, A:skillA(d, {hid:C.hid, kbx:0, kby:d.kby, stunx:d.stunx, dmg:d.dmg, shake:1, hitstop:.02, noShake:true}), face:Math.sign(o.x - x) || f.face, src:f});
    }
  }
  if(C.t >= d.dur) f.storm = null;
}
function drawBolts(){
  (G.bolts || []).forEach(b => {
    const a = Math.max(0, b.life / b.max); cx.save(); cx.lineJoin = 'round'; cx.lineCap = 'round';
    [[10, 'rgba(0,229,255,' + (.3 * a) + ')'], [4, 'rgba(125,243,255,' + a + ')'], [1.8, 'rgba(255,255,255,' + a + ')']].forEach(([w, c]) => {
      cx.strokeStyle = c; cx.lineWidth = w; cx.beginPath(); b.pts.forEach((p, i) => i ? cx.lineTo(p[0], p[1]) : cx.moveTo(p[0], p[1])); cx.stroke();
    });
    cx.restore();
  });
}
function drawBall(f){   // the ball of lightning that replaces his body during Lightning Step
  const x = f.x, y = f.y - f.h / 2, t = G.t, r = 14 + 2 * Math.sin(t * 40);
  cx.globalAlpha = 1;
  const g = cx.createRadialGradient(x, y, 2, x, y, r * 3);
  g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(.35, 'rgba(0,229,255,.55)'); g.addColorStop(1, 'rgba(0,229,255,0)');
  cx.fillStyle = g; cx.beginPath(); cx.arc(x, y, r * 3, 0, 7); cx.fill();
  cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(x, y, r * .6, 0, 7); cx.fill();
  cx.lineCap = 'round';
  for(let i = 0; i < 6; i++){
    const a = Math.random() * 6.3, r1 = r * .6, r2 = r * (1.6 + Math.random() * .9);
    cx.strokeStyle = i % 2 ? 'rgba(125,243,255,.95)' : 'rgba(255,255,255,.95)'; cx.lineWidth = 1.6;
    cx.beginPath(); cx.moveTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1);
    cx.lineTo(x + Math.cos(a + .3) * (r1 + r2) / 2, y + Math.sin(a + .3) * (r1 + r2) / 2); cx.lineTo(x + Math.cos(a - .1) * r2, y + Math.sin(a - .1) * r2); cx.stroke();
  }
}
function drawSkyZones(){   // Skyfall: the target circle on the ground while he calls the strikes
  G.f.forEach(f => {
    const C = f.sky; if(!C || C.t > C.total - .3) return;
    const d = C.d, pu = .6 + .4 * Math.sin(G.t * 16), k = Math.min(1, C.t / d.cast);
    cx.save(); cx.strokeStyle = 'rgba(125,243,255,' + (.5 + .4 * pu) + ')'; cx.fillStyle = 'rgba(0,229,255,' + (.1 + .12 * pu * k) + ')'; cx.lineWidth = 3;
    cx.beginPath(); cx.ellipse(C.x, C.gy - 2, d.radius, d.radius * .28, 0, 0, 7); cx.fill(); cx.stroke();
    cx.globalAlpha = .6; cx.beginPath(); cx.ellipse(C.x, C.gy - 2, d.radius * k, d.radius * .28 * k, 0, 0, 7); cx.stroke(); cx.restore();
  });
}
function drawStormClouds(){   // Storm of Ruin: the typhoon over the whole arena (darker, more swirling and more flashes as it intensifies)
  G.f.forEach(f => {
    const C = f.storm; if(!C) return;
    const d = C.d, fade = Math.min(1, C.t / (d.cast + .8)) * (C.t > d.dur - .8 ? Math.max(0, (d.dur - C.t) / .8) : 1);
    const prog = Math.max(0, Math.min(1, (C.t - d.cast) / (d.dur - d.cast))), I = fade * (.5 + .5 * prog);
    cx.save();
    const g = cx.createLinearGradient(0, 0, 0, H * .5); g.addColorStop(0, 'rgba(6,14,34,' + (.7 * I) + ')'); g.addColorStop(1, 'rgba(6,14,34,0)');
    cx.fillStyle = g; cx.fillRect(0, 0, W, H * .5);
    for(let i = 0; i < 16; i++){
      const a = G.t * (.5 + prog * 1.3) + i * .62, rx = W * (.12 + .38 * (i / 16));
      cx.fillStyle = 'rgba(30,48,86,' + (.3 * fade) + ')'; cx.beginPath(); cx.ellipse(W / 2 + Math.cos(a) * rx, 34 + Math.sin(a) * 16 + i * 3, 80 + i * 4, 22, 0, 0, 7); cx.fill();
      if(Math.sin(G.t * 31 + i * 5.3) > .985 - prog * .03){ cx.fillStyle = 'rgba(170,240,255,' + (.28 * fade) + ')'; cx.fill(); }   // a flash inside the clouds
    }
    cx.restore();
  });
}

// ---- Hand of the Abyss ----
function endHand(f){
  const S = f.uhand; if(!S) return;
  if(S.target && S.target.capturedBy === f.idx && !S.target.slam){ S.target.capturedBy = null; S.target.capRot = 0; }
  f.uhand = null; f.atk = 0; f.A = f.base || f.K.basic; f.atkCd = Math.max(f.atkCd, .25);
}
function handStep(f, o, dt){
  const S = f.uhand, d = S.d, P = f.K.passive; o = S.target; S.t += dt;
  f.vx = approach(f.vx, 0, 3000 * dt); f.in.l = f.in.r = 0; f.stun = 0; f.atk = S.total - S.t + .05;
  const A = f.A, lp = (a, b, k) => a + (b - a) * k, t = S.t;
  const lock = () => { o.capturedBy = f.idx; o.capRot = 0; o.vx = o.vy = 0; o.atk = 0; o.stun = 0; o.gr = false; o.skq = null; o.charging = false; o.rush = null; o.hk = null; };
  const hit = (dmg, shake, hs) => { const A2 = skillA({kind:'abysshand', dmg, kbx:0, kby:0, stunx:1, shake, hitstop:hs}, {noHunger:true, noHitstop:!hs, hid:S.hid}); hurt(o, {c:f.c, A:A2, face:f.face, src:f}); if(f.uhand !== S) return false; lock(); o.inv = 0; return true; };
  S.riftK = clampN(t / d.rift, 0, 1) * (t > S.c6 + d.sink * .5 ? clampN(1 - (t - S.c6 - d.sink * .5) / (d.sink * .5), 0, 1) : 1);
  if(t < S.c1){                                                    // 1. the rift opens under the enemy (it follows them)
    A.ph = 0; A.pp = t / S.c1; S.x = o.x; S.y0 = o.y; const g = groundAt(o.x, o.y); S.gy = g == null ? o.y : g; S.hasGround = g != null; S.hy = S.gy + 50; S.alpha = 0;
  }else if(t < S.c2){                                              // 2. the hand rises out of the rift
    A.ph = 1; A.pp = (t - S.c1) / d.rise; S.alpha = 1; S.x = o.x; S.y0 = o.y;
    S.hy = lp(S.gy + 50, o.y + 12, smooth((t - S.c1) / d.rise));
  }else{
    if(!S.grabbed){                                                // 3. GRABS: from now on they cannot move, jump, attack or use skills
      S.grabbed = true; S.x = o.x; S.y0 = o.y; lock(); S.up = Math.max(30, Math.min(d.liftH, o.y - o.h - 30));
      if(P && P.kind === 'hunger' && f.fr >= P.max){ S.emp = true; f.fr = 0; G.pops.push({x:o.x, y:o.y - o.h - 22, txt:'ABYSSAL SLAM', life:.9}); }   // the passive is spent right here, once; its slam is folded into this one
      G.rings.push({x:o.x, y:o.y - o.h / 2, life:.25}); G.shake = Math.max(G.shake, .18);
    }
    if(!S.slammed){ o.x = S.x; lock(); }                           // (after the impact they are free: knocked down, no more locking)
    if(t < S.c3){                                                  // 4. lifts them
      A.ph = 1; A.pp = 1; const k = smooth((t - S.c2) / d.lift); o.y = S.y0 - S.up * k; S.hy = o.y + 12; S.curl = .08 * k;
    }else if(t < S.c4){                                            // 5. the fingers slowly close; squeezes
      A.ph = 2; A.pp = (t - S.c3) / d.close; o.y = S.y0 - S.up; S.hy = o.y + 12; S.curl = lp(.08, .92, smooth((t - S.c3) / d.close));
      while(S.tickN < d.ticks && (t - S.c3) / d.close >= (S.tickN + .5) / d.ticks){ S.tickN++; if(!hit(d.tickDmg, .6, 0)) return; }
    }else if(t < S.c5){                                            // 6. CRUSH
      A.ph = 2; A.pp = 1; o.y = S.y0 - S.up; S.hy = o.y + 12; S.curl = 1;
      if(!S.crushed){ S.crushed = true; if(!hit(d.crushDmg, 3, .1)) return; for(let i = 0; i < 14; i++) G.parts.push({x:o.x, y:o.y - o.h / 2, vx:(Math.random() - .5) * 460, vy:(Math.random() - .5) * 460, life:.5, col:i % 2 ? '#8f6bff' : '#b3202a'}); }
    }else if(t < S.c6){                                            // 7. SLAM: hand and enemy go down fast
      A.ph = 3; A.pp = (t - S.c5) / d.slam; const k = smooth((t - S.c5) / d.slam), gy = S.hasGround ? S.gy : S.y0;
      o.y = lp(S.y0 - S.up, gy, k); S.hy = o.y + 12; S.curl = 1;
    }else{
      if(!S.slammed){                                              // impact: the enemy is released, knocked down
        S.slammed = true; const gy = S.hasGround ? S.gy : S.y0; o.y = gy; S.hy = gy + 12;
        const bonus = S.emp ? (P.slamDmg || 1.6) : 0, kd = S.emp ? (P.slamStun || 1) + .4 : (d.kd || 1.2);
        slamLand(o, {src:f, gy:S.hasGround ? S.gy : null, hid:S.hid}, d.slamDmg + bonus, kd, S.emp ? 5 : 4);
        if(f.uhand !== S) return;
        if(!S.emp) hungerGain(f);                                  // a hit that was not empowered = +1 fragment
      }
      A.ph = 4; A.pp = (t - S.c6) / d.sink;                        // 8. the hand sinks back into the rift
      S.hy = lp(S.gy + 12, S.gy + 70, smooth(A.pp)); S.curl = lp(1, .3, A.pp); S.alpha = 1 - clampN((A.pp - .6) / .4, 0, 1);
      if(t >= S.total){ endHand(f); return; }
    }
  }
}
// CAN[kind](f, o, d) = a skill that is only allowed to cast when this is true. If it is false the cast is cancelled and NO cooldown is used.
const CAN = {
  finalcurtain(f){ return !f.fc && !(f.rec > 0) && !f.fl; },
  grandentrance(f, o, d, ax, ay, m){ return !!groundAim(f, o, d, ax, ay, m); },
  wintergrasp(f, o, d, ax, ay, m){ return !!groundAim(f, o, d, ax, ay, m); },         // there must be ground at the chosen spot
  crystalcoffin(f, o, d, ax, ay, m){ return !!groundAim(f, o, d, ax, ay, m); },
  dimimpale(f, o, d, ax, ay, m){ return !!groundAim(f, o, d, ax, ay, m); },
  shatteredgravity(f, o, d, ax, ay, m){ return !!groundAim(f, o, d, ax, ay, m); },
  iceage(f){ return !f.ice; },                                                         // one Ice Age at a time
  voidclaw(f, o, d, ax, ay, m){ return !!groundAim(f, o, d, ax, ay, m); },            // there must be ground at the chosen spot
  skyfall(f, o, d, ax, ay, m){ return !!groundAim(f, o, d, ax, ay, m); },
  stormofruin(f){ return !f.storm; },                                                   // one storm at a time
  shadowstep(f, o, d, ax, ay, m){ return !!stepDest(f, o, d, ax, ay, m); },           // a valid, free spot
  abysshand(f, o, d){ return !!o && o.inv <= .2 && !o.slam && !o.capturedBy && !o.onsl && !o.slaughter && Math.hypot(o.x - f.x, o.y - f.y) <= (d.range || 300); },
  onslaught(f, o, d){   // an enemy inside d.range px (and not already caught / spawn-protected)
    if(!o || o.inv > .2 || o.slaughter || o.capturedBy != null || o.onsl) return false;
    return Math.hypot(o.x - f.x, (o.y - o.h / 2) - (f.y - f.h / 2)) <= (d.range || 300);
  },
  heavensverdict(f, o, d){ return !!o && o.inv <= .2 && Math.hypot(o.x - f.x, o.y - f.y) <= d.range; },   // an enemy inside the casting range (not spawn-protected)
  slaughterhouse(f, o, d){
    if(!o || o.inv > .2 || o.slaughter || o.capturedBy != null) return false;           // not while they are spawn-protected or already caught
    return Math.hypot(o.x - f.x, (o.y - o.h / 2) - (f.y - f.h / 2)) <= d.grab;           // enemy must be inside d.grab px
  }
};
function castSkill(f, o, q){
  const d = slotDef(f, q.i); if(!d || !SKILLS[d.kind]) return;
  if(f.snipe) return;                                         // aiming the sniper rifle: no skills until he lets go
  if(f.fc || f.rec > 0 || f.fl) return;                       // Final Curtain: the beast has NO skills, and he cannot act while he recovers
  if(f.atk > 0 && f.A && f.A.skill === 'quake') return;      // the ultimate wind-up cannot be cancelled by another skill
  if(f.ice && f.ice.ph === 'cast') return;                    // neither can the Ice Age cast
  if(f.rootT > 0 && (['rush', 'shadowstep', 'shadowhook', 'sacredcharge', 'lightningstep'].includes(d.kind) || (d.kind === 'replicate' && f.shadows.length))){ if(f === G.f[0]) G.pops.push({x:f.x, y:f.y - f.h - 14, txt:'TRAPPED', life:.7}); return; }   // Crystal Coffin: no dashes / teleports out of the ice
  let slot = 0;
  if(q.i < 2){ slot = f.sk[q.i].cd.findIndex(c => c <= 0); if(slot < 0) return; } else if(f.uc > 0) return;
  let ax = q.ax, ay = q.ay;
  if(!d.aim || !q.drag){ ax = f.face; ay = 0; }               // tap / key / non-aimed skill = straight ahead
  const mm = (d.aim && q.drag) ? (q.m ?? 1) : null;            // how far the finger was dragged (0..1); null = a tap
  if(CAN[d.kind] && !CAN[d.kind](f, o, d, ax, ay, mm)){ if(f === G.f[0]) G.pops.push({x:f.x, y:f.y - f.h - 14, txt:d.failTxt || 'TOO FAR', life:.7}); return; }   // not allowed right now: cancel, keep the cooldown
  if(Math.abs(ax) > .12) f.face = ax > 0 ? 1 : -1;            // turn toward the aim
  if(q.i < 2) f.sk[q.i].cd[slot] = d.toggle ? 0 : (d.recharge || d.cd || 5); else f.uc = d.cd || 30;   // toggle skills start their cooldown when turned OFF
  f.comboT = 0; f.charging = false; f.chg = 0; f.aqB = 0;      // a skill cancels a basic swing in progress
  SKILLS[d.kind](f, o, d, ax, ay, mm);
}
function rushStep(f, o, dt){
  const R = f.rush, d = R.d, nx = f.x + R.dir * R.spd * dt;
  const wall = x => G.P.some(p => x + f.w / 2 > p.x && x - f.w / 2 < p.x + p.w && f.y > p.y + 2 && f.y - f.h < p.y + p.h);   // side of a platform in his way
  f.face = R.dir; f.vx = 0; f.vy = 0;
  if(wall(nx) && !wall(f.x)){                                   // WALL: crash, brief self-stun, no damage
    f.rush = null; f.atk = 0; f.stun = d.wallStun || .9; f.flash = .12; G.shake = .2; G.hs = .06;
    G.rings.push({x:f.x + R.dir * f.w / 2, y:f.y - f.h / 2, life:.25});
    for(let i = 0; i < 12; i++) G.parts.push({x:f.x + R.dir * f.w / 2, y:f.y - f.h / 2, vx:-R.dir * Math.random() * 300, vy:(Math.random() - .8) * 300, life:.4, col:'#b9b2a8'});
    return;
  }
  f.x = nx; R.left -= R.spd * dt;
  if(o.inv <= 0 && Math.abs(f.x - o.x) < (f.w + o.w) / 2 && f.y - f.h < o.y && f.y > o.y - o.h){   // first enemy: crush + push back, rush ends
    hurt(o, {c:f.c, A:f.A, face:R.dir, src:f});
    f.rush = null; f.atk = 0; f.vx = R.dir * 120; return;
  }
  if(R.left <= 0){ f.rush = null; f.atk = 0; f.vx = R.dir * 150; }
}
function quakeHit(f, o){
  const d = slotDef(f, 2), mx = f.x, my = f.y - f.h / 2;
  f.quaked = true; G.shake = .4; G.hs = .12;
  G.waves.push({x:mx, y:my, r:d.radius, life:.45, max:.45});
  for(let i = 0; i < 24; i++) G.parts.push({x:f.x + (Math.random() - .5) * 60, y:f.y, vx:(Math.random() - .5) * 700, vy:-Math.random() * 450, life:.5, col:'#b9b2a8'});
  if(o.inv <= 0 && Math.hypot(o.x - mx, (o.y - o.h / 2) - my) <= d.radius) hurt(o, {c:f.c, A:f.A, face:Math.sign(o.x - f.x) || f.face, src:f});
}
function hookStep(f, o, dt){
  const h = f.hk, d = h.d;
  h.ox = f.x; h.oy = f.y - 30; h.t += dt;
  if(f.stun > 0 || (h.ph === 1 && o.inv > .5)){ f.hk = null; return; }   // he got hit / the enemy was knocked out: chain cut
  if(h.ph === 0){
    const total = d.speed * dt, n = Math.max(1, Math.ceil(total / 10)); let hit = false;   // small steps so a fast hook cannot jump over the enemy
    for(let i = 0; i < n && !hit; i++){
      h.len = Math.min(d.range, h.len + total / n); h.x = h.ox + h.ax * h.len; h.y = h.oy + h.ay * h.len;
      if(o.inv <= 0 && h.x + d.r > o.x - o.w / 2 && h.x - d.r < o.x + o.w / 2 && h.y + d.r > o.y - o.h && h.y - d.r < o.y) hit = true;
    }
    if(hit){ hurt(o, {c:f.c, A:h.A, face:Math.sign(o.x - f.x) || f.face, src:f}); if(f.hk){ h.ph = 1; h.t = 0; } }
    else if(h.len >= d.range) h.ph = 2;
  }else if(h.ph === 1){
    const dir = Math.sign(o.x - f.x) || f.face, tx = f.x + dir * (f.w / 2 + o.w / 2 + 6), ty = f.y;
    const dx = tx - o.x, dy = ty - o.y, m = Math.hypot(dx, dy), st = d.pull * dt;
    o.stun = Math.max(o.stun, .12); o.vx = o.vy = 0;                      // dragged: cannot act
    if(m <= st + 3 || h.t > 1.2){ o.x = tx; o.stun = Math.max(o.stun, d.endStun || .3); f.hk = null; return; }
    o.x += dx / m * st; o.y += dy / m * st; f.face = dir;
    h.x = o.x; h.y = o.y - o.h / 2; h.len = Math.hypot(h.x - h.ox, h.y - h.oy);
  }else{
    h.len -= d.speed * 1.4 * dt; if(h.len <= 0){ f.hk = null; return; }
    h.x = h.ox + h.ax * h.len; h.y = h.oy + h.ay * h.len;
  }
}
// ---- PASSIVE DIVINE RETRIBUTION (Paladin) ----
// skills.js passive:{kind:'retribution', max, radius, dmg, kbx, kby, stunx}. Every enemy attack that damages him = 1 Divine Charge (max `max`). One charge per ATTACK, never per damage tick:
// an attack is told apart by its id (A.hid: projectiles, Umbra skills) or else by the attacker's attack token (f.atkTok, bumps each time a new swing / skill starts).
// At full charges the passive is READY: the NEXT attack of his that connects (basic or skill) also releases a holy shockwave on that same hit: holy damage + knockback away from him, all charges spent.
function atkToken(f){   // a new attack started = a new token (A object changed, or the attack timer jumped up)
  if(f.A !== f.tA || f.atk > f.tAtk + .02) f.atkTok++;
  f.tA = f.A; f.tAtk = f.atk;
  return f.atkTok;
}
function retributionGain(o, src, A){
  const P = o.K.passive, key = A.hid ? 'h' + A.hid : 's' + src.idx + ':' + atkToken(src);
  if(o.dvKey === key) return;                       // the same attack again (extra damage tick): no extra charge
  o.dvKey = key;
  if(o.dv >= P.max) return;
  o.dv++;
  G.rings.push({x:o.x, y:o.y - o.h / 2, life:.2});
  if(o.dv >= P.max){ G.pops.push({x:o.x, y:o.y - o.h - 22, txt:'RETRIBUTION READY', life:1}); G.rings.push({x:o.x, y:o.y - o.h / 2, life:.3}); for(let i = 0; i < 14; i++) G.parts.push({x:o.x, y:o.y - o.h / 2, vx:(Math.random() - .5) * 340, vy:(Math.random() - .8) * 300, life:.5, col:i % 2 ? '#ffe08a' : '#ffffff'}); }
}
function retributionHit(src, o, A, P){   // runs inside the hit that connects (hurt -> onLanded), so the shockwave lands together with it
  if(A.noRetri || src.dv < P.max || o.hp <= 0) return;
  src.dv = 0; src.dvKey = null;
  const cxp = src.x, cyp = src.y - src.h / 2, dir = Math.sign(o.x - src.x) || src.face;
  G.waves.push({x:cxp, y:src.y - 4, r:P.radius, life:.4, max:.4, col:'#ffe08a', fill:'#e3b53c'});
  G.rings.push({x:cxp, y:cyp, life:.3}); G.shake = Math.max(G.shake, .25);
  G.pops.push({x:src.x, y:src.y - src.h - 22, txt:'DIVINE RETRIBUTION', life:1});
  for(let i = 0; i < 22; i++) G.parts.push({x:cxp + (Math.random() - .5) * 30, y:src.y - Math.random() * 10, vx:(Math.random() - .5) * 620, vy:-Math.random() * 360, life:.55, col:i % 3 ? '#ffe08a' : '#ffffff'});
  if(Math.hypot(o.x - cxp, (o.y - o.h / 2) - cyp) > P.radius) return;     // outside the (small) shockwave: no damage, the charges are still spent
  let dmg = (10 + src.c.hp / 40) * 2.2 * (1 - armOf(o) / 50) * P.dmg, shown;
  if(o.bar > 0){ const ab = Math.min(o.bar, dmg); o.bar -= ab; dmg -= ab; }
  shown = Math.round(dmg);
  o.hp -= dmg;
  G.pops.push({x:o.x + (Math.random() - .5) * 16, y:o.y - o.h - 22, txt:shown, life:.8});
  if(o.capturedBy == null && !o.slam){                                      // knockback: away from the Paladin (not while they are held by a grab / slam)
    o.vx = dir * KB.x * (P.kbx ?? 1); o.vy = KB.y * (P.kby ?? 1); o.gr = false;
    o.stun = Math.max(o.stun, KB.stun * (P.stunx || 1)); o.inv = Math.max(o.inv, .15); o.flash = .12;
  }
}
// ---- ULTIMATE HEAVEN'S VERDICT (Paladin) ----
// G.verdicts = [{src, x, y, t, d, hit}]. At t = d.delay the shield lands: every enemy inside d.radius px of (x, y) takes d.dmg (a big hit, blasted away from the center) and gets -d.armorDown armor for d.armorDur s.
// Enemies that left the area (or are spawn-protected) are not touched.
function verdictLand(V){
  const d = V.d, f = V.src, X = V.x, Y = V.y;
  G.shake = Math.max(G.shake, .5); G.hs = Math.max(G.hs || 0, .12);
  G.waves.push({x:X, y:Y - 6, r:d.radius * 1.1, life:.6, max:.6, col:'#ffe08a', fill:'#e3b53c'});
  G.waves.push({x:X, y:Y - 6, r:d.radius * .6, life:.4, max:.4, col:'#ffffff', fill:'#ffe08a'});
  G.rings.push({x:X, y:Y - 10, life:.3});
  for(let i = 0; i < 44; i++) G.parts.push({x:X + (Math.random() - .5) * d.radius * 1.4, y:Y - Math.random() * 8, vx:(Math.random() - .5) * 700, vy:-Math.random() * 620, life:.7, col:i % 3 ? '#ffe08a' : '#ffffff'});
  for(const q of G.f){
    if(q === f || q.dead || q.team === f.team || q.inv > .4) continue;
    if(Math.hypot(q.x - X, (q.y - q.h / 2) - (Y - 10)) > d.radius) continue;            // escaped the impact area
    hurt(q, {c:f.c, A:skillA(d, {}), face:Math.sign(q.x - X) || -q.face, src:f});
    if(q.inv <= .5){ q.arAmt = d.armorDown; q.arE = d.armorDur; G.pops.push({x:q.x, y:q.y - q.h - 44, txt:'ARMOR BROKEN', life:1}); }   // (a KO respawn is not debuffed)
  }
}
function stepVerdicts(dt){
  if(!G.verdicts) return;
  for(const V of G.verdicts){ V.t += dt; if(!V.hit && V.t >= V.d.delay){ V.hit = true; verdictLand(V); } }
  G.verdicts = G.verdicts.filter(V => V.t < V.d.delay + .7);                              // kept a moment for the impact flash
}
function drawVerdicts(){
  (G.verdicts || []).forEach(V => {
    const d = V.d, X = V.x, Y = V.y, k = Math.min(1, V.t / d.delay);
    cx.save();
    if(V.hit){                                                                            // impact flash: light pillar + ground glow
      const a = Math.max(0, 1 - (V.t - d.delay) / .7);
      cx.globalAlpha = a * .55; cx.fillStyle = '#fff3c4'; cx.beginPath(); cx.ellipse(X, Y - 3, d.radius * (1.1 - a * .2), 22, 0, 0, 7); cx.fill();
      cx.globalAlpha = a * .4; cx.fillRect(X - 46 * a, Y - 520, 92 * a, 520); cx.restore(); return;
    }
    const pu = .5 + .5 * Math.sin(V.t * 14);
    cx.globalAlpha = .14 + .26 * k; cx.fillStyle = '#e3b53c'; cx.beginPath(); cx.ellipse(X, Y - 2, d.radius, 18, 0, 0, 7); cx.fill();   // the impact area on the floor, fills as the shield comes down
    cx.globalAlpha = .55 + .35 * pu; cx.strokeStyle = '#ffd45a'; cx.lineWidth = 3; cx.setLineDash([12, 8]); cx.beginPath(); cx.ellipse(X, Y - 2, d.radius, 18, 0, 0, 7); cx.stroke(); cx.setLineDash([]);
    const W = d.radius * 1.3, H = W * 1.25, e = k * k, cy = (Y - H * .56) - (1 - e) * d.height, x = W / 2, t = -H * .44, b = H * .56;   // tip touches the floor at k = 1
    const g = cx.createLinearGradient(0, -d.height - 200, 0, 0); g.addColorStop(0, 'rgba(255,224,130,0)'); g.addColorStop(1, 'rgba(255,224,130,.35)');
    cx.globalAlpha = .3 + .5 * k; cx.fillStyle = g; cx.fillRect(X - W * .22, cy - d.height - 200, W * .44, d.height + 200);               // beam from the sky
    cx.translate(X, cy);
    cx.globalAlpha = Math.min(1, .3 + .7 * k) * .72; cx.shadowColor = '#ffd45a'; cx.shadowBlur = 24;
    const kite = s => { cx.beginPath(); cx.moveTo(-x * s, t * s + 3); cx.quadraticCurveTo(0, t * s - 7, x * s, t * s + 3); cx.lineTo(x * s, -H * .06 * s); cx.quadraticCurveTo(x * s * .9, H * .3 * s, 0, b * s); cx.quadraticCurveTo(-x * s * .9, H * .3 * s, -x * s, -H * .06 * s); cx.closePath(); };
    kite(1); cx.fillStyle = '#e3b53c'; cx.fill(); cx.shadowBlur = 0;
    kite(.8); cx.fillStyle = '#fff0b8'; cx.fill();
    cx.lineJoin = 'round'; kite(1); cx.lineWidth = 4; cx.strokeStyle = '#fff6d6'; cx.stroke();
    const cyc = -H * .1, rr = W * .09; cx.fillStyle = '#e3b53c';                                          // sun crest
    for(let i = 0; i < 12; i++){ const a = i * Math.PI / 6, l = (i % 2 ? W * .17 : W * .22); cx.beginPath(); cx.moveTo(Math.cos(a - .11) * rr, cyc + Math.sin(a - .11) * rr); cx.lineTo(Math.cos(a) * l, cyc + Math.sin(a) * l); cx.lineTo(Math.cos(a + .11) * rr, cyc + Math.sin(a + .11) * rr); cx.fill(); }
    cx.beginPath(); cx.arc(0, cyc, rr, 0, 7); cx.fill(); cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(0, cyc, rr * .45, 0, 7); cx.fill();
    cx.restore();
  });
}
// ---- SKILL SACRED CHARGE (Paladin II) ----
// f.sc = {t, dir, d, target, hit}. Phase 1 (t < d.windup): braced, rooted, vibrating, can still turn. Phase 2: he runs forward at d.speed px/s until d.duration is over. The joystick only STEERS (left / right turns him), no jumping.
// The first enemy his shield touches takes d.dmg once, then is carried in front of the shield (kept in contact, cannot act) until the charge ends. A WALL (side of a platform) in front of the pushed enemy:
// both stop, the enemy takes d.wallDmg extra and is knocked down (d.wallStun s). Being hit (stunned) or caught cancels the charge. skills.js has all the numbers.
const wallAt = (b, x) => G.P.some(p => x + b.w / 2 > p.x && x - b.w / 2 < p.x + p.w && b.y > p.y + 2 && b.y - b.h < p.y + p.h);
function endSacredCharge(f){
  f.sc = null; f.atk = 0; f.atkCd = Math.min(f.atkCd, .25); f.A = f.base || f.K.basic;
}
function sacredChargeStep(f, o, dt){
  const S = f.sc, d = S.d, dm = f.in.r - f.in.l;
  S.t += dt;
  if(dm) S.dir = dm;                                                                                // steer (turn) with the joystick
  const dir = S.dir; f.face = dir;
  if(S.t < d.windup){                                                                               // BRACE: planted, shield up, gathering force
    f.vx = approach(f.vx, 0, 3000 * dt);
    if(Math.random() < dt * 40) G.parts.push({x:f.x + (Math.random() - .5) * 30, y:f.y - 1, vx:(Math.random() - .5) * 120, vy:-Math.random() * 90, life:.35, col:'#e6dcc0'});
    return;
  }
  if(S.t >= d.windup + d.duration){ const t = S.target; endSacredCharge(f); f.vx = dir * 90; if(t) t.vx = 0; return; }   // the charge ends: he stops, the enemy is let go
  f.vx = dir * d.speed * (f.slowT > 0 ? 1 - f.slowAmt : 1);
  const nx = f.x + f.vx * dt;
  if(Math.random() < dt * 60) G.parts.push({x:f.x - dir * 14, y:f.y - 1, vx:-dir * (40 + Math.random() * 120), vy:-Math.random() * 80, life:.4, col:'#e6dcc0'});   // dust behind him
  if(!S.target){                                                                                    // first contact with the shield
    const dxs = (o.x - f.x) * dir;
    if(o.inv <= 0 && o.capturedBy == null && !o.slam && dxs > 0 && dxs <= (f.w + o.w) / 2 + d.reach && f.y - f.h < o.y && f.y > o.y - o.h){
      if(!S.hit){ S.hit = true; hurt(o, {c:f.c, A:f.A, face:dir, src:f}); if(f.sc && o.inv <= .3) S.target = o; }   // damage once (an illusion / respawn = nothing to push)
      else S.target = o;
    }
  }
  const t = S.target;
  if(t){
    if(t.inv > .3 || t.capturedBy != null || t.slam || !(f.y - f.h < t.y && f.y > t.y - t.h)){ S.target = null; }   // knocked out / dodged away / fell off
    else{
      const tx = nx + dir * ((f.w + t.w) / 2 + 1);
      if((wallAt(t, tx) && !wallAt(t, t.x)) || (wallAt(f, nx) && !wallAt(f, f.x))){                  // CRASH: pushed into a wall
        const A = {...f.A, dmg:d.wallDmg, kbx:0, kby:.45, stunx:1, shake:3, hitstop:.12};
        hurt(t, {c:f.c, A, face:dir, src:f});
        t.vx = 0; t.kdT = 2.5; t.kdDur = d.wallStun;                                                // knocked down: when he lands he stays down for d.wallStun s
        const wx = t.x + dir * t.w / 2, wy = t.y - t.h / 2;
        G.shake = Math.max(G.shake, .32); G.rings.push({x:wx, y:wy, life:.3}); G.pops.push({x:t.x, y:t.y - t.h - 40, txt:'CRASH', life:.8});
        for(let i = 0; i < 18; i++) G.parts.push({x:wx, y:wy + (Math.random() - .5) * 30, vx:-dir * Math.random() * 380, vy:(Math.random() - .8) * 340, life:.45, col:i % 2 ? '#b9b2a8' : '#ffe08a'});
        endSacredCharge(f); f.vx = 0; return;
      }
      t.x = tx; t.vx = 0; t.stun = Math.max(t.stun, .12); t.atk = 0; t.skq = null; t.rush = null; t.hk = null;   // carried along, cannot act
    }
  }
  if(wallAt(f, nx) && !wallAt(f, f.x)){ endSacredCharge(f); f.vx = 0; }                              // ran into a wall with nobody in front: the charge just stops
}
// ---- SKILL DIVINE IMPACT (Paladin I) ----
// divineImpact: the shockwave when the shield hits the ground. holyHit: the EMPOWERED SHIELD ATTACK. While f.holy is on (d.glow seconds), the first basic hit of his that connects
// WITH THE SHIELD (a combo step with shield:true in skills.js: the stomp and the power smash, NOT the kick, NOT a skill) deals bonus holy damage (d.bonus x the usual damage) and uses the glow up.
// Missing (or not touching anyone) does nothing: the glow only ends on that first shield hit or when the time runs out.
function divineImpact(f, o){
  const d = f.A.impact; f.impacted = true;
  const cxp = f.x, cyp = f.y - f.h / 2;
  if(o.inv <= 0 && Math.hypot(o.x - cxp, (o.y - o.h / 2) - cyp) <= d.radius){
    hurt(o, {c:f.c, A:f.A, face:Math.sign(o.x - f.x) || f.face, src:f});                          // damage (small knockback, see skills.js)
    o.slowAmt = o.slowT > 0 ? Math.max(o.slowAmt, d.slow) : d.slow; o.slowT = Math.max(o.slowT || 0, d.slowDur); o.slowHolyT = G.t + d.slowDur;   // slow
  }
  G.shake = Math.max(G.shake, .3); G.hs = Math.max(G.hs || 0, .08);
  G.waves.push({x:cxp, y:f.y - 4, r:d.radius, life:.45, max:.45, col:'#ffe08a', fill:'#e3b53c'});
  G.rings.push({x:cxp, y:cyp, life:.3});
  for(let i = 0; i < 24; i++) G.parts.push({x:cxp + (Math.random() - .5) * 40, y:f.y - Math.random() * 8, vx:(Math.random() - .5) * 560, vy:-Math.random() * 380, life:.55, col:i % 3 ? '#ffe08a' : '#ffffff'});
  G.pops.push({x:f.x, y:f.y - f.h - 22, txt:'DIVINE IMPACT', life:.9});
  f.holy = {t:d.glow, d};                                                                         // the shield starts to glow
}
function holyHit(src, o, A){
  const H = src.holy; if(!H || H.t <= 0 || !A.shield || A.skill) return;                          // only a shield hit of his basic combo consumes it
  src.holy = null;                                                                                // used up: the glow is gone
  let dmg = (10 + src.c.hp / 40) * 2.2 * (1 - armOf(o) / 50) * H.d.bonus;
  if(o.bar > 0){ const ab = Math.min(o.bar, dmg); o.bar -= ab; dmg -= ab; }
  o.hp -= dmg;
  G.pops.push({x:o.x + (Math.random() - .5) * 16, y:o.y - o.h - 22, txt:Math.round(dmg), life:.8});
  G.pops.push({x:o.x, y:o.y - o.h - 40, txt:'HOLY SMITE', life:.8});
  G.rings.push({x:o.x, y:o.y - o.h / 2, life:.3});
  for(let i = 0; i < 16; i++) G.parts.push({x:o.x, y:o.y - o.h / 2, vx:(Math.random() - .5) * 460, vy:(Math.random() - .8) * 380, life:.5, col:i % 2 ? '#ffe08a' : '#ffffff'});
}
// PASSIVES. skills.js passive:{kind, ...}. No kind = 'skillHits' (Titan: Pain Is Fuel). kind 'marks' = Fresh Meat (below).
function onLanded(src, o, A){
  if(src.holy) holyHit(src, o, A);                    // Divine Impact: the first shield hit uses up the holy glow
  const P = src.K.passive; if(!P) return;
  if(!P.kind || P.kind === 'skillHits'){ if(A.skill) painIsFuel(src); }
  else if(P.kind === 'hunger') hungerHit(src, o, A, P);
  else if(P.kind === 'retribution') retributionHit(src, o, A, P);
  else if(P.kind === 'frost') frostHit(src, o, A, P);
  else if(P.kind === 'static') staticHit(src, o, A, P);                   // STATIC CHARGE (Fulminar)
  else if(P.kind === 'momentum') momentumHit(src, A, P);                 // THE SHOW MUST GO ON: every landed hit fills the Momentum gauge                  // ABSOLUTE ZERO: +1 Frost stack, or the READY freeze
  else if(P.kind === 'marks'){                       // FRESH MEAT: every landed hit (basic or skill) = 1 Meat Mark on that enemy. At `marks` marks they are Wounded: bleed `dps` x their max HP per second for `dur` s
    o.mk = (o.mk || 0) + 1;
    if(o.mk >= P.marks){ o.mk = 0; o.bl = P.dur; o.blDps = o.max * P.dps; }   // already bleeding = the bleed time is refreshed
  }
}
function bleedTick(f, dt){
  f.bl -= dt; f.bt -= dt;
  const d = f.blDps * dt; f.hp -= d; f.blAcc = (f.blAcc || 0) + d;
  if(Math.random() < dt * 14) G.parts.push({x:f.x + (Math.random() - .5) * 14, y:f.y - f.h * .6, vx:0, vy:40, life:.4, col:'#b3202a'});
  if(f.bt <= 0){ f.bt = .5; if(f.blAcc >= 1) G.pops.push({x:f.x, y:f.y - f.h - 6, txt:Math.round(f.blAcc), life:.6}); f.blAcc = 0; }   // bleed damage numbers, twice a second
  if(f.hp <= 0) ko(f);
}
// PASSIVE Pain Is Fuel (skills.js passive:{hits, speed, barrier, dur}): every `hits` landed skills = +speed move speed and a barrier of `barrier` x max HP for `dur` seconds.
// Another activation refreshes the time and refills the barrier to full (it never stacks).
function painIsFuel(f){
  const P = f.K.passive; if(!P) return;
  if(++f.pn < P.hits) return;
  f.pn = 0; f.pt = P.dur; f.bar = f.max * P.barrier;
  G.rings.push({x:f.x, y:f.y - f.h / 2, life:.25});
}

// ---- PROJECTILES (generic, any character can use them) ----
// A hit in skills.js with shot:{p, hand, r, speed, life} fires one sphere when the swing reaches progress p.
//   hand: 'N' near hand, 'F' far hand, 'B' both hands (spawns between them). r = radius px, speed = px/s, life = seconds before it fades.
// The sphere uses that hit's dmg / kbx / kby / stunx like a melee hit. Set hitFrom:0, hitTo:0 on a shooting hit so there is no melee box.
// art.js can draw it with shot(cx, s, t) (s = {x, y, r, vx, age, kind}). art.js front() may set f.handW = {N:{x,y}, F:{x,y}} (world coords) so the sphere leaves the real hand.
//   Charged sphere: skills.js chargeShot:{p, hand, rMin, rMax, speed, life, dmg, dmgGrow, kbx, kby, stunx, shake, hitstop} + chargeP / chargeMin / chargeMax (same hold-ATK charge as punches).
//   Released after holding: radius = rMin..rMax and damage = dmg x (1 + dmgGrow x charge level), the knockback numbers are used as written.
// ---- passive BULLET CHAMBER (Caliber) ----
// skills.js passive:{kind:'chamber', max, reload, critMult, critSnipe, critKb}. Every bullet that leaves a gun uses 1 of `max` bullets (a miss still counts).
// The LAST bullet of the magazine (the 5th) is ALWAYS critical: damage x critMult, more knockback. (The Deadeye Sniper shot never uses the magazine, see sniperStep.) It does not matter if the first 4 hit or missed.
// After the last bullet he reloads by himself for `reload` s: he can move, but he cannot start any attack. When it ends the magazine is full again (f.mag = bullets fired, f.rl = reload time left).
function chamberFire(f, P, big){   // returns the damage/knockback changes if this bullet is the critical one, else null
  f.mag++;
  if(f.mag < P.max) return null;
  f.rl = P.reload;                                   // last bullet: reload starts right now
  return {mult:P.critMult, kb:P.critKb};
}
function chamberStep(f, dt){
  if(f.rl <= 0) return;
  f.rl -= dt;
  if(f.rl <= 0){ f.rl = 0; f.mag = 0; G.rings.push({x:f.x, y:f.y - f.h / 2, life:.25}); G.pops.push({x:f.x, y:f.y - f.h - 16, txt:'RELOADED', life:.7}); }
}
function shoot(f, sh){
  sh = sh || f.A.shot;
  const CH = f.K.passive && f.K.passive.kind === 'chamber' ? f.K.passive : null;
  if(CH && f.rl > 0) return;                         // reloading: no bullet leaves the gun
  const d = f.face, hw = f.handW, big = !!f.A.chargeShot && sh === f.A.chargeShot;
  let r = sh.r, A = f.A;
  if(big){ const cl = f.A.cl || 0; r = sh.rMin + (sh.rMax - sh.rMin) * cl;
    A = {...f.A, dmg:sh.dmg * (1 + (sh.dmgGrow || 0) * cl), kbx:sh.kbx, kby:sh.kby, stunx:sh.stunx, shake:sh.shake, hitstop:sh.hitstop};
    if(sh.slow){ A.slowAmt = sh.slow; A.slowDur = (sh.slowMin || 1) + ((sh.slowMax || 3) - (sh.slowMin || 1)) * cl; }   // slow strength / time grow with the charge
    if(sh.explode) A.expl = r * sh.explode; }
  const crit = CH ? chamberFire(f, CH, big) : null;   // Bullet Chamber: is this the 5th (critical) bullet?
  if(crit) A = {...A, dmg:A.dmg * crit.mult, kbx:(A.kbx ?? 1) * crit.kb, shake:(A.shake || 1) + 2, hitstop:Math.max(A.hitstop || 0, .09), crit:true};
  A = {...A, hid:++HID};   // this sphere = one attack (Abyssal Hunger: one fragment, Divine Retribution: one charge)
  let x = f.x + d * 22, y = f.y - 32;
  if(hw){ const pts = sh.hand === 'B' ? [hw.N, hw.F] : [sh.hand === 'F' ? hw.F : hw.N]; x = pts.reduce((a, q) => a + q.x, 0) / pts.length; y = pts.reduce((a, q) => a + q.y, 0) / pts.length; }
  (G.sh = G.sh || []).push({id:f.c.id, c:f.c, idx:f.idx, team:f.team, A, x, y, vx:d * sh.speed, r, life:sh.life || 1.6, age:0, kind:big ? 3 : (f.A.step || 0), cl:big ? (f.A.cl || 0) : 0, crit:!!crit});
  if(crit){ G.rings.push({x, y, life:.2}); for(let i = 0; i < 8; i++) G.parts.push({x, y, vx:d * (120 + Math.random() * 300), vy:(Math.random() - .5) * 260, life:.3, col:i % 2 ? '#ff4a2e' : '#ffd27a'}); }   // red muzzle flash
}
function updateShots(dt){
  if(!G.sh) return;
  G.sh.forEach(s => {
    s.age += dt; s.life -= dt;
    const n = Math.max(1, Math.ceil(Math.hypot(s.vx, s.vy || 0) * dt / 14)), h = dt / n;   // fast bullets (the sniper shot) move in small steps so they cannot jump over a fighter
    for(let k = 0; k < n; k++){
      if(s.g) s.vy = (s.vy || 0) + s.g * h;                           // lobbed shell: gravity bends its path into the arc
      const py = s.y; s.x += s.vx * h; s.y += (s.vy || 0) * h;
      const hr = s.r + (s.A.expl || 0) * .5;                            // an exploding orb goes off a little before it touches
      const o = G.f.find(q => q.team !== s.team && !q.dead && q.inv <= 0 && q.capturedBy == null && s.x + hr > q.x - q.w / 2 && s.x - hr < q.x + q.w / 2 && s.y + hr > q.y - q.h && s.y - hr < q.y);   // first enemy it touches
      if(s.blast){                                                    // Explosive Shot: goes off the instant it touches an enemy or a platform top (no fuse)
        if(o){ bombBlast(s); break; }
        if(s.vy > 0){ const p = G.P.find(q => s.x > q.x && s.x < q.x + q.w && py <= q.y && s.y >= q.y); if(p){ s.y = p.y; bombBlast(s); break; } }
        continue;
      }
      if(!o) continue;
      s.life = 0;
      if(s.A.crit) G.pops.push({x:o.x, y:o.y - o.h - 24, txt:'CRITICAL!', life:.9});
      if(s.A.snipe) G.pops.push({x:o.x, y:o.y - o.h - 24, txt:s.A.popTxt || 'DEADEYE!', life:.9});
      hurt(o, {c:s.c, A:s.A, face:Math.abs(s.vx) > 30 ? Math.sign(s.vx) : (Math.sign(o.x - s.x) || 1), src:G.f[s.idx]});
      if(s.A.freeze && !o.dead && o.hp > 0){ freezeFx(o, s.A.freeze); if(s.A.shatter){ iceBurst(s.x, s.y, 22, 20, 380); G.waves.push({x:s.x, y:s.y, r:s.A.shatter, life:.25, max:.25, col:'#bfe8ff', fill:'#5fb4f0'}); } }   // ICE PROJECTILE: shatters on the enemy and freezes them
      if(s.A.slowDur){ o.slowAmt = o.slowT > 0 ? Math.max(o.slowAmt, s.A.slowAmt) : s.A.slowAmt; o.slowT = Math.max(o.slowT || 0, s.A.slowDur); o.slowVoidT = G.t + s.A.slowDur; }   // slow
      if(s.A.expl){ const er = s.A.expl; G.waves.push({x:s.x, y:s.y, r:er * 2.2 + 14, life:.28, max:.28, col:'#8f6bff', fill:'#3a1a8c'}); for(let i = 0; i < 8 + er * .5; i++) G.parts.push({x:s.x, y:s.y, vx:(Math.random() - .5) * 460, vy:(Math.random() - .5) * 460, life:.45, col:i % 2 ? '#8f6bff' : '#0a0614'}); }   // explosion
      break;
    }
    if(s.x < -300 || s.x > W + 300 || s.y < -500 || s.y > H + 400) s.life = 0;
  });
  G.sh = G.sh.filter(s => s.life > 0);
}
function holdVictim(f, S, o){   // the victim is wrapped, dragged in front of him (swinging up and over), then held upside down at his chest
  const k = Math.max(0, Math.min(1, (S.t - S.deploy) / S.pull)), e = k * k * (3 - 2 * k);   // 0 = still where he was caught, 1 = held in front of him
  const hx = Math.max(24, Math.min(W - 24, f.x + f.face * S.hold)), hy = f.y - 36 + o.h / 2;
  o.x = S.ox + (hx - S.ox) * e + Math.sin(G.t * 80) * S.kick * 18;
  o.y = S.oy + (hy - S.oy) * e - Math.sin(k * Math.PI) * 26;
  o.capRot = Math.PI * e; o.gr = false;
  o.vx = o.vy = 0; o.atk = 0; o.stun = 0; o.rush = null; o.hk = null; o.skq = null;
}
function slaughterHit(f, o, h){   // one chop / bite beat: damage, no knockback, blood
  const S = f.slaughter, x = o.x, y = o.y - o.h / 2;
  S.kick = .18;
  hurt(o, {c:f.c, A:{...f.A, dmg:h.dmg, kbx:0, kby:0, stunx:1, bleedBonus:0, shake:h.shake || 1.2, hitstop:h.hitstop || .05}, face:f.face, src:f});
  for(let i = 0; i < 10; i++) G.parts.push({x, y, vx:(Math.random() - .5) * 360, vy:(Math.random() - .9) * 320, life:.5, col:'#b3202a'});
}
function stepSlaughterhouse(f, dt){
  const S = f.slaughter; if(!S) return false;
  S.t += dt; S.kick = Math.max(0, S.kick - dt);
  const total = S.deploy + S.duration;
  f.atk = Math.max(0, total - S.t);                      // drives the dedicated ragdoll pose (art.js) for the whole animation
  f.vx = f.vy = 0; f.in.l = f.in.r = 0; f.gr = true;     // planted the whole time
  const o = S.target;
  if(o){
    holdVictim(f, S, o);
    if(S.t > S.deploy + S.pull && Math.random() < dt * 20) G.parts.push({x:o.x + (Math.random() - .5) * 16, y:o.y - o.h / 2, vx:(Math.random() - .5) * 60, vy:-30, life:.5, col:'#8f1620'});
    while(S.hits.length && S.t / total >= S.hits[0].p){
      slaughterHit(f, o, S.hits.shift());
      if(f.slaughter !== S) return true;                 // the hit KO'd them: the cast was already cleaned up
    }
  }
  if(S.t >= total){
    if(o){
      o.capturedBy = null; o.capRot = 0; o.inv = .45; o.vx = f.face * 90; o.vy = -90;
      const before = f.hp; f.hp = Math.min(f.max, f.hp + f.max * S.heal);
      const healed = Math.round(f.hp - before);
      if(healed > 0) G.pops.push({x:f.x, y:f.y - f.h - 18, txt:'+' + healed, life:1});
      G.rings.push({x:f.x, y:f.y - f.h / 2, life:.25});
    }
    f.slaughter = null; f.atk = 0; f.A = f.base || f.K.basic; f.atkCd = Math.max(f.atkCd, .25);
  }
  return true;
}
// ---- AEGIS STANCE (Paladin held key): hold ATK = he plants the shield in the ground. hold:{kind:'aegis', after, setup} in skills.js ----
// Setup (d.setup s): rooted, cannot turn or jump, NOT protected. Then f.aegis.on = true: every blow that comes from the FRONT is blocked in hurt() (blockHit). Blocking only: no reflect, no counter.
// It lasts while ATK stays held. Let go / hit during the setup / lost the floor / another skill = the stance ends.
function aegisEnd(f){
  f.aegis = null;
  if(f.A && f.A.skill === 'aegis'){ f.atk = 0; f.A = f.base || f.K.basic; f.atkCd = Math.max(f.atkCd, .3); }
}
function aegisStep(f, dt){
  const d = f.K.hold;
  f.heldT = f.in.held ? (f.heldT || 0) + dt : 0;
  const S = f.aegis;
  if(S){
    if(!f.in.held || f.stun > 0 || f.capturedBy != null || f.onsl || f.slaughter || !f.gr || !f.A || f.A.skill !== 'aegis'){ aegisEnd(f); return; }
    S.t += dt;
    if(!S.on && S.t >= d.setup){                                                   // fully planted: the block is live
      S.on = true; S.hitT = -9;
      G.rings.push({x:f.x + f.face * 22, y:f.y - 24, life:.35}); G.shake = Math.max(G.shake, .12);
      for(let i = 0; i < 14; i++) G.parts.push({x:f.x + f.face * 22 + (Math.random() - .5) * 20, y:f.y - Math.random() * 6, vx:(Math.random() - .5) * 300, vy:-Math.random() * 220, life:.45, col:i % 2 ? '#ffe08a' : '#e6dcc0'});
    }
    if(S.on) f.atk = f.A.time - d.setup;                                            // hold the planted pose
    f.atkCd = Math.max(f.atkCd, .2);
    return;
  }
  if(f.in.held && f.heldT >= d.after && f.gr && f.stun <= 0 && !f.slaughter && !f.hk && !f.rush && !f.sc && f.capturedBy == null && (f.atk <= 0 || (!f.A.skill && !f.hitDone))){
    startSkillA(f, skillA(d, {time:d.setup + .4, root:true, noSlash:true, step:-1, setup:d.setup}));
    f.aegis = {t:0, on:false, hitT:-9, popT:-9}; f.comboT = 0; f.charging = false; f.chg = 0; f.aqB = 0; f.vx = 0;
  }
}
function blockHit(o, f){
  const S = o.aegis; S.hitT = G.t;
  const x = o.x + o.face * (o.w / 2 + 18), y = o.y - o.h * .55;
  G.rings.push({x, y, life:.2}); G.shake = Math.max(G.shake, .06);
  for(let i = 0; i < 10; i++) G.parts.push({x, y:y + (Math.random() - .5) * 30, vx:-o.face * (40 + Math.random() * 220), vy:(Math.random() - .6) * 260, life:.35, col:i % 2 ? '#ffe08a' : '#ffffff'});
  if(G.t - S.popT > .25){ S.popT = G.t; G.pops.push({x:o.x, y:o.y - o.h - 6, txt:'BLOCK', life:.7}); }   // one text per blow, not per damage tick
}
// ---- EXPLOSIVE SHOT helpers ----
// lobAim: the arc for the current aim. Fixed start (in front of his chest, so the preview is exactly the real arc), fixed flight time T (shorter for near throws), gravity d.grav.
function lobAim(f, o, d, ax, ay, m){
  const R = d.range || 520, dir = m == null ? f.face : (Math.abs(ax) > .12 ? Math.sign(ax) : f.face);
  let dist = m == null ? ((o.x - f.x) * dir > 0 && Math.abs(o.x - f.x) <= R ? Math.abs(o.x - f.x) : R * .55) : d.minR + (R - d.minR) * clampN(m, 0, 1);
  dist = clampN(dist, d.minR, R);
  const tx = clampN(f.x + dir * dist, 20, W - 20), gy = groundAt(tx, Math.abs(tx - o.x) < 70 ? o.y : f.y);
  const sx = f.x + dir * 18, sy = f.y - 34, ty = gy == null ? f.y : gy, T = d.flight * (.6 + .4 * dist / R);
  return {tx, ty, ground:gy != null, sx, sy, vx:(tx - sx) / T, vy:((ty - sy) - .5 * d.grav * T * T) / T, T, dir};
}
function lobStep(f, dt){
  const L = f.lob;
  if(f.stun > 0 || f.capturedBy != null || f.onsl || f.slaughter || !f.A || f.A.skill !== 'lobshot'){ f.lob = null; return; }   // hit during the wind-up: the shell is never thrown (cooldown is spent)
  L.t += dt;
  if(L.t < L.at) return;
  f.lob = null;
  const d = L.d, a = L.a;
  const A = {time:.3, cd:0, reach:0, hitFrom:0, hitTo:0, dmg:d.dmg, kbx:d.kbx, kby:d.kby, stunx:d.stunx, shake:d.shake, hitstop:d.hitstop, noSlash:true, step:0, hid:++HID};
  (G.sh = G.sh || []).push({id:f.c.id, c:f.c, idx:f.idx, team:f.team, A, x:a.sx, y:a.sy, vx:a.vx, vy:a.vy, g:d.grav, r:d.r, life:a.T + 1.5, age:0, kind:'bomb', cl:0, crit:false, blast:d.radius, dir:a.dir});
  G.rings.push({x:a.sx, y:a.sy, life:.2});
}
function bombBlast(s){   // instant area damage around the impact point: enemies inside the radius are hurt and pushed away from the blast, everyone else is untouched
  s.life = 0; const R = s.blast, src = G.f[s.idx];
  G.waves.push({x:s.x, y:s.y, r:R, life:.3, max:.3, col:'#ffb84a', fill:'#ff6a1a'}); G.rings.push({x:s.x, y:s.y, life:.25}); G.shake = Math.max(G.shake, .28);
  for(let i = 0; i < 22; i++){ const a = Math.random() * 6.28, v = 120 + Math.random() * 420; G.parts.push({x:s.x, y:s.y, vx:Math.cos(a) * v, vy:Math.sin(a) * v - 80, life:.4 + Math.random() * .2, col:['#ffd27a', '#ff8a2a', '#3a2a22', '#fff2c4'][i % 4]}); }
  G.f.forEach(o => {
    if(o.dead || o.team === s.team || o.inv > 0 || o.capturedBy != null) return;
    if(Math.hypot(s.x - clampN(s.x, o.x - o.w / 2, o.x + o.w / 2), s.y - clampN(s.y, o.y - o.h, o.y)) > R) return;   // outside the radius: nothing
    hurt(o, {c:s.c, A:s.A, face:Math.sign(o.x - s.x) || s.dir, src});
  });
}
// ---- DEADEYE SNIPER (Caliber held key): hold ATK = he kneels, raises the rifle and you AIM it. After d.aim s the shot is READY; let go = fire. Let go earlier = nothing fires. ----
// hold:{kind:'sniper', after, kneel, aim, turn, cd, cancelCd, recover, shot:{r, speed, life, dmg, kbx, kby, stunx, shake, hitstop}} in skills.js.
// f.snipe = {t, ph:'aim'|'recover', ready, ang, rt, err, botRel}. ang = rifle elevation in radians (0 = level, + = up), the side he faces comes from f.face. art.js reads f.snipe to pose him and draw the laser.
// He is rooted (no walking / jumping / dropping, normal attacks blocked). The bullet is its own projectile: it does NOT use the Bullet Chamber magazine and is NOT blocked by the reload.
// f.snCd = the sniper's own cooldown (starts when he FIRES, hit or miss; a cancelled aim only costs d.cancelCd). f.snLock = ATK must be let go before a new aim can start.
const SN_MIN = -.95, SN_MAX = 1.35;                                       // lowest / highest rifle angle (rad)
const snipeDefer = f => { const d = f.K.hold; return !!d && d.kind === 'sniper' && !f.A.skill && f.in.held && !f.snLock && f.snCd <= 0 && f.heldT < d.after; };   // ATK just went down: hold back the first pistol shot until we know it is a tap and not a hold (so starting a snipe never wastes a magazine bullet)
function sniperEnd(f, cd){
  f.snipe = null; f.snLock = true;
  if(f.A && f.A.skill === 'sniper'){ f.atk = 0; f.A = f.base || f.K.basic; }
  f.atkCd = Math.max(f.atkCd, .25); f.snCd = Math.max(f.snCd || 0, cd || 0); f.comboT = 0;
}
function sniperFire(f, S, d){
  const sh = d.shot, hw = f.handW && f.handW.S, ca = Math.cos(S.ang), sa = Math.sin(S.ang);
  const x = hw ? hw.x : f.x + f.face * 26 * ca, y = hw ? hw.y : f.y - 24 - 26 * sa;
  const A = {time:.3, cd:0, reach:0, hitFrom:0, hitTo:0, dmg:sh.dmg, kbx:sh.kbx, kby:sh.kby, stunx:sh.stunx, shake:sh.shake, hitstop:sh.hitstop, noSlash:true, step:0, snipe:true, popTxt:sh.popTxt, freeze:sh.freeze, shatter:sh.shatter, hid:++HID};
  (G.sh = G.sh || []).push({id:f.c.id, c:f.c, idx:f.idx, team:f.team, A, x, y, vx:f.face * ca * sh.speed, vy:-sa * sh.speed, r:sh.r, life:sh.life, age:0, kind:'sniper', cl:0, crit:false});
  G.rings.push({x, y, life:.22}); G.shake = Math.max(G.shake, .18);
  for(let i = 0; i < 12; i++){ G.parts.push({x, y, vx:f.face * ca * (200 + Math.random() * 500) + (Math.random() - .5) * 120, vy:-sa * (200 + Math.random() * 300) + (Math.random() - .5) * 160, life:.3, col:i % 2 ? '#ffd27a' : '#7ffff0'}); }
}
function sniperStep(f, dt){
  const d = f.K.hold, i = f.in;
  f.heldT = i.held ? (f.heldT || 0) + dt : 0;
  if(!i.held) f.snLock = false;
  if(f.snCd > 0) f.snCd = Math.max(0, f.snCd - dt);
  const S = f.snipe;
  if(S){
    if(f.stun > 0 || f.capturedBy != null || f.onsl || f.slaughter || f.hk || f.shd || f.uhand || !f.gr || !f.A || f.A.skill !== 'sniper'){ sniperEnd(f, d.cancelCd); return; }   // hit / caught / lost the floor: the aim is cancelled
    S.t += dt; S.kn = Math.min(1, S.t / d.kneel); S.k = Math.min(1, S.t / (d.kneel + d.aim)); f.atk = .5; f.atkCd = Math.max(f.atkCd, .2); f.aqB = 0; f.vx = 0;                       // f.atk is only a "pose is on" flag: art.js poses him from f.snipe
    if(S.ph === 'recover'){ S.rt += dt / d.recover; if(S.rt >= 1) sniperEnd(f, 0); return; }
    const o = f.cur;
    if(f.idx === 0){                                                                                    // YOU: joystick / ATK drag aim directly, keys tilt and turn
      const v = i.aim;
      if(v){
        if(Math.abs(v.x) > .35) f.face = Math.sign(v.x);
        const tg = Math.max(SN_MIN, Math.min(SN_MAX, Math.atan2(-v.y, Math.max(Math.abs(v.x), .02)))), st = d.turn * dt;
        S.ang += Math.max(-st, Math.min(st, tg - S.ang));
      }else{
        if(i.r - i.l) f.face = i.r - i.l;
        S.ang = Math.max(SN_MIN, Math.min(SN_MAX, S.ang - (i.ay || 0) * d.turn * .6 * dt));
      }
    }else if(o){                                                                                        // BOT: swings the rifle toward the enemy (a little off, less off on Hard)
      const dx = o.x - f.x;
      if(Math.abs(dx) > 20) f.face = Math.sign(dx);
      const tg = Math.max(SN_MIN, Math.min(SN_MAX, Math.atan2(-((o.y - o.h / 2) - (f.y - 26)), Math.abs(dx)) + S.err)), st = d.turn * .6 * dt;
      S.ang += Math.max(-st, Math.min(st, tg - S.ang));
      if(!S.ready && Math.abs(dx) < 90) i.held = false;                                                 // enemy walked up to him: gives up
      if(S.ready && G.t >= S.botRel) i.held = false;                                                    // lets go a moment after the lock
    }
    if(!S.ready && S.t >= d.kneel + d.aim){                                                             // LOCKED: the shot is ready
      S.ready = true; G.rings.push({x:f.x + f.face * 20, y:f.y - 26, life:.3}); G.pops.push({x:f.x, y:f.y - f.h - 30, txt:d.lockTxt || 'LOCKED', life:.6});
    }
    if(!i.held){
      if(S.ready){ sniperFire(f, S, d); S.ph = 'recover'; S.rt = 0; f.snCd = d.cd; }                    // fire: the cooldown starts now, hit or miss
      else sniperEnd(f, d.cancelCd);                                                                    // too early: nothing is fired
    }
    return;
  }
  if(i.held && !f.snLock && f.heldT >= d.after && f.snCd <= 0 && f.gr && f.stun <= 0 && !f.slaughter && !f.hk && !f.rush && !f.sc && !f.shd && !f.uhand && !f.onsl && f.capturedBy == null && (f.atk <= 0 || (!f.A.skill && !f.hitDone))){
    const o = f.cur;
    const S = f.snipe = {t:0, kn:0, k:0, ph:'aim', ready:false, rt:0, ang:0, err:(Math.random() - .5) * 2 * (G.cfg.difficulty === 'Easy' ? .2 : G.cfg.difficulty === 'Hard' ? .04 : .1), botRel:G.t + d.kneel + d.aim + .1 + Math.random() * .5};
    if(o && (o.x - f.x) * f.face > 0) S.ang = Math.max(SN_MIN, Math.min(SN_MAX, Math.atan2(-((o.y - o.h / 2) - (f.y - 26)), Math.abs(o.x - f.x))));   // the rifle starts pointing at the enemy (then it is yours to steer)
    startSkillA(f, skillA(d, {time:1, root:true, noSlash:true, snipe:S}));
    f.atk = .5; f.comboT = 0; f.charging = false; f.chg = 0; f.aqB = 0; f.vx = 0;
  }
}
// ---- ZERATHIS (Frozen Monarch): ABSOLUTE ZERO passive, FREEZE status, WINTER'S GRASP, CRYSTAL COFFIN, ETERNAL ICE AGE ----
// passive {kind:'frost', max, freeze}: f.fs = Frost stacks (0..max), f.fsRdy = READY. Every landed hit = +1 stack. At max the NEXT successful attack freezes the enemy for `freeze` s (READY never expires).
// Freeze status: o.frz (s). Frozen = cannot move / act (like a stun) and cannot be pushed sideways, gravity still works. Several sources never stack, the longest one wins (freezeFx).
// Root status:   o.rootT (s). Immobilized = no walking / jumping / dash skills, but attacks and normal skills still work (Crystal Coffin).
// Lift status:   o.lowG (s). Half gravity so a launched enemy hangs in the air for about a second (Winter's Grasp).
function frostGain(f, n){
  const P = f.K.passive; if(!P || P.kind !== 'frost' || f.fsRdy) return;
  f.fs = Math.min(P.max, f.fs + (n || 1));
  for(let i = 0; i < 4; i++) G.parts.push({x:f.x + (Math.random() - .5) * 16, y:f.y - f.h - 14, vx:(Math.random() - .5) * 120, vy:-40 - Math.random() * 80, life:.35, col:i % 2 ? '#e8f8ff' : '#7fd0ff'});
  if(f.fs >= P.max){ f.fsRdy = true; readyFx(f); }
}
function frostHit(src, o, A, P){   // runs inside every hit that lands (hurt -> onLanded)
  if(A.noFrost) return;
  if(src.fsRdy && A.hid && src.fsGain === A.hid) return;                       // the same attack that just filled the stacks: it is not "the next attack"
  if(src.fsRdy || (A.hid && src.fsKey === A.hid)){                              // READY: this attack freezes (every enemy it hits, if it is a multi-hit attack)
    if(src.fsRdy){ src.fsRdy = false; src.fs = 0; src.fsKey = A.hid || 0; }
    freezeFx(o, P.freeze); G.pops.push({x:o.x, y:o.y - o.h - 28, txt:'ABSOLUTE ZERO', life:.9});
    return;
  }
  src.fsGain = A.hid || 0; frostGain(src, 1);
}
function freezeFx(o, sec){
  if(o.dead) return;
  const fresh = !(o.frz > 0);
  o.frz = Math.max(o.frz || 0, sec); o.stun = Math.max(o.stun, sec);            // stun too, so every "stunned = cannot do that" rule in the game also holds while frozen
  o.atk = 0; o.comboT = 0; o.charging = false; o.chg = 0; o.rush = null; o.skq = null; o.aq = false; o.hk = null; if(o.shd) endShadowHook(o);
  if(fresh){
    G.rings.push({x:o.x, y:o.y - o.h / 2, life:.25});
    for(let i = 0; i < 12; i++) G.parts.push({x:o.x + (Math.random() - .5) * 22, y:o.y - Math.random() * o.h, vx:(Math.random() - .5) * 220, vy:-Math.random() * 200, life:.4, col:['#e8f8ff', '#9fe4ff', '#5fb4f0'][i % 3]});
  }
}
function thawFx(o){   // the ice block breaks
  G.rings.push({x:o.x, y:o.y - o.h / 2, life:.25});
  for(let i = 0; i < 16; i++) G.parts.push({x:o.x + (Math.random() - .5) * 26, y:o.y - Math.random() * o.h, vx:(Math.random() - .5) * 420, vy:-Math.random() * 300, life:.5, col:['#e8f8ff', '#9fe4ff', '#5fb4f0', '#ffffff'][i % 4]});
}
const ICE_COL = ['#e8f8ff', '#9fe4ff', '#5fb4f0', '#ffffff'];
const iceBurst = (x, y, n, spread, up) => { for(let i = 0; i < n; i++) G.parts.push({x:x + (Math.random() - .5) * spread, y:y - Math.random() * 10, vx:(Math.random() - .5) * 360, vy:-Math.random() * (up || 320), life:.4 + Math.random() * .3, col:ICE_COL[i % 4]}); };

// ---- ground-targeted ice zones: Winter's Grasp (kind 'grasp') and Crystal Coffin (kind 'coffin'). They live in G.iceZ, independent from the caster once placed. ----
function stepIceZones(dt){
  G.iceZ.forEach(z => { z.t += dt; (z.kind === 'grasp' ? graspStep : coffinStep)(z); });
  G.iceZ = G.iceZ.filter(z => !z.done);
}
const inZone = (o, z, halfW, up) => Math.abs(o.x - z.x) < halfW + o.w / 2 && o.y > z.gy - up && o.y - o.h < z.gy + 6;   // feet inside the column above the marked ground (a high jump gets over low spikes)
function graspStep(z){   // WINTER'S GRASP: the ground freezes for d.warn s (the warning), then spikes erupt: damage + launch for d.air s + 1 Frost stack per enemy hit
  const d = z.d, f = z.src;
  if(!z.fired && z.t >= d.warn){
    z.fired = true; G.shake = Math.max(G.shake, .26); G.hs = Math.max(G.hs || 0, .05);
    iceBurst(z.x, z.gy, 26, d.halfW * 2, 420); G.waves.push({x:z.x, y:z.gy - 4, r:d.halfW * 1.3, life:.3, max:.3, col:'#bfe8ff', fill:'#5fb4f0'});
    foesOf(f).forEach(o => {
      if(o.inv > 0 || o.capturedBy != null || o.slam || !inZone(o, z, d.halfW, d.height)) return;
      const A = skillA(d, {hid:z.hid, kbx:0, kby:0, stunx:d.air / KB.stun, shake:2.2, hitstop:.07});
      hurt(o, {c:f.c, A, face:Math.sign(o.x - z.x) || f.face, src:f});
      if(o.hp > 0 && !o.dead){ o.vy = -GRAV * .25 * d.air; o.lowG = d.air; o.gr = false; o.stun = Math.max(o.stun, d.air); }   // half gravity: up and down again in d.air s
    });
  }
  if(z.t >= d.warn + (d.linger || .7)) z.done = true;
}
function coffinStep(z){  // CRYSTAL COFFIN: after d.form s every enemy inside d.radius is walled in and immobilized for d.trap s. Then the ice shatters: fragment damage to everyone near a coffin.
  const d = z.d, f = z.src;
  if(!z.formed && z.t >= d.form){
    z.formed = true; z.pris = [];
    G.shake = Math.max(G.shake, .18);
    foesOf(f).forEach(o => {
      if(o.inv > 0 || o.capturedBy != null || o.slam || Math.abs(o.x - z.x) >= d.radius + o.w / 2 || Math.abs(o.y - z.gy) > 70) return;
      o.rootT = d.trap; o.vx = 0; z.pris.push({o, x:o.x});
      G.rings.push({x:o.x, y:o.y - o.h / 2, life:.25}); iceBurst(o.x, o.y, 14, 30, 300);
    });
    if(!z.pris.length){ z.done = true; iceBurst(z.x, z.gy, 8, d.radius, 160); }                  // nobody inside: it just crumbles
  }
  if(z.formed && !z.shat && z.t >= d.form + d.trap){
    z.shat = true; z.shatT = z.t;
    const live = z.pris.filter(p => p.o.rootT > 0 && !p.o.dead);                              // a coffin whose prisoner was KO'd earlier is already gone
    G.shake = Math.max(G.shake, .3); G.hs = Math.max(G.hs || 0, .05);
    live.forEach(p => { const o = p.o; o.rootT = 0; iceBurst(o.x, o.y - o.h / 2, 30, 36, 460); G.waves.push({x:o.x, y:o.y - o.h / 2, r:d.shardR, life:.3, max:.3, col:'#bfe8ff', fill:'#5fb4f0'}); });
    const hid = ++HID;
    foesOf(f).forEach(o => {
      if(o.inv > 0 || o.capturedBy != null) return;
      if(!live.some(p => Math.hypot(o.x - p.o.x, (o.y - o.h / 2) - (p.o.y - p.o.h / 2)) <= d.shardR)) return;   // fragments only hurt enemies near a coffin
      const A = skillA(d, {hid, kbx:.45, kby:.5, stunx:1.3, shake:2, hitstop:.07});
      hurt(o, {c:f.c, A, face:Math.sign(o.x - z.x) || f.face, src:f});
    });
  }
  if(z.shat && z.t >= z.shatT + .5) z.done = true;
}

// ---- ERRATA zones (G.errZ): Dimensional Impale mirror (kind 'impale') and Shattered Gravity distortion (kind 'gravity'). Independent from the caster once placed. ----
function stepErrZones(dt){
  G.errZ.forEach(z => { z.t += dt; (z.kind === 'impale' ? impaleStep : gravityStep)(z, dt); });
  G.errZ = G.errZ.filter(z => !z.done);
}
function glassBurst(x, y, n, spread, spd){
  for(let i = 0; i < n; i++) G.parts.push({x:x + (Math.random() - .5) * spread, y:y - Math.random() * 20, vx:(Math.random() - .5) * spd, vy:-Math.random() * spd * .9, life:.5 + Math.random() * .3, col:['#c084fc', '#f3e8ff', '#7c3aed', '#0c0614'][i % 4]});
}
function impaleStep(z, dt){   // DIMENSIONAL IMPALE: the shard falls for d.fall s, hits (damage + launch to every enemy in the column), then stands for d.duration s
  const d = z.d, f = z.src;
  if(z.enterCd > 0) z.enterCd -= dt;
  if(z.flash > 0) z.flash -= dt;
  if(!z.up && z.t >= d.fall){
    z.up = true; z.upT = z.t;
    G.shake = Math.max(G.shake, .32); G.hs = Math.max(G.hs || 0, .06);
    G.waves.push({x:z.x, y:z.gy - 4, r:d.halfW * 1.7, life:.3, max:.3, col:'#c084fc', fill:'#7c3aed'});
    glassBurst(z.x, z.gy, 30, d.halfW * 1.6, 520);
    foesOf(f).forEach(o => {
      if(o.inv > 0 || o.capturedBy != null || o.slam || !inZone(o, z, d.halfW, d.height * .5)) return;
      const A = skillA(d, {hid:z.hid, shake:d.shake, hitstop:d.hitstop});
      hurt(o, {c:f.c, A, face:Math.sign(o.x - z.x) || f.face, src:f});
    });
  }
  if(z.up && !z.done && !f.dead){                                       // AUTO-ENTER: she walks into the area of her own mirror (after stepping out of it once, so casting it on herself does not whisk her away)
    const inside = Math.abs(f.x - z.x) <= (d.enterR || 50) && Math.abs(f.y - z.gy) <= 70;
    if(!inside) z.armed = true;
    else if(z.armed && !(z.enterCd > 0) && f.stun <= 0 && f.capturedBy == null && !f.fc && !f.onsl && !f.slaughter) dimEnter(z, f);
  }
  if(z.up && z.t >= d.fall + d.duration){ z.done = true; glassBurst(z.x, z.gy - d.height * .4, 22, d.halfW, 300); G.rings.push({x:z.x, y:z.gy - d.height * .4, life:.25}); }   // expiration: it shatters away
}
function dimEnter(z, f){   // Errata walked into her own mirror: disappear and reappear at a random valid spot on the map
  const d = z.d, o = foeOf(f);
  const sp = randomSpots(1, [f, o || f])[0]; if(!sp) return;
  z.enterCd = d.enterCd || .8; z.flash = .35; z.armed = false;       // she must leave the area again before it can take her once more
  G.rings.push({x:z.x, y:z.gy - 30, life:.25}); glassBurst(z.x, z.gy - 24, 16, 20, 360);
  f.atk = 0; f.A = f.base || f.K.basic; f.comboT = 0; f.charging = false; f.chg = 0; f.vx = 0; f.vy = 0;
  blinkTo(f, sp.x, sp.y, o); f.inv = Math.max(f.inv, .2);
  glassBurst(f.x, f.y - 20, 16, 20, 360);
}
function gravityStep(z, dt){   // SHATTERED GRAVITY: forms for d.form s, then for d.duration s drifts enemies inside d.radius toward the center (they can still walk away: the drift is slower than a walk)
  const d = z.d, f = z.src, form = d.form || .35;
  if(z.t >= form + d.duration){ z.done = true; G.rings.push({x:z.x, y:z.cy, life:.25}); glassBurst(z.x, z.cy, 14, d.radius * .5, 300); return; }
  if(z.t < form) return;
  foesOf(f).forEach(o => {
    if(o.dead || o.capturedBy != null || o.slam) return;
    const dx = z.x - o.x, dy = z.cy - (o.y - o.h / 2), dist = Math.hypot(dx, dy);
    if(dist > d.radius || dist < 6) return;
    const k = .35 + .65 * (1 - dist / d.radius);                       // stronger toward the center
    o.x += dx / dist * d.pull * k * dt;                                 // drift added on top of their own movement (they keep control)
    if(!o.gr) o.vy += dy / dist * (d.pullAir || 500) * k * dt;          // in the air they are drawn toward it vertically too
  });
}
// ---- ETERNAL ICE AGE: cast d.cast s (rooted, any hit interrupts it = only d.failCd cooldown), then d.duration s of ice age. Every enemy is slowed (d.slow) and takes d.dps x THEIR max HP per second.
// Zerathis gains 1 Frost stack per second for every enemy (max 1 / second / enemy). He moves and attacks normally while it lasts. f.ice = {ph:'cast'|'on'|'fade', t, d, acc:{}} (arena.js draw reads it).
function iceAgeStep(f, o, dt){
  const I = f.ice, d = I.d; I.t += dt;
  if(I.ph === 'cast'){
    if(f.stun > 0 || f.capturedBy != null || f.frz > 0 || !f.A || f.A.skill !== 'iceage'){   // interrupted during the cast
      f.ice = null; f.uc = d.failCd != null ? d.failCd : f.uc;
      if(f.A && f.A.skill === 'iceage'){ f.atk = 0; f.A = f.base || f.K.basic; }
      G.pops.push({x:f.x, y:f.y - f.h - 22, txt:'INTERRUPTED', life:.8}); iceBurst(f.x, f.y - f.h / 2, 16, 30, 300);
      return;
    }
    if(Math.random() < dt * 40){ const px = f.x + (Math.random() - .5) * 240, py = f.y - Math.random() * 120; G.parts.push({x:px, y:py, vx:(f.x - px) * 2.6, vy:(f.y - f.h / 2 - py) * 2.6 - 40, life:.35, col:ICE_COL[Math.floor(Math.random() * 4)]}); }   // frost gathers toward him
    if(I.t >= d.cast){
      I.ph = 'on'; I.t = 0; G.shake = Math.max(G.shake, .4); G.hs = Math.max(G.hs || 0, .08);
      G.waves.push({x:f.x, y:f.y - 20, r:W * 1.15, life:.7, max:.7, col:'#e8f8ff', fill:'#9fe4ff'}); G.pops.push({x:f.x, y:f.y - f.h - 30, txt:'ICE AGE', life:1});
    }
    return;
  }
  if(I.ph === 'fade'){ if(I.t >= (d.fade || .8)) f.ice = null; return; }
  for(const e of foesOf(f)){
    if(e.capturedBy != null || e.inv > .2) continue;
    e.slowAmt = e.slowT > 0 ? Math.max(e.slowAmt, d.slow) : d.slow; e.slowT = .25;
    const a = I.acc[e.idx] || (I.acc[e.idx] = {dmg:0, pt:.5, tk:0});
    let dmg = e.max * d.dps * dt;
    if(e.bar > 0){ const ab = Math.min(e.bar, dmg); e.bar -= ab; dmg -= ab; }
    e.hp -= dmg; a.dmg += dmg; a.pt -= dt; a.tk += dt;
    if(a.pt <= 0){ a.pt = .5; if(a.dmg >= 1) G.pops.push({x:e.x, y:e.y - e.h - 6, txt:Math.round(a.dmg), life:.6}); a.dmg = 0; }
    while(a.tk >= 1){ a.tk -= 1; frostGain(f, 1); }                                   // 1 stack per second per enemy
    if(e.hp <= 0){ ko(e); continue; }
  }
  if(I.t >= d.duration){ I.ph = 'fade'; I.t = 0; }
}

// ---- VILE OFFERING (held key): hold ATK = he vomits. A COMPLETED vomit leaves one acid puddle. Let go early = no puddle. ----
function vomitCancel(f){
  f.vomit = null;
  if(f.A && f.A.skill === 'vomit'){ f.atk = 0; f.A = f.base || f.K.basic; f.atkCd = Math.max(f.atkCd, .15); }
}
function puddleSpot(f, range){   // where the vomit lands: `range` px in front, on the floor there (or the edge of the platform he stands on)
  let x = f.x + f.face * range, best = null;
  for(const p of G.P) if(x > p.x + 4 && x < p.x + p.w - 4 && p.y >= f.y - 10 && (!best || p.y < best.y)) best = p;
  if(!best){
    const cur = G.P.find(p => f.x > p.x && f.x < p.x + p.w && Math.abs(p.y - f.y) < 6);
    if(cur){ x = Math.max(cur.x + 8, Math.min(cur.x + cur.w - 8, x)); best = cur; }
  }
  return best ? {x, y:best.y} : {x:f.x, y:f.y};
}
function vomitStep(f, dt){
  const d = f.K.hold;
  f.heldT = f.in.held ? (f.heldT || 0) + dt : 0;
  if(!f.in.held) f.vomitN = 0;                                   // a new hold starts again with the nearest puddle spot
  const range = d.ranges[(f.vomitN || 0) % d.ranges.length];       // each vomit in the same hold lands farther: near, middle, far, near...
  if(f.vomit){
    if(!f.in.held || f.stun > 0 || f.capturedBy != null || !f.gr || !f.A || f.A.skill !== 'vomit'){ vomitCancel(f); return; }   // hit / let go / lost the floor = the vomit is cancelled, no puddle
    const V = f.vomit; V.t += dt;
    if(V.t > d.time * .45){                                                       // the stream: green sludge flying from his mouth to the landing spot
      const n = Math.round(dt * 150 + Math.random()), m = f.mouth || {x:f.x + f.face * 14, y:f.y - f.h * .8};   // spawns at his real mouth (art.js sets f.mouth), not the top of his body
      for(let i = 0; i < n; i++) G.parts.push({x:m.x + (Math.random() - .5) * 4, y:m.y + Math.random() * 3, vx:f.face * (range * .6 + Math.random() * 30), vy:10 + Math.random() * 40, life:.34, v:1, col:['#1d2610', '#2c3a14', '#6b1a20', '#8fb534'][Math.floor(Math.random() * 4)]});   // short drool straight down to the puddle at his feet
    }
    if(V.t >= d.time){                                                            // COMPLETED: one puddle
      const s = puddleSpot(f, range); f.vomitN = (f.vomitN || 0) + 1;
      G.puddles.push({x:s.x, y:s.y, w:d.w, owner:f.idx, age:0, seed:Math.random() * 10, d});
      const mine = G.puddles.filter(p => p.owner === f.idx);
      for(let i = 0; i < mine.length - d.max; i++) G.puddles.splice(G.puddles.indexOf(mine[i]), 1);   // a 4th puddle removes the oldest one
      for(let i = 0; i < 14; i++) G.parts.push({x:s.x + (Math.random() - .5) * 30, y:s.y - 4, vx:(Math.random() - .5) * 260, vy:-120 - Math.random() * 200, life:.4, v:1, col:Math.random() < .5 ? '#1d2610' : '#7a1a22'});
      G.rings.push({x:s.x, y:s.y - 4, life:.25});
      f.vomit = null; f.atk = 0; f.A = f.base || f.K.basic; f.atkCd = Math.max(f.atkCd, .12);
    }
    return;
  }
  // start: ATK held long enough, on the ground, free to act. A tap swing that has not hit yet is cancelled by it (a quick tap still does the normal combo).
  if(f.in.held && f.heldT >= d.after && f.gr && f.stun <= 0 && !f.slaughter && !f.hk && !f.rush && f.capturedBy == null && (f.atk <= 0 || (!f.A.skill && !f.hitDone))){
    startSkillA(f, skillA(d, {time:d.time, root:true, noSlash:true}));
    f.vomit = {t:0}; f.comboT = 0; f.charging = false; f.chg = 0; f.aqB = 0;
  }
}
function stepPuddles(dt){   // enemies standing in a puddle take damage and are slowed. His own puddles never hurt him.
  G.puddles.forEach(p => {
    p.age += dt;
    const ow = G.f[p.owner];
    G.f.forEach(o => { if(!o.dead && o.team !== ow.team) puddleHit(p, o, dt); });
  });
}
function puddleHit(p, o, dt){
    const d = p.d;
    if(o.capturedBy != null || o.inv > .2 || Math.abs(o.x - p.x) > p.w / 2 + 8 || o.y < p.y - 14 || o.y > p.y + 4) return;   // feet must be in it (a jump over it is safe)
    o.slowAmt = o.slowT > 0 ? Math.max(o.slowAmt, d.slow) : d.slow; o.slowT = .25;
    let dmg = o.max * d.dps * dt;
    if(o.bar > 0){ const ab = Math.min(o.bar, dmg); o.bar -= ab; dmg -= ab; }
    o.hp -= dmg; o.acid = (o.acid || 0) + dmg; o.acidT = (o.acidT || 0) - dt;
    if(Math.random() < dt * 10) G.parts.push({x:o.x + (Math.random() - .5) * 18, y:o.y - 4, vx:0, vy:-60, life:.35, col:Math.random() < .5 ? '#8f1620' : '#3b4a1c'});
    if(o.acidT <= 0){ o.acidT = .5; if(o.acid >= 1) G.pops.push({x:o.x, y:o.y - o.h - 6, txt:Math.round(o.acid), life:.6}); o.acid = 0; }
    if(o.hp <= 0) ko(o);
}
function endStench(f){   
  const d = f.stench.d, i = f.K.skills.indexOf(d);
  f.stench = null; if(i >= 0) f.sk[i].cd[0] = d.cd;
}
function stenchStep(f, o, dt){ 
  const S = f.stench, d = S.d, cxp = f.x, cyp = f.y - f.h / 2;
  S.age += dt;
  f.hp -= f.max * d.selfDps * dt;                                                   
  if(f.hp <= 0){ ko(f); return; }
  if(Math.random() < dt * 45){                                                     
    const a = Math.random() * 7, r = Math.sqrt(Math.random()) * d.radius;
    G.parts.push({x:cxp + Math.cos(a) * r, y:cyp + Math.sin(a) * r * .8, vx:(Math.random() - .5) * 30, vy:-50 - Math.random() * 40, life:.6, col:Math.random() < .5 ? '#8fb83a' : '#5f8a2a'});
  }
  for(const o of foesOf(f)) if(o.capturedBy == null && o.inv <= .2 && Math.hypot(o.x - cxp, (o.y - o.h / 2) - cyp) <= d.radius){
    o.slowAmt = o.slowT > 0 ? Math.max(o.slowAmt, d.slow) : d.slow; o.slowT = .25;                                              // slow lasts a moment after they leave the cloud
    let dmg = o.max * d.dps * dt;
    if(o.bar > 0){ const ab = Math.min(o.bar, dmg); o.bar -= ab; dmg -= ab; }       // a barrier soaks it first
    o.hp -= dmg; S.acc += dmg; S.pt -= dt;
    if(S.pt <= 0){ S.pt = .5; if(S.acc >= 1) G.pops.push({x:o.x, y:o.y - o.h - 6, txt:Math.round(S.acc), life:.6}); S.acc = 0; }
    if(o.hp <= 0) ko(o);
  }
}
function stepF(f, o, dt){
  atkToken(f);   // tell this frame's attack apart from the last one (Divine Retribution counts one charge per attack)
  if(f.rec > 0) f.rec -= dt;
  if(f.fl) flStep(f, dt);                                                                                  // Pellorin: descending after the Final Curtain
  if(f.fc) fcStep(f, dt);                                                                                  // Pellorin: THE FINAL CURTAIN (beast HP, timer)
  f.slowT = (f.slowT || 0) - dt;
  if(f.rootT > 0) f.rootT -= dt;                                                                          // Crystal Coffin: immobilized
  if(f.lowG > 0){ f.lowG -= dt; if(f.gr) f.lowG = 0; }                                                   // Winter's Grasp: lifted (half gravity)
  if(f.frz > 0){ f.frz -= dt; f.vx = 0; f.atk = 0; if(f.frz <= 0) thawFx(f); }                           // frozen: no move, no action (gravity still pulls)
  if(f.sc && (f.stun > 0 || f.capturedBy != null || f.onsl || f.slaughter)) endSacredCharge(f);   // hit / caught: the charge is cancelled
  if(f.arE > 0) f.arE -= dt;                                                                              // armor debuff runs out
  if(f.holy){ f.holy.t -= dt; if(f.holy.t <= 0) f.holy = null; }                                         // Divine Impact glow runs out
  f.atkCd -= dt; f.comboT -= dt; f.aqB -= dt; f.stun -= dt; f.inv -= dt; f.drop -= dt; f.flash -= dt;
  f.sk.forEach(k => { for(let i = 0; i < k.cd.length; i++) k.cd[i] = Math.max(0, k.cd[i] - dt); });   // every charge recharges on its own
  f.uc = Math.max(0, f.uc - dt);
  chamberStep(f, dt);                                                                                     // Bullet Chamber: reload timer
  if(f.lob) lobStep(f, dt);                                                                               // Explosive Shot wind-up
  if(f.ice) iceAgeStep(f, o, dt);                                                                         // Eternal Ice Age
  if(f.pt > 0){ f.pt -= dt; if(f.pt <= 0) f.bar = 0; }                                                  // passive timer: boost + barrier end together
  const sp = f.c.spd * 52 * (f.fc ? f.fc.d.speed : 1) * (f.pt > 0 ? 1 + f.K.passive.speed : 1) * (f.slowT > 0 ? 1 - f.slowAmt : 1);   // slowAmt = from the enemy's Putrid Stench
  if(f.ge) geStep(f, dt);                                                                                  // Pellorin: The Grand Entrance
  if(f.ns) nsStep(f, dt);                                                                                  // Pellorin: No Strings Detached
  if(f.K.passive && f.K.passive.kind === 'momentum') momentumStep(f, dt);                               // Momentum gauge / buff timer
  if(f.fe > 0) f.fe -= dt;                                                                               // False Existence cooldown
  if(f.bl > 0) bleedTick(f, dt);
  if(f.stench) stenchStep(f, o, dt);
  if(f.K.hold) ({aegis:aegisStep, vomit:vomitStep, sniper:sniperStep}[f.K.hold.kind] || vomitStep)(f, dt);
  if(f.vclaw) clawStep(f, o, dt);
  if(f.sky) skyStep(f, o, dt);                                                                            // Fulminar: Skyfall
  if(f.storm) stormStep(f, o, dt);                                                                        // Fulminar: Storm of Ruin
  if(f.afterimg){ f.afterimg.t += dt; if(f.afterimg.t > f.afterimg.life) f.afterimg = null; }
  if(f.slam) slamStep(f, dt);
  if(f.kdT > 0){ f.kdT -= dt; if(f.gr){ f.kdT = 0; f.stun = Math.max(f.stun, f.kdDur); G.shake = Math.max(G.shake, .15); G.rings.push({x:f.x, y:f.y - 4, life:.25}); for(let i = 0; i < 8; i++) G.parts.push({x:f.x + (Math.random() - .5) * 24, y:f.y - 2, vx:(Math.random() - .5) * 320, vy:-Math.random() * 180, life:.4, col:'#8f6bff'}); } }   // KNOCKDOWN after a launch (Void Claw)
  shadowTick(f, dt);
  if(f.capturedBy != null){ f.vx = f.vy = 0; f.atk = 0; f.in.l = f.in.r = 0; f.jq = f.dq = f.aq = false; f.skq = null; return; }   // caught: cannot move, attack or use skills
  if(f.onsl){ onslaughtStep(f, o, dt); f.jq = f.dq = f.aq = false; f.skq = null; return; }
  if(stepSlaughterhouse(f, dt)){ f.jq = f.dq = f.aq = false; f.skq = null; return; }
  if(f.hk) hookStep(f, o, dt);
  if(f.rush) rushStep(f, o, dt);
  else if(f.shd){ shadowHookStep(f, o, dt); f.skq = null; }
  else if(f.uhand){ handStep(f, o, dt); f.skq = null; }
  else if(f.ls){ lightStep(f, o, dt); }                          // Lightning Step: ball of lightning (own movement, invulnerable)
  else if(f.sc){ sacredChargeStep(f, o, dt); }                    // Sacred Charge: no jump, no attacks, no other skills (the joystick only steers)
  else if(f.stun <= 0 && !(f.frz > 0) && !(f.rec > 0)){   // rec = recovering after the Final Curtain: no moving, no attacks
    const dir = f.rootT > 0 ? 0 : f.in.r - f.in.l;
    const rooted = f.gr && f.atk > 0 && f.A.root;              // rooted punch: feet stay planted on the ground (no walking while swinging, so no foot sliding)
    const slowCharge = f.charging && f.A.chargeMove;               // Void Orb: he can shuffle slowly while charging (chargeMove = share of his speed)
    if(rooted && !slowCharge){ if(dir && !f.aegis && !f.snipe) f.face = dir; f.vx = approach(f.vx, 0, (f.lunged ? 1800 : 3000) * dt); }
    else if(dir){ f.face = dir; f.vx = approach(f.vx, dir * sp * (slowCharge ? f.A.chargeMove : 1), (f.gr ? 3000 : 1600) * dt); }
    else f.vx = approach(f.vx, 0, (f.gr ? (f.atk > 0 && f.A.lunge ? 1800 : 2600) : 500) * dt);   // lunge slides (momentum) instead of stopping dead
    if(f.rootT > 0) f.vx = 0;
    if(f.jq && f.jumps > 0 && !f.aegis && !f.snipe && !(f.rootT > 0)){ f.vy = f.jumps === 2 ? -840 : -780; f.jumps--; f.gr = false; }
    if(f.dq && f.gr && !f.aegis && !f.snipe && !(f.rootT > 0)){ f.drop = .22; f.y += 3; f.gr = false; }
    if(!f.base) f.base = f.A;                                  // basic attack numbers (combo steps are layered on top)
    if(f.aq && f.base.combo) f.aqB = .18;                     // small input buffer, only for combo characters
    if(f.rl > 0) f.aqB = 0;                                    // reloading: a buffered ATK press is thrown away (no surprise shot when the reload ends)
    if((f.aq || f.aqB > 0) && f.atkCd <= 0 && !(f.rl > 0)){   // reloading = he cannot start an attack (he can still walk and jump)
      const cb = f.base.combo;
      if(cb){ f.cs = f.comboT > 0 ? (f.cs + 1) % cb.length : 0; f.A = {...f.base, ...cb[f.cs], step:f.cs}; f.comboT = f.A.cd + .45; }else if(f.A.skill) f.A = f.base;   // next hit of the combo (after a skill: back to the basic attack numbers)
      f.atk = f.A.time; f.atkCd = f.A.cd; f.hitDone = false; f.aqB = 0;
      f.lunged = false; f.fired = 0; f.chg = 0; f.charging = false; f.chgDone = false; if(f.A.chargeP) f.A.cl = 0;
    }
    if(f.skq) castSkill(f, o, f.skq);
  }else f.vx = f.frz > 0 ? 0 : approach(f.vx, 0, (f.gr ? 1500 : 200) * dt);
  f.jq = f.dq = f.aq = false; f.skq = null;

  if(f.atk > 0){
    // CHARGE: a punch with chargeP freezes at its full-load pose while ATK is held; letting go releases it, stronger the longer it was held
    const fz = f.A.chargeP ? f.A.time * (1 - f.A.chargeP) : -1;
    if(fz > 0 && !f.chgDone && f.in.held && f.gr && f.atk <= fz + 1e-4 && f.atk > fz - dt * 2){
      const lo = f.A.chargeMin ?? .15, hi = f.A.chargeMax ?? 1;
      f.atk = fz; f.charging = true; f.chg += dt;
      f.A.chg = f.chg; f.A.cl = Math.max(0, Math.min(1, (f.chg - lo) / (hi - lo)));
      if(f.A.fan) fanAim(f, o);                                  // Errata: read the aim while the shards gather
    }else{
      if(f.charging) endCharge(f, o);
      f.atk -= dt;
    }
    if(f.A.skill === 'divineimpact' && !f.impacted && 1 - f.atk / f.A.time >= f.A.impact.at) divineImpact(f, o);   // the shield hits the ground
    if(f.A.skill === 'quake' && !f.quaked && 1 - f.atk / f.A.time >= (slotDef(f, 2).at || .55)) quakeHit(f, o);   // Total Extinction lands here
    if(!f.lunged && f.atk < f.A.time * (1 - (f.A.lungeP ?? .54))){ f.lunged = true;   // the stomp: step in / hop at the moment the punch is released
      if(f.A.lunge) f.vx = f.face * f.A.lunge;
      if(f.A.hop && f.gr){ f.vy = -f.A.hop; f.gr = false; } }
    const sh0 = f.A.cl > 0 && f.A.chargeShot ? f.A.chargeShot : f.A.shot;   // a charged release (held ATK) fires chargeShot instead of shot
    if(sh0 && !f.fired && 1 - f.atk / f.A.time >= sh0.p && !snipeDefer(f)){ f.fired = 1; shoot(f, sh0); }   // skills.js shot:{...} = fire a projectile (see shoot below)
    if(!f.hitDone && f.atk < f.A.hitFrom && f.atk > f.A.hitTo){
      const hx = f.face > 0 ? f.x + f.w/2 : f.x - f.w/2 - f.A.reach;
      if(hx < o.x + o.w/2 && hx + f.A.reach > o.x - o.w/2 && f.y - f.h < o.y && f.y > o.y - o.h && o.inv <= 0){ hurt(o, f); f.hitDone = true; }
    }
  }

  const py = f.y;
  f.vy = (f.rush || f.fl || (f.shd && f.shd.ph >= 1 && f.shd.ph <= 3)) ? 0 : Math.min(f.vy + GRAV * (f.lowG > 0 ? .5 : 1) * dt, 1200);   // a rush is a straight line (no gravity)
  f.x += f.vx * dt; f.y += f.vy * dt;
  f.gr = false;
  if(f.vy >= 0 && f.drop <= 0){
    for(const p of G.P){
      if(f.x + f.w/2 > p.x && f.x - f.w/2 < p.x + p.w && py <= p.y + 1 && f.y >= p.y){ f.y = p.y; f.vy = 0; f.gr = true; f.jumps = 2; break; }
    }
  }
  if(f.y > H + 260 || f.y < -520 || f.x < -260 || f.x > W + 260){ if(f.fc) endFC(f, 'dead'); else ko(f); }   // knocked out of the arena as the beast = the beast is destroyed (Pellorin loses nothing)
}

// Character-aware bot brain. Difficulty changes reaction/aggression; skill decisions read each fighter's own skills.js data.
function think(f, o, dt){
  if(f.aiHoldT && G.t > f.aiHoldT){ f.in.held = false; f.aiHoldT = 0; }   // the bot lets go of a charged Void Orb
  f.aiT -= dt; if(f.aiT > 0) return;
  if(f.ls){ const dx0 = o.x - f.x; f.in.l = dx0 < -24 ? 1 : 0; f.in.r = dx0 > 24 ? 1 : 0; f.in.held = false; return; }   // Lightning Step: the bot just rolls into the enemy
  const L = LV[G.cfg.difficulty] || LV.Normal, i = f.in, M = G.P[0];
  f.aiT = L.r * (.7 + Math.random() * .6);
  i.l = i.r = 0;

  // Recover toward the main island before trying to fight.
  if(!f.gr && f.y > M.y + 30){
    if(f.x < M.x + M.w/2) i.r = 1; else i.l = 1;
    if(f.vy > -50 && f.jumps > 0) f.jq = true;
    return;
  }

  const dx = o.x - f.x;
  const dy = (o.y - o.h/2) - (f.y - f.h/2);
  const ax = Math.abs(dx), ay = Math.abs(dy), dir = Math.sign(dx) || f.face;
  if(!f.aegis && !f.snipe) f.face = dir;                                      // planted behind the shield: he keeps facing the same way

  if(f.K.hold && f.K.hold.kind === 'aegis'){   // Aegis Stance: plant it when the enemy is a bit away (the setup is slow); hold it while they are in front, let go when they are close, behind or it has been long enough
    const hd = f.K.hold, front = (o.x - f.x) * f.face > 0;
    i.held = f.aegis ? (f.aegis.t < hd.setup + 2.5 && front && ax > 55 && ax < 460) : (f.gr && ax >= 170 && ax < 460 && ay < 90 && Math.random() < .3);
  }
  if(f.K.hold && f.K.hold.kind === 'sniper'){   // Deadeye Sniper: the bot starts an aim when the enemy is at a distance and the sniper is ready (it lets go by itself inside sniperStep)
    if(!f.snipe){
      if(!i.held) i.held = f.snCd <= 0 && f.gr && f.atk <= 0 && !f.snLock && ax >= 220 && ax <= 560 && ay < ax * .8 && Math.random() < (G.cfg.difficulty === 'Hard' ? .5 : .3);
      else if(f.heldT > .8) i.held = false;       // could not start: let go
    }
  }
  if(f.K.hold && f.K.hold.kind === 'vomit'){   // held-key attack (Vile Offering): the bot holds ATK when the enemy is a bit away, so the puddle lands near them
    const hd = f.K.hold, mine = G.puddles.filter(p => p.owner === f.idx).length;
    i.held = f.gr && ax < hd.w * .7 + hd.ranges[hd.ranges.length - 1] && ay < 80 && (mine < hd.max || Math.random() < .25) && Math.random() < .55;
  }
  // Estimate a useful fighting distance from this character's actual kit.
  const defs = [...(f.K.skills || []), f.K.ultimate].filter(Boolean);
  const ranged = !f.fc && defs.some(d => d.aim && d.kind !== 'shadowhook' && (d.range || d.speed * (d.life || 0)) > 150);
  const puppeteer = !f.fc && !!f.K.basic.string;   // Pellorin: his PUPPET does the hitting (it runs in `follow + dash` px), so he fights at puppet range and never backs away from it
  const sniperK = f.K.hold && f.K.hold.kind === 'sniper';
  const shardUser = !f.fc && !!f.K.basic.fan;   // Errata: her shards only reach ~90 px, so she fights close (her long-range skills are zones, not projectiles)
  const desired = f.fc ? 36 : puppeteer ? 78 : shardUser ? 80 : f.K.basic.chargeShot || sniperK ? 250 : ranged ? 145 : Math.max(48, Math.min(82, (f.K.basic.reach || 46) + 20));
  if(ax > desired + 18){ if(dx > 0) i.r = 1; else i.l = 1; }
  else if(ax < desired - 28 && ranged && !puppeteer && !shardUser && Math.random() < (G.cfg.difficulty === 'Hard' ? .7 : .42)){
    if(dx > 0) i.l = 1; else i.r = 1;
  }

  // Platform navigation.
  if(f.gr){
    if(dy < -80 && Math.random() < .78) f.jq = true;
    else if(dy > 90 && Math.random() < .52) f.dq = true;
    const move = i.r - i.l;
    if(move){
      const ex = f.x + move * 34;
      if(!G.P.some(p => ex > p.x && ex < p.x + p.w && Math.abs(p.y - f.y) < 6)){
        if(dy < -30 || Math.random() < L.jump) f.jq = true;
        else i.l = i.r = 0;
      }
    }
  }else if(f.jumps > 0 && dy < -90 && f.vy > 0 && Math.random() < .55) f.jq = true;

  if(o.inv > .08 || f.stun > 0 || f.slaughter || f.capturedBy != null) return;

  // Evaluate each available skill against its intended range and target position.
  let best = null, bestScore = 0;
  const verticalOK = ay < 95;
  for(let slot = 0; slot < 3; slot++){
    const d = slotDef(f, slot);
    if(!d || !SKILLS[d.kind] || f.fc) continue;   // the beast has no skills
    const ready = slot < 2
      ? !!f.sk[slot] && f.sk[slot].cd.some(c => c <= 0)
      : f.uc <= 0;
    if(!ready) continue;

    const range = d.range || (d.speed && d.life ? d.speed * d.life : 0);
    const reach = d.reach || f.K.basic.reach || 46;
    let score = 0, aimOv = null;
    switch(d.kind){
      case 'onslaught':
        if(CAN.onslaught(f, o, d) && Math.hypot(dx, dy) <= (d.range || 300) * .9) score = 96;
        break;
      case 'shadowhook':
        if(ay < 120 && ax >= 70 && ax <= (d.range || 340) * .92) score = 80;
        break;
      case 'replicate':
        if(f.shadows.length){
          const far = f.hp < f.max * .35, pick = f.shadows.map(q => ({q, dd:Math.hypot(q.x - o.x, q.y - o.y)})).sort((a, b) => far ? b.dd - a.dd : a.dd - b.dd)[0];
          if((far && Math.hypot(dx, dy) < 140) || (!far && ax > 230)){ const mx = pick.q.x - f.x, my = pick.q.y - f.y, mm = Math.hypot(mx, my) || 1; aimOv = {ax:mx / mm, ay:my / mm}; score = 70; }
        }else if(ax < 330) score = 52;
        break;
      case 'voidclaw': {   // ground claw on the enemy's spot; a READY passive makes it more eager (the claw is a skill hit that can trigger the slam)
        if(ax <= (d.range || 340) && ay < 170 && CAN.voidclaw(f, o, d, 0, 0, null)){ score = f.fr >= 5 ? 90 : 66; aimOv = {ax:clampN(dx / (d.range || 340), -1, 1), ay:0, m:1}; }
        break; }
      case 'wintergrasp': {   // ground spikes under where the enemy is going to be (a little ahead of them on Normal / Hard: they get a 1 s warning)
        const R = d.range || 420, lead = G.cfg.difficulty === 'Easy' ? 0 : G.cfg.difficulty === 'Hard' ? .45 : .25, tx = clampN(o.x + (o.vx || 0) * lead, 30, W - 30);
        if(f.gr && Math.abs(tx - f.x) <= R && ay < 170 && CAN.wintergrasp(f, o, d, clampN((tx - f.x) / R, -1, 1), 0, 1)){ score = 68; aimOv = {ax:clampN((tx - f.x) / R, -1, 1), ay:0, m:1}; }
        break; }
      case 'crystalcoffin': {   // wall them in when they are close to the spot and not already trapped
        const R = d.range || 420;
        if(f.gr && ax <= R && ay < 140 && !(o.rootT > 0) && CAN.crystalcoffin(f, o, d, clampN(dx / R, -1, 1), 0, 1)){ score = 64; aimOv = {ax:clampN(dx / R, -1, 1), ay:0, m:1}; }
        break; }
      case 'iceage':   // a 3 s cast: start it when the enemy is not on top of him (a hit interrupts it)
        if(!f.ice && f.gr && ax > 130 && f.hp > f.max * .25) score = 88;
        break;
      case 'dimimpale': {   // Errata: drop the mirror on the enemy's spot when they are in range
        const R = d.range || 360;
        if(f.gr && ax <= R && ay < 170 && CAN.dimimpale(f, o, d, 0, 0, null)){ score = 74; aimOv = {ax:clampN(dx / R, -1, 1), ay:0, m:1}; }
        break; }
      case 'shatteredgravity': {   // Errata: a pull zone on the enemy (not when they are already on top of her)
        const R = d.range || 340;
        if(f.gr && ax >= 50 && ax <= R && ay < 170 && CAN.shatteredgravity(f, o, d, 0, 0, null)){ score = 63; aimOv = {ax:clampN(dx / R, -1, 1), ay:0, m:1}; }
        break; }
      case 'grandentrance': {   // the puppet stomps on the enemy's spot
        const R = d.range || 400;
        if(f.gr && ax <= R && ay < 170 && CAN.grandentrance(f, o, d, 0, 0, null)){ score = 66; aimOv = {ax:clampN(dx / R, -1, 1), ay:0, m:1}; }
        break; }
      case 'shadowstep': {   // evade a swing / get away when low; close the gap when far
        const threat = o.atk > 0 && ax < 160, R = d.range || 300;
        if(threat || (f.hp < f.max * .3 && ax < 130)){ aimOv = {ax:-dir, ay:0, m:1}; if(stepDest(f, o, d, -dir, 0, 1)) score = threat ? 76 : 64; }
        else if(ax > 360){ aimOv = {ax:dir, ay:clampN(dy / R, -1, 1), m:1}; if(stepDest(f, o, d, aimOv.ax, aimOv.ay, 1)) score = 46; }
        break; }
      case 'finalcurtain':   // the bot unleashes the beast when the enemy is close enough to be mauled
        if(CAN.finalcurtain(f) && ax < 300 && ay < 150) score = 92;
        break;
      case 'abysshand':
        if(CAN.abysshand(f, o, d)) score = 97;
        break;
      case 'slaughterhouse':
        if(CAN.slaughterhouse(f, o, d) && Math.hypot(dx, dy) <= d.grab * .9) score = 100;
        break;
      case 'quake':
        if(Math.hypot(dx, dy) <= (d.radius || 0) * .88) score = 84;
        break;
      case 'heavensverdict':
        if(CAN.heavensverdict(f, o, d) && Math.hypot(dx, dy) <= d.range * .9) score = 90;
        break;
      case 'sacredcharge':
        if(f.gr && verticalOK && ax >= 90 && ax <= d.speed * d.duration * .6) score = 73;
        break;
      case 'melee':
        if(ax <= reach + 38 && verticalOK) score = 76;
        break;
      case 'hook':
        if(verticalOK && ax >= 72 && ax <= (range || 300) * .92) score = 82;
        else if(verticalOK && ax < 72 && ax <= reach + 24) score = 30;
        break;
      case 'lightningstep':   // chase from a distance (he is untouchable and fast)
        if(ax >= 200 && ax <= 520 && ay < 150) score = 66;
        break;
      case 'skyfall': {   // storm the enemy's spot
        const R = d.range || 380;
        if(ax <= R && ay < 170 && CAN.skyfall(f, o, d, 0, 0, null)){ score = 70; aimOv = {ax:clampN(dx / R, -1, 1), ay:0, m:1}; }
        break; }
      case 'stormofruin':
        if(!f.storm && ax < 560) score = 82;
        break;
      case 'shockwave':
        if(ax >= 82 && ax <= (range || 280) * .94 && ay < 125) score = 74;
        break;
      case 'lobshot': {   // Explosive Shot: lob it at (where the enemy will be) when they are at a middle distance
        const R = d.range || 520, lead = G.cfg.difficulty === 'Easy' ? 0 : .5, adx = Math.abs(dx + (o.vx || 0) * lead);
        if(f.gr && !f.snipe && adx >= d.minR + 20 && adx <= R * .94 && ay < 150){ score = 68; aimOv = {ax:Math.sign(dx) || f.face, ay:0, m:clampN((adx - d.minR) / (R - d.minR), 0, 1)}; }
        break; }
      case 'rush':
        if(f.gr && verticalOK && ax >= 105 && ax <= (d.dist || 0) * .88) score = 72;
        break;
      case 'stench':
        if(f.stench) score = (Math.hypot(dx, dy) > d.radius * 1.4 || f.hp < f.max * .3) ? 90 : 0;   // on: turn it off when the enemy is far or he is low on HP
        else if(Math.hypot(dx, dy) <= d.radius * .9 && f.hp > f.max * .5) score = 70;   // off: turn it on when the enemy is close and he is healthy
        break;
      default:
        if(d.radius && Math.hypot(dx, dy) <= d.radius * .8) score = 62;
        else if(range && ax <= range * .85 && ay < 110) score = 58;
        else if(reach && ax <= reach + 28 && verticalOK) score = 54;
        break;
    }

    if(!score) continue;
    if(slot === 2) score += 9;
    if(f.atk > .08) score *= .55;
    if(score > bestScore){ bestScore = score; best = {slot, d, aimOverride:aimOv}; }
  }

  // Send the decision through the same skill queue used by player controls.
  if(best && f.atk <= .08 && Math.random() < (G.cfg.difficulty === 'Easy' ? .62 : G.cfg.difficulty === 'Hard' ? .96 : .82)){
    const d = best.d, m = Math.hypot(dx, dy) || 1;
    f.skq = best.aimOverride ? {i:best.slot, ...best.aimOverride, drag:true} : d.aim
      ? {i:best.slot, ax:dx/m, ay:dy/m, drag:true}
      : {i:best.slot};
    return;
  }

  if(f.K.basic.fan && ax > 30 && ax < 260 && verticalOK && f.atk <= 0 && f.atkCd <= 0 && !f.in.held && Math.random() < (G.cfg.difficulty === 'Hard' ? .55 : .35)){   // Errata: gather some shards and fire the fan (shotgun up close)
    f.aq = true; f.in.held = true; f.aiHoldT = G.t + .8 + Math.random() * .6; return;   // must outlast Errata's casting time (castTime) or the hold fires nothing
  }
  const bsB = f.K.basic.burst;   // THUNDER BURST: the bot holds ATK when the enemy is close, then lets go for the shockwave
  if(bsB && ax < 120 && verticalOK && f.atk <= 0 && f.atkCd <= 0 && !f.in.held && Math.random() < (G.cfg.difficulty === 'Hard' ? .35 : .2)){
    f.aq = true; f.in.held = true; f.aiHoldT = G.t + .4 + Math.random() * .6; return;
  }
  const cs = f.K.basic.chargeShot;   // VOID ORB: hold ATK to charge from a distance, let go after a random charge time (longer when far)
  if(cs && ax > 130 && ax < 520 && verticalOK && f.atk <= 0 && f.atkCd <= 0 && !f.in.held && Math.random() < (G.cfg.difficulty === 'Hard' ? .8 : .55)){
    f.aq = true; f.in.held = true; f.aiHoldT = G.t + .55 + Math.random() * .6 + (f.fr >= 5 ? .25 : 0); return;
  }
  const basicReach = f.fc ? 78 : puppeteer ? (f.K.basic.string.follow || 46) + 55 : shardUser ? 88 : sniperK ? 300 : (f.K.basic.reach || 46) + 18;   // puppeteer: the puppet's dash reaches ~follow + 80-105 px   // Caliber: his pistols reach far
  if(ax <= basicReach && verticalOK && Math.random() < L.atk) f.aq = true;
}
function update(dt){
  const a = G.f[0];
  if(!a.dead){
    a.in.l = Ctl.l; a.in.r = Ctl.r;
    if(Ctl.jump){ a.jq = true; Ctl.jump = false; }
    if(Ctl.drop){ a.dq = true; Ctl.drop = false; }
    if(Ctl.atk){ a.aq = true; Ctl.atk = false; }
    a.in.held = Ctl.held;
    a.in.aim = Ctl.atkV || (Math.hypot(Ctl.sx, Ctl.sy) > .4 ? {x:Ctl.sx, y:Ctl.sy} : null); a.in.ay = Ctl.dn - Ctl.up;   // aiming a held attack (Deadeye Sniper): drag ATK or the stick, or W / S
    [0, 1, 2].forEach(i => { if(Ctl.sk[i]){ a.skq = {i, ...Ctl.sk[i]}; Ctl.sk[i] = null; } });   // skill casts from the buttons / keys 1 2 3
  }else{ Ctl.jump = Ctl.drop = Ctl.atk = false; [0, 1, 2].forEach(i => Ctl.sk[i] = null); }    // you are out: your allies keep fighting
  const live = G.f.filter(f => !f.dead);
  live.forEach(f => { f.cur = foeOf(f); });                                                      // everyone picks the enemy they are fighting
  live.forEach(f => { if(f.idx !== 0 && f.cur && (G.mode === 'ai' || f.team === 0)) think(f, f.cur, dt); });   // bots: every fighter but you (sparring: only your allies, the dummies stand still)
  live.forEach(f => { if(f.cur) stepF(f, f.cur, dt); });
  stepPuddles(dt); stepVerdicts(dt); stepIceZones(dt); stepErrZones(dt);
  G.parts.forEach(q => { q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 900 * dt; });
  G.parts = G.parts.filter(q => q.life > 0);
  G.pops.forEach(q => { q.life -= dt; q.y -= 70 * dt; }); G.pops = G.pops.filter(q => q.life > 0);
  G.rings.forEach(q => q.life -= dt); G.rings = G.rings.filter(q => q.life > 0);
  G.waves.forEach(q => q.life -= dt); G.waves = G.waves.filter(q => q.life > 0);
  if(G.bolts){ G.bolts.forEach(q => q.life -= dt); G.bolts = G.bolts.filter(q => q.life > 0); }
  G.cuts.forEach(q => q.life -= dt); G.cuts = G.cuts.filter(q => q.life > 0);
  G.slaughterFx.forEach(q => q.age += dt); G.slaughterFx = G.slaughterFx.filter(q => q.age < q.life);
  updateShots(dt);
  G.shake = Math.max(0, G.shake - dt);
}

function rr(x, y, w, h, r){ cx.beginPath(); if(cx.roundRect) cx.roundRect(x, y, w, h, r); else cx.rect(x, y, w, h); }

function chainLine(x1, y1, x2, y2, sag){   // a chain of links from (x1,y1) to (x2,y2), hanging down by `sag` px in the middle
  const n = Math.max(2, Math.round(Math.hypot(x2 - x1, y2 - y1) / 7)), ang = Math.atan2(y2 - y1, x2 - x1);
  cx.lineWidth = 2; cx.strokeStyle = '#a4abb5';
  for(let i = 1; i < n; i++){
    const u = i / n, x = x1 + (x2 - x1) * u, y = y1 + (y2 - y1) * u + Math.sin(u * Math.PI) * sag;
    cx.beginPath(); cx.ellipse(x, y, 4.2, 2.2, ang + (i % 2 ? 0 : Math.PI / 2), 0, 7); cx.stroke();
  }
}

// ---- ZERATHIS drawing: ice zones, the Ice Age, the frozen block ----
const iceRnd = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };   // fixed pseudo-random 0..1 per number (same every frame)
function iceSpike(x, y, w, h, lean, fill){   // one jagged ice spike standing on (x, y)
  cx.beginPath(); cx.moveTo(x - w, y); cx.lineTo(x - w * .25 + lean * .4, y - h * .55); cx.lineTo(x + lean, y - h); cx.lineTo(x + w * .3 + lean * .4, y - h * .5); cx.lineTo(x + w, y); cx.closePath();
  cx.fillStyle = fill; cx.fill(); cx.strokeStyle = '#f2fbff'; cx.lineWidth = 1; cx.lineJoin = 'round'; cx.stroke();
  cx.fillStyle = 'rgba(255,255,255,.55)'; cx.beginPath(); cx.moveTo(x - w * .1, y); cx.lineTo(x + lean * .9, y - h * .92); cx.lineTo(x + w * .45, y); cx.closePath(); cx.fill();
}
// ---- ERRATA zones: the glitching mirror shard (Dimensional Impale) and the gravity distortion (Shattered Gravity) ----
function mirrorShard(x, tipY, H, W2, alpha, gl){   // a tall kite-shaped glass shard, tip pointing DOWN at (x, tipY); gl = glitch amount 0..1
  const pts = [[0, 0], [-W2 * .55, -H * .3], [-W2, -H * .72], [-W2 * .25, -H], [W2 * .7, -H * .9], [W2, -H * .45], [W2 * .45, -H * .2]];
  const path = (ox) => { cx.beginPath(); pts.forEach((q, i) => i ? cx.lineTo(x + q[0] + ox, tipY + q[1]) : cx.moveTo(x + q[0] + ox, tipY + q[1])); cx.closePath(); };
  cx.save(); cx.globalAlpha = alpha;
  if(gl > 0){ const j = Math.sin(G.t * 53) * 3 * gl; cx.globalAlpha = alpha * .5; path(j); cx.fillStyle = 'rgba(80,220,255,.55)'; cx.fill(); path(-j); cx.fillStyle = 'rgba(255,70,200,.5)'; cx.fill(); cx.globalAlpha = alpha; }
  path(0);
  const g = cx.createLinearGradient(x - W2, tipY - H, x + W2, tipY);
  g.addColorStop(0, '#2a1450'); g.addColorStop(.35, '#a77bff'); g.addColorStop(.5, '#f3e8ff'); g.addColorStop(.65, '#6d3bd2'); g.addColorStop(1, '#1b0c33');
  cx.fillStyle = g; cx.fill(); cx.strokeStyle = '#e9d5ff'; cx.lineWidth = 1.6; cx.lineJoin = 'round'; cx.stroke();
  cx.clip(); cx.strokeStyle = 'rgba(255,255,255,.5)'; cx.lineWidth = 1;            // cracks + reflection streaks
  cx.beginPath(); cx.moveTo(x - W2 * .2, tipY - H * .85); cx.lineTo(x + W2 * .05, tipY - H * .55); cx.lineTo(x - W2 * .15, tipY - H * .3); cx.moveTo(x + W2 * .05, tipY - H * .55); cx.lineTo(x + W2 * .5, tipY - H * .6); cx.stroke();
  cx.globalAlpha = alpha * .35; cx.fillStyle = '#fff'; cx.beginPath(); cx.moveTo(x - W2 * .6, tipY - H * .7); cx.lineTo(x - W2 * .3, tipY - H * .75); cx.lineTo(x + W2 * .1, tipY - H * .1); cx.lineTo(x - W2 * .1, tipY - H * .1); cx.closePath(); cx.fill();
  if(gl > 0){ cx.globalAlpha = alpha * .6; for(let i = 0; i < 3; i++){ const yy = tipY - H * (.15 + .27 * ((Math.floor(G.t * 9) + i * 3) % 3 + i * .1)); cx.fillStyle = i % 2 ? 'rgba(80,220,255,.6)' : 'rgba(255,70,200,.55)'; cx.fillRect(x - W2 * 1.2, yy, W2 * 2.4, 2); } }   // glitch scanlines
  cx.restore();
}
function drawErrZones(){
  G.errZ.forEach(z => {
    const d = z.d, t = z.t; cx.save();
    if(z.kind === 'impale'){
      if(!z.up){                                           // SUMMONING: marker on the ground + the shard materializes above and falls
        const k = Math.min(1, t / d.fall), fl = .5 + .5 * Math.sin(t * (14 + 30 * k));
        cx.strokeStyle = 'rgba(192,132,252,' + (.5 + .4 * fl) + ')'; cx.fillStyle = 'rgba(124,58,237,' + (.12 + .2 * k) + ')'; cx.lineWidth = 2; cx.setLineDash([6, 5]);
        cx.beginPath(); cx.ellipse(z.x, z.gy - 2, d.halfW, d.halfW * .28, 0, 0, 7); cx.fill(); cx.stroke(); cx.setLineDash([]);
        const e = k * k, tipY = z.gy - (1 - e) * (d.height + 260);
        mirrorShard(z.x, tipY, d.height, d.halfW * .85, Math.min(1, k * 3), 1 - k * .6);
      }else{                                               // STANDING: embedded in the ground; portal shimmer; blinks in its last 1.5 s
        const life = d.fall + d.duration - t, blink = life < 1.5 ? (Math.sin(t * 24) > 0 ? 1 : .35) : 1, near = z.src && Math.abs(z.src.x - z.x) <= (d.enterR || 70) && Math.abs(z.src.y - z.gy) <= 70;
        cx.globalAlpha = blink; cx.fillStyle = 'rgba(0,0,0,.3)'; cx.beginPath(); cx.ellipse(z.x, z.gy, d.halfW * .8, 5, 0, 0, 7); cx.fill();
        mirrorShard(z.x, z.gy + 8, d.height, d.halfW * .85, blink, z.flash > 0 ? 1 : (Math.sin(t * 7) > .85 ? .6 : .12));
        const pu = .5 + .5 * Math.sin(t * 6), my = z.gy - d.height * .45;                // portal shimmer in the glass (brighter when she is close enough to enter)
        cx.globalAlpha = blink * ((near ? .55 : .22) + .15 * pu); cx.fillStyle = '#e9d5ff'; cx.beginPath(); cx.ellipse(z.x, my, d.halfW * .32, d.height * .26, 0, 0, 7); cx.fill();
        if(near){ cx.globalAlpha = blink * .9; cx.strokeStyle = '#f3e8ff'; cx.lineWidth = 1.5; cx.setLineDash([4, 4]); cx.beginPath(); cx.ellipse(z.x, z.gy - 2, (d.enterR || 70) * .6, (d.enterR || 70) * .17, 0, 0, 7); cx.stroke(); cx.setLineDash([]); }
      }
    }else{                                                 // GRAVITY: swirling rings + shards streaming into a dark glitching core
      const form = d.form || .35, fk = Math.min(1, t / form), out = Math.min(1, (form + d.duration - t) / .5), a = Math.max(0, Math.min(fk, out)), R = d.radius * (.4 + .6 * fk), cy = z.cy;
      cx.globalAlpha = a;
      cx.fillStyle = 'rgba(124,58,237,.12)'; cx.beginPath(); cx.ellipse(z.x, z.gy - 2, R, R * .26, 0, 0, 7); cx.fill();       // area on the ground
      const g = cx.createRadialGradient(z.x, cy, 2, z.x, cy, R); g.addColorStop(0, 'rgba(12,6,20,.85)'); g.addColorStop(.35, 'rgba(60,20,110,.35)'); g.addColorStop(1, 'rgba(124,58,237,0)');
      cx.fillStyle = g; cx.beginPath(); cx.arc(z.x, cy, R, 0, 7); cx.fill();
      cx.lineWidth = 1.5;
      for(let i = 0; i < 4; i++){ const rr = R * (1 - ((t * .45 + i / 4) % 1) * .85); cx.strokeStyle = 'rgba(192,132,252,' + (.55 * (1 - rr / R) + .15) + ')'; cx.setLineDash([10, 8]); cx.lineDashOffset = -t * 40 * (i % 2 ? 1 : -1); cx.beginPath(); cx.ellipse(z.x, cy, rr, rr * .62, t * (i % 2 ? .8 : -.8), 0, 7); cx.stroke(); }
      cx.setLineDash([]);
      for(let i = 0; i < 16; i++){ const ph = (t * .55 + i / 16) % 1, rr = R * (1 - ph), an = i * 2.4 + t * 2.2 + ph * 3.2, px = z.x + Math.cos(an) * rr, py = cy + Math.sin(an) * rr * .62;   // shards spiral inward
        cx.save(); cx.translate(px, py); cx.rotate(an + 1.2); cx.globalAlpha = a * (.35 + .65 * ph); cx.fillStyle = i % 3 ? '#a855f7' : '#f3e8ff'; cx.beginPath(); cx.moveTo(-2.5, -5 * (.5 + ph)); cx.lineTo(2.5, -3); cx.lineTo(0, 5 * (.5 + ph)); cx.closePath(); cx.fill(); cx.restore(); }
      cx.globalAlpha = a; const j = Math.sin(t * 47) * 2.2;
      cx.fillStyle = 'rgba(80,220,255,.5)'; cx.beginPath(); cx.arc(z.x + j, cy, 9 * fk, 0, 7); cx.fill(); cx.fillStyle = 'rgba(255,70,200,.45)'; cx.beginPath(); cx.arc(z.x - j, cy, 9 * fk, 0, 7); cx.fill();
      cx.fillStyle = '#0c0614'; cx.strokeStyle = '#c084fc'; cx.lineWidth = 2; cx.beginPath(); cx.arc(z.x, cy, 8 * fk, 0, 7); cx.fill(); cx.stroke();
    }
    cx.restore();
  });
}
function drawIceZones(){
  G.iceZ.forEach(z => {
    const d = z.d, t = z.t, gy = z.gy;
    cx.save();
    if(z.kind === 'grasp'){
      if(t < d.warn){                       // WARNING: frost creeps over the marked ground, cracks spread, small crystals sprout, the flicker speeds up
        const k = Math.min(1, t / d.warn), rx = d.halfW * (.35 + .65 * Math.min(1, k * 1.6)), fl = .55 + .45 * Math.sin(t * (10 + 26 * k));
        const g = cx.createRadialGradient(z.x, gy - 2, 2, z.x, gy - 2, rx);
        g.addColorStop(0, 'rgba(232,248,255,' + (.55 * fl) + ')'); g.addColorStop(1, 'rgba(95,180,240,' + (.22 + .2 * k) + ')');
        cx.fillStyle = g; cx.beginPath(); cx.ellipse(z.x, gy - 2, rx, rx * .26, 0, 0, 7); cx.fill();
        cx.strokeStyle = 'rgba(210,242,255,' + (.7 * fl + .2) + ')'; cx.lineWidth = 2.5; cx.beginPath(); cx.ellipse(z.x, gy - 2, d.halfW, d.halfW * .26, 0, 0, 7); cx.stroke();
        cx.lineWidth = 1.2; cx.strokeStyle = 'rgba(240,252,255,.8)';
        for(let i = 0; i < 9; i++){ const a = i / 9 * 6.283 + iceRnd(i + z.hid) * .5, L = rx * (.35 + .6 * k) * (.6 + iceRnd(i * 3 + z.hid) * .5); cx.beginPath(); cx.moveTo(z.x, gy - 2); cx.lineTo(z.x + Math.cos(a) * L * .5 + (iceRnd(i) - .5) * 6, gy - 2 + Math.sin(a) * L * .13); cx.lineTo(z.x + Math.cos(a) * L, gy - 2 + Math.sin(a) * L * .26); cx.stroke(); }
        const n = Math.floor(k * 9);
        for(let i = 0; i < n; i++){ const sx = z.x + (iceRnd(i * 7 + z.hid) * 2 - 1) * d.halfW * .85, sh = 5 + 9 * k * (.5 + iceRnd(i * 5 + z.hid)); iceSpike(sx, gy - 1, 2.4, sh, (iceRnd(i) - .5) * 4, 'rgba(190,232,255,.9)'); }
      }else{                                // ERUPTION: spikes shoot up fast, hold, then sink / crumble
        const u = t - d.warn, rise = Math.min(1, u / .12), fall = Math.max(0, (u - (d.linger || .7) + .25) / .25), hk = rise * (1 - fall);
        const n = 9;
        for(let i = 0; i < n; i++){
          const sx = z.x + ((i + .5) / n * 2 - 1) * d.halfW * .98, sh = d.height * (.55 + .5 * iceRnd(i * 11 + z.hid)) * hk * (1 - Math.abs(sx - z.x) / (d.halfW * 1.6)), sw = 6 + 5 * iceRnd(i * 3 + z.hid);
          if(sh > 1) iceSpike(sx, gy + 1, sw, sh, (iceRnd(i * 17 + z.hid) - .5) * 10, i % 2 ? 'rgba(170,224,255,.96)' : 'rgba(210,242,255,.96)');
        }
      }
    }else{
      const R = d.radius;
      if(t < d.form){                       // FORMING: a ring on the ground, crystals start pushing up
        const k = t / d.form;
        cx.strokeStyle = 'rgba(190,235,255,' + (.35 + .5 * k) + ')'; cx.lineWidth = 2; cx.setLineDash([6, 5]); cx.beginPath(); cx.ellipse(z.x, gy - 2, R, R * .26, 0, 0, 7); cx.stroke(); cx.setLineDash([]);
        for(let i = 0; i < 7; i++){ const sx = z.x + (iceRnd(i * 5 + z.hid) * 2 - 1) * R * .9; iceSpike(sx, gy - 1, 2.2, 4 + 20 * k * (.5 + iceRnd(i + z.hid)), 0, 'rgba(190,232,255,.85)'); }
      }
      (z.pris || []).forEach(p => {         // THE COFFIN: a faceted crystal prism around the prisoner, more cracked the closer it is to shattering
        const o = p.o; if(z.shat || o.dead || !(o.rootT > 0)) return;
        const life = 1 - o.rootT / d.trap, x = o.x, y = o.y, h = o.h + 12, w = 24, fadeIn = Math.min(1, (z.t - d.form) / .15 + .2);
        cx.globalAlpha = Math.min(1, fadeIn);
        cx.fillStyle = 'rgba(150,215,250,.3)'; cx.strokeStyle = 'rgba(232,248,255,.95)'; cx.lineWidth = 2; cx.lineJoin = 'round';
        cx.beginPath(); cx.moveTo(x - w, y + 2); cx.lineTo(x - w - 3, y - h * .55); cx.lineTo(x - w * .5, y - h); cx.lineTo(x, y - h - 8); cx.lineTo(x + w * .5, y - h); cx.lineTo(x + w + 3, y - h * .55); cx.lineTo(x + w, y + 2); cx.closePath(); cx.fill(); cx.stroke();
        cx.strokeStyle = 'rgba(255,255,255,.55)'; cx.lineWidth = 1.2; cx.beginPath(); cx.moveTo(x - w * .45, y - h * .1); cx.lineTo(x - w * .3, y - h * .9); cx.moveTo(x + w * .25, y - h * .15); cx.lineTo(x + w * .4, y - h * .8); cx.stroke();
        const cr = Math.floor(life * 6); cx.strokeStyle = 'rgba(255,255,255,.9)'; cx.lineWidth = 1;
        for(let i = 0; i < cr; i++){ const cy0 = y - h * (.15 + iceRnd(i * 3 + 1) * .7); cx.beginPath(); cx.moveTo(x - w + iceRnd(i) * w * 2, cy0); cx.lineTo(x - w + iceRnd(i + 9) * w * 2, cy0 - 8 - iceRnd(i + 4) * 10); cx.stroke(); }   // cracks
        for(let i = 0; i < 4; i++) iceSpike(x - w + 6 + i * (w * 2 - 12) / 3, y + 1, 4, 14 + iceRnd(i + z.hid) * 12, (i - 1.5) * 2, 'rgba(190,232,255,.95)');   // spikes at the foot
        cx.globalAlpha = 1;
      });
    }
    cx.restore();
  });
}
// the Ice Age: BACK layer = tint + frost on the platforms (under the fighters), FRONT layer = snowfall + frozen vignette (over them)
const iceK = f => { const I = f.ice; if(!I) return 0; const d = I.d; return I.ph === 'cast' ? Math.min(.45, I.t / d.cast * .45) : I.ph === 'on' ? Math.min(1, .45 + I.t / .6) : Math.max(0, 1 - I.t / (d.fade || .8)); };
function iceAgeK(){ let k = 0; G.f.forEach(f => { k = Math.max(k, iceK(f)); }); return k; }
function drawIceAgeBack(){
  const k = iceAgeK(); if(k <= 0) return;
  cx.save();
  const g = cx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(120,190,255,' + (.3 * k) + ')'); g.addColorStop(1, 'rgba(225,245,255,' + (.2 * k) + ')');
  cx.fillStyle = g; cx.fillRect(-300, -300, W + 600, H + 600);
  G.P.forEach((p, pi) => {                                           // frost crust + icicles on every platform
    cx.fillStyle = 'rgba(232,248,255,' + (.9 * k) + ')'; cx.fillRect(p.x, p.y - 3 * k, p.w, 4 + 2 * k);
    const n = Math.floor(p.w / 14);
    for(let i = 0; i < n; i++){ const ix = p.x + 7 + i * 14 + (iceRnd(i + pi * 31) - .5) * 5, ih = (8 + 18 * iceRnd(i * 3 + pi * 13)) * k; iceSpike(ix, p.y + p.h + 1, 2.6, -ih, 0, 'rgba(190,232,255,' + (.85 * k) + ')'); }
    cx.fillStyle = 'rgba(232,248,255,' + (.8 * k) + ')'; for(let i = 0; i < 4; i++) iceSpike(p.x + iceRnd(i + pi * 9) * p.w, p.y - 1, 3, 9 * k * (.6 + iceRnd(i * 7 + pi)), (iceRnd(i) - .5) * 3, 'rgba(210,242,255,' + (.9 * k) + ')');
  });
  cx.restore();
}
function drawIceAgeFront(){
  const k = iceAgeK(); if(k <= 0) return;
  cx.save();
  const v = cx.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, W * .72); v.addColorStop(0, 'rgba(200,235,255,0)'); v.addColorStop(1, 'rgba(190,230,255,' + (.38 * k) + ')');
  cx.fillStyle = v; cx.fillRect(-300, -300, W + 600, H + 600);
  cx.fillStyle = '#ffffff';
  for(let i = 0; i < 70; i++){                                       // snowfall (every flake is a pure function of time)
    const sp = 38 + 70 * iceRnd(i * 3), x = ((iceRnd(i) * (W + 80) + Math.sin(G.t * .8 + i) * 18 - G.t * 14) % (W + 80) + (W + 80)) % (W + 80) - 40, y = ((iceRnd(i + 50) * H + G.t * sp) % (H + 20)) - 10;
    cx.globalAlpha = k * (.35 + .5 * iceRnd(i * 7)); cx.fillRect(x, y, 1.5 + 2 * iceRnd(i * 5), 1.5 + 2 * iceRnd(i * 5));
  }
  cx.globalAlpha = 1; cx.restore();
}
function drawFrozen(f){   // the ice block around a frozen fighter (a little more cracked as it is about to thaw)
  const x = f.x, y = f.y, h = f.h + 10, w = 21, soon = f.frz < .25 ? .5 + .5 * Math.sin(G.t * 40) : 1;
  cx.save(); cx.lineJoin = 'round'; cx.globalAlpha = soon;
  cx.fillStyle = 'rgba(150,220,255,.38)'; cx.strokeStyle = 'rgba(240,252,255,.95)'; cx.lineWidth = 2;
  cx.beginPath(); cx.moveTo(x - w, y + 3); cx.lineTo(x - w - 2, y - h * .6); cx.lineTo(x - w * .4, y - h - 1); cx.lineTo(x + w * .45, y - h + 1); cx.lineTo(x + w + 2, y - h * .55); cx.lineTo(x + w, y + 3); cx.closePath(); cx.fill(); cx.stroke();
  cx.strokeStyle = 'rgba(255,255,255,.6)'; cx.lineWidth = 1.2; cx.beginPath(); cx.moveTo(x - w * .5, y - 4); cx.lineTo(x - w * .3, y - h * .85); cx.moveTo(x + w * .3, y - 6); cx.lineTo(x + w * .5, y - h * .7); cx.moveTo(x - w * .7, y - h * .4); cx.lineTo(x + w * .2, y - h * .5); cx.stroke();
  cx.restore();
}

function drawF(f){
  const x = f.x, y = f.y;
  cx.save();
  if(f.inv > 0 && Math.floor(G.t * 20) % 2) cx.globalAlpha = .45;
  if(f.capturedBy != null){ cx.translate(x, y - f.h / 2); cx.rotate(f.capRot ?? Math.PI); cx.translate(-x, -(y - f.h / 2)); }
  const fcArt = f.fc && Characters.artOf(f.c.id).fcDraw;   // Final Curtain: the body on screen is the beast (+ the floating dancer), art.js draws both
  if(f.ls) drawBall(f); else if(fcArt) fcArt(cx, f, G.t); else Body.draw(cx, f, G.t);   // default ragdoll body (body.js).
  if(f.frz > 0) drawFrozen(f);   // frozen: ice block around the fighter Later: if(f.c.img) draw the sprite instead.
  if(f.bar > 0){ cx.fillStyle = 'rgba(127,208,255,.14)'; cx.strokeStyle = 'rgba(127,208,255,.85)'; cx.lineWidth = 2; cx.beginPath(); cx.ellipse(x, y - f.h / 2, 24, f.h / 2 + 8, 0, 0, 7); cx.fill(); cx.stroke(); }   // barrier
  if(f.atk > 0 && f.atk < f.A.time - .04 && !f.A.noSlash){
    cx.strokeStyle = 'rgba(255,255,255,.9)'; cx.lineWidth = 5; cx.beginPath();
    const a0 = f.face > 0 ? -1 : Math.PI - 1;
    cx.arc(x, y - f.h/2, 42 * f.A.reach / 58, a0, a0 + 2); cx.stroke();
  }
  cx.fillStyle = f.idx === 0 ? '#4fc3f7' : f.team === 0 ? '#5be37d' : '#ff7a45';   // you = blue, your allies = green, enemies = orange
  cx.beginPath(); cx.moveTo(x - 6, y - f.h - 14); cx.lineTo(x + 6, y - f.h - 14); cx.lineTo(x, y - f.h - 6); cx.fill();
  if(f.K.passive && f.K.passive.kind === 'hunger'){   // ABYSSAL HUNGER: Shadow Fragments as violet pips over his head; READY = all lit + a pulsing aura and ring
    const mx = f.K.passive.max, rdy = f.fr >= mx, pu = .5 + .5 * Math.sin(G.t * 9);
    if(rdy){ cx.strokeStyle = 'rgba(143,107,255,' + (.45 + .4 * pu) + ')'; cx.lineWidth = 2.5; cx.beginPath(); cx.ellipse(x, y - f.h / 2, 22 + pu * 3, f.h / 2 + 8 + pu * 3, 0, 0, 7); cx.stroke(); }
    for(let i = 0; i < mx; i++){
      const px = x - (mx - 1) * 5 + i * 10, py = y - f.h - 26, on = i < f.fr;
      cx.fillStyle = on ? (rdy ? '#e4d6ff' : '#8f6bff') : 'rgba(80,60,140,.35)'; cx.beginPath(); cx.moveTo(px, py - 5); cx.lineTo(px + 4, py); cx.lineTo(px, py + 5); cx.lineTo(px - 4, py); cx.closePath(); cx.fill();
      if(on){ cx.strokeStyle = rdy ? 'rgba(255,255,255,' + (.5 + .5 * pu) + ')' : 'rgba(210,190,255,.7)'; cx.lineWidth = 1; cx.stroke(); }
    }
  }
  if(f.K.passive && f.K.passive.kind === 'static'){   // STATIC CHARGE: cyan pips over his head; READY (full) = all lit + a pulsing electric ring
    const mx = f.K.passive.max || 6, n = f.stc || 0, rdy = n >= mx, pu = .5 + .5 * Math.sin(G.t * 12);
    if(rdy){ cx.strokeStyle = 'rgba(120,240,255,' + (.45 + .45 * pu) + ')'; cx.lineWidth = 2.5; cx.beginPath(); cx.ellipse(x, y - f.h / 2, 22 + pu * 3, f.h / 2 + 8 + pu * 3, 0, 0, 7); cx.stroke(); }
    for(let i = 0; i < mx; i++){
      const px = x - (mx - 1) * 5 + i * 10, py = y - f.h - 26, on = i < n;
      cx.fillStyle = on ? (rdy ? '#ffffff' : '#00e5ff') : 'rgba(40,90,110,.4)'; cx.beginPath(); cx.moveTo(px + 1, py - 6); cx.lineTo(px + 4, py - 1); cx.lineTo(px + 1, py); cx.lineTo(px + 3, py + 6); cx.lineTo(px - 4, py - 1); cx.lineTo(px - 1, py - 1); cx.closePath(); cx.fill();
    }
  }
  if(f.K.passive && f.K.passive.kind === 'retribution'){   // DIVINE RETRIBUTION: golden pips over his head; READY = all lit + a pulsing golden aura
    const mx = f.K.passive.max, rdy = f.dv >= mx, pu = .5 + .5 * Math.sin(G.t * 9);
    if(rdy){ cx.strokeStyle = 'rgba(255,224,138,' + (.45 + .4 * pu) + ')'; cx.lineWidth = 2.5; cx.beginPath(); cx.ellipse(x, y - f.h / 2, 22 + pu * 3, f.h / 2 + 8 + pu * 3, 0, 0, 7); cx.stroke(); }
    for(let i = 0; i < mx; i++){
      const px = x - (mx - 1) * 5 + i * 10, py = y - f.h - 26, on = i < f.dv;
      cx.fillStyle = on ? (rdy ? '#fff3c4' : '#f5c542') : 'rgba(150,120,40,.3)'; cx.beginPath(); cx.arc(px, py, 4, 0, 7); cx.fill();
      if(on){ cx.strokeStyle = rdy ? 'rgba(255,255,255,' + (.5 + .5 * pu) + ')' : 'rgba(255,236,170,.7)'; cx.lineWidth = 1; cx.stroke(); }
    }
  }
  if(f.K.passive && f.K.passive.kind === 'chamber'){   // BULLET CHAMBER: 5 bullets over his head (4 brass + 1 red critical). Fired = dark. Reloading = a bar fills under them.
    const mx = f.K.passive.max, pu = .5 + .5 * Math.sin(G.t * 12), rl = f.rl > 0;
    for(let i = 0; i < mx; i++){
      const px = x - (mx - 1) * 6 + i * 12, py = y - f.h - 28, on = i >= f.mag && !rl, last = i === mx - 1;
      const bw = last ? 4.5 : 3.5, bh = last ? 12 : 10;
      cx.fillStyle = on ? (last ? '#ff4a2e' : '#e8b84a') : 'rgba(60,60,70,.55)';
      cx.beginPath(); cx.rect(px - bw, py - bh / 2 + 3, bw * 2, bh - 3); cx.fill();                       // case
      cx.beginPath(); cx.moveTo(px - bw, py - bh / 2 + 3); cx.quadraticCurveTo(px, py - bh / 2 - 5, px + bw, py - bh / 2 + 3); cx.fill();   // round tip
      if(on && last){ cx.shadowColor = '#ff4a2e'; cx.shadowBlur = 6 + 8 * (f.mag === mx - 1 ? pu : .3); cx.strokeStyle = '#ffd0c0'; cx.lineWidth = 1; cx.stroke(); cx.shadowBlur = 0; }   // the critical one glows; brighter when it is NEXT
    }
    if(rl){ const k = 1 - f.rl / f.K.passive.reload, bx = x - 18, by = y - f.h - 17; cx.fillStyle = 'rgba(0,0,0,.45)'; cx.fillRect(bx, by, 36, 4); cx.fillStyle = '#2fb8a0'; cx.fillRect(bx, by, 36 * k, 4); }
  }
  if(f.K.passive && f.K.passive.kind === 'momentum'){   // THE SHOW MUST GO ON: gold gauge over his head (fills with hits, drains when idle). While the buff runs: glowing bar that empties + a gold outline around him.
    const P = f.K.passive, on = f.mbT > 0, k = on ? f.mbT / P.dur : f.mo / 100, bx = x - 20, by = y - f.h - 24, pu = .5 + .5 * Math.sin(G.t * 10);
    if(on){ cx.strokeStyle = 'rgba(255,212,121,' + (.5 + .4 * pu) + ')'; cx.lineWidth = 2; cx.beginPath(); cx.ellipse(x, y - f.h / 2, 21, f.h / 2 + 7, 0, 0, 7); cx.stroke(); }
    cx.fillStyle = 'rgba(0,0,0,.55)'; cx.fillRect(bx - 1, by - 1, 42, 6);
    if(on){ cx.shadowColor = '#ffd479'; cx.shadowBlur = 6 + 4 * pu; }
    cx.fillStyle = on ? '#fff2c4' : '#d9486a'; cx.fillRect(bx, by, 40 * k, 4); cx.shadowBlur = 0;
  }
  if(f.K.passive && f.K.passive.kind === 'frost'){   // ABSOLUTE ZERO: Frost stacks as ice diamonds over his head; READY = all lit + a pulsing frost ring
    const mx = f.K.passive.max, rdy = f.fsRdy, pu = .5 + .5 * Math.sin(G.t * 9);
    if(rdy){ cx.strokeStyle = 'rgba(190,240,255,' + (.45 + .4 * pu) + ')'; cx.lineWidth = 2.5; cx.beginPath(); cx.ellipse(x, y - f.h / 2, 22 + pu * 3, f.h / 2 + 8 + pu * 3, 0, 0, 7); cx.stroke(); }
    for(let i = 0; i < mx; i++){
      const px = x - (mx - 1) * 5 + i * 10, py = y - f.h - 26, on = i < f.fs || rdy;
      cx.fillStyle = on ? (rdy ? '#ffffff' : '#7fd0ff') : 'rgba(60,100,150,.35)'; cx.beginPath(); cx.moveTo(px, py - 5); cx.lineTo(px + 4, py); cx.lineTo(px, py + 5); cx.lineTo(px - 4, py); cx.closePath(); cx.fill();
      if(on){ cx.strokeStyle = rdy ? 'rgba(220,248,255,' + (.5 + .5 * pu) + ')' : 'rgba(200,238,255,.8)'; cx.lineWidth = 1; cx.stroke(); }
    }
  }
  if(f.K.hold && f.K.hold.kind === 'sniper'){   // DEADEYE SNIPER: a scope icon left of the bullets. Teal = ready, dark pie = cooling down, ring = aim progress (red + pulsing = LOCKED, release to fire).
    const d = f.K.hold, S = f.snipe, ix = x - 42, iy = y - f.h - 25, R = 7, pu = .5 + .5 * Math.sin(G.t * 16), cdk = f.snCd > 0 ? f.snCd / d.cd : 0;
    cx.fillStyle = 'rgba(10,14,20,.7)'; cx.beginPath(); cx.arc(ix, iy, R + 1.5, 0, 7); cx.fill();
    cx.strokeStyle = cdk > 0 ? 'rgba(127,255,240,.3)' : (d.icon === 'ice' ? '#bfe8ff' : '#7ffff0'); cx.lineWidth = 1.2; cx.beginPath();
    if(d.icon === 'ice'){ for(let q = 0; q < 3; q++){ const a = q * Math.PI / 3; cx.moveTo(ix - Math.cos(a) * R, iy - Math.sin(a) * R); cx.lineTo(ix + Math.cos(a) * R, iy + Math.sin(a) * R); } }   // snowflake
    else{ cx.arc(ix, iy, R - 2, 0, 7); cx.moveTo(ix - R, iy); cx.lineTo(ix + R, iy); cx.moveTo(ix, iy - R); cx.lineTo(ix, iy + R); }
    cx.stroke();
    if(cdk > 0){ cx.fillStyle = 'rgba(0,0,0,.6)'; cx.beginPath(); cx.moveTo(ix, iy); cx.arc(ix, iy, R + 1, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * cdk); cx.closePath(); cx.fill(); }
    if(S && S.ph === 'aim'){ const k = Math.min(1, S.t / (d.kneel + d.aim)); cx.strokeStyle = S.ready ? (d.icon === 'ice' ? 'rgba(190,240,255,' + (.6 + .4 * pu) + ')' : 'rgba(255,70,60,' + (.6 + .4 * pu) + ')') : '#ffd27a'; cx.lineWidth = 2.2; cx.beginPath(); cx.arc(ix, iy, R + 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); cx.stroke(); }
  }
  if(f.slowHolyT > G.t){ cx.strokeStyle = 'rgba(255,214,90,.8)'; cx.lineWidth = 2; cx.beginPath(); cx.ellipse(x, y - 2, 18, 5, 0, 0, 7); cx.stroke(); }   // holy slow: gold ring at the feet
  if(f.arE > 0){ cx.strokeStyle = 'rgba(255,100,80,.8)'; cx.lineWidth = 2; cx.setLineDash([5, 4]); cx.beginPath(); cx.ellipse(x, y - f.h / 2, 20, f.h / 2 + 6, 0, 0, 7); cx.stroke(); cx.setLineDash([]); }   // armor broken (Heaven's Verdict): red dashed outline
  if(f.slowVoidT > G.t){ cx.strokeStyle = 'rgba(143,107,255,.7)'; cx.lineWidth = 2; cx.beginPath(); cx.ellipse(x, y - 2, 18, 5, 0, 0, 7); cx.stroke(); }   // void slow: violet ring at the feet
  if(f.mk > 0){ cx.fillStyle = '#c0242c'; for(let i = 0; i < f.mk; i++) cx.fillRect(x - f.mk * 4 + i * 8, y - f.h - 24, 6, 6); }   // Meat Marks = red pips over the head
  cx.restore();
}

function draw(){
  cx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  const g = cx.createLinearGradient(0, 0, 0, view.h);
  g.addColorStop(0, '#0a1030'); g.addColorStop(1, '#1a0f2e');
  cx.fillStyle = g; cx.fillRect(0, 0, view.w, view.h);
  const sk = (G.shake || 0) * 60;
  cx.save(); cx.translate(view.ox + (Math.random() - .5) * sk, view.oy + (Math.random() - .5) * sk); cx.scale(view.s, view.s);
  cx.fillStyle = 'rgba(255,255,255,.5)';
  G.stars.forEach(t => cx.fillRect(t.x, t.y, t.r, t.r));
  G.P.forEach(p => {
    cx.fillStyle = '#232a4d'; cx.beginPath();
    cx.moveTo(p.x, p.y); cx.lineTo(p.x + p.w, p.y);
    cx.lineTo(p.x + p.w * .88, p.y + p.h + (p.main ? 70 : 30)); cx.lineTo(p.x + p.w * .12, p.y + p.h + (p.main ? 70 : 30));
    cx.closePath(); cx.fill();
    cx.fillStyle = '#4a5a94'; cx.fillRect(p.x, p.y, p.w, p.h);
    cx.fillStyle = '#7fd0ff'; cx.fillRect(p.x, p.y, p.w, 4);
  });
  drawIceAgeBack();
  G.puddles.forEach(p => {   // VILE OFFERING: sinister bile pool on the floor (under the fighters): black tar, blood veins, sickly rim, blinking eyes, rising wisps
    const k = Math.min(1, p.age / .25), rx = p.w / 2 * k, ry = 6 * k, x = p.x, y = p.y + 1, T = G.t + p.seed;
    cx.save();
    cx.fillStyle = 'rgba(110,20,30,.28)'; cx.beginPath(); cx.ellipse(x, y, rx + 10, ry + 5, 0, 0, 7); cx.fill();         // dark blood-red halo
    cx.fillStyle = '#10150b'; cx.beginPath(); cx.ellipse(x, y, rx, ry, 0, 0, 7); cx.fill();                              // black tar body
    cx.strokeStyle = 'rgba(150,200,50,.55)'; cx.lineWidth = 1.2; cx.beginPath(); cx.ellipse(x, y, rx, ry, 0, 0, 7); cx.stroke();   // sickly green rim
    cx.fillStyle = 'rgba(90,120,40,.35)'; cx.beginPath(); cx.ellipse(x - 4, y - 1, rx * .7, ry * .45, 0, 0, 7); cx.fill();   // dull oily sheen
    cx.strokeStyle = 'rgba(170,25,35,.85)'; cx.lineWidth = 1; cx.lineCap = 'round';                                      // crawling blood veins
    for(let i = 0; i < 4; i++){
      const a0 = i * 1.6 + Math.sin(T * .7 + i) * .4, vx0 = x + Math.cos(a0) * rx * .15, vy0 = y + Math.sin(a0) * ry * .15;
      const vx1 = x + Math.cos(a0 + Math.sin(T + i * 2) * .5) * rx * .85, vy1 = y + Math.sin(a0) * ry * .8;
      cx.globalAlpha = .75 * k; cx.beginPath(); cx.moveTo(vx0, vy0); cx.quadraticCurveTo((vx0 + vx1) / 2, (vy0 + vy1) / 2 - 2 * Math.sin(T * 2 + i), vx1, vy1); cx.stroke();
    }
    for(let i = 0; i < 2; i++){                                                                                          // two eyes open and close in the muck
      const ph = (T * .45 + i * .5) % 1, op = ph < .5 ? Math.sin(ph / .5 * Math.PI) : 0;
      if(op < .08) continue;
      const ex = x + (i ? .3 : -.28) * rx, ey = y - 1 + (i ? 1 : -1);
      cx.globalAlpha = k * op; cx.fillStyle = '#e8d070'; cx.beginPath(); cx.ellipse(ex, ey, 3.2, 1.2 + op * 1.6, 0, 0, 7); cx.fill();
      cx.fillStyle = '#1a0507'; cx.fillRect(ex - .6, ey - 1.2 * op - .5, 1.2, 2.4 * op + 1);                            // slit pupil
    }
    cx.lineWidth = 1.1;
    for(let i = 0; i < 4; i++){                                                                                          // dark bubbles pop, wisps of rot rise
      const ph = (T * .7 + i * .27) % 1, bx = x + (((i * 53 + p.seed * 7) % 10) / 10 - .5) * rx * 1.5;
      cx.globalAlpha = (1 - ph) * k * .9; cx.strokeStyle = 'rgba(150,40,45,.9)'; cx.beginPath(); cx.arc(bx, y - ph * 8, 1.2 + ph * 2.4, 0, 7); cx.stroke();
      cx.globalAlpha = (1 - ph) * k * .35; cx.fillStyle = '#5a7a2a'; cx.beginPath(); cx.arc(bx + Math.sin(ph * 6 + i) * 4, y - 6 - ph * 22, 2 + ph * 4, 0, 7); cx.fill();
    }
    cx.restore();
  });
  G.parts.forEach(q => { if(!q.v) return; cx.globalAlpha = Math.max(0, q.life * 2.5); cx.fillStyle = q.col; cx.fillRect(q.x, q.y, 5, 5); });   // VILE OFFERING sludge: drawn UNDER the fighters so his arms (rear arm too) sit on top of it
  cx.globalAlpha = 1;
  G.f.forEach(f => {   // PUTRID STENCH: a soft green rotting cloud around him (drawn under the fighters)
    const S = f.stench; if(!S) return;
    const r = S.d.radius, x = f.x, y = f.y - f.h / 2, k = Math.min(1, S.age / .3);
    cx.save(); cx.globalAlpha = k;
    const g = cx.createRadialGradient(x, y, r * .1, x, y, r);
    g.addColorStop(0, 'rgba(120,170,40,.38)'); g.addColorStop(.7, 'rgba(95,138,42,.26)'); g.addColorStop(1, 'rgba(70,110,30,0)');
    cx.fillStyle = g; cx.beginPath(); cx.arc(x, y, r, 0, 7); cx.fill();
    for(let i = 0; i < 7; i++){                                                  // slow rolling blobs of gas
      const a = i * 2.4 + S.age * (.5 + i * .07), d = r * (.25 + .4 * ((i * 37) % 10) / 10), br = r * (.22 + .06 * Math.sin(S.age * 2 + i));
      cx.fillStyle = 'rgba(143,184,58,.13)'; cx.beginPath(); cx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * .8, br, 0, 7); cx.fill();
    }
    cx.restore();
  });
  G.f.forEach(f => {   // SHADOW REPLICATION: the stationary shadows (under the fighters; both players can see them). art.js clone() draws one.
    f.shadows.forEach(q => { const ca = Characters.artOf(f.c.id).clone; if(!ca) return; cx.save(); ca(cx, {x:q.x, y:q.y, face:q.face, a:Math.min(1, q.age / .25), k:0, slash:false, seed:q.seed, still:true}, G.t); cx.restore(); });
  });
  G.f.forEach(f => { const a = Characters.artOf(f.c.id); if(a.fxBack){ cx.save(); a.fxBack(cx, f, G.t, G); cx.restore(); } });   // per-hero effects under the bodies (rifts, afterimages, the back of the giant hand)
  G.f.forEach(f => { if(!f.dead) drawF(f); });
  if((G.cfg.size || 1) > 1) G.f.forEach(f => {   // team match: allies (green) and enemies (red) show their health above their head; only YOUR bar is in the corner
  if(f.idx === 0 || f.dead) return;
  const bw = 46, bx = f.x - bw / 2, by = f.y - f.h - 30, r = Math.max(0, Math.min(1, f.fc ? f.fc.hp / f.fc.max : f.hp / f.max));
  cx.save(); if(f.inv > 0 && Math.floor(G.t * 20) % 2) cx.globalAlpha = .6;
  cx.fillStyle = 'rgba(0,0,0,.55)'; cx.fillRect(bx - 1, by - 1, bw + 2, 7);
  cx.fillStyle = f.team === 0 ? '#4cd97b' : '#ff4d5e'; cx.fillRect(bx, by, bw * r, 5);
  if(f.bar > 0){ cx.fillStyle = '#7fd0ff'; cx.fillRect(bx, by + 5, bw * Math.min(1, f.bar / f.max), 2); }   // barrier
  if(G.mode === 'ai'){ cx.fillStyle = '#fff'; for(let i = 0; i < f.stocks; i++){ cx.beginPath(); cx.arc(f.x - (f.stocks - 1) * 3.5 + i * 7, by - 5, 2, 0, 7); cx.fill(); } }   // stocks left
  cx.restore();
});

  G.f.forEach(f => { const a = Characters.artOf(f.c.id); if(a.fx){ cx.save(); a.fx(cx, f, G.t, G); cx.restore(); } });   // ...and over them (the claw, the fingers)
  G.f.forEach(f => {   // PHANTOM ONSLAUGHT: shadow chains (from each shadow to the target, wrapping it) + the shadows themselves (art.js clone())
    const S = f.onsl; if(!S) return; const ca = Characters.artOf(f.c.id).clone, o = S.target, tx = S.cxo, ty = S.cyo - o.h / 2;
    if(S.chainK > 0){
      const e = S.chainK * S.chainK * (3 - 2 * S.chainK);
      cx.save(); cx.lineCap = 'round';
      S.copies.forEach(c => {
        const x1 = c.px, y1 = c.py - 26, x2 = x1 + (tx - x1) * e, y2 = y1 + (ty - y1) * e, sag = 10 * (1 - e) + 2;
        cx.beginPath(); cx.moveTo(x1, y1); cx.quadraticCurveTo((x1 + x2) / 2, (y1 + y2) / 2 + sag, x2, y2);
        cx.strokeStyle = 'rgba(120,110,255,.35)'; cx.lineWidth = 6; cx.stroke();
        cx.strokeStyle = '#14172b'; cx.lineWidth = 3.4; cx.stroke();
        cx.strokeStyle = '#b9bcff'; cx.lineWidth = 1.6; cx.setLineDash([3, 4]); cx.stroke(); cx.setLineDash([]);
      });
      const n = Math.ceil(e * 5);                                    // coils wrap the target one by one
      for(let i = 0; i < n; i++){
        const yy = ty - o.h * .4 + i * o.h * .2, sw = i % 2 ? -1 : 1;
        cx.strokeStyle = '#14172b'; cx.lineWidth = 4.5; cx.beginPath(); cx.ellipse(tx, yy, 17, 4.5, sw * .28, 0, 7); cx.stroke();
        cx.strokeStyle = '#8f95ff'; cx.lineWidth = 1.6; cx.beginPath(); cx.ellipse(tx, yy, 17, 4.5, sw * .28, 0, Math.PI); cx.stroke();
      }
      cx.restore();
    }
    if(!ca) return;
    S.copies.forEach((c, i) => {
      if(c.a <= .02) return;
      if(Math.hypot(c.px - c.ppx, c.py - c.ppy) > 9){ cx.save(); cx.globalAlpha = c.a * .5; cx.strokeStyle = '#c9d0ff'; cx.lineWidth = 3; cx.beginPath(); cx.moveTo(c.ppx, c.ppy - 26); cx.lineTo(c.px, c.py - 26); cx.stroke(); cx.restore(); }   // speed streak while jumping
      const hold = S.t >= S.tC;
      cx.save(); ca(cx, {x:c.px, y:c.py, face:Math.sign(tx - c.px) || 1, a:c.a * .85, k:hold ? .25 + .1 * Math.sin(S.t * 14 + i) : .3, slash:true, sw:i & 1, seed:c.seed}, G.t); cx.restore();
    });
  });
  G.cuts.forEach(q => {   // slash marks across the target
    const k = q.life / q.max, dx = Math.cos(q.a) * q.len / 2, dy = Math.sin(q.a) * q.len / 2;
    cx.save(); cx.globalAlpha = Math.min(1, k * 1.6); cx.lineCap = 'round';
    cx.strokeStyle = 'rgba(155,28,39,.9)'; cx.lineWidth = q.big ? 8 : 5; cx.beginPath(); cx.moveTo(q.x - dx, q.y - dy); cx.lineTo(q.x + dx, q.y + dy); cx.stroke();
    cx.strokeStyle = '#fff'; cx.lineWidth = q.big ? 3 : 2; cx.beginPath(); cx.moveTo(q.x - dx, q.y - dy); cx.lineTo(q.x + dx, q.y + dy); cx.stroke(); cx.restore();
  });
  // SLAUGHTERHOUSE: the hook chain flies out, wraps the enemy in coils, and holds them in front of him while he chops and bites.
  G.f.forEach(f => {
    const S = f.slaughter; if(!S || !S.target) return;
    const o = S.target, ox = f.x + f.face * 16, oy = f.y - 36, tx = o.x, ty = o.y - o.h / 2;
    const u = Math.min(1, S.t / S.deploy), eu = 1 - (1 - u) * (1 - u);              // hook flight 0..1
    const ex = ox + (tx - ox) * eu, ey = oy + (ty - oy) * eu;
    const k = Math.max(0, Math.min(1, (S.t - S.deploy) / S.pull));                  // pull 0..1: the chain goes from slack to tight
    cx.save(); cx.lineCap = 'round';
    chainLine(ox, oy, ex, ey, 14 * (1 - k) + 3 + (S.kick > 0 ? 3 : 0));
    if(u < 1){ cx.strokeStyle = '#d4d7dc'; cx.lineWidth = 3; cx.beginPath(); cx.arc(ex, ey, 6, .5, Math.PI * 1.6); cx.stroke(); }   // hook head while it flies
    const n = Math.ceil(Math.max(0, Math.min(1, (S.t - S.deploy * .9) / .25)) * 5);   // coils appear one by one after the hook lands
    for(let i = 0; i < n; i++){
      const yy = ty - o.h * .38 + i * o.h * .19, sw = i % 2 ? -1 : 1;
      cx.strokeStyle = '#4d535c'; cx.lineWidth = 4.5; cx.beginPath(); cx.ellipse(tx, yy, 17, 4.5, sw * .28, 0, 7); cx.stroke();
      cx.strokeStyle = '#b7bdc6'; cx.lineWidth = 2; cx.beginPath(); cx.ellipse(tx, yy, 17, 4.5, sw * .28, 0, Math.PI); cx.stroke();
    }
    cx.restore();
  });
  (G.sh || []).forEach(s => {   // projectiles: the character's art.js shot() draws it, else a plain glowing ball
    cx.save(); const sa = Characters.artOf(s.id).shot;
    if(sa) sa(cx, s, G.t); else { cx.fillStyle = s.c.color; cx.beginPath(); cx.arc(s.x, s.y, s.r, 0, 7); cx.fill(); }
    cx.restore();
  });
  G.f.forEach(f => {   // hook + chain (art.js hook(cx, h, t) can draw it, else a plain line)
    const h = f.hk || (f.shd && (f.shd.ph === 0 || f.shd.ph === 1 || f.shd.ph === 5) ? f.shd : null); if(!h) return; const ha = Characters.artOf(f.c.id).hook;
    cx.save(); if(ha) ha(cx, h, G.t); else { cx.strokeStyle = '#aab0b7'; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(h.ox, h.oy); cx.lineTo(h.x, h.y); cx.stroke(); cx.beginPath(); cx.arc(h.x, h.y, 6, 0, 7); cx.fillStyle = '#ddd'; cx.fill(); } cx.restore();
  });
  const am = Ctl.aim, af = G.f[0], ad = am && slotDef(af, am.i);
  if(ad && ad.kind === 'replicate' && !am.cancel){   // Shadow Replication: summon = no aim line; teleport = ring on the shadow the aim picks
    if(af.shadows.length){
      const ax = am.drag ? am.ax : af.face, ay = am.drag ? am.ay : 0; let bi = 0, bs = -9;
      af.shadows.forEach((q, i) => { const dx = q.x - af.x, dy = q.y - af.y, L = Math.hypot(dx, dy) || 1, sc = (dx * ax + dy * ay) / L - L / 6000; if(sc > bs){ bs = sc; bi = i; } });
      const q = af.shadows[bi];
      cx.save(); cx.strokeStyle = 'rgba(180,170,255,.9)'; cx.lineWidth = 3; cx.setLineDash([7, 6]); cx.beginPath(); cx.moveTo(af.x, af.y - 26); cx.lineTo(q.x, q.y - 26); cx.stroke(); cx.setLineDash([]);
      cx.beginPath(); cx.ellipse(q.x, q.y - 26, 20, 34, 0, 0, 7); cx.stroke(); cx.restore();
    }
  }else if(ad && (ad.kind === 'voidclaw' || ad.kind === 'shadowstep' || ad.kind === 'wintergrasp' || ad.kind === 'crystalcoffin' || ad.kind === 'grandentrance' || ad.kind === 'dimimpale' || ad.kind === 'shatteredgravity' || ad.kind === 'skyfall') && !am.cancel){   // ground-targeted: a marker on the ground spot (grey X = no valid spot)
    const o2 = foeOf(af), ax = am.drag ? am.ax : af.face, ay = am.drag ? am.ay : 0, mg = am.drag ? am.m : null;
    const sp = ad.kind === 'shadowstep' ? stepDest(af, o2, ad, ax, ay, mg) : groundAim(af, o2, ad, ax, ay, mg);
    cx.save(); cx.lineWidth = 3;
    if(sp){
      const rx = ad.kind === 'shadowstep' ? 20 : (ad.halfW || ad.radius), ice = ad.kind === 'wintergrasp' || ad.kind === 'crystalcoffin', pu = .6 + .4 * Math.sin(G.t * 10);
      const zap = ad.kind === 'skyfall', gold = ad.kind === 'grandentrance'; cx.strokeStyle = zap ? 'rgba(120,240,255,.95)' : ice ? 'rgba(160,230,255,.95)' : gold ? 'rgba(255,212,121,.95)' : 'rgba(143,107,255,.9)'; cx.fillStyle = zap ? 'rgba(0,229,255,' + (.22 * pu) + ')' : ice ? 'rgba(95,180,240,' + (.3 * pu) + ')' : gold ? 'rgba(194,59,91,' + (.3 * pu) + ')' : 'rgba(58,26,140,' + (.25 * pu) + ')'; cx.setLineDash([7, 6]); cx.beginPath(); cx.moveTo(af.x, af.y - af.h / 2); cx.lineTo(sp.x, sp.y - 4); cx.stroke(); cx.setLineDash([]);
      cx.beginPath(); cx.ellipse(sp.x, sp.y - 2, rx, rx * .28, 0, 0, 7); cx.fill(); cx.stroke();
      if(ad.kind === 'voidclaw'){ cx.beginPath(); cx.moveTo(sp.x - rx, sp.y - 2); cx.lineTo(sp.x - rx, sp.y - ad.height * .35); cx.moveTo(sp.x + rx, sp.y - 2); cx.lineTo(sp.x + rx, sp.y - ad.height * .35); cx.globalAlpha = .4; cx.stroke(); }
    }else{
      const R = ad.range || 300, bx = af.x + ax * (mg == null ? .7 : Math.max(.25, mg)) * R, by = af.y - af.h / 2;
      cx.strokeStyle = 'rgba(190,190,200,.8)'; cx.beginPath(); cx.moveTo(bx - 9, by - 9); cx.lineTo(bx + 9, by + 9); cx.moveTo(bx + 9, by - 9); cx.lineTo(bx - 9, by + 9); cx.stroke();
    }
    cx.restore();
  }else if(ad && ad.kind === 'lobshot' && !am.cancel){   // Explosive Shot: dotted arc + landing marker (grey X = no ground there, the shell would fall away)
    const o2 = foeOf(af), a = lobAim(af, o2, ad, am.drag ? am.ax : af.face, am.drag ? am.ay : 0, am.drag ? am.m : null), pu = .6 + .4 * Math.sin(G.t * 10);
    cx.save(); cx.strokeStyle = 'rgba(255,170,60,.9)'; cx.lineWidth = 3; cx.setLineDash([3, 8]); cx.lineCap = 'round'; cx.beginPath();
    for(let i = 0; i <= 24; i++){ const t = a.T * i / 24; const px = a.sx + a.vx * t, py = a.sy + a.vy * t + .5 * ad.grav * t * t; i ? cx.lineTo(px, py) : cx.moveTo(px, py); }
    cx.stroke(); cx.setLineDash([]);
    if(a.ground){ cx.strokeStyle = 'rgba(255,170,60,.95)'; cx.fillStyle = 'rgba(255,106,26,' + (.2 * pu) + ')'; cx.lineWidth = 2.5; cx.beginPath(); cx.ellipse(a.tx, a.ty - 2, ad.radius, ad.radius * .28, 0, 0, 7); cx.fill(); cx.stroke(); cx.beginPath(); cx.arc(a.tx, a.ty - 2, 4, 0, 7); cx.fillStyle = 'rgba(255,200,120,.95)'; cx.fill(); }
    else{ cx.strokeStyle = 'rgba(190,190,200,.8)'; cx.beginPath(); cx.moveTo(a.tx - 9, a.ty - 9); cx.lineTo(a.tx + 9, a.ty + 9); cx.moveTo(a.tx + 9, a.ty - 9); cx.lineTo(a.tx - 9, a.ty + 9); cx.stroke(); }
    cx.restore();
  }else if(ad && ad.aim && !am.cancel){   // aim preview while dragging a skill button: a dashed line the way the skill will go
    const rushK = ad.kind === 'rush', ax = am.drag ? am.ax : af.face, ay = am.drag ? am.ay : 0;
    const dx = rushK ? (Math.sign(ax) || af.face) : ax, dy = rushK ? 0 : ay, len = rushK ? ad.dist : (ad.range || ad.speed * ad.life), y0 = af.y - (rushK ? af.h / 2 : 34);
    cx.save(); cx.strokeStyle = 'rgba(255,170,60,.85)'; cx.fillStyle = 'rgba(255,170,60,.85)'; cx.lineWidth = 3; cx.setLineDash([9, 7]);
    cx.beginPath(); cx.moveTo(af.x, y0); cx.lineTo(af.x + dx * len, y0 + dy * len); cx.stroke(); cx.setLineDash([]);
    cx.beginPath(); cx.arc(af.x + dx * len, y0 + dy * len, 6, 0, 7); cx.fill(); cx.restore();
  }
  drawVerdicts(); drawIceZones(); drawErrZones(); drawIceAgeFront(); drawSkyZones(); drawStormClouds(); drawBolts();
  G.waves.forEach(q => { const k = 1 - q.life / q.max; cx.globalAlpha = (1 - k) * .85; cx.strokeStyle = q.col || '#ffb347'; cx.lineWidth = 2 + 9 * (1 - k);
    cx.beginPath(); cx.arc(q.x, q.y, q.r * k, 0, 7); cx.stroke(); cx.globalAlpha = (1 - k) * .16; cx.fillStyle = q.fill || '#ff8a2a'; cx.fill(); });   // Total Extinction shockwave
  cx.globalAlpha = 1;
  G.parts.forEach(q => { if(q.v) return; cx.globalAlpha = Math.max(0, q.life * 2.5); cx.fillStyle = q.col; cx.fillRect(q.x, q.y, 5, 5); });   // (vomit sludge q.v is drawn earlier, under the fighters)
  G.rings.forEach(q => { const k = 1 - q.life / .25; cx.globalAlpha = 1 - k; cx.strokeStyle = '#fff'; cx.lineWidth = 1 + 4 * (1 - k); cx.beginPath(); cx.arc(q.x, q.y, 10 + k * 34, 0, 7); cx.stroke(); });
  cx.textAlign = 'center'; cx.lineWidth = 4; cx.strokeStyle = '#000';
  G.pops.forEach(q => {   // damage numbers: pop big, shrink, float up, fade
    cx.globalAlpha = Math.min(1, q.life * 3); cx.font = '900 ' + Math.round(26 - 8 * Math.min(1, (.8 - q.life) / .12)) + 'px system-ui';
    cx.strokeText(q.txt, q.x, q.y); cx.fillStyle = '#ffe066'; cx.fillText(q.txt, q.x, q.y);
  });
  cx.globalAlpha = 1;
  cx.restore();

const big = (G.cfg.size || 1) > 1;
G.f.forEach(f => {
  const i = f.team === 1, w = big ? Math.min(210, view.w * .27) : Math.min(260, view.w * .34), x = i ? view.w - w - 12 : 12, y = 56 + (big ? (f.tslot || 0) * 38 : 0);
   
   if(big && f.idx !== 0) return;
   const tag = big ? (f.idx === 0 ? 'YOU ' : f.team === 0 ? 'ALLY ' : 'FOE ') : (i ? 'P2 ' : 'P1 ');
    cx.save(); if(f.dead) cx.globalAlpha = .35;
    cx.textAlign = i ? 'right' : 'left'; cx.fillStyle = '#fff'; cx.font = '700 ' + (big ? 12 : 13) + 'px system-ui';
    cx.fillText(tag + f.c.name, i ? x + w : x, y - 8);
    cx.fillStyle = 'rgba(255,255,255,.12)'; cx.fillRect(x, y, w, 10);
    const r = Math.max(0, f.fc ? f.fc.hp / f.fc.max : f.hp / f.max);   // the Final Curtain beast shows ITS 600 HP here
    f.sh = f.sh === undefined ? r : Math.max(r, approach(f.sh, r, .006));   // white chip that drains behind the bar
    cx.fillStyle = '#fff'; cx.fillRect(i ? x + w * (1 - f.sh) : x, y, w * f.sh, 10);
    cx.font = '700 ' + (big ? 13 : 15) + 'px system-ui'; cx.textAlign = i ? 'left' : 'right';     // HP percentage, opposite the name
    cx.fillText(Math.ceil(r * 100) + '%', i ? x : x + w, y - 8);
    cx.textAlign = i ? 'right' : 'left';
    cx.fillStyle = r > .5 ? '#4cd97b' : r > .25 ? '#f5c542' : '#ff4d5e';
    cx.fillRect(i ? x + w * (1 - r) : x, y, w * r, 10);
    if(f.bar > 0){ const br = Math.min(1, f.bar / f.max); cx.fillStyle = '#7fd0ff'; cx.fillRect(i ? x + w * (1 - br) : x, y + 10, w * br, 3); }   // barrier = thin blue line under the bar
    cx.fillStyle = '#fff'; cx.font = (big ? 11 : 13) + 'px system-ui';
    cx.fillText(f.dead ? 'OUT' : G.mode === 'ai' ? '\u25CF'.repeat(Math.max(0, f.stocks)) : '\u221E', i ? x + w : x, y + (big ? 22 : 28));
    cx.restore();
  });
  cx.textAlign = 'center'; cx.fillStyle = 'rgba(255,255,255,.6)'; cx.font = '12px system-ui';
  cx.fillText((big ? G.cfg.size + 'v' + G.cfg.size + '  -  ' : '') + (G.mode === 'ai' ? 'AI ' + G.cfg.difficulty.toUpperCase() : 'SPARRING (no win/loss)'), view.w / 2, 22);
}

// skill buttons: a dark clockwise sweep (--cd = fraction of the cooldown left) shows the recharge, .cd = nothing ready (big seconds in the middle),
// data-n = charges ready (corner, only for multi-charge skills), .none = this hero has no skill in that slot, .rdy = flash when it becomes ready again
function syncBtns(){
  const f = G.f[0];
  [0, 1, 2].forEach(i => {
    const b = skBtns[i], d = slotDef(f, i);
    let n = '', cd = false, frac = 0;
    if(d){
      const t = i < 2 ? f.sk[i].cd : [f.uc], ready = t.filter(c => c <= 0).length, left = t.filter(c => c > 0), tot = d.recharge || d.cd || 5;
      cd = ready === 0;
      if(left.length) frac = Math.min(1, Math.min(...left) / tot);   // the charge that comes back first
      n = cd ? Math.ceil(Math.min(...left)) : (d.charges > 1 ? ready : '');
      if(d.toggle && f.stench) n = 'ON';
      if(d.kind === 'replicate' && f.shadows.length){ n = f.shadows.length; cd = false; frac = 0; }   // shadows left (the button teleports)   // a toggle skill that is switched on
    }
    if(b.dataset.n !== String(n)) b.dataset.n = n;
    b.style.setProperty('--cd', frac.toFixed(3));
    if(b._cd && !cd && d){ b.classList.remove('rdy'); void b.offsetWidth; b.classList.add('rdy'); }   // flash: ready again
    b._cd = cd;
    b.classList.toggle('cd', cd); b.classList.toggle('none', !d);
  });
}
function loop(t){
  if(!G) return;
  raf = requestAnimationFrame(loop);
  const dt = Math.min(.033, (t - G.last) / 1000 || 0); G.last = t;
  if(!G.paused){ if(G.hs > 0) G.hs -= dt; else { G.t += dt; if(!G.over) update(dt); } }   // G.hs = hit-stop (short freeze on heavy hits)
  syncBtns(); draw();
}

$('#againBtn').onclick = () => G && startMatch(G.cfg);
$('#selBtn').onclick = () => show('select');
addEventListener('resize', () => { if(G) fit(); });

// pause
function setPause(p){
  if(!G || G.over) return;
  G.paused = p; G.last = performance.now();
  $('#pauseWrap').classList.toggle('hide', !p);
  Ctl.reset(); Ctl.on = !p;
}
$('#pauseBtn').onclick = () => setPause(true);
$('#resumeBtn').onclick = () => setPause(false);
$('#restartBtn').onclick = () => G && startMatch(G.cfg);
addEventListener('keydown', e => {
  if(!G || e.repeat) return;
  const k = e.key.toLowerCase();
  if(k === 'i' && !G.over){ toggleInfo(); return; }
  if(k === 'escape' || k === 'p'){ if(!$('#infoWrap').classList.contains('hide')){ closeInfo(); return; } setPause(!G.paused); }
});

// ---- SKILL INFO: the (i) button above the ultimate opens a side panel (overlay, not a modal). The match is frozen while it is open and continues when you close it.
//      Each row: name, type, cooldown, damage (shown for THIS opponent: same formula as a hit, ~ = rounded) and the text. Text = `desc` in the character's skills.js (optional), `type` overrides the type label.
const KIND_TYPE = {dimimpale:'Ground target - Mirror + Teleport', shatteredgravity:'Ground target - Pull zone', grandentrance:'Ground target - Stomp', nostrings:'Aimed - piercing line', wintergrasp:'Ground target - Launch + Frost', crystalcoffin:'Ground target - Immobilize', iceage:'Arena - Ultimate', shockwave:'Projectile', hook:'Projectile - pulls the enemy', rush:'Dash', quake:'Area - Ultimate', voidclaw:'Ground target - Launch', shadowstep:'Teleport - Targeted', abysshand:'Targeted - Ultimate', shadowhook:'Gap closer - Aimed hook', replicate:'Teleport - shadows', onslaught:'Targeted - Ultimate', stench:'Toggle - aura', vomit:'Held key - ground trap', sniper:'Held key - aimed shot', lobshot:'Arc projectile - area blast', slaughterhouse:'Grab - Ultimate', marks:'Passive', lightningstep:'Transform - Invulnerable dash', skyfall:'Ground target - Lightning strikes', stormofruin:'Arena - Ultimate'};
const dmgNum = (f, o, m) => Math.round((10 + f.c.hp / 40) * 2.2 * (1 - armOf(o) / 50) * m);
function infoRows(){
  const f = G.f[0], o = foeOf(f), K = f.K, rows = [], B = K.basic;
  const cdTxt = d => d.charges > 1 ? d.charges + ' charges, ' + d.recharge + 's each' : d.cd != null ? d.cd + 's' : '-';
  const dmgTxt = d => d.kind === 'finalcurtain' ? d.combo.map(c => c.fixed).join(' / ') + ' (beast, ' + d.combo.reduce((a, c) => a + c.fixed, 0) + ' total)' : d.kind === 'abysshand' ? '~' + dmgNum(f, o, d.ticks * d.tickDmg + d.crushDmg + d.slamDmg) + ' total' : d.kind === 'shadowstep' ? '-' : d.kind === 'skyfall' || d.kind === 'stormofruin' ? '~' + dmgNum(f, o, d.dmg) + ' / strike' : d.kind === 'lightningstep' ? '~' + dmgNum(f, o, d.dmg) + ' / hit' : d.tickDmg ? '~' + dmgNum(f, o, Math.floor((d.frenzy || 1.5) / (d.tick || .09)) * d.tickDmg + d.finishDmg) + ' total' : d.hits ? '~' + dmgNum(f, o, d.hits.reduce((a, h) => a + h.dmg, 0)) + ' total' : d.dps ? '~' + Math.round(o.max * d.dps) + '/s' : d.dmg ? '~' + dmgNum(f, o, d.dmg) : '-';
  rows.push({tag:'ATK', name:'Basic attack', type:B.combo ? B.combo.length + '-hit combo' : 'Basic attack', cd:'-', dmg:B.combo ? '~' + B.combo.map(c => dmgNum(f, o, c.dmg ?? B.dmg)).join(' / ') : '~' + dmgNum(f, o, B.dmg), desc:B.desc});
  if(K.passive) rows.push({tag:'PAS', name:K.passive.name, type:K.passive.type || 'Passive', cd:K.passive.cd ? K.passive.cd + 's' : '-', dmg:K.passive.dps ? '~' + Math.round(o.max * K.passive.dps) + '/s bleed' : '-', desc:K.passive.desc});
  if(B.unleash) rows.push({tag:'HOLD', name:B.unleash.name, type:'Held key - charge', cd:'-', dmg:'~' + dmgNum(f, o, B.unleash.base * 1.25) + ' - ~' + dmgNum(f, o, B.unleash.base * 2), desc:B.unleash.desc});
  if(B.burst) rows.push({tag:'HOLD', name:B.burst.name, type:'Held key - 2 charge stages', cd:'-', dmg:'~' + dmgNum(f, o, B.burst.norm.dmg) + ' - ~' + dmgNum(f, o, B.burst.full.dmg), desc:B.burst.desc});
  if(K.hold) rows.push({tag:'HOLD', name:K.hold.name, type:K.hold.type || KIND_TYPE[K.hold.kind] || 'Held key', cd:K.hold.cd != null ? K.hold.cd + 's' : '-', dmg:K.hold.shot ? '~' + dmgNum(f, o, K.hold.shot.dmg) : K.hold.dps ? '~' + Math.round(o.max * K.hold.dps) + '/s each' : '-', desc:K.hold.desc});
  K.skills.forEach((d, i) => d && d.name && rows.push({tag:i ? 'II' : 'I', name:d.name, type:d.type || KIND_TYPE[d.kind] || (d.aim ? 'Aimed skill' : 'Skill'), cd:cdTxt(d), dmg:dmgTxt(d), desc:d.desc}));
  const u = K.ultimate; if(u && u.name) rows.push({tag:'ULT', name:u.name, type:u.type || KIND_TYPE[u.kind] || 'Ultimate', cd:cdTxt(u), dmg:dmgTxt(u), desc:u.desc});
  return rows;
}
function openInfo(){
  if(!G || G.over) return;
  const list = $('#infoList'), mk = (t, c, x) => { const e = document.createElement(t); if(c) e.className = c; if(x != null) e.textContent = x; return e; };
  $('#infoName').textContent = G.f[0].c.name; list.textContent = '';
  infoRows().forEach(r => {
    const k = mk('div', 'ik'), top = mk('div', 'top'), st = mk('div', 'st2'), cd = mk('div'), dm = mk('div');
    top.append(mk('span', 'tag', r.tag), mk('span', 'nm2', r.name));
    cd.append(mk('span', '', 'CD'), r.cd); dm.append(mk('span', '', 'DMG'), r.dmg); st.append(cd, dm);
    k.append(top, mk('div', 'ty', r.type), st); if(r.desc) k.append(mk('p', 'ds', r.desc));
    list.append(k);
  });
  list.scrollTop = 0;
  if(!G.paused){ G.paused = true; G.infoPaused = true; G.last = performance.now(); Ctl.reset(); Ctl.on = false; }
  $('#infoWrap').classList.remove('hide');
}
function closeInfo(silent){
  $('#infoWrap').classList.add('hide');
  if(G && G.infoPaused){ G.infoPaused = false; G.paused = false; G.last = performance.now(); Ctl.reset(); Ctl.on = true; }
}
function toggleInfo(){ $('#infoWrap').classList.contains('hide') ? openInfo() : closeInfo(); }
$('#infoBtn').onclick = toggleInfo;
$('#infoClose').onclick = () => closeInfo();
$('#infoWrap').addEventListener('pointerdown', e => { if(e.target.id === 'infoWrap') closeInfo(); });   // tap outside the panel = close