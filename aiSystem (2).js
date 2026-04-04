/* ── RUNΔX · aiSystem.js ──────────────────────────────
   The Frustration Engine™

   CHAOS SYSTEM OVERVIEW
   ─────────────────────
   Phase machine: IDLE → WARNING (2s) → ACTIVE (3-8s) → COOLDOWN (8s)

   Trigger (all must hold for 2 continuous seconds):
     • survivalTime ≥ 20 s
     • accuracy ≥ 75 %
     • consecutiveSaves ≥ 3

   Tier (scales with completed chaos cycles this run):
     EARLY (0 done)  – gentle road warp, mild obstacle spike
     MID   (1–2)     – faster curves, trick sequences
     LATE  (3+)      – max warp + fake paths + speed surge

   Inverted/reversed controls: FULLY REMOVED.
──────────────────────────────────────────────────────── */

const AISystem = (() => {

  /* ── Player metrics ── */
  const metrics = {
    jumpsAttempted:   0,
    jumpsSuccessful:  0,
    deaths:           0,
    totalDistance:    0,
    reactionTimes:    [],
    deathPositions:   [],
    survivalTime:     0,
    consecutiveSaves: 0,
    chaosCompletions: 0,    // full chaos cycles survived this run
  };

  /* ── Current adjustments ── */
  const adj = {
    speedMultiplier:      1.0,
    obstacleTimingBias:   0,
    jumpPhysicsMod:       1.0,
    gravityMod:           1.0,
    unpredictabilityLevel:0,
  };

  /* ── Pattern tracking ── */
  const pattern = {
    history:          [],
    repeatCount:      0,
    betrayalPending:  false,
    betrayalCooldown: 0,
  };

  /* ── Chaos state ──────────────────────────────────── */
  const CHAOS_PHASE = { IDLE: 0, WARNING: 1, ACTIVE: 2, COOLDOWN: 3 };

  const chaos = {
    phase:          CHAOS_PHASE.IDLE,
    timer:          0,
    activeDuration: 0,
    cooldownTimer:  0,
    eligibleTimer:  0,
    intensity:      0,    // smooth 0→1, consumed by road system and renderers
  };

  /* ─────────────────────────────────────────────────── */

  function reset() {
    metrics.jumpsAttempted    = 0;
    metrics.jumpsSuccessful   = 0;
    metrics.reactionTimes     = [];
    metrics.survivalTime      = 0;
    metrics.consecutiveSaves  = 0;
    metrics.chaosCompletions  = 0;
    adj.speedMultiplier       = 1.0;
    adj.obstacleTimingBias    = 0;
    adj.jumpPhysicsMod        = 1.0;
    adj.gravityMod            = 1.0;
    adj.unpredictabilityLevel = 0;
    pattern.history           = [];
    pattern.repeatCount       = 0;
    pattern.betrayalPending   = false;
    pattern.betrayalCooldown  = 0;
    chaos.phase          = CHAOS_PHASE.IDLE;
    chaos.timer          = 0;
    chaos.activeDuration = 0;
    chaos.cooldownTimer  = 0;
    chaos.eligibleTimer  = 0;
    chaos.intensity      = 0;
  }

  /* ── Frame update ── */
  function update(dt) {
    metrics.survivalTime += dt;
    if (pattern.betrayalCooldown > 0) pattern.betrayalCooldown -= dt;
    _adjustSpeed();
    _adjustPhysics();
    _updateUnpredictability();
    _updateChaos(dt);
  }

  /* ── Jump record ── */
  function recordJump(obstacleVisibleSince) {
    metrics.jumpsAttempted++;
    if (obstacleVisibleSince > 0) {
      const reaction = performance.now() - obstacleVisibleSince;
      metrics.reactionTimes.push(reaction);
      if (metrics.reactionTimes.length > 20) metrics.reactionTimes.shift();
    }
  }

  /* ── Obstacle cleared ── */
  function recordSuccess() {
    metrics.jumpsSuccessful++;
    metrics.consecutiveSaves++;
    if (metrics.consecutiveSaves > 0 && metrics.consecutiveSaves % 4 === 0) {
      _scheduleBetrayal();
    }
  }

  /* ── Death record ── */
  function recordDeath(xPos) {
    metrics.deaths++;
    metrics.deathPositions.push(xPos);
    metrics.consecutiveSaves = 0;
    metrics.totalDistance   += metrics.survivalTime * 5;
  }

  /* ── Obstacle spawn record ── */
  function recordObstacleSpawn(obstacleType, spacing) {
    pattern.history.push({ type: obstacleType, spacing });
    if (pattern.history.length > 8) pattern.history.shift();

    if (pattern.history.length >= 2) {
      const last = pattern.history[pattern.history.length - 1];
      const prev = pattern.history[pattern.history.length - 2];
      if (last.type === prev.type && Math.abs(last.spacing - prev.spacing) < 60) {
        pattern.repeatCount++;
      } else {
        pattern.repeatCount = 0;
      }
    }

    if (pattern.repeatCount >= 2 && !pattern.betrayalPending && pattern.betrayalCooldown <= 0) {
      _scheduleBetrayal();
    }
  }

  /* ── Obstacle query ── */
  function queryNextObstacle() {
    const cs = getChaosState();

    // Tier-scaled boost: late chaos is significantly more deceptive
    const tierMul    = cs.tier === 'late' ? 3.5 : cs.tier === 'mid' ? 2.5 : 1.5;
    const chaosBoost = cs.isActive ? tierMul : cs.isWarning ? 1.3 : 1.0;

    const result = {
      betrayal:     false,
      fakeDecoy:    false,
      lastSecTrap:  false,
      speedBurst:   false,
      timingShift:  0,
      // Structured challenge pattern hint for the obstacles module.
      // null = normal  'wave'|'trick'|'gauntlet' = deliberate evolving sequences.
      chaosPattern: null,
    };

    if (pattern.betrayalPending && pattern.betrayalCooldown <= 0) {
      result.betrayal          = true;
      pattern.betrayalPending  = false;
      pattern.betrayalCooldown = 6;
      pattern.repeatCount      = 0;
    }

    if (Math.random() < (0.05 + adj.unpredictabilityLevel * 0.08) * chaosBoost) {
      result.fakeDecoy = true;
    }

    if (Math.random() < (0.04 + (metrics.survivalTime / 120) * 0.06) * chaosBoost) {
      result.lastSecTrap = true;
    }

    if (metrics.consecutiveSaves > 5 && Math.random() < 0.25 * chaosBoost) {
      result.speedBurst = true;
    }

    // Assign structured pattern during ACTIVE chaos so obstacles feel intentional
    if (cs.isActive) {
      const r = Math.random();
      if (cs.tier === 'early') {
        result.chaosPattern = r < 0.6 ? 'wave' : 'trick';
      } else if (cs.tier === 'mid') {
        result.chaosPattern = r < 0.4 ? 'wave' : r < 0.75 ? 'trick' : 'gauntlet';
      } else {
        // late — gauntlet-heavy with brief trick respites
        result.chaosPattern = r < 0.25 ? 'wave' : r < 0.5 ? 'trick' : 'gauntlet';
      }
    }

    const timingRange  = cs.isActive ? (cs.tier === 'late' ? 200 : 150) : 100;
    result.timingShift = adj.obstacleTimingBias + (Math.random() * timingRange - timingRange / 2);

    return result;
  }

  /* ── Chaos tier ─────────────────────────────────────
     'early' | 'mid' | 'late' — consumed by RoadSystem
     (warp amplitude) and Obstacles (pattern selection).
  ──────────────────────────────────────────────────────── */
  function _chaosTier() {
    const c = metrics.chaosCompletions;
    if (c === 0) return 'early';
    if (c <= 2)  return 'mid';
    return 'late';
  }

  function _chaosConditionsMet() {
    if (metrics.survivalTime < 20) return false;
    if (chaos.phase !== CHAOS_PHASE.IDLE) return false;
    if (getAccuracy() < 0.75) return false;
    if (metrics.consecutiveSaves < 3) return false;
    return true;
  }

  function _updateChaos(dt) {
    switch (chaos.phase) {

      case CHAOS_PHASE.IDLE:
        if (_chaosConditionsMet()) {
          chaos.eligibleTimer += dt;
          if (chaos.eligibleTimer >= 2.0) {
            chaos.eligibleTimer = 0;
            chaos.phase         = CHAOS_PHASE.WARNING;
            chaos.timer         = 2.0;
          }
        } else {
          chaos.eligibleTimer = Math.max(0, chaos.eligibleTimer - dt * 0.5);
        }
        chaos.intensity = Math.max(0, chaos.intensity - dt * 1.5);
        break;

      case CHAOS_PHASE.WARNING:
        chaos.timer -= dt;
        // Intensity ramps 0→1 over the 2 s window — drives pre-chaos visuals
        chaos.intensity = Math.min(1, 1 - chaos.timer / 2.0);
        if (chaos.timer <= 0) {
          const tier = _chaosTier();
          const minDur = tier === 'late' ? 6 : tier === 'mid' ? 5 : 3;
          const maxDur = tier === 'late' ? 8 : tier === 'mid' ? 6 : 5;
          chaos.activeDuration = minDur + Math.random() * (maxDur - minDur);
          chaos.phase          = CHAOS_PHASE.ACTIVE;
          chaos.timer          = chaos.activeDuration;
          chaos.intensity      = 1;
        }
        break;

      case CHAOS_PHASE.ACTIVE:
        chaos.timer -= dt;
        chaos.intensity = 1;
        if (chaos.timer <= 0) {
          chaos.phase         = CHAOS_PHASE.COOLDOWN;
          chaos.cooldownTimer = 8.0;
          chaos.timer         = chaos.cooldownTimer;
          metrics.chaosCompletions++;
        }
        break;

      case CHAOS_PHASE.COOLDOWN:
        chaos.timer -= dt;
        chaos.intensity = Math.max(0, chaos.timer / chaos.cooldownTimer);
        if (chaos.timer <= 0) {
          chaos.phase         = CHAOS_PHASE.IDLE;
          chaos.eligibleTimer = 0;
          chaos.intensity     = 0;
        }
        break;
    }
  }

  function getChaosState() {
    return {
      phase:          chaos.phase,
      isWarning:      chaos.phase === CHAOS_PHASE.WARNING,
      isActive:       chaos.phase === CHAOS_PHASE.ACTIVE,
      isCooldown:     chaos.phase === CHAOS_PHASE.COOLDOWN,
      intensity:      chaos.intensity,
      timer:          chaos.timer,
      activeDuration: chaos.activeDuration,
      tier:           _chaosTier(),
      completions:    metrics.chaosCompletions,
      PHASE:          CHAOS_PHASE,
    };
  }

  /* ── Physics / speed getters ── */
  function getPhysicsMods() {
    return { jumpMod: adj.jumpPhysicsMod, gravityMod: adj.gravityMod };
  }
  function getSpeedMultiplier()  { return adj.speedMultiplier; }
  function getAccuracy() {
    if (metrics.jumpsAttempted === 0) return 1;
    return metrics.jumpsSuccessful / metrics.jumpsAttempted;
  }
  function getAvgReaction() {
    if (metrics.reactionTimes.length === 0) return 400;
    return metrics.reactionTimes.reduce((a, b) => a + b, 0) / metrics.reactionTimes.length;
  }
  function getMetrics() { return { ...metrics }; }
  function getAdj()     { return { ...adj }; }

  /* ── Internal adjusters ── */
  function _adjustSpeed() {
    const t   = metrics.survivalTime;
    const acc = getAccuracy();
    let target = 1.0 + (t / 60) * 0.5 + (t / 120) * 0.3;
    target = Math.min(target, 2.8);
    if (acc > 0.85 && metrics.jumpsSuccessful > 6) target += 0.15;
    if (acc < 0.55 && metrics.jumpsAttempted > 4) {
      target *= 0.92;
      adj.obstacleTimingBias = 60;
    } else {
      adj.obstacleTimingBias = 0;
    }
    adj.speedMultiplier += (target - adj.speedMultiplier) * 0.005;
  }

  function _adjustPhysics() {
    const t     = metrics.survivalTime;
    const drift = Math.sin(t * 0.3) * 0.07 + Math.cos(t * 0.17) * 0.04;
    adj.jumpPhysicsMod = 1.0 + drift;
    adj.gravityMod     = 1.0 - drift * 0.5;
    if (t > 45) {
      const extra = (t - 45) / 150;
      adj.jumpPhysicsMod += (Math.random() - 0.5) * extra * 0.12;
      adj.gravityMod     += (Math.random() - 0.5) * extra * 0.08;
    }
    adj.jumpPhysicsMod = Math.max(0.88, Math.min(1.14, adj.jumpPhysicsMod));
    adj.gravityMod     = Math.max(0.88, Math.min(1.12, adj.gravityMod));
  }

  function _updateUnpredictability() {
    adj.unpredictabilityLevel = Math.min(1, Math.max(0, (metrics.survivalTime - 30) / 80));
  }

  function _scheduleBetrayal() { pattern.betrayalPending = true; }

  /* ── Taunt lines ── */
  const taunts = [
    "Try again. Maybe you'll get lucky.",
    "The pattern was right there.",
    "Almost. Not quite.",
    "Did you blink?",
    "Your reflexes are… disappointing.",
    "That was preventable.",
    "We adjusted. You didn't.",
    "You were so close it hurts us.",
    "The game isn't cheating. Promise.",
    "Your brain is slower than we expected.",
    "You felt that pattern? We deleted it.",
    "Statistically, you should give up.",
    "One more try. That's what they all say.",
    "We've memorized your mistakes.",
    "You hesitated.",
    "The road moved. You didn't notice.",
    "Chaos warned you. You ignored it.",
  ];

  function getTaunt() {
    return taunts[Math.floor(Math.random() * taunts.length)];
  }

  return {
    reset, update,
    recordJump, recordSuccess, recordDeath,
    recordObstacleSpawn, queryNextObstacle,
    getPhysicsMods, getSpeedMultiplier,
    getAccuracy, getAvgReaction, getMetrics, getAdj,
    getTaunt, getChaosState,
  };
})();
