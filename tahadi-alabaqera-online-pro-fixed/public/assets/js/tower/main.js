/* لعبة العباقرة 33.19.0 — «برج التحديات».
   A hundred levels on your own (no waiting), and races for 2 to 8 in public or private rooms:
   سباق (first to the top), إقصاء (rounds until one is left) and فرق (two teams add up their places).
   Stars and gems unlock characters and outfits; progress is kept on this device. */
import { LEVELS, WORLDS, CHALLENGES, levelInfo, levelCourse, roundCourse, buildCourse, worldOf, worldById, starsFor, STAR_MAX, dailyLevel, dailyCourse, dayKey, nextDayAt, seasonOf, seasonLevel, seasonCourse, sectionName, sectionTip } from './course.js?v=33.19.0';
import { TowerAudio } from './audio.js?v=33.19.0';
import { SEASONS } from './course.js?v=33.19.0';
const SEASON_NAMES = Object.freeze(Object.fromEntries(SEASONS.map((x) => [x.id, x.name])));
import { Runner } from './physics.js?v=33.19.0';
import { TowerScene, CHARACTERS, OUTFITS } from './scene.js?v=33.19.0';

const doc = document, $ = (id) => doc.getElementById(id), body = doc.body;
const el = (tag, cls, text) => { const n = doc.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
const fmt = (s) => { s = Math.max(0, s); const m = Math.floor(s / 60), r = s - m * 60; return (m ? m + ':' + String(Math.floor(r)).padStart(2, '0') : Math.floor(r)) + '.' + Math.floor((r % 1) * 10); };

/* ------------------------------------------------------------------ saved progress */
const SAVE = 'bs-tower-v1';
const fresh = () => ({ v: 1, best: {}, gems: {}, wallet: 0, owned: ['none', 'noface'], look: { char: 'zafran', hat: 'none', face: 'noface' }, last: 1, mode: 'race', sound: true, music: true, ghost: true, gfx: 'auto', daily: {}, season: {} });
let save = (() => { try { const s = JSON.parse(localStorage.getItem(SAVE) || 'null'); if (s?.v === 1) return { ...fresh(), ...s, look: { ...fresh().look, ...s.look } }; } catch { /* private mode */ } return fresh(); })();
const persist = () => { try { localStorage.setItem(SAVE, JSON.stringify(save)); } catch { /* full or private */ } };
const totalStars = () => Object.values(save.best).reduce((a, b) => a + (b.s || 0), 0);
const unlocked = (n) => n === 1 || Boolean(save.best[n - 1]);
const nextLevel = () => { for (const L of LEVELS) if (!save.best[L.n]) return L.n; return LEVELS.length; };
// 33.18.1: the owner's account has every character and outfit open
const isOwner = () => { try { return globalThis.BS_SOCIAL?.profile?.()?.role === 'owner'; } catch { return false; } };
const charOpen = (c) => isOwner() || totalStars() >= c.stars;
const hasOutfit = (id) => isOwner() || save.owned.includes(id);

/* ------------------------------------------------------------------ sound (33.19.0: music per world, layered effects) */
const audio = new TowerAudio(); audio.music = save.music !== false; audio.sfx = save.sound !== false;
const SFX = new Proxy({}, { get: (_, name) => () => audio.fx(name) });
let heard = false; addEventListener('pointerdown', () => { if (heard) return; heard = true; audio.ensure(); if (!game) audio.play(worldOf(save.last || 1).id); }, { capture: true });
doc.addEventListener('visibilitychange', () => { if (doc.hidden) audio.stop(); else if (heard) audio.play(game?.course.world || worldOf(save.last || 1).id); });
const buzz = (ms) => { try { navigator.vibrate?.(ms); } catch { /* not allowed */ } };

/* ------------------------------------------------------------------ screens */
const screens = ['twLobby', 'twMap', 'twWardrobe', 'twOnline', 'twBoard', 'twHud', 'twDaily', 'twSeason'];
let current = null;
function show(id) { if (current === id && (id === 'twHud') === (game !== null)) return; current = id; for (const s of screens) $(s).hidden = s !== id; body.classList.toggle('tw-playing', id === 'twHud'); if (id !== 'twHud') stage(); }
function toast(text, ms = 1800) { const t = $('twToast'); t.textContent = text; t.classList.add('on'); clearTimeout(toast.timer); toast.timer = setTimeout(() => t.classList.remove('on'), ms); }

/* ------------------------------------------------------------------ the 3D view */
let scene = null, game = null, last = performance.now(), showcase = null;
try { scene = new TowerScene($('twCanvas')); } catch { body.classList.add('tw-no3d'); }
queueMicrotask(() => applyQuality());
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
    else if (showcase) { showcase.a += dt * 0.35; const t = now / 1000; scene.update(t, dt, null); const c = scene.camera; if (showcase.view === 'ward') { c.position.set(Math.sin(showcase.a) * 0.6, 0.95, 2.2 - 5.6); c.lookAt(0, -1.05, 2.2); } else { c.position.set(Math.sin(showcase.a) * 0.8, 2.1, 2.2 - 4.4); c.lookAt(0, 1.25, 2.2); } showcase.r.ry = Math.PI + Math.sin(showcase.a * 1.7) * 0.45; showcase.r.anim = 'idle'; }
    scene.render();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* ------------------------------------------------------------------ input */
const input = { x: 0, z: 0, jump: false, dash: false, keys: new Set() };
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
  $('twDash').addEventListener('pointerdown', (e) => { e.preventDefault(); input.dash = true; $('twDash').classList.add('down'); setTimeout(() => $('twDash').classList.remove('down'), 160); });
  const keyAxis = () => { const k = input.keys; input.x = (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0) - (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0); input.z = (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0) - (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0); };
  addEventListener('keydown', (e) => { if (!game) return; if (e.code === 'Space') { input.jump = true; e.preventDefault(); } else if (e.code === 'KeyE' || e.code === 'ShiftLeft') { input.dash = true; } else if (/^(Arrow|Key[WASD])/.test(e.code)) { input.keys.add(e.code); keyAxis(); e.preventDefault(); } else if (e.code === 'Escape' && game?.solo) pause(); });
  addEventListener('keyup', (e) => { if (input.keys.delete(e.code)) keyAxis(); });
})();

