import {HockeyOnline,hockeyPerspective} from './online.js?v=33.9.10-studio1';
// Air Hockey — page controller: menu, touch / mouse / keyboard hands, sound, effects, goal and result screens.
import { createGame, step, carryPuck, W, L, STRIKER_R, PUCK_R, WIN_SCORE } from './core.js?v=33.9.10-studio1';
import { createRenderer, THEMES, PUCKS, STRIKER_COLORS, drawTablePreview, drawPuckPreview, drawStrikerPreview } from './render.js?v=33.9.10-studio1';

const $ = (id) => document.getElementById(id);
const KEY = 'bs_hockey_v1';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
const save = (patch) => { try { localStorage.setItem(KEY, JSON.stringify({ ...load(), ...patch })); } catch { /* private mode */ } };
const prefs = Object.assign({ mode: 'ai', difficulty: 'mid', target: 5, theme: 'neon', puck: 'crystal', color: STRIKER_COLORS[2], muted: false, wins: 0, played: 0, best: 0 }, load());
prefs.mode=['ai','two','online'].includes(prefs.mode)?prefs.mode:'ai';
prefs.theme=Object.hasOwn(THEMES,prefs.theme)?prefs.theme:'neon';
prefs.puck=PUCKS.some(p=>p.id===prefs.puck)?prefs.puck:'crystal';
prefs.color=STRIKER_COLORS.includes(prefs.color)?prefs.color:STRIKER_COLORS[2];
prefs.difficulty=['easy','mid','hard'].includes(prefs.difficulty)?prefs.difficulty:'mid';
prefs.target=[3,5,7].includes(Number(prefs.target))?Number(prefs.target):5;
if(window.BS_AUDIO?.getSettings) prefs.muted=window.BS_AUDIO.getSettings().muted===true;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const PUCK_GLOW = { crystal: '#6adcf5', gold: '#ffd35a', plasma: '#b57cff', ember: '#ff7a2e' };

// ---------- sound (synthesised) ----------
const audio = (() => {
  let ac = null, master = null, noiseBuf = null;
  const init = () => {
    if (ac) { ac.resume?.(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try { ac = new AC(); } catch { return; } master = ac.createGain(); master.gain.value = prefs.muted ? 0 : 0.9; master.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  };
  const tone = (f, dur, type = 'sine', vol = 0.12, slide = 0, delay = 0) => {
    if (!ac) return; const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  };
  const click = (dur, freq, vol) => { if (!ac) return; const t = ac.currentTime, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 1.2; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.02); };
  return {
    init, resume: () => ac?.resume?.(), suspend: () => ac?.suspend?.(),
    mute(m) { prefs.muted = m; save({ muted: m }); if (master) master.gain.value = m ? 0 : 0.9; window.BS_AUDIO?.setMuted?.(m); },
    hit: (p) => { click(0.07, 1400 + p * 1800, 0.25 + p * 0.3); tone(220 + p * 260, 0.09, 'triangle', 0.1 + p * 0.1, -80); },
    wall: (p) => { click(0.05, 900 + p * 700, 0.12 + p * 0.12); tone(150 + p * 100, 0.06, 'sine', 0.06); },
    goal: (mine) => { (mine ? [523, 659, 784, 1047] : [392, 330, 262, 196]).forEach((f, i) => tone(f, 0.26, mine ? 'triangle' : 'sawtooth', mine ? 0.13 : 0.09, 0, i * 0.1)); },
    count: () => tone(440, 0.14, 'square', 0.09), go: () => { tone(880, 0.32, 'square', 0.11); tone(1320, 0.32, 'triangle', 0.07, 0, 0.03); },
    win: () => [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.3, 'triangle', 0.13, 0, i * 0.1)), lose: () => [392, 349, 311, 262].forEach((f, i) => tone(f, 0.34, 'sine', 0.1, 0, i * 0.18)),
  };
})();

