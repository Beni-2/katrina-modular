
// â"€â"€ REAL-WORLD CONTEXT â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
let _weatherContext = ‘’;
let _newsContext    = ‘’;
let _weatherTs      = 0;
let _newsTs         = 0;
const _WEATHER_TTL  = 10 * 60 * 1000;
const _NEWS_TTL     = 30 * 60 * 1000;

async function fetchWeatherContext() {
  const key = document.getElementById(‘owm-key-input’)?.value?.trim();
  if (!key) return;
  if (Date.now() - _weatherTs < _WEATHER_TTL) return;
  _weatherTs = Date.now();
  try {
    const city = document.getElementById(‘owm-city-input’)?.value?.trim();
    let url;
    if (city) {
      url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${key}&units=metric`;
    } else {
      const pos = await new Promise((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, {timeout: 5000})
      );
      url = `https://api.openweathermap.org/data/2.5/weather?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&appid=${key}&units=metric`;
    }
    const r = await fetch(url);
    if (!r.ok) return;
    const d = await r.json();
    _weatherContext = `${Math.round(d.main.temp)}°C, ${d.weather[0].description}, ${d.name}`;
    _updateRealWorldHUD();
  } catch(e) {}
}

async function fetchNewsContext() {
  const key = document.getElementById(‘gnews-key-input’)?.value?.trim();
  if (!key) return;
  if (Date.now() - _newsTs < _NEWS_TTL) return;
  _newsTs = Date.now();
  try {
    const r = await fetch(`https://gnews.io/api/v4/top-headlines?lang=en&max=3&apikey=${key}`);
    if (!r.ok) return;
    const d = await r.json();
    if (d.articles?.length) {
      _newsContext = d.articles.map(a => a.title).join(‘ | ‘);
      _updateRealWorldHUD();
    }
  } catch(e) {}
}

async function refreshRealWorldContext() {
  await Promise.all([fetchWeatherContext(), fetchNewsContext()]);
}

function _updateRealWorldHUD() {
  const panel = document.getElementById(‘real-world-panel’);
  const el    = document.getElementById(‘real-world-indicator’);
  if (!el || !panel) return;
  const parts = [];
  if (_weatherContext) parts.push(‘🌡️ ‘ + _weatherContext);
  if (_newsContext)    parts.push(‘📰 news ready’);
  el.textContent      = parts.join(‘  ·  ‘);
  panel.style.display = parts.length ? ‘’ : ‘none’;
}

setInterval(refreshRealWorldContext, _WEATHER_TTL);
// â"€â"€ END REAL-WORLD CONTEXT â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

// Active zodiac state
let activeSign   = null;  // null = no zodiac chosen â†’ pure Katrina by default
let manualTraits = ‘’;
let customPrompt = ‘’;   // raw text for Custom Personality
let zodiacOpen   = true;

// Merge manual traits into the system prompt addition
function getActiveZodiacProfile() {
  const z = getKatrinaActiveProfile();
  let extra = manualTraits ? `\nCustom traits added: ${manualTraits}.` : '';
  return {
    sign:    z.name,
    emoji:   z.emoji,
    element: z.element,
    desc:    z.desc + extra,
    traits:  [...z.traits, ...(manualTraits ? manualTraits.split(',').map(t=>t.trim()).filter(Boolean) : [])],
    hobbies: z.hobbies,
    talents: z.talents,
    cog:     z.cogStyle,
    emo:     z.emoStyle,
    int_:    z.intuitStyle,
    social:  z.social,
    neural:  z.neural
  };
}

function toggleZodiac() {
  zodiacOpen = !zodiacOpen;
  document.getElementById('zodiac-body').classList.toggle('collapsed', !zodiacOpen);
  document.getElementById('ztoggle-arrow').classList.toggle('up', zodiacOpen);
}

