// ZERATHIS art - tall regal ice king. Same shared ragdoll (body.js): only sizes, colors, a calm pose and ice props.
// Look: ice crown, crystal shoulder pauldrons, frost cape behind, a short robe front, glowing ice-blue eye, cold mist at his feet.
// HOLD ATK = ICE PROJECTILE (skills.js hold, same manual-aim engine as Caliber's sniper): he plants himself, the near arm points along f.snipe.ang, a big ice shard grows at the palm and a dotted guide shows
//   the flight line (bright pulsing ring = READY, let go to throw). Skills: WINTER'S GRASP (near hand slams down), CRYSTAL COFFIN (both hands close), ETERNAL ICE AGE (3 s arms-up cast, slam at the end).
// Hooks used: body (sizes), colors, farFront, spring(), attack() = the 3 casts + skill / hold poses, pose() = calm royal stance,
//             behind() = frost cape + mist, front() = crown, eye, pauldrons, robe, cast frost, shard + aim guide, handW, shot() = how the flying ice looks (drawn by arena.js).
(() => {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const C = [.5, .5, .56];                        // moment the ice leaves the hand = shot.p in skills.js (keep the same)
  const T = 11, SH = 10.5;                        // thigh + shin length (must match body below)
  const OUT = '#0b1424';

  // knee angle that puts the ankle at height Y for thigh angle th, so BOTH feet stay on the same ground height (no floating foot)
  const legK = (th, Y) => { const a = Math.acos(clamp((Y - T * Math.cos(th)) / SH, -1, 1)); const k = th - a; return k > .05 ? k : th + a; };

  // ---- BASIC ATTACK: 3 casts. Each = slow COIL (hand draws back, frost gathers) then fast RELEASE (palm thrusts, ice leaves). p = 0..1 over the swing. ----
  //   1 near hand shard - C = .50    2 far hand shard - C = .50    3 BOTH hands: arms spread wide, then slam together = frost wave - C = .56
  const STEP = [
    { // 1 NEAR hand
      aN:[[0,.35],[.2,.05],[.4,-.05],[.5,1.5],[.62,1.55],[.82,1.0],[1,.35]], eN:[[0,.7],[.2,1.3],[.4,1.3],[.5,.1],[.62,.08],[.82,.5],[1,.7]],
      aF:[[0,.1],[.3,-.1],[.5,.2],[1,.1]], eF:[[0,.8],[.5,1.0],[1,.8]],
      lean:[[0,.05],[.2,-.06],[.4,-.08],[.5,.18],[.62,.2],[.82,.12],[1,.05]], head:[[0,0],[.5,.06],[.7,-.1],[1,0]],
      tN:[[0,.26],[.3,.15],[.5,.38],[.82,.32],[1,.26]], tF:[[0,-.2],[.3,-.3],[.5,-.42],[.82,-.32],[1,-.2]], Y:[[0,21],[.3,20.3],[.5,20.7],[1,21]]
    },
    { // 2 FAR hand (higher wind-up behind the head, thrown down-forward)
      aF:[[0,.1],[.2,1.5],[.4,1.7],[.5,1.45],[.62,1.5],[.82,.8],[1,.1]], eF:[[0,.8],[.2,1.2],[.4,1.2],[.5,.15],[.62,.1],[.82,.5],[1,.8]],
      aN:[[0,.35],[.3,.1],[.5,.15],[1,.35]], eN:[[0,.7],[.5,.8],[1,.7]],
      lean:[[0,.05],[.2,-.06],[.4,-.08],[.5,.2],[.62,.24],[.82,.14],[1,.05]], head:[[0,0],[.5,.06],[.7,-.1],[1,0]],
      tN:[[0,.26],[.3,.32],[.5,.2],[.82,.22],[1,.26]], tF:[[0,-.2],[.3,-.3],[.5,-.5],[.82,-.32],[1,-.2]], Y:[[0,21],[.3,20.3],[.5,20.7],[1,21]]
    },
    { // 3 BOTH hands: spread wide behind, crouch, then both slam forward together
      aN:[[0,.35],[.15,-.2],[.35,-.9],[.48,-.9],[.56,1.5],[.68,1.55],[.85,1.0],[1,.35]], eN:[[0,.7],[.35,.9],[.48,.9],[.56,.15],[.68,.1],[1,.7]],
      aF:[[0,.1],[.15,-.3],[.35,-1.0],[.48,-1.0],[.56,1.45],[.68,1.5],[.85,1.0],[1,.1]], eF:[[0,.8],[.35,.9],[.48,.9],[.56,.15],[.68,.1],[1,.8]],
      lean:[[0,.05],[.15,.08],[.35,-.25],[.48,-.27],[.56,.24],[.68,.28],[.85,.15],[1,.05]], head:[[0,0],[.35,.25],[.56,.15],[.75,-.25],[1,0]],
      tN:[[0,.26],[.35,.35],[.56,.55],[.85,.4],[1,.26]], tF:[[0,-.2],[.35,-.5],[.56,-.6],[.85,-.4],[1,-.2]], Y:[[0,21],[.35,18.5],[.48,18.5],[.56,20.5],[1,21]]
    }
  ];
  // ---- SKILL CASTS. p = 0..1 over the cast. The ice itself (zones, spikes) is drawn by arena.js; here only his body and the frost on his hands. ----
  const ease = t => t * t * (3 - 2 * t);
  const GRASP = {   // WINTER'S GRASP (time .5): far hand lifts, near hand raised overhead then SLAMS down toward the ground ahead at p .5
    aN:[[0,.35],[.3,2.45],[.5,.55],[.8,.6],[1,.35]], eN:[[0,.7],[.3,.35],[.5,.1],[1,.7]],
    aF:[[0,.1],[.3,1.5],[.6,1.1],[1,.1]], eF:[[0,.8],[.3,1.1],[1,.8]],
    lean:[[0,.05],[.3,-.12],[.5,.34],[.8,.2],[1,.05]], head:[[0,0],[.3,-.1],[.5,.18],[1,0]],
    tN:[[0,.26],[.3,.2],[.5,.55],[.85,.4],[1,.26]], tF:[[0,-.2],[.3,-.3],[.5,-.55],[.85,-.35],[1,-.2]], Y:[[0,21],[.3,20.3],[.5,18.4],[1,21]]
  };
  const COFFIN = {  // CRYSTAL COFFIN (time .45): both hands reach up and out, then close like a clenched fist at p .55
    aN:[[0,.35],[.3,2.2],[.55,1.4],[.75,1.35],[1,.35]], eN:[[0,.7],[.3,.5],[.55,1.8],[.75,1.7],[1,.7]],
    aF:[[0,.1],[.3,2.3],[.55,1.25],[.75,1.2],[1,.1]], eF:[[0,.8],[.3,.5],[.55,1.9],[.75,1.8],[1,.8]],
    lean:[[0,.05],[.3,-.14],[.55,.22],[1,.05]], head:[[0,0],[.3,-.12],[.55,.1],[1,0]],
    tN:[[0,.26],[.3,.3],[.55,.5],[1,.26]], tF:[[0,-.2],[.3,-.3],[.55,-.5],[1,-.2]], Y:[[0,21],[.3,20],[.55,18.6],[1,21]]
  };
  const AGE = {     // ETERNAL ICE AGE (time 3): arms up and out, leaning back while the cold gathers; the last 4% = both arms slam down and the whole arena freezes
    aN:[[0,.35],[.1,2.6],[.9,2.75],[.96,.9],[1,.35]], eN:[[0,.7],[.1,.3],[.9,.25],[.96,.2],[1,.7]],
    aF:[[0,.1],[.1,2.7],[.9,2.85],[.96,.8],[1,.1]], eF:[[0,.8],[.1,.3],[.9,.25],[.96,.2],[1,.8]],
    lean:[[0,.05],[.1,-.28],[.9,-.32],[.96,.3],[1,.05]], head:[[0,0],[.1,-.32],[.9,-.34],[.96,.2],[1,0]],
    tN:[[0,.26],[.1,.3],[.9,.32],[.96,.5],[1,.26]], tF:[[0,-.2],[.1,-.34],[.9,-.36],[.96,-.5],[1,-.2]], Y:[[0,21],[.1,19.6],[.9,19.4],[.96,19],[1,21]]
  };
  // ---- ICE PROJECTILE hold pose. S = f.snipe (arena.js sniperStep): S.kn = 0..1 raise progress, S.ang = aim elevation (+ = up), S.ph = 'aim' | 'recover' (S.rt 0..1 after the throw). ----
  function aimPose(tg, S){
    const k = ease(S.kn), th = S.ang, rec = S.ph === 'recover' ? S.rt : 0, thrust = rec > 0 ? Math.sin(Math.min(1, rec / .5) * Math.PI) : 0;   // thrust = the arm whips through after release
    const aim = {aN:1.5708 + th - .05 - thrust * .35, eN:.12 + thrust * .25, aF:1.25 + th * .25, eF:1.25, lean:.04 + .06 * k + thrust * .22 - th * .05, head:-.04 - th * .22,
                 tN:.3, tF:-.28};
    const Y = Math.min(19.4, .97 * (T + SH) * Math.min(Math.cos(aim.tN), Math.cos(aim.tF)));
    aim.kN = legK(aim.tN, Y); aim.kF = legK(aim.tF, Y);
    for(const j in aim) tg[j] = tg[j] + (aim[j] - tg[j]) * k;
  }

  // small drawing helpers (local space: origin = feet, x = forward, y = down)
  function poly(cx, pts, fill, stroke, lw){
    cx.beginPath(); pts.forEach((q, i) => i ? cx.lineTo(q[0], q[1]) : cx.moveTo(q[0], q[1])); cx.closePath();
    if(fill){ cx.fillStyle = fill; cx.fill(); } if(stroke){ cx.strokeStyle = stroke; cx.lineWidth = lw || 1; cx.lineJoin = 'round'; cx.stroke(); }
  }
  function crystal(cx, x, y, len, w, ang, fill){   // one ice spike: base at (x, y), points along ang
    const c = Math.cos(ang), s = Math.sin(ang), px = -s, py = c;
    poly(cx, [[x + px * w, y + py * w], [x + c * len, y + s * len], [x - px * w, y - py * w], [x - c * w * .5, y - s * w * .5]], fill, '#e8f8ff', .9);
  }

  Characters.art('zerathis', {
    // tall (about +12%), slim, long limbs. Hitbox is still 30x52 (arena.js is not changed per character).
    body: {head:{r:5.8}, torso:{len:14, w:10}, uArm:{len:10.5, w:4.2}, fArm:{len:10.5, w:3.8}, hand:{r:3},
           thigh:{len:11, w:5.4}, shin:{len:10.5, w:4.6}, foot:{len:7.5, w:3.4}},
    colors: {shirt:'#3a6ea5', limb:'#4d8fd0', far:'#2b5082', legs:'#2a4a78', legsFar:'#1d3558', head:'#cfe9f5', dark:'#122238', hand:'#bfeaff'},

    // the far arm is drawn on top of the body for cast 2, cast 3, every skill and the hold
    farFront: f => !!f.snipe || (f.atk > 0 && f.A && (!!f.A.skill || (f.A.step || 0) >= 1)),

    // slow and soft while he gathers (dignified), very stiff at the release (snap), medium after
    spring(p, A){
      if(A.skill === 'sniper') return A.snipe && A.snipe.ph === 'recover' ? {k:430, d:32} : {k:240, d:26};   // steady while aiming, stiff snap at the throw
      if(A.skill === 'iceage') return p > .93 ? {k:470, d:36} : {k:150, d:22};                               // slow majestic raise, hard slam at the end
      if(A.skill === 'wintergrasp' || A.skill === 'crystalcoffin') return p > .35 && p < .7 ? {k:460, d:38} : {k:260, d:28};
      const c = C[A.step || 0];
      if(p < c - .1) return {k:130, d:22};
      if(p < c + .1) return {k:440, d:40};
      return {k:150, d:24};
    },

    attack(tg, p, A, K){
      if(A.skill === 'sniper' && A.snipe){ aimPose(tg, A.snipe); return; }                                  // HOLD ATK: Ice Projectile
      const s = A.skill === 'wintergrasp' ? GRASP : A.skill === 'crystalcoffin' ? COFFIN : A.skill === 'iceage' ? AGE : STEP[A.step || 0];
      ['aN', 'eN', 'aF', 'eF', 'lean', 'head', 'tN', 'tF'].forEach(j => tg[j] = K(p, s[j]));
      const Y = Math.min(K(p, s.Y), .97 * (T + SH) * Math.min(Math.cos(tg.tN), Math.cos(tg.tF)));
      tg.kN = legK(tg.tN, Y); tg.kF = legK(tg.tF, Y);
    },

    // royal stance: chest up, head high, arms hang a little out with open hands, slow breathing. Longer strides when he walks.
    pose(tg, f, t, run, K){
      const b = Math.sin(t * 1.6), idle = 1 - run;
      tg.lean += idle * (b * .02 - .02) + run * .03;
      tg.head += idle * Math.sin(t * 1.6 - .8) * .03 - .04;
      tg.aN += idle * (.1 + b * .04);  tg.aF += idle * (.1 - b * .04);
      tg.eN += idle * .1;              tg.eF += idle * .15;
      tg.tN *= 1 + run * .1;           tg.tF *= 1 + run * .1;
    },

    // behind the body: long frost cape that streams back with his speed + cold mist at his feet
    behind(cx, f, t, S, P){
      const drag = clamp(-(f.vx * f.face) * .05, -3, 14), sw = Math.sin(t * 2.2) * 1.2;
      const x0 = S.sh.x - 2, y0 = S.sh.y - 1, yb = -3 + (f.gr ? 0 : -6);
      const g = cx.createLinearGradient(x0, y0, x0 - 12 - drag, yb);
      g.addColorStop(0, '#3f7fc8'); g.addColorStop(1, 'rgba(120,200,255,.55)');
      cx.beginPath(); cx.moveTo(x0, y0);
      cx.quadraticCurveTo(x0 - 8 - drag * .5, (y0 + yb) / 2, x0 - 11 - drag + sw, yb);                       // outer edge
      for(let i = 0; i < 4; i++){ const k = (i + 1) / 4; cx.lineTo(x0 - 11 - drag + sw + 3.6 * k * 2 - (i % 2 ? 2.2 : 0), yb + (i % 2 ? -4 : 0)); }   // icy jagged hem
      cx.lineTo(x0 - 1 + sw * .2, yb - 2); cx.quadraticCurveTo(x0 + 2, (y0 + yb) / 2, x0 + 2, y0 + 3); cx.closePath();
      cx.fillStyle = g; cx.fill(); cx.strokeStyle = '#a8e0ff'; cx.lineWidth = 1; cx.lineJoin = 'round'; cx.stroke();
      if(f.gr){                                                                                               // mist around the feet
        for(let i = 0; i < 4; i++){ const ph = t * .9 + i * 1.7, a = .16 - i * .02;
          cx.fillStyle = 'rgba(200,235,255,' + a + ')'; cx.beginPath(); cx.ellipse(-8 + i * 6 + Math.sin(ph) * 3, -1.5 + Math.cos(ph) * .8, 8, 2.4, 0, 0, 7); cx.fill(); }
      }
    },

    front(cx, f, t, S, P){
      // tell arena.js where the hands are in the world, so the ice leaves the real hand
      f.handW = {N:{x:f.x + f.face * S.aN.hand.x, y:f.y + S.aN.hand.y}, F:{x:f.x + f.face * S.aF.hand.x, y:f.y + S.aF.hand.y}};
      f.handW.S = f.handW.N;                                              // the Ice Projectile leaves the near hand
      const white = f.flash > 0;

      // robe: a short front panel hanging from the belt, frost hem
      if(!white){
        const px = S.pel.x, py = S.pel.y, sway = Math.sin(t * 2) * .6 - f.vx * f.face * .004;
        const g = cx.createLinearGradient(px, py, px, py + 15);
        g.addColorStop(0, '#2e5a99'); g.addColorStop(1, '#6fb6ee');
        poly(cx, [[px - 4.5, py], [px + 5, py], [px + 6 + sway, py + 14], [px + 2 + sway, py + 12], [px - 1 + sway, py + 15], [px - 4 + sway, py + 12], [px - 5.5 + sway, py + 14]], g, OUT, 1.1);
        cx.fillStyle = '#e8f8ff'; cx.beginPath(); cx.arc(px, py + 1, 1.7, 0, 7); cx.fill();                  // belt gem
      }
      // crystal pauldrons on both shoulders
      if(!white) [S.aF, S.aN].forEach((A, i) => {
        const x = A.s.x, y = A.s.y;
        crystal(cx, x, y - 1, 8.5 - i, 2.4, -1.35, i ? '#c9ecff' : '#8cc8f2');
        crystal(cx, x + 1, y - 1, 6.5, 2, -.75, i ? '#e4f6ff' : '#a8dcfa');
        crystal(cx, x - 1, y - 1, 6, 2, -2.1, i ? '#b0e2ff' : '#7fb8e8');
      });

      // head: ice crown + glowing eye (drawn in the head's own tilted space)
      const h = S.head, ang = Math.atan2(h.x - S.sh.x, -(h.y - S.sh.y));
      const A = f.A || {}, SN = f.snipe;
      const p = f.atk > 0 ? clamp(1 - f.atk / A.time, 0, 1) : 0;
      const hold = !!SN && SN.ph === 'aim', SK = A.skill;
      const aura = SK === 'iceage' ? clamp(p / .9, 0, 1) : hold ? (SN.ready ? 1 : .4) : 0;   // the eye + crown glow stronger while a big spell builds
      cx.save(); cx.translate(h.x, h.y); cx.rotate(ang);
      if(!white){
        [[-4.6, -5.4, 4.5, -.18], [-2.3, -5.8, 7.5, -.06], [0, -6, 9.5, 0], [2.3, -5.8, 7.5, .06], [4.6, -5.4, 4.5, .18]].forEach(([x, y, len, a], i) =>
          crystal(cx, x, y, len, 1.7, -Math.PI / 2 + a, i === 2 ? '#ffffff' : '#bfe8ff'));
        cx.fillStyle = '#7fd0ff'; cx.fillRect(-5.4, -6.2, 10.8, 1.5);                                          // crown band
        cx.shadowColor = '#9fe4ff'; cx.shadowBlur = 6 + 12 * aura;
        cx.fillStyle = '#e8fbff'; cx.beginPath(); cx.ellipse(3.8, -1.2, 2.3, 1.4, 0, 0, 7); cx.fill();
        cx.shadowBlur = 0; cx.fillStyle = '#35b6ff'; cx.beginPath(); cx.arc(4.3, -1.2, .8, 0, 7); cx.fill();
      }
      cx.restore();

      // ---- casting frost, the held shard + aim guide, the Ice Age gathering ----
      if(hold){
        // ICE PROJECTILE: a big shard grows in the near palm and points along the aim. Dotted guide = the flight line. READY = pulsing ring + bright guide.
        const hd = S.aN.hand, th = SN.ang, dx = Math.cos(th), dy = -Math.sin(th), k = clamp(SN.kn, 0, 1), rdy = SN.ready, pu = .5 + .5 * Math.sin(t * 16);
        const len = 10 + 26 * k, w = 2.4 + 3.2 * k, cxm = hd.x + dx * (len * .55 + 3), cym = hd.y + dy * (len * .55 + 3);
        cx.save(); cx.strokeStyle = 'rgba(190,240,255,' + (rdy ? .35 + .4 * pu : .22) + ')'; cx.lineWidth = rdy ? 1.6 : 1; cx.setLineDash([3, 6]);
        cx.beginPath(); cx.moveTo(hd.x + dx * (len + 8), hd.y + dy * (len + 8)); cx.lineTo(hd.x + dx * 230, hd.y + dy * 230); cx.stroke(); cx.setLineDash([]); cx.restore();
        for(let i = 0; i < 7; i++){ const kk = (t * 1.7 + i / 7) % 1, a = t * 6 + i * .9, rr = 6 + (1 - kk) * 18; cx.fillStyle = 'rgba(210,240,255,' + (.15 + .6 * kk) * k + ')'; cx.beginPath(); cx.arc(cxm + Math.cos(a) * rr, cym + Math.sin(a) * rr * .7, 1 + kk, 0, 7); cx.fill(); }
        cx.save(); cx.translate(cxm, cym); cx.rotate(Math.atan2(dy, dx));
        cx.shadowColor = '#9fe4ff'; cx.shadowBlur = 8 + 10 * k;
        poly(cx, [[-len * .55, 0], [-len * .2, -w], [len * .55, 0], [-len * .2, w]], 'rgba(205,240,255,.96)', '#ffffff', 1.1);
        cx.shadowBlur = 0; poly(cx, [[-len * .45, 0], [-len * .1, -w * .4], [len * .35, 0]], 'rgba(255,255,255,.85)');
        crystal(cx, -len * .2, 0, len * .4, w * .35, -.75, 'rgba(190,232,255,.9)'); crystal(cx, -len * .2, 0, len * .4, w * .35, .75, 'rgba(190,232,255,.9)');
        cx.restore();
        if(rdy){ cx.strokeStyle = 'rgba(220,245,255,' + (.4 + .4 * pu) + ')'; cx.lineWidth = 1.3; cx.beginPath(); cx.ellipse(cxm, cym, len * .62 + 3 + pu * 2, w + 6, Math.atan2(dy, dx), 0, 7); cx.stroke(); }
      } else if(SN && SN.ph === 'recover' && SN.rt < .3){                                                   // just thrown: a burst of flakes at the palm
        const hd = S.aN.hand, k = SN.rt / .3;
        cx.strokeStyle = 'rgba(220,245,255,' + (1 - k) + ')'; cx.lineWidth = 2 * (1 - k) + .5; cx.beginPath(); cx.arc(hd.x + 6, hd.y, 5 + k * 22, 0, 7); cx.stroke();
      } else if(f.atk > 0 && A.time){
        if(SK === 'iceage'){
          // ETERNAL ICE AGE cast: frost spirals into the space above both hands, a glow and a ring grow with the cast; at the slam (p .96) a flash
          const k = clamp(p / .94, 0, 1), mx = (S.aN.hand.x + S.aF.hand.x) / 2, my = (S.aN.hand.y + S.aF.hand.y) / 2 - 4;
          const gl = cx.createRadialGradient(mx, my, 2, mx, my, 14 + 50 * k); gl.addColorStop(0, 'rgba(230,250,255,' + (.35 + .45 * k) + ')'); gl.addColorStop(1, 'rgba(140,220,255,0)');
          cx.fillStyle = gl; cx.beginPath(); cx.arc(mx, my, 14 + 50 * k, 0, 7); cx.fill();
          for(let i = 0; i < 14; i++){ const kk = (t * 1.3 + i / 14) % 1, a = t * 4 + i * .9, rr = 10 + (1 - kk) * (24 + 44 * k); cx.fillStyle = 'rgba(220,245,255,' + (.2 + .6 * kk) + ')'; cx.beginPath(); cx.arc(mx + Math.cos(a) * rr, my + Math.sin(a) * rr * .6, 1 + kk * 1.4, 0, 7); cx.fill(); }
          cx.strokeStyle = 'rgba(200,240,255,' + (.25 + .4 * k) + ')'; cx.lineWidth = 1.5; cx.beginPath(); cx.ellipse(mx, my, 20 + 34 * k, 6 + 10 * k, 0, 0, 7); cx.stroke();
          if(p > .94){ const q = (p - .94) / .06; cx.fillStyle = 'rgba(240,252,255,' + (.6 * (1 - q)) + ')'; cx.beginPath(); cx.arc(f.face * 0, -26, 30 + q * 70, 0, 7); cx.fill(); }
        } else {
          const st = A.step || 0, both = SK === 'crystalcoffin' || (!SK && st === 2);
          const hs = SK === 'wintergrasp' ? [S.aN.hand] : both ? [S.aN.hand, S.aF.hand] : st === 1 ? [S.aF.hand] : [S.aN.hand];
          const c = SK === 'wintergrasp' || SK === 'crystalcoffin' ? .55 : C[st], big = both;
          if(p < c){                                                  // COIL: frost crystals form and spin around each hand
            const k = clamp(p / c, 0, 1);
            hs.forEach(hd => {
              for(let i = 0; i < 6; i++){
                const a = t * 7 + i * 1.05, r = (1 - k) * (big ? 18 : 13) + 3;
                cx.fillStyle = 'rgba(210,240,255,' + (.25 + .6 * k) + ')'; cx.beginPath(); cx.arc(hd.x + Math.cos(a) * r, hd.y + Math.sin(a) * r * .7, 1 + k * .8, 0, 7); cx.fill();
              }
              cx.shadowColor = '#9fe4ff'; cx.shadowBlur = 8;
              for(let i = 0; i < 3; i++) crystal(cx, hd.x, hd.y, (3 + k * (big ? 7 : 5)), 1.2, -1.2 + i * 1.2 + t * 2, 'rgba(205,240,255,.95)');
              cx.shadowBlur = 0;
            });
          } else if(p < c + .14){                                     // RELEASE: a quick burst of ice flakes where it left
            const k = (p - c) / .14, hd = hs.length > 1 ? {x:(hs[0].x + hs[1].x) / 2, y:(hs[0].y + hs[1].y) / 2} : hs[0];
            cx.strokeStyle = 'rgba(220,245,255,' + (1 - k) + ')'; cx.lineWidth = 2 * (1 - k) + .5;
            cx.beginPath(); cx.arc(hd.x + 4, hd.y, 4 + k * (big ? 20 : 11), 0, 7); cx.stroke();
            for(let i = 0; i < 6; i++){ const a = i * 1.05 + .3; cx.fillStyle = 'rgba(230,248,255,' + (1 - k) + ')'; cx.fillRect(hd.x + 4 + Math.cos(a) * (6 + k * 18), hd.y + Math.sin(a) * (6 + k * 18), 2, 2); }
          }
        }
      }
    },

    // the flying ice (arena.js calls this; s = {x, y, r, vx, age, kind, cl}). kind 0/1 = shard, 2 = frost wave, 'sniper' = the big Ice Projectile.
    shot(cx, s, t){
      const d = s.vx > 0 ? 1 : -1, x = s.x, y = s.y;
      cx.save(); cx.translate(x, y); cx.scale(d, 1); cx.translate(-x, -y);   // draw everything as if flying right
      if(s.kind === 'sniper'){                                               // ICE PROJECTILE: a big faceted shard, rotated along its real flight line, with a cold trail + sparkles
        const a = Math.atan2(s.vy || 0, Math.abs(s.vx)), L = 30 + s.r * 1.6, w = 4 + s.r * .7;
        cx.translate(x, y); cx.rotate(a); cx.translate(-x, -y);
        const g = cx.createLinearGradient(x, y, x - 150, y);
        g.addColorStop(0, 'rgba(150,225,255,.6)'); g.addColorStop(1, 'rgba(150,225,255,0)');
        cx.fillStyle = g; cx.beginPath(); cx.moveTo(x, y - w * 1.3); cx.lineTo(x - 150, y); cx.lineTo(x, y + w * 1.3); cx.closePath(); cx.fill();
        cx.shadowColor = '#9fe4ff'; cx.shadowBlur = 16;
        crystal(cx, x - L * .3, y, L * .55, w * .45, -.55, 'rgba(190,232,255,.95)'); crystal(cx, x - L * .3, y, L * .55, w * .45, .55, 'rgba(190,232,255,.95)');
        poly(cx, [[x - L * .6, y], [x - L * .3, y - w], [x + L * .6, y], [x - L * .3, y + w]], 'rgba(212,244,255,.98)', '#ffffff', 1.3);
        cx.shadowBlur = 0;
        poly(cx, [[x - L * .5, y], [x - L * .2, y - w * .4], [x + L * .4, y]], 'rgba(255,255,255,.92)');
        for(let i = 0; i < 6; i++){ const k = (s.age * 3 + i * .17) % 1; cx.fillStyle = 'rgba(225,246,255,' + (1 - k) + ')'; cx.fillRect(x - L * .5 - k * 60, y + Math.sin(i * 2.1 + s.age * 9) * w * 1.7, 2, 2); }
        cx.restore(); return;
      }
      if(s.kind === 2){                                                      // FROST WAVE: a fan of jagged crystals with a wide cold tail
        const r = s.r;
        const g = cx.createLinearGradient(x, y, x - r * 5, y);
        g.addColorStop(0, 'rgba(140,215,255,.55)'); g.addColorStop(1, 'rgba(140,215,255,0)');
        cx.fillStyle = g; cx.beginPath(); cx.moveTo(x, y - r * 1.1); cx.lineTo(x - r * 5, y); cx.lineTo(x, y + r * 1.1); cx.closePath(); cx.fill();
        cx.shadowColor = '#9fe4ff'; cx.shadowBlur = 14;
        crystal(cx, x - r * .6, y, r * 2.2, r * .5, -.5, 'rgba(190,232,255,.95)');
        crystal(cx, x - r * .6, y, r * 2.2, r * .5, .5, 'rgba(190,232,255,.95)');
        crystal(cx, x - r * .8, y, r * 2.7, r * .6, 0, 'rgba(235,250,255,.98)');
        cx.shadowBlur = 0;
        for(let i = 0; i < 6; i++){ const a = s.age * 6 + i * 1.05; cx.fillStyle = 'rgba(230,248,255,.85)'; cx.beginPath(); cx.arc(x - r * .3 + Math.cos(a) * r * 1.1, y + Math.sin(a) * r * 1.2, 1.5, 0, 7); cx.fill(); }
        cx.restore(); return;
      }
      const r = s.r;                                                         // ICE SHARD: thin spear point with a short frost tail
      const g = cx.createLinearGradient(x, y, x - 46, y);
      g.addColorStop(0, 'rgba(150,225,255,.6)'); g.addColorStop(1, 'rgba(150,225,255,0)');
      cx.fillStyle = g; cx.beginPath(); cx.moveTo(x, y - r * .8); cx.lineTo(x - 46, y); cx.lineTo(x, y + r * .8); cx.closePath(); cx.fill();
      cx.shadowColor = '#9fe4ff'; cx.shadowBlur = 9;
      poly(cx, [[x - 9, y], [x - 3, y - r * .75], [x + 15, y], [x - 3, y + r * .75]], 'rgba(215,244,255,.97)', '#ffffff', 1);
      cx.shadowBlur = 0;
      poly(cx, [[x - 6, y], [x - 1, y - r * .3], [x + 10, y]], 'rgba(255,255,255,.9)');
      cx.restore();
    }
  });
})();