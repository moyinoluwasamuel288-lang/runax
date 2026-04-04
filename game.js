/* ── RUNΔX · game.js ──────────────────────────────────
   Main orchestrator: state machine, world draw, HUD,
   Road System, Chaos visuals, input.

   ROAD SYSTEM
   ───────────
   During normal play the road is flat and straight.
   As chaos intensity rises, the road:
     • Drifts vertically (gentle wave, ±40 px max)
     • Bends left/right (perspective lane-lines fan out)
     • Narrows (lane width shrinks to 60% at peak chaos)

   These are purely visual — groundY (physics floor) never
   moves. The road illusion is created by drawing converging
   lane lines and a filled road band around groundY.

   CHAOS VISUALS (WARNING phase)
   ─────────────────────────────
   • Background darkens toward black via _drawBackground
   • Amber vignette border pulses on screen edges
   • Subtle scanline flutter increases
   • "⚠ CHAOS INCOMING" badge counts down

   CHAOS VISUALS (ACTIVE phase)
   ─────────────────────────────
   • Deep red border, glitch scan-tear lines
   • Chromatic aberration (RGB channel split)
   • Road bends and narrows at full amplitude
   • "◈ CHAOS ACTIVE" badge with countdown bar
──────────────────────────────────────────────────────── */

(function () {

  /* ── State machine ── */
  const STATE = { MENU: 0, PLAYING: 1, DEAD: 2, PAUSED: 3 };
  let state = STATE.MENU;

  /* ── Score / high-score ── */
  let highScore = parseInt(localStorage.getItem('runax_best') || '0', 10);
  let score    = 0;
  let bestScore = highScore;

  /* ── World ── */
  const BG_LAYERS = [
    { speed: 0.05, elements: [] },
    { speed: 0.15, elements: [] },
    { speed: 0.35, elements: [] },
  ];
  let worldScrollX = 0;
  let groundY      = 0;

  /* ── DOM refs ── */
  const elScore     = document.getElementById('score-value');
  const elBest      = document.getElementById('best-value');
  const elDeadScore = document.getElementById('dead-score');
  const elDeadBest  = document.getElementById('dead-best');
  const elDeadJumps = document.getElementById('dead-jumps');
  const elDeadAcc   = document.getElementById('dead-acc');
  const elTaunt     = document.getElementById('taunt-line');

  /* ── Chaos visual state ── */
  let prevChaosPhase = -1;
  let glitchLines    = [];

  /* ── CSS body class for HUD colour transitions ── */
  function _setChaosClass(cs) {
    document.body.classList.remove('chaos-warning', 'chaos-active', 'chaos-cooldown');
    if (cs.isWarning)  document.body.classList.add('chaos-warning');
    if (cs.isActive)   document.body.classList.add('chaos-active');
    if (cs.isCooldown) document.body.classList.add('chaos-cooldown');
  }

  /* ══════════════════════════════════════════════════
     ROAD SYSTEM
     ══════════════════════════════════════════════════
     Tracks smoothly animated road state variables and
     draws a perspective-bent road around groundY.

     All variables use lerp toward a slowly moving
     target so transitions are always fluid.

     Physics (groundY) is NEVER modified — purely visual.
  ══════════════════════════════════════════════════ */
  const RoadSystem = (() => {

    /* ── Road visual state ── */
    let vertOffset    = 0;     // current visual Y drift (pixels, relative to groundY)
    let vertTarget    = 0;     // lerp target for vertical drift
    let bendAngle     = 0;     // 0 = straight, +/- = right/left visual lean
    let bendTarget    = 0;     // lerp target for bend
    let narrowFactor  = 1.0;   // 1 = full width, 0.5 = half width at peak
    let narrowTarget  = 1.0;

    /* ── Phase oscillator ── */
    let phaseV = 0;   // drives vertical oscillation
    let phaseH = 0;   // drives horizontal bend oscillation
    let time   = 0;   // accumulated seconds

    function reset() {
      vertOffset   = 0; vertTarget   = 0;
      bendAngle    = 0; bendTarget   = 0;
      narrowFactor = 1; narrowTarget = 1;
      phaseV = 0; phaseH = 0; time = 0;
    }

    /* update(dt, cs) — call every gameplay frame */
    function update(dt, cs) {
      time += dt;

      /* -- Amplitude scales with chaos intensity and tier -- */
      const amp = cs.intensity;
      const tierMul = cs.tier === 'late' ? 1.0 : cs.tier === 'mid' ? 0.65 : 0.35;

      // During WARNING the warp ramps up gently (intensity goes 0→1 over 2s)
      const warpScale = amp * tierMul;

      // Oscillator frequencies: slow during WARNING, faster in ACTIVE
      const vFreq = cs.isActive ? (cs.tier === 'late' ? 0.55 : 0.4) : 0.25;
      const hFreq = cs.isActive ? (cs.tier === 'late' ? 0.35 : 0.25) : 0.15;

      phaseV += dt * vFreq * Math.PI * 2;
      phaseH += dt * hFreq * Math.PI * 2;

      /* Targets — sinusoidal, amplitude gated by warpScale */
      const maxVert   = 38 * warpScale;   // max ±38px vertical drift
      const maxBend   = 0.06 * warpScale; // max ±0.06 rad visible lean
      const minNarrow = 1.0 - 0.45 * warpScale; // min 55% width at peak chaos

      vertTarget   = Math.sin(phaseV) * maxVert;
      bendTarget   = Math.sin(phaseH) * maxBend;
      narrowTarget = minNarrow + (1.0 - minNarrow) * (0.5 + 0.5 * Math.cos(phaseV * 0.7));

      // During IDLE/COOLDOWN (warpScale → 0) targets naturally fall back to 0/1
      if (warpScale < 0.01) {
        vertTarget   = 0;
        bendTarget   = 0;
        narrowTarget = 1.0;
      }

      /* Smooth lerp — different rates so they feel independent */
      const lerpRate = 2.8; // units per second
      vertOffset   += (vertTarget   - vertOffset)   * Math.min(1, dt * lerpRate);
      bendAngle    += (bendTarget   - bendAngle)    * Math.min(1, dt * lerpRate * 0.7);
      narrowFactor += (narrowTarget - narrowFactor) * Math.min(1, dt * lerpRate * 1.2);
    }

    /* draw(ctx, W, H, groundY, cs) */
    function draw(ctx, W, H, gY, cs) {
      if (cs.intensity < 0.02) {
        // Normal road — draw standard flat ground line (handled by _drawGround)
        return;
      }

      // Visual road centre Y — drifts around groundY
      const roadCY = gY + vertOffset;

      // Road band height (visual only)
      const bandH  = 16 + narrowFactor * 8;

      // ── Road surface fill ──
      const roadAlpha = Math.min(0.85, cs.intensity * 0.9);
      ctx.save();
      ctx.globalAlpha = roadAlpha;

      // Fill the road band
      const rGrad = ctx.createLinearGradient(0, roadCY - bandH, 0, roadCY + 6);
      const roadCol = cs.isActive ? 'rgba(60,0,0,' : 'rgba(40,20,0,';
      rGrad.addColorStop(0, roadCol + '0)');
      rGrad.addColorStop(0.5, roadCol + '0.5)');
      rGrad.addColorStop(1, roadCol + '0)');
      ctx.fillStyle = rGrad;
      ctx.fillRect(0, roadCY - bandH, W, bandH + 6);

      // ── Perspective lane lines ──
      // Lines converge toward a vanishing point that shifts with bendAngle,
      // giving the illusion of a curving road without moving groundY.
      const vpX = W / 2 + bendAngle * W * 3;   // vanishing point X
      const vpY = roadCY - H * 0.35;            // vanishing point Y (above road)
      const laneHalfW = (W * 0.48) * narrowFactor;

      // Left and right lane edges at screen bottom
      const edgeY  = roadCY + 2;
      const laneL1 = W / 2 - laneHalfW;
      const laneR1 = W / 2 + laneHalfW;
      // Mid-road (dashed centre line endpoints)
      const midY   = roadCY - bandH * 0.5;
      const laneLC = W / 2 - laneHalfW * 0.05;
      const laneRC = W / 2 + laneHalfW * 0.05;

      ctx.globalAlpha = Math.min(0.7, cs.intensity * 0.75);
      const lineColor = cs.isActive ? '#550000' : '#552200';

      // Left edge
      ctx.strokeStyle = lineColor;
      ctx.lineWidth   = 1.5;
      ctx.shadowColor = cs.isActive ? '#ff2200' : '#ff8800';
      ctx.shadowBlur  = 6;
      ctx.beginPath();
      ctx.moveTo(laneL1, edgeY);
      ctx.lineTo(vpX, vpY);
      ctx.stroke();

      // Right edge
      ctx.beginPath();
      ctx.moveTo(laneR1, edgeY);
      ctx.lineTo(vpX, vpY);
      ctx.stroke();

      // Animated dashed centre line
      ctx.shadowBlur  = 3;
      ctx.strokeStyle = cs.isActive ? '#880000' : '#663300';
      ctx.lineWidth   = 1;
      const dashOff = (worldScrollX * 0.9) % 50;
      ctx.setLineDash([20, 30]);
      ctx.lineDashOffset = -dashOff;
      ctx.beginPath();
      ctx.moveTo(laneLC, edgeY);
      ctx.lineTo(vpX, vpY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(laneRC, edgeY);
      ctx.lineTo(vpX, vpY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;

      ctx.globalAlpha = 1;
      ctx.restore();
    }

    /* Public getters used by game.js for subtle ground-line colour shift */
    function getBend()    { return bendAngle; }
    function getVertOff() { return vertOffset; }

    return { reset, update, draw, getBend, getVertOff };
  })();

  /* ══════════════════════════════════════════════════
     INIT
  ══════════════════════════════════════════════════ */

  function init() {
    const { W, H } = Engine.getSize();
    groundY = H * 0.72;
    _generateBgElements(W, H);
    Player.init(H);
    Obstacles.init(groundY, W, H);
    AISystem.reset();
    RoadSystem.reset();
    score = 0; worldScrollX = 0;
    _updateHUD();
    Engine.showScreen('screen-start');
    document.getElementById('best-value').textContent = bestScore;
  }

  function startGame() {
    const { W, H } = Engine.getSize();
    Engine.initAudio();
    groundY = H * 0.72;
    _generateBgElements(W, H);
    Player.init(H);
    Obstacles.init(groundY, W, H);
    AISystem.reset();
    RoadSystem.reset();
    score = 0; worldScrollX = 0;
    prevChaosPhase = -1;
    glitchLines    = [];
    state = STATE.PLAYING;
    Engine.showScreen(null);
    Engine.start(update, draw);
  }

  function gameOver() {
    state = STATE.DEAD;
    if (score > bestScore) {
      bestScore = score;
      localStorage.setItem('runax_best', String(bestScore));
    }
    const m   = AISystem.getMetrics();
    const acc = Math.round(AISystem.getAccuracy() * 100);
    elDeadScore.textContent = String(score);
    elDeadBest.textContent  = String(bestScore);
    elDeadJumps.textContent = String(m.jumpsAttempted);
    elDeadAcc.textContent   = acc + '%';
    elTaunt.textContent     = AISystem.getTaunt();

    // Chaos completions row
    const chaosRow = document.getElementById('chaos-row');
    const chaosVal = document.getElementById('dead-chaos');
    if (chaosRow && m.chaosCompletions > 0) {
      chaosVal.textContent   = String(m.chaosCompletions);
      chaosRow.style.display = 'flex';
    } else if (chaosRow) {
      chaosRow.style.display = 'none';
    }

    elBest.textContent = String(bestScore);
    _setChaosClass({ isWarning: false, isActive: false, isCooldown: false });

    setTimeout(() => {
      if (state === STATE.DEAD) Engine.showScreen('screen-dead');
    }, 600);
  }

  function restartGame() { Engine.stop(); startGame(); }

  function togglePause() {
    if (state === STATE.PLAYING) {
      state = STATE.PAUSED;
      Engine.setPaused(true);
      Engine.showScreen('screen-pause');
    } else if (state === STATE.PAUSED) {
      state = STATE.PLAYING;
      Engine.setPaused(false);
      Engine.showScreen(null);
    }
  }

  /* ══════════════════════════════════════════════════
     UPDATE
  ══════════════════════════════════════════════════ */

  function update(dt) {
    if (state !== STATE.PLAYING) return;

    const speed = 280 * AISystem.getSpeedMultiplier();
    worldScrollX += speed * dt;

    AISystem.update(dt);
    Player.update(dt);
    Obstacles.update(dt, speed);

    /* ── Chaos phase wiring ── */
    const cs = AISystem.getChaosState();

    // One-shot stings on phase transitions
    if (cs.phase !== prevChaosPhase) {
      if (cs.isWarning) {
        Engine.playChaosWarningSting();
        Engine.shake(1.5, 99999);  // very light tremor starts immediately
      }
      if (cs.isActive) {
        Engine.playChaosActiveSting();
        Engine.flash('#3b1a1a', 0.4);
      }
      if (cs.isCooldown) {
        Engine.playChaosEndSting();
        Engine.flash('#1a3b1a', 0.3);
      }
      prevChaosPhase = cs.phase;
    }

    // Continuous audio rumble + escalating visual shake during chaos
    if (cs.isWarning || cs.isActive) {
      Engine.tickChaosRumble(dt, cs.intensity);
      const shakeMag = cs.isActive ? 3.5 : 1.2 * cs.intensity;
      Engine.shake(shakeMag, 80);
    }

    // Road system update — purely visual, no physics impact
    RoadSystem.update(dt, cs);

    // Glitch lines for renderer
    if (cs.isWarning || cs.isActive) {
      _updateGlitchLines(dt, cs.intensity);
    } else {
      glitchLines = [];
    }

    // Sync CSS HUD class
    _setChaosClass(cs);

    // Score
    score = Math.floor(worldScrollX / 40);
    _updateHUD();

    // Collision
    if (Player.isAlive()) {
      const hit = Obstacles.checkCollision(Player.getBounds());
      if (hit) {
        Player.die();
        setTimeout(gameOver, 300);
      }
    }
  }

  /* ── Glitch lines pool ── */
  function _updateGlitchLines(dt, intensity) {
    const spawnCount = Math.floor(intensity * 3);
    for (let i = 0; i < spawnCount; i++) {
      if (Math.random() < 0.25 * intensity) {
        const { H: canH, W: canW } = Engine.getSize();
        glitchLines.push({
          y:     Math.random() * canH,
          w:     30 + Math.random() * canW * 0.4,
          dx:    (Math.random() - 0.5) * 60 * intensity,
          alpha: 0.3 + Math.random() * 0.4 * intensity,
          life:  0.05 + Math.random() * 0.12,
        });
      }
    }
    glitchLines = glitchLines
      .map(l => ({ ...l, life: l.life - dt, alpha: l.alpha - dt * 2 }))
      .filter(l => l.life > 0 && l.alpha > 0);
    if (glitchLines.length > 18) glitchLines.splice(0, glitchLines.length - 18);
  }

  /* ══════════════════════════════════════════════════
     DRAW
  ══════════════════════════════════════════════════ */

  function draw(ctx, W, H) {
    const cs = AISystem.getChaosState();

    // Background (darkens with chaos intensity)
    _drawBackground(ctx, W, H, cs);

    // Parallax city
    _drawParallax(ctx, W, H);

    // Road system (perspective bend + vertical drift, visual only)
    RoadSystem.draw(ctx, W, H, groundY, cs);

    // Static ground line
    _drawGround(ctx, W, H, cs);

    // CRT scanlines
    _drawScanlines(ctx, W, H);

    // Game objects
    Obstacles.draw(ctx);
    Player.draw(ctx);

    // Normal vignette
    _drawVignette(ctx, W, H);

    // Chaos visual layers (drawn over everything)
    if (cs.intensity > 0) {
      _drawChaosVignette(ctx, W, H, cs);
      _drawChaosGlitch(ctx, W, H, cs);
      _drawChaosChromaticAberration(ctx, W, H, cs);
    }

    // AI intensity bar
    _drawIntensityMeter(ctx, W, H);

    // Combo multiplier HUD (bottom-left, only when active)
    _drawComboHUD(ctx, W, H);

    // Chaos HUD badge (always last — on top of everything)
    if (cs.intensity > 0.05) _drawChaosBadge(ctx, W, H, cs);
  }

  /* ── Background — darkens toward black as chaos rises ── */
  function _drawBackground(ctx, W, H, cs) {
    const darken = cs.intensity * 0.85;
    const c0 = _lerpHex('#040609', '#000000', darken);
    const c1 = _lerpHex('#080c10', '#010103', darken);
    const c2 = _lerpHex('#0a0e14', '#020205', darken);
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0,   c0);
    grad.addColorStop(0.5, c1);
    grad.addColorStop(1,   c2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  function _lerpHex(hexA, hexB, t) {
    const a = _hexToRgb(hexA), b = _hexToRgb(hexB);
    return `rgb(${Math.round(a.r+(b.r-a.r)*t)},${Math.round(a.g+(b.g-a.g)*t)},${Math.round(a.b+(b.b-a.b)*t)})`;
  }
  function _hexToRgb(hex) {
    const n = parseInt(hex.replace('#',''), 16);
    return { r: (n>>16)&255, g: (n>>8)&255, b: n&255 };
  }

  /* ── Parallax city ── */
  function _generateBgElements(W, H) {
    BG_LAYERS.forEach((layer, li) => {
      layer.elements = [];
      const count = li === 0 ? 6 : li === 1 ? 10 : 16;
      for (let i = 0; i < count; i++) {
        layer.elements.push(_makeBgEl(li, (W / count) * i, W, H));
      }
    });
  }
  function _makeBgEl(layerIdx, x, W, H) {
    const h = layerIdx === 0 ? 30 + Math.random()*80
            : layerIdx === 1 ? 20 + Math.random()*50
            :                   5 + Math.random()*25;
    return {
      x, h,
      w:     4 + Math.random() * (layerIdx === 0 ? 30 : 12),
      y:     H * 0.72 - h,
      alpha: 0.04 + layerIdx * 0.03 + Math.random() * 0.04,
    };
  }
  function _drawParallax(ctx, W, H) {
    BG_LAYERS.forEach((layer, li) => {
      ctx.save();
      const dx = (worldScrollX * layer.speed) % W;
      layer.elements.forEach(el => {
        const ex = ((el.x - dx) % W + W) % W;
        ctx.globalAlpha = el.alpha;
        ctx.fillStyle   = li === 0 ? '#1a2030' : li === 1 ? '#111820' : '#0d1218';
        ctx.fillRect(ex, el.y, el.w, el.h);
        if (li === 0 && el.h > 50) {
          ctx.fillStyle   = 'rgba(255,200,80,0.35)';
          ctx.globalAlpha = el.alpha * 2;
          for (let wy = el.y+6; wy < el.y+el.h-6; wy += 10)
            for (let wx = ex+3; wx < ex+el.w-3; wx += 6)
              if (Math.random() < 0.4) ctx.fillRect(wx, wy, 3, 4);
        }
      });
      ctx.restore();
    });
  }

  /* ── Ground line ── */
  function _drawGround(ctx, W, H, cs) {
    const gY = groundY;

    // Fill below ground
    const grad = ctx.createLinearGradient(0, gY, 0, H);
    grad.addColorStop(0,   '#0f1520');
    grad.addColorStop(0.4, '#080c12');
    grad.addColorStop(1,   '#040608');
    ctx.fillStyle = grad;
    ctx.fillRect(0, gY, W, H - gY);

    // Glowing ground line — colour shifts amber/red during chaos
    const lineColor = cs && cs.isActive  ? '#ff8800'
                    : cs && cs.isWarning ? '#cc6600'
                    :                     '#ff3b3b';
    ctx.shadowColor = lineColor;
    ctx.shadowBlur  = 8;
    ctx.strokeStyle = lineColor;
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, gY); ctx.lineTo(W, gY);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Animated speed dashes
    const speed  = AISystem.getSpeedMultiplier();
    const dashW  = 24;
    const gap    = 60 / speed;
    const offset = (worldScrollX * 0.8) % (dashW + gap);
    ctx.strokeStyle    = cs && cs.isActive ? 'rgba(255,136,0,0.3)' : 'rgba(255,59,59,0.25)';
    ctx.lineWidth      = 1;
    ctx.setLineDash([dashW, gap]);
    ctx.lineDashOffset = -offset;
    ctx.beginPath();
    ctx.moveTo(0, gY + 6); ctx.lineTo(W, gY + 6);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /* ── CRT scanlines ── */
  function _drawScanlines(ctx, W, H) {
    ctx.globalAlpha = 0.025;
    ctx.fillStyle   = '#000';
    for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 2);
    ctx.globalAlpha = 1;
  }

  /* ── Normal vignette ── */
  function _drawVignette(ctx, W, H) {
    const grad = ctx.createRadialGradient(W/2, H/2, H*0.25, W/2, H/2, H);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  /* ── Chaos vignette (amber warning → deep red active) ── */
  function _drawChaosVignette(ctx, W, H, cs) {
    const r = cs.isActive ? 80 : 50;
    const g = cs.isActive ? 0  : 10;
    const outerAlpha = cs.intensity * 0.7;
    const grad = ctx.createRadialGradient(W/2, H/2, H*0.15, W/2, H/2, H*0.85);
    grad.addColorStop(0,   'rgba(0,0,0,0)');
    grad.addColorStop(0.6, 'rgba(0,0,0,0)');
    grad.addColorStop(1,   `rgba(${r},${g},0,${outerAlpha})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    const pulse      = Math.sin(Date.now() / 200) * 0.15 + 0.15;
    const frameAlpha = cs.intensity * (0.25 + (cs.isActive ? pulse : 0));
    ctx.strokeStyle  = cs.isActive
      ? `rgba(180,0,0,${frameAlpha})`
      : `rgba(120,60,0,${frameAlpha * 0.7})`;
    ctx.lineWidth    = 8 + cs.intensity * 12;
    ctx.strokeRect(0, 0, W, H);
  }

  /* ── Chaos glitch scan-tears ── */
  function _drawChaosGlitch(ctx, W, H, cs) {
    if (glitchLines.length === 0) return;
    ctx.save();
    glitchLines.forEach(l => {
      ctx.globalAlpha = Math.max(0, l.alpha) * cs.intensity;
      const lineH = 2 + Math.random() * 4;
      try {
        const imgData = ctx.getImageData(0, l.y, W, lineH);
        ctx.putImageData(imgData, l.dx, l.y);
      } catch (e) { /* cross-origin guard */ }
      const hue = cs.isActive ? 'rgba(255,0,0,' : 'rgba(255,140,0,';
      ctx.fillStyle = hue + (l.alpha * 0.3 * cs.intensity) + ')';
      ctx.fillRect(l.dx, l.y, l.w, lineH);
    });
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /* ── Chaos chromatic aberration ── */
  function _drawChaosChromaticAberration(ctx, W, H, cs) {
    if (cs.intensity < 0.2) return;
    const offset = Math.round(cs.intensity * 6);
    const alpha  = cs.intensity * 0.11;
    ctx.save();
    ctx.globalAlpha              = alpha;
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = 'rgb(255,0,0)'; ctx.fillRect(-offset, 0, W, H);
    ctx.fillStyle = 'rgb(0,0,255)'; ctx.fillRect(offset,  0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /* ── Chaos HUD badge ── */
  function _drawChaosBadge(ctx, W, H, cs) {
    ctx.save();
    const badgeY = 56;
    const cx     = W / 2;
    const now    = Date.now();

    if (cs.isWarning) {
      const pulse = Math.abs(Math.sin(now / 200));
      ctx.globalAlpha = 0.5 + pulse * 0.5;
      ctx.font        = `bold 13px 'Share Tech Mono', monospace`;
      ctx.textAlign   = 'center';
      ctx.fillStyle   = '#ffaa00';
      ctx.shadowColor = '#ffaa00';
      ctx.shadowBlur  = 18;
      ctx.fillText('⚠  CHAOS INCOMING  ⚠', cx, badgeY);

      // Tier label so player knows what they're in for
      ctx.font        = `10px 'Share Tech Mono', monospace`;
      ctx.globalAlpha = 0.45 + pulse * 0.3;
      ctx.fillStyle   = '#cc8800';
      ctx.shadowBlur  = 8;
      ctx.fillText(`[ ${cs.tier.toUpperCase()} ]`, cx, badgeY + 14);

      // Progress bar
      const progress = 1 - cs.timer / 2.0;
      const barW = 160, barH = 3, bx = cx - barW / 2;
      ctx.globalAlpha = 0.55;
      ctx.fillStyle   = '#2a1800'; ctx.fillRect(bx, badgeY + 20, barW, barH);
      ctx.fillStyle   = '#ffaa00'; ctx.shadowBlur = 8;
      ctx.fillRect(bx, badgeY + 20, barW * progress, barH);

    } else if (cs.isActive) {
      const flicker = Math.sin(now / 80) > 0 ? 1 : 0.6;
      ctx.globalAlpha = flicker;
      ctx.font        = `bold 14px 'Share Tech Mono', monospace`;
      ctx.textAlign   = 'center';
      ctx.fillStyle   = '#ff2020';
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur  = 24;
      ctx.fillText('◈  CHAOS ACTIVE  ◈', cx, badgeY);

      // Countdown bar
      const progress = cs.timer / cs.activeDuration;
      const barW = 160, barH = 3, bx = cx - barW / 2;
      ctx.globalAlpha = 0.6;
      ctx.fillStyle   = '#2a0000'; ctx.fillRect(bx, badgeY + 10, barW, barH);
      ctx.fillStyle   = '#ff2020'; ctx.shadowBlur = 8;
      ctx.fillRect(bx, badgeY + 10, barW * progress, barH);

    } else if (cs.isCooldown) {
      ctx.globalAlpha = cs.intensity * 0.8;
      ctx.font        = `12px 'Share Tech Mono', monospace`;
      ctx.textAlign   = 'center';
      ctx.fillStyle   = '#44ff88';
      ctx.shadowColor = '#44ff88';
      ctx.shadowBlur  = 14;
      ctx.fillText('CHAOS SURVIVED', cx, badgeY);
    }

    ctx.shadowBlur  = 0;
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /* ── AI Intensity meter ── */
  function _drawIntensityMeter(ctx, W, H) {
    const adj       = AISystem.getAdj();
    const intensity = adj.unpredictabilityLevel;
    if (intensity <= 0.05) return;
    const barW = 80, barH = 2, bx = W/2 - barW/2, by = 20;
    ctx.globalAlpha = 0.4;
    ctx.fillStyle   = '#1a2030';
    ctx.fillRect(bx, by, barW, barH);
    ctx.globalAlpha = 0.5 + intensity * 0.5;
    ctx.fillStyle   = `rgb(${Math.round(100+intensity*155)},${Math.round(50-intensity*50)},${Math.round(50-intensity*50)})`;
    ctx.shadowColor = '#ff3b3b'; ctx.shadowBlur = 6;
    ctx.fillRect(bx, by, barW * intensity, barH);
    ctx.shadowBlur  = 0; ctx.globalAlpha = 1;
  }

  /* ── Combo multiplier HUD ────────────────────────────
     Shows "x4 COMBO" style counter in the bottom-left
     when consecutiveSaves ≥ 3. Pulses on increment and
     fades if not earned. Rewards player for streaks and
     makes it visible when chaos mode is about to fire.
  ──────────────────────────────────────────────────────── */
  function _drawComboHUD(ctx, W, H) {
    const m = AISystem.getMetrics();
    const saves = m.consecutiveSaves;
    if (saves < 3) return;   // silent below threshold

    const cx     = W,
          cy     = H - 28;
    const now    = Date.now();

    // Colour: green < 6, amber 6-11, red ≥ 12 (almost chaos territory)
    let col, glow;
    if (saves >= 12) { col = '#ff4444'; glow = 'rgba(255,60,60,0.6)'; }
    else if (saves >= 6) { col = '#ffcc00'; glow = 'rgba(255,200,0,0.5)'; }
    else { col = '#44ff88'; glow = 'rgba(68,255,136,0.4)'; }

    // Pulse scale on every increment (keyed to saves count parity)
    const pulse = 1 + Math.sin(now / 120) * 0.06;

    ctx.save();
    ctx.textAlign   = 'right';
    ctx.globalAlpha = 0.82;
    ctx.shadowColor = glow;
    ctx.shadowBlur  = 14;

    // Label
    ctx.font      = `bold ${Math.round(11 * pulse)}px 'Share Tech Mono', monospace`;
    ctx.fillStyle = col;
    ctx.fillText('COMBO', cx - 16, cy - 14);

    // Counter (larger)
    ctx.font      = `bold ${Math.round(22 * pulse)}px 'Bebas Neue', sans-serif`;
    ctx.fillStyle = col;
    ctx.fillText(`x${saves}`, cx - 14, cy);

    ctx.shadowBlur  = 0;
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /* ── HUD ── */
  function _updateHUD() {
    elScore.textContent = String(score);
    elBest.textContent  = String(bestScore);
  }

  /* ══════════════════════════════════════════════════
     INPUT
  ══════════════════════════════════════════════════ */

  function handleJumpInput() {
    Engine.initAudio();
    if (state === STATE.MENU)   { startGame();   return; }
    if (state === STATE.DEAD)   { restartGame(); return; }
    if (state === STATE.PAUSED) { togglePause(); return; }
    if (state === STATE.PLAYING) Player.jump();
  }

  document.addEventListener('keydown', e => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault();
      handleJumpInput();
    }
    if (e.code === 'KeyP' && (state === STATE.PLAYING || state === STATE.PAUSED)) {
      togglePause();
    }
  });

  document.addEventListener('touchstart', e => {
    e.preventDefault();
    handleJumpInput();
  }, { passive: false });

  window.addEventListener('resize', () => {
    if (state === STATE.PLAYING || state === STATE.PAUSED) {
      const { W, H } = Engine.getSize();
      groundY = H * 0.72;
      Player.setGroundY(groundY);
      Obstacles.setGroundY(groundY);
    }
  });

  /* Boot */
  init();

})();