// ---------- menu ----------
const THEME_IDS = Object.keys(THEMES);
function paintSeg(id, key, parse = (v) => v) { document.querySelectorAll('#' + id + ' button').forEach((b) => { b.setAttribute('aria-checked', String(parse(b.dataset.v) === prefs[key])); b.onclick = () => { if(key==='mode'&&prefs[key]!==parse(b.dataset.v)){online?.close();online=null;onlineRound=0;netTarget=null;$('hkRoom').hidden=true;} prefs[key] = parse(b.dataset.v); save({ [key]: prefs[key] }); renderMenu(); }; }); }
function renderMenu() {
  paintSeg('mode', 'mode'); paintSeg('diff', 'difficulty'); paintSeg('target', 'target', Number);
  $('onlineControls').hidden=prefs.mode!=='online';$('startBtn').hidden=prefs.mode==='online';
  $('diffWrap').hidden = prefs.mode !== 'ai';
  if($('hkHeroCanvas'))drawTablePreview($('hkHeroCanvas'),prefs.theme,prefs.puck,prefs.color,{width:960,height:660});
  const tw = $('themes'); tw.innerHTML = '';
  for (const id of THEME_IDS) { const b = document.createElement('button'); b.className = 'th'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(prefs.theme === id)); const cv = document.createElement('canvas'); drawTablePreview(cv, id, prefs.puck, prefs.color); b.appendChild(cv); const sp = document.createElement('span'); sp.textContent = 'طاولة ' + THEMES[id].name; b.appendChild(sp); b.onclick = () => { prefs.theme = id; save({ theme: id }); renderMenu(); }; tw.appendChild(b); }
  const pw = $('pucks'); pw.innerHTML = '';
  for (const p of PUCKS) { const b = document.createElement('button'); b.className = 'pk'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(prefs.puck === p.id)); const cv = document.createElement('canvas'); drawPuckPreview(cv, p.id, 0.3); b.appendChild(cv); const sp = document.createElement('span'); sp.textContent = p.name; b.appendChild(sp); b.onclick = () => { prefs.puck = p.id; save({ puck: p.id }); renderMenu(); }; pw.appendChild(b); }
  const sw = $('strikers'); sw.innerHTML = '';
  for (const c of STRIKER_COLORS) { const b = document.createElement('button'); b.className = 'st'; b.setAttribute('role', 'radio'); b.setAttribute('aria-label', 'لون ' + c); b.setAttribute('aria-checked', String(prefs.color === c)); const cv = document.createElement('canvas'); drawStrikerPreview(cv, c); b.appendChild(cv); b.onclick = () => { prefs.color = c; save({ color: c }); renderMenu(); }; sw.appendChild(b); }
  $('muteBtn').textContent = prefs.muted ? '🔇' : '🔊'; $('muteBtn').setAttribute('aria-pressed', String(prefs.muted));
  $('statline').textContent = prefs.played ? `لعبت ${prefs.played} · فزت ${prefs.wins}` : 'أول مباراة لك';
}
$('muteBtn').onclick = () => { audio.mute(!prefs.muted); renderMenu(); $('muteBtn2').textContent = prefs.muted ? '🔇' : '🔊'; };

