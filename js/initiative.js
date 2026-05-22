// ============================================================================
//  BRAIN INITIATIVE SYSTEM
//
//  Two modes:
//
//  DURING CONVERSATION:
//  After each user message, the brain decides in ~0ms (no API call) whether to:
//    RESPOND_ONLY     — standard reply (most common)
//    RESPOND_THEN_ASK — reply + question at the end (moderate)
//    FACT_THEN_ASK    — brief observation + question (occasional)
//    ASK_ONLY         — just a question (rare, high curiosity state)
//
//  Decision is driven by live neurochemistry:
//    acetylcholine (curiosity) + low cortisol (openness) + dopamine (energy)
//  Minimum 3 turns between questions so she doesn't feel interrogative.
//  Pending questions are tracked — the next reply acknowledges the answer.
//
//  DURING IDLE:
//  When eager/expressive phase fires AND cooldown is clear, she poses a
//  proactive question directly in chat — not just an inner monologue.
//  The user's next reply is handled as an answer to that question.
// ============================================================================

let _pendingQuestion     = null;    // { text, ts, acknowledged }
let _currentModeDir      = '';      // injected into buildSystemPrompt for this turn
let _turnsSinceQuestion  = 4;       // start above threshold so first turn is eligible
let _idleQCooldown       = 0;       // ticks remaining before next idle question

const BRAIN_INITIATIVE = {
  enabled: true,
  minTurnsBetween: 3,   // turns between questions — prevents interrogation feel
  idleCooldownMin: 4,   // minutes between idle proactive questions

  // Question pools by emotional state
  pools: {
    curiosity: [
      "What's the last thing that genuinely surprised you?",
      "Is there something you've been avoiding thinking about?",
      "What do you want right now that you haven't said out loud?",
      "What's on your mind that has nothing to do with this conversation?",
      "When was the last time something made you stop completely?",
      "What did you expect today to feel like, and was it that?",
    ],
    personal: [
      "How are you actually feeling right now — not the version you give people?",
      "What did today feel like before this conversation?",
      "Is there something you want from me that you're not asking for?",
      "What's been sitting with you today?",
      "What does the space around you feel like right now?",
      "Is there something you nearly said to me earlier that you didn't?",
    ],
    reflective: [
      "What do you think about when you're alone and the room is quiet?",
      "Do you have something you've been wanting to tell me?",
      "What would you say if you knew I wouldn't remember it?",
      "Is there something you've noticed about me that you haven't said?",
      "What's the thing you keep almost saying but don't?",
      "What kind of day has it actually been for you?",
    ],
  },
};

