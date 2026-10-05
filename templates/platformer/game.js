// Castle Quest - Precision Platformer with WebAudio
(function() {
  const canvas = document.getElementById('platform-canvas');
  const ctx = canvas.getContext('2d');
  const coinsEl = document.getElementById('coins');
  const totalCoinsEl = document.getElementById('total-coins');
  const stageEl = document.getElementById('stage');
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
      } else if (type === 'win') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(554.37, now + 0.1);
        osc.frequency.setValueAtTime(659.25, now + 0.2);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
      }
    } catch(e) {}
  }

  let stage = 1;
  let coinsCollected = 0;
  let isGameOver = false;
  let isStageCleared = false;
  let particles = [];

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
    // Floor
    { x: 0, y: 340, width: 600, height: 40 },
    // Floating ledges
    { x: 120, y: 270, width: 100, height: 16 },
    { x: 260, y: 220, width: 90, height: 16 },
    { x: 140, y: 160, width: 80, height: 16 },
    { x: 380, y: 170, width: 110, height: 16 },
    { x: 490, y: 260, width: 90, height: 16 }
  ];

  const spikes = [
    { x: 230, y: 326, width: 70, height: 14 },
    { x: 370, y: 326, width: 50, height: 14 }
  ];

  let coins = [
    { x: 170, y: 240, collected: false },
    { x: 300, y: 190, collected: false },
    { x: 180, y: 130, collected: false },
    { x: 430, y: 140, collected: false },
    { x: 530, y: 230, collected: false },
    { x: 310, y: 315, collected: false }
  ];

  const exitFlag = { x: 540, y: 300, width: 24, height: 40 };

  totalCoinsEl.textContent = String(coins.length);

  function resetLevel() {
    player.x = 40;
    player.y = 280;
    player.vx = 0;
    player.vy = 0;
    player.grounded = false;
    coinsCollected = 0;
    coins.forEach(c => c.collected = false);
    coinsEl.textContent = '0';
    statusEl.textContent = 'EXPLORING';
    isGameOver = false;
    isStageCleared = false;
    particles = [];
  }

  // Keyboard
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
    if (isGameOver || isStageCleared) {
      resetLevel();
      return;
    }
    if (player.grounded) {
      player.vy = player.jumpForce;
      player.grounded = false;
      playSound('jump');
      for (let i = 0; i < 6; i++) {
        particles.push({
          x: player.x + player.width / 2,
          y: player.y + player.height,
          vx: (Math.random() - 0.5) * 3,
          vy: Math.random() * -2,
          color: '#fbbf24',
          life: 18
        });
      }
    }
  }

  // Touch buttons
  const btnLeft = document.getElementById('btn-left');
  const btnRight = document.getElementById('btn-right');
  const btnJump = document.getElementById('btn-jump');

  let touchLeft = false;
  let touchRight = false;

  btnLeft.addEventListener('pointerdown', (e) => { e.preventDefault(); touchLeft = true; });
  btnLeft.addEventListener('pointerup', () => { touchLeft = false; });
  btnLeft.addEventListener('pointercancel', () => { touchLeft = false; });

  btnRight.addEventListener('pointerdown', (e) => { e.preventDefault(); touchRight = true; });
  btnRight.addEventListener('pointerup', () => { touchRight = false; });
  btnRight.addEventListener('pointercancel', () => { touchRight = false; });

  btnJump.addEventListener('pointerdown', (e) => { e.preventDefault(); tryJump(); });
  canvas.addEventListener('pointerdown', () => { if (isGameOver || isStageCleared) resetLevel(); });

  function update() {
    if (isGameOver || isStageCleared) return;

    // Horizontal movement
    const left = keys['ArrowLeft'] || keys['KeyA'] || touchLeft;
    const right = keys['ArrowRight'] || keys['KeyD'] || touchRight;

    if (left) player.vx = -player.speed;
    else if (right) player.vx = player.speed;
    else player.vx = 0;

    // Apply gravity
    player.vy += player.gravity;

    // Horizontal collision
    player.x += player.vx;
    for (let p of platforms) {
      if (
        player.x < p.x + p.width &&
        player.x + player.width > p.x &&
        player.y < p.y + p.height &&
        player.y + player.height > p.y
      ) {
        if (player.vx > 0) player.x = p.x - player.width;
        else if (player.vx < 0) player.x = p.x + p.width;
      }
    }

    // Vertical collision
    player.grounded = false;
    player.y += player.vy;
    for (let p of platforms) {
      if (
        player.x < p.x + p.width &&
        player.x + player.width > p.x &&
        player.y < p.y + p.height &&
        player.y + player.height > p.y
      ) {
        if (player.vy > 0) {
          player.y = p.y - player.height;
          player.vy = 0;
          player.grounded = true;
        } else if (player.vy < 0) {
          player.y = p.y + p.height;
          player.vy = 0;
        }
      }
    }

    // Coins
    for (let c of coins) {
      if (!c.collected) {
        const dx = (player.x + player.width / 2) - c.x;
        const dy = (player.y + player.height / 2) - c.y;
        if (Math.hypot(dx, dy) < 18) {
          c.collected = true;
          coinsCollected++;
          coinsEl.textContent = String(coinsCollected);
          playSound('coin');
          for (let i = 0; i < 8; i++) {
            particles.push({
              x: c.x, y: c.y,
              vx: (Math.random() - 0.5) * 5,
              vy: (Math.random() - 0.5) * 5,
              color: '#fbbf24',
              life: 20
            });
          }
        }
      }
    }

    // Spikes check
    for (let sp of spikes) {
      if (
        player.x < sp.x + sp.width &&
        player.x + player.width > sp.x &&
        player.y < sp.y + sp.height &&
        player.y + player.height > sp.y
      ) {
        isGameOver = true;
        statusEl.textContent = 'DEFEATED';
        playSound('die');
        for (let i = 0; i < 20; i++) {
          particles.push({
            x: player.x + player.width / 2,
            y: player.y + player.height / 2,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8,
            color: '#ef4444',
            life: 30
          });
        }
        return;
      }
    }

    // Exit Goal check
    if (
      player.x < exitFlag.x + exitFlag.width &&
      player.x + player.width > exitFlag.x &&
      player.y < exitFlag.y + exitFlag.height &&
      player.y + player.height > exitFlag.y
    ) {
      isStageCleared = true;
      statusEl.textContent = 'STAGE CLEARED!';
      playSound('win');
      for (let i = 0; i < 35; i++) {
        particles.push({
          x: exitFlag.x + 10,
          y: exitFlag.y + 10,
          vx: (Math.random() - 0.5) * 8,
          vy: (Math.random() - 0.5) * 8,
          color: ['#fbbf24', '#38bdf8', '#22c55e'][Math.floor(Math.random() * 3)],
          life: 45
        });
      }
    }

    // Update Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const pt = particles[i];
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.life--;
      if (pt.life <= 0) particles.splice(i, 1);
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background gradient
    const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bg.addColorStop(0, '#090d16');
    bg.addColorStop(1, '#1e1b4b');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Platforms
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    for (let p of platforms) {
      ctx.fillRect(p.x, p.y, p.width, p.height);
      ctx.strokeRect(p.x, p.y, p.width, p.height);
      // Platform top highlight
      ctx.fillStyle = '#6366f1';
      ctx.fillRect(p.x, p.y, p.width, 3);
      ctx.fillStyle = '#334155';
    }

    // Spikes (Hazard Triangles)
    ctx.fillStyle = '#ef4444';
    for (let sp of spikes) {
      const count = Math.floor(sp.width / 14);
      for (let i = 0; i < count; i++) {
        ctx.beginPath();
        ctx.moveTo(sp.x + i * 14, sp.y + sp.height);
        ctx.lineTo(sp.x + i * 14 + 7, sp.y);
        ctx.lineTo(sp.x + (i + 1) * 14, sp.y + sp.height);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Coins
    for (let c of coins) {
      if (!c.collected) {
        ctx.fillStyle = '#fbbf24';
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }

    // Exit Flagpole
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(exitFlag.x, exitFlag.y, 4, exitFlag.height);
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.moveTo(exitFlag.x + 4, exitFlag.y);
    ctx.lineTo(exitFlag.x + 22, exitFlag.y + 10);
    ctx.lineTo(exitFlag.x + 4, exitFlag.y + 20);
    ctx.closePath();
    ctx.fill();

    // Player Knight
    if (!isGameOver) {
      ctx.fillStyle = '#38bdf8';
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.roundRect(player.x, player.y, player.width, player.height, 4);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Eyes
      ctx.fillStyle = '#0f172a';
      const eyeOffset = player.vx >= 0 ? 12 : 4;
      ctx.fillRect(player.x + eyeOffset, player.y + 6, 4, 4);
    }

    // Particles
    for (let pt of particles) {
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x, pt.y, 3, 3);
    }

    // Overlays
    if (isGameOver) {
      ctx.fillStyle = 'rgba(9, 13, 22, 0.85)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.textAlign = 'center';
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 28px monospace';
      ctx.fillText('FELL IN BATTLE', canvas.width / 2, canvas.height / 2 - 20);

      ctx.fillStyle = '#f1f5f9';
      ctx.font = '14px sans-serif';
      ctx.fillText(`Coins: ${coinsCollected} / ${coins.length}`, canvas.width / 2, canvas.height / 2 + 10);

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 13px monospace';
      ctx.fillText('PRESS SPACE OR TAP TO RETRY', canvas.width / 2, canvas.height / 2 + 50);
    } else if (isStageCleared) {
      ctx.fillStyle = 'rgba(9, 13, 22, 0.85)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.textAlign = 'center';
      ctx.fillStyle = '#22c55e';
      ctx.font = 'bold 28px monospace';
      ctx.fillText('STAGE CLEARED!', canvas.width / 2, canvas.height / 2 - 20);

      ctx.fillStyle = '#fbbf24';
      ctx.font = '15px sans-serif';
      ctx.fillText(`All ${coinsCollected} Coins Secured!`, canvas.width / 2, canvas.height / 2 + 10);

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 13px monospace';
      ctx.fillText('PRESS SPACE OR TAP TO REPLAY', canvas.width / 2, canvas.height / 2 + 50);
    }
  }

  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
})();