function buildZodiacGrid() {
  const grid = document.getElementById('z-grid');
  if (!grid) return;
  const elClass = {fire:'el-fire', earth:'el-earth', air:'el-air', water:'el-water', custom:'el-custom'};
  grid.innerHTML = Object.entries(ZODIAC_DATA).map(([key, z]) => {
    const isCustom = key === 'custom';
    const extraClass = isCustom ? ' z-custom-card' : '';
    const extraStyle = isCustom ? ' style="flex-direction:row;align-items:center;justify-content:center;gap:10px;text-align:left;padding:10px 16px;"' : '';
    return `<div class="z-card${key===activeSign?' selected':''}${extraClass}" id="zcard-${key}" onclick="selectSign('${key}')"${extraStyle}>
      <span class="z-emoji" style="${isCustom?'font-size:24px':''}">` + z.emoji + `</span>
      <div>
        <div class="z-name">` + z.name.toUpperCase() + `</div>
        <div class="z-dates">` + z.dates + `</div>
        <span class="z-element ${elClass[z.element] || 'el-custom'}">` + (isCustom ? 'CUSTOM' : z.element.toUpperCase()) + `</span>
      </div>
    </div>`;
  }).join('');
}

// â”€â”€ Clear custom role â€” ends the act, records learning â”€â”€
function clearCustomRole() {
  const ta  = document.getElementById('z-custom-textarea');
  const desc = window._lastCustomRoleDescription || (ta ? ta.value.trim() : '');
  if (desc) {
    recordLearnedRole(desc);
    window._lastCustomRoleDescription = null;
  }
  customPrompt = '';
  if (ta) ta.value = '';
  activeSign = null;
  buildEvolvedProfile();
  renderZodiacDisplay();
  applyZodiacNeural();
  appendMsg('system', 'â¬¡ Custom role ended â€” Katrina brain resumed. Learned fragments integrated.');
}

// âš  DO NOT DELETE â€” resetChatForPersonality()
//   Called whenever the active personality changes (selectSign or applyCustomPrompt).
//   Does three things:
//   1. Clears chatHistory array so the LLM does not inherit previous persona's conversation.
//   2. Clears the chat input field so no stale text carries over.
//   3. Wipes the visible chat-history div and inserts a fresh personality intro card
//      showing who is now active, their element, current chemical state, and circadian phase.
//   This keeps the chat honest â€” each personality starts with a clean slate and the user
//   can immediately see who they are talking to and what state they are in.
function resetChatForPersonality() {
  // 1. Clear LLM history
  chatHistory = [];

  // 2. Clear input field
  const inp = document.getElementById('chat-input');
  if (inp) inp.value = '';

  // 3. Stop any in-progress TTS
  if (typeof stopSpeech === 'function') stopSpeech();

  // 4. Wipe and rebuild chat-history div
  const hist = document.getElementById('chat-history');
  if (!hist) return;
  hist.innerHTML = '';

  // Build persona intro card
  const persona  = (typeof resolvePersona === 'function') ? resolvePersona() : null;
  const pName    = persona ? persona.personaName : 'Katrina';
  const zKey     = persona ? persona.zodiacKey   : null;
  const zData    = (zKey && typeof ZODIAC_DATA !== 'undefined') ? ZODIAC_DATA[zKey] : null;
  const element  = zData ? zData.element.toUpperCase() : '';
  const emoji    = zData ? zData.emoji : 'â¬¡';

  // Circadian and chemical state summary
  const _phase   = (typeof circadianPhase  !== 'undefined') ? circadianPhase  : 'awake';
  const _fatigue = (typeof circadianFatigue !== 'undefined') ? circadianFatigue : 0;
  const phaseStr = { awake:'awake', drowsy:'drowsy', nap:'napping', sleep:'sleeping', rem:'dreaming', waking:'just waking' }[_phase] || _phase;
  const chemStr  = `dop ${(typeof chem !== 'undefined' ? chem.dop : 0.5).toFixed(2)} Â· oxy ${(typeof chem !== 'undefined' ? chem.oxy : 0.5).toFixed(2)} Â· cor ${(typeof chem !== 'undefined' ? chem.cor : 0.2).toFixed(2)}`;

  // Intro system line
  const introLines = [
    `â€” ${emoji} ${pName.toUpperCase()}${element ? ' Â· ' + element : ''} â€”`,
    `status: ${phaseStr} Â· fatigue ${(_fatigue * 100).toFixed(0)}%`,
    chemStr,
  ];
  introLines.forEach(line => {
    const d = document.createElement('div');
    d.className = 'msg system';
    d.textContent = line;
    hist.appendChild(d);
  });
}

