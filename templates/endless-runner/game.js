// Cyber Runner - Pure Canvas & WebAudio Endless Runner
(function() {
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score-val');
  const bestEl = document.getElementById('best-val');
  const speedEl = document.getElementById('speed-val');

  // WebAudio sound generator
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

  // Game state
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

  // Ground height
  const GROUND_Y = 320;

  // Player definition
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
    slideTimer: 0,
    trail: []
  };

  // Background buildings & grid
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
      // Create jump dust
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

  // Keyboard controls
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
      e.preventDefault();
      jump();
    } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
      e.preventDefault();
      slide();
    }
  });

  // Touch controls
  const btnJump = document.getElementById('btn-jump');
  const btnSlide = document.getElementById('btn-slide');
  btnJump.addEventListener('touchstart', (e) => { e.preventDefault(); jump(); });
  btnJump.addEventListener('mousedown', (e) => { e.preventDefault(); jump(); });
  btnSlide.addEventListener('touchstart', (e) => { e.preventDefault(); slide(); });
  btnSlide.addEventListener('mousedown', (e) => { e.preventDefault(); slide(); });

  canvas.addEventListener('pointerdown', (e) => {
    if (isGameOver) resetGame();
  });

  // Spawn Obstacles & Coins
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
          type: 'ground',
          color: '#f43f5e'
        });
      } else {
        obstacles.push({
          x: canvas.width,
          y: GROUND_Y - 75,
          width: 32,
          height: 24,
          type: 'flying',
          color: '#e11d48'
        });
      }

      // 40% chance of spawning coin above or near obstacle
      if (Math.random() < 0.5) {
        coins.push({
          x: canvas.width + 60,
          y: GROUND_Y - 90 - Math.random() * 30,
          radius: 9,
          collected: false
        });
      }
    }
  }

  // Update Game Loop
  function update() {
    if (isGameOver) return;

    score++;
    scoreEl.textContent = score;
    if (score > highScore) {
      highScore = score;
      bestEl.textContent = highScore;
      localStorage.setItem('cr_highscore', String(highScore));
    }

    // Speed scaling
    if (score % 250 === 0) {
      gameSpeed = Math.min(gameSpeed + 0.35, 14);
      speedEl.textContent = (gameSpeed / 6).toFixed(1) + 'x';
    }

    // Player physics
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

    // Slide timer
    if (player.isSliding) {
      player.slideTimer--;
      if (player.slideTimer <= 0) {
        player.isSliding = false;
        player.height = player.normalHeight;
        player.y = GROUND_Y - player.normalHeight;
      }
    }

    // Update stars
    for (let s of stars) {
      s.x -= s.speed * (gameSpeed * 0.4);
      if (s.x < 0) s.x = canvas.width;
    }

    spawnEntities();

    // Update obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obs = obstacles[i];
      obs.x -= gameSpeed;

      // Collision detection (AABB)
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

    // Update coins
    for (let i = coins.length - 1; i >= 0; i--) {
      const c = coins[i];
      c.x -= gameSpeed;
      // Circle-AABB collision
      const closeX = Math.max(player.x, Math.min(c.x, player.x + player.width));
      const closeY = Math.max(player.y, Math.min(c.y, player.y + player.height));
      const dist = Math.hypot(c.x - closeX, c.y - closeY);
      if (dist < c.radius) {
        score += 50;
        playSound('coin');
        for (let k = 0; k < 8; k++) {
          particles.push({
            x: c.x,
            y: c.y,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6,
            color: '#fbbf24',
            life: 25
          });
        }
        coins.splice(i, 1);
      } else if (c.x + c.radius < 0) {
        coins.splice(i, 1);
      }
    }

    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  // Draw Scene
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Gradient background sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    skyGrad.addColorStop(0, '#090d16');
    skyGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, canvas.width, GROUND_Y);

    // Draw stars
    ctx.fillStyle = '#94a3b8';
    for (let s of stars) {
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }

    // Draw synthwave grid floor
    ctx.fillStyle = '#060911';
    ctx.fillRect(0, GROUND_Y, canvas.width, canvas.height - GROUND_Y);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(canvas.width, GROUND_Y);
    ctx.stroke();

    // Perspective floor lines
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
    const offset = (frameCount * gameSpeed) % 40;
    for (let x = -offset; x < canvas.width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, GROUND_Y);
      ctx.lineTo(x - 30, canvas.height);
      ctx.stroke();
    }

    // Draw Coins
    for (let c of coins) {
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Draw Obstacles
    for (let obs of obstacles) {
      ctx.fillStyle = obs.color;
      ctx.shadowColor = obs.color;
      ctx.shadowBlur = 10;
      ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
      ctx.shadowBlur = 0;
    }

    // Draw Player
    if (!isGameOver) {
      ctx.fillStyle = '#38bdf8';
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 12;
      ctx.fillRect(player.x, player.y, player.width, player.height);
      // Cyber visor
      ctx.fillStyle = '#f43f5e';
      ctx.fillRect(player.x + 18, player.y + 8, 12, 6);
      ctx.shadowBlur = 0;
    }

    // Draw Particles
    for (let p of particles) {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, 3, 3);
    }

    // Game Over Overlay
    if (isGameOver) {
      ctx.fillStyle = 'rgba(9, 13, 22, 0.85)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.textAlign = 'center';
      ctx.fillStyle = '#f43f5e';
      ctx.font = 'bold 36px monospace';
      ctx.fillText('CRASHED!', canvas.width / 2, canvas.height / 2 - 20);

      ctx.fillStyle = '#f1f5f9';
      ctx.font = '16px sans-serif';
      ctx.fillText(`Final Score: ${score}  |  Best: ${highScore}`, canvas.width / 2, canvas.height / 2 + 20);

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 15px monospace';
      ctx.fillText('PRESS SPACE OR TAP TO RESTART', canvas.width / 2, canvas.height / 2 + 60);
    }
  }

  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
})();
