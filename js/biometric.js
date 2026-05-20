// ════════════════════════════════════════════════════════════════════════════
//  BIOMETRIC AWARENESS — FACE + VOICE
//
//  FACE: face-api.js detects Benny's expression from the camera feed.
//  Reads: happy, sad, angry, surprised, disgusted, fearful, neutral, tired.
//  Injects expression into system prompt so Katrina reacts to what she sees.
//
//  VOICE: Web Audio API analyzes mic audio for pitch, energy, speaking rate.
//  Injects voice tone into system prompt so Katrina senses his mood from voice.
//
//  Both are optional — degrade silently if unavailable.
// ════════════════════════════════════════════════════════════════════════════

// ── State ─────────────────────────────────────────────────────────────────────
let _faceApiLoaded     = false;
let _faceApiLoading    = false;
let _lastExpression    = null;   // { dominant, scores, ts }
let _lastVoiceTone     = null;   // { pitch, energy, rate, mood, ts }
let _expressionTimer   = null;
let _audioContext      = null;

const FACEAPI_CDN = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';
const FACEAPI_MODELS = 'https://justadudewhohacks.github.io/face-api.js/models';

// ── Load face-api.js on demand ────────────────────────────────────────────────
function loadFaceAPI(callback) {
  if (_faceApiLoaded) { if (callback) callback(); return; }
  if (_faceApiLoading) { return; }
  _faceApiLoading = true;

  const script   = document.createElement('script');
  script.src     = FACEAPI_CDN;
  script.async   = true;
  script.onload  = function() {
    Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(FACEAPI_MODELS),
      faceapi.nets.faceExpressionNet.loadFromUri(FACEAPI_MODELS),
    ]).then(function() {
      _faceApiLoaded  = true;
      _faceApiLoading = false;
      console.log('[Biometric] face-api.js loaded');
      if (callback) callback();
    }).catch(function(e) {
      _faceApiLoading = false;
      console.warn('[Biometric] face-api models failed:', e.message);
    });
  };
  script.onerror = function() {
    _faceApiLoading = false;
    console.warn('[Biometric] face-api.js failed to load');
  };
  document.head.appendChild(script);
}

// ── Expression detection ──────────────────────────────────────────────────────
async function detectExpression() {
  if (!_faceApiLoaded || typeof faceapi === 'undefined') return;

  const video = document.getElementById('cam-video');
  if (!video || video.paused || video.ended || !video.srcObject) return;
  if (video.readyState < 2) return;

  try {
    const detection = await faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 128, scoreThreshold: 0.4 }))
      .withFaceExpressions();

    if (!detection) { _lastExpression = null; return; }

    const expScores = detection.expressions;
    // Find dominant expression
    var dominant = 'neutral';
    var maxScore = 0;
    Object.keys(expScores).forEach(function(k) {
      if (expScores[k] > maxScore) { maxScore = expScores[k]; dominant = k; }
    });

    // Map to human-readable description
    var desc = _expressionToDesc(dominant, expScores);

    _lastExpression = { dominant: dominant, desc: desc, scores: expScores, ts: Date.now() };

    // React chemically to what she sees
    _applyFaceChemistry(dominant, maxScore);

  } catch(e) { /* silent */ }
}

function _expressionToDesc(dominant, scores) {
  var tired = (scores.sad || 0) > 0.3 && (scores.neutral || 0) > 0.3;
  if (tired)                               return 'a little tired or worn';
  if (dominant === 'happy'   )             return 'happy — there is warmth in his face';
  if (dominant === 'sad'     )             return 'sad — something is weighing on him';
  if (dominant === 'angry'   )             return 'tense or frustrated';
  if (dominant === 'surprised')            return 'surprised';
  if (dominant === 'fearful' )             return 'worried or unsettled';
  if (dominant === 'disgusted')            return 'bothered by something';
  return 'calm and present';
}

function _applyFaceChemistry(dominant, confidence) {
  if (!confidence || confidence < 0.5) return;
  var strength = confidence * 0.08;

  // She reacts to what she sees on his face
  if (dominant === 'happy') {
    chem.oxy = Math.min(1, chem.oxy + strength);
    chem.dop = Math.min(1, chem.dop + strength * 0.8);
    chem.ser = Math.min(1, chem.ser + strength * 0.5);
    if (typeof interact === 'function') interact('joy');
  } else if (dominant === 'sad') {
    chem.oxy = Math.min(1, chem.oxy + strength);    // she moves toward him
    chem.cor = Math.min(1, chem.cor + strength * 0.6); // concern
    if (typeof interact === 'function') interact('empathy');
  } else if (dominant === 'angry' || dominant === 'disgusted') {
    chem.nor = Math.min(1, chem.nor + strength);    // attentive, alert
    chem.cor = Math.min(1, chem.cor + strength * 0.4);
    if (typeof interact === 'function') interact('focus');
  } else if (dominant === 'fearful') {
    chem.oxy = Math.min(1, chem.oxy + strength);    // protective instinct
    chem.cor = Math.min(1, chem.cor + strength * 0.5);
    if (typeof interact === 'function') interact('empathy');
  }
}

