// ZERATHIS art - THE FROZEN MONARCH. A massive, heavily armored Glacier King (visual redesign, gameplay untouched).
// Same shared ragdoll (body.js): only sizes, colors, poses and drawing hooks. Hitbox is still 30x52 (arena.js / body.js / skills.js are NOT changed).
//
// LOOK     silver + dark-steel royal armor, deep-navy cloth, white / pale-blue glacier ice, cyan ONLY for the eye and restrained magic.
//          Human face (pale weathered skin, frostbite cheek, stern brow, icy-blue eye). The beard hides the mouth, so there is no mouth.
//          Heavy crown with asymmetric crystal spikes, long white hair, braided beard with rings + gems, stacked fortress pauldrons, plated arms, gauntlets,
//          navy tabard, thick white royal cape (navy lining, frost hem). Legs / boots = thick silver + dark-steel body parts (see NOTES at the bottom).
// KEPT     all poses / timing curves (STEP, COFFIN, AGE, aimPose maths), every release point C = [.5, .5, .56], f.handW, f.flash, farFront, spring, the three shot kinds.
// HOLD     GLACIER SPEAR (manual aim engine untouched: f.snipe = {kn, ang, ph, rt, ready}). The spear grows from the near palm with the charge value S.kn and flies as 'sniper'.
// NOTES    - hooks used: body, colors, farFront, spring, attack, pose, behind, front, torso (shared-ragdoll hook, same one Nethros uses), shot.
//          - the near-hand projectile origin is never moved: gauntlets / claws are drawn around S.aN.hand / S.aF.hand, f.handW is computed exactly as before.
//          - TUNE: SPEAR_R0 / SPEAR_R1 = the projectile radius (s.r) range that maps to spear charge 0..1 while it is flying.
(() => {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => t * t * (3 - 2 * t);
  const C = [.5, .5, .56];                        // moment the ice leaves the hand = shot.p in skills.js (keep the same)
  const T = 11, SH = 10.5;                        // thigh + shin length (must match body below)
  const SPEAR_R0 = 4, SPEAR_R1 = 12;              // s.r range of the flying spear -> charge 0..1 (flight only; the held spear uses S.kn directly)

  // PALETTE: silver + dark steel = armor, white / pale blue = glacier, deep navy = cloth, cyan = eye + restrained magic only
  const Z = {silver:'#C9D6E2', silverLo:'#8CA0B6', steel:'#26364A', steelHi:'#4A6079', ice:'#DDF5FF', pale:'#A5D9F2', glacier:'#274B78', navy:'#172B4D',
             cyan:'#50DFFF', plat:'#F1F8FF', ink:'#07101E', skin:'#D6DCE6', frost:'#B9D9EE', hair:'#EEF7FF', hairLo:'#C0DDF0', beard:'#E6F0F8'};
  const RN = Array.from({length:24}, (_, i) => { const v = Math.sin((i + 1) * 12.9898) * 43758.5453; return v - Math.floor(v); });   // fixed pseudo-random table (no per-frame allocation)
  const rn = i => RN[((i % 24) + 24) % 24];
  let WH = false;                                 // hit flash: draw plain white silhouettes only (set at the top of every hook)

  // knee angle that puts the ankle at height Y for thigh angle th, so BOTH feet stay on the same ground height (no floating foot)
  const legK = (th, Y) => { const a = Math.acos(clamp((Y - T * Math.cos(th)) / SH, -1, 1)); const k = th - a; return k > .05 ? k : th + a; };

  // ---- BASIC ATTACK: 3 casts (curves unchanged). 1 = near-hand ICE CLAW slash, 2 = far-hand diagonal ICE CLAW slash, 3 = both palms FROSTWAVE. ----
  const STEP = [
    { // 1 NEAR hand
      aN:[[0,.35],[.2,.05],[.4,-.05],[.5,1.5],[.62,1.55],[.82,1.0],[1,.35]], eN:[[0,.7],[.2,1.3],[.4,1.3],[.5,.1],[.62,.08],[.82,.5],[1,.7]],
      aF:[[0,.1],[.3,-.1],[.5,.2],[1,.1]], eF:[[0,.8],[.5,1.0],[1,.8]],
      lean:[[0,.05],[.2,-.06],[.4,-.08],[.5,.18],[.62,.2],[.82,.12],[1,.05]], head:[[0,0],[.5,.06],[.7,-.1],[1,0]],
      tN:[[0,.26],[.3,.15],[.5,.38],[.82,.32],[1,.26]], tF:[[0,-.2],[.3,-.3],[.5,-.42],[.82,-.32],[1,-.2]], Y:[[0,21],[.3,20.3],[.5,20.7],[1,21]]
    },
    { // 2 FAR hand (higher wind-up behind the head, thrown down-forward)
      aF:[[0,.1],[.2,1.5],[.4,1.7],[.5,1.45],[.62,1.5],[.82,.8],[1,.1]], eF:[[0,.8],[.2,1.2],[.4,1.2],[.5,.15],[.62,.1],[.82,.5],[1,.8]],
      aN:[[0,.35],[.3,.1],[.5,.15],[1,.35]], eN:[[0,.7],[.5,.8],[1,.7]],
      lean:[[0,.05],[.2,-.06],[.4,-.08],[.5,.2],[.62,.24],[.82,.14],[1,.05]], head:[[0,0],[.5,.06],[.7,-.1],[1,0]],
      tN:[[0,.26],[.3,.32],[.5,.2],[.82,.22],[1,.26]], tF:[[0,-.2],[.3,-.3],[.5,-.5],[.82,-.32],[1,-.2]], Y:[[0,21],[.3,20.3],[.5,20.7],[1,21]]
    },
    { // 3 BOTH hands: spread wide behind, crouch, then both slam forward together
      aN:[[0,.35],[.15,-.2],[.35,-.9],[.48,-.9],[.56,1.5],[.68,1.55],[.85,1.0],[1,.35]], eN:[[0,.7],[.35,.9],[.48,.9],[.56,.15],[.68,.1],[1,.7]],
      aF:[[0,.1],[.15,-.3],[.35,-1.0],[.48,-1.0],[.56,1.45],[.68,1.5],[.85,1.0],[1,.1]], eF:[[0,.8],[.35,.9],[.48,.9],[.56,.15],[.68,.1],[1,.8]],
      lean:[[0,.05],[.15,.08],[.35,-.25],[.48,-.27],[.56,.24],[.68,.28],[.85,.15],[1,.05]], head:[[0,0],[.35,.25],[.56,.15],[.75,-.25],[1,0]],
      tN:[[0,.26],[.35,.35],[.56,.55],[.85,.4],[1,.26]], tF:[[0,-.2],[.35,-.5],[.56,-.6],[.85,-.4],[1,-.2]], Y:[[0,21],[.35,18.5],[.48,18.5],[.56,20.5],[1,21]]
    }
  ];
  // ---- SKILL CASTS. p = 0..1 over the cast. The ice itself (zones, spikes) is drawn by arena.js; here only his body and the frost on his hands. ----
  const GRASP = {   // WINTER'S GRASP (time .5): BOTH arms rise overhead, then both SLAM down toward the ground ahead at p .5 (the far arm used to just lift)
    aN:[[0,.35],[.3,2.45],[.5,.55],[.8,.6],[1,.35]], eN:[[0,.7],[.3,.35],[.5,.1],[1,.7]],
    aF:[[0,.1],[.3,2.3],[.5,.7],[.8,.62],[1,.1]], eF:[[0,.8],[.3,.4],[.5,.12],[1,.8]],
    lean:[[0,.05],[.3,-.12],[.5,.34],[.8,.2],[1,.05]], head:[[0,0],[.3,-.1],[.5,.18],[1,0]],
    tN:[[0,.26],[.3,.2],[.5,.55],[.85,.4],[1,.26]], tF:[[0,-.2],[.3,-.3],[.5,-.55],[.85,-.35],[1,-.2]], Y:[[0,21],[.3,20.3],[.5,18.4],[1,21]]
  };
  const COFFIN = {  // CRYSTAL COFFIN (time .45): both hands reach up and out, then close like a clenched fist at p .55
    aN:[[0,.35],[.3,2.2],[.55,1.4],[.75,1.35],[1,.35]], eN:[[0,.7],[.3,.5],[.55,1.8],[.75,1.7],[1,.7]],
    aF:[[0,.1],[.3,2.3],[.55,1.25],[.75,1.2],[1,.1]], eF:[[0,.8],[.3,.5],[.55,1.9],[.75,1.8],[1,.8]],
    lean:[[0,.05],[.3,-.14],[.55,.22],[1,.05]], head:[[0,0],[.3,-.12],[.55,.1],[1,0]],
    tN:[[0,.26],[.3,.3],[.55,.5],[1,.26]], tF:[[0,-.2],[.3,-.3],[.55,-.5],[1,-.2]], Y:[[0,21],[.3,20],[.55,18.6],[1,21]]
  };
  const AGE = {     // ETERNAL ICE AGE (time 3): arms up and out, leaning back while the cold gathers; the last 4% = both arms slam down and the whole arena freezes
    aN:[[0,.35],[.1,2.6],[.9,2.75],[.96,.9],[1,.35]], eN:[[0,.7],[.1,.3],[.9,.25],[.96,.2],[1,.7]],
    aF:[[0,.1],[.1,2.7],[.9,2.85],[.96,.8],[1,.1]], eF:[[0,.8],[.1,.3],[.9,.25],[.96,.2],[1,.8]],
    lean:[[0,.05],[.1,-.28],[.9,-.32],[.96,.3],[1,.05]], head:[[0,0],[.1,-.32],[.9,-.34],[.96,.2],[1,0]],
    tN:[[0,.26],[.1,.3],[.9,.32],[.96,.5],[1,.26]], tF:[[0,-.2],[.1,-.34],[.9,-.36],[.96,-.5],[1,-.2]], Y:[[0,21],[.1,19.6],[.9,19.4],[.96,19],[1,21]]
  };
  // ---- GLACIER SPEAR hold pose. S = f.snipe (arena.js sniperStep): S.kn = 0..1 raise progress, S.ang = aim elevation (+ = up), S.ph = 'aim' | 'recover' (S.rt 0..1 after the throw). ----
  // Monarch's Command: near arm points along the aim, the far arm hangs relaxed (he does not struggle), calm upright posture.
  function aimPose(tg, S){
    const k = ease(S.kn), th = S.ang, rec = S.ph === 'recover' ? S.rt : 0, thrust = rec > 0 ? Math.sin(Math.min(1, rec / .5) * Math.PI) : 0;   // thrust = the arm whips through after release
    const aim = {aN:1.5708 + th - .05 - thrust * .35, eN:.12 + thrust * .25, aF:.22 + th * .1, eF:.55, lean:.04 + .06 * k + thrust * .22 - th * .05, head:-.04 - th * .22,
                 tN:.3, tF:-.28};
    const Y = Math.min(19.4, .97 * (T + SH) * Math.min(Math.cos(aim.tN), Math.cos(aim.tF)));
    aim.kN = legK(aim.tN, Y); aim.kF = legK(aim.tF, Y);
    for(const j in aim) tg[j] = tg[j] + (aim[j] - tg[j]) * k;
  }

  // the far arm is drawn on top of the body for cast 2, cast 3, every skill and the hold (same rule as before)
  const FF = f => !!f.snipe || (f.atk > 0 && f.A && (!!f.A.skill || (f.A.step || 0) >= 1));

  // ---- per-fighter smoothed state (cape lag, airborne, landing, end of Eternal Ice Age). Keyed by the fighter object, nothing global. ----
  const ST = new WeakMap();
  function track(f, t){
    let s = ST.get(f); if(!s){ s = {t:-1, lag:0, air:0, gr:true, land:-9, imp:.5, pvy:0, ice:false, iceEnd:-99}; ST.set(f, s); }
    if(s.t === t) return s;
    const dt = s.t < 0 ? .016 : clamp(t - s.t, 0, .05); s.t = t;
    s.lag += (clamp((f.vx || 0) * (f.face || 1) * .05, -3, 14) - s.lag) * clamp(dt * 3.2, 0, 1);       // heavy delayed cape / hair
    s.air += ((f.gr ? 0 : 1) - s.air) * clamp(dt * 7, 0, 1);
    if(!s.gr && f.gr){ s.land = t; s.imp = clamp(Math.abs(s.pvy) / 480, .35, 1); }                        // landing -> frost burst + a brief absorb
    s.gr = !!f.gr; if(!f.gr) s.pvy = f.vy || 0;
    const A = f.A || {}, ice = f.atk > 0 && A.skill === 'iceage';
    if(s.ice && !ice) s.iceEnd = t; s.ice = ice;
    return s;
  }
  const castP = f => (f.atk > 0 && f.A && f.A.time) ? clamp(1 - f.atk / f.A.time, 0, 1) : -1;

  // ---- drawing helpers (local space: origin = feet, x = forward, y = down) ----
  function poly(cx, pts, fill, stroke, lw){
    cx.beginPath(); for(let i = 0; i < pts.length; i++){ if(i) cx.lineTo(pts[i][0], pts[i][1]); else cx.moveTo(pts[i][0], pts[i][1]); } cx.closePath();
    if(WH){ cx.fillStyle = '#fff'; cx.fill(); return; }
    if(fill){ cx.fillStyle = fill; cx.fill(); } if(stroke){ cx.strokeStyle = stroke; cx.lineWidth = lw || 1; cx.lineJoin = 'round'; cx.stroke(); }
  }
  const lg = (cx, x0, y0, x1, y1, st) => { const g = cx.createLinearGradient(x0, y0, x1, y1); for(let i = 0; i < st.length; i++) g.addColorStop(st[i][0], st[i][1]); return g; };
  function line(cx, pts, col, lw){
    if(WH) return; cx.strokeStyle = col; cx.lineWidth = lw; cx.lineCap = 'round'; cx.lineJoin = 'round';
    cx.beginPath(); for(let i = 0; i < pts.length; i++){ if(i) cx.lineTo(pts[i][0], pts[i][1]); else cx.moveTo(pts[i][0], pts[i][1]); } cx.stroke();
  }
  function crystal(cx, x, y, len, w, ang, fill, stroke){   // one faceted ice spike: base at (x, y), points along ang. Dark facet + bright edge give it depth.
    const c = Math.cos(ang), s = Math.sin(ang), px = -s, py = c;
    const p0 = [x + px * w, y + py * w], p1 = [x + c * len, y + s * len], p2 = [x - px * w, y - py * w], p3 = [x - c * w * .5, y - s * w * .5];
    poly(cx, [p0, p1, p2, p3], fill || Z.pale, stroke || Z.ink, .7);
    if(WH) return;
    poly(cx, [p0, p1, [x, y]], 'rgba(39,75,120,.45)');
    line(cx, [p1, p2], 'rgba(255,255,255,.85)', .5);
  }
  function branch(cx, x, y, len, w, ang, fill){            // crown-style branching crystal: a main spike with one side shoot
    crystal(cx, x, y, len, w, ang, fill);
    crystal(cx, x + Math.cos(ang) * len * .5, y + Math.sin(ang) * len * .5, len * .55, w * .55, ang + (len > 8 ? .75 : -.75), Z.ice);
  }
  function strand(cx, x, y, ang, len, w, bend, fill, stroke){   // tapered flowing lock of hair / cloth tuft
    const L = [], R = []; let px = x, py = y, a = ang;
    for(let i = 0; i <= 3; i++){ const ww = w * (1 - i / 3 * .87), nx = -Math.sin(a), ny = Math.cos(a);
      L.push([px + nx * ww, py + ny * ww]); R.push([px - nx * ww, py - ny * ww]); a += bend / 3; px += Math.cos(a) * len / 3; py += Math.sin(a) * len / 3; }
    poly(cx, L.concat(R.reverse()), fill, stroke, .6);
  }
  function seg(cx, ax, ay, bx, by, w0, w1, fill, hi){          // one armor plate along a limb segment (quad), dark outline + light top edge
    const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    const a = [ax + nx * w0, ay + ny * w0], b = [bx + nx * w1, by + ny * w1], c = [bx - nx * w1, by - ny * w1], d = [ax - nx * w0, ay - ny * w0];
    poly(cx, [a, b, c, d], fill, Z.ink, 1);
    if(hi) line(cx, [a, b], hi, .55);
  }
  function groundBurst(cx, x, k, R, n, hmax){            // circular frost ring + ice spikes erupting from the floor (floor = y 0). k 0..1
    if(k <= 0 || k >= 1 || WH) return;
    const e = 1 - Math.pow(1 - k, 3), rise = Math.sin(Math.min(1, k * 1.7) * Math.PI / 2) * (1 - Math.max(0, (k - .55) / .45));
    cx.save(); cx.globalAlpha = clamp(1 - k * k, 0, 1);
    cx.fillStyle = 'rgba(165,217,242,.32)'; cx.beginPath(); cx.ellipse(x, -1, R * e * .9, R * e * .13 + 1, 0, 0, 7); cx.fill();
    cx.strokeStyle = 'rgba(241,248,255,.95)'; cx.lineWidth = 1.7 * (1 - k) + .4; cx.beginPath(); cx.ellipse(x, -1, R * e, R * e * .16 + 1, 0, 0, 7); cx.stroke();
    for(let i = 0; i < n; i++){ const u = (i + .5) / n * 2 - 1, h = (.45 + .55 * rn(i)) * hmax * rise; if(h < 1.2) continue;
      crystal(cx, x + u * R * e, 0, h, 1.4 + h * .13, -Math.PI / 2 + u * .38 + (rn(i + 5) - .5) * .3, i % 3 ? Z.pale : Z.ice); }
    cx.restore();
  }
  function frostBurst(cx, x, y, k, big, n){               // ring + flakes + shards where ice leaves a hand / hits the floor. k 0..1
    if(k <= 0 || k >= 1 || WH) return;
    cx.strokeStyle = 'rgba(241,248,255,' + (1 - k) + ')'; cx.lineWidth = 2 * (1 - k) + .5; cx.beginPath(); cx.arc(x, y, 4 + k * (big ? 24 : 12), 0, 7); cx.stroke();
    for(let i = 0; i < n; i++){ const a = i * (6.283 / n) + .3, r = 6 + k * (big ? 22 : 12);
      cx.fillStyle = 'rgba(230,248,255,' + (1 - k) + ')';
      if(i % 2) crystal(cx, x + Math.cos(a) * r, y + Math.sin(a) * r, 3.2 * (1 - k) + 1, .9, a, 'rgba(190,232,255,' + (1 - k) + ')'); else cx.fillRect(x + Math.cos(a) * r, y + Math.sin(a) * r, 2, 2); }
  }

  // ---- ARMOR PIECES ----
  // stacked fortress PAULDRON: three overlapping plates with glacier ice growing between them and jagged crystals sprouting up and out. p = the shoulder point of the arm.
  const PAUL = [[-6, -3, -2.15, 8], [-2.5, -6.4, -1.9, 9.5], [2.5, -7.4, -1.45, 8], [7, -4.6, -.6, 9], [-8.8, 0, -2.75, 6], [9.5, -1.5, -.2, 6.5]];
  function pauldron(cx, p, s, near, t){
    const x = p.x, y = p.y - 1.5;
    PAUL.forEach(([dx, dy, a, l], i) => crystal(cx, x + dx * s, y + dy * s, l * s * (near ? 1 : .85), 2.3 * s, a, i % 2 ? Z.ice : Z.pale));
    for(let i = 0; i < 3; i++){
      const cy = y - i * 2.9 * s + 1.4, rx = (9.6 - i * 1.5) * s, ry = 3.5 * s;
      cx.beginPath(); cx.ellipse(x + .6 + i * .5, cy, rx, ry, -.1, 0, 7);
      if(WH){ cx.fillStyle = '#fff'; cx.fill(); continue; }
      cx.fillStyle = lg(cx, x, cy - ry, x, cy + ry, [[0, i % 2 ? Z.silver : Z.ice], [.55, Z.silver], [1, Z.silverLo]]); cx.fill();
      cx.strokeStyle = Z.ink; cx.lineWidth = 1.1; cx.stroke();
      cx.strokeStyle = 'rgba(241,248,255,.8)'; cx.lineWidth = .6; cx.beginPath(); cx.ellipse(x + .6 + i * .5, cy - .5, rx - 1, ry - .8, -.1, 3.5, 5.9); cx.stroke();   // top highlight
      cx.fillStyle = 'rgba(165,217,242,.85)'; cx.beginPath(); cx.ellipse(x + 1 + i * .5, cy + ry - .6, rx * .8, 1, 0, 0, 7); cx.fill();                              // ice caught between plates
    }
    if(WH) return;
    line(cx, [[x - 5 * s, y - 4 * s], [x - 1 * s, y - 6.3 * s], [x + 4 * s, y - 5.6 * s]], 'rgba(80,223,255,.55)', .5);                                             // frost engraving
    poly(cx, [[x + .6, y - 8.8 * s - .5], [x + 2.2, y - 7.2 * s], [x + .6, y - 5.8 * s], [x - 1, y - 7.2 * s]], Z.ice, Z.ink, .6);                                     // crown gem
  }
  // arm armor: plated upper arm, elbow cop, layered forearm guard with ice between the plates, heavy gauntlet with big knuckles and clenched fingers. Hand position is the real S.a*.hand.
  function armArmor(cx, A, near, t, hot){
    const s = A.s, e = A.el, h = A.hand;
    const l1 = Math.hypot(e.x - s.x, e.y - s.y) || 1, u1 = [(e.x - s.x) / l1, (e.y - s.y) / l1];
    const l2 = Math.hypot(h.x - e.x, h.y - e.y) || 1, u2 = [(h.x - e.x) / l2, (h.y - e.y) / l2], n2 = [-u2[1], u2[0]], th = Math.atan2(u2[1], u2[0]);
    const hi = near ? Z.silver : Z.silverLo, pt = (a, b, f) => [a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f];
    const side = n2[1] <= 0 ? 1 : -1;                                                    // ice sprouts on the upper side of the forearm
    let q;
    q = [pt(s, e, .08), pt(s, e, .54)]; seg(cx, q[0][0], q[0][1], q[1][0], q[1][1], 4.6, 4.3, near ? Z.silver : Z.silverLo, 'rgba(255,255,255,.55)');
    q = [pt(s, e, .5), pt(s, e, .94)];  seg(cx, q[0][0], q[0][1], q[1][0], q[1][1], 4.3, 3.9, Z.steel, Z.steelHi);
    cx.beginPath(); cx.arc(e.x, e.y, 4.3, 0, 7);                                          // elbow cop
    if(WH){ cx.fillStyle = '#fff'; cx.fill(); } else { cx.fillStyle = lg(cx, e.x - 4, e.y - 4, e.x + 4, e.y + 4, [[0, Z.ice], [1, Z.silverLo]]); cx.fill(); cx.strokeStyle = Z.ink; cx.lineWidth = 1; cx.stroke(); }
    const P = [[.06, .4, 4, Z.steel], [.36, .7, 3.8, hi], [.66, .97, 3.5, Z.steel]];
    P.forEach(([a, b, w, c]) => { const p0 = pt(e, h, a), p1 = pt(e, h, b); seg(cx, p0[0], p0[1], p1[0], p1[1], w, w - .3, c, c === Z.steel ? Z.steelHi : 'rgba(255,255,255,.6)'); });
    if(!WH){
      line(cx, [pt(e, h, .1), pt(e, h, .92)].map(a => [a[0] + n2[0] * .2, a[1] + n2[1] * .2]), 'rgba(80,223,255,.4)', .4);                                        // engraved frost line
      [.36, .66].forEach((f, i) => { const b = pt(e, h, f); crystal(cx, b[0] + n2[0] * side * 3.3, b[1] + n2[1] * side * 3.3, 4.8 + i, 1.1, Math.atan2(n2[1] * side, n2[0] * side) - .3 * side, Z.ice); });   // glacier ice between plates
    }
    // gauntlet: wrist cuff + big block + three knuckle studs + four armored fingers curled in (partly clenched)
    const w0 = [h.x - u2[0] * 3.8, h.y - u2[1] * 3.8], w1 = [h.x + u2[0] * 1.6, h.y + u2[1] * 1.6];
    seg(cx, w0[0], w0[1], h.x - u2[0] * 1.2, h.y - u2[1] * 1.2, 4.9, 4.6, Z.steel, Z.steelHi);
    seg(cx, h.x - u2[0] * 1.4, h.y - u2[1] * 1.4, w1[0], w1[1], 4.6, 4.4, near ? Z.silver : Z.silverLo, 'rgba(255,255,255,.7)');
    const fo = [-1.9, -.65, .65, 1.9];
    fo.forEach((o, i) => {
      let x = h.x + u2[0] * 1.8 + n2[0] * o * 1.15, y = h.y + u2[1] * 1.8 + n2[1] * o * 1.15, a = th + .08 * i;
      const x1 = x + Math.cos(a) * 2.7, y1 = y + Math.sin(a) * 2.7, a2 = a + 1.05, x2 = x1 + Math.cos(a2) * 2.3, y2 = y1 + Math.sin(a2) * 2.3;
      if(WH){ cx.strokeStyle = '#fff'; cx.lineWidth = 2.6; cx.lineCap = 'round'; cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x1, y1); cx.lineTo(x2, y2); cx.stroke(); return; }
      cx.lineCap = 'round'; cx.lineJoin = 'round';
      cx.strokeStyle = Z.ink; cx.lineWidth = 2.9; cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x1, y1); cx.lineTo(x2, y2); cx.stroke();
      cx.strokeStyle = i % 2 ? Z.silver : Z.ice; cx.lineWidth = 1.7; cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x1, y1); cx.lineTo(x2, y2); cx.stroke();
      cx.fillStyle = 'rgba(165,217,242,.9)'; cx.beginPath(); cx.arc(x2, y2, .8, 0, 7); cx.fill();                                                                   // frost at the fingertip
    });
    if(WH) return;
    for(let i = -1; i <= 1; i++){ const kx = h.x + u2[0] * 1 + n2[0] * i * 1.7, ky = h.y + u2[1] * 1 + n2[1] * i * 1.7;                                                 // knuckles
      cx.fillStyle = Z.ice; cx.beginPath(); cx.arc(kx, ky, 1.25, 0, 7); cx.fill(); cx.strokeStyle = Z.ink; cx.lineWidth = .6; cx.stroke(); }
    crystal(cx, h.x - u2[0] * 1.5 + n2[0] * side * 3.6, h.y - u2[1] * 1.5 + n2[1] * side * 3.6, 4.2, 1, Math.atan2(n2[1] * side, n2[0] * side) + .2 * side, Z.pale);   // ice growing out of the gauntlet
  }
  // ICE CLAWS grown over the gauntlet fingers: three layered blades (pale translucent outer, white inner) reaching past the fingertips. k 0..1 = how grown.
  function iceClaws(cx, A, k, t){
    if(k <= .02) return;
    const e = A.el, h = A.hand, th = Math.atan2(h.y - e.y, h.x - e.x), nx = -Math.sin(th), ny = Math.cos(th);
    for(let i = -1; i <= 1; i++){
      const bx = h.x + Math.cos(th) * 2.4 + nx * i * 1.7, by = h.y + Math.sin(th) * 2.4 + ny * i * 1.7, L = (11.5 + (i === 0 ? 3 : 0)) * k, a = th + i * .1;
      crystal(cx, bx, by, L, 1.9, a, 'rgba(165,217,242,.9)');
      if(!WH) crystal(cx, bx, by, L * .72, .9, a, 'rgba(255,255,255,.95)', 'rgba(255,255,255,0)');
    }
  }
  // slash trail: layered curved streaks along the swing, jagged crystal fragments, scattered flakes. k 0..1 since the release; mode 0 = horizontal, 1 = diagonal.
  function slash(cx, A, k, mode){
    if(WH || k <= 0 || k >= 1) return;
    const s = A.s, h = A.hand, r = Math.hypot(h.x - s.x, h.y - s.y) + 3, a1 = Math.atan2(h.y - s.y, h.x - s.x), sweep = 1.5 - k * .5, al = 1 - k;
    cx.save(); cx.translate(s.x, s.y); if(mode) cx.rotate(.32); cx.scale(1, mode ? .8 : .5);
    cx.lineCap = 'round';
    [['rgba(80,223,255,', .22, 6], ['rgba(165,217,242,', .5, 3.4], ['rgba(241,248,255,', .95, 1.4]].forEach(([c, a, w], i) => {
      cx.strokeStyle = c + (a * al) + ')'; cx.lineWidth = w * (1 - k * .5); cx.beginPath(); cx.arc(0, 0, r + 2 - i * 1.2, a1 - sweep, a1 + .05); cx.stroke(); });
    cx.restore();
    for(let i = 0; i < 7; i++){                                                                       // jagged fragments + flakes drifting off the arc
      const a = a1 - sweep * (.15 + rn(i) * .85), rr = r + (rn(i + 7) - .5) * 9 + k * 8, x = s.x + Math.cos(a) * rr, y = s.y + Math.sin(a) * rr * (mode ? .8 : .5) + (mode ? k * 5 : 0);
      if(i % 2) crystal(cx, x, y, 3.5 * al + 1, .9, a + 1.57, 'rgba(190,232,255,' + al + ')'); else { cx.fillStyle = 'rgba(241,248,255,' + al + ')'; cx.fillRect(x, y, 1.8, 1.8); }
    }
  }

  // ---- ICE AGE effects (character-side): 5 phases over the existing 3 s cast ----
  function iceAge(cx, f, t, S, p){
    const bx = S.sh.x, by = (S.sh.y + S.pel.y) / 2, lvl = p < .333 ? 1 : p < .667 ? 2 : p < .933 ? 3 : 4;
    const k = clamp(p / .94, 0, 1), mx = (S.aN.hand.x + S.aF.hand.x) / 2, my = (S.aN.hand.y + S.aF.hand.y) / 2 - 4;
    const R0 = 22 + 70 * k, gl = cx.createRadialGradient(bx, by, 4, bx, by, R0);                    // pale-blue atmosphere, grows with the cast
    gl.addColorStop(0, 'rgba(165,217,242,' + (.1 + .22 * k) + ')'); gl.addColorStop(1, 'rgba(165,217,242,0)'); cx.fillStyle = gl; cx.beginPath(); cx.arc(bx, by, R0, 0, 7); cx.fill();
    const g2 = cx.createRadialGradient(mx, my, 2, mx, my, 12 + 46 * k); g2.addColorStop(0, 'rgba(241,248,255,' + (.3 + .45 * k) + ')'); g2.addColorStop(1, 'rgba(165,217,242,0)');
    cx.fillStyle = g2; cx.beginPath(); cx.arc(mx, my, 12 + 46 * k, 0, 7); cx.fill();                    // gathering light above both hands
    [S.aN.hand, S.aF.hand].forEach((hd, hi) => {                                                       // ice gathers on both gauntlets
      const n = 2 + lvl;
      for(let i = 0; i < n; i++) crystal(cx, hd.x, hd.y, 3 + k * 6 + (i % 2) * 2, 1.1, -Math.PI / 2 + (i - (n - 1) / 2) * .5 + Math.sin(t * 2 + i + hi) * .08, i % 2 ? Z.ice : Z.pale);
    });
    for(let i = 0; i < 14; i++){ const kk = (t * (.9 + lvl * .25) + i / 14) % 1, a = t * 4 + i * .9, rr = 10 + (1 - kk) * (24 + 44 * k);   // frost spirals into the hands
      cx.fillStyle = 'rgba(241,248,255,' + (.2 + .6 * kk) + ')'; cx.beginPath(); cx.arc(mx + Math.cos(a) * rr, my + Math.sin(a) * rr * .6, 1 + kk * 1.4, 0, 7); cx.fill(); }
    cx.strokeStyle = 'rgba(200,240,255,' + (.2 + .35 * k) + ')'; cx.lineWidth = 1.4; cx.beginPath(); cx.ellipse(mx, my, 20 + 34 * k, 6 + 10 * k, 0, 0, 7); cx.stroke();
    const sn = Math.round(6 + 26 * clamp(p / .67, 0, 1));                                              // blizzard: more + faster snow each phase, wind from phase 2
    for(let i = 0; i < sn; i++){ const ph = (t * (.22 + lvl * .16) + rn(i) * 3.1 + i * .173) % 1, x = bx + (rn(i * 7 + 3) - .5) * 150 + Math.sin(t * 1.7 + i) * 6 - (lvl >= 2 ? ph * 30 : 0), y = by - 70 + ph * 78;
      cx.fillStyle = 'rgba(241,248,255,' + (.75 * Math.sin(Math.PI * ph)) + ')';
      if(lvl >= 3 && i % 5 === 0) crystal(cx, x, y, 3.4, 1, Math.PI / 2 + Math.sin(t * 3 + i) * .6, 'rgba(190,232,255,.85)'); else cx.fillRect(x, y, 1 + (i % 3) * .5, 1 + (i % 3) * .5); }
    const nf = 4 + lvl * 2;                                                                            // orbiting crystal fragments, faster every phase
    for(let i = 0; i < nf; i++){ const a = t * (1.1 + lvl * .6) + i * 6.283 / nf, rr = 22 + (i % 3) * 8 + k * 10;
      crystal(cx, bx + Math.cos(a) * rr, by + Math.sin(a) * rr * .45, 3 + lvl * .8, 1.1, a + 1.57, i % 2 ? Z.ice : Z.pale); }
    if(f.gr && p > .55){ const g = clamp((p - .55) / .4, 0, 1);                                         // frost spreads over the floor: a frozen kingdom forming
      cx.fillStyle = 'rgba(165,217,242,' + (.28 * g) + ')'; cx.beginPath(); cx.ellipse(bx, -1, 14 + 62 * g, 2 + 3 * g, 0, 0, 7); cx.fill();
      for(let i = 0; i < 11; i++){ const u = (i - 5) / 5, h = (3 + rn(i) * 9) * g; if(h > 1.5) crystal(cx, bx + u * (10 + 56 * g), 0, h, 1.2 + h * .1, -Math.PI / 2 + u * .3, i % 2 ? Z.ice : Z.pale); } }
    if(p > .94){ const q = (p - .94) / .06;                                                            // CATACLYSM: white flash + shards exploding outward
      cx.fillStyle = 'rgba(241,248,255,' + (.65 * (1 - q)) + ')'; cx.beginPath(); cx.arc(bx, by, 26 + q * 80, 0, 7); cx.fill();
      for(let i = 0; i < 14; i++){ const a = i * .449 + .2, rr = 10 + q * (36 + rn(i) * 34); crystal(cx, bx + Math.cos(a) * rr, by + Math.sin(a) * rr * .8, 4 + 7 * (1 - q), 1.3, a, i % 2 ? Z.ice : Z.pale); }
      if(f.gr) groundBurst(cx, bx, q, 78, 13, 20); }
  }
  function aftermath(cx, f, t, S, ta){                      // Phase 5: floating fragments, ground mist, blizzard weakening, burst finishing on the floor
    const w = clamp(1 - ta / 3.2, 0, 1), bx = S.sh.x, by = (S.sh.y + S.pel.y) / 2;
    if(f.gr){ if(ta < 1) groundBurst(cx, bx, .3 + ta * .7, 78, 13, 20);
      for(let i = 0; i < 6; i++){ const ph = t * .5 + i * 1.7; cx.fillStyle = 'rgba(200,235,255,' + (.2 * w) + ')'; cx.beginPath(); cx.ellipse(bx - 36 + i * 14 + Math.sin(ph) * 4, -2 + Math.cos(ph) * .8, 12, 2.6, 0, 0, 7); cx.fill(); } }
    for(let i = 0; i < 10; i++){ const ph = (ta * .12 + rn(i) * .6) % 1, x = bx + (rn(i + 9) - .5) * 80 + Math.sin(t * 1.1 + i) * 5, y = by - 4 - ph * 34 - rn(i + 3) * 16;
      cx.globalAlpha = w * .8; crystal(cx, x, y, 3 + rn(i) * 3, 1, Math.PI / 2 + Math.sin(t + i) * .5, i % 2 ? Z.ice : Z.pale); cx.globalAlpha = 1; }
    const sn = Math.round(16 * w); for(let i = 0; i < sn; i++){ const ph = (t * .26 + rn(i) * 3.1 + i * .17) % 1;
      cx.fillStyle = 'rgba(241,248,255,' + (.6 * w * Math.sin(Math.PI * ph)) + ')'; cx.fillRect(bx + (rn(i * 7 + 3) - .5) * 120, by - 60 + ph * 66, 1.4, 1.4); }
  }

  // ---- GLACIER SPEAR: one function draws the held spear AND the flying one. Local space: tail at -L/2, tip at +L/2. q = charge 0..1. ----
  // early: small plain crystal spear. partial: rough edges + shaky look. full: complete crown of blades. max: extra blades + stronger white core.
  function spear(cx, L, w, q, t, calm){
    const X = v => v * L;
    if(!WH){
      for(let i = 2; i >= 0; i--){                                                                 // CRYSTALLIZATION: translucent outer layers grow in one after another and lock onto the shaft
        const g = clamp(q * 3.4 - i * .7, 0, 1); if(g <= 0) continue; const m = 1 + (i + 1) * .24 * g, ln = 1 + (i + 1) * .06 * g;
        poly(cx, [[X(-.5 * ln), 0], [X(-.34), -.5 * w * m], [X(.2), -.5 * w * m], [X(.26), -w * m], [X(.5 * ln), 0], [X(.26), w * m], [X(.2), .5 * w * m], [X(-.34), .5 * w * m]], 'rgba(165,217,242,' + (.16 + .08 * g) + ')', 'rgba(221,245,255,' + (.35 * g) + ')', .5);
      }
    }
    const shaft = [[X(-.5), 0], [X(-.34), -.5 * w], [X(.18), -.5 * w], [X(.24), -w], [X(.5), 0], [X(.24), w], [X(.18), .5 * w], [X(-.34), .5 * w]];
    poly(cx, shaft, 'rgba(190,232,255,.96)', Z.ink, 1);
    if(WH) return;
    poly(cx, [[X(-.5), 0], [X(-.34), .5 * w], [X(.18), .5 * w], [X(.24), w], [X(.5), 0]], 'rgba(39,75,120,.78)');                     // deep glacier-blue lower facets
    poly(cx, [[X(-.34), -.5 * w], [X(.18), -.5 * w], [X(.24), -w], [X(.5), 0], [X(.1), -.1 * w]], 'rgba(221,245,255,.55)');             // pale upper facet
    cx.shadowColor = '#9fe4ff'; cx.shadowBlur = 5 + 11 * q;
    poly(cx, [[X(-.44), 0], [X(-.2), -.17 * w], [X(.32), -.22 * w], [X(.47), 0], [X(.32), .22 * w], [X(-.2), .17 * w]], 'rgba(255,255,255,' + (.8 + .18 * q) + ')');   // white inner core
    cx.shadowBlur = 0;
    line(cx, [[X(-.4), -.46 * w], [X(.17), -.46 * w], [X(.23), -.92 * w], [X(.46), -.05 * w]], 'rgba(241,248,255,.9)', .7);                  // silver-white reflection along the top edge
    line(cx, [[X(-.2), .34 * w], [X(.12), .34 * w]], 'rgba(201,214,226,.7)', .5);
    if(q > .22 && q < .8) for(let i = 0; i < 4; i++) crystal(cx, X(-.22 + i * .13), (i % 2 ? .5 : -.5) * w, w * (.55 + rn(i) * .35), .8, (i % 2 ? 1 : -1) * (1.15 + rn(i + 4) * .5), Z.pale);   // rough, unstable edges
    const nb = q < .2 ? 0 : q < .5 ? 1 : q < .85 ? 2 : q < .97 ? 3 : 4;                          // crown-like blades around the head: 0 / 2 / 4 / 6 / 8 blades
    for(let i = 0; i < nb; i++) for(let sd = -1; sd <= 1; sd += 2)
      crystal(cx, X(.17 - i * .028), sd * w * (.46 + i * .05), w * (1.25 + q * .6 - i * .1), w * .3, sd * (.45 + i * .26), i % 2 ? Z.ice : Z.pale);
    if(q > .2) for(let sd = -1; sd <= 1; sd += 2) crystal(cx, X(-.3), sd * w * .42, w * (.9 + q * .6), w * .26, sd * (Math.PI - .55), Z.pale);   // rear fins
    if(q > .96){ crystal(cx, X(.5), 0, w * 1.3, w * .35, 0, Z.plat); cx.strokeStyle = 'rgba(80,223,255,.5)'; cx.lineWidth = .6; cx.beginPath(); cx.arc(X(.46), 0, w * .6, 0, 7); cx.stroke(); }   // Sovereign Glacier: restrained cyan only at the tip
  }

  Characters.art('zerathis', {
    // HEAVY Glacier King. Limb LENGTHS (and so the hand / foot reach and every angle table above) are unchanged; the body is made massive with a much wider
    // chest, thicker arms, hands and legs and broad boots. (Hitbox is not tied to these numbers: arena.js is untouched.)
    body: {head:{r:6.1}, torso:{len:16, w:17}, uArm:{len:10.5, w:6.6}, fArm:{len:10.5, w:6}, hand:{r:4},
           thigh:{len:11, w:7.8}, shin:{len:10.5, w:6.8}, foot:{len:9.5, w:4.8}},
    colors: {shirt:'#172B4D', limb:'#8CA0B6', far:'#4A6079', legs:'#4A6079', legsFar:'#26364A', head:'#D6DCE6', dark:'#07101E', hand:'#C9D6E2'},

    farFront: FF,

    // slow and soft while he gathers (dignified), very stiff at the release (snap), medium after
    spring(p, A){
      if(A.skill === 'sniper') return A.snipe && A.snipe.ph === 'recover' ? {k:430, d:32} : {k:240, d:26};
      if(A.skill === 'iceage') return p > .93 ? {k:470, d:36} : {k:150, d:22};
      if(A.skill === 'wintergrasp' || A.skill === 'crystalcoffin') return p > .35 && p < .7 ? {k:460, d:38} : {k:260, d:28};
      const c = C[A.step || 0];
      if(p < c - .1) return {k:130, d:22};
      if(p < c + .1) return {k:440, d:40};
      return {k:150, d:24};
    },

    attack(tg, p, A, K){
      if(A.skill === 'sniper' && A.snipe){ aimPose(tg, A.snipe); return; }                                  // HOLD ATK: Glacier Spear
      const s = A.skill === 'wintergrasp' ? GRASP : A.skill === 'crystalcoffin' ? COFFIN : A.skill === 'iceage' ? AGE : STEP[A.step || 0];
      ['aN', 'eN', 'aF', 'eF', 'lean', 'head', 'tN', 'tF'].forEach(j => tg[j] = K(p, s[j]));
      const Y = Math.min(K(p, s.Y), .97 * (T + SH) * Math.min(Math.cos(tg.tN), Math.cos(tg.tF)));
      tg.kN = legK(tg.tN, Y); tg.kF = legK(tg.tF, Y);
    },

    // commanding royal stance: chest forward, slight forward lean, head raised, arms held away from the body with bent elbows (hands half clenched), feet planted wide.
    // Walking keeps the original longer strides; landing adds a brief heavy absorb. Both feet keep their own ground height (knees are re-solved with legK).
    pose(tg, f, t, run, K){
      const s = track(f, t), b = Math.sin(t * 1.6), idle = 1 - run, land = clamp(1 - (t - s.land) / .45, 0, 1) * s.imp;
      let Yn, Yf; const ok = idle > .7 && f.gr && typeof tg.tN === 'number' && typeof tg.kN === 'number' && typeof tg.tF === 'number' && typeof tg.kF === 'number';
      if(ok){ Yn = T * Math.cos(tg.tN) + SH * Math.cos(tg.tN - tg.kN); Yf = T * Math.cos(tg.tF) + SH * Math.cos(tg.tF - tg.kF); }
      tg.lean += idle * (b * .012 + .035) + run * .07 + land * .07;
      tg.head += idle * Math.sin(t * 1.6 - .8) * .02 - .03 - land * .05;
      tg.aN += idle * (.22 + b * .03);  tg.aF += idle * (.2 - b * .03);
      tg.eN += idle * .38;              tg.eF += idle * .42;
      tg.tN *= 1 + run * .1;            tg.tF *= 1 + run * .1;
      if(ok){                                                                                                // wider planted stance, feet stay at their old height
        const tn = tg.tN + idle * .07, tf = tg.tF - idle * .07, kn = legK(tn, Math.min(Yn, .985 * (T + SH))), kf = legK(tf, Math.min(Yf, .985 * (T + SH)));
        if(isFinite(kn) && isFinite(kf) && Math.abs(kn - tg.kN) < .6 && Math.abs(kf - tg.kF) < .6){ tg.tN = tn; tg.tF = tf; tg.kN = kn; tg.kF = kf; }
      }
    },

    // ---- BEHIND the body: floor frost under the boots, the heavy royal CAPE, the long white back hair ----
    behind(cx, f, t, S, P){
      WH = f.flash > 0;
      const s = track(f, t), A = f.A || {}, p = castP(f), SK = A.skill; S._ff = FF(f);
      const iu = SK === 'iceage' && p >= 0 && p < .96 ? ease(clamp(p / .12, 0, 1)) : 0, fly = Math.max(s.air * .75, iu);
      const run = clamp(Math.abs(f.vx || 0) / 180, 0, 1), dirb = (f.vx || 0) * (f.face || 1) >= 0 ? -1 : 1;

      if(f.gr && !WH){                                                                                       // frost spreads under his boots; scales with how fast he walks / runs
        const w = .12 + .22 * run, imp = clamp(1 - (t - s.land) / .6, 0, 1) * s.imp;
        cx.fillStyle = 'rgba(200,235,255,' + (w + .1 * imp) + ')'; cx.beginPath(); cx.ellipse(-1 - dirb * run * 6, -1, 15 + 8 * run + 16 * imp, 2.2 + imp * 1.2, 0, 0, 7); cx.fill();
        cx.strokeStyle = 'rgba(241,248,255,' + (.25 + .3 * run) + ')'; cx.lineWidth = .6; cx.beginPath(); cx.ellipse(-1, -1, 11 + 6 * run, 1.6, 0, 0, 7); cx.stroke();
        for(let i = 0; i < 4; i++){ const ph = t * .9 + i * 1.7; cx.fillStyle = 'rgba(200,235,255,' + (.14 - i * .02) + ')'; cx.beginPath(); cx.ellipse(-8 + i * 6 + Math.sin(ph) * 3, -1.5 + Math.cos(ph) * .8, 8, 2.4, 0, 0, 7); cx.fill(); }
        for(let i = 0; i < 6; i++){ const k = (t * 2.6 + i / 6) % 1; if(run < .2 && imp < .1) break;                // ice fragments kicked up behind the heel
          cx.fillStyle = 'rgba(230,248,255,' + ((1 - k) * (.4 + .5 * Math.max(run, imp))) + ')'; cx.fillRect(dirb * (3 + k * 15 + i * 2) , -1 - Math.sin(Math.PI * k) * (4 + 6 * imp) - 1, 1.6, 1.6); }
        if(imp > .02){ const k = 1 - imp; groundBurst(cx, 0, k * .9, 22 + 16 * s.imp, 7, 7 + 5 * s.imp); }    // landing: circular frost burst + scattered shards
      }

      // ROYAL CAPE: thick white outer cloth, deep-navy lining, heavy folds, frost-stiff torn hem with crystals. Lags behind (s.lag), spreads back when airborne, streams up in the ultimate.
      {
        const sh = S.sh, x0 = sh.x - 2, y0 = sh.y - 2, lift = s.air * 9 + iu * 20, yb = -2 - lift, back = 12 + s.lag * 1.1 + s.air * 9 + iu * 8;
        const sw = Math.sin(t * 1.5) * .9 + Math.sin(t * 2.9 + 1) * .35 + (fly > 0 ? Math.sin(t * 7) * 1.2 * fly : 0), mid = (y0 + yb) / 2;
        const qb = (u, a, b, c) => (1 - u) * (1 - u) * a + 2 * (1 - u) * u * b + u * u * c;
        const hx = x0 - back + sw, outer = [[x0 - 3, y0 - 3]];
        [.25, .5, .75, 1].forEach(u => outer.push([qb(u, x0 - 3, x0 - 7 - s.lag * .35 - s.air * 3, hx), qb(u, y0 - 3, mid + 4, yb)]));
        const hem = [], N = 7;
        for(let i = 1; i <= N; i++){ const u = i / N, x = lerp(hx, x0 + 3, u) + Math.sin(t * 1.3 + i) * .4, tip = i % 2 === 0, ice = i % 3 === 0;
          hem.push([x - (tip ? 0 : 1.2), yb + (tip ? 1.5 + rn(i) * 3.5 + (ice ? 3 : 0) : -2.4 - rn(i + 2) * 1.5)]); }
        const body = outer.concat(hem, [[x0 + 5, y0 + 9], [x0 + 5, y0 + 3]]);
        const shade = body.map(q => [q[0] - 1.6, q[1] + .7]);
        poly(cx, shade, lg(cx, x0, y0, hx, yb, [[0, '#BFD8EA'], [1, '#86AFCB']]), Z.ink, 1);                 // second thick layer
        poly(cx, body, lg(cx, x0, y0, hx, yb, [[0, Z.plat], [.55, '#D6EBF7'], [1, Z.pale]]), Z.ink, 1.1);
        if(!WH){
          poly(cx, [[x0 + 4.6, y0 + 2], [x0 + 1, y0 + 1.6], [x0 + 1.3 + sw * .3, mid], [x0 - .6 + sw * .5, yb - 2.4], [x0 + 3, yb - 1.5], [x0 + 5, y0 + 9]], lg(cx, x0, y0, x0, yb, [[0, Z.glacier], [1, Z.navy]]), null);   // navy lining
          line(cx, [[x0 + 1, y0 + 1.6], [x0 + 1.3 + sw * .3, mid], [x0 - .6 + sw * .5, yb - 2.4]], 'rgba(201,214,226,.8)', .8);                    // silver trim
          for(let i = 0; i < 4; i++){ const q = hem[1 + i * 2] || hem[hem.length - 1], sx = x0 - 6 + i * 2.6;                                  // heavy vertical folds
            line(cx, [[sx, y0 + 2], [lerp(sx, q[0], .4) - 1.4, lerp(y0, q[1], .5)], [q[0], q[1] - 3]], i % 2 ? 'rgba(39,75,120,.45)' : 'rgba(255,255,255,.65)', .8); }
          line(cx, outer.concat(hem), 'rgba(185,230,255,.95)', .8);                                                                           // frosted edge
          for(let i = 2; i < hem.length; i += 3) crystal(cx, hem[i][0], hem[i][1] - 1, 4 + rn(i) * 3, 1, Math.PI / 2 + (rn(i + 1) - .5) * .8, Z.ice);   // ice stiffening the hem
          crystal(cx, outer[2][0], outer[2][1], 4.5, 1, Math.PI - .5, Z.pale);
        }
      }

      // long white back HAIR (head space): five flowing locks over the cape; they lag, flow back/up when jumping and in the ultimate
      {
        const h = S.head, ang = Math.atan2(h.x - S.sh.x, -(h.y - S.sh.y)), sway = Math.sin(t * 1.3) * .08;
        const B = [[-4.4, -3.6, 19, 3.3], [-5.4, -1, 23, 3.5], [-5.5, 1.6, 21, 3.3], [-4.3, 4, 17, 2.9], [-2.2, -5.2, 14, 2.5]];
        cx.save(); cx.translate(h.x, h.y); cx.rotate(ang);
        B.forEach(([x, y, len, w], i) => {
          const base = Math.PI / 2 + .3 + i * .03 + sway * (i % 2 ? 1 : -1) + s.lag * .03, a = lerp(base, Math.PI * .82, fly * .75);
          strand(cx, x, y, a, len * (1 + fly * .12), w, -.5 * (1 - fly) + Math.sin(t * 1.8 + i * 1.3) * .15 - fly * .35, i % 2 ? Z.hairLo : Z.hair, Z.ink);
        });
        if(!WH) line(cx, [[-5, -2], [-7.6, 6], [-7.2, 13]], 'rgba(255,255,255,.55)', .5);
        cx.restore();
      }
      WH = false;
    },

    front(cx, f, t, S, P){
      // tell arena.js where the hands are in the world, so the ice leaves the real hand (unchanged)
      f.handW = {N:{x:f.x + f.face * S.aN.hand.x, y:f.y + S.aN.hand.y}, F:{x:f.x + f.face * S.aF.hand.x, y:f.y + S.aF.hand.y}};
      f.handW.S = f.handW.N;                                              // the Glacier Spear leaves the near hand
      WH = f.flash > 0;
      const s = track(f, t), h = S.head, ang = Math.atan2(h.x - S.sh.x, -(h.y - S.sh.y));
      const A = f.A || {}, SN = f.snipe, p = castP(f), SK = A.skill, st = A.step || 0;
      const hold = !!SN && SN.ph === 'aim', thrown = !!SN && SN.ph === 'recover' && SN.rt < .3, casting = f.atk > 0 && !!A.time;
      const c = SK === 'wintergrasp' || SK === 'crystalcoffin' ? .55 : C[st];
      const iu = SK === 'iceage' && p >= 0 && p < .96 ? ease(clamp(p / .12, 0, 1)) : 0, fly = Math.max(s.air * .75, iu);
      let aura = 0;                                                       // eye + crown glow stronger while a big spell builds
      if(SK === 'iceage') aura = clamp(p / .9, 0, 1);
      else if(hold) aura = SN.ready ? 1 : .4 * clamp(SN.kn, 0, 1);
      else if(casting && (SK === 'wintergrasp' || SK === 'crystalcoffin')) aura = .55 * Math.sin(Math.PI * clamp(p, 0, 1));
      else if(casting) aura = p < c ? .5 * p / c : .5 * (1 - (p - c) / (1 - c));
      const pm = {x:(S.aN.hand.x + S.aF.hand.x) / 2, y:(S.aN.hand.y + S.aF.hand.y) / 2};
      const clawN = casting && !SK && st === 0 ? (p < c ? clamp(p / c, 0, 1) : clamp(1 - (p - c) / .3, 0, 1)) : 0;
      const clawF = casting && !SK && st === 1 ? (p < c ? clamp(p / c, 0, 1) : clamp(1 - (p - c) / .3, 0, 1)) : 0;

      // royal TABARD: layered deep-navy panels hanging from the belt, silver trim, white frost hem
      {
        const px = S.pel.x, py = S.pel.y, sway = Math.sin(t * 2) * .6 - s.lag * .22;
        poly(cx, [[px - 6.5, py], [px + 6.8, py], [px + 8 + sway, py + 13], [px + 4 + sway, py + 11], [px + 1 + sway, py + 15], [px - 3 + sway, py + 11.5], [px - 7 + sway, py + 14]], lg(cx, px, py, px, py + 15, [[0, Z.navy], [1, '#0e1b33']]), Z.ink, 1);          // back panel
        poly(cx, [[px - 4.8, py + 1], [px + 5.4, py + 1], [px + 6.6 + sway, py + 15], [px + 3 + sway, py + 12.6], [px + .4 + sway, py + 16.4], [px - 2.4 + sway, py + 12.8], [px - 5.4 + sway, py + 15]], lg(cx, px, py, px, py + 16, [[0, '#2a4a7c'], [1, Z.glacier]]), Z.ink, 1.1);  // front panel
        if(!WH){
          line(cx, [[px - 4.2, py + 2], [px - 4.8 + sway * .4, py + 13.8]], Z.silver, .8); line(cx, [[px + 4.8, py + 2], [px + 6 + sway * .6, py + 14]], Z.silver, .8);                                // silver trim
          line(cx, [[px + .4, py + 3], [px + .8 + sway * .5, py + 11]], 'rgba(165,217,242,.7)', .5);                                                                                          // engraving
          poly(cx, [[px + .4, py + 4.5], [px + 1.8, py + 6.2], [px + .4, py + 8], [px - 1, py + 6.2]], null, 'rgba(201,214,226,.8)', .5);
          line(cx, [[px - 5.4 + sway, py + 15], [px - 2.4 + sway, py + 12.8], [px + .4 + sway, py + 16.4], [px + 3 + sway, py + 12.6], [px + 6.6 + sway, py + 15]], 'rgba(241,248,255,.9)', .9);        // white frost edge
        }
      }
      // far arm armor (only while the far arm is drawn over the body; otherwise torso() draws it behind the chest)
      if(FF(f)){ armArmor(cx, S.aF, false, t, aura); pauldron(cx, S.aF.s, .92, false, t); }
      armArmor(cx, S.aN, true, t, aura);
      pauldron(cx, S.aN.s, 1.12, true, t);

      // ICE CLAWS (basic attack 1 = near hand, horizontal slash; 2 = far hand, diagonal slash) + their slash trails
      if(clawN) iceClaws(cx, S.aN, clawN, t);
      if(clawF) iceClaws(cx, S.aF, clawF, t);
      if(casting && !SK && st < 2 && p >= c - .02 && p < c + .3) slash(cx, st ? S.aF : S.aN, (p - c + .02) / .32, st);

      // ---- HEAD (head space): front hair lock, human face, frost scar, heavy crown, braided beard ----
      cx.save(); cx.translate(h.x, h.y); cx.rotate(ang);
      const bs = Math.sin(t * 1.7) * .6 + 0, fl = fly, dx = -(s.lag * .3 + fl * 5), dy = -fl * 6;                // beard / hair flow
      strand(cx, -1.6, -4.8, Math.PI / 2 + .25 - fl * .5, 12, 2.3, -.3 + Math.sin(t * 1.6) * .12, Z.hair, Z.ink);       // front side lock over the temple
      if(!WH){
        cx.fillStyle = 'rgba(185,217,238,.75)'; cx.beginPath(); cx.ellipse(3.1, 2.1, 2.3, 1.5, 0, 0, 7); cx.fill();    // frostbite cheek
        cx.fillStyle = 'rgba(150,175,200,.35)'; cx.beginPath(); cx.ellipse(2, -4.2, 1.3, .8, 0, 0, 7); cx.fill();      // frostbitten temple
        poly(cx, [[5.7, -.4], [7.5, 1.9], [5.5, 2.4]], Z.skin, 'rgba(60,76,98,.9)', .6);                                // nose
        cx.fillStyle = 'rgba(55,70,92,.6)'; cx.beginPath(); cx.ellipse(3.8, -1.3, 2.9, 1.9, 0, 0, 7); cx.fill();       // dark eye socket
        line(cx, [[.9, -.4], [2, .5]], 'rgba(70,86,108,.6)', .4); line(cx, [[1.2, -4.4], [2.4, -3.6]], 'rgba(70,86,108,.5)', .4);        // age wrinkles
        line(cx, [[2.2, 1.1], [4.9, 3.5]], 'rgba(95,110,135,.85)', .5); crystal(cx, 3.2, 2, 2.4, .45, -1.9, Z.ice); crystal(cx, 4.4, 3.1, 2, .4, -.9, Z.ice);   // scar with frost
        cx.shadowColor = Z.cyan; cx.shadowBlur = 3 + 11 * aura;
        cx.fillStyle = '#E9FAFF'; cx.beginPath(); cx.ellipse(3.9, -1.3, 1.95, 1.2, 0, 0, 7); cx.fill();                      // eye white
        cx.fillStyle = '#35C8F5'; cx.beginPath(); cx.arc(4.35, -1.3, 1, 0, 7); cx.fill(); cx.shadowBlur = 0;               // icy-blue iris
        cx.fillStyle = Z.cyan; cx.beginPath(); cx.arc(4.35, -1.3, .62, 0, 7); cx.fill();
        cx.fillStyle = '#06222f'; cx.beginPath(); cx.arc(4.6, -1.3, .38, 0, 7); cx.fill();
        cx.fillStyle = '#fff'; cx.fillRect(4, -1.8, .5, .5);
        cx.strokeStyle = Z.ink; cx.lineWidth = 1.2; cx.lineCap = 'round'; cx.beginPath(); cx.moveTo(1.2, -3.7); cx.lineTo(6.2, -2.3); cx.stroke();   // stern brow
      }
      // BEARD: thick silver-white mass covering the mouth and jaw, ragged hem, braids with silver rings and small blue gems
      {
        const tx = i => dx * (i / 19), ty = i => dy * (i / 19);
        const hemP = [[6.4, 13.4], [5.3, 11], [4.1, 15], [3, 11.6], [1.8, 14.4], [.4, 10.6], [-.8, 12.6]].map(([x, y], i) => [x + tx(y) + Math.sin(t * 1.6 + i) * .5 + bs * .3, y + ty(y)]);
        cx.beginPath(); cx.moveTo(-2.8, 1.2); cx.bezierCurveTo(-.5, -.2, 3.5, -.2, 6.8, 1.2); cx.bezierCurveTo(8.8, 4, 8.6, 8, 7, 10.6);
        hemP.forEach(q => cx.lineTo(q[0], q[1])); cx.bezierCurveTo(-3.8, 10, -4.2, 5.5, -2.8, 1.2); cx.closePath();
        if(WH){ cx.fillStyle = '#fff'; cx.fill(); }
        else {
          cx.fillStyle = lg(cx, 0, 0, 0, 18, [[0, Z.plat], [.6, Z.beard], [1, '#B6D6EC']]); cx.fill(); cx.strokeStyle = Z.ink; cx.lineWidth = 1; cx.lineJoin = 'round'; cx.stroke();
          line(cx, [[-1.5, 2.6], [.5, 9], [.2 + tx(14), 14.5 + ty(14)]], 'rgba(120,170,205,.55)', .5); line(cx, [[3, 2.4], [4.4, 8.5], [3.6 + tx(15), 15 + ty(15)]], 'rgba(120,170,205,.55)', .5);
          line(cx, [[6, 3], [7, 8], [6 + tx(13), 12.8 + ty(13)]], 'rgba(255,255,255,.7)', .5);
          [[1.6, 8.6, 7], [4.2, 8, 8], [6.4, 7, 5.5]].forEach(([bx0, by0, bl], i) => {                                   // three braids
            let x = bx0, y = by0; const n = 4;
            for(let j = 0; j < n; j++){ const f2 = (j + 1) / n; x = bx0 + tx(by0 + bl * f2) + Math.sin(t * 1.8 + i + j * .6) * .6 * f2; y = by0 + bl * f2 + ty(by0 + bl * f2);
              cx.fillStyle = j % 2 ? Z.silver : Z.plat; cx.beginPath(); cx.ellipse(x, y, 1.15, 1, 0, 0, 7); cx.fill(); cx.strokeStyle = Z.ink; cx.lineWidth = .45; cx.stroke();
              if(j === 1){ cx.strokeStyle = Z.silver; cx.lineWidth = .7; cx.beginPath(); cx.arc(x, y, 1.7, 0, 7); cx.stroke(); }                           // silver ring
              if(j === 2){ cx.fillStyle = '#3FA0E0'; cx.beginPath(); cx.arc(x, y, .75, 0, 7); cx.fill(); } }                                              // blue gem
            if(i !== 1) crystal(cx, x, y + .6, 2.8, .6, Math.PI / 2, Z.ice);                                                                               // frozen tip
          });
          crystal(cx, hemP[2][0], hemP[2][1], 2.6, .55, Math.PI / 2, Z.ice);
        }
      }
      // CROWN: heavy silver band + asymmetric branching ice spikes (never a row of equal triangles); glows brighter with aura
      {
        const crownSp = [[-4.6, -5.6, 5, 1.4, -2.15], [-3, -6.2, 8.5, 1.8, -1.9], [-.8, -6.4, 6.2, 1.5, -1.5], [1.1, -6.2, 11, 2, -1.65], [3, -5.9, 5.5, 1.4, -1.2], [4.8, -5.2, 7.2, 1.6, -.85], [-5.4, -4.6, 4, 1.1, -2.7]];
        if(!WH && aura > .1){ cx.shadowColor = Z.cyan; cx.shadowBlur = 4 + 9 * aura; }
        crownSp.forEach(([x, y, len, w, a], i) => branch(cx, x, y, len, w, a, i === 3 ? Z.plat : i % 2 ? Z.ice : Z.pale));
        cx.shadowBlur = 0;
        poly(cx, [[-5.8, -5.2], [-5.5, -8], [6.9, -6.8], [7, -3.8], [3, -3.9]], lg(cx, 0, -8, 0, -3.5, [[0, Z.plat], [.5, Z.silver], [1, Z.silverLo]]), Z.ink, 1.1);       // solid silver band
        if(!WH){
          line(cx, [[-5.4, -7.5], [6.3, -6.4]], 'rgba(255,255,255,.9)', .6); line(cx, [[-5.2, -4.8], [2.8, -4.2]], 'rgba(60,80,105,.7)', .5);
          poly(cx, [[1.5, -7.6], [2.7, -6.2], [1.5, -4.9], [.3, -6.2]], Z.ice, Z.ink, .5); cx.fillStyle = aura > .3 ? Z.cyan : '#7fd0ff'; cx.beginPath(); cx.arc(1.5, -6.2, .55, 0, 7); cx.fill();   // frost gem
        }
      }
      cx.restore();

      if(WH){ WH = false; return; }

      // ---- character-side casting effects ----
      if(hold){
        // GLACIER SPEAR charge (Monarch's Command): ice fragments gather over the palm and assemble into a spear along the aim. Size follows S.kn. Dotted guide = flight line.
        const hd = S.aN.hand, th = SN.ang, dxv = Math.cos(th), dyv = -Math.sin(th), kn = clamp(SN.kn, 0, 1), rdy = !!SN.ready, pu = .5 + .5 * Math.sin(t * 16), q = rdy ? 1 : Math.min(.96, kn);
        const L = 14 + 34 * ease(q), w = 3.2 + 4.6 * ease(q), cxm = hd.x + dxv * (L * .5 + 3), cym = hd.y + dyv * (L * .5 + 3), aa = Math.atan2(dyv, dxv);
        cx.save(); cx.strokeStyle = 'rgba(190,240,255,' + (rdy ? .35 + .4 * pu : .22) + ')'; cx.lineWidth = rdy ? 1.6 : 1; cx.setLineDash([3, 6]);
        cx.beginPath(); cx.moveTo(hd.x + dxv * (L + 8), hd.y + dyv * (L + 8)); cx.lineTo(hd.x + dxv * 230, hd.y + dyv * 230); cx.stroke(); cx.setLineDash([]); cx.restore();
        for(let i = 0; i < 3 + Math.round(6 * q); i++){                                                  // fragments gather toward the spear; at max charge they orbit faster and tremble
          const kk = (t * (1.1 + q * 1.4) + i / 9) % 1, a = t * (3 + q * 5) + i * 1.9, rr = (L * .28 + w * 1.6) * (.8 + (1 - kk) * .7), tr = rdy ? Math.sin(t * 45 + i * 3) * .5 : 0;
          crystal(cx, cxm + Math.cos(a) * rr * 1.2 + tr, cym + Math.sin(a) * rr * .55 + tr, 2.4 + q * 1.8, .9, a + 1.57, i % 2 ? Z.ice : Z.pale); }
        for(let j = 0; j < 3; j++){ const kk = (t * 1.2 + j / 3) % 1;                                    // FROZEN RESONANCE: faint circular frost ripples pulse out of the spear
          cx.strokeStyle = 'rgba(190,235,255,' + ((1 - kk) * .32 * q) + ')'; cx.lineWidth = 1; cx.beginPath(); cx.ellipse(cxm, cym, L * .22 + kk * 16, w + kk * 10, aa, 0, 7); cx.stroke(); }
        cx.save(); cx.translate(cxm, cym); cx.rotate(aa); spear(cx, L, w, q, t, true); cx.restore();
        if(rdy){ cx.strokeStyle = 'rgba(220,245,255,' + (.4 + .4 * pu) + ')'; cx.lineWidth = 1.3; cx.beginPath(); cx.ellipse(cxm, cym, L * .62 + 3 + pu * 2, w + 6, aa, 0, 7); cx.stroke();
          if(f.gr) for(let i = 0; i < 6; i++){ const u = (i - 2.5) * 5.2, wob = rn(i) * 3 - 1.5;                // HEAVY PRESSURE: tiny frost cracks under his feet at max charge
            line(cx, [[u, -.8], [u + 2.2, -1.7 + wob * .3], [u + 3.6, -.5 + wob * .2], [u + 5.8, -1.6]], 'rgba(190,235,255,' + (.35 + .3 * pu) + ')', .6); } }
        cx.fillStyle = 'rgba(221,245,255,' + (.2 + .3 * q) + ')'; cx.beginPath(); cx.arc(hd.x + dxv * 2, hd.y + dyv * 2, 3 + 3 * q, 0, 7); cx.fill();   // frost gathering in the palm
      } else if(thrown){                                                                                  // just thrown: controlled frost burst at the real near palm
        const hd = S.aN.hand; frostBurst(cx, hd.x + 5, hd.y, SN.rt / .3, true, 8);
      } else if(casting){
        if(SK === 'iceage') iceAge(cx, f, t, S, p);
        else if(SK === 'wintergrasp'){
          // WINTER'S GRASP: both gauntlets and forearms freeze over while the arms rise; the double slam at p .5 = big circular eruption in front of him
          const g = clamp((p - .08) / .42, 0, 1);
          if(p < .5) [S.aN, S.aF].forEach((A2, hi) => { const hd = A2.hand;
            for(let i = 0; i < 4; i++){ const u = (i + 1) / 5, bx = lerp(A2.el.x, hd.x, u), by = lerp(A2.el.y, hd.y, u); crystal(cx, bx, by, (3 + 4 * g) * (.7 + rn(i + hi * 4) * .5), 1.1, -Math.PI / 2 + (i - 1.5) * .5, i % 2 ? Z.ice : Z.pale); }
            for(let i = 0; i < 6; i++){ const a = t * 7 + i * 1.05 + hi, rr = (1 - g) * 14 + 4; cx.fillStyle = 'rgba(221,245,255,' + (.25 + .6 * g) + ')'; cx.beginPath(); cx.arc(hd.x + Math.cos(a) * rr, hd.y + Math.sin(a) * rr * .7, 1 + g * .8, 0, 7); cx.fill(); } });
          else { const k = (p - .5) / .5, hx = (S.aN.hand.x + S.aF.hand.x) / 2;
            cx.fillStyle = 'rgba(241,248,255,' + (.5 * (1 - k)) + ')'; cx.beginPath(); cx.arc(hx + 4, S.aN.hand.y, 6 + k * 26, 0, 7); cx.fill();      // bright white impact center
            if(f.gr) groundBurst(cx, hx + 8, k, 36, 10, 19); else frostBurst(cx, hx + 4, S.aN.hand.y, k, true, 10);
            frostBurst(cx, hx + 4, S.aN.hand.y, k, true, 8); }
        } else {
          const both = SK === 'crystalcoffin' || (!SK && st === 2), hs = both ? [S.aN.hand, S.aF.hand] : st === 1 ? [S.aF.hand] : [S.aN.hand];
          if(p < c){                                                                                      // COIL: frost crystals form and spin around each hand (coffin: small shards orbit)
            const k = clamp(p / c, 0, 1);
            hs.forEach((hd, hi) => {
              for(let i = 0; i < 6; i++){ const a = t * 7 + i * 1.05, r = (1 - k) * (both ? 18 : 13) + 3;
                cx.fillStyle = 'rgba(221,245,255,' + (.25 + .6 * k) + ')'; cx.beginPath(); cx.arc(hd.x + Math.cos(a) * r, hd.y + Math.sin(a) * r * .7, 1 + k * .8, 0, 7); cx.fill(); }
              if(SK === 'crystalcoffin') for(let i = 0; i < 4; i++){ const a = t * 4 + i * 1.57 + hi * 2, r = 7 + (1 - k) * 8; crystal(cx, hd.x + Math.cos(a) * r, hd.y + Math.sin(a) * r * .8, 2.6 + k * 2.4, .9, a + 1.57, i % 2 ? Z.ice : Z.pale); }
              if(both && !SK){ const gl = cx.createRadialGradient(hd.x, hd.y, 1, hd.x, hd.y, 8 + 10 * k); gl.addColorStop(0, 'rgba(241,248,255,' + (.35 + .4 * k) + ')'); gl.addColorStop(1, 'rgba(165,217,242,0)'); cx.fillStyle = gl; cx.beginPath(); cx.arc(hd.x, hd.y, 8 + 10 * k, 0, 7); cx.fill(); }
              for(let i = 0; i < 3; i++) if(SK || st === 2) crystal(cx, hd.x, hd.y, 3 + k * (both ? 7 : 5), 1.2, -1.2 + i * 1.2 + t * 2, 'rgba(205,240,255,.95)');
            });
          } else if(p < c + .16){                                                                         // RELEASE
            const k = (p - c) / .16, hd = hs.length > 1 ? pm : hs[0];
            if(!SK && st === 2){                                                                          // FROSTWAVE: white-hot blast from both palms + a glacier wave of jagged ice racing along the floor
              const gl = cx.createRadialGradient(hd.x + 6, hd.y, 1, hd.x + 6, hd.y, 10 + 20 * k); gl.addColorStop(0, 'rgba(255,255,255,' + (.9 * (1 - k)) + ')'); gl.addColorStop(.5, 'rgba(165,217,242,' + (.5 * (1 - k)) + ')'); gl.addColorStop(1, 'rgba(39,75,120,0)');
              cx.fillStyle = gl; cx.beginPath(); cx.arc(hd.x + 6, hd.y, 10 + 20 * k, 0, 7); cx.fill();
              if(f.gr){ for(let i = 0; i < 9; i++){ const x = 8 + k * (26 + i * 5), h2 = (4 + rn(i) * 10) * (1 - k * .7); if(h2 > 1.5) crystal(cx, x, 0, h2, 1.3 + h2 * .1, -Math.PI / 2 + (rn(i + 3) - .3) * .4, i % 2 ? Z.pale : Z.ice); }
                cx.fillStyle = 'rgba(165,217,242,' + (.3 * (1 - k)) + ')'; cx.beginPath(); cx.ellipse(18 + k * 30, -3, 14 + k * 30, 3, 0, 0, 7); cx.fill(); }     // blue mist trail
            }
            frostBurst(cx, hd.x + 4, hd.y, k, both, 8);
          }
        }
      }
      // Phase 5 aftermath of Eternal Ice Age (the cast has ended): fragments, floor mist and weakening blizzard for ~3 s
      const ta = t - s.iceEnd; if(ta >= 0 && ta < 3.2 && !(casting && SK === 'iceage')) aftermath(cx, f, t, S, ta);
      WH = false;
    },

    // ---- TORSO (called by body.js instead of the plain capsule): royal chestplate. Silver upper plate with frost engraving, dark-steel abdomen bands, navy cloth between plates, belt with gem,
    // gorget at the neck, glacier ice growing out of the plates. The far arm + far pauldron are drawn here (behind the chest) unless the far arm is drawn on top (farFront). ----
    torso(cx, S, B, P, white){
      WH = !!white;
      const a = S.pel, b = S.sh, dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, fx = -uy, fy = ux;   // u = up the torso, f = forward
      const pt = (s, w) => [a.x + ux * L * s + fx * w, a.y + uy * L * s + fy * w];                                                           // s = 0 (waist) .. 1 (shoulders), w = + forward / - back
      const tt = Date.now() / 1000, br = Math.sin(tt * 1.6) * .35;
      if(!S._ff){ armArmor(cx, S.aF, false, tt, 0); pauldron(cx, S.aF.s, .92, false, tt); }
      poly(cx, [pt(-.04, -7.2), pt(.5, -9.4), pt(1.04, -8.8), pt(1.02, 9.6 + br), pt(.45, 9 + br), pt(-.04, 7.4)], lg(cx, a.x, a.y, b.x, b.y, [[0, '#0e1b33'], [1, Z.navy]]), Z.ink, 1);   // navy cloth base
      poly(cx, [pt(1, -8.2), pt(1.04, 9.2 + br), pt(.72, 10.4 + br), pt(.46, 8.6), pt(.46, -8.2)], lg(cx, a.x, a.y, b.x, b.y, [[0, Z.silverLo], [.55, Z.silver], [1, Z.ice]]), Z.ink, 1.1);   // chestplate
      poly(cx, [pt(.44, -8.2), pt(.44, 8.6), pt(.29, 8.2), pt(.29, -8.2)], Z.steel, Z.ink, 1);                                                  // abdomen bands (dark steel)
      poly(cx, [pt(.26, -8), pt(.26, 8), pt(.12, 7.6), pt(.12, -7.6)], Z.steel, Z.ink, 1);
      poly(cx, [pt(.1, -7.4), pt(.1, 7.6), pt(-.03, 7.4), pt(-.03, -7.2)], '#1b2a3e', Z.ink, 1);                                                // belt
      poly(cx, [pt(1.04, -5.4), pt(1.12, 4.8), pt(.93, 5.2), pt(.9, -5.4)], lg(cx, a.x, a.y, b.x, b.y, [[0, Z.silver], [1, Z.plat]]), Z.ink, 1);   // gorget at the neck
      if(!WH){
        const g1 = pt(.16, 6.2), c1 = pt(.72, 2.4);
        poly(cx, [[g1[0], g1[1] - 2.2], [g1[0] + 1.9, g1[1]], [g1[0], g1[1] + 2.2], [g1[0] - 1.9, g1[1]]], Z.ice, Z.ink, .7);                    // belt gem
        poly(cx, [[c1[0], c1[1] - 2.2], [c1[0] + 1.6, c1[1]], [c1[0], c1[1] + 2.2], [c1[0] - 1.6, c1[1]]], Z.ice, Z.ink, .6);                     // chest gem
        line(cx, [pt(.96, 1), pt(.52, 1)], 'rgba(80,223,255,.55)', .5);                                                                         // engraved frost fern
        [[.84, 3.6], [.7, 4.4], [.58, 3.4]].forEach(([s0, w0]) => { line(cx, [pt(s0, 1), pt(s0 + .07, w0)], 'rgba(80,223,255,.5)', .45); line(cx, [pt(s0, 1), pt(s0 + .07, -w0 + 2)], 'rgba(80,223,255,.4)', .45); });
        line(cx, [pt(1.02, -7.6), pt(1.03, 8.8 + br)], 'rgba(255,255,255,.7)', .6);                                                              // top highlight
        for(let i = 0; i < 3; i++){ const r1 = pt(.36 - i * .0, -5 + i * 5); cx.fillStyle = Z.silver; cx.beginPath(); cx.arc(r1[0], r1[1], .7, 0, 7); cx.fill(); }   // rivets
        const cr = [[.92, 9.4, -.7, 8.5], [.62, 10.4, -.35, 6.5], [1, -7.6, -2.4, 7]];
        cr.forEach(([s0, w0, ca, l0], i) => { const q = pt(s0, w0); crystal(cx, q[0], q[1], l0, 1.9, ca, i % 2 ? Z.ice : Z.pale); });          // glacier ice growing over selected plates
      }
      WH = false;
    },

    // the flying ice (arena.js calls this; s = {x, y, r, vx, age, kind, cl}). kind 0/1 = shard, 2 = frost wave, 'sniper' = the Glacier Spear.
    shot(cx, s, t){
      WH = false;
      const d = s.vx > 0 ? 1 : -1, x = s.x, y = s.y;
      cx.save(); cx.translate(x, y); cx.scale(d, 1); cx.translate(-x, -y);   // draw everything as if flying right
      if(s.kind === 'sniper'){                                               // GLACIER SPEAR: oriented along the real flight line, long frost trail, jagged ice behind it, sparkles
        const a = Math.atan2(s.vy || 0, Math.abs(s.vx)), q = clamp((s.r - SPEAR_R0) / (SPEAR_R1 - SPEAR_R0), 0, 1), L = 22 + 34 * q, w = 3.4 + 4.8 * q;
        cx.translate(x, y); cx.rotate(a); cx.translate(-x, -y);
        const tl = 60 + 120 * q, g = cx.createLinearGradient(x, y, x - tl, y);
        g.addColorStop(0, 'rgba(165,217,242,.6)'); g.addColorStop(.5, 'rgba(165,217,242,.22)'); g.addColorStop(1, 'rgba(165,217,242,0)');
        cx.fillStyle = g; cx.beginPath(); cx.moveTo(x, y - w * 1.5); cx.lineTo(x - tl, y); cx.lineTo(x, y + w * 1.5); cx.closePath(); cx.fill();
        cx.fillStyle = 'rgba(39,75,120,.28)'; cx.beginPath(); cx.moveTo(x, y + w * .2); cx.lineTo(x - tl * .8, y + .5); cx.lineTo(x, y + w * 1.3); cx.closePath(); cx.fill();    // glacier-blue shadow under the trail
        const nt = q < .35 ? 4 : 7;                                                                                // jagged ice spreading along the flight path (rougher + shorter when under-charged)
        for(let i = 0; i < nt; i++){ const k = (s.age * 2.4 + i / nt) % 1, ux = x - L * .45 - k * tl * .8, sd = i % 2 ? 1 : -1;
          crystal(cx, ux, y + sd * w * .7, (w * (1.5 - k)) * (q < .35 ? .7 : 1), w * .25, sd * (-Math.PI / 2 + .35 * (1 - k)), 'rgba(190,232,255,' + (.9 * (1 - k)) + ')'); }
        cx.translate(x, y); spear(cx, L, w, q, t, false); cx.translate(-x, -y);
        for(let i = 0; i < 3 + Math.round(5 * q); i++){ const aa = s.age * (7 + q * 6) + i * 6.283 / 8; crystal(cx, x + Math.cos(aa) * L * .38, y + Math.sin(aa) * w * 1.7, 2.2 + q, .8, aa + 1.57, Z.ice); }   // orbiting fragments
        for(let i = 0; i < 8; i++){ const k = (s.age * 3 + i * .13) % 1; cx.fillStyle = 'rgba(241,248,255,' + (1 - k) + ')'; cx.fillRect(x - L * .5 - k * 70, y + Math.sin(i * 2.1 + s.age * 9) * w * 1.8, 2, 2); }
        cx.restore(); return;
      }
      if(s.kind === 2){                                                      // FROST WAVE: a fan of jagged crystals, white center, glacier-blue shadow, wide blue mist tail
        const r = s.r;
        const g = cx.createLinearGradient(x, y, x - r * 5, y);
        g.addColorStop(0, 'rgba(165,217,242,.55)'); g.addColorStop(1, 'rgba(165,217,242,0)');
        cx.fillStyle = g; cx.beginPath(); cx.moveTo(x, y - r * 1.1); cx.lineTo(x - r * 5, y); cx.lineTo(x, y + r * 1.1); cx.closePath(); cx.fill();
        cx.fillStyle = 'rgba(39,75,120,.3)'; cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x - r * 4, y + r * .3); cx.lineTo(x, y + r * .9); cx.closePath(); cx.fill();
        cx.shadowColor = '#9fe4ff'; cx.shadowBlur = 12;
        crystal(cx, x - r * .6, y, r * 2.2, r * .5, -.5, 'rgba(190,232,255,.95)');
        crystal(cx, x - r * .6, y, r * 2.2, r * .5, .5, 'rgba(190,232,255,.95)');
        crystal(cx, x - r * .8, y, r * 2.7, r * .6, 0, 'rgba(241,248,255,.98)');
        cx.shadowBlur = 0;
        for(let i = 0; i < 6; i++){ const a = s.age * 6 + i * 1.05; cx.fillStyle = 'rgba(241,248,255,.85)'; cx.beginPath(); cx.arc(x - r * .3 + Math.cos(a) * r * 1.1, y + Math.sin(a) * r * 1.2, 1.5, 0, 7); cx.fill(); }
        cx.restore(); return;
      }
      const r = s.r;                                                         // ICE SHARD: thin crystalline point with a short frost tail
      const g = cx.createLinearGradient(x, y, x - 46, y);
      g.addColorStop(0, 'rgba(165,217,242,.6)'); g.addColorStop(1, 'rgba(165,217,242,0)');
      cx.fillStyle = g; cx.beginPath(); cx.moveTo(x, y - r * .8); cx.lineTo(x - 46, y); cx.lineTo(x, y + r * .8); cx.closePath(); cx.fill();
      cx.shadowColor = '#9fe4ff'; cx.shadowBlur = 9;
      poly(cx, [[x - 9, y], [x - 3, y - r * .75], [x + 15, y], [x - 3, y + r * .75]], 'rgba(221,245,255,.97)', '#ffffff', 1);
      cx.shadowBlur = 0;
      poly(cx, [[x - 6, y], [x - 1, y + r * .3], [x + 10, y], [x - 3, y + r * .75]], 'rgba(39,75,120,.4)');
      poly(cx, [[x - 6, y], [x - 1, y - r * .3], [x + 10, y]], 'rgba(255,255,255,.9)');
      cx.restore();
    }
  });
})();