// Turbo Kart — page controller: menu, input, audio, HUD, effects and the result screen.
import { TRACKS, buildTrack, minimapPoints, segIndex } from './track.js';
import { createRace, step, useItem, standings, KART_COLORS, ITEM_NAMES, MAX_SPEED } from './sim.js';
import { createRenderer } from './render.js';

const $ = (id) => document.getElementById(id);
const KEY = 'bs_turbo_v1';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
const save = (patch) => { try { localStorage.setItem(KEY, JSON.stringify({ ...load(), ...patch })); } catch { /* private mode */ } };
const fmt = (s) => { if (!isFinite(s)) return '—'; const m = Math.floor(s / 60), r = s - m * 60; return String(m).padStart(2, '0') + ':' + r.toFixed(2).padStart(5, '0'); };
const ICONS = { turbo: '⚡', shield: '🛡️', rocket: '🚀', oil: '🛢️' };

const prefs = Object.assign({ track: 'dunes', difficulty: 'mid', color: KART_COLORS[0], best: {}, stars: {}, muted: false }, load());
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- audio (all synthesised) ----------
const audio = (() => {
  let ac = null, master = null, eng = null, noiseBuf = null;
  const init = () => {
    if (ac) { ac.resume?.(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ac = new AC(); master = ac.createGain(); master.gain.value = prefs.muted ? 0 : 0.9; master.connect(ac.destination);
    const o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
    o.type = 'sawtooth'; f.type = 'lowpass'; f.frequency.value = 500; g.gain.value = 0; o.connect(f); f.connect(g); g.connect(master); o.start();
    eng = { o, f, g };
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  };
  const tone = (freq, dur, type = 'square', vol = 0.1, slide = 0, delay = 0) => {
    if (!ac) return; const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  };
  const noise = (dur, from, to, vol = 0.18) => {
    if (!ac) return; const t = ac.currentTime, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; f.type = 'bandpass'; f.Q.value = 0.9; f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.02);
  };
  return {
    init, tone, noise,
    engine(frac, boost, on) { if (!eng) return; const t = ac.currentTime; eng.o.frequency.setTargetAtTime(52 + frac * 175 + (boost ? 34 : 0), t, 0.05); eng.f.frequency.setTargetAtTime(330 + frac * 1500, t, 0.08); eng.g.gain.setTargetAtTime(on ? 0.05 : 0, t, 0.12); },
    mute(m) { prefs.muted = m; save({ muted: m }); if (master) master.gain.value = m ? 0 : 0.9; },
    suspend() { ac?.suspend?.(); }, resume() { ac?.resume?.(); },
    sfx: {
      count: () => tone(440, 0.16, 'square', 0.1), go: () => { tone(880, 0.4, 'square', 0.12); tone(1320, 0.4, 'triangle', 0.08, 0, 0.02); },
      pickup: () => { tone(660, 0.09, 'triangle', 0.12); tone(990, 0.12, 'triangle', 0.12, 0, 0.08); },
      boost: () => noise(0.7, 500, 2600, 0.22), mini: (l) => { noise(0.5, 400, 2200 + l * 600, 0.2); tone(520 + l * 140, 0.18, 'sawtooth', 0.08, 300); },
      level: (l) => tone(500 + l * 220, 0.12, 'sine', 0.12), hit: () => { tone(120, 0.35, 'sawtooth', 0.2, -70); noise(0.3, 900, 120, 0.2); },
      pop: () => tone(900, 0.2, 'sine', 0.12, -500), rocket: () => noise(0.45, 1800, 500, 0.15), oil: () => tone(200, 0.2, 'sine', 0.1, -100),
      lap: () => { tone(784, 0.12, 'triangle', 0.12); tone(1047, 0.2, 'triangle', 0.12, 0, 0.1); },
      win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.3, 'triangle', 0.13, 0, i * 0.11)),
      lose: () => [392, 330, 262].forEach((f, i) => tone(f, 0.3, 'triangle', 0.1, 0, i * 0.16)),
    },
  };
})();

