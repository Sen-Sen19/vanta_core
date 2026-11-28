// VAELION - The Ascendant Seraph. Phase 1: look, wings and flight movement only (no combat kit yet).
// `fly` = flight tuning, read by arena.js (flyBeat / flyStep / flyGlide). Only characters that have this field are affected.
//   flaps   = wingbeats he has in the air. They come back ONLY while he stands on a platform, one every `recharge` seconds (so a full refill takes flaps x recharge). Gliding is free and unlimited.
//   glideV  = slowest-falling speed while gliding (px/s, always DOWN: gliding never gives height)
//   diveV   = fall speed cap while holding DOWN in the air (wings fold partly)
//   airSpd  = air speed multiplier   airAcc / airDec = air acceleration / deceleration (px/s^2), lower = floatier
//   (wingbeat = the ATK button in the air; JUMP is a normal jump)
//   beatV   = upward speed of a wingbeat   liftT = seconds the beat keeps lifting   liftG = gravity share during that lift
//   cd      = wingbeat cooldown (s)   buf = a press this early before the cooldown ends is remembered   brake = how fast the wings slow a fall into a glide
//   ceil    = highest feet position (px from the top of the arena), so he cannot fly out of the top
Characters.add({id:'vaelion', name:'VAELION', role:'Aerial', color:'#f2cf6a', tag:'The Ascendant Seraph', hp:190, arm:4, spd:5.2, ult:'TBD',
  fly:{flaps:4, recharge:.55, glideV:62, diveV:640, airSpd:1.12, airAcc:900, airDec:420, beatV:380, liftT:.11, liftG:.22, cd:.22, buf:.12, brake:4600, ceil:64}});
