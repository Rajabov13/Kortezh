
/* =====================================================================
   AudioSys — весь звук синтезируется Web Audio API
   ===================================================================== */
const NEWS = [
  'Доброе утро. В столице сегодня до плюс двадцати четырёх градусов, ветер слабый.',
  'На дорогах города утренние заторы. Водителей просят заранее планировать маршрут.',
  'Синоптики не исключают кратковременных осадков во второй половине дня.',
  'В городских парках продолжается высадка деревьев, к выходным откроются новые аллеи.',
  'Курс валют за ночь существенно не изменился.',
  'В метро вводят дополнительные поезда в часы пик.',
  'Напоминаем: пешеходы на зебре всегда имеют преимущество. Будьте внимательны.'
];
const STATIONS = [{ name: 'Радио выключено' }, { name: 'Ташкент FM · поп', bpm: 112 }, { name: 'Ретро-волна', bpm: 88 }, { name: 'Новости 24', bpm: 70 }];
// режимы сирены: частота в момент t
// Сирена: генератор с «рупорным» спектром, частоту ведёт LFO нужной формы (как в настоящих СГУ),
// дальше — перегруз усилителя, резонансы рупорного динамика и эхо от домов
const SIREN_MODES = {
  wail: { base: 1060, depth: 430, rate: 0.23, shape: k => k < 0.62 ? 1 - (1 - k / 0.62) ** 2 * 2 : -1 + 2 * (1 - ((k - 0.62) / 0.38) ** 1.6) },
  yelp: { base: 1090, depth: 450, rate: 3.4, shape: k => k < 0.55 ? -1 + 2 * k / 0.55 : 1 - 2 * (k - 0.55) / 0.45 },
  hilo: { base: 830, depth: 125, rate: 0.95, type: 'square' },
  phaser: { base: 1180, depth: 470, rate: 11, shape: k => 1 - 2 * k }
};
const SIREN_FREQ = SIREN_MODES; // совместимость: проверка «есть ли такой режим»
function periodicFrom(c, fn, n = 48) {
  const re = new Float32Array(n + 1), im = new Float32Array(n + 1), N = 512, smp = []; for (let i = 0; i < N; i++) smp.push(fn(i / N));
  for (let h = 1; h <= n; h++) { let a = 0, b = 0; for (let i = 0; i < N; i++) { const ph = 2 * Math.PI * h * i / N; a += smp[i] * Math.cos(ph); b += smp[i] * Math.sin(ph); } re[h] = a * 2 / N; im[h] = b * 2 / N; }
  return c.createPeriodicWave(re, im, { disableNormalization: true });
}
class AudioSys {
  constructor() { this.ctx = null; this.vol = Store.data.volume; this.station = 0; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try { this.ctx = new AC(); } catch (e) { this.ctx = null; return; }
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = this.vol; this.master.connect(c.destination);
    const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; this.noise = buf;
    const loopNoise = () => { const s = c.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); return s; };
    const gain = (v = 0) => { const g = c.createGain(); g.gain.value = v; return g; };
    const filt = (type, f, q = 1) => { const b = c.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
    this.gain = gain; this.filt = filt;
    this.eF = filt('lowpass', 600, 2.5); this.eG = gain(); this.o1 = c.createOscillator(); this.o1.type = 'sawtooth'; this.o2 = c.createOscillator(); this.o2.type = 'square';
    const o2g = gain(0.45); this.o1.connect(this.eF); this.o2.connect(o2g); o2g.connect(this.eF); this.eF.connect(this.eG); this.eG.connect(this.master); this.o1.start(); this.o2.start();
    this.wG = gain(); const wf = filt('lowpass', 650); loopNoise().connect(wf); wf.connect(this.wG); this.wG.connect(this.master);
    this.tG = gain(); const tf = filt('bandpass', 1100, 5); loopNoise().connect(tf); tf.connect(this.tG); this.tG.connect(this.master);
    this.scG = gain(); const scf = filt('bandpass', 2600, 3); loopNoise().connect(scf); scf.connect(this.scG); this.scG.connect(this.master);
    this.rG = gain(); const rf = filt('highpass', 1800, 0.5), rf2 = filt('lowpass', 7000); loopNoise().connect(rf); rf.connect(rf2); rf2.connect(this.rG); this.rG.connect(this.master);
    // эхо улиц: стерео-импульс с ранними отражениями от фасадов
    const ir = c.createBuffer(2, Math.floor(c.sampleRate * 1.8), c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d2 = ir.getChannelData(ch); for (let i = 0; i < d2.length; i++) { const t = i / c.sampleRate; d2[i] = (Math.random() * 2 - 1) * Math.exp(-t * 3.4) * 0.5; } for (const [t, a] of [[0.031, 0.7], [0.067, 0.5], [0.104 + ch * 0.013, 0.42], [0.16 + ch * 0.02, 0.3]]) d2[Math.floor(t * c.sampleRate)] += a; }
    this.verb = c.createConvolver(); this.verb.buffer = ir; this.verbG = gain(0.55); this.verb.connect(this.verbG); this.verbG.connect(this.master);
    // рупор сирены: спектр «квадрата» с завалом, перегруз, резонансы динамика
    const hr = new Float32Array(33), hi = new Float32Array(33); for (let h = 1; h <= 32; h++) hi[h] = (h % 2 ? 1 : 0.18) / h * (h > 12 ? 0.6 : 1);
    this.hornWave = c.createPeriodicWave(hr, hi);
    const curve = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; curve[i] = Math.tanh(2.6 * x) / Math.tanh(2.6); }
    this.hornChain = () => {
      const pre = gain(0.9), sh = c.createWaveShaper(); sh.curve = curve; sh.oversample = '2x';
      const hp = filt('highpass', 420, 0.8), pk = filt('peaking', 1300, 1.1), pk2 = filt('peaking', 2900, 1.4), lp = filt('lowpass', 5200, 0.7); pk.gain.value = 7; pk2.gain.value = 3;
      pre.connect(sh); sh.connect(hp); hp.connect(pk); pk.connect(pk2); pk2.connect(lp); return { input: pre, output: lp };
    };
    const voice = () => {
      const o = c.createOscillator(); o.setPeriodicWave(this.hornWave); const lfo = c.createOscillator(), lg = gain(0); lfo.connect(lg); lg.connect(o.frequency);
      const ch = this.hornChain(), g = gain(); o.connect(ch.input); ch.output.connect(g); o.start(); lfo.start(); return { o, lfo, lg, g, mode: '' };
    };
    this.waves = {}; for (const [k, m] of Object.entries(SIREN_MODES)) if (m.shape) this.waves[k] = periodicFrom(c, m.shape);
    this.sV = voice(); this.sG = this.sV.g; this.sP = c.createStereoPanner ? c.createStereoPanner() : null; const sendS = gain(0.5);
    if (this.sP) { this.sG.connect(this.sP); this.sP.connect(this.master); this.sP.connect(sendS); } else { this.sG.connect(this.master); this.sG.connect(sendS); } sendS.connect(this.verb);
    this.pV = voice(); this.pG = this.pV.g; const sendP = gain(0.3); this.pG.connect(this.master); this.pG.connect(sendP); sendP.connect(this.verb);
    this.qChain = this.hornChain(); this.qG = gain(1); this.qChain.output.connect(this.qG); this.qG.connect(this.master); const sendQ = gain(0.4); this.qG.connect(sendQ); sendQ.connect(this.verb);
    this.hG = gain(); const hf = filt('lowpass', 1700); for (const f of [392, 494]) { const o = c.createOscillator(); o.type = 'square'; o.frequency.value = f; o.connect(hf); o.start(); } hf.connect(this.hG); this.hG.connect(this.master);
    // радио: тракт «автомобильных динамиков»
    this.radioG = gain(Store.data.radio); const r1 = filt('highpass', 110), r2 = filt('lowpass', 6500); this.radioIn = gain(0.0); this.radioIn.connect(r1); r1.connect(r2); r2.connect(this.radioG); this.radioG.connect(this.master);
    this.nextNote = 0; this.step16 = 0; this.bar = 0;
    this.seqTimer = setInterval(() => this.schedule(), 90);
  }
  setVolume(v) { this.vol = v; if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05); }
  setRadioVolume(v) { if (this.radioG) this.radioG.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05); }
  setPaused(p) { if (!this.ctx) return; try { p ? this.ctx.suspend() : this.ctx.resume(); } catch (e) { /* ignore */ } if (p && window.speechSynthesis) speechSynthesis.cancel(); }
  update(st) {
    if (!this.ctx) return; const n = this.ctx.currentTime;
    const f = st.rpm / 60 * 2.2;
    this.o1.frequency.setTargetAtTime(f, n, 0.03); this.o2.frequency.setTargetAtTime(f * 0.5, n, 0.03);
    this.eF.frequency.setTargetAtTime(220 + st.throttle * 1300 + st.rpm * 0.12, n, 0.05);
    this.eG.gain.setTargetAtTime(st.engine * (0.045 + 0.06 * st.throttle), n, 0.05);
    this.wG.gain.setTargetAtTime(Math.min(0.22, (st.speed / 45) ** 2 * 0.22), n, 0.1);
    this.tG.gain.setTargetAtTime(clamp((st.slip - 1.8) * 0.05, 0, 0.16), n, 0.05);
    this.scG.gain.setTargetAtTime(st.scrape ? 0.12 : 0, n, 0.04);
    this.rG.gain.setTargetAtTime(st.rain * 0.09, n, 0.3);
    const sm = SIREN_MODES[st.sirenMode] ? st.sirenMode : 'wail', pm = SIREN_MODES[st.pMode] ? st.pMode : 'wail';
    this.driveVoice(this.sV, sm, st.doppler, n); this.sG.gain.setTargetAtTime(st.siren * 1.6, n, 0.08);
    this.driveVoice(this.pV, pm, 1, n); this.pG.gain.setTargetAtTime(st.psiren ? 0.11 : 0, n, 0.05);
    if (this.sP) this.sP.pan.setTargetAtTime(clamp(st.pan, -0.9, 0.9), n, 0.05);
    this.hG.gain.setTargetAtTime(st.horn ? 0.11 : 0, n, 0.015);
  }
  driveVoice(v, mode, dop, n) {
    const m = SIREN_MODES[mode];
    if (v.mode !== mode) { v.mode = mode; if (m.shape) v.lfo.setPeriodicWave(this.waves[mode]); else v.lfo.type = m.type; v.lfo.frequency.setValueAtTime(m.rate, n); }
    v.o.frequency.setTargetAtTime(m.base * dop, n, 0.05); v.lg.gain.setTargetAtTime(m.depth * dop, n, 0.05);
  }
  burst(type, vol, dur, f0, f1, when = 0, dest) {
    if (!this.ctx) return; const c = this.ctx, n = c.currentTime + when, g = c.createGain(); g.gain.setValueAtTime(0, n); g.gain.linearRampToValueAtTime(vol, n + 0.01); g.gain.exponentialRampToValueAtTime(0.0008, n + dur);
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, n); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), n + dur); o.connect(g); g.connect(dest || this.master); o.start(n); o.stop(n + dur + 0.05);
  }
  noiseHit(vol, dur, freq, type = 'lowpass', when = 0, dest) {
    if (!this.ctx) return; const c = this.ctx, n = c.currentTime + when, s = c.createBufferSource(); s.buffer = this.noise; const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = c.createGain(); g.gain.setValueAtTime(vol, n); g.gain.exponentialRampToValueAtTime(0.001, n + dur); s.connect(f); f.connect(g); g.connect(dest || this.master); s.start(n, Math.random()); s.stop(n + dur + 0.05);
  }
  crash(p) { const v = clamp(p / 14, 0.08, 0.6); this.noiseHit(v, 0.5, 900 + p * 120); this.burst('triangle', v * 0.5, 0.35, 220, 70); this.burst('square', v * 0.12, 0.25, 2400, 1300); }
  whistle(v) {
    if (!this.ctx || v < 0.01) return; const c = this.ctx, n = c.currentTime;
    for (const [t0, d] of [[0, 0.22], [0.3, 0.6]]) {
      const o = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain(), g = c.createGain(); o.type = 'sine'; o.frequency.value = 2900; lfo.frequency.value = 26; lg.gain.value = 160;
      lfo.connect(lg); lg.connect(o.frequency); g.gain.setValueAtTime(0, n + t0); g.gain.linearRampToValueAtTime(v * 0.18, n + t0 + 0.02); g.gain.setValueAtTime(v * 0.18, n + t0 + d - 0.05); g.gain.linearRampToValueAtTime(0, n + t0 + d);
      o.connect(g); g.connect(this.master); o.start(n + t0); lfo.start(n + t0); o.stop(n + t0 + d + 0.05); lfo.stop(n + t0 + d + 0.05);
    }
  }
  // «крякалка» СГУ: два коротких рявкающих «вя-а» с падением тона и рычащей модуляцией
  quack(v) {
    if (!this.ctx || v < 0.01) return; const c = this.ctx;
    for (let i = 0; i < 2; i++) {
      const t0 = c.currentTime + i * 0.21, o = c.createOscillator(), g = this.gain(0), am = c.createOscillator(), ag = this.gain(0.45);
      o.setPeriodicWave(this.hornWave); o.frequency.setValueAtTime(1250, t0); o.frequency.exponentialRampToValueAtTime(820, t0 + 0.05); o.frequency.exponentialRampToValueAtTime(430, t0 + 0.17);
      am.type = 'square'; am.frequency.value = 72; am.connect(ag); ag.connect(g.gain);
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(v * 0.55, t0 + 0.012); g.gain.setValueAtTime(v * 0.55, t0 + 0.12); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.19);
      o.connect(g); g.connect(this.qChain.input); o.start(t0); am.start(t0); o.stop(t0 + 0.22); am.stop(t0 + 0.22);
    }
  }
  honk(v, melody) { if (!this.ctx || v < 0.02) return; if (melody) { [523, 659, 784, 659].forEach((f, i) => this.burst('square', v * 0.05, 0.16, f, f, i * 0.18)); } else { this.burst('square', v * 0.07, 0.45, 370, 368); this.burst('square', v * 0.05, 0.45, 466, 464); } }
  tick() { for (let i = 0; i < 4; i++) this.burst('square', 0.03, 0.03, 1200, 1100, i * 0.5); }
  shutter() { this.noiseHit(0.15, 0.06, 3000, 'highpass'); this.noiseHit(0.1, 0.05, 2000, 'highpass', 0.08); }
  ring() { for (let i = 0; i < 2; i++) { this.burst('sine', 0.09, 0.35, 880, 880, i * 0.45); this.burst('sine', 0.07, 0.35, 1100, 1100, i * 0.45); } }
  beep() { this.burst('sine', 0.12, 0.12, 880, 880); }
  // ---------- радио ----------
  nextStation() {
    this.init(); if (!this.ctx) return STATIONS[0].name;
    this.station = (this.station + 1) % STATIONS.length; this.nextNote = this.ctx.currentTime + 0.1; this.step16 = 0; this.bar = 0; this.newsIdx = 0; this.newsT = 0;
    this.radioIn.gain.setTargetAtTime(this.station ? 1 : 0, this.ctx.currentTime, 0.05);
    if (window.speechSynthesis) speechSynthesis.cancel();
    if (this.station === 3) this.jingle();
    return STATIONS[this.station].name;
  }
  jingle() { [659, 784, 988].forEach((f, i) => this.burst('triangle', 0.18, 0.4, f, f, i * 0.16, this.radioIn)); this.newsT = performance.now() + 1200; }
  schedule() {
    if (!this.ctx || !this.station || this.ctx.state !== 'running') return;
    const c = this.ctx, st = STATIONS[this.station], spb = 60 / st.bpm / 4;
    if (this.station === 3) { this.news(); }
    while (this.nextNote < c.currentTime + 0.25) { this.playStep(this.step16, this.nextNote, spb); this.nextNote += spb * (this.station === 2 && this.step16 % 2 === 0 ? 1.18 : this.station === 2 ? 0.82 : 1); this.step16 = (this.step16 + 1) % 16; if (this.step16 === 0) this.bar++; }
  }
  news() {
    const ss = window.speechSynthesis; if (performance.now() < this.newsT) return;
    if (ss && !ss.speaking) {
      const u = new SpeechSynthesisUtterance(NEWS[this.newsIdx % NEWS.length]); u.lang = 'ru-RU'; u.rate = 1.02; u.volume = clamp(Store.data.radio * this.vol, 0, 1);
      const v = ss.getVoices().find(x => /ru/i.test(x.lang)); if (v) u.voice = v;
      try { ss.speak(u); } catch (e) { /* ignore */ }
      this.newsIdx++; this.newsT = performance.now() + 2500; if (this.onNews) this.onNews(u.text);
    } else if (!ss) { if (this.onNews) this.onNews(NEWS[this.newsIdx++ % NEWS.length]); this.newsT = performance.now() + 9000; }
  }
  playStep(i, t, spb) {
    const R = this.radioIn, w = t - this.ctx.currentTime; if (w < 0) return;
    const prog1 = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], prog2 = [[50, 53, 57, 60], [55, 59, 62, 65], [48, 52, 55, 59], [57, 61, 64, 67]];
    const mf = m => 440 * Math.pow(2, (m - 69) / 12);
    if (this.station === 1) {
      const ch = prog1[this.bar % 4];
      if (i % 4 === 0) this.burst('sine', 0.5, 0.18, 150, 45, w, R);
      if (i === 4 || i === 12) this.noiseHit(0.25, 0.14, 1800, 'bandpass', w, R);
      if (i % 2 === 0) this.noiseHit(0.06, 0.04, 8000, 'highpass', w, R);
      if (i % 2 === 0) this.burst('sawtooth', 0.09, spb * 1.6, mf(ch[0] - 24), mf(ch[0] - 24), w, R);
      if (i % 4 === 2 || i === 7 || i === 15) { const n = ch[(i * 7 + this.bar) % 3] + 12; this.burst('square', 0.05, spb * 1.8, mf(n), mf(n), w, R); }
      if (i === 0) for (const n of ch) this.burst('triangle', 0.035, spb * 15, mf(n), mf(n), w, R);
    } else if (this.station === 2) {
      const ch = prog2[this.bar % 4];
      if (i % 4 === 0) this.burst('sine', 0.35, 0.2, 110, 50, w, R);
      if (i % 4 === 2) this.noiseHit(0.05, 0.12, 5000, 'highpass', w, R);
      if (i % 4 === 0) this.burst('triangle', 0.14, spb * 3.5, mf(ch[i / 4 % 4] - 24), mf(ch[i / 4 % 4] - 24), w, R);
      if (i === 0 || i === 6 || i === 10) for (const n of ch) this.burst('sine', 0.03, spb * 3, mf(n), mf(n) * 0.998, w, R);
    } else if (this.station === 3) {
      if (i === 0 && this.bar % 2 === 0) for (const n of [45, 52, 57]) this.burst('sine', 0.025, spb * 30, mf(n), mf(n), w, R);
    }
  }
}

