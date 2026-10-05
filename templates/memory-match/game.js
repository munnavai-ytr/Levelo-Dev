// Rune Cards - Memory Match with Pure JS & WebAudio
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
      } else if (type === 'mismatch') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.linearRampToValueAtTime(140, now + 0.18);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.18);
      } else if (type === 'victory') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(554.37, now + 0.12);
        osc.frequency.setValueAtTime(659.25, now + 0.24);
        osc.frequency.setValueAtTime(880, now + 0.36);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.6);
        osc.start(now);
        osc.stop(now + 0.6);
      }
    } catch(e) {}
  }

  // 8 Unique Rune Symbols
  const ICONS = ['⚡', '⚔️', '🛡️', '👑', '🔮', '💎', '🔥', '🌙'];

  let cards = [];
  let flippedCards = [];
  let matchedPairs = 0;
  let moves = 0;
  let isLocked = false;
  let timerInterval = null;
  let secondsElapsed = 0;

  function startTimer() {
    clearInterval(timerInterval);
    secondsElapsed = 0;
    timerEl.textContent = '00:00';
    timerInterval = setInterval(() => {
      secondsElapsed++;
      const m = String(Math.floor(secondsElapsed / 60)).padStart(2, '0');
      const s = String(secondsElapsed % 60).padStart(2, '0');
      timerEl.textContent = `${m}:${s}`;
    }, 1000);
  }

  function initGame() {
    clearInterval(timerInterval);
    grid.innerHTML = '';
    flippedCards = [];
    matchedPairs = 0;
    moves = 0;
    isLocked = false;
    movesEl.textContent = '0';
    pairsEl.textContent = '0';
    startTimer();

    // Create 16 cards (pair of each icon)
    const deck = [...ICONS, ...ICONS];
    // Fisher-Yates shuffle
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    cards = deck.map((symbol, index) => {
      const cardEl = document.createElement('div');
      cardEl.className = 'card';
      cardEl.dataset.symbol = symbol;
      cardEl.dataset.index = index;

      cardEl.innerHTML = `
        <div class="card-face card-back"></div>
        <div class="card-face card-front">${symbol}</div>
      `;

      cardEl.addEventListener('click', () => handleCardClick(cardEl));
      grid.appendChild(cardEl);
      return cardEl;
    });
  }

  function handleCardClick(cardEl) {
    if (isLocked) return;
    if (cardEl.classList.contains('flipped') || cardEl.classList.contains('matched')) return;

    cardEl.classList.add('flipped');
    playSound('flip');
    flippedCards.push(cardEl);

    if (flippedCards.length === 2) {
      moves++;
      movesEl.textContent = String(moves);
      checkMatch();
    }
  }

  function checkMatch() {
    isLocked = true;
    const [card1, card2] = flippedCards;
    const isMatch = card1.dataset.symbol === card2.dataset.symbol;

    if (isMatch) {
      setTimeout(() => {
        card1.classList.add('matched');
        card2.classList.add('matched');
        flippedCards = [];
        matchedPairs++;
        pairsEl.textContent = String(matchedPairs);
        playSound('match');
        isLocked = false;

        if (matchedPairs === 8) {
          handleVictory();
        }
      }, 350);
    } else {
      setTimeout(() => {
        playSound('mismatch');
        card1.classList.remove('flipped');
        card2.classList.remove('flipped');
        flippedCards = [];
        isLocked = false;
      }, 850);
    }
  }

  function handleVictory() {
    clearInterval(timerInterval);
    playSound('victory');
    setTimeout(() => {
      alert(`🎉 VICTORY! All 8 pairs matched in ${moves} moves and ${timerEl.textContent}!`);
    }, 400);
  }

  restartBtn.addEventListener('click', initGame);
  initGame();
})();
