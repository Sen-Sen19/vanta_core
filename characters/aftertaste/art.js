// AFTERTASTE art - The Flavor of Violence. RAGDOLL ONLY (weapons + real attacks come later).
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
    hand:  {r: 5.2},                    // big rough butcher hands
    thigh: {len: 8.5, w: 10.2},         // shorter, 1.7x thick
    shin:  {len: 8.5, w: 8.5},
    foot:  {len: 11, w: 6.2},           // wide heavy boots
    headSink: 4,                        // head sunk into the shoulders
    shN: 1, shF: -5,                    // wide body: far shoulder sits well behind the near one (default gap is only 2px)
    belt: 7
  };
  const BODY = {};
  for(const k in BODY0) BODY[k] = typeof BODY0[k] === 'object' ? Object.fromEntries(Object.entries(BODY0[k]).map(([j, v]) => [j, +(v * SZ).toFixed(2)])) : +(BODY0[k] * SZ).toFixed(2);

  // ---------- poses ----------
  // legs: both feet reach the same ground height (thigh/shin 8.5 each)
  const STAND = {tN: .40, kN: .34, tF: -.28, kF: .02};

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
      limb:    '#c79b86',   // near arm skin
      far:     '#9d6f5d',   // far arm (shaded)
      head:    '#d3a791',
      dark:    '#2b1f18',   // belt / boots
      hand:    '#a87763',   // rough, a little bloody butcher hands
      legs:    '#4a3a2f',   // dirty brown trousers
      legsFar: '#33271f'
    },

    // ---------- THE BODY: hump back, buried neck, rounded shoulders, huge barrel belly, apron ----------
    // Torso space: a = up along the spine from the pelvis, b = forward. Offsets from the belly simulation are added to the belly points.
    torso(cx, S, B, P, white){
      const s = CUR || {ox: 0, oy: 0, fo: 0};
      const l = S.lean, ux = Math.sin(l), uy = -Math.cos(l), fx = Math.cos(l), fy = Math.sin(l);
      const pt = (a, b, w) => ({x: S.pel.x + (ux * a + fx * b) * SZ + (w ? s.ox * w : 0), y: S.pel.y + (uy * a + fy * b) * SZ + (w ? s.oy * w : 0)});
      const OUT = B.outline, skin = white ? '#fff' : '#d1a58f', shade = white ? '#fff' : '#a8776a', hi = white ? '#fff' : '#e2bba5';
      cx.lineJoin = 'round'; cx.lineCap = 'round';
      const blob = pts => {
        const mid = (p, q) => ({x: (p.x + q.x) / 2, y: (p.y + q.y) / 2}), n = pts.length, m0 = mid(pts[n - 1], pts[0]);
        cx.beginPath(); cx.moveTo(m0.x, m0.y);
        for(let i = 0; i < n; i++){ const m = mid(pts[i], pts[(i + 1) % n]); cx.quadraticCurveTo(pts[i].x, pts[i].y, m.x, m.y); }
        cx.closePath();
      };

      // thick neck / trapezius hump (head sits almost inside it)
      Body.capsule(cx, pt(13, -2), pt(17, 1), 12 * SZ + B.outlineW * 2, OUT); Body.capsule(cx, pt(13, -2), pt(17, 1), 12 * SZ, skin);

      // main body: hunched back, round chest, enormous belly that sags below the belt
      blob([pt(-3.5, -7.5), pt(1, -9.8), pt(6, -10.8), pt(11, -11.2), pt(15.5, -9), pt(17.4, -3), pt(17, 3.5),
            pt(15, 7.5, .05), pt(11.5, 11.3, .2), pt(7.5, 14.8, .55), pt(2.5, 17.3, 1), pt(-2.5, 16, 1), pt(-5.8, 10.5, .75), pt(-5.8, 2, .2)]);
      cx.fillStyle = skin; cx.fill(); cx.strokeStyle = OUT; cx.lineWidth = B.outlineW; cx.stroke();

      if(!white){
        // belly: soft highlight, fold under the chest, sag fold, belly button crease, old blood splatter
        const g = cx.createRadialGradient(pt(5, 11.5).x, pt(5, 11.5).y, 1, pt(5, 11.5).x, pt(5, 11.5).y, 11);
        g.addColorStop(0, 'rgba(240,205,185,.55)'); g.addColorStop(1, 'rgba(240,205,185,0)');
        cx.fillStyle = g; cx.fill();
        cx.strokeStyle = shade; cx.lineWidth = 1.2;
        const q = (a1, b1, w1, a2, b2, w2, a3, b3, w3) => { const p1 = pt(a1, b1, w1), p2 = pt(a2, b2, w2), p3 = pt(a3, b3, w3); cx.beginPath(); cx.moveTo(p1.x, p1.y); cx.quadraticCurveTo(p2.x, p2.y, p3.x, p3.y); cx.stroke(); };
        q(10.2, 9.2, .15, 8.2, 13.2, .45, 8.4, 15.4, .6);          // fold under the chest
        q(-.2, 12.5, .9, -2.4, 16.4, 1, -2.6, 14.6, 1);              // sag fold of the lower belly
        q(2.8, 15.2, 1, 2.4, 16.6, 1, 2, 15.3, 1);                    // belly button
        cx.strokeStyle = shade; cx.lineWidth = .9;
        q(-4, -6.5, 0, 0, -9.2, 0, 4, -9.4, 0);                       // spine / back roll
        cx.fillStyle = 'rgba(107,15,20,.75)';
        [[4.4, 15.6, 1.2], [.6, 16.3, .9], [6.2, 14, .8]].forEach(([a, b, r]) => { const p = pt(a, b, 1); cx.beginPath(); cx.arc(p.x, p.y, r, 0, 7); cx.fill(); });
      }

      // APRON: neck strap, bib over the chest, waist tie, lower flap hanging under the belly. The belly stays exposed between them.
      const cloth = white ? '#fff' : '#cdbfa0', clothD = white ? '#fff' : '#a8997a', blood = white ? '#fff' : 'rgba(110,14,20,.85)';
      Body.capsule(cx, pt(17, -1.2), pt(14.8, 8.2, .1), 2.6 * SZ + B.outlineW * 2, OUT); Body.capsule(cx, pt(17, -1.2), pt(14.8, 8.2, .1), 2.6 * SZ, clothD);   // strap over the shoulders
      blob([pt(15, 7.4, .05), pt(14.6, 10.6, .1), pt(11.6, 12.2, .2), pt(8.4, 13.4, .4), pt(8.2, 9.4, .25), pt(10.4, 6.4, .1), pt(13.2, 6.4, .05)]);  // bib
      cx.fillStyle = cloth; cx.fill(); cx.strokeStyle = OUT; cx.lineWidth = B.outlineW * .8; cx.stroke();
      if(!white){
        cx.save(); blob([pt(15, 7.4, .05), pt(14.6, 10.6, .1), pt(11.6, 12.2, .2), pt(8.4, 13.4, .4), pt(8.2, 9.4, .25), pt(10.4, 6.4, .1), pt(13.2, 6.4, .05)]); cx.clip();
        cx.fillStyle = blood;
        stains.slice(0, 3).forEach(([a, b, rx, ry, rot]) => { const p = pt(a + 10.2, b - 2, .2); cx.beginPath(); cx.ellipse(p.x, p.y, rx * 1.3, ry * 1.3, rot, 0, 7); cx.fill(); });
        cx.restore();
      }
      // waist tie (rope) + lower flap
      Body.capsule(cx, pt(-.6, -9.4), pt(-1.4, -4.2), 2 * SZ + B.outlineW * 2, OUT); Body.capsule(cx, pt(-.6, -9.4), pt(-1.4, -4.2), 2 * SZ, clothD);
      const sw = s.fo * .9;     // flap swing
      const fl = [pt(-4.6, 7.8, .85), pt(-5.8, 12.6, .9), pt(-14, 14 + sw, 0), pt(-15.2, 11 + sw * .8, 0), pt(-14.4, 8.4 + sw * .6, 0), pt(-15, 6.2 + sw * .4, 0), pt(-13.6, 4.4 + sw * .2, 0), pt(-5.4, 3.4, .3)];
      cx.beginPath(); cx.moveTo(fl[0].x, fl[0].y); for(let i = 1; i < fl.length; i++) cx.lineTo(fl[i].x, fl[i].y); cx.closePath();
      cx.fillStyle = cloth; cx.fill(); cx.strokeStyle = OUT; cx.lineWidth = B.outlineW * .8; cx.stroke();
      if(!white){
        cx.save(); cx.beginPath(); cx.moveTo(fl[0].x, fl[0].y); for(let i = 1; i < fl.length; i++) cx.lineTo(fl[i].x, fl[i].y); cx.closePath(); cx.clip();
        cx.fillStyle = blood;
        stains.slice(3).forEach(([a, b, rx, ry, rot]) => { const p = pt(a - 2, b - 1.5 + sw * .3, 0); cx.beginPath(); cx.ellipse(p.x, p.y, rx * 1.4, ry * 1.4, rot, 0, 7); cx.fill(); });
        cx.fillRect(fl[3].x - 3, fl[3].y - 5, 1.4, 5);   // drip running down from the hem
        cx.restore();
      }

      // rounded, extremely broad shoulders (deltoid caps, 1.5x): far one first, near one on top
      const delt = (A, r, c) => { cx.beginPath(); cx.arc(A.s.x, A.s.y, r, 0, 7); cx.fillStyle = c; cx.fill(); cx.strokeStyle = OUT; cx.lineWidth = B.outlineW; cx.stroke(); };
      delt(S.aF, 6.6 * SZ, white ? '#fff' : P.far); delt(S.aN, 8 * SZ, white ? '#fff' : '#d8ae98');
    },

    // ---------- face details (little scowl) drawn on the head ----------
    front(cx, f, t, S, P){
      const wh = f.flash > 0;
      cx.save(); drawHook(cx, S, f, P, wh); cx.restore();      // hook in the FRONT hand (fist redrawn over the handle). The back-hand cleaver is drawn in behind()
      const ha = S.lean + ((f.rig && f.rig.j && f.rig.j.head.a) || 0), r = BODY0.head.r;
      // where his MOUTH really is in the world (follows the bow / head tilt) - the vomit stream in arena.js spawns from here
      { const mx = 3.6 * SZ, my = 4.2 * SZ, wx = S.head.x + mx * Math.cos(ha) - my * Math.sin(ha), wy = S.head.y + mx * Math.sin(ha) + my * Math.cos(ha);
        f.mouth = {x: f.x + f.face * wx, y: f.y + wy}; }
      cx.save(); cx.translate(S.head.x, S.head.y); cx.rotate(ha); cx.scale(SZ, SZ);
      if(f.flash > 0){ cx.restore(); return; }
      cx.fillStyle = 'rgba(70,45,40,.4)'; cx.beginPath(); cx.arc(0, 0, r - .4, .15, Math.PI - .5); cx.closePath(); cx.fill();   // stubble / heavy jowl
      cx.strokeStyle = '#2a1512'; cx.lineWidth = 1.1; cx.lineCap = 'round';
      // mouth: flat and mean, but it opens wide to bite during SLAUGHTERHOUSE (chomp on each chop, then two big bites)
      const bite = f.A && f.A.skill === 'vomit' && f.atk > 0 ? Body.keys(atkP(f), [[0,0],[.15,.2],[.4,.4],[.5,1],[.92,1],[1,0]]) : f.A && f.A.skill === 'slaughterhouse' && f.atk > 0 ? Body.keys(atkP(f), [[0,0],[.30,0],[.32,.8],[.35,0],[.38,0],[.40,.8],[.43,0],[.46,0],[.475,.8],[.50,0],[.66,0],[.70,1],[.75,.1],[.80,1],[.86,1],[.90,0],[1,0]]) : 0;
      if(bite > .08){
        const op = 1.2 + bite * 3.4;
        cx.fillStyle = '#3a0a0e'; cx.beginPath(); cx.ellipse(3.4, 3.5 + op * .35, 2.9, op, 0, 0, 7); cx.fill();                    // open mouth
        cx.fillStyle = '#f0e8dc'; for(let i = 0; i < 3; i++){ const tx = 1.4 + i * 1.5; cx.beginPath(); cx.moveTo(tx, 3.2); cx.lineTo(tx + .7, 3.2); cx.lineTo(tx + .35, 4.6); cx.fill(); }   // top teeth
      } else { cx.beginPath(); cx.moveTo(1.6, 3.4); cx.lineTo(4.6, 3.1); cx.stroke(); }                                              // flat mean mouth
      cx.fillStyle = 'rgba(120,16,22,.9)'; cx.beginPath(); cx.arc(4.3, 3.7, .8, 0, 7); cx.fill();                                   // blood at the corner
      cx.strokeStyle = 'rgba(120,60,60,.8)'; cx.lineWidth = .8; cx.beginPath(); cx.moveTo(-1, -3.6); cx.lineTo(1.6, 1.2); cx.stroke();   // old scar
      cx.restore();
    },

    // Meat Hook in flight: chain from his chest to the hook head (h = {ox, oy = chest, x, y = hook head})
    hook(cx, h, t){
      const dx = h.x - h.ox, dy = h.y - h.oy, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, ang = Math.atan2(dy, dx);
      for(let i = 0; i < L - 6; i += 7){
        cx.save(); cx.translate(h.ox + ux * (i + 4), h.oy + uy * (i + 4)); cx.rotate(ang + (i % 14 ? Math.PI / 2 : 0));
        cx.beginPath(); cx.ellipse(0, 0, 3.6, 2.2, 0, 0, 7); cx.strokeStyle = OUTC; cx.lineWidth = 3.2; cx.stroke(); cx.strokeStyle = '#aab0b7'; cx.lineWidth = 1.5; cx.stroke(); cx.restore();
      }
      cx.save(); cx.translate(h.x, h.y); cx.rotate(ang); cx.lineCap = 'round';
      [[OUTC, 7], [STEEL, 4.2]].forEach(([col, w]) => { cx.strokeStyle = col; cx.lineWidth = w; cx.beginPath(); cx.moveTo(-6, 0); cx.lineTo(8, 0); cx.arc(8, 7, 7, -Math.PI / 2, Math.PI * .75); cx.stroke(); });
      cx.restore();
    },

    // ---------- belly + apron simulation runs here (behind() is called right before torso()) ----------
    behind(cx, f, t, S, P){ CUR = simBelly(f, t, S); drawCleaver(cx, S, f, CUR, f.flash > 0); },   // back-hand cleaver: layered BEHIND the far arm, torso and head

    // ---------- HEAVY idle / waddle / landing ----------
    pose(tg, f, t, run, K){
      const s = stOf(f);
      const dt = s.pt == null ? 0 : clamp(t - s.pt, 0, .05); s.pt = t;
      const ph = (f.rig && f.rig.phase) || 0, sn = Math.sin(ph), cs = Math.cos(ph), b = Math.sin(t * 1.4);

      const IDLE = {
        lean: .2 + b * .012, head: -.1 + Math.sin(t * 1.4 + .6) * .02,       // constantly hunched forward under the weight
        aN: -.3 + b * .015, eN: .8,                                            // heavy forearms hang beside the body
        aF: .3 - b * .015, eF: .35,
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
})();