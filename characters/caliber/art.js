// CALIBER art - lean gunslinger sniper, same shared ragdoll (body.js): only a few sizes, colors, props and poses.
// Look: flat-brim hat, red scope lens over one eye, ammo bandolier + grenades, a sniper rifle slung on his back, TWO pistols in his hands.
// HOLD ATK = DEADEYE SNIPER (skills.js hold): he kneels, takes the rifle off his back and aims it where f.snipe.ang points (arena.js sniperStep),
//   a red laser shows the line (faint while aiming, bright + pulsing when the shot is ready), release = rifle kick + muzzle flash.
// Hooks used: body (sizes), colors, farFront, spring(), attack() = the 4 shots + the kneeling snipe pose, pose() = guns-up ready stance,
//             torso() = torso + bandolier, behind() = back rifle + far pistol, front() = hat, scope, near pistol, sniper rifle, muzzle flash, laser,
//             shot() = how the flying bullet looks (drawn by arena.js).
(() => {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const C = [.45, .45, .45, .5];                  // moment the bullet leaves the gun = shot.p in skills.js (keep the same)
  const T = 10, SH = 9.5;                         // thigh + shin length (default body)
  const OUT = '#0b0f1c';

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

  // pistol in a hand. It points along the forearm, so it follows every pose. Muzzle = tip of the barrel.
  function gun(cx, arm, white){
    const h = arm.hand, e = arm.el, ang = Math.atan2(h.y - e.y, h.x - e.x);
    cx.save(); cx.translate(h.x, h.y); cx.rotate(ang);
    cx.lineJoin = 'round'; cx.strokeStyle = OUT; cx.lineWidth = 1.6;
    cx.beginPath(); cx.moveTo(-.5, -.2); cx.lineTo(3.6, -.2); cx.lineTo(2.3, 5.4); cx.lineTo(-2.5, 5.4); cx.closePath();     // grip
    cx.stroke(); cx.fillStyle = white ? '#fff' : '#4a331d'; cx.fill();
    rr(cx, -1.6, -3.6, 13.4, 3.5, 1); cx.stroke(); cx.fillStyle = white ? '#fff' : '#9aa6ab'; cx.fill();                    // slide
    cx.fillStyle = white ? '#fff' : '#58646a'; cx.fillRect(11.4, -2.9, 2.2, 2);                                              // barrel tip
    if(!white){
      cx.fillStyle = '#e8eef0'; cx.fillRect(-.6, -3.2, 11, .8);                                                             // slide highlight
      cx.fillStyle = '#e0b04a'; cx.fillRect(4.2, -2.3, 2.6, 1.3);                                                            // brass plate
    }
    cx.restore();
  }
  function muzzle(arm){   // world-local position of the barrel tip
    const h = arm.hand, e = arm.el, a = Math.atan2(h.y - e.y, h.x - e.x);
    return {x:h.x + 13.6 * Math.cos(a) + 1.9 * Math.sin(a), y:h.y + 13.6 * Math.sin(a) - 1.9 * Math.cos(a)};
  }
  function flash(cx, m, size, k){   // muzzle flash: glow + forward star
    const a = 1 - k;
    const g = cx.createRadialGradient(m.x, m.y, 0, m.x, m.y, size * 1.5);
    g.addColorStop(0, 'rgba(255,230,150,' + (.9 * a) + ')'); g.addColorStop(1, 'rgba(255,170,60,0)');
    cx.fillStyle = g; cx.beginPath(); cx.arc(m.x, m.y, size * 1.5, 0, 7); cx.fill();
    cx.fillStyle = 'rgba(255,250,220,' + a + ')'; cx.beginPath();
    cx.moveTo(m.x, m.y - size * .35); cx.lineTo(m.x + size * 1.7, m.y); cx.lineTo(m.x, m.y + size * .35);
    cx.lineTo(m.x - size * .4, m.y); cx.closePath(); cx.fill();
    cx.beginPath(); cx.moveTo(m.x + size * .2, m.y - size * .9); cx.lineTo(m.x + size * .5, m.y); cx.lineTo(m.x + size * .2, m.y + size * .9); cx.lineTo(m.x - size * .1, m.y); cx.closePath(); cx.fill();
  }

  Characters.art('caliber', {
    // default ragdoll, only a slightly leaner torso. Hitbox is still 30x52 (arena.js is not changed per character).
    body: {torso:{len:12.5, w:10}, hand:{r:2.8}, shN:1.5, shF:-4},   // shN/shF = shoulder x offsets: far shoulder sits behind the near one (default gap is only 2px, arms looked joined)
    colors: {shirt:'#2f4a52', limb:'#3f6a73', far:'#243b42', legs:'#2a3438', legsFar:'#1d2629', head:'#d2aa84', dark:'#151b1e', hand:'#8a6a3a'},

    // the far (right) arm is drawn on top of the body while he shoots, so you can see that pistol
    farFront: f => !!f.snipe,

    // stiff while aiming (steady hands), very stiff at the shot (snap), softer after (the recoil rolls out)
    spring(p, A){
      if(A.skill === 'lobshot') return {k:420, d:28};                      // snappy lob
      if(A.skill === 'sniper') return A.snipe && A.snipe.ph === 'recover' ? {k:420, d:30} : {k:260, d:26};   // steady hands while aiming, stiff snap at the kick
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

    // torso (same capsule as the default) + ammo bandolier across the chest + two grenades on the belt
    torso(cx, S, B, P, white){
      cap(cx, S.pel, S.sh, B.torso.w, white ? '#fff' : P.shirt);
      if(white) return;
      const a = {x:S.sh.x - 4, y:S.sh.y + 1.5}, b = {x:S.pel.x + 4, y:S.pel.y - 1.5};
      cx.lineCap = 'round'; cx.strokeStyle = '#4a331d'; cx.lineWidth = 2.6; cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); cx.stroke();
      for(let i = 0; i < 5; i++){ const k = (i + .5) / 5, x = a.x + (b.x - a.x) * k, y = a.y + (b.y - a.y) * k; cx.fillStyle = '#e0b04a'; cx.fillRect(x - .9, y - 1.4, 1.8, 2.8); }
      [[-3.5, 2.5], [1.5, 3]].forEach(([dx, dy]) => {
        cx.fillStyle = '#44522a'; cx.strokeStyle = OUT; cx.lineWidth = 1; cx.beginPath(); cx.ellipse(S.pel.x + dx, S.pel.y + dy, 2.2, 2.8, 0, 0, 7); cx.fill(); cx.stroke();
        cx.fillStyle = '#9aa6ab'; cx.fillRect(S.pel.x + dx - .8, S.pel.y + dy - 3.8, 1.6, 1.4);
      });
    },

    // behind the body: sniper rifle slung on his back + the far pistol (when that arm is behind him)
    behind(cx, f, t, S, P){
      if(f.snipe) return;                                                          // the rifle is in his hands while sniping (drawn in front())
      const b0 = {x:S.pel.x - 5, y:S.pel.y + 4}, tip = {x:S.sh.x - 10, y:S.sh.y - 14};
      const dx = tip.x - b0.x, dy = tip.y - b0.y, ln = Math.hypot(dx, dy), nx = -dy / ln * 3.2, ny = dx / ln * 3.2;
      const at = k => ({x:b0.x + dx * k, y:b0.y + dy * k});
      cap(cx, b0, at(.32), 4.4, '#7a5230');                                       // stock
      cap(cx, at(.3), tip, 2.4, '#2b3236');                                       // receiver + barrel
      const s0 = at(.46), s1 = at(.74);
      cap(cx, {x:s0.x + nx, y:s0.y + ny}, {x:s1.x + nx, y:s1.y + ny}, 3.2, '#14181a');   // scope
      cx.fillStyle = '#e0b04a'; cx.beginPath(); cx.arc(s1.x + nx, s1.y + ny, 1.1, 0, 7); cx.fill();
      gun(cx, S.aF, f.flash > 0);                                // far pistol sits behind the body when he is not shooting
    },

    front(cx, f, t, S, P){
      // tell arena.js where the barrels are in the world, so the bullet leaves the real muzzle
      const mN = muzzle(S.aN), mF = muzzle(S.aF);
      const white = f.flash > 0, SN = f.snipe, A = f.A || {};
      // rifle: lies along the near arm (shoulder -> hand), so it follows the arm spring; the muzzle (f.handW.S) is where the sniper bullet leaves
      let rd = 0, rx = 0, ry = 0, rm = null;
      if(SN){
        const hN = S.aN.hand, sN = S.aN.s; rd = Math.atan2(hN.y - sN.y, hN.x - sN.x); rx = hN.x; ry = hN.y;
        rm = {x:rx + Math.cos(rd) * 27, y:ry + Math.sin(rd) * 27};
      }
      f.handW = {N:{x:f.x + f.face * mN.x, y:f.y + mN.y}, F:{x:f.x + f.face * mF.x, y:f.y + mF.y}, S:rm ? {x:f.x + f.face * rm.x, y:f.y + rm.y} : null};

      if(!SN) gun(cx, S.aN, white);
      if(A.skill === 'lobshot' && f.atk > 0){ const k = ((1 - f.atk / A.time) - .45) / .15; if(k >= 0 && k < 1) flash(cx, mN, 10, k); }   // launch flash

      // head: flat-brim hat + red scope lens (drawn in the head's own tilted space)
      const h = S.head, ang = Math.atan2(h.x - S.sh.x, -(h.y - S.sh.y));
      const p = f.atk > 0 ? clamp(1 - f.atk / A.time, 0, 1) : 0;
      const L = SN && SN.ph === 'aim' ? SN.k : 0;                   // aim progress 0..1 (arena.js sniperStep sets SN.k)
      const rdy = !!(SN && SN.ready);
      cx.save(); cx.translate(h.x, h.y); cx.rotate(ang);
      if(!white){
        cx.fillStyle = '#161c1f'; cx.strokeStyle = OUT; cx.lineWidth = 1.2;
        cx.beginPath(); cx.ellipse(2, -5, 9.6, 1.9, 0, 0, 7); cx.fill(); cx.stroke();                 // brim (reaches forward)
        rr(cx, -5.6, -10.4, 11.4, 6, 2.4); cx.fill(); cx.stroke();                                   // crown
        cx.fillStyle = '#e0b04a'; cx.fillRect(-5.2, -6.6, 10.6, 1.2);                                // brass band
        const glow = SN ? 8 + 10 * L : 5;                                                            // scope lens: brighter while sniping
        cx.shadowColor = '#ff3b3b'; cx.shadowBlur = glow;
        cx.fillStyle = 'rgba(255,60,60,' + (SN ? .6 + .4 * L : .7) + ')'; cx.beginPath(); cx.arc(3.9, -1.2, 2.3, 0, 7); cx.fill();
        cx.shadowBlur = 0; cx.strokeStyle = OUT; cx.lineWidth = 1.1; cx.stroke();
        cx.fillStyle = 'rgba(255,255,255,.8)'; cx.fillRect(3.1, -2.1, .9, .9);
      }
      cx.restore();

      if(SN){
        // ---- the sniper rifle in both hands ----
        cx.save(); cx.translate(rx, ry); cx.rotate(rd);
        cx.lineJoin = 'round'; cx.lineCap = 'round';
        const col = (c, w) => white ? '#fff' : c;
        cx.strokeStyle = OUT; cx.lineWidth = 1.4;
        cx.fillStyle = col('#7a5230'); cx.beginPath(); cx.moveTo(-24, -1.5); cx.lineTo(-24, 4.2); cx.lineTo(-8, 3); cx.lineTo(-8, -3); cx.closePath(); cx.fill(); cx.stroke();       // stock
        cx.fillStyle = col('#2b3236'); rr(cx, -9, -3.4, 22, 4.6, 1.4); cx.fill(); cx.stroke();                                                                                       // receiver
        cx.fillStyle = col('#3b444a'); rr(cx, 12, -2.4, 15, 2.6, 1); cx.fill(); cx.stroke();                                                                                         // barrel
        cx.fillStyle = col('#14181a'); rr(cx, -6, -8.6, 17, 4, 1.8); cx.fill(); cx.stroke();                                                                                        // scope
        cx.fillStyle = col('#e0b04a'); cx.fillRect(-3, -8.8, 1.4, 4.4); cx.fillRect(7, -8.8, 1.4, 4.4);                                                                              // scope rings
        if(!white){ cx.fillStyle = 'rgba(255,60,60,' + (.5 + .5 * L) + ')'; cx.shadowColor = '#ff3b3b'; cx.shadowBlur = 4 + 6 * L; cx.beginPath(); cx.arc(11.6, -6.6, 1.6, 0, 7); cx.fill(); cx.shadowBlur = 0; }   // front lens
        cx.restore();
        [S.aN.hand, S.aF.hand].forEach(q => { cx.fillStyle = OUT; cx.beginPath(); cx.arc(q.x, q.y, 3.6, 0, 7); cx.fill(); cx.fillStyle = white ? '#fff' : '#8a6a3a'; cx.beginPath(); cx.arc(q.x, q.y, 2.8, 0, 7); cx.fill(); });   // hands over the rifle

        // ---- the aim laser: faint while aiming, solid + pulsing when READY. It follows the same angle the bullet will fly (f.snipe.ang). ----
        if(SN.ph === 'aim' && rm){
          const a = -SN.ang, len = 900, pu = .5 + .5 * Math.sin(t * 24);
          const g = cx.createLinearGradient(rm.x, rm.y, rm.x + Math.cos(a) * len, rm.y + Math.sin(a) * len);
          const al = rdy ? .55 + .35 * pu : .12 + .3 * L;
          g.addColorStop(0, 'rgba(255,60,60,' + al + ')'); g.addColorStop(1, 'rgba(255,60,60,0)');
          cx.strokeStyle = g; cx.lineCap = 'butt'; cx.lineWidth = rdy ? 1.8 : .7 + .6 * L;
          cx.beginPath(); cx.moveTo(rm.x, rm.y); cx.lineTo(rm.x + Math.cos(a) * len, rm.y + Math.sin(a) * len); cx.stroke();
          if(rdy){ cx.strokeStyle = 'rgba(255,120,120,' + (.45 + .4 * pu) + ')'; cx.lineWidth = 1.2; cx.beginPath(); cx.arc(h.x + 3.9, h.y - 1.2, 5 + 1.5 * pu, 0, 7); cx.stroke(); }    // pulsing ring on the lens = LOCKED
        }
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
      }
    },

    // the flying bullet (arena.js calls this; s = {x, y, r, vx, age, kind, cl}). cl > 0 = snipe bullet.
    shot(cx, s, t){
      const d = s.vx > 0 ? 1 : -1;
      if(s.kind === 'bomb'){                                                         // EXPLOSIVE SHOT shell: spinning dark shell with a hot orange tail and a sparking fuse
        const sp = Math.hypot(s.vx, s.vy || 0) || 1, tx = s.x - s.vx / sp * 26, ty = s.y - (s.vy || 0) / sp * 26;
        const g = cx.createLinearGradient(s.x, s.y, tx, ty); g.addColorStop(0, 'rgba(255,170,60,.8)'); g.addColorStop(1, 'rgba(255,100,30,0)');
        cx.strokeStyle = g; cx.lineWidth = s.r * 1.6; cx.lineCap = 'round'; cx.beginPath(); cx.moveTo(s.x, s.y); cx.lineTo(tx, ty); cx.stroke();
        cx.save(); cx.translate(s.x, s.y); cx.rotate(s.age * 14);
        cx.shadowColor = '#ff8a2a'; cx.shadowBlur = 10; cx.fillStyle = '#2b3236'; cx.strokeStyle = '#ffb84a'; cx.lineWidth = 1.6;
        cx.beginPath(); cx.arc(0, 0, s.r, 0, 7); cx.fill(); cx.stroke(); cx.shadowBlur = 0;
        cx.fillStyle = '#ffd27a'; cx.fillRect(-1, -s.r - 3, 2, 3);
        cx.fillStyle = Math.sin(s.age * 50) > 0 ? '#fff2c4' : '#ff8a2a'; cx.beginPath(); cx.arc(0, -s.r - 3.5, 1.8, 0, 7); cx.fill();
        cx.restore();
        return;
      }
      if(s.kind === 'sniper'){                                                       // DEADEYE SNIPER bullet: a long white-hot tracer with a cyan glow, drawn along its real flight direction
        const ang = Math.atan2(s.vy || 0, s.vx), w = 2.4 + s.r * .3, tail = 230;
        cx.save(); cx.translate(s.x, s.y); cx.rotate(ang);
        const g = cx.createLinearGradient(0, 0, -tail, 0);
        g.addColorStop(0, 'rgba(190,255,245,.95)'); g.addColorStop(1, 'rgba(47,184,160,0)');
        cx.fillStyle = g; cx.beginPath(); cx.moveTo(0, -w); cx.lineTo(-tail, -w * .15); cx.lineTo(-tail, w * .15); cx.lineTo(0, w); cx.closePath(); cx.fill();
        cx.shadowColor = '#7ffff0'; cx.shadowBlur = 16; cx.fillStyle = '#fff';
        cx.beginPath(); cx.ellipse(0, 0, 13, w, 0, 0, 7); cx.fill(); cx.shadowBlur = 0;
        cx.restore();
        return;
      }
      if(s.crit){                                                                    // 5th bullet (Bullet Chamber): red-hot, bigger, longer tail, pulsing ring
        const w = s.r * .9 + 2, tail = 95, len = 15, pu = .5 + .5 * Math.sin(t * 30);
        const g = cx.createLinearGradient(s.x, s.y, s.x - d * tail, s.y);
        g.addColorStop(0, 'rgba(255,110,70,.95)'); g.addColorStop(1, 'rgba(255,40,20,0)');
        cx.fillStyle = g; cx.beginPath(); cx.moveTo(s.x, s.y - w); cx.lineTo(s.x - d * tail, s.y); cx.lineTo(s.x, s.y + w); cx.closePath(); cx.fill();
        cx.shadowColor = '#ff3b2a'; cx.shadowBlur = 16 + 6 * pu; cx.fillStyle = '#fff0e0';
        cx.beginPath(); cx.ellipse(s.x, s.y, len * .6, w, 0, 0, 7); cx.fill();
        cx.strokeStyle = 'rgba(255,80,60,' + (.55 + .3 * pu) + ')'; cx.lineWidth = 1.5; cx.beginPath(); cx.ellipse(s.x, s.y, len * .6 + 5, w + 4, 0, 0, 7); cx.stroke(); cx.shadowBlur = 0;
        return;
      }
      const heavy = s.kind === 3, r = s.r * .6, len = heavy ? 13 : 9, tail = heavy ? 60 : 38;   // normal pistol round (kind 3 = both pistols, heavier)
      const g = cx.createLinearGradient(s.x, s.y, s.x - d * tail, s.y);
      g.addColorStop(0, heavy ? 'rgba(255,170,70,.75)' : 'rgba(255,215,120,.7)'); g.addColorStop(1, 'rgba(255,190,80,0)');
      cx.fillStyle = g; cx.beginPath(); cx.moveTo(s.x, s.y - r); cx.lineTo(s.x - d * tail, s.y); cx.lineTo(s.x, s.y + r); cx.closePath(); cx.fill();
      cx.shadowColor = '#ffb84a'; cx.shadowBlur = heavy ? 12 : 8; cx.fillStyle = heavy ? '#ffd9a0' : '#fff2c4';
      cx.beginPath(); cx.ellipse(s.x, s.y, len * .5, r, 0, 0, 7); cx.fill(); cx.shadowBlur = 0;
    }
  });
})(); 