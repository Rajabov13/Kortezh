// prep.mjs <in.gltf> <out.glb> [flip=0|1|auto] — запекает трансформации, ставит машину вдоль +Z (перёд), на землю,
// находит колёса геометрически и выносит их в узлы wheel_FL/FR/RL/RR
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { clearNodeTransform, flatten, prune, dedup } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
const [,, inp, outp, flipArg = 'auto'] = process.argv;
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(inp); const root = doc.getRoot(), scene = root.getDefaultScene() || root.listScenes()[0];
// убрать анимации, камеры, лишние сцены
for (const a of root.listAnimations()) a.dispose();
await doc.transform(flatten());
for (const n of root.listNodes()) if (n.getMesh()) clearNodeTransform(n);
for (const n of root.listNodes()) if (!n.getMesh()) { n.setTranslation([0,0,0]); n.setRotation([0,0,0,1]); n.setScale([1,1,1]); }
// собрать все примитивы
const prims = []; for (const n of root.listNodes()) { const m = n.getMesh(); if (!m) continue; for (const p of m.listPrimitives()) if (p.getMode() === 4) prims.push({ n, m, p }); }
const v = [0,0,0];
const pb = p => { const a = p.getAttribute('POSITION'), mn = [1e9,1e9,1e9], mx = [-1e9,-1e9,-1e9]; for (let i = 0; i < a.getCount(); i++) { a.getElement(i, v); for (let k = 0; k < 3; k++) { if (v[k] < mn[k]) mn[k] = v[k]; if (v[k] > mx[k]) mx[k] = v[k]; } } return { min: mn, max: mx, n: a.getCount() }; };
for (const pr of prims) pr.b = pb(pr.p);
// основной габарит — по крупным примитивам; мелкий мусор (кубы, плоскости теней) вне габарита удаляем
const big = prims.filter(pr => pr.b.n > 300), B = { min: [1e9,1e9,1e9], max: [-1e9,-1e9,-1e9] };
for (const pr of (big.length ? big : prims)) for (let k = 0; k < 3; k++) { B.min[k] = Math.min(B.min[k], pr.b.min[k]); B.max[k] = Math.max(B.max[k], pr.b.max[k]); }
{ const sz = B.max.map((x, k) => x - B.min[k]), tol = Math.max(...sz) * 0.04;
  for (let i = prims.length - 1; i >= 0; i--) { const pr = prims[i]; let out = false; for (let k = 0; k < 3; k++) if (pr.b.min[k] < B.min[k] - tol || pr.b.max[k] > B.max[k] + tol) out = true;
    const flat = pr.b.max[1] - pr.b.min[1] < sz[1] * 0.01 && pr.b.min[1] <= B.min[1] + sz[1] * 0.02 && pr.b.n < 64;
    if (out || flat) { console.log('удалён мусор', pr.n.getName(), pr.b.n); pr.m.removePrimitive(pr.p); prims.splice(i, 1); } } }