/* ------------------------------------------------------------------ a run (solo or online) */
/* ------------------------------------------------------------------ 33.19.0: the ghost of your best run */
// ten samples a second: x, y, z, facing, pose; kept per level as Int16 in base64 (a few KB each)
const POSES = ['idle', 'run', 'jump', 'fall', 'stun', 'dash'];
const GHOSTS = 'bs-tower-ghost-v1:';
function packGhost(rows) { const a = new Int16Array(rows.length * 5); rows.forEach((r, i) => { a[i * 5] = Math.round(r[0] * 100); a[i * 5 + 1] = Math.round(r[1] * 100); a[i * 5 + 2] = Math.round(r[2] * 50); a[i * 5 + 3] = Math.round(Math.atan2(Math.sin(r[3]), Math.cos(r[3])) * 1000); a[i * 5 + 4] = r[4]; }); let bin = ''; const u = new Uint8Array(a.buffer); for (let i = 0; i < u.length; i++) bin += String.fromCharCode(u[i]); return btoa(bin); }
function unpackGhost(text) { try { const bin = atob(text), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); const a = new Int16Array(u.buffer), rows = []; for (let i = 0; i + 4 < a.length; i += 5) rows.push([a[i] / 100, a[i + 1] / 100, a[i + 2] / 50, a[i + 3] / 1000, a[i + 4]]); return rows; } catch { return null; } }
function loadGhost(key) { try { const g = JSON.parse(localStorage.getItem(GHOSTS + key) || 'null'); return g ? { t: g.t, rows: unpackGhost(g.d) } : null; } catch { return null; } }
function keepGhost(key, t, rows) {
  try {
    localStorage.setItem(GHOSTS + key, JSON.stringify({ t, d: packGhost(rows), at: Date.now() }));
    const keys = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k?.startsWith(GHOSTS)) keys.push(k); }
    if (keys.length > 120) keys.map((k) => [k, JSON.parse(localStorage.getItem(k) || '{}').at || 0]).sort((x, y) => x[1] - y[1]).slice(0, keys.length - 120).forEach(([k]) => localStorage.removeItem(k));
  } catch { /* storage full: the run still counts */ }
}
function ghostAt(rows, t) { if (!rows?.length || t < 0) return rows?.[0] ? { x: rows[0][0], y: rows[0][1], z: rows[0][2], ry: rows[0][3], a: 'idle' } : null; const f = t * 10, i = Math.min(rows.length - 1, Math.floor(f)), j = Math.min(rows.length - 1, i + 1), k = f - i, A = rows[i], B = rows[j]; return { x: A[0] + (B[0] - A[0]) * k, y: A[1] + (B[1] - A[1]) * k, z: A[2] + (B[2] - A[2]) * k, ry: A[3], a: POSES[A[4]] || 'run', done: i >= rows.length - 1 }; }

