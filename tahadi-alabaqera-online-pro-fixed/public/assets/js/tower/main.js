/* لعبة العباقرة 33.18.0 — «برج التحديات».
   A hundred levels on your own (no waiting), and races for 2 to 8 in public or private rooms:
   سباق (first to the top), إقصاء (rounds until one is left) and فرق (two teams add up their places).
   Stars and gems unlock characters and outfits; progress is kept on this device. */
import { LEVELS, WORLDS, CHALLENGES, levelInfo, levelCourse, roundCourse, buildCourse, worldOf, starsFor, STAR_MAX } from './course.js?v=33.18.0';
import { Runner } from './physics.js?v=33.18.0';
import { TowerScene, CHARACTERS, OUTFITS } from './scene.js?v=33.18.0';

const doc = document, $ = (id) => doc.getElementById(id), body = doc.body;
const el = (tag, cls, text) => { const n = doc.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
const fmt = (s) => { s = Math.max(0, s); const m = Math.floor(s / 60), r = s - m * 60; return (m ? m + ':' + String(Math.floor(r)).padStart(2, '0') : Math.floor(r)) + '.' + Math.floor((r % 1) * 10); };

/* ------------------------------------------------------------------ saved progress */
const SAVE = 'bs-tower-v1';
const fresh = () => ({ v: 1, best: {}, gems: {}, wallet: 0, owned: ['none', 'noface'], look: { char: 'zafran', hat: 'none', face: 'noface' }, last: 1, mode: 'race', sound: true });
let save = (() => { try { const s = JSON.parse(localStorage.getItem(SAVE) || 'null'); if (s?.v === 1) return { ...fresh(), ...s, look: { ...fresh().look, ...s.look } }; } catch { /* private mode */ } return fresh(); })();
const persist = () => { try { localStorage.setItem(SAVE, JSON.stringify(save)); } catch { /* full or private */ } };
const totalStars = () => Object.values(save.best).reduce((a, b) => a + (b.s || 0), 0);
const unlocked = (n) => n === 1 || Boolean(save.best[n - 1]);
const nextLevel = () => { for (const L of LEVELS) if (!save.best[L.n]) return L.n; return LEVELS.length; };
const charOpen = (c) => totalStars() >= c.stars;

/* ------------------------------------------------------------------ sound */
let ac = null;
function tone(freq, dur = 0.12, type = 'sine', vol = 0.18, slide = 0) {
  if (!save.sound) return;
  try {
    ac ??= new (globalThis.AudioContext || globalThis.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume();
    const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime; o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + 0.02);
  } catch { /* no audio */ }
}
const SFX = {
  jump: () => tone(420, 0.14, 'triangle', 0.12, 1.8), land: () => tone(140, 0.08, 'sine', 0.12, 0.6), pad: () => tone(300, 0.35, 'sawtooth', 0.08, 3.2),
  gem: () => { tone(880, 0.1, 'triangle', 0.14); setTimeout(() => tone(1320, 0.16, 'triangle', 0.12), 70); }, hit: () => tone(110, 0.22, 'square', 0.1, 0.5),
  fall: () => tone(500, 0.6, 'sine', 0.14, 0.2), cp: () => { tone(660, 0.1, 'triangle', 0.12); setTimeout(() => tone(990, 0.14, 'triangle', 0.12), 90); },
  tick: () => tone(700, 0.08, 'square', 0.08), go: () => tone(1050, 0.3, 'square', 0.1), win: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.14), i * 110)),
  crack: () => tone(220, 0.1, 'sawtooth', 0.06, 0.5), door: () => tone(330, 0.12, 'triangle', 0.08, 1.3), bounce: () => tone(260, 0.2, 'sine', 0.12, 2),
};
const buzz = (ms) => { try { navigator.vibrate?.(ms); } catch { /* not allowed */ } };

/* ------------------------------------------------------------------ screens */
const screens = ['twLobby', 'twMap', 'twWardrobe', 'twOnline', 'twBoard', 'twHud'];
let current = null;
function show(id) { if (current === id && (id === 'twHud') === (game !== null)) return; current = id; for (const s of screens) $(s).hidden = s !== id; body.classList.toggle('tw-playing', id === 'twHud'); if (id !== 'twHud') stage(); }
function toast(text, ms = 1800) { const t = $('twToast'); t.textContent = text; t.classList.add('on'); clearTimeout(toast.timer); toast.timer = setTimeout(() => t.classList.remove('on'), ms); }

