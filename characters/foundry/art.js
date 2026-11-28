// FOUNDRY art - "The Molten Core". APPEARANCE ONLY (no skills, no gameplay). Same shared ragdoll (body.js): only sizes, colors, poses and drawn parts.
// LOOK: a silent industrial forge colossus. Forged iron + volcanic rock + industrial steel. He IS the furnace, but ONLY in two places:
//   HEAD  = forged blacksmith mask on an enclosed furnace head (one glowing eye slit, sparks + smoke vents, a small chimney)
//   CHEST = open forge chamber with flowing molten metal and an ANVIL-SHAPED molten heart (the heart pulses)
//   ARMS  = solid metal (NO furnace): heavy plates, gunmetal joints + pistons, big gauntlets, individually articulated fingers, only faint orange seam cracks
//   LEGS  = short, very thick, knee plates, huge armored boots     BACK = two functional exhaust chimneys + pipes + jagged volcanic rock
//   TURBO  = rocket thruster on the back of the hammer head, fires during the slam (TURBO setting)
//   HAMMER = enormous rectangular blacksmith hammer (asymmetrical head, rock reinforcements, magma cracks, vents) in his near hand
// Size: SIZE = .85 scales everything you see (1 = the first big version). The hitbox is still 30x52, arena.js is not changed per character.
// Hooks used: body (sizes), colors, pose() = heavy stance, attack() + spring() = the slow HEAVY SMASH (basic attack): lift the hammer behind his back, hold, slam, drag it back,
//   foot() = leg armor + boots, behind() = chimneys + rock + back plates + embers, torso() = far arm + forge chest, front() = near arm + hammer + fist + pauldron + head.
(() => {
  // ---------- SETTINGS (easy to tweak) ----------
  const SMOKE = 1;            // smoke amount (0 = none, 1 = default, 2 = a lot)
  const SPARKS = 1;           // sparks amount (0 = none, 1 = default, 2 = a lot)
  const REST = 3.4;          // hammer angle at rest: 3.14 = straight up, bigger = leans back over the shoulder
  const HL = 36;              // hammer handle length (px, hand -> head)
  const TURBO = true;         // rocket turbo on the BACK of the hammer head: fires during the slam to power the smash
  const QUAKE = false;        // earthquake look on impact (ground shock ring + floor cracks). false = removed (dust + sparks only)
  const SIZE = .85;           // OVERALL SIZE of everything you see: 1 = the first big version, .85 = a little smaller, .7 = much smaller

  // ---------- PALETTE: black / gunmetal / dark red / molten orange (orange is the brightest, body stays dark) ----------
  const IRON = '#26282e', IRON_L = '#3d4048', IRON_D = '#1a1b20', BLACK = '#121317';
  const GUN = '#646b77', GUN_D = '#3c414b', GUN_L = '#8b93a0';
  const ROCK = '#33262a', ROCK_R = '#6b2a22', ROCK_D = '#47170f';
  const ORG = '#ff7a1a', ORG_HOT = '#ffb04a', YEL = '#ffe3a6', OUT = '#08090c';

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const rnd = i => { const x = Math.sin(i * 127.1 + 7.3) * 43758.5; return x - Math.floor(x); };
  const NOWT = {t:0, h:.8, trail:0};         // behind() always runs first, so torso() / foot() (no time argument) read time + heat from here
  const K = (p, k) => Body.keys(p, k);

  // ---------- SMALL DRAWING HELPERS ----------
  function poly(cx, pts, fill, out){
    cx.beginPath(); pts.forEach((p, i) => i ? cx.lineTo(p.x, p.y) : cx.moveTo(p.x, p.y)); cx.closePath();
    if(fill){ cx.fillStyle = fill; cx.fill(); }
    if(out){ cx.strokeStyle = OUT; cx.lineWidth = out; cx.lineJoin = 'round'; cx.stroke(); }
  }
  const lp = (a, b, k) => ({x:a.x + (b.x - a.x) * k, y:a.y + (b.y - a.y) * k});
  const P2 = (a, d, n, along, side) => ({x:a.x + d.x * along + n.x * side, y:a.y + d.y * along + n.y * side});
  function frame(a, b){ const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, d = {x:dx / L, y:dy / L}; return {d, n:{x:-d.y, y:d.x}, L}; }
  function slab(cx, a, b, h0, h1, fill, out){ const {n} = frame(a, b);
    poly(cx, [{x:a.x + n.x * h0, y:a.y + n.y * h0}, {x:b.x + n.x * h1, y:b.y + n.y * h1}, {x:b.x - n.x * h1, y:b.y - n.y * h1}, {x:a.x - n.x * h0, y:a.y - n.y * h0}], fill, out); }
  function glow(cx, x, y, r, rgb, a){ const g = cx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(' + rgb + ',' + a + ')'); g.addColorStop(1, 'rgba(' + rgb + ',0)'); cx.fillStyle = g; cx.beginPath(); cx.arc(x, y, r, 0, 7); cx.fill(); }
  function rivet(cx, x, y, r, W){ cx.fillStyle = OUT; cx.beginPath(); cx.arc(x, y, r + .6, 0, 7); cx.fill(); cx.fillStyle = W ? '#fff' : GUN; cx.beginPath(); cx.arc(x, y, r, 0, 7); cx.fill();
    if(!W){ cx.fillStyle = GUN_L; cx.beginPath(); cx.arc(x - r * .3, y - r * .3, r * .35, 0, 7); cx.fill(); } }
  function crack(cx, pts, a, W){                      // glowing orange seam crack (polyline of {x,y})
    if(W || a < .03) return;
    cx.lineCap = 'round'; cx.lineJoin = 'round';
    cx.strokeStyle = 'rgba(255,110,20,' + (a * .55) + ')'; cx.lineWidth = 2.2; cx.beginPath(); pts.forEach((p, i) => i ? cx.lineTo(p.x, p.y) : cx.moveTo(p.x, p.y)); cx.stroke();
    cx.strokeStyle = 'rgba(255,190,90,' + a + ')'; cx.lineWidth = .8; cx.beginPath(); pts.forEach((p, i) => i ? cx.lineTo(p.x, p.y) : cx.moveTo(p.x, p.y)); cx.stroke();
  }
  function rock(cx, x, y, s, seed, W, cr){            // jagged volcanic rock chunk (dark red + charcoal), optional magma crack
    const pts = []; for(let i = 0; i < 9; i++){ const a = i / 9 * 6.283 + rnd(seed) * .6, r = s * (.6 + .55 * rnd(seed + i * 3.1)); pts.push({x:x + Math.cos(a) * r, y:y + Math.sin(a) * r * .85}); }
    poly(cx, pts, W ? '#fff' : (seed % 2 ? ROCK_R : ROCK), OUT, 1.5);
    if(!W){
      cx.strokeStyle = 'rgba(0,0,0,.45)'; cx.lineWidth = .9; cx.beginPath(); cx.moveTo(x, y); cx.lineTo(pts[2].x, pts[2].y); cx.moveTo(x, y); cx.lineTo(pts[6].x, pts[6].y); cx.stroke();
      cx.fillStyle = 'rgba(255,170,120,.16)'; cx.beginPath(); cx.moveTo(pts[7].x, pts[7].y); cx.lineTo(pts[8].x, pts[8].y); cx.lineTo(x, y); cx.closePath(); cx.fill();
      if(cr) crack(cx, [pts[1], {x:x + s * .1, y:y + s * .1}, pts[5]], cr * NOWT.h, W);
    }
  }
  function smoke(cx, x, y, t, seed, n, rise, spread, size){                  // dark smoke puffs rising
    if(SMOKE <= 0) return;
    for(let i = 0; i < n; i++){
      const k = ((t * .33 + rnd(seed + i * 3.1)) % 1), px = x + Math.sin(seed * 3 + i * 2 + t * .8) * spread * k - NOWT.trail * k * 6, py = y - k * rise;
      cx.fillStyle = 'rgba(58,54,56,' + ((1 - k) * .42 * Math.min(1, SMOKE)) + ')'; cx.beginPath(); cx.arc(px, py, size * (.5 + k * 1.1), 0, 7); cx.fill();
    }
  }
  function sparks(cx, x, y, t, seed, n, r){                                   // little orange sparks flying up then falling
    if(SPARKS <= 0) return;
    for(let i = 0; i < n * Math.min(2, SPARKS); i++){
      const k = ((t * .8 + rnd(seed + i * 1.7)) % 1), a = 1 - k, px = x + (rnd(seed + i * 5.3) - .5) * r * 2 * k - NOWT.trail * k * 4, py = y - k * (7 + rnd(seed + i * 7.1) * r) + k * k * 11;
      cx.fillStyle = 'rgba(255,' + Math.round(150 + 90 * rnd(seed + i)) + ',50,' + a + ')'; cx.fillRect(px, py, 1.3, 1.3);
    }
  }
  const tfx = (cx, n, sd, o) => cx.transform(n.x, n.y, sd.x, sd.y, o.x, o.y);   // local frame: x along n, y along sd

  // ---------- TORSO FRAME (used by behind() and torso()) ----------
  function tframe(S){
    const {pel, sh} = S, dx = sh.x - pel.x, dy = sh.y - pel.y, L = Math.hypot(dx, dy) || 1, u = {x:dx / L, y:dy / L}, fw = {x:-u.y, y:u.x};
    return {pel, sh, L, u, fw, ang:Math.atan2(u.x, -u.y), at:(k, o) => ({x:pel.x + u.x * L * k + fw.x * (o || 0), y:pel.y + u.y * L * k + fw.y * (o || 0)})};
  }

  // ---------- CHIMNEY (functional exhaust stack) ----------
  function chimney(cx, base, ang, h, w, t, W, seed){
    cx.save(); cx.translate(base.x, base.y); cx.rotate(ang);
    const c = x => W ? '#fff' : x;
    poly(cx, [{x:-w / 2, y:2}, {x:w / 2, y:2}, {x:w / 2 + 1.4, y:-h}, {x:-w / 2 - 1.4, y:-h}], c(IRON), OUT, 1.8);
    if(!W){
      cx.fillStyle = 'rgba(255,255,255,.07)'; cx.fillRect(-w / 2 + 1, -h + 2, 1.6, h - 4);
      [.22, .52, .8].forEach((k, i) => { cx.fillStyle = GUN_D; cx.fillRect(-w / 2 - 1.6, -h * k - 1.2, w + 3.2, 2.6); cx.strokeStyle = OUT; cx.lineWidth = .8; cx.strokeRect(-w / 2 - 1.6, -h * k - 1.2, w + 3.2, 2.6); rivet(cx, -w / 2 + .2, -h * k, .7, W); rivet(cx, w / 2 - .2, -h * k, .7, W); });
      cx.strokeStyle = 'rgba(0,0,0,.5)'; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(w * .15, -h + 1); cx.lineTo(w * .2, -h * .62); cx.moveTo(-w * .2, -h + 1); cx.lineTo(-w * .12, -h * .7); cx.stroke();   // soot streaks
      crack(cx, [{x:-w * .3, y:-h * .36}, {x:w * .1, y:-h * .4}, {x:w * .3, y:-h * .34}], .6 * NOWT.h, W);
    }
    cx.fillStyle = c(GUN); cx.fillRect(-w / 2 - 2.6, -h - 3, w + 5.2, 3.4); cx.strokeStyle = OUT; cx.lineWidth = 1.2; cx.strokeRect(-w / 2 - 2.6, -h - 3, w + 5.2, 3.4);   // rim
    if(!W){ cx.fillStyle = '#2a0f08'; cx.fillRect(-w / 2 - 1.2, -h - 2.6, w + 2.4, 1.6); cx.fillStyle = 'rgba(255,150,50,' + (.5 + .4 * NOWT.h) + ')'; cx.fillRect(-w / 2 - .4, -h - 2.4, w + .8, 1); }
    cx.restore();
    return {x:base.x + Math.sin(ang) * (h + 3), y:base.y - Math.cos(ang) * (h + 3)};
  }

  // ---------- ARMS: solid metal, NO furnace ----------
  function armGear(cx, A, far, W, t){                                 // plates on the upper arm + gauntlet on the forearm
    const c = x => W ? '#fff' : (far ? mixDark(x) : x), s = A.s, el = A.el, hd = A.hand, ua = frame(s, el), fa = frame(el, hd);
    const hh = NOWT.h;
    slab(cx, s, el, 8.2, 7.6, c(IRON), 2);                                           // upper arm armor
    if(!W){
      slab(cx, lp(s, el, .08), lp(s, el, .5), 8.6, 8.2, c(IRON_L), 1.5);              // layered plate
      cx.strokeStyle = 'rgba(160,170,185,.22)'; cx.lineWidth = 1; cx.beginPath(); const e1 = P2(s, ua.d, ua.n, 3, -6.5), e2 = P2(el, ua.d, ua.n, -4, -6.2); cx.moveTo(e1.x, e1.y); cx.lineTo(e2.x, e2.y); cx.stroke();
      crack(cx, [lp(s, el, .52), P2(lp(s, el, .52), ua.d, ua.n, 0, 4), P2(lp(s, el, .52), ua.d, ua.n, 0, 8)], .32 * hh, W);
      crack(cx, [lp(s, el, .5), P2(lp(s, el, .5), ua.d, ua.n, 0, -4), P2(lp(s, el, .5), ua.d, ua.n, 0, -8)], .32 * hh, W);
      const pr = P2(lp(s, el, .3), ua.d, ua.n, 0, -9.6), pr2 = P2(lp(s, el, .78), ua.d, ua.n, 0, -9.6);                // piston along the arm
      Body.capsule(cx, pr, pr2, 3.6, OUT); Body.capsule(cx, pr, lp(pr, pr2, .55), 2.4, GUN_D); Body.capsule(cx, lp(pr, pr2, .45), pr2, 1.5, GUN_L);
      rivet(cx, P2(s, ua.d, ua.n, 8, 5).x, P2(s, ua.d, ua.n, 8, 5).y, 1, W); rivet(cx, P2(s, ua.d, ua.n, 8, -5).x, P2(s, ua.d, ua.n, 8, -5).y, 1, W);
    }
    cx.fillStyle = OUT; cx.beginPath(); cx.arc(el.x, el.y, 7.8, 0, 7); cx.fill();                                      // gunmetal elbow joint
    cx.fillStyle = W ? '#fff' : GUN_D; cx.beginPath(); cx.arc(el.x, el.y, 6.4, 0, 7); cx.fill();
    if(!W){ cx.strokeStyle = GUN_L; cx.lineWidth = 1; cx.beginPath(); cx.arc(el.x, el.y, 4.4, .4, 2.6); cx.stroke(); rivet(cx, el.x, el.y, 1.8, W); }
    slab(cx, lp(el, hd, .08), lp(el, hd, .98), 9.2, 8.8, c(IRON), 2);                                                  // forearm gauntlet
    if(!W){
      slab(cx, lp(el, hd, .1), lp(el, hd, .42), 9.4, 9.2, c(IRON_L), 1.4);
      [.46, .72].forEach(k => { const a = P2(lp(el, hd, k), fa.d, fa.n, 0, 9.4), b = P2(lp(el, hd, k), fa.d, fa.n, 0, -9.4); cx.strokeStyle = OUT; cx.lineWidth = 3.4; cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); cx.stroke(); cx.strokeStyle = GUN_D; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); cx.stroke();
        crack(cx, [P2(lp(el, hd, k + .035), fa.d, fa.n, 0, 8.6), P2(lp(el, hd, k + .035), fa.d, fa.n, 0, 2), P2(lp(el, hd, k + .035), fa.d, fa.n, 0, -8.6)], .3 * hh, W); });
      slab(cx, lp(el, hd, .74), lp(el, hd, .98), 10.2, 10.6, c(GUN_D), 1.8);                                              // reinforced knuckle guard
      const rv = [[.8, 8.2], [.8, -8.2], [.92, 8.6], [.92, -8.6]]; rv.forEach(q => { const p = P2(lp(el, hd, q[0]), fa.d, fa.n, 0, q[1]); rivet(cx, p.x, p.y, .9, W); });
      const tp = lp(el, hd, .27); cx.save(); cx.translate(tp.x, tp.y); cx.rotate(Math.atan2(fa.d.y, fa.d.x)); cx.fillStyle = 'rgba(190,198,210,.5)'; cx.font = '3.4px monospace'; cx.textAlign = 'center'; cx.fillText('F-07', 0, 1.2); cx.restore();   // identification number
    }
  }
  const mixDark = x => ({'#26282e':'#1b1c21', '#3d4048':'#2a2c32', '#3c414b':'#2c3038'}[x] || x);

  function fist(cx, hd, dir, W, shaft){                               // big metal hand with individually articulated fingers
    const d = dir, n = {x:-d.y, y:d.x}, c = x => W ? '#fff' : x;
    poly(cx, [P2(hd, d, n, -6, 6.4), P2(hd, d, n, 6, 7.4), P2(hd, d, n, 6, -7.4), P2(hd, d, n, -6, -6.4)], c(IRON), 2.2);            // palm block
    if(!W) poly(cx, [P2(hd, d, n, 1, 6.4), P2(hd, d, n, 6, 7.4), P2(hd, d, n, 6, -7.4), P2(hd, d, n, 1, -6.4)], GUN_D, 1.4);
    if(shaft){                                                        // gripping the handle: 4 fingers wrap across it
      const sd = shaft, sn = {x:-sd.y, y:sd.x};
      for(let i = 0; i < 4; i++){ const off = (i - 1.5) * 3.7, b = {x:hd.x + sd.x * off, y:hd.y + sd.y * off}, a0 = P2(b, sd, sn, 0, -5.4), a1 = P2(b, sd, sn, 0, 5.6);
        Body.capsule(cx, a0, a1, 4.4, OUT); Body.capsule(cx, a0, a1, 3, c(i % 2 ? IRON_L : IRON)); if(!W) rivet(cx, a1.x, a1.y, .8, W); }
      const th0 = P2(hd, sd, sn, -4.5, -5.5), th1 = P2(hd, sd, sn, 4, -7.2); Body.capsule(cx, th0, th1, 5, OUT); Body.capsule(cx, th0, th1, 3.6, c(GUN_D));   // thumb
    } else {                                                          // relaxed open hand: thick fingers, two joints each
      for(let i = 0; i < 4; i++){ const ofs = (i - 1.5) * 3.7, b = P2(hd, d, n, 5.5, ofs), m = P2(b, d, n, 4.6, ofs * .04), e = P2(m, d, n, 3.8, 1.6 + i * .3);
        Body.capsule(cx, b, m, 4.4, OUT); Body.capsule(cx, m, e, 4.0, OUT); Body.capsule(cx, b, m, 3, c(IRON_L)); Body.capsule(cx, m, e, 2.7, c(GUN_D)); }
      const t0 = P2(hd, d, n, 0, 6.8), t1 = P2(hd, d, n, 5.5, 8.6); Body.capsule(cx, t0, t1, 5, OUT); Body.capsule(cx, t0, t1, 3.6, c(GUN_D));
    }
  }

  function pauldron(cx, s, W, seed, far){                             // massive shoulder armor + volcanic rock
    const c = x => W ? '#fff' : (far ? mixDark(x) : x);
    cx.beginPath(); cx.ellipse(s.x + 1, s.y - 3.5, 13, 10, 0, 0, 7); cx.fillStyle = c(IRON); cx.fill(); cx.strokeStyle = OUT; cx.lineWidth = 2.2; cx.stroke();
    if(!W){
      cx.strokeStyle = IRON_L; cx.lineWidth = 2.2; cx.beginPath(); cx.arc(s.x + 1, s.y - 3.5, 7.6, 3.4, 5.9); cx.stroke();
      cx.strokeStyle = OUT; cx.lineWidth = 1.2; cx.beginPath(); cx.moveTo(s.x - 11, s.y + 1.5); cx.quadraticCurveTo(s.x + 1, s.y + 6.5, s.x + 13, s.y + 1.5); cx.stroke();
      crack(cx, [{x:s.x - 10, y:s.y + 2.2}, {x:s.x - 3, y:s.y + 5.6}, {x:s.x + 5, y:s.y + 5.6}, {x:s.x + 12, y:s.y + 2.4}], .38 * NOWT.h, W);
      rivet(cx, s.x - 7, s.y - 8, 1, W); rivet(cx, s.x + 9, s.y - 8, 1, W);
    }
    rock(cx, s.x + 2, s.y - 11, 7, seed, W, .5); rock(cx, s.x - 7, s.y - 8, 4.5, seed + 4, W, 0); if(!far) rock(cx, s.x + 10, s.y - 8, 4, seed + 9, W, 0);
  }

  // ---------- TURBO: a rocket thruster on the BACK of the hammer head (the end opposite the striking face). Local frame: +x = striking face, -x = back. ----------
  function turboPod(cx, y0, y1, fire, t, W){
    const yc = (y0 + y1) / 2, c = x => W ? '#fff' : x, hh = NOWT.h;
    if(!W && fire > .04){                                                       // the flame, behind the pod
      const fl = .88 + .12 * Math.sin(t * 70) + .07 * Math.sin(t * 113), L = (7 + 36 * fire) * fl, w = 5.4 + 2.6 * fire;
      cx.save(); cx.globalCompositeOperation = 'lighter'; glow(cx, -38, yc, 24 + 10 * fire, '255,140,40', .5 * fire); cx.restore();
      const g = cx.createLinearGradient(-33, 0, -33 - L, 0); g.addColorStop(0, 'rgba(255,250,225,1)'); g.addColorStop(.25, 'rgba(255,205,95,.95)'); g.addColorStop(.7, 'rgba(255,110,25,.7)'); g.addColorStop(1, 'rgba(255,80,10,0)');
      cx.fillStyle = g; cx.beginPath(); cx.moveTo(-32, yc - w); cx.quadraticCurveTo(-33 - L * .5, yc - w * .85 + Math.sin(t * 50) * 1.3, -33 - L, yc + Math.sin(t * 37) * 1.6);
      cx.quadraticCurveTo(-33 - L * .5, yc + w * .85 + Math.sin(t * 43) * 1.2, -32, yc + w); cx.closePath(); cx.fill();
      cx.fillStyle = 'rgba(255,255,240,.9)'; cx.beginPath(); cx.moveTo(-32, yc - w * .42); cx.lineTo(-33 - L * .45, yc); cx.lineTo(-32, yc + w * .42); cx.closePath(); cx.fill();       // white-hot core
      for(let i = 0; i < 3; i++){ cx.fillStyle = 'rgba(255,235,180,' + (.55 - i * .12) + ')'; cx.beginPath(); cx.ellipse(-33 - L * (.2 + i * .19), yc, 2.4 - i * .4, 3.2 - i * .6, 0, 0, 7); cx.fill(); }   // shock diamonds
    }
    // pod: gunmetal housing bolted to the back plate + nozzle bell
    poly(cx, [{x:-20.5, y:yc - 6.5}, {x:-28, y:yc - 7}, {x:-28, y:yc + 7}, {x:-20.5, y:yc + 6.5}], c(GUN_D), 2);
    poly(cx, [{x:-28, y:yc - 4.2}, {x:-34, y:yc - 8}, {x:-34, y:yc + 8}, {x:-28, y:yc + 4.2}], c(GUN), 2);
    if(!W){
      cx.fillStyle = OUT; cx.beginPath(); cx.ellipse(-34, yc, 2.2, 6.6, 0, 0, 7); cx.fill();                             // nozzle opening
      cx.fillStyle = 'rgba(255,' + Math.round(110 + 110 * fire) + ',40,' + (.35 + .6 * fire + .1 * hh) + ')'; cx.beginPath(); cx.ellipse(-34, yc, 1.6, 5.4, 0, 0, 7); cx.fill();   // pilot glow, white-hot when firing
      for(let i = 0; i < 3; i++){ cx.fillStyle = i % 2 ? ORG : BLACK; cx.fillRect(-26.6 + i * 2.2, yc - 6.5, 1.4, 3.4); cx.fillRect(-26.6 + i * 2.2, yc + 3.1, 1.4, 3.4); }   // warning stripes
      cx.strokeStyle = OUT; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(-24, yc - 6.5); cx.lineTo(-24, yc + 6.5); cx.stroke();
      rivet(cx, -22.2, yc - 4.6, .8, W); rivet(cx, -22.2, yc + 4.6, .8, W); rivet(cx, -31.5, yc - 5.6, .8, W); rivet(cx, -31.5, yc + 5.6, .8, W);
      crack(cx, [{x:-21.5, y:yc - 2}, {x:-24, y:yc}, {x:-22, y:yc + 3}], (.35 + .6 * fire) * hh, W);
    }
  }

  // ---------- HAMMER ----------
  function hammer(cx, hd, th, t, W, fire){
    const sd = {x:Math.sin(th), y:Math.cos(th)}, n = {x:Math.cos(th), y:-Math.sin(th)}, c = x => W ? '#fff' : x, hh = NOWT.h;
    cx.save(); cx.transform(-n.x, -n.y, sd.x, sd.y, hd.x, hd.y);   // local frame: y = along the handle (0 = hand), x = across (mirrored: the heavy striking face is the end that hits the ground)
    // handle: thick dark iron with reinforced grip sections
    cx.fillStyle = OUT; cx.fillRect(-4.6, -11, 9.2, HL + 14); cx.fillStyle = c(IRON); cx.fillRect(-3.2, -10, 6.4, HL + 12);
    if(!W){
      cx.fillStyle = IRON_L; cx.fillRect(-3.2, -10, 1.6, HL + 12);
      [[-7, 7], [11, 16], [HL - 7, HL - 2]].forEach(r => { cx.fillStyle = OUT; cx.fillRect(-5.2, r[0] - .8, 10.4, r[1] - r[0] + 1.6); cx.fillStyle = GUN_D; cx.fillRect(-4.4, r[0], 8.8, r[1] - r[0]); rivet(cx, -2.6, r[0] + 1.6, .7, W); rivet(cx, 2.6, r[1] - 1.6, .7, W); });
      cx.fillStyle = OUT; cx.beginPath(); cx.arc(0, -11, 5.2, 0, 7); cx.fill(); cx.fillStyle = GUN; cx.beginPath(); cx.arc(0, -11, 3.9, 0, 7); cx.fill(); rivet(cx, 0, -11, 1.3, W);   // pommel
    }
    // head: extremely wide, tall, thick, rectangular - asymmetrical (heavy striking block on one end, tapered peen on the other)
    const y0 = HL - 2, y1 = HL + 21;
    poly(cx, [{x:-19.5, y:y0 + 4}, {x:-15, y:y0 - .5}, {x:12, y:y0 - 1}, {x:21, y:y0 - 3}, {x:22.5, y:y1 + 2}, {x:12, y:y1 + 1.5}, {x:-14, y:y1}, {x:-20.5, y:y1 - 5}], c(IRON), 2.6);
    if(!W){
      poly(cx, [{x:13, y:y0 - 1.5}, {x:22, y:y0 - 3.5}, {x:24, y:y1 + 3}, {x:13, y:y1 + 2}], GUN, 2);                       // striking face block (gunmetal)
      poly(cx, [{x:-21, y:y0 + 5}, {x:-16.5, y:y0 + 1}, {x:-16.5, y:y1 - 1}, {x:-21.5, y:y1 - 5}], GUN_D, 2);              // peen end plate
      cx.fillStyle = 'rgba(255,255,255,.08)'; cx.fillRect(-14, y0 + .5, 26, 2.4);
      cx.fillStyle = IRON_L; cx.fillRect(-14, y0 + 3, 26, 1.6);
      rock(cx, -5, y0 + 12.5, 7.5, 3, W, .7); rock(cx, 6.5, y1 - 5.5, 5, 8, W, 0);                                        // volcanic stone reinforcements
      crack(cx, [{x:-12, y:y0 + 4}, {x:-9, y:y0 + 9}, {x:-12, y:y0 + 14}, {x:-8, y:y1 - 1}], .85 * hh, W);                  // magma cracks across the head
      crack(cx, [{x:3, y:y0 + 1}, {x:1, y:y0 + 7}, {x:5, y:y0 + 11}, {x:3, y:y1}], .8 * hh, W);
      crack(cx, [{x:12.5, y:y0 + 5}, {x:8, y:y0 + 9}, {x:10, y:y0 + 15}], .6 * hh, W);
      [[-17, y0 + 3], [-17, y1 - 3], [17, y0 + 2], [17, y1 + 1], [0, y0 + 20]].forEach(q => rivet(cx, q[0], q[1], 1.1, W));
      cx.fillStyle = 'rgba(0,0,0,.6)'; for(let i = 0; i < 3; i++) cx.fillRect(-10 + i * 3.2, y1 - 3.6, 1.8, 2.8);              // heat vents
      cx.fillStyle = 'rgba(255,140,40,' + (.35 + .45 * hh) + ')'; for(let i = 0; i < 3; i++) cx.fillRect(-10 + i * 3.2, y1 - 3.2, 1.8, 2);
      cx.strokeStyle = 'rgba(190,198,210,.45)'; cx.lineWidth = .8; cx.beginPath(); cx.moveTo(5, y1 - 7); cx.lineTo(10, y1 - 7); cx.lineTo(10, y1 - 3); cx.lineTo(5, y1 - 3); cx.moveTo(7.5, y1 - 7); cx.lineTo(7.5, y1 - 3); cx.stroke();     // forge glyph
      cx.save(); cx.scale(-1, 1); cx.fillStyle = 'rgba(190,198,210,.4)'; cx.font = '3.4px monospace'; cx.textAlign = 'center'; cx.fillText('H-01', 0, y0 + 1.8); cx.restore();
      glow(cx, 0, y0 + 10, 34, '255,120,30', .12 * hh);
    }
    if(TURBO) turboPod(cx, y0, y1, fire || 0, t, W);
    cx.restore();
    if(TURBO && !W && fire > .1){                                     // sparks + smoke trailing out of the nozzle (world frame)
      const E = {x:hd.x + sd.x * (HL + 9.5) + n.x * 34, y:hd.y + sd.y * (HL + 9.5) + n.y * 34};
      sparks(cx, E.x, E.y, t, 71, 5, 10); smoke(cx, E.x, E.y, t, 73, 4, 16, 6, 2.4);
    }
    // sparks + smoke leaking from the hammer vents (world frame)
    if(!W){ const v = {x:hd.x + sd.x * (HL + 17) + n.x * -6, y:hd.y + sd.y * (HL + 17) + n.y * -6}; smoke(cx, v.x, v.y, t, 41, 3, 14, 4, 2.2); sparks(cx, v.x, v.y, t, 43, 2, 6); }
  }

  // hammer angle: rests on the shoulder; during the attack it is driven by the swing progress p and EASED, so it feels heavy (slow lift, snap slam)
  function hamAngle(f, t){
    const dt = clamp(t - (f._ft === undefined ? t : f._ft), 0, .05); f._ft = t;
    let target = REST + Math.sin(t * 1.5) * .02, rate = 8, p = -1;
    if(f.atk > 0 && !(f.stun > 0)){
      p = clamp(1 - f.atk / (f.A ? f.A.time : 1.4), 0, 1);
      target = K(p, [[0, REST], [.14, 3.95], [.3, 4.7], [.42, 5.05], [.6, 5.05], [.7, 1.06], [.78, 1.02], [.84, 1.06], [1, REST]]);   // up and BACK behind him, hold, then over the top and down
      if(p > .42 && p < .6) target += Math.sin(t * 38) * .012 * (p > .5 ? 1.7 : 1);                                                      // the weight trembles at the top
      rate = p < .6 ? 6.5 : (p < .8 ? 40 : 5);
    }
    f._th = f._th === undefined ? target : f._th + (target - f._th) * (1 - Math.exp(-dt * rate));
    return {th:f._th, p};
  }
  // far hand also grips the handle (2-bone arm solve), so he holds the hammer with both hands
  function farArm(S, th){
    const s = S.aF.s, nh = S.aN.hand, sd = {x:Math.sin(th), y:Math.cos(th)}, l1 = 14, l2 = 15, reach = l1 + l2 - .6;
    const u = clamp((s.x - nh.x) * sd.x + (s.y - nh.y) * sd.y, 12, HL - 6);
    let T = {x:nh.x + sd.x * u, y:nh.y + sd.y * u}; const dd = Math.hypot(T.x - s.x, T.y - s.y) || 1;
    if(dd > reach) T = {x:s.x + (T.x - s.x) * reach / dd, y:s.y + (T.y - s.y) * reach / dd};
    const d = Math.max(.01, Math.hypot(T.x - s.x, T.y - s.y)), ux = (T.x - s.x) / d, uy = (T.y - s.y) / d, a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    const e1 = {x:s.x + ux * a - uy * h, y:s.y + uy * a + ux * h}, e2 = {x:s.x + ux * a + uy * h, y:s.y + uy * a - ux * h};
    return {s, el:(e1.y > e2.y ? e1 : e2), hand:T, sd};
  }
  // the hammer smashes the ground: dust, sparks, shock ring and magma cracks along the floor (ip = 0..1 since the impact)
  function impactFx(cx, x, ip, t){
    const a = 1 - ip;
    cx.save();
    if(ip < .3){ cx.globalCompositeOperation = 'lighter'; glow(cx, x, -4, 40, '255,130,30', .55 * (1 - ip / .3)); cx.globalCompositeOperation = 'source-over'; }
    for(let i = 0; i < 10; i++){ const dir = i % 2 ? 1 : -1, r = rnd(i + 90), px = x + dir * (6 + ip * (22 + i * 5 + r * 14)), py = -2 - ip * (4 + r * 8);
      cx.fillStyle = 'rgba(92,78,72,' + (a * .42) + ')'; cx.beginPath(); cx.arc(px, py, 3 + ip * (4 + r * 3), 0, 7); cx.fill(); }
    for(let i = 0; i < 16; i++){ const ang = .3 + rnd(i + 5) * 2.54, sp = .5 + rnd(i + 17) * .7, px = x + Math.cos(ang) * ip * 46 * sp, py = -Math.sin(ang) * ip * 36 * sp + ip * ip * 24;
      cx.fillStyle = 'rgba(255,' + Math.round(140 + 100 * rnd(i)) + ',50,' + a + ')'; cx.fillRect(px, py, 1.6, 1.6); }
    if(QUAKE){ cx.strokeStyle = 'rgba(255,140,40,' + (a * .75) + ')'; cx.lineWidth = 1.4; cx.beginPath(); cx.ellipse(x, -1, 8 + ip * 50, 1.5 + ip * 7, 0, 0, 7); cx.stroke();
    for(let i = 0; i < 4; i++){ const dir = i % 2 ? 1 : -1, len = (14 + i * 9) * Math.min(1, ip * 3), pts = [];
      for(let j = 0; j <= 5; j++) pts.push({x:x + dir * len * j / 5, y:-.4 + Math.sin(j * 2.1 + i * 3) * 1.4 * (j / 5)});
      crack(cx, pts, Math.min(1, a * 1.6), false); } }
    cx.restore();
  }

  // ---------- THE ART ----------
  const ART = {
    // colossal + bulky: about 1.5x a normal fighter. Short, very thick legs, huge torso, massive arms + hands, small head sunk into the shoulders.
    // The ragdoll below is the ORIGINAL size and invisible (widths .01, transparent). Every visible part is drawn by the hooks and scaled by SIZE (see the end of this file).
    body: {head:{r:8}, torso:{len:24, w:27}, uArm:{len:14, w:.01}, fArm:{len:15, w:.01}, hand:{r:.01},
           thigh:{len:10, w:.01}, shin:{len:9.5, w:.01}, foot:{len:15, w:8}, headSink:1, shN:9, shF:-10, outline:'rgba(0,0,0,0)', outlineW:0, noRings:true, belt:.1},
    colors: {shirt:'rgba(0,0,0,0)', limb:'rgba(0,0,0,0)', far:'rgba(0,0,0,0)', head:'rgba(0,0,0,0)', dark:'rgba(0,0,0,0)', hand:'rgba(0,0,0,0)', legs:'rgba(0,0,0,0)', legsFar:'rgba(0,0,0,0)'},
    farFront: () => false,

    // slow, heavy stance: hunched forward, hammer arm carries the hammer up on the shoulder, far arm swings only a little, short stride
    pose(tg, f, t, run){
      const b = Math.sin(t * 1.5);
      tg.lean = .06 + b * .012 + run * .06; tg.head = -.06;
      tg.aN = .95 + b * .02 - run * .06; tg.eN = .6 - run * .05;
      tg.aF = tg.aF * .4 + .08 * .6; tg.eF = tg.eF * .5 + .55 * .5;
      tg.tN *= .75; tg.tF *= .75; tg.kN *= .8; tg.kF *= .8;
    },
    // HEAVY SMASH (basic attack, time 1.4 s, see skills.js). p = 0..1:
    //   0 - .42  he crouches, leans back and LIFTS the hammer up and behind his back (slow, the weight drags)
    //   .42 - .6 he holds it back there, trembling, dead serious
    //   .6 - .7  SLAM: over the top and down, fast
    //   .7 - .82 the hammer sits in the floor (shock + dust)      .82 - 1  slow drag back up onto the shoulder
    attack(tg, p, A, k){
      tg.aN = k(p, [[0,.95], [.12,1.6], [.42,2.95], [.6,2.95], [.68,1.9], [.74,1.15], [.82,1.15], [1,.95]]);
      tg.eN = k(p, [[0,.6], [.42,.9], [.6,.9], [.7,.4], [.82,.35], [1,.6]]);
      tg.lean = k(p, [[0,.06], [.42,-.34], [.6,-.38], [.7,.52], [.82,.5], [1,.06]]); tg.head = -tg.lean * .3;
      tg.aF = k(p, [[0,.1], [.4,.8], [.6,.8], [.74,.5], [1,.1]]); tg.eF = k(p, [[0,.5], [.4,.8], [1,.5]]);
      tg.tN = k(p, [[0,.12], [.35,.45], [.58,.5], [.68,.62], [.82,.5], [1,.12]]);     // legs: wide, bent stance (a deep crouch to carry the weight)
      tg.kN = k(p, [[0,.25], [.35,.9], [.58,.95], [.68,1.2], [.82,.95], [1,.25]]);
      tg.tF = k(p, [[0,-.12], [.35,-.38], [.58,-.4], [.68,-.5], [.82,-.4], [1,-.12]]);
      tg.kF = k(p, [[0,.2], [.35,.2], [.58,.15], [.68,.12], [.82,.15], [1,.2]]);
    },
    // joint springs: soft + slow while lifting (heavy), very stiff for the slam (snap), soft again for the recovery
    spring(p, A){
      if(p < .58) return {k:55, d:13};
      if(p < .8) return {k:560, d:38};
      return {k:80, d:15};
    },

    // legs: thigh plate, shin guard, knee plate, volcanic rock, and the huge armored boot (called right after each leg is drawn)
    foot(cx, leg, P, white, f, far){
      const W = !!white, hh = NOWT.h, c = x => W ? '#fff' : (far ? mixDark(x) : x);
      slab(cx, leg.hip, leg.knee, 8.4, 8, c(IRON), 2);
      slab(cx, leg.knee, leg.ankle, 7.4, 6.8, c(IRON), 2);
      if(!W){
        slab(cx, lp(leg.hip, leg.knee, .05), lp(leg.hip, leg.knee, .5), 8.8, 8.6, c(IRON_L), 1.4);
        const fr = frame(leg.hip, leg.knee), sr = frame(leg.knee, leg.ankle);
        crack(cx, [P2(lp(leg.hip, leg.knee, .56), fr.d, fr.n, 0, 7.8), P2(lp(leg.hip, leg.knee, .56), fr.d, fr.n, 0, 0), P2(lp(leg.hip, leg.knee, .56), fr.d, fr.n, 0, -7.8)], .3 * hh, W);
        crack(cx, [P2(lp(leg.knee, leg.ankle, .5), sr.d, sr.n, 0, 6.4), P2(lp(leg.knee, leg.ankle, .5), sr.d, sr.n, 0, -6.4)], .26 * hh, W);
        if(!far){ const rp = P2(lp(leg.hip, leg.knee, .28), fr.d, fr.n, 0, -5.6); rock(cx, rp.x, rp.y, 4.6, 14, W, .5); }
      }
      const kn = leg.knee;                                                       // reinforced knee plate
      cx.fillStyle = OUT; cx.beginPath(); cx.arc(kn.x + 1, kn.y, 8.6, 0, 7); cx.fill(); cx.fillStyle = W ? '#fff' : (far ? '#2c3038' : GUN_D); cx.beginPath(); cx.arc(kn.x + 1, kn.y, 7.2, 0, 7); cx.fill();
      if(!W){ cx.strokeStyle = GUN_L; cx.lineWidth = 1; cx.beginPath(); cx.arc(kn.x + 1, kn.y, 5.4, 3.5, 5.4); cx.stroke(); rivet(cx, kn.x + 1, kn.y, 1.8, W); rivet(cx, kn.x + 5, kn.y - 3, .9, W); rivet(cx, kn.x - 3, kn.y + 4, .9, W); }
      const an = leg.ankle, phi = leg.planted ? 0 : clamp(-leg.sa * .5, -.8, .8);   // boot
      cx.save(); cx.translate(an.x, an.y); cx.rotate(phi);
      const b = 4;                                                                   // ground is b px below the ankle
      poly(cx, [{x:-9, y:-9}, {x:8.5, y:-9}, {x:9.5, y:-2}, {x:14, y:1}, {x:20, y:2.5}, {x:20, y:b}, {x:-10, y:b}, {x:-10.5, y:-3}], c(IRON), 2.2);
      if(!W){
        poly(cx, [{x:-9.5, y:-10}, {x:9, y:-10}, {x:9, y:-5.5}, {x:-9.5, y:-5.5}], far ? '#2c3038' : GUN_D, 1.6);                  // ankle cuff
        poly(cx, [{x:8, y:-3}, {x:14, y:.5}, {x:20, y:2}, {x:20, y:b - 1}, {x:7, y:b - 1}], IRON_L, 1.6);                          // toe cap
        cx.fillStyle = OUT; cx.fillRect(-11, b - 3, 32, 3.4); cx.fillStyle = far ? '#444a55' : GUN; cx.fillRect(-10.2, b - 2.4, 30.4, 2.2);   // steel sole plate
        rivet(cx, -6, -8, .9, W); rivet(cx, 5, -8, .9, W); rivet(cx, 13, .5, .9, W); rivet(cx, -6, b - 5, .9, W);
        crack(cx, [{x:-2, y:-3}, {x:3, y:-1}, {x:6, y:b - 4}], .3 * hh, W);
      }
      cx.restore();
    },

    // everything behind him: heat glow, jagged rock, back plates, exhaust pipes, TWO functional chimneys with smoke + sparks
    behind(cx, f, t, S, P){
      NOWT.t = t; NOWT.h = .78 + .14 * Math.sin(t * 2.3) + (f.atk > 0 ? .12 : 0); NOWT.trail = clamp((f.vx || 0) * (f.face || 1) * .02, -3, 3);
      const HA = hamAngle(f, t); NOWT.th = HA.th; NOWT.p = HA.p;
      const W = f.flash > 0, T = tframe(S), at = T.at;
      if(!W){ cx.save(); cx.globalCompositeOperation = 'lighter'; glow(cx, at(.55, 0).x, at(.55, 0).y, 46, '255,110,20', .1 * NOWT.h); cx.restore(); }
      // back armor plates (peek out behind the torso) + jagged volcanic formations around the shoulders / upper back
      poly(cx, [at(-.02, -12), at(1.02, -22), at(1.08, -15), at(.0, -8)], W ? '#fff' : IRON_D, OUT, 2);
      poly(cx, [at(.3, -13.5), at(.98, -20), at(.99, -17), at(.32, -10)], W ? '#fff' : IRON, OUT, 1.5);
      if(!W) crack(cx, [at(.12, -12), at(.5, -17), at(.9, -21)], .4 * NOWT.h, W);
      rock(cx, at(1.03, -19).x, at(1.03, -19).y, 9, 2, W, .5); rock(cx, at(.76, -19).x, at(.76, -19).y, 7, 7, W, 0); rock(cx, at(1.18, -11).x, at(1.18, -11).y, 6, 12, W, .4); rock(cx, at(.5, -17).x, at(.5, -17).y, 5, 5, W, 0);
      // exhaust pipes from the chest furnace up to the chimneys
      [[-15, .72], [-9, .9]].forEach((q, i) => {
        const a = at(.28, q[0] + 5), b = at(q[1], q[0]);
        Body.capsule(cx, a, b, 6.4, OUT); Body.capsule(cx, a, b, 4.4, W ? '#fff' : GUN_D); if(!W){ Body.capsule(cx, a, b, 1.2, 'rgba(255,255,255,.12)'); rivet(cx, lp(a, b, .4).x, lp(a, b, .4).y, .9, W); }
      });
      // two industrial chimneys
      const c1 = chimney(cx, at(.9, -15), T.ang - .12, 36, 8, t, W, 1), c2 = chimney(cx, at(.66, -17), T.ang - .24, 28, 6.8, t, W, 2);
      if(!W){ smoke(cx, c1.x, c1.y - 2, t, 11, 6, 30, 8, 3.4); smoke(cx, c2.x, c2.y - 2, t, 23, 5, 26, 7, 3); sparks(cx, c1.x, c1.y, t, 31, 3, 7); sparks(cx, c2.x, c2.y, t, 37, 2, 6); }
    },

    // far arm (behind the body) + the forge chest. Replaces the default torso.
    torso(cx, S, B, P, white){
      const W = !!white, t = NOWT.t, hh = NOWT.h, T = tframe(S), at = T.at, c = x => W ? '#fff' : x;
      const FA = farArm(S, NOWT.th); armGear(cx, FA, true, W, t); fist(cx, FA.hand, frame(FA.el, FA.hand).d, W, FA.sd); pauldron(cx, S.aF.s, W, 20, true);
      // torso body: extremely broad shoulders, thick chest, narrower waist
      poly(cx, [at(-.04, -11.5), at(-.04, 11.5), at(.55, 14.5), at(1.08, 17.5), at(1.12, 7), at(1.12, -7), at(1.08, -17.5), at(.55, -14.5)], c(IRON), 2.4);
      if(W) return;
      poly(cx, [at(-.02, -10.5), at(-.02, 10.5), at(.17, 12), at(.17, -12)], GUN_D, 1.6);                                 // belly plate
      poly(cx, [at(.06, -9), at(.06, 9), at(.15, 10), at(.15, -10)], IRON_L, 1.2);
      for(let i = 0; i < 4; i++){ const a = at(.025, -8 + i * 5.4), b = at(.075, -6.2 + i * 5.4), cc = at(.075, -8 + i * 5.4); poly(cx, [a, at(.025, -5.8 + i * 5.4), at(.075, -5.8 + i * 5.4), cc], i % 2 ? ORG : BLACK, 0); }   // hazard stripes
      cx.save(); cx.globalAlpha = .55; cx.restore();
      // chest: open forge chamber framed by thick forged iron
      poly(cx, [at(.17, -13), at(.17, 13), at(.82, 15), at(.82, -15)], IRON_L, 2.2);                              // outer frame plate
      poly(cx, [at(.21, -11.4), at(.21, 11.4), at(.78, 13), at(.78, -13)], IRON_D, 1.8);                                  // bezel
      const o1 = at(.27, -9.4), o2 = at(.27, 9.4), o3 = at(.73, 10.8), o4 = at(.73, -10.8);                                    // opening
      poly(cx, [o1, o2, o3, o4], '#2a0d07', 1.8);
      // molten metal flowing inside (clipped to the opening)
      cx.save(); cx.beginPath(); [o1, o2, o3, o4].forEach((p, i) => i ? cx.lineTo(p.x, p.y) : cx.moveTo(p.x, p.y)); cx.closePath(); cx.clip();
      const gr = cx.createLinearGradient(at(.27, 0).x, at(.27, 0).y, at(.73, 0).x, at(.73, 0).y); gr.addColorStop(0, '#d9480a'); gr.addColorStop(.5, '#a62a08'); gr.addColorStop(1, '#4a1308');
      cx.fillStyle = gr; cx.fillRect(o1.x - 30, o1.y - 60, 80, 90);
      for(let i = 0; i < 5; i++){ cx.strokeStyle = i % 2 ? 'rgba(255,190,90,.85)' : 'rgba(255,120,30,.9)'; cx.lineWidth = 1.5 - i * .1; cx.lineCap = 'round'; cx.beginPath();
        for(let j = 0; j <= 10; j++){ const o = -10 + j * 2, k = .31 + i * .085 + Math.sin(j * .9 + t * 2 + i * 1.3) * .016, p = at(k, o); j ? cx.lineTo(p.x, p.y) : cx.moveTo(p.x, p.y); } cx.stroke(); }     // flowing molten ripples
      for(let i = 0; i < 4; i++){ const o = -7.5 + i * 5, k0 = .7 - ((t * .25 + i * .27) % 1) * .38, p = at(k0, o), q = at(k0 - .06, o); cx.strokeStyle = 'rgba(255,220,140,.7)'; cx.lineWidth = 1.2; cx.beginPath(); cx.moveTo(p.x, p.y); cx.lineTo(q.x, q.y); cx.stroke(); }   // molten drips running down
      const hc = at(.5, 0); glow(cx, hc.x, hc.y, 15, '255,190,80', .55 * hh);
      cx.restore();
      // THE MOLTEN HEART: an anvil-shaped heart, suspended by two steel braces, pulsing
      const pul = 1 + .07 * Math.sin(t * 2.3 * 1.4) + (hh - .78) * .1;
      [[at(.72, 0), at(.58, 0)], [at(.28, 0), at(.42, 0)]].forEach(q => { Body.capsule(cx, q[0], q[1], 3.2, OUT); Body.capsule(cx, q[0], q[1], 1.8, GUN); });
      cx.save(); cx.translate(hc.x, hc.y); cx.rotate(T.ang); cx.scale(pul, pul);
      glow(cx, 0, 0, 16, '255,160,40', .7);
      const hp = [[-6,-4], [4,-4], [8.4,-3.2], [4.4,-1.2], [2.6,-.2], [2.6,2.4], [5.4,4.8], [-5.4,4.8], [-2.6,2.4], [-2.6,-.2], [-6.4,-1.6]].map(a => ({x:a[0], y:a[1]}));
      poly(cx, hp, null, 2.6); const hg = cx.createLinearGradient(0, -4, 0, 5); hg.addColorStop(0, YEL); hg.addColorStop(.5, ORG_HOT); hg.addColorStop(1, ORG); poly(cx, hp, hg, 0);
      cx.strokeStyle = 'rgba(255,255,230,.85)'; cx.lineWidth = .9; cx.beginPath(); cx.moveTo(-5, -3.1); cx.lineTo(3.4, -3.1); cx.stroke();
      cx.strokeStyle = 'rgba(160,50,10,.7)'; cx.lineWidth = .7; cx.beginPath(); cx.moveTo(-1, -2.5); cx.lineTo(.6, .4); cx.lineTo(-.6, 3.5); cx.stroke();
      cx.restore();
      // bezel details: rivets, vents with warning markings, smoke escaping
      [at(.23, -10.4), at(.23, 10.4), at(.76, -12), at(.76, 12), at(.5, -12.2), at(.5, 12.2)].forEach(p => rivet(cx, p.x, p.y, 1.2, W));
      for(let i = 0; i < 3; i++){ [-1, 1].forEach(sd => { const a = at(.3 + i * .14, sd * 12.6), b = at(.35 + i * .14, sd * 12.6); cx.strokeStyle = OUT; cx.lineWidth = 3.2; cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); cx.stroke(); cx.strokeStyle = 'rgba(255,130,30,' + (.4 + .5 * hh) + ')'; cx.lineWidth = 1.5; cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); cx.stroke(); }); }
      [at(.8, -5.5), at(.8, 5.5)].forEach((p, i) => { poly(cx, [{x:p.x - 3, y:p.y + .8}, {x:p.x + 3, y:p.y + .8}, {x:p.x + 3, y:p.y - 1.6}, {x:p.x - 3, y:p.y - 1.6}], i ? ORG : BLACK, 1); });   // warning markings
      crack(cx, [at(.2, -13.6), at(.5, -14.4), at(.78, -15)], .34 * hh, W); crack(cx, [at(.2, 13.6), at(.5, 14.4), at(.78, 15)], .34 * hh, W);
      cx.save(); cx.translate(at(.095, -5).x, at(.095, -5).y); cx.rotate(T.ang); cx.fillStyle = 'rgba(190,198,210,.45)'; cx.font = '3.4px monospace'; cx.textAlign = 'center'; cx.fillText('FRG-07', 0, 1.2); cx.restore();      // ID number
      cx.strokeStyle = 'rgba(255,150,60,.4)'; cx.lineWidth = .8; const g0 = at(.13, 5.5); cx.beginPath(); cx.moveTo(g0.x - 3, g0.y); cx.lineTo(g0.x + 3, g0.y); cx.moveTo(g0.x - 1.5, g0.y); cx.lineTo(g0.x - 1.5, g0.y + 2.4); cx.moveTo(g0.x + 1.5, g0.y); cx.lineTo(g0.x + 1.5, g0.y + 2.4); cx.stroke();   // ancient forge symbol
      cx.save(); cx.globalCompositeOperation = 'lighter'; glow(cx, hc.x, hc.y, 30, '255,110,20', .2 * hh); cx.restore();   // orange light reflecting on the nearby armor
      smoke(cx, at(.8, 5.5).x, at(.8, 5.5).y - 1, t, 51, 3, 12, 3, 1.8);
    },

    // near arm + gauntlet + hammer + fist, pauldron, the head (forgemaster mask on an enclosed furnace chimney head)
    front(cx, f, t, S, P){
      const W = f.flash > 0, hh = NOWT.h, A = S.aN, fa = frame(A.el, A.hand);
      armGear(cx, A, false, W, t);
      const th = NOWT.th, ap = NOWT.p;
      const fire = ap < 0 ? 0 : (ap < .44 ? 0 : ap < .62 ? .1 + .25 * (ap - .44) / .18 : ap < .74 ? 1 : ap < .86 ? 1 - (ap - .74) / .12 : 0);   // spools up while he holds it back, full blast on the slam, dies after the hit
      hammer(cx, A.hand, th, t, W, fire);
      if(!W && ap > .69){                                                // the smash: effects where the hammer face meets the floor
        const nn = {x:Math.cos(th), y:-Math.sin(th)}, hc = {x:A.hand.x + Math.sin(th) * (HL + 9.5), y:A.hand.y + Math.cos(th) * (HL + 9.5)};
        impactFx(cx, hc.x - nn.x * 23, clamp((ap - .69) / .3, 0, 1), t);
      }
      fist(cx, A.hand, fa.d, W, {x:Math.sin(th), y:Math.cos(th)});
      pauldron(cx, A.s, W, 30, false);
      // ---- head ----
      const ha = Math.atan2(S.head.x - S.sh.x, -(S.head.y - S.sh.y)), c = x => W ? '#fff' : x;
      cx.save(); cx.translate(S.head.x, S.head.y); cx.rotate(ha);
      // enclosed furnace chimney: top + rear of the head
      const ch = chimney(cx, {x:-5.5, y:-7}, -.18, 15, 7, t, W, 5);
      poly(cx, [{x:11, y:-5}, {x:11.5, y:5}, {x:7, y:10}, {x:-8, y:10.5}, {x:-12.5, y:3}, {x:-12, y:-6}, {x:-8, y:-11}, {x:7, y:-10.5}], c(IRON), 2.4);   // helmet block
      if(!W){
        poly(cx, [{x:-12, y:-6}, {x:-8, y:-11}, {x:-1, y:-11}, {x:-3, y:6}, {x:-12.5, y:3}], IRON_D, 1.5);                      // enclosed furnace shell (rear)
        for(let i = 0; i < 3; i++){ cx.fillStyle = OUT; cx.fillRect(-11 + i * 3, -5, 1.8, 7); cx.fillStyle = 'rgba(255,130,30,' + (.5 + .45 * hh) + ')'; cx.fillRect(-10.7 + i * 3, -4.5, 1.2, 6); }   // fire glowing through rear vents
        poly(cx, [{x:-3, y:-11}, {x:7, y:-10.5}, {x:11, y:-5}, {x:11.2, y:-3}, {x:-3, y:-3}], IRON_L, 1.6);                      // forged brow / forehead plate
        poly(cx, [{x:-2, y:-3.2}, {x:11.3, y:-3.2}, {x:11.4, y:2.6}, {x:-2, y:2.6}], BLACK, 1.6);                                // dark eye band
        cx.fillStyle = '#ffd08a'; cx.fillRect(1.6, -1.4, 9.6, 1.6); cx.fillStyle = ORG; cx.fillRect(1.6, -.4, 9.6, .8);          // glowing eye slit (the ONLY face feature)
        cx.save(); cx.globalCompositeOperation = 'lighter'; glow(cx, 7, -.6, 11, '255,130,30', .75 * hh); cx.restore();
        poly(cx, [{x:-2, y:2.6}, {x:11.4, y:2.6}, {x:11.5, y:5}, {x:7, y:10}, {x:-3, y:10.4}], GUN_D, 1.6);                      // lower mask plate: no mouth, no nose
        for(let i = 0; i < 3; i++){ cx.fillStyle = OUT; cx.fillRect(2 + i * 2.8, 4.6, 1.2, 3.6); }
        rivet(cx, -.5, -8.2, .9, W); rivet(cx, 8, -8.2, .9, W); rivet(cx, 9.2, 8.2, .9, W); rivet(cx, -1, 8.4, .9, W);
        crack(cx, [{x:-1, y:-10}, {x:1.5, y:-6}, {x:.5, y:-3.4}], .5 * hh, W);
      }
      cx.restore();
      if(!W){ const ct = (() => { const cs = Math.sin(ha), cc = Math.cos(ha), rx = (x, y) => S.head.x + x * cc - y * cs, ry = (x, y) => S.head.y + x * cs + y * cc; return {x:rx(ch.x, ch.y), y:ry(ch.x, ch.y)}; })();
        smoke(cx, ct.x, ct.y - 2, t, 61, 4, 20, 6, 2.6); sparks(cx, ct.x, ct.y, t, 67, 2, 6); }
    }
  };
  // scale every drawing hook by SIZE around the feet (the skeleton stays the original size, so the feet stay on the ground)
  const sc = fn => function(cx, ...a){ cx.save(); cx.scale(SIZE, SIZE); try { return fn.apply(this, [cx, ...a]); } finally { cx.restore(); } };
  ['foot', 'behind', 'torso', 'front'].forEach(h => { ART[h] = sc(ART[h]); });
  Characters.art('foundry', ART);
})();