// UMBRA art - THE COSMIC VOID. A colossal cosmic humanoid: not a man in dark clothes, but darkness itself in a body.
// Same shared ragdoll (body.js): only sizes, colors, poses and drawing hooks. Nothing in arena.js / body.js / main.js is changed. Hitbox is still 30x52 (visual only: he is drawn taller).
//
// LOOK (visual inspiration: the cosmic / gravitational feel of Enigma - nothing copied)
//   Body      very broad shoulders, massive thick chest, normal-sized head and arms/hands. One continuous silhouette (torso() hook): chest -> waist -> a long floating TAPER. No legs, no feet.
//   Surface   deep black with violet nebula + tiny stars UNDER the skin (two drifting texture layers clipped to the body, so it does not look like a printed costume).
//             Gravity: stars are stretched along curved lines around the chest, nebula arcs curve around invisible centers, particles orbit shoulders / chest / elbows, space is warped around him.
//   Fractures irregular dimensional cracks (deep violet light) on shoulders, chest, upper torso, forearms and the lower taper.
//   Face      smooth, featureless. Only two pupil-less pure-white eyes (the brightest permanent thing on him). No mouth / nose / ears / hood.
//   Lower     the taper narrows to a tip just above the ground; wispy shadow tendrils trail behind and dissolve into particles. The invisible ragdoll legs only decide the waist height (see below).
//   Power     f._ui (0..1, smoothed, set in behind()) = how active he is: skills, charge and casts raise it -> more distortion, particles, brighter fractures and eyes.
//
// HOW THE LEGS ARE HIDDEN (same trick as Nethros - do not change thigh.w / shin.w / foot / outline in `body`)
//   The ragdoll always has legs. Here they are invisible. They only decide how high the waist floats (H0). T + SH = leg length, YS = H0 / 21 rescales the old pose heights (Y) to the new waist height.
//
// Hooks used: body, colors, foot (none), pose() = float + glide, attack() + spring() = the 3 sphere casts + the charge, torso() = the whole cosmic body + head,
//             behind() = lensing, tendrils, back particles, front() = arm textures, hands, eyes, cast glow, shot() = flying sphere, fxBack()/fx() = claw / rift / hand.
// SETTINGS: FLOAT = how much he sways in idle (0 = none)   LAG = how late the head follows the body (0 = none)   COSMIC = strength of the nebula / stars / distortion (0 = plain black, 1 = default)
(() => {
  const FLOAT = 1, LAG = 1, COSMIC = 1;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const CP = .3;                                 // charge freeze point = chargeP in skills.js
  const T = 15, SH = 14.5;                       // invisible thigh + shin length (must match body below)
  const H0 = 28, YS = H0 / 21;                   // waist height above the ground, and the scale from the old pose heights (21) to it
  const LT = 20;                                 // torso length (must match body.torso.len)

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
  // knee angle that puts the ankle at height Y for thigh angle th, so BOTH (invisible) feet stay on the same height and the waist is exactly where we want it
  const legK = (th, Y) => { const a = Math.acos(clamp((Y - T * Math.cos(th)) / SH, -1, 1)); const k = th - a; return k > .05 ? k : th + a; };
  // pose a skill from keyframes (same format as the basic casts). Y keyframes are the old heights: they are rescaled by YS.
  const keyPose = (tg, p, s, K) => {
    ['aN', 'eN', 'aF', 'eF', 'lean', 'head', 'tN', 'tF'].forEach(j => tg[j] = K(p, s[j]));
    const Y = Math.min(K(p, s.Y) * YS, .97 * (T + SH) * Math.min(Math.cos(tg.tN), Math.cos(tg.tF)));
    tg.kN = legK(tg.tN, Y); tg.kF = legK(tg.tF, Y);
  };
  const setLegs = (tg, Y) => { const m = .97 * (T + SH) * Math.min(Math.cos(tg.tN), Math.cos(tg.tF)); tg.kN = legK(tg.tN, Math.min(Y, m)); tg.kF = legK(tg.tF, Math.min(Y, m)); };

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
    Object.assign(tg, P, {tN:.3, tF:-.3}); setLegs(tg, (ph === 3 ? 18.5 : 20) * YS);
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

  // ================= COSMIC HELPERS =================
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const interp = (tb, x) => { if(x <= tb[0][0]) return tb[0][1]; for(let i = 1; i < tb.length; i++) if(x <= tb[i][0]) return lerp(tb[i - 1][1], tb[i][1], (x - tb[i - 1][0]) / (tb[i][0] - tb[i - 1][0])); return tb[tb.length - 1][1]; };
  // body half-width. Upper body: by distance a (px) up from the waist. Lower taper: by fraction of its length.
  const UP = [[0, 7.2], [LT * .25, 9.1], [LT * .55, 11.5], [LT - 4, 12.7], [LT + 1.5, 12.3], [LT + 5.5, 8.1], [LT + 8.5, 3.6]];
  const LOW = [[0, 7.2], [.25, 6.1], [.55, 4.4], [.8, 2.6], [1, .5]];
  const HW = (a, D) => a >= 0 ? interp(UP, a) : interp(LOW, clamp(-a / D, 0, 1));

  // the cosmic texture: black space, violet nebula clouds, swirl streaks, dark voids, fine dust. Tileable (everything is drawn wrapped).
  let TEX = null;
  const getTex = () => {
    if(TEX) return TEX;
    const S = 192, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'), r = rng(20260);
    g.fillStyle = '#04020a'; g.fillRect(0, 0, S, S);
    const wrap = fn => { for(let dx = -1; dx <= 1; dx++) for(let dy = -1; dy <= 1; dy++) fn(dx * S, dy * S); };
    const PAL = [[88, 40, 210], [62, 22, 156], [122, 72, 232], [44, 14, 108], [150, 100, 245]];
    for(let i = 0; i < 17; i++){
      const x = r() * S, y = r() * S, rr = 24 + r() * 46, col = PAL[i % PAL.length], al = .1 + r() * .2;
      wrap((ox, oy) => { const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rr); gr.addColorStop(0, 'rgba(' + col + ',' + al + ')'); gr.addColorStop(1, 'rgba(' + col + ',0)'); g.fillStyle = gr; g.fillRect(x + ox - rr, y + oy - rr, rr * 2, rr * 2); });
    }
    for(let i = 0; i < 8; i++){                                            // swirl streaks: arcs that curve around invisible centers
      const x = r() * S, y = r() * S, rr = 18 + r() * 44, a0 = r() * 6.28, sp = 1 + r() * 1.5;
      g.lineWidth = 1 + r() * 2.4; g.lineCap = 'round';
      wrap((ox, oy) => { g.strokeStyle = 'rgba(160,110,255,' + (.05) + ')'; g.beginPath(); g.arc(x + ox, y + oy, rr, a0, a0 + sp); g.stroke(); });
    }
    for(let i = 0; i < 7; i++){                                            // dark voids
      const x = r() * S, y = r() * S, rr = 18 + r() * 34;
      wrap((ox, oy) => { const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rr); gr.addColorStop(0, 'rgba(0,0,0,.62)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x + ox - rr, y + oy - rr, rr * 2, rr * 2); });
    }
    for(let i = 0; i < 150; i++){ const x = r() * S, y = r() * S; g.fillStyle = 'rgba(' + (i % 3 ? '176,142,255' : '120,80,230') + ',' + (.08 + r() * .3) + ')'; g.fillRect(x, y, .7 + r() * .8, .7 + r() * .8); }
    return TEX = c;
  };
  let PAT = null;
  const getPat = cx => PAT || (PAT = cx.createPattern(getTex(), 'repeat'));

  // two texture layers drifting at different speeds = the cosmos lives UNDER the surface. (ax, ay) = anchor, rot = angle, R = how far to fill. Call inside a clip.
  const cosmic = (cx, F, ax, ay, rot, R) => {
    const t = F.t, I = F.I, pat = getPat(cx);
    cx.save(); cx.translate(ax, ay); cx.rotate(rot);
    cx.save(); cx.rotate(Math.sin(t * .33) * .1); cx.translate(t * 1.4, -t * .9); cx.scale(.55, .55); cx.fillStyle = pat; cx.fillRect(-R, -R, R * 2, R * 2); cx.restore();
    if(COSMIC > 0){ cx.save(); cx.globalCompositeOperation = 'lighter'; cx.globalAlpha = (.2 + .3 * I) * COSMIC; cx.rotate(-.35 + Math.sin(t * .27 + 1) * .12); cx.translate(-t * 2.0, t * 1.2); cx.scale(.9, .9); cx.fillStyle = pat; cx.fillRect(-R, -R, R * 2, R * 2); cx.restore(); }
    cx.fillStyle = 'rgba(2,1,6,' + (.3 - .14 * I) + ')'; cx.fillRect(-R, -R, R * 2, R * 2);
    cx.restore();
  };
  // smooth closed shape through points [{x,y}...]
  const smoothClosed = (cx, P) => {
    const n = P.length, m = (a, b) => ({x:(a.x + b.x) / 2, y:(a.y + b.y) / 2}); cx.beginPath(); const s = m(P[n - 1], P[0]); cx.moveTo(s.x, s.y);
    for(let i = 0; i < n; i++){ const q = P[i], e = m(q, P[(i + 1) % n]); cx.quadraticCurveTo(q.x, q.y, e.x, e.y); }
    cx.closePath();
  };
  // capsule (same shape as the ragdoll limb stroke) as a path
  const capPath = (cx, a, b, w) => {
    const r = w / 2, an = Math.atan2(b.y - a.y, b.x - a.x), nx = -Math.sin(an) * r, ny = Math.cos(an) * r;
    cx.beginPath(); cx.moveTo(a.x + nx, a.y + ny); cx.lineTo(b.x + nx, b.y + ny); cx.arc(b.x, b.y, r, an + Math.PI / 2, an - Math.PI / 2, true); cx.lineTo(a.x - nx, a.y - ny); cx.arc(a.x, a.y, r, an - Math.PI / 2, an + Math.PI / 2, true); cx.closePath();
  };

  // ---- STARS: fixed positions on the body. Each one is bent + stretched along a curve around a gravity center (stronger when he is powered up). ----
  const STAR_U = [], STAR_L = [], STAR_A = [];
  { const r = rng(913); for(let i = 0; i < 46; i++) STAR_U.push({a:r() * (LT + 9) - 1, v:r() * 2 - 1, ph:r() * 6.28, b:r()});
    for(let i = 0; i < 18; i++) STAR_L.push({a:-(r() * .9 + .05), v:r() * 2 - 1, ph:r() * 6.28, b:r()});
    for(let i = 0; i < 14; i++) STAR_A.push({u:r(), v:r() * 2 - 1, ph:r() * 6.28, b:r()}); }
  const star = (cx, x, y, gc, ph, b, t, I) => {
    let dx = x - gc.x, dy = y - gc.y; const d = Math.hypot(dx, dy) + .01, pull = Math.exp(-d / 30) * (1 + I * 1.1) * COSMIC;
    const ang = .26 * pull;                                                  // swirl the position a little around the center
    const ca = Math.cos(ang), sa = Math.sin(ang), px = gc.x + dx * ca - dy * sa, py = gc.y + dx * sa + dy * ca;
    const tx = -dy / d, ty = dx / d, len = .5 + 3.2 * pull + (b > .8 ? 1 : 0);   // tangent = stretch direction
    const tw = .5 + .4 * Math.sin(t * 1.6 + ph), big = b > .85;
    cx.strokeStyle = 'rgba(' + (b > .5 ? '226,214,255' : '170,140,255') + ',' + (tw * (big ? .7 : .5)) + ')'; cx.lineWidth = big ? 1.1 : .8; cx.lineCap = 'round';
    cx.beginPath(); cx.moveTo(px - tx * len, py - ty * len); cx.lineTo(px + tx * len, py + ty * len); cx.stroke();
  };

  // ---- DIMENSIONAL FRACTURES: jagged branching cracks. Points are [along, side]: torso = (px from the waist, -1..1 of the half width), lower taper = (-fraction of the taper, side), limbs = (0..1 along, -1..1 across). ----
  const crack = (r, c0, v0, dir, n, sc, sv, br) => {
    const pts = [[c0, v0]]; let c = c0, v = v0;
    for(let i = 0; i < n; i++){ c += dir * sc * (.55 + .9 * r()); v = clamp(v + (r() - .5) * sv, -.96, .96); pts.push([c, v]); }
    const out = [pts];
    if(br) for(let k = 0; k < br; k++){ const i = 2 + Math.floor(r() * (n - 3)); out.push(...crack(r, pts[i][0], pts[i][1], dir * (r() < .3 ? -1 : 1), Math.max(2, Math.round(n * .45)), sc * .8, sv * 1.1, 0)); }
    return out;
  };
  const CR_T = [], CR_L = [], CR_NF = [], CR_FF = [], CR_NU = [];
  { const r = rng(4417);
    CR_T.push(...crack(r, LT + 3, .72, -1, 5, 2.0, .2, 1));         // front shoulder
    CR_T.push(...crack(r, LT + 1, -.78, -1, 5, 1.9, .2, 1));        // back shoulder
    CR_T.push(...crack(r, LT * .8, .25, -1, 7, 2.1, .22, 2));       // chest: the big one
    CR_T.push(...crack(r, LT + 5, -.15, -1, 4, 1.7, .26, 0));       // upper torso / collar
    CR_T.push(...crack(r, LT * .42, -.5, -1, 5, 2.0, .24, 1));      // mid torso
    CR_L.push(...crack(r, -.08, .22, -1, 5, .1, .22, 1));           // lower taper
    CR_L.push(...crack(r, -.4, -.3, -1, 4, .1, .25, 0));
    CR_NF.push(...crack(r, .1, .1, 1, 5, .15, .35, 1));             // near forearm
    CR_FF.push(...crack(r, .15, -.1, 1, 5, .14, .35, 1));           // far forearm
    CR_NU.push(...crack(r, .0, -.3, 1, 4, .14, .35, 0)); }          // near upper arm / shoulder
  const strokeCrack = (cx, P, glow) => {
    cx.lineJoin = 'round'; cx.lineCap = 'round';
    const path = () => { cx.beginPath(); P.forEach((q, i) => i ? cx.lineTo(q.x, q.y) : cx.moveTo(q.x, q.y)); };
    path(); cx.strokeStyle = 'rgba(80,30,220,' + (.16 * glow) + ')'; cx.lineWidth = 3; cx.stroke();
    path(); cx.strokeStyle = 'rgba(112,58,240,' + (.5 * glow) + ')'; cx.lineWidth = 1.3; cx.stroke();
    path(); cx.strokeStyle = 'rgba(150,100,255,' + (.42 * glow) + ')'; cx.lineWidth = .5; cx.stroke();
  };

  // ---- ORBITING PARTICLES (centers: 0 near shoulder, 1 far shoulder, 2 chest, 3 near elbow, 4 far elbow, 5 above the head) ----
  const ORB = [];
  { const r = rng(77); for(let i = 0; i < 16; i++) ORB.push({c:i % 6, rx:9 + r() * 13, ry:5 + r() * 10, sp:(.7 + r() * 1.1) * (r() < .5 ? -1 : 1), ph:r() * 6.28, sz:.7 + r() * .9, tilt:(r() - .5) * 1.2, vis:r()}); }
  const orbDraw = (cx, F, front) => {
    if(COSMIC <= 0) return;
    const S = F.S, t = F.t, I = F.I, cs = [S.aN.s, S.aF.s, F.at(F.L * .5, 0), S.aN.el, S.aF.el, F.at(F.L + 14, 0)];
    ORB.forEach(o => {
      const ph = (t * .17 + o.vis) % 1, thr = .5 + .4 * I; if(ph >= thr) return;
      const al = Math.min(1, ph * 8, (thr - ph) * 8) * (.5 + .4 * I), a = o.ph + t * o.sp * (1 + I * 1.3), k = 1 + I * .35;
      const z = Math.sin(a); if((z >= 0) !== front) return;
      const ex = Math.cos(a) * o.rx * k, ey = Math.sin(a) * o.ry * k, ct = Math.cos(o.tilt), st = Math.sin(o.tilt), c = cs[o.c];
      const x = c.x + ex * ct - ey * st - F.trail * .5, y = c.y + ex * st + ey * ct;
      cx.fillStyle = 'rgba(205,182,255,' + (al * .35) + ')'; cx.beginPath(); cx.arc(x - Math.sin(a) * -1.4 * o.sp * .6, y, o.sz * .8, 0, 7); cx.fill();
      cx.fillStyle = 'rgba(214,194,255,' + al + ')'; cx.beginPath(); cx.arc(x, y, o.sz * (1 + I * .4), 0, 7); cx.fill();
    });
  };

  // ---- per-frame geometry. at(a, b): a = px up the torso from the waist (negative = down the taper), b = px forward (+) / back (-). ----
  const power = (f, t) => {
    let tg = 0; const A = f.A;
    if(f.atk > 0 && A){ if(A.skill) tg = 1; else if(A.chg > 0 || f.charging) tg = .55 + .4 * clamp((f.chg || 0) / 1.2, 0, 1); else tg = .3; }
    else if(f.charging) tg = .5 + .4 * clamp((f.chg || 0) / 1.2, 0, 1);
    if(f.vclaw && f.vclaw.d && f.vclaw.t < (f.vclaw.d.cast || .45) + (f.vclaw.d.swipe || .18) + .3) tg = Math.max(tg, .85);
    if(f.uhand && f.uhand.t < f.uhand.total) tg = Math.max(tg, .9);
    if(f.afterimg) tg = Math.max(tg, .6);
    const last = f._ut == null ? t : f._ut, dt = clamp(t - last, 0, .05); f._ut = t;
    const cur = f._ui || 0; return f._ui = cur + (tg - cur) * Math.min(1, dt * (tg > cur ? 9 : 3.5));
  };
  const frame = (S, f, t) => {
    const pel = S.pel, sh = S.sh, L = Math.hypot(sh.x - pel.x, sh.y - pel.y) || LT;
    const u = {x:(sh.x - pel.x) / L, y:(sh.y - pel.y) / L}, p = {x:-u.y, y:u.x};
    const D = Math.max(10, -pel.y - 3), trail = clamp(f.vx * f.face * .05, -6, 12);
    const F = {S, f, t, pel, sh, L, u, p, D, trail, I:f._ui || 0};
    F.at = (a, b) => {
      if(a >= 0) return {x:pel.x + u.x * a + p.x * b, y:pel.y + u.y * a + p.y * b};
      const d = -a, k = clamp(d / D, 0, 1.2);
      return {x:pel.x + b - trail * .7 * Math.pow(k, 1.6) + Math.sin(t * 1.5 + d * .12) * 1.2 * k, y:pel.y + d};
    };
    F.atv = (a, v) => { const aa = a < 0 && a > -1.001 ? -a * D * -1 : a; return F.at(aa, v * HW(aa, D)); };   // v = -1..1 of the half width. a in (-1, 0) = fraction of the taper
    return F;
  };
  const crackMap = (F, pts) => pts.map(q => F.atv(q[0], q[1]));
  const limbMap = (a, b, w, pts) => { const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l; return pts.map(q => ({x:a.x + dx * q[0] + nx * q[1] * w * .5, y:a.y + dy * q[0] + ny * q[1] * w * .5})); };

  // fingers: normal-sized, small. They fan out from the hand along the forearm direction.
  const fingers = (cx, el, h) => {
    const a = Math.atan2(h.y - el.y, h.x - el.x); cx.lineCap = 'round';
    [-.55, -.18, .2, .56].forEach((o, i) => {
      const L = [2.8, 3.8, 3.6, 2.6][i], aa = a + o * .9, sx = h.x + Math.cos(a) * 1.1, sy = h.y + Math.sin(a) * 1.1, ex = sx + Math.cos(aa) * L, ey = sy + Math.sin(aa) * L;
      cx.beginPath(); cx.moveTo(sx, sy); cx.lineTo(ex, ey); cx.strokeStyle = 'rgba(130,90,240,.5)'; cx.lineWidth = 2.4; cx.stroke();
      cx.beginPath(); cx.moveTo(sx, sy); cx.lineTo(ex, ey); cx.strokeStyle = '#07030d'; cx.lineWidth = 1.4; cx.stroke();
    });
  };
  // one arm: both segments textured (clipped to the same capsules the ragdoll draws), stars, fractures, a thin violet rim, small hand + fingers
  const armCosmic = (cx, F, A, uw, fw, hr, crU, crF, seed) => {
    const I = F.I, t = F.t;
    [[A.s, A.el, uw, crU, 0], [A.el, A.hand, fw, crF, 1]].forEach(([a, b, w, cr, k]) => {
      cx.save(); capPath(cx, a, b, w); cx.clip();
      cosmic(cx, F, a.x, a.y, Math.atan2(b.y - a.y, b.x - a.x), 120);
      const gc = {x:(a.x + b.x) / 2 + 3, y:(a.y + b.y) / 2 - 4};
      STAR_A.forEach((s, i) => { if(i % 2 === k) star(cx, lerp(a.x, b.x, s.u) + (-(b.y - a.y) / 11) * s.v * w * .08, lerp(a.y, b.y, s.u) + ((b.x - a.x) / 11) * s.v * w * .08, gc, s.ph + seed, s.b, t, I); });
      if(cr && COSMIC > 0) cr.forEach(c => strokeCrack(cx, limbMap(a, b, w, c), clamp(.5 + .2 * Math.sin(t * 1.7 + seed) + .5 * I, 0, 1.2)));
      cx.restore();
      cx.save(); capPath(cx, a, b, w); cx.strokeStyle = 'rgba(150,100,255,.3)'; cx.lineWidth = .9; cx.stroke(); cx.restore();
    });
    const h = A.hand; cx.save(); cx.beginPath(); cx.arc(h.x, h.y, hr, 0, 7); cx.clip(); cosmic(cx, F, h.x, h.y, 0, 40); cx.restore();
    cx.strokeStyle = 'rgba(150,100,255,.3)'; cx.lineWidth = .9; cx.beginPath(); cx.arc(h.x, h.y, hr, 0, 7); cx.stroke();
    fingers(cx, A.el, h);
  };
  const ARM = {uw:6.4, fw:5.6, hr:3.2};                                    // must match body below

  // ---- the shadow tendrils of the lower body. Each is a ribbon that trails back, ends in dissolving particles. front = the 2 short ones drawn over the taper. ----
  const tendrils = (cx, F, front) => {
    const f = F.f, t = F.t, I = F.I, trail = F.trail, lift = clamp((f.vy || 0) * .02, -8, 8);
    (front ? [7, 8] : [0, 1, 2, 3, 4, 5, 6]).forEach(i => {
      const aa = -(.08 + i * .075) * F.D, base = F.at(aa, (i % 2 ? -.55 : .55) * HW(aa, F.D)), reach = (front ? 9 : 11 + (i % 4) * 3.5 + i * .8) * (1 + I * .25), drop = 5 + (i % 3) * 4, M = 10, pts = [];
      for(let m = 0; m <= M; m++){
        const s = m / M;
        const x = base.x - s * reach - trail * s * s * 1.2 * (front ? .6 : 1) + Math.sin(t * 1.3 + i * 1.7 + s * 3) * 1.2 * s;
        let y = base.y + s * drop + Math.sin(t * 1.6 + i * 1.9 + s * 3.4) * (.8 + 3.2 * s) * (1 + I * .3) - lift * s;
        y = Math.min(y, -.8);
        pts.push({x, y, s});
      }
      const wd = (3.4 - (i % 3) * .6) * (front ? .8 : 1), L = [], R = [];
      pts.forEach((q, m) => { const a = pts[Math.max(0, m - 1)], b = pts[Math.min(M, m + 1)], dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1, w = wd * Math.pow(1 - q.s, .85) + .25; L.push({x:q.x - dy / l * w, y:q.y + dx / l * w}); R.push({x:q.x + dy / l * w, y:q.y - dx / l * w}); });
      const g = cx.createLinearGradient(base.x, 0, base.x - reach, 0);
      g.addColorStop(0, 'rgba(7,3,14,' + (front ? .55 : .95) + ')'); g.addColorStop(.6, 'rgba(26,9,58,' + (front ? .35 : .6) + ')'); g.addColorStop(1, 'rgba(60,24,130,0)');
      cx.beginPath(); L.forEach((q, m) => m ? cx.lineTo(q.x, q.y) : cx.moveTo(q.x, q.y)); for(let m = M; m >= 0; m--) cx.lineTo(R[m].x, R[m].y); cx.closePath(); cx.fillStyle = g; cx.fill();
      if(!front){
        cx.beginPath(); L.forEach((q, m) => m ? cx.lineTo(q.x, q.y) : cx.moveTo(q.x, q.y)); cx.strokeStyle = 'rgba(140,90,245,.3)'; cx.lineWidth = .7; cx.stroke();
        [.3, .62].forEach((s, k) => { const q = pts[Math.round(s * M)]; cx.fillStyle = 'rgba(120,60,230,' + (.2 * (1 - s)) + ')'; cx.beginPath(); cx.arc(q.x, q.y, 2.4 - k * .6, 0, 7); cx.fill(); });   // nebula inside the tendril
        const tip = pts[M];
        for(let k = 0; k < 5; k++){ const u = (t * .5 + i * .13 + k / 5) % 1; cx.fillStyle = 'rgba(176,130,255,' + ((1 - u) * .65) + ')'; cx.beginPath(); cx.arc(tip.x - u * 14 - trail * u + Math.sin(t * 2 + i + k) * 1.4, tip.y - u * 6 - Math.abs(Math.sin(i + k)) * 3 * u, 1.15 - u * .5, 0, 7); cx.fill(); }   // dissolves into particles
      }
    });
  };

  // a dark shadow copy of him (the Shadow Step afterimage): same colossal silhouette
  const ghost = (cx, x, y, face, a, t) => {
    const P = [[-1, -3], [4.5, -12], [7, -22], [11, -32], [12.5, -43], [8, -52.5], [0, -54.5], [-8, -52.5], [-12.5, -43], [-11, -32], [-7.5, -22], [-5, -12]].map(q => ({x:q[0], y:q[1]}));
    cx.save(); cx.translate(x, y); cx.scale(face, 1); cx.globalAlpha = a;
    for(let i = 0; i < 5; i++){ cx.fillStyle = 'rgba(106,60,255,' + (.25 - i * .04) + ')'; cx.beginPath(); cx.ellipse(-6 - i * 5, -18 + Math.sin(t * 3 + i) * 4 - i * 2, 7 - i, 3.4, .3, 0, 7); cx.fill(); }
    smoothClosed(cx, P); cx.fillStyle = '#0a0516'; cx.strokeStyle = '#8f6bff'; cx.lineWidth = 1.2; cx.fill(); cx.stroke();
    cx.fillStyle = '#0a0516'; cx.beginPath(); cx.arc(2, -58.8, 6.8, 0, 7); cx.fill(); cx.stroke();
    cx.fillStyle = '#fff'; cx.beginPath(); cx.ellipse(2.6, -59.8, 2.4, 1.3, -.15, 0, 7); cx.fill(); cx.beginPath(); cx.ellipse(6.4, -60, 1.4, 1.1, -.15, 0, 7); cx.fill();
    cx.restore();
  };

  Characters.art('umbra', {
    // COLOSSAL: broad shoulders + massive chest (torso 22 wide), normal head and normal arms / hands, about 30% taller than the others. Legs are invisible (see the top of this file).
    body: {head:{r:6.8}, torso:{len:LT, w:22}, uArm:{len:11.5, w:ARM.uw}, fArm:{len:11, w:ARM.fw}, hand:{r:ARM.hr},
           thigh:{len:T, w:.01}, shin:{len:SH, w:.01}, foot:{len:1, w:.01},
           headSink:3, shN:6, shF:-7, belt:.1, noRings:true, outline:'rgba(0,0,0,0)', outlineW:0},
    colors: {shirt:'rgba(0,0,0,0)', limb:'#0b0616', far:'#07030f', head:'rgba(0,0,0,0)', dark:'rgba(0,0,0,0)', hand:'#08040f', legs:'rgba(0,0,0,0)', legsFar:'rgba(0,0,0,0)'},

    foot(){},                                                       // no feet
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
        const Y = Math.min((20.5 - 1.8 * L) * YS, .97 * (T + SH) * Math.min(Math.cos(tg.tN), Math.cos(tg.tF)));
        tg.kN = legK(tg.tN, Y); tg.kF = legK(tg.tF, Y); return;
      }
      const s = A.chg > 0 && A.cl > 0 ? THROW : STEP[A.step || 0];      // released with enough charge = the big throw, else the normal cast
      keyPose(tg, p, s, K);
    },

    // idle = slow float, almost still. moving = he GLIDES (no steps): leans in, arms trail behind. The head and arms arrive a bit late (LAG). The waist height is held (legs are invisible).
    pose(tg, f, t, run, K){
      const s = Math.sin(t * 1.3) * FLOAT, s2 = Math.sin(t * 1.3 - .9 * LAG) * FLOAT, idle = 1 - run;
      tg.lean = .05 + idle * s * .05 + run * .15;
      tg.head = idle * s2 * .09 - run * .1 * LAG;
      tg.aN = idle * (.15 + s2 * .1) + run * -.45;   tg.eN = idle * .7 + run * .35;
      tg.aF = idle * (-.1 - s2 * .1) + run * -.8;    tg.eF = idle * .7 + run * .3;
      tg.tN = .04; tg.tF = -.04;
      const Y = Math.min(H0 + s * 1.3, .985 * (T + SH)); tg.kN = legK(tg.tN, Y); tg.kF = legK(tg.tF, Y);
    },

    // BEHIND the body: the warped space around him, back particles, the shadow tendrils. Also builds this frame's geometry + power for torso() / front().
    behind(cx, f, t, S, P){
      power(f, t); const F = S._F = frame(S, f, t), I = F.I;
      if(f.flash > 0) return;
      if(COSMIC > 0){
        const c = F.at(F.L * .55, 0), R = 34 + I * 12;                                  // gravitational halo + lensing arcs
        const g = cx.createRadialGradient(c.x, c.y, 6, c.x, c.y, R); g.addColorStop(0, 'rgba(70,25,170,' + (.09 + .12 * I) + ')'); g.addColorStop(1, 'rgba(70,25,170,0)');
        cx.fillStyle = g; cx.beginPath(); cx.arc(c.x, c.y, R, 0, 7); cx.fill();
        for(let j = 0; j < 3; j++){
          const rr = 25 + j * 7 + Math.sin(t * 1.1 + j * 2) * 1.6 * (1 + I * 2), a0 = t * (.35 + .1 * j) * (j % 2 ? -1 : 1) + j * 2.1;
          cx.strokeStyle = 'rgba(170,125,255,' + (.07 + .1 * I) + ')'; cx.lineWidth = 1; cx.beginPath(); cx.ellipse(c.x, c.y, rr * .85, rr * 1.12, .1, a0, a0 + 1.1 + .4 * I); cx.stroke();
        }
        if(I > .2) for(let j = 0; j < 2; j++){ const k = (t * .9 + j / 2) % 1; cx.strokeStyle = 'rgba(160,110,255,' + ((1 - k) * .28 * I) + ')'; cx.lineWidth = 1.2; cx.beginPath(); cx.ellipse(c.x, c.y, 18 + k * 30, 22 + k * 36, 0, 0, 7); cx.stroke(); }   // ripples while powered
      }
      tendrils(cx, F, false);
      orbDraw(cx, F, false);
    },

    // THE WHOLE COSMIC BODY: far arm (when it is behind), one continuous silhouette chest -> waist -> taper, the nebula / stars / fractures inside it, then the head.
    torso(cx, S, B, P, white){
      const F = S._F; if(!F) return;
      const f = F.f, t = F.t, I = F.I, D = F.D, L = F.L;
      if(!white && !(f.atk > 0 && ((f.A && f.A.step) >= 1 || (f.A && f.A.chg > 0) || (f.A && f.A.skill === 'abysshand')))){     // far arm behind the body (same test as farFront above)
        armCosmic(cx, F, S.aF, ARM.uw, ARM.fw, ARM.hr, null, CR_FF, 3);
      }
      const fr = [-.8 * D, -.55 * D, -.28 * D, 0, L * .25, L * .55, L - 4, L + 1.5, L + 5.5];
      const front = fr.map(a => F.at(a, HW(a, D))), back = fr.map(a => F.at(a, -HW(a, D) * 1.04)).reverse();
      const pts = [F.at(-.97 * D, 0)].concat(front, [F.at(L + 8.5, 0)], back);
      smoothClosed(cx, pts);
      if(white){ cx.fillStyle = '#fff'; cx.fill(); }
      else {
        cx.fillStyle = '#05030a'; cx.fill();
        cx.save(); cx.clip();
        const mid = F.at(L * .4, 0), ang = Math.atan2(F.u.y, F.u.x) + Math.PI / 2;
        cosmic(cx, F, mid.x, mid.y, ang * .25, 230);
        const gc = F.at(L * .58, 1.5), gc2 = F.at(L + 1, 6), gc3 = F.at(-D * .3, 0);   // invisible gravity centers: chest, front shoulder, taper
        if(COSMIC > 0){
          for(const [gcc, k0] of [[gc, 0], [gc2, 1], [gc3, 2]]) for(let j = 0; j < 4; j++){                 // nebula arcs curve around them
            const rr = 6 + j * 7 + k0 * 2 + I * 3, a0 = t * (.5 + .2 * j) * (j % 2 ? -1 : 1) + j * 1.7 + k0;
            cx.strokeStyle = 'rgba(165,120,255,' + ((.09 + .15 * I) * COSMIC) + ')'; cx.lineWidth = 1.1; cx.beginPath(); cx.arc(gcc.x, gcc.y, rr, a0, a0 + 1.3 + .3 * j); cx.stroke();
          }
          STAR_U.forEach(s => { const q = F.atv(s.a, s.v); star(cx, q.x, q.y, gc, s.ph, s.b, t, I); });
          STAR_L.forEach(s => { const q = F.atv(s.a, s.v); star(cx, q.x, q.y, gc3, s.ph, s.b, t, I); });
          const gl = .42 + .16 * Math.sin(t * 1.7) + .55 * I;                                                // fractures: pulse, brighter when powered
          CR_T.forEach((c, i) => strokeCrack(cx, crackMap(F, c), clamp(gl + Math.sin(t * 2.3 + i) * .1, 0, 1.2)));
          CR_L.forEach((c, i) => strokeCrack(cx, crackMap(F, c.map(q => [q[0] * 1, q[1]])), clamp(gl - .05, 0, 1.2)));
          if(I > .05){ const g = cx.createRadialGradient(gc.x, gc.y, 2, gc.x, gc.y, 30); g.addColorStop(0, 'rgba(110,50,240,' + (.28 * I) + ')'); g.addColorStop(1, 'rgba(110,50,240,0)'); cx.fillStyle = g; cx.fillRect(gc.x - 32, gc.y - 32, 64, 64); }
        }
        cx.restore();
        smoothClosed(cx, pts); cx.strokeStyle = 'rgba(150,100,255,.22)'; cx.lineWidth = 1; cx.stroke();      // the thin violet rim = the readable silhouette
      }
      // HEAD: smooth, featureless. (The default head that body.js draws after this is transparent, white only on a hit flash.)
      const h = S.head, hr = B.head.r;
      cx.beginPath(); cx.arc(h.x, h.y, hr, 0, 7);
      if(white) cx.fillStyle = '#fff'; else cx.fillStyle = '#040208';
      cx.fill();
      if(!white){
        cx.save(); cx.beginPath(); cx.arc(h.x, h.y, hr, 0, 7); cx.clip();
        cosmic(cx, F, h.x, h.y, 0, 60);
        if(COSMIC > 0) for(let i = 0; i < 6; i++){ const s = STAR_U[i * 7]; star(cx, h.x + (s.v) * hr * .8, h.y + (s.a / (LT + 9) * 2 - 1) * hr * .8, {x:h.x - 1, y:h.y + 4}, s.ph, s.b, t, I); }
        const sh2 = cx.createRadialGradient(h.x - 1.5, h.y - 1.5, 1, h.x, h.y, hr); sh2.addColorStop(0, 'rgba(0,0,0,.0)'); sh2.addColorStop(1, 'rgba(0,0,0,.45)'); cx.fillStyle = sh2; cx.fillRect(h.x - hr, h.y - hr, hr * 2, hr * 2);
        cx.restore();
        cx.strokeStyle = 'rgba(150,100,255,.3)'; cx.lineWidth = .9; cx.beginPath(); cx.arc(h.x, h.y, hr, 0, 7); cx.stroke();
      }
    },

    // ON TOP: arm textures + hands, front particles / wisps, the two white EYES, then the cast glow and the charge sphere.
    front(cx, f, t, S, P){
      // tell arena.js where the hands are in the world, so the sphere leaves the real hand
      f.handW = {N:{x:f.x + f.face * S.aN.hand.x, y:f.y + S.aN.hand.y}, F:{x:f.x + f.face * S.aF.hand.x, y:f.y + S.aF.hand.y}};
      const F = S._F, I = f._ui || 0;
      if(F && !(f.flash > 0)){
        const farFront = f.atk > 0 && (((f.A && f.A.step) || 0) >= 1 || (f.A && f.A.chg > 0) || (f.A && f.A.skill === 'abysshand'));
        tendrils(cx, F, true);
        if(farFront) armCosmic(cx, F, S.aF, ARM.uw, ARM.fw, ARM.hr, null, CR_FF, 3);
        armCosmic(cx, F, S.aN, ARM.uw, ARM.fw, ARM.hr, CR_NU, CR_NF, 1);
        orbDraw(cx, F, true);

        // ---- EYES: two pupil-less pure-white eyes on a black face (3/4 view: near eye bigger, far eye narrower). Brighter when powered up. ----
        const h = S.head, ha = S.lean + (f.rig ? f.rig.j.head.a : 0), ca = Math.cos(ha), sa = Math.sin(ha);
        const at = (x, y) => ({x:h.x + x * ca - y * sa, y:h.y + x * sa + y * ca});
        const e1 = at(-.5, -.9), e2 = at(4.5, -1.1), br = .5 + .5 * I;
        const trail = Math.min(12, 3 + Math.abs(f.vx) * .04);                                         // a faint light streak behind the eyes when he moves
        const gt = cx.createLinearGradient(e1.x, e1.y, e1.x - trail, e1.y - 1); gt.addColorStop(0, 'rgba(235,225,255,' + (.5 * Math.min(1, Math.abs(f.vx) / 80)) + ')'); gt.addColorStop(1, 'rgba(235,225,255,0)');
        cx.fillStyle = gt; cx.beginPath(); cx.moveTo(e1.x, e1.y - 1.2); cx.lineTo(e1.x - trail, e1.y - 2); cx.lineTo(e1.x - trail, e1.y); cx.lineTo(e1.x, e1.y + 1.2); cx.fill();
        [[e1, 1.9, 1.15, 6], [e2, 1.1, .95, 4.6]].forEach(([e, rx, ry, glowR]) => {
          const g = cx.createRadialGradient(e.x, e.y, 0, e.x, e.y, glowR * (1 + .45 * I)); g.addColorStop(0, 'rgba(255,255,255,' + (.2 + .14 * br) + ')'); g.addColorStop(.4, 'rgba(225,210,255,' + (.04 + .07 * br) + ')'); g.addColorStop(1, 'rgba(200,180,255,0)');
          cx.fillStyle = g; cx.beginPath(); cx.arc(e.x, e.y, glowR * (1 + .45 * I), 0, 7); cx.fill();
          cx.fillStyle = '#ffffff'; cx.beginPath(); cx.ellipse(e.x, e.y, rx * (1 + .1 * I), ry * (1 + .12 * I), ha - .16, 0, 7); cx.fill();
        });
      }

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