/* ------------------------------------------------------------------ a run (a level, today's level, a season level, or online) */
class Run {
  constructor({ course, kind = 'level', solo = true, level = null, online = null, slot = -1, key = null, title = '' }) {
    this.course = course; this.kind = online ? 'online' : kind; this.solo = solo && !online; this.level = level; this.online = online; this.key = key; this.title = title;
    this.runner = new Runner(course, { slot }); this.t = -3.2; this.done = false; this.paused = false; this.sent = 0; this.tickShown = 4; this.rec = []; this.bossCp = course.challenges.findIndex((c) => c.startsWith('boss'));
    scene?.setCourse(course); this.me = scene?.addRunner('me', save.look, '', true, online?.myTeam ?? null);
    scene?.snapCamera(this.runner.x, this.runner.y, this.runner.z);
    this.ghost = this.solo && key && save.ghost !== false ? loadGhost(key) : null;
    if (this.ghost?.rows?.length) scene?.addGhost(save.look, 'أفضل وقت لك · ' + fmt(this.ghost.t));
    audio.intensity(0); audio.play(course.world);
    body.classList.toggle('tw-has-dash', Boolean(online)); this.hud();
    if (online) online.attach(this);
  }
  clock() { return this.online ? this.online.raceTime() : this.t; }
  tick(dt) {
    if (this.paused) return;
    if (!this.online) this.t += dt;
    const t = this.clock(), r = this.runner;
    if (t < 0) { const n = Math.ceil(-t); if (n !== this.tickShown && n <= 3) { this.tickShown = n; count(String(n)); SFX.tick(); } }
    else if (this.tickShown) { this.tickShown = 0; count('انطلق!', true); SFX.go(); }
    if (this.online) r.others = this.online.others();
    if (t >= 0 && !this.done && !this.out) r.update(dt, t, input);
    input.jump = false; input.dash = false;
    for (const e of r.events.splice(0)) this.event(e, t);
    if (this.solo && t >= 0 && !this.done && t >= this.rec.length * 0.1) this.rec.push([r.x, r.y, r.z, r.ry, Math.max(0, POSES.indexOf(r.anim))]);
    if (this.me) { Object.assign(this.me, { x: r.x, y: r.y, z: r.z, ry: r.ry, anim: r.anim }); this.me.phase = r.run; }
    scene.update(Math.max(0, t), dt, r);
    if (this.ghost?.rows) scene.moveGhost(ghostAt(this.ghost.rows, t), dt, t);
    if (this.spectate && this.online) { const o = this.online.leader(); if (o) scene.follow(o.x, o.y, o.z, dt); } else scene.follow(r.x, r.y, r.z, dt, t < 0 ? Math.min(1, -t / 3.2) : 0);
    this.online?.frame(this, t);
    if (!this.done) $('twTime').textContent = fmt(Math.max(0, t));
    const prog = Math.max(0, Math.min(1, r.z / this.course.finish.z)); $('twProgMe').style.insetInlineStart = prog * 100 + '%';
    watchFps(dt);
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
      case 'dash': SFX.dash(); break;
      case 'bump': SFX.bump(); break;
      case 'shoved': SFX.shoved(); buzz(40); break;
      case 'push': this.online?.send({ type: 'push', id: e.id, nx: +e.nx.toFixed(2), nz: +e.nz.toFixed(2) }); break;
      case 'fall': SFX.fall(); buzz(60); this.hud(); toast(e.by === 'rise' ? (this.course.world === 'lava' ? 'لحقتك الحمم! رجعت لآخر نقطة حفظ' : 'لحقك الرمل! رجعت لآخر نقطة حفظ') : 'رجعت لآخر نقطة حفظ'); if (e.by === 'rise') audio.intensity(0); break;
      case 'checkpoint': {
        SFX.cp(); const next = this.course.challenges[e.i];
        if (e.i === this.bossCp) { audio.intensity(1); audio.fx('boss'); toast('👑 الزعيم: ' + sectionName(next, this.course.world) + ' — ' + sectionTip(next, this.course.world), 3800); }
        else toast(next ? '✓ نقطة حفظ — الجاي: ' + sectionName(next, this.course.world) : '✓ نقطة حفظ');
        break;
      }
      case 'finish': this.finish(t); break;
    }
  }
  hud() {
    const L = this.level, r = this.runner;
    $('twTitle').textContent = this.kind === 'level' && L ? 'المرحلة ' + L.n + ' · ' + L.title : this.title || this.online?.title() || 'سباق';
    const gems = $('twGemSlots'); gems.replaceChildren(); gems.hidden = !this.solo;
    for (let i = 0; i < 3; i++) gems.append(el('i', r.gems.has(i) ? 'got' : '', '💎'));
    $('twFalls').textContent = r.falls ? '↓' + r.falls : '';
  }
  finish(t) {
    if (this.done) return; this.done = true; SFX.win(); audio.intensity(0); buzz([20, 40, 20]); scene.burst(this.runner.x, this.runner.y + 2, this.runner.z, '#ffd45a', 60);
    if (this.online) { this.online.finished(); return; }
    const c = this.course, gemsNow = this.runner.gems, stars = starsFor(c, t, gemsNow.size);
    const prior = this.ghost?.t, beat = prior ? prior - t : null;
    if (this.key && (!prior || t < prior)) keepGhost(this.key, t, this.rec);
    if (this.kind === 'daily') return finishDaily(this, t, stars, beat);
    if (this.kind === 'season') return finishSeason(this, t, stars, beat);
    const L = this.level, before = save.best[L.n];
    let earned = 0; const mask = save.gems[L.n] || 0; let newMask = mask; gemsNow.forEach((i) => { if (!(mask & (1 << i))) { earned += 10; newMask |= 1 << i; } });
    if (!before) earned += 15 + Math.floor(L.n / 4);
    if (stars === 3 && (before?.s || 0) < 3) earned += 10;
    const best = { s: Math.max(stars, before?.s || 0), t: Math.min(t, before?.t ?? Infinity) };
    const charsBefore = CHARACTERS.filter(charOpen).length;
    save.best[L.n] = best; save.gems[L.n] = newMask; save.wallet += earned; save.last = Math.min(LEVELS.length, L.n + 1); persist();
    const newChars = CHARACTERS.filter(charOpen).slice(charsBefore);
    setTimeout(() => result({ stars, time: t, earned, best, level: L, gems: gemsNow.size, newChars, record: !before || t < before.t, beat }), 900);
  }
  end() { this.online?.detach(); body.classList.remove('tw-has-dash'); game = null; }
}
function count(text, go = false) { const c = $('twCount'); c.textContent = text; c.className = 'tw-count on' + (go ? ' go' : ''); clearTimeout(count.timer); count.timer = setTimeout(() => { c.className = 'tw-count'; }, go ? 700 : 850); }

function startRun(opts, firstTip) {
  $('twResult').hidden = true; show('twHud'); body.dataset.world = opts.course.world;
  game = new Run(opts);
  const first = opts.course.challenges[0]; toast(firstTip || sectionName(first, opts.course.world) + ': ' + sectionTip(first, opts.course.world), 3200);
}
function play(n) {
  const L = levelInfo(n); if (!unlocked(L.n)) { toast('خلّص المرحلة اللي قبلها أول'); return; }
  save.last = L.n; persist();
  startRun({ course: levelCourse(L.n), level: L, kind: 'level', key: 'level:' + L.n });
}
function pause() { if (!game?.solo || game.done) return; game.paused = true; settingsView(true); $('twPause').hidden = false; }
function resume() { if (game) game.paused = false; $('twPause').hidden = true; }

function result({ stars, time, earned, best, level, gems, newChars, record, beat = null, title = '', extra = '', next = null, again = null, back = null }) {
  const box = $('twResult'); box.hidden = false;
  $('twResTitle').textContent = title || (stars === 3 ? 'أداء ذهبي!' : stars === 2 ? 'ممتاز!' : 'وصلت القمة!');
  const st = $('twResStars'); st.replaceChildren(); for (let i = 0; i < 3; i++) { const s = el('i', i < stars ? 'on' : '', '★'); s.style.animationDelay = i * 0.18 + 's'; st.append(s); }
  $('twResTime').textContent = fmt(time) + (record ? ' — رقمك الجديد' : '');
  $('twResGems').textContent = gems + ' من 3';
  $('twResEarned').textContent = earned ? '+' + earned + ' 💎' : 'ما فيه جواهر جديدة';
  $('twResGoal').textContent = (beat != null ? (beat > 0 ? 'سبقت شبحك بـ ' + beat.toFixed(1) + ' ثانية. ' : 'شبحك أسرع منك بـ ' + (-beat).toFixed(1) + ' ثانية. ') : '') + (extra || (stars < 3 ? (stars < 2 ? 'النجمتين: خلّصها بأقل من ' + fmt(game.course.par) : 'الثلاث نجوم: أقل من ' + fmt(game.course.gold) + ' مع الجواهر الثلاث') : 'خذت كل نجوم المرحلة'));
  $('twResUnlock').textContent = newChars?.length ? 'شخصية جديدة انفتحت: ' + newChars.map((c) => c.name).join('، ') : '';
  const isLevel = level && !next;
  $('twResNext').hidden = isLevel ? level.n >= LEVELS.length : !next;
  $('twResNext').onclick = () => { game?.end(); (next || (() => play(level.n + 1)))(); };
  $('twResAgain').onclick = () => { game?.end(); (again || (() => play(level.n)))(); };
  $('twResMap').onclick = () => { game?.end(); box.hidden = true; (back || (() => openMap(worldOf(level.n).id)))(); };
  $('twResMap').textContent = back ? 'رجوع' : 'المراحل';
  lobby();
}

