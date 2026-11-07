
/* =====================================================================
   Atmosphere — небо, время суток, погода, линзовые блики
   ===================================================================== */
const TOD_KEYS = [
  { k: 0.00, top: 0x040814, hor: 0x161e30, gnd: 0x0c0d10, fog: 0x121827, sun: [0.25, 0.55, 0.6], sunCol: 0x8ca6ff, sunI: 0.28, hemi: 0.16, expo: 1.25, night: 1, lamps: 1 },
  { k: 0.17, top: 0x0b1430, hor: 0x3a3350, gnd: 0x16151a, fog: 0x2a2838, sun: [0.9, 0.02, -0.3], sunCol: 0xff8a5a, sunI: 0.4, hemi: 0.2, expo: 1.15, night: 0.8, lamps: 1 },
  { k: 0.24, top: 0x2d4373, hor: 0xf29b62, gnd: 0x2a2622, fog: 0xc08d74, sun: [0.85, 0.09, -0.35], sunCol: 0xffa060, sunI: 1.7, hemi: 0.36, expo: 1.05, night: 0.35, lamps: 0.5 },
  { k: 0.33, top: 0x2c66b8, hor: 0xf1c79b, gnd: 0x3c3b3a, fog: 0xd9c3a8, sun: [0.62, 0.3, -0.52], sunCol: 0xffd2a0, sunI: 3.1, hemi: 0.55, expo: 1.02, night: 0, lamps: 0 },
  { k: 0.5, top: 0x3a7bd5, hor: 0xc4dbef, gnd: 0x46484a, fog: 0xc8d8e6, sun: [0.3, 0.85, -0.35], sunCol: 0xfff5e6, sunI: 3.4, hemi: 0.6, expo: 0.95, night: 0, lamps: 0 },
  { k: 0.68, top: 0x3d5aa0, hor: 0xffb37a, gnd: 0x3a3330, fog: 0xe0a884, sun: [-0.7, 0.22, 0.45], sunCol: 0xffb070, sunI: 2.6, hemi: 0.45, expo: 1.0, night: 0.05, lamps: 0 },
  { k: 0.76, top: 0x34407a, hor: 0xff7a3a, gnd: 0x2f2a26, fog: 0xd48c66, sun: [-0.75, 0.07, 0.45], sunCol: 0xff7a40, sunI: 1.6, hemi: 0.35, expo: 1.05, night: 0.4, lamps: 0.7 },
  { k: 0.86, top: 0x040814, hor: 0x161e30, gnd: 0x0c0d10, fog: 0x121827, sun: [0.25, 0.55, 0.6], sunCol: 0x8ca6ff, sunI: 0.28, hemi: 0.16, expo: 1.25, night: 1, lamps: 1 }
];
TOD_KEYS.forEach(k => { for (const c of ['top', 'hor', 'gnd', 'fog', 'sunCol']) k[c] = new THREE.Color(k[c]); k.sun = new THREE.Vector3(...k.sun).normalize(); });
const TOD_START = { night: [0.02, 0.02], dawn: [0.2, 0.07], morning: [0.335, 0.03], day: [0.47, 0.02], sunset: [0.69, 0.06] };
const WEATHERS = {
  clear: { rain: 0, fog: 0, snow: 0, wet: 0, cloud: 0.05, flare: 0.6 }, sunny: { rain: 0, fog: 0, snow: 0, wet: 0, cloud: 0, flare: 1 },
  rain: { rain: 1, fog: 0.35, snow: 0, wet: 1, cloud: 0.85, flare: 0 }, fog: { rain: 0, fog: 1, snow: 0, wet: 0.3, cloud: 0.6, flare: 0 },
  snow: { rain: 0, fog: 0.3, snow: 1, wet: 0.35, cloud: 0.7, flare: 0 }, wet: { rain: 0, fog: 0.1, snow: 0, wet: 1, cloud: 0.3, flare: 0 }
};
class Atmosphere {
  constructor(game) {
    this.g = game;
    this.uni = { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, gnd: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() }, disc: { value: 1 }, uStars: { value: 0 } };
    this.mat = new THREE.ShaderMaterial({
      uniforms: this.uni, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: `varying vec3 vD;
void main(){ vD = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; gl_Position.z = gl_Position.w * 0.99999; }`,
      fragmentShader: `uniform vec3 top; uniform vec3 hor; uniform vec3 gnd; uniform vec3 sunDir; uniform vec3 sunCol; uniform float disc; uniform float uStars; varying vec3 vD;
float h3(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }
void main(){
  vec3 d = normalize(vD); float h = d.y;
  vec3 c = mix(hor, top, smoothstep(0.0, 0.55, h));
  c = mix(gnd, c, smoothstep(-0.08, 0.0, h));
  float s = max(dot(d, sunDir), 0.0);
  c += sunCol * (pow(s, 900.0) * 40.0 * disc + pow(s, 14.0) * 0.45 + pow(s, 3.0) * 0.12) * smoothstep(-0.03, 0.02, h);
  if (uStars > 0.01) { vec3 q = floor(d * 260.0); float st = step(0.9975, h3(q)) * smoothstep(0.05, 0.3, h); c += vec3(st * uStars * 1.4); }
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 16), this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = -1; game.scene.add(this.mesh);
    this.w = { ...WEATHERS.clear }; this.wt = { ...WEATHERS.clear }; this.t = 0.31; this.t0 = 0.31; this.drift = 0.03; this.p = {};
    this.fogColor = new THREE.Color(); this.tmpC = new THREE.Color(); this.gray = new THREE.Color();
    // дождь
    this.rainN = 2000; const rg = new THREE.BufferGeometry(); this.rainPos = new Float32Array(this.rainN * 6); this.rainRel = new Float32Array(this.rainN * 3);
    for (let i = 0; i < this.rainN; i++) { this.rainRel[i * 3] = (Math.random() - 0.5) * 50; this.rainRel[i * 3 + 1] = Math.random() * 22; this.rainRel[i * 3 + 2] = (Math.random() - 0.5) * 50; }
    rg.setAttribute('position', new THREE.BufferAttribute(this.rainPos, 3));
    this.rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xaab6c8, transparent: true, opacity: 0.35, fog: true })); this.rain.frustumCulled = false; this.rain.visible = false; game.scene.add(this.rain);
    // снег
    this.snowN = 1600; const sg = new THREE.BufferGeometry(); this.snowPos = new Float32Array(this.snowN * 3); this.snowRel = new Float32Array(this.snowN * 4);
    for (let i = 0; i < this.snowN; i++) { this.snowRel[i * 4] = (Math.random() - 0.5) * 60; this.snowRel[i * 4 + 1] = Math.random() * 25; this.snowRel[i * 4 + 2] = (Math.random() - 0.5) * 60; this.snowRel[i * 4 + 3] = Math.random() * 6.28; }
    sg.setAttribute('position', new THREE.BufferAttribute(this.snowPos, 3));
    const sc = makeCanvas(32, 32), sgc = sc.getContext('2d'), grd = sgc.createRadialGradient(16, 16, 0, 16, 16, 16); grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(1, 'rgba(255,255,255,0)'); sgc.fillStyle = grd; sgc.fillRect(0, 0, 32, 32);
    this.snow = new THREE.Points(sg, new THREE.PointsMaterial({ size: 0.12, map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false, color: 0xffffff })); this.snow.frustumCulled = false; this.snow.visible = false; game.scene.add(this.snow);
    // линзовые блики
    const fl = (r, g2, b, a, size) => { const c = makeCanvas(size, size), x = c.getContext('2d'), gr = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2); gr.addColorStop(0, `rgba(${r},${g2},${b},${a})`); gr.addColorStop(0.5, `rgba(${r},${g2},${b},${a * 0.25})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, size, size); return new THREE.CanvasTexture(c); };
    const t0 = fl(255, 240, 220, 1, 256), t1 = fl(160, 200, 255, 0.5, 64), t2 = fl(255, 180, 120, 0.4, 64);
    this.flare = new Lensflare();
    this.flare.addElement(new LensflareElement(t0, 420, 0, new THREE.Color(1, 0.95, 0.85)));
    this.flare.addElement(new LensflareElement(t1, 60, 0.45)); this.flare.addElement(new LensflareElement(t2, 90, 0.7)); this.flare.addElement(new LensflareElement(t1, 130, 0.95)); this.flare.addElement(new LensflareElement(t2, 50, 1.1));
    this.flareHolder = new THREE.Object3D(); this.flareHolder.add(this.flare); game.scene.add(this.flareHolder);
  }
  setup(tod, weather) { const [a, d] = TOD_START[tod] || TOD_START.morning; this.t = this.t0 = a; this.drift = d; this.wt = { ...(WEATHERS[weather] || WEATHERS.clear) }; this.w = { ...this.wt }; this.weatherName = weather; this.todName = tod; this.compute(); }
  setWeather(name) { this.wt = { ...(WEATHERS[name] || WEATHERS.clear) }; this.weatherName = name; }
  compute() {
    const t = clamp(this.t, 0, 0.86); let i = 0; while (i < TOD_KEYS.length - 2 && t > TOD_KEYS[i + 1].k) i++;
    const a = TOD_KEYS[i], b = TOD_KEYS[i + 1], f = clamp((t - a.k) / (b.k - a.k), 0, 1), p = this.p;
    for (const c of ['top', 'hor', 'gnd', 'fog', 'sunCol']) { p[c] = p[c] || new THREE.Color(); p[c].copy(a[c]).lerp(b[c], f); }
    p.sun = (p.sun || new THREE.Vector3()).copy(a.sun).lerp(b.sun, f).normalize();
    for (const k of ['sunI', 'hemi', 'expo', 'night', 'lamps']) p[k] = lerp(a[k], b[k], f);
    return p;
  }
  get lightsOn() { return this.p.night > 0.3 || this.w.fog > 0.5 || this.w.rain > 0.5; }
  buildEnv(renderer) {
    this.compute(); this.apply(0, true);
    const sc = new THREE.Scene(); sc.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), this.mat));
    const night = this.p.night, bm = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x2a2f38).multiplyScalar(1 - night * 0.8) }), wm = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.2, 0.7) }), r = rng(7);
    for (let i = 0; i < 46; i++) { const a = i / 46 * Math.PI * 2, d = 40 + r() * 25, h = 6 + r() * 32; const b = new THREE.Mesh(new THREE.BoxGeometry(8 + r() * 10, h, 8), bm); b.position.set(Math.cos(a) * d, h / 2 - 4, Math.sin(a) * d); b.lookAt(0, h / 2 - 4, 0); sc.add(b); if (night > 0.5) for (let k = 0; k < 4; k++) { const w = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.8), wm); w.position.set(Math.cos(a) * (d - 4.1), r() * h - 2, Math.sin(a) * (d - 4.1)); w.lookAt(0, w.position.y, 0); sc.add(w); } }
    const pm = new THREE.PMREMGenerator(renderer); const rt = pm.fromScene(sc, 0.03); pm.dispose();
    sc.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    if (this.envRT) this.envRT.dispose(); this.envRT = rt; return rt.texture;
  }
  apply(dt, instant) {
    const g = this.g, p = this.compute(), w = this.w, k = instant ? 1 : 1 - Math.exp(-0.35 * dt);
    for (const key in this.wt) w[key] = lerp(w[key], this.wt[key], k);
    const cloud = w.cloud, lum = 0.3 + 0.5 * (1 - p.night);
    this.gray.setRGB(lum * 0.55, lum * 0.58, lum * 0.62);
    this.uni.top.value.copy(p.top).lerp(this.gray, cloud * 0.75); this.uni.hor.value.copy(p.hor).lerp(this.gray, cloud * 0.6); this.uni.gnd.value.copy(p.gnd);
    this.uni.sunDir.value.copy(p.sun); this.uni.sunCol.value.copy(p.sunCol).multiplyScalar(1 - cloud * 0.85); this.uni.disc.value = 1 - cloud; this.uni.uStars.value = p.night * (1 - cloud);
    this.fogColor.copy(p.fog).lerp(this.gray, cloud * 0.45);
    const q = g.quality || QUALITY.medium, far = lerp(q.fogFar, 120, w.fog) * (1 - 0.25 * w.rain) * (1 - 0.2 * w.snow);
    if (g.scene.fog) { g.scene.fog.color.copy(this.fogColor); g.scene.fog.far = far; g.scene.fog.near = Math.min(far * 0.15, 60); }
    g.sun.color.copy(p.sunCol); g.sun.intensity = p.sunI * (1 - cloud * 0.72);
    g.hemi.intensity = p.hemi * (1 + cloud * 0.4); g.hemi.color.copy(p.hor).lerp(new THREE.Color(1, 1, 1), 0.5); g.hemi.groundColor.copy(p.gnd);
    g.renderer.toneMappingExposure = p.expo;
    g.U.night.value = p.night;
    g.gripMul = 1 - 0.28 * w.wet - 0.16 * w.snow;
    if (g.world) g.world.setWet(w.wet, p.lamps, p.night);
  }
  update(dt, cam, game) {
    if (game.state === 'play' || game.state === 'count' || game.state === 'result') this.t = Math.min(this.t0 + this.drift, this.t + this.drift / 150 * dt);
    this.apply(dt, false);
    this.mesh.position.copy(cam.position);
    const w = this.w, q = game.quality;
    // дождь
    const rn = Math.floor(Math.min(this.rainN, q.rain) * clamp(w.rain, 0, 1));
    this.rain.visible = rn > 10;
    if (this.rain.visible) {
      const R = this.rainRel, P = this.rainPos, cx = cam.position.x, cy = cam.position.y, cz = cam.position.z, sp = 24 * dt;
      for (let i = 0; i < rn; i++) {
        R[i * 3 + 1] -= sp; if (R[i * 3 + 1] < -2) { R[i * 3 + 1] += 22; R[i * 3] = (Math.random() - 0.5) * 50; R[i * 3 + 2] = (Math.random() - 0.5) * 50; }
        const x = cx + R[i * 3], y = cy - 6 + R[i * 3 + 1], z = cz + R[i * 3 + 2], j = i * 6; P[j] = x; P[j + 1] = y; P[j + 2] = z; P[j + 3] = x + 0.12; P[j + 4] = y + 0.75; P[j + 5] = z + 0.05;
      }
      this.rain.geometry.setDrawRange(0, rn * 2); this.rain.geometry.attributes.position.needsUpdate = true; this.rain.material.opacity = 0.18 + 0.2 * w.rain;
    }
    const sn = Math.floor(this.snowN * clamp(w.snow, 0, 1) * (q === QUALITY.low ? 0.5 : 1));
    this.snow.visible = sn > 10;
    if (this.snow.visible) {
      const R = this.snowRel, P = this.snowPos, cx = cam.position.x, cy = cam.position.y, cz = cam.position.z;
      for (let i = 0; i < sn; i++) {
        R[i * 4 + 1] -= 1.6 * dt; R[i * 4 + 3] += dt; if (R[i * 4 + 1] < -2) { R[i * 4 + 1] += 25; R[i * 4] = (Math.random() - 0.5) * 60; R[i * 4 + 2] = (Math.random() - 0.5) * 60; }
        P[i * 3] = cx + R[i * 4] + Math.sin(R[i * 4 + 3]) * 0.6; P[i * 3 + 1] = cy - 6 + R[i * 4 + 1]; P[i * 3 + 2] = cz + R[i * 4 + 2] + Math.cos(R[i * 4 + 3] * 0.7) * 0.6;
      }
      this.snow.geometry.setDrawRange(0, sn); this.snow.geometry.attributes.position.needsUpdate = true;
    }
    // блики от солнца
    const flareOn = q.post > 0 && this.p.sun.y > 0.01 && this.p.night < 0.4 && w.cloud < 0.35;
    this.flareHolder.visible = flareOn; if (flareOn) this.flareHolder.position.copy(cam.position).addScaledVector(this.p.sun, 900);
  }
}

