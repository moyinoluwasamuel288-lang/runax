export class Player {
    constructor(canvasHeight) {
        this.x = 150;
        this.y = canvasHeight - 120;
        this.width = 42;
        this.height = 52;
        this.vy = 0;
        this.gravity = 1680;
        this.jumpForce = -720;
        this.onGround = true;
        this.groundY = canvasHeight - 120;
        this.isImmune = false;
        this.immunityTimer = 0;
        this.isGiant = false;
        this.giantTimer = 0;
        this.dashVX = 0;
    }

    update(dt) {
        this.vy += this.gravity * dt;
        this.y += this.vy * dt;
        this.dashVX *= 0.88;

        if (this.y >= this.groundY) {
            this.y = this.groundY;
            this.vy = 0;
            this.onGround = true;
        }

        if (this.immunityTimer > 0) this.immunityTimer -= dt;
        else this.isImmune = false;

        if (this.giantTimer > 0) this.giantTimer -= dt;
        else this.isGiant = false;
    }

    jump() {
        if (this.onGround) {
            this.vy = this.jumpForce;
            this.onGround = false;
            return true;
        }
        return false;
    }

    activateDash() {
        this.dashVX = 520;
    }

    activateImmunity() {
        this.isImmune = true;
        this.immunityTimer = 6;
    }

    activateGrowth() {
        this.isGiant = true;
        this.giantTimer = 7;
        this.width = 64;
        this.height = 78;
    }

    getHitbox() {
        const scale = this.isGiant ? 1.4 : 1;
        return {
            x: this.x + this.dashVX * 0.016,
            y: this.y,
            width: this.width * scale,
            height: this.height * scale
        };
    }

    render(ctx, hue) {
        const scale = this.isGiant ? 1.4 : 1;
        const px = this.x + this.dashVX * 0.016;
        const py = this.y;

        // glow for immunity
        if (this.isImmune) {
            ctx.shadowBlur = 30;
            ctx.shadowColor = '#0ff';
        }

        ctx.fillStyle = this.isGiant ? '#0f0' : `hsl(${hue + 80}, 90%, 65%)`;
        ctx.fillRect(px, py, this.width * scale, this.height * scale);

        // head
        ctx.fillStyle = '#111';
        ctx.fillRect(px + 8 * scale, py + 8 * scale, 18 * scale, 18 * scale);

        ctx.shadowBlur = 0;

        // running leg lines
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 6 * scale;
        ctx.beginPath();
        ctx.moveTo(px + 12 * scale, py + this.height * scale - 6);
        ctx.lineTo(px + 18 * scale, py + this.height * scale + (Math.sin(Date.now() / 60) * 8));
        ctx.stroke();
    }
}
