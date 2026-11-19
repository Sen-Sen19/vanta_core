// FULMINAR art - The Stormforged.
// Female, agile lightning warrior wielding Dual Lightning Blades.
// Focus: Extreme speed, chain attacks, electrifying combos, and crackling lightning traveling between both blades.
(() => {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const state = f => f.fxState || (f.fxState = {air:false, vy:0, pvy:0, t0:0, landT:-9, dip:0, face:f.face, turnT:-9});

  // READY Stance (dual blades held in an agile, dynamic guard)
  const G0 = {lean:.12, aN:.65, eN:1.45, aF:.38, eF:1.55, tN:.28, kN:.34, tF:-.22, kF:.28};
  const R = .30, C = .58, O = C + .1, S = C + .3;
  const M = C - .04, E = O + .04;

  const chopA = (a0, v) => [[0, a0], [.08, lerp(a0, v[0], .4)], [R, v[0]], [M, v[1]], [E, v[2]], [S, v[2] - .1], [1, a0]];
  const chopE = (e0, v) => [[0, e0], [R, v[0]], [M, v[1]], [E, v[2]], [S, v[2] + .2], [1, e0]];

  // COMBO POSES (5 Hits):
  // 1: Volt Slash (Near blade diagonal down-cut)
  // 2: Storm Undercut (Far blade rising slash from low)
  // 3: Twin Cross Cleave (Both blades slice inward in a scissor X)
  // 4: Tempest Flurry (Rapid piercing dual thrusts)
  // 5: Thunderfall Slam (Aerial leap & overhead twin-blade slam)
  const mkHit = (lead, v) => {
    const off = lead === 'N' ? 'F' : 'N';
    return {
      lead,
      aLead: chopA(G0['a' + lead], v.a),
      eLead: chopE(G0['e' + lead], v.e),
      aOff:  chopA(G0['a' + off], v.a2),
      eOff:  chopE(G0['e' + off], v.e2),
      lean:  [[0, G0.lean], [R, v.lL], [M, v.lC - .08], [E, v.lC + .08], [S, v.lC], [1, G0.lean]],
      tN:    [[0, G0.tN], [R, .45], [C, v.tN || .8], [S, .45], [1, G0.tN]],
      kN:    [[0, G0.kN], [R, .9], [C, v.kN || .45], [S, .5], [1, G0.kN]],
      tF:    [[0, G0.tF], [R, -.45], [C, v.tF || -.5], [1, G0.tF]],
      kF:    [[0, G0.kF], [R, .4], [C, v.kF || .2], [1, G0.kF]]
    };
  };

  const COMBO = [
    // 1: Volt Slash (Near blade down-cut)
    mkHit('N', {a:[2.8, 2.2, .75], e:[.45, .3, .25], a2:[.8, .5, .35], e2:[1.6, 1.7, 1.7], lL:-.08, lC:.38}),
    // 2: Storm Undercut (Far blade rising cut)
    mkHit('F', {a:[-.9, -.15, 2.6], e:[1.2, .65, .25], a2:[.8, .45, .3], e2:[1.6, 1.7, 1.7], lL:-.15, lC:.35}),
    // 3: Twin Cross Cleave (both blades cross inward)
    mkHit('N', {a:[1.9, 1.4, .6], e:[.8, .3, .2], a2:[1.8, 1.3, .5], e2:[.9, .35, .25], lL:-.2, lC:.48}),
    // 4: Tempest Flurry (rapid dual thrust)
    mkHit('F', {a:[.2, 1.55, 1.5], e:[1.5, .2, .15], a2:[.3, 1.45, 1.4], e2:[1.4, .25, .2], lL:-.1, lC:.42}),
    // 5: Thunderfall Slam (jump & crash down)
    mkHit('N', {a:[3.1, 2.7, .65], e:[.35, .25, .2], a2:[3.0, 2.6, .6], e2:[.4, .3, .25], lL:-.25, lC:.55, tN:.6, kN:1.1, tF:.1, kF:.9})
  ];

  // Helper for generating jagged lightning coordinates
  function getLightningPath(x0, y0, x1, y1, segments, roughness, seed) {
    const dx = x1 - x0, dy = y1 - y0, dist = Math.hypot(dx, dy) || 1;
    const nx = -dy / dist, ny = dx / dist;
    const pts = [{x: x0, y: y0}];
    for(let i = 1; i < segments; i++){
      const k = i / segments;
      const s = Math.sin(seed * 19.3 + i * 4.7) * Math.cos(seed * 31.1 - i * 2.3);
      const disp = s * roughness;
      pts.push({x: x0 + dx * k + nx * disp, y: y0 + dy * k + ny * disp});
    }
    pts.push({x: x1, y: y1});
    return pts;
  }

  function strokeLightning(cx, pts, colOuter, colCore, lwOuter, lwCore) {
    if(pts.length < 2) return;
    cx.beginPath();
    cx.moveTo(pts[0].x, pts[0].y);
    for(let i = 1; i < pts.length; i++) cx.lineTo(pts[i].x, pts[i].y);
    cx.strokeStyle = colOuter; cx.lineWidth = lwOuter; cx.stroke();
    cx.beginPath();
    cx.moveTo(pts[0].x, pts[0].y);
    for(let i = 1; i < pts.length; i++) cx.lineTo(pts[i].x, pts[i].y);
    cx.strokeStyle = colCore; cx.lineWidth = lwCore; cx.stroke();
  }

  // Draw one Lightning Blade
  // A = arm joint {s, el, hand}. isFar = boolean.
  function drawBlade(cx, A, t, isFar, charging, chgLvl) {
    const dx = A.hand.x - A.el.x, dy = A.hand.y - A.el.y;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d, uy = dy / d;
    const nx = -uy, ny = ux;

    const hx = A.hand.x, hy = A.hand.y;
    // Blade direction: angled slightly outward for a dynamic fighting stance
    const ang = isFar ? -.12 : .12;
    const cosA = Math.cos(ang), sinA = Math.sin(ang);
    const bx = ux * cosA - nx * sinA, by = uy * cosA - ny * sinA;
    const bnx = -by, bny = bx;

    const bladeLen = 22, bladeW = 4.2;
    const tipX = hx + bx * bladeLen, tipY = hy + by * bladeLen;
    const midX = hx + bx * (bladeLen * .5), midY = hy + by * (bladeLen * .5);

    // 1. Guard / Crossguard
    cx.fillStyle = '#0d1726';
    cx.strokeStyle = '#00e5ff';
    cx.lineWidth = .9;
    const g1x = hx + bnx * 4.5, g1y = hy + bny * 4.5;
    const g2x = hx - bnx * 4.5, g2y = hy - bny * 4.5;
    cx.beginPath();
    cx.moveTo(g1x, g1y); cx.lineTo(g2x, g2y);
    cx.lineWidth = 2.2; cx.stroke();

    // Guard electric nodes
    cx.fillStyle = '#ffffff';
    cx.beginPath(); cx.arc(g1x, g1y, 1.0, 0, 7); cx.arc(g2x, g2y, 1.0, 0, 7); cx.fill();

    // 2. Dual Lightning Blade body (Sleek crystal lightning blade)
    const baseL = {x: hx + bnx * (bladeW * .5), y: hy + bny * (bladeW * .5)};
    const baseR = {x: hx - bnx * (bladeW * .5), y: hy - bny * (bladeW * .5)};
    const edgeL = {x: midX + bnx * (bladeW * .65), y: midY + bny * (bladeW * .65)};
    const edgeR = {x: midX - bnx * (bladeW * .65), y: midY - bny * (bladeW * .65)};

    // Outer glow
    cx.beginPath();
    cx.moveTo(baseL.x, baseL.y);
    cx.lineTo(edgeL.x, edgeL.y);
    cx.lineTo(tipX, tipY);
    cx.lineTo(edgeR.x, edgeR.y);
    cx.lineTo(baseR.x, baseR.y);
    cx.closePath();
    cx.fillStyle = 'rgba(0, 229, 255, 0.45)';
    cx.fill();

    // Inner blade core
    cx.beginPath();
    cx.moveTo(hx + bnx * 1.2, hy + bny * 1.2);
    cx.lineTo(midX + bnx * 1.4, midY + bny * 1.4);
    cx.lineTo(tipX, tipY);
    cx.lineTo(midX - bnx * 1.4, midY - bny * 1.4);
    cx.lineTo(hx - bnx * 1.2, hy - bny * 1.2);
    cx.closePath();
    cx.fillStyle = '#e0faff';
    cx.fill();

    // Sharp white-hot center spine
    cx.strokeStyle = '#ffffff';
    cx.lineWidth = 1.0;
    cx.beginPath();
    cx.moveTo(hx, hy);
    cx.lineTo(tipX, tipY);
    cx.stroke();

    // Crackling sparks along the blade
    const sparkCount = charging ? 4 : 2;
    for(let i = 0; i < sparkCount; i++){
      const k = .25 + .65 * ((t * 8 + i * .35) % 1);
      const px = hx + bx * (bladeLen * k), py = hy + by * (bladeLen * k);
      const sSide = (i % 2 === 0 ? 1 : -1);
      const sx = px + bnx * sSide * (3 + Math.sin(t * 40 + i) * 3);
      const sy = py + bny * sSide * (3 + Math.cos(t * 40 + i) * 3);
      cx.strokeStyle = 'rgba(0, 229, 255, 0.8)';
      cx.lineWidth = .9;
      cx.beginPath(); cx.moveTo(px, py); cx.lineTo(sx, sy); cx.stroke();
    }

    return {tip: {x: tipX, y: tipY}, mid: {x: midX, y: midY}, hand: {x: hx, y: hy}};
  }

  // Draw lightning traveling BETWEEN both blades!
  function drawInterBladeLightning(cx, bladeN, bladeF, t, charging, chgLvl, isAttacking) {
    if(!bladeN || !bladeF) return;

    const baseRoughness = charging ? 6 + 7 * chgLvl : (isAttacking ? 5.5 : 3.5);
    const numArcs = charging ? 3 : (isAttacking ? 2 : 1);

    for(let a = 0; a < numArcs; a++){
      const seed = t * 12 + a * 5.7;
      // Animate between tips and midpoints
      const fromPt = (a === 1) ? bladeN.mid : bladeN.tip;
      const toPt = (a === 2) ? bladeF.mid : bladeF.tip;
      const pts = getLightningPath(fromPt.x, fromPt.y, toPt.x, toPt.y, 6, baseRoughness, seed);

      const alphaOuter = charging ? .85 : (isAttacking ? .75 : .5);
      strokeLightning(
        cx, pts,
        `rgba(0, 229, 255, ${alphaOuter})`,
        'rgba(255, 255, 255, 0.95)',
        charging ? 3.0 : 2.2,
        charging ? 1.2 : 0.8
      );

      // Spark nodes jumping at connection points
      if(charging || isAttacking){
        cx.fillStyle = '#ffffff';
        const pMid = pts[Math.floor(pts.length / 2)];
        cx.beginPath(); cx.arc(pMid.x, pMid.y, 1.2, 0, 7); cx.fill();
      }
    }
  }

  // FLASHY COMBO SLASH FX: Electrifying slash crescents & lightning discharges
  function drawElectricSlash(cx, f, S) {
    const A = f.A || {};
    if(!(f.atk > 0) || !A.time) return;

    const p = clamp(1 - f.atk / A.time, 0, 1);
    const step = A.step || 0;
    const fade = 1 - clamp((p - (C + .08)) / .18, 0, 1);
    if(p < M || fade <= 0) return;

    const L = A.cl || 0;
    const big = 1 + .4 * L;
    const cx0 = S.sh.x + 22 * big, cy0 = S.sh.y + 2;

    cx.save();
    cx.lineCap = 'round';

    // Different lightning slash geometry per combo hit
    if(step === 0){
      // 1: Volt Slash - Diagonal downward slash arc
      const k = clamp((p - M) / .10, 0, 1);
      cx.beginPath();
      cx.ellipse(cx0, cy0, 22 * big, 26 * big, -.5, -.8, -.8 + 2.2 * k);
      cx.strokeStyle = `rgba(0, 229, 255, ${.7 * fade})`; cx.lineWidth = 5.0 * big; cx.stroke();
      cx.beginPath();
      cx.ellipse(cx0, cy0, 22 * big, 26 * big, -.5, -.8, -.8 + 2.2 * k);
      cx.strokeStyle = `rgba(255, 255, 255, ${.95 * fade})`; cx.lineWidth = 1.6; cx.stroke();
    } else if(step === 1){
      // 2: Storm Undercut - Rising slash arc
      const k = clamp((p - M) / .10, 0, 1);
      cx.beginPath();
      cx.ellipse(cx0, cy0 - 2, 24 * big, 22 * big, .6, 1.6, 1.6 - 2.2 * k, true);
      cx.strokeStyle = `rgba(0, 229, 255, ${.7 * fade})`; cx.lineWidth = 5.0 * big; cx.stroke();
      cx.beginPath();
      cx.ellipse(cx0, cy0 - 2, 24 * big, 22 * big, .6, 1.6, 1.6 - 2.2 * k, true);
      cx.strokeStyle = `rgba(255, 255, 255, ${.95 * fade})`; cx.lineWidth = 1.6; cx.stroke();
    } else if(step === 2){
      // 3: Twin Cross Cleave - Electrified X slashes
      const k = clamp((p - M) / .09, 0, 1);
      const r = 20 * big * k;
      // Arc 1
      cx.beginPath();
      cx.moveTo(cx0 - r * .9, cy0 - r * .9); cx.lineTo(cx0 + r * .9, cy0 + r * .9);
      cx.strokeStyle = `rgba(0, 229, 255, ${.75 * fade})`; cx.lineWidth = 5.2 * big; cx.stroke();
      cx.beginPath();
      cx.moveTo(cx0 - r * .9, cy0 - r * .9); cx.lineTo(cx0 + r * .9, cy0 + r * .9);
      cx.strokeStyle = `rgba(255, 255, 255, ${.95 * fade})`; cx.lineWidth = 1.6; cx.stroke();
      // Arc 2
      cx.beginPath();
      cx.moveTo(cx0 - r * .9, cy0 + r * .9); cx.lineTo(cx0 + r * .9, cy0 - r * .9);
      cx.strokeStyle = `rgba(0, 229, 255, ${.75 * fade})`; cx.lineWidth = 5.2 * big; cx.stroke();
      cx.beginPath();
      cx.moveTo(cx0 - r * .9, cy0 + r * .9); cx.lineTo(cx0 + r * .9, cy0 - r * .9);
      cx.strokeStyle = `rgba(255, 255, 255, ${.95 * fade})`; cx.lineWidth = 1.6; cx.stroke();
    } else if(step === 3){
      // 4: Tempest Flurry - Horizontal piercing electric bolts
      const k = clamp((p - M) / .08, 0, 1);
      [-6, 0, 6].forEach((oy, idx) => {
        const seed = p * 15 + idx * 7.1;
        const pts = getLightningPath(cx0 - 15, cy0 + oy, cx0 + 26 * big * k, cy0 + oy + Math.sin(idx) * 3, 5, 4, seed);
        strokeLightning(cx, pts, `rgba(0, 229, 255, ${.75 * fade})`, 'rgba(255, 255, 255, 0.95)', 4.0, 1.4);
      });
    } else {
      // 5: Thunderfall Slam - Giant vertical lightning pillar & ground blast
      const k = clamp((p - M) / .09, 0, 1);
      const groundY = 0;
      // Sky-to-ground lightning bolt
      const pts = getLightningPath(cx0 + 4, -75, cx0 + 4, groundY, 8, 8, p * 20);
      strokeLightning(cx, pts, `rgba(0, 229, 255, ${.85 * fade})`, 'rgba(255, 255, 255, 1)', 8.0 * big, 2.8);

      // Ground shockwave electric ellipse
      cx.strokeStyle = `rgba(0, 229, 255, ${.9 * fade})`; cx.lineWidth = 3.2;
      cx.beginPath();
      cx.ellipse(cx0 + 4, groundY, (10 + 38 * k) * big, (3 + 9 * k) * big, 0, 0, 7);
      cx.stroke();
      cx.strokeStyle = `rgba(255, 255, 255, ${.95 * fade})`; cx.lineWidth = 1.4;
      cx.beginPath();
      cx.ellipse(cx0 + 4, groundY, (8 + 32 * k) * big, (2 + 7 * k) * big, 0, 0, 7);
      cx.stroke();
    }

    cx.restore();
  }

  // Female agile hairstyle & storm circlet
  function drawStormHeadpiece(cx, S, t, white) {
    const hx = S.head.x, hy = S.head.y;
    // Swept-back storm hair / ponytail with glowing tips
    cx.save();
    cx.fillStyle = white ? '#fff' : '#142036';
    cx.strokeStyle = white ? '#fff' : '#00e5ff';
    cx.lineWidth = 1.0;

    // Ponytail strands trailing behind
    const sway = Math.sin(t * 6) * 1.5;
    cx.beginPath();
    cx.moveTo(hx - 3.5, hy - 4.5);
    cx.quadraticCurveTo(hx - 14 + sway, hy - 2 + sway * .5, hx - 18 + sway * 1.2, hy + 4 + sway);
    cx.quadraticCurveTo(hx - 12 + sway, hy + 1, hx - 4, hy - 1);
    cx.closePath();
    cx.fill(); cx.stroke();

    // Glowing electric hair-tips
    cx.fillStyle = '#00e5ff';
    cx.beginPath();
    cx.arc(hx - 17.5 + sway * 1.2, hy + 4 + sway, 1.4, 0, 7);
    cx.fill();

    // Storm circlet / headband with cyan focus gem
    cx.fillStyle = '#0d1726';
    cx.beginPath();
    cx.ellipse(hx + 1.2, hy - 2.8, 4.2, 1.4, .2, 0, 7);
    cx.fill();

    cx.fillStyle = '#00e5ff';
    cx.beginPath();
    cx.arc(hx + 4.2, hy - 2.2, 1.2, 0, 7);
    cx.fill();
    cx.restore();
  }

  Characters.art('fulminar', {
    // Ragdoll sizes: sleek, female athletic build. Hitbox stays 30x52.
    body: {
      head:  {r: 5.6},
      torso: {len: 11.5, w: 8.8},
      uArm:  {len: 8.5,  w: 3.6},
      fArm:  {len: 8.5,  w: 3.2},
      hand:  {r: 2.6},
      thigh: {len: 9.8,  w: 5.0},
      shin:  {len: 9.8,  w: 4.0},
      foot:  {len: 7.2,  w: 3.2}
    },

    colors: {
      shirt:   '#00e5ff', // electric cyan
      limb:    '#00b4d8',
      far:     '#0077b6',
      head:    '#e8f8fc',
      dark:    '#0d1726',
      hand:    '#1a2b40',
      legs:    '#152238',
      legsFar: '#0d1624'
    },

    // When the far arm swings or slashes in combo steps 1, 2, 3, 4, draw it in front
    farFront: f => f.atk > 0 && [1, 2, 3, 4].includes((f.A && f.A.step) || 0),

    // Stance: Agile, light, springy ready stance; low aerodynamic sprint with trailing electric sparks
    pose(tg, f, t, run, K){
      const sn = Math.sin(t * 3.2), cs = Math.cos(t * 3.2);
      const ph = (f.rig && f.rig.phase) || 0;
      const rsn = Math.sin(ph), rcs = Math.cos(ph);

      // Agile ready stance: blades up, knees springy
      const IDLE = {
        lean: G0.lean + sn * .02,
        head: Math.sin(t * 1.2) * .05,
        aN: G0.aN + sn * .04, eN: G0.eN,
        aF: G0.aF - sn * .04, eF: G0.eF,
        tN: G0.tN, kN: G0.kN + (.5 + .5 * Math.sin(t * 4)) * .05,
        tF: G0.tF, kF: G0.kF + (.5 + .5 * Math.sin(t * 4 + 1.5)) * .05
      };

      // Agile lightning sprint: low lean, dual blades swept back like lightning wings
      const RUN = {
        lean: .42 + .04 * Math.cos(2 * ph),
        head: -.1,
        aN: -1.0 - rsn * .35, eN: .45 + .2 * rcs,
        aF: -.95 + rsn * .35, eF: .45 - .2 * rcs,
        tN: rsn * 1.05 + .12, kN: .28 + 1.1 * Math.max(0, rcs),
        tF: -rsn * 1.05 + .12, kF: .28 + 1.1 * Math.max(0, -rcs)
      };

      for(const k in IDLE) tg[k] = lerp(IDLE[k], RUN[k], run);
      return {k: 210, d: 21};
    },

    air(tg, f, t){
      const m = clamp((f.vy + 260) / 520, 0, 1);
      tg.lean = lerp(.16, .08, m);
      tg.head = -.06;
      tg.aN = lerp(2.2, 1.4, m); tg.eN = .45;
      tg.aF = lerp(1.8, 1.2, m); tg.eF = .55;
      tg.tN = lerp(.75, .35, m); tg.kN = lerp(1.1, .45, m);
      tg.tF = lerp(.1, -.3, m);  tg.kF = lerp(.9, .3, m);
      return {k: 160, d: 16};
    },

    hurt(tg, f, t){
      const hs = f.vx * f.face >= 0 ? 1 : -1;
      const q = clamp(f.stun / .26, 0, 1), r = 1 - q;
      tg.lean = .55 * hs * q + .1 * r;
      tg.head = -.4 * hs * q;
      tg.aN = -1.6 * hs * q + .5 * r; tg.eN = .6;
      tg.aF = -1.3 * hs * q + .3 * r; tg.eF = .7;
      tg.tN = -.5 * hs * q + .4 * r;  tg.kN = .5;
      tg.tF = .5 * hs * q - .2 * r;   tg.kF = .5;
      return {k: 90 + 130 * r, d: 8 + 10 * r};
    },

    // Fast, crisp spring transitions for combo swings
    spring(p, A){
      if(p < R - .03 || (A.chg > 0 && p < R + .002)) return {k: A.chg > 0 ? 380 : 320, d: 30};
      if(p < C + .08) return A.cl > 0 ? {k: 1600, d: 85} : {k: 1300, d: 75};
      return {k: 320, d: 28};
    },

    // Attack pose solver
    attack(tg, p, A, K){
      const step = A.step || 0;
      const H = COMBO[step] || COMBO[0];
      const lead = H.lead, off = lead === 'N' ? 'F' : 'N';

      tg['a' + lead] = K(p, H.aLead); tg['e' + lead] = K(p, H.eLead);
      tg['a' + off]  = K(p, H.aOff);  tg['e' + off]  = K(p, H.eOff);
      tg.lean = K(p, H.lean);
      tg.tN = K(p, H.tN); tg.kN = K(p, H.kN);
      tg.tF = K(p, H.tF); tg.kF = K(p, H.kF);

      const L = A.cl || 0;
      if(L > 0){
        const wl = K(p, [[0, 0], [.18, 1], [R, 1], [C, 0], [1, 0]]);
        tg.kN += .3 * L * wl; tg.kF += .25 * L * wl; tg.lean += .15 * L * wl;
      }
      tg.head = -tg.lean * .35;
    },

    // Behind hook: Far blade (when not farFront), hand trails, electric aura
    behind(cx, f, t, S, P){
      const A = f.A || {};
      const atk = f.atk > 0;
      const charging = f.charging && f.chg > 0;
      const chgLvl = clamp((f.chg || 0) / (A.chargeMax || 1), 0, 1);
      const isFarFront = f.atk > 0 && [1, 2, 3, 4].includes(A.step || 0);

      cx.save();
      cx.lineCap = 'round'; cx.lineJoin = 'round';

      // Electric hand trails
      const st = f.flTrails || (f.flTrails = {N:[], F:[], face:f.face});
      if(st.face !== f.face){ st.N.length = st.F.length = 0; st.face = f.face; }
      [['N', S.aN.hand], ['F', S.aF.hand]].forEach(([k, H]) => {
        const a = st[k], last = a[a.length - 1];
        if(atk && (!last || last.t !== t)) a.push({x:H.x, y:H.y, t});
        while(a.length && (t - a[0].t > .12 || !atk)) a.shift();
        if(a.length > 1 && atk){
          for(let i = 1; i < a.length; i++){
            const q = i / a.length;
            cx.strokeStyle = `rgba(0, 229, 255, ${.15 + .7 * q})`;
            cx.lineWidth = 1.4 + 4.5 * q;
            cx.beginPath(); cx.moveTo(a[i - 1].x, a[i - 1].y); cx.lineTo(a[i].x, a[i].y); cx.stroke();
          }
        }
      });

      // OVERCHARGE aura while holding ATK: lightning arcs from ground to body
      if(charging){
        const cx0 = S.pel.x, cy0 = S.pel.y - 8;
        const g = cx.createRadialGradient(cx0, cy0, 2, cx0, cy0, 18 + 18 * chgLvl);
        g.addColorStop(0, `rgba(0, 229, 255, ${.3 + .35 * chgLvl})`);
        g.addColorStop(1, 'rgba(0, 180, 216, 0)');
        cx.fillStyle = g; cx.beginPath(); cx.arc(cx0, cy0, 18 + 18 * chgLvl, 0, 7); cx.fill();

        // Branching ground lightning sparks
        for(let i = 0; i < 4 + Math.round(5 * chgLvl); i++){
          const ang = t * 6 + i * 1.25;
          const dist = 10 + 20 * chgLvl;
          const sx = cx0 + Math.cos(ang) * dist, sy = cy0 + Math.sin(ang) * (dist * .6);
          const pts = getLightningPath(cx0, cy0, sx, sy, 4, 4, t * 15 + i);
          strokeLightning(cx, pts, 'rgba(0, 229, 255, 0.75)', '#ffffff', 2.2, 0.8);
        }
      }

      // Draw Far Blade here if not farFront
      if(!isFarFront){
        f.bladeF = drawBlade(cx, S.aF, t, true, charging, chgLvl);
      }

      cx.restore();
    },

    // Front hook: Near blade, Far blade (if farFront), Inter-blade lightning, combo slashes, charge meter, headpiece
    front(cx, f, t, S, P){
      const A = f.A || {};
      const atk = f.atk > 0;
      const charging = f.charging && f.chg > 0;
      const chgLvl = clamp((f.chg || 0) / ((f.A && f.A.chargeMax) || 1), 0, 1);
      const isFarFront = f.atk > 0 && [1, 2, 3, 4].includes(A.step || 0);

      cx.save();

      // Draw Far Blade here if farFront
      if(isFarFront){
        f.bladeF = drawBlade(cx, S.aF, t, true, charging, chgLvl);
      }

      // Draw Near Blade
      f.bladeN = drawBlade(cx, S.aN, t, false, charging, chgLvl);

      // ⚡ LIGHTNING TRAVELING BETWEEN BOTH BLADES ⚡
      drawInterBladeLightning(cx, f.bladeN, f.bladeF, t, charging, chgLvl, atk);

      // Flashy combo slashes
      drawElectricSlash(cx, f, S);

      // Hairstyle & storm circlet
      drawStormHeadpiece(cx, S, t, f.flash > 0);

      // Voltage meter above head while charging ATK
      if(charging){
        const x = S.head.x - 11, y = S.head.y - 13, full = chgLvl >= 1;
        cx.fillStyle = 'rgba(0,0,0,.7)'; cx.fillRect(x - 1, y - 1, 24, 5);
        cx.fillStyle = full ? (Math.sin(t * 50) > 0 ? '#ffffff' : '#00e5ff') : `rgb(${Math.round(40 + 180 * chgLvl)}, 229, 255)`;
        cx.fillRect(x, y, 22 * chgLvl, 3);
      }

      cx.restore();
    }
  });
})();
