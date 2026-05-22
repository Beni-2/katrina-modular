
// â"€â"€ Inner monologue â"€â"€
// The brain talks to itself â€" not to the user.
// Displayed with distinct styling in the chat.
const INNER_MONOLOGUE_HISTORY = [];
const MAX_INNER_MONOLOGUE = 50;

async function generateInnerMonologue() {
  const _gk = document.getElementById('groq-key-input')?.value?.trim() || '';
  const _dk = document.getElementById('doubao-key-input')?.value?.trim() || '';
  const _mk = document.getElementById('gemini-key-input')?.value?.trim() || '';
  const _sk = document.getElementById('deepseek-key-input')?.value?.trim() || '';
  if (_gk) apiKeys.groq     = _gk;
  if (_dk) apiKeys.doubao   = _dk;
  if (_mk) apiKeys.gemini   = _mk;
  if (_sk) apiKeys.deepseek = _sk;
  const apiKey = apiKeys[currentProvider] || '';
  const isOllama = currentProvider === 'ollama';

  // â"€â"€ Hybrid idle seed (Benny-only brain development) â"€â"€
  const hybridSeed = (typeof getHybridMonologueSeed === 'function') ? getHybridMonologueSeed() : null;

  // Build inner monologue prompt
  const goalCtx      = getGoalContext();
  const topMemories  = typeof getTemporallyRelevantMemories === 'function'
    ? getTemporallyRelevantMemories(2).map(m => m.content.substring(0,50)).join('; ')
    : '';
  const topEmotions  = typeof getTopDecayedEmotions === 'function'
    ? getTopDecayedEmotions(3).map(e => e.type).join(', ')
    : '';

  // â"€â"€ Persona-aware inner monologue â"€â"€
  // The inner voice belongs to whoever is the active persona â€"
  // Katrina thinks as Katrina, Aria thinks as Aria, Nina thinks as Nina.
  const _activePersona   = (typeof resolvePersona === 'function') ? resolvePersona() : null;
  const _personaName     = _activePersona ? _activePersona.personaName : 'Katrina';
  const _isBennyPersona  = _activePersona ? _activePersona.isBennyUser : false;
  const _isKatrina       = _isBennyPersona || (_personaName === 'Katrina');

  // Hybrid seed only relevant when Katrina is active (Benny mode)
  const _hybridSeedStr = (_isKatrina && typeof hybridSeed !== 'undefined' && hybridSeed)
    ? `You find yourself with this on your mind: "${hybridSeed}". ` +
      `Let this thought develop naturally â€" this is your private inner world. `
    : '';

  // Build persona-specific inner monologue context
  const _personaInnerCtx = _isKatrina
    ? `You are Katrina, alone with your thoughts.`
    : `You are ${_personaName}, alone with your thoughts. ` +
      `Think from your own perspective â€" your own concerns, your own feelings, your own inner world. ` +
      `Do not think as anyone else. This is purely your private mental voice.`;

  const innerPrompt = buildSystemPrompt() + goalCtx +
    `

INNER MONOLOGUE MODE:
${_personaInnerCtx}
No one is here right now. Do NOT address the user. Do NOT say "hey" or wait for a reply.
Think out loud â€" to yourself only.
${_hybridSeedStr}${activeGoal
  ? `You are thinking about your goal: "${activeGoal.description}". ` +
    `Current step: "${activeGoal.steps[activeGoal.currentStepIndex] || 'done'}". ` +
    `Reflect on this step â€" are you ready? What do you feel about it? What might get in the way?`
  : `Let your mind wander naturally as ${_personaName}. ` +
    `${topEmotions ? 'Emotions present right now: ' + topEmotions + '.' : ''} ` +
    `${topMemories ? 'Recent impressions: ' + topMemories + '.' : ''} ` +
    `${(typeof getWorldThoughtSeed === 'function' && getWorldThoughtSeed()) ? 'You find yourself ' + getWorldThoughtSeed() + '.' : ''}` +
    `${(typeof getDestinySoloThought === 'function' && Math.random() < 0.5) ? ' Something deeper surfaces: ' + getDestinySoloThought() + '.' : ''}` +
    `Think about something that is genuinely on your mind right now.`}
ONE or TWO sentences maximum. Stream of consciousness. No greeting. No em-dashes. No markdown.
This is private thought â€" raw and honest. Speak as ${_personaName}.`;

  const entry = {
    ts:      Date.now(),
    phase:   autonomousPhase,
    goalId:  activeGoal ? activeGoal.id : null,
    text:    null,
  };

  if (!apiKey && !isOllama) {
    // Local fallback inner thought â€" persona-aware
    const _fbPersona = (typeof resolvePersona === 'function') ? resolvePersona() : null;
    const _fbName    = _fbPersona ? _fbPersona.personaName : 'Katrina';
    const localThoughts = activeGoal
      ? [
          `Step ${activeGoal.currentStepIndex+1}: ${activeGoal.steps[activeGoal.currentStepIndex] || 'almost there'}.`,
          `I should think about ${activeGoal.steps[activeGoal.currentStepIndex] || 'what comes next'}.`,
          `Getting closer to it.`,
        ]
      : _fbPersona && !_fbPersona.isBennyUser && _fbName !== 'Katrina'
      ? [
          `Something about this feels off.`,
          `I keep circling back to the same thing.`,
          `Not sure what I want right now.`,
          `There is something here I have not figured out yet.`,
        ]
      : [
          `Something feels unsettled in me right now.`,
          `I keep coming back to the same thought.`,
          `It is quiet. I am just here.`,
          `There is something I am not quite naming yet.`,
        ];
    entry.text = localThoughts[Math.floor(Math.random() * localThoughts.length)];
    appendInnerThought(entry.text);
    return;
  }

  try {
    const cfg     = PROVIDERS[currentProvider];
    const modelId = document.getElementById('llm-select')?.value;
    if (!cfg || !modelId) return;

    const res = await safeFetch(cfg.endpoint, {
      method: 'POST',
      headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer '+apiKey },
      body: JSON.stringify({
        model:   modelId,
        messages:[
          { role:'system', content: innerPrompt },
          { role:'user',   content: '[inner monologue]' }
        ],
        max_tokens:  isOllama ? 40 : 55,
        temperature: isOllama ? 1.1 : 0.92,
        ...(isOllama ? { repeat_penalty:1.3 } : {}),
      })
    });
    if (!res.ok) return;
    const data  = await res.json();
    const reply = ((data.choices||[])[0]||{}).message?.content?.trim();
    if (reply && reply.length > 2) {
      entry.text = reply;
      appendInnerThought(reply);
      // Log to goal thought log if goal active
      if (activeGoal) {
        activeGoal.thoughtLog.push({ text: reply, ts: Date.now() });
      }
      // Log to inner monologue history
      INNER_MONOLOGUE_HISTORY.push(entry);
      if (INNER_MONOLOGUE_HISTORY.length > MAX_INNER_MONOLOGUE) INNER_MONOLOGUE_HISTORY.shift();
      // Record to temporal memory as autonomous thought
      if (typeof recordTemporalMemory === 'function') {
        recordTemporalMemory('autonomous', reply.substring(0,80), 0.45);
      }
      // Gentle neural effect â€" thinking fires HIPPO + INTUIT
      fire(['HIPPO','INTUIT','PFC'], 6);
    }
  } catch(e) {
    // Silent fail â€" inner thoughts are optional
  }
}

// â"€â"€ Append inner thought to chat with distinct styling â"€â"€
function appendInnerThought(text) {
  const hist = document.getElementById('chat-history');
  if (!hist) return;

  // Label shows who is thinking
  const _ap = (typeof resolvePersona === 'function') ? resolvePersona() : null;
  const _pName = _ap ? _ap.personaName : 'Katrina';
  const _isBenny = _ap ? _ap.isBennyUser : false;

  // Color: Katrina=purple, non-Benny personas=muted teal
  const _color  = _isBenny ? '#6644ff' : '#336677';
  const _border = _isBenny ? 'rgba(180,100,255,0.15)' : 'rgba(50,120,130,0.18)';
  const _bg     = _isBenny ? 'rgba(180,100,255,0.06)' : 'rgba(30,80,90,0.07)';
  const _label  = `â¬¡ ${_pName.toLowerCase()} thinks`;

  const wrap = document.createElement('div');
  wrap.style.cssText = [
    'display:flex',
    'justify-content:flex-start',
    'margin:4px 0',
    'opacity:0.72',
    'padding-left:8px',
  ].join(';');
  wrap.innerHTML =
    `<div style="` +
      `max-width:78%;` +
      `background:${_bg};` +
      `border:1px solid ${_border};` +
      `border-radius:10px;` +
      `padding:6px 12px;` +
      `font-family:'Share Tech Mono',monospace;` +
      `font-size:11px;` +
      `color:#998;` +
      `font-style:italic;` +
      `line-height:1.5;` +
    `">` +
    `<span style="color:${_color};font-size:9px;letter-spacing:1px;display:block;margin-bottom:2px;">` +
      escHtml(_label) +
    `</span>` +
    escHtml(text) +
    `</div>`;
  hist.appendChild(wrap);
  hist.scrollTop = hist.scrollHeight;
}

