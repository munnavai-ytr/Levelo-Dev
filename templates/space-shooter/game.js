// Galaxy Defender - Pure Canvas & WebAudio Space Shooter
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
      } else if (type === 'hit') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(260, now);
        osc.frequency.linearRampToValueAtTime(90, now + 0.2);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
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
    cooldown: 0,
    invulnerable: 0
  };

  const lasers = [];
  const enemies = [];
  const enemyLasers = [];
  const particles = [];
  const stars = [];

  // Parallax starfield
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
  updateShieldsDisplay();

  function resetGame() {
    score = 0;
    wave = 1;
    lives = 3;
    isGameOver = false;
    player.x = canvas.width / 2;
    player.y = canvas.height - 70;
    player.invulnerable = 60;
    lasers.length = 0;
    enemies.length = 0;
    enemyLasers.length = 0;
    particles.length = 0;
    scoreEl.textContent = '0';
    waveEl.textContent = '1';
    updateShieldsDisplay();
  }

  // Keyboard state
  const keys = {};
  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'Space') {
      e.preventDefault();
      if (isGameOver) resetGame();
      else shootLaser();
    }
  });
  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });

  // Touch / Pointer controls
  let pointerDragging = false;
  canvas.addEventListener('pointerdown', (e) => {
    if (isGameOver) {
      resetGame();
      return;
    }
    pointerDragging = true;
    updatePointerPos(e);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (pointerDragging && !isGameOver) {
      updatePointerPos(e);
    }
  });
  window.addEventListener('pointerup', () => { pointerDragging = false; });
  window.addEventListener('pointercancel', () => { pointerDragging = false; });

  function updatePointerPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const clientX = e.clientX - rect.left;
    player.x = Math.max(player.width / 2, Math.min(canvas.width - player.width / 2, clientX * scaleX));
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

  // Spawn Enemy Formations
  let spawnTimer = 0;
  function spawnEnemies() {
    spawnTimer++;
    if (spawnTimer >= Math.max(35, 75 - wave * 4)) {
      spawnTimer = 0;
      const type = Math.random() < 0.35 ? 'heavy' : 'drone';
      enemies.push({
        x: Math.random() * (canvas.width - 50) + 25,
        y: -30,
        vx: (Math.random() - 0.5) * 2.5,
        vy: Math.random() * 1.5 + (type === 'heavy' ? 1.2 : 2.2),
        width: type === 'heavy' ? 36 : 24,
        height: type === 'heavy' ? 32 : 22,
        hp: type === 'heavy' ? 3 : 1,
        maxHp: type === 'heavy' ? 3 : 1,
        type: type,
        shootCooldown: Math.floor(Math.random() * 60) + 40
      });
    }
  }

  function update() {
    if (isGameOver) return;

    // Movement by keys
    if (keys['ArrowLeft'] || keys['KeyA']) player.x -= player.speed;
    if (keys['ArrowRight'] || keys['KeyD']) player.x += player.speed;
    player.x = Math.max(player.width / 2, Math.min(canvas.width - player.width / 2, player.x));

    if (keys['Space']) shootLaser();
    if (player.cooldown > 0) player.cooldown--;
    if (player.invulnerable > 0) player.invulnerable--;

    // Stars
    for (let s of stars) {
      s.y += s.speed;
      if (s.y > canvas.height) {
        s.y = 0;
        s.x = Math.random() * canvas.width;
      }
    }

    spawnEnemies();

    // Player Lasers
    for (let i = lasers.length - 1; i >= 0; i--) {
      const l = lasers[i];
      l.y += l.vy;
      if (l.y < -10) lasers.splice(i, 1);
    }

    // Enemy Lasers
    for (let i = enemyLasers.length - 1; i >= 0; i--) {
      const el = enemyLasers[i];
      el.y += el.vy;

      // Hit player check
      if (
        player.invulnerable <= 0 &&
        el.x > player.x - player.width / 2 &&
        el.x < player.x + player.width / 2 &&
        el.y > player.y - player.height / 2 &&
        el.y < player.y + player.height / 2
      ) {
        damagePlayer();
        enemyLasers.splice(i, 1);
        continue;
      }

      if (el.y > canvas.height + 10) enemyLasers.splice(i, 1);
    }

    // Enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
      const en = enemies[i];
      en.x += en.vx;
      en.y += en.vy;

      if (en.x < 20 || en.x > canvas.width - 20) en.vx *= -1;

      // Enemy shooting
      en.shootCooldown--;
      if (en.shootCooldown <= 0 && en.y > 20 && en.y < canvas.height - 120) {
        enemyLasers.push({ x: en.x, y: en.y + 15, vy: 4.5 });
        en.shootCooldown = Math.floor(Math.random() * 80) + 60;
      }

      // Check collision with player lasers
      for (let j = lasers.length - 1; j >= 0; j--) {
        const l = lasers[j];
        if (
          l.x > en.x - en.width / 2 &&
          l.x < en.x + en.width / 2 &&
          l.y > en.y - en.height / 2 &&
          l.y < en.y + en.height / 2
        ) {
          lasers.splice(j, 1);
          en.hp--;
          createHitParticles(l.x, l.y, '#38bdf8');

          if (en.hp <= 0) {
            playSound('explode');
            createExplosion(en.x, en.y, en.type === 'heavy' ? 24 : 14);
            score += en.type === 'heavy' ? 50 : 20;
            scoreEl.textContent = score;

            if (score >= wave * 400) {
              wave++;
              waveEl.textContent = wave;
            }

            enemies.splice(i, 1);
            break;
          }
        }
      }

      // Check collision with player body
      if (
        player.invulnerable <= 0 &&
        en.x > player.x - player.width / 2 - 10 &&
        en.x < player.x + player.width / 2 + 10 &&
        en.y > player.y - player.height / 2 - 10 &&
        en.y < player.y + player.height / 2 + 10
      ) {
        damagePlayer();
        createExplosion(en.x, en.y, 16);
        enemies.splice(i, 1);
        continue;
      }

      if (en.y > canvas.height + 40) enemies.splice(i, 1);
    }

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function damagePlayer() {
    lives--;
    updateShieldsDisplay();
    playSound('hit');
    player.invulnerable = 65;
    createExplosion(player.x, player.y, 20);

    if (lives <= 0) {
      isGameOver = true;
      playSound('explode');
    }
  }

  function createHitParticles(x, y, color) {
    for (let i = 0; i < 4; i++) {
      particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 5,
        vy: (Math.random() - 0.5) * 5,
        color,
        life: 14
      });
    }
  }

  function createExplosion(x, y, count) {
    for (let i = 0; i < count; i++) {
      particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 9,
        vy: (Math.random() - 0.5) * 9,
        color: ['#fbbf24', '#f97316', '#ef4444', '#38bdf8'][Math.floor(Math.random() * 4)],
        life: 25
      });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Deep space
    ctx.fillStyle = '#030712';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Stars
    ctx.fillStyle = '#f8fafc';
    for (let s of stars) {
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }

    // Player Lasers
    ctx.fillStyle = '#38bdf8';
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 10;
    for (let l of lasers) {
      ctx.fillRect(l.x - 2, l.y - 10, 4, 14);
    }
    ctx.shadowBlur = 0;

    // Enemy Lasers
    ctx.fillStyle = '#f43f5e';
    ctx.shadowColor = '#f43f5e';
    ctx.shadowBlur = 8;
    for (let el of enemyLasers) {
      ctx.beginPath();
      ctx.arc(el.x, el.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Enemies
    for (let en of enemies) {
      ctx.save();
      ctx.translate(en.x, en.y);
      if (en.type === 'heavy') {
        ctx.fillStyle = '#a855f7';
        ctx.shadowColor = '#c084fc';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(0, 16);
        ctx.lineTo(-18, -14);
        ctx.lineTo(18, -14);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillStyle = '#ef4444';
        ctx.shadowColor = '#f87171';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(0, 12);
        ctx.lineTo(-12, -10);
        ctx.lineTo(12, -10);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      ctx.shadowBlur = 0;
    }

    // Player Starship
    if (!isGameOver && (player.invulnerable % 6 < 3)) {
      ctx.save();
      ctx.translate(player.x, player.y);

      // Ship thruster glow
      ctx.fillStyle = '#38bdf8';
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.moveTo(0, -18);
      ctx.lineTo(-18, 16);
      ctx.lineTo(0, 10);
      ctx.lineTo(18, 16);
      ctx.closePath();
      ctx.fill();

      // Cockpit
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(0, -4, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.shadowBlur = 0;
    }

    // Particles
    for (let p of particles) {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, 2.5, 2.5);
    }

    // Game Over Overlay
    if (isGameOver) {
      ctx.fillStyle = 'rgba(3, 7, 18, 0.88)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.textAlign = 'center';
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 32px monospace';
      ctx.fillText('MISSION FAILED', canvas.width / 2, canvas.height / 2 - 30);

      ctx.fillStyle = '#f1f5f9';
      ctx.font = '15px sans-serif';
      ctx.fillText(`Final Score: ${score}  |  Wave: ${wave}`, canvas.width / 2, canvas.height / 2 + 10);

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 14px monospace';
      ctx.fillText('PRESS SPACE OR TAP TO RESTART', canvas.width / 2, canvas.height / 2 + 55);
    }
  }

  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
})();
