// registry.js - the one place every character plugs into.
// Each character folder (characters/<id>/) has 3 small files that call this:
//   info.js    -> Characters.add({...})        name, color, stats
//   art.js     -> Characters.art(id, {...})    how it looks (optional hooks on top of the default ragdoll)
//   skills.js  -> Characters.skills(id, {...}) how it fights (basic attack tuning, skill slots)
// Load order is set in characters/manifest.js.
const Characters = (() => {
  const list = [], byId = {}, ART = {}, SK = {};

  // Basic attack defaults (same numbers the game used before). A character can override any of them.
  //   time = swing length (s)   cd = wait before next swing (s)   reach = hit box length (px)
  //   hitFrom/hitTo = the part of the swing that can hit (time left on the swing)   dmg = damage multiplier
  const BASIC = {time:.28, cd:.42, reach:58, hitFrom:.21, hitTo:.06, dmg:1};

  return {
    list,                                   // all characters in the order they were added
    get: id => byId[id],
    add(c){
      if(byId[c.id]) Object.assign(byId[c.id], c);
      else { byId[c.id] = c; list.push(c); }
    },
    art(id, a){ ART[id] = a; },
    skills(id, s){ SK[id] = s; },
    artOf: id => ART[id] || {},
    skillsOf(id){
      const s = SK[id] || {};
      return {basic:{...BASIC, ...s.basic}, skills:s.skills || [], ultimate:s.ultimate || null, passive:s.passive || null, hold:s.hold || null};   // hold = the held-key attack (hold ATK), see aftertaste/skills.js
    }
  };
})();