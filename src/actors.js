
/* =====================================================================
   Люди: пешеходы, инспекторы, охрана, рабочие
   ===================================================================== */
const PG = {};
function personGeo() { if (!PG.leg) { PG.leg = new THREE.BoxGeometry(0.15, 0.82, 0.17).translate(0, -0.41, 0); PG.arm = new THREE.BoxGeometry(0.1, 0.62, 0.11).translate(0, -0.31, 0); } return PG; }
const MCOL = new Map();
function mcol(hex) { if (!MCOL.has(hex)) MCOL.set(hex, new THREE.MeshStandardMaterial({ color: hex, roughness: 0.8 })); return MCOL.get(hex); }
function makePerson(c) {
  personGeo();
  const g = new THREE.Group();
  const parts = [colored(new THREE.BoxGeometry(0.42, 0.62, 0.24).translate(0, 1.14, 0), c.shirt), colored(new THREE.SphereGeometry(0.12, 10, 8).translate(0, 1.6, 0), c.skin),
    colored(new THREE.SphereGeometry(0.125, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 1.62, -0.005), c.hair)];
  if (c.vest) parts.push(colored(new THREE.BoxGeometry(0.45, 0.4, 0.27).translate(0, 1.2, 0), c.vest));
  if (c.cap) { parts.push(colored(new THREE.CylinderGeometry(0.16, 0.13, 0.09, 12).translate(0, 1.74, 0), c.cap)); parts.push(colored(new THREE.BoxGeometry(0.2, 0.02, 0.13).translate(0, 1.7, 0.13), 0x111111)); }
  if (c.helmet) parts.push(colored(new THREE.SphereGeometry(0.15, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 1.66, 0), c.helmet));
  const torso = new THREE.Mesh(merge(parts), MAT.vcol); g.add(torso);
  const legL = new THREE.Mesh(PG.leg, mcol(c.pants)), legR = new THREE.Mesh(PG.leg, mcol(c.pants));
  legL.position.set(0.11, 0.84, 0); legR.position.set(-0.11, 0.84, 0);
  const armL = new THREE.Mesh(PG.arm, mcol(c.sleeve ?? c.shirt)), armR = new THREE.Mesh(PG.arm, mcol(c.sleeve ?? c.shirt));
  armL.position.set(0.27, 1.42, 0); armR.position.set(-0.27, 1.42, 0);
  g.add(legL, legR, armL, armR);
  return { g, legL, legR, armL, armR, ph: Math.random() * 6, torso };
}
function walkAnim(p, amt) { const s = Math.sin(p.ph) * amt; p.legL.rotation.x = s * 0.7; p.legR.rotation.x = -s * 0.7; p.armL.rotation.x = -s * 0.6; p.armR.rotation.x = s * 0.6; }
let BATON_MAT = null;
function batonMat() {
  if (BATON_MAT) return BATON_MAT;
  const c = makeCanvas(8, 64), g = c.getContext('2d'); for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#111' : '#fff'; g.fillRect(0, i * 8, 8, 8); }
  return (BATON_MAT = new THREE.MeshStandardMaterial({ map: texFrom(c, { aniso: 1 }), emissive: 0xffffff, emissiveIntensity: 0.15, roughness: 0.4 }));
}
function makeInspector() {
  const p = makePerson({ shirt: 0x24324f, sleeve: 0x24324f, pants: 0x1c2438, skin: 0xc58c64, hair: 0x1a1410, vest: 0xc6f02c, cap: 0x1f2a44 });
  const bat = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.5, 8), batonMat()); bat.position.set(0, -0.82, 0.05); bat.rotation.x = 0.25; p.armR.add(bat);
  return p;
}
function disposeGroup(g) { g.parent && g.parent.remove(g); g.traverse(o => { if (o.geometry && !Object.values(PG).includes(o.geometry)) o.geometry.dispose(); }); }

/* =====================================================================
   PlayerCar — физика игрока с фиксированным шагом
   ===================================================================== */
const GEARS = [0, 16, 30, 46, 64, 86, 112, 999];
class PlayerCar {
  constructor(game, carId) {
    this.g = game; this.carId = carId; this.spec = CARS[carId]; this.build();
    this.reset(0, 0, 0);
  }
  build() {
    const t = tuneOf(this.carId), col = t.color ? COLORS.find(c => c.id === t.color)?.hex : undefined;
    if (this.vis) this.vis.dispose();
    this.vis = new CarVisual(this.spec, { color: col, finish: t.finish, tint: t.tint, rims: t.rims, beacon: t.beacon, flag: t.flag, plate: plateOf(this.g.roleId), interior: true, lightFx: true, modelId: this.carId });
    this.g.scene.add(this.vis.root);
    this.circ = [-this.spec.L * 0.3, 0, this.spec.L * 0.3]; this.rad = this.spec.W / 2 + 0.02;
  }
  reset(x, z, h) {
    Object.assign(this, { x, z, h, px: x, pz: z, ph: h, vx: 0, vz: 0, vL: 0, vT: 0, aL: 0, yaw: 0, steer: 0, damage: 0, engineDmg: 0, brakeOn: false, rev: false, gear: 'N', rpm: 800, onWalk: false, slip: 0, throttle: 0, y: 0, py: 0, slope: 0 });
    if (this.vis) this.vis.resetDamage();
  }
  savePrev() { this.px = this.x; this.pz = this.z; this.ph = this.h; this.py = this.y; }
  step(dt, inp) {
    const s = this.spec, sh = Math.sin(this.h), ch = Math.cos(this.h), fx = sh, fz = ch, rx = -ch, rz = sh, gm = this.g.gripMul ?? 1;
    let vL = this.vx * fx + this.vz * fz, vT = this.vx * rx + this.vz * rz;
    const spd = Math.abs(vL);
    this.steer = damp(this.steer, inp.steer * s.steer / (1 + spd * 0.05), 10, dt);
    const pw = (1 - this.engineDmg * 0.55) * (inp.boost ? 1.3 : 1), vmax = s.vmax * (inp.boost ? 1.06 : 1) * (1 - this.engineDmg * 0.4);
    let a = 0;
    if (inp.throttle > 0) { if (vL < -0.3) a += s.brake * inp.throttle; else { const q = clamp(vL / vmax, 0, 1); a += s.accel * inp.throttle * pw * (1 - q * q); } }
    if (inp.brake > 0) { if (vL > 0.3) a -= s.brake * inp.brake * (0.55 + 0.45 * gm); else if (vL > -9) a -= s.accel * 0.55 * inp.brake; }
    a -= vL * Math.abs(vL) * 0.0011 + vL * 0.03;
    if (!inp.throttle && !inp.brake) a -= Math.sign(vL) * Math.min(Math.abs(vL) / dt, 0.9);
    if (inp.hand) a -= Math.sign(vL) * Math.min(Math.abs(vL) / dt, 6.5);
    if (this.onWalk) a -= vL * 0.6;
    a -= 9.8 * Math.sin(this.slope) * 0.7;
    vL += a * dt;
    const grip = s.grip * gm * (inp.hand ? 0.16 : 1);
    vT *= Math.exp(-grip * dt);
    const yt = -vL * Math.tan(this.steer) / s.wb * (inp.hand ? 1.35 : 1);
    this.yaw = damp(this.yaw, yt, inp.hand ? 4 : 9 * (0.6 + 0.4 * gm), dt);
    this.vx = fx * vL + rx * vT; this.vz = fz * vL + rz * vT;
    this.h += this.yaw * dt; this.x += this.vx * dt; this.z += this.vz * dt;
    this.aL = (vL - this.vL) / dt; this.vL = vL; this.vT = vT; this.slip = Math.abs(vT);
    this.brakeOn = (inp.brake > 0 && vL > 0.3) || inp.hand; this.rev = vL < -0.4; this.throttle = inp.throttle;
    if (!this.g.world.isSpline) { const lx = ((this.x % CELL) + CELL) % CELL, lz = ((this.z % CELL) + CELL) % CELL; this.onWalk = Math.min(lx, CELL - lx) > RH && Math.min(lz, CELL - lz) > RH; } else this.onWalk = false;
    const kmh = spd * 3.6;
    if (vL < -0.4) { this.gear = 'R'; this.rpm = 1200 + kmh * 90; }
    else if (kmh < 1.5) { this.gear = inp.throttle ? '1' : 'N'; this.rpm = 800 + inp.throttle * 1600; }
    else { let k = 1; while (kmh > GEARS[k]) k++; const f = (kmh - GEARS[k - 1]) / (GEARS[k] - GEARS[k - 1]); this.gear = String(k); this.rpm = (k === 1 ? 900 : 1500) + f * (k === 1 ? 5200 : 4400) + inp.throttle * 300; }
  }
}

