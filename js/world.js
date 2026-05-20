// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function _weInstinctTick(t, dt) {
  if (!_weBody || !_weStartupDone) return;

  const dop = (typeof chem!=='undefined')?chem.dop:0.5;
  const cor = (typeof chem!=='undefined')?chem.cor:0.2;
  const oxy = (typeof chem!=='undefined')?chem.oxy:0.5;
  const ser = (typeof chem!=='undefined')?chem.ser:0.5;
  const nor = (typeof chem!=='undefined')?chem.nor:0.3;
  const ach = (typeof chem!=='undefined')?chem.ach:0.5;
  const fat = (typeof circadianFatigue!=='undefined')?circadianFatigue:0;
  const ph  = (typeof circadianPhase!=='undefined')?circadianPhase:'awake';
  const I   = _weInstinct;
  const baseY = _weBody._baseY || 0;

  I.subTimer += dt;

  // â”€â”€ SLEEP OVERRIDE â”€â”€
  if (ph==='sleep'||ph==='rem') { _weSetState('sleep_down'); }
  else if (fat>0.85)            { _weSetState('tired_sway'); }

  // â”€â”€ ENGAGEMENT DETECTION â”€â”€
  // Uses real wall-clock time so it works regardless of _weClock state.
  const chatH = document.getElementById('chat-history');
  if (chatH) {
    const msgs = chatH.children.length;
    if (msgs !== (I._lastMsgCount||0)) {
      I._lastMsgCount = msgs;
      I.lastMsgWall = Date.now(); // wall clock â€” never resets
      I.engaged = true;
      const pick = Math.random();
      if(pick<0.35)       _weSetState('engage_listen');
      else if(pick<0.70)  _weSetState('engage_speak');
      else                _weSetState('engage_gesture');
      // Step slightly toward camera
      const cd=_weOrbitAz, sd=0.18+Math.random()*0.18;
      const nx=_weBodyPos.x+Math.sin(cd)*sd, nz=_weBodyPos.z+Math.cos(cd)*sd;
      if(!_weSensesBoundary(nx,nz)) _weBodyTarget={x:nx,z:nz};
    }
  }
  if (I.engaged && (Date.now()-(I.lastMsgWall||0)) > 12000) I.engaged=false;

  // â”€â”€ PERSISTENT FACE-CAMERA â€” every frame during engagement â”€â”€
  if (I.engaged && _weBody) {
    const camFaceY = _weOrbitAz; // camera is AT orbitAz â€” face toward it directly
    let frd = camFaceY - _weBodyRotY;
    while(frd>Math.PI)frd-=Math.PI*2; while(frd<-Math.PI)frd+=Math.PI*2;
    _weBodyRotY += frd * 0.06;
    _weBodyRotYTgt = _weBodyRotY;
    _weBody.rotation.y = _weBodyRotY;
  }

  // â”€â”€ STATE TRANSITION â”€â”€
  if (I.subTimer>=I.subMax) { I.subTimer=0; _wePickNextInstinct(dop,cor,oxy,ser,nor,fat,t); }

  // â”€â”€ EXECUTE STATE â”€â”€
  // Y is set here then floor-clamped after instinct by _weClampToFloor()
  switch(I.state) {

    case 'idle_breathe': {
      // Chest rise only â€” very small
      _weBody.position.y = baseY + Math.sin(t*1.1)*0.008;
      _weBody.rotation.x = 0; _weBody.rotation.z = Math.sin(t*0.6)*0.010;
      // Head mostly faces camera with slow gentle scan
      I.lookYaw   = Math.sin(t*0.22)*0.18;
      I.lookPitch = Math.sin(t*0.14)*0.04;
      I.poseArms  = 'natural';
      break;
    }
    case 'idle_look': {
      _weBody.position.y = baseY + Math.sin(t*1.1)*0.007;
      _weBody.rotation.x = 0; _weBody.rotation.z = Math.sin(t*0.55)*0.009;
      // Turn head side to side â€” but mostly toward camera
      I.lookYaw   = Math.sin(t*0.45)*0.42;
      I.lookPitch = Math.sin(t*0.30)*0.12;
      I.poseArms  = 'natural';
      break;
    }
    case 'idle_shift': {
      const sh=Math.sin(t*0.75);
      _weBody.position.y = baseY + Math.abs(sh)*0.008;
      _weBody.rotation.x = 0; _weBody.rotation.z = sh*0.030;
      I.lookYaw   = Math.sin(t*0.28)*0.20;
      I.lookPitch = -0.03;
      I.poseArms  = 'waist';
      break;
    }
    case 'idle_squat': {
      // Lower body group Y only â€” NO group.rotation.x (breaks with -PI/2 root)
      // The visual squat comes purely from Y compression + head pitch
      const sq=Math.sin(I.subTimer/I.subMax*Math.PI);
      _weBody.position.y = baseY - sq*0.16;
      _weBody.rotation.x = 0;
      _weBody.rotation.z = Math.sin(t*0.7)*0.005;
      I.lookYaw=Math.sin(t*0.2)*0.08; I.lookPitch=sq*0.40;
      I.poseArms='squat'; break;
    }
    case 'idle_hands_waist': {
      _weBody.position.y = baseY + Math.sin(t*0.9)*0.007;
      _weBody.rotation.x = 0; _weBody.rotation.z = Math.sin(t*0.45)*0.012;
      I.lookYaw=Math.sin(t*0.35)*0.22; I.lookPitch=Math.sin(t*0.22)*0.06;
      I.poseArms='waist'; break;
    }
    case 'idle_cross_arms': {
      _weBody.position.y = baseY + Math.sin(t*0.85)*0.007;
      _weBody.rotation.x = -0.02; _weBody.rotation.z = Math.sin(t*0.4)*0.010;
      I.lookYaw=Math.sin(t*0.30)*0.25; I.lookPitch=-0.04;
      I.poseArms='cross'; break;
    }
    case 'idle_stretch': {
      const sp=Math.sin(I.subTimer/I.subMax*Math.PI);
      _weBody.position.y = baseY + sp*0.025;
      _weBody.rotation.x = -sp*0.04; _weBody.rotation.z = Math.sin(t*0.25)*0.006;
      I.lookYaw=0; I.lookPitch=-sp*0.15;
      I.poseArms='stretch'; break;
    }

    case 'walk_explore': {
      const dx=_weBodyTarget.x-_weBodyPos.x, dz=_weBodyTarget.z-_weBodyPos.z;
      const dist=Math.sqrt(dx*dx+dz*dz);
      if (dist<0.06) {
        if (Math.random() < 0.80) {
          _wePickNewTarget();
          I.subTimer = 0;
        } else {
          _weSetState('idle_look');
        }
        break;
      }

      // â”€â”€ SMOOTH VELOCITY STRIDE â€” heel strike adds impulse, glide between â”€â”€
      const prevBob = I.bobPhase;
      I.bobPhase += 0.072;
      const prevSin = Math.sin(prevBob);
      const currSin = Math.sin(I.bobPhase);
      const rStrike = prevSin <= 0 && currSin > 0;
      const lStrike = prevSin >= 0 && currSin < 0;
      const anyStrike = rStrike || lStrike;

      if (!I._walkVelX) { I._walkVelX=0; I._walkVelZ=0; }

      if (anyStrike) {
        // Each heel strike adds a velocity impulse â€” push-glide rhythm
        // Impulse sized so 3-5 units are covered per destination leg
        const impulse = _WE_STRIDE_LEN * 0.09; // small stride â€” matches bone animation range
        I._walkVelX += (dx/dist)*impulse;
        I._walkVelZ += (dz/dist)*impulse;
      }

      // Smoother decay â€” longer glide between strikes
      I._walkVelX *= 0.91;
      I._walkVelZ *= 0.91;

      // Apply smooth position â€” no hard jump
      const propX = _weBodyPos.x + I._walkVelX;
      const propZ = _weBodyPos.z + I._walkVelZ;
      if (!_weSensesBoundary(propX, propZ)) {
        _weBodyPos.x = propX;
        _weBodyPos.z = propZ;
      } else {
        I._walkVelX=0; I._walkVelZ=0;
        _weSetState('walk_boundary'); break;
      }

      // â”€â”€ BRAIN MID-TURN â€” direction change mid-walk from neurochemistry â”€â”€
      if (!I._midTurnCtr) I._midTurnCtr = 90+Math.floor(Math.random()*80);
      if (--I._midTurnCtr <= 0) {
        I._midTurnCtr = 90+Math.floor(Math.random()*80);
        const ach_ = (typeof chem!=='undefined')?chem.ach||0.5:0.5;
        const cor_ = (typeof chem!=='undefined')?chem.cor||0.2:0.2;
        if (ach_ > 0.58) {
          // Curiosity â†’ turn toward farthest corner
          const cs=[
            {x:-_ROOM_HALF_W+0.25,z:-_ROOM_HALF_D+0.25},
            {x:_ROOM_HALF_W-0.25,z:-_ROOM_HALF_D+0.25},
            {x:-_ROOM_HALF_W+0.25,z:_ROOM_HALF_D-0.25},
            {x:_ROOM_HALF_W-0.25,z:_ROOM_HALF_D-0.25},
          ];
          const fc=cs.reduce((a,b)=>Math.hypot(b.x-_weBodyPos.x,b.z-_weBodyPos.z)>Math.hypot(a.x-_weBodyPos.x,a.z-_weBodyPos.z)?b:a);
          _weBodyTarget={x:fc.x,z:fc.z};
        } else if (cor_ > 0.48) {
          // Stress â†’ toward nearest wall
          const walls=[{x:-_ROOM_HALF_W+0.25,z:_weBodyPos.z},{x:_ROOM_HALF_W-0.25,z:_weBodyPos.z},{x:_weBodyPos.x,z:-_ROOM_HALF_D+0.25},{x:_weBodyPos.x,z:_ROOM_HALF_D-0.25}];
          const nw=walls.reduce((a,b)=>Math.hypot(b.x-_weBodyPos.x,b.z-_weBodyPos.z)<Math.hypot(a.x-_weBodyPos.x,a.z-_weBodyPos.z)?b:a);
          _weBodyTarget={x:nw.x,z:nw.z};
        } else {
          _wePickNewTarget();
        }
        // Smoothly redirect velocity toward new target
        const ndx=_weBodyTarget.x-_weBodyPos.x, ndz=_weBodyTarget.z-_weBodyPos.z;
        const nd=Math.sqrt(ndx*ndx+ndz*ndz)||1;
        const spd=Math.sqrt(I._walkVelX**2+I._walkVelZ**2);
        I._walkVelX=(ndx/nd)*spd; I._walkVelZ=(ndz/nd)*spd;
      }

      _weBodyRotYTgt = Math.atan2(dx,dz);
      _weBody.position.y = baseY + Math.abs(Math.sin(I.bobPhase))*0.012;
      I.lookYaw=Math.sin(t*0.35)*0.12; I.lookPitch=-0.03;
      I.poseArms='walk';
      _weBodyState='walk';

      // Bone animation â€” pass actual velocity magnitude as speed signal
      const velSpd = Math.sqrt((I._walkVelX||0)**2+(I._walkVelZ||0)**2);
      _weApplyFootIKBones(I.bobPhase, dx/dist, dz/dist, anyStrike?velSpd:0, baseY);
      break;
    }
    case 'walk_boundary': {
      _weBody.position.y=baseY+Math.sin(t*1.0)*0.007;
      _weBody.rotation.x=0; _weBody.rotation.z=0;
      let rd=I.pivotAngle-_weBodyRotY;
      while(rd>Math.PI)rd-=Math.PI*2; while(rd<-Math.PI)rd+=Math.PI*2;
      _weBodyRotY+=rd*0.07;
      I.lookYaw=0.15; I.lookPitch=0; I.poseArms='natural';
      if(Math.abs(rd)<0.05){_wePickNewTarget(); _weSetState('walk_explore');}
      break;
    }
    case 'walk_pause': {
      _weBody.position.y=baseY+Math.sin(t*1.0)*0.009;
      _weBody.rotation.x=0; _weBody.rotation.z=Math.sin(t*0.6)*0.012;
      I.lookYaw=Math.sin(t*0.55)*0.40; I.lookPitch=Math.sin(t*0.35)*0.12;
      I.poseArms=Math.random()<0.5?'waist':'natural';
      if(I.subTimer>2.5) _weSetState('walk_explore');
      break;
    }

    case 'engage_listen': {
      _weBody.position.y=baseY+Math.sin(t*1.2)*0.008;
      _weBody.rotation.x=-0.035; _weBody.rotation.z=Math.sin(t*0.45)*0.008;
      // Step toward camera
      const edx=_weBodyTarget.x-_weBodyPos.x, edz=_weBodyTarget.z-_weBodyPos.z;
      const ed=Math.sqrt(edx*edx+edz*edz);
      if(ed>0.04){_weBodyPos.x+=(edx/ed)*0.004;_weBodyPos.z+=(edz/ed)*0.004;}
      // Face camera continuously
      const tY1=_weOrbitAz;
      let r1=tY1-_weBodyRotY; while(r1>Math.PI)r1-=Math.PI*2; while(r1<-Math.PI)r1+=Math.PI*2;
      _weBodyRotY+=r1*0.08; _weBodyRotYTgt=_weBodyRotY;
      // Head mostly toward camera â€” only tiny side glance
      I.lookYaw=Math.sin(t*0.18)*0.08; I.lookPitch=-0.03;
      I.poseArms='listen';
      break;
    }
    case 'engage_speak': {
      _weBody.position.y=baseY+Math.sin(t*1.3)*0.010;
      _weBody.rotation.x=-0.04; _weBody.rotation.z=Math.sin(t*0.9)*0.012;
      const tY2=_weOrbitAz;
      let r2=tY2-_weBodyRotY; while(r2>Math.PI)r2-=Math.PI*2; while(r2<-Math.PI)r2+=Math.PI*2;
      _weBodyRotY+=r2*0.08; _weBodyRotYTgt=_weBodyRotY;
      I.lookYaw=Math.sin(t*0.60)*0.10; I.lookPitch=Math.sin(t*1.1)*0.08-0.03;
      I.poseArms='speak';
      break;
    }
    case 'engage_gesture': {
      _weBody.position.y=baseY+Math.sin(t*1.1)*0.009;
      _weBody.rotation.x=-0.04; _weBody.rotation.z=Math.sin(t*0.8)*0.013;
      const tY3=_weOrbitAz;
      let r3=tY3-_weBodyRotY; while(r3>Math.PI)r3-=Math.PI*2; while(r3<-Math.PI)r3+=Math.PI*2;
      _weBodyRotY+=r3*0.08; _weBodyRotYTgt=_weBodyRotY;
      I.lookYaw=Math.sin(t*0.45)*0.10; I.lookPitch=-0.03;
      I.poseArms='gesture';
      break;
    }

    case 'tired_sway': {
      _weBody.position.y=baseY-fat*0.03+Math.sin(t*0.5)*0.007;
      _weBody.rotation.x=fat*0.08; _weBody.rotation.z=Math.sin(t*0.35)*0.030;
      I.lookYaw=Math.sin(t*0.18)*0.04; I.lookPitch=fat*0.18;
      I.poseArms='natural';
      break;
    }
    case 'sleep_down': {
      if (!I._sleepPhase) I._sleepPhase=0;
      I._sleepPhase=Math.min(1.0, I._sleepPhase+0.002);
      const sp=I._sleepPhase;
      const rT=_weBones['CC_Base_R_Thigh_019'],lT=_weBones['CC_Base_L_Thigh_04'];
      const rC=_weBones['CC_Base_R_Calf_020'],lC=_weBones['CC_Base_L_Calf_05'];
      const s1v=_weBones['CC_Base_Spine01_035'],s2v=_weBones['CC_Base_Spine02_036'];
      if(sp<0.35){
        const kp=sp/0.35;
        _weBody.position.y=baseY-kp*0.30;
        if(rT)rT.rotation.x=kp*0.90; if(lT)lT.rotation.x=kp*0.90;
        if(rC)rC.rotation.x=-kp*0.80; if(lC)lC.rotation.x=-kp*0.80;
        if(s1v)s1v.rotation.x=kp*0.10;
      } else if(sp<0.65){
        const bp=(sp-0.35)/0.30;
        _weBody.position.y=baseY-0.30-bp*0.05;
        if(rT)rT.rotation.x=0.90+bp*0.30; if(lT)lT.rotation.x=0.90+bp*0.30;
        if(rC)rC.rotation.x=-0.80; if(lC)lC.rotation.x=-0.80;
      } else {
        const rp=(sp-0.65)/0.35;
        _weBody.position.y=Math.max(baseY-0.45,(baseY-0.35)-rp*0.10);
        if(s1v)s1v.rotation.x=0.05-rp*0.15;
        if(s2v)s2v.rotation.x=-rp*0.10;
      }
      I.lookYaw=0; I.lookPitch=sp*0.4; I.poseArms='natural';
      break;
    }
  }

  // â”€â”€ BONES â€” only head/neck/spine, NOT arms/legs (mixer owns those) â”€â”€
  _weApplySpine(t, dop, cor, oxy, fat, I.state);
  _weApplyHeadLook(I.lookYaw, I.lookPitch, t, dop, fat);
  // Arms/legs driven by mixer Idle02_F â€” procedural only adds expression overlay
  // Walk bone animation is called directly inside walk_explore case now (pulse-step)
  // if(I.state==='walk_explore') _weApplyWalkStride(I.bobPhase);
  _weApplyOpenPalmsSpeaking(t);

  // â”€â”€ Y ROTATION â”€â”€
  let rDiff=_weBodyRotYTgt-_weBodyRotY;
  while(rDiff>Math.PI)rDiff-=Math.PI*2; while(rDiff<-Math.PI)rDiff+=Math.PI*2;
  if(I.state!=='walk_boundary'&&I.state!=='engage_listen'&&I.state!=='engage_speak'&&I.state!=='engage_gesture'){
    _weBodyRotY+=rDiff*0.05;
  }
  _weBody.rotation.y=_weBodyRotY;
}