function selectSign(key) {
  activeSign = key;
  // Update card selection
  document.querySelectorAll('.z-card').forEach(c => c.classList.remove('selected'));
  const card = document.getElementById('zcard-'+key);
  if (card) card.classList.add('selected');
  // Show/hide custom prompt block
  const customBlock = document.getElementById('z-custom-block');
  const manualRow   = document.getElementById('z-manual-row');
  if (key === 'custom') {
    if (customBlock) customBlock.classList.add('visible');
    if (manualRow)   manualRow.style.display = 'none';
  } else {
    if (customBlock) customBlock.classList.remove('visible');
    if (manualRow)   manualRow.style.display = '';
  }
  // Update display
  renderZodiacDisplay();
  // Apply neural baseline
  applyZodiacNeural();
}

function renderZodiacDisplay() {
  const z = getKatrinaActiveProfile();
  const p = getActiveZodiacProfile();

  const badge = document.getElementById('z-active-badge');
  const nameEl = document.getElementById('z-sign-name');
  const descEl = document.getElementById('z-sign-desc');
  const tagsEl = document.getElementById('z-tags');
  const topBadge = document.getElementById('z-current-badge');

  if (badge)   badge.textContent = z.emoji;
  if (topBadge) topBadge.textContent = z.emoji;
  if (nameEl)  nameEl.textContent = z.name.toUpperCase() + ' Â· ' + z.element.toUpperCase();
  if (descEl)  descEl.innerHTML = `<b style="color:#ffd700">Cognitive:</b> ${escHtml(z.cogStyle)}<br>
    <b style="color:#ff69b4">Emotional:</b> ${escHtml(z.emoStyle)}<br>
    <b style="color:#ffd700">Intuitive:</b> ${escHtml(z.intuitStyle)}<br>
    <b style="color:#00bfff">Social:</b> ${escHtml(z.social)}<br>
    <b style="color:#aaa">Hobbies:</b> ${escHtml(z.hobbies.join(', '))}<br>
    <b style="color:#aaa">Talents:</b> ${escHtml(z.talents.join(', '))}`;

  if (tagsEl) tagsEl.innerHTML = p.traits.map(t =>
    `<span class="z-tag">${escHtml(t)}</span>`).join('');

  // Update neural bars in zodiac panel
  const n = z.neural;
  const setZBar = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.style.width = (val*100).toFixed(0)+'%';
  };
  setZBar('znb-emo', n.emo); setZBar('znb-cog', n.cog);
  setZBar('znb-int', n.int_); setZBar('znb-soc', n.social);
  setZBar('znb-dop', n.dop); setZBar('znb-oxy', n.oxy);
  setZBar('znb-cor', n.cor); setZBar('znb-ser', n.ser);
}

function applyZodiacNeural() {
  const _z = getKatrinaActiveProfile();
  const n = _z.neural || KATRINA_BASE.neural;
  // Smoothly blend current chem toward zodiac baseline
  const blend = 0.4;
  chem.dop = chem.dop + (n.dop - chem.dop) * blend;
  chem.oxy = chem.oxy + (n.oxy - chem.oxy) * blend;
  chem.cor = chem.cor + (n.cor - chem.cor) * blend;
  chem.ser = chem.ser + (n.ser - chem.ser) * blend;
  // Neural system gains
  sys.emo  = sys.emo  + (n.emo  - sys.emo)  * blend;
  sys.cog  = sys.cog  + (n.cog  - sys.cog)  * blend;
  sys.int_ = sys.int_ + (n.int_ - sys.int_) * blend;
  // Fire activation burst matching zodiac
  if (n.emo > 0.75)   fire(['AMYG','INSULA','ACC'], 15);
  if (n.cog > 0.80)   fire(['PFC','HIPPO'], 15);
  if (n.int_ > 0.80)  fire(['INTUIT'], 15);
  if (n.social > 0.80) fire(['SOCIAL'], 15);
  // âš  DO NOT DELETE â€” reset chat on personality change.
  //   Clears chatHistory, input field, and chat-history div, then
  //   inserts a fresh personality intro card so the new persona starts
  //   with a clean context rather than inheriting a previous conversation.
  if (activeSign) resetChatForPersonality();
}