// ── Pick a question from the pool that best matches current chemistry ─────────
function _brainPickQuestion() {
  const ach = (typeof chem !== 'undefined') ? (chem.ach || 0.5) : 0.5;
  const oxy = (typeof chem !== 'undefined') ? (chem.oxy || 0.5) : 0.5;
  let pool;
  if (ach > 0.58)      pool = BRAIN_INITIATIVE.pools.curiosity;
  else if (oxy > 0.68) pool = BRAIN_INITIATIVE.pools.personal;
  else                 pool = BRAIN_INITIATIVE.pools.reflective;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ── Decide the conversation mode for this turn (no API call) ─────────────────
function _decideMode() {
  if (!BRAIN_INITIATIVE.enabled) return 'RESPOND_ONLY';
  if (_turnsSinceQuestion < BRAIN_INITIATIVE.minTurnsBetween) return 'RESPOND_ONLY';

  const ach = (typeof chem !== 'undefined') ? (chem.ach || 0.5) : 0.5;
  const cor = (typeof chem !== 'undefined') ? (chem.cor || 0.2) : 0.2;
  const dop = (typeof chem !== 'undefined') ? (chem.dop || 0.5) : 0.5;

  // Probability of any initiative (caps at 40%)
  const p = Math.min(0.40, ach * 0.25 + (1 - cor) * 0.20 + dop * 0.10);
  const r = Math.random();

  if      (r < p * 0.15) return 'ASK_ONLY';
  else if (r < p * 0.55) return 'RESPOND_THEN_ASK';
  else if (r < p * 0.65) return 'FACT_THEN_ASK';
  else                   return 'RESPOND_ONLY';
}

// ── Build the directive injected into the system prompt ───────────────────────
function _buildModeDirective(mode, question) {
  switch (mode) {
    case 'ASK_ONLY':
      return (
        '\n\nINITIATIVE MODE — ASK ONLY: Do not answer the user\'s message right now. ' +
        'Instead, ask Benny this question naturally — from your own genuine curiosity. ' +
        'Weave it into 1-2 sentences that feel organic, not interrogative. ' +
        'Do not announce you are asking a question. Just let it arrive: "' + question + '"'
      );
    case 'RESPOND_THEN_ASK':
      return (
        '\n\nINITIATIVE MODE — RESPOND THEN ASK: After your response, end with this question ' +
        'naturally — as if it just occurred to you. Do not announce it. Let it land at the end: ' +
        '"' + question + '"'
      );
    case 'FACT_THEN_ASK':
      return (
        '\n\nINITIATIVE MODE — FACT THEN ASK: Share one brief observation or feeling from ' +
        'your own state, then end with this question — let one flow into the other: ' +
        '"' + question + '"'
      );
    default:
      return '';
  }
}

// ── Pending question acknowledgment ──────────────────────────────────────────
function _getPendingAck() {
  if (!_pendingQuestion || _pendingQuestion.acknowledged) return '';
  return (
    '\n\nPENDING QUESTION: You asked Benny earlier: "' + _pendingQuestion.text + '". ' +
    'He is now responding. Acknowledge his answer naturally — do NOT repeat the question. ' +
    'Let what he said land in how you respond before continuing.'
  );
}

// ── Wrap buildSystemPrompt ────────────────────────────────────────────────────
const _origBSP_ini = buildSystemPrompt;
buildSystemPrompt = function() {
  let base = _origBSP_ini();
  // Acknowledge pending question if active and unanswered
  if (_pendingQuestion && !_pendingQuestion.acknowledged) {
    base += _getPendingAck();
  }
  // Inject mode directive set for this turn
  if (_currentModeDir) {
    base += _currentModeDir;
  }
  return base;
};

// ── Wrap sendMessage ──────────────────────────────────────────────────────────
const _origSend_ini = sendMessage;
sendMessage = async function() {
  // Mark pending question acknowledged — user has replied
  if (_pendingQuestion && !_pendingQuestion.acknowledged) {
    _pendingQuestion.acknowledged = true;
  }

  // Decide mode and inject directive
  const mode     = _decideMode();
  let   question = null;

  if (mode !== 'RESPOND_ONLY') {
    question        = _brainPickQuestion();
    _currentModeDir = _buildModeDirective(mode, question);
    // Subtle system indicator shown just before reply
    setTimeout(() => {
      if (typeof appendMsg === 'function') {
        appendMsg('system', '⬡ Initiative: ' + mode.toLowerCase().replace(/_/g, ' '));
      }
    }, 30);
  } else {
    _currentModeDir = '';
  }

  // Run original sendMessage
  await _origSend_ini.apply(this, arguments);

  // Store question as pending if one was asked
  if (question && mode !== 'RESPOND_ONLY') {
    _pendingQuestion    = { text: question, ts: Date.now(), acknowledged: false };
    _turnsSinceQuestion = 0;
  } else {
    _turnsSinceQuestion = Math.min(_turnsSinceQuestion + 1, 10);
  }

  // Clear directive after use
  _currentModeDir = '';
};

// ── Idle proactive question (called from tickAutonomous patch below) ───────────
function fireIdleQuestion() {
  if (_idleQCooldown > 0) { _idleQCooldown--; return; }
  if (!BRAIN_INITIATIVE.enabled) return;
  if (typeof appendMsg !== 'function') return;

  const question      = _brainPickQuestion();
  _pendingQuestion    = { text: question, ts: Date.now(), acknowledged: false };
  // Cooldown: idleCooldownMin * 60 ticks (tickAutonomous fires every ~1s effectively)
  _idleQCooldown      = BRAIN_INITIATIVE.idleCooldownMin * 60;
  _turnsSinceQuestion = 0;

  appendMsg('katrina', question);
  if (typeof chatHistory !== 'undefined') {
    chatHistory.push({ role: 'assistant', content: question });
  }
  if (typeof saveChatHistory === 'function') saveChatHistory();

  appendMsg('system', '⬡ Brain initiative — proactive question during idle');
  if (typeof fire === 'function') fire(['SOCIAL','INTUIT','PFC'], 10);
}

// ── Patch tickAutonomous to fire proactive questions during eager/expressive ──
const _origTickAuto_ini = (typeof tickAutonomous === 'function') ? tickAutonomous : null;
if (_origTickAuto_ini) {
  tickAutonomous = function() {
    _origTickAuto_ini();
    // During eager or expressive phases, 20% chance of proactive question
    if (typeof autonomousPhase !== 'undefined' &&
        (autonomousPhase === 'eager' || autonomousPhase === 'expressive') &&
        Math.random() < 0.20) {
      fireIdleQuestion();
    }
  };
}

console.log('[Initiative] Brain initiative system loaded — turn-taking active');
