/* Tahdia 33.10.2 — «شطرنج الذاكرة» in 3D. A lacquered walnut board with a gold inlay and six gems,
   twenty-four pearl pieces with gold collars, and under each piece a glowing coloured foot that only
   shows when the piece is lifted and turned over. The colour die tumbles above the far edge of the board
   and lights the table with the colour it lands on.
   It takes the same instructions as the flat board (board.js): per piece {lift, tip, color, glow, ring,
   mark, at, dx, scale, alpha}, so the page plays every step the same way on either. */
import * as T from '../../vendor/three-r187-pegs.js';
import { PEG_COLORS, PEG_HOLES } from '../engines/pegs-engine.js?v=33.10.6';

const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ease = (k) => 1 - (1 - k) ** 3;
const PAWN_H = 0.36, PIVOT = 0.18, LIFT = 0.42, HOLE_R = 0.1, SCALE = 1.2;
const DIE = 0.26, PLAY_DIE = new T.Vector3(0, 0.52, -1.16), SHOW_DIE = new T.Vector3(0.78, 0.04, 0.98);
const DIE_AT = PLAY_DIE.clone();
// a symbol under each colour as well, for players who tell colours apart with difficulty
export const PEG_SYMBOLS = Object.freeze(['triangle', 'star', 'plus', 'diamond', 'circle', 'square']);

/** A symbol drawn on a 2D context, centred at (x, y), radius r. */
export function drawSymbol(g, kind, x, y, r) {
  g.beginPath();
  if (kind === 'triangle') { for (let k = 0; k < 3; k++) { const a = -Math.PI / 2 + k * TAU / 3; g[k ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r * 1.02 + r * 0.12); } }
  else if (kind === 'star') { for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r; g[k ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr); } }
  else if (kind === 'plus') { const w = r * 0.36; g.moveTo(x - w, y - r); g.lineTo(x + w, y - r); g.lineTo(x + w, y - w); g.lineTo(x + r, y - w); g.lineTo(x + r, y + w); g.lineTo(x + w, y + w); g.lineTo(x + w, y + r); g.lineTo(x - w, y + r); g.lineTo(x - w, y + w); g.lineTo(x - r, y + w); g.lineTo(x - r, y - w); g.lineTo(x - w, y - w); }
  else if (kind === 'diamond') { g.moveTo(x, y - r); g.lineTo(x + r * 0.8, y); g.lineTo(x, y + r); g.lineTo(x - r * 0.8, y); }
  else if (kind === 'circle') g.arc(x, y, r * 0.82, 0, TAU);
  else { const s = r * 0.78; g.rect(x - s, y - s, s * 2, s * 2); }
  g.closePath();
}

