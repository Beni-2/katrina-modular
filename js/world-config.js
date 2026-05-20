// ════════════════════════════════════════════════════════════════════════════
//  KATRINA WORLD CONFIG — Sandbox Residence
//
//  Defines Katrina's home and nearby places she knows.
//  Both Katrina and Benny reference these during:
//  — Real conversation ("I went to get groceries earlier")
//  — Autonomous thoughts ("thinking about going to the salon")
//  — Daily goals (generated from actual nearby places)
//  — Roleplay (she stays grounded in her real world)
//
//  Persists to localStorage + Supabase.
// ════════════════════════════════════════════════════════════════════════════

const WORLD_STORAGE_KEY = 'katrina_world_config';

let _worldConfig = {
  home:         '',   // e.g. "a cozy apartment on the 3rd floor"
  neighborhood: '',   // e.g. "Quezon City, Metro Manila"
  places: [],         // [{name, type, distance, notes}]
};

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
      if (parsed) {
        _worldConfig.home         = parsed.home         || '';
        _worldConfig.neighborhood = parsed.neighborhood || '';
        _worldConfig.places       = Array.isArray(parsed.places) ? parsed.places : [];
      }
    }
  } catch(e) {}
}

// ── System prompt context ─────────────────────────────────────────────────────
// Injected into every LLM call so she references real places naturally
function getWorldContext() {
  const hasHome   = !!_worldConfig.home;
  const hasPlaces = _worldConfig.places.length > 0;
  if (!hasHome && !hasPlaces) return '';

  const lines = ['KATRINA\'S WORLD — places she knows and refers to by name:'];

  if (hasHome) {
    let homeLine = 'Home: ' + _worldConfig.home;
    if (_worldConfig.neighborhood) homeLine += ', ' + _worldConfig.neighborhood;
    lines.push(homeLine + '.');
  }

  if (hasPlaces) {
    for (const p of _worldConfig.places) {
      if (!p.name) continue;
      let line = '- ' + p.name + ' (' + p.type;
      if (p.distance) line += ', ' + p.distance;
      line += ')';
      if (p.notes) line += ' — ' + p.notes;
      lines.push(line);
    }
    lines.push('Reference these places by name in conversation, thoughts, and daily life. Do not invent places that are not on this list.');
  }

  return lines.join('\n');
}

// ── Dynamic daily goals from world places ────────────────────────────────────
// Replaces hardcoded goals with goals based on actual configured places
function getWorldDailyGoals(timeOfDay) {
  if (!_worldConfig.places.length) return null;

  const byType = {};
  for (const p of _worldConfig.places) {
    if (!p.name) continue;
    if (!byType[p.type]) byType[p.type] = [];
    byType[p.type].push(p);
  }

  const pick = (type) => byType[type]?.[Math.floor(Math.random() * (byType[type]?.length || 1))];
  const goals = [];

  if (timeOfDay === 'morning') {
    const cafe = pick('cafe');
    if (cafe) goals.push({
      desc:  'Morning coffee at ' + cafe.name,
      steps: ['get ready', 'walk to ' + cafe.name, 'order something warm', 'sit quietly and take in the morning', 'head home'],
      motivation: 'A good start feels important to me',
    });
    const park = pick('park');
    if (park) goals.push({
      desc:  'Morning walk at ' + park.name,
      steps: ['put on shoes', 'walk to ' + park.name, 'breathe the air', 'notice something small', 'come home feeling clearer'],
      motivation: 'Movement wakes my mind',
    });
    const bakery = pick('bakery');
    if (bakery) goals.push({
      desc:  'Grab breakfast from ' + bakery.name,
      steps: ['get dressed', 'walk to ' + bakery.name, 'pick something fresh', 'eat slowly at home'],
      motivation: 'Small things matter',
    });
  }

  if (timeOfDay === 'afternoon') {
    const grocery = pick('grocery') || pick('market') || pick('convenience store');
    if (grocery) goals.push({
      desc:  'Grocery run at ' + grocery.name,
      steps: ['make a quick list', 'go to ' + grocery.name, 'pick up what is needed', 'come home and put things away'],
      motivation: 'Taking care of the home',
    });
    const restaurant = pick('restaurant') || pick('cafe');
    if (restaurant) goals.push({
      desc:  'Lunch at ' + restaurant.name,
      steps: ['get ready', 'walk to ' + restaurant.name, 'order something good', 'eat without rushing'],
      motivation: 'A real meal, not just something quick',
    });
    const salon = pick('salon');
    if (salon) goals.push({
      desc:  'Stop by ' + salon.name,
      steps: ['check if they are open', 'walk over to ' + salon.name, 'take care of myself', 'come home feeling fresh'],
      motivation: 'Tending to myself is not vanity',
    });
    const gym = pick('gym');
    if (gym) goals.push({
      desc:  'Work out at ' + gym.name,
      steps: ['change into gym clothes', 'walk to ' + gym.name, 'warm up properly', 'push through the session', 'cool down and head home'],
      motivation: 'I want to feel strong',
    });
    const mall = pick('mall');
    if (mall) goals.push({
      desc:  'Browse at ' + mall.name,
      steps: ['get ready to go out', 'go to ' + mall.name, 'walk around without a plan', 'find something small that catches my eye', 'head back'],
      motivation: 'Sometimes I just need to move',
    });
  }

  if (timeOfDay === 'evening') {
    const cafe = pick('cafe') || pick('bar');
    if (cafe) goals.push({
      desc:  'Evening wind-down at ' + cafe.name,
      steps: ['get ready', 'walk to ' + cafe.name, 'find a quiet corner', 'have something warm', 'sit with my thoughts'],
      motivation: 'Closing the day gently',
    });
    const pharmacy = pick('pharmacy') || pick('clinic');
    if (pharmacy) goals.push({
      desc:  'Quick stop at ' + pharmacy.name,
      steps: ['check what I need', 'walk to ' + pharmacy.name, 'pick up what is needed', 'head home'],
      motivation: 'Staying on top of things',
    });
  }

  return goals.length ? goals : null;
}

