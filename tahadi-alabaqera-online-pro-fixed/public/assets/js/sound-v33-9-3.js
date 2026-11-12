/* 33.9.3: music for the whole site (one piece per game, on/off and volume in the settings)
   and the sounds of play: a tap under the finger, «دورك», the start, the win and the loss, and coins. */
(() => {
  if (window.BS_SOUND) return;
  const A = () => window.BS_AUDIO;
  const route = (location.pathname.replace(/\.html$/, '').replace(/^\/+/, '').split('/')[0] || 'index').toLowerCase();
  const embedded = (() => { try { return window.top !== window; } catch { return true; } })();
  const TRACKS = {
    lobby: ['index', 'shop', 'social', 'journey', 'characters', 'leaderboard', 'v5', 'offline'],
    baloot: ['baloot'],
    jackaroo: ['jackaroo'],
    chaos: ['chaos', 'uno'],
    snakes: ['snakes'],
    zahra: ['zahra'],
    dice: ['dice'],
    hockey: ['hockey'],
    billiards: ['billiards'],
    carrom: ['race', 'carrom'],
    focus: ['memory', 'logic', 'puzzle', 'sudoku', 'focus', 'paths-online', 'picture', 'patterns', 'labyrinth', 'accuracy', 'survival', 'territory', 'reaction-classic'],
    quiz: ['quiz', 'online', 'local'],
    words: ['wordbomb', 'cipher'],
    arcade: ['serpent', 'reaction'],
    party: ['party'],
    jewels: ['jewels'],
  };
  // length of each loop in seconds and the wrap-around kept before and after it in the file
  const LOOPS = {lobby:{lead:1.0,loop:77.8378458},billiards:{lead:1.0,loop:93.65852608},carrom:{lead:1.0,loop:81.70213152},baloot:{lead:1.0,loop:73.84614512},jackaroo:{lead:1.0,loop:65.45453515},chaos:{lead:1.0,loop:55.38462585},snakes:{lead:1.0,loop:62.60868481},zahra:{lead:1.0,loop:66.97673469},dice:{lead:1.0,loop:64.0},hockey:{lead:1.0,loop:51.42857143},focus:{lead:1.0,loop:84.70587302},quiz:{lead:1.0,loop:64.0},words:{lead:1.0,loop:72.0},arcade:{lead:1.0,loop:53.33333333},party:{lead:1.0,loop:57.6},jewels:{lead:1.0,loop:56.47058957}};
  const trackFor = (name) => Object.keys(TRACKS).find((k) => TRACKS[k].includes(name)) || null;
  const track = trackFor(route);
  const settings = () => { try { return A()?.getSettings?.() || {}; } catch { return {}; } };
  const musicOn = () => { const s = settings(); return !s.muted && s.music !== false; };
  const level = () => { const s = settings(); return Math.max(0, Math.min(1, (s.volume ?? .72) * (s.musicVolume ?? .28))) * .62; };
  const store = { get(k) { try { return JSON.parse(sessionStorage.getItem(k) || 'null'); } catch { return null; } }, set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch {} } };

  // ---------------------------------------------------------------- music
  let node = null, gain = null, buffer = null, loading = null, startedAt = 0, offset = 0, ducked = false, wanted = false, strikeUntil = 0, strikeTimer = 0;
  function loadTrack() {
    if (buffer || loading || !track) return loading;
    const ctx = A()?.context?.(); if (!ctx?.decodeAudioData || typeof fetch !== 'function') return null;
    loading = fetch('/assets/music/v33-9-12/' + track + '.mp3').then((r) => r.ok ? r.arrayBuffer() : Promise.reject(new Error('music')))
      .then((b) => new Promise((ok, no) => ctx.decodeAudioData(b, ok, no))).then((b) => { buffer = b; return b; })
      .catch(() => { loading = null; return null; });
    return loading;
  }
  function target() { return musicOn() ? level() * (ducked ? .3 : Date.now() < strikeUntil ? .48 : 1) : 0; }
  function ramp(to, sec = .8) {
    const ctx = A()?.context?.(); if (!gain || !ctx) return;
    const t = ctx.currentTime; try { gain.gain.cancelScheduledValues(t); gain.gain.setValueAtTime(gain.gain.value, t); gain.gain.linearRampToValueAtTime(to, t + sec); } catch { gain.gain.value = to; }
  }
  function position() {
    const ctx = A()?.context?.(), meta = LOOPS[track]; if (!ctx || !meta || !node) return offset;
    return (offset + ctx.currentTime - startedAt) % meta.loop;
  }
  async function play() {
    wanted = true;
    if (embedded || !track || !musicOn() || node) return;
    const ctx = A()?.context?.(), bus = A()?.musicBus?.(); if (!ctx || !bus) return;
    const b = await loadTrack(); if (!b || node || !wanted || !musicOn()) return;
    if (ctx.state === 'suspended') { try { await ctx.resume(); } catch {} }
    const meta = LOOPS[track] || { lead: 0, loop: b.duration };
    const saved = store.get('bs_music_v1');
    offset = saved && saved.track === track ? (saved.pos + Math.min(8, Math.max(0, (Date.now() - saved.at) / 1000))) % meta.loop : 0;
    node = ctx.createBufferSource(); node.buffer = b; node.loop = true;
    node.loopStart = meta.lead; node.loopEnd = Math.min(b.duration, meta.lead + meta.loop);
    gain = ctx.createGain(); gain.gain.value = 0; node.connect(gain).connect(bus);
    startedAt = ctx.currentTime; node.start(0, meta.lead + offset); ramp(target(), 1.6);
  }
  function stop(sec = .5) {
    wanted = false; if (!node) return;
    save(); const n = node, ctx = A()?.context?.(); ramp(0, sec); node = null;
    setTimeout(() => { try { n.stop(); n.disconnect(); } catch {} }, sec * 1000 + 60);
    if (ctx) gain = null;
  }
  function save() { if (node && track) store.set('bs_music_v1', { track, pos: position(), at: Date.now() }); }
  function sync() { if (!musicOn()) { stop(); return; } if (!node) { play(); return; } ramp(target(), .35); }

  // quiet the music while a question clip or a voice plays, and stop it in a hidden tab
  setInterval(() => { const busy = Boolean(A()?.contentActive?.()); if (busy !== ducked) { ducked = busy; ramp(target(), .4); } }, 500);
  document.addEventListener('visibilitychange', () => { const ctx = A()?.context?.(); if (!ctx) return; if (document.hidden) { save(); try { ctx.suspend(); } catch {} } else try { ctx.resume(); } catch {} });
  addEventListener('pagehide', save);
  addEventListener('bs-audio-change', sync);
  addEventListener('bs-table-strike', () => { strikeUntil = Date.now() + 900; clearTimeout(strikeTimer); ramp(target(), .08); strikeTimer = setTimeout(() => ramp(target(), .65), 920); });
  const first = () => { A()?.unlock?.(); play(); A()?.prime?.(['tap', 'yourTurn', 'go', 'victory', 'defeat', 'coin', 'whoosh']); };
  addEventListener('pointerdown', first, { once: true, passive: true, capture: true });
  addEventListener('keydown', first, { once: true, capture: true });
  if (!embedded && track) setTimeout(loadTrack, 1500);

  // ---------------------------------------------------------------- the sounds of play
  const fxOn = () => { const s = settings(); return !s.muted && s.effects !== false; };
  // a light tap under every button, unless the game answers the press with its own sound
  const TAPPABLE = 'button,[role="button"],.bs-btn,.bs-icon-btn,a.game-card,a.bs-game,summary,.chip,.tab';
  addEventListener('pointerdown', (e) => {
    if (!fxOn() || e.button > 0) return;
    const el = e.target?.closest?.(TAPPABLE); if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true' || el.closest('[data-no-tap]')) return;
    setTimeout(() => { if (!A()?.recent?.(90)) A()?.play?.('tap', { volume: .42 }); }, 45);
  }, { capture: true, passive: true });

  // the end of a game: a fanfare for a win, a soft fall for a loss (once per result)
  let lastEnd = 0;
  function ending(win) {
    if (!fxOn() || Date.now() - lastEnd < 3000) return; lastEnd = Date.now();
    setTimeout(() => { if (!A()?.recent?.(350)) A()?.play?.(win ? 'victory' : 'defeat', { volume: win ? .8 : .6 }); }, 120);
  }
  (function hookCareer(tries = 0) {
    const c = window.BS_CAREER;
    if (c?.record && !c.record.__bsSound) {
      const original = c.record; const wrapped = function (result) { try { ending(Boolean(result?.win)); } catch {} return original.apply(this, arguments); };
      wrapped.__bsSound = true; c.record = wrapped; return;
    }
    if (tries < 40) setTimeout(() => hookCareer(tries + 1), 500);
  })();

  // coins arriving
  let coins = null;
  addEventListener('bs-career-change', () => {
    let now = null; try { now = window.BS_CAREER?.get?.()?.coins; } catch {}
    if (typeof now === 'number' && typeof coins === 'number' && now > coins && fxOn()) A()?.play?.('coin', { volume: .6 });
    if (typeof now === 'number') coins = now;
  });

  // 33.9.4: pictures, levels and trophies on every page
  if (!document.querySelector('script[src*="profile-pro-v33-9-4"]')) { const p = document.createElement('script'); p.src = '/assets/js/profile-pro-v33-9-4.js?v=33.9.10'; p.defer = true; document.head.append(p); }

  window.BS_SOUND = { track, play, stop, sync, ending, tracks: TRACKS, position };
})();
