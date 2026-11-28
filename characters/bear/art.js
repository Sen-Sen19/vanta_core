// BEAR#012123 art - "The Backpack Bear" (tribute to the bear from Super Bear Adventure).
// Same shared ragdoll (body.js): same skeleton, springs, hitbox (30x52), hurt / air / attack poses. Nothing in body.js, arena.js or main.js is changed.
// Only the LOOK is custom: short chubby body, big rounded-square head, small round ears, tan muzzle + belly, SHICKA (yellow bird) strapped to his back (no backpack).
//
// DOUBLE JUMP = FRONT FLIP: the 2nd (air) jump is detected from an upward velocity kick while already airborne (and not hurt / attacking). The body is drawn tucked and
// rotated forward one full turn (FLIP_D s) around its middle. Visual only: position, physics and hitbox are never touched. A normal (first) jump stays the shared jump.
//
// SKILL II (Super Jump & Shicka Toss): while it runs, Shicka is off the backpack (f.shGone = thrown / on cooldown, f.shk.sh = in his hand). attack() poses the whole skill from f.shk (via A.shk), front() draws Shicka in his hand + the aim line, shot() draws the flying Shicka.
// Hooks used: draw() = wraps the normal ragdoll (front flip only), body (sizes), colors, pose() = idle / walk / run / landing squash / flip tuck, torso() = chubby body + belly + strap,
//             behind() = Shicka, front() = square head, ears, face, landing dust.
//
// SHICKA IS PURELY DECORATIVE: it is drawn in the torso's own space (translate to the pelvis, rotate by the torso lean) on its own (no backpack),
// so it moves and rotates with the upper body in every animation. No hitbox, no physics, no state, no animation of its own.
//
// Layer order (back to front): behind(): Shicka  ->  body.js: far arm, far leg, torso()  ->  near leg, near arm  ->  front(): head (+ near arm again if it is raised over the head)
// Drawing space for behind / front: origin = feet, x = forward (auto-flipped), y = down.
(() => {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;

  // ---------- PALETTE (matches the reference sheet) ----------
  const OUT = '#2a140a';                                     // dark brown outline
  const FUR = '#a65a2e', FUR_D = '#84451f', FUR_L = '#c2723f', FEET = '#7a3f1d';
  const TAN = '#e2ad72', TAN_D = '#c98f54';
  const BLUE = '#4a8fd8', BLUE_D = '#2f68ae', BLUE_L = '#6fb0f2';
  const YEL = '#ffd21f', YEL_D = '#e3a800', BEAK = '#ff9a0a', BLK = '#0a0a0a';

  // ---------- SIZES (visual only) ----------
  const T = 7, SH = 6.5;                                     // thigh + shin length (short legs)
  const HW = 10.6, HH = 9.4;                                  // half width / half height of the square head
  const TORSO_L = 8, TORSO_W = 16;                          // chubby torso
  const STAND_Y = 13.2;
  const FLIP_D = .52;                                        // front flip length in seconds (a double jump stays in the air about .68 s)
  const FIST_R = 9;                                          // radius of the big fist at full punch (normal hand = 3.4)
  const FLIP_KICK = 300;                                     // upward speed gained in one frame (px/s) that counts as a jump while already in the air                                      // ankle height (below the hip) when standing

  // knee angle that puts the ankle at height Y for thigh angle th, so BOTH feet stay on the same ground height
  const legK = (th, Y) => { const a = Math.acos(clamp((Y - T * Math.cos(th)) / SH, -1, 1)); const k = th - a; return k > .05 ? k : th + a; };

  // ---------- LANDING STATE (kept on the fighter, drawing only) ----------
  // air -> ground is detected from f.gr. amp = how hard the fall was (0.35..1), landT = when it happened.
  const state = f => f.fxState || (f.fxState = {air:false, pvy:0, landT:-9, amp:0, tt:-1, flipT:-9});
  function track(f, t){
    const s = state(f);
    if(s.tt === t) return s;                                 // one update per frame
    s.tt = t;
    if(!f.gr){
      if(s.air && !(f.stun > 0) && !(t - (f.bncT ?? -9) < .2) && f.vy < -FLIP_KICK && f.vy < s.pvy - FLIP_KICK) s.flipT = t;   // (a bounce after a landing shockwave is not a double jump)      // jumped again in the air = double jump
      s.air = true; s.pvy = f.vy;
    }
    else if(s.air){ s.air = false; s.landT = t; s.amp = clamp(s.pvy / 520, .35, 1); s.flipT = -9; }
    return s;
  }
  // squash value: > 0 = squashed (just landed), < 0 = stretched (rebound, or flying up / falling fast), 0 = normal
  function squash(f, t){
    const s = state(f);
    if(f.tuck || f.belly) return 0;
    if(!f.gr) return -clamp(Math.abs(f.vy) / 700, 0, 1) * .6;
    const tau = t - s.landT;
    if(tau < 0 || tau > .6) return 0;
    return s.amp * Math.exp(-7 * tau) * Math.cos(15 * tau);  // dip, small bounce back up, settle
  }

  // ---------- SMALL DRAWING HELPERS ----------
  function rrPath(cx, x, y, w, h, r){
    r = Math.min(r, w / 2, h / 2);
    cx.beginPath(); cx.moveTo(x + r, y); cx.lineTo(x + w - r, y); cx.arcTo(x + w, y, x + w, y + r, r);
    cx.lineTo(x + w, y + h - r); cx.arcTo(x + w, y + h, x + w - r, y + h, r); cx.lineTo(x + r, y + h); cx.arcTo(x, y + h, x, y + h - r, r);
    cx.lineTo(x, y + r); cx.arcTo(x, y, x + r, y, r); cx.closePath();
  }
  function box(cx, x, y, w, h, r, fill, lw){                 // filled rounded rect with outline (lw = 0: no outline)
    rrPath(cx, x, y, w, h, r);
    cx.fillStyle = fill; cx.fill();
    if(lw){ cx.lineJoin = 'round'; cx.lineWidth = lw; cx.strokeStyle = OUT; cx.stroke(); }
  }
  function disc(cx, x, y, r, fill, lw){
    cx.beginPath(); cx.arc(x, y, r, 0, 7); cx.fillStyle = fill; cx.fill();
    if(lw){ cx.lineWidth = lw; cx.strokeStyle = OUT; cx.stroke(); }
  }
  function cap(cx, a, b, w, fill, ow){                       // outlined round limb
    Body.capsule(cx, a, b, w + ow * 2, OUT); Body.capsule(cx, a, b, w, fill);
  }

  // ---------- SHICKA: small yellow blocky creature in SIDE VIEW (+x = forward). Shared by backpack + held/flying poses. ----------
  function drawShicka(cx, white, strapped){
    const Y = white ? '#fff' : YEL, YD = white ? '#fff' : YEL_D;
    // far leg + far ear + far arm (behind)
    box(cx, -.6, 4.8, 2.3, 3.2, 1.0, YD, 1.1);
    box(cx, .4, -10.3, 2.6, 2.9, 1.0, YD, 1.1);
    box(cx, 1.0, .1, 2.8, 2.0, .9, YD, 1.1);
    // narrow body + blue belly on the front (+x) side
    box(cx, -2.9, -.8, 5.8, 6.4, 1.8, Y, 1.3);
    if(!white) box(cx, .1, -.2, 2.6, 4.8, 1.0, BLUE, 0);
    // near leg
    box(cx, -2.2, 5.0, 2.4, 3.2, 1.0, Y, 1.2);
    // blue backpack strap across the waist when strapped to Bear's back
    if(strapped) box(cx, -3.3, 1.6, 6.6, 2.0, .7, white ? '#fff' : BLUE, 1);
    // near arm
    box(cx, -1.2, .3, 3.0, 2.1, 1.0, Y, 1.2);
    // boxy head + near ear
    box(cx, -3.8, -8.2, 7.6, 7.6, 2.1, Y, 1.4);
    box(cx, -2.4, -10.5, 2.8, 3.0, 1.0, Y, 1.2);
    // muzzle + eye + nose on the front (+x)
    box(cx, 1.6, -3.4, 3.1, 2.5, .9, white ? '#fff' : BEAK, 1.0);
    if(!white){
      cx.fillStyle = BLK;
      rrPath(cx, 1.2, -6.2, 1.5, 2.5, .6); cx.fill();                // side eye
      rrPath(cx, 3.4, -3.2, 1.2, 1.0, .4); cx.fill();                // tiny nose
    }
  }
  function shicka(cx, white){
    cx.save(); cx.translate(-14.5, -18.5); cx.scale(-1, 1);          // strapped to Bear's back, facing outward (-x)
    drawShicka(cx, white, true);
    cx.restore();
  }

  // ---------- SHICKA, standalone (in Bear's hand / flying): origin = its centre. Same look as the backpack Shicka, without the strap. ----------
  function shickaBig(cx, x, y, rot, white, sc){
    cx.save(); cx.translate(x, y); cx.rotate(rot); cx.scale(sc || 1, sc || 1);
    drawShicka(cx, white, false);
    cx.restore();
  }

  // ---------- HEAD: big rounded square, small round ears, tan muzzle, black eyes + nose ----------
  function head(cx, S, f, t, white){
    const hj = f.rig ? f.rig.j.head.a : 0;
    const k = squash(f, t);
    cx.save();
    cx.translate(S.head.x, S.head.y);
    cx.rotate(S.lean + hj);
    cx.translate(0, HH); cx.scale(1 + .12 * k, 1 - .12 * k); cx.translate(0, -HH);      // squash & stretch (anchored at the chin)
    const F = white ? '#fff' : FUR, M = white ? '#fff' : TAN;
    // far ear (behind the head)
    disc(cx, 4.2, -HH + .2, 3.1, F, 1.5);
    if(!white) disc(cx, 4.4, -HH + .5, 1.5, TAN, 0);
    // head box
    box(cx, -HW, -HH, HW * 2, HH * 2, 3.6, F, 1.6);
    if(!white){
      cx.save(); rrPath(cx, -HW, -HH, HW * 2, HH * 2, 3.6); cx.clip();
      cx.fillStyle = FUR_L; cx.fillRect(-HW, -HH, HW * 2, 3.2);                         // light top face
      cx.fillStyle = FUR_D; cx.fillRect(-HW, -HH, 3, HH * 2);                           // darker back of the head
      cx.restore();
    }
    // near ear
    disc(cx, -5.6, -HH + .4, 3.4, F, 1.5);
    if(!white) disc(cx, -5.2, -HH + .8, 1.7, TAN, 0);
    // muzzle (sticks out a little in front), eyes, nose
    box(cx, 2.6, .8, 8.6, 6.2, 2.8, M, 1.3);
    if(!white){
      cx.fillStyle = BLK;
      rrPath(cx, .6, -4.2, 2.4, 4.6, .9); cx.fill();                                    // eye (back)
      rrPath(cx, 5.8, -4.2, 2.4, 4.6, .9); cx.fill();                                   // eye (front)
      rrPath(cx, 7.2, 1.2, 3.3, 2.3, 1.1); cx.fill();                                   // nose
    }
    cx.restore();
  }

  // near arm drawn again over the head when it is raised (jump, hit, skills later), so the head never hides it
  function armOver(cx, S, white){
    const a = S.aN;
    if(a.hand.y > S.sh.y - 6) return;
    const col = white ? '#fff' : FUR;
    cap(cx, a.s, a.el, 5.4, col, 1.5); cap(cx, a.el, a.hand, 5, col, 1.5);
    disc(cx, a.hand.x, a.hand.y, 3.3, col, 1.5);
  }

  // BIG FISTS (like the real game): while punching, the fist swells as the arm drives out and shrinks back on the recovery. Drawn over the normal small hand,
  // so the picture matches the hit box (a rounded SQUARE, like his head) (skills.js reach). Punches (steps 0-3) = the hitting arm only, dive (step 4) = both fists.
  function fistScale(p, dive){
    const k = dive ? [[0,0],[.3,0],[.46,1],[.88,1],[1,0]] : [[0,0],[.25,.2],[.42,1],[.8,1],[.95,0]];
    if(p <= k[0][0]) return k[0][1];
    for(let i = 1; i < k.length; i++) if(p <= k[i][0]){ const a = k[i - 1], b = k[i], u = (p - a[0]) / (b[0] - a[0]); const e = u * u * (3 - 2 * u); return a[1] + (b[1] - a[1]) * e; }
    return k[k.length - 1][1];
  }
  function bigFists(cx, S, f, white){
    const A = f.A;
    if(!(f.atk > 0) || !A || A.skill || A.step == null || f.stun > 0) return;
    const p = clamp(1 - f.atk / A.time, 0, 1), dive = A.step === 4, sc = fistScale(p, dive);
    if(sc <= .02) return;
    const r = lerp(3.4, FIST_R, sc), hands = dive ? [S.aF.hand, S.aN.hand] : [A.step % 2 === 0 ? S.aN.hand : S.aF.hand];
    const q = r * .92;                                                                                                   // half side of the square fist
    for(const h of hands){
      box(cx, h.x - q, h.y - q, q * 2, q * 2, q * .38, white ? '#fff' : FUR, 1.6);                                      // rounded square, like Bear's head
      if(!white){
        box(cx, h.x - q * .78, h.y - q * .78, q * 1.56, q * .5, q * .22, FUR_L, 0);                                      // light top face
        cx.strokeStyle = FUR_D; cx.lineWidth = 1; cx.lineCap = 'round';                                                  // knuckle lines on the front of the fist
        for(const k of [-.4, .15, .7]){ cx.beginPath(); cx.moveTo(h.x + q * .5, h.y + q * k); cx.lineTo(h.x + q * .88, h.y + q * k); cx.stroke(); }
      }
    }
  }

  // ---------- SUPER JUMP & SHICKA TOSS poses (S = f.shk, e = aim elevation: 0 level, + up). Joint angles: 0 = hangs down, + = forward, so a level arm = 1.57 and straight up = 3.14. ----------
  function shkPose(tg, S, K){
    const e = S.e || 0, set = o => KEYS.forEach(k => { if(o[k] !== undefined) tg[k] = o[k]; });
    const stand = (th, a) => ({tN:th, kN:legK(th, STAND_Y - a), tF:-th, kF:legK(-th, STAND_Y - a)});
    if(S.ph === 'crouch'){                                   // deep crouch, arms swung back
      const k = clamp(S.t / S.T0, 0, 1);
      set({lean:lerp(.1, .32, k), head:.1 * k, aN:lerp(.1, -.9, k), eN:lerp(.4, .8, k), aF:lerp(.1, -.7, k), eF:lerp(.4, .8, k), tN:lerp(.2, .55, k), kN:lerp(.3, 1.7, k), tF:lerp(-.2, -.2, k), kF:lerp(.3, 1.2, k)});
    }else if(S.ph === 'jump'){                               // launched: arms straight up, legs tucked
      set({lean:-.08, head:-.15, aN:2.9, eN:.15, aF:2.7, eF:.2, tN:.65, kN:1.25, tF:-.3, kF:.95});
    }else if(S.ph === 'grab'){                               // lands, reaches back over the shoulder, pulls Shicka off, brings it forward
      const p = clamp(S.t / S.Tg, 0, 1);
      set({lean:K(p, [[0,.16],[.45,-.04],[1,.12]]), head:K(p, [[0,-.05],[.45,.1],[1,-.1]]),
           aN:K(p, [[0,.5],[.4,-2.7],[.55,-2.7],[1,1.57 + e]]), eN:K(p, [[0,.4],[.4,1.0],[.55,1.0],[1,.1]]),
           aF:K(p, [[0,.3],[1,.9 + e * .5]]), eF:K(p, [[0,.5],[1,.8]]), ...stand(.34, .4)});
    }else if(S.ph === 'aim'){                                // planted, Shicka held out along the aim, the other hand steadies it
      const w = Math.sin(S.t * 11) * .012;
      set({lean:.1 - e * .06, head:-.1 + e * .05, aN:1.57 + e + w, eN:.08, aF:1.2 + e * .75, eF:.95, ...stand(.36, .4)});
    }else{                                                   // 'throw': follow-through
      const p = clamp(S.t / S.Tt, 0, 1);
      set({lean:K(p, [[0,.12],[.25,.42],[1,.08]]), head:-.1 * (1 - p),
           aN:K(p, [[0,1.57 + e],[.3,1.9 + e * .5],[1,.3]]), eN:K(p, [[0,.08],[.3,.05],[1,.9]]),
           aF:K(p, [[0,1.2 + e * .75],[.3,.4],[1,.5]]), eF:K(p, [[0,.95],[.3,1.7],[1,1.6]]), ...stand(.36, .4)});
    }
  }

  // ---------- ANIMATION ----------
  // key: lean/head/aN/eN/aF/eF/tN/kN/tF/kF (see body.js). 0 = hangs down, + = forward.
  function walkPose(ph, rn){                                 // rn: 0 = short bouncy walk, 1 = energetic run
    const s = Math.sin(ph), c = Math.cos(ph), bn = .5 - .5 * Math.cos(2 * ph);   // bn = body bounce on every step
    const amp = lerp(.58, .95, rn), sw = lerp(.7, 1.05, rn), kb = lerp(.8, 1.1, rn);
    return {lean:lerp(.1, .25, rn), head:-.03 - .04 * rn + Math.sin(2 * ph) * .035,
            aN:-s * sw, eN:lerp(.5, 1.1, rn) + .25 * c, aF:s * sw, eF:lerp(.5, 1.1, rn) - .25 * c,
            tN:s * amp + .1, kN:.25 + kb * Math.max(0, c) + bn * .14,
            tF:-s * amp + .1, kF:.25 + kb * Math.max(0, -c) + bn * .14};
  }
  const KEYS = ['lean','head','aN','eN','aF','eF','tN','kN','tF','kF'];
  const BELLY = {lean:0, head:-.05, aN:2.95, eN:.12, aF:2.8, eF:.15, tN:.04, kN:.08, tF:-.04, kF:.08};   // upright, arms straight up, legs straight down: drawn turned a quarter turn forward = belly-down dive, arms out front, legs behind
  const TUCK = {lean:.6, head:.3, aN:1.0, eN:2.1, aF:.8, eF:2.1, tN:1.4, kN:2.2, tF:1.15, kF:2.1};   // curled ball: knees up, arms hugging them
  const blend = (a, b, w) => { KEYS.forEach(k => a[k] = lerp(a[k], b[k], w)); };

  Characters.art('bear', {
    body: {head:{r:8}, torso:{len:TORSO_L, w:TORSO_W}, uArm:{len:6.5, w:5.6}, fArm:{len:6, w:5.2}, hand:{r:3.4},
           thigh:{len:T, w:7.8}, shin:{len:SH, w:6.8}, foot:{len:8.5, w:5},
           headSink:0, shN:.5, shF:-4.5, belt:.1, noRings:true, outline:OUT, outlineW:1.5},
    colors: {shirt:FUR, limb:FUR, far:FUR_D, head:FUR, dark:FEET, hand:FUR, legs:FUR, legsFar:FUR_D},

    // FRONT FLIP (double jump). body.js treats art.draw as 'replace the ragdoll', so the normal ragdoll is drawn from here: step aside (art.draw removed for that one call),
    // then call Body.draw as usual. During the flip it is drawn through a copy of the fighter that stands in tuck pose (f.tuck) and rotated around its middle.
    draw(cx, f, t){
      const A = Characters.artOf('bear'), self = A.draw, s = (track(f, t), state(f));
      const p = (t - s.flipT) / FLIP_D;
      const flip = p >= 0 && p < 1 && !f.gr && !(f.stun > 0) && !(f.atk > 0) && !f.capturedBy;
      const belly = (f.bst || (f.bsLandT != null && t - f.bsLandT < .22 && !f.gr)) && !(f.stun > 0) && !f.capturedBy;   // BELLY STOMP: dive + the first moment of the bounce
      delete A.draw;
      try{
        if(belly){
          const g = Object.create(f); g.gr = true; g.belly = true; g.vx = 0; g.atk = 0;                                 // same trick as the flip: a copy of the fighter drawn in the belly pose
          const ang = Math.PI / 2 * f.face, py = (f.rig ? f.rig.py : -9) - 9, lift = -26 - py;                             // a quarter turn forward (head first, belly down), pivot = middle of the body
          const ctx = new Proxy(cx, {
            get: (c, k) => { const v = c[k]; if(k === 'ellipse') return (...a) => { if(!(a[0] === 0 && a[1] === 1 && a[2] === 14 && a[3] === 3)) c.ellipse(...a); }; return typeof v === 'function' ? v.bind(c) : v; },
            set: (c, k, v) => { c[k] = v; return true; }
          });
          cx.save();
          cx.translate(0, lift); cx.translate(f.x, f.y + py); cx.rotate(ang); cx.translate(-f.x, -(f.y + py));
          Body.draw(ctx, g, t);
          cx.restore();
        }
        else if(!flip) Body.draw(cx, f, t);
        else {
          const g = Object.create(f); g.gr = true; g.tuck = true; g.vx = 0;                   // copy of the fighter: same rig / state, drawn in the tuck pose
          const e = p * p * (3 - 2 * p), ang = Math.PI * 2 * (e * .6 + p * .4) * f.face;       // one full forward turn (almost even speed)
          const py = (f.rig ? f.rig.py : -9) - 9, env = Math.min(1, p * 7, (1 - p) * 7), lift = (-26 - py) * env;   // pivot = middle of the curled body, kept at jump height
          const ctx = new Proxy(cx, {
            get: (c, k) => { const v = c[k]; if(k === 'ellipse') return (...a) => { if(!(a[0] === 0 && a[1] === 1 && a[2] === 14 && a[3] === 3)) c.ellipse(...a); }; return typeof v === 'function' ? v.bind(c) : v; },   // skip the ground shadow while airborne
            set: (c, k, v) => { c[k] = v; return true; }
          });
          cx.save();
          cx.translate(0, lift); cx.translate(f.x, f.y + py); cx.rotate(ang); cx.translate(-f.x, -(f.y + py));
          Body.draw(ctx, g, t);
          cx.restore();
        }
      } finally { A.draw = self; }
    },

    // idle / walk / run / landing. body.js only calls this on the ground and not while hurt, so the shared air + hurt poses stay untouched.
    pose(tg, f, t, run, K){
      if(f.belly){ KEYS.forEach(j => tg[j] = BELLY[j]); return; }   // Belly Stomp
      if(f.tuck){ KEYS.forEach(j => tg[j] = TUCK[j]); return; }   // front flip: curled up
      track(f, t);
      const b = Math.sin(t * 2.2), ph = (f.rig && f.rig.phase) || 0;
      const th = .17;
      const IDLE = {lean:.06 + b * .015, head:Math.sin(t * 2.2 + .8) * .035,        // relaxed, gently breathing
                    aN:-.04 + b * .03, eN:.2, aF:-.16 - b * .03, eF:.26,
                    tN:th, kN:legK(th, STAND_Y), tF:-th, kF:legK(-th, STAND_Y)};
      const mv = clamp(run / .4, 0, 1), rn = clamp((run - .5) / .5, 0, 1);
      const P = IDLE;
      if(mv > 0) blend(P, walkPose(ph, rn), mv);
      // landing: knees bend + body dips, then a small bounce back up (k > 0 = squashed)
      const k = squash(f, t);
      if(k > 0 && f.gr){
        const kk = clamp(k, 0, 1), Y = lerp(STAND_Y, 10.6, kk), tn = .2 + .42 * kk, tf = -.2 - .16 * kk;
        blend(P, {lean:.16, head:-.06, aN:.6, eN:.3, aF:-.5, eF:.3, tN:tn, kN:legK(tn, Y), tF:tf, kF:legK(tf, Y)}, clamp(kk * 2.2, 0, 1) * (1 - mv * .6));
      }
      KEYS.forEach(j => tg[j] = P[j]);
    },

    // far arm (hits 2 + 4) and both arms (dive) are drawn OVER the body while punching, so the big fist is never hidden behind the torso
    farFront(f){ return f.atk > 0 && !!f.A && !f.A.skill && (f.A.step === 1 || f.A.step === 3 || f.A.step === 4); },

    // BASIC COMBO poses (skills.js combo): steps 0-3 = punches, left / right / left / right (near arm, far arm, near arm, far arm), step 4 = DIVE.
    // p = 0 -> 1 across the swing. Punch: arm winds back, drives straight forward, comes back; the other fist guards at the chin; small step in.
    // Dive: crouch, spring up with both arms swinging forward, body tipped head first, arms out front, legs trailing, then the landing squash comes from the shared landing code above.
    attack(tg, p, A, K){
      if(A.skill === 'superjump' && A.shk){ shkPose(tg, A.shk, K); return; }   // Skill II poses itself from f.shk (not from p)
      const st = A.step || 0;
      if(st === 4){
        tg.lean = K(p, [[0,-.12],[.22,-.2],[.34,.9],[.5,1.4],[.85,1.45],[1,.5]]);
        tg.head = K(p, [[0,0],[.3,.1],[.5,-.25],[.85,-.25],[1,0]]);
        tg.aN = K(p, [[0,-.9],[.22,-1.1],[.34,2.4],[.5,1.85],[.85,1.75],[1,.4]]); tg.eN = K(p, [[0,.8],[.22,1.2],[.34,.2],[.5,.12],[.85,.15],[1,.9]]);
        tg.aF = K(p, [[0,-.7],[.22,-.9],[.34,2.5],[.5,1.95],[.85,1.85],[1,.4]]); tg.eF = K(p, [[0,.8],[.22,1.2],[.34,.2],[.5,.12],[.85,.15],[1,.9]]);
        const th = K(p, [[0,.5],[.22,.55],[.34,-.5],[.5,-1.0],[.85,-1.1],[1,.2]]), tf = K(p, [[0,-.15],[.22,-.1],[.34,-.7],[.5,-1.25],[.85,-1.3],[1,-.2]]);
        tg.tN = th; tg.kN = K(p, [[0,1.6],[.22,1.8],[.34,.8],[.5,.35],[.85,.3],[1,.5]]);
        tg.tF = tf; tg.kF = K(p, [[0,1.0],[.22,1.2],[.34,.8],[.5,.3],[.85,.25],[1,.5]]);
        return;
      }
      const hit = st % 2 === 0 ? 'N' : 'F', guard = hit === 'N' ? 'F' : 'N', big = st >= 2 ? 1 : 0;       // hits 1 + 3 = near arm, 2 + 4 = far arm; 3 + 4 a bit bigger
      tg['a' + hit] = K(p, [[0,.3],[.22,-.7 - .15 * big],[.45,1.55],[.7,1.5],[1,.3]]); tg['e' + hit] = K(p, [[0,1],[.22,2],[.45,.2],[.7,.25],[1,1]]);
      tg['a' + guard] = K(p, [[0,.5],[.25,.95],[.5,.55],[1,.45]]); tg['e' + guard] = K(p, [[0,1.6],[.25,2.1],[.5,2.0],[1,1.6]]);
      tg.lean = K(p, [[0,.08],[.22,-.12 - .04 * big],[.45,.32 + .06 * big],[.7,.26],[1,.08]]); tg.head = -tg.lean * .4;
      const a = K(p, [[0,.17],[.22,.05],[.45,.5],[.7,.45],[1,.17]]), b = K(p, [[0,-.17],[.22,-.38],[.45,-.5],[.7,-.45],[1,-.17]]);   // front leg steps in, back leg pushes off (both feet stay on the ground)
      tg.tN = a; tg.kN = legK(a, STAND_Y); tg.tF = b; tg.kF = legK(b, STAND_Y);
    },

    // chubby torso: round body + tan belly + the near backpack strap
    torso(cx, S, B, P, white){
      const L = B.torso.len, W = B.torso.w;
      cx.save(); cx.translate(S.pel.x, S.pel.y); cx.rotate(S.lean);
      cap(cx, {x:0, y:0}, {x:0, y:-L}, W, white ? '#fff' : FUR, B.outlineW);
      if(!white){
        cx.fillStyle = TAN; cx.beginPath(); cx.ellipse(4.7, -L / 2 - .3, 3.5, L / 2 + 4.6, 0, 0, 7); cx.fill();   // belly
        cap(cx, {x:1.4, y:-L - 5}, {x:5.6, y:-L + 3.6}, 2.6, BLUE, 1);                                          // strap over the shoulder
      }
      cx.restore();
    },

    // SHICKA: same frame as the torso (pelvis origin, rotated by the lean) = they follow the upper body in every pose
    behind(cx, f, t, S, P){
      track(f, t);
      const white = f.flash > 0;
      cx.translate(S.pel.x, S.pel.y); cx.rotate(S.lean);
      cx.translate(3, 9);                                   // Shicka sits on the back itself (it used to perch on top of the backpack)
      if(!(f.shGone || (f.shk && f.shk.sh))) shicka(cx, white);   // Skill II: gone while he holds it / after the throw, until the cooldown ends
    },

    // SHICKA FLYING (Skill II): a straight line, beak first, with a short yellow streak behind it. (s = {x, y, vx, vy, age, kind}; Bear has no other projectile.)
    shot(cx, s, t){
      if(s.kind !== 'shicka') return;
      const a = Math.atan2(s.vy || 0, s.vx || 1), ca = Math.cos(a), sa = Math.sin(a);
      cx.lineCap = 'round';
      for(let i = 1; i <= 4; i++){
        const k = i * 12; cx.globalAlpha = .42 - i * .08; cx.strokeStyle = i % 2 ? YEL : BEAK; cx.lineWidth = 10 - i * 1.8;
        cx.beginPath(); cx.moveTo(s.x - ca * k, s.y - sa * k); cx.lineTo(s.x - ca * (k + 9), s.y - sa * (k + 9)); cx.stroke();
      }
      cx.globalAlpha = 1; cx.translate(s.x, s.y); cx.rotate(a); if(ca < 0) cx.scale(1, -1);   // (flying left: mirror so Shicka is not upside down)
      shickaBig(cx, 0, 0, 0, false, 1.3);
    },

    front(cx, f, t, S, P){
      const white = f.flash > 0, s = state(f), tau = t - s.landT;
      head(cx, S, f, t, white);
      armOver(cx, S, white);C
      const K = f.shk;                                                      
      if(K && K.sh && !K.thrown){
        const h = S.aN.hand, e = K.e || 0, ca = Math.cos(e), sa = Math.sin(e);
        if(K.ph === 'aim'){
          const L = K.d.shot.speed * K.d.shot.life, pu = .55 + .45 * Math.sin(t * 12), x0 = h.x + ca * 12, y0 = h.y - sa * 12;
          cx.save(); cx.lineCap = 'round'; cx.setLineDash([9, 8]); cx.lineWidth = 2.5;
          const g = cx.createLinearGradient(x0, y0, x0 + ca * L, y0 - sa * L); g.addColorStop(0, 'rgba(255,200,40,.9)'); g.addColorStop(.5, 'rgba(255,170,60,.45)'); g.addColorStop(1, 'rgba(255,170,60,0)');
          cx.strokeStyle = g; cx.beginPath(); cx.moveTo(x0, y0); cx.lineTo(x0 + ca * L, y0 - sa * L); cx.stroke(); cx.setLineDash([]);
          cx.globalAlpha = pu; cx.strokeStyle = '#ffd21f'; cx.lineWidth = 2; cx.beginPath(); cx.arc(h.x + ca * 8, h.y - sa * 8, 11, 0, 7); cx.stroke();
          cx.restore();
        }
        shickaBig(cx, h.x + ca * 7, h.y - sa * 7, -e, white, 1);
      }
      bigFists(cx, S, f, white);A
      if(f.gr && tau >= 0 && tau < .3 && s.amp){                                      // landing dust ticks
        const a = (1 - tau / .3) * .85;
        cx.lineCap = 'round'; cx.strokeStyle = 'rgba(255,255,255,' + a.toFixed(2) + ')'; cx.lineWidth = 1.5;
        for(const g of [-1, 1]){ cx.beginPath(); cx.moveTo(g * (11 + 26 * tau), -1.5); cx.lineTo(g * (15 + 26 * tau), -5.5); cx.stroke(); }
      }
    }
  });
})();