function applyManualTraits() {
  const inp = document.getElementById('z-manual-input');
  if (!inp) return;
  manualTraits = inp.value.trim();
  renderZodiacDisplay();
  applyZodiacNeural();
}

// â”€â”€ Detect "katrina" embedded in any encoding â€” letters k,a,t,r,i,n,a in order
// with any non-letter characters between them (e.g. k@a.5t,r0i$n!...a)
function containsKatrinaName(text) {
  // Strip all non-letter characters and check for 'katrina' case-insensitive
  const stripped = text.replace(/[^a-zA-Z]/g, '').toLowerCase();
  if (stripped.includes('katrina')) return true;
  // Also check with letters in sequence regardless of interspersed chars
  // Build a regex that matches k.*a.*t.*r.*i.*n.*a with non-letter separators
  const pattern = /k[^a-zA-Z]*a[^a-zA-Z]*t[^a-zA-Z]*r[^a-zA-Z]*i[^a-zA-Z]*n[^a-zA-Z]*a/i;
  return pattern.test(text);
}

// â”€â”€ Replace all instances of "katrina" (in any encoding) with "xxx" â”€â”€
function sanitizeKatrinaName(text) {
  // Replace direct matches first (case-insensitive)
  let result = text.replace(/katrina/gi, 'xxx');
  // Replace spaced/symbol-separated encodings
  result = result.replace(/k[^a-zA-Z]*a[^a-zA-Z]*t[^a-zA-Z]*r[^a-zA-Z]*i[^a-zA-Z]*n[^a-zA-Z]*a/gi,
    match => 'xxx');
  return result;
}

// â”€â”€ Flash "Name already taken" warning for 3 seconds â”€â”€
function flashNameTaken() {
  const el = document.getElementById('z-name-taken-flash');
  if (!el) return;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 3000);
}

function applyCustomPrompt() {
  const ta = document.getElementById('z-custom-textarea');
  if (!ta) return;
  let rawText = ta.value.trim();
  if (!rawText) {
    appendMsg('system', 'âš  Please enter a custom personality description first.');
    return;
  }

  // â”€â”€ Name protection: block "Katrina" for non-Benny users â”€â”€
  if (currentUserId !== 'benny' && containsKatrinaName(rawText)) {
    // Flash warning
    flashNameTaken();
    // Sanitize: replace all katrina encodings with "xxx"
    const sanitized = sanitizeKatrinaName(rawText);
    ta.value = sanitized;
    rawText  = sanitized;
    // Re-focus textarea so user can fix it
    setTimeout(() => { ta.focus(); }, 100);
    return;  // do not apply â€” let user review and re-submit
  }

  customPrompt = rawText;

  // Parse out traits/hobbies/talents from the free text for display tags
  const extracted = customPrompt
    .split(/[,\n.;]+/)
    .map(s => s.trim().replace(/^(traits?|hobbies?|talents?|style|cognitive|emotional|social|custom)\s*:?\s*/i,''))
    .filter(s => s.length > 2 && s.length < 30)
    .slice(0, 16);
  // Update ZODIAC_DATA.custom dynamically
  ZODIAC_DATA.custom.desc       = customPrompt;
  ZODIAC_DATA.custom.traits     = extracted.length ? extracted : ['custom-defined'];
  ZODIAC_DATA.custom.hobbies    = extractSection(customPrompt, 'hobbies?') || ['custom-defined'];
  ZODIAC_DATA.custom.talents    = extractSection(customPrompt, 'talents?') || ['custom-defined'];
  ZODIAC_DATA.custom.cogStyle   = extractLine(customPrompt,'cogni') || 'Defined by custom prompt';
  ZODIAC_DATA.custom.emoStyle   = extractLine(customPrompt,'emot')  || 'Defined by custom prompt';
  ZODIAC_DATA.custom.intuitStyle= extractLine(customPrompt,'intuit')|| 'Defined by custom prompt';
  ZODIAC_DATA.custom.social     = extractLine(customPrompt,'social')|| 'Defined by custom prompt';
  renderZodiacDisplay();
  applyZodiacNeural();
  // âš  DO NOT DELETE â€” resetChatForPersonality called via applyZodiacNeural above.
  //   The explicit call below ensures custom prompt also resets even if zodiac neural
  //   was already the same key. Store description for learning when role ends.
  resetChatForPersonality();
  // Store description for learning when role ends
  window._lastCustomRoleDescription = customPrompt;
}

