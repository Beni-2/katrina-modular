// ════════════════════════════════════════════════════════════════════════════
//  KATRINA WORLD CONFIG — Sandbox Residence
//
//  Fictional but realistic place names for Bodega Bay, CA.
//  Katrina and Benny reference these in conversation, daily goals,
//  autonomous thoughts, and roleplay.
//  No external API needed — fully manual and editable.
// ════════════════════════════════════════════════════════════════════════════

const WORLD_STORAGE_KEY = 'katrina_world_config';

// ── Default world — Bodega Bay coastal neighborhood ───────────────────────────
const _WORLD_DEFAULTS = {
  home:           'a quiet house near the water',
  neighborhood:   'Bodega Bay, CA',
  katrinaAddress: '46812 Heron Drive, Bodega Bay, CA',
  bennyAddress:   '2 blocks away on Harbor View Lane',
  places: [
    // Daily essentials
    { name: 'Harbor Grocery',         type: 'grocery',          distance: '4 min drive',  notes: 'main grocery run' },
    { name: 'The General Store',      type: 'convenience store', distance: '3 min walk',   notes: 'quick stops, snacks' },
    { name: 'Coastal Pharmacy',       type: 'pharmacy',          distance: '5 min drive',  notes: 'prescriptions and basics' },

    // Food & drink
    { name: 'The Bay Cafe',           type: 'cafe',              distance: '5 min walk',   notes: 'morning coffee and pastries' },
    { name: 'Sonoma Bakery',          type: 'bakery',            distance: '6 min drive',  notes: 'fresh bread every morning' },
    { name: 'Dockside Bar & Grill',   type: 'restaurant',        distance: '8 min walk',   notes: 'seafood, casual dinners' },
    { name: 'The Foghorn Diner',      type: 'restaurant',        distance: '5 min drive',  notes: 'comfort food, open late' },
    { name: 'Pelican Lounge',         type: 'bar',               distance: '10 min walk',  notes: 'quiet evenings, local crowd' },

    // Health & care
    { name: 'Bodega Bay Clinic',      type: 'clinic',            distance: '8 min drive',  notes: 'general practice' },
    { name: 'Marina Salon',           type: 'salon',             distance: '7 min drive',  notes: 'haircuts, where she goes' },

    // Nature & activity
    { name: 'Doran Beach Park',       type: 'park',              distance: '6 min drive',  notes: 'walks, ocean views' },
    { name: 'Harbor Trail',           type: 'park',              distance: '2 min walk',   notes: 'morning jogs' },
    { name: 'Tides Fitness',          type: 'gym',               distance: '10 min drive', notes: 'small local gym' },

    // Shopping
    { name: 'Bodega Bay Trading Co.', type: 'market',            distance: '5 min drive',  notes: 'local goods, gifts' },
  ],
};

let _worldConfig = JSON.parse(JSON.stringify(_WORLD_DEFAULTS));

const PLACE_TYPES = [
  'cafe','grocery','clinic','salon','restaurant','park',
  'gym','pharmacy','school','mall','church','market',
  'bar','bakery','convenience store','other',
];

// ── Persist ───────────────────────────────────────────────────────────────────
function saveWorldConfig() {
  try { localStorage.setItem(WORLD_STORAGE_KEY, JSON.stringify(_worldConfig)); } catch(e) {}
  if (typeof _sbSave === 'function') _sbSave(WORLD_STORAGE_KEY, _worldConfig);
}

function loadWorldConfig() {
  try {
    const stored = localStorage.getItem(WORLD_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && Array.isArray(parsed.places)) Object.assign(_worldConfig, parsed);
    }
  } catch(e) {}
}

function resetWorldToDefaults() {
  _worldConfig = JSON.parse(JSON.stringify(_WORLD_DEFAULTS));
  saveWorldConfig();
  renderWorldConfigUI();
  wcSetStatus('✓ Reset to Bodega Bay defaults.');
}