/* =====================================================================
   Маршрут: равномерно пересэмплированная ломаная со скруглёнными углами
   ===================================================================== */
function dirBetween(a, b) { const dx = Math.sign(b[0] - a[0]), dz = Math.sign(b[1] - a[1]); return DIRS.findIndex(d => d[0] === dx && d[1] === dz); }
function expandRoute(route) { const u = [route[0]]; for (let k = 0; k < route.length - 1; k++) { const d = DIRS[dirBetween(route[k], route[k + 1])], n = Math.abs(route[k + 1][0] - route[k][0]) + Math.abs(route[k + 1][1] - route[k][1]); for (let m = 1; m <= n; m++) u.push([route[k][0] + d[0] * m, route[k][1] + d[1] * m]); } return u; }
function compressRoute(units) { const r = [units[0]]; for (let i = 1; i < units.length - 1; i++) { if (dirBetween(units[i - 1], units[i]) !== dirBetween(units[i], units[i + 1])) r.push(units[i]); } r.push(units[units.length - 1]); return r; }
class Path {
  constructor(raw, Y = null) {
    const cum = [0]; for (let i = 2; i < raw.length; i += 2) cum.push(cum[cum.length - 1] + Math.hypot(raw[i] - raw[i - 2], raw[i + 1] - raw[i - 1]));
    this.len = cum[cum.length - 1]; const N = Math.floor(this.len / PSTEP) + 1; this.N = N;
    this.X = new Float32Array(N); this.Z = new Float32Array(N); this.Y = new Float32Array(N); this.H = new Float32Array(N); this.LIM = new Float32Array(N);
    let j = 0;
    for (let i = 0; i < N; i++) {
      const s = i * PSTEP; while (j < cum.length - 2 && cum[j + 1] < s) j++; const seg = cum[j + 1] - cum[j], t = seg > 0 ? clamp((s - cum[j]) / seg, 0, 1) : 0;
      this.X[i] = raw[2 * j] + (raw[2 * j + 2] - raw[2 * j]) * t; this.Z[i] = raw[2 * j + 1] + (raw[2 * j + 3] - raw[2 * j + 1]) * t; if (Y) this.Y[i] = Y[j] + (Y[j + 1] - Y[j]) * t;
    }
    for (let i = 0; i < N; i++) { const a = Math.min(i, N - 2); this.H[i] = Math.atan2(this.X[a + 1] - this.X[a], this.Z[a + 1] - this.Z[a]); }
    for (let i = 0; i < N; i++) { const a = Math.max(0, i - 4), b = Math.min(N - 1, i + 4), k = Math.abs(wrapA(this.H[b] - this.H[a])) / Math.max(PSTEP, (b - a) * PSTEP); this.LIM[i] = Math.min(30, Math.sqrt(6.5 / Math.max(k, 1e-4))); }
    this.pass = []; this.destS = this.len - 30; this.destX = this.X[N - 1]; this.destZ = this.Z[N - 1];
  }
  static grid(nodes, lane) {
    const P = k => [nodes[k][0] * CELL, nodes[k][1] * CELL], D = [];
    for (let k = 0; k < nodes.length - 1; k++) D.push(dirBetween(nodes[k], nodes[k + 1]));
    const Rv = d => [-DIRS[d][1], DIRS[d][0]], raw = [], add = (x, z) => raw.push(x, z);
    const line = (x1, z1) => { const x0 = raw[raw.length - 2], z0 = raw[raw.length - 1], L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(L)); for (let i = 1; i <= n; i++) add(x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n); };
    const p0 = P(0), r0 = Rv(D[0]); add(p0[0] + r0[0] * lane, p0[1] + r0[1] * lane);
    const Rr = RH + 4;
    for (let k = 1; k < nodes.length - 1; k++) {
      if (D[k - 1] === D[k]) continue;
      const n = P(k), fi = DIRS[D[k - 1]], fo = DIRS[D[k]], ri = Rv(D[k - 1]), ro = Rv(D[k]);
      const cx = n[0] + (ri[0] + ro[0]) * lane, cz = n[1] + (ri[1] + ro[1]) * lane;
      const ax = cx - fi[0] * Rr, az = cz - fi[1] * Rr, bx = cx + fo[0] * Rr, bz = cz + fo[1] * Rr;
      line(ax, az); for (let i = 1; i <= 22; i++) { const t = i / 22, u = 1 - t; add(u * u * ax + 2 * u * t * cx + t * t * bx, u * u * az + 2 * u * t * cz + t * t * bz); }
    }
    const nl = P(nodes.length - 1), dl = D[D.length - 1], fl = DIRS[dl], rl = Rv(dl);
    line(nl[0] + rl[0] * lane - fl[0] * (RH + 5), nl[1] + rl[1] * lane - fl[1] * (RH + 5));
    const path = new Path(raw); path.nodes = nodes; path.lane = lane;
    // перекрёстки на маршруте
    for (let k = 0; k < D.length; k++) {
      const a = nodes[k], b = nodes[k + 1], steps = Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]);
      for (let m = 1; m <= steps; m++) {
        if (k === D.length - 1 && m === steps) continue;
        const ni = a[0] + DIRS[D[k]][0] * m, nj = a[1] + DIRS[D[k]][1] * m, dOut = m === steps ? D[k + 1] : D[k];
        const turn = dOut === D[k] ? 'straight' : dOut === RIGHT(D[k]) ? 'right' : 'left';
        path.pass.push({ i: ni, j: nj, s: path.nearest(ni * CELL, nj * CELL, -1) * PSTEP, dirIn: D[k], dirOut: dOut, turn });
      }
    }
    path.pass.sort((p, q) => p.s - q.s);
    // цель — середина последнего участка (ворота здания справа)
    const units = expandRoute(nodes), A = units[units.length - 2];
    path.destX = A[0] * CELL + fl[0] * CELL * 0.5 + rl[0] * lane; path.destZ = A[1] * CELL + fl[1] * CELL * 0.5 + rl[1] * lane;
    path.destS = path.nearest(path.destX, path.destZ, -1) * PSTEP;
    path.destBlock = [Math.floor((A[0] * CELL + fl[0] * CELL * 0.5 + rl[0] * CELL * 0.5) / CELL), Math.floor((A[1] * CELL + fl[1] * CELL * 0.5 + rl[1] * CELL * 0.5) / CELL)];
    path.destRight = rl;
    return path;
  }
  at(s, out) {
    const f = clamp(s / PSTEP, 0, this.N - 1.001), i = Math.floor(f), t = f - i;
    out.x = lerp(this.X[i], this.X[i + 1], t); out.z = lerp(this.Z[i], this.Z[i + 1], t); out.h = lerpA(this.H[i], this.H[i + 1], t); out.y = lerp(this.Y[i], this.Y[i + 1], t);
    out.slope = (this.Y[Math.min(this.N - 1, i + 2)] - this.Y[Math.max(0, i - 2)]) / (4 * PSTEP); return out;
  }
  lim(s) { return this.LIM[clamp(Math.floor(s / PSTEP), 0, this.N - 1)]; }
  nearest(x, z, hint, win = 80) {
    let a = 0, b = this.N - 1; if (hint >= 0) { a = Math.max(0, hint - win); b = Math.min(this.N - 1, hint + win); }
    let best = 1e18, bi = a; for (let i = a; i <= b; i++) { const dx = this.X[i] - x, dz = this.Z[i] - z, d = dx * dx + dz * dz; if (d < best) { best = d; bi = i; } }
    this.lastD2 = best; return bi;
  }
}

/* =====================================================================
   Здания-цели: семь узнаваемых силуэтов (фасад смотрит на −z)
   ===================================================================== */
