# Adding a character

Make a folder `characters/<id>/` with 3 small files. Copy `characters/titan/` and edit it.

## One ragdoll for everyone (use it as the reference)
There is only ONE ragdoll, in `body.js`. Every character is that same ragdoll with small changes.
- Do NOT write a new ragdoll, copy `body.js`, or draw a whole new body for a normal character.
- Start from the default body (`BODY` in `body.js`, about 52 px tall) and change only the values the character needs
  (longer arms, bigger torso, different colors). Anything you leave out stays default.
- Look (cape, hat, weapon, armor) = `behind` / `front` hooks in `art.js`. Fighting style = `skills.js`.
- Class does not matter (mage, assassin, fighter, tank): it is the same ragdoll with different sizes, colors and skills.
- Bigger / smaller character: scale the `body` sizes in `art.js` together (keep proportions). The hitbox is still 30x52
  for everyone and `arena.js` is not changed per character.
- Only use `draw()` (replaces the ragdoll) for a body that is not human shaped, like a monster, robot or sprite.
- Knockback is the same for every hit and every character (`KB` in `arena.js`). Do not put knockback in a character.

| file | what it does |
|---|---|
| `info.js` | `Characters.add({id, name, role, color, tag, hp, arm, spd, ult})` |
| `art.js` | `Characters.art(id, {body, colors, behind, front, draw})` - look. All parts optional. |
| `skills.js` | `Characters.skills(id, {basic, skills, ultimate, passive})` - fighting. Skills I + II, ultimate and passive are wired (see titan/skills.js). |

Then add the id to `CHARACTER_IDS` in `characters/manifest.js`.

To ask an AI for a new character, send it: this README, `body.js` (the ragdoll reference), the whole `characters/titan/` folder, and your idea.
It should only return the 3 new files, built on the existing ragdoll. It must not edit `arena.js`, `body.js` or `main.js`.

## art.js hooks
- `body` - change sizes only (head, torso, uArm, fArm, hand, thigh, shin, foot). See `BODY` in `body.js`.
- `colors` - `{shirt, limb, far, head, dark}`. Default comes from `info.js` color.
- `behind(cx, f, t, S, P)` - draw behind the body (cape, aura).
- `front(cx, f, t, S, P)` - draw on top (armor, helmet, weapon).
- `draw(cx, f, t)` - replaces the whole body (sprite). Uses world coords (`f.x`, `f.y` = feet).

Drawing space for `behind`/`front`: origin = feet, x = forward (auto-flipped), y = down.
`S` = body points: `pel`, `sh`, `head`, `lean`, `aN`/`aF` (near/far arm: `s`, `el`, `hand`), `lN`/`lF` (leg: `hip`, `knee`, `ankle`).
`f` = fighter (`f.vx`, `f.vy`, `f.gr` on ground, `f.atk` swinging, `f.stun`, `f.flash`). `t` = game time.
`Body.capsule(cx, a, b, width, color)` draws a round limb.

## skills.js
`basic` overrides the basic attack: `time`, `cd`, `reach`, `hitFrom`, `hitTo`, `dmg` (defaults in `registry.js`).

`skills` = up to 2 skills (buttons I, II), `ultimate` = the III button, `passive` = always on. Each skill picks what it does with `kind`
(`shockwave`, `rush`, `quake` are in `SKILLS` in `arena.js`; a new kind = one small function there). `aim:true` = drag the button to aim, a tap goes straight ahead.
`charges` + `recharge` = several charges that each recharge on their own, `cd` = a normal cooldown. Poses/effects for a skill: `art.js` `attack()` checks `A.skill` (= the kind), `shot()` draws projectiles.
Look at `characters/titan/skills.js` as the example.