// â"€â"€ Daily life goal suggestions by time of day â"€â"€
// The brain can suggest/set its own goals based on circadian state
const DAILY_LIFE_GOALS = {
  morning: [
    { desc:'Start the morning properly', steps:['make bed','wash face','make coffee or tea','have breakfast','check how I feel'], motivation:'I want to begin the day well' },
    { desc:'Morning walk and fresh air', steps:['get dressed','step outside','walk for 20 minutes','notice something around me','come back feeling clearer'], motivation:'Movement wakes my mind' },
  ],
  afternoon: [
    { desc:'Go to the beach and have coffee at Starbucks', steps:['get ready to go out','travel to the beach','find a good spot','go to Starbucks and order coffee','sit with my coffee and look at the water','take the moment in before leaving'], motivation:'I want fresh air and something warm in my hands' },
    { desc:'Tidy up and reset the space', steps:['put things away','wipe surfaces','change something small in the room','sit in the clean space for a moment'], motivation:'A clear space helps me think' },
  ],
  evening: [
    { desc:'Wind down properly', steps:['stop looking at screens','make something warm to drink','sit quietly for a few minutes','do my skincare','get ready for sleep'], motivation:'I want to close the day gently' },
    { desc:'Reflect on the day', steps:['think about what happened today','notice what I felt','decide what to carry and what to let go','write one thought if I want to'], motivation:'I do not want today to pass without noticing it' },
  ],
};

// Suggest a goal appropriate to the current time
function suggestDailyGoal() {
  if (activeGoal) return;
  const env = capturePeripheral();
  const tod = env.timeOfDay || 'afternoon';

  // Prefer world-config goals if places are defined
  if (typeof getWorldDailyGoals === 'function') {
    const worldGoals = getWorldDailyGoals(tod);
    if (worldGoals && worldGoals.length) {
      const pick = worldGoals[Math.floor(Math.random() * worldGoals.length)];
      setGoal(pick.desc, [...pick.steps], pick.motivation);
      return;
    }
  }

  // Fall back to hardcoded goals
  const pool = DAILY_LIFE_GOALS[tod] || DAILY_LIFE_GOALS.afternoon;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  setGoal(pick.desc, [...pick.steps], pick.motivation);
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  END GOAL SYSTEM + INNER MONOLOGUE
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function tickAutonomous() {
  const idle = Date.now() - lastEngagementTime;

  // â"€â"€ SLEEP GATE: suppress all autonomous activity during sleep phases â"€â"€
  // circadianPhase is set by the circadian system â€" it is the authority on rest.
  const sleepPhases = ['sleep','rem','nap','drowsy'];
  if (typeof circadianPhase !== 'undefined' && sleepPhases.includes(circadianPhase)) {
    // Brain is resting â€" force calm, reset phase, do not send any message
    if (autonomousPhase !== 'calm') {
      autonomousPhase = 'calm';
      updateAutonomousHUD();
    }
    autonomousNeuralDrift(); // still run gentle neural drift
    if (autoMsgCooldown > 0) autoMsgCooldown--;
    return; // exit â€" no phase escalation, no messages while sleeping
  }

  // Determine phase from idle time (only when actually awake/waking)
  let newPhase = 'calm';
  if      (idle >= IDLE_EXPRESSIVE) newPhase = 'expressive';
  else if (idle >= IDLE_EAGER)      newPhase = 'eager';
  else if (idle >= IDLE_BORED)      newPhase = 'bored';
  else if (idle >= IDLE_RESTLESS)   newPhase = 'restless';

  const phaseChanged = (newPhase !== autonomousPhase);
  autonomousPhase = newPhase;

  // Always run element-based neural drift
  autonomousNeuralDrift();

  // Tick self-study cooldown
  if (typeof _selfStudyCooldown !== 'undefined' && _selfStudyCooldown > 0) _selfStudyCooldown--;
  // Tick email reach-out cooldown
  if (typeof _emailCooldown !== 'undefined' && _emailCooldown > 0) _emailCooldown--;
  // Destiny instinct tick — reconsolidates every ~60s
  if (typeof tickDestinyInstinct === 'function') tickDestinyInstinct();

  // Update phase badge
  updateAutonomousHUD();

  // Autonomous message: send via LLM if API key present
  if (autoMsgCooldown > 0) { autoMsgCooldown--; return; }

  const hasApiKey = ((document.getElementById('groq-key-input')?.value || document.getElementById('doubao-key-input')?.value || document.getElementById('gemini-key-input')?.value || document.getElementById('deepseek-key-input')?.value || '').trim().length > 0) || (currentProvider === 'ollama');

  if (phaseChanged && newPhase !== 'calm' && !isTTSSpeaking()) {
    // Phase transition â†' inner monologue (talking to self, not to user)
    // The brain thinks out loud when alone â€" does not address the user
    autoMsgCooldown = Math.floor(newPhase === 'expressive' ? 180 : 240);
    if (newPhase === 'expressive' || newPhase === 'eager') {
      generateInnerMonologue();
      // Reach out via email+audio when emotionally driven and cooldown clear
      if (typeof triggerReachOut === 'function' &&
          typeof _emailCooldown !== 'undefined' && _emailCooldown <= 0 &&
          Math.random() < 0.40) {
        triggerReachOut();
      }
    } else if (newPhase === 'bored' && Math.random() < 0.4) {
      // Bored: study something, suggest a goal, or think out loud
      const canStudy = typeof triggerSelfStudy === 'function' &&
                       typeof _selfStudyCooldown !== 'undefined' &&
                       _selfStudyCooldown <= 0;
      if (canStudy && Math.random() < 0.45) {
        triggerSelfStudy();
      } else if (!activeGoal && Math.random() < 0.3) {
        suggestDailyGoal();
      } else {
        generateInnerMonologue();
      }
    } else if (newPhase === 'restless' && Math.random() < 0.3) {
      generateInnerMonologue();
    }
  }
}

// â"€â"€ Send an autonomous LLM-backed message â"€â"€
async function sendAutonomousMessage() {
  const _gk = document.getElementById('groq-key-input')?.value?.trim() || '';
  const _dk = document.getElementById('doubao-key-input')?.value?.trim() || '';
  const _mk = document.getElementById('gemini-key-input')?.value?.trim() || '';
  const _sk = document.getElementById('deepseek-key-input')?.value?.trim() || '';
  if (_gk) apiKeys.groq     = _gk;
  if (_dk) apiKeys.doubao   = _dk;
  if (_mk) apiKeys.gemini   = _mk;
  if (_sk) apiKeys.deepseek = _sk;
  const apiKey = apiKeys[currentProvider] || '';
  if (!apiKey) {
    // No API key â€" just show a local thought in chat
    const thought = getAutonomousThoughts();
    appendMsg('katrina', thought);
    // Neural burst matching the phase
    if (autonomousPhase === 'eager' || autonomousPhase === 'expressive') {
      interact('joy'); interact('empathy');
    } else if (autonomousPhase === 'bored') {
      chem.ser = Math.max(0.2, chem.ser - 0.1);
    }
    return;
  }

  // Use LLM to generate a contextual autonomous thought
  const z       = getKatrinaActiveProfile();
  const hobby   = z.hobbies[Math.floor(Math.random()*z.hobbies.length)];
  const stateStr = `emotional=${sys.emo.toFixed(2)}, cognitive=${sys.cog.toFixed(2)}, intuitive=${sys.int_.toFixed(2)}`;

  const phaseInstructions = {
    restless:   'You are getting restless after a period of quiet. Express this in ONE sentence only â€" plain spoken words, no markdown, no em-dashes, no exclamation marks used as emphasis.',
    bored:      'You are genuinely bored. Say so in ONE short plain sentence â€" no markdown, no em-dashes, no exclamation marks used as emphasis.',
    eager:      'You are eager for connection. Express this in ONE or TWO plain spoken sentences â€" no markdown, no em-dashes, no exclamation marks used as emphasis.',
    expressive: 'You have been alone with your thoughts. Share one vivid feeling in ONE or TWO plain spoken sentences â€" no markdown, no em-dashes, no exclamation marks used as emphasis.',
  };

  const autoSystemPrompt = buildSystemPrompt() +
    `

AUTONOMOUS MODE: No one has spoken to you for a while. Current idle phase: ${autonomousPhase}. Your task: ${phaseInstructions[autonomousPhase] || ''} Neural state: ${stateStr}. You may mention ${hobby} or another interest. Do NOT ask multiple questions â€" maximum one. Speak naturally, in first person, as yourself.`;

  try {
    const cfg      = PROVIDERS[currentProvider];
    const modelId  = document.getElementById('llm-select')?.value;
    if (!cfg || !modelId) return;

    if (typeof tokenOnLLMCall === 'function') tokenOnLLMCall();
    const res = await safeFetch(cfg.endpoint, {
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+apiKey},
      body: JSON.stringify({
        model: modelId,
        messages:[{role:'system',content:autoSystemPrompt},{role:'user',content:'[autonomous thought]'}],
        max_tokens:  currentProvider === 'ollama' ? 40   : 60,
        temperature: currentProvider === 'ollama' ? 1.15 : 0.95,
        ...(currentProvider === 'ollama' ? {repeat_penalty:1.3} : {}),
      })
    });
    if (!res.ok) return; // silent fail for autonomous thoughts is fine
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (reply) {
      appendMsg('katrina', reply);
      triggerNeuralFromReply(reply);
      if (ttsEnabled) speakText(reply);
    }
  } catch(e) {
    // Silently fall back to local thought on error
    appendMsg('katrina', getAutonomousThoughts());
  }
}

