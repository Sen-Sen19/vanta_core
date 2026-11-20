// PELLORIN skills - the String Master. He does not hit. His small PUPPET walks on the ground, tied to his near hand by a string, and the puppet hits.
// COMBO (press ATK again to keep it going): 1 JAB (puppet runs in and stabs)   2 SPIN (puppet whirls two blades)   3 LEAP SLAM (puppet jumps and smashes a mallet, knocks up).
// HOLD ATK = FOCUS: he freezes with his hand up, the puppet floats and starts to grow (chargeP = .3, must match CP in art.js).
//   Let go = the puppet becomes a MONSTER PUPPET for a short time: bigger, hits harder and reaches farther. The let-go hit is a big slam.
//   Size, beast time and power all follow how long you held: a short hold = a small, short beast, a full hold (chargeMax) = the full monster.
//   A tap (hold shorter than ~.2 s) does the normal combo.
// SKILL I = NO STRINGS DETACHED, SKILL II = THE GRAND ENTRANCE, ULTIMATE = THE FINAL CURTAIN (see the skills list below).
// No melee box on his body (hitFrom:0 hitTo:0). The puppet makes the hit, art.js does the hit check (arena.js is not changed).
//
// string = {leash, follow, speed}: leash = longest string (px), follow = how far in front of him the puppet waits (px), speed = puppet walk speed (px/s).
// pup (on each combo hit) = {dash, hitFrom, hitTo, w, h}: dash = how far the puppet runs forward (px, it stops at the enemy),
//   hitFrom/hitTo = part of the swing where the puppet can hit (same idea as melee, but as progress 0..1 - MUST stay > chargeP),
//   w/h = puppet hit box size (px). Bigger beast = bigger box.
// beast = {min, max, scale, dmg, reach, cd, slam}: min..max = seconds of beast time (short focus = min, full focus = max), scale = how many times bigger at FULL focus (less focus = less),
//   dmg = damage multiplier on normal hits at full beast, reach = dash multiplier at full beast, cd = seconds before the next beast can start,
//   slam = the pup box of the let-go slam.
// TUNE HERE: dmg (main balance knob), string.leash (range), beast.min / beast.max / beast.cd (how often and how long he is a beast).
Characters.skills('pellorin', {
  basic: {time:.5, cd:.5, noSlash:true, noShake:true, hitFrom:0, hitTo:0, dmg:.6, kbx:.35, kby:.2, stunx:1, hitstop:0,
    chargeP:.3, chargeMin:.2, chargeMax:1.2,
    // MONSTROUS UNLEASHING (the held key = the charge above). Charge % = how long he held (chargeMin..chargeMax). Let go = the existing slam animation, scaled by the charge:
    //   damage = base x (1 + charge) -> 25% = 1.25x, 50% = 1.5x, 75% = 1.75x, 100% = 2.0x of base (base = the puppet's normal attack damage; the leap slam is 1.5).
    //   knockback goes from kbx[0] (25%, Moderate) to kbx[1] (100%, Maximum); kby = how much it lifts; stunx = stun length. Below 25% still counts as 25%.
    unleash: {name:'MONSTROUS UNLEASHING', base:1.5, floor:.25, kbx:[.5, 1.25], kby:[.25, .6], stunx:[1.1, 1.8],
      desc:'HOLD ATK: his puppet swells into a monster (a meter over it shows the charge). Let go to unleash the slam: 25% charge hits for 1.25x damage, 50% for 1.5x, 75% for 1.75x and a full charge for 2x, with knockback growing from moderate to maximum. Even a small charge hits hard.'},
    string: {leash:170, follow:46, speed:300},
    beast: {min:2, max:6, scale:2.6, dmg:1.35, reach:1.5, cd:4, slam:{dash:90, hitFrom:.52, hitTo:.78, w:36, h:34}},
    combo: [
      {time:.50, cd:.50, dmg:.6,  kbx:.35, kby:.2, pup:{dash:80,  hitFrom:.40, hitTo:.62, w:24, h:24}},                                    // 1 jab
      {time:.55, cd:.55, dmg:.7,  kbx:.4,  kby:.3, stunx:1.1, pup:{dash:55,  hitFrom:.40, hitTo:.74, w:38, h:26}},                        // 2 spin
      {time:.80, cd:.80, dmg:1.5, kbx:.4,  kby:1,  stunx:1.7, hitstop:.08, pup:{dash:105, hitFrom:.60, hitTo:.80, w:30, h:30}}  // 3 leap slam
    ]
  },
  // PASSIVE - THE SHOW MUST GO ON (Performance Momentum): every landed hit fills the Momentum gauge (gain.basic %, skill hits gain.skill %). At 100% the buff starts by itself for `dur` s:
  //   he takes `def` less damage (0.2 = 20%), his puppet deals `atk` more damage (0.2 = 20%). The gauge resets to 0 and cannot fill while the buff runs.
  //   No hit for `decayDelay` s = the gauge drains `decay` % per second. TUNE HERE: gain (how fast it fills), dur, def, atk.
  passive: {name:'THE SHOW MUST GO ON', kind:'momentum', gain:{basic:10, skill:15}, decayDelay:1.5, decay:10, dur:10, def:.2, atk:.2,
    desc:'Every hit he or his puppet lands fills the Momentum gauge. At 100% the show begins for 10 seconds: he takes 20% less damage and his puppet deals 20% more. The gauge empties, and cannot refill while the buff lasts. If he stops landing hits, the gauge slowly drains.'},
  // SKILL I - NO STRINGS DETACHED: the string is cut from his hand and stays on the puppet. The puppet fires it along the aim (drag the button; a tap = at the enemy if he is within range, else straight ahead).
  //   TEN strings (one per finger, `strings`) each flying in a RANDOM direction inside a cone (`fan` = total angle in radians) around the aim, with random lengths (`lenVar` = how much shorter than `range` a string can be), `range` px long. They PIERCE: each enemy takes ONE hit of dmg x (how many strings go through him), so close = more strings = more damage. No knockback (only a tiny hit-stun, `stunx`), no other effect. Then it retracts and `reconnect` s later it is tied to his hand again.
  //   Timeline: `wind` s (hand snap / puppet aims) -> flies out at `speed` px/s up to `range` -> retracts at the same speed -> `reconnect`. Being hit while casting just snaps the string back.
  //   TUNE HERE: dmg (damage PER string), range (how long the strings are), fan (how wide), strings (how many), cd, speed.
  skills: [
    {name:'NO STRINGS DETACHED', kind:'nostrings', aim:true, cd:8, wind:.14, strings:10, fan:2.6, lenVar:.45, range:190, speed:1800, hold:.06, reconnect:.25, dmg:.17, kbx:0, kby:0, stunx:.5,
      desc:'He cuts the strings from his ten fingers. The puppet fires all ten as piercing needles in random directions around where you aim, over a short range (drag to aim). The spread is different every cast. Every string that pierces an enemy deals damage, so the closer the enemy, the more strings hit. No knockback. Then they fly back and reconnect to him.'}
    ,
    // SKILL II - THE GRAND ENTRANCE: ground-targeted (drag the button: drag length = how far, left / right = side; a tap = the enemy's column if he is in range). `wind` s (hand flourish, puppet crouches; a hit on him cancels it),
    //   then the puppet LEAPS in an arc (`fly` s, `arc` = how high) and stomps. A ring on the ground shows where. Everyone inside `radius` px takes dmg and is knocked back away from the impact (kbx / kby). Nothing else:
    //   no slow, no lingering damage (only the tiny hit-stun every hit has, `stunx`). The puppet then walks / hops back to him. Enemies high in the air at the impact are not hit.
    //   TUNE HERE: dmg (damage), radius (blast size), range (how far it can land), cd, kbx / kby (knockback), fly (dodge window = wind + fly).
    {name:'THE GRAND ENTRANCE', kind:'grandentrance', aim:true, cd:11, wind:.3, fly:.45, recover:.25, arc:110, range:400, radius:80, dmg:1.5, kbx:1.1, kby:.5, stunx:.5, shake:2.5, hitstop:.08,
      desc:'Drag to aim at a spot on the ground (a ring shows where). He commands the puppet to leap there and crash down with a stomp: everyone in the impact radius takes damage and is knocked back away from the impact. No other effects. The leap takes a moment, so enemies can run out of the ring.'}
  ],
  ultimate: {name:'THE FINAL CURTAIN', kind:'finalcurtain', type:'Transformation - Ultimate', aim:false, cd:60,
    // THE FINAL CURTAIN: the puppet swells into a monster where it stands and YOU steer it (it becomes your body: move, jump, ATK). Pellorin rises, strings cut, and dances above the arena, untouchable.
    //   duration = seconds of beast (starts at the cast), hp = the beast's own fixed pool (his real HP is not touched), w / h = the beast's hit box (px), speed = move speed x Pellorin's.
    //   rise = how long he takes to float up (look only), descend = how long his safe descent takes after it ends (he cannot be hit meanwhile),
    //   recoverEnd / recoverBreak = seconds he cannot act after the beast ran out of time / was destroyed (hp 0 or knocked out of the arena).
    //   NO skills, NO super armor: its hits and the hits it takes follow the normal hit / stun / knockback rules.
    //   combo = the 5-hit basic combo (press ATK again to keep going). fixed = flat damage (armor is not used; the Show Must Go On +20% still counts). kbx / kby / stunx = knockback and stun:
    //   hits 1-4 have NO knockback (kbx 0) but a stun long enough to chain into the next hit, hit 5 = very strong (the same as a full MONSTROUS UNLEASHING).
    //   time / cd = swing length, reach = hit box length, hitFrom / hitTo = hit window (seconds LEFT in the swing), hop / lunge = the leap, lungeP = when in the swing the leap starts.
    //   TUNE HERE: cd (how often), duration, hp, the fixed numbers, stunx (how well the combo chains), w / h (size).
    duration:12, hp:600, w:40, h:58, speed:1, rise:.45, descend:.45, recoverEnd:.75, recoverBreak:1.5,
    combo:[
      {name:'Leaping Stomp',       time:.60, cd:.60, fixed:35, kbx:0,    kby:0,  stunx:2,   reach:60, hitFrom:.27, hitTo:.09, hop:330, lunge:150, lungeP:.25, hitstop:.04, shake:1.2},
      {name:'Double-Handed Smash', time:.65, cd:.65, fixed:45, kbx:0,    kby:0,  stunx:2,   reach:64, hitFrom:.30, hitTo:.14, lunge:90,  lungeP:.30, hitstop:.06, shake:1.6},
      {name:'Left-Hand Punch',     time:.45, cd:.45, fixed:30, kbx:0,    kby:0,  stunx:2,   reach:60, hitFrom:.26, hitTo:.10, lunge:140, lungeP:.30, hitstop:.03, shake:.8},
      {name:'Right-Hand Punch',    time:.45, cd:.45, fixed:35, kbx:0,    kby:0,  stunx:2,   reach:60, hitFrom:.26, hitTo:.10, lunge:140, lungeP:.30, hitstop:.03, shake:.8},
      {name:'Leaping Smash',       time:.85, cd:.85, fixed:65, kbx:1.25, kby:.6, stunx:1.8, reach:72, hitFrom:.34, hitTo:.12, hop:380, lunge:190, lungeP:.30, hitstop:.12, shake:3}
    ],
    desc:'He unleashes the monster. His strings drop away and he floats above the arena, dancing and untouchable, while YOU control the beast for 12 seconds: move, jump and press ATK for its 5-hit combo (35 / 45 / 30 / 35 / 65, only the last hit has very strong knockback). No skills, no super armor. The beast has its own 600 HP, shown on the health bar. It ends when the time runs out (he lands and recovers for 0.75 s) or the beast is destroyed (1.5 s recovery).'}
});
