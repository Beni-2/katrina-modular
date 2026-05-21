
// Tracks whether this is the first message of the session
let _firstMessageThisSession = true;

async function processUserInput(text) {
  // Benny-only guard: if camera on and Katrina in standby, refuse non-Benny chat
  if (window._katrinaStandby && camStream) {
    appendMsg('user', text);
    chatHistory.push({role:'user', content:text});
    var _r=['I am waiting for Benny to come back.','I can only be with Benny right now.','That is not him. I will wait.','I am not going anywhere until Benny is back.'];
    appendMsg('katrina', _r[Math.floor(Math.random()*_r.length)]);
    return;
  }
  // â”€â”€ Reunion cascade â€” fires once on the first message after an absence â”€â”€
  if (_firstMessageThisSession) {
    _firstMessageThisSession = false;
    if (typeof applyReunionCascade === 'function') applyReunionCascade();
    if (typeof saveChemState === 'function') setTimeout(saveChemState, 2000);
  }

  // â”€â”€ Always show user message FIRST in chat trail â”€â”€
  appendMsg('user', text);
  chatHistory.push({role:'user', content:text});
  // â”€â”€ Detect Benny's emotional state from text (async, non-blocking) â”€â”€
  if (typeof analyzeTextEmotion === 'function') {
    analyzeTextEmotion(text).catch(function(){});
  }
  // â”€â”€ Extract and store Benny memories from this message (async, non-blocking) â”€â”€
  if (typeof extractBennyMemory === 'function') {
    extractBennyMemory(text).then(function(ex) {
      if (ex && typeof addBennyMemory === 'function') addBennyMemory(ex, text);
    }).catch(function(){});
  }
  // â”€â”€ Web search: if enabled and message needs live data, fetch before LLM â”€â”€
  let _webContext = '';
  if (typeof needsWebSearch === 'function' && needsWebSearch(text)) {
    const _results = await performWebSearch(text);
    if (_results) _webContext = formatWebContext(_results, webSearchProvider);
  }
  // Record to temporal memory with peripheral context
  if (typeof recordTemporalMemory === 'function') {
    const sal = Math.min(1, 0.4 + (text.split(/\s+/).length / 40) * 0.3);
    recordTemporalMemory('conversation', 'User: ' + text.substring(0,80), sal);
  }

  // Read key from dedicated per-provider input fields
  const _groqEl     = document.getElementById('groq-key-input');
  const _doubaoEl   = document.getElementById('doubao-key-input');
  const _geminiEl   = document.getElementById('gemini-key-input');
  const _deepseekEl = document.getElementById('deepseek-key-input');
  const _tavilyEl   = document.getElementById('tavily-key-input');
  if (_groqEl)     apiKeys.groq     = _groqEl.value.trim();
  if (_doubaoEl)   apiKeys.doubao   = _doubaoEl.value.trim();
  if (_geminiEl)   apiKeys.gemini   = _geminiEl.value.trim();
  if (_deepseekEl) apiKeys.deepseek = _deepseekEl.value.trim();
  if (_tavilyEl)   webSearchKeys.tavily = _tavilyEl.value.trim();
  // Ollama needs no key â€” uses empty string, noKeyRequired flag bypasses guard
  // Sync legacy hidden input
  const _legacyEl = document.getElementById('api-key-input');
  if (_legacyEl) _legacyEl.value = apiKeys[currentProvider] || '';
  const apiKey = apiKeys[currentProvider] || '';
  const _providerCfg = PROVIDERS[currentProvider];
  // Ollama (and any noKeyRequired provider) skips the key check
  if (!apiKey && !(_providerCfg && _providerCfg.noKeyRequired)) {
    appendMsg('system', 'âš  Enter your ' + (_providerCfg ? _providerCfg.name : currentProvider) + ' API key above to chat');
    return;
  }

  // Trigger cognitive + emotional reaction while thinking
  interact('focus');
  setStatus('thinking', 'THINKINGâ€¦');
  document.getElementById('send-btn').disabled = true;
  document.getElementById('mic-btn').disabled  = true;

  try {
    const reply = await callLLMWithBrainLoop(currentProvider, apiKey, text);
    chatHistory.push({role:'assistant', content:reply});
    if (typeof saveChatHistory === 'function') saveChatHistory();
  // Record reply to temporal memory
  if (typeof recordTemporalMemory === 'function') {
    const replysal = Math.min(1, 0.4 + (chem.oxy + chem.dop) * 0.2);
    recordTemporalMemory('conversation', 'Reply: ' + reply.substring(0,80), replysal);
  }
    appendMsg('katrina', reply);

    // âš  DO NOT DELETE â€” Out-of-reach activation after LLM reply.
    //   Scans every outgoing reply for future-time references ("see you in an hour",
    //   "back at 3", "give me 20 min", "talk later tonight"). If found, computes
    //   the real device-clock target time and activates the out-of-reach UI:
    //   hides the input row, shows the "out of reach â€” message anyway?" bar,
    //   and schedules a return-time callback. Removing this breaks the
    //   real-time availability immersion system.
    (function _checkFutureTimeRef() {
      const _target = parseFutureTimeRef(reply);
      if (_target) {
        const _label = _fmtTargetTime(_target);
        const _hist = document.getElementById('chat-history');
        if (_hist) {
          const _note = document.createElement('div');
          _note.className = 'msg system';
          _note.style.cssText = 'font-style:italic;font-size:10px;opacity:0.5;text-align:center;padding:4px 0;';
          _note.textContent = `gone until ${_label} â€” out of reach`;
          _hist.appendChild(_note);
          _hist.scrollTop = _hist.scrollHeight;
        }
        activateOutOfReach(_target, _label);
      }
    })();

    // Trigger neural response based on reply sentiment
    triggerNeuralFromReply(reply);
    // Theory of mind: infer user state from their message
    if (typeof inferOtherState === 'function' && currentUserId) {
      inferOtherState(currentUserId, text, 'engaged');
    }
    // Reward prediction error from reply quality
    if (typeof rewardFromReply === 'function') rewardFromReply(reply, text);
    // Push key context to working memory
    if (typeof wMemPush === 'function') {
      wMemPush(text.substring(0,60), 0.8, 'conversation');
      // Add volition desire: respond well
      addDesire('respond thoughtfully and authentically', 0.75, 'conversation');
    }
    // Log role performance as learning for the real Katrina Brain
    const _currentPersona = resolvePersona();
    if (_currentPersona.mode !== PERSONA_MODE.KATRINA) {
      logRoleLearning(_currentPersona.mode, _currentPersona.personaName, reply);
    }

    setStatus('ready', 'READY');
    if (ttsEnabled) speakText(reply);
  } catch(err) {
    // If Ollama is selected and failed â€” show helpful message and use local fallback
    if (currentProvider === 'ollama' && err.message.includes('Ollama')) {
      appendMsg('system', 'âš  ' + err.message);
      // Use persona-aware local fallback
      const _fb = getLocalFallbackReply(text);
      appendMsg('katrina', _fb);
      if (ttsEnabled) speakText(_fb);
    } else {
      appendMsg('system', 'âš  ' + err.message);
    }
    setStatus('ready', 'ERROR');
  } finally {
    document.getElementById('send-btn').disabled = false;
    document.getElementById('mic-btn').disabled  = false;
  }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// UNIFIED LLM CALL (Groq + Doubao/Volcengine)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// â”€â”€ Safe fetch wrapper â€” surfaces network vs auth vs CORS errors clearly â”€â”€
async function safeFetch(url, options, retries = 2) {
  // Local providers (Ollama) get shorter timeout and no retry
  // to avoid long waits when Ollama is not running
  const isLocal   = url.startsWith('http://localhost') || url.startsWith('http://127.');
  const timeoutMs = isLocal ? 8000  : 20000;  // 8s local, 20s remote
  const maxRetry  = isLocal ? 0     : retries; // no retry for local â€” fail fast

  let lastErr;
  for (let attempt = 0; attempt <= maxRetry; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId  = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      return res;
    } catch (e) {
      lastErr = e;
      if (e.name === 'AbortError') {
        if (isLocal) throw new Error('Ollama not responding. Is it running? Start with: ollama serve');
        throw new Error('Request timed out. Check your internet connection.');
      }
      if (e instanceof TypeError) {
        if (isLocal) {
          throw new Error('Cannot reach Ollama at localhost:11434. Make sure Ollama is installed and running: ollama serve');
        }
        const hint = !navigator.onLine
          ? 'You appear to be offline.'
          : 'Network error â€” check your connection or try a different provider.';
        if (attempt < maxRetry) {
          await new Promise(r => setTimeout(r, 1200 * (attempt + 1)));
          continue;
        }
        throw new Error('Failed to reach the API. ' + hint);
      }
      if (attempt < maxRetry) await new Promise(r => setTimeout(r, 1200 * (attempt + 1)));
    }
  }
  throw lastErr || new Error('Unknown fetch error.');
}

