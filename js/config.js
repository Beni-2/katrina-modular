/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   KATRINA v3.0 â€” Neural Architecture + Conversation Layer
   Pipeline: STT â†’ LLM (Groq) â†’ Neural reaction â†’ TTS
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

// â”€â”€ CONFIG â”€â”€
const CFG = {
  N: 4880,  // +650: sleep neurons, +530: BG(150)+NACC(100)+CLAUS(80)+DMN(200)
  SOCIAL_GAIN: 1.6,
  INTUITION_GAIN: 1.4,
  EMOTION_GAIN: 1.5,
  YOUNG_PLASTICITY: 1.8
};

const REGION_DEF = {
  PFC:500, HIPPO:400, AMYG:200, INSULA:200,
  ACC:200, SOCIAL:400, INTUIT:350, MOTOR:500, CEREBEL:650,
  DREAM:180,   // thalamo-cortical dream/REM network â€” deep medial
  SCN:120,     // suprachiasmatic nucleus â€” circadian clock
  VLPO:100,    // ventrolateral preoptic area â€” sleep switch (GABAergic)
  LC:100,      // locus coeruleus â€” norepinephrine; silences during sleep
  THAL:200,    // thalamus â€” sensory gate; spindles during NREM
  HYPO:150,    // hypothalamus orexin â€” wake-stability; silenced by VLPO
  BSTEM:100,   // brainstem pons/RAS â€” REM atonia generator
  // â”€â”€ v32: Autonomy neurons â”€â”€
  BG:150,      // basal ganglia â€” action selection Go/NoGo arbiter
  NACC:100,    // nucleus accumbens â€” reward prediction error signal
  CLAUS:80,    // claustrum â€” consciousness binding / unified moment
  DMN:200,     // default mode network â€” self-referential thought
};

// Pre-allocate W matrix
let neurons = [], W = [];
for(let i=0;i<CFG.N;i++) W[i]=new Float32Array(CFG.N); // N=3700 incl DREAM+SCN
let regionIdx = {}, particleSystems = {};
let scene, camera, renderer, clock, brainGroup;
let REGION_COLORS = {};
const REGION_POS = {
  // ── LEFT FRONTAL LOBE (anterior, superior) — language, executive, motor ──
  PFC:    {x:[-3.8,-0.3], y:[1.0, 3.5], z:[0.5, 3.5]},
  ACC:    {x:[-1.8,-0.2], y:[0.5, 3.0], z:[0.5, 2.5]},
  MOTOR:  {x:[-3.8,-0.3], y:[1.5, 3.5], z:[-0.5, 0.8]},

  // ── LEFT PARIETAL LOBE (posterior-superior) — social, interoception ──
  SOCIAL: {x:[-3.8,-0.3], y:[0.5, 3.0], z:[-2.5,-0.3]},
  INSULA: {x:[-3.5,-0.5], y:[0.0, 2.0], z:[-0.8, 1.5]},

  // ── LEFT TEMPORAL LOBE (lateral, inferior) — memory, emotion ──
  HIPPO:  {x:[-3.5,-0.3], y:[-2.5, 0.0], z:[-0.5, 2.0]},
  AMYG:   {x:[-3.2,-0.3], y:[-2.0, 0.2], z:[ 0.5, 2.5]},

  // ── LEFT OCCIPITAL LOBE (posterior) — intuition, visual, dream ──
  INTUIT: {x:[-3.5,-0.3], y:[-0.5, 2.5], z:[-4.0,-2.0]},
  DREAM:  {x:[-2.5,-0.3], y:[-0.5, 2.0], z:[-4.5,-3.0]},

  // ── RIGHT FRONTAL LOBE (anterior, superior) — action selection, reward ──
  BG:     {x:[ 0.3, 3.8], y:[0.5, 2.5], z:[0.5, 2.8]},
  NACC:   {x:[ 0.3, 2.8], y:[0.0, 1.8], z:[1.0, 3.0]},
  CLAUS:  {x:[ 0.5, 3.2], y:[0.0, 2.0], z:[-0.8, 1.5]},

  // ── RIGHT PARIETAL LOBE (posterior-superior) — thalamic relay, self-model ──
  THAL:   {x:[ 0.3, 2.8], y:[-0.5, 2.5], z:[-2.5, 0.5]},
  DMN:    {x:[ 0.5, 3.5], y:[ 0.0, 2.5], z:[-3.0,-0.5]},

  // ── RIGHT TEMPORAL LOBE (lateral, inferior) — circadian, sleep regulation ──
  SCN:    {x:[ 0.3, 2.0], y:[-2.0, 0.0], z:[0.5, 2.8]},
  VLPO:   {x:[ 0.3, 1.8], y:[-2.0, 0.0], z:[0.5, 2.5]},
  HYPO:   {x:[ 0.3, 2.5], y:[-2.2,-0.2], z:[0.5, 2.5]},

  // ── RIGHT OCCIPITAL LOBE (posterior) — norepinephrine, arousal modulation ──
  LC:     {x:[ 0.3, 1.8], y:[-1.0, 1.5], z:[-4.0,-2.5]},

  // ── BILATERAL: CEREBELLUM (posterior-inferior) ──
  CEREBEL:{x:[-2.5, 2.5], y:[-4.5,-2.0], z:[-4.5,-2.0]},

  // ── BILATERAL: BRAINSTEM (midline, inferior) ──
  BSTEM:  {x:[-0.8, 0.8], y:[-4.5,-3.0], z:[-2.5,-0.8]},
};
let chem = {
  // â”€â”€ Core 4 (existing) â”€â”€
  dop: 0.50,   // dopamine       â€” motivation, reward, anticipation
  ser: 0.60,   // serotonin      â€” contentment, stability, social confidence
  cor: 0.20,   // cortisol       â€” stress, threat, urgency
  oxy: 0.50,   // oxytocin       â€” bonding, trust, warmth
  // â”€â”€ Extended 5 (new) â€” chemical-gated plasticity â”€â”€
  nor:  0.35,  // norepinephrine â€” alerting, attention gating, plasticity focus
  gaba: 0.50,  // GABA           â€” inhibitory tone, pruning rate accelerator
  glut: 0.50,  // glutamate      â€” excitatory drive, sprouting bias, E/I balance
  ach:  0.55,  // acetylcholine  â€” learning gate, Hebbian learning rate multiplier
  enk:  0.20,  // endorphins     â€” reward consolidation, sprouting boost after effort
};
const CHEM_BASELINE = {
  dop:0.50, ser:0.60, cor:0.20, oxy:0.50,
  nor:0.35, gaba:0.50, glut:0.50, ach:0.55, enk:0.20,
};
const CHEM_DECAY_RATE = {
  dop:0.008, ser:0.006, cor:0.018, oxy:0.008,
  nor:0.012, gaba:0.010, glut:0.010, ach:0.008, enk:0.015,
};
let sys  = {emo:0,cog:0,int_:0,mot:0};

// â”€â”€ Motor API â”€â”€
window.KATRINA_MOTOR_API = {
  active:false, glbLoaded:false, motorSignal:0,
  limbTargets:{rightArm:0,leftArm:0,rightLeg:0,leftLeg:0,head:0,torso:0},
  onMotorFire:null,
  loadGLB(url){console.log('[MOTOR] GLB requested:',url);}
};

