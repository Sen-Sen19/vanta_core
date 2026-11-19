// ERRATA art - The Broken Entity.
// Slim, tall, lightweight humanoid entity using the shared ragdoll skeleton (body.js).
// Combat style: Telekinetic Glass Shards.
// - Normal attacks: commands independent glass shards that launch with varied organic trajectory arcs
//   ONLY in her facing direction, with limited short range (~82px).
// - Held-key attack: Goku Super Saiyan focus crouch where all revolving shards freeze in mid-air,
//   releasing into an outstretched single-hand aim where all shards surge through her hand!
(() => {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const state = f => f.erState || (f.erState = {air:false, vy:0, pvy:0, t0:0, landT:-9, dip:0, face:f.face});

  const R = .32, C = .58;
  const MAX_REACH = 72; // Strict short range (semi-melee reach)
  const SHARD_SPEED = 340; // was 720 (shards were visible for ~4 frames)

  const chopA = (a0, v) => [[0, a0], [.08, lerp(a0, v[0], .4)], [R, v[0]], [C - .04, v[1]], [C + .1, v[2]], [C + .3, v[2] - .1], [1, a0]];
  const chopE = (e0, v) => [[0, e0], [R, v[0]], [C - .04, v[1]], [C + .1, v[2]], [C + .3, v[2] + .2], [1, e0]];

  // READY / IDLE base angles
  const G0 = {lean:.08, aN:.25, eN:.50, aF:-.12, eF:.52, tN:.22, kN:.20, tF:-.18, kF:.20};

  // COMMAND GESTURE POSES (short-range conducting gestures)
  const mkGesture = (lead, v) => {
    const off = lead === 'N' ? 'F' : 'N';
    return {
      lead,
      aLead: chopA(G0['a' + lead], v.a),
      eLead: chopE(G0['e' + lead], v.e),
      aOff:  chopA(G0['a' + off], v.a2),
      eOff:  chopE(G0['e' + off], v.e2),
      lean:  [[0, G0.lean], [R, v.lL], [C - .04, v.lC - .06], [C + .1, v.lC + .06], [C + .3, v.lC], [1, G0.lean]],
      tN:    [[0, G0.tN], [R, .35], [C, v.tN || .65], [1, G0.tN]],
      kN:    [[0, G0.kN], [R, .70], [C, v.kN || .35], [1, G0.kN]],
      tF:    [[0, G0.tF], [R, -.35], [C, v.tF || -.45], [1, G0.tF]],
      kF:    [[0, G0.kF], [R, .30], [C, v.kF || .16], [1, G0.kF]]
    };
  };

  const GESTURES = [
    // STEP 0: Near-hand sharp command flick — index finger jabs forward, far arm guards behind
    // "Point and send" — precise, quick, one-handed directive
    mkGesture('N', {
      a:[.08, 1.52, 1.44],  e:[.72, .10, .08],      // near arm: windups low, snaps forward extended
      a2:[-.20, -.55, -.30], e2:[.60, .80, .72],     // far arm: pulls back to guard chest
      lL:-.10, lC:.22, tN:.28, kN:.28, tF:-.20, kF:.22  // slight forward lean, rooted
    }),

    // STEP 1: Far-hand rising arc slash — sweeps up then whips down overhead
    // "Conductor's baton" — elegant backhand from below, shards arc from above
    mkGesture('F', {
      a:[-1.0, .65, 2.20],  e:[1.0, .50, .12],      // far arm: starts low, sweeps high, whips forward
      a2:[.55, .20, .08],    e2:[.55, .90, .80],     // near arm: relaxed then tucks back
      lL:-.06, lC:.30, tN:.30, kN:.30, tF:-.22, kF:.25
    }),

    // STEP 2: Crane stance — one arm rises high overhead, opposite drops low and wide
    // "Vertical split command" — shards launch from two staggered heights, asymmetric and stylish
    mkGesture('N', {
      a:[-1.6, -1.2, .60],  e:[.30, .18, .22],      // near arm: sweeps overhead, reaching up
      a2:[1.2, 1.55, .90],  e2:[.90, .20, .18],     // far arm: drops wide and low, commanding downward
      lL:-.14, lC:.38, tN:.35, kN:.42, tF:-.30, kF:.34
    }),

    // STEP 3 FINISHER: Double-hand pull-and-slam — both arms sweep inward gathering shards,
    // then BOTH thrust forward simultaneously — the glass-shard grand slam!
    // Pose timeline: [windup→gather→slam→follow-through]
    {
      lead: 'N',
      // FINISHER: BOTH hands RAISE overhead (shards gather above them), HOLD, then SLAM forward together.
      //            0 -> raise (.32) -> hold (.50) -> slam (.60) -> follow-through (.74) -> recover
      aLead: [[0, G0.aN], [.16, 2.40], [.32, 3.00], [.50, 3.05], [.60, 1.55], [.74, 1.45], [1, G0.aN]],
      eLead: [[0, G0.eN], [.16, .50],  [.32, .25],  [.50, .25],  [.60, .08],  [.74, .10],  [1, G0.eN]],
      aOff:  [[0, G0.aF], [.16, 2.30], [.32, 2.90], [.50, 2.95], [.60, 1.50], [.74, 1.40], [1, G0.aF]],
      eOff:  [[0, G0.eF], [.16, .55],  [.32, .30],  [.50, .30],  [.60, .10],  [.74, .12],  [1, G0.eF]],
      lean:  [[0, G0.lean], [.32, -.12], [.50, -.18], [.60, .42], [.74, .38], [1, G0.lean]],
      tN:    [[0, G0.tN], [.32, .35], [.50, .30], [.60, .62], [1, G0.tN]],
      kN:    [[0, G0.kN], [.32, .55], [.50, .60], [.60, .30], [1, G0.kN]],
      tF:    [[0, G0.tF], [.32, -.25],[.50, -.28],[.60, -.45],[1, G0.tF]],
      kF:    [[0, G0.kF], [.32, .45], [.50, .45], [.60, .20], [1, G0.kF]]
    }
  ];

  // 10 UNIQUE IRREGULAR RAZOR GLASS SHARDS (Floating high around chest, shoulders, and head)
  const SHARD_SPECS = [
    {rad:22, hOff:-34, spd:2.2,  phi:0.0,  angOff: 0.12,  scale:1.0},
    {rad:28, hOff:-40, spd:-1.9, phi:1.25, angOff:-0.14,  scale:0.9},
    {rad:24, hOff:-36, spd:2.5,  phi:2.51, angOff: 0.18,  scale:1.1},
    {rad:30, hOff:-44, spd:-2.1, phi:3.77, angOff:-0.16,  scale:0.85},
    {rad:25, hOff:-32, spd:1.8,  phi:5.02, angOff: 0.10,  scale:1.15},
    {rad:29, hOff:-38, spd:-2.4, phi:0.63, angOff:-0.12,  scale:0.95},
    {rad:23, hOff:-42, spd:2.7,  phi:1.88, angOff: 0.15,  scale:0.8},
    {rad:28, hOff:-35, spd:-1.8, phi:3.14, angOff:-0.15,  scale:1.05},
    {rad:26, hOff:-46, spd:2.0,  phi:4.40, angOff: 0.08,  scale:1.2},
    {rad:31, hOff:-30, spd:-2.6, phi:5.65, angOff:-0.10,  scale:0.75}
  ];

  // Draw one individual razor-sharp glass shard with violet refraction
  function renderShard(cx, x, y, rot, scale, alpha, glow) {
    cx.save();
    cx.translate(x, y);
    cx.rotate(rot);
    cx.scale(scale, scale);

    const pts = [[-2.5, -6], [2.2, -6.5], [2.8, 5.5], [-1.2, 6.5], [-2.8, 1.2]];

    // Translucent obsidian / deep violet glass body
    cx.beginPath();
    cx.moveTo(pts[0][0], pts[0][1]);
    for(let i = 1; i < pts.length; i++) cx.lineTo(pts[i][0], pts[i][1]);
    cx.closePath();
    cx.fillStyle = `rgba(32, 14, 52, ${0.85 * alpha})`;
    cx.fill();

    // Subtle violet glow if powered
    if(glow > 0){
      cx.strokeStyle = `rgba(192, 132, 252, ${0.85 * glow * alpha})`;
      cx.lineWidth = 2.5;
      cx.stroke();
    }

    // Razor-sharp iridescent violet edge
    cx.strokeStyle = `rgba(168, 85, 247, ${0.9 * alpha})`;
    cx.lineWidth = 1.0;
    cx.stroke();

    // Internal facet reflection highlight
    cx.beginPath();
    cx.moveTo(pts[0][0] * .4, pts[0][1] * .6);
    cx.lineTo(pts[2][0] * .3, pts[2][1] * .5);
    cx.strokeStyle = `rgba(243, 232, 255, ${0.9 * alpha})`;
    cx.lineWidth = 0.8;
    cx.stroke();

    cx.restore();
  }

  // Draw curved violet refraction trail behind flying shard
  function drawShardTrail(cx, trail, alpha) {
    if(!trail || trail.length < 2) return;
    cx.save();
    cx.lineCap = 'round';
    for(let i = 1; i < trail.length; i++){
      const q = i / trail.length;
      cx.strokeStyle = `rgba(168, 85, 247, ${0.5 * q * alpha})`;
      cx.lineWidth = 1.2 + 2.0 * q;
      cx.beginPath();
      cx.moveTo(trail[i - 1].x, trail[i - 1].y);
      cx.lineTo(trail[i].x, trail[i].y);
      cx.stroke();
    }
    cx.restore();
  }

  // Initialize or retrieve persistent floating shards state
  function getShards(f){
    if(!f._errataShards){
      f._errataShards = SHARD_SPECS.map((sp, idx) => ({
        idx,
        state: 'orbit', // 'orbit' | 'frozen' | 'flying' | 'return'
        spec: sp,
        wx: f.x + Math.cos(sp.phi) * sp.rad,
        wy: f.y + sp.hOff,
        wrot: sp.phi,
        curOrbitAngle: sp.phi,
        vx: 0, vy: 0,
        startX: f.x,
        curveSign: (idx % 2 === 0 ? 1 : -1),
        trail: [],
        dmg: 0.3,
        depth: 0 // -1 behind, +1 front
      }));
      f._firedMask = 0;
      f._lastAtk = 0;
    }
    return f._errataShards;
  }

  // Launch a shard forward in facing direction with organic trajectory variations (strictly limited short range)
  function launchOrganicShard(s, f, spawnY, dmg, angleSpread, speedMul, hitstop, bigShake) {
    s.state = 'flying';
    s.trail = [];
    s.dmg = dmg;
    s.startX = f.x;
    s.isHeldKey = false;
    s.maxReach = MAX_REACH; // strictly short range (~72px semi-melee)
    s.hasHit = false;
    s.wx = f.x + f.face * 18;
    s.wy = spawnY;
    s.linger = 0;
    s.hs = hitstop || 0;
    s.shk = !!bigShake;

    // Direct forward only in facing direction, with slight angle variation
    const baseAng = f.face > 0 ? 0 : Math.PI;
    const launchAng = baseAng + (angleSpread || 0) * f.face;
    const spd = SHARD_SPEED * (speedMul || 1);
    s.vx = Math.cos(launchAng) * spd;
    s.vy = Math.sin(launchAng) * spd;
    s.wrot = launchAng + Math.PI / 2;
  }

  // FINISHER throw: the shard leaves from wherever it is gathered (above the raised hands) and is hurled at the enemy
  function throwShard(s, f, o, dmg, spread, hitstop) {
    s.state = 'flying';
    s.trail = [];
    s.dmg = dmg;
    s.startX = f.x;
    s.isHeldKey = false;
    s.hasHit = false;
    s.linger = 0;
    s.hs = hitstop || 0;
    s.shk = s.idx === 0;
    s.maxReach = 260;  // long enough to reach an enemy at normal fighting distance
    const tx = o ? o.x : f.x + f.face * 120, ty = o ? o.y - 26 : f.y - 30;
    let ang = Math.atan2(ty - s.wy, tx - s.wx);
    // never throw backwards, and keep the throw reasonably flat
    if(f.face > 0) ang = clamp(ang, -.9, .9); else ang = ang > 0 ? clamp(ang, Math.PI - .9, Math.PI) : clamp(ang, -Math.PI, -Math.PI + .9);
    ang += spread * f.face;
    const spd = 620;
    s.vx = Math.cos(ang) * spd;
    s.vy = Math.sin(ang) * spd;
    s.wrot = ang + Math.PI / 2;
  }

  // Update shard positions, organic flight, semi-melee range limit, and return orbits
  function updateShards(f, dt, t){
    const shards = getShards(f);
    const o = typeof G !== 'undefined' && G && G.f ? foeOf(f) : null;
    const A = f.A || {};
    const atk = f.atk > 0;
    const p = atk ? clamp(1 - f.atk / (A.time || .28), 0, 1) : 0;
    const charging = f.charging && f.chg > 0;
    const chgLvl = clamp((f.chg || 0) / ((f.A && f.A.chargeMax) || 1), 0, 1);

    const gatherNow = atk && (A.step || 0) === 3 && !(A.cl > 0) && p < .6;   // finisher windup: all shards gather above the raised hands

    // Reset hit mask when new attack starts
    if(f.atk > f._lastAtk + 1e-4){
      f._firedMask = 0;
      f._barrageFired = 0;
      f._atkHit = false;
    }
    f._lastAtk = f.atk;

    // 1. NORMAL COMBO: Launch individual shards with organic trajectory variations (facing direction only)
    if(atk && !charging && !(A.cl > 0)){
      const step = A.step || 0;
      let toFire = [];

      if(step === 0){
        // Step 0: Near-hand quick command — 2 shards, tight high grouping
        if(p >= .46 && !(f._firedMask & 1)){ f._firedMask |= 1; toFire.push({idx:0, yOff:-36, spread: 0.10}); }
        if(p >= .56 && !(f._firedMask & 2)){ f._firedMask |= 2; toFire.push({idx:1, yOff:-32, spread:-0.08}); }

      } else if(step === 1){
        // Step 1: Far-hand arc — 2 shards from above, one steeply angled one flat
        if(p >= .46 && !(f._firedMask & 1)){ f._firedMask |= 1; toFire.push({idx:2, yOff:-40, spread:-0.18}); }
        if(p >= .58 && !(f._firedMask & 2)){ f._firedMask |= 2; toFire.push({idx:3, yOff:-34, spread: 0.06}); }

      } else if(step === 2){
        // Step 2: Crane split — 3 shards from two heights (high + mid + low-mid)
        if(p >= .44 && !(f._firedMask & 1)){ f._firedMask |= 1; toFire.push({idx:4, yOff:-42, spread: 0.20}); }
        if(p >= .52 && !(f._firedMask & 2)){ f._firedMask |= 2; toFire.push({idx:5, yOff:-36, spread:-0.06}); }
        if(p >= .60 && !(f._firedMask & 4)){ f._firedMask |= 4; toFire.push({idx:6, yOff:-30, spread: 0.14}); }

      } else {
        // Step 3 FINISHER: hands raised -> shards gathered overhead -> SLAM: all 10 shards are THROWN at the enemy in a quick volley
        const spreads = [0, .08, -.08, .14, -.14, .04, -.04, .18, -.18, 0];
        for(let k = 0; k < 10; k++){
          if(p >= .58 + k * .02 && !(f._firedMask & (1 << k))){ f._firedMask |= (1 << k); toFire.push({idx:k, yOff:-38, spread:spreads[k], throwAt:true}); }
        }
      }

      const dmgEach = (A.dmg || 0.6) * ((A.step || 0) === 3 ? 0.30 : 0.45);
      toFire.forEach(item => {
        const s = shards[item.idx];
        if(item.throwAt || s.state === 'orbit' || s.state === 'return'){
          if(item.throwAt) throwShard(s, f, o, dmgEach, item.spread, (A.hitstop || 0) * .5);
          else launchOrganicShard(s, f, f.y + item.yOff, dmgEach, item.spread, 1.0, (A.hitstop || 0) * .6, false);
        }
      });
    }

    // 2. HELD-KEY RELEASE: Release ALL 10 shards as a LONG-RANGE projectile attack to pierce at once!
    const isChargeRelease = !f.charging && (f.chgDone || A.cl > 0) && (A.cl > 0 || f.chg >= 0.14) && !f._barrageFired && p >= (R - 0.05);
    if(isChargeRelease){
      f._barrageFired = 1;
      const cl = A.cl || clamp((f.chg || 0) / (A.chargeMax || 0.85), 0, 1);
      const shardDmg = 0.22 + 0.18 * cl;
      const handWx = f.x + f.face * 20;
      const handWy = f.y - 34; // Chest / aimed hand height!

      // ALL 10 SHARDS SURGE FORWARD SIMULTANEOUSLY IN A LONG-RANGE PIERCING CORRIDOR!
      shards.forEach((s, idx) => {
        s.state = 'flying';
        s.trail = [];
        s.dmg = shardDmg;
        s.startX = f.x;
        s.isHeldKey = true;
        s.maxReach = 540; // Long-range projectile attack across the arena!
        s.hasHit = false;
        // Channel tightly through the aimed hand
        s.wx = handWx + f.face * (idx * 2.2);
        s.wy = handWy + (idx - 4.5) * 2.2;
        const baseAng = f.face > 0 ? 0 : Math.PI;
        const spread = (idx - 4.5) * 0.022; // Tight piercing corridor
        const launchAng = baseAng + spread;
        const spd = 1050 + (idx % 3) * 50; // High speed long-distance stream
        s.vx = Math.cos(launchAng) * spd;
        s.vy = Math.sin(launchAng) * spd;
        s.wrot = launchAng + Math.PI / 2;
      });
    }

    // UPDATE EACH SHARD
    shards.forEach(s => {
      // Trail tracking
      if(s.state === 'flying'){
        s.trail.push({x: s.wx, y: s.wy});
        if(s.trail.length > 6) s.trail.shift();
      } else if(s.trail.length > 0){
        s.trail.shift();
      }

      if(s.state === 'flying'){
        // Organic gentle trajectory curve for normal attacks; held key flies straight
        if(!s.isHeldKey){
          s.wy += s.curveSign * Math.sin(t * 14 + s.idx) * 35 * dt;
        }
        s.wx += s.vx * dt;
        s.wy += s.vy * dt;
        if(s.linger > 0){ s.linger -= dt; if(s.linger <= 0){ s.state = 'return'; s.vy = -120; } return; }

        // RANGE LIMIT: short range (~82px) for normal hits; long range (480px) for held key!
        const dist = Math.abs(s.wx - s.startX);
        const reachLimit = s.maxReach || MAX_REACH;
        if(dist > reachLimit){
          s.state = 'return';
          return;
        }

        // Collision check (only hits in forward facing direction)
        if(o && (o.inv <= 0 || f._atkHit) && !s.hasHit && (typeof G === 'undefined' || !G || !G.over)){
          const forwardCheck = (o.x - f.x) * f.face > 0;
          const inX = Math.abs(s.wx - o.x) < o.w / 2 + 10;
          const inY = s.wy > o.y - o.h - 4 && s.wy < o.y + 4;
          if(forwardCheck && inX && inY){
            if(!s.hasHit){
              s.hasHit = true;
              if(typeof hurt === 'function'){
                f._atkHit = true; // follow-up shards of the same attack still land through the 0.15s i-frames
                hurt(o, {c:f.c, A:{dmg:s.dmg, kbx:s.isHeldKey ? 0.35 : 0.20, kby:s.isHeldKey ? 0.18 : 0.12, noShake:!s.shk && !s.isHeldKey, hitstop:s.isHeldKey ? .08 : s.hs}, face:f.face});
              }
              if(typeof G !== 'undefined' && G && G.parts){
                for(let k = 0; k < 3; k++){
                  G.parts.push({
                    x: s.wx, y: s.wy,
                    vx: (Math.random() - .5) * 320 + f.face * 80,
                    vy: (Math.random() - .8) * 220,
                    life: .35, col: '#c084fc'
                  });
                }
              }
            }

            // Normal shards stick in the target briefly (visible impact), then return; held-key pierces through
            if(!s.isHeldKey){
              s.vx *= 0.05; s.vy = 0;
              s.linger = .10;
            }
          }
        }
      } else if(s.state === 'return'){
        // Return arc back toward orbit
        const sp = s.spec;
        const targetWx = gatherNow ? f.x + f.face * 6 + Math.cos(s.curOrbitAngle) * 15 : f.x + Math.cos(s.curOrbitAngle) * sp.rad;
        const targetWy = gatherNow ? f.y - 70 + Math.sin(s.curOrbitAngle) * 7 : f.y + sp.hOff;
        const dist = Math.hypot(targetWx - s.wx, targetWy - s.wy);
        if(dist < 10){
          s.state = 'orbit';
        } else {
          s.wx += (targetWx - s.wx) * (16 * dt);
          s.wy += (targetWy - s.wy) * (16 * dt);
          s.wrot = s.curOrbitAngle + Math.PI / 2;
        }
      } else {
        // Orbit vs FAST ROTATION during Hold Charge
        const sp = s.spec;
        if(charging){
          // FAST ROTATION: Shards rotate rapidly around her as she powers up in Goku Super Saiyan stance!
          const dir = sp.spd >= 0 ? 1 : -1;
          const fastSpeed = dir * (Math.abs(sp.spd) + 8.5 + 14.0 * chgLvl);
          s.curOrbitAngle += fastSpeed * dt;
          const targetWx = f.x + Math.cos(s.curOrbitAngle) * sp.rad;
          const targetWy = f.y + sp.hOff;
          s.wx += (targetWx - s.wx) * (25 * dt);
          s.wy += (targetWy - s.wy) * (25 * dt);
          s.wrot = s.curOrbitAngle + Math.PI / 2;
          s.depth = Math.sin(s.curOrbitAngle);
        } else {
          // Normal elegant revolving orbit (finisher windup: shards gather in a tight spinning ring above the raised hands)
          const gather = gatherNow;
          s.curOrbitAngle += sp.spd * (gather ? 3 : 1) * dt;
          const targetWx = gather ? f.x + f.face * 6 + Math.cos(s.curOrbitAngle) * 15 : f.x + Math.cos(s.curOrbitAngle) * sp.rad;
          const targetWy = gather ? f.y - 70 + Math.sin(s.curOrbitAngle) * 7 : f.y + sp.hOff;
          s.wx += (targetWx - s.wx) * (20 * dt);
          s.wy += (targetWy - s.wy) * (20 * dt);
          s.wrot = s.curOrbitAngle + Math.PI / 2;
          s.depth = Math.sin(s.curOrbitAngle);
        }
      }
    });
  }

  Characters.art('errata', {
    // Tall, slender, delicate humanoid dimensions (52px shared hitbox)
    body: {
      head:  {r: 5.5},
      torso: {len: 15, w: 8},
      uArm:  {len: 11, w: 3.4},
      fArm:  {len: 11, w: 3},
      hand:  {r: 2.5},
      thigh: {len: 12, w: 4.5},
      shin:  {len: 12, w: 3.8},
      foot:  {len: 7,  w: 3}
    },

    // Dark, obsidian, deep violet glass palette
    colors: {
      shirt:   '#28143f', // dark violet glass body
      limb:    '#391b58',
      far:     '#1d0d2e',
      head:    '#c8acf0', // pale glass visage
      dark:    '#0c0614',
      hand:    '#1f0f30',
      legs:    '#1c0d2e',
      legsFar: '#12081f'
    },

    // Far arm drawn in front when: Step 1 (backhand arc lead), or Step 3 finisher (both arms slam forward)
    farFront: f => {
      if(!f.atk || !f.A) return false;
      const step = f.A.step || 0;
      return step === 1 || step === 3;
    },

    // Movement personality:
    // - Idle: Slightly tilted posture, subtle head tilt, delicate breathing
    // - Walk: Long, light strides
    // - Run: Lean forward with quick steps
    // - Land: Light impact and quick recovery
    pose(tg, f, t, run, K){
      const s = state(f);
      const ph = (f.rig && f.rig.phase) || 0;
      const sn = Math.sin(ph), cs = Math.cos(ph);
      const b = Math.sin(t * 1.8);

      if(s.air){ s.air = false; s.landT = t; s.dip = clamp(Math.abs(s.vy) / 600, .2, .6); }

      // IDLE: Slightly tilted posture (delicate tilt of head and torso, light resting arms)
      const IDLE = {
        lean: .08 + b * .015,
        head: -.07 + Math.sin(t * 1.8 + .5) * .03,
        aN: .18 + b * .03, eN: .42,
        aF: -.12 - b * .03, eF: .45,
        tN: .22, kN: .20 + (.5 + .5 * Math.sin(t * 3.6)) * .04,
        tF: -.18, kF: .20 + (.5 + .5 * Math.sin(t * 3.6 + 1.6)) * .04
      };

      // RUN: Lean forward with quick steps, long light strides
      const RUN = {
        lean: .36 + .03 * Math.cos(2 * ph),
        head: -.04,
        aN: -sn * .85, eN: .85 + .25 * cs,
        aF: sn * .85, eF: .85 - .25 * cs,
        tN: sn * 1.05 + .08, kN: .22 + 1.05 * Math.max(0, cs),
        tF: -sn * 1.05 + .08, kF: .22 + 1.05 * Math.max(0, -cs)
      };

      for(const k in IDLE) tg[k] = lerp(IDLE[k], RUN[k], run);

      // Light landing recovery
      const q = (t - s.landT) / .26;
      if(q < 1 && K){
        const d = K(q, [[0, 0], [.2, 1], [1, 0]]) * s.dip;
        tg.kN += .35 * d; tg.kF += .35 * d; tg.lean += .16 * d;
        return {k: 220, d: 20};
      }

      return {k: 160, d: 15};
    },

    // Air: Lightweight takeoff, flexible limbs in the fall
    air(tg, f, t){
      const s = state(f);
      s.air = true; s.vy = f.vy; s.pvy = f.vy;
      const m = clamp((f.vy + 240) / 480, 0, 1);
      tg.lean = lerp(.12, .04, m);
      tg.head = -.06;
      tg.aN = lerp(1.9, 1.2, m); tg.eN = .38;
      tg.aF = lerp(1.5, -0.7, m); tg.eF = .42;
      tg.tN = lerp(.60, .28, m); tg.kN = lerp(.85, .32, m);
      tg.tF = lerp(-.2, -.32, m); tg.kF = lerp(.55, .24, m);
      return {k: 140, d: 13};
    },

    // Knockback: Noticeable displacement due to low mass, quick re-stabilization
    hurt(tg, f, t){
      const hs = f.vx * f.face >= 0 ? 1 : -1;
      const q = clamp(f.stun / .26, 0, 1), r = 1 - q;
      tg.lean = .6 * hs * q + .08 * r;
      tg.head = -.45 * hs * q;
      tg.aN = -1.8 * hs * q + .3 * r; tg.eN = .5;
      tg.aF = -1.3 * hs * q + .2 * r; tg.eF = .6;
      tg.tN = -.6 * hs * q + .35 * r; tg.kN = .45;
      tg.tF = .6 * hs * q - .2 * r;   tg.kF = .45;
      return {k: 80 + 100 * r, d: 7 + 8 * r};
    },

    // Spring response for telekinetic command gestures
    spring(p, A){
      if(p < R - .03 || (A.chg > 0 && p < R + .002)) return {k: A.chg > 0 ? 360 : 280, d: 28};
      if(p < C + .08) return A.cl > 0 ? {k: 1450, d: 75} : {k: 1100, d: 60};
      return {k: 260, d: 24};
    },

    // Command gesture solver
    attack(tg, p, A, K){
      const isCharging = (A.chg > 0 && p <= R + 0.02);
      const isRelease = (A.cl > 0 && p >= R);

      // 1. GOKU SUPER SAIYAN FOCUS STANCE WHILE CHARGING!
      if(isCharging){
        const L = A.cl || 0;
        const t = typeof G !== 'undefined' && G ? G.t : 0;
        const jit = Math.sin(t * 60) * .025 * L;
        tg.lean = .24 + jit;
        tg.head = -.16;
        tg.aN = -.45; tg.eN = 1.45; // arms flared down and out, fists clenched!
        tg.aF = -.52; tg.eF = 1.55;
        tg.tN = .45;  tg.kN = .78;  // deep crouch power stance
        tg.tF = -.38; tg.kF = .78;
        return;
      }

      // 2. RELEASE AIMED-HAND DISCHARGE!
      if(isRelease){
        tg.aN = 1.55; tg.eN = .14; // near arm aims straight forward!
        tg.aF = -.32; tg.eF = 1.35; // far arm pulls tight to chest
        tg.lean = .36;
        tg.head = -.08;
        tg.tN = .68; tg.kN = .35;
        tg.tF = -.48; tg.kF = .18;
        return;
      }

      // 3. NORMAL COMBO GESTURES
      const step = A.step || 0;
      const H = GESTURES[step] || GESTURES[0];
      const lead = H.lead, off = lead === 'N' ? 'F' : 'N';

      tg['a' + lead] = K(p, H.aLead); tg['e' + lead] = K(p, H.eLead);
      tg['a' + off]  = K(p, H.aOff);  tg['e' + off]  = K(p, H.eOff);
      tg.lean = K(p, H.lean);
      tg.tN = K(p, H.tN); tg.kN = K(p, H.kN);
      tg.tF = K(p, H.tF); tg.kF = K(p, H.kF);
      tg.head = -tg.lean * .35;
    },

    // Behind hook: Update shard simulation & draw shards orbiting behind her body (depth < 0)
    behind(cx, f, t, S, P){
      const dt = f._lastT != null ? clamp(t - f._lastT, 0, 0.05) : 0.016;
      f._lastT = t;
      updateShards(f, dt, t);

      const shards = getShards(f);
      const charging = f.charging && f.chg > 0;
      const chgLvl = clamp((f.chg || 0) / ((f.A && f.A.chargeMax) || 1), 0, 1);

      cx.save();

      shards.forEach(s => {
        if(s.state === 'flying' || s.depth < 0){
          const lx = (s.wx - f.x) * f.face;
          const ly = s.wy - f.y;
          const lrot = s.wrot * f.face;

          if(s.state === 'flying' && s.trail.length > 1){
            const lTrail = s.trail.map(p => ({x: (p.x - f.x) * f.face, y: p.y - f.y}));
            drawShardTrail(cx, lTrail, 0.85);
          }

          renderShard(cx, lx, ly, lrot, s.spec.scale, 0.85, charging ? chgLvl : (s.state === 'flying' ? 0.75 : 0));
        }
      });
      cx.restore();
    },

    // Front hook: Draw shards orbiting in front (depth >= 0), and focus charge gauge
    front(cx, f, t, S, P){
      const shards = getShards(f);
      const charging = f.charging && f.chg > 0;
      const chgLvl = clamp((f.chg || 0) / ((f.A && f.A.chargeMax) || 1), 0, 1);

      cx.save();

      shards.forEach(s => {
        if(s.state !== 'flying' && s.depth >= 0){
          const lx = (s.wx - f.x) * f.face;
          const ly = s.wy - f.y;
          const lrot = s.wrot * f.face;

          renderShard(cx, lx, ly, lrot, s.spec.scale, 0.95, charging ? chgLvl : 0);
        }
      });

      // Finisher windup: violet glow on both raised hands
      if(f.atk > 0 && f.A && f.A.step === 3 && !(f.A.cl > 0)){
        const q = clamp(1 - f.atk / f.A.time, 0, 1);
        if(q < .66){
          const gr = 5 + 9 * clamp(q / .5, 0, 1);
          [S.aN.hand, S.aF.hand].forEach(h => {
            const g = cx.createRadialGradient(h.x, h.y, 0, h.x, h.y, gr);
            g.addColorStop(0, 'rgba(243,232,255,.95)'); g.addColorStop(.4, 'rgba(192,132,252,.6)'); g.addColorStop(1, 'rgba(168,85,247,0)');
            cx.fillStyle = g; cx.beginPath(); cx.arc(h.x, h.y, gr, 0, 7); cx.fill();
          });
        }
      }

      // Super Saiyan power-up gauge above head while charging
      if(charging){
        const x = S.head.x - 11, y = S.head.y - 13, full = chgLvl >= 1;
        cx.fillStyle = 'rgba(0,0,0,.75)'; cx.fillRect(x - 1, y - 1, 24, 5);
        cx.fillStyle = full ? (Math.sin(t * 50) > 0 ? '#ffffff' : '#c084fc') : `rgb(${Math.round(140 + 70 * chgLvl)}, 80, 250)`;
        cx.fillRect(x, y, 22 * chgLvl, 3);
      }

      cx.restore();
    }
  });
})();