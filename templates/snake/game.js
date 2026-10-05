// Cyber Snake Arcade - Pure Canvas & WebAudio
(function() {
  const canvas = document.getElementById('snake-canvas');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const highScoreEl = document.getElementById('high-score');
  const lengthEl = document.getElementById('length');

  // WebAudio sound synthesis
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
      } else if (type === 'move') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(120, now);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.03);
        osc.start(now);
        osc.stop(now + 0.03);
      }
    } catch(e) {}
  }

  const GRID_SIZE = 20;
  const TILE_COUNT = canvas.width / GRID_SIZE;

  let snake = [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 }
  ];

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
    let newX = 0;
    let newY = 0;
    while (!valid) {
      newX = Math.floor(Math.random() * TILE_COUNT);
      newY = Math.floor(Math.random() * TILE_COUNT);
      valid = !snake.some(segment => segment.x === newX && segment.y === newY);
    }
    const isGolden = Math.random() < 0.25;
    food = { x: newX, y: newY, isGolden };
  }

  function resetGame() {
    snake = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 }
    ];
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
    if (isGameOver) {
      resetGame();
      return;
    }
    // Prevent reversing directly
    if (dx !== 0 && velocity.x === -dx) return;
    if (dy !== 0 && velocity.y === -dy) return;
    nextVelocity = { x: dx, y: dy };
    playSound('move');
  }

  // Keyboard controls
  window.addEventListener('keydown', (e) => {
    switch (e.code) {
      case 'ArrowUp':
      case 'KeyW':
        e.preventDefault();
        setDirection(0, -1);
        break;
      case 'ArrowDown':
      case 'KeyS':
        e.preventDefault();
        setDirection(0, 1);
        break;
      case 'ArrowLeft':
      case 'KeyA':
        e.preventDefault();
        setDirection(-1, 0);
        break;
      case 'ArrowRight':
      case 'KeyD':
        e.preventDefault();
        setDirection(1, 0);
        break;
      case 'Space':
        e.preventDefault();
        if (isGameOver) resetGame();
        break;
    }
  });

  // Touch buttons
  document.getElementById('btn-up').addEventListener('pointerdown', () => setDirection(0, -1));
  document.getElementById('btn-down').addEventListener('pointerdown', () => setDirection(0, 1));
  document.getElementById('btn-left').addEventListener('pointerdown', () => setDirection(-1, 0));
  document.getElementById('btn-right').addEventListener('pointerdown', () => setDirection(1, 0));
  document.getElementById('btn-center').addEventListener('pointerdown', () => { if (isGameOver) resetGame(); });
  canvas.addEventListener('pointerdown', () => { if (isGameOver) resetGame(); });

  function update() {
    if (isGameOver) return;

    velocity = { ...nextVelocity };
    const head = { x: snake[0].x + velocity.x, y: snake[0].y + velocity.y };

    // Wall collision (arcade wrap-around or death - let's do solid walls for competitive thrill)
    if (head.x < 0 || head.x >= TILE_COUNT || head.y < 0 || head.y >= TILE_COUNT) {
      handleGameOver();
      return;
    }

    // Self collision
    for (let i = 0; i < snake.length; i++) {
      if (head.x === snake[i].x && head.y === snake[i].y) {
        handleGameOver();
        return;
      }
    }

    snake.unshift(head);

    // Food collision
    if (head.x === food.x && head.y === food.y) {
      const pts = food.isGolden ? 50 : 10;
      score += pts;
      scoreEl.textContent = score;
      lengthEl.textContent = snake.length;

      if (score > highScore) {
        highScore = score;
        highScoreEl.textContent = highScore;
        localStorage.setItem('snake_highscore', String(highScore));
      }

      playSound(food.isGolden ? 'golden' : 'eat');

      // Burst particles
      for (let p = 0; p < 12; p++) {
        particles.push({
          x: (food.x + 0.5) * GRID_SIZE,
          y: (food.y + 0.5) * GRID_SIZE,
          vx: (Math.random() - 0.5) * 6,
          vy: (Math.random() - 0.5) * 6,
          color: food.isGolden ? '#fbbf24' : '#22c55e',
          life: 25
        });
      }

      // Slightly increase speed
      moveInterval = Math.max(60, 110 - Math.floor(score / 30) * 4);
      spawnFood();
    } else {
      snake.pop();
    }
  }

  function handleGameOver() {
    isGameOver = true;
    playSound('die');
    for (let s of snake) {
      particles.push({
        x: (s.x + 0.5) * GRID_SIZE,
        y: (s.y + 0.5) * GRID_SIZE,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6,
        color: '#ef4444',
        life: 40
      });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Grid background
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1;
    for (let x = 0; x <= canvas.width; x += GRID_SIZE) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y <= canvas.height; y += GRID_SIZE) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Draw food
    ctx.fillStyle = food.isGolden ? '#fbbf24' : '#22c55e';
    ctx.shadowColor = food.isGolden ? '#fbbf24' : '#22c55e';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(
      (food.x + 0.5) * GRID_SIZE,
      (food.y + 0.5) * GRID_SIZE,
      GRID_SIZE * 0.42,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.shadowBlur = 0;

    // Draw snake
    for (let i = 0; i < snake.length; i++) {
      const seg = snake[i];
      const isHead = i === 0;

      if (isHead) {
        ctx.fillStyle = '#38bdf8';
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 10;
      } else {
        ctx.fillStyle = '#0284c7';
        ctx.shadowBlur = 0;
      }

      ctx.beginPath();
      ctx.roundRect(
        seg.x * GRID_SIZE + 1.5,
        seg.y * GRID_SIZE + 1.5,
        GRID_SIZE - 3,
        GRID_SIZE - 3,
        isHead ? 6 : 4
      );
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Draw particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, 3, 3);
      if (p.life <= 0) particles.splice(i, 1);
    }

    // Game Over Overlay
    if (isGameOver) {
      ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.textAlign = 'center';
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 30px monospace';
      ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 20);

      ctx.fillStyle = '#f1f5f9';
      ctx.font = '14px sans-serif';
      ctx.fillText(`Score: ${score}  |  Best: ${highScore}`, canvas.width / 2, canvas.height / 2 + 15);

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
})();