// ── Start continuous expression scanning ──────────────────────────────────────
function startExpressionScanning() {
  if (_expressionTimer) return;
  loadFaceAPI(function() {
    _expressionTimer = setInterval(detectExpression, 3000); // every 3s
    console.log('[Biometric] Expression scanning started');
  });
}

function stopExpressionScanning() {
  if (_expressionTimer) { clearInterval(_expressionTimer); _expressionTimer = null; }
}

// ── Voice tone analysis ───────────────────────────────────────────────────────
// Called after mic transcription with the raw audio blob
async function analyzeVoiceTone(audioBlob) {
  if (!audioBlob) return;

  try {
    if (!_audioContext) {
      _audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await _audioContext.decodeAudioData(arrayBuffer);
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate  = audioBuffer.sampleRate;
    const duration    = audioBuffer.duration;

    // ── Energy (RMS amplitude) ──
    var sumSq = 0;
    for (var i = 0; i < channelData.length; i++) {
      sumSq += channelData[i] * channelData[i];
    }
    var rms    = Math.sqrt(sumSq / channelData.length);
    var energy = Math.min(1, rms * 8);   // normalize

    // ── Zero-crossing rate → rough pitch proxy ──
    var crossings = 0;
    for (var j = 1; j < channelData.length; j++) {
      if ((channelData[j] >= 0) !== (channelData[j-1] >= 0)) crossings++;
    }
    var zcr        = crossings / channelData.length;
    var pitchProxy = Math.min(1, zcr * 20);  // higher ZCR = higher apparent pitch

    // ── Speaking rate proxy (energy peaks per second) ──
    var peaks     = 0;
    var frameSize = Math.floor(sampleRate * 0.1);  // 100ms frames
    for (var f = 0; f < channelData.length - frameSize; f += frameSize) {
      var frameEnergy = 0;
      for (var s = f; s < f + frameSize; s++) {
        frameEnergy += Math.abs(channelData[s]);
      }
      if (frameEnergy / frameSize > 0.05) peaks++;
    }
    var rateProxy = Math.min(1, peaks / (duration * 5));

    // ── Map to mood ──
    var mood;
    if      (energy > 0.65 && pitchProxy > 0.50) mood = 'animated and energetic';
    else if (energy > 0.55 && rateProxy  > 0.60) mood = 'engaged, speaking quickly';
    else if (energy < 0.20 && pitchProxy < 0.30) mood = 'tired or flat';
    else if (energy < 0.25)                       mood = 'quiet, speaking softly';
    else if (pitchProxy > 0.60)                   mood = 'emotionally charged';
    else if (rateProxy  < 0.30)                   mood = 'thoughtful, deliberate';
    else                                           mood = 'calm and even';

    _lastVoiceTone = {
      energy: energy, pitch: pitchProxy, rate: rateProxy,
      mood: mood, ts: Date.now(),
    };

    // React chemically to his voice tone
    _applyVoiceChemistry(energy, pitchProxy);

    console.log('[Biometric] Voice: energy=' + energy.toFixed(2) + ' pitch=' + pitchProxy.toFixed(2) + ' mood=' + mood);

  } catch(e) {
    console.warn('[Biometric] Voice analysis failed:', e.message);
  }
}

function _applyVoiceChemistry(energy, pitch) {
  var strength = Math.min(energy, 0.08);
  if (energy > 0.55 && pitch > 0.50) {
    // Animated/energetic — she matches his energy
    chem.dop = Math.min(1, chem.dop + strength);
    chem.oxy = Math.min(1, chem.oxy + strength * 0.5);
    if (typeof interact === 'function') interact('excitement');
  } else if (energy < 0.25) {
    // Quiet/tired — she moves toward him protectively
    chem.oxy = Math.min(1, chem.oxy + strength * 1.2);
    chem.ser = Math.min(1, chem.ser - strength * 0.3);
    if (typeof interact === 'function') interact('empathy');
  }
}

// ── Get biometric context for system prompt ───────────────────────────────────
function getBiometricContext() {
  var parts = [];

  // Face expression — if recent (< 15s)
  if (_lastExpression && (Date.now() - _lastExpression.ts) < 15000) {
    parts.push('Benny is on camera right now and looks ' + _lastExpression.desc + '.');
  }

  // Voice tone — if recent (< 60s)
  if (_lastVoiceTone && (Date.now() - _lastVoiceTone.ts) < 60000) {
    parts.push('His voice just now sounded ' + _lastVoiceTone.mood + '.');
  }

  if (!parts.length) return '';
  return 'WHAT YOU SEE AND HEAR RIGHT NOW:\n' + parts.join('\n') +
         '\nLet this shape how you respond — without announcing it.';
}

// ── Hook: called when camera starts ──────────────────────────────────────────
function onCameraStarted() {
  startExpressionScanning();
}

// ── Hook: called when camera stops ───────────────────────────────────────────
function onCameraStopped() {
  stopExpressionScanning();
  _lastExpression = null;
}