// ---------- menu ----------
function trackArt(canvas, def) {
  const c = canvas.getContext('2d'), w = canvas.width = 420, h = canvas.height = 184, th = def.theme;
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, th.skyTop); g.addColorStop(0.55, th.skyMid); g.addColorStop(1, th.skyLow); c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.fillStyle = th.grass[0]; c.fillRect(0, h * 0.62, w, h);
  c.fillStyle = th.far[0]; c.beginPath(); c.moveTo(0, h * 0.62); for (let x = 0; x <= w; x += 20) c.lineTo(x, h * (0.5 - 0.08 * Math.sin(x * 0.03 + def.id.length) - 0.04 * Math.sin(x * 0.11))); c.lineTo(w, h * 0.62); c.fill();
  const pts = minimapPoints(buildTrack(def)); c.lineJoin = 'round'; c.lineCap = 'round';
  const path = () => { c.beginPath(); pts.forEach(([x, y], i) => { const px = w - (28 + x * (w * 0.34)) - 14, py = 16 + y * (h - 32); i ? c.lineTo(px, py) : c.moveTo(px, py); }); c.closePath(); };
  path(); c.strokeStyle = '#0008'; c.lineWidth = 9; c.stroke(); path(); c.strokeStyle = th.rumble[1]; c.lineWidth = 6; c.stroke(); path(); c.strokeStyle = th.road[0]; c.lineWidth = 3.4; c.stroke();
}
function renderMenu() {
  const wrap = $('tracks'); wrap.innerHTML = '';
  for (const def of TRACKS) {
    const b = document.createElement('button'); b.className = 'tk'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(prefs.track === def.id)); b.dataset.id = def.id;
    const cv = document.createElement('canvas'); trackArt(cv, def); b.appendChild(cv);
    const stars = prefs.stars[def.id] || 0, best = prefs.best[def.id];
    const meta = document.createElement('div'); meta.className = 'meta';
    meta.innerHTML = `<b></b><small></small><div class="best"><span>${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span><span>${best ? 'أسرع لفة ' + fmt(best) : 'بدون رقم'}</span></div>`;
    meta.querySelector('b').textContent = def.name; meta.querySelector('small').textContent = def.blurb; b.appendChild(meta);
    b.onclick = () => { prefs.track = def.id; save({ track: def.id }); renderMenu(); }; wrap.appendChild(b);
  }
  document.querySelectorAll('#diff button').forEach((b) => { b.setAttribute('aria-checked', String(b.dataset.v === prefs.difficulty)); b.onclick = () => { prefs.difficulty = b.dataset.v; save({ difficulty: b.dataset.v }); renderMenu(); }; });
  const sw = $('colors'); sw.innerHTML = '';
  for (const col of KART_COLORS) { const b = document.createElement('button'); b.className = 'sw'; b.style.background = col; b.setAttribute('role', 'radio'); b.setAttribute('aria-label', 'لون ' + col); b.setAttribute('aria-checked', String(col === prefs.color)); b.onclick = () => { prefs.color = col; save({ color: col }); renderMenu(); }; sw.appendChild(b); }
  $('muteBtn').textContent = prefs.muted ? '🔇' : '🔊'; $('muteBtn').setAttribute('aria-pressed', String(prefs.muted));
}
$('muteBtn').onclick = () => { audio.mute(!prefs.muted); renderMenu(); };

// ---------- the race ----------
const road = $('road'), fx = $('fx'), mini = $('mini');
const renderer = createRenderer(road), fctx = fx.getContext('2d'), mctx = mini.getContext('2d');
let race = null, track = null, running = false, paused = false, raf = 0, last = 0, perf = 1, perfT = 0, perfN = 0, shake = 0, toastT = 0, miniBase = null, miniPts = null, resultShown = false;
const parts = [];
const keys = { l: false, r: false, brake: false, drift: false }, touch = { l: false, r: false, brake: false, drift: false };

