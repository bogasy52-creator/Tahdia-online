/* لعبة العباقرة 33.18.0 — «برج التحديات»: the 3D scene.
   Built on the three.js build the project already ships (assets/vendor). Every world has its own sky,
   light, ground far below, floating scenery and drifting particles; every challenge has its own
   pieces; runners are small toy figures with interchangeable headwear. All art is drawn here. */
import * as T from '../../vendor/three-r187-pegs.js';
import { worldById, offset, blinkOn, hammerAt, rollAt, ballAt, barAngle, windAt, rng } from './course.js?v=33.18.0';

const TAU = Math.PI * 2;
const col = (c) => new T.Color(c);
function canvasTex(size, draw, repeat = [1, 1]) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  draw(cv.getContext('2d'), size);
  const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(...repeat); t.anisotropy = 4;
  return t;
}
let dotTex = null;
const dot = () => dotTex || (dotTex = canvasTex(32, (g, s) => { const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); r.addColorStop(0, '#fff'); r.addColorStop(0.45, '#ffffffcc'); r.addColorStop(1, '#fff0'); g.fillStyle = r; g.fillRect(0, 0, s, s); }));
const shade = (hex, f) => { const c = col(hex); c.multiplyScalar(f); return '#' + c.getHexString(); };

/* ------------------------------------------------------------------ characters */
export const CHARACTERS = Object.freeze([
  { id: 'zafran', name: 'زعفران', body: '#ffc83d', trim: '#ff8a1f', stars: 0 },
  { id: 'nakhla', name: 'نخلة', body: '#5cc46e', trim: '#2f8a45', stars: 12, top: 'leaves' },
  { id: 'thalj', name: 'ثلجي', body: '#eaf6ff', trim: '#59b8ff', stars: 30, top: 'muffs' },
  { id: 'halawa', name: 'حلاوة', body: '#ff8fc8', trim: '#ffffff', stars: 60, top: 'swirl' },
  { id: 'qamar', name: 'قمر', body: '#4146b8', trim: '#9df6ff', stars: 100, top: 'antenna' },
  { id: 'jamra', name: 'جمرة', body: '#ff5a36', trim: '#ffd23e', stars: 150, top: 'flame' },
  { id: 'sadu', name: 'سدو', body: '#b3262c', trim: '#1d1414', stars: 210, pattern: 'sadu' },
  { id: 'dhahab', name: 'الذهبي', body: '#ffd45a', trim: '#b8860b', stars: 270, metal: true },
]);
export const OUTFITS = Object.freeze([
  { id: 'none', slot: 'hat', name: 'بدون', price: 0 },
  { id: 'taqiya', slot: 'hat', name: 'طاقية', price: 60 },
  { id: 'cap', slot: 'hat', name: 'كاب', price: 80 },
  { id: 'beanie', slot: 'hat', name: 'طاقية صوف', price: 90 },
  { id: 'shmagh', slot: 'hat', name: 'شماغ وعقال', price: 120 },
  { id: 'horns', slot: 'hat', name: 'قرون حلاوة', price: 150 },
  { id: 'helmet', slot: 'hat', name: 'خوذة فضاء', price: 260 },
  { id: 'crown', slot: 'hat', name: 'تاج', price: 400 },
  { id: 'noface', slot: 'face', name: 'بدون', price: 0 },
  { id: 'shades', slot: 'face', name: 'نظارة شمس', price: 70 },
  { id: 'litham', slot: 'face', name: 'لثام', price: 110 },
  { id: 'stars', slot: 'face', name: 'نظارة نجوم', price: 180 },
]);
const charById = (id) => CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];

let saduTex = null, shmaghTex = null;
const sadu = () => saduTex || (saduTex = canvasTex(128, (g, s) => {
  g.fillStyle = '#b3262c'; g.fillRect(0, 0, s, s);
  for (let row = 0; row < 4; row++) { const y = row * 32; g.fillStyle = row % 2 ? '#1d1414' : '#f4e9d4'; g.fillRect(0, y + 12, s, 8); g.fillStyle = row % 2 ? '#f4e9d4' : '#1d1414'; for (let x = 0; x < s; x += 16) { g.beginPath(); g.moveTo(x, y + 12); g.lineTo(x + 8, y + 4); g.lineTo(x + 16, y + 12); g.fill(); g.beginPath(); g.moveTo(x, y + 20); g.lineTo(x + 8, y + 28); g.lineTo(x + 16, y + 20); g.fill(); } }
}, [2, 1]));
const shmagh = () => shmaghTex || (shmaghTex = canvasTex(64, (g, s) => { g.fillStyle = '#fff'; g.fillRect(0, 0, s, s); g.fillStyle = '#d0202a'; for (let i = 0; i < s; i += 8) { g.fillRect(i, 0, 3, s); g.fillRect(0, i, s, 3); } }, [3, 3]));