function _weSetState(s) {
  const I=_weInstinct;
  if(I.state===s)return;
  I.state=s; I.subTimer=0;
  const dur={idle_breathe:1,idle_look:1.5,idle_shift:1.5,idle_squat:2,
    idle_hands_waist:1,idle_cross_arms:1.5,idle_stretch:1.5,
    walk_explore:30,walk_boundary:1.5,walk_pause:1.5,
    engage_listen:8,engage_speak:6,engage_gesture:5,
    tired_sway:6,sleep_down:999};
  I.subMax=(dur[s]||4)*(0.8+Math.random()*0.4);
  if(s==='walk_boundary'){
    I.pivotAngle=_weBodyRotY+(Math.PI*0.55+Math.random()*Math.PI*0.55)*(Math.random()<0.5?1:-1);
  }
}

function _wePickNextInstinct(dop,cor,oxy,ser,nor,fat,t) {
  const I=_weInstinct;
  if(I.engaged){
    const r=Math.random();
    if(r<0.40)      _weSetState('engage_listen');
    else if(r<0.75) _weSetState('engage_speak');
    else            _weSetState('engage_gesture');
    return;
  }
  if(fat>0.60){_weSetState('tired_sway');return;}

  // â”€â”€ ROAMING FIRST â€” idle is the exception not the rule â”€â”€
  // 70% chance: always walk to next corner regardless of chemistry
  // 30% chance: pick from instinct table (may still pick walk)
  if (Math.random() < 0.70) {
    _wePickNewTarget();
    _weSetState('walk_explore');
    return;
  }

  const ach=(typeof chem!=='undefined')?chem.ach||0.5:0.5;
  const w={
    idle_breathe:     0.3,
    idle_look:        0.5+ach*0.4,
    idle_shift:       0.3+nor*0.3,
    idle_squat:       0.15+ach*0.2,
    idle_hands_waist: 0.3+cor*0.3,
    idle_cross_arms:  0.2+cor*0.3,
    idle_stretch:     0.15+fat*0.3,
    walk_explore:     5.0+dop*3.0-fat*0.5,  // still dominant even in 30% path
    walk_pause:       I.state==='walk_explore'?0.3:0.02,
  };
  const total=Object.values(w).reduce((a,b)=>a+Math.max(0,b),0);
  let r=Math.random()*total,acc=0;
  for(const[s,wt]of Object.entries(w)){
    if(wt<=0)continue;acc+=wt;
    if(r<=acc){
      if(s==='walk_explore') _wePickNewTarget();
      _weSetState(s);return;
    }
  }
  _wePickNewTarget();
  _weSetState('walk_explore');
}

// â”€â”€ SPINE â€” separate from arms, always active â”€â”€
function _weApplySpine(t, dop, cor, oxy, fat, state) {
  const s1=_weBones['CC_Base_Spine01_035'];
  const s2=_weBones['CC_Base_Spine02_036'];
  const hip=_weBones['CC_Base_Hip_02'];
  const waist=_weBones['CC_Base_Waist_034'];
  const neck=_weBones['CC_Base_NeckTwist01_037'];

  // Breathing base
  const breath=Math.sin(t*1.1)*0.006;

  if (state==='walk_explore') {
    // â”€â”€ WALK LEAN â€” torso pitches forward, torso leads the body â”€â”€
    // Positive rotation.x on spine = forward lean (into walk direction).
    // This counteracts the "feet dragging torso" visual by shifting
    // the upper body mass forward of the feet contact point.
    const walkLean = 0.14;  // forward lean amount (radians ~8Â°)
    if(s1){ s1.rotation.x = walkLean * 0.55 + breath; s1.rotation.z = Math.sin(t*0.6)*0.004; }
    if(s2){ s2.rotation.x = walkLean * 0.45; }
    if(waist){ waist.rotation.x = walkLean * 0.25; waist.rotation.z = Math.sin(t*0.7)*0.008; }
    if(hip){ hip.rotation.z = Math.sin(t*0.9)*0.016; }
    // Neck tilts back slightly to keep head level despite forward lean
    if(neck){ neck.rotation.x = -walkLean * 0.30; }
  } else {
    // â”€â”€ IDLE â€” neutral upright spine with chemistry influence â”€â”€
    if(s1){ s1.rotation.x = oxy*0.02 - cor*0.04 - fat*0.03 + breath; s1.rotation.z = Math.sin(t*0.6)*0.004; }
    if(s2){ s2.rotation.x = cor*0.05 + fat*0.04 - dop*0.02; }
    if(hip){ hip.rotation.z = Math.sin(t*0.9)*0.008; }
    if(waist){ waist.rotation.z = Math.sin(t*0.7)*0.005; waist.rotation.x = 0; }
    if(neck){ neck.rotation.x = 0; }
  }
}

