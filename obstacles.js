// obstacles.js — Obstacle + Power-up spawning, movement, collision

export class ObstacleManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.reset();
  }

  reset() {
    this.list       = [];   // obstacles
    this.powerups   = [];   // power-up orbs
    this.particles  = [];   // explosion/effect particles
    this.spawnTimer = 0;
    this.puTimer    = 0;
    this.speed      = 390;  // px/s — increases over time
    this.maxSpeed   = 820;
    this._puInterval = 8.5;  // seconds between power-ups
  }

  get groundY()  { return this.canvas.height * 0.72; }

  onResize() { /* groundY is dynamic */ }

  /* ── SPAWN ────────────────────────────── */
  spawnInterval(elapsed) {
    // Gets shorter as game progresses, floors at 0.9s
    return Math.max(0.90, 1.9 - elapsed * 0.018);
  }

  trySpawn(elapsed, player) {
    const interval = this.spawnInterval(elapsed);
    this.spawnTimer += 0; // managed in game.js

    const gY   = this.groundY;
    const offX = this.canvas.width + 80;
    const r    = Math.random();

    // Obstacle type distribution
    let type;
    if      (r < 0.35) type = 'block';
    else if (r < 0.55) type = 'spike';
    else if (r < 0.72) type = 'tall';
    else if (r < 0.87) type = 'platform'; // purple hover
    else               type = 'group';

    switch (type) {
      case 'block': {
        const h = 28 + Math.random() * 22;
        this.list.push({ type:'block', x:offX, y:gY-h, w:32, h, color:null });
        break;
      }
      case 'spike': {
        const n = 1 + Math.floor(Math.random() * 3);
        for (let i=0;i<n;i++) {
          this.list.push({ type:'spike', x:offX + i*24, y:gY-30, w:22, h:30, color:null });
        }
        break;
      }
      case 'tall': {
        const h = 58 + Math.random() * 22;
        this.list.push({ type:'tall', x:offX, y:gY-h, w:26, h, color:null });
        break;
      }
      case 'platform': {
        const pw = 52 + Math.random() * 36;
        const floatH = 76 + Math.random() * 60; // px above ground
        this.list.push({
          type:'platform', x:offX,
          y: gY - floatH - 16,
          w: pw, h: 16,
          color: null
        });
        break;
      }
      case 'group': {
        // Block + spike gap combo
        const bh = 30 + Math.random() * 18;
        this.list.push({ type:'block', x:offX, y:gY-bh, w:28, h:bh, color:null });
        // Second element far enough right to be jumpable
        const gap = 175 + Math.random() * 65;
        const sh  = 28;
        this.list.push({ type:'spike', x:offX+gap, y:gY-sh, w:22, h:sh, color:null });
        break;
      }
    }
  }

  // Surprise spike directly under player (rare ~10%)
  spawnSurpriseSpikeAt(x) {
    const gY = this.groundY;
    // Only spawn if no obstacle is already very close
    const tooClose = this.list.some(o => Math.abs(o.x - x) < 120);
    if (!tooClose) {
      this.list.push({ type:'spike', x: x + 40, y: gY-30, w:22, h:30, color:null, chaos:true });
    }
  }

  spawnPowerup() {
    const types = ['dash','immunity','growth'];
    const t = types[Math.floor(Math.random() * types.length)];
    const gY  = this.groundY;
    const offX = this.canvas.width + 60;
    this.powerups.push({
      type: t,
      x: offX,
      y: gY - 88 - Math.random() * 55,
      w: 26, h: 26,
      spin: 0
    });
  }

  addExplosion(cx, cy, hue, count=22) {
    for (let i=0;i<count;i++) {
      const ang   = (i/count) * Math.PI*2 + Math.random()*0.4;
      const spd   = 110 + Math.random()*190;
      const life  = 0.55 + Math.random()*0.35;
      this.particles.push({
        x:cx, y:cy,
        vx: Math.cos(ang)*spd, vy: Math.sin(ang)*spd - 60,
        life, maxLife:life,
        r: 3 + Math.random()*5,
        hue: hue + Math.random()*50 - 25
      });
    }
  }

  /* ── UPDATE ───────────────────────────── */
  update(dt, player, hue) {
    const spd = this.speed;
    const result = { dead:false, crushed:[], powerup:null, platformY:null };

    // -- Move obstacles --
    for (let i=this.list.length-1; i>=0; i--) {
      const o = this.list[i];
      o.x -= spd * dt;
      if (o.x + o.w < -10) { this.list.splice(i,1); continue; }
    }

    // -- Move power-ups --
    for (let i=this.powerups.length-1; i>=0; i--) {
      const p = this.powerups[i];
      p.x -= spd * dt;
      p.spin += dt * 2.2;
      if (p.x + p.w < -10) { this.powerups.splice(i,1); continue; }
    }

    // -- Particles --
    for (let i=this.particles.length-1; i>=0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 420 * dt; // gravity
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i,1);
    }

    const hb = player.hitbox();

    // -- Platform top resolution (before collision) --
    for (const o of this.list) {
      if (o.type !== 'platform') continue;
      // Player feet approaching platform top from above
      if (player.vy >= 0 &&
          hb.x + hb.w > o.x + 4 &&
          hb.x < o.x + o.w - 4 &&
          hb.y + hb.h >= o.y &&
          hb.y + hb.h <= o.y + o.h + 18 &&
          player.y + player.H - 2 < o.y + o.h) {
        result.platformY = o.y; // safe landing surface
      }
    }

    // -- Collide: regular obstacles --
    for (let i=this.list.length-1; i>=0; i--) {
      const o = this.list[i];

      if (!rectsOverlap(hb, { x:o.x, y:o.y, w:o.w, h:o.h })) continue;

      if (o.type === 'platform') {
        // Only side hit kills (top landing handled above)
        const isTopLanding = player.vy >= 0 && hb.y + hb.h <= o.y + o.h + 10;
        if (!isTopLanding && !player.immune) { result.dead = true; }
        continue;
      }

      if (player.growth) {
        // Growth crushes all non-platform obstacles
        result.crushed.push({ x: o.x + o.w/2, y: o.y + o.h/2 });
        this.list.splice(i, 1);
      } else if (!player.immune) {
        result.dead = true;
        break;
      }
    }

    // -- Collect power-ups --
    for (let i=this.powerups.length-1; i>=0; i--) {
      const p = this.powerups[i];
      if (rectsOverlap(hb, { x:p.x, y:p.y, w:p.w, h:p.h })) {
        result.powerup = p.type;
        this.powerups.splice(i,1);
        break;
      }
    }

    // -- Spawn explosion particles for crushed --
    for (const c of result.crushed) {
      this.addExplosion(c.x, c.y, hue);
    }

    return result;
  }

  /* ── RENDER ───────────────────────────── */
  draw(ctx, hue) {
    const gY = this.groundY;

    // Particles
    for (const p of this.particles) {
      const alpha = p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle   = `hsl(${p.hue}, 100%, 65%)`;
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur  = 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * alpha, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    }

    // Obstacles
    for (const o of this.list) {
      ctx.save();
      switch (o.type) {
        case 'block':
        case 'tall': {
          const col = `hsl(${hue+170}, 75%, 52%)`;
          ctx.fillStyle   = col;
          ctx.shadowColor = col;
          ctx.shadowBlur  = 14;
          ctx.fillRect(o.x, o.y, o.w, o.h);
          ctx.strokeStyle = `hsl(${hue+170}, 100%, 78%)`;
          ctx.lineWidth   = 1;
          ctx.strokeRect(o.x+0.5, o.y+0.5, o.w-1, o.h-1);
          break;
        }
        case 'spike': {
          const col = `hsl(${hue+210}, 100%, 60%)`;
          ctx.fillStyle   = col;
          ctx.shadowColor = col;
          ctx.shadowBlur  = 12;
          ctx.beginPath();
          ctx.moveTo(o.x, gY);
          ctx.lineTo(o.x + o.w/2, o.y);
          ctx.lineTo(o.x + o.w, gY);
          ctx.closePath();
          ctx.fill();
          break;
        }
        case 'platform': {
          // Purple hovering platform
          const pulse = 0.75 + 0.25 * Math.sin(Date.now() * 0.0035);
          ctx.fillStyle   = '#c084fc';
          ctx.shadowColor = '#c084fc';
          ctx.shadowBlur  = 22 * pulse;
          ctx.fillRect(o.x, o.y, o.w, o.h);
          // Surface highlight
          ctx.fillStyle = 'rgba(240,220,255,0.55)';
          ctx.fillRect(o.x+2, o.y+1, o.w-4, 4);
          // Underglow drip
          const grd = ctx.createLinearGradient(o.x, o.y+o.h, o.x, o.y+o.h+22);
          grd.addColorStop(0, 'rgba(192,132,252,0.45)');
          grd.addColorStop(1, 'transparent');
          ctx.fillStyle = grd;
          ctx.fillRect(o.x-3, o.y+o.h, o.w+6, 22);
          break;
        }
      }
      ctx.restore();
    }

    // Power-ups
    for (const p of this.powerups) {
      ctx.save();
      const bob  = Math.sin(p.spin * 1.1) * 7;
      const pcx  = p.x + p.w/2;
      const pcy  = p.y + p.h/2 + bob;

      let col, icon;
      if (p.type === 'dash')      { col = 'hsl(185, 100%, 58%)'; icon = '⚡'; }
      if (p.type === 'immunity')  { col = 'hsl(55, 100%, 62%)';  icon = '◈';  }
      if (p.type === 'growth')    { col = 'hsl(28, 100%, 58%)';  icon = '▲';  }

      ctx.strokeStyle = col;
      ctx.shadowColor = col;
      ctx.shadowBlur  = 20;
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.arc(pcx, pcy, 17, 0, Math.PI*2);
      ctx.stroke();

      ctx.globalAlpha = 0.28;
      ctx.fillStyle   = col;
      ctx.beginPath();
      ctx.arc(pcx, pcy, 14, 0, Math.PI*2);
      ctx.fill();

      ctx.globalAlpha = 1;
      ctx.fillStyle   = col;
      ctx.shadowBlur  = 10;
      ctx.font        = '14px serif';
      ctx.textAlign   = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(icon, pcx, pcy);
      ctx.restore();
    }
  }

  /* ── QUERY (for AI) ───────────────────── */
  nearestAhead(playerX, playerW) {
    let nearest = null, minDist = Infinity;
    for (const o of this.list) {
      if (o.type === 'platform') continue;
      const dist = o.x - (playerX + playerW);
      if (dist > -playerW && dist < minDist) {
        minDist = dist;
        nearest = { ...o, dist };
      }
    }
    return nearest;
  }
}

/* ── UTIL ─────────────────────────────────── */
function rectsOverlap(a, b) {
  return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
}