/* ------------------------------------------------------------------ 33.19.0: today's level */
const account = () => { try { return localStorage.getItem('bs_social_session') || ''; } catch { return ''; } };
function playDaily() { const L = dailyLevel(); startRun({ course: dailyCourse(L.day), kind: 'daily', key: L.key, title: 'مرحلة اليوم · ' + worldById(L.world).name }); }
async function finishDaily(run, t, stars, beat) {
  const day = dayKey(), first = !save.daily[day]; save.daily[day] = Math.min(t, save.daily[day] ?? Infinity);
  for (const k of Object.keys(save.daily)) if (k < dayKey(Date.now() - 7 * 86_400_000)) delete save.daily[k];
  const earned = first ? 20 : 0; save.wallet += earned; persist();
  let extra = account() ? 'نرسل وقتك لترتيب اليوم…' : 'سجّل دخول عشان يدخل وقتك ترتيب اليوم';
  setTimeout(() => result({ stars, time: t, earned, gems: run.runner.gems.size, record: t <= save.daily[day], beat, title: 'خلّصت مرحلة اليوم!', extra, next: null, again: playDaily, back: openDaily }), 900);
  if (!account()) return;
  try {
    const res = await fetch('/api/tower/daily', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + account() }, body: JSON.stringify({ day, time: +t.toFixed(2), path: run.rec.map((r) => [+r[0].toFixed(2), +r[1].toFixed(2), +r[2].toFixed(2)]) }) });
    const d = await res.json().catch(() => ({}));
    const msg = res.ok && d.ok ? 'ترتيبك اليوم: ' + d.rank + (d.best ? ' · أفضل وقت لك ' + fmt(d.best) : '') : 'ما انحسب الوقت: ' + (d.error || res.status);
    if (!$('twResult').hidden) $('twResGoal').textContent = msg; else toast(msg, 4000);
  } catch { toast('ما قدرنا نرسل وقتك، تأكد من النت', 4000); }
}
async function openDaily() {
  show('twDaily'); const L = dailyLevel(), W = worldById(L.world), mine = save.daily[L.day];
  $('twDailyWorld').textContent = W.name; $('twDailyMix').textContent = L.challenges.map((c) => sectionName(c, L.world)).join(' · ');
  $('twDailyMine').textContent = mine ? 'أفضل وقت لك اليوم: ' + fmt(mine) : 'ما لعبتها اليوم للحين — أول مرة تخلّصها لك 20 💎';
  const left = () => { const ms = nextDayAt() - Date.now(), h = Math.floor(ms / 3_600_000), m = Math.floor(ms / 60000) % 60; return 'تتغير بعد ' + h + ' ساعة و ' + m + ' دقيقة'; };
  $('twDailyLeft').textContent = left();
  const list = $('twDailyBoard'); list.replaceChildren(el('li', 'tw-empty', 'نحمّل ترتيب اليوم…'));
  try {
    const d = await (await fetch('/api/tower/board?period=day', { headers: account() ? { authorization: 'Bearer ' + account() } : {} })).json(); list.replaceChildren();
    if (!d.rows?.length) list.append(el('li', 'tw-empty', 'ما أحد خلّصها اليوم للحين. كن الأول!'));
    d.rows?.slice(0, 20).forEach((r, i) => { const li = el('li', r.me ? 'me' : ''); const who = el('span', 'tw-who'); who.append(face(r.user, null, r.name), el('bdi', '', r.name)); li.append(el('b', '', i < 3 ? ['🥇', '🥈', '🥉'][i] : String(i + 1)), who, el('small', ''), el('em', '', fmt(r.time))); list.append(li); });
  } catch { list.replaceChildren(el('li', 'tw-empty', 'ما قدرنا نحمّل الترتيب. تأكد من النت.')); }
}

/* ------------------------------------------------------------------ 33.19.0: the season */
function seasonSave(S) { save.season ??= {}; return (save.season[S.key] ??= { done: {}, won: false }); }
function playSeason(i) { const S = seasonOf(), L = seasonLevel(S, i), mine = seasonSave(S); if (i > 0 && !mine.done[i - 1] && !isOwner()) { toast('خلّص المرحلة اللي قبلها أول'); return; } startRun({ course: seasonCourse(S, i), kind: 'season', key: L.key, title: L.title, level: { i } }); }
function finishSeason(run, t, stars, beat) {
  const S = seasonOf(), mine = seasonSave(S), i = run.level.i, first = !mine.done[i];
  mine.done[i] = Math.max(stars, mine.done[i] || 0); let earned = first ? 15 : 0, extra = '';
  if (Object.keys(mine.done).length >= 10 && !mine.won) { mine.won = true; if (!save.owned.includes(S.reward)) save.owned.push(S.reward); earned += 50; extra = 'خلّصت الموسم! صار لك الزي الحصري: ' + (OUTFITS.find((o) => o.id === S.reward)?.name || ''); }
  save.wallet += earned; persist();
  setTimeout(() => result({ stars, time: t, earned, gems: run.runner.gems.size, record: false, beat, title: S.name + ' · ' + (i + 1), extra: extra || (i < 9 ? 'باقي ' + (10 - Object.keys(mine.done).length) + ' مراحل على الزي الحصري' : ''), next: i < 9 ? () => playSeason(i + 1) : null, again: () => playSeason(i), back: openSeason }), 900);
}
function openSeason() {
  show('twSeason'); const S = seasonOf(), mine = seasonSave(S), reward = OUTFITS.find((o) => o.id === S.reward), days = Math.max(0, Math.ceil((S.endsAt - Date.now()) / 86_400_000));
  $('twSeasonName').textContent = S.name; $('twSeasonAbout').textContent = S.about; $('twSeasonLeft').textContent = 'باقي ' + days + ' يوم على نهاية الموسم';
  $('twSeasonReward').replaceChildren(el('i', 'tw-swatch tw-icon-' + S.reward), el('b', '', reward?.name || ''), el('small', '', mine.won || save.owned.includes(S.reward) ? 'صار لك ✓' : 'حصري: خلّص المراحل العشر هالشهر'));
  const grid = $('twSeasonLevels'); grid.replaceChildren(); grid.dataset.world = S.world;
  for (let i = 0; i < 10; i++) {
    const L = seasonLevel(S, i), open = i === 0 || mine.done[i - 1] || isOwner(), got = mine.done[i] || 0, b = el('button', 'tw-level' + (open ? '' : ' locked') + (got ? ' done' : '') + (i === 9 ? ' finale' : '')); b.type = 'button';
    b.append(el('b', '', open ? String(i + 1) : '🔒'), el('span', 'tw-lv-name', L.challenges.map((c) => sectionName(c, L.world)).slice(0, 2).join(' · ')), el('span', 'tw-lv-stars', got ? '★'.repeat(got) + '☆'.repeat(3 - got) : '☆☆☆'));
    b.onclick = () => playSeason(i); grid.append(b);
  }
}

