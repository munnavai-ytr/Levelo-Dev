(function() {
  const container = document.getElementById("game-container");
  const scoreVal = document.getElementById("score-val");
  const speedVal = document.getElementById("speed-val");
  const bestVal = document.getElementById("best-val");
  const gameOverScreen = document.getElementById("game-over-screen");
  const finalStats = document.getElementById("final-stats");
  const btnRestart = document.getElementById("btn-restart");

  // WebAudio synth
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  let audioCtx = null;
  function playSound(freq, duration, type) {
    try {
      if (!audioCtx) audioCtx = new AudioCtx();
      if (audioCtx.state === "suspended") audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type || "sine";
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch(e) {}
  }

  // Three.js Scene Setup
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x020617, 0.02);

  const camera = new THREE.PerspectiveCamera(65, container.clientWidth / container.clientHeight, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  
  // Capped pixel ratio 2 for high-DPI screens without GPU drain
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  // No real-time shadows on mobile devices
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  renderer.shadowMap.enabled = !isMobile;
  container.appendChild(renderer.domElement);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0x38bdf8, 1.2);
  dirLight.position.set(5, 12, 10);
  scene.add(dirLight);

  // Ground Grid
  const gridHelper = new THREE.GridHelper(300, 60, 0x6366f1, 0x1e293b);
  gridHelper.position.y = -0.5;
  scene.add(gridHelper);

  // Lanes: -3, 0, 3
  const LANES = [-3, 0, 3];
  let currentLane = 1; // 0: left, 1: center, 2: right
  let targetX = LANES[currentLane];

  // Player Mesh (Stylized Cyber Craft)
  const playerGroup = new THREE.Group();
  const bodyGeo = new THREE.ConeGeometry(0.8, 2, 4);
  bodyGeo.rotateX(Math.PI / 2);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.3, metalness: 0.8 });
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  playerGroup.add(bodyMesh);

  // Engine glow core
  const coreGeo = new THREE.SphereGeometry(0.35, 8, 8);
  const coreMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e });
  const coreMesh = new THREE.Mesh(coreGeo, coreMat);
  coreMesh.position.z = 0.8;
  playerGroup.add(coreMesh);

  scene.add(playerGroup);
  playerGroup.position.set(0, 0.5, 0);

  // Camera setup
  camera.position.set(0, 3.5, 6);
  camera.lookAt(0, 0.5, -10);

  // Gameplay State
  let score = 0;
  let highScore = parseInt(localStorage.getItem("levelo_3d_runner_hi") || "0", 10);
  bestVal.textContent = highScore;
  let speed = 28;
  let isGameOver = false;
  let isJumping = false;
  let jumpVelocity = 0;
  const GRAVITY = -32;

  // Obstacles & Collectibles
  const obstacles = [];
  const coins = [];
  let nextSpawnZ = -30;

  function spawnObstacleOrCoin(z) {
    const laneIdx = Math.floor(Math.random() * 3);
    const laneX = LANES[laneIdx];

    if (Math.random() > 0.4) {
      // Spawn Obstacle (Neon Cyber Cube / Barricade)
      const geo = new THREE.BoxGeometry(1.6, 1.4, 1.4);
      const mat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.2, metalness: 0.6 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(laneX, 0.2, z);
      scene.add(mesh);
      obstacles.push(mesh);
    } else {
      // Spawn Coin (Rotating Golden Octahedron)
      const geo = new THREE.OctahedronGeometry(0.6, 0);
      const mat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.9, roughness: 0.1 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(laneX, 0.8, z);
      scene.add(mesh);
      coins.push(mesh);
    }
  }

  // Pre-seed track
  for (let z = -20; z > -180; z -= 14) {
    spawnObstacleOrCoin(z);
    nextSpawnZ = z;
  }

  function handleJump() {
    if (!isJumping && !isGameOver) {
      isJumping = true;
      jumpVelocity = 11;
      playSound(420, 0.15, "triangle");
    }
  }

  function moveLeft() {
    if (currentLane > 0 && !isGameOver) {
      currentLane--;
      targetX = LANES[currentLane];
      playSound(300, 0.08, "sine");
    }
  }

  function moveRight() {
    if (currentLane < 2 && !isGameOver) {
      currentLane++;
      targetX = LANES[currentLane];
      playSound(300, 0.08, "sine");
    }
  }

  // Keyboard controls
  window.addEventListener("keydown", (e) => {
    if (e.code === "ArrowLeft" || e.code === "KeyA") moveLeft();
    if (e.code === "ArrowRight" || e.code === "KeyD") moveRight();
    if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") handleJump();
  });

  // Touch controls
  document.getElementById("btn-left").addEventListener("click", moveLeft);
  document.getElementById("btn-right").addEventListener("click", moveRight);
  document.getElementById("btn-jump").addEventListener("click", handleJump);

  function resetGame() {
    isGameOver = false;
    score = 0;
    speed = 28;
    currentLane = 1;
    targetX = LANES[1];
    playerGroup.position.set(0, 0.5, 0);
    isJumping = false;
    jumpVelocity = 0;

    // Clear meshes
    obstacles.forEach(m => scene.remove(m));
    coins.forEach(m => scene.remove(m));
    obstacles.length = 0;
    coins.length = 0;

    for (let z = -20; z > -180; z -= 14) {
      spawnObstacleOrCoin(z);
      nextSpawnZ = z;
    }

    gameOverScreen.classList.add("hidden");
  }

  btnRestart.addEventListener("click", resetGame);

  // Resize handler
  window.addEventListener("resize", () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });

  // Fixed 60Hz delta time update loop
  let lastTime = performance.now();
  const step = 1000 / 60;
  let accumulator = 0;

  function updateGame(dt) {
    if (isGameOver) return;

    // Smooth lane interpolation
    playerGroup.position.x += (targetX - playerGroup.position.x) * 14 * dt;
    playerGroup.rotation.z = (playerGroup.position.x - targetX) * 0.2;

    // Jump physics
    if (isJumping) {
      playerGroup.position.y += jumpVelocity * dt;
      jumpVelocity += GRAVITY * dt;
      if (playerGroup.position.y <= 0.5) {
        playerGroup.position.y = 0.5;
        isJumping = false;
        jumpVelocity = 0;
      }
    }

    // Move world towards player
    const moveZ = speed * dt;
    score += Math.round(moveZ * 2);
    scoreVal.textContent = score;

    speed += 0.8 * dt;
    speedVal.textContent = (speed / 28).toFixed(1) + "x";

    // Grid scrolling illusion
    gridHelper.position.z = (gridHelper.position.z + moveZ) % 10;

    // Update obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obs = obstacles[i];
      obs.position.z += moveZ;

      // Collision detection (Bounding Box)
      const dx = Math.abs(obs.position.x - playerGroup.position.x);
      const dy = Math.abs(obs.position.y - playerGroup.position.y);
      const dz = Math.abs(obs.position.z - playerGroup.position.z);

      if (dx < 1.1 && dy < 0.9 && dz < 1.1) {
        // Crash!
        isGameOver = true;
        playSound(120, 0.4, "sawtooth");
        if (score > highScore) {
          highScore = score;
          localStorage.setItem("levelo_3d_runner_hi", String(highScore));
          bestVal.textContent = highScore;
        }
        finalStats.textContent = `Score: ${score}  |  Best: ${highScore}`;
        gameOverScreen.classList.remove("hidden");
        return;
      }

      if (obs.position.z > 8) {
        scene.remove(obs);
        obstacles.splice(i, 1);
      }
    }

    // Update coins
    for (let i = coins.length - 1; i >= 0; i--) {
      const c = coins[i];
      c.position.z += moveZ;
      c.rotation.y += 3 * dt;

      const dx = Math.abs(c.position.x - playerGroup.position.x);
      const dy = Math.abs(c.position.y - playerGroup.position.y);
      const dz = Math.abs(c.position.z - playerGroup.position.z);

      if (dx < 1.2 && dy < 1.2 && dz < 1.2) {
        // Coin collected
        score += 250;
        playSound(880, 0.1, "sine");
        scene.remove(c);
        coins.splice(i, 1);
        continue;
      }

      if (c.position.z > 8) {
        scene.remove(c);
        coins.splice(i, 1);
      }
    }

    // Spawn new obstacles as track progresses
    while (nextSpawnZ > -220) {
      spawnObstacleOrCoin(nextSpawnZ);
      nextSpawnZ -= 15;
    }
    nextSpawnZ += moveZ;
  }

  function loop(currentTime) {
    if (!currentTime) currentTime = performance.now();
    const elapsed = Math.min(currentTime - lastTime, 100);
    lastTime = currentTime;
    accumulator += elapsed;

    while (accumulator >= step) {
      updateGame(step / 1000);
      accumulator -= step;
    }

    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
})();