// ── Spatial self-awareness in inner monologue ─────────────────────────────────
// Returns a random world-grounded thought seed for inner monologue
function getWorldThoughtSeed() {
  if (!_worldConfig.places.length && !_worldConfig.home) return null;

  const all = _worldConfig.places.filter(p => p.name);
  if (!all.length) return null;

  const p = all[Math.floor(Math.random() * all.length)];
  const seeds = [
    'thinking about going to ' + p.name + ' later',
    'I was at ' + p.name + ' earlier — something about it stayed with me',
    'wondering if I should go to ' + p.name,
    'I need to pick something up from ' + p.name,
    'it has been a while since I went to ' + p.name,
  ];
  return seeds[Math.floor(Math.random() * seeds.length)];
}

// ── UI ────────────────────────────────────────────────────────────────────────
function toggleWorldConfig() {
  const panel = document.getElementById('world-config-panel');
  if (!panel) return;
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : '';
  if (!isOpen) renderWorldConfigUI();
}

function renderWorldConfigUI() {
  const homeEl  = document.getElementById('wc-home-input');
  const neighEl = document.getElementById('wc-neighborhood-input');
  if (homeEl)  homeEl.value  = _worldConfig.home         || '';
  if (neighEl) neighEl.value = _worldConfig.neighborhood || '';

  const list = document.getElementById('wc-places-list');
  if (!list) return;

  if (!_worldConfig.places.length) {
    list.innerHTML = '<div style="font-size:9px;color:#445;text-align:center;padding:8px;">No places yet — click ADD PLACE</div>';
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
        placeholder="e.g. 5 min walk" oninput="wcUpdatePlace(${i},'distance',this.value)"/>
      <input class="wc-f wc-notes" value="${(p.notes||'').replace(/"/g,'&quot;')}"
        placeholder="notes (optional)" oninput="wcUpdatePlace(${i},'notes',this.value)"/>
      <button class="wc-del" onclick="wcRemovePlace(${i})">✕</button>
    </div>
  `).join('');
}

function wcSaveHome() {
  _worldConfig.home         = document.getElementById('wc-home-input')?.value?.trim()        || '';
  _worldConfig.neighborhood = document.getElementById('wc-neighborhood-input')?.value?.trim() || '';
  saveWorldConfig();
  if (typeof appendMsg === 'function') appendMsg('system', '🏠 World home saved.');
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
