const Obstacles = (() => {

  let list = [];

  function spawn(x, y, type="normal") {
    list.push({ x, y, w:40, h:40, type });
  }

  function update(dt) {
    for (let o of list) {
      o.y += 300 * dt;
    }

    list = list.filter(o => o.y < window.innerHeight + 50);
  }

  function draw(ctx) {
    for (let o of list) {
      ctx.fillStyle = o.type === "platform" ? "purple" : "red";
      ctx.fillRect(o.x, o.y, o.w, o.h);
    }
  }

  function checkCollision(player) {
    for (let o of list) {

      // top platform safe
      if (o.type === "platform") {
        if (
          player.y + player.height <= o.y + 10 &&
          player.y + player.height >= o.y - 10 &&
          player.x + player.width > o.x &&
          player.x < o.x + o.w
        ) {
          player.y = o.y - player.height;
          return false;
        }
      }

      // normal collision
      if (
        player.x < o.x + o.w &&
        player.x + player.width > o.x &&
        player.y < o.y + o.h &&
        player.y + player.height > o.y
      ) {
        return true;
      }
    }

    return false;
  }

  function getActive() { return list; }

  return { spawn, update, draw, checkCollision, getActive };

})();
