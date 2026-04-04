/* ── RUNΔX · engine.js ────────────────────────────────
   Core loop, canvas management, screen shake, audio
──────────────────────────────────────────────────────── */

const Engine = (() => {
  /* ── Canvas setup ── */
  const canvas  = document.getElementById('gameCanvas');
  const ctx     = canvas.getContext('2d');
  let W = 0, H = 0;

  /* ── Loop state ── */
  let lastTime    = 0;
  let rafId       = null;
  let running     = false;
  let paused      = false;
  let updateFn    = null;
  let drawFn      = null;

  /* ── Screen shake ── */
  let shakeAmt    = 0;
  let shakeDur    = 0;
  let shakeX      = 0;
  let shakeY      = 0;

  /* ── Flash overlay ── */
  let flashAlpha  = 0;
  let flashColor  = '#ff3b3b';

  /* ── Audio context ── */
  let audioCtx    = null;

  /* ─────────────────────────────────────────────────── */
  function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }

  /* Tiny synth sounds via Web Audio */
  function playJump() {
    if (!audioCtx) return;
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type      = 'square';
    osc.frequency.setValueAtTime(220, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.12);
  }

  function playDeath() {
    if (!audioCtx) return;
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type      = 'sawtooth';
    osc.frequency.setValueAtTime(300, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.4);
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.45);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.5);
  }

  function playLand() {
    if (!audioCtx) return;
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type      = 'sine';
    osc.frequency.setValueAtTime(110, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.06);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.06);
  }

  /* Warning sting — low ominous descend played at chaos WARNING start */
  function playChaosWarningSting() {
    if (!audioCtx) return;
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, audioCtx.currentTime + 1.8);
    gain.gain.setValueAtTime(0.0, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.10, audioCtx.currentTime + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 2.0);
    osc.start();
    osc.stop(audioCtx.currentTime + 2.0);
  }

  /* Chaos active sting — sharp dissonant hit when chaos goes live */
  function playChaosActiveSting() {
    if (!audioCtx) return;
    [140, 210, 310].forEach((freq, i) => {
      const osc  = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'square';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.06, audioCtx.currentTime + i * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35 + i * 0.04);
      osc.start(audioCtx.currentTime + i * 0.04);
      osc.stop(audioCtx.currentTime + 0.4 + i * 0.04);
    });
  }

  /* Chaos-end release chime */
  function playChaosEndSting() {
    if (!audioCtx) return;
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(240, audioCtx.currentTime + 0.4);
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.5);
  }

  /* Continuous low-amplitude chaos rumble — call each frame during chaos */
  let _chaosRumbleTimer = 0;
  function tickChaosRumble(dt, intensity) {
    if (!audioCtx || intensity <= 0) return;
    _chaosRumbleTimer -= dt;
    if (_chaosRumbleTimer > 0) return;
    _chaosRumbleTimer = 0.12 + Math.random() * 0.10; // every ~120–220 ms
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sawtooth';
    osc.frequency.value = 40 + Math.random() * 30;
    gain.gain.setValueAtTime(0.02 * intensity, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.1);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.12);
  }

  /* Ambient background drone */
  let droneOsc = null, droneGain = null;
  function startDrone() {
    if (!audioCtx || droneOsc) return;
    droneOsc  = audioCtx.createOscillator();
    droneGain = audioCtx.createGain();
    droneOsc.connect(droneGain);
    droneGain.connect(audioCtx.destination);
    droneOsc.type = 'sine';
    droneOsc.frequency.value = 55;
    droneGain.gain.value = 0.03;
    droneOsc.start();
  }

  function stopDrone() {
    if (!droneOsc) return;
    droneGain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.5);
    droneOsc.stop(audioCtx.currentTime + 0.5);
    droneOsc = null;
  }

  /* ─────────────────────────────────────────────────── */
  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  /* Trigger screen shake */
  function shake(amount = 10, duration = 300) {
    shakeAmt = amount;
    shakeDur = duration;
  }

  /* Trigger color flash */
  function flash(color = '#ff3b3b', alpha = 0.55) {
    flashColor = color;
    flashAlpha = alpha;
  }

  /* ── Main loop ── */
  function loop(ts) {
    if (!running) return;
    rafId = requestAnimationFrame(loop);

    const dt = Math.min((ts - lastTime) / 1000, 0.05); // cap at 50ms
    lastTime = ts;

    if (paused) {
      // Still draw while paused (frozen frame)
      render(0);
      return;
    }

    // Update screen shake
    if (shakeDur > 0) {
      shakeDur -= dt * 1000;
      const mag = shakeAmt * (shakeDur / 300);
      shakeX = (Math.random() * 2 - 1) * mag;
      shakeY = (Math.random() * 2 - 1) * mag;
    } else {
      shakeX = 0; shakeY = 0;
    }

    // Fade flash
    if (flashAlpha > 0) flashAlpha -= dt * 3;

    if (updateFn) updateFn(dt);
    render(dt);
  }

  function render(dt) {
    ctx.save();
    ctx.translate(shakeX, shakeY);

    // Clear
    ctx.clearRect(-10, -10, W + 20, H + 20);

    if (drawFn) drawFn(ctx, W, H, dt);

    // Flash overlay
    if (flashAlpha > 0) {
      ctx.globalAlpha = Math.max(0, flashAlpha);
      ctx.fillStyle   = flashColor;
      ctx.fillRect(-10, -10, W + 20, H + 20);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  function start(update, draw) {
    updateFn = update;
    drawFn   = draw;
    running  = true;
    paused   = false;
    lastTime = performance.now();
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(loop);
    startDrone();
  }

  function stop() {
    running = false;
    stopDrone();
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  }

  function setPaused(val) { paused = val; }
  function isPaused()     { return paused; }
  function getSize()      { return { W, H }; }

  /* Show/hide screens */
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    if (id) document.getElementById(id).classList.add('active');
  }

  /* Init */
  window.addEventListener('resize', resize);
  resize();

  return {
    canvas, ctx, getSize,
    start, stop, setPaused, isPaused,
    shake, flash, showScreen,
    initAudio, playJump, playDeath, playLand,
    playChaosWarningSting, playChaosActiveSting, playChaosEndSting,
    tickChaosRumble,
  };
})();
