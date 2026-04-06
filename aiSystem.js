// aiSystem.js — AI Observer (God Mode)
// Toggle with G key. AI detects obstacles and jumps at the right time.
// Designed to never lose. Easy to remove — just don't call update().

export class AISystem {
  constructor() {
    this.enabled     = false;
    this.jumpCooldown = 0;      // seconds
    this._jitter     = 0;       // humanized reaction delay
    this._jitterMax  = 0;
    this._committed  = false;   // committed to a jump
  }

  toggle() {
    this.enabled      = !this.enabled;
    this.jumpCooldown = 0;
    this._committed   = false;
    this._jitter      = 0;
  }

  /**
   * Call once per frame. Returns true if AI wants to jump.
   * @param {number} dt
   * @param {object} player
   * @param {object} obstacleMgr
   * @param {number} gameSpeed  — px/s
   */
  update(dt, player, obstacleMgr, gameSpeed) {
    if (!this.enabled) return false;

    this.jumpCooldown = Math.max(0, this.jumpCooldown - dt);

    // Tick jitter countdown
    if (this._jitter > 0) {
      this._jitter -= dt;
      if (this._jitter <= 0 && this._committed) {
        this._committed   = false;
        this.jumpCooldown = 0.32;
        return player.jump();   // execute after delay
      }
      return false;
    }

    // Can't jump mid-air or on cooldown
    if ((!player.onGround && !player.onPlatform) || this.jumpCooldown > 0) return false;

    const obs = obstacleMgr.nearestAhead(player.x, player.W);
    if (!obs) return false;

    // Time until obstacle front edge reaches player
    const dist       = obs.dist;
    const timeToHit  = dist / gameSpeed; // seconds

    // Compute jump arc duration: solve vy*t + 0.5*g*t² = 0 → t = -2*vy/g
    const jumpDur = (-2 * player.JUMP_VEL) / player.GRAVITY; // ≈ 0.66s

    // Jump lead time — jump when obstacle is jumpDur - 0.08s away (slight early window)
    const leadTime = jumpDur - 0.06;

    // Add small humanizing jitter (20–70ms)
    if (timeToHit <= leadTime && !this._committed) {
      this._committed = true;
      this._jitter    = 0.022 + Math.random() * 0.048;
    }

    return false;
  }
}
