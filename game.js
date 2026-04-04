/* ── RUNΔX · game.js ──────────────────────────────────
   Main game orchestrator: state machine, world drawing,
   HUD updates, input handling, high-score
──────────────────────────────────────────────────────── */

(function () {

  /* ── State machine ── */
  const STATE = { MENU: 0, PLAYING: 1, DEAD: 2, PAUSED: 3 };
  let state = STATE.MENU;

  /* ── High score ── */
  let highScore = parseInt(localStorage.getItem('runax_best') || '0', 10);

  /* ── Score / distance ── */
  let score    = 0;
  let bestScore = highScore;

  /* ── World / parallax ── */
  const BG_LAYERS = [
    { speed: 0.05, elements: [] },
    { speed: 0.15, elements: [] },
    { speed: 0.35, elements: [] },
  ];
  let worldScrollX = 0;

  /* ── Ground ── */
  let groundY = 0;

  /* ── DOM refs ── */
  const elScore    = document.getElementById('score-value');
  const elBest     = document.getElementById('best-value');
  const elDeadScore = document.getElementById('dead-score');
  const elDeadBest  = document.getElementById('dead-best');
  const elDeadJumps = document.getElementById('dead-jumps');
  const elDeadAcc   = document.getElementById('dead-acc');
  const elTaunt     = document.getElementById('taunt-line');

  /* ── Input ── */
  let jumpPressed = false;

  /* ── Chaos visual state (persisted across frames for smooth transitions) ── */
  let prevChaosPhase = -1;
  let glitchLines = [];

  /* Drive CSS body class for HUD colour transitions */
  function _setChaosClass(cs) {
    document.body.classList.remove('chaos-warning', 'chaos-active', 'chaos-cooldown');
    if (cs.isWarning)  document.body.classList.add('chaos-warning');
    if (cs.isActive)   document.body.classList.add('chaos-active');
    if (cs.isCooldown) document.body.classList.add('chaos-cooldown');
  }

  /* ─────────────────────────────────────────────────── */
  /* ── Init ─────────────────────────────────────────── */

  function init() {
    const { W, H } = Engine.getSize();
    groundY = H * 0.72;

    _generateBgElements(W, H);

    Player.init(H);
    Obstacles.init(groundY, W, H);
    AISystem.reset();

    score       = 0;
    worldScrollX = 0;
    jumpPressed  = false;

    _updateHUD();
    Engine.showScreen('screen-start');

    elBest.textContent = bestScore;
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

    score        = 0;
    worldScrollX = 0;
    jumpPressed  = false;
    prevChaosPhase = -1;
    glitchLines    = [];
    state        = STATE.PLAYING;

    Engine.showScreen(null);
    Engine.start(update, draw);
  }

  function gameOver() {
    state = STATE.DEAD;

    // Update high score
    if (score > bestScore) {
      bestScore = score;
      localStorage.setItem('runax_best', String(bestScore));
    }

    const m = AISystem.getMetrics();
    const acc = Math.round(AISystem.getAccuracy() * 100);

    elDeadScore.textContent = String(score);
    elDeadBest.textContent  = String(bestScore);
    elDeadJumps.textContent = String(m.jumpsAttempted);
    elDeadAcc.textContent   = acc + '%';
    elTaunt.textContent     = AISystem.getTaunt();

    // Chaos completions row — only visible if player experienced chaos
    const chaosRow = document.getElementById('chaos-row');
    const chaosVal = document.getElementById('dead-chaos');
    if (m.chaosCompletions > 0) {
      chaosVal.textContent      = String(m.chaosCompletions);
      chaosRow.style.display    = 'flex';
    } else {
      chaosRow.style.display    = 'none';
    }

    elBest.textContent      = String(bestScore);

    // Clear chaos HUD colour on death screen
    _setChaosClass({ isWarning: false, isActive: false, isCooldown: false });

    // Slight delay before showing death screen (let death anim play)
    setTimeout(() => {
      if (state === STATE.DEAD) Engine.showScreen('screen-dead');
    }, 600);
  }

  function restartGame() {
    Engine.stop();
    startGame();
  }

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

  /* ─────────────────────────────────────────────────── */
  /* ── Update ───────────────────────────────────────── */

  function update(dt) {
    if (state !== STATE.PLAYING) return;

    const speed = 280 * AISystem.getSpeedMultiplier();
    worldScrollX += speed * dt;

    // Update systems
    AISystem.update(dt);
    Player.update(dt);
    Obstacles.update(dt, speed);

    // ── Chaos phase management ──────────────────────────
    const cs = AISystem.getChaosState();

    // Detect phase transitions → fire one-shot audio stings
    if (cs.phase !== prevChaosPhase) {
      if (cs.isWarning) {
        Engine.playChaosWarningSting();
        // Low continuous shake during warning ramps up gradually
        Engine.shake(2, 99999); // we'll override each frame below
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

    // Continuous rumble during warning + active
    if (cs.isWarning || cs.isActive) {
      Engine.tickChaosRumble(dt, cs.intensity);
      // Escalating shake: warning = light tremor, active = noticeable rattle
      const shakeMag = cs.isActive ? 4 : 1.5 * cs.intensity;
      Engine.shake(shakeMag, 80); // short duration so it re-samples each frame
    }

    // Push inversion flag into player
    Player.setJumpInverted(cs.jumpInverted);

    // Refresh glitch lines for the renderer
    if (cs.isWarning || cs.isActive) {
      _updateGlitchLines(dt, cs.intensity);
    } else {
      glitchLines = [];
    }

    // Sync CSS body class so HUD labels transition colour smoothly
    _setChaosClass(cs);
    // ───────────────────────────────────────────────────

    // Score = distance in meters (arbitrary)
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

  /* Generate / age glitch lines used by _drawChaosGlitch() */
  function _updateGlitchLines(dt, intensity) {
    // Spawn new lines proportional to intensity
    const spawnCount = Math.floor(intensity * 3);
    for (let i = 0; i < spawnCount; i++) {
      if (Math.random() < 0.25 * intensity) {
        const { H, W } = Engine.getSize();
        glitchLines.push({
          y:     Math.random() * H,
          w:     30 + Math.random() * W * 0.4,
          dx:    (Math.random() - 0.5) * 60 * intensity,
          alpha: 0.3 + Math.random() * 0.4 * intensity,
          life:  0.05 + Math.random() * 0.12,
        });
      }
    }
    // Age and cull
    glitchLines = glitchLines
      .map(l => ({ ...l, life: l.life - dt, alpha: l.alpha - dt * 2 }))
      .filter(l => l.life > 0 && l.alpha > 0);
    // Cap pool
    if (glitchLines.length > 18) glitchLines.splice(0, glitchLines.length - 18);
  }

  /* ─────────────────────────────────────────────────── */
  /* ── Draw ─────────────────────────────────────────── */

  function draw(ctx, W, H) {
    // Background (chaos darkens it via _drawBackground reading chaos state)
    _drawBackground(ctx, W, H);

    // Parallax world elements
    _drawParallax(ctx, W, H);

    // Ground
    _drawGround(ctx, W, H);

    // Grid / scanlines (atmospheric)
    _drawScanlines(ctx, W, H);

    // Obstacles
    Obstacles.draw(ctx);

    // Player
    Player.draw(ctx);

    // Vignette
    _drawVignette(ctx, W, H);

    // ── Chaos visual layers (drawn on top of everything) ──
    const cs = AISystem.getChaosState();
    if (cs.intensity > 0) {
      _drawChaosVignette(ctx, W, H, cs);
      _drawChaosGlitch(ctx, W, H, cs);
      _drawChaosChromaticAberration(ctx, W, H, cs);
    }

    // AI intensity indicator (subtle)
    _drawIntensityMeter(ctx, W, H);

    // Chaos HUD badge (most prominent — drawn last so it's always on top)
    if (cs.intensity > 0.05) {
      _drawChaosBadge(ctx, W, H, cs);
    }
  }

  /* ── Background — darkens during chaos warning/active ── */
  function _drawBackground(ctx, W, H) {
    const cs = AISystem.getChaosState();
    // Normal colour: #040609 → #0a0e14
    // During chaos the sky darkens toward pure black
    const darken = cs.intensity * 0.85; // 0 = normal, 0.85 = nearly black

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

  /* Linearly interpolate between two hex colours, t in [0,1] */
  function _lerpHex(hexA, hexB, t) {
    const a = _hexToRgb(hexA), b = _hexToRgb(hexB);
    const r = Math.round(a.r + (b.r - a.r) * t);
    const g = Math.round(a.g + (b.g - a.g) * t);
    const bl = Math.round(a.b + (b.b - a.b) * t);
    return `rgb(${r},${g},${bl})`;
  }

  function _hexToRgb(hex) {
    const n = parseInt(hex.replace('#', ''), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  /* ── Chaos vignette — deep red/black border crush ── */
  function _drawChaosVignette(ctx, W, H, cs) {
    // During WARNING the vignette is amber; during ACTIVE it's deep red
    const r = cs.isActive ? 80 : 50;
    const g = cs.isActive ? 0  : 10;
    const outerAlpha = cs.intensity * 0.7;

    const grad = ctx.createRadialGradient(W / 2, H / 2, H * 0.15, W / 2, H / 2, H * 0.85);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.6, 'rgba(0,0,0,0)');
    grad.addColorStop(1, `rgba(${r},${g},0,${outerAlpha})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Hard border frame that pulses with intensity
    const pulse = Math.sin(Date.now() / 200) * 0.15 + 0.15;
    const frameAlpha = cs.intensity * (0.25 + (cs.isActive ? pulse : 0));
    ctx.strokeStyle = cs.isActive
      ? `rgba(180,0,0,${frameAlpha})`
      : `rgba(120,60,0,${frameAlpha * 0.7})`;
    ctx.lineWidth = 8 + cs.intensity * 12;
    ctx.strokeRect(0, 0, W, H);
  }

  /* ── Chaos glitch — horizontal scan tears ── */
  function _drawChaosGlitch(ctx, W, H, cs) {
    if (glitchLines.length === 0) return;
    ctx.save();
    glitchLines.forEach(l => {
      ctx.globalAlpha = Math.max(0, l.alpha) * cs.intensity;
      // Read a strip of the canvas and offset it sideways
      const lineH = 2 + Math.random() * 4;
      try {
        const imgData = ctx.getImageData(0, l.y, W, lineH);
        ctx.putImageData(imgData, l.dx, l.y);
      } catch (e) { /* cross-origin guard — silently ignore */ }
      // Also paint a colour band for extra visibility
      const hue = cs.isActive ? `rgba(255,0,0,` : `rgba(255,140,0,`;
      ctx.fillStyle = hue + (l.alpha * 0.3 * cs.intensity) + ')';
      ctx.fillRect(l.dx, l.y, l.w, lineH);
    });
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /* ── Chaos chromatic aberration — RGB channel split on edges ── */
  function _drawChaosChromaticAberration(ctx, W, H, cs) {
    if (cs.intensity < 0.2) return;
    const offset = Math.round(cs.intensity * 6);
    const alpha  = cs.intensity * 0.12;

    // Red channel shifted left
    ctx.save();
    ctx.globalAlpha     = alpha;
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle       = `rgb(255,0,0)`;
    ctx.fillRect(-offset, 0, W, H);
    // Blue channel shifted right
    ctx.fillStyle       = `rgb(0,0,255)`;
    ctx.fillRect(offset, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha     = 1;
    ctx.restore();
  }

  /* ── Chaos HUD badge ── */
  function _drawChaosBadge(ctx, W, H, cs) {
    ctx.save();

    const badgeY   = 56;          // below score HUD
    const cx       = W / 2;
    const now      = Date.now();

    if (cs.isWarning) {
      // WARNING: pulsing amber text
      const pulse   = Math.abs(Math.sin(now / 200));
      ctx.globalAlpha = 0.5 + pulse * 0.5;
      ctx.font        = `bold 13px 'Share Tech Mono', monospace`;
      ctx.letterSpacing = '4px';
      ctx.textAlign   = 'center';
      ctx.fillStyle   = '#ffaa00';
      ctx.shadowColor = '#ffaa00';
      ctx.shadowBlur  = 18;
      ctx.fillText('⚠  CHAOS INCOMING  ⚠', cx, badgeY);

      // Timer bar below badge (fills up over warning window)
      const progress = 1 - cs.timer / 2.0;
      const barW = 160, barH = 3;
      const bx   = cx - barW / 2;
      ctx.globalAlpha = 0.55;
      ctx.fillStyle   = '#2a1800';
      ctx.fillRect(bx, badgeY + 6, barW, barH);
      ctx.fillStyle   = '#ffaa00';
      ctx.shadowBlur  = 8;
      ctx.fillRect(bx, badgeY + 6, barW * progress, barH);

    } else if (cs.isActive) {
      // ACTIVE: hard red flicker + inverted controls label
      const flicker = Math.sin(now / 80) > 0 ? 1 : 0.6;
      ctx.globalAlpha = flicker;
      ctx.font        = `bold 14px 'Share Tech Mono', monospace`;
      ctx.textAlign   = 'center';
      ctx.fillStyle   = '#ff2020';
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur  = 24;
      ctx.fillText('◈  CHAOS ACTIVE  ◈', cx, badgeY);

      // "JUMP = DON'T JUMP" sub-label
      ctx.font        = `11px 'Share Tech Mono', monospace`;
      ctx.globalAlpha = 0.7 * flicker;
      ctx.fillStyle   = '#ff8888';
      ctx.shadowBlur  = 10;
      ctx.fillText('CONTROLS INVERTED', cx, badgeY + 18);

      // Countdown bar (drains over active duration)
      const progress = cs.timer / cs.activeDuration;
      const barW = 160, barH = 3;
      const bx   = cx - barW / 2;
      ctx.globalAlpha = 0.6;
      ctx.fillStyle   = '#2a0000';
      ctx.fillRect(bx, badgeY + 26, barW, barH);
      ctx.fillStyle   = '#ff2020';
      ctx.shadowBlur  = 8;
      ctx.fillRect(bx, badgeY + 26, barW * progress, barH);

    } else if (cs.isCooldown) {
      // COOLDOWN: fading green "survived" message
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

  /* ── Parallax city/grid elements ── */
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
    const h = layerIdx === 0
      ? 30 + Math.random() * 80
      : layerIdx === 1
        ? 20 + Math.random() * 50
        : 5 + Math.random() * 25;

    return {
      x,
      w: 4 + Math.random() * (layerIdx === 0 ? 30 : 12),
      h,
      y: H * 0.72 - h,
      alpha: 0.04 + layerIdx * 0.03 + Math.random() * 0.04,
    };
  }

  function _drawParallax(ctx, W, H) {
    const speed = AISystem.getSpeedMultiplier();

    BG_LAYERS.forEach((layer, li) => {
      ctx.save();
      const dx = (worldScrollX * layer.speed) % W;

      layer.elements.forEach(el => {
        let ex = ((el.x - dx) % W + W) % W;

        ctx.globalAlpha = el.alpha;
        ctx.fillStyle   = li === 0 ? '#1a2030' : li === 1 ? '#111820' : '#0d1218';
        ctx.fillRect(ex, el.y, el.w, el.h);

        // Window lights on tall buildings
        if (li === 0 && el.h > 50) {
          ctx.fillStyle   = 'rgba(255,200,80,0.35)';
          ctx.globalAlpha = el.alpha * 2;
          for (let wy = el.y + 6; wy < el.y + el.h - 6; wy += 10) {
            for (let wx = ex + 3; wx < ex + el.w - 3; wx += 6) {
              if (Math.random() < 0.4) ctx.fillRect(wx, wy, 3, 4);
            }
          }
        }
      });

      ctx.restore();
    });
  }

  /* ── Ground ── */
  function _drawGround(ctx, W, H) {
    const gY = groundY;

    // Ground fill
    const grad = ctx.createLinearGradient(0, gY, 0, H);
    grad.addColorStop(0,   '#0f1520');
    grad.addColorStop(0.4, '#080c12');
    grad.addColorStop(1,   '#040608');
    ctx.fillStyle = grad;
    ctx.fillRect(0, gY, W, H - gY);

    // Ground line (glowing)
    ctx.shadowColor = '#ff3b3b';
    ctx.shadowBlur  = 8;
    ctx.strokeStyle = '#ff3b3b';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, gY);
    ctx.lineTo(W, gY);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Moving dashes (speed indicator)
    const speed = AISystem.getSpeedMultiplier();
    const dashW = 24;
    const gap   = 60 / speed;
    const offset = (worldScrollX * 0.8) % (dashW + gap);

    ctx.strokeStyle = 'rgba(255,59,59,0.25)';
    ctx.lineWidth   = 1;
    ctx.setLineDash([dashW, gap]);
    ctx.lineDashOffset = -offset;
    ctx.beginPath();
    ctx.moveTo(0, gY + 6);
    ctx.lineTo(W, gY + 6);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /* ── CRT scanlines ── */
  function _drawScanlines(ctx, W, H) {
    ctx.globalAlpha = 0.025;
    ctx.fillStyle   = '#000';
    for (let y = 0; y < H; y += 4) {
      ctx.fillRect(0, y, W, 2);
    }
    ctx.globalAlpha = 1;
  }

  /* ── Vignette ── */
  function _drawVignette(ctx, W, H) {
    const grad = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  /* ── AI Intensity meter (top center — subtle bar) ── */
  function _drawIntensityMeter(ctx, W, H) {
    const adj = AISystem.getAdj();
    const intensity = adj.unpredictabilityLevel;
    if (intensity <= 0.05) return;

    const barW  = 80;
    const barH  = 2;
    const bx    = W / 2 - barW / 2;
    const by    = 20;

    ctx.globalAlpha = 0.4;
    ctx.fillStyle   = '#1a2030';
    ctx.fillRect(bx, by, barW, barH);

    ctx.globalAlpha = 0.5 + intensity * 0.5;
    ctx.fillStyle   = `rgb(${Math.round(100 + intensity * 155)}, ${Math.round(50 - intensity * 50)}, ${Math.round(50 - intensity * 50)})`;
    ctx.shadowColor = '#ff3b3b';
    ctx.shadowBlur  = 6;
    ctx.fillRect(bx, by, barW * intensity, barH);
    ctx.shadowBlur  = 0;
    ctx.globalAlpha = 1;
  }

  /* ── HUD ── */
  function _updateHUD() {
    elScore.textContent = String(score);
    elBest.textContent  = String(bestScore);
  }

  /* ─────────────────────────────────────────────────── */
  /* ── Input ────────────────────────────────────────── */

  function handleJumpInput() {
    Engine.initAudio();
    if (state === STATE.MENU) {
      startGame();
      return;
    }
    if (state === STATE.DEAD) {
      restartGame();
      return;
    }
    if (state === STATE.PAUSED) {
      togglePause();
      return;
    }
    if (state === STATE.PLAYING) {
      Player.jump();
    }
  }

  document.addEventListener('keydown', e => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault();
      handleJumpInput();
    }
    if (e.code === 'KeyP') {
      if (state === STATE.PLAYING || state === STATE.PAUSED) togglePause();
    }
  });

  // Touch support
  document.addEventListener('touchstart', e => {
    e.preventDefault();
    handleJumpInput();
  }, { passive: false });

  // Resize: reinitialise layout.
  // Both game.js groundY AND Player's internal groundY must stay in sync —
  // a mismatch means obstacles sit on a different floor than the player does.
  window.addEventListener('resize', () => {
    if (state === STATE.PLAYING || state === STATE.PAUSED) {
      const { W, H } = Engine.getSize();
      groundY = H * 0.72;
      // Re-init Player's ground reference without resetting its position.
      // Player.init() is too heavy here; we expose a dedicated setter instead.
      Player.setGroundY(groundY);
      Obstacles.setGroundY(groundY);
    }
  });

  /* ─────────────────────────────────────────────────── */
  /* Boot */
  init();

})();
