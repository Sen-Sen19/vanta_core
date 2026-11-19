// UMBRA art - tall void entity. Same shared ragdoll (body.js): only sizes, colors, a ghost-like pose and void effects.
// HOLD ATK = CHARGE: both hands go above his head, a big dark sphere grows between them. Let go = he throws it (see skills.js chargeShot).
// Hooks used: body (sizes), colors, pose() = floating idle / long-stride run, attack() + spring() = the 3 sphere casts + the charge,
//             behind() = void smoke, front() = eye + cast glow, shot() = how the flying dark sphere looks (drawn by arena.js).
// SETTINGS: FLOAT = how much he sways in idle (0 = none)   LAG = how late the head follows the body (0 = none)
(() => {
  const FLOAT = 1, LAG = 1;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const CP = .3;                                 // charge freeze point = chargeP in skills.js
  const T = 11.5, SH = 11;                       // thigh + shin length (must match body below)

  // ---- BASIC ATTACK: 3 casts. Every cast = COIL (slow + soft: hand pulls back, void gathers) then RELEASE (fast + stiff: hand thrusts, sphere leaves) ----
  // p = 0..1 over the swing. C = release = shot.p in skills.js (keep them the same).
  //   1 LEFT  (near arm) - low coil, hand scoops back, then pushes the sphere out straight.        C = .50
  //   2 RIGHT (far arm)  - hand goes HIGH behind his head, then throws the sphere down-forward.     C = .50
  //   3 BOTH arms        - deep crouch, arms spread wide gathering, then both hands slam together in front = big sphere.  C = .525
  const C = [.5, .5, .525];
  const STEP = [
    { // 1 LEFT
      aN:[[0,.3],[.12,-.2],[.3,-.8],[.42,-.8],[.5,1.5],[.6,1.56],[.8,1.2],[1,.3]],
      eN:[[0,.55],[.3,2.0],[.42,2.0],[.5,.1],[.6,.06],[.8,.5],[1,.55]],
      aF:[[0,-.1],[.3,-.7],[.5,.2],[1,-.1]], eF:[[0,.5],[.3,1.3],[.5,.7],[1,.5]],
      lean:[[0,.05],[.3,-.3],[.42,-.3],[.5,.38],[.6,.42],[.8,.26],[1,.05]],
      head:[[0,0],[.3,.25],[.5,.12],[.64,-.3],[.82,-.1],[1,0]],                 // head arrives LATE (ghost feel)
      tN:[[0,.26],[.3,-.2],[.5,.6],[.8,.5],[1,.26]], tF:[[0,-.2],[.3,-.55],[.5,-.7],[.8,-.45],[1,-.2]],
      Y:[[0,21],[.3,18.5],[.42,18.5],[.5,19.5],[1,21]]
    },
    { // 2 RIGHT
      aF:[[0,-.1],[.3,2.85],[.42,2.95],[.5,1.35],[.62,1.1],[.8,.5],[1,-.1]],
      eF:[[0,.5],[.3,.9],[.42,.9],[.5,.15],[.62,.2],[1,.5]],
      aN:[[0,.3],[.3,-.9],[.5,-1.1],[.8,-.4],[1,.3]], eN:[[0,.55],[.5,.7],[1,.55]],
      lean:[[0,.05],[.3,-.38],[.42,-.42],[.5,.32],[.62,.48],[.8,.28],[1,.05]],
      head:[[0,0],[.3,.2],[.5,.2],[.66,-.35],[.84,-.1],[1,0]],
      tN:[[0,.26],[.3,.45],[.5,.15],[.8,.2],[1,.26]], tF:[[0,-.2],[.3,-.35],[.5,-.75],[.8,-.4],[1,-.2]],
      Y:[[0,21],[.3,19],[.42,19],[.5,20],[1,21]]
    },
    { // 3 BOTH
      aN:[[0,.3],[.1,-.3],[.3,-1.0],[.45,-1.0],[.525,1.45],[.66,1.5],[.85,1.0],[1,.3]],
      eN:[[0,.55],[.3,1.9],[.45,1.9],[.525,.12],[.66,.1],[.85,.5],[1,.55]],
      aF:[[0,-.1],[.1,-.4],[.3,-1.15],[.45,-1.15],[.525,1.45],[.66,1.5],[.85,1.0],[1,-.1]],
      eF:[[0,.5],[.3,1.9],[.45,1.9],[.525,.12],[.66,.1],[.85,.5],[1,.5]],
      lean:[[0,.05],[.1,.2],[.3,-.42],[.45,-.45],[.525,.34],[.66,.42],[.85,.2],[1,.05]],
      head:[[0,0],[.3,.3],[.525,.2],[.7,-.35],[.9,-.1],[1,0]],
      tN:[[0,.26],[.3,.3],[.525,.5],[.85,.4],[1,.26]], tF:[[0,-.2],[.3,-.5],[.525,-.55],[.85,-.4],[1,-.2]],
      Y:[[0,21],[.1,18],[.3,16.5],[.45,16.5],[.525,19.5],[1,21]]
    }
  ];
  // CHARGED THROW (after letting go): arms drop from over the head down + forward, body whips forward. Throw moment = chargeShot.p (.5) in skills.js.
  const THROW = {
    aN:[[CP,2.6],[.42,2.45],[.5,1.4],[.62,1.2],[.85,.8],[1,.3]],  eN:[[CP,.55],[.5,.2],[.62,.15],[1,.55]],
    aF:[[CP,2.45],[.42,2.3],[.5,1.35],[.62,1.15],[.85,.7],[1,-.1]], eF:[[CP,.7],[.5,.2],[.62,.15],[1,.5]],
    lean:[[CP,-.25],[.42,-.4],[.5,.45],[.62,.52],[.85,.25],[1,.05]], head:[[CP,.3],[.5,.2],[.68,-.35],[.88,-.1],[1,0]],
    tN:[[CP,.3],[.5,.7],[1,.26]], tF:[[CP,-.3],[.5,-.72],[1,-.2]], Y:[[CP,20],[.42,17.5],[.5,19.5],[1,21]]
  };
  // knee angle that puts the ankle at height Y for thigh angle th, so BOTH feet stay on the same ground height (no floating foot)
  const legK = (th, Y) => { const a = Math.acos(clamp((Y - T * Math.cos(th)) / SH, -1, 1)); const k = th - a; return k > .05 ? k : th + a; };
  // pose a skill from keyframes (same format as the basic casts)
  const keyPose = (tg, p, s, K) => {
    ['aN', 'eN', 'aF', 'eF', 'lean', 'head', 'tN', 'tF'].forEach(j => tg[j] = K(p, s[j]));
    const Y = Math.min(K(p, s.Y), .97 * (T + SH) * Math.min(Math.cos(tg.tN), Math.cos(tg.tF)));
    tg.kN = legK(tg.tN, Y); tg.kF = legK(tg.tF, Y);
  };
  const setLegs = (tg, Y) => { tg.kN = legK(tg.tN, Math.min(Y, .97 * (T + SH) * Math.min(Math.cos(tg.tN), Math.cos(tg.tF)))); tg.kF = legK(tg.tF, Math.min(Y, .97 * (T + SH) * Math.min(Math.cos(tg.tN), Math.cos(tg.tF)))); };
  // VOID CLAW cast (A.skill 'voidclaw', p over `cast` s): the near arm winds back, then thrusts out and down toward the marked spot and holds
  const CLAW = {
    aN:[[0,.3],[.25,-.5],[.55,1.25],[1,1.15]], eN:[[0,.55],[.25,1.6],[.55,.1],[1,.12]],
    aF:[[0,-.1],[.5,.3],[1,.3]], eF:[[0,.5],[1,.5]],
    lean:[[0,.05],[.25,-.2],[.55,.38],[1,.34]], head:[[0,0],[.5,.15],[1,.1]],
    tN:[[0,.26],[.5,.5],[1,.45]], tF:[[0,-.2],[.5,-.5],[1,-.4]], Y:[[0,21],[.5,19.5],[1,19.5]]
  };
  // HAND OF THE ABYSS (A.skill 'abysshand', A.ph 0 rift / 1 rise + lift / 2 close + crush / 3 slam / 4 sink, A.pp = progress): arms point down at the rift, rise to call the hand up, clench, then throw down
  const ultPose = (tg, A) => {
    const ph = A.ph || 0, pp = A.pp || 0, e = pp * pp * (3 - 2 * pp), lp = (a, b, k) => a + (b - a) * k;
    let P;
    if(ph === 0) P = {aN:lp(.4, 1.0, e), aF:lp(.2, .8, e), eN:.5, eF:.5, lean:.12, head:0};
    else if(ph === 1) P = {aN:lp(1.0, 2.7, e), aF:lp(.8, 2.6, e), eN:.4, eF:.4, lean:lp(.1, -.2, e), head:.25};
    else if(ph === 2) P = {aN:2.7, aF:2.6, eN:lp(.4, 1.7, e), eF:lp(.4, 1.7, e), lean:-.2, head:.3};
    else if(ph === 3) P = {aN:.5, aF:.4, eN:.2, eF:.2, lean:.5, head:-.2};
    else P = {aN:lp(.5, .3, e), aF:lp(.4, -.1, e), eN:.5, eF:.5, lean:lp(.5, .05, e), head:lp(-.2, 0, e)};
    Object.assign(tg, P, {tN:.3, tF:-.3}); setLegs(tg, ph === 3 ? 18.5 : 20);
  };
  // ---- the giant shadow hand (Void Claw + Hand of the Abyss). (x, y) = bottom of the palm, fingers point UP. s = scale, curl 0 = open .. 1 = fist, rot = tilt,
  //      part: undefined = whole hand, 'back' = palm only, 'front' = fingers + thumb (drawn over the grabbed enemy) ----
  const FING = [-.72, -.24, .24, .72], FLEN = [.82, 1, .94, .74];
  const hand = (cx, x, y, s, curl, rot, part) => {
    const PW = 36 * s, PH = 52 * s, lp = (a, b, k) => a + (b - a) * k;
    cx.save(); cx.translate(x, y); cx.rotate(rot); cx.lineJoin = 'round'; cx.lineCap = 'round';
    if(part !== 'front'){
      cx.fillStyle = '#07030f'; cx.strokeStyle = '#6a3cff'; cx.lineWidth = 2.4;
      cx.beginPath(); cx.moveTo(-PW * .72, 6 * s); cx.quadraticCurveTo(-PW * 1.12, -PH * .5, -PW * .98, -PH); cx.lineTo(PW * .98, -PH); cx.quadraticCurveTo(PW * 1.12, -PH * .5, PW * .72, 6 * s); cx.closePath(); cx.fill(); cx.stroke();
      cx.strokeStyle = 'rgba(143,107,255,.35)'; cx.lineWidth = 1.5;
      for(let i = -1; i <= 1; i++){ cx.beginPath(); cx.moveTo(i * PW * .5, -PH * .15); cx.lineTo(i * PW * .55, -PH * .85); cx.stroke(); }
    }
    if(part !== 'back'){
      const w = 11 * s;
      const finger = (bx, by, qx, qy, tx, ty) => {
        cx.beginPath(); cx.moveTo(bx, by); cx.quadraticCurveTo(qx, qy, tx, ty);
        cx.strokeStyle = '#6a3cff'; cx.lineWidth = w + 3; cx.stroke(); cx.strokeStyle = '#0d0620'; cx.lineWidth = w; cx.stroke();
        const a = Math.atan2(ty - qy, tx - qx);                                                                    // claw tip
        cx.fillStyle = '#c9b2ff'; cx.beginPath(); cx.moveTo(tx + Math.cos(a - 1.5) * w * .45, ty + Math.sin(a - 1.5) * w * .45); cx.lineTo(tx + Math.cos(a) * w * 1.2, ty + Math.sin(a) * w * 1.2); cx.lineTo(tx + Math.cos(a + 1.5) * w * .45, ty + Math.sin(a + 1.5) * w * .45); cx.closePath(); cx.fill();
      };
      for(let i = 0; i < 4; i++){
        const fx = FING[i] * PW, Lf = 62 * s * FLEN[i];
        finger(fx, -PH, lp(fx * 1.12, fx * 1.35, curl), lp(-PH - Lf * .55, -PH - Lf, curl), lp(fx * 1.28, fx * .3, curl), lp(-PH - Lf, -PH * .4 + (i % 2) * 6 * s, curl));
      }
      finger(-PW * .85, -PH * .22, lp(-PW * 1.5, -PW * 1.2, curl), lp(-PH * .3, -PH * .95, curl), lp(-PW * 1.95, PW * .1, curl), lp(-PH * .72, -PH * .5, curl));   // thumb
    }
    cx.restore();
  };
  const arm = (cx, x, y0, y1, w, t) => {   // the shadow arm from the ground up to the hand (y0 = top, y1 = ground)
    if(y1 <= y0) return;
    cx.fillStyle = '#07030f'; cx.strokeStyle = '#6a3cff'; cx.lineWidth = 2.2;
    cx.beginPath(); cx.moveTo(x - w * .55, y0); cx.lineTo(x - w, y1); cx.lineTo(x + w, y1); cx.lineTo(x + w * .55, y0); cx.closePath(); cx.fill(); cx.stroke();
    cx.strokeStyle = 'rgba(143,107,255,.3)'; cx.lineWidth = 2;
    for(let i = 0; i < 4; i++){ const k = (t * .8 + i / 4) % 1, yy = y1 - (y1 - y0) * k, ww = w * (1 - k * .45); cx.beginPath(); cx.moveTo(x - ww * .7, yy); cx.quadraticCurveTo(x, yy - 8 + Math.sin(t * 5 + i) * 4, x + ww * .7, yy); cx.stroke(); }
  };
  // a dark shadow copy of him (the Shadow Step afterimage)
  const ghost = (cx, x, y, face, a, t) => {
    const cap = (x1, y1, x2, y2, w) => { cx.lineCap = 'round'; cx.strokeStyle = '#8f6bff'; cx.lineWidth = w + 1.6; cx.beginPath(); cx.moveTo(x1, y1); cx.lineTo(x2, y2); cx.stroke(); cx.strokeStyle = '#0d0620'; cx.lineWidth = w; cx.beginPath(); cx.moveTo(x1, y1); cx.lineTo(x2, y2); cx.stroke(); };
    cx.save(); cx.translate(x, y); cx.scale(face, 1); cx.globalAlpha = a;
    for(let i = 0; i < 5; i++){ cx.fillStyle = 'rgba(106,60,255,' + (.25 - i * .04) + ')'; cx.beginPath(); cx.ellipse(-4 - i * 5, -22 + Math.sin(t * 3 + i) * 4 - i * 2, 7 - i, 3.4, .3, 0, 7); cx.fill(); }
    cap(0, -28, -2, -14, 5.4); cap(-2, -14, -3, 0, 4.4); cap(0, -28, 3, -14, 5.4); cap(3, -14, 2, 0, 4.4);
    cap(0, -28, 3, -44, 9.5); cap(3, -43, 12, -34, 3.8); cap(12, -34, 17, -42, 3.4); cap(3, -43, 6, -33, 3.8); cap(6, -33, 12, -28, 3.4);
    cx.fillStyle = '#0d0620'; cx.strokeStyle = '#8f6bff'; cx.lineWidth = 1.2; cx.beginPath(); cx.arc(4, -51, 6, 0, 7); cx.fill(); cx.stroke();
    cx.fillStyle = '#efe6ff'; cx.beginPath(); cx.ellipse(7.2, -52, 2.6, 1.7, 0, 0, 7); cx.fill();
    cx.restore();
  };

  Characters.art('umbra', {
    // taller (about +12%), slim, long limbs. Hitbox is still 30x52 (arena.js is not changed per character).
    body: {head:{r:5.8}, torso:{len:14, w:9}, uArm:{len:10.5, w:3.8}, fArm:{len:10.5, w:3.4}, hand:{r:2.8},
           thigh:{len:11.5, w:5}, shin:{len:11, w:4.2}, foot:{len:7, w:3.2}},
    colors: {shirt:'#2a1659', limb:'#3a2080', far:'#1b0f3d', head:'#120a2a', dark:'#0a0614', hand:'#6a3cff'},

    // cast 2 uses the FAR (right) arm: draw it on top of the body so you can see it. Cast 3 uses both.
    farFront: f => f.atk > 0 && (((f.A && f.A.step) || 0) >= 1 || (f.A && f.A.chg > 0) || (f.A && f.A.skill === 'abysshand')),

    // soft while he coils (floppy, ghost-like), very stiff at the release (snap), medium after
    spring(p, A){
      if(A.skill) return (A.skill === 'abysshand' && A.ph === 3) ? {k:600, d:36} : {k:240, d:22};   // Umbra's skills: smooth, the ultimate slam snaps
      if(A.chg > 0){
        if(p <= CP + .004) return {k:130, d:14};                       // holding the charge: soft, heavy
        if(A.cl > 0 && p > .38 && p < .62) return {k:460, d:30};       // throw: snap
      }
      const c = C[A.step || 0];
      if(p < c - .1) return {k:95, d:9};
      if(p < c + .1) return {k:440, d:30};
      return {k:150, d:17};
    },

    attack(tg, p, A, K){
      if(A.skill === 'voidclaw'){ keyPose(tg, p, CLAW, K); return; }
      if(A.skill === 'abysshand'){ ultPose(tg, A); return; }
      if(A.chg > 0 && p <= CP + .004){                                  // CHARGE HOLD: both hands above the head, leaning back, looking up at the sphere. Deeper the longer you hold.
        const L = A.cl || 0;
        Object.assign(tg, {aN:2.6, eN:.55, aF:2.45, eF:.7, lean:-.15 - .12 * L, head:.28 + .1 * L, tN:.3, tF:-.3});
        const Y = Math.min(20.5 - 1.8 * L, .97 * (T + SH) * Math.min(Math.cos(tg.tN), Math.cos(tg.tF)));
        tg.kN = legK(tg.tN, Y); tg.kF = legK(tg.tF, Y); return;
      }
      const s = A.chg > 0 && A.cl > 0 ? THROW : STEP[A.step || 0];      // released with enough charge = the big throw, else the normal cast
      ['aN','eN','aF','eF','lean','head','tN','tF'].forEach(j => tg[j] = K(p, s[j]));
      const Y = Math.min(K(p, s.Y), .97 * (T + SH) * Math.min(Math.cos(tg.tN), Math.cos(tg.tF)));
      tg.kN = legK(tg.tN, Y); tg.kF = legK(tg.tF, Y);
    },

    // idle = slow sway, almost still. run = long stride, bigger lean. The head and arms arrive a bit late (LAG).
    pose(tg, f, t, run, K){
      const s = Math.sin(t * 1.3) * FLOAT, s2 = Math.sin(t * 1.3 - .9 * LAG) * FLOAT;
      const idle = 1 - run;
      tg.lean += idle * s * .05 + run * .08;
      tg.head += idle * s2 * .09 - run * .1 * LAG;
      tg.aN += idle * s2 * .1;  tg.aF -= idle * s2 * .1;
      tg.eN += idle * .15;      tg.eF += idle * .2;       // arms hang loose and a little bent
      tg.tN *= 1 + run * .15;   tg.tF *= 1 + run * .15;   // longer strides
    },

    // void smoke behind him: soft purple wisps that trail off with his speed
    behind(cx, f, t, S, P){
      const dragX = -(f.vx * f.face) * .035;
      for(let i = 0; i < 5; i++){
        const ph = t * 1.6 + i * 1.3, a = .22 - i * .03;
        const x = S.pel.x - 3 - i * 4 + dragX * (i + 1), y = S.pel.y + 4 + Math.sin(ph) * 3 - i * 2;
        cx.fillStyle = 'rgba(106,60,255,' + a + ')';
        cx.beginPath(); cx.ellipse(x, y, 6 - i * .6, 3.2, Math.sin(ph) * .4, 0, 7); cx.fill();
      }
      const g = cx.createRadialGradient(S.sh.x, S.sh.y + 4, 2, S.sh.x, S.sh.y + 4, 24);
      g.addColorStop(0, 'rgba(90,40,220,.25)'); g.addColorStop(1, 'rgba(90,40,220,0)');
      cx.fillStyle = g; cx.beginPath(); cx.arc(S.sh.x, S.sh.y + 4, 24, 0, 7); cx.fill();
    },

    // ONE eye (side view), no nose, no mouth, light trail. Plus the cast glow in the hands.
    front(cx, f, t, S, P){
      // tell arena.js where the hands are in the world, so the sphere leaves the real hand
      f.handW = {N:{x:f.x + f.face * S.aN.hand.x, y:f.y + S.aN.hand.y}, F:{x:f.x + f.face * S.aF.hand.x, y:f.y + S.aF.hand.y}};

      const h = S.head, ex = h.x + 3.2, ey = h.y - 1;
      const trail = Math.min(14, 4 + Math.abs(f.vx) * .05);
      const g = cx.createLinearGradient(ex, ey, ex - trail, ey - 1);
      g.addColorStop(0, 'rgba(190,150,255,.9)'); g.addColorStop(1, 'rgba(190,150,255,0)');
      cx.fillStyle = g; cx.beginPath(); cx.moveTo(ex, ey - 1.3); cx.lineTo(ex - trail, ey - 2.2); cx.lineTo(ex - trail, ey - .4); cx.lineTo(ex, ey + 1.3); cx.fill();
      cx.fillStyle = 'rgba(179,140,255,.35)'; cx.beginPath(); cx.ellipse(ex, ey, 4.6, 3.3, 0, 0, 7); cx.fill();
      cx.fillStyle = '#efe6ff'; cx.beginPath(); cx.ellipse(ex, ey, 2.6, 1.7, 0, 0, 7); cx.fill();
      cx.fillStyle = '#6a3cff'; cx.beginPath(); cx.arc(ex + .7, ey, .9, 0, 7); cx.fill();

      // ---- cast glow + charge ----
      if(f.atk > 0 && f.A && f.A.skill){   // Void Claw / Hand of the Abyss: both hands glow violet
        [S.aN.hand, S.aF.hand].forEach(hd => { const g = cx.createRadialGradient(hd.x, hd.y, 1, hd.x, hd.y, 15); g.addColorStop(0, 'rgba(170,120,255,.85)'); g.addColorStop(1, 'rgba(170,120,255,0)'); cx.fillStyle = g; cx.beginPath(); cx.arc(hd.x, hd.y, 15, 0, 7); cx.fill(); });
      }
      if(f.atk > 0 && f.A && !f.A.skill){
        const A = f.A, st = A.step || 0, p = clamp(1 - f.atk / A.time, 0, 1), cs = A.chargeShot;
        const charged = A.chg > 0 && A.cl > 0 && cs;                    // released with enough charge = the big throw
        const hold = A.chg > 0 && cs && (f.charging || (charged && p < cs.p));   // sphere floats above the head until it is thrown
        const hands = st === 0 ? [S.aN.hand] : st === 1 ? [S.aF.hand] : [S.aN.hand, S.aF.hand];
        if(hold){
          const lo = A.chargeMin ?? .2, hi = A.chargeMax ?? 1.2, cl = clamp(((f.chg || 0) - lo) / (hi - lo), 0, 1);
          const r = f.chg < lo ? 5 + (cs.rMin - 5) * clamp(f.chg / lo, 0, 1) : cs.rMin + (cs.rMax - cs.rMin) * cl;   // same size formula as the thrown sphere
          const mx = (S.aN.hand.x + S.aF.hand.x) / 2, my = (S.aN.hand.y + S.aF.hand.y) / 2 - r * .8 - 2;
          for(let i = 0; i < 9; i++){                                   // motes get pulled in
            const k = (t * 1.7 + i / 9) % 1, a = t * 6 + i * .7, rr = r + 4 + (1 - k) * 26;
            cx.fillStyle = 'rgba(190,150,255,' + (.15 + .6 * k) + ')'; cx.beginPath(); cx.arc(mx + Math.cos(a) * rr, my + Math.sin(a) * rr * .8, 1 + k, 0, 7); cx.fill();
          }
          const gl = cx.createRadialGradient(mx, my, r * .3, mx, my, r * 2.4);
          gl.addColorStop(0, 'rgba(120,70,255,' + (.35 + .3 * cl) + ')'); gl.addColorStop(1, 'rgba(120,70,255,0)');
          cx.fillStyle = gl; cx.beginPath(); cx.arc(mx, my, r * 2.4, 0, 7); cx.fill();
          cx.fillStyle = '#07030f'; cx.beginPath(); cx.arc(mx, my, r * (1 + Math.sin(t * 20) * .03), 0, 7); cx.fill();
          cx.strokeStyle = 'rgba(179,140,255,.35)'; cx.lineWidth = 4 + 3 * cl; cx.stroke(); cx.strokeStyle = '#b38cff'; cx.lineWidth = 1.6 + 1.2 * cl; cx.stroke();
          if(cl >= 1){ cx.strokeStyle = 'rgba(230,210,255,' + (.4 + .4 * Math.sin(t * 22)) + ')'; cx.lineWidth = 1.2; cx.beginPath(); cx.arc(mx, my, r + 5 + Math.sin(t * 22) * 2, 0, 7); cx.stroke(); }   // FULL: pulsing ring
        } else {
          const c = charged ? cs.p : C[st], big = st === 2 || charged, rMax = A.shot ? A.shot.r : 9;
          const hs = charged ? [S.aN.hand, S.aF.hand] : hands;
          if(p < c){                                           // COIL: motes spiral in, a small dark core grows in each hand
            const k = clamp(p / c, 0, 1);
            hs.forEach(hd => {
              for(let i = 0; i < 7; i++){
                const a = t * 8 + i * .9, r = (1 - k) * (big ? 20 : 14) + 3;
                cx.fillStyle = 'rgba(190,150,255,' + (.2 + .6 * k) + ')';
                cx.beginPath(); cx.arc(hd.x + Math.cos(a) * r, hd.y + Math.sin(a) * r * .7, 1 + k * .8, 0, 7); cx.fill();
              }
              cx.fillStyle = '#0a0614'; cx.beginPath(); cx.arc(hd.x, hd.y, 1.5 + k * rMax * (big ? .4 : .55), 0, 7); cx.fill();
              cx.strokeStyle = 'rgba(190,150,255,' + (.4 + .5 * k) + ')'; cx.lineWidth = 1.2; cx.stroke();
            });
          } else if(p < c + .14){                              // RELEASE: a quick flash ring where the sphere left
            const k = (p - c) / .14, hd = hs.length > 1 ? {x:(hs[0].x + hs[1].x) / 2, y:(hs[0].y + hs[1].y) / 2} : hs[0];
            cx.strokeStyle = 'rgba(210,180,255,' + (1 - k) + ')'; cx.lineWidth = 2 * (1 - k) + .5;
            cx.beginPath(); cx.arc(hd.x + 4, hd.y, 4 + k * (charged ? 34 : big ? 20 : 11), 0, 7); cx.stroke();
          }
        }
      }
    },

    // EFFECTS UNDER the bodies (arena.js calls fxBack(cx, f, t) for every fighter of this hero): Shadow Step afterimage, Void Claw ground mark, Hand of the Abyss rift + arm + palm
    fxBack(cx, f, t){
      const ai = f.afterimg; if(ai) ghost(cx, ai.x, ai.y, ai.face, (1 - ai.t / ai.life) * .8, t);
      const C = f.vclaw;
      if(C && C.t < (C.d.cast || .45)){                                // the marked spot: a pulsing dark circle on the ground
        const k = C.t / (C.d.cast || .45), rx = C.d.halfW * (.5 + .6 * k), pu = .6 + .4 * Math.sin(t * 22);
        cx.fillStyle = 'rgba(40,12,100,' + (.35 + .3 * k) + ')'; cx.strokeStyle = 'rgba(143,107,255,' + pu + ')'; cx.lineWidth = 2.5;
        cx.beginPath(); cx.ellipse(C.x, C.gy - 2, rx, rx * .26, 0, 0, 7); cx.fill(); cx.stroke();
        cx.strokeStyle = 'rgba(143,107,255,.5)'; cx.lineWidth = 1.5; for(let i = 0; i < 5; i++){ const a = i * 1.26 + 4 * k; cx.beginPath(); cx.moveTo(C.x + Math.cos(a) * rx * .2, C.gy - 2 + Math.sin(a) * rx * .05); cx.lineTo(C.x + Math.cos(a) * rx * .9, C.gy - 2 + Math.sin(a) * rx * .24); cx.stroke(); }
      }
      const S = f.uhand;
      if(S && S.riftK > 0){
        const rx = 112 * S.riftK, ry = 27 * S.riftK, X = S.x, Y = S.gy;
        const g = cx.createRadialGradient(X, Y, 4, X, Y, rx); g.addColorStop(0, 'rgba(0,0,0,.95)'); g.addColorStop(.7, 'rgba(40,10,100,.85)'); g.addColorStop(1, 'rgba(106,60,255,0)');
        cx.fillStyle = g; cx.beginPath(); cx.ellipse(X, Y, rx, ry, 0, 0, 7); cx.fill();
        cx.strokeStyle = 'rgba(143,107,255,' + (.6 + .3 * Math.sin(t * 12)) + ')'; cx.lineWidth = 2.5; cx.beginPath(); cx.ellipse(X, Y, rx * .92, ry * .92, 0, 0, 7); cx.stroke();
        cx.strokeStyle = 'rgba(190,160,255,.5)'; cx.lineWidth = 1.6; for(let i = 0; i < 3; i++){ cx.beginPath(); cx.ellipse(X, Y, rx * (.3 + .2 * i), ry * (.3 + .2 * i), 0, t * 3 + i * 2, t * 3 + i * 2 + 2.2); cx.stroke(); }
        if(S.t >= S.c1 && S.alpha > 0){                                // arm + palm (the enemy is drawn on top of this, then the fingers)
          const j = S.t >= S.c4 && S.t < S.c5 ? (Math.random() - .5) * 4 : 0;
          cx.save(); cx.globalAlpha = S.alpha; cx.translate(j, 0); arm(cx, X, S.hy, Y + 4, 58, t); hand(cx, X, S.hy, 1.6, S.curl, 0, 'back'); cx.restore();
          cx.fillStyle = 'rgba(10,4,30,.96)'; cx.beginPath(); cx.ellipse(X, Y, rx * .95, ry * .95, 0, 0, Math.PI); cx.fill();     // the near lip of the rift covers the base of the arm
          cx.strokeStyle = 'rgba(143,107,255,.85)'; cx.lineWidth = 2.2; cx.beginPath(); cx.ellipse(X, Y, rx * .95, ry * .95, 0, 0, Math.PI); cx.stroke();
        }
      }
    },
    // EFFECTS OVER the bodies: the Void Claw (the whole claw) and the fingers of the Hand of the Abyss
    fx(cx, f, t){
      const C = f.vclaw;
      if(C && C.t >= (C.d.cast || .45)){
        const d = C.d, tc = d.cast || .45, ts = d.swipe || .18, u = clamp((C.t - tc) / ts, 0, 1), e = u * u * (3 - 2 * u), end = C.t - tc - ts - (d.linger || 1);
        const sink = end > 0 ? clamp(end / .25, 0, 1) : 0, rise = e * (1 - sink * .55), al = 1 - sink, s = d.halfW / 34;
        cx.globalAlpha = al;
        cx.fillStyle = 'rgba(10,4,30,.9)'; cx.strokeStyle = 'rgba(143,107,255,.9)'; cx.lineWidth = 2.5; cx.beginPath(); cx.ellipse(C.x, C.gy - 2, d.halfW * 1.15, d.halfW * .3, 0, 0, 7); cx.fill(); cx.stroke();   // the broken ground
        const by = C.gy - 78 * rise;
        arm(cx, C.x, by, C.gy, 46, t);
        hand(cx, C.x, by, s, .12 + .3 * e - .1 * sink, C.dir * (-.55 + .85 * e), undefined);
        cx.globalAlpha = 1;
      }
      const S = f.uhand;
      if(S && S.t >= S.c1 && S.alpha > 0){
        const j = S.t >= S.c4 && S.t < S.c5 ? (Math.random() - .5) * 4 : 0;
        cx.globalAlpha = S.alpha; cx.translate(j, 0); hand(cx, S.x, S.hy, 1.6, S.curl, 0, 'front'); cx.globalAlpha = 1;
      }
    },

    // the flying sphere (arena.js calls this; s = {x, y, r, vx, age, kind}). Dark core, bright violet rim, tail, orbiting motes. Bigger for the combined cast.
    shot(cx, s, t){
      const d = s.vx > 0 ? 1 : -1, big = s.kind >= 2, pulse = 1 + Math.sin(s.age * 18) * .06;
      const r = s.r * pulse, tail = r * (big ? 4.5 : 3.5);
      const g = cx.createLinearGradient(s.x, s.y, s.x - d * tail, s.y);
      g.addColorStop(0, 'rgba(106,60,255,.55)'); g.addColorStop(1, 'rgba(106,60,255,0)');
      cx.fillStyle = g; cx.beginPath(); cx.moveTo(s.x, s.y - r * .9); cx.lineTo(s.x - d * tail, s.y); cx.lineTo(s.x, s.y + r * .9); cx.closePath(); cx.fill();   // tail
      const glow = cx.createRadialGradient(s.x, s.y, r * .4, s.x, s.y, r * 2.2);
      glow.addColorStop(0, 'rgba(120,70,255,.5)'); glow.addColorStop(1, 'rgba(120,70,255,0)');
      cx.fillStyle = glow; cx.beginPath(); cx.arc(s.x, s.y, r * 2.2, 0, 7); cx.fill();                                                                          // glow
      cx.fillStyle = '#07030f'; cx.beginPath(); cx.arc(s.x, s.y, r, 0, 7); cx.fill();                                                                           // dark core
      cx.strokeStyle = 'rgba(179,140,255,.35)'; cx.lineWidth = big ? 6 : 4; cx.stroke(); cx.strokeStyle = '#b38cff'; cx.lineWidth = big ? 2.4 : 1.6; cx.stroke();      // rim
      if(s.kind === 3){ cx.strokeStyle = 'rgba(210,180,255,.35)'; cx.lineWidth = 1.5; cx.beginPath(); cx.arc(s.x, s.y, r * (1.5 + Math.sin(s.age * 14) * .08), 0, 7); cx.stroke(); }   // charged: extra outer ring
      for(let i = 0; i < (big ? 6 : 3); i++){                                                                                                                  // orbiting motes
        const a = s.age * 9 + i * (6.283 / (big ? 6 : 3));
        cx.fillStyle = 'rgba(210,180,255,.85)'; cx.beginPath(); cx.arc(s.x + Math.cos(a) * r * 1.45, s.y + Math.sin(a) * r * 1.1, big ? 2 : 1.3, 0, 7); cx.fill();
      }
    }
  });
})();
