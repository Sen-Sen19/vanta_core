// MIETTE art - "The Little Creator". Chibi painter: BIG head, short limbs, beret, paint smock, GIANT paintbrush.
// Same shared ragdoll (body.js): only sizes, colors, poses and effects. Hitbox is still 30x52 (arena.js is not changed per character).
// Hooks used: body (sizes), colors, farFront, torso() = paint smock, pose() = idle / run stance, spring() + attack() = 3-hit brush combo,
//             behind() = pigtail, front() = face + beret + brush + paint effects, shot() = how a flying paint blob looks.
//
// BRUSH: she holds it in the NEAR hand. The brush angle is animated by art.js (BR keys below), the hand just carries it.
//   Every hit dips the brush in a new paint color (pink -> teal -> yellow). The trail, splatter and idle doodles use that color.
// COMBO (A.step 0,1,2 - wraps around if skills.js has more hits):
//   1 OVERHEAD CHOP  - brush goes up and back, then chops down in front.
//   2 DAB / POKE     - hand pulls back, then jabs the brush tip straight forward (long reach).
//   3 UPWARD FLING   - crouch low, brush drags near the ground, then flings up and forward + a big paint splash.
// CONTACT = the moment of the hit (p = 0..1 over the swing). Keep skills.js hitFrom in step with it: hit opens at p = 1 - hitFrom/time.
//   suggested basic.combo in skills.js:  time .50 / .44 / .66   hitFrom .25 / .26 / .30   reach ~46 / 52 / 44   chargeP .40 / .40 / .42
// CHARGE (optional, same hold-ATK system as the other characters): chargeP should match CHARGE_P below (where the wind-up ends).
//   While held she DRAWS a glowing dashed circle at the brush tip that grows with the charge (f.charging / A.cl).
// SETTINGS (top of the file): easy things to tweak.
(() => {
  // ---------- SETTINGS ----------
  const BRUSH_LEN = 38;                 // hand -> bristle tip (px). Bigger = more giant.
  const IDLE_B    = 2.45;               // idle brush angle: 0 = down, 1.57 = forward, 3.14 = up
  const CONTACT   = [.5, .46, .56];     // hit moment of each combo step
  const CHARGE_P  = [.4, .4, .42];      // wind-up end of each step (= chargeP in skills.js)
  const PAINT = [                       // c = paint, d = dark edge, l = light shine
    {c:'#ff5fa2', d:'#c93d79', l:'#ffb3d3'},
    {c:'#2fd0c4', d:'#1b8f87', l:'#a6f3ec'},
    {c:'#ffd23f', d:'#d9a21a', l:'#fff0a8'}
  ];
  const HAIR = '#6b3f2a', HAIR_L = '#9a6140', WOOD = '#e9b36f', FERR = '#cfd6e2', OUT = '#0b0f1c';
  const HR = 8.8, T = 9, SH = 8.5;      // head radius, thigh, shin (must match body below)

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const K = (p, k) => Body.keys(p, k);
  const rnd = i => { const x = Math.sin(i * 127.1 + 7.3) * 43758.5; return x - Math.floor(x); };

  // knee angle that puts the ankle at height Y for thigh angle th, so BOTH feet stay on the same ground height (no floating foot)
  const legK = (th, Y) => { const a = Math.acos(clamp((Y - T * Math.cos(th)) / SH, -1, 1)); const k = th - a; return k > .05 ? k : th + a; };

  // ---------- COMBO KEYS: [[p, value], ...]. Angles: 0 = hangs down, + = forward, 3.14 = straight up. br = brush angle. Y = hip height (crouch). ----------
  const STEP = [
    { // 1 OVERHEAD CHOP: up + back (windup), chop down in front at p .5
      aN:[[0,.35],[.15,1.8],[.3,2.9],[.4,3.0],[.5,1.35],[.6,1.1],[.8,.7],[1,.35]],
      eN:[[0,1.7],[.3,.6],[.4,.5],[.5,.25],[.6,.3],[.8,1.2],[1,1.7]],
      aF:[[0,-.1],[.3,-.9],[.4,-.9],[.5,.5],[.8,.1],[1,-.1]], eF:[[0,.5],[.3,.9],[.5,.4],[1,.5]],
      lean:[[0,.05],[.3,-.3],[.4,-.34],[.5,.4],[.6,.44],[.8,.2],[1,.05]],
      head:[[0,0],[.3,.2],[.5,-.2],[.7,-.1],[1,0]],
      tN:[[0,.26],[.3,-.1],[.5,.55],[.8,.45],[1,.26]], tF:[[0,-.2],[.3,-.35],[.5,-.55],[.8,-.35],[1,-.2]],
      Y:[[0,17],[.3,16.8],[.4,16.8],[.5,14],[.8,15.5],[1,17]],
      br:[[0,IDLE_B],[.15,3.4],[.3,3.95],[.4,4.05],[.5,1.4],[.6,1.0],[.8,1.7],[1,IDLE_B]]
    },
    { // 2 DAB / POKE: pull the hand back, jab the tip forward at p .46
      aN:[[0,.35],[.12,0],[.3,-.55],[.4,-.55],[.46,1.5],[.58,1.55],[.8,1.0],[1,.35]],
      eN:[[0,1.7],[.3,2.1],[.4,2.1],[.46,.12],[.58,.1],[.8,1.0],[1,1.7]],
      aF:[[0,-.1],[.3,.9],[.46,.4],[1,-.1]], eF:[[0,.5],[.3,1.7],[1,.5]],
      lean:[[0,.05],[.3,-.2],[.4,-.22],[.46,.35],[.58,.4],[.8,.15],[1,.05]],
      head:[[0,0],[.3,.1],[.46,-.15],[1,0]],
      tN:[[0,.26],[.3,0],[.46,.6],[.8,.45],[1,.26]], tF:[[0,-.2],[.3,-.4],[.46,-.5],[.8,-.35],[1,-.2]],
      Y:[[0,17],[.3,15.2],[.4,15.2],[.46,14.4],[.8,15.5],[1,17]],
      br:[[0,IDLE_B],[.2,1.9],[.3,1.7],[.4,1.65],[.46,1.5],[.58,1.5],[.8,1.9],[1,IDLE_B]]
    },
    { // 3 UPWARD FLING: crouch, brush low, then up-forward at p .56 + big splash
      aN:[[0,.35],[.15,.2],[.3,-.2],[.42,-.3],[.56,1.9],[.7,2.1],[.88,1.2],[1,.35]],
      eN:[[0,1.7],[.3,1.4],[.42,1.4],[.56,.5],[.7,.4],[.88,1.0],[1,1.7]],
      aF:[[0,-.1],[.3,.3],[.42,.3],[.56,1.7],[.7,1.8],[1,-.1]], eF:[[0,.5],[.3,1.3],[.42,1.3],[.56,.4],[.7,.4],[1,.5]],
      lean:[[0,.05],[.3,.35],[.42,.38],[.56,-.25],[.7,-.3],[.9,-.1],[1,.05]],
      head:[[0,0],[.3,-.15],[.56,.2],[1,0]],
      tN:[[0,.26],[.3,.55],[.42,.55],[.56,.3],[.8,.3],[1,.26]], tF:[[0,-.2],[.3,-.5],[.42,-.5],[.56,-.25],[.8,-.25],[1,-.2]],
      Y:[[0,17],[.3,13.4],[.42,13.4],[.56,16.2],[1,17]],
      br:[[0,IDLE_B],[.25,1.2],[.42,1.05],[.56,2.5],[.7,3.0],[.9,2.7],[1,IDLE_B]]
    }
  ];
  const JK = ['aN','eN','aF','eF','lean','head','tN','tF'];

  // ---------- per-fighter state (kept on f.mi): smoothed brush angle, trail points, paint color, drips ----------
  const M = f => f.mi || (f.mi = {ang:IDLE_B, last:null, pts:[], A:null, sp:null, col:0, face:f.face, drips:[], dripT:0});

  // ---------- drawing helpers ----------
  const poly = (cx, pts) => { cx.beginPath(); pts.forEach((q, i) => i ? cx.lineTo(q.x, q.y) : cx.moveTo(q.x, q.y)); cx.closePath(); };

  // the giant brush. h = hand position, ang = brush angle, pa = paint color. Butt end is behind the hand, bristles at BRUSH_LEN.
  function drawBrush(cx, h, ang, pa){
    const ux = Math.sin(ang), uy = Math.cos(ang), nx = -uy, ny = ux;
    const pt = (s, w) => ({x:h.x + ux * s + nx * w, y:h.y + uy * s + ny * w});
    const cap = (a, b, w, col) => Body.capsule(cx, a, b, w, col);
    cx.lineJoin = 'round';
    cap(pt(-8, 0), pt(15, 0), 7.2, OUT); cap(pt(-8, 0), pt(15, 0), 4, WOOD);                        // handle
    cap(pt(-1.5, 0), pt(2.5, 0), 4.1, '#ff5fa2'); cap(pt(5.5, 0), pt(7, 0), 4.1, '#2fd0c4');        // paint bands
    cx.fillStyle = FERR; cx.strokeStyle = OUT; cx.lineWidth = 1.5;                                  // metal ferrule
    poly(cx, [pt(14, -2.2), pt(20, -3.2), pt(20, 3.2), pt(14, 2.2)]); cx.fill(); cx.stroke();
    cx.strokeStyle = 'rgba(0,0,0,.3)'; cx.lineWidth = 1; cx.beginPath(); const c1 = pt(16.5, -2.7), c2 = pt(16.5, 2.7); cx.moveTo(c1.x, c1.y); cx.lineTo(c2.x, c2.y); cx.stroke();
    const tip = pt(BRUSH_LEN, 0), g = cx.createLinearGradient(pt(20, 0).x, pt(20, 0).y, tip.x, tip.y);   // bristles (full of paint)
    g.addColorStop(0, pa.d); g.addColorStop(.55, pa.c); g.addColorStop(1, pa.c);
    cx.beginPath(); const m = pt(20, -3.2); cx.moveTo(m.x, m.y);
    cx.bezierCurveTo(pt(24, -7.4).x, pt(24, -7.4).y, pt(BRUSH_LEN - 7, -6.2).x, pt(BRUSH_LEN - 7, -6.2).y, tip.x, tip.y);
    cx.bezierCurveTo(pt(BRUSH_LEN - 7, 6.2).x, pt(BRUSH_LEN - 7, 6.2).y, pt(24, 7.4).x, pt(24, 7.4).y, pt(20, 3.2).x, pt(20, 3.2).y);
    cx.closePath(); cx.fillStyle = g; cx.fill(); cx.strokeStyle = OUT; cx.lineWidth = 1.5; cx.stroke();
    cx.strokeStyle = pa.l; cx.globalAlpha = .75; cx.lineWidth = 1.3; cx.lineCap = 'round';           // shine + bristle lines
    cx.beginPath(); const s1 = pt(23, -3.6), s2 = pt(BRUSH_LEN - 8, -2.6); cx.moveTo(s1.x, s1.y); cx.lineTo(s2.x, s2.y); cx.stroke();
    cx.strokeStyle = pa.d; cx.lineWidth = .8; cx.beginPath(); const b1 = pt(23, 2.2), b2 = pt(BRUSH_LEN - 6, 1.6); cx.moveTo(b1.x, b1.y); cx.lineTo(b2.x, b2.y); cx.stroke();
    cx.globalAlpha = 1;
    return tip;
  }

  // near / far arm drawn again on top of the face (the default ragdoll draws arms before my face, so a raised hand must be redrawn)
  function arm(cx, A, P, white, hand){
    const col = white ? '#fff' : P.limb;
    Body.capsule(cx, A.s, A.el, 3.8 + 3.2, OUT); Body.capsule(cx, A.el, A.hand, 3.4 + 3.2, OUT);
    Body.capsule(cx, A.s, A.el, 3.8, col); Body.capsule(cx, A.el, A.hand, 3.4, col);
    if(hand){ cx.fillStyle = OUT; cx.beginPath(); cx.arc(A.hand.x, A.hand.y, 3 + 1.6, 0, 7); cx.fill();
              cx.fillStyle = white ? '#fff' : P.hand; cx.beginPath(); cx.arc(A.hand.x, A.hand.y, 3, 0, 7); cx.fill(); }
  }

  // face + hair + beret, drawn in the head's own rotated space (x = forward, y = down). It first covers the default ragdoll visor.
  function face(cx, f, t, S, P, white, mood){
    const rot = S.lean + ((f.rig && f.rig.j && f.rig.j.head.a) || 0);
    cx.save(); cx.translate(S.head.x, S.head.y); cx.rotate(rot); cx.lineJoin = 'round'; cx.lineCap = 'round';
    cx.save(); cx.beginPath(); cx.arc(0, 0, HR, 0, 7); cx.clip();
    cx.fillStyle = white ? '#fff' : P.head; cx.fillRect(0, -4.6, HR + 2, 7.4);                      // hides the visor
    // hair cap: back + top + a wavy fringe over the forehead
    cx.beginPath(); cx.moveTo(-HR - 2, HR * .7); cx.lineTo(-HR - 2, -HR - 2); cx.lineTo(HR + 2, -HR - 2); cx.lineTo(HR + 2, -HR * .36);
    cx.quadraticCurveTo(HR * .9, -HR * .55, HR * .66, -HR * .3); cx.quadraticCurveTo(HR * .42, -HR * .62, HR * .14, -HR * .34);
    cx.quadraticCurveTo(-HR * .05, -HR * .1, -HR * .2, HR * .3); cx.quadraticCurveTo(-HR * .36, HR * .72, -HR * .62, HR * .8); cx.lineTo(-HR - 2, HR * .7); cx.closePath();
    cx.fillStyle = white ? '#fff' : HAIR; cx.fill(); cx.strokeStyle = OUT; cx.lineWidth = 1.2; cx.stroke();
    if(!white){
      cx.strokeStyle = HAIR_L; cx.lineWidth = 1.3; cx.beginPath(); cx.arc(-HR * .1, -HR * .15, HR * .78, -2.5, -1.35); cx.stroke();   // shine
      const ex = HR * .46, ey = HR * .1;
      if(mood === 'hurt'){                                                                          // > < eye
        cx.strokeStyle = '#2a1030'; cx.lineWidth = 1.7; cx.beginPath(); cx.moveTo(ex - 2.6, ey - 2.6); cx.lineTo(ex + 1.6, ey); cx.lineTo(ex - 2.6, ey + 2.6); cx.stroke();
      } else if((t % 3.4) < .12){                                                                   // blink
        cx.strokeStyle = '#2a1030'; cx.lineWidth = 1.5; cx.beginPath(); cx.moveTo(ex - 2.6, ey + .4); cx.quadraticCurveTo(ex, ey + 2, ex + 2.6, ey + .4); cx.stroke();
      } else {
        cx.fillStyle = '#fff'; cx.beginPath(); cx.ellipse(ex, ey, 2.8, 3.6, 0, 0, 7); cx.fill();   // eye white
        const ig = cx.createLinearGradient(0, ey - 3, 0, ey + 3.4); ig.addColorStop(0, '#3a2a8f'); ig.addColorStop(1, '#2fa8d0');
        cx.fillStyle = ig; cx.beginPath(); cx.ellipse(ex + .5, ey + .3, 2.2, 3.1, 0, 0, 7); cx.fill();   // iris
        cx.fillStyle = '#120a2a'; cx.beginPath(); cx.ellipse(ex + .7, ey + .3, 1.1, 1.8, 0, 0, 7); cx.fill();   // pupil
        cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(ex + 1.3, ey - 1.3, 1.05, 0, 7); cx.fill(); cx.beginPath(); cx.arc(ex - .2, ey + 1.5, .55, 0, 7); cx.fill();   // sparkles
        cx.strokeStyle = '#2a1030'; cx.lineWidth = 1.3; cx.beginPath(); cx.ellipse(ex, ey, 2.8, 3.6, 0, Math.PI * 1.05, Math.PI * 1.95); cx.stroke();   // upper lash
        if(mood === 'sly'){ cx.fillStyle = HAIR; cx.beginPath(); cx.moveTo(ex - 3.3, ey - 4.2); cx.lineTo(ex + 3.4, ey - 1.6); cx.lineTo(ex + 3.4, ey - 4.2); cx.closePath(); cx.fill();   // lowered lid = mischievous
                              cx.strokeStyle = '#2a1030'; cx.lineWidth = 1.4; cx.beginPath(); cx.moveTo(ex - 3, ey - 2.9); cx.lineTo(ex + 3.2, ey - 1.1); cx.stroke(); }
      }
      cx.strokeStyle = HAIR; cx.lineWidth = 1.3; cx.beginPath();                                    // eyebrow
      if(mood === 'sly') { cx.moveTo(ex - 2.6, ey - 6.9); cx.lineTo(ex + 3, ey - 4.7); } else { cx.moveTo(ex - 2.4, ey - 5.6); cx.quadraticCurveTo(ex, ey - 6.7, ex + 2.8, ey - 5.8); }
      cx.stroke();
      cx.fillStyle = 'rgba(255,100,140,.55)'; cx.beginPath(); cx.ellipse(HR * .34, HR * .52, 2.7, 1.5, 0, 0, 7); cx.fill();   // blush
      const mx = HR * .64, my = HR * .58;                                                          // mouth
      if(mood === 'hurt'){ cx.fillStyle = '#6a1f2f'; cx.beginPath(); cx.ellipse(mx, my, 1.1, 1.4, 0, 0, 7); cx.fill(); }
      else if(mood === 'sly'){ cx.fillStyle = '#6a1f2f'; cx.beginPath(); cx.arc(mx, my - .4, 2, 0, Math.PI); cx.closePath(); cx.fill();
                               cx.fillStyle = '#ff7a9a'; cx.beginPath(); cx.ellipse(mx, my + .9, 1.1, .7, 0, 0, 7); cx.fill();
                               cx.fillStyle = '#fff'; cx.beginPath(); cx.moveTo(mx + .6, my - .4); cx.lineTo(mx + 1.8, my - .4); cx.lineTo(mx + 1.2, my + .9); cx.fill(); }
      else { cx.strokeStyle = '#6a2a3a'; cx.lineWidth = 1.2; cx.beginPath(); cx.moveTo(mx - 1.8, my); cx.quadraticCurveTo(mx, my + 1.7, mx + 2, my - .7); cx.stroke();   // smirk
             cx.fillStyle = '#fff'; cx.beginPath(); cx.moveTo(mx + .7, my + .5); cx.lineTo(mx + 1.8, my - .1); cx.lineTo(mx + 1.4, my + 1.1); cx.fill(); }   // tiny fang
    }
    cx.restore();
    // beret (tilted back, little stem, star pin)
    cx.beginPath(); cx.moveTo(-HR * .95, -HR * .5); cx.quadraticCurveTo(-HR * 1.05, -HR * 1.3, HR * .05, -HR * 1.28);
    cx.quadraticCurveTo(HR * 1.05, -HR * 1.22, HR * .98, -HR * .46); cx.quadraticCurveTo(HR * .3, -HR * .72, -HR * .95, -HR * .5); cx.closePath();
    cx.fillStyle = white ? '#fff' : '#ff5fa2'; cx.fill(); cx.strokeStyle = OUT; cx.lineWidth = 1.4; cx.stroke();
    if(!white){
      cx.strokeStyle = '#ffa6cb'; cx.lineWidth = 1.2; cx.beginPath(); cx.arc(-HR * .05, -HR * .55, HR * .62, -2.6, -1.5); cx.stroke();
      cx.fillStyle = '#ffd23f'; cx.beginPath(); cx.arc(HR * .62, -HR * .74, 1.5, 0, 7); cx.fill();
    }
    cx.fillStyle = white ? '#fff' : '#c93d79'; cx.beginPath(); cx.arc(-HR * .2, -HR * 1.3, 1.6, 0, 7); cx.fill(); cx.stroke();
    cx.restore();
  }

  // a doodle she "draws into existence": partial polyline, frac 0..1 = how much is drawn so far
  const SHAPES = [
    (() => { const o = []; [0, 2, 4, 1, 3, 0].forEach(i => { const a = -Math.PI / 2 + i * Math.PI * 2 / 5; o.push({x:Math.cos(a), y:Math.sin(a)}); }); return o; })(),    // star
    (() => { const o = []; for(let i = 0; i <= 24; i++){ const a = i / 24 * Math.PI * 2; o.push({x:Math.pow(Math.sin(a), 3), y:-(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 16}); } return o; })(),   // heart
    (() => { const o = []; for(let i = 0; i <= 28; i++){ const a = i / 28 * Math.PI * 4; o.push({x:Math.cos(a) * a / 12.6, y:Math.sin(a) * a / 12.6}); } return o; })()   // spiral
  ];
  function doodle(cx, kind, x, y, size, frac, col){
    const pts = SHAPES[kind % 3], n = pts.length - 1, e = clamp(frac, 0, 1) * n, whole = Math.floor(e);
    cx.strokeStyle = col; cx.lineWidth = 1.5; cx.lineCap = 'round'; cx.lineJoin = 'round'; cx.beginPath();
    for(let i = 0; i <= whole && i <= n; i++) i ? cx.lineTo(x + pts[i].x * size, y + pts[i].y * size) : cx.moveTo(x + pts[0].x * size, y + pts[0].y * size);
    if(whole < n){ const a = pts[whole], b = pts[whole + 1], k = e - whole; cx.lineTo(x + (a.x + (b.x - a.x) * k) * size, y + (a.y + (b.y - a.y) * k) * size); }
    cx.stroke();
  }

  Characters.art('miette', {
    // chibi: big head, short body and limbs. Whole thing is still about 52 px tall.
    body: {head:{r:HR}, torso:{len:9, w:9}, uArm:{len:7.5, w:3.8}, fArm:{len:7, w:3.4}, hand:{r:3}, shN:1, shF:-2,
           thigh:{len:T, w:5}, shin:{len:SH, w:4.4}, foot:{len:7.5, w:3.8}, headSink:1, belt:3.2},
    // cream smock, bare arms (skin), teal tights, brown boots + belt
    colors: {shirt:'#fff1de', limb:'#ffd9c0', far:'#e6b79b', head:'#ffd9c0', dark:'#6b3f2a', hand:'#ffd9c0', legs:'#3aa6a0', legsFar:'#277a76'},

    // the far hand is only used on step 3 (two-handed fling): draw it over the body so it is visible
    farFront: f => f.atk > 0 && !!f.A && ((f.A.step || 0) % 3) === 2,

    // paint smock: A-line, flares out at the hem, with paint splats. (a = up the torso, b = forward)
    torso(cx, S, B, P, white){
      const l = S.lean, ux = Math.sin(l), uy = -Math.cos(l), fx = Math.cos(l), fy = Math.sin(l);
      const pt = (a, b) => ({x:S.pel.x + ux * a + fx * b, y:S.pel.y + uy * a + fy * b});
      const pts = [pt(9.6, -4.4), pt(10.4, 0), pt(9.6, 4.6), pt(4.5, 5.6), pt(-1, 7.8), pt(-3.8, 5), pt(-4, 0), pt(-3.8, -5), pt(-1, -7.8), pt(4.5, -5.6)];
      const mid = (p, q) => ({x:(p.x + q.x) / 2, y:(p.y + q.y) / 2}), n = pts.length, m0 = mid(pts[n - 1], pts[0]);
      cx.beginPath(); cx.moveTo(m0.x, m0.y);
      for(let i = 0; i < n; i++){ const m = mid(pts[i], pts[(i + 1) % n]); cx.quadraticCurveTo(pts[i].x, pts[i].y, m.x, m.y); }
      cx.closePath(); cx.fillStyle = white ? '#fff' : P.shirt; cx.fill(); cx.strokeStyle = B.outline; cx.lineWidth = B.outlineW; cx.stroke();
      if(!white){
        cx.lineCap = 'round';
        const a = pt(-3.2, -5.3), b = pt(-3.2, 5.7); cx.strokeStyle = '#ff5fa2'; cx.lineWidth = 1.4; cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); cx.stroke();   // hem trim
        [[2.6, 2.8, 1.6, 0], [5.8, -1.8, 1.2, 2], [.4, -3, 1.3, 1], [-.8, 3.6, 1, 2], [6.8, 3, .9, 1]].forEach(s => {   // paint splats
          const q = pt(s[0], s[1]); cx.fillStyle = PAINT[s[3]].c; cx.beginPath(); cx.arc(q.x, q.y, s[2], 0, 7); cx.fill();
        });
      }
    },

    // idle / run: near hand holds the brush steady in front (it does not swing with the run), head tilts curiously
    pose(tg, f, t, run){
      const idle = 1 - run, b = Math.sin(t * 2.2);
      tg.aN = .35 + b * .03 + run * .15; tg.eN = 1.7 - run * .15;
      tg.head += idle * Math.sin(t * 1.6) * .07 + run * Math.sin(t * 16) * .03;
      tg.lean += idle * b * .015;
    },

    // soft + bouncy while she winds up, snappy at the hit, medium after
    spring(p, A){
      const c = CONTACT[(A.step || 0) % 3];
      if(A.chg > 0 && p <= CHARGE_P[(A.step || 0) % 3] + .004) return {k:170, d:16};
      if(p < c - .12) return {k:130, d:14};
      if(p < c + .1) return {k:520, d:34};
      return {k:190, d:20};
    },

    attack(tg, p, A, Kf){
      const s = STEP[(A.step || 0) % 3], L = A.cl || 0, hold = A.chg > 0 && p <= CHARGE_P[(A.step || 0) % 3] + .004;
      JK.forEach(j => tg[j] = Kf(p, s[j]));
      if(hold){ tg.lean -= .1 * L; tg.head += .1 * L; }                                    // charging: leans back, looks up at the circle she draws
      const Y = Math.min(Kf(p, s.Y) - (hold ? 1.6 * L : 0), .97 * (T + SH) * Math.min(Math.cos(tg.tN), Math.cos(tg.tF)));
      tg.kN = legK(tg.tN, Y); tg.kF = legK(tg.tF, Y);
    },

    // one pigtail swinging behind her head (flies up when she falls, streams back when she runs). Tip is dipped in her current paint.
    behind(cx, f, t, S, P){
      const mi = M(f), white = f.flash > 0, rot = S.lean + ((f.rig && f.rig.j && f.rig.j.head.a) || 0), c = Math.cos(rot), s = Math.sin(rot);
      const ox = -HR * .78, oy = HR * .05;
      let x = S.head.x + ox * c - oy * s, y = S.head.y + ox * s + oy * c;
      const run = clamp(Math.abs(f.vx) / 170, 0, 1);
      const base = .4 + run * .5 - clamp(f.vy * .0012, -.5, .8) + (f.stun > 0 ? Math.sin(t * 30) * .4 : 0);
      for(let i = 0; i < 3; i++){
        const ang = base + i * .25 + Math.sin(t * 6 + i * .9) * (.08 + .1 * run), len = 5.2 - i * .4, nx = x - Math.sin(ang) * len, ny = y + Math.cos(ang) * len, w = 5.4 - i * 1.1;
        Body.capsule(cx, {x, y}, {x:nx, y:ny}, w + 3.2, OUT); Body.capsule(cx, {x, y}, {x:nx, y:ny}, w, white ? '#fff' : HAIR);
        x = nx; y = ny;
      }
      cx.fillStyle = OUT; cx.beginPath(); cx.arc(x, y, 3.3, 0, 7); cx.fill();
      cx.fillStyle = white ? '#fff' : PAINT[mi.col].c; cx.beginPath(); cx.arc(x, y, 2, 0, 7); cx.fill();
    },

    front(cx, f, t, S, P){
      const white = f.flash > 0, hurt = f.stun > 0, atk = f.atk > 0 && !!f.A, A = f.A || {}, step = atk ? (A.step || 0) % 3 : 0;
      const p = atk ? clamp(1 - f.atk / A.time, 0, 1) : -1, mi = M(f), dt = mi.last == null ? 0 : clamp(t - mi.last, 0, .05);
      mi.last = t;
      if(mi.face !== f.face){ mi.pts.length = 0; mi.drips.length = 0; mi.face = f.face; }
      if(atk && !hurt){ if(mi.A !== A){ mi.A = A; mi.sp = null; } mi.col = step; }
      const pa = PAINT[mi.col], run = clamp(Math.abs(f.vx) / 170, 0, 1);

      // 1) face, hair, beret
      face(cx, f, t, S, P, white, hurt ? 'hurt' : atk ? 'sly' : 'happy');

      // 2) near arm on top of the face again
      arm(cx, S.aN, P, white, false);

      // 3) brush angle: keyed while attacking, smoothed in every other state
      let tgt, rate = 12;
      if(atk && !hurt) mi.ang = K(p, STEP[step].br);
      else {
        if(hurt){ tgt = .3 + Math.sin(t * 28) * .5; rate = 20; }
        else if(!f.gr){ tgt = f.vy < 0 ? 2.9 : 2.0; rate = 9; }
        else tgt = IDLE_B - run * .35 + Math.sin(t * 2.2) * .05 * (1 - run) + Math.sin(t * 14) * .05 * run;
        mi.ang += (tgt - mi.ang) * Math.min(1, dt * rate);
      }
      const h = S.aN.hand, tipP = {x:h.x + Math.sin(mi.ang) * BRUSH_LEN, y:h.y + Math.cos(mi.ang) * BRUSH_LEN};

      // 4) paint trail behind the brush (only around the hit)
      if(atk && !hurt){ const last = mi.pts[mi.pts.length - 1]; if(!last || last.t !== t) mi.pts.push({x:tipP.x, y:tipP.y, t}); }
      while(mi.pts.length && t - mi.pts[0].t > .16) mi.pts.shift();
      if(atk && !hurt && p > CONTACT[step] - .24 && p < CONTACT[step] + .3 && mi.pts.length > 1){
        cx.lineCap = 'round';
        for(let pass = 0; pass < 2; pass++) for(let i = 1; i < mi.pts.length; i++){
          const k = i / mi.pts.length; cx.strokeStyle = pass ? pa.l : pa.c; cx.globalAlpha = pass ? .35 + .5 * k : .25 + .6 * k;
          cx.lineWidth = (2 + 10 * k) * (pass ? .35 : 1); cx.beginPath(); cx.moveTo(mi.pts[i - 1].x, mi.pts[i - 1].y); cx.lineTo(mi.pts[i].x, mi.pts[i].y); cx.stroke();
        }
        cx.globalAlpha = 1;
      }

      // 5) the brush + the hand gripping it
      drawBrush(cx, h, mi.ang, pa);
      cx.fillStyle = OUT; cx.beginPath(); cx.arc(h.x, h.y, 4.6, 0, 7); cx.fill();
      cx.fillStyle = white ? '#fff' : P.hand; cx.beginPath(); cx.arc(h.x, h.y, 3, 0, 7); cx.fill();

      // 6) paint splash at the hit (step 3 = bigger)
      const late = step === 2 ? .07 : 0;                                                      // the fling splash starts a bit later, when the tip is out in front
      if(atk && !hurt && p >= CONTACT[step] + late && p < CONTACT[step] + .34){
        if(!mi.sp) mi.sp = {x:tipP.x, y:tipP.y};
        const k = (p - CONTACT[step] - late) / (.34 - late), big = step === 2 ? 1.6 : 1, nBlob = step === 2 ? 14 : 9;
        for(let i = 0; i < nBlob; i++){
          const a = -1.5 + rnd(i) * 2.1, sp = (20 + 40 * rnd(i + 9)) * big;
          const x = mi.sp.x + Math.cos(a) * sp * k, y = mi.sp.y + Math.sin(a) * sp * k + 26 * k * k * big;
          cx.globalAlpha = 1 - k * k; cx.fillStyle = OUT; cx.beginPath(); cx.arc(x, y, (1.2 + 2.3 * rnd(i + 3)) * (1 - k * .5) * big + .9, 0, 7); cx.fill();
          cx.fillStyle = i % 3 ? pa.c : pa.l; cx.beginPath(); cx.arc(x, y, (1.2 + 2.3 * rnd(i + 3)) * (1 - k * .5) * big, 0, 7); cx.fill();
        }
        if(k < .45){ cx.globalAlpha = 1 - k / .45; cx.strokeStyle = pa.l; cx.lineWidth = 2.2 * (1 - k) + .5; cx.beginPath(); cx.arc(mi.sp.x, mi.sp.y, (5 + 22 * k) * big, 0, 7); cx.stroke(); }
        cx.globalAlpha = 1;
      }

      // 7) CHARGE: she draws a dashed circle in the air at the brush tip, it grows + glows the longer ATK is held
      if(f.charging && A.chg > 0){
        const cl = clamp(A.cl || 0, 0, 1), r = 5 + 14 * cl, cxp = tipP.x + 2, cyp = tipP.y - 2;
        const gl = cx.createRadialGradient(cxp, cyp, 1, cxp, cyp, r * 1.8); gl.addColorStop(0, pa.l + 'cc'); gl.addColorStop(1, pa.c + '00');
        cx.fillStyle = gl; cx.beginPath(); cx.arc(cxp, cyp, r * 1.8, 0, 7); cx.fill();
        cx.strokeStyle = pa.c; cx.lineWidth = 1.8; cx.setLineDash([3, 3]); cx.lineDashOffset = -t * 20; cx.beginPath(); cx.arc(cxp, cyp, r, 0, 7); cx.stroke(); cx.setLineDash([]);
        for(let i = 0; i < 4; i++){ const a = t * 5 + i * 1.571; cx.fillStyle = pa.l; cx.beginPath(); cx.arc(cxp + Math.cos(a) * (r + 3), cyp + Math.sin(a) * (r + 3), 1.4, 0, 7); cx.fill(); }
        if(cl >= 1) doodle(cx, 0, cxp, cyp, r * .6, 1, Math.sin(t * 40) > 0 ? '#fff' : pa.l);               // FULL: a star is drawn inside
      }

      // 8) idle life: she doodles a star / heart / spiral near the brush tip, and the bristles drip
      if(!atk && !hurt && f.gr && run < .3){
        const cyc = t * .36, kind = Math.floor(cyc) % 3, k = cyc - Math.floor(cyc);
        if(k < .85) doodle(cx, kind, tipP.x + 3, tipP.y - 13, 5.5, k / .5, pa.c);
        mi.dripT += dt;
        if(mi.dripT > 1.1){ mi.dripT = 0; mi.drips.push({x:tipP.x, y:tipP.y + 1, vy:0, life:.9}); }
      }
      for(let i = mi.drips.length - 1; i >= 0; i--){
        const d = mi.drips[i]; d.vy += 420 * dt; d.y += d.vy * dt; d.life -= dt;
        if(d.life <= 0 || d.y > 0){ mi.drips.splice(i, 1); continue; }
        cx.globalAlpha = clamp(d.life * 3, 0, 1); cx.fillStyle = pa.c; cx.beginPath(); cx.arc(d.x, d.y, 1.4, 0, 7); cx.fill(); cx.globalAlpha = 1;
      }
    },

    // the flying paint blob (arena.js calls this when skills.js gives her a shot). s = {x, y, r, vx, age, kind}; kind 0/1/2 = pink/teal/yellow, 3 = charged (cycles colors)
    shot(cx, s, t){
      const d = s.vx > 0 ? 1 : -1, pa = s.kind >= 3 ? PAINT[Math.floor(s.age * 12) % 3] : PAINT[s.kind % 3], r = s.r * (1 + Math.sin(s.age * 20) * .06);
      for(let i = 0; i < 5; i++){                                                                      // dripping tail
        const x = s.x - d * (r * (.8 + i * .7)), y = s.y + Math.sin(s.age * 14 + i * 1.7) * r * .5 + i * .6;
        cx.globalAlpha = .7 - i * .12; cx.fillStyle = pa.c; cx.beginPath(); cx.arc(x, y, Math.max(1, r * (.55 - i * .08)), 0, 7); cx.fill();
      }
      cx.globalAlpha = 1;
      cx.fillStyle = OUT; cx.beginPath(); cx.arc(s.x, s.y, r + 1.6, 0, 7); cx.fill();
      cx.fillStyle = pa.c; cx.beginPath(); cx.arc(s.x, s.y, r, 0, 7); cx.fill();
      cx.fillStyle = pa.d; cx.beginPath(); cx.arc(s.x + d * r * .2, s.y + r * .25, r * .7, .2, 2.9); cx.fill();
      cx.fillStyle = pa.l; cx.beginPath(); cx.ellipse(s.x - d * r * .3, s.y - r * .35, r * .35, r * .22, -.5, 0, 7); cx.fill();
    }
  });
})();