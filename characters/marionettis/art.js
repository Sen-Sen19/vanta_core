// MARIONETTIS art - the String Master. Same shared ragdoll (body.js): small size changes, red coat, top hat, short cape.
// The PUPPET is also made here. arena.js has no puppet, so this file keeps the puppet state on the fighter (f.pup),
// moves it and checks its hit once per frame inside front(), using the game clock G.t (so pause and hit-stop work). It calls hurt() from arena.js for damage.
// Hooks used: body, colors, spring(), attack() = his hand moves like a puppeteer, pose() = hand held forward holding the strings,
//             behind() = cape, front() = hat, bow tie, strings, puppet.
// Numbers (damage, reach, beast time) are in skills.js. Timing of the puppet moves (SHAPE below) uses the same progress p as skills.js.
(() => {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const K = (p, k) => Body.keys(p, k);
  const CP = .3;                                   // focus freeze point = chargeP in skills.js
  const OUT = '#1a0a14', GOLD = '#ffd479';
  const LEGL = 6, TORL = 7, HR = 3.3, ARML = 3.8;  // puppet size at scale 1 (about 22 px tall)

  const hexRGB = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const mixc = (a, b, t) => { const A = hexRGB(a), B = hexRGB(b); return 'rgb(' + A.map((v, i) => Math.round(lerp(v, B[i], t))).join(',') + ')'; };
  let _sk = null;
  const SK = () => _sk || (_sk = Characters.skillsOf('marionettis').basic);

  // ---- HIS HAND: near arm gestures, one per combo step. p = 0..1 over the swing. ----
  const ARM = [
    { // 1 jab: near hand lifts and flicks forward, far hand follows a beat later (two control bars)
      aN:[[0,.5],[.2,1.1],[.3,1.5],[.4,2.0],[.5,1.7],[.75,1.1],[1,.5]], eN:[[0,.7],[.3,.8],[.42,.3],[.75,.6],[1,.7]], lean:[[0,.05],[.3,-.1],[.42,.2],[.75,.1],[1,.05]],
      aF:[[0,-.15],[.25,.6],[.38,1.3],[.48,1.75],[.58,1.5],[.78,.8],[1,-.15]], eF:[[0,.5],[.3,.8],[.46,.35],[.78,.6],[1,.5]]
    },
    { // 2 spin: both hands high, both wrists twirl
      aN:[[0,.5],[.3,2.2],[.5,2.5],[.75,2.2],[.9,1.2],[1,.5]], eN:[[0,.7],[.3,.5],[.75,.5],[1,.7]], lean:[[0,.05],[.3,-.05],[.6,.1],[1,.05]],
      aF:[[0,-.15],[.3,2.0],[.5,2.3],[.75,2.0],[.9,1.0],[1,-.15]], eF:[[0,.5],[.3,.5],[.75,.5],[1,.5]]
    },
    { // 3 slam (also the let-go slam): both hands high, then yanked down together
      aN:[[0,.5],[.3,2.6],[.5,2.7],[.62,.7],[.8,.6],[1,.5]], eN:[[0,.7],[.3,.4],[.5,.35],[.62,.2],[1,.7]], lean:[[0,.05],[.3,-.12],[.5,-.15],[.62,.3],[.8,.2],[1,.05]],
      aF:[[0,-.15],[.3,2.45],[.5,2.6],[.62,.55],[.8,.45],[1,-.15]], eF:[[0,.5],[.3,.45],[.5,.4],[.62,.25],[1,.5]]
    }
  ];

  // ---- PUPPET MOVES. kx = how far along the dash (0..1) at progress p, ly = lift (jump height px), spin = turns. Dash starts after CP. ----
  const SHAPE = [
    {kx:[[CP,0],[.38,0],[.5,1],[1,1]],   ly:[[CP,0],[1,0]],                           spin:null},                  // 1 jab
    {kx:[[CP,0],[.38,.05],[.72,1],[1,1]], ly:[[CP,0],[.4,3],[.6,3],[.75,0],[1,0]],    spin:[[.34,0],[.72,1]]},       // 2 spin
    {kx:[[CP,0],[.42,.05],[.58,1],[1,1]], ly:[[CP,0],[.42,0],[.5,32],[.6,0],[1,0]],   spin:null}                   // 3 leap slam (and the beast slam)
  ];

  // ---- state on the fighter ----
  function init(f){
    return f.pup = {x:f.x + f.face * SK().string.follow, y:f.y, vx:0, dir:f.face, plat:null, tp:null, hop:null, air:0, t:G.t, lastAtk:0, mode:'follow', sc:1, ph:0,
      hit:true, fx:false, focus:false, rel:false, cl:0, bsc:1, beastUntil:0, beastDur:1, beastCd:0, step:0, xs:0, xe:0, dashSet:false,
      an:{legF:0, legB:0, armF:0, armB:0, bend:.4, lean:0, head:0, crouch:0, lift:0, sx:1, weapon:0, spin:0}};
  }
  const onPlat = (y, x) => G.P.some(q => Math.abs(q.y - y) < 3 && x > q.x - 4 && x < q.x + q.w + 4);

  // a hop: the strings lift the puppet along an arc to another platform (no teleport)
  function startHop(P, tp, x1){
    const dist = Math.hypot(x1 - P.x, tp.y - P.y);
    P.hop = {x0:P.x, y0:P.y, x1, y1:tp.y, pl:tp, t:0, T:clamp(dist / 320, .5, 1.1), h:22 + Math.max(0, P.y - tp.y) * .35};
  }

  // the puppet hit check (same job as the melee box in arena.js). Calls hurt() from arena.js.
  function strike(f, P, A, pu, o){
    if(P.hit || o.inv > 0 || G.over) return;
    const w = pu.w * P.sc, h = pu.h * P.sc + 6, bx = P.x + P.dir * w * .25, by = P.y - P.an.lift;
    if(Math.abs(o.x - bx) < w / 2 + o.w / 2 && by - h < o.y && by > o.y - o.h){
      P.hit = true;
      const b = SK().beast, bf = clamp((P.sc - 1) / (b.scale - 1), 0, 1);
      const A2 = (bf > .05 && !P.rel) ? {...A, dmg:A.dmg * (1 + (b.dmg - 1) * bf), kbx:(A.kbx ?? 1) * (1 + .15 * bf), noShake:true, hitstop:(A.hitstop || 0) + .04 * bf} : {...A, noShake:true};
      hurt(o, {c:f.c, A:A2, face:o.x >= P.x ? 1 : -1});
    }
  }

  // one step of the puppet: start / end of a swing, focus, beast timer, walking / hopping, leash, hit check, and the pose numbers for drawing
  function tick(f){
    const P = f.pup || init(f), SKB = SK(), St = SKB.string, bc = SKB.beast, o = foeOf(f), an = P.an;
    const dt = clamp(G.t - P.t, 0, .05); P.t = G.t;
    if(f.gr){ const pl = G.P.find(q => Math.abs(q.y - f.y) < 3 && f.x > q.x - 6 && f.x < q.x + q.w + 6); if(pl) P.tp = pl; }   // tp = the platform HE stands on (where the puppet should be)
    if(!P.tp) P.tp = G.P[0];
    if(!P.plat){ P.plat = P.tp; P.y = P.tp.y; }                      // plat = the platform the PUPPET is on
    const A = f.A || {}, bfNow = clamp((P.sc - 1) / (bc.scale - 1), 0, 1), leash = St.leash * (1 + .25 * bfNow);

    if(P.hop){                                                       // moving along the hop arc
      const h = P.hop; h.t += dt; const s = clamp(h.t / h.T, 0, 1);
      P.x = lerp(h.x0, h.x1, s); P.y = lerp(h.y0, h.y1, s) - 4 * h.h * s * (1 - s);
      if(s >= 1){ P.plat = h.pl; P.y = h.pl.y; P.x = h.x1; P.hop = null; }
    }else P.y = P.plat.y;

    // which way to face: toward the enemy if he is in string range and about the same height, else the way he faces
    const aim = () => (Math.abs(o.y - P.plat.y) < 90 && Math.abs(o.x - f.x) < leash + 50) ? (o.x >= P.x ? 1 : -1) : f.face;

    const rising = f.atk > P.lastAtk + 1e-4; P.lastAtk = f.atk;
    if(f.stun > 0 || f.atk <= 0){ if(P.mode === 'atk') P.mode = 'follow'; P.focus = false; }
    else if(rising && A.pup){                                         // a new swing starts: the puppet starts its move
      Object.assign(P, {mode:'atk', step:A.step || 0, dir:aim(), hit:false, fx:false, dashSet:false, rel:false, focus:false, cl:0, xs:P.x, xe:P.x});
    }

    // reset the pose, then fill it for the current move
    Object.assign(an, {legF:0, legB:0, armF:0, armB:0, bend:.4, lean:0, head:0, crouch:0, lift:0, sx:1, weapon:0, spin:0});

    if(P.mode === 'atk'){
      const p = clamp(1 - f.atk / A.time, 0, 1);
      if(f.charging){ P.focus = true; P.cl = A.cl || 0; }
      else if(P.focus){                                              // ATK let go
        P.focus = false;
        if((A.cl || 0) > 0){
          P.rel = true;
          if(G.t >= P.beastCd){                                      // beast: size, time and power follow how long he held (cl 0..1)
            P.bsc = 1 + (bc.scale - 1) * A.cl; P.beastDur = lerp(bc.min, bc.max, A.cl); P.beastUntil = G.t + P.beastDur; P.beastCd = P.beastUntil + bc.cd;
            G.rings.push({x:P.x, y:P.y - 12 * P.sc, life:.25});
            for(let i = 0; i < 6 + 8 * A.cl; i++) G.parts.push({x:P.x, y:P.y - 8, vx:(Math.random() - .5) * 520, vy:(Math.random() - .8) * 320, life:.45, col:'#efe3c8'});   // cotton stuffing bursts out
          }
        }
      }
      const st = P.rel ? 2 : P.step, sh = SHAPE[st], pu = P.rel ? bc.slam : A.pup;
      const reachMul = 1 + (bc.reach - 1) * bfNow;

      if(!P.dashSet && !f.charging && !P.hop && p >= CP + .001){     // decide where the puppet runs to: turns to the enemy, stops at him, never farther than the string
        P.dir = aim();
        let d = pu.dash * reachMul, cross = false;
        const gap = (o.x - P.x) * P.dir - (o.w / 2 + pu.w * P.sc * .45);
        if(Math.abs(o.y - P.plat.y) < 80 && (o.x - P.x) * P.dir > -4 && gap < d){ d = Math.max(4, gap); cross = true; }   // enemy in reach: stop at him (even if he is on another platform at the same height)
        let tx = clamp(P.x + P.dir * d, f.x - leash, f.x + leash);
        if(!cross) tx = clamp(tx, P.plat.x + 8, P.plat.x + P.plat.w - 8);   // no enemy to hit: stay on the platform
        P.xs = P.x; P.xe = tx; P.dashSet = true;
      }
      if(P.dashSet) P.x = lerp(P.xs, P.xe, K(p, sh.kx));
      const lyK = K(p, sh.ly), lyMul = P.rel ? Math.max(1, P.sc * .55) : 1;
      an.lift = lyK * lyMul;
      if(P.dashSet && !P.hit && p >= pu.hitFrom && p <= pu.hitTo) strike(f, P, A, pu, o);
      if(st === 2 && !P.fx && P.dashSet && p >= .6){                 // landing dust
        P.fx = true; G.rings.push({x:P.x, y:P.y - 3, life:.25});
        for(let i = 0; i < 10; i++) G.parts.push({x:P.x, y:P.y - 2, vx:(Math.random() - .5) * 420, vy:-Math.random() * 260, life:.4, col:'#d9b38c'});
      }

      // ---- pose numbers ----
      const w = f.charging ? 0 : clamp((p - CP) / .08, 0, 1);       // 0 = winding up / focusing, 1 = striking
      if(f.charging){                                                // FOCUS: floats, arms spread, shakes
        const cl = P.cl;
        an.lift = 5 + 3 * cl + Math.sin(G.t * 30) * .6 * (1 + cl); an.armF = 1.9; an.armB = -1.9; an.bend = .3;
        an.legF = .25 + Math.sin(G.t * 9) * .15; an.legB = -.25 - Math.sin(G.t * 9) * .15; an.lean = -.05; an.head = -.15;
      }else if(p < CP + .08 && !P.rel){                              // wind-up: crouch, arm back
        const k = clamp(p / CP, 0, 1); an.crouch = 2.2 * k; an.lean = -.15 * k; an.armF = -.8 * k; an.armB = .6 * k; an.legF = .5 * k; an.legB = -.5 * k;
      }
      if(!f.charging && w > 0 || P.rel){
        const u = st;
        if(u === 0){                                                 // jab: lean in, arm straight, rapier
          const g = K(p, [[CP,0],[.4,1],[.62,1],[.85,0],[1,0]]);
          an.weapon = 1; an.lean = .5 * g; an.armF = 1.55; an.bend = 0; an.armB = -.7; an.legF = 1.0 * g; an.legB = -.8 * g; an.crouch = 1.2 * g;
        }else if(u === 1){                                           // spin: arms out, two blades, turns
          an.spin = 4 * Math.PI * K(p, SHAPE[1].spin); an.sx = Math.cos(an.spin); an.sx = (an.sx < 0 ? -1 : 1) * Math.max(.18, Math.abs(an.sx));
          an.weapon = 2; an.armF = 1.57; an.armB = -1.57; an.bend = 0; an.legF = .4; an.legB = -.4; an.crouch = .8;
        }else{                                                       // leap slam: arms up with the mallet, then smash down
          const dn = K(p, [[.3,0],[.52,0],[.6,1],[1,1]]);
          an.weapon = 3; an.armF = lerp(2.6, .7, dn); an.armB = lerp(2.4, .5, dn); an.bend = lerp(.2, .5, dn);
          an.legF = lerp(.9, .3, dn); an.legB = lerp(.5, -.3, dn); an.lean = lerp(-.1, .45, dn);
          an.crouch = p < .42 ? 2 * K(p, [[CP,0],[.42,1]]) : 0;
        }
      }
      if(P.hop && !f.charging && !P.dashSet){                        // still in the air from a hop: dangle
        Object.assign(an, {weapon:0, crouch:0, armF:2.3, armB:-2.3, bend:.3, legF:.3 + Math.sin(G.t * 10) * .2, legB:-.3, lean:0, head:.1});
      }
    }else{                                                           // FOLLOW: stand where he wants the puppet; hop if he changed platform
      const sgn = Math.sign(o.x - f.x) || f.face;
      const eNear = Math.abs(o.y - P.tp.y) < 70 && Math.abs(o.x - f.x) < leash + 20;
      let want = eNear ? o.x - sgn * 56 * (.6 + .4 * P.sc)           // enemy close: wait a short step in front of him (good distance for the next hit)
                       : f.x + f.face * St.follow * (.6 + .4 * P.sc);
      want = clamp(want, f.x - leash * .95, f.x + leash * .95);
      want = clamp(want, P.tp.x + 8, P.tp.x + P.tp.w - 8);
      const over = !(P.x > P.plat.x - 2 && P.x < P.plat.x + P.plat.w + 2);
      if(!P.hop && (P.plat !== P.tp || over)) startHop(P, P.tp, want);
      if(P.hop){                                                     // dangling in the air on the strings
        P.dir = Math.sign(P.hop.x1 - P.hop.x0) || P.dir;
        Object.assign(an, {armF:2.3 + Math.sin(G.t * 9) * .2, armB:-2.3 - Math.sin(G.t * 9) * .2, bend:.3, legF:.3 + Math.sin(G.t * 10) * .2, legB:-.3 - Math.sin(G.t * 10) * .2, head:.1});
      }else{
        const dx = want - P.x, sp = St.speed * (f.stun > 0 ? 2 : 1) * (Math.abs(dx) > 90 ? 2 : 1);
        P.vx = Math.abs(dx) > 5 ? Math.sign(dx) * Math.min(sp, Math.abs(dx) * 8) : 0;
        P.x += P.vx * dt;
        P.dir = Math.abs(P.vx) > 30 ? Math.sign(P.vx) : (eNear ? (o.x >= P.x ? 1 : -1) : f.face);
        P.ph += dt * Math.abs(P.vx) * .09;
        const mv = Math.abs(P.vx) > 20, s = Math.sin(P.ph);
        if(f.stun > 0){                                              // he got hit: the puppet flops
          an.armF = 1.2 + Math.sin(G.t * 30) * .5; an.armB = -1.2 - Math.sin(G.t * 30) * .5; an.head = Math.sin(G.t * 25) * .4; an.legF = .3; an.legB = -.3; an.lean = -.1; an.lift = 1.5;
        }else if(mv){
          an.legF = s * .7; an.legB = -s * .7; an.armF = -s * .6; an.armB = s * .6; an.lean = .1; an.lift = Math.abs(s) * 1.2;
        }else{
          an.armF = .2 + Math.sin(G.t * 2.4) * .06; an.armB = -.2 - Math.sin(G.t * 2.4) * .06; an.lift = .6 + Math.sin(G.t * 3) * .4; an.head = Math.sin(G.t * 1.7) * .08;
        }
      }
    }

    // size: grows slowly while he focuses (the longer he holds, the bigger and more monster), stays at that size for the beast time, shrinks back in the last half second
    let tg = 1;
    if(G.t < P.beastUntil){ const left = P.beastUntil - G.t; tg = left < .5 ? lerp(1, P.bsc, left / .5) : P.bsc; }
    else if(P.mode === 'atk' && P.focus && G.t >= P.beastCd) tg = 1 + (bc.scale - 1) * P.cl;
    P.sc += (tg - P.sc) * Math.min(1, dt * 9);

    // the string: puppet can never be farther than the leash. In the air (over a gap while hitting) it floats a little.
    if(!P.hop){
      P.x = clamp(P.x, f.x - leash, f.x + leash);
      if(P.mode !== 'atk') P.x = clamp(P.x, P.plat.x + 6, P.plat.x + P.plat.w + -6);
    }
    P.air += (((!P.hop && !onPlat(P.plat.y, P.x)) ? 14 : 0) - P.air) * Math.min(1, dt * 12);
    an.lift += P.air;
    return P;
  }

  // ---- drawing helpers (local space of the puppet: origin = feet, x = forward, y = down) ----
  function seg(cx, a, b, w, col){ Body.capsule(cx, a, b, w + 2.2, OUT); Body.capsule(cx, a, b, w, col); }
  function skel(a, hr){
    const hipY = -LEGL * .9 + a.crouch, hip = {x:0, y:hipY};
    const sh = {x:Math.sin(a.lean) * TORL, y:hipY - Math.cos(a.lean) * TORL};
    const head = {x:sh.x + Math.sin(a.lean + a.head) * (hr + .6), y:sh.y - Math.cos(a.lean + a.head) * (hr + .6)};
    const arm = ang => { const e = {x:sh.x + Math.sin(ang) * ARML, y:sh.y + Math.cos(ang) * ARML};
      return {s:sh, e, h:{x:e.x + Math.sin(ang + a.bend) * ARML, y:e.y + Math.cos(ang + a.bend) * ARML}, ang:ang + a.bend}; };
    const leg = ang => ({h:hip, f:{x:Math.sin(ang) * LEGL, y:Math.min(0, hipY + Math.cos(ang) * LEGL)}});
    return {hip, sh, head, aF:arm(a.armF), aB:arm(a.armB), lF:leg(a.legF), lB:leg(a.legB)};
  }
  function string(cx, a, b, slack, col, w){
    cx.strokeStyle = col; cx.lineWidth = w; cx.beginPath(); cx.moveTo(a.x, a.y);
    cx.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 + slack, b.x, b.y); cx.stroke();
  }
  function dashed(cx, a, b, on, off, w, col){ cx.save(); cx.setLineDash([on, off]); cx.strokeStyle = col; cx.lineWidth = w; cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); cx.stroke(); cx.restore(); }

  // the puppet, its strings and the focus / beast effects. World coordinates.
  // MONSTER PUPPET look (grows in steps as the puppet gets bigger, so a short hold = a small change):
  //   m1 (early): burlap skin, purple patchwork coat, fatter body, bigger head and hands, rope strings
  //   m2 (middle): sewn button eye + X eye, stitched mouth full of teeth, patches and stitches, bolts on the elbows
  //   m3 (late):   wind-up key spinning on its back, cotton stuffing poking out, dark purple aura
  function drawWorld(cx, f, hand, t, handF){
    handF = handF || hand;      // far hand: controls the puppet's back arm (two control bars)
    const P = f.pup, bc = SK().beast, an = P.an, sc = P.sc, bf = clamp((sc - 1) / (bc.scale - 1), 0, 1);
    const m1 = clamp(bf * 2, 0, 1), m2 = clamp((bf - .25) / .35, 0, 1), m3 = clamp((bf - .5) / .3, 0, 1);
    const hr = HR * (1 + .4 * m1), sk = skel(an, hr), white = f.flash > 0;
    const beastOn = t < P.beastUntil, focus = P.mode === 'atk' && P.focus && f.charging;
    const sx = P.dir * sc * an.sx, toW = q => ({x:P.x + q.x * sx, y:P.y - an.lift + q.y * sc});
    const wood = mixc('#e7c79b', '#a98f63', m1), coat = mixc('#c23b5b', '#5b2a6e', m1), dark = mixc('#2a1020', '#3a2a1c', m1);
    const wA = 2.4 + 2 * m1, wL = 2.8 + 2.2 * m1, wT = 6 + 4 * m1;

    // strings: three lines from his hand to the puppet head and both hands. They turn into twisted rope as the puppet gets big.
    const top = toW({x:sk.head.x, y:sk.head.y - hr - 1}), hl = toW(sk.aF.h), hr2 = toW(sk.aB.h);
    const dist = Math.hypot(top.x - hand.x, top.y - hand.y), slack = focus ? .5 : clamp((1 - dist / (SK().string.leash * 1.1)) * 30, 1, 26);
    const rope = m2 > .3, c1 = rope ? 'rgba(216,201,168,.95)' : 'rgba(255,230,160,.9)', c2 = rope ? 'rgba(216,201,168,.65)' : 'rgba(255,230,160,.55)';
    cx.save(); cx.lineCap = 'round';
    if(rope) cx.setLineDash([3.2, 1.6]);
    string(cx, hand, top, slack, c1, 1.1 + 1.4 * m1);
    string(cx, hand, hl, slack * 1.2, c2, .8 + .6 * m1); string(cx, handF, hr2, slack * 1.2, c2, .8 + .6 * m1);
    cx.restore();
    [hand, handF].forEach(hd => {                                                                      // gold ring on each hand where the strings start
      cx.fillStyle = OUT; cx.beginPath(); cx.arc(hd.x, hd.y, 3.1, 0, 7); cx.fill();
      cx.fillStyle = GOLD; cx.beginPath(); cx.arc(hd.x, hd.y, 2, 0, 7); cx.fill();
      if(focus){ const g = cx.createRadialGradient(hd.x, hd.y, 1, hd.x, hd.y, 16);
        g.addColorStop(0, 'rgba(255,200,120,' + (.5 + .3 * P.cl) + ')'); g.addColorStop(1, 'rgba(255,200,120,0)'); cx.fillStyle = g; cx.beginPath(); cx.arc(hd.x, hd.y, 16, 0, 7); cx.fill(); }
    });

    // shadow on the ground (not while floating over a gap)
    if(P.air < 1 && !P.hop){ cx.fillStyle = 'rgba(0,0,0,.28)'; cx.beginPath(); cx.ellipse(P.x, P.y + .5, (8 + 3 * m1) * sc, 2.4 * sc, 0, 0, 7); cx.fill(); }
    // aura: dark purple once it is a monster, warm while he focuses
    if(bf > .15 || focus){
      const r = (14 + 4 * Math.sin(t * 12)) * sc * (focus ? .8 : 1), g = cx.createRadialGradient(P.x, P.y - 10 * sc, 2, P.x, P.y - 10 * sc, r);
      g.addColorStop(0, bf > .15 ? 'rgba(150,70,210,' + (.15 + .3 * m3) + ')' : 'rgba(255,170,90,' + (.2 + .2 * P.cl) + ')'); g.addColorStop(1, 'rgba(150,70,210,0)');
      cx.fillStyle = g; cx.beginPath(); cx.arc(P.x, P.y - 10 * sc, r, 0, 7); cx.fill();
    }
    if(focus){                                                                                           // sparks pulled into the puppet
      for(let i = 0; i < 8; i++){ const k = (t * 1.4 + i / 8) % 1, a = t * 6 + i * .8, rr = (6 + (1 - k) * 22) * sc * .8;
        cx.fillStyle = 'rgba(255,190,120,' + (.2 + .6 * k) + ')'; cx.beginPath(); cx.arc(P.x + Math.cos(a) * rr, P.y - 10 * sc + Math.sin(a) * rr * .7, 1 + k, 0, 7); cx.fill(); }
    }

    // ---- the puppet ----
    cx.save(); cx.translate(P.x, P.y - an.lift); cx.scale(sx, sc); cx.lineJoin = 'round'; cx.lineCap = 'round';
    const limbC = white ? '#fff' : wood, coatC = white ? '#fff' : coat, tx = (sk.hip.x + sk.sh.x) / 2, ty = (sk.hip.y + sk.sh.y) / 2;
    const hand2 = q => { cx.fillStyle = OUT; cx.beginPath(); cx.arc(q.x, q.y, 1.6 + 2.4 * m1 + 1, 0, 7); cx.fill(); cx.fillStyle = limbC; cx.beginPath(); cx.arc(q.x, q.y, 1.6 + 2.4 * m1, 0, 7); cx.fill(); };
    seg(cx, sk.aB.s, sk.aB.e, wA, limbC); seg(cx, sk.aB.e, sk.aB.h, wA - .2, limbC); hand2(sk.aB.h);   // back arm
    seg(cx, sk.lB.h, sk.lB.f, wL, white ? '#fff' : dark);                                               // back leg
    // wind-up key on the back (late form)
    if(m3 > .05 && !white){ cx.save(); cx.globalAlpha = m3; const bx = tx - wT / 2, hh = 2.6 * Math.abs(Math.cos(t * 4)) + .5;
      cx.lineCap = 'round'; cx.strokeStyle = OUT; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(bx + 1, ty); cx.lineTo(bx - 3.4, ty); cx.moveTo(bx - 3.4, ty - hh); cx.lineTo(bx - 3.4, ty + hh); cx.stroke();
      cx.strokeStyle = GOLD; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(bx + 1, ty); cx.lineTo(bx - 3.4, ty); cx.moveTo(bx - 3.4, ty - hh); cx.lineTo(bx - 3.4, ty + hh); cx.stroke(); cx.restore(); }
    seg(cx, sk.hip, sk.sh, wT, coatC);                                                                   // body
    if(m2 > .05 && !white){                                                                              // patches + stitches
      cx.save(); cx.globalAlpha = m2;
      cx.fillStyle = '#a8472f'; cx.fillRect(tx - 1, ty - 4.6, 4.6, 4.2); cx.fillStyle = '#c9b27c'; cx.fillRect(tx - 4.2, ty + .4, 3.8, 3.4);
      cx.strokeStyle = '#16090e'; cx.lineWidth = .5; cx.setLineDash([.9, .7]); cx.strokeRect(tx - 1, ty - 4.6, 4.6, 4.2); cx.strokeRect(tx - 4.2, ty + .4, 3.8, 3.4);
      cx.beginPath(); cx.moveTo(tx - wT / 2 + 1, ty - 1.4); cx.lineTo(tx + wT / 2 - 1, ty - 1.4); cx.stroke(); cx.restore(); }
    if(m3 > .05 && !white){ cx.fillStyle = 'rgba(239,227,200,' + m3 + ')'; [[tx + wT / 2 - .5, ty - 3.2, 1.2], [tx - wT / 2 + .2, ty + 2.6, 1.1], [sk.sh.x + 2.6, sk.sh.y + .6, 1]].forEach(([x, y, r]) => { cx.beginPath(); cx.arc(x, y, r, 0, 7); cx.fill(); cx.beginPath(); cx.arc(x + .9, y - .5, r * .7, 0, 7); cx.fill(); }); }   // cotton stuffing
    cx.fillStyle = white ? '#fff' : GOLD; cx.beginPath(); cx.arc(sk.hip.x, sk.hip.y, 1.5, 0, 7); cx.fill();   // belt button
    seg(cx, sk.lF.h, sk.lF.f, wL, white ? '#fff' : dark);                                               // front leg
    if(m1 > .3){ cx.fillStyle = white ? '#fff' : '#24160f'; [sk.lB.f, sk.lF.f].forEach(q => { cx.beginPath(); cx.arc(q.x + .8, q.y - .6, 1.4 + 1.2 * m1, 0, 7); cx.fill(); }); }   // stubby feet
    // head
    cx.fillStyle = OUT; cx.beginPath(); cx.arc(sk.head.x, sk.head.y, hr + 1, 0, 7); cx.fill();
    cx.fillStyle = limbC; cx.beginPath(); cx.arc(sk.head.x, sk.head.y, hr, 0, 7); cx.fill();
    if(!white){
      const hx = sk.head.x, hy = sk.head.y;
      cx.fillStyle = 'rgba(220,60,80,.55)'; cx.globalAlpha = 1 - m2; cx.beginPath(); cx.arc(hx + 1.6, hy + 1.1, .9, 0, 7); cx.fill();   // painted cheek (puppet)
      cx.fillStyle = '#1a0a14'; cx.beginPath(); cx.arc(hx + 1.7, hy - .5, .6, 0, 7); cx.fill(); cx.beginPath(); cx.arc(hx - .1, hy - .5, .5, 0, 7); cx.fill();   // dot eyes
      const capA = 1 - clamp(m2 * 2, 0, 1);
      if(capA > .02){ cx.globalAlpha = capA; cx.fillStyle = '#c23b5b'; cx.beginPath(); cx.arc(hx, hy - .6, hr + .15, Math.PI * 1.05, Math.PI * 1.95); cx.closePath(); cx.fill();
        cx.fillStyle = GOLD; cx.beginPath(); cx.arc(hx, hy - hr - .6, .9, 0, 7); cx.fill(); }
      if(m2 > .05){                                                                                      // MONSTER FACE
        cx.globalAlpha = m2;
        cx.fillStyle = limbC; cx.beginPath(); cx.arc(hx, hy, hr - .2, 0, 7); cx.fill();                  // cover the puppet face
        cx.strokeStyle = '#16090e'; cx.lineWidth = .6; cx.setLineDash([.8, .6]); cx.beginPath(); cx.arc(hx, hy, hr * .82, Math.PI * 1.1, Math.PI * 1.9); cx.stroke(); cx.setLineDash([]);   // head seam
        const e1 = {x:hx + hr * .5, y:hy - hr * .22}, e2 = {x:hx - hr * .12, y:hy - hr * .15};
        cx.fillStyle = '#16090e'; cx.beginPath(); cx.arc(e1.x, e1.y, hr * .36, 0, 7); cx.fill();         // big button eye
        cx.shadowColor = '#ffb03a'; cx.shadowBlur = 6; cx.fillStyle = '#ffb03a'; cx.beginPath(); cx.arc(e1.x + hr * .06, e1.y, hr * .13, 0, 7); cx.fill(); cx.shadowBlur = 0;
        cx.strokeStyle = '#16090e'; cx.lineWidth = .9; const xr = hr * .24;                              // sewn X eye
        cx.beginPath(); cx.moveTo(e2.x - xr, e2.y - xr); cx.lineTo(e2.x + xr, e2.y + xr); cx.moveTo(e2.x + xr, e2.y - xr); cx.lineTo(e2.x - xr, e2.y + xr); cx.stroke();
        const open = P.mode === 'atk' && !f.charging ? 1 : .35, A0 = {x:hx + hr * .05, y:hy + hr * .35}, B0 = {x:hx + hr * .98, y:hy + hr * .1}, dd = hr * (.22 + .35 * open);   // stitched mouth with teeth
        const up = u => ({x:lerp(A0.x, B0.x, u), y:lerp(A0.y, B0.y, u)}), lo = u => ({x:up(u).x, y:up(u).y + dd * Math.sin(Math.PI * u)});
        cx.fillStyle = '#2a0d12'; cx.beginPath(); cx.moveTo(A0.x, A0.y); for(let i = 1; i <= 8; i++) cx.lineTo(lo(i / 8).x, lo(i / 8).y); cx.lineTo(B0.x, B0.y); cx.closePath(); cx.fill();
        cx.fillStyle = '#f3ead6';
        for(let i = 0; i < 5; i++){ const u = (i + .5) / 5, q = up(u), s = hr * .2; cx.beginPath(); cx.moveTo(q.x - s * .45, q.y); cx.lineTo(q.x + s * .45, q.y); cx.lineTo(q.x, q.y + s * (.8 + .4 * open)); cx.closePath(); cx.fill(); }
        for(let i = 0; i < 4; i++){ const u = (i + .5) / 4, q = lo(u), s = hr * .17; cx.beginPath(); cx.moveTo(q.x - s * .45, q.y); cx.lineTo(q.x + s * .45, q.y); cx.lineTo(q.x, q.y - s * (.8 + .4 * open)); cx.closePath(); cx.fill(); }
        cx.strokeStyle = '#16090e'; cx.lineWidth = .6; cx.setLineDash([.7, .5]); cx.beginPath(); cx.moveTo(A0.x - .8, A0.y - .3); cx.lineTo(A0.x - 2.6, A0.y - 1.6); cx.moveTo(B0.x - .2, B0.y); cx.lineTo(B0.x + .6, B0.y - 1.8); cx.stroke(); cx.setLineDash([]);   // stitches at the corners
        if(m3 > .05){ cx.globalAlpha = m3; cx.fillStyle = '#efe3c8'; [[hx - hr * .25, hy - hr - .2, 1.3], [hx + hr * .15, hy - hr - .5, 1.1], [hx - hr * .6, hy - hr * .7, 1]].forEach(([x, y, r]) => { cx.beginPath(); cx.arc(x, y, r, 0, 7); cx.fill(); }); }   // stuffing on top of the head
        cx.globalAlpha = 1;
      }
      cx.globalAlpha = 1;
    }
    seg(cx, sk.aF.s, sk.aF.e, wA, limbC); seg(cx, sk.aF.e, sk.aF.h, wA - .2, limbC); hand2(sk.aF.h);   // front arm
    if(m2 > .3 && !white){ cx.fillStyle = '#8b8f99'; [sk.aF.e, sk.aB.e].forEach(q => { cx.beginPath(); cx.arc(q.x, q.y, 1, 0, 7); cx.fill(); }); }   // bolts on the elbows
    // weapons: 1 rapier, 2 two blades + whirl lines, 3 mallet
    const tip = (q, len) => ({x:q.h.x + Math.sin(q.ang) * len, y:q.h.y + Math.cos(q.ang) * len});
    if(an.weapon === 1){ const a = tip(sk.aF, 11); Body.capsule(cx, sk.aF.h, a, 1.3, OUT); Body.capsule(cx, sk.aF.h, a, .7, '#e8f0ff'); Body.capsule(cx, {x:sk.aF.h.x - .8, y:sk.aF.h.y - 2}, {x:sk.aF.h.x + .8, y:sk.aF.h.y + 2}, 1.4, GOLD); }
    if(an.weapon === 2){
      [sk.aF, sk.aB].forEach(q => { const a = tip(q, 8); Body.capsule(cx, q.h, a, 1.6, OUT); Body.capsule(cx, q.h, a, .9, '#e8f0ff'); });
      cx.strokeStyle = 'rgba(255,255,255,.75)'; cx.lineWidth = 1.2; [0, Math.PI].forEach(o2 => { cx.beginPath(); cx.arc(0, sk.sh.y, 13, an.spin + o2, an.spin + o2 + 1.2); cx.stroke(); });
    }
    if(an.weapon === 3){ const a = tip(sk.aF, 8), q = sk.aF.ang;
      Body.capsule(cx, sk.aF.h, a, 1.5, OUT); Body.capsule(cx, sk.aF.h, a, .9, '#8a5a35');
      cx.save(); cx.translate(a.x, a.y); cx.rotate(-q); cx.fillStyle = OUT; cx.fillRect(-4.2, -7.6, 8.4, 5.8); cx.fillStyle = '#b07a48'; cx.fillRect(-3.2, -6.7, 6.4, 4); cx.restore();   // mallet head
    }
    cx.restore();

    if(beastOn){ const k = clamp((P.beastUntil - t) / P.beastDur, 0, 1);                                // beast time left: small bar above the puppet
      cx.fillStyle = 'rgba(0,0,0,.5)'; cx.fillRect(P.x - 11, P.y - an.lift - 28 * sc - 7, 22, 3);
      cx.fillStyle = '#ffb03a'; cx.fillRect(P.x - 10, P.y - an.lift - 28 * sc - 6, 20 * k, 1.4); }
  }

  Characters.art('marionettis', {
    // a little taller and slim. Hitbox is still 30x52 (arena.js is not changed per character).
    body: {head:{r:6.3}, torso:{len:12.5, w:10.5}, uArm:{len:9.5, w:4.2}, fArm:{len:9.5, w:3.8}, hand:{r:2.9}, shN:1, shF:-3.5, thigh:{len:10.5, w:5.4}, shin:{len:10, w:4.6}, foot:{len:7.5, w:3.4}},
    colors: {shirt:'#b8324f', limb:'#d9486a', far:'#7e2036', legs:'#2a1830', legsFar:'#1c1022', head:'#f0d9c8', dark:'#2a1020', hand:'#f2e6d8'},

    spring(p, A){ if(A.chg > 0 && p <= CP + .004) return {k:200, d:20}; },

    // his near hand works like a puppeteer: lifts, flicks, twirls, yanks down. Legs keep the normal walk / idle pose.
    attack(tg, p, A, Kf){
      const L = A.cl || 0;
      if(A.chg > 0 && p <= CP + .004){                               // FOCUS: hand up high and shaking, leaning back a bit
        Object.assign(tg, {aN:2.55 + Math.sin(A.chg * 38) * .05 * (1 + L), eN:.35, lean:-.1 - .06 * L, head:-.12, aF:2.35 + Math.sin(A.chg * 38 + 1.6) * .05 * (1 + L), eF:.4});   // BOTH hands up, shaking
        return;
      }
      const rel = A.chg > 0 && L > 0, s = ARM[rel ? 2 : (A.step || 0)];
      tg.aN = Kf(p, s.aN); tg.eN = Kf(p, s.eN); tg.aF = Kf(p, s.aF); tg.eF = Kf(p, s.eF); tg.lean = Kf(p, s.lean); tg.head = -tg.lean * .4;
      if(!rel && (A.step || 0) === 1 && p > .3 && p < .76){ tg.eN += Math.sin(p * 34) * .35; tg.eF += Math.sin(p * 34 + Math.PI) * .35; }   // wrist twirl for the spin (hands in opposite phase)
    },

    // showman stance: near hand forward at belt height, holding the strings
    pose(tg, f, t, run){
      const idle = 1 - run, b = Math.sin(t * 2);
      tg.aN += idle * (.55 + b * .05); tg.eN += idle * .35; tg.aF += idle * -.05; tg.head += idle * .02;
    },

    // short cape that streams back with his speed
    behind(cx, f, t, S, P){
      const drag = clamp(-(f.vx * f.face) * .045, -3, 12), sw = Math.sin(t * 2.4) * 1;
      const x0 = S.sh.x - 2, y0 = S.sh.y - 1, yb = S.pel.y + 9 + (f.gr ? 0 : -3);
      cx.beginPath(); cx.moveTo(x0, y0);
      cx.quadraticCurveTo(x0 - 7 - drag * .5, (y0 + yb) / 2, x0 - 9 - drag + sw, yb);
      cx.lineTo(x0 - 3 + sw * .4, yb - 1.5); cx.lineTo(x0 + 1, yb); cx.quadraticCurveTo(x0 + 2, (y0 + yb) / 2, x0 + 2, y0 + 3); cx.closePath();
      cx.fillStyle = f.flash > 0 ? '#fff' : '#5a1428'; cx.fill(); cx.strokeStyle = OUT; cx.lineWidth = 1.2; cx.lineJoin = 'round'; cx.stroke();
      if(f.flash <= 0){ cx.strokeStyle = GOLD; cx.lineWidth = .8; cx.beginPath(); cx.moveTo(x0 - 9 - drag + sw, yb); cx.lineTo(x0 - 3 + sw * .4, yb - 1.5); cx.stroke(); }
    },

    front(cx, f, t, S, P){
      const white = f.flash > 0;
      const hw = {N:{x:f.x + f.face * S.aN.hand.x, y:f.y + S.aN.hand.y}, F:{x:f.x + f.face * S.aF.hand.x, y:f.y + S.aF.hand.y}};
      f.handW = hw;

      // bow tie + vest button + belt buckle
      if(!white){
        const sh = S.sh;
        cx.fillStyle = '#ffd479'; cx.beginPath(); cx.moveTo(sh.x + 1, sh.y - 1); cx.lineTo(sh.x + 5, sh.y - 3.2); cx.lineTo(sh.x + 5, sh.y + 1.2); cx.closePath(); cx.fill();
        cx.beginPath(); cx.moveTo(sh.x + 1, sh.y - 1); cx.lineTo(sh.x - 3, sh.y - 3.2); cx.lineTo(sh.x - 3, sh.y + 1.2); cx.closePath(); cx.fill();
        cx.fillStyle = OUT; cx.beginPath(); cx.arc(sh.x + 1, sh.y - 1, 1.1, 0, 7); cx.fill();
        cx.fillStyle = GOLD; cx.fillRect(S.pel.x - 2, S.pel.y - 1.5, 4, 3);
      }
      // top hat (drawn in the head's own tilted space)
      const h = S.head, ang = Math.atan2(h.x - S.sh.x, -(h.y - S.sh.y));
      cx.save(); cx.translate(h.x, h.y); cx.rotate(ang);
      if(!white){
        cx.fillStyle = OUT; cx.fillRect(-7.8, -7.2, 15.6, 3.2); cx.fillRect(-5.2, -16.4, 10.4, 10);
        cx.fillStyle = '#241624'; cx.fillRect(-6.6, -6.7, 13.2, 2.2); cx.fillRect(-4.2, -15.6, 8.4, 9);
        cx.fillStyle = '#c23b5b'; cx.fillRect(-4.2, -9.4, 8.4, 2.4);
        cx.fillStyle = GOLD; cx.fillRect(-1.2, -9.7, 2.4, 3);
        cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(4, -1.4, 1.3, 0, 7); cx.fill(); cx.fillStyle = '#1a0a14'; cx.beginPath(); cx.arc(4.4, -1.4, .7, 0, 7); cx.fill();   // eye
        cx.strokeStyle = '#1a0a14'; cx.lineWidth = .8; cx.beginPath(); cx.arc(2.2, 1.9, 1.8, .2, Math.PI - .5); cx.stroke();                                           // smile
      }
      cx.restore();

      // puppet + strings (world space). Not drawn on the select screen (no match running).
      if(typeof G !== 'undefined' && G && G.f && G.f.includes(f)){
        const P2 = tick(f);
        cx.save(); cx.scale(f.face, 1); cx.translate(-f.x, -f.y);       // undo the body transform: draw in world coordinates
        drawWorld(cx, f, hw.N, G.t, hw.F);
        cx.restore();
      }
    }
  });
})();