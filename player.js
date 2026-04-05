const Player = (() => {

  let x, y, vy;
  const width = 28, height = 30;

  const GRAVITY = 1800;
  const JUMP_FORCE = -600;

  let groundY = 0;
  let onGround = false;

  function init(px, py) {
    x = px;
    y = py;
    groundY = py;
  }

  function update(dt) {
    vy += GRAVITY * dt;
    y += vy * dt;

    if (y >= groundY) {
      y = groundY;
      vy = 0;
      onGround = true;
    }
  }

  function jump() {
    if (onGround) {
      vy = JUMP_FORCE;
      onGround = false;
    }
  }

  function moveLeft() { x -= 40; }
  function moveRight() { x += 40; }

  function draw(ctx) {
    ctx.fillStyle = "white";
    ctx.fillRect(x, y, width, height);
  }

  return {
    init,
    update,
    jump,
    draw,
    moveLeft,
    moveRight,
    get x() { return x },
    set x(v) { x = v },
    get y() { return y },
    set y(v) { y = v },
    width,
    height
  };

})();