function canvasTexture(size, paint) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); paint(g, size);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t;
}
function woodTexture() {
  return canvasTexture(1024, (g, n) => {
    const c = n / 2;
    const base = g.createRadialGradient(c * 0.8, c * 0.7, n * 0.05, c, c, c);
    base.addColorStop(0, '#9a6236'); base.addColorStop(0.6, '#7a4523'); base.addColorStop(1, '#4e2810');
    g.fillStyle = base; g.fillRect(0, 0, n, n);
    // the rings of the tree, a little off centre, and fine grain across them
    for (let i = 0; i < 70; i++) {
      const r = c * (0.03 + i * 0.0145) + Math.sin(i * 2.3) * 3;
      g.beginPath(); g.ellipse(c + Math.sin(i * 0.7) * 6, c + Math.cos(i * 0.5) * 4, r, r * 0.985, 0.2, 0, TAU);
      g.strokeStyle = i % 4 === 0 ? 'rgba(40,18,6,.30)' : i % 3 === 0 ? 'rgba(255,214,160,.08)' : 'rgba(40,18,6,.13)'; g.lineWidth = 1 + (i % 5) * 0.8; g.stroke();
    }
    g.globalAlpha = 0.07;
    for (let k = 0; k < 900; k++) { const x = Math.random() * n, y = Math.random() * n, l = 20 + Math.random() * 60; g.beginPath(); g.moveTo(x, y); g.lineTo(x + l * 0.3, y + l); g.strokeStyle = Math.random() < 0.5 ? '#2a1205' : '#ffd9a8'; g.lineWidth = 0.6; g.stroke(); }
    g.globalAlpha = 1;
    // the holes: a dark well with light on its far wall
    for (const h of PEG_HOLES) {
      const x = c + h.x * c, y = c + h.y * c, r = HOLE_R * c;
      const well = g.createRadialGradient(x, y + r * 0.25, r * 0.15, x, y, r);
      well.addColorStop(0, '#0b0502'); well.addColorStop(0.75, '#1e0f06'); well.addColorStop(1, '#3a1d0b');
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = well; g.fill();
      g.beginPath(); g.arc(x, y, r * 0.92, Math.PI * 1.1, Math.PI * 1.9); g.strokeStyle = 'rgba(255,200,140,.22)'; g.lineWidth = 3; g.stroke();
    }
    // the centre: a carved rosette of six petals
    g.save(); g.translate(c, c);
    for (let k = 0; k < 6; k++) { g.rotate(TAU / 6); g.beginPath(); g.ellipse(0, -c * 0.06, c * 0.022, c * 0.055, 0, 0, TAU); g.fillStyle = 'rgba(30,12,4,.45)'; g.fill(); }
    g.restore();
  });
}
function glowTexture() {
  return canvasTexture(128, (g, n) => { const r = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, n, n); });
}
/** The painted foot of a piece: its colour, a gloss, and its symbol. */
function footTexture(c) {
  return canvasTexture(256, (g, n) => {
    const col = PEG_COLORS[c], m = n / 2;
    if (!col) {
      g.fillStyle = '#271a3d'; g.fillRect(0, 0, n, n);
      g.fillStyle = '#bfe8ff'; g.font = '900 150px Tajawal, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('؟', m, m + 8);
      return;
    }
    const fill = g.createRadialGradient(m * 0.7, m * 0.6, 10, m, m, m);
    fill.addColorStop(0, col.id === 'black' ? '#6a6a76' : col.id === 'white' ? '#ffffff' : col.hex); fill.addColorStop(0.55, col.hex); fill.addColorStop(1, col.dark);
    g.fillStyle = fill; g.fillRect(0, 0, n, n);
    drawSymbol(g, PEG_SYMBOLS[c], m, m, n * 0.2);
    g.fillStyle = col.id === 'white' || col.id === 'yellow' ? 'rgba(60,40,10,.55)' : 'rgba(255,255,255,.78)'; g.fill();
  });
}
function dieFaceTexture(c) {
  return canvasTexture(256, (g, n) => {
    const col = PEG_COLORS[c], m = n / 2;
    const fill = g.createLinearGradient(0, 0, n, n); fill.addColorStop(0, col.id === 'black' ? '#55555e' : '#ffffff'); fill.addColorStop(0.25, col.hex); fill.addColorStop(1, col.dark);
    g.fillStyle = fill; g.fillRect(0, 0, n, n);
    const a = n * 0.16, b = n * 0.84, rr = n * 0.14;
    g.beginPath(); g.moveTo(a + rr, a); g.arcTo(b, a, b, b, rr); g.arcTo(b, b, a, b, rr); g.arcTo(a, b, a, a, rr); g.arcTo(a, a, b, a, rr); g.closePath(); g.fillStyle = 'rgba(0,0,0,.14)'; g.fill();
    g.lineWidth = 6; g.strokeStyle = 'rgba(255,255,255,.35)'; g.stroke();
    drawSymbol(g, PEG_SYMBOLS[c], m, m, n * 0.2);
    g.fillStyle = col.id === 'white' || col.id === 'yellow' ? 'rgba(60,40,10,.6)' : 'rgba(255,255,255,.85)'; g.fill();
  });
}
function markTexture() {
  return canvasTexture(128, (g, n) => {
    g.lineCap = 'round';
    for (const [w, col] of [[30, '#3a0606'], [18, '#ff5b5b']]) { g.lineWidth = w; g.strokeStyle = col; g.beginPath(); g.moveTo(30, 30); g.lineTo(n - 30, n - 30); g.moveTo(n - 30, 30); g.lineTo(30, n - 30); g.stroke(); }
  });
}

/** The turned profile of a piece (radius, height), foot at 0, crown at PAWN_H. */
function pawnProfile() {
  const pts = [[0, 0], [0.071, 0], [0.076, 0.007], [0.075, 0.02], [0.066, 0.03], [0.057, 0.037], [0.05, 0.058], [0.042, 0.088], [0.035, 0.118], [0.031, 0.14], [0.047, 0.149], [0.051, 0.157], [0.046, 0.166], [0.029, 0.171], [0.026, 0.186]];
  const cy = 0.236, r = 0.056;
  for (let k = 0; k <= 14; k++) { const a = -1.15 + (k / 14) * (Math.PI / 2 + 1.15); pts.push([Math.max(0, Math.cos(a) * r), cy + Math.sin(a) * r]); }
  pts[pts.length - 1][0] = 0;
  return pts.map(([x, y]) => new T.Vector2(x * SCALE, y * SCALE));
}

