export const DEFAULT_PHASER_STARTER = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Levelo Starter - Cosmic Jumper</title>
  <!-- Load Phaser 3 from official CDN -->
  <script src="https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js"></script>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      user-select: none;
      -webkit-user-select: none;
    }
    body, html {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background-color: #090d16;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    #game-container {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    /* Mobile on-screen touch controls */
    .touch-controls {
      position: absolute;
      bottom: 24px;
      left: 0;
      right: 0;
      display: flex;
      justify-content: space-between;
      padding: 0 28px;
      pointer-events: none;
      z-index: 100;
    }
    .touch-btn {
      width: 68px;
      height: 68px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.15);
      border: 2px solid rgba(255, 255, 255, 0.35);
      backdrop-filter: blur(8px);
      color: white;
      font-size: 26px;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: auto;
      touch-action: manipulation;
      transition: background 0.15s, transform 0.1s;
    }
    .touch-btn:active {
      background: rgba(124, 58, 237, 0.7);
      transform: scale(0.92);
    }
    .d-pad {
      display: flex;
      gap: 16px;
    }
  </style>
</head>
<body>
  <div id="game-container"></div>

  <!-- On-screen mobile/touch controls -->
  <div class="touch-controls">
    <div class="d-pad">
      <button class="touch-btn" id="btn-left" aria-label="Left">&#9664;</button>
      <button class="touch-btn" id="btn-right" aria-label="Right">&#9654;</button>
    </div>
    <button class="touch-btn" id="btn-jump" aria-label="Jump">&#9650;</button>
  </div>

  <script>
    // ==========================================
    // GAME TUNING PARAMETERS (Edit these!)
    // ==========================================
    const CONFIG = {
      playerSpeed: 240,
      jumpVelocity: -460,
      gravity: 750,
      starCount: 9,
      worldWidth: 800,
      worldHeight: 600
    };

    let touchInput = { left: false, right: false, jump: false };

    // Set up touch button listeners
    function bindTouchButton(id, key) {
      const btn = document.getElementById(id);
      if (!btn) return;
      const start = (e) => { e.preventDefault(); touchInput[key] = true; };
      const end = (e) => { e.preventDefault(); touchInput[key] = false; };
      btn.addEventListener('touchstart', start, { passive: false });
      btn.addEventListener('touchend', end, { passive: false });
      btn.addEventListener('mousedown', start);
      btn.addEventListener('mouseup', end);
      btn.addEventListener('mouseleave', end);
    }
    bindTouchButton('btn-left', 'left');
    bindTouchButton('btn-right', 'right');
    bindTouchButton('btn-jump', 'jump');

    // Phaser 3 Main Scene
    class MainScene extends Phaser.Scene {
      constructor() {
        super({ key: 'MainScene' });
        this.score = 0;
      }

      preload() {
        // Generate procedural textures to ensure zero external network dependencies
        this.createProceduralTextures();
      }

      createProceduralTextures() {
        // 1. Platform texture
        const platG = this.make.graphics({ x: 0, y: 0, add: false });
        platG.fillStyle(0x1e1b4b, 1);
        platG.fillRoundedRect(0, 0, 160, 28, 6);
        platG.lineStyle(2, 0x8b5cf6, 1);
        platG.strokeRoundedRect(0, 0, 160, 28, 6);
        platG.generateTexture('platform', 160, 28);

        // 2. Ground platform texture
        const groundG = this.make.graphics({ x: 0, y: 0, add: false });
        groundG.fillStyle(0x0f172a, 1);
        groundG.fillRect(0, 0, 800, 36);
        groundG.lineStyle(2, 0x6366f1, 1);
        groundG.strokeRect(0, 0, 800, 36);
        groundG.generateTexture('ground', 800, 36);

        // 3. Player Hero texture (Glowing crystal orb)
        const playerG = this.make.graphics({ x: 0, y: 0, add: false });
        playerG.fillStyle(0x7c3aed, 1);
        playerG.fillCircle(18, 18, 18);
        playerG.fillStyle(0xa78bfa, 1);
        playerG.fillCircle(15, 15, 12);
        playerG.fillStyle(0xffffff, 1);
        playerG.fillCircle(12, 12, 5);
        playerG.generateTexture('player', 36, 36);

        // 4. Star Gem texture
        const starG = this.make.graphics({ x: 0, y: 0, add: false });
        starG.fillStyle(0xfbbf24, 1);
        starG.beginPath();
        const cx = 12, cy = 12, spikes = 5, outerR = 12, innerR = 5;
        let rot = Math.PI / 2 * 3;
        let step = Math.PI / spikes;
        starG.moveTo(cx, cy - outerR);
        for (let i = 0; i < spikes; i++) {
          let x = cx + Math.cos(rot) * outerR;
          let y = cy + Math.sin(rot) * outerR;
          starG.lineTo(x, y);
          rot += step;
          x = cx + Math.cos(rot) * innerR;
          y = cy + Math.sin(rot) * innerR;
          starG.lineTo(x, y);
          rot += step;
        }
        starG.closePath();
        starG.fillPath();
        starG.generateTexture('star', 24, 24);

        // 5. Sparkle Particle
        const partG = this.make.graphics({ x: 0, y: 0, add: false });
        partG.fillStyle(0xffffff, 1);
        partG.fillCircle(4, 4, 4);
        partG.generateTexture('sparkle', 8, 8);
      }

      create() {
        // Deep space background gradient
        const bg = this.add.graphics();
        bg.fillGradientStyle(0x090d16, 0x090d16, 0x1e1035, 0x1e1035, 1);
        bg.fillRect(0, 0, CONFIG.worldWidth, CONFIG.worldHeight);

        // Ambient background stars
        for (let i = 0; i < 45; i++) {
          const x = Phaser.Math.Between(0, CONFIG.worldWidth);
          const y = Phaser.Math.Between(0, CONFIG.worldHeight);
          const size = Phaser.Math.FloatBetween(1, 2.5);
          const alpha = Phaser.Math.FloatBetween(0.2, 0.8);
          const starDot = this.add.circle(x, y, size, 0xffffff, alpha);
          this.tweens.add({
            targets: starDot,
            alpha: { from: alpha, to: alpha * 0.2 },
            duration: Phaser.Math.Between(1500, 3000),
            yoyo: true,
            repeat: -1
          });
        }

        // Static Platforms group
        this.platforms = this.physics.add.staticGroup();
        // Ground
        this.platforms.create(400, 582, 'ground');
        // Floating ledges
        this.platforms.create(620, 420, 'platform');
        this.platforms.create(160, 340, 'platform');
        this.platforms.create(700, 230, 'platform');
        this.platforms.create(350, 190, 'platform');

        // Player setup
        this.player = this.physics.add.sprite(100, 480, 'player');
        this.player.setBounce(0.15);
        this.player.setCollideWorldBounds(true);
        this.physics.add.collider(this.player, this.platforms);

        // Star Collectibles
        this.stars = this.physics.add.group({
          key: 'star',
          repeat: CONFIG.starCount - 1,
          setXY: { x: 30, y: 0, stepX: 82 }
        });

        this.stars.children.iterate((child) => {
          child.setBounceY(Phaser.Math.FloatBetween(0.4, 0.7));
          child.setCollideWorldBounds(true);
        });
        this.physics.add.collider(this.stars, this.platforms);

        // Particle emitter for gem pickup
        this.emitter = this.add.particles(0, 0, 'sparkle', {
          speed: { min: -150, max: 150 },
          scale: { start: 1, end: 0 },
          alpha: { start: 1, end: 0 },
          lifespan: 450,
          gravityY: 200,
          emitting: false
        });

        // Collect Star collision
        this.physics.add.overlap(this.player, this.stars, this.collectStar, null, this);

        // Keyboard cursors & WASD
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = {
          up: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
          left: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
          down: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
          right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
          space: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
        };

        // Score UI
        this.scoreText = this.add.text(24, 20, 'Score: 0', {
          fontSize: '22px',
          fontFamily: 'system-ui, sans-serif',
          fontStyle: 'bold',
          fill: '#f3e8ff'
        });

        // Instructions text
        this.hintText = this.add.text(24, 52, 'Arrow keys or WASD to jump & collect stars', {
          fontSize: '13px',
          fontFamily: 'system-ui, sans-serif',
          fill: '#a78bfa'
        });
      }

      collectStar(player, star) {
        // Particle burst
        this.emitter.emitParticleAt(star.x, star.y, 16);
        star.disableBody(true, true);

        this.score += 10;
        this.scoreText.setText('Score: ' + this.score);

        // Pop tween on score
        this.tweens.add({
          targets: this.scoreText,
          scale: { from: 1.25, to: 1 },
          duration: 180
        });

        // Respawn when all cleared
        if (this.stars.countActive(true) === 0) {
          this.stars.children.iterate((child) => {
            child.enableBody(true, child.x, 0, true, true);
          });
          this.score += 50; // Bonus
          this.scoreText.setText('Score: ' + this.score);
        }
      }

      update() {
        const isLeft = this.cursors.left.isDown || this.wasd.left.isDown || touchInput.left;
        const isRight = this.cursors.right.isDown || this.wasd.right.isDown || touchInput.right;
        const isJump = this.cursors.up.isDown || this.wasd.up.isDown || this.wasd.space.isDown || touchInput.jump;

        if (isLeft) {
          this.player.setVelocityX(-CONFIG.playerSpeed);
        } else if (isRight) {
          this.player.setVelocityX(CONFIG.playerSpeed);
        } else {
          this.player.setVelocityX(0);
        }

        if (isJump && this.player.body.touching.down) {
          this.player.setVelocityY(CONFIG.jumpVelocity);
        }
      }
    }

    // Phaser Config
    const config = {
      type: Phaser.AUTO,
      parent: 'game-container',
      width: CONFIG.worldWidth,
      height: CONFIG.worldHeight,
      backgroundColor: '#090d16',
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
      },
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { y: CONFIG.gravity },
          debug: false
        }
      },
      scene: [MainScene]
    };

    const game = new Phaser.Game(config);
  </script>
</body>
</html>
`;