/* =====================================================================
   Сопровождение: ДПС впереди, охрана СБП, ДПС сзади
   ===================================================================== */
class EscortCar {
  constructor(game, kind, off, idx) {
    this.g = game; this.kind = kind; this.off = off; this.idx = idx; const pss = kind === 'pss';
    this.spec = pss ? CARS.gclass : CARS.police;
    this.vis = new CarVisual(this.spec, pss ? { color: 0x07080a, pss: true, tint: 't_limo', modelId: 'gclass', plate: { code: 'PSS', num: String(1001 + idx), region: '01', type: 'gov' } } : { color: 0xf2f4f7, police: true, modelId: 'police', plate: { code: 'VSB', num: String(1020 + idx), region: '01', type: 'gov' } });
    game.scene.add(this.vis.root); this.pose = { x: 0, z: 0, h: 0, y: 0, slope: 0 }; this.L = this.spec.L / 2; this.W = this.spec.W / 2; this.siren = !pss; this.lights = [];
    if (kind === 'lead') for (const col of [0xff1030, 0x1a5cff]) { const l = new THREE.PointLight(col, 0, 28, 2); l.position.set(col === 0xff1030 ? 0.5 : -0.5, this.spec.cab[4][1] + 0.4, -0.5); this.vis.root.add(l); this.lights.push(l); }
  }
  reset(s) { this.s = Math.max(0.5, s); this.v = 0; this.g.path.at(this.s, this.pose); this.x = this.px = this.pose.x; this.z = this.pz = this.pose.z; this.h = this.ph = this.pose.h; this.y = this.py = this.pose.y; this.aL = 0; }
  step(dt, sP, vP, active, front) {
    const g = this.g, path = g.path; this.px = this.x; this.pz = this.z; this.ph = this.h; this.py = this.y;
    let target;
    if (this.kind === 'tail') { const gap = sP + this.off - this.s; target = active ? vP + gap * 0.8 : 0; if (sP - this.s < 8) target = Math.min(target, Math.max(0, (sP - this.s - 5) * 1.5)); }
    else { const gap = this.s - sP; target = active ? vP + (this.off - gap) * 0.55 : 0; if (gap > this.off + 50) target = 0; }
    if (front) target = Math.min(target, Math.max(0, (front.s - this.s - 10) * 0.9 + front.v));
    target = clamp(target, 0, 26);
    let lim = 30; for (let d = 0; d <= 36; d += 2) lim = Math.min(lim, Math.sqrt(path.lim(this.s + d) ** 2 + 2 * 4 * d));
    lim = Math.min(lim, Math.sqrt(2 * 4 * Math.max(0, path.len - 1 - this.s)));
    const ob = g.traffic.obstacleAhead(this.x, this.z, this.h, 30, 1.8, null);
    if (ob < 1e8) lim = Math.min(lim, Math.sqrt(2 * 6 * Math.max(0, ob - 3)));
    for (const o of g.eventObs) { const dx = o.x - this.x, dz = o.z - this.z, ah = dx * Math.sin(this.h) + dz * Math.cos(this.h), la = -dx * Math.cos(this.h) + dz * Math.sin(this.h); if (ah > 0 && ah < 25 && Math.abs(la) < 2) lim = Math.min(lim, Math.sqrt(2 * 6 * Math.max(0, ah - 4))); }
    target = Math.min(target, lim);
    const v0 = this.v; this.v = this.v < target ? Math.min(target, this.v + 4 * dt) : Math.max(target, this.v - 9 * dt);
    this.aL = (this.v - v0) / dt;
    this.s = Math.min(path.len - 0.5, this.s + this.v * dt);
    path.at(this.s, this.pose); this.x = this.pose.x; this.z = this.pose.z; this.h = this.pose.h; this.y = this.pose.y; this.slope = this.pose.slope;
  }
  flash(t, q) {
    const ph = (t * 2.2 + this.idx * 0.37) % 2, strobe = (t * 14) % 1 < 0.5 ? 1 : 0.15, red = ph < 1 ? strobe : 0.05, blue = ph >= 1 ? strobe : 0.05;
    if (this.kind === 'pss') { this.vis.redMat.emissiveIntensity = red * 6; this.vis.blueMat.emissiveIntensity = blue * 6; return; }
    this.vis.redMat.emissiveIntensity = red * 6; this.vis.blueMat.emissiveIntensity = blue * 6;
    if (this.lights.length) { this.lights[0].intensity = q.lights ? red * 70 : 0; this.lights[1].intensity = q.lights ? blue * 70 : 0; }
  }
  dispose() { this.vis.dispose(); }
}

/* =====================================================================
   Traffic — ИИ по полосам (сетка) или вдоль серпантина; InstancedMesh
   ===================================================================== */
