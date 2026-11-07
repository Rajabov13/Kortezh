
/* =====================================================================
   Машины: кузов «лофтом» из поперечных сечений (суперэллипсы) по профилям
   верха, низа и ширины; отдельный купол салона, крыша в цвет кузова,
   арки колёс, фирменные решётки, фары и фонари у каждой модели.
   ===================================================================== */
function kcurve(pts) {
  const n = pts.length;
  return u => {
    if (u <= pts[0][0]) return pts[0][1];
    if (u >= pts[n - 1][0]) return pts[n - 1][1];
    let i = 0; while (u > pts[i + 1][0]) i++;
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)], h = p2[0] - p1[0], t = (u - p1[0]) / h;
    const m1 = (p2[1] - p0[1]) / (p2[0] - p0[0]) * h, m2 = (p3[1] - p1[1]) / (p3[0] - p1[0]) * h, t2 = t * t, t3 = t2 * t;
    const v = (2 * t3 - 3 * t2 + 1) * p1[1] + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2[1] + (t3 - t2) * m2;
    const lo = Math.min(p1[1], p2[1]), hi = Math.max(p1[1], p2[1]), pad = (hi - lo) * 0.15 + 0.004;
    return clamp(v, lo - pad, hi + pad);
  };
}
// лофт: N колец вдоль машины, M точек по сечению; th0..th1 — дуга сечения
function loftGeo(N, M, secFn, uA, uB, zfn, th0, th1, opt = {}) {
  const full = !!opt.full, ring = full ? M : M + 1, pos = [], idx = [];
  const rings = [];
  for (let i = 0; i <= N; i++) {
    const tt = i / N, u = opt.ease ? uA + (uB - uA) * (0.5 - 0.5 * Math.cos(Math.PI * tt)) : uA + (uB - uA) * tt;
    const s = secFn(u), z = zfn(u), ex = 2 / s.n; rings.push({ s, z });
    for (let j = 0; j < ring; j++) {
      const th = th0 + (th1 - th0) * j / M, c = Math.cos(th), sn = Math.sin(th);
      const e2 = sn < 0 ? 2 / (s.nb || s.n) : ex; let x = s.hw * Math.sign(c) * Math.pow(Math.abs(c), e2), yy = Math.sign(sn) * Math.pow(Math.abs(sn), e2);
      if (yy > 0) x *= 1 - s.tum * Math.pow(yy, 1.5); else x *= 1 - s.tuck * yy * yy;
      if (s.crease) x *= 1 + s.crease * (Math.exp(-(((yy - 0.42) / 0.07) ** 2)) - 0.6 * Math.exp(-(((yy + 0.35) / 0.12) ** 2)));
      let y = s.mid + s.hh * yy;
      if (opt.grow) { x *= opt.grow; y += (opt.lift || 0); }
      if (opt.clampY) y = Math.max(y, opt.clampY(z, s));
      pos.push(x, y, z);
    }
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) {
    const a = i * ring + j, b = i * ring + (full ? (j + 1) % M : j + 1), c = (i + 1) * ring + j, d = (i + 1) * ring + (full ? (j + 1) % M : j + 1);
    idx.push(a, b, c, b, d, c);
  }
  if (opt.caps && full) {
    for (const [ri, sign] of [[0, -1], [N, 1]]) {
      const base = pos.length / 3, s = rings[ri].s; pos.push(0, s.mid, rings[ri].z);
      for (let j = 0; j < M; j++) { const k = (ri * ring + j) * 3; pos.push(pos[k], pos[k + 1], pos[k + 2]); }
      for (let j = 0; j < M; j++) { const a = base + 1 + j, b = base + 1 + (j + 1) % M; if (sign > 0) idx.push(base, a, b); else idx.push(base, b, a); }
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

// ---------- характеристики моделей ----------
const CARS = {
  sclass: { badge: 'S 580', name: 'Mercedes-Benz S-Class', brand: 'merc', L: 5.18, W: 1.92, wb: 3.1, fo: 0.96, wr: 0.36, rim: 0.245, tire: 0.255, n: 3.6, tum: 0.14, tuck: 0.14,
    top: [[0, 0.81], [0.012, 0.93], [0.035, 0.96], [0.1, 1.01], [0.24, 1.0], [0.4, 0.99], [0.6, 0.98], [0.7, 0.95], [0.82, 0.89], [0.92, 0.86], [0.97, 0.83], [0.995, 0.80], [1, 0.75]],
    bot: [[0, 0.36], [0.025, 0.27], [0.08, 0.21], [0.5, 0.19], [0.92, 0.21], [0.975, 0.24], [1, 0.3]],
    hw: [[0, 0.88], [0.025, 0.950], [0.06, 0.985], [0.1, 0.995], [0.5, 1], [0.86, 0.985], [0.955, 0.973], [0.985, 0.945], [1, 0.86]],
    cab: [[0.215, 0.98], [0.25, 1.16], [0.3, 1.34], [0.36, 1.45], [0.46, 1.49], [0.53, 1.47], [0.58, 1.37], [0.635, 1.18], [0.69, 0.96]], cabW: 0.86, cabN: 3.2, cabTum: 0.32, roofCap: [0.33, 0.55],
    grille: 'merc', head: 'merc', tail: 'merc', rims: 'multi', sunroof: true, chromeTop: true, chromeBelt: true, plateF: 0.42, plateR: 0.6,
    vmax: 66, accel: 7.4, brake: 11, grip: 7.6, steer: 0.6, dur: 100, mass: 2100, cost: 0, color: 0x07080a },
  eclass: { badge: 'E 300', name: 'Mercedes-Benz E-Class', brand: 'merc', L: 4.95, W: 1.86, wb: 2.94, fo: 0.9, wr: 0.34, rim: 0.24, tire: 0.245, n: 3.4, tum: 0.15, tuck: 0.14,
    top: [[0, 0.81], [0.012, 0.91], [0.035, 0.94], [0.1, 0.99], [0.24, 0.98], [0.4, 0.97], [0.6, 0.96], [0.7, 0.93], [0.82, 0.87], [0.92, 0.84], [0.97, 0.81], [0.995, 0.78], [1, 0.73]],
    bot: [[0, 0.36], [0.025, 0.27], [0.08, 0.2], [0.5, 0.18], [0.92, 0.2], [0.975, 0.24], [1, 0.3]],
    hw: [[0, 0.87], [0.025, 0.950], [0.06, 0.985], [0.1, 0.995], [0.5, 1], [0.86, 0.98], [0.955, 0.968], [0.985, 0.935], [1, 0.84]],
    cab: [[0.21, 0.96], [0.25, 1.13], [0.3, 1.31], [0.36, 1.42], [0.46, 1.45], [0.52, 1.43], [0.57, 1.33], [0.63, 1.15], [0.685, 0.94]], cabW: 0.85, cabN: 3.1, cabTum: 0.33, roofCap: [0.33, 0.54],
    grille: 'mercSport', head: 'mercE', tail: 'mercE', rims: 'twin', chromeTop: true, chromeBelt: true, plateF: 0.4, plateR: 0.6,
    vmax: 63, accel: 7.9, brake: 11, grip: 8.1, steer: 0.64, dur: 85, mass: 1800, cost: 0, color: 0x9aa0a8 },
  maybach: { badge: 'S 680', name: 'Mercedes-Maybach S 680', brand: 'merc', L: 5.47, W: 1.92, wb: 3.4, fo: 0.97, wr: 0.37, rim: 0.26, tire: 0.255, n: 3.6, tum: 0.14, tuck: 0.14,
    top: [[0, 0.75], [0.02, 0.89], [0.06, 0.98], [0.12, 1.02], [0.24, 1.01], [0.4, 1.0], [0.6, 0.99], [0.7, 0.96], [0.82, 0.9], [0.92, 0.88], [0.97, 0.85], [0.995, 0.82], [1, 0.77]],
    bot: [[0, 0.36], [0.025, 0.27], [0.08, 0.21], [0.5, 0.19], [0.92, 0.21], [0.975, 0.24], [1, 0.3]],
    hw: [[0, 0.88], [0.025, 0.950], [0.06, 0.985], [0.1, 0.995], [0.5, 1], [0.86, 0.985], [0.955, 0.973], [0.985, 0.925], [1, 0.81]],
    cab: [[0.2, 0.99], [0.24, 1.17], [0.29, 1.36], [0.34, 1.47], [0.47, 1.51], [0.53, 1.49], [0.58, 1.38], [0.63, 1.18], [0.68, 0.97]], cabW: 0.86, cabN: 3.2, cabTum: 0.32, roofCap: [0.31, 0.55],
    grille: 'maybach', head: 'merc', tail: 'merc', rims: 'mono', sunroof: true, chromeBelt: true, chromeTop: true, twoTone: 0.84, plateF: 0.42, plateR: 0.62,
    vmax: 64, accel: 7.1, brake: 10.5, grip: 7.2, steer: 0.56, dur: 110, mass: 2400, cost: 4000, color: 0xb9bdc4, color2: 0x15161a },
  bmw7: { badge: '740Li', name: 'BMW 7 Series', brand: 'bmw', L: 5.39, W: 1.95, wb: 3.21, fo: 0.95, wr: 0.37, rim: 0.26, tire: 0.26, n: 4.2, tum: 0.12, tuck: 0.12,
    top: [[0, 0.84], [0.012, 0.95], [0.035, 0.98], [0.1, 1.03], [0.24, 1.02], [0.45, 1.01], [0.62, 1.0], [0.72, 0.98], [0.84, 0.95], [0.93, 0.92], [0.975, 0.89], [0.995, 0.86], [1, 0.82]],
    bot: [[0, 0.36], [0.025, 0.27], [0.08, 0.21], [0.5, 0.19], [0.92, 0.21], [0.975, 0.24], [1, 0.3]],
    hw: [[0, 0.90], [0.025, 0.960], [0.06, 0.985], [0.1, 0.995], [0.5, 1], [0.86, 0.99], [0.955, 0.978], [0.985, 0.945], [1, 0.85]],
    cab: [[0.215, 1.0], [0.25, 1.17], [0.3, 1.35], [0.36, 1.47], [0.47, 1.5], [0.53, 1.48], [0.58, 1.38], [0.635, 1.19], [0.69, 0.99]], cabW: 0.86, cabN: 3.4, cabTum: 0.3, roofCap: [0.33, 0.55],
    grille: 'kidney', head: 'bmw', tail: 'bmw', rims: 'twin', chromeTop: true, chromeBelt: true, plateF: 0.44, plateR: 0.62,
    vmax: 68, accel: 7.9, brake: 11.5, grip: 8.2, steer: 0.62, dur: 95, mass: 2100, cost: 2500, color: 0x1b2a44 },
  gclass: { badge: 'G 500', name: 'Mercedes-Benz G-Class', brand: 'merc', L: 4.82, W: 1.98, wb: 2.89, fo: 0.78, wr: 0.42, rim: 0.27, tire: 0.29, n: 9, tum: 0.03, tuck: 0.05, endR: 0.02, flare: 0.045, arch: 0.09,
    top: [[0, 1.14], [0.015, 1.2], [0.06, 1.23], [0.5, 1.24], [0.72, 1.23], [0.92, 1.2], [0.985, 1.16], [1, 1.06]],
    bot: [[0, 0.52], [0.02, 0.44], [0.06, 0.4], [0.94, 0.4], [0.98, 0.46], [1, 0.52]],
    hw: [[0, 0.93], [0.02, 0.98], [0.06, 1], [0.94, 1], [0.98, 0.97], [1, 0.9]],
    cab: [[0.012, 1.18], [0.03, 1.6], [0.05, 1.9], [0.08, 1.96], [0.6, 1.97], [0.63, 1.93], [0.665, 1.55], [0.69, 1.22]], cabW: 0.92, cabN: 7, cabTum: 0.06, roofCap: [0.035, 0.64],
    grille: 'g', head: 'round', tail: 'g', rims: 'off', spare: true, step: true, plateF: 0.55, plateR: 0.62,
    vmax: 58, accel: 6.6, brake: 10, grip: 6.5, steer: 0.55, dur: 125, mass: 2500, cost: 1500, color: 0x1c1e22 },
  garmored: { base: 'gclass', name: 'G-Class бронированный', armored: true, rims: 'off',
    vmax: 52, accel: 5.2, brake: 9, grip: 6.0, steer: 0.52, dur: 200, mass: 3800, cost: 5000, color: 0x0b0c0e, finish: 'f_matte' },
  vclass: { badge: 'V 300', name: 'Mercedes-Benz V-Class', brand: 'merc', L: 5.14, W: 1.93, wb: 3.2, fo: 0.87, wr: 0.36, rim: 0.24, tire: 0.25, n: 5, tum: 0.05, tuck: 0.1,
    top: [[0, 0.95], [0.02, 1.06], [0.06, 1.1], [0.75, 1.1], [0.82, 1.07], [0.9, 0.99], [0.96, 0.88], [0.99, 0.74], [1, 0.62]],
    bot: [[0, 0.42], [0.03, 0.3], [0.07, 0.22], [0.93, 0.22], [0.98, 0.3], [1, 0.38]],
    hw: [[0, 0.92], [0.03, 0.98], [0.08, 1], [0.85, 1], [0.95, 0.94], [1, 0.84]],
    cab: [[0.01, 1.08], [0.02, 1.5], [0.04, 1.86], [0.08, 1.93], [0.65, 1.94], [0.72, 1.88], [0.78, 1.55], [0.83, 1.1]], cabW: 0.92, cabN: 5, cabTum: 0.14, roofCap: [0.05, 0.7],
    grille: 'mercVan', head: 'merc', tail: 'van', rims: 'twin', plateF: 0.42, plateR: 0.75, slide: true,
    vmax: 55, accel: 5.8, brake: 9.5, grip: 6.2, steer: 0.6, dur: 110, mass: 2400, cost: 1000, color: 0x07080a },
  lc: { badge: 'LAND CRUISER', badgeC: true, name: 'Toyota Land Cruiser 300', brand: 'toyota', L: 4.98, W: 1.98, wb: 2.85, fo: 0.95, wr: 0.42, rim: 0.28, tire: 0.28, n: 5.5, tum: 0.08, tuck: 0.08, flare: 0.04, arch: 0.08,
    top: [[0, 0.98], [0.02, 1.13], [0.06, 1.2], [0.5, 1.22], [0.7, 1.2], [0.85, 1.16], [0.95, 1.11], [0.99, 1.0], [1, 0.88]],
    bot: [[0, 0.54], [0.03, 0.43], [0.08, 0.37], [0.92, 0.37], [0.97, 0.44], [1, 0.52]],
    hw: [[0, 0.9], [0.03, 0.97], [0.1, 1], [0.86, 1], [0.96, 0.95], [1, 0.86]],
    cab: [[0.02, 1.15], [0.035, 1.55], [0.06, 1.86], [0.1, 1.92], [0.58, 1.93], [0.63, 1.86], [0.69, 1.5], [0.74, 1.18]], cabW: 0.9, cabN: 4.5, cabTum: 0.18, roofCap: [0.07, 0.62],
    grille: 'toyota', head: 'lc', tail: 'lc', rims: 'off', rails: true, plateF: 0.6, plateR: 0.72,
    vmax: 58, accel: 6.4, brake: 10, grip: 6.7, steer: 0.56, dur: 140, mass: 2600, cost: 2000, color: 0xeceeef },
  lx: { badge: 'LX 600', name: 'Lexus LX 600', brand: 'lexus', L: 5.1, W: 1.99, wb: 2.85, fo: 1.0, wr: 0.42, rim: 0.28, tire: 0.28, n: 5.2, tum: 0.09, tuck: 0.08, flare: 0.03, arch: 0.08,
    top: [[0, 0.98], [0.02, 1.13], [0.06, 1.19], [0.5, 1.21], [0.7, 1.19], [0.85, 1.14], [0.95, 1.08], [0.99, 0.98], [1, 0.86]],
    bot: [[0, 0.54], [0.03, 0.43], [0.08, 0.36], [0.92, 0.36], [0.97, 0.43], [1, 0.5]],
    hw: [[0, 0.9], [0.03, 0.97], [0.1, 1], [0.86, 1], [0.96, 0.95], [1, 0.85]],
    cab: [[0.02, 1.15], [0.035, 1.55], [0.06, 1.84], [0.1, 1.9], [0.58, 1.91], [0.63, 1.84], [0.69, 1.48], [0.74, 1.16]], cabW: 0.9, cabN: 4.2, cabTum: 0.2, roofCap: [0.07, 0.62],
    grille: 'spindle', head: 'lexus', tail: 'lexus', rims: 'multi', rails: true, plateF: 0.55, plateR: 0.72,
    vmax: 60, accel: 6.8, brake: 10.2, grip: 6.9, steer: 0.56, dur: 135, mass: 2600, cost: 3000, color: 0x2a2c30 },
  gls: { badge: 'GLS 580', name: 'Mercedes-Benz GLS', brand: 'merc', L: 5.21, W: 1.96, wb: 3.14, fo: 0.98, wr: 0.41, rim: 0.28, tire: 0.27, n: 4.2, tum: 0.12, tuck: 0.1, flare: 0.02,
    top: [[0, 0.96], [0.02, 1.1], [0.06, 1.16], [0.5, 1.17], [0.7, 1.14], [0.84, 1.07], [0.94, 1.0], [0.99, 0.9], [1, 0.78]],
    bot: [[0, 0.52], [0.03, 0.42], [0.08, 0.35], [0.92, 0.35], [0.97, 0.42], [1, 0.5]],
    hw: [[0, 0.88], [0.03, 0.96], [0.1, 1], [0.86, 0.99], [0.96, 0.93], [1, 0.84]],
    cab: [[0.025, 1.12], [0.045, 1.5], [0.08, 1.78], [0.13, 1.84], [0.55, 1.85], [0.61, 1.77], [0.67, 1.42], [0.73, 1.1]], cabW: 0.88, cabN: 3.6, cabTum: 0.26, roofCap: [0.1, 0.6],
    grille: 'mercSuv', head: 'merc', tail: 'mercSuv', rims: 'twin', rails: true, chromeBelt: true, plateF: 0.5, plateR: 0.72,
    vmax: 62, accel: 7.0, brake: 10.4, grip: 7.0, steer: 0.57, dur: 130, mass: 2600, cost: 3500, color: 0x07080a },
  rangerover: { badge: 'RANGE ROVER', badgeC: true, name: 'Range Rover', brand: 'rr', L: 5.05, W: 2.0, wb: 3.0, fo: 0.92, wr: 0.42, rim: 0.29, tire: 0.27, n: 6.5, tum: 0.06, tuck: 0.06,
    top: [[0, 1.02], [0.015, 1.12], [0.05, 1.17], [0.5, 1.18], [0.75, 1.17], [0.9, 1.14], [0.97, 1.1], [0.995, 1.02], [1, 0.9]],
    bot: [[0, 0.52], [0.03, 0.42], [0.07, 0.36], [0.93, 0.36], [0.97, 0.42], [1, 0.5]],
    hw: [[0, 0.92], [0.03, 0.98], [0.08, 1], [0.9, 1], [0.97, 0.96], [1, 0.9]],
    cab: [[0.015, 1.15], [0.03, 1.55], [0.05, 1.82], [0.09, 1.87], [0.6, 1.88], [0.64, 1.82], [0.7, 1.45], [0.75, 1.15]], cabW: 0.9, cabN: 6, cabTum: 0.16, roofCap: [0.06, 0.63],
    grille: 'rr', head: 'rr', tail: 'rr', rims: 'multi', floatRoof: true, plateF: 0.58, plateR: 0.62,
    vmax: 62, accel: 6.9, brake: 10.3, grip: 7.0, steer: 0.58, dur: 125, mass: 2550, cost: 4500, color: 0x2b2f33 },
  tahoe: { badge: 'TAHOE', badgeC: true, name: 'Chevrolet Tahoe', brand: 'chevyBig', L: 5.35, W: 2.06, wb: 3.07, fo: 1.0, wr: 0.43, rim: 0.28, tire: 0.29, n: 7, tum: 0.06, tuck: 0.06, flare: 0.02,
    top: [[0, 1.08], [0.015, 1.2], [0.05, 1.25], [0.5, 1.26], [0.75, 1.25], [0.9, 1.23], [0.975, 1.2], [0.995, 1.1], [1, 0.98]],
    bot: [[0, 0.56], [0.03, 0.46], [0.07, 0.4], [0.93, 0.4], [0.97, 0.46], [1, 0.54]],
    hw: [[0, 0.93], [0.03, 0.98], [0.08, 1], [0.9, 1], [0.97, 0.97], [1, 0.92]],
    cab: [[0.015, 1.23], [0.03, 1.6], [0.05, 1.88], [0.09, 1.93], [0.6, 1.94], [0.64, 1.86], [0.7, 1.5], [0.75, 1.24]], cabW: 0.9, cabN: 6, cabTum: 0.14, roofCap: [0.06, 0.63],
    grille: 'tahoe', head: 'tahoe', tail: 'tahoe', rims: 'twin', rails: true, plateF: 0.62, plateR: 0.72,
    vmax: 56, accel: 6.2, brake: 9.6, grip: 6.4, steer: 0.54, dur: 145, mass: 2700, cost: 2200, color: 0x07080a },
  camry: { badge: 'CAMRY', name: 'Toyota Camry', brand: 'toyota', L: 4.88, W: 1.84, wb: 2.83, fo: 0.95, wr: 0.34, rim: 0.23, tire: 0.235, n: 3.3, tum: 0.17, tuck: 0.14,
    top: [[0, 0.82], [0.012, 0.91], [0.035, 0.94], [0.1, 0.97], [0.4, 0.95], [0.62, 0.94], [0.72, 0.9], [0.85, 0.82], [0.94, 0.8], [0.985, 0.75], [1, 0.66]],
    bot: [[0, 0.36], [0.025, 0.27], [0.08, 0.2], [0.5, 0.18], [0.92, 0.2], [0.975, 0.24], [1, 0.3]],
    hw: [[0, 0.88], [0.025, 0.950], [0.06, 0.985], [0.1, 0.995], [0.5, 1], [0.86, 0.98], [0.955, 0.968], [0.985, 0.935], [1, 0.84]],
    cab: [[0.2, 0.95], [0.24, 1.1], [0.29, 1.28], [0.35, 1.4], [0.47, 1.43], [0.53, 1.4], [0.58, 1.29], [0.63, 1.1], [0.69, 0.91]], cabW: 0.86, cabN: 3, cabTum: 0.34, roofCap: [0.33, 0.54],
    grille: 'camry', head: 'camry', tail: 'camry', rims: 'twin', chromeBelt: true, plateF: 0.36, plateR: 0.6,
    vmax: 60, accel: 7.0, brake: 10.6, grip: 7.8, steer: 0.63, dur: 90, mass: 1600, cost: 600, color: 0xeceeef },
  ls: { badge: 'LS 500', name: 'Lexus LS 500', brand: 'lexus', L: 5.24, W: 1.9, wb: 3.13, fo: 0.95, wr: 0.36, rim: 0.25, tire: 0.25, n: 3.4, tum: 0.16, tuck: 0.14,
    top: [[0, 0.80], [0.012, 0.91], [0.035, 0.94], [0.1, 0.98], [0.24, 0.97], [0.45, 0.96], [0.62, 0.95], [0.72, 0.91], [0.84, 0.84], [0.93, 0.82], [0.975, 0.79], [0.995, 0.76], [1, 0.71]],
    bot: [[0, 0.36], [0.025, 0.27], [0.08, 0.2], [0.5, 0.17], [0.92, 0.2], [0.975, 0.24], [1, 0.3]],
    hw: [[0, 0.88], [0.025, 0.950], [0.06, 0.985], [0.1, 0.995], [0.5, 1], [0.86, 0.985], [0.955, 0.973], [0.985, 0.935], [1, 0.84]],
    cab: [[0.19, 0.95], [0.23, 1.1], [0.29, 1.3], [0.35, 1.41], [0.47, 1.45], [0.53, 1.43], [0.58, 1.32], [0.635, 1.13], [0.69, 0.93]], cabW: 0.86, cabN: 3, cabTum: 0.35, roofCap: [0.33, 0.55],
    grille: 'spindleCar', head: 'lexus', tail: 'lexus', rims: 'multi', chromeBelt: true, chromeTop: true, plateF: 0.36, plateR: 0.6,
    vmax: 65, accel: 7.3, brake: 11, grip: 7.7, steer: 0.6, dur: 100, mass: 2200, cost: 3000, color: 0xd8d4cc },
  lc200: { badge: 'LAND CRUISER', badgeC: true, name: 'Toyota Land Cruiser 200', brand: 'toyota', L: 4.95, W: 1.97, wb: 2.85, fo: 0.92, wr: 0.41, rim: 0.27, tire: 0.28, n: 7.5, tum: 0.05, tuck: 0.06, flare: 0.05, arch: 0.09,
    top: [[0, 1.0], [0.015, 1.14], [0.05, 1.19], [0.5, 1.21], [0.75, 1.2], [0.9, 1.16], [0.975, 1.12], [0.995, 1.03], [1, 0.92]],
    bot: [[0, 0.54], [0.03, 0.44], [0.07, 0.38], [0.93, 0.38], [0.97, 0.44], [1, 0.52]],
    hw: [[0, 0.93], [0.03, 0.98], [0.08, 1], [0.9, 1], [0.97, 0.96], [1, 0.9]],
    cab: [[0.015, 1.18], [0.03, 1.58], [0.05, 1.87], [0.09, 1.92], [0.6, 1.93], [0.64, 1.86], [0.7, 1.5], [0.75, 1.2]], cabW: 0.9, cabN: 6, cabTum: 0.15, roofCap: [0.06, 0.63],
    grille: 'lc200', head: 'lc200', tail: 'lc', rims: 'off', rails: true, plateF: 0.56, plateR: 0.72,
    vmax: 55, accel: 6.0, brake: 9.6, grip: 6.4, steer: 0.55, dur: 145, mass: 2700, cost: 1200, color: 0x07080a },
  a8: { badge: 'A8 L', name: 'Audi A8', brand: 'audi', L: 5.17, W: 1.95, wb: 3.0, fo: 0.98, wr: 0.36, rim: 0.25, tire: 0.255, n: 4.4, tum: 0.13, tuck: 0.12,
    top: [[0, 0.82], [0.012, 0.93], [0.035, 0.96], [0.1, 1.0], [0.24, 0.99], [0.45, 0.98], [0.62, 0.97], [0.72, 0.94], [0.84, 0.88], [0.93, 0.86], [0.975, 0.83], [0.995, 0.80], [1, 0.75]],
    bot: [[0, 0.36], [0.025, 0.27], [0.08, 0.2], [0.5, 0.18], [0.92, 0.2], [0.975, 0.24], [1, 0.3]],
    hw: [[0, 0.90], [0.025, 0.960], [0.06, 0.985], [0.1, 0.995], [0.5, 1], [0.86, 0.99], [0.955, 0.978], [0.985, 0.935], [1, 0.82]],
    cab: [[0.21, 0.98], [0.25, 1.15], [0.3, 1.33], [0.36, 1.44], [0.47, 1.47], [0.53, 1.45], [0.58, 1.35], [0.635, 1.16], [0.69, 0.96]], cabW: 0.86, cabN: 3.4, cabTum: 0.3, roofCap: [0.33, 0.55],
    grille: 'audi', head: 'audi', tail: 'audi', rims: 'multi', chromeTop: true, chromeBelt: true, plateF: 0.4, plateR: 0.6,
    vmax: 66, accel: 7.6, brake: 11.2, grip: 8.4, steer: 0.61, dur: 95, mass: 2050, cost: 2800, color: 0x101114 },
  // машины сопровождения и трафика
  police: { name: 'ДПС', brand: 'chevy', L: 4.92, W: 1.86, wb: 2.83, fo: 0.95, wr: 0.34, rim: 0.23, tire: 0.24, n: 3.4, tum: 0.16, tuck: 0.14,
    top: [[0, 0.83], [0.012, 0.92], [0.035, 0.95], [0.1, 0.98], [0.4, 0.96], [0.62, 0.95], [0.72, 0.91], [0.85, 0.84], [0.94, 0.81], [0.985, 0.77], [1, 0.68]],
    bot: [[0, 0.36], [0.025, 0.27], [0.08, 0.21], [0.5, 0.19], [0.92, 0.21], [0.975, 0.24], [1, 0.3]],
    hw: [[0, 0.88], [0.025, 0.950], [0.06, 0.985], [0.1, 0.995], [0.5, 1], [0.86, 0.98], [0.955, 0.968], [0.985, 0.935], [1, 0.84]],
    cab: [[0.2, 0.96], [0.24, 1.12], [0.29, 1.3], [0.35, 1.41], [0.47, 1.44], [0.53, 1.41], [0.58, 1.3], [0.63, 1.12], [0.68, 0.93]], cabW: 0.86, cabN: 3.0, cabTum: 0.34, roofCap: [0.33, 0.54],
    grille: 'chevy', head: 'swept', tail: 'swept', rims: 'twin', plateF: 0.4, plateR: 0.6 },
  sedan: { name: 'Седан', brand: 'chevy', L: 4.48, W: 1.74, wb: 2.62, fo: 0.86, wr: 0.31, rim: 0.2, tire: 0.21, n: 3.3, tum: 0.16, tuck: 0.14,
    top: [[0, 0.78], [0.03, 0.92], [0.1, 0.98], [0.4, 0.97], [0.62, 0.95], [0.72, 0.92], [0.86, 0.86], [0.95, 0.82], [0.99, 0.79], [1, 0.73]],
    bot: [[0, 0.36], [0.025, 0.27], [0.08, 0.21], [0.5, 0.2], [0.92, 0.21], [0.975, 0.24], [1, 0.3]],
    hw: [[0, 0.89], [0.025, 0.960], [0.06, 0.985], [0.1, 0.995], [0.5, 1], [0.86, 0.98], [0.955, 0.968], [0.985, 0.935], [1, 0.84]],
    cab: [[0.2, 0.96], [0.24, 1.12], [0.29, 1.3], [0.35, 1.43], [0.47, 1.47], [0.53, 1.44], [0.58, 1.33], [0.635, 1.14], [0.69, 0.94]], cabW: 0.86, cabN: 3, cabTum: 0.34, roofCap: [0.33, 0.54],
    grille: 'chevy', head: 'swept', tail: 'swept', rims: 'steel' },
  hatch: { name: 'Хэтчбек', brand: 'chevy', L: 3.64, W: 1.6, wb: 2.38, fo: 0.7, wr: 0.3, rim: 0.19, tire: 0.19, n: 3.2, tum: 0.18, tuck: 0.14,
    top: [[0, 0.85], [0.02, 0.96], [0.06, 1.0], [0.5, 0.98], [0.66, 0.95], [0.8, 0.88], [0.93, 0.8], [0.985, 0.72], [1, 0.62]],
    bot: [[0, 0.46], [0.03, 0.32], [0.08, 0.22], [0.5, 0.21], [0.92, 0.22], [0.97, 0.28], [1, 0.36]],
    hw: [[0, 0.92], [0.025, 0.970], [0.06, 0.985], [0.1, 0.995], [0.5, 1], [0.86, 0.97], [0.955, 0.958], [0.985, 0.895], [1, 0.78]],
    cab: [[0.015, 0.98], [0.03, 1.3], [0.07, 1.47], [0.15, 1.52], [0.5, 1.53], [0.56, 1.48], [0.64, 1.25], [0.72, 0.94]], cabW: 0.88, cabN: 3.4, cabTum: 0.28, roofCap: [0.08, 0.55],
    grille: 'chevy', head: 'swept', tail: 'hatch', rims: 'steel' },
  nexia: { name: 'Седан старый', brand: 'chevy', L: 4.48, W: 1.66, wb: 2.52, fo: 0.85, wr: 0.31, rim: 0.19, tire: 0.2, n: 4.6, tum: 0.12, tuck: 0.12,
    top: [[0, 0.82], [0.02, 0.95], [0.06, 0.98], [0.6, 0.97], [0.7, 0.94], [0.95, 0.86], [0.99, 0.81], [1, 0.71]],
    bot: [[0, 0.36], [0.025, 0.27], [0.08, 0.22], [0.5, 0.21], [0.92, 0.22], [0.975, 0.24], [1, 0.3]],
    hw: [[0, 0.9], [0.03, 0.96], [0.1, 1], [0.86, 1], [0.95, 0.95], [1, 0.88]],
    cab: [[0.2, 0.96], [0.23, 1.15], [0.28, 1.33], [0.33, 1.39], [0.52, 1.4], [0.57, 1.36], [0.63, 1.14], [0.68, 0.95]], cabW: 0.88, cabN: 4, cabTum: 0.26, roofCap: [0.31, 0.56],
    grille: 'nexia', head: 'square', tail: 'square', rims: 'steel' },
  damas: { name: 'Минивэн', brand: 'chevy', L: 3.5, W: 1.4, wb: 1.84, fo: 0.55, wr: 0.28, rim: 0.17, tire: 0.17, n: 5, tum: 0.06, tuck: 0.1,
    top: [[0, 0.9], [0.02, 1.0], [0.05, 1.03], [0.85, 1.03], [0.93, 0.98], [0.98, 0.86], [1, 0.7]],
    bot: [[0, 0.44], [0.03, 0.32], [0.08, 0.24], [0.92, 0.24], [0.97, 0.3], [1, 0.38]],
    hw: [[0, 0.94], [0.03, 0.99], [0.08, 1], [0.9, 1], [0.97, 0.95], [1, 0.88]],
    cab: [[0.01, 1.0], [0.02, 1.6], [0.05, 1.82], [0.75, 1.84], [0.82, 1.7], [0.9, 1.3], [0.95, 1.0]], cabW: 0.94, cabN: 5, cabTum: 0.08, roofCap: [0.04, 0.8],
    grille: 'nexia', head: 'square', tail: 'van', rims: 'steel' }
};
CARS.garmored = Object.assign({}, CARS.gclass, CARS.garmored);
CARS.malibu = Object.assign({}, CARS.police, { badge: 'MALIBU', name: 'Chevrolet Malibu', vmax: 61, accel: 7.2, brake: 10.6, grip: 7.6, steer: 0.62, dur: 90, mass: 1550, cost: 400, color: 0xeceeef });
const PLAYER_CARS = ['sclass', 'eclass', 'malibu', 'camry', 'maybach', 'bmw7', 'a8', 'ls', 'gclass', 'garmored', 'gls', 'rangerover', 'lc', 'lc200', 'lx', 'tahoe', 'vclass'];

// ---------- колёса ----------
const WHEEL_CACHE = {};
function wheelParts(s, side, style) {
  const key = [s.wr, s.rim, s.tire, side, style].join('|'); if (WHEEL_CACHE[key]) return WHEEL_CACHE[key];
  const wr = s.wr, rr = style === 'steel' ? s.rim : Math.max(s.rim, wr * 0.74), w = s.tire, o = side * (w / 2 - 0.035);
  const prof = [[rr, -w / 2], [wr - 0.04, -w / 2], [wr - 0.012, -w / 2 + 0.028], [wr, -w / 2 + 0.07], [wr, w / 2 - 0.07], [wr - 0.012, w / 2 - 0.028], [wr - 0.04, w / 2], [rr, w / 2]].map(p => new THREE.Vector2(p[0], p[1]));
  const tire = new THREE.LatheGeometry(prof, 26); tire.rotateZ(-Math.PI / 2);
  const rim = [], brake = [];
  const barrel = new THREE.CylinderGeometry(rr, rr * 0.92, w * 0.86, 22, 1, true); barrel.rotateZ(Math.PI / 2); brake.push(colored(barrel, 0x1c1d20)); brake.push(colored(cyl(rr * 0.92, rr * 0.92, 0.01, 22, -side * (w / 2 - 0.06), 0, 0, 'x'), 0x151618));
  rim.push(new THREE.TorusGeometry(rr + 0.004, 0.014, 6, 32).rotateY(Math.PI / 2).translate(o, 0, 0)); // губа обода
  const spoke = (n, width, thick, len0, len1, twin) => {
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2;
      for (const t of twin ? [-0.09, 0.09] : [0]) {
        const g = new THREE.BoxGeometry(thick, len1 - len0, width); g.translate(0, (len0 + len1) / 2, 0); g.rotateX(a + t); g.translate(o + side * 0.006, 0, 0); rim.push(g);
      }
    }
  };
  if (style === 'multi') spoke(10, 0.04, 0.035, rr * 0.22, rr * 0.98, false);
  else if (style === 'twin') spoke(5, 0.045, 0.04, rr * 0.22, rr * 0.98, true);
  else if (style === 'off') spoke(6, 0.07, 0.045, rr * 0.25, rr * 0.98, false);
  else if (style === 'mono') { rim.push(cyl(rr * 0.97, rr * 0.97, 0.03, 26, o, 0, 0, 'x')); }
  else if (style === 'steel') { rim.push(cyl(rr * 0.95, rr * 0.95, 0.025, 18, o - side * 0.01, 0, 0, 'x')); }
  rim.push(cyl(rr * 0.2, rr * 0.22, 0.05, 14, o + side * 0.012, 0, 0, 'x'));
  // тормоз и суппорт видны между спицами
  brake.push(colored(cyl(rr * 0.8, rr * 0.8, 0.025, 22, side * (w / 2 - 0.12), 0, 0, 'x'), 0x3b3d40));
  brake.push(colored(box(0.06, rr * 0.5, rr * 0.36, side * (w / 2 - 0.1), rr * 0.48, -rr * 0.32, 0, 0.6), s.caliper ?? 0xa31623));
  return (WHEEL_CACHE[key] = { tire, rim: merge(rim), brake: merge(brake) });
}
function makeWheel(s, side, style, mats) {
  const pivot = new THREE.Group(), spin = new THREE.Group(); pivot.add(spin);
  const p = wheelParts(s, side, style);
  const t = new THREE.Mesh(p.tire, MAT.tire), r = new THREE.Mesh(p.rim, mats.rim), b = new THREE.Mesh(p.brake, MAT.vcolMetal);
  t.castShadow = true; spin.add(t, r); pivot.add(b); return { pivot, spin };
}

// ---------- постройка кузова ----------
function carModel(spec, o = {}) {
  const S = spec, L = S.L, W = S.W, hl = L / 2, zf = u => -hl + u * L;
  const fz = hl - S.fo, rz = fz - S.wb, wr = S.wr, ar = wr + (S.arch ?? 0.065);
  const TOP = kcurve(S.top), BOT = kcurve(S.bot), HW = kcurve(S.hw), CAB = kcurve(S.cab), flare = S.flare || 0, eR = S.endR ?? 0.022;
  const Q = o.lod ? { N: 34, M: 18, cN: 18, cM: 14 } : { N: 84, M: 34, cN: 44, cM: 26 };
  function sec(u) {
    const z = zf(u); let top = TOP(u), bot = BOT(u), hw = HW(u) * W / 2;
    for (const az of [fz, rz]) {
      const dz = z - az;
      if (flare && Math.abs(dz) < ar + 0.28) hw *= 1 + flare * smooth(1 - Math.abs(dz) / (ar + 0.28));
    }
    let k = 1; if (u < eR) k = Math.sqrt(Math.max(0, 1 - (1 - u / eR) ** 2)); else if (u > 1 - eR) k = Math.sqrt(Math.max(0, 1 - (1 - (1 - u) / eR) ** 2));
    const mid = (top + bot) / 2, hh = (top - bot) / 2 * lerp(0.9, 1, k);
    return { hw: hw * lerp(0.9, 1, k), mid, hh, n: S.n, nb: S.nb ?? Math.max(S.n + 2, 6), tum: S.tum, tuck: (S.tuck ?? 0.1) * 0.45, top, crease: S.crease ?? (S.n > 6 ? 0.006 : 0.014) * k };
  }
  function archY(z, s) {
    let y = -9;
    for (const az of [fz, rz]) { const dz = z - az; if (Math.abs(dz) < ar) y = Math.max(y, Math.min(wr + Math.sqrt(ar * ar - dz * dz), (s ? s.mid + s.hh : 9) - 0.16)); }
    return y;
  }
  const cU0 = S.cab[0][0], cU1 = S.cab[S.cab.length - 1][0];
  function csec(u) {
    const b = sec(u), top = Math.max(CAB(u), TOP(u) - 0.02), bot = TOP(u) - 0.12, hw = HW(u) * W / 2 * S.cabW;
    return { hw, mid: (top + bot) / 2, hh: Math.max(0.02, (top - bot) / 2), n: S.cabN, tum: S.cabTum, tuck: 0.05 };
  }
  const bx = (u, y) => { const s = sec(u); const t = clamp((y - s.mid) / s.hh, -0.999, 0.999); const nn = t < 0 ? (s.nb || s.n) : s.n; let x = s.hw * Math.pow(1 - Math.pow(Math.abs(t), nn), 1 / nn); if (t > 0) x *= 1 - s.tum * Math.pow(t, 1.5); else x *= 1 - s.tuck * t * t; return x; };
  const inSec = (u, y) => { const s = sec(u); return y > s.mid - s.hh * 0.98 && y < s.mid + s.hh * 0.98; };
  // точка на поверхности носа/кормы; если x шире кузова у торца — прижимаем к углу
  const zFront = (x, y) => { let best = 1; for (let u = 1; u > 0.86; u -= 0.002) { if (!inSec(u, y)) continue; best = u; if (bx(u, y) >= Math.abs(x)) return zf(u); } return zf(best); };
  const zRear = (x, y) => { let best = 0; for (let u = 0; u < 0.14; u += 0.002) { if (!inSec(u, y)) continue; best = u; if (bx(u, y) >= Math.abs(x)) return zf(u); } return zf(best); };
  const xFrontMax = y => bx(0.955, y) * 0.97, xRearMax = y => bx(0.045, y) * 0.97;
  const G = { paint: [], paint2: [], glass: [], chrome: [], black: [], dark: [], head: [], drl: [], tail: [], rev: [], amber: [], stripe: [], well: [], plateF: null, plateR: null };
  const ch = o.armored ? 'black' : 'chrome';
  // кузов (двухцветный — у Maybach)
  if (S.twoTone && !o.lod) {
    const split = S.twoTone;
    const tS = u => { const s = sec(u); return Math.asin(clamp(Math.sign((split - s.mid) / s.hh) * Math.pow(Math.min(1, Math.abs((split - s.mid) / s.hh)), s.n / 2), -1, 1)); };
    const gUp = loftSplit(Q.N, Q.M, sec, zf, tS, true, archY), gLo = loftSplit(Q.N, Q.M, sec, zf, tS, false, archY);
    G.paint.push(gUp); G.paint2.push(gLo); G.paint2.push(loftGeo(Q.N, Q.M, sec, 0, 1, zf, -Math.PI / 2, Math.PI * 1.5, { full: true, caps: true, ease: true, grow: 0.97, lift: -0.03, clampY: archY }));
  } else G.paint.push(loftGeo(Q.N, Q.M, sec, 0, 1, zf, -Math.PI / 2, Math.PI * 1.5, { full: true, caps: true, ease: true, clampY: archY }));
  // купол салона и крыша в цвет кузова
  G.glass.push(loftGeo(Q.cN, Q.cM, csec, cU0, cU1, zf, -Math.PI / 2, Math.PI * 1.5, { full: true, caps: true }));
  const [r0, r1] = S.roofCap;
  G[S.floatRoof ? 'black' : 'paint'].push(loftGeo(Math.max(8, Q.cN * 0.6 | 0), Q.cM, csec, r0, r1, zf, Math.PI * 0.2, Math.PI * 0.8, { grow: 1.012, lift: 0.006 }));
  // стойки: A — по краю лобового стекла, C/D — по краю заднего, B — между дверями
  const pk = S.floatRoof ? 'black' : 'paint', P = Math.PI, suv = cU0 < 0.1;
  const band = (key, ua, ub, a0, a1, n = 8) => { G[key].push(loftGeo(n, 5, csec, ua, ub, zf, a0 * P, a1 * P, { grow: 1.02, lift: 0.006 })); G[key].push(loftGeo(n, 5, csec, ua, ub, zf, (1 - a1) * P, (1 - a0) * P, { grow: 1.02, lift: 0.006 })); };
  band(pk, r1 - 0.01, cU1, 0.09, 0.23, 12);
  if (suv) { const rt = CAB((r0 + r1) / 2); let uF = cU0; while (uF < r1 && CAB(uF) < rt - 0.06) uF += 0.004; band(pk, uF, uF + 0.045, -0.46, 0.2, 4); } else band(pk, cU0, r0 + 0.01, -0.02, 0.23, 12);
  const bU = S.bU ?? (r0 + r1) / 2 + 0.01; band('black', bU - 0.007, bU + 0.007, -0.46, 0.22, 2);
  if (suv) { const cU = S.cU ?? r0 + (r1 - r0) * 0.12; band(pk, cU - 0.012, cU + 0.012, -0.46, 0.22, 2); }
  if (S.sunroof && !o.lod) G.black.push(loftGeo(10, 8, csec, r0 + 0.04, r0 + (r1 - r0) * 0.6, zf, Math.PI * 0.38, Math.PI * 0.62, { grow: 1.016, lift: 0.009 }));
  // тёмные колёсные ниши
  for (const az of [fz, rz]) G.well.push(box(W * 0.72, ar * 0.7, ar * 1.5, 0, wr + ar * 0.3, az));
  // хром линии окон
  if (!o.lod && (S.chromeBelt || o.armored)) {
    for (const sd of [1, -1]) {
      const pts = []; for (let u = cU0 + 0.012; u <= cU1 - 0.012; u += 0.01) { const y = TOP(u) + 0.004; pts.push(new THREE.Vector3(sd * (bx(u, y - 0.01) * 0.985), y, zf(u))); }
      if (pts.length > 2) G[ch].push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.011, 5, false));
      if (S.chromeTop) { const p2 = []; for (let u = cU0 + 0.03; u <= cU1 - 0.03; u += 0.01) { const c = csec(u); const y = c.mid + c.hh * 0.86; p2.push(new THREE.Vector3(sd * c.hw * Math.pow(1 - Math.pow(0.86, c.n), 1 / c.n) * (1 - c.tum * Math.pow(0.86, 1.5)) * 1.01, y, zf(u))); } G[ch].push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(p2), 40, 0.009, 5, false)); }
    }
  }
  // зеркала, ручки, пороги
  const ws = S.cab[S.cab.length - 1][0], yM = TOP(ws - 0.02) + 0.12;
  for (const sd of [1, -1]) {
    const uM = ws - 0.035, xm = bx(uM, TOP(uM) - 0.04);
    G.paint.push(rbox(0.22, 0.13, 0.1, 0.045, sd * (xm + 0.13), yM, zf(uM) - 0.03, sd * 0.12)); G.black.push(box(0.17, 0.09, 0.012, sd * (xm + 0.13), yM, zf(uM) - 0.085, sd * 0.12)); G.black.push(box(0.09, 0.04, 0.07, sd * (xm + 0.03), yM - 0.035, zf(uM) - 0.02));
        G.amber.push(box(0.14, 0.014, 0.02, sd * (xm + 0.15), yM - 0.045, zf(uM) + 0.02, sd * 0.12));
    if (!o.lod) {
      for (const uh of [0.56, 0.38]) { const yh = TOP(uh) - 0.12; if (uh > cU0 && uh < cU1) G[ch].push(rbox(0.035, 0.03, 0.17, 0.012, sd * (bx(uh, yh) + 0.008), yh, zf(uh))); }
      const sy = BOT(0.5) + 0.07; G[S.step ? 'black' : ch].push(box(S.step ? 0.18 : 0.012, S.step ? 0.04 : 0.025, (fz - rz) - ar * 2.4, sd * (bx(0.5, sy) + (S.step ? 0.06 : 0.004)), S.step ? BOT(0.5) - 0.02 : sy, (fz + rz) / 2));
    }
  }
  // ----- передняя часть -----
  const yF = TOP(0.985), botF = sec(0.985).mid - sec(0.985).hh;
  const front = (key, w, h, d, x, y, protr = 0.012, ry = 0) => { const z = zFront(Math.abs(x) + w / 2 * 0.85, y); G[key].push(rbox(w, h, d, Math.min(h, w, d) * 0.3, x, y, z + protr - d / 2 + 0.02, ry)); };
  const strip = (key, xi, xo, y, h, d, rear = false, out = 0.008) => { // полоса, повторяющая изгиб носа/кормы
    const xm = rear ? xRearMax(y) : xFrontMax(y), sg = v => Math.sign(v) * Math.min(Math.abs(v), xm); xi = sg(xi); xo = sg(xo); if (Math.abs(xo - xi) < 0.02) return;
    const zi = rear ? zRear(xi, y) : zFront(xi, y), zo = rear ? zRear(xo, y) : zFront(xo, y), len = Math.hypot(xo - xi, zo - zi), yaw = Math.atan2(zi - zo, xo - xi) * (rear ? 1 : 1);
    const g = new THREE.BoxGeometry(len, h, d); g.rotateY(rear ? -Math.atan2(zo - zi, xo - xi) : yaw); g.translate((xi + xo) / 2, y, (zi + zo) / 2 + (rear ? -out : out)); G[key].push(g);
  };
  const both = f => { f(1); f(-1); };
  const gr = S.grille, hy = yF - (S.n > 5 ? 0.14 : 0.075);
  if (gr === 'merc' || gr === 'maybach' || gr === 'mercVan') {
    const gw = gr === 'mercVan' ? 0.82 : 0.66, gh = gr === 'maybach' ? 0.34 : 0.27, gy = hy - (gr === 'maybach' ? 0.12 : 0.1);
    front(ch, gw + 0.05, gh + 0.05, 0.12, 0, gy, 0.015);
    front('black', gw, gh, 0.12, 0, gy, 0.022);
    const z0 = zFront(0, gy) + 0.05;
    const nb = gr === 'maybach' ? 22 : 7; for (let i = 0; i < nb; i++) { const x = -gw / 2 + gw * (i + 0.5) / nb; G[ch].push(box(gr === 'maybach' ? 0.008 : 0.016, gh - 0.02, 0.02, x, gy, z0)); }
    if (gr !== 'maybach') G[ch].push(box(gw - 0.02, 0.022, 0.025, 0, gy, z0 + 0.008));
    const em = new THREE.TorusGeometry(gr === 'maybach' ? 0.04 : 0.065, 0.009, 6, 20); em.translate(0, gr === 'maybach' ? gy + gh / 2 + 0.06 : gy, z0 + 0.03); G.chrome.push(em);
    for (let i = 0; i < 3; i++) { const b = new THREE.BoxGeometry(0.009, gr === 'maybach' ? 0.035 : 0.06, 0.008); b.translate(0, gr === 'maybach' ? 0.0175 : 0.03, 0); b.rotateZ(i * Math.PI * 2 / 3); b.translate(0, gr === 'maybach' ? gy + gh / 2 + 0.06 : gy, z0 + 0.03); G.chrome.push(b); }
  } else if (gr === 'mercSport') {
    const gw = 0.7, gh = 0.24, gy = hy - 0.11;
    front('black', gw, gh, 0.12, 0, gy, 0.02);
    const z0 = zFront(0, gy) + 0.05; G.chrome.push(box(gw - 0.06, 0.03, 0.02, 0, gy, z0));
    const em = new THREE.TorusGeometry(0.1, 0.012, 6, 24); em.translate(0, gy, z0 + 0.03); G.chrome.push(em);
    for (let i = 0; i < 3; i++) { const b = new THREE.BoxGeometry(0.012, 0.095, 0.01); b.translate(0, 0.047, 0); b.rotateZ(i * Math.PI * 2 / 3); b.translate(0, gy, z0 + 0.035); G.chrome.push(b); }
    for (let i = 0; i < 40; i++) G.chrome.push(sph(0.008, -gw / 2 + 0.04 + (i % 10) * 0.068, gy - 0.08 + Math.floor(i / 10) * 0.05, z0 - 0.005, 1, 1, 0.5, 4));
  } else if (gr === 'kidney') {
    const gy = hy - 0.12, gh = 0.4;
    both(sd => { front(ch, 0.34, gh, 0.12, sd * 0.19, gy, 0.02); front('black', 0.28, gh - 0.06, 0.12, sd * 0.19, gy, 0.028); const z0 = zFront(0.19, gy) + 0.06; for (let i = 0; i < 6; i++) G[ch].push(box(0.012, gh - 0.08, 0.02, sd * (0.07 + i * 0.045), gy, z0)); });
    const em = new THREE.CylinderGeometry(0.05, 0.05, 0.015, 20); em.rotateX(Math.PI / 2 - 0.6); em.translate(0, yF + 0.005, zFront(0, yF - 0.02) - 0.02); G.chrome.push(em);
  } else if (gr === 'g') {
    const gy = hy - 0.12, gw = 0.82, gh = 0.3;
    front('black', gw, gh, 0.1, 0, gy, 0.02);
    const z0 = zFront(0, gy) + 0.04; for (let i = 0; i < 3; i++) G[ch].push(box(gw - 0.04, 0.03, 0.025, 0, gy - gh / 2 + 0.07 + i * 0.085, z0));
    const em = new THREE.TorusGeometry(0.07, 0.01, 6, 20); em.translate(0, gy, z0 + 0.03); G.chrome.push(em);
    for (let i = 0; i < 3; i++) { const b = new THREE.BoxGeometry(0.01, 0.065, 0.01); b.translate(0, 0.032, 0); b.rotateZ(i * Math.PI * 2 / 3); b.translate(0, gy, z0 + 0.03); G.chrome.push(b); }
  } else if (gr === 'toyota') {
    const gy = hy - 0.18, gw = 1.12, gh = 0.5;
    front(ch, gw + 0.06, gh + 0.06, 0.12, 0, gy, 0.012);
    front('black', gw, gh, 0.12, 0, gy, 0.02);
    const z0 = zFront(0, gy) + 0.05; for (let i = 0; i < 5; i++) G[ch].push(box(gw - 0.04, 0.035, 0.03, 0, gy - gh / 2 + 0.06 + i * 0.095, z0));
    G.chrome.push(box(0.26, 0.06, 0.02, 0, gy + gh / 2 - 0.05, z0 + 0.02));
  } else if (gr === 'spindle') {
    const gy = hy - 0.17, gw = 1.0, gh = 0.52;
    const sh = new THREE.Shape(); sh.moveTo(-gw * 0.38, gh / 2); sh.lineTo(gw * 0.38, gh / 2); sh.lineTo(gw * 0.3, 0.02); sh.lineTo(gw / 2, -gh / 2); sh.lineTo(-gw / 2, -gh / 2); sh.lineTo(-gw * 0.3, 0.02); sh.closePath();
    const z0 = zFront(0.3, gy); const gg = new THREE.ExtrudeGeometry(sh, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.02, bevelSegments: 1 }); gg.translate(0, gy, z0 - 0.02); G.chrome.push(gg);
    const gi = new THREE.ExtrudeGeometry(sh, { depth: 0.09, bevelEnabled: false }); gi.scale(0.93, 0.92, 1); gi.translate(0, gy, z0 - 0.0); G.black.push(gi);
    for (let i = 0; i < 16; i++) G.chrome.push(box(0.012, gh * 0.8, 0.02, -gw * 0.42 + i * gw * 0.056, gy - 0.02, z0 + 0.075));
  } else if (gr === 'mercSuv') {
    const gw = 0.86, gh = 0.36, gy = hy - 0.15;
    front(ch, gw + 0.05, gh + 0.05, 0.12, 0, gy, 0.012); front('black', gw, gh, 0.12, 0, gy, 0.02);
    const z0 = zFront(0, gy) + 0.05; for (let i = 0; i < 2; i++) G[ch].push(box(gw - 0.03, 0.035, 0.025, 0, gy - 0.06 + i * 0.12, z0));
    const em = new THREE.TorusGeometry(0.09, 0.012, 6, 24); em.translate(0, gy, z0 + 0.03); G.chrome.push(em);
    for (let i = 0; i < 3; i++) { const b = new THREE.BoxGeometry(0.012, 0.085, 0.01); b.translate(0, 0.042, 0); b.rotateZ(i * Math.PI * 2 / 3); b.translate(0, gy, z0 + 0.035); G.chrome.push(b); }
  } else if (gr === 'rr') {
    const gw = 0.9, gh = 0.2, gy = hy - 0.06;
    front('black', gw, gh, 0.1, 0, gy, 0.02); const z0 = zFront(0, gy) + 0.04;
    for (let i = 0; i < 26; i++) for (let k = 0; k < 4; k++) G.chrome.push(box(0.018, 0.018, 0.01, -gw / 2 + 0.03 + i * 0.034, gy - 0.07 + k * 0.045, z0));
    G.chrome.push(box(0.46, 0.035, 0.02, 0, yF - 0.035, zFront(0, yF - 0.04) + 0.012));
  } else if (gr === 'tahoe') {
    const gw = 1.25, gh = 0.48, gy = hy - 0.17;
    front('black', gw, gh, 0.12, 0, gy, 0.02); const z0 = zFront(0, gy) + 0.05;
    G[ch].push(box(gw + 0.08, 0.1, 0.04, 0, gy + 0.02, z0 + 0.01));
    G[ch].push(box(gw, 0.04, 0.03, 0, gy + gh / 2 - 0.02, z0)); G[ch].push(box(gw, 0.04, 0.03, 0, gy - gh / 2 + 0.03, z0));
    G.amber.push(box(0.2, 0.08, 0.02, 0, gy + 0.02, z0 + 0.04));
  } else if (gr === 'camry') {
    const gy = hy - 0.06; front('black', 0.62, 0.07, 0.08, 0, gy, 0.015); const z0 = zFront(0, gy) + 0.03; G.chrome.push(box(0.62, 0.02, 0.02, 0, gy + 0.04, z0));
    const sh = new THREE.Shape(); sh.moveTo(-0.62, 0.12); sh.lineTo(0.62, 0.12); sh.lineTo(0.48, -0.12); sh.lineTo(-0.48, -0.12); sh.closePath();
    const gg = new THREE.ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: false }); gg.translate(0, botF + 0.22, zFront(0.5, botF + 0.22) - 0.07); G.black.push(gg);
    G.chrome.push(new THREE.TorusGeometry(0.06, 0.01, 6, 20).scale(1.4, 1, 1).translate(0, gy, z0 + 0.03));
  } else if (gr === 'spindleCar') {
    const gy = hy - 0.17, gw = 0.9, gh = 0.5;
    const sh = new THREE.Shape(); sh.moveTo(-gw * 0.3, gh / 2); sh.lineTo(gw * 0.3, gh / 2); sh.lineTo(gw * 0.22, 0.06); sh.lineTo(gw / 2, -gh / 2); sh.lineTo(-gw / 2, -gh / 2); sh.lineTo(-gw * 0.22, 0.06); sh.closePath();
    const z0 = zFront(0.25, gy); const gg = new THREE.ExtrudeGeometry(sh, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.016, bevelSegments: 1 }); gg.translate(0, gy, z0 - 0.03); G.chrome.push(gg);
    const gi = new THREE.ExtrudeGeometry(sh, { depth: 0.09, bevelEnabled: false }); gi.scale(0.93, 0.92, 1); gi.translate(0, gy, z0 - 0.01); G.black.push(gi);
    for (let i = 0; i < 9; i++) for (let k = 0; k < 9; k++) G.chrome.push(box(0.03, 0.012, 0.01, -gw * 0.36 + i * gw * 0.09, gy - gh * 0.38 + k * gh * 0.085, z0 + 0.075, 0, 0, 0.6));
  } else if (gr === 'lc200') {
    const gw = 0.95, gh = 0.38, gy = hy - 0.13;
    front(ch, gw + 0.05, gh + 0.05, 0.12, 0, gy, 0.012); front('black', gw, gh, 0.12, 0, gy, 0.02);
    const z0 = zFront(0, gy) + 0.05; for (let i = 0; i < 3; i++) G[ch].push(box(gw - 0.04, 0.045, 0.03, 0, gy - gh / 2 + 0.07 + i * 0.12, z0));
    G.chrome.push(new THREE.TorusGeometry(0.07, 0.01, 6, 20).scale(1.4, 1, 1).translate(0, gy, z0 + 0.04));
  } else if (gr === 'audi') {
    const gy = hy - 0.17, gw = 0.82, gh = 0.48;
    const sh = new THREE.Shape(); sh.moveTo(-gw * 0.42, gh / 2); sh.lineTo(gw * 0.42, gh / 2); sh.lineTo(gw / 2, gh * 0.25); sh.lineTo(gw * 0.44, -gh / 2); sh.lineTo(-gw * 0.44, -gh / 2); sh.lineTo(-gw / 2, gh * 0.25); sh.closePath();
    const z0 = zFront(0.3, gy); const gg = new THREE.ExtrudeGeometry(sh, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.014, bevelSegments: 1 }); gg.translate(0, gy, z0 - 0.03); G.chrome.push(gg);
    const gi = new THREE.ExtrudeGeometry(sh, { depth: 0.09, bevelEnabled: false }); gi.scale(0.94, 0.93, 1); gi.translate(0, gy, z0 - 0.01); G.black.push(gi);
    for (let i = 0; i < 7; i++) G.chrome.push(box(gw * 0.86, 0.01, 0.01, 0, gy - gh * 0.38 + i * gh * 0.12, z0 + 0.085));
    for (let i = 0; i < 4; i++) G.chrome.push(new THREE.TorusGeometry(0.04, 0.007, 5, 16).translate(-0.09 + i * 0.06, gy + gh / 2 - 0.08, z0 + 0.095));
  } else if (gr === 'chevy') {
    const gy = hy - 0.08; front('black', 0.86, 0.12, 0.1, 0, gy, 0.015); const z0 = zFront(0, gy) + 0.04; G.chrome.push(box(0.86, 0.03, 0.02, 0, gy + 0.075, z0 - 0.01));
    front('black', 0.95, 0.2, 0.1, 0, botF + 0.2, 0.01);
  } else if (gr === 'nexia') {
    const gy = hy - 0.06; front('black', 0.7, 0.13, 0.08, 0, gy, 0.012); const z0 = zFront(0, gy) + 0.03; for (let i = 0; i < 3; i++) G.chrome.push(box(0.68, 0.012, 0.015, 0, gy - 0.04 + i * 0.04, z0));
  }
  // нижние воздухозаборники
  if (!['chevy', 'nexia', 'g', 'toyota', 'tahoe', 'camry', 'lc200', 'rr'].includes(gr)) { front('black', 0.8, 0.07, 0.1, 0, botF + 0.13, 0.006); both(sd => { strip('black', sd * 0.55, sd * 0.78, botF + 0.18, 0.06, 0.05, false, 0.012); strip('chrome', sd * 0.55, sd * 0.78, botF + 0.22, 0.012, 0.04, false, 0.02); }); }
  else if (gr === 'rr') { front('black', 1.0, 0.18, 0.1, 0, botF + 0.2, 0.01); both(sd => front('black', 0.2, 0.08, 0.1, sd * 0.7, botF + 0.22, 0.014)); }
  else if (gr === 'g' || gr === 'toyota' || gr === 'tahoe' || gr === 'lc200') { front('dark', W * 0.92, 0.2, 0.18, 0, botF + 0.14, 0.05); }
  // фары: тёмный корпус, отражатель и полоса ходовых огней, изогнутые по носу
  const seg = (key, xi, xo, y, h, d, rear, out, n = 4) => { for (let k = 0; k < n; k++) strip(key, xi + (xo - xi) * k / n, xi + (xo - xi) * (k + 1) / n, y, h, d, rear, out); };
  const unit = (sd, xi, xo, y, h, o2 = {}) => {
    seg('black', sd * xi, sd * xo, y, h + 0.035, 0.05, false, 0.014);
    if (o2.cubes) { for (let i = 0; i < 3; i++) { const a = xi + 0.04 + i * (xo - xi - 0.08) / 3; seg('head', sd * a, sd * (a + (xo - xi - 0.08) / 3 - 0.02), y - 0.01, h * 0.5, 0.05, false, 0.024, 1); } }
    else if (!o2.noLens) seg('head', sd * (xi + 0.03), sd * (xo - 0.03), y + (o2.lensDy || 0), h * (o2.lensH || 0.55), 0.05, false, 0.024);
    if (!o.lod && !o2.cubes) for (const f of [0.3, 0.62]) { const x = sd * (xi + (xo - xi) * f), yy = y + (o2.lensDy || 0), r = Math.min(0.045, h * 0.32); G.chrome.push(cyl(r, r * 0.8, 0.03, 14, x, yy, zFront(Math.abs(x) + r, yy) + 0.03, 'z')); G.drl.push(cyl(r * 0.45, r * 0.45, 0.02, 10, x, yy, zFront(Math.abs(x) + r, yy) + 0.042, 'z')); }
    const d = o2.drl || 'top';
    if (d === 'top' || d === 'L' || d === 'both') seg('drl', sd * (xi + 0.01), sd * (xo - 0.01), y + h / 2 - 0.006, 0.013, 0.04, false, 0.03);
    if (d === 'bottom' || d === 'both') seg('drl', sd * (xi + 0.03), sd * (xo - 0.02), y - h / 2 + 0.008, 0.013, 0.04, false, 0.03);
    if (d === 'L') strip('drl', sd * (xo - 0.04), sd * (xo - 0.01), y - 0.02, h * 0.9, 0.04, false, 0.03);
    if (d === 'dashes') for (let i = 0; i < 3; i++) strip('drl', sd * (xi + 0.06 + i * 0.07), sd * (xi + 0.1 + i * 0.07), y + h / 2 - 0.01, 0.012, 0.04, false, 0.03);
    if (d === 'brows') { seg('drl', sd * (xi + 0.02), sd * (xo - 0.02), y + h / 2 - 0.006, 0.012, 0.04, false, 0.03); seg('drl', sd * (xi + 0.05), sd * (xo - 0.04), y - h / 2 + 0.01, 0.012, 0.04, false, 0.03); }
  };
  const hd = S.head, xo0 = W / 2 - 0.04;
  if (hd === 'merc') both(sd => unit(sd, 0.5, xo0, hy, 0.1, { drl: 'dashes' }));
  else if (hd === 'mercE') both(sd => unit(sd, 0.48, xo0, hy, 0.11, { drl: 'brows' }));
  else if (hd === 'bmw') both(sd => { unit(sd, 0.42, xo0, hy + 0.01, 0.07, { drl: 'top', lensH: 0.4 }); });
  else if (hd === 'round') both(sd => { const x = sd * (W / 2 - 0.3), y = hy - 0.06, z = zFront(Math.abs(x) + 0.12, y); G.black.push(cyl(0.13, 0.13, 0.1, 22, x, y, z - 0.02, 'z')); G.head.push(cyl(0.1, 0.1, 0.1, 20, x, y, z, 'z')); G.drl.push(new THREE.TorusGeometry(0.115, 0.012, 6, 24).translate(x, y, z + 0.055)); G.amber.push(box(0.12, 0.05, 0.12, sd * (W / 2 - 0.12), TOP(0.97) + 0.03, zf(0.965))); });
  else if (hd === 'lc') both(sd => unit(sd, 0.58, xo0, hy, 0.13, { drl: 'top' }));
  else if (hd === 'lexus') both(sd => { unit(sd, 0.56, xo0, hy, 0.12, { drl: 'top', cubes: true }); strip('drl', sd * (W / 2 - 0.1), sd * (W / 2 - 0.06), hy - 0.14, 0.12, 0.04, false, 0.02); });
  else if (hd === 'rr') both(sd => unit(sd, 0.47, xo0, hy, 0.08, { drl: 'both', lensH: 0.35 }));
  else if (hd === 'tahoe') both(sd => { unit(sd, 0.66, xo0, hy - 0.03, 0.16, { drl: 'top' }); strip('drl', sd * (W / 2 - 0.08), sd * (W / 2 - 0.04), hy - 0.24, 0.2, 0.04, false, 0.02); });
  else if (hd === 'camry') both(sd => unit(sd, 0.36, xo0, hy, 0.09, { drl: 'top' }));
  else if (hd === 'lc200') both(sd => { unit(sd, 0.5, xo0, hy - 0.04, 0.16, { drl: 'top' }); strip('amber', sd * (W / 2 - 0.1), sd * (W / 2 - 0.03), hy - 0.04, 0.1, 0.05, false, 0.026); });
  else if (hd === 'audi') both(sd => { unit(sd, 0.45, xo0, hy, 0.1, { drl: 'bottom', lensH: 0.45, lensDy: 0.015 }); for (let i = 0; i < 6; i++) strip('drl', sd * (0.48 + i * 0.07), sd * (0.51 + i * 0.07), hy - 0.03, 0.03, 0.04, false, 0.032); });
  else if (hd === 'swept') both(sd => unit(sd, 0.5, xo0, hy, 0.11, { drl: 'top' }));
  else if (hd === 'square') both(sd => { unit(sd, 0.38, W / 2 - 0.1, hy - 0.02, 0.13, { drl: 'none', lensH: 0.75 }); strip('amber', sd * (W / 2 - 0.1), sd * (W / 2 - 0.02), hy - 0.02, 0.12, 0.05, false, 0.02); });
  // ----- корма -----
  const yR = TOP(0.015) - 0.1, tl = S.tail;
  const tunit = (sd, xi, xo, y, h, n = 3) => { seg('black', sd * xi, sd * xo, y, h + 0.03, 0.05, true, 0.014, n); seg('tail', sd * (xi + 0.015), sd * (xo - 0.015), y, h, 0.05, true, 0.024, n); if (!o.lod && h > 0.06) for (const f of [-0.22, 0.22]) seg('black', sd * (xi + 0.03), sd * (xo - 0.03), y + h * f, 0.007, 0.04, true, 0.032, n); };
  if (tl === 'merc' || tl === 'mercE') both(sd => { tunit(sd, 0.4, W / 2 - 0.03, yR, 0.12); seg('rev', sd * 0.44, sd * 0.56, yR - 0.03, 0.035, 0.04, true, 0.03, 1); });
  else if (tl === 'bmw') { both(sd => { tunit(sd, 0.5, W / 2 - 0.03, yR, 0.07); tunit(sd, W / 2 - 0.2, W / 2 - 0.04, yR - 0.08, 0.1, 1); }); seg('tail', -0.5, 0.5, yR + 0.015, 0.016, 0.04, true, 0.03, 4); }
  else if (tl === 'g') both(sd => { const x = sd * (W / 2 - 0.1), y = yR - 0.25; G.tail.push(rbox(0.16, 0.3, 0.06, 0.02, x, y, zRear(Math.abs(x) + 0.08, y) - 0.01)); G.rev.push(box(0.1, 0.05, 0.05, x, y - 0.18, zRear(Math.abs(x) + 0.05, y - 0.18) - 0.012)); });
  else if (tl === 'lc') both(sd => { tunit(sd, 0.55, W / 2 - 0.02, yR - 0.05, 0.1); tunit(sd, W / 2 - 0.13, W / 2 - 0.02, yR - 0.2, 0.2, 1); seg('rev', sd * 0.6, sd * 0.72, yR - 0.08, 0.035, 0.04, true, 0.03, 1); });
  else if (tl === 'lexus') { seg('black', -(W / 2 - 0.03), W / 2 - 0.03, yR - 0.04, 0.06, 0.05, true, 0.014, 6); seg('tail', -(W / 2 - 0.04), W / 2 - 0.04, yR - 0.04, 0.026, 0.05, true, 0.024, 6); both(sd => tunit(sd, W / 2 - 0.16, W / 2 - 0.03, yR - 0.14, 0.16, 1)); }
  else if (tl === 'van') both(sd => { const x = sd * (W / 2 - 0.08), y = yR - 0.2; G.tail.push(rbox(0.14, 0.5, 0.06, 0.03, x, y, zRear(Math.abs(x) + 0.07, y) - 0.012)); });
  else if (tl === 'hatch') both(sd => { const x = sd * (W / 2 - 0.1), y = yR + 0.05; G.tail.push(rbox(0.16, 0.3, 0.06, 0.03, x, y, zRear(Math.abs(x) + 0.08, y) - 0.012)); });
  else if (tl === 'mercSuv') { both(sd => { tunit(sd, 0.42, W / 2 - 0.03, yR - 0.05, 0.09); tunit(sd, W / 2 - 0.25, W / 2 - 0.03, yR - 0.13, 0.07, 1); }); seg('chrome', -0.42, 0.42, yR - 0.05, 0.03, 0.04, true, 0.02, 4); }
  else if (tl === 'rr') both(sd => { const x = sd * (W / 2 - 0.06), y = yR - 0.12; G.tail.push(rbox(0.08, 0.5, 0.05, 0.02, x, y, zRear(Math.abs(x) + 0.04, y) - 0.012)); seg('black', -0.5, 0.5, yR - 0.02, 0.1, 0.04, true, 0.016, 4); });
  else if (tl === 'tahoe') both(sd => { const x = sd * (W / 2 - 0.08), y = yR - 0.22; G.tail.push(rbox(0.13, 0.55, 0.06, 0.02, x, y, zRear(Math.abs(x) + 0.07, y) - 0.012)); seg('chrome', -0.45, 0.45, yR - 0.08, 0.05, 0.04, true, 0.02, 4); });
  else if (tl === 'camry') both(sd => { tunit(sd, 0.3, W / 2 - 0.03, yR - 0.02, 0.09); tunit(sd, W / 2 - 0.15, W / 2 - 0.03, yR - 0.09, 0.07, 1); });
  else if (tl === 'audi') { both(sd => tunit(sd, 0.45, W / 2 - 0.03, yR, 0.09)); seg('tail', -0.45, 0.45, yR + 0.02, 0.018, 0.04, true, 0.03, 4); }
  else both(sd => { tunit(sd, 0.35, W / 2 - 0.04, yR, 0.12); seg('amber', sd * 0.35, sd * 0.45, yR, 0.12, 0.05, true, 0.03, 1); });
  const botR = sec(0.015).mid - sec(0.015).hh;
  G.black.push(box(W * 0.8, 0.12, 0.1, 0, botR + 0.12, zRear(W * 0.4, botR + 0.12) - 0.01));
  if (!['nexia', 'sedan', 'hatch', 'damas'].includes(o.kindKey) && !o.lod && !S.spare) both(sd => G[ch].push(rbox(0.16, 0.06, 0.08, 0.02, sd * 0.55, botR + 0.11, zRear(0.6, botR + 0.11) - 0.02)));
  // особенности моделей
  if (S.spare) { const y = yR - 0.15, z = zRear(0, y); G.dark.push(cyl(wr * 0.95, wr * 0.95, 0.24, 24, 0, y, z - 0.13, 'z')); G[o.armored ? 'black' : 'paint'].push(cyl(wr * 0.75, wr * 0.75, 0.25, 24, 0, y, z - 0.135, 'z')); G.chrome.push(new THREE.TorusGeometry(wr * 0.62, 0.012, 6, 30).translate(0, y, z - 0.26)); }
  if (S.rails || S.spare) both(sd => { const um = (S.roofCap[0] + S.roofCap[1]) / 2, c = csec(um), len = (S.roofCap[1] - S.roofCap[0]) * L * 0.86, y = c.mid + c.hh * 0.97 + 0.02, x = sd * c.hw * 0.66; G[S.spare ? 'black' : ch].push(rbox(0.035, 0.03, len, 0.012, x, y + 0.035, zf(um))); for (const f of [-0.45, 0.45]) G.black.push(box(0.035, 0.05, 0.08, x, y + 0.01, zf(um) + f * len)); });
  if (S.spare) both(sd => { for (const uh of [0.55, 0.32]) G.black.push(box(0.03, 0.05, 0.1, sd * (bx(uh, TOP(uh) - 0.25) + 0.01), TOP(uh) - 0.25, zf(uh))); });
  if (S.slide) both(sd => G.black.push(box(0.012, 0.02, L * 0.3, sd * (bx(0.45, TOP(0.45) + 0.2) + 0.002), TOP(0.45) + 0.18, zf(0.4))));
  if (!o.lod) { const uA = (S.roofCap[0] * 0.3 + S.roofCap[1] * 0.7) - 0.18; G.black.push(sph(0.05, 0, CAB(Math.max(cU0 + 0.05, S.roofCap[0])) + 0.01, zf(Math.max(cU0 + 0.05, S.roofCap[0]) + 0.02), 0.5, 0.6, 2.2, 8)); }
  if (o.armored) { G.dark.push(box(W * 0.95, 0.06, 0.1, 0, botF + 0.1, zFront(0, botF + 0.1) + 0.06)); }
  if (!o.lod) {
    const uw = cU1 - 0.014, yw = Math.max(CAB(uw), TOP(uw)) + 0.012, zw = zf(uw);
    for (const [x0, ang] of [[-0.36, 0.08], [0.27, 0.06]]) { const g = new THREE.BoxGeometry(0.6, 0.016, 0.022); g.rotateY(ang); g.translate(x0, yw, zw); G.black.push(g); }
    G.tail.push(box(0.42, 0.022, 0.025, 0, CAB(r0) - 0.012, zf(r0) - 0.015));
    both(sd => G.tail.push(box(0.13, 0.03, 0.02, sd * (W / 2 - 0.26), botR + 0.21, zRear(W / 2 - 0.2, botR + 0.21) - 0.014)));
  }
  G.badge = { x: S.badgeC ? 0 : -0.48, y: yR + (S.badgeC ? -0.12 : 0.03), z: zRear(S.badgeC ? 0.2 : 0.55, yR + 0.03) - 0.014, emblem: { y: yR + 0.06, z: zRear(0.08, yR + 0.06) - 0.016 } };
  // номерные знаки
  const pf = S.plateF ?? 0.42, pr = S.plateR ?? 0.62;
  G.plateF = { y: pf, z: zFront(0.27, pf) + 0.02 }; G.plateR = { y: pr, z: zRear(0.27, pr) - (S.spare ? 0.005 : 0.016) };
  const zRearDoor = suv ? zf(cU0 + 0.07) : Math.max(zf(cU0 + 0.05), rz + ar + 0.06);
  const panel = { doors: [zf(cU1) - 0.06, zf(bU), zRearDoor], belt: TOP(bU) + 0.03, bot: BOT(0.5) + 0.1, hoodZ: zf(cU1) + 0.06, hoodX: bx(0.85, TOP(0.85) - 0.02) * 0.8, trunkZ: suv ? -99 : zf(cU0) - 0.08, trunkX: bx(0.1, TOP(0.1) - 0.02) * 0.8, tailX: suv ? bx(0.03, TOP(0.03) - 0.3) * 0.82 : 0, clad: S.clad ?? (suv && !S.spare ? BOT(0.5) + 0.26 : 0), arch: (suv || S.flare) ? [fz, rz, wr, ar + 0.1] : [0, 0, 0, 0] };
  return { G, panel, sec, bx, zf, TOP, CAB, fz, rz, hl, cU0, cU1, ws: zf(cU1), roofTop: CAB((S.roofCap[0] + S.roofCap[1]) / 2), roofMid: zf((S.roofCap[0] + S.roofCap[1]) / 2) };
}
// разрез сечения по высоте (для двухцветного кузова)
function loftSplit(N, M, sec, zf, tS, upper, clampY) {
  const pos = [], idx = [], ring = M + 1;
  for (let i = 0; i <= N; i++) {
    const u = 0.5 - 0.5 * Math.cos(Math.PI * i / N), s = sec(u), z = zf(u), ex = 2 / s.n, ts = tS(u);
    for (let j = 0; j < ring; j++) {
      const f = j / M, th = upper ? ts + (Math.PI - 2 * ts) * f : Math.PI - ts + (Math.PI + 2 * ts) * f;
      const c = Math.cos(th), sn = Math.sin(th); const e2 = sn < 0 ? 2 / (s.nb || s.n) : ex; let x = s.hw * Math.sign(c) * Math.pow(Math.abs(c), e2), yy = Math.sign(sn) * Math.pow(Math.abs(sn), e2);
      if (yy > 0) x *= 1 - s.tum * Math.pow(yy, 1.5); else x *= 1 - s.tuck * yy * yy;
      if (s.crease) x *= 1 + s.crease * (Math.exp(-(((yy - 0.42) / 0.07) ** 2)) - 0.6 * Math.exp(-(((yy + 0.35) / 0.12) ** 2)));
      pos.push(x, Math.max(s.mid + s.hh * yy, clampY(z, s)), z);
    }
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) { const a = i * ring + j, b = a + 1, c = a + ring, d = c + 1; idx.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}

// ---------- номерной знак ----------
function plateTexture(p) {
  const c = makeCanvas(512, 112), g = c.getContext('2d');
  const dip = p.type === 'dip';
  g.fillStyle = dip ? '#0b7a3d' : '#f3f4f0'; g.beginPath(); g.roundRect(3, 3, 506, 106, 12); g.fill();
  g.lineWidth = 6; g.strokeStyle = '#111'; g.stroke();
  const ink = dip ? '#ffffff' : '#111111';
  g.fillStyle = ink; g.textBaseline = 'middle'; g.textAlign = 'center';
  g.font = '700 64px "Arial Narrow", Arial, sans-serif'; g.fillText(p.region, 54, 60);
  g.fillRect(104, 12, 4, 88);
  const txt = p.type === 'private' ? p.num + ' ' + p.code : p.code + ' ' + p.num; g.font = '700 74px "Arial Narrow", Arial, sans-serif';
  const mw = g.measureText(txt).width, maxW = 300;
  g.save(); g.translate(270, 60); if (mw > maxW) g.scale(maxW / mw, 1); g.fillText(txt, 0, 0); g.restore();
  drawUzFlag(g, 440, 20, 52, 32);
  g.fillStyle = ink; g.font = '800 28px Arial, sans-serif'; g.fillText('UZ', 466, 80);
  return texFrom(c, { aniso: 8 });
}

// ---------- материалы ----------
const MAT = {};
function initMaterials() {
  MAT.glass = new THREE.MeshPhysicalMaterial({ color: 0x0a0d12, metalness: 0.1, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.7 });
  MAT.chrome = new THREE.MeshStandardMaterial({ color: 0xe6e9ee, metalness: 1, roughness: 0.1 });
  MAT.black = new THREE.MeshPhysicalMaterial({ color: 0x050607, metalness: 0.3, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05 });
  MAT.dark = new THREE.MeshStandardMaterial({ color: 0x16181b, metalness: 0.1, roughness: 0.72 });
  MAT.well = new THREE.MeshStandardMaterial({ color: 0x07080a, roughness: 0.95 });
  MAT.head = new THREE.MeshPhysicalMaterial({ color: 0x9aa4b0, emissive: 0xffffff, emissiveIntensity: 0.12, metalness: 0.9, roughness: 0.12, clearcoat: 1 });
  MAT.drl = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xe8f1ff, emissiveIntensity: 2.6 });
  MAT.amber = new THREE.MeshStandardMaterial({ color: 0x8a5200, emissive: 0xff8a00, emissiveIntensity: 0.25, roughness: 0.3 });
  const tc = makeCanvas(1024, 64), tg = tc.getContext('2d'); tg.fillStyle = '#7a7a7a'; tg.fillRect(0, 0, 1024, 64);
  tg.fillStyle = '#2a2a2a'; for (let x = 0; x < 1024; x += 9) tg.fillRect(x, 24, 3, 16); for (const y of [22, 31, 40]) tg.fillRect(0, y, 1024, 2);
  tg.fillStyle = '#9a9a9a'; for (let x = 0; x < 1024; x += 128) { tg.fillRect(x + 10, 6, 70, 3); tg.fillRect(x + 10, 55, 70, 3); }
  const tt = new THREE.CanvasTexture(tc); tt.wrapS = THREE.RepeatWrapping; tt.repeat.set(3, 1);
  MAT.tire = new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.86, side: THREE.DoubleSide, bumpMap: tt, bumpScale: 2.2 });
  MAT.rimChrome = new THREE.MeshStandardMaterial({ color: 0xe6e9ee, metalness: 0.85, roughness: 0.26, side: THREE.DoubleSide, envMapIntensity: 1.4 });
  MAT.rimSilver = new THREE.MeshStandardMaterial({ color: 0xd2d6dc, metalness: 0.8, roughness: 0.3, side: THREE.DoubleSide, envMapIntensity: 1.3 });
  MAT.rimDark = new THREE.MeshStandardMaterial({ color: 0x2a2d32, metalness: 0.9, roughness: 0.3, side: THREE.DoubleSide });
  MAT.rimSteel = new THREE.MeshStandardMaterial({ color: 0x8e939a, metalness: 0.6, roughness: 0.45, side: THREE.DoubleSide });
  MAT.vcolMetal = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.7, roughness: 0.4 });
  MAT.stripe = new THREE.MeshStandardMaterial({ color: 0x1d4fc4, roughness: 0.4, metalness: 0.2 });
  MAT.leather = new THREE.MeshStandardMaterial({ color: 0x2b2420, roughness: 0.72 });
  MAT.vcol = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78 });
}
const FINISH_PROPS = { f_gloss: { metalness: 0.55, roughness: 0.28, clearcoat: 1 }, f_metal: { metalness: 0.88, roughness: 0.36, clearcoat: 1 }, f_matte: { metalness: 0.2, roughness: 0.62, clearcoat: 0 } };
function paintMat(color, finish = 'f_gloss') { const f = FINISH_PROPS[finish] || FINISH_PROPS.f_gloss; return new THREE.MeshPhysicalMaterial({ color, metalness: f.metalness, roughness: f.roughness, clearcoat: f.clearcoat, clearcoatRoughness: 0.03, envMapIntensity: 1.25 }); }
const RIM_MAT = { r_classic: 'rimChrome', r_amg: 'rimDark', r_mono: 'rimSilver' };
const RIM_STYLE = { r_classic: null, r_amg: 'multi', r_mono: 'mono' };