// ---------- the game ----------
const canvas = $('table'), conf = $('conf'), cctx = conf.getContext('2d'), renderer = createRenderer(canvas);
let online=null,onlineRound=0,netFrame=-1,netTarget=null,netAt=0,myHitAt=-1e9,myHitId=0,netHits=[0,0],claimAt=-1e9,netShow=null,netHold=null,netDebt=0;const claimV={x:0,y:0};
// 33.9.0: online, the table is played here and set right by the room. Your striker is under your finger
// at once; the puck moves, bounces and meets your striker here between the room's words; each word of
// the room is carried on to "now" and the puck is pulled to it (a little at a time when it is close).
// 33.9.8: what your striker does to the puck is decided here and told to the room, which plays on from
// it — so the puck goes where you sent it and keeps a straight line (it bent when the room, seeing your
// hand late, struck it a little differently, and it jumped when the room missed it). Until the room has
// your strike, this page leads; after it the two agree, and only the other side's strikes move it here.
const netFix={x:0,y:0,rate:10};
const netAge=()=>Math.min(.22,((online?.rtt||110)/2+20)/1000);
function netWord(){
  if(!netTarget||!g)return;
  const room=netTarget.puck,p=g.puck,ev=netTarget.events||[],echo=netHits?.[online?.seat||0]||0;
  // your strike is still on its way to the room: the puck here is the right one
  if(myHitId>echo&&performance.now()-myHitAt<700)return;
  if(netTarget.phase!=='play'){Object.assign(p,{x:room.x,y:room.y,vx:room.vx,vy:room.vy,spin:room.spin||0});netFix.x=netFix.y=0;return;}
  const word=[...ev].reverse().find(e=>(e.type==='hit'||e.type==='touch')&&e.who===1),theirs=Boolean(word),away=p.y<L*.5;
  // 33.9.8: the other player's strike starts here where it started there, and this page plays a little
  // faster for a moment to catch up with the time the word took (it jumped ahead to "now" before)
  if(word&&Number.isFinite(word.vx)&&Number.isFinite(word.px)){
    const turn=online?.seat===1,f=turn?-1:1,ago=Math.max(0,((netTarget.serverNow||0)-(word.at||netTarget.serverNow||0))/1000)+(word.lag||0);
    Object.assign(p,{x:turn?W-word.px:word.px,y:turn?L-word.py:word.py,vx:word.vx*f,vy:word.vy*f});netHold=null;netFix.x=netFix.y=0;netDebt=Math.min(.4,netAge()+ago);return;
  }
  // the puck rests on the other striker: only that player's word moves it on (or a long silence: a miss)
  if(netHold&&!theirs&&performance.now()-netHold.at<(online?.rtt||110)+160)return;
  if(netDebt>.02)return;
  if(netHold){p.vx=netHold.vx;p.vy=netHold.vy;netHold=null;}
  const now=carryPuck(room,netAge()),dx=now.x-p.x,dy=now.y-p.y,far=Math.hypot(dx,dy);
  // the two sides of one wall: the room has bounced and this page is about to (or the other way): wait a word
  if(!theirs&&far<90&&((Math.sign(now.vx)!==Math.sign(p.vx)&&Math.abs(Math.abs(now.vx)-Math.abs(p.vx))<60&&Math.abs(now.vy-p.vy)<60)||(Math.sign(now.vy)!==Math.sign(p.vy)&&Math.abs(Math.abs(now.vy)-Math.abs(p.vy))<60&&Math.abs(now.vx-p.vx)<60)))return;
  // the same straight line as the room: its speed is taken whole (no blending, which bent the path)
  // and a small gap is closed gently along the way; a big one (the other side's strike) quickly
  if(window.__hockey)(window.__netlog||=[]).push([Math.round(performance.now()),Math.round(far),theirs?1:0,Math.round(Math.hypot(now.vx-p.vx,now.vy-p.vy))]);
  p.vx=now.vx;p.vy=now.vy;p.spin=now.spin||0;netFix.x=dx;netFix.y=dy;netFix.rate=theirs?18:away||far>160?30:far<14?4:8;
}
function netStep(dt){
  if(!netTarget)return;
  const o=netTarget.strikers[1],age=Math.min(.25,netAge()+(performance.now()-netAt)/1000),opp=g.strikers[1];
  // 33.9.2: the room speaks 30 times a second; the other striker glides to each word instead of
  // jumping to it (it stuttered), and is carried ahead only a little
  const wx=o.x+(o.vx||0)*Math.min(age,.06),wy=o.y+(o.vy||0)*Math.min(age,.06),ease=1-Math.exp(-dt*22);
  opp.tx=opp.x+(wx-opp.x)*ease;opp.ty=opp.y+(wy-opp.y)*ease;
  g.phase=netTarget.phase;g.bot={0:null,1:null};
  const extra=netDebt>0?Math.min(netDebt,dt*.7):0;netDebt=Math.max(0,netDebt-extra);
  step(g,dt+extra,{},{predict:true});
  // here: your strikes and the walls; the room: the goals and the other side's strikes
  g.events=g.events.filter(e=>e.type==='wall'||(e.type==='hit'&&e.who===0));
  const strike=g.events.some(e=>e.type==='hit'),now=performance.now();
  // 33.9.8: every touch of your striker is told to the room (a strike at once, a push a few times a second)
  if(g.touched?.[0]===g.time&&(strike||now-claimAt>45||Math.hypot(g.puck.vx-claimV.x,g.puck.vy-claimV.y)>120)){const id=online?.hit(g.puck,strike);if(id){claimV.x=g.puck.vx;claimV.y=g.puck.vy;myHitId=id;myHitAt=now;claimAt=now;netFix.x=netFix.y=0;if(window.__hockey)(window.__netlog||=[]).push([Math.round(now),'claim',strike?1:0,Math.round(g.puck.vx),Math.round(g.puck.vy)]);}}
  handleEvents();
  const k=1-Math.exp(-dt*netFix.rate);g.puck.x+=netFix.x*k;g.puck.y+=netFix.y*k;netFix.x-=netFix.x*k;netFix.y-=netFix.y*k;
  netShow=netShowPuck();
}
// 33.9.8: the puck you see is the one played here. It does not meet the other striker here (this page
// would only guess that strike, and the guess made it jump beside the striker when it was wrong): it rests
// against that striker until the other player's own word of the strike comes, then glides to its path.
function netShowPuck(){
  if(!g||g.phase!=='play'){netHold=null;return null;}
  const P=g.puck,o=g.strikers[1],dx=P.x-o.x,dy=P.y-o.y,d=Math.hypot(dx,dy),min=PUCK_R+STRIKER_R;
  if(d<min&&d>0){
    // it reached the other striker: it waits against it for that player's word
    if(!netHold&&(P.vx*dx+P.vy*dy)<0)netHold={at:performance.now(),vx:P.vx,vy:P.vy};
    P.x=o.x+dx/d*min;P.y=o.y+dy/d*min;
  }
  if(netHold){P.vx=0;P.vy=0;}
  return null;
}
let g = null, running = false, paused = false, raf = 0, last = 0, count = 0, countShown = 0, over = false, shake = 0, flash = 0, flashColor = '#fff', bannerT = 0;
let fx = [], trail = [], confetti = [], elapsed = 0,roundReceipt='';
const hands = new Map(); // pointerId → striker index
const keys = new Set();
const activeHand = [false, false];

