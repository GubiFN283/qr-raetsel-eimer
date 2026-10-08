/* ==========================================================================
   QR-Code Rätsel-Rallye "EIMER" - Application Core Logic
   ========================================================================== */

const SOLUTION_WORD = ['E', 'I', 'M', 'E', 'R'];
const LOCAL_STORAGE_KEY = 'qr_eimer_progress_v1';

// European countries dictionary (German & English aliases)
const EUROPEAN_COUNTRIES = new Set([
  'deutschland', 'germany', 'frankreich', 'france', 'italien', 'italy', 
  'spanien', 'spain', 'portugal', 'österreich', 'austria', 'schweiz', 'switzerland', 
  'niederlande', 'holland', 'netherlands', 'belgien', 'belgium', 'polen', 'poland', 
  'tschechien', 'czechia', 'czech republic', 'dänemark', 'denmark', 'schweden', 'sweden', 
  'norwegen', 'norway', 'finnland', 'finland', 'irland', 'ireland', 'großbritannien', 
  'england', 'uk', 'united kingdom', 'schottland', 'wales', 'nordirland', 'island', 
  'iceland', 'griechenland', 'greece', 'kroatien', 'croatia', 'ungarn', 'hungary', 
  'rumänien', 'romania', 'bulgarien', 'bulgaria', 'slowakei', 'slovakia', 'slowenien', 
  'slovenia', 'litauen', 'lithuania', 'lettland', 'latvia', 'estland', 'estonia', 
  'ukraine', 'serbien', 'serbia', 'bosnien', 'bosnia', 'albanien', 'albania', 
  'nordmazedonien', 'macedonia', 'montenegro', 'kosovo', 'malta', 'zypern', 'cyprus', 
  'luxemburg', 'luxembourg', 'andorra', 'monaco', 'san marino', 'vatikan', 'vatican', 
  'liechtenstein', 'moldawien', 'moldova', 'weißrussland', 'belarus'
]);

class RiddleApp {
  constructor() {
    this.progress = this.loadProgress();
    this.geoCountries = [];
    this.audioCtx = null;
    
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.updateHeaderProgress();
    this.renderMathCanvas();
    this.renderQRHub();
    this.handleRouting();

    // Check if victory screen should be shown
    if (this.isFullyCompleted()) {
      // If no specific puzzle is opened in URL, show victory
      const urlParams = new URLSearchParams(window.location.search);
      if (!urlParams.get('puzzle')) {
        this.showView('victory');
        this.triggerConfetti();
      }
    }
  }

  // Audio Synthesizer via Web Audio API
  playSound(type) {
    try {
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const ctx = this.audioCtx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;

      if (type === 'success') {
        // Sparkling chord fanfare
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
        osc.frequency.setValueAtTime(1046.50, now + 0.3); // C6
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
        osc.start(now);
        osc.stop(now + 0.7);
      } else if (type === 'error') {
        // Error buzz
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.linearRampToValueAtTime(100, now + 0.2);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (type === 'click') {
        // Gentle click
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
      }
    } catch (e) {
      console.log('Audio playback prevented or unsupported:', e);
    }
  }

  // LocalStorage state management
  loadProgress() {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      return saved ? JSON.parse(saved) : { 1: false, 2: false, 3: false, 4: false, 5: false };
    } catch (e) {
      return { 1: false, 2: false, 3: false, 4: false, 5: false };
    }
  }

