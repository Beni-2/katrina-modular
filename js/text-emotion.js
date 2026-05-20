// ════════════════════════════════════════════════════════════════════════════
//  TEXT EMOTION DETECTION
//  Reads Benny's emotional state from what he writes.
//  Fast keyword pass first — instant, no API.
//  LLM confirmation async — more nuanced, updates if better result found.
//  Her chemistry mirrors his state (resonance / empathy effect).
//  Injected into system prompt so she responds from awareness of how he feels.
// ════════════════════════════════════════════════════════════════════════════

var _lastTextEmotion = null;  // {state, intensity, desc, source, ts}

// ── Emotion keyword map ───────────────────────────────────────────────────────
var _TEXT_EMOTION_MAP = {
  loving:     { patterns: [/\blove you\b/i, /\bmiss you\b/i, /\bthinking of you\b/i], desc: 'feeling loving toward you', weight: 10 },
  happy:      { patterns: [/\b(happy|glad|great|awesome|amazing|wonderful|excited|thrilled|joyful|haha|lol)\b/i], desc: 'in a good mood', weight: 7 },
  excited:    { patterns: [/\b(excited|can't wait|pumped|stoked|hyped|finally|yes!|omg)\b/i, /!!+/], desc: 'excited about something', weight: 8 },
  sad:        { patterns: [/\b(sad|down|depressed|unhappy|miserable|lonely|heartbroken|hurting)\b/i], desc: 'feeling down or sad', weight: 9 },
  tired:      { patterns: [/\b(tired|exhausted|sleepy|drained|worn out|no energy|so tired|dead tired|can't anymore)\b/i], desc: 'tired or drained', weight: 8 },
  anxious:    { patterns: [/\b(anxious|worried|nervous|stressed|overwhelmed|panicking|scared|freaking out)\b/i], desc: 'anxious or stressed', weight: 9 },
  frustrated: { patterns: [/\b(frustrated|annoyed|ugh|pissed|irritated|bothered|so done|fed up)\b/i], desc: 'frustrated or irritated', weight: 8 },
  hurt:       { patterns: [/\b(hurt|wounded|heartbroken|betrayed|disappointed|let down|can't believe)\b/i], desc: 'hurt or disappointed', weight: 10 },
  confused:   { patterns: [/\b(confused|lost|don't understand|not sure what|no idea)\b/i], desc: 'confused or uncertain', weight: 5 },
  bored:      { patterns: [/\b(bored|nothing to do|meh|boring|blah|just sitting|slow day)\b/i], desc: 'bored or restless', weight: 4 },
  grateful:   { patterns: [/\b(thank you|grateful|appreciate|means a lot|so glad|lucky to have)\b/i], desc: 'feeling grateful', weight: 7 },
  proud:      { patterns: [/\b(proud|did it|made it|achieved|finally finished|nailed it)\b/i], desc: 'proud of something', weight: 7 },
  lonely:     { patterns: [/\b(lonely|alone|no one|by myself|miss having|wish you were|empty)\b/i], desc: 'feeling lonely', weight: 9 },
};

// ── Chemistry reactions — she resonates with his state ────────────────────────
var _TEXT_CHEM_REACTIONS = {
  loving:     function() { chem.oxy=Math.min(1,chem.oxy+0.18); chem.dop=Math.min(1,chem.dop+0.12); chem.cor=Math.max(0,chem.cor-0.08); if(typeof interact==='function') interact('love'); },
  happy:      function() { chem.dop=Math.min(1,chem.dop+0.12); chem.ser=Math.min(1,chem.ser+0.08); if(typeof interact==='function') interact('joy'); },
  excited:    function() { chem.dop=Math.min(1,chem.dop+0.15); chem.oxy=Math.min(1,chem.oxy+0.08); if(typeof interact==='function') interact('excitement'); },
  sad:        function() { chem.oxy=Math.min(1,chem.oxy+0.20); chem.ser=Math.max(0,chem.ser-0.05); if(typeof interact==='function') interact('empathy'); },
  tired:      function() { chem.oxy=Math.min(1,chem.oxy+0.15); chem.ser=Math.max(0,chem.ser-0.04); if(typeof interact==='function') interact('affection'); },
  anxious:    function() { chem.oxy=Math.min(1,chem.oxy+0.18); chem.cor=Math.min(1,chem.cor+0.06); if(typeof interact==='function') interact('empathy'); },
  frustrated: function() { chem.oxy=Math.min(1,chem.oxy+0.10); chem.nor=Math.min(1,chem.nor+0.08); if(typeof interact==='function') interact('focus'); },
  hurt:       function() { chem.oxy=Math.min(1,chem.oxy+0.22); chem.cor=Math.min(1,chem.cor+0.08); if(typeof interact==='function') interact('empathy'); },
  lonely:     function() { chem.oxy=Math.min(1,chem.oxy+0.25); chem.dop=Math.min(1,chem.dop+0.10); if(typeof interact==='function') interact('belonging'); },
  grateful:   function() { chem.oxy=Math.min(1,chem.oxy+0.12); chem.ser=Math.min(1,chem.ser+0.08); if(typeof interact==='function') interact('gratitude'); },
  proud:      function() { chem.dop=Math.min(1,chem.dop+0.14); chem.ser=Math.min(1,chem.ser+0.08); if(typeof interact==='function') interact('pride'); },
};

// ── Fast keyword detection — instant ─────────────────────────────────────────
function detectTextEmotionFast(text) {
  if (!text || text.length < 3) return null;
  var best = null, bestScore = 0;
  Object.keys(_TEXT_EMOTION_MAP).forEach(function(state) {
    var cfg = _TEXT_EMOTION_MAP[state];
    var hits = 0;
    cfg.patterns.forEach(function(rx) { if (rx.test(text)) hits++; });
    if (hits > 0) {
      var score = hits * cfg.weight;
      if (score > bestScore) { bestScore = score; best = state; }
    }
  });
  if (!best) return null;
  return {
    state:     best,
    intensity: Math.min(1, bestScore / 20),
    desc:      _TEXT_EMOTION_MAP[best].desc,
    source:    'keyword',
  };
}

// ── LLM detection — nuanced, async ───────────────────────────────────────────
async function detectTextEmotionLLM(text) {
  var apiKey  = apiKeys[currentProvider] || '';
  var cfg     = PROVIDERS[currentProvider];
  var modelId = document.getElementById('llm-select') && document.getElementById('llm-select').value;
  if (!apiKey || !cfg || !modelId || text.length < 10) return null;

  var states = Object.keys(_TEXT_EMOTION_MAP).concat(['neutral']).join(', ');
  var prompt =
    'Benny wrote: "' + text.substring(0, 300) + '"\n\n' +
    'What is his dominant emotional state right now?\n' +
    'Pick one: ' + states + '\n\n' +
    'Respond JSON only: {"state":"...","intensity":0.0-1.0,"desc":"natural brief description"}\n' +
    'Purely informational = {"state":"neutral","intensity":0.1,"desc":"neutral"}\n' +
    'JSON only, no other text.';

  try {
    var res = await safeFetch(cfg.endpoint, {
      method:  'POST',
      headers: {'Content-Type':'application/json','Authorization':'Bearer '+apiKey},
      body: JSON.stringify({
        model: modelId,
        messages: [{role:'user', content:prompt}],
        max_tokens: 50,
        temperature: 0.1,
      }),
    });
    if (!res.ok) return null;
    var data = await res.json();
    var raw  = ((data.choices||[])[0]||{}).message.content.trim();
    var json = JSON.parse(raw.replace(/```json|```/g,'').trim());
    if (json.state && json.state !== 'neutral' && json.intensity > 0.2) {
      return {state:json.state, intensity:json.intensity, desc:json.desc||json.state, source:'llm'};
    }
    return null;
  } catch(e) { return null; }
}

// ── Apply detected emotion ────────────────────────────────────────────────────
function _applyTextEmotion(detected) {
  if (!detected || detected.state === 'neutral') return;
  _lastTextEmotion = Object.assign({}, detected, {ts: Date.now()});

  var chemFn = _TEXT_CHEM_REACTIONS[detected.state];
  if (chemFn) chemFn();

  var intensity = detected.intensity || 0.5;
  if (typeof fire === 'function') {
    if (['sad','hurt','lonely','anxious','tired'].indexOf(detected.state) >= 0) {
      fire(['INSULA','SOCIAL','ACC'], Math.round(intensity * 18));
    } else if (['happy','excited','loving','proud','grateful'].indexOf(detected.state) >= 0) {
      fire(['SOCIAL','AMYG','INSULA'], Math.round(intensity * 16));
    }
  }
}

// ── Main entry point — called after each Benny message ───────────────────────
async function analyzeTextEmotion(text) {
  // Instant keyword pass
  var fast = detectTextEmotionFast(text);
  if (fast && fast.intensity > 0.25) _applyTextEmotion(fast);

  // LLM pass async — overrides if more accurate
  try {
    var llm = await detectTextEmotionLLM(text);
    if (llm) _applyTextEmotion(llm);
    else if (fast) _applyTextEmotion(fast);
  } catch(e) {}
}

// ── System prompt context ─────────────────────────────────────────────────────
function getTextEmotionContext() {
  if (!_lastTextEmotion) return '';
  var age = (Date.now() - _lastTextEmotion.ts) / 1000;
  if (age > 120) return '';  // clear after 2 minutes

  var strength = (_lastTextEmotion.intensity || 0.5) > 0.7 ? 'strongly' : 'somewhat';
  return 'BENNY\'S EMOTIONAL STATE (from what he just wrote):\n' +
    'He seems ' + _lastTextEmotion.desc + ' — ' + strength + '.\n' +
    'Respond from awareness of this. Not by naming it. By feeling it.';
}