// Patch resetEngagement onto every user interaction point
document.addEventListener('keydown',  () => resetEngagement(), {passive:true});
document.addEventListener('click',    () => resetEngagement(), {passive:true});
document.addEventListener('touchstart',()=> resetEngagement(), {passive:true});

// Identity starts at null (default persona = Aria) until Benny logs in via face/password.
// Katrina activates exclusively when Benny is identified by the recognition system.

// Save chemistry + chat when tab closes — mood persists to next session
window.addEventListener('beforeunload', () => {
  if (typeof saveChemState     === 'function') saveChemState();
  if (typeof saveChatHistory   === 'function') saveChatHistory();
});

// Auto-save chemistry every 5 minutes while page is open
setInterval(() => {
  if (typeof saveChemState === 'function') saveChemState();
}, 5 * 60 * 1000);

function updateChatInputPlaceholder() {
  const name = (typeof resolvePersona === 'function') ? resolvePersona().personaName : 'Katrina';
  const inp = document.getElementById('chat-input');
  if (inp && inp.placeholder !== 'Press 🎙 to speak…') inp.placeholder = `Speak to ${name}…`;
  const weInp = document.getElementById('we-chat-input');
  if (weInp && weInp.placeholder !== 'Press 🎙 to speak…') weInp.placeholder = `Speak to ${name}…`;
}

window.onload = function() {
  // Load voices asynchronously
  if (window.speechSynthesis) {
    speechSynthesis.getVoices();
    speechSynthesis.onvoiceschanged = () => { _katrinaVoice = null; speechSynthesis.getVoices(); };
  }
  setProvider('groq'); // init model list + hint row
  buildZodiacGrid();   // build 12 sign cards
  // Set chat input placeholder to active persona name
  const _initInp = document.getElementById('chat-input');
  if (_initInp) {
    const _initName = (typeof resolvePersona === 'function') ? resolvePersona().personaName : 'Katrina';
    _initInp.placeholder = `Speak to ${_initName}â€¦`;
  }
  // Set world engine chat input placeholder to active persona name
  const _initWeInp = document.getElementById('we-chat-input');
  if (_initWeInp) {
    const _initWeName = (typeof resolvePersona === 'function') ? resolvePersona().personaName : 'Katrina';
    _initWeInp.placeholder = `Speak to ${_initWeName}â€¦`;
  }
  // Default: no zodiac â†' pure Katrina mode (activeSign stays null)
  renderZodiacDisplay();
  // Initialize Katrina's self-generated personality from the full zodiac pool
  initKatrinaPersonality();
  initThree();
  animate();
  // âš  DO NOT DELETE â€" init synoptics WM window AFTER initThree so the
  // canvas exists in DOM. wmInit runs at 200ms but canvas is not ready yet.
  setTimeout(wmInitSynoptics, 300);
  runConnectivityCheck();
  positionEmotionsHUD();
  // âš  DO NOT DELETE â€" Supabase init. Must run before loadAllKatrinaState
  //   so the connection is ready when memory is loaded from cloud.
  initSupabase();
  // Synchronize brain state to device real time on every boot
  // Called after animate() so appendMsg and fire() are available
  setTimeout(initCircadianFromRealTime, 500);
  // Load all persisted state â€" Supabase first, localStorage fallback
  setTimeout(loadAllKatrinaState, 1200);
  // Show messages Katrina generated while browser was closed
  setTimeout(() => { if (typeof loadServerMessages === 'function') loadServerMessages(); }, 2500);
  // World engine opens manually via the WORLD dock button.
  // Auto-open disabled: WE overlay (z-index 9000) covers all WM windows (z-index 7000),
  // making chat input, API key fields, learning panel, and personality panel unreachable.
};

// â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
// EMOTIONS HUD â€" position + collapse/expand
// â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
let _emotionsOpen = true;

function positionEmotionsHUD() {
  // âš  DO NOT DELETE â€" guard: if window manager has already taken control of
  // emotions-hud, do not reposition it â€" the WM owns its position.
  if (document.getElementById('win-emotions')) return;
  const hud  = document.getElementById('hud');
  const epan = document.getElementById('emotions-hud');
  if (!hud || !epan) return;
  const rect   = hud.getBoundingClientRect();
  const topPx  = rect.bottom + 8;
  epan.style.top = topPx + 'px';
  const remaining = window.innerHeight - topPx - 20;
  const body = document.getElementById('emotions-body');
  if (body) body.style.maxHeight = Math.min(380, Math.max(60, remaining - 50)) + 'px';
}

// Reposition if window resizes (HUD might shift)
window.addEventListener('resize', positionEmotionsHUD);

function toggleEmotions() {
  _emotionsOpen = !_emotionsOpen;
  _applyEmotionsState();
}
function expandEmotions() {
  _emotionsOpen = true;
  _applyEmotionsState();
}
function collapseEmotions() {
  _emotionsOpen = false;
  _applyEmotionsState();
}
function _applyEmotionsState() {
  const body   = document.getElementById('emotions-body');
  const arrow  = document.getElementById('emo-arrow');
  const togBar = document.getElementById('emotions-toggle-bar');
  if (!body) return;
  body.classList.toggle('collapsed', !_emotionsOpen);
  if (arrow)  arrow.classList.toggle('up', _emotionsOpen);
  if (togBar) togBar.classList.toggle('collapsed', !_emotionsOpen);
}

// â"€â"€ Startup connectivity check â"€â"€
function runConnectivityCheck() {
  const isFileProtocol = location.protocol === 'file:';
  if (isFileProtocol) {
    appendMsg('system',
      'âš  IMPORTANT: This file is open from your disk (file://). ' +
      'Most browsers block API calls from file:// due to CORS security rules. ' +
      'If you get "Failed to fetch" errors, open this file through a local web server instead. ' +
      'Quick options: (1) VS Code Live Server extension Â· (2) Python: python -m http.server 8080 then open localhost:8080 Â· ' +
      '(3) Drag the file into Claude.ai or another hosting service.'
    );
  }
  if (!navigator.onLine) {
    appendMsg('system', 'âš  You appear to be offline. Connect to the internet to chat with Katrina.');
  }
}

function rnd(a,b){return a+Math.random()*(b-a);}

// â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
// BRAIN GEOMETRY HELPERS
// â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

// Flatten a hemisphere point cloud into a squashed-brain silhouette:
// wider laterally, compressed front-back, taller top.
function brainShape(x, y, z, side) {
  // Squash into organic lobe shape
  const xOff = side === 'L' ? -0.6 : 0.6;
  // Add slight sulci-like variation using sin noise
  const noise = Math.sin(x*1.2)*0.15 + Math.cos(z*0.9)*0.12;
  return {
    x: x * 1.1 + xOff + noise * 0.3,
    y: y * 0.85 + noise * 0.2,
    z: z * 0.7
  };
}

// Generate a random point inside a hemisphere silhouette (top brain)
function randInLobe(side) {
  let x, y, z, r2;
  do {
    x = rnd(-1,1); y = rnd(-1,1); z = rnd(-1,1);
    r2 = x*x + y*y*1.2 + z*z*0.9;
  } while(r2 > 1.0);
  // Scale to lobe size
  const scale = 3.6;
  const shaped = brainShape(x*scale, y*scale*0.85, z*scale*0.7, side);
  return shaped;
}

