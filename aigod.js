const AIGodMode = (() => {
  let enabled = false;
  let human = false;

  function toggle() { enabled = !enabled; }
  function toggleHuman() { human = !human; }
  function isOn() { return enabled; }

  function update(player, obstacles, canvas) {
    if (!enabled) return;

    let list = obstacles.getActive?.() || obstacles.pool || [];

    let closest = null;
    let min = Infinity;

    for (let o of list) {
      let dy = o.y - player.y;
      if (dy > 0 && dy < min) {
        min = dy;
        closest = o;
      }
    }

    if (!closest) return;

    let dx = closest.x - player.x;

    if (human && Math.random() < 0.2) return;

    if (Math.abs(dx) < 80) {
      if (dx > 0) player.moveLeft();
      else player.moveRight();
    }

    // never fall
    if (!human) {
      if (player.x < 0) player.x = 0;
      if (player.x > canvas.width - player.width)
        player.x = canvas.width - player.width;
    }
  }

  return { toggle, toggleHuman, update, isOn };
})();
