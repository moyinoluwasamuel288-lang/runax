export class AISystem {
    constructor(player, obstacles) {
        this.player = player;
        this.obstacles = obstacles;
        this.cooldown = 0;
        this.lastJump = 0;
    }

    update() {
        if (this.cooldown > 0) this.cooldown -= 0.016;
    }

    shouldJump(keys) {
        if (this.cooldown > 0 || !this.player.onGround) return false;

        // look ahead for next obstacle
        const lookAhead = 380;
        for (const o of this.obstacles.obstacles) {
            if (o.x > this.player.x && o.x < this.player.x + lookAhead) {
                const timeToReach = (o.x - this.player.x) / 280;
                // simple predictive jump
                if (timeToReach < 0.85 && timeToReach > 0.3) {
                    this.cooldown = 0.42;
                    this.lastJump = Date.now();
                    return true;
                }
            }
        }
        return false;
    }
}