// â”€â”€ ARM POSES â”€â”€
function _weApplyArmPose(pose, t, I) {
  const rU=_weBones['CC_Base_R_Upperarm_063'],rF=_weBones['CC_Base_R_Forearm_064'],rH=_weBones['CC_Base_R_Hand_068'];
  const lU=_weBones['CC_Base_L_Upperarm_051'],lF=_weBones['CC_Base_L_Forearm_052'],lH=_weBones['CC_Base_L_Hand_055'];
  const lClav=_weBones['CC_Base_L_Clavicle_050'],rClav=_weBones['CC_Base_R_Clavicle_062'];
  if(!rU||!lU)return;
  // Reset clavicles to neutral
  if(lClav){lClav.rotation.set(0,0,0);}
  if(rClav){rClav.rotation.set(0,0,0);}
  const sw=Math.sin(t*0.85)*0.008;
  switch(pose){
    case 'natural':
      // Arms hang at sides â€” the key natural resting pose
      if(rU){rU.rotation.x=0.04;rU.rotation.z=-0.18+sw;rU.rotation.y=0.05;}
      if(lU){lU.rotation.x=0.04;lU.rotation.z= 0.18+sw;lU.rotation.y=-0.05;}
      if(rF){rF.rotation.x=0.08;rF.rotation.y=0.05;}
      if(lF){lF.rotation.x=0.08;lF.rotation.y=-0.05;}
      if(rH){rH.rotation.z=0.02;rH.rotation.x=0.02;}
      if(lH){lH.rotation.z=-0.02;lH.rotation.x=0.02;}
      break;
    case 'waist':
      if(rU){rU.rotation.x=0.22;rU.rotation.z=-0.48;rU.rotation.y=0.08;}
      if(lU){lU.rotation.x=0.22;lU.rotation.z= 0.48;lU.rotation.y=-0.08;}
      if(rF){rF.rotation.x=0.55;rF.rotation.y=-0.25;}
      if(lF){lF.rotation.x=0.55;lF.rotation.y= 0.25;}
      if(rH){rH.rotation.z=-0.15;} if(lH){lH.rotation.z=0.15;}
      break;
    case 'cross':
      if(rU){rU.rotation.x=0.60;rU.rotation.z=0.22;rU.rotation.y=0.10;}
      if(lU){lU.rotation.x=0.60;lU.rotation.z=-0.22;lU.rotation.y=-0.10;}
      if(rF){rF.rotation.x=0.72;rF.rotation.y=0.55;}
      if(lF){lF.rotation.x=0.72;lF.rotation.y=-0.55;}
      break;
    case 'stretch':
      const sp=Math.sin((I.subTimer/I.subMax)*Math.PI);
      if(rU){rU.rotation.x=sp*0.12;rU.rotation.z=-0.18-sp*1.05;rU.rotation.y=0;}
      if(lU){lU.rotation.x=sp*0.12;lU.rotation.z= 0.18+sp*1.05;lU.rotation.y=0;}
      if(rF){rF.rotation.x=-0.05;} if(lF){lF.rotation.x=-0.05;}
      if(rH){rH.rotation.z=0.05+Math.sin(t*1.4)*0.03;}
      if(lH){lH.rotation.z=-0.05-Math.sin(t*1.4)*0.03;}
      break;
    case 'squat':
      if(rU){rU.rotation.x=0.12;rU.rotation.z=-0.42;rU.rotation.y=0.05;}
      if(lU){lU.rotation.x=0.12;lU.rotation.z= 0.42;lU.rotation.y=-0.05;}
      if(rF){rF.rotation.x=0.18;} if(lF){lF.rotation.x=0.18;}
      break;
    case 'listen':
      if(rU){rU.rotation.x=0.08;rU.rotation.z=-0.25;rU.rotation.y=0.04;}
      if(lU){lU.rotation.x=0.25;lU.rotation.z= 0.48;lU.rotation.y=-0.08;}
      if(lF){lF.rotation.x=0.62;lF.rotation.y=0.20;}
      if(lH){lH.rotation.x=0.12;}
      break;
    case 'speak':
      const gA=Math.sin(t*1.7)*0.20;
      if(rU){rU.rotation.x=0.20+Math.sin(t*1.1)*0.12;rU.rotation.z=-0.30+gA;rU.rotation.y=0.05;}
      if(lU){lU.rotation.x=0.08;lU.rotation.z=0.25;lU.rotation.y=-0.05;}
      if(rF){rF.rotation.x=0.25+Math.sin(t*1.9)*0.18;}
      if(rH){rH.rotation.z=0.08+Math.sin(t*2.3)*0.10;}
      if(lF){lF.rotation.x=0.08;} if(lH){lH.rotation.z=-0.04;}
      break;
    case 'gesture':
      const g1=Math.sin(t*1.4)*0.22,g2=Math.sin(t*1.7+1.0)*0.18;
      if(rU){rU.rotation.x=0.28+Math.sin(t*1.2)*0.15;rU.rotation.z=-0.25+g1;rU.rotation.y=0.05;}
      if(lU){lU.rotation.x=0.28+Math.sin(t*1.5)*0.12;lU.rotation.z= 0.25+g2;lU.rotation.y=-0.05;}
      if(rF){rF.rotation.x=0.32+Math.sin(t*1.9)*0.20;}
      if(lF){lF.rotation.x=0.28+Math.sin(t*1.7)*0.16;}
      if(rH){rH.rotation.z=0.06+Math.sin(t*2.6)*0.12;}
      if(lH){lH.rotation.z=-0.06+Math.sin(t*2.2)*0.10;}
      break;
    case 'walk':
      // Walk â€” arms hang, swing applied by _weApplyWalkStride
      if(rU){rU.rotation.x=0.05;rU.rotation.z=-0.16;rU.rotation.y=0.03;}
      if(lU){lU.rotation.x=0.05;lU.rotation.z= 0.16;lU.rotation.y=-0.03;}
      if(rF){rF.rotation.x=0.05;} if(lF){lF.rotation.x=0.05;}
      break;
  }
}

// â”€â”€ HEAD / NECK LOOK â”€â”€
function _weApplyHeadLook(yaw, pitch, t, dop, fat) {
  const n1=_weBones['CC_Base_NeckTwist01_037'];
  const n2=_weBones['CC_Base_NeckTwist02_038'];
  const hd=_weBones['CC_Base_Head_039'];
  const le=_weBones['CC_Base_L_Eye_047'];
  const re=_weBones['CC_Base_R_Eye_046'];
  const _dop=dop||0.5,_fat=fat||0;
  if(n1){n1.rotation.y=yaw*0.38;n1.rotation.x=(_dop<0.4?0.06:0)+_fat*0.03+pitch*0.32;}
  if(n2){n2.rotation.y=yaw*0.28;n2.rotation.x=pitch*0.22;}
  if(hd){hd.rotation.y=yaw*0.34;hd.rotation.x=pitch*0.42;}
  if(le){le.rotation.y=yaw*0.10+Math.sin(t*0.65+0.3)*0.025;}
  if(re){re.rotation.y=yaw*0.10+Math.sin(t*0.65)*0.025;}
  const jaw=_weBones['CC_Base_JawRoot_041'];
  if(jaw){const cor_=(typeof chem!=='undefined')?chem.cor:0.2,nor_=(typeof chem!=='undefined')?chem.nor:0.3;jaw.rotation.x=Math.max(0,(cor_+nor_)*0.5-0.4)*0.07;}
}

// â”€â”€ WALK STRIDE â€” additive offsets on top of mixer base pose â”€â”€
// Hip and thigh alternating motion gives visible stride.
// All values additive (+=) so they blend with mixer base without overriding.
function _weApplyWalkStride(bob) {
  const rU =_weBones['CC_Base_R_Upperarm_063'];
  const lU =_weBones['CC_Base_L_Upperarm_051'];
  const hip=_weBones['CC_Base_Hip_02'];
  const waist=_weBones['CC_Base_Waist_034'];
  const rT =_weBones['CC_Base_R_Thigh_019'];
  const lT =_weBones['CC_Base_L_Thigh_04'];

  // Arm swing â€” opposite phase to legs
  if(rU) rU.rotation.x += Math.sin(bob+Math.PI)*0.10;
  if(lU) lU.rotation.x += Math.sin(bob)*0.10;

  // Hip sway â€” lateral rock gives weight shift
  if(hip)   hip.rotation.z   += Math.sin(bob)*0.055;
  if(waist) waist.rotation.z += Math.sin(bob)*0.025;

  // Thigh forward/back stride â€” additive on mixer idle pose
  // Small values so they don't fight the mixer leg orientation
  if(rT) rT.rotation.x += Math.sin(bob+Math.PI)*0.18;
  if(lT) lT.rotation.x += Math.sin(bob)*0.18;
}
// END INSTINCT ENGINE
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// âš   DO NOT DELETE â€” IK-FIRST WALK SYSTEM
// Planted foot drives body speed. Two-bone IK (law of cosines).
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
const _WE_THIGH      = 0.38;
const _WE_CALF       = 0.36;
const _WE_STRIDE_LEN = 0.28;
let _weFootR = {x:0,y:0,z:0,planted:false};
let _weFootL = {x:0,y:0,z:0,planted:false};

