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

  // READY / IDLE base angles
  const G0 = {lean:.08, aN:.25, eN:.50, aF:-.12, eF:.52, tN:.22, kN:.20, tF:-.18, kF:.20};

  // COMMAND GESTURE POSES. Local space: arm angle 0 = hanging down, ~1.57 = pointing forward, ~2.1 = up-forward. Shoulder is ~40px above the feet, head ~48px.
  // Timeline of p (0..1): windup is reached at R (.32, where a held ATK freezes), the hand is fully out at ~.54, follow-through to ~.70, then recover.
  //   N = near arm = her LEFT hand, F = far arm = her RIGHT hand.
  const GESTURES = [
    // STEP 0: LEFT jab at shoulder height. Left hand cocks back, snaps straight forward; right hand guards the chest.
    {
      lead: 'N',
      aLead: [[0, G0.aN], [.16, -.20], [R, -.50], [.54, 1.55], [.70, 1.50], [1, G0.aN]],
      eLead: [[0, G0.eN], [.16, 1.0],  [R, 1.50], [.54, .08],  [.70, .10],  [1, G0.eN]],
      aOff:  [[0, G0.aF], [R, .50],  [.54, .55], [1, G0.aF]],
      eOff:  [[0, G0.eF], [R, 1.90], [.54, 1.90],[1, G0.eF]],
      lean:  [[0, G0.lean], [R, -.10], [.54, .24], [.70, .22], [1, G0.lean]],
      tN:    [[0, G0.tN], [R, .35], [.54, .30], [1, G0.tN]],
      kN:    [[0, G0.kN], [R, .70], [.54, .30], [1, G0.kN]],
      tF:    [[0, G0.tF], [R, -.35], [.54, -.22], [1, G0.tF]],
      kF:    [[0, G0.kF], [R, .30], [.54, .22], [1, G0.kF]]
    },

    // STEP 1: RIGHT cross at shoulder height. Right hand winds up behind, drives forward; left hand guards.
    {
      lead: 'F',
      aLead: [[0, G0.aF], [.16, -.60], [R, -.95], [.54, 1.60], [.70, 1.52], [1, G0.aF]],
      eLead: [[0, G0.eF], [.16, 1.0],  [R, 1.30], [.54, .06],  [.70, .10],  [1, G0.eF]],
      aOff:  [[0, G0.aN], [R, .60],  [.54, .55], [1, G0.aN]],
      eOff:  [[0, G0.eN], [R, 1.90], [.54, 1.90],[1, G0.eN]],
      lean:  [[0, G0.lean], [R, -.14], [.54, .30], [.70, .28], [1, G0.lean]],
      tN:    [[0, G0.tN], [R, .30], [.54, .30], [1, G0.tN]],
      kN:    [[0, G0.kN], [R, .30], [.54, .30], [1, G0.kN]],
      tF:    [[0, G0.tF], [R, -.30], [.54, -.30], [1, G0.tF]],
      kF:    [[0, G0.kF], [R, .30], [.54, .25], [1, G0.kF]]
    },

    // STEP 2: RIGHT low strike at ELBOW / waist height. Right hand drops, she dips into a crouch and drives it forward-down.
    {
      lead: 'F',
      aLead: [[0, G0.aF], [.16, -.30], [R, -.55], [.54, 1.00], [.70, .95], [1, G0.aF]],
      eLead: [[0, G0.eF], [.16, .90],  [R, 1.10], [.54, .12],  [.70, .15],  [1, G0.eF]],
      aOff:  [[0, G0.aN], [R, .90],  [.54, .70], [1, G0.aN]],
      eOff:  [[0, G0.eN], [R, 1.80], [.54, 1.90],[1, G0.eN]],
      lean:  [[0, G0.lean], [R, .02], [.54, .40], [.70, .36], [1, G0.lean]],
      tN:    [[0, G0.tN], [R, .45], [.54, .55], [1, G0.tN]],
      kN:    [[0, G0.kN], [R, .60], [.54, .75], [1, G0.kN]],
      tF:    [[0, G0.tF], [R, -.35], [.54, -.45], [1, G0.tF]],
      kF:    [[0, G0.kF], [R, .45], [.54, .55], [1, G0.kF]]
    },

    // STEP 3 FINISHER: LEFT strike at HEAD height. Left hand winds up low and back (shards gather in it), then drives up-forward to head level and releases the 10-shard volley.
    //   0 -> windup (.32) -> hold (.50) -> strike (.60) -> follow-through (.74) -> recover
    {
      lead: 'N',
      aLead: [[0, G0.aN], [.16, -.30], [.32, -.70], [.50, -.75], [.60, 2.05], [.74, 2.00], [1, G0.aN]],
      eLead: [[0, G0.eN], [.16, 1.0],  [.32, 1.40], [.50, 1.50], [.60, .08],  [.74, .10],  [1, G0.eN]],
      aOff:  [[0, G0.aF], [.32, .55], [.50, .55], [.60, .45], [1, G0.aF]],
      eOff:  [[0, G0.eF], [.32, 1.85],[.50, 1.90],[.60, 1.90],[1, G0.eF]],
      lean:  [[0, G0.lean], [.32, -.15], [.50, -.20], [.60, .12], [.74, .14], [1, G0.lean]],
      tN:    [[0, G0.tN], [.32, .35], [.50, .30], [.60, .55], [1, G0.tN]],
      kN:    [[0, G0.kN], [.32, .55], [.50, .60], [.60, .30], [1, G0.kN]],
      tF:    [[0, G0.tF], [.32, -.25],[.50, -.28],[.60, -.45],[1, G0.tF]],
      kF:    [[0, G0.kF], [.32, .45], [.50, .45], [.60, .20], [1, G0.kF]]
    }
  ];

  // Which hand throws, and when, for the three single-hand hits (see updateShards)
  const COMBO_FIRE = [
    {hand:'N', shots:[[.54, 0,  .05], [.60, 1, -.05]]},                      // LEFT jab
    {hand:'F', shots:[[.54, 2, -.05], [.60, 3,  .05]]},                      // RIGHT cross
    {hand:'F', shots:[[.50, 4,  .10], [.56, 5,  0],  [.62, 6, -.10]]}        // RIGHT low strike
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

  // World position of a striking hand (captured every frame in behind() from the live skeleton, so shards leave from where the hand really is)
  function handPos(f, which){
    const h = f._erHand && f._erHand[which];
    return h ? {x: h.x + f.face * 4, y: h.y} : {x: f.x + f.face * 18, y: f.y - 36};
  }

  // Launch a shard forward from the striking hand (so the height matches the punch: shoulder / elbow / head), short range
  function launchOrganicShard(s, f, hand, dmg, angleSpread, speedMul, hitstop, bigShake) {
    s.state = 'flying';
    s.trail = [];
    s.dmg = dmg;
    s.fan = false; s.gath = false; s.trav = 0; s.atkA = null;   // clear leftovers from a held-key (fan) throw, or normal shards would die instantly
    s.startX = f.x;
    s.isHeldKey = false;
    s.maxReach = MAX_REACH; // strictly short range (~72px semi-melee)
    s.hasHit = false;
    s.wx = hand.x;
    s.wy = hand.y;
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

  // FINISHER throw: the shard bursts out of the left hand (head height) and is hurled at the enemy's head
  function throwShard(s, f, o, hand, dmg, spread, hitstop) {
    s.state = 'flying';
    s.trail = [];
    s.dmg = dmg;
    s.fan = false; s.gath = false; s.trav = 0; s.atkA = null;   // clear leftovers from a held-key (fan) throw, or normal shards would die instantly
    s.startX = f.x;
    s.isHeldKey = false;
    s.hasHit = false;
    s.linger = 0;
    s.hs = hitstop || 0;
    s.shk = s.idx === 0;
    s.maxReach = 260;  // long enough to reach an enemy at normal fighting distance
    s.wx = hand.x; s.wy = hand.y + (Math.random() - .5) * 5;
    const tx = o ? o.x : f.x + f.face * 120, ty = o ? o.y - o.h * .8 : hand.y;
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
    const FANC = Characters.skillsOf('errata').basic.fan;
    const o = typeof G !== 'undefined' && G && G.f ? foeOf(f) : null;
    const A = f.A || {};
    const atk = f.atk > 0;
    const p = atk ? clamp(1 - f.atk / (A.time || .28), 0, 1) : 0;
    const charging = f.charging && f.chg > 0;
    const chgLvl = clamp((f.chg || 0) / ((f.A && f.A.chargeMax) || 1), 0, 1);

    const gatherNow = atk && !A.skill && (A.step || 0) === 3 && !(A.cl > 0) && p < .6;   // finisher windup: all shards gather around the left hand
    const gh = handPos(f, 'N');                                                // (where the gathering shards go)

    // Reset hit mask when new attack starts
    if(f.atk > f._lastAtk + 1e-4){
      f._firedMask = 0;
      f._barrageFired = 0;
      f._atkHit = false;
    }
    f._lastAtk = f.atk;

    // 1. NORMAL COMBO: each hit's shards leave from the hand that threw it, at that hand's own height (facing direction only)
    //    Step 0 LEFT jab (shoulder) | Step 1 RIGHT cross (shoulder) | Step 2 RIGHT low strike (elbow / waist) | Step 3 LEFT head strike (head) = 10-shard volley
    //    Each entry: [p when it fires, shard index, angle spread]. The hand is fully out at p ~ .54, so the shards leave right as the strike lands.
    if(atk && !charging && !(A.cl > 0) && !A.skill){   // (a skill cast is not a combo hit)
      const step = A.step || 0;
      const toFire = [];

      if(step < 3){
        const F = COMBO_FIRE[step];
        F.shots.forEach((sh, k) => {
          if(p >= sh[0] && !(f._firedMask & (1 << k))){ f._firedMask |= (1 << k); toFire.push({idx:sh[1], hand:F.hand, spread:sh[2]}); }
        });
      } else {
        // Step 3 FINISHER: left hand at head height -> all 10 shards are THROWN at the enemy's head in a quick volley
        const spreads = [0, .08, -.08, .14, -.14, .04, -.04, .18, -.18, 0];
        for(let k = 0; k < 10; k++){
          if(p >= .64 + k * .012 && !(f._firedMask & (1 << k))){ f._firedMask |= (1 << k); toFire.push({idx:k, hand:'N', spread:spreads[k], throwAt:true}); }
        }
      }

      const dmgEach = (A.dmg || 0.6) * ((A.step || 0) === 3 ? 0.30 : 0.45);
      toFire.forEach(item => {
        const s = shards[item.idx];
        const hand = handPos(f, item.hand);
        if(item.throwAt || s.state === 'orbit' || s.state === 'return'){
          if(item.throwAt) throwShard(s, f, o, hand, dmgEach, item.spread, (A.hitstop || 0) * .5);
          else launchOrganicShard(s, f, hand, dmgEach, item.spread, 1.0, (A.hitstop || 0) * .6, false);
        }
      });
    }

    // 2. REALITY COLLAPSE (held key). Charging gathers the shards that are in orbit (one more the longer the hold, never more than she has). Release throws ONLY those, in a fan toward the aim.
    const casted = (A.cl || 0) > 0;                                           // CASTING TIME done (hold > castTime). Before that nothing is gathered and letting go fires nothing
    if(charging && casted && !f._castPing){ f._castPing = 1; if(typeof G !== 'undefined' && G && G.rings) G.rings.push({x:f.x, y:f.y - 30, life:.25}); }
    if(!charging) f._castPing = 0;
    if(charging && A.fan && casted){
      const want = clamp(Math.ceil(clamp(A.cl || 0, 0, 1) * shards.length), 1, shards.length);
      let have = shards.filter(s => s.gath).length;
      for(const s of shards){ if(have >= want) break; if(!s.gath && s.state === 'orbit'){ s.gath = true; have++; } }
    }
    const isChargeRelease = !f.charging && A.fan && A.cl > 0 && !f._barrageFired && p >= (R - 0.05);   // only a COMPLETED cast fires the fan
    if(isChargeRelease){
      f._barrageFired = 1;
      const g = shards.filter(s => s.gath && s.state === 'orbit'), n = g.length;
      if(n){
        const ar = f.erAim || {x:f.face, y:0}, base = Math.atan2(ar.y, ar.x), stp = FANC.angle / Math.max(1, FANC.shards - 1);
        const hx = f.x + ar.x * 20, hy = f.y - 34 + ar.y * 20;
        const shared = {dmg:FANC.dmg, kbx:FANC.kbx, kby:FANC.kby, stunx:FANC.stunx, noShake:true, hitstop:FANC.hitstop};   // ONE attack object for the whole volley (passives treat it as one attack)
        g.forEach((s, k) => {
          const ang = base + (k - (n - 1) / 2) * stp;
          s.state = 'flying'; s.trail = []; s.isHeldKey = true; s.fan = true; s.atkA = shared; s.trav = 0; s.maxD = FANC.range; s.hasHit = false; s.linger = 0;
          s.wx = hx; s.wy = hy; s.vx = Math.cos(ang) * FANC.speed; s.vy = Math.sin(ang) * FANC.speed; s.wrot = ang + Math.PI / 2;
        });
        if(typeof G !== 'undefined' && G && G.rings) G.rings.push({x:hx, y:hy, life:.2});
      }
    }
    if(!charging) shards.forEach(s => { s.gath = false; });                    // gathered shards that were not thrown (hit / interrupted) go back to orbit

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
        if(s.fan) s.trav += Math.hypot(s.vx, s.vy) * dt;
        const dist = s.fan ? s.trav : Math.abs(s.wx - s.startX);
        const reachLimit = s.fan ? s.maxD : (s.maxReach || MAX_REACH);
        if(dist > reachLimit){
          s.state = 'return';
          return;
        }

        // Collision check (only hits in forward facing direction)
        if(o && (o.inv <= 0 || f._atkHit) && !s.hasHit && (typeof G === 'undefined' || !G || !G.over)){
          const forwardCheck = s.fan || (o.x - f.x) * f.face > 0;        // a fan shard goes where it was aimed
          const inX = Math.abs(s.wx - o.x) < o.w / 2 + 10;
          const inY = s.wy > o.y - o.h - 4 && s.wy < o.y + 4;
          if(forwardCheck && inX && inY){
            if(!s.hasHit){
              s.hasHit = true;
              if(typeof hurt === 'function'){
                f._atkHit = true; // follow-up shards of the same attack still land through the 0.15s i-frames
                if(s.fan) hurt(o, {c:f.c, A:s.atkA, face:s.vx >= 0 ? 1 : -1, src:f});   // each shard = its own hit
                else hurt(o, {c:f.c, A:{dmg:s.dmg, kbx:s.isHeldKey ? 0.35 : 0.20, kby:s.isHeldKey ? 0.18 : 0.12, noShake:!s.shk && !s.isHeldKey, hitstop:s.isHeldKey ? .08 : s.hs}, face:f.face});
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
        const targetWx = gatherNow ? gh.x + Math.cos(s.curOrbitAngle) * 11 : f.x + Math.cos(s.curOrbitAngle) * sp.rad;
        const targetWy = gatherNow ? gh.y + Math.sin(s.curOrbitAngle) * 11 : f.y + sp.hOff;
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
        if(charging && s.gath){
          // GATHERED: this shard spins fast in a tight ring in front of her hand, where the fan will leave from
          const dir = sp.spd >= 0 ? 1 : -1, ar = f.erAim || {x:f.face, y:0};
          const fastSpeed = dir * (Math.abs(sp.spd) + 8.5 + 14.0 * chgLvl);
          s.curOrbitAngle += fastSpeed * dt;
          const targetWx = f.x + ar.x * 26 + Math.cos(s.curOrbitAngle) * 8;
          const targetWy = f.y - 34 + ar.y * 26 + Math.sin(s.curOrbitAngle) * 8;
          s.wx += (targetWx - s.wx) * (25 * dt);
          s.wy += (targetWy - s.wy) * (25 * dt);
          s.wrot = s.curOrbitAngle + Math.PI / 2;
          s.depth = Math.sin(s.curOrbitAngle);
        } else {
          // Normal elegant revolving orbit (finisher windup: shards gather in a tight spinning ring above the raised hands)
          const gather = gatherNow;
          s.curOrbitAngle += sp.spd * (gather ? 3 : 1) * dt;
          const targetWx = gather ? gh.x + Math.cos(s.curOrbitAngle) * 11 : f.x + Math.cos(s.curOrbitAngle) * sp.rad;
          const targetWy = gather ? gh.y + Math.sin(s.curOrbitAngle) * 11 : f.y + sp.hOff;
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

    // Far arm (her RIGHT hand) drawn in front when it is the striking hand: Step 1 (cross) and Step 2 (low strike)
    farFront: f => {
      if(!f.atk || !f.A) return false;
      if(f.A.skill) return f.A.skill === 'dimimpale';   // the far hand also points at the sky for Dimensional Impale
      const step = f.A.step || 0;
      return step === 1 || step === 2;
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
      if(A.skill === 'dimimpale') return p > .4 && p < .7 ? {k:900, d:55} : {k:260, d:26};          // slow raise, hard snap down
      if(A.skill === 'shatteredgravity') return {k:300, d:28};
      if(p < R - .03 || (A.chg > 0 && p < R + .002)) return {k: A.chg > 0 ? 360 : 280, d: 28};
      if(p < C + .08) return A.cl > 0 ? {k: 1450, d: 75} : {k: 1100, d: 60};
      return {k: 260, d: 24};
    },

    // Command gesture solver
    attack(tg, p, A, K){
      // SKILL I - DIMENSIONAL IMPALE: both hands rise overhead (summoning the shard), then are driven down and forward to slam it
      if(A.skill === 'dimimpale'){
        tg.aN = K(p, [[0, G0.aN], [.35, 2.9], [.5, 3.0], [.62, 1.5], [.8, 1.2], [1, G0.aN]]); tg.eN = K(p, [[0, G0.eN], [.35, .2], [.5, .15], [.62, .1], [1, G0.eN]]);
        tg.aF = K(p, [[0, G0.aF], [.35, 2.7], [.5, 2.8], [.62, 1.4], [.8, 1.1], [1, G0.aF]]); tg.eF = K(p, [[0, G0.eF], [.35, .25], [.5, .2], [.62, .1], [1, G0.eF]]);
        tg.lean = K(p, [[0, G0.lean], [.45, -.2], [.62, .38], [1, G0.lean]]); tg.head = -tg.lean * .35;
        tg.tN = .3; tg.kN = .4; tg.tF = -.25; tg.kF = .35;
        return;
      }
      // SKILL II - SHATTERED GRAVITY: arms thrown out wide in front, palms open, a small crouch while she bends the space
      if(A.skill === 'shatteredgravity'){
        tg.aN = K(p, [[0, G0.aN], [.3, 1.55], [.8, 1.6], [1, G0.aN]]); tg.eN = K(p, [[0, G0.eN], [.3, .12], [.8, .15], [1, G0.eN]]);
        tg.aF = K(p, [[0, G0.aF], [.3, 1.3], [.8, 1.4], [1, G0.aF]]); tg.eF = K(p, [[0, G0.eF], [.3, .3], [.8, .25], [1, G0.eF]]);
        tg.lean = K(p, [[0, G0.lean], [.3, .3], [.8, .28], [1, G0.lean]]); tg.head = -tg.lean * .3;
        tg.tN = .4; tg.kN = .6; tg.tF = -.35; tg.kF = .5;
        return;
      }
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
        tg.aN = clamp(1.55 + (A.aimEl || 0), .4, 2.9); tg.eN = .14; // near arm points along the aim
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
      // live hand positions (world space) so shards leave from the hand that is striking
      f._erHand = {N:{x: f.x + S.aN.hand.x * f.face, y: f.y + S.aN.hand.y}, F:{x: f.x + S.aF.hand.x * f.face, y: f.y + S.aF.hand.y}};
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

      // Finisher windup: violet glow on the left (striking) hand where the shards gather
      if(f.atk > 0 && f.A && !f.A.skill && f.A.step === 3 && !(f.A.cl > 0)){
        const q = clamp(1 - f.atk / f.A.time, 0, 1);
        if(q < .66){
          const gr = 5 + 9 * clamp(q / .5, 0, 1);
          [S.aN.hand].forEach(h => {
            const g = cx.createRadialGradient(h.x, h.y, 0, h.x, h.y, gr);
            g.addColorStop(0, 'rgba(243,232,255,.95)'); g.addColorStop(.4, 'rgba(192,132,252,.6)'); g.addColorStop(1, 'rgba(168,85,247,0)');
            cx.fillStyle = g; cx.beginPath(); cx.arc(h.x, h.y, gr, 0, 7); cx.fill();
          });
        }
      }

      // REALITY COLLAPSE aim preview: the fan edges + range, only while gathering
      if(charging && f.erAim && f.A && f.A.fan && (f.A.cl || 0) > 0){   // aim cone only once the cast is complete
        const FN = Characters.skillsOf('errata').basic.fan, ar = f.erAim, base = Math.atan2(ar.y, ar.x * f.face), n = getShards(f).filter(s => s.gath).length;
        const half = FN.angle * Math.max(0, n - 1) / Math.max(1, FN.shards - 1) / 2, ox = 20, oy = -34;
        cx.save(); cx.strokeStyle = 'rgba(192,132,252,.55)'; cx.fillStyle = 'rgba(157,78,221,.10)'; cx.lineWidth = 1; cx.setLineDash([5, 4]);
        cx.beginPath(); cx.moveTo(ox, oy); cx.arc(ox, oy, FN.range, base - half, base + half); cx.closePath(); cx.fill(); cx.stroke(); cx.restore();
      }
      // CAST BAR above the head: the tick marks the end of the casting time. Before it = dim (letting go fires nothing), after it = bright (ready, shards gather, release fires)
      if(charging){
        const BS = Characters.skillsOf('errata').basic, cm = BS.chargeMax || 1, tk = clamp((BS.castTime || 0) / cm, 0, 1);
        const x = S.head.x - 14, y = S.head.y - 14, w = 28, ready = (f.chg || 0) >= (BS.castTime || 0), full = chgLvl >= 1;
        cx.fillStyle = 'rgba(0,0,0,.78)'; cx.fillRect(x - 1, y - 1, w + 2, 5);
        cx.fillStyle = !ready ? 'rgb(110, 84, 190)' : full ? (Math.sin(t * 50) > 0 ? '#ffffff' : '#c084fc') : `rgb(${Math.round(170 + 60 * chgLvl)}, 110, 255)`;
        cx.fillRect(x, y, w * chgLvl, 3);
        cx.fillStyle = ready ? '#ffffff' : '#f0abfc'; cx.fillRect(x + w * tk - .5, y - 2, 1.5, 7);   // cast-complete tick
      }

      cx.restore();
    }
  });
})();