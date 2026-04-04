// game.js

class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");

        // Core
        this.player = new Player(canvas.width / 2, canvas.height - 100);
        this.obstacles = [];

        this.gameOverState = false;
        this.running = true;

        // AI GOD MODE
        this.aiGod = new AIGodMode(this.player, this.obstacles);

        // Bind input
        this.initControls();

        // Start loop
        this.loop();
    }

    initControls() {
        document.addEventListener("keydown", (e) => {
            if (e.key === "ArrowLeft") this.player.moveLeft();
            if (e.key === "ArrowRight") this.player.moveRight();

            // 🔥 TOGGLE AI
            if (e.key.toLowerCase() === "i") {
                this.aiGod.toggle();
            }
        });
    }

    spawnObstacle() {
        let x = Math.random() * this.canvas.width;
        let y = -50;

        this.obstacles.push({
            x: x,
            y: y,
            width: 40,
            height: 40,
            speed: 5
        });
    }

    update() {
        if (this.gameOverState) return;

        // Spawn obstacles randomly
        if (Math.random() < 0.03) {
            this.spawnObstacle();
        }

        // Move obstacles
        for (let obs of this.obstacles) {
            obs.y += obs.speed;
        }

        // Remove off-screen obstacles
        this.obstacles = this.obstacles.filter(
            (obs) => obs.y < this.canvas.height + 50
        );

        // 🔥 AI UPDATE
        this.aiGod.update();

        // Collision check
        this.checkCollisions();
    }

    checkCollisions() {
        for (let obs of this.obstacles) {
            let collision =
                this.player.x < obs.x + obs.width &&
                this.player.x + this.player.width > obs.x &&
                this.player.y < obs.y + obs.height &&
                this.player.y + this.player.height > obs.y;

            // 🔥 GOD MODE PREVENTS DEATH
            if (collision && !this.aiGod.enabled) {
                this.gameOver();
            }
        }
    }

    gameOver() {
        this.gameOverState = true;
        console.log("Game Over");
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw player
        this.ctx.fillStyle = "white";
        this.ctx.fillRect(
            this.player.x,
            this.player.y,
            this.player.width,
            this.player.height
        );

        // Draw obstacles
        this.ctx.fillStyle = "red";
        for (let obs of this.obstacles) {
            this.ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
        }
    }

    loop() {
        this.update();
        this.draw();

        requestAnimationFrame(() => this.loop());
    }
}

// INIT GAME
const canvas = document.getElementById("gameCanvas");

// Resize (mobile fix)
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// Start game
new Game(canvas);
