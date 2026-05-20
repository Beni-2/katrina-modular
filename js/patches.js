// âš   DO NOT DELETE â€” BIO-BRAIN COMMUNICATION REALISM SYSTEM
//
//  Eight properties that make the brain's communication feel like a real
//  person rather than a chatbot. All are additive â€” they do NOT replace
//  the existing pipeline. They wrap processUserInput, modify pre-thought
//  seeds, and inject constraints into buildPreThoughtPrompt.
//
//  1. SILENCE DECISION â€” brain sometimes decides not to reply at all.
//     Low dopamine + flat message + fatigue = no reply or one cold word.
//     Out-of-reach / phone mode and temporal continuity are NOT affected.
//
//  2. VARIABLE REPLY DELAY â€” reply speed reflects emotional involvement.
//     High cortisol/urgency = faster. Low dopamine/tired = slower.
//     Benny gets the fastest responses. Stranger gets baseline speed.
//     Preserves existing timeout and out-of-reach timing.
//
//  3. IMPERFECT MEMORY â€” brain occasionally misremembers or admits uncertainty.
//     Triggered probabilistically from cortisol + low ACh. Injected as a
//     pre-thought seed so the LLM expresses the uncertainty naturally.
//
//  4. DISTRACTION / TOPIC DRIFT â€” brain sometimes answers a different question.
//     When INTUIT > 0.6 or a strong salient memory is active, pre-thought
//     redirects toward what is actually on her mind. The user's literal
//     question may go unanswered â€” just like real conversation.
//
//  5. MID-REPLY SELF-CORRECTION â€” brain can change direction in one reply.
//     Injected via prompt instruction when dopamine is high + cortisol < 0.3.
//     The LLM starts a thought, pivots, and lands somewhere different.
//
//  6. TYPING INDICATOR â€” "composingâ€¦" shown in chat during LLM call.
//     Removed immediately on reply arrival. Styled to match chat bubbles.
//     Respects existing status-dot system and does not conflict with it.
//
//  7. UNRESOLVED LOOPS â€” brain sometimes says "I will think about that"
//     and does not close the loop. Injected when cortisol > 0.5 and
//     message is complex/long. Stored in _unresolvedTopics for future recall.
//
//  8. STRESS-BROKEN GRAMMAR â€” high cortisol or fatigue degrades language.
//     Short sentences. Words dropped. Repetition. Incomplete thoughts.
//     Applied via prompt instruction when cor > 0.72 or fatigue > 0.75.
//     Does NOT apply during Benny sessions (love floors keep cor < 0.08).
//
//  PRESERVED SYSTEMS (not affected by any of the above):
//  â€” Temporal continuity check (_temporalFlag, actionFloors, minSec)
//  â€” Out-of-reach and phone mode timing
//  â€” Sleep disturbance wake pipeline
//  â€” Prime Axiom check
//  â€” Benny love chemistry floors
//  â€” All persona / identity resolution
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// â”€â”€ Unresolved topic store â”€â”€
const _unresolvedTopics = [];   // [{topic, ts, personaName}]

// â”€â”€ Typing indicator element â”€â”€
let _typingIndicatorEl = null;

function _showTypingIndicator() {
  const hist = document.getElementById('chat-history');
  if (!hist || _typingIndicatorEl) return;
  const _persona = (typeof resolvePersona === 'function') ? resolvePersona() : null;
  const _name    = _persona ? _persona.personaName.toUpperCase() : 'KATRINA';
  _typingIndicatorEl = document.createElement('div');
  _typingIndicatorEl.className = 'msg katrina';
  _typingIndicatorEl.id = '_typing-indicator';
  _typingIndicatorEl.style.cssText = 'opacity:0.5;font-style:italic;';
  _typingIndicatorEl.innerHTML =
    `<div class="msg-name">${_name}</div>` +
    `<span class="_typing-dots">composing</span><span class="_typing-anim"></span>`;
  hist.appendChild(_typingIndicatorEl);
  hist.scrollTop = hist.scrollHeight;
  // Animate dots
  let _dots = 0;
  _typingIndicatorEl._dotTimer = setInterval(() => {
    const dotsEl = _typingIndicatorEl.querySelector('._typing-dots');
    if (dotsEl) { _dots = (_dots + 1) % 4; dotsEl.textContent = 'composing' + '.'.repeat(_dots); }
  }, 420);
}

