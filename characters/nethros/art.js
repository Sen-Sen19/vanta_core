// NETHROS art - "The Eternal Dread". A classic supernatural GRIM REAPER: a faceless figure under a draped black hood. NO LEGS: the ragdoll ends at the waist and black smoke is his lower body.
// Same shared ragdoll (body.js): only sizes, colors, poses and drawing hooks. Nothing in arena.js / body.js / main.js is changed. Hitbox is still 30x52 (visual only: he is drawn about 13% taller).
//
// LOOK (fully monochrome: matte black, charcoal, ash gray. No violet, purple, blue or crimson anywhere)
//   Head      NO face, NO eyes, NO skull. A slightly oversized, naturally draped HOOD: soft rounded top, cloth lip, folds on the sides and back, the back drape falls onto the shoulders.
//             The opening is absolute black with only a few barely visible smoke puffs moving inside it.
//   Torso     elongated, broad shoulders, narrower waist, solid and structured. The robe covers the whole torso (no opening, no ribs).
//   Cloth     long ragged robe (matte black + restrained ash-gray rim light and folds): back cloak, layered front drape, shoulder capelet, oversized hanging sleeves with torn cuffs.
//             Below the waist the cloth turns translucent, ends in pointed tatters, and every tatter unravels into a smoke ribbon.
//   Hands     dark charcoal SKELETAL hands: small bony palm, exceptionally long thin crooked fingers with knuckles, coming out of the cuffs. They only twitch, slowly and rarely.
//   Lower     the waist dissolves into a dense black smoke column (this IS his lower body, not an effect on top of legs). Charcoal-gray edges give it depth. Thin black mist on the ground.
//   Idle      almost motionless: tiny float, robe tatters and sleeves shift slowly, smoke curls slowly, a faint dark aura, a few gray ash flakes drift down.
//
// HOW THE LEGS ARE HIDDEN (read this before changing the body sizes)
//   The ragdoll always has legs. Here they are invisible: width .01, transparent color, no outline, no foot, and pose() holds them still.
//   They only decide how high the waist floats (T + SH = leg length, HOVER = how much of it is used). Because of this, `outline` is
//   transparent for the WHOLE body (the arms and head have no dark outline). Do not change outline / outlineW / thigh.w / shin.w.
//   torso.len is 19 (was 14): that is what makes him taller. Cloth, smoke and ash are cut at the ground line (clip at y = 0, origin = feet) so nothing goes under a platform.
//
// ATTACK = DARK SOUL (ranged). Both hands make the energy. Nothing comes out of the chest. (unchanged timing)
//   Hands pull a little back and gather darkness (COIL), then both hands thrust forward (RELEASE) and the soul leaves.
//   skills.js: basic: {hitFrom:0, hitTo:0, shot:{p:.5, hand:'B', r:..., speed:..., life:...}}  <- shot.p MUST equal C below (.5), hand 'B'.
//   shot(cx, s, t) at the bottom draws the flying soul: nearly black core, charcoal trail, thin ash edge.
//
// SETTINGS: FLOAT = bob amount (0 = none)   SMOKE = how much smoke (0 = none, 1 = default, 2 = a lot)
(() => {
  let nethSmoke = null;   // the cached soft smoke puff (Dread Ritual aura + the base of the Gravebound Hands)
  const getSmoke = () => {
    if(!nethSmoke){ nethSmoke = document.createElement('canvas'); nethSmoke.width = nethSmoke.height = 64;
      const c2 = nethSmoke.getContext('2d'), g = c2.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(5,5,6,1)'); g.addColorStop(.45, 'rgba(8,8,9,.55)'); g.addColorStop(1, 'rgba(8,8,9,0)');
      c2.fillStyle = g; c2.fillRect(0, 0, 64, 64); }
    return nethSmoke;
  };
  const FLOAT = 1, SMOKE = 1;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const C = .5;                                    // moment the soul leaves the hands = shot.p in skills.js
  const T = 13, SH = 12.5;                         // invisible thigh + shin (must match body below)
  const HOVER = 23.5;                              // waist height above the ground (px). The smoke fills the space under it.
  const SPAN = 19;                                 // smoke length below the waist (ends about 6 px above the ground)
  const YMAX = .985 * (T + SH);

  // knee angle that puts the (invisible) ankle at height Y, so both legs stay equal and the waist height is exactly what we want
  const legK = (th, Y) => { const a = Math.acos(clamp((Y - T * Math.cos(th)) / SH, -1, 1)); const k = th - a; return k > .05 ? k : th + a; };
  const legs = (tg, Y) => { tg.tN = .04; tg.tF = -.04; Y = Math.min(Y, YMAX); tg.kN = legK(tg.tN, Y); tg.kF = legK(tg.tF, Y); };

  // ---- the cast. p = 0..1 over the swing. COIL (slow, soft) up to C, then RELEASE (fast, stiff). Hands go back a little, then both thrust forward. ----
  const ATK = {
    aN:   [[0,.3],[.14,.05],[.34,-.55],[.46,-.6],[.5,1.45],[.62,1.5],[.82,.95],[1,.3]],
    eN:   [[0,.35],[.34,1.4],[.46,1.45],[.5,.1],[.62,.08],[.82,.6],[1,.35]],
    aF:   [[0,-.2],[.14,-.3],[.36,-.75],[.46,-.8],[.5,1.35],[.62,1.45],[.84,.9],[1,-.2]],
    eF:   [[0,.3],[.36,1.35],[.46,1.4],[.5,.14],[.62,.1],[.84,.6],[1,.3]],
    lean: [[0,.22],[.34,.06],[.46,.04],[.5,.44],[.62,.48],[.82,.32],[1,.22]],
    head: [[0,.2],[.34,.3],[.5,.24],[.7,.14],[1,.2]],
    Y:    [[0,23.5],[.4,22.4],[.5,24],[1,23.5]]
  };

  // ---- small drawing helpers (local space: origin = feet, x = forward, y = down) ----
  function poly(cx, pts, fill, stroke, lw){
    cx.beginPath(); pts.forEach((q, i) => i ? cx.lineTo(q[0], q[1]) : cx.moveTo(q[0], q[1])); cx.closePath();
    if(fill){ cx.fillStyle = fill; cx.fill(); }
    if(stroke){ cx.strokeStyle = stroke; cx.lineWidth = lw || 1; cx.lineJoin = 'round'; cx.stroke(); }
  }


  // MONOCHROME palette: matte black + charcoal cloth, restrained ash-gray only for edge light and folds. No violet, no purple, no crimson anywhere.
  const EDGE = 'rgba(150,150,156,.4)', INK = 'rgba(2,2,3,.92)', FOLD = 'rgba(140,140,146,.26)', DEEP = 'rgba(0,0,0,.6)';

  // ragged hem: a left-to-right list of long pointed tatters with shorter notches between them. tips = [[dx, length], ...] measured from (bx, by).
  // Long tatters trail back more when he moves (tr) and sway slowly. Returns the polyline of the hem. (tips at even indexes, notches at odd ones)
  function hemPts(bx, by, tips, tr, t, sway, k){
    tips = tips.map(([d, l]) => [d, l * (k || 1.05)]);                                              // cloth tatters stay short: the smoke column is most of his lower body
    const o = [], X = (dx, len, i) => bx + dx - tr * (len / 19) * .9 + Math.sin(t * 1.1 + i * 1.3) * (len / 19) * 1.5 * sway;
    tips.forEach(([dx, len], i) => {
      const x = X(dx, len, i);
      if(i){ const [pd, pl] = tips[i - 1]; o.push([(X(pd, pl, i - 1) + x) / 2 + (i % 2 ? .6 : -.6), by + Math.min(len, pl) * .52 + (i % 3) * .8]); }
      o.push([x, by + len]);
    });
    return o;
  }

  // a flowing smoke ribbon that continues a cloth tatter: starts at the tip (x, y), curls and drifts down, thins out and fades. This is what makes the robe DISSOLVE into the smoke.
  function ribbon(cx, x, y, len, ph, t, tr, a0){
    len = Math.min(len, -2 - y); if(len < 2.5) return;                                       // a ribbon always ends above the ground line, never cut flat
    const n = 8, Lp = [], Rp = [];
    for(let k = 0; k <= n; k++){
      const f = k / n, cxp = x + Math.sin(ph + t * .8 + f * 3.2) * (.8 + f * 3.4) - tr * f * f * .6, w = 1.5 * (1 - f * .9) + .15;
      Lp.push([cxp - w, y + len * f]); Rp.push([cxp + w, y + len * f]);
    }
    const g = cx.createLinearGradient(0, y, 0, y + len); g.addColorStop(0, 'rgba(28,28,32,' + a0 + ')'); g.addColorStop(1, 'rgba(40,40,45,0)');
    poly(cx, Lp.concat(Rp.reverse()), g, null);
  }

  // an OVERSIZED hanging SLEEVE over one arm (A = {s, el, hand}): narrow at the shoulder, flaring to a very wide torn cuff before the wrist. The hand comes out of it.
  function sleeve(cx, A, white, t, tr, c0, c1){
    const s = {x: A.s.x, y: A.s.y + 4.5}, e = A.el, h = A.hand, d1 =   // the sleeve starts 4.5 px BELOW the neck line: the arms come out of the shoulders, not out of the hood
       Math.hypot(e.x - s.x, e.y - s.y) || 1, d2 = Math.hypot(h.x - e.x, h.y - e.y) || 1;
    const vx = (e.x - s.x) / d1, vy = (e.y - s.y) / d1, ux = (h.x - e.x) / d2, uy = (h.y - e.y) / d2;
    const wr = {x: h.x - ux * 3, y: h.y - uy * 3}, n1 = [-vy, vx], n2 = [-uy, ux];
    let nm = [n1[0] + n2[0], n1[1] + n2[1]]; const nl = Math.hypot(nm[0], nm[1]) || 1; nm = [nm[0] / nl, nm[1] / nl];
    const w0 = 2.8, w1 = 3.8, w2 = 4.8;
    const L = [[s.x + n1[0] * w0, s.y + n1[1] * w0], [e.x + nm[0] * w1, e.y + nm[1] * w1], [wr.x + n2[0] * w2, wr.y + n2[1] * w2]];
    const R = [[s.x - n1[0] * w0, s.y - n1[1] * w0], [e.x - nm[0] * w1, e.y - nm[1] * w1], [wr.x - n2[0] * w2, wr.y - n2[1] * w2]];
    const cuff = [], ln = [1.6, 6.5, 2, 5.5, 1.6];                                           // torn cuff: two long tatters hanging down, notches between
    ln.forEach((len, i) => {
      const k = i / 4, x = L[2][0] + (R[2][0] - L[2][0]) * k, y = L[2][1] + (R[2][1] - L[2][1]) * k, sw = Math.sin(t * 1.3 + i * 1.7) * .6;
      cuff.push([x + ux * len * .5 + sw - tr * .04 * len, y + uy * len * .5 + len * .8]);
    });
    const pts = [[s.x - vx * 2, s.y - vy * 2]].concat(L, cuff, R.reverse());
    let fill = '#fff';
    if(!white){ fill = cx.createLinearGradient(s.x, s.y, wr.x, wr.y); fill.addColorStop(0, c0); fill.addColorStop(1, c1); }
    poly(cx, pts, fill, white ? null : INK, .6);
    if(white) return;
    cx.lineCap = 'round';
    cx.strokeStyle = EDGE; cx.lineWidth = .5; cx.beginPath(); L.forEach((q, i) => i ? cx.lineTo(q[0], q[1]) : cx.moveTo(q[0], q[1])); cx.stroke();   // ash rim on the upper edge
    cx.strokeStyle = DEEP; cx.lineWidth = .8; cx.beginPath(); cx.moveTo(s.x, s.y); cx.quadraticCurveTo(e.x + nm[0] * .6, e.y + nm[1] * .6, wr.x, wr.y); cx.stroke();   // centre fold
    cx.strokeStyle = FOLD; cx.lineWidth = .5; cx.beginPath(); cx.moveTo(e.x + nm[0] * 1.8, e.y + nm[1] * 1.8); cx.lineTo(wr.x + n2[0] * 3.4, wr.y + n2[1] * 3.4); cx.stroke();
  }

  // ---- a SKELETAL hand: small bony palm + 4 exceptionally long, thin, slightly crooked fingers (3 phalanges each, a knuckle at every joint) + a short thumb. Dark charcoal bone.
  // The fingers twitch slowly and rarely (sharp little pulses), they never wave. Drawn on top of the sleeve, so the hand comes out of the cuff. ----
  function claws(cx, A, white, t, near){
    const h = A.hand, e = A.el, th = Math.atan2(h.y - e.y, h.x - e.x);
    const curl = -.5 * Math.tanh(Math.sin(th) * 4);           // fingers curl in toward the palm side; straighter when the arm points sideways
    const BONE = '#1c1c1f', BONE2 = '#2b2b2f', RIM = '#3c3c41';
    cx.fillStyle = white ? '#fff' : BONE2; cx.strokeStyle = RIM; cx.lineWidth = .5;
    cx.beginPath(); cx.ellipse(h.x + Math.cos(th) * 1, h.y + Math.sin(th) * 1, 2.3, 1.8, th, 0, 7); cx.fill(); if(!white) cx.stroke();
    const F = [[-.55, 10.4, 1, .55], [-.2, 12.6, 1.05, -.4], [.2, 13, 1.05, .5], [.56, 10.6, .95, -.35], [1.5, 6.2, .9, .3]];   // [angle offset, length, width, crook bias]; the last one is the thumb
    F.forEach(([off, len0, w, crook], i) => {
      const len = len0 * .78;
      const thumb = i === 4, ph = (near ? 0 : 1.7) + i * 2.1;
      const tw = Math.pow(Math.max(0, Math.sin(t * .55 + ph)), 14) * .3;                       // a slow, rare twitch
      const a0 = th + off * .8 + Math.sin(t * 1.0 + ph) * .03 + tw * (thumb ? -.4 : 1), sg = thumb ? -1.3 : 1;
      let x = h.x + Math.cos(a0) * 1.8, y = h.y + Math.sin(a0) * 1.8;
      const SL = [.42, .33, .25], P = [[x, y]], N = [[-Math.sin(a0), Math.cos(a0)]], wd = [.62 * w, .48 * w, .36 * w, .03];
      for(let k = 0; k < 3; k++){
        const a = a0 + curl * sg * (k + 1) / 3 * (thumb ? .8 : 1.1) + crook * .22 * (k + 1) / 3;   // curl toward the palm + a personal crook, so no two fingers match
        x += Math.cos(a) * len * SL[k]; y += Math.sin(a) * len * SL[k];
        P.push([x, y]); N.push([-Math.sin(a), Math.cos(a)]);
      }
      const L = P.map((q, k) => [q[0] + N[k][0] * wd[k], q[1] + N[k][1] * wd[k]]), R = P.map((q, k) => [q[0] - N[k][0] * wd[k], q[1] - N[k][1] * wd[k]]).reverse();
      poly(cx, L.concat(R), white ? '#fff' : BONE, white ? null : RIM, .35);
      if(white) return;
      cx.fillStyle = BONE2; cx.strokeStyle = RIM; cx.lineWidth = .3;
      [1, 2].forEach(k => { cx.beginPath(); cx.arc(P[k][0], P[k][1], .62 * w, 0, 7); cx.fill(); cx.stroke(); });   // knuckles: this is what makes the fingers read as articulated bone
      cx.strokeStyle = 'rgba(160,160,166,.5)'; cx.lineWidth = .35; cx.lineCap = 'round';
      cx.beginPath(); cx.moveTo(P[1][0], P[1][1]); cx.lineTo(P[2][0], P[2][1]); cx.lineTo(P[3][0], P[3][1]); cx.stroke();   // faint bone-ash highlight along the finger
    });
  }


  Characters.art('nethros', {
    // Tall: torso 19 long (elongated upper body), broad shoulders (shN / shF), extra long thin arms, small head under a big hood. Legs are invisible (see the top of this file).
    body: {head:{r:5.6}, torso:{len:22, w:9}, uArm:{len:12.5, w:.01}, fArm:{len:12.5, w:.01}, hand:{r:2.3},
           thigh:{len:T, w:.01}, shin:{len:SH, w:.01}, foot:{len:1, w:.01},
           headSink:3, shN:5.2, shF:-6.2, belt:.1, noRings:true, outline:'rgba(0,0,0,0)', outlineW:0},
    colors: {shirt:'#0c0c0e', limb:'#1c1c1f', far:'#121214', head:'#050506', dark:'#050506', hand:'#26262a', legs:'rgba(0,0,0,0)', legsFar:'rgba(0,0,0,0)'},

    foot(){},                                                       // no feet
    farFront: f => f.atk > 0,                                       // both hands thrust forward: draw the far arm over the body so you can see it

    // soft while he coils (heavy, ghostly), very stiff at the release (snap), medium after
    spring(p, A){
      if(A.skill === 'fallendescent') return {k:380, d:26};         // Fallen Descent: fast, dramatic dive
      if(A.skill === 'damned') return {k:160, d:18};                // Rise of the Damned: solemn invocation
      if(A.skill === 'ritual') return {k:120, d:15};                // Dread Ritual: slow, heavy, ghostly
      if(A.skill === 'gravebound') return p < (A.at || .5) ? {k:100, d:13} : {k:420, d:30};   // Gravebound Hands: slow raise, hard slam down
      if(p < C - .08) return {k:90, d:11};
      if(p < C + .1) return {k:450, d:32};
      return {k:150, d:17};
    },

    attack(tg, p, A, K){
      if(A.skill === 'damned'){   // RISE OF THE DAMNED: raises both long arms high, hood and robe flare with dark power
        const w = Math.sin(Date.now() / 1000 * 4);
        tg.aN = 2.4 + w * .06; tg.eN = .25; tg.aF = 2.1 - w * .06; tg.eF = .3; tg.lean = -.14; tg.head = -.25;
        legs(tg, HOVER + 3);
        return;
      }
      if(A.skill === 'fallendescent'){   // FALLEN DESCENT: ascent (arms sweep back), descent (wings out, diving down), impact crouch
        const f0 = A.f0 || .22, f1 = A.f1 || .42, f2 = A.f2 || .64;
        if(p < f0){   // Ascending: swept-back rocket pose
          tg.aN = -.9; tg.eN = .12; tg.aF = -1.1; tg.eF = .12; tg.lean = .35; tg.head = .25; legs(tg, HOVER + 4);
        } else if(p < f1){   // Vanished high above: tucked
          tg.aN = -.5; tg.eN = .2; tg.aF = -.5; tg.eF = .2; tg.lean = 0; tg.head = 0; legs(tg, HOVER);
        } else if(p < f2){   // Descending: fallen angel dive, hands reaching down like talons
          tg.aN = 1.6; tg.eN = .1; tg.aF = 1.4; tg.eF = .1; tg.lean = .45; tg.head = .28; legs(tg, HOVER - 2);
        } else {   // Impact crouch & recovery: low to the ground, head bowed
          const rec = clamp((p - f2) / (1 - f2), 0, 1);
          tg.aN = .4 + rec * .4; tg.eN = .6 - rec * .2; tg.aF = .2 + rec * .4; tg.eF = .7 - rec * .2;
          tg.lean = .25 - rec * .15; tg.head = .1 - rec * .2; legs(tg, HOVER - 6 + rec * 6);
        }
        return;
      }
      if(A.skill === 'ritual'){   // DREAD RITUAL: both long arms raised and spread, head tilted up, slow sway
        const w = Math.sin(Date.now() / 1000 * 2.2);
        tg.aN = 2.2 + w * .1; tg.eN = .35; tg.aF = 1.9 - w * .1; tg.eF = .4; tg.lean = -.1; tg.head = -.2;
        legs(tg, HOVER + 2 + w * 1.2);
        return;
      }
      if(A.skill === 'gravebound'){   // GRAVEBOUND HANDS: both long arms rise high and spread, head tilts up, then they sweep down and forward as the hands crawl out of the floor
        const up = p < (A.at || .5) - .04, w = Math.sin(Date.now() / 1000 * 3);
        if(up){ tg.aN = 2.5 + w * .08; tg.eN = .3; tg.aF = 2.2 - w * .08; tg.eF = .35; tg.lean = -.18; tg.head = -.3; }
        else  { tg.aN = .85; tg.eN = .15; tg.aF = .55; tg.eF = .1; tg.lean = .32; tg.head = .25; }
        legs(tg, HOVER + (up ? 3 : 0));
        return;
      }
      ['aN', 'eN', 'aF', 'eF', 'lean', 'head'].forEach(j => tg[j] = K(p, ATK[j]));
      legs(tg, K(p, ATK.Y));
    },

    // Float: almost motionless. Tiny slow bob, torso leans a little forward, head tilted down, arms hang loose and UNEVEN.
    // Moving: he glides (no steps), leans more, arms trail behind him.
    pose(tg, f, t, run, K){
      const idle = 1 - run, b = Math.sin(t * 1.3), b2 = Math.sin(t * 1.3 - .9), b3 = Math.sin(t * 1.0 + 1.4);
      tg.lean = .2 + idle * b * .012 + run * .16;
      tg.head = .2 + idle * b2 * .015 - run * .04;
      tg.aN = idle * (.5 + b2 * .035) + run * -.4;   tg.eN = .2 + idle * (.1 + b3 * .035) + run * .15;
      tg.aF = idle * (-.6 - b3 * .035) + run * -1.0;  tg.eF = .15 + idle * (.08 - b2 * .03) + run * .2;
      legs(tg, HOVER + b * .9 * FLOAT);
    },

    // ---- BEHIND the body: dark aura, smoke (his lower body), ground mist, drifting ash, the big back CLOAK (ragged strands that fade into smoke), far claw hand ----
    behind(cx, f, t, S, P){
      const white = f.flash > 0;
      const px = S.pel.x, py = S.pel.y, trail = clamp(f.vx * f.face * .05, -6, 12);   // + = moving forward, cloth + smoke trail back
      const span = SPAN + clamp(-(f.vy || 0) * .012, -5, 5);
      S._trail = trail;                                                                // torso() uses it (it has no f / t of its own)

      // thin black mist hugging the ground, drifts back with his speed (on the ground only)
      if(f.gr){
        for(let i = 0; i < 7; i++){
          const ph = t * .6 + i * 1.9, a = (.15 - i * .016) * Math.min(1, SMOKE + .2);
          cx.fillStyle = 'rgba(6,6,8,' + a + ')';
          cx.beginPath(); cx.ellipse(-2 - i * 4.6 - trail * (.4 + i * .12) + Math.sin(ph) * 2.5, -1.4 + Math.cos(ph) * .5, 7.5 - i * .5, 1.7, 0, 0, 7); cx.fill();
          if(i % 2 === 0){ cx.fillStyle = 'rgba(70,70,76,' + a * .3 + ')'; cx.beginPath(); cx.ellipse(-4 - i * 4.4 - trail * (.4 + i * .12) + Math.sin(ph) * 2.5, -2.1, 5, 1.2, 0, 0, 7); cx.fill(); }
        }
      }

      // everything below is cut at the ground line (origin = feet), so smoke and cloth never go under a platform
      cx.save(); cx.beginPath(); cx.rect(-400, -800, 800, 800.5); cx.clip();

      // faint dark aura round the whole figure
      const au = cx.createRadialGradient(px - 1, py - 14, 4, px - 1, py - 14, 36);
      au.addColorStop(0, 'rgba(0,0,0,.16)'); au.addColorStop(1, 'rgba(0,0,0,0)');
      cx.fillStyle = au; cx.fillRect(px - 42, py - 54, 84, 84);

      // lower body: a dense smoke column that fades out downward, then puffs that swirl and drift down + back
      if(SMOKE > 0){
        const g = cx.createLinearGradient(0, py, 0, py + span);
        g.addColorStop(0, 'rgba(4,4,5,.98)'); g.addColorStop(.6, 'rgba(6,6,8,.8)'); g.addColorStop(1, 'rgba(6,6,8,0)');
        const sw = Math.sin(t * 1.2) * 1.2;
        cx.beginPath(); cx.moveTo(px - 8, py - 5);
        cx.quadraticCurveTo(px - 10.4 - trail * .15, py + span * .42, px - 6.4 - trail * .8 + sw, py + span * .97);
        cx.lineTo(px + 5.2 - trail * .8 + sw, py + span * .97);
        cx.quadraticCurveTo(px + 9.6 - trail * .15, py + span * .42, px + 8, py - 5);
        cx.closePath(); cx.fillStyle = g; cx.fill();
        const N = Math.round(28 * SMOKE);
        for(let i = 0; i < N; i++){
          const k = (t * (.34 + (i % 3) * .06) + i / N) % 1, wob = Math.sin(t * 1.0 + i * 2.1);
          const r = (4.4 + Math.sin(Math.PI * k) * 3.2 - k * 1.4) * (.8 + (i % 4) * .1), x = px + wob * (2 + k * 5.5) - trail * k * k * .9 - k * 1.5, y = Math.min(py - 2 + k * (span + 2), -r - .5), a = Math.min(.9, (1 - k * .8) * .85);   // puffs shrink toward the bottom and stop just above the ground, so the column ends soft, not cut flat
          cx.fillStyle = 'rgba(8,8,10,' + a + ')'; cx.beginPath(); cx.arc(x, y, r, 0, 7); cx.fill();
          cx.strokeStyle = 'rgba(115,115,121,' + a * .5 + ')'; cx.lineWidth = .8; cx.beginPath(); cx.arc(x, y, r, .6 + wob, 2.6 + wob); cx.stroke();   // translucent charcoal-gray edge = depth + readable silhouette
          if(i % 3 === 0){ cx.fillStyle = 'rgba(52,52,58,' + a * .32 + ')'; cx.beginPath(); cx.arc(x + 1, y - 1, r * .62, 0, 7); cx.fill(); }
        }
        cx.lineCap = 'round';
        for(let i = 0; i < 4; i++){                                                                     // slow curls round the column
          const k = (t * .4 + i / 4) % 1, x = px + Math.sin(t * 1.0 + i * 1.6) * (3 + k * 5) - trail * k * k * .9, y = py + 2 + k * span * .9, a = (1 - k) * .6;
          cx.strokeStyle = 'rgba(88,88,94,' + a + ')'; cx.lineWidth = 1; cx.beginPath(); cx.arc(x, y, 2.5 + k * 3, t * 2.6 + i, t * 2.6 + i + 2); cx.stroke();
        }
      }

      // small gray ash drifting down through the air round him
      for(let i = 0; i < 14; i++){
        const k = (t * (.1 + (i % 4) * .025) + i * .137) % 1, x = px + Math.sin(i * 12.9 + t * .35) * (13 + (i % 5) * 3) - trail * k, y = py - 52 + k * 78;
        cx.fillStyle = 'rgba(170,170,176,' + (.5 * Math.sin(Math.PI * k)) + ')'; cx.fillRect(x, y, 1 + (i % 3) * .3, 1 + (i % 3) * .3);
      }

      // BACK CLOAK: the long dark tail of the robe behind him. It trails back when he moves and ends in pointed tatters that fade into the smoke.
      {
        S._farFront = f.atk > 0;                                                         // torso() / front() need this to place the far sleeve
        const sx = S.sh.x, sy = S.sh.y, hx = S.head.x, hy = S.head.y, by = py + 1, F = c => white ? '#fff' : c;
        const hem = hemPts(px - 2, by, [[-17, 7], [-14.4, 12], [-11.6, 8], [-8.6, 14], [-5.6, 9], [-2.6, 13], [.4, 8], [3.4, 12], [6.4, 8]], trail, t, 1.1, 1.6);
        const g = cx.createLinearGradient(0, sy, 0, by + 22), wf = clamp((py - sy) / (by + 22 - sy), .2, .9);
        g.addColorStop(0, '#29292d'); g.addColorStop(wf * .55, '#18181b'); g.addColorStop(wf, '#101012'); g.addColorStop(wf + (1 - wf) * .5, 'rgba(10,10,12,.5)'); g.addColorStop(1, 'rgba(10,10,12,0)');
        const gi = cx.createLinearGradient(0, sy, 0, by + 22); gi.addColorStop(0, INK); gi.addColorStop(wf, INK); gi.addColorStop(1, 'rgba(2,2,3,0)');
        const back = [[sx + 3, sy - 2.5], [hx - 4, hy + 3], [sx - 10, sy], [px - 13.5 - trail * .3, py - 6], [px - 17.5 - trail * .5, by]].concat(hem, [[px + 9, by], [sx + 7, sy + 11]]);
        poly(cx, back, F(g), white ? null : gi, .6);
        if(!white){
          cx.strokeStyle = EDGE; cx.lineWidth = .6; cx.lineCap = 'round'; cx.beginPath(); back.slice(2, 5).forEach((q, i) => i ? cx.lineTo(q[0], q[1]) : cx.moveTo(q[0], q[1])); cx.stroke();   // ash rim down the back edge
          for(let i = 0; i < 4; i++){                                                    // long folds from the shoulder toward the notches
            const q = hem[1 + i * 2];
            cx.strokeStyle = i % 2 ? DEEP : FOLD; cx.lineWidth = .7;
            cx.beginPath(); cx.moveTo(sx - 6 + i * 2.6, sy + 2); cx.quadraticCurveTo(lerp(sx - 6 + i * 2.6, q[0], .4) - 1.6, lerp(sy, q[1], .5), q[0], q[1] - 3); cx.stroke();
          }
          for(let i = 0; i < hem.length; i += 4) ribbon(cx, hem[i][0], hem[i][1] - 1, 9 + (i % 3) * 3, i * 1.7, t, trail, .5);   // some tips unravel into smoke
        }
      }
      cx.restore();

      // FALLEN ANGEL WINGS (Fallen Descent descent phase): two huge dark wings spanning out from the back (monochrome now)
      if(f.descent && f.descent.ph === 'descend'){
        cx.save();
        const wx = S.sh.x - 4, wy = S.sh.y - 6;
        for(let side = -1; side <= 1; side += 2){
          cx.beginPath();
          cx.moveTo(wx, wy);
          cx.quadraticCurveTo(wx + side * 44, wy - 38, wx + side * 58, wy - 18);
          cx.quadraticCurveTo(wx + side * 48, wy + 12, wx + side * 22, wy + 26);
          cx.quadraticCurveTo(wx + side * 12, wy + 16, wx, wy);
          cx.fillStyle = 'rgba(8,8,10,.9)'; cx.fill();
          cx.strokeStyle = 'rgba(150,150,156,.7)'; cx.lineWidth = 1.3; cx.stroke();
          // Feather wisps
          for(let k = 0; k < 5; k++){
            cx.beginPath();
            cx.moveTo(wx + side * (18 + k * 7), wy - 10 + k * 6);
            cx.lineTo(wx + side * (32 + k * 6), wy - 4 + k * 8);
            cx.strokeStyle = 'rgba(120,120,126,.55)'; cx.lineWidth = 1.1; cx.stroke();
          }
        }
        cx.restore();
      }

    },

    // ---- ON TOP: torso is drawn by torso() below. Here: sleeves, skeletal hands, the HOOD with its black void, dark energy in the hands ----
    front(cx, f, t, S, P){
      const white = f.flash > 0;
      // tell arena.js where the hands are in the world, so the soul leaves the real hands
      f.handW = {N:{x:f.x + f.face * S.aN.hand.x, y:f.y + S.aN.hand.y}, F:{x:f.x + f.face * S.aF.hand.x, y:f.y + S.aF.hand.y}};

      // sleeves: oversized, hanging, torn cuffs. The far sleeve is drawn here only while the far arm is thrust forward (otherwise torso() draws it); the hands come out of the cuffs.
      const tr = S._trail || 0;
      if(f.atk > 0){ sleeve(cx, S.aF, white, t, tr, '#242427', '#121214'); claws(cx, S.aF, white, t, false); }
      sleeve(cx, S.aN, white, t, tr, '#2e2e32', '#161618');
      claws(cx, S.aN, white, t, true);

      // ---- HOOD: a naturally draped, slightly oversized reaper hood. Soft round top, a cloth lip over the opening, folds on the sides and back, the back drape falls onto the shoulders.
      // The opening holds ABSOLUTE darkness: no eyes, no skull, no face. Only a few barely visible smoke puffs move inside. Drawn in the head's own tilted space. ----
      const h = S.head, ang = Math.atan2(h.x - S.sh.x, -(h.y - S.sh.y)), A = f.A || {};
      const p = f.atk > 0 && A.time ? clamp(1 - f.atk / A.time, 0, 1) : -1;
      cx.save(); cx.translate(h.x, h.y); cx.rotate(ang);
      const hoodPath = () => {
        cx.beginPath(); cx.moveTo(5.2, 9.2);
        cx.bezierCurveTo(8.8, 7.2, 10.6, 2.4, 9.6, -2.8);                                    // front rim, up the side of the opening
        cx.bezierCurveTo(8.6, -7.8, 4.2, -10.8, -.6, -10.8);                                 // a soft rounded top (no dome, no point)
        cx.bezierCurveTo(-5.4, -10.8, -9.6, -7.4, -10.4, -1.6);                              // down the back of the head
        cx.bezierCurveTo(-11.2, 3.8, -11.8, 9, -10.6, 12.6);                                 // cloth falls behind the neck
        cx.quadraticCurveTo(-8.4, 11.6, -7, 13.2);                                           // scalloped hem resting on the shoulders
        cx.quadraticCurveTo(-5, 11.8, -3.2, 13.6);
        cx.quadraticCurveTo(-1.2, 11.6, .8, 12.6);
        cx.quadraticCurveTo(3, 10.6, 5.2, 9.2);
        cx.closePath();
      };
      const facePath = () => {
        cx.beginPath(); cx.moveTo(3.4, -7.4);
        cx.bezierCurveTo(7, -7.2, 8.6, -3.2, 8.2, 1.2);
        cx.bezierCurveTo(7.8, 5, 5.6, 7.4, 3, 7.6);
        cx.bezierCurveTo(-.6, 6, -1.8, -1, -.4, -5);
        cx.bezierCurveTo(.2, -6.6, 1.4, -7.2, 3.4, -7.4);
        cx.closePath();
      };
      if(white){ hoodPath(); cx.fillStyle = '#fff'; cx.fill(); }
      else {
        cx.fillStyle = 'rgba(0,0,0,.4)'; cx.beginPath(); cx.ellipse(-1.4, 12.2, 9.6, 2.6, 0, 0, 7); cx.fill();   // shadow where the hood rests on the robe
        hoodPath();
        const hg = cx.createLinearGradient(-10, -10, 8, 12); hg.addColorStop(0, '#2c2c30'); hg.addColorStop(.5, '#17171a'); hg.addColorStop(1, '#0a0a0c');
        cx.fillStyle = hg; cx.fill(); cx.strokeStyle = INK; cx.lineWidth = 1.1; cx.lineJoin = 'round'; cx.stroke(); cx.strokeStyle = 'rgba(140,140,146,.34)'; cx.lineWidth = .6; cx.stroke();
        cx.lineCap = 'round';
        cx.strokeStyle = DEEP; cx.lineWidth = .9;                                           // deep draped folds running from the opening down to the hem
        cx.beginPath(); cx.moveTo(-1.8, -8.6); cx.bezierCurveTo(-7, -5.6, -9, 2, -8, 11.4); cx.stroke();
        cx.beginPath(); cx.moveTo(-4.6, -9.4); cx.bezierCurveTo(-9.2, -5, -10.6, 3, -9.6, 10.6); cx.stroke();
        cx.beginPath(); cx.moveTo(.4, 8.2); cx.bezierCurveTo(-.2, 10.2, -.6, 11.6, -1.2, 13); cx.stroke();
        cx.beginPath(); cx.moveTo(-5.2, 8); cx.bezierCurveTo(-5.4, 10, -5, 11.6, -4.2, 12.8); cx.stroke();
        cx.strokeStyle = FOLD; cx.lineWidth = .6;                                           // restrained ash highlights on selected folds only
        cx.beginPath(); cx.moveTo(-3.4, -9.8); cx.bezierCurveTo(-8, -6.4, -10, -.6, -9.2, 6.4); cx.stroke();
        cx.beginPath(); cx.moveTo(1, -9.8); cx.bezierCurveTo(5.6, -9.2, 8.6, -6.6, 9.4, -3); cx.stroke();
        cx.beginPath(); cx.moveTo(-6.6, 7.6); cx.bezierCurveTo(-6.8, 9.6, -6.4, 11.2, -5.6, 12.2); cx.stroke();
        // the opening: absolute black, no features at all
        facePath(); cx.fillStyle = '#000'; cx.fill();
        cx.save(); facePath(); cx.clip();
        for(let i = 0; i < 4; i++){                                                         // extremely subtle black smoke moving in the void
          const x = 3 + Math.sin(t * .45 + i * 1.9) * 3.4, y = -2 + Math.cos(t * .38 + i * 2.6) * 4.6, r = 3.6 + (i % 2) * 1.4;
          const sg = cx.createRadialGradient(x, y, 0, x, y, r); sg.addColorStop(0, 'rgba(30,30,33,.12)'); sg.addColorStop(1, 'rgba(30,30,33,0)');
          cx.fillStyle = sg; cx.fillRect(x - r, y - r, r * 2, r * 2);
        }
        cx.restore();
        facePath(); cx.strokeStyle = 'rgba(0,0,0,.9)'; cx.lineWidth = 1.2; cx.lineJoin = 'round'; cx.stroke();      // dark cloth lip around the void
        cx.strokeStyle = 'rgba(120,120,126,.34)'; cx.lineWidth = .5; cx.beginPath(); cx.moveTo(3.4, -7.4); cx.bezierCurveTo(7, -7.2, 8.6, -3.2, 8.2, 1.2); cx.stroke();   // one thin ash highlight on the outer lip only
      }
      cx.restore();

      if(white) return;

      // ---- DARK ENERGY: concentrated darkness, not glowing magic. Core = nearly absolute black, smoke = black / charcoal, edges = subtle ash gray, particles = faint ash. Source = both hands only. ----
      const hs = [S.aN.hand, S.aF.hand];
      if(f.atk > 0 && A.time && A.skill !== 'ritual'){
        if(p < C){                                             // COIL: ash motes spiral in, a black core with a thin ash edge grows in each palm, charcoal wisps curl round the fingers
          const k = clamp(p / C, 0, 1);
          hs.forEach((hd, hi) => {
            for(let i = 0; i < 9; i++){
              const a = t * 7 + i * .7 + hi * 2, r = (1 - k) * 20 + 3.5;
              cx.fillStyle = (i % 2 ? 'rgba(165,165,171,' : 'rgba(14,14,17,') + (.25 + .55 * k) + ')';
              cx.beginPath(); cx.arc(hd.x + Math.cos(a) * r, hd.y + Math.sin(a) * r * .75, 1 + k * 1.1, 0, 7); cx.fill();
            }
            cx.strokeStyle = 'rgba(70,70,76,' + (.4 + .5 * k) + ')'; cx.lineWidth = 1; cx.lineCap = 'round';
            for(let i = 0; i < 3; i++){ const a = t * 5 + i * 2.1 + hi; cx.beginPath(); cx.arc(hd.x, hd.y, 5 + k * 4 + i * 1.5, a, a + 1.3); cx.stroke(); }
            const gl = cx.createRadialGradient(hd.x, hd.y, 1, hd.x, hd.y, 10 + 8 * k);
            gl.addColorStop(0, 'rgba(0,0,0,' + (.5 + .3 * k) + ')'); gl.addColorStop(1, 'rgba(0,0,0,0)');
            cx.fillStyle = gl; cx.beginPath(); cx.arc(hd.x, hd.y, 10 + 8 * k, 0, 7); cx.fill();
            cx.fillStyle = '#010102'; cx.beginPath(); cx.arc(hd.x, hd.y, 1.8 + k * 4.2, 0, 7); cx.fill();
            cx.strokeStyle = 'rgba(165,165,171,' + (.35 + .45 * k) + ')'; cx.lineWidth = 1; cx.stroke();                  // thin ash edge keeps the core readable
          });
        } else if(p < C + .16){                                // RELEASE: a ring of ash + black shards where the soul left
          const k = (p - C) / .16, mx = (hs[0].x + hs[1].x) / 2, my = (hs[0].y + hs[1].y) / 2;
          cx.strokeStyle = 'rgba(170,170,176,' + (.8 * (1 - k)) + ')'; cx.lineWidth = 2 * (1 - k) + .5;
          cx.beginPath(); cx.arc(mx + 4, my, 5 + k * 22, 0, 7); cx.stroke();
          for(let i = 0; i < 7; i++){ const a = i * .9 + .2; cx.fillStyle = (i % 2 ? 'rgba(6,6,8,' : 'rgba(165,165,171,') + (1 - k) + ')'; cx.fillRect(mx + 4 + Math.cos(a) * (6 + k * 20), my + Math.sin(a) * (6 + k * 20), 2.2, 2.2); }
        }
      } else {
        hs.forEach((hd, hi) => {                               // idle: thin black / charcoal smoke leaks off the fingertips
          for(let i = 0; i < 3; i++){
            const k = (t * .5 + i / 3 + hi * .4) % 1;
            cx.fillStyle = 'rgba(46,46,51,' + (.42 * (1 - k)) + ')';
            cx.beginPath(); cx.arc(hd.x + Math.sin(t * 1.6 + i * 2 + hi) * 2.5, hd.y + 5 - k * 10, 1 + k * 1.2, 0, 7); cx.fill();
          }
        });
      }
    },

    // ---- TORSO (called by body.js instead of the plain capsule): the tattered reaper ROBE. Solid and structured from the shoulders down to the waist, broad at the shoulders, narrower at the waist,
    // the chest fully covered (no opening, no ribs). Below the waist the cloth turns unstable: it flares into pointed tatters, fades out (translucent) and each tatter unravels into a smoke ribbon, so the robe
    // melts into the smoke column drawn in behind(). A lighter layered front drape and a shoulder capelet sit on top, the far sleeve hangs from the shoulder. Everything below the waist is cut at the ground line. ----
    torso(cx, S, B, P, white){
      const a = S.pel, b = S.sh, dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, fx = -uy, fy = ux;   // u = up the torso, f = forward
      const pt = (s, w) => [a.x + ux * L * s + fx * w, a.y + uy * L * s + fy * w];   // s = 0 (waist) .. 1 (shoulders), w = + forward / - back
      const Q = (arr, k) => arr.map(q => pt(q[0], q[1] * (k || 1)));
      const tt = Date.now() / 1000, tr = S._trail || 0;
      const line = (p0, p1, bend, col, lw) => {                                       // one fold line on the cloth
        cx.strokeStyle = col; cx.lineWidth = lw || .6; cx.lineCap = 'round'; cx.beginPath(); cx.moveTo(p0[0], p0[1]);
        cx.quadraticCurveTo((p0[0] + p1[0]) / 2 + bend, (p0[1] + p1[1]) / 2, p1[0], p1[1]); cx.stroke();
      };
      if(!S._farFront){ sleeve(cx, S.aF, white, tt, tr, '#242427', '#121214'); claws(cx, S.aF, white, tt, false); }   // REAR arm: sleeve + hand, drawn after the back cloak so it shows behind his body (under the robe)

      const c0 = pt(-.05, 0), by = a.y + 2, gy0 = b.y, gy1 = a.y + 24, wf = clamp((a.y - gy0) / (gy1 - gy0), .2, .9);
      const fade = (c1, c2, c3) => { const g = cx.createLinearGradient(0, gy0, 0, gy1); g.addColorStop(0, c1); g.addColorStop(wf * .5, c2); g.addColorStop(wf, c3); g.addColorStop(wf + (1 - wf) * .45, c3.replace(/rgb\((.*)\)/, 'rgba($1,.5)')); g.addColorStop(1, c3.replace(/rgb\((.*)\)/, 'rgba($1,0)')); return g; };
      const hem = hemPts(c0[0], by, [[-13, 8], [-10.4, 13], [-7.8, 7], [-5, 14], [-2.2, 8], [.6, 13.5], [3.2, 7.5], [6, 13], [8.8, 8], [11.6, 11.5]], tr, tt, .8);
      const under = hemPts(c0[0], by, [[-11, 11], [-8.4, 17], [-5.8, 10], [-3, 17.5], [-.2, 11], [2.6, 17], [5.2, 10.5], [7.8, 16], [10.4, 11]], tr, tt, 1);
      const Sb = pt(1.0, -10.4), Mb = pt(.5, -8.6), Wb = [c0[0] - 6.2 - tr * .2, a.y + 1], Wf = [c0[0] + 6, a.y + 1], Mf = pt(.5, 7.2), Sf = pt(1.0, 9), Nf = pt(1.1, 4), Nb = pt(1.1, -4);
      const robePath = () => {
        cx.beginPath(); cx.moveTo(Nb[0], Nb[1]); cx.lineTo(Sb[0], Sb[1]); cx.quadraticCurveTo(Mb[0], Mb[1], Wb[0], Wb[1]);
        hem.forEach(q => cx.lineTo(q[0], q[1])); cx.lineTo(Wf[0], Wf[1]); cx.quadraticCurveTo(Mf[0], Mf[1], Sf[0], Sf[1]); cx.lineTo(Nf[0], Nf[1]); cx.closePath();
      };
      const drape = [pt(.9, 1.5), pt(.52, 8.2), [c0[0] + 9.6, a.y + 1]].concat(hemPts(c0[0], by, [[9.6, 9], [7.4, 13], [5.2, 8], [3, 12.5], [.8, 8.5]], tr, tt, .8), [pt(.45, 1.2)]);
      const cape = Q([[1.12,-3],[1.03,-9.4],[.84,-10.8],[.66,-9.2],[.76,-7.6],[.56,-6.4],[.68,-4.6],[.54,-3.2],[.66,-1.4],[.52,.2],[.66,2],[.54,3.6],[.68,5.2],[.56,6.8],[.72,8.2],[.56,9.8],[.88,10.6],[1.03,9],[1.12,3.2]], 1.32);

      if(white){ poly(cx, under, '#fff'); robePath(); cx.fillStyle = '#fff'; cx.fill(); poly(cx, drape, '#fff'); poly(cx, cape, '#fff'); return; }

      cx.save(); cx.beginPath(); cx.rect(-400, -800, 800, 800.5); cx.clip();           // nothing under the ground line

      // darker under-layer: shows between the tatters and gives the hem depth
      poly(cx, [[c0[0] - 9, a.y], [c0[0] + 9, a.y]].concat(under.slice().reverse()), fade('#0a0a0b', '#0a0a0b', 'rgb(8,8,9)'), null);

      // the robe: ONE continuous cloak, charcoal at the shoulders, matte black at the waist, then translucent tatters that dissolve into smoke
      const g = fade('#2d2d31', '#1b1b1e', 'rgb(16,16,18)');
      robePath(); cx.fillStyle = g; cx.fill();
      const gs = cx.createLinearGradient(0, gy0, 0, gy1); gs.addColorStop(0, INK); gs.addColorStop(wf, INK); gs.addColorStop(1, 'rgba(2,2,3,0)');
      cx.strokeStyle = gs; cx.lineWidth = .7; cx.lineJoin = 'round'; cx.stroke();
      const ge = cx.createLinearGradient(0, gy0, 0, gy1); ge.addColorStop(0, 'rgba(150,150,156,.4)'); ge.addColorStop(wf, 'rgba(150,150,156,.3)'); ge.addColorStop(1, 'rgba(150,150,156,0)');
      cx.strokeStyle = ge; cx.lineWidth = .55; cx.beginPath(); hem.forEach((q, i) => i ? cx.lineTo(q[0], q[1]) : cx.moveTo(q[0], q[1])); cx.stroke();   // ash rim along the torn hem (fades with it)
      for(let i = 0; i < 6; i++){                                                    // deep drape folds from the chest and waist down into the notches
        const q = hem[1 + i * 2] || hem[hem.length - 2], w0 = -5.4 + i * 2.2;
        line(pt(.62, w0 * 1.25), [q[0], lerp(a.y + 2, q[1], .55)], (i % 2 ? 1 : -1) * 1.3, i % 2 ? DEEP : FOLD, .7);
      }

      // tatters unravel into smoke ribbons
      for(let i = 0; i < under.length; i += 2) ribbon(cx, under[i][0], under[i][1] - 1, 10 + (i % 3) * 2.5, i * 1.3 + 2, tt, tr, .62);
      for(let i = 0; i < hem.length; i += 4) ribbon(cx, hem[i][0], hem[i][1] - 1, 8 + (i % 3) * 2, i * 2.1, tt, tr, .5);

      // layered front drape: a second, lighter layer of cloth hanging over the front of the robe, shorter, with its own torn hem that fades out too
      poly(cx, drape, fade('#323236', '#232326', 'rgb(20,20,23)'), null);
      cx.strokeStyle = gs; cx.lineWidth = .6; cx.beginPath(); drape.forEach((q, i) => i ? cx.lineTo(q[0], q[1]) : cx.moveTo(q[0], q[1])); cx.stroke();
      line(pt(.82, 3.4), [c0[0] + 6.6, a.y + 9], 1, DEEP, .7); line(pt(.7, 7), [c0[0] + 9, a.y + 8], -1, FOLD, .6);
      cx.strokeStyle = ge; cx.lineWidth = .5; cx.beginPath(); drape.slice(2, drape.length - 1).forEach((q, i) => i ? cx.lineTo(q[0], q[1]) : cx.moveTo(q[0], q[1])); cx.stroke();
      cx.restore();

      // shoulder capelet with pointed tatters, naturally draped over the shoulders (the hood rests on it)
      const cg = cx.createLinearGradient(b.x, b.y, a.x, a.y + 6); cg.addColorStop(0, '#3a3a3f'); cg.addColorStop(1, '#1d1d20');
      poly(cx, cape, cg, INK, .7);
      cx.strokeStyle = EDGE; cx.lineWidth = .6; cx.lineCap = 'round';
      [[0, 3], [15, 18]].forEach(([i0, i1]) => { cx.beginPath(); cape.slice(i0, i1).forEach((q, i) => i ? cx.lineTo(q[0], q[1]) : cx.moveTo(q[0], q[1])); cx.stroke(); });
      line(pt(1.06, -7), pt(.6, -8.6), .6, DEEP, .7); line(pt(1.06, -1.8), pt(.58, -2.6), -.5, DEEP, .7); line(pt(1.06, 2.8), pt(.58, 3.4), .5, DEEP, .7); line(pt(1.06, 7), pt(.62, 8.4), -.6, DEEP, .7);
    },

    // ---- DREAD RITUAL aura (arena.js calls fxBack under the bodies): DARK SMOKE around him, no colour, no ring. f.rit.r = how wide it is now, f.rit.a = 0..1 strength (fades in / out).
    // Soft black puffs are born around him, curl slowly upward and fade out. They stay on him (offsets from his body). While he stands on a platform the smoke is cut at his feet:
    // it hugs his sides and the top and never goes under the platform. In the air it is all around him. TUNE: puffs per second (rate), puff size (sz), darkness (al). ----
    fxBack(cx, f, t){
      const R = f.rit; if(!R) return;
      const x = f.x, y = f.y - f.h / 2, r = R.r, al = R.a == null ? 1 : R.a;
      const dt = R.lt == null ? 0 : Math.min(.05, Math.max(0, t - R.lt)); R.lt = t;
      const P = R.sm || (R.sm = []), floor = f.gr ? f.y : Infinity;
      const rate = 26 + 120 * (r / 190) * (r / 190);                                                    // a wider aura = more puffs, so the density stays the same
      R.acc = (R.acc || 0) + dt * rate;
      while(R.acc >= 1){ R.acc--;
        const a = Math.random() * 6.283, d = Math.sqrt(Math.random()) * r * .92, px = Math.cos(a) * d, py = Math.sin(a) * d * .85 - r * .06;
        if(y + py > floor - 6) continue;                                                                // never born under the platform
        P.push({x:px, y:py, vx:(Math.random() - .5) * 18, vy:-14 - Math.random() * 30, life:0, max:1.6 + Math.random() * 1.4, sz:(.16 + Math.random() * .16) * r + 8, rot:Math.random() * 6.283, vr:(Math.random() - .5) * .8, sd:Math.random() * 9});
      }
      for(let i = P.length - 1; i >= 0; i--){
        const q = P[i]; q.life += dt; if(q.life >= q.max){ P.splice(i, 1); continue; }
        q.x += (q.vx + Math.sin(t * 1.3 + q.sd) * 14) * dt; q.y += q.vy * dt; q.rot += q.vr * dt;      // a slow sideways curl while it rises
      }
      const spr = getSmoke();                                                                           // one soft black puff, drawn once and reused
      cx.save();
      if(f.gr){ cx.beginPath(); cx.rect(x - r * 2, y - r * 2, r * 4, floor - (y - r * 2)); cx.clip(); }   // on a platform: only above his feet
      const hz = cx.createRadialGradient(x, y, 4, x, y, r * .7);                                         // a dark haze hugging his body, so he reads as sitting inside the smoke
      hz.addColorStop(0, 'rgba(3,3,4,' + (.5 * al) + ')'); hz.addColorStop(1, 'rgba(3,3,4,0)');
      cx.fillStyle = hz; cx.fillRect(x - r, y - r, r * 2, r * 2);
      P.forEach(q => {
        const k = q.life / q.max, d = Math.hypot(q.x, q.y) / r;
        const a = Math.sin(Math.PI * k) * .5 * al * Math.max(0, 1 - d * d * .8);                          // fades in, fades out, thinner towards the edge
        if(a <= .01) return;
        const s = q.sz * (1 + k * .8);                                                                    // puffs swell as they thin out
        cx.globalAlpha = Math.min(1, a); cx.save(); cx.translate(x + q.x, y + q.y); cx.rotate(q.rot); cx.drawImage(spr, -s, -s, s * 2, s * 2); cx.restore();
      });
      cx.globalAlpha = 1; cx.restore();
    },

    // ---- GRAVEBOUND HANDS (arena.js calls this on top of the fighters; H = {dir, y (floor), cl:[{x, rise 0..1, w, hands:[{ox, oy, sz, sd}]}]}). Pitch-black demonic hands: a thin forearm out of the floor,
    // a small palm and five long clawing fingers that open and close as they crawl. Clipped at the floor line so they really come out of the ground / sink back into it. Monochrome. ----
    gbHands(cx, H, t){
      const dir = H.dir, Y = H.y, spr = getSmoke();
      cx.beginPath(); cx.rect(-4000, -4000, 9000, 4000 + Y + 2); cx.clip();                     // nothing under the floor
      cx.lineCap = 'round'; cx.lineJoin = 'round';
      H.cl.forEach(c => {
        if(c.rise <= 0.01) return;
        const e = 1 - Math.pow(1 - c.rise, 3);
        cx.fillStyle = 'rgba(0,0,0,' + (.4 * e) + ')'; cx.beginPath(); cx.ellipse(c.x, Y, c.w * .8, 4.5, 0, 0, 7); cx.fill();   // dark stain on the floor
        for(let i = 0; i < 2; i++){                                                              // black smoke at the base
          const ph = t * .9 + c.x * .05 + i * 3, s = 15 + 7 * Math.sin(ph * 1.7);
          cx.globalAlpha = .22 + .35 * Math.sin(Math.PI * Math.min(1, c.rise)); cx.drawImage(spr, c.x - s + Math.sin(ph) * 9, Y - s * 1.1 - 4 - i * 6, s * 2, s * 2);
        }
        cx.globalAlpha = 1;
        c.hands.slice().sort((a, b) => a.oy - b.oy).forEach(h => {
          const sz = h.sz, ph = t * 5.4 + h.sd, lunge = Math.sin(ph), bx = c.x + h.ox, by = Y + 5 + h.oy * .4;
          const hh = (22 + 6 * Math.sin(ph * .5 + 1)) * sz * e, wx = bx + dir * (8 + 4 * lunge) * sz, wy = by - hh;
          cx.strokeStyle = '#060607'; cx.lineWidth = 5.2 * sz; cx.beginPath(); cx.moveTo(bx, by + 6); cx.quadraticCurveTo(bx - dir * 3, by - hh * .55, wx, wy); cx.stroke();      // forearm
          cx.strokeStyle = 'rgba(130,130,136,.34)'; cx.lineWidth = .7; cx.beginPath(); cx.moveTo(bx - dir * 1.4, by + 6); cx.quadraticCurveTo(bx - dir * 4.4, by - hh * .55, wx - dir * 1.4, wy - 1); cx.stroke();
          cx.save(); cx.translate(wx, wy); cx.scale(dir, 1);
          cx.rotate(-.25 + lunge * .18);
          cx.fillStyle = '#0a0a0b'; cx.beginPath(); cx.ellipse(1, -1, 4.6 * sz, 3.6 * sz, -.5, 0, 7); cx.fill();                                              // palm
          for(let i = 0; i < 5; i++){
            const open = .5 + .5 * Math.sin(ph + i * .55), a0 = i === 4 ? .5 : -1.55 + i * .36, curl = (.25 + .6 * open) * (i === 4 ? .6 : 1);   // the thumb is the last one
            const L1 = (i === 4 ? 4 : 6.4) * sz, L2 = (i === 4 ? 3.4 : 5.8) * sz, L3 = 3.6 * sz;
            const x1 = Math.cos(a0) * L1, y1 = Math.sin(a0) * L1, a1 = a0 + curl * 1.05, x2 = x1 + Math.cos(a1) * L2, y2 = y1 + Math.sin(a1) * L2, a2 = a1 + curl * .95, x3 = x2 + Math.cos(a2) * L3, y3 = y2 + Math.sin(a2) * L3;
            cx.strokeStyle = '#060607'; cx.lineWidth = 1.9 * sz; cx.beginPath(); cx.moveTo(1, -2); cx.lineTo(x1, y1 - 1); cx.lineTo(x2, y2 - 1); cx.stroke();
            cx.strokeStyle = 'rgba(190,190,195,.75)'; cx.lineWidth = 1.05 * sz; cx.beginPath(); cx.moveTo(x2, y2 - 1); cx.lineTo(x3, y3 - 1); cx.stroke();        // pale claw tip
          }
          cx.restore();
        });
      });
    },

    // ---- the flying DARK SOUL (arena.js calls this; s = {x, y, r, vx, age, kind}). kind 0/1 small, 2 big. Concentrated darkness: nearly black core, charcoal smoke trail, thin ash edge, faint ash motes. No colour, no eyes. ----
    shot(cx, s, t){
      const d = s.vx > 0 ? 1 : -1, x = s.x, y = s.y, r = s.r * (1 + Math.sin(s.age * 16) * .06), big = s.kind >= 2;
      cx.save(); cx.translate(x, y); cx.scale(d, 1); cx.translate(-x, -y);       // draw everything as if flying right
      for(let i = 0; i < 12; i++){                                                // smoky trail: translucent charcoal puffs that wave and fade
        const k = i / 12, px = x - k * r * (big ? 8 : 6.5), py = y + Math.sin(s.age * 14 + i * .9) * r * .55 * k, pr = r * (.95 - .6 * k), a = .6 * (1 - k);
        cx.fillStyle = 'rgba(22,22,26,' + a + ')'; cx.beginPath(); cx.arc(px, py, pr, 0, 7); cx.fill();
        if(i % 2 === 0){ cx.fillStyle = 'rgba(96,96,102,' + a * .34 + ')'; cx.beginPath(); cx.arc(px + 1, py - 1, pr * .55, 0, 7); cx.fill(); }
      }
      const gl = cx.createRadialGradient(x, y, r * .4, x, y, r * 2.4);            // a dark halo (darkness, not light) with a faint ash fringe so it stays readable
      gl.addColorStop(0, 'rgba(0,0,0,.55)'); gl.addColorStop(.7, 'rgba(0,0,0,.14)'); gl.addColorStop(1, 'rgba(120,120,126,0)');
      cx.fillStyle = gl; cx.beginPath(); cx.arc(x, y, r * 2.4, 0, 7); cx.fill();
      cx.fillStyle = '#010102'; cx.beginPath(); cx.arc(x, y, r, 0, 7); cx.fill();   // nearly absolute black core
      cx.shadowColor = 'rgba(170,170,176,.55)'; cx.shadowBlur = big ? 9 : 6; cx.strokeStyle = 'rgba(170,170,176,.75)'; cx.lineWidth = big ? 1.9 : 1.3; cx.stroke(); cx.shadowBlur = 0;   // subtle ash outline
      cx.strokeStyle = 'rgba(96,96,102,.5)'; cx.lineWidth = 1;                       // slow swirl inside the core
      for(let i = 0; i < 3; i++){ const a = s.age * 6 + i * 2.1; cx.beginPath(); cx.arc(x, y, r * (.45 + i * .15), a, a + 1.4); cx.stroke(); }
      for(let i = 0; i < (big ? 6 : 3); i++){                                       // orbiting ash motes
        const a = s.age * 9 + i * (6.283 / (big ? 6 : 3));
        cx.fillStyle = 'rgba(175,175,181,.75)'; cx.beginPath(); cx.arc(x + Math.cos(a) * r * 1.5, y + Math.sin(a) * r * 1.15, big ? 1.7 : 1.1, 0, 7); cx.fill();
      }
      cx.restore();
    }
  });
})();