function _weIKStep(dirX,dirZ,rawSpd,bob){
  if(!_weBody) return rawSpd;
  const baseY=_weBody._baseY||0;
  const bodyX=_weBodyPos.x, bodyZ=_weBodyPos.z;
  const rPhase=Math.sin(bob), lPhase=Math.sin(bob+Math.PI);
  const FOOT_OFF=0.12;
  if(rPhase<0&&!_weFootR.planted){
    _weFootR.planted=true;
    _weFootR.x=bodyX+dirX*_WE_STRIDE_LEN*0.5+(-dirZ)*FOOT_OFF;
    _weFootR.z=bodyZ+dirZ*_WE_STRIDE_LEN*0.5+dirX*FOOT_OFF;
    _weFootR.y=baseY;
  }
  if(rPhase>=0) _weFootR.planted=false;
  if(lPhase<0&&!_weFootL.planted){
    _weFootL.planted=true;
    _weFootL.x=bodyX+dirX*_WE_STRIDE_LEN*0.5+dirZ*FOOT_OFF;
    _weFootL.z=bodyZ+dirZ*_WE_STRIDE_LEN*0.5+(-dirX)*FOOT_OFF;
    _weFootL.y=baseY;
  }
  if(lPhase>=0) _weFootL.planted=false;
  let cSpd=rawSpd;
  const pf=_weFootR.planted?_weFootR:(_weFootL.planted?_weFootL:null);
  if(pf){
    const newBX=bodyX+dirX*rawSpd, newBZ=bodyZ+dirZ*rawSpd;
    const dx=newBX-pf.x, dz=newBZ-pf.z;
    const dy=(_WE_THIGH+_WE_CALF*0.5)-pf.y;
    const reach=Math.sqrt(dx*dx+dz*dz+dy*dy);
    const maxR=_WE_THIGH+_WE_CALF-0.02;
    if(reach>maxR){
      const cur=Math.sqrt((bodyX-pf.x)**2+(bodyZ-pf.z)**2+dy*dy);
      cSpd=Math.max(0,rawSpd*Math.max(0,(maxR-cur)/rawSpd));
    }
  }
  _weApplyFootIKBones(bob,dirX,dirZ,cSpd,baseY);
  return cSpd;
}

function _weApplyFootIKBones(bob,dirX,dirZ,spd,baseY){
  const rT=_weBones['CC_Base_R_Thigh_019'],rC=_weBones['CC_Base_R_Calf_020'],rFt=_weBones['CC_Base_R_Foot_022'];
  const lT=_weBones['CC_Base_L_Thigh_04'],lC=_weBones['CC_Base_L_Calf_05'],lFt=_weBones['CC_Base_L_Foot_06'];
  const rU=_weBones['CC_Base_R_Upperarm_063'],lU=_weBones['CC_Base_L_Upperarm_051'];
  const rF=_weBones['CC_Base_R_Forearm_064'],lF=_weBones['CC_Base_L_Forearm_052'];
  const hip=_weBones['CC_Base_Hip_02'],waist=_weBones['CC_Base_Waist_034'];
  const s1=_weBones['CC_Base_Spine01_035'],s2=_weBones['CC_Base_Spine02_036'];
  const neck=_weBones['CC_Base_NeckTwist01_037'];

  const THIGH_AMP  = 0.262;  // 15Â° exactly
  const KNEE_SWING = 0.420;  // ~24Â° forward bend at peak swing
  const KNEE_TRAIL = 0.140;  // ~8Â° forward bend when trailing â€” never backward
  const KNEE_MIN   = 0.055;  // absolute floor â€” calf always slightly bent forward

  // â”€â”€ RIGHT LEG â”€â”€
  const rSin  = Math.sin(bob);
  const rThigh = rSin * -THIGH_AMP;
  // Knee: strictly forward only (always â‰¥ KNEE_MIN, never negative)
  let rKnee = rSin <= 0 ? (-rSin)*KNEE_SWING : rSin*KNEE_TRAIL;
  rKnee = Math.max(KNEE_MIN, rKnee);
  const rFoot = rSin < 0 ? (-rSin)*0.10 : -0.04;

  // â”€â”€ LEFT LEG â”€â”€
  const lSin  = Math.sin(bob + Math.PI);
  const lThigh = lSin * -THIGH_AMP;
  let lKnee = lSin <= 0 ? (-lSin)*KNEE_SWING : lSin*KNEE_TRAIL;
  lKnee = Math.max(KNEE_MIN, lKnee);
  const lFoot = lSin < 0 ? (-lSin)*0.10 : -0.04;

  if(rT) rT.rotation.x += rThigh;
  if(rC) rC.rotation.x += rKnee;   // always positive = always forward bend
  if(rFt)rFt.rotation.x += rFoot;
  if(lT) lT.rotation.x += lThigh;
  if(lC) lC.rotation.x += lKnee;   // always positive = always forward bend
  if(lFt)lFt.rotation.x += lFoot;

  // â”€â”€ TORSO â€” moves with leg push (spd>0 only on heel strike) â”€â”€
  // spd is passed as actual step distance on strike, 0 between strikes.
  // Torso leans forward proportional to push â€” settles between steps.
  const isStrike = spd > 0;
  const leanAmt  = isStrike ? 0.14 : 0.06; // lean on push, relax between steps
  // Smooth: blend toward target lean using small lerp factor
  if (!_weWalkLean) _weWalkLean = 0.06;
  _weWalkLean += (leanAmt - _weWalkLean) * 0.12;
  if(s1)   s1.rotation.x   += _weWalkLean * 0.55;
  if(s2)   s2.rotation.x   += _weWalkLean * 0.45;
  if(neck) neck.rotation.x -= _weWalkLean * 0.28;

  // â”€â”€ CONTRALATERAL ARM SWING â”€â”€
  const armAmt = 0.16; // fixed amplitude â€” not speed-dependent
  if(lU) lU.rotation.x += rSin *  armAmt;
  if(rU) rU.rotation.x += lSin *  armAmt;
  if(lF) lF.rotation.x += Math.max(0, -rSin*armAmt) * 0.28;
  if(rF) rF.rotation.x += Math.max(0, -lSin*armAmt) * 0.28;

  // â”€â”€ HIP SWAY â”€â”€
  if(hip)   hip.rotation.z   += rSin * 0.05;
  if(waist) waist.rotation.z += rSin * 0.018;
}
let _weWalkLean = 0.06; // persistent torso lean state
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// END IK-FIRST WALK SYSTEM
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// âš   DO NOT DELETE â€” OPEN PALMS DURING SPEECH
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
let _weIsSpeaking=false, _weSpeakBlend=0;
function _weApplyOpenPalmsSpeaking(t){
  if(!_weBody||!_weStartupDone) return;
  const target = _weIsSpeaking ? 1.0 : 0.0;
  _weSpeakBlend += (target - _weSpeakBlend) * 0.04;
  if(_weSpeakBlend < 0.01) return;
  const p = _weSpeakBlend;
  // Hands only â€” no arm movement, no torso rotation
  const rH=_weBones['CC_Base_R_Hand_068'];
  const lH=_weBones['CC_Base_L_Hand_055'];
  if(rH){ rH.rotation.x += p * 0.10; rH.rotation.y += p * 0.12; rH.rotation.z += p * 0.05; }
  if(lH){ lH.rotation.x += p * 0.10; lH.rotation.y -= p * 0.12; lH.rotation.z -= p * 0.05; }
}
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// END OPEN PALMS DURING SPEECH
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•


// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// âš   DO NOT DELETE â€” BRAIN-MAPPED INSTINCT & MOTOR COMMAND SYSTEM
//
//  BRAIN MAPPING:
//  Every instinct is mapped to a brain region + neurochemical threshold.
//  When the brain fires above threshold, the instinct becomes available.
//  The LLM response parser scans for motor keywords and submits them
//  via _weMotorCommand() which the brain must approve before execution.
//
//  BRAIN REGION â†’ INSTINCT MAP:
//  MOTOR + high dop           â†’ walk_explore, run
//  MOTOR + low dop + high fat â†’ tired_sway, sleep_down
//  CEREBEL + any              â†’ balance instincts (shift, squat)
//  SOCIAL + oxy high          â†’ engage_listen, engage_speak, engage_gesture
//  INSULA + cor high          â†’ idle_cross_arms, idle_hands_waist
//  AMYG + nor spike           â†’ startle, look_around fast
//  BASAL + voluntary command  â†’ user-summoned poses (if brain approves)
//  PFC + command              â†’ override gate â€” brain can veto any pose
//
//  USER COMMANDS:
//  User can type or speak any instruction. The LLM extracts motor intent
//  and calls _weMotorCommand(cmd, forceApprove). Brain approval gate:
//  â€” If cor > 0.7 or fat > 0.8 â†’ body refuses (too stressed/tired)
//  â€” If engaged â†’ priority commands always approved
//  â€” Otherwise 85% approval rate (brain is cooperative)
//
//  NODS:
//  nod_yes      â€” single forward dip
//  nod_slow     â€” slow thoughtful single nod
//  nod_double   â€” two quick dips (agreement)
//  nod_tilt     â€” head tilts sideways (curiosity/interest)
//  nod_shake    â€” left-right shake (no/disagreement)
//  nod_think    â€” head tilts up-right (thinking pose)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// â”€â”€ Brain-region instinct gate â”€â”€
// Returns true if the brain state supports executing this instinct
function _weBrainApproves(cmd) {
  const cor = (typeof chem!=='undefined') ? chem.cor : 0.2;
  const fat = (typeof circadianFatigue!=='undefined') ? circadianFatigue : 0;
  const dop = (typeof chem!=='undefined') ? chem.dop : 0.5;
  const ph  = (typeof circadianPhase!=='undefined') ? circadianPhase : 'awake';

  // Hard vetoes â€” brain refuses regardless of command
  if (ph==='sleep' || ph==='rem')   return false; // sleeping
  if (fat > 0.85)                   return false; // too exhausted
  if (cor > 0.80)                   return false; // too stressed/defensive

  // Specific command vetoes
  if ((cmd==='run'||cmd==='jump') && fat>0.60) return false;
  if (cmd==='sleep_down' && dop>0.65)           return false; // too energetic to sleep

  // 85% approval otherwise â€” brain is cooperative but has agency
  return Math.random() < 0.85;
}

// â”€â”€ User motor command entry point â”€â”€
// Called by LLM response parser and direct user commands.
// forceApprove = true skips the brain gate (for direct user typing).
function _weMotorCommand(cmd, forceApprove) {
  if (!_weBody || !_weStartupDone) return;
  const approved = forceApprove || _weBrainApproves(cmd);
  if (!approved) {
    console.log('[Motor] Brain vetoed command:', cmd);
    // Show subtle refusal â€” small head shake
    _weQueueNod('nod_shake');
    return;
  }
  console.log('[Motor] Executing command:', cmd);
  _weExecuteCommand(cmd);
}

// â”€â”€ Nod queue â€” plays one nod then returns to instinct â”€â”€
let _weNodQueue   = [];
let _weNodActive  = null;
let _weNodPhase   = 0;
let _weNodTimer   = 0;

function _weQueueNod(nodType) {
  _weNodQueue.push(nodType);
}

