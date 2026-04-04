/* ── RUNΔX · obstacles.js ─────────────────────────────
   Obstacle pool, procedural generation, AI-driven patterns
──────────────────────────────────────────────────────── */

const Obstacles = (() => {

  /* ── Obstacle types ── */
  const TYPES = {
    SPIKE:    'spike',
    TALL:     'tall',
    DOUBLE:   'double',
    LOW_HANG: 'lowHang',
    GAP:      'gap',       // visual gap marker (fake gap — actually safe)
    DECOY:    'decoy',     // looks dangerous, is safe
  };

  /* ── Pool ── */
  let pool         = [];
  let scrollX      = 0;   // how far world has scrolled (px)
  let nextSpawnX   = 0;   // world-X where next obstacle spawns
  let groundY      = 0;
  let canvasW      = 0;
  let canvasH      = 0;

  /* ── Pattern state ── */
  let lastType     = null;
  let repeatsSinceVariety = 0;

  /* ── Last-second trap ── */
  let pendingTrap  = false;

  /* ─────────────────────────────────────────────────── */

  function init(gY, cW, cH) {
    pool        = [];
    scrollX     = 0;
    groundY     = gY;
    canvasW     = cW;
    canvasH     = cH;
    nextSpawnX  = cW + 200;  // first obstacle off-screen
    lastType    = null;
    repeatsSinceVariety = 0;
    pendingTrap = false;
  }

  function update(dt, speed) {
    const dx = speed * dt;
    scrollX += dx;

    // Move existing obstacles
    pool.forEach(ob => { ob.screenX -= dx; });

    // Remove off-screen obstacles
    pool = pool.filter(ob => ob.screenX + ob.w + 40 > 0);

    // Spawn new obstacles when needed
    while (nextSpawnX - scrollX < canvasW + 400) {
      _spawn();
    }

    // Check if player is past last-second trap window
    if (pendingTrap) {
      _spawnTrap();
      pendingTrap = false;
    }
  }

  function _spawn() {
    const query    = AISystem.queryNextObstacle();
    const speed    = AISystem.getSpeedMultiplier();
    const unp      = AISystem.getAdj().unpredictabilityLevel;

    /* ── Choose type ── */
    let type;
    if (query.betrayal) {
      // Break the current pattern intentionally
      type = _pickDifferentType(lastType);
    } else if (query.fakeDecoy) {
      type = TYPES.DECOY;
    } else {
      // Normal weighted random, biased toward current pattern for 2–3 cycles
      type = _weightedType(unp);
    }

    /* ── Choose spacing ── */
    let baseSpacing = _baseSpacing(type, speed);

    // Timing bias from AI
    baseSpacing += query.timingShift * speed * 0.001;
    baseSpacing  = Math.max(180, baseSpacing);

    /* ── Build obstacle object ── */
    const ob = _makeObstacle(type, nextSpawnX - scrollX, query);

    AISystem.recordObstacleSpawn(type, baseSpacing);

    pool.push(ob);
    nextSpawnX += baseSpacing;

    lastType = type;

    // Schedule last-second trap
    if (query.lastSecTrap) pendingTrap = true;
  }

  function _makeObstacle(type, screenX, query) {
    const isSafe = type === TYPES.DECOY;
    const base = { type, screenX, safe: isSafe, visible: true, visibleTs: 0, cleared: false };

    switch (type) {
      case TYPES.SPIKE:
        return {
          ...base,
          x: screenX, y: groundY, w: 28, h: 44,
          shape: 'spike', color: '#ff3b3b', glowColor: '#ff3b3b',
        };
      case TYPES.TALL:
        return {
          ...base,
          x: screenX, y: groundY - 20, w: 22, h: 64,
          shape: 'rect', color: '#ff6b00', glowColor: '#ff6b00',
        };
      case TYPES.DOUBLE: {
        // Two spikes close together
        const ob1 = _makeObstacle(TYPES.SPIKE, screenX, query);
        ob1.twinX = screenX + 44;
        ob1.isDouble = true;
        return ob1;
      }
      case TYPES.LOW_HANG:
        // Overhead obstacle — player must NOT jump
        return {
          ...base,
          x: screenX, y: groundY - 90,
          w: 60, h: 18,
          shape: 'hang', color: '#cc00ff', glowColor: '#cc00ff',
          isCeiling: true,
        };
      case TYPES.DECOY:
        // Looks like a spike but is safe — slightly different color
        return {
          ...base,
          x: screenX, y: groundY, w: 28, h: 44,
          shape: 'spike', color: '#2a7a3b', glowColor: '#00ff88',
          safe: true,
        };
      case TYPES.GAP:
      default:
        return {
          ...base,
          x: screenX, y: groundY, w: 28, h: 44,
          shape: 'spike', color: '#ff3b3b', glowColor: '#ff3b3b',
        };
    }
  }

  function _spawnTrap() {
    // Spawn a small spike just in front of the player's landing zone
    const playerX = Player.getPos().x;
    const trapX   = playerX + 80 + Math.random() * 40;
    const ob = {
      type: TYPES.SPIKE, shape: 'spike',
      screenX: trapX, x: trapX, y: groundY,
      w: 20, h: 36,
      color: '#ff3b3b', glowColor: '#ff3b3b',
      safe: false, visible: true, visibleTs: performance.now(),
      cleared: false, isTrap: true,
    };
    pool.push(ob);
  }

  function _weightedType(unpredictability) {
    const r = Math.random();
    const u = unpredictability;

    // As unpredictability rises, more variety / nastier obstacles
    if (r < 0.35 - u * 0.1)                    return TYPES.SPIKE;
    if (r < 0.52 - u * 0.05)                   return TYPES.DOUBLE;
    if (r < 0.66 + u * 0.08)                   return TYPES.TALL;
    if (r < 0.78 + u * 0.10)                   return TYPES.LOW_HANG;
    return TYPES.SPIKE;
  }

  function _pickDifferentType(current) {
    const options = Object.values(TYPES).filter(t => t !== current && t !== TYPES.DECOY && t !== TYPES.GAP);
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

  /* ── Collision check ── */
  function checkCollision(playerBounds) {
    for (const ob of pool) {
      if (ob.cleared || ob.safe) continue;

      // Mark as visible for reaction timing
      if (!ob.visibleTs && ob.screenX < canvasW + 50) {
        ob.visibleTs = performance.now();
        Player.setObstacleVisible(ob.visibleTs);
      }

      if (ob.isCeiling) {
        // Low hang: collide if player is jumping through it
        if (_rectOverlap(playerBounds, {
          x: ob.screenX, y: ob.y - ob.h,
          w: ob.w, h: ob.h,
        })) return ob;
        continue;
      }

      // Standard ground obstacle
      const obBounds = { x: ob.screenX, y: ob.y - ob.h, w: ob.w, h: ob.h };
      if (_rectOverlap(playerBounds, obBounds)) return ob;

      // Double obstacle
      if (ob.isDouble) {
        const ob2 = { x: ob.twinX, y: ob.y - ob.h, w: ob.w, h: ob.h };
        if (_rectOverlap(playerBounds, ob2)) return ob;
      }

      // Mark cleared once past player
      if (ob.screenX + ob.w < playerBounds.x) {
        if (!ob.cleared) {
          ob.cleared = true;
          AISystem.recordSuccess();
        }
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
      if (ob.isDouble) {
        _drawSpike(ctx, ob.twinX, ob.y, ob.w, ob.h, ob.color);
      }
    } else if (ob.shape === 'rect') {
      ctx.fillStyle = ob.color;
      ctx.fillRect(ob.screenX, ob.y - ob.h, ob.w, ob.h);
      // Warning stripe on tall
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth   = 1;
      for (let yy = ob.y - ob.h; yy < ob.y; yy += 10) {
        ctx.beginPath();
        ctx.moveTo(ob.screenX, yy);
        ctx.lineTo(ob.screenX + ob.w, yy);
        ctx.stroke();
      }
    } else if (ob.shape === 'hang') {
      // Ceiling obstacle
      ctx.fillStyle = ob.color;
      ctx.fillRect(ob.screenX, ob.y - ob.h, ob.w, ob.h);
      // Drip effect
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

  // Keep the floor reference in sync with the canvas on resize.
  function setGroundY(newGY) { groundY = newGY; }

  return { init, update, draw, checkCollision, getPool, setGroundY };
})();