/* ------------------------------------------------------------------ the 3D view */
let scene = null, game = null, last = performance.now(), showcase = null;
try { scene = new TowerScene($('twCanvas')); } catch { body.classList.add('tw-no3d'); }
addEventListener('resize', () => scene?.resize());
function stage() {
  if (!scene) return;
  const n = save.last || 1, W = worldOf(n);
  const course = buildCourse({ challenges: [], world: W.id, seed: 9 });
  scene.setCourse(course); const r = scene.addRunner('me', save.look, '', true); r.x = 0; r.y = 0; r.z = 2.2; r.ry = Math.PI;
  showcase = { r, a: 0, view: current === 'twWardrobe' ? 'ward' : 'lobby' }; game = null;
}
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (scene) {
    if (game) game.tick(dt);
    else if (showcase) { showcase.a += dt * 0.35; const t = now / 1000; scene.update(t, dt, null); const c = scene.camera; if (showcase.view === 'ward') { c.position.set(Math.sin(showcase.a) * 0.6, 0.9, 2.2 - 5); c.lookAt(0, -1.25, 2.2); } else { c.position.set(Math.sin(showcase.a) * 0.8, 2.1, 2.2 - 4.4); c.lookAt(0, 1.25, 2.2); } showcase.r.ry = Math.PI + Math.sin(showcase.a * 1.7) * 0.45; showcase.r.anim = 'idle'; }
    scene.render();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* ------------------------------------------------------------------ input */
const input = { x: 0, z: 0, jump: false, keys: new Set() };
(function controls() {
  const pad = $('twStick'), knob = $('twKnob'), zone = $('twStickZone');
  let id = null, ox = 0, oy = 0; const R = 56;
  const move = (x, y) => { let dx = x - ox, dy = y - oy; const d = Math.hypot(dx, dy); if (d > R) { dx *= R / d; dy *= R / d; } knob.style.transform = `translate(${dx}px,${dy}px)`; input.x = -dx / R; input.z = -dy / R; };
  zone.addEventListener('pointerdown', (e) => { if (id !== null) return; body.classList.add('tw-moved'); id = e.pointerId; ox = e.clientX; oy = e.clientY; pad.style.left = ox - 70 + 'px'; pad.style.top = oy - 70 + 'px'; pad.classList.add('on'); move(ox, oy); zone.setPointerCapture?.(id); e.preventDefault(); });
  zone.addEventListener('pointermove', (e) => { if (e.pointerId === id) move(e.clientX, e.clientY); });
  const end = (e) => { if (e.pointerId !== id) return; id = null; input.x = 0; input.z = 0; knob.style.transform = ''; pad.classList.remove('on'); };
  zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);
  $('twJump').addEventListener('pointerdown', (e) => { e.preventDefault(); input.jump = true; $('twJump').classList.add('down'); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) $('twJump').addEventListener(ev, () => $('twJump').classList.remove('down'));
  const keyAxis = () => { const k = input.keys; input.x = (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0) - (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0); input.z = (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0) - (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0); };
  addEventListener('keydown', (e) => { if (!game) return; if (e.code === 'Space') { input.jump = true; e.preventDefault(); } else if (/^(Arrow|Key[WASD])/.test(e.code)) { input.keys.add(e.code); keyAxis(); e.preventDefault(); } else if (e.code === 'Escape' && game?.solo) pause(); });
  addEventListener('keyup', (e) => { if (input.keys.delete(e.code)) keyAxis(); });
})();

/* ------------------------------------------------------------------ a run (solo or online) */
class Run {
  constructor({ course, solo = true, level = null, online = null, slot = -1 }) {
    this.course = course; this.solo = solo; this.level = level; this.online = online;
    this.runner = new Runner(course, { slot }); this.t = -3.2; this.done = false; this.paused = false; this.lastCp = 0; this.sent = 0; this.tickShown = 4;
    scene?.setCourse(course); this.me = scene?.addRunner('me', save.look, '', true, online?.myTeam ?? null);
    scene?.snapCamera(this.runner.x, this.runner.y, this.runner.z);
    this.hud();
    if (online) online.attach(this);
  }
  clock() { return this.online ? this.online.raceTime() : this.t; }
  tick(dt) {
    if (this.paused) return;
    if (!this.online) this.t += dt;
    const t = this.clock(), r = this.runner;
    // the count-in
    if (t < 0) { const n = Math.ceil(-t); if (n !== this.tickShown && n <= 3) { this.tickShown = n; count(String(n)); SFX.tick(); } }
    else if (this.tickShown) { this.tickShown = 0; count('انطلق!', true); SFX.go(); }
    if (t >= 0 && !this.done && !this.out) r.update(dt, t, input);
    input.jump = false;
    for (const e of r.events.splice(0)) this.event(e, t);
    if (this.me) { Object.assign(this.me, { x: r.x, y: r.y, z: r.z, ry: r.ry, anim: r.anim }); this.me.phase = r.run; }
    scene.update(Math.max(0, t), dt, r);
    if (this.spectate && this.online) { const o = this.online.leader(); if (o) scene.follow(o.x, o.y, o.z, dt); } else scene.follow(r.x, r.y, r.z, dt, t < 0 ? Math.min(1, -t / 3.2) : 0);
    this.online?.frame(this, t);
    if (!this.done) $('twTime').textContent = fmt(Math.max(0, t));
    const prog = Math.max(0, Math.min(1, r.z / this.course.finish.z)); $('twProgMe').style.insetInlineStart = prog * 100 + '%';
  }
  event(e, t) {
    const r = this.runner;
    switch (e.type) {
      case 'jump': SFX.jump(); break;
      case 'land': if (e.hard) { SFX.land(); buzz(12); } break;
      case 'pad': SFX.pad(); scene.padKick(r.x, r.z); break;
      case 'bounce': SFX.bounce(); break;
      case 'gem': SFX.gem(); scene.burst(r.x, r.y + 1, r.z, '#4fe3ff'); this.hud(); break;
      case 'hit': SFX.hit(); buzz(30); break;
      case 'crack': SFX.crack(); break;
      case 'door': SFX.door(); break;
      case 'fall': SFX.fall(); buzz(60); this.hud(); toast('رجعت لآخر نقطة حفظ'); break;
      case 'checkpoint': { SFX.cp(); const next = this.course.challenges[e.i]; toast(next ? '✓ نقطة حفظ — الجاي: ' + CHALLENGES[next].name : '✓ نقطة حفظ'); break; }
      case 'finish': this.finish(t); break;
    }
  }
  hud() {
    const L = this.level, r = this.runner;
    $('twTitle').textContent = L ? 'المرحلة ' + L.n + ' · ' + L.title : this.online?.title() || 'سباق';
    const gems = $('twGemSlots'); gems.replaceChildren(); gems.hidden = !this.solo;
    for (let i = 0; i < 3; i++) gems.append(el('i', r.gems.has(i) ? 'got' : '', '💎'));
    $('twFalls').textContent = r.falls ? '↓' + r.falls : '';
  }
  finish(t) {
    if (this.done) return; this.done = true; SFX.win(); buzz([20, 40, 20]); scene.burst(this.runner.x, this.runner.y + 2, this.runner.z, '#ffd45a', 60);
    if (this.online) { this.online.finished(); return; }
    const L = this.level, c = this.course, gemsNow = this.runner.gems, before = save.best[L.n], stars = starsFor(c, t, gemsNow.size);
    let earned = 0; const mask = save.gems[L.n] || 0; let newMask = mask; gemsNow.forEach((i) => { if (!(mask & (1 << i))) { earned += 10; newMask |= 1 << i; } });
    if (!before) earned += 15 + Math.floor(L.n / 4);
    if (stars === 3 && (before?.s || 0) < 3) earned += 10;
    const best = { s: Math.max(stars, before?.s || 0), t: Math.min(t, before?.t ?? Infinity) };
    const charsBefore = CHARACTERS.filter(charOpen).length;
    save.best[L.n] = best; save.gems[L.n] = newMask; save.wallet += earned; save.last = Math.min(LEVELS.length, L.n + 1); persist();
    const newChars = CHARACTERS.filter(charOpen).slice(charsBefore);
    setTimeout(() => result({ stars, time: t, earned, best, level: L, gems: gemsNow.size, newChars, record: !before || t < before.t }), 900);
  }
  end() { this.online?.detach(); game = null; }
}
function count(text, go = false) { const c = $('twCount'); c.textContent = text; c.className = 'tw-count on' + (go ? ' go' : ''); clearTimeout(count.timer); count.timer = setTimeout(() => { c.className = 'tw-count'; }, go ? 700 : 850); }

function play(n) {
  const L = levelInfo(n); if (!unlocked(L.n)) { toast('خلّص المرحلة اللي قبلها أول'); return; }
  save.last = L.n; persist(); $('twResult').hidden = true;
  show('twHud'); body.dataset.world = L.world;
  game = new Run({ course: levelCourse(L.n), level: L });
  const first = L.challenges[0]; toast(CHALLENGES[first].name + ': ' + CHALLENGES[first].tip, 3200);
}
function pause() { if (!game?.solo || game.done) return; game.paused = true; $('twPause').hidden = false; }
function resume() { if (game) game.paused = false; $('twPause').hidden = true; }

function result({ stars, time, earned, best, level, gems, newChars, record }) {
  const box = $('twResult'); box.hidden = false;
  $('twResTitle').textContent = stars === 3 ? 'أداء ذهبي!' : stars === 2 ? 'ممتاز!' : 'وصلت القمة!';
  const st = $('twResStars'); st.replaceChildren(); for (let i = 0; i < 3; i++) { const s = el('i', i < stars ? 'on' : '', '★'); s.style.animationDelay = i * 0.18 + 's'; st.append(s); }
  $('twResTime').textContent = fmt(time) + (record ? ' — رقمك الجديد' : '');
  $('twResGems').textContent = gems + ' من 3';
  $('twResEarned').textContent = earned ? '+' + earned + ' 💎' : 'ما فيه جواهر جديدة';
  $('twResGoal').textContent = stars < 3 ? (stars < 2 ? 'النجمتين: خلّصها بأقل من ' + fmt(game.course.par) : 'الثلاث نجوم: أقل من ' + fmt(game.course.gold) + ' مع الجواهر الثلاث') : 'خذت كل نجوم المرحلة';
  $('twResUnlock').textContent = newChars.length ? 'شخصية جديدة انفتحت: ' + newChars.map((c) => c.name).join('، ') : '';
  $('twResNext').hidden = level.n >= LEVELS.length;
  $('twResNext').onclick = () => { game?.end(); play(level.n + 1); };
  $('twResAgain').onclick = () => { game?.end(); play(level.n); };
  $('twResMap').onclick = () => { game?.end(); box.hidden = true; openMap(worldOf(level.n).id); };
  lobby();
}

/* ------------------------------------------------------------------ lobby, map, wardrobe */
function lobby() {
  $('twStars').textContent = totalStars(); $('twGems').textContent = save.wallet; $('twStarMax').textContent = '/' + STAR_MAX;
  const n = nextLevel(), L = levelInfo(n);
  $('twContinue').querySelector('b').textContent = save.best[n] ? 'عيد المرحلة ' + n : 'المرحلة ' + n;
  $('twContinue').querySelector('small').textContent = worldOf(n).name + ' · ' + L.title;
  $('twWorldName').textContent = worldOf(n).name;
}
let mapWorld = null;
function openMap(world) {
  show('twMap'); mapWorld = world || worldOf(nextLevel()).id;
  const tabs = $('twWorldTabs'); tabs.replaceChildren();
  for (const W of WORLDS) {
    const b = el('button', 'tw-world' + (W.id === mapWorld ? ' on' : '')); b.type = 'button'; b.dataset.world = W.id;
    const got = LEVELS.filter((L) => L.world === W.id).reduce((a, L) => a + (save.best[L.n]?.s || 0), 0), max = (W.to - W.from + 1) * 3;
    b.append(el('b', '', W.name), el('small', '', unlocked(W.from) ? got + '/' + max + ' ★' : '🔒'));
    b.onclick = () => openMap(W.id); tabs.append(b);
  }
  const W = WORLDS.find((w) => w.id === mapWorld), grid = $('twLevels'); grid.replaceChildren(); grid.dataset.world = W.id;
  for (const L of LEVELS.filter((l) => l.world === W.id)) {
    const open = unlocked(L.n), best = save.best[L.n], b = el('button', 'tw-level' + (open ? '' : ' locked') + (best ? ' done' : '') + (L.finale ? ' finale' : '') + (L.n === nextLevel() ? ' next' : '')); b.type = 'button';
    b.append(el('b', '', open ? String(L.n) : '🔒'), el('span', 'tw-lv-name', L.title), el('span', 'tw-lv-stars', best ? '★'.repeat(best.s) + '☆'.repeat(3 - best.s) : '☆☆☆'));
    b.setAttribute('aria-label', 'المرحلة ' + L.n + ' ' + L.title + (open ? '' : ' مقفلة'));
    b.onclick = () => (open ? play(L.n) : toast('خلّص المرحلة ' + (L.n - 1) + ' أول'));
    grid.append(b);
  }
  $('twMapInfo').textContent = 'كل مرحلة فيها تحدي مختلف. النجمة الأولى توصلك للقمة، الثانية بوقت أسرع، والثالثة بالوقت الذهبي مع الجواهر الثلاث.';
}
function openWardrobe(tab = 'char') {
  show('twWardrobe'); $('twWardStars').textContent = totalStars() + ' ★'; $('twWardGems').textContent = save.wallet + ' 💎';
  doc.querySelectorAll('#twWardrobe [data-ward-tab]').forEach((b) => b.classList.toggle('on', b.dataset.wardTab === tab));
  const grid = $('twWardGrid'); grid.replaceChildren();
  const refresh = () => { stage(); openWardrobe(tab); };
  if (tab === 'char') for (const c of CHARACTERS) {
    const open = charOpen(c), on = save.look.char === c.id, b = el('button', 'tw-item' + (on ? ' on' : '') + (open ? '' : ' locked')); b.type = 'button';
    const sw = el('i', 'tw-swatch'); sw.style.background = c.pattern === 'sadu' ? 'repeating-linear-gradient(135deg,#b3262c 0 8px,#1d1414 8px 12px,#f4e9d4 12px 16px)' : `radial-gradient(circle at 35% 30%,#fff8,${c.body} 45%,${c.trim})`;
    b.append(sw, el('b', '', c.name), el('small', '', on ? 'لابسها' : open ? 'البسها' : '🔒 ' + c.stars + ' ★'));
    b.onclick = () => { if (!open) { toast('اجمع ' + c.stars + ' نجمة عشان تفتحها'); return; } save.look.char = c.id; persist(); refresh(); };
    grid.append(b);
  } else for (const o of OUTFITS.filter((x) => x.slot === tab)) {
    const owned = save.owned.includes(o.id), on = save.look[tab] === o.id, b = el('button', 'tw-item' + (on ? ' on' : '') + (owned ? '' : ' shop')); b.type = 'button';
    b.append(el('i', 'tw-swatch tw-icon-' + o.id), el('b', '', o.name), el('small', '', on ? 'لابسه' : owned ? 'البسه' : o.price + ' 💎'));
    b.onclick = () => {
      if (!owned) { if (save.wallet < o.price) { toast('تحتاج ' + (o.price - save.wallet) + ' 💎 زيادة. خلّص مراحل واجمع الجواهر'); return; } save.wallet -= o.price; save.owned.push(o.id); toast('صار لك: ' + o.name); SFX.gem(); }
      save.look[tab] = o.id; persist(); refresh();
    };
    grid.append(b);
  }
}

/* ------------------------------------------------------------------ online */
const account = () => { try { return localStorage.getItem('bs_social_session') || ''; } catch { return ''; } };
const guestName = () => { try { return localStorage.getItem('bs-player-name-v33') || ''; } catch { return ''; } };
const MODES = { race: 'سباق', elim: 'إقصاء', teams: 'فرق' };
class TowerOnline {
  constructor() { this.ws = null; this.state = null; this.offset = 0; this.code = ''; this.hostKey = ''; this.token = ''; this.run = null; this.snaps = new Map(); }
  async quick(mode) { const res = await fetch('/api/tower/quick', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode }) }); const d = await res.json().catch(() => ({})); if (!res.ok || !d.code) throw Error(d.error || 'ما قدرنا نلقى سباق الحين'); return this.connect(d.code); }
  async create(mode, capacity) { const res = await fetch('/api/tower/rooms', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode, capacity }) }); const d = await res.json().catch(() => ({})); if (!res.ok || !d.code) throw Error(d.error || 'ما قدرنا نفتح الغرفة'); this.hostKey = d.hostKey; return this.connect(d.code); }
  connect(code) {
    this.close(); this.code = String(code).replace(/\D/g, '').slice(0, 6); this.closed = false;
    try { this.token = sessionStorage.getItem('bs_tower_room:' + this.code) || ''; } catch { this.token = ''; }
    const protocols = ['bs-tower-v1', ...(this.hostKey ? ['hk.' + this.hostKey] : []), ...(this.token ? ['rt.' + this.token] : []), ...(account() ? ['st.' + account()] : [])];
    const name = ($('twName').value || guestName() || 'لاعب').trim().slice(0, 20);
    return new Promise((resolve, reject) => {
      let ok = false; const ws = this.ws = new WebSocket((location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + location.host + '/api/tower/rooms/' + this.code + '/ws?name=' + encodeURIComponent(name) + '&look=' + encodeURIComponent(JSON.stringify(save.look)), protocols);
      const timer = setTimeout(() => { if (!ok) { ws.close(); reject(Error('الغرفة ما ردت، جرّب مرة ثانية')); } }, 9000);
      ws.onmessage = (ev) => { let m; try { m = JSON.parse(ev.data); } catch { return; } if (m.type === 'hello') { ok = true; clearTimeout(timer); this.me = m.id; this.offset = m.now - Date.now(); try { sessionStorage.setItem('bs_tower_room:' + this.code, m.token); } catch { /* private */ } resolve(this); } this.message(m); };
      ws.onclose = (ev) => { clearTimeout(timer); if (!ok) reject(Error(ev.reason || 'الغرفة غير متاحة')); else if (!this.closed) { this.lost(); } };
      ws.onerror = () => {};
    });
  }
  lost() { if (this.closed) return; setTimeout(() => { if (!this.closed && this.code) this.connect(this.code).catch(() => { toast('انقطع الاتصال بالغرفة'); leaveOnline(); }); }, 1200); }
  send(m) { try { if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(m)); } catch { /* closed */ } }
  close() { this.closed = true; try { this.ws?.close(1000, 'bye'); } catch { /* fine */ } this.ws = null; }
  now() { return Date.now() + this.offset; }
  raceTime() { return this.state?.startAt ? (this.now() - this.state.startAt) / 1000 : -3; }
  get myTeam() { const p = this.state?.players?.find((x) => x.id === this.me); return this.state?.mode === 'teams' ? p?.team ?? null : null; }
  title() { const s = this.state; return s ? MODES[s.mode] + (s.mode === 'elim' ? ' · الجولة ' + (s.round + 1) : '') : 'سباق'; }
  leader() { let best = null; for (const [id, p] of this.snaps) if (id !== this.me && (!best || p.z > best.z)) best = p; return best; }
  message(m) {
    if (m.type === 'state') { const prev = this.state; this.state = m.state; this.paint(prev); }
    if (m.type === 'snap' && this.run) for (const row of m.p) { const [id, x, y, z, ry, a] = row; if (id === this.me) continue; this.snaps.set(id, { x, y, z }); scene?.target(id, x, y, z, ry, ['idle', 'run', 'jump', 'fall', 'stun'][a] || 'run'); }
    if (m.type === 'toast') toast(m.text, 2600);
  }
  paint(prev) {
    const s = this.state; if (!s) return;
    const started = s.status === 'playing' && (!prev || prev.status !== 'playing' || prev.round !== s.round);
    if (started) this.begin();
    if (s.status === 'lobby') lobbyView(s, this);
    if (this.run) this.placeHud();
    if (s.status === 'between' || s.status === 'finished') roundView(s, this);
  }
  begin() {
    const s = this.state, players = s.players.length, course = roundCourse(s.seed, s.round, players), slot = Math.max(0, s.players.findIndex((p) => p.id === this.me));
    $('twResult').hidden = true; $('twRound').hidden = true; show('twHud'); body.dataset.world = course.world; body.classList.add('tw-online');
    game?.end?.(); this.paid = false; game = new Run({ course, solo: false, online: this, slot }); this.snaps.clear();
    const me = s.players.find((p) => p.id === this.me);
    if (me?.out) { game.out = true; game.spectate = true; }
    for (const p of s.players) if (p.id !== this.me && !p.out) scene?.addRunner(p.id, p.look || {}, p.name, false, s.mode === 'teams' ? p.team : null);
    toast(MODES[s.mode] + (s.mode === 'elim' ? ': يتأهل أول ' + s.qualify : s.mode === 'teams' ? ': مراكزكم تنجمع للفريق' : ': أول واحد يوصل القمة'), 3000);
  }
  attach(run) { this.run = run; }
  detach() { this.run = null; }
  frame(run, t) { if (t > -0.5 && performance.now() - run.sent > 95 && !run.done) { run.sent = performance.now(); const r = run.runner; this.send({ type: 'pos', x: +r.x.toFixed(2), y: +r.y.toFixed(2), z: +r.z.toFixed(2), ry: +r.ry.toFixed(2), a: ['idle', 'run', 'jump', 'fall', 'stun'].indexOf(r.anim), cp: r.cp }); } }
  finished() { this.send({ type: 'fin' }); toast('وصلت! انتظر الباقين…', 2600); }
  placeHud() {
    const s = this.state, done = s.players.filter((p) => p.fin != null).length;
    $('twFalls').textContent = s.mode === 'elim' ? done + '/' + s.qualify + ' تأهلوا' : done + '/' + s.players.length + ' وصلوا';
    const prog = $('twProgOthers'); prog.replaceChildren();
    for (const [id, p] of this.snaps) { const d = el('i'); d.style.insetInlineStart = Math.max(0, Math.min(1, p.z / (this.run?.course.finish.z || 1))) * 100 + '%'; prog.append(d); }
  }
}
let online = null;
function leaveOnline() { online?.send({ type: 'leave' }); online?.close(); online = null; game?.end?.(); body.classList.remove('tw-online'); $('twRound').hidden = true; show('twOnline'); onlineView(); }
function onlineView() {
  $('twOnlineHome').hidden = false; $('twRoomBox').hidden = true;
  doc.querySelectorAll('#twOnline [data-tw-mode]').forEach((b) => b.classList.toggle('on', b.dataset.twMode === save.mode));
  $('twName').value = $('twName').value || guestName(); $('twNameRow').hidden = Boolean(account());
}
function lobbyView(s, o) {
  show('twOnline'); $('twOnlineHome').hidden = true; $('twRoomBox').hidden = false;
  $('twRoomCode').textContent = s.quick ? 'سباق عام' : s.code; $('twRoomMode').textContent = MODES[s.mode] + ' · ' + s.players.length + '/' + s.capacity;
  const list = $('twRoomPlayers'); list.replaceChildren();
  for (const p of s.players) { const li = el('li', p.id === o.me ? 'me' : ''); const sw = el('i', 'tw-swatch'); const c = CHARACTERS.find((x) => x.id === p.look?.char) || CHARACTERS[0]; sw.style.background = `radial-gradient(circle at 35% 30%,#fff8,${c.body} 45%,${c.trim})`; li.append(sw, el('b', '', p.name), el('small', '', p.host ? 'صاحب الغرفة' : p.ready ? 'جاهز' : '')); if (s.mode === 'teams') li.dataset.team = p.team; list.append(li); }
  const me = s.players.find((p) => p.id === o.me);
  $('twRoomStart').hidden = !me?.host || s.quick; $('twRoomStart').disabled = s.players.length < 2;
  $('twRoomShare').hidden = s.quick;
  $('twRoomNote').textContent = s.quick ? (s.startsIn ? 'السباق يبدأ بعد ' + Math.max(1, Math.ceil((s.startsIn - o.now()) / 1000)) + ' ثانية' : 'ندوّر لك على لاعبين…') : me?.host ? (s.players.length < 2 ? 'ارسل الكود لأصحابك. تقدر تبدأ أول ما يدخل واحد.' : 'اضغط ابدأ لما يكتمل أصحابك') : 'انتظر صاحب الغرفة يبدأ';
  clearTimeout(lobbyView.timer); if (s.quick && s.startsIn) lobbyView.timer = setTimeout(() => o.state?.status === 'lobby' && lobbyView(o.state, o), 500);
}
function roundView(s, o) {
  const box = $('twRound'); box.hidden = false; const me = s.players.find((p) => p.id === o.me);
  const final = s.status === 'finished';
  $('twRoundTitle').textContent = final ? (s.mode === 'teams' ? (s.winnerTeam === me?.team ? 'فاز فريقك!' : 'فاز الفريق الثاني') : me?.place === 1 ? 'أنت البطل!' : 'انتهى السباق') : me?.out ? 'طلعت من السباق' : 'تأهلت للجولة الجاية!';
  const list = $('twRoundList'); list.replaceChildren();
  const rows = s.players.slice().sort((a, b) => (a.place || 99) - (b.place || 99));
  rows.forEach((p) => { const li = el('li', (p.id === o.me ? 'me ' : '') + (p.out ? 'out' : '')); if (s.mode === 'teams') li.dataset.team = p.team; li.append(el('b', '', p.place ? '#' + p.place : '—'), el('span', '', p.name), el('small', '', p.fin != null ? fmt(p.fin) : p.out ? 'طلع' : 'ما وصل'), el('em', '', p.points ? '+' + p.points : '')); list.append(li); });
  $('twRoundNote').textContent = final ? (me?.points ? 'نقاطك للمتصدرين: +' + me.points : '') + (account() ? '' : ' — سجّل دخول عشان تنحسب نقاطك') : 'الجولة الجاية تبدأ بعد شوي';
  const host = s.players.find((p) => p.id === o.me)?.host; $('twRoundAgain').hidden = !final || (!s.quick && !host); $('twRoundAgain').querySelector('b').textContent = s.quick ? 'سباق ثاني' : 'جولة ثانية بنفس الغرفة'; $('twRoundLeave').hidden = false;
  if (final && !o.paid) { o.paid = true; save.wallet += me?.gems || 0; persist(); lobby(); }
}
async function goQuick() {
  try { $('twQuick').disabled = true; online = new TowerOnline(); await online.quick(save.mode); }
  catch (e) { toast(e.message || 'ما قدرنا نوصل للسيرفر'); online = null; } finally { $('twQuick').disabled = false; }
}

