
/* =====================================================================
   CarVisual — готовая 3D-машина: кузов, колёса, номера, оснастка, повреждения
   ===================================================================== */
const SHARED_MATS = () => new Set(Object.values(MAT));
// швы кузова (двери, капот, багажник) и пластиковый обвес — прямо в шейдере краски
let PANEL_ID = 0;
function applyPanels(mat, P) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uDoor = { value: new THREE.Vector4(P.doors[0], P.doors[1], P.doors[2], P.belt) };
    sh.uniforms.uHood = { value: new THREE.Vector4(P.hoodZ, P.hoodX, P.trunkZ, P.trunkX) };
    sh.uniforms.uMisc = { value: new THREE.Vector4(P.bot, P.tailX, P.clad, 0) };
    sh.uniforms.uArch = { value: new THREE.Vector4(...P.arch) };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLP; varying vec3 vON;').replace('#include <begin_vertex>', '#include <begin_vertex>\n vLP = position; vON = normal;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vLP; varying vec3 vON; uniform vec4 uDoor; uniform vec4 uHood; uniform vec4 uMisc; uniform vec4 uArch;
float seam(float d){ float w = max(0.004, fwidth(d) * 0.9); return (1.0 - smoothstep(w * 0.5, w * 1.5, abs(d))) * clamp(0.012 / max(fwidth(d), 1e-4), 0.0, 1.0); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
  float sideN = step(0.5, abs(vON.x)), topN = step(0.55, vON.y), backN = step(0.55, -vON.z);
  float inDoor = sideN * step(uMisc.x, vLP.y) * step(vLP.y, uDoor.w);
  float ln = inDoor * max(max(seam(vLP.z - uDoor.x), seam(vLP.z - uDoor.y)), seam(vLP.z - uDoor.z));
  ln = max(ln, inDoor * seam(vLP.y - uMisc.x) * step(uDoor.z, vLP.z) * step(vLP.z, uDoor.x));
  ln = max(ln, topN * step(uHood.x, vLP.z) * seam(abs(vLP.x) - uHood.y));
  ln = max(ln, topN * step(abs(vLP.x), uHood.y) * seam(vLP.z - uHood.x));
  ln = max(ln, topN * step(vLP.z, uHood.z) * seam(abs(vLP.x) - uHood.w));
  ln = max(ln, topN * step(abs(vLP.x), uHood.w) * seam(vLP.z - uHood.z));
  ln = max(ln, backN * step(uMisc.x + 0.15, vLP.y) * step(0.01, uMisc.y) * seam(abs(vLP.x) - uMisc.y));
  float clad = step(0.01, uMisc.z) * (1.0 - step(uMisc.z, vLP.y));
  if (uArch.w > 0.0) { float da = min(length(vec2(vLP.z - uArch.x, vLP.y - uArch.z)), length(vec2(vLP.z - uArch.y, vLP.y - uArch.z))); clad = max(clad, (1.0 - step(uArch.w, da)) * step(0.4, abs(vON.x) + abs(vON.y) * 0.0)); }
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.03), clad);
  diffuseColor.rgb *= 1.0 - 0.8 * ln;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  roughnessFactor = mix(roughnessFactor, 0.75, clad);`)
      .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
  #ifdef USE_CLEARCOAT
    material.clearcoat *= 1.0 - clad;
  #endif`);
  };
  const key = 'panels' + (++PANEL_ID); mat.customProgramCacheKey = () => key;
}
let SHADOW_TEX = null;
function shadowTex() { if (!SHADOW_TEX) { const c = makeCanvas(64, 128), g = c.getContext('2d'), gr = g.createRadialGradient(32, 64, 6, 32, 64, 64); gr.addColorStop(0, 'rgba(0,0,0,.85)'); gr.addColorStop(0.55, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 128); SHADOW_TEX = new THREE.CanvasTexture(c); } return SHADOW_TEX; }
function shadowGeo(L, W) { return new THREE.PlaneGeometry(W + 0.9, L + 1.1).rotateX(-Math.PI / 2).translate(0, 0.03, 0); }