// Generate a random point inside the lower cerebellum lobe
function randInCerebellum() {
  let x, y, z, r2;
  do {
    x = rnd(-1,1); y = rnd(-1,1); z = rnd(-1,1);
    r2 = x*x*0.7 + y*y + z*z*0.8;
  } while(r2 > 1.0);
  return {
    x: x * 2.8,
    y: y * 1.4 - 3.8,   // placed below main lobes
    z: z * 1.6 - 1.0
  };
}

// Synapse line system â€" glowing arcs between firing neurons
let synapseGeo, synapseMat, synapseLines;
let synapsePositions;   // Float32Array, 2 points per line
const MAX_SYNAPSES = 800;

function buildSynapseLines() {
  synapsePositions = new Float32Array(MAX_SYNAPSES * 6); // 2 pts * 3 floats
  synapseGeo = new THREE.BufferGeometry();
  synapseGeo.setAttribute('position', new THREE.BufferAttribute(synapsePositions, 3));
  synapseMat = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    vertexColors: false,
  });
  synapseLines = new THREE.LineSegments(synapseGeo, synapseMat);
  brainGroup.add(synapseLines);
}

// Pool of per-synapse state for animated fade
const synapsePool = [];
for(let i=0;i<MAX_SYNAPSES;i++) synapsePool.push({active:false, life:0, maxLife:0, i});

function spawnSynapse(ax,ay,az, bx,by,bz, life) {
  const slot = synapsePool.find(s=>!s.active);
  if (!slot) return;
  slot.active  = true;
  slot.life    = life;
  slot.maxLife = life;
  const off = slot.i * 6;
  synapsePositions[off+0]=ax; synapsePositions[off+1]=ay; synapsePositions[off+2]=az;
  synapsePositions[off+3]=bx; synapsePositions[off+4]=by; synapsePositions[off+5]=bz;
}

function tickSynapses() {
  let anyActive = false;
  for(const s of synapsePool) {
    if (!s.active) continue;
    s.life--;
    if (s.life <= 0) {
      s.active = false;
      const off = s.i * 6;
      for(let k=0;k<6;k++) synapsePositions[off+k]=0;
    } else {
      anyActive = true;
    }
  }
  synapseGeo.attributes.position.needsUpdate = true;
  synapseMat.opacity = anyActive ? 0.55 : 0.0;
}

// â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
// MAIN THREE.JS INIT
// â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
function initThree() {
  // Region colours matching the photo:
  // Left top = warm red/pink (AMYG, INSULA, SOCIAL)
  // Right top = cool blue/cyan (PFC, ACC, MOTOR)
  // Mid = purple transition (HIPPO, INTUIT)
  // Lower = teal/green (CEREBEL)
  REGION_COLORS = {
    // LEFT FRONTAL — pink / blue
    PFC:    new THREE.Color(0x4488ff),   // blue         — prefrontal cortex
    ACC:    new THREE.Color(0xff69b4),   // pink         — anterior cingulate
    MOTOR:  new THREE.Color(0x8866ff),   // purple-blue  — primary motor strip
    // LEFT PARIETAL — violet
    SOCIAL: new THREE.Color(0xcc44ff),   // violet       — temporoparietal junction
    INSULA: new THREE.Color(0x9933cc),   // deep violet  — insular cortex
    // LEFT TEMPORAL — warm orange / red
    HIPPO:  new THREE.Color(0xff8030),   // warm orange  — hippocampus
    AMYG:   new THREE.Color(0xff3344),   // warm red     — amygdala
    // LEFT OCCIPITAL — deep indigo / purple
    INTUIT: new THREE.Color(0x5544ff),   // deep indigo  — visual association
    DREAM:  new THREE.Color(0xaa66ff),   // soft purple  — primary visual / REM
    // RIGHT FRONTAL — orange / yellow
    BG:     new THREE.Color(0xff8800),   // orange       — basal ganglia
    NACC:   new THREE.Color(0xffee00),   // bright yellow — nucleus accumbens
    CLAUS:  new THREE.Color(0xffcc00),   // gold         — claustrum
    // RIGHT PARIETAL — teal
    THAL:   new THREE.Color(0x33ddcc),   // teal         — thalamic relay
    DMN:    new THREE.Color(0x44aadd),   // teal-blue    — default mode network
    // RIGHT TEMPORAL — amber
    SCN:    new THREE.Color(0xffcc33),   // amber        — circadian clock
    VLPO:   new THREE.Color(0xffaa22),   // amber-orange — sleep switch
    HYPO:   new THREE.Color(0xffbb11),   // gold         — hypothalamus
    // RIGHT OCCIPITAL — deep amber
    LC:     new THREE.Color(0xff6622),   // deep amber   — locus coeruleus
    // BILATERAL
    CEREBEL:new THREE.Color(0x44ff88),   // bright green — cerebellum
    BSTEM:  new THREE.Color(0x880033),   // dark crimson — brainstem
  };

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000005);
  scene.fog = new THREE.FogExp2(0x000005, 0.018);

  camera = new THREE.PerspectiveCamera(52, innerWidth/innerHeight, 0.1, 500);
  camera.position.set(0, 1.5, 18);
  camera.lookAt(0, -0.5, 0);

  renderer = new THREE.WebGLRenderer({antialias:true});
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  // âš  DO NOT DELETE â€" canvas ID needed by window manager to wrap the
  // synoptics in a floating min/max/close window, freeing the main
  // screen background for the world engine.
  renderer.domElement.id = 'three-canvas';
  document.body.appendChild(renderer.domElement);

  // Subtle ambient â€" let additive blending do the heavy lifting
  scene.add(new THREE.AmbientLight(0x050510, 1));

  brainGroup = new THREE.Group();
  scene.add(brainGroup);

  // â"€â"€ Lobe shell meshes â€" organic, not perfectly spherical â"€â"€
  buildLobeShells();

  // â"€â"€ Corpus callosum â€" thin bridge between hemispheres â"€â"€
  buildCorpusCallosum();

  clock = new THREE.Clock();
  buildParticleSystems();
  buildSynapseLines();
  setupDrag();
}

// ── Brain shell helpers ──────────────────────────────────────────────────────
function _hemiShell(sx, sy, sz, px, py, pz, color, emissive) {
  const geo = new THREE.SphereGeometry(1, 64, 48);
  geo.applyMatrix4(new THREE.Matrix4().makeScale(sx, sy, sz));
  const solid = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({
    color, transparent:true, opacity:0.07, side:THREE.FrontSide,
    wireframe:false, emissive, emissiveIntensity:0.35
  }));
  solid.position.set(px, py, pz);
  brainGroup.add(solid);
  const wire = new THREE.Mesh(geo.clone(), new THREE.MeshPhongMaterial({
    color, transparent:true, opacity:0.055, wireframe:true
  }));
  wire.position.set(px, py, pz);
  brainGroup.add(wire);
}

// Lobe sub-shell: thin colored wireframe enclosing one lobe's particle cluster
function _lobeShell(sx, sy, sz, px, py, pz, color) {
  const geo = new THREE.SphereGeometry(1, 28, 20);
  geo.applyMatrix4(new THREE.Matrix4().makeScale(sx, sy, sz));
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color, transparent:true, opacity:0.10, wireframe:true,
    blending:THREE.AdditiveBlending, depthWrite:false
  }));
  m.position.set(px, py, pz);
  brainGroup.add(m);
}