function sizeCanvases() {
  const g = $('game'), cw = g.clientWidth, ch = g.clientHeight; if (!cw) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5), k = Math.min(1, 1280 / (cw * dpr)) * perf * dpr;
  renderer.resize(Math.max(320, Math.round(cw * k)), Math.max(180, Math.round(ch * k)));
  fx.width = cw; fx.height = ch;
}
addEventListener('resize', () => { if (running) sizeCanvases(); });

function buildMini() {
  miniPts = minimapPoints(track); const c = document.createElement('canvas'); c.width = mini.width; c.height = mini.height; const x = c.getContext('2d'), S = mini.width;
  const path = () => { x.beginPath(); miniPts.forEach(([px, py], i) => { const X = 12 + px * (S - 24), Y = 12 + py * (S - 24); i ? x.lineTo(X, Y) : x.moveTo(X, Y); }); x.closePath(); };
  x.lineJoin = 'round'; x.lineCap = 'round'; path(); x.strokeStyle = '#000a'; x.lineWidth = 9; x.stroke(); path(); x.strokeStyle = '#ffffff55'; x.lineWidth = 6; x.stroke(); path(); x.strokeStyle = track.theme.rumble[1]; x.lineWidth = 3; x.stroke();
  miniBase = c;
}

function startRace() {
  audio.init(); audio.resume();
  const def = TRACKS.find((t) => t.id === prefs.track) || TRACKS[0];
  track = buildTrack(def, 7); race = createRace({ track, difficulty: prefs.difficulty, color: prefs.color, laps: 3, seed: (Date.now() & 0xffff) + 1 });
  $('menu').hidden = true; $('game').hidden = false; $('results').hidden = true; $('pause').hidden = true;
  parts.length = 0; shake = 0; resultShown = false; paused = false; running = true; perf = 1;
  buildMini(); sizeCanvases(); $('count').textContent = ''; $('posOf').textContent = '/' + race.karts.length; updateHud(true);
  cancelAnimationFrame(raf); last = performance.now(); raf = requestAnimationFrame(loop);
}
function toMenu() { running = false; cancelAnimationFrame(raf); audio.engine(0, false, false); $('game').hidden = true; $('menu').hidden = false; renderMenu(); }

// ---------- input ----------
const steerVal = () => ((keys.r || touch.r) ? 1 : 0) - ((keys.l || touch.l) ? 1 : 0);
const KEYMAP = { ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', ArrowDown: 'brake', KeyS: 'brake', Space: 'drift', ShiftLeft: 'drift', ShiftRight: 'drift' };
addEventListener('keydown', (e) => {
  if (!running) return;
  if (KEYMAP[e.code]) { keys[KEYMAP[e.code]] = true; e.preventDefault(); }
  if (['KeyE', 'Enter', 'ControlLeft', 'ArrowUp', 'KeyW'].includes(e.code) && !e.repeat) { fireItem(); e.preventDefault(); }
  if (['Escape', 'KeyP'].includes(e.code) && !e.repeat) setPaused(!paused);
});
addEventListener('keyup', (e) => { if (KEYMAP[e.code]) keys[KEYMAP[e.code]] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; for (const k in touch) touch[k] = false; if (running && !resultShown) setPaused(true); });
document.addEventListener('visibilitychange', () => { if (document.hidden && running && !resultShown) setPaused(true); });
function bindPad(id, key) {
  const el = $(id), down = (e) => { e.preventDefault(); touch[key] = true; el.classList.add('down'); try { el.setPointerCapture(e.pointerId); } catch { /* old webview */ } }, up = () => { touch[key] = false; el.classList.remove('down'); };
  el.addEventListener('pointerdown', down); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up); el.addEventListener('contextmenu', (e) => e.preventDefault());
}
bindPad('bL', 'l'); bindPad('bR', 'r'); bindPad('bBrake', 'brake'); bindPad('bDrift', 'drift');
function fireItem() { if (race && race.phase === 'racing' && useItem(race, race.player)) updateHud(true); }
$('itemBtn').addEventListener('pointerdown', (e) => { e.preventDefault(); fireItem(); });
function setPaused(p) { if (!running || resultShown || (race && race.phase === 'countdown' && p)) return; paused = p; $('pause').hidden = !p; if (p) { audio.engine(0, false, false); audio.suspend(); } else { audio.resume(); last = performance.now(); } }
$('pauseBtn').onclick = () => setPaused(true); $('resumeBtn').onclick = () => setPaused(false);
$('restartBtn').onclick = startRace; $('quitBtn').onclick = toMenu; $('startBtn').onclick = startRace;
$('againBtn').onclick = startRace; $('menuBtn').onclick = toMenu;
$('nextBtn').onclick = () => { const i = TRACKS.findIndex((t) => t.id === prefs.track); prefs.track = TRACKS[(i + 1) % TRACKS.length].id; save({ track: prefs.track }); startRace(); };

