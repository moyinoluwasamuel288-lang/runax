// aiSystem.js — AI Pilot
export class AISystem {
  constructor() {
    this.enabled = false;
    this.cooldown = 0;
    this.minCooldown = 280; // ms between jumps
    this.reactionJitter = 0; // ms of humanizing delay
    this.jitterTimer = 0;
    this.pendingJump = false;
  }

  toggle() {
    this.enabled = !this.enabled;
    this.cooldown = 0;
    this.pendingJump = false;
  }

  update(delta, player, obstacleManager) {
    if (!this.enabled) return;

    this.cooldown -= delta;
    if (this.cooldown < 0) this.cooldown = 0;

    if (this.jitterTimer > 0) {
      this.jitterTimer -= delta;
      if (this.jitterTimer <= 0 && this.pendingJump) {
        this.pendingJump = false;
        player.requestJump();
        this.cooldown = this.minCooldown;
      }
      return;
    }

    if (this.cooldown > 0) return;
    if (!player.onGround && !player.onPlatform) return;

    const nearest = obstacleManager.getNextObstacle(player.x);
    if (!nearest) return;

    const dist = nearest.x - (player.x + player.w);
    const speed = obstacleManager.speed || 380;

    // Time until obstacle reaches us
    const timeToObstacle = dist / speed; // seconds

    // How far ahead to jump (based on jump arc)
    // At 820px/s jump and 2200 gravity: apex at ~0.37s, full arc ~0.75s
    // We want to jump when obstacle is ~0.65s away (before it arrives)
    const jumpLeadTime = 0.62;

    // Add small random jitter to feel human (40–110ms)
    const jitter = 40 + Math.random() * 70;

    if (timeToObstacle <= jumpLeadTime + jitter / 1000) {
      // Also check we actually need to jump (obstacle is at ground level)
      const playerGroundY = player.GROUND_Y;
      const obsBottom = nearest.y + nearest.h;
      if (Math.abs(obsBottom - playerGroundY) < 10) {
        // Ground obstacle — need to jump
        this.pendingJump = true;
        this.jitterTimer = jitter;
      }
    }
  }
}