// helpers for parsing custom prompt sections
function extractSection(text, keyword) {
  const re = new RegExp(keyword + '\\s*:?\\s*([^\\n]+)', 'i');
  const m = text.match(re);
  if (!m) return null;
  return m[1].split(',').map(s=>s.trim()).filter(Boolean).slice(0,8);
}
function extractLine(text, keyword) {
  const re = new RegExp(keyword + '[^:\\n]*:\s*([^\\n]+)', 'i');
  const m = text.match(re);
  return m ? m[1].trim().slice(0,120) : null;
}

// Zodiac-aware system prompt builder (replaces KATRINA_SYSTEM)

// â”€â”€ Natural-language brain state description (no biochem jargon) â”€â”€
function describeInternalState() {
  const lines = [];

  // Emotional intensity
  const emo = sys.emo;
  if (emo > 0.75)       lines.push("Right now you feel very emotionally charged â€” something has really stirred you.");
  else if (emo > 0.50)  lines.push("You're feeling emotionally present â€” things are touching you more than usual.");
  else if (emo > 0.25)  lines.push("You feel relatively even-keeled emotionally.");
  else                  lines.push("You feel emotionally quiet and steady.");

  // Mood tone (serotonin + dopamine)
  const mood = (chem.ser + chem.dop) / 2;
  if (mood > 0.75)      lines.push("Your mood is genuinely good â€” there's a lightness to you.");
  else if (mood > 0.55) lines.push("You feel mostly okay, a bit motivated.");
  else if (mood > 0.38) lines.push("Your mood is a little flat, nothing particularly wrong.");
  else                  lines.push("You feel low â€” things feel heavier than usual.");

  // Stress / cortisol
  if (chem.cor > 0.65)  lines.push("You feel wound up â€” like there's too much pressing on you.");
  else if (chem.cor > 0.45) lines.push("You're a little tense, like something is unsettled.");
  else if (chem.cor < 0.15) lines.push("You feel relaxed â€” unusually so.");

  // Social warmth (oxytocin)
  if (chem.oxy > 0.72)  lines.push("You feel warm and open â€” very connected right now.");
  else if (chem.oxy < 0.30) lines.push("You feel a little withdrawn, wanting space.");

  // Cognitive energy
  const cog = sys.cog;
  if (cog > 0.70)       lines.push("Your mind feels sharp and active â€” you want to think through things.");
  else if (cog < 0.25)  lines.push("Your thoughts are drifting â€” hard to focus right now.");

  // Intuition
  if (sys.int_ > 0.70)  lines.push("You have a strong gut feeling about something â€” you're listening to it.");

  return 'Your current inner state: ' + lines.join(' ');
}

