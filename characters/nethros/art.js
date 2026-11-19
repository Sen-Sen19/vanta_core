// NETHROS art - "The Eternal Dread". A faceless hooded wraith. NO LEGS: the ragdoll ends at the waist and black smoke is his lower body.
// Same shared ragdoll (body.js): only sizes, colors, poses and drawing hooks. Nothing in arena.js / body.js / main.js is changed.
//
// LOOK
//   Head      small, faceless, under a natural draped reaper HOOD: low round top, soft back drape that rests on the shoulders, a clear face opening with a cloth rim.
//             Deep black inside, only two glowing crimson eyes. Tilted down.
//   Torso     thin skeleton under the SHROUD. The cloth covers him; one small torn gap shows the hollow chest and a few ribs. Nothing glows there.
//   Arms      extra long, thin forearms. Small skeletal hands (small palm, long thin fingers, slightly curled). They hang loose and uneven.
//   Cloth     Tattered Shroud, a long flowing dementor-style robe (charcoal + dark violet, muted purple-grey rim light and folds): back cloak with a long trailing tail,
//               one continuous robe ending in long pointed tatters just above the ground (darker under-layer between them), a lighter front drape, a shoulder
//               capelet, and long sleeves with torn cuffs (the hands come out of them). Palette constants (CH1..VI2, EDGE, FOLD, INK) are at the top of the helpers.
//   Lower     the waist dissolves into swirling smoke (this IS his lower body, not an effect on top of legs). Shadow mist on the ground.
//   Float     hovers about 20-30 cm (about 6 px) above the ground, slow vertical bob, leans forward.
//
// HOW THE LEGS ARE HIDDEN (read this before changing the body sizes)
//   The ragdoll always has legs. Here they are invisible: width .01, transparent color, no outline, no foot, and pose() holds them still.
//   They only decide how high the waist floats (T + SH = leg length, HOVER = how much of it is used). Because of this, `outline` is
//   transparent for the WHOLE body (the arms and head have no dark outline). Do not change outline / outlineW / thigh.w / shin.w.
//
// ATTACK = DARK SOUL (ranged). Both hands make the energy. Nothing comes out of the chest.
//   Hands pull a little back and gather black-purple energy (COIL), then both hands thrust forward (RELEASE) and the soul leaves.
//   When you wire skills.js: basic: {hitFrom:0, hitTo:0, shot:{p:.5, hand:'B', r:..., speed:..., life:...}}  <- shot.p MUST equal C below (.5), hand 'B'.
//   shot(cx, s, t) at the bottom draws the flying soul. A combo of 3 uses the same cast (A.step only changes the soul size).
//
// SETTINGS: FLOAT = bob amount (0 = none)   SMOKE = how much smoke (0 = none, 1 = default, 2 = a lot)
(() => {
  const FLOAT = 1, SMOKE = 1;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const C = .5;                                    // moment the soul leaves the hands = shot.p in skills.js
  const T = 13, SH = 12.5;                         // invisible thigh + shin (must match body below)
  const HOVER = 23.5;                              // waist height above the ground (px). The smoke fills the space under it.
  const SPAN = 17;                                 // smoke length below the waist (ends about 6 px above the ground)
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


  // cloth palette: charcoal + dark violet bodies, muted purple-grey only for edge light and folds (kept subtle so the cloth reads as cloth, not glow)
  const CH1 = '#1d1925', CH2 = '#2c2735', CH3 = '#3a3446', VI1 = '#221336', VI2 = '#362156', EDGE = 'rgba(150,136,182,.5)', INK = 'rgba(5,2,10,.9)', FOLD = 'rgba(150,136,182,.34)', DEEP = 'rgba(4,2,8,.55)';

  // one torn cloth strip hanging from (x, y): a flat ribbon with a jagged torn tip. It sways and trails back when he moves.
  // fill = cloth, edge = rim light, hi = centre fold line. (white = hit flash: pass '#fff' and null)
  function rag(cx, x, y, len, w, ph, bend, fill, edge, hi, t){
    const n = 6, L = [], R = [], C = []; let ex = x, ey = y, ww = w;
    for(let i = 0; i <= n; i++){
      const k = i / n;
      ex = x + bend * k * k + Math.sin(ph + t * 1.8 + k * 2.4) * (.4 + 1.5 * k); ey = y + len * k; ww = w * (1 - .38 * k);
      L.push([ex - ww, ey]); R.push([ex + ww * (.85 + .25 * Math.sin(i * 2.3 + ph)), ey]); C.push([ex, ey]);
    }
    const j = Math.abs(Math.sin(ph * 12.9));                                              // torn tip, different on every strip
    const tip = [[ex - ww, ey + 1.2 + j * 2], [ex - ww * .35, ey + .3], [ex + ww * .2, ey + 3 - j * 1.3], [ex + ww * .95, ey + .9 + j]];
    poly(cx, L.concat(tip, R.reverse()), fill, edge ? INK : null, .5);
    if(edge){ cx.strokeStyle = edge; cx.lineWidth = .5; cx.lineCap = 'round'; cx.beginPath(); L.slice(0, 6).forEach((q, i) => i ? cx.lineTo(q[0], q[1]) : cx.moveTo(q[0], q[1])); cx.stroke(); }   // rim light on the left edge only
    if(hi){ cx.strokeStyle = hi; cx.lineWidth = .5; cx.lineCap = 'round'; cx.beginPath(); C.slice(1, 5).forEach((q, i) => i ? cx.lineTo(q[0], q[1]) : cx.moveTo(q[0], q[1])); cx.stroke(); }
  }

  // ragged hem: a left-to-right list of long pointed tatters with shorter notches between them. tips = [[dx, length], ...] measured from (bx, by).
  // Long tatters trail back more when he moves (tr) and sway slowly. Returns the polyline of the hem.
  function hemPts(bx, by, tips, tr, t, sway){
    const o = [], X = (dx, len, i) => bx + dx - tr * (len / 19) * .9 + Math.sin(t * 1.7 + i * 1.3) * (len / 19) * 1.5 * sway;
    tips.forEach(([dx, len], i) => {
      const x = X(dx, len, i);
      if(i){ const [pd, pl] = tips[i - 1]; o.push([(X(pd, pl, i - 1) + x) / 2 + (i % 2 ? .6 : -.6), by + Math.min(len, pl) * .52 + (i % 3) * .8]); }
      o.push([x, by + len]);
    });
    return o;
  }

  // a long flowing SLEEVE over one arm (A = {s, el, hand}): narrow at the shoulder, flaring to a wide torn cuff just before the wrist. The hand comes out of it.
  function sleeve(cx, A, white, t, tr, c0, c1){
    const s = A.s, e = A.el, h = A.hand, d1 = Math.hypot(e.x - s.x, e.y - s.y) || 1, d2 = Math.hypot(h.x - e.x, h.y - e.y) || 1;
    const vx = (e.x - s.x) / d1, vy = (e.y - s.y) / d1, ux = (h.x - e.x) / d2, uy = (h.y - e.y) / d2;
    const wr = {x: h.x - ux * 2.4, y: h.y - uy * 2.4}, n1 = [-vy, vx], n2 = [-uy, ux];
    let nm = [n1[0] + n2[0], n1[1] + n2[1]]; const nl = Math.hypot(nm[0], nm[1]) || 1; nm = [nm[0] / nl, nm[1] / nl];
    const w0 = 2.6, w1 = 3.4, w2 = 4.8;
    const L = [[s.x + n1[0] * w0, s.y + n1[1] * w0], [e.x + nm[0] * w1, e.y + nm[1] * w1], [wr.x + n2[0] * w2, wr.y + n2[1] * w2]];
    const R = [[s.x - n1[0] * w0, s.y - n1[1] * w0], [e.x - nm[0] * w1, e.y - nm[1] * w1], [wr.x - n2[0] * w2, wr.y - n2[1] * w2]];
    const cuff = [], ln = [1.2, 6.4, 1.6, 5, 1.2];                                       // torn cuff: two long tatters, notches between
    ln.forEach((len, i) => {
      const k = i / 4, x = L[2][0] + (R[2][0] - L[2][0]) * k, y = L[2][1] + (R[2][1] - L[2][1]) * k, sw = Math.sin(t * 2 + i * 1.7) * .5;
      cuff.push([x + ux * len * .6 + sw - tr * .04 * len, y + uy * len * .6 + len * .75]);
    });
    const pts = [[s.x - vx * 2, s.y - vy * 2]].concat(L, cuff, R.reverse());
    let fill = '#fff';
    if(!white){ fill = cx.createLinearGradient(s.x, s.y, wr.x, wr.y); fill.addColorStop(0, c0); fill.addColorStop(1, c1); }
    poly(cx, pts, fill, white ? null : INK, .6);
    if(white) return;
    cx.lineCap = 'round';
    cx.strokeStyle = EDGE; cx.lineWidth = .5; cx.beginPath(); L.forEach((q, i) => i ? cx.lineTo(q[0], q[1]) : cx.moveTo(q[0], q[1])); cx.stroke();   // rim light on the upper edge
    cx.strokeStyle = DEEP; cx.lineWidth = .7; cx.beginPath(); cx.moveTo(s.x, s.y); cx.quadraticCurveTo(e.x + nm[0] * .6, e.y + nm[1] * .6, wr.x, wr.y); cx.stroke();   // centre fold
    cx.strokeStyle = FOLD; cx.lineWidth = .5; cx.beginPath(); cx.moveTo(e.x + nm[0] * 1.6, e.y + nm[1] * 1.6); cx.lineTo(wr.x + n2[0] * 2.8, wr.y + n2[1] * 2.8); cx.stroke();
  }

  const lin2 = (cx, c0, y0, a, b) => { const g = cx.createLinearGradient(0, y0 - 12, 0, y0 + 19); g.addColorStop(0, a); g.addColorStop(1, b); return g; };

  // ---- a skeletal hand: SMALL palm + 4 long thin fingers (slightly curled in) + thumb. A = arm points {el, hand}. About 28% smaller than before. ----
  function claws(cx, A, white, t, near){
    const h = A.hand, e = A.el, th = Math.atan2(h.y - e.y, h.x - e.x);
    const curl = -.62 * Math.tanh(Math.sin(th) * 4);          // fingers curl in toward the palm side; straight when the arm points sideways
    cx.fillStyle = white ? '#fff' : '#1a0f2b'; cx.strokeStyle = '#4a2f73'; cx.lineWidth = .6;
    cx.beginPath(); cx.ellipse(h.x + Math.cos(th) * .9, h.y + Math.sin(th) * .9, 2.6, 2.1, th, 0, 7); cx.fill(); if(!white) cx.stroke();
    const F = [[-.62, 5.2, 1], [-.22, 7.4, 1.05], [.2, 7.8, 1.05], [.58, 6.2, 1], [1.5, 4, .85]];   // [angle offset, length, width]; the last one is the thumb
    F.forEach(([off, len, w], i) => {
      const thumb = i === 4, a0 = th + off * .9 + Math.sin(t * 1.8 + i * 1.7 + (near ? 0 : 2)) * .04, sg = thumb ? -1.3 : 1;
      let x = h.x + Math.cos(a0) * 1.7, y = h.y + Math.sin(a0) * 1.7;
      const P = [[x, y]], N = [[-Math.sin(a0), Math.cos(a0)]], wd = [.78 * w, .6 * w, .4 * w, .04];
      for(let k = 0; k < 3; k++){
        const a = a0 + curl * sg * (k + 1) / 3 * (thumb ? .8 : 1.15);
        x += Math.cos(a) * len / 3; y += Math.sin(a) * len / 3;
        P.push([x, y]); N.push([-Math.sin(a), Math.cos(a)]);
      }
      const L = P.map((q, k) => [q[0] + N[k][0] * wd[k], q[1] + N[k][1] * wd[k]]), R = P.map((q, k) => [q[0] - N[k][0] * wd[k], q[1] - N[k][1] * wd[k]]).reverse();
      poly(cx, L.concat(R), white ? '#fff' : '#171026', white ? null : '#563a80', .45);
      if(!white){ cx.strokeStyle = '#cbbfe2'; cx.lineWidth = .6; cx.lineCap = 'round'; cx.beginPath(); cx.moveTo(P[2][0], P[2][1]); cx.lineTo(P[3][0], P[3][1]); cx.stroke(); }   // bone-pale tip
    });
  }

  Characters.art('nethros', {
    // Tall and narrow, extra long arms, big hands, hunched (headSink). Legs are invisible (see the top of this file).
    body: {head:{r:5.6}, torso:{len:14, w:9}, uArm:{len:14, w:2.9}, fArm:{len:14, w:2.3}, hand:{r:2.3},
           thigh:{len:T, w:.01}, shin:{len:SH, w:.01}, foot:{len:1, w:.01},
           headSink:3, shN:1.5, shF:-2.5, belt:1.2, noRings:true, outline:'rgba(0,0,0,0)', outlineW:0},
    colors: {shirt:'#120b1c', limb:'#2e1d48', far:'#1c1030', head:'#0b0713', dark:'#0b0713', hand:'#1b1030', legs:'rgba(0,0,0,0)', legsFar:'rgba(0,0,0,0)'},

    foot(){},                                                       // no feet
    farFront: f => f.atk > 0,                                       // both hands thrust forward: draw the far arm over the body so you can see it

    // soft while he coils (heavy, ghostly), very stiff at the release (snap), medium after
    spring(p, A){
      if(p < C - .08) return {k:90, d:11};
      if(p < C + .1) return {k:450, d:32};
      return {k:150, d:17};
    },

    attack(tg, p, A, K){
      ['aN', 'eN', 'aF', 'eF', 'lean', 'head'].forEach(j => tg[j] = K(p, ATK[j]));
      legs(tg, K(p, ATK.Y));
    },

    // Float: slow bob, torso leans forward, head tilted down, arms hang loose and UNEVEN (near arm swings forward a bit, far arm hangs back).
    // Moving: he glides (no steps), leans more, arms trail behind him.
    pose(tg, f, t, run, K){
      const idle = 1 - run, b = Math.sin(t * 1.7), b2 = Math.sin(t * 1.7 - .9), b3 = Math.sin(t * 1.3 + 1.4);
      tg.lean = .2 + idle * b * .025 + run * .16;
      tg.head = .2 + idle * b2 * .03 - run * .04;
      tg.aN = idle * (.32 + b2 * .07) + run * -.5;   tg.eN = .3 + idle * (.12 + b3 * .06) + run * .15;
      tg.aF = idle * (-.2 - b3 * .06) + run * -.85;  tg.eF = .2 + idle * (.1 - b2 * .05) + run * .2;
      legs(tg, HOVER + b * 1.4 * FLOAT);
    },

    // ---- BEHIND the body: smoke (his lower body), ground mist, the big back SHROUD (long ragged strands), far sleeve rags, far claw hand ----
    behind(cx, f, t, S, P){
      const white = f.flash > 0;
      const px = S.pel.x, py = S.pel.y, trail = clamp(f.vx * f.face * .05, -6, 12);   // + = moving forward, cloth + smoke trail back
      const span = SPAN + clamp(-(f.vy || 0) * .012, -5, 5);
      S._trail = trail;                                                                // torso() uses it (it has no f / t of its own)

      // shadow mist on the ground, drifts back with his speed (on the ground only)
      if(f.gr){
        for(let i = 0; i < 7; i++){
          const ph = t * .8 + i * 1.9, a = (.2 - i * .02) * Math.min(1, SMOKE + .2);
          cx.fillStyle = 'rgba(14,6,24,' + a + ')';
          cx.beginPath(); cx.ellipse(-2 - i * 4.6 - trail * (.4 + i * .12) + Math.sin(ph) * 2.5, -1.6 + Math.cos(ph) * .6, 7.5 - i * .5, 2.3, 0, 0, 7); cx.fill();
          if(i % 2 === 0){ cx.fillStyle = 'rgba(90,40,150,' + a * .35 + ')'; cx.beginPath(); cx.ellipse(-4 - i * 4.4 - trail * (.4 + i * .12) + Math.sin(ph) * 2.5, -2.1, 5, 1.2, 0, 0, 7); cx.fill(); }
        }
      }

      // lower body: a smoke cone that fades out downward, then puffs that swirl and drift down + back
      if(SMOKE > 0){
        const g = cx.createLinearGradient(0, py, 0, py + span);
        g.addColorStop(0, 'rgba(9,4,16,.97)'); g.addColorStop(.55, 'rgba(9,4,16,.6)'); g.addColorStop(1, 'rgba(9,4,16,0)');
        const sw = Math.sin(t * 1.6) * 1.2;
        cx.beginPath(); cx.moveTo(px - 2.2, py);
        cx.quadraticCurveTo(px - 4.5 - trail * .15, py + span * .45, px - 6.5 - trail * .8 + sw, py + span * .95);
        cx.lineTo(px + 5.5 - trail * .8 + sw, py + span * .95);
        cx.quadraticCurveTo(px + 4 - trail * .15, py + span * .45, px + 2.2, py);
        cx.closePath(); cx.fillStyle = g; cx.fill();
        const N = Math.round(18 * SMOKE);
        for(let i = 0; i < N; i++){
          const k = (t * (.42 + (i % 3) * .07) + i / N) % 1, wob = Math.sin(t * 1.3 + i * 2.1);
          const x = px + wob * (1.6 + k * 4.8) - trail * k * k * .9 - k * 1.5, y = py + 1 + k * span, r = (2.6 + k * 3.4) * (.8 + (i % 4) * .1), a = (1 - k) * .62;
          cx.fillStyle = 'rgba(10,5,18,' + a + ')'; cx.beginPath(); cx.arc(x, y, r, 0, 7); cx.fill();
          cx.strokeStyle = 'rgba(130,64,220,' + a * .7 + ')'; cx.lineWidth = .8; cx.beginPath(); cx.arc(x, y, r, .6 + wob, 2.6 + wob); cx.stroke();   // violet rim = readable silhouette
          if(i % 3 === 0){ cx.fillStyle = 'rgba(110,50,190,' + a * .3 + ')'; cx.beginPath(); cx.arc(x + 1, y - 1, r * .6, 0, 7); cx.fill(); }
        }
        cx.lineCap = 'round';
        for(let i = 0; i < 4; i++){                                                                     // swirling wisps round the cone
          const k = (t * .5 + i / 4) % 1, x = px + Math.sin(t * 1.4 + i * 1.6) * (3 + k * 5) - trail * k * k * .9, y = py + 2 + k * span * .9, a = (1 - k) * .75;
          cx.strokeStyle = 'rgba(150,80,240,' + a + ')'; cx.lineWidth = 1; cx.beginPath(); cx.arc(x, y, 2.5 + k * 3, t * 4 + i, t * 4 + i + 2); cx.stroke();
        }
        for(let i = 0; i < 5; i++){                                                                     // a few specks leaving the smoke
          const k = (t * .6 + i * .21) % 1, x = px + Math.sin(i * 3.1 + t) * (4 + k * 6) - trail * k, y = py + span * (.5 + .5 * Math.sin(i * 1.7)) - k * 10;
          cx.fillStyle = 'rgba(150,80,230,' + (.5 * (1 - k)) + ')'; cx.fillRect(x, y, 1.2, 1.2);
        }
      }

      // BACK CLOAK: the long dark tail of the robe behind him. It trails back when he moves and ends in long pointed tatters near the ground.
      {
        S._farFront = f.atk > 0;                                                         // torso() / front() need this to place the far sleeve
        const sx = S.sh.x, sy = S.sh.y, hx = S.head.x, hy = S.head.y, by = py + 1, F = c => white ? '#fff' : c;
        const hem = hemPts(px - 2, by, [[-17, 9], [-14.4, 16], [-11.6, 10], [-8.6, 19], [-5.6, 12], [-2.6, 18], [.4, 10], [3.4, 16], [6.4, 11]], trail, t, 1.3);
        const g = cx.createLinearGradient(0, sy, 0, by + 19);
        g.addColorStop(0, '#32244b'); g.addColorStop(.5, '#1b1228'); g.addColorStop(1, '#120c1b');
        const back = [[sx + 3, sy - 2.5], [hx - 4, hy + 3], [sx - 9, sy], [px - 13.5 - trail * .3, py - 6], [px - 17.5 - trail * .5, by]].concat(hem, [[px + 9, by], [sx + 7, sy + 11]]);
        poly(cx, back, F(g), white ? null : INK, .6);
        if(!white){
          cx.strokeStyle = EDGE; cx.lineWidth = .6; cx.lineCap = 'round'; cx.beginPath(); back.slice(2, 5).forEach((q, i) => i ? cx.lineTo(q[0], q[1]) : cx.moveTo(q[0], q[1])); cx.stroke();   // rim light down the back edge
          for(let i = 0; i < 4; i++){                                                    // long folds from the shoulder to the notches
            const q = hem[1 + i * 2];
            cx.strokeStyle = i % 2 ? DEEP : FOLD; cx.lineWidth = .7;
            cx.beginPath(); cx.moveTo(sx - 6 + i * 2.6, sy + 2); cx.quadraticCurveTo(lerp(sx - 6 + i * 2.6, q[0], .4) - 1.6, lerp(sy, q[1], .5), q[0], q[1] - 3); cx.stroke();
          }
        }
      }

      // far claw hand (behind the body) - when the far arm is thrust forward it is drawn in front() instead
      if(!(f.atk > 0)) claws(cx, S.aF, white, t, false);
    },

    // ---- ON TOP: torso is drawn by torso() below. Here: shoulder rags, claws, Shadow Cowl + eyes, dark energy in the hands ----
    front(cx, f, t, S, P){
      const white = f.flash > 0;
      // tell arena.js where the hands are in the world, so the soul leaves the real hands
      f.handW = {N:{x:f.x + f.face * S.aN.hand.x, y:f.y + S.aN.hand.y}, F:{x:f.x + f.face * S.aF.hand.x, y:f.y + S.aF.hand.y}};

      // sleeves: long, flowing, torn cuffs. The far sleeve is drawn here only while the far arm is thrust forward (otherwise torso() draws it); the hands come out of the cuffs.
      const tr = S._trail || 0;
      if(f.atk > 0){ sleeve(cx, S.aF, white, t, tr, '#2a2038', '#1a1226'); claws(cx, S.aF, white, t, false); }
      sleeve(cx, S.aN, white, t, tr, '#3b3054', '#251a3a');
      claws(cx, S.aN, white, t, true);

      // ---- HOOD: a natural draped reaper hood. Small, close to the head, soft back drape that falls onto the shoulders, a clear face opening with a rim of cloth,
      // deep black inside, only two crimson eyes. Drawn in the head's own tilted space. ----
      const h = S.head, ang = Math.atan2(h.x - S.sh.x, -(h.y - S.sh.y)), A = f.A || {};
      const p = f.atk > 0 && A.time ? clamp(1 - f.atk / A.time, 0, 1) : -1, hot = p >= 0 && p < C + .15;
      cx.save(); cx.translate(h.x, h.y); cx.rotate(ang);
      const hoodPath = () => {
        cx.beginPath(); cx.moveTo(4.4, 7.4);
        cx.bezierCurveTo(7.4, 5.6, 8.8, 1.8, 8, -2.6);                                       // front rim, up the side of the face
        cx.bezierCurveTo(7.2, -6.2, 3.6, -8.4, -.4, -8.4);                                   // over the brow, a low round top (no dome, no point)
        cx.bezierCurveTo(-4.6, -8.4, -8, -5.4, -8.6, -.6);                                   // down the back of the head
        cx.bezierCurveTo(-9.2, 3.6, -9.6, 7.4, -8.4, 10.4);                                  // cloth falls behind the neck
        cx.quadraticCurveTo(-5.2, 10.6, -3.6, 9.6);                                          // soft scalloped hem resting on the shoulders
        cx.quadraticCurveTo(-1.8, 11.4, .6, 9.8);
        cx.quadraticCurveTo(2.8, 10.6, 4.4, 7.4);
        cx.closePath();
      };
      const facePath = () => {
        cx.beginPath(); cx.moveTo(2.4, -5.6);
        cx.bezierCurveTo(5.4, -5.6, 7, -2.8, 6.7, .8);
        cx.bezierCurveTo(6.4, 3.6, 4.6, 5.8, 2.6, 6);
        cx.bezierCurveTo(-.2, 4.6, -1, -.8, .2, -3.6);
        cx.bezierCurveTo(.6, -4.8, 1.4, -5.4, 2.4, -5.6);
        cx.closePath();
      };
      if(white){ hoodPath(); cx.fillStyle = '#fff'; cx.fill(); }
      else {
        cx.fillStyle = 'rgba(2,1,5,.38)'; cx.beginPath(); cx.ellipse(-1, 9.6, 8.4, 2.4, 0, 0, 7); cx.fill();   // shadow where the hood rests on the shroud
        hoodPath();
        const hg = cx.createLinearGradient(-8, -8, 6, 10); hg.addColorStop(0, '#3a2a55'); hg.addColorStop(.5, '#201433'); hg.addColorStop(1, '#110a1b');
        cx.fillStyle = hg; cx.fill(); cx.strokeStyle = INK; cx.lineWidth = 1.1; cx.lineJoin = 'round'; cx.stroke(); cx.strokeStyle = 'rgba(150,136,182,.42)'; cx.lineWidth = .6; cx.stroke();
        cx.lineCap = 'round';
        cx.strokeStyle = DEEP; cx.lineWidth = .8;                                           // draped folds running from the opening down to the hem
        cx.beginPath(); cx.moveTo(-1.6, -6.4); cx.bezierCurveTo(-6, -4, -7.6, 2, -6.6, 8.6); cx.stroke();
        cx.beginPath(); cx.moveTo(.2, 6.4); cx.bezierCurveTo(-.6, 8, -1, 9, -1.6, 10); cx.stroke();
        cx.strokeStyle = FOLD; cx.lineWidth = .6;
        cx.beginPath(); cx.moveTo(-3.4, -7.6); cx.bezierCurveTo(-7, -5.4, -8.6, -.6, -7.8, 5.8); cx.stroke();
        cx.beginPath(); cx.moveTo(-5.6, 6); cx.bezierCurveTo(-5.8, 8, -5.4, 9.4, -4.6, 10); cx.stroke();
        // the face opening: deep black inside, a thin cloth rim around it
        facePath(); cx.fillStyle = '#010003'; cx.fill();
        cx.save(); facePath(); cx.clip();
        const gl = cx.createRadialGradient(4.4, -1.4, .5, 4.4, -1.4, 7);
        gl.addColorStop(0, 'rgba(255,30,60,' + (hot ? .26 : .12) + ')'); gl.addColorStop(1, 'rgba(255,30,60,0)');
        cx.fillStyle = gl; cx.fillRect(-4, -8, 14, 16);
        cx.shadowColor = '#ff1f3d'; cx.shadowBlur = hot ? 10 : 6;
        [[3.3, -1.5, 1.7, .8], [5.5, -1.1, 1.15, .6]].forEach(([ex, ey, rx, ry]) => {         // near eye, far eye (smaller, three-quarter view)
          cx.fillStyle = '#ff3355'; cx.beginPath(); cx.ellipse(ex, ey, rx, ry, .28, 0, 7); cx.fill();
          cx.shadowBlur = 0; cx.fillStyle = '#ffd0d6'; cx.beginPath(); cx.ellipse(ex + .3, ey, rx * .45, ry * .4, .28, 0, 7); cx.fill(); cx.shadowBlur = hot ? 10 : 6;
        });
        cx.shadowBlur = 0; cx.restore();
        facePath(); cx.strokeStyle = 'rgba(120,106,152,.6)'; cx.lineWidth = .7; cx.lineJoin = 'round'; cx.stroke();
      }
      cx.restore();

      if(white) return;

      // ---- DARK ENERGY. Source = both hands only (never the chest). ----
      const hs = [S.aN.hand, S.aF.hand];
      if(f.atk > 0 && A.time){
        if(p < C){                                             // COIL: motes spiral in, a dark core with a violet rim grows in each palm, wisps curl round the fingers
          const k = clamp(p / C, 0, 1);
          hs.forEach((hd, hi) => {
            for(let i = 0; i < 9; i++){
              const a = t * 7 + i * .7 + hi * 2, r = (1 - k) * 20 + 3.5;
              cx.fillStyle = (i % 2 ? 'rgba(170,90,255,' : 'rgba(40,14,70,') + (.25 + .6 * k) + ')';
              cx.beginPath(); cx.arc(hd.x + Math.cos(a) * r, hd.y + Math.sin(a) * r * .75, 1 + k * 1.1, 0, 7); cx.fill();
            }
            cx.strokeStyle = 'rgba(150,70,240,' + (.35 + .5 * k) + ')'; cx.lineWidth = 1; cx.lineCap = 'round';
            for(let i = 0; i < 3; i++){ const a = t * 5 + i * 2.1 + hi; cx.beginPath(); cx.arc(hd.x, hd.y, 5 + k * 4 + i * 1.5, a, a + 1.3); cx.stroke(); }
            const gl = cx.createRadialGradient(hd.x, hd.y, 1, hd.x, hd.y, 10 + 8 * k);
            gl.addColorStop(0, 'rgba(120,50,220,' + (.3 + .3 * k) + ')'); gl.addColorStop(1, 'rgba(120,50,220,0)');
            cx.fillStyle = gl; cx.beginPath(); cx.arc(hd.x, hd.y, 10 + 8 * k, 0, 7); cx.fill();
            cx.fillStyle = '#05020a'; cx.beginPath(); cx.arc(hd.x, hd.y, 1.8 + k * 4.2, 0, 7); cx.fill();
            cx.shadowColor = '#a14dff'; cx.shadowBlur = 8; cx.strokeStyle = 'rgba(190,120,255,' + (.4 + .5 * k) + ')'; cx.lineWidth = 1.2; cx.stroke(); cx.shadowBlur = 0;
          });
        } else if(p < C + .16){                                // RELEASE: a ring of dark light + black shards where the soul left
          const k = (p - C) / .16, mx = (hs[0].x + hs[1].x) / 2, my = (hs[0].y + hs[1].y) / 2;
          cx.strokeStyle = 'rgba(190,120,255,' + (1 - k) + ')'; cx.lineWidth = 2.2 * (1 - k) + .5;
          cx.beginPath(); cx.arc(mx + 4, my, 5 + k * 22, 0, 7); cx.stroke();
          for(let i = 0; i < 7; i++){ const a = i * .9 + .2; cx.fillStyle = (i % 2 ? 'rgba(10,4,18,' : 'rgba(170,90,255,') + (1 - k) + ')'; cx.fillRect(mx + 4 + Math.cos(a) * (6 + k * 20), my + Math.sin(a) * (6 + k * 20), 2.2, 2.2); }
        }
      } else {
        hs.forEach((hd, hi) => {                               // idle: thin violet smoke leaks off the fingertips
          for(let i = 0; i < 3; i++){
            const k = (t * .7 + i / 3 + hi * .4) % 1;
            cx.fillStyle = 'rgba(150,80,230,' + (.4 * (1 - k)) + ')';
            cx.beginPath(); cx.arc(hd.x + Math.sin(t * 2 + i * 2 + hi) * 2.5, hd.y + 5 - k * 10, 1 + k * 1.2, 0, 7); cx.fill();
          }
        });
      }
    },

    // ---- TORSO (called by body.js instead of the plain capsule): the TATTERED SHROUD, a long flowing dementor-style robe. One continuous cloak runs from the
    // shoulders to a ragged hem of long pointed tatters just above the ground (with a darker under-layer showing between them), a front drape overlaps it,
    // a shoulder capelet sits on top, and the far sleeve hangs from the shoulder. One small torn opening on the chest shows a few ribs. ----
    torso(cx, S, B, P, white){
      const a = S.pel, b = S.sh, dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, fx = -uy, fy = ux;   // u = up the torso, f = forward
      const pt = (s, w) => [a.x + ux * L * s + fx * w, a.y + uy * L * s + fy * w];   // s = 0 (waist) .. 1 (shoulders), w = + forward / - back
      const Q = arr => arr.map(q => pt(q[0], q[1]));
      const tt = Date.now() / 1000, tr = S._trail || 0, F = c => white ? '#fff' : c;
      const line = (p0, p1, bend, col, lw) => {                                       // one fold line on the cloth
        cx.strokeStyle = col; cx.lineWidth = lw || .6; cx.lineCap = 'round'; cx.beginPath(); cx.moveTo(p0[0], p0[1]);
        cx.quadraticCurveTo((p0[0] + p1[0]) / 2 + bend, (p0[1] + p1[1]) / 2, p1[0], p1[1]); cx.stroke();
      };
      if(!S._farFront) sleeve(cx, S.aF, white, tt, tr, '#2a2038', '#1a1226');          // far sleeve (under the robe)

      const c0 = pt(-.05, 0), by = a.y + 1;
      const hem = hemPts(c0.x - 0, by, [[-11.5, 11], [-9, 18], [-6.6, 10], [-4.2, 19], [-1.8, 12], [.6, 18], [3, 9], [5.6, 17], [8.2, 12], [10.6, 15]], tr, tt, 1);
      const under = hemPts(c0.x, by, [[-10, 14], [-7.6, 20], [-5.2, 13], [-2.6, 20.5], [0, 14], [2.4, 20], [4.8, 13], [7.2, 19], [9.6, 14]], tr, tt, 1.2);
      const Sb = pt(1.02, -7), Mb = pt(.45, -9.6), Wb = [c0.x - 10.6 - tr * .2, a.y + 1], Wf = [c0.x + 10.4, a.y + 1], Mf = pt(.45, 9.4), Sf = pt(1.02, 6.8), Nf = pt(1.1, 3), Nb = pt(1.1, -3);
      const slit = Q([[.36,1.3],[.32,3],[.26,3.5],[.18,2.6],[.11,3.2],[.06,1.6],[.06,-.6],[.1,-2.2],[.18,-3.2],[.26,-2.4],[.32,-3.1],[.36,-1.4]]);
      const robePath = () => {
        cx.beginPath(); cx.moveTo(Nb[0], Nb[1]); cx.lineTo(Sb[0], Sb[1]); cx.quadraticCurveTo(Mb[0], Mb[1], Wb[0], Wb[1]);
        hem.forEach(q => cx.lineTo(q[0], q[1])); cx.lineTo(Wf[0], Wf[1]); cx.quadraticCurveTo(Mf[0], Mf[1], Sf[0], Sf[1]); cx.lineTo(Nf[0], Nf[1]); cx.closePath();
      };
      const drape = [pt(.95, 4.2), pt(.5, 9.6), [c0.x + 10.4, a.y + 1]].concat(hemPts(c0.x, by, [[3.8, 9], [5.8, 16], [7.8, 9], [9.8, 14], [11.4, 10]], tr, tt, 1), [[c0.x + 3.2, a.y + 1]]);
      const cape = Q([[1.12,-3],[1.03,-9.4],[.84,-10.8],[.66,-9.2],[.76,-7.6],[.56,-6.4],[.68,-4.6],[.54,-3.2],[.66,-1.4],[.52,.2],[.66,2],[.54,3.6],[.68,5.2],[.56,6.8],[.72,8.2],[.56,9.8],[.88,10.6],[1.03,9],[1.12,3.2]]);

      if(white){ poly(cx, under, '#fff'); robePath(); cx.fillStyle = '#fff'; cx.fill(); poly(cx, drape, '#fff'); poly(cx, cape, '#fff'); return; }

      // darker under-layer: shows between the tatters and gives the hem depth
      poly(cx, [[c0.x - 9, a.y], [c0.x + 9, a.y]].concat(under.slice().reverse()), '#0d0914', INK, .5);
      cx.strokeStyle = 'rgba(110,96,142,.4)'; cx.lineWidth = .5; cx.beginPath(); under.forEach((q, i) => i ? cx.lineTo(q[0], q[1]) : cx.moveTo(q[0], q[1])); cx.stroke();

      poly(cx, Q([[0,1.8],[.3,2.6],[.7,3],[1,2.4],[1,-2.4],[.7,-3],[.3,-2.6],[0,-1.8]]), '#06030b');   // the skeleton under the cloth
      // the torn chest opening: hollow dark + a few ribs
      cx.save();
      cx.beginPath(); slit.forEach((q, i) => i ? cx.lineTo(q[0], q[1]) : cx.moveTo(q[0], q[1])); cx.closePath(); cx.clip();
      cx.fillStyle = '#020104'; cx.fillRect(a.x - 14, a.y - 22, 28, 30);
      [.12, .19, .26, .33].forEach((s, i) => {
        cx.strokeStyle = 'rgba(184,172,210,' + (1 - i * .1) + ')'; cx.lineWidth = .9; cx.lineCap = 'round';
        const m = pt(s, -3.6), c = pt(s + .03, .5), e = pt(s - .08, i % 2 ? 2.6 : 3.8);
        cx.beginPath(); cx.moveTo(m[0], m[1]); cx.quadraticCurveTo(c[0], c[1], e[0], e[1]); cx.stroke();
      });
      cx.restore();

      // the robe: ONE continuous cloak, charcoal at the shoulders fading to near-black at the hem, chest opening cut out (even-odd)
      const g = cx.createLinearGradient(0, b.y, 0, a.y + 19);
      g.addColorStop(0, '#34294a'); g.addColorStop(.35, '#241a35'); g.addColorStop(1, '#130d1c');
      robePath(); slit.forEach((q, i) => i ? cx.lineTo(q[0], q[1]) : cx.moveTo(q[0], q[1])); cx.closePath();
      cx.fillStyle = g; cx.fill('evenodd'); cx.strokeStyle = INK; cx.lineWidth = .7; cx.lineJoin = 'round'; cx.stroke();
      cx.strokeStyle = EDGE; cx.lineWidth = .55; cx.beginPath(); hem.forEach((q, i) => i ? cx.lineTo(q[0], q[1]) : cx.moveTo(q[0], q[1])); cx.stroke();   // rim light along the torn hem
      for(let i = 0; i < 6; i++){                                                    // long drape folds from the waist down into the notches
        const q = hem[1 + i * 2] || hem[hem.length - 2], w0 = -7 + i * 3;
        line(pt(.05, w0), [q[0], q[1] - 2.5], (i % 2 ? 1 : -1) * 1.2, i % 2 ? DEEP : FOLD, .7);
      }

      // front drape: a second, lighter layer of cloth hanging over the front of the robe, shorter, with its own torn hem
      poly(cx, drape, lin2(cx, c0, a.y, '#3c2f58', '#1c1428'), INK, .6);
      line(pt(.9, 5.4), [c0.x + 6.6, a.y + 11], 1, DEEP, .7); line(pt(.8, 8), [c0.x + 9.6, a.y + 10], -1, FOLD, .6);
      cx.strokeStyle = EDGE; cx.lineWidth = .5; cx.beginPath(); drape.slice(3, drape.length - 1).forEach((q, i) => i ? cx.lineTo(q[0], q[1]) : cx.moveTo(q[0], q[1])); cx.stroke();

      // shoulder capelet with pointed tatters, sitting over the shoulders (the hood rests on it)
      const cg = cx.createLinearGradient(b.x, b.y, a.x, a.y + 6); cg.addColorStop(0, '#4a3b66'); cg.addColorStop(1, '#2a1f40');
      poly(cx, cape, cg, INK, .7);
      cx.strokeStyle = EDGE; cx.lineWidth = .6; cx.lineCap = 'round';
      [[0, 3], [15, 18]].forEach(([i0, i1]) => { cx.beginPath(); cape.slice(i0, i1).forEach((q, i) => i ? cx.lineTo(q[0], q[1]) : cx.moveTo(q[0], q[1])); cx.stroke(); });
      line(pt(1.06, -6), pt(.6, -7.4), .6, DEEP, .7); line(pt(1.06, -1.5), pt(.58, -2.2), -.5, DEEP, .7); line(pt(1.06, 2.5), pt(.58, 3), .5, DEEP, .7); line(pt(1.06, 6), pt(.62, 7.2), -.6, DEEP, .7);
    },

    // ---- the flying DARK SOUL (arena.js calls this; s = {x, y, r, vx, age, kind}). kind 0/1 small, 2 big. Smoky tail, black core, violet rim, two tiny crimson eyes ----
    shot(cx, s, t){
      const d = s.vx > 0 ? 1 : -1, x = s.x, y = s.y, r = s.r * (1 + Math.sin(s.age * 16) * .06), big = s.kind >= 2;
      cx.save(); cx.translate(x, y); cx.scale(d, 1); cx.translate(-x, -y);       // draw everything as if flying right
      for(let i = 0; i < 12; i++){                                                // smoky trail: puffs that wave and fade
        const k = i / 12, px = x - k * r * (big ? 8 : 6.5), py = y + Math.sin(s.age * 14 + i * .9) * r * .55 * k, pr = r * (.95 - .6 * k), a = .55 * (1 - k);
        cx.fillStyle = 'rgba(30,12,52,' + a + ')'; cx.beginPath(); cx.arc(px, py, pr, 0, 7); cx.fill();
        if(i % 2 === 0){ cx.fillStyle = 'rgba(130,60,220,' + a * .4 + ')'; cx.beginPath(); cx.arc(px + 1, py - 1, pr * .55, 0, 7); cx.fill(); }
      }
      const gl = cx.createRadialGradient(x, y, r * .4, x, y, r * 2.4);
      gl.addColorStop(0, 'rgba(120,50,220,.5)'); gl.addColorStop(1, 'rgba(120,50,220,0)');
      cx.fillStyle = gl; cx.beginPath(); cx.arc(x, y, r * 2.4, 0, 7); cx.fill();
      cx.fillStyle = '#05020a'; cx.beginPath(); cx.arc(x, y, r, 0, 7); cx.fill();   // black core
      cx.shadowColor = '#a14dff'; cx.shadowBlur = big ? 16 : 10; cx.strokeStyle = '#a14dff'; cx.lineWidth = big ? 2.2 : 1.5; cx.stroke(); cx.shadowBlur = 0;
      cx.strokeStyle = 'rgba(190,120,255,.55)'; cx.lineWidth = 1;                   // slow swirl inside the core
      for(let i = 0; i < 3; i++){ const a = s.age * 6 + i * 2.1; cx.beginPath(); cx.arc(x, y, r * (.45 + i * .15), a, a + 1.4); cx.stroke(); }
      cx.shadowColor = '#ff1f3d'; cx.shadowBlur = 6; cx.fillStyle = '#ff3355';      // the soul looks at what it is about to hit
      cx.beginPath(); cx.ellipse(x + r * .3, y - r * .26, r * .2, r * .11, .28, 0, 7); cx.fill();
      cx.beginPath(); cx.ellipse(x + r * .3, y + r * .26, r * .2, r * .11, -.28, 0, 7); cx.fill();
      cx.shadowBlur = 0;
      for(let i = 0; i < (big ? 6 : 3); i++){                                       // orbiting motes
        const a = s.age * 9 + i * (6.283 / (big ? 6 : 3));
        cx.fillStyle = 'rgba(200,150,255,.85)'; cx.beginPath(); cx.arc(x + Math.cos(a) * r * 1.5, y + Math.sin(a) * r * 1.15, big ? 1.8 : 1.2, 0, 7); cx.fill();
      }
      cx.restore();
    }
  });
})(); 