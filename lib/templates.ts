import type { GameTemplate } from './types';

export const TEMPLATES: GameTemplate[] = [
  {
    id: 'endless-runner',
    name: 'Cyber Runner',
    description: 'Fast-paced neon endless runner with double jump, sliding under airborne barriers, coin pickups, and speed scaling.',
    genre: 'Runner',
    tags: ['Canvas', 'Double Jump', 'Slide', 'Keyboard + Touch'],
    files: {
      'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Cyber Runner - Endless Arcade</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div id="game-wrapper">
    <div id="hud">
      <div class="hud-item">SCORE: <span id="score-val">0</span></div>
      <div class="hud-item">BEST: <span id="best-val">0</span></div>
      <div class="hud-item">SPEED: <span id="speed-val">1.0x</span></div>
    </div>
    <canvas id="game-canvas" width="800" height="400"></canvas>
    <div id="touch-controls">
      <button id="btn-slide" class="touch-btn">SLIDE (DOWN)</button>
      <button id="btn-jump" class="touch-btn">JUMP (UP/SPACE)</button>
    </div>
  </div>
  <script src="game.js"></script>
</body>
</html>`,
      'style.css': `* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  user-select: none;
  -webkit-user-select: none;
}
body {
  background: #090d16;
  color: #f1f5f9;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  overflow: hidden;
}
#game-wrapper {
  position: relative;
  width: 100%;
  max-width: 800px;
  background: #0b0f19;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
  border: 1px solid #1e293b;
}
#hud {
  position: absolute;
  top: 12px;
  left: 16px;
  right: 16px;
  display: flex;
  justify-content: space-between;
  font-family: monospace;
  font-size: 14px;
  font-weight: bold;
  color: #38bdf8;
  z-index: 10;
  text-shadow: 0 0 8px rgba(56, 189, 248, 0.6);
  pointer-events: none;
}
canvas {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 2 / 1;
}
#touch-controls {
  position: absolute;
  bottom: 12px;
  left: 12px;
  right: 12px;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  z-index: 10;
}
.touch-btn {
  flex: 1;
  background: rgba(30, 41, 59, 0.7);
  border: 1px solid rgba(56, 189, 248, 0.4);
  color: #e2e8f0;
  padding: 12px;
  font-size: 13px;
  font-weight: bold;
  border-radius: 8px;
  backdrop-filter: blur(4px);
  cursor: pointer;
  touch-action: manipulation;
  transition: background 0.1s, transform 0.1s;
}
.touch-btn:active {
  background: rgba(56, 189, 248, 0.4);
  transform: scale(0.96);
}`,
      'game.js': `// Cyber Runner - Pure Canvas & WebAudio Endless Runner
