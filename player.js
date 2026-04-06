// player.js — Player entity
export class Player {
  constructor(canvas) {
    this.canvas = canvas;
    this.reset();
  }

  reset() {
    this.canvas_h = this.canvas.height;
    this.GROUND_Y = this.canvas.height * 0.72;

    this.w = 32;
    this.h = 36;
    this.x = this.canvas.width * 0.15;
    this.y = this.GROUND_Y - this.h;

    this.vy = 0;
    this.vx = 0; // for dash
    this.gravity = 2200;       // px/s²
    this.jumpVelocity = -820;  // px/s  — fixed, no randomness
    this.maxFallSpeed = 1400;

    this.onGround = false;
    this.onPlatform = false;
    this.platformRef = null;

    // Power-up state
    this.immune = false;
    this.immuneTimer = 0;
    this.immuneDuration = 4000;

    this.growth = false;
    this.growthTimer = 0;
    this.growthDuration = 5000;
    this.baseW = 32;
    this.baseH = 36;

    this.dashActive = false;
    this.dashTimer = 0;
    this.dashDuration = 300;
    this.dashVX = 480;

    this.dead = false;
    this.jumpRequested = false;

    // Visual
    this.trailPoints = [];
    this.glowIntensity = 0;
  }

  onResize() {
    this.GROUND_Y = this.canvas.height * 0.72;
    if (this.onGround) this.y = this.GROUND_Y - this.h;
  }

  requestJump() {
    this.jumpRequested = true;
  }

  applyDash() {
    this.dashActive = true;
    this.dashTimer = this.dashDuration;
    this.vy = Math.min(this.vy, -200); // slight upward boost
  }

  applyImmunity() {
    this.immune = true;
    this.immuneTimer = this.immuneDuration;
  }

  applyGrowth() {
    this.growth = true;
    this.growthTimer = this.growthDuration;
    this.w = this.baseW * 1.8;
    this.h = this.baseH * 1.8;
    // Reposition so feet stay on ground
    if (this.onGround) this.y = this.GROUND_Y - this.h;
  }

  update(delta, platformY) {
    const dt = delta / 1000;

    // Power-up timers
    if (this.immune) {
      this.immuneTimer -= delta;
      if (this.immuneTimer <= 0) { this.immune = false; this.immuneTimer = 0; }
    }

    if (this.growth) {
      this.growthTimer -= delta;
      if (this.growthTimer <= 0) {
        this.growth = false;
        this.growthTimer = 0;
        this.w = this.baseW;
        this.h = this.baseH;
        if (this.onGround) this.y = this.GROUND_Y - this.h;
      }
    }

    if (this.dashActive) {
      this.dashTimer -= delta;
      if (this.dashTimer <= 0) { this.dashActive = false; this.dashTimer = 0; this.vx = 0; }
    }

    // Jump
    if (this.jumpRequested && (this.onGround || this.onPlatform)) {
      this.vy = this.jumpVelocity;
      this.onGround = false;
      this.onPlatform = false;
      this.platformRef = null;
    }
    this.jumpRequested = false;

    // Gravity
    this.vy += this.gravity * dt;
    if (this.vy > this.maxFallSpeed) this.vy = this.maxFallSpeed;

    // Horizontal dash movement (cosmetic — player x shifts slightly)
    if (this.dashActive) {
      this.x += this.dashVX * dt;
      // Clamp to max 30% of screen
      const maxX = this.canvas.width * 0.30;
      if (this.x > maxX) this.x = maxX;
    } else {
      // Drift back to home
      const homeX = this.canvas.width * 0.15;
      if (this.x > homeX) {
        this.x -= 200 * dt;
        if (this.x < homeX) this.x = homeX;
      }
    }

    // Move vertically
    this.y += this.vy * dt;

    // Ground collision first
    const groundLine = this.GROUND_Y;
    this.onGround = false;
    if (this.y + this.h >= groundLine) {
      this.y = groundLine - this.h;
      this.vy = 0;
      this.onGround = true;
    }

    // Platform landing (passed in from collision system)
    this.onPlatform = false;
    if (!this.onGround && platformY !== null && platformY !== undefined) {
      // Player descending and feet near platform top
      if (this.vy >= 0 &&
          this.y + this.h >= platformY &&
          this.y + this.h <= platformY + 28) {
        this.y = platformY - this.h;
        this.vy = 0;
        this.onPlatform = true;
      }
    }

    // Trail
    this.trailPoints.push({ x: this.x + this.w / 2, y: this.y + this.h / 2, age: 0 });
    if (this.trailPoints.length > 12) this.trailPoints.shift();
    this.trailPoints.forEach(p => p.age += delta);

    // Glow pulse
    this.glowIntensity = this.immune
      ? 0.7 + 0.3 * Math.sin(Date.now() * 0.01)
      : (this.growth ? 0.5 : 0.2);
  }

  getHitbox() {
    const margin = 4;
    return {
      x: this.x + margin,
      y: this.y + margin,
      w: this.w - margin * 2,
      h: this.h - margin * 2
    };
  }

  draw(ctx, hue) {
    const cx = this.x + this.w / 2;
    const cy = this.y + this.h / 2;

    // Trail
    this.trailPoints.forEach((p, i) => {
      const alpha = (i / this.trailPoints.length) * 0.35;
      const size = this.w * 0.3 * (i / this.trailPoints.length);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = `hsl(${hue}, 100%, 65%)`;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, size, size * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Glow
    const glowColor = this.immune
      ? `hsl(${hue + 60}, 100%, 70%)`
      : this.growth
        ? `hsl(30, 100%, 65%)`
        : `hsl(${hue}, 100%, 65%)`;

    if (this.glowIntensity > 0) {
      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, this.w * 1.8);
      grd.addColorStop(0, glowColor.replace(')', `, ${this.glowIntensity})`).replace('hsl', 'hsla'));
      grd.addColorStop(1, 'transparent');
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.ellipse(cx, cy, this.w * 1.8, this.h * 1.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Body
    ctx.save();
    const bodyColor = this.immune
      ? `hsl(${hue + 60}, 100%, 75%)`
      : this.growth
        ? `hsl(30, 100%, 65%)`
        : `hsl(${hue}, 90%, 65%)`;

    ctx.fillStyle = bodyColor;
    ctx.shadowColor = bodyColor;
    ctx.shadowBlur = this.immune ? 20 : 10;

    // Draw as a geometric angular shape (not plain rect)
    const bx = this.x, by = this.y, bw = this.w, bh = this.h;
    ctx.beginPath();
    ctx.moveTo(bx + 4, by);
    ctx.lineTo(bx + bw, by + 4);
    ctx.lineTo(bx + bw, by + bh - 4);
    ctx.lineTo(bx + bw - 4, by + bh);
    ctx.lineTo(bx, by + bh - 4);
    ctx.lineTo(bx, by + 4);
    ctx.closePath();
    ctx.fill();

    // Eye / visor
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(bx + bw * 0.4, by + bh * 0.2, bw * 0.45, bh * 0.22);

    ctx.fillStyle = this.immune ? '#fff' : `hsl(${hue + 120}, 100%, 80%)`;
    ctx.shadowBlur = 8;
    ctx.shadowColor = ctx.fillStyle;
    ctx.fillRect(bx + bw * 0.42, by + bh * 0.22, bw * 0.4, bh * 0.18);

    ctx.restore();
  }
}
