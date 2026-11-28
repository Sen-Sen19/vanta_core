// CALIBER art - THE HOODED MARKSMAN. Same shared ragdoll (body.js), same combo / skill poses, springs and timings; only the LOOK changed.
// Look: layered forest-green assassin hood (deep shadow, two amber eyes, a retractable sniper MONOCULAR that only deploys during Deadeye), tall lean tactical LONGCOAT with split tails,
//       light tactical reinforcement (shoulder yoke, elbow patches, bracers), TWO futuristic pistols (holstered on the hips when not in his hands), a heavy RAIL SNIPER slung across his back, one compact explosive.
// HOLD ATK = DEADEYE SNIPER (skills.js hold): he kneels, the rifle travels from his back into his hands (one drawing, blended, so nothing duplicates or pops), aimed where f.snipe.ang points (arena.js sniperStep),
//   an amber laser shows the line (faint while aiming, bright + pulsing when READY), release = rifle kick + muzzle flash, then the monocular retracts.
// Hooks used: body (sizes), colors, farFront, spring(), attack() = the 4 shots + the kneeling snipe pose (UNCHANGED), pose() = guns-up ready stance (UNCHANGED),
//             torso() = longcoat + front tail + belt, holsters, bomb, sling, behind() = coat tail + rifle on the back + far pistol, front() = arm gear, near pistol, HOOD + monocular, rifle in hands, muzzle flash, laser,
//             shot() = how the flying bullet looks (drawn by arena.js).
// World-space tracking for arena.js is UNCHANGED: f.handW.N / .F = the pistol barrel tips, f.handW.S = the rifle muzzle (hand + 27 px along shoulder -> hand).
// Coat tails: no extra physics. f.coat only low-passes numbers the game already has (vx, vy, lean) so the tails lag and swing; f.coat.op does the same for the monocular deploy.
(() => {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const C = [.45, .45, .45, .5];                  // moment the bullet leaves the gun = shot.p in skills.js (keep the same)
  const T = 10, SH = 9.5;                         // thigh + shin length (default body)
  const OUT = '#0b0f1c', HS = .8;                 // HS = hood scale (the hood is drawn in the head's own space)
  // palette: dark + restrained. Amber is the one accent (eyes, weapon energy, optics, tracers).
  const GREEN = '#24432f', GREEN_L = '#33603f', GREEN_D = '#18301f', CHAR = '#1e2327', CHAR_D = '#12161a', GUN = '#4b545b', GUN_L = '#6d777e',
        BRASS = '#b8933f', AMBER = '#f2b13a', AMBER_L = '#ffd77a', GW = '#fff3cc';
  let CUR = null, NOWT = 0;                        // set by behind() (it always runs first): torso() has no access to the fighter

  // knee angle that puts the ankle at height Y for thigh angle th, so BOTH feet stay on the same ground height (no floating foot)
  const legK = (th, Y) => { const a = Math.acos(clamp((Y - T * Math.cos(th)) / SH, -1, 1)); const k = th - a; return k > .05 ? k : th + a; };

  // ---- BASIC ATTACK: every shot = raise the pistol (fast), FIRE (arm kicks up from the recoil), lower again. p = 0..1 over the swing. ----
  // hands: 'N' near pistol, 'F' far pistol, 'B' both. crouch = how low he sits. The arm NOT shooting just guards.
  function shotPose(c, hands, crouch){
    const n = hands !== 'F', f = hands !== 'N', kick = hands === 'B' ? 2.25 : 1.95, a0 = c - .2;
    const fire = (rest, er) => [[0, rest], [a0, 1.5], [c, 1.52], [c + .08, kick], [c + .3, 1.35], [1, rest]];
    const bend = (rest) => [[0, rest], [a0, .08], [c, .05], [c + .08, .3], [1, rest]];
    return {
      aN: n ? fire(.5) : [[0, .5], [a0, .15], [1, .5]],   eN: n ? bend(.95) : [[0, .95], [a0, 1.3], [1, .95]],
      aF: f ? fire(.3) : [[0, .3], [a0, .1], [1, .3]],    eF: f ? bend(1.1) : [[0, 1.1], [a0, 1.35], [1, 1.1]],
      lean: [[0, .08], [a0, .14 + crouch * .06], [c, .14 + crouch * .06], [c + .08, hands === 'B' ? -.14 : -.05], [c + .3, .05], [1, .08]],
      head: [[0, 0], [c, -.05], [c + .1, .1], [1, 0]],
      tN: [[0, .26], [a0, .4], [1, .26]], tF: [[0, -.2], [a0, -.35 - crouch * .08], [1, -.2]],
      Y: [[0, 19.2], [a0, 18.2 - crouch * 1.6], [c + .15, 18.6 - crouch * 1.2], [1, 19.2]]
    };
  }
  const STEP = [shotPose(C[0], 'N', 0), shotPose(C[1], 'F', 0), shotPose(C[2], 'N', 1), shotPose(C[3], 'B', 1)];

  // ---- DEADEYE SNIPER pose: kneel on one knee, rifle shouldered, aimed at S.ang (elevation, + = up). S = f.snipe, shared by reference through A.snipe. ----
  // Arm angles: 0 = hanging down, PI/2 = level forward, bigger = up (same as body.js). The front arm holds the rifle out straight, the back arm is solved with a small 2-bone IK so its hand lands on the rifle grip.
  const KNEEL = {tN:1.45, kN:1.45, tF:.05, kF:1.55};     // front thigh level + shin straight down, back knee on the ground with the shin lying back. Pelvis drops by itself (body.js: lowest foot on the ground)
  const SH_DX = 5.5, ARM_R = 17.9, GRIP = 9;             // far shoulder sits SH_DX behind the near one (shN 1.5 - shF -4); the near hand is ARM_R from its shoulder; the back hand sits GRIP behind it on the rifle
  const ease = t => t * t * (3 - 2 * t);
  function snipePose(tg, S){
    const k = ease(S.kn), th = S.ang;                           // S.kn = kneel progress 0..1 (arena.js sniperStep)
    const kick = S.ph === 'recover' ? Math.pow(1 - S.rt, 2) : 0;                               // rifle kick after the shot
    const a = th + kick * .45, ca = Math.cos(a), sa = Math.sin(a);
    const vx = SH_DX + (ARM_R - GRIP) * ca, vy = -(ARM_R - GRIP) * sa, dd = Math.min(17.9, Math.hypot(vx, vy)), psi = Math.atan2(vx, vy), be = Math.acos(clamp(dd / 18, 0, 1));
    const aimN = {aN:1.5708 + a - .06, eN:.12, aF:psi - be, eF:2 * be, lean:.1 + .08 * k + kick * -.2, head:-.05 - a * .25 + kick * .1,
                  tN:KNEEL.tN, kN:KNEEL.kN, tF:KNEEL.tF, kF:KNEEL.kF};
    for(const j in aimN) tg[j] = tg[j] + (aimN[j] - tg[j]) * k;
  }

  // ---- small drawing helpers (local space: origin = feet, x = forward, y = down) ----
  function cap(cx, a, b, w, col){
    cx.lineCap = 'round'; cx.strokeStyle = OUT; cx.lineWidth = w + 2.2; cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); cx.stroke();
    cx.strokeStyle = col; cx.lineWidth = w; cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); cx.stroke();
  }
  function rr(cx, x, y, w, h, r){ cx.beginPath(); if(cx.roundRect) cx.roundRect(x, y, w, h, r); else cx.rect(x, y, w, h); }
  const lp = (a, b, k) => ({x:a.x + (b.x - a.x) * k, y:a.y + (b.y - a.y) * k});
  // filled + outlined rounded part (white = hit flash)
  function part(cx, x, y, w, h, r, col, white, lw){ rr(cx, x, y, w, h, r); cx.fillStyle = white ? '#fff' : col; cx.fill(); cx.lineWidth = lw || 1; cx.strokeStyle = OUT; cx.stroke(); }

  // ---- COAT STATE: low-pass of numbers the game already has. a1 = front tail swing, a2 = rear tail swing (angle from straight down, + = forward), op = monocular deploy 0..1 ----
  function coatState(f, t, S){
    const c = f.coat || (f.coat = {a1:0, a2:0, op:0, t, l:S.lean, run:0, fall:0, kn:0});
    const dt = clamp(t - c.t, 0, .05); c.t = t;
    const SN = f.snipe;
    if(dt > 0){
      const run = clamp((f.vx || 0) * f.face / 240, -1, 1), fall = clamp((f.vy || 0) / 900, -.3, 1), kn = SN ? ease(clamp(SN.kn, 0, 1)) : 0;
      const dl = clamp((S.lean - c.l) / dt, -8, 8); c.l = S.lean;                                   // how fast the torso snaps (recoil, landing) kicks the tails
      const t1 = -run * .7 - S.lean * .3 - dl * .05 + Math.sin(t * 2.1) * .03 * (1 - Math.abs(run));
      const t2 = -run * .85 - S.lean * .3 - dl * .07 - .08 - kn * .9 + Math.sin(t * 1.7 + 1) * .035;
      c.a1 += (t1 - c.a1) * Math.min(1, dt * 9); c.a2 += (t2 - c.a2) * Math.min(1, dt * 6.5);
      c.run = run; c.fall = fall; c.kn = kn;
      const opT = SN && SN.ph === 'aim' && SN.kn > .55 ? 1 : 0;                                      // monocular: only while aiming; retracts the moment the shot is away
      c.op += (opT - c.op) * Math.min(1, dt * 12);
    }
    return c;
  }
  // one cloth tail: tapered strip hanging from `root`, swings with th, wavy, flares when falling. ph = wave phase.
  function tail(cx, root, th, len, w0, w1, col, lin, t, ph, white){
    const N = 6, pts = [{x:root.x, y:root.y, w:w0}], c = CUR && CUR.coat || {}, wave = Math.abs(c.run || 0) * 2.2 + 1;
    let x = root.x, y = root.y;
    for(let i = 1; i <= N; i++){ const s = i / N, a = th * (1 - .4 * s) + Math.sin(t * 7 + ph + s * 3.2) * .045 * s * wave; x += Math.sin(a) * len / N; y += Math.cos(a) * len / N; pts.push({x, y, w:w0 + (w1 - w0) * s}); }
    const L = [], R = [];
    pts.forEach((p, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(N, i + 1)], tx = b.x - a.x, ty = b.y - a.y, l = Math.hypot(tx, ty) || 1, nx = -ty / l, ny = tx / l; L.push({x:p.x + nx * p.w / 2, y:p.y + ny * p.w / 2}); R.push({x:p.x - nx * p.w / 2, y:p.y - ny * p.w / 2}); });
    cx.beginPath(); cx.moveTo(L[0].x, L[0].y); L.forEach(p => cx.lineTo(p.x, p.y)); for(let i = N; i >= 0; i--) cx.lineTo(R[i].x, R[i].y); cx.closePath();
    cx.fillStyle = white ? '#fff' : col; cx.fill(); cx.lineWidth = 1.2; cx.strokeStyle = OUT; cx.lineJoin = 'round'; cx.stroke();
    if(white) return;
    cx.strokeStyle = lin; cx.lineWidth = 1.3; cx.beginPath(); cx.moveTo(L[1].x, L[1].y); for(let i = 2; i <= N; i++) cx.lineTo(L[i].x, L[i].y); cx.stroke();       // charcoal lining shows along the slit
    cx.strokeStyle = GREEN_L; cx.lineWidth = .7; cx.beginPath(); cx.moveTo(R[1].x, R[1].y); for(let i = 2; i <= N; i++) cx.lineTo(R[i].x, R[i].y); cx.stroke();      // lit edge
    cx.strokeStyle = CHAR_D; cx.lineWidth = 1.2; cx.beginPath(); cx.moveTo(L[N].x, L[N].y); cx.lineTo(R[N].x, R[N].y); cx.stroke();                                // hem
  }

  // ---- PISTOL: compact futuristic mercenary sidearm. Points along the forearm, so it follows every pose. Muzzle = tip of the barrel (13.6 forward, 1.9 up, same as before). ----
  function gun(cx, arm, white){
    const h = arm.hand, e = arm.el, ang = Math.atan2(h.y - e.y, h.x - e.x);
    cx.save(); cx.translate(h.x, h.y); cx.rotate(ang); cx.lineJoin = 'round';
    cx.lineWidth = 1.4; cx.strokeStyle = OUT;
    cx.beginPath(); cx.moveTo(-.5, -.2); cx.lineTo(3.6, -.2); cx.lineTo(2.4, 5.6); cx.lineTo(-2.6, 5.6); cx.closePath(); cx.fillStyle = white ? '#fff' : CHAR; cx.fill(); cx.stroke();    // grip
    rr(cx, -1.8, -.2, 10.6, 1.9, .8); cx.fillStyle = white ? '#fff' : GUN; cx.fill(); cx.stroke();                                                                                         // frame + dust cover
    cx.beginPath(); cx.moveTo(3, 1.7); cx.lineTo(3, 3.3); cx.lineTo(5.4, 3.3); cx.lineTo(5.6, 1.7); cx.strokeStyle = OUT; cx.lineWidth = 1; cx.stroke();                                // trigger guard
    cx.beginPath(); cx.moveTo(-1.8, -3.9); cx.lineTo(10.4, -3.9); cx.lineTo(11.6, -2.7); cx.lineTo(11.6, -.1); cx.lineTo(-1.8, -.1); cx.closePath();
    cx.lineWidth = 1.4; cx.strokeStyle = OUT; cx.stroke(); cx.fillStyle = white ? '#fff' : CHAR_D; cx.fill();                                                                               // slide
    rr(cx, 10.6, -3.3, 3.2, 2.8, .8); cx.fillStyle = white ? '#fff' : GUN_L; cx.fill(); cx.lineWidth = 1; cx.stroke();                                                                      // muzzle / compensator (tip at x 13.8, y -1.9)
    if(!white){
      cx.fillStyle = GREEN; cx.fillRect(1.2, -3.3, 6.4, 1.2); cx.fillStyle = GREEN_L; cx.fillRect(1.2, -3.3, 6.4, .4);                                                                      // forest-green slide panel
      cx.fillStyle = OUT; for(let i = 0; i < 3; i++) cx.fillRect(-1 + i * 1.1, -3.4, .5, 3);                                                                                                // rear serrations
      cx.fillStyle = AMBER; cx.fillRect(4, -1.9, 3.6, .8); cx.fillStyle = AMBER_L; cx.fillRect(4.4, -1.9, 1.6, .35);                                                                         // small amber energy cell
      cx.fillStyle = BRASS; cx.fillRect(-.6, 1.8, 1.6, .9); cx.fillRect(.4, 4.2, 1.5, .8);                                                                                                  // brass trim
      cx.fillStyle = GREEN; cx.fillRect(.2, 1.4, 1.6, 2.4);                                                                                                                                 // grip panel
    }
    cx.restore();
  }
  function muzzle(arm){   // world-local position of the barrel tip
    const h = arm.hand, e = arm.el, a = Math.atan2(h.y - e.y, h.x - e.x);
    return {x:h.x + 13.6 * Math.cos(a) + 1.9 * Math.sin(a), y:h.y + 13.6 * Math.sin(a) - 1.9 * Math.cos(a)};
  }
  function flash(cx, m, size, k){   // muzzle flash: golden-white core, amber glow, forward star
    const a = 1 - k;
    const g = cx.createRadialGradient(m.x, m.y, 0, m.x, m.y, size * 1.5);
    g.addColorStop(0, 'rgba(255,243,204,' + (.9 * a) + ')'); g.addColorStop(1, 'rgba(242,177,58,0)');
    cx.fillStyle = g; cx.beginPath(); cx.arc(m.x, m.y, size * 1.5, 0, 7); cx.fill();
    cx.fillStyle = 'rgba(255,250,225,' + a + ')'; cx.beginPath();
    cx.moveTo(m.x, m.y - size * .35); cx.lineTo(m.x + size * 1.7, m.y); cx.lineTo(m.x, m.y + size * .35);
    cx.lineTo(m.x - size * .4, m.y); cx.closePath(); cx.fill();
    cx.beginPath(); cx.moveTo(m.x + size * .2, m.y - size * .9); cx.lineTo(m.x + size * .5, m.y); cx.lineTo(m.x + size * .2, m.y + size * .9); cx.lineTo(m.x - size * .1, m.y); cx.closePath(); cx.fill();
  }

  // ---- HEAVY RAIL SNIPER. Local space: origin = near hand, x = barrel direction, -y = up (scope side). Muzzle tip at x = 27 (arena.js f.handW.S uses hand + 27). ----
  function rifle(cx, white, t, L, rdy){
    cx.lineJoin = 'round'; cx.lineCap = 'round'; cx.lineWidth = 1.1; cx.strokeStyle = OUT;
    const col = c => white ? '#fff' : c;
    cx.beginPath(); cx.moveTo(-24, -1.8); cx.lineTo(-24, 5.6); cx.lineTo(-15, 4.8); cx.lineTo(-8, 3.4); cx.lineTo(-8, -2.8); cx.lineTo(-17, -3.1); cx.closePath(); cx.fillStyle = col(CHAR); cx.fill(); cx.stroke();   // stock
    part(cx, -25.4, -2.4, 1.8, 8, .6, CHAR_D, white);                                                                                                                                                    // recoil pad
    part(cx, -18, -5, 8, 2.2, 1, GUN, white);                                                                                                                                                            // cheek riser
    if(!white){ cx.fillStyle = GREEN; cx.beginPath(); cx.moveTo(-22, -.4); cx.lineTo(-12, -.9); cx.lineTo(-11, 2.4); cx.lineTo(-22, 3.4); cx.closePath(); cx.fill(); cx.fillStyle = GREEN_L; cx.fillRect(-22, -.4, 10, .5); }   // green stock panel
    part(cx, -9, -4, 22.5, 6, 1.4, CHAR, white, 1.2);                                                                                                                                                    // reinforced receiver
    part(cx, -8, -5.1, 20, 1.4, .6, GUN, white);                                                                                                                                                         // top rail
    part(cx, -2, 1.9, 5, 4.2, 1, GUN, white);                                                                                                                                                            // magazine
    cx.beginPath(); cx.moveTo(-2.4, 2); cx.lineTo(3, 2); cx.lineTo(1.8, 7.4); cx.lineTo(-3, 7.4); cx.closePath(); cx.fillStyle = col(CHAR_D); cx.fill(); cx.stroke();                                      // pistol grip
    part(cx, 13.4, -3.6, 8, 4.6, 1, GUN, white);                                                                                                                                                         // rail shroud
    part(cx, 20.4, -2.9, 6.8, 3.6, 1.3, CHAR, white, 1.1);                                                                                                                                               // suppressor-style barrel assembly (tip = x 27)
    cx.lineWidth = 1; cx.beginPath(); cx.moveTo(15.2, 1); cx.lineTo(19.5, 3); cx.moveTo(15.2, 1); cx.lineTo(17.5, 3.4); cx.strokeStyle = OUT; cx.stroke();                                              // folded bipod
    part(cx, -9.4, -11, 2.8, 3.6, 1, GUN, white);                                                                                                                                                        // eyepiece
    part(cx, -7, -10.6, 18.4, 4.4, 2, CHAR_D, white, 1.2);                                                                                                                                               // scope tube
    part(cx, 9.6, -11.2, 3.6, 5.8, 1.2, GUN, white);                                                                                                                                                     // objective bell
    part(cx, -4.4, -6.2, 2, 1.8, .5, GUN, white); part(cx, 6, -6.2, 2, 1.8, .5, GUN, white);                                                                                                              // scope mounts
    if(!white){
      cx.fillStyle = GREEN; cx.fillRect(-5, -2.8, 9, 2.6); cx.fillStyle = GREEN_L; cx.fillRect(-5, -2.8, 9, .5);                                                                                          // green receiver panel
      cx.fillStyle = BRASS; cx.fillRect(-4.6, -10.9, 1.5, 5.4); cx.fillRect(6.6, -10.9, 1.5, 5.4); cx.fillRect(13.6 + 0, -3.6, .9, 4.6); cx.fillRect(16.4, -3.6, .9, 4.6); cx.fillRect(19.2, -3.6, .9, 4.6);   // brass scope rings + rail coils
      cx.beginPath(); cx.arc(10.2, -1.6, 1.3, 0, 7); cx.fill(); cx.fillStyle = BRASS; cx.fillRect(1, -12.3, 2.2, 1.7);                                                                                   // bolt knob + elevation turret
      cx.fillStyle = GREEN; cx.fillRect(21.4, -2.9, 1.8, 3.6);                                                                                                                                            // green band on the suppressor
      cx.fillStyle = OUT; cx.fillRect(23.8, -2.8, .6, 3.4); cx.fillRect(25.4, -2.8, .6, 3.4);                                                                                                             // baffle slits
      const pu = rdy ? .6 + .4 * Math.sin(t * 24) : 0, al = .55 + .25 * L + .3 * pu;
      cx.fillStyle = 'rgba(242,177,58,' + al + ')'; cx.fillRect(14.2, -2.4, 6.2, 1); cx.fillRect(-7, -.4, 8, .8);                                                                                         // amber energy rail
      cx.fillStyle = 'rgba(255,243,204,' + (al * .8) + ')'; cx.fillRect(15, -2.4, 3.4, .4);
      cx.fillStyle = 'rgba(242,177,58,' + (.5 + .5 * L) + ')'; cx.beginPath(); cx.ellipse(12.2, -8.4, .8, 2, 0, 0, 7); cx.fill();                                                                          // front lens
      cx.fillStyle = AMBER; cx.fillRect(.2, 3, 1.3, 1.2);                                                                                                                                                 // magazine window
    }
  }
  // rifle placement: on his back (stock low, muzzle up behind the shoulder) or in his hands. Blended so the transfer is one continuous motion.
  function rifleBack(S){
    const b0 = {x:S.pel.x + 1, y:S.pel.y + 5}, tip = {x:S.sh.x - 15, y:S.sh.y - 10}, dx = tip.x - b0.x, dy = tip.y - b0.y, ln = Math.hypot(dx, dy), sc = ln / 51, a = Math.atan2(dy, dx);
    return {x:b0.x + Math.cos(a) * 24 * sc, y:b0.y + Math.sin(a) * 24 * sc, a, s:sc};
  }
  function rifleHand(S){ const h = S.aN.hand, s = S.aN.s; return {x:h.x, y:h.y, a:Math.atan2(h.y - s.y, h.x - s.x), s:1}; }
  function drawRifle(cx, X, white, t, L, rdy){ cx.save(); cx.translate(X.x, X.y); cx.rotate(X.a); cx.scale(X.s, X.s); rifle(cx, white, t, L, rdy); cx.restore(); }

  // ---- ARM GEAR: coat-sleeve reinforcement. Light gunmetal elbow patch + bracer with a tiny amber LED. ----
  function armGear(cx, arm, white, far){
    if(white) return;
    const e = arm.el, h = arm.hand, s = arm.s, a = Math.atan2(h.y - e.y, h.x - e.x);
    cx.save(); cx.translate(e.x, e.y); cx.rotate(a); rr(cx, -2.6, -2.6, 5.2, 5.2, 1.4); cx.fillStyle = far ? CHAR : GUN; cx.fill(); cx.lineWidth = .9; cx.strokeStyle = OUT; cx.stroke();
    cx.fillStyle = BRASS; cx.fillRect(-.5, -.5, 1, 1); cx.restore();                                                                                    // elbow patch
    const b0 = lp(e, h, .5), b1 = lp(e, h, .86); cap(cx, b0, b1, 4.6, far ? CHAR_D : CHAR);                                                              // bracer
    const m = lp(b0, b1, .5); cx.fillStyle = AMBER; cx.fillRect(m.x - .7, m.y - .7, 1.4, 1.4);
  }

  // ---- RETRACTABLE MONOCULAR: brass hinge bracket on the hood brim, gunmetal arm swings down, tube slides over the front eye. Drawn AFTER the rifle so the stock never hides it. Hidden while retracted (op = 0). ----
  function monocular(cx, h, ang, op, L, rdy, t){
    cx.save(); cx.translate(h.x, h.y); cx.rotate(ang); cx.scale(HS, HS); cx.lineJoin = 'round'; cx.lineCap = 'round';
    cx.fillStyle = BRASS; cx.fillRect(2.9, -7.5, 2.2, 1.7); cx.strokeStyle = OUT; cx.lineWidth = .7; cx.strokeRect(2.9, -7.5, 2.2, 1.7);                                                   // bracket stays on the hood (a small brass block)
    if(op > .02){
      const px = lerp(3.8, 8.6, op), py = lerp(-6.3, -1.5, op), len = 4.8 * op;
      cx.strokeStyle = OUT; cx.lineWidth = 2.6; cx.beginPath(); cx.moveTo(4, -6.2); cx.lineTo(px - 1, py - .4); cx.stroke();
      cx.strokeStyle = GUN; cx.lineWidth = 1.5; cx.beginPath(); cx.moveTo(4, -6.2); cx.lineTo(px - 1, py - .4); cx.stroke();                                                               // swing arm
      part(cx, px - 1.2, py - 2.4, len + 1.6, 4.8, 1.8, CHAR_D, false, 1.1);                                                                                                            // tube
      cx.fillStyle = BRASS; cx.fillRect(px - .4, py - 2.5, 1, 5); cx.fillRect(px + len - .4, py - 2.5, 1, 5);                                                                           // brass rings
      const gx = px + len + .6, pu = rdy ? .5 + .5 * Math.sin(t * 24) : 0, al = (.55 + .3 * L + .3 * pu) * op;
      cx.fillStyle = 'rgba(242,177,58,' + al + ')'; cx.beginPath(); cx.ellipse(gx, py, .9, 2.2, 0, 0, 7); cx.fill();                                                                      // golden amber glass
      cx.strokeStyle = 'rgba(255,243,204,' + (al * .9) + ')'; cx.lineWidth = .5; cx.beginPath(); cx.moveTo(gx - .1, py - 1.7); cx.lineTo(gx - .1, py + 1.7); cx.moveTo(gx - .8, py); cx.lineTo(gx + .8, py); cx.stroke();   // reticle
      cx.fillStyle = 'rgba(242,177,58,' + (.8 * op) + ')'; cx.fillRect(px + .6, py - 2.2, 1, .6);                                                                                         // status LED
    }
    cx.restore();
  }

  Characters.art('caliber', {
    // taller + leaner: longer torso, narrow waist, small head under the hood. Limb LENGTHS are unchanged (legs / snipe IK use them), hitbox stays 30x52 (arena.js is not changed per character).
    body: {torso:{len:15.5, w:9.5}, head:{r:5.4}, hand:{r:2.6}, uArm:{len:9, w:4.4}, fArm:{len:9, w:4}, thigh:{len:10, w:5.4}, shin:{len:9.5, w:4.6}, belt:3.4, shN:1.5, shF:-4},   // shN/shF = shoulder x offsets: far shoulder sits behind the near one
    colors: {shirt:GREEN, limb:'#2b4d39', far:'#1c3626', legs:'#23292d', legsFar:'#161b1e', head:'#0c1012', dark:CHAR_D, hand:'#15191c'},

    // the far (right) arm is drawn on top of the body while he snipes, so you can see it on the rifle
    farFront: f => !!f.snipe,

    // stiff while aiming (steady hands), very stiff at the shot (snap), softer after (the recoil rolls out)
    spring(p, A){
      if(A.skill === 'lobshot') return {k:420, d:28};                      // snappy lob
      if(A.skill === 'sniper') return A.snipe && A.snipe.ph === 'recover' ? {k:420, d:30} : {k:260, d:26};   // steady hands while aiming, stiff snap at the kick
      if(A.skill === 'recoilescape') return {k:300, d:22};                 // Recoil Escape: loose in the air
      if(A.skill === 'bulletrain') return {k:380, d:26};                   // Bullet Rain: stiff arms-up cast
      const c = C[A.step || 0];
      if(p < c - .12) return {k:240, d:24};
      if(p < c + .1) return {k:460, d:30};
      return {k:180, d:19};
    },

    attack(tg, p, A, K){
      if(A.skill === 'sniper' && A.snipe){ snipePose(tg, A.snipe); return; }   // HOLD ATK: kneeling sniper pose
      if(A.skill === 'lobshot'){                                                  // EXPLOSIVE SHOT: near arm raises along the launch angle, kicks at release (p .45 = windup / cast in skills.js), lowers
        const up = 1.5708 + (A.lobAng || .8);
        tg.aN = K(p, [[0, .5], [.25, up], [.45, up], [.52, up + .45], [1, .5]]); tg.eN = K(p, [[0, .95], [.25, .1], [.45, .1], [.52, .3], [1, .95]]);
        tg.lean = K(p, [[0, .08], [.4, .16], [.52, -.08], [1, .08]]); tg.head = K(p, [[0, 0], [.4, -.08], [1, 0]]);
        return;
      }
      if(A.skill === 'recoilescape'){   // RECOIL ESCAPE: wind-up (p 0..~.22), hop backward in the air (body rotated, arms thrust backward behind him), land
        const wind = .22;
        if(p < wind){                                                              // wind-up: lean back, arms pull in
          const k = p / wind;
          tg.aN = .5 + k * .4; tg.eN = .95 - k * .3; tg.aF = .3 + k * .4; tg.eF = 1.1 - k * .3;
          tg.lean = .08 - k * .28; tg.head = k * .18;
        } else if(p < .85){                                                        // airborne: both pistols thrust backward, body tilted
          const k = (p - wind) / (.85 - wind), shoot = Math.sin(k * Math.PI);
          tg.aN = -.45 - shoot * .2; tg.eN = .15; tg.aF = -.65; tg.eF = .12;
          tg.lean = -.32 + k * .08; tg.head = .22; tg.tN = .25; tg.tF = -.25; tg.kN = .4; tg.kF = .4;
        } else {                                                                    // landing: straighten up
          const k = (p - .85) / .15;
          tg.aN = -.45 + k * .95; tg.eN = .15 + k * .8; tg.aF = -.65 + k * .95; tg.eF = .12 + k * .98;
          tg.lean = -.32 + k * .4; tg.head = .22 - k * .22;
        }
        return;
      }
      if(A.skill === 'bulletrain'){   // BULLET RAIN: arms thrust upward, he fires a burst into the sky
        if(p < .4){
          const k = p / .4; tg.aN = .5 + k * 1.9; tg.eN = .95 - k * .7; tg.aF = .3 + k * 1.5; tg.eF = 1.1 - k * .7;
          tg.lean = .08 - k * .18; tg.head = -k * .18;
        } else if(p < .8){
          const k = (p - .4) / .4, kick = Math.sin(k * Math.PI * 3) * .2;
          tg.aN = 2.4 + kick; tg.eN = .25; tg.aF = 1.8 + kick * .7; tg.eF = .4;
          tg.lean = -.1; tg.head = -.18;
        } else {
          const k = (p - .8) / .2; tg.aN = 2.4 - k * 1.9; tg.eN = .25 + k * .7; tg.aF = 1.8 - k * 1.5; tg.eF = .4 + k * .7;
          tg.lean = -.1 + k * .18; tg.head = -.18 + k * .18;
        }
        return;
      }
      const s = STEP[A.step || 0];
      ['aN', 'eN', 'aF', 'eF', 'lean', 'head', 'tN', 'tF'].forEach(j => tg[j] = K(p, s[j]));
      const Y = Math.min(K(p, s.Y), .97 * (T + SH) * Math.min(Math.cos(tg.tN), Math.cos(tg.tF)));
      tg.kN = legK(tg.tN, Y); tg.kF = legK(tg.tF, Y);
    },

    // ready stance: both pistols held forward and a little low, they bob while he runs
    pose(tg, f, t, run, K){
      const bob = Math.sin(t * 2.2) * .03 * (1 - run), r = Math.sin(t * 12) * run * .06;
      tg.aN = .5 + bob - run * .1 + r;  tg.eN = .95 - run * .05;
      tg.aF = .3 - bob - run * .05 - r; tg.eF = 1.1;
    },

    // LONGCOAT torso: structured shoulders, fitted waist, flared skirt, charcoal placket with brass buttons, sling, belt, two hip holsters, one compact bomb. The front coat tail hangs from here.
    torso(cx, S, B, P, white){
      const f = CUR, L = B.torso.len, t = NOWT, c = (f && f.coat) || {a1:0, a2:0, fall:0, run:0, kn:0}, stowed = !!(f && f.snipe);
      // front tail (behind the near leg + arm, in front of the far leg): angle lags via f.coat
      const fl = 1 - Math.max(0, c.fall) * .3 - c.kn * .25, spread = .08 + Math.max(0, c.fall) * .5;
      tail(cx, {x:S.pel.x + 2.2, y:S.pel.y - 1.5}, c.a1 + .06 + spread * .5, 14 * fl, 5.4, 8, white ? '#fff' : GREEN, CHAR_D, t, 0, white);
      cx.save(); cx.translate(S.pel.x, S.pel.y); cx.rotate(S.lean); cx.lineJoin = 'round';
      const coat = () => { cx.beginPath(); cx.moveTo(-5.4, -L + .6); cx.quadraticCurveTo(0, -L - 3.6, 5.2, -L + .6); cx.lineTo(5.6, -L + 5); cx.lineTo(3.9, -4.5); cx.lineTo(4.8, .6); cx.lineTo(5.4, 4.6); cx.lineTo(-5.6, 4.6); cx.lineTo(-4.9, .6); cx.lineTo(-4.1, -4.5); cx.lineTo(-5.8, -L + 5); cx.closePath(); };
      coat(); cx.fillStyle = OUT; cx.fill(); cx.lineWidth = 2.2; cx.strokeStyle = OUT; cx.stroke();
      coat(); cx.fillStyle = white ? '#fff' : GREEN; cx.fill();
      if(!white){
        cx.save(); coat(); cx.clip();
        const g = cx.createLinearGradient(-6, 0, 6, 0); g.addColorStop(0, 'rgba(0,0,0,.28)'); g.addColorStop(.55, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(120,190,140,.16)');
        cx.fillStyle = g; cx.fillRect(-7, -L - 4, 14, L + 10);
        cx.fillStyle = CHAR; cx.fillRect(2.4, -L, 1.7, L + 6);                                                                   // charcoal placket
        cx.fillStyle = BRASS; for(let i = 0; i < 3; i++) cx.fillRect(2.7, -L + 3 + i * 4.2, 1.1, 1.1);                             // brass buttons
        cx.strokeStyle = GUN; cx.lineWidth = 1.7; cx.lineCap = 'round'; cx.beginPath(); cx.moveTo(-3.6, -L + .4); cx.lineTo(3.4, -4.6); cx.stroke();   // sling / harness strap, shoulder -> opposite hip
        cx.strokeStyle = OUT; cx.lineWidth = .5; cx.beginPath(); cx.moveTo(-3.6, -L + .4); cx.lineTo(3.4, -4.6); cx.stroke();
        part(cx, -5.4, -L - .8, 10.4, 2.3, 1, GREEN_L, false, .8);                                                                // structured shoulder yoke
        cx.fillStyle = BRASS; cx.fillRect(-1, -L - .3, 1.2, 1.2);
        cx.fillStyle = GREEN_D; cx.fillRect(-5.6, -3.6, 11.2, 1);                                                                 // waist seam
        cx.restore();
        part(cx, -5, -2.6, 10, 3.2, 1, CHAR, false, 1);                                                                           // belt
        cx.fillStyle = BRASS; cx.fillRect(1.6, -2.1, 2.2, 2.2); cx.fillStyle = CHAR_D; cx.fillRect(2.1, -1.6, 1.2, 1.2);
        // holsters: far-side one peeks out behind, near-side one in front. A pistol butt sits in each while his hands hold the rifle.
        [[-5.2, .6, -.12, CHAR_D], [2.2, .6, .08, CHAR]].forEach(([hx, hy, ha, hc], i) => {
          cx.save(); cx.translate(hx, hy); cx.rotate(ha);
          part(cx, -.4, 0, 3.6, 6.6, 1.2, hc, false, 1); cx.fillStyle = GREEN; cx.fillRect(-.4, 0, 3.6, 1); cx.fillStyle = BRASS; cx.fillRect(1.1, 5, 1, .9);
          if(stowed){ part(cx, .4, -2.8, 2, 3.4, .8, GUN, false, .9); cx.fillStyle = AMBER; cx.fillRect(.9, -2.2, 1, .8); }
          cx.restore();
        });
        cx.save(); cx.translate(-5.4, 2.4); part(cx, -1.8, 0, 3.6, 4.6, 1.2, CHAR, false, .9); cx.fillStyle = GREEN; cx.fillRect(-1.8, 1.6, 3.6, 1); cx.fillStyle = AMBER; cx.beginPath(); cx.arc(0, 3.4, .8, 0, 7); cx.fill(); cx.restore();   // the compact explosive on his back hip
      }
      cx.restore();
    },

    // behind the body: rear coat tail, the rifle on his back (hidden while he snipes: front() draws the same rifle), the far pistol
    behind(cx, f, t, S, P){
      CUR = f; NOWT = t;
      const c = coatState(f, t, S), white = f.flash > 0, SN = f.snipe;
      const fl = 1 - Math.max(0, c.fall) * .3 - c.kn * .3, spread = .1 + Math.max(0, c.fall) * .55;
      tail(cx, {x:S.pel.x - 2.6, y:S.pel.y - 1.5}, c.a2 - spread * .5, 17 * fl, 5.6, 9, white ? '#fff' : GREEN_D, CHAR_D, t, 1.7, white);
      if(SN) return;                                                               // the rifle is in his hands while sniping (drawn in front())
      drawRifle(cx, rifleBack(S), white, t, 0, false);
      gun(cx, S.aF, white);                                // far pistol sits behind the body when he is not shooting
    },

    front(cx, f, t, S, P){
      // tell arena.js where the barrels are in the world, so the bullet leaves the real muzzle
      const mN = muzzle(S.aN), mF = muzzle(S.aF);
      const white = f.flash > 0, SN = f.snipe, A = f.A || {}, co = f.coat || {op:0};
      // rifle: lies along the near arm (shoulder -> hand), so it follows the arm spring; the muzzle (f.handW.S) is where the sniper bullet leaves
      let rd = 0, rx = 0, ry = 0, rm = null;
      if(SN){
        const hN = S.aN.hand, sN = S.aN.s; rd = Math.atan2(hN.y - sN.y, hN.x - sN.x); rx = hN.x; ry = hN.y;
        rm = {x:rx + Math.cos(rd) * 27, y:ry + Math.sin(rd) * 27};
      }
      f.handW = {N:{x:f.x + f.face * mN.x, y:f.y + mN.y}, F:{x:f.x + f.face * mF.x, y:f.y + mF.y}, S:rm ? {x:f.x + f.face * rm.x, y:f.y + rm.y} : null};

      armGear(cx, S.aN, white, false); if(SN) armGear(cx, S.aF, white, true);
      if(!SN) gun(cx, S.aN, white);
      if(A.skill === 'lobshot' && f.atk > 0){ const k = ((1 - f.atk / A.time) - .45) / .15; if(k >= 0 && k < 1) flash(cx, mN, 10, k); }   // launch flash

      // ---- HOOD (replaces the hat): drawn in the head's own tilted space ----
      const h = S.head, ang = Math.atan2(h.x - S.sh.x, -(h.y - S.sh.y));
      const p = f.atk > 0 ? clamp(1 - f.atk / A.time, 0, 1) : 0;
      const L = SN && SN.ph === 'aim' ? SN.k : 0;                   // aim progress 0..1 (arena.js sniperStep sets SN.k)
      const rdy = !!(SN && SN.ready), op = ease(clamp(co.op, 0, 1));
      cx.save(); cx.translate(h.x, h.y); cx.rotate(ang); cx.scale(HS, HS); cx.lineJoin = 'round'; cx.lineCap = 'round';
      const shell = () => { cx.beginPath(); cx.moveTo(10.8, -3.8); cx.bezierCurveTo(9, -9.4, 2, -11.8, -3.4, -10.8); cx.bezierCurveTo(-10, -9.6, -11.8, -1.6, -10, 4); cx.bezierCurveTo(-8.4, 8.6, -2, 9.4, 2.6, 8.8); cx.bezierCurveTo(5.8, 8.2, 7.2, 5.4, 6.8, 2.4); cx.bezierCurveTo(6.4, -.4, 9.6, -1.6, 10.8, -3.8); cx.closePath(); };
      // cowl: cloth drape over the shoulders / upper coat
      cx.beginPath(); cx.moveTo(-9.6, -1); cx.lineTo(-11.6, 6); cx.lineTo(-8.4, 12.2); cx.lineTo(-.6, 13.6); cx.lineTo(6.2, 11); cx.lineTo(4.4, 5); cx.lineTo(-1, 3); cx.closePath();
      cx.fillStyle = OUT; cx.fill(); cx.lineWidth = 2.2; cx.strokeStyle = OUT; cx.stroke(); cx.fillStyle = white ? '#fff' : GREEN_D; cx.fill();
      if(!white){ cx.strokeStyle = GREEN; cx.lineWidth = .8; cx.beginPath(); cx.moveTo(-8, 8); cx.lineTo(-.4, 11.6); cx.lineTo(4, 9); cx.stroke(); }
      // hood shell
      shell(); cx.fillStyle = OUT; cx.fill(); cx.lineWidth = 2.2; cx.strokeStyle = OUT; cx.stroke();
      shell(); if(white) cx.fillStyle = '#fff'; else { const g = cx.createLinearGradient(-8, -10, 8, 8); g.addColorStop(0, GREEN_L); g.addColorStop(.55, GREEN); g.addColorStop(1, GREEN_D); cx.fillStyle = g; } cx.fill();
      if(!white){
        cx.strokeStyle = GREEN_D; cx.lineWidth = .8; cx.beginPath(); cx.moveTo(-3.4, -10.6); cx.bezierCurveTo(-6, -4, -6.6, 1, -4.6, 7); cx.stroke();          // fabric seam
        // deep shadowed opening (charcoal liner, then black), big and forward-projecting
        const open = () => { cx.beginPath(); cx.moveTo(10.2, -3.6); cx.bezierCurveTo(7.4, -6.6, 2.8, -6.8, .4, -3.4); cx.bezierCurveTo(-.8, -.8, -.2, 3.6, 2.8, 6.2); cx.bezierCurveTo(5, 7.4, 6.8, 5.2, 6.8, 2.4); cx.bezierCurveTo(6.6, -.2, 9, -1.8, 10.2, -3.6); cx.closePath(); };
        open(); cx.fillStyle = CHAR; cx.fill(); cx.strokeStyle = CHAR_D; cx.lineWidth = 1.2; cx.stroke();
        cx.save(); open(); cx.clip(); const sg = cx.createLinearGradient(0, -7, 0, 7); sg.addColorStop(0, '#05070a'); sg.addColorStop(.6, '#0a0d10'); sg.addColorStop(1, '#14191c'); cx.fillStyle = sg; cx.fillRect(-2, -8, 14, 16); cx.restore();
        cx.strokeStyle = GREEN_L; cx.lineWidth = .7; cx.beginPath(); cx.moveTo(10.8, -4); cx.bezierCurveTo(7.6, -7.2, 2.6, -7.4, 0, -3.8); cx.stroke();                                        // lit hood edge
        // the only visible face detail: two natural golden amber eyes (they narrow while aiming)
        const ey = SN ? .62 : 1, bl = (Math.sin(t * .9) > .985) ? .2 : 1;
        [[4.5, -1.4], [8, -1.5]].forEach(([ex, eyy], i) => {
          cx.fillStyle = '#e9a92f'; cx.beginPath(); cx.ellipse(ex, eyy, 1.25, 1.05 * ey * bl, 0, 0, 7); cx.fill();
          cx.fillStyle = AMBER_L; cx.beginPath(); cx.ellipse(ex + .1, eyy - .15 * ey, .7, .5 * ey * bl, 0, 0, 7); cx.fill();
          cx.fillStyle = '#2a1a05'; cx.fillRect(ex + .35, eyy - .6 * ey * bl, .5, 1.2 * ey * bl);                                                                                              // pupil
        });
      }
      cx.restore();
      if(!SN) monocular(cx, h, ang, op, L, rdy, t);

      if(SN){
        // ---- the heavy rail sniper in both hands. It travels from his back (rifleBack) to his hands as he kneels, and back again after the shot, so it is drawn only once at any moment. ----
        const e = SN.ph === 'recover' ? 1 - ease(clamp((SN.rt - .6) / .4, 0, 1)) : ease(clamp(SN.kn, 0, 1)), XB = rifleBack(S), XH = {x:rx, y:ry, a:rd, s:1};
        drawRifle(cx, {x:lerp(XB.x, XH.x, e), y:lerp(XB.y, XH.y, e), a:lerp(XB.a, XH.a, e), s:lerp(XB.s, XH.s, e)}, white, t, L, rdy);
        if(e > .5) [S.aN.hand, S.aF.hand].forEach(q => { cx.fillStyle = OUT; cx.beginPath(); cx.arc(q.x, q.y, 3.4, 0, 7); cx.fill(); cx.fillStyle = white ? '#fff' : '#15191c'; cx.beginPath(); cx.arc(q.x, q.y, 2.6, 0, 7); cx.fill(); });   // gloved hands over the rifle

        // ---- the aim laser: faint while aiming, solid + pulsing when READY. It follows the same angle the bullet will fly (f.snipe.ang). Amber to match the optics. ----
        if(SN.ph === 'aim' && rm){
          const a = -SN.ang, len = 900, pu = .5 + .5 * Math.sin(t * 24);
          const g = cx.createLinearGradient(rm.x, rm.y, rm.x + Math.cos(a) * len, rm.y + Math.sin(a) * len);
          const al = rdy ? .55 + .35 * pu : .12 + .3 * L;
          g.addColorStop(0, 'rgba(255,196,70,' + al + ')'); g.addColorStop(1, 'rgba(255,196,70,0)');
          cx.strokeStyle = g; cx.lineCap = 'butt'; cx.lineWidth = rdy ? 1.8 : .7 + .6 * L;
          cx.beginPath(); cx.moveTo(rm.x, rm.y); cx.lineTo(rm.x + Math.cos(a) * len, rm.y + Math.sin(a) * len); cx.stroke();
          if(rdy){                                                                   // pulsing ring on the monocular glass = LOCKED
            const gl = {x:h.x + (Math.cos(ang) * 9.8 + Math.sin(ang) * 1.5) * HS, y:h.y + (Math.sin(ang) * 9.8 - Math.cos(ang) * 1.5) * HS};
            cx.strokeStyle = 'rgba(255,230,160,' + (.45 + .4 * pu) + ')'; cx.lineWidth = 1.2; cx.beginPath(); cx.arc(gl.x, gl.y, 5 + 1.5 * pu, 0, 7); cx.stroke();
          }
        }
        monocular(cx, h, ang, op, L, rdy, t);                                        // on top of the rifle: the optic is part of the hood
        // muzzle flash + smoke right after the shot
        if(SN.ph === 'recover' && rm && SN.rt < .3) flash(cx, rm, 15, SN.rt / .3);
      }

      // pistol muzzle flash right after the bullet leaves
      if(!SN && f.atk > 0 && A.time){
        const st = A.step || 0, c = C[st], k = (p - c) / .12;
        if(k >= 0 && k < 1){
          const both = st === 3, big = st === 3 ? 8 : 6;
          if(both || st !== 1) flash(cx, mN, big, k);
          if(both || st === 1) flash(cx, mF, big, k);
        }
        // BULLET RAIN: flash on both pistols during the burst phase (p .4..0.8)
        if(A.skill === 'bulletrain' && p >= .4 && p < .8){
          const bk = ((p - .4) / .4 * 3) % 1;
          if(bk < .2){ flash(cx, mN, 9, bk / .2); flash(cx, mF, 9, bk / .2); }
        }
        // RECOIL ESCAPE: flash on near pistol as each burst bullet fires (approximated)
        if(A.skill === 'recoilescape' && p >= .2 && p < .86){
          const bk = ((p - .2) / .66 * 4) % 1;
          if(bk < .15) flash(cx, mN, 6, bk / .15);
        }
      }
    },

    // the flying bullet (arena.js calls this; s = {x, y, r, vx, age, kind, cl}). cl > 0 = snipe bullet.
    shot(cx, s, t){
      const d = s.vx > 0 ? 1 : -1;
      if(s.kind === 'bomb'){                                                         // EXPLOSIVE SHOT shell: spinning charcoal shell, green band, golden amber energy core + amber tail
        const sp = Math.hypot(s.vx, s.vy || 0) || 1, tx = s.x - s.vx / sp * 26, ty = s.y - (s.vy || 0) / sp * 26;
        const g = cx.createLinearGradient(s.x, s.y, tx, ty); g.addColorStop(0, 'rgba(242,177,58,.8)'); g.addColorStop(1, 'rgba(242,177,58,0)');
        cx.strokeStyle = g; cx.lineWidth = s.r * 1.6; cx.lineCap = 'round'; cx.beginPath(); cx.moveTo(s.x, s.y); cx.lineTo(tx, ty); cx.stroke();
        cx.save(); cx.translate(s.x, s.y); cx.rotate(s.age * 14);
        cx.fillStyle = CHAR; cx.strokeStyle = BRASS; cx.lineWidth = 1.6; cx.beginPath(); cx.arc(0, 0, s.r, 0, 7); cx.fill(); cx.stroke();                        // reinforced charcoal shell
        cx.fillStyle = GREEN; cx.fillRect(-s.r, -1.1, s.r * 2, 2.2);                                                                                         // forest-green marking band
        cx.fillStyle = AMBER; cx.beginPath(); cx.arc(0, 0, s.r * .42, 0, 7); cx.fill();                                                                      // amber energy core
        cx.fillStyle = Math.sin(s.age * 40) > 0 ? GW : AMBER_L; cx.beginPath(); cx.arc(0, 0, s.r * .2, 0, 7); cx.fill();
        cx.fillStyle = BRASS; cx.fillRect(-1, -s.r - 3, 2, 3);
        cx.fillStyle = Math.sin(s.age * 50) > 0 ? GW : AMBER; cx.beginPath(); cx.arc(0, -s.r - 3.5, 1.7, 0, 7); cx.fill();
        cx.restore();
        return;
      }
      if(s.kind === 'sniper'){                                                       // DEADEYE SNIPER bullet: a long golden-white energy tracer, drawn along its real flight direction
        const ang = Math.atan2(s.vy || 0, s.vx), w = 2.4 + s.r * .3, tail = 230;
        cx.save(); cx.translate(s.x, s.y); cx.rotate(ang);
        const g = cx.createLinearGradient(0, 0, -tail, 0);
        g.addColorStop(0, 'rgba(255,243,204,.95)'); g.addColorStop(.35, 'rgba(255,205,100,.5)'); g.addColorStop(1, 'rgba(242,177,58,0)');
        cx.fillStyle = g; cx.beginPath(); cx.moveTo(0, -w); cx.lineTo(-tail, -w * .15); cx.lineTo(-tail, w * .15); cx.lineTo(0, w); cx.closePath(); cx.fill();
        cx.shadowColor = '#ffd77a'; cx.shadowBlur = 16; cx.fillStyle = '#fffaf0';
        cx.beginPath(); cx.ellipse(0, 0, 13, w, 0, 0, 7); cx.fill(); cx.shadowBlur = 0;
        cx.restore();
        return;
      }
      if(s.crit){                                                                    // 5th bullet (Bullet Chamber): red-hot, bigger, longer tail, pulsing ring (unchanged: the passive says it is red)
        const w = s.r * .9 + 2, tail = 95, len = 15, pu = .5 + .5 * Math.sin(t * 30);
        const g = cx.createLinearGradient(s.x, s.y, s.x - d * tail, s.y);
        g.addColorStop(0, 'rgba(255,110,70,.95)'); g.addColorStop(1, 'rgba(255,40,20,0)');
        cx.fillStyle = g; cx.beginPath(); cx.moveTo(s.x, s.y - w); cx.lineTo(s.x - d * tail, s.y); cx.lineTo(s.x, s.y + w); cx.closePath(); cx.fill();
        cx.shadowColor = '#ff3b2a'; cx.shadowBlur = 16 + 6 * pu; cx.fillStyle = '#fff0e0';
        cx.beginPath(); cx.ellipse(s.x, s.y, len * .6, w, 0, 0, 7); cx.fill();
        cx.strokeStyle = 'rgba(255,80,60,' + (.55 + .3 * pu) + ')'; cx.lineWidth = 1.5; cx.beginPath(); cx.ellipse(s.x, s.y, len * .6 + 5, w + 4, 0, 0, 7); cx.stroke(); cx.shadowBlur = 0;
        return;
      }
      const heavy = s.kind === 3, r = s.r * .6, len = heavy ? 13 : 9, tail = heavy ? 60 : 38;   // normal pistol round (kind 3 = both pistols, heavier): golden amber tracer
      const g = cx.createLinearGradient(s.x, s.y, s.x - d * tail, s.y);
      g.addColorStop(0, heavy ? 'rgba(255,196,80,.85)' : 'rgba(242,177,58,.75)'); g.addColorStop(1, 'rgba(242,177,58,0)');
      cx.fillStyle = g; cx.beginPath(); cx.moveTo(s.x, s.y - r); cx.lineTo(s.x - d * tail, s.y); cx.lineTo(s.x, s.y + r); cx.closePath(); cx.fill();
      cx.shadowColor = '#f2b13a'; cx.shadowBlur = heavy ? 12 : 8; cx.fillStyle = heavy ? '#ffe9b0' : GW;
      cx.beginPath(); cx.ellipse(s.x, s.y, len * .5, r, 0, 0, 7); cx.fill(); cx.shadowBlur = 0;
    }
  });
})();so 