(function() {
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score-val');
  const bestEl = document.getElementById('best-val');
  const speedEl = document.getElementById('speed-val');

  let audioCtx = null;
  function playSound(type) {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      const now = audioCtx.currentTime;

      if (type === 'jump') {
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(450, now + 0.15);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (type === 'slide') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.linearRampToValueAtTime(80, now + 0.15);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (type === 'coin') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now);
        osc.frequency.setValueAtTime(880, now + 0.08);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (type === 'crash') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.linearRampToValueAtTime(40, now + 0.35);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      }
    } catch(e) {}
  }

  let score = 0;
  let highScore = parseInt(localStorage.getItem('cr_highscore') || '0', 10);
  bestEl.textContent = highScore;
  let gameSpeed = 6;
  let isGameOver = false;
  let particles = [];
  let stars = [];
  let obstacles = [];
  let coins = [];
  let frameCount = 0;

  const GROUND_Y = 320;

  const player = {
    x: 80,
    y: GROUND_Y - 48,
    width: 32,
    height: 48,
    normalHeight: 48,
    slideHeight: 24,
    vy: 0,
    gravity: 0.8,
    isGrounded: true,
    jumpCount: 0,
    maxJumps: 2,
    isSliding: false,
    slideTimer: 0
  };

  for (let i = 0; i < 40; i++) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * (GROUND_Y - 40),
      size: Math.random() * 2 + 1,
      speed: Math.random() * 0.5 + 0.2
    });
  }

  function resetGame() {
    score = 0;
    gameSpeed = 6;
    isGameOver = false;
    obstacles = [];
    coins = [];
    particles = [];
    player.y = GROUND_Y - player.normalHeight;
    player.height = player.normalHeight;
    player.vy = 0;
    player.isGrounded = true;
    player.jumpCount = 0;
    player.isSliding = false;
    frameCount = 0;
    scoreEl.textContent = '0';
    speedEl.textContent = '1.0x';
  }

  function jump() {
    if (isGameOver) {
      resetGame();
      return;
    }
    if (player.jumpCount < player.maxJumps) {
      player.vy = -13.5;
      player.isGrounded = false;
      player.jumpCount++;
      player.isSliding = false;
      player.height = player.normalHeight;
      playSound('jump');
      for (let i = 0; i < 6; i++) {
        particles.push({
          x: player.x + player.width / 2,
          y: player.y + player.height,
          vx: (Math.random() - 0.5) * 4,
          vy: Math.random() * -2,
          color: '#38bdf8',
          life: 20
        });
      }
    }
  }

  function slide() {
    if (isGameOver) {
      resetGame();
      return;
    }
    if (player.isGrounded && !player.isSliding) {
      player.isSliding = true;
      player.slideTimer = 35;
      player.height = player.slideHeight;
      player.y = GROUND_Y - player.slideHeight;
      playSound('slide');
    }
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
      e.preventDefault();
      jump();
    } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
      e.preventDefault();
      slide();
    }
  });

  const btnJump = document.getElementById('btn-jump');
  const btnSlide = document.getElementById('btn-slide');
  btnJump.addEventListener('touchstart', (e) => { e.preventDefault(); jump(); });
  btnJump.addEventListener('mousedown', (e) => { e.preventDefault(); jump(); });
  btnSlide.addEventListener('touchstart', (e) => { e.preventDefault(); slide(); });
  btnSlide.addEventListener('mousedown', (e) => { e.preventDefault(); slide(); });
  canvas.addEventListener('pointerdown', () => { if (isGameOver) resetGame(); });

  function spawnEntities() {
    frameCount++;
    if (frameCount % Math.max(45, Math.floor(90 - gameSpeed * 3)) === 0) {
      const type = Math.random() < 0.6 ? 'ground' : 'flying';
      if (type === 'ground') {
        const h = 36 + Math.random() * 20;
        obstacles.push({
          x: canvas.width,
          y: GROUND_Y - h,
          width: 24 + Math.random() * 10,
          height: h,
          color: '#f43f5e'
        });
      } else {
        obstacles.push({
          x: canvas.width,
          y: GROUND_Y - 75,
          width: 32,
          height: 24,
          color: '#e11d48'
        });
      }
      if (Math.random() < 0.5) {
        coins.push({
          x: canvas.width + 60,
          y: GROUND_Y - 90 - Math.random() * 30,
          radius: 9
        });
      }
    }
  }

  function update() {
    if (isGameOver) return;
    score++;
    scoreEl.textContent = score;
    if (score > highScore) {
      highScore = score;
      bestEl.textContent = highScore;
      localStorage.setItem('cr_highscore', String(highScore));
    }
    if (score % 250 === 0) {
      gameSpeed = Math.min(gameSpeed + 0.35, 14);
      speedEl.textContent = (gameSpeed / 6).toFixed(1) + 'x';
    }
    if (!player.isGrounded) {
      player.vy += player.gravity;
      player.y += player.vy;
      if (player.y >= GROUND_Y - player.height) {
        player.y = GROUND_Y - player.height;
        player.vy = 0;
        player.isGrounded = true;
        player.jumpCount = 0;
      }
    }
    if (player.isSliding) {
      player.slideTimer--;
      if (player.slideTimer <= 0) {
        player.isSliding = false;
        player.height = player.normalHeight;
        player.y = GROUND_Y - player.normalHeight;
      }
    }
    for (let s of stars) {
      s.x -= s.speed * (gameSpeed * 0.4);
      if (s.x < 0) s.x = canvas.width;
    }
    spawnEntities();
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obs = obstacles[i];
      obs.x -= gameSpeed;
      if (
        player.x < obs.x + obs.width &&
        player.x + player.width > obs.x &&
        player.y < obs.y + obs.height &&
        player.y + player.height > obs.y
      ) {
        isGameOver = true;
        playSound('crash');
        for (let p = 0; p < 25; p++) {
          particles.push({
            x: player.x + player.width / 2,
            y: player.y + player.height / 2,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10,
            color: p % 2 === 0 ? '#38bdf8' : '#f43f5e',
            life: 40
          });
        }
      }
      if (obs.x + obs.width < 0) obstacles.splice(i, 1);
    }
    for (let i = coins.length - 1; i >= 0; i--) {
      const c = coins[i];
      c.x -= gameSpeed;
      const closeX = Math.max(player.x, Math.min(c.x, player.x + player.width));
      const closeY = Math.max(player.y, Math.min(c.y, player.y + player.height));
      if (Math.hypot(c.x - closeX, c.y - closeY) < c.radius) {
        score += 50;
        playSound('coin');
        for (let k = 0; k < 8; k++) {
          particles.push({
            x: c.x, y: c.y,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6,
            color: '#fbbf24', life: 25
          });
        }
        coins.splice(i, 1);
      } else if (c.x + c.radius < 0) {
        coins.splice(i, 1);
      }
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const skyGrad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    skyGrad.addColorStop(0, '#090d16');
    skyGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, canvas.width, GROUND_Y);

    ctx.fillStyle = '#94a3b8';
    for (let s of stars) ctx.fillRect(s.x, s.y, s.size, s.size);

    ctx.fillStyle = '#060911';
    ctx.fillRect(0, GROUND_Y, canvas.width, canvas.height - GROUND_Y);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(canvas.width, GROUND_Y);
    ctx.stroke();

    for (let c of coins) {
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let obs of obstacles) {
      ctx.fillStyle = obs.color;
ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
}
    if (!isGameOver) {
      ctx.fillStyle = '#38bdf8';
ctx.fillRect(player.x, player.y, player.width, player.height);
      ctx.fillStyle = '#f43f5e';
      ctx.fillRect(player.x + 18, player.y + 8, 12, 6);
}
    for (let p of particles) {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, 3, 3);
    }
    if (isGameOver) {
      ctx.fillStyle = 'rgba(9, 13, 22, 0.85)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#f43f5e';
      ctx.font = 'bold 36px monospace';
      ctx.fillText('CRASHED!', canvas.width / 2, canvas.height / 2 - 20);
      ctx.fillStyle = '#f1f5f9';
      ctx.font = '16px sans-serif';
      ctx.fillText('Final Score: ' + score + '  |  Best: ' + highScore, canvas.width / 2, canvas.height / 2 + 20);
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 15px monospace';
      ctx.fillText('TAP OR PRESS SPACE TO RESTART', canvas.width / 2, canvas.height / 2 + 60);
    }
  }

  let lastTime = performance.now();
  const step = 1000 / 60;
  let accumulator = 0;

  function loop(currentTime) {
    if (!currentTime) currentTime = performance.now();
    const elapsed = Math.min(currentTime - lastTime, 100);
    lastTime = currentTime;
    accumulator += elapsed;

    while (accumulator >= step) {
      update();
      accumulator -= step;
    }
    draw();
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
})();`
    }
  },
  {
    id: 'snake',
    name: 'Cyber Snake',
    description: 'Retro arcade snake with smooth grid movement, golden fruit, length tracking, responsive touch D-pad, and audio chimes.',
    genre: 'Arcade',
    tags: ['Grid', 'Classic', 'Touch D-Pad', 'Golden Fruit'],
    files: {
      'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Cyber Snake Arcade</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div id="game-container">
    <div id="header">
      <div class="stat">SCORE: <span id="score">0</span></div>
      <div class="stat">HIGH: <span id="high-score">0</span></div>
      <div class="stat">LENGTH: <span id="length">3</span></div>
    </div>
    <canvas id="snake-canvas" width="400" height="400"></canvas>
    <div id="dpad">
      <div class="dpad-row">
        <button id="btn-up" class="dpad-btn" aria-label="Up">▲</button>
      </div>
      <div class="dpad-row middle">
        <button id="btn-left" class="dpad-btn" aria-label="Left">◀</button>
        <button id="btn-center" class="dpad-btn center" aria-label="Action">●</button>
        <button id="btn-right" class="dpad-btn" aria-label="Right">▶</button>
      </div>
      <div class="dpad-row">
        <button id="btn-down" class="dpad-btn" aria-label="Down">▼</button>
      </div>
    </div>
  </div>
  <script src="game.js"></script>
</body>
</html>`,
      'style.css': `* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  user-select: none;
  -webkit-user-select: none;
}
body {
  background: #090d16;
  color: #f1f5f9;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  overflow: hidden;
  padding: 10px;
}
#game-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #0f172a;
  border: 1px solid #1e293b;
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7);
  max-width: 440px;
  width: 100%;
}
#header {
  width: 100%;
  display: flex;
  justify-content: space-between;
  font-family: monospace;
  font-size: 14px;
  font-weight: bold;
  color: #22c55e;
  margin-bottom: 12px;
  text-shadow: 0 0 8px rgba(34, 197, 94, 0.5);
}
canvas {
  background: #020617;
  border: 2px solid #334155;
  border-radius: 8px;
  display: block;
  max-width: 100%;
  aspect-ratio: 1 / 1;
}
#dpad {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.dpad-row {
  display: flex;
  gap: 6px;
}
.dpad-btn {
  width: 48px;
  height: 48px;
  background: #1e293b;
  border: 1px solid #475569;
  color: #e2e8f0;
  border-radius: 10px;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  touch-action: manipulation;
  transition: all 0.1s;
}
.dpad-btn:active {
  background: #22c55e;
  color: #020617;
  transform: scale(0.92);
}
.dpad-btn.center {
  background: #0f172a;
  color: #64748b;
  font-size: 12px;
}`,
      'game.js': `// Cyber Snake Arcade - Pure Canvas & WebAudio
(function() {
  const canvas = document.getElementById('snake-canvas');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const highScoreEl = document.getElementById('high-score');
  const lengthEl = document.getElementById('length');

  let audioCtx = null;
  function playSound(type) {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      const now = audioCtx.currentTime;

      if (type === 'eat') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
      } else if (type === 'golden') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.08);
        osc.frequency.setValueAtTime(783.99, now + 0.16);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.28);
        osc.start(now);
        osc.stop(now + 0.28);
      } else if (type === 'die') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.linearRampToValueAtTime(55, now + 0.35);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      }
    } catch(e) {}
  }

  const GRID_SIZE = 20;
  const TILE_COUNT = canvas.width / GRID_SIZE;

  let snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
  let velocity = { x: 1, y: 0 };
  let nextVelocity = { x: 1, y: 0 };
  let food = { x: 15, y: 10, isGolden: false };
  let score = 0;
  let highScore = parseInt(localStorage.getItem('snake_highscore') || '0', 10);
  highScoreEl.textContent = highScore;
  let isGameOver = false;
  let particles = [];
  let moveInterval = 110;
  let lastMoveTime = 0;

  function spawnFood() {
    let valid = false;
    let newX = 0, newY = 0;
    while (!valid) {
      newX = Math.floor(Math.random() * TILE_COUNT);
      newY = Math.floor(Math.random() * TILE_COUNT);
      valid = !snake.some(segment => segment.x === newX && segment.y === newY);
    }
    food = { x: newX, y: newY, isGolden: Math.random() < 0.25 };
  }

  function resetGame() {
    snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
    velocity = { x: 1, y: 0 };
    nextVelocity = { x: 1, y: 0 };
    score = 0;
    moveInterval = 110;
    isGameOver = false;
    particles = [];
    scoreEl.textContent = '0';
    lengthEl.textContent = '3';
    spawnFood();
  }

  function setDirection(dx, dy) {
    if (isGameOver) { resetGame(); return; }
    if (dx !== 0 && velocity.x === -dx) return;
    if (dy !== 0 && velocity.y === -dy) return;
    nextVelocity = { x: dx, y: dy };
  }

  window.addEventListener('keydown', (e) => {
    switch (e.code) {
      case 'ArrowUp': case 'KeyW': e.preventDefault(); setDirection(0, -1); break;
      case 'ArrowDown': case 'KeyS': e.preventDefault(); setDirection(0, 1); break;
      case 'ArrowLeft': case 'KeyA': e.preventDefault(); setDirection(-1, 0); break;
      case 'ArrowRight': case 'KeyD': e.preventDefault(); setDirection(1, 0); break;
      case 'Space': e.preventDefault(); if (isGameOver) resetGame(); break;
    }
  });

  document.getElementById('btn-up').addEventListener('pointerdown', () => setDirection(0, -1));
  document.getElementById('btn-down').addEventListener('pointerdown', () => setDirection(0, 1));
  document.getElementById('btn-left').addEventListener('pointerdown', () => setDirection(-1, 0));
  document.getElementById('btn-right').addEventListener('pointerdown', () => setDirection(1, 0));
  canvas.addEventListener('pointerdown', () => { if (isGameOver) resetGame(); });

  function update() {
    if (isGameOver) return;
    velocity = { ...nextVelocity };
    const head = { x: snake[0].x + velocity.x, y: snake[0].y + velocity.y };

    if (head.x < 0 || head.x >= TILE_COUNT || head.y < 0 || head.y >= TILE_COUNT) {
      isGameOver = true;
      playSound('die');
      return;
    }
    for (let i = 0; i < snake.length; i++) {
      if (head.x === snake[i].x && head.y === snake[i].y) {
        isGameOver = true;
        playSound('die');
        return;
      }
    }

    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
      score += food.isGolden ? 50 : 10;
      scoreEl.textContent = score;
      lengthEl.textContent = snake.length;
      if (score > highScore) {
        highScore = score;
        highScoreEl.textContent = highScore;
        localStorage.setItem('snake_highscore', String(highScore));
      }
      playSound(food.isGolden ? 'golden' : 'eat');
      moveInterval = Math.max(60, 110 - Math.floor(score / 30) * 4);
      spawnFood();
    } else {
      snake.pop();
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = food.isGolden ? '#fbbf24' : '#22c55e';
    ctx.beginPath();
    ctx.arc((food.x + 0.5) * GRID_SIZE, (food.y + 0.5) * GRID_SIZE, GRID_SIZE * 0.42, 0, Math.PI * 2);
    ctx.fill();

    for (let i = 0; i < snake.length; i++) {
      const seg = snake[i];
      ctx.fillStyle = i === 0 ? '#38bdf8' : '#0284c7';
      ctx.fillRect(seg.x * GRID_SIZE + 1.5, seg.y * GRID_SIZE + 1.5, GRID_SIZE - 3, GRID_SIZE - 3);
    }

    if (isGameOver) {
      ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 30px monospace';
      ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 20);
      ctx.fillStyle = '#f1f5f9';
      ctx.font = '14px sans-serif';
      ctx.fillText('Score: ' + score + '  |  Best: ' + highScore, canvas.width / 2, canvas.height / 2 + 15);
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 13px monospace';
      ctx.fillText('PRESS SPACE OR TAP TO RESTART', canvas.width / 2, canvas.height / 2 + 50);
    }
  }

  function gameLoop(currentTime) {
    if (currentTime - lastMoveTime >= moveInterval) {
      update();
      lastMoveTime = currentTime;
    }
    draw();
    requestAnimationFrame(gameLoop);
  }
  spawnFood();
  requestAnimationFrame(gameLoop);
})();`
    }
  },
  {
    id: 'flappy',
    name: 'Neon Flap',
    description: 'Precision physics one-tap flapper with randomized pipe gaps, particle effects, high-score tracking, and synthesized audio.',
    genre: 'Flappy',
    tags: ['Physics', 'One-Tap', 'Pipes', 'Medals'],
    files: {
      'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Neon Flap Arcade</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div id="game-container">
    <div id="hud">
      <div id="score">0</div>
      <div id="best-score">BEST: 0</div>
    </div>
    <canvas id="flappy-canvas" width="360" height="540"></canvas>
    <div id="mobile-prompt">TAP SCREEN OR PRESS SPACE TO FLAP</div>
  </div>
  <script src="game.js"></script>
</body>
</html>`,
      'style.css': `* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  user-select: none;
  -webkit-user-select: none;
}
body {
  background: #090d16;
  color: #f1f5f9;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  overflow: hidden;
}
#game-container {
  position: relative;
  width: 100%;
  max-width: 360px;
  background: #050b14;
  border: 1px solid #1e293b;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7);
}
#hud {
  position: absolute;
  top: 16px;
  left: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: none;
  z-index: 10;
}
#score {
  font-family: monospace;
  font-size: 36px;
  font-weight: 900;
  color: #ffffff;
  text-shadow: 0 0 10px rgba(99, 102, 241, 0.8), 0 2px 4px rgba(0, 0, 0, 0.8);
}
#best-score {
  font-family: monospace;
  font-size: 11px;
  color: #cbd5e1;
  letter-spacing: 1px;
}
canvas {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 2 / 3;
}
#mobile-prompt {
  position: absolute;
  bottom: 12px;
  left: 0;
  right: 0;
  text-align: center;
  font-family: monospace;
  font-size: 11px;
  color: #64748b;
  pointer-events: none;
  z-index: 10;
}`,
      'game.js': `// Neon Flap Arcade - Pure Canvas & WebAudio