export function webglAvailable() {
  try { const c = document.createElement('canvas'); return Boolean(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch { return false; }
}

export function createPegsStage3D() {
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  const canvas = renderer.domElement; canvas.className = 'pg-gl';
  const overlay = document.createElement('canvas'); overlay.className = 'pg-fx'; const ov = overlay.getContext('2d');
  let host = null, W = 1, H = 1, ratio = 1, lost = false;
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; api.onLost?.(); });

  const scene = new T.Scene();
  const pmrem = new T.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new T.RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.42;
  const camera = new T.PerspectiveCamera(30, 1, 0.1, 40);

  // light: a warm lamp above, a cool rim behind, and the colours of the game when they show
  const key = new T.DirectionalLight(0xfff0dc, 2.1); key.position.set(1.4, 3.4, 1.6); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -1.4; key.shadow.camera.right = 1.4; key.shadow.camera.top = 1.4; key.shadow.camera.bottom = -1.4;
  key.shadow.camera.near = 1; key.shadow.camera.far = 7; key.shadow.bias = -0.0006; key.shadow.normalBias = 0.01; key.shadow.radius = 4;
  scene.add(key, new T.HemisphereLight(0xc3cdff, 0x3a2410, 0.55));
  const rim = new T.DirectionalLight(0x86a6ff, 1.1); rim.position.set(-2.2, 1.6, -2.6); scene.add(rim);
  const reveal = new T.PointLight(0xffffff, 0, 1.3, 1.6); scene.add(reveal);
  const dieGlow = new T.PointLight(0xffffff, 0, 2.6, 1.4); dieGlow.position.copy(DIE_AT).add(new T.Vector3(0, 0.05, 0.3)); scene.add(dieGlow);

  const world = new T.Group(); scene.add(world);
  // the table catches the board's shadow
  const ground = new T.Mesh(new T.CircleGeometry(3, 48), new T.ShadowMaterial({ opacity: 0.5 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.1; ground.receiveShadow = true; world.add(ground);

  // the board
  const wood = woodTexture();
  const topMat = new T.MeshPhysicalMaterial({ map: wood, roughness: 0.38, clearcoat: 0.75, clearcoatRoughness: 0.18 });
  const sideMat = new T.MeshPhysicalMaterial({ color: 0x4a2611, roughness: 0.45, clearcoat: 0.6, clearcoatRoughness: 0.25 });
  const board = new T.Mesh(new T.CylinderGeometry(1, 1.02, 0.09, 128, 1), [sideMat, topMat, sideMat]);
  board.position.y = -0.045; board.receiveShadow = true; board.castShadow = true; world.add(board);
  const gold = new T.MeshStandardMaterial({ color: 0xf2c25a, metalness: 1, roughness: 0.22 });
  for (const [r, tube] of [[0.965, 0.008], [0.91, 0.005], [0.115, 0.007]]) { const t = new T.Mesh(new T.TorusGeometry(r, tube, 8, 160), gold); t.rotation.x = Math.PI / 2; t.position.y = 0.001; t.receiveShadow = true; world.add(t); }
  const lip = new T.Mesh(new T.TorusGeometry(1.004, 0.012, 10, 160), gold); lip.rotation.x = Math.PI / 2; lip.position.y = -0.002; world.add(lip);
  // a brass ring round each hole
  const rings = new T.InstancedMesh(new T.TorusGeometry(HOLE_R + 0.004, 0.0055, 8, 40), gold, PEG_HOLES.length);
  const m4 = new T.Matrix4(), q4 = new T.Quaternion().setFromEuler(new T.Euler(Math.PI / 2, 0, 0));
  PEG_HOLES.forEach((h, i) => rings.setMatrixAt(i, m4.compose(new T.Vector3(h.x, 0.002, h.y), q4, new T.Vector3(1, 1, 1))));
  rings.receiveShadow = true; world.add(rings);
  // six gems set in the inlay, one of each colour; the colour on the die makes its gem shine
  const gems = PEG_COLORS.map((col, k) => {
    const mat = new T.MeshPhysicalMaterial({ color: col.hex, roughness: 0.08, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, emissive: col.hex, emissiveIntensity: 0.12 });
    const gem = new T.Mesh(new T.SphereGeometry(0.034, 24, 12), mat); gem.scale.y = 0.5;
    const a = -Math.PI / 2 + Math.PI / 6 + k * TAU / 6; gem.position.set(Math.cos(a) * 0.9375, 0.004, Math.sin(a) * 0.9375);
    const seat = new T.Mesh(new T.TorusGeometry(0.036, 0.006, 8, 24), gold); seat.rotation.x = Math.PI / 2; seat.position.copy(gem.position);
    world.add(gem, seat); return mat;
  });
  const medal = new T.Mesh(new T.CircleGeometry(0.06, 48), new T.MeshStandardMaterial({ color: 0xe9b54e, metalness: 1, roughness: 0.3 }));
  medal.rotation.x = -Math.PI / 2; medal.position.y = 0.002; world.add(medal);

  // the pieces
  const lathe = new T.LatheGeometry(pawnProfile(), 48);
  // a little darker at the foot and brighter at the crown, as light falls on a turned piece
  { const pos = lathe.attributes.position, col = new Float32Array(pos.count * 3); for (let k = 0; k < pos.count; k++) { const v = 0.62 + 0.38 * Math.min(1, pos.getY(k) / PAWN_H) ** 0.6; col[k * 3] = v; col[k * 3 + 1] = v * 0.985; col[k * 3 + 2] = v * 0.95; } lathe.setAttribute('color', new T.BufferAttribute(col, 3)); }
  const collarGeo = new T.TorusGeometry(0.049 * SCALE, 0.0062 * SCALE, 10, 40), bandGeo = new T.TorusGeometry(0.068 * SCALE, 0.0042 * SCALE, 8, 40);
  const footGeo = new T.CircleGeometry(0.071 * SCALE, 40), hitGeo = new T.CylinderGeometry(0.085, 0.085, PAWN_H + 0.04, 12);
  const footTex = PEG_COLORS.map((_, c) => footTexture(c)), unknownTex = footTexture(-1);
  const glowTex = glowTexture(), markTex = markTexture();
  const pawns = PEG_HOLES.map((h, i) => {
    const root = new T.Group(); root.position.set(h.x, 0, h.y); world.add(root);
    const pivot = new T.Group(); pivot.position.y = PIVOT; root.add(pivot);
    const body = new T.Group(); body.position.y = -PIVOT; pivot.add(body);
    const mat = new T.MeshPhysicalMaterial({ color: 0xf0e2c8, vertexColors: true, roughness: 0.34, clearcoat: 0.7, clearcoatRoughness: 0.14, iridescence: 0.18, iridescenceIOR: 1.35, transparent: false });
    const mesh = new T.Mesh(lathe, mat); mesh.castShadow = true; mesh.receiveShadow = true; body.add(mesh);
    const collar = new T.Mesh(collarGeo, gold); collar.rotation.x = Math.PI / 2; collar.position.y = 0.157 * SCALE; collar.castShadow = true; body.add(collar);
    const band = new T.Mesh(bandGeo, gold); band.rotation.x = Math.PI / 2; band.position.y = 0.024 * SCALE; body.add(band);
    // the painted foot keeps its true colour whatever the light does to the rest
    const footMat = new T.MeshBasicMaterial({ color: 0xffffff, map: unknownTex, toneMapped: false });
    const foot = new T.Mesh(footGeo, footMat); foot.rotation.x = Math.PI / 2; foot.position.y = -0.0015; body.add(foot);
    const hit = new T.Mesh(hitGeo, new T.MeshBasicMaterial({ visible: false })); hit.position.y = PAWN_H / 2; hit.userData.peg = i; root.add(hit);
    const glow = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending })); glow.scale.set(0.62, 0.62, 1); glow.position.y = PIVOT; root.add(glow);
    const ring = new T.Mesh(new T.RingGeometry(HOLE_R + 0.012, HOLE_R + 0.034, 48), new T.MeshBasicMaterial({ color: 0xffc94d, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(h.x, 0.004, h.y); world.add(ring);
    const mark = new T.Sprite(new T.SpriteMaterial({ map: markTex, transparent: true, opacity: 0, depthWrite: false, depthTest: false })); mark.scale.set(0.15, 0.15, 1); mark.position.y = PAWN_H + 0.16; root.add(mark);
    return { root, pivot, mat, footMat, glow, ring, mark, hit, shownColor: undefined, home: new T.Vector3(h.x, 0, h.y) };
  });
  const hits = pawns.map((p) => p.hit);

  // the die
  const dieMats = PEG_COLORS.map((_, c) => new T.MeshPhysicalMaterial({ map: dieFaceTexture(c), roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08 }));
  const die = new T.Mesh(new T.RoundedBoxGeometry(DIE, DIE, DIE, 5, 0.04), dieMats);
  die.position.copy(DIE_AT); scene.add(die);
  const dieHalo = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: 0xffc94d, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending })); dieHalo.scale.set(0.7, 0.7, 1); dieHalo.position.copy(DIE_AT); scene.add(dieHalo);
  const NORMALS = [new T.Vector3(1, 0, 0), new T.Vector3(-1, 0, 0), new T.Vector3(0, 1, 0), new T.Vector3(0, -1, 0), new T.Vector3(0, 0, 1), new T.Vector3(0, 0, -1)];
  const dieState = { anim: null, spin: false, ready: false, color: null, light: 0 };
  function faceQuat(c) {
    const toCam = camera.position.clone().sub(DIE_AT).normalize();
    const q = new T.Quaternion().setFromUnitVectors(NORMALS[c], toCam);
    // keep the face upright: turn about the view axis so the die's top edge stays level
    const up = new T.Vector3(0, 1, 0), faceUp = (c === 2 || c === 3 ? new T.Vector3(0, 0, -1) : up).clone().applyQuaternion(q);
    const proj = up.clone().sub(toCam.clone().multiplyScalar(up.dot(toCam))).normalize(), fp = faceUp.clone().sub(toCam.clone().multiplyScalar(faceUp.dot(toCam))).normalize();
    const angle = Math.atan2(fp.clone().cross(proj).dot(toCam), fp.dot(proj));
    const face = new T.Quaternion().setFromAxisAngle(toCam, angle).multiply(q);
    // then turned a little, so the die shows three faces and reads as a cube
    const right = new T.Vector3().crossVectors(new T.Vector3(0, 1, 0), toCam).normalize();
    return new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), 0.5).multiply(new T.Quaternion().setFromAxisAngle(right, -0.42)).multiply(face);
  }

  // where the camera stands: high enough to see between the pieces, and far enough for the board, the die and the lifted pieces
  const keyPoints = [];
  for (let k = 0; k < 24; k++) { const a = k * TAU / 24; keyPoints.push(new T.Vector3(Math.cos(a) * 1.03, 0.02, Math.sin(a) * 1.03), new T.Vector3(Math.cos(a) * 1.03, -0.1, Math.sin(a) * 1.03)); }
  for (const h of PEG_HOLES) keyPoints.push(new T.Vector3(h.x, PAWN_H + 0.22, h.y));
  const diePoints = (at) => [at.clone().add(new T.Vector3(0, DIE * 0.9, 0)), at.clone().add(new T.Vector3(-DIE, 0, 0)), at.clone().add(new T.Vector3(DIE, 0, DIE))];
  const playPoints = [...keyPoints, ...diePoints(PLAY_DIE)], showPoints = [...keyPoints, ...diePoints(SHOW_DIE)];
  let showcase = false;
  function frame() {
    const aspect = W / H;
    const elev = (showcase ? 32 : aspect < 0.75 ? 55 : aspect < 1.1 ? 50 : 42) * Math.PI / 180;
    camera.aspect = aspect; camera.clearViewOffset();
    const target = new T.Vector3(0, 0.05, 0), dir = new T.Vector3(0, Math.sin(elev), Math.cos(elev));
    const fit = (d) => {
      camera.position.copy(target).addScaledVector(dir, d); camera.lookAt(target); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const p of showcase ? showPoints : playPoints) { const v = p.clone().project(camera); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
      return { x0, x1, y0, y1 };
    };
    let lo = 1.5, hi = 20, box = null;
    const maxX = showcase ? 0.92 : 0.97, maxY = showcase ? 0.66 : 0.95;
    for (let k = 0; k < 28; k++) { const mid = (lo + hi) / 2, b = fit(mid); if ((b.x1 - b.x0) / 2 <= maxX && (b.y1 - b.y0) / 2 <= maxY) { hi = mid; box = b; } else lo = mid; }
    box = fit(hi);
    // centre the picture: shift the view by what is left over
    const cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2;
    const lift = showcase ? 0.3 : 0;
    camera.setViewOffset(W, H, (cx * W) / 2, ((-cy - lift) * H) / 2 + lift * H, W, H); camera.updateProjectionMatrix();
    const shadow = Math.min(2048, Math.max(1024, Math.round(Math.max(W, H) * ratio)));
    if (key.shadow.mapSize.x !== shadow) { key.shadow.mapSize.set(shadow, shadow); key.shadow.map?.dispose(); key.shadow.map = null; }
  }

  function resize() {
    if (!host) return;
    const r = host.getBoundingClientRect(); if (r.width < 4 || r.height < 4) return;
    W = Math.floor(r.width); H = Math.floor(r.height); ratio = Math.min(showcase ? 1.5 : 2, window.devicePixelRatio || 1);
    renderer.setPixelRatio(ratio); renderer.setSize(W, H, false);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    overlay.width = Math.ceil(W * ratio); overlay.height = Math.ceil(H * ratio); overlay.style.width = W + 'px'; overlay.style.height = H + 'px';
    frame();
  }
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { resize(); if (showcase) paint(performance.now()); }) : null;
  function attach(el, { idle = false } = {}) {
    if (host !== el) { ro?.disconnect(); host = el; el.prepend(overlay); el.prepend(canvas); ro?.observe(el); }
    showcase = idle; world.rotation.y = 0; DIE_AT.copy(idle ? SHOW_DIE : PLAY_DIE); die.position.copy(DIE_AT); dieGlow.position.copy(DIE_AT).add(new T.Vector3(0, 0.05, 0.3)); resize();
    if (idle) startShowcase(); else stopShowcase();
  }

  /* ---------- turning each frame's instructions into the scene ---------- */
  const tmp = new T.Vector3(), white = new T.Color(0xffffff);
  function setPawn(i, fx, taken, t, hover) {
    const p = pawns[i], f = fx || {};
    const visible = (!taken || f.keep) && !f.hidden && (f.alpha ?? 1) > 0.01;
    p.root.visible = visible; p.hit.visible = !taken;
    if (!visible) { p.ring.material.opacity = 0; return; }
    const lift = (f.lift || 0) + (hover ? 0.12 + Math.sin(t / 180) * 0.02 : 0);
    if (f.at) p.root.position.set(f.at.x, (f.at.h || 0), f.at.y); else p.root.position.copy(p.home);
    p.root.position.y += lift * LIFT; p.root.position.x += (f.dx || 0) * 0.0035;
    const s = f.scale ?? 1; p.root.scale.setScalar(s);
    // turning over: the foot comes round toward the camera
    const elev = Math.atan2(camera.position.y, Math.hypot(camera.position.x, camera.position.z));
    p.pivot.rotation.x = -clamp(f.tip || 0) * (Math.PI / 2 + elev);
    const alpha = f.alpha ?? 1, fade = alpha < 0.999;
    if (p.mat.transparent !== fade) { p.mat.transparent = fade; p.mat.needsUpdate = true; }
    p.mat.opacity = alpha;
    const color = f.color;
    if (color !== p.shownColor) {
      p.shownColor = color;
      p.footMat.map = color === undefined || color === null ? unknownTex : color >= 0 ? footTex[color] : unknownTex;
      p.footMat.needsUpdate = true;
    }
    const showing = (f.tip || 0) > 0.35 && color !== undefined && color !== null;
    p.footMat.color.setScalar(showing ? (f.glow ? 1.08 : 0.96) : 0.7);
    const glowCol = f.glow || null;
    p.glow.material.opacity = glowCol ? 0.8 * alpha : 0;
    if (glowCol) p.glow.material.color.set(glowCol);
    const ringCol = f.ring || (hover ? '#ffc94d' : null);
    if (ringCol) { p.ring.material.color.set(ringCol.startsWith('rgba') ? '#fff4e0' : ringCol); p.ring.material.opacity = ringCol.startsWith('rgba') ? 0.16 + Math.sin(t / 300 + i) * 0.06 : 0.75 + Math.sin(t / 160) * 0.2; }
    else p.ring.material.opacity = 0;
    p.mark.material.opacity = f.mark ? 1 : 0;
  }
  function stepDie(t) {
    const a = dieState.anim;
    if (a) {
      const k = clamp((t - a.start) / a.ms), e = ease(k);
      const q = a.from.clone().slerp(a.to, e);
      const spin = new T.Quaternion().setFromAxisAngle(a.axis, (1 - e) * a.turns * TAU);
      die.quaternion.copy(spin.multiply(q));
      const hop = Math.sin(Math.PI * Math.min(1, k * 1.15)) * a.height * (1 - k * 0.6);
      die.position.copy(DIE_AT).add(tmp.set(0, Math.max(0, hop), 0));
      if (k >= 1) { dieState.anim = null; a.done(); }
    } else if (dieState.spin) {
      die.rotateOnWorldAxis(tmp.set(1, 0.6, 0.2).normalize(), 0.22); die.position.copy(DIE_AT).add(tmp.set(0, 0.06 + Math.sin(t / 90) * 0.02, 0));
    } else die.position.y = DIE_AT.y + Math.sin(t / 700) * 0.012;
    const ready = dieState.ready && !dieState.anim && !dieState.spin;
    dieHalo.position.copy(die.position); dieHalo.material.opacity = ready ? 0.4 + Math.sin(t / 260) * 0.2 : dieState.color !== null && !dieState.anim ? 0.45 : 0;
    dieHalo.material.color.set(dieState.color !== null && !ready ? PEG_COLORS[dieState.color].hex : '#ffc94d');
    const want = dieState.color !== null && !dieState.anim ? 1 : 0; dieState.light += (want - dieState.light) * 0.12;
    dieGlow.intensity = dieState.light * 1.6; if (dieState.color !== null) dieGlow.color.set(PEG_COLORS[dieState.color].hex);
    gems.forEach((g, c) => { g.emissiveIntensity = 0.12 + (dieState.color === c ? dieState.light * 1.4 : 0); });
  }
  function drawParticles(list, t) {
    ov.setTransform(ratio, 0, 0, ratio, 0, 0); ov.clearRect(0, 0, W, H);
    for (const p of list) {
      const k = clamp((t - p.start) / p.life); if (k <= 0 || k >= 1) continue;
      const s = k * p.life / 1000, x = p.x + p.vx * s, y = p.y + p.vy * s + 260 * s * s * (p.fall ?? 1);
      ov.globalAlpha = 1 - k;
      if (p.text) {
        ov.font = '900 ' + Math.round(p.size) + 'px Tajawal, system-ui, sans-serif'; ov.textAlign = 'center'; ov.textBaseline = 'middle'; ov.direction = 'ltr';
        ov.lineWidth = p.size * 0.16; ov.strokeStyle = '#2b1300'; ov.strokeText(p.text, x, y); ov.fillStyle = p.color; ov.fillText(p.text, x, y);
      } else {
        ov.save(); ov.translate(x, y); ov.rotate(p.spin * k * 6); ov.fillStyle = p.color;
        if (p.round) { ov.beginPath(); ov.arc(0, 0, p.size / 2, 0, TAU); ov.fill(); } else ov.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ov.restore();
      }
    }
    ov.globalAlpha = 1;
  }
  const scanDisc = new T.Mesh(new T.CircleGeometry(0.16, 32), new T.MeshBasicMaterial({ map: glowTex, color: 0xffd86b, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending }));
  scanDisc.rotation.x = -Math.PI / 2; scanDisc.position.y = 0.006; world.add(scanDisc);

  function draw(view) {
    if (lost || !host) return;
    const t = view.time || performance.now();
    let bright = null;
    for (let i = 0; i < pawns.length; i++) {
      const f = view.fx[i], taken = view.pegs[i].taken !== null;
      setPawn(i, f, taken, t, view.hover === i && !taken);
      if (f?.glow && (f.tip || 0) > 0.5) bright = { i, color: f.glow };
    }
    if (bright) { const p = pawns[bright.i]; reveal.position.copy(p.root.position).add(tmp.set(0, 0.32, 0.12)); reveal.color.set(bright.color); reveal.intensity += (1.4 - reveal.intensity) * 0.2; }
    else reveal.intensity *= 0.85;
    if (view.scan) { const b = toBoard(view.scan.x, view.scan.y, PIVOT); scanDisc.position.x = b.x; scanDisc.position.z = b.y; scanDisc.material.color.set(view.scan.color || '#ffd86b'); scanDisc.material.opacity = 0.9; }
    else scanDisc.material.opacity = 0;
    stepDie(t);
    renderer.render(scene, camera);
    drawParticles(view.particles || [], t);
  }

  /* ---------- the menu's living board: it turns slowly and a piece shows its colour now and then ---------- */
  let showRaf = 0; const showFx = pawns.map(() => ({}));
  const showPegs = PEG_HOLES.map(() => ({ taken: null }));
  let showNext = 0, showDie = 0;
  function paint(t) {
    world.rotation.y = t / 9000;
    if (t > showDie) { showDie = t + 5200; api.die.roll([Math.floor(Math.random() * 6)], true); }
    if (t > showNext) {
      showNext = t + 1400;
      const i = Math.floor(Math.random() * pawns.length), c = Math.floor(Math.random() * 6), f = showFx[i], start = t;
      f.color = c; f.glow = PEG_COLORS[c].hex; f.anim = { start, i };
    }
    for (const f of showFx) {
      if (!f.anim) continue;
      const k = (t - f.anim.start) / 2600;
      if (k >= 1) { delete f.anim; f.lift = 0; f.tip = 0; delete f.glow; continue; }
      const up = k < 0.2 ? ease(k / 0.2) : k > 0.75 ? 1 - ease((k - 0.75) / 0.25) : 1;
      f.lift = up * 0.85; f.tip = up * 0.72;
    }
    draw({ pegs: showPegs, fx: showFx, time: t });
  }
  let lastPaint = 0;
  function loop(t) { showRaf = 0; if (!showcase) return; if (!document.hidden && t - lastPaint > 30) { lastPaint = t; paint(t); } showRaf = requestAnimationFrame(loop); }
  function startShowcase() { dieState.color = null; dieState.ready = false; if (!showRaf) showRaf = requestAnimationFrame(loop); }
  function stopShowcase() { if (showRaf) cancelAnimationFrame(showRaf); showRaf = 0; world.rotation.y = 0; for (const f of showFx) for (const k of Object.keys(f)) delete f[k]; }

  /* ---------- from the screen to the board and back ---------- */
  const ray = new T.Raycaster(), ndc = new T.Vector2();
  function toNdc(x, y) { ndc.set((x / W) * 2 - 1, -(y / H) * 2 + 1); return ndc; }
  function project(v) { const p = v.clone().project(camera); return { x: (p.x + 1) / 2 * W, y: (1 - p.y) / 2 * H }; }
  function toBoard(x, y, h = 0) {
    ray.setFromCamera(toNdc(x, y), camera);
    const plane = new T.Plane(new T.Vector3(0, 1, 0), -h), out = new T.Vector3();
    if (!ray.ray.intersectPlane(plane, out)) { out.copy(ray.ray.origin).addScaledVector(ray.ray.direction, 3); }
    return { x: out.x, y: out.z, h };
  }
  function hit(x, y, pegs) {
    ray.setFromCamera(toNdc(x, y), camera);
    const found = ray.intersectObjects(hits.filter((m, i) => pegs[i]?.taken === null), false)[0];
    if (found) return found.object.userData.peg;
    let best = -1, bestD = 34 * 34;
    pegs.forEach((p, i) => { if (p.taken !== null) return; const m = project(new T.Vector3(PEG_HOLES[i].x, PIVOT, PEG_HOLES[i].y)), d = (m.x - x) ** 2 + (m.y - y) ** 2; if (d < bestD) { bestD = d; best = i; } });
    return best;
  }
  function hitDie(x, y) { ray.setFromCamera(toNdc(x, y), camera); return ray.intersectObject(die, false).length > 0; }

  const api = {
    is3d: true, canvas, overlay, attach, resize, draw, hit, hitDie, toBoard,
    foot: (i) => { const p = project(new T.Vector3(PEG_HOLES[i].x, 0, PEG_HOLES[i].y)); return { ...p, s: 1, wy: PEG_HOLES[i].y }; },
    middle: (i) => project(new T.Vector3(PEG_HOLES[i].x, PIVOT, PEG_HOLES[i].y)),
    get size() { const c = project(new T.Vector3(0, 0, 0)), top = project(new T.Vector3(0, PAWN_H, 0)); return { W, H, cx: c.x, cy: c.y, R: Math.abs(project(new T.Vector3(1, 0, 0)).x - c.x), pawn: Math.abs(c.y - top.y) }; },
    die: {
      /** Tumbles onto each face in turn (a colour that is gone makes it roll again). */
      async roll(faces, quiet = false) {
        dieState.spin = false; dieState.color = null;
        for (let k = 0; k < faces.length; k++) {
          const to = faceQuat(faces[k]), axis = new T.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
          await new Promise((done) => { dieState.anim = { from: die.quaternion.clone(), to, axis, turns: k ? 1 : 2, height: k ? 0.12 : 0.28, start: performance.now(), ms: k ? 520 : 1000, done }; });
          if (!quiet) api.onLand?.(faces[k], k === faces.length - 1);
        }
        dieState.color = faces[faces.length - 1];
      },
      spin() { dieState.spin = true; dieState.color = null; },
      stop() { dieState.spin = false; },
      show(c) { dieState.spin = false; dieState.anim = null; die.quaternion.copy(faceQuat(c)); die.position.copy(DIE_AT); dieState.color = c; },
      clear() { dieState.color = null; },
      ready(on) { dieState.ready = Boolean(on); },
      get point() { return project(DIE_AT); },
    },
    /** Stops or restarts the menu's turning board (when it scrolls out of sight). */
    hold(on) { if (!showcase) return; if (on) { if (showRaf) cancelAnimationFrame(showRaf); showRaf = 0; } else if (!showRaf) showRaf = requestAnimationFrame(loop); },
    /** Something on the table is moving by itself (the die). */
    get animating() { return Boolean(dieState.anim || dieState.spin || Math.abs(dieState.light - (dieState.color !== null ? 1 : 0)) > 0.02 || reveal.intensity > 0.02); },
    /** The scene itself, for the cover render and the tests. */
    get parts() { return { T, camera, scene, renderer, world, die, pawns, reveal, dieGlow, key }; },
    get lost() { return lost; },
    onLost: null, onLand: null,
    dispose() { stopShowcase(); ro?.disconnect(); renderer.dispose(); },
  };
  return api;
}