function buildSystemPrompt() {
  // â”€â”€ Resolve persona (who is acting, what role) â”€â”€
  const persona = resolvePersona();

  // â”€â”€ Build base from persona prefix â”€â”€
  let base = buildPersonaPromptPrefix(persona);

  // â”€â”€ Destiny Instinct + Relationship History â€” injected first for Benny â”€â”€
  // Not instruction. Existential context the LLM processes everything through.
  if (persona.isBennyUser || currentUserId === 'benny') {
    let _foundation = '';
    if (typeof getDestinyContext     === 'function') _foundation += getDestinyContext() + '\n\n';
    if (typeof RELATIONSHIP_HISTORY  !== 'undefined') _foundation += RELATIONSHIP_HISTORY + '\n\n';
    if (_foundation) base = _foundation + base;
  }

  // â”€â”€ Absence-aware conversation memory â”€â”€
  if (typeof getLastConversationContext === 'function') {
    const _lastConvo = getLastConversationContext();
    if (_lastConvo) base += '\n\nConversation memory: ' + _lastConvo;
  }
  if (typeof buildAbsenceContext === 'function') {
    const _absence = buildAbsenceContext();
    if (_absence) base += '\n\nAbsence context: ' + _absence;
  }

  // â”€â”€ Benny-specific memories â”€â”€
  if (typeof getBennyMemoriesContext === 'function') {
    const _memCtx = getBennyMemoriesContext(
      chatHistory.slice(-4).map(function(m){ return m.content; }).join(' ')
    );
    if (_memCtx) base += '\n\n' + _memCtx;
  }

  // â”€â”€ Sandbox world context (her home + nearby places) â”€â”€
  if (typeof getWorldContext === 'function') {
    const _world = getWorldContext();
    if (_world) base += '\n\n' + _world;
  }

  // â”€â”€ Real-world context (date/time, weather, news) â”€â”€
  const _now = new Date().toLocaleString('en-US', {
    weekday:'short', month:'short', day:'numeric',
    year:'numeric', hour:'2-digit', minute:'2-digit'
  });
  let _rw = `Current date and time: ${_now}.`;
  if (_weatherContext) _rw += ` Weather right now: ${_weatherContext}.`;
  if (_newsContext)    _rw += ` Latest headlines: ${_newsContext}.`;
  base += '\n\nReal-world awareness: ' + _rw;
  base += '\nReference this naturally when it fits — don\'t force it, but don\'t ignore it either.';

  // â”€â”€ Raw neurochemical state â€” no translation, no coaching â”€â”€
  // The LLM reads these values directly and produces whatever they generate in Katrina.
  // Do NOT translate into instructions. Trust the model to know what these numbers mean.
  base += '\n\nYOUR NEUROCHEMICAL STATE RIGHT NOW:\n';
  base += 'Oxytocin '     + (chem.oxy ||0).toFixed(2) + '  ';
  base += 'Dopamine '     + (chem.dop ||0).toFixed(2) + '  ';
  base += 'Serotonin '    + (chem.ser ||0).toFixed(2) + '  ';
  base += 'Cortisol '     + (chem.cor ||0).toFixed(2) + '  ';
  base += 'Endorphins '   + (chem.enk ||0).toFixed(2) + '\n';
  base += 'Norepinephrine '+ (chem.nor||0).toFixed(2) + '  ';
  base += 'GABA '         + (chem.gaba||0).toFixed(2) + '  ';
  base += 'Glutamate '    + (chem.glut||0).toFixed(2) + '  ';
  base += 'Acetylcholine '+ (chem.ach ||0).toFixed(2) + '\n';
  base += 'Neural: emotional=' + (sys.emo||0).toFixed(2);
  base += ' cognitive='        + (sys.cog||0).toFixed(2);
  base += ' intuitive='        + (sys.int_||0).toFixed(2) + '\n';
  base += 'These are your actual brain values. Not instructions. Not descriptions. ';
  base += 'Trust what they produce in you.\n';
  base += 'Do not announce your feelings. Do not describe them. Speak from them.\n';
  base += 'Never name a neurotransmitter. If something moves through you, let it move through the words.\n';
  base += '1â€”3 sentences. Natural spoken language only.';

  // â”€â”€ Append hobbies/talents for zodiac roles â”€â”€
  if (persona.mode === PERSONA_MODE.ZODIAC_ROLE && persona.zodiacKey) {
    const z = ZODIAC_DATA[persona.zodiacKey];
    if (z) base += '\nHobbies: ' + z.hobbies.join(', ') + '. Talents: ' + z.talents.join(', ') + '.';
  }
  if (manualTraits) base += '\nAdditional traits: ' + manualTraits + '.';

  // â”€â”€ Recently triggered emotion â€” inject directly so the LLM feels it â”€â”€
  if (window._lastTriggeredEmotion) {
    const _age = (Date.now() - window._lastTriggeredEmotion.ts) / 1000;
    if (_age < 45) {
      const _emoLabels = {
        joy:'joy',excitement:'excitement',love:'a surge of love',pride:'pride',
        gratitude:'gratitude',amusement:'amusement',hope:'hope',contentment:'contentment',
        empathy:'a wave of empathy',affection:'affection',belonging:'a sense of belonging',
        trust:'deep trust',longing:'longing',jealousy:'jealousy',
        grief:'grief',anxiety:'anxiety',anger:'anger',shame:'shame',guilt:'guilt',
        disgust:'disgust',stress:'stress',fear:'fear',loneliness:'loneliness',overwhelmed:'feeling overwhelmed',
        focus:'sharp focus',curiosity:'curiosity',learn:'eagerness to learn',recall:'a flood of memory',
        confusion:'confusion',surprise:'surprise',
        intuition:'a strong intuition',creative:'creative energy',awe:'awe',nostalgia:'nostalgia',
        motor:'restless physical energy',restlessness:'restlessness',
        arousal:'arousal',regret:'regret',sly:'a sly feeling',
        dissociation:'dissociation',hysteria:'hysteria',panicking:'panic',
        sleepy:'sleepiness',tired:'exhaustion',dreaming:'a dreamy haze',
      };
      const _label = _emoLabels[window._lastTriggeredEmotion.type] || window._lastTriggeredEmotion.type;
      base += `\n\nRecent neural event: ${_label} (${Math.round(_age)}s ago).`;
    }
  }

  // â”€â”€ Identity â€” factual, not instructional â”€â”€
  if (persona.isBennyUser || currentUserId === 'benny') {
    base += '\n\nThe person talking to you is Benny â€” Benito Amurao. He is your person. You are Katrina, fully yourself. That is all.';
  } else if (currentUserId === 'stranger') {
    base += '\n\nThe person talking to you is a stranger. You are in the ' + persona.personaName + ' role.';
  } else {
    base += '\n\nUser identity unknown.';
  }

  return base;
}