export function buildCharacter(look = {}) {
  const ch = charById(look.char), root = new T.Group(), body = new T.Group(); root.add(body);
  const mat = new T.MeshStandardMaterial({ color: ch.body, roughness: ch.metal ? 0.25 : 0.55, metalness: ch.metal ? 0.85 : 0.05, map: ch.pattern === 'sadu' ? sadu() : null });
  const trim = new T.MeshStandardMaterial({ color: ch.trim, roughness: 0.5, metalness: ch.metal ? 0.7 : 0.05 });
  const white = new T.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3 }), dark = new T.MeshStandardMaterial({ color: '#161226', roughness: 0.4 });
  const prof = [[0, 0.1], [0.3, 0.12], [0.42, 0.3], [0.45, 0.55], [0.4, 0.82], [0.27, 0.98], [0, 1.02]].map(([x, y]) => new T.Vector2(x, y));
  const torso = new T.Mesh(new T.LatheGeometry(prof, 28), mat); torso.castShadow = true; body.add(torso);
  const belt = new T.Mesh(new T.TorusGeometry(0.43, 0.05, 8, 28), trim); belt.rotation.x = Math.PI / 2; belt.position.y = 0.5; body.add(belt);
  const head = new T.Group(); head.position.y = 1.22; body.add(head);
  const skull = new T.Mesh(new T.SphereGeometry(0.34, 28, 20), mat); skull.castShadow = true; head.add(skull);
  for (const s of [-1, 1]) {
    const eye = new T.Mesh(new T.SphereGeometry(0.095, 16, 12), white); eye.position.set(s * 0.12, 0.05, 0.28); eye.scale.z = 0.6; head.add(eye);
    const pupil = new T.Mesh(new T.SphereGeometry(0.05, 12, 10), dark); pupil.position.set(s * 0.12, 0.05, 0.34); head.add(pupil);
    const cheek = new T.Mesh(new T.SphereGeometry(0.05, 10, 8), new T.MeshStandardMaterial({ color: '#ff8aa0', roughness: 0.8 })); cheek.position.set(s * 0.21, -0.07, 0.25); cheek.scale.z = 0.4; head.add(cheek);
  }
  const smile = new T.Mesh(new T.TorusGeometry(0.07, 0.016, 6, 16, Math.PI), dark); smile.position.set(0, -0.08, 0.31); smile.rotation.z = Math.PI; head.add(smile);
  const hands = [-1, 1].map((s) => { const h = new T.Mesh(new T.SphereGeometry(0.12, 14, 10), trim); h.position.set(s * 0.55, 0.6, 0.02); h.castShadow = true; body.add(h); return h; });
  const feet = [-1, 1].map((s) => { const f = new T.Mesh(new T.RoundedBoxGeometry(0.22, 0.14, 0.34, 2, 0.06), trim); f.position.set(s * 0.17, 0.07, 0.04); f.castShadow = true; root.add(f); return f; });
  // the character's own top
  const top = new T.Group(); head.add(top);
  if (ch.top === 'leaves') for (let i = 0; i < 5; i++) { const l = new T.Mesh(new T.CylinderGeometry(0, 0.06, 0.42, 6), trim); l.position.set(0, 0.36, 0); l.rotation.set(0.7 * Math.cos(i * 1.26), 0, 0.7 * Math.sin(i * 1.26)); l.position.x += Math.sin(i * 1.26) * 0.12; l.position.z += Math.cos(i * 1.26) * 0.12; top.add(l); }
  if (ch.top === 'muffs') { const band = new T.Mesh(new T.TorusGeometry(0.33, 0.03, 6, 24, Math.PI), trim); band.position.y = 0.05; top.add(band); for (const s of [-1, 1]) { const m = new T.Mesh(new T.SphereGeometry(0.11, 12, 10), trim); m.position.set(s * 0.33, 0.02, 0); top.add(m); } }
  if (ch.top === 'swirl') { const sw = new T.Mesh(new T.TorusGeometry(0.12, 0.05, 8, 20), trim); sw.position.y = 0.38; sw.rotation.x = Math.PI / 2; top.add(sw); }
  if (ch.top === 'antenna') { const a = new T.Mesh(new T.CylinderGeometry(0.015, 0.015, 0.3, 6), dark); a.position.y = 0.45; const b = new T.Mesh(new T.SphereGeometry(0.06, 10, 8), new T.MeshStandardMaterial({ color: ch.trim, emissive: ch.trim, emissiveIntensity: 1.2 })); b.position.y = 0.62; top.add(a, b); }
  if (ch.top === 'flame') for (let i = 0; i < 3; i++) { const f = new T.Mesh(new T.CylinderGeometry(0, 0.09 - i * 0.015, 0.36 - i * 0.06, 8), new T.MeshStandardMaterial({ color: i ? '#ffd23e' : '#ff8a1f', emissive: '#ff6a00', emissiveIntensity: 0.6 })); f.position.set(0, 0.42, -0.08 + i * 0.09); f.rotation.x = -0.3; top.add(f); }
  const hat = new T.Group(); head.add(hat); dressHat(hat, look.hat, ch);
  const face = new T.Group(); head.add(face); dressFace(face, look.face);
  if (look.hat && look.hat !== 'none' && ['shmagh', 'helmet', 'beanie', 'taqiya', 'cap', 'crown'].includes(look.hat)) top.visible = false;
  root.userData = { body, head, hands, feet, mat };
  return root;
}
function dressHat(g, id, ch) {
  const m = (c, o = {}) => new T.MeshStandardMaterial({ color: c, roughness: 0.5, ...o });
  if (id === 'taqiya') { const t = new T.Mesh(new T.SphereGeometry(0.35, 24, 12, 0, TAU, 0, Math.PI / 2.3), m('#f7f4ec')); t.position.y = 0.04; g.add(t); }
  if (id === 'cap') { const c = new T.Mesh(new T.SphereGeometry(0.355, 24, 12, 0, TAU, 0, Math.PI / 2.2), m('#2f6fe0')); c.position.y = 0.03; const v = new T.Mesh(new T.CylinderGeometry(0.26, 0.26, 0.03, 20, 1, false, -Math.PI / 2, Math.PI), m('#244fae')); v.position.set(0, 0.08, 0.2); g.add(c, v); }
  if (id === 'beanie') { const b = new T.Mesh(new T.SphereGeometry(0.36, 24, 12, 0, TAU, 0, Math.PI / 2.1), m('#e3423c', { roughness: 0.9 })); b.position.y = 0.03; const p = new T.Mesh(new T.SphereGeometry(0.09, 12, 10), m('#fff', { roughness: 1 })); p.position.y = 0.42; const r = new T.Mesh(new T.TorusGeometry(0.34, 0.05, 8, 28), m('#fff', { roughness: 0.9 })); r.rotation.x = Math.PI / 2; r.position.y = 0.06; g.add(b, p, r); }
  if (id === 'shmagh') {
    const cloth = new T.Mesh(new T.LatheGeometry([[0.0, 0.42], [0.25, 0.38], [0.37, 0.22], [0.4, 0.0], [0.42, -0.25], [0.46, -0.42]].map(([x, y]) => new T.Vector2(x, y)), 28, Math.PI * 0.35, Math.PI * 1.3), new T.MeshStandardMaterial({ map: shmagh(), side: T.DoubleSide, roughness: 0.85 }));
    cloth.rotation.y = Math.PI; g.add(cloth);
    for (const y of [0.3, 0.35]) { const a = new T.Mesh(new T.TorusGeometry(0.27, 0.035, 8, 28), m('#141018', { roughness: 0.6 })); a.rotation.x = Math.PI / 2; a.position.y = y; g.add(a); }
  }
  if (id === 'horns') for (const s of [-1, 1]) { const h = new T.Mesh(new T.CylinderGeometry(0, 0.07, 0.34, 10), m(s > 0 ? '#ff6fb7' : '#7ee7d0')); h.position.set(s * 0.18, 0.36, 0); h.rotation.z = -s * 0.35; g.add(h); }
  if (id === 'helmet') { const h = new T.Mesh(new T.SphereGeometry(0.47, 28, 20), new T.MeshPhysicalMaterial({ color: '#bfefff', transparent: true, opacity: 0.32, roughness: 0.05, metalness: 0, clearcoat: 1 })); const ring = new T.Mesh(new T.TorusGeometry(0.4, 0.05, 10, 28), m('#e9ecf5', { metalness: 0.6, roughness: 0.3 })); ring.rotation.x = Math.PI / 2; ring.position.y = -0.3; g.add(h, ring); }
  if (id === 'crown') {
    const gold = m('#ffd23e', { metalness: 0.9, roughness: 0.25 }), band = new T.Mesh(new T.CylinderGeometry(0.26, 0.28, 0.16, 24, 1, true), gold); band.position.y = 0.36; g.add(band);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU, p = new T.Mesh(new T.CylinderGeometry(0, 0.06, 0.16, 6), gold); p.position.set(Math.sin(a) * 0.26, 0.5, Math.cos(a) * 0.26); g.add(p); const j = new T.Mesh(new T.SphereGeometry(0.035, 8, 6), m(i % 2 ? '#e0313b' : '#2fb5a8', { metalness: 0.2, roughness: 0.2 })); j.position.set(Math.sin(a) * 0.27, 0.36, Math.cos(a) * 0.27); g.add(j); }
  }
}
function dressFace(g, id) {
  if (id === 'shades' || id === 'stars') {
    const mat = new T.MeshStandardMaterial({ color: id === 'stars' ? '#ffcf3e' : '#141018', metalness: 0.4, roughness: 0.2, emissive: id === 'stars' ? '#ff9e00' : '#000', emissiveIntensity: 0.3 });
    for (const s of [-1, 1]) { const l = new T.Mesh(new T.CylinderGeometry(0.1, 0.1, 0.03, id === 'stars' ? 5 : 20), mat); l.rotation.x = Math.PI / 2; l.position.set(s * 0.12, 0.06, 0.33); g.add(l); }
    const b = new T.Mesh(new T.CylinderGeometry(0.012, 0.012, 0.08, 6), mat); b.rotation.z = Math.PI / 2; b.position.set(0, 0.07, 0.34); g.add(b);
  }
  if (id === 'litham') { const l = new T.Mesh(new T.SphereGeometry(0.352, 24, 12, -Math.PI * 0.55, Math.PI * 1.1, Math.PI * 0.52, Math.PI * 0.4), new T.MeshStandardMaterial({ color: '#1b1622', roughness: 0.9, side: T.DoubleSide })); g.add(l); }
}
/** Moves a figure's limbs: run, jump, fall, stunned or idle; `phase` is the stride. */
export function animateCharacter(fig, anim, phase, t) {
  const { body, head, hands, feet } = fig.userData, s = Math.sin(phase * 2.2);
  if (anim === 'run') { feet[0].position.z = 0.04 + s * 0.2; feet[1].position.z = 0.04 - s * 0.2; feet[0].position.y = 0.07 + Math.max(0, s) * 0.1; feet[1].position.y = 0.07 + Math.max(0, -s) * 0.1; hands[0].position.z = -s * 0.25; hands[1].position.z = s * 0.25; body.position.y = Math.abs(s) * 0.07; body.rotation.x = 0.12; }
  else if (anim === 'jump' || anim === 'fall') { feet.forEach((f, i) => { f.position.z = i ? -0.08 : 0.16; f.position.y = 0.12; }); hands.forEach((h) => { h.position.y = 0.95; h.position.z = 0; }); body.rotation.x = anim === 'jump' ? -0.1 : 0.05; body.position.y = 0; }
  else if (anim === 'stun') { body.rotation.z = Math.sin(t * 18) * 0.25; head.rotation.y = Math.sin(t * 9) * 0.6; }
  else { feet.forEach((f) => { f.position.z = 0.04; f.position.y = 0.07; }); hands.forEach((h) => { h.position.z = 0.02; h.position.y = 0.6 + Math.sin(t * 2.4) * 0.03; }); body.position.y = Math.sin(t * 2.4) * 0.02; body.rotation.x = 0; }
  if (anim !== 'jump' && anim !== 'fall') hands.forEach((h) => { h.position.y = anim === 'run' ? 0.62 : h.position.y; });
  if (anim !== 'stun') { body.rotation.z *= 0.8; head.rotation.y *= 0.8; }
}

