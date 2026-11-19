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
    uc:0, pn:0, pt:0, bar:0, rush:null, skq:null, hk:null, slaughter:null, shd:null, shadows:[], onsl:null, fr:0, hLast:0, dv:0, dvKey:null, atkTok:0, tA:null, tAtk:0, vclaw:null, uhand:null, afterimg:null, slam:null, kdT:0, kdDur:0, slowVoidT:0, capturedBy:null, mk:0, bl:0, blDps:0, bt:0,                   // uc = ultimate cooldown, pn = passive hit count, pt = passive time left, bar = barrier HP, rush = charge in progress
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
  G = {cfg, mode:cfg.mode, P:makeMap(), t:0, paused:false, last:performance.now(), over:null, parts:[], pops:[], rings:[], waves:[], slaughterFx:[], puddles:[], cuts:[], shake:0,
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
  if(o.fe > 0) return false;                                     // on cooldown: a normal hit
  o.fe = P.cd; o.feKey = key; o.feT = G.t + 1;
  const ox = o.x, oy = o.y, mid = o.h / 2;
  const burst = (x, y, n) => { G.rings.push({x, y:y - mid, life:.25}); for(let i = 0; i < n; i++) G.parts.push({x:x + (Math.random() - .5) * 18, y:y - mid + (Math.random() - .5) * 30, vx:(Math.random() - .5) * 460, vy:(Math.random() - .6) * 420, life:.5, col:['#5c6bff', '#0b0c10', '#c9d0ff'][i % 3]}); };
  burst(ox, oy, 26);                                             // the illusion shatters
  G.pops.push({x:ox, y:oy - o.h - 6, txt:'ILLUSION', life:.8});
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
const KB = {x:450, y:-340, stun:.26};   // knockback tuning (horizontal speed, upward speed, stun seconds)
function hurt(o, f){
  const s0 = f.src || (f.K ? f : null);
  if(o.aegis && o.aegis.on && s0 !== o && f.face === -o.face){ blockHit(o, f); return; }   // AEGIS STANCE planted: a blow coming from the front is blocked (nothing lands: no damage, no knockback, no stun)
  if(s0 && o.K.passive && o.K.passive.kind === 'falseExistence' && falseExistence(o, s0, f)) return;   // hit an illusion: no damage, no knockback, nothing lands
  let dmg = (10 + f.c.hp / 40) * 2.2 * (1 - armOf(o) / 50) * f.A.dmg * (f.A.bleedBonus && o.bl > 0 ? f.A.bleedBonus : 1), shown = Math.round(dmg);   // bleedBonus = extra damage vs a bleeding (Wounded) enemy
  if(o.bar > 0){ const ab = Math.min(o.bar, dmg); o.bar -= ab; dmg -= ab; shown = dmg > 0 ? Math.round(dmg) : 'BLOCK'; }   // barrier soaks damage first
  o.hp -= dmg;
  if(dmg > 0 && s0 && s0 !== o && o.K.passive && o.K.passive.kind === 'retribution') retributionGain(o, s0, f.A);   // Paladin took damage: +1 Divine Charge (once per attack)
  G.pops.push({x:o.x + (Math.random() - .5) * 16, y:o.y - o.h - 6, txt:shown, life:.8});   // floating damage number
  G.rings.push({x:o.x, y:o.y - o.h / 2, life:.25}); G.shake = f.A.noShake ? 0 : .12 * (f.A.shake || 1); G.hs = f.A.noHitstop ? 0 : (f.A.hitstop || 0);                                    // hit ring + screen shake
  o.vx = f.face * KB.x * (f.A.kbx ?? 1); o.vy = KB.y * (f.A.kby ?? 1);   // fixed knockback: same power every hit
  o.stun = KB.stun * (f.A.stunx || 1); o.inv = .15; o.flash = .12; o.gr = false; o.atk = 0; o.comboT = 0; o.charging = false; o.chg = 0; o.rush = null; o.skq = null; o.hk = null; if(o.shd) endShadowHook(o);
  for(let i = 0; i < 9; i++) G.parts.push({x:o.x, y:o.y - o.h/2, vx:(Math.random()-.5)*500 + f.face*200, vy:(Math.random()-.8)*400, life:.4, col:f.c.color});
  const src = f.src || (f.K ? f : null); if(src) onLanded(src, o, f.A);   // passives react to every landed hit (see onLanded)
  if(o.hp <= 0) ko(o);
}
function ko(f){
  if(G.over || f.dead) return;
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
  f.hp = f.max; f.x = W/2; f.y = -40; f.vx = f.vy = 0; f.jumps = 2; f.inv = 1.6; f.stun = 0; f.atk = 0; f.gr = false; f.rush = null; f.bar = 0; f.pt = 0; f.pn = 0; f.hk = null; f.slaughter = null; f.capturedBy = null; f.mk = 0; f.bl = 0; f.stench = null; f.slowT = 0; f.vomit = null; f.heldT = 0; f.fe = 0; f.feKey = null; f.shd = null; f.shadows = []; f.onsl = null; f.fr = 0; f.hLast = 0; f.dv = 0; f.dvKey = null; f.vclaw = null; f.uhand = null; f.afterimg = null; f.slam = null; f.kdT = 0; f.slowVoidT = 0; f.holy = null; f.impacted = false; f.slowHolyT = 0; f.sc = null; f.aegis = null; f.arE = 0;
  if(f.dead){ f.x = -5000; f.y = -5000; f.hp = 0; f.inv = 999; f.stun = 0; }   // eliminated: parked off-screen, skipped by everything
}

function endCharge(f, o){   // ATK let go (or knocked / jumped): turn the held time into a stronger punch
  const A = f.A, L = A.cl || 0;
  f.charging = false; f.chgDone = true;
  if(L > 0){
    f.A = {...A, cl:L, dmg:A.dmg * (1 + 2.6 * L), kbx:(A.kbx ?? 1) * (1 + 2.2 * L), stunx:(A.stunx || 1) * (1 + 1.2 * L),
           shake:(A.shake || 1) + 4 * L, hitstop:(A.hitstop || 0) + .2 * L, lunge:(A.lunge || 0) * (1 + .4 * L), reach:A.reach + 8 * L};
    f.comboT = 0;   // a charged punch ends the combo
    if(A.blink && o) blink(f, o);   // skill flag blink:true = shadow step: appear right behind the enemy, then the strike comes out
  }
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
        if(o.K.passive && o.K.passive.kind === 'falseExistence' && falseExistence(o, f, {A})){ S.ph = 5; return; }   // it hooked an illusion
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
  voidclaw(f, o, d, ax, ay, m){ return !!groundAim(f, o, d, ax, ay, m); },            // there must be ground at the chosen spot
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
  if(f.atk > 0 && f.A && f.A.skill === 'quake') return;      // the ultimate wind-up cannot be cancelled by another skill
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
function shoot(f, sh){
  sh = sh || f.A.shot;
  const d = f.face, hw = f.handW, big = !!f.A.chargeShot && sh === f.A.chargeShot;
  let r = sh.r, A = f.A;
  if(big){ const cl = f.A.cl || 0; r = sh.rMin + (sh.rMax - sh.rMin) * cl;
    A = {...f.A, dmg:sh.dmg * (1 + (sh.dmgGrow || 0) * cl), kbx:sh.kbx, kby:sh.kby, stunx:sh.stunx, shake:sh.shake, hitstop:sh.hitstop};
    if(sh.slow){ A.slowAmt = sh.slow; A.slowDur = (sh.slowMin || 1) + ((sh.slowMax || 3) - (sh.slowMin || 1)) * cl; }   // slow strength / time grow with the charge
    if(sh.explode) A.expl = r * sh.explode; }
  A = {...A, hid:++HID};   // this sphere = one attack (Abyssal Hunger: one fragment, Divine Retribution: one charge)
  let x = f.x + d * 22, y = f.y - 32;
  if(hw){ const pts = sh.hand === 'B' ? [hw.N, hw.F] : [sh.hand === 'F' ? hw.F : hw.N]; x = pts.reduce((a, q) => a + q.x, 0) / pts.length; y = pts.reduce((a, q) => a + q.y, 0) / pts.length; }
  (G.sh = G.sh || []).push({id:f.c.id, c:f.c, idx:f.idx, team:f.team, A, x, y, vx:d * sh.speed, r, life:sh.life || 1.6, age:0, kind:big ? 3 : (f.A.step || 0), cl:big ? (f.A.cl || 0) : 0});
}
function updateShots(dt){
  if(!G.sh) return;
  G.sh.forEach(s => {
    s.age += dt; s.life -= dt; s.x += s.vx * dt; s.y += (s.vy || 0) * dt;
    const hr = s.r + (s.A.expl || 0) * .5;                            // an exploding orb goes off a little before it touches
    const o = G.f.find(q => q.team !== s.team && !q.dead && q.inv <= 0 && q.capturedBy == null && s.x + hr > q.x - q.w / 2 && s.x - hr < q.x + q.w / 2 && s.y + hr > q.y - q.h && s.y - hr < q.y);   // first enemy it touches
    if(o){
      s.life = 0;
      hurt(o, {c:s.c, A:s.A, face:Math.abs(s.vx) > 30 ? Math.sign(s.vx) : (Math.sign(o.x - s.x) || 1), src:G.f[s.idx]});
      if(s.A.slowDur){ o.slowAmt = o.slowT > 0 ? Math.max(o.slowAmt, s.A.slowAmt) : s.A.slowAmt; o.slowT = Math.max(o.slowT || 0, s.A.slowDur); o.slowVoidT = G.t + s.A.slowDur; }   // slow
      if(s.A.expl){ const er = s.A.expl; G.waves.push({x:s.x, y:s.y, r:er * 2.2 + 14, life:.28, max:.28, col:'#8f6bff', fill:'#3a1a8c'}); for(let i = 0; i < 8 + er * .5; i++) G.parts.push({x:s.x, y:s.y, vx:(Math.random() - .5) * 460, vy:(Math.random() - .5) * 460, life:.45, col:i % 2 ? '#8f6bff' : '#0a0614'}); }   // explosion
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
function endStench(f){   // turn the cloud off and start the cooldown
  const d = f.stench.d, i = f.K.skills.indexOf(d);
  f.stench = null; if(i >= 0) f.sk[i].cd[0] = d.cd;
}
function stenchStep(f, o, dt){   // runs every frame while his Putrid Stench cloud is out
  const S = f.stench, d = S.d, cxp = f.x, cyp = f.y - f.h / 2;
  S.age += dt;
  f.hp -= f.max * d.selfDps * dt;                                                   // the rot costs HP, and it CAN kill him
  if(f.hp <= 0){ ko(f); return; }
  if(Math.random() < dt * 45){                                                      // green fumes rising from the cloud
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
  f.slowT = (f.slowT || 0) - dt;
  if(f.sc && (f.stun > 0 || f.capturedBy != null || f.onsl || f.slaughter)) endSacredCharge(f);   // hit / caught: the charge is cancelled
  if(f.arE > 0) f.arE -= dt;                                                                              // armor debuff runs out
  if(f.holy){ f.holy.t -= dt; if(f.holy.t <= 0) f.holy = null; }                                         // Divine Impact glow runs out
  f.atkCd -= dt; f.comboT -= dt; f.aqB -= dt; f.stun -= dt; f.inv -= dt; f.drop -= dt; f.flash -= dt;
  f.sk.forEach(k => { for(let i = 0; i < k.cd.length; i++) k.cd[i] = Math.max(0, k.cd[i] - dt); });   // every charge recharges on its own
  f.uc = Math.max(0, f.uc - dt);
  if(f.pt > 0){ f.pt -= dt; if(f.pt <= 0) f.bar = 0; }                                                  // passive timer: boost + barrier end together
  const sp = f.c.spd * 52 * (f.pt > 0 ? 1 + f.K.passive.speed : 1) * (f.slowT > 0 ? 1 - f.slowAmt : 1);   // slowAmt = from the enemy's Putrid Stench
  if(f.fe > 0) f.fe -= dt;                                                                               // False Existence cooldown
  if(f.bl > 0) bleedTick(f, dt);
  if(f.stench) stenchStep(f, o, dt);
  if(f.K.hold) (f.K.hold.kind === 'aegis' ? aegisStep : vomitStep)(f, dt);
  if(f.vclaw) clawStep(f, o, dt);
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
  else if(f.sc){ sacredChargeStep(f, o, dt); }                    // Sacred Charge: no jump, no attacks, no other skills (the joystick only steers)
  else if(f.stun <= 0){
    const dir = f.in.r - f.in.l;
    const rooted = f.gr && f.atk > 0 && f.A.root;              // rooted punch: feet stay planted on the ground (no walking while swinging, so no foot sliding)
    const slowCharge = f.charging && f.A.chargeMove;               // Void Orb: he can shuffle slowly while charging (chargeMove = share of his speed)
    if(rooted && !slowCharge){ if(dir && !f.aegis) f.face = dir; f.vx = approach(f.vx, 0, (f.lunged ? 1800 : 3000) * dt); }
    else if(dir){ f.face = dir; f.vx = approach(f.vx, dir * sp * (slowCharge ? f.A.chargeMove : 1), (f.gr ? 3000 : 1600) * dt); }
    else f.vx = approach(f.vx, 0, (f.gr ? (f.atk > 0 && f.A.lunge ? 1800 : 2600) : 500) * dt);   // lunge slides (momentum) instead of stopping dead
    if(f.jq && f.jumps > 0 && !f.aegis){ f.vy = f.jumps === 2 ? -840 : -780; f.jumps--; f.gr = false; }
    if(f.dq && f.gr && !f.aegis){ f.drop = .22; f.y += 3; f.gr = false; }
    if(!f.base) f.base = f.A;                                  // basic attack numbers (combo steps are layered on top)
    if(f.aq && f.base.combo) f.aqB = .18;                     // small input buffer, only for combo characters
    if((f.aq || f.aqB > 0) && f.atkCd <= 0){
      const cb = f.base.combo;
      if(cb){ f.cs = f.comboT > 0 ? (f.cs + 1) % cb.length : 0; f.A = {...f.base, ...cb[f.cs], step:f.cs}; f.comboT = f.A.cd + .45; }else if(f.A.skill) f.A = f.base;   // next hit of the combo (after a skill: back to the basic attack numbers)
      f.atk = f.A.time; f.atkCd = f.A.cd; f.hitDone = false; f.aqB = 0;
      f.lunged = false; f.fired = 0; f.chg = 0; f.charging = false; f.chgDone = false; if(f.A.chargeP) f.A.cl = 0;
    }
    if(f.skq) castSkill(f, o, f.skq);
  }else f.vx = approach(f.vx, 0, (f.gr ? 1500 : 200) * dt);
  f.jq = f.dq = f.aq = false; f.skq = null;

  if(f.atk > 0){
    // CHARGE: a punch with chargeP freezes at its full-load pose while ATK is held; letting go releases it, stronger the longer it was held
    const fz = f.A.chargeP ? f.A.time * (1 - f.A.chargeP) : -1;
    if(fz > 0 && !f.chgDone && f.in.held && f.gr && f.atk <= fz + 1e-4 && f.atk > fz - dt * 2){
      const lo = f.A.chargeMin ?? .15, hi = f.A.chargeMax ?? 1;
      f.atk = fz; f.charging = true; f.chg += dt;
      f.A.chg = f.chg; f.A.cl = Math.max(0, Math.min(1, (f.chg - lo) / (hi - lo)));
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
    if(sh0 && !f.fired && 1 - f.atk / f.A.time >= sh0.p){ f.fired = 1; shoot(f, sh0); }   // skills.js shot:{...} = fire a projectile (see shoot below)
    if(!f.hitDone && f.atk < f.A.hitFrom && f.atk > f.A.hitTo){
      const hx = f.face > 0 ? f.x + f.w/2 : f.x - f.w/2 - f.A.reach;
      if(hx < o.x + o.w/2 && hx + f.A.reach > o.x - o.w/2 && f.y - f.h < o.y && f.y > o.y - o.h && o.inv <= 0){ hurt(o, f); f.hitDone = true; }
    }
  }

  const py = f.y;
  f.vy = (f.rush || (f.shd && f.shd.ph >= 1 && f.shd.ph <= 3)) ? 0 : Math.min(f.vy + GRAV * dt, 1200);   // a rush is a straight line (no gravity)
  f.x += f.vx * dt; f.y += f.vy * dt;
  f.gr = false;
  if(f.vy >= 0 && f.drop <= 0){
    for(const p of G.P){
      if(f.x + f.w/2 > p.x && f.x - f.w/2 < p.x + p.w && py <= p.y + 1 && f.y >= p.y){ f.y = p.y; f.vy = 0; f.gr = true; f.jumps = 2; break; }
    }
  }
  if(f.y > H + 260 || f.y < -520 || f.x < -260 || f.x > W + 260) ko(f);
}

// Character-aware bot brain. Difficulty changes reaction/aggression; skill decisions read each fighter's own skills.js data.
function think(f, o, dt){
  if(f.aiHoldT && G.t > f.aiHoldT){ f.in.held = false; f.aiHoldT = 0; }   // the bot lets go of a charged Void Orb
  f.aiT -= dt; if(f.aiT > 0) return;
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
  if(!f.aegis) f.face = dir;                                      // planted behind the shield: he keeps facing the same way

  if(f.K.hold && f.K.hold.kind === 'aegis'){   // Aegis Stance: plant it when the enemy is a bit away (the setup is slow); hold it while they are in front, let go when they are close, behind or it has been long enough
    const hd = f.K.hold, front = (o.x - f.x) * f.face > 0;
    i.held = f.aegis ? (f.aegis.t < hd.setup + 2.5 && front && ax > 55 && ax < 460) : (f.gr && ax >= 170 && ax < 460 && ay < 90 && Math.random() < .3);
  }
  if(f.K.hold && f.K.hold.kind !== 'aegis'){   // held-key attack (Vile Offering): the bot holds ATK when the enemy is a bit away, so the puddle lands near them
    const hd = f.K.hold, mine = G.puddles.filter(p => p.owner === f.idx).length;
    i.held = f.gr && ax < hd.w * .7 + hd.ranges[hd.ranges.length - 1] && ay < 80 && (mine < hd.max || Math.random() < .25) && Math.random() < .55;
  }
  // Estimate a useful fighting distance from this character's actual kit.
  const defs = [...(f.K.skills || []), f.K.ultimate].filter(Boolean);
  const ranged = defs.some(d => d.aim && d.kind !== 'shadowhook' && (d.range || d.speed * (d.life || 0)) > 150);
  const desired = f.K.basic.chargeShot ? 250 : ranged ? 145 : Math.max(48, Math.min(82, (f.K.basic.reach || 46) + 20));
  if(ax > desired + 18){ if(dx > 0) i.r = 1; else i.l = 1; }
  else if(ax < desired - 28 && ranged && Math.random() < (G.cfg.difficulty === 'Hard' ? .7 : .42)){
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
    if(!d || !SKILLS[d.kind]) continue;
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
      case 'shadowstep': {   // evade a swing / get away when low; close the gap when far
        const threat = o.atk > 0 && ax < 160, R = d.range || 300;
        if(threat || (f.hp < f.max * .3 && ax < 130)){ aimOv = {ax:-dir, ay:0, m:1}; if(stepDest(f, o, d, -dir, 0, 1)) score = threat ? 76 : 64; }
        else if(ax > 360){ aimOv = {ax:dir, ay:clampN(dy / R, -1, 1), m:1}; if(stepDest(f, o, d, aimOv.ax, aimOv.ay, 1)) score = 46; }
        break; }
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
      case 'shockwave':
        if(ax >= 82 && ax <= (range || 280) * .94 && ay < 125) score = 74;
        break;
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

  const cs = f.K.basic.chargeShot;   // VOID ORB: hold ATK to charge from a distance, let go after a random charge time (longer when far)
  if(cs && ax > 130 && ax < 520 && verticalOK && f.atk <= 0 && f.atkCd <= 0 && !f.in.held && Math.random() < (G.cfg.difficulty === 'Hard' ? .8 : .55)){
    f.aq = true; f.in.held = true; f.aiHoldT = G.t + .55 + Math.random() * .6 + (f.fr >= 5 ? .25 : 0); return;
  }
  const basicReach = (f.K.basic.reach || 46) + 18;
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
    [0, 1, 2].forEach(i => { if(Ctl.sk[i]){ a.skq = {i, ...Ctl.sk[i]}; Ctl.sk[i] = null; } });   // skill casts from the buttons / keys 1 2 3
  }else{ Ctl.jump = Ctl.drop = Ctl.atk = false; [0, 1, 2].forEach(i => Ctl.sk[i] = null); }    // you are out: your allies keep fighting
  const live = G.f.filter(f => !f.dead);
  live.forEach(f => { f.cur = foeOf(f); });                                                      // everyone picks the enemy they are fighting
  live.forEach(f => { if(f.idx !== 0 && f.cur && (G.mode === 'ai' || f.team === 0)) think(f, f.cur, dt); });   // bots: every fighter but you (sparring: only your allies, the dummies stand still)
  live.forEach(f => { if(f.cur) stepF(f, f.cur, dt); });
  stepPuddles(dt); stepVerdicts(dt);
  G.parts.forEach(q => { q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 900 * dt; });
  G.parts = G.parts.filter(q => q.life > 0);
  G.pops.forEach(q => { q.life -= dt; q.y -= 70 * dt; }); G.pops = G.pops.filter(q => q.life > 0);
  G.rings.forEach(q => q.life -= dt); G.rings = G.rings.filter(q => q.life > 0);
  G.waves.forEach(q => q.life -= dt); G.waves = G.waves.filter(q => q.life > 0);
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

function drawF(f){
  const x = f.x, y = f.y;
  cx.save();
  if(f.inv > 0 && Math.floor(G.t * 20) % 2) cx.globalAlpha = .45;
  if(f.capturedBy != null){ cx.translate(x, y - f.h / 2); cx.rotate(f.capRot ?? Math.PI); cx.translate(-x, -(y - f.h / 2)); }
  Body.draw(cx, f, G.t);   // default ragdoll body (body.js). Later: if(f.c.img) draw the sprite instead.
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
  if(f.K.passive && f.K.passive.kind === 'retribution'){   // DIVINE RETRIBUTION: golden pips over his head; READY = all lit + a pulsing golden aura
    const mx = f.K.passive.max, rdy = f.dv >= mx, pu = .5 + .5 * Math.sin(G.t * 9);
    if(rdy){ cx.strokeStyle = 'rgba(255,224,138,' + (.45 + .4 * pu) + ')'; cx.lineWidth = 2.5; cx.beginPath(); cx.ellipse(x, y - f.h / 2, 22 + pu * 3, f.h / 2 + 8 + pu * 3, 0, 0, 7); cx.stroke(); }
    for(let i = 0; i < mx; i++){
      const px = x - (mx - 1) * 5 + i * 10, py = y - f.h - 26, on = i < f.dv;
      cx.fillStyle = on ? (rdy ? '#fff3c4' : '#f5c542') : 'rgba(150,120,40,.3)'; cx.beginPath(); cx.arc(px, py, 4, 0, 7); cx.fill();
      if(on){ cx.strokeStyle = rdy ? 'rgba(255,255,255,' + (.5 + .5 * pu) + ')' : 'rgba(255,236,170,.7)'; cx.lineWidth = 1; cx.stroke(); }
    }
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
    const bw = 46, bx = f.x - bw / 2, by = f.y - f.h - 30, r = Math.max(0, Math.min(1, f.hp / f.max));
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
  }else if(ad && (ad.kind === 'voidclaw' || ad.kind === 'shadowstep') && !am.cancel){   // ground-targeted: a marker on the ground spot (grey X = no valid spot)
    const o2 = foeOf(af), ax = am.drag ? am.ax : af.face, ay = am.drag ? am.ay : 0, mg = am.drag ? am.m : null;
    const sp = ad.kind === 'voidclaw' ? groundAim(af, o2, ad, ax, ay, mg) : stepDest(af, o2, ad, ax, ay, mg);
    cx.save(); cx.lineWidth = 3;
    if(sp){
      const rx = ad.kind === 'voidclaw' ? ad.halfW : 20, pu = .6 + .4 * Math.sin(G.t * 10);
      cx.strokeStyle = 'rgba(143,107,255,.9)'; cx.fillStyle = 'rgba(58,26,140,' + (.25 * pu) + ')'; cx.setLineDash([7, 6]); cx.beginPath(); cx.moveTo(af.x, af.y - af.h / 2); cx.lineTo(sp.x, sp.y - 4); cx.stroke(); cx.setLineDash([]);
      cx.beginPath(); cx.ellipse(sp.x, sp.y - 2, rx, rx * .28, 0, 0, 7); cx.fill(); cx.stroke();
      if(ad.kind === 'voidclaw'){ cx.beginPath(); cx.moveTo(sp.x - rx, sp.y - 2); cx.lineTo(sp.x - rx, sp.y - ad.height * .35); cx.moveTo(sp.x + rx, sp.y - 2); cx.lineTo(sp.x + rx, sp.y - ad.height * .35); cx.globalAlpha = .4; cx.stroke(); }
    }else{
      const R = ad.range || 300, bx = af.x + ax * (mg == null ? .7 : Math.max(.25, mg)) * R, by = af.y - af.h / 2;
      cx.strokeStyle = 'rgba(190,190,200,.8)'; cx.beginPath(); cx.moveTo(bx - 9, by - 9); cx.lineTo(bx + 9, by + 9); cx.moveTo(bx + 9, by - 9); cx.lineTo(bx - 9, by + 9); cx.stroke();
    }
    cx.restore();
  }else if(ad && ad.aim && !am.cancel){   // aim preview while dragging a skill button: a dashed line the way the skill will go
    const rushK = ad.kind === 'rush', ax = am.drag ? am.ax : af.face, ay = am.drag ? am.ay : 0;
    const dx = rushK ? (Math.sign(ax) || af.face) : ax, dy = rushK ? 0 : ay, len = rushK ? ad.dist : (ad.range || ad.speed * ad.life), y0 = af.y - (rushK ? af.h / 2 : 34);
    cx.save(); cx.strokeStyle = 'rgba(255,170,60,.85)'; cx.fillStyle = 'rgba(255,170,60,.85)'; cx.lineWidth = 3; cx.setLineDash([9, 7]);
    cx.beginPath(); cx.moveTo(af.x, y0); cx.lineTo(af.x + dx * len, y0 + dy * len); cx.stroke(); cx.setLineDash([]);
    cx.beginPath(); cx.arc(af.x + dx * len, y0 + dy * len, 6, 0, 7); cx.fill(); cx.restore();
  }
  drawVerdicts();
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

  const big = (G.cfg.size || 1) > 1;   // team match: smaller bars stacked down each side (your team left, the other team right)
  G.f.forEach(f => {
    if(big && f.idx !== 0) return;   // team match: only your bar lives in the corner (the others float above their heads)
    const i = f.team === 1, w = big ? Math.min(210, view.w * .27) : Math.min(260, view.w * .34), x = i ? view.w - w - 12 : 12, y = 56 + (big ? (f.tslot || 0) * 38 : 0);
    const tag = big ? (f.idx === 0 ? 'YOU ' : f.team === 0 ? 'ALLY ' : 'FOE ') : (i ? 'P2 ' : 'P1 ');
    cx.save(); if(f.dead) cx.globalAlpha = .35;
    cx.textAlign = i ? 'right' : 'left'; cx.fillStyle = '#fff'; cx.font = '700 ' + (big ? 12 : 13) + 'px system-ui';
    cx.fillText(tag + f.c.name, i ? x + w : x, y - 8);
    cx.fillStyle = 'rgba(255,255,255,.12)'; cx.fillRect(x, y, w, 10);
    const r = Math.max(0, f.hp / f.max);
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
const KIND_TYPE = {shockwave:'Projectile', hook:'Projectile - pulls the enemy', rush:'Dash', quake:'Area - Ultimate', voidclaw:'Ground target - Launch', shadowstep:'Teleport - Targeted', abysshand:'Targeted - Ultimate', shadowhook:'Gap closer - Aimed hook', replicate:'Teleport - shadows', onslaught:'Targeted - Ultimate', stench:'Toggle - aura', vomit:'Held key - ground trap', slaughterhouse:'Grab - Ultimate', marks:'Passive'};
const dmgNum = (f, o, m) => Math.round((10 + f.c.hp / 40) * 2.2 * (1 - armOf(o) / 50) * m);
function infoRows(){
  const f = G.f[0], o = foeOf(f), K = f.K, rows = [], B = K.basic;
  const cdTxt = d => d.charges > 1 ? d.charges + ' charges, ' + d.recharge + 's each' : d.cd != null ? d.cd + 's' : '-';
  const dmgTxt = d => d.kind === 'abysshand' ? '~' + dmgNum(f, o, d.ticks * d.tickDmg + d.crushDmg + d.slamDmg) + ' total' : d.kind === 'shadowstep' ? '-' : d.tickDmg ? '~' + dmgNum(f, o, Math.floor((d.frenzy || 1.5) / (d.tick || .09)) * d.tickDmg + d.finishDmg) + ' total' : d.hits ? '~' + dmgNum(f, o, d.hits.reduce((a, h) => a + h.dmg, 0)) + ' total' : d.dps ? '~' + Math.round(o.max * d.dps) + '/s' : d.dmg ? '~' + dmgNum(f, o, d.dmg) : '-';
  rows.push({tag:'ATK', name:'Basic attack', type:B.combo ? B.combo.length + '-hit combo' : 'Basic attack', cd:'-', dmg:B.combo ? '~' + B.combo.map(c => dmgNum(f, o, c.dmg ?? B.dmg)).join(' / ') : '~' + dmgNum(f, o, B.dmg), desc:B.desc});
  if(K.passive) rows.push({tag:'PAS', name:K.passive.name, type:K.passive.type || 'Passive', cd:K.passive.cd ? K.passive.cd + 's' : '-', dmg:K.passive.dps ? '~' + Math.round(o.max * K.passive.dps) + '/s bleed' : '-', desc:K.passive.desc});
  if(K.hold) rows.push({tag:'HOLD', name:K.hold.name, type:K.hold.type || KIND_TYPE[K.hold.kind] || 'Held key', cd:'-', dmg:K.hold.dps ? '~' + Math.round(o.max * K.hold.dps) + '/s each' : '-', desc:K.hold.desc});
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