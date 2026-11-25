// NOCTIS art - Shadow Stalker. Lean, agile ragdoll in matte-black tactical cloth under an Assassin Cowl, a layered black + crimson two-tail scarf, a crescent blood-sickle arm blade on each arm, ninja run, and a focus aura while charging.
// LOOK (redesign): cowl + mask + eyes = hood(), scarf = ribbon() / scarfWrap(), torso() / foot() / legGear() / nearArm() = clothing. Poses, grips, blades and ability effects are unchanged.
// Same shared ragdoll as everyone: the poses below are TARGETS (the "animation"), body.js joints are springs (the "ragdoll").
// Hooks used: body (sizes), pose() = idle / run / turn / landing, air() = jump / fall, hurt() = knockback, attack() + spring() = combo + focus,
//             behind() = scarf, aura, hand trails, shadow-step streak, sickle blade on the far arm. front() = sickle blade on the near arm + focus meter.
// Angles: 0 = limb hangs down, + = forward. Joints: lean, head, aN/eN (near arm / elbow), aF/eF (far arm), tN/kN (near thigh / knee), tF/kF (far leg).
(() => {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const state = f => f.nx || (f.nx = {air:false, vy:0, pvy:0, t0:0, landT:-9, dip:0, face:f.face, turnT:-9});   // little memory kept on the fighter

  // READY stance (idle, and where every attack starts / ends): knees soft, blades up in guard
  const G0 = {lean:.1, aN:.55, eN:1.4, aF:.35, eF:1.5, tN:.26, kN:.36, tF:-.2, kF:.3};
  // Attack timeline (p = 0..1). R = release start (the focus freeze pose, = chargeP in skills.js), C = contact (= 1 - hitFrom/time, the hit window opens).
  const R = .3, C = .58, O = C + .1, S = C + .3;

  // Each combo hit is a DIFFERENT move (so a repeated combo never looks like the same hop over and over):
  //   1 "\\" slash   right blade chops down diagonally from above, small step in            (no jump)
  //   2 "/" rising   left blade cuts back UP from low behind him                           (no jump)
  //   3 sweep       both blades swing out wide together in one big horizontal arc           (no jump)
  //   4 X FINISHER  both blades chop down from above, crossing into an X                   (knocks up)
  //   No jumps in the combo: he stays on the ground. (To bring a hop back: add hop:<px/s> to that hit in skills.js and air:true to it below.)
  // Arm keys per hit: a / e = [load, mid, end] for the lead arm (arm angle + elbow), a2 / e2 = the same for the other arm.
  // load = pose at R (focus coil / release), mid = the moment the hit window opens, end = where the swing finishes. Streak = which red slash lines to draw (see xSlash).
  const M = C - .03, E = O + .04;
  const chopA = (a0, v) => [[0, a0], [.1, lerp(a0, v[0], .5)], [R, v[0]], [M, v[1]], [E, v[2]], [S, v[2] - .1], [1, a0]];
  const chopE = (e0, v) => [[0, e0], [R, v[0]], [M, v[1]], [E, v[2]], [S, v[2] + .25], [1, e0]];
  const STEP = {   // legs: front foot steps in, back leg pushes (grounded hits)      /      TUCK_AIR: crouch to jump, then knees tucked in the air (the finisher)
    ground: {tN:[[0, G0.tN], [R, .45], [C, .85], [O, .8], [S, .5], [1, G0.tN]], kN:[[0, G0.kN], [R, .95], [C, .4], [S, .45], [1, G0.kN]],
             tF:[[0, G0.tF], [R, -.5], [C, -.5], [1, G0.tF]],                   kF:[[0, G0.kF], [R, .45], [C, .15], [1, G0.kF]]},
    air:    {tN:[[0, G0.tN], [R, .5], [C, .75], [O, .75], [S, .5], [1, G0.tN]], kN:[[0, G0.kN], [R, 1.05], [C, 1.1], [S, .8], [1, G0.kN]],
             tF:[[0, G0.tF], [R, -.35], [C, .1], [S, .05], [1, G0.tF]],         kF:[[0, G0.kF], [R, .6], [C, 1.0], [S, .8], [1, G0.kF]]}
  };
  const mk = (arm, v) => {
    const g = arm === 'N' ? 'F' : 'N';
    return {arm, streak:v.streak,
      a:chopA(G0['a' + arm], v.a),  e:chopE(G0['e' + arm], v.e),
      ga:chopA(G0['a' + g], v.a2),  ge:chopE(G0['e' + g], v.e2),
      lean:[[0, G0.lean], [R, v.lL], [M, v.lC - .1], [E, v.lC + .1], [S, v.lC], [1, G0.lean]],
      ...STEP[v.air ? 'air' : 'ground']};
  };
  const COMBO = [
    mk('N', {streak:'down',  a:[2.9, 2.4, .8],  e:[.4, .3, .3],  a2:[.9, .6, .45], e2:[1.7, 1.8, 1.8], lL:-.1,  lC:.4}),                                   // 1 "\\" chop from above
    mk('F', {streak:'up',    a:[-1.0, -.2, 2.5], e:[1.2, .7, .3], a2:[.9, .6, .45], e2:[1.7, 1.8, 1.8], lL:-.2,  lC:.35}),                                  // 2 "/" rising cut
    mk('N', {streak:'sweep', a:[-1.1, .5, 1.55], e:[1.2, .6, .2], a2:[-.9, .3, 1.4], e2:[1.3, .7, .3],   lL:-.3,  lC:.55}),                                  // 3 wide double sweep
    mk('F', {streak:'x',     a:[3.1, 2.5, .6],  e:[.3, .2, .2],  a2:[2.7, 2.0, .3], e2:[.6, .8, .5],   lL:-.15, lC:.55})                                    // 4 X finisher
  ];

  // RED SLASH STREAKS drawn in front() from the swing progress p: the blades' cutting lines. A focused (held) release always gets the full X.
  // Coordinates: x = forward, y = down, origin = feet. Each line = [x0, y0, x1, y1, bend] in units of L (half size), drawn one after the other.
  const STREAKS = {
    down:  [[-.75, -1,  .75,  .9, -.25]],                                       // "\\" from top-back to bottom-front
    up:    [[-.75,  .9,  .85, -.95, .25]],                                      // "/" from low behind up to top-front
    sweep: [[-.9, -.1,  1.1,  .15, .0, 1], [-.7,  .35, .95, .4, .0, .55]],     // two flat arcs (last number = thickness)
    x:     [[-.75, -1,  .75,  .9, -.25], [.85, -.95, -.7,  .95, .25]]          // "\\" then "/" = X
  };
  const xSlash = (cx, f, S) => {
    const A = f.A || {}; if(!(f.atk > 0) || !A.time || A.skill) return;
    const p = clamp(1 - f.atk / A.time, 0, 1), big = 1 + .45 * (A.cl || 0) + (A.step === 3 ? .3 : 0);
    const fade = 1 - clamp((p - (C + .1)) / .22, 0, 1); if(p < M || fade <= 0) return;
    const L = 21 * big, x0 = S.sh.x + 20 * big, y0 = S.sh.y + 3, lines = (A.cl > 0 ? STREAKS.x : STREAKS[(COMBO[A.step || 0] || COMBO[0]).streak]) || STREAKS.x;
    cx.lineCap = 'round';
    lines.forEach((q, n) => {
      const k = clamp((p - (M + .05 * n)) / .09, 0, 1), th = q[5] || 1; if(k <= 0) return;
      const xa = x0 + q[0] * L, ya = y0 + q[1] * L, xb = x0 + q[2] * L, yb = y0 + q[3] * L, mx = (xa + xb) / 2 + q[4] * L, my = (ya + yb) / 2 + (q[4] === 0 ? L * .12 : 0), pts = [];
      for(let i = 0; i <= 14 * k; i++){ const t = i / 14, u = 1 - t; pts.push([u * u * xa + 2 * u * t * mx + t * t * xb, u * u * ya + 2 * u * t * my + t * t * yb, Math.sin(Math.PI * Math.min(1, t / Math.max(k, .01) * .999))]); }
      for(let i = 1; i < pts.length; i++){
        const w = pts[i][2] * th;       // thin at both ends
        cx.strokeStyle = 'rgba(255,70,60,' + (.5 * fade) + ')'; cx.lineWidth = 1.5 + 6 * w; cx.beginPath(); cx.moveTo(pts[i - 1][0], pts[i - 1][1]); cx.lineTo(pts[i][0], pts[i][1]); cx.stroke();
        cx.strokeStyle = 'rgba(255,225,215,' + fade + ')'; cx.lineWidth = .6 + 2 * w; cx.beginPath(); cx.moveTo(pts[i - 1][0], pts[i - 1][1]); cx.lineTo(pts[i][0], pts[i][1]); cx.stroke();
      }
    });
  };

  // jump / fall target poses
  const TUCK = {lean:.14, head:-.08, aN:2.1, eN:.5, aF:1.6, eF:.7, tN:.8,  kN:1.05, tF:.1,   kF:.95};   // rising: knees tucked, arms up
  const PUSH = {lean:.1,  head:-.05, aN:2.5, eN:.3, aF:2.0, eF:.4, tN:-.1, kN:.05,  tF:-.3,  kF:.1};    // first instant of takeoff: legs driven straight (the explosive push-off)
  const FALL = {lean:.06, head:-.1,  aN:2.0, eN:.5, aF:1.5, eF:.6, tN:.45, kN:.55,  tF:-.25, kF:.7};    // falling: arms thrown up, legs trail
  const mix = (a, b, k) => { const o = {}; for(const j in a) o[j] = lerp(a[j], b[j], k); return o; };

  // BLOOD SICKLE (crescent arm blade): dark bracer on the forearm + a crescent blade in the fist. Blood-red body, bright cutting edge on the inside of the curve,
  // serrated spikes on the back. HOW HE HOLDS IT = GRIP (pick the names in GRIP_READY / GRIP_RUN below):
  //   'moon'      big crescent moon with the fist gripping a handle at its middle: one tip points forward past the fist, the other back over the wrist
  //   'forward'   blade grows out of the fist along the forearm and hooks downward (like a sickle held out in front)
  //   'forwardUp' same, but the tip hooks upward
  //   'reverse'   fist grips the end, the blade lies back along the forearm and past the elbow (arm-blade style)
  // He uses TWO grips: GRIP_READY for idle / slashing / jumping / hurt, and GRIP_RUN while running on the ground (swaps back when he stops or attacks).
  // GRIP_ATK = grip per combo hit (1 right slash, 2 cross slash, 3 down cut, 4 spin): the blade must lead OUT from the fist or the swing just looks like a punch.
  // GRIP_FOCUS = grip while ATK is held (the focus coil); on release it flips to the GRIP_ATK grip for the shadow-step strike.
  const GRIP_READY = 'reverse', GRIP_RUN = 'forward', GRIP_FOCUS = 'reverse', GRIP_ATK = ['forwardUp', 'forwardUp', 'forwardUp', 'forwardUp'];
  const ATK_HOLD = .3;      // seconds the attack grip is kept after a swing ends (so the blade doesn't flick back and forth between combo hits)
  const RUN_ON = .55, RUN_OFF = .35;      // how fast (0..1 of full run speed) he must go to switch to the run grip / drop back (gap = no flicker)
  // each grip: where the blade starts along the arm (off), which way it points (dir: 1 = away from the elbow), which side it curves to (side),
  // sp = back (outer) curve: start, 2 control points, tip. ed = cutting (inner) curve back to the start: 2 control points, end. handle = [from, to] grip bar.
  const SWEEP = {sp:[[1, -2.2], [9, -6.5], [19, -4.5], [23, 7]], ed:[[17, .5], [9, -.2], [3, 2.4]]};
  const GRIPS = {
    moon:      {off:-15, dir:1,  side:-1, sp:[[0, .5], [7, 9], [23, 9], [30, .5]], ed:[[23, 4.4], [7, 4.4], [0, .5]], handle:[[15, 0], [15, 4.6]]},
    forward:   {off:0,   dir:1,  side:1,  ...SWEEP},
    forwardUp: {off:0,   dir:1,  side:-1, ...SWEEP},
    reverse:   {off:0,   dir:-1, side:-1, ...SWEEP}
  };
  // which grip he holds right now: decided once per frame in behind() (drawn first), then front() reuses it so both arms always match
  const pickGrip = (f, t) => {
    const s = state(f), run = clamp(Math.abs(f.vx) / 170, 0, 1);
    if(f.stun > 0) s.atkT = -9;                                               // hurt cancels the swing
    else if(f.atk > 0){ s.atkT = t; s.atkStep = (f.A && f.A.step) || 0; }    // swinging (remember which hit)
    const swinging = t - (s.atkT ?? -9) < ATK_HOLD;
    const free = f.gr && !swinging && !(f.stun > 0);                          // running grip only when grounded, not swinging, not hurt
    const wasRun = s.grip === GRIP_RUN, nowRun = free && run > (wasRun ? RUN_OFF : RUN_ON);
    const focusing = f.atk > 0 && !(f.stun > 0) && (f.charging || (f.in && f.in.held && !f.chgDone && f.gr));   // ATK held = coiling up for the focus: blade stays tucked back until release
    const g = focusing ? GRIP_FOCUS : swinging ? (GRIP_ATK[s.atkStep] || GRIP_ATK[0]) : nowRun ? GRIP_RUN : GRIP_READY;
    if(g !== s.grip){ s.grip = g; s.gripT = t; }                              // swapped: remember when, so the blade can re-form
    return s.grip;
  };
  const sickle = (cx, A, grip, grow) => {
    const dx = A.hand.x - A.el.x, dy = A.hand.y - A.el.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d, nx = -uy, ny = ux;
    const G = GRIPS[grip] || GRIPS.reverse, e = G.dir, m = G.side, z = grow == null ? 1 : grow;
    const P = (a, b) => [A.hand.x + ux * (G.off + e * a * z) + nx * m * b * z, A.hand.y + uy * (G.off + e * a * z) + ny * m * b * z];   // blade space -> screen (z < 1 = blade still growing after a grip swap)
    const bz = (t, q) => { const k = 1 - t; return [k*k*k*q[0][0] + 3*k*k*t*q[1][0] + 3*k*t*t*q[2][0] + t*t*t*q[3][0], k*k*k*q[0][1] + 3*k*k*t*q[1][1] + 3*k*t*t*q[2][1] + t*t*t*q[3][1]]; };
    const c = pt => P(pt[0], pt[1]), sp = G.sp, ed = G.ed;
    cx.lineCap = 'round'; cx.lineJoin = 'round';
    // bracer on the forearm
    const bx = A.hand.x - dx * .55, by = A.hand.y - dy * .55;
    cx.strokeStyle = '#0b0f1c'; cx.lineWidth = 6.2; cx.beginPath(); cx.moveTo(bx, by); cx.lineTo(A.hand.x, A.hand.y); cx.stroke();
    cx.strokeStyle = '#4a1218'; cx.lineWidth = 4.4; cx.beginPath(); cx.moveTo(bx, by); cx.lineTo(A.hand.x, A.hand.y); cx.stroke();
    cx.strokeStyle = '#d6414b'; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(A.hand.x - dx * .5, A.hand.y - dy * .5); cx.lineTo(A.hand.x - dx * .05, A.hand.y - dy * .05); cx.stroke();
    // grip bar from the fist to the blade (moon grip)
    if(G.handle){ const h0 = P(...G.handle[0]), h1 = P(...G.handle[1]);
      cx.strokeStyle = '#0b0f1c'; cx.lineWidth = 4; cx.beginPath(); cx.moveTo(...h0); cx.lineTo(...h1); cx.stroke();
      cx.strokeStyle = '#4a1218'; cx.lineWidth = 2.4; cx.beginPath(); cx.moveTo(...h0); cx.lineTo(...h1); cx.stroke(); }
    // teeth on the back of the blade: triangles pointing away from the inside of the curve
    const mid = bz(.5, ed.length === 3 ? [ed[0], ed[0], ed[1], ed[2]] : ed), tipIn = sp[3];
    cx.fillStyle = '#6e1620'; cx.strokeStyle = '#0b0f1c'; cx.lineWidth = .9;
    [.3, .5, .7].forEach(t => {
      const p = bz(t, sp), q = bz(t + .1, sp), tx = q[0] - p[0], ty = q[1] - p[1], tl = Math.hypot(tx, ty) || 1;
      let ox = -ty / tl, oy = tx / tl; const inx = bz(t, [sp[0], ed[1], ed[0], sp[3]]); if((inx[0] - p[0]) * ox + (inx[1] - p[1]) * oy > 0){ ox = -ox; oy = -oy; }   // outward = away from the inner curve
      cx.beginPath(); cx.moveTo(...P(p[0], p[1])); cx.lineTo(...P(p[0] + ox * 4.4 - tx / tl * 1.2, p[1] + oy * 4.4 - ty / tl * 1.2)); cx.lineTo(...P(q[0], q[1])); cx.closePath(); cx.fill(); cx.stroke();
    });
    // crescent body
    cx.beginPath(); cx.moveTo(...c(sp[0])); cx.bezierCurveTo(...c(sp[1]), ...c(sp[2]), ...c(sp[3]));
    cx.bezierCurveTo(...c(ed[0]), ...c(ed[1]), ...c(ed[2])); cx.closePath();
    cx.fillStyle = '#9b1c27'; cx.fill(); cx.strokeStyle = '#0b0f1c'; cx.lineWidth = 1.1; cx.stroke();
    // bright cutting edge along the inside of the curve (soft red glow under a pale line)
    const edge = () => { cx.beginPath(); cx.moveTo(...c(sp[3])); cx.bezierCurveTo(...c(ed[0]), ...c(ed[1]), ...c(ed[2])); cx.stroke(); };
    cx.strokeStyle = 'rgba(255,70,60,.45)'; cx.lineWidth = 3.2; edge();
    cx.strokeStyle = '#ffd9cf'; cx.lineWidth = 1; edge();
  };


  // ---------- LOOK (drawing only: no poses, timings, hitboxes or gameplay) ----------
  // Matte black + deep crimson. Charcoal / gunmetal for layered fabric and edge highlights. Violet / lavender stays for shadow energy (aura, hook chain, shadow clones).
  // Everything here is drawn in the same drawing space as before (origin = feet, x = forward) from the shared ragdoll points S, so it follows every pose and animation.
  const OUT = '#0b0f1c', BLK = '#16171c', BLK2 = '#1f2128', CHAR = '#282b34', GUN = '#3c424d', RIM = '#4b5260', CRIM = '#a3202e', CRIM_D = '#5e111c', CRIM_L = '#d6414b', EYE = '#dc7f8d';
  const UA = 3.8, FA = 3.4, HANDR = 2.7, HEAD_R = 6;      // must match body:{} below (the near arm is re-drawn on top of the head, so it needs the same widths)
  const HEX = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const mixHex = (a, b, k) => { const A = HEX(a), B = HEX(b); return 'rgb(' + A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(',') + ')'; };
  const mixP = (a, b, k) => ({x:a.x + (b.x - a.x) * k, y:a.y + (b.y - a.y) * k});
  const W = (white, c) => white ? '#fff' : c;                                   // hit flash = everything white, like the default body
  const poly = (cx, pts) => { cx.beginPath(); pts.forEach((q, i) => i ? cx.lineTo(q[0], q[1]) : cx.moveTo(q[0], q[1])); cx.closePath(); };
  const line = (cx, a, b, w, col) => { cx.strokeStyle = col; cx.lineWidth = w; cx.beginPath(); cx.moveTo(a[0], a[1]); cx.lineTo(b[0], b[1]); cx.stroke(); };
  const path = (cx, pts, w, col) => { cx.strokeStyle = col; cx.lineWidth = w; cx.beginPath(); pts.forEach((q, i) => i ? cx.lineTo(q[0], q[1]) : cx.moveTo(q[0], q[1])); cx.stroke(); };

  // --- ASSASSIN COWL, in head space (origin = head centre, x = forward, y = down, head radius 6). Angular hood with a brow lip, a shadowed eye slit, a fitted mask. ---
  const SHELL = [[-6.6,6.4],[-8.1,1.2],[-7.7,-3.6],[-3.9,-7.5],[1.4,-8.3],[5.5,-6.4],[7.3,-3.2],[7.1,-2],[3.2,-2.5],[.3,-1.9],[-.3,1.8],[-.7,7.4]];     // hood (its front edge is the brow lip over the eyes)
  const FACE  = [[.3,-1.9],[3.2,-2.5],[7.1,-2],[7.2,2.1],[.4,2.2]];                                                                                   // the only skin-side opening: a shadowed slit for the eyes
  const MASK  = [[.4,2.2],[3,2],[5.4,1.9],[6.5,2],[7.2,3.1],[6.7,4],[6.3,4.8],[5,6],[2.4,6.6],[-.8,6.6],[-2.3,5],[-1.2,3]];                    // fitted tactical mask over nose + mouth
  const EYE_C = [4.4, -.05];

  // eyes: natural pale crimson, NO permanent glow. g (0..1) = crimson-violet glow during shadow abilities / supernatural actions (see eyeGlow)
  const eyeGlow = (f, t) => {
    const A = f.A || {}, age = t - (f.blinkT ?? -9); let g = 0;
    if(f.atk > 0 && A.skill) g = 1;                                                    // Shadow Hook / Shadow Replication / Phantom Onslaught
    if(f.shd || f.onsl) g = 1;                                                         // hook in flight / onslaught running
    if(f.charging && f.chg > 0) g = Math.max(g, .5 + .5 * clamp(f.chg / (A.chargeMax || 1), 0, 1));    // focus: gathering shadow energy
    if(age >= 0 && age < .4) g = Math.max(g, 1 - age / .4);                            // Shadow Step
    const s = state(f), dt = clamp(t - (s.egT ?? t), 0, .05); s.egT = t;
    s.eg = (s.eg || 0) + (g - (s.eg || 0)) * (1 - Math.exp(-dt * 14));                  // eases in / out so it flares instead of blinking
    return s.eg < .01 ? 0 : s.eg;
  };

  function hood(cx, H, ang, white, g, t){
    cx.save(); cx.translate(H.x, H.y); cx.rotate(ang); cx.lineJoin = 'round'; cx.lineCap = 'round';
    // hood shell + shadowed face slit
    poly(cx, SHELL); cx.strokeStyle = OUT; cx.lineWidth = 3; cx.stroke(); cx.fillStyle = W(white, BLK); cx.fill();
    poly(cx, FACE); cx.fillStyle = W(white, '#050507'); cx.fill();
    if(!white){
      // structure: a seam down the crown, a lit top edge so the angular silhouette reads on the dark arena, back seam
      path(cx, [[-3.5,-6.6],[1.3,-7.4],[5,-5.5]], .8, RIM);
      path(cx, [[1.2,-7.2],[-.2,-3.6],[-.2,-1.6]], .7, 'rgba(75,82,96,.7)');
      path(cx, [[-7.0,-2.6],[-6.5,3.2]], .6, 'rgba(75,82,96,.6)');
      // eyes: dim sclera, pale crimson iris, small pupil. The brow lip shades the top of them.
      cx.fillStyle = '#6e5760'; cx.beginPath(); cx.ellipse(EYE_C[0], EYE_C[1], 2.05, 1.1, 0, 0, 7); cx.fill();
      cx.fillStyle = g > .05 ? mixHex(EYE, '#ff5f8a', g) : EYE; cx.beginPath(); cx.arc(EYE_C[0] + .35, EYE_C[1] + .05, 1.08, 0, 7); cx.fill();
      cx.fillStyle = '#2a0a12'; cx.beginPath(); cx.arc(EYE_C[0] + .55, EYE_C[1] + .05, .4, 0, 7); cx.fill();
      const sh = cx.createLinearGradient(0, -2.5, 0, -.3); sh.addColorStop(0, 'rgba(3,3,5,' + (.95 - .35 * g) + ')'); sh.addColorStop(1, 'rgba(3,3,5,0)');
      cx.save(); poly(cx, FACE); cx.clip(); cx.fillStyle = sh; cx.fillRect(0, -3, 8, 3); cx.restore();
      if(g > 0){      // crimson-violet glow
        const R = 2.6 + 3.4 * g, gr = cx.createRadialGradient(EYE_C[0] + .3, EYE_C[1], .2, EYE_C[0] + .3, EYE_C[1], R);
        gr.addColorStop(0, 'rgba(255,100,140,' + (.8 * g) + ')'); gr.addColorStop(.45, 'rgba(190,70,210,' + (.32 * g) + ')'); gr.addColorStop(1, 'rgba(140,90,255,0)');
        cx.fillStyle = gr; cx.beginPath(); cx.arc(EYE_C[0] + .3, EYE_C[1], R, 0, 7); cx.fill();
        cx.fillStyle = 'rgba(255,205,222,' + (.85 * g) + ')'; cx.beginPath(); cx.ellipse(EYE_C[0] + .4, EYE_C[1] + .05, 1.5, .62, 0, 0, 7); cx.fill();      // eye itself burns bright
        cx.strokeStyle = 'rgba(190,120,255,' + (.55 * g) + ')'; cx.lineWidth = .7; cx.beginPath(); cx.moveTo(EYE_C[0] + 1.6, EYE_C[1]); cx.lineTo(EYE_C[0] + 1.6 + 2.2 * g, EYE_C[1] - .25); cx.stroke();   // short violet flare
      }
    }
    // mask
    poly(cx, MASK); cx.strokeStyle = OUT; cx.lineWidth = 2.6; cx.stroke(); cx.fillStyle = W(white, '#101115'); cx.fill();
    if(!white){
      path(cx, [[5.4,2.1],[7,3.1]], .7, RIM);                                        // nose ridge
      path(cx, [[6.2,4.9],[3.4,5.3]], .55, 'rgba(75,82,96,.55)');                       // mouth seam
      path(cx, [[.2,3.4],[1.6,6]], .55, 'rgba(75,82,96,.45)');                        // cheek seam
      // crimson stitching: along the brow lip of the hood and along the top edge of the mask (selected edges only)
      cx.setLineDash([1.1, 1.0]); cx.lineCap = 'butt';
      cx.globalAlpha = .8;
      path(cx, [[6.6,-3.4],[3.3,-3.8],[.6,-3.3],[.0,.2]], .55, '#8d1a28');
      path(cx, [[1.2,3.1],[3,2.9],[4.8,2.8]], .5, '#8d1a28');
      path(cx, [[-6.9,2.6],[-6.3,5.6]], .55, CRIM_D);
      cx.globalAlpha = 1;
      cx.setLineDash([]);
    }
    cx.restore();
  }

  // scarf wrapped round the neck (layered: crimson lining peeks out along the lower rim, matte black outer on top) + the knot the two tails hang from
  const NECK_UP = 2.9;
  function scarfWrap(cx, S, white){
    const l = S.lean, ux = Math.sin(l), uy = -Math.cos(l);
    cx.save(); cx.translate(S.sh.x + ux * NECK_UP, S.sh.y + uy * NECK_UP); cx.rotate(l); cx.lineJoin = 'round';        // local: x = forward, y = down the torso
    cx.fillStyle = OUT; cx.beginPath(); cx.ellipse(-.3, .7, 5.9, 3, 0, 0, 7); cx.fill();
    cx.fillStyle = W(white, CRIM); cx.beginPath(); cx.ellipse(-.3, .55, 5, 2.1, 0, 0, 7); cx.fill();                    // inner lining
    cx.fillStyle = OUT; cx.beginPath(); cx.ellipse(-.5, -.35, 5.4, 2.4, 0, 0, 7); cx.fill();
    cx.fillStyle = W(white, BLK); cx.beginPath(); cx.ellipse(-.5, -.35, 4.7, 1.75, 0, 0, 7); cx.fill();                  // outer fabric
    if(!white){
      cx.strokeStyle = RIM; cx.lineWidth = .7; cx.beginPath(); cx.ellipse(-.5, -.5, 4.1, 1.3, 0, 3.6, 5.6); cx.stroke();
      cx.strokeStyle = 'rgba(0,0,0,.5)'; cx.lineWidth = .6; cx.beginPath(); cx.moveTo(-2.2, -1.2); cx.quadraticCurveTo(-1, .2, -2.4, 1.3); cx.stroke();   // fold
    }
    cx.fillStyle = OUT; cx.beginPath(); cx.arc(-4.5, .1, 2.6, 0, 7); cx.fill();                                           // knot at the back of the neck
    cx.fillStyle = W(white, BLK2); cx.beginPath(); cx.arc(-4.5, .1, 1.7, 0, 7); cx.fill();
    cx.restore();
  }
  const knotAt = S => { const l = S.lean, ux = Math.sin(l), uy = -Math.cos(l), fx = Math.cos(l), fy = Math.sin(l);
    return {x:S.sh.x + ux * (NECK_UP - .1) - fx * 4.5, y:S.sh.y + uy * (NECK_UP - .1) - fy * 4.5}; };

  // one scarf tail: a ribbon of cloth along `pts`. It twists as it flows: the matte-black outer fabric turns away and the deep crimson lining shows, then it turns back.
  // hw = half width at the root; tw = [time speed, phase] of the twist. Colour + width are per segment, so the lining appears gradually, never as a hard flip.
  function ribbon(cx, raw, hw, t, tw, white){
    const M = 4, N = raw.length, pts = [], U = [];                        // Catmull-Rom smoothing: M points between every two control points, so the cloth curves instead of kinking
    for(let i = 0; i < N - 1; i++){
      const p0 = raw[Math.max(0, i - 1)], p1 = raw[i], p2 = raw[i + 1], p3 = raw[Math.min(N - 1, i + 2)];
      for(let j = 0; j < M; j++){
        const u = j / M, u2 = u * u, u3 = u2 * u;
        pts.push({x:.5 * (2 * p1.x + (-p0.x + p2.x) * u + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * u2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * u3),
                  y:.5 * (2 * p1.y + (-p0.y + p2.y) * u + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * u2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * u3)});
        U.push(i + u);
      }
    }
    pts.push(raw[N - 1]); U.push(N - 1);
    const n = pts.length, L = [], R = [], seg = [];
    for(let i = 0; i < n; i++){
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d;
      const c = Math.cos(t * tw[0] - U[i] * .6 + tw[1]);                             // 1 = outer fabric faces the camera, -1 = lining faces the camera
      const taper = 1 - .5 * (U[i] / (N - 1)), w = hw * taper * (.74 + .26 * Math.abs(c));
      let ex = 0, ey = 0; if(i === n - 1){ ex = dx / d * 1.3; ey = dy / d * 1.3; }     // slanted (cut) tip
      L.push([pts[i].x + nx * w + ex, pts[i].y + ny * w + ey]); R.push([pts[i].x - nx * w - ex, pts[i].y - ny * w - ey]);
      seg.push(clamp((.4 - c) / .7, 0, 1));                                           // 0 = black, 1 = crimson
    }
    cx.lineJoin = 'round';
    cx.beginPath(); L.forEach((q, i) => i ? cx.lineTo(q[0], q[1]) : cx.moveTo(q[0], q[1])); for(let i = n - 1; i >= 0; i--) cx.lineTo(R[i][0], R[i][1]); cx.closePath();
    cx.strokeStyle = OUT; cx.lineWidth = 2.4; cx.stroke(); cx.fillStyle = W(white, BLK); cx.fill();
    if(white) return;
    for(let i = 1; i < n; i++){
      const k = (seg[i - 1] + seg[i]) / 2; cx.fillStyle = mixHex(BLK, CRIM, k);
      cx.beginPath(); cx.moveTo(L[i - 1][0], L[i - 1][1]); cx.lineTo(L[i][0], L[i][1]); cx.lineTo(R[i][0], R[i][1]); cx.lineTo(R[i - 1][0], R[i - 1][1]); cx.closePath(); cx.fill(); cx.lineWidth = .5; cx.strokeStyle = cx.fillStyle; cx.stroke();
    }
    path(cx, L, .6, 'rgba(75,82,96,.55)');                                              // lit edge
  }

  // --- NEAR ARM re-drawn over the head (the cowl is drawn in front()), with the elbow reinforcement. Same widths as the default limb, so it is invisible except where it adds detail. ---
  function nearArm(cx, S, P, white){
    const A = S.aN, dx = A.hand.x - A.el.x, dy = A.hand.y - A.el.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d, nx = uy, ny = -ux;
    Body.capsule(cx, A.s, A.el, UA + 3.2, OUT); Body.capsule(cx, A.el, A.hand, FA + 3.2, OUT);
    Body.capsule(cx, A.s, A.el, UA, W(white, P.limb)); Body.capsule(cx, A.el, A.hand, FA, W(white, P.limb));
    if(!white){
      Body.capsule(cx, {x:A.el.x - ux * 1.2, y:A.el.y - uy * 1.2}, {x:A.el.x + ux * 2.6, y:A.el.y + uy * 2.6}, FA + 1.8, OUT);     // reinforced elbow panel
      Body.capsule(cx, {x:A.el.x - ux * 1.2, y:A.el.y - uy * 1.2}, {x:A.el.x + ux * 2.6, y:A.el.y + uy * 2.6}, FA + .8, CHAR);
      const c = {x:A.el.x + ux * 3.6, y:A.el.y + uy * 3.6}; line(cx, [c.x - nx * 2.2, c.y - ny * 2.2], [c.x + nx * 2.2, c.y + ny * 2.2], .8, CRIM);   // crimson cuff piping
    }
    cx.fillStyle = OUT; cx.beginPath(); cx.arc(A.hand.x, A.hand.y, HANDR + 1.6, 0, 7); cx.fill();
    cx.fillStyle = W(white, P.hand); cx.beginPath(); cx.arc(A.hand.x, A.hand.y, HANDR, 0, 7); cx.fill();
  }

  // --- LEGS: slim tactical trousers with a flexible knee panel, one thigh strap and one shin strap. leg = {hip, knee, ankle} ---
  function legGear(cx, leg, white, far){
    if(white) return;
    const h = leg.hip, k = leg.knee, a = leg.ankle;
    const tx = k.x - h.x, ty = k.y - h.y, tl = Math.hypot(tx, ty) || 1, nx = ty / tl, ny = -tx / tl;           // along the thigh, normal pointing forward
    const sx = a.x - k.x, sy = a.y - k.y, sl = Math.hypot(sx, sy) || 1, snx = sy / sl, sny = -sx / sl;
    cx.save(); cx.lineCap = 'round'; if(far) cx.globalAlpha = .85;
    const m = mixP(h, k, .38);                                                                                 // thigh strap + tiny crimson tab
    line(cx, [m.x - nx * 2.9, m.y - ny * 2.9], [m.x + nx * 2.9, m.y + ny * 2.9], 1.5, GUN);
    line(cx, [m.x + nx * 1.5, m.y + ny * 1.5], [m.x + nx * 2.5, m.y + ny * 2.5], 1.3, far ? CRIM_D : CRIM);
    const q = mixP(k, a, .5);                                                                                  // shin strap
    line(cx, [q.x - snx * 2.4, q.y - sny * 2.4], [q.x + snx * 2.4, q.y + sny * 2.4], 1.1, GUN);
    let bx = tx / tl + sx / sl, by = ty / tl + sy / sl; const bl = Math.hypot(bx, by) || 1; bx /= bl; by /= bl; const fx = by, fy = -bx;   // knee: along the bisector, front = perpendicular
    const c = {x:k.x + fx * .6, y:k.y + fy * .6};
    Body.capsule(cx, {x:c.x - bx * 1.7, y:c.y - by * 1.7}, {x:c.x + bx * 1.7, y:c.y + by * 1.7}, 5.8, OUT);
    Body.capsule(cx, {x:c.x - bx * 1.7, y:c.y - by * 1.7}, {x:c.x + bx * 1.7, y:c.y + by * 1.7}, 4.6, CHAR);
    line(cx, [c.x + fx * 1.6 - bx * 1.3, c.y + fy * 1.6 - by * 1.3], [c.x + fx * 1.6 + bx * 1.3, c.y + fy * 1.6 + by * 1.3], .7, RIM);
    cx.restore();
  }

  Characters.art('noctis', {
    // lean build: slimmer torso, limbs and head, average height (lengths stay default)
    body: {head:{r:6}, torso:{w:9}, uArm:{w:3.8}, fArm:{w:3.4}, hand:{r:2.7}, thigh:{w:5}, shin:{w:4.2}, foot:{w:3.2}, noRings:true, belt:3},
    // matte black cloth, charcoal / gunmetal trousers, crimson only as trim (drawn in the hooks below)
    colors: {shirt:'#16171c', limb:'#1f2128', far:'#101115', head:'#16171c', dark:'#0e0f12', hand:'#14151a', legs:'#23262e', legsFar:'#15171c'},

    // matte-black tactical torso (replaces the plain capsule): lean taper, overlapped chest panel with crimson inner lining, layered waist sash. Torso space: a = up the spine, b = forward.
    torso(cx, S, B, P, white){
      legGear(cx, S.lF, white, true);                      // far leg: knee panel + straps (the far leg was just drawn)
      const l = S.lean, ux = Math.sin(l), uy = -Math.cos(l), fx = Math.cos(l), fy = Math.sin(l);
      const pt = (a, b) => [S.pel.x + ux * a + fx * b, S.pel.y + uy * a + fy * b];
      const blob = a => {            // smooth closed shape through the points
        const q = a.map(p => pt(p[0], p[1])), n = q.length, mid = (p, r) => [(p[0] + r[0]) / 2, (p[1] + r[1]) / 2], m0 = mid(q[n - 1], q[0]);
        cx.beginPath(); cx.moveTo(m0[0], m0[1]);
        for(let i = 0; i < n; i++){ const m = mid(q[i], q[(i + 1) % n]); cx.quadraticCurveTo(q[i][0], q[i][1], m[0], m[1]); }
        cx.closePath();
      };
      const TORSO = [[-.5,-3.6],[3,-3.4],[7,-4.1],[10.5,-4.6],[12.8,-3.8],[14,-1],[14,2],[12.6,4.3],[9.5,4.9],[6.5,4.3],[3,3.7],[-.5,3.9]];
      cx.lineJoin = 'round'; cx.lineCap = 'round';
      blob(TORSO); cx.strokeStyle = B.outline; cx.lineWidth = B.outlineW * 2; cx.stroke(); cx.fillStyle = W(white, P.shirt); cx.fill();
      if(white) return;
      cx.save(); blob(TORSO); cx.clip();
      // chest: the front panel overlaps like a wrap jacket; crimson lining shows along the overlap edge only
      poly(cx, [pt(14.6,1.3), pt(14.6,6), pt(6.6,6), pt(7.4,3.8), pt(10.8,2.5)]); cx.fillStyle = BLK2; cx.fill();
      path(cx, [pt(14,.8), pt(10.8,2.5), pt(7.4,3.8)], 1.1, CRIM);
      path(cx, [pt(12.9,-3.6), pt(10.5,-4.2), pt(7,-3.7), pt(3,-3), pt(.5,-3.2)], .7, 'rgba(75,82,96,.65)');       // lit back edge (silhouette reads on the dark arena)
      cx.restore();
      // waist: charcoal sash wrapped twice. The second wrap crosses it diagonally and its fold shows the crimson lining.
      poly(cx, [pt(1.9,-4.1), pt(5.1,-4), pt(5.3,4.7), pt(2.1,4.7)]); cx.fillStyle = CHAR; cx.fill(); cx.strokeStyle = OUT; cx.lineWidth = .8; cx.stroke();
      poly(cx, [pt(1.1,-3.9), pt(2.9,-4), pt(5.4,4.4), pt(3.4,4.5)]); cx.fillStyle = BLK; cx.fill(); cx.stroke();
      poly(cx, [pt(3.4,4.5), pt(5.4,4.4), pt(4.5,6)]); cx.fillStyle = CRIM; cx.fill(); cx.stroke();
      path(cx, [pt(2.3,-4), pt(5,-3.9)], .6, 'rgba(75,82,96,.6)');
    },

    // lightweight shinobi-style boot (replaces the default foot, same footprint so the feet still touch the ground exactly): slim foot, wrapped shaft, reinforced sole, crimson cuff
    foot(cx, leg, P, white, f, far){
      const w = 3.2, len = 8, planted = leg.planted, phi = planted ? 0 : clamp(-leg.sa * .5, -.8, .8);      // same numbers as the default foot in body.js
      const lift = planted ? clamp((leg.hip.x - leg.ankle.x - 2) * .12, 0, 3.5) : 0, col = white ? '#fff' : (far ? '#0d0e11' : '#14151a');
      const a = {x:leg.ankle.x - 1.5, y:leg.ankle.y - lift}, b = {x:leg.ankle.x + (len - 1.5) * Math.cos(phi), y:leg.ankle.y + (len - 1.5) * Math.sin(phi)};
      const top = mixP(leg.ankle, leg.knee, .34);
      Body.capsule(cx, a, b, w + 3.2, OUT); Body.capsule(cx, a, top, 4.7 + 3.2, OUT);
      Body.capsule(cx, a, b, w, col); Body.capsule(cx, a, top, 4.7, col);
      if(white) return;
      const ux = leg.knee.x - leg.ankle.x, uy = leg.knee.y - leg.ankle.y, ul = Math.hypot(ux, uy) || 1, nx = uy / ul, ny = -ux / ul;      // along the lower leg, normal pointing forward
      cx.save(); cx.lineCap = 'round';
      Body.capsule(cx, {x:a.x + .6, y:a.y + w * .38}, {x:b.x - .3, y:b.y + w * .38}, 1.2, '#06070a');             // reinforced sole
      Body.capsule(cx, {x:b.x - 1.8, y:b.y - .2}, {x:b.x - .2, y:b.y - .1}, w * .72, far ? '#17181d' : '#1c1e25');  // toe cap
      const q = mixP(leg.ankle, leg.knee, .16); line(cx, [q.x - nx * 2.3, q.y - ny * 2.3], [q.x + nx * 2.3, q.y + ny * 2.3], .8, far ? '#2b2e37' : GUN);                  // wrap strap
      const c = mixP(leg.ankle, leg.knee, .3); line(cx, [c.x - nx * 2.5, c.y - ny * 2.5], [c.x + nx * 2.5, c.y + ny * 2.5], .9, far ? CRIM_D : CRIM);                      // crimson cuff
      cx.restore();
    },


    // grounded: ready stance with a toe-bounce, ninja run (low, leaning hard, blades trailing behind), quick turn lead, knee-bend landing
    pose(tg, f, t, run, K){
      const s = state(f), ph = (f.rig && f.rig.phase) || 0, sn = Math.sin(ph), cs = Math.cos(ph), b = Math.sin(t * 2.4);
      if(s.air){ s.air = false; s.landT = t; s.dip = clamp(Math.abs(s.vy) / 700, .35, 1); }      // just landed
      if(s.face !== f.face){ s.face = f.face; s.turnT = t; }                                     // just turned around

      // READY: alive, never frozen: slow breathing, bouncing on the toes, head scanning
      const I = {lean:G0.lean + b * .02, head:Math.sin(t * .8) * .07 + Math.sin(t * 2.7 + 1) * .03,
                 aN:G0.aN + b * .05, eN:G0.eN, aF:G0.aF - b * .05, eF:G0.eF,
                 tN:G0.tN, kN:G0.kN + (.5 + .5 * Math.sin(t * 4)) * .06, tF:G0.tF, kF:G0.kF + (.5 + .5 * Math.sin(t * 4 + 1.6)) * .06};
      // NINJA RUN: leans hard, both arms swept back (blades trail), long strides, high knee kick
      const U = {lean:.5 + .03 * Math.cos(2 * ph), head:-.12,
                 aN:-1.1 - sn * .3, eN:.5 + .25 * cs, aF:-1 + sn * .3, eF:.5 - .25 * cs,
                 tN:sn * 1.05 + .15, kN:.3 + 1.2 * Math.max(0, cs), tF:-sn * 1.05 + .15, kF:.3 + 1.2 * Math.max(0, -cs)};
      for(const k in U) tg[k] = lerp(I[k], U[k], run);      // walking = the blend between the two

      // TURN: upper body leads into the new direction, arms trail, settles in ~.2s
      const tk = clamp(1 - (t - s.turnT) / .22, 0, 1);
      if(tk > 0){ tg.lean += .14 * tk; tg.head += .1 * tk; tg.aN -= .35 * tk; tg.aF -= .35 * tk; }

      // LANDING: knees bend, torso dips, then recovers (harder fall = deeper dip)
      const q = (t - s.landT) / .34;
      if(q < 1){
        const d = K(q, [[0, 0], [.22, 1], [1, 0]]) * s.dip;
        tg.kN += .55 * d; tg.kF += .55 * d; tg.tN += .4 * d; tg.tF -= .25 * d; tg.lean += .28 * d; tg.aN += .35 * d; tg.aF += .35 * d;
        return {k:240, d:22};
      }
      return {k:185, d:19};      // a bit snappier than default = agile
    },

    // in the air: quick push-off when jumping (also on the double jump), tucked rise, arms-up fall
    air(tg, f, t, K){
      const s = state(f);
      if(!s.air || f.vy < s.pvy - 400) s.t0 = t;                    // left the ground, or jumped again in the air
      s.air = true; s.vy = f.vy; s.pvy = f.vy; s.face = f.face;
      const age = t - s.t0, push = f.vy < -100 ? clamp(1 - age / .12, 0, 1) : 0, m = clamp((f.vy + 260) / 520, 0, 1);
      const P = mix(mix(TUCK, FALL, m), PUSH, push), fl = Math.sin(t * 9) * .14 * m;      // arms flutter a little while falling
      for(const j in P) tg[j] = P[j];
      tg.aN += fl; tg.aF -= fl;
      return push > 0 ? {k:300, d:26} : {k:130, d:14};
    },

    // knockback: light body is thrown noticeably (arms and legs fling), then catches itself fast as the stun runs out
    hurt(tg, f, t){
      const s = state(f); s.air = false; s.face = f.face;
      const hs = f.vx * f.face >= 0 ? 1 : -1, q = clamp(f.stun / .26, 0, 1), r = 1 - q, fl = Math.sin(t * 30) * q;
      tg.lean = .62 * hs * q + .1 * r;       tg.head = -.5 * hs * q + fl * .12;
      tg.aN = -1.9 * hs * q + .5 * r + fl * .35;  tg.eN = .5 + .3 * q;
      tg.aF = -1.4 * hs * q + .3 * r - fl * .35;  tg.eF = .7;
      tg.tN = -.6 * hs * q + .45 * r + fl * .25;  tg.kN = .5 + .3 * r;     // knees bend to catch balance
      tg.tF = .6 * hs * q - .25 * r - fl * .25;   tg.kF = .6 + .2 * r;
      return {k:60 + 120 * r, d:6 + 8 * r};   // floppy at first, firm again at the end (short recovery)
    },

    // joint spring per phase: soft while loading / focusing, very stiff at the release (snaps), medium on the recovery
    spring(p, A){
      if(A.skill === 'onslaught') return {k:720, d:44};                                      // Phantom Onslaught: snappy slashes
      if(A.skill === 'replicate') return {k:420, d:34};
      if(A.skill === 'shadowhook') return A.ph === 4 ? {k:650, d:46} : {k:520, d:40};      // Shadow Hook: stiff, so the dash and the flip follow the poses tightly
      if(p < R - .04 || (A.chg > 0 && p < R + .002)) return {k:A.chg > 0 ? 360 : 300, d:A.chg > 0 ? 32 : 28};
      if(p < C + .08) return A.cl > 0 ? {k:1500, d:80} : {k:1200, d:70};
      return {k:300, d:28};
    },

    // combo poses. Holding ATK freezes the swing at p = R (a low coil) = FOCUS; the longer, the lower he crouches.
    attack(tg, p, A, K){
      if(A.skill === 'replicate'){      // SHADOW REPLICATION cast: crouches, hands together in a seal, then throws both arms wide as the shadows appear
        tg.lean = K(p, [[0, .05], [.4, .3], [.75, -.1], [1, 0]]); tg.head = -tg.lean * .4;
        tg.aN = K(p, [[0, 1.0], [.45, 1.0], [.75, 2.5], [1, 1.2]]); tg.eN = K(p, [[0, 1.6], [.45, 1.9], [.75, .2], [1, 1]]);
        tg.aF = K(p, [[0, .9], [.45, .9], [.75, -1.4], [1, .4]]);   tg.eF = K(p, [[0, 1.7], [.45, 2.0], [.75, .3], [1, 1]]);
        tg.tN = K(p, [[0, .2], [.4, .8], [1, .2]]); tg.kN = K(p, [[0, .3], [.4, 1.3], [1, .3]]); tg.tF = K(p, [[0, -.2], [.4, -.5], [1, -.2]]); tg.kF = K(p, [[0, .3], [.4, .9], [1, .3]]);
        return;
      }
      if(A.skill === 'onslaught'){      // PHANTOM ONSLAUGHT (A.ph: 0 slashing frenzy / 1 wind-up / 2 finishing slash / 3 recover, A.pp = progress in it, A.sw = which arm slashes this beat)
        const ph = A.ph || 0, pp = A.pp || 0, e = pp * pp * (3 - 2 * pp);
        if(ph === 4){                  // appears, crouches with both arms thrown back while the shadows jump onto his back
          tg.lean = lerp(.1, -.15, e); tg.head = .05; tg.aN = lerp(.6, -1.6, e); tg.aF = lerp(.4, -1.9, e); tg.eN = tg.eF = .5;
          tg.tN = .7; tg.kN = 1.2; tg.tF = -.4; tg.kF = .9;
        }else if(ph === 5){            // throws the chains: both arms snap forward at the target
          tg.lean = lerp(-.1, .55, e); tg.head = -.2; tg.aN = lerp(-1.4, 1.75, e); tg.aF = lerp(-1.6, 1.55, e); tg.eN = tg.eF = .15;
          tg.tN = .8; tg.kN = 1.1; tg.tF = -.6; tg.kF = .7;
        }else if(ph === 0){
          const h = A.sw ? 'F' : 'N', g = h === 'N' ? 'F' : 'N';
          tg['a' + h] = lerp(-1.3, 2.5, e); tg['e' + h] = .3; tg['a' + g] = lerp(2.0, -1.0, e); tg['e' + g] = .6;
          tg.lean = lerp(.15, .75, e); tg.head = -tg.lean * .4;
          tg.tN = .8; tg.kN = 1.3; tg.tF = -.5; tg.kF = 1;
        }else if(ph === 1){            // both blades up
          tg.aN = lerp(1.4, 3.0, e); tg.aF = lerp(1.2, 2.8, e); tg.eN = tg.eF = .3; tg.lean = -.25 * e; tg.head = .1;
          tg.tN = .7; tg.kN = 1.2; tg.tF = -.4; tg.kF = .9;
        }else if(ph === 2){            // finishing slash: both blades chop down into an X
          tg.aN = 1.6; tg.aF = 1.3; tg.eN = .2; tg.eF = .25; tg.lean = .8; tg.head = -.3;
          tg.tN = .9; tg.kN = .9; tg.tF = -.8; tg.kF = .5;
        }else{                          // recover
          tg.aN = lerp(1.3, .7, e); tg.aF = lerp(1.1, .3, e); tg.eN = tg.eF = lerp(.4, 1, e); tg.lean = lerp(.7, .1, e); tg.head = -tg.lean * .4;
          tg.tN = lerp(.8, .3, e); tg.kN = lerp(.9, .5, e); tg.tF = lerp(-.8, -.2, e); tg.kF = lerp(.5, .3, e);
        }
        return;
      }
      if(A.skill === 'shadowhook'){      // SHADOW HOOK: A.ph = phase (0 throw, 1 pull, 2 through, 3 kick, 4 backflip), A.pp = progress inside it (set by arena.js)
        const ph = A.ph || 0, pp = A.pp || 0;
        if(ph === 0){      // throw: near arm points along the aim, crouched
          tg.aN = A.aimA == null ? 1.5 : A.aimA; tg.eN = .15; tg.aF = -.6; tg.eF = 1.2; tg.lean = .35; tg.head = -.15;
          tg.tN = .5; tg.kN = .6; tg.tF = -.5; tg.kF = .35; return;
        }
        if(ph === 1 || ph === 2){      // flying in / through: body stretched forward, hook arm out front, legs trailing
          tg.lean = 1.3; tg.head = -.55; tg.aN = 1.75; tg.eN = .1; tg.aF = -1.2; tg.eF = .3;
          tg.tN = -.7; tg.kN = .5; tg.tF = -1.05; tg.kF = .4; return;
        }
        if(ph === 3){      // aerial kick: leans back, chambers the knee, snaps the leg out, arms thrown back
          tg.lean = K(pp, [[0, .2], [.25, -.45], [.45, -.3], [1, -.2]]); tg.head = -tg.lean * .3;
          tg.aN = K(pp, [[0, -.8], [1, -1.3]]); tg.eN = .6; tg.aF = K(pp, [[0, -.5], [1, -.9]]); tg.eF = .7;
          tg.tN = K(pp, [[0, .5], [.3, .95], [.45, 1.75], [.75, 1.7], [1, 1.2]]); tg.kN = K(pp, [[0, 1.6], [.3, 1.85], [.45, .1], [.75, .15], [1, .8]]);
          tg.tF = .3; tg.kF = 1.1; return;
        }
        const e = pp * pp * (3 - 2 * pp);      // backflip: full backward rotation, tucked, opens up for the landing
        tg.lean = -2 * Math.PI * e; tg.head = .1;
        tg.aN = tg.aF = .9; tg.eN = tg.eF = 1.9;
        tg.tN = tg.tF = K(pp, [[0, .9], [.25, 1.5], [.8, 1.5], [1, .5]]); tg.kN = tg.kF = K(pp, [[0, .8], [.25, 2], [.8, 2], [1, .4]]);
        return;
      }
      const P = COMBO[A.step || 0], h = P.arm, g = h === 'N' ? 'F' : 'N';
      tg['a' + h] = K(p, P.a); tg['e' + h] = K(p, P.e); tg['a' + g] = K(p, P.ga); tg['e' + g] = K(p, P.ge);
      tg.lean = K(p, P.lean); tg.tN = K(p, P.tN); tg.kN = K(p, P.kN); tg.tF = K(p, P.tF); tg.kF = K(p, P.kF);
      const L = A.cl || 0;                                   // focus level 0..1
      if(L > 0){
        const wl = K(p, [[0, 0], [.2, 1], [R, 1], [C, 0], [1, 0]]), wc = K(p, [[0, 0], [R, 0], [C, 1], [C + .2, .5], [1, 0]]);
        tg.kN += .35 * L * wl; tg.kF += .3 * L * wl; tg.tN += .15 * L * wl; tg.lean += .12 * L * wl + .14 * L * wc;
      }
      tg.head = -tg.lean * .4;
      if(A.chg > 0 || L > 0) tg.head = Math.max(tg.head, .1 - tg.lean);      // focusing: eyes on the target, head never tilts up
    },

    // Shadow Hook in flight: h = {ox, oy = his hand, x, y = hook head}. Dark chain of links with a violet glow + a small blood-red crescent hook head
    hook(cx, h, t){
      const dx = h.x - h.ox, dy = h.y - h.oy, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, ang = Math.atan2(dy, dx);
      cx.save(); cx.lineCap = 'round';
      cx.strokeStyle = 'rgba(120,110,255,.35)'; cx.lineWidth = 5; cx.beginPath(); cx.moveTo(h.ox, h.oy); cx.lineTo(h.x - ux * 6, h.y - uy * 6); cx.stroke();
      for(let i = 0; i < L - 6; i += 6){
        cx.save(); cx.translate(h.ox + ux * (i + 3), h.oy + uy * (i + 3)); cx.rotate(ang + ((i / 6) % 2 ? Math.PI / 2 : 0));
        cx.fillStyle = '#14172b'; cx.strokeStyle = '#8f95ff'; cx.lineWidth = .8; cx.beginPath(); cx.ellipse(0, 0, 3.4, 1.8, 0, 0, 7); cx.fill(); cx.stroke(); cx.restore();
      }
      cx.translate(h.x, h.y); cx.rotate(ang);                                        // hook head: crescent pointing forward
      cx.fillStyle = '#9b1c27'; cx.strokeStyle = '#0b0f1c'; cx.lineWidth = 1;
      cx.beginPath(); cx.moveTo(-4, -3); cx.quadraticCurveTo(9, -9, 10, 2); cx.quadraticCurveTo(5, -3, -4, 3); cx.closePath(); cx.fill(); cx.stroke();
      cx.strokeStyle = '#ffd9cf'; cx.lineWidth = .8; cx.beginPath(); cx.moveTo(-2, 2); cx.quadraticCurveTo(5, -3, 9, 1.5); cx.stroke();
      cx.restore();
    },

    // A shadow / afterimage of him (Shadow Replication stands them still, Phantom Onslaught slashes with them): c = {x, y = feet, face, a = opacity, still, slash, sw, k, seed}
    clone(cx, c, t){
      if(c.still){   // standing shadows never change shape: draw once into a small cached canvas, then just stamp it (cheap on phones)
        const me = Characters.artOf('noctis'); let sp = me._shadowSprite;
        if(!sp){ sp = me._shadowSprite = document.createElement('canvas'); sp.width = 90; sp.height = 90; const g = sp.getContext('2d'); g.translate(45, 80); me.clone(g, {x:0, y:0, face:1, a:1, still:false, still0:true, seed:0}, 0); }
        cx.save(); cx.translate(c.x, c.y); cx.scale(c.face || 1, 1); cx.globalAlpha = (c.a == null ? 1 : c.a) * (.74 + .14 * Math.sin(t * 3 + (c.seed || 0)));
        cx.drawImage(sp, -45, -80 + Math.sin(t * 2.4 + (c.seed || 0)) * 1.2); cx.restore(); return;
      }
      const sd = c.seed || 0, a = (c.a == null ? 1 : c.a) * (c.still ? .74 + .14 * Math.sin(t * 3 + sd) : 1), bob = c.still0 ? 0 : c.still ? Math.sin(t * 2.4 + sd) * 1.2 : -6;
      const cap = (x1, y1, x2, y2, w, col) => { cx.lineCap = 'round'; cx.strokeStyle = '#8f95ff'; cx.lineWidth = w + 1.8; cx.beginPath(); cx.moveTo(x1, y1); cx.lineTo(x2, y2); cx.stroke();
        cx.strokeStyle = col || '#0d1022'; cx.lineWidth = w; cx.beginPath(); cx.moveTo(x1, y1); cx.lineTo(x2, y2); cx.stroke(); };
      cx.translate(c.x, c.y); cx.scale(c.face || 1, 1); cx.globalAlpha = a;
      if(c.still0){ const g = cx.createRadialGradient(0, -2, 2, 0, -2, 24); g.addColorStop(0, 'rgba(92,107,255,.45)'); g.addColorStop(1, 'rgba(92,107,255,0)'); cx.fillStyle = g; cx.beginPath(); cx.ellipse(0, -2, 24, 8, 0, 0, 7); cx.fill(); }   // glow on the ground
      cx.translate(0, bob);
      const sh = {x:3, y:-41}, pel = {x:0, y:-26}, dv = (ang, L) => [Math.sin(ang) * L, Math.cos(ang) * L];
      if(c.slash){ cap(pel.x, pel.y, -3, -14, 5); cap(-3, -14, -9, -4, 4); cap(pel.x, pel.y, 5, -15, 5); cap(5, -15, 10, -6, 4); }      // legs tucked in the air
      else { cap(pel.x, pel.y, -2, -13, 5); cap(-2, -13, -4, 0, 4); cap(pel.x, pel.y, 3, -13, 5); cap(3, -13, 1, 0, 4); }
      cx.strokeStyle = 'rgba(92,107,255,.8)'; cx.lineWidth = 3; cx.beginPath(); cx.moveTo(1, -44); cx.quadraticCurveTo(-12, -42 + Math.sin(t * 9 + sd) * 4, -20, -36 + Math.sin(t * 7 + sd) * 5); cx.stroke();   // scarf (two tails)
      cx.lineWidth = 2.4; cx.beginPath(); cx.moveTo(1, -43); cx.quadraticCurveTo(-9, -37 + Math.sin(t * 8 + sd + 1.1) * 4, -15, -28 + Math.sin(t * 6 + sd + 1.1) * 5); cx.stroke();
      cap(pel.x, pel.y, sh.x, sh.y, 9);
      cx.save(); cx.translate(4, -48); cx.fillStyle = '#0d1022'; cx.strokeStyle = '#8f95ff'; cx.lineWidth = 1.2; cx.lineJoin = 'round';      // hooded head: same cowl silhouette as the real thing
      cx.beginPath(); cx.arc(0, 0, 6, 0, 7); cx.fill(); cx.stroke(); poly(cx, SHELL); cx.fill(); cx.stroke(); cx.restore();
      cx.strokeStyle = '#ff9fb8'; cx.lineWidth = 1.3; cx.beginPath(); cx.moveTo(7.6, -47.8); cx.lineTo(10.2, -47.8); cx.stroke();   // eye slit
      const blade = (hx, hy, ang) => { cx.save(); cx.translate(hx, hy); cx.rotate(ang); cx.fillStyle = '#9b1c27'; cx.strokeStyle = '#0b0f1c'; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(0, -2); cx.quadraticCurveTo(15, -14, 22, 3); cx.quadraticCurveTo(12, -4, 0, 3); cx.closePath(); cx.fill(); cx.stroke(); cx.restore(); };
      const e = (c.k || 0) * (c.k || 0) * (3 - 2 * (c.k || 0));
      const arm = (ang, el, flip) => { const [ex, ey] = dv(ang, 10), [hx, hy] = dv(ang + el, 10); cap(sh.x, sh.y, sh.x + ex, sh.y + ey, 3.6); cap(sh.x + ex, sh.y + ey, sh.x + ex + hx, sh.y + ey + hy, 3.2); blade(sh.x + ex + hx, sh.y + ey + hy, ang + el - 1.45); return [sh.x + ex + hx, sh.y + ey + hy]; };
      if(c.slash){
        const h = (c.sw ? -1 : 1), a1 = lerp(-1.3, 2.5, e), a2 = lerp(2.0, -1.0, e);
        arm(h > 0 ? a2 : a1, .5, 0); const hp = arm(h > 0 ? a1 : a2, .3, 1);
        cx.strokeStyle = 'rgba(215,210,255,' + (.75 * (1 - Math.abs(e - .5) * 1.4)) + ')'; cx.lineWidth = 3; cx.beginPath(); cx.arc(sh.x, sh.y, 24, -1.57 + (h > 0 ? a1 : a2) - .9, -1.57 + (h > 0 ? a1 : a2) + .2); cx.stroke();   // slash trail
      }else{ arm(.9, 1.1, 0); arm(.6, 1.2, 1); }
    },

    // drawn BEHIND the body: scarf, sickle blade on the far arm, hand trails while slashing, focus aura, shadow-step streak
    behind(cx, f, t, S, P){
      const A = f.A || {}, atk = f.atk > 0, v = clamp(Math.abs(f.vx) / 200, 0, 1), drag = clamp(-f.vx * f.face * .02, -6, 6);
      cx.lineCap = 'round'; cx.lineJoin = 'round';

      // scarf: two layered tails (matte-black outer, deep crimson lining) hanging from the knot at the back of the neck; hangs and sways when still, streams straight back when running.
      // Same sway / drag motion as before; the cloth also twists a little so the crimson lining shows as it moves.
      const kn = knotAt(S), white = f.flash > 0;
      [[0, 2.3, 6, [1.5 + 2.4 * v, 0]], [1.1, 1.9, 5, [1.9 + 2.4 * v, 2.3]]].forEach(([ph, hw, n, tw]) => {
        const pts = [{x:kn.x, y:kn.y}];
        for(let i = 1; i <= n; i++){
          const sway = Math.sin(t * (4 + 6 * v) - i * .9 + ph) * (.8 + 2.2 * v) * (i * .45);
          pts.push({x:kn.x - i * (1.8 + 4.6 * v) + drag * i * .25, y:kn.y + i * (3.4 * (1 - v) + .8) + sway});
        }
        ribbon(cx, pts, hw, t, tw, white);
      });

      // hand trails (bright streaks while a blade is swinging)
      const st = f.nz || (f.nz = {N:[], F:[], face:f.face});
      if(st.face !== f.face){ st.N.length = st.F.length = 0; st.face = f.face; }
      [['N', S.aN.hand], ['F', S.aF.hand]].forEach(([k, H]) => {
        const a = st[k], last = a[a.length - 1];
        if(atk && (!last || last.t !== t)) a.push({x:H.x, y:H.y, t});
        while(a.length && (t - a[0].t > .12 || !atk)) a.shift();
        if(a.length > 1 && atk) for(let i = 1; i < a.length; i++){
          const q = i / a.length;
          cx.strokeStyle = 'rgba(255,90,80,' + (.15 + .6 * q) + ')'; cx.lineWidth = 1.5 + 5 * q;
          cx.beginPath(); cx.moveTo(a[i - 1].x, a[i - 1].y); cx.lineTo(a[i].x, a[i].y); cx.stroke();
        }
      });

      // FOCUS: inward-streaming sparks + glow while ATK is held
      if(f.charging && f.chg > 0){
        const r = clamp(f.chg / (A.chargeMax || 1), 0, 1), full = r >= 1, cx0 = S.pel.x, cy0 = S.pel.y - 10;
        const g = cx.createRadialGradient(cx0, cy0, 2, cx0, cy0, 16 + 16 * r);
        g.addColorStop(0, 'rgba(210,200,255,' + (.35 + .3 * r) + ')'); g.addColorStop(1, 'rgba(92,107,255,0)');
        cx.fillStyle = g; cx.beginPath(); cx.arc(cx0, cy0, 16 + 16 * r, 0, 7); cx.fill();
        cx.fillStyle = full ? (Math.sin(t * 50) > 0 ? '#fff' : '#c9bfff') : 'rgba(190,175,255,.9)';
        for(let i = 0; i < 8 + Math.round(6 * r); i++){
          const a = t * 2.6 + i * .7, d = (1 - ((t * 1.7 + i * .13) % 1)) * 30 + 5;
          cx.beginPath(); cx.arc(cx0 + Math.cos(a) * d * .8, cy0 + Math.sin(a) * d * 1.1, 1.2, 0, 7); cx.fill();
        }
      }

      // SHADOW STEP: a streak from where he was to where he is now (arena.js sets f.blinkT / f.blinkDx)
      const age = t - (f.blinkT ?? -9);
      if(age >= 0 && age < .22){
        const k = age / .22, x0 = (f.blinkDx || 0) * f.face, y = S.pel.y - 8;
        cx.strokeStyle = 'rgba(190,175,255,' + (.8 * (1 - k)) + ')'; cx.lineWidth = 7 * (1 - k) + 1;
        cx.beginPath(); cx.moveTo(x0, y); cx.lineTo(0, y); cx.stroke();
      }
      const grip = pickGrip(f, t), grow = .55 + .45 * clamp((t - state(f).gripT) / .1, 0, 1);      // quick .1s re-form when the grip swaps
      sickle(cx, S.aF, grip, grow);
    },

    // drawn ON TOP: sickle blade on the near arm + focus meter above the head
    front(cx, f, t, S, P){
      const s = state(f), grip = s.grip || GRIP_READY, grow = .55 + .45 * clamp((t - (s.gripT ?? -9)) / .1, 0, 1), white = f.flash > 0;
      legGear(cx, S.lN, white, false);                                                           // near leg: knee panel + straps
      hood(cx, S.head, S.lean + ((f.rig && f.rig.j.head.a) || 0), white, eyeGlow(f, t), t);       // Assassin Cowl over the default head
      scarfWrap(cx, S, white);                                                                   // scarf round the neck (the tails hang from its knot, see behind())
      nearArm(cx, S, P, white);                                                                  // near arm back on top of the head / legs, with the elbow panel
      sickle(cx, S.aN, grip, grow);
      xSlash(cx, f, S);
      if(!f.charging || !(f.chg > 0)) return;
      const r = clamp(f.chg / ((f.A && f.A.chargeMax) || 1), 0, 1), x = S.head.x - 11, y = S.head.y - 12, full = r >= 1;
      cx.fillStyle = 'rgba(0,0,0,.65)'; cx.fillRect(x - 1, y - 1, 24, 5);
      cx.fillStyle = full ? (Math.sin(t * 50) > 0 ? '#fff' : '#c9bfff') : 'rgb(' + Math.round(110 + 80 * r) + ',' + Math.round(120 + 60 * r) + ',255)'; cx.fillRect(x, y, 22 * r, 3);
    }
  });
})();