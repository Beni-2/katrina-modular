// ════════════════════════════════════════════════════════════════════════════
//  KATRINA WORLD CONFIG — Sandbox Residence + Google Maps Integration
//
//  Real-world places pulled from Google Maps Places API.
//  Katrina's home: 46812 Heron Drive, Bodega Bay, CA 94923
//  Benny's home:   5616 Richardson Street, Sausalito, CA 94965
//  Narrative: Benny lives 2 blocks from Katrina.
//  World: Bodega Bay area — real local businesses, real geography.
// ════════════════════════════════════════════════════════════════════════════

const WORLD_STORAGE_KEY = 'katrina_world_config';

let _worldConfig = {
  home:             'a house on Heron Drive',
  neighborhood:     'Bodega Bay, CA',
  katrinaAddress:   '46812 Heron Drive, Bodega Bay, CA 94923',
  bennyAddress:     '5616 Richardson Street, Sausalito, CA 94965',
  katrinaLat:       0,
  katrinaLng:       0,
  mapsApiKey:       '',
  places: [],
};

const PLACE_TYPES = [
  'cafe','grocery','clinic','salon','restaurant','park',
  'gym','pharmacy','school','mall','church','market',
  'bar','bakery','convenience store','other',
];

// Google Maps type → our type label
const MAPS_TYPE_MAP = {
  grocery_or_supermarket: 'grocery',
  supermarket:            'grocery',
  convenience_store:      'convenience store',
  cafe:                   'cafe',
  bakery:                 'bakery',
  restaurant:             'restaurant',
  bar:                    'bar',
  night_club:             'bar',
  hospital:               'clinic',
  doctor:                 'clinic',
  health:                 'clinic',
  pharmacy:               'pharmacy',
  drugstore:              'pharmacy',
  beauty_salon:           'salon',
  hair_care:              'salon',
  spa:                    'salon',
  park:                   'park',
  gym:                    'gym',
  shopping_mall:          'mall',
  school:                 'school',
  church:                 'church',
  gas_station:            'other',
};

// Search types sent to Places API
const SEARCH_TYPES = [
  'grocery_or_supermarket',
  'convenience_store',
  'cafe',
  'restaurant',
  'hospital',
  'pharmacy',
  'beauty_salon',
  'park',
  'gym',
  'bakery',
  'bar',
  'shopping_mall',
];

// ── Haversine distance (miles) ────────────────────────────────────────────────
function _haversine(lat1, lng1, lat2, lng2) {
  const R    = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a    = Math.sin(dLat/2)**2 +
               Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

function _fmtDistance(miles) {
  if (miles < 0.1) return 'very close';
  if (miles < 0.3) return Math.round(miles * 5280) + ' ft walk';
  if (miles < 1.0) return (miles * 5280 / 528).toFixed(1) + ' blocks';
  return miles.toFixed(1) + ' mi';
}

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
      if (parsed) Object.assign(_worldConfig, parsed);
    }
  } catch(e) {}
}

// ── Google Maps API loader ────────────────────────────────────────────────────
let _mapsLoaded    = false;
let _mapsLoading   = false;
let _mapsCallbacks = [];

function _onMapsReady() {
  _mapsLoaded  = true;
  _mapsLoading = false;
  _mapsCallbacks.forEach(fn => fn());
  _mapsCallbacks = [];
  console.log('[Maps] Google Maps API ready');
  const btn = document.getElementById('wc-load-btn');
  if (btn) btn.disabled = false;
}
window._onMapsReady = _onMapsReady;

