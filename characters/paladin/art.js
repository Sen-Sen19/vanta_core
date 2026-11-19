// PALADIN art - heavy holy knight. Same shared ragdoll (body.js): bigger sizes, silver + gold colors, a helmet, a floating halo and the KITE SHIELD.
// Hooks used: body (sizes), colors, pose() = heavy idle / carry the shield / lean behind it when running, attack() + spring() = 3-HIT STOMP COMBO (shield stomp -> kick -> POWER ground smash),
//             behind() = halo, front() = pauldron, helmet, and the shield (its own little spring, so it lags and swings with the arm).
// SHIELD: left arm (the near arm, aN / eN) carries it. It is a separate drawn object with its own rotation spring (f.shieldSp; NOT f.shd, arena.js uses that for Shadow Hook), NOT part of the torso.
//   (Hitbox is still the shared 30x52 for everyone, arena.js is not changed per character, so the shield does not block hits yet. That comes with his skills.)
// SETTINGS: SHIELD_W / SHIELD_H = kite size (px).  SHIELD_LAG = how late the shield follows the arm (higher = more delay).
(() => {
  const SHIELD_W = 40, SHIELD_H = 50, SHIELD_LAG = 1;
  const GOLD = '#e3b53c', GOLD_D = '#a87a14', SIL = '#eceff5', SIL_D = '#b6bcca', OUT = '#0b0f1c';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const T = 10, SH = 9.5;                         // thigh + shin length (default body, keep in sync with body below)
  // ---- STOMP COMBO, 3 hits (NO swinging, it is all weight): 1 SHIELD STOMP (lift the shield + front foot, drop both on the ground) -> 2 KICK (with the other foot) -> 3 POWER SMASH (leaps, shield overhead, crashes down).
  // HEAVY = slow lift -> hold at the top -> fast drop -> dead stop at contact (+ hit-stop) -> slow recovery.
  // CS[i] = contact progress of hit i = 1 - hitFrom/time in skills.js. !! KEEP THEM MATCHING.
  // Joint angles: 0 = hangs down, + forward, 3.14 = straight up. Leg: tN/tF = thigh angle, kNd/kFd = knee bend we set directly (lift = how much of it replaces the "both feet on the ground" legs()).
  const CS = [.55, .55, .66];
  const twoHand = o => { o.aF = o.aN.map(([t, v]) => [t, v - .12]); o.eF = o.eN.map(([t, v]) => [t, v + .1]); return o; };
  const STOMP = (c => twoHand({
    aN:[[0,.5],[.12,1.2],[.28,2.3],[.36,2.4],[.44,1.4],[c - .03,.75],[c + .06,.72],[.85,.7],[1,.5]],   // shield + both hands go UP in front of him, hold, then straight down (lands just before contact)
    eN:[[0,1.1],[.28,.35],[.36,.3],[c - .03,.1],[c + .06,.1],[.85,.8],[1,1.1]],
    lean:[[0,.05],[.28,-.12],[.36,-.15],[.44,.1],[c - .02,.42],[c + .06,.45],[.85,.2],[1,.05]],           // body weight drops over the shield
    head:[[0,0],[.30,.15],[c,.1],[c + .1,-.15],[1,0]],
    tN:[[0,.24],[.2,.9],[.36,1.1],[c - .08,.55],[c - .03,.45],[c + .1,.4],[.85,.35],[1,.24]],            // front knee comes up, then the foot STOMPS down with the shield
    tF:[[0,-.2],[.42,-.35],[c,-.6],[.85,-.4],[1,-.2]],
    kNd:[[0,.4],[.2,1.5],[.36,1.9],[c - .09,.6],[c - .05,.3],[1,.3]], lift:[[0,0],[.14,1],[.36,1],[c - .09,1],[c - .04,0],[1,0]],
    Y:[[0,20.5],[.36,20.5],[c - .03,17.4],[c + .15,17.8],[.9,20.2],[1,20.5]],
    rot:[[0,0],[.28,.15],[.36,.2],[c - .03,-.05],[c + .06,-.1],[.85,0],[1,0]]
  }))(CS[0]);
  const KICK = (c => ({
    aN:[[0,.5],[.06,-.9],[.14,-1.5],[.36,-1.6],[c,-1.6],[c + .08,-1.5],[.85,-.3],[1,.5]],                  // shield arm swings straight BACK so the shield sits behind him, clear of the kicking leg
    eN:[[0,1.1],[.06,.4],[.14,0],[.36,0],[c,0],[c + .08,0],[.85,.7],[1,1.1]],
    aF:[[0,-.1],[.30,.6],[c,1.2],[1,-.1]], eF:[[0,.5],[.30,1.2],[c,.9],[1,.5]],                      // free arm swings forward for balance
    lean:[[0,.05],[.30,-.3],[.42,-.38],[c,-.12],[c + .08,-.1],[.85,.1],[1,.05]],                   // leans back, chambers the knee
    head:[[0,0],[.30,.2],[c,.1],[1,0]],
    tF:[[0,-.2],[.28,1.3],[.36,1.35],[c - .04,1.5],[c + .08,1.5],[.85,.8],[1,-.2]],                    // the OTHER (far) leg: knee up, hold, then it SHOOTS out straight
    kFd:[[0,.2],[.28,2.1],[.36,2.2],[c - .05,.1],[c + .08,.15],[.85,1.0],[1,.2]], liftF:[[0,0],[.12,1],[.85,1],[1,0]],
    tN:[[0,.24],[.28,.05],[c,0],[.85,.1],[1,.24]],                                                    // near leg = standing leg, locked straight
    kNd:[[0,.3],[.28,.1],[c,.05],[.85,.12],[1,.3]], lift:[[0,0],[.12,1],[.85,1],[1,0]],
    Y:[[0,20.5],[1,20.5]],
    rot:[[0,0],[.4,-.2],[c,-.3],[1,0]]
  }))(CS[1]);
  const SMASH = (c => twoHand({
    aN:[[0,.5],[.15,1.5],[.40,2.6],[.50,2.7],[.55,2.6],[.60,1.7],[c - .03,.75],[c + .06,.72],[.92,.7],[1,.5]],   // shield straight UP over his head, hold, then crash down
    eN:[[0,1.1],[.40,.3],[.50,.25],[.60,.15],[c - .03,.08],[c + .06,.1],[.92,.8],[1,1.1]],
    lean:[[0,.05],[.15,-.15],[.40,-.45],[.50,-.5],[.57,-.2],[c - .02,.6],[c + .06,.64],[.92,.25],[1,.05]],
    head:[[0,0],[.40,.2],[c,.15],[c + .1,-.12],[1,0]],
    tN:[[0,.24],[.40,.3],[c - .04,.5],[c,.85],[.92,.5],[1,.24]], tF:[[0,-.2],[.40,-.3],[c,-.7],[.92,-.4],[1,-.2]],
    Y:[[0,20.5],[c - .06,20.5],[c,16.8],[c + .15,17.2],[.95,20.2],[1,20.5]],
    rot:[[0,0],[.3,.2],[.52,.25],[c,-.05],[c + .06,-.2],[.92,0],[1,0]]
  }))(CS[2]);
  const COMBO = [STOMP, KICK, SMASH];

  // knee angle that puts the ankle at height Y for thigh angle th, so BOTH feet stay on the same ground height (no floating foot)
  const legK = (th, Y) => { const a = Math.acos(clamp((Y - T * Math.cos(th)) / SH, -1, 1)); const k = th - a; return k > .05 ? k : th + a; };
  const legs = (tg, Yt) => { const Y = Math.min(Yt, .97 * (T + SH) * Math.min(Math.cos(tg.tN), Math.cos(tg.tF))); tg.kN = legK(tg.tN, Y); tg.kF = legK(tg.tF, Y); };


  // ---- KICK LEG ----
  // His torso is a 44px barrel but the legs are only 19.5px long (the hitbox needs that), so the real far leg never clears the belly: it hid behind the barrel and the shield.
  // While the kick lifts, the far leg is redrawn here on TOP of everything and STRETCHED (KICK_STRETCH x longer) so the foot reaches out past the shield. Pose still comes from the springs.
  // w = 0 while the thigh hangs down (stance), 1 once it is lifted forward. Stretch and fade-in both follow w, so nothing pops.
  const KICK_STRETCH = 1.3;
  function kickLeg(S){
    const L = S.lF, th = Math.atan2(L.knee.x - L.hip.x, L.knee.y - L.hip.y);
    const w = clamp((th - .2) / .7, 0, 1);
    const ext = clamp(1 - (th - L.sa) / 1.7, 0, 1);                              // 0 = knee folded (chamber), 1 = leg straight (strike): only a straight leg stretches
    const s = 1 + (KICK_STRETCH - 1) * w * ext;
    const hip = {x:L.hip.x + 3 * w, y:L.hip.y + 4 * w};                          // root slides to the lower front of the belly
    const knee = {x:hip.x + (L.knee.x - L.hip.x) * s, y:hip.y + (L.knee.y - L.hip.y) * s};
    const ankle = {x:knee.x + (L.ankle.x - L.knee.x) * s, y:Math.min(-5.5, knee.y + (L.ankle.y - L.knee.y) * s)};   // sole never goes under the floor
    return {hip, knee, ankle, w, sa:L.sa};
  }
  function bootShape(cx, ax, ay, phi, white, P, kick){   // armored boot: cuff, shaft, toe box, thick sole. origin = ankle, x = toward the toe
    cx.save(); cx.translate(ax, ay); cx.rotate(phi); cx.scale(.62, .62); cx.lineJoin = 'round';
    const path = () => { cx.beginPath(); cx.moveTo(-7, -9); cx.lineTo(7, -9); cx.lineTo(8, -1); cx.quadraticCurveTo(19, 0, 20, 6); cx.lineTo(20, 9); cx.lineTo(-8, 9); cx.quadraticCurveTo(-10, 0, -7, -9); cx.closePath(); };
    path(); cx.fillStyle = OUT; cx.fill(); cx.lineWidth = 3.4; cx.strokeStyle = OUT; cx.stroke();
    path(); cx.fillStyle = white ? '#fff' : SIL_D; cx.fill();
    if(!white){
      cx.fillStyle = GOLD; cx.fillRect(-7.5, -9, 15, 3.6);                                        // gold cuff
      cx.fillStyle = SIL; cx.beginPath(); cx.moveTo(8, -1); cx.quadraticCurveTo(19, 0, 20, 6); cx.lineTo(10, 6); cx.closePath(); cx.fill();   // lighter toe box
      cx.fillStyle = OUT; cx.fillRect(-8.5, 6, 29, 3);                                           // sole
    }
    cx.restore();
  }
  function drawKickLeg(cx, K, white, P){
    const a = clamp((K.w - .5) * 3, 0, 1); if(a < .05) return;
    cx.save(); cx.globalAlpha *= a;
    const cap = Body.capsule, leg = white ? '#fff' : (P.legs || P.limb), gold = white ? '#fff' : GOLD;
    cap(cx, K.hip, K.knee, 14.2, OUT); cap(cx, K.knee, K.ankle, 12.7, OUT);                    // outline (thigh thick, shin tapers to the ankle)
    cap(cx, K.hip, K.knee, 11, leg); cap(cx, K.knee, K.ankle, 9.5, leg);                      // same widths + color as his standing leg      // thigh + shin
    bootShape(cx, K.ankle.x, K.ankle.y, clamp(-K.sa * .5, -.8, .8), white, P, true);
    cx.restore();
  }

  // ---- KITE SHIELD: broad flat top, pointed bottom. Path is centered on (0,0). ----
  function kite(cx, w, h){
    const x = w / 2, t = -h * .44, b = h * .56;
    cx.beginPath();
    cx.moveTo(-x, t + 2); cx.quadraticCurveTo(0, t - 3.5, x, t + 2);          // top edge (slight crown)
    cx.lineTo(x, -h * .06); cx.quadraticCurveTo(x * .9, h * .3, 0, b);          // right side curves into the point
    cx.quadraticCurveTo(-x * .9, h * .3, -x, -h * .06); cx.closePath();         // left side
  }
  function drawShield(cx, X, Y, rot, white, t, glow){
    const w = SHIELD_W, h = SHIELD_H;
    cx.save(); cx.translate(X, Y); cx.rotate(rot);
    cx.lineJoin = 'round';
    kite(cx, w, h); cx.fillStyle = OUT; cx.fill(); cx.lineWidth = 2.6; cx.strokeStyle = OUT; cx.stroke();      // outline
    kite(cx, w, h); cx.fillStyle = white ? '#fff' : GOLD; cx.fill();                                           // thick golden frame
    cx.save(); cx.scale(.8, .8); kite(cx, w, h); cx.fillStyle = white ? '#fff' : SIL; cx.fill();                // silver face
    cx.restore();
    if(!white){
      cx.save(); cx.scale(.8, .8); kite(cx, w, h); cx.clip();
      const g = cx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);                                           // soft light from the top-left
      g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(60,70,100,.28)');
      cx.fillStyle = g; cx.fillRect(-w, -h, w * 2, h * 2); cx.restore();
      // radiant sun crest (center): rays + gold disc + white core, rays breathe slowly
      const q = w / 22 * .85, cy = -h * .1, rr = (4.2 + Math.sin(t * 2.4) * .3) * q;
      cx.fillStyle = GOLD_D;
      for(let i = 0; i < 12; i++){
        const a = i * Math.PI / 6, l = ((i % 2 ? 7.4 : 9.4) + Math.sin(t * 2.4 + i) * .4) * q;
        cx.beginPath(); cx.moveTo(Math.cos(a - .11) * rr, cy + Math.sin(a - .11) * rr); cx.lineTo(Math.cos(a) * l, cy + Math.sin(a) * l); cx.lineTo(Math.cos(a + .11) * rr, cy + Math.sin(a + .11) * rr); cx.fill();
      }
      cx.fillStyle = GOLD; cx.beginPath(); cx.arc(0, cy, rr, 0, 7); cx.fill();
      cx.strokeStyle = GOLD_D; cx.lineWidth = .8; cx.stroke();
      cx.fillStyle = '#fff6d6'; cx.beginPath(); cx.arc(0, cy, 1.7 * q, 0, 7); cx.fill();
      cx.fillStyle = GOLD_D; for(const [sx, sy] of [[-w * .3, -h * .34], [w * .3, -h * .34]]){ cx.beginPath(); cx.arc(sx, sy, 1, 0, 7); cx.fill(); }   // rivets
      if(glow > 0){   // DIVINE IMPACT: the shield is charged with holy light (gold wash + bright rim)
        kite(cx, w, h); cx.fillStyle = 'rgba(255,232,140,' + (.42 * glow) + ')'; cx.fill();
        cx.lineWidth = 2; cx.strokeStyle = 'rgba(255,248,210,' + glow + ')'; cx.stroke();
      }
    }
    cx.restore();
  }

  Characters.art('paladin', {
    // MASSIVE: huge barrel torso, thick limbs, big gauntlets and boots. Head sunk low into the shoulders (headSink). Limb LENGTHS unchanged, so legs()/T/SH and the 30x52 hitbox still match.
    body: {noRings:1, belt:4, head:{r:6.2}, headSink:5, torso:{len:9, w:32}, uArm:{len:9, w:11}, fArm:{len:9, w:10}, hand:{r:6.5},
           thigh:{len:10, w:11}, shin:{len:9.5, w:9.5}, foot:{len:8, w:11}},
    colors: {shirt:'#d5d9e3', limb:'#8f98ae', far:'#697186', head:'#e9d2ad', dark:'#9aa2b6', hand:'#e3b53c', legs:'#a9afbf', legsFar:'#7f8696'},


    // SOLID plate-armor torso (replaces the plain capsule): outline, silver plate, light top / dark underside shading, gold belt band with a buckle. No dark disc in the middle anymore.
    torso(cx, S, B, P, white){
      const cap = Body.capsule, W = B.torso.w;
      cap(cx, S.pel, S.sh, W + 3.4, OUT);
      cap(cx, S.pel, S.sh, W, white ? '#fff' : P.shirt);
      if(white) return;
      cx.save(); cx.beginPath(); cx.arc(S.pel.x, S.pel.y, W / 2, 0, 7); cx.arc(S.sh.x, S.sh.y, W / 2, 0, 7); cx.rect(Math.min(S.pel.x, S.sh.x) - W / 2, S.sh.y, W, S.pel.y - S.sh.y); cx.clip();
      const g = cx.createLinearGradient(0, S.sh.y - W / 2, 0, S.pel.y + W / 2);                // light on top, shade underneath
      g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(.45, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(70,80,105,.45)');
      cx.fillStyle = g; cx.fillRect(S.sh.x - W, S.sh.y - W / 2, W * 2, W * 2 + 20);
      cx.restore();
      cx.save(); cx.translate(S.pel.x, S.pel.y + 2); cx.rotate(S.lean);                          // gold belt band + buckle
      cx.fillStyle = OUT; cx.fillRect(-W / 2 + 2, -4.2, W - 4, 8.4);
      cx.fillStyle = GOLD; cx.fillRect(-W / 2 + 2.6, -3, W - 5.2, 6);
      cx.restore();
    },

    // the bash drives the shield arm; draw the far arm normally. (the shield is on the near arm, drawn over everything)
    // heavy stance. Idle: wide legs, shield held slightly forward. Run: leans behind the shield, shield angled forward, short heavy steps.
    pose(tg, f, t, run, K){
      const idle = 1 - run, b = Math.sin(t * 1.9);
      tg.aN = .5 + b * .025 + run * .38; tg.eN = 1.1 - run * .1;           // shield arm: always up and carrying
      tg.aF = tg.aF * run + (-.12 + b * .03) * idle;                       // free arm: small counterbalance when still, normal swing when running
      tg.lean += idle * .02 + run * .1;
      tg.head += run * .06;
      if(idle > .5){ tg.tN = .24; tg.tF = -.2; legs(tg, 20.5 + b * .15); }  // wide, planted stance
      else { tg.tN *= .85; tg.tF *= .85; legs(tg, 20.2); }                 // shorter, heavier steps
    },

    // ONE boot per foot (replaces the default round foot capsule, so no extra blobs). While the far leg kicks, its real boot is hidden: the stretched kick leg draws the boot instead.
    foot(cx, leg, P, white, f, far){
      if(far && f.atk > 0 && f.A && f.A.step === 1 && clamp((Math.atan2(leg.knee.x - leg.hip.x, leg.knee.y - leg.hip.y) - .2) / .7, 0, 1) > .52) return;   // only once the kick leg is drawn (same threshold as drawKickLeg)
      bootShape(cx, leg.ankle.x, leg.ankle.y, leg.planted ? 0 : clamp(-leg.sa * .5, -.8, .8), white, P);
    },

    farFront: f => f.atk > 0 && f.A && (f.A.skill === 'sacredcharge' || f.A.skill === 'aegis' || f.A.skill === 'heavensverdict' || f.A.step === 0 || f.A.step === 2),   // far hand grips the shield (not during the kick)
    spring(p, A){
      if(A.skill === 'sacredcharge') return {k:1300, d:48};
      if(A.skill === 'heavensverdict') return p < .5 ? {k:150, d:17} : {k:320, d:30};   // raise: soft, then hold
      if(A.skill === 'aegis'){ const e = p * A.time; return e < .5 ? {k:110, d:15} : e < .9 ? {k:650, d:38} : {k:120, d:17}; }   // lift soft, slam stiff, then settle slowly                       // stiff, so the vibration shows
      const st = A.step || 0, c = CS[st], big = st === 2;
      if(p < c - (big ? .14 : .2)) return big ? {k:75, d:11} : {k:90, d:12};   // lift: soft and slow, it is heavy
      if(p < c + .05) return big ? {k:850, d:40} : {k:700, d:36};              // drop / kick: fast, stops dead on contact
      return big ? {k:70, d:13} : {k:80, d:14};                                // recovery: slow
    },
    attack(tg, p, A, K){
      if(A.skill === 'heavensverdict'){                                       // HEAVEN'S VERDICT: both arms thrust the shield straight up at the sky, leaning back, feet wide
        tg.aN = K(p, [[0,.5],[.2,1.8],[.5,2.95],[1,2.95]]); tg.eN = K(p, [[0,1.1],[.5,.15],[1,.15]]);
        tg.aF = tg.aN - .12; tg.eF = tg.eN + .1;
        tg.lean = K(p, [[0,.05],[.5,-.3],[1,-.3]]); tg.head = K(p, [[0,0],[.5,-.2],[1,-.2]]);
        tg.tN = .45; tg.tF = -.4; legs(tg, 19.6);
        return;
      }
      if(A.skill === 'aegis'){                                                 // AEGIS STANCE: lift the shield overhead (0 - .5 s), drive it into the ground (.5 - .8 s), then slowly crouch + brace behind it until `setup`
        const e = Math.min(p * A.time, A.time), su = A.setup || 3;
        const kt = arr => { for(let i = 1; i < arr.length; i++) if(e <= arr[i][0]){ const a = arr[i - 1], b = arr[i], u = (e - a[0]) / (b[0] - a[0] || 1); return a[1] + (b[1] - a[1]) * u; } return arr[arr.length - 1][1]; };
        const tr = Math.sin(e * 31) * .014 * clamp((e - .9) / (su - .9), 0, 1) * (e < su ? 1 : 0);   // the strain tremble grows through the setup, then he is still
        tg.aN = kt([[0,.5],[.5,2.3],[.62,1.45],[su,1.4]]) + tr; tg.eN = kt([[0,1.1],[.5,.35],[.62,.12],[su,.12]]);
        tg.aF = tg.aN - .12; tg.eF = tg.eN + .1;
        tg.lean = kt([[0,.05],[.5,-.2],[.62,.32],[su,.5]]) + tr; tg.head = kt([[0,0],[.62,.1],[su,.05]]);
        tg.tN = kt([[0,.24],[.62,.5],[su,.62]]); tg.tF = kt([[0,-.2],[.62,-.4],[su,-.5]]);
        legs(tg, kt([[0,20.5],[.5,20.5],[.62,18.2],[su,16.6]]));
        return;
      }
      if(A.skill === 'sacredcharge'){                                          // SACRED CHARGE: brace (crouch behind the shield, shaking harder), then drive forward with short heavy steps
        const e = p * A.time, w = A.windup || .5, br = e < w, v = Math.sin(e * 46) * (br ? .02 + .06 * (e / w) : .03);
        tg.aN = 1.4 + v; tg.eN = .35; tg.aF = 1.3 - v; tg.eF = .45;           // shield arm straight out in front, far hand on the shield
        tg.lean = (br ? .3 : .5) + v; tg.head = (br ? .05 : .12) - v * .5;
        const s = br ? 0 : Math.sin(e * 17) * .42;
        tg.tN = (br ? .5 : .55) + s; tg.tF = (br ? -.4 : -.45) - s;
        legs(tg, br ? 17.8 + v * 20 : 19.2);
        return;
      }
      const st = COMBO[A.step || 0];
      ['aN','eN','aF','eF','lean','head','tN','tF'].forEach(j => tg[j] = K(p, st[j]));
      legs(tg, K(p, st.Y));
      if(st.kNd) tg.kN += (K(p, st.kNd) - tg.kN) * K(p, st.lift);            // lifted / kicking leg: set its knee directly
      if(st.kFd) tg.kF += (K(p, st.kFd) - tg.kF) * K(p, st.liftF);
    },

    // faint holy halo behind the head (flat ring + soft glow)
    behind(cx, f, t, S, P){
      const hx = S.head.x + 1, hy = S.head.y - 15 + Math.sin(t * 1.8) * .6, tilt = S.lean * .5 - .04;
      const g = cx.createRadialGradient(hx, hy, 1, hx, hy, 17);
      g.addColorStop(0, 'rgba(255,225,120,.35)'); g.addColorStop(1, 'rgba(255,225,120,0)');
      cx.fillStyle = g; cx.beginPath(); cx.arc(hx, hy, 17, 0, 7); cx.fill();
      cx.strokeStyle = 'rgba(11,15,28,.9)'; cx.lineWidth = 4.2; cx.beginPath(); cx.ellipse(hx, hy, 8.6, 2.8, tilt, 0, 7); cx.stroke();      // thin dark edge
      cx.strokeStyle = '#ffd65a'; cx.lineWidth = 2.2; cx.beginPath(); cx.ellipse(hx, hy, 8.6, 2.8, tilt, 0, 7); cx.stroke();                  // floating gold ring
    },

    front(cx, f, t, S, P){
      const white = f.flash > 0, r = f.rig, hj = r ? r.j.head.a : 0;
      // ---- gold pauldron on the near shoulder: a rounded plate set on the shoulder (outside + below the neck), NOT a half-dome under the chin ----
      const PX = S.aN.s.x - 1, PY = S.aN.s.y + 1;
      cx.save(); cx.translate(PX, PY); cx.rotate(S.lean * .6 - .2);
      cx.fillStyle = OUT; cx.beginPath(); cx.ellipse(0, 0, 9.6, 6.6, 0, 0, 7); cx.fill();
      cx.fillStyle = white ? '#fff' : GOLD; cx.beginPath(); cx.ellipse(0, 0, 8, 5, 0, 0, 7); cx.fill();
      cx.restore();

      // ---- helmet (drawn over the shared head): silver dome, gold brow band, cross visor slit ----
      const helmet = () => {
        cx.save(); cx.translate(S.head.x, S.head.y); cx.rotate(S.lean + hj);
        cx.fillStyle = OUT; cx.beginPath(); cx.arc(0, -.5, 7.9, 0, 7); cx.fill();
        cx.fillStyle = white ? '#fff' : SIL; cx.beginPath(); cx.arc(0, -.5, 6.6, 0, 7); cx.fill();
        cx.fillStyle = white ? '#fff' : SIL_D; cx.beginPath(); cx.arc(0, -.5, 6.6, .2, 1.9); cx.lineTo(0, -.5); cx.fill();               // shading, lower back
        cx.fillStyle = white ? '#fff' : GOLD; cx.fillRect(-6.6, -2.4, 13.2, 1.7);                                                         // brow band
        cx.fillStyle = '#0b0f1c'; cx.fillRect(.6, -.3, 6, 1.5); cx.fillRect(3.2, -.3 - 2.2, 1.2, 5.6);                                    // visor slit + cross
        cx.strokeStyle = OUT; cx.lineWidth = 3.4; cx.lineCap = 'round';                                                                   // crest (outline then gold)
        cx.restore();
      };

      // ---- SHIELD: gripped by the hand at a fixed point near its top and swung around that point (always attached). Only its rotation lags = weight. ----
      const st = f.A && f.A.step != null ? f.A.step : -1, swing = f.atk > 0 && st >= 0 && !!COMBO[st];
      const p = swing ? clamp(1 - f.atk / f.A.time, 0, 1) : 0, Cn = swing ? CS[st] : 0, big = swing && st === 2;
      const sd = f.shieldSp || (f.shieldSp = {a:0, v:0, last:t}), dt = clamp(t - sd.last, 0, .05); sd.last = t;
      const run = clamp(Math.abs(f.vx) / 170, 0, 1);
      const H = f.holy, glow = H && H.t > 0 ? (H.t > 1 ? 1 : (Math.sin(H.t * 36) > 0 ? 1 : .2)) : 0;   // Divine Impact glow (arena.js f.holy); flickers in the last second
      const fa = S.aN.hand.x - S.aN.el.x;                                      // how far forward the forearm points
      const chg = f.sc && f.atk > 0 && f.A && f.A.skill === 'sacredcharge', ce = chg ? f.A.time - f.atk : 0, cbr = chg && ce < (f.A.windup || .5);
      const castV = f.atk > 0 && f.A && f.A.skill === 'heavensverdict';
      const ag = f.aegis && f.atk > 0 && f.A && f.A.skill === 'aegis', ae = ag ? f.aegis.t : 0, planted = ag && f.aegis.on, asu = ag ? (f.A.setup || 3) : 0;
      const tgt = castV ? 0 : ag ? (ae < .5 ? .15 : 0) : chg ? -.05 : swing ? Body.keys(p, COMBO[st].rot)
                        : clamp(S.lean * .5 + run * .16 + (S.aN.hand.y - S.aN.el.y) * .01 - fa * .004, -.3, .3);   // idle: angled forward when running / leaning
      const k = swing ? 50 : 90 / SHIELD_LAG, d = swing ? 8.5 : 11 + SHIELD_LAG * 1.5;
      for(let i = 0; i < 2 && dt > 0; i++){ sd.v += (k * (tgt - sd.a) - d * sd.v) * dt / 2; sd.a += sd.v * dt / 2; }
      const GX = -2, GY = -SHIELD_H * .12, ca = Math.cos(sd.a), sa = Math.sin(sd.a);
      const hx = S.aN.hand.x + 1 + run * 2, hy = S.aN.hand.y;
      const kb = st === 1 && swing ? Body.keys(p, [[0,0],[.15,1],[.85,1],[1,0]]) : 0;   // kick: shield trails behind him, away from the leg
      const vib = chg ? Math.sin(ce * 55) * (cbr ? 1 + 2 * (ce / (f.A.windup || .5)) : 1.4) : 0;           // the shield shakes while bracing and charging
      const sx = hx - (GX * ca - GY * sa) - 9 * kb + 8 * (1 - kb) + vib, sy = hy - (GX * sa + GY * ca) - 2 * kb + vib * .6;
      let sx2 = sx, sy2 = sy;
      if(ag){ const k = clamp((ae - .52) / .12, 0, 1), ek = k * k * (3 - 2 * k), py = -SHIELD_H * .56 + 3; sy2 = sy + (py - sy) * ek; sx2 = sx + 2 * ek; }   // the shield comes down and its tip goes into the ground (the ground line clips it)
      const flash = planted ? clamp(1 - (t - f.aegis.hitT) / .2, 0, 1) : 0, gl = Math.max(glow, flash, castV ? 1 : 0);   // a blocked blow flashes the shield
      const shield = () => {                                                   // clipped at the ground line, so a stomped shield looks planted INTO the floor
        cx.save(); cx.beginPath(); cx.rect(-400, -600, 800, 603); cx.clip();
        let sb = 0; if(big && p > .36 && p < Cn) sb = 8 + 10 * Math.sin((p - .36) * 20) ** 2;   // holy glow while it is raised
        if(gl > 0) sb = Math.max(sb, 10 + 8 * gl * (.5 + .5 * Math.sin(t * 8)));
        if(planted) sb = Math.max(sb, 7);                                                          // planted: steady soft glow              // Divine Impact glow
        if(sb > 0){ cx.shadowColor = '#ffd45a'; cx.shadowBlur = sb; }
        drawShield(cx, sx2, sy2, sd.a, white, t, gl);
        if(glow > 0){ cx.shadowBlur = 0; for(let i = 0; i < 4; i++){ const a = t * 3 + i * 1.57, rr = 24 + 3 * Math.sin(t * 5 + i); cx.fillStyle = 'rgba(255,240,170,' + (.85 * glow) + ')'; cx.beginPath(); cx.arc(sx2 + Math.cos(a) * rr * .8, sy2 + Math.sin(a) * rr, 1.7, 0, 7); cx.fill(); } }   // little holy motes circling it
        cx.restore();
      };
      const aboveChin = sy2 - SHIELD_H * .5 - 2 < S.head.y + 9;                 // raised above the chin: drawn BEHIND the helmet so the face is never hidden
      // ---- FOREARMS: steel arm + gold vambrace + gold gauntlet, drawn behind the shield (it is strapped to the arm) ----
      const forearm = (A, far) => {
        const cap = Body.capsule, lp = (a, b, k) => ({x:a.x + (b.x - a.x) * k, y:a.y + (b.y - a.y) * k});
        const arm = white ? '#fff' : (far ? P.far : P.limb), gold = white ? '#fff' : GOLD;
        cap(cx, A.el, A.hand, 12.4, OUT); cap(cx, A.el, A.hand, 9.2, arm);
        cap(cx, lp(A.el, A.hand, .25), lp(A.el, A.hand, .7), 12.8, OUT); cap(cx, lp(A.el, A.hand, .25), lp(A.el, A.hand, .7), 9.6, gold);   // vambrace
        cx.fillStyle = OUT; cx.beginPath(); cx.arc(A.hand.x, A.hand.y, 6.4, 0, 7); cx.fill();                                                  // gauntlet
        cx.fillStyle = gold; cx.beginPath(); cx.arc(A.hand.x, A.hand.y, 4.8, 0, 7); cx.fill();
      };
      if(f.atk > 0 && f.A && (f.A.skill === 'sacredcharge' || f.A.skill === 'aegis' || f.A.skill === 'heavensverdict' || f.A.step === 0 || f.A.step === 2)) forearm(S.aF, true);   // arms BEHIND the shield: he grips it from the back
      forearm(S.aN, false);
      if(aboveChin){ shield(); helmet(); } else { helmet(); shield(); }
      const KL = kickLeg(S), kicking = f.atk > 0 && f.A && f.A.step === 1;
      if(kicking) drawKickLeg(cx, KL, white, P);                               // on top of torso + shield, so the kick is always readable

      // ---- HEAVEN'S VERDICT cast: a beam of light shoots up from the raised shield ----
      if(castV && (f.A.time - f.atk) / f.A.time > .3){
        const k = clamp(((f.A.time - f.atk) / f.A.time - .3) / .3, 0, 1), fl = .75 + .25 * Math.sin(t * 40), gr = cx.createLinearGradient(0, sy2 - SHIELD_H * .5, 0, -460);
        gr.addColorStop(0, 'rgba(255,230,140,' + .6 * k * fl + ')'); gr.addColorStop(1, 'rgba(255,230,140,0)');
        cx.save(); cx.fillStyle = gr; cx.fillRect(sx2 - 9 * k, -460, 18 * k, 460 + sy2 - SHIELD_H * .5); cx.restore();
      }
      // ---- AEGIS STANCE effects: dust ring when the shield hits the ground, a gold pulse when it becomes fully planted ----
      if(ag){
        cx.save(); cx.lineCap = 'round';
        if(ae > .58 && ae < 1.1){ const kk = (ae - .58) / .52, a = 1 - kk, gx = sx2 + 2; cx.strokeStyle = 'rgba(225,215,185,' + a * .8 + ')'; cx.lineWidth = 2.4 * a + .5; cx.beginPath(); cx.ellipse(gx, -1, 8 + kk * 34, 2 + kk * 5, 0, 0, 7); cx.stroke(); cx.fillStyle = 'rgba(225,215,185,' + a * .6 + ')'; for(let i = 0; i < 6; i++){ cx.beginPath(); cx.arc(gx + (i - 2.5) * (5 + kk * 9), -2 - kk * (4 + (i % 3) * 4), 2 + kk * 2, 0, 7); cx.fill(); } }
        if(planted && ae - asu < .45){ const kk = (ae - asu) / .45; cx.strokeStyle = 'rgba(255,214,90,' + (1 - kk) + ')'; cx.lineWidth = 3 * (1 - kk) + .6; cx.beginPath(); cx.ellipse(sx2 + 2, sy2 - 6, 14 + kk * 26, 22 + kk * 22, 0, 0, 7); cx.stroke(); }
        cx.restore();
      }
      // ---- SACRED CHARGE effects: gold charge-up ring while bracing, speed lines behind him + sparks off the shield face while charging / pushing ----
      if(chg){
        cx.save(); cx.lineCap = 'round';
        if(cbr){ const k = ce / (f.A.windup || .5); cx.strokeStyle = 'rgba(255,214,90,' + (.7 * (1 - k) + .15) + ')'; cx.lineWidth = 2; cx.beginPath(); cx.ellipse(sx + 4, sy, 34 * (1 - k) + 12, 40 * (1 - k) + 14, 0, 0, 7); cx.stroke(); }
        else{
          for(let i = 0; i < 5; i++){ const yy = -8 - i * 9, ln = 22 + ((t * 9 + i * 3.7) % 1) * 26, x0 = -26 - ((t * 7 + i * 1.9) % 1) * 18; cx.strokeStyle = 'rgba(255,240,190,' + (.5 - i * .06) + ')'; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(x0, yy); cx.lineTo(x0 - ln, yy); cx.stroke(); }
          if(f.sc.target){ cx.fillStyle = 'rgba(255,236,150,.9)'; for(let i = 0; i < 4; i++){ const a = t * 31 + i * 1.7; cx.beginPath(); cx.arc(sx + 20 + Math.cos(a) * 5, sy + Math.sin(a * 1.3) * 18, 1.8, 0, 7); cx.fill(); } }
        }
        cx.restore();
      }
      // ---- impact effects ----
      if(swing){
        cx.save(); cx.lineCap = 'round';
        const len = big ? .34 : .24;
        if(st === 1){                                                          // KICK: gold streak along the leg, burst at the foot
          if(p > Cn - .1 && p < Cn + .08){
            cx.strokeStyle = 'rgba(255,225,130,.5)'; cx.lineWidth = 6; cx.beginPath(); cx.moveTo(KL.hip.x, KL.hip.y); cx.lineTo(KL.ankle.x, KL.ankle.y); cx.stroke();
          }
          if(p >= Cn - .02 && p < Cn + len){
            const kk = (p - Cn + .02) / (len + .02), ex = KL.ankle.x + 8, ey = KL.ankle.y - 2;
            cx.shadowColor = '#ffd45a'; cx.shadowBlur = 10;
            cx.strokeStyle = 'rgba(255,214,90,' + (1 - kk) + ')'; cx.lineWidth = 3 * (1 - kk) + .6;
            cx.beginPath(); cx.ellipse(ex + kk * 8, ey, 6 + kk * 12, 10 + kk * 24, 0, 0, 7); cx.stroke();
            cx.strokeStyle = 'rgba(255,245,200,' + (1 - kk) + ')'; cx.lineWidth = 1.4;
            for(let i = 0; i < 8; i++){ const a = -1.3 + i * .37, r0 = 8 + kk * 8, r1 = r0 + 6 + kk * 14; cx.beginPath(); cx.moveTo(ex + Math.cos(a) * r0, ey + Math.sin(a) * r0 * 1.5); cx.lineTo(ex + Math.cos(a) * r1, ey + Math.sin(a) * r1 * 1.5); cx.stroke(); }
            cx.shadowBlur = 0;
          }
        } else if(p >= Cn && p < Cn + len + .1){                              // STOMP / SMASH: shock ring + cracks + dust on the floor (bigger for the smash)
          const kk = clamp((p - Cn) / (len + .1), 0, 1), a = 1 - kk, sc = big ? 1.8 : 1, gx = sx + 8;
          cx.shadowColor = '#ffd45a'; cx.shadowBlur = 8; cx.strokeStyle = 'rgba(255,214,90,' + a + ')'; cx.lineWidth = (3.4 * a + .6) * sc;
          cx.beginPath(); cx.ellipse(gx, -1, (8 + kk * 60) * sc, (2 + kk * 8) * sc, 0, 0, 7); cx.stroke(); cx.shadowBlur = 0;
          cx.strokeStyle = 'rgba(30,24,16,' + a * .9 + ')'; cx.lineWidth = 1.6 * (big ? 1.4 : 1);
          for(let i = 0; i < (big ? 7 : 4); i++){ const x0 = gx + (i - (big ? 3 : 1)) * 13 * (.4 + kk) * sc, x1 = x0 + (9 + kk * 14) * sc; cx.beginPath(); cx.moveTo(x0, 0); cx.lineTo((x0 + x1) / 2, -2 - (i % 2) * 2); cx.lineTo(x1, 0); cx.stroke(); }
          cx.fillStyle = 'rgba(225,215,185,' + a * .75 + ')';
          for(let i = 0; i < (big ? 9 : 5); i++){ const n = big ? 9 : 5, dx = (i - (n - 1) / 2) * (7 + kk * 16) * sc, dy = -2 - kk * (6 + (i % 3) * 5) * sc; cx.beginPath(); cx.arc(gx + dx, dy, (2.5 + kk * 3.5) * (big ? 1.3 : 1), 0, 7); cx.fill(); }
          if(big){
            cx.fillStyle = 'rgba(255,225,120,' + a * .45 + ')'; cx.fillRect(gx - 6 * a, -90 * a - 4, 12 * a, 90 * a + 4);          // light pillar
            cx.fillStyle = 'rgba(90,76,52,' + a + ')';
            for(let i = 0; i < 6; i++){ const dx = (i - 2.5) * kk * 34, dy = -(46 * kk - 44 * kk * kk) * (.6 + (i % 3) * .3); cx.fillRect(gx + dx - 2, dy - 2, 4, 4); }   // flying rocks
          }
        }
        cx.restore();
      }
    }
  });
})();