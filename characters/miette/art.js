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
// LOOK (redesign): magical storybook artist - fluffy chestnut hair + twin pigtails, chocolate beret with a rainbow brush-star, cream artist coat (asymmetric hem, pockets, belt with paint bottles + sketchbook, crossbody satchel),
//   mismatched knee socks + leather ankle boots (foot hook), and a dark-walnut brush with a gold ferrule and a smooth ICE-CREAM-SCOOP rainbow tip. Poses, springs, combo keys, timings and skill effects are untouched.
(() => {
  // ---------- SETTINGS ----------
  const BRUSH_LEN = 38;                 // hand -> bristle tip (px). Bigger = more giant.
  const IDLE_B    = 2.45;               // idle brush angle: 0 = down, 1.57 = forward, 3.14 = up
  const CONTACT   = [.5, .46, .56];     // hit moment of each combo step
  const SWEEP_AT  = .5;                 // Colorful Sweep: the paint burst moment (= `at` in skills.js)
  const SWEEP_R   = 82;                 // Colorful Sweep: burst radius (= `radius` in skills.js)
  const ROLL_B    = 1.05;               // Paint Roller: brush angle while she drags it along the floor (0 = down, 1.57 = forward)
  const CHARGE_P  = [.4, .4, .42];      // wind-up end of each step (= chargeP in skills.js)
  const PAINT = [                       // c = paint, d = dark edge, l = light shine
    {c:'#ff5fa2', d:'#c93d79', l:'#ffb3d3'},
    {c:'#2fd0c4', d:'#1b8f87', l:'#a6f3ec'},
    {c:'#ffd23f', d:'#d9a21a', l:'#fff0a8'}
  ];
  const HAIR = '#7a4a2e', HAIR_L = '#b07a48', WOOD = '#3f2616', FERR = '#e3c26a', OUT = '#0b0f1c';
  const CREAM = '#f6e8cf', CREAM_D = '#e4d2b0', CHOC = '#4a2c1f', BERET = '#573322', LEATHER = '#6a4430', GOLD = '#d4af5a', GOLD_D = '#9c7a30', SKIN = '#ffd9c0';
  const RAINBOW = [[0, '#ff5fa2'], [.2, '#ff9a4a'], [.4, '#ffd23f'], [.6, '#2fd0c4'], [.8, '#4d8cff'], [1, '#9a5cf0']];   // pink -> orange -> yellow -> teal -> blue -> violet
  let NOWT = 0;                                                       // set by behind() (it always runs first); torso() / foot() have no time argument
  const HR = 8.8, T = 9, SH = 8.5;      // head radius, thigh, shin (must match body below)

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lp = (a, b, k) => ({x:a.x + (b.x - a.x) * k, y:a.y + (b.y - a.y) * k});
  const rrect = (cx, x, y, w, h, r) => { cx.beginPath(); if(cx.roundRect) cx.roundRect(x, y, w, h, r); else cx.rect(x, y, w, h); };
  function star4(cx, x, y, r, col){ cx.fillStyle = col; cx.beginPath(); for(let i = 0; i < 8; i++){ const a = -Math.PI / 2 + i * Math.PI / 4, q = i % 2 ? r * .36 : r; i ? cx.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q) : cx.moveTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } cx.closePath(); cx.fill(); }
  const K = (p, k) => Body.keys(p, k);
  const PQ_R = 95;                                                    // Paintquake: burst radius (= `radius` in skills.js)
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

  // the giant brush. h = hand position, ang = brush angle, pa = current paint color (pink / teal / yellow). Butt end is behind the hand, the scoop tip is at BRUSH_LEN.
  // Dark walnut handle + gold carvings + leather grip, gold ferrule, and a smooth ICE-CREAM-SCOOP tip (one rounded shape, blended rainbow, glossy). pa only tints the paint marks.
  function drawBrush(cx, h, ang, pa){
    const ux = Math.sin(ang), uy = Math.cos(ang), nx = -uy, ny = ux, t = NOWT;
    const pt = (s, w) => ({x:h.x + ux * s + nx * w, y:h.y + uy * s + ny * w});
    const cap = (a, b, w, col) => Body.capsule(cx, a, b, w, col);
    const ln = (a, b, w, col) => { cx.strokeStyle = col; cx.lineWidth = w; cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); cx.stroke(); };
    cx.lineJoin = 'round'; cx.lineCap = 'round';
    cap(pt(-8, 0), pt(15, 0), 7.4, OUT); cap(pt(-8, 0), pt(15, 0), 4.6, WOOD);                      // handle (dark polished walnut)
    ln(pt(-7, -1.4), pt(14, -1.4), .9, 'rgba(255,215,160,.28)');                                     // polish shine
    cap(pt(-1.6, 0), pt(8.6, 0), 5, LEATHER);                                                        // leather grip wrap
    for(let s = -1.2; s < 8; s += 2.1) ln(pt(s, -2.4), pt(s + 1.3, 2.4), .8, '#3a2214');
    ln(pt(-1, 2.3), pt(8, 2.3), .6, 'rgba(255,230,190,.25)');                                         // worn edge on the leather
    cap(pt(8.6, 0), pt(9.6, 0), 5.2, GOLD_D); cap(pt(12.6, 0), pt(13.6, 0), 5.2, GOLD_D);            // gold rings + carved diamonds between them
    ln(pt(10, -1.5), pt(11.1, 0), .8, GOLD); ln(pt(11.1, 0), pt(10, 1.5), .8, GOLD);
    cap(pt(-8, 0), pt(-7.2, 0), 5, GOLD_D);                                                          // butt cap
    ln(pt(-5.2, -1.8), pt(-4.2, -1.1), .7, 'rgba(255,220,170,.35)'); ln(pt(3.4, 1.8), pt(4.6, 1.5), .7, 'rgba(255,220,170,.3)');   // scratches (a well used brush)
    const sp = pt(14.4, 0); star4(cx, sp.x, sp.y + 0, 1.5, GOLD);                                    // small star emblem
    cap(pt(-5.6, 0), pt(-5, 0), 4.6, pa.c);                                                           // a stripe of her current paint on the butt
    [[-6.6, 1.5, 0], [10.4, -1.7, 1], [7, 1.6, 2]].forEach(([s, w, c]) => { const q = pt(s, w); cx.fillStyle = PAINT[c].c; cx.beginPath(); cx.arc(q.x, q.y, .9, 0, 7); cx.fill(); });   // tiny paint markings
    // ferrule: elegant gold connector with engraved rings
    const a0 = pt(17, -3.4), a1 = pt(17, 3.4), fg = cx.createLinearGradient(a0.x, a0.y, a1.x, a1.y); fg.addColorStop(0, '#fff0b8'); fg.addColorStop(.45, FERR); fg.addColorStop(1, GOLD_D);
    cx.fillStyle = fg; cx.strokeStyle = OUT; cx.lineWidth = 1.5; poly(cx, [pt(14, -2.4), pt(20, -3.5), pt(20, 3.5), pt(14, 2.4)]); cx.fill(); cx.stroke();
    ln(pt(15.6, -2.7), pt(15.6, 2.7), .7, GOLD_D); ln(pt(18.2, -3.1), pt(18.2, 3.1), .7, GOLD_D);
    const d1 = pt(16.9, 0); cx.fillStyle = GOLD_D; cx.beginPath(); cx.arc(d1.x, d1.y, .5, 0, 7); cx.fill();
    // bristles: ONE smooth scoop. Slight taper at the ferrule, full round top (center s = 30, radius 8, tip = s 38).
    
    // BRISTLES: classic cartoon paintbrush silhouette.
    // Wide at the ferrule, full through the middle, tapering to a soft pointed peak.
    const bristle = () => {
      const left = [
        [20, -3.4],
        [21.5, -5.8],
        [24, -7.2],
        [28, -7.3],
        [31.5, -6.1],
        [34.5, -4.2],
        [36.8, -1.8]
      ];

      const right = [
        [36.8, 1.8],
        [34.5, 4.2],
        [31.5, 6.1],
        [28, 7.3],
        [24, 7.2],
        [21.5, 5.8],
        [20, 3.4]
      ];

      const mid = (a, b) => ({
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2
      });

      const L = left.map(([s, w]) => pt(s, w));
      const R = right.map(([s, w]) => pt(s, w));
      const peak = pt(39, 0);

      cx.beginPath();
      cx.moveTo(L[0].x, L[0].y);

      // Smooth left contour.
      for (let i = 1; i < L.length; i++) {
        const m = mid(L[i - 1], L[i]);
        cx.quadraticCurveTo(L[i - 1].x, L[i - 1].y, m.x, m.y);
      }

      // Rounded cartoon point.
      cx.quadraticCurveTo(L[L.length - 1].x, L[L.length - 1].y,
                          peak.x, peak.y);
      cx.quadraticCurveTo(R[0].x, R[0].y,
                          mid(R[0], R[1]).x, mid(R[0], R[1]).y);

      // Smooth right contour.
      for (let i = 1; i < R.length - 1; i++) {
        const m = mid(R[i], R[i + 1]);
        cx.quadraticCurveTo(R[i].x, R[i].y, m.x, m.y);
      }

      cx.quadraticCurveTo(R[R.length - 1].x, R[R.length - 1].y,
                          L[0].x, L[0].y);

      cx.closePath();
    };

    // Smooth blended rainbow gradient.
    const g0 = pt(21, -8), g1 = pt(38, 8);
    const g = cx.createLinearGradient(g0.x, g0.y, g1.x, g1.y);
    RAINBOW.forEach(([o, c]) => g.addColorStop(o, c));

    bristle();
    cx.fillStyle = g;
    cx.fill();

    // Glossy dimensional finish.
    cx.save();
    bristle();
    cx.clip();

    const sh = cx.createLinearGradient(
      pt(30, -8).x, pt(30, -8).y,
      pt(30, 8).x, pt(30, 8).y
    );
    sh.addColorStop(0, 'rgba(255,255,255,.28)');
    sh.addColorStop(.5, 'rgba(255,255,255,0)');
    sh.addColorStop(1, 'rgba(60,20,100,.3)');

    cx.fillStyle = sh;
    cx.fillRect(h.x - 70, h.y - 70, 140, 140);

    const gl = pt(31, -4.2);
    const rg = cx.createRadialGradient(gl.x, gl.y, .5, gl.x, gl.y, 7);
    rg.addColorStop(0, 'rgba(255,255,255,.6)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');

    cx.fillStyle = rg;
    cx.beginPath();
    cx.arc(gl.x, gl.y, 7, 0, 7);
    cx.fill();

    cx.restore();

    // Dark cartoon outline.
    bristle();
    cx.strokeStyle = OUT;
    cx.lineWidth = 1.5;
    cx.stroke();

    // Small glossy highlights.
    const sp1 = pt(29.5, -4.5);
    cx.fillStyle = 'rgba(255,255,255,.9)';
    cx.beginPath();
    cx.ellipse(sp1.x, sp1.y, 2.2, 1, ang + 1.2, 0, 7);
    cx.fill();

    const sp2 = pt(34.5, -2.2);
    cx.fillStyle = 'rgba(255,255,255,.7)';
    cx.beginPath();
    cx.arc(sp2.x, sp2.y, .8, 0, 7);
    cx.fill();

  }

  // near / far arm drawn again on top of the face (the default ragdoll draws arms before my face, so a raised hand must be redrawn).
  // Cream coat sleeve on the upper arm, a rolled-up cuff (brown stitch line + a paint stain), bare forearm below it.
  function arm(cx, A, P, white, hand){
    const sleeve = white ? '#fff' : CREAM, skin = white ? '#fff' : SKIN, cap = (a, b, w, col) => Body.capsule(cx, a, b, w, col), cuffA = A.el, cuffB = lp(A.el, A.hand, .34);
    cap(A.s, A.el, 4.6 + 3.2, OUT); cap(A.el, A.hand, 3.4 + 3.2, OUT);
    cap(A.s, A.el, 4.6, sleeve); cap(A.el, A.hand, 3.4, skin);
    cap(cuffA, cuffB, 5.4 + 2.4, OUT); cap(cuffA, cuffB, 5.4, sleeve);                                 // rolled-up sleeve (oversized)
    if(!white){
      cap(lp(cuffA, cuffB, .86), cuffB, 5.4, CHOC);                                                    // folded edge
      const q = lp(cuffA, cuffB, .35); cx.fillStyle = PAINT[0].c; cx.beginPath(); cx.arc(q.x, q.y + .6, 1, 0, 7); cx.fill();   // paint stain on the sleeve
    }
    if(hand){ cx.fillStyle = OUT; cx.beginPath(); cx.arc(A.hand.x, A.hand.y, 3 + 1.6, 0, 7); cx.fill();
              cx.fillStyle = skin; cx.beginPath(); cx.arc(A.hand.x, A.hand.y, 3, 0, 7); cx.fill(); }
  }

  // face + hair + beret, drawn in the head's own rotated space (x = forward, y = down). It first covers the default ragdoll visor.
  // Hair: fluffy chestnut puffs around the back, uneven bangs, loose side strands, strays under the beret. Face expressions (happy / sly / hurt, blink) are unchanged.
  function face(cx, f, t, S, P, white, mood){
    const rot = S.lean + ((f.rig && f.rig.j && f.rig.j.head.a) || 0);
    cx.save(); cx.translate(S.head.x, S.head.y); cx.rotate(rot); cx.lineJoin = 'round'; cx.lineCap = 'round';
    // fluffy hair puffs behind / around the head (outside the face disc so the silhouette is soft and untamed)
    const puffs = [-1.15, -1.6, -2.05, -2.5, -2.95, 3.0, 2.65, 2.3];
    for(let pass = 0; pass < 2; pass++) puffs.forEach((a, i) => {
      const r = 3.4 + rnd(i + 21) * 1.2 + Math.sin(t * 1.3 + i) * .12, d = HR * (.86 + rnd(i + 4) * .1), x = Math.cos(a) * d, y = Math.sin(a) * d;
      cx.fillStyle = pass ? (white ? '#fff' : (i % 3 ? HAIR : HAIR_L)) : OUT; cx.beginPath(); cx.arc(x, y, r + (pass ? 0 : 1.1), 0, 7); cx.fill();
    });
    cx.save(); cx.beginPath(); cx.arc(0, 0, HR, 0, 7); cx.clip();
    cx.fillStyle = white ? '#fff' : P.head; cx.fillRect(0, -4.6, HR + 2, 7.4);                      // hides the visor
    // hair cap: back + top + UNEVEN bangs (three locks of different length) over the forehead
    cx.beginPath(); cx.moveTo(-HR - 2, HR * .7); cx.lineTo(-HR - 2, -HR - 2); cx.lineTo(HR + 2, -HR - 2); cx.lineTo(HR + 2, -HR * .4);
    cx.quadraticCurveTo(HR * 1.0, -HR * .5, HR * .92, -HR * .26); cx.quadraticCurveTo(HR * .8, -HR * .52, HR * .66, -HR * .42);
    cx.quadraticCurveTo(HR * .58, -HR * .1, HR * .44, -HR * .2); cx.quadraticCurveTo(HR * .36, -HR * .5, HR * .24, -HR * .4);
    cx.quadraticCurveTo(HR * .12, -HR * .06, -HR * .06, -HR * .02); cx.quadraticCurveTo(-HR * .22, HR * .3, -HR * .36, HR * .72); cx.quadraticCurveTo(-HR * .5, HR * .86, -HR * .66, HR * .8); cx.lineTo(-HR - 2, HR * .7); cx.closePath();
    cx.fillStyle = white ? '#fff' : HAIR; cx.fill(); cx.strokeStyle = OUT; cx.lineWidth = 1.2; cx.stroke();
    if(!white){
      cx.strokeStyle = HAIR_L; cx.lineWidth = 1.2; cx.beginPath(); cx.arc(-HR * .1, -HR * .15, HR * .78, -2.5, -1.35); cx.stroke();   // highlights
      cx.beginPath(); cx.moveTo(HR * .3, -HR * .62); cx.quadraticCurveTo(HR * .44, -HR * .4, HR * .4, -HR * .26); cx.moveTo(-HR * .5, -HR * .2); cx.quadraticCurveTo(-HR * .6, HR * .2, -HR * .5, HR * .5); cx.stroke();
      const ex = HR * .46, ey = HR * .1;
      if(mood === 'hurt'){                                                                          // > < eye
        cx.strokeStyle = '#2a1030'; cx.lineWidth = 1.7; cx.beginPath(); cx.moveTo(ex - 2.6, ey - 2.6); cx.lineTo(ex + 1.6, ey); cx.lineTo(ex - 2.6, ey + 2.6); cx.stroke();
      } else if((t % 3.4) < .12){                                                                   // blink
        cx.strokeStyle = '#2a1030'; cx.lineWidth = 1.5; cx.beginPath(); cx.moveTo(ex - 2.6, ey + .4); cx.quadraticCurveTo(ex, ey + 2, ex + 2.6, ey + .4); cx.stroke();
      } else {
        cx.fillStyle = '#fff'; cx.beginPath(); cx.ellipse(ex, ey, 2.8, 3.6, 0, 0, 7); cx.fill();   // eye white
        const ig = cx.createLinearGradient(0, ey - 3, 0, ey + 3.4); ig.addColorStop(0, '#4a2aa6'); ig.addColorStop(.55, '#6a63d8'); ig.addColorStop(1, '#5fc3f2');
        cx.fillStyle = ig; cx.beginPath(); cx.ellipse(ex + .5, ey + .3, 2.3, 3.2, 0, 0, 7); cx.fill();   // blue-violet iris, deep violet -> sky blue
        cx.fillStyle = '#1a0f3a'; cx.beginPath(); cx.ellipse(ex + .7, ey + .3, 1.1, 1.8, 0, 0, 7); cx.fill();   // pupil
        cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(ex + 1.3, ey - 1.3, 1.05, 0, 7); cx.fill(); cx.beginPath(); cx.arc(ex - .2, ey + 1.5, .55, 0, 7); cx.fill();   // sparkles
        cx.strokeStyle = '#2a1030'; cx.lineWidth = 1.3; cx.beginPath(); cx.ellipse(ex, ey, 2.8, 3.6, 0, Math.PI * 1.05, Math.PI * 1.95); cx.stroke();   // upper lash
        if(mood === 'sly'){ cx.fillStyle = HAIR; cx.beginPath(); cx.moveTo(ex - 3.3, ey - 4.2); cx.lineTo(ex + 3.4, ey - 1.6); cx.lineTo(ex + 3.4, ey - 4.2); cx.closePath(); cx.fill();   // lowered lid = mischievous
                              cx.strokeStyle = '#2a1030'; cx.lineWidth = 1.4; cx.beginPath(); cx.moveTo(ex - 3, ey - 2.9); cx.lineTo(ex + 3.2, ey - 1.1); cx.stroke(); }
      }
      cx.strokeStyle = '#5a3320'; cx.lineWidth = 1; cx.beginPath();                                 // delicate eyebrow
      if(mood === 'sly') { cx.moveTo(ex - 2.6, ey - 6.9); cx.lineTo(ex + 3, ey - 4.7); } else { cx.moveTo(ex - 2.4, ey - 5.6); cx.quadraticCurveTo(ex, ey - 6.7, ex + 2.8, ey - 5.8); }
      cx.stroke();
      cx.fillStyle = 'rgba(255,110,140,.5)'; cx.beginPath(); cx.ellipse(HR * .34, HR * .52, 2.8, 1.6, 0, 0, 7); cx.fill();   // rosy cheek
      const mx = HR * .64, my = HR * .58;                                                          // mouth
      if(mood === 'hurt'){ cx.fillStyle = '#6a1f2f'; cx.beginPath(); cx.ellipse(mx, my, 1.1, 1.4, 0, 0, 7); cx.fill(); }
      else if(mood === 'sly'){ cx.fillStyle = '#6a1f2f'; cx.beginPath(); cx.arc(mx, my - .4, 2, 0, Math.PI); cx.closePath(); cx.fill();
                               cx.fillStyle = '#ff7a9a'; cx.beginPath(); cx.ellipse(mx, my + .9, 1.1, .7, 0, 0, 7); cx.fill(); }
      else { cx.strokeStyle = '#7a3a45'; cx.lineWidth = 1.1; cx.beginPath(); cx.moveTo(mx - 1.9, my - .2); cx.quadraticCurveTo(mx, my + 1.8, mx + 2, my - .6); cx.stroke(); }   // small gentle smile
    }
    cx.restore();
    if(!white){                                                                                      // loose side strands + a few strays under the beret
      cx.strokeStyle = OUT; cx.lineWidth = 2.6; cx.beginPath(); cx.moveTo(-HR * .1, -HR * .3); cx.quadraticCurveTo(-HR * .32, HR * .3, -HR * .24, HR * .84); cx.stroke();
      cx.strokeStyle = HAIR; cx.lineWidth = 1.4; cx.stroke();
      cx.strokeStyle = HAIR_L; cx.lineWidth = .6; cx.beginPath(); cx.moveTo(-HR * .12, -HR * .2); cx.quadraticCurveTo(-HR * .28, HR * .3, -HR * .22, HR * .7); cx.stroke();
      cx.strokeStyle = HAIR; cx.lineWidth = 1; [[-.7, -.62, -1.25, -.72, -1.3, -.5], [.55, -.8, .95, -1.12, 1.25, -.92], [-.2, -.9, -.4, -1.2, -.7, -1.1]].forEach(q => { cx.beginPath(); cx.moveTo(HR * q[0], HR * q[1]); cx.quadraticCurveTo(HR * q[2], HR * q[3], HR * q[4], HR * q[5]); cx.stroke(); });
    }
    // beret: dark chocolate, oversized, tilted back, soft folds, rainbow brush-star, tiny paint splashes, fabric tip
    cx.save(); cx.translate(-HR * .15, -HR * .78); cx.rotate(-.2); cx.scale(1.14, 1.04); cx.translate(HR * .15, HR * .78);
    cx.beginPath(); cx.moveTo(-HR * .95, -HR * .5); cx.quadraticCurveTo(-HR * 1.05, -HR * 1.3, HR * .05, -HR * 1.28);
    cx.quadraticCurveTo(HR * 1.05, -HR * 1.22, HR * .98, -HR * .46); cx.quadraticCurveTo(HR * .3, -HR * .72, -HR * .95, -HR * .5); cx.closePath();
    if(white) cx.fillStyle = '#fff'; else { const bg = cx.createLinearGradient(-HR, -HR * 1.3, HR, -HR * .5); bg.addColorStop(0, '#6a4029'); bg.addColorStop(1, '#3c2216'); cx.fillStyle = bg; }
    cx.fill(); cx.strokeStyle = OUT; cx.lineWidth = 1.4; cx.stroke();
    if(!white){
      cx.strokeStyle = '#2e1a10'; cx.lineWidth = .8; cx.beginPath();                                 // fabric folds
      cx.moveTo(-HR * .1, -HR * 1.22); cx.quadraticCurveTo(-HR * .3, -HR * .9, -HR * .55, -HR * .58); cx.moveTo(HR * .2, -HR * 1.2); cx.quadraticCurveTo(HR * .1, -HR * .95, -HR * .1, -HR * .66); cx.moveTo(HR * .5, -HR * 1.12); cx.quadraticCurveTo(HR * .5, -HR * .9, HR * .38, -HR * .66); cx.stroke();
      cx.strokeStyle = '#8a5a3a'; cx.lineWidth = 1; cx.beginPath(); cx.arc(-HR * .05, -HR * .55, HR * .64, -2.6, -1.55); cx.stroke();   // soft highlight
      const sx = HR * .56, sy = -HR * .82, sg = cx.createLinearGradient(sx - 3, sy - 3, sx + 3, sy + 3); RAINBOW.forEach(([o, c]) => sg.addColorStop(o, c));
      cx.fillStyle = sg; cx.beginPath(); for(let i = 0; i < 8; i++){ const a = -Math.PI / 2 + i * Math.PI / 4, q = i % 2 ? 1.05 : 3.2; i ? cx.lineTo(sx + Math.cos(a) * q, sy + Math.sin(a) * q) : cx.moveTo(sx + Math.cos(a) * q, sy + Math.sin(a) * q); } cx.closePath(); cx.fill();
      cx.strokeStyle = OUT; cx.lineWidth = .6; cx.stroke();                                          // brushstroke star emblem
      [[.2, -.98, .75, 0], [.9, -.7, .6, 1], [.42, -.56, .55, 2]].forEach(([dx, dy, r, c]) => { cx.fillStyle = PAINT[c].c; cx.beginPath(); cx.arc(HR * dx, HR * dy, r, 0, 7); cx.fill(); });   // tiny paint splashes
    }
    cx.fillStyle = white ? '#fff' : '#3a2115'; cx.beginPath(); cx.arc(-HR * .2, -HR * 1.3, 1.7, 0, 7); cx.fill(); cx.strokeStyle = OUT; cx.lineWidth = 1; cx.stroke();   // fabric tip
    cx.restore();
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
        colors: {shirt:CREAM, limb:CREAM, far:CREAM_D, head:SKIN, dark:LEATHER, hand:SKIN, legs:'#f3e8d2', legsFar:'#4a9a98'},   // arms = coat sleeves (the near forearm is redrawn bare by arm()), near sock cream / far sock muted teal (foot hook adds patches + boots)

    // the far hand is only used on step 3 (two-handed fling): draw it over the body so it is visible
    farFront: f => f.atk > 0 && !!f.A && ((f.A.step || 0) % 3) === 2,

    // ARTIST COAT: short cream coat with an asymmetrical hem (longer at the back), chocolate trim, belt with two paint bottles + a sketchbook, pockets with tiny brushes,
    // a crossbody satchel (strap + bag at the back hip), embroidered paint strokes + stars, and a few paint stains (two of them wiggle). Drawn in the torso's own space: x = forward, y = down, origin = pelvis.
    torso(cx, S, B, P, white){
      const t = NOWT, k = (a, b) => ({x:b, y:-a});
      cx.save(); cx.translate(S.pel.x, S.pel.y); cx.rotate(S.lean); cx.lineJoin = 'round'; cx.lineCap = 'round';
      if(!white){                                                                                   // satchel bag at the back hip (behind the coat)
        cx.fillStyle = OUT; rrect(cx, -11.4, -1.6, 7.4, 6.8, 1.8); cx.fill(); cx.fillStyle = LEATHER; rrect(cx, -10.8, -1, 6.2, 5.6, 1.4); cx.fill();
        cx.fillStyle = '#7a5038'; rrect(cx, -10.8, -1, 6.2, 2.6, 1.2); cx.fill(); cx.fillStyle = GOLD; cx.fillRect(-8.4, 1.1, 1.6, 1.2);
      }
      const coat = () => { cx.beginPath(); [[-4.6,-9.4],[0,-10.4],[4.8,-9.4],[5.8,-5],[6.6,-1.8],[7.8,2.2],[3.8,3.6],[-.6,4.3],[-4.2,5.6],[-7.2,7.6],[-6.4,2],[-5.8,-3],[-5.2,-7]].forEach((q, i) => i ? cx.lineTo(q[0], q[1]) : cx.moveTo(q[0], q[1])); cx.closePath(); };
      coat(); cx.fillStyle = white ? '#fff' : CREAM; cx.fill(); cx.strokeStyle = B.outline; cx.lineWidth = B.outlineW; cx.stroke();
      if(!white){
        cx.save(); coat(); cx.clip();
        const g = cx.createLinearGradient(-6, 0, 7, 0); g.addColorStop(0, 'rgba(120,90,50,.22)'); g.addColorStop(.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,.18)');
        cx.fillStyle = g; cx.fillRect(-9, -11, 18, 20);
        cx.strokeStyle = CHOC; cx.lineWidth = 1.5; cx.beginPath(); cx.moveTo(7.2, 1.8); cx.lineTo(3.8, 3.1); cx.lineTo(-.6, 3.8); cx.lineTo(-4.2, 5.1); cx.lineTo(-6.8, 7); cx.stroke();   // chocolate hem trim
        cx.beginPath(); cx.moveTo(-4.4, -9.2); cx.quadraticCurveTo(0, -10.2, 4.6, -9.2); cx.lineWidth = 1.4; cx.stroke();                                                              // collar edge
        cx.lineWidth = 1; [[PAINT[0].c, .2, -6.6, 1.4, -8.2, 3, -6.8], [PAINT[1].c, .4, -4.8, 1.8, -6.2, 3.4, -5], [PAINT[2].c, -2.4, -6, -1.2, -7.4, .2, -6.4]].forEach(([c, x0, y0, cx1, cy1, x1, y1]) => { cx.strokeStyle = c; cx.beginPath(); cx.moveTo(x0, y0); cx.quadraticCurveTo(cx1, cy1, x1, y1); cx.stroke(); });   // embroidered paint strokes
        star4(cx, -3, -4.4, 1.2, GOLD); star4(cx, -2.6, 3, 1, GOLD); star4(cx, 5.6, 1, .8, GOLD);                                                                                           // tiny star motifs
        cx.strokeStyle = CHOC; cx.lineWidth = .9; cx.fillStyle = CREAM_D; rrect(cx, 3.4, .3, 3.6, 3, .8); cx.fill(); cx.stroke();                                                           // pocket
        cx.lineWidth = 1; cx.strokeStyle = '#8a5a3a'; cx.beginPath(); cx.moveTo(4.2, .5); cx.lineTo(4.7, -1.2); cx.moveTo(5.6, .5); cx.lineTo(5.9, -1); cx.stroke();                         // tiny brushes tucked in
        cx.fillStyle = PAINT[0].c; cx.beginPath(); cx.arc(4.7, -1.4, .7, 0, 7); cx.fill(); cx.fillStyle = PAINT[1].c; cx.beginPath(); cx.arc(5.9, -1.2, .65, 0, 7); cx.fill();
        // paint stains (living paint: two of them breathe, one has a slow drip)
        [[-1.4, 2.6, 1.3, 0, 1], [5.4, -3.2, 1, 2, 0], [-4.6, 4.4, 1.1, 1, 1], [1.8, 3.4, .8, 2, 0]].forEach(([x, y, r, c, live], i) => {
          const rr_ = r * (live ? 1 + .2 * Math.sin(t * 2.6 + i * 2) : 1); cx.fillStyle = PAINT[c].c; cx.beginPath(); cx.arc(x, y, rr_, 0, 7); cx.fill();
          if(i === 0){ const d = .6 + 1.1 * (.5 + .5 * Math.sin(t * 1.3)); cx.beginPath(); cx.ellipse(x + .2, y + rr_ + d * .5, .55, d, 0, 0, 7); cx.fill(); }
        });
        cx.restore();
        // belt, buckle, bottles, sketchbook
        cx.strokeStyle = OUT; cx.lineWidth = 3.6; cx.beginPath(); cx.moveTo(-6.2, -1.2); cx.lineTo(7.4, -.8); cx.stroke(); cx.strokeStyle = LEATHER; cx.lineWidth = 2.2; cx.stroke();
        cx.fillStyle = GOLD; cx.strokeStyle = OUT; cx.lineWidth = .8; rrect(cx, 4.4, -2.4, 2.4, 2.6, .5); cx.fill(); cx.stroke();
        [[-2.4, PAINT[0].c], [-.4, PAINT[1].c]].forEach(([x, c]) => { cx.fillStyle = OUT; rrect(cx, x - 1.3, -.4, 2.6, 3.8, .8); cx.fill(); cx.fillStyle = c; rrect(cx, x - .8, .1, 1.6, 2.8, .5); cx.fill(); cx.fillStyle = GOLD; cx.fillRect(x - .6, -.9, 1.2, .8); });   // paint bottles
        cx.save(); cx.translate(-5, .6); cx.rotate(.1); cx.fillStyle = OUT; rrect(cx, -2.6, -.4, 5.2, 4.8, .8); cx.fill(); cx.fillStyle = '#5a3523'; rrect(cx, -2.1, 0, 4.2, 3.8, .6); cx.fill();
        cx.fillStyle = GOLD; cx.fillRect(-2.1, .6, 4.2, .7); star4(cx, 0, 2.7, .9, GOLD); cx.fillStyle = CREAM; cx.fillRect(1.9, .2, .5, 3.4); cx.restore();                                       // sketchbook
        cx.strokeStyle = OUT; cx.lineWidth = 2.8; cx.beginPath(); cx.moveTo(3.8, -9.2); cx.lineTo(-6.6, 1.4); cx.stroke(); cx.strokeStyle = LEATHER; cx.lineWidth = 1.5; cx.stroke();          // crossbody satchel strap
        cx.fillStyle = GOLD; cx.fillRect(-1.1, -3.8, 1.5, 1.2);
      }
      cx.restore();
    },

    // BOOTS + SOCKS (called right after each leg is drawn): bare thigh above the sock, mismatched knee socks (near = cream with paint patches, pulled up; far = muted teal with stars, slouched),
    // sturdy dark-brown ankle boots with a thick sole, rounded toe, buckle and stitching. Foot size / ground contact are the same as the default foot.
    foot(cx, leg, P, white, f, far){
      const H = leg.hip, K = leg.knee, A = leg.ankle, cap = (a, b, w, col) => Body.capsule(cx, a, b, w, col), skin = white ? '#fff' : SKIN;
      cx.save(); cx.lineJoin = 'round'; cx.lineCap = 'round';
      const top = far ? lp(K, A, .2) : lp(K, H, .2);                                                // where the sock starts
      cap(H, top, 5 + 3.2, OUT); cap(H, top, 5, skin);                                               // bare thigh covers the sock-coloured default thigh
      if(!white){
        if(far){                                                                                      // slouched teal sock: bunched cuff + folds + embroidered stars
          cap(lp(K, A, .14), lp(K, A, .34), 6.4 + 2.2, OUT); cap(lp(K, A, .14), lp(K, A, .34), 6.4, '#3d8583'); cap(lp(K, A, .3), lp(K, A, .34), 6.4, '#2f6c6a');
          [.5, .72].forEach(k => { const q = lp(K, A, k); star4(cx, q.x + .4, q.y, 1.3, '#f4d98a'); });
        } else {                                                                                      // pulled-up cream sock with colourful paint patches
          cap(lp(K, H, .26), lp(K, H, .14), 5.2, CHOC);
          [[.34, -.9, 0], [.52, .8, 2], [.72, -.6, 1]].forEach(([k, o, c]) => { const q = lp(K, A, k); cx.fillStyle = PAINT[c].c; cx.beginPath(); cx.ellipse(q.x + o, q.y, 1.3, 1.1, .4, 0, 7); cx.fill(); });
        }
      }
      // ankle boot: shaft + foot (same footprint as the default foot, sole bottom at the same ground line)
      const phi = leg.planted ? 0 : clamp(-leg.sa * .5, -.8, .8), lift = leg.planted ? clamp((H.x - A.x - 2) * .12, 0, 3.5) : 0, lenF = 7.5 - 1.5;
      const a = {x:A.x - 1.5, y:A.y - lift - .6}, b = {x:A.x + lenF * Math.cos(phi), y:A.y + lenF * Math.sin(phi) - .6}, bc = white ? '#fff' : (far ? '#3a2417' : '#4d2f1e');
      const s0 = lp(K, A, .8), s1 = {x:A.x, y:A.y - lift - .6};
      cap(s0, s1, 4.9 + 2.2, OUT); cap(a, b, 5 + 2.2, OUT);
      cap(s0, s1, 4.9, bc); cap(a, b, 5, bc);
      if(!white){
        cap({x:a.x + .4, y:a.y + 1.25}, {x:b.x, y:b.y + 1.25}, 1.6, '#24150d');                       // thick sole
        cap({x:b.x - 1.3, y:b.y - .4}, {x:b.x, y:b.y - .2}, 3.2, '#5c3a26');                          // rounded toe cap
        const q = lp(K, A, .88); cx.fillStyle = GOLD; cx.strokeStyle = OUT; cx.lineWidth = .7; rrect(cx, q.x + 1.2, q.y - .8, 1.7, 1.7, .4); cx.fill(); cx.stroke();   // buckle
        cx.strokeStyle = 'rgba(255,225,170,.55)'; cx.lineWidth = .5; cx.setLineDash([1, 1]); cx.beginPath(); cx.moveTo(s0.x - 2, s0.y); cx.lineTo(s0.x + 2.2, s0.y); cx.stroke(); cx.setLineDash([]);   // stitching
        cx.fillStyle = PAINT[far ? 1 : 0].c; cx.beginPath(); cx.arc(b.x - 1.4, b.y - .9, .7, 0, 7); cx.fill(); cx.fillStyle = PAINT[2].c; cx.beginPath(); cx.arc(a.x + 1.6, a.y + .5, .5, 0, 7); cx.fill();   // paint marks
      }
      cx.restore();
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
      if(A.skill === 'masterpiece') return {k:300, d:26};                                // Masterpiece: smooth, a bit floaty
      if(A.skill === 'paintquake') return {k:420, d:30};                                  // Paintquake: snappy
      if(A.skill === 'colorsweep') return {k:520, d:34};                                 // Colorful Sweep: quick and snappy
      if(A.skill === 'roller') return {k:230, d:22};                                     // Paint Roller: steady, a little floppy
      const c = CONTACT[(A.step || 0) % 3];
      if(A.chg > 0 && p <= CHARGE_P[(A.step || 0) % 3] + .004) return {k:170, d:16};
      if(p < c - .12) return {k:130, d:14};
      if(p < c + .1) return {k:520, d:34};
      return {k:190, d:20};
    },

    attack(tg, p, A, Kf){
      if(A.skill === 'masterpiece'){   // MASTERPIECE: A.f0 = end of the hop up, A.f1 = the explosion (0..1 of the whole move)
        const f0 = A.f0 || .15, f1 = A.f1 || .85;
        if(p < f0){ const k = p / f0; tg.aN = 1.2 + 1.6 * k; tg.eN = .2; tg.aF = .4 + 1.0 * k; tg.eF = .2; tg.lean = -.05; tg.head = -.1; tg.tN = .3 + .3 * k; tg.tF = -.2 + .1 * k; tg.kN = .5 + .5 * k; tg.kF = .5 + .4 * k; }                                  // jump up, brush swung overhead
        else if(p < f1){ const w = Math.sin(p * 40); tg.aN = .9 + w * .15; tg.eN = .35; tg.aF = .5; tg.eF = .4; tg.lean = .12; tg.head = .12; tg.tN = .6; tg.tF = -.3; tg.kN = 1.0; tg.kF = .9; }                                              // hovering, tucked, brush painting below her
        else{ const k = clamp((p - f1) / (1 - f1), 0, 1), s = Math.sin(Math.min(1, k * 3) * Math.PI / 2); tg.aN = 1.9 - 1.3 * s; tg.eN = .2; tg.aF = .9 - .4 * s; tg.eF = .3; tg.lean = .1 + .25 * s; tg.head = -.1; tg.tN = .5; tg.tF = .35; tg.kN = .9; tg.kF = .8; }   // the final smash, then she drops
        return;
      }
      if(A.skill === 'paintquake'){   // PAINTQUAKE: A.f0 = end of the stomp, A.f1 = landing (0..1 of the whole move)
        const f0 = A.f0 || .2, f1 = A.f1 || .7;
        if(p < f0){ const k = p / f0; tg.aN = 2.6 - 2.2 * k * k; tg.eN = .2; tg.aF = 1.3 - k; tg.eF = .2; tg.lean = -.1 + .4 * k; tg.head = -.05; tg.tN = .3 + .3 * k; tg.tF = -.2 + .3 * k; tg.kN = .5 + .5 * k; tg.kF = .5 + .5 * k; }                 // brush up, then stomped down
        else if(p < f1){ tg.aN = 2.5; tg.eN = .25; tg.aF = 1.6; tg.eF = .3; tg.lean = .05; tg.head = -.05; tg.tN = .6; tg.tF = -.3; tg.kN = 1.0; tg.kF = .9; }                                                         // airborne, tucked, brush overhead
        else{ const k = clamp((p - f1) / (1 - f1), 0, 1), s = Math.sin(Math.min(1, k * 3) * Math.PI / 2); tg.aN = 1.7 - 1.1 * s; tg.eN = .2; tg.aF = .9 - .5 * s; tg.eF = .3; tg.lean = .15 + .25 * s; tg.head = -.1; tg.tN = .55; tg.tF = .45; tg.kN = .9; tg.kF = .8; }   // the smash
        return;
      }
      if(A.skill === 'colorsweep'){   // COLORFUL SWEEP: arms flung wide, a small crouch while she spins. Legs are left alone
        const w = Math.sin(clamp(p, 0, 1) * Math.PI);
        tg.aN = 1.35; tg.eN = .12; tg.aF = -1.25; tg.eF = .12; tg.lean = .12 + .1 * w; tg.head = -.05;
        return;
      }
      if(A.skill === 'roller'){   // PAINT ROLLER: leans into it, the near hand holds the brush low in front so the bristles drag on the floor. Legs are left alone: the walk cycle keeps running
        tg.aN = .85; tg.eN = .5; tg.aF = -.25; tg.eF = .5; tg.lean = .2; tg.head = -.08;
        return;
      }
      const s = STEP[(A.step || 0) % 3], L = A.cl || 0, hold = A.chg > 0 && p <= CHARGE_P[(A.step || 0) % 3] + .004;
      JK.forEach(j => tg[j] = Kf(p, s[j]));
      if(hold){ tg.lean -= .1 * L; tg.head += .1 * L; }                                    // charging: leans back, looks up at the circle she draws
      const Y = Math.min(Kf(p, s.Y) - (hold ? 1.6 * L : 0), .97 * (T + SH) * Math.min(Math.cos(tg.tN), Math.cos(tg.tF)));
      tg.kN = legK(tg.tN, Y); tg.kF = legK(tg.tF, Y);
    },

    // twin pigtails swinging behind her head (fly up when she falls, stream back when she runs). Short and messy, tied with a ribbon; one tip is dipped in her current paint.
    behind(cx, f, t, S, P){
      NOWT = t;
      const mi = M(f), white = f.flash > 0, rot = S.lean + ((f.rig && f.rig.j && f.rig.j.head.a) || 0), c = Math.cos(rot), s = Math.sin(rot);
      const run = clamp(Math.abs(f.vx) / 170, 0, 1);
      const base = .4 + run * .5 - clamp(f.vy * .0012, -.5, .8) + (f.stun > 0 ? Math.sin(t * 30) * .4 : 0);
      [{ox:-HR * .78, oy:HR * .05, ph:0, n:3, len:5.2, w:5.4, col:HAIR, tip:mi.col}, {ox:-HR * .62, oy:-HR * .3, ph:2.1, n:3, len:4.2, w:4.4, col:'#5e3822', tip:(mi.col + 1) % 3}].forEach((pg, pi) => {
        let x = S.head.x + pg.ox * c - pg.oy * s, y = S.head.y + pg.ox * s + pg.oy * c;
        for(let i = 0; i < pg.n; i++){
          const ang = base + (pi ? -.15 : 0) + i * .25 + Math.sin(t * 6 + i * .9 + pg.ph) * (.08 + .1 * run), len = pg.len - i * .4, nx = x - Math.sin(ang) * len, ny = y + Math.cos(ang) * len, w = pg.w - i * 1.1;
          Body.capsule(cx, {x, y}, {x:nx, y:ny}, w + 3.2, OUT); Body.capsule(cx, {x, y}, {x:nx, y:ny}, w, white ? '#fff' : pg.col);
          if(i === 0 && !white){ cx.fillStyle = OUT; cx.beginPath(); cx.arc(x, y, 2.5, 0, 7); cx.fill(); cx.fillStyle = CHOC; cx.beginPath(); cx.arc(x, y, 1.6, 0, 7); cx.fill(); }   // hair tie
          x = nx; y = ny;
        }
        cx.fillStyle = OUT; cx.beginPath(); cx.arc(x, y, pi ? 2.6 : 3.3, 0, 7); cx.fill();
        cx.fillStyle = white ? '#fff' : PAINT[pg.tip].c; cx.beginPath(); cx.arc(x, y, pi ? 1.5 : 2, 0, 7); cx.fill();
      });
    },

    front(cx, f, t, S, P){
      const white = f.flash > 0, hurt = f.stun > 0, atk = f.atk > 0 && !!f.A, A = f.A || {}, step = atk ? (A.step || 0) % 3 : 0;
      const p = atk ? clamp(1 - f.atk / A.time, 0, 1) : -1, mi = M(f), dt = mi.last == null ? 0 : clamp(t - mi.last, 0, .05);
      mi.last = t;
      if(mi.face !== f.face){ mi.pts.length = 0; mi.drips.length = 0; if(mi.tp) mi.tp.length = 0; mi.face = f.face; }
      const roll = atk && !hurt && A.skill === 'roller', spin = atk && !hurt && A.skill === 'colorsweep', pq = atk && !hurt && A.skill === 'paintquake', mpq = atk && !hurt && A.skill === 'masterpiece';
      if(atk && !hurt){ if(mi.A !== A){ mi.A = A; mi.sp = null; } mi.col = roll ? (f.roller ? f.roller.col : mi.col) : mpq ? (p < (A.f1 || .85) ? Math.floor(t * 4) % 3 : 1) : pq ? (p < (A.f1 || .7) ? 0 : 1) : spin ? Math.min(2, Math.floor(p * 3)) : step; }
      const pa = PAINT[mi.col], run = clamp(Math.abs(f.vx) / 170, 0, 1);

      // 1) face, hair, beret
      face(cx, f, t, S, P, white, hurt ? 'hurt' : atk ? 'sly' : 'happy');

      // 2) near arm on top of the face again
      arm(cx, S.aN, P, white, false);

      // 3) brush angle: keyed while attacking, smoothed in every other state
      let tgt, rate = 12;
      if(roll) mi.ang += (ROLL_B + Math.sin(t * 13) * .035 - mi.ang) * Math.min(1, dt * 14);      // Paint Roller: the brush drags along the floor
      else if(mpq){ const f0 = A.f0 || .15, f1 = A.f1 || .85; mi.ang = p < f0 ? 1.3 + 1.6 * (p / f0) : p < f1 ? .25 + Math.sin(t * 11) * .45 : .1; }   // Masterpiece: brush up, then scribbles under her, then smashed down
      else if(pq){ const f0 = A.f0 || .2, f1 = A.f1 || .7; mi.ang = p < f0 ? 2.9 - 2.8 * clamp(p / f0, 0, 1) * clamp(p / f0, 0, 1) : p < f1 ? 2.75 : .12 - .1 * Math.sin(clamp((p - f1) * 6, 0, 1) * Math.PI / 2); }   // Paintquake: brush up, stomped down, up in the air, smashed down
      else if(spin){ const e = clamp((p - .06) / .84, 0, 1); mi.ang = 1.3 + Math.PI * 2 * e * e * (3 - 2 * e); }   // Colorful Sweep: one full 360 turn of the brush
      else if(atk && !hurt) mi.ang = K(p, STEP[step].br);
      else {
        if(hurt){ tgt = .3 + Math.sin(t * 28) * .5; rate = 20; }
        else if(!f.gr){ tgt = f.vy < 0 ? 2.9 : 2.0; rate = 9; }
        else tgt = IDLE_B - run * .35 + Math.sin(t * 2.2) * .05 * (1 - run) + Math.sin(t * 14) * .05 * run;
        mi.ang += (tgt - mi.ang) * Math.min(1, dt * rate);
      }
      const h = S.aN.hand, tipP = {x:h.x + Math.sin(mi.ang) * BRUSH_LEN, y:h.y + Math.cos(mi.ang) * BRUSH_LEN};
      if(roll) f.rollDx = tipP.x;                                              // tells arena.js where the bristles touch the floor (it lays the paint there)

      // 4) paint trail behind the brush (only around the hit)
      if(atk && !hurt){ const last = mi.pts[mi.pts.length - 1]; if(!last || last.t !== t) mi.pts.push({x:tipP.x, y:tipP.y, t}); }
      while(mi.pts.length && t - mi.pts[0].t > .16) mi.pts.shift();
      if(atk && !hurt && (pq || mpq ? false : spin ? p > .1 && p < .95 : p > CONTACT[step] - .24 && p < CONTACT[step] + .3) && mi.pts.length > 1){
        cx.lineCap = 'round';
        for(let pass = 0; pass < 2; pass++) for(let i = 1; i < mi.pts.length; i++){
          const k = i / mi.pts.length; cx.strokeStyle = pass ? pa.l : pa.c; cx.globalAlpha = pass ? .35 + .5 * k : .25 + .6 * k;
          cx.lineWidth = (2 + 10 * k) * (pass ? .35 : 1); cx.beginPath(); cx.moveTo(mi.pts[i - 1].x, mi.pts[i - 1].y); cx.lineTo(mi.pts[i].x, mi.pts[i].y); cx.stroke();
        }
        cx.globalAlpha = 1;
      }

      // 5) the brush + the hand gripping it
      drawBrush(cx, h, mi.ang, pa);
      if(roll){ cx.fillStyle = pa.c; cx.beginPath(); cx.ellipse(tipP.x, tipP.y - 1, 4.2, 2.6, 0, 0, 7); cx.fill(); cx.fillStyle = pa.l; cx.beginPath(); cx.ellipse(tipP.x - 1, tipP.y - 2, 1.8, 1, 0, 0, 7); cx.fill(); }   // a fat dab of paint where the bristles touch the floor
      cx.fillStyle = OUT; cx.beginPath(); cx.arc(h.x, h.y, 4.6, 0, 7); cx.fill();
      cx.fillStyle = white ? '#fff' : P.hand; cx.beginPath(); cx.arc(h.x, h.y, 3, 0, 7); cx.fill();

      // 5b) COLORFUL SWEEP: a circle of paint bursts out around her at SWEEP_AT (ring in the three colors + blobs flying outward)
      if(spin && p >= SWEEP_AT && p < SWEEP_AT + .42){
        const k = (p - SWEEP_AT) / .42, e = 1 - (1 - k) * (1 - k), ccx = (S.sh.x + S.pel.x) / 2, ccy = (S.sh.y + S.pel.y) / 2;
        cx.save(); cx.lineCap = 'round';
        for(let c = 0; c < 3; c++){ cx.globalAlpha = (1 - k) * .85; cx.strokeStyle = PAINT[c].c; cx.lineWidth = (7 - 5 * k) - c * 1.6; cx.beginPath(); cx.arc(ccx, ccy, Math.max(1, SWEEP_R * e - c * 4), 0, 7); cx.stroke(); }
        cx.globalAlpha = (1 - k) * .3; cx.fillStyle = PAINT[Math.floor(k * 3) % 3].l; cx.beginPath(); cx.arc(ccx, ccy, Math.max(1, SWEEP_R * e), 0, 7); cx.fill();
        for(let i = 0; i < 26; i++){
          const a = i / 26 * 6.283 + rnd(i) * .3, rr = SWEEP_R * e * (.55 + .5 * rnd(i + 5)), x = ccx + Math.cos(a) * rr, y = ccy + Math.sin(a) * rr + 14 * k * k, bs = (1.8 + 2.6 * rnd(i + 3)) * (1 - k * .5);
          cx.globalAlpha = 1 - k * k; cx.fillStyle = OUT; cx.beginPath(); cx.arc(x, y, bs + .9, 0, 7); cx.fill();
          cx.fillStyle = PAINT[i % 3].c; cx.beginPath(); cx.arc(x, y, bs, 0, 7); cx.fill();
        }
        cx.restore();
      }

      // 5c) PAINTQUAKE: at the landing a circle of paint bursts out around the impact (ring in the three colors + blobs), a dust ring at the stomp
      if(pq){
        const f0 = A.f0 || .2, f1 = A.f1 || .7, ccx = (S.sh.x + S.pel.x) / 2, ccy = (S.sh.y + S.pel.y) / 2 + 8;
        cx.save(); cx.lineCap = 'round';
        if(p >= f1 && p < f1 + .3){
          const k = (p - f1) / .3, e = 1 - (1 - k) * (1 - k);
          for(let c = 0; c < 3; c++){ cx.globalAlpha = (1 - k) * .85; cx.strokeStyle = PAINT[c].c; cx.lineWidth = (7 - 5 * k) - c * 1.6; cx.beginPath(); cx.arc(ccx, ccy, Math.max(1, PQ_R * e - c * 4), 0, 7); cx.stroke(); }
          cx.globalAlpha = (1 - k) * .3; cx.fillStyle = PAINT[1].l; cx.beginPath(); cx.arc(ccx, ccy, Math.max(1, PQ_R * e), 0, 7); cx.fill();
          for(let i = 0; i < 26; i++){
            const a = i / 26 * 6.283 + rnd(i) * .3, rr = PQ_R * e * (.5 + .5 * rnd(i + 5)), x = ccx + Math.cos(a) * rr, y = ccy + Math.sin(a) * rr * .6 - 20 * Math.sin(k * 3.14) * rnd(i + 8), bs = (1.8 + 2.6 * rnd(i + 3)) * (1 - k * .5);
            cx.globalAlpha = 1 - k * k; cx.fillStyle = OUT; cx.beginPath(); cx.arc(x, y, bs + .9, 0, 7); cx.fill();
            cx.fillStyle = PAINT[i % 3].c; cx.beginPath(); cx.arc(x, y, bs, 0, 7); cx.fill();
          }
        }else if(p >= f0 - .06 && p < f0 + .12){
          const k = (p - f0 + .06) / .18; cx.globalAlpha = (1 - k) * .7; cx.strokeStyle = PAINT[0].l; cx.lineWidth = 3 - 2 * k; cx.beginPath(); cx.ellipse(ccx, ccy + 14, 8 + 26 * k, 3 + 5 * k, 0, 0, 7); cx.stroke();
        }
        cx.restore();
      }

      // 6) paint splash at the hit (step 3 = bigger)
      const late = step === 2 ? .07 : 0;                                                      // the fling splash starts a bit later, when the tip is out in front
      if(atk && !hurt && !spin && !pq && p >= CONTACT[step] + late && p < CONTACT[step] + .34){
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
      // 8b) floating paint droplets orbit the brush (very subtle at idle, livelier while she attacks); small paint particles trail behind the brush while she runs
      if(!hurt && !white){
        const sc = {x:h.x + Math.sin(mi.ang) * 29, y:h.y + Math.cos(mi.ang) * 29}, hot = atk ? 1 : 0;
        for(let i = 0; i < 3; i++){
          const a = t * (1.1 + 3.4 * hot) + i * 2.094, rr = 12 + 2 * Math.sin(t * 1.7 + i) + 4 * hot, x = sc.x + Math.cos(a) * rr, y = sc.y + Math.sin(a) * rr * .8;
          cx.globalAlpha = (.5 + .4 * hot) * (.7 + .3 * Math.sin(t * 3 + i)); cx.fillStyle = PAINT[i].c; cx.beginPath(); cx.arc(x, y, 1.1 + .5 * hot, 0, 7); cx.fill();
          cx.fillStyle = PAINT[i].l; cx.beginPath(); cx.arc(x - .3, y - .35, .4, 0, 7); cx.fill();
        }
        cx.globalAlpha = 1;
        mi.tp = mi.tp || []; mi.tpT = (mi.tpT || 0) + dt;
        if(run > .35 && f.gr && !atk && mi.tpT > .07 && mi.tp.length < 14){ mi.tpT = 0; mi.tp.push({x:tipP.x, y:tipP.y + 3, vx:-10 - 20 * rnd(t * 10), vy:-10 + 30 * rnd(t * 7), life:.5, c:Math.floor(rnd(t * 3) * 3)}); }
        for(let i = mi.tp.length - 1; i >= 0; i--){
          const q = mi.tp[i]; q.life -= dt; if(q.life <= 0){ mi.tp.splice(i, 1); continue; }
          q.x += (q.vx - (f.vx || 0) * f.face) * dt; q.y += q.vy * dt; q.vy += 140 * dt;                // world-fixed: the trail stays where she painted it
          cx.globalAlpha = clamp(q.life * 2.2, 0, .8); cx.fillStyle = PAINT[q.c].c; cx.beginPath(); cx.arc(q.x, q.y, 1 + q.life * 1.4, 0, 7); cx.fill();
        }
        cx.globalAlpha = 1;
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