function topInset() { const el = $('hud'), base=$('game').getBoundingClientRect(); return el ? Math.max(48,el.getBoundingClientRect().bottom-base.top+6) : 56; }
function fit() {
  const gm = $('game'), w = gm.clientWidth || window.innerWidth || 390, h = gm.clientHeight || window.visualViewport?.height || window.innerHeight || 700;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  renderer.resize(w, h, ratio); renderer.layout(w, h, topInset(), Math.max(8, Math.min(w, h) * 0.02));
  conf.width = Math.round(w * ratio); conf.height = Math.round(h * ratio); conf.style.width = w + 'px'; conf.style.height = h + 'px';
  cctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}
let fitT = 0; const refit = () => { clearTimeout(fitT); fitT = setTimeout(() => { if (running) fit(); }, 60); };
addEventListener('resize', refit); addEventListener('orientationchange', refit); screen.orientation?.addEventListener?.('change', refit);
document.addEventListener('fullscreenchange', () => { refit(); $('fsBtn').setAttribute('aria-pressed', String(!!document.fullscreenElement)); });

function names() { if(online?.state){const p=online.state.players,i=online.seat;return[p[i]?.name||'أنت',p[1-i]?.name||'الخصم'];}return prefs.mode === 'ai' ? ['أنت', 'الكمبيوتر'] : ['اللاعب 1', 'اللاعب 2']; }
function startGame(packet=null) {
  // A lost renderer can restart the current online round without requesting a rematch.
  if(!packet?.g&&!running&&online?.state?.status==='playing')packet=online.state;
  if(prefs.mode==='online'&&!packet?.g){if(online?.send({type:'ready'})){$('againBtn').disabled=true;$('againBtn').textContent=online?.state?.players?.[1-online.seat]?.bot?'نبدأ المباراة الجاية…':'بانتظار جاهزية خصمك…';}return;}
  const retryButton=$('hkReconnect');if(retryButton)retryButton.hidden=true;
  audio.init(); audio.resume();roundReceipt='practice:hockey:'+(crypto.randomUUID?.()||Date.now()+'-'+Math.random().toString(36).slice(2));$('againBtn').disabled=false;$('againBtn').textContent='العب مرة ثانية';
  g = createGame({ mode: prefs.mode==='online'?'two':prefs.mode, difficulty: prefs.difficulty, target: prefs.target, seed: (Date.now() & 0xffff) + 1 });
  if (prefs.mode === 'two') g.bot[1] = null;
  $('menu').hidden = true; $('game').hidden = false; $('result').hidden = true; $('pause').hidden = true; $('banner').className = 'banner';
  running = true; paused = false; over = false; fx = []; trail = []; confetti = []; shake = 0; flash = 0; elapsed = 0; hands.clear(); activeHand[0] = activeHand[1] = false;
  const n = names(); $('nameA').textContent = n[0]; $('nameB').textContent = n[1]; $('nameB').dataset.bot = String(Boolean(online?.state?.players?.[1 - online.seat]?.bot)); $('targetTxt').textContent = 'إلى ' + prefs.target; updateScore();
  fit(); count = 3.4; countShown = 4; g.phase = 'serve'; g.phaseT = 99; // held until the 3-2-1 ends
  cancelAnimationFrame(raf); last = performance.now(); raf = requestAnimationFrame(safeFrame);
  $('muteBtn2').textContent = prefs.muted ? '🔇' : '🔊';
  window.BS_LOCAL_REACTIONS={active:!online};window.dispatchEvent(new Event('bs-reaction-refresh'));document.body.classList.add('hockey-running');$('hkExit').hidden=!online;$('pauseBtn').hidden=!!online;if(packet?.g){count=0;g=Object.assign(g,hockeyPerspective(packet.g,online.seat));$('targetTxt').textContent='إلى '+g.target;elapsed=g.time||0;}
}
function toMenu() {netShow=null;window.BS_LOCAL_REACTIONS={active:false};window.dispatchEvent(new Event('bs-reaction-refresh'));online?.close();online=null;onlineRound=0;netTarget=null;showSearch(null);if($('hkRoom'))$('hkRoom').hidden=true;document.body.classList.remove('hockey-running'); running = false; cancelAnimationFrame(raf); if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); $('game').hidden = true; $('menu').hidden = false; renderMenu(); }
function updateScore() { $('scoreA').textContent = String(g.score[0]); $('scoreB').textContent = String(g.score[1]); }