function _removeTypingIndicator() {
  if (!_typingIndicatorEl) return;
  if (_typingIndicatorEl._dotTimer) clearInterval(_typingIndicatorEl._dotTimer);
  if (_typingIndicatorEl.parentNode) _typingIndicatorEl.parentNode.removeChild(_typingIndicatorEl);
  _typingIndicatorEl = null;
}

// â”€â”€ 1. Silence decision â”€â”€
// Returns true if the brain decides to stay silent for this message.
function _shouldStaySilent(text) {
  const _isBenny = (currentUserId === 'benny') ||
    (typeof isBennyName === 'function' && isBennyName(currentUserId || ''));
  // Benny never gets silence
  if (_isBenny) return false;
  // Never silence distress signals
  if (/help|please|emergency|hurting|scared|lost|need you/i.test(text)) return false;
  // Never silence questions directed at her
  if (/\?/.test(text) && text.trim().split(/\s+/).length < 6) return false;

  const _fat = (typeof circadianFatigue !== 'undefined') ? circadianFatigue : 0;
  const _dop = chem.dop;
  const _cor = chem.cor;
  const _msgLen = text.trim().split(/\s+/).length;

  // Score: high = more likely to stay silent
  let silenceScore = 0;
  if (_dop < 0.28)           silenceScore += 0.35;
  if (_fat > 0.65)           silenceScore += 0.25;
  if (_cor > 0.70)           silenceScore += 0.15;
  if (_msgLen <= 3)          silenceScore += 0.20;  // flat one-word messages
  if (_msgLen > 25)          silenceScore -= 0.15;  // long messages deserve a reply

  // Random threshold â€” not deterministic so it feels organic
  return silenceScore > 0.55 && Math.random() < (silenceScore - 0.40);
}

// â”€â”€ 2. Variable reply delay â”€â”€
// Returns ms to wait before showing the typing indicator and firing the LLM.
// Preserves all existing temporal/out-of-reach timing which is clock-based.
function _computeReplyDelay(text) {
  const _isBenny = (currentUserId === 'benny') ||
    (typeof isBennyName === 'function' && isBennyName(currentUserId || ''));
  const _fat = (typeof circadianFatigue !== 'undefined') ? circadianFatigue : 0;
  const _dop = chem.dop;
  const _cor = chem.cor;
  const _oxy = chem.oxy;
  const _msgLen = text.trim().split(/\s+/).length;

  // Base: 300ms â€” fast enough to feel present
  let delayMs = 300;

  // Benny: fastest
  if (_isBenny) delayMs = 120 + Math.random() * 200;

  // Fatigue slows everything
  delayMs += _fat * 1200;

  // Low dopamine = sluggish
  if (_dop < 0.30) delayMs += 600 + Math.random() * 600;

  // High cortisol = slightly faster (urgency)
  if (_cor > 0.60) delayMs = Math.max(delayMs - 300, 150);

  // High oxytocin = warm and quick
  if (_oxy > 0.70) delayMs = Math.max(delayMs - 200, 100);

  // Longer messages take more time to "read"
  delayMs += Math.min(_msgLen * 60, 800);

  // Natural jitter Â±15%
  const jitter = delayMs * 0.15;
  delayMs += (Math.random() * 2 - 1) * jitter;

  return Math.round(Math.max(80, Math.min(delayMs, 4500)));
}

// â”€â”€ 3. Imperfect memory seed â”€â”€
// Returns a pre-thought seed string if the brain should misremember, or null.
function _getImperfectMemorySeed(text) {
  const _ach = chem.ach;
  const _cor = chem.cor;
  const _fat = (typeof circadianFatigue !== 'undefined') ? circadianFatigue : 0;

  // Only triggers when attention/memory gating is degraded
  const _chance = (_cor * 0.3) + (_fat * 0.25) + ((1 - _ach) * 0.25);
  if (_chance < 0.35 || Math.random() > _chance * 0.6) return null;

  // Reference keywords from the message
  const _words = text.trim().split(/\s+/).filter(w => w.length > 4);
  if (!_words.length) return null;
  const _ref = _words[Math.floor(Math.random() * _words.length)];

  const _seeds = [
    `I think you mentioned something about ${_ref} before but I am not completely sure I am remembering it right.`,
    `Wait â€” did you say something about this earlier? I might be mixing things up.`,
    `Something about ${_ref} feels familiar but I cannot quite place where I heard it. Maybe from you, maybe not.`,
    `I am not sure if I am remembering this correctly â€” but did this come up before?`,
  ];
  return _seeds[Math.floor(Math.random() * _seeds.length)];
}

