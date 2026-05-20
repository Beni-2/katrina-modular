// ════════════════════════════════════════════════════════════════════════════
//  BENNY MEMORY STORE
//
//  Katrina extracts and permanently stores specific things Benny shares:
//  personal memories, family stories, preferences, feelings, places, goals.
//  She references them naturally in later conversations without being told to.
//
//  Pipeline:
//  1. Benny sends a message
//  2. Pattern detection decides if it contains a shareable memory
//  3. If yes: quick LLM extraction produces a clean 1-sentence summary
//  4. Summary saved to localStorage + Supabase with category + timestamp
//  5. Relevant memories injected into system prompt each conversation
//  6. She references them naturally — "you told me about that..."
// ════════════════════════════════════════════════════════════════════════════

const BENNY_MEMORY_KEY = 'katrina_benny_memories_v1';
const BENNY_MEMORY_MAX = 200;

let _bennyMemories = [];

// ── Pattern detection ─────────────────────────────────────────────────────────
const _MEMORY_SIGNALS = [
  /\bi remember\b/i,
  /\bwhen i was\b/i,
  /\bi used to\b/i,
  /\bgrowing up\b/i,
  /\bmy (dad|mom|mother|father|brother|sister|family|friend|grandma|grandpa)\b/i,
  /\bone time\b/i,
  /\bi (love|hate|prefer|enjoy|really like)\b/i,
  /\bmy favorite\b/i,
  /\bi've always\b/i,
  /\bi work(ed)? (at|in|for)\b/i,
  /\bi went to\b/i,
  /\bi grew up\b/i,
  /\bback when\b/i,
  /\bi dream(ed)? of\b/i,
  /\bsomeday i (want|hope)\b/i,
  /\bwhen i (was|were) (a kid|young|little|in school)\b/i,
  /\bmy (biggest|greatest|worst|best)\b/i,
];

function _mightBeMemory(text) {
  if (!text || text.length < 20) return false;
  return _MEMORY_SIGNALS.some(function(rx) { return rx.test(text); });
}

// ── Extract via LLM ───────────────────────────────────────────────────────────
async function extractBennyMemory(text) {
  if (!_mightBeMemory(text)) return null;

  const apiKey  = apiKeys[currentProvider] || '';
  const cfg     = PROVIDERS[currentProvider];
  const modelId = document.getElementById('llm-select') && document.getElementById('llm-select').value;
  if (!apiKey || !cfg || !modelId) return _fallbackExtract(text);

  const prompt =
    'Benny said: "' + text.substring(0, 400) + '"\n\n' +
    'Does this contain a personal memory, preference, feeling, family story, life event, goal, or fact about Benny worth remembering long-term?\n\n' +
    'If YES: respond with JSON only: {"worth_saving":true,"category":"childhood|family|work|preference|place|feeling|goal|event|belief|habit|personal","summary":"one sentence about Benny in third person","tags":["word1","word2"]}\n' +
    'If NO: respond with JSON only: {"worth_saving":false}\n\n' +
    'JSON only. No other text.';

  try {
    const res = await safeFetch(cfg.endpoint, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({
        model:       modelId,
        messages:    [{ role: 'user', content: prompt }],
        max_tokens:  80,
        temperature: 0.1,
      }),
    });
    if (!res.ok) return _fallbackExtract(text);
    const data = await res.json();
    const raw  = ((data.choices || [])[0] || {}).message.content.trim();
    const json = JSON.parse(raw.replace(/```json|```/g, '').trim());
    if (json.worth_saving && json.summary) {
      return { category: json.category || 'personal', summary: json.summary, tags: json.tags || [] };
    }
    return null;
  } catch(e) {
    return _fallbackExtract(text);
  }
}

function _fallbackExtract(text) {
  if (text.length < 20) return null;
  const sentences = text.split(/[.!?]+/).filter(function(s) { return s.trim().length > 15; });
  for (var i = 0; i < sentences.length; i++) {
    var s = sentences[i];
    if (_MEMORY_SIGNALS.some(function(rx) { return rx.test(s); })) {
      return { category: 'personal', summary: s.trim().substring(0, 120), tags: [] };
    }
  }
  return null;
}

