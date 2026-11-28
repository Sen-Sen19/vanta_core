// net.js - ONLINE 1v1 over PeerJS (WebRTC, no game server of your own).
//
//  HOST-AUTHORITATIVE: one player HOSTS (gets a 4-letter room code) and runs the match exactly like the offline game.
//  The other player JOINS with the code. The guest runs NO simulation:
//     guest  -> host : its inputs (~30 Hz, plus every button press at once)
//     host   -> guest: state snapshots (~20 Hz, only what changed) that the guest interpolates and draws with the normal draw()
//  So the two screens can never drift apart. Cost: the guest feels the round-trip delay on its own buttons.
//
//  Snapshots are generic: every fighter field / arena list is walked and sent as JSON, so a new hero or skill needs NO net code.
//  (fighter references -> {$f:idx}, character data that both sides already have -> {$s:path}, functions / canvases / fields starting with "_" are dropped.)
//
//  Uses PeerJS' free cloud broker (STUN only, no TURN relay): a few strict networks (some school / office / mobile ones) cannot connect.
//  If you have a TURN server put it in ICE below.
const Net = (() => {
  const PROTO = 1, PREFIX = 'vantacore-', CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  // ---- CONNECTION HELP (fill in ONE of these so players on strict networks can still connect) ----
  // A) Free TURN relay from metered.ca (sign up -> create an app -> copy its name and API key; free tier ~500 MB/month = many matches):
  const METERED = {app:'Sen0219', key:'195a31e104a72e971faf36020b76d5c2ebb4'};                       // e.g. {app:'vantacore', key:'abc123...'}   (app = the part before .metered.live)
  // B) Or any TURN server you have:
  const TURN = null;                                      // e.g. {urls:['turn:your.server:3478', 'turns:your.server:443?transport=tcp'], username:'u', credential:'p'}
  const STUN = [{urls:'stun:stun.l.google.com:19302'}, {urls:'stun:stun1.l.google.com:19302'}, {urls:'stun:global.stun.twilio.com:3478'}];
  async function getIce(){
    let servers = [...STUN];
    try{
      if(METERED.app && METERED.key){
     const r = await Promise.race([fetch('https://' + METERED.app + '.metered.live/api/v1/turn/credentials?apiKey=' + METERED.key), new Promise((_, no) => setTimeout(no, 5000))]);
        const j = await r.json(); if(Array.isArray(j)) servers = servers.concat(j);
      }
    }catch(e){ console.warn('TURN credentials not loaded', e); }
    if(TURN) servers.push(TURN);
    return {iceServers:servers};
  }
  const HAS_TURN = !!((METERED.app && METERED.key) || TURN);
  const SNAP_MS = 50, INPUT_MS = 33, INTERP_MS = 55;
  const SKIP_F = new Set(['c', 'K', 'cur', 'tgt', 'sh', 'skeletons']);             // fighter fields never sent (static data / recomputed on the guest / local-only / only the logic reads them: draw uses G.skeletons)
  const SKIP_KEY = new Set(['sm']);                                                // art.js builds these while drawing (Nethros' smoke): the guest makes its own
  const SKIP_G = new Set(['cfg', 'mode', 'stars', 'last', 'paused', 'infoPaused', 'me', 'net', 'f', 'parts', 'snapT']);   // parts: sent as events instead (see snapshot)

  let peer = null, conn = null, role = null, code = '';
  let myPick = null, oppPick = null, oppReady = false, myReady = false, joined = false, inMatch = false, pingMs = 0;
  const ui = {};
  const $q = s => document.querySelector(s);

  // ------------------------------------------------------------------ lobby UI
  function status(msg, bad){ ui.status.textContent = msg; ui.status.style.color = bad ? '#ff6b6b' : ''; }
  function step(name){ ui.start.classList.toggle('hide', name !== 'start'); ui.room.classList.toggle('hide', name !== 'room'); }
  function charName(id){ const c = id && charById(id); return c ? c.name : '-'; }
  function refresh(){
    ui.me.textContent = charName(myPick); ui.opp.textContent = joined ? charName(oppPick) + (role === 'host' ? (oppReady ? '  (READY)' : '  (not ready)') : '') : (role === 'host' ? 'waiting...' : '-');
    ui.grid.querySelectorAll('.tile[data-id]').forEach(t => t.classList.toggle('s1', t.dataset.id === myPick));
    if(role === 'host'){ ui.go.textContent = 'START MATCH'; ui.go.disabled = !(joined && myPick && oppPick && oppReady); }
    else{ ui.go.textContent = myReady ? 'READY - TAP TO CANCEL' : 'READY'; ui.go.disabled = !(joined && myPick); }
    ui.code.textContent = code;
  }
  function buildGrid(){
    ui.grid.innerHTML = '';
    CHARACTERS.forEach((c, i) => {
      const b = document.createElement('button');
      b.className = 'tile'; b.dataset.id = c.id;
      b.innerHTML = `<span class="no">${i + 1}</span><div class="av"></div><b>${c.name}</b><small class="tt">${c.tag}</small><span class="tag a">YOU</span>`;
      const av = b.querySelector('.av');
      if(c.img) av.innerHTML = art(c); else Preview.mount(av, c);   // real model (preview.js)
      b.onclick = () => {
        myPick = c.id; if(role === 'guest'){ myReady = false; send({t:'ready', r:false}); }
        send({t:'pick', id:myPick}); refresh();
      };
      ui.grid.appendChild(b);
    });
  }

  // ------------------------------------------------------------------ connection
  function send(m){ try{ if(conn && conn.open) conn.send(m); }catch(e){} }
  function peerOk(){ if(typeof Peer === 'undefined'){ status('PeerJS did not load (are you offline?)', true); return false; } return true; }
  function reset(){
    try{ if(conn) conn.close(); }catch(e){}
    try{ if(peer) peer.destroy(); }catch(e){}
    peer = conn = role = null; code = ''; myPick = oppPick = null; oppReady = myReady = joined = inMatch = false; pingMs = 0;
  }
  function leave(){ if(!peer && !conn) return; reset(); ui.start && step('start'); ui.status && status('create a room or join one with a code'); }
  function fail(msg){ reset(); step('start'); status(msg, true); if(!$q('#online').classList.contains('active')) { showToast(msg); show('online'); } }

  function newCode(){ let s = ''; for(let i = 0; i < 4; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]; return s; }
  function host(){
    if(!peerOk()) return;
    reset(); role = 'host'; status('creating a room...'); step('start');
    const tryOpen = async n => {
      code = newCode();
      const ice = await getIce(); if(role !== 'host') return;
      const p = peer = new Peer(PREFIX + code, {config:ice});
      p.on('open', () => { if(peer !== p) return; step('room'); buildGrid(); status('share this code - waiting for your opponent'); refresh(); });
      p.on('connection', c => {
        if(conn){ c.on('open', () => { c.send({t:'reject', why:'Room is full'}); setTimeout(() => c.close(), 300); }); return; }
        setupConn(c);
      });
      p.on('error', err => {
        if(peer !== p) return;
        if(err.type === 'unavailable-id' && n < 6){ try{ p.destroy(); }catch(e){} tryOpen(n + 1); return; }   // code already taken: roll another
        fail(netError(err));
      });
      p.on('disconnected', () => { try{ if(peer === p && !p.destroyed) p.reconnect(); }catch(e){} });          // lost the broker (not the opponent): the room code stays valid
    };
    tryOpen(0);
  }
  async function join(c0){
    const c = (c0 || '').toUpperCase().replace(/[^A-Z]/g, '');
    if(c.length !== 4){ status('enter the 4-letter room code', true); return; }
    if(!peerOk()) return;
    reset(); role = 'guest'; code = c; status('connecting to room ' + c + '...');
    const my = role, ice = await getIce(); if(role !== my) return;
    const p = peer = new Peer(undefined, {config:ice});
    p.on('open', () => {
      if(peer !== p) return;
      const cn = p.connect(PREFIX + c, {serialization:'json', reliable:true});
      setupConn(cn);
      setTimeout(() => { if(peer === p && conn === cn && !joined) fail('Could not connect to that room (' + (iceState || 'no answer') + '). ' + (HAS_TURN ? 'Check the code and that the host is still waiting.' : 'Your networks probably block direct connections - a TURN relay is needed (see net.js).')); }, 20000);
    });
    p.on('error', err => { if(peer === p) fail(netError(err)); });
  }
  function netError(err){
    const t = err && err.type;
    if(t === 'peer-unavailable') return 'Room not found - check the code';
    if(t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed') return "Can't reach the matchmaking server";
    if(t === 'browser-incompatible') return 'This browser does not support online play';
    return 'Connection problem' + (t ? ' (' + t + ')' : '');
  }
  let iceState = '';
  function watchIce(c){   // shows what the WebRTC link is doing (checking / failed...) so a failed join can be explained
    iceState = '';
    const hook = () => { const pc = c.peerConnection; if(!pc) return false; pc.addEventListener('iceconnectionstatechange', () => { iceState = 'ice ' + pc.iceConnectionState; if(conn === c && !joined) status('connecting... (' + iceState + ')'); }); return true; };
    if(!hook()){ const t = setInterval(() => { if(hook() || conn !== c) clearInterval(t); }, 100); }
  }
  function setupConn(c){
    conn = c; watchIce(c);
    c.on('open', () => { if(role === 'guest') send({t:'hello', proto:PROTO, ver:APP_VERSION}); });
    c.on('data', onMsg);
    c.on('close', () => { if(conn === c) onClose(); });
    c.on('error', () => { if(conn === c) onClose(); });
  }
  function onClose(){
    const was = inMatch; reset(); step('start');
    if(was){ showToast('OPPONENT DISCONNECTED'); show('menu'); }
    else{ status('opponent left'); if(!$q('#online').classList.contains('active')) show('online'); }
  }

  // ------------------------------------------------------------------ messages
  function onMsg(m){
    if(!m || typeof m !== 'object') return;
    switch(m.t){
      case 'hello':   // (host) the guest says who it is
        if(m.proto !== PROTO || m.ver !== APP_VERSION){ send({t:'reject', why:'Different game version (host ' + APP_VERSION + ', you ' + m.ver + ') - hit REFRESH on both'}); setTimeout(() => { try{ conn.close(); }catch(e){} conn = null; }, 300); return; }
        joined = true; oppReady = false; send({t:'welcome', ver:APP_VERSION}); if(myPick) send({t:'pick', id:myPick});
        status('opponent connected - pick your fighters'); refresh(); break;
      case 'welcome': // (guest)
        joined = true; step('room'); buildGrid(); status('connected - pick a fighter, then READY'); refresh(); break;
      case 'reject': fail(m.why || 'Rejected'); break;
      case 'pick': oppPick = m.id; refresh(); break;
      case 'ready': oppReady = !!m.r; refresh(); break;
      case 'start':   // (guest) the host starts the match
        if(role !== 'guest') return;
        inMatch = true;
        startMatch({mode:'pvp', size:1, net:'guest', me:1, P:m.P, player:charById(m.h), enemy:charById(m.g), allies:[], foes:[]});
        break;
      case 'lobby': if(role === 'guest'){ inMatch = false; myReady = false; show('online'); step('room'); status('back in the lobby'); refresh(); } break;
      case 'in': if(role === 'host') onInput(m); break;
      case 'snap': if(role === 'guest') onSnap(m); break;
      case 'ping': send({t:'pong', n:m.n}); break;
      case 'pong': pingMs = Math.round(performance.now() - m.n); break;
    }
  }

  // ------------------------------------------------------------------ static data both sides already have (K = skills, C = hero info): sent as a path, not as data
  let smap = null, spath = null;
  function buildStatic(){
    smap = new Map(); spath = {};
    const walk = (o, p, d) => {
      if(!o || typeof o !== 'object' || smap.has(o) || d > 9) return;
      smap.set(o, p); spath[p] = o;
      for(const k in o){ const v = o[k]; if(v && typeof v === 'object') walk(v, p + '/' + k, d + 1); }
    };
    G.f.forEach((f, i) => { walk(f.K, 'K' + i, 0); walk(f.c, 'C' + i, 0); });
  }
  const R2 = v => Math.abs(v) >= 10 ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100;   // fewer digits = smaller packets
  function enc(v, anc, fm){
    if(v === null) return null;
    const t = typeof v;
    if(t === 'number') return isFinite(v) ? R2(v) : 0;
    if(t === 'string' || t === 'boolean') return v;
    if(t !== 'object') return undefined;                                   // functions, symbols
    const fi = fm.get(v); if(fi !== undefined) return {$f:fi};
    const sp = smap.get(v); if(sp !== undefined) return {$s:sp};
    if(anc.has(v)) return undefined;                                       // cycle
    const pr = Object.getPrototypeOf(v);
    if(Array.isArray(v)){
      anc.add(v); const out = v.map(x => { const e = enc(x, anc, fm); return e === undefined ? null : e; }); anc.delete(v); return out;
    }
    if(pr !== Object.prototype && pr !== null) return undefined;           // canvas, typed arrays, Maps...
    anc.add(v); const out = {};
    for(const k in v){ if(k.charCodeAt(0) === 95 || SKIP_KEY.has(k)) continue; const e = enc(v[k], anc, fm); if(e !== undefined) out[k] = e; }
    anc.delete(v); return out;
  }
  function merge(old, v){   // {$m:{...}, $n} = only the changed fields of an object ($n: it is a new object)
    const o = (!v.$n && old && typeof old === 'object' && !Array.isArray(old)) ? old : {};
    for(const k in v.$m) o[k] = dec(v.$m[k]);
    return o;
  }
  function dec(v){
    if(v === null || typeof v !== 'object') return v;
    if(Array.isArray(v)) return v.map(dec);
    if(v.$m !== undefined) return merge(undefined, v);
    if(v.$f !== undefined) return G.f[v.$f];
    if(v.$s !== undefined) return spath[v.$s];
    if(v.$u) return undefined;
    const o = {}; for(const k in v) o[k] = dec(v[k]); return o;
  }

  // ------------------------------------------------------------------ HOST: run the match, send snapshots, read the guest's inputs
  let sentCache = {}, sentObj = {}, snapAcc = 0, snapN = 0, remoteIn = null, sentParts = new WeakSet();
  function dropSub(key){ const p = key + '.'; for(const k in sentCache) if(k.startsWith(p)) delete sentCache[k]; }
  function resetRemote(){ remoteIn = {l:0, r:0, held:false, aim:null, skAim:null, ay:0, jq:false, dq:false, aq:false, skq:null}; }
  function hostStart(g){
    inMatch = true; sentCache = {}; sentObj = {}; sentParts = new WeakSet(); snapAcc = 0; snapN = 0; resetRemote(); buildStatic();
    send({t:'start', h:g.cfg.player.id, g:g.cfg.enemy.id, P:g.P});
  }
  function onInput(m){
    if(!remoteIn) return;
    remoteIn.l = m.l ? 1 : 0; remoteIn.r = m.r ? 1 : 0; remoteIn.held = !!m.held; remoteIn.aim = m.aim || null; remoteIn.skAim = m.skAim || null; remoteIn.ay = +m.ay || 0;
    if(m.jq) remoteIn.jq = true; if(m.dq) remoteIn.dq = true; if(m.aq) remoteIn.aq = true;
    if(m.sk && m.sk.length){ const s = m.sk[m.sk.length - 1]; remoteIn.skq = {i:s.i, ax:s.ax, ay:s.ay, drag:!!s.drag, m:s.m}; }
  }
  function take(){   // the arena calls this once per tick: held state stays, one-shot presses are consumed
    if(!remoteIn) resetRemote();
    const o = {...remoteIn}; remoteIn.jq = remoteIn.dq = remoteIn.aq = false; remoteIn.skq = null; return o;
  }
  function snapshot(){
    const fm = new Map(); G.f.forEach((f, i) => fm.set(f, i));
    const out = {}, anc = new Set();
    const put = (key, val, dst, k) => {                  // send val only if it changed since the last snapshot
      let e = enc(val, anc, fm); if(e === undefined) e = {$u:1};
      const s = JSON.stringify(e);
      if(sentCache[key] !== s){ sentCache[key] = s; dst[k] = e; return true; }
      return false;
    };
    const putD = (key, val, dst, k) => {                 // same, but a plain object is diffed one level deeper (a big object with one moving field costs only that field)
      const plain = val && typeof val === 'object' && !Array.isArray(val) && !fm.has(val) && !smap.has(val) && Object.getPrototypeOf(val) === Object.prototype;
      const was = sentObj[key];
      if(!plain){ if(was !== undefined){ delete sentObj[key]; dropSub(key); } return put(key, val, dst, k); }
      const fresh = was !== val;                         // a NEW object (e.g. a skill just started): the guest must build it from scratch
      if(fresh){ sentObj[key] = val; dropSub(key); delete sentCache[key]; }
      const sub = {}; let any = false;
      for(const sk in val){ if(sk.charCodeAt(0) === 95 || SKIP_KEY.has(sk)) continue; if(put(key + '.' + sk, val[sk], sub, sk)) any = true; }
      if(any || fresh) dst[k] = {$m:sub, $n:fresh ? 1 : 0};
    };
    out.f = G.f.map((f, i) => { const d = {}; for(const k in f){ if(SKIP_F.has(k) || k.charCodeAt(0) === 95) continue; putD(i + '.' + k, f[k], d, k); } return d; });
    for(const k in G){
      if(SKIP_G.has(k) || k.charCodeAt(0) === 95) continue;
      putD('G.' + k, G[k], out, k);
    }
    // PARTICLES are cosmetic and the biggest thing by far: send each NEW one once (the guest ages it locally with the same stepFx), and only
    // the long-lived ones (vomit sludge...) as a list. Both lists are encoded without the diff cache.
    const pn = [], pl = [];
    for(const q of G.parts){ if(q.life > 1.2) pl.push(q); else if(!sentParts.has(q)){ sentParts.add(q); if(pn.length < 60) pn.push(q); } }
    if(pn.length) out.pn = enc(pn, anc, fm);
    put('G.pl', pl, out, 'pl');
    return out;
  }
  function hostTick(dt){
    if(!conn || !conn.open) return;
    snapAcc += dt * 1000;
    if(snapAcc >= SNAP_MS){ snapAcc = snapAcc % SNAP_MS; send({t:'snap', n:++snapN, d:snapshot()}); }
  }

  // ------------------------------------------------------------------ GUEST: send inputs, apply snapshots, interpolate
  let pend = null, lastIn = 0, lastInStr = '', lastPing = 0;
  function guestStart(g){
    inMatch = true; pend = {jq:false, dq:false, aq:false, sk:[]}; lastIn = 0; lastInStr = ''; lastPing = 0; buildStatic(); G._ps = []; G.partsL = [];
    G.f.forEach(f => { f._tx = f.x; f._ty = f.y; f._px = f.x; f._py = f.y; f._pt = 0; });
  }
  function onSnap(m){
    if(!G || G.net !== 'guest' || !m.d) return;
    const d = m.d, now = performance.now();
    if(d.f) d.f.forEach((fd, i) => {
      const f = G.f[i]; if(!f) return;
      for(const k in fd){
        const v = fd[k] && fd[k].$m !== undefined ? merge(f[k], fd[k]) : dec(fd[k]);
        if(k === 'x'){ f._px = f.x; f._tx = v; f._pt = now; }
        else if(k === 'y'){ f._py = f.y; f._ty = v; f._pt = now; }
        else f[k] = v;
      }
    });
    for(const k in d){
      if(k === 'f') continue;
      if(k === 'pn') G._ps.push(...dec(d.pn));                // new particles join the local ones
      else if(k === 'pl') G.partsL = dec(d.pl);              // long-lived ones are replaced
      else G[k] = d[k] && d[k].$m !== undefined ? merge(G[k], d[k]) : dec(d[k]);
    }
    G.snapT = now;
  }
  function guestFrame(dt){
    const now = performance.now();
    // 1) inputs out
    if(Ctl.jump){ pend.jq = true; Ctl.jump = false; }
    if(Ctl.drop){ pend.dq = true; Ctl.drop = false; }
    if(Ctl.atk){ pend.aq = true; Ctl.atk = false; }
    [0, 1, 2].forEach(i => { if(Ctl.sk[i]){ pend.sk.push({i, ax:Ctl.sk[i].ax, ay:Ctl.sk[i].ay, drag:Ctl.sk[i].drag, m:Ctl.sk[i].m}); Ctl.sk[i] = null; } });
    const aim = Ctl.atkV || (Math.hypot(Ctl.sx, Ctl.sy) > .4 ? {x:Ctl.sx, y:Ctl.sy} : null);
    const skAim = Ctl.aim && Ctl.aim.drag && !Ctl.aim.cancel ? Ctl.aim : null;
    const st = {l:Ctl.l, r:Ctl.r, held:Ctl.held, ay:Ctl.dn - Ctl.up, aim:aim ? {x:R2(aim.x), y:R2(aim.y)} : null, skAim:skAim ? {i:skAim.i, x:R2(skAim.ax), y:R2(skAim.ay)} : null};
    const ss = JSON.stringify(st), flags = pend.jq || pend.dq || pend.aq || pend.sk.length;
    if(flags || (now - lastIn >= INPUT_MS && (ss !== lastInStr || now - lastIn >= 150))){
      send({t:'in', ...st, jq:pend.jq, dq:pend.dq, aq:pend.aq, sk:pend.sk});
      pend = {jq:false, dq:false, aq:false, sk:[]}; lastIn = now; lastInStr = ss;
    }
    if(now - lastPing > 2000){ lastPing = now; send({t:'ping', n:now}); }
    // 2) local clock + cosmetics + smoothing between snapshots
    if(!(G.hs > 0)) G.t += dt;
    G.parts = G._ps; stepFx(dt); G._ps = G.parts; G.parts = G._ps.concat(G.partsL);   // short particles are simulated here, long-lived ones come from the host
    G.shake = Math.max(0, (G.shake || 0) - dt);
    (G.sh || []).forEach(s => { s.x += (s.vx || 0) * dt; s.y += (s.vy || 0) * dt; if(s.g) s.vy += s.g * dt; });   // projectiles keep flying until the next snapshot corrects them
    G.f.forEach(f => {
      const k = f._pt ? Math.min(1, (now - f._pt) / INTERP_MS) : 1;
      if(Math.abs(f._tx - f._px) > 220 || Math.abs(f._ty - f._py) > 220){ f.x = f._tx; f.y = f._ty; }   // teleport / respawn: no sliding
      else{ f.x = f._px + (f._tx - f._px) * k; f.y = f._py + (f._ty - f._py) * k; }
    });
    G.f.forEach(f => { if(!f.dead) f.cur = foeOf(f); });
  }

  // ------------------------------------------------------------------ lobby wiring
  function lobby(){   // after a match: both players go back to the fighter pick
    if(role === 'host') send({t:'lobby'});
    inMatch = false; myReady = false; oppReady = false; show('online'); step('room'); status(role === 'host' ? 'pick fighters, then START' : 'pick a fighter, then READY'); refresh();
  }
  function init(){
    ['status', 'start', 'room', 'me', 'opp', 'grid', 'go', 'code'].forEach(k => ui[k] = $q('#ol' + k[0].toUpperCase() + k.slice(1)));
    ui.join = $q('#olJoinCode');
    $q('#btnMulti').classList.remove('locked'); $q('#btnMulti').disabled = false; $q('#btnMulti').removeAttribute('aria-disabled');
    $q('#btnMulti').innerHTML = '&#127760; ONLINE 1 v 1';
    $q('#btnMulti').onclick = () => { reset(); step('start'); status('create a room or join one with a code'); show('online'); };
    $q('#olHost').onclick = host;
    $q('#olJoinBtn').onclick = () => join(ui.join.value);
    ui.join.addEventListener('keydown', e => { if(e.key === 'Enter') join(ui.join.value); });
    ui.join.addEventListener('input', () => { ui.join.value = ui.join.value.toUpperCase().replace(/[^A-Z]/g, ''); });
    $q('#olBack').onclick = () => show('menu');
    $q('#olLeave').onclick = () => show('menu');
    ui.go.onclick = () => {
      if(role === 'host'){
        if(!(joined && myPick && oppPick && oppReady)) return;
        startMatch({mode:'pvp', size:1, net:'host', me:0, player:charById(myPick), enemy:charById(oppPick), allies:[], foes:[]});
      }else{ myReady = !myReady; send({t:'ready', r:myReady}); refresh(); }
    };
  }
  init();

  return {
    hostStart, hostTick, take, guestStart, guestFrame, lobby, leave,
    label: () => 'ONLINE 1v1' + (role === 'guest' && pingMs ? '  -  ' + pingMs + ' ms' : '') + (role === 'host' ? '  -  HOST' : ''),
    _dbg: {snapshot, enc, dec, buildStatic, get sentCache(){ return sentCache; }}
  };
})();