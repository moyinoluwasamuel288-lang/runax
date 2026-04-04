// js/gameState.js
export const GameState = {
  NORMAL: 0,
  CHAOS: 1,
  TRANSITION: 2,
  THREE_D: 3
};

let current = GameState.NORMAL;
let timer = 0;

export function getState() { return current; }
export function setState(newState) {
  current = newState;
  timer = 0;
}
export function update(dt) { timer += dt; }
export function isIn3D() { return current === GameState.THREE_D; }
export function getTimer() { return timer; }
