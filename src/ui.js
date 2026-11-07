
/* =====================================================================
   UI — экраны, гараж, задания, рекорды, HUD, спидометр, мини-карта
   ===================================================================== */
class UI {
  constructor(game) {
    this.g = game; this.sp = $('speedo'); this.spg = this.sp.getContext('2d'); this.mini = $('mini'); this.mg = this.mini.getContext('2d'); this.hudT = 0; this.gTab = 'car';
    this.screens = ['menu', 'roles', 'levels', 'brief', 'garage', 'tasks', 'boardScr', 'settings', 'help', 'pause', 'result', 'freeScr'];
    $('bStart').onclick = () => { game.audio.init(); this.openRoles(); };
    $('bRoles2').onclick = () => { game.audio.init(); this.openRoles(); };
    $('bRolesBack').onclick = () => this.show('menu');
    $('bFree').onclick = () => { game.audio.init(); this.openFree(); };
    $('bFreeBack').onclick = () => this.show('menu');
    $('bFreeGo').onclick = () => { game.audio.init(); game.startFree(); };
    for (const [id, key] of [['frTod', 'tod'], ['frWeather', 'weather'], ['frTraffic', 'traffic']]) $(id).addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; Store.data.free[key] = key === 'traffic' ? b.dataset.v === '1' : b.dataset.v; Store.save(); this.syncFree(); });
    $('sirSeg').innerHTML = SIRENS.map(x => `<button type="button" data-v="${x.id}">${x.name}</button>`).join('');
    $('pSirSeg').innerHTML = SIRENS.filter(x => x.id !== 'auto').map(x => `<button type="button" data-v="${x.id}">${x.name}</button>`).join('');
    $('sirSeg').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; Store.data.siren = b.dataset.v; Store.save(); this.syncSettings(); });
    $('pSirSeg').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; Store.data.pSiren = b.dataset.v; Store.save(); this.syncSettings(); });
    $('bRolesNext').onclick = () => this.openLevels();
    $('bLevelsBack').onclick = () => this.openRoles();
    $('bLevelsNext').onclick = () => game.prepare(() => this.openBrief());
    $('bBack').onclick = () => this.openLevels();
    $('bGo').onclick = () => { game.audio.init(); game.startLevel(); };
    $('bGarage').onclick = () => { game.audio.init(); game.openGarage(); };
    $('bGarageOk').onclick = () => game.closeGarage();
    $('bTasks').onclick = () => this.openTasks(); $('bTasksOk').onclick = () => this.show('menu');
    $('bBoard').onclick = () => this.openBoard(); $('bBoardOk').onclick = () => this.show('menu');
    $('boardLevel').onchange = () => this.fillBoard(); $('bReplay').onclick = () => game.startReplay($('boardLevel').value);
    $('bReplayExit').onclick = () => game.toMenu();
    $('bHelp').onclick = () => { this.ret = 'menu'; this.show('help'); this.showCredits(); };
    $('bHelpOk').onclick = () => this.show(this.ret || 'menu');
    $('bSet').onclick = () => { this.ret = 'menu'; this.openSettings(); };
    $('bPSet').onclick = () => { this.ret = 'pause'; this.openSettings(); };
    $('bSetOk').onclick = () => this.show(this.ret || 'menu');
    $('bResume').onclick = () => game.togglePause(false);
    $('bRestart').onclick = () => game.state === 'free' ? game.startFree() : game.startLevel();
    $('bMenu').onclick = () => game.toMenu();
    $('bPhoto').onclick = () => { if (!Store.data.photo) { if (Store.data.wallet >= 800) { Store.data.wallet -= 800; Store.data.photo = true; Store.save(); this.toast('Режим фото открыт', 'gold'); this.syncPause(); } else this.toast(`Нужно ещё ${fmtPts(800 - Store.data.wallet)} очков`, 'bad'); return; } game.photo.toggle(true); };
    $('bAgain').onclick = () => game.startLevel();
    $('bNext').onclick = () => this.openLevels();
    $('bResMenu').onclick = () => game.toMenu();
    $('bPause').onclick = () => game.togglePause(true);
    $('qSeg').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; Store.data.quality = b.dataset.q; Store.save(); game.setQuality(b.dataset.q); this.syncSettings(); });
    $('vol').addEventListener('input', e => { Store.data.volume = +e.target.value; Store.save(); game.audio.setVolume(+e.target.value); });
    $('rvol').addEventListener('input', e => { Store.data.radio = +e.target.value; Store.save(); game.audio.setRadioVolume(+e.target.value); });
    $('fpsChk').addEventListener('change', e => { Store.data.showFps = e.target.checked; Store.save(); $('fps').hidden = !e.target.checked; });
    $('fps').hidden = !Store.data.showFps;
    document.querySelector('.gtabs').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; this.gTab = b.dataset.t; this.renderGarage(); });
  }
  show(name) { for (const s of this.screens) $(s).hidden = s !== name; if (name === 'menu') this.updateMenu(); if (name === 'pause') this.syncPause(); }
  hideAll() { for (const s of this.screens) $(s).hidden = true; }
  wallet() { for (const id of ['rolesWallet', 'levelsWallet', 'gWallet', 'tasksWallet']) $(id).textContent = fmtPts(Store.data.wallet); }
  spend(cost, onOk) { if (Store.data.wallet < cost) { this.toast(`Нужно ещё ${fmtPts(cost - Store.data.wallet)} очков`, 'bad'); return false; } Store.data.wallet -= cost; onOk(); Store.save(); this.wallet(); return true; }
  plateChip(p) { return `<span class="plate-chip${p.type === 'dip' ? ' dip' : ''}">${p.region} · ${p.type === 'private' ? p.num + ' ' + p.code : p.code + ' ' + p.num}</span>`; }
  updateMenu() {
    const d = Store.data, r = ROLE(d.role), L = LEVEL_BY(d.level), p = plateOf(d.role);
    $('menuCreds').innerHTML = `<span class="lbl">Должность</span><b>${r.name}</b><span class="lbl">Машина</span><b>${CARS[d.car].name}</b><span class="lbl">Номер</span><span>${this.plateChip(p)}</span><span class="lbl">Маршрут</span><b>${L.name} → ${DEST[r.dest].name}</b>`;
    const b = d.best[L.id];
    $('bestLine').innerHTML = `Очки: <span class="pts">${fmtPts(d.wallet)}</span>` + (b ? ` · лучший на маршруте: <span class="stars">${'★'.repeat(b.stars)}${'☆'.repeat(3 - b.stars)}</span> ${fmtPts(b.score)}` : '');
  }
  // ---------- роли ----------
  openRoles() {
    this.wallet(); const d = Store.data;
    $('roleCards').innerHTML = ROLES.map(r => {
      const own = d.roles.includes(r.id), p = plateOf(r.id), n = r.escort.length;
      return `<button class="card${own ? '' : ' locked'}" type="button" data-id="${r.id}" aria-pressed="${d.role === r.id}">
        ${own ? '' : `<span class="lock">${fmtPts(r.cost)} очков</span>`}
        <span class="ic">${svgIcon(r.icon)}</span><h3>${r.name}</h3><p>${r.desc}</p>
        <div class="meta"><span>${this.plateChip(p)}</span><span>Эскорт: ${n}</span><span>Свобода ${r.freedom} км/ч</span><span>Сложность <span class="dots">${[1, 2, 3].map(i => `<i class="${i <= r.diff ? 'on' : ''}"></i>`).join('')}</span></span><span>${DEST[r.dest].name}</span></div></button>`;
    }).join('');
    $('roleCards').onclick = e => {
      const c = e.target.closest('.card'); if (!c) return; const r = ROLE(c.dataset.id);
      if (!d.roles.includes(r.id)) { if (!this.spend(r.cost, () => { d.roles.push(r.id); this.toast(`Роль «${r.name}» открыта`, 'gold'); })) return; }
      d.role = r.id; Store.save(); this.openRoles();
    };
    this.show('roles');
  }
  // ---------- маршруты ----------
  openLevels() {
    this.wallet(); const d = Store.data;
    $('levelCards').innerHTML = LEVELS.map(L => {
      const own = d.levels.includes(L.id), b = d.best[L.id];
      return `<button class="card${own ? '' : ' locked'}" type="button" data-id="${L.id}" aria-pressed="${d.level === L.id}">
        ${own ? '' : `<span class="lock">${fmtPts(L.cost)} очков</span>`}
        <span class="ic">${svgIcon(L.bonus ? 'star' : 'road')}</span><h3>${L.name}</h3><p>${L.desc}</p>
        <div class="meta"><span>${TOD_NAME[L.tod]}</span><span>${WEATHER_NAME[L.weather]}</span>${b ? `<span class="stars">${'★'.repeat(b.stars)}${'☆'.repeat(3 - b.stars)}</span>` : '<span>Ещё не пройден</span>'}</div></button>`;
    }).join('');
    $('levelCards').onclick = e => {
      const c = e.target.closest('.card'); if (!c) return; const L = LEVEL_BY(c.dataset.id);
      if (!d.levels.includes(L.id)) { if (!this.spend(L.cost, () => { d.levels.push(L.id); this.toast(`Маршрут «${L.name}» открыт`, 'gold'); })) return; }
      d.level = L.id; Store.save(); this.openLevels();
    };
    this.show('levels');
  }
  openBrief() {
    const g = this.g, r = ROLE(Store.data.role), L = LEVEL_BY(Store.data.level), p = plateOf(r.id), n = g.escorts.length;
    $('brLbl').textContent = `${TOD_NAME[L.tod]} · ${L.name}`;
    $('brTitle').textContent = `${DEST[r.dest].event} начинается в 09:00`;
    $('brText').textContent = `Держитесь в 20–40 метрах за машиной ЙПХ. Пока связь высокая, инспекторы выходят на перекрёстки и останавливают поперечный поток. Отстанете — встанете на красный вместе со всеми.${L.mountain ? ' На перевале светофоров нет, зато есть встречка и крутые повороты.' : ''}`;
    $('brTime').textContent = fmtTime(g.timeLimit); $('brLen').textContent = fmtDist(g.path.destS); $('brEsc').textContent = `${n} ${plural(n, 'машина', 'машины', 'машин')}`;
    $('brWeather').textContent = WEATHER_NAME[L.weather]; $('brFree').textContent = r.freedom + ' км/ч'; $('brPlate').innerHTML = this.plateChip(p);
    this.show('brief');
  }
  // ---------- гараж ----------
  renderGarage() {
    const g = this.g, d = Store.data, id = g.garage.carId, s = CARS[id], t = tuneOf(id); this.wallet();
    for (const b of document.querySelectorAll('.gtabs button')) b.setAttribute('aria-pressed', String(b.dataset.t === this.gTab));
    $('gName').textContent = s.name; const body = $('gBody');
    if (this.gTab === 'car') {
      const bar = (lbl, v, max, txt) => `<span>${lbl}</span><i><em style="width:${clamp(v / max, 0.04, 1) * 100}%"></em></i><b>${txt}</b>`;
      const t100 = (27.8 / (s.accel * 0.82)).toFixed(1), rad = (s.wb / Math.tan(s.steer) + s.W / 2).toFixed(1);
      body.innerHTML = `<div class="statbars">${bar('Скорость', s.vmax, 70, Math.round(s.vmax * 3.6) + ' км/ч')}${bar('Разгон', 10 - t100, 7, t100 + ' с до 100')}${bar('Управляемость', s.grip, 8.6, (s.grip * 10).toFixed(0))}${bar('Прочность', s.dur, 200, s.dur)}${bar('Вес', s.mass, 3800, fmtPts(s.mass) + ' кг')}${bar('Радиус разворота', 9 - rad, 4, rad + ' м')}</div>
      <div class="carlist">${PLAYER_CARS.map(k => { const c = CARS[k], own = d.cars.includes(k); return `<button class="card${own ? '' : ' locked'}" type="button" data-car="${k}" aria-pressed="${k === id}"><div><h3>${c.name}</h3><span class="best">${Math.round(c.vmax * 3.6)} км/ч · прочность ${c.dur}</span></div><span class="${own ? 'best' : 'pts'}">${own ? (d.car === k ? 'Выбрана' : 'В гараже') : fmtPts(c.cost)}</span></button>`; }).join('')}</div>`;
      body.querySelector('.carlist').onclick = e => {
        const c = e.target.closest('.card'); if (!c) return; const k = c.dataset.car;
        if (k !== id) { g.garage.show(k); this.renderGarage(); return; }
        if (!d.cars.includes(k)) { if (!this.spend(CARS[k].cost, () => { d.cars.push(k); d.car = k; this.toast(`${CARS[k].name} теперь в гараже`, 'gold'); if (d.cars.length >= 5) g.unlockAch('garage5'); })) return; }
        else { d.car = k; Store.save(); } this.renderGarage();
      };
      const act = document.createElement('p'); act.className = 'best'; act.textContent = d.cars.includes(id) ? (d.car === id ? 'Эта машина выбрана для поездок.' : 'Нажмите на выделенную машину ещё раз, чтобы выбрать её.') : `Нажмите на выделенную машину ещё раз, чтобы купить за ${fmtPts(s.cost)} очков.`; body.appendChild(act);
    } else if (this.gTab === 'tune') {
      if (!d.cars.includes(id)) { body.innerHTML = '<p class="best">Сначала купите эту машину, затем настройте её.</p>'; return; }
      const seg = (list, cur, key) => `<div class="seg" data-key="${key}">${list.map(x => `<button type="button" data-v="${x.id}" aria-pressed="${cur === x.id}">${x.name}${d.items.includes(x.id) || !x.cost ? '' : `<span class="price">${fmtPts(x.cost)}</span>`}</button>`).join('')}</div>`;
      const curCol = t.color || (COLORS.find(c => c.hex === s.color)?.id ?? null);
      body.innerHTML = `<div class="opt-row"><span class="lbl">Цвет кузова</span><div class="swatches" data-key="color">${COLORS.map(c => `<button class="sw${d.items.includes(c.id) || !c.cost ? '' : ' locked'}" type="button" data-v="${c.id}" aria-pressed="${curCol === c.id}" title="${c.name}${c.cost && !d.items.includes(c.id) ? ' · ' + c.cost + ' очков' : ''}" style="background:#${c.hex.toString(16).padStart(6, '0')}"></button>`).join('')}</div></div>
        <div class="opt-row"><span class="lbl">Покрытие</span>${seg(FINISHES, t.finish, 'finish')}</div>
        <div class="opt-row"><span class="lbl">Тонировка</span>${seg(TINTS, t.tint, 'tint')}</div>
        <div class="opt-row"><span class="lbl">Диски</span>${seg(RIMS, t.rims, 'rims')}</div>
        ${EXTRAS.map(x => { const key = x.id === 'x_beacon' ? 'beacon' : 'flag', own = d.items.includes(x.id); return `<div class="opt-row"><span class="lbl">${x.name}</span><div class="seg" data-key="${key}"><button type="button" data-v="on" aria-pressed="${!!t[key]}">${own ? 'Включить' : 'Купить и включить'}${own ? '' : `<span class="price">${fmtPts(x.cost)}</span>`}</button><button type="button" data-v="off" aria-pressed="${!t[key]}">Выключить</button></div><span class="best">${x.desc}</span></div>`; }).join('')}`;
      body.onclick = e => {
        const b = e.target.closest('button'); if (!b) return; const key = b.parentElement.dataset.key, v = b.dataset.v; if (!key) return;
        const apply = () => { if (key === 'beacon' || key === 'flag') t[key] = v === 'on'; else t[key] = v; Store.save(); g.garage.show(id); this.renderGarage(); };
        let itemId = v; if (key === 'beacon') itemId = 'x_beacon'; if (key === 'flag') itemId = 'x_flag';
        if ((key === 'beacon' || key === 'flag') && v === 'off') return apply();
        const cost = TUNE_COST(itemId); if (cost && !d.items.includes(itemId)) { this.spend(cost, () => { d.items.push(itemId); apply(); this.toast('Куплено', 'gold'); }); return; }
        apply();
      };
    } else {
      const role = ROLE(d.role), p = plateOf(d.role);
      body.innerHTML = `<p class="best">Номер для роли «${role.name}». Буквенный код зависит от должности, цифры и регион можно менять.</p>
        <canvas id="platePrev" width="512" height="112"></canvas>
        <div class="plate-form"><label><span class="lbl">Код</span><select id="plCode">${role.codes.map(c => `<option${c === p.code ? ' selected' : ''}>${c}</option>`).join('')}</select></label>
        <label><span class="lbl">Цифры</span><input id="plNum" type="text" inputmode="numeric" maxlength="4" value="${p.num}"></label>
        <label><span class="lbl">Регион</span><select id="plReg">${REGIONS.map(([c, n]) => `<option value="${c}"${c === p.region ? ' selected' : ''}>${c} · ${n}</option>`).join('')}</select></label></div>`;
      const draw = () => { const tex = plateTexture(plateOf(d.role)); $('platePrev').getContext('2d').drawImage(tex.image, 0, 0); tex.dispose(); };
      const upd = () => { const num = ($('plNum').value.replace(/\D/g, '') || '0').slice(0, 4).padStart(3, '0'); d.plates[d.role] = { code: $('plCode').value, num, region: $('plReg').value, type: role.ptype }; Store.save(); draw(); g.garage.car && g.garage.car.setPlate(d.plates[d.role]); };
      $('plCode').onchange = upd; $('plReg').onchange = upd; $('plNum').onchange = upd; $('plNum').oninput = () => { $('plNum').value = $('plNum').value.replace(/\D/g, '').slice(0, 4); };
      draw();
    }
  }
  // ---------- задания и рекорды ----------
  openTasks() {
    this.wallet(); this.g.ensureDaily(); const d = Store.data;
    $('dailyList').innerHTML = d.daily.tasks.map(t => { const def = DAILY.find(x => x.id === t.id), p = clamp(t.prog / def.goal, 0, 1); return `<div class="item${t.done ? ' done' : ''}"><b>${def.text}</b><span class="pts">+${def.reward}</span><span>${t.done ? 'Выполнено' : `${fmtPts(Math.min(t.prog, def.goal))} из ${fmtPts(def.goal)}`}</span><span></span><div class="prog"><i style="width:${p * 100}%"></i></div></div>`; }).join('');
    const got = ACH.filter(a => d.ach[a.id]).length; $('achCount').textContent = `· ${got} из ${ACH.length}`;
    $('achList').innerHTML = ACH.map(a => `<div class="item${d.ach[a.id] ? ' done' : ''}"><b>${a.name}</b><span class="pts">${d.ach[a.id] ? '' : '+' + ACH_REWARD}</span><span>${a.desc}</span></div>`).join('');
    this.show('tasks');
  }
  openBoard() {
    $('boardLevel').innerHTML = LEVELS.map(L => `<option value="${L.id}"${L.id === Store.data.level ? ' selected' : ''}>${L.name}</option>`).join('');
    this.fillBoard(); this.show('boardScr');
  }
  fillBoard() {
    const id = $('boardLevel').value, rows = Store.data.board[id] || [];
    $('boardBody').innerHTML = rows.length ? rows.map((r, i) => `<tr><td>${i + 1}</td><td>${fmtPts(r.score)}</td><td class="stars">${'★'.repeat(r.stars)}${'☆'.repeat(3 - r.stars)}</td><td>${fmtTime(r.left)}</td><td>${ROLE(r.role).name}</td><td>${CARS[r.car]?.name || ''}</td><td>${r.date}</td></tr>`).join('') : '<tr><td colspan="7" class="best">На этом маршруте пока нет заездов. Пройдите его, чтобы попасть в таблицу.</td></tr>';
    $('bReplay').disabled = !Store.data.replays[id];
  }
  openSettings() { this.syncSettings(); this.show('settings'); }
  // авторы 3D-моделей (лицензия CC BY требует указать автора)
  showCredits() {
    modelCfg().then(cfg => {
      const seen = new Set(), rows = [];
      for (const [id, c] of Object.entries(cfg || {})) { if (id[0] === '_' || !c.credit || seen.has(c.credit.title)) continue; seen.add(c.credit.title); rows.push(c.credit); }
      const el = $('credits'); el.hidden = !rows.length; if (!rows.length) return;
      const esc = t => String(t).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
      el.innerHTML = '<b>3D-модели машин</b> (лицензия CC BY 4.0, модели упрощены и сжаты для игры):<br>' + rows.map(c => `«${esc(c.title)}» — ${esc(c.author)}, <a href="${esc(c.source)}" target="_blank" rel="noopener">sketchfab</a>`).join('<br>');
    });
  }
  openFree() {
    const d = Store.data, list = [ARENA, ...LEVELS];
    if (!list.some(L => L.id === d.free.level && (L.arena || d.levels.includes(L.id)))) d.free.level = 'arena';
    $('freeCards').innerHTML = list.map(L => { const own = L.arena || d.levels.includes(L.id); return `<button class="card${own ? '' : ' locked'}" type="button" data-id="${L.id}" aria-pressed="${d.free.level === L.id}"${own ? '' : ' disabled'}>${own ? '' : '<span class="lock">Откройте в карьере</span>'}<span class="ic">${svgIcon(L.arena ? 'star' : 'road')}</span><h3>${L.name}</h3><p>${L.desc}</p></button>`; }).join('');
    $('freeCards').onclick = e => { const c = e.target.closest('.card'); if (!c || c.disabled) return; d.free.level = c.dataset.id; Store.save(); this.openFree(); };
    $('frCar').textContent = CARS[d.car].name; this.syncFree(); this.show('freeScr');
  }
  syncFree() { const f = Store.data.free; for (const [id, v] of [['frTod', f.tod], ['frWeather', f.weather], ['frTraffic', f.traffic ? '1' : '0']]) for (const b of $(id).querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.v === v)); }
  syncSettings() {
    for (const b of $('qSeg').querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.q === Store.data.quality));
    for (const b of $('sirSeg').querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.v === Store.data.siren));
    for (const b of $('pSirSeg').querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.v === Store.data.pSiren));
    $('vol').value = Store.data.volume; $('rvol').value = Store.data.radio; $('fpsChk').checked = !!Store.data.showFps;
    $('qNote').textContent = Store.data.quality === 'auto' ? `Авто подбирает качество по частоте кадров. Сейчас: ${QUALITY[this.g.qName].label}.` : `Выбрано вручную: ${QUALITY[this.g.qName].label}.`;
  }
  syncPause() { $('bPhoto').textContent = Store.data.photo ? 'Режим фото' : 'Режим фото · 800 очков'; }
  toast(text, kind = '') {
    const box = $('toasts'), el = document.createElement('div'); el.className = 'toast glass ' + kind; el.textContent = text; box.prepend(el);
    while (box.children.length > 3) box.lastChild.remove();
    setTimeout(() => el.classList.add('out'), 2600); setTimeout(() => el.remove(), 3100);
  }
  flash() { const f = $('flash'); f.style.transition = 'none'; f.style.opacity = '0.75'; requestAnimationFrame(() => { f.style.transition = 'opacity .35s'; f.style.opacity = '0'; }); }
  // ---------- мини-карта ----------
  buildMap(world, path) {
    if (world.isArena) {
      const S = 1024, H = world.H, x0 = -H - 30, k = S / (2 * H + 60), c = makeCanvas(S, S), g = c.getContext('2d'), X = v => (v - x0) * k;
      g.fillStyle = '#141a22'; g.fillRect(0, 0, S, S); g.fillStyle = '#2c3442'; g.fillRect(X(-H), X(-H), 2 * H * k, 2 * H * k);
      g.strokeStyle = '#d8202a'; g.lineWidth = 3; g.strokeRect(X(-H), X(-H), 2 * H * k, 2 * H * k);
      g.strokeStyle = '#d9b46a'; g.lineWidth = 2; for (const cx of [-90, 90]) for (const r of [14, 30]) { g.beginPath(); g.arc(X(cx), X(60), r * k, 0, Math.PI * 2); g.stroke(); }
      g.fillStyle = '#4a5162'; for (const b of world.boxes) g.fillRect(X(b[0]), X(b[2]), (b[1] - b[0]) * k, (b[3] - b[2]) * k);
      this.map = { c, x0, z0: x0, k }; return;
    }
    const S = 1024, sp = world.isSpline, xs = [], zs = []; for (let i = 0; i < path.N; i += 8) { xs.push(path.X[i]); zs.push(path.Z[i]); }
    const x0 = sp ? Math.min(...xs) - 200 : -160, z0 = sp ? Math.min(...zs) - 200 : -160, span = sp ? Math.max(Math.max(...xs) - x0, Math.max(...zs) - z0) + 200 : Math.max(NX, NZ) * CELL + 220, k = S / span;
    const c = makeCanvas(S, S), g = c.getContext('2d'), X = x => (x - x0) * k, Z = z => (z - z0) * k;
    g.fillStyle = sp ? '#16241a' : '#1b2230'; g.fillRect(0, 0, S, S);
    if (!sp) {
      if (world.river >= 0) { g.fillStyle = '#183447'; g.fillRect(0, Z(world.river * CELL + RH), S, (CELL - 2 * RH) * k); }
      g.strokeStyle = '#3b4659'; g.lineWidth = 2 * RH * k; g.lineCap = 'square';
      for (const [n, d] of world.edges) { g.beginPath(); g.moveTo(X(n.x), Z(n.z)); g.lineTo(X(n.x + DIRS[d][0] * CELL), Z(n.z + DIRS[d][1] * CELL)); g.stroke(); }
      for (const id of world.parks) { const [bi, bj] = id.split(',').map(Number); g.fillStyle = '#20402a'; g.fillRect(X(bi * CELL + LOT), Z(bj * CELL + LOT), (CELL - 2 * LOT) * k, (CELL - 2 * LOT) * k); }
      const [gi, gj] = world.gov; g.fillStyle = '#4a3d22'; g.fillRect(X(gi * CELL + LOT), Z(gj * CELL + LOT), (CELL - 2 * LOT) * k, (CELL - 2 * LOT) * k);
    } else { g.strokeStyle = '#4a4f57'; g.lineWidth = 12 * k; g.lineJoin = 'round'; g.beginPath(); for (let i = 0; i < path.N; i += 4) i ? g.lineTo(X(path.X[i]), Z(path.Z[i])) : g.moveTo(X(path.X[i]), Z(path.Z[i])); g.stroke(); }
    this.map = { c, x0, z0, k };
  }
  drawMini(P, E, path, t, world) {
    const g = this.mg, W = this.mini.width, c = W / 2, m = this.map, scale = 1.9 / m.k;
    g.clearRect(0, 0, W, W); g.save(); g.beginPath(); g.arc(c, c, c - 2, 0, Math.PI * 2); g.clip();
    g.fillStyle = '#0d1219'; g.fillRect(0, 0, W, W);
    g.translate(c, c); g.rotate(P.h + Math.PI); g.scale(scale, scale);
    g.drawImage(m.c, -(P.x - m.x0) * m.k, -(P.z - m.z0) * m.k);
    const fr = !!this.g.free;
    if (!fr) {
    g.strokeStyle = 'rgba(217,180,106,.95)'; g.lineWidth = 5 / scale * 1.4; g.lineJoin = 'round'; g.beginPath(); const i0 = Math.max(0, this.g.pIdx - 20);
    for (let i = i0; i < path.N; i += 4) { const x = (path.X[i] - P.x) * m.k, z = (path.Z[i] - P.z) * m.k; i === i0 ? g.moveTo(x, z) : g.lineTo(x, z); } g.stroke();
    if (world.closed && world.closed.size) { g.strokeStyle = '#ff3b4e'; g.lineWidth = 4 / scale * 1.4; for (const key of world.closed) { const [i, j, d] = key.split(',').map(Number), x1 = (i * CELL - P.x) * m.k, z1 = (j * CELL - P.z) * m.k, x2 = ((i + DIRS[d][0]) * CELL - P.x) * m.k, z2 = ((j + DIRS[d][1]) * CELL - P.z) * m.k, mx = (x1 + x2) / 2, mz = (z1 + z2) / 2, r = 10 / scale; g.beginPath(); g.moveTo(mx - r, mz - r); g.lineTo(mx + r, mz + r); g.moveTo(mx + r, mz - r); g.lineTo(mx - r, mz + r); g.stroke(); } }
    const red = (t * 2.2) % 2 < 1; for (const e of E) { g.fillStyle = e.kind === 'pss' ? '#9fb4d8' : red ? '#ff3b4e' : '#3d7bff'; g.beginPath(); g.arc((e.x - P.x) * m.k, (e.z - P.z) * m.k, 6 / scale, 0, Math.PI * 2); g.fill(); }
    let dx = (path.destX - P.x) * m.k, dz = (path.destZ - P.z) * m.k; const lim = (c - 14) / scale, dl = Math.hypot(dx, dz); if (dl > lim) { dx *= lim / dl; dz *= lim / dl; }
    g.fillStyle = '#f3d89f'; g.strokeStyle = '#1d1508'; g.lineWidth = 3 / scale; g.beginPath(); g.arc(dx, dz, 9 / scale, 0, Math.PI * 2); g.fill(); g.stroke();
    }
    g.restore();
    g.fillStyle = '#ffffff'; g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 3; g.beginPath(); g.moveTo(c, c - 15); g.lineTo(c + 10, c + 11); g.lineTo(c, c + 5); g.lineTo(c - 10, c + 11); g.closePath(); g.stroke(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 2; g.beginPath(); g.arc(c, c, c - 2, 0, Math.PI * 2); g.stroke();
  }
  drawSpeedo(kmh, gear, rpm, boost, freedom) {
    const g = this.spg, W = this.sp.width, cx = W / 2, cy = W / 2, R = W * 0.43, a0 = Math.PI * 0.75, a1 = Math.PI * 2.25, max = 260;
    g.clearRect(0, 0, W, W);
    const bg = g.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 1.12); bg.addColorStop(0, 'rgba(18,24,36,.82)'); bg.addColorStop(1, 'rgba(8,11,18,.6)');
    g.fillStyle = bg; g.beginPath(); g.arc(cx, cy, R * 1.1, 0, Math.PI * 2); g.fill(); g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 2; g.stroke();
    g.lineWidth = W * 0.018; g.strokeStyle = 'rgba(255,255,255,.07)'; g.beginPath(); g.arc(cx, cy, R * 0.98, a0, a1); g.stroke();
    const sa = a0 + (a1 - a0) * Math.min(kmh, max) / max, gr = g.createLinearGradient(0, W, W, 0); gr.addColorStop(0, '#9b7a3c'); gr.addColorStop(1, '#f3d89f');
    g.strokeStyle = kmh > freedom + 10 ? '#ff5a64' : gr; g.beginPath(); g.arc(cx, cy, R * 0.98, a0, sa); g.stroke();
    const fa = a0 + (a1 - a0) * Math.min(freedom, max) / max; g.strokeStyle = 'rgba(255,90,100,.85)'; g.lineWidth = W * 0.012; g.beginPath(); g.arc(cx, cy, R * 1.04, fa, a1); g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `700 ${W * 0.05}px Manrope, sans-serif`;
    for (let v = 0; v <= max; v += 10) {
      const a = a0 + (a1 - a0) * v / max, major = v % 20 === 0, r1 = R * (major ? 0.8 : 0.85), r2 = R * 0.9;
      g.strokeStyle = major ? 'rgba(255,255,255,.75)' : 'rgba(255,255,255,.3)'; g.lineWidth = major ? W * 0.008 : W * 0.004;
      g.beginPath(); g.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); g.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2); g.stroke();
      if (v % 40 === 0) { g.fillStyle = 'rgba(230,235,245,.7)'; g.fillText(v, cx + Math.cos(a) * R * 0.66, cy + Math.sin(a) * R * 0.66); }
    }
    const rr = Math.min(rpm / 7000, 1); g.lineWidth = W * 0.012; g.strokeStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.arc(cx, cy, R * 0.47, Math.PI * 0.8, Math.PI * 2.2); g.stroke();
    g.strokeStyle = rr > 0.86 ? '#ff5a64' : '#7fa8ff'; g.beginPath(); g.arc(cx, cy, R * 0.47, Math.PI * 0.8, Math.PI * 0.8 + Math.PI * 1.4 * rr); g.stroke();
    g.save(); g.translate(cx, cy); g.rotate(sa); g.shadowColor = 'rgba(255,60,70,.8)'; g.shadowBlur = W * 0.03; g.fillStyle = '#ff4552';
    g.beginPath(); g.moveTo(R * 0.22, -W * 0.009); g.lineTo(R * 0.93, 0); g.lineTo(R * 0.22, W * 0.009); g.closePath(); g.fill(); g.restore();
    g.fillStyle = '#eef1f6'; g.font = `700 ${W * 0.15}px Unbounded, "Arial Black", sans-serif`; g.fillText(Math.round(kmh), cx, cy - W * 0.01);
    g.fillStyle = 'rgba(200,210,225,.7)'; g.font = `700 ${W * 0.045}px Manrope, sans-serif`; g.fillText('км/ч', cx, cy + W * 0.1);
    g.fillStyle = boost ? '#ff8a5c' : '#f3d89f'; g.font = `800 ${W * 0.07}px Manrope, sans-serif`; g.fillText(gear === 'R' || gear === 'N' ? gear : 'D' + gear, cx, cy + W * 0.27);
  }
  hud(dt, d) {
    this.hudT -= dt; if (this.hudT > 0) return; this.hudT = 1 / 20;
    const tl = $('hTime'); document.querySelector('.h-timer .lbl').textContent = d.free ? 'Свободная езда' : 'До начала рабочего дня'; $('hud').classList.toggle('free', !!d.free);
    if (d.free) { tl.textContent = fmtTime(d.timeLeft); tl.className = 'big'; } else { tl.textContent = fmtTime(d.timeLeft); tl.className = 'big' + (d.timeLeft < 15 ? ' crit' : d.timeLeft < 35 ? ' low' : ''); }
    const sub = document.querySelector('.h-timer .sub');
    if (d.free) sub.textContent = d.sub;
    else { if (!$('hClock')) sub.innerHTML = '<span id="hClock"></span> → 09:00 · <span id="hDest"></span>'; $('hClock').textContent = d.clock; $('hDest').textContent = d.dest; }
    $('hDurV').textContent = Math.round(d.dur) + '%'; const de = $('hDur'); de.style.transform = `scaleX(${d.dur / 100})`; de.style.background = d.dur > 60 ? 'var(--ok)' : d.dur > 30 ? 'var(--warn)' : 'var(--red)';
    $('hLinkV').textContent = Math.round(d.link * 100) + '%'; const le = $('hLink'); le.style.transform = `scaleX(${d.link})`; le.style.background = d.link > 0.55 ? 'var(--blue)' : d.link > 0.3 ? 'var(--warn)' : 'var(--red)';
    $('hScore').textContent = fmtPts(d.score); $('hWave').textContent = '×' + d.wave; $('hRep').textContent = Math.round(d.rep);
    $('navIco').textContent = d.navIco; $('navTxt').textContent = d.navTxt; $('hDist').textContent = d.free ? 'Esc — пауза и выход в меню' : 'До цели ' + fmtDist(d.dist);
    this.drawSpeedo(d.kmh, d.gear, d.rpm, d.boost, d.freedom); this.drawMini(d.P, d.E, d.path, d.t, d.world);
  }
  showResult(r) {
    $('resHead').className = 'res-head' + (r.ok ? '' : ' fail');
    $('resLbl').textContent = r.ok ? 'Прибытие · ' + r.clock : 'Провал';
    $('resTitle').textContent = r.title; $('resText').textContent = r.text;
    const st = $('resStars').querySelectorAll('span'); for (let i = 0; i < 3; i++) { st[i].className = r.starsArr[i] ? 'on' : ''; st[i].style.animationDelay = (0.2 + i * 0.25) + 's'; }
    $('resTable').innerHTML = r.rows.map(([a, b]) => `<span>${a}</span><b>${b}</b>`).join('');
    this.show('result');
  }
}
