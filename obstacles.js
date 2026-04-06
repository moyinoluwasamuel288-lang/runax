// obstacles.js — Obstacle & Power-up management
export class ObstacleManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.reset();
  }

  reset() {
    this.obstacles = [];
    this.powerups = [];
    this.particles = [];
    this.spawnTimer = 0;
    this.spawnInterval = 1800; // ms
    this.minSpawnInterval = 800;
    this.powerupTimer = 0;
    this.powerupInterval = 7000;
    this.speed = 380; // px/s
    this.maxSpeed = 780;
    this.lastObstacleX = this.canvas.width + 200;
  }

  onResize() {
    // Recalc ground ref
  }

  get GROUND_Y() { return this.canvas.height * 0.72; }

  // Predict where player will land given current state
  _playerLandX(player) {
    if (player.onGround || player.onPlatform) return player.x;
    // Simple projectile: solve y + vy*t + 0.5*g*t² = groundY - playerH
    const vy = player.vy;
    const g = player.gravity;
    const dy = (player.GROUND_Y - player.h) - player.y;
    // quadratic: 0.5*g*t² + vy*t - dy = 0
    const a = 0.5 * g;
    const b = vy;
    const c = -dy;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return player.x;
    const t = (-b + Math.sqrt(disc)) / (2 * a);
    return player.x + (t > 0 ? 0 : 0); // player x is stable
  }

  _isTooClose(x) {
    for (const obs of this.obstacles) {
      if (Math.abs(obs.x - x) < 180) return true;
    }
    return false;
  }

  _wouldBlockLanding(player) {
    // Check if player is in air and about to land in danger zone
    if (player.onGround || player.onPlatform) return false;
    const landZoneStart = player.x - 20;
    const landZoneEnd = player.x + player.w + 100;
    for (const obs of this.obstacles) {
      if (obs.x + obs.w > landZoneStart && obs.x < landZoneEnd) {
        if (obs.type !== 'platform') return true;
      }
    }
    return false;
  }

  spawnObstacle(player, gameSpeed) {
    // Don't spawn if player is mid-air and landing zone is right here
    if (this._wouldBlockLanding(player)) return;

    const spawnX = this.canvas.width + 60;
    if (this._isTooClose(spawnX)) return;

    const rand = Math.random();
    let type;

    if (rand < 0.40) type = 'block';
    else if (rand < 0.62) type = 'spike';
    else if (rand < 0.80) type = 'tall';
    else if (rand < 0.92) type = 'platform'; // purple hovering
    else type = 'double';

    const gY = this.GROUND_Y;

    switch (type) {
      case 'block': {
        const h = 30 + Math.random() * 20;
        this.obstacles.push({
          type: 'block', x: spawnX, y: gY - h, w: 30, h,
          color: null // will use hue
        });
        break;
      }
      case 'spike': {
        const count = 1 + Math.floor(Math.random() * 3);
        for (let i = 0; i < count; i++) {
          this.obstacles.push({
            type: 'spike', x: spawnX + i * 22, y: gY - 28, w: 20, h: 28,
            color: null
          });
        }
        break;
      }
      case 'tall': {
        const h = 55 + Math.random() * 20;
        this.obstacles.push({
          type: 'tall', x: spawnX, y: gY - h, w: 24, h,
          color: null
        });
        break;
      }
      case 'platform': {
        // Purple floating platform — player can land on top
        const pw = 50 + Math.random() * 30;
        const floatH = 80 + Math.random() * 60; // height above ground
        this.obstacles.push({
          type: 'platform',
          x: spawnX, y: gY - floatH - 14, w: pw, h: 14,
          platformTop: gY - floatH - 14,
          color: '#b06aff'
        });
        break;
      }
      case 'double': {
        // Two blocks with gap — ensure gap is jumpable (just skip it actually — spawn separately)
        const h1 = 30 + Math.random() * 15;
        this.obstacles.push({
          type: 'block', x: spawnX, y: gY - h1, w: 28, h: h1, color: null
        });
        // Second block far enough apart
        const gap = 160 + Math.random() * 60;
        const h2 = 28 + Math.random() * 15;
        this.obstacles.push({
          type: 'block', x: spawnX + gap, y: gY - h2, w: 28, h: h2, color: null
        });
        break;
      }
    }
  }

  spawnChaosSpike(player) {
    // Rare challenge spike after player jumps — must still be avoidable
    // Spawn slightly ahead so player sees it in time
    const spawnX = this.canvas.width * 0.55;
    if (this._isTooClose(spawnX)) return;
    const gY = this.GROUND_Y;
    this.obstacles.push({
      type: 'spike', x: spawnX, y: gY - 28, w: 20, h: 28, color: null, chaos: true
    });
  }

  spawnPowerup() {
    const spawnX = this.canvas.width + 60;
    const types = ['dash', 'immunity', 'growth'];
    const t = types[Math.floor(Math.random() * types.length)];
    const gY = this.GROUND_Y;
    // Float above ground
    this.powerups.push({
      type: t,
      x: spawnX,
      y: gY - 80 - Math.random() * 60,
      w: 24, h: 24,
      pulse: Math.random() * Math.PI * 2
    });
  }

  addExplosion(x, y, hue) {
    const count = 18;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const speed = 120 + Math.random() * 180;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 80,
        life: 600 + Math.random() * 300,
        maxLife: 900,
        size: 3 + Math.random() * 5,
        hue: hue + Math.random() * 40 - 20
      });
    }
  }

  update(delta, speed, player, hue) {
    const dt = delta / 1000;
    const spd = speed;

    // Move obstacles
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      obs.x -= spd * dt;
      if (obs.x + obs.w < -20) {
        this.obstacles.splice(i, 1);
      }
    }

    // Move powerups
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const pu = this.powerups[i];
      pu.x -= spd * dt;
      pu.pulse += delta * 0.003;
      if (pu.x + pu.w < -20) this.powerups.splice(i, 1);
    }

    // Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 300 * dt;
      p.life -= delta;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    return this._checkCollisions(player, hue);
  }

  _rectOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  _checkCollisions(player, hue) {
    const result = { dead: false, platformY: null, powerup: null, explosions: [] };
    const hb = player.getHitbox();

    // Platform collision (top landing)
    for (const obs of this.obstacles) {
      if (obs.type !== 'platform') continue;
      const prevBottom = hb.y + hb.h - (player.vy / 60 + 2); // approximate prev pos
      const onTop = player.vy >= 0 &&
        hb.x + hb.w > obs.x + 4 &&
        hb.x < obs.x + obs.w - 4 &&
        hb.y + hb.h >= obs.y &&
        hb.y + hb.h <= obs.y + obs.h + 20 &&
        hb.y < obs.y;

      if (onTop) {
        result.platformY = obs.y;
        player.platformRef = obs;
      } else if (this._rectOverlap(hb.x, hb.y, hb.w, hb.h, obs.x, obs.y, obs.w, obs.h)) {
        // Side collision with platform
        if (!player.immune) {
          result.dead = true;
        }
      }
    }

    // Regular obstacles
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      if (obs.type === 'platform') continue;

      if (!this._rectOverlap(hb.x, hb.y, hb.w, hb.h, obs.x, obs.y, obs.w, obs.h)) continue;

      if (player.growth) {
        // Destroy obstacle
        result.explosions.push({ x: obs.x + obs.w / 2, y: obs.y + obs.h / 2, hue });
        this.obstacles.splice(i, 1);
      } else if (!player.immune) {
        result.dead = true;
        break;
      }
    }

    // Powerup collection
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const pu = this.powerups[i];
      if (this._rectOverlap(hb.x, hb.y, hb.w, hb.h, pu.x, pu.y, pu.w, pu.h)) {
        result.powerup = pu.type;
        this.powerups.splice(i, 1);
        break;
      }
    }

    return result;
  }

  draw(ctx, hue, speed) {
    const gY = this.GROUND_Y;

    // Particles
    this.particles.forEach(p => {
      const alpha = p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = `hsl(${p.hue}, 100%, 65%)`;
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Obstacles
    this.obstacles.forEach(obs => {
      ctx.save();
      switch (obs.type) {
        case 'block':
        case 'double': {
          const col = `hsl(${hue + 180}, 80%, 55%)`;
          ctx.fillStyle = col;
          ctx.shadowColor = col;
          ctx.shadowBlur = 12;
          ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
          // Edge highlight
          ctx.strokeStyle = `hsl(${hue + 180}, 100%, 80%)`;
          ctx.lineWidth = 1;
          ctx.strokeRect(obs.x + 0.5, obs.y + 0.5, obs.w - 1, obs.h - 1);
          break;
        }
        case 'spike': {
          const col = `hsl(${hue + 220}, 100%, 60%)`;
          ctx.fillStyle = col;
          ctx.shadowColor = col;
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.moveTo(obs.x, gY);
          ctx.lineTo(obs.x + obs.w / 2, obs.y);
          ctx.lineTo(obs.x + obs.w, gY);
          ctx.closePath();
          ctx.fill();
          break;
        }
        case 'tall': {
          const col = `hsl(${hue + 150}, 70%, 50%)`;
          ctx.fillStyle = col;
          ctx.shadowColor = col;
          ctx.shadowBlur = 14;
          ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
          ctx.strokeStyle = `hsl(${hue + 150}, 100%, 75%)`;
          ctx.lineWidth = 1;
          ctx.strokeRect(obs.x + 0.5, obs.y + 0.5, obs.w - 1, obs.h - 1);
          break;
        }
        case 'platform': {
          // Purple hovering platform
          const pulse = 0.7 + 0.3 * Math.sin(Date.now() * 0.003);
          ctx.fillStyle = '#b06aff';
          ctx.shadowColor = '#b06aff';
          ctx.shadowBlur = 20 * pulse;
          ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
          // Top highlight
          ctx.fillStyle = 'rgba(220,180,255,0.6)';
          ctx.fillRect(obs.x + 2, obs.y + 1, obs.w - 4, 3);
          // Glow underglow
          const grd = ctx.createLinearGradient(obs.x, obs.y + obs.h, obs.x, obs.y + obs.h + 20);
          grd.addColorStop(0, 'rgba(176,106,255,0.4)');
          grd.addColorStop(1, 'transparent');
          ctx.fillStyle = grd;
          ctx.fillRect(obs.x - 4, obs.y + obs.h, obs.w + 8, 20);
          break;
        }
      }
      ctx.restore();
    });

    // Power-ups
    this.powerups.forEach(pu => {
      ctx.save();
      const bob = Math.sin(pu.pulse) * 6;
      const cy = pu.y + pu.h / 2 + bob;
      const cx = pu.x + pu.w / 2;

      let col, label;
      switch (pu.type) {
        case 'dash':      col = `hsl(180, 100%, 60%)`; label = '⚡'; break;
        case 'immunity':  col = `hsl(60, 100%, 65%)`;  label = '◈'; break;
        case 'growth':    col = `hsl(30, 100%, 60%)`;  label = '▲'; break;
      }

      // Outer ring
      ctx.strokeStyle = col;
      ctx.shadowColor = col;
      ctx.shadowBlur = 18;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 16, 0, Math.PI * 2);
      ctx.stroke();

      // Inner fill
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(cx, cy, 14, 0, Math.PI * 2);
      ctx.fill();

      // Label
      ctx.globalAlpha = 1;
      ctx.fillStyle = col;
      ctx.shadowBlur = 8;
      ctx.font = '13px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, cx, cy);

      ctx.restore();
    });
  }

  // For AI: get nearest upcoming obstacle info
  getNextObstacle(playerX) {
    let nearest = null;
    let minDist = Infinity;
    for (const obs of this.obstacles) {
      if (obs.type === 'platform') continue;
      const dist = obs.x - playerX;
      if (dist > -20 && dist < minDist) {
        minDist = dist;
        nearest = obs;
      }
    }
    return nearest;
  }
}