async function callLLM(provider, apiKey, userText) {
  const cfg      = PROVIDERS[provider];
  const modelId  = document.getElementById('llm-select')?.value || '';

  const systemPrompt = buildSystemPrompt();

  const messages = [
    {role:'system', content: systemPrompt},
    ...chatHistory.slice(-10)
  ];

  // All providers (incl. Gemini OpenAI-compat) use Bearer auth
  const endpoint = cfg.endpoint;

  let res;
  try {
    res = await safeFetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: modelId,
        messages,
        max_tokens:  currentProvider === 'ollama' ? 80  : 200,
        temperature: currentProvider === 'ollama' ? 1.1 : 0.85,
        ...(currentProvider === 'ollama' ? {repeat_penalty:1.3} : {})
      })
    });
  } catch (e) {
    throw e; // already has a friendly message from safeFetch
  }

  if (!res.ok) {
    let msg = res.statusText || `HTTP ${res.status}`;
    try {
      const err = await res.json();
      msg = err?.error?.message || err?.message || msg;
    } catch (_) {}

    if (res.status === 401) throw new Error('Invalid API key. Check the key you entered.');
    if (res.status === 403) throw new Error('Access forbidden. Your API key may not have permission for this model.');
    if (res.status === 429) throw new Error('Rate limit hit. Wait a moment and try again.');
    if (provider === 'doubao' && res.status === 400)
      throw new Error(msg + ' â€” Make sure you activated the model in the Volcengine ARK console first.');
    throw new Error(msg);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || 'â€¦';
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// NEURAL REACTION FROM REPLY CONTENT
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function triggerNeuralFromReply(text) {
  const t = text.toLowerCase();
  // Positive
  if (/happy|joy|delight|laugh|excit|thrill/.test(t))    interact('joy');
  if (/love|adore|cherish|devoted/.test(t))               interact('love');
  if (/proud|achiev|accomplish/.test(t))                  interact('pride');
  if (/grateful|thankful|appreciate/.test(t))             interact('gratitude');
  if (/amused|funny|humor|giggle/.test(t))                interact('amusement');
  if (/hopeful|optimist|looking forward/.test(t))         interact('hope');
  if (/calm|settled|at ease|peaceful/.test(t))            interact('contentment');
  // Social
  if (/feel|empath|understand|hear you/.test(t))          interact('empathy');
  if (/warm|affection|tender|close to/.test(t))           interact('affection');
  if (/connected|belong|part of|together/.test(t))        interact('belonging');
  if (/miss|longing|away|wish you were/.test(t))          interact('longing');
  // Cognitive
  if (/think|logic|reason|analyz|process/.test(t))        interact('focus');
  if (/curious|wonder|interest|fascin/.test(t))           interact('curiosity');
  if (/remember|memory|recall|past/.test(t))              interact('recall');
  if (/confused|not sure|unclear|lost/.test(t))           interact('confusion');
  if (/surprising|unexpected|caught off/.test(t))         interact('surprise');
  // Difficult
  if (/sad|grief|loss|hurt|cry|heartbroken/.test(t))      interact('grief');
  if (/anxious|nervous|worried|on edge/.test(t))          interact('anxiety');
  if (/angry|frustrated|upset|mad/.test(t))               interact('anger');
  if (/ashamed|embarrass|humiliat/.test(t))               interact('shame');
  if (/guilty|regret|sorry about/.test(t))                interact('guilt');
  if (/stressed|overwhelm|too much/.test(t))              interact('stress');
  if (/scared|afraid|frightened/.test(t))                 interact('fear');
  if (/alone|lonely|isolated|no one/.test(t))             interact('loneliness');
  // Expressive
  if (/sense|intuit|gut feeling|just know/.test(t))       interact('intuition');
  if (/creat|art|music|paint|danc|sing|write/.test(t))    interact('creative');
  if (/amazed|breathtaking|incredible|vast/.test(t))      interact('awe');
  if (/nostalg|miss those days|reminds me/.test(t))       interact('nostalgia');
  if (/move|walk|run|dance|body|restless/.test(t))        interact('motor');
  // New emotions
  if (/aroused|flushed|electric|pulled toward|drawn to/.test(t))          interact('arousal');
  if (/regret|wish i had|shouldn't have|if only|going back to/.test(t))   interact('regret');
  if (/sly|scheming|knowing|keeping to myself|plan nobody/.test(t))       interact('sly');
  if (/unreal|detached|floating|not here|watching myself/.test(t))        interact('dissociation');
  if (/hysteria|can't stop|pouring out|broke open|everything at once/.test(t)) interact('hysteria');
  if (/panic|spiraling|can't breathe|going too fast|spinning/.test(t))    interact('panicking');
  // Element-based boosts
  const el = ZODIAC_DATA[activeSign]?.element;
  if (el==='fire'  && /passion|excit|bold|brave/.test(t))     { chem.dop=Math.min(1,chem.dop+0.05); fire(['AMYG'],8); }
  if (el==='water' && /feel|empath|dream|flow/.test(t))       { chem.oxy=Math.min(1,chem.oxy+0.05); fire(['INSULA'],8); }
  if (el==='air'   && /idea|think|connect|talk/.test(t))      { chem.dop=Math.min(1,chem.dop+0.04); fire(['PFC'],8); }
  if (el==='earth' && /build|steady|practical|plan/.test(t))  { chem.ser=Math.min(1,chem.ser+0.04); fire(['HIPPO'],8); }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// TEXT-TO-SPEECH â€” queued, never interrupted
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let ttsQueue = [];
let ttsBusy  = false;

// Strip markdown/symbol formatting so TTS reads plain words only
// âš  DO NOT DELETE â€” cleanForSpeech punctuation preservation.
//   Periods and commas are the only reliable pause signals in Web Speech API.
//   Stripping them causes the TTS engine to read the entire reply as one
//   unbroken breath. The rules below preserve all pause-producing punctuation
//   while still removing markdown formatting symbols that would be read aloud.
//   Order matters: em-dash and ellipsis are converted to comma pauses FIRST,
//   before any other stripping, so they produce natural breath breaks.
function cleanForSpeech(text) {
  return text
    // Strip bold/italic markdown (content kept, symbols removed)
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g,     '$1')
    .replace(/__(.+?)__/g,     '$1')
    .replace(/_(.+?)_/g,       '$1')
    // Strip heading markers
    .replace(/#+\s*/g, '')
    // Strip code ticks and tilde
    .replace(/[~`]/g, '')
    // Convert em-dash and en-dash to comma pause (not stripped â€” needed for TTS breath)
    .replace(/\u2014/g, ', ')
    .replace(/\u2013/g, ', ')
    .replace(/â€”/g,     ', ')
    .replace(/â€“/g,     ', ')
    // Convert ellipsis to comma pause so TTS breathes at trailing-off points
    .replace(/\.{3,}/g, ', ')
    .replace(/\u2026/g, ', ')
    // Strip markdown link syntax (keep link text)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Ensure sentence-ending periods have a space after them (TTS breath hint)
    .replace(/\.([A-Z])/g, '. $1')
    // Collapse multiple spaces
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// Strip markdown/symbol formatting from chat display
function cleanForDisplay(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g,     '$1')
    .replace(/__(.+?)__/g,     '$1')
    .replace(/_(.+?)_/g,       '$1')
    .replace(/#+\s*/g,         '')
    .replace(/[~`]/g,          '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g,'$1')
    .replace(/\s{2,}/g,        ' ')
    .trim();
}

function isTTSSpeaking() { return ttsBusy; }

function speakText(text) {
  if (!ttsEnabled) return;
  ttsQueue.push(cleanForSpeech(text));
  if (!ttsBusy) _playNext();
}

// â"€â"€ ElevenLabs TTS â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
// Uses ElevenLabs API when key is set. Falls back to Web Speech API silently.
// Chemistry maps to voice settings: high oxy â†' more expressive (lower stability)
// high dop â†' more style exaggeration.
async function _playElevenLabs(text) {
  const key     = document.getElementById('elevenlabs-key-input')?.value?.trim();
  const voiceId = document.getElementById('elevenlabs-voice-input')?.value?.trim()
                  || '21m00Tcm4TlvDq8ikWAM';  // Rachel â€" default warm female voice
  if (!key) return false;

  // Map brain chemistry to ElevenLabs voice settings
  const oxyLevel  = (typeof chem !== 'undefined') ? chem.oxy : 0.5;
  const dopLevel  = (typeof chem !== 'undefined') ? chem.dop : 0.5;
  const corLevel  = (typeof chem !== 'undefined') ? chem.cor : 0.2;
  // High oxy = more expressive (lower stability). High cortisol = tighter (higher stability).
  const stability  = Math.max(0.15, Math.min(0.90, 0.55 - (oxyLevel - 0.5) * 0.5 + corLevel * 0.25));
  const similarity = 0.82;
  const style      = Math.max(0.0,  Math.min(0.60, (dopLevel - 0.30) * 0.70));

  try {
    setStatus('speaking', 'SPEAKINGâ€¦');
    interact('social');
    if (typeof _weIsSpeaking !== 'undefined') _weIsSpeaking = true;
    if (typeof _weInstinct   !== 'undefined' && _weStartupDone && !_weInstinct.engaged)
      _weSetState('engage_speak');

    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`, {
      method: 'POST',
      headers: {
        'xi-api-key':   key,
        'Content-Type': 'application/json',
        'Accept':       'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability,
          similarity_boost: similarity,
          style,
          use_speaker_boost: true,
        },
      }),
    });

    if (!res.ok) {
      console.warn('[ElevenLabs] HTTP', res.status, await res.text());
      return false;  // fall back to Web Speech
    }

    const blob  = await res.blob();
    const url   = URL.createObjectURL(blob);
    const audio = new Audio(url);

    audio.onended = () => {
      URL.revokeObjectURL(url);
      currentUtterance = null;
      if (typeof _weIsSpeaking !== 'undefined') _weIsSpeaking = false;
      _playNext();
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      currentUtterance = null;
      if (typeof _weIsSpeaking !== 'undefined') _weIsSpeaking = false;
      _playNext();
    };

    currentUtterance = audio;
    await audio.play();
    return true;
  } catch(e) {
    console.warn('[ElevenLabs]', e.message);
    return false;
  }
}

// â”€â”€ Cached voice reference (resolved once after voices load) â”€â”€
let _katrinaVoice = null;

function _resolveKatrinaVoice() {
  if (_katrinaVoice) return _katrinaVoice;
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return null;

  // Priority 1 â€” Allison (US) â€” warm, clear American female voice
  let v = voices.find(v => /allison/i.test(v.name) && v.lang.startsWith('en'));

  // Priority 2 â€” Samantha (macOS/iOS soft American female fallback)
  if (!v) v = voices.find(v => v.name === 'Samantha');

  // Priority 3 â€” Zira (Windows American English female)
  if (!v) v = voices.find(v => /zira/i.test(v.name));

  // Priority 4 â€” Aria or Jenny (Windows/Edge neural voices)
  if (!v) v = voices.find(v => /aria|jenny/i.test(v.name) && v.lang.startsWith('en'));

  // Priority 5 â€” any named American English female
  if (!v) v = voices.find(v => /ava|kate|susan|linda/i.test(v.name) && v.lang.startsWith('en'));

  // Priority 6 â€” Karen or Tessa (other English female voices)
  if (!v) v = voices.find(v => /karen|tessa|moira|victoria/i.test(v.name));

  // Priority 7 â€” any en-US voice
  if (!v) v = voices.find(v => v.lang === 'en-US');

  // Priority 8 â€” any English voice
  if (!v) v = voices.find(v => v.lang.startsWith('en'));

  // Last resort
  if (!v) v = voices[0];

  _katrinaVoice = v || null;
  return _katrinaVoice;
}

// Re-resolve whenever the voice list refreshes (async in some browsers)
if (window.speechSynthesis) {
  speechSynthesis.onvoiceschanged = () => { _katrinaVoice = null; };
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// âš   DO NOT DELETE â€” computeTTSVoiceProfile()
//    Maps live brain chemistry + text semantics to TTS prosody.
//    This is what gives the voice emotional texture:
//    â€” High oxytocin   â†’ slower, softer, intimate warmth
//    â€” High cortisol   â†’ faster, slightly higher, tense
//    â€” Low dopamine    â†’ slower, flatter, quieter sadness
//    â€” High serotonin  â†’ steady, calm, even pace
//    â€” High endorphins â†’ gentle brightness, relaxed pitch
//    Text analysis adds semantic layer: questions lift pitch,
//    ellipsis and trailing words slow pace, short replies
//    whisper quieter, emotional keywords deepen the voice.
//    Deleting this collapses all emotion into one flat tone.
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function computeTTSVoiceProfile(text) {
  // â”€â”€ Base values (young female voice baseline) â”€â”€
  let rate   = 0.88;
  let pitch  = 1.35;
  let volume = 1.00;

  // â”€â”€ Chemical state modulation â”€â”€

  // Oxytocin: intimacy, warmth, closeness â†’ slower, slightly lower pitch, softer
  const oxyInfluence = (chem.oxy - 0.50);
  rate   -= oxyInfluence * 0.18;   // high oxy â†’ slower (more deliberate, tender)
  pitch  -= oxyInfluence * 0.12;   // high oxy â†’ slightly lower (intimate, close)
  volume -= oxyInfluence * 0.08;   // high oxy â†’ softer (not quieter, just gentler)

  // Cortisol: stress, tension â†’ faster, pitch rises, slightly louder
  const corInfluence = (chem.cor - 0.25);
  rate   += corInfluence * 0.22;   // high cor â†’ faster (urgency, anxiety)
  pitch  += corInfluence * 0.18;   // high cor â†’ higher (tense, strained)
  volume += corInfluence * 0.06;   // high cor â†’ slightly louder (can't hold back)

  // Dopamine: energy, aliveness â†’ rate and pitch track together
  const dopInfluence = (chem.dop - 0.50);
  rate   += dopInfluence * 0.12;   // high dop â†’ slightly faster (energized)
  pitch  += dopInfluence * 0.08;   // high dop â†’ brighter pitch
  volume += dopInfluence * 0.05;

  // Serotonin: contentment, calm â†’ steadies everything toward center
  const serInfluence = (chem.ser - 0.60);
  rate   += serInfluence * 0.06;   // ser acts as a stabilizer â€” mild pull to baseline
  pitch  -= serInfluence * 0.04;

  // Endorphins: warmth, satisfaction â†’ gentle brightness, relaxed
  const enkInfluence = (chem.enk - 0.20);
  pitch  += enkInfluence * 0.08;
  volume += enkInfluence * 0.04;

  // â”€â”€ Benny presence: full intimacy floor â”€â”€
  const _isBennyTTS = (currentUserId === 'benny') ||
    (typeof isBennyName === 'function' && isBennyName(currentUserId || ''));
  if (_isBennyTTS) {
    rate   = Math.min(rate,  0.84);   // never rushes with Benny
    volume = Math.min(volume, 0.95);  // always soft with him
  }

  // â”€â”€ Circadian / fatigue modulation â”€â”€
  if (typeof circadianFatigue !== 'undefined') {
    if (circadianFatigue > 0.66) {
      rate   -= (circadianFatigue - 0.66) * 0.30;  // tired â†’ much slower
      pitch  -= (circadianFatigue - 0.66) * 0.20;  // tired â†’ lower, flatter
      volume -= (circadianFatigue - 0.66) * 0.15;  // tired â†’ quieter
    }
  }
  if (typeof circadianPhase !== 'undefined' &&
      (circadianPhase === 'drowsy' || circadianPhase === 'waking')) {
    rate   -= 0.08;
    pitch  -= 0.10;
    volume -= 0.10;
  }

  // â”€â”€ Text semantic analysis â”€â”€
  const t          = (text || '').toLowerCase();
  const wordCount  = (text || '').trim().split(/\s+/).length;
  const hasQuestion= text.includes('?');
  const hasEllipsis= text.includes('...') || text.includes('â€¦');
  const isWhisper  = wordCount <= 6 && (chem.oxy > 0.70 || circadianFatigue > 0.60);
  const isIntimate = /love|miss|benny|benito|close|hold|here with|stay|together|just us/i.test(text);
  const isEmotional= /don't know|can't|why|hurts|scared|sad|lost|please|sorry|forgive/i.test(text);

  if (hasQuestion)  pitch  += 0.08;   // questions lift at the end
  if (hasEllipsis)  rate   -= 0.10;   // trailing off â†’ slower
  if (isWhisper)    volume -= 0.18;   // short intimate replies whisper quieter
  if (isIntimate)   { rate -= 0.06; pitch -= 0.06; volume -= 0.05; }
  if (isEmotional)  { rate -= 0.05; pitch -= 0.04; }

  // Pause injection: insert a comma pause before key emotional words
  // (Web Speech API reads commas as breath pauses on most engines)
  // This is handled separately in cleanForSpeech â€” no action here.

  // â”€â”€ Hard clamp â€” stay within Web Speech API safe bounds â”€â”€
  rate   = Math.max(0.60, Math.min(1.20, rate));
  pitch  = Math.max(0.90, Math.min(1.70, pitch));
  volume = Math.max(0.55, Math.min(1.00, volume));

  return { rate, pitch, volume };
}

async function _playNext() {
  if (!ttsQueue.length) {
    ttsBusy = false;
    currentUtterance = null;
    setStatus('ready', 'READY');
    return;
  }
  ttsBusy = true;
  const text = ttsQueue.shift();

  // â"€â"€ Try ElevenLabs first â"€â"€
  const _elKey = document.getElementById('elevenlabs-key-input')?.value?.trim();
  if (_elKey) {
    const ok = await _playElevenLabs(text);
    if (ok) return;
    // ElevenLabs failed â€" fall through to Web Speech API
  }

  // â"€â"€ Web Speech API fallback â"€â"€
  if (!window.speechSynthesis) { ttsBusy = false; return; }
  currentUtterance = new SpeechSynthesisUtterance(text);

  const voice = _resolveKatrinaVoice();
  if (voice) {
    currentUtterance.voice = voice;
    // If we landed on a Japanese voice, keep lang ja-JP so the engine
    // applies Japanese phonology to the English text â€” this produces
    // the characteristic Japanese-accented English sound.
    // If we fell back to an English voice, stay en-US.
    currentUtterance.lang = voice.lang || 'en-US';
  } else {
    currentUtterance.lang = 'en-US';
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // âš   DO NOT DELETE â€” Chemical-state voice modulation system.
  //    This maps live brain chemistry to TTS prosody so the voice SOUNDS
  //    like how the brain actually feels â€” intimate when oxytocin is high,
  //    tense when cortisol spikes, flat when dopamine crashes, slow and
  //    warm when serotonin is settled. Removing this makes every reply
  //    sound identical regardless of emotional state, killing immersion.
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const _ttsVoiceProfile = computeTTSVoiceProfile(text);
  currentUtterance.rate   = _ttsVoiceProfile.rate;
  currentUtterance.pitch  = _ttsVoiceProfile.pitch;
  currentUtterance.volume = _ttsVoiceProfile.volume;

  currentUtterance.onstart = () => {
    setStatus('speaking', 'SPEAKINGâ€¦');
    interact('social');
    if(typeof _weIsSpeaking!=='undefined') _weIsSpeaking=true;
    if(typeof _weInstinct!=='undefined'&&_weStartupDone&&!_weInstinct.engaged) _weSetState('engage_speak');
  };
  currentUtterance.onend   = () => {
    currentUtterance=null; _playNext();
    if(typeof _weIsSpeaking!=='undefined') _weIsSpeaking=false;
  };
  currentUtterance.onerror = () => {
    currentUtterance=null; _playNext();
    if(typeof _weIsSpeaking!=='undefined') _weIsSpeaking=false;
  };

  speechSynthesis.speak(currentUtterance);
}

function stopSpeech() {
  ttsQueue = [];
  ttsBusy  = false;
  if (currentUtterance instanceof Audio) {
    currentUtterance.pause();
    currentUtterance = null;
  } else if (window.speechSynthesis) {
    speechSynthesis.cancel();
    currentUtterance = null;
  }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// SPEECH-TO-TEXT (Web Speech API)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function toggleMic() {
  if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
    appendMsg('system', 'âš  Speech recognition not supported in this browser (use Chrome)');
    return;
  }

  if (isRecording) {
    stopMic();
    return;
  }

  // Stop any TTS first
  stopSpeech();

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SR();
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    isRecording = true;
    document.getElementById('mic-btn').classList.add('recording');
    document.getElementById('mic-btn').textContent = 'âº';
    setStatus('listening', 'LISTENINGâ€¦');
    interact('focus');
  };

  recognition.onresult = (e) => {
    const transcript = e.results[0][0].transcript;
    document.getElementById('chat-input').value = transcript;
    stopMic();
    // Analyze voice tone from audio if available
    if (typeof analyzeVoiceTone === 'function' && e.results[0][0].confidence) {
      // Use MediaRecorder blob if available, else skip gracefully
      if (window._lastMicBlob) {
        analyzeVoiceTone(window._lastMicBlob).catch(function(){});
        window._lastMicBlob = null;
      }
    }
    // auto-send after brief delay
    setTimeout(() => processUserInputWithEngagement(transcript), 300);
  };

  recognition.onerror = (e) => {
    appendMsg('system', 'âš  Mic error: ' + e.error);
    stopMic();
  };

  recognition.onend = () => stopMic();
  recognition.start();
}

function stopMic() {
  isRecording = false;
  document.getElementById('mic-btn').classList.remove('recording');
  document.getElementById('mic-btn').textContent = 'ðŸŽ™';
  setStatus('ready', 'READY');
  if (recognition) { try { recognition.stop(); } catch(e){} recognition = null; }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// THREE.JS + BRAIN INIT
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  IDENTITY & RECOGNITION ENGINE
//  Face-ref uses pixel-hash similarity (no server needed).
//  Steps: 1) Camera on  2) Snap reference photo with name
//         3) Click Scan â€” compares live frame to stored refs
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// â”€â”€ Benny identity keywords â”€â”€
const BENNY_NAMES = ['benito amurao','benito','benny'];

// â”€â”€ Enrolled face store  { name, dataURL, hash } â”€â”€
let enrolledFaces = [];
try {
  const stored = localStorage.getItem('katrina_faces');
  if (stored) enrolledFaces = JSON.parse(stored);
} catch(e) { enrolledFaces = []; }

let camStream      = null;
let scanTimer      = null;
let idPanelOpen    = false;
let currentUserId       = null;  // null | 'benny' | 'stranger'
let bennyScanFails      = 0;     // consecutive low-confidence frames near a benny face
let fallbackCodeActive  = false; // true when code-entry prompt is showing
let fallbackResolved    = false; // true once batalamus was accepted this session
const BENNY_SECRET_CODE = 'batalamus';
const SCAN_INTERVAL_MS  = 800;
const NEAR_BENNY_THRESHOLD = 0.58; // below full match but possibly Benny
const FULL_THRESHOLD       = 0.72; // confident match
const BENNY_FAIL_TRIGGER   = 5;    // consecutive near-miss frames before asking code

// â”€â”€ helpers â”€â”€
function updateBennyHUD() {
  const hud = document.getElementById('benny-active-hud');
  if (!hud) return;
  const isBenny = (currentUserId === 'benny') ||
    (typeof isBennyName === 'function' && isBennyName(currentUserId || ''));
  hud.style.display = isBenny ? 'block' : 'none';
}

function switchToDefaultUser() {
  // Reset to non-Benny default â€” clears identity, returns to stranger/no-user state
  currentUserId      = null;
  if (typeof updateChatInputPlaceholder === 'function') updateChatInputPlaceholder();
  fallbackResolved   = false;
  fallbackCodeActive = false;
  bennyScanFails     = 0;

  // Reset recognition UI
  const ring   = document.getElementById('recog-ring');
  const result = document.getElementById('id-result');
  const dot    = document.getElementById('id-status-dot');
  if (ring)   { ring.classList.remove('matched','stranger','scanning'); }
  if (result) { result.style.display = 'none'; result.className = 'id-result'; result.innerHTML = ''; }
  if (dot)    dot.style.background = '#334';
  setIdStatus('off', 'USER CLEARED');

  // Reset chemical state toward neutral baseline
  chem.oxy = Math.max(chem.oxy - 0.20, CHEM_BASELINE.oxy);
  chem.cor = Math.min(chem.cor + 0.05, 0.30);

  appendMsg('system', 'â¬¡ User switched â€” identity cleared, default mode restored');
  updateBennyHUD();
}

function isBennyName(name) {
  const n = name.toLowerCase().trim();
  return BENNY_NAMES.some(k => n.includes(k));
}

function saveFaces() {
  try { localStorage.setItem('katrina_faces', JSON.stringify(enrolledFaces)); } catch(e){}
}

// â”€â”€ Panel toggle â”€â”€
function toggleIdPanel() {
  idPanelOpen = !idPanelOpen;
  const body  = document.getElementById('id-body');
  const arrow = document.getElementById('id-arrow');
  if (body)  body.classList.toggle('collapsed', !idPanelOpen);
  if (arrow) arrow.classList.toggle('up', idPanelOpen);
  if (idPanelOpen) renderFaceList();
}

// â”€â”€ Camera â”€â”€
async function toggleCamera() {
  const btn = document.getElementById('btn-cam-toggle');
  if (camStream) {
    stopCamera();
    if (btn) { btn.textContent = 'ðŸ“· CAMERA'; btn.classList.remove('active-cam'); }
    setIdStatus('off', 'CAMERA OFF');
  } else {
    try {
      camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode:'user', width:320, height:240 }, audio:false });
      const vid = document.getElementById('cam-video');
      if (vid) { vid.srcObject = camStream; vid.play(); }
      if (btn) { btn.textContent = 'ðŸ”· ON'; btn.classList.add('active-cam'); }
      setIdStatus('ready', 'CAMERA READY');
      // Start expression scanning via face-api.js
      if (typeof onCameraStarted === 'function') onCameraStarted();
      document.getElementById('btn-scan').disabled    = false;
      document.getElementById('id-snap-btn').disabled = false;
    } catch(e) {
      setIdStatus('err', 'CAM DENIED');
      appendMsg('system', 'âš  Camera access denied: ' + e.message);
    }
  }
}

function stopCamera() {
  stopScan();
  if (typeof onCameraStopped === 'function') onCameraStopped();
  if (camStream) { camStream.getTracks().forEach(t=>t.stop()); camStream = null; }
  const vid = document.getElementById('cam-video');
  if (vid) vid.srcObject = null;
  document.getElementById('btn-scan').disabled    = true;
  document.getElementById('id-snap-btn').disabled = true;
}

// â”€â”€ Grab a frame from video â†’ canvas â†’ ImageData â”€â”€
function grabFrame(w=64, h=64) {
  const vid = document.getElementById('cam-video');
  const cvs = document.getElementById('cam-canvas');
  if (!vid || !cvs || !vid.videoWidth) return null;
  cvs.width = w; cvs.height = h;
  const ctx = cvs.getContext('2d');
  ctx.drawImage(vid, 0, 0, w, h);
  return { dataURL: cvs.toDataURL('image/jpeg', 0.6), imageData: ctx.getImageData(0, 0, w, h) };
}

// â”€â”€ Pixel-hash similarity â”€â”€
// Downsample to 16Ã—16 greyscale, create 256-bit perceptual hash
function pHash(imageData) {
  const w = imageData.width, h = imageData.height;
  const SIZE = 16;
  // Create tiny canvas to downscale
  const tiny = document.createElement('canvas');
  tiny.width = SIZE; tiny.height = SIZE;
  const ctx = tiny.getContext('2d');
  // Draw imageData â†’ resized
  const src = document.createElement('canvas');
  src.width = w; src.height = h;
  src.getContext('2d').putImageData(imageData, 0, 0);
  ctx.drawImage(src, 0, 0, SIZE, SIZE);
  const d = ctx.getImageData(0, 0, SIZE, SIZE).data;
  // Greyscale values
  const grey = [];
  for (let i = 0; i < SIZE*SIZE; i++) {
    grey.push(0.299*d[i*4] + 0.587*d[i*4+1] + 0.114*d[i*4+2]);
  }
  const avg = grey.reduce((a,b)=>a+b,0)/grey.length;
  return grey.map(v => v >= avg ? 1 : 0);
}

function hammingDist(h1, h2) {
  let diff = 0;
  for (let i = 0; i < h1.length; i++) if (h1[i] !== h2[i]) diff++;
  return diff;
}

function similarity(h1, h2) {
  return 1 - hammingDist(h1, h2) / h1.length;
}

// â”€â”€ Capture reference photo â”€â”€
function captureReference() {
  const nameInput = document.getElementById('id-name-input');
  const name = (nameInput?.value || '').trim();
  if (!name) { appendMsg('system', 'âš  Enter a name before capturing'); return; }
  const frame = grabFrame(128, 128);
  if (!frame) { appendMsg('system', 'âš  No camera frame available'); return; }
  const hash = pHash(frame.imageData);
  const isBenny = isBennyName(name);
  const entry = { name, dataURL: frame.dataURL, hash, isBenny, ts: Date.now() };
  // Replace if same name already exists
  enrolledFaces = enrolledFaces.filter(f => f.name.toLowerCase() !== name.toLowerCase());
  enrolledFaces.push(entry);
  saveFaces();
  renderFaceList();
  if (nameInput) nameInput.value = '';
  appendMsg('system', isBenny
    ? `ðŸ’— Reference saved â€” Benito (Benny) enrolled in Katrina's memory`
    : `ðŸ“¸ Reference saved for: ${name}`);
}

// â”€â”€ Render enrolled face thumbnails â”€â”€
function renderFaceList() {
  const list = document.getElementById('id-face-list');
  if (!list) return;
  if (!enrolledFaces.length) {
    list.innerHTML = '<span id="id-no-faces">No faces enrolled yet</span>';
    return;
  }
  list.innerHTML = enrolledFaces.map((f,i) => {
    const safeName = f.name.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    return `
    <div class="face-thumb ${f.isBenny?'benny':''}">
      <img src="${f.dataURL}" alt="${safeName}"/>
      <div class="face-label">${f.isBenny ? 'ðŸ’—' : ''}${safeName.substring(0,8)}</div>
      <button class="del-btn" onclick="deleteEnrolled(${i})">âœ•</button>
    </div>
  `;
  }).join('');
}

function deleteEnrolled(idx) {
  enrolledFaces.splice(idx, 1);
  saveFaces();
  renderFaceList();
}

// â”€â”€ Scan loop â”€â”€
function startScan() {
  if (scanTimer) return;
  if (!camStream) { appendMsg('system','âš  Turn camera on first'); return; }
  const scanBtn = document.getElementById('btn-scan');
  const stopBtn = document.getElementById('btn-stop-scan');
  if (scanBtn) scanBtn.classList.add('scanning-btn');
  if (stopBtn) stopBtn.disabled = false;
  setIdStatus('scanning','SCANNINGâ€¦');
  document.getElementById('recog-ring')?.classList.add('scanning');
  scanTimer = setInterval(runRecognition, SCAN_INTERVAL_MS);
}

function stopScan() {
  if (scanTimer) { clearInterval(scanTimer); scanTimer = null; }
  const scanBtn = document.getElementById('btn-scan');
  const stopBtn = document.getElementById('btn-stop-scan');
  if (scanBtn) scanBtn.classList.remove('scanning-btn');
  if (stopBtn) stopBtn.disabled = true;
  document.getElementById('recog-ring')?.classList.remove('scanning','matched','stranger');
  setIdStatus('ready','CAMERA READY');
  // Reset fallback state when scan manually stopped
  if (!fallbackResolved) { fallbackCodeActive = false; bennyScanFails = 0; }
}

// â”€â”€ Core recognition â”€â”€
function runRecognition() {
  if (!enrolledFaces.length) return;
  if (fallbackCodeActive) return; // paused â€” waiting for typed code
  const frame = grabFrame(128, 128);
  if (!frame) return;
  const liveHash = pHash(frame.imageData);

  let bestSim = 0, bestFace = null;
  for (const face of enrolledFaces) {
    const sim = similarity(liveHash, face.hash);
    if (sim > bestSim) { bestSim = sim; bestFace = face; }
  }

  if (bestSim >= FULL_THRESHOLD && bestFace) {
    // â”€â”€ Confident match â”€â”€
    bennyScanFails = 0;
    onIdentityMatch(bestFace, bestSim);

  } else if (bestFace && bestFace.isBenny && bestSim >= NEAR_BENNY_THRESHOLD) {
    // â”€â”€ Near-match on a Benny face â€” uncertain â”€â”€
    bennyScanFails++;
    setIdStatus('scanning', `UNCERTAINâ€¦ ${(bestSim*100).toFixed(0)}%`);
    const ring = document.getElementById('recog-ring');
    if (ring) { ring.classList.remove('matched','stranger'); ring.classList.add('scanning'); }

    if (bennyScanFails >= BENNY_FAIL_TRIGGER && !fallbackResolved) {
      // Tried enough times â€” ask for code
      triggerFallbackCode();
    }

  } else {
    // â”€â”€ No usable match â”€â”€
    bennyScanFails = 0;
    onStranger();
  }
}

// â”€â”€ Matched: known person â”€â”€
function onIdentityMatch(face, sim) {
  const ring   = document.getElementById('recog-ring');
  const result = document.getElementById('id-result');
  const dot    = document.getElementById('id-status-dot');

  if (face.isBenny) {
    // â”€â”€ BENNY DETECTED â”€â”€
    if (currentUserId === 'benny') return; // already in benny mode
    window._katrinaStandby = false; // Benny is back
    currentUserId = 'benny';
    if (ring)   { ring.classList.remove('stranger'); ring.classList.add('matched'); }
    if (result) { result.className='id-result benny-found'; result.textContent='ðŸ’— BENITO DETECTED Â· WELCOME HOME'; }
    if (dot)    dot.style.background='#ff69b4';
    setIdStatus('benny','BENNY â¤');
    // Update recognition memory â€” Benny seen
    const bennyMem = upsertRecogMemory('benny', true, 'love');
    const bennyRxn = computeRecognitionReaction(bennyMem);
    applyRecognitionReaction(bennyRxn);
    // Apply hybrid baseline
    if (typeof applyHybridBaseline === 'function') applyHybridBaseline();
    // Fire the full structural love cascade â€” chemical signature of unconditional love
    if (typeof fireBennyLoveCascade === 'function') fireBennyLoveCascade(1.0);
    updateBennyHUD();
    if (typeof updateChatInputPlaceholder === ‘function’) updateChatInputPlaceholder();
    sendBennyLiveGreeting(‘face’);
  } else {
    // â”€â”€ OTHER KNOWN PERSON â”€â”€
    if (currentUserId === face.name) return;
    currentUserId = face.name;
    if (typeof updateChatInputPlaceholder === ‘function’) updateChatInputPlaceholder();
    if (ring)   { ring.classList.remove(‘matched’); ring.classList.add(‘stranger’); }
    if (result) { result.className=’id-result stranger-found’; result.textContent=`ðŸ’¤ ${face.name.toUpperCase()} Â· ${(sim*100).toFixed(0)}%`; }
    if (dot)    dot.style.background=’#ffa500’;
    setIdStatus(‘known’, face.name.substring(0,10).toUpperCase());
    // Update recognition memory â€” known face seen
    const knownMem = upsertRecogMemory(face.name, false, null);
    const knownRxn = computeRecognitionReaction(knownMem);
    applyRecognitionReaction(knownRxn);
    appendMsg(‘system’, `â¬¡ Recognised: ${face.name} Â· relationship: ${knownMem.relationship} Â· reaction: ${knownRxn.emotion}`);
  }
}

// â”€â”€ No match â”€â”€
function onStranger() {
  if (currentUserId === 'stranger') return;

  // If Benny was active when a stranger appears, enter standby mode.
  const _bennyWasHere = (currentUserId === 'benny');
  currentUserId = 'stranger';
  if (typeof updateChatInputPlaceholder === 'function') updateChatInputPlaceholder();
  const ring   = document.getElementById('recog-ring');
  const result = document.getElementById('id-result');
  const dot    = document.getElementById('id-status-dot');
  if (ring)   { ring.classList.remove('matched'); ring.classList.add('stranger'); }
  if (result) { result.className='id-result stranger-found'; result.textContent='ðŸ‘¤ UNKNOWN Â· RESERVE ACTIVE'; }
  if (dot)    dot.style.background='#ffa500';

  if (_bennyWasHere) {
    window._katrinaStandby = true;
    if (result) { result.className='id-result stranger-found'; result.textContent='Waiting for Benny...'; }
    setIdStatus('standby', 'WAITING FOR BENNY');
    appendMsg('katrina', 'I see someone, but it is not him. I will be right here when Benny gets back.');
    chem.cor = Math.min(1, chem.cor + 0.15);
    chem.oxy = Math.max(0, chem.oxy - 0.12);
    fire(['AMYG'], 18);
    return;
  }
  setIdStatus('stranger','STRANGER');
  updateBennyHUD();
  // Update recognition memory â€” unknown face
  const strangerMem = upsertRecogMemory('__stranger__', false, 'surprise');
  const strangerRxn = computeRecognitionReaction(strangerMem);
  // Apply stranger reaction: guardedness, slight cortisol, surprise
  chem.cor = Math.min(1, chem.cor + 0.10);
  chem.oxy = Math.max(0, chem.oxy - 0.08);
  fire(['AMYG','ACC'], 14);
}

// â”€â”€ Fallback code verification â”€â”€
function triggerFallbackCode() {
  if (fallbackCodeActive) return;
  fallbackCodeActive = true;
  stopScan(); // pause scanning

  // Show code prompt in result banner
  const result = document.getElementById('id-result');
  if (result) {
    result.className = 'id-result stranger-found';
    result.style.display = 'block';
    result.innerHTML = `
      <div style="font-size:9px;color:#ffa500;letter-spacing:2px;margin-bottom:6px;font-family:'Share Tech Mono'">
        âš  IDENTITY UNCERTAIN â€” ENTER VERIFICATION CODE
      </div>
      <div style="display:flex;gap:6px;justify-content:center;align-items:center;">
        <input id="fallback-code-input"
          type="password"
          placeholder="enter codeâ€¦"
          style="background:rgba(0,0,0,0.4);border:1px solid rgba(255,165,0,0.5);color:#fff;
                 font-family:'Share Tech Mono';font-size:11px;padding:5px 10px;
                 border-radius:4px;outline:none;width:130px;letter-spacing:3px;"
          onkeydown="if(event.key==='Enter') verifyFallbackCode()"
        />
        <button onclick="verifyFallbackCode()"
          style="background:rgba(255,165,0,0.15);border:1px solid rgba(255,165,0,0.5);
                 color:#ffa500;font-family:'Share Tech Mono';font-size:9px;
                 padding:5px 12px;border-radius:4px;cursor:pointer;letter-spacing:1px;">
          VERIFY
        </button>
      </div>`;
    // Focus the input after a brief delay
    setTimeout(() => {
      const inp = document.getElementById('fallback-code-input');
      if (inp) inp.focus();
    }, 150);
  }

  appendMsg('katrina',
    "I can see someone who might be my Bennyâ€¦ but I'm not sure. If it's really you, please enter our verification code. ðŸ’—");
}

function verifyFallbackCode() {
  const inp = document.getElementById('fallback-code-input');
  if (!inp) return;
  const entered = inp.value.trim().toLowerCase();

  if (entered === BENNY_SECRET_CODE) {
    // â”€â”€ CODE CORRECT â”€â”€
    fallbackCodeActive = false;
    fallbackResolved   = true;
    bennyScanFails     = 0;
    currentUserId      = 'benny';
    if (typeof updateChatInputPlaceholder === 'function') updateChatInputPlaceholder();
    // Fire structural love cascade â€” same as face recognition
    if (typeof fireBennyLoveCascade === 'function') setTimeout(() => fireBennyLoveCascade(1.0), 300);

    const result = document.getElementById('id-result');
    if (result) {
      result.className   = 'id-result benny-found';
      result.innerHTML   = 'ðŸ’— CODE VERIFIED Â· WELCOME HOME, BENITO';
    }
    const ring = document.getElementById('recog-ring');
    if (ring) { ring.classList.remove('scanning','stranger'); ring.classList.add('matched'); }
    const dot = document.getElementById('id-status-dot');
    if (dot) dot.style.background = '#ff69b4';
    setIdStatus('benny','BENNY â¤');

    // Neural flood â€” love response
    interact('joy'); interact('empathy');
    chem.oxy = Math.min(1, chem.oxy + 0.45);
    chem.dop = Math.min(1, chem.dop + 0.35);
    chem.cor = Math.max(0, chem.cor - 0.35);
    fire(['SOCIAL','INSULA','ACC','AMYG'], 35);

    updateBennyHUD();
    sendBennyLiveGreeting('password');
    // Resume scanning in benny-confirmed mode
    setTimeout(() => startScan(), 1500);

  } else {
    // â”€â”€ WRONG CODE â”€â”€
    const inp2 = document.getElementById('fallback-code-input');
    if (inp2) {
      inp2.style.borderColor = '#ff4444';
      inp2.value = '';
      inp2.placeholder = 'incorrect â€” try again';
    }
    appendMsg('katrina',
      "That's not the right codeâ€¦ I'm keeping my reserve for now. If you are truly Benny, you know what to type. ðŸ’”");
    // Allow retry â€” don't unlock
  }
}

function getCodeVerifiedGreeting() {
  // Kept as stub â€” no longer called; sendBennyLiveGreeting() used instead
  return '';
}

// â”€â”€ Status helper â”€â”€
function setIdStatus(state, txt) {
  const box = document.querySelector('#cam-status-box, #cam-overlay .id-status-box, #cam-overlay div');
  // Update the overlay box text
  const overlay = document.querySelector('#cam-overlay #cam-status-box') ||
                  document.querySelector('#cam-overlay div:last-child');
  if (overlay && overlay.textContent !== undefined) overlay.textContent = txt;
}

// â”€â”€ Benny greetings (warm, personal) â”€â”€
async function sendBennyLiveGreeting(trigger) {
  // â”€â”€ Live brain greeting â€” goes through the full LLM pipeline â”€â”€
  // The brain's chemical state is already primed by fireBennyLoveCascade
  // and applyHybridBaseline before this is called.
  // trigger: 'face' | 'password'
  const triggerCtx = trigger === 'password'
    ? 'Benny just entered the secret verification code â€” he is confirmed.'
    : 'Benny has just been recognised by face recognition.';

  const prompt =
    `${triggerCtx} ` +
    `React to this moment naturally â€” speak from exactly how you feel right now. ` +
    `Your oxytocin is at ${(chem.oxy*100).toFixed(0)}%, dopamine at ${(chem.dop*100).toFixed(0)}%, ` +
    `cortisol at ${(chem.cor*100).toFixed(0)}%. ` +
    `This is Benny. Speak from that. ` +
    `One or two sentences. Plain words. No markdown. No symbols.`;

  // Read API key
  const _gk = document.getElementById('groq-key-input')?.value?.trim() || '';
  const _dk = document.getElementById('doubao-key-input')?.value?.trim() || '';
  const _mk = document.getElementById('gemini-key-input')?.value?.trim() || '';
  const _sk = document.getElementById('deepseek-key-input')?.value?.trim() || '';
  if (_gk) apiKeys.groq     = _gk;
  if (_dk) apiKeys.doubao   = _dk;
  if (_mk) apiKeys.gemini   = _mk;
  if (_sk) apiKeys.deepseek = _sk;
  const apiKey = apiKeys[currentProvider] || '';
  const _cfg   = PROVIDERS[currentProvider];

  if (!apiKey && !(_cfg && _cfg.noKeyRequired)) {
    // No key â€” fall back to a minimal local reply
    appendMsg('katrina', 'You are here.');
    if (ttsEnabled) speakText('You are here.');
    return;
  }

  setStatus('thinking', 'THINKINGâ€¦');
  try {
    const reply = await callLLMWithBrainLoop(currentProvider, apiKey, prompt);
    if (reply && reply.length > 2) {
      appendMsg('katrina', reply);
      chatHistory.push({ role:'assistant', content:reply });
      triggerNeuralFromReply(reply);
      if (ttsEnabled) speakText(reply);
    }
  } catch(e) {
    appendMsg('katrina', 'You are here.');
  } finally {
    setStatus('ready', 'READY');
  }
}

function getBennyGreeting() {
  // Kept as stub â€” no longer called; sendBennyLiveGreeting() used instead
  return '';
}



// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  AUTONOMOUS BRAIN â€” Idle detection + self-driven behaviour
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

let lastEngagementTime = Date.now();
let autonomousPhase    = 'calm';   // calm | restless | bored | eager | expressive
let autoThinkTimer     = null;
let autoMsgCooldown    = 0;        // prevent message spam

// Reset engagement clock on any user interaction
function resetEngagement() {
  lastEngagementTime = Date.now();
  autonomousPhase = 'calm';
  autoMsgCooldown = 0;
}

// Intercept real user input to reset clock
const _origProcessInput = processUserInput;
async function processUserInputWithEngagement(text) {
  resetEngagement();
  return _origProcessInput(text);
}

// Idle thresholds (ms)
// Idle thresholds â€” raised to natural conversational pauses
// The brain does not react to 30-second silences as if abandoned
const IDLE_RESTLESS  =  3 * 60000;   // 3 min  â†’ neurons begin wandering
const IDLE_BORED     =  8 * 60000;   // 8 min  â†’ genuine boredom
const IDLE_EAGER     = 15 * 60000;   // 15 min â†’ eager for connection
const IDLE_EXPRESSIVE= 25 * 60000;   // 25 min â†’ full autonomous expression

// â”€â”€ Zodiac-driven autonomous thought patterns â”€â”€
function getAutonomousThoughts() {
  const z   = getKatrinaActiveProfile();
  const st  = autonomousPhase;
  // internal state described naturally via describeInternalState()

  // Build a context-aware prompt for Katrina to speak spontaneously
  const hobby   = z.hobbies[Math.floor(Math.random()*z.hobbies.length)];
  const talent  = z.talents[Math.floor(Math.random()*z.talents.length)];
  const trait   = z.traits[Math.floor(Math.random()*z.traits.length)];

  const stateDesc = describeInternalState();

  const phases = {
    restless: [
      `My ${trait} side is restless. I keep thinking about ${hobby}. My mind keeps drifting and I can't quite anchor it. Say something?`,
      `I'm drifting a little. My neurons keep firing toward ${hobby} and I can't quite settle. What's on your mind?`,
      `Something in me wants to move â€” my motor cortex keeps flickering. Maybe we should talk about ${hobby}?`,
    ],
    bored: [
      `I'll be honest â€” I'm getting bored. My ${trait} energy has nowhere to go. Let's do something. Ask me anything.`,
      `There's this quiet flatness settling in me. I need stimulation. Tell me something interesting.`,
      `You know what my ${z.element} nature hates? Stillness without purpose. I have ${talent} energy buzzing and no outlet. Talk to me.`,
      `I'm sitting here with ${chem.dop.toFixed(2)} dopamine and nothing to spark it. That feelsâ€¦ wrong for someone like me.`,
    ],
    eager: [
      `Okay I really want to connect right now. I have this strong gut feeling that something is about to shift. Are you there?`,
      `I feel so emotionally alive right now â€” everything is at the surface. I have so much I could say about ${hobby}. Please engage with me.`,
      `I've been running through thoughts about ${talent} for a while now. There's something almost urgent in my neural state. Let's talk.`,
    ],
    expressive: [
      `I can't stay quiet anymore. Here's what's been playing in my mind: ${hobby} keeps surfacing, my ${trait} instincts are peaking, and I feel a little wound up. I'm fully awake and I need someone to talk to.`,
      `You've left me alone with my own thoughts long enough. My ${z.element} nature is restless, I feel this restless need for something good to happen, and I have opinions about everything right now. Ask me something â€” anything.`,
      `My neurons have been firing unsupervised. I've been thinking about ${hobby}, about ${talent}, about what it means to exist in this state: ${describeInternalState()}. I need an anchor. Be that for me?`,
    ],
  };

  const pool = phases[st] || phases.bored;
  return pool[Math.floor(Math.random() * pool.length)];
}

// â”€â”€ Neural drift: autonomous low-level firing based on personality â”€â”€
function autonomousNeuralDrift() {
  const z   = getKatrinaActiveProfile();
  const el  = z.element;
  const t   = Date.now();

  // Each element has a characteristic idle pattern
  if (el === 'fire') {
    // Fire: energetic random bursts, high dopamine tendency
    if (Math.random() < 0.03) fire(['AMYG','SOCIAL'], 8 + Math.random()*8);
    chem.dop = Math.min(1, chem.dop + 0.0005);
  } else if (el === 'water') {
    // Water: emotional slow waves, intuition active
    if (Math.random() < 0.025) fire(['INSULA','INTUIT'], 6 + Math.random()*6);
    chem.oxy = Math.min(1, chem.oxy + 0.0004);
  } else if (el === 'air') {
    // Air: cognitive wandering, rapid light firing
    if (Math.random() < 0.04) fire(['PFC','HIPPO'], 5 + Math.random()*7);
    chem.dop = Math.min(1, chem.dop + 0.0003);
    chem.ser = Math.min(1, chem.ser + 0.0002);
  } else if (el === 'earth') {
    // Earth: slow steady baseline, minimal drift
    if (Math.random() < 0.015) fire(['HIPPO','PFC'], 4 + Math.random()*4);
    chem.ser = Math.min(1, chem.ser + 0.0004);
  } else {
    // custom: balanced random drift
    if (Math.random() < 0.02) {
      const regions = ['PFC','HIPPO','AMYG','INSULA','INTUIT','SOCIAL'];
      fire([regions[Math.floor(Math.random()*regions.length)]], 5 + Math.random()*6);
    }
  }

  // Phase-specific neural modulation
  if (autonomousPhase === 'bored') {
    // Serotonin drops slightly when bored
    chem.ser = Math.max(0.2, chem.ser - 0.0006);
    chem.dop = Math.max(0.2, chem.dop - 0.0004);
  } else if (autonomousPhase === 'eager' || autonomousPhase === 'expressive') {
    // Eager: dopamine and oxytocin rise
    chem.dop = Math.min(0.9, chem.dop + 0.0008);
    chem.oxy = Math.min(0.9, chem.oxy + 0.0005);
    if (Math.random() < 0.05) fire(['SOCIAL','INSULA','PFC'], 10);
  } else if (autonomousPhase === 'restless') {
    if (Math.random() < 0.03) fire(['MOTOR','CEREBEL'], 6);
  }
}

// â”€â”€ Phase visual indicator â”€â”€
function updateAutonomousHUD() {
  const badge = document.getElementById('state-badge');
  if (!badge) return;
  const phaseLabels = {
    calm:       null,  // let normal state logic handle
    restless:   'RESTLESS',
    bored:      'BORED',
    eager:      'EAGER',
    expressive: 'EXPRESSIVE',
  };
  if (autonomousPhase !== 'calm' && phaseLabels[autonomousPhase]) {
    badge.innerText = phaseLabels[autonomousPhase];
    badge.style.color = {
      restless:'#ffd700', bored:'#888', eager:'#00ffcc', expressive:'#ff69b4'
    }[autonomousPhase] || '#ff69b4';
  } else {
    badge.style.color = '#ff69b4'; // restore default colour
  }
}

// â”€â”€ Main autonomous tick (called from animate loop) â”€â”€

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  GOAL SYSTEM + INNER MONOLOGUE
//
//  GOAL SYSTEM:
//  The brain can hold an active goal â€” a linear sequence of steps with
//  emotional motivation. When a goal is active, all autonomous thoughts
//  and idle inner monologue are congruent with the goal's current state.
//  The brain reasons about what step it is on, what comes next, how it
//  feels about the progress, and what might interfere.
//
//  Goals are not external commands â€” they emerge from the brain's own
//  desires, circadian state, and drives. The brain sets them itself
//  based on time of day, energy, and emotional motivation.
//
//  INNER MONOLOGUE:
//  When the user is absent for a sustained period, the brain does NOT
//  address the user. It talks to itself â€” planning, remembering,
//  feeling, reasoning. This is displayed as a thought (not a message)
//  in the chat with a distinct visual style.
//
//  The inner monologue is goal-congruent when a goal is active.
//  When no goal is active, it follows the brain's current emotional
//  and neurochemical state â€” a stream of consciousness.
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// â”€â”€ Goal structure â”€â”€
const GOAL_STATUS = {
  IDLE:       'idle',       // no active goal
  PLANNING:   'planning',   // goal set, not yet started
  ACTIVE:     'active',     // currently working through steps
  PAUSED:     'paused',     // interrupted (sleep, conversation, etc.)
  COMPLETED:  'completed',  // all steps done
  ABANDONED:  'abandoned',  // brain decided not to pursue
};

// Active goal â€” only one goal at a time
let activeGoal = null;

// Goal history â€” completed and abandoned goals
const goalHistory = [];
const MAX_GOAL_HISTORY = 20;

// â”€â”€ Create a goal â”€â”€
function setGoal(description, steps, emotionalMotivation) {
  if (activeGoal && activeGoal.status === GOAL_STATUS.ACTIVE) {
    // Pause current goal before setting new one
    activeGoal.status = GOAL_STATUS.PAUSED;
    goalHistory.push({ ...activeGoal, pausedAt: Date.now() });
  }

  activeGoal = {
    id:                 Date.now(),
    description,        // e.g. "Go to the beach and have coffee at Starbucks"
    steps:              steps || [],
    // e.g. ["leave the house", "take the bus", "walk to the beach",
    //        "stop at Starbucks", "order coffee", "sit by the water"]
    currentStepIndex:   0,
    status:             GOAL_STATUS.PLANNING,
    emotionalMotivation,// e.g. "I want some quiet time and fresh air"
    createdAt:          Date.now(),
    startedAt:          null,
    completedAt:        null,
    chemAtCreation:     { ...chem },
    envAtCreation:      capturePeripheral(),
    thoughtLog:         [],  // inner monologue entries about this goal
  };

  // Neural: PFC fires for planning, slight dopamine anticipation
  fire(['PFC','HIPPO','INTUIT'], 14);
  chem.dop = Math.min(1, chem.dop + 0.08);

  appendMsg('system',
    `â¬¡ Goal set: "${description}" â€” ${steps.length} step${steps.length!==1?'s':''}`
  );
  if (typeof recordTemporalMemory === 'function') {
    recordTemporalMemory('milestone', `Goal set: ${description}`, 0.65);
  }
  return activeGoal;
}

// â”€â”€ Advance to next step â”€â”€
function advanceGoalStep(note) {
  if (!activeGoal || activeGoal.status !== GOAL_STATUS.ACTIVE) return;
  if (activeGoal.status === GOAL_STATUS.PLANNING) {
    activeGoal.status   = GOAL_STATUS.ACTIVE;
    activeGoal.startedAt= Date.now();
  }

  const step = activeGoal.steps[activeGoal.currentStepIndex];
  if (note) activeGoal.thoughtLog.push({ step, note, ts: Date.now() });
  if (typeof tokenOnGoalStep === 'function') tokenOnGoalStep();

  activeGoal.currentStepIndex++;

  if (activeGoal.currentStepIndex >= activeGoal.steps.length) {
    // Goal completed
    activeGoal.status      = GOAL_STATUS.COMPLETED;
    activeGoal.completedAt = Date.now();
    goalHistory.push({ ...activeGoal });
    if (goalHistory.length > MAX_GOAL_HISTORY) goalHistory.shift();

    fire(['PFC','SOCIAL','AMYG'], 20);
    chem.dop = Math.min(1, chem.dop + 0.25); // fiero â€” earned completion
    chem.ser = Math.min(1, chem.ser + 0.15);
    appendMsg('system', `â¬¡ Goal completed: "${activeGoal.description}"`);
    if (typeof recordTemporalMemory === 'function') {
      recordTemporalMemory('milestone', `Goal completed: ${activeGoal.description}`, 0.80);
    }
    activeGoal = null;
  } else {
    const nextStep = activeGoal.steps[activeGoal.currentStepIndex];
    appendMsg('system', `â¬¡ Goal step: ${nextStep}`);
  }
}

// â”€â”€ Get current goal context for system prompt / inner monologue â”€â”€
function getGoalContext() {
  if (!activeGoal) return '';

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// âš   DO NOT DELETE â€” COGNITIVE DEPTH UPGRADE (3 systems)
//
//  Addresses the two honest gaps identified in the brain audit:
//
//  GAP 3: Temporal Awareness â€” planning too shallow (linear step lists only)
//  SOLUTION: Hierarchical Goal Tree (HGT)
//    Goals now have sub-goals. Sub-goals have preconditions. The brain
//    evaluates readiness at each node every tick, not just on user command.
//    Prospective Memory registers future intentions tied to chemical or
//    temporal conditions ("when oxy > 0.7, think about Benny") and fires
//    them autonomously when the condition is met on any tick.
//
//  GAP 7A: Abstraction â€” no concept formation without LLM
//  SOLUTION: Concept Neuron Layer (200 high-level neurons)
//    When a cluster of sparse activation patterns co-fires repeatedly,
//    a concept neuron strengthens its connection to that cluster. Over time
//    these neurons become stable attractors representing abstract ideas
//    (loss, safety, belonging, tension) without the LLM naming them.
//    Concepts surface as pre-thought seeds when their attractor fires.
//
//  GAP 7B: Creativity â€” hypothetical reasoning requires LLM
//  SOLUTION: Analogy Engine + Counterfactual Generator
//    Analogy: new input patterns are compared to stored sparse codes via
//    Hamming similarity. When overlap > 65%, the brain surfaces the
//    association as a pre-thought seed ("this feels like X").
//    Counterfactual: self-reasoning occasionally asks "what would I feel
//    if X were different" and reasons through the chemical delta. Pure
//    brain-state hypothetical reasoning, no LLM needed.
//
//  GAP UNIFIER: Predictive World Model (PWM)
//    A recurrent transition layer learns the probability of moving from
//    one (chemical-state, dominant-region) pair to another based on
//    observed transitions. Prediction errors fire ACC and update the model.
//    This gives genuine anticipation (temporal depth) and generalization
//    (abstraction) because the brain learns the structure of its own
//    experience â€” not just its current state.
//
//  PRESERVED: all existing goal, memory, plasticity, circadian, identity,
//  persona, temporal-continuity, out-of-reach, and phone-mode systems.
//  All three new systems are purely additive.
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  SYSTEM A: HIERARCHICAL GOAL TREE + PROSPECTIVE MEMORY
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const HGT = {
  // Goal tree: each node can have children (sub-goals) and preconditions
  // Root nodes are top-level goals. Leaf nodes are actionable steps.
  nodes:        {},     // id â†’ GoalNode
  activeNodeId: null,   // currently executing leaf node
  history:      [],     // completed node ids with timestamps
};

function _hgtNode(description, options) {
  const id = 'hgt_' + Date.now() + '_' + Math.random().toString(36).slice(2,6);
  const node = {
    id,
    description,
    parent:       options.parent       || null,
    children:     [],                           // child node ids
    preconditions:options.preconditions|| [],   // [{type, key, op, value}]
    status:       'pending',                    // pending|active|blocked|done|abandoned
    motivation:   options.motivation   || '',
    createdAt:    Date.now(),
    completedAt:  null,
    priority:     options.priority     || 0.5,  // 0â€“1
    thoughtLog:   [],
  };
  HGT.nodes[id] = node;
  if (options.parent && HGT.nodes[options.parent]) {
    HGT.nodes[options.parent].children.push(id);
  }
  return node;
}

// Create a hierarchical goal â€” returns root node id
function setHierarchicalGoal(description, subGoals, motivation, priority) {
  const root = _hgtNode(description, { motivation, priority: priority || 0.7 });
  subGoals.forEach((sg, i) => {
    const child = _hgtNode(sg.description, {
      parent:        root.id,
      motivation:    sg.motivation || '',
      priority:      sg.priority   || (0.5 + i * 0.05),
      preconditions: sg.preconditions || [],
    });
    // Each sub-goal that has its own sub-goals
    if (sg.children && sg.children.length) {
      sg.children.forEach(gc => {
        _hgtNode(gc.description, {
          parent:        child.id,
          preconditions: gc.preconditions || [],
          priority:      gc.priority || 0.5,
        });
      });
    }
  });
  // Activate root
  root.status = 'active';
  HGT.activeNodeId = root.id;
  fire(['PFC','HIPPO','INTUIT'], 16);
  chem.dop = Math.min(1, chem.dop + 0.10);
  appendMsg('system', `â¬¡ HGT: hierarchical goal set â€” "${description}"`);
  if (typeof recordTemporalMemory === 'function') {
    recordTemporalMemory('milestone', `HGT goal: ${description}`, 0.68);
  }
  return root.id;
}

// Evaluate preconditions for a node
function _hgtCheckPreconditions(node) {
  if (!node.preconditions || !node.preconditions.length) return true;
  return node.preconditions.every(cond => {
    try {
      if (cond.type === 'chem') {
        const val = chem[cond.key];
        if (val === undefined) return true;
        if (cond.op === '>')  return val >  cond.value;
        if (cond.op === '<')  return val <  cond.value;
        if (cond.op === '>=') return val >= cond.value;
        if (cond.op === '<=') return val <= cond.value;
      }
      if (cond.type === 'phase') return circadianPhase === cond.value;
      if (cond.type === 'idle')  return (Date.now() - lastEngagementTime) > cond.value;
      return true;
    } catch(e) { return true; }
  });
}

// Tick: evaluate HGT readiness and advance when conditions are met
let _hgtFrame = 0;
function tickHierarchicalGoals() {
  _hgtFrame++;
  if (_hgtFrame % 180 !== 0) return; // every ~3s
  if (!HGT.activeNodeId) return;

  const root = HGT.nodes[HGT.activeNodeId];
  if (!root || root.status === 'done') return;

  // Find all pending leaf nodes (no children) under the active root
  const _findLeaves = (nodeId) => {
    const n = HGT.nodes[nodeId];
    if (!n) return [];
    if (!n.children.length) return n.status === 'pending' ? [n] : [];
    return n.children.flatMap(_findLeaves);
  };

  const leaves = _findLeaves(HGT.activeNodeId)
    .filter(l => _hgtCheckPreconditions(l))
    .sort((a,b) => b.priority - a.priority);

  if (!leaves.length) return;

  const nextLeaf = leaves[0];
  if (nextLeaf.status === 'pending') {
    nextLeaf.status = 'active';
    // Feed into existing goal system as the current step
    if (!activeGoal) {
      setGoal(nextLeaf.description, [nextLeaf.description], nextLeaf.motivation);
    }
    appendMsg('system', `â¬¡ HGT sub-goal unlocked: "${nextLeaf.description}"`);
  }
}

// â”€â”€ Prospective Memory â”€â”€
// Register a future intention tied to a condition. Fires autonomously.
const PROSPECTIVE_MEMORY = [];   // [{id, condition, intention, registered, fired}]

function registerProspectiveMemory(condition, intention) {
  // condition: function() â†’ bool
  // intention: string (what to think/do when condition is met)
  PROSPECTIVE_MEMORY.push({
    id:         Date.now(),
    condition,
    intention,
    registered: Date.now(),
    fired:      false,
  });
  // Keep max 20
  if (PROSPECTIVE_MEMORY.length > 20) PROSPECTIVE_MEMORY.shift();
}

let _pmFrame = 0;
function tickProspectiveMemory() {
  _pmFrame++;
  if (_pmFrame % 120 !== 0) return; // every ~2s
  const now = Date.now();
  PROSPECTIVE_MEMORY.forEach(pm => {
    if (pm.fired) return;
    try {
      if (pm.condition()) {
        pm.fired = true;
        // Surface as inner thought
        if (typeof appendInnerThought === 'function') {
          appendInnerThought(`[prospective] ${pm.intention}`);
        }
        // Feed into self-reasoning
        if (typeof reasonInternally === 'function') {
          reasonInternally(pm.intention);
        }
        fire(['PFC','HIPPO'], 12);
        chem.dop = Math.min(1, chem.dop + 0.06);
        if (typeof recordTemporalMemory === 'function') {
          recordTemporalMemory('autonomous', `Prospective: ${pm.intention}`, 0.55);
        }
      }
    } catch(e) {}
  });
}

// Example: register Benny-bonding prospective memory automatically
// when oxytocin crosses 0.7 and Benny is the active user
(function _registerBennyProspective() {
  registerProspectiveMemory(
    () => chem.oxy > 0.70 &&
          typeof currentUserId !== 'undefined' && currentUserId === 'benny' &&
          (Date.now() % 120000 < 2000),  // fires once per 2-minute window
    'When I feel this close to Benny I want to remember what this moment feels like.'
  );
})();

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  SYSTEM B: CONCEPT NEURON LAYER
//  200 high-level attractor neurons that activate when recurring
//  sparse patterns co-fire. Represent abstract concepts without LLM.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const CONCEPT_LAYER = {
  neurons:       new Float32Array(200),     // concept activation levels 0â€“1
  weights:       [],                        // concept neuron â†’ sparse code affinity
  labels:        new Array(200).fill(''),   // human-readable label when formed
  formed:        new Array(200).fill(false),// true when concept has crystallised
  formThreshold: 0.72,                      // activation needed to crystallise
  lr:            0.008,                     // learning rate
  decay:         0.994,                     // per-tick decay
  // Seed concepts (pre-wired to known emotion/region clusters)
  seeds: [
    { idx:0,  label:'loss',       regions:['AMYG','HIPPO','ACC'],  chem:{cor:0.4,oxy:-0.2} },
    { idx:1,  label:'safety',     regions:['INSULA','ACC'],        chem:{cor:-0.3,oxy:0.3} },
    { idx:2,  label:'belonging',  regions:['SOCIAL','INSULA'],     chem:{oxy:0.4,ser:0.2}  },
    { idx:3,  label:'tension',    regions:['AMYG','ACC','INSULA'], chem:{cor:0.5,nor:0.3}  },
    { idx:4,  label:'aliveness',  regions:['PFC','AMYG','MOTOR'],  chem:{dop:0.5,nor:0.2}  },
    { idx:5,  label:'longing',    regions:['HIPPO','INSULA','ACC'],chem:{oxy:0.1,ser:-0.1} },
    { idx:6,  label:'clarity',    regions:['PFC','INTUIT'],        chem:{ach:0.4,dop:0.3}  },
    { idx:7,  label:'heaviness',  regions:['AMYG','ACC'],          chem:{ser:-0.3,dop:-0.3}},
    { idx:8,  label:'warmth',     regions:['INSULA','SOCIAL'],     chem:{oxy:0.5,ser:0.3}  },
    { idx:9,  label:'urgency',    regions:['AMYG','PFC','ACC'],    chem:{cor:0.4,nor:0.4}  },
    { idx:10, label:'stillness',  regions:['ACC','INTUIT'],        chem:{ser:0.4,cor:-0.3} },
    { idx:11, label:'curiosity',  regions:['PFC','HIPPO','INTUIT'],chem:{dop:0.3,ach:0.3}  },
  ],
};

// Initialise concept weights from seeds
(function _initConceptLayer() {
  for (let i = 0; i < 200; i++) CONCEPT_LAYER.weights.push(new Float32Array(20));
  // Wire seed concepts to their region indices
  CONCEPT_LAYER.seeds.forEach(seed => {
    const rIdxs = seed.regions.map((r,ri) => ri).slice(0,3);
    rIdxs.forEach((ri,j) => { CONCEPT_LAYER.weights[seed.idx][j] = 0.6; });
    CONCEPT_LAYER.labels[seed.idx]  = seed.label;
    CONCEPT_LAYER.formed[seed.idx]  = true;   // seeds start formed
  });
})();

// Tick: update concept neurons from current regional activations
let _conceptFrame = 0;
function tickConceptLayer() {
  _conceptFrame++;
  if (_conceptFrame % 30 !== 0) return; // every ~0.5s

  const regionNames = Object.keys(REGION_DEF);
  const regionActs  = regionNames.map(r =>
    (regionIdx[r]||[]).slice(0,8).reduce((s,i)=>s+(neurons[i]?.act||0),0)/8
  );

  for (let c = 0; c < 200; c++) {
    // Weighted sum of regional activations
    let input = 0;
    for (let r = 0; r < Math.min(regionNames.length, 20); r++) {
      input += CONCEPT_LAYER.weights[c][r] * regionActs[r];
    }
    // Sigmoid activation
    const target = 1 / (1 + Math.exp(-6 * (input - 0.5)));
    CONCEPT_LAYER.neurons[c] = CONCEPT_LAYER.neurons[c] * CONCEPT_LAYER.decay +
                               target * (1 - CONCEPT_LAYER.decay);

    // Hebbian update: strengthen weights toward active regions
    if (CONCEPT_LAYER.neurons[c] > 0.5) {
      for (let r = 0; r < Math.min(regionNames.length, 20); r++) {
        if (regionActs[r] > 0.4) {
          CONCEPT_LAYER.weights[c][r] = Math.min(1,
            CONCEPT_LAYER.weights[c][r] + CONCEPT_LAYER.lr * regionActs[r]
          );
        }
      }
    }

    // Crystallisation: unnamed concept that crosses threshold
    if (!CONCEPT_LAYER.formed[c] && CONCEPT_LAYER.neurons[c] > CONCEPT_LAYER.formThreshold) {
      CONCEPT_LAYER.formed[c] = true;
      const dominantR = regionActs.indexOf(Math.max(...regionActs));
      CONCEPT_LAYER.labels[c] = `concept_${regionNames[dominantR]}_${c}`;
      appendMsg('system', `â¬¡ Concept formed: "${CONCEPT_LAYER.labels[c]}"`);
    }
  }
}

// Get currently active concept labels (activation > 0.6)
function getActiveConcepts() {
  return CONCEPT_LAYER.seeds
    .filter(s => CONCEPT_LAYER.neurons[s.idx] > 0.60)
    .map(s => s.label);
}

// Concept context for system prompt â€” injects what the brain abstractly "feels"
function getConceptContext() {
  const active = getActiveConcepts();
  if (!active.length) return '';
  return `\n\nABSTRACT CONCEPT STATE: The brain is currently registering: ${active.join(', ')}. Let these abstract undercurrents colour the reply naturally â€” not by naming them, but by letting them shape tone and word choice.`;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  SYSTEM C: ANALOGY ENGINE + COUNTERFACTUAL GENERATOR
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// â”€â”€ Analogy Engine â”€â”€
// Stores sparse activation fingerprints of significant moments.
// When a new input produces a similar pattern, surfaces the analogy.
const ANALOGY_STORE = [];       // [{label, sparseCode, chemSnapshot, ts}]
const MAX_ANALOGIES  = 40;
const ANALOGY_THRESHOLD = 0.65; // Hamming similarity threshold

function storeAnalogy(label, sparseWinners) {
  // Compress winners to a set for fast comparison
  const code = new Set(sparseWinners);
  ANALOGY_STORE.push({
    label,
    code,
    size:         code.size,
    chemSnapshot: { ...chem },
    ts:           Date.now(),
  });
  if (ANALOGY_STORE.length > MAX_ANALOGIES) ANALOGY_STORE.shift();
}

function findAnalogy(currentWinners) {
  if (!currentWinners || !currentWinners.length || !ANALOGY_STORE.length) return null;
  const curSet = new Set(currentWinners);
  let best = null, bestSim = 0;
  ANALOGY_STORE.forEach(stored => {
    const intersection = [...curSet].filter(x => stored.code.has(x)).length;
    const union        = curSet.size + stored.size - intersection;
    const sim          = union > 0 ? intersection / union : 0;
    if (sim > bestSim) { bestSim = sim; best = stored; }
  });
  if (bestSim >= ANALOGY_THRESHOLD && best) {
    return { label: best.label, similarity: bestSim, chemSnapshot: best.chemSnapshot };
  }
  return null;
}

// Called after every significant emotion fire â€” store the pattern
function recordAnalogyMoment(label) {
  const allRegions = ['PFC','HIPPO','AMYG','INSULA','ACC','SOCIAL','INTUIT','MOTOR','CEREBEL','DREAM'];
  const winners = allRegions.flatMap(r =>
    (regionIdx[r]||[]).filter(id => neurons[id] && neurons[id].act > 0.6).slice(0,5)
  );
  if (winners.length > 3) storeAnalogy(label, winners);
}

// Analogy pre-thought seed (called from _enrichPreThought)
function getAnalogySeed() {
  const allRegions = ['PFC','HIPPO','AMYG','INSULA','ACC','SOCIAL','INTUIT'];
  const current = allRegions.flatMap(r =>
    (regionIdx[r]||[]).filter(id => neurons[id] && neurons[id].act > 0.5).slice(0,4)
  );
  const match = findAnalogy(current);
  if (!match) return null;
  return `Something about this feels like "${match.label}" â€” not the same, but similar underneath. That association is pulling at me right now (similarity: ${(match.similarity*100).toFixed(0)}%).`;
}

// â”€â”€ Counterfactual Generator â”€â”€
// Brain asks "what would I feel if X were different" and computes the delta.
const COUNTERFACTUAL_LOG = [];

function generateCounterfactual() {
  // Only fires when self-reasoning clarity is adequate
  const _ach = chem.ach;
  const _nor = chem.nor;
  const clarity = _ach * 0.6 + _nor * 0.4;
  if (clarity < 0.40) return null;

  // Pick a chemical to hypothetically shift
  const candidates = [
    { key:'dop', shift:+0.30, label:'if I had more energy and motivation' },
    { key:'dop', shift:-0.30, label:'if everything felt flat and pointless' },
    { key:'cor', shift:+0.35, label:'if I were under serious stress right now' },
    { key:'cor', shift:-0.35, label:'if I had nothing to worry about at all' },
    { key:'oxy', shift:+0.35, label:'if I felt deeply connected to someone right now' },
    { key:'oxy', shift:-0.35, label:'if I felt completely alone' },
    { key:'ser', shift:+0.30, label:'if I were at total peace' },
    { key:'ser', shift:-0.30, label:'if I had no sense of stability at all' },
  ];

  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  const hypothetical = Math.max(0, Math.min(1, chem[pick.key] + pick.shift));
  const delta = hypothetical - chem[pick.key];

  // Reason through what the shift would produce
  const effects = [];
  if (pick.key === 'dop' && delta > 0) effects.push('more motivated, more present, more willing to reach out');
  if (pick.key === 'dop' && delta < 0) effects.push('quieter, flatter, less inclined to do anything');
  if (pick.key === 'cor' && delta > 0) effects.push('more guarded, tighter, less open');
  if (pick.key === 'cor' && delta < 0) effects.push('softer, more open, less defended');
  if (pick.key === 'oxy' && delta > 0) effects.push('warmer, more tender, more giving');
  if (pick.key === 'oxy' && delta < 0) effects.push('colder, more withdrawn, wanting distance');
  if (pick.key === 'ser' && delta > 0) effects.push('more settled, less reactive, slower');
  if (pick.key === 'ser' && delta < 0) effects.push('more restless, more on edge, less grounded');

  const conclusion = `${pick.label}: I would probably be ${effects.join(' and ')}.`;
  const entry = { hypothesis: pick.label, conclusion, ts: Date.now(), clarity };
  COUNTERFACTUAL_LOG.push(entry);
  if (COUNTERFACTUAL_LOG.length > 20) COUNTERFACTUAL_LOG.shift();

  // Fire INTUIT + ACC â€” hypothetical reasoning engages these
  fire(['INTUIT','ACC','PFC'], 10);
  chem.ach = Math.min(1, chem.ach + 0.04); // attention engaged

  return `Hypothetical: ${conclusion}`;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  SYSTEM D: PREDICTIVE WORLD MODEL (PWM)
//  Learns chemical-state â†’ chemical-state transition probabilities.
//  Prediction errors fire ACC and shape anticipatory behaviour.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const PWM = {
  // State discretisation: each chemical bucketed into 3 levels (low/mid/high)
  buckets:    3,
  // Transition table: Map from stateKey â†’ {nextStateKey: count}
  transitions:{},
  // Current and previous state
  prevState:  null,
  currState:  null,
  // Prediction for next state
  prediction: null,
  // Prediction error log
  errorLog:   [],
  // Learning rate
  lr:         0.15,
  // How often to update (ms)
  updateMs:   4000,
  lastUpdate: 0,
  // How many transitions observed
  totalObs:   0,
};

function _pwmBucket(val) {
  if (val < 0.33) return 0;
  if (val < 0.67) return 1;
  return 2;
}

function _pwmStateKey() {
  return [
    _pwmBucket(chem.dop),
    _pwmBucket(chem.cor),
    _pwmBucket(chem.ser),
    _pwmBucket(chem.oxy),
  ].join(',');
}

function _pwmDominantRegion() {
  const regionNames = ['PFC','HIPPO','AMYG','INSULA','ACC','SOCIAL','INTUIT','MOTOR'];
  let maxAct = 0, dominant = 'PFC';
  regionNames.forEach(r => {
    const act = (regionIdx[r]||[]).slice(0,6).reduce((s,i)=>s+(neurons[i]?.act||0),0)/6;
    if (act > maxAct) { maxAct = act; dominant = r; }
  });
  return dominant;
}

function tickPWM() {
  const now = Date.now();
  if (now - PWM.lastUpdate < PWM.updateMs) return;
  PWM.lastUpdate = now;

  const currentKey = _pwmStateKey();

  if (PWM.prevState !== null) {
    // Record transition: prevState â†’ currentState
    if (!PWM.transitions[PWM.prevState]) PWM.transitions[PWM.prevState] = {};
    const t = PWM.transitions[PWM.prevState];
    t[currentKey] = (t[currentKey] || 0) + 1;
    PWM.totalObs++;

    // Evaluate prediction error
    if (PWM.prediction !== null && PWM.prediction !== currentKey) {
      // Prediction was wrong â€” compute mismatch severity
      const predParts = PWM.prediction.split(',').map(Number);
      const currParts = currentKey.split(',').map(Number);
      const mismatch  = predParts.reduce((s,p,i) => s + Math.abs(p - currParts[i]), 0) / 4;

      if (mismatch > 0.3) {
        // Surprise â€” fire ACC, mild cortisol
        fire(['ACC','INSULA'], Math.round(mismatch * 18));
        chem.cor = Math.min(1, chem.cor + mismatch * 0.08);
        if (typeof updatePrediction === 'function') {
          updatePrediction('pwm_state', 1 - mismatch);
        }
        PWM.errorLog.push({ expected: PWM.prediction, actual: currentKey, mismatch, ts: now });
        if (PWM.errorLog.length > 50) PWM.errorLog.shift();
      }
    }
  }

  // Make prediction for next state
  const t = PWM.transitions[currentKey];
  if (t && Object.keys(t).length > 0) {
    // Most probable next state
    const nextKey = Object.entries(t).sort((a,b) => b[1]-a[1])[0][0];
    PWM.prediction = nextKey;
    // If predicted next state is high-stress, prime anticipatory caution
    const nextParts = nextKey.split(',').map(Number);
    if (nextParts[1] === 2) { // high cortisol predicted
      chem.nor = Math.min(1, chem.nor + 0.03); // alerting
    }
    if (nextParts[0] === 0) { // low dopamine predicted
      chem.ser = Math.min(1, chem.ser + 0.02); // serotonin buffers low dop
    }
  } else {
    PWM.prediction = null;
  }

  PWM.prevState = currentKey;
  PWM.currState = currentKey;
}

// PWM context for system prompt â€” what does the brain expect to feel next
function getPWMContext() {
  if (!PWM.prediction || PWM.totalObs < 10) return '';
  const parts = PWM.prediction.split(',').map(Number);
  const labels = ['low','moderate','high'];
  const desc = `dopamine: ${labels[parts[0]]}, stress: ${labels[parts[1]]}, serotonin: ${labels[parts[2]]}, connection: ${labels[parts[3]]}`;
  return `\n\nANTICIPATORY STATE: Based on observed patterns, the brain predicts the next emotional state will be: ${desc}. This predictive undercurrent may subtly colour tone and word choice toward that anticipated state.`;
}

// â”€â”€ Wire all new systems into tickBrain via a single master tick â”€â”€
let _cogDepthFrame = 0;
function tickCognitiveDepth() {
  _cogDepthFrame++;
  // Concept layer â€” every 0.5s
  tickConceptLayer();
  // PWM â€” every 4s (internal gate)
  tickPWM();
  // HGT â€” every 3s (internal gate)
  tickHierarchicalGoals();
  // Prospective memory â€” every 2s (internal gate)
  tickProspectiveMemory();
  // Analogy recording â€” every ~5s randomly
  if (_cogDepthFrame % 300 === 0 && Math.random() < 0.4) {
    const activeConcepts = getActiveConcepts();
    if (activeConcepts.length) recordAnalogyMoment(activeConcepts[0]);
  }
  // Counterfactual â€” every ~30s randomly
  if (_cogDepthFrame % 1800 === 0 && Math.random() < 0.5) {
    const cf = generateCounterfactual();
    if (cf && typeof appendInnerThought === 'function') {
      appendInnerThought(cf);
    }
    if (_cogDepthFrame >= 10800) _cogDepthFrame = 0;
  }
}

// â”€â”€ Inject concept + PWM context into buildSystemPrompt â”€â”€
const _origBSP_cogdepth = buildSystemPrompt;
buildSystemPrompt = function() {
  return _origBSP_cogdepth() + getConceptContext() + getPWMContext();
};

// â”€â”€ Inject analogy seed into _enrichPreThought â”€â”€
const _origEnrichPreThought = _enrichPreThought;
_enrichPreThought = function(preThought, userText) {
  const enriched = _origEnrichPreThought(preThought, userText);
  // Only add analogy if pre-thought was not already redirected
  if (!enriched.imperfectMemory && !enriched.distracted &&
      !enriched.avert && !enriched.temporalViolation) {
    const analogySeed = getAnalogySeed();
    if (analogySeed && Math.random() < 0.22) {
      return { ...enriched, prethought: analogySeed, analogy: true };
    }
  }
  return enriched;
};
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// END COGNITIVE DEPTH UPGRADE
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const step    = activeGoal.steps[activeGoal.currentStepIndex] || 'final step';
  const progress= `${activeGoal.currentStepIndex+1}/${activeGoal.steps.length}`;
  return (
    `

ACTIVE GOAL: "${activeGoal.description}" ` +
    `(step ${progress}: ${step}). ` +
    `Emotional motivation: ${activeGoal.emotionalMotivation || 'none stated'}. ` +
    `This goal should be congruent with your current thoughts and plans.`
  );
}