/* =====================================================================
   Input — клавиатура и экранные контролы
   ===================================================================== */
class Input {
  constructor(game) {
    this.g = game; this.keys = {}; this.touch = { steer: 0, gas: 0, brake: 0, hand: 0, horn: 0 }; this.steerKey = 0;
    addEventListener('keydown', e => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code) && game.state !== 'menu') e.preventDefault();
      if (e.repeat) return; this.keys[e.code] = true;
      if (e.code === 'KeyC') game.cycleCam();
      if (e.code === 'KeyR') game.radio();
      if (e.code === 'KeyF') game.photo.toggle();
      if (e.code === 'KeyG') game.toggleSiren();
      if (e.code === 'KeyY') game.cycleSiren();
      if (e.code === 'KeyQ' && ['play', 'free'].includes(game.state)) game.audio.quack(1);
      if (e.code === 'KeyT') game.recover();
      if (e.code === 'Escape' || e.code === 'KeyP') { if (game.photo.on) game.photo.toggle(false); else game.togglePause(); }
      if (['Digit1', 'Digit2', 'Digit3'].includes(e.code)) game.callUI.answer(+e.code.slice(5) - 1);
    });
    addEventListener('keyup', e => { this.keys[e.code] = false; });
    addEventListener('blur', () => { this.keys = {}; });
    this.bindTouch();
  }
  bindTouch() {
    const wheel = $('wheel'), rim = $('wheelRim'); let wid = null, last = 0, ang = 0;
    const angleOf = e => { const r = wheel.getBoundingClientRect(); return Math.atan2(e.clientX - (r.left + r.width / 2), -(e.clientY - (r.top + r.height / 2))); };
    wheel.addEventListener('pointerdown', e => { wid = e.pointerId; wheel.setPointerCapture(e.pointerId); last = angleOf(e); e.preventDefault(); });
    wheel.addEventListener('pointermove', e => { if (e.pointerId !== wid) return; const a = angleOf(e); ang = clamp(ang + wrapA(a - last), -2.4, 2.4); last = a; });
    const endW = e => { if (e.pointerId === wid) wid = null; };
    wheel.addEventListener('pointerup', endW); wheel.addEventListener('pointercancel', endW);
    this.wheelTick = dt => { if (wid === null) ang = damp(ang, 0, 9, dt); this.touch.steer = ang / 2.4; rim.style.transform = `rotate(${ang}rad)`; };
    const hold = (id, key) => {
      const el = $(id);
      el.addEventListener('pointerdown', e => { e.preventDefault(); el.setPointerCapture(e.pointerId); this.touch[key] = 1; el.classList.add('on'); });
      const up = () => { this.touch[key] = 0; el.classList.remove('on'); };
      el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
    };
    hold('pGas', 'gas'); hold('pBrake', 'brake'); hold('tHand', 'hand'); hold('tHorn', 'horn');
    $('tCam').addEventListener('pointerdown', e => { e.preventDefault(); this.g.cycleCam(); });
    $('tRadio').addEventListener('pointerdown', e => { e.preventDefault(); this.g.radio(); });
    $('tSiren').addEventListener('pointerdown', e => { e.preventDefault(); this.g.toggleSiren(); });
  }
  read(dt) {
    const k = this.keys, left = k.KeyA || k.ArrowLeft, right = k.KeyD || k.ArrowRight, target = (right ? 1 : 0) - (left ? 1 : 0);
    const rate = target === 0 ? 6 : (Math.sign(target) !== Math.sign(this.steerKey) && this.steerKey !== 0 ? 7 : 3.2);
    this.steerKey += clamp(target - this.steerKey, -rate * dt, rate * dt);
    this.wheelTick(dt);
    return {
      throttle: Math.max((k.KeyW || k.ArrowUp) ? 1 : 0, this.touch.gas), brake: Math.max((k.KeyS || k.ArrowDown) ? 1 : 0, this.touch.brake),
      steer: clamp(this.steerKey + this.touch.steer, -1, 1), hand: !!(k.Space || this.touch.hand), boost: !!(k.ShiftLeft || k.ShiftRight), horn: !!(k.KeyH || this.touch.horn)
    };
  }
}

