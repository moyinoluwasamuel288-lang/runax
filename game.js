import { Engine } from './engine.js';
import { Player } from './player.js';
import { ObstacleManager } from './obstacles.js';
import { AISystem } from './aiSystem.js';

class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.engine = new Engine();
        this.player = new Player(this.canvas.height);
        this.obstacles = new ObstacleManager(this.canvas.width);
        this.ai = new AISystem(this.player, this.obstacles);
        this.score = 0;
        this.bestScore = localStorage.getItem('runDeltaXBest') || 0;
        this.speed = 280;
        this.hue = 200;
        this.gameState = 'start';
        this.aiMode = true;
        this.particles = [];
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();

        this.scoreEl = document.getElementById('score-display');
        this.bestEl = document.getElementById('best-display');
        this.statusEl = document.getElementById('status');
        this.startScreen = document.getElementById('start-screen');
        this.gameOverScreen = document.getElementById('game-over-screen');
        this.finalScoreEl = document.getElementById('final-score');
        this.finalBestEl = document.getElementById('final-best');
        this.newBestEl = document.getElementById('new-best');

        this.keys = {};
        this.lastJumpTime = 0;

        this.initEventListeners();
        this.updateUI();
    }

    initEventListeners() {
        window.addEventListener('keydown', e => {
            this.keys[e.key] = true;
            if (e.key === ' ' && this.gameState === 'playing') {
                e.preventDefault();
                if (!this.aiMode) this.player.jump();
            }
        });

        window.addEventListener('keyup', e => {
            this.keys[e.key] = false;
        });

        this.canvas.addEventListener('click', () => {
            if (this.gameState === 'playing' && !this.aiMode) this.player.jump();
        });

        this.canvas.addEventListener('touchstart', e => {
            e.preventDefault();
            if (this.gameState === 'playing' && !this.aiMode) this.player.jump();
        });

        document.getElementById('start-button').addEventListener('click', () => this.startGame());
        document.getElementById('restart-button').addEventListener('click', () => this.restartGame());
        document.getElementById('share-button').addEventListener('click', () => this.shareScore());

        document.getElementById('ai-mode-toggle').addEventListener('change', e => {
            this.aiMode = e.target.checked;
        });
    }

    startGame() {
        this.startScreen.classList.add('hidden');
        this.gameState = 'playing';
        this.score = 0;
        this.speed = 280;
        this.player = new Player(this.canvas.height);
        this.obstacles.reset();
        this.particles = [];
        this.hue = 200;
        this.statusEl.textContent = 'RUNNING';
        this.engine.start(dt => this.update(dt), () => this.render());
    }

    restartGame() {
        this.gameOverScreen.classList.add('hidden');
        this.startGame();
    }

    gameOver() {
        this.engine.stop();
        this.gameState = 'over';
        this.statusEl.textContent = 'CRASHED';
        
        const finalScore = Math.floor(this.score);
        this.finalScoreEl.textContent = String(finalScore).padStart(5, '0');
        
        let isNewBest = false;
        if (finalScore > this.bestScore) {
            this.bestScore = finalScore;
            localStorage.setItem('runDeltaXBest', this.bestScore);
            isNewBest = true;
        }
        this.finalBestEl.textContent = String(this.bestScore).padStart(5, '0');
        if (isNewBest) this.newBestEl.classList.remove('hidden');
        
        this.gameOverScreen.classList.remove('hidden');
        this.updateUI();
    }

    update(dt) {
        if (this.gameState !== 'playing') return;

        this.hue = (this.hue + 35 * dt) % 360;
        this.score += this.speed * dt * 0.12;
        this.speed = Math.min(420, 280 + this.score * 0.018);

        this.player.update(dt, this.speed);
        this.obstacles.update(this.speed, dt, this.canvas.width);

        this.ai.update();

        if (this.aiMode && this.ai.shouldJump(this.keys)) {
            const now = Date.now();
            if (now - this.lastJumpTime > 180) {
                this.player.jump();
                this.lastJumpTime = now;
            }
        }

        this.checkCollisions();
        this.obstacles.checkPowerUpCollection(this.player);
        this.updateParticles(dt);
        this.updateUI();
    }

    checkCollisions() {
        const playerBox = this.player.getHitbox();
        const hit = this.obstacles.checkCollision(playerBox, this.player);

        if (hit === 'dead' && !this.player.isImmune) {
            this.gameOver();
        } else if (hit === 'landed') {
            // handled inside obstacles
        }

        if (this.player.isGiant) {
            this.obstacles.destroyOnContact(playerBox);
        }
    }

    updateParticles(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;
            if (p.life <= 0) this.particles.splice(i, 1);
        }
    }

    render() {
        this.ctx.save();
        this.ctx.fillStyle = `hsl(${this.hue}, 18%, 8%)`;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // ground
        this.ctx.fillStyle = `hsl(${this.hue}, 40%, 22%)`;
        this.ctx.fillRect(0, this.canvas.height - 80, this.canvas.width, 80);

        // ground lines
        this.ctx.strokeStyle = `hsl(${this.hue + 30}, 80%, 55%)`;
        this.ctx.lineWidth = 3;
        for (let x = (Date.now() * 0.3 % 80) - 80; x < this.canvas.width; x += 80) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, this.canvas.height - 80);
            this.ctx.lineTo(x + 40, this.canvas.height - 40);
            this.ctx.stroke();
        }

        this.obstacles.render(this.ctx, this.hue);
        this.player.render(this.ctx, this.hue);

        // particles
        for (const p of this.particles) {
            this.ctx.globalAlpha = p.life / 1.2;
            this.ctx.fillStyle = p.color;
            this.ctx.fillRect(p.x, p.y, 6, 6);
        }
        this.ctx.globalAlpha = 1;

        this.ctx.restore();
    }

    updateUI() {
        this.scoreEl.textContent = String(Math.floor(this.score)).padStart(5, '0');
        this.bestEl.textContent = String(this.bestScore).padStart(5, '0');
    }

    shareScore() {
        const score = Math.floor(this.score);
        const text = `I scored ${score} in RUNΔX! Can you beat it?`;

        if (navigator.share) {
            navigator.share({ title: 'RUNΔX Score', text }).catch(() => {});
        } else {
            navigator.clipboard.writeText(text).then(() => alert('Score copied to clipboard!'));
        }
    }
}

const game = new Game();