const TRAFFIC_COLORS = [0xf3f4f6, 0xf3f4f6, 0xf3f4f6, 0xf3f4f6, 0xc9ccd1, 0xc9ccd1, 0x111214, 0x5d6168, 0x1f2f55, 0x6a1420, 0xd8ccb0, 0x2b4a3a];
function trafficParts(kind) {
  const P = { body: [], glass: [], trim: [], lights: [], tail: [], ao: [] };
  if (kind === 'bus' || kind === 'truck') {
    const bus = kind === 'bus', L = bus ? 11 : 7.6, W = 2.5, H = bus ? 3.1 : 3.3;
    if (bus) { P.body.push(rbox(W, H - 0.6, L, 0.18, 0, 0.6 + (H - 0.6) / 2, 0)); P.glass.push(box(W + 0.02, 0.95, L - 2.2, 0, 2.15, -0.5)); P.glass.push(box(W - 0.24, 1.35, 0.05, 0, 1.95, L / 2 + 0.01)); P.trim.push(colored(box(W + 0.02, 0.3, L + 0.04, 0, 0.75, 0), 0x15171a)); }
    else { P.body.push(rbox(W, 2.0, 2.0, 0.15, 0, 1.6, L / 2 - 1.0)); P.glass.push(box(W - 0.2, 0.8, 0.05, 0, 2.05, L / 2 + 0.01)); P.trim.push(colored(rbox(W + 0.05, 2.6, L - 2.3, 0.08, 0, 2.05, -1.1), 0xe9eaec)); P.trim.push(colored(box(W, 0.3, L, 0, 0.7, 0), 0x15171a)); }
    const axles = bus ? [3.5, -3.2] : [L / 2 - 1.2, -L / 2 + 1.5];
    for (const z of axles) for (const sd of [1, -1]) { P.trim.push(colored(cyl(0.5, 0.5, 0.3, 14, sd * (W / 2 - 0.2), 0.5, z, 'x'), 0x111214)); P.trim.push(colored(cyl(0.3, 0.3, 0.32, 10, sd * (W / 2 - 0.2), 0.5, z, 'x'), 0x9a9ea5)); }
    for (const sd of [1, -1]) { P.lights.push(colored(box(0.4, 0.16, 0.06, sd * 0.85, 0.95, L / 2 + 0.02), [3, 3, 3])); P.tail.push(box(0.3, 0.3, 0.06, sd * 1.0, 1.1, -L / 2 - 0.02)); }
    P.ao.push(shadowGeo(L, W)); return { P, L: L / 2, W: W / 2, bus };
  }
  const s = CARS[kind], M = carModel(s, { lod: true, kindKey: kind }), G = M.G;
  P.body.push(...G.paint, ...G.paint2); P.glass.push(...G.glass);
  for (const [k, c] of [['black', 0x08090a], ['dark', 0x16181b], ['chrome', 0xb8bcc2], ['well', 0x050506], ['stripe', 0x1d4fc4]]) for (const geo of G[k]) P.trim.push(colored(geo, c));
  for (const geo of G.head) P.lights.push(colored(geo, [1.6, 1.7, 1.8])); for (const geo of G.drl) P.lights.push(colored(geo, [3, 3, 3])); for (const geo of G.amber) P.lights.push(colored(geo, [2, 0.9, 0.1]));
  P.tail.push(...G.tail, ...G.rev);
  const tx = s.W / 2 - s.tire / 2 - 0.035;
  for (const [x, z] of [[tx, M.fz], [-tx, M.fz], [tx, M.rz], [-tx, M.rz]]) { const wp = wheelParts(s, Math.sign(x), 'steel'); P.trim.push(colored(wp.tire.clone().translate(x, s.wr, z), 0x141517)); P.trim.push(colored(wp.rim.clone().translate(x, s.wr, z), 0x9a9ea5)); }
  P.ao.push(shadowGeo(s.L, s.W)); return { P, L: s.L / 2, W: s.W / 2, bus: false, panel: M.panel };
}
class Traffic {
  constructor(game) {
    this.g = game; this.agents = []; this.types = {}; this.activeN = 0;
    const defs = [['sedan', 10], ['nexia', 8], ['hatch', 8], ['camry', 6], ['damas', 4], ['bus', 3], ['truck', 3]];
    const tailM = new THREE.MeshBasicMaterial({ color: 0xffffff }), lightM = new THREE.MeshBasicMaterial({ vertexColors: true });
    const bodyM = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0.45, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.08 });
    const trimM = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.4, roughness: 0.45 });
    const aoM = new THREE.MeshBasicMaterial({ map: shadowTex(), transparent: true, depthWrite: false, opacity: 0.8, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    for (const [name, max] of defs) {
      const { P, L, W, bus, panel } = trafficParts(name), meshes = {}, bm = panel ? bodyM.clone() : bodyM; if (panel) applyPanels(bm, panel);
      const mats = { body: bm, glass: MAT.glass, trim: trimM, lights: lightM, tail: tailM, ao: aoM };
      for (const k in P) { if (!P[k].length) continue; const im = new THREE.InstancedMesh(merge(P[k]), mats[k], max); im.frustumCulled = false; im.castShadow = k === 'body' || k === 'trim'; im.receiveShadow = k === 'body'; if (k === 'ao') im.renderOrder = 2; game.scene.add(im); meshes[k] = im; }
      const zero = new THREE.Matrix4().makeScale(0, 0, 0), c = new THREE.Color();
      for (let i = 0; i < max; i++) { for (const k in meshes) meshes[k].setMatrixAt(i, zero); meshes.body.setColorAt(i, c.set(0xffffff)); meshes.tail.setColorAt(i, c.setRGB(0.6, 0.05, 0.03)); }
      this.types[name] = meshes;
      for (let i = 0; i < max; i++) this.agents.push({ type: name, idx: i, L, W, bus: bus || name === 'truck', active: false, x: 0, z: 0, y: 0, h: 0, px: 0, pz: 0, py: 0, ph: 0, v: 0, hitT: 0, hitCd: 0, yieldT: 0, honkT: 0 });
    }
    this.order = shuffle(this.agents.slice(), rng(42));
    this.tmp = { m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(1, 1, 1), up: new THREE.Vector3(0, 1, 0), c: new THREE.Color(), e: new THREE.Euler(0, 0, 0, 'YXZ') };
  }
  setActive(n) {
    this.activeN = Math.min(n, this.order.length);
    this.order.forEach((a, k) => { const want = k < this.activeN; if (want && !a.active) { a.active = true; this.spawn(a, 60, 240); } else if (!want && a.active) { a.active = false; this.hide(a); } });
  }
  hide(a) { const z = new THREE.Matrix4().makeScale(0, 0, 0), M = this.types[a.type]; for (const k in M) { M[k].setMatrixAt(a.idx, z); M[k].instanceMatrix.needsUpdate = true; } }
  edgePos(a) { const n = a.n, f = DIRS[a.dir]; a.x = n.x + f[0] * a.s - f[1] * a.laneOff; a.z = n.z + f[1] * a.s + f[0] * a.laneOff; a.h = Math.atan2(f[0], f[1]); a.y = 0; }
  splinePos(a) { const P = this.g.path.at(a.s, this.tmpP || (this.tmpP = {})); const rx = -Math.cos(P.h), rz = Math.sin(P.h); a.x = P.x + rx * a.off; a.z = P.z + rz * a.off; a.h = a.sign > 0 ? P.h : P.h + Math.PI; a.y = P.y; a.slope = P.slope * a.sign; }
  paint(a, hex) { this.types[a.type].body.setColorAt(a.idx, this.tmp.c.set(hex)); this.types[a.type].body.instanceColor.needsUpdate = true; }
  spawn(a, minD, maxD) {
    const g = this.g, P = g.player, w = g.world;
    a.jam = 0; a.fixed = false; a.wedding = false; a.hitT = 0; a.yieldT = 0; a.mode = 'edge';
    if (w.isSpline) {
      for (let tries = 0; tries < 30; tries++) {
        const s = g.sP + (Math.random() < 0.5 ? -1 : 1) * (minD + Math.random() * (maxD - minD)); if (s < 15 || s > g.path.len - 15) continue;
        a.s = s; a.sign = Math.random() < 0.55 ? -1 : 1; a.off = a.sign > 0 ? 0 : -3.5; a.offT = a.off; this.splinePos(a);
        if (Math.hypot(a.x - P.x, a.z - P.z) < minD * 0.8) continue;
        let ok = true; for (const b of this.agents) if (b !== a && b.active && Math.abs(b.s - a.s) < 18 && b.sign === a.sign) { ok = false; break; } if (!ok) continue;
        a.mode = 'spline'; a.v = 10 + Math.random() * 4; a.cruise = a.bus ? 11 : 13 + Math.random() * 4; a.px = a.x; a.pz = a.z; a.ph = a.h; a.py = a.y;
        this.paint(a, a.bus ? pick([0x2a6fb5, 0xe9ecef]) : pick(TRAFFIC_COLORS)); return true;
      }
      this.hide(a); a.mode = 'parked'; return false;
    }
    if (!w.nodes.length) { this.hide(a); a.mode = 'parked'; return false; }
    for (let tries = 0; tries < 40; tries++) {
      const n = pick(w.nodes), d = Math.floor(Math.random() * 4); if (!w.hasRoad(n, d)) continue;
      a.n = n; a.dir = d; a.s = RH + 9 + Math.random() * (CELL - 2 * RH - 18); a.lane = a.bus ? YL() : Math.floor(Math.random() * LANES.length); a.laneOff = LANES[a.lane];
      this.edgePos(a);
      const dp = Math.hypot(a.x - P.x, a.z - P.z); if (dp < minD || dp > maxD) continue;
      if (g.escorts.some(e => Math.hypot(a.x - e.x, a.z - e.z) < 25)) continue;
      if (g.state !== 'menu' && dp < 160) { const cam = g.camera, cf = this.tmp.p.set(0, 0, -1).applyQuaternion(cam.quaternion); const vx = a.x - cam.position.x, vz = a.z - cam.position.z; if ((vx * cf.x + vz * cf.z) / Math.hypot(vx, vz) > 0.35) continue; }
      let ok = true; for (const b of this.agents) if (b !== a && b.active && Math.abs(b.x - a.x) < 12 && Math.abs(b.z - a.z) < 12) { ok = false; break; }
      if (!ok) continue;
      a.v = 8 + Math.random() * 4; a.cruise = a.bus ? 10 : 11 + Math.random() * 5; a.px = a.x; a.pz = a.z; a.ph = a.h; a.py = 0;
      this.paint(a, a.type === 'bus' ? pick([0x2a6fb5, 0xe9ecef, 0x3a8f5a]) : a.type === 'truck' ? pick([0xd8d9db, 0x2d5aa8, 0xb33a2a]) : a.type === 'camry' && Math.random() < 0.6 ? 0xf0c419 : pick(TRAFFIC_COLORS));
      return true;
    }
    return false;
  }
  mustStop(n, dir, t) { if (n.block) return dir !== n.block.dir; return this.g.world.lightState(n, dir % 2, t) !== 'G'; }
  obstacleAhead(x, z, h, range, lat, self) {
    const fx = Math.sin(h), fz = Math.cos(h), rx = -fz, rz = fx; let gap = 1e9;
    for (const b of this.agents) {
      if (!b.active || b === self || b.mode === 'parked') continue; if (self === null && b.mode === 'spline' && (b.sign < 0 || b.off > 1.6)) continue; const dx = b.x - x, dz = b.z - z; if (Math.abs(dx) > range + 6 || Math.abs(dz) > range + 6) continue;
      const ah = dx * fx + dz * fz; if (ah <= 0 || ah > range + b.L) continue; const la = dx * rx + dz * rz; if (Math.abs(la) < lat + b.W * 0.4) gap = Math.min(gap, ah - b.L - 2.4);
    }
    for (const p of this.g.peds.list) {
      if (!p.on || p.state !== 'walk') continue; const dx = p.x - x, dz = p.z - z, ah = dx * fx + dz * fz; if (ah <= 0 || ah > range) continue;
      if (Math.abs(dx * rx + dz * rz) < 2.4) gap = Math.min(gap, ah - 3.5);
    }
    return gap;
  }
  step(dt, t) {
    const g = this.g, w = g.world, P = g.player, others = [P, ...g.escorts], despawn = g.quality.fogFar * 0.62 + 40, beacon = g.playerBeacon || g.pSirenOn;
    for (const a of this.agents) {
      if (!a.active || a.mode === 'parked') { if (a.active && a.mode === 'parked' && Math.random() < 0.02) this.spawn(a, 120, 300); continue; }
      a.px = a.x; a.pz = a.z; a.ph = a.h; a.py = a.y; a.hitCd -= dt; a.honkT -= dt;
      if (a.fixed) { if (Math.hypot(a.x - P.x, a.z - P.z) > despawn) { a.fixed = false; this.spawn(a, 120, despawn - 10); } continue; }
      if (Math.hypot(a.x - P.x, a.z - P.z) > despawn) { this.spawn(a, 120, despawn - 10); continue; }
      if (a.hitT > 0) { a.hitT -= dt; a.v = 0; a.brake = true; continue; }
      const fx = Math.sin(a.h), fz = Math.cos(a.h), rx = -fz, rz = fx;
      let gap = this.obstacleAhead(a.x, a.z, a.h, 32, 1.6, a);
      for (const o of g.eventObs) { const dx = o.x - a.x, dz = o.z - a.z, ah = dx * fx + dz * fz, la = dx * rx + dz * rz; if (ah > 0 && ah < 32 && Math.abs(la) < 1.9) gap = Math.min(gap, ah - a.L - 1.5); }
      for (const o of others) {
        const dx = o.x - a.x, dz = o.z - a.z, ah = dx * fx + dz * fz, la = dx * rx + dz * rz;
        if (ah > 0 && ah < 32 && Math.abs(la) < 2.2) { gap = Math.min(gap, ah - a.L - 2.6); if (o === P && ah < 12 && a.v < 0.5 && Math.abs(P.vL) < 0.5 && a.honkT <= 0 && Math.random() < 0.004) { a.honkT = 6; g.audio.honk(clamp(1 - Math.hypot(a.x - g.camera.position.x, a.z - g.camera.position.z) / 60, 0, 1)); } }
        const sir = (o !== P && o.siren) || (o === P && beacon);
        if (sir && ah < 0 && ah > -60 && Math.abs(la) < 9 && Math.cos(o.h - a.h) > 0.6) { a.yieldT = 3.5; if (a.mode === 'edge') a.lane = YL(); if (a.mode === 'spline' && a.sign > 0) a.offT = 2.75; if (a.jam) a.jam = 0; }
      }
      a.yieldT -= dt; if (a.mode === 'spline' && a.yieldT <= 0 && a.sign > 0) a.offT = 0;
      let vmax = a.jam ? 0 : a.yieldT > 0 ? (a.mode === 'spline' ? 3 : 5.5) : a.cruise;
      if (a.wedding) vmax = Math.min(vmax, 7);
      if (a.mode === 'edge') {
        const n2 = w.node(a.n.i + DIRS[a.dir][0], a.n.j + DIRS[a.dir][1]), d = CELL - a.s - STOPD;
        if (n2 && d > -0.5 && this.mustStop(n2, a.dir, t)) { const st = n2.block ? 'R' : w.lightState(n2, a.dir % 2, t); if (!(st === 'Y' && d < a.v * a.v / 10)) vmax = Math.min(vmax, Math.sqrt(2 * 4.5 * Math.max(0, d - 0.3))); }
      }
      if (gap < 1e8) vmax = Math.min(vmax, Math.sqrt(2 * 6 * Math.max(0, gap)), Math.max(0, gap) * 1.2);
      a.v = a.v < vmax ? Math.min(vmax, a.v + 2.6 * dt) : Math.max(vmax, a.v - 9 * dt);
      a.brake = vmax < a.v + 0.3 && vmax < a.cruise - 0.5;
      if (a.wedding && a.honkT <= 0 && Math.hypot(a.x - P.x, a.z - P.z) < 45) { a.honkT = 2.5 + Math.random() * 2; g.audio.honk(0.8, true); }
      if (a.mode === 'spline') {
        a.s += a.v * dt * a.sign; a.off = damp(a.off, a.offT, 1.5, dt); if (a.s < 2 || a.s > g.path.len - 2) { this.spawn(a, 120, 300); continue; } this.splinePos(a);
      } else if (a.mode === 'edge') {
        a.s += a.v * dt; a.laneOff = damp(a.laneOff, a.yieldT > 0 ? yieldOff() : LANES[Math.min(a.lane, YL())], 1.8, dt); this.edgePos(a);
        if (CELL - a.s <= RH + 2) this.startTurn(a);
      } else {
        const T = a.turn; T.t = Math.min(1, T.t + a.v * dt / T.len); const t1 = T.t, u = 1 - t1;
        a.x = u * u * T.ax + 2 * u * t1 * T.cx + t1 * t1 * T.bx; a.z = u * u * T.az + 2 * u * t1 * T.cz + t1 * t1 * T.bz;
        const dx = 2 * u * (T.cx - T.ax) + 2 * t1 * (T.bx - T.cx), dz = 2 * u * (T.cz - T.az) + 2 * t1 * (T.bz - T.cz); if (dx * dx + dz * dz > 1e-6) a.h = Math.atan2(dx, dz);
        if (T.t >= 1) { a.n = T.n; a.dir = T.nd; a.s = RH + 2; a.lane = T.nl; a.laneOff = LANES[T.nl]; a.mode = 'edge'; this.edgePos(a); }
      }
    }
  }
  startTurn(a) {
    const w = this.g.world, n = w.node(a.n.i + DIRS[a.dir][0], a.n.j + DIRS[a.dir][1]);
    if (!n) { this.spawn(a, 120, 300); return; }
    const opts = []; if (w.hasRoad(n, a.dir)) opts.push(a.dir, a.dir, a.dir); if (w.hasRoad(n, RIGHT(a.dir)) && !a.bus) opts.push(RIGHT(a.dir));
    if (!opts.length) { if (w.hasRoad(n, RIGHT(a.dir))) opts.push(RIGHT(a.dir)); else if (w.hasRoad(n, LEFT(a.dir))) opts.push(LEFT(a.dir)); else { this.spawn(a, 120, 300); return; } }
    const nd = pick(opts), nl = nd === a.dir ? Math.min(a.lane, YL()) : nd === RIGHT(a.dir) ? YL() : 0, f = DIRS[a.dir], f2 = DIRS[nd], e = RH + 2;
    const ax = a.x, az = a.z, bx = n.x + f2[0] * e - f2[1] * LANES[nl], bz = n.z + f2[1] * e + f2[0] * LANES[nl];
    let cx, cz; if (nd === a.dir) { cx = (ax + bx) / 2; cz = (az + bz) / 2; } else { const k = (bx - ax) * f[0] + (bz - az) * f[1]; cx = ax + f[0] * k; cz = az + f[1] * k; }
    let len = 0, lx = ax, lz = az; for (let i = 1; i <= 8; i++) { const t = i / 8, u = 1 - t, x = u * u * ax + 2 * u * t * cx + t * t * bx, z = u * u * az + 2 * u * t * cz + t * t * bz; len += Math.hypot(x - lx, z - lz); lx = x; lz = z; }
    a.turn = { ax, az, bx, bz, cx, cz, len: Math.max(1, len), t: 0, n, nd, nl }; a.mode = 'turn';
  }
  render(alpha, t) {
    const T = this.tmp;
    for (const a of this.agents) {
      if (!a.active || a.mode === 'parked') continue;
      const M = this.types[a.type], x = lerp(a.px, a.x, alpha), z = lerp(a.pz, a.z, alpha), h = lerpA(a.ph, a.h, alpha), y = lerp(a.py, a.y, alpha);
      T.e.set(-(a.slope || 0) * 0.9, h, 0); T.q.setFromEuler(T.e); T.p.set(x, y, z); T.m.compose(T.p, T.q, T.s);
      for (const k in M) M[k].setMatrixAt(a.idx, T.m);
      const blink = (a.hitT > 0 || a.fixed) && (t * 3) % 1 < 0.5, night = this.g.U.night.value > 0.3;
      M.tail.setColorAt(a.idx, a.brake || blink ? T.c.setRGB(blink ? 3 : 3.2, blink ? 1.4 : 0.15, 0.08) : night ? T.c.setRGB(1.6, 0.08, 0.05) : T.c.setRGB(0.6, 0.05, 0.03));
    }
    for (const k in this.types) { const M = this.types[k]; for (const m in M) M[m].instanceMatrix.needsUpdate = true; M.tail.instanceColor.needsUpdate = true; }
  }
}

