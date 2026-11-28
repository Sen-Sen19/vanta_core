// DRUDESSE art - "The Ancient Guardian". APPEARANCE ONLY (no skills, no gameplay). Same shared ragdoll (body.js): only sizes, colors, stance and drawn parts.
// LOOK: gentle forest goddess. Medium height, slender, warm golden skin, bare legs + bare feet, human ears, long silky green hair fading to gold at the tips
//   (small leaves / vines / tiny flowers woven in), natural floral crown + thin gold circlet with a small emerald, deep-green off-shoulder gown with ivory + muted gold accents,
//   translucent flowing sleeves, vine waist belt with an emerald, asymmetric skirt (short in front, long petal-and-leaf train behind), open back with a leaf-petal mantle,
//   a living Forest Blossom floating above one shoulder, and a soft emerald-gold particle aura (leaves, petals, pollen, faint runes).
// FLOATING: she HOVERS (LIFT px above the ground) and never walks. The ragdoll legs are long + invisible (they only set how high the waist floats, same trick as nethros);
//   her real bare legs are drawn by dangleLegs() in behind(): relaxed, toes pointed down, they sway and trail behind when she glides.
// Hooks used: body (sizes), colors, pose() = floating stance, attack() = default punch arms (no leg steps), foot() = hidden, behind() = aura + train + mantle + hair, torso() = off-shoulder bodice + vine belt,
//   front() = skirt + arm + sleeves + face + hair cap + crown + circlet + Forest Blossom.
// Poses for attacks / springs are NOT changed (default punch poses) because she has no skills yet.
(() => {
  // ---------- SETTINGS (easy to tweak) ----------
  const AURA_ON = true;       // soft particles + runes around her
  const AURA_N  = 16;         // how many particles (more = busier)
  const HAIR_LEN = 1;         // 1 = default, 1.3 = longer hair, 0.8 = shorter
  const BLOSSOM_X = -15, BLOSSOM_Y = -9;   // Forest Blossom spot relative to her shoulder (x: + forward, - behind; y: - up)
  const HR = 7.2;             // head radius (must match body.head.r below)
  const LIFT = 8;             // FLOAT HEIGHT: px her feet hang above the ground (0 = standing height). Bigger = higher. Her visible height grows by the same amount.
  const BOB  = 1.3;           // up-down bobbing while she floats (0 = none)
  const LEG = 23.3 + LIFT, TH = LEG * .52, SHN = LEG - TH, HOVER = LEG - 2;   // hidden ragdoll legs: they only decide how high the waist floats

  // ---------- PALETTE ----------
  const GREEN = '#174B35', GREEN_D = '#0e3022', GREEN_L = '#2d7a53', IVORY = '#F5F0DF', GOLD = '#B99B59', GOLD_L = '#e2c880';
  const EMER = '#2fd58a', EMER_D = '#1a8a5a', SKIN = '#f0c598', SKIN_D = '#d6a572', SKIN_L = '#ffe2c2', BLUSH = 'rgba(232,130,120,.35)';
  const HAIR_A = '#1d6a43', HAIR_B = '#2f9158', HAIR_C = '#dcbd6a', OUT = '#0b0f1c', OW = 1.3;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const legK = (th, Y) => { const a = Math.acos(clamp((Y - TH * Math.cos(th)) / SHN, -1, 1)); const k = th - a; return k > .05 ? k : th + a; };
  const holdLegs = (tg, Y) => { tg.tN = .04; tg.tF = -.04; Y = Math.min(Y, .985 * (TH + SHN)); tg.kN = legK(tg.tN, Y); tg.kF = legK(tg.tF, Y); };   // legs stay still, waist hangs at height Y
  const rnd = i => { const x = Math.sin(i * 127.1 + 7.3) * 43758.5; return x - Math.floor(x); };
  const hexRGB = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const mixc = (a, b, k) => { const A = hexRGB(a), B = hexRGB(b); return 'rgb(' + A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(',') + ')'; };
  const NOWT = {t: 0};        // behind() always runs first, so torso() / foot() (no time argument) can read the time from here

  // ---------- SMALL DRAWING HELPERS ----------
  function leaf(cx, bx, by, tx, ty, w, fill, out){        // pointed leaf / petal from base b to tip t, w = half width
    const mx = (bx + tx) / 2, my = (by + ty) / 2, dx = tx - bx, dy = ty - by, L = Math.hypot(dx, dy) || 1, nx = -dy / L * w, ny = dx / L * w;
    cx.beginPath(); cx.moveTo(bx, by); cx.quadraticCurveTo(mx + nx, my + ny, tx, ty); cx.quadraticCurveTo(mx - nx, my - ny, bx, by); cx.closePath();
    cx.fillStyle = fill; cx.fill();
    if(out){ cx.strokeStyle = OUT; cx.lineWidth = out; cx.lineJoin = 'round'; cx.stroke(); }
  }
  function flower(cx, x, y, r, petal, center){            // tiny 5-petal flower
    cx.fillStyle = petal;
    for(let i = 0; i < 5; i++){ const a = i * 1.2566 + .3; cx.beginPath(); cx.arc(x + Math.cos(a) * r * .7, y + Math.sin(a) * r * .7, r * .55, 0, 7); cx.fill(); }
    cx.fillStyle = center; cx.beginPath(); cx.arc(x, y, r * .45, 0, 7); cx.fill();
  }
  function gem(cx, x, y, r, W){                           // small emerald with a gold setting
    cx.fillStyle = W ? '#fff' : GOLD; cx.beginPath(); cx.arc(x, y, r + .8, 0, 7); cx.fill();
    cx.fillStyle = W ? '#fff' : EMER; cx.beginPath(); cx.moveTo(x, y - r); cx.lineTo(x + r * .8, y); cx.lineTo(x, y + r); cx.lineTo(x - r * .8, y); cx.closePath(); cx.fill();
    cx.fillStyle = 'rgba(255,255,255,.75)'; cx.fillRect(x - r * .15, y - r * .55, r * .3, r * .35);
  }
  function glow(cx, x, y, r, col, a){
    const g = cx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col.replace('A', a)); g.addColorStop(1, col.replace('A', 0));
    cx.fillStyle = g; cx.beginPath(); cx.arc(x, y, r, 0, 7); cx.fill();
  }
  const qpt = (p0, c, p1, k) => ({x:(1 - k) * (1 - k) * p0.x + 2 * (1 - k) * k * c.x + k * k * p1.x, y:(1 - k) * (1 - k) * p0.y + 2 * (1 - k) * k * c.y + k * k * p1.y});

  // how she is moving right now (used by the skirt, hair and mantle so they trail behind and lift when falling)
  function motion(f, t){
    const sp = clamp((f.vx || 0) * (f.face || 1) / 170, -1, 1);          // forward speed -1..1 (+ = running forward)
    const lift = f.gr ? 0 : clamp((f.vy || 0) / 600, -1, 1) * 4;         // falling lifts the cloth, rising lets it drop
    return {sp, lift, sw:Math.sin(t * 1.7), sw2:Math.sin(t * 1.1 + 1.3)};
  }

  // ---------- BEHIND THE BODY: aura, train, mantle, hair ----------
  function aura(cx, t, S, W){
    const bx = S.pel.x, by = S.pel.y - 4;
    glow(cx, bx, by, 38, 'rgba(60,220,140,A)', .16); glow(cx, bx, by - 4, 24, 'rgba(240,210,110,A)', .08);
    for(let i = 0; i < AURA_N; i++){
      const r1 = rnd(i + 1), r2 = rnd(i + 31), r3 = rnd(i + 57), per = 5 + r1 * 4;
      const k = ((t / per) + r2) % 1;                              // 0..1 life
      const x = bx + Math.sin(r3 * 40 + t * (.4 + r1 * .5)) * (13 + r2 * 12), y = by + 22 - k * (62 + r1 * 14);
      const a = Math.sin(k * Math.PI) * .85;
      const kind = i % 4;
      cx.globalAlpha = a;
      if(kind === 0){ cx.fillStyle = EMER; cx.beginPath(); cx.arc(x, y, .9 + r1 * .8, 0, 7); cx.fill(); }                 // emerald mote
      else if(kind === 1){ cx.fillStyle = GOLD_L; cx.beginPath(); cx.arc(x, y, .7 + r2 * .6, 0, 7); cx.fill(); }          // golden pollen
      else if(kind === 2){ const ang = t * 1.2 + i; leaf(cx, x, y, x + Math.cos(ang) * 3.4, y + Math.sin(ang) * 3.4, 1.1, HAIR_B, 0); }   // tiny drifting leaf
      else { const ang = t * .9 + i * 2; cx.save(); cx.translate(x, y); cx.rotate(ang); cx.fillStyle = IVORY; cx.beginPath(); cx.ellipse(0, 0, 2, 1.1, 0, 0, 7); cx.fill(); cx.restore(); }   // petal
    }
    // faint nature runes: three slots that fade in and out one after another
    cx.strokeStyle = EMER; cx.lineWidth = .9; cx.lineCap = 'round';
    for(let i = 0; i < 3; i++){
      const ph = (t * .22 + i / 3) % 1, a = Math.pow(Math.sin(ph * Math.PI), 3) * .6; if(a < .03) continue;
      const rx = bx + Math.cos(i * 2.1 + t * .15) * 24, ry = by - 4 + Math.sin(i * 2.1 + t * .15) * 10 - ph * 8, s = 3.2;
      cx.globalAlpha = a; cx.beginPath();
      if(i === 0){ cx.moveTo(rx, ry - s); cx.lineTo(rx, ry + s); cx.moveTo(rx, ry - s * .2); cx.lineTo(rx + s * .8, ry - s * .9); cx.moveTo(rx, ry + s * .4); cx.lineTo(rx - s * .8, ry - s * .2); }
      else if(i === 1){ cx.moveTo(rx - s * .7, ry - s); cx.lineTo(rx + s * .7, ry); cx.lineTo(rx - s * .7, ry + s); cx.moveTo(rx + s * .7, ry - s); cx.lineTo(rx + s * .7, ry + s); }
      else { cx.moveTo(rx, ry - s); cx.lineTo(rx - s * .8, ry + s * .6); cx.lineTo(rx + s * .8, ry + s * .6); cx.closePath(); cx.moveTo(rx, ry - s * .1); cx.lineTo(rx, ry + s); }
      cx.stroke();
    }
    cx.globalAlpha = 1;
  }

  function train(cx, t, S, M, W){        // long back of the dress: overlapping leaf + petal strands that trail behind her
    const px = S.pel.x, py = S.pel.y;
    const n = 7;
    for(let i = n - 1; i >= 0; i--){                                    // longest strands first (they sit at the back)
      const k = i / (n - 1);
      const tx = px - 4 - k * 4 - 10 * (1 - k * .35) - M.sp * (7 + 7 * (1 - k)) + Math.sin(t * 1.6 + i * .9) * 1.4;
      const ty = py + 14 + (1 - k) * 8 - M.lift * (1 - k * .5) + Math.sin(t * 1.3 + i) * .6;
      const bx = px - 2 - k * 3.5, by = py - 3 + k * 3;
      const col = i % 3 === 0 ? GREEN_L : (i % 3 === 1 ? GREEN : GREEN_D);
      leaf(cx, bx, by, Math.min(tx, bx - 3), Math.min(ty, -5), 4.4 - k * 1, W ? '#fff' : col, .6);
    }
    // ivory petal accents along the train
    for(let i = 0; i < 3; i++){
      const k = i / 2, bx = px - 3 - k * 2, by = py - 1;
      leaf(cx, bx, by, bx - 9 - k * 3 - M.sp * 6, Math.min(py + 12 + (1 - k) * 4 - M.lift, -5), 2.8, W ? '#fff' : IVORY, 0);
    }
  }

  function dangleLegs(cx, t, f, S, M, W){   // her real legs: bare, relaxed, floating. They trail behind when she glides and tuck up when she rises.
    const px = S.pel.x, py = S.pel.y, T2 = 10, S2 = 9.5, vy = f.vy || 0, rise = f.gr ? 0 : clamp(-vy / 400, 0, 1);
    [{far:true, ox:-1.2, th:-.17, ph:1.3}, {far:false, ox:.8, th:.11, ph:0}].forEach(L => {
      const th = L.th - M.sp * .55 + Math.sin(t * 1.5 + L.ph) * .05 + rise * .25;
      const kn = .24 + Math.abs(M.sp) * .3 + rise * .5 + Math.sin(t * 1.5 + L.ph + 1) * .05;
      const hip = {x:px + L.ox, y:py}, kneeP = {x:hip.x + Math.sin(th) * T2, y:hip.y + Math.cos(th) * T2}, sa = th - kn;
      const ank = {x:kneeP.x + Math.sin(sa) * S2, y:kneeP.y + Math.cos(sa) * S2}, toe = {x:ank.x + Math.sin(sa + .8) * 6, y:ank.y + Math.cos(sa + .8) * 6};
      const col = W ? '#fff' : (L.far ? SKIN_D : SKIN);
      const segs = [[hip, kneeP, 4.8], [kneeP, ank, 3.9], [{x:ank.x - 1, y:ank.y - .5}, toe, 3.1]];
      segs.forEach(g => Body.capsule(cx, g[0], g[1], g[2] + OW * 2, OUT));
      segs.forEach(g => Body.capsule(cx, g[0], g[1], g[2], col));
      if(!W){ cx.strokeStyle = 'rgba(120,70,40,.55)'; cx.lineWidth = .6; cx.lineCap = 'round';
        for(let i = 0; i < 2; i++){ const k = .55 + i * .15, x = ank.x + (toe.x - ank.x) * k, y = ank.y + (toe.y - ank.y) * k; cx.beginPath(); cx.moveTo(x + .3, y - .5); cx.lineTo(x + 1, y + .8); cx.stroke(); } }   // tiny toe lines
    });
  }

  function mantle(cx, t, S, M, W){       // botanical mantle starting at the shoulders, leaf + petal strands trailing behind
    const sh = S.sh;
    for(let i = 0; i < 5; i++){
      const k = i / 4, bx = sh.x - 2.5 - k * 1.2, by = sh.y + 1 + k * 2.5;
      const tx = bx - 9 - k * 5 - M.sp * 7 + Math.sin(t * 1.5 + i) * 1.3, ty = by + 11 + k * 6 - M.lift * .4 + Math.sin(t * 1.2 + i * 1.7) * .7;
      leaf(cx, bx, by, tx, ty, 3 - k * .5, W ? '#fff' : (i % 2 ? IVORY : GREEN_L), .6);
    }
  }

  function hair(cx, t, S, M, W){         // long silky hair, green at the roots -> gold at the tips, with leaves / vines / flowers woven in
    const hd = S.head, sh = S.sh, N = 9;
    const strands = [{w:6.6, o:0, len:1}, {w:5.6, o:1.2, len:.9}, {w:5.2, o:2.2, len:1.04}, {w:4.6, o:3.2, len:.82}, {w:4.2, o:4.2, len:.95},
                     {w:3.6, o:5, len:.7}, {w:3.2, o:.6, len:1.1}, {w:2.8, o:2.8, len:.62}, {w:2.6, o:4.6, len:.78}, {w:2.4, o:1.8, len:.55}];   // 10 layered strands = full, thick hair
    const built = strands.map((st, si) => {
      const p0 = {x:hd.x - 3.6 - st.o * .2, y:hd.y - 1.2 + st.o * .35};
      const L = 26 * HAIR_LEN * st.len;
      const p1 = {x:sh.x - 5 - st.o * 1.1 - M.sp * 13 * (.6 + st.len * .5) + Math.sin(t * 1.5 + si * 1.4) * 1.8,
                  y:sh.y + L - M.lift * .8 + Math.sin(t * 1.2 + si) * .8};
      const c = {x:p0.x - 8 - st.o * .6 - M.sp * 5, y:p0.y + 4 + (si % 2) * 2};
      const pts = []; for(let i = 0; i <= N; i++){ const q = qpt(p0, c, p1, i / N); q.x += Math.sin(i * .9 + si * 1.7 + t * 1.4) * 1.1 * (i / N); pts.push(q); }   // soft wave
      return {st, si, pts};
    });
    for(let pass = 0; pass < 2; pass++){
      built.forEach(({st, si, pts}) => {
        for(let i = 0; i < N; i++){
          const k = i / N, wd = st.w * (1 - k * .55);
          const col = k < .55 ? mixc(HAIR_A, HAIR_B, k / .55) : mixc(HAIR_B, HAIR_C, (k - .55) / .45);
          Body.capsule(cx, pts[i], pts[i + 1], pass ? wd : wd + OW * 2, pass ? (W ? '#fff' : col) : OUT);
        }
      });
    }
    if(!W){
      built.forEach(({st, si, pts}) => {
        if(si === 0 || si === 2 || si === 4){ cx.globalAlpha = .35; for(let i = 1; i < N - 2; i++) Body.capsule(cx, {x:pts[i].x + 1, y:pts[i].y}, {x:pts[i + 1].x + 1, y:pts[i + 1].y}, 1.1, '#bff0c8'); cx.globalAlpha = 1; }
        if(si < 5){
          const q = pts[2 + si]; leaf(cx, q.x, q.y, q.x - 3.4, q.y + 2.4, 1.1, '#3fae6a', .6);
          if(si === 0){ const q2 = pts[6]; flower(cx, q2.x + 1.5, q2.y, 1.7, IVORY, GOLD_L); leaf(cx, q2.x, q2.y, q2.x - 2.4, q2.y + 3.2, 1, '#3fae6a', .6); }
          if(si === 1 || si === 3){ const q3 = pts[5 + (si > 1 ? 1 : 0)]; flower(cx, q3.x, q3.y + .5, 1.5, IVORY, GOLD_L); }
        }
      });
    }
    if(!W){                                                            // a thin vine winding down the hair
      const a = {x:hd.x - 5, y:hd.y + 1}, b = {x:sh.x - 7 - M.sp * 9, y:sh.y + 17}, c = {x:a.x - 7 - M.sp * 3, y:a.y + 6};
      cx.strokeStyle = '#2f8a52'; cx.lineWidth = .9; cx.beginPath(); cx.moveTo(a.x, a.y);
      for(let i = 1; i <= 12; i++){ const p = qpt(a, c, b, i / 12); cx.lineTo(p.x + Math.sin(i * 1.3) * 1.4, p.y); } cx.stroke();
    }
  }

  // ---------- FRONT PARTS ----------
  function sleeve(cx, Arm, M, W, far){                 // translucent flowing sleeve with tiny flowers and a drifting cuff
    const s = Arm.s, el = Arm.el, hd = Arm.hand;
    const nrm = (a, b) => { const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1; return {x:-dy / L, y:dx / L}; };
    const n1 = nrm(s, el), n2 = nrm(el, hd), nm = {x:(n1.x + n2.x) / 2, y:(n1.y + n2.y) / 2};
    const h0 = 2.1, h1 = 2.6, h2 = 3.6;
    cx.beginPath();
    cx.moveTo(s.x + n1.x * h0, s.y + n1.y * h0); cx.lineTo(el.x + nm.x * h1, el.y + nm.y * h1); cx.lineTo(hd.x + n2.x * h2, hd.y + n2.y * h2);
    cx.lineTo(hd.x - n2.x * h2, hd.y - n2.y * h2); cx.lineTo(el.x - nm.x * h1, el.y - nm.y * h1); cx.lineTo(s.x - n1.x * h0, s.y - n1.y * h0); cx.closePath();
    cx.fillStyle = W ? '#fff' : (far ? 'rgba(14,48,34,.72)' : 'rgba(30,95,66,.68)'); cx.fill();
    cx.strokeStyle = W ? '#fff' : 'rgba(245,240,223,.55)'; cx.lineWidth = .7; cx.lineJoin = 'round'; cx.stroke();
    // drifting cuff: the sleeve end falls down and trails behind when she moves
    const tip = {x:hd.x - M.sp * 5, y:hd.y + 6.5 - M.lift * .5 + Math.sin(NOWT.t * 2 + (far ? 1 : 0)) * .7};
    cx.beginPath(); cx.moveTo(hd.x + n2.x * h2, hd.y + n2.y * h2); cx.quadraticCurveTo(hd.x + n2.x * h2 * .6 + (tip.x - hd.x) * .5, (hd.y + tip.y) / 2, tip.x, tip.y); cx.quadraticCurveTo(hd.x - n2.x * h2 * .6 + (tip.x - hd.x) * .5, (hd.y + tip.y) / 2, hd.x - n2.x * h2, hd.y - n2.y * h2); cx.closePath();
    cx.fillStyle = W ? '#fff' : 'rgba(30,95,66,.5)'; cx.fill(); cx.stroke();
    if(!W){ [.3, .62].forEach((k, i) => { const p = k < .5 ? {x:s.x + (el.x - s.x) * (k * 2), y:s.y + (el.y - s.y) * (k * 2)} : {x:el.x + (hd.x - el.x) * ((k - .5) * 2), y:el.y + (hd.y - el.y) * ((k - .5) * 2)};
      flower(cx, p.x + nm.x * (i ? -1.6 : 1.6), p.y + nm.y * (i ? -1.6 : 1.6), 1.1, IVORY, GOLD_L); }); }
  }

  function skirt(cx, t, S, M, W){                       // short in FRONT (legs + feet stay visible), longer at the back (the train is in behind())
    const px = S.pel.x, py = S.pel.y;
    const fx = px + 8.6 - M.sp * 3, fy = py + 8 - M.lift * .6, bx = px - 6.5 - M.sp * 5, by = py + 14 - M.lift;
    cx.beginPath(); cx.moveTo(px + 4.8, py - 3); cx.quadraticCurveTo(px + 8, py + 1, fx, fy);
    const n = 5; let prev = {x:fx, y:fy};
    for(let i = 1; i <= n; i++){ const k = i / n, q = {x:fx + (bx - fx) * k, y:fy + (by - fy) * k}; cx.quadraticCurveTo((prev.x + q.x) / 2, (prev.y + q.y) / 2 + 3, q.x, q.y); prev = q; }
    cx.quadraticCurveTo(px - 6, py + 3, px - 4.8, py - 3); cx.closePath();
    cx.fillStyle = W ? '#fff' : GREEN; cx.fill(); cx.strokeStyle = OUT; cx.lineWidth = OW; cx.lineJoin = 'round'; cx.stroke();
    // overlapping petal layer
    for(let i = 0; i < 5; i++){
      const k = i / 4, wx = px + 4 - k * 8.6, wy = py - 2 + k * .6;
      const tx = fx + (bx - fx) * (.05 + k * .9) - M.sp * 1.5, ty = fy + (by - fy) * (.05 + k * .9) - 3 + Math.sin(t * 1.8 + i) * .5;
      leaf(cx, wx, wy, tx, ty, 3.6, W ? '#fff' : (i === 1 || i === 3 ? IVORY : GREEN_L), W ? 0 : .5);
    }
    if(!W){ flower(cx, px + 3.2, py + 3, 1.3, IVORY, GOLD_L); flower(cx, px - 2.4, py + 7, 1.1, IVORY, GOLD_L);
      leaf(cx, px + 8, py + 6, px + 12 - M.sp * 3, py + 11, 1.4, '#3fae6a', .8); }       // a leaf along the side edge
  }

  function blossom(cx, t, S, M, W){                     // the Forest Blossom: a small living flower floating above one shoulder
    const bob = Math.sin(t * 2.1) * 1.6, x = S.sh.x + BLOSSOM_X, y = S.sh.y + BLOSSOM_Y + bob;
    if(!W) glow(cx, x, y, 9, 'rgba(240,215,110,A)', .4);
    cx.save(); cx.translate(x, y); cx.rotate(Math.sin(t * .9) * .12); cx.scale(.72, .72);
    leaf(cx, 0, 2, -3.6, 6.2, 1.4, W ? '#fff' : GREEN_L, .8); leaf(cx, 0, 2, 3.6, 6.2, 1.4, W ? '#fff' : GREEN, .8);       // deep-green sepals at the base
    for(let i = 0; i < 6; i++){ const a = -Math.PI / 2 + (i - 2.5) * .62 + Math.sin(t * 1.4 + i) * .04;                      // soft ivory petals
      leaf(cx, 0, 0, Math.cos(a) * 6.2, Math.sin(a) * 6.2, 2.2, W ? '#fff' : (i % 2 ? '#fffaf0' : IVORY), .8); }
    cx.fillStyle = W ? '#fff' : GOLD_L; cx.beginPath(); cx.arc(0, 0, 2.7, 0, 7); cx.fill();                                    // glowing golden center
    if(!W){ cx.fillStyle = 'rgba(255,240,170,.6)'; cx.beginPath(); cx.arc(0, 0, 3.6 + Math.sin(t * 3) * .4, 0, 7); cx.fill(); }
    gem(cx, 0, 0, 1.7, W);                                                                                                       // small emerald crystal in the middle
    cx.restore();
    if(!W){ for(let i = 0; i < 5; i++){ const a = t * (.8 + i * .13) + i * 1.3, r = 7 + Math.sin(t + i) * 1.5;               // little particles around it
      cx.globalAlpha = .5 + .4 * Math.sin(t * 2 + i); cx.fillStyle = i % 2 ? GOLD_L : EMER; cx.beginPath(); cx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r * .8, .8, 0, 7); cx.fill(); }
      cx.globalAlpha = 1; }
  }

  function head(cx, t, S, f, W){                        // face + ear + hair cap + crown + circlet, in the head's own rotated frame (x = forward, y = down)
    const ha = Math.atan2(S.head.x - S.sh.x, -(S.head.y - S.sh.y)), r = HR;
    cx.save(); cx.translate(S.head.x, S.head.y); cx.rotate(ha);
    // redraw the head: covers body.js's default visor
    cx.fillStyle = OUT; cx.beginPath(); cx.arc(0, 0, r + OW, 0, 7); cx.fill();
    cx.fillStyle = W ? '#fff' : SKIN; cx.beginPath(); cx.arc(0, 0, r, 0, 7); cx.fill();
    // small nose, soft jaw shade
    cx.fillStyle = W ? '#fff' : SKIN; cx.strokeStyle = OUT; cx.lineWidth = .9; cx.beginPath(); cx.moveTo(r - .5, -.8); cx.quadraticCurveTo(r + 1.6, .6, r - .4, 1.6); cx.stroke(); cx.fill();
    if(!W){
      cx.fillStyle = 'rgba(190,120,80,.18)'; cx.beginPath(); cx.ellipse(-r * .1, r * .62, r * .7, r * .28, 0, 0, 7); cx.fill();
      // eye (deep forest green with shine), soft lash, brow
      const blink = (Math.sin(t * .9) > .985 || ((t * .43) % 1) > .975) ? .15 : 1;
      cx.fillStyle = '#fff6e6'; cx.beginPath(); cx.ellipse(r * .42, r * .06, 1.9, 2.2 * blink, 0, 0, 7); cx.fill();
      cx.fillStyle = '#12552f'; cx.beginPath(); cx.ellipse(r * .5, r * .08, 1.35, 1.9 * blink, 0, 0, 7); cx.fill();
      cx.fillStyle = '#0a2a18'; cx.beginPath(); cx.ellipse(r * .52, r * .1, .6, 1 * blink, 0, 0, 7); cx.fill();
      cx.fillStyle = 'rgba(255,255,255,.9)'; cx.fillRect(r * .43, r * .0, .8, .8);
      cx.strokeStyle = '#3a2418'; cx.lineWidth = .9; cx.lineCap = 'round'; cx.beginPath(); cx.moveTo(r * .2, -r * .12); cx.quadraticCurveTo(r * .5, -r * .24, r * .72, -r * .02); cx.stroke();
      cx.lineWidth = .7; cx.beginPath(); cx.moveTo(r * .22, -r * .34); cx.quadraticCurveTo(r * .5, -r * .46, r * .76, -r * .3); cx.stroke();
      // warm peaceful smile + blush
      cx.strokeStyle = '#b3604f'; cx.lineWidth = .8; cx.beginPath(); cx.moveTo(r * .42, r * .52); cx.quadraticCurveTo(r * .62, r * .62, r * .78, r * .48); cx.stroke();
      cx.fillStyle = BLUSH; cx.beginPath(); cx.ellipse(r * .25, r * .38, 1.7, 1.1, 0, 0, 7); cx.fill();
      // minimal vine marking on the cheek
      cx.strokeStyle = 'rgba(47,138,82,.85)'; cx.lineWidth = .7; cx.beginPath(); cx.moveTo(r * .2, r * .3); cx.quadraticCurveTo(r * .3, r * .5, r * .42, r * .36); cx.stroke();
      leaf(cx, r * .42, r * .36, r * .54, r * .28, .6, '#3fae6a', 0);
    }
    // (the ear is hidden under the side hair lock below)
    
    // hair cap: covers top + back of the head with a soft side-swept fringe
    cx.beginPath(); cx.moveTo(r * .92, -r * .22); cx.arc(0, 0, r + .5, -.3, -Math.PI * 1.27, true);
    cx.lineTo(-r * .42, r * .22); cx.quadraticCurveTo(-r * .05, -r * .5, r * .92, -r * .22); cx.closePath();
    cx.fillStyle = W ? '#fff' : HAIR_A; cx.fill(); cx.strokeStyle = OUT; cx.lineWidth = OW * .8; cx.lineJoin = 'round'; cx.stroke();
    if(!W){ cx.strokeStyle = 'rgba(190,240,200,.45)'; cx.lineWidth = 1; cx.beginPath(); cx.arc(0, 0, r * .74, -2.4, -.9); cx.stroke();
      cx.strokeStyle = 'rgba(30,100,60,.7)'; cx.lineWidth = .6; cx.beginPath(); cx.moveTo(r * .55, -r * .36); cx.quadraticCurveTo(r * .1, -r * .55, -r * .35, -r * .1); cx.stroke(); }
    // side hair: a thick lock falls over the ear and frames the face (the ear is covered)
    if(true){
      cx.beginPath(); cx.moveTo(r * .42, -r * .5); cx.quadraticCurveTo(r * .04, -r * .2, r * .1, r * .35); cx.quadraticCurveTo(r * .1, r * .78, -r * .22, r * .98);
      cx.quadraticCurveTo(-r * .6, r * 1.0, -r * .82, r * .55); cx.lineTo(-r * .97, r * .05); cx.lineTo(-r * .8, -r * .6); cx.closePath();
      cx.fillStyle = W ? '#fff' : HAIR_A; cx.fill(); cx.strokeStyle = OUT; cx.lineWidth = OW * .8; cx.lineJoin = 'round'; cx.stroke();
      if(!W){
        for(let i = 0; i < 4; i++){ const x0 = r * (.02 - i * .2), g = mixc(HAIR_A, HAIR_B, .3 + i * .2);
          cx.strokeStyle = g; cx.lineWidth = 1.1; cx.lineCap = 'round'; cx.beginPath(); cx.moveTo(x0 + r * .12, -r * .05 + i * .6); cx.quadraticCurveTo(x0 + r * .08, r * .4, x0 - r * .06, r * .8 - i * .4); cx.stroke(); }
        cx.strokeStyle = 'rgba(190,240,200,.5)'; cx.lineWidth = .8; cx.beginPath(); cx.moveTo(r * .1, 0); cx.quadraticCurveTo(r * .1, r * .45, -r * .1, r * .8); cx.stroke();
        cx.strokeStyle = HAIR_C; cx.lineWidth = 1.1; cx.beginPath(); cx.moveTo(-r * .02, r * .86); cx.quadraticCurveTo(-r * .25, r * .97, -r * .5, r * .9); cx.stroke();       // golden tips
        flower(cx, -r * .12, r * .5, 1.3, IVORY, GOLD_L); leaf(cx, -r * .12, r * .5, -r * .36, r * .72, .9, '#3fae6a', .5);
      }
    }
    // thin golden circlet across the forehead with a small emerald at its center
    cx.strokeStyle = W ? '#fff' : GOLD; cx.lineWidth = 1.2; cx.lineCap = 'round'; cx.beginPath(); cx.arc(0, 0, r * .98, -.35, -2.7, true); cx.stroke();
    // natural floral crown: vine, leaves and little flowers along the top of the head
    if(!W){
      cx.strokeStyle = '#2f8a52'; cx.lineWidth = .9; cx.beginPath(); cx.arc(0, 0, r + .9, -.55, -2.9, true); cx.stroke();
      for(let i = 0; i < 6; i++){ const a = -.6 - i * .42, px = Math.cos(a) * (r + 1), py = Math.sin(a) * (r + 1);
        if(i % 2) leaf(cx, px, py, px + Math.cos(a - 1.1) * 3.4, py + Math.sin(a - 1.1) * 3.4, 1.1, '#3fae6a', .7);
        else flower(cx, px, py, 1.5, IVORY, GOLD_L); }
      leaf(cx, Math.cos(-.5) * (r + 1), Math.sin(-.5) * (r + 1), r + 3.2, -r * .1, 1.1, '#3fae6a', .7);
    }
    gem(cx, r * .8, -r * .42, 1.05, W);
    cx.restore();
  }

  function frontLock(cx, t, S, M, W){    // one soft lock of hair falls forward over the near shoulder
    const b = {x:S.head.x + .2, y:S.head.y + 6.2}, e = {x:S.sh.x + 2.6 - M.sp * 3 + Math.sin(t * 1.6) * .7, y:S.sh.y + 8 - M.lift * .4}, c = {x:b.x + 3.4, y:(b.y + e.y) / 2 - 1}, N = 6, pts = [];
    for(let i = 0; i <= N; i++) pts.push(qpt(b, c, e, i / N));
    for(let pass = 0; pass < 2; pass++) for(let i = 0; i < N; i++){
      const k = i / N, wd = 3.4 * (1 - k * .65), col = k < .4 ? mixc(HAIR_A, HAIR_B, k / .4) : mixc(HAIR_B, HAIR_C, (k - .4) / .6);
      Body.capsule(cx, pts[i], pts[i + 1], pass ? wd : wd + OW * 2, pass ? (W ? '#fff' : col) : OUT);
    }
    if(!W){ const q = pts[3]; flower(cx, q.x + .8, q.y, 1.2, IVORY, GOLD_L); }
  }

  // ---------- THE ART ----------
  Characters.art('drudesse', {
    // medium height, slender. FLOATING: the ragdoll legs / feet / arms / hands + the outline are invisible here (same trick as nethros) - every visible part is drawn in this file with its own outline.
    body: {head:{r:HR}, torso:{len:11, w:8.2}, uArm:{len:8.5, w:.01}, fArm:{len:8.5, w:.01}, hand:{r:.01},
           thigh:{len:TH, w:.01}, shin:{len:SHN, w:.01}, foot:{len:1, w:.01}, headSink:0, shN:.5, shF:-1.5, outline:'rgba(0,0,0,0)', outlineW:0, noRings:true, belt:.1},
    colors: {shirt:GREEN, limb:'rgba(0,0,0,0)', far:'rgba(0,0,0,0)', head:SKIN, dark:GREEN_D, hand:'rgba(0,0,0,0)', legs:'rgba(0,0,0,0)', legsFar:'rgba(0,0,0,0)'},

    foot(){},
    farFront: () => false,

    // floating stance: no walking steps and no arm pumping. Arms rest softly and trail a little behind when she glides; the waist bobs gently.
    pose(tg, f, t, run){
      const b = Math.sin(t * 1.6), fw = clamp((f.vx || 0) * (f.face || 1) / 170, -1, 1);
      tg.lean = -.02 + fw * .1; tg.head = -fw * .03;
      tg.aN = .14 + b * .04 - fw * .45; tg.eN = .35 + Math.abs(fw) * .2;
      tg.aF = -.1 - b * .04 - fw * .4;  tg.eF = .3 + Math.abs(fw) * .2;
      holdLegs(tg, HOVER + Math.sin(t * 1.9) * BOB);
    },
    // default punch arms (she has no skills yet), but the hidden legs never step so she keeps hovering
    attack(tg, p, A, K){
      tg.aN = K(p, [[0,.2], [.18,-.55], [.4,1.45], [.7,1.5], [1,.3]]); tg.eN = K(p, [[0,.9], [.18,2.1], [.4,.25], [.7,.2], [1,1.1]]);
      tg.lean = K(p, [[0,.05], [.18,-.18], [.4,.38], [.7,.3], [1,.1]]); tg.head = -tg.lean * .4;
      tg.aF = K(p, [[0,.5], [.2,.8], [.45,.35], [1,.6]]); tg.eF = K(p, [[0,1.7], [.2,2.0], [.45,2.1], [1,1.8]]);
      holdLegs(tg, HOVER);
    },

    // everything that sits behind her body
    behind(cx, f, t, S, P){
      NOWT.t = t; const W = f.flash > 0, M = motion(f, t); NOWT.M = M;
      if(f.gr && AURA_ON && !W){ const a = .14 + .05 * Math.sin(t * 2); cx.fillStyle = 'rgba(70,225,150,' + a + ')'; cx.beginPath(); cx.ellipse(S.pel.x - 1, -.5, 15, 3, 0, 0, 7); cx.fill();   // soft glow on the ground under her
        cx.strokeStyle = 'rgba(240,210,110,' + a * 1.4 + ')'; cx.lineWidth = .8; cx.beginPath(); cx.ellipse(S.pel.x - 1, -.5, 11 + Math.sin(t * 2) * 1.2, 2.2, 0, 0, 7); cx.stroke(); }
      if(AURA_ON && !W) aura(cx, t, S, W);
      train(cx, t, S, M, W); mantle(cx, t, S, M, W); hair(cx, t, S, M, W); dangleLegs(cx, t, f, S, M, W);
    },

    // off-shoulder bodice (skin shoulders + collarbones) + vine belt with emerald. Replaces the default torso.
    torso(cx, S, B, P, white){
      const W = !!white, {pel, sh} = S, dx = sh.x - pel.x, dy = sh.y - pel.y, L = Math.hypot(dx, dy) || 1, u = {x:dx / L, y:dy / L}, fw = {x:-u.y, y:u.x}, w = B.torso.w;
      const at = (k, o) => ({x:pel.x + u.x * L * k + fw.x * (o || 0), y:pel.y + u.y * L * k + fw.y * (o || 0)});
      const FA = S.aF, fcol = W ? '#fff' : SKIN_D;                                           // far arm (drawn here so it stays behind the body)
      Body.capsule(cx, FA.s, FA.el, 3.4 + OW * 2, OUT); Body.capsule(cx, FA.el, FA.hand, 3.1 + OW * 2, OUT);
      Body.capsule(cx, FA.s, FA.el, 3.4, fcol); Body.capsule(cx, FA.el, FA.hand, 3.1, fcol);
      cx.fillStyle = OUT; cx.beginPath(); cx.arc(FA.hand.x, FA.hand.y, 2.3 + OW, 0, 7); cx.fill(); cx.fillStyle = fcol; cx.beginPath(); cx.arc(FA.hand.x, FA.hand.y, 2.3, 0, 7); cx.fill();
      sleeve(cx, FA, NOWT.M || {sp:0, lift:0}, W, true);
      Body.capsule(cx, pel, sh, w + OW * 2, OUT);
      Body.capsule(cx, pel, sh, w, W ? '#fff' : SKIN);                                     // skin: shoulders, collarbones, upper back
      if(W) return;
      Body.capsule(cx, pel, at(.6), w + .5, GREEN);                                        // deep-green bodice
      const a = at(.6, -w / 2 - .3), b = at(.6, w / 2 + .3), m = at(.5, 0);               // scalloped ivory neckline
      cx.strokeStyle = IVORY; cx.lineWidth = 1.3; cx.lineCap = 'round'; cx.beginPath(); cx.moveTo(a.x, a.y); cx.quadraticCurveTo(m.x - fw.x * 1.5, m.y - fw.y * 1.5, b.x, b.y); cx.stroke();
      cx.strokeStyle = 'rgba(245,240,223,.35)'; cx.lineWidth = .7; cx.beginPath(); const c1 = at(.12, -w * .3), c2 = at(.46, -w * .15); cx.moveTo(c1.x, c1.y); cx.lineTo(c2.x, c2.y); cx.stroke();
      cx.strokeStyle = 'rgba(255,255,255,.4)'; cx.lineWidth = .7; const ca = at(.88, -w * .2), cb = at(.88, w * .25); cx.beginPath(); cx.moveTo(ca.x, ca.y); cx.lineTo(cb.x, cb.y); cx.stroke();   // collarbone hint
      const bl = [at(.18, -w / 2 - .2), at(.18, w / 2 + .2)];                              // thin gold belt (muted) hidden in the vine
      cx.strokeStyle = GOLD; cx.lineWidth = 1.2; cx.beginPath(); cx.moveTo(bl[0].x, bl[0].y); cx.lineTo(bl[1].x, bl[1].y); cx.stroke();
      cx.strokeStyle = '#2f8a52'; cx.lineWidth = 1; cx.beginPath();                        // vine wrapping the waist
      for(let i = 0; i <= 8; i++){ const p = at(.18 + Math.sin(i * 1.3) * .07, -w / 2 + i * w / 8); i ? cx.lineTo(p.x, p.y) : cx.moveTo(p.x, p.y); } cx.stroke();
      [-.3, .15].forEach(o => { const p = at(.2, w * o); flower(cx, p.x, p.y, 1.4, IVORY, GOLD_L); });
      const l1 = at(.17, -w * .2), l2 = at(.17, w * .1);
      leaf(cx, l1.x, l1.y, l1.x - u.x * 4.4 - 1.5, l1.y - u.y * 4.4 + 1, 1.1, '#3fae6a', 0); leaf(cx, l2.x, l2.y, l2.x - u.x * 4.4, l2.y - u.y * 4.4 + 1.5, 1.1, IVORY, 0);    // leaves flowing down into the skirt
      const g = at(.2, w * .46); gem(cx, g.x, g.y, 1.7, false);                           // emerald centerpiece
      // open back: a few tiny flowers / vine on the upper back edge
      const v1 = at(.78, -w / 2 + .6), v2 = at(.55, -w / 2 + .6); flower(cx, v1.x, v1.y, 1.1, IVORY, GOLD_L); leaf(cx, v2.x, v2.y, v2.x - 2.5, v2.y + 1.2, 1, '#3fae6a', 0);
    },

    // everything on top: far sleeve, skirt, near arm + sleeve, face / hair / crown, Forest Blossom
    front(cx, f, t, S, P){
      NOWT.t = t; const W = f.flash > 0, M = motion(f, t);
      skirt(cx, t, S, M, W);
      // near arm is redrawn here so the skirt does not cover the hand (bare arm under the translucent sleeve)
      const A = S.aN, col = W ? '#fff' : SKIN;
      Body.capsule(cx, A.s, A.el, 3.4 + OW * 2, OUT); Body.capsule(cx, A.el, A.hand, 3.1 + OW * 2, OUT);
      Body.capsule(cx, A.s, A.el, 3.4, col); Body.capsule(cx, A.el, A.hand, 3.1, col);
      cx.fillStyle = OUT; cx.beginPath(); cx.arc(A.hand.x, A.hand.y, 2.3 + OW, 0, 7); cx.fill(); cx.fillStyle = col; cx.beginPath(); cx.arc(A.hand.x, A.hand.y, 2.3, 0, 7); cx.fill();
      sleeve(cx, A, M, W, false);
      frontLock(cx, t, S, M, W);
      head(cx, t, S, f, W);
      blossom(cx, t, S, M, W);
    }
  });
})();
