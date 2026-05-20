// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// DIALOG TOGGLE
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function toggleDialog() {
  dialogOpen = !dialogOpen;
  document.getElementById('dialog-body').classList.toggle('collapsed', !dialogOpen);
  document.getElementById('toggle-arrow').classList.toggle('up', dialogOpen);
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// INPUT MODE
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function setInputMode(mode) {
  inputMode = mode;
  document.getElementById('btn-mode-text').classList.toggle('active', mode==='text');
  document.getElementById('btn-mode-voice').classList.toggle('active', mode==='voice');
  const inp = document.getElementById('chat-input');
  const _activePlaceholderName = (typeof resolvePersona === 'function') ? resolvePersona().personaName : 'Katrina';
  inp.placeholder = mode==='voice' ? 'Press ðŸŽ™ to speakâ€¦' : `Speak to ${_activePlaceholderName}â€¦`;
  const _weInp = document.getElementById('we-chat-input');
  if (_weInp) _weInp.placeholder = mode==='voice' ? 'Press ðŸŽ™ to speakâ€¦' : `Speak to ${_activePlaceholderName}â€¦`;
}

function toggleTTS() {
  ttsEnabled = !ttsEnabled;
  const btn = document.getElementById('btn-tts-toggle');
  btn.textContent = ttsEnabled ? 'ðŸ”Š TTS ON' : 'ðŸ”‡ TTS OFF';
  btn.classList.toggle('active', ttsEnabled);
  if (!ttsEnabled) stopSpeech();
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// PROVIDER SWITCHING
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function setProvider(p) {
  currentProvider = p;
  const cfg = PROVIDERS[p];
  if(!cfg) return;

  // Highlight active provider badge
  const tg = document.getElementById('tab-groq');
  const td = document.getElementById('tab-doubao');
  const tm = document.getElementById('tab-gemini');
  const tk = document.getElementById('tab-deepseek');
  const to = document.getElementById('tab-ollama');
  if(tg) tg.classList.toggle('active', p==='groq');
  if(td) td.classList.toggle('active', p==='doubao');
  if(tm) tm.classList.toggle('active', p==='gemini');
  if(tk) tk.classList.toggle('active', p==='deepseek');
  if(to) to.classList.toggle('active', p==='ollama');

  // Rebuild model select for active provider
  const sel = document.getElementById('llm-select');
  if(sel) sel.innerHTML = cfg.models.map(m=>`<option value="${m.value}">${m.label}</option>`).join('');

  // Sync legacy hidden input with current provider key (for any JS that reads it)
  const legacy = document.getElementById('api-key-input');
  if(legacy) legacy.value = apiKeys[p] || '';

  // Announce switch in chat (skip on first init)
  const hist = document.getElementById('chat-history');
  if(hist && hist.children.length > 1) appendMsg('system', `â€” Active provider: ${cfg.name} â€”`);
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// STATUS
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function setStatus(state, text) {
  const dot  = document.getElementById('status-dot');
  const span = document.getElementById('status-text');
  dot.className = 'status-dot ' + state; // 'ready' | 'thinking' | 'speaking' | 'listening'
  // apply via id since class set above
  document.getElementById('status-dot').className = '';
  document.getElementById('status-dot').id = 'status-dot';
  dot.className = state;
  if(span) span.textContent = text.toUpperCase();
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// CHAT HISTORY RENDERING
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// âš   DO NOT DELETE â€” appendMsg timestamp system.
//    Every chat bubble (user AND katrina) is stamped with the real device
//    clock time at the moment it was sent or received. This timestamp is
//    also stored in lastMsgMeta so generatePreThought() can detect
//    physically impossible message timelines (e.g. "going to get food"
//    then "burger tastes great" 4 seconds later). Removing this breaks
//    temporal continuity awareness and the live chat time display.
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function appendMsg(role, text) {
  const hist = document.getElementById('chat-history');
  const div = document.createElement('div');
  div.className = 'msg ' + role;

  // â”€â”€ Real device clock timestamp â”€â”€
  const _now = new Date();
  const _hh  = _now.getHours();
  const _mm  = String(_now.getMinutes()).padStart(2,'0');
  const _ampm= _hh >= 12 ? 'PM' : 'AM';
  const _h12 = _hh % 12 || 12;
  const _timeStr = `${_h12}:${_mm} ${_ampm}`;

  // â”€â”€ Store for temporal continuity check â”€â”€
  if (typeof lastMsgMeta === 'undefined') window.lastMsgMeta = {};
  if (role === 'user') {
    window.lastMsgMeta = {
      ts:   Date.now(),
      text: text,
      timeStr: _timeStr
    };
  }

  // Use current persona name for the brain's chat label
  const _activePersonaName = (typeof resolvePersona === 'function')
    ? resolvePersona().personaName.toUpperCase()
    : 'KATRINA';
  const label = role==='user' ? 'YOU' : role==='katrina' ? _activePersonaName : '';
  const safeLabel = label.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  div.innerHTML = (safeLabel ? `<div class="msg-name">${safeLabel}</div>` : '') +
    // âš  DO NOT DELETE â€” Sleep-status and temporal-violation italic prefix.
    //   When katrina is in a sleep/drowsy phase OR a temporal continuity
    //   violation is active, a small italic line is prepended inside the
    //   bubble (like iMessage availability notes) before the reply text.
    //   This makes the chat feel like a real live messaging thread.
    (role === 'katrina' ? (function(){
      const _phase   = (typeof circadianPhase !== 'undefined' ? circadianPhase : 'awake');
      const _fatigue = (typeof circadianFatigue !== 'undefined' ? circadianFatigue : 0);
      const _tf      = window._temporalFlag;
      // Sleep/drowsy prefix
      const _sleepPhrases = ['sleeping', 'half asleep â€” might not respond', 'just dozed off', 'barely awake'];
      const _drowsyPhrases = ['getting sleepy', 'half awake', 'nodding off a little', 'dozing'];
      const _napPhrases = ['taking a nap', 'napping â€” message may wait', 'out for a nap'];
      let _statusLine = '';
      if (_phase === 'sleep' || _phase === 'rem') {
        _statusLine = _sleepPhrases[Math.floor(Math.random() * _sleepPhrases.length)];
      } else if (_phase === 'nap') {
        _statusLine = _napPhrases[Math.floor(Math.random() * _napPhrases.length)];
      } else if (_phase === 'drowsy' || _fatigue > 0.70) {
        _statusLine = _drowsyPhrases[Math.floor(Math.random() * _drowsyPhrases.length)];
      }
      // Temporal-violation prefix (overrides sleep if both fire)
      if (_tf && _tf.active) {
        const _actionLabels = {
          'travel'        : ['on the way', 'still heading over', 'in transit'],
          'step away'     : ['stepped out for a sec', 'just grabbed something', 'one moment'],
          'cooking'       : ['still in the kitchen', 'mid-cook', 'stirring something'],
          'getting ready' : ['still getting ready', 'almost done getting dressed'],
          'sleep'         : ['was sleeping', 'just woke up'],
        };
        const _pool = _actionLabels[_tf.label] || ['out for a bit'];
        _statusLine = _pool[Math.floor(Math.random() * _pool.length)];
      }
      return _statusLine ? `<div class="msg-status-line">${_statusLine}</div>` : '';
    })() : '') +
    escHtml(text) +
    `<div class="msg-time">${_timeStr}</div>`;

  hist.appendChild(div);
  hist.scrollTop = hist.scrollHeight;
}

function escHtml(t) {
  return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// âš   DO NOT DELETE â€” OUT-OF-REACH / PHONE-MODE / SLEEP-STATUS SYSTEM
//
//  WHAT THIS DOES (three interlocked features):
//
//  1. FUTURE-TIME PARSER â€” parseFutureTimeRef(text)
//     Scans the LLM's outgoing reply for phrases like "see you in an hour",
//     "back at 3", "give me 20 minutes", "talk later tonight". Returns a
//     target Date object computed from the real device clock, or null.
//
//  2. OUT-OF-REACH SYSTEM â€” activateOutOfReach(targetDate, label)
//     Called after appendMsg('katrina', reply) if a future-time ref is found.
//     - Hides the normal input-row, shows #out-of-reach-bar with label like
//       "gone until ~3:45 PM â€” out of reach â€” message anyway?"
//     - Schedules a real clock check: when targetDate arrives, clearOutOfReach()
//       fires, input-row returns, and a "she is back" status note appears.
//
//  3. PHONE-MODE â€” activatePhoneMode() / closePhoneMode()
//     Activated when user taps Yes on #out-of-reach-bar.
//     - Shows .pager-wrap, hides #out-of-reach-bar.
//     - Any message sent in phone mode is appended as a user bubble with a
//       ðŸ“± label; no LLM call is made (she is unreachable).
//     - A 10-second inactivity timer (resetPhoneModeTimer) closes phone mode
//       automatically if no typing/sending occurs, leaving a quiet note.
//
//  4. SLEEP-STATUS PREFIX â€” inside appendMsg (katrina role)
//     When circadianPhase is sleep/rem/nap/drowsy, an italic status line is
//     prepended inside the bubble: "sleeping", "half asleep", "just dozed off".
//
//  5. TEMPORAL-VIOLATION PREFIX â€” inside appendMsg (katrina role)
//     When window._temporalFlag is active (impossibly fast follow-up message),
//     an italic status line is prepended: "on the way", "out getting food", etc.
//     The LLM is also instructed (in generatePreThought) to open its reply with
//     a matching italic note so the text and UI stay coherent.
//
//  Removing this block collapses the real-time availability immersion system.
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// â”€â”€ 1. Future-time phrase parser â”€â”€
function parseFutureTimeRef(text) {
  const t   = text.toLowerCase();
  const now = new Date();

  // "in X minutes / hours"
  const relMin = t.match(/\bin\s+(\d+)\s*min/);
  if (relMin) return new Date(now.getTime() + parseInt(relMin[1]) * 60000);
  const relHr  = t.match(/\bin\s+(an?\s+)?hour/);
  if (relHr)   return new Date(now.getTime() + 3600000);
  const relHrs = t.match(/\bin\s+(\d+)\s*hour/);
  if (relHrs)  return new Date(now.getTime() + parseInt(relHrs[1]) * 3600000);

  // "see you at / back at / back by / there at HH:MM or H AM/PM"
  const atTime = t.match(/(?:back|there|see you|talk|home|at)\s+(?:at|by)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (atTime) {
    let h = parseInt(atTime[1]);
    const m = parseInt(atTime[2] || '0');
    const mer = atTime[3];
    if (mer === 'pm' && h < 12) h += 12;
    if (mer === 'am' && h === 12) h = 0;
    if (!mer && h < now.getHours()) h += 12; // assume PM if ambiguous and past
    const target = new Date(now);
    target.setHours(h, m, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1); // wrap to tomorrow
    return target;
  }

  // "talk later tonight / later / in a bit / brb"
  if (/\blater tonight\b/.test(t)) { const d = new Date(now); d.setHours(22,0,0,0); return d > now ? d : null; }
  if (/\blater\b/.test(t) && /\btonight\b/.test(t)) { const d = new Date(now); d.setHours(21,0,0,0); return d > now ? d : null; }
  if (/\bin a (bit|moment|sec|second)\b/.test(t) || /\bbrb\b/.test(t)) {
    return new Date(now.getTime() + 90000); // 90 s
  }
  if (/\bgive me (a moment|a sec|a minute)\b/.test(t)) {
    return new Date(now.getTime() + 120000);
  }

  return null;
}

// â”€â”€ 2. Format target time as "~3:45 PM" â”€â”€
function _fmtTargetTime(d) {
  const h = d.getHours(); const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12  = h % 12 || 12;
  return `~${h12}:${String(m).padStart(2,'0')} ${ampm}`;
}

// â”€â”€ 3. Out-of-reach activation â”€â”€
window._outOfReachTimer    = null;
window._pagerCountdownTimer = null;

function activateOutOfReach(targetDate, label) {
  window._outOfReach = { targetDate, label };
  const bar   = document.getElementById('out-of-reach-bar');
  const inRow = document.getElementById('input-row');
  const lbl   = document.getElementById('out-of-reach-label');
  const persona = (typeof resolvePersona === 'function')
    ? resolvePersona().personaName : 'Katrina';
  if (lbl)   lbl.textContent = `${persona} is out of reach â€” notify her?`;
  if (inRow) inRow.style.display = 'none';
  if (bar)   bar.classList.add('active');
  // Schedule automatic return when target time arrives
  if (window._outOfReachTimer) clearTimeout(window._outOfReachTimer);
  const msUntilReturn = targetDate - Date.now();
  if (msUntilReturn > 0 && msUntilReturn < 86400000) {
    window._outOfReachTimer = setTimeout(() => clearOutOfReach(true), msUntilReturn);
  }
}

function clearOutOfReach(showReturn) {
  window._outOfReach = null;
  if (window._outOfReachTimer)     { clearTimeout(window._outOfReachTimer);     window._outOfReachTimer = null; }
  if (window._pagerCountdownTimer) { clearInterval(window._pagerCountdownTimer); window._pagerCountdownTimer = null; }
  const bar   = document.getElementById('out-of-reach-bar');
  const inRow = document.getElementById('input-row');
  const pager = document.getElementById('pager-wrap');
  if (bar)   bar.classList.remove('active');
  if (pager) pager.classList.remove('active');
  if (inRow) inRow.style.display = '';
  if (showReturn) {
    const persona = (typeof resolvePersona === 'function')
      ? resolvePersona().personaName : 'Katrina';
    // System note
    appendMsg('system', `â€” ${persona} is back â€”`);
    // Live LLM greeting on return â€” she acknowledges she just came back
    _sendReturnGreeting();
  }
}

// â”€â”€ Pager mode â€” one tap, one reply, 20s countdown â”€â”€
// âš  DO NOT DELETE â€” activatePager is the pager-mode entry point.
//   No typing, no input field. User taps Notify, Katrina replies once
//   ("on my way back"), a 20s countdown runs, then chat auto-resumes.
async function activatePager() {
  const bar   = document.getElementById('out-of-reach-bar');
  const pager = document.getElementById('pager-wrap');
  const cd    = document.getElementById('pager-countdown');
  const rt    = document.getElementById('pager-reply-text');
  if (bar)   bar.classList.remove('active');
  if (pager) pager.classList.add('active');
  if (rt)    rt.textContent = 'ðŸ“Ÿ pagingâ€¦';
  if (cd)    cd.textContent = '20';

  // Cancel the original return-time timer â€” pager overrides it with fixed 20s
  if (window._outOfReachTimer) { clearTimeout(window._outOfReachTimer); window._outOfReachTimer = null; }

  // Get Katrina's pager reply â€” displayed IN the pager panel, not in chat
  const _pagerText = await _sendPagerReply();
  if (rt && _pagerText) rt.textContent = `ðŸ“Ÿ ${_pagerText}`;

  // 20-second countdown â€” large number ticking down
  let _secs = 20;
  if (cd) cd.textContent = String(_secs);
  if (window._pagerCountdownTimer) clearInterval(window._pagerCountdownTimer);
  window._pagerCountdownTimer = setInterval(() => {
    _secs--;
    if (cd) cd.textContent = _secs > 0 ? String(_secs) : '0';
    if (_secs <= 0) {
      clearInterval(window._pagerCountdownTimer);
      window._pagerCountdownTimer = null;
      clearOutOfReach(true);
    }
  }, 1000);
}

// â”€â”€ LLM call for pager reply â€” shown IN the pager panel, not in chat â”€â”€
// Returns the reply text so activatePager can display it in the panel.
async function _sendPagerReply() {
  const _apiKey = apiKeys[currentProvider] || '';
  const _cfg    = PROVIDERS[currentProvider];
  const _hasKey = _apiKey.length > 0 || (_cfg && _cfg.noKeyRequired);

  if (!_hasKey) {
    const _fallbacks = [
      'on my way back.', 'coming back now.', 'heading back.', 'be there shortly.',
    ];
    return _fallbacks[Math.floor(Math.random() * _fallbacks.length)];
  }

  // Chemical-aware pager reply â€” mood shapes urgency and warmth
  const _dop = chem.dop; const _oxy = chem.oxy; const _cor = chem.cor;
  const _chemHint = _oxy > 0.70 ? 'warm and happy to come back'
    : _cor > 0.55 ? 'slightly rushed or stressed'
    : _dop > 0.65 ? 'energetic and quick'
    : 'calm and easy';

  const _prompt =
    `You received a pager buzz â€” someone is waiting and wants you back now. ` +
    `You are mid-activity (${window._outOfReach?.label || 'out'}) but you saw it. ` +
    `Your mood right now: ${_chemHint}. ` +
    `Reply in ONE very short plain sentence that feels natural for your mood â€” ` +
    `something like "on my way", "coming now", "heading back", "be right there". ` +
    `This reply appears on the pager screen, not in a chat. Keep it very brief. ` +
    `No markdown. No symbols. No asterisks.`;

  try {
    const _modelId = document.getElementById('llm-select')?.value;
    if (!_cfg || !_modelId) return 'on my way back.';
    const res = await safeFetch(_cfg.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + _apiKey },
      body: JSON.stringify({
        model:       _modelId,
        messages:    [{ role: 'system', content: buildSystemPrompt() }, { role: 'user', content: _prompt }],
        max_tokens:  25,
        temperature: 0.88,
      }),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data  = await res.json();
    const reply = ((data.choices||[])[0]||{}).message?.content?.trim();
    return reply || 'on my way back.';
  } catch(e) {
    return 'on my way back.';
  }
}

// â”€â”€ Brain-produced return statement â€” full brain loop, aware of paging â”€â”€
// She knows she was paged, she knows she just came back, she speaks naturally
// from her current chemical and emotional state. Goes through callLLMWithBrainLoop
// so pre-thought, signature matching, and persona are all active.
async function _sendReturnGreeting() {
  const _apiKey = apiKeys[currentProvider] || '';
  const _cfg    = PROVIDERS[currentProvider];
  const _hasKey = _apiKey.length > 0 || (_cfg && _cfg.noKeyRequired);
  if (!_hasKey) return;

  // Add the paging context to the chat history as a user trigger
  // so callLLMWithBrainLoop has something to respond to
  const _returnContext =
    `[you were paged while away and just came back â€” acknowledge naturally that you are back now, ` +
    `without announcing it robotically. Let your current mood (dop:${chem.dop.toFixed(2)}, ` +
    `oxy:${chem.oxy.toFixed(2)}, cor:${chem.cor.toFixed(2)}) shape how you arrive â€” ` +
    `warm, hurried, calm, or a mix. One or two sentences. Say something real, not a script.]`;

  try {
    const reply = await callLLMWithBrainLoop(currentProvider, _apiKey, _returnContext);
    if (reply && reply.length > 2) {
      appendMsg('katrina', reply);
      chatHistory.push({ role: 'assistant', content: reply });
      triggerNeuralFromReply(reply);
      if (ttsEnabled) speakText(reply);
    }
  } catch(e) { /* silent */ }
}

// â”€â”€ Keep old function names as no-ops so nothing else breaks â”€â”€
function activatePhoneMode() { activatePager(); }
function closePhoneMode()     { clearOutOfReach(false); }
function sendPhoneMessage()   {}
function resetPhoneModeTimer(){}
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// END OUT-OF-REACH / PHONE-MODE / SLEEP-STATUS SYSTEM
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•


// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// SEND MESSAGE (text â†’ LLM â†’ response)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function sendMessage() {
  const inp = document.getElementById('chat-input');
  const text = inp.value.trim();
  if (!text) return;
  inp.value = '';
  // âš  DO NOT DELETE â€” IQ mode router. When 1000% IQ is active,
  // bypass the entire brain pipeline and go straight to raw LLM.
  if (_iqMode) { await processUserInputIQ(text); return; }
  await processUserInputWithEngagement(text);
}


