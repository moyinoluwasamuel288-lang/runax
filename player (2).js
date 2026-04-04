// js/player.js
import { GameState, isIn3D } from './gameState.js';

const BASE_JUMP_VEL = -620;
const BASE_GRAVITY = 1800;
const SIZE_W = 26, SIZE_H = 28;

let x, y, vy, onGround = true, alive = true, groundY = 0;
let lane = 1; // 0 left, 1 center, 2 right (used in 3D)
let trailPoints = [], deathTimer = 0, landSquash = 1, jumpStretch = 1, tiltAngle = 0;

export const Player = {
  init(canvasH) {
    groundY = canvasH * 0.72;
    x = canvasH * 0.15;
    y = groundY;
    vy = 0;
    onGround = true;
    alive = true;
    lane = 1;
    trailPoints = [];
    deathTimer = 0;
    landSquash = jumpStretch = 1;
    tiltAngle = 0;
  },

  jump() {
    if (!alive || !onGround) return false;
    vy = BASE_JUMP_VEL;
    onGround = false;
    jumpStretch = 0.65;
    // playJump from Engine
    return true;
  },

  changeLane(dir) {
    if (isIn3D()) {
      lane = Math.max(0, Math.min(2, lane + dir));
    }
  },

  update(dt) {
    if (!alive) {
      deathTimer = Math.max(0, deathTimer - dt);
      return;
    }

    vy += BASE_GRAVITY * dt;
    y += vy * dt;

    if (y >= groundY) {
      y = groundY; vy = 0; onGround = true;
      if (vy > 0) landSquash = 0.55;
    } else {
      onGround = false;
    }

    landSquash += (1 - landSquash) * dt * 14;
    jumpStretch += (1 - jumpStretch) * dt * 10;
    tiltAngle += (onGround ? 0 : Math.min(0.35, vy / 2000) - tiltAngle) * dt * 8;

    // Trail
    trailPoints.unshift({x, y, alpha: 0.6});
    if (trailPoints.length > 14) trailPoints.pop();
    trailPoints.forEach(p => p.alpha -= dt * 2);
  },

  draw(ctx) {
    // Your original beautiful player drawing code goes here (trail, body, eye, pupil, squash/stretch)
    // Copy from your original player.js
  },

  getBounds() {
    return { x: x - SIZE_W/2 + 4, y: y - SIZE_H, w: SIZE_W - 8, h: SIZE_H - 2 };
  },

  isAlive() { return alive; },
  die() { alive = false; deathTimer = 1.2; },
  setGroundY(newGY) { groundY = newGY; if (onGround) y = groundY; },
  getLaneX(W) {
    if (!isIn3D()) return x;
    return W * (0.32 + lane * 0.18);
  }
};
