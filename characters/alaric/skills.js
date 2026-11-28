Characters.skills('alaric', {
  basic: {
    time:.7, cd:.5, reach:200, dmg:1,
    combo: [
      {time:.7, cd:.5, dmg:1, kbx:.1, kby:.05, lunge:0},
      {time:.7, cd:.5, dmg:1.1, kbx:.15, kby:.08, lunge:0},
      {time:.8, cd:.6, dmg:1.2, kbx:.2, kby:.1, lunge:0}
    ]
  },
  passive: {desc:' Placeholder Passive', name:'ELVEN GRACE', speed:.08, dur:5},
  skills: [
    {desc:'Placeholder Skill 1', name:'PRECISION SHOT', kind:'projectile', aim:true, charges:2, recharge:7, time:.4, speed:1500, life:.8, r:5, dmg:1.2, kbx:.4, kby:.1, shake:.5, hitstop:.02},
    {desc:'Placeholder Skill 2', name:'SENTINEL'S MARK', kind:'buff', cd:10, time:.5, dmg:0}
  ],
  ultimate: {desc:'Placeholder Ultimate', name:'MOONLIGHT BARRAGE', kind:'area', aim:false, cd:60, windup:1.0, at:.6, radius:150, dmg:3, kbx:1.5, kby:.8, stunx:1.8, shake:2.5, hitstop:.1}
});