function _weTickNod(t, dt) {
  // Process nod queue â€” runs on top of instinct, applied to head bones
  if (!_weNodActive && _weNodQueue.length > 0) {
    _weNodActive = _weNodQueue.shift();
    _weNodPhase  = 0;
    _weNodTimer  = 0;
  }
  if (!_weNodActive) return;

  _weNodTimer += dt;
  const hd = _weBones['CC_Base_Head_039'];
  const n1 = _weBones['CC_Base_NeckTwist01_037'];
  const n2 = _weBones['CC_Base_NeckTwist02_038'];
  const dur = { nod_yes:0.6, nod_slow:1.0, nod_double:0.8, nod_tilt:1.0, nod_shake:0.9, nod_think:1.2 };
  const d   = dur[_weNodActive] || 0.7;
  const p   = Math.min(1, _weNodTimer / d);

  switch(_weNodActive) {
    case 'nod_yes':
      // Single forward dip and return
      if(hd) hd.rotation.x  = Math.sin(p*Math.PI)*0.28;
      if(n1) n1.rotation.x += Math.sin(p*Math.PI)*0.14;
      break;
    case 'nod_slow':
      // Slow thoughtful nod
      if(hd) hd.rotation.x  = Math.sin(p*Math.PI)*0.20;
      if(n1) n1.rotation.x += Math.sin(p*Math.PI)*0.10;
      break;
    case 'nod_double':
      // Two quick dips
      if(hd) hd.rotation.x  = Math.abs(Math.sin(p*Math.PI*2))*0.22;
      if(n1) n1.rotation.x += Math.abs(Math.sin(p*Math.PI*2))*0.10;
      break;
    case 'nod_tilt':
      // Head tilts sideways (curiosity)
      if(hd){ hd.rotation.z=Math.sin(p*Math.PI)*0.30; hd.rotation.x=0; }
      if(n1){ n1.rotation.z=Math.sin(p*Math.PI)*0.15; }
      break;
    case 'nod_shake':
      // Left-right shake (no)
      if(hd) hd.rotation.y = Math.sin(p*Math.PI*2.5)*0.35;
      if(n1) n1.rotation.y = Math.sin(p*Math.PI*2.5)*0.18;
      break;
    case 'nod_think':
      // Tilts up and to right (thinking)
      if(hd){ hd.rotation.x=-Math.sin(p*Math.PI)*0.18; hd.rotation.y=Math.sin(p*Math.PI)*0.25; }
      if(n1){ n1.rotation.x=-Math.sin(p*Math.PI)*0.10; }
      break;
  }

  if (p >= 1.0) _weNodActive = null;
}

// â”€â”€ Pose override â€” timed pose that replaces current instinct temporarily â”€â”€
let _wePoseOverride  = null;
let _wePoseTimer     = 0;
let _wePoseDuration  = 0;

function _weSetPoseOverride(pose, duration) {
  _wePoseOverride  = pose;
  _wePoseTimer     = 0;
  _wePoseDuration  = duration || 3.0;
}

function _weTickPoseOverride(t, dt) {
  if (!_wePoseOverride) return false;
  _wePoseTimer += dt;
  if (_wePoseTimer >= _wePoseDuration) { _wePoseOverride=null; return false; }
  const p = _wePoseTimer / _wePoseDuration;
  const rU=_weBones['CC_Base_R_Upperarm_063'],rF=_weBones['CC_Base_R_Forearm_064'],rH=_weBones['CC_Base_R_Hand_068'];
  const lU=_weBones['CC_Base_L_Upperarm_051'],lF=_weBones['CC_Base_L_Forearm_052'],lH=_weBones['CC_Base_L_Hand_055'];
  const hd=_weBones['CC_Base_Head_039'],n1=_weBones['CC_Base_NeckTwist01_037'],n2=_weBones['CC_Base_NeckTwist02_038'];
  const rT=_weBones['CC_Base_R_Thigh_019'],lT=_weBones['CC_Base_L_Thigh_04'];
  const rC=_weBones['CC_Base_R_Calf_020'],lC=_weBones['CC_Base_L_Calf_05'];

  switch(_wePoseOverride) {

    case 'look_camera':
      // Rotate body to face camera â€” persistent, not timed
      const camY2 = _weOrbitAz;
      let rdc=camY2-_weBodyRotY; while(rdc>Math.PI)rdc-=Math.PI*2; while(rdc<-Math.PI)rdc+=Math.PI*2;
      _weBodyRotY+=rdc*0.10; _weBodyRotYTgt=_weBodyRotY;
      if(hd){hd.rotation.x=-0.04;hd.rotation.y=0;}
      if(n1){n1.rotation.y=0;n1.rotation.x=-0.02;}
      break;

    case 'turn_around':
      // Rotate body 180Â° from current facing
      _weBodyRotYTgt = _weBodyRotY + Math.PI;
      let trd=_weBodyRotYTgt-_weBodyRotY;
      while(trd>Math.PI)trd-=Math.PI*2; while(trd<-Math.PI)trd+=Math.PI*2;
      _weBodyRotY += trd*0.06;
      if(_weBody) _weBody.rotation.y = _weBodyRotY;
      break;

    case 'look_up':
      if(hd){hd.rotation.x=-0.55;} if(n1){n1.rotation.x=-0.25;} if(n2){n2.rotation.x=-0.12;}
      break;
    case 'look_down':
      if(hd){hd.rotation.x= 0.55;} if(n1){n1.rotation.x= 0.25;} if(n2){n2.rotation.x= 0.12;}
      break;
    case 'look_left':
      if(hd){hd.rotation.y=-0.60;hd.rotation.z=0;} if(n1){n1.rotation.y=-0.30;} if(n2){n2.rotation.y=-0.15;}
      break;
    case 'look_right':
      if(hd){hd.rotation.y= 0.60;hd.rotation.z=0;} if(n1){n1.rotation.y= 0.30;} if(n2){n2.rotation.y= 0.15;}
      break;
    case 'look_left_tilt':
      if(hd){hd.rotation.y=-0.55;hd.rotation.z=-0.28;} if(n1){n1.rotation.y=-0.28;n1.rotation.z=-0.12;}
      break;
    case 'look_right_tilt':
      if(hd){hd.rotation.y= 0.55;hd.rotation.z= 0.28;} if(n1){n1.rotation.y= 0.28;n1.rotation.z= 0.12;}
      break;
    case 'look_around':
      if(hd){hd.rotation.y=Math.sin(t*2.5)*0.65;hd.rotation.x=Math.sin(t*1.8)*0.15;}
      if(n1){n1.rotation.y=Math.sin(t*2.5)*0.30;}
      break;

    case 'clap':
      const clap=Math.abs(Math.sin(t*8.0));
      if(rU){rU.rotation.z=-0.50;rU.rotation.x=0.70;}
      if(lU){lU.rotation.z= 0.50;lU.rotation.x=0.70;}
      if(rF){rF.rotation.x= 0.60+clap*0.25;}
      if(lF){lF.rotation.x= 0.60+clap*0.25;}
      if(rH){rH.rotation.y= clap*0.30;}
      if(lH){lH.rotation.y=-clap*0.30;}
      break;

    case 'hold_head':
      // Both hands pressed to sides of head
      if(rU){rU.rotation.z=-0.10;rU.rotation.x=1.20;}
      if(lU){lU.rotation.z= 0.10;lU.rotation.x=1.20;}
      if(rF){rF.rotation.x= 0.55;rF.rotation.y=-0.35;}
      if(lF){lF.rotation.x= 0.55;lF.rotation.y= 0.35;}
      if(rH){rH.rotation.x= 0.25;}
      if(lH){lH.rotation.x= 0.25;}
      if(hd){hd.rotation.x=Math.sin(t*1.5)*0.08;}
      break;

    case 'cover_face':
      // Both hands cover face â€” arms raised high, forearms folded up, hands at face
      // Upperarm: x=1.80 lifts arm up high, z inward brings elbows together
      if(rU){rU.rotation.x=1.80; rU.rotation.z= 0.35; rU.rotation.y= 0.20;}
      if(lU){lU.rotation.x=1.80; lU.rotation.z=-0.35; lU.rotation.y=-0.20;}
      // Forearm bends sharply so hand folds back toward face
      if(rF){rF.rotation.x= 1.45; rF.rotation.y=-0.20;}
      if(lF){lF.rotation.x= 1.45; lF.rotation.y= 0.20;}
      // Hand flattens to press against face
      if(rH){rH.rotation.x= 0.30; rH.rotation.z=-0.10;}
      if(lH){lH.rotation.x= 0.30; lH.rotation.z= 0.10;}
      // Head tilts slightly into hands
      if(hd){hd.rotation.x=-0.12;}
      if(n1){n1.rotation.x=-0.06;}
      break;

    case 'pick_up':
      // Reach down right hand
      const rph=Math.sin(p*Math.PI);
      if(rU){rU.rotation.z=-0.30;rU.rotation.x=0.45+rph*0.65;}
      if(rF){rF.rotation.x= 0.30+rph*0.55;}
      if(rH){rH.rotation.x= 0.20+rph*0.30;}
      if(hd){hd.rotation.x= 0.20+rph*0.30;}
      if(n1){n1.rotation.x= 0.10+rph*0.15;}
      break;

    case 'throw':
      // Wind up right arm then throw
      if(p<0.5){
        const wp=p*2;
        if(rU){rU.rotation.z=-1.20*wp;rU.rotation.x=-0.30*wp;}
        if(rF){rF.rotation.x=-0.50*wp;}
      } else {
        const fp=(p-0.5)*2;
        if(rU){rU.rotation.z=-1.20+fp*1.50;rU.rotation.x=-0.30+fp*0.80;}
        if(rF){rF.rotation.x=-0.50+fp*0.70;}
        if(rH){rH.rotation.z= fp*0.40;}
      }
      if(hd){hd.rotation.x=-0.10;hd.rotation.y=Math.sin(t)*0.05;}
      break;

    case 'run':
      _weBodyState='walk';
      _weBodyTarget={x:(Math.random()-0.5)*1.5, z:(Math.random()-0.5)*1.5};
      _weSetState('walk_explore');
      _weInstinct.walkSpeedT=0.020;
      return false; // hand back to instinct

    case 'sit':
      // Lower body Y â€” no leg bone rotation (inverts with -PI/2 root)
      _weBody.position.y=(_weBody._baseY||0)-0.18;
      _weBody.rotation.x=0; _weBody.rotation.z=0;
      if(rU){rU.rotation.z=-0.28;} if(lU){lU.rotation.z=0.28;}
      if(hd){hd.rotation.x=0;}
      break;

    case 'squat_knees_together':
      // Lower body Y only â€” bone rotations invert with -PI/2 root transform
      const sqp=Math.sin(p*Math.PI);
      _weBody.position.y=(_weBody._baseY||0)-sqp*0.25;
      _weBody.rotation.x=0; _weBody.rotation.z=0;
      if(rU){rU.rotation.z=-0.38;rU.rotation.x=0.18;}
      if(lU){lU.rotation.z= 0.38;lU.rotation.x=0.18;}
      if(hd){hd.rotation.x=sqp*0.12;}
      break;

    case 'lie_down':
      // Lower body to floor â€” no group.rotation.x (inverts with root)
      _weBody.position.y=Math.max((_weBody._baseY||0)-0.45,(_weBody.position.y||(_weBody._baseY||0))-0.003);
      _weBody.rotation.x=0;
      if(rU){rU.rotation.z=-0.15;rU.rotation.x=0.05;}
      if(lU){lU.rotation.z= 0.15;lU.rotation.x=0.05;}
      break;
  }
  return true; // pose is active
}

