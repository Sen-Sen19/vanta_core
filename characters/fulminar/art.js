// FULMINAR art - The Stormforged.
// Frozen Celestial Valkyrie: proud, elegant storm warrior wielding twin silver-framed Celestial Dual Blades.
// Focus: extreme speed, chain attacks, lightning that travels between both blades. Visual redesign only:
// body sizes, poses, springs, combo timing and every gameplay hook are exactly the original ones.
//
// What lives where (all procedural Canvas, drawn on the shared ragdoll, no assets):
//   behind()  - storm aura, long flowing hair (verlet chain), blade/limb trails, far Celestial Blade (when not farFront)
//   torso()   - far-arm bracer, rear skirt panel, neck, bare midriff, back straps, heart breastplate, waist band
//   foot()    - knee guard + knee-high silver boot (drawn right after each leg, so front/back order stays correct)
//   front()   - front skirt panel, hip plate, face + fringe + Valkyrie circlet, near arm (bracer, pauldron), blades,
//               inter-blade lightning, combo slash FX, Celestial Tempest gathering, charge meter
//   fxBack()  - lightning afterimages (under the bodies)
//   fx()      - Thunderstep burst / streaks / end sparks, Celestial Tempest field + sky bolts + final discharge
(() => {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const TAU = Math.PI * 2;
  const state = f => f.fxState || (f.fxState = {air:false, vy:0, pvy:0, t0:0, landT:-9, dip:0, face:f.face, turnT:-9});
  const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };   // deterministic noise (no Math.random: pause / hit-stop safe)
  const fract = v => v - Math.floor(v);

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

  // ---------------------------------------------------------------------------------------------
  // Frozen Celestial palette: pale ice blue + polished silver armor, cyan/white reserved for lightning. No gold.
  // ---------------------------------------------------------------------------------------------
  const OUT = '#0b0f1c', OW = 1.6;   // same outline as the shared ragdoll
  const PAL = {
    skin:'#f4d9c8', skinSh:'#e3bba6', blush:'rgba(231,138,150,.38)', lip:'#bf5f74',
    ice:'#bfe6f5', iceMid:'#9fd8ee', iceD:'#6fb9dc', iceL:'#e6f7fd',
    gem:'#7fe3ff', gemD:'#2bb6df',
    silv:'#d3dce8', silvFar:'#aebccf', silvD:'#93a5bd', silvL:'#f4f7fc', steel:'#6c7c96',
    hair:'#eef2fa', hairSh:'#b6c6dd', hairBack:'#d6e2f2',
    cy:'#33e6ff', cyD:'#00b8e0', wh:'#ffffff'
  };

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

  // ---------------------------------------------------------------------------------------------
  // small drawing helpers
  // ---------------------------------------------------------------------------------------------
  const poly = (cx, pts) => { cx.beginPath(); cx.moveTo(pts[0][0], pts[0][1]); for(let i = 1; i < pts.length; i++) cx.lineTo(pts[i][0], pts[i][1]); cx.closePath(); };
  const fillPoly = (cx, pts, fill, white, lw) => {
    poly(cx, pts); cx.fillStyle = white ? '#fff' : fill; cx.fill();
    cx.strokeStyle = OUT; cx.lineWidth = lw == null ? OW : lw; cx.lineJoin = 'round'; cx.stroke();
  };
  const smooth = (cx, pts, closed) => {   // smooth curve through midpoints
    const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], n = pts.length;
    if(closed){
      const m0 = mid(pts[n - 1], pts[0]); cx.moveTo(m0[0], m0[1]);
      for(let i = 0; i < n; i++){ const m = mid(pts[i], pts[(i + 1) % n]); cx.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]); }
      cx.closePath();
    }else{
      cx.moveTo(pts[0][0], pts[0][1]);
      for(let i = 1; i < n - 1; i++){ const m = mid(pts[i], pts[i + 1]); cx.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]); }
      cx.lineTo(pts[n - 1][0], pts[n - 1][1]);
    }
  };
  function gem(cx, x, y, r, white, glow){   // ice-blue diamond gemstone
    if(glow > 0 && !white){
      const g = cx.createRadialGradient(x, y, 0, x, y, r * 3.4);
      g.addColorStop(0, `rgba(127,227,255,${.55 * glow})`); g.addColorStop(1, 'rgba(127,227,255,0)');
      cx.fillStyle = g; cx.beginPath(); cx.arc(x, y, r * 3.4, 0, 7); cx.fill();
    }
    cx.beginPath(); cx.moveTo(x, y - r); cx.lineTo(x + r * .76, y); cx.lineTo(x, y + r); cx.lineTo(x - r * .76, y); cx.closePath();
    cx.fillStyle = white ? '#fff' : PAL.gem; cx.fill();
    cx.strokeStyle = OUT; cx.lineWidth = .85; cx.lineJoin = 'round'; cx.stroke();
    if(!white){
      cx.fillStyle = 'rgba(255,255,255,.9)';
      cx.beginPath(); cx.moveTo(x - r * .1, y - r * .62); cx.lineTo(x + r * .3, y - r * .1); cx.lineTo(x - r * .12, y + r * .05); cx.lineTo(x - r * .42, y - r * .2); cx.closePath(); cx.fill();
    }
  }
  const cap = (cx, a, b, w, col) => Body.capsule(cx, a, b, w, col);
  const capO = (cx, a, b, w, col, white, ow) => { ow = ow == null ? OW : ow; cap(cx, a, b, w + ow * 2, OUT); cap(cx, a, b, w, white ? '#fff' : col); };   // outlined capsule

  // per-frame module state shared with the torso() hook (torso gets no fighter argument)
  const cur = {f:null, X:null, ff:false};

  const newFx = () => ({
    t:null, pface:0, pvx:0, plunged:false,
    hair:null, hf:0,                                 // hair chain + float amount
    ult:0, eye:0, en:.22, carry:1, heavy:false,      // eased visual levels
    sk:{f:{a:.1, v:0}, r:{a:-.12, v:0}},             // skirt panel springs
    ghosts:[], gT:-9,                                // lightning afterimages
    tr:{N:[], F:[]}, tipN:null, tipF:null,           // blade trails (world space)
    dash:null,                                       // Thunderstep record
    casting:false, castP:0, skyCast:false, storm:null, k:0, fin:null
  });

  // ---------------------------------------------------------------------------------------------
  // tick: once per drawn frame (called from behind()). Everything is driven by the game clock `t`,
  // so pause / hit-stop (t does not advance) freezes hair, skirt, trails and effects automatically.
  // ---------------------------------------------------------------------------------------------
  const HN = 8, HSEG = 4.3;   // hair chain: 8 nodes x 3.7px ~ waist length
  function tick(f, t, S){
    const st = state(f), X = st.fx || (st.fx = newFx());
    if(X.t === t) return X;
    const face = f.face || 1, A = f.A || {}, atk = f.atk > 0;
    const raw = X.t == null ? 0 : t - X.t;
    const reset = X.t == null || raw < 0 || raw > .35;
    const dt = reset ? 0 : clamp(raw, 0, .05);
    X.t = t;
    const vx = f.vx || 0, vy = f.vy || 0, run = clamp(Math.abs(vx) / 170, 0, 1);
    if(reset){ X.hair = null; X.ghosts.length = 0; X.tr.N.length = X.tr.F.length = 0; X.dash = null; X.tipN = X.tipF = null; }

    // ---- ability states (read only; nothing here changes gameplay) ----
    const charging = !!(f.charging && f.chg > 0), chgLvl = clamp((f.chg || 0) / (A.chargeMax || 1), 0, 1);
    const casting = atk && A.skill === 'stormofruin', skyCast = atk && A.skill === 'skyfall';
    const sf = f.storm, storm = sf && sf.d ? {t:sf.t, cast:sf.d.cast, dur:sf.d.dur} : null;
    X.casting = casting; X.castP = casting ? clamp(1 - f.atk / (A.time || .8), 0, 1) : 0; X.skyCast = skyCast;
    X.storm = storm; X.k = storm ? clamp((storm.t - storm.cast) / Math.max(.01, storm.dur - storm.cast), 0, 1) : 0;
    if(storm){
      if(storm.t < 1) X.fin = null;
      if(!X.fin && storm.t >= storm.dur - .45) X.fin = {t0:t};     // Phase 4: final discharge begins as the storm ends
    }
    const finAge = X.fin ? t - X.fin.t0 : 9;

    // eased "how much storm energy is around her" 0..1.3
    let ultT = 0;
    if(casting) ultT = .55 + .85 * X.castP; else if(skyCast) ultT = .6; else if(storm) ultT = 1 + .3 * X.k; else if(finAge < .9) ultT = .7;
    if(charging) ultT = Math.max(ultT, .25 + .55 * chgLvl);
    X.ult += (ultT - X.ult) * Math.min(1, dt * (ultT > X.ult ? 7 : 3.5));
    const eyeT = (casting || storm || finAge < .9) ? 1 : skyCast ? .45 : 0;
    X.eye += (eyeT - X.eye) * Math.min(1, dt * 8);

    // blade energy: soft idle glow -> brighter while attacking -> white-hot on heavy hits / ultimate
    const step = A.step || 0;
    X.heavy = (atk && !A.skill && (step === 4 || (A.cl || 0) > 0)) || casting || !!storm || finAge < .5;
    let enT = .22;
    if(atk && !A.skill){ const p = clamp(1 - f.atk / (A.time || .28), 0, 1); enT = .5 + (p > R && p < C + .15 ? .4 : 0) + (X.heavy ? .3 : 0) + step * .04; }
    if(charging) enT = .5 + .7 * chgLvl;
    enT = Math.max(enT, X.ult * .85);
    X.en += (enT - X.en) * Math.min(1, dt * (enT > X.en ? 22 : 6));

    // blades carry down at her side while idle (visual only; the arm solver values are untouched); fades out for any action
    const calm = f.gr && !atk && !(f.stun > 0) && !charging && !casting && !skyCast && !storm;
    const carryT = calm ? 1 - run : 0;
    X.carry += (carryT - X.carry) * Math.min(1, dt * (carryT > X.carry ? 5 : 18));

    // ---- hair: verlet chain in WORLD space so it trails running, jumps and lunges ----
    const rg = f.rig, ha = (S.lean || 0) + (rg && rg.j && rg.j.head ? rg.j.head.a : 0);
    const ca = Math.cos(ha), sa = Math.sin(ha);
    const rlx = S.head.x + (-4.6) * ca - (-.2) * sa, rly = S.head.y + (-4.6) * sa + (-.2) * ca;
    const wx = f.x + rlx * face, wy = f.y + rly;
    X.hf = X.ult;
    if(reset || !X.hair){
      X.hair = [];
      for(let i = 0; i < HN; i++){ const x = wx - face * i * HSEG * .35, y = wy + i * HSEG * .93; X.hair.push({x, y, px:x, py:y}); }
    }else{
      const h = X.hair;
      if(X.pface && X.pface !== face) for(const n of h){ n.x = 2 * f.x - n.x; n.px = 2 * f.x - n.px; }   // turned around: swing the hair to the other side
      if(Math.hypot(h[0].x - wx, h[0].y - wy) > 110){ for(let i = 0; i < HN; i++){ const n = h[i]; n.x = n.px = wx - face * i * HSEG * .35; n.y = n.py = wy + i * HSEG * .93; } }
      if(dt > 0){
        const hf = X.hf, sub = 2, d2 = dt / sub;
        for(let s = 0; s < sub; s++){
          h[0].px = h[0].x; h[0].py = h[0].y; h[0].x = wx; h[0].y = wy;
          const damp = Math.pow(.9, d2 * 60);
          for(let i = 1; i < HN; i++){
            const n = h[i], w = i / (HN - 1), fl = hf * (.35 + .65 * w);
            const vxn = (n.x - n.px) * damp, vyn = (n.y - n.py) * damp;
            const ax = -face * 300 * (1 - .45 * w) * (1 - clamp(hf, 0, 1) * .7) + Math.sin(t * 5.3 + i * 1.7) * 75 * hf;   // slight back sweep + supernatural flutter
            const ay = 520 * (1 - 1.9 * fl) + Math.cos(t * 4.1 + i * 2.3) * 55 * hf;                                    // gravity, cancelled by the storm energy
            n.px = n.x; n.py = n.y; n.x += vxn + ax * d2 * d2; n.y += vyn + ay * d2 * d2;
          }
          for(let it = 0; it < 3; it++) for(let i = 1; i < HN; i++){
            const a = h[i - 1], b = h[i], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, k = (d - HSEG) / d;
            b.x -= dx * k; b.y -= dy * k;
          }
        }
      }else{ h[0].x = wx; h[0].y = wy; }
    }
    X.pface = face;

    // ---- skirt panels (springs) ----
    const th = lg => Math.atan2(lg.knee.x - lg.hip.x, lg.knee.y - lg.hip.y), tn = th(S.lN), tf = th(S.lF);
    const hfc = clamp(X.ult, 0, 1.3), fall = clamp(vy / 700, 0, .9);
    const tgF = clamp(.10 + .30 * Math.max(tn, tf, 0) - .40 * run + .70 * fall + .50 * hfc, -1, 1.3);
    const tgR = clamp(-.12 + .30 * Math.min(tn, tf, 0) - .38 * run - .70 * fall - .50 * hfc, -1.3, 1);
    const spr = (o, tg) => { if(reset){ o.a = tg; o.v = 0; return; } if(dt <= 0) return; o.v += (150 * (tg - o.a) - 10 * o.v) * dt; o.a += o.v * dt; };
    spr(X.sk.f, tgF); spr(X.sk.r, tgR);

    // ---- Thunderstep: the only fast burst in her kit is the combo lunge (also any speed beyond sprint) ----
    const lungeNow = atk && !A.skill && A.lunge && f.lunged && !X.plunged;
    const burst = lungeNow || (!(f.stun > 0) && Math.abs(vx) > 400 && Math.abs(X.pvx) < 300);
    if(burst && !reset) X.dash = {t0:t, x0:f.x, y0:f.y, face, end:null};
    if(X.dash){
      if(!X.dash.end && (Math.abs(vx) < 110 || t - X.dash.t0 > .4)) X.dash.end = {t, x:f.x, y:f.y};
      if((X.dash.end && t - X.dash.end.t > .45) || t - X.dash.t0 > 1.2) X.dash = null;
    }
    X.plunged = !!f.lunged; X.pvx = vx;
    const dashing = !!(X.dash && !X.dash.end);

    // ---- afterimages: brief translucent echoes at high speed (stronger for dashes and the Tempest Assault) ----
    const assault = storm && X.k > .3 && X.k < .9;
    const fast = Math.abs(vx) > 290 || dashing || (storm && storm.t > storm.cast && (Math.abs(vx) > 60 || atk));
    const gap = dashing || assault ? .035 : .06;
    if(fast && !reset && t - X.gT > gap){
      X.gT = t;
      const cp = p => ({x:p.x, y:p.y}), cpa = a => ({s:cp(a.s), el:cp(a.el), hand:cp(a.hand)}), cpl = l => ({hip:cp(l.hip), knee:cp(l.knee), ankle:cp(l.ankle)});
      X.ghosts.push({t0:t, face, x:f.x, y:f.y, a:dashing ? .34 : (storm ? .3 : .16), life:storm ? .3 : .22,
                     head:cp(S.head), sh:cp(S.sh), pel:cp(S.pel), aN:cpa(S.aN), aF:cpa(S.aF), lN:cpl(S.lN), lF:cpl(S.lF)});
      if(X.ghosts.length > 8) X.ghosts.shift();
    }
    while(X.ghosts.length && t - X.ghosts[0].t0 > X.ghosts[0].life) X.ghosts.shift();

    // ---- blade trails (world space, recorded from last frame's blade tips) ----
    const trailOn = atk || Math.abs(vx) > 200 || casting || !!storm;
    const life = (atk || storm) ? .15 : .1;
    [['N', X.tipN], ['F', X.tipF]].forEach(([k, p]) => {
      const a = X.tr[k];
      if(trailOn && p){ const last = a[a.length - 1]; if(!last || last.t !== t) a.push({x:p.x, y:p.y, t}); }
      while(a.length && (t - a[0].t > life || !trailOn || a.length > 14)) a.shift();
    });
    return X;
  }

  // ---------------------------------------------------------------------------------------------
  // Celestial Dual Blade. Same signature + hand-tracking as the original; V adds the energy level.
  // Silver lightning-bolt frame, glowing ice-blue core, cyan-white edges, angular lightning guard.
  // ---------------------------------------------------------------------------------------------
  const BL = 22;   // blade length (unchanged)
  const BLADE = [[-1,1.4],[.8,2.2],[7.2,3.4],[8.8,2.2],[14,3],[15.4,1.7],[BL,.2],[17.2,-1.5],[15.9,-.5],[11.4,-2.7],[10,-1.6],[5,-3.3],[.8,-2.2],[-1,-1.4]];
  const CORE  = [[1.5,.9],[7.4,1.7],[8.9,1],[14,1.5],[15.4,.7],[20.2,.15],[16.2,-.8],[15.2,-.2],[11.4,-1.4],[10.2,-.8],[5,-1.7],[1.5,-.9]];
  const GUARD_A = [[.2,0],[1.5,1.6],[0,2.8],[2.3,3.3],[.3,6],[3.8,3.7],[2.9,2.6],[4.3,1.4],[3.1,0]];
  const GUARD_B = [[.2,0],[1.4,-1.5],[.2,-2.5],[2.1,-2.9],[.6,-5],[3.4,-3.1],[2.6,-2.3],[3.7,-1.2],[3.1,0]];

  function drawBlade(cx, A, t, isFar, charging, chgLvl, V) {
    V = V || {};
    const en = V.en == null ? .25 : V.en, white = !!V.white, carry = V.carry || 0, heavy = !!V.heavy;
    const dx = A.hand.x - A.el.x, dy = A.hand.y - A.el.y;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d, uy = dy / d;
    const nx = -uy, ny = ux;

    const hx = A.hand.x, hy = A.hand.y;
    // Blade direction: angled slightly outward for a dynamic fighting stance
    const ang = isFar ? -.12 : .12;
    const cosA = Math.cos(ang), sinA = Math.sin(ang);
    let bx = ux * cosA - nx * sinA, by = uy * cosA - ny * sinA;
    if(carry > .001){   // idle: the blade hangs down-forward at her side instead of pointing along the forearm
      const th0 = Math.atan2(bx, by), th1 = (isFar ? .62 : .86) + Math.sin(t * 2.1 + (isFar ? 1 : 0)) * .04;
      let dth = th1 - th0; dth -= TAU * Math.round(dth / TAU);
      const th = th0 + dth * carry; bx = Math.sin(th); by = Math.cos(th);
    }
    const bnx = -by, bny = bx;
    const P = (s, w) => [hx + bx * s + bnx * w, hy + by * s + bny * w];
    const tp = P(BL, .2), mp = P(BL * .5, 0);

    cx.save(); cx.lineJoin = 'round'; cx.lineCap = 'round';
    const glow = clamp(en, 0, 1.3);

    // 1. soft energy glow around the whole blade
    if(!white){
      cx.globalCompositeOperation = 'lighter';
      const wide = BLADE.map(([s, w]) => P(s, w * (2.1 + glow)));
      poly(cx, wide); cx.fillStyle = `rgba(0,200,255,${.07 + .10 * glow})`; cx.fill();
      const mid = BLADE.map(([s, w]) => P(s, w * 1.45));
      poly(cx, mid); cx.fillStyle = `rgba(110,240,255,${.10 + .16 * glow})`; cx.fill();
      cx.globalCompositeOperation = 'source-over';
    }

    // 2. pommel + grip end (behind the hand)
    capO(cx, {x:hx - bx * 3.4, y:hy - by * 3.4}, {x:hx, y:hy}, 1.6, PAL.silv, white, .8);
    if(!white){ cx.fillStyle = PAL.cy; cx.beginPath(); cx.arc(hx - bx * 3.7, hy - by * 3.7, 1, 0, 7); cx.fill(); }

    // 3. silver lightning-bolt frame
    const frame = BLADE.map(([s, w]) => P(s, w));
    poly(cx, frame);
    if(white) cx.fillStyle = '#fff';
    else{
      const g = cx.createLinearGradient(hx, hy, tp[0], tp[1]);
      g.addColorStop(0, PAL.silvD); g.addColorStop(.35, PAL.silvL); g.addColorStop(1, PAL.silv);
      cx.fillStyle = g;
    }
    cx.fill(); cx.strokeStyle = OUT; cx.lineWidth = 1.15; cx.stroke();

    if(!white){
      // 4. glowing ice-blue energy core (white-hot on heavy attacks)
      const core = CORE.map(([s, w]) => P(s, w));
      const g2 = cx.createLinearGradient(hx, hy, tp[0], tp[1]);
      const hot = clamp(en - .55, 0, .6) / .6 + (heavy ? .35 : 0);
      g2.addColorStop(0, hot > .4 ? '#c8fbff' : PAL.gem); g2.addColorStop(.55, hot > .4 ? '#f0ffff' : '#b9f3ff'); g2.addColorStop(1, '#ffffff');
      poly(cx, core); cx.fillStyle = g2; cx.fill();
      if(hot > .05){ cx.fillStyle = `rgba(255,255,255,${clamp(hot, 0, 1) * .8})`; poly(cx, core); cx.fill(); }
      // 5. bright cyan-white cutting edges (jagged lower edge + thin upper edge)
      cx.strokeStyle = `rgba(215,255,255,${.75 + .25 * clamp(glow, 0, 1)})`; cx.lineWidth = .9;
      const lo = [[BL,.2],[17.2,-1.5],[15.9,-.5],[11.4,-2.7],[10,-1.6],[5,-3.3]].map(([s, w]) => P(s, w));
      cx.beginPath(); cx.moveTo(lo[0][0], lo[0][1]); for(let i = 1; i < lo.length; i++) cx.lineTo(lo[i][0], lo[i][1]); cx.stroke();
      cx.lineWidth = .6; cx.strokeStyle = 'rgba(200,250,255,.7)';
      const up = [[.8,2.2],[7.2,3.4],[8.8,2.2],[14,3],[15.4,1.7],[BL,.2]].map(([s, w]) => P(s, w));
      cx.beginPath(); cx.moveTo(up[0][0], up[0][1]); for(let i = 1; i < up.length; i++) cx.lineTo(up[i][0], up[i][1]); cx.stroke();
      // sharp white-hot center spine
      const a0 = P(1.5, 0), a1 = P(20.4, .15);
      cx.strokeStyle = '#ffffff'; cx.lineWidth = 1.0; cx.beginPath(); cx.moveTo(a0[0], a0[1]); cx.lineTo(a1[0], a1[1]); cx.stroke();
      // small crystalline glints in the frame
      cx.fillStyle = 'rgba(255,255,255,.85)';
      [[6.2,.2],[12.6,.1]].forEach(([s, w]) => { const q = P(s, w); cx.beginPath(); cx.moveTo(q[0], q[1] - 1); cx.lineTo(q[0] + .7, q[1]); cx.lineTo(q[0], q[1] + 1); cx.lineTo(q[0] - .7, q[1]); cx.closePath(); cx.fill(); });
    }

    // 6. angular lightning-shaped guard + ice gem
    fillPoly(cx, GUARD_A.map(([s, w]) => P(s, w)), PAL.silv, white, .8);
    fillPoly(cx, GUARD_B.map(([s, w]) => P(s, w)), PAL.silvFar, white, .8);
    const gp = P(1.7, 0); gem(cx, gp[0], gp[1], 1.25, white, 0);

    // 7. tiny white sparks around the blade (idle = a couple, charged = many)
    if(!white){
      const n = 2 + (charging ? 3 : 0) + (en > .6 ? 2 : 0) + (heavy ? 2 : 0);
      for(let i = 0; i < n; i++){
        const k = .2 + .72 * fract(t * 1.5 + i * .37 + (isFar ? .5 : 0));
        if(Math.sin(t * 37 + i * 5.1 + (isFar ? 2 : 0)) < -.15 + .35 * glow) continue;   // flicker: idle stays quiet
        const side = i % 2 ? 1 : -1, off = 2.6 + hash(Math.floor(t * 18) + i) * 3;
        const p0 = P(BL * k, side * 1.6), p1 = P(BL * k + (hash(i + Math.floor(t * 12)) - .5) * 3, side * off);
        cx.strokeStyle = i % 2 ? 'rgba(255,255,255,.95)' : 'rgba(120,240,255,.9)'; cx.lineWidth = .8;
        cx.beginPath(); cx.moveTo(p0[0], p0[1]); cx.lineTo(p1[0], p1[1]); cx.stroke();
      }
    }
    cx.restore();
    return {tip: {x: tp[0], y: tp[1]}, mid: {x: mp[0], y: mp[1]}, hand: {x: hx, y: hy}};
  }

  // Draw lightning traveling BETWEEN both blades! (idle: only an occasional thin arc)
  function drawInterBladeLightning(cx, bladeN, bladeF, t, charging, chgLvl, isAttacking) {
    if(!bladeN || !bladeF) return;
    if(!charging && !isAttacking && fract(t * 1.1) > .2) return;   // idle: occasional, never constant noise

    const baseRoughness = charging ? 6 + 7 * chgLvl : (isAttacking ? 5.5 : 2.6);
    const numArcs = charging ? 3 : (isAttacking ? 2 : 1);

    for(let a = 0; a < numArcs; a++){
      const seed = t * 12 + a * 5.7;
      // Animate between tips and midpoints
      const fromPt = (a === 1) ? bladeN.mid : bladeN.tip;
      const toPt = (a === 2) ? bladeF.mid : bladeF.tip;
      const pts = getLightningPath(fromPt.x, fromPt.y, toPt.x, toPt.y, 6, baseRoughness, seed);

      const alphaOuter = charging ? .85 : (isAttacking ? .75 : .45);
      strokeLightning(
        cx, pts,
        `rgba(0, 229, 255, ${alphaOuter})`,
        'rgba(255, 255, 255, 0.95)',
        charging ? 3.0 : (isAttacking ? 2.2 : 1.5),
        charging ? 1.2 : (isAttacking ? .8 : .6)
      );

      // Spark nodes jumping at connection points
      if(charging || isAttacking){
        cx.fillStyle = '#ffffff';
        const pMid = pts[Math.floor(pts.length / 2)];
        cx.beginPath(); cx.arc(pMid.x, pMid.y, 1.2, 0, 7); cx.fill();
      }
    }
  }

  // ---------------------------------------------------------------------------------------------
  // COMBO SLASH FX - same trigger window / timing as before, visual intensity escalates hit by hit
  //   1 clean narrow slash -> 2 rising ice-blue arc + fragments -> 3 crossing slashes + flash + blade link
  //   -> 4 overlapping flurry streaks -> 5 massive burst, shockwave and ground discharge
  // ---------------------------------------------------------------------------------------------
  function drawElectricSlash(cx, f, S) {
    const A = f.A || {};
    if(!(f.atk > 0) || !A.time || A.skill) return;   // skills (Skyfall / Storm of Ruin) are not combo hits

    const p = clamp(1 - f.atk / A.time, 0, 1);
    const step = A.step || 0;
    const fade = 1 - clamp((p - (C + .08)) / .18, 0, 1);
    if(p < M || fade <= 0) return;

    const L = A.cl || 0;
    const big = 1 + .4 * L;
    const lv = [.8, .92, 1.06, 1.2, 1.5][Math.min(step, 4)];   // escalating intensity
    const cx0 = S.sh.x + 22 * big, cy0 = S.sh.y + 2;
    const arcCol = a => `rgba(0, 229, 255, ${a * fade})`, icCol = a => `rgba(127, 227, 255, ${a * fade})`, whCol = a => `rgba(255, 255, 255, ${a * fade})`;
    const ell = (x, y, rx, ry, rot, a0, a1, ccw) => { cx.beginPath(); cx.ellipse(x, y, rx, ry, rot, a0, a1, ccw); };
    const epoint = (x, y, rx, ry, rot, a) => [x + rx * Math.cos(a) * Math.cos(rot) - ry * Math.sin(a) * Math.sin(rot), y + rx * Math.cos(a) * Math.sin(rot) + ry * Math.sin(a) * Math.cos(rot)];
    const sparks = (x, y, n, len, seed) => {
      for(let i = 0; i < n; i++){
        const a = hash(seed + i * 3.1) * TAU, l = len * (.5 + hash(seed + i * 7.7));
        cx.strokeStyle = i % 2 ? whCol(.95) : arcCol(.9); cx.lineWidth = 1;
        cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); cx.stroke();
      }
    };

    cx.save();
    cx.lineCap = 'round'; cx.lineJoin = 'round';

    // Different lightning slash geometry per combo hit
    if(step === 0){
      // 1: Volt Slash - clean, narrow, precise diagonal cut + small sparks
      const k = clamp((p - M) / .10, 0, 1), a1 = -.8 + 2.2 * k;
      ell(cx0, cy0, 22 * big, 26 * big, -.5, -.8, a1); cx.strokeStyle = arcCol(.6); cx.lineWidth = 3.6 * big; cx.stroke();
      ell(cx0, cy0, 22 * big, 26 * big, -.5, -.8, a1); cx.strokeStyle = whCol(.97); cx.lineWidth = 1.3; cx.stroke();
      const e = epoint(cx0, cy0, 22 * big, 26 * big, -.5, a1); sparks(e[0], e[1], 4, 6, Math.floor(p * 30));
    } else if(step === 1){
      // 2: Storm Undercut - rising ice-blue arc, cyan-white trail, small lightning fragments
      const k = clamp((p - M) / .10, 0, 1), a1 = 1.6 - 2.2 * k;
      ell(cx0, cy0 - 2, 24 * big, 22 * big, .6, 1.6, a1, true); cx.strokeStyle = icCol(.65); cx.lineWidth = 5.0 * big; cx.stroke();
      ell(cx0, cy0 - 2, 24 * big, 22 * big, .6, 1.6, a1, true); cx.strokeStyle = arcCol(.9); cx.lineWidth = 2.4; cx.stroke();
      ell(cx0, cy0 - 2, 24 * big, 22 * big, .6, 1.6, a1, true); cx.strokeStyle = whCol(.97); cx.lineWidth = 1.2; cx.stroke();
      for(let i = 0; i < 3; i++){
        const q = epoint(cx0, cy0 - 2, 24 * big, 22 * big, .6, lerp(1.6, a1, .35 + i * .3));
        const pts = getLightningPath(q[0], q[1], q[0] - 5 + i * 5, q[1] - 9 - i * 2, 3, 3, p * 17 + i * 3.3);
        strokeLightning(cx, pts, arcCol(.75), whCol(1), 1.8, .7);
      }
    } else if(step === 2){
      // 3: Twin Cross Cleave - two intersecting slashes, white flash at the crossing, energy linking both blades
      const k = clamp((p - M) / .09, 0, 1);
      const r = 20 * big * k;
      [[-1, -1, 1, 1], [-1, 1, 1, -1]].forEach(([ax, ay, bx, by]) => {
        cx.beginPath(); cx.moveTo(cx0 + ax * r * .9, cy0 + ay * r * .9); cx.lineTo(cx0 + bx * r * .9, cy0 + by * r * .9);
        cx.strokeStyle = arcCol(.75); cx.lineWidth = 5.2 * big; cx.stroke();
        cx.beginPath(); cx.moveTo(cx0 + ax * r * .9, cy0 + ay * r * .9); cx.lineTo(cx0 + bx * r * .9, cy0 + by * r * .9);
        cx.strokeStyle = whCol(.97); cx.lineWidth = 1.6; cx.stroke();
      });
      const fl = clamp(1 - (p - M) / .16, 0, 1) * k;
      if(fl > 0){
        const g = cx.createRadialGradient(cx0, cy0, 0, cx0, cy0, 17 * big);
        g.addColorStop(0, `rgba(255,255,255,${.95 * fl * fade})`); g.addColorStop(.45, `rgba(150,245,255,${.5 * fl * fade})`); g.addColorStop(1, 'rgba(0,229,255,0)');
        cx.fillStyle = g; cx.beginPath(); cx.arc(cx0, cy0, 17 * big, 0, 7); cx.fill();
      }
      if(f.bladeN && f.bladeF){   // visible energy connecting both blades
        const pts = getLightningPath(f.bladeN.tip.x, f.bladeN.tip.y, f.bladeF.tip.x, f.bladeF.tip.y, 5, 5, p * 21);
        strokeLightning(cx, pts, arcCol(.8), whCol(.95), 2.6, .9);
      }
    } else if(step === 3){
      // 4: Tempest Flurry - rapid overlapping blade trails, multiple short streaks, growing intensity
      const k = clamp((p - M) / .08, 0, 1);
      for(let idx = 0; idx < 6; idx++){
        const oy = (idx - 2.5) * 3.6, late = clamp(k * 1.5 - idx * .12, 0, 1);   // staggered: streaks overlap in quick succession
        if(late <= 0) continue;
        const seed = p * 15 + idx * 7.1, tilt = (idx % 2 ? 1 : -1) * 3;
        const pts = getLightningPath(cx0 - 15 + idx * 2, cy0 + oy, cx0 + 26 * big * late, cy0 + oy + tilt, 5, 3.4, seed);
        strokeLightning(cx, pts, idx % 2 ? icCol(.7) : arcCol(.75), whCol(.97), 3.4, 1.2);
      }
      sparks(cx0 + 24 * big * k, cy0, 5, 8, Math.floor(p * 40));
    } else {
      // 5: Thunderfall Slam - powerful downward impact, massive burst, ground shockwave, spreading discharge
      const k = clamp((p - M) / .09, 0, 1);
      const groundY = 0;
      const pts = getLightningPath(cx0 + 4, -75, cx0 + 4, groundY, 8, 8, p * 20);
      strokeLightning(cx, pts, arcCol(.85), whCol(1), 8.0 * big, 2.8);
      const g = cx.createRadialGradient(cx0 + 4, groundY - 4, 0, cx0 + 4, groundY - 4, 30 * big * (.5 + .5 * k));
      g.addColorStop(0, `rgba(255,255,255,${.95 * fade})`); g.addColorStop(.35, `rgba(120,240,255,${.6 * fade})`); g.addColorStop(1, 'rgba(0,229,255,0)');
      cx.fillStyle = g; cx.beginPath(); cx.arc(cx0 + 4, groundY - 4, 30 * big, 0, 7); cx.fill();

      // Ground shockwave electric ellipse
      cx.strokeStyle = arcCol(.9); cx.lineWidth = 3.2;
      cx.beginPath();
      cx.ellipse(cx0 + 4, groundY, (10 + 38 * k) * big, (3 + 9 * k) * big, 0, 0, 7);
      cx.stroke();
      cx.strokeStyle = whCol(.95); cx.lineWidth = 1.4;
      cx.beginPath();
      cx.ellipse(cx0 + 4, groundY, (8 + 32 * k) * big, (2 + 7 * k) * big, 0, 0, 7);
      cx.stroke();
      // electrical discharge crawling out along the ground
      for(let i = 0; i < 6; i++){
        const dir = i % 2 ? 1 : -1, reach = (14 + 40 * k) * big * (.6 + .4 * hash(i * 3.3));
        const pp = getLightningPath(cx0 + 4, groundY - 1, cx0 + 4 + dir * reach, groundY - 1 - hash(i + 9) * 7, 4, 3, p * 13 + i);
        strokeLightning(cx, pp, arcCol(.7), whCol(.95), 2.2, .8);
      }
    }
    cx.restore();
  }

  // ---------------------------------------------------------------------------------------------
  // HAIR: long loose silver-white hair to the waist with cyan tips. Chain comes from tick() (world space).
  // ---------------------------------------------------------------------------------------------
  function drawHairBack(cx, f, X, white, t){
    const h = X.hair; if(!h) return;
    const face = f.face || 1, N = h.length;
    const Lp = h.map(n => [(n.x - f.x) * face, n.y - f.y]);
    const nr = Lp.map((p, i) => {
      const a = Lp[Math.max(0, i - 1)], b = Lp[Math.min(N - 1, i + 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1; return [-dy / d, dx / d];
    });
    const hot = X.ult > .3, tipC = hot ? '#8cfaff' : PAL.cy;
    const locks = [   // back -> front
      {o0:-2.2, o1:-5.6, w0:8.5, w1:2.2, len:1,   top:PAL.hairBack, mid:'#c9daef'},
      {o0:0,    o1:.4,   w0:11.5, w1:2.6, len:1,   top:PAL.hair,     mid:'#dbe8f7'},
      {o0:2.6,  o1:5.2,  w0:6.5, w1:1.8, len:.87, top:'#f7f9fe',    mid:'#e4eefa'}
    ];
    cx.save(); cx.lineJoin = 'round'; cx.lineCap = 'round';
    locks.forEach((lk, li) => {
      const m = Math.max(3, Math.round((N - 1) * lk.len) + 1), left = [], right = [];
      for(let i = 0; i < m; i++){
        const w = i / (m - 1), fl = X.hf * Math.sin(t * 2.3 + i * 1.1 + li * 2) * 2.2;
        const off = lerp(lk.o0, lk.o1, w * w) + fl, wid = lerp(lk.w0, lk.w1, Math.pow(w, .85)) * (i === m - 1 ? .35 : 1);
        left.push([Lp[i][0] + nr[i][0] * (off + wid / 2), Lp[i][1] + nr[i][1] * (off + wid / 2)]);
        right.push([Lp[i][0] + nr[i][0] * (off - wid / 2), Lp[i][1] + nr[i][1] * (off - wid / 2)]);
      }
      cx.beginPath(); smooth(cx, left, false);
      const tipP = [(left[m - 1][0] + right[m - 1][0]) / 2 + nr[m - 1][0] * 0, (left[m - 1][1] + right[m - 1][1]) / 2];
      cx.lineTo(right[m - 1][0], right[m - 1][1]);
      smooth(cx, right.slice().reverse(), false); cx.closePath();
      if(white) cx.fillStyle = '#fff';
      else{
        const g = cx.createLinearGradient(Lp[0][0], Lp[0][1], Lp[m - 1][0], Lp[m - 1][1]);
        g.addColorStop(0, lk.top); g.addColorStop(.5, lk.mid); g.addColorStop(.72, hot ? '#b8f6ff' : '#9bf0ff'); g.addColorStop(1, tipC);
        cx.fillStyle = g;
      }
      cx.fill(); cx.strokeStyle = OUT; cx.lineWidth = 1.05; cx.stroke();
      if(!white){   // silky highlight streak along the lock
        cx.beginPath(); smooth(cx, Lp.slice(0, m).map((p, i) => [p[0] + nr[i][0] * (lk.o0 * (1 - i / m) + 1.1), p[1] + nr[i][1] * (lk.o0 * (1 - i / m) + 1.1)]).slice(0, Math.max(3, m - 2)), false);
        cx.strokeStyle = 'rgba(255,255,255,.55)'; cx.lineWidth = .7; cx.stroke();
      }
      if(!white && hot){   // brighter cyan tips during Celestial Tempest
        cx.globalCompositeOperation = 'lighter';
        const g = cx.createRadialGradient(tipP[0], tipP[1], 0, tipP[0], tipP[1], 5);
        g.addColorStop(0, 'rgba(160,250,255,.8)'); g.addColorStop(1, 'rgba(0,229,255,0)');
        cx.fillStyle = g; cx.beginPath(); cx.arc(tipP[0], tipP[1], 5, 0, 7); cx.fill();
        cx.globalCompositeOperation = 'source-over';
      }
    });
    cx.restore();
  }

  // ---------------------------------------------------------------------------------------------
  // FACE + front hair + Valkyrie circlet (replaces the old storm headpiece; same name / call site)
  // Drawn over the shared head disc, in the head's rotated frame (x = forward, y = down).
  // ---------------------------------------------------------------------------------------------
  function drawStormHeadpiece(cx, S, t, white, V) {
    V = V || {};
    const r = 5.6, eye = V.eye || 0, glow = V.glow || 0;
    const blink = fract(t / 4.3) < .022;
    cx.save();
    cx.translate(S.head.x, S.head.y); cx.rotate(V.ha || 0);
    cx.lineJoin = 'round'; cx.lineCap = 'round';
    const skin = white ? '#fff' : PAL.skin;

    // head silhouette + small nose (covers the shared visor)
    cx.fillStyle = OUT; cx.beginPath(); cx.arc(0, 0, r + OW, 0, 7); cx.fill();
    cx.beginPath(); cx.arc(5.7, 1.1, 1 + OW, 0, 7); cx.fill();
    cx.fillStyle = skin; cx.beginPath(); cx.arc(0, 0, r, 0, 7); cx.fill();
    cx.beginPath(); cx.arc(5.55, 1.1, 1.05, 0, 7); cx.fill();

    if(!white){
      // blush + lips (proud, slightly smirking)
      cx.fillStyle = PAL.blush; cx.beginPath(); cx.ellipse(2.3, 2.5, 1.9, 1.1, 0, 0, 7); cx.fill();
      cx.strokeStyle = PAL.lip; cx.lineWidth = 1.05;
      cx.beginPath(); cx.moveTo(2.1, 3.3); cx.quadraticCurveTo(3.4, 4, 4.8, 3.1); cx.stroke();
      // bright icy-blue eye with a sharp upper lid
      if(blink){
        cx.strokeStyle = OUT; cx.lineWidth = 1.2; cx.beginPath(); cx.moveTo(.9, -.5); cx.quadraticCurveTo(3, .3, 5, -.5); cx.stroke();
      }else{
        if(eye > .05){
          cx.globalCompositeOperation = 'lighter';
          const hg = cx.createRadialGradient(3.4, -.3, 0, 3.4, -.3, 4.4);
          hg.addColorStop(0, `rgba(160,250,255,${.8 * eye})`); hg.addColorStop(1, 'rgba(0,229,255,0)');
          cx.fillStyle = hg; cx.beginPath(); cx.arc(3.4, -.3, 4.4, 0, 7); cx.fill();
          cx.globalCompositeOperation = 'source-over';
        }
        cx.fillStyle = '#fff'; cx.beginPath(); cx.ellipse(3.1, -.3, 1.95, 1.5, -.12, 0, 7); cx.fill();
        const ig = cx.createRadialGradient(3.5, -.4, 0, 3.5, -.3, 1.5);
        ig.addColorStop(0, eye > .3 ? '#e8ffff' : '#aef6ff'); ig.addColorStop(1, '#14c4f0');
        cx.fillStyle = ig; cx.beginPath(); cx.arc(3.5, -.3, 1.3, 0, 7); cx.fill();
        cx.fillStyle = '#062c48'; cx.beginPath(); cx.arc(3.75, -.3, .55, 0, 7); cx.fill();
        cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(3.95, -.8, .45, 0, 7); cx.fill();
        cx.strokeStyle = OUT; cx.lineWidth = 1.25;   // fierce upper lid
        cx.beginPath(); cx.moveTo(.7, -.9); cx.quadraticCurveTo(2.7, -2.5, 5.1, -1.2); cx.stroke();
      }
      // brow: angled for a confident, fierce look (sharper during the ultimate)
      cx.strokeStyle = '#8c9db6'; cx.lineWidth = 1 + .25 * eye;
      cx.beginPath(); cx.moveTo(1.1, -2.7 - .3 * eye); cx.lineTo(5, -1.7 + .3 * eye); cx.stroke();
    }

    // front hair: cap over the crown, sweeping fringe, face-framing side lock
    cx.beginPath(); cx.arc(0, 0, r + .55, -.63, 2.18, true);
    cx.lineTo(-2.1, 4); cx.quadraticCurveTo(-3.2, .6, -.4, -.8); cx.quadraticCurveTo(1.2, -2.6, 4.1, -3.1); cx.lineTo(4.95, -3.65); cx.closePath();
    if(white) cx.fillStyle = '#fff';
    else{ const g = cx.createLinearGradient(-5, -5, 4, 2); g.addColorStop(0, PAL.hairBack); g.addColorStop(.5, PAL.hair); g.addColorStop(1, '#fbfdff'); cx.fillStyle = g; }
    cx.fill(); cx.strokeStyle = OUT; cx.lineWidth = 1.4; cx.stroke();
    if(!white){
      cx.strokeStyle = 'rgba(150,172,204,.6)'; cx.lineWidth = .7;
      [[3.7, -2.9, -1.05], [4.3, -2.5, -1.35], [4.9, -2.2, -1.6]].forEach(([rr, a0, a1], i) => { cx.beginPath(); cx.arc(0, 0, rr + .5 - i * .1, -2.9 + i * .22, -1.0 - i * .05); cx.stroke(); });
      cx.strokeStyle = 'rgba(255,255,255,.85)'; cx.lineWidth = .9; cx.beginPath(); cx.arc(0, 0, 5.4, -2.3, -1.25); cx.stroke();
    }
    // side lock framing the cheek, cyan at the tip
    const lock = [[-.6, .2], [1, 2.8], [.9, 6.6], [-.6, 7.3], [-2.4, 5.2], [-3.3, 1.4]];
    cx.beginPath(); smooth(cx, lock, true);
    if(white) cx.fillStyle = '#fff';
    else{ const g = cx.createLinearGradient(0, 0, -1, 7.3); g.addColorStop(0, PAL.hair); g.addColorStop(.55, '#d7e7f7'); g.addColorStop(1, V.hot ? '#8cfaff' : PAL.cy); cx.fillStyle = g; }
    cx.fill(); cx.strokeStyle = OUT; cx.lineWidth = 1.2; cx.stroke();

    // Valkyrie circlet: polished silver band + central ice-blue gem (visible over the hair)
    cx.beginPath(); cx.arc(0, 0, 5.05, -1.08, -3.3, true);
    cx.strokeStyle = OUT; cx.lineWidth = 2.7; cx.stroke();
    cx.strokeStyle = white ? '#fff' : PAL.silv; cx.lineWidth = 1.4; cx.stroke();
    if(!white){
      cx.beginPath(); cx.arc(0, 0, 5.3, -1.0, -2.6, true); cx.strokeStyle = 'rgba(255,255,255,.9)'; cx.lineWidth = .5; cx.stroke();
      [-1.62, -2.05, -2.5].forEach(a => { cx.fillStyle = PAL.gem; cx.beginPath(); cx.arc(5.05 * Math.cos(a), 5.05 * Math.sin(a), .5, 0, 7); cx.fill(); });
    }
    gem(cx, 5.05 * Math.cos(-1.08), 5.05 * Math.sin(-1.08), 2, white, glow);
    cx.restore();
  }

  // ---------------------------------------------------------------------------------------------
  // ARMOR PIECES
  // ---------------------------------------------------------------------------------------------
  // Split skirt: one front + one rear silver-white panel, pale ice-blue trim, open sides, springy motion.
  function skirtPanel(cx, S, X, front, white){
    const ang = X ? (front ? X.sk.f.a : X.sk.r.a) : (front ? .1 : -.12);
    const ax = S.pel.x + (front ? 1.9 : -2.1), ay = S.pel.y - 1.6;
    const len = front ? 10.8 : 9.4, wt = front ? 4.8 : 4.4, wb = front ? 7.8 : 6.8;
    const dx = Math.sin(ang), dy = Math.cos(ang), nx = Math.cos(ang), ny = -Math.sin(ang);
    const at = (s, w) => [ax + dx * s + nx * w, ay + dy * s + ny * w];
    const pts = [at(0, -wt / 2), at(0, wt / 2)];
    for(let j = 4; j >= 0; j--){ const w = -wb / 2 + wb * (j / 4); pts.push(at(len - (j % 2 ? 2.4 : 0), w)); }   // frost-cut hem
    cx.save(); cx.lineJoin = 'round';
    poly(cx, pts);
    if(white) cx.fillStyle = '#fff';
    else{ const g = cx.createLinearGradient(ax, ay, ax + dx * len, ay + dy * len); g.addColorStop(0, PAL.iceMid); g.addColorStop(.3, PAL.ice); g.addColorStop(1, PAL.silvL); cx.fillStyle = g; }
    cx.fill(); cx.strokeStyle = OUT; cx.lineWidth = 1.4; cx.stroke();
    if(!white){
      const a = at(2.4, -wt * .1), b = at(len - 1.5, -wb * .22), c = at(2.8, wt * .22), d = at(len - 3.2, wb * .26);   // subtle frost lines
      cx.strokeStyle = 'rgba(255,255,255,.8)'; cx.lineWidth = .7; cx.beginPath(); cx.moveTo(a[0], a[1]); cx.lineTo(b[0], b[1]); cx.moveTo(c[0], c[1]); cx.lineTo(d[0], d[1]); cx.stroke();
      const t0 = at(0, -wt / 2), t1 = at(0, wt / 2), t2 = at(2.2, wt / 2), t3 = at(2.2, -wt / 2);   // silver waistband
      fillPoly(cx, [t0, t1, t2, t3], PAL.silv, false, 1);
    }
    cx.restore();
  }

  // Forearm guard: polished silver bracer with frost engravings and ice-blue accents (arm A = {s, el, hand})
  function bracer(cx, A, far, white){
    const a = {x:lerp(A.el.x, A.hand.x, .22), y:lerp(A.el.y, A.hand.y, .22)}, b = {x:lerp(A.el.x, A.hand.x, .86), y:lerp(A.el.y, A.hand.y, .86)};
    capO(cx, a, b, 3.9, far ? PAL.silvFar : PAL.silv, white, .8);
    if(white) return;
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d, nx = -uy, ny = ux;
    const q = k => ({x:a.x + dx * k, y:a.y + dy * k});
    [.1, .9].forEach(k => { const p = q(k); cx.strokeStyle = PAL.iceD; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(p.x + nx * 1.8, p.y + ny * 1.8); cx.lineTo(p.x - nx * 1.8, p.y - ny * 1.8); cx.stroke(); });
    cx.strokeStyle = 'rgba(255,255,255,.75)'; cx.lineWidth = .6;
    const l0 = q(.22), l1 = q(.74); cx.beginPath(); cx.moveTo(l0.x + nx * 1, l0.y + ny * 1); cx.lineTo(l1.x + nx * 1.1, l1.y + ny * 1.1); cx.stroke();
    const m = q(.5); gem(cx, m.x, m.y, 1.15, false, 0);
  }

  // Small Valkyrie pauldron with wing-inspired feather contours (near shoulder only)
  function pauldron(cx, S, white){
    const A = S.aN, ul = Math.sin(S.lean), uu = -Math.cos(S.lean), fx = Math.cos(S.lean), fy = Math.sin(S.lean);
    const at = (a, b) => [A.s.x + ul * a + fx * b, A.s.y + uu * a + fy * b];
    cx.save(); cx.lineJoin = 'round';
    [[at(.6, -1), at(5, -3.4), at(2.4, -.2)]].forEach(f3 => {   // small wing feather sweeping back
      fillPoly(cx, f3, PAL.silvL, white, .9);
    });
    const dx = A.el.x - A.s.x, dy = A.el.y - A.s.y, d = Math.hypot(dx, dy) || 1;
    const e = {x:A.s.x + dx / d * 4.2, y:A.s.y + dy / d * 4.2}, s0 = {x:A.s.x - dx / d * .6, y:A.s.y - dy / d * .6};
    capO(cx, s0, e, 5, PAL.silv, white, 1);
    if(!white){
      cx.strokeStyle = 'rgba(255,255,255,.85)'; cx.lineWidth = .7; cx.beginPath(); cx.arc(A.s.x, A.s.y, 2.5, -2.6, -.9); cx.stroke();
      cx.fillStyle = PAL.gem; cx.beginPath(); cx.arc(A.s.x + dx / d * 1.9, A.s.y + dy / d * 1.9, 1, 0, 7); cx.fill();
    }
    cx.restore();
  }

  // Small decorative silver hip plate with an ice crystal (near hip)
  function hipPlate(cx, S, white){
    const ul = Math.sin(S.lean), uu = -Math.cos(S.lean), fx = Math.cos(S.lean), fy = Math.sin(S.lean);
    const pt = (a, b) => [S.pel.x + ul * a + fx * b, S.pel.y + uu * a + fy * b];
    cx.save(); cx.lineJoin = 'round';
    fillPoly(cx, [pt(-3.2, 1), pt(-3.6, 4.6), pt(-1.4, 6.2), pt(2.2, 5.8), pt(2.8, 2.4), pt(1.2, .6)], PAL.silv, white, 1.3);
    if(!white){
      fillPoly(cx, [pt(-3.6, 4.4), pt(-6.2, 4.8), pt(-3.8, 6.4)], PAL.ice, false, .9);   // hanging crystal shard
      const g = pt(-.3, 3.4); gem(cx, g[0], g[1], 1.5, false, 0);
      cx.strokeStyle = 'rgba(255,255,255,.8)'; cx.lineWidth = .6; const a = pt(1.8, 1.4), b = pt(2, 4.8); cx.beginPath(); cx.moveTo(a[0], a[1]); cx.lineTo(b[0], b[1]); cx.stroke();
    }
    cx.restore();
  }

  // Near arm redrawn after the face (so a raised arm correctly passes in front of the head): bare skin + bracer + pauldron + bare hand
  function nearArm(cx, S, white){
    const A = S.aN, skin = PAL.skin;
    capO(cx, A.s, A.el, 3.6, skin, white); capO(cx, A.el, A.hand, 3.2, skin, white);
    bracer(cx, A, false, white);
    pauldron(cx, S, white);
    cx.fillStyle = OUT; cx.beginPath(); cx.arc(A.hand.x, A.hand.y, 2.6 + OW, 0, 7); cx.fill();
    cx.fillStyle = white ? '#fff' : skin; cx.beginPath(); cx.arc(A.hand.x, A.hand.y, 2.6, 0, 7); cx.fill();
  }

  // ---------------------------------------------------------------------------------------------
  // EFFECT PIECES
  // ---------------------------------------------------------------------------------------------
  // drifting cyan-white motes around her (a restrained storm aura)
  function motes(cx, X, t, n){
    for(let i = 0; i < n; i++){
      const ph = fract(t * (.32 + .07 * (i % 3)) + i * .173), y = -4 - ph * 54, x = Math.sin(i * 12.9 + t * 1.3) * (11 + (i % 4) * 3.5) - 2;
      cx.fillStyle = i % 2 ? `rgba(255,255,255,${Math.sin(ph * Math.PI) * .9})` : `rgba(80,235,255,${Math.sin(ph * Math.PI) * .9})`;
      cx.beginPath(); cx.arc(x, y, .7 + (i % 3) * .25, 0, 7); cx.fill();
    }
  }

  // small electrical discharges around her boots
  function footArcs(cx, S, t, run, ult){
    [S.lN, S.lF].forEach((lg, i) => {
      if(fract(t * 1.9 + i * .47) > .15 + .3 * run + .4 * clamp(ult, 0, 1)) return;
      const x0 = lg.ankle.x + 1 + (i ? -2 : 2), y0 = lg.ankle.y + 1.5, seed = Math.floor(t * 16) + i * 7;
      const pts = getLightningPath(x0, y0, x0 + (i ? -7 : 8), y0 - 2.5 - hash(seed) * 3, 3, 2.4, seed);
      strokeLightning(cx, pts, 'rgba(0,229,255,.8)', '#fff', 1.7, .6);
    });
  }

  // Storm Gathering: sparks spiral into both blade tips; sky bolts feed them
  function gather(cx, f, X, t){
    const k = X.casting ? .35 + .65 * X.castP : .5;
    [f.bladeN, f.bladeF].forEach((b, bi) => {
      if(!b) return;
      for(let i = 0; i < 8; i++){
        const u = fract(t * 2.2 + i / 8 + bi * .3), r = 30 * (1 - u) + 2, a = i * 2.4 + t * 3;
        cx.fillStyle = i % 2 ? `rgba(255,255,255,${u})` : `rgba(80,235,255,${u})`;
        cx.beginPath(); cx.arc(b.tip.x + Math.cos(a) * r, b.tip.y + Math.sin(a) * r * .8, 1.05, 0, 7); cx.fill();
      }
      if(fract(t * 7 + bi * .5) < .35 * k){
        const seed = Math.floor(t * 14) + bi * 3;
        const pts = getLightningPath(b.tip.x + (hash(seed) - .5) * 34, b.tip.y - 120, b.tip.x, b.tip.y, 7, 9, seed);
        strokeLightning(cx, pts, `rgba(0,229,255,${.55 * k})`, `rgba(255,255,255,${.9})`, 2.4, .9);
      }
    });
  }

  // Lightning afterimage silhouettes (world space, drawn under the bodies)
  function drawGhosts(cx, X, t){
    for(const g of X.ghosts){
      const k = clamp((t - g.t0) / g.life, 0, 1), a = g.a * Math.pow(1 - k, 1.3);
      if(a <= .01) continue;
      cx.save(); cx.translate(g.x, g.y); cx.scale(g.face, 1); cx.lineCap = 'round'; cx.lineJoin = 'round';
      const col = `rgba(90,228,255,${a})`;
      const lim = (p0, p1, p2, w) => { cap(cx, p0, p1, w, col); cap(cx, p1, p2, w * .9, col); };
      lim(g.aF.s, g.aF.el, g.aF.hand, 3.4); lim(g.lF.hip, g.lF.knee, g.lF.ankle, 4.4);
      cap(cx, g.pel, g.sh, 8, col); lim(g.lN.hip, g.lN.knee, g.lN.ankle, 4.6); lim(g.aN.s, g.aN.el, g.aN.hand, 3.4);
      cx.fillStyle = col; cx.beginPath(); cx.arc(g.head.x, g.head.y, 5.6, 0, 7); cx.fill();
      cx.restore();
    }
  }

  // Thunderstep: thunderclap burst at the start, sharp streaks behind her, sparks dispersing at the end (world space)
  function drawThunderstep(cx, f, X, t){
    const D = X.dash; if(!D) return;
    const age = t - D.t0, cyc = 'rgba(0,229,255,', wht = 'rgba(255,255,255,';
    cx.save(); cx.lineCap = 'round'; cx.lineJoin = 'round';
    const bx = D.x0, by = D.y0 - 22;
    if(age < .24){   // brief cyan-white electrical explosion where the dash began
      const k = age / .24, r = 7 + 15 * Math.sqrt(k);
      cx.globalCompositeOperation = 'lighter';
      const g = cx.createRadialGradient(bx, by, 0, bx, by, r);
      g.addColorStop(0, wht + (.95 * (1 - k)) + ')'); g.addColorStop(.5, 'rgba(120,240,255,' + (.5 * (1 - k)) + ')'); g.addColorStop(1, cyc + '0)');
      cx.fillStyle = g; cx.beginPath(); cx.arc(bx, by, r, 0, 7); cx.fill();
      cx.globalCompositeOperation = 'source-over';
      for(let i = 0; i < 6; i++){
        const a = i / 6 * TAU + hash(i) * .5, r0 = r * .4, r1 = r * (.9 + hash(i + 4) * .5);
        const pts = getLightningPath(bx + Math.cos(a) * r0, by + Math.sin(a) * r0, bx + Math.cos(a) * r1, by + Math.sin(a) * r1, 3, 2.6, i * 3.7 + Math.floor(age * 40));
        strokeLightning(cx, pts, cyc + (.8 * (1 - k)) + ')', wht + (1 - k) + ')', 2, .8);
      }
    }
    // sharp lightning streaks trailing behind her
    const head = D.end ? D.end : {x:f.x, y:f.y}, fa = D.end ? clamp(1 - (t - D.end.t) / .3, 0, 1) : 1;
    if(fa > 0){
      const back = D.face, ex = head.x - back * 4 * 0, dist = Math.abs(ex - D.x0), reach = Math.max(dist, 26);
      for(let i = 0; i < 3; i++){
        const oy = (i - 1) * 9 - 22, x1 = ex - back * 2, x0 = ex - back * reach;
        const pts = getLightningPath(x0, head.y + oy + (hash(i) - .5) * 4, x1, head.y + oy, 5, 4.5, Math.floor(t * 30) + i * 5.3);
        strokeLightning(cx, pts, cyc + (.7 * fa) + ')', wht + (.95 * fa) + ')', 3 - i * .5, 1.1);
      }
    }
    if(D.end){   // sparks dispersing at the end position
      const e = clamp((t - D.end.t) / .4, 0, 1);
      for(let i = 0; i < 10; i++){
        const a = hash(i * 2.1) * TAU, sp = 14 + hash(i + 6) * 26, rr = sp * Math.sqrt(e);
        cx.fillStyle = (i % 2 ? wht : 'rgba(80,235,255,') + (1 - e) + ')';
        cx.beginPath(); cx.arc(D.end.x + Math.cos(a) * rr, D.end.y - 20 + Math.sin(a) * rr * .8, 1.2 * (1 - e * .6), 0, 7); cx.fill();
      }
    }
    cx.restore();
  }

  // Celestial Tempest (world space). Phase 1 (gathering) is drawn on her; phases 2-4 here:
  //   2 Celestial Storm - electrical field along the platforms, sky bolts that link to her blades, flashes with every strike
  //   3 Tempest Assault - (afterimages + crossing blade trails, from tick / behind)
  //   4 Final Discharge - brilliant burst from both blades, lightning impact, particles dissipating
  function drawTempest(cx, f, X, t, G){
    const face = f.face || 1, storm = X.storm, fin = X.fin;
    if(!storm && !(fin && t - fin.t0 < 1.2)) return;
    const WW = typeof W === 'number' ? W : 880, HH = typeof H === 'number' ? H : 495;
    const w2 = p => p ? {x:f.x + p.x * face, y:f.y + p.y} : null;
    cx.save(); cx.lineCap = 'round'; cx.lineJoin = 'round';
    if(storm && storm.t > storm.cast * .6){
      const I = clamp((storm.t - storm.cast * .6) / 1.2, 0, 1) * (storm.t > storm.dur - .6 ? clamp((storm.dur - storm.t) / .6, 0, 1) : 1) * (.55 + .45 * X.k);
      // flash with every real bolt (G.bolts are the arena's actual strikes)
      let fl = 0; if(G && G.bolts) for(const b of G.bolts) fl = Math.max(fl, b.life / b.max);
      if(fl > 0){ cx.globalCompositeOperation = 'lighter'; cx.fillStyle = `rgba(120,230,255,${.09 * fl * I})`; cx.fillRect(-60, -60, WW + 120, HH + 120); cx.globalCompositeOperation = 'source-over'; }
      // electrical field crawling along the platforms
      const P = (G && G.P) || [];
      let arcs = 0;
      P.forEach((p, pi) => {
        cx.globalCompositeOperation = 'lighter';
        const g = cx.createLinearGradient(0, p.y - 20, 0, p.y);
        g.addColorStop(0, 'rgba(0,229,255,0)'); g.addColorStop(1, `rgba(60,225,255,${.17 * I})`);
        cx.fillStyle = g; cx.fillRect(p.x, p.y - 20, p.w, 20);
        cx.globalCompositeOperation = 'source-over';
        const n = 1 + Math.floor(X.k * 2);
        for(let i = 0; i < n && arcs < 8; i++, arcs++){
          if(Math.sin(t * 23 + pi * 3.1 + i * 5.7) < -.25) continue;
          const x0 = p.x + 8 + fract((storm.t * (.3 + .1 * i) + pi * .37 + i * .5)) * Math.max(10, p.w - 40), seed = Math.floor(t * 18) + pi * 11 + i;
          const pts = getLightningPath(x0, p.y - 1, x0 + 28, p.y - 1 - hash(seed) * 5, 5, 3.4, seed);
          strokeLightning(cx, pts, `rgba(0,229,255,${.6 * I})`, `rgba(255,255,255,${.95 * I})`, 1.8, .7);
        }
      });
      // sky bolts that connect with her blades
      const period = lerp(.9, .38, X.k), cycN = Math.floor(storm.t / period), u = (storm.t % period) / period;
      if(u < .24){
        [w2(f.bladeN && f.bladeN.tip), w2(f.bladeF && f.bladeF.tip)].forEach((tp, bi) => {
          if(!tp || (bi === 1 && hash(cycN * 1.7) < .5)) return;
          const sx = tp.x + (hash(cycN + bi * 9) - .5) * 70, pts = getLightningPath(sx, Math.max(-10, tp.y - 300), tp.x, tp.y, 9, 11, cycN * 3.3 + bi);
          const a = 1 - u / .24;
          strokeLightning(cx, pts, `rgba(0,229,255,${.6 * a * I})`, `rgba(255,255,255,${a * I})`, 4.2, 1.5);
          cx.globalCompositeOperation = 'lighter'; const gg = cx.createRadialGradient(tp.x, tp.y, 0, tp.x, tp.y, 16);
          gg.addColorStop(0, `rgba(255,255,255,${.8 * a * I})`); gg.addColorStop(1, 'rgba(0,229,255,0)'); cx.fillStyle = gg; cx.beginPath(); cx.arc(tp.x, tp.y, 16, 0, 7); cx.fill(); cx.globalCompositeOperation = 'source-over';
        });
      }
    }
    if(fin){   // Phase 4 - final discharge
      const a = t - fin.t0;
      const tips = [w2(f.bladeN && f.bladeN.tip), w2(f.bladeF && f.bladeF.tip)].filter(Boolean);
      if(a < .45){
        const k = a / .45;
        tips.forEach((tp, bi) => {
          cx.globalCompositeOperation = 'lighter';
          const r = 12 + 40 * Math.sqrt(k), g = cx.createRadialGradient(tp.x, tp.y, 0, tp.x, tp.y, r);
          g.addColorStop(0, `rgba(255,255,255,${.95 * (1 - k)})`); g.addColorStop(.4, `rgba(130,245,255,${.6 * (1 - k)})`); g.addColorStop(1, 'rgba(0,229,255,0)');
          cx.fillStyle = g; cx.beginPath(); cx.arc(tp.x, tp.y, r, 0, 7); cx.fill(); cx.globalCompositeOperation = 'source-over';
          for(let i = 0; i < 8; i++){
            const an = i / 8 * TAU + bi, r1 = r * (.8 + hash(i + bi * 5) * .7);
            const pts = getLightningPath(tp.x, tp.y, tp.x + Math.cos(an) * r1, tp.y + Math.sin(an) * r1, 4, 4, i * 2.9 + Math.floor(a * 30) + bi);
            strokeLightning(cx, pts, `rgba(0,229,255,${.8 * (1 - k)})`, `rgba(255,255,255,${1 - k})`, 2.4, .9);
          }
        });
      }
      if(a > .1 && a < .6){   // dramatic lightning impact
        const k = (a - .1) / .5, x0 = f.x + face * 12;
        const pts = getLightningPath(x0, Math.max(-10, f.y - 280), x0, f.y, 10, 12, Math.floor(a * 25));
        strokeLightning(cx, pts, `rgba(0,229,255,${.85 * (1 - k)})`, `rgba(255,255,255,${1 - k})`, 9 * (1 - k * .4), 3);
        cx.strokeStyle = `rgba(0,229,255,${.9 * (1 - k)})`; cx.lineWidth = 3; cx.beginPath(); cx.ellipse(x0, f.y, 10 + 62 * k, 3 + 14 * k, 0, 0, 7); cx.stroke();
        cx.strokeStyle = `rgba(255,255,255,${1 - k})`; cx.lineWidth = 1.3; cx.beginPath(); cx.ellipse(x0, f.y, 8 + 52 * k, 2 + 11 * k, 0, 0, 7); cx.stroke();
      }
      if(a > .3){   // electrical particles gradually dissipate
        const e = clamp((a - .3) / .85, 0, 1);
        for(let i = 0; i < 22; i++){
          const an = hash(i * 1.9) * TAU, sp = 18 + hash(i + 3) * 50;
          cx.fillStyle = (i % 2 ? 'rgba(255,255,255,' : 'rgba(80,235,255,') + (1 - e) + ')';
          cx.beginPath(); cx.arc(f.x + Math.cos(an) * sp * e, f.y - 24 + Math.sin(an) * sp * e * .8 - 22 * e, 1.3 * (1 - e * .5), 0, 7); cx.fill();
        }
      }
    }
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
      foot:  {len: 7.2,  w: 3.2},
      noRings: 1   // visual only: no dark joint rings on the bare skin
    },

    // Frozen Celestial palette. Arms / thighs / hands are bare skin; armor is layered on top by torso(), foot() and front().
    colors: {
      shirt:   PAL.ice,
      limb:    PAL.skin,
      far:     PAL.skinSh,
      head:    PAL.skin,
      dark:    PAL.silvD,   // pelvis disc (hidden under the hip plate)
      hand:    PAL.skin,
      legs:    PAL.skin,
      legsFar: PAL.skinSh
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
      if(A.skill === 'skyfall' || A.skill === 'stormofruin'){   // calling lightning: both blades raised to the sky and held
        const up = (a, b) => K(p, [[0, a], [.3, b], [1, b]]);
        tg.aN = up(G0.aN, 2.6); tg.eN = up(G0.eN, .55); tg.aF = up(G0.aF, 2.45); tg.eF = up(G0.eF, .7);
        tg.lean = up(G0.lean, -.14); tg.head = up(0, .25);
        tg.tN = G0.tN; tg.kN = G0.kN; tg.tF = G0.tF; tg.kF = G0.kF;
        return;
      }
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

    // Boots (called right after each leg is drawn, so far / near order is always right):
    // bare thigh above, silver knee guard, knee-high armored Valkyrie boot with reinforced sole and frost engravings
    foot(cx, leg, P, white, f, far){
      const col = far ? PAL.silvFar : PAL.silv, planted = leg.planted, phi = planted ? 0 : clamp(-leg.sa * .5, -.8, .8);
      const lift = planted ? clamp((leg.hip.x - leg.ankle.x - 2) * .12, 0, 3.5) : 0;
      const a = {x:leg.ankle.x - 1.5, y:leg.ankle.y - lift}, b = {x:leg.ankle.x + (7.2 - 1.5) * Math.cos(phi), y:leg.ankle.y + (7.2 - 1.5) * Math.sin(phi)};
      const kx = leg.knee.x, ky = leg.knee.y, dx = leg.ankle.x - kx, dy = leg.ankle.y - ky, dl = Math.hypot(dx, dy) || 1, ux = dx / dl, uy = dy / dl, nx = -uy, ny = ux;
      const at = (k, o) => ({x:kx + dx * k + nx * o, y:ky + dy * k + ny * o});
      // shaft (greave) + foot
      capO(cx, {x:kx + ux * 1, y:ky + uy * 1}, leg.ankle, 4.9, col, white);
      capO(cx, a, b, 3.8, col, white);
      if(!white){
        cap(cx, {x:a.x + .6, y:a.y + 1.7}, {x:b.x, y:b.y + 1.7}, 1.3, PAL.steel);                       // reinforced sole
        cap(cx, {x:b.x - 2.2, y:b.y - .3}, {x:b.x - .2, y:b.y - .1}, 2.6, PAL.ice);                      // ice-blue toe cap
        const t0 = at(.2, 2.6), t1 = at(.2, -2.6);                                                        // ice-blue boot-top trim
        cx.strokeStyle = PAL.iceD; cx.lineWidth = 1.2; cx.beginPath(); cx.moveTo(t0.x, t0.y); cx.lineTo(t1.x, t1.y); cx.stroke();
        cx.strokeStyle = 'rgba(255,255,255,.8)'; cx.lineWidth = .6;                                       // frost engravings
        const e0 = at(.38, .8), e1 = at(.78, .2), e2 = at(.46, -.9), e3 = at(.7, -1.2);
        cx.beginPath(); cx.moveTo(e0.x, e0.y); cx.lineTo(e1.x, e1.y); cx.moveTo(e2.x, e2.y); cx.lineTo(e3.x, e3.y); cx.stroke();
        const c0 = at(.88, 2.4), c1 = at(.88, -2.4);                                                      // subtle cyan energy accent
        cx.strokeStyle = 'rgba(51,230,255,.9)'; cx.lineWidth = .9; cx.beginPath(); cx.moveTo(c0.x, c0.y); cx.lineTo(c1.x, c1.y); cx.stroke();
      }
      // knee guard: silver disc with an ice gem
      cx.fillStyle = OUT; cx.beginPath(); cx.arc(kx, ky, 3.3 + OW * .8, 0, 7); cx.fill();
      cx.fillStyle = white ? '#fff' : col; cx.beginPath(); cx.arc(kx, ky, 3.3, 0, 7); cx.fill();
      if(!white){
        cx.strokeStyle = 'rgba(255,255,255,.85)'; cx.lineWidth = .7; cx.beginPath(); cx.arc(kx, ky, 2.7, 3.4, 4.9); cx.stroke();
        gem(cx, kx, ky, 1.75, false, 0);
      }
    },

    // Torso hook (runs right after the far arm + far leg): far bracer, rear skirt panel, neck, midriff, straps, heart breastplate.
    torso(cx, S, B, P, white){
      const f = cur.f, X = cur.X;
      if(f && !cur.ff) bracer(cx, S.aF, true, white);          // far arm was just drawn; when it swings in front the bracer is drawn in front() instead
      skirtPanel(cx, S, X, false, white);                       // rear skirt panel
      const ul = Math.sin(S.lean), uu = -Math.cos(S.lean), fx = Math.cos(S.lean), fy = Math.sin(S.lean);
      const pt = (a, b) => [S.pel.x + ul * a + fx * b, S.pel.y + uu * a + fy * b];
      const skin = white ? '#fff' : PAL.skin;
      cx.save(); cx.lineJoin = 'round'; cx.lineCap = 'round';
      // neck
      capO(cx, {x:pt(11, .2)[0], y:pt(11, .2)[1]}, S.head, 3.4, PAL.skin, white);
      // torso silhouette: defined waist, curvy bust and hips
      const sil = [pt(-.5, -4.6), pt(2.2, -3.7), pt(4.6, -3.1), pt(7.2, -3.6), pt(10.2, -4.2), pt(12.5, -3.2), pt(13.2, -.6), pt(12.9, 2), pt(11.6, 4.4), pt(9.4, 5.8), pt(7.3, 4.9), pt(5.3, 3.2), pt(3.1, 3.6), pt(.9, 4.7), pt(-.6, 5)];
      cx.beginPath(); smooth(cx, sil, true); cx.fillStyle = skin; cx.fill(); cx.strokeStyle = OUT; cx.lineWidth = OW; cx.stroke();
      if(!white){
        // crossed silver straps on the back (back stays partly exposed) + small ice fasteners
        [[pt(2.6, -4), pt(8.6, -.3)], [pt(8.4, -4.1), pt(2.8, -.5)]].forEach(([p0, p1]) => capO(cx, {x:p0[0], y:p0[1]}, {x:p1[0], y:p1[1]}, 1.3, PAL.silv, false, .7));
        const fx0 = pt(5.6, -2.2); gem(cx, fx0[0], fx0[1], 1.25, false, 0);
        // waist band
        const w0 = pt(1.2, -4.5), w1 = pt(1.2, 4.9); capO(cx, {x:w0[0], y:w0[1]}, {x:w1[0], y:w1[1]}, 1.5, PAL.silv, false, .8);
        const wg = pt(1.2, 3.3); cx.fillStyle = PAL.gem; cx.beginPath(); cx.arc(wg[0], wg[1], .8, 0, 7); cx.fill();
      }
      // heart-shaped Valkyrie breastplate
      const heart = [pt(6.2, 1), pt(7.3, 3.6), pt(9.6, 5.7), pt(11.8, 5.2), pt(12.9, 3.4), pt(12, 1.5), pt(12.9, -.4), pt(12.4, -2.6), pt(10.4, -4), pt(8, -3.6), pt(6.6, -1.6)];
      cx.beginPath(); smooth(cx, heart, true);
      if(white) cx.fillStyle = '#fff';
      else{ const g = cx.createLinearGradient(...pt(13, -3), ...pt(6, 5)); g.addColorStop(0, PAL.silvL); g.addColorStop(.5, PAL.silv); g.addColorStop(1, PAL.silvD); cx.fillStyle = g; }
      cx.fill(); cx.strokeStyle = OUT; cx.lineWidth = OW; cx.stroke();
      if(!white){
        cx.strokeStyle = 'rgba(255,255,255,.7)'; cx.lineWidth = .6;   // subtle frost engravings radiating from the gem
        const g0 = pt(9.3, 1.3);
        [[11.9, 3.6], [11.2, -2.6], [7.5, 3.1]].forEach(([a, b]) => { const q = pt(a, b); cx.beginPath(); cx.moveTo(g0[0], g0[1]); cx.lineTo(q[0], q[1]); cx.stroke(); });
        cx.strokeStyle = 'rgba(255,255,255,.9)'; cx.lineWidth = .8; cx.beginPath(); const h0 = pt(12.3, -2.2), h1 = pt(10.6, -3.5); cx.moveTo(h0[0], h0[1]); cx.lineTo(h1[0], h1[1]); cx.stroke();
        gem(cx, g0[0], g0[1], 2.1, false, clamp(X ? X.en - .2 : 0, 0, 1) * .8);   // central ice-blue gemstone
      }
      cx.restore();
    },

    // Behind hook: aura, hair, blade trails, Far blade (when not farFront)
    behind(cx, f, t, S, P){
      const A = f.A || {};
      const atk = f.atk > 0;
      const charging = f.charging && f.chg > 0;
      const chgLvl = clamp((f.chg || 0) / (A.chargeMax || 1), 0, 1);
      const isFarFront = f.atk > 0 && [1, 2, 3, 4].includes(A.step || 0);
      const white = f.flash > 0;
      const X = tick(f, t, S);
      cur.f = f; cur.X = X; cur.t = t; cur.ff = isFarFront;
      const run = clamp(Math.abs(f.vx || 0) / 170, 0, 1);

      cx.save();
      cx.lineCap = 'round'; cx.lineJoin = 'round';

      // restrained storm aura + drifting motes (never noisy at idle)
      if(!white){
        const ax = (S.pel.x + S.sh.x) / 2, ay = (S.pel.y + S.sh.y) / 2, rad = 26 + 8 * X.en + 14 * clamp(X.ult, 0, 1.3);
        cx.globalCompositeOperation = 'lighter';
        const g = cx.createRadialGradient(ax, ay, 2, ax, ay, rad);
        g.addColorStop(0, `rgba(60,225,255,${.10 + .07 * X.en + .12 * clamp(X.ult, 0, 1.3)})`); g.addColorStop(1, 'rgba(0,180,216,0)');
        cx.fillStyle = g; cx.beginPath(); cx.arc(ax, ay, rad, 0, 7); cx.fill();
        cx.globalCompositeOperation = 'source-over';
        motes(cx, X, t, 5 + Math.round(10 * clamp(X.ult, 0, 1)));
      }

      // Lightning trails following both blades (thin while moving, stronger while attacking / in the storm)
      const strong = atk || !!X.storm;
      [['N', 1], ['F', .8]].forEach(([k, sc]) => {
        const a = X.tr[k];
        if(a.length < 2) return;
        for(let i = 1; i < a.length; i++){
          const q = i / a.length, p0 = a[i - 1], p1 = a[i];
          const x0 = (p0.x - f.x) * (f.face || 1), y0 = p0.y - f.y, x1 = (p1.x - f.x) * (f.face || 1), y1 = p1.y - f.y;
          cx.strokeStyle = `rgba(0, 229, 255, ${(.1 + .6 * q) * (strong ? 1 : .55)})`; cx.lineWidth = (1 + 3.6 * q) * sc * (strong ? 1 : .6);
          cx.beginPath(); cx.moveTo(x0, y0); cx.lineTo(x1, y1); cx.stroke();
          cx.strokeStyle = `rgba(255,255,255,${.7 * q})`; cx.lineWidth = .8 * sc;
          cx.beginPath(); cx.moveTo(x0, y0); cx.lineTo(x1, y1); cx.stroke();
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

      // long flowing hair (behind everything else)
      drawHairBack(cx, f, X, white, t);

      // Draw Far Blade here if not farFront
      if(!isFarFront){
        f.bladeF = drawBlade(cx, S.aF, t, true, charging || X.ult > .5, Math.max(chgLvl, clamp(X.ult, 0, 1)), {en:X.en, white, carry:X.carry, heavy:X.heavy});
        X.tipF = {x:f.x + f.bladeF.tip.x * (f.face || 1), y:f.y + f.bladeF.tip.y};
      }

      cx.restore();
    },

    // Front hook: skirt, hip plate, face + hair + circlet, near arm, blades (near; far if farFront), inter-blade lightning, slashes, charge meter
    front(cx, f, t, S, P){
      const A = f.A || {};
      const atk = f.atk > 0;
      const charging = f.charging && f.chg > 0;
      const chgLvl = clamp((f.chg || 0) / ((f.A && f.A.chargeMax) || 1), 0, 1);
      const isFarFront = f.atk > 0 && [1, 2, 3, 4].includes(A.step || 0);
      const white = f.flash > 0;
      const X = tick(f, t, S);
      const face = f.face || 1, run = clamp(Math.abs(f.vx || 0) / 170, 0, 1);
      const rg = f.rig, ha = (S.lean || 0) + (rg && rg.j && rg.j.head ? rg.j.head.a : 0);
      const gathering = X.ult > .5 || charging, lvl = Math.max(chgLvl, clamp(X.ult, 0, 1));
      const V = {en:X.en, white, carry:X.carry, heavy:X.heavy};

      cx.save();

      // front skirt panel + hip plate + far-arm bracer when the far arm is drawn in front of the body
      skirtPanel(cx, S, X, true, white);
      hipPlate(cx, S, white);
      if(isFarFront) bracer(cx, S.aF, true, white);

      // face, front hair, Valkyrie circlet
      drawStormHeadpiece(cx, S, t, white, {ha, eye:X.eye, glow:.25 + .6 * clamp(X.ult, 0, 1) , hot:X.ult > .3});

      // near arm (bare skin + silver bracer + small wing pauldron)
      nearArm(cx, S, white);

      // Draw Far Blade here if farFront
      if(isFarFront){
        f.bladeF = drawBlade(cx, S.aF, t, true, gathering, lvl, V);
        X.tipF = {x:f.x + f.bladeF.tip.x * face, y:f.y + f.bladeF.tip.y};
      }

      // Draw Near Blade
      f.bladeN = drawBlade(cx, S.aN, t, false, gathering, lvl, V);
      X.tipN = {x:f.x + f.bladeN.tip.x * face, y:f.y + f.bladeN.tip.y};

      // ⚡ LIGHTNING TRAVELING BETWEEN BOTH BLADES ⚡
      drawInterBladeLightning(cx, f.bladeN, f.bladeF, t, gathering, lvl, atk);

      // Flashy combo slashes
      drawElectricSlash(cx, f, S);

      // Celestial Tempest, phase 1: storm gathering around both blades
      if(!white && (X.casting || X.skyCast)) gather(cx, f, X, t);

      // small electrical discharges at her feet
      if(!white && f.gr) footArcs(cx, S, t, run, X.ult);

      // Voltage meter above head while charging ATK
      if(charging){
        const x = S.head.x - 11, y = S.head.y - 13, full = chgLvl >= 1;
        cx.fillStyle = 'rgba(0,0,0,.7)'; cx.fillRect(x - 1, y - 1, 24, 5);
        cx.fillStyle = full ? (Math.sin(t * 50) > 0 ? '#ffffff' : '#00e5ff') : `rgb(${Math.round(40 + 180 * chgLvl)}, 229, 255)`;
        cx.fillRect(x, y, 22 * chgLvl, 3);
      }

      cx.restore();
    },

    // World-space effects UNDER the bodies: lightning afterimages
    fxBack(cx, f, t, G){
      const X = f.fxState && f.fxState.fx; if(!X || f.ls) return;
      drawGhosts(cx, X, t);
    },

    // World-space effects OVER the bodies: Thunderstep + Celestial Tempest
    fx(cx, f, t, G){
      const X = f.fxState && f.fxState.fx; if(!X || f.ls) return;
      drawThunderstep(cx, f, X, t);
      drawTempest(cx, f, X, t, G);
    }
  });
})();