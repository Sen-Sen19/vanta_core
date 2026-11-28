// preview.js - draws each fighter's REAL model on the select screens (tiles + the two big previews).
// It builds a throw-away idle fighter with mkF() (arena.js) and calls Body.draw() (body.js), so the model
// is exactly what you see in battle, art.js hooks included. It never touches gameplay.
//   Preview.mount(hostEl, character, {face, live, label})  -> puts (or re-uses) a model canvas inside hostEl
//   Preview.kick()                                         -> (re)starts the draw loop, call when a select screen opens
// Tiles (live:false) are drawn once and again only when their size changes. Big previews (live:true) idle-animate.
// The loop sleeps by itself when no select screen is showing. Body / mkF are only touched at draw time,
// so this file can load before them.
const Preview = (() => {
  const items = new Set();                       // {cv, c, face, live, f, done, bad, w, h}
  const still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let raf = 0;

  const hex = (h, a) => {
    const n = parseInt(/^#[0-9a-f]{6}$/i.test(h) ? h.slice(1) : '8899aa', 16);
    return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
  };

  function backdrop(cx, c, w, h){
    const g = cx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, hex(c.color, .26)); g.addColorStop(1, 'rgba(8,10,20,.92)');
    cx.fillStyle = g; cx.fillRect(0, 0, w, h);
    const r = cx.createRadialGradient(w / 2, h * .62, 0, w / 2, h * .62, Math.max(w, h) * .6);
    r.addColorStop(0, hex(c.color, .34)); r.addColorStop(1, 'rgba(0,0,0,0)');
    cx.fillStyle = r; cx.fillRect(0, 0, w, h);
  }

  function letter(cx, c, w, h){                  // fallback if a character's art throws outside a match
    cx.fillStyle = 'rgba(255,255,255,.55)'; cx.font = '700 ' + Math.round(h * .4) + 'px system-ui,sans-serif';
    cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(c.name[0], w / 2, h / 2);
  }

  function paint(it, t){
    const cv = it.cv, w = cv.clientWidth, h = cv.clientHeight;
    if(!w || !h || typeof Body === 'undefined' || typeof mkF === 'undefined') return false;   // hidden, or scripts not ready yet
    const d = Math.min(window.devicePixelRatio || 1, 2);
    if(cv.width !== Math.round(w * d) || cv.height !== Math.round(h * d)){ cv.width = Math.round(w * d); cv.height = Math.round(h * d); }
    it.w = w; it.h = h;
    const cx = cv.getContext('2d');
    cx.setTransform(d, 0, 0, d, 0, 0); cx.clearRect(0, 0, w, h);
    backdrop(cx, it.c, w, h);
    if(!it.bad){
      const s = Math.min(h * .9 / 72, w / 108);  // body is ~52 px tall; leave room for halos, shields, capes
      cx.save(); cx.translate(w / 2, h * .9); cx.scale(s, s);
      try{
        if(!it.f || it.f.c !== it.c){ it.f = mkF(it.c, 0, 0); it.f.x = 0; it.f.y = 0; it.f.gr = true; it.f.face = it.face; }
        Body.draw(cx, it.f, t);
        cx.restore();
      }catch(e){ it.bad = true; cx.setTransform(d, 0, 0, d, 0, 0); backdrop(cx, it.c, w, h); }
    }
    if(it.bad) letter(cx, it.c, w, h);
    return true;
  }

  function loop(){
    raf = 0;
    if(!document.querySelector('#select.active, #online.active')) return;   // asleep until kick()
    const t = performance.now() / 1000;
    items.forEach(it => {
      if(!it.cv.isConnected){ items.delete(it); return; }   // host was cleared (e.g. back to the "?" slot)
      const w = it.cv.clientWidth, h = it.cv.clientHeight;
      if(it.live || !it.done || w !== it.w || h !== it.h) it.done = paint(it, it.live ? t : 0) || false;
    });
    raf = requestAnimationFrame(loop);
  }
  function kick(){ if(!raf) raf = requestAnimationFrame(loop); }

  function mount(host, c, o = {}){
    let it = host._pv;
    if(!it || host.firstElementChild !== it.cv){
      host.textContent = '';
      const cv = document.createElement('canvas');
      cv.className = 'mdl';
      host.appendChild(cv);
      it = host._pv = {cv, c:null, face:1, live:false, f:null, done:false, bad:false, w:0, h:0};
      items.add(it);
    }
    it.face = o.face || 1; it.live = !!o.live && !still;
    if(it.c !== c){ it.c = c; it.f = null; it.done = false; it.bad = false; }
    if(o.label){ it.cv.setAttribute('role', 'img'); it.cv.setAttribute('aria-label', o.label); }
    else it.cv.setAttribute('aria-hidden', 'true');   // tiles: the button text already names the fighter
    kick();
  }

  return {mount, kick};
})();