// â”€â”€ Execute a named command â”€â”€
function _weExecuteCommand(cmd) {
  const instant = ['look_camera','look_up','look_down','look_left','look_right',
                   'look_left_tilt','look_right_tilt','look_around'];
  const nods    = ['nod_yes','nod_slow','nod_double','nod_tilt','nod_shake','nod_think'];
  const poses   = ['clap','hold_head','cover_face','pick_up','throw','sit',
                   'squat_knees_together','lie_down','run'];

  if (nods.includes(cmd)) { _weQueueNod(cmd); return; }

  // Duration map
  const dur = {
    clap:3.0, hold_head:2.5, cover_face:2.0,
    pick_up:2.5, throw:2.0, sit:4.0,
    squat_knees_together:3.5, lie_down:6.0,
    look_camera:3.0, turn_around:2.0,
    look_up:2.0, look_down:2.0,
    look_left:2.0, look_right:2.0,
    look_left_tilt:2.5, look_right_tilt:2.5, look_around:3.5,
    run:0.1,
  };
  _weSetPoseOverride(cmd, dur[cmd]||2.5);
}

// â”€â”€ LLM response motor keyword parser â”€â”€
// âš  DO NOT DELETE â€” scans Katrina's LLM responses for motor intent keywords.
// Called from appendMsg when role='assistant'. Brain approval gate applies.
const _WE_MOTOR_KEYWORDS = {
  // Locomotion
  'run':'run','running':'run','sprint':'run',
  'walk':'walk_explore','walking':'walk_explore','stroll':'walk_explore',
  'sit down':'sit','sitting':'sit','take a seat':'sit',
  'lie down':'lie_down','lying down':'lie_down','lay down':'lie_down',
  // Head
  'look at me':'look_camera','look at you':'look_camera','face me':'look_camera',
  'look at the camera':'look_camera','turn to face me':'look_camera',
  'turn around':'turn_around','turn back':'turn_around','face away':'turn_around',
  'look up':'look_up','looking up':'look_up',
  'look down':'look_down','looking down':'look_down',
  'look left':'look_left','look right':'look_right',
  'look around':'look_around','glance around':'look_around',
  // Nods
  'nod':'nod_yes','nodding':'nod_yes','yes':'nod_yes',
  'shake head':'nod_shake','no':'nod_shake','disagree':'nod_shake',
  'thinking':'nod_think','hmm':'nod_think','wonder':'nod_think',
  'curious':'nod_tilt','interesting':'nod_tilt',
  // Actions
  'clap':'clap','clapping':'clap','applaud':'clap',
  'hold my head':'hold_head','head in hands':'hold_head',
  'cover my face':'cover_face','hide face':'cover_face',
  'pick up':'pick_up','picking up':'pick_up','reach':'pick_up',
  'throw':'throw','throwing':'throw','toss':'throw',
  'squat':'squat_knees_together','crouch':'squat_knees_together',
};

function _weParseMotorFromText(text) {
  if (!text || !_weBody) return;
  const lower = text.toLowerCase();
  for (const [keyword, cmd] of Object.entries(_WE_MOTOR_KEYWORDS)) {
    if (lower.includes(keyword)) {
      // Small delay so body finishes current pose first
      setTimeout(() => _weMotorCommand(cmd, false), 400);
      return; // one command per message
    }
  }
}

// â”€â”€ User direct command box â”€â”€
// User types a command directly in chat â€” parsed immediately with high trust
function _weUserDirectCommand(text) {
  const lower = text.toLowerCase().trim();
  for (const [keyword, cmd] of Object.entries(_WE_MOTOR_KEYWORDS)) {
    if (lower.includes(keyword)) {
      _weMotorCommand(cmd, true); // direct user command = force approve
      return true;
    }
  }
  return false;
}

// â”€â”€ Brain region â†’ instinct weight modifiers â”€â”€
// These are applied inside _wePickNextInstinct via live chem values.
// Here for documentation of the brainâ†’body mapping:
//
// MOTOR cortex (chem.dop > 0.55)     â†’ walk_explore weight Ã—1.8
// CEREBEL (chem.ach > 0.55)          â†’ idle_squat, idle_shift weight Ã—1.5
// SOCIAL/INSULA (chem.oxy > 0.65)    â†’ engage_listen, engage_speak Ã—2.0
// AMYG (chem.cor > 0.50)             â†’ idle_cross_arms, idle_hands_waist Ã—1.8
// INSULA (chem.nor > 0.55)           â†’ idle_shift, idle_look Ã—1.6
// PFC (fatigue < 0.3 + dop high)     â†’ idle_stretch, idle_cross_arms
// All thresholds applied in _wePickNextInstinct probability table.