// ----- hands -----
const isTouch = (e) => e.pointerType === 'touch' || e.pointerType === 'pen';
// 33.9.0: the striker is exactly where the finger is (it used to ride a little ahead of it)
function targetFor(e) {
  const rect = canvas.getBoundingClientRect();
  return renderer.toTable(e.clientX - rect.left, e.clientY - rect.top);
}
canvas.addEventListener('pointerdown', (e) => {
  if (!running || paused || over) return; e.preventDefault(); audio.init();
  const rect = canvas.getBoundingClientRect(), t = renderer.toTable(e.clientX - rect.left, e.clientY - rect.top);
  let idx = 0; if (prefs.mode === 'two') idx = t.y < L / 2 ? 1 : 0;
  for (const v of hands.values()) if (v === idx && prefs.mode === 'two') { /* a hand already holds it: let the new one take over */ }
  for (const [pid, v] of hands) if (v === idx) hands.delete(pid);
  hands.set(e.pointerId, idx); activeHand[idx] = true; try { canvas.setPointerCapture(e.pointerId); } catch { /* old webview */ }
  const tt = targetFor(e, idx); g.strikers[idx].tx = tt.x; g.strikers[idx].ty = tt.y;
});
canvas.addEventListener('pointermove', (e) => {
  if (!running || paused || over) return; const idx = hands.get(e.pointerId);
  if (idx === undefined) { if (e.pointerType === 'mouse' && ['ai','online'].includes(prefs.mode) && !hands.size) { const tt = targetFor(e, 0); g.strikers[0].tx = tt.x; g.strikers[0].ty = tt.y; activeHand[0] = true; } return; }
  e.preventDefault(); const tt = targetFor(e, idx); g.strikers[idx].tx = tt.x; g.strikers[idx].ty = tt.y;
});
const release = (e) => { const idx = hands.get(e.pointerId); if (idx !== undefined) { hands.delete(e.pointerId); activeHand[idx] = false; } };
canvas.addEventListener('pointerup', release); canvas.addEventListener('pointercancel', release); canvas.addEventListener('lostpointercapture', release);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('keydown', (e) => { if (!running) return; if (e.code === 'Escape' || e.code === 'KeyP') { setPaused(!paused); return; } if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS'].includes(e.code)) { keys.add(e.code); e.preventDefault(); } });
addEventListener('keyup', (e) => keys.delete(e.code));
function keyboardHand(dt) {
  if (!keys.size || paused || !g || over) return;
  const dir = (c) => keys.has(c) ? 1 : 0, vx = dir('ArrowRight') + dir('KeyD') - dir('ArrowLeft') - dir('KeyA'), vy = dir('ArrowDown') + dir('KeyS') - dir('ArrowUp') - dir('KeyW');
  const a = renderer.toTable(0, 0), b = renderer.toTable(vx, vy), k = 1100 * dt, st = g.strikers[0]; activeHand[0] = true;
  st.tx = (hands.size ? st.tx : st.x) + (b.x - a.x) * k; st.ty = (hands.size ? st.ty : st.y) + (b.y - a.y) * k;
}

// ----- effects -----
function spark(x, y, n, color, speed) { for (let i = 0; i < n && fx.length < 260; i++) { const a = Math.random() * 6.283, v = speed * (0.3 + Math.random()); fx.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.35 + Math.random() * 0.3, max: 0.65, color, size: 3 + Math.random() * 5 }); } }
function ring(x, y, color, grow = 90) { fx.push({ x, y, vx: 0, vy: 0, life: 0.35, max: 0.35, color, size: 12, grow, ring: true }); }
function burstConfetti(n, colors) { const w = conf.clientWidth || innerWidth; for (let i = 0; i < n; i++) confetti.push({ x: Math.random() * w, y: -20 - Math.random() * 100, vx: (Math.random() - 0.5) * 200, vy: 120 + Math.random() * 260, life: 3 + Math.random() * 2, max: 5, color: colors[i % colors.length], size: 5 + Math.random() * 7, rot: Math.random() * 6, spin: (Math.random() - 0.5) * 12 }); }
function drawConfetti(dt) {
  cctx.clearRect(0, 0, conf.clientWidth, conf.clientHeight);
  for (let i = confetti.length - 1; i >= 0; i--) { const p = confetti[i]; p.life -= dt; if (p.life <= 0 || p.y > conf.clientHeight + 30) { confetti.splice(i, 1); continue; } p.vy += 300 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.spin * dt; cctx.globalAlpha = Math.min(1, p.life * 1.5); cctx.fillStyle = p.color; cctx.save(); cctx.translate(p.x, p.y); cctx.rotate(p.rot); cctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); cctx.restore(); }
  cctx.globalAlpha = 1;
}
const buzz = (ms) => { try { navigator.vibrate?.(ms); } catch { /* no haptics */ } };
function banner(text, cls = '', ms = 1500) { const b = $('banner'); b.textContent = text; b.className = 'banner show ' + cls; bannerT = ms / 1000; }

