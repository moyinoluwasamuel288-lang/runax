// js/player.js

class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;

        this.width = 40;
        this.height = 40;
    }

    moveLeft() {
        this.x -= 40;
    }

    moveRight() {
        this.x += 40;
    }

    draw(ctx) {
        ctx.fillStyle = "white";
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}/* ── RUNΔX · player.js ────────────────────────────────
   Player entity: rendering, physics, jump logic.
   Controls are NEVER inverted — that mechanic has been
   fully removed from Chaos Mode.
──────────────────────────────────────────────────────── */

const Player = (() => {

  /* ── Constants ── */
  const BASE_JUMP_VEL = -620;
  const BASE_GRAVITY  = 1800;
  const SIZE_W        = 26;
  const SIZE_H        = 28;

  /* ── State ── */
  let x, y, vy;
  let onGround = false;
  let alive    = true;
  let groundY  = 0;

  /* ── Visual ── */
  let trailPoints = [];
  let deathTimer  = 0;
  let landSquash  = 1;   // squash on landing
  let jumpStretch = 1;   // stretch on jump
  let tiltAngle   = 0;   // forward lean during fall

  /* ── Death particles ─────────────────────────────────
     20 sparks burst from the player's centre on death.
     Each has a random velocity, size, colour hue offset,
     and alpha that fades over ~0.6 s. Purely cosmetic.
  ──────────────────────────────────────────────────────── */
  let deathParticles = [];

  function _spawnDeathParticles(px, py) {
    deathParticles = [];
    for (let i = 0; i < 22; i++) {
      const angle = (Math.PI * 2 * i) / 22 + (Math.random() - 0.5) * 0.4;
      const speed = 80 + Math.random() * 200;
      deathParticles.push({
        x:  px, y:  py - SIZE_H / 2,   // emit from player centre
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60, // slight upward bias
        size:  2 + Math.random() * 4,
        alpha: 0.9 + Math.random() * 0.1,
        // hue shift: mostly red (0) with some orange-yellow splashes
        hue: Math.random() < 0.7 ? 0 : 20 + Math.random() * 20,
      });
    }
  }

  /* ── Reaction timing ── */
  let lastObstacleVisibleTs = 0;

  /* ─────────────────────────────────────────────────── */

  function init(canvasH) {
    groundY  = canvasH * 0.72;
    x        = canvasH * 0.15;
    y        = groundY;
    vy       = 0;
    onGround = true;
    alive    = true;
    trailPoints             = [];
    deathTimer              = 0;
    landSquash              = 1;
    jumpStretch             = 1;
    tiltAngle               = 0;
    lastObstacleVisibleTs   = 0;
    deathParticles          = [];
  }

  function setObstacleVisible(ts) {
    lastObstacleVisibleTs = ts;
  }

  /* ── Jump ── */
  function jump() {
    if (!alive)    return false;
    if (!onGround) return false;   // no double-jump

    const mods    = AISystem.getPhysicsMods();
    const jumpVel = BASE_JUMP_VEL * mods.jumpMod;

    vy          = jumpVel;
    onGround    = false;
    jumpStretch = 0.65;

    AISystem.recordJump(lastObstacleVisibleTs);
    lastObstacleVisibleTs = 0;

    Engine.playJump();
    return true;
  }

  /* ── Death ── */
  function die() {
    if (!alive) return;
    alive      = false;
    deathTimer = 1.2;
    _spawnDeathParticles(x, y);
    Engine.playDeath();
    Engine.shake(14, 420);
    Engine.flash('#ff3b3b', 0.6);
    AISystem.recordDeath(x);
  }

  /* ── Physics update ── */
  function update(dt) {
    if (!alive) {
      deathTimer = Math.max(0, deathTimer - dt);
      // Integrate death particles
      const GRAV = 400;
      deathParticles.forEach(p => {
        p.x    += p.vx * dt;
        p.y    += p.vy * dt;
        p.vy   += GRAV * dt;      // gravity pulls sparks down
        p.vx   *= 1 - dt * 2.5;  // air drag damps horizontal velocity
        p.alpha -= dt * 1.6;
      });
      deathParticles = deathParticles.filter(p => p.alpha > 0);
      return;
    }

    const mods    = AISystem.getPhysicsMods();
    const gravity = BASE_GRAVITY * mods.gravityMod;

    vy += gravity * dt;
    y  += vy * dt;

    // Hard clamp — unconditional every frame.
    // Accumulated gravity across a large dt frame must never push
    // the player through the floor.
    if (y >= groundY) {
      const wasAirborne = !onGround;
      y        = groundY;
      vy       = 0;
      onGround = true;
      if (wasAirborne) {
        landSquash = 0.55;
        Engine.playLand();
      }
    } else {
      onGround = false;
    }

    // Squash/stretch recovery
    landSquash  += (1 - landSquash)  * dt * 14;
    jumpStretch += (1 - jumpStretch) * dt * 10;

    // Tilt: lean forward when falling
    const tiltTarget = onGround ? 0 : Math.min(0.35, vy / 2000);
    tiltAngle += (tiltTarget - tiltAngle) * dt * 8;

    // Trail
    trailPoints.unshift({ x, y, alpha: 0.6 });
    if (trailPoints.length > 14) trailPoints.pop();
    trailPoints.forEach(p => { p.alpha -= dt * 2; });
  }

  /* ── Draw ── */
  function draw(ctx) {
    // Always draw particles even when fully dead (they outlive the body)
    deathParticles.forEach(p => {
      if (p.alpha <= 0) return;
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.shadowColor = `hsl(${p.hue},100%,60%)`;
      ctx.shadowBlur  = 8;
      ctx.fillStyle   = `hsl(${p.hue},100%,65%)`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    if (!alive && deathTimer <= 0) return;

    const alpha = alive ? 1 : Math.min(1, deathTimer / 0.3);

    // Trail
    trailPoints.forEach((p, i) => {
      const ta = Math.max(0, p.alpha) * alpha * 0.5;
      if (ta <= 0) return;
      ctx.save();
      ctx.globalAlpha = ta;
      ctx.fillStyle   = '#ff3b3b';
      const scale = 1 - (i / trailPoints.length) * 0.6;
      const tw    = SIZE_W * scale * 0.7;
      const th    = SIZE_H * scale * 0.7;
      ctx.fillRect(p.x - tw / 2, p.y - th, tw, th);
      ctx.restore();
    });

    // Body
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(tiltAngle);

    const sw = SIZE_W * (onGround ? landSquash + (1 - landSquash) : jumpStretch);
    const sh = SIZE_H / (onGround ? landSquash + (1 - landSquash) : jumpStretch);

    // Shadow
    ctx.globalAlpha = alpha * 0.25;
    ctx.fillStyle   = '#ff3b3b';
    ctx.beginPath();
    ctx.ellipse(0, 4, sw * 0.7, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = alpha;

    // Body gradient
    const grad = ctx.createLinearGradient(-sw / 2, -sh, sw / 2, 0);
    grad.addColorStop(0, '#ff6060');
    grad.addColorStop(1, '#cc1010');
    ctx.fillStyle    = grad;
    ctx.shadowColor  = '#ff3b3b';
    ctx.shadowBlur   = 18;
    _roundRect(ctx, -sw / 2, -sh, sw, sh, 4);
    ctx.fill();

    // Eye
    ctx.shadowBlur  = 8;
    ctx.shadowColor = '#fff';
    ctx.fillStyle   = '#ffffff';
    ctx.beginPath();
    ctx.arc(sw * 0.18, -sh * 0.72, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Pupil
    ctx.fillStyle = '#080c10';
    ctx.beginPath();
    ctx.arc(sw * 0.22, -sh * 0.70, 1.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.restore();
  }

  function _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  /* ── Bounding box (slightly forgiving) ── */
  function getBounds() {
    const margin = 4;
    return {
      x: x - SIZE_W / 2 + margin,
      y: y - SIZE_H,
      w: SIZE_W - margin * 2,
      h: SIZE_H - 2,
    };
  }

  function isAlive()  { return alive; }
  function getPos()   { return { x, y }; }
  function isDying()  { return !alive && deathTimer > 0; }

  // Sync ground reference on window resize without a full re-init
  function setGroundY(newGY) {
    const wasOnGround = onGround;
    groundY = newGY;
    if (wasOnGround) { y = groundY; vy = 0; }
  }

  return {
    init, jump, die, update, draw,
    getBounds, isAlive, getPos, isDying,
    setObstacleVisible, setGroundY,
  };
})();