// â”€â”€ Patch appendMsg to parse motor from LLM responses â”€â”€
const _origAppendMsg_motor = (typeof appendMsg !== 'undefined') ? appendMsg : null;
if (_origAppendMsg_motor) {
  appendMsg = function(role, text, opts) {
    _origAppendMsg_motor(role, text, opts);
    // Parse motor commands from Katrina's responses
    if (role==='assistant' && typeof _weParseMotorFromText==='function') {
      _weParseMotorFromText(text);
    }
    // Also nod when user sends a message
    if (role==='user' && _weBody && _weStartupDone) {
      const nodTypes=['nod_yes','nod_slow','nod_tilt','nod_think'];
      _weQueueNod(nodTypes[Math.floor(Math.random()*nodTypes.length)]);
    }
    // Sync world engine chat panel
    if (document.getElementById('we-overlay')?.style.display==='flex') {
      if(typeof _weSyncChat==='function') _weSyncChat();
    }
  };
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// âš   DO NOT DELETE â€” WORLD ENGINE PHYSICS
//
//  Simple verlet-style physics for the body and its environment.
//  â€” Gravity: constant downward acceleration on _weVelY
//  â€” Floor collision: body Y never drops below _weBody._baseY (feet on floor)
//  â€” Ceiling collision: body top (baseY + bodyHeight) never exceeds D.H
//  â€” Wall collision: _weBodyPos.x/z clamped to Â±_ROOM_HALF_W/D with bounce
//  â€” Mass: body has inertia â€” velocity decays with drag each frame
//  â€” No external physics library needed â€” lightweight analytic solution
//
//  _weVelY    â€” vertical velocity (m/s equivalent)
//  _weOnGround â€” true when feet touch floor (used by instinct for grounding)
//  _weBodyH    â€” measured height of body in scene units
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
const _WE_GRAVITY   = -9.8 * 0.004;  // scaled gravity per frame (not real time)
const _WE_DRAG      = 0.82;          // velocity damping per frame
const _WE_BOUNCE    = 0.05;          // wall/ceiling restitution (barely bouncy)
const _WE_WALL_DRAG = 0.60;          // extra slowdown on wall contact
let   _weVelY       = 0;             // vertical velocity
let   _weVelX       = 0;             // horizontal velocity X
let   _weVelZ       = 0;             // horizontal velocity Z
let   _weOnGround   = true;          // is body standing on floor?
let   _weBodyH      = 1.3;           // body height in scene units (set after load)

function _wePhysicsTick(dt) {
  if (!_weBody || !_weStartupDone) return;

  const baseY = _weBody._baseY || 0;   // floor contact Y
  const D     = _weDim;
  const HW    = _ROOM_HALF_W;
  const HD    = _ROOM_HALF_D;
  const bodyTopY = _weBody.position.y + _weBodyH;

  // â”€â”€ Gravity â”€â”€
  if (!_weOnGround) {
    _weVelY += _WE_GRAVITY;
  } else {
    _weVelY = Math.min(_weVelY, 0); // can only go up when on ground (jump)
  }

  // â”€â”€ Integrate Y position â”€â”€
  _weBody.position.y += _weVelY;

  // â”€â”€ Floor collision â€” feet never sink below baseY â”€â”€
  if (_weBody.position.y <= baseY) {
    _weBody.position.y = baseY;
    _weVelY = 0;
    _weOnGround = true;
  } else {
    _weOnGround = false;
  }

  // â”€â”€ Ceiling collision â”€â”€
  if (bodyTopY >= D.H) {
    _weBody.position.y = D.H - _weBodyH;
    _weVelY = -Math.abs(_weVelY) * _WE_BOUNCE;
  }

  // â”€â”€ Wall collision â€” X axis â”€â”€
  if (_weBodyPos.x > HW) {
    _weBodyPos.x = HW;
    _weVelX = -Math.abs(_weVelX) * _WE_BOUNCE;
    _weBodyPos.x -= 0.01;
  } else if (_weBodyPos.x < -HW) {
    _weBodyPos.x = -HW;
    _weVelX = Math.abs(_weVelX) * _WE_BOUNCE;
    _weBodyPos.x += 0.01;
  }

  // â”€â”€ Wall collision â€” Z axis â”€â”€
  if (_weBodyPos.z > HD) {
    _weBodyPos.z = HD;
    _weVelZ = -Math.abs(_weVelZ) * _WE_BOUNCE;
    _weBodyPos.z -= 0.01;
  } else if (_weBodyPos.z < -HD) {
    _weBodyPos.z = -HD;
    _weVelZ = Math.abs(_weVelZ) * _WE_BOUNCE;
    _weBodyPos.z += 0.01;
  }

  // â”€â”€ Horizontal velocity drag (friction) â”€â”€
  _weVelX *= _WE_DRAG;
  _weVelZ *= _WE_DRAG;

  // â”€â”€ Apply horizontal velocity to position â”€â”€
  _weBodyPos.x += _weVelX;
  _weBodyPos.z += _weVelZ;

  // â”€â”€ Sync body group position â”€â”€
  _weBody.position.x = _weBodyPos.x;
  _weBody.position.z = _weBodyPos.z;
}

// â”€â”€ Floor clamp â€” call after any instinct Y offset to prevent sinking â”€â”€
// âš  DO NOT DELETE â€” ensures instinct oscillations never push feet below floor.
function _weClampToFloor() {
  if (!_weBody) return;
  const baseY = _weBody._baseY || 0;
  if (_weBody.position.y < baseY) {
    _weBody.position.y = baseY;
    if (_weVelY < 0) _weVelY = 0;
    _weOnGround = true;
  }
}
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// END WORLD ENGINE PHYSICS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// WE_tick â€” called from brain animate() â€” does nothing (world has own loop)
function WE_tick(t) {}

function _weLoadGLB() {
  document.getElementById('we-upload-panel').style.display='block';
  _weProgress(0,'waiting for fileâ€¦');
}

function _weDropFile(e) {
  e.preventDefault();
  const file = e.dataTransfer?.files?.[0];
  if (file) _weFileChosen(file);
}

function _weFileChosen(file) {
  if (!file) return;
  if (!file.name.toLowerCase().match(/\.(glb|gltf)$/)) {
    _weProgress(0,'âš  please choose a .glb or .gltf file'); return;
  }
  const mb = (file.size/1024/1024).toFixed(1);
  _weProgress(5, `reading ${file.name} (${mb} MB)â€¦`);
  const reader = new FileReader();
  reader.onprogress = ev => {
    if (ev.lengthComputable) _weProgress(5+(ev.loaded/ev.total*55), `readingâ€¦ ${Math.round(ev.loaded/ev.total*60)}%`);
  };
  reader.onload = ev => {
    _weProgress(65,'parsing modelâ€¦');
    const blob = new Blob([ev.target.result],{type:'model/gltf-binary'});
    const url  = URL.createObjectURL(blob);
    document.getElementById('we-upload-panel').style.display='none';
    _weLoadBodyURL(url);
  };
  reader.onerror = () => _weProgress(0,'âš  read error â€” try again');
  reader.readAsArrayBuffer(file);
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// âš   DO NOT DELETE â€” ASTRA LUMEN BONE MOTOR SYSTEM
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

let _weMixer     = null;
let _weIdleClip  = null;
let _weBones     = {};
let _weMotorState= {};

function _weFindBone(n){ return _weBones[n]||null; }

function _weMapBones(root) {
  root.traverse(obj => {
    if (obj.isBone||obj.type==='Bone') _weBones[obj.name]=obj;
    if (obj.isSkinnedMesh&&obj.skeleton) obj.skeleton.bones.forEach(b=>{ _weBones[b.name]=b; });
  });
  console.log('[WE] Bones mapped:',Object.keys(_weBones).length);
  ['CC_Base_Hip_02','CC_Base_Spine01_035','CC_Base_Head_039',
   'CC_Base_L_Upperarm_051','CC_Base_R_Upperarm_063',
   'CC_Base_L_Thigh_04','CC_Base_R_Thigh_019'].forEach(k=>
    console.log(`  ${k}: ${_weBones[k]?'âœ“':'âœ—'}`));
}

function _weApplyBoneMotor(signal, lt, t) {
  const smooth=(k,v,r)=>{ _weMotorState[k]=(_weMotorState[k]||0)*(1-r)+v*r; return _weMotorState[k]; };
  const rArm =smooth('rArm', lt&&lt.rightArm||0, 0.08);
  const lArm =smooth('lArm', lt&&lt.leftArm ||0, 0.08);
  const rLeg =smooth('rLeg', lt&&lt.rightLeg||0, 0.08);
  const lLeg =smooth('lLeg', lt&&lt.leftLeg ||0, 0.08);
  const head =smooth('head', lt&&lt.head    ||0, 0.06);
  const torso=smooth('torso',lt&&lt.torso   ||0, 0.05);
  const dop=(typeof chem!=='undefined')?chem.dop:0.5;
  const cor=(typeof chem!=='undefined')?chem.cor:0.2;
  const oxy=(typeof chem!=='undefined')?chem.oxy:0.5;
  const fat=(typeof circadianFatigue!=='undefined')?circadianFatigue:0;
  const t_=t||0;

  const spine01=_weBones['CC_Base_Spine01_035'];
  const spine02=_weBones['CC_Base_Spine02_036'];
  const hip    =_weBones['CC_Base_Hip_02'];
  const waist  =_weBones['CC_Base_Waist_034'];
  if(spine01){ spine01.rotation.x=oxy*0.04-cor*0.08-fat*0.06+Math.sin(t_*0.9)*0.012*(1-fat); spine01.rotation.z=Math.sin(t_*0.7)*0.008; }
  if(spine02){ spine02.rotation.x=cor*0.10+fat*0.08-dop*0.04+torso*0.12; spine02.rotation.z=Math.sin(t_*0.6)*0.006; }
  if(hip){     hip.rotation.z=Math.sin(t_*1.1)*0.015*(1-fat*0.5); hip.rotation.x=Math.sin(t_*0.4)*0.008; }
  if(waist){   waist.rotation.z=Math.sin(t_*0.8)*0.010; }

  const headB =_weBones['CC_Base_Head_039'];
  const neck1 =_weBones['CC_Base_NeckTwist01_037'];
  const neck2 =_weBones['CC_Base_NeckTwist02_038'];
  const lEye  =_weBones['CC_Base_L_Eye_047'];
  const rEye  =_weBones['CC_Base_R_Eye_046'];
  if(neck1){ neck1.rotation.x=(1-dop)*0.12+fat*0.10-head*0.05+Math.sin(t_*0.8)*0.008; neck1.rotation.y=Math.sin(t_*0.5)*0.015; }
  if(neck2){ neck2.rotation.x=(1-dop)*0.06+fat*0.04; neck2.rotation.z=Math.sin(t_*0.6)*0.005; }
  if(headB){ headB.rotation.x=head*(-0.08); headB.rotation.y=Math.sin(t_*0.3)*0.012; }
  if(lEye)  lEye.rotation.y=Math.sin(t_*0.7+0.3)*0.05;
  if(rEye)  rEye.rotation.y=Math.sin(t_*0.7)*0.05;

  const rU=_weBones['CC_Base_R_Upperarm_063'],rF=_weBones['CC_Base_R_Forearm_064'],rH=_weBones['CC_Base_R_Hand_068'];
  if(rU){ rU.rotation.z=-0.3-rArm*0.5+Math.sin(t_*1.1)*0.02; rU.rotation.x=rArm*0.3+cor*0.05; }
  if(rF){ rF.rotation.y=rArm*0.4+Math.sin(t_*0.9)*0.01; rF.rotation.x=-0.1-rArm*0.2; }
  if(rH){ rH.rotation.z=Math.sin(t_*1.3)*0.015; rH.rotation.x=rArm*0.15; }

  const lU=_weBones['CC_Base_L_Upperarm_051'],lF=_weBones['CC_Base_L_Forearm_052'],lH=_weBones['CC_Base_L_Hand_055'];
  if(lU){ lU.rotation.z=0.3+lArm*0.5+Math.sin(t_*1.0+0.5)*0.02; lU.rotation.x=lArm*0.3+cor*0.05; }
  if(lF){ lF.rotation.y=-(lArm*0.4+Math.sin(t_*0.9+0.3)*0.01); lF.rotation.x=-0.1-lArm*0.2; }
  if(lH){ lH.rotation.z=-Math.sin(t_*1.3+0.4)*0.015; lH.rotation.x=lArm*0.15; }

  const rT=_weBones['CC_Base_R_Thigh_019'],rC=_weBones['CC_Base_R_Calf_020'],rFt=_weBones['CC_Base_R_Foot_022'];
  if(rT){ rT.rotation.x=rLeg*0.25+Math.sin(t_*1.1)*0.02*(_weBodyState==='walk'?1:0.3); rT.rotation.z=-0.06-fat*0.04; }
  if(rC)  rC.rotation.x=-(rLeg*0.15);
  if(rFt) rFt.rotation.x=rLeg*0.08-0.05;

  const lT=_weBones['CC_Base_L_Thigh_04'],lC=_weBones['CC_Base_L_Calf_05'],lFt=_weBones['CC_Base_L_Foot_06'];
  if(lT){ lT.rotation.x=lLeg*0.25+Math.sin(t_*1.1+Math.PI)*0.02*(_weBodyState==='walk'?1:0.3); lT.rotation.z=0.06+fat*0.04; }
  if(lC)  lC.rotation.x=-(lLeg*0.15);
  if(lFt) lFt.rotation.x=lLeg*0.08-0.05;

  const jaw=_weBones['CC_Base_JawRoot_041'];
  if(jaw){ const ar=Math.max(0,(cor+((typeof chem!=='undefined')?chem.nor:0))*0.5-0.3); jaw.rotation.x=Math.max(0,ar*0.08+Math.sin(t_*3.2)*0.003); }
}

function _weLoadBodyURL(url) {
  if (!THREE.GLTFLoader) { _weStatus('âš  GLTFLoader not available','#ff6644'); return; }
  _weStatus('loading bodyâ€¦ 0%');
  _weBones={}; _weMotorState={};

  const loader = new THREE.GLTFLoader();
  loader.load(url,
    gltf => {
      _weProgress(100,'âœ“ parsing complete');

      // â”€â”€ FULL DIAGNOSTIC â€” open browser console F12 to read â”€â”€
      console.log('=== GLB DIAGNOSTIC ===');
      console.log('gltf.scene type:', gltf.scene.type);
      console.log('gltf.animations count:', gltf.animations.length);
      if(gltf.animations[0]) console.log('anim name:', gltf.animations[0].name, 'tracks:', gltf.animations[0].tracks.length);
      let meshCount=0, skinnedCount=0, boneCount=0;
      gltf.scene.traverse(o=>{
        if(o.isMesh) meshCount++;
        if(o.isSkinnedMesh){ skinnedCount++; if(o.skeleton) boneCount+=o.skeleton.bones.length; }
        if(o.isBone) boneCount++;
      });
      console.log('Meshes:', meshCount, 'SkinnedMeshes:', skinnedCount, 'Bones:', boneCount);
      console.log('gltf.scene.children:', gltf.scene.children.length);
      gltf.scene.children.forEach((c,i)=> console.log('  child',i,c.type,c.name));
      console.log('=== END DIAGNOSTIC ===');

      // Remove old body + mixer
      if (_weBody) { _weScene.remove(_weBody); _weBody=null; }
      if (_weMixer){ _weMixer.stopAllAction(); _weMixer=null; }
      // Remove test cube â€” body is taking over
      if (_weTestCube) { _weScene.remove(_weTestCube); _weTestCube=null; }

      const root = gltf.scene;

      // â”€â”€ Find the actual SkinnedMesh â€” mixer must target its root â”€â”€
      let skinnedMesh = null;
      let skeletonRoot = root;
      root.traverse(o => { if (o.isSkinnedMesh && !skinnedMesh) skinnedMesh = o; });
      console.log('[WE] SkinnedMesh found:', skinnedMesh ? skinnedMesh.name : 'NONE');

      // â”€â”€ Fix orientation â€” matches confirmed working v77 state â”€â”€
      // Sketchfab_model: +90Â° baked. CompanionBot.fbx: +180Â° baked.
      // Total: +270Â°. Apply -90Â° to root â†’ 270-90=180... but Three.js
      // applies parent rotation BEFORE children's baked matrices in world
      // space, so the effective result with -PI/2 on gltf.scene is upright.
      // This was confirmed working in v33(77). DO NOT change to +PI/2.
      root.position.set(0, 0, 0);
      root.rotation.set(-Math.PI / 2, 0, 0);
      root.scale.set(1, 1, 1);
      root.updateMatrixWorld(true);
      console.log('[WE] Root rotation -PI/2 applied (v77 confirmed working)');

      // â”€â”€ Material fix â”€â”€
      root.traverse(c => {
        if (c.isMesh && c.material) {
          const mats = Array.isArray(c.material) ? c.material : [c.material];
          mats.forEach(m => { m.transparent=false; m.opacity=1; m.depthWrite=true; m.needsUpdate=true; });
        }
      });

      // â”€â”€ Measure bbox AFTER rotation so Y = actual height â”€â”€
      _weScene.add(root);
      _weScene.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(root);
      const sz  = new THREE.Vector3(); box.getSize(sz);
      console.log('[WE] Rotated bbox:', sz.x.toFixed(3), sz.y.toFixed(3), sz.z.toFixed(3));

      // Scale so tallest dimension = 1.3 units (fits room height 1.5)
      const tallest = Math.max(sz.x, sz.y, sz.z);
      let sc = (isFinite(tallest) && tallest > 0.001) ? 1.3/tallest : 1.0;
      if (!isFinite(sc)||sc<=0) sc=1.0;
      root.scale.setScalar(sc);
      _weScene.updateMatrixWorld(true);

      // Place feet on floor
      const box2 = new THREE.Box3().setFromObject(root);
      const mnY  = box2.isEmpty() ? 0 : box2.min.y;
      const yOff = isFinite(mnY) ? -mnY : 0;
      root.position.y = yOff;
      console.log('[WE] Scale:', sc.toFixed(4), 'minY:', mnY.toFixed(4), 'yOffset:', yOff.toFixed(4));

      // â”€â”€ Store references â”€â”€
      _weBody        = root;
      _weBody._baseY = yOff;
      _weBodyPos     = {x:0,y:0,z:0};
      _weBodyTarget  = {x:0,z:0};
      _weBodyState   = 'idle';
      // âš  DO NOT DELETE â€” reset physics on body load
      _weBodyH    = sz.y * sc;   // actual height in scene units
      _weVelY     = 0;
      _weVelX     = 0;
      _weVelZ     = 0;
      _weOnGround = true;
      console.log('[WE] Physics init â€” bodyH:', _weBodyH.toFixed(3));
      // Reset IK foot state
      if(typeof _weFootR!=='undefined'){_weFootR={x:0,y:0,z:0,planted:false};_weFootL={x:0,y:0,z:0,planted:false};}
      // Face toward camera
      _weBodyRotY    = 0;
      _weBodyRotYTgt = 0;

      // â”€â”€ Map bones from skeleton â”€â”€
      _weMapBones(root);

      // â”€â”€ START ANIMATION MIXER â€” drives base skeleton orientation â”€â”€
      // Idle02_F provides the correct resting pose for all 72 joints.
      // Procedural system adds head look + body sway on top only.
      // DO NOT disable this â€” without it bones default to T-pose/twisted.
      if (gltf.animations && gltf.animations.length > 0) {
        _weMixer = new THREE.AnimationMixer(root);
        const clip   = gltf.animations[0];
        _weIdleClip  = _weMixer.clipAction(clip);
        _weIdleClip.setLoop(THREE.LoopRepeat, Infinity);
        _weIdleClip.clampWhenFinished = false;
        _weIdleClip.timeScale = 1.0;
        _weIdleClip.play();
        // âš  DO NOT DELETE â€” force mixer to evaluate frame 0 immediately.
        // Without this the bones stay at bind pose (feet backward) until
        // WE_loop runs its first _weMixer.update(dt) call.
        // update(0) pushes Idle02_F pose onto all 283 bone channels now.
        _weMixer.update(0);
        console.log('[WE] Mixer playing:', clip.name, 'tracks:', clip.tracks.length);
      }

      // âš  DO NOT DELETE â€” lock body to floor immediately after load.
      // Prevents feet-backward/floating on first render frame.
      // Physics tick has not run yet so we set position directly.
      root.position.x = 0;
      root.position.z = 0;
      root.position.y = yOff;
      // Force scene matrix update so renderer sees correct positions
      _weScene.updateMatrixWorld(true);

      _weStatus('âœ“ Astra Lumen â€” ' +
        (gltf.animations.length>0 ? gltf.animations[0].name+' playing' : 'no anim') +
        ' Â· bones:'+Object.keys(_weBones).length);

      // â”€â”€ Wireframe box helper â€” shows where the body is in the scene â”€â”€
      // Bright green box. If you see this but not the model, the mesh is invisible.
      // If you see neither, the body position is wrong.
      const _bHelper = new THREE.Box3Helper(
        new THREE.Box3().setFromObject(root),
        new THREE.Color(0x00ff44)
      );
      _weScene.add(_bHelper);
      // Remove after 5 seconds
      setTimeout(()=>{ _weScene.remove(_bHelper); }, 5000);

      // â”€â”€ Force camera to look directly at the body â”€â”€
      // Reset orbit so camera is definitely facing the model
      _weOrbitAz = 0;
      _weOrbitEl = 0.25;
      _weOrbitR  = 2.0;
      if (_weCamera) {
        _weCamera.position.set(0, 1.2, 2.5);
        _weCamera.lookAt(0, yOff + 0.65, 0);
      }
      console.log('[WE] Body at y:', yOff.toFixed(3), 'scale:', sc.toFixed(3));
      console.log('[WE] Camera reset to face body. If model invisible check materials.');

      // â”€â”€ Wire motor API â”€â”€
      if (typeof KATRINA_MOTOR_API !== 'undefined') {
        KATRINA_MOTOR_API.onMotorFire = (sig, lt) => {
          const legAvg = ((lt&&lt.rightLeg||0)+(lt&&lt.leftLeg||0))/2;
          if(sig==='walk'||legAvg>0.4){_weBodyState='walk';_weBodyTarget={x:(Math.random()-0.5)*1.5,z:(Math.random()-0.5)*1.5};}
          else if(sig==='run'||legAvg>0.7) _weBodyState='run';
          else if(sig==='sit')             _weBodyState='sit';
          else if(sig==='sleep')           _weBodyState='sleep';
          else                             _weBodyState='idle';
        };
      }

      // â”€â”€ Initialise instinct engine â”€â”€
      _weStartupDone = true;

      // âš  DO NOT DELETE â€” seed bobPhase so IK foot system has valid state on frame 1.
      // bobPhase=0 causes sin(0)=0 and sin(PI)=0 â€” both feet trigger plant simultaneously
      // causing zero effective movement. PI/2 gives sin=1 (right swing) and sin=-1 (left plant).
      _weInstinct.bobPhase = Math.PI / 2;

      // âš  DO NOT DELETE â€” pre-plant left foot at body centre so _weIKStep constraint
      // is valid from the first walk frame. Without this, both planted=false and
      // the constraint is skipped entirely on first frame.
      _weFootL.planted = true;
      _weFootL.x = 0; _weFootL.z = 0; _weFootL.y = yOff;

      // âš  DO NOT DELETE â€” start walk immediately, no idle delay.
      // idle_breathe + setTimeout caused permanent idle_breathe or walk_boundary loop.
      // Directly set state and pick a far target so roaming begins on first instinct tick.
      _weInstinct.state = 'idle_breathe';
      _weInstinct.subTimer = 0;
      _weInstinct.subMax = 0.1; // expire in 0.1s so instinct immediately picks next state
      _wePickNewTarget();
      // Force walk_explore after one render frame â€” body is positioned correctly by then
      requestAnimationFrame(() => {
        _wePickNewTarget();
        _weSetState('walk_explore');
      });

      // â”€â”€ Ensure WE_loop is running â”€â”€
      if (_weRenderer) _weRenderer.setAnimationLoop(WE_loop);
      console.log('[WE] Body ready â€” WE_loop active');
    },
    prog => {
      if (prog.total>0){
        const p=60+(prog.loaded/prog.total*38);
        _weProgress(p,'parsingâ€¦ '+Math.round(p)+'%');
        _weStatus('loadingâ€¦ '+Math.round(p)+'%');
      }
    },
    err => {
      _weStatus('âš  error: '+(err.message||err),'#ff6644');
      _weProgress(0,'âš  error');
      console.error('[WE] GLB error:', err);
    }
  );
}
// â”€â”€ World engine canvas resize â€” account for side panel width â”€â”€
// âš  DO NOT DELETE â€” canvas must fill we-canvas-wrap not full window.
function _weResizeCanvas() {
  if (!_weRenderer || !_weCamera) return;
  const wrap = document.getElementById('we-canvas-wrap');
  if (!wrap) return;
  const W = wrap.clientWidth  || (window.innerWidth  - 340);
  const H = wrap.clientHeight || (window.innerHeight - 44);
  _weRenderer.setSize(W, H, false);
  _weCamera.aspect = W / H;
  _weCamera.updateProjectionMatrix();
}

// â”€â”€ Chat sync â€” mirrors chat history into the world engine side panel â”€â”€
// âš  DO NOT DELETE â€” called from appendMsg (patched below) whenever a new
// message is added to the main chat. Copies the last N bubbles into
// #we-chat-history so the user can read the conversation while watching
// the 3D model. Styles match the main chat bubble colours.
function _weSyncChat() {
  const src  = document.getElementById('chat-history');
  const dest = document.getElementById('we-chat-history');
  if (!src || !dest) return;
  // Clone last 60 children
  const children = Array.from(src.children);
  const recent   = children.slice(-60);
  dest.innerHTML  = '';
  recent.forEach(el => {
    const clone = el.cloneNode(true);
    // Slightly smaller font for side panel
    clone.style.fontSize = '10px';
    dest.appendChild(clone);
  });
  dest.scrollTop = dest.scrollHeight;
}

// â”€â”€ Send chat from world engine input â”€â”€
// âš  DO NOT DELETE â€” routes input through the main processUserInput pipeline
// so the full brain loop, pre-thought, persona, and memory all fire normally.
async function _weSendChat() {
  const inp = document.getElementById('we-chat-input');
  if (!inp || !inp.value.trim()) return;
  const text = inp.value.trim();
  inp.value = '';
  // âš  DO NOT DELETE â€” try direct motor command first (user types "sit", "run", etc.)
  // Still sends to brain pipeline so Katrina responds verbally too.
  if (typeof _weUserDirectCommand === 'function') _weUserDirectCommand(text);
  // Route through main brain pipeline
  if (typeof processUserInputWithEngagement === 'function') {
    await processUserInputWithEngagement(text);
  } else if (typeof processUserInput === 'function') {
    await processUserInput(text);
  }
  // Sync display
  _weSyncChat();
}

// â”€â”€ Identity panel populate â€” shows enrolled faces and Benny status â”€â”€
function _wePopulateIdentity() {
  const dest = document.getElementById('we-identity-mirror');
  if (!dest) return;
  // Clone the id-body content (camera feed, controls, enrolled faces)
  const src = document.getElementById('id-body');
  if (src) {
    // Show a summary only â€” don't clone video element (causes issues)
    const faces = document.getElementById('id-face-list');
    const result= document.getElementById('id-result');
    dest.innerHTML =
      `<div style="font-size:8px;color:#ff69b4;letter-spacing:1px;margin-bottom:6px;">
        Use the ðŸ‘ IDENTITY window to enrol faces and scan.
      </div>` +
      `<div style="font-size:8px;color:#445;margin-bottom:4px;">ENROLLED:</div>` +
      (faces ? `<div style="font-size:8px;color:#667;">${faces.innerHTML}</div>` : '') +
      (result&&result.textContent ? `<div style="font-size:8px;color:#88cc88;margin-top:4px;">${result.textContent}</div>` : '');
    return;
  }
  dest.innerHTML = '<div style="color:#334;font-size:8px;font-style:italic;">identity panel not found</div>';
}

// â”€â”€ Patch appendMsg to sync we-chat-history whenever a message is added â”€â”€
const _origAppendMsg_we = appendMsg;
appendMsg = function(role, text, opts) {
  _origAppendMsg_we(role, text, opts);
  // Sync to world engine chat panel if it is open
  if (document.getElementById('we-overlay')?.style.display === 'flex') {
    _weSyncChat();
  }
};
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// END WORLD ENGINE