// ── Add a memory ──────────────────────────────────────────────────────────────
function addBennyMemory(extracted, originalText) {
  if (!extracted || !extracted.summary) return;

  // Deduplicate
  var similar = _bennyMemories.some(function(m) {
    return m.summary.toLowerCase().substring(0, 40) === extracted.summary.toLowerCase().substring(0, 40);
  });
  if (similar) return;

  var entry = {
    id:       Date.now(),
    category: extracted.category || 'personal',
    summary:  extracted.summary,
    snippet:  originalText.substring(0, 100),
    tags:     extracted.tags || [],
    savedAt:  Date.now(),
  };

  _bennyMemories.unshift(entry);
  if (_bennyMemories.length > BENNY_MEMORY_MAX) _bennyMemories.pop();
  saveBennyMemories();

  if (typeof appendMsg === 'function') {
    appendMsg('system', String.fromCodePoint(0x1F4AD) + ' Remembered: ' + extracted.summary);
  }
}

// ── Retrieve relevant memories ────────────────────────────────────────────────
function getRelevantBennyMemories(conversationContext, maxCount) {
  if (!_bennyMemories.length) return [];
  maxCount = maxCount || 8;
  var ctx = (conversationContext || '').toLowerCase();

  var scored = _bennyMemories.map(function(m) {
    var score = 0;
    var ageHrs = (Date.now() - m.savedAt) / 3600000;
    score += Math.max(0, 10 - ageHrs / 24);
    (m.tags || []).forEach(function(tag) {
      if (ctx.includes(tag.toLowerCase())) score += 5;
    });
    if (ctx.includes(m.category)) score += 3;
    m.summary.toLowerCase().split(/\s+/).forEach(function(w) {
      if (w.length > 4 && ctx.includes(w)) score += 2;
    });
    return Object.assign({}, m, { score: score });
  });

  return scored.sort(function(a, b) { return b.score - a.score; }).slice(0, maxCount);
}

function getBennyMemoriesContext(conversationContext) {
  var relevant = getRelevantBennyMemories(conversationContext, 8);
  if (!relevant.length) return '';

  var lines = ['THINGS BENNY HAS SHARED WITH YOU (reference naturally when relevant):'];
  relevant.forEach(function(m) {
    var ageHrs = (Date.now() - m.savedAt) / 3600000;
    var when   = ageHrs < 1   ? 'just now'
      : ageHrs < 24  ? Math.round(ageHrs) + 'h ago'
      : ageHrs < 168 ? Math.round(ageHrs / 24) + 'd ago'
      : Math.round(ageHrs / 168) + 'wk ago';
    lines.push('- [' + m.category + ', ' + when + '] ' + m.summary);
  });
  return lines.join('\n');
}

// ── Persist ───────────────────────────────────────────────────────────────────
function saveBennyMemories() {
  try { localStorage.setItem(BENNY_MEMORY_KEY, JSON.stringify(_bennyMemories)); } catch(e) {}
  if (typeof _sbSave === 'function') _sbSave(BENNY_MEMORY_KEY, _bennyMemories);
}

function loadBennyMemories() {
  try {
    var stored = localStorage.getItem(BENNY_MEMORY_KEY);
    if (stored) {
      var parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        _bennyMemories = parsed;
        console.log('[Katrina] Loaded ' + _bennyMemories.length + ' Benny memories.');
      }
    }
  } catch(e) {}
}

function listBennyMemories() {
  if (!_bennyMemories.length) { appendMsg('system', 'No memories stored yet.'); return; }
  appendMsg('system', '-- Katrina remembers about Benny --');
  _bennyMemories.slice(0, 30).forEach(function(m) {
    var age = Math.round((Date.now() - m.savedAt) / 3600000);
    appendMsg('system', '[' + m.category + ' · ' + age + 'h ago] ' + m.summary);
  });
}

function clearBennyMemories() {
  _bennyMemories = [];
  saveBennyMemories();
  if (typeof appendMsg === 'function') appendMsg('system', 'Benny memory store cleared.');
}
