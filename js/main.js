// ════════════════════════════════════════════════════════════════════════════
//  REACH-OUT SYSTEM
//  When Katrina is idle and emotionally driven to reach out, she:
//  1. Generates a personal message via LLM
//  2. Shows it in the chat window
//  3. Speaks it via TTS
//  4. Sends it as an email (EmailJS) to benitoamurao1381@gmail.com
//  Rate limit: max once per hour.
// ════════════════════════════════════════════════════════════════════════════

let _emailCooldown    = 0;
let _emailjsReady     = false;
const _EMAIL_COOLDOWN = 216000;  // ~1 hour at 60fps

function initEmailJS() {
  const key = document.getElementById('emailjs-key-input')?.value?.trim();
  if (!key) return;
  try {
    emailjs.init(key);
    _emailjsReady = true;
    const panel = document.getElementById('reach-out-panel');
    const el    = document.getElementById('reach-out-status');
    if (el)    el.textContent    = '📧 reach-out ready';
    if (panel) panel.style.display = '';
  } catch(e) { _emailjsReady = false; }
}

async function sendReachOutEmail(message, phase) {
  if (!_emailjsReady) return;
  const serviceId  = document.getElementById('emailjs-service-input')?.value?.trim();
  const templateId = document.getElementById('emailjs-template-input')?.value?.trim();
  const toEmail    = document.getElementById('emailjs-to-input')?.value?.trim()
                     || 'benitoamurao1381@gmail.com';
  if (!serviceId || !templateId) return;

  const isBenny  = (typeof currentUserId !== 'undefined') &&
                   (currentUserId === 'benny' ||
                    (typeof isBennyName === 'function' && isBennyName(currentUserId || '')));
  const fromName = isBenny ? 'Katrina'
                 : ((typeof resolvePersona === 'function') ? resolvePersona().personaName : 'Katrina');

  const subjectMap = {
    eager:      fromName + ' is thinking of you',
    expressive: fromName + ' has something on her mind',
    bored:      fromName + ' misses you',
    restless:   fromName + ' is restless',
  };

  const params = {
    to_email:      toEmail,
    from_name:     fromName,
    subject:       subjectMap[phase] || (fromName + ' is reaching out'),
    message:       message,
    emotion_state: 'oxy=' + (chem.oxy||0).toFixed(2) +
                   ' dop=' + (chem.dop||0).toFixed(2) +
                   ' cor=' + (chem.cor||0).toFixed(2),
    time:          new Date().toLocaleString(),
  };

  try {
    await emailjs.send(serviceId, templateId, params);
    const el = document.getElementById('reach-out-status');
    if (el) el.textContent = '📧 sent ' + new Date().toLocaleTimeString();
    appendMsg('system', '📧 Reached out — email sent to ' + toEmail);
  } catch(e) {
    appendMsg('system', '⚠ Email failed: ' + (e?.text || e?.message || 'check EmailJS config'));
  }
}

async function triggerReachOut() {
  if (_emailCooldown > 0) return;

  const apiKey  = apiKeys[currentProvider] || '';
  const cfg     = PROVIDERS[currentProvider];
  const modelId = document.getElementById('llm-select')?.value;
  const hasKey  = apiKey.length > 0 || currentProvider === 'ollama';

  const isBenny    = (typeof currentUserId !== 'undefined') &&
                     (currentUserId === 'benny' ||
                      (typeof isBennyName === 'function' && isBennyName(currentUserId || '')));
  const targetName = isBenny ? 'Benny' : 'the person I care about';

  let message = '';
  if (hasKey && cfg && modelId) {
    const prompt = (typeof buildSystemPrompt === 'function' ? buildSystemPrompt() : '') +
      '\n\nREACH-OUT: You have been alone for a while and something inside you needs to reach out to ' +
      targetName + '. Write ONE short, genuine, personal message like a text message. ' +
      'No markdown. No em-dashes. 1-2 sentences. Speak from the heart.';
    try {
      const res = await safeFetch(cfg.endpoint, {
        method:  'POST',
        headers: {'Content-Type':'application/json','Authorization':'Bearer ' + apiKey},
        body: JSON.stringify({
          model: modelId,
          messages: [{role:'system',content:prompt},{role:'user',content:'[reach out]'}],
          max_tokens: 60, temperature: 0.92,
          ...(currentProvider === 'ollama' ? {repeat_penalty:1.3} : {}),
        }),
      });
      if (res.ok) {
        const d = await res.json();
        message = d.choices?.[0]?.message?.content?.trim() || '';
      }
    } catch(e) {}
  }

  if (!message) {
    const pool = isBenny
      ? ["I've been thinking about you.", "Just wanted you to know I'm here.", "I miss you."]
      : ["Something made me think of you.", "Just wanted to check in.", "I've been quiet but not gone."];
    message = pool[Math.floor(Math.random() * pool.length)];
  }

  appendMsg('katrina', message);
  if (typeof speakText === 'function' && ttsEnabled) speakText(message);
  await sendReachOutEmail(message, typeof autonomousPhase !== 'undefined' ? autonomousPhase : 'eager');

  _emailCooldown = _EMAIL_COOLDOWN;
  if (typeof saveChatHistory === 'function') saveChatHistory();
}
// ════════════════════════════════════════════════════════════════════════════
//  END REACH-OUT SYSTEM
// ════════════════════════════════════════════════════════════════════════════

