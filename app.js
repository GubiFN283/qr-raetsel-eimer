/* ==========================================================================
   QR-Code Rätsel-Rallye "EIMER" - Application Core Logic v2.0
   ========================================================================== */

const SOLUTION_WORD = ['E', 'I', 'M', 'E', 'R'];
const LOCAL_STORAGE_KEY = 'qr_eimer_progress_v2';

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

    if (this.isFullyCompleted()) {
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
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.1);
        osc.frequency.setValueAtTime(783.99, now + 0.2);
        osc.frequency.setValueAtTime(1046.50, now + 0.3);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
        osc.start(now);
        osc.stop(now + 0.7);
      } else if (type === 'error') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.linearRampToValueAtTime(100, now + 0.2);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (type === 'click') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
      }
    } catch (e) {
      console.log('Audio playback prevented:', e);
    }
  }

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
      console.error('Failed to save progress', e);
    }
  }

  resetProgress() {
    if (confirm('Möchtest du deinen Fortschritt wirklich zurücksetzen? Alle freigeschalteten Buchstaben werden gelöscht.')) {
      this.progress = { 1: false, 2: false, 3: false, 4: false, 5: false };
      this.geoCountries = [];
      this.saveProgress();
      this.updateHeaderProgress();
      this.renderGeoChips();
      this.renderQRHub();
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

      const viewPanel = document.getElementById(`view-p${i}`);
      if (viewPanel) {
        const rewardSpan = viewPanel.querySelector('.reward-letter');
        if (rewardSpan) {
          if (this.progress[i]) {
            rewardSpan.textContent = SOLUTION_WORD[i - 1];
            rewardSpan.style.background = '#fbbf24';
            rewardSpan.style.color = '#000';
          } else {
            rewardSpan.textContent = '🔒 ?';
          }
        }
      }
    }
  }

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

  setupEventListeners() {
    document.getElementById('navHome').addEventListener('click', () => {
      this.playSound('click');
      this.showView('hub');
    });

    document.getElementById('btnShowHub').addEventListener('click', () => {
      this.playSound('click');
      this.showView('hub');
    });

    const btnReset = document.getElementById('btnReset');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        this.resetProgress();
      });
    }

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

  // --- VALIDATION LOGIC ---

  // Puzzle 1: Math Lineare Funktion f(x) = 2x + 4 -> f(3) = 10
  validateMath() {
    const yVal = parseFloat(document.getElementById('mathY').value);
    const fb = document.getElementById('feedbackMath');

    if (yVal === 10) {
      fb.className = 'feedback-box success';
      fb.innerHTML = '✅ Richtig! f(3) = 2 · 3 + 4 = 10.';
      this.unlockLetter(1);
    } else {
      this.playSound('error');
      fb.className = 'feedback-box error';
      fb.innerHTML = '❌ Leider nicht richtig. Rechne: 2 · 3 + 4 = ?';
    }
  }

  // Puzzle 2: History (Versailler Vertrag - Einzige Frage)
  validateHistory() {
    const year = document.getElementById('histYear').value.trim();
    const fb = document.getElementById('feedbackHistory');

    if (year === '1919') {
      fb.className = 'feedback-box success';
      fb.innerHTML = '✅ Richtig! Der Versailler Vertrag wurde 1919 unterzeichnet.';
      this.unlockLetter(2);
    } else {
      this.playSound('error');
      fb.className = 'feedback-box error';
      fb.innerHTML = '❌ Falsches Jahr. Tipp: Das Jahr liegt direkt nach Ende des 1. Weltkriegs (1919).';
    }
  }

  // Puzzle 3: English Simple Past ("went" and "watched")
  validateEnglish() {
    const eng1 = document.getElementById('eng1').value.trim().toLowerCase();
    const eng2 = document.getElementById('eng2').value.trim().toLowerCase();
    const fb = document.getElementById('feedbackEnglish');

    const c1 = eng1 === 'went';
    const c2 = eng2 === 'watched';

    if (c1 && c2) {
      fb.className = 'feedback-box success';
      fb.innerHTML = '✅ Richtig! "went" (Vergangenheit von go) und "watched" (Vergangenheit von watch).';
      this.unlockLetter(3);
    } else {
      this.playSound('error');
      fb.className = 'feedback-box error';
      fb.innerHTML = '❌ Nicht ganz richtig. Simple Past von "go" ist "went", Simple Past von "watch" ist "watched".';
    }
  }

  // Puzzle 4: Guess the Actor (Tom Holland)
  validateActor() {
    const val = document.getElementById('actorName').value.trim().toLowerCase();
    const fb = document.getElementById('feedbackActor');

    if (val.includes('tom holland') || val === 'holland') {
      fb.className = 'feedback-box success';
      fb.innerHTML = '✅ Richtig! Der gesuchte Schauspieler ist Tom Holland.';
      this.unlockLetter(4);
    } else {
      this.playSound('error');
      fb.className = 'feedback-box error';
      fb.innerHTML = '❌ Falscher Name. Er spielte Billy Elliot und Nathan Drake in Uncharted!';
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
      fb.innerHTML = `❌ "${rawVal}" liegt nicht in Europa oder ist falsch geschrieben.`;
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

  // Canvas Plotter for Linear Function f(x) = 2x + 4 (High-Contrast & Crisp)
  renderMathCanvas() {
    const canvas = document.getElementById('mathCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const width = canvas.width; // 600
    const height = canvas.height; // 380

    ctx.clearRect(0, 0, width, height);

    // Dark sleek background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    // Inner plot area padding
    const originX = 70;
    const originY = height - 50;
    const scaleX = 75; // 1 unit = 75px
    const scaleY = 25; // 1 unit = 25px

    // 1. Draw Grid Lines (Dashed)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    for (let x = 1; x <= 6; x++) {
      const px = originX + x * scaleX;
      ctx.beginPath();
      ctx.moveTo(px, 20);
      ctx.lineTo(px, originY);
      ctx.stroke();
    }
    for (let y = 2; y <= 12; y += 2) {
      const py = originY - y * scaleY;
      ctx.beginPath();
      ctx.moveTo(originX, py);
      ctx.lineTo(width - 20, py);
      ctx.stroke();
    }

    ctx.setLineDash([]); // Reset dash

    // 2. Draw Main Axes (Solid Cyan)
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;

    // X Axis
    ctx.beginPath();
    ctx.moveTo(30, originY);
    ctx.lineTo(width - 20, originY);
    ctx.stroke();

    // X Arrowhead
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(width - 15, originY);
    ctx.lineTo(width - 25, originY - 6);
    ctx.lineTo(width - 25, originY + 6);
    ctx.fill();

    // Y Axis
    ctx.beginPath();
    ctx.moveTo(originX, height - 20);
    ctx.lineTo(originX, 20);
    ctx.stroke();

    // Y Arrowhead
    ctx.beginPath();
    ctx.moveTo(originX, 15);
    ctx.lineTo(originX - 6, 25);
    ctx.lineTo(originX + 6, 25);
    ctx.fill();

    // Axis Names (X & Y)
    ctx.font = 'bold 16px Outfit, sans-serif';
    ctx.fillText('x', width - 25, originY + 25);
    ctx.fillText('y', originX - 25, 25);

    // 3. Draw Axis Tick Numbers (High Contrast White)
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px Outfit, sans-serif';

    // X Numbers
    for (let x = 1; x <= 6; x++) {
      const px = originX + x * scaleX;
      ctx.beginPath();
      ctx.moveTo(px, originY - 4);
      ctx.lineTo(px, originY + 4);
      ctx.stroke();
      ctx.fillText(x.toString(), px - 4, originY + 22);
    }

    // Y Numbers
    for (let y = 2; y <= 12; y += 2) {
      const py = originY - y * scaleY;
      ctx.beginPath();
      ctx.moveTo(originX - 4, py);
      ctx.lineTo(originX + 4, py);
      ctx.stroke();
      ctx.fillText(y.toString(), originX - 30, py + 5);
    }

    // 4. Draw Linear Function Line: f(x) = 2x + 4 (Neon Gold)
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 4;
    ctx.beginPath();

    const p1x = originX + 0 * scaleX;
    const p1y = originY - 4 * scaleY; // (0, 4)
    const p2x = originX + 4.2 * scaleX;
    const p2y = originY - (2 * 4.2 + 4) * scaleY; // (4.2, 12.4)

    ctx.moveTo(p1x, p1y);
    ctx.lineTo(p2x, p2y);
    ctx.stroke();

    // 5. Highlight Target Point P(3 | 10)
    const targetX = 3;
    const targetY = 10;
    const px = originX + targetX * scaleX;
    const py = originY - targetY * scaleY;

    // Glowing target point
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(px, py, 9, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px, py, 5, 0, Math.PI * 2);
    ctx.fill();

    // Point Badge Label
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 15px Outfit, sans-serif';
    ctx.fillText('P (3 | 10)', px - 30, py - 16);
  }

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

    baseUrl = baseUrl.replace(/\/$/, '');

    const puzzleDetails = [
      { id: 1, name: 'Mathematik', desc: 'Lineare Funktion f(3)', color: '#3b82f6' },
      { id: 2, name: 'Geschichte', desc: 'Versailler Vertrag (1919)', color: '#a855f7' },
      { id: 3, name: 'Englisch', desc: 'Simple Past Grammar', color: '#06b6d4' },
      { id: 4, name: 'Popkultur', desc: 'Guess the Actor', color: '#ec4899' },
      { id: 5, name: 'Erdkunde', desc: '10 Länder in Europa', color: '#10b981' }
    ];

    puzzleDetails.forEach(p => {
      const card = document.createElement('div');
      card.className = 'qr-card';
      const puzzleUrl = `${baseUrl}/?puzzle=${p.id}`;
      const isUnlocked = this.progress[p.id];
      const letterDisplay = isUnlocked ? `Gewinn: ${SOLUTION_WORD[p.id - 1]}` : `Gewinn: 🔒 Geheimer Buchstabe`;

      card.innerHTML = `
        <div class="qr-puzzle-num">Rätsel ${p.id} von 5</div>
        <div class="qr-puzzle-name">${p.name}</div>
        <div style="font-size: 0.85rem; color: var(--text-muted);">${p.desc}</div>
        <div class="qr-canvas-wrapper" id="qrcode-container-${p.id}"></div>
        <div style="font-size: 0.7rem; color: var(--text-dim); font-family: monospace; word-break: break-all; margin-bottom: 0.5rem;">${puzzleUrl}</div>
        <div class="qr-letter-tag">${letterDisplay}</div>
        <button class="btn btn-glass" style="margin-top: 1rem; width: 100%; font-size: 0.85rem;">
          ▶️ Rätsel ${p.id} öffnen
        </button>
      `;

      card.querySelector('button').addEventListener('click', () => {
        this.playSound('click');
        this.showView(`p${p.id}`);
      });

      grid.appendChild(card);

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
            container.innerHTML = `<div style="padding: 1rem; font-size: 0.8rem; color: #000;">${puzzleUrl}</div>`;
          }
        }
      }, 100);
    });
  }

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

document.addEventListener('DOMContentLoaded', () => {
  window.app = new RiddleApp();
});