/* =====================================================================
   Post — bloom, виньетка, зерно, размытие в движении, лучи, фильтры, DOF
   ===================================================================== */
const FXShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVig: { value: 0.35 }, uGrain: { value: 0.035 }, uBlur: { value: 0 }, uRays: { value: 0 }, uSun: { value: new THREE.Vector2(0.5, 0.5) }, uFilter: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uVig, uGrain, uBlur, uRays, uFilter; uniform vec2 uSun, uRes; varying vec2 vUv;
float rnd(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  vec2 uv = vUv; vec3 c = texture2D(tDiffuse, uv).rgb;
  if (uBlur > 0.001) { vec2 d = (uv - 0.5) * uBlur; vec3 acc = c; for (int i = 1; i < 8; i++) acc += texture2D(tDiffuse, uv - d * float(i) / 8.0).rgb; c = acc / 8.0; }
  if (uRays > 0.001) { vec2 d = (uSun - uv) / 24.0; vec2 p = uv; float dec = 1.0; vec3 r = vec3(0.0); for (int i = 0; i < 24; i++) { p += d; vec3 s = texture2D(tDiffuse, clamp(p, 0.0, 1.0)).rgb; float l = max(0.0, dot(s, vec3(0.3, 0.5, 0.2)) - 1.1); r += l * dec * vec3(1.0, 0.86, 0.62); dec *= 0.93; } c += r * uRays * 0.06; }
  if (uFilter > 0.5 && uFilter < 1.5) { float l = dot(c, vec3(0.299, 0.587, 0.114)); c = vec3(pow(l, 1.15)) * 1.1; }
  else if (uFilter > 1.5 && uFilter < 2.5) { c *= vec3(1.12, 1.0, 0.82); }
  else if (uFilter > 2.5 && uFilter < 3.5) { c *= vec3(0.85, 0.98, 1.15); }
  else if (uFilter > 3.5) { float l = dot(c, vec3(0.299, 0.587, 0.114)); c = mix(c, vec3(l) * vec3(1.15, 0.98, 0.75), 0.75); c = c * 0.85 + 0.04; }
  c *= mix(1.0, smoothstep(0.95, 0.25, length(uv - 0.5)), uVig);
  c += (rnd(uv * uRes + uTime) - 0.5) * uGrain * (0.4 + c);
  gl_FragColor = vec4(max(c, 0.0), 1.0);
}`
};
class Post {
  constructor(game) {
    const r = game.renderer; this.g = game;
    this.composer = new EffectComposer(r, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }));
    this.rp = new RenderPass(game.scene, game.camera); this.composer.addPass(this.rp);
    this.bokeh = new BokehPass(game.scene, game.camera, { focus: 8, aperture: 0.004, maxblur: 0.012 }); this.bokeh.enabled = false; this.composer.addPass(this.bokeh);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.5, 0.9); this.composer.addPass(this.bloom);
    this.fx = new ShaderPass(FXShader); this.composer.addPass(this.fx);
    this.composer.addPass(new OutputPass());
  }
  setSize(w, h, pr) { this.composer.setPixelRatio(pr); this.composer.setSize(w, h); this.bloom.resolution.set(w * pr / 2, h * pr / 2); this.fx.uniforms.uRes.value.set(w * pr, h * pr); }
  render(scene, cam, dt, o = {}) {
    this.rp.scene = scene; this.rp.camera = cam; this.bokeh.scene = scene; this.bokeh.camera = cam;
    const u = this.fx.uniforms; u.uTime.value = (u.uTime.value + dt) % 100; u.uBlur.value = o.blur || 0; u.uRays.value = o.rays || 0; u.uFilter.value = o.filter || 0; u.uVig.value = o.vig ?? 0.35; u.uGrain.value = o.grain ?? 0.035;
    if (o.sun) u.uSun.value.copy(o.sun);
    this.bokeh.enabled = !!o.dof; if (o.dof) { this.bokeh.uniforms.focus.value = o.dof.focus; this.bokeh.uniforms.aperture.value = o.dof.aperture; this.bokeh.uniforms.maxblur.value = o.dof.maxblur ?? 0.012; }
    this.bloom.strength = o.bloom ?? 0.55;
    this.composer.render(dt);
  }
}

/* =====================================================================
   Garage — 3D-витрина: подиум, софтбоксы, отражения, глубина резкости
   ===================================================================== */
class Garage {
  constructor(game) {
    this.g = game; const sc = this.scene = new THREE.Scene(); sc.background = new THREE.Color(0x0b0d12);
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 200); this.ang = 0.7; this.elev = 0.22; this.dist = 9.5; this.auto = true;
    const env = new THREE.Scene(); env.background = new THREE.Color(0x05060a);
    const panel = (w, h, x, y, z, i) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(i, i, i * 1.04), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0.5, 0); env.add(m); };
    panel(14, 3, 0, 9, 0, 3); panel(3, 6, 9, 4, 3, 2); panel(3, 6, -9, 4, -3, 2); panel(10, 2, 0, 3, -10, 1.2); panel(10, 2, 0, 3, 10, 1.4);
    const pm = new THREE.PMREMGenerator(game.renderer); this.envTex = pm.fromScene(env, 0.02).texture; pm.dispose(); sc.environment = this.envTex;
    const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x14161b, roughness: 0.34, metalness: 0.3 })); floor.receiveShadow = true; sc.add(floor);
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.7, 0.18, 64), new THREE.MeshStandardMaterial({ color: 0x1d2027, roughness: 0.25, metalness: 0.6 })); pod.position.y = 0.09; pod.receiveShadow = true; sc.add(pod);
    if (game.quality.post > 0) {
      const pr = Math.min(window.devicePixelRatio || 1, 1.5), refl = new Reflector(new THREE.CircleGeometry(3.55, 64), { textureWidth: Math.round(innerWidth * pr * 0.6), textureHeight: Math.round(innerHeight * pr * 0.6), color: 0x8a8d94 });
      refl.rotation.x = -Math.PI / 2; refl.position.y = 0.181; sc.add(refl);
      const gloss = new THREE.Mesh(new THREE.CircleGeometry(3.55, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x0b0c10, roughness: 0.25, metalness: 0.2, transparent: true, opacity: 0.55 })); gloss.position.y = 0.183; sc.add(gloss);
    }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.66, 0.025, 8, 96).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.8, 0.9) })); ring.position.y = 0.17; sc.add(ring);
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(22, 22, 14, 64, 1, true), new THREE.MeshStandardMaterial({ color: 0x0d0f14, roughness: 0.8, side: THREE.BackSide })); wall.position.y = 7; sc.add(wall);
    for (let i = 0; i < 3; i++) { const sb = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.2), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.2, 2.3) })); sb.position.set((i - 1) * 6, 7.5, -3 + i); sb.rotation.x = Math.PI / 2; sc.add(sb); }
    const key = new THREE.SpotLight(0xffffff, 60, 40, 0.6, 0.8, 1.6); key.position.set(4, 8, 5); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0006; key.shadow.normalBias = 0.025; sc.add(key);
    const rim = new THREE.SpotLight(0xbfd2ff, 55, 40, 0.7, 0.8, 1.6); rim.position.set(-6, 5, -5); sc.add(rim);
    sc.add(new THREE.HemisphereLight(0x8090a8, 0x101012, 0.4));
    this.holder = new THREE.Group(); this.holder.position.y = 0.18; sc.add(this.holder);
    const cv = game.renderer.domElement; let drag = null;
    cv.addEventListener('pointerdown', e => { if (game.state !== 'garage') return; drag = { x: e.clientX, y: e.clientY }; this.auto = false; });
    addEventListener('pointermove', e => { if (!drag) return; this.ang -= (e.clientX - drag.x) * 0.008; this.elev = clamp(this.elev + (e.clientY - drag.y) * 0.004, 0.02, 0.8); drag = { x: e.clientX, y: e.clientY }; });
    addEventListener('pointerup', () => { drag = null; });
    cv.addEventListener('wheel', e => { if (game.state === 'garage') this.dist = clamp(this.dist + e.deltaY * 0.005, 6, 15); }, { passive: true });
  }
  show(carId) {
    if (this.car) { this.car.dispose(); this.car = null; }
    const t = tuneOf(carId), col = t.color ? COLORS.find(c => c.id === t.color)?.hex : undefined;
    this.car = new CarVisual(CARS[carId], { color: col, finish: t.finish, tint: t.tint, rims: t.rims, beacon: t.beacon, flag: t.flag, plate: plateOf(this.g.roleId), lightFx: true, modelId: carId });
    this.car.root.traverse(o => { if (o.isMesh) o.castShadow = true; }); this.holder.add(this.car.root); this.carId = carId;
  }
  frame(dt) {
    if (this.auto) this.ang += dt * 0.25; this.holder.rotation.y += dt * 0.05;
    if (this.car) this.car.animate(dt, { vL: 0, aL: 0, latA: 0, steer: 0.25, brake: false, rev: false, lights: false });
    const c = this.camera, d = this.dist, w = innerWidth, h = innerHeight, sh = document.querySelector('#garage .sheet');
    if (sh && !$('garage').hidden) { const r = sh.getBoundingClientRect(); if (r.left > 10 && r.width < w * 0.9) c.setViewOffset(w + r.width, h, r.width, 0, w, h); else if (r.top > 10) c.setViewOffset(w, h + (h - r.top), 0, h - r.top, w, h); else c.clearViewOffset(); }
    c.position.set(Math.sin(this.ang) * d * Math.cos(this.elev), 1.0 + Math.sin(this.elev) * d, Math.cos(this.ang) * d * Math.cos(this.elev)); c.lookAt(0, 0.75, 0);
  }
}

/* =====================================================================
   PhotoMode — пауза, свободная камера, фильтры, DOF, сохранение PNG
   ===================================================================== */
class PhotoMode {
  constructor(game) {
    this.g = game; this.on = false; this.filter = 0; this.ang = 0.8; this.elev = 0.25; this.dist = 9; this.dof = 0.4; this.hidden = false;
    const cv = game.renderer.domElement; let drag = null, pinch = null; const pts = new Map();
    cv.addEventListener('pointerdown', e => { if (!this.on) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); drag = { x: e.clientX, y: e.clientY }; });
    addEventListener('pointermove', e => {
      if (!this.on || !pts.has(e.pointerId)) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch) this.dist = clamp(this.dist - (d - pinch) * 0.02, 3, 30); pinch = d; return; }
      if (drag) { this.ang -= (e.clientX - drag.x) * 0.008; this.elev = clamp(this.elev + (e.clientY - drag.y) * 0.004, -0.05, 1.3); drag = { x: e.clientX, y: e.clientY }; }
    });
    const up = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (!pts.size) drag = null; };
    addEventListener('pointerup', up); addEventListener('pointercancel', up);
    cv.addEventListener('wheel', e => { if (this.on) this.dist = clamp(this.dist + e.deltaY * 0.01, 3, 30); }, { passive: true });
    $('phFilter').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; this.filter = +b.dataset.f; this.sync(); });
    $('phDof').addEventListener('input', e => { this.dof = +e.target.value; });
    $('phHide').onclick = () => { this.hidden = true; $('photoUI').hidden = true; $('photoHint').textContent = 'Нажмите на экран, чтобы вернуть панель'; };
    cv.addEventListener('click', () => { if (this.on && this.hidden) { this.hidden = false; $('photoUI').hidden = false; $('photoHint').textContent = 'Тяните, чтобы вращать камеру · колесо или щипок — зум'; } });
    $('phExit').onclick = () => this.toggle(false);
    $('phSave').onclick = () => this.save();
    $('shotOk').onclick = () => { $('shot').hidden = true; };
  }
  sync() { for (const b of $('phFilter').querySelectorAll('button')) b.setAttribute('aria-pressed', String(+b.dataset.f === this.filter)); }
  toggle(force) {
    const g = this.g; if (!['play', 'count', 'result', 'free'].includes(g.state) && !this.on) return;
    if (!Store.data.photo && !this.on) { g.ui.toast('Режим фото открывается в меню паузы за 800 очков', ''); return; }
    const on = force === undefined ? !this.on : force; if (on === this.on) return; this.on = on;
    if (on) { this.wasPaused = g.paused; g.paused = true; g.audio.setPaused(true); g.ui.hideAll(); this.ang = g.player.h + Math.PI + 0.7; $('photoUI').hidden = false; $('photoHint').hidden = false; $('hud').hidden = true; $('touch').hidden = true; this.sync(); }
    else { $('photoUI').hidden = true; $('photoHint').hidden = true; $('hud').hidden = false; $('touch').hidden = !isTouch; g.paused = false; g.audio.setPaused(false); g.last = performance.now(); if (this.wasPaused && (g.state === 'play' || g.state === 'free')) g.togglePause(true); }
  }
  camera(cam, P) {
    const d = this.dist; cam.position.set(P.x + Math.sin(this.ang) * d * Math.cos(this.elev), P.y + 1 + Math.sin(this.elev) * d, P.z + Math.cos(this.ang) * d * Math.cos(this.elev)); cam.lookAt(P.x, P.y + 0.8, P.z);
    return { focus: d, aperture: 0.0002 + this.dof * 0.012, maxblur: 0.02 };
  }
  save() {
    const g = this.g; g.renderFrame(0, 1, true);
    let url = ''; try { url = g.renderer.domElement.toDataURL('image/png'); } catch (e) { g.ui.toast('Не удалось сохранить снимок', 'bad'); return; }
    try { const a = document.createElement('a'); a.href = url; a.download = 'kortezh-' + Date.now() + '.png'; document.body.appendChild(a); a.click(); a.remove(); } catch (e) { /* загрузка может быть запрещена */ }
    $('shotImg').src = url; $('shot').hidden = false;
  }
}

/* =====================================================================
   Replay — запись лучшей поездки и воспроизведение с киношной камерой
   ===================================================================== */
class Replay {
  constructor(game) { this.g = game; this.rec = null; this.play = null; }
  start() { this.rec = { f: [], t: 0 }; }
  record(dt) {
    if (!this.rec) return; this.rec.t += dt; if (this.rec.t < 0.1) return; this.rec.t = 0;
    const g = this.g, P = g.player, r = v => Math.round(v * 100) / 100;
    this.rec.f.push([r(P.x), r(P.z), Math.round(P.h * 1000) / 1000, r(P.vL), Math.round(P.steer * 100) / 100, Math.round(g.link * 100) / 100, ...g.escorts.map(e => r(e.s))]);
  }
  pack(meta) { return { ...meta, frames: this.rec ? this.rec.f : [] }; }
  begin(data) { this.play = { data, t: 0, shot: 0, shotT: 0, n: data.frames.length }; }
  frameAt(t) { const d = this.play.data.frames, f = t / 0.1, i = Math.min(d.length - 2, Math.floor(f)), k = clamp(f - i, 0, 1); return { a: d[Math.max(0, i)], b: d[Math.max(0, i + 1)], k, end: f >= d.length - 1 }; }
  shotCam(cam, dt, P) {
    const pl = this.play; pl.shotT -= dt; if (pl.shotT <= 0) { pl.shot = (pl.shot + 1) % 5; pl.shotT = 4.5; pl.anchor = { x: P.x + Math.sin(P.h) * 30 + Math.cos(P.h) * 9, z: P.z + Math.cos(P.h) * 30 - Math.sin(P.h) * 9 }; pl.orb = Math.random() * 6; }
    const fx = Math.sin(P.h), fz = Math.cos(P.h), rx = -fz, rz = fx;
    switch (pl.shot) {
      case 0: cam.position.set(P.x + rx * 4.5 - fx * 1, P.y + 0.7, P.z + rz * 4.5 - fz * 1); cam.lookAt(P.x + fx * 2, P.y + 0.8, P.z + fz * 2); break;
      case 1: cam.position.set(P.x + fx * 9, P.y + 1.3, P.z + fz * 9); cam.lookAt(P.x, P.y + 0.9, P.z); break;
      case 2: cam.position.set(pl.anchor.x, P.y + 1.4, pl.anchor.z); cam.lookAt(P.x, P.y + 0.8, P.z); break;
      case 3: pl.orb += dt * 0.35; cam.position.set(P.x + Math.sin(pl.orb) * 11, P.y + 4, P.z + Math.cos(pl.orb) * 11); cam.lookAt(P.x, P.y + 0.6, P.z); break;
      default: cam.position.set(P.x - fx * 16, P.y + 22, P.z - fz * 16); cam.lookAt(P.x + fx * 6, P.y, P.z + fz * 6);
    }
  }
}

/* =====================================================================
   CallUI — срочный звонок начальника, мини-диалог
   ===================================================================== */
class CallUI {
  constructor(game) { this.g = game; this.cur = null; }
  open(c) {
    const g = this.g; this.cur = c; this.t = 12; g.audio.ring();
    $('callWho').textContent = c.who; $('callText').textContent = c.text;
    $('callBtns').innerHTML = c.opts.map((o, i) => `<button class="btn sm" type="button" data-i="${i}">${isTouch ? '' : (i + 1) + ' · '}${o[0]}</button>`).join('');
    $('callBtns').onclick = e => { const b = e.target.closest('button'); if (b) this.answer(+b.dataset.i); };
    $('call').hidden = false;
  }
  answer(i) {
    if (!this.cur) return; const o = this.cur.opts[i]; if (!o) return; const fx = o[1], g = this.g;
    if (fx.rep) g.rep = clamp(g.rep + fx.rep, 0, 100); if (fx.time) g.penalty -= fx.time; if (fx.link) g.link = Math.min(1, g.link + fx.link);
    g.ui.toast(fx.time ? `Совещание сдвинули · +${fx.time} с` : fx.rep >= 0 ? 'Начальник доволен ответом' : 'Начальник недоволен · репутация ' + fx.rep, fx.rep >= 0 ? 'good' : 'bad');
    g.unlockAch('call'); this.close();
  }
  close(silent) { if (!this.cur) return; this.cur = null; $('call').hidden = true; }
  step(dt) { if (!this.cur) return; this.t -= dt; $('callTimer').style.transform = `scaleX(${clamp(this.t / 12, 0, 1)})`; if (this.t <= 0) { this.g.rep = Math.max(0, this.g.rep - 6); this.g.ui.toast('Вы не ответили на звонок · репутация −6', 'bad'); this.close(); } }
}