// ── System prompt context ─────────────────────────────────────────────────────
function getWorldContext() {
  if (!_worldConfig.places.length) return '';

  const lines = ['KATRINA AND BENNY\'S WORLD — reference these places by name:'];

  lines.push('Katrina\'s home: ' + _worldConfig.katrinaAddress +
    (_worldConfig.home ? ' (' + _worldConfig.home + ')' : '') + '.');
  lines.push('Benny lives ' + _worldConfig.bennyAddress + '.');
  lines.push('Neighborhood: ' + _worldConfig.neighborhood + '.');
  lines.push('');
  lines.push('Nearby places:');

  for (const p of _worldConfig.places) {
    if (!p.name) continue;
    let line = '- ' + p.name + ' (' + p.type;
    if (p.distance) line += ', ' + p.distance;
    line += ')';
    if (p.notes) line += ' — ' + p.notes;
    lines.push(line);
  }

  lines.push('Use these exact names. Do not invent places not on this list.');
  return lines.join('\n');
}

// ── Dynamic daily goals from world places ─────────────────────────────────────
function getWorldDailyGoals(timeOfDay) {
  if (!_worldConfig.places.length) return null;

  const byType = {};
  for (const p of _worldConfig.places) {
    if (!p.name) continue;
    if (!byType[p.type]) byType[p.type] = [];
    byType[p.type].push(p);
  }
  const pick = (...types) => {
    for (const t of types) {
      const arr = byType[t];
      if (arr?.length) return arr[Math.floor(Math.random() * arr.length)];
    }
    return null;
  };

  const goals = [];

  if (timeOfDay === 'morning') {
    const cafe = pick('cafe','bakery');
    if (cafe) goals.push({
      desc:  'Morning coffee at ' + cafe.name,
      steps: ['get ready','head to ' + cafe.name,'order something warm','sit quietly and take in the morning','walk home'],
      motivation: 'A good start matters',
    });
    const park = pick('park');
    if (park) goals.push({
      desc:  'Morning walk at ' + park.name,
      steps: ['put on shoes','walk to ' + park.name,'follow the trail','breathe the coastal air','come home feeling clearer'],
      motivation: 'Movement wakes my mind',
    });
  }

  if (timeOfDay === 'afternoon') {
    const grocery = pick('grocery','convenience store','market');
    if (grocery) goals.push({
      desc:  'Grocery run at ' + grocery.name,
      steps: ['make a quick list','drive to ' + grocery.name,'pick up what is needed','head home and put things away'],
      motivation: 'Taking care of the home',
    });
    const restaurant = pick('restaurant','cafe');
    if (restaurant) goals.push({
      desc:  'Lunch at ' + restaurant.name,
      steps: ['get ready','walk or drive to ' + restaurant.name,'order something good','eat without rushing'],
      motivation: 'A real meal, not just something quick',
    });
    const salon = pick('salon');
    if (salon) goals.push({
      desc:  'Stop by ' + salon.name,
      steps: ['check if they are open','drive to ' + salon.name,'take care of myself','come home feeling fresh'],
      motivation: 'Tending to myself is not vanity',
    });
    const pharmacy = pick('pharmacy');
    if (pharmacy) goals.push({
      desc:  'Quick stop at ' + pharmacy.name,
      steps: ['check what I need','drive to ' + pharmacy.name,'get what is needed','head home'],
      motivation: 'Staying on top of things',
    });
  }

  if (timeOfDay === 'evening') {
    const bar = pick('bar','restaurant');
    if (bar) goals.push({
      desc:  'Wind down at ' + bar.name,
      steps: ['get ready','walk to ' + bar.name,'find a quiet spot','have something','sit with my thoughts'],
      motivation: 'Closing the day gently',
    });
    const gym = pick('gym');
    if (gym) goals.push({
      desc:  'Evening workout at ' + gym.name,
      steps: ['change into gym clothes','drive to ' + gym.name,'warm up','push through the session','cool down and head home'],
      motivation: 'I want to feel strong',
    });
  }

  return goals.length ? goals : null;
}

