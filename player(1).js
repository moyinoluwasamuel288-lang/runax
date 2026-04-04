/* ── RUNΔX · player.js ────────────────────────────────
   Player entity: rendering, physics, jump logic
──────────────────────────────────────────────────────── */

const Player = (() => {

  /* ── Constants ── */
  const BASE_JUMP_VEL = -620;
  const BASE_GRAVITY  = 1800;
  const SIZE_W        = 26;
  const SIZE_H        = 28;

  /* ── State ── */
  let x, y, vy;
  let onGround     = false;
  let alive        = true;
  let groundY      = 0;

  /* ── Visual ── */
  let trailPoints  = [];
  let deathTimer   = 0;
  let landSquash   = 1;    // squash on landing
  let jumpStretch  = 1;    // stretch on jump
  let tiltAngle    = 0;    // tilt during fall

  /* ── Jump tracking ── */
  let lastObstacleVisibleTs = 0;

  /* ── Chaos inversion flag ── */
  // When true, pressing jump does nothing (inverted: "don't jump" is the new jump).
  // The chaos WARNING gives the player 2 s to read the UI badge before this kicks in.
  let jumpInverted = false;

  /* ─────────────────────────────────────────────────── */

  function init(canvasH) {
    groundY  = canvasH * 0.72;
    x        = canvasH * 0.15;   // fixed horizontal position
    y        = groundY;
    vy       = 0;
    onGround = true;
    alive    = true;
    trailPoints  = [];
    deathTimer   = 0;
    landSquash   = 1;
    jumpStretch  = 1;
    tiltAngle    = 0;
    lastObstacleVisibleTs = 0;
    jumpInverted = false;
  }

  function setObstacleVisible(ts) {
    lastObstacleVisibleTs = ts;
  }

  function jump() {
    if (!alive) return false;
    if (!onGround) return false;  // no double jump

    // During chaos ACTIVE the controls are inverted: pressing jump suppresses
    // the jump for this frame. The player must NOT press to jump obstacles.
    // Because the WARNING phase gives 2 s of visual/audio heads-up, this is fair.
    if (jumpInverted) {
      // Give a small visual feedback so the player knows the press was read
      Engine.flash('#3b8fff', 0.12);
      return false;
    }

    const mods    = AISystem.getPhysicsMods();
    const jumpVel = BASE_JUMP_VEL * mods.jumpMod;

    vy       = jumpVel;
    onGround = false;
    jumpStretch = 0.65;

    AISystem.recordJump(lastObstacleVisibleTs);
    lastObstacleVisibleTs = 0;

    Engine.playJump();
    return true;
  }

  function die() {
    if (!alive) return;
    alive     = false;
    deathTimer = 1.2;
    Engine.playDeath();
    Engine.shake(14, 420);
    Engine.flash('#ff3b3b', 0.6);
    AISystem.recordDeath(x);
  }

  function update(dt) {
    if (!alive) {
      deathTimer = Math.max(0, deathTimer - dt);
      return;
    }

    const mods    = AISystem.getPhysicsMods();
    const gravity = BASE_GRAVITY * mods.gravityMod;

    // Physics — apply gravity then integrate position
    vy += gravity * dt;
    y  += vy * dt;

    // Ground collision — clamp unconditionally every frame.
    // This is the authoritative ground check: y must NEVER exceed groundY.
    // We do NOT gate this behind !onGround so that accumulated velocity
    // across a large dt frame cannot push the player below the floor.
    if (y >= groundY) {
      const wasAirborne = !onGround;  // true on the landing frame
      y        = groundY;             // hard clamp — can never fall through
      vy       = 0;                   // kill all downward velocity immediately
      onGround = true;
      if (wasAirborne) {
        landSquash = 0.55;            // squash only triggers once on touchdown
        Engine.playLand();
      }
    } else {
      onGround = false;
    }

    // Visual squash/stretch recovery
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

  function draw(ctx) {
    if (!alive && deathTimer <= 0) return;

    const alpha = alive ? 1 : Math.min(1, deathTimer / 0.3);

    // Draw trail
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

    // Draw player body
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

    // Body — glowing rectangle
    const grad = ctx.createLinearGradient(-sw / 2, -sh, sw / 2, 0);
    grad.addColorStop(0, '#ff6060');
    grad.addColorStop(1, '#cc1010');
    ctx.fillStyle = grad;
    ctx.shadowColor  = '#ff3b3b';
    ctx.shadowBlur   = 18;

    // Rounded rectangle
    _roundRect(ctx, -sw / 2, -sh, sw, sh, 4);
    ctx.fill();

    // Eye (single glowing dot)
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

  /* Bounding box for collision */
  function getBounds() {
    const margin = 4; // slightly forgiving
    return {
      x: x - SIZE_W / 2 + margin,
      y: y - SIZE_H,
      w: SIZE_W - margin * 2,
      h: SIZE_H - 2,
    };
  }

  function isAlive()          { return alive; }
  function getPos()           { return { x, y }; }
  function getGroundY()       { return groundY; }
  function isDying()          { return !alive && deathTimer > 0; }
  function setJumpInverted(v) { jumpInverted = v; }

  // Update the floor reference mid-game (e.g. on window resize).
  // If the player is currently on the old ground, snap them to the new one.
  function setGroundY(newGY) {
    const wasOnGround = onGround;
    groundY = newGY;
    if (wasOnGround) {
      y  = groundY;
      vy = 0;
    }
  }

  return {
    init, jump, die, update, draw,
    getBounds, isAlive, getPos, getGroundY, isDying,
    setObstacleVisible, setGroundY, setJumpInverted,
  };
})();