/* ------------------------------------------------------------------ 33.19.0: settings, sound and the light mode */
function applyQuality() { const cores = navigator.hardwareConcurrency || 8, weak = (navigator.deviceMemory || 8) <= 2 || cores <= 2 || (/Android/i.test(navigator.userAgent) && cores <= 4); scene?.setQuality(save.gfx === 'low' || (save.gfx !== 'high' && weak) ? 'low' : 'high'); }
let fpsSum = 0, fpsN = 0, fpsSlow = 0;
// two slow stretches in a row (a one-off hitch while loading does not count) switch to the light graphics
function watchFps(dt) { if (save.gfx !== 'auto' || scene?.low || dt > 0.25) return; fpsSum += dt; fpsN++; if (fpsSum > 4) { fpsSlow = fpsN / fpsSum < 34 ? fpsSlow + 1 : 0; if (fpsSlow >= 2) { fpsSlow = 0; scene.setQuality('low'); toast('خففنا الرسومات عشان يكون اللعب أنعم — تقدر تغيرها من الإعدادات', 3500); } fpsSum = 0; fpsN = 0; } }
function settingsView(inGame) {
  const label = { auto: 'تلقائي', high: 'عالية', low: 'خفيفة' };
  $('twMusic').textContent = (save.music !== false ? '🎵 الموسيقى: شغالة' : '🎵 الموسيقى: مطفية');
  $('twSound').textContent = (save.sound !== false ? '🔊 الأصوات: شغالة' : '🔇 الأصوات: مطفية');
  $('twGfx').textContent = '🖥️ الرسومات: ' + label[save.gfx || 'auto'];
  $('twGhostToggle').textContent = save.ghost !== false ? '👻 الشبح: يطلع' : '👻 الشبح: مخفي';
  for (const id of ['twResume', 'twRestart', 'twQuit']) $(id).hidden = !inGame;
  $('twPauseTitle').textContent = inGame ? 'وقفة' : 'الإعدادات'; $('twSettingsClose').hidden = inGame;
}

/* ------------------------------------------------------------------ lobby, map, wardrobe */
function lobby() {
  $('twStars').textContent = totalStars(); $('twGems').textContent = save.wallet; $('twStarMax').textContent = '/' + STAR_MAX;
  const n = nextLevel(), L = levelInfo(n);
  $('twContinue').querySelector('b').textContent = save.best[n] ? 'عيد المرحلة ' + n : 'المرحلة ' + n;
  $('twContinue').querySelector('small').textContent = worldOf(n).name + ' · ' + L.title;
  $('twWorldName').textContent = worldOf(n).name;
  const S = seasonOf(); $('twSeasonBtn').querySelector('small').textContent = S.name; $('twDailyBtn').querySelector('small').textContent = save.daily[dayKey()] ? '✓ ' + fmt(save.daily[dayKey()]) : 'جديدة';
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
  show('twWardrobe'); $('twWardStars').textContent = totalStars() + ' ★'; $('twWardGems').textContent = isOwner() ? 'حساب المدير: كلها مفتوحة' : save.wallet + ' 💎';
  doc.querySelectorAll('#twWardrobe [data-ward-tab]').forEach((b) => b.classList.toggle('on', b.dataset.wardTab === tab));
  const grid = $('twWardGrid'); grid.replaceChildren();
  const refresh = () => { stage(); openWardrobe(tab); };
  if (tab === 'char') for (const c of CHARACTERS) {
    const open = charOpen(c), on = save.look.char === c.id, b = el('button', 'tw-item' + (on ? ' on' : '') + (open ? '' : ' locked')); b.type = 'button';
    const sw = el('i', 'tw-swatch'); sw.style.background = c.pattern === 'sadu' ? 'repeating-linear-gradient(135deg,#b3262c 0 8px,#1d1414 8px 12px,#f4e9d4 12px 16px)' : `radial-gradient(circle at 35% 30%,#fff8,${c.body} 45%,${c.trim})`;
    b.append(sw, el('b', '', c.name), el('span', 'tw-about', c.about || ''), el('small', '', on ? 'لابسها' : open ? 'البسها' : '🔒 ' + c.stars + ' ★'));
    b.onclick = () => { if (!open) { toast('اجمع ' + c.stars + ' نجمة عشان تفتحها'); return; } save.look.char = c.id; persist(); refresh(); };
    grid.append(b);
  } else for (const o of OUTFITS.filter((x) => x.slot === tab)) {
    const owned = hasOutfit(o.id), on = save.look[tab] === o.id, b = el('button', 'tw-item' + (on ? ' on' : '') + (owned ? '' : o.season ? ' locked' : ' shop')); b.type = 'button';
    const seasonName = o.season ? (SEASON_NAMES[o.season] || 'الموسم') : '';
    b.append(el('i', 'tw-swatch tw-icon-' + o.id), el('b', '', o.name), el('small', '', on ? 'لابسه' : owned ? 'البسه' : o.season ? 'حصري: ' + seasonName : o.price + ' 💎'));
    b.onclick = () => {
      if (!owned && o.season) { toast('هذا الزي حصري لـ«' + seasonName + '»: خلّص مراحله العشر في شهره', 3500); return; }
      if (!owned) { if (save.wallet < o.price) { toast('تحتاج ' + (o.price - save.wallet) + ' 💎 زيادة. خلّص مراحل واجمع الجواهر'); return; } save.wallet -= o.price; save.owned.push(o.id); toast('صار لك: ' + o.name); SFX.gem(); }
      save.look[tab] = o.id; persist(); refresh();
    };
    grid.append(b);
  }
}