// ---------- effects ----------
function spark(x, y, vx, vy, life, color, size) { if (parts.length < 400) parts.push({ x, y, vx, vy, life, max: life, color, size }); }
function confetti(n, fromTop) {
  const cols = ['#f6d98a', '#7df0c9', '#ff4fd8', '#7df9ff', '#ffffff', '#ff9f43'], W = fx.width, H = fx.height;
  for (let i = 0; i < n; i++) parts.push({ x: Math.random() * W, y: fromTop ? -20 - Math.random() * 120 : H * 0.6, vx: (Math.random() - 0.5) * 220, vy: fromTop ? 80 + Math.random() * 220 : -300 - Math.random() * 420, life: 3.2 + Math.random() * 1.8, max: 5, color: cols[i % cols.length], size: 5 + Math.random() * 7, g: 380, rot: Math.random() * 6, spin: (Math.random() - 0.5) * 12, conf: true });
}
function drawParts(dt) {
  fctx.clearRect(0, 0, fx.width, fx.height);
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.life -= dt; if (p.life <= 0) { parts.splice(i, 1); continue; }
    p.vy += (p.g || 0) * dt; p.x += p.vx * dt; p.y += p.vy * dt; fctx.globalAlpha = Math.min(1, p.life / p.max * 2); fctx.fillStyle = p.color;
    if (p.conf) { p.rot += p.spin * dt; fctx.save(); fctx.translate(p.x, p.y); fctx.rotate(p.rot); fctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); fctx.restore(); }
    else { fctx.beginPath(); fctx.arc(p.x, p.y, p.size * (0.4 + 0.6 * p.life / p.max), 0, 6.3); fctx.fill(); }
  }
  fctx.globalAlpha = 1;
}
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.remove('show'); void t.offsetWidth; t.classList.add('show'); }
const buzz = (ms) => { try { navigator.vibrate?.(ms); } catch { /* no haptics */ } };

function handleEvents(view) {
  for (const e of race.events) {
    const mine = e.id === 'p';
    if (e.type === 'count') { const c = $('count'); c.className = 'count pop'; c.textContent = String(e.n); void c.offsetWidth; audio.sfx.count(); }
    else if (e.type === 'go') { const c = $('count'); c.className = 'count pop go'; c.textContent = 'انطلق!'; audio.sfx.go(); buzz(30); }
    else if (e.type === 'pickup' && mine) { audio.sfx.pickup(); updateHud(true); }
    else if (e.type === 'boost' && mine) { audio.sfx.boost(); if (e.why === 'pad') toast('دفعة سرعة!'); else toast('تيربو!'); buzz(25); }
    else if (e.type === 'mini-turbo') { audio.sfx.mini(e.level); toast('انجراف ⚡'.concat(' ', ['', 'أزرق', 'برتقالي', 'بنفسجي'][e.level])); buzz(20); }
    else if (e.type === 'drift-level') audio.sfx.level(e.level);
    else if (e.type === 'spin' && mine) { audio.sfx.hit(); toast(e.cause === 'oil' ? 'انزلقت على الزيت!' : 'أصابك صاروخ!'); shake = reduced ? 0 : 16; buzz(120); }
    else if (e.type === 'shield-pop' && mine) { audio.sfx.pop(); toast('الدرع حماك!'); }
    else if (e.type === 'shield' && mine) { audio.sfx.pop(); toast('درع مفعّل'); }
    else if (e.type === 'rocket') audio.sfx.rocket(); else if (e.type === 'oil' && mine) audio.sfx.oil();
    else if (e.type === 'bump' && mine) { audio.sfx.hit(); shake = reduced ? 0 : (e.hard ? 12 : 6); buzz(40); }
    else if (e.type === 'lap') { audio.sfx.lap(); toast(e.time <= e.best + 0.001 ? `أسرع لفة ${fmt(e.time)}` : `اللفة ${Math.min(race.laps, e.lap + 1)} من ${race.laps}`); }
    else if (e.type === 'finish' && e.isPlayer) { toast('انتهيت!'); (e.order <= 3 ? audio.sfx.win : audio.sfx.lose)(); if (e.order <= 3 && !reduced) confetti(e.order === 1 ? 110 : 60, true); buzz(200); }
    else if (e.type === 'results') showResults();
  }
}

