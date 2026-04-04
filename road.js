// js/road.js
export const Road = (() => {
  let vertOffset = 0;
  let bendAngle = 0;
  let narrowFactor = 1.0;
  let phase = 0;

  function update(dt, chaosIntensity = 0, is3D = false) {
    phase += dt * 2.2;

    vertOffset = Math.sin(phase * 1.4) * 42 * chaosIntensity;
    bendAngle = Math.sin(phase * 0.9) * 0.18 * chaosIntensity;

    if (is3D) {
      narrowFactor = 0.55 + Math.sin(phase * 3) * 0.25;
    } else {
      narrowFactor = 1 - chaosIntensity * 0.5;
    }
  }

  function draw(ctx, W, H, groundY, chaosIntensity = 0, is3D = false) {
    const roadY = groundY + vertOffset;

    ctx.save();
    if (is3D) {
      // Fake 3D road with perspective
      const grad = ctx.createLinearGradient(0, roadY - 120, 0, roadY + 60);
      grad.addColorStop(0, '#0a0a0a');
      grad.addColorStop(1, '#1f1f2e');
      ctx.fillStyle = grad;
      ctx.fillRect(0, roadY - 120, W, 200);

      ctx.strokeStyle = '#ff4400';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(W*0.25 + bendAngle*W, roadY + 60);
      ctx.lineTo(W/2, roadY - 100);
      ctx.moveTo(W*0.75 + bendAngle*W, roadY + 60);
      ctx.lineTo(W/2, roadY - 100);
      ctx.stroke();
    } else {
      // Original style dynamic road
      ctx.fillStyle = '#11181f';
      ctx.fillRect(0, roadY - 12, W, 24);
    }
    ctx.restore();
  }

  return { update, draw };
})();
