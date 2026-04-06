// game.js — Main orchestrator
import { Player } from './player.js';
import { ObstacleManager } from './obstacles.js';
import { AISystem } from './aiSystem.js';

export class Game {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;

    this.player = new Player(canvas);
    this.obstacles = new ObstacleManager(canvas);
    this.ai = new AISystem();

    this.state = 'idle'; // idle | running | dead
    this.score = 0;
    this.bestScore = parseInt(localStorage.getItem('runax_best') || '0');
    this.hue = 200;
    this.speed = 380;
    this.elapsedTime = 0;
    this.bgStars = this._genStars(80);

    // Sound
    this._audioCtx = null;

    this._bindUI();
    this._updateBestDisplay();
  }

  _genStars(count) {
    const stars = [];
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height * 0.7,
        r: 0.5 + Math.random() * 1.5,
        speed: 0.2 + Math.random() * 0.5,
        alpha: 0.1 + Math.random() * 0.5
      });
    }
    return stars;
  }

  _getAudioCtx() {
    if (!this._audioCtx) {
      try { this._audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
    }
    return this._audioCtx;
  }

  _playSound(type) {
    const ac = this._getAudioCtx();
    if (!ac) return;
    try {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain);
      gain.connect(ac.destination);

      switch(type) {
        case 'jump':
          osc.frequency.setValueAtTime(320, ac.currentTime);
          osc.frequency.exponentialRampToValueAtTime(580, ac.currentTime + 0.08);
          gain.gain.setValueAtTime(0.12, ac.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.15);
          osc.start(); osc.stop(ac.currentTime + 0.15);
          break;
        case 'powerup':
          osc.type = 'sine';
          osc.frequency.setValueAtTime(440, ac.currentTime);
          osc.frequency.exponentialRampToValueAtTime(880, ac.currentTime + 0.2);
          gain.gain.setValueAtTime(0.15, ac.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.25);
          osc.start(); osc.stop(ac.currentTime + 0.25);
          break;
        case 'explode': {
          // Satisfying crunch
          const buf = ac.createBuffer(1, ac.sampleRate * 0.15, ac.sampleRate);
          const data = buf.getChannelData(0);
          for (let i = 0; i < data.length; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 1.5);
          }
          const src = ac.createBufferSource();
          src.buffer = buf;
          const g2 = ac.createGain();
          g2.gain.setValueAtTime(0.4, ac.currentTime);
          g2.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.15);
          src.connect(g2);
          g2.connect(ac.destination);
          src.start();
          break;
        }
        case 'death':
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(220, ac.currentTime);
          osc.frequency.exponentialRampToValueAtTime(60, ac.currentTime + 0.4);
          gain.gain.setValueAtTime(0.2, ac.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.4);
          osc.start(); osc.stop(ac.currentTime + 0.4);
          break;
      }
    } catch(e) {}
  }

  _bindUI() {
    // Start button
    document.getElementById('start-btn').addEventListener('click', () => this.startGame());

    // Restart
    document.getElementById('restart-btn').addEventListener('click', () => this.startGame());

    // Share
    document.getElementById('share-btn').addEventListener('click', () => this._share());

    // Jump — keyboard
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        if (this.state === 'idle') { this.startGame(); return; }
        if (this.state === 'running') this._doJump();
      }
    });

    // Jump — touch/click on canvas
    this.canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (this.state === 'idle') { this.startGame(); return; }
      if (this.state === 'running') this._doJump();
    });

    // AI toggle
    document.getElementById('ai-toggle').addEventListener('click', () => {
      this.ai.toggle();
      const el = document.getElementById('ai-toggle');
      const lbl = document.getElementById('ai-label');
      if (this.ai.enabled) {
        el.classList.add('active');
        lbl.textContent = 'AI ON';
      } else {
        el.classList.remove('active');
        lbl.textContent = 'AI OFF';
      }
    });
  }

  _doJump() {
    if (this.player.onGround || this.player.onPlatform) {
      this.player.requestJump();
      this._playSound('jump');
    }
  }

  startGame() {
    this.player.reset();
    this.obstacles.reset();
    this.score = 0;
    this.speed = 380;
    this.elapsedTime = 0;
    this.state = 'running';
    this._powerupTimer = 0;
    this._chaosFlag = false;

    this._hideScreen('overlay');
    this._hideScreen('gameover');
    this._hidePowerupHUD();
  }

  _gameOver() {
    this.state = 'dead';
    this._playSound('death');

    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      localStorage.setItem('runax_best', this.bestScore.toString());
    }

    document.getElementById('go-score').textContent = Math.floor(this.score);
    document.getElementById('go-best').textContent = this.bestScore;
    this._updateBestDisplay();
    this._showScreen('gameover');
    this._hidePowerupHUD();
  }

  _updateBestDisplay() {
    document.getElementById('best').textContent = this.bestScore;
    document.getElementById('overlay-best').textContent = this.bestScore;
  }

  _showScreen(id) {
    document.getElementById(id).classList.add('active');
  }

  _hideScreen(id) {
    document.getElementById(id).classList.remove('active');
  }

  _showPowerupHUD(name, duration) {
    const el = document.getElementById('powerup-display');
    el.classList.remove('hidden');
    document.getElementById('powerup-name').textContent = name.toUpperCase();
    this._powerupHUDDuration = duration;
    this._powerupHUDRemaining = duration;
  }

  _hidePowerupHUD() {
    document.getElementById('powerup-display').classList.add('hidden');
    this._powerupHUDDuration = 0;
    this._powerupHUDRemaining = 0;
  }

  _updatePowerupHUD(delta) {
    if (!this._powerupHUDDuration) return;
    this._powerupHUDRemaining -= delta;
    if (this._powerupHUDRemaining <= 0) {
      this._hidePowerupHUD();
      return;
    }
    const pct = this._powerupHUDRemaining / this._powerupHUDDuration;
    document.getElementById('powerup-bar').style.width = (pct * 100) + '%';
  }

  _share() {
    const text = `I scored ${Math.floor(this.score)} in RUNΔX! Can you beat me?`;
    if (navigator.share) {
      navigator.share({ title: 'RUNΔX', text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text).then(() => this._toast('COPIED TO CLIPBOARD')).catch(() => {});
    }
  }

  _toast(msg) {
    let el = document.getElementById('share-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'share-toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2200);
  }

  onResize() {
    this.player.onResize();
    this.obstacles.onResize();
    this.bgStars = this._genStars(80);
  }

  tick(delta) {
    this._update(delta);
    this._render();
  }

  _update(delta) {
    // Hue slowly shifts
    this.hue = (this.hue + delta * 0.015) % 360;

    // Update CSS hue var for UI
    document.documentElement.style.setProperty('--hue', Math.round(this.hue));

    if (this.state !== 'running') return;

    this.elapsedTime += delta;
    this.score += delta * 0.035 * (this.speed / 380);

    // Gradually increase speed
    this.speed = Math.min(380 + this.elapsedTime * 0.045, 780);
    this.obstacles.speed = this.speed;

    // Spawn timer
    this.obstacles.spawnTimer += delta;
    const interval = Math.max(this.obstacles.minSpawnInterval,
      this.obstacles.spawnInterval - this.elapsedTime * 0.12);

    if (this.obstacles.spawnTimer >= interval) {
      this.obstacles.spawnTimer = 0;
      this.obstacles.spawnObstacle(this.player, this.speed);

      // Chaos spike: rare (10%) after a jump is detected
      if (!this.player.onGround && !this._chaosFlag && Math.random() < 0.10) {
        this._chaosFlag = true;
        setTimeout(() => {
          if (this.state === 'running') this.obstacles.spawnChaosSpike(this.player);
          this._chaosFlag = false;
        }, 400);
      }
    }

    // Power-up spawn
    this._powerupTimer = (this._powerupTimer || 0) + delta;
    if (this._powerupTimer >= this.obstacles.powerupInterval) {
      this._powerupTimer = 0;
      this.obstacles.powerupInterval = 6000 + Math.random() * 5000;
      this.obstacles.spawnPowerup();
    }

    // AI
    this.ai.update(delta, this.player, this.obstacles);

    // Obstacle update + collisions (player position checked here)
    // First do a physics pre-pass for obstacles to detect platform
    const col = this.obstacles.update(delta, this.speed, this.player, this.hue);

    // Player update — pass in platform Y so landing is resolved this frame
    this.player.update(delta, col.platformY);

    // Explosions
    col.explosions.forEach(e => {
      this.obstacles.addExplosion(e.x, e.y, e.hue);
      this._playSound('explode');
    });

    // Power-up pickup
    if (col.powerup) {
      this._playSound('powerup');
      switch (col.powerup) {
        case 'dash':
          this.player.applyDash();
          this._showPowerupHUD('DASH', this.player.dashDuration);
          break;
        case 'immunity':
          this.player.applyImmunity();
          this._showPowerupHUD('IMMUNE', this.player.immuneDuration);
          break;
        case 'growth':
          this.player.applyGrowth();
          this._showPowerupHUD('GROWTH', this.player.growthDuration);
          break;
      }
    }

    // Powerup HUD timer
    this._updatePowerupHUD(delta);

    // Death
    if (col.dead && !this.player.immune) {
      this._gameOver();
    }

    // Score display
    document.getElementById('score').textContent = Math.floor(this.score);
  }

  _render() {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;

    // Background
    ctx.fillStyle = '#080810';
    ctx.fillRect(0, 0, W, H);

    // Ambient gradient
    const grad = ctx.createRadialGradient(W * 0.15, H * 0.6, 0, W * 0.15, H * 0.6, W * 0.6);
    grad.addColorStop(0, `hsla(${this.hue}, 80%, 12%, 0.6)`);
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Stars
    this.bgStars.forEach(s => {
      if (this.state === 'running') s.x -= s.speed * (this.speed / 380);
      if (s.x < 0) s.x = W + 2;
      ctx.globalAlpha = s.alpha;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Ground
    const gY = this.canvas.height * 0.72;
    // Ground glow
    const gGrad = ctx.createLinearGradient(0, gY, 0, gY + 60);
    gGrad.addColorStop(0, `hsla(${this.hue}, 100%, 55%, 0.3)`);
    gGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = gGrad;
    ctx.fillRect(0, gY, W, 60);

    // Ground line
    ctx.strokeStyle = `hsl(${this.hue}, 100%, 55%)`;
    ctx.shadowColor = `hsl(${this.hue}, 100%, 55%)`;
    ctx.shadowBlur = 12;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, gY);
    ctx.lineTo(W, gY);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Grid lines on ground (speed lines)
    if (this.state === 'running') {
      ctx.save();
      ctx.globalAlpha = 0.1;
      ctx.strokeStyle = `hsl(${this.hue}, 80%, 60%)`;
      ctx.lineWidth = 1;
      const lineCount = 8;
      const lineSpacing = W / lineCount;
      const offset = ((Date.now() * this.speed * 0.0003) % lineSpacing);
      for (let i = -1; i < lineCount + 1; i++) {
        const lx = i * lineSpacing - offset;
        ctx.beginPath();
        ctx.moveTo(lx, gY);
        ctx.lineTo(lx - 30, H);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Obstacles & powerups
    this.obstacles.draw(ctx, this.hue, this.speed);

    // Player
    this.player.draw(ctx, this.hue);

    // Speed lines (when dashing)
    if (this.player.dashActive) {
      ctx.save();
      ctx.globalAlpha = 0.25;
      for (let i = 0; i < 6; i++) {
        const ly = this.player.y + (i / 6) * this.player.h;
        const len = 60 + Math.random() * 80;
        ctx.strokeStyle = `hsl(${this.hue + 30}, 100%, 70%)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(this.player.x + this.player.w, ly);
        ctx.lineTo(this.player.x + this.player.w + len, ly);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}
