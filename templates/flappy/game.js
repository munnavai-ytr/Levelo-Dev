// Neon Flap Arcade - Pure Canvas & WebAudio
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

  let state = 'READY'; // READY, PLAYING, GAMEOVER
  let score = 0;
  let highScore = parseInt(localStorage.getItem('flappy_highscore') || '0', 10);
  bestScoreEl.textContent = `BEST: ${highScore}`;

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
  let particles = [];
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
    bird.rotation = 0;
    pipes.length = 0;
    particles.length = 0;
  }

  function flap() {
    if (state === 'READY') {
      state = 'PLAYING';
      bird.velocity = bird.jump;
      playSound('flap');
    } else if (state === 'PLAYING') {
      bird.velocity = bird.jump;
      playSound('flap');
      // Flap particle trail
      for (let i = 0; i < 5; i++) {
        particles.push({
          x: bird.x - 10,
          y: bird.y + 8,
          vx: (Math.random() - 0.5) * 3 - 2,
          vy: Math.random() * 3 + 1,
          color: '#818cf8',
          life: 18
        });
      }
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
    // Update stars
    for (let s of stars) {
      s.x -= s.speed * (state === 'PLAYING' ? 2 : 0.8);
      if (s.x < 0) s.x = canvas.width;
    }

    if (state === 'READY') {
      bird.y = canvas.height / 2 + Math.sin(Date.now() / 250) * 8;
      bird.rotation = 0;
      return;
    }

    if (state === 'PLAYING') {
      bird.velocity += bird.gravity;
      bird.y += bird.velocity;
      bird.rotation = Math.min(Math.PI / 4, Math.max(-Math.PI / 4, bird.velocity * 0.08));

      // Floor / Ceiling bounds
      if (bird.y + bird.radius >= canvas.height - 24) {
        bird.y = canvas.height - 24 - bird.radius;
        gameOver();
      }
      if (bird.y - bird.radius <= 0) {
        bird.y = bird.radius;
        bird.velocity = 0;
      }

      // Pipe spawning
      pipeTimer++;
      if (pipeTimer >= 95) {
        pipeTimer = 0;
        const minTop = 60;
        const maxTop = canvas.height - 180;
        const topH = Math.floor(Math.random() * (maxTop - minTop)) + minTop;
        pipes.push({
          x: canvas.width,
          top: topH,
          bottom: canvas.height - (topH + PIPE_GAP) - 24,
          passed: false
        });
      }

      // Update Pipes
      for (let i = pipes.length - 1; i >= 0; i--) {
        const p = pipes[i];
        p.x -= 2.5;

        // Score check
        if (!p.passed && p.x + PIPE_WIDTH < bird.x) {
          p.passed = true;
          score++;
          scoreEl.textContent = score;
          if (score > highScore) {
            highScore = score;
            bestScoreEl.textContent = `BEST: ${highScore}`;
            localStorage.setItem('flappy_highscore', String(highScore));
          }
          playSound('point');
        }

        // Pipe collision
        // Top pipe
        if (
          bird.x + bird.radius > p.x &&
          bird.x - bird.radius < p.x + PIPE_WIDTH &&
          bird.y - bird.radius < p.top
        ) {
          gameOver();
        }
        // Bottom pipe
        const bottomY = canvas.height - 24 - p.bottom;
        if (
          bird.x + bird.radius > p.x &&
          bird.x - bird.radius < p.x + PIPE_WIDTH &&
          bird.y + bird.radius > bottomY
        ) {
          gameOver();
        }

        if (p.x + PIPE_WIDTH < 0) {
          pipes.splice(i, 1);
        }
      }
    }

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const pt = particles[i];
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.life--;
      if (pt.life <= 0) particles.splice(i, 1);
    }
  }

  function gameOver() {
    state = 'GAMEOVER';
    playSound('hit');
    for (let i = 0; i < 20; i++) {
      particles.push({
        x: bird.x,
        y: bird.y,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8,
        color: i % 2 === 0 ? '#f43f5e' : '#38bdf8',
        life: 30
      });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Deep space gradient
    const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
    sky.addColorStop(0, '#090d16');
    sky.addColorStop(1, '#1e1b4b');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Stars
    ctx.fillStyle = '#cbd5e1';
    for (let s of stars) {
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }

    // Draw Pipes
    for (let p of pipes) {
      ctx.fillStyle = '#4f46e5';
      ctx.shadowColor = '#6366f1';
      ctx.shadowBlur = 8;
      // Top pipe
      ctx.fillRect(p.x, 0, PIPE_WIDTH, p.top);
      ctx.fillStyle = '#6366f1';
      ctx.fillRect(p.x - 3, p.top - 14, PIPE_WIDTH + 6, 14);

      // Bottom pipe
      const bottomY = canvas.height - 24 - p.bottom;
      ctx.fillStyle = '#4f46e5';
      ctx.fillRect(p.x, bottomY, PIPE_WIDTH, p.bottom);
      ctx.fillStyle = '#6366f1';
      ctx.fillRect(p.x - 3, bottomY, PIPE_WIDTH + 6, 14);
      ctx.shadowBlur = 0;
    }

    // Ground bar
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, canvas.height - 24, canvas.width, 24);
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height - 24);
    ctx.lineTo(canvas.width, canvas.height - 24);
    ctx.stroke();

    // Draw Bird
    ctx.save();
    ctx.translate(bird.x, bird.y);
    ctx.rotate(bird.rotation);

    // Bird body (glowing cyber sphere)
    ctx.fillStyle = '#38bdf8';
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(0, 0, bird.radius, 0, Math.PI * 2);
    ctx.fill();

    // Visor eye
    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.arc(6, -2, 4, 0, Math.PI * 2);
    ctx.fill();

    // Wing
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.ellipse(-4, 2, 7, 4, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.shadowBlur = 0;

    // Draw particles
    for (let pt of particles) {
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x, pt.y, 3, 3);
    }

    // State overlays
    if (state === 'READY') {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 20px monospace';
      ctx.fillText('TAP TO PLAY', canvas.width / 2, canvas.height / 2 - 50);
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('Avoid the neon towers', canvas.width / 2, canvas.height / 2 - 25);
    } else if (state === 'GAMEOVER') {
      ctx.fillStyle = 'rgba(9, 13, 22, 0.85)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.textAlign = 'center';
      ctx.fillStyle = '#f43f5e';
      ctx.font = 'bold 28px monospace';
      ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 30);

      ctx.fillStyle = '#f8fafc';
      ctx.font = '14px sans-serif';
      ctx.fillText(`Score: ${score}  |  Best: ${highScore}`, canvas.width / 2, canvas.height / 2 + 5);

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 13px monospace';
      ctx.fillText('TAP TO RESTART', canvas.width / 2, canvas.height / 2 + 45);
    }
  }

  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
})();
