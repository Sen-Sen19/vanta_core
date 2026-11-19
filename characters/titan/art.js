// TITAN art - ragdoll sizes + colors, heavy stance, combo punch poses, and punch effects (charge glow, fist trail, stomp dust).
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

  Characters.art('titan', {
    // ragdoll sizes. torso w only sets neck height now (the torso is drawn by torso() below). Hitbox stays 30x52.
    // SZ = overall size (1 = old size). Every body size below and the drawn torso scale together, so the proportions stay the same.
    body: sz({head:{r:5.8}, torso:{len:13, w:15}, uArm:{len:9, w:9.2}, fArm:{len:9, w:8.4}, hand:{r:5.5},
              thigh:{len:10, w:9}, shin:{len:9.5, w:7.4}, foot:{len:9, w:4.6}}),
    // skin for torso/arms, dark trousers for legs (legs / legsFar), dark boots
    colors: {shirt:'#d29a6e', limb:'#c48a60', far:'#9a6642', head:'#dba577', dark:'#1f2227', hand:'#6b7684', legs:'#3a3f47', legsFar:'#2c3037'},

    // when the RIGHT (far) arm punches, draw it over the body so it is visible
    farFront: f => f.atk > 0 && COMBO[(f.A && f.A.step) || 0].arm === 'F',

    // bodybuilder torso: narrow waist, wide back (lats), big chest, deltoid caps, thick neck. Drawn in torso space (a = up, b = forward).
    torso(cx, S, B, P, white){
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
    front(cx, f, t, S){
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