/* ── RUNΔX · engine.js ── Core: Canvas, Audio, Shake, Flash, etc. */

const Engine = (() => {
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0;
  let rafId = null;
  let updateFn = null, drawFn = null;
  let lastTs = 0;
  let isPaused = false;

  let shakeAmt = 0, shakeDur = 0, shakeX = 0, shakeY = 0;
  let flashA = 0, flashC = '#ff3232';

  let audioCtx = null;
  let droneNode = null, droneGain = null;

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    startDrone();
  }

  function startDrone() {
    if (!audioCtx || droneNode) return;
    droneNode = audioCtx.createOscillator();
    droneGain = audioCtx.createGain();
    droneNode.connect(droneGain);
    droneGain.connect(audioCtx.destination);
    droneNode.type = 'sine';
    droneNode.frequency.value = 55;
    droneGain.gain.value = 0.025;
    droneNode.start();
  }

  function beep(freq, freq2, dur, type = 'square', vol = 0.07) {
    if (!audioCtx) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.connect(g); g.connect(audioCtx.destination);
    o.type = type;
    o.frequency.setValueAtTime(freq, audioCtx.currentTime);
    if (freq2) o.frequency.exponentialRampToValueAtTime(freq2, audioCtx.currentTime + dur * 0.6);
    g.gain.setValueAtTime(vol, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
    o.start();
    o.stop(audioCtx.currentTime + dur);
  }

  function playJump()  { beep(200, 420, 0.11, 'square', 0.07); }
  function playLand()  { beep(100, 100, 0.06, 'sine', 0.04); }
  function playDeath() { beep(300, 48, 0.45, 'sawtooth', 0.14); }

  function playChaosWarningSting() { beep(180, 320, 0.6, 'sawtooth', 0.1); }
  function playChaosActiveSting()  { beep(420, 180, 0.8, 'sawtooth', 0.12); }
  function playChaosEndSting()     { beep(280, 520, 0.7, 'sine', 0.08); }

  function trigShake(a = 12, d = 350) { shakeAmt = a; shakeDur = d; }
  function trigFlash(c = '#ff3232', a = 0.6) { flashC = c; flashA = a; }

  function tickChaosRumble(dt, intensity) {
    // Optional low rumble — you can expand with Web Audio later
  }

  function flash(color, alpha) { trigFlash(color, alpha); }

  function getSize() { return { W, H }; }

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('on'));
    if (id) document.getElementById(id).classList.add('on');
  }

  function setPaused(p) { isPaused = p; }

  function start(update, draw) {
    updateFn = update;
    drawFn = draw;
    resize();
    lastTs = performance.now();
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(loop);
  }

  function stop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  function loop(ts) {
    rafId = requestAnimationFrame(loop);
    const dt = Math.min((ts - lastTs) / 1000, 0.05);
    lastTs = ts;

    if (isPaused) {
      if (drawFn) drawFn(ctx, W, H);
      return;
    }

    // Update shake
    if (shakeDur > 0) {
      shakeDur -= dt * 1000;
      const mag = shakeAmt * (shakeDur / 350);
      shakeX = (Math.random() * 2 - 1) * mag;
      shakeY = (Math.random() * 2 - 1) * mag;
    } else {
      shakeX = shakeY = 0;
    }
    if (flashA > 0) flashA -= dt * 3;

    if (updateFn) updateFn(dt);

    ctx.save();
    ctx.translate(shakeX, shakeY);
    if (drawFn) drawFn(ctx, W, H);

    // Flash overlay
    if (flashA > 0) {
      ctx.globalAlpha = Math.max(0, flashA);
      ctx.fillStyle = flashC;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  window.addEventListener('resize', () => {
    resize();
  });

  return {
    initAudio, getSize, showScreen, setPaused,
    start, stop, playJump, playLand, playDeath,
    playChaosWarningSting, playChaosActiveSting, playChaosEndSting,
    shake: trigShake, flash, tickChaosRumble
  };
})();
