// ERRATA art - The Broken Entity.
// Slim, tall, lightweight humanoid entity using the shared ragdoll skeleton (body.js).
// Combat style: Telekinetic Glass Shards.
// VISUAL REDESIGN: Futuristic Glitch Entity / High-Fashion Cyberpunk (long straight black hair, full-width glitch visor, pale porcelain skin,
// fragmented black robe, long gloves, angular boots). Visual only: shard logic, skills and every attack pose below are unchanged.
// - Normal attacks: commands independent glass shards that launch with varied organic trajectory arcs
//   ONLY in her facing direction, with limited short range (~82px).
// - Held-key attack: Goku Super Saiyan focus crouch where all revolving shards freeze in mid-air,
//   releasing into an outstretched single-hand aim where all shards surge through her hand!
(() => {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const state = f => f.erState || (f.erState = {air:false, vy:0, pvy:0, t0:0, landT:-9, dip:0, face:f.face});

  const R = .32, C = .58;
  const MAX_REACH = 72; // Strict short range (semi-melee reach)
  const SHARD_SPEED = 340; // was 720 (shards were visible for ~4 frames)

  // READY / IDLE base angles
  const G0 = {lean:.08, aN:.25, eN:.50, aF:-.12, eF:.52, tN:.22, kN:.20, tF:-.18, kF:.20};

  // COMMAND GESTURE POSES. Local space: arm angle 0 = hanging down, ~1.57 = pointing forward, ~2.1 = up-forward. Shoulder is ~40px above the feet, head ~48px.
  // Timeline of p (0..1): windup is reached at R (.32, where a held ATK freezes), the hand is fully out at ~.54, follow-through to ~.70, then recover.
  //   N = near arm = her LEFT hand, F = far arm = her RIGHT hand.
  const GESTURES = [
    // STEP 0: LEFT jab at shoulder height. Left hand cocks back, snaps straight forward; right hand guards the chest.
    {
      lead: 'N',
      aLead: [[0, G0.aN], [.16, -.20], [R, -.50], [.54, 1.55], [.70, 1.50], [1, G0.aN]],
      eLead: [[0, G0.eN], [.16, 1.0],  [R, 1.50], [.54, .08],  [.70, .10],  [1, G0.eN]],
      aOff:  [[0, G0.aF], [R, .50],  [.54, .55], [1, G0.aF]],
      eOff:  [[0, G0.eF], [R, 1.90], [.54, 1.90],[1, G0.eF]],
      lean:  [[0, G0.lean], [R, -.10], [.54, .24], [.70, .22], [1, G0.lean]],
      tN:    [[0, G0.tN], [R, .35], [.54, .30], [1, G0.tN]],
      kN:    [[0, G0.kN], [R, .70], [.54, .30], [1, G0.kN]],
      tF:    [[0, G0.tF], [R, -.35], [.54, -.22], [1, G0.tF]],
      kF:    [[0, G0.kF], [R, .30], [.54, .22], [1, G0.kF]]
    },

    // STEP 1: RIGHT cross at shoulder height. Right hand winds up behind, drives forward; left hand guards.
    {
      lead: 'F',
      aLead: [[0, G0.aF], [.16, -.60], [R, -.95], [.54, 1.60], [.70, 1.52], [1, G0.aF]],
      eLead: [[0, G0.eF], [.16, 1.0],  [R, 1.30], [.54, .06],  [.70, .10],  [1, G0.eF]],
      aOff:  [[0, G0.aN], [R, .60],  [.54, .55], [1, G0.aN]],
      eOff:  [[0, G0.eN], [R, 1.90], [.54, 1.90],[1, G0.eN]],
      lean:  [[0, G0.lean], [R, -.14], [.54, .30], [.70, .28], [1, G0.lean]],
      tN:    [[0, G0.tN], [R, .30], [.54, .30], [1, G0.tN]],
      kN:    [[0, G0.kN], [R, .30], [.54, .30], [1, G0.kN]],
      tF:    [[0, G0.tF], [R, -.30], [.54, -.30], [1, G0.tF]],
      kF:    [[0, G0.kF], [R, .30], [.54, .25], [1, G0.kF]]
    },

    // STEP 2: RIGHT low strike at ELBOW / waist height. Right hand drops, she dips into a crouch and drives it forward-down.
    {
      lead: 'F',
      aLead: [[0, G0.aF], [.16, -.30], [R, -.55], [.54, 1.00], [.70, .95], [1, G0.aF]],
      eLead: [[0, G0.eF], [.16, .90],  [R, 1.10], [.54, .12],  [.70, .15],  [1, G0.eF]],
      aOff:  [[0, G0.aN], [R, .90],  [.54, .70], [1, G0.aN]],
      eOff:  [[0, G0.eN], [R, 1.80], [.54, 1.90],[1, G0.eN]],
      lean:  [[0, G0.lean], [R, .02], [.54, .40], [.70, .36], [1, G0.lean]],
      tN:    [[0, G0.tN], [R, .45], [.54, .55], [1, G0.tN]],
      kN:    [[0, G0.kN], [R, .60], [.54, .75], [1, G0.kN]],
      tF:    [[0, G0.tF], [R, -.35], [.54, -.45], [1, G0.tF]],
      kF:    [[0, G0.kF], [R, .45], [.54, .55], [1, G0.kF]]
    },

    // STEP 3 FINISHER: LEFT strike at HEAD height. Left hand winds up low and back (shards gather in it), then drives up-forward to head level and releases the 10-shard volley.
    //   0 -> windup (.32) -> hold (.50) -> strike (.60) -> follow-through (.74) -> recover
    {
      lead: 'N',
      aLead: [[0, G0.aN], [.16, -.30], [.32, -.70], [.50, -.75], [.60, 2.05], [.74, 2.00], [1, G0.aN]],
      eLead: [[0, G0.eN], [.16, 1.0],  [.32, 1.40], [.50, 1.50], [.60, .08],  [.74, .10],  [1, G0.eN]],
      aOff:  [[0, G0.aF], [.32, .55], [.50, .55], [.60, .45], [1, G0.aF]],
      eOff:  [[0, G0.eF], [.32, 1.85],[.50, 1.90],[.60, 1.90],[1, G0.eF]],
      lean:  [[0, G0.lean], [.32, -.15], [.50, -.20], [.60, .12], [.74, .14], [1, G0.lean]],
      tN:    [[0, G0.tN], [.32, .35], [.50, .30], [.60, .55], [1, G0.tN]],
      kN:    [[0, G0.kN], [.32, .55], [.50, .60], [.60, .30], [1, G0.kN]],
      tF:    [[0, G0.tF], [.32, -.25],[.50, -.28],[.60, -.45],[1, G0.tF]],
      kF:    [[0, G0.kF], [.32, .45], [.50, .45], [.60, .20], [1, G0.kF]]
    }
  ];

  // Which hand throws, and when, for the three single-hand hits (see updateShards)
  const COMBO_FIRE = [
    {hand:'N', shots:[[.54, 0,  .05], [.60, 1, -.05]]},                      // LEFT jab
    {hand:'F', shots:[[.54, 2, -.05], [.60, 3,  .05]]},                      // RIGHT cross
    {hand:'F', shots:[[.50, 4,  .10], [.56, 5,  0],  [.62, 6, -.10]]}        // RIGHT low strike
  ];

  // 10 UNIQUE IRREGULAR RAZOR GLASS SHARDS (Floating high around chest, shoulders, and head)
  const SHARD_SPECS = [
    {rad:22, hOff:-34, spd:2.2,  phi:0.0,  angOff: 0.12,  scale:1.0},
    {rad:28, hOff:-40, spd:-1.9, phi:1.25, angOff:-0.14,  scale:0.9},
    {rad:24, hOff:-36, spd:2.5,  phi:2.51, angOff: 0.18,  scale:1.1},
    {rad:30, hOff:-44, spd:-2.1, phi:3.77, angOff:-0.16,  scale:0.85},
    {rad:25, hOff:-32, spd:1.8,  phi:5.02, angOff: 0.10,  scale:1.15},
    {rad:29, hOff:-38, spd:-2.4, phi:0.63, angOff:-0.12,  scale:0.95},
    {rad:23, hOff:-42, spd:2.7,  phi:1.88, angOff: 0.15,  scale:0.8},
    {rad:28, hOff:-35, spd:-1.8, phi:3.14, angOff:-0.15,  scale:1.05},
    {rad:26, hOff:-46, spd:2.0,  phi:4.40, angOff: 0.08,  scale:1.2},
    {rad:31, hOff:-30, spd:-2.6, phi:5.65, angOff:-0.10,  scale:0.75}
  ];

  // ===========================================================================================================================
  // VISUAL REDESIGN - "Futuristic Glitch Entity / High-Fashion Cyberpunk"  (DRAW ONLY)
  // Nothing in this block touches gameplay: no hitbox, no shard state / logic, no skill id, no damage. It only draws.
  //   - hair (long, straight, black, layered)      : hairBack() in behind(), hair cap + strand in headFront() (front hook)
  //   - face + full-width glitch visor             : headFront()
  //   - fragmented robe (collar, bodice, panels)   : torso() hook (collar, bodice, mid panels), behind() (back panels), front() (one floating panel)
  //   - split sleeves + long gloves + fingers      : armGear() (torso hook for the far arm, front hook for the near arm / a punching far arm)
  //   - boots                                       : foot() hook
  //   - glitch: gAmt() is a pure function of time (no Math.random, no allocation). V.gi = glitch intensity (low at idle, high on attacks / hits / ultimate)
  // Per-fighter smoothing lives on f.erVis (created once). Module scratch (Q) and CUR are only used inside one fighter's draw.
  // ===========================================================================================================================
  const PAL = {ink:'#09080F', cloth:'#171321', deep:'#32145C', vio:'#854BFF', mag:'#E044D8', cyan:'#47DDF5', white:'#F2F1FF', skin:'#E6D9E8', skinSh:'#a68fae', glove:'#06050B', hair:'#050408', out:'#2a1352'};
  const GL3 = [PAL.mag, PAL.cyan, PAL.white];
  const HR = 5.5;                                          // head radius (same as body.head.r)
  const hsh = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  // glitch event strength 0..1 for one "slot" (seed). Events last ~.1 s; the rarer at low intensity gi.
  function gAmt(t, seed, gi){
    const u = t * 6 + seed * 3.7, b = Math.floor(u);
    if(u - b > .6) return 0;
    const th = .975 - gi * .5, h = hsh(b * 1.37 + seed * 17.3);
    return h < th ? 0 : (h - th) / (1 - th);
  }
  const gSgn = (t, seed) => hsh(Math.floor(t * 6 + seed * 3.7) * 2.11 + seed * 5.3) < .5 ? -1 : 1;

  const Q = new Float64Array(32);                         // scratch polygon (no per-frame allocation)
  let CUR = null;                                         // erVis of the fighter being drawn right now (behind() always runs first)

  function polyQ(cx, n){ cx.beginPath(); cx.moveTo(Q[0], Q[1]); for(let i = 2; i < n * 2; i += 2) cx.lineTo(Q[i], Q[i + 1]); cx.closePath(); }
  function fillQ(cx, n, col, W, rim, ra){
    polyQ(cx, n); cx.fillStyle = W ? '#fff' : col; cx.fill();
    if(!W && rim){ const ga = cx.globalAlpha; cx.globalAlpha = ga * ra; cx.strokeStyle = rim; cx.lineWidth = .7; cx.lineJoin = 'round'; cx.stroke(); cx.globalAlpha = ga; }
  }
  function dupQ(cx, n, dx, col, a){ cx.save(); cx.globalAlpha *= a; cx.translate(dx, 0); polyQ(cx, n); cx.strokeStyle = col; cx.lineWidth = .8; cx.stroke(); cx.restore(); }
  function arrPoly(cx, arr, col, W, rim, ra){             // static point lists (flat [x,y,x,y...])
    cx.beginPath(); cx.moveTo(arr[0], arr[1]); for(let i = 2; i < arr.length; i += 2) cx.lineTo(arr[i], arr[i + 1]); cx.closePath();
    cx.fillStyle = W ? '#fff' : col; cx.fill();
    if(!W && rim){ const ga = cx.globalAlpha; cx.globalAlpha = ga * ra; cx.strokeStyle = rim; cx.lineWidth = .7; cx.lineJoin = 'round'; cx.stroke(); cx.globalAlpha = ga; }
  }
  function ln(cx, x0, y0, x1, y1, col, w, a){ const ga = cx.globalAlpha; cx.globalAlpha = ga * a; cx.strokeStyle = col; cx.lineWidth = w; cx.lineCap = 'round'; cx.beginPath(); cx.moveTo(x0, y0); cx.lineTo(x1, y1); cx.stroke(); cx.globalAlpha = ga; }
  function rc(cx, x, y, w, h, col, a){ const ga = cx.globalAlpha; cx.globalAlpha = ga * a; cx.fillStyle = col; cx.fillRect(x, y, w, h); cx.globalAlpha = ga; }
  // a long strip (hair section / robe panel) as 8 points: TL TR BR BL, the lower part can be shifted sideways by d = a "displaced silhouette" glitch
  function shape8(x0, y0, x1, y1, x2, y2, x3, y3, d){
    const mrx = (x1 + x2) * .5, mry = (y1 + y2) * .5, mlx = (x0 + x3) * .5, mly = (y0 + y3) * .5;
    Q[0] = x0; Q[1] = y0; Q[2] = x1; Q[3] = y1; Q[4] = mrx; Q[5] = mry; Q[6] = mrx + d; Q[7] = mry + .7;
    Q[8] = x2 + d; Q[9] = y2; Q[10] = x3 + d; Q[11] = y3; Q[12] = mlx + d; Q[13] = mly + .7; Q[14] = mlx; Q[15] = mly;
  }

  // her far hand is the striking hand in some poses (same rule as before): it is then drawn over the body
  function farFrontOf(f){
    if(!f.atk || !f.A) return false;
    if(f.A.skill) return f.A.skill === 'dimimpale' || f.A.skill === 'sysoverride';   // the far hand also points at the sky for Dimensional Impale / System Override
    const step = f.A.step || 0;
    return step === 1 || step === 2;
  }

  // per-frame visual state (called once per frame from behind())
  function visUpdate(f, t, dt, S){
    const v = f.erVis || (f.erVis = {t:0, gi:.08, tx:0, ty:0, white:false, ff:false, H:25});
    const A = f.A, atk = f.atk > 0 && !!A, hold = f.charging && f.chg > 0;
    const lvl = clamp((f.chg || 0) / ((A && A.chargeMax) || 1), 0, 1);
    let g = .08;                                                                     // idle: restrained
    if(atk) g = A.skill === 'sysoverride' ? 1 : A.skill ? .8 : ((A.step || 0) === 3 ? .72 : .5);
    if(hold) g = Math.max(g, .4 + .5 * lvl);
    if(f.stun > 0) g = 1;                                                            // damage: strong glitch
    if(typeof G !== 'undefined' && G && G.sov && G.sov.src === f) g = Math.max(g, G.sov.ph === 'on' ? .45 : .75);   // SYSTEM OVERRIDE is running
    v.gi += (g - v.gi) * Math.min(1, dt * (g > v.gi ? 16 : 4));
    const k = Math.min(1, dt * 7);
    v.tx += ((f.vx || 0) * f.face - v.tx) * k; v.ty += ((f.vy || 0) - v.ty) * k;    // smoothed velocity in body space: cloth trails behind it
    v.t = t; v.white = f.flash > 0; v.ff = farFrontOf(f); v.H = Math.max(14, -S.pel.y);   // H = pelvis height above the ground: robe panels are a fraction of it, so they never dip below the floor
    return v;
  }

  // ---- robe panels. ax / ay = anchor relative to the pelvis (x forward, y down, turns with the torso), w = top width, len = length,
  //      sl = hem slant (angular cut), bx = how far the free end floats back (-) or forward (+), sw = sway, tp = taper, col 1 = cloth / 0 = ink
  const PANELS_BACK = [
    {ax:-4.6, ay:-2.0, w:5.4, fl:.80, sl: 2.4, bx:-5.5, sw:1.0, seed:1, col:1, tp:.55},
    {ax:-2.4, ay: 0.0, w:4.6, fl:.88, sl:-2.4, bx:-2.8, sw:.8,  seed:2, col:0, tp:.45},
    {ax:-6.8, ay:-4.0, w:3.8, fl:.58, sl: 1.8, bx:-8.5, sw:1.3, seed:3, col:0, tp:.5},
    {ax:-0.2, ay:-1.0, w:3.6, fl:.70, sl: 2.0, bx: 1.0, sw:1.1, seed:4, col:1, tp:.5}
  ];
  const PANELS_MID = [
    {ax:-1.6, ay:.4, w:4.2, fl:.74, sl: 2.0, bx:-3.4, sw:.9, seed:5, col:0, tp:.5},
    {ax: 1.8, ay:.2, w:3.4, fl:.46, sl:-1.8, bx: 2.4, sw:1.1, seed:6, col:1, tp:.5}
  ];
  const PANEL_FRONT = {ax:3.2, ay:-.4, w:2.8, fl:.56, sl:1.8, bx:4.8, sw:1.0, seed:9, col:1, tp:.5};
  function panel(cx, v, p, ox, oy, cl, sl, W){
    const wx = ox + p.ax * cl - p.ay * sl, wy = oy + p.ax * sl + p.ay * cl, len = p.fl * v.H, k = len / 22;
    const ph = v.t * 1.3 + p.seed * 2.1;
    const lift = clamp(v.ty * .02, -4, 9) * k, flare = clamp(-v.tx * .03, -9, 9) * k;       // falling: hem rises / running: hem trails back
    const ex = wx + p.bx + flare + Math.sin(ph) * .9 * p.sw, ey = wy + len - lift + Math.cos(ph * .8) * .5;
    const hw = p.w / 2, hb = hw * p.tp;
    const g = W ? 0 : gAmt(v.t, p.seed, v.gi), d = g > .3 ? gSgn(v.t, p.seed) * (1 + g * 2) : 0;
    shape8(wx - hw, wy, wx + hw, wy, ex + hb, ey + p.sl, ex - hb, ey - p.sl, d);
    if(g > .45){ dupQ(cx, 8, 1.1, PAL.cyan, .55); dupQ(cx, 8, -1.1, PAL.mag, .45); }       // colour-channel split
    fillQ(cx, 8, p.col ? PAL.cloth : PAL.ink, W, PAL.vio, .2);
    if(!W){
      Q[0] = wx + hw; Q[1] = wy; Q[2] = wx + hw + (ex + hb - wx - hw) * .5; Q[3] = wy + len * .5; Q[4] = ex + hb + d; Q[5] = ey + p.sl;    // angular fold: a faint violet facet down the leading edge
      polyQ(cx, 3); cx.save(); cx.globalAlpha *= .22; cx.fillStyle = PAL.deep; cx.fill(); cx.restore();
      ln(cx, wx + hw, wy + 1, wx + hw + (ex + hb - wx - hw) * .5, wy + len * .5, PAL.vio, .7, .32);   // violet reflection on the leading edge
      ln(cx, wx + hw * .2, wy + len * .22, wx - hw * .5 + d * .5, wy + len * .6, PAL.vio, .5, .4);     // thin reality-fracture line
    }
  }
  const FR = [{dx:-9, dy:-6, s:1.7, seed:41}, {dx:7, dy:-3, s:1.4, seed:42}, {dx:-12, dy:6, s:1.2, seed:43}];
  function frags(cx, v, ox, oy, W){                                                              // tiny displaced geometric fragments, only during glitch events
    if(W) return;
    for(let i = 0; i < FR.length; i++){
      const q = FR[i], g = gAmt(v.t, q.seed, v.gi * .9);
      if(g < .25) continue;
      const bk = Math.floor(v.t * 6 + q.seed * 3.7), x = ox + q.dx + (hsh(bk + 1) - .5) * 5, y = oy + q.dy + (hsh(bk + 2) - .5) * 6 - 2 * g, s = q.s * (.7 + g * .6);
      Q[0] = x - s; Q[1] = y - s * .5; Q[2] = x + s * 1.4; Q[3] = y - s * .8; Q[4] = x + s; Q[5] = y + s * .5; Q[6] = x - s * 1.4; Q[7] = y + s * .8;
      fillQ(cx, 4, i === 1 ? PAL.cloth : PAL.ink, false, GL3[(bk + i) % 3], .8);
    }
  }

  // ---- hair: three layered geometric sections hanging straight behind her (almost no movement), sharp slanted ends, violet sheen
  const HAIR = [
    {a0:-7.2, b0:-3.0, a1:-2.4, b1:3.5, c0:-10.4, c1:-4.8, yb:3,  sl:2.2, seed:21},
    {a0:-6.6, b0:-1.0, a1:-2.4, b1:4.0, c0:-8.8,  c1:-3.8, yb:-1.5, sl:1.8, seed:22},
    {a0:-5.8, b0: 1.0, a1:-2.0, b1:4.5, c0:-6.8,  c1:-2.6, yb:-6, sl:1.6, seed:23}
  ];
  function hairBack(cx, v, S, W){
    const hx = S.head.x, hy = S.head.y, lag = clamp(-v.tx * .011, -2.4, 2.4) - clamp(S.lean, -.2, .6) * 5;
    for(let k = 0; k < 3; k++){
      const h = HAIR[k], yb = S.pel.y + h.yb, g = W ? 0 : gAmt(v.t, h.seed, v.gi * .8), d = g > .3 ? gSgn(v.t, h.seed) * (1 + g * 1.4) : 0;
      shape8(hx + h.a0, hy + h.b0, hx + h.a1, hy + h.b1, hx + h.c1 + lag, yb - h.sl * .6, hx + h.c0 + lag, yb + h.sl, d);
      if(g > .5){ dupQ(cx, 8, 1, PAL.cyan, .45); dupQ(cx, 8, -1, PAL.mag, .4); }
      fillQ(cx, 8, PAL.hair, W, PAL.vio, .22);
      if(!W){                                                                                   // violet reflection: a soft streak that drifts down the section
        const s = (v.t * .33 + k * .31) % 1, x0 = Q[2] + (Q[8] - Q[2]) * s, y0 = Q[3] + (Q[9] - Q[3]) * s;
        ln(cx, x0 - .2, y0, x0 + (Q[8] - Q[2]) * .16 - .2, y0 + (Q[9] - Q[3]) * .16, PAL.vio, .8, .55);
      }
    }
  }

  // ---- head: skin details, hair cap + fringe, curved full-width visor. Head-local space: x = forward, y = down, r = 5.5 (+ outline).
  const CAP = [6.6,-3.1, 4.4,-5.5, .8,-6.9, -3.8,-6.2, -7.0,-2.4, -7.2,3.2, -5.6,5.6, -2.8,3.2, -2.6,-.8, 1.8,-2.8];
  function visorPath(cx){
    cx.beginPath(); cx.moveTo(-4.6, -2.4); cx.quadraticCurveTo(.6, -4.6, 7.4, -3.0); cx.lineTo(8.2, -.9); cx.lineTo(6.6, 1.0); cx.quadraticCurveTo(.6, .6, -4.6, 1.0); cx.closePath();
  }
  function headFront(cx, v, S, rotH, W){
    cx.save(); cx.translate(S.head.x, S.head.y); cx.rotate(rotH); cx.lineJoin = 'round';
    if(!W){
      ln(cx, 3.9, 3.0, 5.7, 2.8, '#8f6d93', .7, .85);                      // understated mouth
      cx.save(); cx.beginPath(); cx.arc(0, 0, HR - .6, .15, 1.7); cx.strokeStyle = PAL.skinSh; cx.lineWidth = .9; cx.globalAlpha *= .55; cx.stroke(); cx.restore();   // jaw shading
      ln(cx, 2.0, 2.4, 3.2, 3.8, PAL.vio, .6, .65); ln(cx, 3.2, 3.8, 2.5, 4.9, PAL.vio, .6, .65);   // faint violet fracture on the jaw
    }
    arrPoly(cx, CAP, PAL.hair, W, PAL.vio, .25);                                                     // hair cap + angular fringe
    if(!W) ln(cx, -1.2, -6.6, 3.0, -5.9, PAL.vio, .8, .5);                                           // reflection on the hair
    // VISOR: one continuous, opaque, curved lens across both eyes
    const gv = W ? 0 : gAmt(v.t, 11, v.gi * 1.3 + .08);
    if(gv > .25){ cx.save(); cx.translate(.9, 0); visorPath(cx); cx.globalAlpha *= .6; cx.strokeStyle = PAL.cyan; cx.lineWidth = .8; cx.stroke(); cx.restore();
                  cx.save(); cx.translate(-.9, 0); visorPath(cx); cx.globalAlpha *= .5; cx.strokeStyle = PAL.mag; cx.lineWidth = .8; cx.stroke(); cx.restore(); }
    visorPath(cx); cx.fillStyle = W ? '#fff' : '#120a26'; cx.fill();
    if(!W){
      cx.save(); visorPath(cx); cx.clip();
      rc(cx, -5, -1.6, 14, 2.8, PAL.deep, .8); rc(cx, -5, -.2, 14, 1.4, PAL.vio, .22);                                                       // violet wash on the lower lens
      rc(cx, -5, -1.6, 14, .55, PAL.vio, .85);                                                        // lens edge
      const gx = -5 + ((v.t * .5) % 1) * 17;                                                         // slow glint
      Q[0] = gx; Q[1] = -3.6; Q[2] = gx + 1.6; Q[3] = -3.6; Q[4] = gx + .2; Q[5] = 1.4; Q[6] = gx - 1.4; Q[7] = 1.4;
      polyQ(cx, 4); cx.save(); cx.globalAlpha *= .4; cx.fillStyle = PAL.white; cx.fill(); cx.restore();
      if(gv > .25){                                                                                  // fragmented reflections + displaced scan slices + pixel artifacts
        const bk = Math.floor(v.t * 6 + 11 * 3.7);
        for(let i = 0; i < 3; i++){
          const y = -2.6 + i * 1.25 + (hsh(bk + i) - .5) * .6, x = -4.5 + hsh(bk * 1.7 + i) * 7, w = 3 + hsh(bk * 2.3 + i) * 6;
          rc(cx, x, y, w, .5 + gv * .4, GL3[(bk + i) % 3], .85);
        }
        rc(cx, -4 + hsh(bk + 9) * 11, -2.9 + hsh(bk + 8) * 3.6, .9, .9, PAL.white, .9);
      }
      cx.restore();
      visorPath(cx); cx.strokeStyle = PAL.out; cx.lineWidth = .8; cx.stroke();
      if(gv > .55){ ln(cx, -7.5, -1 + (hsh(Math.floor(v.t * 6 + 40)) - .5) * 2, 10, -1 + (hsh(Math.floor(v.t * 6 + 40)) - .5) * 2, PAL.mag, .5, .6 * gv); }   // horizontal displacement line crossing the face
    }
    cx.restore();
  }

  // ---- arms: redrawn here so they sit over the head overlay; split sleeve strips (some hang, some float), long glove, segmented fingers
  const STRIP = [{u:.08, L:8.5, off:2.4, sd:1,  seed:1}, {u:.30, L:7.5, off:3.6, sd:-1, seed:2}, {u:.48, L:6.0, off:1.8, sd:1, seed:3}];
  const FNG = [-.62, -.2, .22, .62], FL1 = [2.0, 2.5, 2.4, 2.0], FL2 = [1.5, 1.9, 1.8, 1.4];
  function armGear(cx, v, arm, far, W, redraw){
    const s = arm.s, e = arm.el, h = arm.hand, fdx = h.x - e.x, fdy = h.y - e.y, fl = Math.hypot(fdx, fdy) || 1, ux = fdx / fl, uy = fdy / fl, px = -uy, py = ux;
    cx.save(); cx.lineCap = 'round'; cx.lineJoin = 'round';
    if(redraw){                                                                                      // arm capsules (same geometry as the engine's, drawn again on top of the head overlay)
      cx.strokeStyle = W ? '#fff' : PAL.out; cx.lineWidth = 3.4 + 2.4; cx.beginPath(); cx.moveTo(s.x, s.y); cx.lineTo(e.x, e.y); cx.stroke(); cx.lineWidth = 3 + 2.4; cx.beginPath(); cx.moveTo(e.x, e.y); cx.lineTo(h.x, h.y); cx.stroke();
      cx.strokeStyle = W ? '#fff' : (far ? '#0d0b15' : PAL.cloth); cx.lineWidth = 3.4; cx.beginPath(); cx.moveTo(s.x, s.y); cx.lineTo(e.x, e.y); cx.stroke(); cx.lineWidth = 3; cx.beginPath(); cx.moveTo(e.x, e.y); cx.lineTo(h.x, h.y); cx.stroke();
    }
    const sg = far ? 1.3 : 0, lift = clamp(v.ty * .004, -1, 2);
    // upper-arm drape: two strips that simply hang
    for(let i = 0; i < 2; i++){
      const u = i ? .78 : .42, ax = s.x + (e.x - s.x) * u, ay = s.y + (e.y - s.y) * u, L = i ? 5.6 : 8.2, sd = i ? -1 : 1, wob = Math.sin(v.t * 1.9 + i * 2.3 + sg) * .8;
      Q[0] = ax - .9; Q[1] = ay; Q[2] = ax + .9; Q[3] = ay; Q[4] = ax + sd * 1.8 + wob - clamp(v.tx * .01, -2, 2) + .5; Q[5] = ay + L - lift; Q[6] = ax + sd * 1.8 + wob - clamp(v.tx * .01, -2, 2) - .6; Q[7] = ay + L - lift - 1.2;
      fillQ(cx, 4, i ? PAL.ink : PAL.cloth, W, PAL.vio, .2);
    }
    // forearm strips: hang along / float away from the forearm (they stop before the wrist so the hand stays readable)
    for(let i = 0; i < 3; i++){
      const st = STRIP[i], L = Math.min(st.L, (.86 - st.u) * fl / .6), wob = Math.sin(v.t * 2.2 + i * 1.9 + sg) * .9, g = W ? 0 : gAmt(v.t, 70 + i + sg * 3, v.gi), d = g > .3 ? gSgn(v.t, 70 + i) * (1 + g * 1.6) : 0;
      const ax = e.x + fdx * st.u + px * st.sd * .7, ay = e.y + fdy * st.u + py * st.sd * .7;
      const tx = ax + ux * .6 * L + px * st.sd * (st.off + wob) + d, ty = ay + (uy * .6 + .42) * L + py * st.sd * (st.off + wob) - lift;
      Q[0] = ax - px * .9; Q[1] = ay - py * .9; Q[2] = ax + px * .9; Q[3] = ay + py * .9; Q[4] = tx; Q[5] = ty;
      if(g > .5){ dupQ(cx, 3, 1, PAL.cyan, .5); }
      fillQ(cx, 3, i === 1 ? PAL.ink : PAL.cloth, W, PAL.vio, .3);
    }
    // glove: dark long glove over the lower forearm, hand, segmented fingers
    if(!W){
      cx.strokeStyle = PAL.glove; cx.lineWidth = 3.1; cx.beginPath(); cx.moveTo(e.x + fdx * .3, e.y + fdy * .3); cx.lineTo(h.x, h.y); cx.stroke();
      ln(cx, e.x + fdx * .34 + px * 1.1, e.y + fdy * .34 + py * 1.1, h.x - ux * 1.6 + px * 1.0, h.y - uy * 1.6 + py * 1.0, PAL.vio, .5, .6);   // glitch seam
      cx.fillStyle = PAL.glove; cx.beginPath(); cx.arc(h.x, h.y, 2.7, 0, 7); cx.fill();
      for(let i = 0; i < 4; i++){
        const a = FNG[i], c = Math.cos(a), sn = Math.sin(a), dx = ux * c - uy * sn, dy = ux * sn + uy * c, b0x = h.x + dx * 1.8, b0y = h.y + dy * 1.8, b1x = b0x + dx * FL1[i], b1y = b0y + dy * FL1[i];
        const a2 = a * .6 + (i < 2 ? .35 : -.35), c2 = Math.cos(a2), s2 = Math.sin(a2), d2x = ux * c2 - uy * s2, d2y = ux * s2 + uy * c2, b2x = b1x + d2x * FL2[i], b2y = b1y + d2y * FL2[i];
        const ga = cx.globalAlpha; cx.strokeStyle = PAL.vio; cx.globalAlpha = ga * .55; cx.lineWidth = 2.1; cx.beginPath(); cx.moveTo(b0x, b0y); cx.lineTo(b1x, b1y); cx.lineTo(b2x, b2y); cx.stroke(); cx.globalAlpha = ga;
        cx.strokeStyle = PAL.glove; cx.lineWidth = 1.2; cx.beginPath(); cx.moveTo(b0x, b0y); cx.lineTo(b1x, b1y); cx.lineTo(b2x, b2y); cx.stroke();
      }
      const gh = gAmt(v.t, 80 + sg * 4, v.gi);                                                       // tiny fragments flicker around the wrist
      if(gh > .3){ const bk = Math.floor(v.t * 6 + (80 + sg * 4) * 3.7); rc(cx, h.x - ux * 3 + (hsh(bk) - .5) * 6, h.y - uy * 3 + (hsh(bk + 1) - .5) * 6, 1.1, 1.1, GL3[bk % 3], .9); rc(cx, h.x - ux * 5 + (hsh(bk + 2) - .5) * 6, h.y - uy * 5 + (hsh(bk + 3) - .5) * 6, .8, .8, PAL.white, .8); }
    } else { cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(h.x, h.y, 2.7, 0, 7); cx.fill(); }
    cx.restore();
  }

  // ---- torso hook helpers (torso space: origin = pelvis, x forward, y up = negative, the shoulders are at y = -15)
  const BODICE = [-3.7,-14.2, 3.1,-14.4, 3.6,-7, 2.9,.9, -2.9,1.1, -4,-7];
  const ROBE_BK = [-4.3,-14.6, -.5,-15.2, 1,-8.5, 3,-.5, 1.4,4.6, -6.2,4.2, -5.4,-6.4];
  const SASH = [-4.6,-1.6, 4.2,-2.1, 4,.4, -4.7,.9];
  const COLLAR_B = [-2.6,-13.4, -5.4,-16.6, -9.6,-25.6, -5.4,-23.6, -1.6,-15.8];
  const COLLAR_BI = [-3.0,-14.2, -5.0,-17.2, -8.2,-24.4, -5.2,-22];
  const COLLAR_F = [2.4,-13.6, 5.2,-16.2, 9.4,-21.8, 4.8,-20.8, 1.4,-15];
  const COLLAR_FI = [2.8,-14.2, 5,-16.6, 8,-21, 4.8,-19.6];

  // Draw one individual razor-sharp glass shard with violet refraction
  function renderShard(cx, x, y, rot, scale, alpha, glow, gi, seed, t) {
    // optional (draw-only) glitch: a tiny positional flicker + colour-channel ghost. It never changes s.wx / s.wy, so gameplay trajectories are untouched.
    const gs = gi > 0 ? gAmt(t || 0, 30 + (seed || 0), gi * .8) : 0;
    if(gs > .35){ x += gSgn(t || 0, 30 + (seed || 0)) * 1.2 * gs; }
    cx.save();
    cx.translate(x, y);
    cx.rotate(rot);
    cx.scale(scale, scale);

    const pts = [[-2.5, -6], [2.2, -6.5], [2.8, 5.5], [-1.2, 6.5], [-2.8, 1.2]];

    // Translucent obsidian / deep violet glass body
    cx.beginPath();
    cx.moveTo(pts[0][0], pts[0][1]);
    for(let i = 1; i < pts.length; i++) cx.lineTo(pts[i][0], pts[i][1]);
    cx.closePath();
    cx.fillStyle = `rgba(32, 14, 52, ${0.85 * alpha})`;
    cx.fill();

    // Subtle violet glow if powered
    if(glow > 0){
      cx.strokeStyle = `rgba(192, 132, 252, ${0.85 * glow * alpha})`;
      cx.lineWidth = 2.5;
      cx.stroke();
    }

    // Razor-sharp iridescent violet edge
    cx.strokeStyle = `rgba(168, 85, 247, ${0.9 * alpha})`;
    cx.lineWidth = 1.0;
    cx.stroke();

    // Internal facet reflection highlight
    cx.beginPath();
    cx.moveTo(pts[0][0] * .4, pts[0][1] * .6);
    cx.lineTo(pts[2][0] * .3, pts[2][1] * .5);
    cx.strokeStyle = `rgba(243, 232, 255, ${0.9 * alpha})`;
    cx.lineWidth = 0.8;
    cx.stroke();

    // violet reflection on the lower facet
    cx.beginPath();
    cx.moveTo(pts[3][0], pts[3][1]); cx.lineTo(pts[2][0], pts[2][1]); cx.lineTo(pts[3][0] + 1.6, pts[3][1] - 4.2);
    cx.closePath();
    cx.fillStyle = `rgba(133, 75, 255, ${0.3 * alpha})`;
    cx.fill();

    // occasional cyan / magenta glitch ghost of the outline
    if(gs > .5){
      cx.globalAlpha *= .6;
      cx.save(); cx.translate(1.3, 0); cx.beginPath(); cx.moveTo(pts[0][0], pts[0][1]); for(let i = 1; i < 5; i++) cx.lineTo(pts[i][0], pts[i][1]); cx.closePath(); cx.strokeStyle = PAL.cyan; cx.lineWidth = .7; cx.stroke(); cx.restore();
      cx.save(); cx.translate(-1.3, 0); cx.beginPath(); cx.moveTo(pts[0][0], pts[0][1]); for(let i = 1; i < 5; i++) cx.lineTo(pts[i][0], pts[i][1]); cx.closePath(); cx.strokeStyle = PAL.mag; cx.lineWidth = .7; cx.stroke(); cx.restore();
    }

    cx.restore();
  }

  // Draw curved violet refraction trail behind flying shard
  function drawShardTrail(cx, trail, alpha) {
    if(!trail || trail.length < 2) return;
    cx.save();
    cx.lineCap = 'round';
    for(let i = 1; i < trail.length; i++){
      const q = i / trail.length;
      cx.strokeStyle = `rgba(168, 85, 247, ${0.5 * q * alpha})`;
      cx.lineWidth = 1.2 + 2.0 * q;
      cx.beginPath();
      cx.moveTo(trail[i - 1].x, trail[i - 1].y);
      cx.lineTo(trail[i].x, trail[i].y);
      cx.stroke();
    }
    cx.restore();
  }

  // Initialize or retrieve persistent floating shards state
  function getShards(f){
    if(!f._errataShards){
      f._errataShards = SHARD_SPECS.map((sp, idx) => ({
        idx,
        state: 'orbit', // 'orbit' | 'frozen' | 'flying' | 'return'
        spec: sp,
        wx: f.x + Math.cos(sp.phi) * sp.rad,
        wy: f.y + sp.hOff,
        wrot: sp.phi,
        curOrbitAngle: sp.phi,
        vx: 0, vy: 0,
        startX: f.x,
        curveSign: (idx % 2 === 0 ? 1 : -1),
        trail: [],
        dmg: 0.3,
        depth: 0 // -1 behind, +1 front
      }));
      f._firedMask = 0;
      f._lastAtk = 0;
    }
    return f._errataShards;
  }

  // World position of a striking hand (captured every frame in behind() from the live skeleton, so shards leave from where the hand really is)
  function handPos(f, which){
    const h = f._erHand && f._erHand[which];
    return h ? {x: h.x + f.face * 4, y: h.y} : {x: f.x + f.face * 18, y: f.y - 36};
  }

  // Launch a shard forward from the striking hand (so the height matches the punch: shoulder / elbow / head), short range
  function launchOrganicShard(s, f, hand, dmg, angleSpread, speedMul, hitstop, bigShake) {
    s.state = 'flying';
    s.trail = [];
    s.dmg = dmg;
    s.fan = false; s.gath = false; s.trav = 0; s.atkA = null;   // clear leftovers from a held-key (fan) throw, or normal shards would die instantly
    s.startX = f.x;
    s.isHeldKey = false;
    s.maxReach = MAX_REACH; // strictly short range (~72px semi-melee)
    s.hasHit = false;
    s.wx = hand.x;
    s.wy = hand.y;
    s.linger = 0;
    s.hs = hitstop || 0;
    s.shk = !!bigShake;

    // Direct forward only in facing direction, with slight angle variation
    const baseAng = f.face > 0 ? 0 : Math.PI;
    const launchAng = baseAng + (angleSpread || 0) * f.face;
    const spd = SHARD_SPEED * (speedMul || 1);
    s.vx = Math.cos(launchAng) * spd;
    s.vy = Math.sin(launchAng) * spd;
    s.wrot = launchAng + Math.PI / 2;
  }

  // FINISHER throw: the shard bursts out of the left hand (head height) and is hurled at the enemy's head
  function throwShard(s, f, o, hand, dmg, spread, hitstop) {
    s.state = 'flying';
    s.trail = [];
    s.dmg = dmg;
    s.fan = false; s.gath = false; s.trav = 0; s.atkA = null;   // clear leftovers from a held-key (fan) throw, or normal shards would die instantly
    s.startX = f.x;
    s.isHeldKey = false;
    s.hasHit = false;
    s.linger = 0;
    s.hs = hitstop || 0;
    s.shk = s.idx === 0;
    s.maxReach = 260;  // long enough to reach an enemy at normal fighting distance
    s.wx = hand.x; s.wy = hand.y + (Math.random() - .5) * 5;
    const tx = o ? o.x : f.x + f.face * 120, ty = o ? o.y - o.h * .8 : hand.y;
    let ang = Math.atan2(ty - s.wy, tx - s.wx);
    // never throw backwards, and keep the throw reasonably flat
    if(f.face > 0) ang = clamp(ang, -.9, .9); else ang = ang > 0 ? clamp(ang, Math.PI - .9, Math.PI) : clamp(ang, -Math.PI, -Math.PI + .9);
    ang += spread * f.face;
    const spd = 620;
    s.vx = Math.cos(ang) * spd;
    s.vy = Math.sin(ang) * spd;
    s.wrot = ang + Math.PI / 2;
  }

  // Update shard positions, organic flight, semi-melee range limit, and return orbits
  function updateShards(f, dt, t){
    const shards = getShards(f);
    const FANC = Characters.skillsOf('errata').basic.fan;
    const o = typeof G !== 'undefined' && G && G.f ? foeOf(f) : null;
    const A = f.A || {};
    const atk = f.atk > 0;
    const p = atk ? clamp(1 - f.atk / (A.time || .28), 0, 1) : 0;
    const charging = f.charging && f.chg > 0;
    const chgLvl = clamp((f.chg || 0) / ((f.A && f.A.chargeMax) || 1), 0, 1);

    const gatherNow = atk && !A.skill && (A.step || 0) === 3 && !(A.cl > 0) && p < .6;   // finisher windup: all shards gather around the left hand
    const gh = handPos(f, 'N');                                                // (where the gathering shards go)

    // Reset hit mask when new attack starts
    if(f.atk > f._lastAtk + 1e-4){
      f._firedMask = 0;
      f._barrageFired = 0;
      f._atkHit = false;
    }
    f._lastAtk = f.atk;

    // 1. NORMAL COMBO: each hit's shards leave from the hand that threw it, at that hand's own height (facing direction only)
    //    Step 0 LEFT jab (shoulder) | Step 1 RIGHT cross (shoulder) | Step 2 RIGHT low strike (elbow / waist) | Step 3 LEFT head strike (head) = 10-shard volley
    //    Each entry: [p when it fires, shard index, angle spread]. The hand is fully out at p ~ .54, so the shards leave right as the strike lands.
    if(atk && !charging && !(A.cl > 0) && !A.skill){   // (a skill cast is not a combo hit)
      const step = A.step || 0;
      const toFire = [];

      if(step < 3){
        const F = COMBO_FIRE[step];
        F.shots.forEach((sh, k) => {
          if(p >= sh[0] && !(f._firedMask & (1 << k))){ f._firedMask |= (1 << k); toFire.push({idx:sh[1], hand:F.hand, spread:sh[2]}); }
        });
      } else {
        // Step 3 FINISHER: left hand at head height -> all 10 shards are THROWN at the enemy's head in a quick volley
        const spreads = [0, .08, -.08, .14, -.14, .04, -.04, .18, -.18, 0];
        for(let k = 0; k < 10; k++){
          if(p >= .64 + k * .012 && !(f._firedMask & (1 << k))){ f._firedMask |= (1 << k); toFire.push({idx:k, hand:'N', spread:spreads[k], throwAt:true}); }
        }
      }

      const dmgEach = (A.dmg || 0.6) * ((A.step || 0) === 3 ? 0.30 : 0.45);
      toFire.forEach(item => {
        const s = shards[item.idx];
        const hand = handPos(f, item.hand);
        if(item.throwAt || s.state === 'orbit' || s.state === 'return'){
          if(item.throwAt) throwShard(s, f, o, hand, dmgEach, item.spread, (A.hitstop || 0) * .5);
          else launchOrganicShard(s, f, hand, dmgEach, item.spread, 1.0, (A.hitstop || 0) * .6, false);
        }
      });
    }

    // 2. REALITY COLLAPSE (held key). Charging gathers the shards that are in orbit (one more the longer the hold, never more than she has). Release throws ONLY those, in a fan toward the aim.
    const casted = (A.cl || 0) > 0;                                           // CASTING TIME done (hold > castTime). Before that nothing is gathered and letting go fires nothing
    if(charging && casted && !f._castPing){ f._castPing = 1; if(typeof G !== 'undefined' && G && G.rings) G.rings.push({x:f.x, y:f.y - 30, life:.25}); }
    if(!charging) f._castPing = 0;
    if(charging && A.fan && casted){
      const want = clamp(Math.ceil(clamp(A.cl || 0, 0, 1) * shards.length), 1, shards.length);
      let have = shards.filter(s => s.gath).length;
      for(const s of shards){ if(have >= want) break; if(!s.gath && s.state === 'orbit'){ s.gath = true; have++; } }
    }
    const isChargeRelease = !f.charging && A.fan && A.cl > 0 && !f._barrageFired && p >= (R - 0.05);   // only a COMPLETED cast fires the fan
    if(isChargeRelease){
      f._barrageFired = 1;
      const g = shards.filter(s => s.gath && s.state === 'orbit'), n = g.length;
      if(n){
        const ar = f.erAim || {x:f.face, y:0}, base = Math.atan2(ar.y, ar.x), stp = FANC.angle / Math.max(1, FANC.shards - 1);
        const hx = f.x + ar.x * 20, hy = f.y - 34 + ar.y * 20;
        const shared = {dmg:FANC.dmg, kbx:FANC.kbx, kby:FANC.kby, stunx:FANC.stunx, noShake:true, hitstop:FANC.hitstop};   // ONE attack object for the whole volley (passives treat it as one attack)
        g.forEach((s, k) => {
          const ang = base + (k - (n - 1) / 2) * stp;
          s.state = 'flying'; s.trail = []; s.isHeldKey = true; s.fan = true; s.atkA = shared; s.trav = 0; s.maxD = FANC.range; s.hasHit = false; s.linger = 0;
          s.wx = hx; s.wy = hy; s.vx = Math.cos(ang) * FANC.speed; s.vy = Math.sin(ang) * FANC.speed; s.wrot = ang + Math.PI / 2;
        });
        if(typeof G !== 'undefined' && G && G.rings) G.rings.push({x:hx, y:hy, life:.2});
      }
    }
    if(!charging) shards.forEach(s => { s.gath = false; });                    // gathered shards that were not thrown (hit / interrupted) go back to orbit

    // UPDATE EACH SHARD
    shards.forEach(s => {
      // Trail tracking
      if(s.state === 'flying'){
        s.trail.push({x: s.wx, y: s.wy});
        if(s.trail.length > 6) s.trail.shift();
      } else if(s.trail.length > 0){
        s.trail.shift();
      }

      if(s.state === 'flying'){
        // Organic gentle trajectory curve for normal attacks; held key flies straight
        if(!s.isHeldKey){
          s.wy += s.curveSign * Math.sin(t * 14 + s.idx) * 35 * dt;
        }
        s.wx += s.vx * dt;
        s.wy += s.vy * dt;
        if(s.linger > 0){ s.linger -= dt; if(s.linger <= 0){ s.state = 'return'; s.vy = -120; } return; }

        // RANGE LIMIT: short range (~82px) for normal hits; long range (480px) for held key!
        if(s.fan) s.trav += Math.hypot(s.vx, s.vy) * dt;
        const dist = s.fan ? s.trav : Math.abs(s.wx - s.startX);
        const reachLimit = s.fan ? s.maxD : (s.maxReach || MAX_REACH);
        if(dist > reachLimit){
          s.state = 'return';
          return;
        }

        // Collision check (only hits in forward facing direction)
        if(o && (o.inv <= 0 || f._atkHit) && !s.hasHit && (typeof G === 'undefined' || !G || !G.over)){
          const forwardCheck = s.fan || (o.x - f.x) * f.face > 0;        // a fan shard goes where it was aimed
          const inX = Math.abs(s.wx - o.x) < o.w / 2 + 10;
          const inY = s.wy > o.y - o.h - 4 && s.wy < o.y + 4;
          if(forwardCheck && inX && inY){
            if(!s.hasHit){
              s.hasHit = true;
              if(typeof hurt === 'function'){
                f._atkHit = true; // follow-up shards of the same attack still land through the 0.15s i-frames
                if(s.fan) hurt(o, {c:f.c, A:s.atkA, face:s.vx >= 0 ? 1 : -1, src:f});   // each shard = its own hit
                else hurt(o, {c:f.c, A:{dmg:s.dmg, kbx:s.isHeldKey ? 0.35 : 0.20, kby:s.isHeldKey ? 0.18 : 0.12, noShake:!s.shk && !s.isHeldKey, hitstop:s.isHeldKey ? .08 : s.hs}, face:f.face});
              }
              if(typeof G !== 'undefined' && G && G.parts){
                for(let k = 0; k < 3; k++){
                  G.parts.push({
                    x: s.wx, y: s.wy,
                    vx: (Math.random() - .5) * 320 + f.face * 80,
                    vy: (Math.random() - .8) * 220,
                    life: .35, col: '#c084fc'
                  });
                }
              }
            }

            // Normal shards stick in the target briefly (visible impact), then return; held-key pierces through
            if(!s.isHeldKey){
              s.vx *= 0.05; s.vy = 0;
              s.linger = .10;
            }
          }
        }
      } else if(s.state === 'return'){
        // Return arc back toward orbit
        const sp = s.spec;
        const targetWx = gatherNow ? gh.x + Math.cos(s.curOrbitAngle) * 11 : f.x + Math.cos(s.curOrbitAngle) * sp.rad;
        const targetWy = gatherNow ? gh.y + Math.sin(s.curOrbitAngle) * 11 : f.y + sp.hOff;
        const dist = Math.hypot(targetWx - s.wx, targetWy - s.wy);
        if(dist < 10){
          s.state = 'orbit';
        } else {
          s.wx += (targetWx - s.wx) * (16 * dt);
          s.wy += (targetWy - s.wy) * (16 * dt);
          s.wrot = s.curOrbitAngle + Math.PI / 2;
        }
      } else {
        // Orbit vs FAST ROTATION during Hold Charge
        const sp = s.spec;
        if(charging && s.gath){
          // GATHERED: this shard spins fast in a tight ring in front of her hand, where the fan will leave from
          const dir = sp.spd >= 0 ? 1 : -1, ar = f.erAim || {x:f.face, y:0};
          const fastSpeed = dir * (Math.abs(sp.spd) + 8.5 + 14.0 * chgLvl);
          s.curOrbitAngle += fastSpeed * dt;
          const targetWx = f.x + ar.x * 26 + Math.cos(s.curOrbitAngle) * 8;
          const targetWy = f.y - 34 + ar.y * 26 + Math.sin(s.curOrbitAngle) * 8;
          s.wx += (targetWx - s.wx) * (25 * dt);
          s.wy += (targetWy - s.wy) * (25 * dt);
          s.wrot = s.curOrbitAngle + Math.PI / 2;
          s.depth = Math.sin(s.curOrbitAngle);
        } else {
          // Normal elegant revolving orbit (finisher windup: shards gather in a tight spinning ring above the raised hands)
          const gather = gatherNow;
          s.curOrbitAngle += sp.spd * (gather ? 3 : 1) * dt;
          const targetWx = gather ? gh.x + Math.cos(s.curOrbitAngle) * 11 : f.x + Math.cos(s.curOrbitAngle) * sp.rad;
          const targetWy = gather ? gh.y + Math.sin(s.curOrbitAngle) * 11 : f.y + sp.hOff;
          s.wx += (targetWx - s.wx) * (20 * dt);
          s.wy += (targetWy - s.wy) * (20 * dt);
          s.wrot = s.curOrbitAngle + Math.PI / 2;
          s.depth = Math.sin(s.curOrbitAngle);
        }
      }
    });
  }

  // near-side hair strand that falls over the collar to the chest (drawn in front()), same black layered look
  function hairStrand(cx, v, S, W){
    const sx = S.head.x - 3.6, sy = S.head.y + 1.5, lag = clamp(-v.tx * .006, -1.2, 1.2), g = W ? 0 : gAmt(v.t, 24, v.gi * .8), d = g > .3 ? gSgn(v.t, 24) * 1.4 : 0;
    shape8(sx - 1.3, sy, sx + 1.1, sy, sx + .6 + lag, sy + 16, sx - 1.9 + lag, sy + 14.4, d);
    fillQ(cx, 8, PAL.hair, W, PAL.vio, .25);
  }

  Characters.art('errata', {
    // Tall, slender, delicate humanoid dimensions (52px shared hitbox) - sizes unchanged, only the outline / pelvis disc are restyled
    body: {
      head:  {r: 5.5},
      torso: {len: 15, w: 8},
      uArm:  {len: 11, w: 3.4},
      fArm:  {len: 11, w: 3},
      hand:  {r: 2.5},
      thigh: {len: 12, w: 4.5},
      shin:  {len: 12, w: 3.8},
      foot:  {len: 7,  w: 3},
      belt: 3,
      outline: PAL.out, outlineW: 1.2     // deep-violet rim instead of a black outline: the black outfit keeps a readable silhouette
    },

    // Black fabric, pale porcelain skin. (The torso, boots, gloves and visor are drawn by the hooks below.)
    colors: {
      shirt:   PAL.ink,
      limb:    PAL.cloth,   // near sleeve
      far:     '#0d0b15',   // far sleeve
      head:    PAL.skin,    // pale porcelain
      dark:    '#0c0a14',
      hand:    PAL.glove,
      legs:    '#0d0b15',   // fitted black trousers
      legsFar: '#08070d'
    },

    // Far arm (her RIGHT hand) drawn in front when it is the striking hand: Step 1 (cross) and Step 2 (low strike)
    farFront: farFrontOf,

    // TORSO hook (the shared body calls this instead of drawing its default capsule): far-arm gear, floating mid robe panels, neck, sculptural high collar,
    // fitted bodice with an open-front overlapping robe. `CUR` = this fighter's visual state (behind() always runs first).
    torso(cx, S, B, P, white){
      const v = CUR;
      if(!v){ Body.capsule(cx, S.pel, S.sh, B.torso.w + B.outlineW * 2, B.outline); Body.capsule(cx, S.pel, S.sh, B.torso.w, white ? '#fff' : P.shirt); return; }
      const W = white, cl = Math.cos(S.lean), sl = Math.sin(S.lean);
      if(!v.ff) armGear(cx, v, S.aF, true, W, false);                       // far arm is behind the body in this pose: its sleeve strips + glove are drawn now
      for(let i = 0; i < PANELS_MID.length; i++) panel(cx, v, PANELS_MID[i], S.pel.x, S.pel.y, cl, sl, W);
      // neck: pale porcelain, with a faint corruption line and (during glitch events) displaced fragments
      Body.capsule(cx, S.sh, S.head, 3.4 + B.outlineW * 2, W ? '#fff' : PAL.out); Body.capsule(cx, S.sh, S.head, 3.4, W ? '#fff' : PAL.skin);
      cx.save(); cx.translate(S.pel.x, S.pel.y); cx.rotate(S.lean); cx.lineJoin = 'round';
      arrPoly(cx, COLLAR_B, PAL.cloth, W, PAL.vio, .4);                    // tall angular collar: back plate
      if(!W) arrPoly(cx, COLLAR_BI, PAL.ink, false, null, 0);
      arrPoly(cx, ROBE_BK, PAL.cloth, W, PAL.vio, .2);                     // robe back panel (asymmetric overlap)
      arrPoly(cx, BODICE, PAL.ink, W, PAL.vio, .25);                         // fitted bodice (open front: the dark inner layer shows)
      arrPoly(cx, SASH, PAL.deep, W, null, 0);
      if(!W){
        ln(cx, 2.8, -14.4, .4, 1.2, PAL.vio, .7, .6); ln(cx, 3.5, -11.4, 1.8, 1.6, PAL.vio, .5, .35);      // lapel edges
        const g = gAmt(v.t, 51, v.gi), d = g > .3 ? gSgn(v.t, 51) * 1.3 : 0, ox = g > .3 ? 1 : 0;
        ln(cx, -2.6 + d, -11.4, -.6 + d, -8.8, g > .45 ? PAL.cyan : PAL.vio, .6, .6); ln(cx, -.6 + d, -8.8, -1.8, -6, g > .45 ? PAL.mag : PAL.vio, .6, .6);   // fracture across the chest
        ln(cx, .5, -16.6, 1.6, -14.8, PAL.vio, .6, .7);                                                          // neck fracture
        if(g > .3) rc(cx, 1.6 + ox, -18.4, 1.3, .9, PAL.vio, .9);
      }
      arrPoly(cx, COLLAR_F, PAL.cloth, W, PAL.vio, .4);                    // front collar plate (stays below the visor)
      if(!W) arrPoly(cx, COLLAR_FI, PAL.ink, false, null, 0);
      cx.restore();
    },

    // BOOTS (called right after each leg): slim, angular, black with a restrained violet seam. Same ground contact as the default foot.
    foot(cx, leg, P, white, f, far){
      const H = leg.hip, Kn = leg.knee, A = leg.ankle, v = CUR, W = white;
      const sx = A.x - Kn.x, sy = A.y - Kn.y, sl = Math.hypot(sx, sy) || 1, ux = sx / sl, uy = sy / sl;
      const phi = leg.planted ? 0 : clamp(-leg.sa * .5, -.8, .8), lift = leg.planted ? clamp((H.x - A.x - 2) * .12, 0, 3.5) : 0;
      const ax = A.x, ay = A.y - lift, bx = ax - ux * sl * .46, by = ay - uy * sl * .46;
      const col = W ? '#fff' : (far ? '#07060c' : '#0b0912');
      cx.save(); cx.lineCap = 'round'; cx.lineJoin = 'round';
      cx.strokeStyle = W ? '#fff' : PAL.out; cx.lineWidth = 4 + 2.4; cx.beginPath(); cx.moveTo(bx, by); cx.lineTo(ax, ay); cx.stroke();
      cx.strokeStyle = col; cx.lineWidth = 4; cx.beginPath(); cx.moveTo(bx, by); cx.lineTo(ax, ay); cx.stroke();
      cx.translate(ax, ay); cx.rotate(phi);
      cx.beginPath(); cx.moveTo(-1.9, -1.6); cx.lineTo(-2.2, 1.5); cx.lineTo(6.3, 1.5); cx.lineTo(7.8, .1); cx.lineTo(4.6, -1.2); cx.lineTo(1.8, -2.4); cx.closePath();
      cx.fillStyle = col; cx.fill(); cx.strokeStyle = W ? '#fff' : PAL.out; cx.lineWidth = 1.2; cx.stroke();
      cx.rotate(-phi); cx.translate(-ax, -ay);
      if(!W){
        // angular cuff: a slanted band at the top of the shaft
        const px = -uy, py = ux;
        Q[0] = bx - px * 2.3 - ux * 1.2; Q[1] = by - py * 2.3 - uy * 1.2; Q[2] = bx + px * 2.3 + ux * .9; Q[3] = by + py * 2.3 + uy * .9; Q[4] = bx + px * 2.3 + ux * 3.2; Q[5] = by + py * 2.3 + uy * 3.2; Q[6] = bx - px * 2.3 + ux * 1.2; Q[7] = by - py * 2.3 + uy * 1.2;
        fillQ(cx, 4, PAL.cloth, false, PAL.vio, .3);
        cx.translate(ax, ay); cx.rotate(phi); ln(cx, -1.6, 1.2, 6.6, 1.2, PAL.vio, .5, .6);              // sole seam
        if(v && gAmt(v.t, far ? 61 : 62, v.gi) > .35) ln(cx, 2.2, -.6, 7.2, -.1, PAL.cyan, .6, .85);      // toe flicker
      }
      cx.restore();
    },

    // Movement personality:
    // - Idle: Slightly tilted posture, subtle head tilt, delicate breathing
    // - Walk: Long, light strides
    // - Run: Lean forward with quick steps
    // - Land: Light impact and quick recovery
    pose(tg, f, t, run, K){
      const s = state(f);
      const ph = (f.rig && f.rig.phase) || 0;
      const sn = Math.sin(ph), cs = Math.cos(ph);
      const b = Math.sin(t * 1.8);

      if(s.air){ s.air = false; s.landT = t; s.dip = clamp(Math.abs(s.vy) / 600, .2, .6); }

      // IDLE: Slightly tilted posture (delicate tilt of head and torso, light resting arms)
      const IDLE = {
        lean: .08 + b * .015,
        head: -.07 + Math.sin(t * 1.8 + .5) * .03,
        aN: .18 + b * .03, eN: .42,
        aF: -.12 - b * .03, eF: .45,
        tN: .22, kN: .20 + (.5 + .5 * Math.sin(t * 3.6)) * .04,
        tF: -.18, kF: .20 + (.5 + .5 * Math.sin(t * 3.6 + 1.6)) * .04
      };

      // RUN: Lean forward with quick steps, long light strides
      const RUN = {
        lean: .36 + .03 * Math.cos(2 * ph),
        head: -.04,
        aN: -sn * .85, eN: .85 + .25 * cs,
        aF: sn * .85, eF: .85 - .25 * cs,
        tN: sn * 1.05 + .08, kN: .22 + 1.05 * Math.max(0, cs),
        tF: -sn * 1.05 + .08, kF: .22 + 1.05 * Math.max(0, -cs)
      };

      for(const k in IDLE) tg[k] = lerp(IDLE[k], RUN[k], run);

      // Light landing recovery
      const q = (t - s.landT) / .26;
      if(q < 1 && K){
        const d = K(q, [[0, 0], [.2, 1], [1, 0]]) * s.dip;
        tg.kN += .35 * d; tg.kF += .35 * d; tg.lean += .16 * d;
        return {k: 220, d: 20};
      }

      return {k: 160, d: 15};
    },

    // Air: Lightweight takeoff, flexible limbs in the fall
    air(tg, f, t){
      const s = state(f);
      s.air = true; s.vy = f.vy; s.pvy = f.vy;
      const m = clamp((f.vy + 240) / 480, 0, 1);
      tg.lean = lerp(.12, .04, m);
      tg.head = -.06;
      tg.aN = lerp(1.9, 1.2, m); tg.eN = .38;
      tg.aF = lerp(1.5, -0.7, m); tg.eF = .42;
      tg.tN = lerp(.60, .28, m); tg.kN = lerp(.85, .32, m);
      tg.tF = lerp(-.2, -.32, m); tg.kF = lerp(.55, .24, m);
      return {k: 140, d: 13};
    },

    // Knockback: Noticeable displacement due to low mass, quick re-stabilization
    hurt(tg, f, t){
      const hs = f.vx * f.face >= 0 ? 1 : -1;
      const q = clamp(f.stun / .26, 0, 1), r = 1 - q;
      tg.lean = .6 * hs * q + .08 * r;
      tg.head = -.45 * hs * q;
      tg.aN = -1.8 * hs * q + .3 * r; tg.eN = .5;
      tg.aF = -1.3 * hs * q + .2 * r; tg.eF = .6;
      tg.tN = -.6 * hs * q + .35 * r; tg.kN = .45;
      tg.tF = .6 * hs * q - .2 * r;   tg.kF = .45;
      return {k: 80 + 100 * r, d: 7 + 8 * r};
    },

    // Spring response for telekinetic command gestures
    spring(p, A){
      if(A.skill === 'dimimpale') return p > .4 && p < .7 ? {k:900, d:55} : {k:260, d:26};          // slow raise, hard snap down
      if(A.skill === 'shatteredgravity') return {k:300, d:28};
      if(A.skill === 'sysoverride') return p > .55 ? {k:1000, d:50} : {k:240, d:24};   // slow raise, hard snap out
      if(p < R - .03 || (A.chg > 0 && p < R + .002)) return {k: A.chg > 0 ? 360 : 280, d: 28};
      if(p < C + .08) return A.cl > 0 ? {k: 1450, d: 75} : {k: 1100, d: 60};
      return {k: 260, d: 24};
    },

    // Command gesture solver
    attack(tg, p, A, K){
      // SKILL I - DIMENSIONAL IMPALE: both hands rise overhead (summoning the shard), then are driven down and forward to slam it
      if(A.skill === 'dimimpale'){
        tg.aN = K(p, [[0, G0.aN], [.35, 2.9], [.5, 3.0], [.62, 1.5], [.8, 1.2], [1, G0.aN]]); tg.eN = K(p, [[0, G0.eN], [.35, .2], [.5, .15], [.62, .1], [1, G0.eN]]);
        tg.aF = K(p, [[0, G0.aF], [.35, 2.7], [.5, 2.8], [.62, 1.4], [.8, 1.1], [1, G0.aF]]); tg.eF = K(p, [[0, G0.eF], [.35, .25], [.5, .2], [.62, .1], [1, G0.eF]]);
        tg.lean = K(p, [[0, G0.lean], [.45, -.2], [.62, .38], [1, G0.lean]]); tg.head = -tg.lean * .35;
        tg.tN = .3; tg.kN = .4; tg.tF = -.25; tg.kF = .35;
        return;
      }
      // ULTIMATE - SYSTEM OVERRIDE: both arms rise overhead, hold (reality tearing), then snap wide open as the override hits
      if(A.skill === 'sysoverride'){
        tg.aN = K(p, [[0, G0.aN], [.45, 2.95], [.65, 3.0], [.8, 1.7], [1, G0.aN]]); tg.eN = K(p, [[0, G0.eN], [.45, .15], [.65, .12], [.8, .1], [1, G0.eN]]);
        tg.aF = K(p, [[0, G0.aF], [.45, 2.75], [.65, 2.85], [.8, 1.5], [1, G0.aF]]); tg.eF = K(p, [[0, G0.eF], [.45, .2], [.65, .15], [.8, .1], [1, G0.eF]]);
        tg.lean = K(p, [[0, G0.lean], [.45, -.25], [.65, -.3], [.8, .15], [1, G0.lean]]); tg.head = -tg.lean * .4;
        tg.tN = .3; tg.kN = .4; tg.tF = -.3; tg.kF = .35;
        return;
      }
      // SKILL II - SHATTERED GRAVITY: arms thrown out wide in front, palms open, a small crouch while she bends the space
      if(A.skill === 'shatteredgravity'){
        tg.aN = K(p, [[0, G0.aN], [.3, 1.55], [.8, 1.6], [1, G0.aN]]); tg.eN = K(p, [[0, G0.eN], [.3, .12], [.8, .15], [1, G0.eN]]);
        tg.aF = K(p, [[0, G0.aF], [.3, 1.3], [.8, 1.4], [1, G0.aF]]); tg.eF = K(p, [[0, G0.eF], [.3, .3], [.8, .25], [1, G0.eF]]);
        tg.lean = K(p, [[0, G0.lean], [.3, .3], [.8, .28], [1, G0.lean]]); tg.head = -tg.lean * .3;
        tg.tN = .4; tg.kN = .6; tg.tF = -.35; tg.kF = .5;
        return;
      }
      const isCharging = (A.chg > 0 && p <= R + 0.02);
      const isRelease = (A.cl > 0 && p >= R);

      // 1. GOKU SUPER SAIYAN FOCUS STANCE WHILE CHARGING!
      if(isCharging){
        const L = A.cl || 0;
        const t = typeof G !== 'undefined' && G ? G.t : 0;
        const jit = Math.sin(t * 60) * .025 * L;
        tg.lean = .24 + jit;
        tg.head = -.16;
        tg.aN = -.45; tg.eN = 1.45; // arms flared down and out, fists clenched!
        tg.aF = -.52; tg.eF = 1.55;
        tg.tN = .45;  tg.kN = .78;  // deep crouch power stance
        tg.tF = -.38; tg.kF = .78;
        return;
      }

      // 2. RELEASE AIMED-HAND DISCHARGE!
      if(isRelease){
        tg.aN = clamp(1.55 + (A.aimEl || 0), .4, 2.9); tg.eN = .14; // near arm points along the aim
        tg.aF = -.32; tg.eF = 1.35; // far arm pulls tight to chest
        tg.lean = .36;
        tg.head = -.08;
        tg.tN = .68; tg.kN = .35;
        tg.tF = -.48; tg.kF = .18;
        return;
      }

      // 3. NORMAL COMBO GESTURES
      const step = A.step || 0;
      const H = GESTURES[step] || GESTURES[0];
      const lead = H.lead, off = lead === 'N' ? 'F' : 'N';

      tg['a' + lead] = K(p, H.aLead); tg['e' + lead] = K(p, H.eLead);
      tg['a' + off]  = K(p, H.aOff);  tg['e' + off]  = K(p, H.eOff);
      tg.lean = K(p, H.lean);
      tg.tN = K(p, H.tN); tg.kN = K(p, H.kN);
      tg.tF = K(p, H.tF); tg.kF = K(p, H.kF);
      tg.head = -tg.lean * .35;
    },

    // Behind hook: Update shard simulation & draw shards orbiting behind her body (depth < 0)
    behind(cx, f, t, S, P){
      const dt = f._lastT != null ? clamp(t - f._lastT, 0, 0.05) : 0.016;
      f._lastT = t;
      // live hand positions (world space) so shards leave from the hand that is striking
      f._erHand = {N:{x: f.x + S.aN.hand.x * f.face, y: f.y + S.aN.hand.y}, F:{x: f.x + S.aF.hand.x * f.face, y: f.y + S.aF.hand.y}};
      updateShards(f, dt, t);

      // visual: robe back panels + long hair are drawn first (behind everything), then the shards that orbit behind her
      const v = visUpdate(f, t, dt, S); CUR = v;
      {
        const cl = Math.cos(S.lean), sl = Math.sin(S.lean);
        for(let i = 0; i < PANELS_BACK.length; i++) panel(cx, v, PANELS_BACK[i], S.pel.x, S.pel.y, cl, sl, v.white);
        frags(cx, v, S.pel.x, S.pel.y + 14, v.white);
        hairBack(cx, v, S, v.white);
      }

      const shards = getShards(f);
      const charging = f.charging && f.chg > 0;
      const chgLvl = clamp((f.chg || 0) / ((f.A && f.A.chargeMax) || 1), 0, 1);

      cx.save();

      shards.forEach(s => {
        if(s.state === 'flying' || s.depth < 0){
          const lx = (s.wx - f.x) * f.face;
          const ly = s.wy - f.y;
          const lrot = s.wrot * f.face;

          if(s.state === 'flying' && s.trail.length > 1){
            const lTrail = s.trail.map(p => ({x: (p.x - f.x) * f.face, y: p.y - f.y}));
            drawShardTrail(cx, lTrail, 0.85);
          }

          renderShard(cx, lx, ly, lrot, s.spec.scale, 0.85, charging ? chgLvl : (s.state === 'flying' ? 0.75 : 0), v.gi, s.idx, t);
        }
      });
      cx.restore();
    },

    // Front hook: Draw shards orbiting in front (depth >= 0), and focus charge gauge
    front(cx, f, t, S, P){
      // visual overlay: head (hair cap + visor), hair strand, one floating robe panel, then the arms with split sleeves + gloves (so they sit over the head)
      const vv = f.erVis;
      if(vv){
        const W = vv.white, rotH = S.lean + (f.rig && f.rig.j && f.rig.j.head ? f.rig.j.head.a : 0);
        headFront(cx, vv, S, rotH, W);
        hairStrand(cx, vv, S, W);
        panel(cx, vv, PANEL_FRONT, S.pel.x, S.pel.y, Math.cos(S.lean), Math.sin(S.lean), W);
        if(vv.ff) armGear(cx, vv, S.aF, true, W, true);
        armGear(cx, vv, S.aN, false, W, true);
      }
      const shards = getShards(f);
      const charging = f.charging && f.chg > 0;
      const chgLvl = clamp((f.chg || 0) / ((f.A && f.A.chargeMax) || 1), 0, 1);

      cx.save();

      shards.forEach(s => {
        if(s.state !== 'flying' && s.depth >= 0){
          const lx = (s.wx - f.x) * f.face;
          const ly = s.wy - f.y;
          const lrot = s.wrot * f.face;

          renderShard(cx, lx, ly, lrot, s.spec.scale, 0.95, charging ? chgLvl : 0, f.erVis ? f.erVis.gi : 0, s.idx, t);
        }
      });

      // Finisher windup: violet glow on the left (striking) hand where the shards gather
      if(f.atk > 0 && f.A && !f.A.skill && f.A.step === 3 && !(f.A.cl > 0)){
        const q = clamp(1 - f.atk / f.A.time, 0, 1);
        if(q < .66){
          const gr = 5 + 9 * clamp(q / .5, 0, 1);
          [S.aN.hand].forEach(h => {
            const g = cx.createRadialGradient(h.x, h.y, 0, h.x, h.y, gr);
            g.addColorStop(0, 'rgba(243,232,255,.95)'); g.addColorStop(.4, 'rgba(192,132,252,.6)'); g.addColorStop(1, 'rgba(168,85,247,0)');
            cx.fillStyle = g; cx.beginPath(); cx.arc(h.x, h.y, gr, 0, 7); cx.fill();
          });
        }
      }

      // REALITY COLLAPSE aim preview: the fan edges + range, only while gathering
      if(charging && f.erAim && f.A && f.A.fan && (f.A.cl || 0) > 0){   // aim cone only once the cast is complete
        const FN = Characters.skillsOf('errata').basic.fan, ar = f.erAim, base = Math.atan2(ar.y, ar.x * f.face), n = getShards(f).filter(s => s.gath).length;
        const half = FN.angle * Math.max(0, n - 1) / Math.max(1, FN.shards - 1) / 2, ox = 20, oy = -34;
        cx.save(); cx.strokeStyle = 'rgba(192,132,252,.55)'; cx.fillStyle = 'rgba(157,78,221,.10)'; cx.lineWidth = 1; cx.setLineDash([5, 4]);
        cx.beginPath(); cx.moveTo(ox, oy); cx.arc(ox, oy, FN.range, base - half, base + half); cx.closePath(); cx.fill(); cx.stroke(); cx.restore();
      }
      // CAST BAR above the head: the tick marks the end of the casting time. Before it = dim (letting go fires nothing), after it = bright (ready, shards gather, release fires)
      if(charging){
        const BS = Characters.skillsOf('errata').basic, cm = BS.chargeMax || 1, tk = clamp((BS.castTime || 0) / cm, 0, 1);
        const x = S.head.x - 14, y = S.head.y - 14, w = 28, ready = (f.chg || 0) >= (BS.castTime || 0), full = chgLvl >= 1;
        cx.fillStyle = 'rgba(0,0,0,.78)'; cx.fillRect(x - 1, y - 1, w + 2, 5);
        cx.fillStyle = !ready ? 'rgb(110, 84, 190)' : full ? (Math.sin(t * 50) > 0 ? '#ffffff' : '#c084fc') : `rgb(${Math.round(170 + 60 * chgLvl)}, 110, 255)`;
        cx.fillRect(x, y, w * chgLvl, 3);
        cx.fillStyle = ready ? '#ffffff' : '#f0abfc'; cx.fillRect(x + w * tk - .5, y - 2, 1.5, 7);   // cast-complete tick
      }

      cx.restore();
    }
  });
})();