class CarVisual {
  constructor(spec, o = {}) {
    this.opts = o;
    this.spec = spec; this.o = o;
    this.root = new THREE.Group(); this.root.rotation.order = 'YXZ';
    this.body = new THREE.Group(); this.inner = new THREE.Group();
    this.body.position.y = 0.5; this.inner.position.y = -0.5; this.body.add(this.inner); this.root.add(this.body);
    const M = carModel(spec, { armored: spec.armored, kindKey: o.kindKey });
    this.model = M; this.ws = M.ws; this.roofTop = M.roofTop; this.roofMid = M.roofMid; this.he = M.hl; this.belt = M.TOP(M.cU1);
    this.paint = paintMat(o.color ?? spec.color ?? 0x07080a, o.finish ?? spec.finish ?? 'f_gloss');
    this.paint2 = paintMat(spec.color2 ?? 0x15161a, 'f_gloss');
    this.glassMat = MAT.glass.clone(); this.glassMat.transparent = true; this.headMat = MAT.head.clone(); this.drlMat = MAT.drl.clone(); this.amberMat = MAT.amber.clone();
    this.tailMat = new THREE.MeshPhysicalMaterial({ color: 0x5a0408, emissive: 0xff1a12, emissiveIntensity: 0.55, roughness: 0.15, clearcoat: 1 });
    this.revMat = new THREE.MeshStandardMaterial({ color: 0x8a8a8a, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.2 });
    const mats = { paint: this.paint, paint2: this.paint2, glass: this.glassMat, chrome: MAT.chrome, black: MAT.black, dark: MAT.dark, head: this.headMat, drl: this.drlMat, tail: this.tailMat, rev: this.revMat, amber: this.amberMat, stripe: MAT.stripe, well: MAT.well };
    this.ownGeo = []; this.ownMat = [this.paint, this.paint2, this.glassMat, this.headMat, this.drlMat, this.amberMat, this.tailMat, this.revMat];
    for (const k in mats) {
      const list = M.G[k]; if (!list || !list.length) continue;
      const geo = merge(list), m = new THREE.Mesh(geo, mats[k]); this.ownGeo.push(geo);
      m.castShadow = !['head', 'drl', 'tail', 'rev', 'amber', 'well'].includes(k); m.receiveShadow = k === 'paint' || k === 'paint2';
      this.inner.add(m); if (k === 'paint') this.bodyMesh = m;
    }
    this.bodyOrig = Float32Array.from(this.bodyMesh.geometry.attributes.position.array);
    applyPanels(this.paint, M.panel); applyPanels(this.paint2, M.panel);
    this.shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex(), transparent: true, depthWrite: false, opacity: 0.85, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }); this.ownMat.push(this.shadowMat);
    const sg = shadowGeo(spec.L, spec.W); this.ownGeo.push(sg); const sh = new THREE.Mesh(sg, this.shadowMat); sh.renderOrder = 2; this.root.add(sh);
    if (!o.interior) this.addCabin();
    this.wheels = []; this.setRims(o.rims || null);
    if (o.plate) this.setPlate(o.plate);
    if (spec.badge && !o.police && !o.pss) this.addBadge(spec.badge, M.G.badge);
    this.isPolice = !!o.police; if (o.police) this.addPolice(); if (o.pss) this.addPss();
    if (o.interior) this.addInterior();
    this.setBeacon(!!o.beacon); this.setFlag(!!o.flag); this.setTint(o.tint || 't_mid');
    this.wheelRot = 0; this.pitch = 0; this.roll = 0; this.pv = 0; this.rv = 0; this.t = 0;
    if (o.modelId) this.tryModel(o.modelId);
  }
  setPaint(hex, finish) {
    this.pendingPaint = [hex, finish]; for (const m of this.modelPaint || []) { if (m.color) m.color.setHex(hex); }
    const f = FINISH_PROPS[finish] || FINISH_PROPS.f_gloss; this.paint.color.setHex(hex);
    Object.assign(this.paint, { metalness: f.metalness, roughness: f.roughness, clearcoat: f.clearcoat }); this.paint.needsUpdate = true;
  }
  setTint(id) { const k = { t_factory: 0x2a3540, t_mid: 0x0d1117, t_limo: 0x020304 }[id] ?? 0x0d1117; this.glassMat.color.setHex(k); this.glassMat.opacity = { t_factory: 0.62, t_mid: 0.8, t_limo: 0.94 }[id] ?? 0.8; for (const g of this.modelGlass || []) g.opacity = this.glassMat.opacity * 0.92; this.tintK = { t_factory: 0, t_mid: 0.3, t_limo: 0.55 }[id] ?? 0.3; }
  setRims(id) {
    for (const w of this.wheels) this.root.remove(w.pivot);
    const s = this.spec, style = (id && RIM_STYLE[id]) || s.rims || 'twin', mat = MAT[(id && RIM_MAT[id]) || (s.armored ? 'rimDark' : style === 'steel' ? 'rimSteel' : 'rimChrome')];
    const tx = s.W / 2 - s.tire / 2 - 0.035; this.wheels = [];
    for (const [x, z, front] of [[tx, this.model.fz, 1], [-tx, this.model.fz, 1], [tx, this.model.rz, 0], [-tx, this.model.rz, 0]]) {
      const w = makeWheel(s, Math.sign(x), style, { rim: mat }); w.pivot.position.set(x, s.wr, z); w.front = front; this.root.add(w.pivot); this.wheels.push(w);
    }
  }
  setPlate(p) {
    const P = this.model.G;
    if (!this.plateMesh) {
      const pg = new THREE.PlaneGeometry(0.52, 0.115);
      this.plateMat = new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.1 }); this.ownMat.push(this.plateMat);
      const pf = new THREE.Mesh(pg, this.plateMat); pf.position.set(0, P.plateF.y, P.plateF.z);
      const pr = new THREE.Mesh(pg, this.plateMat); pr.position.set(0, P.plateR.y, P.plateR.z); pr.rotation.y = Math.PI;
      this.inner.add(pf, pr); this.plateMesh = [pf, pr]; this.ownGeo.push(pg);
      const fg = new THREE.PlaneGeometry(0.56, 0.15); this.ownGeo.push(fg);
      for (const [m, dz] of [[pf, -0.004], [pr, 0.004]]) { const fr = new THREE.Mesh(fg, MAT.black); fr.position.copy(m.position); fr.position.z += dz; fr.rotation.copy(m.rotation); this.inner.add(fr); }
    }
    if (this.plateMat.map) this.plateMat.map.dispose();
    this.plateMat.map = plateTexture(p); this.plateMat.needsUpdate = true;
  }
  addBadge(text, b) {
    const c = makeCanvas(512, 96), g = c.getContext('2d'); g.font = '700 64px Arial, Helvetica, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const gr = g.createLinearGradient(0, 20, 0, 80); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, '#9aa0a8'); gr.addColorStop(1, '#e8ebef');
    g.lineWidth = 6; g.strokeStyle = 'rgba(20,22,26,.9)'; g.strokeText(text, 256, 50); g.fillStyle = gr; g.fillText(text, 256, 50);
    const w = Math.min(0.62, g.measureText(text).width / 512 * 0.62 * 1.3), mat = new THREE.MeshStandardMaterial({ map: texFrom(c), transparent: true, alphaTest: 0.3, metalness: 0.8, roughness: 0.25 }); this.ownMat.push(mat);
    const geo = new THREE.PlaneGeometry(0.62, 0.116); this.ownGeo.push(geo); const m = new THREE.Mesh(geo, mat); m.position.set(b.x, b.y, b.z); m.rotation.y = Math.PI; m.scale.setScalar(text.length > 8 ? 1 : 0.62); this.inner.add(m);
  }
  lightbar(y, z, w, blueOnly) {
    const base = new THREE.Mesh(rbox(w, 0.06, 0.28, 0.02, 0, y + 0.03, z), MAT.dark); this.inner.add(base); this.ownGeo.push(base.geometry);
    this.redMat = new THREE.MeshStandardMaterial({ color: blueOnly ? 0x001455 : 0x550008, emissive: blueOnly ? 0x1a5cff : 0xff1030, emissiveIntensity: 0.2, roughness: 0.15 });
    this.blueMat = new THREE.MeshStandardMaterial({ color: 0x001455, emissive: 0x1a5cff, emissiveIntensity: 0.2, roughness: 0.15 });
    this.ownMat.push(this.redMat, this.blueMat);
    const lg = rbox(w / 2 - 0.04, 0.1, 0.24, 0.03, 0, 0, 0); this.ownGeo.push(lg);
    const red = new THREE.Mesh(lg, this.redMat); red.position.set(w / 4, y + 0.1, z);
    const blue = new THREE.Mesh(lg, this.blueMat); blue.position.set(-w / 4, y + 0.1, z);
    this.inner.add(red, blue); this.lightbarMeshes = [base, red, blue];
  }
  addPolice() {
    const s = this.spec, M = this.model;
    this.lightbar(this.roofTop, this.roofMid, 1.2, false);
    for (const [a, b] of [[-0.3, 0.02], [Math.PI - 0.02, Math.PI + 0.3]]) { const g = loftGeo(40, 3, M.sec, 0.07, 0.93, M.zf, a, b, { grow: 1.005 }); this.ownGeo.push(g); this.inner.add(new THREE.Mesh(g, MAT.stripe)); }
    const c = makeCanvas(512, 128), g = c.getContext('2d');
    g.fillStyle = '#1d4fc4'; g.font = '900 86px Arial, sans-serif'; g.textBaseline = 'middle'; g.fillText('ЙПХ', 16, 66);
    g.font = '800 40px Arial, sans-serif'; g.fillText('102', 300, 68);
    const dm = new THREE.MeshStandardMaterial({ map: texFrom(c), transparent: true, roughness: 0.4 }); this.ownMat.push(dm); this.policeDecal = dm;
    const dg = new THREE.PlaneGeometry(1.2, 0.3); this.ownGeo.push(dg); const y = this.belt - 0.2, u = 0.48;
    for (const sd of [1, -1]) { const d = new THREE.Mesh(dg, dm); d.position.set(sd * (M.bx(u, y) + 0.012), y, M.zf(u)); d.rotation.y = sd * Math.PI / 2; this.inner.add(d); }
    this.addStrobes();
  }
  addPss() { this.lightbar(this.roofTop, this.roofMid + 0.4, 0.7, true); this.addStrobes(true); }
  addStrobes(blue) {
    const s = this.spec, M = this.model, y = M.TOP(0.985) - 0.25, z = M.zf(1) + 0.01, sg = new THREE.BoxGeometry(0.1, 0.04, 0.03); this.ownGeo.push(sg);
    const a = new THREE.Mesh(sg, blue ? this.blueMat : this.redMat); a.position.set(0.22, y, z); const b = new THREE.Mesh(sg, this.blueMat); b.position.set(-0.22, y, z); this.inner.add(a, b);
  }
  // проблесковый маячок: магнитное основание, прозрачный купол, две группы светодиодов, свечение
  setBeacon(on) {
    if (on && !this.beacon) {
      const b = this.beacon = new THREE.Group(), own = (geo, mat) => { const m = new THREE.Mesh(geo, mat); this.ownGeo.push(geo); b.add(m); return m; };
      const baseM = new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.55 }), domeM = new THREE.MeshPhysicalMaterial({ color: 0x2a55ff, transparent: true, opacity: 0.42, roughness: 0.05, metalness: 0, clearcoat: 1, depthWrite: false });
      this.ownMat.push(baseM, domeM);
      own(new THREE.CylinderGeometry(0.082, 0.09, 0.028, 24), baseM).position.y = 0.014;
      const dome = own(new THREE.SphereGeometry(0.078, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), domeM); dome.scale.y = 1.35; dome.position.y = 0.028; dome.renderOrder = 3;
      this.beaconLeds = [];
      for (const sd of [1, -1]) {
        const lm = new THREE.MeshStandardMaterial({ color: 0x10205a, emissive: 0x2d6bff, emissiveIntensity: 0.2, toneMapped: false }); this.ownMat.push(lm);
        const led = own(new THREE.BoxGeometry(0.05, 0.055, 0.03), lm); led.position.set(sd * 0.03, 0.06, 0); led.rotation.y = sd * 0.5;
        const sm = new THREE.SpriteMaterial({ map: glowTex(), color: 0x4a7dff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }); this.ownMat.push(sm);
        const sp = new THREE.Sprite(sm); sp.position.set(sd * 0.04, 0.07, 0); sp.scale.setScalar(0.9); sp.renderOrder = 4; b.add(sp);
        this.beaconLeds.push({ lm, sm, sp, ph: sd > 0 ? 0 : 0.5 });
      }
      if (this.opts.lightFx) { this.beaconLight = new THREE.PointLight(0x3b6dff, 0, 16, 2); this.beaconLight.position.y = 0.12; b.add(this.beaconLight); }
      // скрытые стробоскопы в решётке радиатора
      this.strobes = [];
      for (const sd of [1, -1]) { const sm = new THREE.SpriteMaterial({ map: glowTex(), color: 0x3f74ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }); this.ownMat.push(sm); const sp = new THREE.Sprite(sm); sp.scale.setScalar(0.55); this.strobes.push({ sp, sm, sd }); }
      this.placeBeacon();
    }
    if (this.beacon) { this.beacon.visible = on; for (const s of this.strobes) s.sp.visible = on; if (this.beaconLight) this.beaconLight.intensity = 0; }
  }
  placeBeacon() {
    const F = this.fit, b = this.beacon; if (!b) return;
    if (F) { this.root.add(b); b.position.copy(F.beacon); for (const s of this.strobes) { this.root.add(s.sp); s.sp.position.set(s.sd * F.strobe.x, F.strobe.y, F.strobe.z); } }
    else { this.inner.add(b); b.position.set(0.32, this.roofTop - 0.005, this.roofMid + 0.3); const M = this.model, u = 0.985, y = this.belt - 0.32; for (const s of this.strobes) { this.inner.add(s.sp); s.sp.position.set(s.sd * 0.45, y, M.zf(u) + 0.06); } }
  }
  // флажки Узбекистана на обоих передних крыльях: древко с навершием и полотно, которое реально развевается
  setFlag(on) {
    if (on && !this.flagG) {
      this.flagG = new THREE.Group(); this.flags = [];
      const fm = new THREE.MeshStandardMaterial({ map: uzFlagTex(), side: THREE.DoubleSide, roughness: 0.85 }); this.ownMat.push(fm);
      const gold = new THREE.MeshStandardMaterial({ color: 0xd8b25a, metalness: 1, roughness: 0.25 }); this.ownMat.push(gold);
      for (const sd of [1, -1]) {
        const f = new THREE.Group(), add = (geo, mat, y) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; this.ownGeo.push(geo); f.add(m); m.castShadow = true; return m; };
        add(new THREE.CylinderGeometry(0.02, 0.026, 0.03, 12), MAT.chrome, 0.015);
        add(new THREE.CylinderGeometry(0.0055, 0.0075, 0.5, 8), MAT.chrome, 0.27);
        add(new THREE.SphereGeometry(0.014, 12, 8), gold, 0.525);
        const W = 0.36, H = 0.18, geo = new THREE.PlaneGeometry(W, H, 24, 10); geo.translate(W / 2, 0, 0); this.ownGeo.push(geo);
        const cloth = new THREE.Mesh(geo, fm); cloth.position.y = 0.505 - H / 2; cloth.rotation.y = Math.PI / 2; cloth.castShadow = true; f.add(cloth);
        this.flags.push({ g: f, cloth, base: Float32Array.from(geo.attributes.position.array), W, H, sd, ph: sd * 1.7 });
        this.flagG.add(f);
      }
      this.placeFlags();
    }
    if (this.flagG) this.flagG.visible = on;
  }
  placeFlags() {
    if (!this.flagG) return; const F = this.fit;
    if (F) { this.root.add(this.flagG); for (const f of this.flags) f.g.position.set(f.sd * F.flag.x, F.flag.y, F.flag.z); }
    else { this.inner.add(this.flagG); const M = this.model, u = 0.9, y = M.TOP(u); for (const f of this.flags) f.g.position.set(f.sd * (M.bx(u, y - 0.02) - 0.1), y - 0.01, M.zf(u)); }
  }
  animateFx(dt, st) {
    const t = this.t;
    if (this.beacon && this.beacon.visible) {
      let any = 0;
      for (const L of this.beaconLeds) { const a = flash2(t, L.ph); any = Math.max(any, a); L.lm.emissiveIntensity = a ? 9 : 0.25; L.sm.opacity = a * 0.95; L.sp.scale.setScalar(a ? 0.95 + Math.random() * 0.1 : 0.5); }
      for (const s of this.strobes) { const a = flash2(t * 1.15, s.sd > 0 ? 0.25 : 0.75, 0.5); s.sm.opacity = a * 0.9; }
      if (this.beaconLight) this.beaconLight.intensity = any * 6;
    }
    if (this.flagG && this.flagG.visible && dt > 0) {
      const v = Math.abs(st.vL), wind = clamp((v + 1.2) / 14, 0, 1), droop = (1 - wind) * 1.15, cd = Math.cos(droop), sn = Math.sin(droop), w = 5 + 13 * wind;
      for (const f of this.flags) {
        const p = f.cloth.geometry.attributes.position, b = f.base, A = 0.012 + 0.03 * wind;
        for (let i = 0; i < p.count; i++) {
          const bx = b[i * 3], by = b[i * 3 + 1], u = bx / f.W;
          const z = Math.sin(u * 8.5 - t * w + f.ph + by * 4) * A * (0.15 + u) + Math.sin(u * 21 - t * w * 1.7 + by * 9) * 0.004 * wind * u;
          const x = bx * (1 - 0.05 * wind * u);
          p.array[i * 3] = x * cd + by * sn; p.array[i * 3 + 1] = by * cd - x * sn; p.array[i * 3 + 2] = z;
        }
        p.needsUpdate = true; f.cloth.geometry.computeVertexNormals();
      }
    }
  }
  addCabin() {
    const s = this.spec, M = this.model, belt = this.belt, wsz = this.ws, cw = s.W * s.cabW * 0.9, parts = [];
    parts.push(colored(box(cw - 0.14, 0.16, 0.45, 0, belt - 0.05, wsz - 0.62), 0x1c1a19));
    const rows = (M.cU1 - M.cU0) * s.L > 2.4 ? [wsz - 1.15, wsz - 2.05] : [wsz - 1.15];
    for (const z of rows) for (const sd of [1, -1]) { const top = Math.min(M.CAB(M.cU0 + (z - M.zf(M.cU0)) / s.L), this.roofTop) - 0.12; parts.push(colored(rbox(0.5, 0.62, 0.16, 0.05, sd * 0.38, top - 0.48, z, 0, -0.15), 0x2b2522)); parts.push(colored(rbox(0.26, 0.17, 0.12, 0.05, sd * 0.38, top - 0.1, z - 0.04), 0x2b2522)); }
    parts.push(colored(new THREE.TorusGeometry(0.17, 0.022, 6, 18).rotateX(0.35).translate(0.38, belt + 0.06, wsz - 0.78), 0x111111));
    const g = merge(parts); this.ownGeo.push(g); this.inner.add(new THREE.Mesh(g, MAT.vcol));
  }
  addInterior() {
    const s = this.spec, g = new THREE.Group(), M = this.model, cw = s.W * s.cabW * 0.92, belt = this.belt, wsz = this.ws;
    const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); this.ownGeo.push(geo); return m; };
    add(new THREE.BoxGeometry(cw - 0.14, 0.18, 0.5), MAT.leather, 0, belt - 0.04, wsz - 0.6);
    const scr = add(new THREE.PlaneGeometry(0.95, 0.15), new THREE.MeshBasicMaterial({ color: 0x18263e }), 0.12, belt + 0.07, wsz - 0.86); scr.rotation.set(-0.25, Math.PI, 0); this.ownMat.push(scr.material);
    this.wheelMesh = add(new THREE.TorusGeometry(0.18, 0.024, 8, 26), MAT.leather, 0.38, belt + 0.05, wsz - 0.8); this.wheelMesh.rotation.x = 0.35;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 12), MAT.chrome); hub.rotation.x = Math.PI / 2; this.wheelMesh.add(hub); this.ownGeo.push(hub.geometry);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.03, 0.02), MAT.leather); this.wheelMesh.add(bar); this.ownGeo.push(bar.geometry);
    add(new THREE.BoxGeometry(0.22, 0.3, 1.2), MAT.leather, 0, belt - 0.32, wsz - 1.25);
    for (const sd of [1, -1]) { const seat = add(new THREE.BoxGeometry(0.5, 0.62, 0.15), MAT.leather, sd * 0.4, belt - 0.12, wsz - 1.6); seat.rotation.x = -0.15; add(new THREE.BoxGeometry(0.26, 0.17, 0.12), MAT.leather, sd * 0.4, belt + 0.28, wsz - 1.66); }
    add(new THREE.BoxGeometry(0.26, 0.07, 0.02), MAT.chrome, 0, this.roofTop - 0.14, wsz - 0.75);
    this.inner.add(g); this.interior = g;
  }
  setPose(x, z, h, y = 0, slope = 0) { this.root.position.set(x, y, z); this.root.rotation.set(slope, h, 0); }
  animate(dt, st) {
    this.t += dt;
    this.wheelRot += st.vL / this.spec.wr * dt;
    for (const w of this.wheels) { w.spin.rotation.x = this.wheelRot; if (w.front) w.pivot.rotation.y = -st.steer; }
    const pT = clamp(-st.aL * 0.0055, -0.05, 0.05), rT = clamp(-st.latA * 0.0065, -0.06, 0.06);
    this.pv += ((pT - this.pitch) * 90 - this.pv * 11) * dt; this.pitch += this.pv * dt;
    this.rv += ((rT - this.roll) * 80 - this.rv * 10) * dt; this.roll += this.rv * dt;
    this.body.rotation.set(this.pitch, 0, this.roll);
    this.tailMat.emissiveIntensity = st.brake ? 4.5 : (st.lights ? 1.2 : 0.55);
    this.revMat.emissiveIntensity = st.rev ? 2.5 : 0;
    if (!this.lightsBroken) this.headMat.emissiveIntensity = st.lights ? 3 : 0.12;
    if (this.wheelMesh) this.wheelMesh.rotation.z = st.steer * 4;
    if (this.modelWheels) for (const w of this.modelWheels) { w.spin.rotation.x = this.wheelRot; if (w.front) w.pivot.rotation.y = -st.steer; }
    if (this.model3d) { this.model3d.rotation.set(this.pitch, 0, this.roll); for (const m of this.modelTail) m.emissiveIntensity = st.brake ? 3 : (st.lights ? 1 : 0.3); for (const m of this.modelHead) m.emissiveIntensity = st.lights ? 2.5 : 0.2; }
    this.animateFx(dt, st);
  }
  dent(wx, wy, wz, power) {
    const lp = this.inner.worldToLocal(new THREE.Vector3(wx, wy, wz)), pos = this.bodyMesh.geometry.attributes.position;
    const R = 0.5 + power * 0.03, amt = Math.min(0.14, power * 0.011), len = Math.hypot(lp.x, lp.z) || 1, ix = -lp.x / len, iz = -lp.z / len;
    for (let i = 0; i < pos.count; i++) {
      const dx = pos.getX(i) - lp.x, dy = pos.getY(i) - lp.y, dz = pos.getZ(i) - lp.z, d = Math.sqrt(dx * dx + dy * dy * 0.6 + dz * dz);
      if (d < R) { const f = (1 - d / R) ** 2; pos.setXYZ(i, pos.getX(i) + ix * amt * f, pos.getY(i) - amt * 0.3 * f, pos.getZ(i) + iz * amt * f); }
    }
    pos.needsUpdate = true; this.bodyMesh.geometry.computeVertexNormals();
    if (lp.z > this.he * 0.45 && power > 6) this.breakLights();
    if (power > 9) this.crackGlass();
  }
  breakLights() { this.lightsBroken = true; this.headMat.emissiveIntensity = 0.02; this.headMat.color.setHex(0x3a3d42); this.drlMat.emissiveIntensity = 0.05; }
  crackGlass() {
    if (this.glassCracked) return; this.glassCracked = true;
    if (!CRACK_TEX) { const c = makeCanvas(256, 256), g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256); g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 1.2; for (let k = 0; k < 4; k++) { const cx = Math.random() * 256, cy = Math.random() * 256; for (let i = 0; i < 14; i++) { const a = Math.random() * 6.28; g.beginPath(); g.moveTo(cx, cy); let x = cx, y = cy; for (let j = 0; j < 5; j++) { x += Math.cos(a + (Math.random() - 0.5)) * 18; y += Math.sin(a + (Math.random() - 0.5)) * 18; g.lineTo(x, y); } g.stroke(); } } CRACK_TEX = texFrom(c, { repeat: [3, 3] }); }
    this.glassMat.emissiveMap = CRACK_TEX; this.glassMat.emissive.setHex(0x8a9099); this.glassMat.emissiveIntensity = 0.5; this.glassMat.roughness = 0.35; this.glassMat.needsUpdate = true;
  }
  resetDamage() {
    this.bodyMesh.geometry.attributes.position.array.set(this.bodyOrig); this.bodyMesh.geometry.attributes.position.needsUpdate = true; this.bodyMesh.geometry.computeVertexNormals();
    this.lightsBroken = false; this.headMat.color.setHex(0x9aa4b0); this.drlMat.emissiveIntensity = 2.6;
    if (this.glassCracked) { this.glassCracked = false; this.glassMat.emissiveMap = null; this.glassMat.emissive.setHex(0); this.glassMat.roughness = 0.04; this.glassMat.needsUpdate = true; }
  }
  dispose() {
    this.disposed = true;
    this.root.parent && this.root.parent.remove(this.root);
    for (const g of this.ownGeo) g.dispose();
    for (const m of this.ownMat) { if (m.map && m.map !== UZ_FLAG_TEX && m.map !== GLOW_TEX) m.map.dispose(); m.dispose(); }
  }
}
let CRACK_TEX = null;

