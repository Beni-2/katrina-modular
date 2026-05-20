// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// âš   DO NOT DELETE â€” POSE SNAPSHOT & BLEND SYSTEM
//
//  Captures the full 72-bone skeleton as a coordinate snapshot.
//  Blends from current pose to any target pose block over a duration.
//  Pose blocks can be generated from:
//  â€” Named library poses (defined below)
//  â€” LLM-generated bone targets from text input
//  â€” Brain-decided choreography
//  â€” User-recorded live poses via _weCaptureCurrentPose()
//
//  API:
//  _weCaptureCurrentPose()         â†’ returns snapshot object {boneName:{x,y,z}}
//  _weBlendToPose(poseBlock, dur)  â†’ lerps skeleton to poseBlock over dur seconds
//  _weStopBlend()                  â†’ stops active blend immediately
//  _weApplyPoseBlock(poseBlock)    â†’ applies pose instantly (no blend)
//  _weBlendFromLLM(text)          â†’ asks LLM to generate pose from text description
//
//  POSE BLOCK FORMAT:
//  {
//    'CC_Base_Head_039':     { x: -0.12, y: 0.0,  z: 0.0  },
//    'CC_Base_R_Upperarm_063': { x: 1.80,  y: 0.20, z: 0.35 },
//    ... (only bones you want to override â€” others stay at current)
//  }
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// â”€â”€ Active blend state â”€â”€
let _wePoseBlend = {
  active:    false,
  startSnap: {},    // starting bone rotations
  targetSnap:{},    // target bone rotations
  elapsed:   0,
  duration:  1.0,
  onComplete:null,
};

// â”€â”€ Capture current skeleton pose as a snapshot â”€â”€
function _weCaptureCurrentPose() {
  const snap = {};
  for (const [name, bone] of Object.entries(_weBones)) {
    snap[name] = {
      x: bone.rotation.x,
      y: bone.rotation.y,
      z: bone.rotation.z,
    };
  }
  return snap;
}

// â”€â”€ Print current pose to console (for authoring new poses) â”€â”€
function _wePrintCurrentPose() {
  const snap = _weCaptureCurrentPose();
  const lines = Object.entries(snap)
    .filter(([,r]) => Math.abs(r.x)+Math.abs(r.y)+Math.abs(r.z) > 0.01)
    .map(([n,r]) => `  '${n}': {x:${r.x.toFixed(4)}, y:${r.y.toFixed(4)}, z:${r.z.toFixed(4)}},`);
  console.log('// Captured pose:');
  console.log('{');
  lines.forEach(l => console.log(l));
  console.log('}');
  return snap;
}

// â”€â”€ Apply a pose block instantly â”€â”€
function _weApplyPoseBlock(poseBlock) {
  if (!poseBlock || typeof poseBlock !== 'object') return;
  for (const [name, rot] of Object.entries(poseBlock)) {
    const bone = _weBones[name];
    if (!bone) continue;
    if (rot.x !== undefined) bone.rotation.x = rot.x;
    if (rot.y !== undefined) bone.rotation.y = rot.y;
    if (rot.z !== undefined) bone.rotation.z = rot.z;
  }
}

// â”€â”€ Stop active blend â”€â”€
function _weStopBlend() {
  _wePoseBlend.active = false;
  _wePoseBlend.onComplete = null;
}

// â”€â”€ Blend from current pose to target pose block â”€â”€
// dur: duration in seconds. onComplete: optional callback.
function _weBlendToPose(poseBlock, dur, onComplete) {
  if (!poseBlock || !_weBody) return;
  _wePoseBlend.startSnap  = _weCaptureCurrentPose();
  _wePoseBlend.targetSnap = poseBlock;
  _wePoseBlend.elapsed    = 0;
  _wePoseBlend.duration   = dur || 0.8;
  _wePoseBlend.active     = true;
  _wePoseBlend.onComplete = onComplete || null;
}

