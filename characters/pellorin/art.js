// PELLORIN art - The Twisted Performer. Same shared ragdoll (body.js): slim performer proportions, Victorian ringmaster tailcoat, slicked hair, sewn grin. No hat, no cape.
// The PUPPET is also made here. arena.js has no puppet, so this file keeps the puppet state on the fighter (f.pup),
// moves it and checks its hit once per frame inside front(), using the game clock G.t (so pause and hit-stop work). It calls hurt() from arena.js for damage.
// Hooks used: body, colors, spring(), attack() = his hand moves like a puppeteer, pose() = hand held forward holding the strings,
//             torso() = tailcoat, shirt, lapels, cravat, buttons, neck. behind() = split coat tails.
//             front() = hair, face (void eyes + sewn grin), near sleeve + cuff, strings, puppet (puppet code unchanged).
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
  const SK = () => _sk || (_sk = Characters.skillsOf('pellorin').basic);

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
      const PB = Characters.skillsOf('pellorin').passive;
      if(f.mbT > 0 && PB) A2.dmg *= 1 + PB.atk;                         // Performance buff (passive): the puppet hits harder
      hurt(o, {c:f.c, A:A2, face:o.x >= P.x ? 1 : -1, src:f});          // src = him: the hit counts for his passive
    }
  }

  // one step of the puppet: start / end of a swing, focus, beast timer, walking / hopping, leash, hit check, and the pose numbers for drawing
  function tick(f){
    if(f.fc) return tickBeast(f);
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
    if(f.stun > 0 || f.atk <= 0 || !A.pup){ if(P.mode === 'atk') P.mode = 'follow'; P.focus = false; }   // (also when a SKILL cancelled the swing: its attack has no puppet move)
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
      if(!P.hop && (P.plat !== P.tp || over || Math.abs(P.x - f.x) > leash + 6)) startHop(P, P.tp, want);   // (also hops back to him when it was thrown farther than the string reaches: Grand Entrance)
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

    if(f.ge){                                                          // THE GRAND ENTRANCE: crouch, leap along the arc, stomp
      const ge = f.ge;
      if(ge.ph === 'wind'){ const k = clamp(ge.t / ge.d.wind, 0, 1); Object.assign(an, {crouch:2.4 * k, lean:-.1 * k, armF:2.2, armB:2.0, bend:.3, legF:.6 * k, legB:-.6 * k}); }
      else{
        P.hop = null; P.vx = 0; P.dir = ge.dir;
        if(ge.ph === 'fly'){ const k = clamp(ge.t / ge.d.fly, 0, 1); Object.assign(an, {armF:2.6, armB:2.5, bend:.2, legF:.9 - .5 * k, legB:.5 - .9 * k, lean:.05 + .3 * k, crouch:0}); }
        else{ const k = clamp(1 - ge.t / ge.d.recover * 1.6, 0, 1); Object.assign(an, {armF:.7, armB:.5, bend:.5, legF:.9, legB:-.9, lean:.3 * k, crouch:2.6 * k}); }
      }
    }
    if(f.ns && !P.hop){                                              // NO STRINGS DETACHED: the puppet plants itself and aims the string
      const ns = f.ns, k = clamp(ns.t / ns.d.wind, 0, 1), a = Math.atan2(ns.dx * (ns.dx >= 0 ? 1 : -1), -ns.dy);   // elevation of the aim
      P.x = ns.px; P.vx = 0; P.dir = ns.dx >= 0 ? 1 : -1; P.mode = P.mode === 'atk' ? 'follow' : P.mode;
      Object.assign(an, {armF:1.57 - Math.atan2(ns.dy, Math.abs(ns.dx)) * 1, armB:-.8, bend:0, lean:.3 * k, legF:.7 * k, legB:-.6 * k, crouch:1.2 * k, head:-.05, weapon:0, lift:0, sx:1});
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
    if(f.ge && f.ge.ph !== 'wind'){                                  // THE GRAND ENTRANCE: the leap is driven by arena.js (f.ge.x / f.ge.y = where the puppet's feet are)
      const ge = f.ge;
      if(ge.ph === 'rec'){ const pl = G.P.find(q => Math.abs(q.y - ge.gy) < 3 && ge.tx > q.x - 6 && ge.tx < q.x + q.w + 6); if(pl){ P.plat = pl; P.y = pl.y; } P.air = 0; an.lift = 0; }
      else an.lift = P.y - ge.y;
      P.x = ge.x;
    }
    return P;
  }

  // ---- THE FINAL CURTAIN: the puppet IS the monster body (arena.js moves it and fights with it: f.x / f.y = its feet). This only sets its size, pose and look. ----
  function tickBeast(f){
    const P = f.pup || init(f), bc = SK().beast, an = P.an, A = f.A || {}, now = G.t;
    const dt = clamp(now - P.t, 0, .05); P.t = now;
    if(f.gr){ const pl = G.P.find(q => Math.abs(q.y - f.y) < 3 && f.x > q.x - 6 && f.x < q.x + q.w + 6); if(pl) P.plat = pl; }
    Object.assign(P, {x:f.x, y:f.y, dir:f.face, mode:'fc', hop:null, air:0, focus:false, rel:false, vx:f.vx, beastUntil:0});
    P.sc += (bc.scale - P.sc) * Math.min(1, dt * 6);                  // swells into the full monster (the look morphs in with the size)
    Object.assign(an, {legF:0, legB:0, armF:0, armB:0, bend:.4, lean:0, head:0, crouch:0, lift:0, sx:1, weapon:0, spin:0});
    const swing = f.atk > 0 && f.stun <= 0 && !!A.time, p = swing ? clamp(1 - f.atk / A.time, 0, 1) : 0, st = A.step || 0;
    if(!swing) P.fx = false;
    if(f.stun > 0){                                                   // hit: the monster flops back
      Object.assign(an, {armF:1.3 + Math.sin(now * 30) * .5, armB:-1.3 - Math.sin(now * 30) * .5, head:Math.sin(now * 25) * .4, legF:.3, legB:-.3, lean:-.25});
    }else if(swing){
      const both = ks => { an.armF = K(p, ks); an.armB = K(p, ks) - .15; };
      if(st === 0){                                                   // LEAPING STOMP: crouch, jump with the arms up, land feet first
        both([[0,.3],[.28,2.5],[.6,2.6],[.78,.7],[1,.3]]); an.crouch = 2.4 * K(p, [[0,0],[.2,1],[.3,0],[1,0]]);
        an.legF = K(p, [[0,0],[.25,.5],[.45,1.1],[.72,.15],[1,.2]]); an.legB = K(p, [[0,0],[.25,-.4],[.45,.6],[.72,-.15],[1,-.2]]); an.lean = K(p, [[0,0],[.28,-.15],[.6,-.1],[.78,.35],[1,.1]]); an.bend = .25;
      }else if(st === 1){                                             // DOUBLE-HANDED SMASH: both fists up, then down together
        both([[0,.3],[.3,2.7],[.52,2.8],[.64,.5],[1,.3]]); an.lean = K(p, [[0,0],[.3,-.22],[.52,-.25],[.64,.4],[1,.1]]); an.crouch = 2.2 * K(p, [[0,0],[.5,0],[.66,1],[1,0]]);
        an.legF = .5; an.legB = -.5; an.bend = .2;
      }else if(st === 2 || st === 3){                                 // LEFT / RIGHT PUNCH: back arm, then front arm
        const hit = K(p, [[0,-.6],[.25,-1.1],[.48,1.55],[.72,1.5],[1,-.3]]), guard = K(p, [[0,.3],[.3,1.0],[1,.4]]);
        if(st === 2){ an.armB = hit; an.armF = guard; } else { an.armF = hit; an.armB = -guard; }
        an.bend = K(p, [[0,.4],[.25,.8],[.48,0],[.72,0],[1,.4]]); an.lean = K(p, [[0,0],[.25,-.15],[.48,.4],[.72,.35],[1,.1]]);
        an.legF = K(p, [[0,0],[.4,.8],[.8,.6],[1,0]]); an.legB = K(p, [[0,0],[.4,-.7],[.8,-.5],[1,0]]); an.crouch = 1.2 * K(p, [[0,0],[.5,1],[1,0]]);
      }else{                                                          // LEAPING SMASH: big crouch, high leap, both fists slammed down on landing
        both([[0,.3],[.3,2.8],[.62,2.9],[.78,.3],[1,.3]]); an.crouch = 3 * K(p, [[0,0],[.25,1],[.33,0],[1,0]]);
        an.legF = K(p, [[0,0],[.3,.5],[.5,1.2],[.78,.1],[1,.2]]); an.legB = K(p, [[0,0],[.3,-.4],[.5,.7],[.78,-.2],[1,-.2]]); an.lean = K(p, [[0,0],[.3,-.2],[.62,-.2],[.78,.5],[1,.1]]); an.bend = .2;
      }
      if((st === 0 || st === 4) && !P.fx && p >= .72){                // landing dust
        P.fx = true; G.rings.push({x:f.x + f.face * 12, y:f.y - 3, life:.25});
        for(let i = 0; i < 12; i++) G.parts.push({x:f.x + f.face * 12, y:f.y - 2, vx:(Math.random() - .5) * 480, vy:-Math.random() * 280, life:.4, col:'#d9b38c'});
      }
    }else if(!f.gr){                                                  // in the air: arms up, legs tucked
      Object.assign(an, {armF:2.2, armB:-2.0, bend:.3, legF:.6, legB:-.3, lean:.05});
    }else{
      P.ph += dt * Math.abs(f.vx) * .05; const s = Math.sin(P.ph);
      if(Math.abs(f.vx) > 25){ an.legF = s * .6; an.legB = -s * .6; an.armF = -s * .5 + .3; an.armB = s * .5 - .2; an.lean = .12; an.crouch = Math.abs(s) * .8; }
      else { an.armF = .35 + Math.sin(now * 2) * .06; an.armB = -.25 - Math.sin(now * 2) * .06; an.lean = .06; an.crouch = .4 + Math.sin(now * 2) * .3; }   // idle: heavy breathing
    }
    return P;
  }

  // his dance in the air (the ragdoll's own joint targets, see body.js). Continuous: conductor arms swapping high / low, a trailing ballet leg, a swaying head.
  function dance(tg){
    const w = G.t * 2.4, s = Math.sin(w), c = Math.cos(w), lg = Math.sin(w * .5), hi = .5 + .5 * s;
    Object.assign(tg, {lean:.1 + .16 * c, head:-.12 + .14 * Math.sin(w + 1),
      aN:lerp(.9, 2.7, hi), eN:.35 + .3 * (1 - hi), aF:lerp(2.6, .8, hi), eF:.35 + .3 * hi,
      tN:.2 + .5 * lg, kN:.5 - .3 * lg, tF:-.35 - .5 * lg, kF:.25 + .35 * (1 - lg)});
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

    if(f.ge && f.ge.ph !== 'rec'){                                                                    // THE GRAND ENTRANCE: warning ring on the ground where the puppet will land (it tightens as it comes down)
      const ge = f.ge, k = ge.ph === 'wind' ? 0 : clamp(ge.t / ge.d.fly, 0, 1), rr = ge.d.radius * (1.08 - .08 * k), pu = .6 + .4 * Math.sin(t * (12 + 14 * k));
      cx.save(); cx.strokeStyle = 'rgba(255,212,121,' + (.55 + .4 * pu) + ')'; cx.fillStyle = 'rgba(194,59,91,' + (.16 + .14 * k) * pu + ')'; cx.lineWidth = 2.2; cx.setLineDash([7, 5]);
      cx.beginPath(); cx.ellipse(ge.tx, ge.gy - 2, rr, rr * .26, 0, 0, 7); cx.fill(); cx.stroke(); cx.restore();
    }
    // strings: three lines from his hand to the puppet head and both hands. They turn into twisted rope as the puppet gets big.
    const top = toW({x:sk.head.x, y:sk.head.y - hr - 1}), hl = toW(sk.aF.h), hr2 = toW(sk.aB.h);
    const NSK = f.ns, con = f.fc ? 0 : NSK ? NSK.con : 1;                                                         // No Strings Detached: 0 = string cut from his hand, 1 = connected
    const dist = Math.hypot(top.x - hand.x, top.y - hand.y), slack = focus ? .5 : clamp((1 - dist / (SK().string.leash * 1.1)) * 30, 1, 26);
    const rope = m2 > .3, c1 = rope ? 'rgba(216,201,168,.95)' : 'rgba(255,230,160,.9)', c2 = rope ? 'rgba(216,201,168,.65)' : 'rgba(255,230,160,.55)';
    cx.save(); cx.lineCap = 'round';
    if(rope) cx.setLineDash([3.2, 1.6]);
    const toward = (a, b) => ({x:a.x + (b.x - a.x) * con, y:a.y + (b.y - a.y) * con});               // a string that is still reconnecting only reaches part of the way
    if(con > .02){
      string(cx, hand, toward(hand, top), slack * con, c1, 1.1 + 1.4 * m1);
      string(cx, hand, toward(hand, hl), slack * 1.2 * con, c2, .8 + .6 * m1); string(cx, handF, toward(handF, hr2), slack * 1.2 * con, c2, .8 + .6 * m1);
    }
    if(NSK && con < 1){                                                                                // cut ends: a short limp string hangs from his hand, a short stub stays on the puppet
      const sw = Math.sin(t * 7) * 2;
      cx.strokeStyle = c1; cx.lineWidth = 1.1; cx.beginPath(); cx.moveTo(hand.x, hand.y); cx.quadraticCurveTo(hand.x + sw, hand.y + 8, hand.x + sw * 1.5, hand.y + 15); cx.stroke();
      if(NSK.ph !== 'wind'){                                                                           // THE LAUNCHED STRING: from the puppet's hand along the aim, a sharp bright tip, trailing back to the puppet
        const ox = NSK.px, oy = NSK.py;
        cx.save(); cx.lineCap = 'round'; cx.shadowColor = '#ffd479'; cx.shadowBlur = 7;
        NSK.ang.forEach((sg, i) => {                                                                     // one string per finger: 10 needles fanned out from the puppet
          const a = sg.a, ln = Math.min(NSK.tip, NSK.d.range * sg.L), ux = Math.cos(a), uy = Math.sin(a), tx = ox + ux * ln, ty = oy + uy * ln, wob = NSK.ph === 'out' ? 0 : Math.sin(t * 40 + i) * 1.1;
          cx.strokeStyle = 'rgba(255,236,170,.95)'; cx.lineWidth = 1.2; cx.beginPath(); cx.moveTo(ox, oy); cx.lineTo(tx - uy * wob, ty + ux * wob); cx.stroke();
          cx.fillStyle = '#fff6d6'; cx.beginPath(); cx.moveTo(tx + ux * 6, ty + uy * 6); cx.lineTo(tx - uy * 1.8, ty + ux * 1.8); cx.lineTo(tx - ux * 1.6, ty - uy * 1.6); cx.lineTo(tx + uy * 1.8, ty - ux * 1.8); cx.closePath(); cx.fill();   // needle tip
        });
        cx.restore();
      }
    }
    if(f.fc){                                                                                          // THE FINAL CURTAIN: the strings are cut from his hands. Loose ends dangle from his fingers, the monster's strings float up, free
      cx.setLineDash([]); cx.lineCap = 'round';
      [hand, handF].forEach((hd, i) => { const sw = Math.sin(t * 2.6 + i * 1.9) * 4; cx.strokeStyle = 'rgba(255,230,160,.8)'; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(hd.x, hd.y); cx.bezierCurveTo(hd.x + sw, hd.y + 8, hd.x - sw, hd.y + 18, hd.x + sw * 1.4, hd.y + 28); cx.stroke(); });
      [top, hl, hr2].forEach((a, i) => { const L = 26 + 10 * i, sw = Math.sin(t * 2.2 + i * 2.1); cx.strokeStyle = 'rgba(216,201,168,.6)'; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(a.x, a.y); cx.bezierCurveTo(a.x + sw * 6, a.y - L * .35, a.x - sw * 6, a.y - L * .7, a.x + sw * 3, a.y - L); cx.stroke(); });
    }
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
    if(f.mbT > 0){                                                                                       // PERFORMANCE BUFF: golden spotlight + rising sparkles around the puppet
      const pu = .5 + .5 * Math.sin(t * 9), r = (17 + 3 * pu) * sc, g = cx.createRadialGradient(P.x, P.y - 10 * sc, 2, P.x, P.y - 10 * sc, r);
      g.addColorStop(0, 'rgba(255,214,120,' + (.3 + .15 * pu) + ')'); g.addColorStop(1, 'rgba(255,214,120,0)'); cx.fillStyle = g; cx.beginPath(); cx.arc(P.x, P.y - 10 * sc, r, 0, 7); cx.fill();
      for(let i = 0; i < 5; i++){ const k = (t * .9 + i / 5) % 1; cx.fillStyle = 'rgba(255,236,170,' + (1 - k) + ')'; cx.fillRect(P.x + Math.sin(i * 2.3 + t) * 9 * sc, P.y - 4 * sc - k * 26 * sc, 1.6, 1.6); }
    }
    if(focus){                                                                                           // charge meter over the puppet: 4 tiers (25 / 50 / 75 / 100 %), the % grows as you hold
      const cl = P.cl, bw = 30, bx = P.x - bw / 2, by = P.y - an.lift - 34 * sc - 9, full = cl >= 1, pu = .5 + .5 * Math.sin(t * 20);
      cx.fillStyle = 'rgba(0,0,0,.55)'; cx.fillRect(bx - 1, by - 1, bw + 2, 6);
      cx.fillStyle = full ? 'rgba(255,240,190,' + (.7 + .3 * pu) + ')' : '#ff9a3a'; cx.fillRect(bx, by, bw * cl, 4);
      cx.fillStyle = 'rgba(0,0,0,.7)'; [.25, .5, .75].forEach(q => cx.fillRect(bx + bw * q - .4, by, .8, 4));
      cx.save(); cx.textAlign = 'center'; cx.font = '700 7px system-ui'; cx.lineWidth = 2; cx.strokeStyle = '#000'; cx.fillStyle = full ? '#fff2c4' : '#ffd1a0';
      const txt = full ? 'MAX' : Math.round(cl * 100) + '%'; cx.strokeText(txt, P.x, by - 2); cx.fillText(txt, P.x, by - 2); cx.restore();
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

  // ---- PELLORIN'S LOOK: Victorian ringmaster. Palette + small drawing helpers (visual only). ----
  const COAT = '#2b2336', COAT_FAR = '#18121f', TROUSER = '#241d2d', TROUSER_FAR = '#16111c', BOOT = '#08060a';
  const LINING = '#85122a', IVORY = '#e8dcc2', SHIRT = '#f4eee0', EMB = '#efe5cc';
  const SKIN = '#ecdfca', SKIN_SH = '#d6c5aa', HAIR = '#07050a', THREAD = '#120a0f', MOUTH = '#240a10', EDGE = '#0b0f1c';
  const GOLD_HI = '#fff1bb';
  const AW = {u:3.5, f:3.2, hand:2.4, ow:.8};          // sleeve widths / hand radius / outline (same numbers as body below: the near arm is redrawn over his face)

  const qb = (p0, c, p1, u) => ({x:(1 - u) * (1 - u) * p0.x + 2 * (1 - u) * u * c.x + u * u * p1.x, y:(1 - u) * (1 - u) * p0.y + 2 * (1 - u) * u * c.y + u * u * p1.y});
  function goldBtn(cx, x, y, r){                          // polished gold button
    cx.fillStyle = EDGE; cx.beginPath(); cx.arc(x, y, r + .5, 0, 7); cx.fill();
    cx.fillStyle = GOLD; cx.beginPath(); cx.arc(x, y, r, 0, 7); cx.fill();
    cx.fillStyle = GOLD_HI; cx.beginPath(); cx.arc(x - r * .3, y - r * .32, r * .38, 0, 7); cx.fill();
  }
  // tailcoat body in torso space (origin = pelvis, up = -y, x = forward). L = torso length.
  function coatPath(cx, L){
    cx.beginPath(); cx.moveTo(-3.1, 3.6);
    cx.quadraticCurveTo(-2.2, -L * .38, -3.5, -L + 1.3);          // back, pinched at the waist
    cx.quadraticCurveTo(-3.7, -L - .5, -1.6, -L - .6);            // narrow shoulder
    cx.lineTo(1.6, -L - .6);
    cx.quadraticCurveTo(3.7, -L - .5, 3.6, -L + 1.3);
    cx.quadraticCurveTo(3.1, -L * .5, 2.5, -3.2);                 // chest to the waist
    cx.quadraticCurveTo(2.9, 1.4, .3, 4.1);                       // cutaway front hem
    cx.quadraticCurveTo(-1.4, 4.6, -3.1, 3.6); cx.closePath();
  }
  // sleeve end: fine ivory embroidery rings + a gold cuff stud. q = arm {el, hand}. Drawn in fighter space.
  function cuff(cx, q, far){
    const dx = q.hand.x - q.el.x, dy = q.hand.y - q.el.y, n = Math.hypot(dx, dy) || 1, ux = dx / n, uy = dy / n, px = -uy, py = ux;
    const at = (d, o) => ({x:q.hand.x - ux * d + px * o, y:q.hand.y - uy * d + py * o}), hw = AW.f / 2 + .15;
    cx.save(); cx.lineCap = 'butt';
    cx.strokeStyle = far ? 'rgba(239,229,204,.75)' : EMB; cx.lineWidth = .55;
    [AW.hand + 1.2, AW.hand + 3.1].forEach(d => { const a = at(d, -hw), b = at(d, hw); cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); cx.stroke(); });
    cx.setLineDash([.5, .5]); cx.lineWidth = .45;
    const m0 = at(AW.hand + 1.2, 0), m1 = at(AW.hand + 3.1, 0);     // dotted trim between the rings, both edges
    [-hw * .55, hw * .55].forEach(o => { const a = at(AW.hand + 1.2, o), b = at(AW.hand + 3.1, o); cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); cx.stroke(); });
    cx.setLineDash([]);
    const g = at(AW.hand + 2.15, 0); if(!far) goldBtn(cx, g.x, g.y, .6);
    cx.restore();
  }
  // face on the head, in the head's own tilted space (origin = head centre, x = forward). Pale ivory skin, void eyes, sewn grin, slicked hair.
  function face(cx, t){
    // skin: faint shadows + small imperfections (no gloss, nothing porcelain)
    cx.fillStyle = 'rgba(120,92,74,.16)'; cx.beginPath(); cx.ellipse(1.0, 1.6, 2.4, .9, .15, 0, 7); cx.fill();            // cheekbone hollow
    cx.fillStyle = 'rgba(96,64,78,.24)'; cx.beginPath(); cx.ellipse(2.6, .35, 1.8, .5, .35, 0, 7); cx.fill();              // tired shadow under the eye
    cx.fillStyle = 'rgba(112,84,66,.55)'; [[3.3, 1.2, .24], [.8, .2, .18], [1.6, 5.0, .18], [4.2, .2, .16]].forEach(([x, y, r]) => { cx.beginPath(); cx.arc(x, y, r, 0, 7); cx.fill(); });
    cx.fillStyle = SKIN_SH; cx.strokeStyle = 'rgba(40,24,30,.65)'; cx.lineWidth = .45;                                    // ear
    cx.beginPath(); cx.ellipse(-2.5, .5, .9, 1.4, .1, 0, 7); cx.fill(); cx.stroke();
    cx.fillStyle = SKIN; cx.strokeStyle = EDGE; cx.lineWidth = .8; cx.lineJoin = 'round';                                  // sharp nose
    cx.beginPath(); cx.moveTo(5.0, -.6); cx.lineTo(7.0, 1.6); cx.lineTo(5.2, 2.0); cx.closePath(); cx.fill(); cx.stroke();
    cx.fillStyle = SKIN; cx.beginPath(); cx.moveTo(4.9, -.4); cx.lineTo(6.2, 1.3); cx.lineTo(5.1, 1.8); cx.closePath(); cx.fill();
    // sharp slanted void eyes: solid black, no pupil / iris / sclera / glow. Outer corner high, inner corner low.
    cx.fillStyle = '#000';
    cx.beginPath(); cx.moveTo(.1, -1.8); cx.lineTo(1.9, -1.4); cx.lineTo(3.2, -.1); cx.lineTo(1.8, -.45); cx.closePath(); cx.fill();
    cx.beginPath(); cx.moveTo(3.8, -1.2); cx.lineTo(4.7, -.7); cx.lineTo(4.7, .1); cx.lineTo(3.9, -.3); cx.closePath(); cx.fill();
    cx.strokeStyle = HAIR; cx.lineWidth = .45; cx.lineCap = 'round';                                                       // thin brow
    cx.beginPath(); cx.moveTo(-.4, -2.6); cx.lineTo(3.2, -1.3); cx.stroke(); cx.beginPath(); cx.moveTo(3.7, -1.6); cx.lineTo(4.8, -1.2); cx.stroke();
    // GRUESOME PUPPET SMILE: a very wide crescent, corners pulled up toward both cheeks
    const A = {x:-.3, y:2.6}, B = {x:4.7, y:2.5}, cU = {x:2.2, y:4.0}, cL = {x:2.2, y:6.1};
    cx.fillStyle = MOUTH; cx.beginPath(); cx.moveTo(A.x, A.y); cx.quadraticCurveTo(cL.x, cL.y, B.x, B.y); cx.quadraticCurveTo(cU.x, cU.y, A.x, A.y); cx.closePath(); cx.fill();
    cx.strokeStyle = THREAD; cx.lineWidth = .32; cx.lineCap = 'round';                                                    // fine dark stitches across the lips, uneven spacing
    [.14, .26, .37, .52, .63, .78, .88].forEach((u, i) => {
      const a = qb(A, cU, B, u), b = qb(A, cL, B, u), j = Math.sin(i * 7.3) * .3, k = .25 + .15 * Math.sin(i * 3.1);
      cx.beginPath(); cx.moveTo(a.x + j, a.y - k); cx.lineTo(b.x - j * .6, b.y + k * .9); cx.stroke();
    });
    cx.lineWidth = .5;                                                                                                      // larger, uneven X stitches at both corners
    cx.beginPath(); cx.moveTo(-1.3, 1.8); cx.lineTo(.6, 3.7); cx.moveTo(-1.1, 3.6); cx.lineTo(.5, 1.9); cx.stroke();
    cx.beginPath(); cx.moveTo(3.9, 1.7); cx.lineTo(5.4, 3.4); cx.moveTo(4.1, 3.5); cx.lineTo(5.3, 2.0); cx.stroke();
    cx.lineWidth = .32; cx.beginPath(); cx.moveTo(-.3, 2.6); cx.lineTo(-1.9, 2.0); cx.moveTo(4.7, 2.5); cx.lineTo(5.6, 1.9); cx.stroke();   // pulled cheek seams
  }
  function hair(cx, white){                              // short, neat, jet-black, slicked straight back
    cx.beginPath(); cx.moveTo(3.7, -3.5);
    cx.quadraticCurveTo(5.0, -5.4, 2.3, -6.7); cx.quadraticCurveTo(-1.3, -8.0, -4.7, -5.4);
    cx.quadraticCurveTo(-7.1, -3.0, -6.4, .9); cx.quadraticCurveTo(-6.0, 2.7, -4.4, 3.1);
    cx.quadraticCurveTo(-4.0, .8, -2.7, -.7); cx.quadraticCurveTo(-.2, -2.0, 1.0, -3.3); cx.quadraticCurveTo(2.4, -4.3, 3.7, -3.5); cx.closePath();
    cx.fillStyle = white ? '#fff' : HAIR; cx.fill(); cx.strokeStyle = EDGE; cx.lineWidth = .8; cx.lineJoin = 'round'; cx.stroke();
    if(white) return;
    cx.strokeStyle = 'rgba(70,60,84,.65)'; cx.lineWidth = .35; cx.lineCap = 'round';   // faint comb lines (no shine)
    [[3.0, -5.4, -.4, -6.7, -4.4, -4.6], [2.9, -4.4, -.6, -5.4, -5.3, -2.4], [1.6, -3.6, -1.6, -4.2, -5.7, -.6]].forEach(([x0, y0, cxx, cy, x1, y1]) => { cx.beginPath(); cx.moveTo(x0, y0); cx.quadraticCurveTo(cxx, cy, x1, y1); cx.stroke(); });
  }

  Characters.art('pellorin', {
    // SLIM PERFORMER: tall and narrow. Same joint lengths as before, so hands / feet / ground contact keep their numbers; only the widths shrink. Hitbox is still 30x52 (arena.js is not changed per character).
    body: {head:{r:5.8}, torso:{len:13, w:8.4}, uArm:{len:9.5, w:AW.u}, fArm:{len:9.5, w:AW.f}, hand:{r:AW.hand}, shN:1, shF:-3.5, thigh:{len:11, w:4.5}, shin:{len:10.5, w:3.9}, foot:{len:7.5, w:3.2}, outlineW:AW.ow},
    colors: {shirt:COAT, limb:COAT, far:COAT_FAR, legs:TROUSER, legsFar:TROUSER_FAR, head:SKIN, dark:BOOT, hand:SKIN},

    // THE FINAL CURTAIN (arena.js drawF calls this INSTEAD of the ragdoll while f.fc is on): the floating dancer (a separate ragdoll, f.fc.ghost) + the monster body + the bars.
    fcDraw(cx, f, t){
      const S = f.fc, g = S.ghost, d = S.d, k = clamp(S.t / d.rise, 0, 1), e = k * k * (3 - 2 * k);
      g.x = lerp(S.x0, S.px, e); g.y = lerp(S.y0, S.py, e) + Math.sin(t * 2.1) * 4 * e; g.face = Math.sign(f.x - g.x) || g.face; g.vx = 70 * e; g.atk = .5; g.gr = false;
      cx.save();
      cx.fillStyle = 'rgba(0,0,0,' + clamp(.32 - (S.gy - g.y) / 700, .1, .3) + ')'; cx.beginPath(); cx.ellipse(g.x, S.gy + .5, 14, 3.4, 0, 0, 7); cx.fill();   // his shadow far below
      const gl = cx.createRadialGradient(g.x, g.y - 26, 4, g.x, g.y - 26, 50); gl.addColorStop(0, 'rgba(255,212,121,.24)'); gl.addColorStop(1, 'rgba(255,212,121,0)');   // stage light on him
      cx.fillStyle = gl; cx.beginPath(); cx.arc(g.x, g.y - 26, 50, 0, 7); cx.fill();
      const cyc = t % 3, tw = cyc < 1 ? cyc : 0, cs = Math.cos(tw * 2 * Math.PI), sxw = (cs < 0 ? -1 : 1) * Math.max(.2, Math.abs(cs));   // a pirouette every 3 s
      cx.globalAlpha = 1; cx.translate(g.x, g.y - 28); cx.rotate(Math.sin(t * 1.7) * .1); cx.scale(sxw, 1); cx.translate(-g.x, -(g.y - 28));
      Body.draw(cx, g, t);
      cx.restore();
      const hd = g.handW || {N:{x:g.x, y:g.y - 30}, F:{x:g.x, y:g.y - 30}};
      tick(f); cx.save(); drawWorld(cx, f, hd.N, t, hd.F); cx.restore();                     // the monster
      const bw = 46, bx = f.x - bw / 2, by = f.y - f.h - 40, hr = clamp(S.hp / S.max, 0, 1), tr = clamp(1 - S.t / d.duration, 0, 1);   // its HP + time left
      cx.save(); cx.globalAlpha = 1;
      cx.fillStyle = 'rgba(0,0,0,.6)'; cx.fillRect(bx - 1, by - 1, bw + 2, 10);
      cx.fillStyle = hr > .5 ? '#c07bff' : hr > .25 ? '#f5c542' : '#ff4d5e'; cx.fillRect(bx, by, bw * hr, 5);
      cx.fillStyle = GOLD; cx.fillRect(bx, by + 6, bw * tr, 2);
      cx.restore();
    },

    spring(p, A){ if(A.dance) return {k:60, d:9}; if(A.chg > 0 && p <= CP + .004) return {k:200, d:20}; },

    // his near hand works like a puppeteer: lifts, flicks, twirls, yanks down. Legs keep the normal walk / idle pose.
    attack(tg, p, A, Kf){
      if(A.dance){ dance(tg); return; }                              // THE FINAL CURTAIN: the floating dancer
      const L = A.cl || 0;
      if(A.chg > 0 && p <= CP + .004){                               // FOCUS: hand up high and shaking, leaning back a bit
        Object.assign(tg, {aN:2.55 + Math.sin(A.chg * 38) * .05 * (1 + L), eN:.35, lean:-.1 - .06 * L, head:-.12, aF:2.35 + Math.sin(A.chg * 38 + 1.6) * .05 * (1 + L), eF:.4});   // BOTH hands up, shaking
        return;
      }
      if(A.skill === 'grandentrance'){                               // THE GRAND ENTRANCE: both hands rise like a conductor, sweep out toward the spot, then yank down together at the stomp
        Object.assign(tg, {aN:Kf(p, [[0,.6],[.12,2.5],[.3,2.6],[.4,1.4],[.62,1.4],[.72,.5],[1,.6]]), eN:Kf(p, [[0,.5],[.12,.3],[.3,.3],[.4,.2],[.72,.2],[1,.5]]),
          aF:Kf(p, [[0,-.1],[.12,2.3],[.3,2.4],[.4,1.3],[.62,1.3],[.72,.4],[1,-.1]]), eF:Kf(p, [[0,.5],[.3,.3],[1,.5]]), lean:Kf(p, [[0,.05],[.12,-.15],[.3,-.18],[.4,.15],[.72,.3],[1,.05]])}); tg.head = -tg.lean * .4; return;
      }
      if(A.skill === 'nostrings'){                                   // NO STRINGS DETACHED: hand snaps back (cutting the string), then points the way the string flies, then reaches out again to reconnect
        Object.assign(tg, {aN:Kf(p, [[0,.6],[.08,1.2],[.14,.7],[.25,1.7],[.7,1.7],[.85,1.2],[1,.6]]), eN:Kf(p, [[0,.5],[.08,1.3],[.14,1.2],[.25,.3],[.7,.3],[1,.5]]),
          aF:Kf(p, [[0,-.1],[.14,.4],[.3,.2],[1,-.1]]), eF:.5, lean:Kf(p, [[0,.05],[.14,-.1],[.25,.18],[.75,.15],[1,.05]])}); tg.head = -tg.lean * .4; return;
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

    // TAILCOAT (drawn by body.js INSTEAD of the plain torso capsule): neck, black fitted coat, ivory lapels + embroidery, red lining, ruffled shirt, red cravat, gold buttons.
    // Drawn here (under the head and the near arm) so the arm and the head still cover it correctly.
    torso(cx, S, B, P, white){
      const L = B.torso.len, ow = B.outlineW;
      Body.capsule(cx, S.sh, S.head, 3.4 + ow * 2, B.outline); Body.capsule(cx, S.sh, S.head, 3.4, white ? '#fff' : SKIN_SH);   // neck
      cx.save(); cx.translate(S.pel.x, S.pel.y); cx.rotate(S.lean);
      coatPath(cx, L); cx.fillStyle = white ? '#fff' : COAT; cx.fill();
      if(!white){
        cx.save(); coatPath(cx, L); cx.clip();
        cx.strokeStyle = LINING; cx.lineWidth = 2.2; cx.lineCap = 'round';                                                    // deep-red lining along the cutaway hem
        cx.beginPath(); cx.moveTo(2.5, -3.2); cx.quadraticCurveTo(2.9, 1.4, .3, 4.1); cx.quadraticCurveTo(-1.4, 4.6, -3.1, 3.6); cx.stroke();
        cx.fillStyle = SHIRT; cx.beginPath(); cx.moveTo(1.3, -L - .7); cx.lineTo(4.2, -L - .7); cx.lineTo(4.2, -L * .55); cx.lineTo(3.0, -L * .33); cx.lineTo(2.2, -L * .5); cx.closePath(); cx.fill();   // shirt front
        cx.fillStyle = SHIRT; cx.strokeStyle = 'rgba(40,24,30,.55)'; cx.lineWidth = .4;                                       // subtle ruffles down the shirt front
        for(let i = 0; i < 4; i++){ const y = -L + 3.7 + i * 1.5; cx.beginPath(); cx.arc(1.7 + (i % 2) * .35, y, .85, Math.PI * .5, Math.PI * 1.5); cx.fill(); cx.stroke(); }
        cx.fillStyle = IVORY; cx.strokeStyle = THREAD; cx.lineWidth = .5; cx.lineJoin = 'round';                              // ivory lapel
        cx.beginPath(); cx.moveTo(-.3, -L - .7); cx.lineTo(1.5, -L - .7); cx.lineTo(2.4, -L * .52); cx.lineTo(2.9, -3.9); cx.lineTo(1.7, -4.3); cx.lineTo(.2, -L * .62); cx.closePath(); cx.fill(); cx.stroke();
        cx.strokeStyle = EMB; cx.lineWidth = .5; cx.setLineDash([.6, .5]);                                                    // fine ivory embroidery along the lapel edge
        cx.beginPath(); cx.moveTo(-1.3, -L + .2); cx.quadraticCurveTo(-1.2, -L * .66, .5, -4.3); cx.stroke(); cx.setLineDash([]);
        cx.restore();
      }
      coatPath(cx, L); cx.lineWidth = ow * 1.5; cx.strokeStyle = B.outline; cx.lineJoin = 'round'; cx.stroke();
      if(!white){
        goldBtn(cx, .2, -5.4, .75); goldBtn(cx, .3, -3.0, .75);                                                               // polished gold buttons
        cx.fillStyle = IVORY; cx.strokeStyle = THREAD; cx.lineWidth = .4;                                                     // collar points
        cx.beginPath(); cx.moveTo(-.9, -L - .5); cx.lineTo(.2, -L - 3.3); cx.lineTo(1.0, -L - .3); cx.closePath(); cx.fill(); cx.stroke();
        cx.beginPath(); cx.moveTo(2.4, -L - .5); cx.lineTo(2.1, -L - 3.1); cx.lineTo(1.2, -L - .3); cx.closePath(); cx.fill(); cx.stroke();
        cx.fillStyle = LINING; cx.strokeStyle = EDGE; cx.lineWidth = .6;                                                      // deep-red cravat: flap + knot
        cx.beginPath(); cx.moveTo(.2, -L - .2); cx.lineTo(2.4, -L - .2); cx.lineTo(2.1, -L + 3.6); cx.lineTo(1.2, -L + 2.7); cx.lineTo(.3, -L + 3.8); cx.closePath(); cx.fill(); cx.stroke();
        cx.beginPath(); cx.ellipse(1.3, -L - 1.2, 2.3, 1.4, 0, 0, 7); cx.fill(); cx.stroke();
        cx.fillStyle = GOLD; cx.beginPath(); cx.arc(1.3, -L + .5, .45, 0, 7); cx.fill();                                      // cravat pin
      }
      cx.restore();
    },

    // SPLIT COAT TAILS (not a cape): two narrow tapered panels from the waist with a red V between them. They trail behind when he runs, lift when he falls, sway when idle.
    behind(cx, f, t, S, P){
      const white = f.flash > 0, st = f._tl || (f._tl = {x:0, l:1, t:t});
      const dt = clamp(t - st.t, 0, .05); st.t = t;
      const vf = f.vx * f.face, air = !f.gr, k = Math.min(1, dt * 9);
      st.x += (-clamp(vf * .05, -3, 9) - S.lean * 5 - st.x) * k;
      st.l += ((air ? clamp(1 - f.vy / 1100, .62, 1.12) : 1 - clamp(Math.abs(vf) * .0012, 0, .12)) - st.l) * k;
      const sw = Math.sin(t * 2.4) * .9 + Math.sin(t * 7.3) * clamp(Math.abs(vf) * .004, 0, 1.2), Lt = 15.5 * st.l;
      const c = Math.cos(S.lean), s = Math.sin(S.lean), loc = (x, y) => ({x:S.pel.x + x * c - y * s, y:S.pel.y + x * s + y * c});
      const panel = (a, b, tx, ty, wd, col) => {
        const tl = {x:tx - wd, y:ty}, tr = {x:tx + wd, y:ty - .3};
        cx.beginPath(); cx.moveTo(a.x, a.y); cx.quadraticCurveTo((a.x + tl.x) / 2 + sw * .4, (a.y + ty) / 2 - 1, tl.x, tl.y); cx.lineTo(tx, ty - 2.2); cx.lineTo(tr.x, tr.y);
        cx.quadraticCurveTo((b.x + tr.x) / 2 + sw * .4, (b.y + ty) / 2 - 1, b.x, b.y); cx.closePath();
        cx.fillStyle = col; cx.fill(); cx.strokeStyle = EDGE; cx.lineWidth = 1.1; cx.lineJoin = 'round'; cx.stroke();
      };
      const a0 = loc(-3.6, -3.6), a1 = loc(-1.2, -3.1), b1 = loc(1.3, -2.7);
      const tAx = a0.x + 1.2 + st.x * 1.2 - 3.0 + sw, tBx = a1.x + 1.3 + st.x * .8 - .2 - sw * .6, tBy = a1.y + Lt * .93;
      if(!white){ cx.fillStyle = LINING; cx.beginPath(); cx.moveTo(a1.x, a1.y); cx.lineTo(tAx + 1.7, a0.y + Lt); cx.lineTo(tBx - 1.7, tBy); cx.closePath(); cx.fill(); }   // red lining between the tails
      panel(a0, a1, tAx, a0.y + Lt, 1.7, white ? '#fff' : COAT_FAR);
      panel(a1, b1, tBx, tBy, 1.7, white ? '#fff' : COAT);
    },

    front(cx, f, t, S, P){
      const white = f.flash > 0;
      const hw = {N:{x:f.x + f.face * S.aN.hand.x, y:f.y + S.aN.hand.y}, F:{x:f.x + f.face * S.aF.hand.x, y:f.y + S.aF.hand.y}};
      f.handW = hw;

      // head: face + hair (drawn in the head's own tilted space)
      const h = S.head, ang = Math.atan2(h.x - S.sh.x, -(h.y - S.sh.y));
      cx.save(); cx.translate(h.x, h.y); cx.rotate(ang);
      if(!white) face(cx, t);
      hair(cx, white);
      cx.restore();

      // near arm again, ON TOP of the face (so a raised arm covers the head correctly), with the embroidered cuff
      const q = S.aN, ow = AW.ow;
      Body.capsule(cx, q.s, q.el, AW.u + ow * 2, EDGE); Body.capsule(cx, q.s, q.el, AW.u, white ? '#fff' : COAT);
      Body.capsule(cx, q.el, q.hand, AW.f + ow * 2, EDGE); Body.capsule(cx, q.el, q.hand, AW.f, white ? '#fff' : COAT);
      if(!white){
        cx.fillStyle = 'rgba(0,0,0,.4)'; cx.strokeStyle = 'rgba(0,0,0,.35)'; cx.lineWidth = 1; cx.beginPath(); cx.arc(q.el.x, q.el.y, AW.f * .3, 0, 7); cx.stroke();
        cuff(cx, q, false);
      }
      cx.fillStyle = EDGE; cx.beginPath(); cx.arc(q.hand.x, q.hand.y, AW.hand + ow, 0, 7); cx.fill();
      cx.fillStyle = white ? '#fff' : SKIN; cx.beginPath(); cx.arc(q.hand.x, q.hand.y, AW.hand, 0, 7); cx.fill();
      if(!white){                                                                                      // far cuff, only when that sleeve is clear of the body and head
        const fa = S.aF, ax = S.sh.x - S.pel.x, ay = S.sh.y - S.pel.y, tt = clamp(((fa.hand.x - S.pel.x) * ax + (fa.hand.y - S.pel.y) * ay) / (ax * ax + ay * ay), 0, 1);
        if(Math.hypot(fa.hand.x - (S.pel.x + ax * tt), fa.hand.y - (S.pel.y + ay * tt)) > 6 && Math.hypot(fa.hand.x - h.x, fa.hand.y - h.y) > 9) cuff(cx, fa, true);
      }

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