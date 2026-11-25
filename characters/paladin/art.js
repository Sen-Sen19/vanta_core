// PALADIN art - THE DIVINE JUGGERNAUT. Same shared ragdoll (body.js), same combo / skill poses and springs; only the LOOK changed.
// Look: pristine white + polished gold plate armor, angular Crusader helm with a glowing T visor, floating circular halo, layered pauldrons / breastplate / backplate / tassets / greaves,
//       and the DIVINE AEGIS: a fortress-sized tower shield held with BOTH hands.
// Hooks used: body (sizes), colors, torso() = layered plate torso (breastplate + sun emblem + backplate), foot() = boot + tassets / greave / knee guard on each leg,
//             pose() = heavy idle / carry the shield, attack() + spring() = 3-HIT STOMP COMBO + skills (UNCHANGED), behind() = halo,
//             front() = pauldrons, both armored arms + gauntlets, the shield (own rotation spring), helmet, effects.
// ARMS: the shared ragdoll still animates every joint (aN/eN near arm, aF/eF far arm). Its own arm capsules are made hair-thin (uArm / fArm w and hand r) and front() draws the armored arms instead:
//   the NEAR hand = the skeleton hand (the shield is hung from it, as before), the FAR hand = a second grip on the same handle (2-bone IK from the far shoulder, so it never detaches).
//   During the kick (shield swung back) and when hurt the far arm falls back to the skeleton (free arm). The blend is smoothed (f.shieldSp.fw), so nothing snaps.
// SHIELD: separate drawn object with its own rotation spring (f.shieldSp; NOT f.shd, arena.js uses that for Shadow Hook). Hitbox is still the shared 30x52 (arena.js unchanged).
// SETTINGS: SHIELD_W / SHIELD_H = tower shield size (px).  SHIELD_LAG = how late the shield follows the arm (higher = more delay).
(() => {
  const SHIELD_W = 42, SHIELD_H = 56, SHIELD_LAG = 1;
  const WHITE = '#ffffff', WH_M = '#eef1f6', WH_D = '#d9dee8', GOLD = '#e3b53c', GOLD_D = '#a87a14', HI = '#fff6d6', OUT = '#0b0f1c';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const T = 10, SH = 9.5;                         // thigh + shin length (default body, keep in sync with body below)
  let NOWT = 0, NOWE = 0;                         // set by behind() (it always runs first), read by torso() for the chest emblem glow
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

  // ---- small helpers ----
  const rrect = (cx, x, y, w, h, r) => { cx.beginPath(); if(cx.roundRect) cx.roundRect(x, y, w, h, r); else cx.rect(x, y, w, h); };
  const bandG = (cx, a, b, w, col) => { cx.lineCap = 'butt'; cx.strokeStyle = col; cx.lineWidth = w; cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); cx.stroke(); cx.lineCap = 'round'; };   // flat-ended plate segment (the ragdoll capsule has round ends)
  const lp = (a, b, k) => ({x:a.x + (b.x - a.x) * k, y:a.y + (b.y - a.y) * k});
  // divine energy 0..1: calm at idle, strong during his abilities, a planted Aegis, a blocked blow and the Divine Impact glow
  const energy = (f, t) => {
    const A = f.atk > 0 && f.A; let e = 0;
    if(A && (A.skill === 'sacredcharge' || A.skill === 'aegis' || A.skill === 'heavensverdict' || A.skill === 'divineimpact')) e = .75;
    if(f.aegis && f.aegis.on) e = Math.max(e, .65 + clamp(1 - (t - f.aegis.hitT) / .25, 0, 1) * .35);
    const H = f.holy; if(H && H.t > 0) e = Math.max(e, H.t > 1 ? .85 : (Math.sin(H.t * 36) > 0 ? .85 : .25));
    return e;
  };
  // two-bone IK from shoulder s to target g (same angle convention as body.js: 0 = down, + = forward, elbow bends so the forearm turns forward). Stretches a little (<=32%) if the target is out of reach.
  function ik(s, g, l1, l2){
    let dx = g.x - s.x, dy = g.y - s.y, d = Math.hypot(dx, dy) || .001;
    const k = clamp(d / (l1 + l2) / .985, 1, 1.32), L1 = l1 * k, L2 = l2 * k, reach = (L1 + L2) * .985;
    if(d > reach){ dx *= reach / d; dy *= reach / d; d = reach; }
    const th = Math.atan2(dx, dy), phi = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1)), a1 = th - phi;
    return {el:{x:s.x + Math.sin(a1) * L1, y:s.y + Math.cos(a1) * L1}, hand:{x:s.x + dx, y:s.y + dy}};
  }

  // ---- DIVINE SUN EMBLEM (chest + shield): soft radiance, 12 rays that breathe, gold disc, bright white core ----
  function sun(cx, x, y, r, t, E, white){
    if(!white){
      const g = cx.createRadialGradient(x, y, r * .3, x, y, r * 2.7);
      g.addColorStop(0, 'rgba(255,240,170,' + (.26 + .4 * E) + ')'); g.addColorStop(1, 'rgba(255,240,170,0)');
      cx.fillStyle = g; cx.beginPath(); cx.arc(x, y, r * 2.7, 0, 7); cx.fill();
    }
    cx.lineJoin = 'round';
    for(let i = 0; i < 12; i++){
      const a = i * Math.PI / 6, l = ((i % 2 ? 1.5 : 1.9) + Math.sin(t * 2.4 + i) * .07) * r, w = i % 2 ? .13 : .16;
      cx.beginPath(); cx.moveTo(x + Math.cos(a - w) * r * .9, y + Math.sin(a - w) * r * .9); cx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); cx.lineTo(x + Math.cos(a + w) * r * .9, y + Math.sin(a + w) * r * .9); cx.closePath();
      cx.fillStyle = white ? WHITE : GOLD_D; cx.fill(); cx.lineWidth = .7; cx.strokeStyle = OUT; cx.stroke();
    }
    cx.fillStyle = OUT; cx.beginPath(); cx.arc(x, y, r + .9, 0, 7); cx.fill();
    cx.fillStyle = white ? WHITE : GOLD; cx.beginPath(); cx.arc(x, y, r, 0, 7); cx.fill();
    if(white) return;
    cx.strokeStyle = GOLD_D; cx.lineWidth = .8; cx.beginPath(); cx.arc(x, y, r * .72, 0, 7); cx.stroke();
    cx.fillStyle = HI; cx.beginPath(); cx.arc(x, y, r * (.4 + .04 * Math.sin(t * 3.1) + .1 * E), 0, 7); cx.fill();
  }

  // ---- KICK LEG ----
  // His torso is a barrel but the legs are only 19.5px long (the hitbox needs that), so the real far leg never clears the belly: it hid behind the barrel and the shield.
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
  // armored boot: cuff, shaft, toe box, thick sole. origin = ankle, x = toward the toe (a bit longer than before, the height still puts the sole exactly on the floor)
  function bootShape(cx, ax, ay, phi, white, P, kick){
    cx.save(); cx.translate(ax, ay); cx.rotate(phi); cx.scale(.76, .62); cx.lineJoin = 'round';
    const path = () => { cx.beginPath(); cx.moveTo(-8, -9); cx.lineTo(8, -9); cx.lineTo(9, -1); cx.quadraticCurveTo(21, 0, 22, 6); cx.lineTo(22, 9); cx.lineTo(-9, 9); cx.quadraticCurveTo(-11, 0, -8, -9); cx.closePath(); };
    path(); cx.fillStyle = OUT; cx.fill(); cx.lineWidth = 3.4; cx.strokeStyle = OUT; cx.stroke();
    path(); cx.fillStyle = white ? WHITE : WHITE; cx.fill();
    if(!white){
      cx.save(); path(); cx.clip();
      cx.fillStyle = WH_D; cx.fillRect(-12, 1, 36, 10);                                           // shaded lower half
      cx.fillStyle = GOLD; cx.fillRect(-9, -9.5, 18, 3.8);                                        // gold cuff
      cx.fillStyle = OUT; cx.fillRect(-9, -5.9, 18, .9);
      cx.beginPath(); cx.moveTo(9, -1); cx.quadraticCurveTo(21, 0, 22, 6); cx.lineTo(13, 6); cx.closePath(); cx.fillStyle = GOLD; cx.fill();   // gold toe cap
      cx.fillStyle = OUT; cx.fillRect(-12, 6, 36, 3.2);                                           // sole
      cx.restore();
      cx.strokeStyle = OUT; cx.lineWidth = 1.2; cx.beginPath(); cx.moveTo(9, -1); cx.lineTo(13, 6); cx.stroke();
    }
    cx.restore();
  }
  // ---- LEG ARMOR (drawn right after each leg, so the layering matches the ragdoll): layered TASSETS on the upper thigh, a GREAVE on the shin, a heavy KNEE GUARD ----
  function legArmor(cx, hip, knee, ankle, white, far){
    const gold = white ? WHITE : GOLD, base = white ? WHITE : (far ? WH_D : WHITE);
    cx.save(); cx.lineJoin = 'round';
    const ang = Math.atan2(knee.y - hip.y, knee.x - hip.x), sc = Math.hypot(knee.x - hip.x, knee.y - hip.y) / T, hw = far ? 6.6 : 7.2;
    cx.save(); cx.translate(hip.x, hip.y); cx.rotate(ang); cx.scale(sc, 1);
    [[7, 11.8], [4.8, 9.6], [2.6, 7.4]].forEach(([x0, x1]) => {                                    // lowest lame first, the hip lame ends on top
      rrect(cx, x0, -hw, x1 - x0, hw * 2, 2.2); cx.fillStyle = base; cx.fill(); cx.lineWidth = 1.8; cx.strokeStyle = OUT; cx.stroke();
      cx.fillStyle = gold; cx.fillRect(x1 - 1.9, -hw + 1.4, 1.6, hw * 2 - 2.8);                    // gold edge on every lame
      if(!white){ cx.fillStyle = 'rgba(255,255,255,.7)'; cx.fillRect(x0 + .6, -hw + 1, x1 - x0 - 2.8, 1.6); }
    });
    cx.restore();
    const cap = Body.capsule, a = lp(knee, ankle, .1), b = lp(knee, ankle, .97);                     // greave
    cap(cx, a, b, 13.4, OUT); cap(cx, a, b, 11, base);
    bandG(cx, lp(knee, ankle, .28), lp(knee, ankle, .38), 13.4, OUT); bandG(cx, lp(knee, ankle, .3), lp(knee, ankle, .36), 11.2, gold);
    bandG(cx, lp(knee, ankle, .72), lp(knee, ankle, .82), 13.4, OUT); bandG(cx, lp(knee, ankle, .74), lp(knee, ankle, .8), 11.2, gold);
    if(!white) bandG(cx, lp(knee, ankle, .42), lp(knee, ankle, .68), 3, 'rgba(255,255,255,.85)');
    const kx = knee.x + 2.2, ky = knee.y + .6;                                                       // knee guard
    cx.beginPath(); cx.ellipse(kx, ky, 7.4, 8, 0, 0, 7); cx.fillStyle = OUT; cx.fill();
    cx.beginPath(); cx.ellipse(kx, ky, 6.1, 6.7, 0, 0, 7); cx.fillStyle = base; cx.fill();
    cx.beginPath(); cx.ellipse(kx, ky, 4.6, 5.2, 0, 0, 7); cx.lineWidth = 1.8; cx.strokeStyle = gold; cx.stroke();
    cx.fillStyle = gold; cx.beginPath(); cx.arc(kx, ky, 2.3, 0, 7); cx.fill(); if(!white){ cx.fillStyle = HI; cx.beginPath(); cx.arc(kx - .5, ky - .6, 1, 0, 7); cx.fill(); }
    cx.restore();
  }
  function drawKickLeg(cx, K, white, P){
    const a = clamp((K.w - .5) * 3, 0, 1); if(a < .05) return;
    cx.save(); cx.globalAlpha *= a;
    const cap = Body.capsule, leg = white ? WHITE : (P.legs || P.limb);
    cap(cx, K.hip, K.knee, 14.8, OUT); cap(cx, K.knee, K.ankle, 13.6, OUT);                    // outline (thigh thick, shin tapers to the ankle)
    cap(cx, K.hip, K.knee, 11.6, leg); cap(cx, K.knee, K.ankle, 10.4, leg);                      // same widths + color as his standing leg
    legArmor(cx, K.hip, K.knee, K.ankle, white, false);
    bootShape(cx, K.ankle.x, K.ankle.y, clamp(-K.sa * .5, -.8, .8), white, P, true);
    cx.restore();
  }

  // ---- DIVINE AEGIS: fortress tower shield. Path is centered on (0,0): top at -.44h, bottom at +.56h (the Aegis plant math relies on this). s = inset scale. ----
  function fort(cx, w, h, s){
    const x = w / 2, t = -h * .44, b = h * .56, m = (t + b) / 2, c = 9;
    const P = [[-x, t + c * .9], [-x + c, t], [x - c, t], [x, t + c * .9], [x, h * .2], [x * .46, b - 3], [x * .24, b], [-x * .24, b], [-x * .46, b - 3], [-x, h * .2]];
    cx.beginPath(); P.forEach(([px, py], i) => { const X = px * s, Y = m + (py - m) * s; i ? cx.lineTo(X, Y) : cx.moveTo(X, Y); }); cx.closePath();
  }
  function drawShield(cx, X, Y, rot, white, t, glow, E, gx, gy){
    const w = SHIELD_W, h = SHIELD_H, x = w / 2, tp = -h * .44;
    cx.save(); cx.translate(X, Y); cx.rotate(rot); cx.lineJoin = 'round';
    fort(cx, w, h, 1); cx.fillStyle = OUT; cx.fill(); cx.lineWidth = 3; cx.strokeStyle = OUT; cx.stroke(); cx.shadowBlur = 0;                // outline (the outer glow is cast only by this first shape)
    fort(cx, w, h, 1);
    if(white) cx.fillStyle = WHITE; else { const g = cx.createLinearGradient(-x, tp, x, h * .56); g.addColorStop(0, '#f3d377'); g.addColorStop(.5, GOLD); g.addColorStop(1, GOLD_D); cx.fillStyle = g; }
    cx.fill();                                                                                                                          // thick golden frame
    fort(cx, w, h, .8); cx.fillStyle = OUT; cx.fill(); fort(cx, w, h, .78); cx.fillStyle = WHITE; cx.fill();                           // white face (thin dark seam to the frame)
    if(!white){
      cx.save(); fort(cx, w, h, .78); cx.clip();
      const g = cx.createLinearGradient(-x, tp, x, h * .5);                                                                             // soft light from the top-left
      g.addColorStop(0, 'rgba(255,255,255,.7)'); g.addColorStop(.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(120,135,170,.3)');
      cx.fillStyle = g; cx.fillRect(-w, -h, w * 2, h * 2);
      for(const yy of [tp + h * .2, h * .56 - h * .27]){                                                                                // two heavy gold reinforcement ribs
        cx.fillStyle = OUT; cx.fillRect(-x, yy - 2.6, w, 5.2); cx.fillStyle = GOLD; cx.fillRect(-x, yy - 1.6, w, 3.2); cx.fillStyle = 'rgba(255,246,214,.8)'; cx.fillRect(-x, yy - 1.6, w, 1);
      }
      sun(cx, 5, -h * .04, 6, t, E, false);                                                                                              // radiant sun emblem
      cx.restore();
      cx.fillStyle = GOLD_D; for(const [sx, sy] of [[-x + 7, tp + 5.5], [x - 7, tp + 5.5], [x - 3.4, 0], [-x + 3.4, 0]]){ cx.beginPath(); cx.arc(sx, sy, 1.5, 0, 7); cx.fill(); }   // rivets in the frame
      // HANDLE: a heavy gold grip bar across the rear of the face, both gauntlets wrap it (gx, gy = the near grip in shield space)
      const x0 = gx - 9, x1 = gx + 5;
      cx.lineCap = 'round'; cx.strokeStyle = OUT; cx.lineWidth = 9; cx.beginPath(); cx.moveTo(x0, gy); cx.lineTo(x1, gy); cx.stroke();
      cx.strokeStyle = GOLD; cx.lineWidth = 6; cx.beginPath(); cx.moveTo(x0, gy); cx.lineTo(x1, gy); cx.stroke();
      cx.strokeStyle = HI; cx.lineWidth = 1.4; cx.beginPath(); cx.moveTo(x0 + 1, gy - 1.6); cx.lineTo(x1 - 1, gy - 1.6); cx.stroke();
      if(E > .02){ fort(cx, w, h, 1); cx.fillStyle = 'rgba(255,246,214,' + (.14 + .26 * E) + ')'; cx.fill(); }                              // divine radiance wash during abilities
      if(glow > 0){   // DIVINE IMPACT: the shield is charged with holy light (gold wash + bright rim)
        fort(cx, w, h, 1); cx.fillStyle = 'rgba(255,232,140,' + (.42 * glow) + ')'; cx.fill();
        cx.lineWidth = 2; cx.strokeStyle = 'rgba(255,248,210,' + glow + ')'; cx.stroke();
      }
    }
    cx.restore();
  }

  // ---- HELMET: heavy angular Crusader great helm. Fully enclosed, T-shaped visor that burns white-gold, gold brow + jaw trim. No crest / horns / crown. ----
  function helmet(cx, S, hj, white, t, E){
    cx.save(); cx.translate(S.head.x, S.head.y); cx.rotate(S.lean + hj); cx.scale(.9, .9); cx.lineJoin = 'round';
    const poly = () => { cx.beginPath(); cx.moveTo(-8.8, -3.4); cx.lineTo(-4.2, -10); cx.lineTo(4.2, -10.4); cx.lineTo(9.8, -5.8); cx.lineTo(10.4, 3); cx.lineTo(7.4, 8.9); cx.lineTo(-3.8, 9.4); cx.lineTo(-8.9, 4.4); cx.closePath(); };
    poly(); cx.fillStyle = OUT; cx.fill(); cx.lineWidth = 3.2; cx.strokeStyle = OUT; cx.stroke();
    poly(); cx.fillStyle = WHITE; cx.fill();
    const tee = () => { cx.beginPath(); cx.moveTo(-.4, -2.9); cx.lineTo(8.6, -2.9); cx.lineTo(8.6, -.6); cx.lineTo(5.9, -.6); cx.lineTo(5.9, 6.2); cx.lineTo(3.5, 6.2); cx.lineTo(3.5, -.6); cx.lineTo(-.4, -.6); cx.closePath(); };
    if(!white){
      cx.save(); poly(); cx.clip();
      cx.fillStyle = WH_M; cx.fillRect(-10, -4, 22, 14); cx.fillStyle = WH_D; cx.fillRect(-10, 4.8, 22, 6);                           // faceplate + jaw shading
      cx.fillStyle = 'rgba(150,160,185,.35)'; cx.fillRect(-10, -11, 4.6, 22);                                                          // back of the helm in shade
      cx.fillStyle = 'rgba(255,255,255,.95)'; cx.beginPath(); cx.moveTo(-3.6, -9.6); cx.lineTo(4, -10); cx.lineTo(8.8, -6.6); cx.lineTo(-5.6, -6.3); cx.closePath(); cx.fill();   // lit top facet
      cx.fillStyle = OUT; cx.fillRect(-10, -7.1, 22, 3.6); cx.fillStyle = GOLD; cx.fillRect(-10, -6.6, 22, 2.6); cx.fillStyle = HI; cx.fillRect(-10, -6.6, 22, .8);   // gold brow band
      cx.strokeStyle = OUT; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(-1.8, -3.5); cx.lineTo(-1.8, 9.6); cx.stroke();                 // cheek seam
      cx.fillStyle = GOLD; cx.beginPath(); cx.arc(-1.8, 1.2, 1, 0, 7); cx.fill();
      cx.restore();
      cx.strokeStyle = GOLD; cx.lineWidth = 1.5; cx.lineCap = 'round'; cx.beginPath(); cx.moveTo(10.2, 3.4); cx.lineTo(7.3, 8.6); cx.lineTo(-3.6, 9.1); cx.stroke();   // gold jaw trim
      const v = .8 + .08 * Math.sin(t * 3) + .2 * E;                                                                                   // T VISOR light
      const g = cx.createRadialGradient(6, 0, 1, 6, 1, 15); g.addColorStop(0, 'rgba(255,244,190,' + .4 * v + ')'); g.addColorStop(1, 'rgba(255,244,190,0)');
      cx.fillStyle = g; cx.beginPath(); cx.arc(6, 1, 15, 0, 7); cx.fill();
      tee(); cx.lineWidth = 3.4; cx.strokeStyle = OUT; cx.stroke(); cx.lineWidth = 1.8; cx.strokeStyle = GOLD; cx.stroke();               // dark + gold frame
      cx.shadowColor = '#ffe9a0'; cx.shadowBlur = 7 + 9 * E;
      tee(); cx.fillStyle = 'rgba(255,252,235,' + Math.min(1, v) + ')'; cx.fill(); cx.shadowBlur = 0;
      cx.fillStyle = '#fff'; cx.fillRect(.6, -2.3, 7.4, 1.1); cx.fillRect(4.1, -.6, 1.2, 5.6);                                            // white-hot core
    } else { tee(); cx.fillStyle = WHITE; cx.fill(); }
    cx.restore();
  }

  // ---- PAULDRON: massive layered dome (white, gold ridge + rim, a second lame underneath). far = darker and a bit smaller. ----
  function pauldron(cx, x, y, rot, sc, far, white, E){
    cx.save(); cx.translate(x, y); cx.rotate(rot); cx.scale(sc, sc); cx.lineJoin = 'round';
    const base = white ? WHITE : (far ? WH_D : WHITE), gold = white ? WHITE : GOLD;
    cx.beginPath(); cx.ellipse(1, 10, 11.5, 4.6, 0, 0, 7); cx.fillStyle = OUT; cx.fill(); cx.beginPath(); cx.ellipse(1, 10, 10, 3.4, 0, 0, 7); cx.fillStyle = base; cx.fill(); cx.lineWidth = 1.6; cx.strokeStyle = gold; cx.stroke();   // lower lame
    const dome = () => { cx.beginPath(); cx.moveTo(-14, 5); cx.bezierCurveTo(-15, -10, 10, -14.5, 15, 1); cx.lineTo(12, 8.5); cx.quadraticCurveTo(0, 11.5, -10.5, 8.5); cx.closePath(); };
    dome(); cx.fillStyle = OUT; cx.fill(); cx.lineWidth = 3.2; cx.strokeStyle = OUT; cx.stroke();
    dome(); cx.fillStyle = base; cx.fill();
    if(!white){
      cx.save(); dome(); cx.clip();
      const g = cx.createLinearGradient(-12, -12, 10, 9); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(120,135,170,.35)');
      cx.fillStyle = g; cx.fillRect(-16, -16, 34, 30); cx.restore();
    }
    cx.lineCap = 'round';
    cx.beginPath(); cx.moveTo(-12.6, -1.2); cx.bezierCurveTo(-8, -9.4, 6, -11, 13.6, -3); cx.lineWidth = 5; cx.strokeStyle = OUT; cx.stroke(); cx.lineWidth = 2.8; cx.strokeStyle = gold; cx.stroke();   // gold ridge
    cx.beginPath(); cx.moveTo(-10.6, 8.6); cx.quadraticCurveTo(0, 11.6, 12.2, 8.6); cx.lineWidth = 4.8; cx.strokeStyle = OUT; cx.stroke(); cx.lineWidth = 2.6; cx.strokeStyle = gold; cx.stroke();      // gold rim
    if(!white){ cx.fillStyle = HI; cx.beginPath(); cx.arc(-6, -6.2, 1.6, 0, 7); cx.fill(); if(E > .05){ cx.strokeStyle = 'rgba(255,240,170,' + E * .7 + ')'; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(-10.6, 8.6); cx.quadraticCurveTo(0, 11.6, 12.2, 8.6); cx.stroke(); } }
    cx.restore();
  }

  // ---- ARM: layered white rerebrace + vambrace with gold bands, elbow cop, and a heavy armored fist (gauntlet) ----
  function armor(cx, s, el, hand, far, white, E){
    const AW = .84, cap = (c, a, b, w, col) => Body.capsule(c, a, b, w * AW, col), band = (c, a, b, w, col) => bandG(c, a, b, w * AW, col), base = white ? WHITE : (far ? WH_D : WH_M), plate = white ? WHITE : (far ? WH_M : WHITE), gold = white ? WHITE : GOLD;
    cx.save(); cx.lineJoin = 'round';
    cap(cx, s, el, 15.2, OUT); cap(cx, s, el, 12.6, base);                                                                              // upper arm
    band(cx, lp(s, el, .24), lp(s, el, .72), 15.8, OUT); band(cx, lp(s, el, .24), lp(s, el, .72), 13.4, plate);                         // layered upper plate
    band(cx, lp(s, el, .64), lp(s, el, .76), 15.6, OUT); band(cx, lp(s, el, .66), lp(s, el, .74), 14.2, gold);                           // gold band
    if(!white){ const g = .1 + .4 * E, q = cx.createRadialGradient(el.x, el.y, 1, el.x, el.y, 11); q.addColorStop(0, 'rgba(255,236,150,' + g + ')'); q.addColorStop(1, 'rgba(255,236,150,0)'); cx.fillStyle = q; cx.beginPath(); cx.arc(el.x, el.y, 11, 0, 7); cx.fill(); }   // golden energy at the joint
    cx.fillStyle = OUT; cx.beginPath(); cx.arc(el.x, el.y, 7.6, 0, 7); cx.fill(); cx.fillStyle = gold; cx.beginPath(); cx.arc(el.x, el.y, 6.4, 0, 7); cx.fill();   // elbow cop
    cx.fillStyle = white ? WHITE : plate; cx.beginPath(); cx.arc(el.x, el.y, 4.2, 0, 7); cx.fill(); cx.strokeStyle = OUT; cx.lineWidth = .8; cx.stroke();
    cap(cx, el, hand, 14.2, OUT); cap(cx, el, hand, 11.8, base);                                                                       // forearm
    band(cx, lp(el, hand, .22), lp(el, hand, .72), 14.8, OUT); band(cx, lp(el, hand, .22), lp(el, hand, .72), 12.6, plate);                   // vambrace
    band(cx, lp(el, hand, .6), lp(el, hand, .76), 15, OUT); band(cx, lp(el, hand, .62), lp(el, hand, .74), 13.6, gold);               // gold cuff
    if(!white) band(cx, lp(el, hand, .28), lp(el, hand, .56), 2.4, gold);
    // fist: back-of-hand plate + 3 finger plates + thumb, gold knuckle guard. x axis = forearm direction.
    const ang = Math.atan2(hand.y - el.y, hand.x - el.x), flip = Math.cos(ang) < 0 ? -1 : 1;
    cx.save(); cx.translate(hand.x, hand.y); cx.rotate(ang); cx.scale(1, flip);
    rrect(cx, -6.4, -5.8, 11.6, 11.6, 3); cx.fillStyle = OUT; cx.fill(); cx.lineWidth = 2.4; cx.strokeStyle = OUT; cx.stroke();
    rrect(cx, -5.8, -5.2, 10.4, 10.4, 2.6); cx.fillStyle = far ? (white ? WHITE : WH_D) : WHITE; cx.fill();
    for(let i = -1; i <= 1; i++){ rrect(cx, 3.2, i * 3.7 - 2, 5, 4, 1.8); cx.fillStyle = OUT; cx.fill(); rrect(cx, 3.5, i * 3.7 - 1.6, 4.2, 3.2, 1.4); cx.fillStyle = white ? WHITE : plate; cx.fill(); }   // armored fingers wrapped over the handle
    cx.fillStyle = gold; cx.fillRect(1.6, -5.2, 2.2, 10.4); cx.fillStyle = OUT; cx.fillRect(1.2, -5.2, .7, 10.4);                       // gold knuckle guard
    rrect(cx, -2.6, -7.6, 6.4, 3.4, 1.6); cx.fillStyle = OUT; cx.fill(); rrect(cx, -2, -7.2, 5.2, 2.6, 1.2); cx.fillStyle = white ? WHITE : plate; cx.fill();   // thumb
    cx.restore();
    cx.restore();
  }

  Characters.art('paladin', {
    // MASSIVE: huge plated barrel torso, thick armored limbs, big gauntlets and boots. Limb LENGTHS unchanged (legs()/T/SH and the 30x52 hitbox still match). torso len +1 and a slightly raised head = a little taller.
    // The ragdoll's OWN arm capsules (uArm / fArm w, hand r) are hair-thin on purpose: front() draws the armored arms (they have to follow the shield grip). Joints, angles and springs are untouched.
    body: {noRings:1, belt:4.5, head:{r:5.2}, headSink:6, torso:{len:9, w:28}, uArm:{len:9, w:.1}, fArm:{len:9, w:.1}, hand:{r:.1},
           thigh:{len:10, w:11.6}, shin:{len:9.5, w:10.4}, foot:{len:8, w:11}},
    colors: {shirt:WHITE, limb:'#f1f4f9', far:WH_D, head:'#f4f6fa', dark:GOLD, hand:GOLD, legs:'#f1f4f9', legsFar:WH_D},

    // LAYERED PLATE TORSO: white barrel, big chamfered BREASTPLATE with a gold border and the SUN EMBLEM built into it, overlapping lames over the belly, gold belt + buckle, heavy BACKPLATE (no cape, no wings).
    torso(cx, S, B, P, white){
      const W = 34, R = 17, L = B.torso.len, E = NOWE, t = NOWT;      // drawn 34 wide, then squeezed to the real body width so it stays inside the shared hitbox
      cx.save(); cx.translate(S.pel.x, S.pel.y); cx.rotate(S.lean); cx.scale(B.torso.w / 34, 1); cx.lineJoin = 'round';                           // local frame: x = forward, y = down, origin = pelvis (the spine runs to y = -L)
      const body = () => { cx.beginPath(); cx.arc(0, 0, R, 0, Math.PI); cx.lineTo(-R, -L); cx.arc(0, -L, R, Math.PI, 0); cx.closePath(); };
      body(); cx.fillStyle = OUT; cx.fill(); cx.lineWidth = 3.4; cx.strokeStyle = OUT; cx.stroke();
      body(); cx.fillStyle = WHITE; cx.fill();
      if(white){ cx.restore(); return; }
      cx.save(); body(); cx.clip();
      const g = cx.createLinearGradient(0, -L - R, 0, R); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.55, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(120,135,170,.5)');
      cx.fillStyle = g; cx.fillRect(-R, -L - R, W, W + L);
      // BACKPLATE: a thick plate down the back with a gold edge, spine ridge and ribs
      cx.fillStyle = WH_D; cx.fillRect(-R - 1, -L - R + 2, 12.5, L + R + 6);
      cx.fillStyle = OUT; cx.fillRect(-R + 10.6, -L - R + 2, 1.2, L + R + 6); cx.fillStyle = GOLD; cx.fillRect(-R + 8.8, -L - R + 2, 2, L + R + 6);
      cx.fillStyle = 'rgba(255,255,255,.75)'; cx.fillRect(-R + 3.6, -L - R + 4, 1.6, L + R);
      cx.fillStyle = GOLD; cx.fillRect(-R + 4.6, -L - R + 4, 1.4, L + R);                                           // gold spine ridge
      cx.fillStyle = OUT; for(let i = 0; i < 3; i++) cx.fillRect(-R, -L - R + 12 + i * 9, 8.8, 1);                    // ribs
      // belly lames (overlapping plates, upper plate on top)
      for(let i = 2; i >= 0; i--){
        const y0 = -2 + i * 6.4;
        cx.beginPath(); cx.moveTo(-R - 2, y0); cx.lineTo(R + 2, y0); cx.lineTo(R + 2, y0 + 7.5); cx.quadraticCurveTo(0, y0 + 10.6, -R - 2, y0 + 7.5); cx.closePath();
        cx.fillStyle = i % 2 ? WH_M : WHITE; cx.fill(); cx.lineWidth = 1.8; cx.strokeStyle = OUT; cx.stroke();
        cx.beginPath(); cx.moveTo(-R - 2, y0 + 6.2); cx.quadraticCurveTo(0, y0 + 9.2, R + 2, y0 + 6.2); cx.lineWidth = 1.5; cx.strokeStyle = GOLD; cx.stroke();
      }
      // BREASTPLATE
      const bp = () => { cx.beginPath(); cx.moveTo(-11, -23); cx.lineTo(-5, -26.5); cx.lineTo(6, -26.5); cx.lineTo(12, -22); cx.lineTo(14.5, -12); cx.lineTo(11, -1); cx.lineTo(-10, -1); cx.lineTo(-13, -12); cx.closePath(); };
      bp(); cx.fillStyle = OUT; cx.fill(); cx.lineWidth = 3; cx.strokeStyle = OUT; cx.stroke();
      bp(); cx.fillStyle = WHITE; cx.fill();
      cx.save(); bp(); cx.clip();
      const g2 = cx.createLinearGradient(-12, -26, 12, -1); g2.addColorStop(0, 'rgba(255,255,255,.9)'); g2.addColorStop(.55, 'rgba(255,255,255,0)'); g2.addColorStop(1, 'rgba(120,135,170,.4)');
      cx.fillStyle = g2; cx.fillRect(-16, -28, 34, 30);
      cx.restore();
      cx.save(); cx.translate(.7, -13.5); cx.scale(.86, .86); cx.translate(-.7, 13.5); bp(); cx.lineWidth = 2; cx.strokeStyle = GOLD; cx.stroke(); cx.restore();   // gold border
      cx.strokeStyle = OUT; cx.lineWidth = .9; cx.beginPath(); cx.moveTo(-2.2, -6); cx.lineTo(-2.2, -1.5); cx.moveTo(-2.2, -23); cx.lineTo(-2.2, -21); cx.stroke();
      cx.restore();
      sun(cx, 0, -15, 5.6, t, E, false);                                                                            // sun emblem, set into the breastplate
      // gold BELT + buckle
      cx.fillStyle = OUT; cx.fillRect(-R + .5, -3.6, W - 1, 7.2); cx.fillStyle = GOLD; cx.fillRect(-R + 1.3, -2.4, W - 2.6, 4.8); cx.fillStyle = HI; cx.fillRect(-R + 1.3, -2.4, W - 2.6, 1.1);
      cx.fillStyle = OUT; cx.beginPath(); cx.arc(-2, 0, 6, 0, 7); cx.fill(); cx.fillStyle = GOLD; cx.beginPath(); cx.arc(-2, 0, 4.8, 0, 7); cx.fill();
      cx.restore();
    },

    // BOOT + LEG ARMOR for each leg (called right after the leg is drawn, so the layering is right). While the far leg kicks, its real leg is hidden: the stretched kick leg draws it instead.
    foot(cx, leg, P, white, f, far){
      if(far && f.atk > 0 && f.A && f.A.step === 1 && clamp((Math.atan2(leg.knee.x - leg.hip.x, leg.knee.y - leg.hip.y) - .2) / .7, 0, 1) > .52) return;   // only once the kick leg is drawn (same threshold as drawKickLeg)
      legArmor(cx, leg.hip, leg.knee, leg.ankle, white, far);
      bootShape(cx, leg.ankle.x, leg.ankle.y, leg.planted ? 0 : clamp(-leg.sa * .5, -.8, .8), white, P);
    },

    // heavy stance. Idle: wide legs, shield held slightly forward. Run: leans behind the shield, shield angled forward, short heavy steps.
    pose(tg, f, t, run, K){
      const idle = 1 - run, b = Math.sin(t * 1.9);
      tg.aN = .5 + b * .025 + run * .38; tg.eN = 1.1 - run * .1;           // shield arm: always up and carrying
      tg.aF = tg.aF * run + (-.12 + b * .03) * idle;                       // free arm: small counterbalance when still, normal swing when running (its drawn arm is on the shield grip)
      tg.lean += idle * .02 + run * .1;
      tg.head += run * .06;
      if(idle > .5){ tg.tN = .24; tg.tF = -.2; legs(tg, 20.5 + b * .15); }  // wide, planted stance
      else { tg.tN *= .85; tg.tF *= .85; legs(tg, 20.2); }                 // shorter, heavier steps
    },

    farFront: f => f.atk > 0 && f.A && (f.A.skill === 'sacredcharge' || f.A.skill === 'aegis' || f.A.skill === 'heavensverdict' || f.A.step === 0 || f.A.step === 2),   // far hand grips the shield (not during the kick)
    spring(p, A){
      if(A.skill === 'sacredcharge') return {k:1300, d:48};
      if(A.skill === 'heavensverdict') return p < .5 ? {k:150, d:17} : {k:320, d:30};   // raise: soft, then hold
      if(A.skill === 'aegis'){ const e = p * A.time; return e < .5 ? {k:110, d:15} : e < .9 ? {k:650, d:38} : {k:120, d:17}; }   // lift soft, slam stiff, then settle slowly
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

    // HALO: a clean circular golden ring floating clear above the helmet. Gentle bob, calm glow at idle, brighter during abilities.
    behind(cx, f, t, S, P){
      NOWT = t; NOWE = energy(f, t);
      const E = NOWE, white = f.flash > 0, ux = Math.sin(S.lean), uy = -Math.cos(S.lean), R = 6.4;
      const hx = S.head.x + ux * 19.5 + 1 + Math.sin(t * 1.1) * .5, hy = S.head.y + uy * 19.5 + Math.sin(t * 1.8) * .9;
      const gl = cx.createRadialGradient(hx, hy, 1, hx, hy, 16); gl.addColorStop(0, 'rgba(255,225,120,' + (.2 + .32 * E) + ')'); gl.addColorStop(1, 'rgba(255,225,120,0)');
      cx.fillStyle = gl; cx.beginPath(); cx.arc(hx, hy, 16, 0, 7); cx.fill();
      cx.strokeStyle = OUT; cx.lineWidth = 4; cx.beginPath(); cx.arc(hx, hy, R, 0, 7); cx.stroke();                                   // thin dark edge
      const g = cx.createLinearGradient(hx - R, hy - R, hx + R, hy + R); g.addColorStop(0, HI); g.addColorStop(.45, '#ffd65a'); g.addColorStop(1, GOLD_D);
      cx.strokeStyle = white ? WHITE : g; cx.lineWidth = 2.2; cx.beginPath(); cx.arc(hx, hy, R, 0, 7); cx.stroke();                          // golden ring
      if(!white){
        const a0 = t * .9; cx.strokeStyle = 'rgba(255,255,255,.9)'; cx.lineWidth = 1.1; cx.lineCap = 'round'; cx.beginPath(); cx.arc(hx, hy, R, a0, a0 + .9); cx.stroke();   // a soft highlight slowly circles it
        if(E > .05){ cx.strokeStyle = 'rgba(255,240,170,' + E * .55 + ')'; cx.lineWidth = 1; cx.beginPath(); cx.arc(hx, hy, R + 3 + Math.sin(t * 6) * .8, 0, 7); cx.stroke(); }
      }
    },

    front(cx, f, t, S, P){
      const white = f.flash > 0, r = f.rig, hj = r ? r.j.head.a : 0, E = energy(f, t), W = SHIELD_W, H_ = SHIELD_H;
      // ---- SHIELD: hung from the near hand at a fixed grip point and swung around it (always attached). Only its rotation lags = weight. ----
      const st = f.A && f.A.step != null ? f.A.step : -1, swing = f.atk > 0 && st >= 0 && !!COMBO[st];
      const p = swing ? clamp(1 - f.atk / f.A.time, 0, 1) : 0, Cn = swing ? CS[st] : 0, big = swing && st === 2;
      const sd = f.shieldSp || (f.shieldSp = {a:0, v:0, last:t, fw:1}), dt = clamp(t - sd.last, 0, .05); sd.last = t;
      if(sd.fw == null) sd.fw = 1;
      const run = clamp(Math.abs(f.vx) / 170, 0, 1);
      const Hh = f.holy, glow = Hh && Hh.t > 0 ? (Hh.t > 1 ? 1 : (Math.sin(Hh.t * 36) > 0 ? 1 : .2)) : 0;   // Divine Impact glow (arena.js f.holy); flickers in the last second
      const fa = S.aN.hand.x - S.aN.el.x;                                      // how far forward the forearm points
      const chg = f.sc && f.atk > 0 && f.A && f.A.skill === 'sacredcharge', ce = chg ? f.A.time - f.atk : 0, cbr = chg && ce < (f.A.windup || .5);
      const castV = f.atk > 0 && f.A && f.A.skill === 'heavensverdict';
      const ag = f.aegis && f.atk > 0 && f.A && f.A.skill === 'aegis', ae = ag ? f.aegis.t : 0, planted = ag && f.aegis.on, asu = ag ? (f.A.setup || 3) : 0;
      const tgt = castV ? 0 : ag ? (ae < .5 ? .15 : 0) : chg ? -.05 : swing ? Body.keys(p, COMBO[st].rot)
                        : clamp(S.lean * .5 + run * .16 + (S.aN.hand.y - S.aN.el.y) * .01 - fa * .004, -.3, .3);   // idle: angled forward when running / leaning
      const k = swing ? 50 : 90 / SHIELD_LAG, d = swing ? 8.5 : 11 + SHIELD_LAG * 1.5;
      for(let i = 0; i < 2 && dt > 0; i++){ sd.v += (k * (tgt - sd.a) - d * sd.v) * dt / 2; sd.a += sd.v * dt / 2; }
      const kb = st === 1 && swing ? Body.keys(p, [[0,0],[.15,1],[.85,1],[1,0]]) : 0;   // kick: shield trails behind him, away from the leg
      const ov = r ? clamp((r.j.aN.a - 1.5) / 1.0, 0, 1) : 0;                  // arms raised above the shoulders: he grips the LOWER part of the handle zone, so the shield rides above his hands
      const ca = Math.cos(sd.a), sa = Math.sin(sd.a);
      const GX = lerp(-12, W / 2 - 7, kb), GY = lerp(-H_ * .1, H_ * .3, ov);   // where the near hand holds the shield (shield space)
      const hx = S.aN.hand.x + run * 1.5, hy = S.aN.hand.y;                   // the near hand: the grip
      const vib = chg ? Math.sin(ce * 55) * (cbr ? 1 + 2 * (ce / (f.A.windup || .5)) : 1.4) : 0;           // the shield shakes while bracing and charging
      const sx = hx - (GX * ca - GY * sa) + vib, sy = hy - (GX * sa + GY * ca) - 2 * kb + vib * .6;
      let sx2 = sx, sy2 = sy;
      if(ag){ const k2 = clamp((ae - .52) / .12, 0, 1), ek = k2 * k2 * (3 - 2 * k2), py = -H_ * .56 + 3; sy2 = sy + (py - sy) * ek; sx2 = sx + 2 * ek; }   // the shield comes down and its tip goes into the ground (the ground line clips it)
      const flash = planted ? clamp(1 - (t - f.aegis.hitT) / .2, 0, 1) : 0, gl = Math.max(glow, flash, castV ? 1 : 0);   // a blocked blow flashes the shield
      // grip points in shield space: the near hand stays on the skeleton hand (so the handle slides under it while the shield is planted), the far hand holds the same handle a little behind it
      const rx = hx - sx2, ry = hy - sy2, gN = {x:rx * ca + ry * sa, y:-rx * sa + ry * ca}, gF = {x:gN.x - 6, y:gN.y + 1.5};
      const G2 = {x:sx2 + gF.x * ca - gF.y * sa, y:sy2 + gF.x * sa + gF.y * ca};
      const useGrip = !(st === 1 && swing) && !(f.stun > 0) ? 1 : 0;           // far hand on the grip, except while kicking (free arm) or hurt (flailing)
      sd.fw += (useGrip - sd.fw) * (dt > 0 ? Math.min(1, dt * 12) : 0);
      const farHand = {x:lerp(S.aF.hand.x, G2.x, sd.fw), y:lerp(S.aF.hand.y, G2.y, sd.fw)};
      const iN = ik(S.aN.s, {x:hx, y:hy}, 9, 9), iF = ik(S.aF.s, farHand, 9, 9);
      const shield = () => {                                                   // clipped at the ground line, so a stomped shield looks planted INTO the floor
        cx.save(); cx.beginPath(); cx.rect(-400, -600, 800, 603); cx.clip();
        let sb = 0; if(big && p > .36 && p < Cn) sb = 8 + 10 * Math.sin((p - .36) * 20) ** 2;   // holy glow while it is raised
        if(gl > 0) sb = Math.max(sb, 10 + 8 * gl * (.5 + .5 * Math.sin(t * 8)));
        if(planted) sb = Math.max(sb, 7);                                                          // planted: steady soft glow
        if(sb > 0){ cx.shadowColor = '#ffd45a'; cx.shadowBlur = sb; }
        drawShield(cx, sx2, sy2, sd.a, white, t, gl, E, gN.x, gN.y);
        if(glow > 0){ cx.shadowBlur = 0; for(let i = 0; i < 4; i++){ const a = t * 3 + i * 1.57, rr = 34 + 3 * Math.sin(t * 5 + i); cx.fillStyle = 'rgba(255,240,170,' + (.85 * glow) + ')'; cx.beginPath(); cx.arc(sx2 + Math.cos(a) * rr * .8, sy2 + Math.sin(a) * rr, 1.8, 0, 7); cx.fill(); } }   // little holy motes circling it
        cx.restore();
      };
      // ---- layering: shield -> far arm -> far pauldron -> near arm -> near pauldron -> helmet (always readable above the shield) -> kick leg ----
      shield();
      armor(cx, S.aF.s, iF.el, iF.hand, true, white, E);
      pauldron(cx, S.aF.s.x - 6.5, S.aF.s.y - 6, S.lean * .6 - .3, .7, true, white, E);
      armor(cx, S.aN.s, iN.el, iN.hand, false, white, E);
      pauldron(cx, S.aN.s.x - 2, S.aN.s.y - 5, S.lean * .6 - .2, .76, false, white, E);
      helmet(cx, S, hj, white, t, E);
      const KL = kickLeg(S), kicking = f.atk > 0 && f.A && f.A.step === 1;
      if(kicking) drawKickLeg(cx, KL, white, P);                               // on top of torso + shield, so the kick is always readable
      const top = sy2 - H_ * .44;                                              // top edge of the shield

      // ---- HEAVEN'S VERDICT cast: a beam of light shoots up from the raised shield ----
      if(castV && (f.A.time - f.atk) / f.A.time > .3){
        const k3 = clamp(((f.A.time - f.atk) / f.A.time - .3) / .3, 0, 1), fl = .75 + .25 * Math.sin(t * 40), gr = cx.createLinearGradient(0, top, 0, -460);
        gr.addColorStop(0, 'rgba(255,230,140,' + .6 * k3 * fl + ')'); gr.addColorStop(1, 'rgba(255,230,140,0)');
        cx.save(); cx.fillStyle = gr; cx.fillRect(sx2 - 12 * k3, -460, 24 * k3, 460 + top); cx.restore();
      }
      // ---- AEGIS STANCE effects: dust ring when the shield hits the ground, a gold pulse when it becomes fully planted ----
      if(ag){
        cx.save(); cx.lineCap = 'round';
        if(ae > .58 && ae < 1.1){ const kk = (ae - .58) / .52, a = 1 - kk, gx = sx2 + 2; cx.strokeStyle = 'rgba(225,215,185,' + a * .8 + ')'; cx.lineWidth = 2.4 * a + .5; cx.beginPath(); cx.ellipse(gx, -1, 12 + kk * 44, 2 + kk * 6, 0, 0, 7); cx.stroke(); cx.fillStyle = 'rgba(225,215,185,' + a * .6 + ')'; for(let i = 0; i < 6; i++){ cx.beginPath(); cx.arc(gx + (i - 2.5) * (6 + kk * 11), -2 - kk * (4 + (i % 3) * 4), 2 + kk * 2, 0, 7); cx.fill(); } }
        if(planted && ae - asu < .45){ const kk = (ae - asu) / .45; cx.strokeStyle = 'rgba(255,214,90,' + (1 - kk) + ')'; cx.lineWidth = 3 * (1 - kk) + .6; cx.beginPath(); cx.ellipse(sx2 + 2, sy2 - 6, 22 + kk * 30, 34 + kk * 26, 0, 0, 7); cx.stroke(); }
        cx.restore();
      }
      // ---- SACRED CHARGE effects: gold charge-up ring while bracing, speed lines behind him + sparks off the shield face while charging / pushing ----
      if(chg){
        cx.save(); cx.lineCap = 'round';
        if(cbr){ const k4 = ce / (f.A.windup || .5); cx.strokeStyle = 'rgba(255,214,90,' + (.7 * (1 - k4) + .15) + ')'; cx.lineWidth = 2; cx.beginPath(); cx.ellipse(sx + 4, sy, 44 * (1 - k4) + 16, 52 * (1 - k4) + 18, 0, 0, 7); cx.stroke(); }
        else{
          for(let i = 0; i < 5; i++){ const yy = -8 - i * 9, ln = 22 + ((t * 9 + i * 3.7) % 1) * 26, x0 = -26 - ((t * 7 + i * 1.9) % 1) * 18; cx.strokeStyle = 'rgba(255,240,190,' + (.5 - i * .06) + ')'; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(x0, yy); cx.lineTo(x0 - ln, yy); cx.stroke(); }
          if(f.sc.target){ cx.fillStyle = 'rgba(255,236,150,.9)'; for(let i = 0; i < 4; i++){ const a = t * 31 + i * 1.7; cx.beginPath(); cx.arc(sx + 28 + Math.cos(a) * 5, sy + Math.sin(a * 1.3) * 22, 1.8, 0, 7); cx.fill(); } }
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
          const kk = clamp((p - Cn) / (len + .1), 0, 1), a = 1 - kk, sc = big ? 1.8 : 1, gx = sx + 10;
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