// js/engine.js
export const Engine = (() => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0;
  let lastTime = 0, rafId = null, running = false, paused = false;
  let updateFn = null, drawFn = null;
  let shakeAmt = 0, shakeDur = 0, shakeX = 0, shakeY = 0;
  let flashAlpha = 0, flashColor = '#ff3b3b';
  let audioCtx = null;

  function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }

  // Your original audio functions (playJump, playDeath, playLand, chaos stings, rumble, drone) - kept 100% the same
  // ... (paste all your audio code here from the original engine.js)

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function shake(amount = 10, duration = 300) {
    shakeAmt = amount; shakeDur = duration;
  }

  function flash(color = '#ff3b3b', alpha = 0.55) {
    flashColor = color; flashAlpha = alpha;
  }

  function loop(ts) {
    if (!running) return;
    rafId = requestAnimationFrame(loop);
    const dt = Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;

    if (paused) { render(0); return; }

    if (shakeDur > 0) {
      shakeDur -= dt * 1000;
      const mag = shakeAmt * (shakeDur / 300);
      shakeX = (Math.random() * 2 - 1) * mag;
      shakeY = (Math.random() * 2 - 1) * mag;
    } else {
      shakeX = shakeY = 0;
    }

    if (flashAlpha > 0) flashAlpha -= dt * 3;

    if (updateFn) updateFn(dt);
    render(dt);
  }

  function render(dt) {
    ctx.save();
    ctx.translate(shakeX, shakeY);
    ctx.clearRect(-10, -10, W + 20, H + 20);
    if (drawFn) drawFn(ctx, W, H, dt);
    if (flashAlpha > 0) {
      ctx.globalAlpha = Math.max(0, flashAlpha);
      ctx.fillStyle = flashColor;
      ctx.fillRect(-10, -10, W + 20, H + 20);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function start(updateCb, drawCb) {
    updateFn = updateCb; drawFn = drawCb;
    running = true; paused = false;
    lastTime = performance.now();
    rafId = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
  }

  function setPaused(val) { paused = val; }
  function isPaused() { return paused; }
  function getSize() { return { W, H }; }
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    if (id) document.getElementById(id).classList.add('active');
  }

  window.addEventListener('resize', resize);
  resize();

  return {
    canvas, ctx, getSize, start, stop, setPaused, isPaused,
    shake, flash, showScreen, initAudio,
    playJump, playDeath, playLand,
    playChaosWarningSting, playChaosActiveSting, playChaosEndSting,
    tickChaosRumble
  };
})();