const S = B.max.map((x, k) => x - B.min[k]);
const longAx = S[0] > S[2] ? 0 : 2, latAx = 2 - longAx, H = S[1], L = S[longAx], W = S[latAx], g0 = B.min[1];
const C = B.min.map((x, k) => (x + B.max[k]) / 2);
console.log('size', S.map(x => x.toFixed(2)).join(' x '), 'long', 'xyz'[longAx]);
// компоненты связности (по совпадающим позициям)
const comps = [];
for (const pr of prims) {
  const a = pr.p.getAttribute('POSITION'), idxA = pr.p.getIndices(), n = a.getCount();
  const idx = idxA ? idxA.getArray() : Array.from({ length: n }, (_, i) => i);
  const par = new Int32Array(n).map((_, i) => i), find = x => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; }, uni = (x, y) => { x = find(x); y = find(y); if (x !== y) par[x] = y; };
  const key = new Map(), q = 1e4;
  for (let i = 0; i < n; i++) { a.getElement(i, v); const k = Math.round(v[0] * q) + ',' + Math.round(v[1] * q) + ',' + Math.round(v[2] * q); const o = key.get(k); if (o === undefined) key.set(k, i); else uni(i, o); }
  for (let t = 0; t < idx.length; t += 3) { uni(idx[t], idx[t + 1]); uni(idx[t], idx[t + 2]); }
  const cm = new Map();
  for (let t = 0; t < idx.length; t += 3) { const r = find(idx[t]); let c = cm.get(r); if (!c) { c = { pr, tris: [], min: [1e9,1e9,1e9], max: [-1e9,-1e9,-1e9] }; cm.set(r, c); comps.push(c); } c.tris.push(t);
    for (let j = 0; j < 3; j++) { a.getElement(idx[t + j], v); for (let k = 0; k < 3; k++) { if (v[k] < c.min[k]) c.min[k] = v[k]; if (v[k] > c.max[k]) c.max[k] = v[k]; } } }
  pr.idx = idx;
}
// кандидаты в колёса: внизу, по краям, круглые в профиль
const cand = [];
for (const c of comps) {
  const h = c.max[1] - c.min[1], l = c.max[longAx] - c.min[longAx], w = c.max[latAx] - c.min[latAx];
  const cy = (c.max[1] + c.min[1]) / 2 - g0, cl = (c.max[longAx] + c.min[longAx]) / 2 - C[longAx], cw = (c.max[latAx] + c.min[latAx]) / 2 - C[latAx];
  if (h > 0.18 * H && h < 0.62 * H && c.min[1] - g0 < 0.08 * H && Math.abs(h - l) < 0.2 * Math.max(h, l) && w < 0.25 * W && Math.abs(cw) > 0.2 * W && Math.abs(cl) > 0.15 * L) cand.push({ c, h, cy, cl, cw });
}
// для каждого угла — самая большая «шина»
const wheels = [];
for (const sl of [1, -1]) for (const sw of [1, -1]) {
  const cs = cand.filter(o => Math.sign(o.cl) === sl && Math.sign(o.cw) === sw).sort((a, b) => b.h - a.h);
  if (!cs.length) { console.log('нет колеса', sl, sw); continue; }
  const t = cs[0].c, ctr = t.min.map((x, k) => (x + t.max[k]) / 2), r = (t.max[1] - t.min[1]) / 2;
  // ширина колеса — по всем соосным крупным кольцам/дискам этого угла
  let latMin = t.min[latAx], latMax = t.max[latAx];
  for (const o of cs) { const c = o.c, cc = c.min.map((x, k) => (x + c.max[k]) / 2); if (o.h > 1.2 * r * 0.5 && Math.abs(cc[1] - ctr[1]) < 0.15 * r && Math.abs(cc[longAx] - ctr[longAx]) < 0.15 * r) { latMin = Math.min(latMin, c.min[latAx]); latMax = Math.max(latMax, c.max[latAx]); } }
  if (latMax - latMin < 0.35 * r) { const sgn = Math.sign(ctr[latAx] - C[latAx]); if (sgn > 0) latMin = latMax - 0.6 * r; else latMax = latMin + 0.6 * r; }
  wheels.push({ sl, sw, ctr, r, latMin, latMax, comps: [] });
}
console.log('колёс', wheels.length, wheels.map(w => 'r=' + w.r.toFixed(3)).join(' '));
// все компоненты, целиком лежащие в цилиндре колеса
if (process.env.DBG) { const w = wheels[0]; console.log('W', w.ctr.map(x=>x.toFixed(2)), w.r.toFixed(2), w.latMin.toFixed(2), w.latMax.toFixed(2)); for (const c of comps) { const cl=(c.max[longAx]+c.min[longAx])/2, cy=(c.max[1]+c.min[1])/2; if (Math.abs(cl-w.ctr[longAx])<0.5 && Math.sign((c.max[latAx]+c.min[latAx])/2-C[latAx])===Math.sign(w.ctr[latAx]-C[latAx])) console.log(' c', c.pr.n.getName(), c.tris.length, c.min.map(x=>x.toFixed(2)).join(','), '|', c.max.map(x=>x.toFixed(2)).join(',')); } }
for (const c of comps) for (const w of wheels) {
  const pad = 0.04 * w.r, lw = w.latMax - w.latMin;
  if (c.min[latAx] < w.latMin - lw * 0.25 || c.max[latAx] > w.latMax + lw * 0.25) continue;
  let inside = true; for (const k of [1, longAx]) if (c.min[k] < w.ctr[k] - w.r - pad || c.max[k] > w.ctr[k] + w.r + pad) inside = false;
  const corners = [[c.min[1], c.min[longAx]], [c.min[1], c.max[longAx]], [c.max[1], c.min[longAx]], [c.max[1], c.max[longAx]]];
  // компонент с углами далеко за окружностью (кусок кузова) не берём
  const far = corners.filter(([y, l]) => Math.hypot(y - w.ctr[1], l - w.ctr[longAx]) > w.r * 1.45).length;
  if (inside && far === 0) { w.comps.push(c); c.wheel = w; break; }
}
// перёд: где красные фонари — там зад
let flip = flipArg === '1' ? true : flipArg === '0' ? false : null;
if (flip === null) {
  let rs = 0, rn = 0, hs = 0, hn = 0;
  for (const c of comps) { const m = c.pr.p.getMaterial(); if (!m) continue; const nm = (m.getName() || '').toLowerCase(), bc = m.getBaseColorFactor(), e = m.getEmissiveFactor(); const cl = (c.max[longAx] + c.min[longAx]) / 2 - C[longAx];
    const red = /tail|brake|rear|stop|red/.test(nm) || (bc[0] > 0.45 && bc[1] < 0.2 && bc[2] < 0.2) || (e[0] > 0.4 && e[1] < 0.2);
    const head = /head|front.?light|headlight/.test(nm);
    if (red && Math.abs(cl) > 0.35 * L) { rs += Math.sign(cl) * c.tris.length; rn += c.tris.length; }
    if (head && Math.abs(cl) > 0.35 * L) { hs += Math.sign(cl) * c.tris.length; hn += c.tris.length; } }
  const frontSign = rn ? -Math.sign(rs) : hn ? Math.sign(hs) : 1;
  console.log('красное', rn, rs, 'фары', hn, hs, '→ перёд по', frontSign > 0 ? '+' : '-', 'xyz'[longAx]);
  flip = frontSign < 0;
}
// перенести треугольники колёс в отдельные меши
const names = { '1,1': 'FL', '1,-1': 'FR', '-1,1': 'RL', '-1,-1': 'RR' };
const keep = new Map(); for (const pr of prims) keep.set(pr, []);
const wheelTris = new Map();
for (const c of comps) { if (c.wheel) { const k = c.wheel; if (!wheelTris.has(k)) wheelTris.set(k, new Map()); const m = wheelTris.get(k); if (!m.has(c.pr)) m.set(c.pr, []); m.get(c.pr).push(...c.tris); } else keep.get(c.pr).push(...c.tris); }
const mkIdx = (pr, tris) => { const arr = new Uint32Array(tris.length * 3); tris.forEach((t, i) => { arr[i * 3] = pr.idx[t]; arr[i * 3 + 1] = pr.idx[t + 1]; arr[i * 3 + 2] = pr.idx[t + 2]; }); return doc.createAccessor().setType('SCALAR').setArray(arr).setBuffer(root.listBuffers()[0]); };
const holder = doc.createNode('car');
for (const [w, m] of wheelTris) {
  const mesh = doc.createMesh('wheel'); 
  for (const [pr, tris] of m) { const np = pr.p.clone(); np.setIndices(mkIdx(pr, tris)); mesh.addPrimitive(np); }
  // имя по стороне после выравнивания (перёд +Z, лево +X при взгляде вперёд... в игре x>0 — левая сторона)
  holder.addChild(doc.createNode('wheel_' + (w.sl * (flip ? -1 : 1) > 0 ? 'F' : 'R') + (w.sw > 0 ? 'A' : 'B')).setMesh(mesh));
}
for (const pr of prims) { const t = keep.get(pr); if (t.length === pr.idx.length / 3) continue; if (!t.length) pr.m.removePrimitive(pr.p); else pr.p.setIndices(mkIdx(pr, t)); }
for (const n of root.listNodes()) if (n !== holder && n.getMesh() && n.getParentNode() !== holder) { n.detach?.(); holder.addChild(n); }
for (const ch of scene.listChildren()) if (ch !== holder) scene.removeChild(ch);
scene.addChild(holder);
// выравнивание: длина по Z, перёд +Z, по центру, на земле
let ang = longAx === 0 ? -Math.PI / 2 : 0; if (flip) ang += Math.PI;
// поворот вокруг Y: длинная ось X → Z
const rotY = ang; holder.setRotation([0, Math.sin(rotY / 2), 0, Math.cos(rotY / 2)]);
const c0 = [C[0], g0, C[2]], cs = Math.cos(rotY), sn = Math.sin(rotY);
holder.setTranslation([-(cs * c0[0] + sn * c0[2]), -c0[1], -(-sn * c0[0] + cs * c0[2])]);
await doc.transform(prune(), dedup());
await io.write(outp, doc);
console.log('wheels', wheels.map(w => names[w.sl + ',' + w.sw] + ':' + w.comps.length).join(' '), 'flip', flip);