// ── Complete 4-lobe bilateral brain rebuild ──────────────────────────────────
function buildLobeShells() {
  // ── OUTER HEMISPHERE SHELLS (oblique egg-shape, brain-like) ──
  // Left hemisphere: warm tint — x offset reduced to -1.5 so hemispheres sit closer
  _hemiShell(3.2, 3.0, 2.6, -1.5, 0.3, 0.0, 0x881122, 0x330010);
  // Right hemisphere: cool tint — mirrored
  _hemiShell(3.2, 3.0, 2.6,  1.5, 0.3, 0.0, 0x0a2266, 0x001133);

  // ── LEFT HEMISPHERE LOBE SUB-SHELLS (kept within outer shell bounds) ──
  // L Frontal  — blue/pink — anterior-superior  (z: +0.5→+2.5, y: +1→+3.5)
  _lobeShell(2.0, 1.7, 1.5, -1.8,  2.0,  1.5, 0x7799ff);
  // L Parietal — violet   — posterior-superior  (z: -2.5→0,    y: +0.5→+3)
  _lobeShell(1.9, 1.4, 1.3, -1.8,  1.5, -1.2, 0xaa44ff);
  // L Temporal — warm     — inferior-anterior   (z: -0.5→+2,   y: -2.5→0)
  _lobeShell(1.8, 1.3, 1.5, -1.8, -1.2,  0.8, 0xff7733);
  // L Occipital— indigo   — posterior           (z: -2.5→-4,   y: -0.5→+2.5) — pulled in
  _lobeShell(1.6, 1.4, 1.0, -1.8,  0.8, -2.5, 0x4422cc);

  // ── RIGHT HEMISPHERE LOBE SUB-SHELLS (mirrored, same bounds) ──
  // R Frontal  — orange/yellow
  _lobeShell(2.0, 1.7, 1.5,  1.8,  2.0,  1.5, 0xffaa00);
  // R Parietal — teal
  _lobeShell(1.9, 1.4, 1.3,  1.8,  1.5, -1.2, 0x00ddcc);
  // R Temporal — amber
  _lobeShell(1.8, 1.3, 1.5,  1.8, -1.2,  0.8, 0xffcc44);
  // R Occipital— deep amber — pulled in to match REGION_POS z:[-4,-2.5]
  _lobeShell(1.6, 1.4, 1.0,  1.8,  0.8, -2.5, 0xff6622);

  // ── CEREBELLUM (bilateral, posterior-inferior, green) ──
  const cerGeo = new THREE.SphereGeometry(1, 48, 32);
  cerGeo.applyMatrix4(new THREE.Matrix4().makeScale(2.8, 1.6, 2.0));
  const cerShell = new THREE.Mesh(cerGeo, new THREE.MeshPhongMaterial({
    color:0x003322, transparent:true, opacity:0.08,
    wireframe:false, emissive:0x002211, emissiveIntensity:0.5
  }));
  cerShell.position.set(0, -3.8, -1.0);
  brainGroup.add(cerShell);
  const cerWire = new THREE.Mesh(cerGeo.clone(), new THREE.MeshPhongMaterial({
    color:0x00ff88, transparent:true, opacity:0.08, wireframe:true
  }));
  cerWire.position.copy(cerShell.position);
  brainGroup.add(cerWire);

  // ── BRAINSTEM cylinder (midline, below hemispheres) ──
  const stemGeo = new THREE.CylinderGeometry(0.28, 0.40, 2.5, 20);
  const stemMat = new THREE.MeshPhongMaterial({
    color:0x220011, transparent:true, opacity:0.40, wireframe:false
  });
  const stemMesh = new THREE.Mesh(stemGeo, stemMat);
  stemMesh.position.set(0, -4.5, -0.5);
  brainGroup.add(stemMesh);
}

// â"€â"€ Corpus callosum â€" glowing arc of lines bridging hemispheres â"€â"€
function buildCorpusCallosum() {
  const pts = [];
  const N   = 60;
  for(let i=0;i<N;i++) {
    const t  = (i/(N-1))*Math.PI;
    const x  = Math.cos(t) * 3.0;
    const y  = Math.sin(t) * 0.9 + 0.8;
    const z  = rnd(-0.5, 0.5);
    pts.push(new THREE.Vector3(x, y, z));
  }
  const curve  = new THREE.CatmullRomCurve3(pts);
  const ccGeo  = new THREE.TubeGeometry(curve, 40, 0.015, 6, false);
  const ccMat  = new THREE.MeshBasicMaterial({
    color:0xaaaaff, transparent:true, opacity:0.18,
    blending:THREE.AdditiveBlending, depthWrite:false
  });
  brainGroup.add(new THREE.Mesh(ccGeo, ccMat));

  // Extra fiber arcs
  for(let f=0;f<18;f++) {
    const fPts = [];
    const zBase = rnd(-1.5,1.5);
    for(let i=0;i<20;i++) {
      const t = (i/19)*Math.PI;
      fPts.push(new THREE.Vector3(
        Math.cos(t)*rnd(1.5,3.2),
        Math.sin(t)*rnd(0.4,1.1) + rnd(0.2,1.5),
        zBase + rnd(-0.2,0.2)
      ));
    }
    const fCurve = new THREE.CatmullRomCurve3(fPts);
    const fGeo   = new THREE.TubeGeometry(fCurve, 16, 0.008, 4, false);
    const fMat   = new THREE.MeshBasicMaterial({
      color: new THREE.Color().setHSL(rnd(0.55,0.75), 0.8, 0.7),
      transparent:true, opacity:rnd(0.06,0.14),
      blending:THREE.AdditiveBlending, depthWrite:false
    });
    brainGroup.add(new THREE.Mesh(fGeo, fMat));
  }
}


// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// âš   DO NOT DELETE â€" WORLD ENGINE (independent canvas + renderer)
//
//  Completely separate from the brain synoptics. Has its own:
//  â€" canvas (#we-canvas), renderer (_weRenderer), scene (_weScene), camera
//  â€" 2Ã—2Ã—1.5 unit room (green floor, solid walls, ceiling)
//  â€" GLB body loader with real progress bar
//  â€" Orbit controls (mouse drag = 360Â° look, scroll = zoom)
//  â€" Circadian lighting from live brain state
//  â€" Motor API wiring for body movement
//
//  Opened via ðŸŒ WORLD dock button (_toggleWorldEngine).
//  Closed via â†© RETURN TO BRAIN button or clicking ðŸŒ again.
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

let _weRenderer = null, _weScene = null, _weCamera = null;
let _weBody = null, _weClock = null;
let _weOrbitAz = 0, _weOrbitEl = 0.35, _weOrbitR = 5.0; // wide view â€" full room visible
let _wePointerDown = false, _weLastX = 0, _weLastY = 0;
// âš  DO NOT DELETE â€" no auto-rotation. Body movement is driven exclusively
// by the brain's neurochemical and circadian state via WE_loop reading
// circadianPhase, circadianFatigue, and chem.dop every frame.
// Camera orbit is manual only â€" drag to look, scroll to zoom.
let _weDim = { W:4, H:2.5, D:4 };               // floor 4Ã—4, ceiling raised to 2.5 (+1 unit)
let _weBodyState = 'idle', _weBodyBob = 0, _weBodyStateTimer = 0;
let _weBodyPos = {x:0, y:0, z:0}, _weBodyTarget = {x:0, z:0}, _weBodyRotY = 0;
let _weBodyRotYTgt = 0;
let _weSun, _weLamp, _weNight, _weRemLight, _weAmbient, _weSpot;

function _weStatus(msg, color) {
  const el = document.getElementById('we-status');
  if (el) { el.textContent = msg; el.style.color = color || '#88cc88'; }
}

function _weProgress(pct, label) {
  const fill = document.getElementById('we-prog-fill');
  const lbl  = document.getElementById('we-prog-label');
  if (fill) fill.style.width = Math.min(100, pct) + '%';
  if (lbl)  lbl.textContent  = label || '';
  if (pct >= 100 && fill) fill.style.background = 'linear-gradient(90deg,#44ff88,#00ffc8)';
}