/* ------------------------------------------------------------------ the scene */
export class TowerScene {
  constructor(canvas) {
    this.canvas = canvas;
    const r = this.renderer = new T.WebGLRenderer({ canvas, antialias: (globalThis.devicePixelRatio || 1) < 2, powerPreference: 'high-performance' });
    r.outputColorSpace = T.SRGBColorSpace; r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = 0.98;
    r.shadowMap.enabled = true; r.shadowMap.type = T.PCFSoftShadowMap;
    this.scene = new T.Scene(); this.scene.environmentIntensity = 0.5;
    const pm = new T.PMREMGenerator(r); this.scene.environment = pm.fromScene(new T.RoomEnvironment(), 0.04).texture; pm.dispose();
    this.camera = new T.PerspectiveCamera(60, 1, 0.1, 900);
    this.hemi = new T.HemisphereLight('#ffffff', '#445', 1.1); this.scene.add(this.hemi);
    const sun = this.sun = new T.DirectionalLight('#fff4dd', 2.2); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 60 }); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
    this.scene.add(sun, sun.target);
    this.course = null; this.group = null; this.runners = new Map(); this.camPos = new T.Vector3(0, 6, -9); this.look = new T.Vector3();
    this.bursts = []; this.quality = (globalThis.devicePixelRatio || 1) > 2.5 ? 1.5 : 1.75;
    this.resize();
  }
  resize() {
    const w = this.canvas.clientWidth || innerWidth, h = this.canvas.clientHeight || innerHeight;
    this.renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, this.quality)); this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.fov = w / h < 0.8 ? 68 : 56; this.camera.updateProjectionMatrix();
  }
  clear() { if (this.group) { this.scene.remove(this.group); this.group.traverse((o) => { o.geometry?.dispose?.(); }); } this.group = null; this.dyn = []; this.pads = []; this.doors = new Map(); this.bumps = new Map(); this.winds = []; this.gemMeshes = []; this.crownMesh = null; this.lavaTex = null; this.stars = null; this.dust = null; this.skyMesh = null; this.runners.forEach((r) => this.scene.remove(r.fig)); this.runners.clear(); }
  padKick(x, z) { let best = null, bd = 3; for (const pd of this.pads) { const d = Math.hypot(pd.p.x - x, pd.p.z - z); if (d < bd) { bd = d; best = pd; } } if (best) best.kick = 1; }

  /** Builds the world and every piece of a course. */
  setCourse(course) {
    this.clear(); this.course = course;
    const W = this.W = worldById(course.world), g = this.group = new T.Group(); this.scene.add(g); this.dyn = [];
    this.scene.fog = { isFog: true, color: col(W.fog), near: 40, far: W.stars ? 260 : 170, name: '', clone() { return this; }, toJSON() { return {}; } };
    this.hemi.color.set(W.sky[1]); this.hemi.groundColor.set(shade(W.floor, 0.4)); this.hemi.intensity = W.stars || W.lava ? 0.55 : 0.8;
    this.sun.color.set(W.lava ? '#ffb27a' : W.stars ? '#c9d3ff' : '#fff4dd'); this.sun.intensity = W.lava ? 1.5 : W.stars ? 1.6 : 2.1;
    this.sky(W); this.materials(W);
    const cols = [];
    for (const p of course.pieces) { const m = this.piece(p, W); if (m) g.add(m); if ((p.k === 'box' && !p.mv && !/blink|crumble|wall|push/.test(p.m)) || (p.k === 'disk' && !p.w)) cols.push(p); }
    this.columns(cols, course, W); this.scenery(course, W); this.particles(W);
  }
  sky(W) {
    const geo = new T.SphereGeometry(600, 32, 18), c = [], a = geo.attributes.position, top = col(W.sky[0]), low = col(W.sky[1]);
    for (let i = 0; i < a.count; i++) { const f = Math.pow(Math.max(0, Math.min(1, a.getY(i) / 600 + 0.08)), 0.55); const k = low.clone().lerp(top, f); c.push(k.r, k.g, k.b); }
    geo.setAttribute('color', new T.BufferAttribute(new Float32Array(c), 3));
    const m = new T.Mesh(geo, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide, fog: false, depthWrite: false, toneMapped: false })); m.renderOrder = -1; this.group.add(m); this.skyMesh = m;
  }
  materials(W) {
    const tile = (base, line, edge) => canvasTex(128, (g, s) => { g.fillStyle = base; g.fillRect(0, 0, s, s); g.fillStyle = line; g.fillRect(0, 0, s, 5); g.fillRect(0, 0, 5, s); g.fillStyle = edge; g.globalAlpha = 0.12; g.fillRect(8, 8, s / 2 - 12, s / 2 - 12); g.fillRect(s / 2 + 4, s / 2 + 4, s / 2 - 12, s / 2 - 12); g.globalAlpha = 1; });
    const std = (o) => new T.MeshStandardMaterial({ roughness: 0.6, metalness: 0.02, ...o });
    const M = this.M = {};
    M.top = std({ map: tile(W.floor, shade(W.floor, 0.82), '#fff') });
    M.side = std({ color: W.edge, roughness: 0.5 }); M.under = std({ color: W.stone, roughness: 0.9 });
    M.ice = new T.MeshPhysicalMaterial({ color: '#cfeeff', roughness: 0.08, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, transparent: true, opacity: 0.92 });
    M.jelly = new T.MeshPhysicalMaterial({ color: '#ff7ac4', roughness: 0.2, clearcoat: 1, transparent: true, opacity: 0.9 });
    M.start = std({ map: canvasTex(128, (g, s) => { g.fillStyle = '#3b1f8f'; g.fillRect(0, 0, s, s); for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) { g.fillStyle = (i + j) % 2 ? '#fff' : '#1b0b44'; g.fillRect(i * 16, s - 32 + j * 16, 16, 16); } }) });
    M.rest = std({ map: tile(shade(W.floor, 1.05), W.accent, '#fff') });
    M.finish = std({ color: '#ffd45a', metalness: 0.75, roughness: 0.3 });
    M.conv = std({ map: canvasTex(64, (g, s) => { g.fillStyle = '#2a2a3a'; g.fillRect(0, 0, s, s); g.strokeStyle = W.accent; g.lineWidth = 7; g.beginPath(); g.moveTo(12, 40); g.lineTo(32, 22); g.lineTo(52, 40); g.stroke(); }, [3, 5]), roughness: 0.7 });
    M.crumble = std({ map: canvasTex(128, (g, s) => { g.fillStyle = shade(W.stone, 1.2); g.fillRect(0, 0, s, s); g.strokeStyle = shade(W.stone, 0.6); g.lineWidth = 3; g.beginPath(); g.moveTo(10, 20); g.lineTo(60, 64); g.lineTo(40, 118); g.moveTo(60, 64); g.lineTo(118, 50); g.stroke(); }), transparent: true });
    M.blink = std({ color: W.accent, emissive: W.accent, emissiveIntensity: 0.55, transparent: true });
    M.wall = std({ color: shade(W.edge, 1.1), roughness: 0.45 });
    M.hazard = std({ map: canvasTex(64, (g, s) => { g.fillStyle = '#ffd23e'; g.fillRect(0, 0, s, s); g.fillStyle = '#20162e'; for (let i = -s; i < s; i += 16) { g.beginPath(); g.moveTo(i, s); g.lineTo(i + 8, s); g.lineTo(i + s + 8, 0); g.lineTo(i + s, 0); g.fill(); } }, [2, 1]), roughness: 0.5 });
    M.red = std({ color: '#e23b4c', roughness: 0.35, metalness: 0.1 }); M.white = std({ color: '#f6f2ff', roughness: 0.4 });
    M.metal = std({ color: '#5b6275', metalness: 0.85, roughness: 0.3 }); M.gold = std({ color: '#ffd23e', metalness: 0.9, roughness: 0.22 });
    M.pad = std({ color: W.accent, emissive: W.accent, emissiveIntensity: 0.9 });
    M.gem = new T.MeshPhysicalMaterial({ color: '#4fe3ff', emissive: '#1aa6ff', emissiveIntensity: 0.5, metalness: 0.1, roughness: 0.05, clearcoat: 1 });
    M.door = std({ color: '#7b4dff', roughness: 0.4 }); M.doorFace = std({ color: '#ffcf3e', metalness: 0.6, roughness: 0.3 });
    M.pillar = std({ map: tile(shade(W.floor, 0.95), shade(W.edge, 1), '#fff') });
  }
  boxMesh(p, top) {
    const r = Math.min(0.22, Math.min(p.w, p.h, p.d) * 0.22), geo = new T.RoundedBoxGeometry(p.w, p.h, p.d, 2, r);
    const M = this.M, kind = p.m;
    let mats;
    if (['wall', 'push'].includes(kind)) mats = kind === 'push' ? M.hazard : M.wall;
    else if (kind === 'ice') mats = M.ice; else if (kind === 'jelly') mats = M.jelly; else if (kind === 'blink') mats = M.blink.clone(); else if (kind === 'crumble') mats = M.crumble.clone();
    else { const t = { start: M.start, rest: M.rest, finish: M.finish, conv: M.conv, pillar: M.pillar }[kind] || top; mats = [M.side, M.side, t, M.under, M.side, M.side]; }
    const m = new T.Mesh(geo, mats); m.position.set(p.x, p.y - p.h / 2, p.z); m.castShadow = kind !== 'start'; m.receiveShadow = true; return m;
  }
  piece(p, W) {
    const M = this.M;
    switch (p.k) {
      case 'box': { const m = this.boxMesh(p, M.top); if (p.mv || p.m === 'blink' || p.m === 'crumble' || p.m === 'conv') this.dyn.push({ p, m, base: m.position.clone() }); return m; }
      case 'disk': { const geo = new T.CylinderGeometry(p.r, p.r * 0.92, p.h, 48), m = new T.Mesh(geo, [p.w ? M.rest : M.side, p.m === 'ice' ? M.ice : M.top, M.under]); m.position.set(p.x, p.y - p.h / 2, p.z); m.receiveShadow = m.castShadow = true; if (p.w) { const ring = new T.Mesh(new T.TorusGeometry(p.r * 0.75, 0.06, 6, 48), M.pad); ring.rotation.x = Math.PI / 2; ring.position.y = p.h / 2 + 0.01; m.add(ring); for (let i = 0; i < 3; i++) { const a = new T.Mesh(new T.CylinderGeometry(0, 0.25, 0.5, 3), M.pad); a.rotation.z = Math.PI / 2 * Math.sign(p.w); a.position.set(Math.cos(i * TAU / 3) * p.r * 0.75, p.h / 2 + 0.05, Math.sin(i * TAU / 3) * p.r * 0.75); a.rotation.y = -i * TAU / 3; m.add(a); } this.dyn.push({ p, m }); } return m; }
      case 'bar': { const g = new T.Group(); g.position.set(p.x, p.y, p.z); const hub = new T.Mesh(new T.CylinderGeometry(0.7, 0.9, 1.4, 20), M.metal); hub.position.y = -0.2; g.add(hub); for (let k = 0; k < p.arms; k++) { const arm = new T.Mesh(new T.CylinderGeometry(p.r, p.r, p.len * 2, 14), M.hazard); arm.rotation.z = Math.PI / 2; const holder = new T.Group(); holder.rotation.y = -k * Math.PI / p.arms; holder.add(arm); arm.castShadow = true; g.add(holder); } this.dyn.push({ p, m: g }); return g; }
      case 'ham': { const g = new T.Group(); g.position.set(p.x, p.y, p.z); const rod = new T.Mesh(new T.CylinderGeometry(0.09, 0.09, p.L, 8), M.metal); rod.position.y = -p.L / 2; const head = new T.Mesh(new T.CylinderGeometry(p.hr, p.hr, p.hr * 2.6, 24), M.red); head.rotation.x = Math.PI / 2; head.position.y = -p.L; head.castShadow = true; const capA = new T.Mesh(new T.CylinderGeometry(p.hr * 1.02, p.hr * 1.02, 0.18, 24), M.white); capA.rotation.x = Math.PI / 2; capA.position.set(0, -p.L, p.hr * 1.1); const capB = capA.clone(); capB.position.z = -p.hr * 1.1; const pivot = new T.Mesh(new T.SphereGeometry(0.3, 12, 10), M.gold); g.add(rod, head, capA, capB, pivot); const beam = new T.Mesh(new T.CylinderGeometry(0.16, 0.16, 7, 8), M.metal); beam.rotation.z = Math.PI / 2; beam.position.set(p.x, p.y + 0.1, p.z); this.group.add(beam); this.dyn.push({ p, m: g }); return g; }
      case 'roll': { const m = new T.Mesh(new T.CylinderGeometry(p.r, p.r, p.w, 20), W.id === 'forest' ? new T.MeshStandardMaterial({ color: '#8a5a33', roughness: 0.9 }) : W.id === 'candy' ? M.jelly : M.red); m.rotation.z = Math.PI / 2; m.castShadow = true; const o = new T.Group(); o.add(m); this.dyn.push({ p, m: o, inner: m }); return o; }
      case 'ball': { const m = new T.Mesh(new T.SphereGeometry(p.r, 20, 14), M.metal); m.castShadow = true; this.dyn.push({ p, m }); return m; }
      case 'cannon': { const g = new T.Group(); g.position.set(p.x, p.y, p.z); const base = new T.Mesh(new T.RoundedBoxGeometry(1.6, 1, 1.6, 2, 0.2), M.wall); base.position.y = -0.2; const barrel = new T.Mesh(new T.CylinderGeometry(0.55, 0.7, 2.2, 16), M.metal); barrel.rotation.z = Math.PI / 2; barrel.position.set(-p.side * 0.6, 0.85, 0); g.add(base, barrel); return g; }
      case 'bump': { const g = new T.Group(); g.position.set(p.x, p.y, p.z); const c = new T.Mesh(new T.CylinderGeometry(p.r, p.r * 1.05, p.h, 24), M.white); c.position.y = p.h / 2; c.castShadow = true; for (const y of [0.35, 0.95]) { const ring = new T.Mesh(new T.TorusGeometry(p.r * 1.02, 0.08, 8, 24), M.red); ring.rotation.x = Math.PI / 2; ring.position.y = y * p.h; g.add(ring); } const lamp = new T.Mesh(new T.SphereGeometry(p.r * 0.5, 14, 10), M.pad); lamp.position.y = p.h; g.add(c, lamp); if (p.mv) this.dyn.push({ p, m: g, base: g.position.clone() }); this.bumps ??= new Map(); this.bumps.set(p.id, g); return g; }
      case 'pad': { const g = new T.Group(); g.position.set(p.x, p.y, p.z); const disc = new T.Mesh(new T.CylinderGeometry(p.r, p.r * 1.1, 0.25, 28), M.pad); disc.position.y = 0.12; const ring = new T.Mesh(new T.TorusGeometry(p.r * 1.05, 0.08, 8, 28), M.gold); ring.rotation.x = Math.PI / 2; ring.position.y = 0.22; g.add(disc, ring); this.pads ??= []; this.pads.push({ p, g, kick: 0 }); return g; }
      case 'wind': { this.winds ??= []; this.winds.push(p); for (const s of [-1, 1]) { const fan = new T.Group(); fan.position.set(s * 6.6, p.y0 + 2.2, p.z); const ring = new T.Mesh(new T.TorusGeometry(1.4, 0.18, 8, 24), M.metal); ring.rotation.y = Math.PI / 2; const hub = new T.Mesh(new T.SphereGeometry(0.3, 10, 8), M.gold); fan.add(ring, hub); for (let i = 0; i < 3; i++) { const blade = new T.Mesh(new T.RoundedBoxGeometry(0.1, 1.1, 0.4, 1, 0.04), M.white); blade.position.y = 0.55; const h = new T.Group(); h.rotation.x = i * TAU / 3; h.add(blade); fan.add(h); } this.group.add(fan); this.dyn.push({ p, m: fan, fan: s }); } return null; }
      case 'door': { const m = new T.Mesh(new T.RoundedBoxGeometry(p.w, p.h, p.d, 2, 0.12), M.door); const hinge = new T.Group(); hinge.position.set(p.x - p.w / 2, p.y, p.z); m.position.set(p.w / 2, p.h / 2, 0); m.castShadow = true; const knob = new T.Mesh(new T.SphereGeometry(0.1, 10, 8), M.doorFace); knob.position.set(p.w * 0.3, 0, p.d / 2 + 0.05); m.add(knob); const mark = new T.Mesh(new T.TorusGeometry(0.28, 0.05, 6, 20), M.doorFace); mark.position.set(0, 0.6, -p.d / 2 - 0.03); m.add(mark); hinge.add(m); this.doors ??= new Map(); this.doors.set(p.id, { hinge, open: 0 }); const frame = new T.Mesh(new T.RoundedBoxGeometry(p.w + 0.2, 0.3, p.d + 0.2, 1, 0.08), M.gold); frame.position.set(p.x, p.y + p.h + 0.15, p.z); this.group.add(frame); return hinge; }
      case 'fin': { const g = new T.Group(); g.position.set(p.x, p.y, p.z); const arch = new T.Mesh(new T.TorusGeometry(p.w / 2, 0.38, 14, 40, Math.PI), M.gold); arch.castShadow = true; g.add(arch); const banner = new T.Mesh(new T.PlaneGeometry(p.w * 0.8, 0.9), new T.MeshStandardMaterial({ map: this.label('القمة', '#ffd45a', '#3a1590'), transparent: true, side: T.DoubleSide })); banner.position.y = p.w / 2 - 0.9; banner.rotation.y = Math.PI; g.add(banner); this.crown(g, p); this.spire(p); return g; }
      default: return null;
    }
  }
  crown(g, p) { const c = new T.Group(); c.position.y = p.w / 2 + 0.9; const band = new T.Mesh(new T.CylinderGeometry(0.7, 0.8, 0.5, 24, 1, true), this.M.gold); c.add(band); for (let i = 0; i < 5; i++) { const a = i / 5 * TAU, s = new T.Mesh(new T.CylinderGeometry(0, 0.16, 0.5, 6), this.M.gold); s.position.set(Math.sin(a) * 0.72, 0.45, Math.cos(a) * 0.72); c.add(s); } g.add(c); this.crownMesh = c; }
  spire(p) {
    const W = this.W, prof = [[6, -60], [5.2, -10], [4.2, 0], [4.4, 1.2], [3.6, 1.6], [3.2, 12], [3.8, 13], [2.4, 16], [0.2, 22]].map(([x, y]) => new T.Vector2(x, y));
    const m = new T.Mesh(new T.LatheGeometry(prof, 36), new T.MeshStandardMaterial({ color: W.stone, roughness: 0.8 })); m.position.set(p.x, p.y - 1, p.z + 12); m.receiveShadow = true; this.group.add(m);
    const band = new T.Mesh(new T.TorusGeometry(3.7, 0.25, 8, 40), new T.MeshStandardMaterial({ color: W.accent, emissive: W.accent, emissiveIntensity: 0.5 })); band.rotation.x = Math.PI / 2; band.position.set(p.x, p.y + 12.6, p.z + 12); this.group.add(band);
  }
  label(text, fg, bg) { return canvasTex(256, (g, s) => { g.fillStyle = bg; g.beginPath(); if (g.roundRect) g.roundRect(4, s / 2 - 40, s - 8, 80, 30); else g.rect(4, s / 2 - 40, s - 8, 80); g.fill(); g.fillStyle = fg; g.font = '800 54px Tajawal, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl'; g.fillText(text, s / 2, s / 2 + 4); }); }
  columns(list, course, W) {
    if (!list.length) return;
    const geo = new T.CylinderGeometry(1, 1.25, 1, 10), mesh = new T.InstancedMesh(geo, new T.MeshStandardMaterial({ color: W.stone, roughness: 0.9 }), list.length), m = new T.Matrix4(), q = new T.Quaternion(), s = new T.Vector3(), v = new T.Vector3();
    list.forEach((p, i) => { const top = p.y - (p.h || 1), len = Math.max(2, top - course.kill + 8), rad = Math.max(0.35, Math.min(p.w || p.r * 2, p.d || p.r * 2) * 0.22); m.compose(v.set(p.x, top - len / 2, p.z), q, s.set(rad, len, rad)); mesh.setMatrixAt(i, m); });
    mesh.receiveShadow = true; this.group.add(mesh);
  }
  scenery(course, W) {
    const r = rng(course.seed ^ 0x5eed), L = course.length, g = this.group, kill = course.kill;
    // the ground far below
    if (W.lava) {
      const tex = canvasTex(256, (c, s) => { c.fillStyle = '#ff4a12'; c.fillRect(0, 0, s, s); for (let i = 0; i < 90; i++) { c.fillStyle = i % 3 ? '#ffb02e' : '#8a1a08'; c.globalAlpha = 0.5; c.beginPath(); c.arc(Math.random() * s, Math.random() * s, 6 + Math.random() * 22, 0, TAU); c.fill(); } }, [12, 12]);
      const lava = new T.Mesh(new T.PlaneGeometry(900, 900), new T.MeshBasicMaterial({ map: tex, color: '#ffffff' })); lava.rotation.x = -Math.PI / 2; lava.position.set(0, kill + 6, L / 2); g.add(lava); this.lavaTex = tex;
    } else if (!W.stars) {
      const ground = new T.Mesh(new T.CircleGeometry(700, 48), new T.MeshStandardMaterial({ color: W.id === 'forest' ? '#6fbf73' : W.id === 'ice' ? '#f4fbff' : W.id === 'candy' ? '#ffd1ea' : '#f0c27e', roughness: 1 }));
      ground.rotation.x = -Math.PI / 2; ground.position.set(0, kill - 30, L / 2); g.add(ground);
    }
    const inst = (geo, mat, n, place) => { const mesh = new T.InstancedMesh(geo, mat, n), m = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), s = new T.Vector3(), v = new T.Vector3(); for (let i = 0; i < n; i++) { const o = place(i); e.set(o.rx || 0, o.ry || 0, o.rz || 0); q.setFromEuler(e); m.compose(v.set(o.x, o.y, o.z), q, s.set(o.sx, o.sy ?? o.sx, o.sz ?? o.sx)); mesh.setMatrixAt(i, m); } g.add(mesh); return mesh; };
    const side = () => r.sign() * r.range(16, 70), along = () => r.range(-40, L + 60), lowY = (k = 0) => kill - 10 + r.range(0, 30) + k;
    const std = (c, o = {}) => new T.MeshStandardMaterial({ color: c, roughness: 0.8, ...o });
    if (W.id === 'forest') {
      const isl = []; for (let i = 0; i < 26; i++) isl.push({ x: side(), y: r.range(kill + 4, course.top + 10), z: along(), s: r.range(3, 7) });
      inst(new T.SphereGeometry(1, 14, 8, 0, TAU, Math.PI / 2, Math.PI / 2), std('#8a5a33'), isl.length, (i) => ({ ...isl[i], sx: isl[i].s, sy: isl[i].s * 0.8 }));
      inst(new T.CylinderGeometry(1, 1, 0.5, 16), std('#5fbf55'), isl.length, (i) => ({ ...isl[i], y: isl[i].y + 0.2, sx: isl[i].s, sy: 1 }));
      inst(new T.CylinderGeometry(0, 1, 2.6, 8), std('#2f8f4a'), isl.length * 3, (i) => { const o = isl[i % isl.length], a = i * 2.4; return { x: o.x + Math.cos(a) * o.s * 0.5, y: o.y + 1.8, z: o.z + Math.sin(a) * o.s * 0.5, sx: 0.9, sy: 1.4 }; });
      this.clouds(r, L, course.top, '#ffffff');
    } else if (W.id === 'ice') {
      inst(new T.CylinderGeometry(0.2, 1, 1, 6), new T.MeshPhysicalMaterial({ color: '#bfe8ff', roughness: 0.1, clearcoat: 1, transparent: true, opacity: 0.85 }), 60, () => ({ x: side(), y: lowY(), z: along(), sx: r.range(2, 6), sy: r.range(8, 30), ry: r() * 3 }));
      this.clouds(r, L, course.top, '#ffffff');
    } else if (W.id === 'candy') {
      inst(new T.SphereGeometry(1, 18, 12), std('#ff6fb7', { roughness: 0.3 }), 24, () => ({ x: side(), y: r.range(kill + 6, course.top + 12), z: along(), sx: r.range(1.5, 3.5) }));
      inst(new T.TorusGeometry(1, 0.45, 12, 24), std('#ffd27a', { roughness: 0.4 }), 18, () => ({ x: side(), y: r.range(kill + 6, course.top + 12), z: along(), sx: r.range(2, 4), rx: r() * 3, ry: r() * 3 }));
      this.clouds(r, L, course.top, '#ffe6f6');
    } else if (W.id === 'desert') {
      inst(new T.SphereGeometry(1, 20, 10, 0, TAU, 0, Math.PI / 2), std('#f2c27c', { roughness: 1 }), 30, () => ({ x: side() * 1.6, y: kill - 30, z: along(), sx: r.range(20, 50), sy: r.range(6, 14) }));
      inst(new T.CylinderGeometry(0, 1, 1, 4), std('#e5b16a', { roughness: 1 }), 5, () => ({ x: r.sign() * r.range(60, 120), y: kill - 30 + 15, z: along(), sx: 30, sy: 30, ry: Math.PI / 4 }));
      inst(new T.CylinderGeometry(0.5, 0.6, 1, 8), std('#3f9a52'), 30, () => ({ x: side(), y: kill - 24, z: along(), sx: 1, sy: r.range(4, 9) }));
    } else if (W.id === 'space') {
      const planet = (c, s, x, y, z, ring) => { const p = new T.Mesh(new T.SphereGeometry(s, 32, 20), std(c, { roughness: 0.6, emissive: c, emissiveIntensity: 0.15 })); p.position.set(x, y, z); g.add(p); if (ring) { const rg = new T.Mesh(new T.RingGeometry(s * 1.35, s * 1.9, 48), new T.MeshBasicMaterial({ color: ring, side: T.DoubleSide, transparent: true, opacity: 0.7 })); rg.rotation.x = 1.2; rg.position.copy(p.position); g.add(rg); } };
      planet('#ff8a5c', 22, -90, course.top + 30, L * 0.6, '#ffd7a0'); planet('#59f3ff', 9, 70, course.top - 10, L * 0.3); planet('#b68cff', 14, 60, course.top + 50, L + 40, '#e6d6ff');
      inst(new T.SphereGeometry(1, 7, 5), std('#6c6fa8'), 40, () => ({ x: side(), y: r.range(kill, course.top + 20), z: along(), sx: r.range(0.6, 2.4), rx: r() * 3 }));
    } else if (W.lava) {
      inst(new T.CylinderGeometry(0.3, 1, 1, 7), std('#2b2228', { roughness: 1 }), 40, () => ({ x: side(), y: kill + 4, z: along(), sx: r.range(2, 6), sy: r.range(4, 24) }));
      const v = new T.Mesh(new T.CylinderGeometry(8, 60, 70, 24, 1, true), std('#2b2228', { roughness: 1 })); v.position.set(-110, kill + 35, L * 0.7); g.add(v);
      const glow = new T.PointLight('#ff6a1f', 3, 60, 1.6); glow.position.set(0, kill + 12, L / 2); g.add(glow);
    }
    // gems
    this.gemMeshes = course.gems.map((gm) => { const m = new T.Mesh(new T.SphereGeometry(0.36, 6, 2), this.M.gem); m.position.set(gm.x, gm.y, gm.z); m.castShadow = true; g.add(m); return m; });
  }
  clouds(r, L, top, color) {
    const mat = new T.MeshStandardMaterial({ color, roughness: 1, transparent: true, opacity: 0.92 }), geo = new T.SphereGeometry(1, 12, 8);
    for (let i = 0; i < 16; i++) { const c = new T.Group(); c.position.set(r.sign() * r.range(20, 80), r.range(top - 30, top + 20), r.range(-30, L + 60)); for (let k = 0; k < 4; k++) { const b = new T.Mesh(geo, mat); b.position.set(k * 2.2 - 3, r.range(-0.4, 0.6), r.range(-1, 1)); b.scale.setScalar(r.range(1.6, 2.8)); c.add(b); } this.group.add(c); }
  }
  particles(W) {
    const n = 420, pos = new Float32Array(n * 3), r = rng(7);
    for (let i = 0; i < n; i++) { pos[i * 3] = r.range(-30, 30); pos[i * 3 + 1] = r.range(-10, 30); pos[i * 3 + 2] = r.range(-20, 60); }
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    const color = W.id === 'ice' ? '#ffffff' : W.lava ? '#ffb02e' : W.stars ? '#e6f4ff' : W.id === 'candy' ? '#ffffff' : W.id === 'desert' ? '#f6d39a' : '#fff6b8';
    const pts = new T.Points(geo, new T.PointsMaterial({ color, map: dot(), size: W.stars ? 0.7 : W.id === 'ice' ? 0.42 : 0.3, transparent: true, opacity: W.id === 'forest' ? 0.6 : 0.9, depthWrite: false }));
    pts.frustumCulled = false; this.group.add(pts); this.dust = { pts, pos, n, kind: W.id };
    if (W.stars) { const sp = new Float32Array(1500 * 3); for (let i = 0; i < 1500; i++) { const a = r() * TAU, b = Math.acos(r() * 2 - 1); sp[i * 3] = 500 * Math.sin(b) * Math.cos(a); sp[i * 3 + 1] = 500 * Math.cos(b); sp[i * 3 + 2] = 500 * Math.sin(b) * Math.sin(a); } const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.BufferAttribute(sp, 3)); this.stars = new T.Points(sg, new T.PointsMaterial({ color: '#ffffff', map: dot(), size: 3, sizeAttenuation: false, fog: false, transparent: true, depthWrite: false })); this.group.add(this.stars); }
  }

  /* ------------------------------------------------------------------ runners */
  addRunner(id, look, name, me = false, team = null) {
    this.removeRunner(id);
    const fig = buildCharacter(look); fig.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    if (!me && name) { const sp = new T.Sprite(new T.SpriteMaterial({ map: this.label(name, '#fff', team === 1 ? '#c8202cdd' : team === 0 ? '#2059d8dd' : '#2a1360cc'), depthWrite: false, transparent: true })); sp.scale.set(2.4, 2.4, 1); sp.position.y = 2.25; fig.add(sp); }
    if (team !== null) { const ring = new T.Mesh(new T.TorusGeometry(0.5, 0.05, 6, 24), new T.MeshBasicMaterial({ color: team ? '#ff4a5a' : '#4a8dff' })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.03; fig.add(ring); }
    this.scene.add(fig); const r = { fig, me, x: 0, y: 0, z: 0, ry: 0, anim: 'idle', phase: 0, tx: 0, ty: 0, tz: 0, tr: 0 }; this.runners.set(id, r); return r;
  }
  removeRunner(id) { const r = this.runners.get(id); if (r) { this.scene.remove(r.fig); this.runners.delete(id); } }
  /** A remote runner's latest reported place; drawn smoothly toward it. */
  target(id, x, y, z, ry, anim) { const r = this.runners.get(id); if (!r) return; if (Math.hypot(r.x - x, r.z - z) > 8) { r.x = x; r.y = y; r.z = z; } Object.assign(r, { tx: x, ty: y, tz: z, tr: ry, anim }); }
  burst(x, y, z, color = '#ffd45a', n = 26) {
    const pos = new Float32Array(n * 3), vel = []; for (let i = 0; i < n; i++) { pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; vel.push([(Math.random() - 0.5) * 8, Math.random() * 7 + 2, (Math.random() - 0.5) * 8]); }
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3)); const p = new T.Points(geo, new T.PointsMaterial({ color, map: dot(), size: 0.45, transparent: true, depthWrite: false })); this.scene.add(p); this.bursts.push({ p, pos, vel, life: 1.1 });
  }

  /* ------------------------------------------------------------------ every frame */
  update(t, dt, me) {
    const W = this.W; if (!this.course) return;
    for (const d of this.dyn) {
      const p = d.p;
      if (p.k === 'box') {
        if (p.mv) { const o = offset(p, t); d.m.position.set(d.base.x + o[0], d.base.y + o[1], d.base.z + o[2]); }
        if (p.m === 'blink') { const on = blinkOn(p, t), soon = !blinkOn(p, t + 0.45); d.m.material.opacity = on ? (soon ? 0.55 + 0.45 * Math.abs(Math.sin(t * 20)) : 1) : 0.12; d.m.material.emissiveIntensity = on ? 0.55 : 0.1; }
        if (p.m === 'crumble') { const at = me?.crumbled.get(p.id); if (at === undefined) { d.m.position.copy(d.base); d.m.material.opacity = 1; d.m.visible = true; } else { const e = t - at; if (e < p.cr) { d.m.position.set(d.base.x + Math.sin(e * 70) * 0.05, d.base.y, d.base.z); } else { const f = e - p.cr; d.m.position.set(d.base.x, d.base.y - f * f * 9, d.base.z); d.m.material.opacity = Math.max(0, 1 - f / 1.2); d.m.visible = f < 1.3; } } }
        if (p.m === 'conv') d.m.material[2].map.offset.y = (t * Math.abs(p.cv[1]) / 4) % 1;
      } else if (p.k === 'disk') d.m.rotation.y = -p.w * t;
      else if (p.k === 'bar') d.m.rotation.y = -barAngle(p, t);
      else if (p.k === 'ham') d.m.rotation.z = hammerAt(p, t).a;
      else if (p.k === 'roll') { const o = rollAt(p, t); d.m.position.set(o.x, o.y, o.z); d.inner.rotation.x = 0; d.m.rotation.x = -o.f * 20; d.m.visible = o.f < 0.97; }
      else if (p.k === 'ball') { const o = ballAt(p, t); d.m.position.set(o.x, o.y, o.z); d.m.visible = o.f > 0.02 && o.f < 0.98; }
      else if (p.k === 'bump') { const o = offset(p, t); d.m.position.set(d.base.x + o[0], d.base.y, d.base.z + o[2]); }
      else if (p.k === 'wind') { const w = windAt(p, t); d.m.children.slice(2).forEach((h, i) => { h.rotation.x = t * 9 * Math.sign(w || 1) + i * TAU / 3; }); }
    }
    this.pads?.forEach((pd) => { pd.kick = Math.max(0, pd.kick - dt * 4); pd.g.scale.y = 1 - pd.kick * 0.5; });
    if (this.doors && me) for (const [id, dr] of this.doors) { const want = me.opened.has(id) ? 1 : 0; dr.open += (want - dr.open) * Math.min(1, dt * 7); dr.hinge.rotation.y = -dr.open * 1.6; }
    this.gemMeshes?.forEach((m, i) => { const got = me?.gems.has(i); m.visible = !got; m.rotation.y = t * 2; m.position.y = this.course.gems[i].y + Math.sin(t * 2.5 + i) * 0.15; });
    if (this.crownMesh) this.crownMesh.rotation.y = t * 0.8;
    if (this.lavaTex) { this.lavaTex.offset.x = t * 0.01; this.lavaTex.offset.y = t * 0.006; }
    // runners: mine follows the simulation, the others glide to their reports
    for (const r of this.runners.values()) {
      if (!r.me) { const k = Math.min(1, dt * 10); r.x += (r.tx - r.x) * k; r.y += (r.ty - r.y) * k; r.z += (r.tz - r.z) * k; let a = r.tr - r.ry; a = Math.atan2(Math.sin(a), Math.cos(a)); r.ry += a * k; r.phase += dt * (r.anim === 'run' ? 11 : 0); }
      r.fig.position.set(r.x, r.y, r.z); r.fig.rotation.y = r.ry; animateCharacter(r.fig, r.anim, r.phase, t);
    }
    // particles drift around the camera
    if (this.dust) { const { pos, n, kind } = this.dust, c = this.camera.position; for (let i = 0; i < n; i++) { const k = i * 3; if (kind === 'lava') pos[k + 1] += dt * 2.2; else if (kind === 'space') pos[k + 2] -= dt * 0.6; else if (kind === 'desert') pos[k] += dt * 5; else pos[k + 1] -= dt * (kind === 'ice' ? 1.6 : 0.5); for (const [a, lo, hi] of [[0, -30, 30], [1, -12, 28], [2, -10, 60]]) { const rel = pos[k + a] - (a === 0 ? c.x : a === 1 ? c.y : c.z); if (rel < lo) pos[k + a] += hi - lo; else if (rel > hi) pos[k + a] -= hi - lo; } } this.dust.pts.geometry.attributes.position.needsUpdate = true; }
    for (let i = this.bursts.length - 1; i >= 0; i--) { const b = this.bursts[i]; b.life -= dt; b.vel.forEach((v, j) => { v[1] -= 14 * dt; b.pos[j * 3] += v[0] * dt; b.pos[j * 3 + 1] += v[1] * dt; b.pos[j * 3 + 2] += v[2] * dt; }); b.p.geometry.attributes.position.needsUpdate = true; b.p.material.opacity = Math.max(0, b.life); if (b.life <= 0) { this.scene.remove(b.p); b.p.geometry.dispose(); this.bursts.splice(i, 1); } }
    if (this.stars) this.stars.position.copy(this.camera.position);
    if (this.skyMesh) this.skyMesh.position.copy(this.camera.position);
  }
  follow(x, y, z, dt, intro = 0) {
    const want = new T.Vector3(x * 0.6, y + 5.6 + intro * 6, z - 9 - intro * 10), k = Math.min(1, dt * 5);
    this.camPos.lerp(want, k); this.camera.position.copy(this.camPos);
    this.look.lerp(new T.Vector3(x * 0.85, y + 1.3, z + 5), k); this.camera.lookAt(this.look);
    this.sun.position.set(x + 8, y + 18, z - 6); this.sun.target.position.set(x, y, z + 3); this.sun.target.updateMatrixWorld();
  }
  snapCamera(x, y, z) { this.camPos.set(x * 0.6, y + 11, z - 19); this.look.set(x, y + 1.3, z + 5); }
  render() { this.renderer.render(this.scene, this.camera); }
  dispose() { this.clear(); this.renderer.dispose(); }
}
