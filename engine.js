// engine.js — Game loop, timing, and bootstrap
import { Game } from './game.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resize() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', () => {
  resize();
  game && game.onResize();
});

// --- Game instance ---
const game = new Game(canvas, ctx);

// --- Loop ---
let lastTs = 0;
const MAX_DT = 50; // cap in ms to prevent spiral of death on tab blur

function loop(ts) {
  const rawDt = ts - lastTs;
  lastTs = ts;
  const dt = Math.min(rawDt, MAX_DT) / 1000; // seconds
  game.tick(dt);
  requestAnimationFrame(loop);
}

requestAnimationFrame(ts => {
  lastTs = ts;
  requestAnimationFrame(loop);
});