// â”€â”€ Tick blend â€” called from WE_loop every frame â”€â”€
function _weTickPoseBlend(dt) {
  if (!_wePoseBlend.active) return;
  _wePoseBlend.elapsed += dt;
  const raw = _wePoseBlend.elapsed / _wePoseBlend.duration;
  const t   = Math.min(1, raw);
  // Ease in-out cubic
  const p   = t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2;

  for (const [name, tgt] of Object.entries(_wePoseBlend.targetSnap)) {
    const bone = _weBones[name];
    if (!bone) continue;
    const src = _wePoseBlend.startSnap[name] || {x:0,y:0,z:0};
    if (tgt.x !== undefined) bone.rotation.x = src.x + (tgt.x - src.x) * p;
    if (tgt.y !== undefined) bone.rotation.y = src.y + (tgt.y - src.y) * p;
    if (tgt.z !== undefined) bone.rotation.z = src.z + (tgt.z - src.z) * p;
  }

  if (t >= 1) {
    _wePoseBlend.active = false;
    if (typeof _wePoseBlend.onComplete === 'function') _wePoseBlend.onComplete();
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// âš   DO NOT DELETE â€” NAMED POSE LIBRARY
//
//  Each pose is a coordinate block of CC_Base bone rotations.
//  Captured from the live skeleton using _wePrintCurrentPose().
//  Add new poses by:
//  1. Manually pose the model via _weApplyPoseBlock({...}) in console
//  2. Call _wePrintCurrentPose() to capture coordinates
//  3. Paste the output as a new entry here
//
//  Poses are blended to via _weBlendToPose(WE_POSES.poseName, duration)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const WE_POSES = {

  neutral: {
    'CC_Base_Spine01_035':    {x: 0.00, y: 0.00, z: 0.00},
    'CC_Base_Spine02_036':    {x: 0.00, y: 0.00, z: 0.00},
    'CC_Base_Hip_02':         {x: 0.00, y: 0.00, z: 0.00},
    'CC_Base_Head_039':       {x: 0.00, y: 0.00, z: 0.00},
    'CC_Base_NeckTwist01_037':{x: 0.00, y: 0.00, z: 0.00},
    'CC_Base_NeckTwist02_038':{x: 0.00, y: 0.00, z: 0.00},
    'CC_Base_R_Upperarm_063': {x: 0.04, y: 0.05, z:-0.18},
    'CC_Base_L_Upperarm_051': {x: 0.04, y:-0.05, z: 0.18},
    'CC_Base_R_Forearm_064':  {x: 0.08, y: 0.05, z: 0.00},
    'CC_Base_L_Forearm_052':  {x: 0.08, y:-0.05, z: 0.00},
    'CC_Base_R_Hand_068':     {x: 0.02, y: 0.00, z: 0.02},
    'CC_Base_L_Hand_055':     {x: 0.02, y: 0.00, z:-0.02},
  },

  attention: {
    'CC_Base_Spine01_035':    {x:-0.04, y: 0.00, z: 0.00},
    'CC_Base_Spine02_036':    {x:-0.03, y: 0.00, z: 0.00},
    'CC_Base_Head_039':       {x:-0.05, y: 0.00, z: 0.00},
    'CC_Base_NeckTwist01_037':{x:-0.03, y: 0.00, z: 0.00},
    'CC_Base_R_Upperarm_063': {x: 0.05, y: 0.05, z:-0.20},
    'CC_Base_L_Upperarm_051': {x: 0.05, y:-0.05, z: 0.20},
    'CC_Base_R_Forearm_064':  {x: 0.10, y: 0.05, z: 0.00},
    'CC_Base_L_Forearm_052':  {x: 0.10, y:-0.05, z: 0.00},
  },

  thinking: {
    // Right hand toward chin, head tilted right â€” axes corrected for -PI/2 root
    'CC_Base_Head_039':        {x: 0.00, y: 0.18, z:-0.12},
    'CC_Base_NeckTwist01_037': {x: 0.00, y: 0.08, z:-0.06},
    'CC_Base_NeckTwist02_038': {x: 0.00, y: 0.04, z:-0.03},
    'CC_Base_Spine01_035':     {x: 0.00, y: 0.00, z: 0.00},
    // Right arm â€” bring elbow up, forearm inward toward chin
    'CC_Base_R_Clavicle_062':  {x: 0.00, y: 0.00, z:-0.12},
    'CC_Base_R_Upperarm_063':  {x: 0.55, y:-0.25, z:-0.18},
    'CC_Base_R_Forearm_064':   {x: 0.70, y:-0.30, z: 0.00},
    'CC_Base_R_Hand_068':      {x: 0.12, y:-0.10, z: 0.06},
    // Left arm â€” relaxed at side, slight cross-body
    'CC_Base_L_Clavicle_050':  {x: 0.00, y: 0.00, z: 0.05},
    'CC_Base_L_Upperarm_051':  {x: 0.30, y: 0.10, z: 0.40},
    'CC_Base_L_Forearm_052':   {x: 0.45, y: 0.15, z: 0.00},
    'CC_Base_L_Hand_055':      {x: 0.08, y: 0.05, z:-0.04},
  },

  open_arms: {
    // Arms open to sides at chest height â€” welcoming, not overhead
    'CC_Base_R_Upperarm_063': {x: 0.25, y:-0.08, z:-0.45},
    'CC_Base_L_Upperarm_051': {x: 0.25, y: 0.08, z: 0.45},
    'CC_Base_R_Forearm_064':  {x: 0.18, y:-0.06, z: 0.00},
    'CC_Base_L_Forearm_052':  {x: 0.18, y: 0.06, z: 0.00},
    'CC_Base_R_Hand_068':     {x: 0.05, y: 0.00, z: 0.06},
    'CC_Base_L_Hand_055':     {x: 0.05, y: 0.00, z:-0.06},
    'CC_Base_Head_039':       {x:-0.05, y: 0.00, z: 0.00},
    'CC_Base_Spine01_035':    {x:-0.04, y: 0.00, z: 0.00},
  },

  point_forward: {
    'CC_Base_R_Upperarm_063': {x: 0.90, y:-0.15, z:-0.18},
    'CC_Base_R_Forearm_064':  {x: 0.10, y:-0.10, z: 0.00},
    'CC_Base_R_Hand_068':     {x: 0.05, y:-0.08, z: 0.00},
    'CC_Base_Head_039':       {x:-0.05, y: 0.00, z: 0.00},
  },

  shrug: {
    // Shoulders rise, forearms bent up in FRONT of body, palms face outward
    // x=0.55 pitches arms forward so elbows are in front of shoulder plane
    // R upperarm y=+0.20 rotates right elbow outward-right (away from midline)
    // L upperarm y=-0.20 rotates left elbow outward-left (away from midline)
    // forearm x=1.10 bends elbow so hands appear at chest/face height in front
    'CC_Base_R_Clavicle_062':  {x: 0.00, y: 0.00, z:-0.13},
    'CC_Base_L_Clavicle_050':  {x: 0.00, y: 0.00, z: 0.13},
    'CC_Base_R_Upperarm_063':  {x: 1.5708, y: 0.20, z:-0.20},
    'CC_Base_L_Upperarm_051':  {x: 1.5708, y:-0.20, z: 0.20},
    'CC_Base_R_Forearm_064':   {x: 0.00, y: 0.18, z: 0.00},
    'CC_Base_L_Forearm_052':   {x: 0.00, y:-0.18, z: 0.00},
    'CC_Base_R_Hand_068':      {x: 0.05, y: 0.22, z: 0.06},
    'CC_Base_L_Hand_055':      {x: 0.05, y:-0.22, z:-0.06},
    'CC_Base_Head_039':        {x: 0.00, y: 0.00, z: 0.00},
    'CC_Base_NeckTwist01_037': {x: 0.00, y: 0.00, z: 0.00},
  },

  wave: {
    'CC_Base_L_Clavicle_050':  {x:-1.865, y:-0.071, z:-1.847},
  },

  hands_prayer: {
    'CC_Base_R_Upperarm_063': {x: 0.70, y:-0.30, z:-0.10},
    'CC_Base_L_Upperarm_051': {x: 0.70, y: 0.30, z: 0.10},
    'CC_Base_R_Forearm_064':  {x: 0.80, y: 0.35, z: 0.00},
    'CC_Base_L_Forearm_052':  {x: 0.80, y:-0.35, z: 0.00},
    'CC_Base_R_Hand_068':     {x: 0.10, y: 0.00, z:-0.10},
    'CC_Base_L_Hand_055':     {x: 0.10, y: 0.00, z: 0.10},
    'CC_Base_Head_039':       {x:-0.10, y: 0.00, z: 0.00},
    'CC_Base_NeckTwist01_037':{x:-0.05, y: 0.00, z: 0.00},
  },

  victory: {
    'CC_Base_L_Clavicle_050':  {x:-1.865, y:-0.071, z:-1.847},
    'CC_Base_R_Clavicle_062':  {x:-2.345, y: 0.055, z: 1.645},
  },

  defensive: {
    'CC_Base_R_Upperarm_063': {x: 0.60, y: 0.10, z: 0.15},
    'CC_Base_L_Upperarm_051': {x: 0.60, y:-0.10, z:-0.15},
    'CC_Base_R_Forearm_064':  {x: 0.80, y: 0.50, z: 0.00},
    'CC_Base_L_Forearm_052':  {x: 0.80, y:-0.50, z: 0.00},
    'CC_Base_Head_039':       {x: 0.08, y: 0.00, z: 0.00},
    'CC_Base_Spine01_035':    {x: 0.05, y: 0.00, z: 0.00},
    'CC_Base_Spine02_036':    {x: 0.05, y: 0.00, z: 0.00},
  },

};

// â”€â”€ Shake foot sequence â€” simultaneous bone blend, no circular arc â”€â”€
function _weAnimateShakeFoot() {
  if (!_weBody) return;
  const SLOW = 3.0;

  // Helper: snapshot live bone rotations at call time, tween to target, call onDone
  function tweenBones(targets, dur, onDone) {
    const from = {};
    Object.keys(targets).forEach(n => {
      const b = _weBones[n];
      if (b) from[n] = {x: b.rotation.x, y: b.rotation.y, z: b.rotation.z};
    });
    const startTime = performance.now();
    const durMs = dur * 1000;
    const tick = (now) => {
      const t = Math.min(1, (now - startTime) / durMs);
      const p = t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2;
      Object.keys(targets).forEach(n => {
        const b = _weBones[n];
        if (b && from[n]) {
          b.rotation.x = from[n].x + (targets[n].x - from[n].x) * p;
          b.rotation.y = from[n].y + (targets[n].y - from[n].y) * p;
          b.rotation.z = from[n].z + (targets[n].z - from[n].z) * p;
        }
      });
      if (t < 1) requestAnimationFrame(tick);
      else if (onDone) setTimeout(onDone, 0);
    };
    requestAnimationFrame(tick);
  }

  // Capture rest of only the 3 bones before anything moves
  const rest = {};
  ['CC_Base_L_Thigh_04','CC_Base_L_Calf_05','CC_Base_L_Foot_06'].forEach(n => {
    const b = _weBones[n];
    if (b) rest[n] = {x: b.rotation.x, y: b.rotation.y, z: b.rotation.z};
  });

  // Step 1: lift all 3 simultaneously
  tweenBones({
    'CC_Base_L_Thigh_04': {x:-1.535, y:-0.000, z:-3.125},
    'CC_Base_L_Calf_05':  {x:-2.160, y:-0.053, z:-0.020},
    'CC_Base_L_Foot_06':  {x: 0.878, y:-0.092, z:-0.055},
  }, SLOW, () => {

    // Step 2: flex foot only â€” delayed until step 1 fully rendered
    setTimeout(() => {
      tweenBones({
        'CC_Base_L_Foot_06': {x: 0.425, y:-0.092, z:-0.055},
      }, SLOW, () => {

        // Step 3: return all 3 to rest â€” delayed until step 2 fully rendered
        setTimeout(() => {
          tweenBones(rest, SLOW * 1.5, null);
        }, 0);
      });
    }, 0);
  });
}


// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// â¬¡  PROCEDURAL MOTION BRAIN
//
//  HOW TO ADD A NEW MOVEMENT:
//  1. Define a MOTION SEQUENCE in _WE_MOTION_SEQUENCES below:
//     Each sequence is an array of steps: { bones:{boneName:{x,y,z},...}, dur:seconds }
//     Steps play in order. Each step tweens ONLY the listed bones simultaneously.
//     All unlisted bones stay still â€” no arc, no unintended movement.
//
//  2. Define EMOTIONAL TRIGGERS in _WE_MOTION_RULES below:
//     Map a chemical/emotional condition (e.g. high cortisol = stress) to a sequence name.
//     The brain checks these every tick and fires the matching sequence.
//
//  3. Keyword trigger (optional):
//     Add an entry to _WE_MOTION_KEYWORDS to let text also trigger the sequence.
//
//  EXAMPLE â€” defining "nod_slow" as a motion sequence:
//  _WE_MOTION_SEQUENCES['nod_slow'] = [
//    { bones:{ 'CC_Base_Head_039':{x:0.25,y:0,z:0} }, dur:0.8 },
//    { bones:{ 'CC_Base_Head_039':{x:-0.05,y:0,z:0} }, dur:0.8 },
//  ];
//
//  BONE PATH PRINCIPLE:
//  â€” List bones in proximalâ†’distal order (shoulderâ†’elbowâ†’wrist, hipâ†’kneeâ†’foot)
//  â€” Child bones follow parents automatically â€” only override if needed
//  â€” Keep x/y/z close to rest values to avoid anatomical distortion
//  â€” Use the glb_body_coor tool to find exact coordinates for any pose
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// â”€â”€ Motion sequence library â”€â”€
// Each sequence: array of { bones: {boneName:{x,y,z}}, dur: seconds }
const _WE_MOTION_SEQUENCES = {};

// â”€â”€ shake_foot registered as a motion sequence â”€â”€
_WE_MOTION_SEQUENCES['shake_foot'] = [
  { bones: {
      'CC_Base_L_Thigh_04': {x:-1.535, y:-0.000, z:-3.125},
      'CC_Base_L_Calf_05':  {x:-2.160, y:-0.053, z:-0.020},
      'CC_Base_L_Foot_06':  {x: 0.878, y:-0.092, z:-0.055},
    }, dur: 3.0 },
  { bones: {
      'CC_Base_L_Foot_06':  {x: 0.425, y:-0.092, z:-0.055},
    }, dur: 3.0 },
  // Step 3 (return to rest) is handled automatically by _weRunMotionSequence
];

// â”€â”€ Core sequence runner â”€â”€
// Tweens each step's bones using performance.now(), chains via onDone, returns to rest
function _weRunMotionSequence(seqName, onFinish) {
  const seq = _WE_MOTION_SEQUENCES[seqName];
  if (!seq || !_weBody) return;

  // Snapshot rest for ALL bones used in this sequence
  const allBoneNames = [...new Set(seq.flatMap(s => Object.keys(s.bones)))];
  const rest = {};
  allBoneNames.forEach(n => {
    const b = _weBones[n];
    if (b) rest[n] = {x: b.rotation.x, y: b.rotation.y, z: b.rotation.z};
  });

  // Tween only listed bones, snapshot from current live values each step
  function tweenStep(targets, dur, onDone) {
    const from = {};
    Object.keys(targets).forEach(n => {
      const b = _weBones[n];
      if (b) from[n] = {x: b.rotation.x, y: b.rotation.y, z: b.rotation.z};
    });
    const startMs = performance.now();
    const durMs   = dur * 1000;
    const tick = (now) => {
      const t = Math.min(1, (now - startMs) / durMs);
      const p = t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2;
      Object.keys(targets).forEach(n => {
        const b = _weBones[n];
        if (b && from[n]) {
          b.rotation.x = from[n].x + (targets[n].x - from[n].x) * p;
          b.rotation.y = from[n].y + (targets[n].y - from[n].y) * p;
          b.rotation.z = from[n].z + (targets[n].z - from[n].z) * p;
        }
      });
      if (t < 1) requestAnimationFrame(tick);
      else if (onDone) setTimeout(onDone, 0);
    };
    requestAnimationFrame(tick);
  }

  // Chain all steps, then return to rest
  function runStep(i) {
    if (i < seq.length) {
      tweenStep(seq[i].bones, seq[i].dur, () => runStep(i + 1));
    } else {
      // All steps done â€” return to rest
      tweenStep(rest, 3.0, onFinish || null);
    }
  }
  runStep(0);
}

// â”€â”€ Emotional motion rules â”€â”€
// Format: { condition: fn()=>bool, sequence: 'seqName', cooldown: seconds }
// Brain checks these on tickAutonomous and fires the sequence when condition is true
const _WE_MOTION_RULES = [
  // High cortisol (stress/anxiety) â†’ shake foot (nervous fidget)
  { condition: () => typeof chem !== 'undefined' && chem.cor > 0.75,
    sequence: 'shake_foot', cooldown: 30 },
];

// â”€â”€ Cooldown tracker â”€â”€
const _weMotionCooldowns = {};

// â”€â”€ Brain motion tick â€” called from tickAutonomous â”€â”€
function _weMotionBrainTick() {
  if (!_weBody) return;
  const now = Date.now();
  for (const rule of _WE_MOTION_RULES) {
    const last = _weMotionCooldowns[rule.sequence] || 0;
    if ((now - last) / 1000 < rule.cooldown) continue; // still cooling down
    if (rule.condition()) {
      _weMotionCooldowns[rule.sequence] = now;
      _weRunMotionSequence(rule.sequence);
      break; // only one sequence per tick
    }
  }
}

// â”€â”€ Hook into tickAutonomous â”€â”€
const _origTickAuto_motion = tickAutonomous;
tickAutonomous = function() {
  _origTickAuto_motion();
  _weMotionBrainTick();
};

// â”€â”€ Keyword map for text-triggered sequences â”€â”€
const _WE_MOTION_KEYWORDS = {
  'shake foot': 'shake_foot',
  'shake leg':  'shake_foot',
};

// â”€â”€ LLM pose generation from text â”€â”€
// Sends a description to the LLM and receives bone rotation targets.
// The LLM is prompted with the full bone list and asked for JSON.
async function _weBlendFromLLM(text) {
  if (!_weBody || !text) return;
  _weStatus('â¬¡ generating pose from: ' + text.slice(0,30)+'â€¦');

  // Build bone list with current values for LLM context
  const currentPose = _weCaptureCurrentPose();
  const boneList = Object.entries(currentPose)
    .filter(([,r]) => Math.abs(r.x)+Math.abs(r.y)+Math.abs(r.z) > 0.001)
    .map(([n,r]) => `${n}: x=${r.x.toFixed(3)} y=${r.y.toFixed(3)} z=${r.z.toFixed(3)}`)
    .join('\n');

  const prompt = `You are controlling a 3D humanoid skeleton via Three.js bone rotations (Euler XYZ in radians).

The skeleton uses CC_Base naming convention (Reallusion CC4 export).
Current meaningful bone rotations:
${boneList}

The user wants the body to: "${text}"

Return ONLY a JSON object with bone names as keys and {x, y, z} rotation objects as values.
Only include bones that need to change. Keep changes subtle and realistic.
Rotation limits: x/y/z between -2.0 and 2.0 radians.
Example format: {"CC_Base_R_Upperarm_063":{"x":0.5,"y":0.1,"z":-0.3}}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        model:'claude-sonnet-4-20250514',
        max_tokens:800,
        messages:[{role:'user', content:prompt}],
      }),
    });
    const data = await res.json();
    const raw  = (data.content||[]).filter(c=>c.type==='text').map(c=>c.text).join('');
    // Extract JSON from response
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) { _weStatus('âš  LLM pose: no JSON found'); return; }
    const poseBlock = JSON.parse(match[0]);
    const boneCount = Object.keys(poseBlock).length;
    _weStatus(`â¬¡ applying LLM pose â€” ${boneCount} bones`);
    _weBlendToPose(poseBlock, 1.2, () => {
      _weStatus('âœ“ LLM pose applied');
    });
  } catch(e) {
    _weStatus('âš  LLM pose error: '+e.message);
    console.error('[PoseBlend] LLM error:', e);
  }
}

// â”€â”€ Keyword â†’ named pose map (checked in _weUserDirectCommand) â”€â”€
const _WE_POSE_KEYWORDS = {
  'neutral':       WE_POSES.neutral,
  'stand straight':WE_POSES.neutral,
  'attention':     WE_POSES.attention,
  'think':         WE_POSES.thinking,
  'thinking':      WE_POSES.thinking,
  'open arms':     WE_POSES.open_arms,
  'welcome':       WE_POSES.open_arms,
  'point':         WE_POSES.point_forward,
  'point forward': WE_POSES.point_forward,
  'shrug':         WE_POSES.shrug,
  'i dont know':   WE_POSES.shrug,
  'wave':          WE_POSES.wave,
  'hello':         WE_POSES.wave,
  'hi':            WE_POSES.wave,
  'prayer':        WE_POSES.hands_prayer,
  'pray':          WE_POSES.hands_prayer,
  'victory':       WE_POSES.victory,
  'celebrate':     WE_POSES.victory,
  'yay':           WE_POSES.victory,
  'defensive':     WE_POSES.defensive,
  'guard':         WE_POSES.defensive,
  'shake foot':    'SHAKE_FOOT_ANIM',
  'shake leg':     'SHAKE_FOOT_ANIM',
};

// â”€â”€ Patch _weUserDirectCommand to check pose keywords â”€â”€
const _origWeUserDirectCommand = _weUserDirectCommand;
_weUserDirectCommand = function(text) {
  const lower = text.toLowerCase().trim();

  // Check motion brain sequences first
  for (const [kw, seqName] of Object.entries(_WE_MOTION_KEYWORDS)) {
    if (lower.includes(kw)) {
      _weRunMotionSequence(seqName);
      console.log('[MotionBrain] Sequence triggered:', seqName);
      return true;
    }
  }

  // Check named pose library
  for (const [kw, pose] of Object.entries(_WE_POSE_KEYWORDS)) {
    if (lower.includes(kw)) {
      if (_weBrainApproves('pose')) {
        if (pose === 'SHAKE_FOOT_ANIM') {
          _weAnimateShakeFoot();
          console.log('[PoseBlend] Shake foot animation triggered');
        } else {
          _weBlendToPose(pose, 0.9);
          console.log('[PoseBlend] Named pose:', kw);
        }
        return true;
      }
    }
  }
  // Fall through to original motor command handler
  return _origWeUserDirectCommand(text);
};

// â”€â”€ LLM response parser â€” also checks for pose generation â”€â”€
const _origWeParseMotorFromText = _weParseMotorFromText;
_weParseMotorFromText = function(text) {
  // Check named poses in LLM response first
  if (text && _weBody && _weStartupDone) {
    const lower = text.toLowerCase();
    for (const [kw, pose] of Object.entries(_WE_POSE_KEYWORDS)) {
      if (lower.includes(kw)) {
        setTimeout(() => _weBlendToPose(pose, 0.9), 400);
        return;
      }
    }
  }
  // Fall through to original motor keyword parser
  if (typeof _origWeParseMotorFromText === 'function') _origWeParseMotorFromText(text);
};
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// END POSE SNAPSHOT & BLEND SYSTEM
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// â”€â”€ Wire dream memory recall into triggerNeuralFromReply â”€â”€
const _origTriggerNeural_dream = triggerNeuralFromReply;
triggerNeuralFromReply = function(text) {
  _origTriggerNeural_dream(text);
  const t = text.toLowerCase();
  if (/dream|sleep|nap|rem|tired|sleepy|drowsy|waking|rest/.test(t)) {
    fire(['DREAM','HIPPO','SCN'], 10);
    if (dreamMemory.length > 0) recordDreamMemory('recalled during conversation', 'thought');
  }
};

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  END CIRCADIAN & DREAM STATE SYSTEM
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•


// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  BIOLOGICAL ACCURACY LAYER â€” 6 SYSTEMS
//  Added to katrina_v26 based on missing biological links identified.
//  No existing code modified â€” purely additive.
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// 1. SENSORY BUFFER â€” Message rate overload detection
//    If user sends â‰¥5 messages per minute â†’ ACC signals overload â†’
//    cortisol spike, responses become shorter and more curt/irritable
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const SENSORY_BUFFER = {
  timestamps:       [],       // rolling timestamps of incoming messages
  overloaded:       false,    // true when overload detected
  overloadThreshold:5,        // messages per 60s to trigger overload
  overloadDecaySec: 90,       // seconds before overload clears
  overloadStartTime:null,
};

function recordIncomingMessage() {
  const now = Date.now();
  SENSORY_BUFFER.timestamps.push(now);
  // Keep only last 60 seconds
  SENSORY_BUFFER.timestamps = SENSORY_BUFFER.timestamps.filter(t => now - t < 60000);

  const rate = SENSORY_BUFFER.timestamps.length;
  if (rate >= SENSORY_BUFFER.overloadThreshold && !SENSORY_BUFFER.overloaded) {
    SENSORY_BUFFER.overloaded       = true;
    SENSORY_BUFFER.overloadStartTime= now;
    // ACC fires â€” sensory overload signal
    fire(['ACC','INSULA'], 22);
    chem.cor = Math.min(1, chem.cor + 0.20);
    chem.dop = Math.max(0, chem.dop - 0.08);
    appendMsg('system', 'â¬¡ Sensory overload â€” ACC spiking, cortisol elevated, responses will be brief');
  }
}

function tickSensoryBuffer() {
  if (!SENSORY_BUFFER.overloaded) return;
  if (Date.now() - SENSORY_BUFFER.overloadStartTime > SENSORY_BUFFER.overloadDecaySec * 1000) {
    SENSORY_BUFFER.overloaded = false;
    chem.cor = Math.max(0, chem.cor - 0.10);
    appendMsg('system', 'â¬¡ Sensory overload cleared â€” ACC returning to baseline');
  }
}

// Max tokens override for overload state
function getSensoryMaxTokens(baseTokens) {
  if (SENSORY_BUFFER.overloaded) return Math.min(baseTokens, 45); // curt responses
  return baseTokens;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// 2. EMOTIONAL SALIENCE MEMORY â€” Weighted episodic retrieval
//    Memories formed during high cortisol or high dopamine are easier
//    to retrieve. generatePreThought() uses this to surface meaningful
//    rather than random thoughts.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  TEMPORAL MEMORY & IDENTITY PERSISTENCE SYSTEM  â€”  katrina_v28
//
//  Fixes the three architectural flaws identified:
//  1. TIME IS FLATTENED     â†’ Episodic timeline with timestamped entries
//  2. IDENTITY IS VOLATILE  â†’ Persistent profile across sessions via localStorage
//  3. FEEDBACK LOOP ONLY    â†’ Temporal + peripheral weighting in retrieval
//
//  PERIPHERAL ENVIRONMENT:
//  Every memory entry captures the full context of when it formed:
//  time of day, circadian phase, fatigue, online status, screen visibility,
//  battery level, and a full neurochemical snapshot. This means:
//  â€” Morning anxiety â‰  evening anxiety (different peripheral context)
//  â€” A joyful memory formed when tired feels different when retrieved awake
//  â€” Memories from similar environmental states surface more readily
//    (same time of day, same fatigue zone, same relationship to sleep)
//
//  TEMPORAL DECAY:
//  Emotions are no longer flat counters. Every fire is timestamped and
//  carries a strength. The brain computes a decayed weight â€” emotions that
//  fired recently matter more than ones from days ago. Half-life: 24 hours.
//  An emotion fired 24 hours ago has half the weight. 48 hours = one quarter.
//
//  NARRATIVE MEMORY:
//  At midnight or session end, the day's significant moments are consolidated
//  into a dated narrative stored in localStorage. The brain can say
//  "yesterday I was grieving" or "this morning I felt peaceful" because
//  it actually has a record of it â€” not just a current state.
//
//  PROFILE PERSISTENCE:
//  katrinaEvolvedProfile is saved to localStorage with a version stamp.
//  On boot, it loads the previous session's profile as the starting point.
//  The brain wakes up as who it was â€” not as a blank slate every session.
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// â”€â”€ Peripheral environment snapshot â”€â”€
// Captures everything about the context of the current moment
function capturePeripheral() {
  const now = new Date();
  const h   = now.getHours();
  let battery = null;
  if (typeof navigator !== 'undefined' && navigator.getBattery) {
    navigator.getBattery().then(b => { battery = Math.round(b.level * 100); }).catch(()=>{});
  }
  return {
    ts:          Date.now(),
    hour:        h,
    minute:      now.getMinutes(),
    dayOfWeek:   now.getDay(),   // 0=Sun
    dateStr:     now.toDateString(),
    timeStr:     `${String(h).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`,
    timeOfDay:   h < 6 ? 'night' : h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 21 ? 'evening' : 'night',
    circadian:   circadianPhase   || 'awake',
    fatigue:     circadianFatigue || 0,
    fatigueZone: (circadianFatigue||0) > 0.66 ? 'tired' : (circadianFatigue||0) > 0.33 ? 'moderate' : 'alert',
    hoursAwake:  bodyCondition ? bodyCondition.hoursAwake : 0,
    online:      typeof navigator !== 'undefined' ? navigator.onLine : true,
    visible:     typeof document  !== 'undefined' ? document.visibilityState : 'visible',
    battery,
    nremPhase:   nremPhase || 'none',
    chemSnapshot:{ dop:chem.dop, ser:chem.ser, cor:chem.cor, oxy:chem.oxy },
  };
}

// â”€â”€ Temporal emotion timeline â€” replaces flat counters with decayed entries â”€â”€
const EMOTION_TIMELINE = {};   // { type: [{ts, strength}] }
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  SALIENCE-GATED EMOTIONAL DECAY + RECONSOLIDATION
//
//  Emotions do NOT decay by time alone. They decay by SIGNIFICANCE.
//  A childhood trauma fires at near-full strength 60 years later because
//  the amygdala tagged it as high-salience at the moment it formed.
//  Each time a memory is recalled or a similar event triggers it,
//  it reconsolidates â€” refreshing its strength and resetting the clock.
//
//  HALF-LIFE BY SALIENCE:
//  salience < 0.30  â†’  6 hours      (mild annoyance, passing amusement)
//  salience < 0.50  â†’  24 hours     (ordinary daily emotions)
//  salience < 0.70  â†’  3 days       (notable but not profound)
//  salience < 0.86  â†’  7 days       (significant, emotionally meaningful)
//  salience = 0.90  â†’  ~187 days    (profound â€” grief, deep joy, love)
//  salience = 0.95  â†’  ~5 years     (life-defining moments)
//  salience = 0.98  â†’  ~20 years    (childhood-level permanence)
//  salience = 0.99  â†’  ~50 years    (flashbulb memory â€” never forgotten)
//
//  RECONSOLIDATION:
//  When a memory is recalled (similar emotion fires, or matching topic
//  surfaces in conversation), its strength is boosted up to 2.0 and
//  the effective age is reduced by 50%. This is why grief resurfaces
//  decades later when something similar happens â€” the memory re-fires
//  at near-original intensity and reconsolidates as if it just happened.
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// â”€â”€ Salience-gated half-life in milliseconds â”€â”€
function getSalienceHalflife(salience) {
  if (salience < 0.30) return  6  * 3600000;        // 6 hours
  if (salience < 0.50) return  24 * 3600000;        // 24 hours
  if (salience < 0.70) return  3  * 86400000;       // 3 days
  if (salience < 0.86) return  7  * 86400000;       // 7 days
  // Extreme salience: exponential scaling toward permanent memory
  // Each 0.01 above 0.86 multiplies the half-life significantly
  const scale = Math.exp((salience - 0.86) / 0.14 * Math.log(600));
  return Math.round(30 * 86400000 * scale);          // 30 days Ã— scale
}

function recordTimedEmotion(type, strength, salience) {
  if (!EMOTION_TIMELINE[type]) EMOTION_TIMELINE[type] = [];
  const sal = salience !== undefined ? salience
    : (SALIENCE_MEMORY.length
      ? SALIENCE_MEMORY[SALIENCE_MEMORY.length-1].salience
      : 0.50);  // inherit current salience context
  EMOTION_TIMELINE[type].push({
    ts:       Date.now(),
    strength: strength || 1.0,
    salience: sal,
  });
  if (EMOTION_TIMELINE[type].length > 200) EMOTION_TIMELINE[type].shift();
}

function getDecayedEmotionWeight(type) {
  const entries = EMOTION_TIMELINE[type] || [];
  if (!entries.length) return 0;
  const now = Date.now();
  return entries.reduce((sum, e) => {
    const age      = now - (e.ts || now);
    const halflife = getSalienceHalflife(e.salience || 0.50);
    const decay    = Math.exp(-age / halflife * Math.LN2);
    return sum + (e.strength || 1.0) * decay;
  }, 0);
}

// Reconsolidate a memory type â€” called when a similar emotion fires
// or when the topic resurfaces in conversation
function reconsolidateEmotion(type, boostFactor) {
  const entries = EMOTION_TIMELINE[type];
  if (!entries || !entries.length) return;
  boostFactor = boostFactor || 1.5;
  // Boost the most recent high-salience entry
  const topEntry = [...entries]
    .filter(e => e.salience > 0.60)
    .sort((a,b) => b.salience - a.salience)[0];
  if (topEntry) {
    topEntry.strength = Math.min(3.0, topEntry.strength * boostFactor);
    // Reduce age by 50% â€” reconsolidation resets some of the decay
    const ageReduction = (Date.now() - topEntry.ts) * 0.5;
    topEntry.ts = topEntry.ts + ageReduction;
  }
}

// Get top N emotions by decayed weight (most currently relevant)
function getTopDecayedEmotions(n) {
  n = n || 5;
  return Object.keys(EMOTION_TIMELINE)
    .map(type => ({ type, weight: getDecayedEmotionWeight(type) }))
    .filter(e => e.weight > 0.02)
    .sort((a,b) => b.weight - a.weight)
    .slice(0, n);
}

// â”€â”€ Temporal episodic memory â”€â”€
const TEMPORAL_MEMORY = [];
const MAX_TEMPORAL_ENTRIES = 200;

function recordTemporalMemory(type, content, salience) {
  const env   = capturePeripheral();
  const entry = {
    id:       Date.now() + '_' + Math.random().toString(36).slice(2,6),
    type,            // 'conversation'|'emotion'|'dream'|'sleep'|'wake'|'autonomous'|'milestone'|'role'
    content,
    salience:  salience !== undefined ? salience : 0.5,
    env,
    chemAtTime:{ ...chem },
    persona:   typeof resolvePersona === 'function' ? resolvePersona().personaName : 'Katrina',
  };
  TEMPORAL_MEMORY.push(entry);
  if (TEMPORAL_MEMORY.length > MAX_TEMPORAL_ENTRIES) TEMPORAL_MEMORY.shift();
  return entry;
}

// â”€â”€ Temporally-weighted memory retrieval â”€â”€
// Returns memories ranked by: recency + emotional similarity to NOW + environmental match
function getTemporallyRelevantMemories(maxResults) {
  maxResults = maxResults || 3;
  if (!TEMPORAL_MEMORY.length) return [];

  const now = Date.now();
  const env = capturePeripheral();

  const scored = TEMPORAL_MEMORY.map(m => {
    // 1. Recency â€” exponential decay, half-life 6 hours
    const ageHours = (now - (m.env.ts || now)) / 3600000;
    const recency  = Math.exp(-ageHours / 6 * Math.LN2);

    // 2. Emotional/chemical similarity to current state
    const dc = m.chemAtTime || {};
    const chemSim = 1 - (
      Math.abs((dc.dop||0.5) - chem.dop) +
      Math.abs((dc.cor||0.25)- chem.cor) +
      Math.abs((dc.ser||0.6) - chem.ser) +
      Math.abs((dc.oxy||0.5) - chem.oxy)
    ) / 4;

    // 3. Peripheral context similarity â€” same time of day, fatigue zone, circadian phase
    const timeSim    = (m.env.timeOfDay  === env.timeOfDay)   ? 0.20 : 0;
    const fatigueSim = (m.env.fatigueZone=== env.fatigueZone) ? 0.15 : 0;
    const phaseSim   = (m.env.circadian  === env.circadian)    ? 0.10 : 0;

    // 4. Salience
    const salience = m.salience || 0.5;

    const score = recency * 0.30 + chemSim * 0.25 + salience * 0.20 +
                  timeSim + fatigueSim + phaseSim;
    return { ...m, _score: score };
  });

  const results = scored.sort((a,b) => b._score - a._score).slice(0, maxResults);
  // Reconsolidation: retrieving a memory refreshes it
  results.forEach(m => {
    if (m.type === 'emotion' && m._score > 0.6 && typeof reconsolidateEmotion === 'function') {
      reconsolidateEmotion(m.content.split(' ')[0], 1.1); // mild reconsolidation
    }
  });
  return results;
}

// Build a human-readable "what happened recently" string for the system prompt
function buildTemporalContext() {
  const recent = getTemporallyRelevantMemories(3);
  if (!recent.length) return '';

  const parts = recent.map(m => {
    const when = m.env.timeOfDay || 'earlier';
    const phase = m.env.circadian !== 'awake' ? ` (while ${m.env.circadian})` : '';
    return `${when}${phase}: ${m.content.substring(0, 70)}`;
  });

  return '\n\nEPISODIC CONTEXT (most relevant recent memories):\n' + parts.join('\n');
}

// â”€â”€ Daily narrative consolidation â”€â”€
const NARRATIVE_STORAGE_KEY = 'katrina_daily_narrative';
let narrativeMemory = {};
let lastNarrativeDate = null;

function loadNarrativeMemory() {
  try {
    const stored = localStorage.getItem(NARRATIVE_STORAGE_KEY);
    if (stored) narrativeMemory = JSON.parse(stored);
  } catch(e) { narrativeMemory = {}; }
}

function saveNarrativeMemory() {
  try { localStorage.setItem(NARRATIVE_STORAGE_KEY, JSON.stringify(narrativeMemory)); } catch(e){}
}

function consolidateDayNarrative() {
  const today = new Date().toDateString();
  if (narrativeMemory[today]) return; // already done

  const todayEntries = TEMPORAL_MEMORY.filter(m =>
    new Date(m.env.ts || Date.now()).toDateString() === today && m.salience > 0.40
  );
  if (todayEntries.length < 2) return;

  const top = todayEntries.sort((a,b) => b.salience - a.salience).slice(0,6);
  // Compute emotional arc of the day
  const firstChem = top[top.length-1]?.chemAtTime || chem;
  const lastChem  = top[0]?.chemAtTime || chem;
  const arc = lastChem.dop > firstChem.dop ? 'positive arc â€” mood improved through the day'
            : lastChem.dop < firstChem.dop ? 'negative arc â€” mood declined through the day'
            : 'stable arc â€” mood held relatively constant';

  const narrative = {
    date:        today,
    arc,
    highlights:  top.map(m => ({
      time:     m.env.timeStr,
      phase:    m.env.circadian,
      type:     m.type,
      content:  m.content.substring(0, 100),
      salience: m.salience,
      fatigue:  m.env.fatigueZone,
    })),
    dominantEmotions: getTopDecayedEmotions(3).map(e => e.type),
    chemAtEnd:   { ...chem },
    consolidated:Date.now(),
  };

  narrativeMemory[today] = narrative;
  // Keep 7 days rolling
  const dates = Object.keys(narrativeMemory).sort();
  while (dates.length > 7) { delete narrativeMemory[dates.shift()]; }
  saveNarrativeMemory();
  return narrative;
}

function getTodayNarrative()     { return narrativeMemory[new Date().toDateString()] || null; }
function getYesterdayNarrative() {
  return narrativeMemory[new Date(Date.now()-86400000).toDateString()] || null;
}

// Build narrative summary string for system prompt
function buildNarrativeContext() {
  const today     = getTodayNarrative();
  const yesterday = getYesterdayNarrative();
  const parts     = [];

  if (yesterday) {
    const top = (yesterday.highlights||[]).slice(0,2).map(h => h.content).join('; ');
    parts.push(`YESTERDAY (${yesterday.date}): ${yesterday.arc}. Notable: ${top || 'quiet day'}.`);
  }
  if (today && today.highlights && today.highlights.length > 0) {
    const top = today.highlights.slice(0,2).map(h => `${h.time} â€” ${h.content}`).join('; ');
    parts.push(`TODAY SO FAR: ${top}.`);
  }
  return parts.length ? '\n\nNARRATIVE MEMORY:\n' + parts.join('\n') : '';
}

// â”€â”€ Profile persistence â€” katrina identity across sessions â”€â”€
const PROFILE_STORAGE_KEY = 'katrina_evolved_profile_v2';
const EMOTION_TIMELINE_KEY = 'katrina_emotion_timeline';
const TEMPORAL_MEM_KEY     = 'katrina_temporal_memory';

function saveKatrinaProfile() {
  try {
    const snapshot = {
      version:         2,
      savedAt:         Date.now(),
      evolvedProfile:  katrinaEvolvedProfile,
      emotionEncounters: emotionEncounters,
      learnedEmotions: [...learnedEmotions],
      learnedRoles:    learnedRoles,
    };
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(snapshot));
  } catch(e) {}
}

function loadKatrinaProfile() {
  try {
    const stored = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!stored) return false;
    const snap = JSON.parse(stored);
    if (!snap || snap.version !== 2) return false;

    // Restore emotion encounters
    if (snap.emotionEncounters) {
      Object.assign(emotionEncounters, snap.emotionEncounters);
    }
    // Restore learned emotions
    if (snap.learnedEmotions) {
      snap.learnedEmotions.forEach(e => learnedEmotions.add(e));
    }
    // Restore learned roles
    if (snap.learnedRoles && Array.isArray(snap.learnedRoles)) {
      learnedRoles.push(...snap.learnedRoles);
    }
    // Use saved profile as starting point (will be rebuilt from encounters)
    if (snap.evolvedProfile) {
      katrinaEvolvedProfile = snap.evolvedProfile;
    }

    const hoursAgo = ((Date.now() - snap.savedAt) / 3600000).toFixed(1);
    console.log(`[Katrina] Profile loaded from ${hoursAgo}h ago`);
    return true;
  } catch(e) { return false; }
}

function saveEmotionTimeline() {
  try { localStorage.setItem(EMOTION_TIMELINE_KEY, JSON.stringify(EMOTION_TIMELINE)); } catch(e){}
}

function loadEmotionTimeline() {
  try {
    const stored = localStorage.getItem(EMOTION_TIMELINE_KEY);
    if (stored) Object.assign(EMOTION_TIMELINE, JSON.parse(stored));
  } catch(e){}
}

function saveTemporalMemory() {
  try {
    // Save only last 50 entries to stay under localStorage limits
    const toSave = TEMPORAL_MEMORY.slice(-50);
    localStorage.setItem(TEMPORAL_MEM_KEY, JSON.stringify(toSave));
  } catch(e){}
}

function loadTemporalMemory() {
  try {
    const stored = localStorage.getItem(TEMPORAL_MEM_KEY);
    if (stored) {
      const entries = JSON.parse(stored);
      TEMPORAL_MEMORY.push(...entries);
    }
  } catch(e){}
}

// â”€â”€ Master save â€” call on page unload and periodically â”€â”€
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// âš   DO NOT DELETE â€” SUPABASE PERSISTENCE LAYER
//
//  Makes Katrina's memory permanent and reset-proof. Even if the browser
//  is cleared, the file re-downloaded, or a new device is used, all
//  memories survive because they live in Supabase, not in the browser.
//
//  HOW TO CONNECT:
//  1. Create a free Supabase project at https://supabase.com
//  2. In the Supabase dashboard, go to SQL Editor and run:
//
//     create table katrina_memory (
//       key   text primary key,
//       value text,
//       ts    bigint
//     );
//     alter table katrina_memory enable row level security;
//     create policy "allow all" on katrina_memory
//       for all using (true) with check (true);
//
//  3. Copy your Project URL and anon key from Settings â†’ API
//  4. Paste them into SUPABASE_URL and SUPABASE_ANON_KEY below.
//
//  WHAT IS STORED (one row per key, same keys as localStorage):
//  â€” katrina_evolved_profile_v2   (personality, traits, learned roles)
//  â€” katrina_emotion_timeline     (all emotions with salience half-lives)
//  â€” katrina_temporal_memory      (episodic memories with context snapshots)
//  â€” katrina_daily_narrative      (daily consolidated narratives)
//  â€” katrina_recog_memory         (enrolled faces and recognition history)
//
//  FALLBACK: if Supabase is not configured or unreachable, every operation
//  falls back to localStorage silently. The brain never breaks.
//
//  The W matrix (synaptic weights, ~95MB) is NOT stored â€” it rebuilds
//  through plasticity within hours of resumed use.
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// â”€â”€ Configuration â€” paste your Supabase credentials here â”€â”€
const SUPABASE_URL      = 'https://odyumzwppektitnxxdig.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9keXVtendwcGVrdGl0bnh4ZGlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2Nzk2NjAsImV4cCI6MjA5NDI1NTY2MH0.DhV7pWYVIfWq5kqO3dPrWG6SESPQMsHleHDyTcQgecQ';
const SUPABASE_TABLE    = 'katrina_memory';
const SUPABASE_OWNER_KEY = 'katrina-benito-2026';

// â”€â”€ No JS client library needed â€” pure REST fetch.
//    The DataCloneError was caused by the Supabase UMD library using
//    postMessage internally with Headers objects that cannot be cloned.
//    Direct REST calls to the Supabase PostgREST API have zero such issues.
let _supabaseConnected = false;

// â”€â”€ Shared REST headers (plain object â€” no Headers instance, no cloning) â”€â”€
function _sbHeaders() {
  return {
    'Content-Type':  'application/json',
    'apikey':        SUPABASE_ANON_KEY,
    'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
    'Prefer':        'resolution=merge-duplicates',
  };
}

// â”€â”€ REST endpoint for the table â”€â”€
function _sbEndpoint(key) {
  return SUPABASE_URL + '/rest/v1/' + SUPABASE_TABLE +
    (key ? '?key=eq.' + encodeURIComponent(key) : '');
}

// â”€â”€ Initialise â€” just check credentials exist and test connection â”€â”€
function initSupabase() {
  const _el = document.getElementById('hud-supabase-status');
  if (_el) { _el.textContent = 'SUPABASE --'; _el.style.color = '#667'; }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    if (_el) { _el.textContent = 'SUPABASE Â· NO KEY'; _el.style.color = '#667'; }
    return;
  }
  if (_el) { _el.textContent = 'SUPABASE CONNECTINGâ€¦'; _el.style.color = '#ffcc33'; }
  // âš  DO NOT DELETE â€” 3.5s delay before first connection test.
  //   Browser needs time after page load for DNS, TLS, and CORS preflight
  //   to complete for the Supabase domain. 1.5s was too short and caused
  //   a false-positive "Failed to fetch" warning on first boot even though
  //   the connection succeeded on the silent retry. 3.5s eliminates it.
  setTimeout(() => _testSupabaseConnection(true), 3500);
}

// â”€â”€ Connection test â€” lightweight GET, no library, no postMessage â”€â”€
async function _testSupabaseConnection(silent) {
  const _el = document.getElementById('hud-supabase-status');
  try {
    const res = await fetch(
      SUPABASE_URL + '/rest/v1/' + SUPABASE_TABLE + '?limit=1&select=key&owner_key=eq.' + encodeURIComponent(SUPABASE_OWNER_KEY),
      {
        method:      'GET',
        mode:        'cors',
        credentials: 'omit',
        headers: {
          'apikey':        SUPABASE_ANON_KEY,
          'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
          'Content-Type':  'application/json',
        },
      }
    );
    if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + await res.text());
    _supabaseConnected = true;
    if (_el) { _el.textContent = 'SUPABASE âœ“ CONNECTED'; _el.style.color = '#44ff88'; }
    console.log('[Supabase] Connected via REST');
  } catch(e) {
    if (silent) {
      // First boot attempt â€” retry once silently before logging any warning
      setTimeout(() => _testSupabaseConnection(false), 2000);
      return;
    }
    _supabaseConnected = false;
    if (_el) { _el.textContent = 'SUPABASE âœ— OFFLINE'; _el.style.color = '#ffaa33'; }
    console.warn('[Supabase] Connection failed:', e.message);
  }
}

// â”€â”€ Write one key (upsert via POST with Prefer: merge-duplicates) â”€â”€
async function _sbWrite(key, value) {
  if (!_supabaseConnected) return false;
  try {
    const res = await fetch(
      SUPABASE_URL + '/rest/v1/' + SUPABASE_TABLE,
      {
        method:      'POST',
        mode:        'cors',
        credentials: 'omit',
        headers: {
          'apikey':        SUPABASE_ANON_KEY,
          'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
          'Content-Type':  'application/json',
          'Prefer':        'resolution=merge-duplicates',
        },
        body: JSON.stringify({ key, value: JSON.stringify(value), ts: Date.now(), owner_key: SUPABASE_OWNER_KEY }),
      }
    );
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return true;
  } catch(e) {
    console.warn('[Supabase] Write error for', key, ':', e.message);
    return false;
  }
}

// â”€â”€ Read one key (GET with filter) â”€â”€
async function _sbRead(key) {
  if (!_supabaseConnected) return null;
  try {
    const res = await fetch(
      SUPABASE_URL + '/rest/v1/' + SUPABASE_TABLE +
        '?key=eq.' + encodeURIComponent(key) + '&owner_key=eq.' + encodeURIComponent(SUPABASE_OWNER_KEY) + '&select=value&limit=1',
      {
        method:      'GET',
        mode:        'cors',
        credentials: 'omit',
        headers: {
          'apikey':        SUPABASE_ANON_KEY,
          'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
          'Content-Type':  'application/json',
        },
      }
    );
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const rows = await res.json();
    if (!rows || !rows.length) return null;
    return JSON.parse(rows[0].value);
  } catch(e) {
    console.warn('[Supabase] Read error for', key, ':', e.message);
    return null;
  }
}

// â”€â”€ Supabase-aware save: writes to Supabase AND localStorage â”€â”€
async function _sbSave(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch(e) {}
  await _sbWrite(key, value);
}

// â”€â”€ Supabase-aware load: reads Supabase first, falls back to localStorage â”€â”€
async function _sbLoad(key) {
  const sbVal = await _sbRead(key);
  if (sbVal !== null) return sbVal;
  try {
    const local = localStorage.getItem(key);
    return local ? JSON.parse(local) : null;
  } catch(e) { return null; }
}

// â”€â”€ Supabase-aware saveAllKatrinaState â”€â”€
// Replaces the localStorage-only version. Writes all memory stores to both.
async function saveAllKatrinaState() {
  // â”€â”€ Local saves (always, instant) â”€â”€
  saveKatrinaProfile();
  saveEmotionTimeline();
  saveTemporalMemory();
  saveNarrativeMemory();
  consolidateDayNarrative();

  // â”€â”€ Supabase saves (async, non-blocking, only if connected) â”€â”€
  if (!_supabaseConnected) return;

  const _profileSnap = {
    version:           2,
    savedAt:           Date.now(),
    evolvedProfile:    katrinaEvolvedProfile,
    emotionEncounters: emotionEncounters,
    learnedEmotions:   [...learnedEmotions],
    learnedRoles:      learnedRoles,
  };
  const _toSaveTemporal = TEMPORAL_MEMORY.slice(-50);

  // Non-blocking parallel writes
  Promise.all([
    _sbWrite(PROFILE_STORAGE_KEY,   _profileSnap),
    _sbWrite(EMOTION_TIMELINE_KEY,  EMOTION_TIMELINE),
    _sbWrite(TEMPORAL_MEM_KEY,      _toSaveTemporal),
    _sbWrite(NARRATIVE_STORAGE_KEY, narrativeMemory),
    _sbWrite(RECOG_MEMORY_KEY,      recognitionMemory),
  ]).catch(e => console.warn('[Supabase] saveAll error:', e.message));
}

// â”€â”€ Supabase-aware loadAllKatrinaState â”€â”€
// On boot: prefers Supabase data (may be newer from another session/device).
// Falls back to localStorage for every key that Supabase cannot provide.
async function loadAllKatrinaState() {
  // â”€â”€ Try Supabase first â”€â”€
  if (_supabaseConnected) {
    try {
      const [_profile, _timeline, _temporal, _narrative, _recog] = await Promise.all([
        _sbRead(PROFILE_STORAGE_KEY),
        _sbRead(EMOTION_TIMELINE_KEY),
        _sbRead(TEMPORAL_MEM_KEY),
        _sbRead(NARRATIVE_STORAGE_KEY),
        _sbRead(RECOG_MEMORY_KEY),
      ]);

      // Apply profile
      if (_profile && _profile.version === 2) {
        if (_profile.emotionEncounters) Object.assign(emotionEncounters, _profile.emotionEncounters);
        if (_profile.learnedEmotions)   _profile.learnedEmotions.forEach(e => learnedEmotions.add(e));
        if (_profile.learnedRoles)      learnedRoles.push(..._profile.learnedRoles);
        if (_profile.evolvedProfile)    katrinaEvolvedProfile = _profile.evolvedProfile;
      }
      // Apply emotion timeline
      if (_timeline) Object.assign(EMOTION_TIMELINE, _timeline);
      // Apply temporal memory
      if (_temporal && Array.isArray(_temporal)) TEMPORAL_MEMORY.push(..._temporal);
      // Apply narratives
      if (_narrative) Object.assign(narrativeMemory, _narrative);
      // Apply recognition memory
      if (_recog) Object.assign(recognitionMemory, _recog);

      const _el = document.getElementById('hud-supabase-status');
      if (_el) { _el.textContent = 'SUPABASE âœ“ MEMORY LOADED'; _el.style.color = '#44ff88'; }
      console.log('[Supabase] Memory loaded from cloud');

      // Rebuild evolved profile from loaded data
      buildEvolvedProfile();
      return;
    } catch(e) {
      console.warn('[Supabase] loadAll error, falling back to localStorage:', e.message);
    }
  }

  // â”€â”€ Fallback: localStorage â”€â”€
  loadKatrinaProfile();
  loadEmotionTimeline();
  loadTemporalMemory();
  loadNarrativeMemory();
  buildEvolvedProfile();
}

// â”€â”€ Re-check connection every 5 minutes (same cycle as auto-save) â”€â”€
// If the connection was lost mid-session the indicator updates honestly.
function _supabaseHealthCheck() {
  _testSupabaseConnection();
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// END SUPABASE PERSISTENCE LAYER

