
/* =====================================================================
   Данные: роли, места работы, маршруты, тюнинг, достижения, задания
   ===================================================================== */
const ICONS = {
  crown: 'M3 18h18l-1.5-10-4.5 4-3-6-3 6-4.5-4z',
  columns: 'M3 20h18M4 17h16M5 17V9M9.5 17V9M14.5 17V9M19 17V9M3 9l9-5 9 5z',
  briefcase: 'M4 8h16v11H4zM9 8V5h6v3M4 13h16',
  mic: 'M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM6 11a6 6 0 0 0 12 0M12 17v4M8 21h8',
  dome: 'M4 20h16M6 20v-6h12v6M8 14a4 4 0 0 1 8 0M12 6v4M12 6l2-1',
  scales: 'M12 4v16M7 20h10M5 7h14M5 7l-3 6a3 3 0 0 0 6 0zM19 7l-3 6a3 3 0 0 0 6 0z',
  gavel: 'M14 4l6 6M11 7l6 6M12.5 5.5l-6 6 3 3 6-6M8 13l-5 5M3 21h9',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  badge: 'M12 3l2.4 2.2 3.2-.4.6 3.2 2.8 1.6-1.4 2.9 1.4 2.9-2.8 1.6-.6 3.2-3.2-.4L12 21l-2.4-2.2-3.2.4-.6-3.2-2.8-1.6 1.4-2.9-1.4-2.9 2.8-1.6.6-3.2 3.2.4z',
  star: 'M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z',
  road: 'M8 3L4 21M16 3l4 18M12 5v2M12 11v2M12 17v2',
  lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3'
};
const svgIcon = k => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[k]}"/></svg>`;