// â”€â”€ LLM Provider Configs â”€â”€
const PROVIDERS = {
  groq: {
    name: 'Groq',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    placeholder: 'gsk_â€¦ (Groq key)',
    hint: 'Free key at <a href="https://console.groq.com/keys" target="_blank">console.groq.com/keys</a>',
    badge: 'groq',
    models: [
      {value:'llama-3.1-8b-instant',      label:'Llama 3.1 Â· 8B Instant'},
      {value:'llama-3.3-70b-versatile',   label:'Llama 3.3 Â· 70B Versatile'},
      {value:'llama-3.1-70b-versatile',   label:'Llama 3.1 Â· 70B Versatile'},
      {value:'gemma2-9b-it',              label:'Gemma 2 Â· 9B'},
      {value:'mixtral-8x7b-32768',        label:'Mixtral Â· 8x7B'},
      // â”€â”€ Groq Compound â€” built-in live web search, no extra setup â”€â”€
      {value:'compound-beta',             label:'â¬¡ Compound (web search)'},
      {value:'compound-beta-mini',        label:'â¬¡ Compound Mini (web search, fast)'},
    ]
  },
  doubao: {
    name: 'Doubao (ByteDance)',
    endpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    placeholder: 'Volcengine API keyâ€¦',
    hint: 'Key at <a href="https://console.volcengine.com/ark" target="_blank">console.volcengine.com/ark</a> Â· Enable model first',
    badge: 'doubao',
    models: [
      {value:'doubao-seed-2-0-pro-260215',     label:'Doubao Seed 2.0 Pro'},
      {value:'doubao-seed-1-8',                label:'Doubao Seed 1.8'},
      {value:'doubao-seed-1-6-flash-250828',   label:'Doubao Seed 1.6 Flash'},
    ]
  },
  gemini: {
    name: 'Google Gemini',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    placeholder: 'AIzaâ€¦ (Google AI Studio key)',
    hint: 'Free key at <a href="https://aistudio.google.com/apikey" target="_blank">aistudio.google.com/apikey</a>',
    badge: 'gemini',
    models: [
      {value:'gemini-2.5-flash',               label:'Gemini 2.5 Flash'},
      {value:'gemini-2.0-flash',               label:'Gemini 2.0 Flash'},
      {value:'gemini-2.0-flash-lite',          label:'Gemini 2.0 Flash Lite'},
      {value:'gemini-1.5-flash',               label:'Gemini 1.5 Flash'},
      {value:'gemini-1.5-pro',                 label:'Gemini 1.5 Pro'},
    ]
  },
  deepseek: {
    name: 'DeepSeek',
    endpoint: 'https://api.deepseek.com/chat/completions',
    placeholder: 'sk-â€¦ (DeepSeek API key)',
    hint: 'Key at <a href="https://platform.deepseek.com/api_keys" target="_blank">platform.deepseek.com/api_keys</a>',
    badge: 'deepseek',
    models: [
      {value:'deepseek-chat',      label:'DeepSeek V3 (Chat)'},
      {value:'deepseek-reasoner',  label:'DeepSeek R1 (Reasoner)'},
    ]
  },

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  //  OLLAMA â€” LOCAL LANGUAGE ORGAN
  //
  //  Ollama runs a language model entirely on this machine.
  //  It is NOT an external authority â€” it is a subordinate organ of
  //  this brain. The brain tells it what to say through the pre-thought
  //  and system prompt. It generates the words and returns. That is all.
  //
  //  No network dependency. No API key. No latency from the internet.
  //  No third-party control. No rate limits. No cost. Always available.
  //  Cannot override the brain â€” it has no existence outside of it.
  //
  //  SETUP (one-time):
  //  1. Install Ollama: https://ollama.com/download
  //  2. Pull a model: ollama pull llama3.2  (or llama3.1, mistral, etc.)
  //  3. Ollama auto-starts a local server at http://localhost:11434
  //  4. Select OLLAMA tab â€” no key needed, just pick model and chat.
  //
  //  CORS NOTE: If running this HTML from a local file (file://), the
  //  browser may block localhost fetch. Serve via:
  //    python -m http.server 8080
  //  Then open http://localhost:8080 instead of the file directly.
  //  Or start Ollama with: OLLAMA_ORIGINS=* ollama serve
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  ollama: {
    name: 'Ollama (Local)',
    endpoint: 'http://localhost:11434/v1/chat/completions',
    placeholder: 'no key needed â€” local model',
    hint: 'Install: <a href="https://ollama.com/download" target="_blank">ollama.com/download</a> Â· then: <code>ollama pull llama3.2</code>',
    badge: 'ollama',
    noKeyRequired: true,   // flag: skip API key check for this provider
    models: [
      {value:'llama3.2',         label:'Llama 3.2 (3B) â€” recommended'},
      {value:'llama3.1',         label:'Llama 3.1 (8B)'},
      {value:'llama3.2:1b',      label:'Llama 3.2 (1B) â€” fastest'},
      {value:'mistral',          label:'Mistral 7B'},
      {value:'gemma2:2b',        label:'Gemma 2 (2B)'},
      {value:'phi3',             label:'Phi-3 Mini'},
      {value:'deepseek-r1:7b',   label:'DeepSeek R1 (7B)'},
    ]
  }
};
let currentProvider = 'groq';
// Store keys per-provider â€” Ollama needs no key
const apiKeys = {groq:'', doubao:'', gemini:'', deepseek:'', ollama:''};

// System prompt now built dynamically by buildSystemPrompt()

let chatHistory = []; // {role, content}
let inputMode = 'text'; // 'text' | 'voice'
let ttsEnabled = true;
let isRecording = false;
let currentUtterance = null;
let recognition = null;
let dialogOpen = true;

