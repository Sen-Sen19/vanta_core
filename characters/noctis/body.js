// body.js - default ragdoll body + the hooks that character art.js files plug into.
// Drawing + pose only. It never touches physics, hitboxes, input or damage.
// Call: Body.draw(ctx, fighter, G.t). A character can change sizes/colors or add parts in characters/<id>/art.js.
//
// Parts (all drawn as round capsules):
//   head, torso, upper arm x2, forearm(+hand) x2, thigh x2, shin x2, foot x2
// Each joint is a small spring, so limbs lag and swing a bit (ragdoll feel).
const Body = (() => {

  // ---- DEFAULT SIZES. Whole body is about 52 px tall = the fighter hitbox height. ----
  // A character overrides only what it needs with `body:{...}` in its art.js.
  const BODY = {
    head:  {r:6.5},
    torso: {len:12, w:11},
    uArm:  {len:9,  w:4.6},
    fArm:  {len:9,  w:4.2},
    hand:  {r:3},
    thigh: {len:10, w:6},
    shin:  {len:9.5, w:5},
    foot:  {len:8,  w:3.6},
    outline:'#0b0f1c', outlineW:1.6
  };

  // ---- spring settings per situation: k = stiffness, d = damping (low d = floppy) ----
  const SPRING = {
    normal:{k:150, d:17},
    air:   {k:110, d:13},
    attack:{k:420, d:32},
    hurt:  {k:45,  d:4.5}
  };

  const JOINTS = ['lean','head','aN','eN','aF','eF','tN','kN','tF','kF'];
  // angle meaning: 0 = limb hangs straight down, + = swings forward. lean: + = torso leans forward.
  // eN/eF = elbow bend (forearm turns forward). kN/kF = knee bend (shin turns backward).

  const lerp  = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease  = t => t * t * (3 - 2 * t);
  function keys(p, k){                     // smooth value along keyframes [[time,value],...]
    if(p <= k[0][0]) return k[0][1];
    for(let i = 1; i < k.length; i++){
      if(p <= k[i][0]){ const [p0, v0] = k[i-1], [p1, v1] = k[i]; return lerp(v0, v1, ease((p - p0) / (p1 - p0))); }
    }
    return k[k.length-1][1];
  }
  function mixPose(a, b, t){ const o = {}; JOINTS.forEach(j => o[j] = lerp(a[j], b[j], t)); return o; }

  // ---- per-character sizes + colors (cached by character id) ----
  const HEXRE = /^#[0-9a-f]{6}$/i;
  function rgb(h){ const n = parseInt((HEXRE.test(h) ? h : '#8899aa').slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function mix(a, b, t){ const A = rgb(a), B = rgb(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], t))).join(',')})`; }

  const cache = {};
  function look(c){
    if(cache[c.id]) return cache[c.id];
    const art = Characters.artOf(c.id), B = {...BODY};
    for(const k in (art.body || {})) B[k] = typeof BODY[k] === 'object' ? {...BODY[k], ...art.body[k]} : art.body[k];
    const P = {shirt:c.color, limb:mix(c.color, '#000000', .38), far:mix(c.color, '#000000', .55),
               head:mix(c.color, '#ffffff', .38), dark:'#1b2038', ...(art.colors || {})};
    return cache[c.id] = {art, B, P};
  }

  // ---- state kept on the fighter: f.rig ----
  function rigOf(f){
    if(!f.rig){
      f.rig = {last:null, phase:0, py:-21, j:{}};
      JOINTS.forEach(k => f.rig.j[k] = {a:0, v:0});
    }
    return f.rig;
  }

  // ---- target poses ----
  function idlePose(t){
    const b = Math.sin(t * 2.2);
    return {lean:.05 + b*.02, head:Math.sin(t*2.2 + .8)*.03,
            aN:.15 + b*.04, eN:.55, aF:-.1 - b*.04, eF:.5,
            tN:.26, kN:.24, tF:-.2, kF:.22};
  }
  function runPose(ph){
    const s = Math.sin(ph), c = Math.cos(ph);
    return {lean:.22, head:-.06,
            aN:-s*.95, eN:1.15 + .3*c, aF:s*.95, eF:1.15 - .3*c,
            tN:s*.95 + .1, kN:.25 + 1.05*Math.max(0, c),
            tF:-s*.95 + .1, kF:.25 + 1.05*Math.max(0, -c)};
  }
  const RISE = {lean:.1,  head:-.05, aN:2.4, eN:.5, aF:1.9,  eF:.7, tN:.7,  kN:1.0, tF:-.25, kF:.6};
  const FALL = {lean:.05, head:-.1,  aN:1.3, eN:.4, aF:-1.0, eF:.4, tN:.35, kN:.4,  tF:-.35, kF:.3};

  function attackOverlay(tg, p){           // p: 0 -> 1 across the swing (hit window is about .25 - .8)
    tg.aN   = keys(p, [[0,.2], [.18,-.55], [.4,1.45], [.7,1.5], [1,.3]]);   // punching arm swings back, then drives forward
    tg.eN   = keys(p, [[0,.9], [.18,2.1],  [.4,.25],  [.7,.2],  [1,1.1]]);  // elbow folds, then extends (never fully locked)
    tg.lean = keys(p, [[0,.05],[.18,-.18], [.4,.38],  [.7,.3],  [1,.1]]);
    tg.head = -tg.lean * .4;
    tg.aF = keys(p, [[0,.5], [.2,.8], [.45,.35], [1,.6]]);                  // back hand guards, pulls in on the punch
    tg.eF = keys(p, [[0,1.7],[.2,2.0],[.45,2.1], [1,1.8]]);
    tg.tN = keys(p, [[0,.25],[.2,.05], [.4,.75],  [.7,.7],  [1,.3]]);       // front leg steps in
    tg.kN = keys(p, [[0,.25],[.2,.5],  [.4,.45],  [.7,.4],  [1,.25]]);
    tg.tF = keys(p, [[0,-.2],[.2,-.45],[.4,-.55], [.7,-.5], [1,-.25]]);     // back leg pushes off
    tg.kF = keys(p, [[0,.2], [.2,.15], [.4,.1],   [.7,.15], [1,.2]]);
  }
  function hurtPose(f, t){
    const hs = f.vx * f.face >= 0 ? 1 : -1;   // flying forward (+) or backward (-) in body space
    const fl = Math.sin(t * 34);
    return {lean:.5*hs, head:-.4*hs + fl*.15,
            aN:-1.6*hs + fl*.4, eN:.6, aF:-1.2*hs - fl*.4, eF:.8,
            tN:-.5*hs + fl*.3, kN:.5, tF:.5*hs - fl*.3, kF:.6};
  }

  // ---- step the springs ----
  function step(f, r, t){
    const first = r.last == null, dt = first ? 0 : clamp(t - r.last, 0, .05);
    r.last = t;

    const air = !f.gr, hurt = f.stun > 0, atk = f.atk > 0;
    const run = clamp(Math.abs(f.vx) / 170, 0, 1);
    r.phase += dt * Math.abs(f.vx) * .055;

    let tg, sp = SPRING.normal;
    if(hurt){ tg = hurtPose(f, t); sp = SPRING.hurt; }
    else if(air){ tg = mixPose(RISE, FALL, clamp((f.vy + 300) / 600, 0, 1)); sp = SPRING.air; }
    else tg = mixPose(idlePose(t), runPose(r.phase), run);
    const po = Characters.artOf(f.c.id).pose;
    if(po && !hurt && !air) sp = po(tg, f, t, run, keys) || sp;     // a character can reshape its idle / walk stance: art.js pose(tg, f, t, run, keys) -> optional {k, d}
    const ar = Characters.artOf(f.c.id);
    if(hurt && ar.hurt) sp = ar.hurt(tg, f, t, keys) || sp;                 // optional: art.js hurt(tg, f, t, keys) = knockback pose -> optional {k, d}
    if(air && !hurt && ar.air) sp = ar.air(tg, f, t, keys) || sp;           // optional: art.js air(tg, f, t, keys) = jump / fall pose -> optional {k, d}
    if(atk && !hurt){
      const p = clamp(1 - f.atk / (f.A ? f.A.time : .28), 0, 1), ao = Characters.artOf(f.c.id).attack;
      if(ao) ao(tg, p, f.A || {}, keys); else attackOverlay(tg, p);   // a character can bring its own punch poses: art.js attack(tg, p, A, keys)
      sp = SPRING.attack;
      const so = Characters.artOf(f.c.id).spring; if(so) sp = so(p, f.A || {}) || sp;   // a character can set its own spring per phase: art.js spring(p, A) -> {k, d}
    }

    const n = 2, h = dt / n;                 // 2 small steps = stable springs
    for(let i = 0; i < n; i++){
      JOINTS.forEach(k => {
        const j = r.j[k];
        j.v += (sp.k * (tg[k] - j.a) - sp.d * j.v) * h;
        j.a += j.v * h;
      });
    }
    if(first) JOINTS.forEach(k => r.j[k].a = tg[k]);      // first frame only: start in pose (NOT during hit-stop, where dt is 0 too)
    return dt;
  }

  // ---- forward kinematics. Local space: x = forward, y = down, origin = feet on the ground. ----
  const dirv = (a, len) => ({x:Math.sin(a) * len, y:Math.cos(a) * len});
  const add = (p, q) => ({x:p.x + q.x, y:p.y + q.y});

  function skeleton(f, r, dt, B){
    const J = r.j;
    const leg = (th, kn) => {
      const knee = dirv(th, B.thigh.len), sa = th - kn, ankle = add(knee, dirv(sa, B.shin.len));
      return {knee, ankle, sa};
    };
    const lN = leg(J.tN.a, J.kN.a), lF = leg(J.tF.a, J.kF.a);
    // pelvis height: on the ground the lowest foot touches the ground, in the air it hangs
    const maxAnkle = Math.max(lN.ankle.y, lF.ankle.y);
    const wantY = f.gr ? -(maxAnkle + B.foot.w / 2) : -(B.thigh.len + B.shin.len + B.foot.w / 2 - 2);
    r.py += (wantY - r.py) * (dt > 0 ? Math.min(1, dt * 22) : 1);
    const pel = {x:0, y:r.py};

    const lean = J.lean.a;
    const sh = {x:pel.x + Math.sin(lean) * B.torso.len, y:pel.y - Math.cos(lean) * B.torso.len};
    const ha = lean + J.head.a, hd = B.torso.w / 2 + B.head.r - 1;
    const head = {x:sh.x + Math.sin(ha) * hd, y:sh.y - Math.cos(ha) * hd};

    const arm = (a, e, ox) => {
      const s = {x:sh.x + ox, y:sh.y}, el = add(s, dirv(a, B.uArm.len)), hand = add(el, dirv(a + e, B.fArm.len));
      return {s, el, hand};
    };
    const legAt = l => ({hip:pel, knee:add(pel, l.knee), ankle:add(pel, l.ankle), sa:l.sa,
                         planted:f.gr && l.ankle.y >= maxAnkle - 1.5});
    return {pel, sh, head, lean, aN:arm(J.aN.a, J.eN.a, .5), aF:arm(J.aF.a, J.eF.a, -1.5), lN:legAt(lN), lF:legAt(lF)};
  }

  // ---- drawing helpers ----
  function capsule(cx, a, b, w, col){
    cx.lineCap = 'round'; cx.lineJoin = 'round';
    cx.strokeStyle = col; cx.lineWidth = w;
    cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); cx.stroke();
  }
  function seg(cx, B, a, b, w, col, white){
    capsule(cx, a, b, w + B.outlineW * 2, B.outline); capsule(cx, a, b, w, white ? '#fff' : col);
  }
  function limb(cx, B, p0, p1, p2, w1, w2, col, white){   // p1 = elbow / knee
    seg(cx, B, p0, p1, w1, col, white); seg(cx, B, p1, p2, w2, col, white);
    if(!white){ cx.strokeStyle = 'rgba(0,0,0,.35)'; cx.lineWidth = 1; cx.beginPath(); cx.arc(p1.x, p1.y, Math.min(w1, w2) * .3, 0, 7); cx.stroke(); }   // joint ring
  }
  function foot(cx, B, leg, col, white){
    const phi = leg.planted ? 0 : clamp(-leg.sa * .5, -.8, .8);
    const lift = leg.planted ? clamp((leg.hip.x - leg.ankle.x - 2) * .12, 0, 3.5) : 0;   // heel up at push-off
    const a = {x:leg.ankle.x - 1.5, y:leg.ankle.y - lift};
    const b = {x:leg.ankle.x + (B.foot.len - 1.5) * Math.cos(phi), y:leg.ankle.y + (B.foot.len - 1.5) * Math.sin(phi)};
    capsule(cx, a, b, B.foot.w + B.outlineW * 2, B.outline);
    capsule(cx, a, b, B.foot.w, white ? '#fff' : col);
  }
  function hand(cx, B, p, col, white){
    cx.fillStyle = B.outline; cx.beginPath(); cx.arc(p.x, p.y, B.hand.r + B.outlineW, 0, 7); cx.fill();
    cx.fillStyle = white ? '#fff' : col; cx.beginPath(); cx.arc(p.x, p.y, B.hand.r, 0, 7); cx.fill();
  }

  // ---- main entry ----
  function draw(cx, f, t){
    const {art, B, P} = look(f.c);
    if(art.draw){ art.draw(cx, f, t); return; }            // full custom art (sprite) replaces the ragdoll

    const r = rigOf(f), dt = step(f, r, t), S = skeleton(f, r, dt, B), white = f.flash > 0;

    cx.save();
    cx.translate(f.x, f.y);
    cx.scale(f.face, 1);                                   // flip to face left/right

    if(f.gr){ cx.fillStyle = 'rgba(0,0,0,.28)'; cx.beginPath(); cx.ellipse(0, 1, 14, 3, 0, 0, 7); cx.fill(); }

    if(art.behind){ cx.save(); art.behind(cx, f, t, S, P); cx.restore(); }

    // back to front: far arm, far leg, torso, head, near leg, near arm
    const farFront = art.farFront && art.farFront(f);      // far arm punching: draw it over the body so you can see it
    if(!farFront){ limb(cx, B, S.aF.s, S.aF.el, S.aF.hand, B.uArm.w, B.fArm.w, P.far, white); hand(cx, B, S.aF.hand, P.hand || P.dark, white); }
    limb(cx, B, S.lF.hip, S.lF.knee, S.lF.ankle, B.thigh.w, B.shin.w, P.legsFar || P.far, white); foot(cx, B, S.lF, P.dark, white);

    if(art.torso) art.torso(cx, S, B, P, white);            // custom torso shape (art.js torso(cx, S, B, P, white))
    else { capsule(cx, S.pel, S.sh, B.torso.w + B.outlineW * 2, B.outline);
    capsule(cx, S.pel, S.sh, B.torso.w, white ? '#fff' : P.shirt); }
    // belt / pelvis band so the legs read as joined to the body
    cx.fillStyle = white ? '#fff' : P.dark; cx.beginPath(); cx.arc(S.pel.x, S.pel.y, B.torso.w * .38, 0, 7); cx.fill();

    cx.fillStyle = B.outline; cx.beginPath(); cx.arc(S.head.x, S.head.y, B.head.r + B.outlineW, 0, 7); cx.fill();
    cx.fillStyle = white ? '#fff' : P.head; cx.beginPath(); cx.arc(S.head.x, S.head.y, B.head.r, 0, 7); cx.fill();
    // visor (looks forward)
    cx.save(); cx.translate(S.head.x, S.head.y); cx.rotate(S.lean + r.j.head.a);
    cx.fillStyle = B.outline; cx.beginPath();
    if(cx.roundRect) cx.roundRect(.5, -3, B.head.r + .1, 3.6, 1.6); else cx.rect(.5, -3, B.head.r + .1, 3.6);
    cx.fill();
    cx.fillStyle = white ? '#fff' : P.shirt; cx.fillRect(B.head.r - 2.3, -2, 2, 1.4);
    cx.restore();

    if(farFront){ limb(cx, B, S.aF.s, S.aF.el, S.aF.hand, B.uArm.w, B.fArm.w, P.limb, white); hand(cx, B, S.aF.hand, P.hand || P.dark, white); }
    limb(cx, B, S.lN.hip, S.lN.knee, S.lN.ankle, B.thigh.w, B.shin.w, P.legs || P.limb, white); foot(cx, B, S.lN, P.dark, white);
    limb(cx, B, S.aN.s, S.aN.el, S.aN.hand, B.uArm.w, B.fArm.w, P.limb, white); hand(cx, B, S.aN.hand, P.hand || P.dark, white);

    if(art.front){ cx.save(); art.front(cx, f, t, S, P); cx.restore(); }

    cx.restore();
  }

  return {draw, capsule, BODY, keys};
})();