/* ------------------------------------------------------------------ leaderboard */
async function openBoard(period = 'week') {
  show('twBoard'); doc.querySelectorAll('#twBoard [data-tw-board]').forEach((b) => b.classList.toggle('on', b.dataset.twBoard === period));
  const list = $('twBoardList'); list.replaceChildren(el('li', 'tw-empty', 'نحمّل الترتيب…'));
  try {
    const res = await fetch('/api/tower/board?period=' + period, { headers: account() ? { authorization: 'Bearer ' + account() } : {} }); const d = await res.json();
    list.replaceChildren();
    if (!d.rows?.length) list.append(el('li', 'tw-empty', period === 'week' ? 'ما أحد لعب هالأسبوع للحين. كن أول واحد!' : 'الترتيب فاضي للحين'));
    d.rows?.forEach((r, i) => { const li = el('li', r.me ? 'me' : ''); li.append(el('b', '', i < 3 ? ['🥇', '🥈', '🥉'][i] : String(i + 1)), el('span', '', r.name), el('small', '', r.wins + ' فوز'), el('em', '', r.points + ' نقطة')); list.append(li); });
    $('twBoardMe').textContent = d.me ? 'ترتيبك: ' + d.me.rank + ' · ' + d.me.points + ' نقطة' : account() ? 'العب سباقات أونلاين عشان تدخل الترتيب' : 'سجّل دخول والعب أونلاين عشان يطلع اسمك هنا';
  } catch { list.replaceChildren(el('li', 'tw-empty', 'ما قدرنا نحمّل الترتيب. تأكد من النت.')); }
}