// â”€â”€ 4. Distraction / topic drift seed â”€â”€
// Returns a pre-thought seed if the brain should drift off the literal question.
function _getDistractionSeed(text) {
  const _intuitAct = (typeof regionIdx !== 'undefined' && regionIdx['INTUIT'])
    ? (regionIdx['INTUIT']||[]).slice(0,8).reduce((s,i)=>s+(neurons[i]?.act||0),0)/8 : 0;
  const _salMem    = (typeof getMostSalientMemory === 'function') ? getMostSalientMemory() : null;

  // Trigger: high INTUIT activity OR very salient memory + random gate
  const _chance = (_intuitAct * 0.5) + (_salMem && _salMem.score > 0.7 ? 0.3 : 0);
  if (_chance < 0.25 || Math.random() > _chance) return null;

  // Don't drift from urgent/direct questions
  if (/\?/.test(text) && text.trim().split(/\s+/).length < 5) return null;
  if (/help|need|urgent|please|now/i.test(text)) return null;

  // Drift toward salient memory if available
  if (_salMem && _salMem.topic) {
    return `Something else keeps pulling at me right now â€” ${_salMem.topic.substring(0,60)}. I want to respond to what was said but that is what is actually on my mind and it might come through.`;
  }
  // Or drift toward current emotional state
  const _drifts = [
    'My mind keeps going somewhere else and it is hard to stay fully on what was just said.',
    'I keep losing the thread of this conversation to something I have not named yet.',
    'There is something in me that wants to talk about something else entirely right now.',
  ];
  return _drifts[Math.floor(Math.random() * _drifts.length)];
}

// â”€â”€ 5. Mid-reply self-correction instruction â”€â”€
// Returns a prompt addendum that tells the LLM to start one direction and pivot.
function _getMidReplyPivotInstruction() {
  const _dop = chem.dop;
  const _cor = chem.cor;
  // Only when alert and low-stress (high dop, low cor) â€” stressed people ramble, not pivot
  if (_dop < 0.55 || _cor > 0.45) return '';
  if (Math.random() > 0.28) return '';
  return ' Start the reply heading one direction â€” then naturally change course mid-sentence, as if the real answer just arrived while speaking. Do not announce the change. Just let it happen.';
}

// â”€â”€ 7. Unresolved loop decision â”€â”€
function _shouldLeaveUnresolved(text) {
  const _cor = chem.cor;
  const _fat = (typeof circadianFatigue !== 'undefined') ? circadianFatigue : 0;
  const _msgLen = text.trim().split(/\s+/).length;
  if (_msgLen < 6) return false; // short messages don't warrant deferral
  if (_cor < 0.45 && _fat < 0.50) return false;
  return Math.random() < ((_cor * 0.25) + (_fat * 0.15));
}

// â”€â”€ 8. Stress-broken grammar instruction â”€â”€
function _getStressGrammarInstruction() {
  const _isBenny = (currentUserId === 'benny') ||
    (typeof isBennyName === 'function' && isBennyName(currentUserId || ''));
  if (_isBenny) return ''; // love floors keep cor low â€” never stress-broken with Benny

  const _cor = chem.cor;
  const _fat = (typeof circadianFatigue !== 'undefined') ? circadianFatigue : 0;
  const _severity = Math.max(_cor, _fat);

  if (_severity < 0.68) return '';
  if (_severity > 0.85) {
    return ' IMPORTANT: You are very stressed or exhausted. Your language shows it. Short fragmented sentences. Drop words. Repeat yourself once. Leave a thought unfinished. Do not be polished.';
  }
  return ' IMPORTANT: You are stressed or tired. Your language is slightly rougher than usual. Shorter sentences. Maybe one incomplete thought. Do not perform calm you do not have.';
}