function handleEvents() {
  for (const e of g.events) {
    if (e.type === 'hit') { audio.hit(e.power); spark(e.x, e.y, 6 + Math.round(e.power * 14), PUCK_GLOW[prefs.puck], 380 + e.power * 700); ring(e.x, e.y, '#ffffff', 60 + e.power * 80); if (!reduced) shake = Math.max(shake, e.power * 10); if (e.who === 0) buzz(10 + e.power * 20); }
    else if (e.type === 'wall') { audio.wall(e.power); spark(e.x, e.y, 3, '#ffffff', 220); }
    else if (e.type === 'goal') {
      const mine = ['ai','online'].includes(prefs.mode) ? e.scorer === 0 : true; audio.goal(mine); updateScore();
      const col = e.scorer === 0 ? prefs.color : '#d8e2ff'; flashColor = e.scorer === 0 ? prefs.color : '#ffffff'; flash = reduced ? 0 : 0.55; shake = reduced ? 0 : 18; buzz(120);
      spark(e.x, e.scorer === 0 ? 0 : L, 40, PUCK_GLOW[prefs.puck], 900); ring(e.x, e.scorer === 0 ? 0 : L, col, 220);
      banner(['ai','online'].includes(prefs.mode) ? (e.scorer === 0 ? 'هدف! 🎯' : 'هدف عليك') : 'هدف!', e.scorer === 0 ? 'win' : 'lose', 1500);
      if (!reduced && (mine)) burstConfetti(60, [prefs.color, '#ffffff', '#ffd35a', PUCK_GLOW[prefs.puck]]);
    }
    else if (e.type === 'play') { /* the serve is released */ }
    else if (e.type === 'over') showResult(e.winner);
  }
}

function showResult(winner) {
  if (over) return; over = true;
  const ai = ['ai','online'].includes(prefs.mode),draw=winner<0,mine=!draw&&(ai?winner===0:true);
  if(online)window.BS_CAREER?.refresh?.()?.catch?.(()=>{});else window.BS_CAREER?.record?.({id:roundReceipt,game:'hockey',win:winner===0})?.catch?.(()=>{});
  prefs.played++; if (ai && winner === 0) prefs.wins++; save({ played: prefs.played, wins: prefs.wins });
  $('resTitle').textContent = draw?'انتهت بالتعادل':ai ? (winner === 0 ? 'فزت بالمباراة! 🏆' : (online?'فاز خصمك':'فاز الكمبيوتر')) : `فاز ${names()[winner]}! 🏆`;
  $('resEyebrow').textContent = draw?'مواجهة متكافئة':ai ? (winner === 0 ? 'مبروك' : 'حاول مرة ثانية') : 'نهاية المباراة';
  $('resScore').textContent = `${g.score[0]} : ${g.score[1]}`;
  $('resStats').textContent = `أطول تبادل ${g.maxRally} ضربة · المدة ${Math.floor(elapsed / 60)}:${String(Math.floor(elapsed % 60)).padStart(2, '0')}`;
  $('resCard').classList.toggle('won', !draw&&(mine && winner === 0 || !ai)); $('result').hidden = false;
  if (mine) { audio.win(); if (!reduced) { burstConfetti(150, [prefs.color, '#ffffff', '#ffd35a', '#7df0c9', '#ff4fd8']); setTimeout(() => burstConfetti(90, [prefs.color, '#ffd35a', '#ffffff']), 700); } buzz(200); } else if(!draw)audio.lose();
}