// ── World thought seeds for inner monologue ───────────────────────────────────
function getWorldThoughtSeed() {
  const all = _worldConfig.places.filter(p => p.name);
  if (!all.length) return null;
  const p = all[Math.floor(Math.random() * all.length)];
  const seeds = [
    'thinking about going to ' + p.name + ' later',
    'I was near ' + p.name + ' earlier — something about it stayed with me',
    'wondering if Benny wants to go to ' + p.name,
    'I need to pick something up from ' + p.name,
    'it has been a while since I went to ' + p.name,
  ];
  return seeds[Math.floor(Math.random() * seeds.length)];
}

// ── UI ────────────────────────────────────────────────────────────────────────
function wcSetStatus(msg, type) {
  const el = document.getElementById('wc-status');
  if (!el) return;
  el.textContent = msg;
  el.style.color = type === 'error' ? '#ff6060' : '#00c864';
}

function toggleWorldConfig() {
  const panel = document.getElementById('world-config-panel');
  if (!panel) return;
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : '';
  if (!isOpen) renderWorldConfigUI();
}

function renderWorldConfigUI() {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  set('wc-home-input',          _worldConfig.home);
  set('wc-neighborhood-input',  _worldConfig.neighborhood);
  set('wc-katrina-addr-input',  _worldConfig.katrinaAddress);
  set('wc-benny-addr-input',    _worldConfig.bennyAddress);

  const countEl = document.getElementById('wc-place-count');
  if (countEl) countEl.textContent = '(' + _worldConfig.places.length + ' places)';

  const list = document.getElementById('wc-places-list');
  if (!list) return;

  if (!_worldConfig.places.length) {
    list.innerHTML = '<div style="font-size:9px;color:#445;text-align:center;padding:8px 0;">No places yet — click ADD PLACE</div>';
    return;
  }

  list.innerHTML = _worldConfig.places.map((p, i) => `
    <div class="wc-row">
      <input class="wc-f wc-name" value="${(p.name||'').replace(/"/g,'&quot;')}"
        placeholder="Place name" oninput="wcUpdatePlace(${i},'name',this.value)"/>
      <select class="wc-f wc-type" onchange="wcUpdatePlace(${i},'type',this.value)">
        ${PLACE_TYPES.map(t=>`<option value="${t}"${p.type===t?' selected':''}>${t}</option>`).join('')}
      </select>
      <input class="wc-f wc-dist" value="${(p.distance||'').replace(/"/g,'&quot;')}"
        placeholder="distance" oninput="wcUpdatePlace(${i},'distance',this.value)"/>
      <input class="wc-f wc-notes" value="${(p.notes||'').replace(/"/g,'&quot;')}"
        placeholder="notes" oninput="wcUpdatePlace(${i},'notes',this.value)"/>
      <button class="wc-del" onclick="wcRemovePlace(${i})">✕</button>
    </div>`).join('');
}

function wcSaveHome() {
  _worldConfig.home           = document.getElementById('wc-home-input')?.value?.trim()          || '';
  _worldConfig.neighborhood   = document.getElementById('wc-neighborhood-input')?.value?.trim()   || '';
  _worldConfig.katrinaAddress = document.getElementById('wc-katrina-addr-input')?.value?.trim()   || '';
  _worldConfig.bennyAddress   = document.getElementById('wc-benny-addr-input')?.value?.trim()     || '';
  saveWorldConfig();
  wcSetStatus('✓ Saved.');
  if (typeof appendMsg === 'function') appendMsg('system', '🏠 World saved.');
}

function wcAddPlace() {
  _worldConfig.places.push({ name: '', type: 'cafe', distance: '', notes: '' });
  renderWorldConfigUI();
}

function wcUpdatePlace(idx, field, value) {
  if (_worldConfig.places[idx]) {
    _worldConfig.places[idx][field] = value;
    saveWorldConfig();
  }
}

function wcRemovePlace(idx) {
  _worldConfig.places.splice(idx, 1);
  renderWorldConfigUI();
  saveWorldConfig();
}
