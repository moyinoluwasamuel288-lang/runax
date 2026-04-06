// game.js — Main game orchestrator

import { Player }          from './player.js';
import { ObstacleManager } from './obstacles.js';
import { AISystem }        from './aiSystem.js';

export class Game {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx    = ctx;

    // Sub-systems
    this.player    = new Player(canvas);
    this.obstacles = new ObstacleManager(canvas);
    this.ai        = new AISystem();

    // State
    this.state      = 'start';   // start | playing | dead
    this.score      = 0;
    this.bestScore  = +localStorage.getItem('runax_best') || 0;
    this.elapsed    = 0;         // seconds since game start
    this.hue        = 195;       // shifting color theme

    // Screen-shake
    this._shakeAmt  = 0;
    this._shakeDur  = 0;

    // Spawn timers
    this._spawnTimer   = 0;
    this._spawnInterval = 1.9;
    this._puTimer      = 0;

    // Chaos spike flag
    this._chaosArmed   = false;
    this._chaosTimer   = 0;

    // Background layers
    this._stars = this._makeStars(90);

    // Audio
    this._audio = null; // lazy AudioContext

    this._bindInputs();
    this._updateUI();
  }

  /* ── INPUT ────────────────────────────── */
  _bindInputs() {
    const jump = () => {
      if (this.state === 'start') { this.startGame(); return; }
      if (this.state === 'dead')  { return; }
      this._playerJump();
    };

    window.addEventListener('keydown', e => {
      if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); jump(); }
      if (e.code === 'KeyG') this._toggleAI();
    });

    this.canvas.addEventListener('pointerdown', e => { e.preventDefault(); jump(); });

    document.getElementById('btn-start').addEventListener('click',   () => this.startGame());
    document.getElementById('btn-restart').addEventListener('click', () => this.startGame());
    document.getElementById('btn-share').addEventListener('click',   () => this._shareScore());
  }

  _playerJump() {
    const jumped = this.player.jump();
    if (jumped) {
      this._playSound('jump');
      // Arm chaos spike: 10% chance, fires 0.25–0.45s after jump
      if (!this._chaosArmed && Math.random() < 0.10) {
        this._chaosArmed = true;
        this._chaosTimer = 0.25 + Math.random() * 0.20;
      }
    }
  }

  _toggleAI() {
    this.ai.toggle();
    document.getElementById('ai-badge').classList.toggle('hidden', !this.ai.enabled);
  }

  /* ── GAME LIFECYCLE ───────────────────── */
  startGame() {
    this.player    = new Player(this.canvas);
    this.obstacles = new ObstacleManager(this.canvas);
    this.score     = 0;
    this.elapsed   = 0;
    this.state     = 'playing';
    this._spawnTimer    = 0;
    this._spawnInterval = 1.9;
    this._puTimer       = 0;
    this._chaosArmed    = false;
    this._chaosTimer    = 0;
    this._shakeAmt      = 0;

    this._hideScreen('screen-start');
    this._hideScreen('screen-over');
    document.getElementById('powerup-indicator').classList.add('hidden');
    this._updateUI();
  }

  _gameOver() {
    this.state = 'dead';
    this._playSound('death');
    this._shake(0.35, 10);
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      localStorage.setItem('runax_best', this.bestScore.toString());
    }
    document.getElementById('over-score').textContent = Math.floor(this.score);
    document.getElementById('over-best').textContent  = Math.floor(this.bestScore);
    this._showScreen('screen-over');
    this._updateUI();
  }

  /* ── MAIN TICK ────────────────────────── */
  tick(dt) {
    // Hue shift
    this.hue = (this.hue + dt * 5) % 360;

    if (this.state === 'playing') {
      this._update(dt);
    }
    this._render();
  }

  _update(dt) {
    this.elapsed += dt;
    this.score   += dt * 14 * (this.obstacles.speed / 390);

    // Speed ramp
    this.obstacles.speed = Math.min(390 + this.elapsed * 20, this.obstacles.maxSpeed);

    // ── AI ──
    if (this.ai.enabled) {
      this.ai.update(dt, this.player, this.obstacles, this.obstacles.speed);
    }

    // ── Chaos spike timer ──
    if (this._chaosArmed) {
      this._chaosTimer -= dt;
      if (this._chaosTimer <= 0) {
        this._chaosArmed = false;
        this.obstacles.spawnSurpriseSpikeAt(this.player.x + 80);
      }
    }

    // ── Obstacle spawn ──
    this._spawnTimer    += dt;
    this._spawnInterval  = Math.max(0.88, 1.9 - this.elapsed * 0.016);
    if (this._spawnTimer >= this._spawnInterval) {
      this._spawnTimer = 0;
      // Don't spawn if player is mid-air and would land right in front
      if (!this._playerWouldLandInSpawnZone()) {
        this.obstacles.trySpawn(this.elapsed, this.player);
      }
    }

    // ── Power-up spawn ──
    this._puTimer += dt;
    if (this._puTimer >= this.obstacles._puInterval) {
      this._puTimer = 0;
      this.obstacles._puInterval = 7 + Math.random() * 6;
      this.obstacles.spawnPowerup();
    }

    // ── Player update (get platform resolution from obstacle mgr first) ──
    // We run obstacle physics first to detect platform top, then pass result to player
    const obsResult = this.obstacles.update(dt, this.player, this.hue);

    // Player update with resolved platform Y
    this.player.update(dt, obsResult.platformY);

    // ── Power-up pickup ──
    if (obsResult.powerup) {
      this._activatePowerup(obsResult.powerup);
    }

    // ── Crushed (growth mode) ──
    if (obsResult.crushed.length > 0) {
      this._shake(0.18, 6);
      this._playSound('crush');
    }

    // ── Death ──
    if (obsResult.dead && !this.player.immune) {
      this._gameOver();
      return;
    }

    // ── Shake decay ──
    if (this._shakeDur > 0) {
      this._shakeDur -= dt;
      if (this._shakeDur <= 0) { this._shakeDur = 0; this._shakeAmt = 0; }
    }

    // ── Score display ──
    document.getElementById('score-val').textContent = Math.floor(this.score);
    document.getElementById('best-val').textContent  = Math.floor(Math.max(this.score, this.bestScore));

    // ── Power-up indicator ──
    this._updatePowerupHUD();
  }

  /* ── POWER-UPS ────────────────────────── */
  _activatePowerup(type) {
    this._playSound('powerup');
    if (type === 'dash')     { this.player.activateDash(this.obstacles.speed); }
    if (type === 'immunity') { this.player.activateImmunity(); }
    if (type === 'growth')   { this.player.activateGrowth(); }
    this._puActiveType = type;
  }

  _updatePowerupHUD() {
    const p = this.player;
    const el = document.getElementById('powerup-indicator');
    if (p.immune && p.immuneTimer > 0) {
      el.classList.remove('hidden');
      el.textContent = `IMMUNE ${p.immuneTimer.toFixed(1)}s`;
    } else if (p.growth && p.growthTimer > 0) {
      el.classList.remove('hidden');
      el.textContent = `GROWTH ${p.growthTimer.toFixed(1)}s`;
    } else if (p.dashing) {
      el.classList.remove('hidden');
      el.textContent = 'DASH';
    } else {
      el.classList.add('hidden');
    }
  }

  /* ── FAIRNESS CHECK ───────────────────── */
  _playerWouldLandInSpawnZone() {
    const p = this.player;
    if (p.onGround || p.onPlatform) return false;
    // If player is in air, check if their landing zone overlaps with off-screen spawn edge
    const approxLandX = p.x + p.W; // landing stays near same x in a runner
    // The concern is obstacles already on-screen near player's landing zone
    for (const o of this.obstacles.list) {
      if (o.type === 'platform') continue;
      const dist = o.x - approxLandX;
      if (dist > -60 && dist < 90) return true;
    }
    return false;
  }

  /* ── SCREEN SHAKE ─────────────────────── */
  _shake(dur, amt) {
    this._shakeDur = dur;
    this._shakeAmt = amt;
  }

  /* ── RENDER ───────────────────────────── */
  _render() {
    const ctx = this.ctx;
    const W   = this.canvas.width;
    const H   = this.canvas.height;

    ctx.save();

    // Screen shake offset
    if (this._shakeAmt > 0 && this._shakeDur > 0) {
      const sx = (Math.random()*2-1) * this._shakeAmt;
      const sy = (Math.random()*2-1) * this._shakeAmt;
      ctx.translate(sx, sy);
    }

    // ── Background ──
    ctx.fillStyle = `hsl(${this.hue + 200}, 28%, 5%)`;
    ctx.fillRect(0, 0, W, H);

    // Ambient radial glow
    const grad = ctx.createRadialGradient(W*0.15, H*0.65, 0, W*0.15, H*0.65, W*0.65);
    grad.addColorStop(0, `hsla(${this.hue}, 80%, 14%, 0.55)`);
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Stars
    ctx.fillStyle = '#fff';
    for (const s of this._stars) {
      if (this.state === 'playing') {
        s.x -= s.speed * (this.obstacles.speed / 390) * (1/60);
        if (s.x < 0) s.x = W;
      }
      ctx.globalAlpha = s.a;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // ── Ground ──
    const gY = this.canvas.height * 0.72;

    // Ground glow fill
    const gGrad = ctx.createLinearGradient(0, gY, 0, gY+55);
    gGrad.addColorStop(0, `hsla(${this.hue}, 100%, 55%, 0.28)`);
    gGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = gGrad;
    ctx.fillRect(0, gY, W, 55);

    // Ground line
    ctx.save();
    ctx.strokeStyle = `hsl(${this.hue}, 100%, 55%)`;
    ctx.shadowColor = `hsl(${this.hue}, 100%, 55%)`;
    ctx.shadowBlur  = 14;
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(0, gY);
    ctx.lineTo(W, gY);
    ctx.stroke();
    ctx.restore();

    // Grid sweep lines
    if (this.state === 'playing') {
      ctx.save();
      ctx.globalAlpha = 0.09;
      ctx.strokeStyle = `hsl(${this.hue}, 80%, 60%)`;
      ctx.lineWidth   = 1;
      const seg = W / 7;
      const off = (Date.now() * this.obstacles.speed * 0.00028) % seg;
      for (let i=-1; i<9; i++) {
        const lx = i*seg - off;
        ctx.beginPath();
        ctx.moveTo(lx, gY);
        ctx.lineTo(lx - 24, H);
        ctx.stroke();
      }
      ctx.restore();
    }

    // ── Obstacles & power-ups ──
    this.obstacles.draw(ctx, this.hue);

    // ── Player ──
    if (this.state === 'playing' || this.state === 'dead') {
      this.player.draw(ctx, this.hue);
    }

    // ── Dash speed lines ──
    if (this.state === 'playing' && this.player.dashing) {
      ctx.save();
      ctx.globalAlpha = 0.22;
      for (let i=0; i<7; i++) {
        const ly  = this.player.y + (i/7)*this.player.H;
        const len = 50 + Math.random()*90;
        ctx.strokeStyle = `hsl(${this.hue+35}, 100%, 72%)`;
        ctx.lineWidth   = 1.2;
        ctx.beginPath();
        ctx.moveTo(this.player.x + this.player.W, ly);
        ctx.lineTo(this.player.x + this.player.W + len, ly);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.restore();
  }

  /* ── AUDIO ────────────────────────────── */
  _getAC() {
    if (!this._audio) {
      try { this._audio = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
    }
    return this._audio;
  }

  _playSound(type) {
    const ac = this._getAC();
    if (!ac) return;
    try {
      switch (type) {
        case 'jump': {
          const o = ac.createOscillator();
          const g = ac.createGain();
          o.connect(g); g.connect(ac.destination);
          o.frequency.setValueAtTime(310, ac.currentTime);
          o.frequency.exponentialRampToValueAtTime(560, ac.currentTime + 0.08);
          g.gain.setValueAtTime(0.11, ac.currentTime);
          g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.14);
          o.start(); o.stop(ac.currentTime + 0.14);
          break;
        }
        case 'powerup': {
          const o = ac.createOscillator();
          const g = ac.createGain();
          o.type = 'sine';
          o.connect(g); g.connect(ac.destination);
          o.frequency.setValueAtTime(440, ac.currentTime);
          o.frequency.exponentialRampToValueAtTime(880, ac.currentTime + 0.22);
          g.gain.setValueAtTime(0.14, ac.currentTime);
          g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.26);
          o.start(); o.stop(ac.currentTime + 0.26);
          break;
        }
        case 'crush': {
          const buf  = ac.createBuffer(1, ac.sampleRate*0.14, ac.sampleRate);
          const data = buf.getChannelData(0);
          for (let i=0;i<data.length;i++) data[i] = (Math.random()*2-1)*Math.pow(1-i/data.length,1.4);
          const src = ac.createBufferSource();
          const g   = ac.createGain();
          src.buffer = buf;
          src.connect(g); g.connect(ac.destination);
          g.gain.setValueAtTime(0.45, ac.currentTime);
          g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.14);
          src.start();
          break;
        }
        case 'death': {
          const o = ac.createOscillator();
          const g = ac.createGain();
          o.type = 'sawtooth';
          o.connect(g); g.connect(ac.destination);
          o.frequency.setValueAtTime(200, ac.currentTime);
          o.frequency.exponentialRampToValueAtTime(55, ac.currentTime + 0.42);
          g.gain.setValueAtTime(0.22, ac.currentTime);
          g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.42);
          o.start(); o.stop(ac.currentTime + 0.42);
          break;
        }
      }
    } catch(e) {}
  }

  /* ── SHARE ────────────────────────────── */
  _shareScore() {
    const text = `I scored ${Math.floor(this.score)} in RUNΔX! Can you beat me? 🏃‍♂️`;
    if (navigator.share) {
      navigator.share({ title: 'RUNΔX', text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text).then(() => this._toast('Copied to clipboard!')).catch(() => {});
    }
  }

  _toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.add('hidden'), 2400);
  }

  /* ── UI HELPERS ───────────────────────── */
  _showScreen(id) { document.getElementById(id).classList.add('active'); }
  _hideScreen(id) { document.getElementById(id).classList.remove('active'); }

  _updateUI() {
    document.getElementById('start-best').querySelector('span').textContent = Math.floor(this.bestScore);
    document.getElementById('best-val').textContent = Math.floor(this.bestScore);
    if (this.state === 'start') this._showScreen('screen-start');
  }

  /* ── STARS ────────────────────────────── */
  _makeStars(n) {
    const stars = [];
    for (let i=0;i<n;i++) {
      stars.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height * 0.68,
        r: 0.4 + Math.random()*1.4,
        a: 0.08 + Math.random()*0.5,
        speed: 0.15 + Math.random()*0.5
      });
    }
    return stars;
  }

  onResize() {
    this.player.onResize();
    this.obstacles.onResize();
    this._stars = this._makeStars(90);
  }
}