const DEST = {
  gov: { name: 'Дом правительства', to: 'к Дому правительства', event: 'Совещание в Доме правительства' },
  senate: { name: 'Сенат', to: 'к Сенату', event: 'Пленарное заседание Сената' },
  parliament: { name: 'Парламент', to: 'к зданию парламента', event: 'Заседание Законодательной палаты' },
  prosecutor: { name: 'Генеральная прокуратура', to: 'к Генпрокуратуре', event: 'Коллегия Генеральной прокуратуры' },
  embassy: { name: 'Посольство', to: 'к посольству', event: 'Приём в посольстве' },
  court: { name: 'Верховный суд', to: 'к Верховному суду', event: 'Заседание суда' },
  law: { name: 'Адвокатское бюро', to: 'к офису фирмы', event: 'Встреча с клиентом' }
};
// escort: lead — ДПС впереди; pss — охрана СБП; tail — ДПС сзади
const ROLES = [
  { id: 'president', name: 'Президент', icon: 'crown', diff: 3, codes: ['PAA', 'PSS'], ptype: 'gov', num: '001', escort: ['lead', 'pss', 'pss', 'tail'], freedom: 140, strict: 1.6, dest: 'gov', timeK: 0.86, cost: 6000, car: 'maybach',
    desc: 'Самый большой эскорт и самая широкая свобода на дороге, но любая авария — международный скандал. Времени в обрез.' },
  { id: 'premier', name: 'Премьер-министр', icon: 'columns', diff: 3, codes: ['PAA'], ptype: 'gov', num: '0002', escort: ['lead', 'pss', 'tail'], freedom: 125, strict: 1.4, dest: 'gov', timeK: 0.9, cost: 4000, car: 'sclass',
    desc: 'Плотный график заседаний. Три машины сопровождения, жёсткие штрафы за аварии.' },
  { id: 'minister', name: 'Министр', icon: 'briefcase', diff: 2, codes: ['PAA'], ptype: 'gov', num: '0014', escort: ['lead', 'tail'], freedom: 110, strict: 1.2, dest: 'gov', timeK: 1, cost: 0, car: 'sclass',
    desc: 'Классика: ДПС впереди и сзади, совещание в Доме правительства ровно в 09:00.' },
  { id: 'deputy', name: 'Депутат', icon: 'mic', diff: 1, codes: ['PPP'], ptype: 'gov', num: '0118', escort: ['lead'], freedom: 90, strict: 1, dest: 'parliament', timeK: 1.06, cost: 0, car: 'lc',
    desc: 'Одна машина сопровождения и умеренная свобода. Сегодня заседание в парламенте.' },
  { id: 'senator', name: 'Сенатор', icon: 'dome', diff: 1, codes: ['PPP'], ptype: 'gov', num: '0067', escort: ['lead'], freedom: 95, strict: 1, dest: 'senate', timeK: 1.04, cost: 800, car: 'eclass',
    desc: 'Спокойный темп и Сенат в конце маршрута. Хороший старт для новичка.' },
  { id: 'deputy_min', name: 'Замминистра', icon: 'star', diff: 2, codes: ['APC', 'DAV'], ptype: 'gov', num: '0231', escort: ['lead'], freedom: 95, strict: 1.1, dest: 'gov', timeK: 0.98, cost: 1200, car: 'eclass',
    desc: 'Номер APC, одна машина ДПС. Министр ждёт отчёт к началу совещания.' },
  { id: 'prosecutor', name: 'Прокурор', icon: 'scales', diff: 2, codes: ['ZDF'], ptype: 'gov', num: '0007', escort: ['lead', 'tail'], freedom: 105, strict: 1.3, dest: 'prosecutor', timeK: 0.95, cost: 2000, car: 'lc200',
    desc: 'Генпрокуратура не любит опозданий. Два сопровождения, строгие штрафы.' },
  { id: 'lawyer', name: 'Адвокат', icon: 'gavel', diff: 1, codes: ['AAA', 'LLL'], ptype: 'private', num: '777', escort: ['lead'], freedom: 70, strict: 0.9, dest: 'law', timeK: 1.12, cost: 0, car: 'camry',
    desc: 'Частный номер и минимум привилегий: превышать скорость почти нельзя. Клиент ждёт в офисе фирмы.' },
  { id: 'ambassador', name: 'Посол / дипломат', icon: 'globe', diff: 2, codes: ['CMD', 'D', 'UN'], ptype: 'dip', num: '012', escort: ['lead'], freedom: 90, strict: 1.25, dest: 'embassy', timeK: 1, cost: 1500, car: 'a8',
    desc: 'Зелёные номера CMD. Любая авария превращается в дипломатический инцидент.' },
  { id: 'sgb', name: 'Сотрудник СГБ', icon: 'shield', diff: 2, codes: ['TST', 'TSS', 'USB', 'PSS', 'PSF'], ptype: 'gov', num: '0410', escort: ['lead'], freedom: 125, strict: 1, dest: 'gov', timeK: 0.92, cost: 2500, car: 'tahoe',
    desc: 'Номера TST, TSS, USB. Большая свобода, но всего одна машина ДПС и плотный график.' },
  { id: 'mvd', name: 'Сотрудник МВД', icon: 'badge', diff: 1, codes: ['VSB', 'VSC', 'VSF', 'VSD', 'VSG', 'VSV'], ptype: 'gov', num: '0102', escort: ['lead'], freedom: 110, strict: 0.9, dest: 'court', timeK: 1, cost: 600, car: 'camry',
    desc: 'Номера VSB–VSV. Терпимые штрафы, но в суд нужно успеть к началу заседания.' }
];
const ROLE = id => ROLES.find(r => r.id === id) || ROLES[2];
const REGIONS = [['01', 'Ташкент'], ['10', 'Ташкентская обл.'], ['20', 'Сырдарья'], ['25', 'Джизак'], ['30', 'Самарканд'], ['40', 'Фергана'], ['50', 'Наманган'], ['60', 'Андижан'], ['70', 'Кашкадарья'], ['75', 'Сурхандарья'], ['80', 'Бухара'], ['85', 'Навои'], ['90', 'Хорезм'], ['95', 'Каракалпакстан']];