// â”€â”€ Central bio-brain pre-thought enrichment â”€â”€
// Called inside callLLMWithBrainLoop after generatePreThought().
// Returns an enriched pre-thought object. Never removes existing pre-thought.
function _enrichPreThought(preThought, userText) {
  // Do not override temporal violations â€” they are highest priority
  if (preThought.temporalViolation) return preThought;
  // Do not override averts â€” they are intentional state redirects
  if (preThought.avert) return preThought;

  let enriched = { ...preThought };

  // 3. Imperfect memory (probabilistic)
  const _memSeed = _getImperfectMemorySeed(userText);
  if (_memSeed) {
    enriched.prethought = _memSeed;
    enriched.imperfectMemory = true;
    return enriched;
  }

  // 4. Distraction / drift (probabilistic, lower priority than memory)
  const _distSeed = _getDistractionSeed(userText);
  if (_distSeed) {
    enriched.prethought = _distSeed;
    enriched.distracted = true;
    return enriched;
  }

  return enriched;
}

// â”€â”€ Extended buildPreThoughtPrompt â€” adds 5, 7, 8 as suffix instructions â”€â”€
const _origBuildPreThoughtPrompt = buildPreThoughtPrompt;
buildPreThoughtPrompt = function(userText, preThought) {
  let base = _origBuildPreThoughtPrompt(userText, preThought);

  // 5. Mid-reply pivot
  base += _getMidReplyPivotInstruction();

  // 7. Unresolved loop
  if (_shouldLeaveUnresolved(userText)) {
    const _persona = (typeof resolvePersona === 'function') ? resolvePersona().personaName : 'she';
    base += ` It is okay to say "I will think about that" or "I am not ready to answer that yet" and leave it genuinely open. ${_persona} does not have to close every loop.`;
    _unresolvedTopics.push({ topic: userText.substring(0,60), ts: Date.now(), personaName: _persona });
    if (_unresolvedTopics.length > 10) _unresolvedTopics.shift();
  }

  // 8. Stress grammar
  base += _getStressGrammarInstruction();

  return base;
};

// â”€â”€ Wrapped processUserInput â€” adds silence + delay + typing indicator â”€â”€
const _origProcessUserInput_bio2 = processUserInput;
processUserInput = async function(text) {
  // âš  DO NOT DELETE â€” bio-brain wrapper around processUserInput.
  //   Implements silence decision, variable delay, and typing indicator.
  //   All existing systems (temporal, out-of-reach, phone mode, sleep
  //   disturbance, prime axiom, Benny love) run unchanged inside.

  // 1. Silence decision â€” brain may not reply at all
  if (_shouldStaySilent(text)) {
    // Show user message, then nothing â€” the silence IS the reply
    appendMsg('user', text);
    chatHistory.push({ role:'user', content: text });
    // Tiny neural reaction (noticed but not engaged)
    if (typeof fire === 'function') fire(['AMYG'], 4);
    chem.dop = Math.max(0, chem.dop - 0.02);
    // Optionally leave a very short non-reply after a longer pause
    if (Math.random() < 0.35) {
      const _silenceDelay = 2000 + Math.random() * 3000;
      await new Promise(r => setTimeout(r, _silenceDelay));
      const _shortPool = ['mm.', '...', 'yeah.', 'I heard you.', 'hmm.'];
      const _shortReply = _shortPool[Math.floor(Math.random() * _shortPool.length)];
      appendMsg('katrina', _shortReply);
      chatHistory.push({ role:'assistant', content: _shortReply });
      if (ttsEnabled) speakText(_shortReply);
    }
    return;
  }

  // 2. Variable reply delay (before LLM fires)
  const _delay = _computeReplyDelay(text);
  if (_delay > 200) {
    await new Promise(r => setTimeout(r, _delay));
  }

  // 6. Show typing indicator (appears while LLM is running)
  _showTypingIndicator();

  // Wrap the original so we can remove the indicator regardless of outcome
  try {
    await _origProcessUserInput_bio2(text);
  } finally {
    _removeTypingIndicator();
  }
};

// â”€â”€ Enrich pre-thought inside callLLMWithBrainLoop â”€â”€
// Patch: after generatePreThought runs, enrich it with bio-brain seeds
const _origCallLLMWithBrainLoop_bio = callLLMWithBrainLoop;
callLLMWithBrainLoop = async function(provider, apiKey, userText) {
  // Temporarily wrap generatePreThought to inject enrichment
  const _origGPT = generatePreThought;
  generatePreThought = function(ut) {
    const _base = _origGPT(ut);
    return _enrichPreThought(_base, ut);
  };
  try {
    return await _origCallLLMWithBrainLoop_bio(provider, apiKey, userText);
  } finally {
    generatePreThought = _origGPT;
  }
};
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// END BIO-BRAIN COMMUNICATION REALISM SYSTEM