/* =====================================================================
   Пешеходы на зебрах
   ===================================================================== */
const SHIRTS = [0xd9473a, 0x2f6db5, 0xe8e2d6, 0x3d8f5f, 0xe0a33a, 0x7a4fa3, 0x222428, 0xc2c7cf], PANTS = [0x1f2633, 0x3a3f4a, 0x5a4a3a, 0x24364f, 0x111111], SKIN = [0xe0b18c, 0xc8936a, 0xa87553, 0xf0c9a5];
class Peds {
  constructor(game) {
    this.g = game; this.list = []; this.activeN = 0;
    for (let i = 0; i < 18; i++) { const p = makePerson({ shirt: pick(SHIRTS), pants: pick(PANTS), skin: pick(SKIN), hair: pick([0x1a1410, 0x3b2a1e, 0x6b5a4a, 0x111111]) }); p.g.visible = false; game.scene.add(p.g); Object.assign(p, { on: false, state: 'off', x: 0, z: 0, cd: Math.random() * 3 }); this.list.push(p); }
  }
  setActive(n) { this.activeN = Math.min(n, this.list.length); this.list.forEach((p, k) => { if (k >= this.activeN) { p.on = false; p.state = 'off'; p.g.visible = false; } }); }
  clear() { for (const p of this.list) { p.on = false; p.state = 'off'; p.g.visible = false; } }
  spawn(p) {
    const w = this.g.world, P = this.g.player; if (w.isSpline) return;
    const cands = w.nodes.filter(n => !n.block && Math.hypot(n.x - P.x, n.z - P.z) < 210 && n.j !== w.river && n.j !== w.river + 1);
    if (!cands.length) return;
    const n = pick(cands), arms = [0, 1, 2, 3].filter(a => w.hasRoad(n, a)); if (!arms.length) return;
    const a = pick(arms), sd = Math.random() < 0.5 ? 1 : -1, f = DIRS[a], r = [-f[1], f[0]], zc = RH + 2, wo = RH + SW * 0.6;
    const zx = n.x + f[0] * zc, zz = n.z + f[1] * zc, off = (Math.random() - 0.5) * 2.2;
    Object.assign(p, { n, arm: a, sx: zx + r[0] * sd * wo + f[0] * off, sz: zz + r[1] * sd * wo + f[1] * off, ex: zx - r[0] * sd * wo + f[0] * off, ez: zz - r[1] * sd * wo + f[1] * off, state: 'wait', on: true, speed: 1.35 + Math.random() * 0.4, wait: 0 });
    p.x = p.sx; p.z = p.sz; p.g.visible = true; p.g.position.set(p.x, 0.16, p.z); p.g.rotation.y = Math.atan2(p.ex - p.sx, p.ez - p.sz); walkAnim(p, 0);
  }
  step(dt, t) {
    const w = this.g.world, P = this.g.player;
    for (let k = 0; k < this.activeN; k++) {
      const p = this.list[k];
      if (!p.on) { p.cd -= dt; if (p.cd <= 0) { p.cd = 1 + Math.random() * 3; this.spawn(p); } continue; }
      if (Math.hypot(p.x - P.x, p.z - P.z) > 260) { p.on = false; p.g.visible = false; continue; }
      if (p.state === 'wait') {
        p.wait += dt; const ax = p.arm % 2;
        if (!p.n.block && w.lightState(p.n, ax, t) === 'R' && w.redLeft(p.n, ax, t) > (2 * (RH + SW * 0.6)) / p.speed * 0.85) { p.state = 'walk'; if (Math.hypot(p.x - this.g.camera.position.x, p.z - this.g.camera.position.z) < 40) this.g.audio.tick(); }
        if (p.wait > 40) { p.on = false; p.g.visible = false; }
      } else if (p.state === 'walk') {
        const dx = p.ex - p.x, dz = p.ez - p.z, d = Math.hypot(dx, dz), st = p.speed * dt;
        if (d <= st) { p.x = p.ex; p.z = p.ez; p.state = 'done'; p.doneT = 0; } else { p.x += dx / d * st; p.z += dz / d * st; p.ph += dt * p.speed * 5.2; }
      } else if (p.state === 'done') { p.doneT += dt; if (p.doneT > 4) { p.on = false; p.g.visible = false; } }
      p.g.position.set(p.x, 0.16, p.z); walkAnim(p, p.state === 'walk' ? 1 : 0);
    }
  }
}