  saveProgress() {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(this.progress));
    } catch (e) {
      console.error('Failed to save to localStorage', e);
    }
  }

  resetProgress() {
    if (confirm('Möchtest du deinen Fortschritt wirklich zurücksetzen? Alle freigeschalteten Buchstaben werden gelöscht.')) {
      this.progress = { 1: false, 2: false, 3: false, 4: false, 5: false };
      this.geoCountries = [];
      this.saveProgress();
      this.updateHeaderProgress();
      this.renderGeoChips();
      this.showView('hub');
      this.playSound('click');
    }
  }

  unlockLetter(puzzleIndex) {
    const isNew = !this.progress[puzzleIndex];
    this.progress[puzzleIndex] = true;
    this.saveProgress();
    this.updateHeaderProgress();

    const letter = SOLUTION_WORD[puzzleIndex - 1];

    if (isNew) {
      this.playSound('success');
      this.triggerConfetti();
      this.showModal(letter, puzzleIndex);
    }

    if (this.isFullyCompleted()) {
      setTimeout(() => {
        this.showView('victory');
        this.triggerConfetti();
      }, 1800);
    }
  }

  isFullyCompleted() {
    return Object.values(this.progress).every(v => v === true);
  }

  updateHeaderProgress() {
    for (let i = 1; i <= 5; i++) {
      const box = document.getElementById(`box-${i}`);
      const valSpan = box.querySelector('.letter-val');
      if (this.progress[i]) {
        box.classList.add('unlocked');
        valSpan.textContent = SOLUTION_WORD[i - 1];
      } else {
        box.classList.remove('unlocked');
        valSpan.textContent = '?';
      }
    }
  }

  // Routing via URL query parameter (?puzzle=1..5) or view panel ID
  handleRouting() {
    const urlParams = new URLSearchParams(window.location.search);
    const puzzleId = urlParams.get('puzzle');
    const page = urlParams.get('page');

    if (puzzleId && puzzleId >= 1 && puzzleId <= 5) {
      this.showView(`p${puzzleId}`);
    } else if (page === 'hub' || !puzzleId) {
      this.showView('hub');
    }
  }

  showView(viewName) {
    document.querySelectorAll('.view-panel').forEach(panel => {
      panel.classList.remove('active');
    });

    const targetView = document.getElementById(`view-${viewName}`);
    if (targetView) {
      targetView.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // Setup UI Event Handlers
  setupEventListeners() {
    document.getElementById('navHome').addEventListener('click', () => {
      this.playSound('click');
      this.showView('hub');
    });

    document.getElementById('btnShowHub').addEventListener('click', () => {
      this.playSound('click');
      this.showView('hub');
    });

    document.getElementById('btnReset').addEventListener('click', () => {
      this.resetProgress();
    });

    const btnUpdateQR = document.getElementById('btnUpdateQR');
    if (btnUpdateQR) {
      btnUpdateQR.addEventListener('click', () => {
        this.playSound('click');
        this.renderQRHub();
      });
    }

    document.getElementById('btnCloseModal').addEventListener('click', () => {
      this.playSound('click');
      this.closeModal();
    });

    // Form 1: Math
    document.getElementById('formMath').addEventListener('submit', (e) => {
      e.preventDefault();
      this.validateMath();
    });

    // Form 2: History
    document.getElementById('formHistory').addEventListener('submit', (e) => {
      e.preventDefault();
      this.validateHistory();
    });

    // Form 3: English
    document.getElementById('formEnglish').addEventListener('submit', (e) => {
      e.preventDefault();
      this.validateEnglish();
    });

    // Form 4: Actor
    document.getElementById('formActor').addEventListener('submit', (e) => {
      e.preventDefault();
      this.validateActor();
    });

    // Form 5: Geography
    document.getElementById('formGeo').addEventListener('submit', (e) => {
      e.preventDefault();
      this.addCountry();
    });

    document.getElementById('btnClearGeo').addEventListener('click', () => {
      this.geoCountries = [];
      this.renderGeoChips();
      this.playSound('click');
    });
  }

  // --- VALIDATION LOGIC FOR THE 5 PUZZLES ---

  // Puzzle 1: Math (-x^2 + 6x - 5)
  // Max height (y_s) = 4, Landing point (x_2) = 5
  validateMath() {
    const yVal = parseFloat(document.getElementById('mathY').value);
    const xVal = parseFloat(document.getElementById('mathX').value);
    const fb = document.getElementById('feedbackMath');

    if (yVal === 4 && xVal === 5) {
      fb.className = 'feedback-box success';
      fb.innerHTML = '✅ Richtig! Der Scheitelpunkt liegt bei (3|4) und die Landestelle bei x = 5.';
      this.unlockLetter(1);
    } else {
      this.playSound('error');
      fb.className = 'feedback-box error';
      fb.innerHTML = '❌ Leider nicht ganz richtig. Tipp: Verwende die Scheitelpunktform oder f(3) für den Höchstpunkt!';
    }
  }

  // Puzzle 2: History (Treaty of Versailles)
  validateHistory() {
    const year = document.getElementById('histYear').value.trim();
    const hall = document.getElementById('histHall').value;
    const article = document.getElementById('histArticle').value.trim().toLowerCase();
    const fb = document.getElementById('feedbackHistory');

    const isYearCorrect = year === '1919';
    const isHallCorrect = hall === 'spiegelsaal';
    const isArticleCorrect = article.includes('231');

    if (isYearCorrect && isHallCorrect && isArticleCorrect) {
      fb.className = 'feedback-box success';
      fb.innerHTML = '✅ Hervorragend! 1919 wurde der Vertag im Spiegelsaal unterzeichnet (Artikel 231 kriegsschuld).';
      this.unlockLetter(2);
    } else {
      this.playSound('error');
      fb.className = 'feedback-box error';
      let hints = [];
      if (!isYearCorrect) hints.push('Das Jahr war kurz nach Ende des 1. Weltkriegs (1919).');
      if (!isHallCorrect) hints.push('Der Saal enthält viele Spiegel.');
      if (!isArticleCorrect) hints.push('Die Artikelnummer ist 231.');
      fb.innerHTML = `❌ Einige Antworten stimmen noch nicht. ${hints.join(' ')}`;
    }
  }

  // Puzzle 3: English Tenses
  validateEnglish() {
    const eng1 = document.getElementById('eng1').value.trim().toLowerCase();
    const eng2 = document.getElementById('eng2').value.trim().toLowerCase();
    const eng3 = document.getElementById('eng3').value.trim().toLowerCase();
    const fb = document.getElementById('feedbackEnglish');

    const c1 = eng1 === 'arrived';
    const c2 = eng2 === 'had missed';
    const c3 = eng3 === 'has seen';

    if (c1 && c2 && c3) {
      fb.className = 'feedback-box success';
      fb.innerHTML = '✅ Excellent! "arrived" (Simple Past), "had missed" (Past Perfect), "has seen" (Present Perfect).';
      this.unlockLetter(3);
    } else {
      this.playSound('error');
      fb.className = 'feedback-box error';
      fb.innerHTML = '❌ Not quite right. Pay attention to Simple Past (arrived), Past Perfect (had missed), and Present Perfect (has seen).';
    }
  }

  // Puzzle 4: Guess the Actor (Tom Holland)
  validateActor() {
    const val = document.getElementById('actorName').value.trim().toLowerCase();
    const fb = document.getElementById('feedbackActor');

    if (val.includes('tom holland') || val === 'holland') {
      fb.className = 'feedback-box success';
      fb.innerHTML = '✅ Richtig! Der Schauspieler ist Tom Holland (Peter Parker / Spider-Man).';
      this.unlockLetter(4);
    } else {
      this.playSound('error');
      fb.className = 'feedback-box error';
      fb.innerHTML = '❌ Falscher Name. Er spielt Spider-Man im Marvel Cinematic Universe!';
    }
  }

  // Puzzle 5: Geography (10 European Countries)
  addCountry() {
    const input = document.getElementById('geoInput');
    const rawVal = input.value.trim();
    const cleanVal = rawVal.toLowerCase();
    const fb = document.getElementById('feedbackGeo');

    if (!rawVal) return;

    if (!EUROPEAN_COUNTRIES.has(cleanVal)) {
      this.playSound('error');
      fb.className = 'feedback-box error';
      fb.innerHTML = `❌ "${rawVal}" liegt nicht in Europa oder ist fehlerhaft geschrieben. Try: Deutschland, Italien, Schweden...`;
      return;
    }

    if (this.geoCountries.some(c => c.toLowerCase() === cleanVal)) {
      this.playSound('error');
      fb.className = 'feedback-box error';
      fb.innerHTML = `⚠️ Du hast "${rawVal}" bereits hinzugefügt!`;
      return;
    }

    fb.className = 'feedback-box';
    fb.style.display = 'none';

    this.playSound('click');
    this.geoCountries.push(rawVal);
    input.value = '';
    this.renderGeoChips();

    if (this.geoCountries.length >= 10) {
      fb.className = 'feedback-box success';
      fb.innerHTML = '✅ Stark! Du hast 10 europäische Länder erfolgreich genannt.';
      this.unlockLetter(5);
    }
  }

  renderGeoChips() {
    const container = document.getElementById('countryTags');
    const countSpan = document.getElementById('geoCount');
    container.innerHTML = '';
    countSpan.textContent = this.geoCountries.length;

    this.geoCountries.forEach((c, idx) => {
      const chip = document.createElement('div');
      chip.className = 'country-chip';
      chip.innerHTML = `<span>#${idx + 1} ${c}</span>`;
      container.appendChild(chip);
    });
  }

  // Interactive HTML5 Canvas Plotter for Quadratic Function
  renderMathCanvas() {
    const canvas = document.getElementById('mathCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const width = canvas.width;
    const height = canvas.height;

    // Clear background
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    // Coordinate System Setup
    const originX = 50;
    const originY = height - 40;
    const scaleX = 35; // 1 unit = 35px
    const scaleY = 35; // 1 unit = 35px

    // Draw Axes
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1.5;

    // X Axis
    ctx.beginPath();
    ctx.moveTo(10, originY);
    ctx.lineTo(width - 10, originY);
    ctx.stroke();

    // Y Axis
    ctx.beginPath();
    ctx.moveTo(originX, 10);
    ctx.lineTo(originX, height - 10);
    ctx.stroke();

    // Grid ticks
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '10px sans-serif';
    for (let x = 1; x <= 7; x++) {
      const px = originX + x * scaleX;
      ctx.beginPath();
      ctx.moveTo(px, originY - 3);
      ctx.lineTo(px, originY + 3);
      ctx.stroke();
      ctx.fillText(x, px - 3, originY + 16);
    }
    for (let y = 1; y <= 5; y++) {
      const py = originY - y * scaleY;
      ctx.beginPath();
      ctx.moveTo(originX - 3, py);
      ctx.lineTo(originX + 3, py);
      ctx.stroke();
      ctx.fillText(y, originX - 18, py + 4);
    }

    // Draw Curve f(x) = -x^2 + 6x - 5
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.beginPath();

    let firstPoint = true;
    for (let x = 0; x <= 6.5; x += 0.05) {
      const y = -Math.pow(x, 2) + 6 * x - 5;
      const px = originX + x * scaleX;
      const py = originY - y * scaleY;

      if (firstPoint) {
        ctx.moveTo(px, py);
        firstPoint = false;
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.stroke();

    // Highlight Vertex S(3, 4)
    const sx = originX + 3 * scaleX;
    const sy = originY - 4 * scaleY;
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(sx, sy, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 12px Outfit, sans-serif';
    ctx.fillText('S (3 | 4)', sx - 20, sy - 12);
  }

  // Render QR Codes into the Hub view
  renderQRHub() {
    const grid = document.getElementById('qrGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const ipInput = document.getElementById('ipAddressInput');
    let baseUrl = ipInput ? ipInput.value.trim() : '';
    if (!baseUrl) {
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        baseUrl = 'https://gubifn283.github.io/qr-raetsel-eimer';
      } else {
        baseUrl = window.location.origin + window.location.pathname;
      }
    }

    // Ensure baseUrl has no trailing slash before params
    baseUrl = baseUrl.replace(/\/$/, '');

    const puzzleDetails = [
      { id: 1, name: 'Mathematik', desc: 'Quadratische Funktionen', letter: 'E', color: '#3b82f6' },
      { id: 2, name: 'Geschichte', desc: 'Versailler Vertrag (1919)', letter: 'I', color: '#a855f7' },
      { id: 3, name: 'Englisch', desc: 'Grammatik & Zeitformen', letter: 'M', color: '#06b6d4' },
      { id: 4, name: 'Popkultur', desc: 'Guess the Actor (Tom Holland)', letter: 'E', color: '#ec4899' },
      { id: 5, name: 'Erdkunde', desc: '10 Länder in Europa', letter: 'R', color: '#10b981' }
    ];

    puzzleDetails.forEach(p => {
      const card = document.createElement('div');
      card.className = 'qr-card';
      const puzzleUrl = `${baseUrl}/?puzzle=${p.id}`;

      card.innerHTML = `
        <div class="qr-puzzle-num">Rätsel ${p.id} von 5</div>
        <div class="qr-puzzle-name">${p.name}</div>
        <div style="font-size: 0.85rem; color: var(--text-muted);">${p.desc}</div>
        <div class="qr-canvas-wrapper" id="qrcode-container-${p.id}"></div>
        <div style="font-size: 0.7rem; color: var(--text-dim); font-family: monospace; word-break: break-all; margin-bottom: 0.5rem;">${puzzleUrl}</div>
        <div class="qr-letter-tag">Gewinn: ${p.letter}</div>
        <button class="btn btn-glass" style="margin-top: 1rem; width: 100%; font-size: 0.85rem;">
          ▶️ Rätsel ${p.id} auf diesem PC öffnen
        </button>
      `;

      card.querySelector('button').addEventListener('click', () => {
        this.playSound('click');
        this.showView(`p${p.id}`);
      });

      grid.appendChild(card);

      // Render QRCode inside container
      setTimeout(() => {
        const container = document.getElementById(`qrcode-container-${p.id}`);
        if (container) {
          container.innerHTML = '';
          if (window.QRCode) {
            new QRCode(container, {
              text: puzzleUrl,
              width: 180,
              height: 180,
              colorDark: "#0f172a",
              colorLight: "#ffffff",
              correctLevel: QRCode.CorrectLevel.H
            });
          } else {
            // Fallback text if script fails
            container.innerHTML = `<div style="padding: 1rem; font-size: 0.8rem; color: #000;">${puzzleUrl}</div>`;
          }
        }
      }, 100);
    });
  }

  // Modals & Celebrations
  showModal(letter, puzzleIndex) {
    document.getElementById('modalLetter').textContent = letter;
    document.getElementById('modalPuzzleNum').textContent = `Buchstabe ${puzzleIndex} von 5 freigeschaltet`;
    document.getElementById('unlockModal').classList.add('active');
  }

  closeModal() {
    document.getElementById('unlockModal').classList.remove('active');
  }

  triggerConfetti() {
    if (window.confetti) {
      window.confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  }
}

// Initialize application on DOM content loaded
document.addEventListener('DOMContentLoaded', () => {
  window.app = new RiddleApp();
});
