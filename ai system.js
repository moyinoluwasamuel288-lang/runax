/* ── RUNΔX · aiSystem.js ── */

const AISystem = (() => {
  let metrics = {
    jumpsAttempted: 0,
    jumpsSuccessful: 0,
    deaths: 0,
    survivalTime: 0,
    reactionTimes: [],
    consecutiveSaves: 0,
    chaosCompletions: 0
  };

  let adj = {
    speedMul: 1,
    jumpMod: 1,
    gravMod: 1,
    timingBias: 0,
    unpredictabilityLevel: 0,
    betrayalPending: false,
    betrayalCD: 0,
    repeatCount: 0,
    lastType: null,
    history: []
  };

  let chaos = {
    phase: 0, // 0 idle, 1 warning, 2 active, 3 cooldown
    timer: 0,
    warningDuration: 2.0,
    activeDuration: 4.5,
    cooldownDuration: 8.0
  };

  function reset() {
    metrics = { jumpsAttempted:0, jumpsSuccessful:0, deaths:0, survivalTime:0, reactionTimes:[], consecutiveSaves:0, chaosCompletions:0 };
    adj = { speedMul:1, jumpMod:1, gravMod:1, timingBias:0, unpredictabilityLevel:0, betrayalPending:false, betrayalCD:0, repeatCount:0, lastType:null, history:[] };
    chaos.phase = 0;
    chaos.timer = 0;
  }

  function update(dt) {
    metrics.survivalTime += dt;
    if (adj.betrayalCD > 0) adj.betrayalCD -= dt;

    // Chaos management
    if (chaos.phase > 0) {
      chaos.timer -= dt;
      if (chaos.timer <= 0) {
        if (chaos.phase === 1) { chaos.phase = 2; chaos.timer = chaos.activeDuration; }
        else if (chaos.phase === 2) { chaos.phase = 3; chaos.timer = chaos.cooldownDuration; }
        else if (chaos.phase === 3) { chaos.phase = 0; chaos.timer = 0; }
      }
    }

    // Trigger chaos when performing well
    if (chaos.phase === 0 && metrics.survivalTime > 35 && metrics.consecutiveSaves > 4 && Math.random() < 0.025) {
      chaos.phase = 1;
      chaos.timer = chaos.warningDuration;
    }

    // Speed ramp
    let spd = 1 + (metrics.survivalTime / 50) * 0.65;
    spd = Math.min(spd, 3.2);
    adj.speedMul += (spd - adj.speedMul) * 0.006;

    adj.unpredictabilityLevel = Math.min(1, (metrics.survivalTime - 25) / 90);
  }

  function getChaosState() {
    const isWarning = chaos.phase === 1;
    const isActive = chaos.phase === 2;
    const isCooldown = chaos.phase === 3;

    let intensity = 0;
    if (isWarning) intensity = (chaos.warningDuration - chaos.timer) / chaos.warningDuration;
    if (isActive) intensity = 1;

    return {
      phase: chaos.phase,
      isWarning,
      isActive,
      isCooldown,
      intensity,
      timer: chaos.timer,
      activeDuration: chaos.activeDuration,
      jumpInverted: isActive
    };
  }

  function recordJump(ts) { metrics.jumpsAttempted++; }
  function recordSuccess() { metrics.jumpsSuccessful++; metrics.consecutiveSaves++; }
  function recordDeath() { metrics.deaths++; metrics.consecutiveSaves = 0; }

  function queryNextObstacle() {
    const cs = getChaosState();
    return {
      betrayal: false,
      fakeDecoy: cs.isActive && Math.random() < 0.4,
      lastSecTrap: Math.random() < 0.08,
      timingShift: 0
    };
  }

  function getAccuracy() {
    return metrics.jumpsAttempted === 0 ? 1 : metrics.jumpsSuccessful / metrics.jumpsAttempted;
  }

  function getMetrics() { return {...metrics}; }
  function getAdj() { return {...adj}; }
  function getSpeedMultiplier() { return adj.speedMul; }
  function getPhysicsMods() { return { jumpMod: adj.jumpMod, gravityMod: adj.gravMod }; }
  function getTaunt() {
    const taunts = ["Try again. Maybe you'll get lucky.", "The pattern was right there.", "Chaos got you this time."];
    return taunts[Math.floor(Math.random() * taunts.length)];
  }

  return {
    reset, update, recordJump, recordSuccess, recordDeath,
    queryNextObstacle, getChaosState, getAccuracy, getMetrics,
    getAdj, getSpeedMultiplier, getPhysicsMods, getTaunt
  };
})();
