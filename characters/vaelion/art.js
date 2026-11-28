// VAELION art - THE ASCENDANT SERAPH. Same shared ragdoll (body.js); only the LOOK and the wing rig live here. PHASE 1: body, wings, wing animation (no combat poses yet).
// Look: bare-chested athletic man, blonde swept-back hair with long straight locks, uncovered calm face, white combat trousers with gold geometric trim, gunmetal knee guards,
//       a segmented gunmetal spine on his back, and TWO mechanical angel wings (white chrome feathers, gold edges, gunmetal arm struts + actuators).
// Hooks used: body (sizes), colors, pose() = calm idle / walk stance, behind() = wing state + FAR wing + the near wing's long feathers, torso() = skin torso, spine, wing mounts + the near wing's
//             arm and covert feathers (so the near wing really grows out of his back), foot() = boots, knee guards and trouser trim (drawn at the right layer for the near and far leg),
//             front() = face, hair, near-arm gear.
// Wings: each wing = a 3-bone arm (root -> elbow -> wrist) + 19 separate mechanical feathers in 3 rows (lower = long primaries, middle = secondaries, upper = short coverts).
//        Every feather has its own anchor on the arm and its own angle, blended between a FOLDED set and a SPREAD set by one number (open 0..1). No physics: a few springs (open, elevation, bank, lean lag).
// Wing state is cosmetic only and kept in f._wg (never sent online). A wingbeat is detected from f.fly.n (counted by arena.js) so the guest sees it too.
(() => {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const DEG = Math.PI / 180;
  const KEYS = (p, k) => Body.keys(p, k);

  // ---- palette: white chrome + gold + gunmetal. Skin / hair / trousers. ----
  const OUT = '#2e3544', LINE = '#5a6479';
  const SKIN = '#edc3a3', SKIN_L = '#f8dcc4', SKIN_D = '#d3a084', SKIN_F = '#c4917a';
  const GM = '#505a6b', GM_D = '#2f3746', GM_L = '#7a8598';
  const GOLD = '#d8a63a', GOLD_L = '#ffe39a', GOLD_D = '#a07a24';
  const HAIR = '#ecd06e', HAIR_L = '#fff3bd', HAIR_D = '#b88f34', HAIR_O = '#8a6a26';
  const TROU = '#f4f6fb', TROU_F = '#c3cad8';
  const mixc = (a, b, k) => { const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16); const m = s => Math.round(lerp(A >> s & 255, B >> s & 255, k)); return 'rgb(' + m(16) + ',' + m(8) + ',' + m(0) + ')'; };
  // feather palettes: c0 (lit leading edge) -> c3 (shaded trailing edge). The far wing is the same chrome, just dimmer and cooler (it is farther from the viewer).
  const PAL = [
    {c0:'#ffffff', c1:'#eef2f8', c2:'#c8d0df', c3:'#a2adc3', line:'#56607a', gm:GM, gmd:GM_D, gold:GOLD, goldL:GOLD_L},
    {c0:mixc('#ffffff', '#6f7a96', .34), c1:mixc('#eef2f8', '#6f7a96', .34), c2:mixc('#c8d0df', '#4a5470', .38), c3:mixc('#a2adc3', '#3a4258', .4), line:'#3f485f', gm:'#3d4658', gmd:'#252c3a', gold:'#b48a2e', goldL:'#d9bd72'}
  ];

  // ---- body sizes (visual only; the hitbox stays 30x52). Head is tiny here because the real face is drawn in front() over it. ----
  const TL = 14, TW = 10, UW = 4.8, FW = 4.4, HR = 2.6, OW = 1.2;

  // ---- WING TABLES. Angles in degrees, canvas convention (0 = forward, 90 = down, -90 = up, -180 = straight back). Index 0 = leading (top) feather, last = trailing (bottom).
  //   aS = spread angle, aF = folded angle (feathers hang down behind the back), len = length, u0..u1 = where along the arm the feathers are anchored, lf = length factor when folded.
  const ROWS = [
    {id:'lower',  n:7, u0:.58, u1:1.0, wid:6.8, len:[37, 42, 46, 48, 46, 41, 34], aS:[-170, -184, -198, -212, -225, -238, -250], aF:[-247, -250, -253, -256, -259, -262, -265], lf:.78},
    {id:'middle', n:6, u0:.24, u1:.68, wid:7.8, len:[31, 34, 36, 35, 32, 27],       aS:[-156, -174, -192, -210, -227, -244],      aF:[-244, -247, -250, -253, -256, -259],      lf:.78},
    {id:'upper',  n:6, u0:.03, u1:.86, wid:6.0, len:[19, 21, 22, 21, 19, 16],       aS:[-140, -158, -176, -194, -211, -228],      aF:[-239, -242, -245, -248, -251, -254],      lf:.8}
  ];

  let CUR = null;   // set by behind() (it always runs first each frame): torso() / front() have no direct access to the fighter

  // ---- small helpers (local space: origin = feet, x = forward, y = down) ----
  function rr(cx, x, y, w, h, r){ cx.beginPath(); if(cx.roundRect) cx.roundRect(x, y, w, h, r); else cx.rect(x, y, w, h); }
  function cap(cx, a, b, w, col, lw, oc){   // outlined round capsule
    cx.lineCap = 'round'; cx.strokeStyle = oc || OUT; cx.lineWidth = w + (lw == null ? 1.4 : lw); cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); cx.stroke();
    cx.strokeStyle = col; cx.lineWidth = w; cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); cx.stroke();
  }
  const lp = (a, b, k) => ({x:a.x + (b.x - a.x) * k, y:a.y + (b.y - a.y) * k});
  function disc(cx, x, y, r, col, oc, lw){ cx.beginPath(); cx.arc(x, y, r, 0, 7); cx.fillStyle = col; cx.fill(); if(oc){ cx.lineWidth = lw || .7; cx.strokeStyle = oc; cx.stroke(); } }
  const safe = (name, fn) => function(){ try{ return fn.apply(this, arguments); }catch(e){ if(!safe.w[name]){ safe.w[name] = 1; console.error('[vaelion art]', name, e); } } };
  safe.w = {};

  // =====================================================================================
  // WING STATE (cosmetic springs). Read from the fighter: gr, vx, vy, face, stun, fly.n
  // =====================================================================================
  function wingState(f, t, S){
    let W = f._wg;
    if(!W) W = f._wg = {t, open:f.gr ? 0 : 1, openV:0, el:0, elV:0, bank:0, bankV:0, rot:S.lean, rotV:0, beat:-1, n:f.fly ? f.fly.n : 0, vy:f.vy || 0, vxl:0, gr:!!f.gr, face:f.face, land:0, sweep:0, ph:Math.random() * 6, hv:0};
    const dt = clamp(t - W.t, 0, .05); W.t = t;
    if(!(dt > 0)) return W;                                       // hit-stop / paused: nothing moves
    const vxl = (f.vx || 0) * f.face, vy = f.vy || 0, air = !f.gr, hurt = f.stun > 0;

    // ---- events ----
    const fn = f.fly ? f.fly.n : 0;
    let trig = fn !== W.n; W.n = fn;                              // arena.js counts every takeoff jump and wingbeat in f.fly.n
    if(!f.fly && air && !hurt && vy < W.vy - 260) trig = true;    // fallback when the flight sim is not running (e.g. a preview): any sudden upward kick
    if(trig){ W.beat = 0; W.openV += 7; }
    if(f.face !== W.face){ W.bankV += (air ? 6 : 2) * f.face; W.face = f.face; }   // turning around: the wings dip asymmetrically (bank) and settle
    if(f.gr && !W.gr) W.land = clamp(W.vy / 700, .35, 1);         // landing: a short flare + press-down, then fold
    W.gr = !!f.gr; W.land = Math.max(0, W.land - dt * 2.8);
    W.vy = vy;

    // ---- targets ----
    let openT, elT;
    if(!air){
      openT = W.land > .08 ? .3 * W.land : 0;                     // folded behind his back (walking, running, standing)
      elT = Math.sin(t * 1.9 + W.ph) * .05 + W.land * .8;         // very slight mechanical breathing; landing presses the wings down
    }else{
      openT = 1; elT = .08;                                       // gliding: fully extended, held a touch below level
      const dive = vy > 380 && !hurt;
      if(vy < -60) elT = .2 - clamp(-vy / 800, 0, 1) * .12;       // climbing after a beat: wings held out and slightly down
      if(Math.abs(vy) < 48 && Math.abs(vxl) < 80) elT = .02 + Math.sin(t * 2.5 + W.ph) * .12;   // hovering: small corrections
      if(dive){ openT = lerp(1, .5, clamp((vy - 380) / 320, 0, 1)); elT = -.4; }                // diving / dropping fast: wings sweep up and partly fold
      if(hurt){ openT = .9; elT = -.5 + Math.sin(t * 30) * .1; }                                // knocked: the wings flare
    }
    if(W.beat >= 0){                                              // WINGBEAT: quick raise, hard downstroke, recover into the glide
      W.beat += dt / .26;                                        // short, snappy flap: matches the small hop (info.js cd)
      if(W.beat >= 1) W.beat = -1;
      else{ elT = KEYS(W.beat, [[0, -.05], [.2, -.75], [.5, .85], [.75, .3], [1, .1]]); openT = 1; }
    }
    // ---- springs (2 small steps = stable) ----
    const ko = openT > W.open ? [190, 24] : [80, 15], ke = W.beat >= 0 ? [560, 36] : [95, 13], h = dt / 2;
    const bankT = air ? clamp(-vxl / 260, -1, 1) * .7 : 0;
    for(let i = 0; i < 2; i++){
      W.openV += (ko[0] * (openT - W.open) - ko[1] * W.openV) * h; W.open += W.openV * h;
      W.elV += (ke[0] * (elT - W.el) - ke[1] * W.elV) * h; W.el += W.elV * h;
      W.bankV += (45 * (bankT - W.bank) - 7 * W.bankV) * h; W.bank += W.bankV * h;
      W.rotV += (40 * (S.lean - W.rot) - 8 * W.rotV) * h; W.rot += W.rotV * h;
    }
    W.open = clamp(W.open, 0, 1.04);
    W.sweep += ((air ? clamp(vxl / 300, -.4, 1) : clamp(vxl / 300, 0, 1) * .4) - W.sweep) * Math.min(1, dt * 6);   // flying forward: wings sweep back
    W.hv += (vxl - W.hv) * Math.min(1, dt * 5);                                                                    // smoothed forward speed (hair)
    W.vxl = vxl;
    const mx = f.c.fly ? f.c.fly.flaps : 0, left = f.fly && f.fly.left != null ? f.fly.left : mx;
    W.pipA = (W.pipA || 0) + ((air || left < mx ? 1 : 0) - (W.pipA || 0)) * Math.min(1, dt * 8);   // flap-energy pips fade in while he is in the air
    return W;
  }

  // =====================================================================================
  // WING GEOMETRY: arm points + every feather's anchor / angle / length for one wing
  // =====================================================================================
  function wingGeo(S, W, far, t){
    const s = clamp(W.open, 0, 1.04), lE = lerp(S.lean, W.rot, .5);
    const e = W.el + (far ? -W.bank * .6 + .1 : W.bank * .6);     // asymmetric: the two wings never move exactly together
    const rotK = .3 + .7 * Math.min(1, s * 1.25);                  // a folded wing barely flaps
    const rot = (e < 0 ? -e * 40 : -e * 54) * rotK - W.sweep * 13 * Math.min(1, s * 1.2);   // + = raised, - = lowered / swept back
    const lag = clamp(W.elV * 3.4, -30, 30) * rotK;                // feather tips lag behind the stroke
    const ex = (far ? 7 : 0) + lE / DEG;                           // far wing sits a little higher so the two fans separate; everything leans with the torso
    const l = S.lean, ux = Math.sin(l), uy = -Math.cos(l), fx = Math.cos(l), fy = Math.sin(l);
    const hh = TL * .8 + (far ? 1.2 : 0), dd = -TW / 2 + (far ? -.6 : .4);
    const Rt = {x:S.pel.x + ux * hh + fx * dd, y:S.pel.y + uy * hh + fy * dd};
    const a1 = (lerp(-98, -122, s) + rot * .9 + ex) * DEG, a2 = (lerp(-128, -160, s) + rot * 1.1 + ex + lag * .4) * DEG;
    const L1 = lerp(5, 16, s), L2 = lerp(4, 15, s);
    const E = {x:Rt.x + Math.cos(a1) * L1, y:Rt.y + Math.sin(a1) * L1}, Wp = {x:E.x + Math.cos(a2) * L2, y:E.y + Math.sin(a2) * L2};
    const onArm = u => { const d = u * (L1 + L2); return d <= L1 ? {x:Rt.x + Math.cos(a1) * d, y:Rt.y + Math.sin(a1) * d} : {x:E.x + Math.cos(a2) * (d - L1), y:E.y + Math.sin(a2) * (d - L1)}; };
    const fan = 1 - clamp(W.sweep, 0, 1) * .16 * s;
    const rows = ROWS.map((R, ri) => {
      const fe = [];
      for(let i = 0; i < R.n; i++){
        const P = onArm(R.u1 - (R.u1 - R.u0) * (i / (R.n - 1)));
        const k = R.len[i] / 48, aS = -210 + (R.aS[i] + 210) * fan;
        const flut = Math.sin(t * 1.7 + i * 1.1 + ri * 2.3 + (far ? 1.7 : 0)) * (.5 + 1.1 * s);   // subtle mechanical feather adjustments (idle, hover, glide)
        const ang = (lerp(R.aF[i], aS, s) + rot * (1 + .12 * k) + ex + lag * (.2 + .8 * k) + flut) * DEG;
        fe.push({x:P.x, y:P.y, a:ang, len:R.len[i] * lerp(R.lf, 1, Math.min(1, s)), wid:R.wid * (.92 + .08 * s), row:ri, i});
      }
      return fe;
    });
    return {R:Rt, E, W:Wp, rows, s, far, a1, a2};
  }

  // =====================================================================================
  // DRAWING: one mechanical feather, wing arm struts
  // =====================================================================================
  function feather(cx, F, pal, white){
    const len = F.len, wid = F.wid, wl = wid * .34, wt = wid * .66;
    cx.save(); cx.translate(F.x, F.y); cx.rotate(F.a); cx.lineJoin = 'round'; cx.lineCap = 'round';
    cx.beginPath();                                                // +y = leading (narrow) edge, -y = trailing (wide) edge
    cx.moveTo(0, wl * .55);
    cx.bezierCurveTo(len * .22, wl * 1.05, len * .55, wl * .95, len * .86, wl * .34);
    cx.quadraticCurveTo(len * .98, wl * .08, len, -wid * .02);
    cx.quadraticCurveTo(len * .96, -wt * .45, len * .78, -wt * .82);
    cx.bezierCurveTo(len * .55, -wt * 1.08, len * .2, -wt * .95, 0, -wt * .5);
    cx.closePath();
    if(white) cx.fillStyle = '#fff';
    else{ const g = cx.createLinearGradient(0, wl, 0, -wt); g.addColorStop(0, pal.c0); g.addColorStop(.38, pal.c1); g.addColorStop(.78, pal.c2); g.addColorStop(1, pal.c3); cx.fillStyle = g; }
    cx.fill(); cx.lineWidth = .55; cx.strokeStyle = pal.line; cx.stroke();
    if(!white){
      cx.save(); cx.clip();                                        // everything below stays inside the vane
      cx.strokeStyle = 'rgba(255,255,255,.55)'; cx.lineWidth = .5; cx.beginPath(); cx.moveTo(len * .1, wl * .3); cx.lineTo(len * .9, wl * .1); cx.stroke();   // soft chrome highlight
      if(len > 24){ cx.strokeStyle = 'rgba(70,82,108,.42)'; cx.lineWidth = .4; cx.beginPath();
        [.42, .68].forEach(x => { cx.moveTo(len * x, wl * .9); cx.lineTo(len * x - .6, -wt * .9); }); cx.stroke(); }                                    // plate seams
      cx.restore();
      cx.strokeStyle = pal.gm; cx.lineWidth = .65; cx.beginPath(); cx.moveTo(len * .05, 0); cx.lineTo(len * .95, -.05); cx.stroke();                         // gunmetal rachis
      cx.strokeStyle = pal.gold; cx.lineWidth = .85; cx.beginPath(); cx.moveTo(len * .06, wl * .6); cx.bezierCurveTo(len * .22, wl * 1.05, len * .55, wl * .95, len * .86, wl * .34); cx.quadraticCurveTo(len * .98, wl * .08, len, -wid * .02); cx.stroke();   // gold leading edge
      cx.strokeStyle = pal.goldL; cx.lineWidth = .35; cx.beginPath(); cx.moveTo(len * .3, wl * .98); cx.bezierCurveTo(len * .4, wl * .98, len * .55, wl * .9, len * .8, wl * .4); cx.stroke();
      rr(cx, -.3, -wt * .46, len * .13, wt * .46 + wl * .55, .9); cx.fillStyle = pal.gm; cx.fill(); cx.lineWidth = .4; cx.strokeStyle = pal.gmd; cx.stroke();   // gunmetal pivot cuff
      cx.fillStyle = pal.gold; cx.fillRect(len * .1, -wt * .42, .7, wt * .42 + wl * .5);                                                                      // gold band on the cuff
      disc(cx, len * .045, 0, .75, pal.goldL, pal.gmd, .3);                                                                                                   // pivot bolt
    }
    cx.restore();
  }
  // wing arm: 3-bone gunmetal strut with gold inlay and joint discs
  function wingArm(cx, G, pal, white){
    const {R, E, W} = G;
    cap(cx, R, E, 3.3, white ? '#fff' : pal.gm, 1.1, pal.gmd); cap(cx, E, W, 2.6, white ? '#fff' : pal.gm, 1.1, pal.gmd);
    if(white) return;
    cx.strokeStyle = pal.gold; cx.lineWidth = .55; cx.lineCap = 'round'; cx.beginPath(); cx.moveTo(lp(R, E, .12).x, lp(R, E, .12).y); cx.lineTo(lp(R, E, .88).x, lp(R, E, .88).y); cx.moveTo(lp(E, W, .15).x, lp(E, W, .15).y); cx.lineTo(lp(E, W, .85).x, lp(E, W, .85).y); cx.stroke();
    disc(cx, E.x, E.y, 1.9, pal.gm, pal.gmd, .8); disc(cx, E.x, E.y, 1, pal.gold, pal.gmd, .3);                  // elbow actuator
    disc(cx, W.x, W.y, 1.6, pal.gm, pal.gmd, .8); disc(cx, W.x, W.y, .7, pal.goldL);                              // wrist
    disc(cx, R.x, R.y, 2.7, pal.gm, pal.gmd, .9); cx.beginPath(); cx.arc(R.x, R.y, 1.7, 0, 7); cx.strokeStyle = pal.gold; cx.lineWidth = .7; cx.stroke(); disc(cx, R.x, R.y, .7, pal.goldL);   // shoulder-blade joint
  }
  function drawRow(cx, G, ri, pal, white){ const fe = G.rows[ri]; for(let i = fe.length - 1; i >= 0; i--) feather(cx, fe[i], pal, white); }   // trailing feather first, leading one on top

  // =====================================================================================
  // BODY PIECES
  // =====================================================================================
  // arm gear (subtle, the skin stays visible): two thin gunmetal bands on the forearm with a gold LED, a band on the upper arm, a small elbow joint. The far arm's goes UNDER the torso.
  function armGear(cx, A, white, far){
    if(white) return;
    const e = A.el, h = A.hand, s = A.s, gm = far ? '#3a4254' : GM;
    const band = (p, q, k, w) => {                                    // a thin ring across the limb at k along p -> q
      const c = lp(p, q, k), dx = q.x - p.x, dy = q.y - p.y, n = Math.hypot(dx, dy) || 1, nx = -dy / n * w / 2, ny = dx / n * w / 2;
      cx.lineCap = 'round'; cx.strokeStyle = GM_D; cx.lineWidth = 2.5; cx.beginPath(); cx.moveTo(c.x - nx, c.y - ny); cx.lineTo(c.x + nx, c.y + ny); cx.stroke();
      cx.strokeStyle = gm; cx.lineWidth = 1.5; cx.stroke();
      return c;
    };
    band(s, e, .62, UW + .5); band(e, h, .5, FW + .5); const c = band(e, h, .72, FW + .5);
    disc(cx, c.x, c.y, .55, GOLD_L);
    disc(cx, e.x, e.y, 1.5, gm, GM_D, .7); disc(cx, e.x, e.y, .6, GOLD);
  }

  function torsoShape(cx){
    cx.beginPath();
    cx.moveTo(-4.3, 2.8);                                                      // pelvis, back
    cx.bezierCurveTo(-3.6, -1, -4.6, -5, -4.6, -TL * .55);                    // lower back
    cx.bezierCurveTo(-5.2, -TL * .8, -5.2, -TL + 1.8, -2.4, -TL - 1);         // upper back / trapezius to the neck
    cx.lineTo(1.6, -TL - 1);                                                   // neck base
    cx.bezierCurveTo(4.2, -TL, 5.4, -TL + 1.6, 5.9, -TL + 4.4);               // front of the shoulder, chest
    cx.bezierCurveTo(6.1, -TL + 6.8, 4.9, -TL + 8, 4.6, -6);                   // under the chest, ribs
    cx.bezierCurveTo(4.4, -4, 3.9, -3, 4, -1.6);                               // abs to the waist
    cx.lineTo(4.6, 2.8);                                                       // pelvis, front
    cx.closePath();
  }
  function torsoBody(cx, white){
    torsoShape(cx); cx.fillStyle = OUT; cx.fill(); cx.lineWidth = 2.3; cx.strokeStyle = OUT; cx.lineJoin = 'round'; cx.stroke();
    torsoShape(cx);
    if(white){ cx.fillStyle = '#fff'; cx.fill(); return; }
    const g = cx.createLinearGradient(-5, 0, 6.2, 0); g.addColorStop(0, SKIN_F); g.addColorStop(.35, SKIN_D); g.addColorStop(.75, SKIN); g.addColorStop(1, SKIN_L);
    cx.fillStyle = g; cx.fill();
    cx.save(); torsoShape(cx); cx.clip();
    cx.strokeStyle = 'rgba(140,84,66,.5)'; cx.lineWidth = .6; cx.lineCap = 'round';
    cx.beginPath(); cx.moveTo(1.2, -TL + 7.6); cx.quadraticCurveTo(4.4, -TL + 8.8, 6, -TL + 5.4); cx.stroke();                                   // lower edge of the pectoral
    cx.strokeStyle = 'rgba(140,84,66,.38)'; cx.lineWidth = .5; cx.beginPath();
    [-9.2, -6.6, -4.2].forEach(y => { cx.moveTo(2.4, y); cx.lineTo(4.9, y - .2); }); cx.stroke();                                               // abdominal ridges
    cx.fillStyle = 'rgba(255,240,225,.28)'; cx.beginPath(); cx.moveTo(2.6, -TL + 1.6); cx.quadraticCurveTo(5.4, -TL + 3.2, 5.2, -TL + 6); cx.lineTo(3.6, -TL + 5.2); cx.closePath(); cx.fill();   // chest highlight
    cx.fillStyle = 'rgba(120,70,60,.18)'; cx.fillRect(-6, -TL * .55, 4, TL * .5);                                                               // back shadow
    cx.restore();
  }
  // segmented gunmetal spine down the back, with the two wing mounts (upper back)
  function spine(cx, white){
    if(white) return;
    const x = -TW / 2 - .1;
    cx.strokeStyle = GM_D; cx.lineWidth = 1.2; cx.lineCap = 'round'; cx.beginPath(); cx.moveTo(x + .3, 1.6); cx.lineTo(x + .1, -TL + .5); cx.stroke();      // dorsal rail
    for(let j = 0; j < 6; j++){
      const y = -1.8 - j * ((TL - 5) / 5), w = 2.9 - j * .1;
      rr(cx, x - w / 2 - .2, y - 1.1, w, 2.2, .9); cx.fillStyle = j % 2 ? GM : GM_L; cx.fill(); cx.lineWidth = .5; cx.strokeStyle = GM_D; cx.stroke();
      cx.fillStyle = GOLD; cx.fillRect(x - .35, y - .25, .8, .5);
    }
  }
  // wing mount housing at the wing root (torso-local coordinates): gunmetal block + gold collar
  function mount(cx){
    const x = -TW / 2 - .1, y = -TL * .8;
    rr(cx, x - 2.2, y - 3.4, 4.8, 6.8, 1.6); cx.fillStyle = GM; cx.fill(); cx.lineWidth = .8; cx.strokeStyle = GM_D; cx.stroke();
    cx.fillStyle = GOLD; cx.fillRect(x - 2.2, y - .5, 4.8, 1); cx.fillStyle = GM_L; cx.fillRect(x - 1.8, y - 3, 1, 6);
  }
  // actuator piston: from the spine up to the middle of the wing's upper arm (shortens as the wing folds)
  function piston(cx, S, G, pal, white){
    if(white) return;
    const l = S.lean, ux = Math.sin(l), uy = -Math.cos(l), fx = Math.cos(l), fy = Math.sin(l), hh = TL * .4, dd = -TW / 2 - .2;
    const A = {x:S.pel.x + ux * hh + fx * dd, y:S.pel.y + uy * hh + fy * dd}, B = lp(G.R, G.E, .62), M = lp(A, B, .55);
    cap(cx, A, M, 2.3, GM_L, 1, GM_D); cap(cx, M, B, 1.2, GOLD_L, .9, GM_D);
    cx.strokeStyle = GOLD; cx.lineWidth = .6; const c = lp(A, B, .5), v = {x:B.x - A.x, y:B.y - A.y}, n = Math.hypot(v.x, v.y) || 1; cx.beginPath(); cx.moveTo(M.x - v.y / n * 1.4, M.y + v.x / n * 1.4); cx.lineTo(M.x + v.y / n * 1.4, M.y - v.x / n * 1.4); cx.stroke();
    disc(cx, A.x, A.y, 1.3, GM, GM_D, .6); disc(cx, B.x, B.y, 1.1, GOLD, GM_D, .5);
  }

  // =====================================================================================
  Characters.art('vaelion', {
    // athletic, a little taller than default. Legs keep the default lengths (the ragdoll stands on them). The head is small here (the face in front() covers it).
    body: {head:{r:3.6}, torso:{len:TL, w:TW}, uArm:{len:9, w:UW}, fArm:{len:9, w:FW}, hand:{r:HR}, thigh:{len:10, w:6.4}, shin:{len:9.5, w:5.2}, foot:{len:8, w:3.8},
           headSink:-1.8, shN:1, shF:-2.5, belt:4.4, noRings:true, outline:OUT, outlineW:OW},
    colors: {shirt:SKIN, limb:SKIN, far:SKIN_F, head:SKIN, hand:SKIN, handFar:SKIN_F, dark:TROU, legs:TROU, legsFar:TROU_F},

    // calm, upright stance: chest up, arms relaxed. Running keeps the shared run pose.
    pose(tg, f, t, run, K){
      const b = Math.sin(t * 2.2) * (1 - run);
      tg.lean = lerp(.01 + b * .012, tg.lean, run);
      tg.aN = lerp(.1 + b * .03, tg.aN, run); tg.eN = lerp(.42, tg.eN, run);
      tg.aF = lerp(-.1 - b * .03, tg.aF, run); tg.eF = lerp(.34, tg.eF, run);
      tg.head = lerp(-.02, tg.head, run);
    },

    // BEHIND the body: wing state, the FAR wing (all feathers + arm), the near wing's long feathers (lower + middle rows)
    behind: safe('behind', function(cx, f, t, S, P){
      const W = wingState(f, t, S), white = f.flash > 0;
      const near = wingGeo(S, W, false, t), far = wingGeo(S, W, true, t);
      CUR = {f, t, W, near, far, white};
      for(let r = 0; r < 3; r++) drawRow(cx, far, r, PAL[1], white);
      wingArm(cx, far, PAL[1], white);
      drawRow(cx, near, 0, PAL[0], white); drawRow(cx, near, 1, PAL[0], white);
    }),

    // skin torso + spine + wing mounts, then the near wing's arm + coverts over the back (so the wing visibly grows out of his spine). The far arm's gear goes under the torso.
    torso: safe('torso', function(cx, S, B, P, white){
      const C = CUR; if(!C) return;
      armGear(cx, S.aF, white, true);
      cx.save(); cx.translate(S.pel.x, S.pel.y); cx.rotate(S.lean); cx.lineJoin = 'round';
      torsoBody(cx, white);
      // trousers: waistband sits over the lower torso (the pelvis disc is drawn by body.js on top)
      rr(cx, -4.7, -3.6, 9.7, 6.8, 1.4); cx.fillStyle = white ? '#fff' : TROU; cx.fill(); cx.lineWidth = 1; cx.strokeStyle = OUT; cx.stroke();
      if(!white){ cx.fillStyle = GOLD; cx.fillRect(-4.6, -2.6, 9.5, .8); cx.fillStyle = GM; cx.fillRect(-4.6, -3.6, 9.7, .9); }
      spine(cx, white); mount(cx);
      cx.restore();
      // neck
      cap(cx, S.sh, S.head, 4, white ? '#fff' : SKIN_D, 1.3);
      // near wing: arm + actuator + covert row (drawn over the back, under the head and the near arm)
      piston(cx, S, C.near, PAL[0], white);
      wingArm(cx, C.near, PAL[0], white);
      drawRow(cx, C.near, 2, PAL[0], white);
      // near shoulder joint of the arm drawn later in front()
    }),

    // boots, knee guards, gold trouser trim. Called right after each leg is drawn (far leg before the torso, near leg after it).
    foot: safe('foot', function(cx, leg, P, white, f, far){
      cx.save(); cx.lineCap = 'round'; cx.lineJoin = 'round';
      const h = leg.hip, k = leg.knee, a = leg.ankle, tv = {x:k.x - h.x, y:k.y - h.y}, tn = Math.hypot(tv.x, tv.y) || 1, sv = {x:a.x - k.x, y:a.y - k.y}, sn = Math.hypot(sv.x, sv.y) || 1;
      const tu = {x:tv.x / tn, y:tv.y / tn}, su = {x:sv.x / sn, y:sv.y / sn}, gm = far ? '#3a4254' : GM, gold = far ? '#b48a2e' : GOLD;
      if(!white){
        // gold geometric trim down the front of the thigh: a thin rail with two diamonds
        const fr = {x:tu.y * 2.2, y:-tu.x * 2.2};   // forward-facing side of the leg
        cx.strokeStyle = gold; cx.lineWidth = .6;
        cx.beginPath(); cx.moveTo(h.x + tu.x * 3.2 + fr.x, h.y + tu.y * 3.2 + fr.y); cx.lineTo(k.x - tu.x * 3.6 + fr.x, k.y - tu.y * 3.6 + fr.y); cx.stroke();
        [.46].forEach(u => { const c = {x:h.x + tv.x * u, y:h.y + tv.y * u}, n = {x:-tu.y, y:tu.x};
          cx.beginPath(); cx.moveTo(c.x + tu.x * 2.1, c.y + tu.y * 2.1); cx.lineTo(c.x + n.x * 1.4, c.y + n.y * 1.4); cx.lineTo(c.x - tu.x * 2.1, c.y - tu.y * 2.1); cx.lineTo(c.x - n.x * 1.4, c.y - n.y * 1.4); cx.closePath(); cx.stroke(); });
      }
      // reinforced knee guard: a gunmetal plate with a gold rim and bolt, aligned to the bend
      const kb = {x:tu.x + su.x, y:tu.y + su.y}, ka = Math.atan2(kb.y, kb.x) - Math.PI / 2;
      cx.save(); cx.translate(k.x, k.y); cx.rotate(ka);
      rr(cx, -2.8, -3.1, 5.6, 6, 1.7); cx.fillStyle = white ? '#fff' : gm; cx.fill(); cx.lineWidth = .9; cx.strokeStyle = OUT; cx.stroke();
      if(!white){ rr(cx, -2, -2.3, 4, 4.4, 1.1); cx.lineWidth = .55; cx.strokeStyle = gold; cx.stroke(); cx.fillStyle = far ? '#6c7488' : GM_L; cx.fillRect(-1.8, -2.1, 1, 4); disc(cx, 0, 0, .75, gold, GM_D, .3); }
      cx.restore();
      if(!white){   // ankle cuff: gunmetal band with a gold line
        const c0 = lp(k, a, .76), c1 = lp(k, a, .93);
        cap(cx, c0, c1, 5.4, gm, 1, GM_D);
        cx.strokeStyle = gold; cx.lineWidth = .55; cx.beginPath(); const m = lp(c0, c1, .5), nn = {x:-su.y * 2.5, y:su.x * 2.5}; cx.moveTo(m.x - nn.x, m.y - nn.y); cx.lineTo(m.x + nn.x, m.y + nn.y); cx.stroke();
      }
      // boot: white shell, gunmetal sole, gold toe line (same geometry as body.js's foot)
      const phi = leg.planted ? 0 : clamp(-leg.sa * .5, -.8, .8), lift = leg.planted ? clamp((leg.hip.x - leg.ankle.x - 2) * .12, 0, 3.5) : 0;
      const p0 = {x:a.x - 1.5, y:a.y - lift}, p1 = {x:a.x + (8 - 1.5) * Math.cos(phi), y:a.y + (8 - 1.5) * Math.sin(phi)};
      cap(cx, p0, p1, 3.8, white ? '#fff' : (far ? TROU_F : TROU), 2.4, OUT);
      if(!white){
        const d = {x:p1.x - p0.x, y:p1.y - p0.y}, dn = Math.hypot(d.x, d.y) || 1, nx = -d.y / dn, ny = d.x / dn;
        cx.strokeStyle = gm; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(p0.x + nx * 1.4, p0.y + ny * 1.4); cx.lineTo(p1.x + nx * 1.4, p1.y + ny * 1.4); cx.stroke();
        cx.strokeStyle = gold; cx.lineWidth = .6; const q = {x:p1.x - d.x / dn * 1.8, y:p1.y - d.y / dn * 1.8}; cx.beginPath(); cx.moveTo(q.x - nx * 1.5, q.y - ny * 1.5); cx.lineTo(q.x + nx * 1.5, q.y + ny * 1.5); cx.stroke();
      }
      cx.restore();
    }),

    // in FRONT: the real face + hair (drawn over body.js's default head and visor), the near arm again on top of the head, the near shoulder / elbow / bracer, the hip plate
    front: safe('front', function(cx, f, t, S, P){
      const C = CUR, W = C ? C.W : null, white = f.flash > 0;
      const hd = S.head, ang = Math.atan2(hd.x - S.sh.x, -(hd.y - S.sh.y));
      const vxl = (f.vx || 0) * f.face, vy = f.vy || 0, air = !f.gr;
      cx.save(); cx.translate(hd.x, hd.y); cx.rotate(ang); cx.lineJoin = 'round'; cx.lineCap = 'round';

      // ---- long straight locks behind the head (under the face). Direction is in WORLD terms: hangs back-down, streams back when he flies forward, lifts when he falls ----
      {
        const spd = clamp((W ? W.hv : vxl) / 300, -.3, 1), fall = air ? clamp(vy / 700, -.5, 1) : 0;
        const base = 152 + spd * 20 + (fall > 0 ? fall * 42 : fall * 20) - (ang / DEG) * .8;
        //        base x, y (head space)   length  width  spread
        [[-2.6, -5.6, 17, 2.2, -16], [-4, -4.2, 15.5, 2.3, -9], [-5, -2.4, 17.5, 2.3, -2], [-5.2, -.4, 14, 2.2, 5], [-4.6, 1.5, 15, 2.1, 12], [-3.4, 3, 10.5, 1.9, 19]].forEach(([bx, by, len, w, da], i) => {
          const a = (base + da + Math.sin(t * 1.4 + i * 1.7) * 2.4) * DEG, c = Math.cos(a), s = Math.sin(a), nx = -s, ny = c, bend = (air ? .1 + Math.abs(spd) * .08 : .04) * (i % 2 ? 1 : -1);
          const mx = bx + c * len * .5 + nx * bend * len * .3, my = by + s * len * .5 + ny * bend * len * .3, tx = bx + c * len + nx * bend * len * .7, ty = by + s * len + ny * bend * len * .7;
          cx.beginPath(); cx.moveTo(bx + nx * w / 2, by + ny * w / 2); cx.quadraticCurveTo(mx + nx * w * .5, my + ny * w * .5, tx, ty); cx.quadraticCurveTo(mx - nx * w * .5, my - ny * w * .5, bx - nx * w / 2, by - ny * w / 2); cx.closePath();
          if(white) cx.fillStyle = '#fff'; else { const g = cx.createLinearGradient(bx, by, tx, ty); g.addColorStop(0, HAIR_D); g.addColorStop(.4, HAIR); g.addColorStop(1, HAIR_L); cx.fillStyle = g; }
          cx.fill(); cx.lineWidth = .45; cx.strokeStyle = HAIR_O; cx.stroke();
        });
      }
      cx.scale(.94, .94);                                                                      // the face is a touch smaller than the default head covers (it only has to hide it)

      // ---- face (profile). It is drawn larger than body.js's head so the default head + visor are fully covered. ----
      const faceP = () => {
        cx.beginPath(); cx.moveTo(1.8, -5.6); cx.bezierCurveTo(5, -5.3, 5.7, -3.7, 5.6, -2.4);
        cx.lineTo(5.3, -1.1); cx.quadraticCurveTo(7.5, .5, 5.6, 1.5); cx.lineTo(5.3, 2); cx.quadraticCurveTo(5.9, 2.5, 5.2, 2.9); cx.quadraticCurveTo(5.5, 3.4, 4.9, 3.7);
        cx.quadraticCurveTo(5.5, 4.5, 4.3, 5.4); cx.lineTo(1.6, 6); cx.quadraticCurveTo(-2.4, 6.2, -4.6, 3); cx.bezierCurveTo(-7, 1.2, -6.6, -3.8, -3.2, -5.3); cx.bezierCurveTo(-1.4, -6.3, .4, -6, 1.8, -5.6); cx.closePath();
      };
      faceP(); cx.fillStyle = OUT; cx.fill(); cx.lineWidth = 2; cx.strokeStyle = OUT; cx.stroke();
      faceP();
      if(white){ cx.fillStyle = '#fff'; cx.fill(); }
      else{
        const g = cx.createLinearGradient(0, -6, 0, 6.2); g.addColorStop(0, SKIN_L); g.addColorStop(.6, SKIN); g.addColorStop(1, SKIN_D); cx.fillStyle = g; cx.fill();
        cx.save(); faceP(); cx.clip(); cx.fillStyle = 'rgba(214,130,110,.14)'; cx.beginPath(); cx.arc(2.2, 2.2, 2.3, 0, 7); cx.fill();
        cx.fillStyle = 'rgba(120,70,60,.2)'; cx.fillRect(-7, 3.6, 12, 3); cx.restore();                                         // jaw / under-chin shade
        cx.fillStyle = SKIN_D; cx.beginPath(); cx.ellipse(-1.1, .7, 1.1, 1.7, 0, 0, 7); cx.fill(); cx.lineWidth = .5; cx.strokeStyle = '#a8785f'; cx.stroke();   // ear
        const bl = Math.sin(t * .8 + 1) > .985 ? .15 : 1;                                                                        // slow blink
        cx.fillStyle = '#f9f5ee'; cx.beginPath(); cx.ellipse(3.3, -1, 1.3, .85 * bl, 0, 0, 7); cx.fill();
        cx.fillStyle = '#4d86c8'; cx.beginPath(); cx.ellipse(3.65, -1, .66, .66 * bl, 0, 0, 7); cx.fill();
        cx.fillStyle = '#17233a'; cx.beginPath(); cx.arc(3.78, -1, .3, 0, 7); cx.fill();
        cx.strokeStyle = '#3a2c28'; cx.lineWidth = .55; cx.beginPath(); cx.moveTo(1.9, -1.6); cx.quadraticCurveTo(3.4, -2.1, 4.7, -1.5); cx.stroke();   // upper lid
        cx.strokeStyle = HAIR_D; cx.lineWidth = .8; cx.beginPath(); cx.moveTo(1.7, -2.7); cx.lineTo(5.1, -2.4); cx.stroke();                          // calm level brow
        cx.strokeStyle = 'rgba(150,80,70,.8)'; cx.lineWidth = .5; cx.beginPath(); cx.moveTo(4.2, 3.2); cx.lineTo(5.1, 3.05); cx.stroke();             // closed, composed mouth
        cx.strokeStyle = 'rgba(150,100,80,.5)'; cx.lineWidth = .4; cx.beginPath(); cx.moveTo(5.5, -.4); cx.quadraticCurveTo(6.4, .4, 5.7, 1.2); cx.stroke();   // nose shadow
      }
      // ---- hair on top: swept back from the hairline, the face stays fully visible ----
      const cap2 = () => { cx.beginPath(); cx.moveTo(5.2, -3.7); cx.bezierCurveTo(6, -6.6, 2.6, -9.2, -1.8, -8.4); cx.bezierCurveTo(-6, -7.8, -8, -3.4, -7.2, 1.3); cx.lineTo(-4.6, 2.7);
        cx.bezierCurveTo(-5, -.6, -3.2, -2.5, -1, -2.7); cx.bezierCurveTo(1, -2.9, 2.5, -3.9, 5.2, -3.7); cx.closePath(); };
      cap2(); cx.fillStyle = HAIR_O; cx.fill(); cx.lineWidth = 1.1; cx.strokeStyle = HAIR_O; cx.stroke();
      cap2();
      if(white){ cx.fillStyle = '#fff'; cx.fill(); }
      else{
        const g = cx.createLinearGradient(5, -9, -7, 2); g.addColorStop(0, HAIR_L); g.addColorStop(.45, HAIR); g.addColorStop(1, HAIR_D); cx.fillStyle = g; cx.fill();
        cx.save(); cap2(); cx.clip(); cx.lineWidth = .55;
        [[4.8, -4.3, -.2, -8, -7.6, -4.6], [4.1, -3.9, -1.4, -6.8, -7.8, -2.6], [3, -3.5, -2.6, -5.2, -7.4, -.4], [5.2, -5.2, 1.2, -9.2, -7, -6.4], [2, -3.3, -3.6, -4, -6.2, 1.4]].forEach(([x0, y0, cxp, cyp, x1, y1], i) => {
          cx.strokeStyle = i % 2 ? 'rgba(255,246,200,.85)' : 'rgba(150,108,32,.6)'; cx.beginPath(); cx.moveTo(x0, y0); cx.quadraticCurveTo(cxp, cyp, x1, y1); cx.stroke(); });                 // swept-back strands
        cx.restore();
      }
      cx.restore();

      // ---- near arm again, over the head (body.js drew it before the head covered it) ----
      const A = S.aN, skin = white ? '#fff' : P.limb;
      cap(cx, A.s, A.el, UW, skin, OW * 2); cap(cx, A.el, A.hand, FW, skin, OW * 2);
      cx.fillStyle = OUT; cx.beginPath(); cx.arc(A.hand.x, A.hand.y, HR + OW, 0, 7); cx.fill(); cx.fillStyle = skin; cx.beginPath(); cx.arc(A.hand.x, A.hand.y, HR, 0, 7); cx.fill();
      if(!white){
        armGear(cx, A, white, false);                                                                                       // elbow joint + bracer
        disc(cx, A.s.x, A.s.y, 2.1, GM, GM_D, .8); cx.beginPath(); cx.arc(A.s.x, A.s.y, 1.3, 0, 7); cx.strokeStyle = GOLD; cx.lineWidth = .55; cx.stroke(); disc(cx, A.s.x, A.s.y, .55, GOLD_L);   // shoulder actuator cap
        // hip plate: small gold-edged gunmetal diamond on the trousers
        const l = S.lean, px = S.pel.x + Math.sin(l) * 0 + 2.4 * Math.cos(l), py = S.pel.y + 2.4 * Math.sin(l) + .4;
        cx.beginPath(); cx.moveTo(px, py - 2.6); cx.lineTo(px + 2, py); cx.lineTo(px, py + 2.6); cx.lineTo(px - 2, py); cx.closePath(); cx.fillStyle = GM; cx.fill(); cx.lineWidth = .8; cx.strokeStyle = GOLD; cx.stroke();
      }
      // ---- flap energy: small gold diamonds over his head (full = a wingbeat left). Only shown in the air / while not full. ----
      if(W && W.pipA > .02 && f.c.fly){
        const mx = f.c.fly.flaps, left = f.fly && f.fly.left != null ? f.fly.left : mx, py = hd.y - 15;
        cx.save(); cx.globalAlpha = W.pipA;
        for(let i = 0; i < mx; i++){
          const x = hd.x + (i - (mx - 1) / 2) * 5.2, on = i < left;
          cx.beginPath(); cx.moveTo(x, py - 2); cx.lineTo(x + 1.6, py); cx.lineTo(x, py + 2); cx.lineTo(x - 1.6, py); cx.closePath();
          const part = !on && i === left && f.gr && f.fly ? clamp((f.fly.rc || 0) / f.c.fly.recharge, 0, 1) : 0;   // the next pip fills up while he recharges on the ground
          cx.fillStyle = on ? GOLD_L : part > 0 ? 'rgba(255,227,154,' + (.2 + part * .65) + ')' : 'rgba(20,26,40,.55)'; cx.fill(); cx.lineWidth = .7; cx.strokeStyle = on ? GOLD : 'rgba(255,255,255,.3)'; cx.stroke();
        }
        cx.restore();
      }
    })
  });
})();
1