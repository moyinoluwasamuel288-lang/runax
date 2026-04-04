// aiGodMode.js
// Temporary AI that plays perfectly and NEVER loses

class AIGodMode {
    constructor(player, obstacles) {
        this.player = player;
        this.obstacles = obstacles;
        this.enabled = false;
    }

    toggle() {
        this.enabled = !this.enabled;
        console.log("GOD AI:", this.enabled ? "ENABLED" : "DISABLED");
    }

    update() {
        if (!this.enabled) return;

        this.avoidEverything();
        this.preventDeath();
    }

    avoidEverything() {
        let closest = null;
        let minDist = Infinity;

        for (let obs of this.obstacles) {
            let dx = obs.x - this.player.x;
            let dy = obs.y - this.player.y;

            if (dy > 0 && dy < minDist) {
                minDist = dy;
                closest = obs;
            }
        }

        if (!closest) return;

        let dx = closest.x - this.player.x;

        // Smooth dodge instead of jumpy movement
        if (Math.abs(dx) < 80) {
            if (dx > 0) {
                this.player.x -= 6; // move left
            } else {
                this.player.x += 6; // move right
            }
        }
    }

    preventDeath() {
        // Hard override: keep player inside safe bounds
        if (this.player.x < 50) this.player.x = 50;
        if (this.player.x > window.innerWidth - 50) {
            this.player.x = window.innerWidth - 50;
        }

        // OPTIONAL: disable falling logic if exists
        if (this.player.y > window.innerHeight) {
            this.player.y = window.innerHeight / 2;
        }
    }
}
