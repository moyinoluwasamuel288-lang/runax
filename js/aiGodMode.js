/* ── RUNΔX · aiGodMode.js ─────────────────────────────
   God-mode AI controller (non-invasive).
   Can be safely removed without breaking game.
──────────────────────────────────────────────────────── */

const AIGodMode = (() => {

  let enabled = false;

  function toggle() {
    enabled = !enabled;
    console.log("GOD AI:", enabled ? "ON" : "OFF");
  }

  function isOn() {
    return enabled;
  }

  function update(player, obstacles, canvas) {
    if (!enabled) return;

    const list = obstacles.getActive?.() || obstacles.pool || [];

    let closest = null;
    let minDist = Infinity;

    for (let obs of list) {
      let dy = obs.y - (player.getY?.() ?? player.y);

      if (dy > 0 && dy < minDist) {
        minDist = dy;
        closest = obs;
      }
    }

    if (!closest) return;

    let px = player.getX?.() ?? player.x;
    let dx = closest.x - px;

    if (Math.abs(dx) < 80) {
      if (dx > 0) {
        player.moveLeft?.() || (player.x -= 6);
      } else {
        player.moveRight?.() || (player.x += 6);
      }
    }

    // Clamp bounds
    if (player.x < 10) player.x = 10;
    if (player.x > canvas.width - 40) {
      player.x = canvas.width - 40;
    }
  }

  return { toggle, update, isOn };

})();