const TOD_NAME = { night: 'Ночь', dawn: 'Рассвет', morning: 'Утро', day: 'День', sunset: 'Закат' };
const WEATHER_NAME = { clear: 'Ясно', sunny: 'Яркое солнце', rain: 'Дождь', fog: 'Туман', snow: 'Лёгкий снег', wet: 'Мокрый асфальт' };
const LEVELS = [
  { id: 'center', name: 'Центр города', desc: 'Широкие улицы и плотный утренний поток.', layout: { cell: 100, nx: 7, nz: 7, lanes: 2, sw: 4 }, style: 'center', route: [[1, 0], [1, 4], [3, 4], [3, 2], [5, 2], [5, 5], [6, 5]], parks: [[2, 1], [0, 3], [4, 4]], tod: 'morning', weather: 'clear', avg: 9, cost: 0 },
  { id: 'prospekt', name: 'Проспект', desc: 'Три полосы в каждую сторону и длинные прямые в утреннем тумане.', layout: { cell: 100, nx: 10, nz: 5, lanes: 3, sw: 4 }, style: 'center', route: [[0, 1], [7, 1], [7, 3], [9, 3]], parks: [[2, 2], [5, 0]], tod: 'morning', weather: 'fog', avg: 10.5, cost: 600 },
  { id: 'old', name: 'Старый город', desc: 'Узкие улочки, низкие дома, много пешеходов и дождь.', layout: { cell: 70, nx: 8, nz: 8, lanes: 1, sw: 2.6 }, style: 'old', route: [[0, 1], [3, 1], [3, 4], [5, 4], [5, 6], [7, 6]], parks: [[1, 3], [6, 2]], tod: 'day', weather: 'rain', avg: 6.5, cost: 1200, peds: 1.6, traffic: 0.6 },
  { id: 'bridge', name: 'Мост через реку', desc: 'Маршрут пересекает реку по мосту. Яркое солнце и блики.', layout: { cell: 100, nx: 7, nz: 7, lanes: 2, sw: 4 }, style: 'center', river: 3, route: [[1, 0], [1, 2], [2, 2], [2, 5], [4, 5], [4, 6]], parks: [[0, 1], [5, 1]], tod: 'day', weather: 'sunny', avg: 9, cost: 1800 },
  { id: 'outskirts', name: 'Окраина и трасса', desc: 'Частный сектор и скоростная трасса на рассвете.', layout: { cell: 150, nx: 6, nz: 5, lanes: 2, sw: 5 }, style: 'outskirts', route: [[0, 1], [5, 1], [5, 3], [3, 3]], parks: [[1, 2], [2, 0], [4, 0]], tod: 'dawn', weather: 'clear', avg: 12, cost: 2500, traffic: 0.6 },
  { id: 'plaza', name: 'Площадь у правительства', desc: 'Парадная площадь, флаги и лёгкий снег.', layout: { cell: 100, nx: 7, nz: 7, lanes: 2, sw: 4 }, style: 'center', route: [[6, 1], [4, 1], [4, 4], [2, 4], [2, 3]], parks: [[4, 5]], plazas: [[1, 3], [1, 2], [2, 2]], tod: 'day', weather: 'snow', avg: 7.3, cost: 3200 },
  { id: 'ministries', name: 'Район министерств', desc: 'Высотки ведомств и закат над проспектом.', layout: { cell: 100, nx: 7, nz: 7, lanes: 2, sw: 4 }, style: 'ministry', route: [[0, 5], [3, 5], [3, 1], [5, 1], [5, 3], [6, 3]], parks: [[1, 2]], tod: 'sunset', weather: 'clear', avg: 9, cost: 4000 },
  { id: 'night', name: 'Ночной маршрут', desc: 'Ночной центр после дождя: неон и мокрый асфальт.', layout: { cell: 100, nx: 7, nz: 7, lanes: 2, sw: 4 }, style: 'center', route: [[6, 6], [6, 4], [2, 4], [2, 1], [1, 1]], parks: [[3, 2]], tod: 'night', weather: 'wet', avg: 9, cost: 5000 },
  { id: 'mountain', name: 'Горный перевал', desc: 'Бонус: серпантин к загородной резиденции.', mountain: true, tod: 'morning', weather: 'clear', avg: 9, cost: 8000, bonus: true }
];
const ARENA = { id: 'arena', name: 'Арена', desc: 'Закрытая площадка: дрифт-круги, слалом из конусов, трибуны и прожекторы.', arena: true, tod: 'day', weather: 'clear', avg: 10, cost: 0 };
const LEVEL_BY = id => id === 'arena' ? ARENA : LEVELS.find(l => l.id === id) || LEVELS[0];
const SIRENS = [{ id: 'auto', name: 'Авто' }, { id: 'wail', name: 'Вой' }, { id: 'yelp', name: 'Йелп' }, { id: 'hilo', name: 'Хай-лоу' }, { id: 'phaser', name: 'Фазер' }];
const SIREN_NAME = { wail: 'вой', yelp: 'йелп', hilo: 'хай-лоу', phaser: 'фазер' };