/* =====================================================================
   Настоящие 3D-модели (GLB): если в папке models/ лежит файл и он
   указан в models/models.json, процедурная машина заменяется моделью
   ===================================================================== */
const MODEL_CACHE = new Map(); let MODEL_CFG = null, LOADER = null;
const modelsAllowed = () => location.protocol.startsWith('http') && !/claude/i.test(location.hostname);
function modelCfg() {
  if (!MODEL_CFG) MODEL_CFG = modelsAllowed() ? fetch('models/models.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : {}).catch(() => ({})) : Promise.resolve({});
  return MODEL_CFG;
}
function gltfLoader() {
  if (!LOADER) { LOADER = new GLTFLoader(); const d = new DRACOLoader(); d.setDecoderPath('draco/'); LOADER.setDRACOLoader(d); LOADER.setMeshoptDecoder(MeshoptDecoder); }
  return LOADER;
}
const FILE_CACHE = new Map();
function loadCarModel(id) {
  if (!MODEL_CACHE.has(id)) MODEL_CACHE.set(id, modelCfg().then(cfg => {
    const c = cfg && cfg[id]; if (!c || !c.file) return null;
    if (!FILE_CACHE.has(c.file)) FILE_CACHE.set(c.file, new Promise(res => gltfLoader().load('models/' + c.file, g => res(g.scene), undefined, () => { console.warn('Модель не загрузилась: models/' + c.file); res(null); })));
    return FILE_CACHE.get(c.file).then(scene => scene ? { scene, cfg: c } : null);
  }));
  return MODEL_CACHE.get(id);
}
CarVisual.prototype.tryModel = function (id) {
  loadCarModel(id).then(m => { if (m && !this.disposed) this.useModel(m.scene, m.cfg); });
};
CarVisual.prototype.useModel = function (src, cfg) {
  const s = this.spec, model = src.clone(true), holder = new THREE.Group();
  model.rotation.y = THREE.MathUtils.degToRad(cfg.rotY || 0); holder.add(model); holder.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(holder), size = box.getSize(new THREE.Vector3());
  if (cfg.rotY === undefined && size.x > size.z * 1.15) { model.rotation.y = Math.PI / 2; holder.updateMatrixWorld(true); box = new THREE.Box3().setFromObject(holder); size = box.getSize(new THREE.Vector3()); }
  const k = (cfg.scale || 1) * s.L / Math.max(size.z, 1e-3); holder.scale.setScalar(k); holder.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(holder); const ctr = box.getCenter(new THREE.Vector3());
  holder.position.set(-ctr.x, -box.min.y + (cfg.y || 0), -ctr.z); holder.updateMatrixWorld(true);
  const paintRe = new RegExp(cfg.paint || 'paint|body|carpaint|car_paint|кузов', 'i'), tailRe = new RegExp(cfg.tail || 'tail|brake|stop|rear.?light|taillight', 'i'), headRe = new RegExp(cfg.head || 'head.?light|headlamp|front.?light', 'i'), glassRe = new RegExp(cfg.glass || 'glass|window|стекл', 'i');
  const cache = new Map();
  this.modelPaint = []; this.modelTail = []; this.modelHead = []; this.modelGlass = [];
  holder.traverse(o => {
    if (!o.isMesh) return; o.castShadow = true; o.receiveShadow = true;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const nm = mats.map(m => {
      if (cache.has(m)) return cache.get(m);
      const c = m.clone(); this.ownMat.push(c); cache.set(m, c); const n = m.name || '';
      // прозрачность через transmission дорогая (лишний проход рендера) — заменяем обычной
      if ((c.transmission > 0 || glassRe.test(n)) && !tailRe.test(n) && !headRe.test(n)) { c.transmission = 0; c.transparent = true; c.opacity = this.glassMat.opacity * 0.92; c.depthWrite = false; c.roughness = 0.04; c.metalness = 0.1; if (c.color) c.color.setHex(0x06080b); if (c.map) c.map = null; o.castShadow = false; this.modelGlass.push(c); }
      if (cfg.recolor) for (const [re, col] of Object.entries(cfg.recolor)) if (new RegExp(re, 'i').test(n) && c.color) { c.color.set(col); c.map = null; }
      if (paintRe.test(n)) this.modelPaint.push(c);
      if (tailRe.test(n)) { c.emissive = new THREE.Color(0xff1a12); this.modelTail.push(c); }
      if (headRe.test(n)) { c.emissive = new THREE.Color(0xffffff); this.modelHead.push(c); }
      if (c.envMapIntensity !== undefined) c.envMapIntensity = 1.3; return c;
    });
    o.material = Array.isArray(o.material) ? nm : nm[0];
  });
  this.root.add(holder); this.root.updateMatrixWorld(true);
  // колёса: узлы с «wheel/tire/rim» в имени получают свою ось вращения
  this.modelWheels = []; const wheelRe = new RegExp(cfg.wheels || 'wheel|tyre|tire|колес', 'i'), found = [];
  holder.traverse(o => { if (o !== holder && wheelRe.test(o.name) && !found.some(f => { let p = o.parent; while (p) { if (p === f) return true; p = p.parent; } return false; })) found.push(o); });
  for (const w of found.slice(0, 6)) {
    const wb = new THREE.Box3().setFromObject(w), wc = wb.getCenter(new THREE.Vector3()), pivot = new THREE.Group(), spin = new THREE.Group();
    if (wb.isEmpty()) continue;
    pivot.position.copy(this.root.worldToLocal(wc.clone())); pivot.add(spin); this.root.add(pivot); this.root.updateMatrixWorld(true); spin.attach(w);
    this.modelWheels.push({ pivot, spin, front: pivot.position.z > 0 });
  }
  this.model3d = holder;
  if (this.isPolice) this.modelLivery(holder);
  this.inner.visible = false; for (const w of this.wheels) w.pivot.visible = false;
  if (this.lightbarMeshes) { const top = new THREE.Box3().setFromObject(holder).max.y; for (const m of this.lightbarMeshes) { m.parent.remove(m); holder.parent.add(m); m.position.y += top - this.roofTop + 0.01; } }
  this.fitModel(holder); this.placeBeacon(); this.placeFlags();
  if (!cfg.keepColor) for (const c of this.modelPaint) { if (c.color) c.color.copy(this.paint.color); if (c.metalness !== undefined) { c.metalness = this.paint.metalness; c.roughness = this.paint.roughness; } }
  if (this.pendingPaint) this.setPaint(...this.pendingPaint);
};
// раскраска ДПС поверх настоящей модели: полоса и надписи проецируются на кузов
CarVisual.prototype.modelLivery = function (holder) {
  const r = this.root, pos = r.position.clone(), q = r.quaternion.clone(); r.position.set(0, 0, 0); r.quaternion.identity(); r.updateMatrixWorld(true);
  const meshes = []; holder.traverse(o => { if (o.isMesh && !(o.material && o.material.transparent)) meshes.push(o); });
  const box = new THREE.Box3().setFromObject(holder), H = box.max.y - box.min.y, L = box.max.z - box.min.z, rc = new THREE.Raycaster();
  const stripe = new THREE.MeshStandardMaterial({ color: 0x1d4fc4, roughness: 0.35, polygonOffset: true, polygonOffsetFactor: -4 }); this.ownMat.push(stripe);
  const text = this.policeDecal.clone(); text.polygonOffset = true; text.polygonOffsetFactor = -6; text.depthWrite = false; this.ownMat.push(text);
  for (const sd of [1, -1]) for (const [z, y, w, h, mat] of [[0, 0.4, L * 0.92, 0.08, stripe], [0.25, 0.47, 1.25, 0.31, text]]) {
    const yy = box.min.y + H * y; rc.set(new THREE.Vector3(sd * (box.max.x + 1), yy, box.min.z + L / 2 + z), new THREE.Vector3(-sd, 0, 0));
    const hit = rc.intersectObjects(meshes, false)[0]; if (!hit) continue;
    const g = new DecalGeometry(hit.object, hit.point, new THREE.Euler(0, sd * Math.PI / 2, 0), new THREE.Vector3(w, h, 0.5));
    g.applyMatrix4(holder.matrix.clone().invert()); const m = new THREE.Mesh(g, mat); this.ownGeo.push(g); holder.add(m);
  }
  r.position.copy(pos); r.quaternion.copy(q); r.updateMatrixWorld(true);
};
// точки на поверхности модели: крыша для маячка, передние крылья для флажков, решётка для стробоскопов
CarVisual.prototype.fitModel = function (holder) {
  const r = this.root, pos = r.position.clone(), q = r.quaternion.clone(); r.position.set(0, 0, 0); r.quaternion.identity(); r.updateMatrixWorld(true);
  const meshes = []; holder.traverse(o => { if (o.isMesh) meshes.push(o); });
  const box = new THREE.Box3().setFromObject(holder), L = box.max.z - box.min.z, W = box.max.x - box.min.x, H = box.max.y - box.min.y, rc = new THREE.Raycaster();
  const down = (x, z) => { rc.set(new THREE.Vector3(x, box.max.y + 1, z), new THREE.Vector3(0, -1, 0)); const h = rc.intersectObjects(meshes, false)[0]; return h ? h.point.y : null; };
  // крыша: самая высокая точка по оси водителя, затем вперёд, пока крыша не начинает уходить вниз
  const bx = Math.min(0.32, W * 0.17); let best = -1e9, bz = box.min.z + L / 2;
  for (let i = 0; i <= 24; i++) { const z = box.min.z + L * (0.25 + 0.5 * i / 24), y = down(bx, z); if (y !== null && y > best) { best = y; bz = z; } }
  // передний край крыши: идём от лобового стекла назад до первой точки почти на высоте крыши
  let fz = bz; for (let z = box.max.z - L * 0.2; z > bz; z -= 0.03) { const y = down(bx, z); if (y !== null && y >= best - 0.06) { fz = z; break; } }
  const rz = Math.max(bz, fz - 0.28);
  this.fit = { beacon: new THREE.Vector3(bx, (down(bx, rz) ?? best) - 0.004, rz) };
  // крылья: ближе к краю капота у передней арки
  const fzf = box.max.z - L * 0.17, fx = W / 2 - Math.max(0.12, W * 0.075); let fy = down(fx, fzf); if (fy === null) fy = box.min.y + H * 0.62;
  this.fit.flag = { x: fx, y: fy - 0.012, z: fzf };
  // решётка радиатора
  const sy = box.min.y + H * 0.4; rc.set(new THREE.Vector3(W * 0.28, sy, box.max.z + 1), new THREE.Vector3(0, 0, -1)); const h = rc.intersectObjects(meshes, false)[0];
  this.fit.strobe = { x: W * 0.28, y: sy, z: (h ? h.point.z : box.max.z) + 0.04 };
  r.position.copy(pos); r.quaternion.copy(q); r.updateMatrixWorld(true);
};
