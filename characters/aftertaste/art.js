// AFTERTASTE art - The Flavor of Violence. Pudge-like grotesque human butcher (bald, bulbous nose, sunken eyes, filthy patched apron). RAGDOLL + weapons.
// Design pass: face (front()), aged skin + belly folds (torso()), patched apron + waist rope under the belly (torso()), bare legs + leather boots (foot()).
// Massive, slow, hunched butcher: huge barrel belly, buried neck, small head, broad rounded shoulders, thick forearms, big butcher hands,
// short very thick legs, wide boots, dirty bloodstained apron with the belly hanging out under it.
// Hooks: body (sizes), colors, torso() (barrel belly + hump + apron), pose() (heavy idle / waddle / landing), attack() (placeholder chop),
//        spring() (slow, heavy joints), behind() (belly + apron secondary-motion simulation), front() (face details).
// Proportions vs the default ragdoll: torso 1.65x, belly depth 1.8x, shoulders 1.5x, arms 1.6x, legs 1.7x, head .85x, a bit shorter.
(() => {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------- body sizes (default ragdoll is the reference) ----------
  const SZ = 1.22;      // overall size (1 = default ragdoll scale). Everything below scales together.
  const BODY0 = {
    head:  {r: 5.5},                    // 0.85x, small on that body
    torso: {len: 12, w: 16},            // w only sets the neck height: head sits low / "buried" in the shoulders
    uArm:  {len: 9.5, w: 7.4},          // 1.6x thick
    fArm:  {len: 9.5, w: 6.7},
    hand:  {r: 4.3},                    // normal-sized hands: short thick fingers, rough skin
    thigh: {len: 8.5, w: 9},         // shorter, 1.7x thick
    shin:  {len: 8.5, w: 7.4},
    foot:  {len: 10, w: 5.6},           // wide heavy boots
    headSink: 4,                        // head sunk into the shoulders
    shN: 1, shF: -5,                    // wide body: far shoulder sits well behind the near one (default gap is only 2px)
    belt: 5.5
  };
  const BODY = {};
  for(const k in BODY0) BODY[k] = typeof BODY0[k] === 'object' ? Object.fromEntries(Object.entries(BODY0[k]).map(([j, v]) => [j, +(v * SZ).toFixed(2)])) : +(BODY0[k] * SZ).toFixed(2);

  // ---------- poses ----------
  // legs: both feet reach the same ground height (thigh/shin 8.5 each)
  const STAND = {tN: .26, kN: .2, tF: -.22, kF: .04};

  // ---------- secondary motion: belly + apron flap are little springs that lag behind the body ----------
  // ox = belly forward/back offset (px), oy = belly up/down offset (px). Positive oy = sags down.
  const stOf = f => f.atS || (f.atS = {ox: 0, oy: 0, vx: 0, vy: 0, fo: 0, fv: 0, t: null, pvx: 0, pvy: 0, plean: 0, gr: true, airVy: 0, step: 0,
                                       landT: -9, dip: 0, patk: 0, pflash: 0, pt: null, sm: null, dtw: 0, wc: null, cal: null, cside: 1, cwrap: 0, ha: null});

  function simBelly(f, t, S){
    const s = stOf(f);
    if(s.t == null){ s.t = t; s.pvx = f.vx; s.pvy = f.vy; s.plean = S.lean; s.gr = f.gr; return s; }
    const dt = clamp(t - s.t, 0, .05);
    s.t = t;  s.dtw = dt;                                       // dt is also used by the weapon wrist easing
    if(dt <= 0) return s;                                      // hit-stop: freeze everything

    const ax = (f.vx - s.pvx) * f.face, ay = f.vy - s.pvy;     // body acceleration in her own forward axis
    s.pvx = f.vx; s.pvy = f.vy;
    s.vx -= ax * .045;  s.vy -= ay * .03;                       // belly lags behind: speed up -> belly stays back, jump -> belly sinks
    s.fv -= ax * .05;                                           // apron flap swings the same way
    const lr = (S.lean - s.plean) / dt; s.plean = S.lean;      // torso rotating = belly trails the rotation
    s.vx -= lr * dt * 70;  s.vy += Math.abs(lr) * dt * 14;

    if(!f.gr) s.airVy = f.vy;
    if(f.gr && !s.gr){                                         // LANDING: belly slams down, long wobble
      s.vy += clamp(s.airVy * .07, 10, 80);  s.landT = t;  s.dip = clamp(s.airVy / 650, .3, .8);
    }
    s.gr = f.gr;

    if(f.rig){                                                 // FOOTSTEPS: every step thumps the belly
      const k = Math.floor((f.rig.phase || 0) / Math.PI);
      if(k !== s.step){ if(f.gr && Math.abs(f.vx) > 30){ s.vy += 26; s.vx -= 7; s.fv += 5; } s.step = k; }
    }
    if(f.atk > s.patk + 1e-4){ s.vx -= 26; s.vy -= 10; }       // swing starts: belly sucks back, then whips forward when the torso lunges
    s.patk = f.atk;
    if(f.flash > s.pflash + .04){ s.vy += 55; s.vx -= 70; }    // getting hit: whole belly shudders
    s.pflash = f.flash;

    s.vx += (-170 * s.ox - 7 * s.vx) * dt;  s.ox = clamp(s.ox + s.vx * dt, -8, 8);
    s.vy += (-150 * s.oy - 6 * s.vy) * dt;  s.oy = clamp(s.oy + s.vy * dt, -6, 9);
    s.fv += (-90 * s.fo - 5 * s.fv) * dt;   s.fo = clamp(s.fo + s.fv * dt, -9, 9);
    return s;
  }

  let CUR = null;       // belly state of the fighter being drawn right now (behind() runs just before torso())

  // ---------- drawing helpers ----------
  const stains = [[.4, 12, 1.5, 1.0, .5], [.9, 9, 2.1, 1.3, -.3], [-.2, 5, 1.2, 1.6, .9], [-3.4, 9.6, 1.8, 1.1, .2], [-5.2, 7.6, 1.0, 1.0, 0], [-8.4, 11.4, 2.3, 1.4, -.5], [-10.6, 8, 1.4, 1.1, .6]];

    // ---------- APRON lower part (flap + waist rope). Drawn from front() so the legs can't hide it ----------
  function drawApronLower(cx, S, f, white){
    const s = CUR || {ox: 0, oy: 0, fo: 0};
    const l = S.lean, ux = Math.sin(l), uy = -Math.cos(l), fx = Math.cos(l), fy = Math.sin(l);
    const pt = (a, b, w) => ({x: S.pel.x + (ux * a + fx * b) * SZ + (w ? s.ox * w : 0), y: S.pel.y + (uy * a + fy * b) * SZ + (w ? s.oy * w : 0)});
   const cloth = white ? '#fff' : '#ece8d8', clothD = white ? '#fff' : '#b4ae98', blood = white ? '#fff' : 'rgba(120,10,16,.9)', rope = white ? '#fff' : '#9a8157';
    const sw = s.fo * .9;      // flap swing
    cx.lineJoin = 'round'; cx.lineCap = 'round';

    // flap: hangs from the rope, over the upper thighs, ragged hem
    const fl = [pt(-4.6, 1.2, .3), pt(-4.2, 15.6, 1), pt(-9.4, 15.2 + sw * .3, .2), pt(-11.4, 13 + sw * .7, 0), pt(-10.2, 10.6 + sw * .8, 0),
                pt(-12, 8.2 + sw * .8, 0), pt(-10.4, 5.6 + sw * .6, 0), pt(-11.4, 3.2 + sw * .4, 0), pt(-9.6, 1 + sw * .2, 0)];
    trace(cx, fl, true); cx.fillStyle = cloth; cx.fill(); cx.strokeStyle = OUTC; cx.lineWidth = 1.4; cx.stroke();
    if(!white){
      cx.save(); trace(cx, fl, true); cx.clip();
      cx.fillStyle = blood;
      [[-7, 12, 2.4, 1.5, .3], [-8.6, 6.4, 2.6, 1.5, -.4], [-6, 4, 1.4, 1.1, 0], [-9.8, 13.4, 1.2, 1, 0]].forEach(([a, b, rx, ry, rot]) => { const p = pt(a, b, 0); cx.beginPath(); cx.ellipse(p.x, p.y, rx, ry, rot, 0, 7); cx.fill(); });
      const patch = (a0, b0, a1, b1, col) => {          // stitched repair patch
        const Q = [pt(a0, b0, 0), pt(a0, b1, 0), pt(a1, b1, 0), pt(a1, b0, 0)];
        const c = {x: (Q[0].x + Q[2].x) / 2, y: (Q[0].y + Q[2].y) / 2};
        trace(cx, Q, true); cx.fillStyle = col; cx.fill(); cx.strokeStyle = 'rgba(40,28,18,.6)'; cx.lineWidth = .5; cx.stroke();
        trace(cx, Q.map(q => ({x: q.x + (c.x - q.x) * .2, y: q.y + (c.y - q.y) * .2})), true);
        cx.strokeStyle = '#3a2c1e'; cx.lineWidth = .55; cx.setLineDash([1.1, .9]); cx.stroke(); cx.setLineDash([]);
      };
      patch(-6.4, 9.2, -9.2, 12.6, '#8d7b5c');
      patch(-6.6, 2.6, -8.6, 5.2, '#b3a384');
      cx.restore();
      cx.strokeStyle = clothD; cx.lineWidth = .6;       // loose threads on the hem
      for(let i = 2; i < 8; i++){ const p = fl[i], q = fl[i + 1];
        for(let k = 0; k < 3; k++){ const u = k / 3, x = p.x + (q.x - p.x) * u, y = p.y + (q.y - p.y) * u, L = .9 + ((i * 7 + k * 5) % 5) * .35;
          cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x - ux * L + (k % 2 ? .5 : -.4), y - uy * L); cx.stroke(); } }
    }

    // waist rope + knot with two tails
    const rp = [pt(-3.6, -6, 0), pt(-5.6, 0, .1), pt(-6.2, 4, .3), pt(-6.1, 8.6, .7), pt(-4.8, 12.8, 1), pt(-3.8, 15.6, 1)];
    const ropeLine = (col, w, dash) => {
      cx.beginPath(); cx.moveTo(rp[0].x, rp[0].y);
      for(let i = 1; i < rp.length - 1; i++) cx.quadraticCurveTo(rp[i].x, rp[i].y, (rp[i].x + rp[i + 1].x) / 2, (rp[i].y + rp[i + 1].y) / 2);
      cx.lineTo(rp[rp.length - 1].x, rp[rp.length - 1].y);
      cx.strokeStyle = col; cx.lineWidth = w; cx.setLineDash(dash || []); cx.stroke(); cx.setLineDash([]);
    };
    ropeLine(OUTC, 2.4 * SZ + 2.4); ropeLine(rope, 2.4 * SZ);
    if(!white) ropeLine('#cdb680', 1.1, [1.2, 1.7]);
    const kn = rp[3], t1 = pt(-10.6, 8 + sw * .02, 0), t2 = pt(-9.8, 10.8, 0);
    [[OUTC, 4.4], [rope, 2.2]].forEach(([col, w]) => [t1, t2].forEach(t => {
      cx.beginPath(); cx.moveTo(kn.x, kn.y); cx.quadraticCurveTo((kn.x + t.x) / 2 + sw * .3, (kn.y + t.y) / 2, t.x, t.y);
      cx.strokeStyle = col; cx.lineWidth = w; cx.stroke();
    }));
    cx.beginPath(); cx.arc(kn.x, kn.y, 2.3, 0, 7); cx.fillStyle = white ? '#fff' : '#8a7048'; cx.fill(); cx.strokeStyle = OUTC; cx.lineWidth = 1.2; cx.stroke();
  }


  // ---------- WEAPONS (visual only; real attacks / hook skills come later) ----------
  // HOOK = FRONT (near) hand: he HOLDS the short handle in his fist. A chain strap runs from the end of the handle to a cuff on his wrist
  //        (so a hook skill can later fling it out on that chain). Shaft angle = half world-up, half forearm (HOOK_FOLLOW): the wrist absorbs part of every swing.
  // CLEAVER = BACK (far) hand: big square meat knife, rigid on the forearm except for the wrist (CLEAVER_WRIST). Edge leads the swing; blade never enters the floor.
  // Both follow the arm, so they follow every pose. Fists are redrawn on top so the hands really grip the handles.
  const OUTC = '#0b0f1c', OW = 1.7;
  const HOOK_FLIP = true;       // true = hook curls to the BACK side (upside down vs the reference); false = curls to the front side
  const STEEL = '#c9cdd3', STEEL_D = '#8f959e', STEEL_L = '#eef1f4', WOOD = '#6b4a32', BLOOD = 'rgba(128,18,26,.92)';
  const trace = (cx, pts, close) => { cx.beginPath(); pts.forEach((p, i) => i ? cx.lineTo(p.x, p.y) : cx.moveTo(p.x, p.y)); if(close) cx.closePath(); };
  const splat = (cx, p, rx, ry, rot) => { cx.beginPath(); cx.ellipse(p.x, p.y, rx, ry, rot, 0, 7); cx.fill(); };
  const armFrame = (arm, down) => {      // down (optional 0..1): pull the weapon toward straight DOWN so it never points up
         // frame along the forearm: P(a, b) = hand + a along (elbow -> hand) + b across (forward when the arm hangs)
    let ux = arm.hand.x - arm.el.x, uy = arm.hand.y - arm.el.y; let l = Math.hypot(ux, uy) || 1; ux /= l; uy /= l;
    if(down){ ux *= (1 - down); uy = uy * (1 - down) + down; l = Math.hypot(ux, uy) || 1; ux /= l; uy /= l; }
    const nx = uy, ny = -ux, h = arm.hand;
    return {ux, uy, nx, ny, P: (a, b) => ({x: h.x + ux * a + nx * b, y: h.y + uy * a + ny * b})};
  };
  const fist = (cx, p, P, white) => {     // redraw the hand on top of the handle = he is gripping it
    const r = BODY.hand.r;
    cx.fillStyle = OUTC; cx.beginPath(); cx.arc(p.x, p.y, r + 1.6, 0, 7); cx.fill();
    cx.fillStyle = white ? '#fff' : P.hand; cx.beginPath(); cx.arc(p.x, p.y, r, 0, 7); cx.fill();
    if(white) return;
    cx.strokeStyle = 'rgba(70,38,28,.6)'; cx.lineWidth = .6; cx.lineCap = 'round';          // finger creases across the fist
    [-.38, 0, .38].forEach(k => { cx.beginPath(); cx.moveTo(p.x - r * .1, p.y + r * k); cx.lineTo(p.x + r * .62, p.y + r * k); cx.stroke(); });
    cx.fillStyle = '#2d2016'; [-.38, 0, .38].forEach(k => { cx.beginPath(); cx.ellipse(p.x + r * .78, p.y + r * k, .75, .5, 0, 0, 7); cx.fill(); });   // dirty fingernails
  };

  // ---- cleaver (far hand) ----
  // The knife is rigid on the forearm. Only the WRIST (angle between forearm and blade) moves: it cocks back over the shoulder, then snaps through the chop.
  // The edge is on the side that LEADS the swing, and the blade can never go through the floor.
  const atkP = f => f.atk > 0 ? clamp(1 - f.atk / ((f.A && f.A.time) || .75), 0, 1) : 0;
  const CLEAVER_REST = .25;       // wrist at rest: blade points forward-down and its tip rests on the floor = the last frame of the smash
  const CLEAVER_WRIST = [[0, CLEAVER_REST], [.3, .1], [.45, .7], [.55, .75], [.64, .1], [.7, -.45], [.86, -.3], [1, CLEAVER_REST]];
  function drawCleaver(cx, S, f, s, white){
    const hh = S.aF.hand;
    const slaughterWr = [[0, CLEAVER_REST], [.075, -.25], [.13, .9], [.23, .15], [.29, -.55], [.35, .85], [.41, -.45], [.475, .65], [.54, .2], [.62, -.35], [.72, .25], [.82, .1], [.91, -.2], [1, CLEAVER_REST]];
    const wTarget = Body.keys(atkP(f), f.A && f.A.skill === 'slaughterhouse' ? slaughterWr : stepOf(f).wr);
    s.wc = s.wc == null ? wTarget : s.wc + (wTarget - s.wc) * (1 - Math.exp(-s.dtw * 16));      // eased, so the snap is quick but never teleports
    const frame = al => { const ux = Math.sin(al), uy = Math.cos(al); return (a, b) => ({x: hh.x + ux * a - uy * b, y: hh.y + uy * a + ux * b}); };   // b > 0 = the EDGE side, which leads the swing
    let al = f.rig.j.aF.a + f.rig.j.eF.a + s.wc;
    let clamped = false;
    if(f.gr){                                                                                  // standing: if the blade would dip into the floor, tip it toward horizontal
      const sn = Math.sin(al), was = s.cside;
      if(sn > .5) s.cside = 1; else if(sn < -.5) s.cside = -1;                                 // tip direction has hysteresis: it only flips when the blade is clearly on the other side
      for(let i = 0; i < 40; i++){
        const Q = frame(al);
        if(Math.max(...[[34, -5], [34, 14], [12.5, 14], [12.5, -5], [13, 0]].map(([a, b]) => Q(a, b).y)) <= -1) break;
        al += s.cside * .05; clamped = true;
      }
      if(clamped && was !== s.cside) s.cwrap += was;            // side change while touching the floor: the blade goes up and OVER (windup: up behind him, recovery: up and back to the rear), never through the floor
    }
    const tgt = al + Math.PI * 2 * s.cwrap;
    s.cal = s.cal == null ? tgt : s.cal + (tgt - s.cal) * (1 - Math.exp(-s.dtw * (Math.abs(tgt - s.cal) > 1.2 ? 9 : 22)));   // slow-ish ease for the big lift-over, quick ease otherwise
    const P = frame(s.cal);
    Body.capsule(cx, P(-1, 0), P(13, 0), 5.2 + OW * 2, OUTC); Body.capsule(cx, P(-1, 0), P(13, 0), 5.2, white ? '#fff' : WOOD);
    if(!white){ cx.strokeStyle = 'rgba(0,0,0,.35)'; cx.lineWidth = 1; [9.5, 12].forEach(a => { const p = P(a, -2.2), q = P(a, 2.2); cx.beginPath(); cx.moveTo(p.x, p.y); cx.lineTo(q.x, q.y); cx.stroke(); }); }
    const blade = [P(12.5, -5), P(34, -5), P(34, 14), P(12.5, 14)];
    trace(cx, blade, true); cx.fillStyle = white ? '#fff' : STEEL; cx.fill(); cx.strokeStyle = OUTC; cx.lineWidth = OW; cx.lineJoin = 'round'; cx.stroke();
    if(!white){
      cx.save(); trace(cx, blade, true); cx.clip();
      cx.fillStyle = STEEL_D; trace(cx, [P(12.5, -5), P(34, -5), P(34, -1.5), P(12.5, -1.5)], true); cx.fill();            // spine
      cx.fillStyle = STEEL_L; trace(cx, [P(12.5, 11.6), P(34, 11.6), P(34, 14), P(12.5, 14)], true); cx.fill();            // edge bevel
      cx.fillStyle = 'rgba(255,255,255,.28)'; trace(cx, [P(12.5, 1), P(34, 1), P(34, 3.2), P(12.5, 3.2)], true); cx.fill();
      const hole = P(17, 4); cx.fillStyle = '#2a2f3a'; cx.beginPath(); cx.arc(hole.x, hole.y, 1.7, 0, 7); cx.fill();       // hanging hole
      cx.fillStyle = BLOOD;
      [[20.5, 7.5, 3.2, 2.2, .4], [28, 3, 2.6, 1.8, -.3], [30, 10, 2.4, 1.6, .8], [23, 0, 1.6, 1.2, 0], [15.5, 11, 1.4, 1.1, .2]].forEach(([a, b, rx, ry, r]) => splat(cx, P(a, b), rx, ry, r));
      cx.restore();
      cx.fillStyle = BLOOD; const d = P(26, 14); cx.fillRect(d.x - .7, d.y, 1.5, 3.5);
    }
  }

  // ---- hook (near hand): held handle + chain strap to the wrist ----
  // He holds it like a cane: the shaft points UP and tilted forward out of his fist, the bend curls over the top and the tip points down.
  const HOOK_REST = 2.34;       // shaft direction at rest, from straight down, + = forward (2.34 = up and forward at 45 deg)
  const HOOK_GRIP = 1.8;        // how the fist is turned on the handle (angle between forearm and shaft)
  const HOOK_FOLLOW = .5;       // 0 = shaft ignores the arm (floats), 1 = welded to the forearm. In between = the wrist absorbs part of every arm swing.
  function drawHook(cx, S, f, P_, white){
    const arm = S.aN, Fa = armFrame(arm), Pf = Fa.P, j = f.rig.j;
    let al = HOOK_REST + (j.aN.a + j.eN.a + HOOK_GRIP - HOOK_REST) * HOOK_FOLLOW;
    const st = stepOf(f), hs = CUR || stOf(f);
    if(f.atk > 0 && !(f.A && f.A.skill) && st.hook) al = Body.keys(atkP(f), st.hook);                                 // bash steps: the shaft angle follows the step's own keys (hook head leads the swing)
    hs.ha = hs.ha == null ? al : hs.ha + (al - hs.ha) * (1 - Math.exp(-hs.dtw * 24)); al = hs.ha;   // eased, so entering / leaving a swing never pops
    const h = arm.hand;
    const hookFrame = al => { const ax = Math.sin(al), ay = Math.cos(al), nx = -ay, ny = ax; return (a, b) => ({x: h.x + ax * a + nx * b, y: h.y + ay * a + ny * b}); };   // n = the side the hook curls to: always the same side of the shaft, so it never flips
    if(f.gr) for(let i = 0; i < 40; i++){                                                       // slams stop AT the floor: if the hook would go into the ground, lift it (the head ends up planted on the floor)
      const Q = hookFrame(al); let low = -99;
      for(let k = 0; k <= 8; k++){ const th = Math.PI * 1.12 * k / 8; low = Math.max(low, Q(25 + 9.5 * Math.sin(th), 9.5 * (1 - Math.cos(th))).y + 3.5); }
      if(low <= 0) break;
      al += Math.sign(Math.sin(al) || 1) * .05;
    }
    const P = hookFrame(al);
    // wrist cuff on the forearm
    const cA = Pf(-8, -3.6), cB = Pf(-8, 3.6);
    Body.capsule(cx, cA, cB, 3.6 + OW * 2, OUTC); Body.capsule(cx, cA, cB, 3.6, white ? '#fff' : '#2b1f18');
    // chain strap: hangs in a loop from the end of the handle (pommel) down to the cuff
    const pom = P(-4.5, 0), cuff = Pf(-8, 0);
    const mid = {x: (pom.x + cuff.x) / 2 - 2, y: Math.max(pom.y, cuff.y) + 4};      // loop sags with gravity
    const links = 6;
    for(let i = 0; i < links; i++){
      const u = (i + .5) / links, q = 1 - u;
      const x = q * q * cuff.x + 2 * q * u * mid.x + u * u * pom.x, y = q * q * cuff.y + 2 * q * u * mid.y + u * u * pom.y;
      const tx = 2 * q * (mid.x - cuff.x) + 2 * u * (pom.x - mid.x), ty = 2 * q * (mid.y - cuff.y) + 2 * u * (pom.y - mid.y);
      cx.beginPath(); cx.ellipse(x, y, 3, 1.9, Math.atan2(ty, tx) + (i % 2 ? Math.PI / 2 : 0), 0, 7);
      cx.strokeStyle = OUTC; cx.lineWidth = 3.2; cx.stroke(); cx.strokeStyle = white ? '#fff' : '#aab0b7'; cx.lineWidth = 1.5; cx.stroke();
    }
    // short wooden handle in the fist
    Body.capsule(cx, P(-4.5, 0), P(10, 0), 5.4 + OW * 2, OUTC); Body.capsule(cx, P(-4.5, 0), P(10, 0), 5.4, white ? '#fff' : WOOD);
    // hook: shank up, then a big bend over the top, ending in a sharp point that aims back down
    const top = 25, r = 9.5, pts = [[10, 0], [top, 0]];
    for(let i = 1; i <= 16; i++){ const th = Math.PI * 1.12 * i / 16; pts.push([top + r * Math.sin(th), r * (1 - Math.cos(th))]); }
    const wd = i => { const q = i / (pts.length - 1); return q < .72 ? 6 : 6 * (1 - (q - .72) / .28) + .8; };   // thick wire, tapering to a point
    const draw = (extra, col) => { for(let i = 0; i < pts.length - 1; i++){ Body.capsule(cx, P(...pts[i]), P(...pts[i + 1]), wd(i) + extra, col); } };
    draw(OW * 2, OUTC); draw(0, white ? '#fff' : STEEL);
    if(!white){
      for(let i = 0; i < pts.length - 1; i++) Body.capsule(cx, P(pts[i][0], pts[i][1] - 1.2), P(pts[i + 1][0], pts[i + 1][1] - 1.2), Math.max(.6, wd(i) * .28), STEEL_L);   // highlight
      cx.strokeStyle = 'rgba(0,0,0,.4)'; cx.lineWidth = 1;                                                // grooves across the shank
      [13, 16, 19, 22].forEach(a => { const p = P(a, -2.6), q = P(a, 2.6); cx.beginPath(); cx.moveTo(p.x, p.y); cx.lineTo(q.x, q.y); cx.stroke(); });
      cx.fillStyle = BLOOD;
      [[15, 0, 2.2, 1.6], [21, 1, 1.8, 1.4]].forEach(([a, b, rx, ry]) => splat(cx, P(a, b), rx, ry, 0));
      const m = pts[8]; splat(cx, P(m[0], m[1]), 2.2, 1.7, 0); const t = pts[13]; splat(cx, P(t[0], t[1]), 1.6, 1.3, 0);
    }
    fist(cx, arm.hand, P_, white);
  }

  // ---------- 4-HIT COMBO: 1 HOOK bash (side swing)  2 CLEAVER chop (overhead)  3 CLEAVER scoop (rising cut out of the floor)  4 HOOK slam (overhead finisher) ----------
  // Timing / damage / reach per step live in skills.js (combo[]). Everything here is pose only. p = swing progress 0..1, keys are [p, value].
  //   aN/eN = near (hook) arm   aF/eF = far (cleaver) arm   lean = torso   kN/kF = knees (optional)   snap = [from, to] progress where the joints go stiff (the hit)
  //   wr = cleaver wrist angle keys   hook = hook shaft angle keys (world angle from straight down, + = forward; optional, otherwise it just follows the forearm)
  // Every key list starts and ends on the idle pose, so steps chain without a pop. The arm that is not swinging stays put (the cleaver stays planted during hook steps).
  const hold = v => [[0, v], [1, v]];
  const AN0 = -.3, EN0 = .8, AF0 = .3, EF0 = .35;          // idle arm angles (same numbers as IDLE in pose())
  const STEPS = [
    { // 1 HOOK BASH: arm cocked back, hook raised, then swung forward so the hook head leads
      snap: [.5, .8],
      aN: [[0, AN0], [.3, -.9], [.5, -1.2], [.62, 1.7], [.8, 1.9], [1, AN0]],   eN: [[0, EN0], [.4, .6], [.5, .5], [.62, .3], [.8, .35], [1, EN0]],
      aF: hold(AF0), eF: hold(EF0), wr: hold(CLEAVER_REST),
      lean: [[0, .2], [.4, -.12], [.5, -.2], [.62, .55], [.8, .45], [1, .2]],
      hook: [[0, HOOK_REST], [.3, 3.2], [.5, 3.4], [.62, 1.9], [.8, 1.5], [1, HOOK_REST]]
    },
    { // 2 CLEAVER CHOP: overhead, wrist cocks back then snaps, ends planted in the floor (hook arm guards, then pulls back as a counterweight)
      snap: [.5, .72],
      aN: [[0, AN0], [.45, 1.0], [.55, 1.1], [.68, -.2], [1, AN0]],             eN: [[0, EN0], [.5, 1.0], [.68, .7], [1, EN0]],
      aF: [[0, AF0], [.45, 2.6], [.55, 2.75], [.68, .8], [1, AF0]],              eF: [[0, EF0], [.45, .55], [.55, .4], [.68, .12], [1, EF0]],
      wr: CLEAVER_WRIST,
      lean: [[0, .2], [.45, -.1], [.55, -.14], [.68, .6], [.82, .45], [1, .2]]
    },
    { // 3 CLEAVER SCOOP: the planted blade is dragged back, then ripped up out of the floor in front of him (rising cut). The blade never has to pass through the floor.
      snap: [.42, .72],
      aN: [[0, AN0], [.42, -.8], [.54, .1], [1, AN0]],                           eN: hold(EN0),
      aF: [[0, AF0], [.3, -.35], [.42, -.5], [.52, 1.2], [.7, 1.6], [1, AF0]],   eF: [[0, EF0], [.35, .5], [.52, .5], [.7, .4], [1, EF0]],
      wr: [[0, CLEAVER_REST], [.3, 0], [.42, -.2], [.52, .6], [.62, 1.1], [.8, .7], [1, CLEAVER_REST]],
      lean: [[0, .2], [.3, .3], [.42, .35], [.52, 0], [.7, .05], [1, .2]]
    },
    { // 4 HOOK SLAM (finisher): both knees bend, hook goes high over the head, then comes down hard
      snap: [.55, .82],
      aN: [[0, AN0], [.4, 2.3], [.55, 2.8], [.68, .7], [.85, .5], [1, AN0]],     eN: [[0, EN0], [.5, .5], [.68, .2], [.85, .3], [1, EN0]],
      aF: hold(AF0), eF: hold(EF0), wr: hold(CLEAVER_REST),
      lean: [[0, .2], [.45, -.15], [.55, -.2], [.68, .7], [.85, .55], [1, .2]],
      kN: [[0, STAND.kN], [.5, .2], [.68, .75], [.9, .5], [1, STAND.kN]],       kF: [[0, STAND.kF], [.68, .4], [1, STAND.kF]],
      hook: [[0, HOOK_REST], [.4, 3.0], [.55, 3.4], [.68, 1.1], [.85, .8], [1, HOOK_REST]]
    }
  ];
  const stepOf = f => (f.atk > 0 && f.A && STEPS[f.A.step || 0]) || STEPS[0];

  Characters.art('aftertaste', {
    body: BODY,
    colors: {
      shirt:   '#e6dcc0',   // glint of the little eye under the brow (visor) - the torso is drawn by torso() below
      limb:    '#d2ad8c',   // near arm skin: pale, yellowish, neglected
      far:     '#a47b61',   // far arm (shaded)
      head:    '#d9ba9a',
      dark:    '#3a2a20',   // pelvis band (boots are drawn by foot() below)
      hand:    '#c49a7b',   // rough, redder hands
      legs:    '#cba483',   // BARE legs under the apron (no trousers)
      legsFar: '#a07a60'
    },

    // ---------- THE BODY: hump back, buried neck, rounded shoulders, huge barrel belly, apron ----------
    // Torso space: a = up along the spine from the pelvis, b = forward. Offsets from the belly simulation are added to the belly points.
    torso(cx, S, B, P, white){
      const s = CUR || {ox: 0, oy: 0, fo: 0};
      const l = S.lean, ux = Math.sin(l), uy = -Math.cos(l), fx = Math.cos(l), fy = Math.sin(l);
      const pt = (a, b, w) => ({x: S.pel.x + (ux * a + fx * b) * SZ + (w ? s.ox * w : 0), y: S.pel.y + (uy * a + fy * b) * SZ + (w ? s.oy * w : 0)});
      const OUT = B.outline, skin = white ? '#fff' : '#d6b595', shade = white ? '#fff' : '#a87a62', hi = white ? '#fff' : '#e6c8a8';
      cx.lineJoin = 'round'; cx.lineCap = 'round';
      const blob = pts => {
        const mid = (p, q) => ({x: (p.x + q.x) / 2, y: (p.y + q.y) / 2}), n = pts.length, m0 = mid(pts[n - 1], pts[0]);
        cx.beginPath(); cx.moveTo(m0.x, m0.y);
        for(let i = 0; i < n; i++){ const m = mid(pts[i], pts[(i + 1) % n]); cx.quadraticCurveTo(pts[i].x, pts[i].y, m.x, m.y); }
        cx.closePath();
      };

      // thick neck / trapezius hump (head sits almost inside it)
      Body.capsule(cx, pt(13, -2), pt(17, 1), 12 * SZ + B.outlineW * 2, OUT); Body.capsule(cx, pt(13, -2), pt(17, 1), 12 * SZ, skin);

     const cloth = white ? '#fff' : '#ece8d8', clothD = white ? '#fff' : '#b4ae98', blood = white ? '#fff' : 'rgba(120,10,16,.9)';
      // stitched patch (torso space: a = up, b = forward) with dashed hand stitching a little inside the edge
      const patch = (a0, b0, a1, b1, col, tilt) => {
        const Q = [pt(a0, b0, 0), pt(a0 + tilt, b1, 0), pt(a1 + tilt, b1 + .3, 0), pt(a1, b0 - .2, 0)];
        const c = {x: (Q[0].x + Q[1].x + Q[2].x + Q[3].x) / 4, y: (Q[0].y + Q[1].y + Q[2].y + Q[3].y) / 4};
        trace(cx, Q, true); cx.fillStyle = col; cx.fill(); cx.strokeStyle = 'rgba(40,28,18,.6)'; cx.lineWidth = .5; cx.stroke();
        trace(cx, Q.map(q => ({x: q.x + (c.x - q.x) * .17, y: q.y + (c.y - q.y) * .17})), true);
        cx.strokeStyle = '#3a2c1e'; cx.lineWidth = .55; cx.setLineDash([1.1, .9]); cx.stroke(); cx.setLineDash([]);
      };

      // APRON FLAP + WAIST ROPE. Drawn BEHIND the belly, so the belly hangs freely over them. The rope runs under the belly and is tied in a knot
      // under its front; the flap hangs from it down over his upper thighs (frayed, uneven hem).
      const sw = s.fo * .9;     // flap swing
      const fl = [pt(-4.6, 7.8, .85), pt(-5.8, 12.6, .9), pt(-9.6, 14 + sw, 0), pt(-11, 11.6 + sw * .8, 0), pt(-9.8, 9.2 + sw * .7, 0), pt(-11.2, 6.8 + sw * .5, 0), pt(-10, 4.6 + sw * .3, 0), pt(-5.4, 3.4, .3)];
      const flapPath = () => { cx.beginPath(); cx.moveTo(fl[0].x, fl[0].y); for(let i = 1; i < fl.length; i++) cx.lineTo(fl[i].x, fl[i].y); cx.closePath(); };
      flapPath(); cx.fillStyle = cloth; cx.fill(); cx.strokeStyle = OUT; cx.lineWidth = B.outlineW * .8; cx.stroke();
      if(!white){
        cx.save(); flapPath(); cx.clip();
        cx.fillStyle = blood;
        [[-6.8, 6, 1.7, 1.1, .3], [-8.2, 10.8, 2.1, 1.2, -.4], [-7.4, 12.8, 1, .9, 0]].forEach(([a, b, rx, ry, rot]) => { const p = pt(a, b + sw * .02, 0); cx.beginPath(); cx.ellipse(p.x, p.y, rx * 1.3, ry * 1.3, rot, 0, 7); cx.fill(); });
        patch(-6.4, 4.6, -8.8, 7.6, '#8d7b5c', .3);           // mismatched repair patches
        patch(-7.2, 10.6, -9.4, 13.4, '#b3a384', -.25);
        cx.fillStyle = blood; const dh = fl[3]; cx.fillRect(dh.x - 3, dh.y - 3.5, 1.3, 3.5);   // drip running down from the hem
        cx.restore();
        // frayed, uneven hem: loose threads
        cx.strokeStyle = clothD; cx.lineWidth = .6; cx.lineCap = 'round';
        for(let i = 2; i < 6; i++){ const p = fl[i], q = fl[i + 1];
          for(let k = 0; k < 4; k++){ const u = k / 4, x = p.x + (q.x - p.x) * u, y = p.y + (q.y - p.y) * u, L = .8 + ((i * 7 + k * 5) % 5) * .35;
            cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x - ux * L + (k % 2 ? .5 : -.4), y - uy * L); cx.stroke(); } }
      }
      // waist rope (twisted) + knot with two loose tails, all under the belly
      const rp = [pt(-4.4, -6, 0), pt(-6.2, 0, .1), pt(-6.8, 4, .3), pt(-6.7, 8.6, .7), pt(-5.2, 12.8, 1), pt(-3.8, 15.4, 1)];
      const ropeLine = (col, w, dash) => {
        cx.beginPath(); cx.moveTo(rp[0].x, rp[0].y);
        for(let i = 1; i < rp.length - 1; i++) cx.quadraticCurveTo(rp[i].x, rp[i].y, (rp[i].x + rp[i + 1].x) / 2, (rp[i].y + rp[i + 1].y) / 2);
        cx.lineTo(rp[rp.length - 1].x, rp[rp.length - 1].y);
        cx.strokeStyle = col; cx.lineWidth = w; cx.setLineDash(dash || []); cx.stroke(); cx.setLineDash([]);
      };
      cx.lineCap = 'round'; cx.lineJoin = 'round';
      ropeLine(OUT, 2.4 * SZ + B.outlineW * 1.6); ropeLine(white ? '#fff' : '#9a8157', 2.4 * SZ);
      if(!white) ropeLine('#cdb680', 1.1, [1.2, 1.7]);
      { const kn = rp[3], t1 = pt(-10.6, 8 + sw * .02, 0), t2 = pt(-9.8, 10.8, 0);
        [[t1, 2.2], [t2, 2.2]].forEach(([t, w]) => { cx.beginPath(); cx.moveTo(kn.x, kn.y); cx.quadraticCurveTo((kn.x + t.x) / 2 + sw * .3, (kn.y + t.y) / 2, t.x, t.y); cx.strokeStyle = OUT; cx.lineWidth = w + B.outlineW * 1.4; cx.stroke(); });
        [[t1, 2.2], [t2, 2.2]].forEach(([t, w]) => { cx.beginPath(); cx.moveTo(kn.x, kn.y); cx.quadraticCurveTo((kn.x + t.x) / 2 + sw * .3, (kn.y + t.y) / 2, t.x, t.y); cx.strokeStyle = white ? '#fff' : '#9a8157'; cx.lineWidth = w; cx.stroke(); });
        cx.beginPath(); cx.arc(kn.x, kn.y, 2.3, 0, 7); cx.fillStyle = white ? '#fff' : '#8a7048'; cx.fill(); cx.strokeStyle = OUT; cx.lineWidth = B.outlineW * .8; cx.stroke(); }

      // main body: hunched back, round chest, enormous belly that sags below the belt
      const BODY_PTS = [pt(-3.5, -7.5), pt(1, -9.8), pt(6, -10.8), pt(11, -11.2), pt(15.5, -9), pt(17.4, -3), pt(17, 3.5),
            pt(15, 7.5, .05), pt(11.5, 11.3, .2), pt(7.5, 14.8, .55), pt(2.5, 17.3, 1), pt(-2.5, 16, 1), pt(-5.8, 10.5, .75), pt(-5.8, 2, .2)];
      blob(BODY_PTS);
      cx.fillStyle = skin; cx.fill(); cx.strokeStyle = OUT; cx.lineWidth = B.outlineW; cx.stroke();

      if(!white){
        // belly: soft highlight, fold under the chest, sag fold, belly button crease, old blood splatter
        const g = cx.createRadialGradient(pt(5, 11.5).x, pt(5, 11.5).y, 1, pt(5, 11.5).x, pt(5, 11.5).y, 11);
        g.addColorStop(0, 'rgba(244,222,190,.5)'); g.addColorStop(1, 'rgba(244,222,190,0)');
        cx.fillStyle = g; cx.fill();
        cx.strokeStyle = shade; cx.lineWidth = 1.2;
        const q = (a1, b1, w1, a2, b2, w2, a3, b3, w3) => { const p1 = pt(a1, b1, w1), p2 = pt(a2, b2, w2), p3 = pt(a3, b3, w3); cx.beginPath(); cx.moveTo(p1.x, p1.y); cx.quadraticCurveTo(p2.x, p2.y, p3.x, p3.y); cx.stroke(); };
        q(10.2, 9.2, .15, 8.2, 13.2, .45, 8.4, 15.4, .6);          // fold under the chest
        q(-.2, 12.5, .9, -2.4, 16.4, 1, -2.6, 14.6, 1);              // sag fold of the lower belly
        q(2.8, 15.2, 1, 2.4, 16.6, 1, 2, 15.3, 1);                    // belly button
        cx.strokeStyle = shade; cx.lineWidth = .9;
        q(-4, -6.5, 0, 0, -9.2, 0, 4, -9.4, 0);                       // spine / back roll
        // heavy horizontal belly folds (clipped to the body), a shadow under every crease, reddish blotches, age spots, old healed scars
        cx.save(); blob(BODY_PTS); cx.clip(); cx.lineCap = 'round';
        const crease = (a, b0, b1, sag, w1) => {
          const p1 = pt(a, b0, .1), p2 = pt(a - sag, (b0 + b1) / 2, w1), p3 = pt(a + .4, b1, 1);
          const line = (dy, col, w) => { cx.strokeStyle = col; cx.lineWidth = w; cx.beginPath(); cx.moveTo(p1.x, p1.y + dy); cx.quadraticCurveTo(p2.x, p2.y + dy, p3.x, p3.y + dy); cx.stroke(); };
          line(1.1, 'rgba(78,32,24,.30)', 2.4); line(0, 'rgba(128,76,60,.75)', .9); line(-1.2, 'rgba(246,226,198,.2)', .6);
        };
        crease(6.6, 8, 16.4, 1.1, .5); crease(3.6, 7.2, 17, 1.5, .8); crease(.6, 6.6, 16.4, 1.7, .9); crease(-2.4, 6, 14.6, 1.3, .9);
        cx.fillStyle = 'rgba(196,76,60,.20)';
        [[7.5, 12, 2.6, 1.8, .2], [12.8, 3.4, 2.6, 1.6, .3], [2.5, 9.5, 2.2, 1.6, 0], [15, -6, 2, 1.4, .4]].forEach(([a, b, rx, ry, rot]) => { const p = pt(a, b, .3); cx.beginPath(); cx.ellipse(p.x, p.y, rx, ry, rot, 0, 7); cx.fill(); });
        cx.fillStyle = 'rgba(122,78,46,.6)';
        [[13.4, .2, .45], [11.2, 6, .35], [9.4, -2.5, .4], [6.2, 12.6, .45], [1.6, 13.4, .4], [-1.2, 10, .35], [14.6, -5.4, .4], [9, -8, .4], [4.4, 5, .3], [10.6, 11, .35]].forEach(([a, b, r]) => { const p = pt(a, b, .3); cx.beginPath(); cx.arc(p.x, p.y, r, 0, 7); cx.fill(); });
        [[[14.4, -1.2], [11.6, 4.6]], [[10.2, -3.4], [8.8, 2.4]]].forEach(([u, v]) => {          // old healed scars on the chest: pale ridge with a faint dark edge
          const p = pt(u[0], u[1]), q2 = pt(v[0], v[1]);
          cx.strokeStyle = 'rgba(120,64,50,.45)'; cx.lineWidth = 1.3; cx.beginPath(); cx.moveTo(p.x, p.y); cx.lineTo(q2.x, q2.y); cx.stroke();
          cx.strokeStyle = 'rgba(248,232,214,.8)'; cx.lineWidth = .7; cx.beginPath(); cx.moveTo(p.x, p.y); cx.lineTo(q2.x, q2.y); cx.stroke();
          const mx = (p.x + q2.x) / 2, my = (p.y + q2.y) / 2; cx.lineWidth = .5; cx.beginPath(); cx.moveTo(mx - 1, my - .7); cx.lineTo(mx + 1, my + .7); cx.stroke();
        });
        cx.restore();
        cx.fillStyle = 'rgba(107,15,20,.75)';
        [[4.4, 15.6, 1.2], [.6, 16.3, .9], [6.2, 14, .8]].forEach(([a, b, r]) => { const p = pt(a, b, 1); cx.beginPath(); cx.arc(p.x, p.y, r, 0, 7); cx.fill(); });
      }

      // APRON: neck strap, bib over the chest, waist tie, lower flap hanging under the belly. The belly stays exposed between them.
      Body.capsule(cx, pt(17, -1.2), pt(14.8, 8.2, .1), 3.4 * SZ + B.outlineW * 2, OUT); Body.capsule(cx, pt(17, -1.2), pt(14.8, 8.2, .1), 3.4 * SZ, clothD);   // thick, worn shoulder strap
      if(!white){ const s0 = pt(16.9, -1.2), s1 = pt(14.9, 8.2, .1); cx.strokeStyle = '#3a2c1e'; cx.lineWidth = .55; cx.setLineDash([1.1, .9]); cx.beginPath(); cx.moveTo(s0.x, s0.y); cx.lineTo(s1.x, s1.y); cx.stroke(); cx.setLineDash([]); }   // strap stitching
      // APRON FRONT: one big panel from the chest down over the whole belly (so the belly is covered)
      const BIB = [pt(17, .5, .02), pt(16.4, 6, .05), pt(14.6, 9.6, .15), pt(11.6, 13.4, .3), pt(7.6, 17, .6), pt(2.6, 18.8, 1), pt(-3, 18, 1),
                   pt(-7.5, 15, .8), pt(-9, 9, .4), pt(-8, 3, .2), pt(0, 3.5, .2), pt(8, 2.5, .1), pt(13, .5, .05)];
      blob(BIB); cx.fillStyle = cloth; cx.fill(); cx.strokeStyle = OUT; cx.lineWidth = B.outlineW * .8; cx.stroke();
      if(!white){
        cx.save(); blob(BIB); cx.clip();
        const sh = cx.createRadialGradient(pt(4, 12).x, pt(4, 12).y, 1, pt(4, 12).x, pt(4, 12).y, 13);   // belly bulge under the cloth
        sh.addColorStop(0, 'rgba(255,250,235,.35)'); sh.addColorStop(1, 'rgba(120,100,70,.25)');
        cx.fillStyle = sh; cx.fill();
        cx.fillStyle = blood;
        [[11, 8, 2.8, 1.7, .3], [6, 12, 3.2, 2, -.3], [1, 14, 2.4, 1.5, .2], [-3, 10, 2, 1.3, 0], [14, 3, 1.4, 1.1, 0]].forEach(([a, b, rx, ry, rot]) => { const p = pt(a, b, .4); cx.beginPath(); cx.ellipse(p.x, p.y, rx, ry, rot, 0, 7); cx.fill(); });
        patch(10, 5, 12.8, 8.6, '#9c8b6a', .2);
        patch(-1, 9, -3.8, 12.6, '#b3a384', -.2);
        cx.strokeStyle = 'rgba(90,76,52,.45)'; cx.lineWidth = .7;     // cloth folds over the belly
        [[8.5, 6, 6.5, 14], [3.5, 6.5, 1.5, 15]].forEach(([a0, b0, a1, b1]) => { const p = pt(a0, b0, .3), q = pt(a1, b1, .8); cx.beginPath(); cx.moveTo(p.x, p.y); cx.lineTo(q.x, q.y); cx.stroke(); });
        cx.restore();
        const e = [pt(15.6, 6.6, .05), pt(13, 10.2, .2), pt(9.4, 14.2, .5), pt(4.6, 16.8, .9), pt(-1.4, 16.4, 1), pt(-6, 13.4, .8)];   // stitching along the edge
        trace(cx, e, false); cx.strokeStyle = '#3a2c1e'; cx.lineWidth = .55; cx.setLineDash([1.1, .9]); cx.stroke(); cx.setLineDash([]);
      }
      // rounded, extremely broad shoulders (deltoid caps, 1.5x): far one first, near one on top
      const delt = (A, r, c) => { cx.beginPath(); cx.arc(A.s.x, A.s.y, r, 0, 7); cx.fillStyle = c; cx.fill(); cx.strokeStyle = OUT; cx.lineWidth = B.outlineW; cx.stroke(); };
      delt(S.aF, 6.6 * SZ, white ? '#fff' : P.far); delt(S.aN, 8 * SZ, white ? '#fff' : '#dbb797');
    },

   // ---------- face details (little scowl) drawn on the head ----------
    front(cx, f, t, S, P){
      const wh = f.flash > 0;
            cx.save(); drawApronLower(cx, S, f, wh); cx.restore();
      cx.save(); drawHook(cx, S, f, P, wh); cx.restore();      // hook in the FRONT hand (fist redrawn over the handle). The back-hand cleaver is drawn in behind()
      if(!wh){        // near forearm: faint stubble, old healed scars; darkened elbow and knee (bare, aged skin)
        const A = S.aN, dx = A.hand.x - A.el.x, dy = A.hand.y - A.el.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
        cx.save(); cx.lineCap = 'round';
        cx.fillStyle = 'rgba(104,56,42,.45)'; cx.beginPath(); cx.arc(A.el.x, A.el.y, 3.3, 0, 7); cx.fill();                    // dark elbow
        cx.strokeStyle = 'rgba(66,42,30,.55)'; cx.lineWidth = .5;
        for(let k = 0; k < 8; k++){ const tt = .16 + k * .085, off = ((k * 37) % 5 - 2) * .95, x = A.el.x + dx * tt + nx * off, y = A.el.y + dy * tt + ny * off;
          cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x + ux * .9 + nx * .35, y + uy * .9 + ny * .35); cx.stroke(); }                 // arm stubble
        [[.42, 2.6, -2.8], [.68, 2, -2.2]].forEach(([tt, o1, o2]) => { const x = A.el.x + dx * tt, y = A.el.y + dy * tt;          // healed scars across the forearm
          cx.strokeStyle = 'rgba(248,232,214,.55)'; cx.lineWidth = .7; cx.beginPath(); cx.moveTo(x + nx * o1, y + ny * o1); cx.lineTo(x + nx * o2 + ux * 1.1, y + ny * o2 + uy * 1.1); cx.stroke(); });
        cx.restore();
      }
      const ha = S.lean + ((f.rig && f.rig.j && f.rig.j.head.a) || 0), r = BODY0.head.r;
      // where his MOUTH really is in the world (follows the bow / head tilt) - the vomit stream in arena.js spawns from here
      { const mx = 3.5 * SZ, my = 3.8 * SZ, wx = S.head.x + mx * Math.cos(ha) - my * Math.sin(ha), wy = S.head.y + mx * Math.sin(ha) + my * Math.cos(ha);
        f.mouth = {x: f.x + f.face * wx, y: f.y + wy}; }
      cx.save(); cx.translate(S.head.x, S.head.y); cx.rotate(ha); cx.scale(SZ, SZ);
      if(f.flash > 0){ cx.restore(); return; }

      // ---------- HEAD, JAW & CHIN: tighter, grounded jaw/chin integrated into the lower skull ----------
      const OUTL = '#0b0f1c', SK = '#d9bb9c', SKD = '#b0826a', SKJ = '#c49b7e', SH = 'rgba(95,52,42,.65)';
      cx.lineJoin = 'round'; cx.lineCap = 'round';

      // grounded jaw & subtle double-chin tuck right beneath the cranium (less puffy/protruding)
      cx.beginPath(); cx.ellipse(1.1, 3.6, 3.4, 2.0, .06, 0, Math.PI * 2);
      cx.fillStyle = SKJ; cx.fill();
      cx.strokeStyle = OUTL; cx.lineWidth = 1.45; cx.stroke();

      cx.save(); cx.beginPath(); cx.arc(0, 0, r, 0, Math.PI * 2); cx.clip();
      // bald skull (this repaint also hides the default ragdoll visor)
      const g = cx.createRadialGradient(-1.4, -2.8, .4, 0, 0, r + 1);
      g.addColorStop(0, '#e6cdb0'); g.addColorStop(.55, SK); g.addColorStop(1, SKD);
      cx.fillStyle = g; cx.fillRect(-r - 1, -r - 1, 2 * r + 2, 2 * r + 2);

      // reddish blotches, scalp sheen, age spots & forehead creases
      cx.fillStyle = 'rgba(190,80,62,.20)';
      [[3.0, 2.6, 2.4, 1.7], [2.4, -3.4, 2.4, 1.1], [-2.4, 2.2, 1.8, 1.4]].forEach(([x, y, rx, ry]) => {
        cx.beginPath(); cx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); cx.fill();
      });
      cx.fillStyle = 'rgba(255,244,222,.28)';
      cx.beginPath(); cx.ellipse(-1.2, -3.9, 2.5, .9, -.25, 0, Math.PI * 2); cx.fill();

      cx.fillStyle = 'rgba(118,74,42,.58)';
      [[-2.3, -3.2, .42], [.2, -4.3, .34], [-3.3, -.8, .4], [1.6, -2.9, .3], [-.6, 3.1, .28], [1.9, 4.1, .25]].forEach(([x, y, rr]) => {
        cx.beginPath(); cx.arc(x, y, rr, 0, Math.PI * 2); cx.fill();
      });

      cx.strokeStyle = 'rgba(112,70,54,.32)'; cx.lineWidth = .4;
      [[-1.2, -4.2, .6, -4.6, 2.2, -4.2], [-.6, -3.5, .8, -3.8, 2.6, -3.4]].forEach(([x1, y1, cx1, cy1, x2, y2]) => {
        cx.beginPath(); cx.moveTo(x1, y1); cx.quadraticCurveTo(cx1, cy1, x2, y2); cx.stroke();
      });

   
      // INSANE EYES: plain white circles, no pupils, ringed in black
      // ONE ANGRY EYE (side view): white, no pupil, black ring. The lid slants down toward the nose.
      // ONE ANGRY EYE (side view), small: white, no pupil, black ring. The lid slants down toward the nose.
      // ONE ROUND EYE (side view), small: white circle, no pupil, black ring, angry brow slanting down toward the nose
      cx.fillStyle = '#120a08';
      cx.beginPath(); cx.moveTo(1.9, -3.0); cx.lineTo(4.9, -1.9); cx.lineTo(4.9, -1.2); cx.lineTo(1.9, -2.3); cx.closePath(); cx.fill();
      const ex = 3.5, ey = -.6, er = .85;
      cx.fillStyle = 'rgba(0,0,0,.35)'; cx.beginPath(); cx.arc(ex, ey, er * 2.1, 0, Math.PI * 2); cx.fill();   // soft black bruise
      cx.fillStyle = '#000'; cx.beginPath(); cx.arc(ex, ey, er * 1.5, 0, Math.PI * 2); cx.fill();            // hard black ring
      cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(ex, ey, er, 0, Math.PI * 2); cx.fill();                   // white circle                                    // white eye                                    // white eye
      // small ear, half buried under the neck roll
      cx.fillStyle = '#c99a7e'; cx.beginPath(); cx.ellipse(-1.7, 1, 1.15, 1.7, .15, 0, Math.PI * 2); cx.fill();
      cx.strokeStyle = '#7a4a3a'; cx.lineWidth = .55; cx.stroke();
      cx.beginPath(); cx.arc(-1.6, .9, .55, -2.4, 1.2); cx.stroke();

      // subtle lower cheek & chin crease (clean contour without an oversized hanging pouch)
      cx.fillStyle = 'rgba(186,144,118,.78)';
      cx.beginPath(); cx.ellipse(-0.8, 2.5, 2.4, .95, .08, 0, Math.PI * 2); cx.fill();
      cx.strokeStyle = SH; cx.lineWidth = .5;
      cx.beginPath(); cx.moveTo(-2.8, 2.7); cx.quadraticCurveTo(-0.7, 3.6, 1.5, 2.8); cx.stroke();

      cx.fillStyle = 'rgba(238,208,180,.32)';
      cx.beginPath(); cx.ellipse(2.4, 2.5, 2.1, 1.4, 0, 0, Math.PI * 2); cx.fill();
      cx.restore();

      // mouth & jaw expression: opens wide on slaughterhouse/vomit, otherwise tight slack jaw with crooked teeth
      const bite = f.A && f.A.skill === 'vomit' && f.atk > 0
        ? Body.keys(atkP(f), [[0,0],[.15,.2],[.4,.4],[.5,1],[.92,1],[1,0]])
        : f.A && f.A.skill === 'slaughterhouse' && f.atk > 0
          ? Body.keys(atkP(f), [[0,0],[.30,0],[.32,.8],[.35,0],[.38,0],[.40,.8],[.43,0],[.46,0],[.475,.8],[.50,0],[.66,0],[.70,1],[.75,.1],[.80,1],[.86,1],[.90,0],[1,0]])
          : 0;

      if(bite > .08){
        const op = 1.0 + bite * 2.8;
        cx.fillStyle = '#3a0a0e'; cx.beginPath(); cx.ellipse(3.1, 3.1 + op * .28, 2.4, op, 0, 0, Math.PI * 2); cx.fill();
        cx.fillStyle = '#d6c58a';
        for(let i = 0; i < 3; i++){
          const tx = 1.5 + i * 1.25;
          cx.beginPath(); cx.moveTo(tx, 2.8); cx.lineTo(tx + .6, 2.8); cx.lineTo(tx + .3, 4.0); cx.closePath(); cx.fill();
        }
      } else {
        // flat, grim mouth: no smile, ends turn slightly down
        cx.strokeStyle = '#2a0a0a'; cx.lineWidth = .9; cx.lineCap = 'round';
        cx.beginPath(); cx.moveTo(1.5, 3.9); cx.quadraticCurveTo(3.1, 3.1, 4.6, 3.9); cx.stroke();
      }
      // nose: rounded tip + nostril wing + subtle highlight & nostril
      cx.strokeStyle = OUTL; cx.lineWidth = 1.1;
      cx.beginPath(); cx.arc(5.3, 1.1, .82, 0, Math.PI * 2); cx.stroke();
      cx.beginPath(); cx.arc(4.8, 1.72, .52, 0, Math.PI * 2); cx.stroke();
      cx.fillStyle = '#cf9580';
      cx.beginPath(); cx.arc(5.3, 1.1, .82, 0, Math.PI * 2); cx.fill();
      cx.beginPath(); cx.arc(4.8, 1.72, .52, 0, Math.PI * 2); cx.fill();
      cx.fillStyle = 'rgba(255,226,205,.4)';
      cx.beginPath(); cx.ellipse(5.1, .78, .3, .18, -.5, 0, Math.PI * 2); cx.fill();
      cx.fillStyle = '#2a0e0b';
      cx.beginPath(); cx.ellipse(5.55, 1.45, .24, .16, .3, 0, Math.PI * 2); cx.fill();
      cx.restore();
    },

    // ---------- heavy leather butcher boots (replaces the default foot): shaft up the shin, wide rounded toe, thick dark sole ----------
    foot(cx, leg, P, white, f, far){
      const F = BODY.foot, W = F.w * 1.05, OW_ = 1.6;
      const phi = leg.planted ? 0 : clamp(-leg.sa * .5, -.8, .8), lift = leg.planted ? clamp((leg.hip.x - leg.ankle.x - 2) * .12, 0, 3.5) : 0;
      const a = {x: leg.ankle.x - 1.5, y: leg.ankle.y - lift}, b = {x: leg.ankle.x + (F.len - 1.5) * Math.cos(phi), y: leg.ankle.y + (F.len - 1.5) * Math.sin(phi)};
      const dx = leg.knee.x - leg.ankle.x, dy = leg.knee.y - leg.ankle.y, L = Math.hypot(dx, dy) || 1, top = {x: a.x + dx / L * 3.4, y: a.y + dy / L * 3.4};
      const leather = white ? '#fff' : far ? '#2f1d11' : '#4a2e1b', sole = white ? '#fff' : '#140c07', band = white ? '#fff' : far ? '#22140b' : '#33200f';
      const WS = BODY.shin.w + 1.6;
      if(!white){ cx.fillStyle = far ? 'rgba(70,36,26,.45)' : 'rgba(104,56,42,.5)'; cx.beginPath(); cx.arc(leg.knee.x, leg.knee.y, 3.8, 0, Math.PI * 2); cx.fill(); }
      Body.capsule(cx, a, top, WS + OW_ * 2, OUTC); Body.capsule(cx, a, b, W + OW_ * 2, OUTC);
      Body.capsule(cx, a, top, WS, leather); Body.capsule(cx, a, b, W, leather);
      Body.capsule(cx, {x: a.x, y: a.y + W * .24}, {x: b.x, y: b.y + W * .24}, W * .34, sole);
      if(white) return;
      Body.capsule(cx, top, {x: top.x - dx / L * 1.4, y: top.y - dy / L * 1.4}, WS, band);
      cx.save(); cx.lineCap = 'round'; cx.strokeStyle = far ? '#5a4128' : '#7d5a39'; cx.lineWidth = .7;
      cx.beginPath(); cx.moveTo(a.x + 1.4, a.y - W * .18); cx.lineTo(b.x - 1.2, b.y - W * .22); cx.stroke();
      cx.strokeStyle = '#8a6a46'; cx.lineWidth = .5; cx.setLineDash([1, .9]);
      cx.beginPath(); cx.moveTo(a.x + dx / L * 2.2 + 1.2, a.y + dy / L * 2.2 - WS * .3); cx.lineTo(a.x + dx / L * 2.2 + 1.2, a.y + dy / L * 2.2 + WS * .3); cx.stroke();
      cx.restore();
    },

    // Meat Hook in flight: chain from his chest to the hook head (h = {ox, oy = chest, x, y = hook head})
    hook(cx, h, t){
      const dx = h.x - h.ox, dy = h.y - h.oy, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, ang = Math.atan2(dy, dx);
      for(let i = 0; i < L - 6; i += 7){
        cx.save(); cx.translate(h.ox + ux * (i + 4), h.oy + uy * (i + 4)); cx.rotate(ang + (i % 14 ? Math.PI / 2 : 0));
        cx.beginPath(); cx.ellipse(0, 0, 3.6, 2.2, 0, 0, Math.PI * 2); cx.strokeStyle = OUTC; cx.lineWidth = 3.2; cx.stroke(); cx.strokeStyle = '#aab0b7'; cx.lineWidth = 1.5; cx.stroke(); cx.restore();
      }
      cx.save(); cx.translate(h.x, h.y); cx.rotate(ang); cx.lineCap = 'round';
      [[OUTC, 7], [STEEL, 4.2]].forEach(([col, w]) => { cx.strokeStyle = col; cx.lineWidth = w; cx.beginPath(); cx.moveTo(-6, 0); cx.lineTo(8, 0); cx.arc(8, 7, 7, -Math.PI / 2, Math.PI * .75); cx.stroke(); });
      cx.restore();
    },

    // ---------- sprite layering order: back cleaver + belly spring first, then torso, front hook & head ----------
    behind(cx, f, t, S, P){ CUR = simBelly(f, t, S); drawCleaver(cx, S, f, CUR, f.flash > 0); },

    // ---------- HEAVY idle / waddle / landing ----------
    pose(tg, f, t, run, K){
      const s = stOf(f);
      const dt = s.pt == null ? 0 : clamp(t - s.pt, 0, .05); s.pt = t;
      const ph = (f.rig && f.rig.phase) || 0, sn = Math.sin(ph), cs = Math.cos(ph), b = Math.sin(t * 1.4);

      const IDLE = {
        lean: .2 + b * .012, head: -.1 + Math.sin(t * 1.4 + .6) * .02,       // constantly hunched forward under the weight
        aN: -.12 + b * .015, eN: .4,                                            // heavy forearms hang beside the body
        aF: .22 - b * .015, eF: .3,
        tN: STAND.tN, kN: STAND.kN, tF: STAND.tF, kF: STAND.kF
      };
      const RUN = {                                                             // waddle: short heavy steps, arms barely swing
        lean: .3 + .025 * Math.cos(2 * ph), head: -.14,
        aN: -sn * .32 - .05, eN: .85 + .1 * cs, aF: sn * .2 + .25, eF: .4 - .1 * cs,
        tN: sn * .8 + .1, kN: .3 + .85 * Math.max(0, cs),
        tF: -sn * .8 + .1, kF: .3 + .85 * Math.max(0, -cs)
      };
      for(const k in IDLE) tg[k] = IDLE[k] + (RUN[k] - IDLE[k]) * run;

      // arms, lean and head are low-passed: they LAG behind the target (heavy, no snappy swinging)
      if(!s.sm){ s.sm = {}; ['lean', 'head', 'aN', 'eN', 'aF', 'eF'].forEach(k => s.sm[k] = tg[k]); }
      const a = 1 - Math.exp(-dt * 5.5);
      ['lean', 'head', 'aN', 'eN', 'aF', 'eF'].forEach(k => { s.sm[k] += (tg[k] - s.sm[k]) * a; tg[k] = s.sm[k]; });

      // landing: knees buckle, hunch deepens, arms drop - slowly recovers
      const q = (t - s.landT) / .42;
      if(q < 1 && K){
        const d = K(q, [[0, 0], [.18, 1], [1, 0]]) * s.dip;
        tg.kN += .5 * d; tg.kF += .5 * d; tg.lean += .22 * d; tg.aN -= .25 * d; tg.aF -= .25 * d;
      }
    },

    // heavy joints: soft while winding up, stiff through the hit (per combo step: STEPS[n].snap), slow recovery
    spring(p, A){
      if(A.skill && A.skill !== 'melee') return {k: 900, d: 60};   // skills: quick snap (a melee skill uses its combo step's own timing below)
      const sn = (STEPS[A.step || 0] || STEPS[0]).snap;
      if(p < sn[0]) return {k: 230, d: 28};
      if(p < sn[1]) return {k: 800, d: 58};
      return {k: 170, d: 24};
    },

    // the 4 combo steps live in STEPS above (A.step = 0..3 comes from skills.js combo)
    attack(tg, p, A, K){
      if(A.skill === 'slaughterhouse'){
        // Five-beat execution: chain yank / slam, repeated cleaver chops, hook tear, bite, then wipe his mouth.
        // p spans the .24s deployment plus the 3s execution. The feet never leave their planted idle pose.
        tg.lean = K(p, [[0,.2],[.075,.25],[.11,.72],[.16,.98],[.23,.72],
                        [.28,.18],[.32,.52],[.36,.12],[.40,.58],[.44,.12],[.475,.48],
                        [.52,.32],[.58,.72],[.64,.92],[.72,.72],
                        [.77,.92],[.83,1.08],[.89,.94],[.94,.35],[1,.2]]);
        tg.head = K(p, [[0,-.1],[.075,-.12],[.16,-.38],[.23,-.2],[.28,-.1],[.32,.25],[.36,-.1],[.40,.25],[.44,-.1],[.475,.25],[.52,-.1],
                        [.64,.18],[.72,.35],[.83,.5],[.89,.22],[.94,-.35],[1,-.1]]);   // small chomps on every chop, then the big bites
        // Near arm controls the hook: yank down, hold, tear upward, then wipe his mouth.
        tg.aN = K(p, [[0,-.3],[.075,-.55],[.12,1.25],[.18,1.9],[.23,1.25],
                      [.28,-.3],[.475,-.3],[.52,.65],[.59,1.65],[.66,1.95],[.72,.95],
                      [.78,.25],[.84,-.1],[.89,-.8],[.94,-1.25],[1,-.3]]);
        tg.eN = K(p, [[0,.8],[.075,.45],[.16,.18],[.23,.55],[.475,.8],[.58,.25],[.66,.15],[.72,.35],[.84,.55],[.94,.2],[1,.8]]);
        // Far arm drives the cleaver through several heavy chops, then drops low for the feast.
        tg.aF = K(p, [[0,.3],[.075,.55],[.13,2.15],[.18,2.55],[.23,.72],
                      [.28,.45],[.32,2.35],[.36,.62],[.40,2.45],[.44,.58],[.475,1.85],
                      [.52,.35],[.64,.2],[.72,.45],[.78,.72],[.84,.95],[.89,.8],[.94,.3],[1,.3]]);
        tg.eF = K(p, [[0,.35],[.075,.45],[.18,.25],[.23,.6],[.28,.4],[.36,.2],[.44,.2],[.475,.55],[.64,.75],[.72,.7],[.84,.35],[.94,.45],[1,.35]]);
        tg.tN = STAND.tN; tg.tF = STAND.tF; tg.kN = STAND.kN; tg.kF = STAND.kF;
        return;
      }
      if(A.skill === 'vomit'){   // Vile Offering: he doubles over, heaves (gagging), then thrusts his head forward and spews
        tg.lean = K(p, [[0,.2],[.1,.55],[.18,.35],[.26,.7],[.34,.4],[.42,.75],[.5,.95],[.9,1.0],[1,.2]]);
        tg.head = K(p, [[0,-.1],[.18,.2],[.34,.1],[.42,.35],[.5,.55],[.9,.6],[1,-.1]]);
        tg.aN = K(p, [[0, AN0], [.3, .55], [.9, .55], [1, AN0]]); tg.eN = K(p, [[0, EN0], [.3, .35], [.9, .35], [1, EN0]]);
        tg.aF = K(p, [[0, AF0], [.3, .45], [.9, .45], [1, AF0]]); tg.eF = K(p, [[0, EF0], [.3, .35], [.9, .35], [1, EF0]]);
        tg.tN = STAND.tN; tg.tF = STAND.tF; tg.kN = STAND.kN; tg.kF = STAND.kF; return;
      }
      if(A.skill === 'stench'){   // Putrid Stench: he throws both arms open and tips his head back while the rot pours out
        tg.aN = K(p, [[0, AN0], [.35, 1.3], [.75, 1.1], [1, AN0]]); tg.eN = K(p, [[0, EN0], [.35, .25], [1, EN0]]);
        tg.aF = K(p, [[0, AF0], [.35, 1.3], [.75, 1.1], [1, AF0]]); tg.eF = K(p, [[0, EF0], [.35, .25], [1, EF0]]);
        tg.lean = K(p, [[0, .2], [.35, -.1], [1, .2]]); tg.head = K(p, [[0, -.1], [.35, -.45], [1, -.1]]);
        tg.tN = STAND.tN; tg.tF = STAND.tF; tg.kN = STAND.kN; tg.kF = STAND.kF; return;
      }
      if(A.skill === 'hook'){   // Meat Hook throw: near arm points along the aim (simple default pose), the other arm stays put
        const a = A.aimA == null ? 1.5 : A.aimA;
        tg.aN = K(p, [[0, AN0], [.25, a], [.7, a], [1, AN0]]); tg.eN = K(p, [[0, EN0], [.25, .15], [.7, .2], [1, EN0]]);
        tg.aF = AF0; tg.eF = EF0; tg.lean = K(p, [[0, .2], [.25, .4], [.7, .35], [1, .2]]); tg.head = -tg.lean * .45;
        tg.tN = STAND.tN; tg.tF = STAND.tF; tg.kN = STAND.kN; tg.kF = STAND.kF; return;
      }
      const st = STEPS[A.step || 0] || STEPS[0];
      ['aN', 'eN', 'aF', 'eF', 'lean'].forEach(k => tg[k] = K(p, st[k]));
      tg.head = -tg.lean * .45;
      tg.tN = STAND.tN; tg.tF = STAND.tF;
      tg.kN = st.kN ? K(p, st.kN) : STAND.kN;  tg.kF = st.kF ? K(p, st.kF) : STAND.kF;
    }
  });
})();i