function signTexture(text, bg = '#f6f3ec', ink = '#7a6236', font = '700 40px Georgia, "Times New Roman", serif') {
  const c = makeCanvas(1024, 64), g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, 1024, 64); g.fillStyle = ink; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 512, 34); return texFrom(c);
}
function buildDest(kind, Ls) {
  const grp = new THREE.Group(), k = Ls / 78, base = 0, flags = [];
  const M = {
    stone: new THREE.MeshStandardMaterial({ color: 0xe9e2d4, roughness: 0.72 }), white: new THREE.MeshStandardMaterial({ color: 0xf6f3ec, roughness: 0.55 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xd4b06a, metalness: 1, roughness: 0.28 }), dome: new THREE.MeshPhysicalMaterial({ color: 0x2a8fbd, metalness: 0.75, roughness: 0.22, clearcoat: 1 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x1b2a38, metalness: 0.85, roughness: 0.1 }), dark: new THREE.MeshStandardMaterial({ color: 0x5c5f66, roughness: 0.7 }),
    roof: new THREE.MeshStandardMaterial({ color: 0x9b3f2a, roughness: 0.75 }), cream: new THREE.MeshStandardMaterial({ color: 0xefe3c8, roughness: 0.7 }), hedge: new THREE.MeshStandardMaterial({ color: 0x2f5a2a, roughness: 0.9 })
  };
  const add = (geo, mat, x, y, z, sh = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x * k, base + y, z * k); m.castShadow = sh; m.receiveShadow = true; grp.add(m); return m; };
  const B = (w, h, d, mat, x, y, z, sh) => add(new THREE.BoxGeometry(w * k, h, d * k), mat, x, y, z, sh);
  const sign = (text, w, y, z, bg, ink, font) => { const s = new THREE.Mesh(new THREE.PlaneGeometry(w * k, 1.5), new THREE.MeshStandardMaterial({ map: signTexture(text, bg, ink, font), roughness: 0.6 })); s.position.set(0, base + y, z * k - 0.02); s.rotation.y = Math.PI; grp.add(s); };
  const flag = (x, z, h, tex) => {
    add(new THREE.CylinderGeometry(0.08, 0.13, h, 8), MAT.chrome, x, h / 2, z); add(new THREE.SphereGeometry(0.22, 10, 8), M.gold, x, h + 0.2, z);
    const fg = new THREE.PlaneGeometry(5, 2.5, 16, 6); fg.translate(2.5, 0, 0);
    const f = new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ map: tex || uzFlagTex(), side: THREE.DoubleSide, roughness: 0.7 })); f.position.set(x * k + 0.1, base + h - 1.4, z * k); f.rotation.y = Math.PI / 2; f.castShadow = true; grp.add(f);
    flags.push({ mesh: f, base: Float32Array.from(fg.attributes.position.array) });
  };
  const fence = (gate = 7) => {
    const bars = []; for (let x = -37; x <= 37; x += 0.7) if (Math.abs(x) > gate) bars.push(x);
    const im = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.035, 0.035, 2.2, 5).translate(0, 1.1, 0), MAT.dark, bars.length), m4 = new THREE.Matrix4();
    bars.forEach((x, i) => { m4.makeTranslation(x * k, base, -37.5 * k); im.setMatrixAt(i, m4); }); grp.add(im);
    for (const sd of [-1, 1]) { B(37 - gate, 0.12, 0.08, M.gold, sd * (gate + 37) / 2, 2.1, -37.5, false); B(1.1, 3.2, 1.1, M.white, sd * (gate + 0.5), 1.6, -37.5); }
  };
  const guards = () => { for (const sd of [-1, 1]) { const g = makePerson({ shirt: 0x1a1e26, pants: 0x14171d, skin: 0xc08a62, hair: 0x15110e, cap: 0x14171d }); g.g.position.set(sd * 8.8 * k, base, -38.6 * k); g.g.rotation.y = Math.PI; grp.add(g.g); } };
  if (kind === 'gov') {
    B(60, 15, 26, M.stone, 0, 7.5, 20); B(60.4, 1.2, 26.4, M.white, 0, 15.4, 20);
    for (const sd of [-1, 1]) B(14, 11, 30, M.stone, sd * 30, 5.5, 16);
    for (let i = 0; i < 9; i++) for (let fl = 0; fl < 3; fl++) for (const sd of [-1, 1]) B(1.6, 2.2, 0.1, M.glass, sd * (13 + i * 1.9), 2.8 + fl * 4.2, 6.95, false);
    B(42, 1.2, 12, M.white, 0, 0.6, 1); B(36, 0.6, 3, M.white, 0, 0.3, -5.5);
    const colG = new THREE.CylinderGeometry(0.55 * k, 0.65 * k, 12, 14); for (let i = 0; i < 10; i++) add(colG, M.white, -16.2 + i * 3.6, 7.2, -2.5);
    B(40, 2.2, 9, M.white, 0, 14.3, 1);
    const tri = new THREE.Shape(); tri.moveTo(-20 * k, 0); tri.lineTo(20 * k, 0); tri.lineTo(0, 4.2); tri.closePath(); const pd = new THREE.ExtrudeGeometry(tri, { depth: 8 * k, bevelEnabled: false }); pd.translate(0, 0, -4 * k); add(pd, M.white, 0, 15.4, 1);
    add(new THREE.CylinderGeometry(8 * k, 8 * k, 4.5, 28), M.white, 0, 17.6, 20); add(new THREE.SphereGeometry(8 * k, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), M.dome, 0, 19.8, 20); add(new THREE.CylinderGeometry(0.15, 0.35, 5, 8), M.gold, 0, 30 * Math.max(1, k * 0.9) - (1 - k) * 8, 20);
    sign('ДОМ  ПРАВИТЕЛЬСТВА', 26, 14.3, -3.55); flag(0, -25, 20);
  } else if (kind === 'senate') {
    B(70, 14, 24, M.white, 0, 7, 18); B(70.6, 1, 24.6, M.stone, 0, 14.4, 18);
    B(44, 12, 0.4, M.glass, 0, 7, 5.8, false); for (let i = 0; i < 12; i++) B(0.5, 13, 0.8, M.white, -20 + i * 3.6, 6.5, 5.4);
    add(new THREE.CylinderGeometry(10 * k, 10 * k, 3, 32), M.white, 0, 16, 18);
    add(new THREE.SphereGeometry(10 * k, 30, 14, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0x8fc4dd, metalness: 0.4, roughness: 0.05, transmission: 0, clearcoat: 1, transparent: true, opacity: 0.9 }), 0, 17.5, 18);
    B(30, 0.8, 8, M.stone, 0, 0.4, -2); sign('СЕНАТ', 18, 13.2, 5.6);
    for (const x of [-16, 0, 16]) flag(x, -24, 16);
  } else if (kind === 'parliament') {
    B(44, 16, 40, M.white, 0, 8, 14);
    for (const [x, z] of [[-22, -6], [22, -6], [-22, 34], [22, 34]]) { add(new THREE.CylinderGeometry(3 * k, 3 * k, 20, 16), M.white, x, 10, z); add(new THREE.SphereGeometry(3 * k, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.dome, x, 20, z); }
    add(new THREE.CylinderGeometry(15 * k, 15 * k, 5, 36), M.stone, 0, 18.5, 14);
    const cl = new THREE.CylinderGeometry(0.5 * k, 0.5 * k, 5, 10); for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; add(cl, M.white, Math.cos(a) * 15.6, 18.5, 14 + Math.sin(a) * 15.6); }
    add(new THREE.SphereGeometry(14 * k, 36, 18, 0, Math.PI * 2, 0, Math.PI / 2), M.dome, 0, 21, 14); add(new THREE.CylinderGeometry(0.2, 0.4, 6, 8), M.gold, 0, 21 + 14 * k + 2, 14);
    for (let i = 0; i < 8; i++) add(new THREE.CylinderGeometry(0.6 * k, 0.7 * k, 13, 12), M.white, -14 + i * 4, 6.5, -6.5);
    B(36, 1.6, 6, M.white, 0, 13.8, -6.5); sign('ПАРЛАМЕНТ', 20, 13.8, -9.5); flag(0, -26, 18);
  } else if (kind === 'prosecutor') {
    B(40, 3, 30, M.dark, 0, 1.5, 14); B(30, 42, 22, new THREE.MeshStandardMaterial({ color: 0x8c8f96, roughness: 0.6 }), 0, 24, 16);
    for (let i = 0; i < 14; i++) B(0.5, 40, 1.2, M.stone, -14 + i * 2.15, 24, 4.4);
    B(31, 1.4, 23, M.stone, 0, 45.6, 16); B(14, 6, 2, M.dark, 0, 6, 3.4); sign('ГЕНЕРАЛЬНАЯ ПРОКУРАТУРА', 22, 4.8, 2.3, '#2a2d33', '#e8d7a8', '700 34px Arial, sans-serif');
    add(new THREE.CylinderGeometry(1.4, 1.4, 0.3, 24).rotateX(Math.PI / 2), M.gold, 0, 9.5, 2.3); flag(-12, -24, 15); flag(12, -24, 15);
  } else if (kind === 'embassy') {
    B(30, 9, 20, M.cream, 0, 4.5, 14);
    const rf = new THREE.Shape(); rf.moveTo(-16 * k, 0); rf.lineTo(16 * k, 0); rf.lineTo(0, 4); rf.closePath(); const rg = new THREE.ExtrudeGeometry(rf, { depth: 22 * k, bevelEnabled: false }); rg.translate(0, 0, -11 * k); add(rg, M.roof, 0, 9, 14);
    for (let i = 0; i < 6; i++) for (const fl of [0, 1]) B(2, 2.4, 0.1, M.glass, -12 + i * 4.8, 2.4 + fl * 4, 3.95, false);
    B(8, 0.4, 4, M.white, 0, 3.6, 2); for (const sd of [-1, 1]) add(new THREE.CylinderGeometry(0.25 * k, 0.25 * k, 3.4, 10), M.white, sd * 3.5, 1.7, 0.5);
    for (let i = 0; i < 10; i++) B(3, 1.4, 1.4, M.hedge, -32 + i * 7, 0.7, -33);
    sign('ПОСОЛЬСТВО', 12, 7.5, 3.9, '#efe3c8', '#3a3326');
    const fc = makeCanvas(256, 128), fg = fc.getContext('2d'); fg.fillStyle = '#1d3f8a'; fg.fillRect(0, 0, 256, 128); fg.fillStyle = '#fff'; fg.fillRect(0, 54, 256, 20); fg.fillRect(118, 0, 20, 128); fg.fillStyle = '#c8a240'; fg.beginPath(); fg.arc(128, 64, 22, 0, 6.28); fg.fill();
    flag(-8, -20, 12, texFrom(fc)); flag(8, -20, 12);
  } else if (kind === 'court') {
    B(52, 16, 28, M.stone, 0, 8, 18); B(46, 1.6, 12, M.white, 0, 0.8, 0); B(40, 0.8, 4, M.white, 0, 0.4, -7);
    const cg = new THREE.CylinderGeometry(0.75 * k, 0.85 * k, 13, 14); for (let i = 0; i < 8; i++) add(cg, M.white, -15.75 + i * 4.5, 8.1, -1.5);
    B(40, 2.4, 10, M.white, 0, 15.8, 1);
    const tri = new THREE.Shape(); tri.moveTo(-20 * k, 0); tri.lineTo(20 * k, 0); tri.lineTo(0, 5); tri.closePath(); const pd = new THREE.ExtrudeGeometry(tri, { depth: 9 * k, bevelEnabled: false }); pd.translate(0, 0, -4.5 * k); add(pd, M.white, 0, 17, 1);
    const sc = new THREE.Group(); const bar = new THREE.Mesh(new THREE.BoxGeometry(3, 0.12, 0.12), M.gold); bar.position.y = 1.6; sc.add(bar);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.8, 8), M.gold); post.position.y = 0.9; sc.add(post);
    for (const sd of [-1, 1]) { const pan = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 6, 0, 6.28, Math.PI / 2, Math.PI / 2), M.gold); pan.position.set(sd * 1.4, 0.9, 0); sc.add(pan); }
    sc.position.set(0, base + 17.4, -3.6 * k); grp.add(sc); sign('ВЕРХОВНЫЙ СУД', 22, 15.8, -4.05); flag(0, -26, 18);
  } else if (kind === 'law') {
    B(22, 46, 22, M.glass, 0, 23, 16); for (let i = 0; i < 12; i++) B(22.4, 0.35, 22.4, M.white, 0, 3.8 * i + 3.5, 16, false);
    B(20, 0.5, 8, M.white, 0, 4.5, 1); for (const sd of [-1, 1]) add(new THREE.CylinderGeometry(0.2, 0.2, 4.5, 8), MAT.chrome, sd * 9, 2.25, -2.5);
    sign('АДВОКАТСКОЕ БЮРО «ПРАВО»', 18, 5.6, -3.05, '#151a22', '#e8d7a8', '700 34px Arial, sans-serif');
    for (let i = 0; i < 6; i++) B(2.4, 1.2, 1.2, M.hedge, -26 + i * 10.4, 0.6, -30);
  }
  if (kind !== 'law') fence(); guards();
  return { group: grp, flags, mats: M };
}