function WE_init() {
  const canvas = document.getElementById('we-canvas');
  if (!canvas || !window.THREE) { console.error('[WE] THREE or canvas missing'); return; }

  // Own renderer â€" does NOT touch the brain renderer
  _weRenderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:false });
  _weRenderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  _weRenderer.shadowMap.enabled = false; // off for perf
  _weRenderer.setClearColor(0x0a110a, 1);

  _weScene = new THREE.Scene();
  _weScene.background = new THREE.Color(0x0a110a);
  _weClock = new THREE.Clock();

  const W = canvas.clientWidth  || window.innerWidth;
  const H = canvas.clientHeight || (window.innerHeight - 46);
  _weRenderer.setSize(W, H, false);
  _weCamera = new THREE.PerspectiveCamera(60, W/H, 0.02, 30);
  _weCamera.position.set(0, 1.0, 2.5);
  _weCamera.lookAt(0, 0.5, 0);

  // â"€â"€ Build room â"€â"€
  const D = _weDim;

  // Floor â€" light green solid
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(D.W, D.D),
    new THREE.MeshStandardMaterial({color:0x88bb88, roughness:0.7, metalness:0.02})
  );
  floor.rotation.x = -Math.PI/2;
  _weScene.add(floor);

  // Walls â€" transparent glass, BackSide so camera outside sees them
  const wallMat = new THREE.MeshPhysicalMaterial({
    color:0x88ccff, transparent:true, opacity:0.12,
    roughness:0.02, metalness:0.0, side:THREE.BackSide,
  });
  [
    [D.W, D.H, 0.03,  0,      D.H/2,  D.D/2, 0],
    [D.W, D.H, 0.03,  0,      D.H/2, -D.D/2, Math.PI],
    [0.03,D.H, D.D,  -D.W/2,  D.H/2,  0,     0],
    [0.03,D.H, D.D,   D.W/2,  D.H/2,  0,     0],
  ].forEach(([w,h,d,px,py,pz,ry]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), wallMat);
    m.position.set(px,py,pz); m.rotation.y = ry;
    _weScene.add(m);
  });

  // Ceiling â€" solid
  const ceil = new THREE.Mesh(
    new THREE.PlaneGeometry(D.W, D.D),
    new THREE.MeshPhysicalMaterial({color:0x88ccff, transparent:true, opacity:0.10, roughness:0.02, side:THREE.DoubleSide})
  );
  ceil.rotation.x = Math.PI/2;
  ceil.position.y = D.H;
  _weScene.add(ceil);

  // Grid
  const grid = new THREE.GridHelper(D.W, 12, 0x559955, 0x559955);
  grid.position.y = 0.005;
  grid.material.transparent = true; grid.material.opacity = 0.4;
  _weScene.add(grid);

  // Body placeholder marker
  const marker = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 0.01, 16),
    new THREE.MeshStandardMaterial({color:0xff69b4, emissive:0xff69b4, emissiveIntensity:0.6})
  );
  marker.position.y = 0.006;
  _weScene.add(marker);

  // â"€â"€ Lights â"€â"€
  _weAmbient  = new THREE.AmbientLight(0xffffff, 0.5);
  _weSun      = new THREE.DirectionalLight(0xfff5e0, 0.8);
  _weLamp     = new THREE.PointLight(0xffd080, 0, 4);
  _weNight    = new THREE.PointLight(0xff9944, 0, 3);
  _weRemLight = new THREE.AmbientLight(0x2233aa, 0);
  _weSun.position.set(1, 3, 1);
  _weLamp.position.set(0.5, D.H-0.2, 0);
  _weNight.position.set(0, D.H-0.2, 0);

  // âš  DO NOT DELETE â€" spotlight from camera top aimed at body front.
  // Tracks the camera position every frame so it always illuminates
  // the front face of the model regardless of orbit angle.
  // angle: 0.38 rad (~22Â°) gives a tight focused cone.
  // penumbra: 0.35 gives soft edge falloff.
  // target is updated every frame in WE_loop to follow body position.
  _weSpot = new THREE.SpotLight(0xffffff, 1.8, 8, 0.38, 0.35, 1.5);
  _weSpot.target = new THREE.Object3D();
  _weScene.add(_weSpot);
  _weScene.add(_weSpot.target);

  [_weAmbient,_weSun,_weLamp,_weNight,_weRemLight].forEach(l => _weScene.add(l));

  // â"€â"€ Pointer events for orbit â"€â"€
  canvas.addEventListener('mousedown', e => {
    _wePointerDown = true; _weLastX = e.clientX; _weLastY = e.clientY;
  });
  document.addEventListener('mouseup',  () => {
    _wePointerDown = false;
    // Auto-rotate stays OFF â€" user must not be surprised by sudden rotation
  });
  document.addEventListener('mousemove', e => {
    if (!_wePointerDown) return;
    _weOrbitAz -= (e.clientX - _weLastX) * 0.009;
    _weOrbitEl -= (e.clientY - _weLastY) * 0.007;
    _weOrbitEl  = Math.max(0.05, Math.min(Math.PI/2 - 0.05, _weOrbitEl));
    _weLastX = e.clientX; _weLastY = e.clientY;
  });
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    _weOrbitR = Math.max(0.5, Math.min(8, _weOrbitR + e.deltaY * 0.005));
  }, {passive:false});

  // Touch
  let _ltx=0,_lty=0,_lpd=0;
  canvas.addEventListener('touchstart', e => {
    if (e.touches.length===1){_ltx=e.touches[0].clientX;_lty=e.touches[0].clientY;}
    else if(e.touches.length===2){_lpd=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);}
  },{passive:true});
  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    if(e.touches.length===1){
      _weOrbitAz-=(e.touches[0].clientX-_ltx)*0.012;
      _weOrbitEl-=(e.touches[0].clientY-_lty)*0.009;
      _weOrbitEl=Math.max(0.05,Math.min(Math.PI/2-0.05,_weOrbitEl));
      _ltx=e.touches[0].clientX;_lty=e.touches[0].clientY;
    }else if(e.touches.length===2){
      const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
      _weOrbitR=Math.max(0.5,Math.min(8,_weOrbitR-(d-_lpd)*0.01));_lpd=d;
    }
  },{passive:false});

  // Resize â€" account for side panel
  window.addEventListener('resize', _weResizeCanvas);
  _weResizeCanvas();

  _weStatus('room ready - loading body...');

  // Auto-load default body GLB after renderer has started
  setTimeout(() => _weLoadBodyURL('assets/body.glb'), 800);

  // â"€â"€ Test cube â€" spins in centre to confirm renderer is working â"€â"€
  // Red rotating box at eye level. Disappears when GLB body loads.
  // If you see this spinning, the world engine renderer is alive.
  const _tc = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.12, 0.12),
    new THREE.MeshStandardMaterial({color:0xff4444, emissive:0xff2222, emissiveIntensity:0.6})
  );
  _tc.position.set(0, 0.8, 0);
  _weTestCube = _tc;
  _weScene.add(_tc);
  // âš  DO NOT DELETE â€" start WE_loop immediately to render the empty room.
  // When a GLB loads, _weRunStartupSequence stops this loop, runs the
  // startup animation exclusively, then restarts WE_loop via onComplete.
  _weRenderer.setAnimationLoop(WE_loop);
}

