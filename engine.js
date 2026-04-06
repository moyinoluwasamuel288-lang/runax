// engine.js - Game loop with delta time
export class Engine {
    constructor() {
        this.running = false;
        this.lastTime = 0;
        this.accumulator = 0;
        this.step = 1000 / 60;
        this.animationFrame = null;
        this.updateFn = null;
        this.renderFn = null;
    }

    start(updateFn, renderFn) {
        if (this.running) return;
        this.updateFn = updateFn;
        this.renderFn = renderFn;
        this.running = true;
        this.lastTime = performance.now();
        this.loop();
    }

    stop() {
        this.running = false;
        if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
    }

    loop = (timestamp = performance.now()) => {
        if (!this.running) return;

        const delta = Math.min(timestamp - this.lastTime, 100);
        this.lastTime = timestamp;
        this.accumulator += delta;

        while (this.accumulator >= this.step) {
            this.updateFn(this.step / 1000);
            this.accumulator -= this.step;
        }

        this.renderFn();
        this.animationFrame = requestAnimationFrame(this.loop);
    };
}