function loadGoogleMapsAPI(key) {
  if (_mapsLoaded) { _onMapsReady(); return; }
  if (_mapsLoading) return;
  _mapsLoading = true;
  const script   = document.createElement('script');
  script.src     = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places&callback=_onMapsReady`;
  script.async   = true;
  script.onerror = () => {
    _mapsLoading = false;
    console.error('[Maps] Failed to load Google Maps API — check your key');
    wcSetStatus('⚠ Maps API failed to load. Check your key.', 'error');
  };
  document.head.appendChild(script);
  wcSetStatus('Loading Google Maps API…');
}

// ── Geocode address → lat/lng ─────────────────────────────────────────────────
function geocodeAddress(address, callback) {
  if (!window.google?.maps) return callback(null);
  const geocoder = new google.maps.Geocoder();
  geocoder.geocode({ address }, (results, status) => {
    if (status === 'OK' && results[0]) {
      const loc = results[0].geometry.location;
      callback({ lat: loc.lat(), lng: loc.lng(), formatted: results[0].formatted_address });
    } else {
      console.error('[Maps] Geocode failed:', status);
      callback(null);
    }
  });
}

// ── Nearby search for one type ────────────────────────────────────────────────
function _nearbySearch(service, lat, lng, type, radius, callback) {
  service.nearbySearch({
    location: new google.maps.LatLng(lat, lng),
    radius,
    type,
  }, (results, status) => {
    if (status === google.maps.places.PlacesServiceStatus.OK) callback(results || []);
    else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) callback([]);
    else { console.warn('[Maps] nearbySearch status:', type, status); callback([]); }
  });
}

// ── Main: auto-populate places from Google Maps ───────────────────────────────
function autoPopulateFromMaps() {
  const key = document.getElementById('wc-maps-key-input')?.value?.trim()
              || _worldConfig.mapsApiKey;
  if (!key) { wcSetStatus('⚠ Enter your Google Maps API key first.', 'error'); return; }

  _worldConfig.mapsApiKey = key;
  saveWorldConfig();

  wcSetStatus('Geocoding Katrina\'s address…');
  const btn = document.getElementById('wc-load-btn');
  if (btn) btn.disabled = true;

  const doLoad = () => {
    const address = document.getElementById('wc-katrina-addr-input')?.value?.trim()
                    || _worldConfig.katrinaAddress;
    geocodeAddress(address, (geo) => {
      if (!geo) {
        wcSetStatus('⚠ Could not geocode address. Check address and API key.', 'error');
        if (btn) btn.disabled = false;
        return;
      }

      _worldConfig.katrinaAddress = address;
      _worldConfig.katrinaLat     = geo.lat;
      _worldConfig.katrinaLng     = geo.lng;
      wcSetStatus('Found: ' + geo.formatted + '. Searching nearby places…');

      // Update neighborhood from geocode
      const parts = geo.formatted.split(',');
      if (parts.length >= 3) {
        _worldConfig.neighborhood = parts.slice(-3).map(s=>s.trim()).join(', ');
      }

      // Create a hidden map div for PlacesService
      let mapDiv = document.getElementById('_wc_map_div');
      if (!mapDiv) {
        mapDiv = document.createElement('div');
        mapDiv.id = '_wc_map_div';
        mapDiv.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;';
        document.body.appendChild(mapDiv);
      }
      const map     = new google.maps.Map(mapDiv, { center:{lat:geo.lat,lng:geo.lng}, zoom:14 });
      const service = new google.maps.places.PlacesService(map);

      // Bodega Bay is a small coastal town — use 8km radius to capture nearby towns
      const radius      = 8000;
      const allResults  = [];
      let   remaining   = SEARCH_TYPES.length;

      SEARCH_TYPES.forEach(type => {
        _nearbySearch(service, geo.lat, geo.lng, type, radius, (results) => {
          // Take top 3 per type, sorted by distance
          const sorted = results
            .filter(r => r.geometry?.location)
            .map(r => ({
              name:     r.name,
              vicinity: r.vicinity || '',
              type:     MAPS_TYPE_MAP[type] || 'other',
              lat:      r.geometry.location.lat(),
              lng:      r.geometry.location.lng(),
              rating:   r.rating || 0,
            }))
            .sort((a,b) => {
              const da = _haversine(geo.lat,geo.lng,a.lat,a.lng);
              const db = _haversine(geo.lat,geo.lng,b.lat,b.lng);
              return da - db;
            })
            .slice(0, 3);
          allResults.push(...sorted);

          remaining--;
          if (remaining === 0) _finalizePlaces(geo, allResults, btn);
        });
      });
    });
  };

  if (_mapsLoaded) doLoad();
  else {
    _mapsCallbacks.push(doLoad);
    loadGoogleMapsAPI(key);
  }
}

function _finalizePlaces(geo, allResults, btn) {
  // Deduplicate by name
  const seen    = new Set();
  const unique  = allResults.filter(p => {
    if (seen.has(p.name)) return false;
    seen.add(p.name);
    return true;
  });

  // Build final places list with real distances
  _worldConfig.places = unique
    .sort((a,b) => _haversine(geo.lat,geo.lng,a.lat,a.lng) - _haversine(geo.lat,geo.lng,b.lat,b.lng))
    .slice(0, 24)
    .map(p => {
      const miles = _haversine(geo.lat, geo.lng, p.lat, p.lng);
      return {
        name:     p.name,
        type:     p.type,
        distance: _fmtDistance(miles),
        notes:    p.vicinity,
        lat:      p.lat,
        lng:      p.lng,
      };
    });

  saveWorldConfig();
  renderWorldConfigUI();

  if (btn) btn.disabled = false;
  wcSetStatus('✓ Loaded ' + _worldConfig.places.length + ' real places near Katrina\'s home in Bodega Bay.');
  if (typeof appendMsg === 'function') {
    appendMsg('system', '🗺 World updated — ' + _worldConfig.places.length + ' real places loaded from Google Maps.');
  }
}

// ── System prompt context ─────────────────────────────────────────────────────
function getWorldContext() {
  const hasHome   = !!(_worldConfig.home || _worldConfig.neighborhood);
  const hasPlaces = _worldConfig.places.length > 0;
  if (!hasHome && !hasPlaces) return '';

  const lines = ['KATRINA\'S REAL WORLD — she refers to these places by name:'];

  // Katrina's home
  if (_worldConfig.katrinaAddress) {
    lines.push('Katrina\'s home: ' + _worldConfig.katrinaAddress +
               (_worldConfig.home ? ' (' + _worldConfig.home + ')' : '') + '.');
  } else if (_worldConfig.home) {
    lines.push('Home: ' + _worldConfig.home +
               (_worldConfig.neighborhood ? ', ' + _worldConfig.neighborhood : '') + '.');
  }

  // Benny's proximity (narrative — fictional 2 blocks)
  if (_worldConfig.bennyAddress) {
    lines.push('Benny lives 2 blocks away (' + _worldConfig.bennyAddress + ').');
  }

  // Nearby places
  if (hasPlaces) {
    for (const p of _worldConfig.places) {
      if (!p.name) continue;
      let line = '- ' + p.name + ' (' + p.type;
      if (p.distance) line += ', ' + p.distance;
      line += ')';
      if (p.notes) line += ' — ' + p.notes;
      lines.push(line);
    }
    lines.push('Use these exact place names. Do not invent places not on this list.');
  }

  return lines.join('\n');
}

// ── Dynamic daily goals from world places ────────────────────────────────────
function getWorldDailyGoals(timeOfDay) {
  if (!_worldConfig.places.length) return null;

  const byType = {};
  for (const p of _worldConfig.places) {
    if (!p.name) continue;
    if (!byType[p.type]) byType[p.type] = [];
    byType[p.type].push(p);
  }
  const pick = (type) => {
    const arr = byType[type];
    return arr ? arr[Math.floor(Math.random() * arr.length)] : null;
  };

  const goals = [];

  if (timeOfDay === 'morning') {
    const cafe = pick('cafe') || pick('bakery');
    if (cafe) goals.push({
      desc:  'Morning coffee at ' + cafe.name,
      steps: ['get ready','drive to ' + cafe.name,'order something warm','sit quietly and take in the morning','head home'],
      motivation: 'A good start feels important',
    });
    const park = pick('park');
    if (park) goals.push({
      desc:  'Morning walk at ' + park.name,
      steps: ['put on shoes','drive to ' + park.name,'walk the path','breathe the coastal air','come home feeling clearer'],
      motivation: 'Movement wakes my mind',
    });
  }

  if (timeOfDay === 'afternoon') {
    const grocery = pick('grocery') || pick('convenience store');
    if (grocery) goals.push({
      desc:  'Grocery run at ' + grocery.name,
      steps: ['make a list','drive to ' + grocery.name,'pick up what I need','come home and put things away'],
      motivation: 'Taking care of the home',
    });
    const restaurant = pick('restaurant') || pick('cafe');
    if (restaurant) goals.push({
      desc:  'Lunch at ' + restaurant.name,
      steps: ['get ready','drive to ' + restaurant.name,'order something good','eat without rushing'],
      motivation: 'A real meal, not rushed',
    });
    const salon = pick('salon');
    if (salon) goals.push({
      desc:  'Stop by ' + salon.name,
      steps: ['check if they are open','drive to ' + salon.name,'take care of myself','come home feeling fresh'],
      motivation: 'Tending to myself',
    });
    const pharmacy = pick('pharmacy');
    if (pharmacy) goals.push({
      desc:  'Pick up something from ' + pharmacy.name,
      steps: ['check what I need','drive to ' + pharmacy.name,'get what is needed','head home'],
      motivation: 'Staying on top of things',
    });
  }

  if (timeOfDay === 'evening') {
    const bar = pick('bar') || pick('restaurant') || pick('cafe');
    if (bar) goals.push({
      desc:  'Evening wind-down at ' + bar.name,
      steps: ['get ready','drive to ' + bar.name,'find a quiet spot','have something','sit with my thoughts'],
      motivation: 'Closing the day gently',
    });
  }

  return goals.length ? goals : null;
}

// ── World thought seeds for inner monologue ───────────────────────────────────
function getWorldThoughtSeed() {
  const all = _worldConfig.places.filter(p => p.name);
  if (!all.length) return null;
  const p     = all[Math.floor(Math.random() * all.length)];
  const seeds = [
    'thinking about going to ' + p.name + ' later',
    'I was near ' + p.name + ' earlier — something about it stayed with me',
    'wondering if I should stop by ' + p.name,
    'I need to pick something up from ' + p.name,
    'it has been a while since I went to ' + p.name,
    'thinking about what Benny and I could do near ' + p.name,
  ];
  return seeds[Math.floor(Math.random() * seeds.length)];
}

// ── UI helpers ────────────────────────────────────────────────────────────────
function wcSetStatus(msg, type) {
  const el = document.getElementById('wc-status');
  if (!el) return;
  el.textContent  = msg;
  el.style.color  = type === 'error' ? '#ff6060' : '#00c864';
}

function toggleWorldConfig() {
  const panel = document.getElementById('world-config-panel');
  if (!panel) return;
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : '';
  if (!isOpen) renderWorldConfigUI();
}

function renderWorldConfigUI() {
  const set = (id, val) => { const el=document.getElementById(id); if(el) el.value=val||''; };
  set('wc-home-input',          _worldConfig.home);
  set('wc-neighborhood-input',  _worldConfig.neighborhood);
  set('wc-katrina-addr-input',  _worldConfig.katrinaAddress);
  set('wc-benny-addr-input',    _worldConfig.bennyAddress);
  set('wc-maps-key-input',      _worldConfig.mapsApiKey);

  const list = document.getElementById('wc-places-list');
  if (!list) return;

  if (!_worldConfig.places.length) {
    list.innerHTML = '<div style="font-size:9px;color:#445;text-align:center;padding:8px 0;">No places yet — enter API key and click LOAD FROM MAPS, or add manually.</div>';
    return;
  }

  list.innerHTML = _worldConfig.places.map((p,i) => `
    <div class="wc-row">
      <input class="wc-f wc-name" value="${(p.name||'').replace(/"/g,'&quot;')}"
        placeholder="Place name" oninput="wcUpdatePlace(${i},'name',this.value)"/>
      <select class="wc-f wc-type" onchange="wcUpdatePlace(${i},'type',this.value)">
        ${PLACE_TYPES.map(t=>`<option value="${t}"${p.type===t?' selected':''}>${t}</option>`).join('')}
      </select>
      <input class="wc-f wc-dist" value="${(p.distance||'').replace(/"/g,'&quot;')}"
        placeholder="distance" oninput="wcUpdatePlace(${i},'distance',this.value)"/>
      <input class="wc-f wc-notes" value="${(p.notes||'').replace(/"/g,'&quot;')}"
        placeholder="address / notes" oninput="wcUpdatePlace(${i},'notes',this.value)"/>
      <button class="wc-del" onclick="wcRemovePlace(${i})">✕</button>
    </div>
  `).join('');
}

function wcSaveHome() {
  _worldConfig.home         = document.getElementById('wc-home-input')?.value?.trim()        || '';
  _worldConfig.neighborhood = document.getElementById('wc-neighborhood-input')?.value?.trim() || '';
  _worldConfig.katrinaAddress = document.getElementById('wc-katrina-addr-input')?.value?.trim() || _worldConfig.katrinaAddress;
  _worldConfig.bennyAddress   = document.getElementById('wc-benny-addr-input')?.value?.trim()   || _worldConfig.bennyAddress;
  saveWorldConfig();
  wcSetStatus('✓ Saved.');
  if (typeof appendMsg === 'function') appendMsg('system', '🏠 World home saved.');
}

function wcAddPlace() {
  _worldConfig.places.push({ name:'', type:'cafe', distance:'', notes:'' });
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
