// TITAN art - ragdoll sizes + colors, heavy stance, combo punch poses, and punch effects (charge glow, fist trail, stomp dust).
// LOOK (redesign): shirtless powerlifter, messy black hair + scarred face, black tactical pants + boots, and two industrial hydraulic + turbo GAUNTLETS (matte black, steel, orange).
// The gauntlets, head, knee pads and pockets are drawn by gauntlet() / drawHead() / kneePad() / pocket() below. Poses, punches and effects are unchanged.
// Hooks used: body (sizes), colors, pose() = idle/walk stance, attack() = punch poses, front() = effects.
// Left = near arm (aN/eN), right = far arm (aF/eF). Angles: 0 = hangs down, + = forward, 3.14 = straight up.
(() => {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // Punch timeline (p = 0..1). Every punch has the same 5 beats:
  //   0-.08 SETTLE (small dip, weight drops)  .08-R LOAD (lean back, weight on the back leg, front foot lifts, fist cocks back, slow)
  //   R-C  RELEASE (fast: front foot stomps, hips + chest drive in, fist shoots)  C = CONTACT (fist fully out = the hit window opens)
  //   C-C+.1 OVERSHOOT (arm + chest go a bit past, this is the "weight")  then slow recovery back to guard.
  // R = release start, C = contact. C must match hitFrom in skills.js: hit opens at p = 1 - hitFrom/time (jab .5, cross/hook .52, uppercut .56).
  // Leg angles are chosen so BOTH feet always reach the same ground height (no floating foot, no sinking foot).
  // key format: [[progress, value], ...]
  const GUARD = {lean:.12, aN:.75, eN:1.75, aF:.5, eF:1.9, tN:.75, kN:.62, tF:-.45, kF:.15};
  const mkPunch = (arm, R, C, v) => {
    const O = C + .1, S = C + .3, N = arm === 'N', a0 = N ? GUARD.aN : GUARD.aF, e0 = N ? GUARD.eN : GUARD.eF;
    return {arm, R, C, ch:{lean:-.32, arm:-.7, kF:.3, kN:0},   // ch = how much a full charge exaggerates the load pose
      a:[[0,a0],[.08,v.aS],[.22,v.aL],[R,v.aL - .1],[C,v.aC],[O,v.aC + .12],[S,v.aC - .05],[1,a0]],
      e:[[0,e0],[.08,e0 + .2],[.22,2.2],[R,2.25],[C,v.eC],[O,v.eC - .06],[S,v.eC + .15],[1,e0]],
      lean:[[0,GUARD.lean],[.08,0],[.22,v.lL],[R,v.lL - .04],[C,v.lC],[O,v.lC + .06],[S,v.lC - .1],[1,GUARD.lean]],
      tN:[[0,.75],[.08,.8],[.22,.85],[R,.85],[C,.9],[S,.85],[1,.75]],       // front leg: lifts + pulls back while loading, stomps forward at release
      kN:[[0,.62],[.22,1.3],[R,1.35],[C,.75],[S,.7],[1,.62]],
      tF:[[0,-.45],[.22,-.4],[R,-.4],[C,-.55],[S,-.5],[1,-.45]],            // back leg: carries the weight while loading, drives off at release
      kF:[[0,.15],[.22,.2],[R,.2],[C,.2],[1,.15]]};
  };
  const JAB   = mkPunch('N', .36, .5,  {aS:.3,  aL:-.45, aC:1.5,  eC:.2,  lL:-.2,  lC:.46});
  const JAB2  = mkPunch('N', .36, .5,  {aS:.35, aL:-.35, aC:1.58, eC:.16, lL:-.18, lC:.5});
  const CROSS = mkPunch('F', .38, .52, {aS:.15, aL:-.8,  aC:1.5,  eC:.12, lL:-.3,  lC:.58});
  const HOOK  = mkPunch('N', .38, .52, {aS:.4,  aL:-1.0, aC:1.55, eC:.75, lL:-.28, lC:.55});
  const UPPER = {arm:'F', R:.42, C:.56, ch:{lean:.1, arm:-.3, kF:.3, kN:.25},
    a:[[0,.5],[.1,-.1],[.25,-.6],[.42,-.65],[.56,2.4],[.66,2.55],[.84,2.4],[1,.5]],
    e:[[0,1.9],[.25,1.2],[.42,1.1],[.56,.5],[.66,.4],[.84,.6],[1,1.9]],
    lean:[[0,.12],[.1,.3],[.25,.55],[.42,.58],[.56,-.2],[.66,-.28],[.84,-.12],[1,.12]],   // squats low, then explodes up and leans back with the arc
    tN:[[0,.75],[.25,.85],[.42,.85],[.56,.35],[.84,.35],[1,.75]], kN:[[0,.62],[.25,1.5],[.42,1.5],[.56,.15],[.84,.2],[1,.62]],
    tF:[[0,-.45],[.25,-.5],[.42,-.5],[.56,-.3],[.84,-.3],[1,-.45]], kF:[[0,.15],[.25,.5],[.42,.5],[.56,.1],[.84,.1],[1,.15]]};
  const COMBO = [JAB, JAB2, CROSS, HOOK, UPPER];
  const REL = COMBO.map(c => c.C);                       // contact moment of each step (for effects)

  const SZ = 1.15;                                       // TITAN SIZE: 1 = old, 1.15 = a bit bigger, 1.3 = huge
  const sz = o => { const r = {}; for(const k in o) r[k] = {}; for(const k in o) for(const j in o[k]) r[k][j] = +(o[k][j] * SZ).toFixed(2); return r; };

  // ---------- LOOK HELPERS (drawing only, no gameplay) ----------
  const ORG = '#ff7a1a', ORG_HOT = '#ffc15a', MATTE = '#1b1d22', STEEL = '#5b6571', STEEL_D = '#39404a', STEEL_L = '#a3afbc', OUT = '#0b0f1c';
  const cur = {f:null, ff:false, sN:null, sF:null};          // per-frame look state, filled in farFront() and read by torso() / front()
  const OW = 1.5;                                          // outline width for the gear
  const mixP = (a, b, k) => ({x:a.x + (b.x - a.x) * k, y:a.y + (b.y - a.y) * k});
  // flat plate along the arm from k0 to k1 (half widths o0 -> o1), rounded corners. Reads as armor plating instead of a round tube.
  const slab = (cx, P, k0, k1, o0, o1, col, out) => {
    const a = P(k0, -o0), b = P(k1, -o1), c = P(k1, o1), d = P(k0, o0);
    cx.lineJoin = 'round'; cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); cx.lineTo(c.x, c.y); cx.lineTo(d.x, d.y); cx.closePath();
    if(out){ cx.strokeStyle = OUT; cx.lineWidth = OW * 2 + 1.6; cx.stroke(); }
    cx.strokeStyle = col; cx.lineWidth = 1.6; cx.stroke(); cx.fillStyle = col; cx.fill();
  };
  const cap = (cx, a, b, w, col, out) => { if(out) Body.capsule(cx, a, b, w + OW * 2, OUT); Body.capsule(cx, a, b, w, col); };

  // what one gauntlet is doing right now. comp = hydraulics compressed (0..1), burst = turbo exhaust firing (0..1), glow = orange indicators (0..1)
  function armState(f, arm, t){
    const A = f.A || {}, st = {comp:0, burst:0, glow:.14 + .05 * Math.sin(t * 2)};
    if(f.atk > 0){
      const p = clamp(1 - f.atk / (A.time || .5), 0, 1), L = A.cl || 0;
      if(!A.skill){
        const P = COMBO[A.step || 0];
        if(P.arm === arm){
          st.comp = p < P.R ? clamp(p / (P.R * .8), 0, 1) : clamp(1 - (p - P.R) / .12, 0, 1);
          st.burst = (p >= P.R && p < P.C + .2) ? clamp(1 - (p - P.R) / (P.C + .2 - P.R), 0, 1) : 0;
          st.glow = Math.max(st.glow, st.comp * .6, st.burst, L * .8);
        } else st.glow = .22;
      } else if(A.skill === 'shockwave'){
        if(arm === 'N'){ st.comp = p < .25 ? p / .25 : 0; st.burst = (p >= .25 && p < .5) ? 1 - (p - .25) / .25 : 0; st.glow = Math.max(.3, st.burst, st.comp * .6); }
      } else if(A.skill === 'rush'){
        st.comp = .3; st.burst = .6 + .2 * Math.sin(t * 40); st.glow = .9;
      } else if(A.skill === 'quake'){
        st.comp = p < .4 ? p / .4 : (p < .52 ? 1 : Math.max(0, 1 - (p - .52) / .1));
        st.burst = (p >= .52 && p < .75) ? 1 - (p - .52) / .23 : 0; st.glow = Math.max(.25, st.comp * .5, st.burst);
      }
    }
    if(f.charging && f.chg > 0) st.glow = Math.max(st.glow, .6 + .4 * clamp(A.cl || 0, 0, 1));
    return st;
  }

  // One gauntlet along the forearm (el -> hand). Matte black bracer, steel knuckle block, hydraulic pistons on top (they compress while loading),
  // a mini turbine near the elbow, an exhaust vent behind it (flame burst on release) and orange panels / indicators.
  function gauntlet(cx, Arm, st, white, spin){
    const el = Arm.el, hd = Arm.hand, dx = hd.x - el.x, dy = hd.y - el.y, len = Math.hypot(dx, dy) || 1;
    const u = {x:dx / len, y:dy / len}, n = {x:u.y, y:-u.x};      // u = along the arm, n = "top" side
    const W = 10.8 * SZ, R = 5.5 * SZ, kE = 1 + (R * .85) / len;   // width, hand radius, end of the knuckle block
    const P = (k, o) => ({x:el.x + u.x * len * k + n.x * (o || 0), y:el.y + u.y * len * k + n.y * (o || 0)});
    const c = col => white ? '#fff' : col, hot = st.glow > .55, g = st.glow;
    const accent = white ? '#fff' : (hot ? ORG_HOT : (g > .3 ? '#ff8f2e' : ORG));

    // turbo exhaust flame (behind the elbow, pushes the gauntlet forward)
    if(st.burst > .02 && !white){
      const b = st.burst, tip = P(-.2 - (.35 + .8 * b), 0), a = P(-.2, -W * .34), z = P(-.2, W * .34);
      cx.fillStyle = 'rgba(255,120,30,' + (.85 * b) + ')'; cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(tip.x, tip.y); cx.lineTo(z.x, z.y); cx.closePath(); cx.fill();
      const tip2 = P(-.2 - (.2 + .5 * b), 0), a2 = P(-.2, -W * .16), z2 = P(-.2, W * .16);
      cx.fillStyle = 'rgba(255,240,200,' + (.9 * b) + ')'; cx.beginPath(); cx.moveTo(a2.x, a2.y); cx.lineTo(tip2.x, tip2.y); cx.lineTo(z2.x, z2.y); cx.closePath(); cx.fill();
    }
    // lower piston (thin) + upper piston (main), drawn under the bracer so the bracer reads as the heavy part
    const rodEnd = .55 + .3 * (1 - st.comp);
    cap(cx, P(.08, W * .5), P(.42, W * .5), 2.6 * SZ, c(STEEL_D), true); cap(cx, P(.4, W * .5), P(rodEnd - .08, W * .5), 1.5 * SZ, c(STEEL_L), false);
    // main bracer
    slab(cx, P, -.08, .78, W * .5, W * .4, c(MATTE), true);
    // armor ridge highlight (top edge) so the matte plate has some shape
    if(!white) cap(cx, P(.02, -W * .4), P(.72, -W * .34), 1.1, 'rgba(160,175,195,.3)', false);
    // orange accent panel + indicator light
    slab(cx, P, .5, .74, W * .05, W * .32, accent, false);
    if(!white){ cap(cx, P(.54, W * .18), P(.7, W * .22), .9, 'rgba(0,0,0,.5)', false); }
    // rear exhaust ring with vent slits
    slab(cx, P, -.2, -.08, W * .4, W * .44, c(STEEL_D), true);
    if(!white){ for(let i = -1; i <= 1; i++) cap(cx, P(-.15, i * W * .17 - 1), P(-.15, i * W * .17 + 1), 1.1, i === 0 && g > .3 ? accent : '#0b0f1c', false); }
    // turbine: housing, spinning blades, glowing hub
    const tc = P(.28, 0), tr = 3.9 * SZ;
    cx.fillStyle = OUT; cx.beginPath(); cx.arc(tc.x, tc.y, tr + OW, 0, 7); cx.fill();
    cx.fillStyle = c(STEEL_D); cx.beginPath(); cx.arc(tc.x, tc.y, tr, 0, 7); cx.fill();
    if(!white){
      cx.strokeStyle = STEEL_L; cx.lineWidth = 1; cx.lineCap = 'round';
      for(let i = 0; i < 6; i++){ const a = spin + i * Math.PI / 3; cx.beginPath(); cx.moveTo(tc.x + Math.cos(a) * 1, tc.y + Math.sin(a) * 1); cx.lineTo(tc.x + Math.cos(a + .35) * (tr - .7), tc.y + Math.sin(a + .35) * (tr - .7)); cx.stroke(); }
      cx.strokeStyle = accent; cx.lineWidth = 1; cx.beginPath(); cx.arc(tc.x, tc.y, tr - .2, 0, 7); cx.stroke();
      cx.fillStyle = accent; cx.beginPath(); cx.arc(tc.x, tc.y, 1.15, 0, 7); cx.fill();
    }
    // wrist cuff + knuckle block (heavy steel) with orange band and studs
    slab(cx, P, .74, kE, W * .5, W * .56, c(STEEL), true);
    if(!white){
      cap(cx, P(.8, -W * .5), P(.8, W * .5), 1.6, accent, false);
      cap(cx, P(.84, -W * .42), P(kE - .04, -W * .46), 1, 'rgba(255,255,255,.22)', false);
      const e = P(kE, 0);
      for(let i = -1; i <= 1; i++){ const q = {x:e.x + n.x * i * W * .3 - u.x * 1.6, y:e.y + n.y * i * W * .3 - u.y * 1.6}; cx.fillStyle = OUT; cx.beginPath(); cx.arc(q.x, q.y, 1.9, 0, 7); cx.fill(); cx.fillStyle = st.burst > .1 ? ORG_HOT : STEEL_L; cx.beginPath(); cx.arc(q.x, q.y, 1.2, 0, 7); cx.fill(); }
    }
    // upper piston rod mount on top of the knuckle block (drawn last so it sits on the plate)
    cap(cx, P(.1, -W * .5), P(.5, -W * .5), 3 * SZ, c(STEEL_D), true);
    cap(cx, P(.46, -W * .5), P(rodEnd, -W * .5), 1.8 * SZ, c(STEEL_L), true);
    if(!white){ const m = P(rodEnd, -W * .5); cx.fillStyle = accent; cx.beginPath(); cx.arc(m.x, m.y, 1.2, 0, 7); cx.fill(); }
    // glow halo when the system is engaged
    if(g > .45 && !white){
      const h = P(.5, 0), gr = cx.createRadialGradient(h.x, h.y, 1, h.x, h.y, 13 * SZ);
      gr.addColorStop(0, 'rgba(255,140,40,' + (.4 * g) + ')'); gr.addColorStop(1, 'rgba(255,120,20,0)');
      cx.fillStyle = gr; cx.beginPath(); cx.arc(h.x, h.y, 13 * SZ, 0, 7); cx.fill();
    }
  }

  // head: skin, short messy black hair, dark brown eyes, scars, relaxed smirk. Drawn over the default head + visor. a = head angle (0 = upright), face looks +x.
  function drawHead(cx, S, P, white, ang){
    const R = 5.8 * SZ, H = S.head;
    cx.save(); cx.translate(H.x, H.y); cx.rotate(ang); cx.lineJoin = 'round'; cx.lineCap = 'round';
    cx.fillStyle = OUT; cx.beginPath(); cx.arc(0, 0, R + 1.6, 0, 7); cx.fill();
    cx.fillStyle = white ? '#fff' : P.head; cx.beginPath(); cx.arc(0, 0, R, 0, 7); cx.fill();
    if(!white){
      // ear
      cx.fillStyle = '#c48a60'; cx.beginPath(); cx.arc(-.14 * R, .16 * R, .2 * R, 0, 7); cx.fill();
      // jaw shade + stubble
      cx.strokeStyle = 'rgba(120,80,50,.38)'; cx.lineWidth = 2.2; cx.beginPath(); cx.arc(0, 0, R * .8, .15, 1.55); cx.stroke();
      // nose
      cx.fillStyle = OUT; cx.beginPath(); cx.arc(R * .99, .16 * R, .15 * R + .8, 0, 7); cx.fill();
      cx.fillStyle = P.head; cx.beginPath(); cx.arc(R * .99, .16 * R, .15 * R, 0, 7); cx.fill();
      // eye (dark brown) + brow, relaxed
      cx.fillStyle = '#f4eee6'; cx.beginPath(); cx.ellipse(.46 * R, -.04 * R, .24 * R, .17 * R, 0, 0, 7); cx.fill();
      cx.fillStyle = '#4a2c1a'; cx.beginPath(); cx.arc(.52 * R, -.03 * R, .14 * R, 0, 7); cx.fill();
      cx.fillStyle = '#120a06'; cx.beginPath(); cx.arc(.54 * R, -.03 * R, .07 * R, 0, 7); cx.fill();
      cx.strokeStyle = '#16100c'; cx.lineWidth = 1.2; cx.beginPath(); cx.moveTo(.16 * R, -.24 * R); cx.lineTo(.72 * R, -.22 * R); cx.stroke();
      cx.lineWidth = 1.1; cx.beginPath(); cx.moveTo(.2 * R, -.1 * R); cx.lineTo(.68 * R, -.1 * R); cx.stroke();        // lowered lid = calm, confident look
      // scars: through the brow and across the cheek
      cx.strokeStyle = '#c4665a'; cx.lineWidth = .9;
      cx.beginPath(); cx.moveTo(.34 * R, -.46 * R); cx.lineTo(.5 * R, .1 * R); cx.stroke();
      cx.lineWidth = .6; [-.3, -.05].forEach(y => { cx.beginPath(); cx.moveTo(.31 * R + (y + .3) * .2 * R, y * R); cx.lineTo(.5 * R + (y + .3) * .2 * R, (y + .02) * R); cx.stroke(); });
      cx.lineWidth = .9; cx.strokeStyle = '#d0786a'; cx.beginPath(); cx.moveTo(.18 * R, .3 * R); cx.lineTo(.62 * R, .5 * R); cx.stroke();
      // slight smirk
      cx.strokeStyle = '#4e2a1f'; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(.4 * R, .55 * R); cx.quadraticCurveTo(.62 * R, .62 * R, .84 * R, .48 * R); cx.stroke();
    }
    // messy short hair: spiky cap over the top + back, hairline curves up over the forehead
    cx.fillStyle = white ? '#fff' : '#0d0c10'; cx.strokeStyle = OUT; cx.lineWidth = .9;
    cx.beginPath();
    const N = 12, a0 = -1.05, a1 = -3.75;
    for(let i = 0; i <= N; i++){
      const a = a0 + (a1 - a0) * i / N, spike = (i % 2 ? 1.5 : .2) + ((i * 7) % 3) * .3, rr = R + .3 + spike * (i === 0 || i === N ? .3 : 1);
      const x = Math.cos(a) * rr, y = Math.sin(a) * rr; i ? cx.lineTo(x, y) : cx.moveTo(x, y);
    }
    cx.quadraticCurveTo(.05 * R, -.5 * R, Math.cos(a0) * R * .96, Math.sin(a0) * R * .96);
    cx.closePath(); cx.fill(); cx.stroke();
    if(!white){ cx.strokeStyle = 'rgba(120,130,160,.35)'; cx.lineWidth = .7; cx.beginPath(); cx.arc(0, 0, R * .82, -2.3, -1.1); cx.stroke(); }   // faint hair sheen
    cx.restore();
  }

  // black tactical pants details: reinforced knee pad (tiny orange trim) + cargo pocket with a strap
  function kneePad(cx, leg, white){
    const k = leg.knee, r = 4.6 * SZ;
    cx.fillStyle = OUT; cx.beginPath(); cx.arc(k.x + 1, k.y, r + OW, 0, 7); cx.fill();
    cx.fillStyle = white ? '#fff' : '#23262c'; cx.beginPath(); cx.arc(k.x + 1, k.y, r, 0, 7); cx.fill();
    if(!white){ cx.strokeStyle = STEEL; cx.lineWidth = 1; cx.beginPath(); cx.arc(k.x + 1, k.y, r * .68, -2.2, 1.4); cx.stroke();
      cx.strokeStyle = ORG; cx.lineWidth = 1.2; cx.lineCap = 'round'; cx.beginPath(); cx.arc(k.x + 1, k.y, r * .68, -1.0, -.1); cx.stroke(); }
  }
  function pocket(cx, leg, white){
    if(white) return;
    const h = leg.hip, k = leg.knee, m = mixP(h, k, .5), a = Math.atan2(k.y - h.y, k.x - h.x), th = 11.5 * SZ / 2;
    cx.save(); cx.translate(m.x, m.y); cx.rotate(a);
    cx.fillStyle = '#272a31'; cx.strokeStyle = OUT; cx.lineWidth = .9;
    cx.beginPath(); cx.rect(-2.9 * SZ, -th + .6, 5.8 * SZ, 3.8 * SZ); cx.fill(); cx.stroke();              // cargo pocket on the front of the thigh
    cx.strokeStyle = '#3d424b'; cx.lineWidth = .6; cx.beginPath(); cx.moveTo(-2.4 * SZ, -th + 1.7); cx.lineTo(2.4 * SZ, -th + 1.7); cx.stroke();   // flap seam
    cx.strokeStyle = '#2f333a'; cx.lineWidth = 1.7; cx.beginPath(); cx.moveTo(4.2 * SZ, -th - .6); cx.lineTo(4.2 * SZ, th + .6); cx.stroke();        // strap around the thigh
    cx.fillStyle = ORG; cx.fillRect(3.5 * SZ, -th + .6, 1.4 * SZ, 1.6);                                                                          // tiny orange buckle
    cx.restore();
  }

  Characters.art('titan', {
    // ragdoll sizes. torso w only sets neck height now (the torso is drawn by torso() below). Hitbox stays 30x52.
    // SZ = overall size (1 = old size). Every body size below and the drawn torso scale together, so the proportions stay the same.
    body: sz({head:{r:5.8}, torso:{len:13, w:15}, uArm:{len:9, w:11.2}, fArm:{len:9, w:9.4}, hand:{r:5.5},
              thigh:{len:10, w:10.4}, shin:{len:9.5, w:8.4}, foot:{len:9, w:4.6}}),
    // skin for torso/arms, dark trousers for legs (legs / legsFar), dark boots
    colors: {shirt:'#d29a6e', limb:'#c48a60', far:'#9a6642', head:'#dba577', dark:'#14161a', hand:'#1b1d22', legs:'#1c1e23', legsFar:'#121418'},   // skin for the upper body, black tactical pants + boots, gauntlets are drawn on top

    // the far (right) arm is ALWAYS drawn first, behind the chest, also while it punches, so it never starts in the armpit.
    // (this hook runs once per frame before the body is drawn, so it also prepares the gauntlet state)
    farFront: f => {
      const t = performance.now() / 1000, sN = armState(f, 'N', t), sF = armState(f, 'F', t);
      const dt = f.gT ? clamp(t - f.gT, 0, .05) : 0; f.gT = t; f.gSpin = (f.gSpin || 0) + dt * (3 + 34 * Math.max(sN.glow, sF.glow));   // turbines spin faster when engaged
      cur.f = f; cur.ff = false; cur.sN = sN; cur.sF = sF;
      return false;
    },

    // bodybuilder torso: narrow waist, wide back (lats), big chest, deltoid caps, thick neck. Drawn in torso space (a = up, b = forward).
    torso(cx, S, B, P, white){
      // far leg gear + far gauntlet (far arm was just drawn, so put the gear on it now; when the far arm punches it is drawn later in front())
      pocket(cx, S.lF, white); kneePad(cx, S.lF, white);
      if(cur.f && !cur.ff) gauntlet(cx, S.aF, cur.sF, white, cur.f.gSpin || 0);
      const l = S.lean, ux = Math.sin(l), uy = -Math.cos(l), fx = Math.cos(l), fy = Math.sin(l);
      const pt = (a, b) => ({x:S.pel.x + (ux * a + fx * b) * SZ, y:S.pel.y + (uy * a + fy * b) * SZ});
      const skin = white ? '#fff' : P.shirt, shade = white ? '#fff' : '#a8704a', OUT = B.outline;
      cx.lineJoin = 'round';
      const blob = pts => {            // smooth closed shape through the points
        const mid = (p, q) => ({x:(p.x + q.x) / 2, y:(p.y + q.y) / 2}), n = pts.length, m0 = mid(pts[n - 1], pts[0]);
        cx.beginPath(); cx.moveTo(m0.x, m0.y);
        for(let i = 0; i < n; i++){ const m = mid(pts[i], pts[(i + 1) % n]); cx.quadraticCurveTo(pts[i].x, pts[i].y, m.x, m.y); }
        cx.closePath();
      };
      // neck (under the head)
      Body.capsule(cx, pt(11, 1), pt(17.5, 1.5), 8 * SZ + B.outlineW * 2, OUT); Body.capsule(cx, pt(11, 1), pt(17.5, 1.5), 8 * SZ, skin);
      // main torso
      blob([pt(-1,-5.5), pt(4,-7.2), pt(9,-9.8), pt(13.5,-8.2), pt(15.2,-2), pt(15.2,3), pt(13.8,8), pt(10.5,11.2), pt(7,9.8), pt(3,7.6), pt(-1,6.5)]);
      cx.fillStyle = skin; cx.fill(); cx.strokeStyle = OUT; cx.lineWidth = B.outlineW; cx.stroke();
      // pec line, abs, center line
      if(!white){
        cx.strokeStyle = shade; cx.lineWidth = 1.1; cx.lineCap = 'round';
        const q = (a, b, c, d, e, g) => { const s = pt(a, b), m = pt(c, d), e2 = pt(e, g); cx.beginPath(); cx.moveTo(s.x, s.y); cx.quadraticCurveTo(m.x, m.y, e2.x, e2.y); cx.stroke(); };
        q(9.3, 1.5, 7.6, 7, 9.6, 10.4);                                     // under the pec
        [2.2, 4.6, 6.9].forEach(a => q(a, .8, a - .4, 3.6, a, 6.8));         // abs rows
        q(0, 3.6, 3.5, 3.6, 7, 3.6);                                        // center line
      }
      // deltoid caps (shoulders): far one first, near one on top
      const delt = (A, r, c) => { cx.beginPath(); cx.arc(A.s.x, A.s.y, r, 0, 7); cx.fillStyle = c; cx.fill(); cx.strokeStyle = OUT; cx.lineWidth = B.outlineW; cx.stroke(); };
      delt(S.aF, 6.2 * SZ, white ? '#fff' : P.far); delt(S.aN, 7 * SZ, white ? '#fff' : '#e0a97c');
      if(!white){   // trapezius slope + chest highlight = heavier powerlifter upper body
        const tr = [pt(12.5,-3.2), pt(14.2,-6.2), pt(15.4,-2), pt(14.4,2.4), pt(12.2,3)];
        blob(tr); cx.fillStyle = skin; cx.fill();
        cx.strokeStyle = 'rgba(255,225,190,.35)'; cx.lineWidth = 1.2; const a = pt(12.6, 2.4), m = pt(11.2, 5.4), e = pt(12.8, 8.2);
        cx.beginPath(); cx.moveTo(a.x, a.y); cx.quadraticCurveTo(m.x, m.y, e.x, e.y); cx.stroke();
      }
    },

    // heavy-duty combat boot (replaces the default foot): thick black shaft over the pants + chunky foot, one thin orange trim line
    foot(cx, leg, P, white, f, far){
      const w = 5.3 * 1.25, len = 9 * SZ, planted = leg.planted, phi = planted ? 0 : clamp(-leg.sa * .5, -.8, .8);
      const lift = planted ? clamp((leg.hip.x - leg.ankle.x - 2) * .12, 0, 3.5) : 0, col = white ? '#fff' : (far ? '#0d0e11' : '#15171b');
      const a = {x:leg.ankle.x - 1.5, y:leg.ankle.y - lift}, b = {x:leg.ankle.x + (len - 1.5) * Math.cos(phi), y:leg.ankle.y + (len - 1.5) * Math.sin(phi)};
      const top = mixP(leg.ankle, leg.knee, .3);
      Body.capsule(cx, a, b, w + OW * 2, OUT); Body.capsule(cx, a, top, 8.2 + OW * 2, OUT);
      Body.capsule(cx, a, b, w, col); Body.capsule(cx, a, top, 8.2, col);
      if(!white){
        Body.capsule(cx, {x:a.x + 1, y:a.y + w * .38}, {x:b.x, y:b.y + w * .38}, 1.3, '#2e3138');                      // sole line
        Body.capsule(cx, {x:b.x - 2.4, y:b.y - .6}, {x:b.x, y:b.y - .2}, w * .8, '#23262c');                           // toe cap
        const q = mixP(leg.ankle, leg.knee, .26), nx = leg.knee.y - leg.ankle.y, ny = -(leg.knee.x - leg.ankle.x), nl = Math.hypot(nx, ny) || 1;
        Body.capsule(cx, {x:q.x - nx / nl * 3.9, y:q.y - ny / nl * 3.9}, {x:q.x + nx / nl * 3.9, y:q.y + ny / nl * 3.9}, 1, ORG);     // thin orange trim at the boot top
      }
    },

    // heavy stance: feet wide apart on both sides of the hips (front foot ahead, back foot behind), knees bent, chest up with a slight forward lean,
    // fists by the chin, slow deep breathing. Fades out when running.
    pose(tg, f, t, run){
      const w = 1 - run, b = Math.sin(t * 1.7), L = (k, v) => tg[k] + (v - tg[k]) * w;
      tg.lean = L('lean', GUARD.lean + b * .02); tg.head = L('head', -.05 + b * .02);
      tg.aN = L('aN', GUARD.aN + b * .03); tg.eN = L('eN', GUARD.eN); tg.aF = L('aF', GUARD.aF + b * .03); tg.eF = L('eF', GUARD.eF);
      tg.tN = L('tN', GUARD.tN); tg.kN = L('kN', GUARD.kN); tg.tF = L('tF', GUARD.tF); tg.kF = L('kF', GUARD.kF);
    },

    // joint spring per phase: soft while loading (heavy, slow), very stiff at the release (snaps, no lag), medium on the recovery
    spring(p, A){
      if(A.skill) return A.skill === 'quake' ? (p < .5 ? {k:220, d:26} : {k:1300, d:75}) : {k:1000, d:64};   // skills: quick snap (the ultimate winds up slow, then slams)
      const P = COMBO[A.step || 0];
      if(p < P.R - .04 || (A.chg > 0 && p < P.R + .002)) return {k:A.chg > 0 ? 420 : 260, d:A.chg > 0 ? 34 : 28};   // loading / holding the charge: soft and heavy
      if(p < P.C + .08) return A.cl > 0 ? {k:1500, d:80} : {k:1100, d:66};                                         // release: snap (stiffer when charged)
      return {k:240, d:26};
    },

    attack(tg, p, A, K){
      // SKILL poses (simple defaults, design later): shockwave = one arm punches along the aim, rush = shoulder down and driving, quake = arms up then slam
      if(A.skill === 'shockwave'){
        const a = A.aimA == null ? 1.55 : A.aimA;                                  // arm angle toward the aim (0 down, 1.57 forward, 3.14 up)
        tg.aN = K(p, [[0,-.5],[.25,a],[.7,a],[1,GUARD.aN]]); tg.eN = K(p, [[0,2],[.25,.12],[.7,.15],[1,GUARD.eN]]);
        tg.aF = GUARD.aF; tg.eF = GUARD.eF; tg.lean = K(p, [[0,-.1],[.25,.4],[.7,.3],[1,GUARD.lean]]); tg.head = -tg.lean * .4;
        tg.tN = .85; tg.kN = .7; tg.tF = -.5; tg.kF = .2; return;
      }
      if(A.skill === 'rush'){
        const s = Math.sin(p * 45);
        tg.lean = 1; tg.head = .25; tg.aN = .9; tg.eN = 1.5; tg.aF = .6; tg.eF = 1.6;
        tg.tN = .7 + s * .5; tg.kN = .9; tg.tF = -.7 - s * .5; tg.kF = .5; return;
      }
      if(A.skill === 'quake'){
        tg.aN = K(p, [[0,GUARD.aN],[.4,2.9],[.52,2.9],[.62,.9],[1,GUARD.aN]]); tg.eN = K(p, [[0,GUARD.eN],[.4,.3],[.52,.3],[.62,.5],[1,GUARD.eN]]);
        tg.aF = K(p, [[0,GUARD.aF],[.4,2.7],[.52,2.7],[.62,.8],[1,GUARD.aF]]); tg.eF = K(p, [[0,GUARD.eF],[.4,.4],[.52,.4],[.62,.6],[1,GUARD.eF]]);
        tg.lean = K(p, [[0,GUARD.lean],[.4,-.4],[.52,-.4],[.62,.75],[.85,.6],[1,GUARD.lean]]); tg.head = K(p, [[0,0],[.52,.1],[.62,.5],[1,0]]) - tg.lean * .3;
        tg.tN = .85; tg.kN = K(p, [[0,GUARD.kN],[.52,.4],[.62,1.5],[1,GUARD.kN]]); tg.tF = -.5; tg.kF = K(p, [[0,GUARD.kF],[.62,.9],[1,GUARD.kF]]); return;
      }
      const P = COMBO[A.step || 0], hit = P.arm, guard = hit === 'N' ? 'F' : 'N';
      tg['a' + hit] = K(p, P.a); tg['e' + hit] = K(p, P.e);
      tg['a' + guard] = K(p, [[0,GUARD['a' + guard]],[.25,.85],[P.C,.4],[1,GUARD['a' + guard]]]); tg['e' + guard] = 1.9;   // back hand pulls in on the punch
      tg.lean = K(p, P.lean);
      tg.tN = K(p, P.tN); tg.kN = K(p, P.kN); tg.tF = K(p, P.tF); tg.kF = K(p, P.kF);
      const L = A.cl || 0;                                  // charge level 0..1: deeper load while held , bigger drive on release
      if(L > 0){
        const wl = K(p, [[0,0],[.22,1],[P.R,1],[P.C,0],[1,0]]), wc = K(p, [[0,0],[P.R,0],[P.C,1],[P.C + .2,.6],[1,0]]);
        tg.lean += P.ch.lean * L * wl + .14 * L * wc;
        tg['a' + hit] += P.ch.arm * L * wl;
        tg.kF += P.ch.kF * L * wl; tg.kN += P.ch.kN * L * wl;
      }
      tg.head = -tg.lean * .4;
      if(A.chg > 0 || L > 0) tg.head = Math.max(tg.head, (.12 + .4 * L) - tg.lean);   // charging: head bows down (more the longer you hold), even though the chest leans back
    },

    // Forcebreaker shockwave: a crescent of orange arcs flying along its direction (s = {x, y, r, vx, vy})
    shot(cx, s, t){
      cx.save(); cx.translate(s.x, s.y); cx.rotate(Math.atan2(s.vy || 0, s.vx)); cx.lineCap = 'round';
      for(let i = 0; i < 3; i++){
        cx.strokeStyle = 'rgba(255,' + (140 + i * 45) + ',60,' + (.9 - i * .25) + ')'; cx.lineWidth = 5 - i;
        cx.beginPath(); cx.arc(-i * 9, 0, s.r * 1.7 * (1 + i * .15), -1, 1); cx.stroke();
      }
      cx.fillStyle = 'rgba(255,240,210,.9)'; cx.beginPath(); cx.arc(2, 0, s.r * .45, 0, 7); cx.fill();
      cx.restore();
    },

    // charge meter above the head while holding ATK
    front(cx, f, t, S, P){
      const white = f.flash > 0;
      pocket(cx, S.lN, white); kneePad(cx, S.lN, white);                                                // near leg gear
      drawHead(cx, S, P, white, S.lean + ((f.rig && f.rig.j.head.a) || 0));                              // face + hair over the default head
      if(cur.f === f){
        if(cur.ff) gauntlet(cx, S.aF, cur.sF, white, f.gSpin || 0);                                      // far arm punching: it is in front of the body now
        gauntlet(cx, S.aN, cur.sN, white, f.gSpin || 0);                                                 // near gauntlet always on top
      }
      if(!f.charging || !(f.chg > 0)) return;
      const r = clamp(f.chg / ((f.A && f.A.chargeMax) || 1), 0, 1), x = S.head.x - 11 * SZ, y = S.head.y - 12 * SZ, full = r >= 1;
      cx.fillStyle = 'rgba(0,0,0,.65)'; cx.fillRect(x - 1, y - 1, 24, 5);
      cx.fillStyle = full ? (Math.sin(t * 50) > 0 ? '#fff' : '#ffd36b') : 'rgb(255,' + Math.round(130 + 90 * r) + ',30)';
      cx.fillRect(x, y, 22 * r, 3);
    },

    // effects (drawn BEHIND the body so arms/fists stay visible): orange charge glow on the punching fist while loading, bright trail + flash + ground shock + dust on release
    behind(cx, f, t, S){
      const A = f.A || {}, atk = f.atk > 0 && !A.skill, step = A.step || 0;
      const p = atk ? clamp(1 - f.atk / A.time, 0, 1) : -1, rel = REL[step], L = A.cl || 0, big = 1 + 1.6 * L;
      const H = atk ? (COMBO[step].arm === 'N' ? S.aN.hand : S.aF.hand) : null;
      const st = f.tz || (f.tz = {pts:[], face:f.face});
      if(st.face !== f.face){ st.pts.length = 0; st.face = f.face; }
      const last = st.pts[st.pts.length - 1];
      if(H && (!last || last.t !== t)) st.pts.push({x:H.x, y:H.y, t});
      while(st.pts.length && t - st.pts[0].t > .13) st.pts.shift();
      cx.lineCap = 'round';

      // fist trail (the punch is easy to see)
      if(p > rel - .06 && p < .95 && st.pts.length > 1){
        for(let pass = 0; pass < 2; pass++) for(let i = 1; i < st.pts.length; i++){
          const k = i / st.pts.length;
          cx.strokeStyle = pass ? 'rgba(255,245,220,' + (.2 + .6 * k) + ')' : 'rgba(255,130,30,' + (.15 + .55 * k) + ')';
          cx.lineWidth = (2.5 + 8 * k) * (pass ? .4 : 1) * (1 + L);
          cx.beginPath(); cx.moveTo(st.pts[i-1].x, st.pts[i-1].y); cx.lineTo(st.pts[i].x, st.pts[i].y); cx.stroke();
        }
      }
      // LOAD: charge glow + sparks flowing into the fist, glowing ring on the ground
      if(H && p >= 0 && p < rel){
        const k = Math.max(clamp(p / rel, 0, 1), f.charging ? .7 + .3 * L : 0), pulse = L >= 1 ? .6 + .4 * Math.sin(t * 60) : .75 + .25 * Math.sin(t * 30), r = 5 + 11 * k + 16 * L;
        const g = cx.createRadialGradient(H.x, H.y, 1, H.x, H.y, r);
        g.addColorStop(0, 'rgba(255,230,160,' + (.85 * k * pulse) + ')'); g.addColorStop(.5, 'rgba(255,130,30,' + (.55 * k) + ')'); g.addColorStop(1, 'rgba(255,100,20,0)');
        cx.fillStyle = g; cx.beginPath(); cx.arc(H.x, H.y, r, 0, 7); cx.fill();
        cx.fillStyle = 'rgba(255,190,90,.9)';
        for(let i = 0; i < 5 + Math.round(7 * L); i++){ const a = t * 9 + i * 1.26, d = (1 - ((t * 3 + i * .2) % 1)) * 17 * (.4 + .6 * k); cx.beginPath(); cx.arc(H.x + Math.cos(a) * d, H.y + Math.sin(a) * d, 1.3, 0, 7); cx.fill(); }
        cx.strokeStyle = 'rgba(255,150,40,' + (.25 + .45 * k) + ')'; cx.lineWidth = 1.6;
        cx.beginPath(); cx.ellipse(S.pel.x - 2, 1, 8 + 16 * k + 14 * L, 2.2 + 1.8 * k + 2 * L, 0, 0, 7); cx.stroke();
      }
      // RELEASE: flash on the fist, shock ring + dust at the front foot
      if(p >= rel && p < rel + .24){
        const k = (p - rel) / .24, fx = S.lN.ankle.x + 3;
        if(H){
          cx.fillStyle = 'rgba(255,245,220,' + (.6 * (1 - k)) + ')'; cx.beginPath(); cx.arc(H.x, H.y, (5 + 11 * k) * big, 0, 7); cx.fill();
          cx.strokeStyle = 'rgba(255,130,30,' + (1 - k) + ')'; cx.lineWidth = 3 * (1 - k) + .5; cx.beginPath(); cx.arc(H.x, H.y, (8 + 18 * k) * big, 0, 7); cx.stroke();
        }
        cx.strokeStyle = 'rgba(255,200,120,' + (.9 * (1 - k)) + ')'; cx.lineWidth = 2;
        cx.beginPath(); cx.ellipse(fx, 1, (6 + 32 * k) * big, (1.5 + 5 * k) * big, 0, 0, 7); cx.stroke();
        cx.fillStyle = '#b9b2a8';
        for(let i = 0; i < 6 + Math.round(6 * L); i++){ cx.globalAlpha = .55 * (1 - k); cx.beginPath(); cx.arc(fx + (i - 2.5) * 7 * (.5 + k) * big, -k * (3 + i % 3 * 3) * big, 2 + 3 * k, 0, 7); cx.fill(); }
        cx.globalAlpha = 1;
      }
    }
  });
})();