(function() {
  const canvas = document.getElementById('flappy-canvas');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const bestScoreEl = document.getElementById('best-score');

  let audioCtx = null;
  function playSound(type) {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      const now = audioCtx.currentTime;

      if (type === 'flap') {
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.12);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
      } else if (type === 'point') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      } else if (type === 'hit') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(240, now);
        osc.frequency.linearRampToValueAtTime(60, now + 0.3);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      }
    } catch(e) {}
  }

  let state = 'READY';
  let score = 0;
  let highScore = parseInt(localStorage.getItem('flappy_highscore') || '0', 10);
  bestScoreEl.textContent = 'BEST: ' + highScore;

  const bird = {
    x: 70,
    y: canvas.height / 2,
    radius: 14,
    velocity: 0,
    gravity: 0.38,
    jump: -6.8,
    rotation: 0
  };

  const pipes = [];
  const PIPE_WIDTH = 52;
  const PIPE_GAP = 130;
  let pipeTimer = 0;
  let stars = [];

  for (let i = 0; i < 30; i++) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 2 + 1,
      speed: Math.random() * 0.4 + 0.2
    });
  }

  function reset() {
    state = 'READY';
    score = 0;
    scoreEl.textContent = '0';
    bird.y = canvas.height / 2;
    bird.velocity = 0;
    pipes.length = 0;
  }

  function flap() {
    if (state === 'READY') {
      state = 'PLAYING';
      bird.velocity = bird.jump;
      playSound('flap');
    } else if (state === 'PLAYING') {
      bird.velocity = bird.jump;
      playSound('flap');
    } else if (state === 'GAMEOVER') {
      reset();
    }
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
      e.preventDefault();
      flap();
    }
  });

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    flap();
  });

  function update() {
    for (let s of stars) {
      s.x -= s.speed * (state === 'PLAYING' ? 2 : 0.8);
      if (s.x < 0) s.x = canvas.width;
    }

    if (state === 'READY') {
      bird.y = canvas.height / 2 + Math.sin(Date.now() / 250) * 8;
      return;
    }

    if (state === 'PLAYING') {
      bird.velocity += bird.gravity;
      bird.y += bird.velocity;
      bird.rotation = Math.min(Math.PI / 4, Math.max(-Math.PI / 4, bird.velocity * 0.08));

      if (bird.y + bird.radius >= canvas.height - 24 || bird.y - bird.radius <= 0) {
        state = 'GAMEOVER';
        playSound('hit');
      }

      pipeTimer++;
      if (pipeTimer >= 95) {
        pipeTimer = 0;
        const topH = Math.floor(Math.random() * (canvas.height - 240)) + 60;
        pipes.push({
          x: canvas.width,
          top: topH,
          bottom: canvas.height - (topH + PIPE_GAP) - 24,
          passed: false
        });
      }

      for (let i = pipes.length - 1; i >= 0; i--) {
        const p = pipes[i];
        p.x -= 2.5;

        if (!p.passed && p.x + PIPE_WIDTH < bird.x) {
          p.passed = true;
          score++;
          scoreEl.textContent = score;
          if (score > highScore) {
            highScore = score;
            bestScoreEl.textContent = 'BEST: ' + highScore;
            localStorage.setItem('flappy_highscore', String(highScore));
          }
          playSound('point');
        }

        if (
          bird.x + bird.radius > p.x &&
          bird.x - bird.radius < p.x + PIPE_WIDTH &&
          (bird.y - bird.radius < p.top || bird.y + bird.radius > canvas.height - 24 - p.bottom)
        ) {
          state = 'GAMEOVER';
          playSound('hit');
        }

        if (p.x + PIPE_WIDTH < 0) pipes.splice(i, 1);
      }
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
    sky.addColorStop(0, '#090d16');
    sky.addColorStop(1, '#1e1b4b');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#cbd5e1';
    for (let s of stars) ctx.fillRect(s.x, s.y, s.size, s.size);

    for (let p of pipes) {
      ctx.fillStyle = '#4f46e5';
      ctx.fillRect(p.x, 0, PIPE_WIDTH, p.top);
      ctx.fillRect(p.x, canvas.height - 24 - p.bottom, PIPE_WIDTH, p.bottom);
    }

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, canvas.height - 24, canvas.width, 24);

    ctx.save();
    ctx.translate(bird.x, bird.y);
    ctx.rotate(bird.rotation);
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(0, 0, bird.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.arc(6, -2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (state === 'READY') {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 20px monospace';
      ctx.fillText('TAP TO PLAY', canvas.width / 2, canvas.height / 2 - 50);
    } else if (state === 'GAMEOVER') {
      ctx.fillStyle = 'rgba(9, 13, 22, 0.85)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#f43f5e';
      ctx.font = 'bold 28px monospace';
      ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 30);
      ctx.fillStyle = '#f8fafc';
      ctx.font = '14px sans-serif';
      ctx.fillText('Score: ' + score + '  |  Best: ' + highScore, canvas.width / 2, canvas.height / 2 + 5);
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 13px monospace';
      ctx.fillText('TAP TO RESTART', canvas.width / 2, canvas.height / 2 + 45);
    }
  }

  let lastTime = performance.now();
  const step = 1000 / 60;
  let accumulator = 0;

  function loop(currentTime) {
    if (!currentTime) currentTime = performance.now();
    const elapsed = Math.min(currentTime - lastTime, 100);
    lastTime = currentTime;
    accumulator += elapsed;

    while (accumulator >= step) {
      update();
      accumulator -= step;
    }
    draw();
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
})();`
    }
  },
  {
    id: 'space-shooter',
    name: 'Galaxy Defender',
    description: 'Vertical space shooter with incoming alien waves, dual lasers, shields, particle explosions, and touch-drag support.',
    genre: 'Shooter',
    tags: ['Space', 'Lasers', 'Waves', 'Shields'],
    files: {
      'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Galaxy Defender - Space Shooter</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div id="game-container">
    <div id="hud">
      <div>SCORE: <span id="score">0</span></div>
      <div>WAVE: <span id="wave">1</span></div>
      <div>SHIELDS: <span id="shields">❤️❤️❤️</span></div>
    </div>
    <canvas id="shooter-canvas" width="480" height="640"></canvas>
    <div id="touch-bar">
      <div id="touch-hint">DRAG TO MOVE · TAP RIGHT TO FIRE</div>
      <button id="btn-fire" class="fire-btn">FIRE LASER</button>
    </div>
  </div>
  <script src="game.js"></script>
</body>
</html>`,
      'style.css': `* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  user-select: none;
  -webkit-user-select: none;
}
body {
  background: #090d16;
  color: #f1f5f9;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  overflow: hidden;
  padding: 8px;
}
#game-container {
  position: relative;
  width: 100%;
  max-width: 480px;
  background: #030712;
  border: 1px solid #1e293b;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7);
}
#hud {
  position: absolute;
  top: 12px;
  left: 16px;
  right: 16px;
  display: flex;
  justify-content: space-between;
  font-family: monospace;
  font-size: 13px;
  font-weight: bold;
  color: #38bdf8;
  z-index: 10;
  pointer-events: none;
}
canvas {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 3 / 4;
}
#touch-bar {
  position: absolute;
  bottom: 12px;
  left: 12px;
  right: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 10;
}
#touch-hint {
  font-family: monospace;
  font-size: 10px;
  color: #64748b;
  pointer-events: none;
}
.fire-btn {
  background: rgba(239, 68, 68, 0.8);
  border: 1px solid #f87171;
  color: #ffffff;
  padding: 10px 18px;
  font-size: 12px;
  font-weight: bold;
  border-radius: 8px;
  cursor: pointer;
}`,
      'game.js': `// Galaxy Defender - Pure Canvas & WebAudio Space Shooter
(function() {
  const canvas = document.getElementById('shooter-canvas');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const waveEl = document.getElementById('wave');
  const shieldsEl = document.getElementById('shields');
  const fireBtn = document.getElementById('btn-fire');

  let audioCtx = null;
  function playSound(type) {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      const now = audioCtx.currentTime;

      if (type === 'laser') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(160, now + 0.12);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
      } else if (type === 'explode') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.linearRampToValueAtTime(30, now + 0.25);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      }
    } catch(e) {}
  }

  let score = 0;
  let wave = 1;
  let lives = 3;
  let isGameOver = false;

  const player = {
    x: canvas.width / 2,
    y: canvas.height - 70,
    width: 36,
    height: 38,
    speed: 6.5,
    cooldown: 0
  };

  const lasers = [];
  const enemies = [];
  const stars = [];

  for (let i = 0; i < 65; i++) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 2 + 0.8,
      speed: Math.random() * 2 + 0.5
    });
  }

  function updateShieldsDisplay() {
    let s = '';
    for (let i = 0; i < lives; i++) s += '❤️';
    shieldsEl.textContent = s || 'CRITICAL';
  }

  function resetGame() {
    score = 0;
    wave = 1;
    lives = 3;
    isGameOver = false;
    player.x = canvas.width / 2;
    lasers.length = 0;
    enemies.length = 0;
    scoreEl.textContent = '0';
    waveEl.textContent = '1';
    updateShieldsDisplay();
  }

  const keys = {};
  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'Space') {
      e.preventDefault();
      if (isGameOver) resetGame();
      else shootLaser();
    }
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });

  let pointerDragging = false;
  canvas.addEventListener('pointerdown', (e) => {
    if (isGameOver) { resetGame(); return; }
    pointerDragging = true;
    updatePointer(e);
  });
  canvas.addEventListener('pointermove', (e) => { if (pointerDragging) updatePointer(e); });
  window.addEventListener('pointerup', () => { pointerDragging = false; });

  function updatePointer(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    player.x = Math.max(20, Math.min(canvas.width - 20, (clientX / rect.width) * canvas.width));
  }

  function shootLaser() {
    if (player.cooldown <= 0 && !isGameOver) {
      lasers.push({ x: player.x - 10, y: player.y - 10, vy: -11 });
      lasers.push({ x: player.x + 10, y: player.y - 10, vy: -11 });
      player.cooldown = 14;
      playSound('laser');
    }
  }

  fireBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (isGameOver) resetGame();
    else shootLaser();
  });

  let spawnTimer = 0;
  function update() {
    if (isGameOver) return;
    if (keys['ArrowLeft'] || keys['KeyA']) player.x -= player.speed;
    if (keys['ArrowRight'] || keys['KeyD']) player.x += player.speed;
    player.x = Math.max(player.width / 2, Math.min(canvas.width - player.width / 2, player.x));

    if (player.cooldown > 0) player.cooldown--;

    for (let s of stars) {
      s.y += s.speed;
      if (s.y > canvas.height) { s.y = 0; s.x = Math.random() * canvas.width; }
    }

    spawnTimer++;
    if (spawnTimer >= Math.max(35, 75 - wave * 4)) {
      spawnTimer = 0;
      enemies.push({
        x: Math.random() * (canvas.width - 50) + 25,
        y: -30,
        vx: (Math.random() - 0.5) * 2,
        vy: Math.random() * 1.5 + 2,
        width: 26,
        height: 24,
        hp: 1
      });
    }

    for (let i = lasers.length - 1; i >= 0; i--) {
      lasers[i].y += lasers[i].vy;
      if (lasers[i].y < -10) lasers.splice(i, 1);
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
      const en = enemies[i];
      en.x += en.vx;
      en.y += en.vy;

      for (let j = lasers.length - 1; j >= 0; j--) {
        const l = lasers[j];
        if (Math.hypot(l.x - en.x, l.y - en.y) < 22) {
          lasers.splice(j, 1);
          enemies.splice(i, 1);
          score += 25;
          scoreEl.textContent = score;
          playSound('explode');
          if (score >= wave * 400) { wave++; waveEl.textContent = wave; }
          break;
        }
      }

      if (en && Math.hypot(player.x - en.x, player.y - en.y) < 26) {
        enemies.splice(i, 1);
        lives--;
        updateShieldsDisplay();
        playSound('explode');
        if (lives <= 0) isGameOver = true;
      }

      if (en && en.y > canvas.height + 40) enemies.splice(i, 1);
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#030712';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#f8fafc';
    for (let s of stars) ctx.fillRect(s.x, s.y, s.size, s.size);

    ctx.fillStyle = '#38bdf8';
    for (let l of lasers) ctx.fillRect(l.x - 2, l.y - 10, 4, 14);

    ctx.fillStyle = '#ef4444';
    for (let en of enemies) {
      ctx.beginPath();
      ctx.arc(en.x, en.y, 13, 0, Math.PI * 2);
      ctx.fill();
    }

    if (!isGameOver) {
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(player.x, player.y - 18);
      ctx.lineTo(player.x - 18, player.y + 16);
      ctx.lineTo(player.x + 18, player.y + 16);
      ctx.closePath();
      ctx.fill();
    }

    if (isGameOver) {
      ctx.fillStyle = 'rgba(3, 7, 18, 0.88)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 32px monospace';
      ctx.fillText('MISSION FAILED', canvas.width / 2, canvas.height / 2 - 20);
      ctx.fillStyle = '#f1f5f9';
      ctx.font = '15px sans-serif';
      ctx.fillText('Score: ' + score + '  |  Wave: ' + wave, canvas.width / 2, canvas.height / 2 + 15);
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 14px monospace';
      ctx.fillText('TAP OR PRESS SPACE TO RETRY', canvas.width / 2, canvas.height / 2 + 55);
    }
  }

  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }
  loop();
})();`
    }
  },
  {
    id: 'platformer',
    name: 'Castle Quest',
    description: 'Precision multi-platform jump-and-run with moving platforms, coin collection, hazard spikes, and stage exit flag.',
    genre: 'Platformer',
    tags: ['Physics', 'Coins', 'Spikes', 'Flag Goal'],
    files: {
      'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Castle Quest - Precision Platformer</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div id="game-container">
    <div id="hud">
      <div>COINS: <span id="coins">0</span> / <span id="total-coins">6</span></div>
      <div>STAGE: <span id="stage">1</span></div>
      <div>STATUS: <span id="status">EXPLORING</span></div>
    </div>
    <canvas id="platform-canvas" width="600" height="380"></canvas>
    <div id="controls-panel">
      <div class="dir-group">
        <button id="btn-left" class="ctl-btn">◀ LEFT</button>
        <button id="btn-right" class="ctl-btn">RIGHT ▶</button>
      </div>
      <button id="btn-jump" class="ctl-btn jump-btn">JUMP (SPACE/UP)</button>
    </div>
  </div>
  <script src="game.js"></script>
</body>
</html>`,
      'style.css': `* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  user-select: none;
  -webkit-user-select: none;
}
body {
  background: #090d16;
  color: #f1f5f9;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  overflow: hidden;
  padding: 8px;
}
#game-container {
  position: relative;
  width: 100%;
  max-width: 600px;
  background: #0b0f19;
  border: 1px solid #1e293b;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7);
}
#hud {
  position: absolute;
  top: 10px;
  left: 14px;
  right: 14px;
  display: flex;
  justify-content: space-between;
  font-family: monospace;
  font-size: 13px;
  font-weight: bold;
  color: #fbbf24;
  z-index: 10;
  pointer-events: none;
}
canvas {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 600 / 380;
}
#controls-panel {
  display: flex;
  justify-content: space-between;
  padding: 10px 14px;
  background: #0f172a;
  border-top: 1px solid #1e293b;
  gap: 12px;
}
.dir-group {
  display: flex;
  gap: 8px;
  flex: 1;
}
.ctl-btn {
  flex: 1;
  background: #1e293b;
  border: 1px solid #334155;
  color: #f1f5f9;
  padding: 10px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: bold;
  cursor: pointer;
  touch-action: manipulation;
}
.jump-btn {
  background: #4f46e5;
  border-color: #6366f1;
}`,
      'game.js': `// Castle Quest - Precision Platformer with WebAudio
