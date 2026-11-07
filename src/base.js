import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { Lensflare, LensflareElement } from 'three/addons/objects/Lensflare.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';

/* =====================================================================
   КОРТЕЖ: Успей на работу
   Классы: Game, Car (CarVisual/PlayerCar), Escort, Traffic, City/Mountain,
           Atmosphere (погода и время суток), AudioSys, UI, Input, Post,
           Garage, PhotoMode, Replay, Events
   ===================================================================== */

// ---------- раскладка города (меняется от уровня к уровню) ----------
let CELL = 100, NX = 7, NZ = 7, RH = 7, SW = 4, LOT = 11, LANES = [1.75, 5.25], STOPD = 14;
const STEP = 1 / 60, PSTEP = 0.5;
function setLayout(L) {
  CELL = L.cell; NX = L.nx; NZ = L.nz; LANES = [];
  for (let i = 0; i < L.lanes; i++) LANES.push(1.75 + i * 3.5);
  RH = L.lanes * 3.5 + (L.lanes === 1 ? 0.6 : 0); SW = L.sw; LOT = RH + SW; STOPD = RH + 7;
}
const YL = () => LANES.length - 1;
const yieldOff = () => LANES.length === 1 ? RH + 0.9 : LANES[YL()] + 0.5;

// ---------- утилиты ----------
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const RIGHT = d => (d + 1) % 4, LEFT = d => (d + 3) % 4;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const wrapA = d => { while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
const lerpA = (a, b, t) => a + wrapA(b - a) * t;
const smooth = t => t * t * (3 - 2 * t);
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const pick = (arr, r = Math.random) => arr[Math.floor(r() * arr.length)];
const shuffle = (a, r = Math.random) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const fmtTime = s => { s = Math.max(0, Math.ceil(s)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
const fmtDist = m => m >= 1000 ? (m / 1000).toFixed(1).replace('.', ',') + ' км' : Math.max(0, Math.round(m / 10) * 10) + ' м';
const fmtPts = n => Math.round(n).toLocaleString('ru-RU');
const plural = (n, a, b, c) => { const m = Math.abs(n) % 100, k = m % 10; return m > 10 && m < 20 ? c : k > 1 && k < 5 ? b : k === 1 ? a : c; };
const todayKey = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
const isTouch = ('ontouchstart' in window) || matchMedia('(pointer:coarse)').matches;
const $ = id => document.getElementById(id);

// ---------- canvas-текстуры ----------
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function texFrom(c, o = {}) {
  const t = new THREE.CanvasTexture(c); t.colorSpace = o.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace; t.anisotropy = o.aniso ?? 8;
  if (o.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(o.repeat[0], o.repeat[1]); }
  return t;
}
function speckle(g, w, h, n, amt) {
  for (let i = 0; i < n; i++) {
    const l = Math.random() < 0.5; g.fillStyle = l ? `rgba(255,255,255,${Math.random() * amt})` : `rgba(0,0,0,${Math.random() * amt * 1.4})`;
    const s = 1 + Math.random() * 2; g.fillRect(Math.random() * w, Math.random() * h, s, s);
  }
}
function star5(g, x, y, r) { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill(); }
function drawUzFlag(g, x, y, w, h) {
  const b = h / 3;
  g.fillStyle = '#0099b5'; g.fillRect(x, y, w, b);
  g.fillStyle = '#ffffff'; g.fillRect(x, y + b, w, b);
  g.fillStyle = '#1eb53a'; g.fillRect(x, y + 2 * b, w, b);
  g.fillStyle = '#ce1126'; g.fillRect(x, y + b - h * 0.02, w, h * 0.04); g.fillRect(x, y + 2 * b - h * 0.02, w, h * 0.04);
  const cx = x + w * 0.12, cy = y + b * 0.5, r = b * 0.34;
  g.fillStyle = '#fff'; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#0099b5'; g.beginPath(); g.arc(cx + r * 0.33, cy, r * 0.84, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff'; const sp = b * 0.19;
  [3, 4, 5].forEach((n, ri) => { for (let k = 0; k < n; k++) star5(g, x + w * 0.2 + (5 - n + k) * sp, y + b * 0.2 + ri * b * 0.29, sp * 0.32); });
}
let UZ_FLAG_TEX = null;
function uzFlagTex() {
  if (!UZ_FLAG_TEX) {
    const c = makeCanvas(512, 256), g = c.getContext('2d'); drawUzFlag(g, 0, 0, 512, 256);
    // фактура ткани: тонкое плетение и мягкая тень у древка
    g.globalAlpha = 0.07; for (let y = 0; y < 256; y += 3) { g.fillStyle = y % 6 ? '#000' : '#fff'; g.fillRect(0, y, 512, 1); }
    g.globalAlpha = 1; const gr = g.createLinearGradient(0, 0, 40, 0); gr.addColorStop(0, 'rgba(0,0,0,.28)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 40, 256);
    UZ_FLAG_TEX = texFrom(c);
  }
  return UZ_FLAG_TEX;
}
// мягкое свечение для мигалок и стробоскопов
let GLOW_TEX = null;
function glowTex() {
  if (!GLOW_TEX) { const c = makeCanvas(128, 128), g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,255,255,.85)'); gr.addColorStop(0.45, 'rgba(255,255,255,.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); GLOW_TEX = texFrom(c); }
  return GLOW_TEX;
}
// двойная вспышка, как у настоящих светодиодных маячков: «вспых-вспых — пауза»
const flash2 = (t, ph = 0, per = 0.62) => { const k = ((t / per + ph) % 1 + 1) % 1; return (k < 0.09 || (k > 0.16 && k < 0.25)) ? 1 : 0; };

// ---------- геометрия: слияние и окраска ----------
function prep(g) { const n = g.index ? g.toNonIndexed() : g; if (!n.attributes.uv) n.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2)); for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) n.deleteAttribute(k); return n; }
function merge(list) { const arr = list.map(prep); const m = mergeGeometries(arr, false); arr.forEach(g => g.dispose()); return m; }
function colored(g, col) {
  const n = prep(g), c = Array.isArray(col) ? new THREE.Color().setRGB(col[0], col[1], col[2]) : new THREE.Color(col);
  const a = new Float32Array(n.attributes.position.count * 3);
  for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; }
  n.setAttribute('color', new THREE.BufferAttribute(a, 3)); return n;
}
function box(w, h, d, x, y, z, ry = 0, rx = 0, rz = 0) { const g = new THREE.BoxGeometry(w, h, d); if (rz) g.rotateZ(rz); if (rx) g.rotateX(rx); if (ry) g.rotateY(ry); g.translate(x, y, z); return g; }
function cyl(rt, rb, h, seg, x, y, z, axis) { const g = new THREE.CylinderGeometry(rt, rb, h, seg); if (axis === 'x') g.rotateZ(Math.PI / 2); if (axis === 'z') g.rotateX(Math.PI / 2); g.translate(x, y, z); return g; }
function sph(r, x, y, z, sx = 1, sy = 1, sz = 1, seg = 12) { const g = new THREE.SphereGeometry(r, seg, Math.max(6, seg * 0.6 | 0)); g.scale(sx, sy, sz); g.translate(x, y, z); return g; }
function rbox(w, h, d, r, x, y, z, ry = 0, rx = 0) { // скруглённый параллелепипед
  const s = new THREE.Shape(), hw = w / 2 - r, hh = h / 2 - r;
  s.moveTo(-hw, -h / 2); s.lineTo(hw, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -hh); s.lineTo(w / 2, hh); s.quadraticCurveTo(w / 2, h / 2, hw, h / 2); s.lineTo(-hw, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, hh); s.lineTo(-w / 2, -hh); s.quadraticCurveTo(-w / 2, -h / 2, -hw, -h / 2);
  const bv = Math.min(r, d / 2 - 0.001), g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.001, d - 2 * bv), bevelEnabled: true, bevelThickness: bv, bevelSize: bv * 0.8, bevelSegments: 2, curveSegments: 4 });
  g.translate(0, 0, -(d - 2 * bv) / 2); if (rx) g.rotateX(rx); if (ry) g.rotateY(ry); g.translate(x, y, z); return g;
}
