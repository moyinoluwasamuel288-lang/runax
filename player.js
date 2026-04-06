// player.js — Player physics, state, and rendering

export class Player {
  constructor(canvas) {
    this.canvas = canvas;
    this.W = 34;
    this.H = 38;
    this._baseW = 34;
    this._baseH = 38;
    this.reset();
  }

  reset() {
    this.groundY    = this.canvas.height * 0.72;
    this.x          = this.canvas.width  * 0.14;
    this.y          = this.groundY - this._baseH;
    this.W          = this._baseW;
    this.H          = this._baseH;
    this.vy         = 0;
    this.vx         = 0;         // dash velocity
    this.onGround   = true;
    this.onPlatform = false;
    this.platformY  = null;

    // Physics constants
    this.GRAVITY      = 2600;    // px/s²
    this.JUMP_VEL     = -860;    // px/s — fixed, deterministic
    this.MAX_FALL     = 1500;    // terminal velocity

    // Power-up flags
    this.immune      = false;
    this.immuneTimer = 0;
    this.growth      = false;
    this.growthTimer = 0;
    this.dashing     = false;
    this.dashTimer   = 0;
    this.dashVX      = 0;

    // Visual
    this.flickerPhase = 0;
    this.trail        = [];
    this.dead         = false;
  }

  onResize() {
    this.groundY = this.canvas.height * 0.72;
    if (this.onGround) this.y = this.groundY - this.H;
  }

  /* ── ACTIONS ──────────────────────────── */
  jump() {
    if (this.onGround || this.onPlatform) {
      this.vy = this.JUMP_VEL;
      this.onGround   = false;
      this.onPlatform = false;
      return true;
    }
    return false;
  }

  activateDash(speed) {
    this.dashing  = true;
    this.dashTimer = 0.28;         // seconds
    this.dashVX   = speed + 340;  // burst above current scroll speed
  }

  activateImmunity() {
    this.immune      = true;
    this.immuneTimer = 4.5;
  }

  activateGrowth() {
    this.growth      = true;
    this.growthTimer = 5.0;
    this.W = this._baseW * 1.85;
    this.H = this._baseH * 1.85;
    // Reanchor feet to ground
    if (this.onGround)   this.y = this.groundY - this.H;
    if (this.onPlatform) this.y = this.platformY - this.H;
  }

  /* ── UPDATE ───────────────────────────── */
  update(dt, resolvedPlatformY) {
    // -- Power-up timers --
    if (this.immune) {
      this.immuneTimer -= dt;
      if (this.immuneTimer <= 0) { this.immune = false; this.immuneTimer = 0; }
      this.flickerPhase += dt * 18;
    }

    if (this.dashing) {
      this.dashTimer -= dt;
      if (this.dashTimer <= 0) { this.dashing = false; this.dashTimer = 0; this.dashVX = 0; }
    }

    if (this.growth) {
      this.growthTimer -= dt;
      if (this.growthTimer <= 0) {
        this.growth = false; this.growthTimer = 0;
        this.W = this._baseW; this.H = this._baseH;
        if (this.onGround)   this.y = this.groundY - this.H;
        if (this.onPlatform && this.platformY) this.y = this.platformY - this.H;
      }
    }

    // -- Gravity --
    this.vy = Math.min(this.vy + this.GRAVITY * dt, this.MAX_FALL);

    // -- Vertical movement --
    this.y += this.vy * dt;

    // -- Dash: slight upward micro-boost --
    if (this.dashing) {
      this.y -= 55 * dt; // cosmetic lift
    }

    // -- Ground collision --
    this.onGround = false;
    if (this.y + this.H >= this.groundY) {
      this.y = this.groundY - this.H;
      this.vy = 0;
      this.onGround = true;
      this.onPlatform = false;
    }

    // -- Platform collision (resolved externally) --
    if (!this.onGround && resolvedPlatformY !== null) {
      // Only land if descending and feet are near the top surface
      if (this.vy >= 0 && this.y + this.H >= resolvedPlatformY - 2 && this.y + this.H <= resolvedPlatformY + 22) {
        this.y          = resolvedPlatformY - this.H;
        this.vy         = 0;
        this.onPlatform = true;
        this.platformY  = resolvedPlatformY;
        this.onGround   = false;
      }
    }
    if (resolvedPlatformY === null && !this.onGround) {
      this.onPlatform = false;
      this.platformY  = null;
    }

    // -- Trail --
    this.trail.push({ x: this.x + this.W / 2, y: this.y + this.H / 2, age: 0 });
    this.trail = this.trail.filter(p => { p.age += dt; return p.age < 0.18; });
  }

  /* ── HITBOX ───────────────────────────── */
  hitbox() {
    const m = 5; // margin — slightly forgiving
    return { x: this.x + m, y: this.y + m, w: this.W - m*2, h: this.H - m*2 };
  }

  /* ── RENDER ───────────────────────────── */
  draw(ctx, hue) {
    const cx = this.x + this.W / 2;
    const cy = this.y + this.H / 2;

    // -- Trail --
    for (const p of this.trail) {
      const a = (1 - p.age / 0.18) * 0.3;
      const r = this.W * 0.38 * (1 - p.age / 0.18);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = `hsl(${hue}, 100%, 65%)`;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, r, r * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // -- Glow halo --
    const shouldFlicker = this.immune && Math.sin(this.flickerPhase) > 0;
    const glowCol = this.growth
      ? `hsl(30, 100%, 65%)`
      : this.immune
        ? `hsl(55, 100%, 65%)`
        : `hsl(${hue}, 100%, 65%)`;

    if (this.immune || this.growth) {
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, this.W * 2.2);
      grad.addColorStop(0, glowCol.replace(')', ', 0.45)').replace('hsl', 'hsla'));
      grad.addColorStop(1, 'transparent');
      ctx.save();
      ctx.globalAlpha = shouldFlicker ? 0.2 : 0.8;
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(cx, cy, this.W * 2.2, this.H * 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // -- Body (skip draw on flicker frames for immune) --
    if (this.immune && shouldFlicker) return;

    ctx.save();
    const bodyCol = this.growth
      ? `hsl(30, 100%, 62%)`
      : this.dashing
        ? `hsl(${hue + 40}, 100%, 70%)`
        : `hsl(${hue}, 90%, 62%)`;

    ctx.shadowColor = bodyCol;
    ctx.shadowBlur  = this.growth ? 24 : this.immune ? 16 : 10;
    ctx.fillStyle   = bodyCol;

    // Angular geometric body shape
    const bx = this.x, by = this.y, bw = this.W, bh = this.H;
    ctx.beginPath();
    ctx.moveTo(bx + 5, by);
    ctx.lineTo(bx + bw, by + 5);
    ctx.lineTo(bx + bw, by + bh - 5);
    ctx.lineTo(bx + bw - 5, by + bh);
    ctx.lineTo(bx, by + bh - 5);
    ctx.lineTo(bx, by + 5);
    ctx.closePath();
    ctx.fill();

    // Visor strip
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(bx + bw * 0.38, by + bh * 0.2, bw * 0.48, bh * 0.24);

    const visorGlow = this.growth ? '#ff9500' : this.immune ? '#ffe600' : `hsl(${hue+120}, 100%, 75%)`;
    ctx.fillStyle   = visorGlow;
    ctx.shadowColor = visorGlow;
    ctx.shadowBlur  = 10;
    ctx.fillRect(bx + bw * 0.40, by + bh * 0.22, bw * 0.44, bh * 0.20);

    ctx.restore();
  }
}
