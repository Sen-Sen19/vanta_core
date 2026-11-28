// ALARIC art - THE SILVER MOON SENTINEL (elven prince, forest guardian, master archer). Same shared ragdoll (body.js); only the LOOK + bow poses are here.
// Look: tall lean elf, youthful clean-shaven face with pale-green eyes and pointed ears, long silver hair (half-up, temple braids with silver beads) reaching mid-back,
//       thin silver circlet with a pale-blue gem, moonstone pendant. Silver + white + pale-blue royal armor, ASYMMETRIC: engraved silver pauldron on the near shoulder,
//       light white mantle on the far shoulder, silver bracers (fingers bare), belt with a pale-blue gem over a flowing white sash, knee-high silver boots. No hood, no cape.
// Weapon: ROYAL MOONLIGHT LONGBOW (silver-white limbs, gem at the grip, pale-blue energy along the limbs, the string glows when drawn) + diagonal back quiver with white-silver arrows.
// Fighting: basic attack = 3 arrows (nock, draw to the cheek, release at p = C below = shot.p in skills.js, MUST match). Skill I (shockwave kind) = an aimed arrow, the bow follows the aim.
// Hooks used: body, colors, farFront, spring, pose (relaxed bow carry), attack (draw + release), torso (tunic, chest plate, strap), foot (boot + thigh armor), behind (quiver, hair, mantle, glow),
//             front (sash, belt, bracers, pauldron, face, hair, circlet, pendant, bow, string, nocked arrow), shot (the arrow in flight).
// World tracking for arena.js: f.handW.N = the middle of the nocked arrow (where a basic arrow leaves the bow).
(() => {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const PI = Math.PI, OUT = '#0b0f1c';
  const K = (p, k) => Body.keys(p, k);

  // palette: silver + white + pale blue. Nothing else except skin, hair and the green of the eyes.
  const SIL = '#c9d3df', SIL_L = '#eef3f9', SIL_D = '#8f9db2', SIL_DD = '#5e6e86';
  const WHT = '#f1f5fa', WHT_D = '#cfd9e6';
  const BLU = '#8ec9ff', BLU_L = '#d9efff', BLU_D = '#4d86c4';
  const HAIR = '#d9e0ea', HAIR_L = '#f7faff', HAIR_D = '#a7b3c6';
  const SKIN = '#f2dfcd', SKIN_D = '#d8bda6', GREEN = '#a6e6bf';

  const LEN = 9, SHN = 1.5, SHF = -4, R = 5.4;     // arm bone length, shoulder x offsets (near / far), head radius (same as body: below)
  const C = [.5, .5, .52];                          // moment the arrow leaves the bow, per combo step = shot.p in skills.js (keep the same)
  let CUR = null;                                   // set by behind() (it always runs first): torso() / foot() get no fighter

  // ---------------- small drawing helpers (local space: origin = feet, x = forward, y = down) ----------------
  function poly(cx, pts, fill, lw){
    cx.beginPath(); pts.forEach((q, i) => i ? cx.lineTo(q[0], q[1]) : cx.moveTo(q[0], q[1])); cx.closePath();
    cx.fillStyle = fill; cx.fill(); cx.lineWidth = lw == null ? 1.2 : lw; cx.strokeStyle = OUT; cx.lineJoin = 'round'; cx.stroke();
  }
  function cap(cx, a, b, w, col, ow){                // outlined round capsule
    cx.lineCap = 'round'; cx.strokeStyle = OUT; cx.lineWidth = w + (ow == null ? 2.2 : ow); cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); cx.stroke();
    cx.strokeStyle = col; cx.lineWidth = w; cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); cx.stroke();
  }
  function taper(cx, a, b, w0, w1, col, lw){          // outlined tapered strip a -> b (boot shaft, quiver)
    const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    poly(cx, [[a.x + nx * w0 / 2, a.y + ny * w0 / 2], [b.x + nx * w1 / 2, b.y + ny * w1 / 2], [b.x - nx * w1 / 2, b.y - ny * w1 / 2], [a.x - nx * w0 / 2, a.y - ny * w0 / 2]], col, lw);
  }
  const lp = (a, b, k) => ({x:a.x + (b.x - a.x) * k, y:a.y + (b.y - a.y) * k});
  function gem(cx, x, y, r, white){                    // small pale-blue gemstone with a glint
    cx.fillStyle = white ? '#fff' : BLU; cx.beginPath(); cx.arc(x, y, r, 0, 7); cx.fill(); cx.lineWidth = .8; cx.strokeStyle = OUT; cx.stroke();
    if(!white){ cx.fillStyle = BLU_L; cx.beginPath(); cx.arc(x - r * .3, y - r * .3, r * .38, 0, 7); cx.fill(); }
  }
  function crescent(cx, x, y, r, col){
    cx.save(); cx.beginPath(); cx.arc(x, y, r, 0, 7); cx.clip();
    cx.beginPath(); cx.arc(x, y, r, 0, 7); cx.arc(x + r * .5, y - r * .12, r * .82, 0, 7); cx.fillStyle = col; cx.fill('evenodd'); cx.restore();
  }
  // tapered cloth / hair strip hanging from `root`, swings by angle th (0 = straight down, + = forward), waves a little.
  function strip(cx, root, th, len, w0, w1, fill, edge, t, ph, wave, white, lw){
    const N = 7, pts = [{x:root.x, y:root.y, w:w0}];
    let x = root.x, y = root.y;
    for(let i = 1; i <= N; i++){ const s = i / N, a = th * (1 - .35 * s) + Math.sin(t * 5.2 + ph + s * 3) * .05 * s * wave; x += Math.sin(a) * len / N; y += Math.cos(a) * len / N; pts.push({x, y, w:w0 + (w1 - w0) * s}); }
    const L = [], Rr = [];
    pts.forEach((q, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(N, i + 1)], tx = b.x - a.x, ty = b.y - a.y, l = Math.hypot(tx, ty) || 1, nx = -ty / l, ny = tx / l; L.push({x:q.x + nx * q.w / 2, y:q.y + ny * q.w / 2}); Rr.push({x:q.x - nx * q.w / 2, y:q.y - ny * q.w / 2}); });
    cx.beginPath(); cx.moveTo(L[0].x, L[0].y); L.forEach(q => cx.lineTo(q.x, q.y)); for(let i = N; i >= 0; i--) cx.lineTo(Rr[i].x, Rr[i].y); cx.closePath();
    cx.fillStyle = white ? '#fff' : fill; cx.fill(); cx.lineWidth = lw || 1.1; cx.strokeStyle = OUT; cx.lineJoin = 'round'; cx.stroke();
    if(!white && edge){ cx.strokeStyle = edge; cx.lineWidth = .8; cx.beginPath(); cx.moveTo(Rr[1].x, Rr[1].y); for(let i = 2; i <= N; i++) cx.lineTo(Rr[i].x, Rr[i].y); cx.stroke(); }
  }

  // ---------------- CLOTH / HAIR STATE: low-pass of numbers the game already has (no extra physics). All angles: 0 = straight down, + = forward ----------------
  function cloth(f, t, S){
    const c = f.alr || (f.alr = {t, l:S.lean, h1:0, h2:0, h3:0, s1:0, s2:0, m:0, run:0, fall:0});
    const dt = clamp(t - c.t, 0, .05); c.t = t;
    if(dt > 0){
      const run = clamp((f.vx || 0) * f.face / 240, -1, 1), fall = clamp((f.vy || 0) / 900, -.3, 1);
      const dl = clamp((S.lean - c.l) / dt, -8, 8); c.l = S.lean;
      const th = -run * .8 - S.lean * .3 - dl * .05 - fall * .15;
      c.h1 += (th - .05 + Math.sin(t * 1.9) * .03 - c.h1) * Math.min(1, dt * 7);
      c.h2 += (th * 1.15 - .12 + Math.sin(t * 1.5 + 1.3) * .035 - c.h2) * Math.min(1, dt * 5);
      c.h3 += (th * 1.3 - .02 + Math.sin(t * 2.3 + 2.1) * .04 - c.h3) * Math.min(1, dt * 4);
      c.s1 += (th * .8 + .08 + Math.sin(t * 2.2 + .6) * .03 - c.s1) * Math.min(1, dt * 8);
      c.s2 += (th * 1.1 - .22 + Math.sin(t * 1.7 + 1) * .035 - c.s2) * Math.min(1, dt * 6);
      c.m += (th * .9 - .1 + Math.sin(t * 2 + .3) * .03 - c.m) * Math.min(1, dt * 7);
      c.run = run; c.fall = fall;
    }
    return c;
  }

  // ---------------- BOW STATE + POSES ----------------
  // stateOf(p, A): what the archery looks like at swing progress p. phi = aim elevation (0 = level, + = up). mN / mF = how much the bow arm / draw arm follow the aim pose (0..1).
  // L = how far behind the grip the draw hand is (px). nocked = arrow on the string. since = progress after the release.
  function stateOf(p, A){
    if(A.skill === 'shockwave'){                      // SKILL I: the arrow leaves at once; the bow holds the aim, the draw hand is flung back
      return {skill:true, phi:(A.aimA == null ? PI / 2 : A.aimA) - PI / 2, c:0, p, tsec:p * (A.time || .4), since:p,
              mN:K(p, [[0, 1], [.7, 1], [1, 0]]), mF:K(p, [[0, 1], [.3, 0], [1, 0]]), L:20, nocked:false};
    }
    if(A.skill) return null;                          // skills with no archer pose yet: the idle bow carry
    const c = C[A.step || 0] == null ? C[0] : C[A.step || 0];
    return {skill:false, phi:0, c, p, tsec:Math.max(0, p - c) * (A.time || .6), since:p - c,
            mN:K(p, [[0, 0], [.16, 1], [.8, 1], [1, 0]]), mF:K(p, [[0, 0], [.14, 1], [c + .08, 1], [c + .3, 0], [1, 0]]),
            L:K(p, [[0, 3], [.14, 3], [c - .04, 16], [c, 16], [c + .05, 20], [1, 20]]), nocked:p > .06 && p < c};
  }
  // joint angles: the bow arm points up the aim (raised so the arrow flies at head height), the draw arm is solved with a 2-bone IK so its hand lands on the nock.
  function aimJoints(phi, L){
    const aN = PI / 2 + phi + .4, eN = .06;
    const hx = SHN + Math.sin(aN) * LEN + Math.sin(aN + eN) * LEN, hy = Math.cos(aN) * LEN + Math.cos(aN + eN) * LEN;      // bow hand, relative to the near shoulder point
    const tx = hx - Math.cos(phi) * L - SHF, ty = hy + Math.sin(phi) * L;                                                    // nock, relative to the FAR shoulder
    const d = Math.min(Math.hypot(tx, ty), 2 * LEN - .05), th = Math.atan2(tx, ty), be = Math.acos(clamp(d / (2 * LEN), 0, 1));
    let aF = th + be; aF = ((aF + PI) % (2 * PI) + 2 * PI) % (2 * PI) - PI;       // elbow swings back / up (the natural way round)
    return {aN, eN, aF, eF:-2 * be};
  }
  const FF = f => f.atk > 0 && !!f.A && !(f.stun > 0) && (!f.A.skill || f.A.skill === 'shockwave');

  // ---------------- bracer / armor pieces ----------------
  function bracer(cx, arm, far, white){
    const a = lp(arm.el, arm.hand, .22), b = lp(arm.el, arm.hand, .8);
    cap(cx, a, b, 5.2, white ? '#fff' : (far ? SIL_D : SIL), 2);
    if(white) return;
    const n = Math.hypot(b.x - a.x, b.y - a.y) || 1, nx = -(b.y - a.y) / n, ny = (b.x - a.x) / n, w = lp(a, b, .92), e = lp(a, b, .08);
    cx.lineCap = 'round'; cx.strokeStyle = far ? SIL_DD : SIL_L; cx.lineWidth = .7; cx.beginPath(); cx.moveTo(lp(a, b, .12).x + nx * 1.2, lp(a, b, .12).y + ny * 1.2); cx.lineTo(lp(a, b, .88).x + nx * 1.2, lp(a, b, .88).y + ny * 1.2); cx.stroke();
    cx.strokeStyle = far ? BLU_D : BLU; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(w.x + nx * 2.2, w.y + ny * 2.2); cx.lineTo(w.x - nx * 2.2, w.y - ny * 2.2); cx.stroke();       // pale-blue band at the wrist
    cx.beginPath(); cx.moveTo(e.x + nx * 2.4, e.y + ny * 2.4); cx.lineTo(e.x - nx * 2.4, e.y - ny * 2.4); cx.stroke();
  }
  function pauldron(cx, S, white){                     // engraved silver plate over the NEAR shoulder, rides on the upper arm
    const s = S.aN.s, el = S.aN.el;
    cx.save(); cx.translate(s.x, s.y); cx.rotate((Math.atan2(el.y - s.y, el.x - s.x) - PI / 2) * .55); cx.lineJoin = 'round';
    cx.beginPath(); cx.moveTo(-4.2, 3); cx.quadraticCurveTo(0, 6.6, 4.2, 3); cx.lineTo(3.6, 5.8); cx.quadraticCurveTo(0, 8.6, -3.6, 5.8); cx.closePath();   // lower lame under the dome
    cx.fillStyle = white ? '#fff' : SIL_D; cx.fill(); cx.lineWidth = 1.1; cx.strokeStyle = OUT; cx.stroke();
    cx.beginPath(); cx.moveTo(-5, 3.4); cx.bezierCurveTo(-5.4, -3.2, -2.6, -5.6, 0, -5.6); cx.bezierCurveTo(2.6, -5.6, 5.4, -3.2, 5, 3.4); cx.quadraticCurveTo(0, 5.4, -5, 3.4); cx.closePath();
    if(white){ cx.fillStyle = '#fff'; cx.fill(); cx.lineWidth = 1.3; cx.strokeStyle = OUT; cx.stroke(); cx.restore(); return; }
    const g = cx.createLinearGradient(-5, -5, 4, 4); g.addColorStop(0, SIL_L); g.addColorStop(.55, SIL); g.addColorStop(1, SIL_D);
    cx.fillStyle = g; cx.fill(); cx.lineWidth = 1.3; cx.strokeStyle = OUT; cx.stroke();
    cx.strokeStyle = BLU; cx.lineWidth = .8; cx.beginPath(); cx.moveTo(-4.4, 2.6); cx.quadraticCurveTo(0, 5, 4.4, 2.6); cx.stroke();                              // pale-blue trim on the rim
    cx.strokeStyle = SIL_DD; cx.lineWidth = .6; cx.beginPath(); cx.moveTo(-1, 3); cx.quadraticCurveTo(-3.4, -.4, -.8, -4); cx.moveTo(1, 3); cx.quadraticCurveTo(3.4, -.4, .8, -4); cx.stroke();   // leaf engraving
    crescent(cx, 0, -.6, 2.1, BLU_D);                                                                                                                                    // moon motif
    cx.restore();
  }

  // ---------------- the bow ----------------
  // Local frame: origin = grip (the bow hand), +x = the way the arrow flies, y = along the bow (up = -y). pull = px the string is drawn back.
  function drawBow(cx, pull, nockY, vib, glow, white, t){
    const H = 20, tipX = -1.2 - pull * .15;
    const limbPts = sg => { const out = [], P0 = {x:0, y:3.6 * sg}, P1 = {x:3.6, y:9 * sg}, P2 = {x:3.9, y:15.5 * sg}, P3 = {x:tipX, y:H * sg};
      for(let i = 0; i <= 10; i++){ const s = i / 10, u = 1 - s; out.push({x:u * u * u * P0.x + 3 * u * u * s * P1.x + 3 * u * s * s * P2.x + s * s * s * P3.x, y:u * u * u * P0.y + 3 * u * u * s * P1.y + 3 * u * s * s * P2.y + s * s * s * P3.y}); }
      return out; };
    [-1, 1].forEach(sg => {
      const pts = limbPts(sg), N = pts.length - 1, Lh = [], Rr = [];
      pts.forEach((q, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(N, i + 1)], tx = b.x - a.x, ty = b.y - a.y, l = Math.hypot(tx, ty) || 1, nx = -ty / l, ny = tx / l, w = lerp(3.1, 1.3, i / N); Lh.push([q.x + nx * w / 2, q.y + ny * w / 2]); Rr.push([q.x - nx * w / 2, q.y - ny * w / 2]); });
      cx.beginPath(); cx.moveTo(Lh[0][0], Lh[0][1]); Lh.forEach(q => cx.lineTo(q[0], q[1])); for(let i = N; i >= 0; i--) cx.lineTo(Rr[i][0], Rr[i][1]); cx.closePath();
      cx.fillStyle = white ? '#fff' : '#e4ebf4'; cx.fill(); cx.lineWidth = 1.2; cx.strokeStyle = OUT; cx.lineJoin = 'round'; cx.stroke();
      if(white) return;
      cx.strokeStyle = '#ffffff'; cx.lineWidth = .6; cx.beginPath(); cx.moveTo(Lh[1][0], Lh[1][1]); for(let i = 2; i < N - 1; i++) cx.lineTo(Lh[i][0], Lh[i][1]); cx.stroke();          // polished highlight
      cx.strokeStyle = SIL_D; cx.lineWidth = .6; cx.beginPath(); cx.moveTo(Rr[1][0], Rr[1][1]); for(let i = 2; i < N - 1; i++) cx.lineTo(Rr[i][0], Rr[i][1]); cx.stroke();              // shaded edge
      // pale-blue energy running along the limb (stronger the further it is drawn): a soft wide stroke under a thin bright one, no shadowBlur
      const gl = glow * (.8 + .2 * Math.sin(t * 6 + sg));
      cx.lineCap = 'round'; cx.beginPath(); cx.moveTo(pts[1].x, pts[1].y); for(let i = 2; i < N; i++) cx.lineTo(pts[i].x, pts[i].y);
      cx.strokeStyle = 'rgba(142,201,255,' + (.22 * gl) + ')'; cx.lineWidth = 3.4; cx.stroke(); cx.strokeStyle = 'rgba(217,239,255,' + (.85 * gl) + ')'; cx.lineWidth = .8; cx.stroke();
      [.35, .62].forEach(s => { const q = pts[Math.round(s * N)]; cx.fillStyle = BLU_D; cx.fillRect(q.x - .5, q.y - .5, 1, 1); });                                                  // engraved ticks
      cx.fillStyle = SIL_L; cx.beginPath(); cx.arc(pts[N].x, pts[N].y, .9, 0, 7); cx.fill();                                                                                      // limb tip cap
    });
    // string: thin pale silver at rest, glows pale blue as it is drawn. Nock = where the draw hand holds it.
    const nock = {x:-1.2 - pull, y:nockY + vib}, sc = clamp(pull / 14, 0, 1);
    cx.lineCap = 'round'; cx.lineJoin = 'round';
    cx.beginPath(); cx.moveTo(tipX, -H); cx.lineTo(nock.x, nock.y); cx.lineTo(tipX, H);
    if(!white && sc > .02){ cx.strokeStyle = 'rgba(142,201,255,' + (.3 * sc) + ')'; cx.lineWidth = 3; cx.stroke(); }
    cx.strokeStyle = white ? '#fff' : 'rgb(' + Math.round(lerp(226, 175, sc)) + ',' + Math.round(lerp(233, 222, sc)) + ',255)'; cx.lineWidth = .9; cx.stroke();
  }
  function arrowShape(cx, x0, x1, white, big){          // an arrow lying along +x from the nock end x0 to the head x1 (local space): silver-white shaft, pale-blue fletching, silver head
    cx.lineCap = 'round';
    cx.strokeStyle = OUT; cx.lineWidth = 2.4; cx.beginPath(); cx.moveTo(x0, 0); cx.lineTo(x1 - 3, 0); cx.stroke();
    cx.strokeStyle = white ? '#fff' : SIL_L; cx.lineWidth = 1.2; cx.beginPath(); cx.moveTo(x0, 0); cx.lineTo(x1 - 3, 0); cx.stroke();
    const fl = big ? 7 : 5.4;
    [-1, 1].forEach(sg => { poly(cx, [[x0 + 1, 0], [x0 + fl, sg * 2.2], [x0 + fl + 1.2, sg * 1.5], [x0 + fl - .6, 0]], white ? '#fff' : (sg < 0 ? BLU_L : WHT), .8); });                          // fletching
    poly(cx, [[x1 - 3.6, 0], [x1 - 1.4, -1.9], [x1 + 1.6, 0], [x1 - 1.4, 1.9]], white ? '#fff' : SIL, 1);                                                                               // head
  }
  function quiver(cx, S, white){                         // diagonal back quiver: silver engraved frame, white-silver arrows with fletching poking out of the top
    const a = {x:S.pel.x - 3.4, y:S.pel.y + 2.4}, b = {x:S.sh.x - 12.2, y:S.sh.y - 2.4}, ang = Math.atan2(b.y - a.y, b.x - a.x), len = Math.hypot(b.x - a.x, b.y - a.y);
    cx.save(); cx.translate(a.x, a.y); cx.rotate(ang); cx.lineCap = 'round';
    for(let i = 0; i < 4; i++){                          // arrows first, the tube covers their lower part
      const off = (i - 1.5) * 1.9, sp = (i - 1.5) * .09, ln = 7 + (i % 2) * 2.2, sg = i % 2 ? 1 : -1;
      cx.save(); cx.translate(len - 3, off); cx.rotate(sp);
      cx.strokeStyle = OUT; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(0, 0); cx.lineTo(ln, 0); cx.stroke();
      cx.strokeStyle = white ? '#fff' : SIL_L; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(0, 0); cx.lineTo(ln, 0); cx.stroke();
      poly(cx, [[ln - 5, 0], [ln - .6, -2.1 * sg], [ln + .8, -1.4 * sg], [ln - 1.6, 0]], white ? '#fff' : (i % 2 ? BLU_L : WHT), .7);
      cx.restore();
    }
    taper(cx, {x:-.5, y:0}, {x:len, y:0}, 4.6, 6.2, white ? '#fff' : SIL, 1.3);
    if(!white){
      cx.strokeStyle = SIL_L; cx.lineWidth = .7; cx.beginPath(); cx.moveTo(1, -1.6); cx.lineTo(len - 1, -2.3); cx.stroke();                                                  // lit edge
      cx.strokeStyle = BLU; cx.lineWidth = 1; [.3, .62].forEach(s => { cx.beginPath(); cx.moveTo(len * s, -3 - s * .3); cx.lineTo(len * s, 3 + s * .3); cx.stroke(); });       // pale-blue bands
      cx.strokeStyle = SIL_DD; cx.lineWidth = .6; cx.beginPath(); cx.moveTo(len * .38, 1.2); cx.quadraticCurveTo(len * .46, -1.6, len * .56, 1); cx.stroke();                   // leaf engraving
      cx.fillStyle = '#1b2840'; cx.beginPath(); cx.ellipse(len - .2, 0, 1.2, 2.9, 0, 0, 7); cx.fill();                                                                       // dark mouth
      cx.fillStyle = SIL_L; cx.beginPath(); cx.moveTo(-.5, -2); cx.lineTo(-3, 0); cx.lineTo(-.5, 2); cx.closePath(); cx.fill(); cx.lineWidth = .9; cx.strokeStyle = OUT; cx.stroke();  // pointed bottom cap
    }
    cx.restore();
  }

  Characters.art('alaric', {
    // tall, lean, graceful: longer torso, narrow waist, small head, slim limbs. Bone lengths stay near default (legs + bow IK use them); hitbox is unchanged.
    body: {head:{r:R}, torso:{len:15.5, w:9}, uArm:{len:LEN, w:4.2}, fArm:{len:LEN, w:3.8}, hand:{r:2.6}, thigh:{len:10, w:5.2}, shin:{len:9.5, w:4.4}, foot:{len:8, w:3.6}, belt:3, shN:SHN, shF:SHF},
    colors: {shirt:WHT, limb:'#e8eef6', far:'#b7c3d3', head:SKIN, dark:'#33425c', hand:SKIN, legs:'#bcc7d6', legsFar:'#8996aa'},

    // the far (draw) arm is drawn over the body while he shoots, so you can see it at his cheek
    farFront: FF,

    // stiff while the arm is held on the aim, very stiff at the release, soft in the follow-through
    spring(p, A){
      const s = stateOf(p, A); if(!s) return;
      if(s.skill) return {k:420, d:30};
      if(p < s.c - .1) return {k:300, d:26};
      if(p < s.c + .1) return {k:520, d:34};
      return {k:200, d:22};
    },

    // relaxed carry: the bow hangs in the near hand, forward and low, barely swinging; the other arm swings freely
    pose(tg, f, t, run){
      tg.aN = .5 + tg.aN * .22; tg.eN = .85 + (tg.eN - .55) * .35;
      tg.lean += .02; tg.head += -.02;
    },

    attack(tg, p, A){
      const s = stateOf(p, A); if(!s) return;
      const j = aimJoints(s.phi, s.L), kick = K(p, [[s.c, 0], [s.c + .05, 1], [s.c + .3, 0]]);
      tg.aN = lerp(tg.aN, j.aN - kick * .12, s.mN); tg.eN = lerp(tg.eN, j.eN, s.mN);
      tg.aF = lerp(tg.aF, j.aF, s.mF); tg.eF = lerp(tg.eF, j.eF, s.mF);
      tg.lean = lerp(tg.lean, .03 - kick * .1, s.mN); tg.head = lerp(tg.head, -s.phi * .25 - .02, s.mN);
      tg.tN = lerp(tg.tN, .36, s.mN); tg.kN = lerp(tg.kN, .2, s.mN); tg.tF = lerp(tg.tF, -.3, s.mN); tg.kF = lerp(tg.kF, .2, s.mN);     // planted archer stance
    },

    // tunic, chest plate, quiver strap, neck + collar. Runs after the far arm / far leg, before the head.
    torso(cx, S, B, P, white){
      const f = CUR;
      if(f && !FF(f)) bracer(cx, S.aF, true, white);                      // far bracer sits on the far arm, under the torso
      cx.save(); cx.translate(S.pel.x, S.pel.y); cx.rotate(S.lean); cx.lineJoin = 'round';
      poly(cx, [[-1.8, -20.2], [1.8, -20.2], [2, -14.4], [-2, -14.4]], white ? '#fff' : SKIN, 1.2);                 // neck (bridges the torso and the head)
      poly(cx, [[-3.9, 0], [3.9, 0], [3.7, -4], [4.6, -10], [4.9, -14.2], [2.2, -15.8], [-2.2, -15.8], [-4.9, -14.2], [-4.6, -10], [-3.7, -4]], white ? '#fff' : WHT, 1.6);   // white tunic, narrow waist
      if(!white){
        // silver chest plate with a ridge, leaf engravings and a pale-blue trim
        const g = cx.createLinearGradient(0, -14, 0, -4); g.addColorStop(0, SIL_L); g.addColorStop(.6, SIL); g.addColorStop(1, SIL_D);
        poly(cx, [[-4.4, -14.4], [4.6, -14.4], [5, -9.6], [3.4, -5.6], [0, -4.2], [-3.4, -5.6], [-4.8, -9.6]], g, 1.1);
        cx.lineCap = 'round'; cx.strokeStyle = SIL_L; cx.lineWidth = .8; cx.beginPath(); cx.moveTo(0, -13.6); cx.lineTo(0, -5.4); cx.stroke();
        cx.strokeStyle = SIL_DD; cx.lineWidth = .6; cx.beginPath();
        cx.moveTo(0, -12.4); cx.quadraticCurveTo(2.8, -12, 3.8, -9.4); cx.moveTo(0, -10.2); cx.quadraticCurveTo(2.4, -9.8, 3.2, -7.4); cx.moveTo(0, -12.4); cx.quadraticCurveTo(-2.8, -12, -3.8, -9.4); cx.moveTo(0, -10.2); cx.quadraticCurveTo(-2.4, -9.8, -3.2, -7.4); cx.stroke();
        cx.strokeStyle = BLU; cx.lineWidth = .8; cx.beginPath(); cx.moveTo(-4.4, -14.1); cx.lineTo(4.6, -14.1); cx.stroke();
        // quiver strap: front shoulder -> back hip, with a small silver buckle
        cx.strokeStyle = OUT; cx.lineWidth = 2.8; cx.beginPath(); cx.moveTo(3.2, -14); cx.lineTo(-3.6, -4.4); cx.stroke();
        cx.strokeStyle = '#7f93ad'; cx.lineWidth = 1.5; cx.beginPath(); cx.moveTo(3.2, -14); cx.lineTo(-3.6, -4.4); cx.stroke();
        cx.fillStyle = SIL_L; cx.fillRect(-.4, -9.7, 2.2, 1.7); cx.lineWidth = .7; cx.strokeStyle = OUT; cx.strokeRect(-.4, -9.7, 2.2, 1.7);
      }
      poly(cx, [[-2.9, -14.6], [2.9, -14.6], [2.4, -16.6], [-2.4, -16.6]], white ? '#fff' : SIL, 1);        // collar
      cx.restore();
    },

    // knee-high silver boot + thigh armor, drawn right after each leg (so the far leg's gear stays behind the body)
    foot(cx, leg, P, white, f, far){
      const hip = leg.hip, kn = leg.knee, an = leg.ankle, col = white ? '#fff' : (far ? SIL_D : SIL);
      cap(cx, lp(hip, kn, .16), lp(hip, kn, .8), 6.2, col, 1.8);                                            // cuisse (thigh plate)
      if(!white){
        const a = lp(hip, kn, .24), b = lp(hip, kn, .7), c1 = lp(hip, kn, .78);
        cx.lineCap = 'round'; cx.strokeStyle = far ? SIL_DD : SIL_L; cx.lineWidth = .7; cx.beginPath(); cx.moveTo(a.x + 1.4, a.y); cx.lineTo(b.x + 1.4, b.y); cx.stroke();
        cx.strokeStyle = far ? BLU_D : BLU; cx.lineWidth = .8; cx.beginPath(); cx.moveTo(c1.x - 2.6, c1.y); cx.lineTo(c1.x + 2.6, c1.y); cx.stroke();
      }
      cx.fillStyle = white ? '#fff' : (far ? SIL_D : SIL_L); cx.beginPath(); cx.ellipse(kn.x + 1, kn.y, 2.5, 3.1, 0, 0, 7); cx.fill(); cx.lineWidth = 1; cx.strokeStyle = OUT; cx.stroke();   // knee guard
      // boot: tapered shaft from just under the knee to the ankle, cuff with a pale-blue line, pointed toe
      const top = lp(an, kn, .84);
      taper(cx, top, an, 5.6, 4.6, col, 1.2);
      const phi = leg.planted ? 0 : clamp(-leg.sa * .5, -.8, .8), lift = leg.planted ? clamp((leg.hip.x - an.x - 2) * .12, 0, 3.5) : 0;
      const a0 = {x:an.x - 1.5, y:an.y - lift}, b0 = {x:an.x + 6.5 * Math.cos(phi), y:an.y + 6.5 * Math.sin(phi)};
      taper(cx, a0, b0, 4, 2.6, col, 1.2);
      poly(cx, [[b0.x - .4, b0.y - 1.2], [b0.x + 2.6 * Math.cos(phi), b0.y + 2.6 * Math.sin(phi)], [b0.x - .4, b0.y + 1.2]], col, 1);                  // pointed toe
      if(!white){
        cx.strokeStyle = far ? BLU_D : BLU; cx.lineWidth = 1; cx.lineCap = 'round'; cx.beginPath(); cx.moveTo(top.x - 2.6, top.y + .2); cx.lineTo(top.x + 2.6, top.y + .2); cx.stroke();
        const m = lp(top, an, .5); cx.strokeStyle = far ? SIL_DD : SIL_L; cx.lineWidth = .6; cx.beginPath(); cx.moveTo(m.x + .9, m.y - 2); cx.lineTo(m.x + .9, m.y + 1.6); cx.stroke();
      }
    },

    // behind the body: quiver, long silver hair, short mantle on the far shoulder, a faint moonlight halo while he uses a skill
    behind(cx, f, t, S, P){
      CUR = f;
      const c = cloth(f, t, S), white = f.flash > 0, A = f.A || {};
      if(f.atk > 0 && A.skill){
        const g = cx.createRadialGradient(S.pel.x, S.pel.y - 8, 4, S.pel.x, S.pel.y - 8, 40);
        g.addColorStop(0, 'rgba(142,201,255,.28)'); g.addColorStop(1, 'rgba(142,201,255,0)'); cx.fillStyle = g; cx.beginPath(); cx.arc(S.pel.x, S.pel.y - 8, 40, 0, 7); cx.fill();
      }
      quiver(cx, S, white);
      // hair: three silky strands from the back of the head, reaching mid-back
      const hd = S.head, ang = Math.atan2(hd.x - S.sh.x, -(hd.y - S.sh.y)), ca = Math.cos(ang), sa = Math.sin(ang), w = 1 + Math.abs(c.run) * 2;
      const root = (lx, ly) => ({x:hd.x + lx * ca - ly * sa, y:hd.y + lx * sa + ly * ca});
      strip(cx, root(-R * .7, R * .5), c.h2, 16.5, 6.4, 3.2, HAIR_D, null, t, 1.4, w, white, 1.1);
      strip(cx, root(-R * .78, R * .15), c.h1, 18.5, 7.2, 3.8, HAIR, HAIR_L, t, 0, w, white, 1.1);
      strip(cx, root(-R * .6, R * .65), c.h3, 20, 2.8, 1.4, HAIR_L, null, t, 2.6, w + .4, white, .9);
      // short silver-white mantle on the far shoulder: three leaf-shaped lobes, not a cape
      const m0 = {x:S.sh.x - 4.6, y:S.sh.y + 1.2};
      strip(cx, m0, c.m - .06, 9, 5.2, 1.8, WHT_D, BLU, t, .7, 1.2, white, 1);
      strip(cx, {x:m0.x + 1.2, y:m0.y - .8}, c.m + .02, 10.5, 5.6, 1.8, WHT, BLU, t, 1.9, 1.2, white, 1);
      strip(cx, {x:m0.x + 2.4, y:m0.y - 1.4}, c.m + .12, 8, 4.6, 1.6, SIL_L, BLU, t, 3.1, 1.2, white, 1);
    },

    front(cx, f, t, S, P){
      CUR = f;
      const white = f.flash > 0, A = f.A || {}, c = cloth(f, t, S);
      const p = f.atk > 0 ? clamp(1 - f.atk / (A.time || .6), 0, 1) : 0;
      const st = f.atk > 0 && !(f.stun > 0) ? stateOf(p, A) : null;
      const cs = Math.cos(S.lean), sn = Math.sin(S.lean), at = (lx, ly) => ({x:S.pel.x + lx * cs - ly * sn, y:S.pel.y + lx * sn + ly * cs});

      // bow frame first: handW tells arena.js where the arrow leaves (the middle of the nocked arrow)
      const grip = S.aN.hand, idleTilt = .1 + c.run * .12 + Math.sin(t * 1.6) * .015;
      const th = st ? lerp(idleTilt, -st.phi, st.mN) : idleTilt, D = {x:Math.cos(th), y:Math.sin(th)};
      f.handW = {N:{x:f.x + f.face * (grip.x - D.x * 4), y:f.y + grip.y - D.y * 4}};

      // ---- sash (white, flowing, layered under the belt) + belt with a pale-blue gem ----
      strip(cx, at(-3.2, -1.2), c.s2, 10.5, 4.6, 3, WHT_D, null, t, 1.2, 1.3, white, 1);
      strip(cx, at(3, -1.4), c.s1, 12.5, 5.6, 4.4, WHT, BLU, t, 0, 1.3, white, 1.1);
      cx.save(); cx.translate(S.pel.x, S.pel.y); cx.rotate(S.lean); cx.lineJoin = 'round';
      cx.beginPath(); if(cx.roundRect) cx.roundRect(-4.5, -3.6, 9, 3.2, 1.1); else cx.rect(-4.5, -3.6, 9, 3.2);
      cx.fillStyle = white ? '#fff' : SIL; cx.fill(); cx.lineWidth = 1.2; cx.strokeStyle = OUT; cx.stroke();
      if(!white){
        cx.strokeStyle = SIL_L; cx.lineWidth = .6; cx.beginPath(); cx.moveTo(-4, -3.1); cx.lineTo(4, -3.1); cx.stroke();
        cx.fillStyle = SIL_L; cx.beginPath(); if(cx.roundRect) cx.roundRect(1.6, -4, 3.6, 4.2, 1); else cx.rect(1.6, -4, 3.6, 4.2); cx.fill(); cx.lineWidth = .9; cx.strokeStyle = OUT; cx.stroke();
      }
      gem(cx, 3.4, -1.9, 1.4, white);
      cx.restore();

      // ---- near arm: bracer, then the engraved pauldron on the shoulder ----
      bracer(cx, S.aN, false, white);
      pauldron(cx, S, white);

      // ---- head: face, ear, hair, braids, circlet (drawn in the head's own tilted space) ----
      const hd = S.head, ang = Math.atan2(hd.x - S.sh.x, -(hd.y - S.sh.y));
      cx.save(); cx.translate(hd.x, hd.y); cx.rotate(ang); cx.lineJoin = 'round'; cx.lineCap = 'round';
      cx.save(); cx.beginPath(); cx.arc(0, 0, R, 0, 7); cx.clip(); cx.fillStyle = white ? '#fff' : SKIN; cx.fillRect(-.2, -3.6, R + 2, 5); cx.restore();     // skin over the default visor
      if(!white){
        cx.beginPath(); cx.moveTo(R - .5, -.9); cx.lineTo(R + 1.3, 1.1); cx.lineTo(R - .4, 1.9); cx.closePath(); cx.fillStyle = SKIN; cx.fill(); cx.lineWidth = .9; cx.strokeStyle = OUT; cx.stroke();  // nose
        const ex = R * .5, ey = -1.2;
        cx.beginPath(); cx.moveTo(ex - 1.4, ey + .2); cx.quadraticCurveTo(ex, ey - 1.3, ex + 1.5, ey + .2); cx.quadraticCurveTo(ex, ey + 1, ex - 1.4, ey + .2); cx.fillStyle = '#f4faff'; cx.fill();
        cx.fillStyle = GREEN; cx.beginPath(); cx.arc(ex + .4, ey, .9, 0, 7); cx.fill(); cx.fillStyle = '#1a2a2a'; cx.beginPath(); cx.arc(ex + .5, ey, .42, 0, 7); cx.fill();
        cx.fillStyle = '#fff'; cx.fillRect(ex + .1, ey - .5, .45, .45);
        cx.strokeStyle = OUT; cx.lineWidth = .9; cx.beginPath(); cx.moveTo(ex - 1.5, ey + .25); cx.quadraticCurveTo(ex, ey - 1.4, ex + 1.6, ey + .25); cx.stroke();                              // upper lash line
        cx.strokeStyle = HAIR_D; cx.lineWidth = .9; cx.beginPath(); cx.moveTo(ex - 1.7, ey - 1.7); cx.quadraticCurveTo(ex + .3, ey - 2.5, ex + 2, ey - 1.9); cx.stroke();                          // calm brow
        cx.strokeStyle = '#b98b7c'; cx.lineWidth = .7; cx.beginPath(); cx.moveTo(R * .4, 2.7); cx.lineTo(R * .78, 2.55); cx.stroke();                                                          // mouth
      }
      // hair cap: covers the top + back, leaves the face and the ear region open
      cx.beginPath(); cx.moveTo(R * .8, -R * .55); cx.bezierCurveTo(R * .5, -R - 1.3, -R * .5, -R - 1.5, -R - .9, -1); cx.bezierCurveTo(-R - 1.3, R * .5, -R * .7, R + .6, -2.2, R * .75);
      cx.lineTo(-1.2, .6); cx.lineTo(-1, -1.8); cx.bezierCurveTo(-.2, -2.8, R * .4, -R * .62, R * .8, -R * .55); cx.closePath();
      cx.fillStyle = white ? '#fff' : HAIR; cx.fill(); cx.lineWidth = 1; cx.strokeStyle = OUT; cx.stroke();
      if(!white){
        cx.strokeStyle = HAIR_L; cx.lineWidth = .8; cx.beginPath(); cx.moveTo(R * .5, -R * .8); cx.quadraticCurveTo(-1, -R - .4, -R - .2, -R * .25); cx.stroke();
        cx.strokeStyle = HAIR_D; cx.lineWidth = .6; cx.beginPath(); cx.moveTo(1, -R * .7); cx.quadraticCurveTo(-2.4, -R * .4, -R, R * .1); cx.moveTo(-.6, -R * .9); cx.quadraticCurveTo(-3.8, -R * .6, -R - .4, -R * .1); cx.stroke();
        cx.fillStyle = SIL_L; cx.beginPath(); cx.ellipse(-R - .2, -.2, 1.1, 1.7, -.2, 0, 7); cx.fill(); cx.lineWidth = .8; cx.strokeStyle = OUT; cx.stroke();                              // half-up clasp
        cx.fillStyle = BLU; cx.beginPath(); cx.arc(-R - .2, -.2, .5, 0, 7); cx.fill();
        cx.beginPath(); cx.moveTo(-.5, -2.3); cx.quadraticCurveTo(-3.2, -4.8, -8, -6.2); cx.quadraticCurveTo(-5.2, -2.6, -3.6, .1); cx.quadraticCurveTo(-2, 1.3, -.5, .8); cx.closePath();       // pointed ear
        cx.fillStyle = SKIN; cx.fill(); cx.lineWidth = .9; cx.strokeStyle = OUT; cx.stroke();
        cx.strokeStyle = SKIN_D; cx.lineWidth = .6; cx.beginPath(); cx.moveTo(-1.4, -1.4); cx.quadraticCurveTo(-3.8, -3, -6.2, -4.6); cx.stroke();
        const br = [[1.6, -3.9], [.2, -3.3], [-1.1, -2.3], [-2.1, -.7], [-2.9, 1.1], [-3.4, 2.9]];                                                                                          // temple braid
        br.forEach((q, i) => { cx.save(); cx.translate(q[0], q[1]); cx.rotate(i * .5 - .8); cx.fillStyle = i % 2 ? HAIR_L : HAIR; cx.beginPath(); cx.ellipse(0, 0, 1.45, .95, 0, 0, 7); cx.fill(); cx.lineWidth = .6; cx.strokeStyle = HAIR_D; cx.stroke(); cx.restore(); });
        cx.fillStyle = SIL_L; cx.beginPath(); cx.arc(-3.6, 3.9, .9, 0, 7); cx.fill(); cx.lineWidth = .7; cx.strokeStyle = OUT; cx.stroke();                                                   // silver bead
        cx.beginPath(); cx.moveTo(R * .82, -R * .6); cx.quadraticCurveTo(-.5, -R * .82, -R * .94, -R * .36);                                                                                // circlet
        cx.strokeStyle = OUT; cx.lineWidth = 2.2; cx.stroke(); cx.strokeStyle = SIL_L; cx.lineWidth = 1.1; cx.stroke();
        cx.fillStyle = BLU; cx.beginPath(); cx.moveTo(R * .82 + .1, -R * .6 - 1.4); cx.lineTo(R * .82 + 1.2, -R * .6); cx.lineTo(R * .82 + .1, -R * .6 + 1.4); cx.lineTo(R * .82 - 1, -R * .6); cx.closePath(); cx.fill(); cx.lineWidth = .7; cx.strokeStyle = OUT; cx.stroke();
        cx.fillStyle = BLU_L; cx.fillRect(R * .82 - .3, -R * .6 - .8, .6, .6);
      }
      cx.restore();

      // ---- moonstone pendant on a fine chain (the royal heirloom), on the upper chest ----
      if(!white){
        cx.save(); cx.translate(S.sh.x, S.sh.y); cx.rotate(S.lean);
        cx.strokeStyle = SIL_L; cx.lineWidth = .7; cx.beginPath(); cx.moveTo(-1.6, -1.2); cx.quadraticCurveTo(2.6, .8, 2.8, 4.4); cx.stroke();
        cx.fillStyle = BLU_L; cx.beginPath(); cx.moveTo(2.8, 3.4); cx.quadraticCurveTo(4.6, 5.6, 2.8, 7.4); cx.quadraticCurveTo(1, 5.6, 2.8, 3.4); cx.fill(); cx.lineWidth = .8; cx.strokeStyle = OUT; cx.stroke();
        cx.fillStyle = '#fff'; cx.fillRect(2.3, 4.6, .7, .9); cx.restore();
      }

      // ---- bow, string, nocked arrow, hands ----
      const sk = st ? (st.skill ? clamp(1 - st.since * 1.6, 0, 1) : clamp((st.L - 3) / 13, 0, 1)) : 0;
      const handF = S.aF.hand, dx = handF.x - grip.x, dy = handF.y - grip.y, ct = Math.cos(th), stt = Math.sin(th);
      const lx = dx * ct + dy * stt, ly = -dx * stt + dy * ct;                      // draw hand in the bow's own frame
      const holding = !!(st && st.nocked && st.mF > .3), hk = st ? clamp((st.L - 3) / 6, 0, 1) : 0;
      const pull = holding ? clamp(-lx - 1.2, 0, 22) * hk : 0, nockY = holding ? ly * hk : 0;
      const vib = st && st.since > 0 ? Math.exp(-st.tsec * 16) * Math.sin(st.tsec * 110) * 2.4 : 0;
      cx.save(); cx.translate(grip.x, grip.y); cx.rotate(th);
      drawBow(cx, pull, nockY, vib, .35 + .65 * sk, white, t);
      if(holding){                                                               // nocked arrow: from the nock to just past the grip
        cx.save(); cx.translate(-1.2 - pull, nockY); cx.rotate(Math.atan2(-nockY, 1.2 + pull + 8)); arrowShape(cx, 0, 24, white, false); cx.restore();
      }
      cx.beginPath(); if(cx.roundRect) cx.roundRect(-1.7, -4.6, 3.6, 9.2, 1.2); else cx.rect(-1.7, -4.6, 3.6, 9.2);        // riser: grip wrap + gem
      cx.fillStyle = white ? '#fff' : WHT; cx.fill(); cx.lineWidth = 1.1; cx.strokeStyle = OUT; cx.stroke();
      if(!white){ cx.fillStyle = BLU; cx.fillRect(-1.7, -1.6, 3.6, .8); cx.fillRect(-1.7, 1.8, 3.6, .8); gem(cx, .2, -3.3, 1.1, false); }
      cx.restore();
      cx.fillStyle = OUT; cx.beginPath(); cx.arc(grip.x - .5, grip.y, 3.5, 0, 7); cx.fill();                                // the hand closes over the grip
      cx.fillStyle = white ? '#fff' : SKIN; cx.beginPath(); cx.arc(grip.x - .5, grip.y, 2.6, 0, 7); cx.fill();
      if(!white){ cx.strokeStyle = SKIN_D; cx.lineWidth = .6; cx.beginPath(); cx.moveTo(grip.x - .2, grip.y - 1.4); cx.lineTo(grip.x + 1.6, grip.y - 1.2); cx.moveTo(grip.x - .2, grip.y + .2); cx.lineTo(grip.x + 1.7, grip.y + .3); cx.stroke(); }

      // ---- draw arm: bracer on top while it is over the body, hand hooked on the string ----
      if(FF(f)){
        bracer(cx, S.aF, false, white);
        cx.fillStyle = OUT; cx.beginPath(); cx.arc(handF.x, handF.y, 3.5, 0, 7); cx.fill();
        cx.fillStyle = white ? '#fff' : SKIN; cx.beginPath(); cx.arc(handF.x, handF.y, 2.6, 0, 7); cx.fill();
      }
    },

    // the arrow in flight (arena.js calls this; s = {x, y, vx, vy, r, age, kind}). s.x,s.y = the MIDDLE of the arrow. kind 'skill' = Precision Shot, 2 = the heavy third arrow.
    shot(cx, s, t){
      const ang = Math.atan2(s.vy || 0, s.vx), skill = s.kind === 'skill', heavy = s.kind === 2, len = skill ? 34 : heavy ? 28 : 24, tail = skill ? 170 : heavy ? 100 : 60;
      cx.save(); cx.translate(s.x, s.y); cx.rotate(ang);
      const w = skill ? 2.6 : heavy ? 2.1 : 1.5, g = cx.createLinearGradient(0, 0, -tail, 0);                    // moonlight trail
      g.addColorStop(0, 'rgba(217,239,255,' + (skill ? .8 : .6) + ')'); g.addColorStop(.4, 'rgba(142,201,255,.3)'); g.addColorStop(1, 'rgba(142,201,255,0)');
      cx.fillStyle = g; cx.beginPath(); cx.moveTo(-len * .4, -w); cx.lineTo(-tail, -w * .15); cx.lineTo(-tail, w * .15); cx.lineTo(-len * .4, w); cx.closePath(); cx.fill();
      if(skill){ cx.shadowColor = '#9fd6ff'; cx.shadowBlur = 12; }
      arrowShape(cx, -len / 2, len / 2, false, skill || heavy);
      cx.shadowBlur = 0;
      if(skill || heavy){ cx.strokeStyle = 'rgba(217,239,255,' + (.5 + .3 * Math.sin(t * 40)) + ')'; cx.lineWidth = .8; cx.beginPath(); cx.moveTo(-len / 2 + 2, 0); cx.lineTo(len / 2 - 4, 0); cx.stroke(); }
      cx.restore();
    }
  });
})();