/* =====================================================================
   Посты ДПС: инспектор выходит на перекрёсток и останавливает поток
   ===================================================================== */
class Posts {
  constructor(game, pass) {
    this.g = game; this.list = [];
    for (const pn of pass) {
      const p = makeInspector(), fi = DIRS[pn.dirIn], ri = [-fi[1], fi[0]], n = game.world.node(pn.i, pn.j);
      const arm = pn.turn === 'right' ? LEFT(pn.dirIn) : RIGHT(pn.dirIn), fa = DIRS[arm];
      Object.assign(p, { pn, node: n, hx: n.x - fi[0] * (RH + 6) + ri[0] * (RH + SW * 0.55), hz: n.z - fi[1] * (RH + 6) + ri[1] * (RH + SW * 0.55), tx: n.x + fa[0] * (RH + 4.5), tz: n.z + fa[1] * (RH + 4.5), face: Math.atan2(fa[0], fa[1]), homeFace: Math.atan2(-ri[0], -ri[1]) });
      p.x = p.hx; p.z = p.hz; p.g.position.set(p.x, 0.16, p.z); p.g.rotation.y = p.homeFace; game.scene.add(p.g); pn.post = p; this.list.push(p);
    }
  }
  reset() { for (const p of this.list) { p.x = p.hx; p.z = p.hz; p.g.rotation.y = p.homeFace; } }
  dispose() { for (const p of this.list) disposeGroup(p.g); this.list = []; }
  step(dt, t, cam) {
    for (const p of this.list) {
      const on = !!p.pn.active, tx = on ? p.tx : p.hx, tz = on ? p.tz : p.hz, dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
      p.g.visible = Math.hypot(p.x - cam.x, p.z - cam.z) < 200;
      if (d > 0.05) { const st = Math.min(d, 3.4 * dt); p.x += dx / d * st; p.z += dz / d * st; p.ph += dt * 13; p.g.rotation.y = lerpA(p.g.rotation.y, Math.atan2(dx, dz), 0.25); walkAnim(p, 1); p.armR.rotation.set(0, 0, 0); }
      else {
        walkAnim(p, 0);
        if (on) { p.g.rotation.y = lerpA(p.g.rotation.y, p.face, 0.15); p.armR.rotation.x = -2.5 + Math.sin(t * 5) * 0.25; p.armR.rotation.z = -0.2; p.armL.rotation.z = 1.25 + Math.sin(t * 2.5) * 0.15; }
        else { p.g.rotation.y = lerpA(p.g.rotation.y, p.homeFace, 0.1); p.armR.rotation.x = -0.3; }
      }
      p.g.position.set(p.x, 0.16, p.z);
    }
  }
}