// ---------- HUD ----------
const hudCache = {};
const setText = (id, v) => { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } };
function updateHud(force) {
  const p = race.player, view = { force };
  setText('pos', String(p.place)); setText('lapTxt', `اللفة ${Math.min(race.laps, Math.max(1, p.lap + 1))}/${race.laps}`); setText('timeTxt', fmt(race.time));
  setText('spd', String(Math.round(p.speed / MAX_SPEED * 220)));
  const item = p.item; setText('itemIcon', item ? ICONS[item] : '·'); setText('itemName', item ? ITEM_NAMES[item] : 'فارغ'); $('itemBtn').classList.toggle('ready', !!item);
  const db = $('driftBar'); db.classList.toggle('on', p.drift.on); if (p.drift.on) [...db.children].forEach((el, i) => { el.className = p.drift.level > i ? 'f' + p.drift.level : (i === 0 ? 'f0' : ''); });
  mctx.clearRect(0, 0, mini.width, mini.height); mctx.drawImage(miniBase, 0, 0); const S = mini.width;
  for (const k of race.karts.slice().sort((a, b) => a.isPlayer - b.isPlayer)) {
    const i = segIndex(track, k.z), [px, py] = miniPts[i]; mctx.fillStyle = k.isPlayer ? '#ffffff' : k.color; mctx.strokeStyle = '#000b'; mctx.lineWidth = 2;
    mctx.beginPath(); mctx.arc(12 + px * (S - 24), 12 + py * (S - 24), k.isPlayer ? 6.5 : 4.5, 0, 6.3); mctx.stroke(); mctx.fill();
    if (k.isPlayer) { mctx.strokeStyle = k.color; mctx.lineWidth = 2.5; mctx.stroke(); }
  }
}