(function() {
  const canvas = document.getElementById('platform-canvas');
  const ctx = canvas.getContext('2d');
  const coinsEl = document.getElementById('coins');
  const statusEl = document.getElementById('status');

  let audioCtx = null;
  function playSound(type) {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      const now = audioCtx.currentTime;

      if (type === 'jump') {
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(420, now + 0.12);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
      } else if (type === 'coin') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(659.25, now);
        osc.frequency.setValueAtTime(880, now + 0.08);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (type === 'die') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.linearRampToValueAtTime(55, now + 0.35);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      }
    } catch(e) {}
  }

  let coinsCollected = 0;
  let isGameOver = false;
  let isStageCleared = false;

  const player = {
    x: 40,
    y: 280,
    width: 20,
    height: 28,
    vx: 0,
    vy: 0,
    speed: 3.8,
    jumpForce: -10.5,
    gravity: 0.55,
    grounded: false
  };

  const platforms = [
    { x: 0, y: 340, width: 600, height: 40 },
    { x: 120, y: 270, width: 100, height: 16 },
    { x: 260, y: 220, width: 90, height: 16 },
    { x: 140, y: 160, width: 80, height: 16 },
    { x: 380, y: 170, width: 110, height: 16 },
    { x: 490, y: 260, width: 90, height: 16 }
  ];

  const spikes = [{ x: 230, y: 326, width: 70, height: 14 }];

  let coins = [
    { x: 170, y: 240, collected: false },
    { x: 300, y: 190, collected: false },
    { x: 180, y: 130, collected: false },
    { x: 430, y: 140, collected: false },
    { x: 530, y: 230, collected: false },
    { x: 310, y: 315, collected: false }
  ];

  const exitFlag = { x: 540, y: 300, width: 24, height: 40 };

  function resetLevel() {
    player.x = 40;
    player.y = 280;
    player.vx = 0;
    player.vy = 0;
    coinsCollected = 0;
    coins.forEach(c => c.collected = false);
    coinsEl.textContent = '0';
    statusEl.textContent = 'EXPLORING';
    isGameOver = false;
    isStageCleared = false;
  }

  const keys = {};
  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
      e.preventDefault();
      tryJump();
    }
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });

  function tryJump() {
    if (isGameOver || isStageCleared) { resetLevel(); return; }
    if (player.grounded) {
      player.vy = player.jumpForce;
      player.grounded = false;
      playSound('jump');
    }
  }

  let touchLeft = false, touchRight = false;
  document.getElementById('btn-left').addEventListener('pointerdown', () => touchLeft = true);
  document.getElementById('btn-left').addEventListener('pointerup', () => touchLeft = false);
  document.getElementById('btn-right').addEventListener('pointerdown', () => touchRight = true);
  document.getElementById('btn-right').addEventListener('pointerup', () => touchRight = false);
  document.getElementById('btn-jump').addEventListener('pointerdown', () => tryJump());
  canvas.addEventListener('pointerdown', () => { if (isGameOver || isStageCleared) resetLevel(); });

  function update() {
    if (isGameOver || isStageCleared) return;
    const left = keys['ArrowLeft'] || keys['KeyA'] || touchLeft;
    const right = keys['ArrowRight'] || keys['KeyD'] || touchRight;

    if (left) player.vx = -player.speed;
    else if (right) player.vx = player.speed;
    else player.vx = 0;

    player.vy += player.gravity;

    player.x += player.vx;
    for (let p of platforms) {
      if (player.x < p.x + p.width && player.x + player.width > p.x && player.y < p.y + p.height && player.y + player.height > p.y) {
        if (player.vx > 0) player.x = p.x - player.width;
        else if (player.vx < 0) player.x = p.x + p.width;
      }
    }

    player.grounded = false;
    player.y += player.vy;
    for (let p of platforms) {
      if (player.x < p.x + p.width && player.x + player.width > p.x && player.y < p.y + p.height && player.y + player.height > p.y) {
        if (player.vy > 0) { player.y = p.y - player.height; player.vy = 0; player.grounded = true; }
        else if (player.vy < 0) { player.y = p.y + p.height; player.vy = 0; }
      }
    }

    for (let c of coins) {
      if (!c.collected && Math.hypot((player.x + 10) - c.x, (player.y + 14) - c.y) < 18) {
        c.collected = true;
        coinsCollected++;
        coinsEl.textContent = String(coinsCollected);
        playSound('coin');
      }
    }

    for (let sp of spikes) {
      if (player.x < sp.x + sp.width && player.x + player.width > sp.x && player.y < sp.y + sp.height && player.y + player.height > sp.y) {
        isGameOver = true;
        statusEl.textContent = 'DEFEATED';
        playSound('die');
      }
    }

    if (player.x < exitFlag.x + exitFlag.width && player.x + player.width > exitFlag.x && player.y < exitFlag.y + exitFlag.height && player.y + player.height > exitFlag.y) {
      isStageCleared = true;
      statusEl.textContent = 'STAGE CLEARED!';
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bg.addColorStop(0, '#090d16');
    bg.addColorStop(1, '#1e1b4b');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#334155';
    for (let p of platforms) {
      ctx.fillRect(p.x, p.y, p.width, p.height);
    }

    ctx.fillStyle = '#ef4444';
    for (let sp of spikes) {
      ctx.fillRect(sp.x, sp.y + 8, sp.width, 6);
    }

    ctx.fillStyle = '#fbbf24';
    for (let c of coins) {
      if (!c.collected) {
        ctx.beginPath();
        ctx.arc(c.x, c.y, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.fillStyle = '#22c55e';
    ctx.fillRect(exitFlag.x, exitFlag.y, 4, exitFlag.height);
    ctx.fillRect(exitFlag.x + 4, exitFlag.y, 16, 12);

    if (!isGameOver) {
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(player.x, player.y, player.width, player.height);
    }

    if (isGameOver) {
      ctx.fillStyle = 'rgba(9, 13, 22, 0.85)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 28px monospace';
      ctx.fillText('FELL IN BATTLE', canvas.width / 2, canvas.height / 2 - 15);
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 13px monospace';
      ctx.fillText('TAP OR PRESS SPACE TO RETRY', canvas.width / 2, canvas.height / 2 + 25);
    } else if (isStageCleared) {
      ctx.fillStyle = 'rgba(9, 13, 22, 0.85)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#22c55e';
      ctx.font = 'bold 28px monospace';
      ctx.fillText('STAGE CLEARED!', canvas.width / 2, canvas.height / 2 - 15);
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 13px monospace';
      ctx.fillText('TAP OR PRESS SPACE TO REPLAY', canvas.width / 2, canvas.height / 2 + 25);
    }
  }

  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }
  loop();
})();`
    }
  },
  {
    id: 'memory-match',
    name: 'Rune Cards',
    description: '3D card flip memory match with glowing elemental runes, move counter, timer, match streaks, and celebration audio.',
    genre: 'Puzzle',
    tags: ['Memory', '3D Card Flip', 'Runes', 'Timer'],
    files: {
      'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Rune Cards - Memory Match</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div id="game-container">
    <div id="header">
      <div class="stat">MOVES: <span id="moves">0</span></div>
      <div class="stat">PAIRS: <span id="pairs">0</span> / 8</div>
      <div class="stat">TIME: <span id="timer">00:00</span></div>
    </div>
    <div id="grid" class="card-grid"></div>
    <div id="footer">
      <button id="btn-restart" class="restart-btn">RESTART GAME</button>
    </div>
  </div>
  <script src="game.js"></script>
</body>
</html>`,
      'style.css': `* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  user-select: none;
  -webkit-user-select: none;
}
body {
  background: #090d16;
  color: #f1f5f9;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 12px;
}
#game-container {
  width: 100%;
  max-width: 440px;
  background: #0f172a;
  border: 1px solid #1e293b;
  border-radius: 16px;
  padding: 18px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7);
  display: flex;
  flex-direction: column;
  align-items: center;
}
#header {
  width: 100%;
  display: flex;
  justify-content: space-between;
  font-family: monospace;
  font-size: 13px;
  font-weight: bold;
  color: #a855f7;
  margin-bottom: 16px;
}
.card-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  width: 100%;
  aspect-ratio: 1 / 1;
  perspective: 800px;
}
.card {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 10px;
  transform-style: preserve-3d;
  transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  touch-action: manipulation;
}
.card.flipped, .card.matched {
  transform: rotateY(180deg);
}
.card-face {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 10px;
  backface-visibility: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
}
.card-back {
  background: linear-gradient(135deg, #1e1b4b, #312e81);
  border: 1.5px solid #4338ca;
  color: #818cf8;
}
.card-back::after {
  content: '✦';
  font-size: 20px;
}
.card-front {
  background: #1e293b;
  border: 1.5px solid #6366f1;
  transform: rotateY(180deg);
}
.card.matched .card-front {
  background: #064e3b;
  border-color: #10b981;
}
#footer {
  margin-top: 16px;
  width: 100%;
}
.restart-btn {
  width: 100%;
  background: #4f46e5;
  border: 1px solid #6366f1;
  color: #ffffff;
  padding: 10px;
  font-size: 13px;
  font-weight: bold;
  font-family: monospace;
  border-radius: 8px;
  cursor: pointer;
}`,
      'game.js': `// Rune Cards - Memory Match with Pure JS & WebAudio
(function() {
  const grid = document.getElementById('grid');
  const movesEl = document.getElementById('moves');
  const pairsEl = document.getElementById('pairs');
  const timerEl = document.getElementById('timer');
  const restartBtn = document.getElementById('btn-restart');

  let audioCtx = null;
  function playSound(type) {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      const now = audioCtx.currentTime;

      if (type === 'flip') {
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(540, now + 0.08);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === 'match') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.08);
        osc.frequency.setValueAtTime(783.99, now + 0.16);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      }
    } catch(e) {}
  }

  const ICONS = ['⚡', '⚔️', '🛡️', '👑', '🔮', '💎', '🔥', '🌙'];
  let flippedCards = [];
  let matchedPairs = 0;
  let moves = 0;
  let isLocked = false;
  let timerInterval = null;
  let secondsElapsed = 0;

  function startTimer() {
    clearInterval(timerInterval);
    secondsElapsed = 0;
    timerInterval = setInterval(() => {
      secondsElapsed++;
      const m = String(Math.floor(secondsElapsed / 60)).padStart(2, '0');
      const s = String(secondsElapsed % 60).padStart(2, '0');
      timerEl.textContent = m + ':' + s;
    }, 1000);
  }

  function initGame() {
    grid.innerHTML = '';
    flippedCards = [];
    matchedPairs = 0;
    moves = 0;
    isLocked = false;
    movesEl.textContent = '0';
    pairsEl.textContent = '0';
    startTimer();

    const deck = [...ICONS, ...ICONS];
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    deck.forEach((symbol) => {
      const cardEl = document.createElement('div');
      cardEl.className = 'card';
      cardEl.dataset.symbol = symbol;
      cardEl.innerHTML = '<div class="card-face card-back"></div><div class="card-face card-front">' + symbol + '</div>';
      cardEl.addEventListener('click', () => {
        if (isLocked || cardEl.classList.contains('flipped') || cardEl.classList.contains('matched')) return;
        cardEl.classList.add('flipped');
        playSound('flip');
        flippedCards.push(cardEl);
        if (flippedCards.length === 2) {
          moves++;
          movesEl.textContent = String(moves);
          isLocked = true;
          if (flippedCards[0].dataset.symbol === flippedCards[1].dataset.symbol) {
            setTimeout(() => {
              flippedCards[0].classList.add('matched');
              flippedCards[1].classList.add('matched');
              flippedCards = [];
              matchedPairs++;
              pairsEl.textContent = String(matchedPairs);
              playSound('match');
              isLocked = false;
            }, 300);
          } else {
            setTimeout(() => {
              flippedCards[0].classList.remove('flipped');
              flippedCards[1].classList.remove('flipped');
              flippedCards = [];
              isLocked = false;
            }, 750);
          }
        }
      });
      grid.appendChild(cardEl);
    });
  }

  restartBtn.addEventListener('click', initGame);
  initGame();
})();`
    }
  }
];

/**
 * Bundles a multi-file project into a single executable HTML document
 * suitable for sandboxed iframes or single-file exports.
 */
export function bundleGameFiles(files: Record<string, string>): string {
  let html = files['index.html'] || '<!DOCTYPE html><html><body></body></html>';
  const css = files['style.css'] || '';
  const js = files['game.js'] || '';

  // Inject or replace style.css link with inline <style>
  if (css) {
    if (html.includes('<link rel="stylesheet" href="style.css">')) {
      html = html.replace(
        '<link rel="stylesheet" href="style.css">',
        `<style>\n${css}\n</style>`
      );
    } else if (html.includes('</head>')) {
      html = html.replace('</head>', `<style>\n${css}\n</style></head>`);
    } else {
      html = `<style>\n${css}\n</style>` + html;
    }
  }

  // Inject or replace game.js script with inline <script>
  if (js) {
    if (html.includes('<script src="game.js"></script>')) {
      html = html.replace(
        '<script src="game.js"></script>',
        `<script>\n${js}\n</script>`
      );
    } else if (html.includes('</body>')) {
      html = html.replace('</body>', `<script>\n${js}\n</script></body>`);
    } else {
      html = html + `<script>\n${js}\n</script>`;
    }
  }

  return html;
}