/* =====================================================================
   Частицы (дым, искры, огонь, брызги) и следы шин
   ===================================================================== */
class Particles {
  constructor(scene, max, additive) {
    this.max = max; this.i = 0;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3); this.size = new Float32Array(max); this.alpha = new Float32Array(max);
    this.vel = new Float32Array(max * 3); this.life = new Float32Array(max); this.maxLife = new Float32Array(max); this.grow = new Float32Array(max); this.a0 = new Float32Array(max);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1)); g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    this.uni = { uScale: { value: 400 } };
    this.mat = new THREE.ShaderMaterial({
      uniforms: this.uni, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: `attribute float aSize; attribute float aAlpha; attribute vec3 aColor; uniform float uScale; varying float vA; varying vec3 vC;
void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = aSize * uScale / max(0.1, -mv.z); vA = aAlpha; vC = aColor; }`,
      fragmentShader: `varying float vA; varying vec3 vC; void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); float a = smoothstep(0.5, 0.0, d) * vA; if (a < 0.003) discard; gl_FragColor = vec4(vC, a); }`
    });
    this.pts = new THREE.Points(g, this.mat); this.pts.frustumCulled = false; scene.add(this.pts);
  }
  emit(x, y, z, vx, vy, vz, life, size, grow, alpha, r, gg, b) {
    const i = this.i; this.i = (this.i + 1) % this.max;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z; this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz; this.col[i * 3] = r; this.col[i * 3 + 1] = gg; this.col[i * 3 + 2] = b;
    this.life[i] = life; this.maxLife[i] = life; this.size[i] = size; this.grow[i] = grow; this.a0[i] = alpha; this.alpha[i] = alpha;
  }
  clear() { this.life.fill(0); this.alpha.fill(0); }
  update(dt, gravity, floor = 0.05) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt; const k = i * 3;
      this.vel[k + 1] -= gravity * dt; this.pos[k] += this.vel[k] * dt; this.pos[k + 1] += this.vel[k + 1] * dt; this.pos[k + 2] += this.vel[k + 2] * dt;
      this.size[i] += this.grow[i] * dt; this.alpha[i] = this.a0[i] * Math.max(0, this.life[i] / this.maxLife[i]);
    }
    const g = this.pts.geometry; g.attributes.position.needsUpdate = g.attributes.aSize.needsUpdate = g.attributes.aAlpha.needsUpdate = g.attributes.aColor.needsUpdate = true;
  }
}
class Skids {
  constructor(scene) {
    this.max = 700; this.i = 0;
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.24, 0.55).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x0c0c0c, transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), this.max);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 1; scene.add(this.mesh); this.clear();
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.up = new THREE.Vector3(0, 1, 0); this.p = new THREE.Vector3(); this.s = new THREE.Vector3(1, 1, 1);
  }
  add(x, z, h, y = 0.04) { this.q.setFromAxisAngle(this.up, h); this.p.set(x, y, z); this.m.compose(this.p, this.q, this.s); this.mesh.setMatrixAt(this.i, this.m); this.i = (this.i + 1) % this.max; this.mesh.instanceMatrix.needsUpdate = true; }
  clear() { const z = new THREE.Matrix4().makeScale(0, 0, 0); for (let i = 0; i < this.max; i++) this.mesh.setMatrixAt(i, z); this.mesh.instanceMatrix.needsUpdate = true; }
}

/* =====================================================================
   Папарацци на мотоцикле
   ===================================================================== */
class Paparazzi {
  constructor(game) {
    this.g = game; const parts = [];
    for (const z of [0.72, -0.68]) { parts.push(colored(cyl(0.32, 0.32, 0.12, 16, 0, 0.32, z, 'x'), 0x111111)); parts.push(colored(cyl(0.18, 0.18, 0.13, 10, 0, 0.32, z, 'x'), 0x9a9ea5)); }
    parts.push(colored(rbox(0.3, 0.35, 1.2, 0.08, 0, 0.62, 0), 0xb51f2a)); parts.push(colored(rbox(0.32, 0.12, 0.6, 0.05, 0, 0.86, -0.25), 0x111111));
    parts.push(colored(box(0.6, 0.04, 0.04, 0, 1.0, 0.55), 0x333333)); parts.push(colored(box(0.36, 0.55, 0.26, 0, 1.25, -0.1, 0, -0.35), 0x1d1f24));
    parts.push(colored(sph(0.16, 0, 1.6, 0.0), 0xe8e8ea)); parts.push(colored(box(0.14, 0.1, 0.12, 0.18, 1.35, 0.25), 0x0a0a0a)); parts.push(colored(cyl(0.04, 0.04, 0.08, 8, 0.18, 1.35, 0.33, 'z'), 0x333333));
    this.mesh = new THREE.Mesh(merge(parts), MAT.vcol); this.mesh.castShadow = true; this.mesh.visible = false; game.scene.add(this.mesh); this.mesh.rotation.order = 'YXZ';
    this.active = false; this.pose = {};
  }
  start() { const g = this.g; this.active = true; this.s = Math.max(1, g.sP - 45); this.v = Math.max(10, g.player.vL); this.t = 0; this.meter = 0; this.far = 0; this.flashT = 1; this.mesh.visible = true; g.ui.toast('За вами увязался папарацци на мотоцикле — оторвитесь!', 'bad'); }
  stop() { this.active = false; this.mesh.visible = false; }
  step(dt) {
    if (!this.active) return; const g = this.g, P = g.player; this.t += dt;
    const target = g.sP - 5, v = clamp(Math.max(0, P.vL) + (target - this.s) * 0.7, 0, 21); this.v = damp(this.v, v, 2, dt); this.s += this.v * dt;
    g.path.at(this.s, this.pose); const rx = -Math.cos(this.pose.h), rz = Math.sin(this.pose.h); this.x = this.pose.x - rx * 2.4; this.z = this.pose.z - rz * 2.4;
    this.mesh.position.set(this.x, this.pose.y, this.z); this.mesh.rotation.set(0, this.pose.h, Math.sin(this.t * 2) * 0.05);
    const d = Math.hypot(this.x - P.x, this.z - P.z);
    if (d < 18) { this.meter += dt; this.flashT -= dt; if (this.flashT <= 0) { this.flashT = 0.7 + Math.random() * 0.6; g.ui.flash(); g.audio.shutter(); } }
    if (this.meter > 6) { this.stop(); g.rep = Math.max(0, g.rep - 15); g.ui.toast('Снимки попали в сеть · репутация −15', 'bad'); return; }
    if (d > 70) this.far += dt; else this.far = Math.max(0, this.far - dt * 0.5);
    if (this.far > 4) { this.stop(); g.score += 300; g.ui.toast('Папарацци отстал · +300', 'gold'); g.unlockAch('papa'); return; }
    if (this.t > 45) this.stop();
  }
}

/* =====================================================================
   Случайные события на маршруте
   ===================================================================== */