// ---------- results ----------
function showResults() {
  if (resultShown) return; resultShown = true;
  const rows = standings(race), mine = rows.findIndex((k) => k.isPlayer) + 1, p = race.player;
  const titles = ['', 'المركز الأول! 🏆', 'المركز الثاني', 'المركز الثالث'];
  $('resTitle').textContent = titles[mine] || `المركز ${mine}`; $('resEyebrow').textContent = mine === 1 ? 'فزت بالسباق' : 'نتيجة السباق';
  const stars = mine === 1 ? 3 : mine <= 3 ? 2 : mine === 4 ? 1 : 0, bestLap = p.bestLap, oldBest = prefs.best[track.id], record = isFinite(bestLap) && (!oldBest || bestLap < oldBest);
  prefs.stars[track.id] = Math.max(prefs.stars[track.id] || 0, stars); if (record) prefs.best[track.id] = bestLap; save({ stars: prefs.stars, best: prefs.best });
  $('podium').innerHTML = [1, 0, 2].filter((i) => rows[i]).map((i) => `<div class="pod p${i + 1}${rows[i].isPlayer ? ' me' : ''}" role="listitem" style="--i:${i}"><div class="k" style="background:${rows[i].color}"></div><b></b><em>${i + 1}</em><div class="bar"></div></div>`).join('');
  [...$('podium').children].forEach((el, n) => { const i = [1, 0, 2].filter((j) => rows[j])[n]; el.querySelector('b').textContent = rows[i].name; });
  $('resMine').innerHTML = `وقتك <strong>${fmt(p.finishTime)}</strong> · أسرع لفة <strong>${fmt(bestLap)}</strong>${record ? ' · رقم جديد!' : ''}`;
  $('stars').innerHTML = [0, 1, 2].map((i) => `<span class="${i < stars ? 'on' : ''}" style="animation-delay:${0.5 + i * 0.18}s">★</span>`).join('');
  const list = $('resList'); list.innerHTML = '';
  rows.forEach((k, i) => { const li = document.createElement('li'); if (k.isPlayer) li.className = 'me'; li.innerHTML = `<span class="n">${i + 1}</span><i class="sw2" style="background:${k.color}"></i><span></span><span class="t">${k.finished ? fmt(k.finishTime) : 'لم ينهِ'}</span>`; li.children[2].textContent = k.name; list.appendChild(li); });
  setTimeout(() => { $('results').hidden = false; if (mine <= 3 && !reduced) confetti(mine === 1 ? 140 : 70, true); }, 900);
}

// ---------- the loop ----------
function loop(now) {
  raf = requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (paused || !running) return;
  const input = { steer: steerVal(), gas: !(keys.brake || touch.brake), brake: keys.brake || touch.brake, drift: keys.drift || touch.drift };
  step(race, dt, input);
  const p = race.player, sp = p.speed / MAX_SPEED;
  const view = { time: now / 1000, shake: shake, boost: reduced ? 0 : Math.min(1, p.boost > 0 ? 0.35 + Math.min(p.boost, 1) * 0.65 : 0), brake: input.brake && p.speed > 100 };
  shake = Math.max(0, shake - dt * 40);
  renderer.draw(race, view);
  handleEvents(view);
  // drift sparks and exhaust fire sit on the player's kart
  const kx = view.kart ? (view.kart.x / renderer.size.W) * fx.width : fx.width / 2, ky = view.kart ? (view.kart.y / renderer.size.H) * fx.height : fx.height * 0.95, kw = view.kart ? (view.kart.w / renderer.size.W) * fx.width : 120;
  if (p.drift.on && !reduced) { const col = ['#ffffff', '#4dc3ff', '#ff9f1c', '#d36bff'][p.drift.level]; for (let i = 0; i < 2; i++) { const side = p.drift.dir > 0 ? -1 : 1; spark(kx + side * kw * 0.38, ky - kw * 0.04, side * (40 + Math.random() * 160), -80 - Math.random() * 180, 0.35 + Math.random() * 0.25, col, 3 + Math.random() * 3); } }
  if (p.boost > 0 && !reduced) for (let i = 0; i < 2; i++) spark(kx + (Math.random() < 0.5 ? -1 : 1) * kw * 0.2, ky - kw * 0.1, (Math.random() - 0.5) * 80, 80 + Math.random() * 160, 0.3, Math.random() < 0.5 ? '#ffb02e' : '#fff3a0', 4 + Math.random() * 4);
  drawParts(dt);
  updateHud(false);
  audio.engine(sp, p.boost > 0, race.phase === 'racing' || race.phase === 'finished');
  // keep the frame rate: draw fewer pixels on a slow phone
  perfT += dt; perfN++; if (perfT > 1.2) { const avg = perfT / perfN; if (avg > 0.027 && perf > 0.55) { perf = Math.max(0.55, perf - 0.15); sizeCanvases(); } else if (avg < 0.0185 && perf < 1) { perf = Math.min(1, perf + 0.1); sizeCanvases(); } perfT = 0; perfN = 0; }
}

renderMenu();
if (location.search.includes('debug')) window.__turbo = { get race() { return race; }, start: startRace, prefs, keys, touch, setPerf(v) { perf = v; sizeCanvases(); } };