const COLORS = [
  { id: 'c_black', name: 'Чёрный обсидиан', hex: 0x07080a, cost: 0 }, { id: 'c_white', name: 'Белый бриллиант', hex: 0xeef0f1, cost: 0 }, { id: 'c_silver', name: 'Серебро', hex: 0xaeb3ba, cost: 0 },
  { id: 'c_graphite', name: 'Графит', hex: 0x34373c, cost: 300 }, { id: 'c_navy', name: 'Тёмно-синий', hex: 0x101c38, cost: 400 }, { id: 'c_bordo', name: 'Бордо', hex: 0x45101a, cost: 600 },
  { id: 'c_emerald', name: 'Изумруд', hex: 0x0e3628, cost: 600 }, { id: 'c_sand', name: 'Песочный', hex: 0xb49b76, cost: 500 }
];
const FINISHES = [{ id: 'f_gloss', name: 'Глянец', cost: 0 }, { id: 'f_metal', name: 'Металлик', cost: 400 }, { id: 'f_matte', name: 'Матовый', cost: 700 }];
const TINTS = [{ id: 't_factory', name: 'Заводская', cost: 0 }, { id: 't_mid', name: 'Средняя', cost: 0 }, { id: 't_limo', name: 'Лимузин', cost: 300 }];
const RIMS = [{ id: 'r_classic', name: 'Заводские', cost: 0 }, { id: 'r_amg', name: 'Спорт', cost: 500 }, { id: 'r_mono', name: 'Моноблок', cost: 800 }];
const EXTRAS = [{ id: 'x_beacon', name: 'Мигалка на крыше', cost: 1500, desc: 'Поток уступает и вам' }, { id: 'x_flag', name: 'Флажок на крыле', cost: 500, desc: 'Флаг Узбекистана на переднем крыле' }];
const TUNE_COST = id => [...COLORS, ...FINISHES, ...TINTS, ...RIMS, ...EXTRAS].find(x => x.id === id)?.cost ?? 0;