/* ------------------------------------------------------------------ pictures */
// 33.18.1: players with an account show their profile picture (a ready one or an uploaded photo);
// a guest, or an account without a picture, shows the colours of the runner they picked.
function swatch(look) { const c = CHARACTERS.find((x) => x.id === look?.char) || CHARACTERS[0], sw = el('i', 'tw-swatch'); sw.style.background = c.pattern === 'sadu' ? 'repeating-linear-gradient(135deg,#b3262c 0 8px,#1d1414 8px 12px,#f4e9d4 12px 16px)' : `radial-gradient(circle at 35% 30%,#fff8,${c.body} 45%,${c.trim})`; return sw; }
function face(user, look, name = '') {
  const sw = swatch(look); if (!user || !/^[a-zA-Z0-9_]{3,20}$/.test(user)) return sw;
  const img = el('img'); img.alt = name ? 'صورة ' + name : ''; img.decoding = 'async'; img.loading = 'lazy';
  img.onload = () => sw.classList.add('has-photo'); img.onerror = () => img.remove(); img.src = '/api/social/photo/' + encodeURIComponent(user);
  sw.append(img); return sw;
}

/* ------------------------------------------------------------------ online */
const guestName = () => { try { return localStorage.getItem('bs-player-name-v33') || ''; } catch { return ''; } };
const MODES = { race: 'سباق', elim: 'إقصاء', teams: 'فرق' };
class TowerOnline {
  constructor() { this.ws = null; this.state = null; this.offset = 0; this.code = ''; this.hostKey = ''; this.token = ''; this.run = null; this.snaps = new Map(); }
  // 33.18.1: every failure says what failed and its code, and the room's socket is tried twice
  async api(path, body, what) {
    let res; try { res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' }); }
    catch { throw Error('ما وصلنا للسيرفر. تأكد من النت وجرّب مرة ثانية'); }
    const d = await res.json().catch(() => ({}));
    if (!res.ok || !d.code) throw Error((typeof d.error === 'string' && d.error.length < 90 && !/_/.test(d.error) ? d.error : 'ما قدرنا ' + what) + ' (' + res.status + ')');
    return d;
  }
  async join(code) { try { return await this.connect(code); } catch (first) { if (this.closed && !this.code) throw first; await new Promise((r) => setTimeout(r, 900)); return this.connect(code); } }
  async quick(mode) { const d = await this.api('/api/tower/quick', { mode }, 'نلقى سباق الحين'); return this.join(d.code); }
  async create(mode, capacity) { const d = await this.api('/api/tower/rooms', { mode, capacity }, 'نفتح الغرفة'); this.hostKey = d.hostKey; return this.join(d.code); }
  connect(code) {
    this.close(); this.code = String(code).replace(/\D/g, '').slice(0, 6); this.closed = false;
    try { this.token = sessionStorage.getItem('bs_tower_room:' + this.code) || ''; } catch { this.token = ''; }
    const protocols = ['bs-tower-v1', ...(this.hostKey ? ['hk.' + this.hostKey] : []), ...(this.token ? ['rt.' + this.token] : []), ...(account() ? ['st.' + account()] : [])];
    const name = ($('twName').value || guestName() || 'لاعب').trim().slice(0, 20);
    return new Promise((resolve, reject) => {
      let ok = false, ws;
      try { ws = this.ws = new WebSocket((location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + location.host + '/api/tower/rooms/' + this.code + '/ws?name=' + encodeURIComponent(name) + '&look=' + encodeURIComponent(JSON.stringify(save.look)), protocols); }
      catch { reject(Error('المتصفح ما قبل الاتصال بالغرفة (ws)')); return; }
      const timer = setTimeout(() => { if (!ok) { try { ws.close(); } catch { /* gone */ } reject(Error('الغرفة ما ردت، جرّب مرة ثانية (مهلة)')); } }, 12000);
      ws.onmessage = (ev) => { let m; try { m = JSON.parse(ev.data); } catch { return; } if (m.type === 'hello') { ok = true; clearTimeout(timer); this.me = m.id; this.offset = m.now - Date.now(); try { sessionStorage.setItem('bs_tower_room:' + this.code, m.token); } catch { /* private */ } resolve(this); } this.message(m); };
      ws.onclose = (ev) => { clearTimeout(timer); if (!ok) reject(Error((ev.reason || 'الغرفة ما فتحت') + ' (' + (ev.code || 0) + ')')); else if (!this.closed) { this.lost(); } };
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
  /** the runners near you, with the speed they are moving at (for bumping into them) */
  others() { const out = []; for (const o of this.snaps.values()) out.push(o); return out; }
  emote(kind) { const now = performance.now(); if (now - (this.lastEmote || 0) < 1200) return; this.lastEmote = now; this.send({ type: 'gesture', e: kind }); scene?.emote('me', kind); audio.fx(kind); }
  leader() { let best = null; for (const [id, p] of this.snaps) if (id !== this.me && (!best || p.z > best.z)) best = p; return best; }
  message(m) {
    if (m.type === 'state') { const prev = this.state; this.state = m.state; this.paint(prev); }
    if (m.type === 'snap' && this.run) for (const row of m.p) {
      const [id, x, y, z, ry, a] = row; if (id === this.me) continue;
      const prev = this.snaps.get(id), now = performance.now(), dt = prev ? Math.max(0.05, (now - prev.at) / 1000) : 1;
      this.snaps.set(id, { id, x, y, z, at: now, vx: prev ? (x - prev.x) / dt : 0, vz: prev ? (z - prev.z) / dt : 0 });
      scene?.target(id, x, y, z, ry, POSES[a] || 'run');
    }
    if (m.type === 'gesture' && m.id !== this.me) { scene?.emote(m.id, m.e); audio.fx(m.e); }
    if (m.type === 'pushed' && game?.online === this && !game.done) game.runner.shove(m.nx, m.nz);
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
  frame(run, t) { if (t > -0.5 && performance.now() - run.sent > 95 && !run.done) { run.sent = performance.now(); const r = run.runner; this.send({ type: 'pos', x: +r.x.toFixed(2), y: +r.y.toFixed(2), z: +r.z.toFixed(2), ry: +r.ry.toFixed(2), a: Math.max(0, POSES.indexOf(r.anim)), cp: r.cp }); } }
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
  $('twRoomCode').textContent = s.party ? 'غرفة الأصدقاء' : s.quick ? 'سباق عام' : s.code; $('twRoomMode').textContent = MODES[s.mode] + ' · ' + s.players.length + '/' + s.capacity;
  const list = $('twRoomPlayers'); list.replaceChildren();
  for (const p of s.players) { const li = el('li', p.id === o.me ? 'me' : ''); li.append(face(p.user, p.look, p.name), el('b', '', p.name), el('small', '', p.host ? 'صاحب الغرفة' : p.ready ? 'جاهز' : '')); if (s.mode === 'teams') li.dataset.team = p.team; list.append(li); }
  const me = s.players.find((p) => p.id === o.me);
  $('twRoomStart').hidden = !me?.host || s.quick; $('twRoomStart').disabled = s.players.length < 2;
  $('twRoomShare').hidden = s.quick || Boolean(s.party); $('twRoomFriend').hidden = s.quick || Boolean(s.party);
  $('twRoomNote').textContent = s.party ? 'السباق يبدأ أول ما يدخل كل أصحابك (أو بعد شوي)' : s.quick ? (s.startsIn ? 'السباق يبدأ بعد ' + Math.max(1, Math.ceil((s.startsIn - o.now()) / 1000)) + ' ثانية' : 'ندوّر لك على لاعبين…') : me?.host ? (s.players.length < 2 ? 'ادعُ صديق من قائمة أصحابك أو شارك الرابط. تقدر تبدأ أول ما يدخل واحد.' : 'اضغط ابدأ لما يكتمل أصحابك') : 'انتظر صاحب الغرفة يبدأ';
  clearTimeout(lobbyView.timer); if (s.quick && s.startsIn) lobbyView.timer = setTimeout(() => o.state?.status === 'lobby' && lobbyView(o.state, o), 500);
}
function roundView(s, o) {
  const box = $('twRound'); box.hidden = false; const me = s.players.find((p) => p.id === o.me);
  const final = s.status === 'finished';
  $('twRoundTitle').textContent = final ? (s.mode === 'teams' ? (s.winnerTeam === me?.team ? 'فاز فريقك!' : 'فاز الفريق الثاني') : me?.place === 1 ? 'أنت البطل!' : 'انتهى السباق') : me?.out ? 'طلعت من السباق' : 'تأهلت للجولة الجاية!';
  const list = $('twRoundList'); list.replaceChildren();
  const rows = s.players.slice().sort((a, b) => (a.place || 99) - (b.place || 99));
  rows.forEach((p) => { const li = el('li', (p.id === o.me ? 'me ' : '') + (p.out ? 'out' : '')); if (s.mode === 'teams') li.dataset.team = p.team; li.append(el('b', '', p.place ? '#' + p.place : '—'), el('span', 'tw-who'), el('small', '', p.fin != null ? fmt(p.fin) : p.out ? 'طلع' : 'ما وصل'), el('em', '', p.points ? '+' + p.points : '')); li.querySelector('.tw-who').append(face(p.user, p.look, p.name), el('bdi', '', p.name)); list.append(li); });
  $('twRoundNote').textContent = final ? (me?.points ? 'نقاطك للمتصدرين: +' + me.points : '') + (account() ? '' : ' — سجّل دخول عشان تنحسب نقاطك') : 'الجولة الجاية تبدأ بعد شوي';
  const host = s.players.find((p) => p.id === o.me)?.host; $('twRoundAgain').hidden = !final || Boolean(s.party) || (!s.quick && !host); $('twRoundParty').hidden = !final || !PARTY || Boolean(LINK?.embedded); $('twRoundAgain').querySelector('b').textContent = s.quick ? 'سباق ثاني' : 'جولة ثانية بنفس الغرفة'; $('twRoundLeave').hidden = false;
  if (final && !o.paid) { o.paid = true; save.wallet += me?.gems || 0; persist(); lobby(); }
}
async function goQuick() {
  try { $('twQuick').disabled = true; online = new TowerOnline(); await online.quick(save.mode); }
  catch (e) { toast(e.message || 'ما قدرنا نوصل للسيرفر', 6000); online = null; } finally { $('twQuick').disabled = false; }
}

/* ------------------------------------------------------------------ leaderboard */
async function openBoard(period = 'week') {
  show('twBoard'); doc.querySelectorAll('#twBoard [data-tw-board]').forEach((b) => b.classList.toggle('on', b.dataset.twBoard === period));
  const list = $('twBoardList'); list.replaceChildren(el('li', 'tw-empty', 'نحمّل الترتيب…'));
  try {
    const res = await fetch('/api/tower/board?period=' + period, { headers: account() ? { authorization: 'Bearer ' + account() } : {} }); const d = await res.json();
    list.replaceChildren();
    if (!d.rows?.length) list.append(el('li', 'tw-empty', period === 'week' ? 'ما أحد لعب هالأسبوع للحين. كن أول واحد!' : 'الترتيب فاضي للحين'));
    d.rows?.forEach((r, i) => { const li = el('li', r.me ? 'me' : ''); const who = el('span', 'tw-who'); who.append(face(r.user, null, r.name), el('bdi', '', r.name)); li.append(el('b', '', i < 3 ? ['🥇', '🥈', '🥉'][i] : String(i + 1)), who, el('small', '', r.wins + ' فوز'), el('em', '', r.points + ' نقطة')); list.append(li); });
    $('twBoardMe').textContent = d.me ? 'ترتيبك: ' + d.me.rank + ' · ' + d.me.points + ' نقطة' : account() ? 'العب سباقات أونلاين عشان تدخل الترتيب' : 'سجّل دخول والعب أونلاين عشان يطلع اسمك هنا';
  } catch { list.replaceChildren(el('li', 'tw-empty', 'ما قدرنا نحمّل الترتيب. تأكد من النت.')); }
}

/* ------------------------------------------------------------------ wiring */
$('twContinue').onclick = () => play(nextLevel());
$('twDailyBtn').onclick = () => openDaily();
$('twSeasonBtn').onclick = () => openSeason();
$('twDailyPlay').onclick = () => playDaily();
$('twSettingsBtn').onclick = () => { settingsView(false); $('twPause').hidden = false; };
$('twSettingsClose').onclick = () => { $('twPause').hidden = true; };
$('twMusic').onclick = () => { save.music = save.music === false; persist(); audio.music = save.music; if (save.music) audio.play(game?.course.world || worldOf(save.last || 1).id); else audio.stop(); settingsView(Boolean(game)); };
$('twGfx').onclick = () => { save.gfx = { auto: 'high', high: 'low', low: 'auto' }[save.gfx || 'auto']; persist(); applyQuality(); settingsView(Boolean(game)); };
$('twGhostToggle').onclick = () => { save.ghost = save.ghost === false; persist(); if (scene?.ghost) scene.ghost.fig.visible = save.ghost; if (game && save.ghost === false) game.ghost = null; settingsView(Boolean(game)); };
doc.querySelectorAll('#twHud [data-emote]').forEach((b) => { b.onclick = () => online?.emote(b.dataset.emote); });
$('twRoundParty').onclick = () => { location.href = '/party?room=' + encodeURIComponent(PARTY); };
$('twMapBtn').onclick = () => openMap();
$('twWardrobeBtn').onclick = () => openWardrobe();
$('twOnlineBtn').onclick = () => { show('twOnline'); onlineView(); };
$('twBoardBtn').onclick = () => openBoard();
doc.querySelectorAll('.tw-app [data-back]').forEach((b) => { b.onclick = () => { if (b.closest('#twOnline') && online) { leaveOnline(); } show('twLobby'); lobby(); }; });
doc.querySelectorAll('#twWardrobe [data-ward-tab]').forEach((b) => { b.onclick = () => openWardrobe(b.dataset.wardTab); });
doc.querySelectorAll('#twBoard [data-tw-board]').forEach((b) => { b.onclick = () => openBoard(b.dataset.twBoard); });
doc.querySelectorAll('#twOnline [data-tw-mode]').forEach((b) => { b.onclick = () => { save.mode = b.dataset.twMode; persist(); onlineView(); }; });
$('twQuick').onclick = goQuick;
$('twCreate').onclick = async () => { const b = $('twCreate'); if (b.disabled) return; b.disabled = true; b.textContent = 'نفتح الغرفة…'; try { online = new TowerOnline(); await online.create(save.mode, Number($('twCapacity').value) || 8); } catch (e) { toast(e.message, 6000); online?.close(); online = null; } finally { b.disabled = false; b.textContent = 'افتح غرفة'; } };
$('twJoin').onclick = async () => { const code = $('twCode').value.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 1632)).replace(/\D/g, ''); if (code.length !== 6) { toast('الكود ستة أرقام'); return; } try { online = new TowerOnline(); await online.join(code); } catch (e) { toast(e.message, 6000); online?.close(); online = null; } };
$('twRoomStart').onclick = () => online?.send({ type: 'start' });
$('twRoomShare').onclick = async () => { const url = location.origin + '/tower?room=' + online?.code; try { if (navigator.share) await navigator.share({ title: 'برج التحديات', text: 'تعال سابقني في برج التحديات! الكود ' + online?.code, url }); else { await navigator.clipboard.writeText(url); toast('نسخنا الرابط'); } } catch { /* cancelled */ } };
// 33.18.1: a direct invitation to a friend (it pops up on their screen), beside the shareable link
$('twRoomFriend').onclick = () => { const code = online?.code; if (!code) return; if (window.BS_SOCIAL?.openInvitePicker) window.BS_SOCIAL.openInvitePicker({ game: 'tower', roomCode: code, title: 'برج التحديات' }); else $('twRoomShare').click(); };
$('twRoomLeave').onclick = leaveOnline;
$('twRoundLeave').onclick = leaveOnline;
$('twRoundAgain').onclick = () => { if (online?.state && !online.state.quick) { online.send({ type: 'start' }); return; } leaveOnline(); goQuick(); };
$('twPauseBtn').onclick = () => (game?.solo ? pause() : null);
$('twResume').onclick = resume;
$('twRestart').onclick = () => { resume(); const n = game?.level?.n; game?.end(); if (n) play(n); };
$('twQuit').onclick = () => { resume(); game?.end(); show('twLobby'); lobby(); };
$('twSound').onclick = () => { save.sound = save.sound === false; persist(); audio.sfx = save.sound; settingsView(Boolean(game)); };
$('twResClose').onclick = () => { $('twResult').hidden = true; game?.end(); show('twLobby'); lobby(); };
doc.addEventListener('visibilitychange', () => { if (doc.hidden && game?.solo && !game.done) pause(); });

// an invite link (or the friends' room) opens its room straight away
const PARTY = (new URLSearchParams(location.search).get('party') || '').replace(/\D/g, '').slice(0, 6);
const params = new URLSearchParams(location.search), invite = (params.get('room') || '').replace(/\D/g, '');
// a round of «الغرف»: a guest races under the name the group room knows (that is how the result finds
// them), and inside the group room's frame the room itself is the way out, so the page's own exits hide
const LINK = globalThis.BS_PARTY_LINK || null;
if (LINK?.name && !account()) $('twName').value = LINK.name;
if (LINK?.embedded) body.classList.add('tw-embedded');
show('twLobby'); lobby();
if (invite.length === 6) { show('twOnline'); onlineView(); online = new TowerOnline(); online.join(invite).catch((e) => { toast(e.message, 6000); online?.close(); online = null; }); }
globalThis.BS_TOWER = Object.freeze({ play, openMap, levels: LEVELS.length, get state() { return { level: game?.level?.n || null, t: game ? game.clock() : null, runner: game ? { x: game.runner.x, y: game.runner.y, z: game.runner.z, cp: game.runner.cp, falls: game.runner.falls, finished: game.runner.finished } : null }; } });