/* ------------------------------------------------------------------ wiring */
$('twContinue').onclick = () => play(nextLevel());
$('twMapBtn').onclick = () => openMap();
$('twWardrobeBtn').onclick = () => openWardrobe();
$('twOnlineBtn').onclick = () => { show('twOnline'); onlineView(); };
$('twBoardBtn').onclick = () => openBoard();
doc.querySelectorAll('.tw-app [data-back]').forEach((b) => { b.onclick = () => { if (b.closest('#twOnline') && online) { leaveOnline(); } show('twLobby'); lobby(); }; });
doc.querySelectorAll('#twWardrobe [data-ward-tab]').forEach((b) => { b.onclick = () => openWardrobe(b.dataset.wardTab); });
doc.querySelectorAll('#twBoard [data-tw-board]').forEach((b) => { b.onclick = () => openBoard(b.dataset.twBoard); });
doc.querySelectorAll('#twOnline [data-tw-mode]').forEach((b) => { b.onclick = () => { save.mode = b.dataset.twMode; persist(); onlineView(); }; });
$('twQuick').onclick = goQuick;
$('twCreate').onclick = async () => { try { online = new TowerOnline(); await online.create(save.mode, Number($('twCapacity').value) || 8); } catch (e) { toast(e.message); online = null; } };
$('twJoin').onclick = async () => { const code = $('twCode').value.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 1632)).replace(/\D/g, ''); if (code.length !== 6) { toast('الكود ستة أرقام'); return; } try { online = new TowerOnline(); await online.connect(code); } catch (e) { toast(e.message); online = null; } };
$('twRoomStart').onclick = () => online?.send({ type: 'start' });
$('twRoomShare').onclick = async () => { const url = location.origin + '/tower?room=' + online?.code; try { if (navigator.share) await navigator.share({ title: 'برج التحديات', text: 'تعال سابقني في برج التحديات! الكود ' + online?.code, url }); else { await navigator.clipboard.writeText(url); toast('نسخنا الرابط'); } } catch { /* cancelled */ } };
$('twRoomLeave').onclick = leaveOnline;
$('twRoundLeave').onclick = leaveOnline;
$('twRoundAgain').onclick = () => { if (online?.state && !online.state.quick) { online.send({ type: 'start' }); return; } leaveOnline(); goQuick(); };
$('twPauseBtn').onclick = () => (game?.solo ? pause() : null);
$('twResume').onclick = resume;
$('twRestart').onclick = () => { resume(); const n = game?.level?.n; game?.end(); if (n) play(n); };
$('twQuit').onclick = () => { resume(); game?.end(); show('twLobby'); lobby(); };
$('twSound').onclick = () => { save.sound = !save.sound; persist(); $('twSound').textContent = save.sound ? '🔊 الصوت شغال' : '🔇 الصوت مطفي'; };
$('twSound').textContent = save.sound ? '🔊 الصوت شغال' : '🔇 الصوت مطفي';
$('twResClose').onclick = () => { $('twResult').hidden = true; game?.end(); show('twLobby'); lobby(); };
doc.addEventListener('visibilitychange', () => { if (doc.hidden && game?.solo && !game.done) pause(); });

// an invite link opens its room straight away
const params = new URLSearchParams(location.search), invite = (params.get('room') || '').replace(/\D/g, '');
show('twLobby'); lobby();
if (invite.length === 6) { show('twOnline'); onlineView(); online = new TowerOnline(); online.connect(invite).catch((e) => { toast(e.message); online = null; }); }
globalThis.BS_TOWER = Object.freeze({ play, openMap, levels: LEVELS.length, get state() { return { level: game?.level?.n || null, t: game ? game.clock() : null, runner: game ? { x: game.runner.x, y: game.runner.y, z: game.runner.z, cp: game.runner.cp, falls: game.runner.falls, finished: game.runner.finished } : null }; } });
