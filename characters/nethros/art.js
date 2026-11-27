// NETHROS art - "The Eternal Dread". Faceless GRIM REAPER under a draped black hood. NO LEGS: the ragdoll ends at the waist, black smoke is his lower body.
// Same shared ragdoll (body.js). Nothing in arena.js / body.js / main.js is changed. Hitbox is still 30x52 (visual only).
// Monochrome only: matte black, charcoal, ash gray.
//
// LAYER ORDER (back to front) - this is the layout:
//   1. behind():  aura, smoke column, ash, back cloak
//   2. torso():   far arm (idle only, tucked behind the robe) -> robe -> front drape -> capelet
//   3. body.js:   head circle (invisible, covered by the hood)
//   4. front():   far arm (attacks / raised poses) -> HOOD -> near arm (always on top of the hood) -> dark energy
//   So a raised arm never gets hidden by the hood, and the far arm always sits BEHIND the head.
//
// POSES: idle = both sleeves hang in front, hands low and together at the waist (classic reaper).
//        raised skills = arms spread into a "Y" (near arm up-forward, far arm up-back) so the hood stays visible between them.
//
// HOW THE LEGS ARE HIDDEN: legs are width .01 / transparent / no foot. They only decide how high the waist floats (T + SH, HOVER).
//   Do not change outline / outlineW / thigh.w / shin.w.
// ATTACK = DARK SOUL: skills.js basic: {hitFrom:0, hitTo:0, shot:{p:.5, hand:'B', ...}}  <- shot.p MUST equal C below (.5).
// SETTINGS: FLOAT = bob amount (0 = none)   SMOKE = how much smoke (0 = none, 1 = default, 2 = a lot)
(() => {
  let nethSmoke = null;
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
  const HOVER = 23.5;
  const SPAN = 26;
  const YMAX = .985 * (T + SH);

  const legK = (th, Y) => { const a = Math.acos(clamp((Y - T * Math.cos(th)) / SH, -1, 1)); const k = th - a; return k > .05 ? k : th + a; };
  const legs = (tg, Y) => { tg.tN = .04; tg.tF = -.04; Y = Math.min(Y, YMAX); tg.kN = legK(tg.tN, Y); tg.kF = legK(tg.tF, Y); };

  const ATK = {
    aN:   [[0,.3],[.14,.05],[.34,-.55],[.46,-.6],[.5,1.45],[.62,1.5],[.82,.95],[1,.3]],
    eN:   [[0,.35],[.34,1.4],[.46,1.45],[.5,.1],[.62,.08],[.82,.6],[1,.35]],
    aF:   [[0,-.2],[.14,-.3],[.36,-.75],[.46,-.8],[.5,1.35],[.62,1.45],[.84,.9],[1,-.2]],
    eF:   [[0,.3],[.36,1.35],[.46,1.4],[.5,.14],[.62,.1],[.84,.6],[1,.3]],
    lean: [[0,.22],[.34,.06],[.46,.04],[.5,.44],[.62,.48],[.82,.32],[1,.22]],
    head: [[0,.2],[.34,.3],[.5,.24],[.7,.14],[1,.2]],
    Y:    [[0,23.5],[.4,22.4],[.5,24],[1,23.5]]
  };

  function poly(cx, pts, fill, stroke, lw){
    cx.beginPath(); pts.forEach((q, i) => i ? cx.lineTo(q[0], q[1]) : cx.moveTo(q[0], q[1])); cx.closePath();
    if(fill){ cx.fillStyle = fill; cx.fill(); }
    if(stroke){ cx.strokeStyle = stroke; cx.lineWidth = lw || 1; cx.lineJoin = 'round'; cx.stroke(); }
  }

  const EDGE = 'rgba(150,150,156,.4)', INK = 'rgba(2,2,3,.92)', FOLD = 'rgba(140,140,146,.26)', DEEP = 'rgba(0,0,0,.6)';

  function hemPts(bx, by, tips, tr, t, sway, k){
    tips = tips.map(([d, l]) => [d, l * (k || 1.05)]);
    const o = [], X = (dx, len, i) => bx + dx * (.62 - len * .009) - tr * (len / 19) * .9 + Math.sin(t * 1.1 + i * 1.3) * (len / 19) * 1.5 * sway;
    tips.forEach(([dx, len], i) => {
      const x = X(dx, len, i);
      if(i){ const [pd, pl] = tips[i - 1]; o.push([(X(pd, pl, i - 1) + x) / 2 + (i % 2 ? .6 : -.6), by + Math.min(len, pl) * .52 + (i % 3) * .8]); }
      o.push([x, by + len]);
    });
    return o;
  }

  function ribbon(cx, x, y, len, ph, t, tr, a0){
    len = Math.min(len, -2 - y); if(len < 2.5) return;
    const n = 8, Lp = [], Rp = [];
    for(let k = 0; k <= n; k++){
      const f = k / n, cxp = x + Math.sin(ph + t * .8 + f * 3.2) * (.8 + f * 3.4) - tr * f * f * .6, w = 1.5 * (1 - f * .9) + .15;
      Lp.push([cxp - w, y + len * f]); Rp.push([cxp + w, y + len * f]);
    }
    const g = cx.createLinearGradient(0, y, 0, y + len); g.addColorStop(0, 'rgba(28,28,32,' + a0 + ')'); g.addColorStop(1, 'rgba(40,40,45,0)');
    poly(cx, Lp.concat(Rp.reverse()), g, null);
  }

  // SLEEVE over one arm (A = {s, el, hand}). Starts AT the shoulder (a small round shoulder cap hides the joint), narrow at the top, flaring to a wide torn cuff.
  function sleeve(cx, A, white, t, tr, c0, c1){
    const s = {x: A.s.x, y: A.s.y + 1.5}, e = A.el, h = A.hand, d1 =
       Math.hypot(e.x - s.x, e.y - s.y) || 1, d2 = Math.hypot(h.x - e.x, h.y - e.y) || 1;
    const vx = (e.x - s.x) / d1, vy = (e.y - s.y) / d1, ux = (h.x - e.x) / d2, uy = (h.y - e.y) / d2;
    const wr = {x: h.x - ux * 3, y: h.y - uy * 3}, n1 = [-vy, vx], n2 = [-uy, ux];
    let nm = [n1[0] + n2[0], n1[1] + n2[1]]; const nl = Math.hypot(nm[0], nm[1]) || 1; nm = [nm[0] / nl, nm[1] / nl];
    const w0 = 3, w1 = 3.8, w2 = 5.4;
    const L = [[s.x + n1[0] * w0, s.y + n1[1] * w0], [e.x + nm[0] * w1, e.y + nm[1] * w1], [wr.x + n2[0] * w2, wr.y + n2[1] * w2]];
    const R = [[s.x - n1[0] * w0, s.y - n1[1] * w0], [e.x - nm[0] * w1, e.y - nm[1] * w1], [wr.x - n2[0] * w2, wr.y - n2[1] * w2]];
    const cuff = [], ln = [1.6, 6.5, 2, 5.5, 1.6];
    ln.forEach((len, i) => {
      const k = i / 4, x = L[2][0] + (R[2][0] - L[2][0]) * k, y = L[2][1] + (R[2][1] - L[2][1]) * k, sw = Math.sin(t * 1.3 + i * 1.7) * .6;
      cuff.push([x + ux * len * .5 + sw - tr * .04 * len, y + uy * len * .5 + len * .8]);
    });
    const pts = [[s.x - vx * 2, s.y - vy * 2]].concat(L, cuff, R.reverse());
    let fill = '#fff';
    if(!white){ fill = cx.createLinearGradient(s.x, s.y, wr.x, wr.y); fill.addColorStop(0, c0); fill.addColorStop(1, c1); }
    poly(cx, pts, fill, white ? null : INK, .6);
    cx.fillStyle = white ? '#fff' : c0; cx.beginPath(); cx.arc(s.x, s.y, w0 + .4, 0, 7); cx.fill();      // shoulder cap
    if(white) return;
    cx.lineCap = 'round';
    cx.strokeStyle = EDGE; cx.lineWidth = .5; cx.beginPath(); L.forEach((q, i) => i ? cx.lineTo(q[0], q[1]) : cx.moveTo(q[0], q[1])); cx.stroke();
    cx.strokeStyle = DEEP; cx.lineWidth = .8; cx.beginPath(); cx.moveTo(s.x, s.y); cx.quadraticCurveTo(e.x + nm[0] * .6, e.y + nm[1] * .6, wr.x, wr.y); cx.stroke();
    cx.strokeStyle = FOLD; cx.lineWidth = .5; cx.beginPath(); cx.moveTo(e.x + nm[0] * 1.8, e.y + nm[1] * 1.8); cx.lineTo(wr.x + n2[0] * 3.4, wr.y + n2[1] * 3.4); cx.stroke();
  }

  // SKELETAL hand: small bony palm + 4 long thin crooked fingers (3 phalanges, knuckles) + short thumb. Rare slow twitch.
  function claws(cx, A, white, t, near){
    const h = A.hand, e = A.el, th = Math.atan2(h.y - e.y, h.x - e.x);
    const curl = -.5 * Math.tanh(Math.sin(th) * 4);
    const BONE = '#1c1c1f', BONE2 = '#2b2b2f', RIM = '#3c3c41';
    cx.strokeStyle = white ? '#fff' : BONE; cx.lineWidth = 1.3; cx.lineCap = 'round'; cx.beginPath(); cx.moveTo(h.x - Math.cos(th) * 4.5, h.y - Math.sin(th) * 4.5); cx.lineTo(h.x, h.y); cx.stroke();
    cx.fillStyle = white ? '#fff' : BONE2; cx.strokeStyle = RIM; cx.lineWidth = .5;
    cx.beginPath(); cx.ellipse(h.x + Math.cos(th) * 1, h.y + Math.sin(th) * 1, 2.3, 1.8, th, 0, 7); cx.fill(); if(!white) cx.stroke();
    const F = [[-.55, 10.4, 1, .55], [-.2, 12.6, 1.05, -.4], [.2, 13, 1.05, .5], [.56, 10.6, .95, -.35], [1.5, 6.2, .9, .3]];
    F.forEach(([off, len0, w, crook], i) => {
      const len = len0 * 1.0;
      const thumb = i === 4, ph = (near ? 0 : 1.7) + i * 2.1;
      const tw = Math.pow(Math.max(0, Math.sin(t * .55 + ph)), 14) * .3;
      const a0 = th + off * .8 + Math.sin(t * 1.0 + ph) * .03 + tw * (thumb ? -.4 : 1), sg = thumb ? -1.3 : 1;
      let x = h.x + Math.cos(a0) * 1.8, y = h.y + Math.sin(a0) * 1.8;
      const SL = [.42, .33, .25], P = [[x, y]], N = [[-Math.sin(a0), Math.cos(a0)]], wd = [.62 * w, .48 * w, .36 * w, .03];
      for(let k = 0; k < 3; k++){
        const a = a0 + curl * sg * (k + 1) / 3 * (thumb ? .8 : 1.1) + crook * .22 * (k + 1) / 3;
        x += Math.cos(a) * len * SL[k]; y += Math.sin(a) * len * SL[k];
        P.push([x, y]); N.push([-Math.sin(a), Math.cos(a)]);
      }
      const L = P.map((q, k) => [q[0] + N[k][0] * wd[k], q[1] + N[k][1] * wd[k]]), R = P.map((q, k) => [q[0] - N[k][0] * wd[k], q[1] - N[k][1] * wd[k]]).reverse();
      poly(cx, L.concat(R), white ? '#fff' : BONE, white ? null : RIM, .35);
      if(white) return;
      cx.fillStyle = BONE2; cx.strokeStyle = RIM; cx.lineWidth = .3;
      [1, 2].forEach(k => { cx.beginPath(); cx.arc(P[k][0], P[k][1], .62 * w, 0, 7); cx.fill(); cx.stroke(); });
      cx.strokeStyle = 'rgba(160,160,166,.5)'; cx.lineWidth = .35; cx.lineCap = 'round';
      cx.beginPath(); cx.moveTo(P[1][0], P[1][1]); cx.lineTo(P[2][0], P[2][1]); cx.lineTo(P[3][0], P[3][1]); cx.stroke();
    });
  }

  // one whole arm = sleeve + hand
  const arm = (cx, A, white, t, tr, near) => {
    sleeve(cx, A, white, t, tr, near ? '#2e2e32' : '#242427', near ? '#161618' : '#121214');
    claws(cx, A, white, t, near);
  };

  Characters.art('nethros', {
    // shN / shF = shoulder offsets (near / far). Moved in from 4.8 / -5.6 so the arms come out of the capelet, not out past it.
    body: {head:{r:5.6}, torso:{len:19, w:11}, uArm:{len:12.5, w:.01}, fArm:{len:12.5, w:.01}, hand:{r:.01},
           thigh:{len:T, w:.01}, shin:{len:SH, w:.01}, foot:{len:1, w:.01},
           headSink:3, shN:4.2, shF:-5, belt:.1, noRings:true, outline:'rgba(0,0,0,0)', outlineW:0},
    colors: {shirt:'#0c0c0e', limb:'#1c1c1f', far:'#121214', head:'#050506', dark:'#050506', hand:'rgba(0,0,0,0)', legs:'rgba(0,0,0,0)', legsFar:'rgba(0,0,0,0)'},

    foot(){},
    farFront: f => f.atk > 0,                                       // far arm is drawn in front() during attacks

    spring(p, A){
      if(A.skill === 'fallendescent') return {k:380, d:26};
      if(A.skill === 'damned') return {k:160, d:18};
      if(A.skill === 'ritual') return {k:120, d:15};
      if(A.skill === 'gravebound') return p < (A.at || .5) ? {k:100, d:13} : {k:420, d:30};
      if(p < C - .08) return {k:90, d:11};
      if(p < C + .1) return {k:450, d:32};
      return {k:150, d:17};
    },

    attack(tg, p, A, K){
      if(A.skill === 'damned'){   // RISE OF THE DAMNED: arms spread into a Y, hood stays visible between them
        const w = Math.sin(Date.now() / 1000 * 4);
        tg.aN = 2.45 + w * .06; tg.eN = .45; tg.aF = -2.35 - w * .06; tg.eF = -.45; tg.lean = -.14; tg.head = -.25;
        legs(tg, HOVER + 3);
        return;
      }
      if(A.skill === 'fallendescent'){
        const f0 = A.f0 || .22, f1 = A.f1 || .42, f2 = A.f2 || .64;
        if(p < f0){
          tg.aN = -.9; tg.eN = .12; tg.aF = -1.1; tg.eF = .12; tg.lean = .35; tg.head = .25; legs(tg, HOVER + 4);
        } else if(p < f1){
          tg.aN = -.5; tg.eN = .2; tg.aF = -.5; tg.eF = .2; tg.lean = 0; tg.head = 0; legs(tg, HOVER);
        } else if(p < f2){
          tg.aN = 1.6; tg.eN = .1; tg.aF = 1.4; tg.eF = .1; tg.lean = .45; tg.head = .28; legs(tg, HOVER - 2);
        } else {
          const rec = clamp((p - f2) / (1 - f2), 0, 1);
          tg.aN = .4 + rec * .4; tg.eN = .6 - rec * .2; tg.aF = .2 + rec * .4; tg.eF = .7 - rec * .2;
          tg.lean = .25 - rec * .15; tg.head = .1 - rec * .2; legs(tg, HOVER - 6 + rec * 6);
        }
        return;
      }
      if(A.skill === 'ritual'){   // DREAD RITUAL: arms raised and spread (Y), slow sway
        const w = Math.sin(Date.now() / 1000 * 2.2);
        tg.aN = 2.2 + w * .1; tg.eN = .3; tg.aF = -2.1 - w * .1; tg.eF = -.3; tg.lean = -.1; tg.head = -.2;
        legs(tg, HOVER + 2 + w * 1.2);
        return;
      }
      if(A.skill === 'gravebound'){   // GRAVEBOUND HANDS: Y raise, then both sweep down and forward
        const up = p < (A.at || .5) - .04, w = Math.sin(Date.now() / 1000 * 3);
        if(up){ tg.aN = 2.5 + w * .08; tg.eN = .25; tg.aF = -2.3 - w * .08; tg.eF = -.25; tg.lean = -.18; tg.head = -.3; }
        else  { tg.aN = .85; tg.eN = .15; tg.aF = .55; tg.eF = .1; tg.lean = .32; tg.head = .25; }
        legs(tg, HOVER + (up ? 3 : 0));
        return;
      }
      ['aN', 'eN', 'aF', 'eF', 'lean', 'head'].forEach(j => tg[j] = K(p, ATK[j]));
      legs(tg, K(p, ATK.Y));
    },

    // Idle: almost motionless, both sleeves hang in front, forearms folded so the hands rest low near the waist. Running: arms trail behind.
    pose(tg, f, t, run, K){
      const idle = 1 - run, b = Math.sin(t * 1.3), b2 = Math.sin(t * 1.3 - .9), b3 = Math.sin(t * 1.0 + 1.4);
      tg.lean = idle * b * .006 + run * .1;
      tg.head = idle * b2 * .008 - run * .02;
      tg.aN = idle * (.12 + b2 * .02) + run * -.4;   tg.eN = .2 + idle * (.12 + b3 * .02) + run * .15;
      tg.aF = idle * (-.42 - b3 * .02) + run * -1.0;   tg.eF = .15 + idle * (.1 - b2 * .02) + run * .2;
      legs(tg, HOVER + b * .9 * FLOAT);
    },

    behind(cx, f, t, S, P){
      const white = f.flash > 0;
      const px = S.pel.x, py = S.pel.y, trail = clamp(f.vx * f.face * .05, -6, 12);
      const span = SPAN + clamp(-(f.vy || 0) * .012, -5, 5);
      S._trail = trail;

      if(f.gr){
        for(let i = 0; i < 7; i++){
          const ph = t * .6 + i * 1.9, a = (.15 - i * .016) * Math.min(1, SMOKE + .2);
          cx.fillStyle = 'rgba(6,6,8,' + a + ')';
          cx.beginPath(); cx.ellipse(-2 - i * 4.6 - trail * (.4 + i * .12) + Math.sin(ph) * 2.5, -1.4 + Math.cos(ph) * .5, 7.5 - i * .5, 1.7, 0, 0, 7); cx.fill();
          if(i % 2 === 0){ cx.fillStyle = 'rgba(70,70,76,' + a * .3 + ')'; cx.beginPath(); cx.ellipse(-4 - i * 4.4 - trail * (.4 + i * .12) + Math.sin(ph) * 2.5, -2.1, 5, 1.2, 0, 0, 7); cx.fill(); }
        }
      }

      cx.save(); cx.beginPath(); cx.rect(-400, -800, 800, 800.5); cx.clip();

      const au = cx.createRadialGradient(px - 1, py - 14, 4, px - 1, py - 14, 36);
      au.addColorStop(0, 'rgba(0,0,0,.16)'); au.addColorStop(1, 'rgba(0,0,0,0)');
      cx.fillStyle = au; cx.fillRect(px - 42, py - 54, 84, 84);

      if(SMOKE > 0){
        const g = cx.createLinearGradient(0, py, 0, py + span);
        g.addColorStop(0, 'rgba(4,4,5,.98)'); g.addColorStop(.6, 'rgba(6,6,8,.8)'); g.addColorStop(1, 'rgba(6,6,8,.4)');
        const sw = Math.sin(t * 1.2) * 1.2;
        cx.beginPath(); cx.moveTo(px - 5.5, py - 5);
        cx.quadraticCurveTo(px - 7 - trail * .15, py + span * .42, px - 4.2 - trail * .8 + sw, py + span * .97);
        cx.lineTo(px + 3.6 - trail * .8 + sw, py + span * .97);
        cx.quadraticCurveTo(px + 6.4 - trail * .15, py + span * .42, px + 5.5, py - 5);
        cx.closePath(); cx.fillStyle = g; cx.fill();
        const N = Math.round(28 * SMOKE);
        for(let i = 0; i < N; i++){
          const k = (t * (.34 + (i % 3) * .06) + i / N) % 1, wob = Math.sin(t * 1.0 + i * 2.1);
          const r = (4.4 + Math.sin(Math.PI * k) * 3.2 - k * 1.4) * (.8 + (i % 4) * .1), x = px + wob * (2 + k * 5.5) - trail * k * k * .9 - k * 1.5, y = Math.min(py - 2 + k * (span + 2), -r - .5), a = Math.min(.9, (1 - k * .8) * .85);
          cx.fillStyle = 'rgba(8,8,10,' + a + ')'; cx.beginPath(); cx.arc(x, y, r, 0, 7); cx.fill();
          cx.strokeStyle = 'rgba(115,115,121,' + a * .5 + ')'; cx.lineWidth = .8; cx.beginPath(); cx.arc(x, y, r, .6 + wob, 2.6 + wob); cx.stroke();
          if(i % 3 === 0){ cx.fillStyle = 'rgba(52,52,58,' + a * .32 + ')'; cx.beginPath(); cx.arc(x + 1, y - 1, r * .62, 0, 7); cx.fill(); }
        }
        cx.lineCap = 'round';
        for(let i = 0; i < 4; i++){
          const k = (t * .4 + i / 4) % 1, x = px + Math.sin(t * 1.0 + i * 1.6) * (3 + k * 5) - trail * k * k * .9, y = py + 2 + k * span * .9, a = (1 - k) * .6;
          cx.strokeStyle = 'rgba(88,88,94,' + a + ')'; cx.lineWidth = 1; cx.beginPath(); cx.arc(x, y, 2.5 + k * 3, t * 2.6 + i, t * 2.6 + i + 2); cx.stroke();
        }
      }

      for(let i = 0; i < 14; i++){
        const k = (t * (.1 + (i % 4) * .025) + i * .137) % 1, x = px + Math.sin(i * 12.9 + t * .35) * (13 + (i % 5) * 3) - trail * k, y = py - 52 + k * 78;
        cx.fillStyle = 'rgba(170,170,176,' + (.5 * Math.sin(Math.PI * k)) + ')'; cx.fillRect(x, y, 1 + (i % 3) * .3, 1 + (i % 3) * .3);
      }

      // BACK CLOAK
      {
        S._farFront = f.atk > 0;
        const sx = S.sh.x, sy = S.sh.y, hx = S.head.x, hy = S.head.y, by = py + 1, F = c => white ? '#fff' : c;
        const hem = hemPts(px - 2, by, [[-18, 20], [-15, 25], [-12, 21], [-9, 26], [-6, 22], [-3, 26], [0, 21], [3, 25], [6, 21], [9, 20]], trail, t, 1.1, 1.1);
        const g = cx.createLinearGradient(0, sy, 0, by + 24), wf = clamp((py - sy) / (by + 24 - sy), .2, .85);
        g.addColorStop(0, '#29292d'); g.addColorStop(wf * .55, '#18181b'); g.addColorStop(wf, '#101012'); g.addColorStop(wf + (1 - wf) * .65, 'rgba(10,10,12,.75)'); g.addColorStop(1, 'rgba(10,10,12,0)');
        const gi = cx.createLinearGradient(0, sy, 0, by + 24); gi.addColorStop(0, INK); gi.addColorStop(wf, INK); gi.addColorStop(1, 'rgba(2,2,3,0)');
        const back = [[sx + 3, sy - 2.5], [hx - 4, hy + 3], [sx - 10, sy], [px - 10 - trail * .3, py - 6], [px - 12 - trail * .5, by + 6]].concat(hem, [[px + 6, by + 6], [sx + 7, sy + 11]]);
        poly(cx, back, F(g), white ? null : gi, .6);
        if(!white){
          cx.strokeStyle = EDGE; cx.lineWidth = .6; cx.lineCap = 'round'; cx.beginPath(); back.slice(2, 5).forEach((q, i) => i ? cx.lineTo(q[0], q[1]) : cx.moveTo(q[0], q[1])); cx.stroke();
          for(let i = 0; i < 4; i++){
            const q = hem[1 + i * 2];
            cx.strokeStyle = i % 2 ? DEEP : FOLD; cx.lineWidth = .7;
            cx.beginPath(); cx.moveTo(sx - 6 + i * 2.6, sy + 2); cx.quadraticCurveTo(lerp(sx - 6 + i * 2.6, q[0], .4) - 1.6, lerp(sy, q[1], .5), q[0], q[1] - 3); cx.stroke();
          }
          for(let i = 0; i < hem.length; i += 4) ribbon(cx, hem[i][0], hem[i][1] - 1, 9 + (i % 3) * 3, i * 1.7, t, trail, .5);
        }
      }
      cx.restore();

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

    // ---- ON TOP. Order: far arm (attacks only) -> HOOD -> near arm -> dark energy ----
    front(cx, f, t, S, P){
      const white = f.flash > 0, tr = S._trail || 0;
      f.handW = {N:{x:f.x + f.face * S.aN.hand.x, y:f.y + S.aN.hand.y}, F:{x:f.x + f.face * S.aF.hand.x, y:f.y + S.aF.hand.y}};

      // 1) far arm BEHIND the hood (idle: torso() already drew it behind the robe)
      if(f.atk > 0) arm(cx, S.aF, white, t, tr, false);

      // 2) HOOD
      const h = S.head, ang = Math.atan2(h.x - S.sh.x, -(h.y - S.sh.y)), A = f.A || {};
      const p = f.atk > 0 && A.time ? clamp(1 - f.atk / A.time, 0, 1) : -1;
      cx.save(); cx.translate(h.x, h.y); cx.rotate(ang); cx.scale(.82, .82);
      const hoodPath = () => {
        cx.beginPath(); cx.moveTo(5.2, 9.2);
        cx.bezierCurveTo(8.8, 7.2, 10.6, 2.4, 9.6, -2.8);
        cx.bezierCurveTo(8.6, -7.8, 4.2, -10.8, -.6, -10.8);
        cx.bezierCurveTo(-5.4, -10.8, -9.6, -7.4, -10.4, -1.6);
        cx.bezierCurveTo(-11.2, 3.8, -11.8, 9, -10.6, 12.6);
        cx.quadraticCurveTo(-8.4, 11.6, -7, 13.2);
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
        cx.fillStyle = 'rgba(0,0,0,.4)'; cx.beginPath(); cx.ellipse(-1.4, 12.2, 9.6, 2.6, 0, 0, 7); cx.fill();
        hoodPath();
        const hg = cx.createLinearGradient(-10, -10, 8, 12); hg.addColorStop(0, '#2c2c30'); hg.addColorStop(.5, '#17171a'); hg.addColorStop(1, '#0a0a0c');
        cx.fillStyle = hg; cx.fill(); cx.strokeStyle = INK; cx.lineWidth = 1.1; cx.lineJoin = 'round'; cx.stroke(); cx.strokeStyle = 'rgba(140,140,146,.34)'; cx.lineWidth = .6; cx.stroke();
        cx.lineCap = 'round';
        cx.strokeStyle = DEEP; cx.lineWidth = .9;
        cx.beginPath(); cx.moveTo(-1.8, -8.6); cx.bezierCurveTo(-7, -5.6, -9, 2, -8, 11.4); cx.stroke();
        cx.beginPath(); cx.moveTo(-4.6, -9.4); cx.bezierCurveTo(-9.2, -5, -10.6, 3, -9.6, 10.6); cx.stroke();
        cx.beginPath(); cx.moveTo(.4, 8.2); cx.bezierCurveTo(-.2, 10.2, -.6, 11.6, -1.2, 13); cx.stroke();
        cx.beginPath(); cx.moveTo(-5.2, 8); cx.bezierCurveTo(-5.4, 10, -5, 11.6, -4.2, 12.8); cx.stroke();
        cx.strokeStyle = FOLD; cx.lineWidth = .6;
        cx.beginPath(); cx.moveTo(-3.4, -9.8); cx.bezierCurveTo(-8, -6.4, -10, -.6, -9.2, 6.4); cx.stroke();
        cx.beginPath(); cx.moveTo(1, -9.8); cx.bezierCurveTo(5.6, -9.2, 8.6, -6.6, 9.4, -3); cx.stroke();
        cx.beginPath(); cx.moveTo(-6.6, 7.6); cx.bezierCurveTo(-6.8, 9.6, -6.4, 11.2, -5.6, 12.2); cx.stroke();
        facePath(); cx.fillStyle = '#000'; cx.fill();
        cx.save(); facePath(); cx.clip();
        for(let i = 0; i < 4; i++){
          const x = 3 + Math.sin(t * .45 + i * 1.9) * 3.4, y = -2 + Math.cos(t * .38 + i * 2.6) * 4.6, r = 3.6 + (i % 2) * 1.4;
          const sg = cx.createRadialGradient(x, y, 0, x, y, r); sg.addColorStop(0, 'rgba(30,30,33,.12)'); sg.addColorStop(1, 'rgba(30,30,33,0)');
          cx.fillStyle = sg; cx.fillRect(x - r, y - r, r * 2, r * 2);
        }
        cx.restore();
        facePath(); cx.strokeStyle = 'rgba(0,0,0,.9)'; cx.lineWidth = 1.2; cx.lineJoin = 'round'; cx.stroke();
        cx.strokeStyle = 'rgba(120,120,126,.34)'; cx.lineWidth = .5; cx.beginPath(); cx.moveTo(3.4, -7.4); cx.bezierCurveTo(7, -7.2, 8.6, -3.2, 8.2, 1.2); cx.stroke();
      }
      cx.restore();

      // 3) near arm ON TOP of the hood
      arm(cx, S.aN, white, t, tr, true);

      if(white) return;

      // 4) DARK ENERGY (both hands only)
      const hs = [S.aN.hand, S.aF.hand];
      if(f.atk > 0 && A.time && A.skill !== 'ritual'){
        if(p < C){
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
            cx.strokeStyle = 'rgba(165,165,171,' + (.35 + .45 * k) + ')'; cx.lineWidth = 1; cx.stroke();
          });
        } else if(p < C + .16){
          const k = (p - C) / .16, mx = (hs[0].x + hs[1].x) / 2, my = (hs[0].y + hs[1].y) / 2;
          cx.strokeStyle = 'rgba(170,170,176,' + (.8 * (1 - k)) + ')'; cx.lineWidth = 2 * (1 - k) + .5;
          cx.beginPath(); cx.arc(mx + 4, my, 5 + k * 22, 0, 7); cx.stroke();
          for(let i = 0; i < 7; i++){ const a = i * .9 + .2; cx.fillStyle = (i % 2 ? 'rgba(6,6,8,' : 'rgba(165,165,171,') + (1 - k) + ')'; cx.fillRect(mx + 4 + Math.cos(a) * (6 + k * 20), my + Math.sin(a) * (6 + k * 20), 2.2, 2.2); }
        }
      } else {
        hs.forEach((hd, hi) => {
          for(let i = 0; i < 3; i++){
            const k = (t * .5 + i / 3 + hi * .4) % 1;
            cx.fillStyle = 'rgba(46,46,51,' + (.42 * (1 - k)) + ')';
            cx.beginPath(); cx.arc(hd.x + Math.sin(t * 1.6 + i * 2 + hi) * 2.5, hd.y + 5 - k * 10, 1 + k * 1.2, 0, 7); cx.fill();
          }
        });
      }
    },

    // ---- TORSO: robe, front drape, capelet. Idle far arm is drawn first so it sits behind the robe. ----
    torso(cx, S, B, P, white){
      const a = S.pel, b = S.sh, dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, fx = -uy, fy = ux;
      const pt = (s, w) => [a.x + ux * L * s + fx * w, a.y + uy * L * s + fy * w];
      const Q = (arr, k) => arr.map(q => pt(q[0], q[1] * (k || 1)));
      const tt = Date.now() / 1000, tr = S._trail || 0;
      const line = (p0, p1, bend, col, lw) => {
        cx.strokeStyle = col; cx.lineWidth = lw || .6; cx.lineCap = 'round'; cx.beginPath(); cx.moveTo(p0[0], p0[1]);
        cx.quadraticCurveTo((p0[0] + p1[0]) / 2 + bend, (p0[1] + p1[1]) / 2, p1[0], p1[1]); cx.stroke();
      };
      if(!S._farFront) arm(cx, S.aF, white, tt, tr, false);

      const c0 = pt(-.05, 0), by = a.y + 2, gy0 = b.y, gy1 = a.y + 36, wf = clamp((a.y - gy0) / (gy1 - gy0), .2, .88);
      const fade = (c1, c2, c3) => { const g = cx.createLinearGradient(0, gy0, 0, gy1); g.addColorStop(0, c1); g.addColorStop(wf * .5, c2); g.addColorStop(wf, c3); g.addColorStop(wf + (1 - wf) * .6, c3.replace(/rgb\((.*)\)/, 'rgba($1,.7)')); g.addColorStop(1, c3.replace(/rgb\((.*)\)/, 'rgba($1,0)')); return g; };
      const hem = hemPts(c0[0], by, [[-14, 21], [-11.4, 24], [-8.8, 20], [-6, 24.5], [-3.2, 21], [.6, 25], [3.6, 20.5], [6.6, 24], [9.6, 20.5], [12.4, 23]], tr, tt, .6);
      const under = hemPts(c0[0], by, [[-12, 22], [-9.4, 26], [-6.8, 21], [-4, 26], [-1.2, 22], [2.2, 26], [4.8, 21.5], [7.4, 25], [10.2, 22]], tr, tt, .6);
      const Sb = pt(1.0, -13), Mb = pt(.5, -6.4), Wb = [c0[0] - 5.2 - tr * .2, a.y + 2], Wf = [c0[0] + 5, a.y + 2], Mf = pt(.5, 6), Sf = pt(1.0, 12), Nf = pt(1.1, 4.6), Nb = pt(1.1, -4.6);
      const robePath = () => {
        cx.beginPath(); cx.moveTo(Nb[0], Nb[1]); cx.lineTo(Sb[0], Sb[1]); cx.quadraticCurveTo(Mb[0], Mb[1], Wb[0], Wb[1]);
        hem.forEach(q => cx.lineTo(q[0], q[1])); cx.lineTo(Wf[0], Wf[1]); cx.quadraticCurveTo(Mf[0], Mf[1], Sf[0], Sf[1]); cx.lineTo(Nf[0], Nf[1]); cx.closePath();
      };
      const drape = [pt(.9, 1.5), pt(.52, 7), [c0[0] + 6.4, a.y + 2]].concat(hemPts(c0[0], by, [[10.5, 19], [8, 23], [5.5, 18.5], [3, 22], [.8, 18.5]], tr, tt, .6), [pt(.45, 1.2)]);
      const cape = Q([[1.12,-3],[1.03,-11],[.84,-12.6],[.66,-9.2],[.76,-7.6],[.56,-6.4],[.68,-4.6],[.54,-3.2],[.66,-1.4],[.52,.2],[.66,2],[.54,3.6],[.68,5.2],[.56,6.8],[.72,8.2],[.56,9.8],[.88,10.6],[1.03,9],[1.12,3.2]], 1.32);

      if(white){ poly(cx, under, '#fff'); robePath(); cx.fillStyle = '#fff'; cx.fill(); poly(cx, drape, '#fff'); poly(cx, cape, '#fff'); return; }

      cx.save(); cx.beginPath(); cx.rect(-400, -800, 800, 800.5); cx.clip();

      poly(cx, [[c0[0] - 6, a.y], [c0[0] + 6, a.y]].concat(under.slice().reverse()), fade('#0a0a0b', '#0a0a0b', 'rgb(8,8,9)'), null);

      const g = fade('#2d2d31', '#1b1b1e', 'rgb(16,16,18)');
      robePath(); cx.fillStyle = g; cx.fill();
      const gs = cx.createLinearGradient(0, gy0, 0, gy1); gs.addColorStop(0, INK); gs.addColorStop(wf, INK); gs.addColorStop(1, 'rgba(2,2,3,0)');
      cx.strokeStyle = gs; cx.lineWidth = .7; cx.lineJoin = 'round'; cx.stroke();
      const ge = cx.createLinearGradient(0, gy0, 0, gy1); ge.addColorStop(0, 'rgba(150,150,156,.4)'); ge.addColorStop(wf, 'rgba(150,150,156,.3)'); ge.addColorStop(1, 'rgba(150,150,156,0)');
      cx.strokeStyle = ge; cx.lineWidth = .55; cx.beginPath(); hem.forEach((q, i) => i ? cx.lineTo(q[0], q[1]) : cx.moveTo(q[0], q[1])); cx.stroke();
      for(let i = 0; i < 6; i++){
        const q = hem[1 + i * 2] || hem[hem.length - 2], w0 = -5.4 + i * 2.2;
        line(pt(.62, w0 * 1.25), [q[0], lerp(a.y + 2, q[1], .55)], (i % 2 ? 1 : -1) * 1.3, i % 2 ? DEEP : FOLD, .7);
      }

      for(let i = 0; i < under.length; i += 2) ribbon(cx, under[i][0], under[i][1] - 1, 10 + (i % 3) * 2.5, i * 1.3 + 2, tt, tr, .62);
      for(let i = 0; i < hem.length; i += 4) ribbon(cx, hem[i][0], hem[i][1] - 1, 8 + (i % 3) * 2, i * 2.1, tt, tr, .5);

      poly(cx, drape, fade('#323236', '#232326', 'rgb(20,20,23)'), null);
      cx.strokeStyle = gs; cx.lineWidth = .6; cx.beginPath(); drape.forEach((q, i) => i ? cx.lineTo(q[0], q[1]) : cx.moveTo(q[0], q[1])); cx.stroke();
      line(pt(.82, 3.4), [c0[0] + 6.6, a.y + 9], 1, DEEP, .7); line(pt(.7, 7), [c0[0] + 9, a.y + 8], -1, FOLD, .6);
      cx.strokeStyle = ge; cx.lineWidth = .5; cx.beginPath(); drape.slice(2, drape.length - 1).forEach((q, i) => i ? cx.lineTo(q[0], q[1]) : cx.moveTo(q[0], q[1])); cx.stroke();
      cx.restore();

      const cg = cx.createLinearGradient(b.x, b.y, a.x, a.y + 6); cg.addColorStop(0, '#3a3a3f'); cg.addColorStop(1, '#1d1d20');
      poly(cx, cape, cg, INK, .7);
      cx.strokeStyle = EDGE; cx.lineWidth = .6; cx.lineCap = 'round';
      [[0, 3], [15, 18]].forEach(([i0, i1]) => { cx.beginPath(); cape.slice(i0, i1).forEach((q, i) => i ? cx.lineTo(q[0], q[1]) : cx.moveTo(q[0], q[1])); cx.stroke(); });
      line(pt(1.06, -7), pt(.6, -8.6), .6, DEEP, .7); line(pt(1.06, -1.8), pt(.58, -2.6), -.5, DEEP, .7); line(pt(1.06, 2.8), pt(.58, 3.4), .5, DEEP, .7); line(pt(1.06, 7), pt(.62, 8.4), -.6, DEEP, .7);
    },

    fxBack(cx, f, t){
      const R = f.rit; if(!R) return;
      const x = f.x, y = f.y - f.h / 2, r = R.r, al = R.a == null ? 1 : R.a;
      const dt = R.lt == null ? 0 : Math.min(.05, Math.max(0, t - R.lt)); R.lt = t;
      const P = R.sm || (R.sm = []), floor = f.gr ? f.y : Infinity;
      const rate = 26 + 120 * (r / 190) * (r / 190);
      R.acc = (R.acc || 0) + dt * rate;
      while(R.acc >= 1){ R.acc--;
        const a = Math.random() * 6.283, d = Math.sqrt(Math.random()) * r * .92, px = Math.cos(a) * d, py = Math.sin(a) * d * .85 - r * .06;
        if(y + py > floor - 6) continue;
        P.push({x:px, y:py, vx:(Math.random() - .5) * 18, vy:-14 - Math.random() * 30, life:0, max:1.6 + Math.random() * 1.4, sz:(.16 + Math.random() * .16) * r + 8, rot:Math.random() * 6.283, vr:(Math.random() - .5) * .8, sd:Math.random() * 9});
      }
      for(let i = P.length - 1; i >= 0; i--){
        const q = P[i]; q.life += dt; if(q.life >= q.max){ P.splice(i, 1); continue; }
        q.x += (q.vx + Math.sin(t * 1.3 + q.sd) * 14) * dt; q.y += q.vy * dt; q.rot += q.vr * dt;
      }
      const spr = getSmoke();
      cx.save();
      if(f.gr){ cx.beginPath(); cx.rect(x - r * 2, y - r * 2, r * 4, floor - (y - r * 2)); cx.clip(); }
      const hz = cx.createRadialGradient(x, y, 4, x, y, r * .7);
      hz.addColorStop(0, 'rgba(3,3,4,' + (.5 * al) + ')'); hz.addColorStop(1, 'rgba(3,3,4,0)');
      cx.fillStyle = hz; cx.fillRect(x - r, y - r, r * 2, r * 2);
      P.forEach(q => {
        const k = q.life / q.max, d = Math.hypot(q.x, q.y) / r;
        const a = Math.sin(Math.PI * k) * .5 * al * Math.max(0, 1 - d * d * .8);
        if(a <= .01) return;
        const s = q.sz * (1 + k * .8);
        cx.globalAlpha = Math.min(1, a); cx.save(); cx.translate(x + q.x, y + q.y); cx.rotate(q.rot); cx.drawImage(spr, -s, -s, s * 2, s * 2); cx.restore();
      });
      cx.globalAlpha = 1; cx.restore();
    },

    gbHands(cx, H, t){
      const dir = H.dir, Y = H.y, spr = getSmoke();
      cx.beginPath(); cx.rect(-4000, -4000, 9000, 4000 + Y + 2); cx.clip();
      cx.lineCap = 'round'; cx.lineJoin = 'round';
      H.cl.forEach(c => {
        if(c.rise <= 0.01) return;
        const e = 1 - Math.pow(1 - c.rise, 3);
        cx.fillStyle = 'rgba(0,0,0,' + (.4 * e) + ')'; cx.beginPath(); cx.ellipse(c.x, Y, c.w * .8, 4.5, 0, 0, 7); cx.fill();
        for(let i = 0; i < 2; i++){
          const ph = t * .9 + c.x * .05 + i * 3, s = 15 + 7 * Math.sin(ph * 1.7);
          cx.globalAlpha = .22 + .35 * Math.sin(Math.PI * Math.min(1, c.rise)); cx.drawImage(spr, c.x - s + Math.sin(ph) * 9, Y - s * 1.1 - 4 - i * 6, s * 2, s * 2);
        }
        cx.globalAlpha = 1;
        c.hands.slice().sort((a, b) => a.oy - b.oy).forEach(h => {
          const sz = h.sz, ph = t * 5.4 + h.sd, lunge = Math.sin(ph), bx = c.x + h.ox, by = Y + 5 + h.oy * .4;
          const hh = (22 + 6 * Math.sin(ph * .5 + 1)) * sz * e, wx = bx + dir * (8 + 4 * lunge) * sz, wy = by - hh;
          cx.strokeStyle = '#060607'; cx.lineWidth = 5.2 * sz; cx.beginPath(); cx.moveTo(bx, by + 6); cx.quadraticCurveTo(bx - dir * 3, by - hh * .55, wx, wy); cx.stroke();
          cx.strokeStyle = 'rgba(130,130,136,.34)'; cx.lineWidth = .7; cx.beginPath(); cx.moveTo(bx - dir * 1.4, by + 6); cx.quadraticCurveTo(bx - dir * 4.4, by - hh * .55, wx - dir * 1.4, wy - 1); cx.stroke();
          cx.save(); cx.translate(wx, wy); cx.scale(dir, 1);
          cx.rotate(-.25 + lunge * .18);
          cx.fillStyle = '#0a0a0b'; cx.beginPath(); cx.ellipse(1, -1, 4.6 * sz, 3.6 * sz, -.5, 0, 7); cx.fill();
          for(let i = 0; i < 5; i++){
            const open = .5 + .5 * Math.sin(ph + i * .55), a0 = i === 4 ? .5 : -1.55 + i * .36, curl = (.25 + .6 * open) * (i === 4 ? .6 : 1);
            const L1 = (i === 4 ? 4 : 6.4) * sz, L2 = (i === 4 ? 3.4 : 5.8) * sz, L3 = 3.6 * sz;
            const x1 = Math.cos(a0) * L1, y1 = Math.sin(a0) * L1, a1 = a0 + curl * 1.05, x2 = x1 + Math.cos(a1) * L2, y2 = y1 + Math.sin(a1) * L2, a2 = a1 + curl * .95, x3 = x2 + Math.cos(a2) * L3, y3 = y2 + Math.sin(a2) * L3;
            cx.strokeStyle = '#060607'; cx.lineWidth = 1.9 * sz; cx.beginPath(); cx.moveTo(1, -2); cx.lineTo(x1, y1 - 1); cx.lineTo(x2, y2 - 1); cx.stroke();
            cx.strokeStyle = 'rgba(190,190,195,.75)'; cx.lineWidth = 1.05 * sz; cx.beginPath(); cx.moveTo(x2, y2 - 1); cx.lineTo(x3, y3 - 1); cx.stroke();
          }
          cx.restore();
        });
      });
    },

    shot(cx, s, t){
      const d = s.vx > 0 ? 1 : -1, x = s.x, y = s.y, r = s.r * (1 + Math.sin(s.age * 16) * .06), big = s.kind >= 2;
      cx.save(); cx.translate(x, y); cx.scale(d, 1); cx.translate(-x, -y);
      for(let i = 0; i < 12; i++){
        const k = i / 12, px = x - k * r * (big ? 8 : 6.5), py = y + Math.sin(s.age * 14 + i * .9) * r * .55 * k, pr = r * (.95 - .6 * k), a = .6 * (1 - k);
        cx.fillStyle = 'rgba(22,22,26,' + a + ')'; cx.beginPath(); cx.arc(px, py, pr, 0, 7); cx.fill();
        if(i % 2 === 0){ cx.fillStyle = 'rgba(96,96,102,' + a * .34 + ')'; cx.beginPath(); cx.arc(px + 1, py - 1, pr * .55, 0, 7); cx.fill(); }
      }
      const gl = cx.createRadialGradient(x, y, r * .4, x, y, r * 2.4);
      gl.addColorStop(0, 'rgba(0,0,0,.55)'); gl.addColorStop(.7, 'rgba(0,0,0,.14)'); gl.addColorStop(1, 'rgba(120,120,126,0)');
      cx.fillStyle = gl; cx.beginPath(); cx.arc(x, y, r * 2.4, 0, 7); cx.fill();
      cx.fillStyle = '#010102'; cx.beginPath(); cx.arc(x, y, r, 0, 7); cx.fill();
      cx.shadowColor = 'rgba(170,170,176,.55)'; cx.shadowBlur = big ? 9 : 6; cx.strokeStyle = 'rgba(170,170,176,.75)'; cx.lineWidth = big ? 1.9 : 1.3; cx.stroke(); cx.shadowBlur = 0;
      cx.strokeStyle = 'rgba(96,96,102,.5)'; cx.lineWidth = 1;
      for(let i = 0; i < 3; i++){ const a = s.age * 6 + i * 2.1; cx.beginPath(); cx.arc(x, y, r * (.45 + i * .15), a, a + 1.4); cx.stroke(); }
      for(let i = 0; i < (big ? 6 : 3); i++){
        const a = s.age * 9 + i * (6.283 / (big ? 6 : 3));
        cx.fillStyle = 'rgba(175,175,181,.75)'; cx.beginPath(); cx.arc(x + Math.cos(a) * r * 1.5, y + Math.sin(a) * r * 1.15, big ? 1.7 : 1.1, 0, 7); cx.fill();
      }
      cx.restore();
    }
  });
})();