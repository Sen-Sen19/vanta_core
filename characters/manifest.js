// manifest.js - the list of characters. To add one: make characters/<id>/ with info.js, art.js, skills.js
// (copy the titan folder), then add its id here. Nothing else needs editing.
const CHARACTER_IDS = ['titan', 'noctis', 'umbra', 'paladin', 'caliber', 'zerathis', 'pellorin', 'fulminar', 'errata', 'aftertaste', 'miette', 'nethros', 'bear', 'drudesse', 'vaelion', 'foundry'];

// loads characters/<id>/info.js, art.js, skills.js in order, before main.js runs
const _V = Date.now();
CHARACTER_IDS.forEach(id => ['info', 'art', 'skills'].forEach(file =>
  document.write('<script src="characters/' + id + '/' + file + '.js?v=' + _V + '"><\/script>')));