const ACH = [
  { id: 'first', name: 'Первый рабочий день', desc: 'Доберитесь до работы вовремя.' },
  { id: 'wave10', name: '10 светофоров подряд', desc: 'Зелёная волна ×10 за одну поездку.' },
  { id: 'clean', name: 'Ни царапины', desc: 'Финиш со 100% прочности.' },
  { id: 'early90', name: 'Раньше всех', desc: 'Приехать за 90 секунд до начала.' },
  { id: 'stars3', name: 'Образцовый служащий', desc: 'Три звезды на любом маршруте.' },
  { id: 'drift', name: 'Дрифт без потерь', desc: 'Занос дольше 3 секунд без удара.' },
  { id: 'papa', name: 'Без комментариев', desc: 'Уйти от папарацци.' },
  { id: 'night', name: 'Ночная смена', desc: 'Пройти «Ночной маршрут».' },
  { id: 'rain', name: 'Под дождём', desc: 'Финишировать в дождь.' },
  { id: 'mountain', name: 'Покоритель перевала', desc: 'Пройти горный перевал.' },
  { id: 'allroles', name: 'Карьерная лестница', desc: 'Финишировать за 5 разных ролей.' },
  { id: 'garage5', name: 'Коллекционер', desc: 'Собрать 5 машин в гараже.' },
  { id: 'diplomat', name: 'Дипломатический иммунитет', desc: 'Финиш послом без столкновений.' },
  { id: 'call', name: 'На связи', desc: 'Ответить на срочный звонок начальника.' }
];
const ACH_REWARD = 300;
const DAILY = [
  { id: 'd_wave', text: 'Пройдите 6 перекрёстков зелёной волной', goal: 6, key: 'wave', reward: 400 },
  { id: 'd_clean', text: 'Финишируйте без столкновений', goal: 1, key: 'cleanFinish', reward: 500 },
  { id: 'd_score', text: 'Наберите 3 000 очков за одну поездку', goal: 3000, key: 'scoreRun', reward: 500, max: true },
  { id: 'd_drift', text: 'Сделайте 3 дрифта', goal: 3, key: 'drift', reward: 300 },
  { id: 'd_fin2', text: 'Доберитесь до работы 2 раза', goal: 2, key: 'finish', reward: 400 },
  { id: 'd_early', text: 'Приезжайте с запасом 60 секунд', goal: 1, key: 'early60', reward: 450 },
  { id: 'd_dist', text: 'Проедьте 5 км', goal: 5000, key: 'dist', reward: 350 }
];

const QUALITY = {
  low: { label: 'Низкое', pr: 0.8, shadows: false, shadowSize: 512, fogFar: 300, traffic: 14, peds: 6, trees: 0.45, lights: false, shadowBox: 50, post: 0, rain: 500 },
  medium: { label: 'Среднее', pr: 1.25, shadows: true, shadowSize: 1024, fogFar: 430, traffic: 26, peds: 10, trees: 1, lights: true, shadowBox: 65, post: 1, rain: 1100 },
  ultra: { label: 'Ультра', pr: 2, shadows: true, shadowSize: 2048, fogFar: 620, traffic: 38, peds: 14, trees: 1, lights: true, shadowBox: 90, post: 2, rain: 2000 }
};
const Q_ORDER = ['low', 'medium', 'ultra'];

// ---------- сохранение ----------
const Store = {
  key: 'kortezh_v2',
  defaults: () => ({
    quality: 'auto', volume: 0.8, radio: 0.5, showFps: false, wallet: 0, earned: 0,
    cars: ['sclass', 'eclass', 'camry'], items: ['c_black', 'c_white', 'c_silver', 'f_gloss', 't_factory', 't_mid', 'r_classic'], roles: ['minister', 'deputy', 'lawyer'], levels: ['center'],
    car: 'sclass', tunes: {}, plates: {}, role: 'minister', level: 'center', photo: false, siren: 'auto', pSiren: 'yelp', free: { level: 'arena', tod: 'day', weather: 'clear', traffic: true },
    best: {}, board: {}, replays: {}, ach: {}, daily: null, stats: { rolesDone: [], levelsDone: [] }
  }),
  data: null,
  load() { this.data = this.defaults(); try { const s = localStorage.getItem(this.key); if (s) Object.assign(this.data, JSON.parse(s)); } catch (e) { /* хранилище недоступно */ } },
  save() { try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch (e) { try { this.data.replays = {}; localStorage.setItem(this.key, JSON.stringify(this.data)); } catch (e2) { /* хранилище недоступно */ } } }
};
Store.load();
const tuneOf = car => Store.data.tunes[car] || (Store.data.tunes[car] = { color: null, finish: CARS[car].finish || 'f_gloss', tint: 't_mid', rims: 'r_classic', beacon: false, flag: false });
const plateOf = role => { const r = ROLE(role); return Store.data.plates[role] || { code: r.codes[0], num: r.num, region: '01', type: r.ptype }; };