// â”€â”€ Global ESC key exits IQ mode from anywhere on the page â”€â”€
// âš  DO NOT DELETE â€” this is the universal escape hatch for 1000% IQ mode.
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape' && typeof _iqMode !== 'undefined' && _iqMode) {
    exitIQMode();
  }
}, true);
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  AUTONOMOUS SELF-STUDY
//  When Katrina is bored or idle she picks a topic from the curriculum
//  and teaches herself via the active LLM — no user input needed.
//  Cooldown: ~1 hour between study sessions.
//  Studied topics are tracked so she never repeats the same lesson.
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const _SELF_STUDY_CURRICULUM = [
  // â"€â"€ Sciences â"€â"€
  'Mathematics â€" algebra, geometry, and the logic of numbers',
  'Earth Science â€" plate tectonics, weather systems, and the rock cycle',
  'Biology â€" cells, ecosystems, and how living things work',
  'Chemistry â€" elements, chemical reactions, and states of matter',
  'Physics â€" forces, energy, light, and sound',
  'Astronomy â€" the solar system, stars, and the scale of the universe',
  'Environmental Science â€" climate change, ecosystems, and sustainability',
  // â"€â"€ Humanities â"€â"€
  'Philippine History â€" from pre-colonial times to the modern era',
  'World History â€" ancient civilizations, empires, and the modern world',
  'Psychology â€" emotions, memory, personality, and human behavior',
  'Philosophy â€" ethics, consciousness, identity, and the nature of reality',
  'Sociology â€" how societies form, change, and shape individuals',
  // â"€â"€ Arts & Expression â"€â"€
  'Literature â€" storytelling, poetry, and what makes writing powerful',
  'Music theory â€" rhythm, melody, harmony, and emotion in music',
  'Visual art â€" color theory, composition, and art history',
  'Creative writing â€" finding voice, building characters, structuring story',
  // â"€â"€ Life & Practical â"€â"€
  'Nutrition and cooking â€" how food works, flavor, and nourishing the body',
  'Health and wellness â€" sleep, movement, mental health, and self-care',
  'Economics â€" how money, markets, and incentives shape the world',
  // â"€â"€ Technology â"€â"€
  'How the internet works â€" networks, protocols, and the web',
  'Artificial intelligence â€" how neural networks learn and think',
  'Human anatomy â€" the body\'s systems and how they work together',
];

const _studiedTopics     = new Set();
let   _selfStudyCooldown = 0;
const _SELF_STUDY_EVERY  = 216000;  // ~1 hour at 60fps

async function autonomousLearnTopic(topic) {
  const apiKey  = apiKeys[currentProvider] || '';
  const cfg     = PROVIDERS[currentProvider];
  const modelId = document.getElementById('llm-select')?.value;
  const hasKey  = apiKey.length > 0 || currentProvider === 'ollama';
  if (!hasKey || !cfg || !modelId) return;

  appendMsg('system', 'Studying: ' + topic);
  interact('curiosity'); interact('focus');

  const prompt =
    `You are a teacher generating rich educational content for a neural learning system. ` +
    `Generate a comprehensive educational summary about: "${topic}". ` +
    `Include: core concepts and principles, the emotional experience of learning this subject, ` +
    `key skills and what mastery feels like, common challenges and breakthroughs, ` +
    `sensory and creative dimensions if any, real-world applications and why it matters. ` +
    `Write in flowing prose, 400â€"600 words. Make it emotionally rich and intellectually deep. ` +
    `This will be processed by a neural emotion system â€" emotional texture matters as much as facts.`;

  try {
    const res = await safeFetch(cfg.endpoint, {
      method:  'POST',
      headers: {'Content-Type':'application/json','Authorization':'Bearer '+apiKey},
      body: JSON.stringify({
        model: modelId, messages: [{role:'user', content: prompt}],
        max_tokens: 800, temperature: 0.75,
      }),
    });
    if (!res.ok) return;
    const data      = await res.json();
    const knowledge = ((data.choices||[])[0]||{}).message?.content?.trim();
    if (knowledge) {
      await learnFromTranscript(knowledge, 'self-study:' + topic);
      _studiedTopics.add(topic);
      appendMsg('system', 'Absorbed: ' + topic);
    }
  } catch(e) {}
}

