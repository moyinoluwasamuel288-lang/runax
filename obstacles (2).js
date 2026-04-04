/* ── RUNΔX · obstacles.js ─────────────────────────────
   Obstacle pool, procedural generation, AI-driven patterns.

   CHAOS PATTERNS
   ──────────────
   During Chaos ACTIVE, queryNextObstacle() returns a
   chaosPattern hint. Instead of pure weighted-random we
   build deliberate sequences:

     wave     – repeating spike → double rhythm (tests timing)
     trick    – decoy then real (tests recognition)
     gauntlet – tall + double cluster (tests commitment)

   Each pattern has safe spacing so it's always survivable.
──────────────────────────────────────────────────────── */

const Obstacles = (() => {

  /* ── Types ── */
  const TYPES = {
    SPIKE:    'spike',
    TALL:     'tall',
    DOUBLE:   'double',
    LOW_HANG: 'lowHang',
    DECOY:    'decoy',    // looks dangerous, is safe
  };

  /* ── Pool ── */
  let pool       = [];
  let scrollX    = 0;
  let nextSpawnX = 0;
  let groundY    = 0;
  let canvasW    = 0;
  let canvasH    = 0;

  /* ── Pattern state ── */
  let lastType   = null;
  let pendingTrap = false;

  // Chaos sequence counter — tracks position within a structured pattern run
  // so we don't pick a new random pattern for every single obstacle.
  let chaosSeqType  = null;   // current pattern type | null
  let chaosSeqIndex = 0;      // position within the sequence
  const CHAOS_SEQ_LEN = 3;    // how many obstacles per structured sequence

  /* ─────────────────────────────────────────────────── */

  function init(gY, cW, cH) {
    pool         = [];
    scrollX      = 0;
    groundY      = gY;
    canvasW      = cW;
    canvasH      = cH;
    nextSpawnX   = cW + 200;
    lastType     = null;
    pendingTrap  = false;
    chaosSeqType  = null;
    chaosSeqIndex = 0;
  }

  function update(dt, speed) {
    const dx = speed * dt;
    scrollX += dx;

    pool.forEach(ob => { ob.screenX -= dx; });
    pool = pool.filter(ob => ob.screenX + ob.w + 40 > 0);

    while (nextSpawnX - scrollX < canvasW + 400) {
      _spawn();
    }

    if (pendingTrap) {
      _spawnTrap();
      pendingTrap = false;
    }
  }

  /* ── Spawn one obstacle ── */
  function _spawn() {
    const query = AISystem.queryNextObstacle();
    const speed = AISystem.getSpeedMultiplier();
    const unp   = AISystem.getAdj().unpredictabilityLevel;

    /* ── Choose type ── */
    let type;
    if (query.betrayal) {
      type = _pickDifferentType(lastType);
    } else if (query.fakeDecoy) {
      type = TYPES.DECOY;
    } else if (query.chaosPattern) {
      // Chaos ACTIVE — use structured sequence instead of pure random
      type = _chaosWeightedType(query.chaosPattern, unp);
    } else {
      type = _weightedType(unp);
    }

    /* ── Choose spacing ── */
    let baseSpacing = _baseSpacing(type, speed);
    // During chaos gauntlet, tighten spacing to create pressure
    if (query.chaosPattern === 'gauntlet') {
      baseSpacing *= 0.82;
    }
    baseSpacing += query.timingShift * speed * 0.001;
    baseSpacing  = Math.max(200, baseSpacing);   // hard minimum — always survivable

    /* ── Build and push ── */
    const ob = _makeObstacle(type, nextSpawnX - scrollX, query);
    AISystem.recordObstacleSpawn(type, baseSpacing);
    pool.push(ob);
    nextSpawnX += baseSpacing;
    lastType    = type;

    if (query.lastSecTrap) pendingTrap = true;
  }

  /* ── Normal weighted type selection ── */
  function _weightedType(unp) {
    const r = Math.random();
    if (r < 0.35 - unp * 0.1)   return TYPES.SPIKE;
    if (r < 0.52 - unp * 0.05)  return TYPES.DOUBLE;
    if (r < 0.66 + unp * 0.08)  return TYPES.TALL;
    if (r < 0.78 + unp * 0.10)  return TYPES.LOW_HANG;
    return TYPES.SPIKE;
  }

  /* ── Structured chaos type selection ───────────────────
     Each chaosPattern maps to a repeating obstacle sequence.
     We track position in the sequence (chaosSeqIndex) so the
     player faces a coherent challenge rather than noise.

     wave     → SPIKE · DOUBLE · SPIKE (rhythm test)
     trick    → DECOY · SPIKE · TALL   (recognition test)
     gauntlet → TALL · DOUBLE · DOUBLE (commitment test)
  ──────────────────────────────────────────────────────── */
  function _chaosWeightedType(patternHint, unp) {
    // Start a new sequence or continue the current one
    if (chaosSeqType !== patternHint || chaosSeqIndex >= CHAOS_SEQ_LEN) {
      chaosSeqType  = patternHint;
      chaosSeqIndex = 0;
    }

    const pos = chaosSeqIndex;
    chaosSeqIndex++;

    switch (patternHint) {
      case 'wave':
        // spike → double → spike
        return pos === 1 ? TYPES.DOUBLE : TYPES.SPIKE;

      case 'trick':
        // decoy → spike → tall  (player learns decoy exists, then hits real threat)
        if (pos === 0) return TYPES.DECOY;
        if (pos === 1) return TYPES.SPIKE;
        return TYPES.TALL;

      case 'gauntlet':
        // tall → double → double  (sustained pressure)
        if (pos === 0) return TYPES.TALL;
        return TYPES.DOUBLE;

      default:
        return _weightedType(unp);
    }
  }

  function _pickDifferentType(current) {
    const options = Object.values(TYPES).filter(
      t => t !== current && t !== TYPES.DECOY
    );
    return options[Math.floor(Math.random() * options.length)];
  }

  function _baseSpacing(type, speed) {
    const slow = 320 / speed;
    const mid  = 420 / speed;
    const far  = 560 / speed;
    switch (type) {
      case TYPES.DOUBLE:   return slow * 1.1;
      case TYPES.LOW_HANG: return mid  * 1.2;
      case TYPES.TALL:     return mid;
      default:             return slow + Math.random() * (far - slow);
    }
  }

  /* ── Obstacle factory ── */
  function _makeObstacle(type, screenX, query) {
    const isSafe = type === TYPES.DECOY;
    const base   = { type, screenX, safe: isSafe, visible: true, visibleTs: 0, cleared: false };

    switch (type) {
      case TYPES.SPIKE:
        return { ...base, x: screenX, y: groundY, w: 28, h: 44,
                 shape: 'spike', color: '#ff3b3b', glowColor: '#ff3b3b' };

      case TYPES.TALL:
        return { ...base, x: screenX, y: groundY - 20, w: 22, h: 64,
                 shape: 'rect', color: '#ff6b00', glowColor: '#ff6b00' };

      case TYPES.DOUBLE: {
        const ob1 = _makeObstacle(TYPES.SPIKE, screenX, query);
        ob1.twinX    = screenX + 44;
        ob1.isDouble = true;
        return ob1;
      }

      case TYPES.LOW_HANG:
        return { ...base, x: screenX, y: groundY - 90, w: 60, h: 18,
                 shape: 'hang', color: '#cc00ff', glowColor: '#cc00ff',
                 isCeiling: true };

      case TYPES.DECOY:
        // Slightly different hue so a skilled player can learn to spot it
        return { ...base, x: screenX, y: groundY, w: 28, h: 44,
                 shape: 'spike', color: '#2a7a3b', glowColor: '#00ff88',
                 safe: true };

      default:
        return { ...base, x: screenX, y: groundY, w: 28, h: 44,
                 shape: 'spike', color: '#ff3b3b', glowColor: '#ff3b3b' };
    }
  }

  /* ── Last-second trap ── */
  function _spawnTrap() {
    const playerX = Player.getPos().x;
    const trapX   = playerX + 80 + Math.random() * 40;
    pool.push({
      type: TYPES.SPIKE, shape: 'spike',
      screenX: trapX, x: trapX, y: groundY,
      w: 20, h: 36,
      color: '#ff3b3b', glowColor: '#ff3b3b',
      safe: false, visible: true, visibleTs: performance.now(),
      cleared: false, isTrap: true,
    });
  }

  /* ── Collision check ── */
  function checkCollision(playerBounds) {
    for (const ob of pool) {
      if (ob.cleared || ob.safe) continue;

      if (!ob.visibleTs && ob.screenX < canvasW + 50) {
        ob.visibleTs = performance.now();
        Player.setObstacleVisible(ob.visibleTs);
      }

      if (ob.isCeiling) {
        if (_rectOverlap(playerBounds, { x: ob.screenX, y: ob.y - ob.h, w: ob.w, h: ob.h })) return ob;
        continue;
      }

      const obBounds = { x: ob.screenX, y: ob.y - ob.h, w: ob.w, h: ob.h };
      if (_rectOverlap(playerBounds, obBounds)) return ob;

      if (ob.isDouble) {
        const ob2 = { x: ob.twinX, y: ob.y - ob.h, w: ob.w, h: ob.h };
        if (_rectOverlap(playerBounds, ob2)) return ob;
      }

      if (ob.screenX + ob.w < playerBounds.x && !ob.cleared) {
        ob.cleared = true;
        AISystem.recordSuccess();
      }
    }
    return null;
  }

  function _rectOverlap(a, b) {
    return (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    );
  }

  /* ── Draw ── */
  function draw(ctx) {
    pool.forEach(ob => _drawObstacle(ctx, ob));
  }

  function _drawObstacle(ctx, ob) {
    if (!ob.visible) return;
    ctx.save();
    ctx.shadowColor = ob.glowColor;
    ctx.shadowBlur  = 16;

    if (ob.shape === 'spike') {
      _drawSpike(ctx, ob.screenX, ob.y, ob.w, ob.h, ob.color);
      if (ob.isDouble) _drawSpike(ctx, ob.twinX, ob.y, ob.w, ob.h, ob.color);

    } else if (ob.shape === 'rect') {
      ctx.fillStyle = ob.color;
      ctx.fillRect(ob.screenX, ob.y - ob.h, ob.w, ob.h);
      ctx.shadowBlur  = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth   = 1;
      for (let yy = ob.y - ob.h; yy < ob.y; yy += 10) {
        ctx.beginPath();
        ctx.moveTo(ob.screenX, yy);
        ctx.lineTo(ob.screenX + ob.w, yy);
        ctx.stroke();
      }

    } else if (ob.shape === 'hang') {
      ctx.fillStyle = ob.color;
      ctx.fillRect(ob.screenX, ob.y - ob.h, ob.w, ob.h);
      ctx.shadowBlur = 8;
      for (let i = 0; i < 3; i++) {
        const dripX = ob.screenX + (ob.w / 4) * (i + 0.5);
        ctx.fillStyle = ob.color;
        ctx.beginPath();
        ctx.moveTo(dripX - 4, ob.y - ob.h + ob.h);
        ctx.lineTo(dripX + 4, ob.y - ob.h + ob.h);
        ctx.lineTo(dripX,     ob.y - ob.h + ob.h + 14);
        ctx.closePath();
        ctx.fill();
      }
    }

    ctx.restore();
  }

  function _drawSpike(ctx, sx, sy, w, h, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(sx,         sy);
    ctx.lineTo(sx + w,     sy);
    ctx.lineTo(sx + w / 2, sy - h);
    ctx.closePath();
    ctx.fill();

    // Inner highlight
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.moveTo(sx + w * 0.3, sy - 2);
    ctx.lineTo(sx + w * 0.5, sy - h * 0.75);
    ctx.lineTo(sx + w * 0.5, sy - 2);
    ctx.closePath();
    ctx.fill();
  }

  function getPool() { return pool; }

  // Sync ground reference on window resize
  function setGroundY(newGY) { groundY = newGY; }

  return { init, update, draw, checkCollision, getPool, setGroundY };
})();