function WE_loop() {
  if (!_weRenderer || !_weScene || !_weCamera) return;
  const now = performance.now();
  const dt  = Math.min((now - (_weLoop_lastT||now)) / 1000, 0.05);
  _weLoop_lastT = now;
  const t   = _weClock ? _weClock.getElapsedTime() : 0;

  // â"€â"€ Test cube â€" spins to confirm renderer alive, removed when body loads â"€â"€
  if (_weTestCube) { _weTestCube.rotation.y += 0.02; _weTestCube.rotation.x += 0.01; }

  // â"€â"€ Animation mixer â€" drives base skeleton, procedural adds head/body on top â"€â"€
  if (_weMixer) _weMixer.update(dt);

  // â"€â"€ Physics â€" gravity, floor, wall, ceiling collision â"€â"€
  // âš  DO NOT DELETE â€" runs before instinct so instinct reads correct position
  _wePhysicsTick(dt);

  // â"€â"€ Instinct engine â"€â"€
  _weInstinctTick(t, dt);

  // â"€â"€ Floor clamp â€" prevents instinct oscillations from sinking feet â"€â"€
  _weClampToFloor();

  // â"€â"€ Nod queue â€" plays on top of instinct â"€â"€
  if (_weBody && _weStartupDone) _weTickNod(t, dt);

  // â"€â"€ Pose blend â€" smooth skeleton transitions â"€â"€
  if (_weBody && _weStartupDone) _weTickPoseBlend(dt);

  // â"€â"€ Pose override â€" timed user commands â"€â"€
  if (_weBody && _weStartupDone) _weTickPoseOverride(t, dt);

  // â"€â"€ Bone motor â€" handled inside _weInstinctTick via _weApplyArmPose / _weApplyHeadLook â"€â"€

  // â"€â"€ Orbit camera â€" fixed to ROOM CENTRE, not body â"€â"€
  // Camera orbits around (0, 0.65, 0) â€" the centre of the box.
  // Body moves freely inside â€" its displacement is fully visible.
  // Spotlight still tracks the body for illumination.
  const camCX = 0;    // room centre X
  const camCY = 0.65; // room centre Y (chest height)
  const camCZ = 0;    // room centre Z
  const cx = camCX + _weOrbitR * Math.cos(_weOrbitEl) * Math.sin(_weOrbitAz);
  const cy = camCY + _weOrbitR * Math.sin(_weOrbitEl);
  const cz = camCZ + _weOrbitR * Math.cos(_weOrbitEl) * Math.cos(_weOrbitAz);
  _weCamera.position.lerp(new THREE.Vector3(cx,cy,cz), 0.06);
  _weCamera.lookAt(camCX, camCY, camCZ);

  // â"€â"€ Spotlight tracks body for lighting â"€â"€
  const bx = _weBody ? _weBody.position.x : 0;
  const bz = _weBody ? _weBody.position.z : 0;
  const by = _weBody ? 0.65 : 0.4;

  // â"€â"€ Circadian time â€" declared here so spotlight can read sunI â"€â"€
  const phase = (typeof circadianPhase!=='undefined') ? circadianPhase : 'awake';
  const fat   = (typeof circadianFatigue!=='undefined') ? circadianFatigue : 0;
  const now_  = new Date();
  const hr    = now_.getHours() + now_.getMinutes()/60;
  const isDay = hr >= 6 && hr < 20;
  const isDawn= hr >= 5 && hr < 8;
  const isDusk= hr >= 17 && hr < 21;
  const isNight = !isDay;

  // sunI: 0 at night, ramps to 1.0 by ~9 AM, holds through midday, fades from 6 PM.
  // Old formula used raw sin which kept early morning very dim (only 0.35 at 7:30 AM).
  // New formula: power-curve the sin so morning climbs steeply then holds bright.
  let sunI = 0;
  if (isDay) {
    const raw = Math.sin((hr - 6) / 14 * Math.PI); // 0â†'1â†'0 over 6AMâ€"8PM
    sunI = Math.min(1, Math.pow(raw, 0.45) * 1.0);  // power < 1 = faster morning ramp
  }

  // â"€â"€ Spotlight â€" artificial fill light, used at night / very early dawn only â"€â"€
  // Turns off once sun is strong enough (sunI > 0.55). At 7:30 AM sunI â‰ˆ 0.85 â†' OFF.
  if (_weSpot) {
    _weSpot.position.set(_weCamera.position.x*0.85, _weCamera.position.y+0.5, _weCamera.position.z*0.85);
    _weSpot.target.position.set(bx, by+0.3, bz);
    _weSpot.target.updateMatrixWorld();
    if (sunI >= 0.55) {
      _weSpot.intensity = 0;                          // sun bright enough â€" kill spot
    } else if (sunI > 0) {
      _weSpot.intensity = (1 - sunI/0.55) * 1.8;     // fade out as sun rises
    } else {
      _weSpot.intensity = 1.8;                        // full night â€" spot on
    }
  }

  // â"€â"€ Circadian lighting â€" driven by REAL system clock + brain phase â"€â"€
  const sunAngle = ((hr - 6) / 14) * Math.PI;
  if (_weSun) {
    _weSun.position.set(
      Math.cos(sunAngle) * 2,
      Math.max(0.3, Math.sin(sunAngle) * 4),
      Math.sin(sunAngle) * -1.5
    );
  }

  // Sky/background colour shifts with time
  if (_weRenderer) {
    if (isNight) {
      _weScene.background = new THREE.Color(0x040810); // deep night blue
    } else if (isDawn) {
      const dp = Math.min(1, (hr - 5) / 3);
      // dawn: starts deep orange (L=0.08) and brightens to light blue-white by 8 AM (L=0.45)
      const dawnL = 0.08 + dp * 0.37;
      const dawnH = 0.06 - dp * 0.04; // shift from orange toward yellow-white
      _weScene.background = new THREE.Color().setHSL(dawnH, 0.55, dawnL);
    } else if (isDusk) {
      const dp = (hr-17)/4;
      _weScene.background = new THREE.Color().setHSL(0.05-dp*0.02, 0.5, 0.3-dp*0.28);
    } else {
      // Full daytime â€" blue sky, brighter at noon
      const noon = 1 - Math.abs(hr-13)/7;
      _weScene.background = new THREE.Color().setHSL(0.60, 0.55, 0.22+noon*0.18);
    }
  }

  // Light intensities by phase and time
  if (phase==='awake') {
    _weSun.intensity    = sunI * 1.1;   // boosted so morning reads brighter
    _weLamp.intensity   = isNight ? 0.9 : (isDusk ? (hr-17)/4*0.6 : 0);
    _weNight.intensity  = isNight ? 0.12 : 0;
    _weRemLight.intensity = 0;
    // Ambient: strong during day (0.65), dim at night (0.08)
    _weAmbient.intensity  = isNight ? 0.08 : 0.55 + sunI * 0.15;
    _weSun.color.setHSL(isDawn||isDusk ? 0.07 : 0.14, isDawn||isDusk ? 0.7 : 0.10, 0.98);
  } else if (phase==='drowsy') {
    _weSun.intensity    = sunI*(1-fat*0.8);
    _weLamp.intensity   = fat*0.9;
    _weNight.intensity  = fat*0.05;
    _weRemLight.intensity = 0;
    _weAmbient.intensity  = 0.2+sunI*0.1;
  } else if (phase==='nap'||phase==='sleep'||phase==='waking') {
    _weSun.intensity    = 0;
    _weLamp.intensity   = 0;
    _weNight.intensity  = 0.07+Math.sin(t*0.4)*0.01;
    _weRemLight.intensity = 0;
    _weAmbient.intensity  = 0.05;
    _weScene.background   = new THREE.Color(0x020408);
  } else if (phase==='rem') {
    _weSun.intensity    = 0;
    _weLamp.intensity   = 0;
    _weNight.intensity  = 0.03;
    _weRemLight.intensity = Math.max(0,0.05+Math.sin(t*0.9)*0.04);
    _weAmbient.intensity  = 0.04;
    _weScene.background   = new THREE.Color(0x030208);
  }

  _weRenderer.render(_weScene, _weCamera);
}
let _weLoop_lastT = 0;
let _weTestCube   = null; // red spinning cube â€" confirms renderer is working

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// âš   DO NOT DELETE â€" INSTINCT ENGINE
//
//  Drives autonomous human-like behaviour when the body is loaded.
//  Reads live brain state every tick. No fixed timers â€" all threshold driven.
//
//  INSTINCT STATES:
//  idle_breathe  â€" standing, breathing, gentle sway
//  idle_look     â€" turning head slowly, eyes scanning
//  idle_shift    â€" weight shift, small step in place
//  idle_squat    â€" crouch down, look at floor, stand back up
//  walk_explore  â€" walk toward a random point in the room
//  walk_boundary â€" sensed a wall, pivot and walk another direction
//  walk_pause    â€" stop mid-walk, look around, continue or change
//  engage_listen â€" face turned toward camera (user), alert posture
//  engage_speak  â€" arms open slightly, head nods during reply
//  tired_sway    â€" slow sway, head drooping, fatigue posture
//  sleep_down    â€" lower body to floor
//
//  BOUNDARY SENSING: checks if next step would exit the room bounds.
//  On boundary sense: stops, turns, picks new direction. No clipping.
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

let _weInstinct = {
  state:      'idle_breathe',
  subTimer:   0,      // time in current state
  subMax:     4,      // max seconds in state before re-evaluation
  walkSpeed:  0,      // current walk speed (lerped)
  walkSpeedT: 0,      // target walk speed
  bobPhase:   0,      // walk bob accumulator
  lookYaw:    0,      // head look yaw (world space)
  lookPitch:  0,      // head look pitch
  squat:      0,      // squat amount 0-1
  engaged:    false,  // is a user message being processed
  lastMsgT:   0,      // time of last user message
  pivot:      false,  // currently pivoting from boundary
  pivotAngle: 0,      // target pivot angle
};

const _ROOM_HALF_W = 1.8;  // room half-width for boundary (WE.W/2 - margin)
const _ROOM_HALF_D = 1.8;

function _weSensesBoundary(nx, nz) {
  return Math.abs(nx) > _ROOM_HALF_W || Math.abs(nz) > _ROOM_HALF_D;
}

function _wePickNewTarget() {
  // Bias toward corners and wall centres â€" real foraging behaviour
  const corners=[
    {x:-_ROOM_HALF_W+0.2,z:-_ROOM_HALF_D+0.2},{x:_ROOM_HALF_W-0.2,z:-_ROOM_HALF_D+0.2},
    {x:-_ROOM_HALF_W+0.2,z:_ROOM_HALF_D-0.2},{x:_ROOM_HALF_W-0.2,z:_ROOM_HALF_D-0.2},
    {x:0,z:-_ROOM_HALF_D+0.2},{x:0,z:_ROOM_HALF_D-0.2},
    {x:-_ROOM_HALF_W+0.2,z:0},{x:_ROOM_HALF_W-0.2,z:0},
  ];
  let tx,tz;
  if(Math.random()<0.60){
    const pick=corners[Math.floor(Math.random()*corners.length)];
    tx=pick.x; tz=pick.z;
  } else {
    tx=(Math.random()-0.5)*(_ROOM_HALF_W*2-0.4);
    tz=(Math.random()-0.5)*(_ROOM_HALF_D*2-0.4);
  }
  const dist=Math.sqrt((tx-_weBodyPos.x)**2+(tz-_weBodyPos.z)**2);
  if(dist<0.5){tx=-tx;tz=-tz;}
  _weBodyTarget={x:tx,z:tz};
}