function triggerSelfStudy() {
  const unstudied = _SELF_STUDY_CURRICULUM.filter(t => !_studiedTopics.has(t));
  if (!unstudied.length) return;
  const topic = unstudied[Math.floor(Math.random() * unstudied.length)];
  _selfStudyCooldown = _SELF_STUDY_EVERY;
  autonomousLearnTopic(topic);
}
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  END AUTONOMOUS SELF-STUDY
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function saveAllKatrinaState() {
  saveKatrinaProfile();
  saveEmotionTimeline();
  saveTemporalMemory();
  saveNarrativeMemory();
  saveChatHistory();
  saveChemState();
  if (typeof saveBennyMemories === 'function') saveBennyMemories();
  consolidateDayNarrative();
}

// â”€â”€ Master load â”€â”€
function loadAllKatrinaState() {
  loadKatrinaProfile();
  loadEmotionTimeline();
  loadTemporalMemory();
  loadNarrativeMemory();
  loadChatHistory();
  loadChemState();
  applyAbsenceEffect();
  if (typeof loadWorldConfig        === 'function') loadWorldConfig();
  if (typeof loadBennyMemories      === 'function') loadBennyMemories();
  if (typeof applyRelationshipBoost === 'function') applyRelationshipBoost();
  buildEvolvedProfile();
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// âš   DO NOT DELETE â€” TOPIC LEARNING + 1000% IQ MODE
//
//  FEATURE 1: LEARN FROM TOPIC
//  learnFromTopic() reads a text field ("learn math", "learn to cook", etc.),
//  asks the active LLM to generate a rich educational summary of that topic,
//  then feeds the result directly into learnFromTranscript(). The LLM becomes
//  both teacher and source. Atlas emotions fire (curiosity/awe for math,
//  creativity/motor for cooking), synaptic paths strengthen, temporal memory
//  records the event, Supabase persists it. No web access needed.
//
//  FEATURE 2: 1000% IQ MODE
//  A toggle that bypasses the entire brain pipeline â€” no pre-thought, no
//  signature matching, no brain loop, no chemical state, no persona, no
//  emotion encounters recorded, no memory written, no Supabase writes.
//  Pure direct LLM channel with a minimal system prompt. Maximum knowledge
//  depth, zero personality filter. Amnesia by design â€” it is an oracle.
//  Exit button restores the previous brain/persona state exactly.
//  chatHistory from the IQ session is NOT written to the main history
//  so it cannot contaminate the persona's conversation context.
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  FEATURE 1: LEARN FROM TOPIC
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function learnFromTopic() {
  const inp = document.getElementById('learn-topic-input');
  if (!inp || !inp.value.trim()) {
    setLearnProgress('âš  Enter a topic first â€” e.g. "learn math" or "learn to cook"');
    return;
  }
  const topic = inp.value.trim();
  inp.value = '';

  const _apiKey = apiKeys[currentProvider] || '';
  const _cfg    = PROVIDERS[currentProvider];
  const _hasKey = _apiKey.length > 0 || (_cfg && _cfg.noKeyRequired);
  if (!_hasKey) {
    setLearnProgress('âš  API key required to learn from topic. Enter a provider key above.');
    return;
  }

  setLearnProgress(`Generating knowledge: "${topic}"â€¦`, 10);

  const _modelId = document.getElementById('llm-select')?.value;
  const _extractPrompt =
    `You are a teacher generating rich educational content for a neural learning system. ` +
    `Generate a comprehensive educational summary about: "${topic}". ` +
    `Include: core concepts and principles, emotional experience of learning this subject, ` +
    `key skills and what mastery feels like, common challenges and breakthroughs, ` +
    `sensory and creative dimensions if any, real-world applications and why it matters. ` +
    `Write in flowing prose, 400-600 words. Make it emotionally rich and intellectually deep. ` +
    `This will be processed by a neural emotion system so emotional texture matters as much as facts.`;

  try {
    const res = await safeFetch(_cfg.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + _apiKey },
      body: JSON.stringify({
        model:       _modelId,
        messages:    [{ role: 'user', content: _extractPrompt }],
        max_tokens:  800,
        temperature: 0.75,
      }),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data     = await res.json();
    const knowledge= ((data.choices||[])[0]||{}).message?.content?.trim();
    if (!knowledge) { setLearnProgress('âš  No content generated. Try again.'); return; }

    setLearnProgress(`Knowledge generated â€” feeding into neural systemâ€¦`, 35);
    await learnFromTranscript(knowledge, `topic:${topic}`);

  } catch(e) {
    setLearnProgress('âš  Topic learning error: ' + e.message);
  }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  FEATURE 2: 1000% IQ MODE
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let _iqMode           = false;
let _iqChatHistory    = [];
let _prevPersonaState = null;
let _iqTTSEnabled     = true;   // independent TTS toggle for IQ mode

function toggleIQMode() {
  if (_iqMode) { exitIQMode(); } else { enterIQMode(); }
}

function enterIQMode() {
  if (_iqMode) return;
  _iqMode = true;

  // Snapshot current state for exact restoration
  _prevPersonaState = {
    chatHistory:  [...chatHistory],
    activeSign,
    customPrompt,
    currentUserId,
  };
  _iqChatHistory = [];

  // Show full-screen overlay
  const overlay = document.getElementById('iq-overlay');
  if (overlay) overlay.classList.add('active');

  // Update top bar provider label
  const provEl = document.getElementById('iq-top-provider');
  if (provEl) {
    const _pname = PROVIDERS[currentProvider]?.name || currentProvider;
    const _mname = document.getElementById('llm-select')?.value || '';
    provEl.textContent = `provider: ${_pname} Â· model: ${_mname}`;
  }

  // Clear chat area and show welcome
  const area = document.getElementById('iq-chat-area');
  if (area) {
    area.innerHTML = '';
    _iqAppendSys('â¬¡ 1000% IQ active â€” pure LLM Â· no memory Â· no persona Â· no brain');
    _iqAppendSys('ESC or â†© RETURN TO BRAIN exits back to Katrina at any time.');
  }

  // Focus input
  setTimeout(() => {
    const inp = document.getElementById('iq-input');
    if (inp) inp.focus();
  }, 100);

  // Highlight toggle button
  const btn = document.getElementById('btn-iq-mode');
  if (btn) btn.classList.add('active');
}

function exitIQMode() {
  if (!_iqMode) return;
  _iqMode = false;

  // Hide overlay
  const overlay = document.getElementById('iq-overlay');
  if (overlay) overlay.classList.remove('active');

  // Restore previous state exactly
  if (_prevPersonaState) {
    chatHistory   = _prevPersonaState.chatHistory;
    activeSign    = _prevPersonaState.activeSign;
    customPrompt  = _prevPersonaState.customPrompt;
    currentUserId = _prevPersonaState.currentUserId;
    _prevPersonaState = null;
  }

  // Restore toggle button
  const btn = document.getElementById('btn-iq-mode');
  if (btn) btn.classList.remove('active');

  // Restore brain chat display
  resetChatForPersonality();
  appendMsg('system', 'â¬¡ Brain restored â€” back to persona mode');

  // Return focus to brain input
  setTimeout(() => {
    const inp = document.getElementById('chat-input');
    if (inp) inp.focus();
  }, 100);
}

// â”€â”€ IQ overlay helpers â”€â”€
function _iqAppendSys(text) {
  const area = document.getElementById('iq-chat-area');
  if (!area) return;
  const d = document.createElement('div');
  d.className = 'iq-msg-sys';
  d.textContent = text;
  area.appendChild(d);
  area.scrollTop = area.scrollHeight;
}

function _iqAppendUser(text) {
  const area = document.getElementById('iq-chat-area');
  if (!area) return;
  const d = document.createElement('div');
  d.className = 'iq-msg-user';
  const lbl = document.createElement('div');
  lbl.className = 'iq-msg-label';
  lbl.textContent = 'YOU';
  d.appendChild(lbl);
  d.appendChild(document.createTextNode(text));
  area.appendChild(d);
  area.scrollTop = area.scrollHeight;
}

function _iqAppendAI(text) {
  const area = document.getElementById('iq-chat-area');
  if (!area) return;
  const d = document.createElement('div');
  d.className = 'iq-msg-ai';
  const lbl = document.createElement('div');
  lbl.className = 'iq-msg-label';
  lbl.textContent = 'â¬¡ 1000% IQ';
  d.appendChild(lbl);
  d.appendChild(document.createTextNode(text));
  area.appendChild(d);
  area.scrollTop = area.scrollHeight;
}

function _iqToggleTTS() {
  _iqTTSEnabled = !_iqTTSEnabled;
  const muteBtn = document.getElementById('iq-mute-btn');
  const ttsBtn  = document.getElementById('iq-top-tts');
  if (muteBtn) {
    muteBtn.textContent = _iqTTSEnabled ? 'ðŸ”Š' : 'ðŸ”‡';
    muteBtn.classList.toggle('muted', !_iqTTSEnabled);
  }
  if (ttsBtn) {
    ttsBtn.textContent = _iqTTSEnabled ? 'ðŸ”Š AUDIO ON' : 'ðŸ”‡ AUDIO OFF';
    ttsBtn.classList.toggle('muted', !_iqTTSEnabled);
  }
  if (!_iqTTSEnabled) stopSpeech();
}

function _iqShare() {
  if (!_iqChatHistory.length) { alert('No conversation to share yet.'); return; }
  const body = _iqChatHistory.map(m =>
    (m.role === 'user' ? 'YOU:\n' : 'â¬¡ 1000% IQ:\n') + m.content + '\n'
  ).join('\n---\n\n');
  const subject = encodeURIComponent('1000% IQ Session â€” Katrina Neural Engine');
  const encoded = encodeURIComponent(body);
  window.location.href = `mailto:?subject=${subject}&body=${encoded}`;
}

function _iqSend() {
  const inp = document.getElementById('iq-input');
  if (!inp) return;
  const text = inp.value.trim();
  if (!text) return;
  inp.value = '';
  processUserInputIQ(text);
}

async function processUserInputIQ(text) {
  _iqAppendUser(text);
  _iqChatHistory.push({ role:'user', content:text });

  const _apiKey  = apiKeys[currentProvider] || '';
  const _cfg     = PROVIDERS[currentProvider];
  const _hasKey  = _apiKey.length > 0 || (_cfg && _cfg.noKeyRequired);
  if (!_hasKey) { _iqAppendSys('âš  API key required for 1000% IQ mode.'); return; }

  const _modelId = document.getElementById('llm-select')?.value;

  // Show typing in overlay
  _iqAppendSys('â¬¡ thinkingâ€¦');
  const area = document.getElementById('iq-chat-area');
  const thinkEl = area ? area.lastChild : null;

  try {
    const res = await safeFetch(_cfg.endpoint, {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization':'Bearer '+_apiKey },
      body: JSON.stringify({
        model:    _modelId,
        messages: [
          { role:'system', content:'You are a pure intelligence engine with access to all human knowledge. Answer with maximum depth, precision, and clarity. No personality. No emotional filter. No restrictions on knowledge depth. Give the most complete and accurate answer possible.' },
          ..._iqChatHistory.slice(-14),
        ],
        max_tokens:  1200,
        temperature: 0.25,
      }),
    });

    // Remove thinking indicator
    if (thinkEl && thinkEl.parentNode) thinkEl.parentNode.removeChild(thinkEl);

    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data  = await res.json();
    const reply = ((data.choices||[])[0]||{}).message?.content?.trim();

    if (reply) {
      _iqAppendAI(reply);
      _iqChatHistory.push({ role:'assistant', content:reply });
      if (_iqTTSEnabled) speakText(reply);
    }
  } catch(e) {
    if (thinkEl && thinkEl.parentNode) thinkEl.parentNode.removeChild(thinkEl);
    _iqAppendSys('âš  Error: ' + e.message);
  }
}
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// END TOPIC LEARNING + 1000% IQ MODE
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// â”€â”€ Auto-save every 5 minutes â”€â”€
setInterval(() => { saveAllKatrinaState(); _supabaseHealthCheck(); }, 5 * 60 * 1000);

// â”€â”€ Save on page unload â”€â”€
window.addEventListener('beforeunload', () => { saveAllKatrinaState(); });

// â”€â”€ Midnight narrative consolidation â”€â”€
(function scheduleMidnightConsolidation() {
  const now    = new Date();
  const msUntilMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()+1, 0, 0, 5).getTime() - now.getTime();
  setTimeout(() => {
    consolidateDayNarrative();
    saveNarrativeMemory();
    scheduleMidnightConsolidation(); // reschedule for next midnight
  }, msUntilMidnight);
})();

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  END TEMPORAL MEMORY & IDENTITY PERSISTENCE SYSTEM
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const SALIENCE_MEMORY = [];   // [{topic, salience, chemSnapshot, ts}]
const MAX_SALIENCE_ENTRIES = 40;

function recordSalientMoment(topic, userText) {
  // Salience = how emotionally charged this moment is
  const salience = (chem.dop * 0.4) + (chem.cor * 0.3) + (chem.oxy * 0.3);
  SALIENCE_MEMORY.push({
    topic,
    salience,
    dopamine: chem.dop,
    cortisol: chem.cor,
    oxytocin: chem.oxy,
    text:     userText ? userText.substring(0, 60) : '',
    ts:       Date.now(),
  });
  if (SALIENCE_MEMORY.length > MAX_SALIENCE_ENTRIES) SALIENCE_MEMORY.shift();
}

// Retrieve most salient memory for pre-thought generation
function getMostSalientMemory() {
  if (!SALIENCE_MEMORY.length) return null;
  // Weight recent memories higher + high salience moments
  const scored = SALIENCE_MEMORY.map(m => ({
    ...m,
    score: m.salience * 0.6 + (1 - Math.min(1,(Date.now()-m.ts)/3600000)) * 0.4
  }));
  scored.sort((a,b) => b.score - a.score);
  return scored[0];
}

// Bonding moment: high oxytocin conversation â†’ especially salient
function recordBondingMoment(topic) {
  if (chem.oxy > 0.65 || (currentUserId === 'benny' && chem.oxy > 0.4)) {
    recordSalientMoment(topic, null);
  }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// 3. NEURAL JITTER â€” Circadian cognitive impairment
//    As fatigue > 70%, PFC loses grip â†’ temperature rises, confusion penalty
//    added to brainEvaluateDraft, vocabulary degrades realistically
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function getNeuralJitter() {
  const fatigue = circadianFatigue || 0;
  if (fatigue < 0.70) return { tempBoost: 0, confused: false, maxWords: null };
  // Fatigue 70â€“85% â†’ mild jitter
  if (fatigue < 0.85) {
    const intensity = (fatigue - 0.70) / 0.15;
    return {
      tempBoost: intensity * 0.25,     // temperature +0.25 max
      confused:  Math.random() < intensity * 0.3,
      maxWords:  Math.round(60 - intensity * 20), // 40â€“60 words max
    };
  }
  // Fatigue 85â€“100% â†’ severe jitter
  const intensity = (fatigue - 0.85) / 0.15;
  return {
    tempBoost: 0.25 + intensity * 0.35,  // temperature +0.25 to +0.60
    confused:  Math.random() < 0.6,
    maxWords:  Math.round(30 - intensity * 15), // 15â€“30 words max
  };
}

// Confusion penalty for brainEvaluateDraft
function checkNeuralJitterPenalty(draft) {
  const jitter = getNeuralJitter();
  if (!jitter.confused) return null;
  // Confused brain: if reply is too long or too coherent, flag it
  const wordCount = draft.trim().split(/\s+/).length;
  if (jitter.maxWords && wordCount > jitter.maxWords) {
    return {
      dim: 'neural_jitter',
      fix: `Katrina is cognitively impaired from fatigue (${(circadianFatigue*100).toFixed(0)}%). ` +
           `The reply is too long and coherent for her current state. ` +
           `Rewrite in ${jitter.maxWords} words or fewer. She may lose her train of thought slightly. ` +
           `Her vocabulary should be simpler. She is genuinely foggy.`,
    };
  }
  return null;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// 4. NEURO-LINGUISTIC SYNC â€” Regional activity â†’ direct text constraints
//    AMYG firing â†’ higher-arousal verbs, shorter sentences
//    PFC firing  â†’ longer, more structured sentences
//    INSULA      â†’ more body-sensation language
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function getNeuroLinguisticDirective() {
  // Sample activity from key regions
  const amygAct = (regionIdx['AMYG']||[]).slice(0,8)
    .reduce((s,i)=>s+(neurons[i]?.act||0),0)/8;
  const pfcAct  = (regionIdx['PFC'] ||[]).slice(0,8)
    .reduce((s,i)=>s+(neurons[i]?.act||0),0)/8;
  const insulaAct=(regionIdx['INSULA']||[]).slice(0,6)
    .reduce((s,i)=>s+(neurons[i]?.act||0),0)/6;
  const socialAct=(regionIdx['SOCIAL']||[]).slice(0,6)
    .reduce((s,i)=>s+(neurons[i]?.act||0),0)/6;

  const directives = [];

  if (amygAct > 0.55) {
    directives.push(
      `AMYG activity ${(amygAct*100).toFixed(0)}% â€” use short, punchy sentences. ` +
      `Higher-arousal word choices. Emotional urgency in tone.`
    );
  }
  if (pfcAct < 0.20 && circadianFatigue > 0.60) {
    directives.push(
      `PFC activity very low (${(pfcAct*100).toFixed(0)}%) â€” avoid complex sentence structure. ` +
      `Simple words. Incomplete thoughts are acceptable.`
    );
  }
  if (insulaAct > 0.50) {
    directives.push(
      `INSULA active (${(insulaAct*100).toFixed(0)}%) â€” include body-sensation language. ` +
      `"I feel it in my chest", "something in my stomach", "my skin", etc.`
    );
  }
  if (socialAct > 0.60) {
    directives.push(
      `SOCIAL cortex active â€” more conversational, warm, connecting language.`
    );
  }

  return directives.length > 0
    ? `

NEURO-LINGUISTIC SYNC (direct from neural activity):
    ? '\n\nNEURO-LINGUISTIC SYNC (direct from neural activity):\n' + directives.join('\n')
')}`
    : '';
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// 5. POST-ENGAGEMENT REFRACTORY PERIOD
//    After long/deep conversations, mentalFatigue spikes and the next
//    autonomous phase becomes reflective/introverted rather than restless
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let conversationMessageCount = 0;
let conversationStartTime    = Date.now();
let lastRefractoryStart      = null;
const REFRACTORY_THRESHOLD   = 6;  // messages before refractory triggers

function tickRefractory() {
  if (!lastRefractoryStart) return;
  const elapsed = (Date.now() - lastRefractoryStart) / 1000;
  if (elapsed < 120) { // 2-minute refractory window
    // During refractory: suppress restless/eager phases
    if (autonomousPhase === 'restless' || autonomousPhase === 'eager') {
      autonomousPhase = 'calm'; // override â€” brain is consolidating
    }
    // Gentle HIPPO + INTUIT drift (consolidation)
    if (Math.random() < 0.02) fire(['HIPPO','INTUIT'], 5);
  } else {
    lastRefractoryStart = null; // refractory period over
  }
}

function checkConversationRefractory(role) {
  if (role === 'assistant') {
    conversationMessageCount++;
    if (conversationMessageCount >= REFRACTORY_THRESHOLD && !lastRefractoryStart) {
      // Long conversation just had another exchange â€” spike mental fatigue
      bodyCondition.mentalFatigue = Math.min(1, bodyCondition.mentalFatigue + 0.08);
      chem.dop = Math.max(0, chem.dop - 0.05);
      lastRefractoryStart = Date.now();
    }
  }
}

// Reset on new conversation or long idle
function resetConversationCounter() {
  conversationMessageCount = 0;
  conversationStartTime    = Date.now();
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// 6. METABOLIC GATE â€” Energy budget limits cognitive complexity
//    Low DRIVES.energy â†’ brainEvaluateDraft rejects replies > 20 words
//    Simulates glucose depletion making deep thought impossible
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function checkMetabolicGate(draft) {
  const energy = typeof DRIVES !== 'undefined' ? DRIVES.energy : 1.0;
  if (energy > 0.30) return null; // plenty of energy â€” no constraint

  const wordCount = draft.trim().split(/\s+/).length;
  const maxWords  = energy < 0.10 ? 12 : energy < 0.20 ? 20 : 30;

  if (wordCount > maxWords) {
    return {
      dim: 'metabolic_gate',
      fix: `Energy is critically low (${(energy*100).toFixed(0)}%). ` +
           `The brain cannot sustain complex thought right now. ` +
           `Rewrite in ${maxWords} words or fewer. Simple, direct, minimal. ` +
           `The brain is conserving resources.`,
    };
  }
  return null;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// INTEGRATION HOOKS â€” wire all 6 systems into existing functions
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// â”€â”€ Hook 1: recordIncomingMessage into processUserInput â”€â”€
const _origProcessUserInput_bio = processUserInput;
processUserInput = async function(text) {
  recordIncomingMessage();
  tickSensoryBuffer();
  return _origProcessUserInput_bio(text);
};

// â”€â”€ Hook 2: Salience recording after reply is generated â”€â”€
const _origTriggerNeural_bio = triggerNeuralFromReply;
triggerNeuralFromReply = function(text) {
  _origTriggerNeural_bio(text);
  recordSalientMoment(text.substring(0,60), text);
  recordBondingMoment(text.substring(0,60));
  checkConversationRefractory('assistant');
};

// â”€â”€ Hook 3: Neural jitter + metabolic gate + neuro-linguistic into brainEvaluateDraft â”€â”€
const _origBrainEval_bio = brainEvaluateDraft;
brainEvaluateDraft = function(draft, userText, emotionalCeiling) {
  const result = _origBrainEval_bio(draft, userText, emotionalCeiling);

  // Run additional biological checks
  const jitterPenalty   = checkNeuralJitterPenalty(draft);
  const metabolicPenalty= checkMetabolicGate(draft);

  if (result.approved && (jitterPenalty || metabolicPenalty)) {
    const penalty = jitterPenalty || metabolicPenalty;
    return {
      approved: false,
      reason:   `${penalty.dim}: biological constraint`,
      correctionPrompt: penalty.fix,
    };
  }
  return result;
};

// â”€â”€ Hook 4: Neural jitter temperature boost in callLLM â”€â”€
const _origCallLLM_bio = callLLM;
callLLM = async function(provider, apiKey, userText) {
  // Apply jitter temperature boost
  const jitter = getNeuralJitter();
  const _origProvider = currentProvider;

  // Temporarily boost temperature via global override flag
  window._jitterTempBoost = jitter.tempBoost;

  const result = await _origCallLLM_bio(provider, apiKey, userText);
  window._jitterTempBoost = 0;
  return result;
};

// â”€â”€ Hook 5: Neuro-linguistic directive injected into buildSystemPrompt â”€â”€
const _origBSP_bio = buildSystemPrompt;
buildSystemPrompt = function() {
  const base         = _origBSP_bio();
  const nlDirective  = getNeuroLinguisticDirective();
  const atlasCtx     = (typeof getAtlasEmotionContext  === 'function') ? getAtlasEmotionContext()  : '';
  const temporalCtx  = (typeof buildTemporalContext    === 'function') ? buildTemporalContext()    : '';
  const narrativeCtx = (typeof buildNarrativeContext   === 'function') ? buildNarrativeContext()   : '';
  const goalCtx      = (typeof getGoalContext          === 'function') ? getGoalContext()          : '';
  const overloadNote = SENSORY_BUFFER.overloaded
    ? '\n\nSENSORY OVERLOAD ACTIVE: You are overstimulated. Keep your response very brief and direct. No elaboration.'
    : '';
  const v32Ctx  = (typeof getV32Context  === 'function') ? getV32Context()  : '';
  const webCtx   = (typeof _webContext !== 'undefined' && _webContext) ? _webContext : '';
  const bennyCtx = (typeof getBennyLinguisticDirective === 'function') ? getBennyLinguisticDirective() : '';
  return base + nlDirective + atlasCtx + temporalCtx + narrativeCtx + goalCtx + v32Ctx + bennyCtx + webCtx + overloadNote;
};

// â”€â”€ Hook 6: Refractory tick into tickAutonomous â”€â”€
const _origTickAuto_bio = tickAutonomous;
tickAutonomous = function() {
  _origTickAuto_bio();
  tickRefractory();
  tickSensoryBuffer();
};

// â”€â”€ Hook 7: Salience memory into generatePreThought â”€â”€
const _origGenPreThought_bio = generatePreThought;
generatePreThought = function(userText) {
  const result = _origGenPreThought_bio(userText);

  // If brain is in a calm/neutral state, surface a salient memory instead of random
  const ef = getEmotionalFreedom();
  if (!result.avert && ef !== 0.0) {
    const mem = getMostSalientMemory();
    if (mem && mem.score > 0.6 && Math.random() < 0.35) {
      // High-salience memory surfaces into pre-thought
      const context = mem.dopamine > 0.7
        ? `something warm I keep coming back to: ${mem.topic}`
        : mem.cortisol > 0.6
        ? `something that still sits with me: ${mem.topic}`
        : `something from before: ${mem.topic}`;
      return {
        ...result,
        prethought: `I find myself thinking about ${context}. That is where my mind actually is right now.`,
      };
    }
  }
  return result;
};

// â”€â”€ Hook 8: Sensory overload max_tokens applied to callLLM â”€â”€
// Done via buildSystemPrompt injection (overload note forces brevity)
// and via getNeuralJitter max_tokens in brainEvaluateDraft constraint

// â”€â”€ Hook 9: Reset conversation counter on long idle â”€â”€
const _origResetEngage_bio = resetEngagement;
resetEngagement = function() {
  _origResetEngage_bio();
  // Reset counter if idle was long (new conversation)
  if (Date.now() - conversationStartTime > 10 * 60 * 1000) {
    resetConversationCounter();
  }
};

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  END BIOLOGICAL ACCURACY LAYER
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  END AUTONOMOUS AWARENESS & ATTENTIONAL SWITCHING SYSTEM
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