const CALLS = [
  { who: 'Звонит начальник аппарата', text: '«Вы где? Все уже собрались, начинаем через несколько минут».', opts: [['Уже подъезжаю', { rep: 3 }], ['Начинайте без меня', { rep: -8 }], ['Сбросить вызов', { rep: -12 }]] },
  { who: 'Звонит Премьер-министр', text: '«Доклад готов? Хочу, чтобы вы выступили первым».', opts: [['Готов, буду вовремя', { rep: 5 }], ['Попрошу перенести на конец', { time: 15, rep: -4 }], ['Не сейчас, я за рулём', { rep: -10 }]] },
  { who: 'Звонит помощник', text: '«На проспекте пробка. Предупредить, что вы задержитесь на пару минут?»', opts: [['Да, предупредите', { time: 20, rep: -5 }], ['Не нужно, успею', { rep: 2 }], ['Пусть ДПС ускорится', { rep: -2, link: 0.2 }]] },
  { who: 'Звонит журналист', text: '«Можно короткий комментарий по утреннему совещанию?»', opts: [['Без комментариев', { rep: 2 }], ['Позвоните после обеда', { rep: 1 }], ['Рассказать всё', { rep: -10 }]] }
];
class Events {
  constructor(game) { this.g = game; this.group = new THREE.Group(); game.scene.add(this.group); this.list = []; this.cones = []; }
  clear() {
    for (const c of [...this.group.children]) { this.group.remove(c); c.traverse(o => { if (o.geometry && !Object.values(PG).includes(o.geometry)) o.geometry.dispose(); }); }
    this.list = []; this.cones = []; this.g.eventObs.length = 0; this.ambo = null; this.crashT = 0;
    if (this.g.callUI) this.g.callUI.close(true);
  }
  plan(level) {
    this.clear(); const g = this.g, w = g.world;
    let pool = w.isSpline ? ['call', 'rain', 'paparazzi', 'fog'] : LANES.length === 1 ? ['closed', 'call', 'rain', 'paparazzi', 'wedding'] : ['jam', 'works', 'closed', 'wedding', 'crash', 'call', 'rain', 'paparazzi'];
    if (level.weather === 'rain' || level.weather === 'snow') pool = pool.filter(p => p !== 'rain');
    if (level.weather === 'fog') pool = pool.filter(p => p !== 'fog');
    shuffle(pool); const chosen = pool.slice(0, 3);
    if (!chosen.includes('call') && Math.random() < 0.5) chosen[2] = 'call';
    const fr = [0.2, 0.42, 0.64]; this.list = chosen.map((k, i) => ({ kind: k, at: g.path.destS * fr[i], done: false }));
  }
  step(dt) {
    const g = this.g;
    for (const e of this.list) if (!e.done && g.sP >= e.at) { e.done = true; this.fire(e.kind); }
    if (this.ambo) { this.ambo.t += dt; const on = (this.ambo.t * 4) % 1 < 0.5; this.ambo.lm.emissiveIntensity = on ? 6 : 0.2; this.crashT -= dt; if (this.crashT <= 0) { this.crashT = 0.12; g.smoke.emit(this.ambo.sx + (Math.random() - 0.5), 1.0, this.ambo.sz + (Math.random() - 0.5), 0, 1.2, 0, 2.5, 0.8, 1.6, 0.35, 0.3, 0.3, 0.32); } }
  }
  ahead(dist) { const g = this.g, s = g.sP + dist; if (s > g.path.destS - 50) return null; const p = g.path.at(s, {}); p.s = s; p.rx = -Math.cos(p.h); p.rz = Math.sin(p.h); p.fx = Math.sin(p.h); p.fz = Math.cos(p.h); return p; }
  agentsFree(n) { const g = this.g; return g.traffic.agents.filter(a => a.active && !a.fixed && a.type !== 'bus' && a.type !== 'truck' && Math.hypot(a.x - g.player.x, a.z - g.player.z) > 80).slice(0, n); }
  placeAgent(a, x, z, h) { a.mode = 'edge'; const d = DIRS.findIndex(dd => Math.abs(Math.atan2(dd[0], dd[1]) - wrapA(h)) < 0.3 || Math.abs(wrapA(Math.atan2(dd[0], dd[1]) - h)) < 0.3); a.dir = d < 0 ? 0 : d; const f = DIRS[a.dir]; const ni = f[0] > 0 ? Math.floor(x / CELL) : f[0] < 0 ? Math.ceil(x / CELL) : Math.round(x / CELL), nj = f[1] > 0 ? Math.floor(z / CELL) : f[1] < 0 ? Math.ceil(z / CELL) : Math.round(z / CELL); a.n = this.g.world.node(ni, nj) || a.n; if (!a.n) return false; a.s = Math.abs((x - a.n.x) * f[0] + (z - a.n.z) * f[1]); a.laneOff = (x - a.n.x) * -f[1] + (z - a.n.z) * f[0]; a.lane = YL(); a.x = a.px = x; a.z = a.pz = z; a.h = a.ph = h; a.y = a.py = 0; a.v = 0; a.hitT = 0; return true; }
  fire(kind) {
    const g = this.g, ui = g.ui;
    if (kind === 'call') return g.callUI.open(pick(CALLS));
    if (kind === 'rain') { g.atmo.setWeather('rain'); ui.toast('Резко начался дождь — тормозной путь длиннее', 'bad'); return; }
    if (kind === 'fog') { g.atmo.setWeather('fog'); ui.toast('На перевал опустился туман', 'bad'); return; }
    if (kind === 'paparazzi') return g.papa.start();
    if (kind === 'closed') return this.closeStreet();
    const p = this.ahead(150); if (!p) return;
    const ro = LANES[YL()] - LANES[0];
    if (kind === 'jam') {
      let k = 0; for (const a of this.agentsFree(6)) { const s = 10 + k * 7, x = p.x + p.fx * s + p.rx * ro, z = p.z + p.fz * s + p.rz * ro; if (this.placeAgent(a, x, z, p.h)) { a.jam = 1; a.cruise = 9; k++; } }
      ui.toast('Впереди пробка — ДПС расчищает левую полосу', ''); return;
    }
    if (kind === 'wedding') {
      let k = 0; for (const a of this.agentsFree(4)) { const s = 5 + k * 9, x = p.x + p.fx * s + p.rx * ro, z = p.z + p.fz * s + p.rz * ro; if (this.placeAgent(a, x, z, p.h)) { a.wedding = true; a.cruise = 7; g.traffic.paint(a, 0xf7f7f5); k++; } }
      ui.toast('Впереди свадебный кортеж — не мешайте молодожёнам', 'gold'); return;
    }
    if (kind === 'works') {
      const cone = new THREE.ConeGeometry(0.22, 0.7, 10).translate(0, 0.35, 0), cm = new THREE.MeshStandardMaterial({ color: 0xff6a12, roughness: 0.5, emissive: 0x331000 });
      for (let i = 0; i < 14; i++) { const s = i * 2.6, off = ro - 1.6 + Math.min(1, i / 4) * 0 + (i < 4 ? (4 - i) * 0.0 : 0), x = p.x + p.fx * s + p.rx * (i < 3 ? ro + 1.75 - i * 0.55 : ro - 1.6), z = p.z + p.fz * s + p.rz * (i < 3 ? ro + 1.75 - i * 0.55 : ro - 1.6); const c = new THREE.Mesh(cone, cm); c.position.set(x, 0.02, z); c.castShadow = true; this.group.add(c); this.cones.push({ x, z, r: 0.3, hit: false, m: c }); g.eventObs.push({ x: p.x + p.fx * s + p.rx * ro, z: p.z + p.fz * s + p.rz * ro }); }
      for (let i = 0; i < 2; i++) { const w = makePerson({ shirt: 0xff7a1a, pants: 0x2a3140, skin: 0xc58c64, hair: 0x1a1410, vest: 0xffb000, helmet: 0xffd400 }); w.g.position.set(p.x + p.fx * (10 + i * 12) + p.rx * (ro + 0.8), 0.02, p.z + p.fz * (10 + i * 12) + p.rz * (ro + 0.8)); w.g.rotation.y = p.h + Math.PI / 2; this.group.add(w.g); }
      const roller = new THREE.Mesh(merge([colored(rbox(1.8, 1.4, 2.6, 0.15, 0, 1.3, 0), 0xffc21a), colored(cyl(0.7, 0.7, 1.8, 16, 0, 0.7, 1.6, 'x'), 0x444444), colored(cyl(0.7, 0.7, 1.8, 16, 0, 0.7, -1.4, 'x'), 0x444444), colored(box(1.2, 1.0, 1.0, 0, 2.4, -0.4), 0x222a33)]), MAT.vcol);
      roller.position.set(p.x + p.fx * 22 + p.rx * (ro + 0.3), 0, p.z + p.fz * 22 + p.rz * (ro + 0.3)); roller.rotation.y = p.h; roller.castShadow = true; this.group.add(roller); this.cones.push({ x: roller.position.x, z: roller.position.z, r: 1.4, hard: true });
      ui.toast('Ремонт дороги — правая полоса закрыта', ''); return;
    }
    if (kind === 'crash') {
      const ag = this.agentsFree(2); ag.forEach((a, i) => { const s = 6 + i * 4.5, x = p.x + p.fx * s + p.rx * (ro + 0.4), z = p.z + p.fz * s + p.rz * (ro + 0.4); if (this.placeAgent(a, x, z, p.h + (i ? 0.6 : -0.45))) a.fixed = true; });
      const lm = new THREE.MeshStandardMaterial({ color: 0x001455, emissive: 0x1a5cff, emissiveIntensity: 1 });
      const am = new THREE.Group(); const body = new THREE.Mesh(merge([colored(rbox(2.1, 2.3, 5.4, 0.15, 0, 1.45, 0), 0xf3f4f6), colored(box(2.12, 0.25, 5.42, 0, 1.2, 0), 0xd8222f), colored(box(1.9, 0.7, 0.05, 0, 1.95, 2.71), 0x0a0d12), colored(cyl(0.36, 0.36, 0.26, 12, 0.9, 0.36, 1.7, 'x'), 0x111111), colored(cyl(0.36, 0.36, 0.26, 12, -0.9, 0.36, 1.7, 'x'), 0x111111), colored(cyl(0.36, 0.36, 0.26, 12, 0.9, 0.36, -1.7, 'x'), 0x111111), colored(cyl(0.36, 0.36, 0.26, 12, -0.9, 0.36, -1.7, 'x'), 0x111111)]), MAT.vcol);
      body.castShadow = true; am.add(body); const lb = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.14, 0.3), lm); lb.position.set(0, 2.68, 1.8); am.add(lb);
      const sx = p.x + p.fx * 18 + p.rx * (ro + 0.4), sz = p.z + p.fz * 18 + p.rz * (ro + 0.4); am.position.set(sx, 0, sz); am.rotation.y = p.h; this.group.add(am);
      this.cones.push({ x: sx + p.fx * 1.6, z: sz + p.fz * 1.6, r: 1.1, hard: true }, { x: sx - p.fx * 1.6, z: sz - p.fz * 1.6, r: 1.1, hard: true });
      g.eventObs.push({ x: sx, z: sz }, { x: p.x + p.fx * 8 + p.rx * ro, z: p.z + p.fz * 8 + p.rz * ro });
      this.ambo = { lm, t: 0, sx: p.x + p.fx * 8 + p.rx * (ro + 0.4), sz: p.z + p.fz * 8 + p.rz * (ro + 0.4) };
      ui.toast('Впереди авария, работает скорая — объезжайте слева', 'bad'); return;
    }
  }
  closeStreet() {
    const g = this.g, w = g.world, units = expandRoute(g.path.nodes), passed = g.path.pass.filter(p => p.done).length + 1;
    const startIdx = passed + 2, endMax = units.length - 3;
    if (startIdx >= endMax) return;
    for (let m = startIdx; m < endMax; m++) {
      const A = units[m], B = units[m + 1], d = dirBetween(A, B), nA = w.node(A[0], A[1]); const key = w.ekey(A[0], A[1], d);
      w.closed.add(key);
      const pre = units.slice(0, m + 1), prev = units[m - 1], goal = units[units.length - 2], fin = units[units.length - 1];
      const banned = new Set(pre.slice(0, -1).map(u => u.join(',')));
      const q = [[A[0], A[1]]], from = new Map([[A.join(','), null]]); let found = false;
      while (q.length) {
        const c = q.shift(); if (c[0] === goal[0] && c[1] === goal[1]) { found = true; break; }
        const n = w.node(c[0], c[1]);
        for (let dd = 0; dd < 4; dd++) { if (!w.hasRoad(n, dd)) continue; const nx = [c[0] + DIRS[dd][0], c[1] + DIRS[dd][1]], k = nx.join(','); if (from.has(k) || banned.has(k) || (nx[0] === fin[0] && nx[1] === fin[1])) continue; if (c === q[0] && prev && nx[0] === prev[0] && nx[1] === prev[1]) continue; from.set(k, c); q.push(nx); }
      }
      if (!found) { w.closed.delete(key); continue; }
      const tail = []; let c = goal; while (c) { tail.unshift(c); c = from.get(c.join(',')); }
      const newUnits = [...pre.slice(0, -1), ...tail, fin];
      const ok = newUnits.every((u, i) => i === 0 || Math.abs(u[0] - newUnits[i - 1][0]) + Math.abs(u[1] - newUnits[i - 1][1]) === 1);
      if (!ok) { w.closed.delete(key); continue; }
      // барьер поперёк дороги
      const f = DIRS[d], bx = A[0] * CELL + f[0] * (RH + 6), bz = A[1] * CELL + f[1] * (RH + 6), bm = new THREE.MeshStandardMaterial({ color: 0xd9d9d9, roughness: 0.6 }), rm = new THREE.MeshStandardMaterial({ color: 0xc8202a, roughness: 0.6 });
      for (let o = -RH + 0.8; o <= RH - 0.8; o += 1.6) { const x = bx - f[1] * o, z = bz + f[0] * o, blk = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.9, 0.5), (Math.round(o) % 2 ? bm : rm)); blk.position.set(x, 0.45, z); blk.rotation.y = Math.atan2(f[0], f[1]); blk.castShadow = true; this.group.add(blk); this.cones.push({ x, z, r: 0.75, hard: true }); g.eventObs.push({ x, z }); }
      const sc = makeCanvas(256, 128), sg = sc.getContext('2d'); sg.fillStyle = '#c8202a'; sg.beginPath(); sg.arc(64, 64, 56, 0, 6.28); sg.fill(); sg.fillStyle = '#fff'; sg.fillRect(24, 54, 80, 20); sg.fillStyle = '#fff'; sg.fillRect(128, 20, 124, 88); sg.fillStyle = '#111'; sg.font = '800 26px Arial'; sg.textAlign = 'center'; sg.fillText('ПРОЕЗД', 190, 56); sg.fillText('ЗАКРЫТ', 190, 88);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), new THREE.MeshStandardMaterial({ map: texFrom(sc), side: THREE.DoubleSide })); sign.position.set(bx - f[0] * 0.6, 1.6, bz - f[1] * 0.6); sign.rotation.y = Math.atan2(-f[0], -f[1]); this.group.add(sign);
      for (const a of g.traffic.agents) if (a.active && a.mode !== 'spline' && a.n && ((a.n.i === A[0] && a.n.j === A[1] && a.dir === d) || (a.n.i === B[0] && a.n.j === B[1] && a.dir === (d + 2) % 4))) g.traffic.spawn(a, 120, 300);
      g.reroute(compressRoute(newUnits));
      g.ui.toast('Улица перекрыта — навигатор строит объезд', 'bad');
      return;
    }
  }
  collide(P, cx, cz, r, out) {
    let best = 0;
    for (const c of this.cones) { const dx = cx - c.x, dz = cz - c.z, rr = r + c.r, d2 = dx * dx + dz * dz; if (d2 < rr * rr && d2 > 1e-6) { if (!c.hard) { if (!c.hit) { c.hit = true; c.m.rotation.z = 1.4; c.m.position.y = 0.2; this.g.score = Math.max(0, this.g.score - 30); this.g.ui.toast('Сбит конус · −30', 'bad'); } continue; } const d = Math.sqrt(d2), p = rr - d; if (p > best) { best = p; out.nx = dx / d; out.nz = dz / d; } } }
    out.pen = best; return best > 0;
  }
}