// A drawing failure leaves a recoverable screen instead of an empty canvas.
function safeFrame(now){
 try{loop(now);}catch(error){
  cancelAnimationFrame(raf);running=false;
  console.error('Hockey render failed',error);
  $('result').hidden=false;$('resTitle').textContent='تعذّر رسم الطاولة';
  $('resEyebrow').textContent='يمكنك إعادة المحاولة';$('resScore').textContent='';
  $('resStats').textContent='اضغط إعادة المباراة أو ارجع إلى القائمة.';
  $('againBtn').disabled=false;$('againBtn').textContent='إعادة المباراة';
 }
}
window.addEventListener('pageshow',()=>{if(running){fit();last=performance.now();cancelAnimationFrame(raf);raf=requestAnimationFrame(safeFrame);}});
window.visualViewport?.addEventListener('resize',refit);
// ----- loop -----
function loop(now) {
  raf = requestAnimationFrame(safeFrame);
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = Math.max(last, now);
  if (!running) return;
  if (!paused) {
    if (count > 0) { // 3, 2, 1, go
      count -= dt; const n = Math.ceil(count - 0.4);
      if (n !== countShown && n >= 1) { countShown = n; banner(String(n), 'count', 900); audio.count(); }
      if (count <= 0.4 && countShown !== 0) { countShown = 0; banner('انطلق!', 'go', 800); audio.go(); g.phaseT = 0.4; }
    } else if(online){if(!over)elapsed=netTarget?.time||elapsed;keyboardHand(dt);if(!over)online.input(g.strikers[0].tx,g.strikers[0].ty);netStep(dt);} else if (!over || g.phase === 'over') { if (!over) elapsed += dt; keyboardHand(dt); step(g, dt, {}); handleEvents(); }
    if (count > 0) { keyboardHand(dt); for (let i = 0; i < 2; i++) { const st = g.strikers[i], k = g.bot?.[i] || (online && i === 1) ? Math.min(1, dt * 14) : 1; st.x += (st.tx - st.x) * k; st.y += (st.ty - st.y) * k; const b = i === 0 ? { y0: L / 2 + 20, y1: L - STRIKER_R } : { y0: STRIKER_R, y1: L / 2 - 20 }; st.y = Math.max(b.y0, Math.min(b.y1, st.y)); st.x = Math.max(STRIKER_R, Math.min(W - STRIKER_R, st.x)); } }
    // trail follows a fast puck
    const sp = Math.hypot(g.puck.vx, g.puck.vy), seen = online && netShow ? netShow : g.puck; if (sp > 500 && g.phase === 'play') trail.push({ x: seen.x, y: seen.y, a: 1 });
    for (const t of trail) t.a -= dt * 3.2; trail = trail.filter((t) => t.a > 0).slice(-18);
    for (const p of fx) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.94; p.vy *= 0.94; } fx = fx.filter((p) => p.life > 0);
    shake = Math.max(0, shake - dt * 40); flash = Math.max(0, flash - dt * 1.8);
    if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $('banner').className = 'banner'; }
  }
  const real = online && netShow && g ? { x: g.puck.x, y: g.puck.y } : null; if (real) { g.puck.x = netShow.x; g.puck.y = netShow.y; }
  renderer.draw(g, { theme: prefs.theme, puck: prefs.puck, puckColor: PUCK_GLOW[prefs.puck], strikerColors: [prefs.color, ['ai','online'].includes(prefs.mode) ? '#d8e2ff' : '#ff8a3d'], time: now / 1000, shake, flash, flashColor, trail, fx, activeHand });
  if (real) { g.puck.x = real.x; g.puck.y = real.y; }
  drawConfetti(dt);
}

// ----- buttons -----
function setPaused(p) { if(online)return; if (!running || over) return; paused = p; $('pause').hidden = !p; if (p) audio.suspend(); else { audio.resume(); last = performance.now(); } }
$('pauseBtn').onclick = () => setPaused(true); $('resumeBtn').onclick = () => setPaused(false);
$('restartBtn').onclick = startGame; $('quitBtn').onclick = toMenu; $('startBtn').onclick = startGame; $('againBtn').onclick = startGame; $('menuBtn').onclick = toMenu;
$('muteBtn2').onclick = () => { audio.mute(!prefs.muted); $('muteBtn2').textContent = prefs.muted ? '🔇' : '🔊'; };
const canFs = !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
if (!canFs) $('fsBtn').hidden = true;
$('fsBtn').onclick = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await (document.documentElement.requestFullscreen?.() || document.documentElement.webkitRequestFullscreen?.()); } catch { /* the browser said no */ } };
addEventListener('blur', () => { if (running && !over && count <= 0) setPaused(true); });
document.addEventListener('visibilitychange', () => { if (document.hidden && running && !over && count <= 0) setPaused(true); });

