// js/aiGodMode.js

class AIGodMode {
    constructor(player, obstacles, canvas) {
        this.player = player;
        this.obstacles = obstacles;
        this.canvas = canvas;
        this.enabled = false;
    }

    toggle() {
        this.enabled = !this.enabled;
        console.log("GOD AI:", this.enabled ? "ON" : "OFF");
    }

    update() {
        if (!this.enabled) return;

        this.dodge();
        this.keepAlive();
    }

    dodge() {
        let closest = null;
        let minDist = Infinity;

        for (let obs of this.obstacles) {
            let dy = obs.y - this.player.y;

            if (dy > 0 && dy < minDist) {
                minDist = dy;
                closest = obs;
            }
        }

        if (!closest) return;

        let dx = closest.x - this.player.x;

        if (Math.abs(dx) < 80) {
            if (dx > 0) {
                this.player.x -= 6;
            } else {
                this.player.x += 6;
            }
        }
    }

    keepAlive() {
        // Keep inside screen
        if (this.player.x < 20) this.player.x = 20;
        if (this.player.x > this.canvas.width - 60) {
            this.player.x = this.canvas.width - 60;
        }

        // Prevent falling
        if (this.player.y > this.canvas.height) {
            this.player.y = this.canvas.height / 2;
        }
    }
}
