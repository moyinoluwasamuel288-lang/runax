class AIPlayer {
    constructor(player, obstacles) {
        this.player = player;
        this.obstacles = obstacles;
        this.enabled = false;
    }

    toggle() {
        this.enabled = !this.enabled;
        console.log("AI:", this.enabled ? "ON" : "OFF");
    }

    update() {
        if (!this.enabled) return;

        let danger = this.detectDanger();

        if (danger === "left") {
            this.player.moveRight();
        } else if (danger === "right") {
            this.player.moveLeft();
        } else {
            this.staySafe();
        }
    }

    detectDanger() {
        for (let obs of this.obstacles) {
            let dx = obs.x - this.player.x;
            let dy = obs.y - this.player.y;

            if (Math.abs(dx) < 50 && dy < 200) {
                if (dx < 0) return "left";
                if (dx > 0) return "right";
            }
        }
        return null;
    }

    staySafe() {
        // optional: center player slowly
    }
}
