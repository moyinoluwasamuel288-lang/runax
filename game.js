const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let score = 0;
let gameOver = false;

let lastTime = 0;

let colorShift = 0;

// powerups
let power = null;
let powerTimer = 0;

Player.init(canvas.width/2, canvas.height-100);

// controls
window.addEventListener("keydown", e => {
  if (e.code === "Space") Player.jump();
  if (e.key === "ArrowLeft") Player.moveLeft();
  if (e.key === "ArrowRight") Player.moveRight();

  if (e.key.toLowerCase() === "i") AIGodMode.toggle();
  if (e.key.toLowerCase() === "o") AIGodMode.toggleHuman();
});

function spawnLogic() {
  if (Math.random() < 0.03) {
    let x = Math.random() * (canvas.width - 40);
    Obstacles.spawn(x, -50);
  }

  // platform spawn
  if (Math.random() < 0.01) {
    let x = Math.random() * (canvas.width - 60);
    Obstacles.spawn(x, -50, "platform");
  }

  // thrill spike under jump
  if (Math.random() < 0.005) {
    Obstacles.spawn(Player.x, Player.y - 50);
  }
}

function powerups(dt) {
  if (powerTimer > 0) powerTimer -= dt;
  else power = null;

  if (Math.random() < 0.005) {
    let types = ["dash","immunity","growth"];
    power = types[Math.floor(Math.random()*types.length)];
    powerTimer = 3;
  }
}

function update(dt) {
  if (gameOver) return;

  spawnLogic();

  Player.update(dt);
  Obstacles.update(dt);

  AIGodMode.update(Player, Obstacles, canvas);

  if (!AIGodMode.isOn()) {
    if (Obstacles.checkCollision(Player)) {
      if (power !== "immunity" && power !== "growth") {
        gameOver = true;
      }
    }
  }

  powerups(dt);

  score += dt * 10;
}

function draw() {
  colorShift += 0.01;

  ctx.fillStyle = `hsl(${(colorShift*100)%360}, 30%, 10%)`;
  ctx.fillRect(0,0,canvas.width,canvas.height);

  Player.draw(ctx);
  Obstacles.draw(ctx);

  ctx.fillStyle = "white";
  ctx.fillText(Math.floor(score), 20, 40);

  if (gameOver) {
    ctx.fillText("GAME OVER", canvas.width/2 - 60, canvas.height/2);
  }
}

function loop(t) {
  let dt = (t - lastTime)/1000;
  lastTime = t;

  update(dt);
  draw();

  requestAnimationFrame(loop);
}

loop(0);