const networkStatus=text=>{$('hkConnection').textContent=text;const live=$('hkLiveConnection');if(live){live.hidden=!text||prefs.mode!=='online';live.textContent=text;live.dataset.connected=String(text==='متصل');}const retry=$('hkReconnect');if(retry)retry.hidden=!online?.token||!running||!text||text==='متصل'||text.includes('بانتظار');if(running&&online&&text!=='متصل'&&!text.includes('بانتظار لاعب'))banner(text,'network',2000);};
const reconnect=document.createElement('button');reconnect.id='hkReconnect';reconnect.type='button';reconnect.hidden=true;reconnect.className='hk-reconnect';reconnect.textContent='إعادة الاتصال';reconnect.onclick=()=>online?.resume({force:true})?.catch(e=>networkStatus(e.message));$('game').append(reconnect);
// 33.8.0: while a quick match waits, the seconds before a computer opponent sits down
let searchTimer=0;
function showSearch(packet){const box=$('hkSearch');if(!box)return;clearInterval(searchTimer);const waiting=packet?.status==='lobby'&&Number.isFinite(packet.botIn);box.hidden=!waiting;$('hkRoom').classList.toggle('is-quick',waiting);if(!waiting)return;const until=Date.now()+packet.botIn;const paint=()=>{const left=Math.max(0,Math.ceil((until-Date.now())/1000));box.textContent=left?'نبحث لك عن منافس… '+left:'لقينا لك منافس…';if(!left)clearInterval(searchTimer);};paint();searchTimer=setInterval(paint,500);}
const NAME_KEY='bs-player-name-v33';
try{const saved=localStorage.getItem(NAME_KEY);if(saved&&!$('hkName').value)$('hkName').value=saved.slice(0,20);}catch{}
$('hkName').addEventListener('change',()=>{const v=$('hkName').value.trim().slice(0,20);try{if(v)localStorage.setItem(NAME_KEY,v);}catch{}});
let enteringOnline=false;
async function enterOnline(kind){if(enteringOnline)return;enteringOnline=true;['hkQuick','hkCreate','hkJoin'].forEach(id=>$(id).disabled=true);try{audio.init();online?.close();onlineRound=0;online=new HockeyOnline({onStatus:networkStatus,onState:packet=>{showSearch(packet);if(packet.status==='lobby'||packet.status==='finished'&&!packet.g){$('hkRoom').hidden=false;$('hkRoomCode').textContent=packet.code;$('hkPeople').textContent=packet.players.map(p=>p.name+(p.bot||p.connected?' · متصل':' · انقطع')).join(' × ');}if(packet.g){if(packet.round!==onlineRound){onlineRound=packet.round;netFrame=packet.frame;startGame(packet);netTarget=hockeyPerspective(packet.g,online.seat);netTarget.serverNow=packet.serverNow;netHits=packet.hits||[0,0];netAt=performance.now();netShow=null;netHold=null;netDebt=0;g.remote=[false,true];netFix.x=netFix.y=0;myHitAt=-1e9;myHitId=0;claimAt=-1e9;updateScore();}else{netTarget=hockeyPerspective(packet.g,online.seat);netTarget.serverNow=packet.serverNow;netHits=packet.hits||[0,0];netAt=performance.now();g.remote=[false,true];g.score=[...netTarget.score];g.phase=netTarget.phase;g.winner=netTarget.winner;g.maxRally=netTarget.maxRally;if(packet.frame!==netFrame){netFrame=packet.frame;if(count<=0)netWord();g.events=(netTarget.events||[]).filter(e=>e.type!=='wall'&&!(e.type==='hit'&&e.who===0));handleEvents();}updateScore();}if(packet.status==='finished'&&!over)showResult(g.winner);}}});await online.enter(kind,{name:window.BS_SOCIAL?.accountName?.()||$('hkName').value||'لاعب',target:prefs.target,code:$('hkCode').value.normalize('NFKC').replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632))});}catch(e){if(e.name!=='AbortError')networkStatus(e.message);}finally{enteringOnline=false;['hkQuick','hkCreate','hkJoin'].forEach(id=>$(id).disabled=false);}}
$('hkQuick').onclick=()=>enterOnline('quick');$('hkCreate').onclick=()=>enterOnline('create');$('hkJoin').onclick=()=>/^95[0-9]{4}$/.test($('hkCode').value.normalize('NFKC').replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)))?enterOnline('join'):networkStatus('اكتب رمز غرفة الهوكي المكوّن من 6 أرقام');
$('hkCode').addEventListener('keydown',event=>{if(event.key==='Enter')$('hkJoin').click();});
$('hkCopy').onclick=async()=>{try{await navigator.clipboard.writeText(location.origin+'/hockey?room='+online.code);networkStatus('تم نسخ الرابط');}catch{networkStatus('رمز غرفتك: '+online.code);}};$('hkCancel').onclick=()=>{online?.close();online=null;showSearch(null);$('hkRoom').hidden=true;networkStatus('');};$('hkExit').onclick=toMenu;
window.addEventListener('pagehide',()=>online?.close({leave:false}));
window.addEventListener('pageshow',()=>online?.resume?.()?.catch?.(e=>networkStatus(e.message)));
window.addEventListener('online',()=>online?.resume?.()?.catch?.(e=>networkStatus(e.message)));
renderMenu();
const invited=new URLSearchParams(location.search).get('room');if(/^95[0-9]{4}$/.test(invited||'')){prefs.mode='online';$('hkCode').value=invited;renderMenu();enterOnline('join');}
if (location.search.includes('debug')) window.__hockey = { get g() { return g; }, get shown() { return netShow || g?.puck; }, start: startGame, prefs, hands, renderer, setCount(v) { count = v; } };

window.addEventListener('bs-audio-change',()=>{const m=window.BS_AUDIO?.getSettings?.().muted;if(typeof m==='boolean'&&m!==prefs.muted){prefs.muted=m;save({muted:m});audio.mute(m);}});