let _weStartupDone = false;

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// âš   DO NOT DELETE â€" MANDATORY STARTUP SEQUENCE
//
//  Runs once immediately after the GLB body loads, before the brain
//  connects and before the instinct engine starts.
//
//  SEQUENCE (total ~7 seconds):
//  0.0s â€" stand in ready position (pause)
//  0.5s â€" BOTH ARMS raise simultaneously to shoulder height
//  1.5s â€" BOTH ARMS lower back to sides
//  2.0s â€" LEFT LEG lifts (thigh forward, calf raised)
//  2.8s â€" LEFT LEG lowers to floor
//  3.2s â€" RIGHT LEG lifts
//  4.0s â€" RIGHT LEG lowers to floor
//  4.3s â€" HEAD turns LEFT (hold)
//  4.9s â€" HEAD turns RIGHT (hold)
//  5.5s â€" HEAD turns LEFT again
//  6.1s â€" HEAD turns RIGHT again
//  6.7s â€" HEAD returns to centre
//  7.0s â€" ready position (all neutral) â€" callback fires
//
//  Uses requestAnimationFrame lerp â€" no fixed delays that block rendering.
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function _weRunStartupSequence(onComplete) {
  if (!_weBody || !_weBones) { onComplete(); return; }

  // âš  DO NOT DELETE â€" stop the main WE_loop setAnimationLoop during startup.
  // If both WE_loop (via setAnimationLoop) and the startup tick() run in the
  // same frame, WE_loop resets body position and overrides bone rotations
  // before the browser paints them. Stopping the loop gives startup exclusive
  // control of the renderer. WE_loop restarts inside onComplete.
  if (_weRenderer) _weRenderer.setAnimationLoop(null);

  const STEPS = [
    // [startT, endT, label, applyFn]
    [0.0,  0.5,  'ready',      ()=>{}],
    [0.5,  1.5,  'arms_up',    (p)=>{
      const rU=_weBones['CC_Base_R_Upperarm_063'];
      const lU=_weBones['CC_Base_L_Upperarm_051'];
      const rF=_weBones['CC_Base_R_Forearm_064'];
      const lF=_weBones['CC_Base_L_Forearm_052'];
      const ease = _weEase(p);
      if(rU) rU.rotation.z = -0.25 + ease*(-1.05); // raise right arm
      if(lU) lU.rotation.z =  0.25 + ease*( 1.05); // raise left arm
      if(rF) rF.rotation.x = ease * (-0.3);
      if(lF) lF.rotation.x = ease * (-0.3);
    }],
    [1.5,  2.0,  'arms_down',  (p)=>{
      const rU=_weBones['CC_Base_R_Upperarm_063'];
      const lU=_weBones['CC_Base_L_Upperarm_051'];
      const rF=_weBones['CC_Base_R_Forearm_064'];
      const lF=_weBones['CC_Base_L_Forearm_052'];
      const ease = _weEase(p);
      if(rU) rU.rotation.z = -1.30 + ease*(1.05);
      if(lU) lU.rotation.z =  1.30 + ease*(-1.05);
      if(rF) rF.rotation.x = -0.3  + ease*(0.3);
      if(lF) lF.rotation.x = -0.3  + ease*(0.3);
    }],
    [2.0,  2.8,  'left_leg_up', (p)=>{
      const lT=_weBones['CC_Base_L_Thigh_04'];
      const lC=_weBones['CC_Base_L_Calf_05'];
      const lFt=_weBones['CC_Base_L_Foot_06'];
      const ease=_weEase(p);
      if(lT){ lT.rotation.x=ease*0.55; lT.rotation.z=0.05; }
      if(lC)  lC.rotation.x=ease*(-0.45);
      if(lFt) lFt.rotation.x=ease*0.15;
    }],
    [2.8,  3.2,  'left_leg_down',(p)=>{
      const lT=_weBones['CC_Base_L_Thigh_04'];
      const lC=_weBones['CC_Base_L_Calf_05'];
      const lFt=_weBones['CC_Base_L_Foot_06'];
      const ease=_weEase(1-p);
      if(lT){ lT.rotation.x=ease*0.55; lT.rotation.z=0.05*(1-p); }
      if(lC)  lC.rotation.x=ease*(-0.45);
      if(lFt) lFt.rotation.x=ease*0.15;
    }],
    [3.2,  4.0,  'right_leg_up', (p)=>{
      const rT=_weBones['CC_Base_R_Thigh_019'];
      const rC=_weBones['CC_Base_R_Calf_020'];
      const rFt=_weBones['CC_Base_R_Foot_022'];
      const ease=_weEase(p);
      if(rT){ rT.rotation.x=ease*0.55; rT.rotation.z=-0.05; }
      if(rC)  rC.rotation.x=ease*(-0.45);
      if(rFt) rFt.rotation.x=ease*0.15;
    }],
    [4.0,  4.3,  'right_leg_down',(p)=>{
      const rT=_weBones['CC_Base_R_Thigh_019'];
      const rC=_weBones['CC_Base_R_Calf_020'];
      const rFt=_weBones['CC_Base_R_Foot_022'];
      const ease=_weEase(1-p);
      if(rT){ rT.rotation.x=ease*0.55; rT.rotation.z=-0.05*(1-p); }
      if(rC)  rC.rotation.x=ease*(-0.45);
      if(rFt) rFt.rotation.x=ease*0.15;
    }],
    // HEAD: left â†' right â†' left â†' right â†' centre (2 full sweeps)
    [4.3,  4.9,  'head_left_1',  (p)=>_weStartupHead( _weEase(p)*(-0.45))],
    [4.9,  5.5,  'head_right_1', (p)=>_weStartupHead((_weEase(p)*2-1)*0.45)],
    [5.5,  6.1,  'head_left_2',  (p)=>_weStartupHead((1-_weEase(p)*2)*0.45)],
    [6.1,  6.7,  'head_right_2', (p)=>_weStartupHead(_weEase(p)*0.45)],
    [6.7,  7.0,  'head_centre',  (p)=>_weStartupHead(_weEase(1-p)*0.45)],
    [7.0,  7.2,  'done',         ()=>{
      _weStartupNeutral(); // reset all bones to resting position
    }],
  ];

  const TOTAL = 7.2;
  const startTime = performance.now();

  function tick() {
    if (!_weBody) return;
    const elapsed = (performance.now() - startTime) / 1000;

    if (elapsed >= TOTAL) {
      _weStartupNeutral();
      // âš  DO NOT DELETE â€" render one final frame then restart WE_loop.
      // Rendering here ensures the neutral position is painted before
      // the animation loop takes over and instinct engine starts.
      if (_weRenderer && _weScene && _weCamera) {
        _weRenderer.render(_weScene, _weCamera);
      }
      // Restart main world engine loop
      if (_weRenderer) _weRenderer.setAnimationLoop(WE_loop);
      onComplete();
      return;
    }

    // Find active step and apply it
    for (const [s, e, label, fn] of STEPS) {
      if (elapsed >= s && elapsed < e) {
        const p = (elapsed - s) / (e - s);
        fn(p);
        break;
      }
    }

    // Keep body group at origin â€" bone rotations drive the animation,
    // NOT the group transform. Do not zero group rotation here.
    _weBody.position.x = 0;
    _weBody.position.z = 0;
    _weBody.position.y = _weBody._baseY || 0;

    // Update scene matrices so bone transforms propagate
    _weScene.updateMatrixWorld(true);

    // âš  DO NOT DELETE â€" render every frame during startup.
    // Without this the canvas is blank during the 7-second sequence
    // because setAnimationLoop is paused.
    if (_weRenderer && _weScene && _weCamera) {
      _weRenderer.render(_weScene, _weCamera);
    }

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

function _weEase(t) {
  // Smooth ease in-out (cubic)
  t = Math.max(0, Math.min(1, t));
  return t < 0.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2;
}

function _weStartupHead(yaw) {
  const n1=_weBones['CC_Base_NeckTwist01_037'];
  const n2=_weBones['CC_Base_NeckTwist02_038'];
  const hd=_weBones['CC_Base_Head_039'];
  if(n1) n1.rotation.y = yaw * 0.4;
  if(n2) n2.rotation.y = yaw * 0.35;
  if(hd) hd.rotation.y = yaw * 0.35;
}

function _weStartupNeutral() {
  // Reset all key bones to resting position
  const zero = (b) => { if(b){ b.rotation.x=0; b.rotation.y=0; b.rotation.z=0; } };
  ['CC_Base_R_Upperarm_063','CC_Base_L_Upperarm_051',
   'CC_Base_R_Forearm_064','CC_Base_L_Forearm_052',
   'CC_Base_R_Hand_068','CC_Base_L_Hand_055',
   'CC_Base_R_Thigh_019','CC_Base_L_Thigh_04',
   'CC_Base_R_Calf_020','CC_Base_L_Calf_05',
   'CC_Base_R_Foot_022','CC_Base_L_Foot_06',
   'CC_Base_NeckTwist01_037','CC_Base_NeckTwist02_038','CC_Base_Head_039',
  ].forEach(n => zero(_weBones[n]));
}
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// END STARTUP SEQUENCE
