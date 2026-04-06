export class Obstacle {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type; // ground, hover, powerup
        this.width = type === 'hover' ? 52 : 38;
        this.height = type === 'hover' ? 22 : 42;
        this.isHover = type === 'hover';
        this.powerType = type === 'powerup' ? ['dash','immunity','growth'][Math.floor(Math.random()*3)] : null;
    }
}

export class ObstacleManager {
    constructor(canvasWidth) {
        this.canvasWidth = canvasWidth;
        this.obstacles = [];
        this.powerUps = [];
        this.spawnTimer = 0;
        this.jumpSpawnTimer = 0;
    }

    reset() {
        this.obstacles = [];
        this.powerUps = [];
        this.spawnTimer = 1.2;
    }

    update(speed, dt, canvasWidth) {
        const move = speed * dt;

        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            this.obstacles[i].x -= move;
            if (this.obstacles[i].x < -100) this.obstacles.splice(i, 1);
        }

        for (let i = this.powerUps.length - 1; i >= 0; i--) {
            this.powerUps[i].x -= move;
            if (this.powerUps[i].x < -100) this.powerUps.splice(i, 1);
        }

        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
            const isHover = Math.random() < 0.32;
            const y = isHover ? 210 : this.canvasWidth * 0.72;
            this.obstacles.push(new Obstacle(canvasWidth + 60, y, isHover ? 'hover' : 'ground'));
            this.spawnTimer = 0.9 + Math.random() * 0.9;
        }

        // rare timed spike after jump
        if (this.jumpSpawnTimer > 0) {
            this.jumpSpawnTimer -= dt;
            if (this.jumpSpawnTimer <= 0 && Math.random() < 0.1) {
                this.obstacles.push(new Obstacle(canvasWidth + 40, this.canvasWidth * 0.72, 'ground'));
            }
        }

        // occasional power-up
        if (Math.random() < 0.008) {
            const pu = new Obstacle(canvasWidth + 120, 160 + Math.random() * 120, 'powerup');
            this.powerUps.push(pu);
        }
    }

    checkCollision(playerBox, player) {
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const o = this.obstacles[i];
            if (this.rectOverlap(playerBox, o)) {
                // top landing on hover
                if (o.isHover && player.vy > 0 && playerBox.y + playerBox.height - player.vy * 0.016 < o.y) {
                    player.y = o.y - player.height;
                    player.vy = 0;
                    player.onGround = true;
                    return 'landed';
                }
                // side / bottom hit
                if (!player.isImmune) return 'dead';
            }
        }
        return null;
    }

    destroyOnContact(playerBox) {
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            if (this.rectOverlap(playerBox, this.obstacles[i])) {
                this.obstacles.splice(i, 1);
            }
        }
    }

    checkPowerUpCollection(player) {
        const box = player.getHitbox();
        for (let i = this.powerUps.length - 1; i >= 0; i--) {
            const pu = this.powerUps[i];
            if (this.rectOverlap(box, pu)) {
                // trigger in game.js
                this.powerUps.splice(i, 1);
                return pu.powerType;
            }
        }
        return null;
    }

    rectOverlap(a, b) {
        return !(a.x + a.width < b.x || b.x + b.width < a.x || a.y + a.height < b.y || b.y + b.height < a.y);
    }

    render(ctx, hue) {
        for (const o of this.obstacles) {
            ctx.fillStyle = o.isHover ? '#a020f0' : `hsl(${hue + 10}, 90%, 55%)`;
            ctx.fillRect(o.x, o.y, o.width, o.height);
            if (o.isHover) {
                ctx.fillStyle = '#fff';
                ctx.fillRect(o.x + 8, o.y + 6, o.width - 16, 4);
            } else {
                // spike look
                ctx.fillStyle = '#111';
                ctx.fillRect(o.x + 8, o.y + 8, 8, 12);
            }
        }

        for (const pu of this.powerUps) {
            ctx.shadowBlur = 20;
            ctx.shadowColor = pu.powerType === 'dash' ? '#ff0' : pu.powerType === 'immunity' ? '#0ff' : '#0f0';
            ctx.fillStyle = pu.powerType === 'dash' ? '#ff0' : pu.powerType === 'immunity' ? '#0ff' : '#0f0';
            ctx.fillRect(pu.x, pu.y, 32, 32);
            ctx.shadowBlur = 0;
        }
    }
}