function makeBuildingMat(U) {
  const bmat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, metalness: 0.04 });
    bmat.onBeforeCompile = sh => {
      sh.uniforms.uNight = U.night;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
  vec4 wp4 = vec4(transformed, 1.0); vec3 wn3 = objectNormal;
  #ifdef USE_INSTANCING
    wp4 = instanceMatrix * wp4; wn3 = mat3(instanceMatrix) * wn3;
  #endif
  vWP = (modelMatrix * wp4).xyz; vWN = normalize(mat3(modelMatrix) * wn3);`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vWP; varying vec3 vWN; uniform float uNight;
float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
  float side = 1.0 - step(0.6, abs(vWN.y));
  vec2 fc = vec2(abs(vWN.x) > 0.5 ? vWP.z : vWP.x, vWP.y);
  vec2 cl = fc / vec2(3.4, 3.6);
  vec2 fr = fract(cl);
  float win = step(0.16, fr.x) * step(fr.x, 0.84) * step(0.24, fr.y) * step(fr.y, 0.82);
  float gf = step(vWP.y, 4.3);
  win = mix(win, step(0.8, vWP.y) * step(vWP.y, 3.7) * step(0.08, fract(fc.x / 6.0)), gf) * side;
  float rnd = hh(floor(cl) + vec2(floor(vWN.x * 3.0), floor(vWN.z * 3.0)) * 17.0);
  vec3 glassC = mix(vec3(0.04, 0.06, 0.09), vec3(0.16, 0.21, 0.28), rnd * 0.7);
  diffuseColor.rgb = mix(diffuseColor.rgb, glassC, win * 0.94);
  diffuseColor.rgb *= 1.0 - side * 0.12 * (1.0 - smoothstep(0.0, 6.0, vWP.y));
  float winMask = win;
  float lit = step(0.55, rnd) * win;
  float neon = gf * win * step(0.7, hh(floor(fc / 6.0) + 3.0)) * smoothstep(0.35, 0.8, uNight);`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  roughnessFactor = mix(roughnessFactor, 0.2, winMask);`)
        .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
  metalnessFactor = mix(metalnessFactor, 0.45, winMask);`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  totalEmissiveRadiance += vec3(1.0, 0.78, 0.46) * lit * uNight * (0.6 + rnd) * (1.0 - neon);
  totalEmissiveRadiance += mix(vec3(0.2, 0.9, 1.6), vec3(1.6, 0.25, 1.1), step(0.5, rnd)) * neon * uNight * 1.8;`);
    };
  return bmat;
}
/* =====================================================================
   City — сетка улиц: дороги, кварталы, здания, деревья, фонари, светофоры
   ===================================================================== */
const LIGHT_COL = { R: new THREE.Color().setRGB(4, 0.25, 0.15), Y: new THREE.Color().setRGB(4, 2.2, 0.2), G: new THREE.Color().setRGB(0.25, 4, 1.4) };
const LIGHT_OFF = [new THREE.Color().setRGB(0.09, 0.02, 0.02), new THREE.Color().setRGB(0.09, 0.07, 0.02), new THREE.Color().setRGB(0.02, 0.08, 0.04)];
class City {
  constructor(game, L, path, destKind) {
    this.game = game; this.L = L; this.root = new THREE.Group(); game.scene.add(this.root);
    this.nodes = []; this.grid = new Map(); this.closed = new Set(); this.flags = [];
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) this.nodes.push({ i, j, x: i * CELL, z: j * CELL, off: ((i * 7 + j * 13) % 10) * 3, block: null, key: '', heads: [] });
    this.parks = new Set((L.parks || []).map(p => p.join(','))); this.plazas = new Set((L.plazas || []).map(p => p.join(',')));
    this.river = L.river ?? -99; this.gov = path.destBlock; this.govKey = this.gov.join(',');
    this.wetMats = []; this.style = L.style;
    this.buildGround(); this.buildBlocks(); this.buildStreet(); this.buildSignals(); this.buildRiver(); this.buildPlazas(); this.buildDestination(destKind, path); this.buildMarker(path);
  }
  add(o) { this.root.add(o); return o; }
  node(i, j) { return (i < 0 || j < 0 || i >= NX || j >= NZ) ? null : this.nodes[j * NX + i]; }
  ekey(i, j, d) { const n2i = i + DIRS[d][0], n2j = j + DIRS[d][1]; return d < 2 ? `${i},${j},${d}` : `${n2i},${n2j},${d - 2}`; }
  hasRoad(n, d) { return !!n && !!this.node(n.i + DIRS[d][0], n.j + DIRS[d][1]) && !this.closed.has(this.ekey(n.i, n.j, d)); }
  hasRoadRaw(n, d) { return !!n && !!this.node(n.i + DIRS[d][0], n.j + DIRS[d][1]); }
  isRiver(bj) { return bj === this.river; }
  heightAt() { return 0; }
  // --- светофоры ---
  lightState(n, axis, t) {
    if (n.block) return axis === n.block.dir % 2 ? 'G' : 'R';
    const p = (t + n.off) % 30;
    if (axis === 0) return p < 12 ? 'G' : p < 14 ? 'Y' : 'R';
    return (p >= 15 && p < 27) ? 'G' : (p >= 27 && p < 29) ? 'Y' : 'R';
  }
  redLeft(n, axis, t) { const p = (t + n.off) % 30; if (axis === 0) return p >= 14 ? 30 - p : 0; return p < 15 ? 15 - p : p >= 29 ? 45 - p : 0; }
  // --- коллизии ---
  ckey(x, z) { return (Math.floor(x / 10) + 500) * 10000 + (Math.floor(z / 10) + 500); }
  addCol(x, z, r, tree = -1) { const k = this.ckey(x, z); if (!this.grid.has(k)) this.grid.set(k, []); this.grid.get(k).push({ x, z, r, tree }); }
  collide(x, z, r, out) {
    let best = 0; out.nx = 0; out.nz = 0;
    const lo = -LOT + r, hiX = (NX - 1) * CELL + LOT - r, hiZ = (NZ - 1) * CELL + LOT - r;
    if (x < lo && lo - x > best) { best = lo - x; out.nx = 1; out.nz = 0; }
    if (x > hiX && x - hiX > best) { best = x - hiX; out.nx = -1; out.nz = 0; }
    if (z < lo && lo - z > best) { best = lo - z; out.nx = 0; out.nz = 1; }
    if (z > hiZ && z - hiZ > best) { best = z - hiZ; out.nx = 0; out.nz = -1; }
    const bi = Math.floor(x / CELL), bj = Math.floor(z / CELL);
    if (bi >= 0 && bj >= 0 && bi < NX - 1 && bj < NZ - 1) {
      const e0 = this.isRiver(bj) ? RH + 0.4 : LOT, e1 = CELL - e0;
      const lx = x - bi * CELL, lz = z - bj * CELL, cx = clamp(lx, e0, e1), cz = clamp(lz, e0, e1), dx = lx - cx, dz = lz - cz, d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 1e-6) { const d = Math.sqrt(d2), p = r - d; if (p > best) { best = p; out.nx = dx / d; out.nz = dz / d; } }
        else { const e = [lx - e0, e1 - lx, lz - e0, e1 - lz]; let m = 0; for (let k = 1; k < 4; k++) if (e[k] < e[m]) m = k; const p = e[m] + r; if (p > best) { best = p; out.nx = [-1, 1, 0, 0][m]; out.nz = [0, 0, -1, 1][m]; } }
      }
    }
    const gx = Math.floor(x / 10), gz = Math.floor(z / 10);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const arr = this.grid.get((gx + a + 500) * 10000 + (gz + b + 500)); if (!arr) continue;
      for (const c of arr) {
        if (c.tree >= 0 && c.tree >= this.treeCount) continue;
        const dx = x - c.x, dz = z - c.z, rr = r + c.r, d2 = dx * dx + dz * dz;
        if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2), p = rr - d; if (p > best) { best = p; out.nx = dx / d; out.nz = dz / d; } }
      }
    }
    out.pen = best; return best > 0;
  }
  // --- земля и дороги ---
  buildGround() {
    const ac = makeCanvas(256, 256), ag = ac.getContext('2d'); ag.fillStyle = '#34373c'; ag.fillRect(0, 0, 256, 256); speckle(ag, 256, 256, 9000, 0.12);
    const gm = new THREE.MeshStandardMaterial({ map: texFrom(ac, { repeat: [400, 400] }), roughness: 0.92, envMapIntensity: 0.35 });
    const ground = this.add(new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000).rotateX(-Math.PI / 2), gm));
    ground.position.set((NX - 1) * CELL / 2, 0, (NZ - 1) * CELL / 2); ground.receiveShadow = true; this.wetMats.push(gm);
    const segL = CELL - 2 * RH, w = Math.round(2 * RH * 9.2), h = Math.min(2048, Math.round(segL * 9)), pxm = w / (2 * RH), pyl = h / segL, X = m => (m + RH) * pxm;
    const rc = makeCanvas(w, h), g = rc.getContext('2d');
    g.fillStyle = '#34373c'; g.fillRect(0, 0, w, h); speckle(g, w, h, Math.round(w * h / 16), 0.12);
    g.fillStyle = 'rgba(0,0,0,.10)'; for (const lc of LANES) for (const sd of [-1, 1]) { const m = sd * lc; g.fillRect(X(m - 1.1), 0, 0.5 * pxm, h); g.fillRect(X(m + 0.6), 0, 0.5 * pxm, h); }
    g.fillStyle = '#e8e8e2';
    g.fillRect(X(-RH + 0.25), 0, 0.15 * pxm, h); g.fillRect(X(RH - 0.4), 0, 0.15 * pxm, h);
    if (LANES.length >= 2) { g.fillRect(X(-0.25), 5.4 * pyl, 0.12 * pxm, h - 10.8 * pyl); g.fillRect(X(0.13), 5.4 * pyl, 0.12 * pxm, h - 10.8 * pyl); }
    else for (let y = 7 * pyl; y < h - 9 * pyl; y += 6 * pyl) g.fillRect(X(-0.06), y, 0.12 * pxm, 3 * pyl);
    for (let k = 1; k < LANES.length; k++) for (const sd of [-1, 1]) for (let y = 7 * pyl; y < h - 9 * pyl; y += 9 * pyl) g.fillRect(X(sd * k * 3.5 - 0.06), y, 0.12 * pxm, 3 * pyl);
    for (const end of [0, 1]) {
      const y0 = end ? h - 3.5 * pyl : 0.5 * pyl;
      for (let m = -RH + 0.5; m < RH - 0.6; m += 1.2) g.fillRect(X(m), y0, 0.6 * pxm, 3 * pyl);
      const ys = end ? h - 5.2 * pyl : 4.7 * pyl;
      if (end) g.fillRect(X(-RH + 0.3), ys, (RH - 0.4) * pxm, 0.5 * pyl); else g.fillRect(X(0.1), ys, (RH - 0.4) * pxm, 0.5 * pyl);
    }
    const roadMat = new THREE.MeshStandardMaterial({ map: texFrom(rc, { aniso: 8 }), roughness: 0.86, envMapIntensity: 0.35, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }); this.wetMats.push(roadMat);
    const edges = []; for (const n of this.nodes) for (const d of [0, 1]) if (this.hasRoadRaw(n, d)) edges.push([n, d]); this.edges = edges;
    const roads = new THREE.InstancedMesh(new THREE.PlaneGeometry(2 * RH, segL).rotateX(-Math.PI / 2), roadMat, edges.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
    edges.forEach(([n, d], k) => { q.setFromAxisAngle(up, d === 0 ? Math.PI / 2 : 0); m4.compose(new THREE.Vector3(n.x + DIRS[d][0] * CELL / 2, 0.02, n.z + DIRS[d][1] * CELL / 2), q, one); roads.setMatrixAt(k, m4); });
    roads.receiveShadow = true; this.add(roads);
    // лужи
    const pm = new THREE.MeshStandardMaterial({ color: 0x0a0c10, roughness: 0.03, metalness: 0.6, transparent: true, opacity: 0, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, depthWrite: false });
    const pc = 320, puddles = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 18).rotateX(-Math.PI / 2), pm, pc), r = rng(3);
    for (let i = 0; i < pc; i++) { const [n, d] = edges[Math.floor(r() * edges.length)], f = DIRS[d], s = RH + 4 + r() * (CELL - 2 * RH - 8), off = (r() - 0.5) * 2 * (RH - 1); q.setFromAxisAngle(up, r() * 6.28); m4.compose(new THREE.Vector3(n.x + f[0] * s - f[1] * off, 0.028, n.z + f[1] * s + f[0] * off), q, new THREE.Vector3(0.8 + r() * 2.2, 1, 0.5 + r() * 1.2)); puddles.setMatrixAt(i, m4); }
    this.puddleMat = pm; this.add(puddles);
  }
  buildBlocks() {
    const r = rng(99), Ls = CELL - 2 * LOT, Ws = CELL - 2 * RH;
    const pc = makeCanvas(128, 128), pg = pc.getContext('2d'); pg.fillStyle = this.style === 'old' ? '#a39a88' : '#8e8c86'; pg.fillRect(0, 0, 128, 128); speckle(pg, 128, 128, 1500, 0.1);
    pg.strokeStyle = 'rgba(40,40,40,.35)'; pg.lineWidth = 2; for (let i = 0; i <= 128; i += 64) { pg.beginPath(); pg.moveTo(i, 0); pg.lineTo(i, 128); pg.moveTo(0, i); pg.lineTo(128, i); pg.stroke(); }
    const walkTex = texFrom(pc, { repeat: [Ws / 2, Ws / 2] });
    const walkMat = new THREE.MeshStandardMaterial({ map: walkTex, roughness: 0.9, envMapIntensity: 0.45 }); this.wetMats.push(walkMat);
    const blocks = []; for (let bj = 0; bj < NZ - 1; bj++) for (let bi = 0; bi < NX - 1; bi++) if (!this.isRiver(bj)) blocks.push([bi, bj]);
    const walks = new THREE.InstancedMesh(new THREE.BoxGeometry(Ws, 0.16, Ws), walkMat, blocks.length);
    const lots = new THREE.InstancedMesh(new THREE.BoxGeometry(Ls, 0.45, Ls), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, envMapIntensity: 0.5 }), blocks.length);
    const m4 = new THREE.Matrix4(), c = new THREE.Color();
    blocks.forEach(([bi, bj], k) => {
      m4.makeTranslation(bi * CELL + CELL / 2, 0.08, bj * CELL + CELL / 2); walks.setMatrixAt(k, m4);
      m4.makeTranslation(bi * CELL + CELL / 2, 0.225, bj * CELL + CELL / 2); lots.setMatrixAt(k, m4);
      const id = bi + ',' + bj; c.set(this.parks.has(id) ? 0x4d7a36 : id === this.govKey || this.plazas.has(id) ? 0xd0c9bb : this.style === 'outskirts' ? 0x6f7d55 : 0x9b978d); lots.setColorAt(k, c);
    });
    walks.receiveShadow = lots.receiveShadow = true; this.add(walks); this.add(lots);
    // внешнее кольцо (с разрывом под реку)
    const EX = (NX - 1) * CELL, EZ = (NZ - 1) * CELL, B = 220;
    let strips = [[-B, -RH, -B, EZ + B], [EX + RH, EX + B, -B, EZ + B], [-RH, EX + RH, -B, -RH], [-RH, EX + RH, EZ + RH, EZ + B]];
    if (this.river >= 0) { const z0 = this.river * CELL + RH, z1 = (this.river + 1) * CELL - RH; strips = strips.flatMap(s => s[2] < z0 && s[3] > z1 ? [[s[0], s[1], s[2], z0], [s[0], s[1], z1, s[3]]] : [s]); }
    const ringLot = new THREE.MeshStandardMaterial({ color: this.style === 'outskirts' ? 0x6f7d55 : 0x8f8c84, roughness: 0.92 });
    for (const [x0, x1, z0, z1] of strips) {
      const t = walkTex.clone(); t.repeat.set((x1 - x0) / 2, (z1 - z0) / 2); t.needsUpdate = true;
      const wmat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, envMapIntensity: 0.45 }); this.wetMats.push(wmat);
      const wm = this.add(new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.16, z1 - z0), wmat)); wm.position.set((x0 + x1) / 2, 0.08, (z0 + z1) / 2); wm.receiveShadow = true;
      const ix0 = x0 === -RH ? -LOT : x0 === EX + RH ? EX + LOT : x0, ix1 = x1 === -RH ? -LOT : x1 === EX + RH ? EX + LOT : x1;
      const iz0 = z0 === -RH ? -LOT : z0 === EZ + RH ? EZ + LOT : z0, iz1 = z1 === -RH ? -LOT : z1 === EZ + RH ? EZ + LOT : z1;
      const lm = this.add(new THREE.Mesh(new THREE.BoxGeometry(ix1 - ix0, 0.45, iz1 - iz0), ringLot)); lm.position.set((ix0 + ix1) / 2, 0.225, (iz0 + iz1) / 2); lm.receiveShadow = true;
    }
    // здания и скатные крыши
    const list = [], roofs = [];
    const towerCols = [0x7d8ea3, 0x5f7187, 0x8aa0b2, 0x6b7a8a, 0x9aa7b4, 0x4f6176], oldCols = [0xd8c3a0, 0xc9ae86, 0xe0d2b8, 0xb9a284, 0xcdb79a, 0xe6dccb], minCols = [0xcfc6b5, 0xb8b2a6, 0x9ea4ad, 0xdcd3c0, 0xc4bba8];
    const cx0 = (NX - 1) * CELL / 2, cz0 = (NZ - 1) * CELL / 2, maxD = Math.max(cx0, cz0) + CELL;
    for (let bj = -2; bj <= NZ; bj++) for (let bi = -2; bi <= NX; bi++) {
      const isInner = bi >= 0 && bj >= 0 && bi < NX - 1 && bj < NZ - 1, id = bi + ',' + bj;
      if (this.isRiver(bj)) continue;
      if (isInner && (this.parks.has(id) || id === this.govKey || this.plazas.has(id))) continue;
      const dC = Math.hypot(bi * CELL + CELL / 2 - cx0, bj * CELL + CELL / 2 - cz0), tallP = clamp(1 - dC / maxD, 0, 1);
      const st = this.style;
      const n = st === 'old' ? 3 : st === 'outskirts' ? 3 : r() < 0.55 ? 2 : 3, sub = Ls / n;
      for (let a = 0; a < n; a++) for (let b2 = 0; b2 < n; b2++) {
        if (!isInner && r() < 0.15) continue;
        const bx = bi * CELL + LOT + sub * (a + 0.5), bz = bj * CELL + LOT + sub * (b2 + 0.5);
        if (st === 'outskirts') {
          if (r() < 0.35) continue;
          const w = sub * (0.35 + r() * 0.2), d = sub * (0.35 + r() * 0.2), h = 3.5 + r() * 3.5; list.push([bx, h / 2, bz, w, h, d, pick(oldCols, r)]);
          roofs.push([bx, h, bz, w * 1.08, 1.6 + r(), d * 1.08, pick([0x8f3c2a, 0x6b6f75, 0x4c6a8a], r)]); continue;
        }
        if (st === 'old') {
          const w = sub * (0.8 + r() * 0.15), d = sub * (0.8 + r() * 0.15), h = 6 + r() * 9; list.push([bx, h / 2, bz, w, h, d, pick(oldCols, r)]);
          if (r() < 0.6) roofs.push([bx, h, bz, w * 1.04, 1.4 + r() * 1.2, d * 1.04, pick([0x8f3c2a, 0x7a4a33, 0x6b6f75], r)]); continue;
        }
        const w = sub * (0.62 + r() * 0.3), d = sub * (0.62 + r() * 0.3);
        if (st === 'ministry' && isInner) {
          const h = 45 + r() * 95; list.push([bx, h / 2, bz, w, h, d, pick(minCols, r)]); const s2 = 0.62; list.push([bx, h + h * 0.06, bz, w * s2, h * 0.12, d * s2, pick(minCols, r)]); list.push([bx, h * 1.12 + 3, bz, w * 0.25, 6, d * 0.25, 0xd4b06a]); continue;
        }
        const tall = r() < tallP * 0.75, h = tall ? 34 + r() * 95 * tallP : 9 + r() * 20, col = tall ? pick(towerCols, r) : pick(oldCols, r);
        list.push([bx, h / 2, bz, w, h, d, col]);
        if (tall && h > 45 && r() < 0.7) { const s2 = 0.55 + r() * 0.2, h2 = h * (0.08 + r() * 0.1); list.push([bx, h + h2 / 2, bz, w * s2, h2, d * s2, col]); }
        else if (!tall && r() < 0.5) list.push([bx + (r() - 0.5) * w * 0.4, h + 0.9, bz + (r() - 0.5) * d * 0.4, 3 + r() * 3, 1.8, 3 + r() * 2, 0x8b8f94]);
      }
    }
    const bmat = makeBuildingMat(this.game.U);
    const bld = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), bmat, Math.max(1, list.length));
    const q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
    list.forEach((b, i) => { p.set(b[0], b[1], b[2]); s.set(b[3], b[4], b[5]); m4.compose(p, q, s); bld.setMatrixAt(i, m4); c.set(b[6]); bld.setColorAt(i, c); });
    bld.castShadow = bld.receiveShadow = true; this.add(bld);
    if (roofs.length) {
      const tri = new THREE.Shape(); tri.moveTo(-0.5, 0); tri.lineTo(0.5, 0); tri.lineTo(0, 1); tri.closePath(); const rg = new THREE.ExtrudeGeometry(tri, { depth: 1, bevelEnabled: false }); rg.translate(0, 0, -0.5);
      const rm = new THREE.InstancedMesh(rg, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }), roofs.length);
      roofs.forEach((b, i) => { p.set(b[0], b[1], b[2]); s.set(b[3], b[4], b[5]); m4.compose(p, q, s); rm.setMatrixAt(i, m4); c.set(b[6]); rm.setColorAt(i, c); });
      rm.castShadow = true; this.add(rm);
    }
  }
  buildStreet() {
    const r = rng(5), trees = [], lamps = [], tOff = RH + SW * 0.65, lOff = RH + 0.7;
    for (const [n, d] of this.edges) {
      const f = DIRS[d], rr = [-f[1], f[0]], segL = CELL - 2 * RH;
      for (const sd of [1, -1]) {
        const mx = n.x + f[0] * CELL / 2 + rr[0] * sd * (RH + 3), mz = n.z + f[1] * CELL / 2 + rr[1] * sd * (RH + 3), bj = Math.floor(mz / CELL), river = this.isRiver(bj);
        const nT = Math.max(2, Math.round(segL / 22));
        if (!river) for (let k = 0; k < nT; k++) { const s = RH + 8 + (segL - 16) * (k + 0.5) / nT + (r() - 0.5) * 3; trees.push([n.x + f[0] * s + rr[0] * sd * tOff, n.z + f[1] * s + rr[1] * sd * tOff]); }
        for (const s of [CELL * 0.3, CELL * 0.7]) lamps.push([n.x + f[0] * s + rr[0] * sd * lOff, n.z + f[1] * s + rr[1] * sd * lOff, Math.atan2(-rr[0] * sd, -rr[1] * sd)]);
      }
    }
    for (const id of this.parks) { const [bi, bj] = id.split(',').map(Number); for (let i = 0; i < 42; i++) trees.push([bi * CELL + LOT + 4 + r() * (CELL - 2 * LOT - 8), bj * CELL + LOT + 4 + r() * (CELL - 2 * LOT - 8), 1]); }
    if (this.style === 'outskirts') for (let i = 0; i < 260; i++) { const bi = Math.floor(r() * (NX + 3)) - 2, bj = Math.floor(r() * (NZ + 3)) - 2; if (this.isRiver(bj) || (bi + ',' + bj) === this.govKey) continue; trees.push([bi * CELL + LOT + 2 + r() * (CELL - 2 * LOT - 4), bj * CELL + LOT + 2 + r() * (CELL - 2 * LOT - 4), 1]); }
    shuffle(trees, r);
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.13, 0.2, 2.8, 6).translate(0, 1.4, 0), new THREE.MeshStandardMaterial({ color: 0x5a4636, roughness: 0.9 }), trees.length);
    const crown = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.7, 1).translate(0, 3.9, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, flatShading: true }), trees.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color();
    trees.forEach((t, i) => {
      const sc2 = 0.8 + r() * 0.55; q.setFromAxisAngle(up, r() * 6.28);
      p.set(t[0], t[2] ? 0.45 : 0.16, t[1]); s.set(sc2, sc2 * (0.9 + r() * 0.35), sc2); m4.compose(p, q, s); trunk.setMatrixAt(i, m4); crown.setMatrixAt(i, m4);
      c.setHSL(0.22 + r() * 0.08, 0.38 + r() * 0.2, 0.2 + r() * 0.12); crown.setColorAt(i, c);
      if (!t[2]) this.addCol(t[0], t[1], 0.32, i);
    });
    trunk.castShadow = crown.castShadow = true; crown.receiveShadow = true;
    this.add(trunk); this.add(crown); this.treeMeshes = [trunk, crown]; this.treeTotal = trees.length; this.treeCount = trees.length;
    const lampMat = new THREE.MeshStandardMaterial({ color: 0x3a3f46, metalness: 0.6, roughness: 0.45 });
    const pole = new THREE.InstancedMesh(merge([new THREE.CylinderGeometry(0.07, 0.11, 8, 7).translate(0, 4, 0), new THREE.BoxGeometry(0.08, 0.08, 2.2).translate(0, 7.9, 1.05)]), lampMat, lamps.length);
    this.lampHeadMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, emissive: 0xffd9a0, emissiveIntensity: 0.05 });
    const head = new THREE.InstancedMesh(new THREE.BoxGeometry(0.36, 0.12, 0.7).translate(0, 7.84, 2.1), this.lampHeadMat, lamps.length);
    this.glowMat = new THREE.MeshBasicMaterial({ color: 0xffc77a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    const gc = makeCanvas(64, 64), gx = gc.getContext('2d'), gg = gx.createRadialGradient(32, 32, 0, 32, 32, 32); gg.addColorStop(0, 'rgba(255,255,255,1)'); gg.addColorStop(1, 'rgba(255,255,255,0)'); gx.fillStyle = gg; gx.fillRect(0, 0, 64, 64); this.glowMat.map = new THREE.CanvasTexture(gc);
    const glow = new THREE.InstancedMesh(new THREE.PlaneGeometry(9, 9).rotateX(-Math.PI / 2), this.glowMat, lamps.length);
    lamps.forEach((l, i) => { q.setFromAxisAngle(up, l[2]); p.set(l[0], 0.16, l[1]); s.set(1, 1, 1); m4.compose(p, q, s); pole.setMatrixAt(i, m4); head.setMatrixAt(i, m4); m4.makeTranslation(l[0] + Math.sin(l[2]) * 2.1, 0.05, l[1] + Math.cos(l[2]) * 2.1); glow.setMatrixAt(i, m4); this.addCol(l[0], l[1], 0.22); });
    pole.castShadow = true; this.add(pole); this.add(head); this.add(glow);
  }
  setDetail(q) { this.treeCount = Math.floor(this.treeTotal * q.trees); for (const m of this.treeMeshes) m.count = this.treeCount; }
  setWet(w, lamps, night) {
    for (const m of this.wetMats) { if (m.userData.r0 === undefined) { m.userData.r0 = m.roughness; m.userData.e0 = m.envMapIntensity; } m.roughness = lerp(m.userData.r0, 0.22, w); m.envMapIntensity = lerp(m.userData.e0, 1.4, w); m.color.setScalar(1 - 0.35 * w); }
    this.puddleMat.opacity = w * 0.85; this.lampHeadMat.emissiveIntensity = 0.05 + lamps * 3.5; this.glowMat.opacity = lamps * 0.32;
  }
  buildSignals() {
    const heads = [], co = RH + 2.5, ao = Math.max(RH * 0.5, 1.8);
    for (const n of this.nodes) for (let d = 0; d < 4; d++) {
      if (!this.hasRoadRaw(n, (d + 2) % 4)) continue;
      const f = DIRS[d], r = [-f[1], f[0]];
      heads.push({ n, d, px: n.x - f[0] * co + r[0] * co, pz: n.z - f[1] * co + r[1] * co, ox: n.x - f[0] * co + r[0] * ao, oz: n.z - f[1] * co + r[1] * ao, f, r });
    }
    const poleM = new THREE.MeshStandardMaterial({ color: 0x2c3036, metalness: 0.5, roughness: 0.5 });
    const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.13, 5.8, 8).translate(0, 2.9, 0), poleM, heads.length);
    const arms = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), poleM, heads.length);
    const hous = new THREE.InstancedMesh(new THREE.BoxGeometry(0.4, 1.08, 0.3), new THREE.MeshStandardMaterial({ color: 0x1b1d21, roughness: 0.6 }), heads.length * 2);
    const lamps = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.12, 0.06, 12).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff }), heads.length * 6);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
    heads.forEach((h, k) => {
      q.setFromAxisAngle(up, Math.atan2(-h.f[0], -h.f[1]));
      p.set(h.px, 0.16, h.pz); s.set(1, 1, 1); m4.compose(p, q, s); poles.setMatrixAt(k, m4);
      p.set((h.px + h.ox) / 2, 5.75, (h.pz + h.oz) / 2); const al = co - ao; s.set(Math.abs(h.r[0]) * al + 0.09, 0.09, Math.abs(h.r[1]) * al + 0.09); m4.compose(p, new THREE.Quaternion(), s); arms.setMatrixAt(k, m4);
      [[h.px, 3.1, h.pz], [h.ox, 5.1, h.oz]].forEach((sp, hh) => {
        s.set(1, 1, 1); p.set(sp[0], sp[1], sp[2]); m4.compose(p, q, s); hous.setMatrixAt(k * 2 + hh, m4);
        for (let li = 0; li < 3; li++) { p.set(sp[0] - h.f[0] * 0.16, sp[1] + 0.34 - li * 0.34, sp[2] - h.f[1] * 0.16); m4.compose(p, q, s); lamps.setMatrixAt(k * 6 + hh * 3 + li, m4); lamps.setColorAt(k * 6 + hh * 3 + li, LIGHT_OFF[li]); }
      });
      h.n.heads.push({ d: h.d, idx: k * 6 }); this.addCol(h.px, h.pz, 0.25);
    });
    poles.castShadow = hous.castShadow = true;
    this.add(poles); this.add(arms); this.add(hous); this.add(lamps); this.lampsMesh = lamps;
  }
  updateLights(t) {
    let dirty = false;
    for (const n of this.nodes) {
      const s0 = this.lightState(n, 0, t), s1 = this.lightState(n, 1, t), key = s0 + s1;
      if (key === n.key) continue; n.key = key; dirty = true;
      for (const h of n.heads) {
        const st = h.d % 2 === 0 ? s0 : s1;
        for (let hh = 0; hh < 2; hh++) for (let li = 0; li < 3; li++) {
          const on = (li === 0 && st === 'R') || (li === 1 && st === 'Y') || (li === 2 && st === 'G');
          this.lampsMesh.setColorAt(h.idx + hh * 3 + li, on ? LIGHT_COL[st] : LIGHT_OFF[li]);
        }
      }
    }
    if (dirty) this.lampsMesh.instanceColor.needsUpdate = true;
  }
  // --- река и мосты ---
  buildRiver() {
    if (this.river < 0) return;
    const z0 = this.river * CELL + RH, z1 = (this.river + 1) * CELL - RH, EX = (NX - 1) * CELL;
    const nc = makeCanvas(128, 128), ng = nc.getContext('2d'), id = ng.createImageData(128, 128);
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) { const a = Math.sin(x * 0.2 + Math.sin(y * 0.15) * 2) * 0.5 + Math.sin(y * 0.33 + x * 0.05) * 0.5, i = (y * 128 + x) * 4; id.data[i] = 128 + a * 50; id.data[i + 1] = 128 + Math.cos(y * 0.25 + x * 0.1) * 50; id.data[i + 2] = 255; id.data[i + 3] = 255; }
    ng.putImageData(id, 0, 0); const nt = texFrom(nc, { repeat: [60, 10], linear: true });
    this.waterMat = new THREE.MeshStandardMaterial({ color: 0x1b3846, roughness: 0.08, metalness: 0.35, normalMap: nt, normalScale: new THREE.Vector2(0.6, 0.6), envMapIntensity: 1.3 });
    const water = this.add(new THREE.Mesh(new THREE.PlaneGeometry(EX + 460, z1 - z0).rotateX(-Math.PI / 2), this.waterMat)); water.position.set(EX / 2, 0.012, (z0 + z1) / 2); water.receiveShadow = true;
    const stone = new THREE.MeshStandardMaterial({ color: 0x9a948a, roughness: 0.8 });
    const posts = [], m4 = new THREE.Matrix4();
    for (let x = -220; x < EX + 220; x += 2) { if (this.nodes.some(n => Math.abs(n.x - x) < RH + 0.6)) continue; posts.push([x, z0 + 0.2], [x, z1 - 0.2]); }
    for (let i = 0; i < NX; i++) for (let z = z0; z < z1; z += 2) posts.push([i * CELL - RH - 0.2, z], [i * CELL + RH + 0.2, z]);
    const pm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.18, 1.0, 0.18).translate(0, 0.5, 0), stone, posts.length); posts.forEach((p, i) => { m4.makeTranslation(p[0], 0.02, p[1]); pm.setMatrixAt(i, m4); }); this.add(pm);
    for (const zz of [z0 + 0.2, z1 - 0.2]) { const segs = [[-220, -RH - 0.6]]; for (let i = 0; i < NX - 1; i++) segs.push([i * CELL + RH + 0.6, (i + 1) * CELL - RH - 0.6]); segs.push([EX + RH + 0.6, EX + 220]); for (const [a, b] of segs) { const rl = this.add(new THREE.Mesh(new THREE.BoxGeometry(b - a, 0.12, 0.25), stone)); rl.position.set((a + b) / 2, 1.02, zz); } }
    for (let i = 0; i < NX; i++) {
      for (const sd of [-1, 1]) { const rl = this.add(new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.12, z1 - z0), stone)); rl.position.set(i * CELL + sd * (RH + 0.2), 1.02, (z0 + z1) / 2); const gd = this.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.2, z1 - z0), stone)); gd.position.set(i * CELL + sd * (RH + 0.3), -0.5, (z0 + z1) / 2); }
      for (const z of [z0 + (z1 - z0) * 0.33, z0 + (z1 - z0) * 0.66]) { const pr = this.add(new THREE.Mesh(new THREE.BoxGeometry(2 * RH, 2, 2.5), stone)); pr.position.set(i * CELL, -1.05, z); }
    }
  }
  buildPlazas() {
    const Ls = CELL - 2 * LOT, stone = new THREE.MeshStandardMaterial({ color: 0xcfc8bb, roughness: 0.7 }), water = new THREE.MeshStandardMaterial({ color: 0x3b7ea0, roughness: 0.05, metalness: 0.4 });
    for (const id of this.plazas) {
      const [bi, bj] = id.split(',').map(Number), cx = bi * CELL + CELL / 2, cz = bj * CELL + CELL / 2;
      const basin = this.add(new THREE.Mesh(new THREE.CylinderGeometry(8, 8.4, 0.8, 32), stone)); basin.position.set(cx, 0.85, cz);
      const w = this.add(new THREE.Mesh(new THREE.CylinderGeometry(7.5, 7.5, 0.1, 32), water)); w.position.set(cx, 1.2, cz);
      const col = this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1, 4, 12), stone)); col.position.set(cx, 2.5, cz);
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2, x = cx + Math.cos(a) * Ls * 0.38, z = cz + Math.sin(a) * Ls * 0.38;
        const p = this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 9, 6), MAT.chrome)); p.position.set(x, 4.95, z);
        const fg = new THREE.PlaneGeometry(2.6, 1.3, 10, 4); fg.translate(1.3, 0, 0);
        const f = this.add(new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ map: uzFlagTex(), side: THREE.DoubleSide, roughness: 0.7 }))); f.position.set(x, 8.6, z); f.rotation.y = a;
        this.flags.push({ mesh: f, base: Float32Array.from(fg.attributes.position.array) });
      }
    }
  }
  buildDestination(kind, path) {
    const [bi, bj] = this.gov, rl = path.destRight, Ls = CELL - 2 * LOT;
    const d = buildDest(kind, Ls); d.group.position.set(bi * CELL + CELL / 2, 0.45, bj * CELL + CELL / 2); d.group.rotation.y = Math.atan2(rl[0], rl[1]);
    this.add(d.group); this.flags.push(...d.flags); this.destMats = d.mats;
  }
  buildMarker(path) {
    const c = makeCanvas(4, 128), g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,1)'); g.fillStyle = gr; g.fillRect(0, 0, 4, 128);
    this.markMat = new THREE.MeshBasicMaterial({ color: 0xffcf7a, alphaMap: new THREE.CanvasTexture(c), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    this.marker = new THREE.Group();
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 26, 32, 1, true), this.markMat); beam.position.y = 13; this.marker.add(beam);
    const ring = new THREE.Mesh(new THREE.RingGeometry(3.0, 3.5, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd58a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    ring.position.y = 0.06; this.marker.add(ring); this.marker.position.set(path.destX, path.Y[Math.floor(path.destS / PSTEP)] + 0.16, path.destZ); this.add(this.marker);
  }
  animate(t) {
    for (const f of this.flags) {
      if (f.mesh.parent && !f.mesh.visible) continue;
      const pos = f.mesh.geometry.attributes.position, b = f.base, w = b[3 * (pos.count - 1)] || 5;
      for (let i = 0; i < pos.count; i++) { const x = b[i * 3], y = b[i * 3 + 1]; pos.array[i * 3 + 2] = Math.sin(x * 1.3 - t * 4.2 + y * 0.3) * 0.22 * (x / w); }
      pos.needsUpdate = true;
    }
    this.markMat.opacity = 0.4 + Math.sin(t * 3) * 0.12;
    if (this.waterMat) this.waterMat.normalMap.offset.set(t * 0.01, t * 0.004);
  }
  dispose() {
    this.game.scene.remove(this.root); const keep = SHARED_MATS();
    this.root.traverse(o => { if (o.geometry) o.geometry.dispose(); const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const m of ms) if (!keep.has(m)) { if (m.map && m.map !== UZ_FLAG_TEX) m.map.dispose(); m.dispose(); } });
  }
}

/* =====================================================================
   Mountain — горный серпантин: дорога-лента, рельеф, ограждения, сосны
   ===================================================================== */
class Mountain {
  constructor(game, destKind) {
    this.game = game; this.root = new THREE.Group(); game.scene.add(this.root); this.isSpline = true;
    this.nodes = []; this.edges = []; this.parks = new Set(); this.plazas = new Set(); this.flags = []; this.wetMats = []; this.closed = new Set(); this.gov = [-99, -99];
    const r = rng(77), pts = [], ys = []; let x = 0, z = 0, h = 0.3, y = 0;
    const plan = [[120, 0], [80, 0.012], [60, -0.025], [70, 0.03], [50, -0.045], [60, 0.04], [90, 0], [70, -0.03], [60, 0.05], [50, -0.05], [80, 0.02], [70, -0.02], [120, 0.01], [60, 0]];
    for (const [len, curv] of plan) for (let i = 0; i < len; i += 4) { h += curv * 4; x += Math.sin(h) * 4; z += Math.cos(h) * 4; pts.push(x, z); }
    const total = pts.length / 2;
    for (let i = 0; i < total; i++) { const t = i / (total - 1); ys.push(70 * smooth(clamp(t * 1.15, 0, 1)) + Math.sin(t * 9) * 3 * (1 - t)); }
    this.center = { pts, ys };
    // путь по правой полосе
    const raw = [], Y = [];
    for (let i = 0; i < total; i++) { const a = Math.max(0, i - 1), b = Math.min(total - 1, i + 1), hx = pts[b * 2] - pts[a * 2], hz = pts[b * 2 + 1] - pts[a * 2 + 1], l = Math.hypot(hx, hz) || 1; raw.push(pts[i * 2] - hz / l * 1.75, pts[i * 2 + 1] + hx / l * 1.75); Y.push(ys[i]); }
    this.path = new Path(raw, Y); this.path.destS = this.path.len - 45; const dp = this.path.at(this.path.destS, {}); this.path.destX = dp.x; this.path.destZ = dp.z;
    this.buildRoad(); this.buildTerrain(r); this.buildDestination(destKind); this.buildMarker();
    this.treeCount = 1e9;
  }
  add(o) { this.root.add(o); return o; }
  node() { return null; } hasRoad() { return false; } hasRoadRaw() { return false; }
  lightState() { return 'G'; } redLeft() { return 0; } updateLights() { } setDetail(q) { if (this.pines) for (const m of this.pines) m.count = Math.floor(this.pineTotal * q.trees); }
  heightAt(idx) { return this.path.Y[clamp(idx, 0, this.path.N - 1)]; }
  collide(x, z, r, out) {
    const P = this.path, i = P.nearest(x, z, this.game.pIdx ?? -1, 60), h = P.H[i], rx = -Math.cos(h), rz = Math.sin(h), lat = (x - P.X[i]) * rx + (z - P.Z[i]) * rz;
    out.nx = 0; out.nz = 0; out.pen = 0;
    const hi = 3.25 - r, lo = -6.75 + r;
    if (lat > hi) { out.pen = lat - hi; out.nx = -rx; out.nz = -rz; } else if (lat < lo) { out.pen = lo - lat; out.nx = rx; out.nz = rz; }
    return out.pen > 0;
  }
  setWet(w, lamps) { for (const m of this.wetMats) { if (m.userData.r0 === undefined) m.userData.r0 = m.roughness; m.roughness = lerp(m.userData.r0, 0.25, w); m.color.setScalar(1 - 0.3 * w); } }
  buildRoad() {
    const { pts, ys } = this.center, n = pts.length / 2, pos = [], uv = [], idx = [], rail = [];
    const tc = makeCanvas(64, 256), g = tc.getContext('2d'); g.fillStyle = '#35383d'; g.fillRect(0, 0, 64, 256); speckle(g, 64, 256, 1500, 0.12);
    g.fillStyle = '#e8e8e2'; g.fillRect(2, 0, 2, 256); g.fillRect(60, 0, 2, 256); for (let yy = 0; yy < 256; yy += 64) g.fillRect(31, yy, 2, 32);
    const rm = new THREE.MeshStandardMaterial({ map: texFrom(tc, { repeat: [1, 1] }), roughness: 0.85, envMapIntensity: 0.4 }); rm.map.wrapT = THREE.RepeatWrapping; this.wetMats.push(rm);
    let dist = 0;
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1), hx = pts[b * 2] - pts[a * 2], hz = pts[b * 2 + 1] - pts[a * 2 + 1], l = Math.hypot(hx, hz) || 1, rx = -hz / l, rz = hx / l;
      if (i) dist += Math.hypot(pts[i * 2] - pts[i * 2 - 2], pts[i * 2 + 1] - pts[i * 2 - 1]);
      for (const sd of [-1, 1]) { pos.push(pts[i * 2] + rx * sd * 5.2, ys[i] + 0.05, pts[i * 2 + 1] + rz * sd * 5.2); uv.push(sd < 0 ? 0 : 1, dist / 16); }
      for (const sd of [-1, 1]) rail.push([pts[i * 2] + rx * sd * 5.7, ys[i], pts[i * 2 + 1] + rz * sd * 5.7, Math.atan2(hx, hz)]);
    }
    for (let i = 0; i < n - 1; i++) { const a = i * 2, b = a + 1, c = a + 2, d = a + 3; idx.push(a, c, b, b, c, d); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
    const road = this.add(new THREE.Mesh(geo, rm)); road.receiveShadow = true;
    const metal = new THREE.MeshStandardMaterial({ color: 0xb8bcc2, metalness: 0.8, roughness: 0.35 }), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
    const postsIdx = rail.filter((_, i) => i % 4 < 2);
    const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 0.9, 0.12).translate(0, 0.45, 0), metal, postsIdx.length);
    postsIdx.forEach((p, i) => { m4.makeTranslation(p[0], p[1], p[2]); posts.setMatrixAt(i, m4); }); this.add(posts);
    const beams = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, 0.3, 4.2).translate(0, 0.7, 0), metal, rail.length);
    rail.forEach((p, i) => { q.setFromAxisAngle(up, p[3]); m4.compose(new THREE.Vector3(p[0], p[1], p[2]), q, one); beams.setMatrixAt(i, m4); }); beams.castShadow = true; this.add(beams);
  }
  buildTerrain(r) {
    const S = 2600, seg = 200, cs = 6, gw = Math.ceil(S / cs), { pts, ys } = this.center, n = pts.length / 2;
    let cx = 0, cz = 0; for (let i = 0; i < n; i++) { cx += pts[i * 2]; cz += pts[i * 2 + 1]; } cx /= n; cz /= n; this.cx = cx; this.cz = cz;
    const x0 = cx - S / 2, z0 = cz - S / 2, dist = new Float32Array(gw * gw).fill(1e9), hgt = new Float32Array(gw * gw);
    const stamp = (x, z, y, rad) => { const gx = Math.floor((x - x0) / cs), gz = Math.floor((z - z0) / cs), k = Math.ceil(rad / cs); for (let a = -k; a <= k; a++) for (let b = -k; b <= k; b++) { const ix = gx + a, iz = gz + b; if (ix < 0 || iz < 0 || ix >= gw || iz >= gw) continue; const d = Math.hypot(x0 + ix * cs - x, z0 + iz * cs - z), j = iz * gw + ix; if (d < dist[j]) { dist[j] = d; hgt[j] = y; } } };
    for (let i = 0; i < n; i++) stamp(pts[i * 2], pts[i * 2 + 1], ys[i], 42);
    this.pad = this.path.at(this.path.len - 2, {}); for (let a = 0; a < 6; a++) stamp(this.pad.x + Math.sin(this.pad.h + Math.PI / 2) * a * 8, this.pad.z + Math.cos(this.pad.h + Math.PI / 2) * a * 8, this.pad.y, 46);
    const noise = (x, z) => Math.sin(x * 0.006) * 40 + Math.cos(z * 0.005) * 45 + Math.sin((x + z) * 0.013) * 18 + Math.sin(x * 0.03 + Math.cos(z * 0.02) * 2) * 6 + 60;
    const geo = new THREE.PlaneGeometry(S, S, seg, seg); geo.rotateX(-Math.PI / 2); geo.translate(cx, 0, cz);
    const p = geo.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), gx = clamp(Math.floor((x - x0) / cs), 0, gw - 1), gz = clamp(Math.floor((z - z0) / cs), 0, gw - 1), j = gz * gw + gx, d = dist[j];
      const roadH = d < 1e8 ? hgt[j] : 0, nh = roadH + noise(x, z) * smooth(clamp((d - 9) / 60, 0, 1)) - 0.5 * (d < 9 ? 1 : 0) - (d < 1e8 ? 0 : 0);
      const H = d > 1e8 ? noise(x, z) + 30 : nh; p.setY(i, H);
      const snowK = smooth(clamp((H - 150) / 60, 0, 1)), rockK = smooth(clamp((H - 90) / 50, 0, 1));
      c.setRGB(0.24, 0.33, 0.17).lerp(new THREE.Color(0.42, 0.4, 0.37), rockK).lerp(new THREE.Color(0.92, 0.94, 0.97), snowK); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals();
    const tm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true });
    const ter = this.add(new THREE.Mesh(geo, tm)); ter.receiveShadow = true;
    this.terrainH = (x, z) => { const gx = clamp(Math.floor((x - x0) / cs), 0, gw - 1), gz = clamp(Math.floor((z - z0) / cs), 0, gw - 1), j = gz * gw + gx, d = dist[j]; return d > 1e8 ? noise(x, z) + 30 : (d < 1e8 ? hgt[j] : 0) + noise(x, z) * smooth(clamp((d - 9) / 60, 0, 1)); };
    this.distAt = (x, z) => { const gx = clamp(Math.floor((x - x0) / cs), 0, gw - 1), gz = clamp(Math.floor((z - z0) / cs), 0, gw - 1); return dist[gz * gw + gx]; };
    // сосны и камни
    const pines = []; for (let i = 0; i < 1400; i++) { const x = cx + (r() - 0.5) * S * 0.7, z = cz + (r() - 0.5) * S * 0.7, d = this.distAt(x, z); if (d < 13 || d > 400) continue; const hh = this.terrainH(x, z); if (hh > 140) continue; pines.push([x, hh, z, 0.7 + r() * 0.8]); }
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.15, 0.25, 3, 6).translate(0, 1.5, 0), new THREE.MeshStandardMaterial({ color: 0x4a3626, roughness: 0.9 }), pines.length);
    const cone = new THREE.InstancedMesh(merge([new THREE.ConeGeometry(2.2, 5, 7).translate(0, 4.5, 0), new THREE.ConeGeometry(1.7, 4, 7).translate(0, 6.8, 0)]), new THREE.MeshStandardMaterial({ color: 0x1f4a2c, roughness: 0.9, flatShading: true }), pines.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sv = new THREE.Vector3();
    pines.forEach((pp, i) => { sv.setScalar(pp[3]); m4.compose(new THREE.Vector3(pp[0], pp[1] - 0.2, pp[2]), q, sv); trunk.setMatrixAt(i, m4); cone.setMatrixAt(i, m4); });
    trunk.castShadow = cone.castShadow = true; this.add(trunk); this.add(cone); this.pines = [trunk, cone]; this.pineTotal = pines.length;
    const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1.4, 0), new THREE.MeshStandardMaterial({ color: 0x77736c, roughness: 0.95, flatShading: true }), 220); let k = 0;
    for (let i = 0; i < 900 && k < 220; i++) { const x = cx + (r() - 0.5) * S * 0.5, z = cz + (r() - 0.5) * S * 0.5, d = this.distAt(x, z); if (d < 9 || d > 200) continue; sv.set(0.5 + r() * 2, 0.4 + r() * 1.2, 0.5 + r() * 2); q.setFromEuler(new THREE.Euler(r(), r() * 6, r())); m4.compose(new THREE.Vector3(x, this.terrainH(x, z), z), q, sv); rocks.setMatrixAt(k++, m4); }
    rocks.count = k; rocks.castShadow = true; this.add(rocks);
  }
  buildDestination(kind) {
    const pad = this.pad, rx = -Math.cos(pad.h), rz = Math.sin(pad.h), d = buildDest(kind, 78);
    const cx = pad.x + rx * 52, cz = pad.z + rz * 52;
    const plat = this.add(new THREE.Mesh(new THREE.BoxGeometry(84, 2, 84), new THREE.MeshStandardMaterial({ color: 0xbdb6a8, roughness: 0.8 }))); plat.position.set(cx, pad.y - 0.55, cz); plat.rotation.y = pad.h; plat.receiveShadow = true;
    d.group.position.set(cx, pad.y + 0.45, cz); d.group.rotation.y = Math.atan2(rx, rz); this.add(d.group); this.flags.push(...d.flags);
  }
  buildMarker() {
    const c = makeCanvas(4, 128), g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,1)'); g.fillStyle = gr; g.fillRect(0, 0, 4, 128);
    this.markMat = new THREE.MeshBasicMaterial({ color: 0xffcf7a, alphaMap: new THREE.CanvasTexture(c), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    this.marker = new THREE.Group(); const beam = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 26, 32, 1, true), this.markMat); beam.position.y = 13; this.marker.add(beam);
    const p = this.path.at(this.path.destS, {}); this.marker.position.set(p.x, p.y + 0.1, p.z); this.add(this.marker);
  }
  animate(t) { City.prototype.animate.call(this, t); }
  dispose() { City.prototype.dispose.call(this); }
}

/* =====================================================================
   Arena — закрытая площадка для свободной езды: дрифт-круги, слалом,
   конусы, трибуны, прожекторы
   ===================================================================== */
class Arena {
  constructor(game) {
    this.game = game; this.root = new THREE.Group(); game.scene.add(this.root); this.isArena = true; this.isSpline = false;
    this.nodes = []; this.edges = []; this.parks = new Set(); this.plazas = new Set(); this.flags = []; this.wetMats = []; this.closed = new Set(); this.gov = [-99, -99]; this.river = -99; this.treeCount = 1e9;
    const H = this.H = 230, raw = [], loop = [[-180, -180], [180, -180], [180, 180], [-180, 180], [-180, -178]];
    raw.push(loop[0][0], loop[0][1]); for (let k = 1; k < loop.length; k++) { const [x0, z0] = loop[k - 1], [x1, z1] = loop[k], n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 2); for (let i = 1; i <= n; i++) raw.push(x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n); }
    this.path = new Path(raw); this.path.destS = 1e9; this.path.destX = 1e6; this.path.destZ = 1e6;
    this.boxes = [];
    this.buildGround(); this.buildWalls(); this.buildStands(); this.buildTowers(); this.buildBackdrop(); this.buildCones();
    this.marker = new THREE.Group(); this.markMat = new THREE.MeshBasicMaterial();
  }
  add(o) { this.root.add(o); return o; }
  node() { return null; } hasRoad() { return false; } hasRoadRaw() { return false; } isRiver() { return false; }
  lightState() { return 'G'; } redLeft() { return 0; } updateLights() { } heightAt() { return 0; }
  setDetail(q) { if (this.trees) this.trees.forEach(m => m.count = Math.floor(this.treeTotal * q.trees)); }
  setWet(w, lamps) { for (const m of this.wetMats) { if (m.userData.r0 === undefined) { m.userData.r0 = m.roughness; m.userData.e0 = m.envMapIntensity; } m.roughness = lerp(m.userData.r0, 0.2, w); m.envMapIntensity = lerp(m.userData.e0, 1.4, w); m.color.setScalar(1 - 0.3 * w); } if (this.glowMat) this.glowMat.opacity = 0.15 + lamps * 0.4; if (this.headMat) this.headMat.emissiveIntensity = 0.4 + lamps * 4; }
  collide(x, z, r, out) {
    let best = 0; out.nx = 0; out.nz = 0; const lim = this.H - 1.2 - r;
    if (x < -lim && -lim - x > best) { best = -lim - x; out.nx = 1; out.nz = 0; }
    if (x > lim && x - lim > best) { best = x - lim; out.nx = -1; out.nz = 0; }
    if (z < -lim && -lim - z > best) { best = -lim - z; out.nx = 0; out.nz = 1; }
    if (z > lim && z - lim > best) { best = z - lim; out.nx = 0; out.nz = -1; }
    for (const b of this.boxes) {
      const cx = clamp(x, b[0], b[1]), cz = clamp(z, b[2], b[3]), dx = x - cx, dz = z - cz, d2 = dx * dx + dz * dz;
      if (d2 < r * r) { if (d2 > 1e-6) { const d = Math.sqrt(d2), p = r - d; if (p > best) { best = p; out.nx = dx / d; out.nz = dz / d; } } else { const e = [x - b[0], b[1] - x, z - b[2], b[3] - z]; let m = 0; for (let k = 1; k < 4; k++) if (e[k] < e[m]) m = k; const p = e[m] + r; if (p > best) { best = p; out.nx = [-1, 1, 0, 0][m]; out.nz = [0, 0, -1, 1][m]; } } }
    }
    out.pen = best; return best > 0;
  }
  buildGround() {
    const H = this.H, ac = makeCanvas(256, 256), ag = ac.getContext('2d'); ag.fillStyle = '#323539'; ag.fillRect(0, 0, 256, 256); speckle(ag, 256, 256, 9000, 0.12);
    const gm = new THREE.MeshStandardMaterial({ map: texFrom(ac, { repeat: [300, 300] }), roughness: 0.9, envMapIntensity: 0.4 }); this.wetMats.push(gm);
    const g = this.add(new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000).rotateX(-Math.PI / 2), gm)); g.receiveShadow = true;
    // разметка площадки
    const S = 2048, k = S / (2 * H), c = makeCanvas(S, S), x = c.getContext('2d'), P = (v) => (v + H) * k;
    x.clearRect(0, 0, S, S); x.lineCap = 'round';
    x.strokeStyle = 'rgba(240,240,235,.9)'; x.lineWidth = 0.6 * k; x.strokeRect(P(-H + 6), P(-H + 6), (2 * H - 12) * k, (2 * H - 12) * k);
    for (const cx of [-90, 90]) { x.strokeStyle = 'rgba(243,216,159,.95)'; x.lineWidth = 0.5 * k; for (const r of [14, 30]) { x.beginPath(); x.arc(P(cx), P(60), r * k, 0, Math.PI * 2); x.stroke(); } }
    x.strokeStyle = 'rgba(240,240,235,.85)'; x.lineWidth = 0.35 * k; x.setLineDash([3 * k, 3 * k]); x.beginPath(); x.moveTo(P(-150), P(-120)); x.lineTo(P(150), P(-120)); x.stroke(); x.setLineDash([]);
    for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) { x.fillStyle = (i + j) % 2 ? '#111' : '#eee'; x.fillRect(P(-150 + j * 1.5), P(-190 + i * 1.5), 1.5 * k, 1.5 * k); }
    x.save(); x.translate(P(0), P(-10)); x.fillStyle = 'rgba(243,216,159,.85)'; x.font = `900 ${16 * k}px Arial Black, Arial, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('КОРТЕЖ', 0, 0); x.font = `800 ${7 * k}px Arial, sans-serif`; x.fillText('А Р Е Н А', 0, 14 * k); x.restore();
    const mm = new THREE.MeshStandardMaterial({ map: texFrom(c), transparent: true, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, depthWrite: false });
    const marks = this.add(new THREE.Mesh(new THREE.PlaneGeometry(2 * H, 2 * H).rotateX(-Math.PI / 2), mm)); marks.position.y = 0.02; marks.receiveShadow = true;
  }
  buildWalls() {
    const H = this.H, list = []; for (let a = -H; a < H; a += 2) list.push([a + 1, -H, 0], [a + 1, H, 0], [-H, a + 1, 1], [H, a + 1, 1]);
    const wm = new THREE.InstancedMesh(rbox(2, 1.0, 0.6, 0.08, 0, 0.5, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 }), list.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), c = new THREE.Color();
    list.forEach((w, i) => { q.setFromAxisAngle(up, w[2] ? Math.PI / 2 : 0); m4.compose(new THREE.Vector3(w[0], 0, w[1]), q, one); wm.setMatrixAt(i, m4); wm.setColorAt(i, c.set(i % 4 < 2 ? 0xd8202a : 0xf0f0ee)); });
    wm.castShadow = wm.receiveShadow = true; this.add(wm);
    const tires = []; for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (let i = 0; i < 9; i++) tires.push([sx * (H - 2 - (i % 3) * 0.9), sz * (H - 2 - Math.floor(i / 3) * 0.9)]);
    const tm = new THREE.InstancedMesh(new THREE.TorusGeometry(0.38, 0.18, 8, 16).rotateX(Math.PI / 2), MAT.tire, tires.length * 3);
    tires.forEach((t, i) => { for (let h = 0; h < 3; h++) { m4.makeTranslation(t[0], 0.18 + h * 0.36, t[1]); tm.setMatrixAt(i * 3 + h, m4); } }); tm.castShadow = true; this.add(tm);
  }
  buildStands() {
    const H = this.H, seat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }), conc = new THREE.MeshStandardMaterial({ color: 0x8d8a84, roughness: 0.85 });
    for (const [x0, x1] of [[-170, -40], [40, 170]]) {
      const z0 = H - 26, len = x1 - x0, cx = (x0 + x1) / 2;
      for (let r = 0; r < 6; r++) { const st = this.add(new THREE.Mesh(new THREE.BoxGeometry(len, 0.9 + r * 0.9, 3), conc)); st.position.set(cx, (0.9 + r * 0.9) / 2, z0 + 2 + r * 3); st.castShadow = st.receiveShadow = true; }
      const n = Math.floor(len / 0.8) * 6, sm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.6, 0.5, 0.5), seat, n), m4 = new THREE.Matrix4(), c = new THREE.Color(); let i = 0;
      for (let r = 0; r < 6; r++) for (let xx = x0 + 0.5; xx < x1 - 0.3 && i < n; xx += 0.8) { m4.makeTranslation(xx, 0.9 + r * 0.9 + 0.25, z0 + 1.5 + r * 3); sm.setMatrixAt(i, m4); sm.setColorAt(i, c.set([0x1d4fc4, 0xd9b46a, 0xd8202a, 0x1d4fc4][(Math.floor(xx / 6) + r) % 4])); i++; }
      sm.count = i; this.add(sm);
      const roof = this.add(new THREE.Mesh(new THREE.BoxGeometry(len + 4, 0.3, 20), new THREE.MeshStandardMaterial({ color: 0xdfe3e8, metalness: 0.5, roughness: 0.4 }))); roof.position.set(cx, 10, z0 + 10); roof.castShadow = true;
      for (let xx = x0; xx <= x1; xx += 26) { const p = this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 10, 8), MAT.chrome)); p.position.set(xx, 5, z0 + 19); }
      this.boxes.push([x0 - 1, x1 + 1, z0, z0 + 22]);
    }
  }
  buildTowers() {
    const H = this.H; this.headMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2d6, emissiveIntensity: 1 });
    const c = makeCanvas(64, 64), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    this.glowMat = new THREE.MeshBasicMaterial({ color: 0xffe2b0, map: new THREE.CanvasTexture(c), transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const x = sx * (H - 12), z = sz * (H - 12);
      const pole = this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.7, 34, 10), new THREE.MeshStandardMaterial({ color: 0x5a5f66, metalness: 0.6, roughness: 0.4 }))); pole.position.set(x, 17, z); pole.castShadow = true;
      const head = this.add(new THREE.Mesh(new THREE.BoxGeometry(6, 3, 0.6), this.headMat)); head.position.set(x, 34, z); head.lookAt(0, 0, 0);
      const gl = this.add(new THREE.Mesh(new THREE.PlaneGeometry(120, 120).rotateX(-Math.PI / 2), this.glowMat)); gl.position.set(x * 0.55, 0.04, z * 0.55);
    }
  }
  buildBackdrop() {
    const H = this.H, r = rng(11), list = [];
    for (let i = 0; i < 160; i++) { const a = r() * Math.PI * 2, d = H + 60 + r() * 220, x = Math.cos(a) * d, z = Math.sin(a) * d, w = 14 + r() * 26, h = 12 + r() * 90; list.push([x, h / 2, z, w, h, 14 + r() * 26, pick([0x7d8ea3, 0x5f7187, 0xd8c3a0, 0xc9ae86, 0x9aa7b4], r)]); }
    const bld = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), makeBuildingMat(this.game.U), list.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    list.forEach((b, i) => { m4.compose(new THREE.Vector3(b[0], b[1], b[2]), q, new THREE.Vector3(b[3], b[4], b[5])); bld.setMatrixAt(i, m4); bld.setColorAt(i, c.set(b[6])); }); bld.castShadow = true; this.add(bld);
    const trees = []; for (let i = 0; i < 300; i++) { const a = r() * Math.PI * 2, d = H + 8 + r() * 45; trees.push([Math.cos(a) * d, Math.sin(a) * d, 0.8 + r() * 0.6]); }
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.13, 0.2, 2.8, 6).translate(0, 1.4, 0), new THREE.MeshStandardMaterial({ color: 0x5a4636, roughness: 0.9 }), trees.length);
    const crown = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.7, 1).translate(0, 3.9, 0), new THREE.MeshStandardMaterial({ color: 0x3d6a33, roughness: 0.85, flatShading: true }), trees.length);
    trees.forEach((t, i) => { const sv = new THREE.Vector3(t[2], t[2], t[2]); m4.compose(new THREE.Vector3(t[0], 0, t[1]), q, sv); trunk.setMatrixAt(i, m4); crown.setMatrixAt(i, m4); });
    trunk.castShadow = crown.castShadow = true; this.add(trunk); this.add(crown); this.trees = [trunk, crown]; this.treeTotal = trees.length;
  }
  buildCones() {
    const pos = []; for (let x = -138; x <= 138; x += 12) pos.push([x, -120]);
    for (const cx of [-90, 90]) for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; pos.push([cx + Math.cos(a) * 14, 60 + Math.sin(a) * 14]); }
    for (let i = 0; i < 10; i++) pos.push([-40 + (i % 2) * 80, -60 + Math.floor(i / 2) * 12]);
    this.cones = pos.map(p => ({ x0: p[0], z0: p[1], x: p[0], z: p[1], vx: 0, vz: 0, tilt: 0, rot: 0, hit: false }));
    this.coneMesh = new THREE.InstancedMesh(merge([colored(new THREE.ConeGeometry(0.24, 0.72, 12).translate(0, 0.36, 0), 0xff6a12), colored(new THREE.CylinderGeometry(0.17, 0.2, 0.1, 12).translate(0, 0.32, 0), 0xf4f4f4), colored(new THREE.BoxGeometry(0.5, 0.04, 0.5).translate(0, 0.02, 0), 0x222222)]), MAT.vcol, this.cones.length);
    this.coneMesh.castShadow = true; this.coneMesh.frustumCulled = false; this.add(this.coneMesh); this.renderCones();
  }
  resetCones() { for (const c of this.cones) Object.assign(c, { x: c.x0, z: c.z0, vx: 0, vz: 0, tilt: 0, rot: 0, hit: false }); this.renderCones(); }
  stepCones(dt, P) {
    const fx = Math.sin(P.h), fz = Math.cos(P.h); let hits = 0;
    for (const c of this.cones) {
      for (const o of P.circ) { const px = P.x + fx * o, pz = P.z + fz * o, dx = c.x - px, dz = c.z - pz, d = Math.hypot(dx, dz), rr = P.rad + 0.3; if (d < rr && d > 1e-4) { const sp = Math.hypot(P.vx, P.vz); c.x = px + dx / d * rr; c.z = pz + dz / d * rr; c.vx = P.vx * 1.1 + dx / d * sp * 0.4; c.vz = P.vz * 1.1 + dz / d * sp * 0.4; if (!c.hit && sp > 2) { c.hit = true; hits++; } } }
      if (c.vx || c.vz) { c.x += c.vx * dt; c.z += c.vz * dt; const k = Math.exp(-2.5 * dt); c.vx *= k; c.vz *= k; c.rot += Math.hypot(c.vx, c.vz) * dt * 2; if (Math.hypot(c.vx, c.vz) < 0.05) { c.vx = 0; c.vz = 0; } }
      if (c.hit) c.tilt = Math.min(1.45, c.tilt + dt * 6);
    }
    this.renderCones(); return hits;
  }
  renderCones() {
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YXZ'), one = new THREE.Vector3(1, 1, 1);
    this.cones.forEach((c, i) => { e.set(c.tilt, c.rot, 0); q.setFromEuler(e); m4.compose(new THREE.Vector3(c.x, c.tilt > 0.5 ? 0.22 : 0.02, c.z), q, one); this.coneMesh.setMatrixAt(i, m4); });
    this.coneMesh.instanceMatrix.needsUpdate = true;
  }
  animate(t) { }
  dispose() { City.prototype.dispose.call(this); }
}
