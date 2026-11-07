
/* =====================================================================
   Game — состояние, цикл с фиксированным шагом, логика кортежа
   ===================================================================== */
const START_S = 20;
class Game {
  constructor() {
    const canvas = $('gl');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1; this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene(); this.camera = new THREE.PerspectiveCamera(62, 1, 0.25, 1900);
    this.U = { night: { value: 0 } }; this.gripMul = 1; this.eventObs = []; this.escorts = []; this.pIdx = 0; this.sP = 0;
    initMaterials();
    this.scene.fog = new THREE.Fog(0xd9c3a8, 50, 430);
    this.hemi = new THREE.HemisphereLight(0xdfe6f2, 0x4a4034, 0.55); this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffe0bc, 3.1); this.sun.castShadow = true; this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.04; this.scene.add(this.sun, this.sun.target);
    this.atmo = new Atmosphere(this);
    this.peds = new Peds(this); this.traffic = new Traffic(this);
    this.smoke = new Particles(this.scene, 320, false); this.sparks = new Particles(this.scene, 200, true); this.fire = new Particles(this.scene, 160, true); this.skids = new Skids(this.scene);
    this.audio = new AudioSys(); this.audio.onNews = txt => { if (this.state === 'play') this.ui.toast('Радио: ' + txt); };
    this.ui = new UI(this); this.input = new Input(this); this.photo = new PhotoMode(this); this.replay = new Replay(this); this.callUI = new CallUI(this); this.papa = new Paparazzi(this); this.events = new Events(this);
    this.headSpot = new THREE.SpotLight(0xfff4e0, 0, 70, 0.55, 0.45, 1.4); this.scene.add(this.headSpot, this.headSpot.target);
    this.rainCv = $('rainfx'); this.rainCtx = this.rainCv.getContext('2d'); this.drops = [];
    this.camMode = 0; this.fcam = { yaw: 0.6, pitch: 0.28, dist: 8 }; this.bindFreeCam(canvas); this.camPos = new THREE.Vector3(); this.camH = 0; this.shake = 0; this.C = { nx: 0, nz: 0, pen: 0 };
    this.state = 'menu'; this.paused = false; this.t = 0; this.acc = 0; this.last = performance.now(); this.sirenOn = true;
    this.fps = { frames: 0, time: 0, warm: 0, changes: 0, locked: false, shown: 0 };
    this.qName = Store.data.quality === 'auto' ? (isTouch ? 'low' : 'medium') : Store.data.quality; this.quality = QUALITY[this.qName];
    this.roleId = Store.data.role;
    this.loadWorld(Store.data.level, Store.data.role);
    this.setQuality(Store.data.quality);
    this.resetLevel(); this.toMenu();
    addEventListener('resize', () => this.resize()); this.resize();
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.togglePause(true); });
    addEventListener('blur', () => this.togglePause(true));
    if (isTouch) document.body.classList.add('touch');
    this.ensureDaily();
    requestAnimationFrame(t => this.loop(t));
  }
  // ---------- мир ----------
  loadWorld(levelId, roleId, carOverride, free) {
    const L = LEVEL_BY(levelId), role = ROLE(roleId);
    if (this.world) this.world.dispose(); if (this.posts) this.posts.dispose(); for (const e of this.escorts) e.dispose(); this.escorts = [];
    this.events && this.events.clear();
    this.level = L; this.roleId = role.id; this.role = role;
    this.free = free || null;
    if (L.arena) { this.world = new Arena(this); this.basePath = this.path = this.world.path; }
    else if (L.mountain) { this.world = new Mountain(this, role.dest); this.basePath = this.path = this.world.path; }
    else { setLayout(L.layout); this.basePath = this.path = Path.grid(L.route, LANES[0]); this.world = new City(this, L, this.path, role.dest); }
    this.atmo.setup(free ? free.tod : L.tod, free ? free.weather : L.weather);
    this.scene.environment = this.atmo.buildEnv(this.renderer);
    this.posts = new Posts(this, free ? [] : this.path.pass);
    if (!free) {
      const ahead = role.escort.filter(k => k !== 'tail'), nA = ahead.length;
      ahead.forEach((k, i) => this.escorts.push(new EscortCar(this, k, 24 + 11 * (nA - 1) - 11 * i, i)));
      if (role.escort.includes('tail')) this.escorts.push(new EscortCar(this, 'tail', -13, 9));
    }
    const carId = carOverride || Store.data.car;
    if (!this.player || this.player.carId !== carId) { if (this.player) this.player.vis.dispose(); this.player = new PlayerCar(this, carId); } else this.player.build();
    this.timeLimit = Math.round(this.path.destS / L.avg * role.timeK / 5) * 5;
    this.ui.buildMap(this.world, this.path);
    this.loaded = { level: L.id, role: role.id, car: carId, free: !!free };
    this.world.setDetail(this.quality); this.peds.clear(); this.peds.setActive(this.pedCount());
    for (const a of this.traffic.agents) { a.active = false; this.traffic.hide(a); } this.traffic.setActive(this.trafficCount());
    for (const m of [this.atmo.mesh]) m.visible = true;
    if (free && this.world.marker) this.world.marker.visible = false;
    this.captureEnv();
  }
  noCrowd() { return this.level.arena || (this.free && this.free.traffic === false); }
  pedCount() { return this.level.mountain || this.noCrowd() ? 0 : Math.round(this.quality.peds * (this.level.peds || 1)); }
  trafficCount() { return this.noCrowd() ? 0 : Math.round(this.quality.traffic * (this.level.traffic || 1)); }
  // отражения: кубическая карта, снятая в точке старта (машины видят настоящий город)
  captureEnv() {
    if (!this.quality.post) return;
    try {
      const o = this.path.at(START_S, {}), rt = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType }), cc = new THREE.CubeCamera(1, 900, rt);
      cc.position.set(o.x, (o.y || 0) + 2.5, o.z);
      const hide = [this.player && this.player.vis.root, ...this.escorts.map(e => e.vis.root), this.atmo.flareHolder].filter(Boolean), vis = hide.map(h => h.visible);
      hide.forEach(h => h.visible = false);
      const env = this.scene.environment; this.scene.environment = null; this.sun.updateMatrixWorld();
      cc.update(this.renderer, this.scene);
      hide.forEach((h, i) => h.visible = vis[i]);
      if (!this.pmrem) this.pmrem = new THREE.PMREMGenerator(this.renderer);
      const tex = this.pmrem.fromCubemap(rt.texture).texture; rt.dispose();
      if (this.envTex) this.envTex.dispose(); this.envTex = tex; this.scene.environment = tex; void env;
    } catch (e) { console.warn('captureEnv', e); }
  }
  prepare(cb) {
    const d = Store.data, need = !this.loaded || this.loaded.free || this.loaded.level !== d.level || this.loaded.role !== d.role || this.loaded.car !== d.car;
    if (!need) { this.player.build(); return cb(); }
    $('busy').hidden = false;
    setTimeout(() => { try { this.loadWorld(d.level, d.role); this.resetLevel(); } finally { $('busy').hidden = true; } cb(); }, 40);
  }
  setPath(path) {
    for (const pn of this.path.pass) { const n = this.world.node(pn.i, pn.j); if (n) { n.block = null; n.key = ''; } }
    this.posts.dispose(); this.path = path; this.posts = new Posts(this, path.pass);
  }
  reroute(nodes) {
    const np = Path.grid(nodes, LANES[0]), P = this.player;
    this.setPath(np);
    this.pIdx = np.nearest(P.x, P.z, -1); this.sP = this.pIdx * PSTEP;
    for (const pn of np.pass) if (pn.s < this.sP + 4) pn.done = true;
    for (const e of this.escorts) { const i = np.nearest(e.x, e.z, -1); e.s = i * PSTEP; }
  }
  // ---------- качество ----------
  setQuality(mode) { const name = mode === 'auto' ? this.qName : mode; this.fps.locked = mode !== 'auto'; this.fps.changes = 0; this.fps.time = 0; this.fps.frames = 0; this.fps.warm = 0; this.applyQuality(name); }
  applyQuality(name) {
    const q = QUALITY[name], r = this.renderer; this.qName = name; this.quality = q;
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pr));
    const shadowsChanged = r.shadowMap.enabled !== q.shadows || this.sun.shadow.mapSize.x !== q.shadowSize;
    r.shadowMap.enabled = q.shadows; this.sun.castShadow = q.shadows;
    this.sun.shadow.mapSize.set(q.shadowSize, q.shadowSize); if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    const sc = this.sun.shadow.camera; sc.left = -q.shadowBox; sc.right = q.shadowBox; sc.top = q.shadowBox; sc.bottom = -q.shadowBox; sc.near = 1; sc.far = 500; sc.updateProjectionMatrix();
    this.camera.far = q.fogFar + 1500; this.camera.updateProjectionMatrix();
    if (this.level) { this.traffic.setActive(this.trafficCount()); this.peds.setActive(this.pedCount()); } this.world.setDetail(q);
    if (q.post && !this.post) this.post = new Post(this);
    document.body.classList.toggle('q-low', name === 'low');
    if (shadowsChanged) this.scene.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.needsUpdate = true); });
    this.resize();
  }
  autoQuality(dt) {
    const F = this.fps; if (Store.data.quality !== 'auto' || F.locked || this.paused || this.state === 'garage') return;
    F.warm += dt; if (F.warm < 2.5) return;
    F.frames++; F.time += dt; if (F.time < 3) return;
    const fps = F.frames / F.time; F.frames = 0; F.time = 0;
    const i = Q_ORDER.indexOf(this.qName);
    if (fps < 30 && i > 0) { this.applyQuality(Q_ORDER[i - 1]); F.changes++; F.warm = 0; this.ui.toast(`Качество: ${QUALITY[this.qName].label} (авто, ${Math.round(fps)} FPS)`); if (F.changes > 2) F.locked = true; }
    else if (fps > 57 && i < 2 && F.changes === 0) { this.applyQuality(Q_ORDER[i + 1]); F.changes++; F.warm = 0; this.ui.toast(`Качество: ${QUALITY[this.qName].label} (авто)`); }
    else if (F.changes > 0) F.locked = true;
  }
  resize() {
    const w = innerWidth, h = innerHeight, pr = this.renderer.getPixelRatio(); this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    if (this.garage) { this.garage.camera.aspect = w / h; this.garage.camera.updateProjectionMatrix(); }
    if (this.post) this.post.setSize(w, h, pr);
    const s = h * pr / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2));
    for (const p of [this.smoke, this.sparks, this.fire]) p.uni.uScale.value = s;
    this.rainCv.width = Math.round(w / 2); this.rainCv.height = Math.round(h / 2);
  }
  // ---------- состояния ----------
  resetLevel() {
    const P = this.player, o = {};
    if (this.path !== this.basePath) this.setPath(this.basePath);
    this.world.closed.clear();
    this.path.at(START_S, o); P.reset(o.x, o.z, o.h); P.y = P.py = o.y;
    for (const e of this.escorts) e.reset(START_S + e.off);
    this.camH = o.h; this.camPos.set(o.x - Math.sin(o.h) * 8, o.y + 3, o.z - Math.cos(o.h) * 8);
    for (const pn of this.path.pass) { pn.active = false; pn.done = false; pn.warned = false; pn.lowT = 0; const n = this.world.node(pn.i, pn.j); if (n) { n.block = null; n.key = ''; } }
    this.posts.reset(); this.skids.clear(); this.smoke.clear(); this.sparks.clear(); this.fire.clear();
    this.papa.stop(); this.callUI.close(true); if (this.free) this.events.clear(); else this.events.plan(this.level);
    this.atmo.setup(this.free ? this.free.tod : this.level.tod, this.free ? this.free.weather : this.level.weather);
    if (this.world.resetCones) this.world.resetCones();
    this.pSirenOn = false; this.fstat = { max: 0, drift: 0, cones: 0 };
    Object.assign(this, { elapsed: 0, penalty: 0, hits: 0, score: 0, wave: 0, bestWave: 0, link: 1, pIdx: Math.floor(START_S / PSTEP), sP: START_S, driftT: 0, driftHit: false, cleanAcc: 0, finished: false, slowWarn: 0, countT: 0, horn: false, rep: 100, overT: 0, overWarn: 0, drifts: 0, distRun: 0, scrape: false });
    for (const a of this.traffic.agents) if (a.active) this.traffic.spawn(a, 35, 260);
    this.peds.clear();
    this.playerBeacon = !!tuneOf(P.carId).beacon; P.vis.setBeacon(this.playerBeacon);
  }
  startFree() {
    const f = Store.data.free; this.ui.hideAll(); $('busy').hidden = false;
    setTimeout(() => {
      try { this.loadWorld(f.level, Store.data.role, undefined, { tod: f.tod, weather: f.weather, traffic: f.traffic }); this.resetLevel(); } finally { $('busy').hidden = true; }
      this.paused = false; this.audio.setPaused(false); this.state = 'free'; this.camMode = this.camMode === 3 ? 0 : this.camMode;
      $('hud').hidden = false; $('touch').hidden = !isTouch; $('replayUI').hidden = true; $('radioChip').hidden = !this.audio.station; $('count').innerHTML = '';
      this.ui.toast(this.level.arena ? 'Арена: дрифт-круги, слалом и конусы. G — сирена, Y — тон, T — на трассу' : 'Свободная езда: без таймера и штрафов. G — сирена, Y — тон');
    }, 40);
  }
  freeLogic(dt) {
    const P = this.player, F = this.fstat, kmh = Math.abs(P.vL) * 3.6;
    this.elapsed += dt; this.distRun += Math.abs(P.vL) * dt; F.max = Math.max(F.max, kmh);
    if (P.slip > 2.4 && Math.abs(P.vL) > 6) this.driftT += dt;
    else if (this.driftT > 0) { if (this.driftT > 0.8 && !this.driftHit) { const pts = Math.round(this.driftT * 60); F.drift += pts; this.ui.toast(`Дрифт ${this.driftT.toFixed(1).replace('.', ',')} с · +${pts}`, 'gold'); if (this.driftT > 3) this.unlockAch('drift'); } this.driftT = 0; this.driftHit = false; }
    if (this.world.stepCones) { const n = this.world.stepCones(dt, P); if (n) { F.cones += n; this.audio.burst('triangle', 0.08, 0.15, 420, 160); } }
    if (P.damage >= 100) { P.damage = 0; P.engineDmg = 0; P.vis.resetDamage(); this.ui.toast('Машина отремонтирована', 'gold'); }
  }
  toggleSiren() {
    if (this.state !== 'free' && this.state !== 'play') return;
    this.pSirenOn = !this.pSirenOn; this.player.vis.setBeacon(this.pSirenOn || this.playerBeacon); $('tSiren').classList.toggle('on', this.pSirenOn);
    this.ui.toast(this.pSirenOn ? 'Сирена: ' + (SIREN_NAME[Store.data.pSiren] || 'вой') : 'Сирена выключена');
  }
  cycleSiren() {
    const ids = SIRENS.map(s => s.id), d = Store.data;
    if (this.pSirenOn) { const p = ids.filter(i => i !== 'auto'); d.pSiren = p[(p.indexOf(d.pSiren) + 1) % p.length]; this.ui.toast('Тон сирены: ' + SIREN_NAME[d.pSiren]); }
    else { d.siren = ids[(ids.indexOf(d.siren) + 1) % ids.length]; this.ui.toast('Сирена кортежа: ' + SIRENS.find(s => s.id === d.siren).name); }
    Store.save(); this.ui.syncSettings && this.ui.syncSettings();
  }
  sirenModeNow() {
    const m = Store.data.siren; if (m && m !== 'auto') return m;
    if (this.path.pass.some(pn => pn.active && !pn.done)) return 'yelp';
    return Math.floor(this.t / 9) % 3 === 2 ? 'hilo' : 'wail';
  }
  recover() {
    if (this.state !== 'free') return; const P = this.player, i = this.path.nearest(P.x, P.z, -1), o = this.path.at(i * PSTEP, {});
    P.reset(o.x, o.z, o.h); P.y = P.py = o.y || 0; this.camH = o.h; this.ui.toast('Машина возвращена на трассу');
  }
  startLevel() {
    this.prepare(() => {
      this.resetLevel(); this.ui.hideAll(); this.paused = false; this.audio.setPaused(false);
      this.state = 'count'; this.countT = 3.2; this.lastCount = 4; this.camMode = this.camMode === 3 ? 0 : this.camMode;
      $('hud').hidden = false; $('touch').hidden = !isTouch; $('replayUI').hidden = true; $('radioChip').hidden = !this.audio.station;
      if ($('hDest')) $('hDest').textContent = DEST[this.role.dest].name;
      this.replay.start(); this.ensureDaily();
    });
  }
  toMenu() {
    if (this.photo.on) this.photo.toggle(false);
    this.state = 'menu'; this.paused = false; this.audio.setPaused(false); this.replay.play = null; this.pSirenOn = false;
    if (this.loaded.free || this.loaded.level !== Store.data.level || this.loaded.role !== Store.data.role || this.loaded.car !== Store.data.car) this.loadWorld(Store.data.level, Store.data.role);
    this.resetLevel();
    $('hud').hidden = true; $('touch').hidden = true; $('count').innerHTML = ''; $('replayUI').hidden = true; $('rainfx').hidden = true; $('tintFx').style.opacity = 0; this.ui.show('menu');
  }
  openGarage() {
    if (!this.garage) this.garage = new Garage(this);
    this.state = 'garage'; this.garage.show(Store.data.car); this.ui.gTab = 'car'; this.ui.renderGarage(); this.ui.show('garage'); this.resize();
  }
  closeGarage() {
    if (this.garage.car) { this.garage.car.dispose(); this.garage.car = null; }
    this.state = 'menu';
    if (this.loaded.car !== Store.data.car) { this.player.vis.dispose(); this.player = new PlayerCar(this, Store.data.car); this.loaded.car = Store.data.car; } else this.player.build();
    this.resetLevel(); this.ui.show('menu');
  }
  startReplay(levelId) {
    const data = Store.data.replays[levelId]; if (!data) return;
    $('busy').hidden = false;
    setTimeout(() => {
      try { this.loadWorld(levelId, data.role, data.car); this.resetLevel(); } finally { $('busy').hidden = true; }
      this.ui.hideAll(); this.state = 'replay'; this.replay.begin(data); this.paused = false;
      $('replayUI').hidden = false; $('replayLbl').textContent = `ПОВТОР · ${LEVEL_BY(levelId).name} · ${fmtPts(data.score)} очков`;
    }, 40);
  }
  togglePause(force) {
    if (!['play', 'count', 'free'].includes(this.state)) return; if (this.photo.on) return;
    const p = force === undefined ? !this.paused : force; if (p === this.paused) return;
    this.paused = p; this.audio.setPaused(p);
    if (p) this.ui.show('pause'); else { this.ui.hideAll(); this.last = performance.now(); }
  }
  cycleCam() { if (!['play', 'count', 'result', 'free'].includes(this.state)) return; this.camMode = (this.camMode + 1) % 5; if (this.camMode === 4) Object.assign(this.fcam, { yaw: 0.6, pitch: 0.28, dist: 8 }); this.ui.toast(['Камера: сзади', 'Камера: капот', 'Камера: салон', 'Камера: сверху', isTouch ? 'Свободная камера: водите пальцем по экрану, двумя — приближение' : 'Свободная камера: тяните мышью, колесо — приближение'][this.camMode]); }
  // свободная камера: вращение мышью или пальцем вокруг машины, приближение колесом или щипком
  bindFreeCam(cv) {
    const pts = new Map(); let pinch = 0;
    const on = () => this.camMode === 4 && !this.photo.on && ['play', 'count', 'result', 'free'].includes(this.state);
    cv.addEventListener('pointerdown', e => { if (!on()) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); pinch = 0; });
    addEventListener('pointermove', e => {
      const p = pts.get(e.pointerId); if (!p || !on()) return; const F = this.fcam;
      if (pts.size >= 2) { p.x = e.clientX; p.y = e.clientY; const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch) F.dist = clamp(F.dist * pinch / d, 3.2, 32); pinch = d; return; }
      F.yaw -= (e.clientX - p.x) * 0.008; F.pitch = clamp(F.pitch + (e.clientY - p.y) * 0.005, -0.04, 1.4); p.x = e.clientX; p.y = e.clientY;
    });
    const up = e => { pts.delete(e.pointerId); pinch = 0; }; addEventListener('pointerup', up); addEventListener('pointercancel', up);
    cv.addEventListener('wheel', e => { if (!on()) return; e.preventDefault(); this.fcam.dist = clamp(this.fcam.dist * (1 + Math.sign(e.deltaY) * 0.1), 3.2, 32); }, { passive: false });
  }
  radio() { const name = this.audio.nextStation(); $('radioChip').hidden = !this.audio.station; $('radioName').textContent = name; $('tRadio').classList.toggle('on', !!this.audio.station); this.ui.toast(name); }
  // ---------- прогрессия ----------
  ensureDaily() {
    const d = Store.data, key = todayKey();
    if (!d.daily || d.daily.date !== key) { const r = rng(key.split('-').reduce((a, b) => a * 31 + +b, 7)); const ids = shuffle(DAILY.map(x => x.id), r).slice(0, 3); d.daily = { date: key, tasks: ids.map(id => ({ id, prog: 0, done: false })) }; Store.save(); }
  }
  dailyEvent(key, amount) {
    this.ensureDaily();
    for (const t of Store.data.daily.tasks) { const def = DAILY.find(x => x.id === t.id); if (def.key !== key || t.done) continue; t.prog = def.max ? Math.max(t.prog, amount) : t.prog + amount; if (t.prog >= def.goal) { t.done = true; Store.data.wallet += def.reward; this.ui.toast(`Задание выполнено: ${def.text} · +${def.reward}`, 'gold'); } }
    Store.save();
  }
  unlockAch(id) { const d = Store.data; if (d.ach[id]) return; d.ach[id] = Date.now(); d.wallet += ACH_REWARD; Store.save(); const a = ACH.find(x => x.id === id); this.ui.toast(`Достижение: ${a.name} · +${ACH_REWARD}`, 'gold'); }
  finish(ok, title, text) {
    if (this.finished) return; this.finished = true; this.state = 'result'; this.papa.stop(); this.callUI.close(true);
    const P = this.player, d = Store.data, left = Math.max(0, this.timeLimit - this.elapsed - this.penalty), dur = Math.max(0, 100 - P.damage);
    const starsArr = ok ? [left >= this.timeLimit * 0.2, dur >= 85, this.hits === 0 && this.rep >= 80] : [false, false, false], stars = starsArr.filter(Boolean).length;
    let earned = 0;
    if (ok) { this.score += Math.round(left * 15) + 500 + stars * 250 + Math.round(this.rep * 3); earned = this.score; }
    else earned = Math.round(this.score * 0.25);
    d.wallet += earned; d.earned += earned;
    const rows = [['Запас времени', ok ? fmtTime(left) : '—'], ['Прочность', Math.round(dur) + '%'], ['Столкновения', String(this.hits)], ['Репутация', Math.round(this.rep) + ' из 100'], ['Лучшая зелёная волна', '×' + this.bestWave], ['Заработано очков', '+' + fmtPts(earned)]];
    if (ok) {
      const L = this.level, best = d.best[L.id];
      if (!best || this.score > best.score) { d.best[L.id] = { score: this.score, stars: Math.max(stars, best?.stars || 0), left: Math.round(left) }; rows.push(['', 'Новый рекорд маршрута']); d.replays[L.id] = this.replay.pack({ role: this.roleId, car: P.carId, score: this.score }); }
      else if (stars > best.stars) best.stars = stars;
      const b = d.board[L.id] || (d.board[L.id] = []); const dt = new Date(); b.push({ score: this.score, stars, left: Math.round(left), role: this.roleId, car: P.carId, date: dt.toLocaleDateString('ru-RU') }); b.sort((x, y) => y.score - x.score); b.length = Math.min(b.length, 10);
      const idx = LEVELS.indexOf(L); if (LEVELS[idx + 1] && !d.levels.includes(LEVELS[idx + 1].id) && !LEVELS[idx + 1].bonus) { d.levels.push(LEVELS[idx + 1].id); rows.push(['Открыт маршрут', LEVELS[idx + 1].name]); }
      if (!d.stats.rolesDone.includes(this.roleId)) d.stats.rolesDone.push(this.roleId);
      this.unlockAch('first'); if (dur >= 99.9) this.unlockAch('clean'); if (left >= 90) this.unlockAch('early90'); if (stars === 3) this.unlockAch('stars3');
      if (L.id === 'night') this.unlockAch('night'); if (L.mountain) this.unlockAch('mountain'); if (this.atmo.w.rain > 0.5) this.unlockAch('rain');
      if (d.stats.rolesDone.length >= 5) this.unlockAch('allroles'); if (this.roleId === 'ambassador' && this.hits === 0) this.unlockAch('diplomat');
      this.dailyEvent('finish', 1); if (this.hits === 0) this.dailyEvent('cleanFinish', 1); if (left >= 60) this.dailyEvent('early60', 1); this.dailyEvent('scoreRun', this.score);
    }
    this.dailyEvent('dist', Math.round(this.distRun));
    Store.save();
    setTimeout(() => { $('touch').hidden = true; this.ui.showResult({ ok, title, text, starsArr, rows, clock: this.clockStr() }); }, ok ? 900 : 1300);
  }
  clockStr() { const night = this.level.tod === 'night', base = night ? 23 * 3600 + 45 * 60 : 8 * 3600 + 45 * 60, sec = (base + (this.elapsed + this.penalty) / this.timeLimit * 900) % 86400; return String(Math.floor(sec / 3600)).padStart(2, '0') + ':' + String(Math.floor(sec % 3600 / 60)).padStart(2, '0'); }
  // ---------- цикл ----------
  loop(now) {
    requestAnimationFrame(t => this.loop(t));
    let dt = (now - this.last) / 1000; this.last = now; if (!(dt > 0)) dt = 0; dt = Math.min(dt, 0.1);
    if (!this.paused && this.state !== 'garage') {
      this.acc += dt; let steps = 0;
      while (this.acc >= STEP && steps < 6) { this.fixed(STEP); this.acc -= STEP; steps++; }
      if (steps === 6) this.acc = 0;
    }
    this.renderFrame(this.paused ? 0 : dt, this.acc / STEP);
    this.autoQuality(dt);
    if (Store.data.showFps) { this.fps.shown = damp(this.fps.shown, dt > 0 ? 1 / dt : 0, 3, dt); $('fps').textContent = Math.round(this.fps.shown) + ' FPS · ' + QUALITY[this.qName].label; }
  }
  fixed(dt) {
    this.t += dt;
    const P = this.player, st = this.state, path = this.path;
    let inp = { throttle: 0, brake: 0, steer: 0, hand: false, boost: false, horn: false };
    if (st === 'play' || st === 'free') inp = this.input.read(dt); else { this.input.read(dt); inp.hand = st === 'result' || st === 'count'; }
    this.horn = inp.horn; this.boost = inp.boost;
    if (st === 'replay') return this.replayStep(dt);
    if (st !== 'menu') { P.savePrev(); P.step(dt, inp); this.collidePlayer(dt); this.effects(dt); }
    this.pIdx = path.nearest(P.x, P.z, this.pIdx, 60); if (path.lastD2 > 900) this.pIdx = path.nearest(P.x, P.z, -1);
    this.sP = this.pIdx * PSTEP;
    if (this.world.isSpline) { P.y = path.Y[this.pIdx]; P.slope = Math.atan((path.Y[Math.min(path.N - 1, this.pIdx + 2)] - path.Y[Math.max(0, this.pIdx - 2)]) / (4 * PSTEP)) * Math.cos(wrapA(P.h - path.H[this.pIdx])); }
    const vP = Math.max(0, P.vL * Math.cos(wrapA(P.h - path.H[this.pIdx]))), active = st === 'play' || st === 'result';
    if (st === 'free') this.freeLogic(dt);
    let front = null; for (const e of this.escorts) { e.step(dt, this.sP, vP, active, e.kind !== 'tail' ? front : null); if (e.kind !== 'tail') front = e; }
    this.traffic.step(dt, this.t); this.peds.step(dt, this.t);
    if (st === 'count') {
      this.countT -= dt; const n = Math.ceil(this.countT);
      if (n !== this.lastCount) { this.lastCount = n; $('count').innerHTML = n > 0 ? `<span>${n}</span>` : '<span style="font-size:.5em">Поехали!</span>'; if (n > 0) this.audio.beep(); else this.audio.burst('sine', 0.15, 0.4, 1320, 1320); }
      if (this.countT <= 0) { this.state = 'play'; setTimeout(() => { if (this.state !== 'count') $('count').innerHTML = ''; }, 700); }
    }
    if (st === 'play') { this.logic(dt); this.events.step(dt); this.papa.step(dt); this.callUI.step(dt); this.replay.record(dt); }
  }
  replayStep(dt) {
    const pl = this.replay.play, P = this.player; if (!pl) return; pl.t += dt;
    const f = this.replay.frameAt(pl.t), a = f.a, b = f.b, k = f.k;
    P.savePrev(); P.x = lerp(a[0], b[0], k); P.z = lerp(a[1], b[1], k); P.h = lerpA(a[2], b[2], k); P.vL = lerp(a[3], b[3], k); P.steer = lerp(a[4], b[4], k); P.aL = (b[3] - a[3]) / 0.1; P.brakeOn = P.aL < -3; P.rpm = 900 + Math.abs(P.vL) * 90; P.throttle = P.aL > 0.5 ? 1 : 0;
    this.link = lerp(a[5], b[5], k);
    this.pIdx = this.path.nearest(P.x, P.z, this.pIdx, 60); this.sP = this.pIdx * PSTEP; if (this.world.isSpline) P.y = this.path.Y[this.pIdx];
    this.escorts.forEach((e, i) => { e.px = e.x; e.pz = e.z; e.ph = e.h; e.py = e.y; const s0 = a[6 + i] ?? e.s, s1 = b[6 + i] ?? s0; e.v = (s1 - s0) / 0.1; e.s = lerp(s0, s1, k); this.path.at(e.s, e.pose); e.x = e.pose.x; e.z = e.pose.z; e.h = e.pose.h; e.y = e.pose.y; });
    this.blockLogic(dt);
    this.traffic.step(dt, this.t); this.peds.step(dt, this.t);
    if (f.end) { $('replayLbl').textContent = 'Повтор окончен'; this.state = 'replayEnd'; setTimeout(() => { if (this.state === 'replayEnd') this.toMenu(); }, 1800); }
  }
  blockLogic(dt) {
    const lead = this.escorts[0], pa = this.path;
    for (const pn of pa.pass) {
      if (pn.done) continue;
      const de = pn.s - lead.s, n = this.world.node(pn.i, pn.j);
      if (!pn.active && de < 90 && de > -6) {
        if (this.link > 0.5) { pn.active = true; n.block = { dir: pn.dirIn }; const dc = Math.hypot(n.x - this.camera.position.x, n.z - this.camera.position.z), v = clamp(1 - dc / 160, 0, 1); this.audio.whistle(v); this.audio.quack(v * 0.8); }
        else if (!pn.warned && de < 70 && this.state === 'play') { pn.warned = true; this.ui.toast('Связь потеряна: перекрёсток не перекрыт', 'bad'); }
      }
      if (pn.active) { if (this.link < 0.25 && lead.s > pn.s + 25) pn.lowT += dt; else pn.lowT = 0; if (pn.lowT > 2.5) { pn.active = false; n.block = null; n.key = ''; this.wave = 0; if (this.state === 'play') this.ui.toast('ДПС ушла вперёд — перекрёсток открыт', 'bad'); } }
      if (this.sP > pn.s + 12) {
        pn.done = true;
        if (pn.active) { pn.active = false; n.block = null; n.key = ''; this.wave++; this.bestWave = Math.max(this.bestWave, this.wave); if (this.state === 'play') { const pts = Math.round(150 * (1 + (this.wave - 1) * 0.25)); this.score += pts; if (this.wave >= 2) this.ui.toast(`Зелёная волна ×${this.wave} · +${pts}`, 'gold'); this.dailyEvent('wave', 1); if (this.wave >= 10) this.unlockAch('wave10'); } }
        else this.wave = 0;
      }
    }
  }
  logic(dt) {
    const P = this.player, pa = this.path;
    this.elapsed += dt; this.distRun += Math.abs(P.vL) * dt;
    const ahead = this.escorts.filter(e => e.kind !== 'tail'), near = ahead[ahead.length - 1];
    const d = Math.hypot(P.x - near.x, P.z - near.z), lt = clamp(1 - (d - (near.off + 2)) / 50, 0, 1); this.link = damp(this.link, lt, 2.2, dt);
    this.blockLogic(dt);
    // свобода роли: превышение скорости снижает репутацию
    const kmh = Math.abs(P.vL) * 3.6;
    if (kmh > this.role.freedom + 5) { this.rep = Math.max(0, this.rep - dt * 2.5); this.overWarn -= dt; if (this.overWarn <= 0) { this.overWarn = 8; this.ui.toast(`Свобода роли — ${this.role.freedom} км/ч. Репутация падает`, 'bad'); } }
    this.cleanAcc += Math.abs(P.vL) * dt; if (this.cleanAcc > 100) { this.cleanAcc -= 100; this.score += 10; }
    if (P.slip > 2.4 && Math.abs(P.vL) > 6) this.driftT += dt;
    else if (this.driftT > 0) { if (this.driftT > 0.8 && !this.driftHit) { const pts = Math.round(this.driftT * 60); this.score += pts; this.ui.toast(`Дрифт · +${pts}`, 'gold'); this.dailyEvent('drift', 1); if (this.driftT > 3) this.unlockAch('drift'); } this.driftT = 0; this.driftHit = false; }
    const left = this.timeLimit - this.elapsed - this.penalty;
    if (left <= 0) return this.finish(false, 'Опоздание', 'Мероприятие началось без вас. Держитесь ближе к сопровождению — так перекрёстки открываются сами.');
    if (P.damage >= 100) return this.finish(false, 'Машина разбита', 'Служебный автомобиль дальше не поедет. В следующий раз меньше контактов с бордюрами и соседями по потоку.');
    const dd = Math.hypot(P.x - pa.destX, P.z - pa.destZ);
    if (dd < 9) {
      if (Math.abs(P.vL) < 8.5) return this.finish(true, left > this.timeLimit * 0.4 ? 'С большим запасом' : 'Вы на месте', `Вы у входа: ${DEST[this.role.dest].name}, ${this.clockStr()}. Охрана открывает двери.`);
      if (this.slowWarn <= 0) { this.ui.toast('Сбавьте скорость у входа'); this.slowWarn = 3; }
    }
    this.slowWarn -= dt;
  }
  collidePlayer(dt) {
    const P = this.player, C = this.C, fx = Math.sin(P.h), fz = Math.cos(P.h), r = P.rad; this.scrape = false;
    for (const o of P.circ) {
      const cx = P.x + fx * o, cz = P.z + fz * o;
      for (const src of [this.world, this.events]) {
        const hit = src === this.world ? this.world.collide(cx, cz, r, C) : this.events.collide(P, cx, cz, r, C);
        if (!hit) continue;
        P.x += C.nx * C.pen; P.z += C.nz * C.pen; const vn = P.vx * C.nx + P.vz * C.nz;
        if (vn < 0) { P.vx -= 1.25 * vn * C.nx; P.vz -= 1.25 * vn * C.nz; P.vx *= 0.92; P.vz *= 0.92; P.yaw *= 0.6; this.impact(-vn, cx - C.nx * r, cz - C.nz * r, 'wall'); }
        if (Math.abs(P.vL) > 4) this.scrape = true;
      }
    }
    const bodies = [...this.escorts, ...this.traffic.agents];
    for (const a of bodies) {
      const isE = this.escorts.includes(a); if (!isE && (!a.active || a.mode === 'parked')) continue;
      const ddx = a.x - P.x, ddz = a.z - P.z; if (ddx * ddx + ddz * ddz > 200) continue;
      const afx = Math.sin(a.h), afz = Math.cos(a.h), aL = a.bus ? a.L * 0.7 : a.L * 0.55, ar = a.bus ? 1.35 : a.W + 0.05, offs = a.bus ? [-aL, -aL / 3, aL / 3, aL] : [-aL, aL];
      let hit = 0, nx = 0, nz = 0;
      for (const o of P.circ) for (const ao of offs) {
        const px = P.x + fx * o, pz = P.z + fz * o, qx = a.x + afx * ao, qz = a.z + afz * ao, dx = px - qx, dz = pz - qz, rr = r + ar, d2 = dx * dx + dz * dz;
        if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2), pen = rr - d; P.x += dx / d * pen; P.z += dz / d * pen; nx = dx / d; nz = dz / d; hit = 1; }
      }
      if (!hit) continue;
      const av = isE ? a.v : a.v * (a.sign || 1), rvx = P.vx - afx * av, rvz = P.vz - afz * av, vn = rvx * nx + rvz * nz;
      if (vn < 0) { P.vx -= 1.3 * vn * nx; P.vz -= 1.3 * vn * nz; P.yaw *= 0.5; }
      const pw = Math.max(0, -vn);
      if (pw > 1.2 && this.state === 'free') { this.impact(pw, P.x - nx * r, P.z - nz * r, 'car'); if (!isE && a.hitCd <= 0) { a.hitCd = 3; a.hitT = 2.5; this.driftHit = true; } }
      if (pw > 1.2 && this.state === 'play') {
        this.impact(pw, P.x - nx * r, P.z - nz * r, 'car');
        if (isE) { if (!this.escortCd || this.t > this.escortCd) { this.escortCd = this.t + 3; this.ui.toast('Осторожно: вы задели машину сопровождения', 'bad'); this.penalty += 2; this.rep = Math.max(0, this.rep - 8); } }
        else if (a.hitCd <= 0) { a.hitCd = 3; a.hitT = 2.5; this.hits++; const pen = Math.round(5 * this.role.strict); this.penalty += pen; this.rep = Math.max(0, this.rep - 5 * this.role.strict); this.driftHit = true; this.score = Math.max(0, this.score - 100); this.ui.toast(`Столкновение · +${pen} с к маршруту`, 'bad'); }
      }
    }
    for (const p of this.peds.list) {
      if (!p.on) continue;
      for (const o of P.circ) { const dx = P.x + fx * o - p.x, dz = P.z + fz * o - p.z; if (dx * dx + dz * dz < (r + 0.3) ** 2 && Math.abs(P.vL) > 1.2 && this.state === 'free') { p.on = false; p.state = 'off'; p.g.visible = false; this.audio.crash(4); this.ui.toast('Осторожно: пешеход!', 'bad'); break; }
        if (dx * dx + dz * dz < (r + 0.3) ** 2 && Math.abs(P.vL) > 1.2 && this.state === 'play') { this.audio.crash(8); return this.finish(false, 'Сбит пешеход', 'Это конец карьеры, а не просто опоздание. Пешеходы идут на красный для машин — следите за зеброй.'); } }
    }
  }
  impact(pw, x, z, kind) {
    if (pw < 2.2) return;
    const P = this.player, dmg = pw * (kind === 'wall' ? 1.3 : 1.6) * this.role.strict * 100 / P.spec.dur;
    P.damage = Math.min(100, P.damage + dmg); P.engineDmg = clamp((P.damage - 45) / 55, 0, 1);
    if (pw > 3) P.vis.dent(x, P.y + 0.6, z, pw);
    this.shake = Math.min(1, this.shake + pw * 0.06); this.audio.crash(pw); this.driftHit = true;
    const n = Math.min(30, Math.floor(pw * 2.5));
    for (let i = 0; i < n; i++) this.sparks.emit(x, P.y + 0.5 + Math.random() * 0.4, z, (Math.random() - 0.5) * 8, 2 + Math.random() * 4, (Math.random() - 0.5) * 8, 0.3 + Math.random() * 0.4, 0.09, -0.1, 1, 2.4, 1.5, 0.6);
  }
  effects(dt) {
    const P = this.player, s = P.spec, fx = Math.sin(P.h), fz = Math.cos(P.h), rx = -fz, rz = fx, ra = s.L / 2 - s.fo - s.wb, y = P.y;
    const skid = (P.slip > 2.2 && Math.abs(P.vL) > 4) || (P.brakeOn && Math.abs(P.vL) > 12 && P.aL < -6);
    const wet = this.atmo.w.wet;
    if (skid) {
      this.skidAcc = (this.skidAcc || 0) + Math.hypot(P.vx, P.vz) * dt;
      if (this.skidAcc > 0.45) { this.skidAcc = 0; for (const sd of [1, -1]) { const wx = P.x + fx * ra + rx * sd * (s.W / 2 - 0.22), wz = P.z + fz * ra + rz * sd * (s.W / 2 - 0.22); if (!this.world.isSpline && wet < 0.5) this.skids.add(wx, wz, Math.atan2(P.vx, P.vz), y + 0.04); if (Math.random() < 0.7) this.smoke.emit(wx, y + 0.3, wz, (Math.random() - 0.5) * 1.5, 0.6 + Math.random() * 0.6, (Math.random() - 0.5) * 1.5, 1.4 + Math.random(), 0.7, 1.8, 0.35, 0.82, 0.82, 0.84); } }
    }
    if (wet > 0.4 && Math.abs(P.vL) > 6 && Math.random() < 0.5) for (const sd of [1, -1]) this.smoke.emit(P.x + fx * ra + rx * sd * (s.W / 2 - 0.2), y + 0.15, P.z + fz * ra + rz * sd * (s.W / 2 - 0.2), -fx * 2 + (Math.random() - 0.5) * 2, 1 + Math.random(), -fz * 2 + (Math.random() - 0.5) * 2, 0.5, 0.25, 0.8, 0.25 * wet, 0.75, 0.8, 0.85);
    const hx = P.x + fx * (s.L / 2 - 0.7), hz = P.z + fz * (s.L / 2 - 0.7);
    if (P.damage > 55 && Math.random() < (P.damage - 50) / 50 * 0.5) { const dk = P.damage > 80 ? 0.25 : 0.6; this.smoke.emit(hx, y + 1.1, hz, (Math.random() - 0.5) * 0.6, 1.2, (Math.random() - 0.5) * 0.6, 1.6, 0.5, 1.6, 0.4, dk, dk, dk); }
    if (P.damage > 85) for (let i = 0; i < 2; i++) this.fire.emit(hx + (Math.random() - 0.5) * 0.8, y + 1.0, hz + (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.4, 1.6 + Math.random(), (Math.random() - 0.5) * 0.4, 0.45, 0.45, -0.4, 0.9, 2.6, 0.9 + Math.random() * 0.5, 0.2);
  }
  // ---------- рендер ----------
  renderFrame(dt, a, forPhoto) {
    if (this.state === 'garage' && this.garage) {
      this.garage.frame(dt);
      if (this.post && this.quality.post) this.post.render(this.garage.scene, this.garage.camera, dt, { dof: { focus: this.garage.dist, aperture: 0.0018, maxblur: 0.01 }, bloom: 0.35, vig: 0.45, grain: 0.02 });
      else this.renderer.render(this.garage.scene, this.garage.camera);
      return;
    }
    const P = this.player, cam = this.camera, st = this.state, lightsOn = this.atmo.lightsOn;
    const px = lerp(P.px, P.x, a), pz = lerp(P.pz, P.z, a), ph = lerpA(P.ph, P.h, a), py = lerp(P.py, P.y, a);
    P.vis.setPose(px, pz, ph, py, -P.slope * 0.9); P.vis.animate(dt, { vL: P.vL, aL: P.aL, latA: P.vL * -P.yaw, steer: P.steer, brake: P.brakeOn || st === 'count', rev: P.rev, lights: lightsOn });
    for (const e of this.escorts) { const ex = lerp(e.px, e.x, a), ez = lerp(e.pz, e.z, a), eh = lerpA(e.ph, e.h, a), ey = lerp(e.py, e.y, a); e.vis.setPose(ex, ez, eh, ey, -(e.slope || 0) * 0.9); e.vis.animate(dt, { vL: e.v, aL: e.aL, latA: 0, steer: 0, brake: e.aL < -1 || e.v < 0.3, rev: false, lights: lightsOn }); e.flash(this.t, this.quality); }
    this.traffic.render(a, this.t); this.world.updateLights(this.t); this.world.animate(this.t);
    this.posts.step(dt, this.t, cam.position);
    this.smoke.update(dt, -0.4); this.sparks.update(dt, 9.8); this.fire.update(dt, -2);
    // фары игрока
    const hs = this.headSpot, fx = Math.sin(ph), fz = Math.cos(ph);
    hs.intensity = this.quality.lights && lightsOn && !P.vis.lightsBroken ? 160 : 0; hs.position.set(px + fx * 2.4, py + 0.75, pz + fz * 2.4); hs.target.position.set(px + fx * 22, py, pz + fz * 22);
    // камера
    let fov = 62; let dof = null;
    if (this.photo.on) { dof = this.photo.camera(cam, { x: px, y: py, z: pz }); fov = 50; }
    else if (st === 'menu') { const ang = this.t * 0.12 + 2.2, rad = 8.5; cam.position.set(px + Math.sin(ang) * rad, py + 2.1 + Math.sin(this.t * 0.3) * 0.3, pz + Math.cos(ang) * rad); cam.lookAt(px + fx * 6, py + 1.0, pz + fz * 6); fov = 50; }
    else if (st === 'replay' || st === 'replayEnd') { if (this.replay.play) this.replay.shotCam(cam, dt, { x: px, y: py, z: pz, h: ph }); fov = 46; }
    else if (this.camMode === 0) {
      this.camH = lerpA(this.camH, ph, 1 - Math.exp(-4.5 * dt)); const sp = Math.abs(P.vL), dist = 7.2 + sp * 0.03 + P.spec.L * 0.25 - 1.3;
      const tx = px - Math.sin(this.camH) * dist, tz = pz - Math.cos(this.camH) * dist;
      this.camPos.x = damp(this.camPos.x, tx, 9, dt); this.camPos.z = damp(this.camPos.z, tz, 9, dt); this.camPos.y = damp(this.camPos.y, py + 2.6 + (P.spec.cab[3][1] - 1.4), 6, dt);
      cam.position.copy(this.camPos); cam.lookAt(px + fx * 4, py + 1.15, pz + fz * 4); fov = 60 + Math.min(14, sp * 0.28);
    } else if (this.camMode === 1 || this.camMode === 2) {
      const ins = this.camMode === 2, v = P.vis;
      const loc = ins ? new THREE.Vector3(0.38, v.belt + 0.28, v.ws - 1.15) : new THREE.Vector3(0, v.model.TOP(0.85) + 0.5, v.ws + 0.2);
      v.root.updateMatrixWorld(true); const wp = v.inner.localToWorld(loc.clone()), wl = v.inner.localToWorld(loc.clone().add(new THREE.Vector3(0, -0.1, 10)));
      cam.position.copy(wp); cam.lookAt(wl); fov = ins ? 68 : 64 + Math.min(10, Math.abs(P.vL) * 0.2); this.camPos.copy(wp);
    } else if (this.camMode === 4) {
      const F = this.fcam, a = ph + F.yaw, hd = F.dist * Math.cos(F.pitch); this.camH = ph;
      cam.position.set(px - Math.sin(a) * hd, Math.max(py + 0.35, py + 1.0 + F.dist * Math.sin(F.pitch)), pz - Math.cos(a) * hd); cam.lookAt(px, py + 0.85, pz); fov = 55; this.camPos.copy(cam.position);
    } else { this.camH = lerpA(this.camH, ph, 1 - Math.exp(-2.5 * dt)); cam.position.set(px - Math.sin(this.camH) * 14, py + 52, pz - Math.cos(this.camH) * 14); cam.lookAt(px + Math.sin(this.camH) * 10, py, pz + Math.cos(this.camH) * 10); this.camPos.copy(cam.position); }
    if (this.shake > 0.001 && !this.photo.on) { cam.position.x += (Math.random() - 0.5) * this.shake * 0.4; cam.position.y += (Math.random() - 0.5) * this.shake * 0.3; this.shake = damp(this.shake, 0, 5, dt); }
    if (Math.abs(cam.fov - fov) > 0.05) { cam.fov = damp(cam.fov, fov, 4, dt || 0.016); cam.updateProjectionMatrix(); }
    this.atmo.update(dt, cam, this);
    const sd = this.atmo.p.sun, step = 2, sx = Math.round(px / step) * step, sz = Math.round(pz / step) * step;
    this.sun.target.position.set(sx, py, sz); this.sun.position.set(sx + sd.x * 220, py + Math.max(0.05, sd.y) * 220, sz + sd.z * 220);
    // кабина: тонировка и капли на стекле
    const inCab = (this.camMode === 1 || this.camMode === 2) && ['play', 'count', 'result', 'free'].includes(st) && !this.photo.on;
    $('tintFx').style.opacity = inCab && this.camMode === 2 ? (P.vis.tintK * 0.45).toFixed(2) : 0;
    this.drawRainFx(dt, inCab && this.atmo.w.rain > 0.15);
    // звук
    if (!forPhoto) this.updateAudio(px, pz, st);
    if (st === 'free' && !this.photo.on) {
      const F = this.fstat, sub = `Макс. ${Math.round(F.max)} км/ч · дрифт ${fmtPts(F.drift)} · пробег ${fmtDist(this.distRun)}` + (this.level.arena ? ` · конусы ${F.cones}` : '');
      this.ui.hud(dt, { free: true, sub, timeLeft: this.elapsed, clock: '', dest: '', dur: 100 - P.damage, link: 1, score: F.drift, wave: 0, rep: 100, navIco: this.pSirenOn ? '◉' : '∞', navTxt: this.level.arena ? 'Арена · ' + (this.pSirenOn ? 'сирена ' + SIREN_NAME[Store.data.pSiren] : 'G — сирена') : 'Свободная езда · ' + this.level.name, dist: 0, kmh: Math.abs(P.vL) * 3.6, gear: P.gear, rpm: P.rpm, boost: this.boost, freedom: 400, P: { x: px, z: pz, h: ph }, E: this.escorts, path: this.path, t: this.t, world: this.world });
    }
    if (['play', 'count', 'result'].includes(st) && !this.photo.on) {
      const left = this.timeLimit - this.elapsed - this.penalty, distLeft = Math.max(0, this.path.destS - this.sP);
      const next = this.path.pass.find(pn => !pn.done && pn.turn !== 'straight' && pn.s > this.sP - 5);
      let navIco = '★', navTxt = DEST[this.role.dest].name + ' справа';
      if (next && next.s - this.sP < distLeft) { navIco = next.turn === 'right' ? '↱' : '↰'; navTxt = (next.turn === 'right' ? 'Направо' : 'Налево') + ' через ' + fmtDist(Math.max(0, next.s - this.sP - 8)); }
      else if (this.world.isSpline && distLeft > 150) { navIco = '↑'; navTxt = 'Серпантин, держитесь полосы'; }
      this.ui.hud(dt, { timeLeft: left, clock: this.clockStr(), dest: DEST[this.role.dest].name, dur: 100 - P.damage, link: this.link, score: this.score, wave: this.wave, rep: this.rep, navIco, navTxt, dist: distLeft, kmh: Math.abs(P.vL) * 3.6, gear: P.gear, rpm: P.rpm, boost: this.boost, freedom: this.role.freedom, P: { x: px, z: pz, h: ph }, E: this.escorts, path: this.path, t: this.t, world: this.world });
    }
    // кадр
    const q = this.quality;
    if (this.post && q.post) {
      let rays = 0, sun2 = null;
      if (q.post > 1 && sd.y > 0 && this.atmo.p.night < 0.5 && this.atmo.w.cloud < 0.5) { const v = new THREE.Vector3().copy(cam.position).addScaledVector(sd, 500).project(cam); if (v.z < 1 && Math.abs(v.x) < 1.4 && Math.abs(v.y) < 1.4) { sun2 = new THREE.Vector2(v.x * 0.5 + 0.5, v.y * 0.5 + 0.5); rays = clamp(1 - Math.hypot(v.x, v.y) / 1.6, 0, 1) * (this.atmo.p.sunI < 2.5 ? 1.4 : 0.7); } }
      const blur = q.post > 1 && this.camMode === 0 && (st === 'play' || st === 'free') ? clamp((Math.abs(P.vL) - 18) / 40, 0, 0.06) : 0;
      this.post.render(this.scene, cam, dt, { blur, rays, sun: sun2, filter: this.photo.on ? this.photo.filter : 0, dof: this.photo.on && this.photo.dof > 0.02 ? dof : null, bloom: 0.45 + this.atmo.p.night * 0.4, vig: this.photo.on ? 0.25 : 0.35, grain: forPhoto ? 0.01 : 0.022 });
    } else this.renderer.render(this.scene, cam);
  }
  updateAudio(px, pz, st) {
    const cam = this.camera, P = this.player; let best = null, bd = 1e9;
    for (const e of this.escorts) if (e.siren) { const d = Math.hypot(e.x - cam.position.x, e.z - cam.position.z); if (d < bd) { bd = d; best = e; } }
    let dop = 1, pan = 0, siren = 0;
    if (best) { const dx = best.x - cam.position.x, dz = best.z - cam.position.z, dE = Math.max(1, bd), evx = Math.sin(best.h) * best.v, evz = Math.cos(best.h) * best.v, pv = st === 'menu' ? 0 : 1, vRel = (evx * dx + evz * dz) / dE - (P.vx * pv * dx + P.vz * pv * dz) / dE; dop = 343 / (343 + clamp(vRel, -60, 60)); const camRx = -Math.cos(this.camH), camRz = Math.sin(this.camH); pan = (dx * camRx + dz * camRz) / dE; siren = this.sirenOn ? (st === 'menu' ? 0.03 : 0.09) / (1 + dE / 22) : 0; }
    if (st === 'replay' || st === 'replayEnd') siren *= 0.6;
    const drive = st === 'play' || st === 'free';
    this.audio.update({ rpm: P.rpm, throttle: P.throttle, speed: Math.abs(P.vL), slip: st === 'menu' ? 0 : P.slip, engine: st === 'menu' ? 0.35 : 1, t: this.t, doppler: dop, siren, pan, horn: this.horn && drive, scrape: this.scrape && drive, rain: this.atmo.w.rain, sirenMode: this.sirenModeNow(), pMode: Store.data.pSiren, psiren: this.pSirenOn && drive && !this.paused });
  }
  drawRainFx(dt, on) {
    const cv = this.rainCv, g = this.rainCtx; cv.hidden = !on && !this.drops.length; if (cv.hidden) return;
    const W = cv.width, H = cv.height; g.clearRect(0, 0, W, H);
    if (on && Math.random() < 0.9) for (let i = 0; i < 3; i++) this.drops.push({ x: Math.random() * W, y: Math.random() * H, r: 1.5 + Math.random() * 4, life: 6 });
    this.wiper = ((this.wiper || 0) + dt / 1.4) % 1; const ang = Math.PI * (0.08 + 0.84 * (0.5 - 0.5 * Math.cos(this.wiper * Math.PI * 2)));
    for (const [px, len] of [[W * 0.28, H * 0.95], [W * 0.68, H * 0.95]]) {
      const ex = px - Math.cos(ang) * len, ey = H - Math.sin(ang) * len;
      this.drops = this.drops.filter(d => { const cr = (d.x - px) * (ey - H) - (d.y - H) * (ex - px); return !(Math.abs(cr) / len < 14 && Math.hypot(d.x - px, d.y - H) < len); });
      g.strokeStyle = 'rgba(10,10,12,.85)'; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(px, H); g.lineTo(ex, ey); g.stroke();
    }
    if (!on) for (const d of this.drops) d.life -= dt * 2;
    this.drops = this.drops.filter(d => d.life > 0).slice(-260);
    for (const d of this.drops) { d.y += dt * 4; const gr = g.createRadialGradient(d.x - d.r * 0.3, d.y - d.r * 0.3, 0, d.x, d.y, d.r); gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(0.6, 'rgba(180,200,220,.18)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(d.x, d.y, d.r, 0, Math.PI * 2); g.fill(); }
  }
}

// ---------- запуск ----------
try {
  const game = new Game();
  window.__kortezhReady = true;
  window.__game = game;
  window.__k = { Store, LEVELS, ROLES, CARS, wrapA, clamp };
  $('loading').remove();
} catch (err) {
  console.error(err);
  const m = $('loadMsg'); if (m) m.textContent = 'Не удалось запустить игру: ' + (err && err.message ? err.message : err) + '. Нужен браузер с поддержкой WebGL.';
}
