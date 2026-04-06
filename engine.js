// engine.js — Game loop orchestrator
import { Game } from './game.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', () => {
  resize();
  if (game) game.onResize();
});

const game = new Game(canvas, ctx);

let lastTime = 0;
const MAX_DELTA = 50; // cap delta to avoid spiral of death

function loop(timestamp) {
  const raw = timestamp - lastTime;
  lastTime = timestamp;
  const delta = Math.min(raw, MAX_DELTA);
  game.tick(delta);
  requestAnimationFrame(loop);
}

requestAnimationFrame((t) => {
  lastTime = t;
  requestAnimationFrame(loop);
});
