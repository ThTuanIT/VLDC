/**
 * Application Logic for Physics Review Web App (Vật lý đại cương EPU)
 */

class PhysicsApp {
  constructor() {
    const rawData = (typeof PHYSICS_DATA !== 'undefined') ? PHYSICS_DATA : (window.PHYSICS_DATA || []);
    this.allQuestions = Array.isArray(rawData) ? rawData : [];
    this.filteredQuestions = [...this.allQuestions];
    this.currentIndex = 0;
    
    // User state from localStorage
    this.userAnswers = this.loadStorage('phy_user_answers', {});
    this.bookmarks = new Set(this.loadStorage('phy_bookmarks', []));
    this.flashcardMastered = new Set(this.loadStorage('phy_fc_mastered', []));
    this.soundEnabled = this.loadStorage('phy_sound', true);
    this.theme = this.loadStorage('phy_theme', 'light');
    
    // UI state
    this.currentMode = 'practice'; // practice, exam, flashcard, mistakes, bookmarks, table
    this.activeChapter = 'all';
    this.searchQuery = '';
    this.isShowingAnnot = false;
    this.fcFlipped = false;
    
    // Exam state
    this.examState = {
      active: false,
      questions: [],
      currentIndex: 0,
      answers: {},
      bookmarks: new Set(),
      timer: null,
      timeLeft: 1800, // seconds
      totalTime: 1800
    };

    // Web Audio Context
    this.audioCtx = null;

    this.init();
  }

  init() {
    this.applyTheme(this.theme);
    this.updateSoundButton();
    this.setupEventListeners();
    this.renderChapterSelect();
    this.filterQuestions();
    this.updateStats();
    this.renderCurrentQuestion();
    this.renderTable();
  }

  // --- Storage Helpers ---
  loadStorage(key, defaultVal) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : defaultVal;
    } catch (e) {
      return defaultVal;
    }
  }

  saveStorage(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {
      console.warn("Storage full or disabled");
    }
  }

  // --- Audio Synthesizer (Web Audio API) ---
  initAudio() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  playSound(type) {
    if (!this.soundEnabled) return;
    try {
      this.initAudio();
      if (!this.audioCtx) return;

      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      if (type === 'correct') {
        // High upbeat chime (E5 -> G5)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(659.25, now);
        osc.frequency.setValueAtTime(783.99, now + 0.1);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'wrong') {
        // Soft low double-thud
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(260, now);
        osc.frequency.setValueAtTime(200, now + 0.12);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      } else if (type === 'click') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
      } else if (type === 'fanfare') {
        // Celebration arpeggio
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, idx) => {
          const subOsc = this.audioCtx.createOscillator();
          const subGain = this.audioCtx.createGain();
          subOsc.connect(subGain);
          subGain.connect(this.audioCtx.destination);
          subOsc.frequency.setValueAtTime(freq, now + idx * 0.09);
          subGain.gain.setValueAtTime(0.15, now + idx * 0.09);
          subGain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.25);
          subOsc.start(now + idx * 0.09);
          subOsc.stop(now + idx * 0.09 + 0.25);
        });
      }
    } catch (e) {
      // Audio not supported or blocked
    }
  }

  toggleSound() {
    this.soundEnabled = !this.soundEnabled;
    this.saveStorage('phy_sound', this.soundEnabled);
    this.updateSoundButton();
  }

  updateSoundButton() {
    const btn = document.getElementById('soundBtn');
    if (btn) {
      btn.textContent = this.soundEnabled ? '🔔' : '🔕';
      btn.title = this.soundEnabled ? 'Âm thanh: BẬT' : 'Âm thanh: TẮT';
    }
  }

  // --- Theme ---
  toggleTheme() {
    this.theme = this.theme === 'light' ? 'dark' : 'light';
    this.applyTheme(this.theme);
    this.saveStorage('phy_theme', this.theme);
  }

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const btn = document.getElementById('themeBtn');
    if (btn) {
      btn.textContent = theme === 'dark' ? '☀️' : '🌙';
      btn.title = theme === 'dark' ? 'Giao diện: TỐI' : 'Giao diện: SÁNG';
    }
  }

  // --- Navigation & Mode Switching ---
  setMode(mode) {
    if (this.currentMode === 'exam' && this.examState.active && mode !== 'exam') {
      if (!confirm("Bạn đang làm bài thi thử. Chuyển chế độ sẽ hủy bài thi hiện tại. Bạn có chắc không?")) {
        return;
      }
      this.endExam(false);
    }

    this.currentMode = mode;
    this.playSound('click');

    // Update Nav Tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.mode === mode);
    });

    // Hide all view containers
    const pView = document.getElementById('practiceView');
    const eView = document.getElementById('examView');
    const fView = document.getElementById('flashcardView');
    const tView = document.getElementById('tableView');
    const controls = document.getElementById('controlsBar');
    const progress = document.getElementById('progressBarCard');

    pView.style.display = 'none';
    eView.style.display = 'none';
    fView.style.display = 'none';
    tView.style.display = 'none';
    controls.style.display = 'flex';
    progress.style.display = 'flex';

    if (mode === 'practice') {
      pView.style.display = 'grid';
      this.filterQuestions();
    } else if (mode === 'mistakes') {
      pView.style.display = 'grid';
      this.filterQuestions();
    } else if (mode === 'bookmarks') {
      pView.style.display = 'grid';
      this.filterQuestions();
    } else if (mode === 'exam') {
      controls.style.display = 'none';
      progress.style.display = 'none';
      eView.style.display = 'flex';
      if (!this.examState.active) {
        this.openExamSetup();
      }
    } else if (mode === 'flashcard') {
      fView.style.display = 'flex';
      this.filterQuestions();
      this.renderFlashcard();
    } else if (mode === 'table') {
      tView.style.display = 'flex';
      this.renderTable();
    }

    this.updateStats();
  }

  // --- Filtering ---
  changeChapter(val) {
    this.activeChapter = val;
    this.currentIndex = 0;
    this.filterQuestions();
    this.playSound('click');
  }

  handleSearch(query) {
    this.searchQuery = query.trim().toLowerCase();
    this.currentIndex = 0;
    this.filterQuestions();
  }

  filterQuestions() {
    let list = [...this.allQuestions];

    // Filter by mode
    if (this.currentMode === 'mistakes') {
      list = list.filter(q => this.userAnswers[q.id] && !this.userAnswers[q.id].isCorrect);
    } else if (this.currentMode === 'bookmarks') {
      list = list.filter(q => this.bookmarks.has(q.id));
    }

    // Filter by Chapter
    if (this.activeChapter !== 'all') {
      const cId = parseInt(this.activeChapter, 10);
      list = list.filter(q => q.chapterId === cId);
    }

    // Filter by Search Query
    if (this.searchQuery) {
      list = list.filter(q => {
        const matchesNum = q.num.toString() === this.searchQuery || q.id.toString() === this.searchQuery;
        const matchesText = q.questionText && q.questionText.toLowerCase().includes(this.searchQuery);
        return matchesNum || matchesText;
      });
    }

    this.filteredQuestions = list;
    if (this.currentIndex >= this.filteredQuestions.length) {
      this.currentIndex = Math.max(0, this.filteredQuestions.length - 1);
    }

    if (this.currentMode === 'flashcard') {
      this.renderFlashcard();
    } else {
      this.renderCurrentQuestion();
      this.renderPalette();
    }
  }

  // --- Render Practice Question ---
  renderCurrentQuestion() {
    const q = this.filteredQuestions[this.currentIndex];
    const qCard = document.getElementById('questionCard');

    if (!q) {
      qCard.innerHTML = `
        <div style="text-align: center; padding: 3rem 1rem;">
          <div style="font-size: 3rem; margin-bottom: 0.5rem;">🔍</div>
          <h3>Không có câu hỏi nào phù hợp</h3>
          <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 0.5rem;">
            Vui lòng thử chọn chương khác hoặc xóa nội dung tìm kiếm.
          </p>
          <button class="btn btn-primary" style="margin-top: 1rem;" onclick="app.resetFilter()">Hiển thị tất cả 362 câu</button>
        </div>
      `;
      return;
    }

    // Reconstruct card if previously empty
    if (!document.getElementById('questionImg')) {
      location.reload();
      return;
    }

    // Badges
    document.getElementById('qChapterBadge').textContent = q.chapterTitle;
    document.getElementById('qNumberBadge').textContent = `Câu ${q.num} (Mã #${q.id})`;
    document.getElementById('qPageBadge').textContent = `Trang ${q.page}`;

    // Bookmark Icon
    const isBookmarked = this.bookmarks.has(q.id);
    document.getElementById('bookmarkIcon').textContent = isBookmarked ? '★ Đã lưu' : '☆ Đánh dấu';
    document.getElementById('bookmarkBtn').classList.toggle('active', isBookmarked);

    // Annot view button & Image source
    this.updateQuestionImage(q);

    // Reset Options and Banner
    const optionsGrid = document.getElementById('optionsGrid');
    const optButtons = optionsGrid.querySelectorAll('.opt-btn');
    const banner = document.getElementById('answerBanner');
    banner.className = 'answer-banner';
    banner.style.display = 'none';

    const savedAnswer = this.userAnswers[q.id];

    optButtons.forEach(btn => {
      const opt = btn.dataset.opt;
      btn.className = 'opt-btn';
      btn.disabled = false;

      if (savedAnswer) {
        if (opt === q.answer) {
          btn.classList.add('correct');
        } else if (opt === savedAnswer.selected) {
          btn.classList.add('wrong');
        }
      }
    });

    if (savedAnswer) {
      if (savedAnswer.isCorrect) {
        banner.className = 'answer-banner correct';
        document.getElementById('bannerTitle').innerHTML = '✓ Chính xác!';
        document.getElementById('bannerDesc').innerHTML = `Đáp án đúng là <strong>${q.answer}</strong>. (Bấm "Bản gốc bôi màu" để đối chiếu bản PDF)`;
      } else {
        banner.className = 'answer-banner wrong';
        document.getElementById('bannerTitle').innerHTML = '✗ Chưa chính xác!';
        document.getElementById('bannerDesc').innerHTML = `Bạn chọn <strong>${savedAnswer.selected}</strong>. Đáp án chuẩn từ đề là <strong>${q.answer}</strong>.`;
      }
      banner.style.display = 'block';
    }

    this.updatePaletteActive();
  }

  updateQuestionImage(q) {
    const img = document.getElementById('questionImg');
    const badge = document.getElementById('annotBadge');
    const btn = document.getElementById('toggleAnnotBtn');

    if (this.isShowingAnnot) {
      img.src = q.imageAnnot;
      badge.style.display = 'block';
      btn.classList.add('active');
      btn.innerHTML = '<span>📄 Xem bản câu hỏi sạch</span>';
    } else {
      img.src = q.imageClean;
      badge.style.display = 'none';
      btn.classList.remove('active');
      btn.innerHTML = '<span>🎨 Bản gốc bôi màu</span>';
    }
  }

  toggleAnnotView() {
    this.isShowingAnnot = !this.isShowingAnnot;
    const q = this.filteredQuestions[this.currentIndex];
    if (q) {
      this.updateQuestionImage(q);
      this.playSound('click');
    }
  }

  // --- Answering ---
  chooseOption(opt) {
    const q = this.filteredQuestions[this.currentIndex];
    if (!q) return;

    const isCorrect = (opt === q.answer);
    this.userAnswers[q.id] = {
      selected: opt,
      isCorrect: isCorrect,
      timestamp: Date.now()
    };
    this.saveStorage('phy_user_answers', this.userAnswers);

    if (isCorrect) {
      this.playSound('correct');
    } else {
      this.playSound('wrong');
    }

    this.renderCurrentQuestion();
    this.renderPalette();
    this.updateStats();
  }

  revealAnswer() {
    const q = this.filteredQuestions[this.currentIndex];
    if (!q) return;

    // Simulate choosing or revealing answer
    this.isShowingAnnot = true;
    this.chooseOption(q.answer);
  }

  // --- Navigation Controls ---
  prevQuestion() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.isShowingAnnot = false;
      this.renderCurrentQuestion();
      this.playSound('click');
    }
  }

  nextQuestion() {
    if (this.currentIndex < this.filteredQuestions.length - 1) {
      this.currentIndex++;
      this.isShowingAnnot = false;
      this.renderCurrentQuestion();
      this.playSound('click');
    }
  }

  jumpToQuestion(index) {
    if (index >= 0 && index < this.filteredQuestions.length) {
      this.currentIndex = index;
      this.isShowingAnnot = false;
      this.renderCurrentQuestion();
      this.playSound('click');
    }
  }

  randomQuestion() {
    if (this.filteredQuestions.length > 1) {
      let rand;
      do {
        rand = Math.floor(Math.random() * this.filteredQuestions.length);
      } while (rand === this.currentIndex);
      this.currentIndex = rand;
      this.isShowingAnnot = false;
      this.renderCurrentQuestion();
      this.playSound('click');
    }
  }

  toggleBookmarkCurrent() {
    const q = this.filteredQuestions[this.currentIndex];
    if (!q) return;

    if (this.bookmarks.has(q.id)) {
      this.bookmarks.delete(q.id);
    } else {
      this.bookmarks.add(q.id);
    }
    this.saveStorage('phy_bookmarks', Array.from(this.bookmarks));
    this.playSound('click');
    this.renderCurrentQuestion();
    this.renderPalette();
    this.updateStats();
  }

  // --- Palette Grid ---
  renderPalette() {
    const grid = document.getElementById('paletteGrid');
    if (!grid) return;

    grid.innerHTML = '';
    const total = this.filteredQuestions.length;
    document.getElementById('paletteCount').textContent = `${total} câu`;

    this.filteredQuestions.forEach((q, idx) => {
      const btn = document.createElement('button');
      btn.className = 'palette-btn';
      btn.textContent = q.num;
      btn.title = `Mã #${q.id} • ${q.chapterTitle} • Câu ${q.num}`;

      if (idx === this.currentIndex) {
        btn.classList.add('active');
      }

      const ans = this.userAnswers[q.id];
      if (ans) {
        if (ans.isCorrect) btn.classList.add('correct');
        else btn.classList.add('wrong');
      }

      if (this.bookmarks.has(q.id)) {
        btn.classList.add('bookmarked');
      }

      btn.onclick = () => this.jumpToQuestion(idx);
      grid.appendChild(btn);
    });
  }

  updatePaletteActive() {
    const grid = document.getElementById('paletteGrid');
    if (!grid) return;
    const btns = grid.querySelectorAll('.palette-btn');
    btns.forEach((btn, idx) => {
      btn.classList.toggle('active', idx === this.currentIndex);
    });
  }

  // --- Statistics & Progress ---
  updateStats() {
    const totalAll = this.allQuestions.length;
    const answeredKeys = Object.keys(this.userAnswers);
    const correctCount = answeredKeys.filter(k => this.userAnswers[k].isCorrect).length;
    const wrongCount = answeredKeys.filter(k => !this.userAnswers[k].isCorrect).length;
    const bookmarkCount = this.bookmarks.size;

    // Badges in tabs
    document.getElementById('tabPracticeCount').textContent = totalAll;
    document.getElementById('tabMistakeCount').textContent = wrongCount;
    document.getElementById('tabBookmarkCount').textContent = bookmarkCount;

    // Chips
    document.getElementById('statTotal').textContent = this.filteredQuestions.length;
    document.getElementById('statCorrect').textContent = correctCount;
    document.getElementById('statWrong').textContent = wrongCount;

    // Progress Bar
    const percentAttempted = totalAll > 0 ? Math.round((answeredKeys.length / totalAll) * 100) : 0;
    const percentCorrect = answeredKeys.length > 0 ? Math.round((correctCount / answeredKeys.length) * 100) : 0;

    document.getElementById('progressText').textContent = `Tiến độ ôn tập: ${answeredKeys.length} / ${totalAll} câu (${percentAttempted}%)`;
    document.getElementById('accuracyText').textContent = `Độ chính xác: ${percentCorrect}%`;

    const widthCorrect = (correctCount / totalAll) * 100;
    const widthWrong = (wrongCount / totalAll) * 100;
    document.getElementById('progressBarCorrect').style.width = `${widthCorrect}%`;
    document.getElementById('progressBarWrong').style.width = `${widthWrong}%`;
  }

  // --- Flashcard Mode ---
  renderFlashcard() {
    const q = this.filteredQuestions[this.currentIndex];
    const banner = document.getElementById('fcAnswerBanner');
    this.fcFlipped = false;
    banner.style.display = 'none';

    if (!q) {
      document.getElementById('fcNumber').textContent = '0 / 0';
      return;
    }

    document.getElementById('fcChapter').textContent = q.chapterTitle;
    document.getElementById('fcNumber').textContent = `Thẻ ${this.currentIndex + 1} / ${this.filteredQuestions.length} (Mã #${q.id})`;
    document.getElementById('fcImg').src = q.imageClean;

    document.getElementById('fcAnswerTitle').innerHTML = `Đáp án chính xác: <strong>${q.answer}</strong>`;
    document.getElementById('fcAnswerDesc').textContent = q.highlightText || 'Đáp án được đối chiếu từ tệp PDF gốc.';
  }

  flipFlashcard() {
    const q = this.filteredQuestions[this.currentIndex];
    if (!q) return;

    this.fcFlipped = !this.fcFlipped;
    const banner = document.getElementById('fcAnswerBanner');
    const img = document.getElementById('fcImg');

    if (this.fcFlipped) {
      banner.style.display = 'block';
      img.src = q.imageAnnot;
      this.playSound('correct');
    } else {
      banner.style.display = 'none';
      img.src = q.imageClean;
      this.playSound('click');
    }
  }

  prevFlashcard() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.renderFlashcard();
      this.playSound('click');
    }
  }

  nextFlashcard() {
    if (this.currentIndex < this.filteredQuestions.length - 1) {
      this.currentIndex++;
      this.renderFlashcard();
      this.playSound('click');
    }
  }

  markFlashcard(mastered) {
    const q = this.filteredQuestions[this.currentIndex];
    if (!q) return;

    if (mastered) {
      this.flashcardMastered.add(q.id);
      this.playSound('correct');
    } else {
      this.flashcardMastered.delete(q.id);
      this.playSound('wrong');
    }
    this.saveStorage('phy_fc_mastered', Array.from(this.flashcardMastered));
    this.nextFlashcard();
  }

  // --- Table View ---
  renderTable() {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;

    tbody.innerHTML = '';
    this.allQuestions.forEach(q => {
      const tr = document.createElement('tr');
      const ansInfo = this.userAnswers[q.id];
      let statusStyle = '';
      if (ansInfo) {
        statusStyle = ansInfo.isCorrect ? 'color: var(--success);' : 'color: var(--danger);';
      }

      tr.innerHTML = `
        <td style="font-weight: 700;">#${q.id}</td>
        <td>${q.chapterTitle.split(':')[0]}</td>
        <td>Câu ${q.num}</td>
        <td>Trang ${q.page}</td>
        <td style="max-width: 450px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${q.questionText}">
          ${q.questionText || 'Câu hỏi trắc nghiệm vật lý'}
        </td>
        <td style="text-align: center;">
          <span class="key-badge" style="${statusStyle}">${q.answer}</span>
        </td>
        <td style="text-align: center;">
          <button class="btn btn-outline" style="padding: 0.25rem 0.6rem; font-size: 0.75rem;" onclick="app.jumpFromTable(${q.id})">Làm câu này</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  jumpFromTable(qId) {
    this.setMode('practice');
    this.activeChapter = 'all';
    document.getElementById('chapterSelect').value = 'all';
    this.filterQuestions();
    const idx = this.filteredQuestions.findIndex(q => q.id === qId);
    if (idx !== -1) {
      this.jumpToQuestion(idx);
    }
  }

  // --- Exam Simulator ---
  openExamSetup() {
    document.getElementById('examSetupModal').classList.add('open');
  }

  closeExamSetupModal() {
    document.getElementById('examSetupModal').classList.remove('open');
  }

  startExam() {
    const scope = document.getElementById('examScopeSelect').value;
    const preset = document.getElementById('examPresetSelect').value;
    const shuffle = document.getElementById('shuffleExamCheck').checked;

    let pool = [...this.allQuestions];
    if (scope !== 'all') {
      const cId = parseInt(scope, 10);
      pool = pool.filter(q => q.chapterId === cId);
    }

    if (shuffle) {
      pool.sort(() => Math.random() - 0.5);
    }

    let count = 40;
    let minutes = 30;

    if (preset === '20_15') { count = 20; minutes = 15; }
    else if (preset === '40_30') { count = 40; minutes = 30; }
    else if (preset === '50_45') { count = 50; minutes = 45; }
    else if (preset === 'all_60') { count = pool.length; minutes = 60; }

    const examQuestions = pool.slice(0, Math.min(count, pool.length));

    const feedbackMode = document.getElementById('examFeedbackModeSelect') ? document.getElementById('examFeedbackModeSelect').value : 'instant';

    this.examState = {
      active: true,
      questions: examQuestions,
      currentIndex: 0,
      answers: {},
      bookmarks: new Set(),
      instantFeedback: (feedbackMode === 'instant'),
      isShowingAnnot: false,
      timer: null,
      timeLeft: minutes * 60,
      totalTime: minutes * 60
    };

    this.closeExamSetupModal();
    this.startExamTimer();
    this.renderExamQuestion();
    this.renderExamPalette();
    this.playSound('fanfare');
  }

  startExamTimer() {
    if (this.examState.timer) clearInterval(this.examState.timer);
    this.updateExamTimerDisplay();

    this.examState.timer = setInterval(() => {
      this.examState.timeLeft--;
      this.updateExamTimerDisplay();

      if (this.examState.timeLeft <= 0) {
        clearInterval(this.examState.timer);
        alert("Hết giờ làm bài thi!");
        this.submitExam();
      }
    }, 1000);
  }

  updateExamTimerDisplay() {
    const el = document.getElementById('examTimer');
    const mins = Math.floor(this.examState.timeLeft / 60);
    const secs = this.examState.timeLeft % 60;
    el.textContent = `⏱️ ${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    el.classList.toggle('urgent', this.examState.timeLeft < 120);
  }

  renderExamQuestion() {
    const q = this.examState.questions[this.examState.currentIndex];
    if (!q) return;

    document.getElementById('examQBadge').textContent = `Câu ${this.examState.currentIndex + 1} / ${this.examState.questions.length}`;
    document.getElementById('examChapBadge').textContent = q.chapterTitle;

    // Image & Annot view
    const img = document.getElementById('examQuestionImg');
    const badge = document.getElementById('examAnnotBadge');
    const toggleAnnotBtn = document.getElementById('examToggleAnnotBtn');

    if (this.examState.isShowingAnnot) {
      img.src = q.imageAnnot;
      badge.style.display = 'block';
      if (toggleAnnotBtn) toggleAnnotBtn.innerHTML = '<span>📄 Câu hỏi sạch</span>';
    } else {
      img.src = q.imageClean;
      badge.style.display = 'none';
      if (toggleAnnotBtn) toggleAnnotBtn.innerHTML = '<span>🎨 Bản gốc bôi màu</span>';
    }

    const isMarked = this.examState.bookmarks.has(q.id);
    document.getElementById('examBookmarkIcon').textContent = isMarked ? '★ Đã đánh dấu' : '☆ Đánh dấu xem lại';

    // Live score and toggle feedback button in exam header
    const liveScoreEl = document.getElementById('examLiveScore');
    const toggleFeedbackBtn = document.getElementById('examToggleFeedbackBtn');

    if (this.examState.instantFeedback) {
      liveScoreEl.style.display = 'flex';
      toggleFeedbackBtn.innerHTML = '⚡ Biết kết quả: <strong>BẬT</strong>';
      toggleFeedbackBtn.style.background = 'rgba(16, 185, 129, 0.3)';
      
      let correctCnt = 0;
      let wrongCnt = 0;
      this.examState.questions.forEach(item => {
        const a = this.examState.answers[item.id];
        if (a) {
          if (a === item.answer) correctCnt++;
          else wrongCnt++;
        }
      });
      document.getElementById('examLiveCorrect').textContent = correctCnt;
      document.getElementById('examLiveWrong').textContent = wrongCnt;
    } else {
      liveScoreEl.style.display = 'none';
      toggleFeedbackBtn.innerHTML = '⚡ Biết kết quả: <strong>TẮT</strong>';
      toggleFeedbackBtn.style.background = 'rgba(255, 255, 255, 0.2)';
    }

    const selected = this.examState.answers[q.id];
    const btns = document.getElementById('examOptionsGrid').querySelectorAll('.opt-btn');
    const banner = document.getElementById('examAnswerBanner');
    const statusBadge = document.getElementById('examStatusBadge');

    btns.forEach(btn => {
      btn.className = 'opt-btn';
    });

    if (this.examState.instantFeedback && selected) {
      // Instant mode: reveal correct/incorrect immediately!
      btns.forEach(btn => {
        const opt = btn.dataset.opt;
        if (opt === q.answer) {
          btn.classList.add('correct');
        } else if (opt === selected) {
          btn.classList.add('wrong');
        }
      });

      if (toggleAnnotBtn) toggleAnnotBtn.style.display = 'inline-flex';
      banner.style.display = 'block';

      if (selected === q.answer) {
        banner.className = 'answer-banner correct';
        document.getElementById('examBannerTitle').innerHTML = '✓ Chính xác!';
        document.getElementById('examBannerDesc').innerHTML = `Đáp án đúng là <strong>${q.answer}</strong>.`;
      } else {
        banner.className = 'answer-banner wrong';
        document.getElementById('examBannerTitle').innerHTML = '✗ Chưa chính xác!';
        document.getElementById('examBannerDesc').innerHTML = `Bạn chọn <strong>${selected}</strong>. Đáp án đúng là <strong>${q.answer}</strong>.`;
      }
      statusBadge.style.display = 'inline-block';
      statusBadge.textContent = selected === q.answer ? 'Đúng' : 'Sai';
      statusBadge.style.color = selected === q.answer ? 'var(--success)' : 'var(--danger)';
    } else {
      // Deferred mode or unanswered: standard exam behavior
      if (selected) {
        btns.forEach(btn => {
          if (btn.dataset.opt === selected) {
            btn.classList.add('selected-exam');
          }
        });
      }
      if (toggleAnnotBtn) toggleAnnotBtn.style.display = 'none';
      banner.style.display = 'none';
      statusBadge.style.display = 'none';
    }

    document.getElementById('examProgressCount').textContent = `${Object.keys(this.examState.answers).length}/${this.examState.questions.length}`;
    this.updateExamPaletteActive();
  }

  toggleExamFeedbackMode() {
    this.examState.instantFeedback = !this.examState.instantFeedback;
    this.playSound('click');
    this.renderExamQuestion();
    this.renderExamPalette();
  }

  toggleExamAnnotView() {
    this.examState.isShowingAnnot = !this.examState.isShowingAnnot;
    this.playSound('click');
    this.renderExamQuestion();
  }

  chooseExamOption(opt) {
    const q = this.examState.questions[this.examState.currentIndex];
    if (!q) return;

    this.examState.answers[q.id] = opt;

    if (this.examState.instantFeedback) {
      const isCorrect = (opt === q.answer);
      if (isCorrect) {
        this.playSound('correct');
      } else {
        this.playSound('wrong');
      }

      // Record in global answers too so mistakes bank is populated
      this.userAnswers[q.id] = {
        selected: opt,
        isCorrect: isCorrect,
        timestamp: Date.now()
      };
      this.saveStorage('phy_user_answers', this.userAnswers);
      this.updateStats();
    } else {
      this.playSound('click');
    }

    this.renderExamQuestion();
    this.renderExamPalette();
  }

  toggleExamBookmark() {
    const q = this.examState.questions[this.examState.currentIndex];
    if (!q) return;

    if (this.examState.bookmarks.has(q.id)) {
      this.examState.bookmarks.delete(q.id);
    } else {
      this.examState.bookmarks.add(q.id);
    }
    this.playSound('click');
    this.renderExamQuestion();
    this.renderExamPalette();
  }

  prevExamQuestion() {
    if (this.examState.currentIndex > 0) {
      this.examState.currentIndex--;
      this.examState.isShowingAnnot = false;
      this.renderExamQuestion();
      this.playSound('click');
    }
  }

  nextExamQuestion() {
    if (this.examState.currentIndex < this.examState.questions.length - 1) {
      this.examState.currentIndex++;
      this.examState.isShowingAnnot = false;
      this.renderExamQuestion();
      this.playSound('click');
    }
  }

  renderExamPalette() {
    const grid = document.getElementById('examPaletteGrid');
    if (!grid) return;

    grid.innerHTML = '';
    this.examState.questions.forEach((q, idx) => {
      const btn = document.createElement('button');
      btn.className = 'palette-btn';
      btn.textContent = idx + 1;

      if (idx === this.examState.currentIndex) {
        btn.classList.add('active');
      }

      const ans = this.examState.answers[q.id];
      if (ans) {
        if (this.examState.instantFeedback) {
          if (ans === q.answer) {
            btn.classList.add('correct');
          } else {
            btn.classList.add('wrong');
          }
        } else {
          btn.style.background = 'var(--primary-light)';
          btn.style.color = 'var(--primary)';
          btn.style.borderColor = 'var(--primary)';
        }
      }

      if (this.examState.bookmarks.has(q.id)) {
        btn.classList.add('bookmarked');
      }

      btn.onclick = () => {
        this.examState.currentIndex = idx;
        this.examState.isShowingAnnot = false;
        this.renderExamQuestion();
        this.playSound('click');
      };
      grid.appendChild(btn);
    });
  }

  updateExamPaletteActive() {
    const grid = document.getElementById('examPaletteGrid');
    if (!grid) return;
    const btns = grid.querySelectorAll('.palette-btn');
    btns.forEach((btn, idx) => {
      btn.classList.toggle('active', idx === this.examState.currentIndex);
    });
  }

  submitExam() {
    const total = this.examState.questions.length;
    const answeredCount = Object.keys(this.examState.answers).length;

    if (this.examState.timeLeft > 0 && answeredCount < total) {
      if (!confirm(`Bạn mới trả lời ${answeredCount} / ${total} câu. Bạn có chắc chắn muốn nộp bài thi không?`)) {
        return;
      }
    }

    clearInterval(this.examState.timer);
    this.endExam(true);
  }

  endExam(showResults) {
    if (this.examState.timer) clearInterval(this.examState.timer);
    this.examState.active = false;

    if (!showResults) return;

    let correctCount = 0;
    this.examState.questions.forEach(q => {
      const userChoice = this.examState.answers[q.id];
      const isCorrect = (userChoice === q.answer);
      if (isCorrect) correctCount++;

      // Also record in overall user answers
      if (userChoice) {
        this.userAnswers[q.id] = {
          selected: userChoice,
          isCorrect: isCorrect,
          timestamp: Date.now()
        };
      }
    });

    this.saveStorage('phy_user_answers', this.userAnswers);
    this.updateStats();

    // Calculate score
    const total = this.examState.questions.length;
    const score = ((correctCount / total) * 10).toFixed(1);
    const timeSpent = this.examState.totalTime - this.examState.timeLeft;
    const mins = Math.floor(timeSpent / 60);
    const secs = timeSpent % 60;

    let evalText = 'CẦN CỐ GẮNG ÔN THÊM';
    if (score >= 9) evalText = 'XUẤT SẮC! 🎉';
    else if (score >= 8) evalText = 'RẤT GIỎI! 👏';
    else if (score >= 6.5) evalText = 'ĐẠT YÊU CẦU! 👍';

    document.getElementById('resultScore').textContent = score;
    document.getElementById('resultEvaluation').textContent = evalText;
    document.getElementById('resultDetails').textContent = `Số câu đúng: ${correctCount} / ${total} câu • Thời gian làm bài: ${mins} phút ${secs} giây`;

    document.getElementById('examResultModal').classList.add('open');
    this.playSound('fanfare');
  }

  closeExamResultModal() {
    document.getElementById('examResultModal').classList.remove('open');
  }

  reviewExamMistakes() {
    this.setMode('mistakes');
  }

  // --- Zoom Modal ---
  zoomImage() {
    const q = this.filteredQuestions[this.currentIndex];
    if (!q) return;

    const modal = document.getElementById('zoomModal');
    const zoomImg = document.getElementById('zoomImg');
    const title = document.getElementById('zoomTitle');

    zoomImg.src = this.isShowingAnnot ? q.imageAnnot : q.imageClean;
    title.textContent = `${q.chapterTitle} • Câu ${q.num} (Mã #${q.id})`;
    modal.classList.add('open');
    this.playSound('click');
  }

  closeZoomModal() {
    document.getElementById('zoomModal').classList.remove('open');
  }

  // --- Reset Modal ---
  openResetModal() {
    document.getElementById('resetModal').classList.add('open');
  }

  closeResetModal() {
    document.getElementById('resetModal').classList.remove('open');
  }

  confirmResetAll() {
    localStorage.removeItem('phy_user_answers');
    localStorage.removeItem('phy_bookmarks');
    localStorage.removeItem('phy_fc_mastered');
    this.userAnswers = {};
    this.bookmarks = new Set();
    this.flashcardMastered = new Set();
    this.closeResetModal();
    this.filterQuestions();
    this.updateStats();
    this.playSound('click');
    alert("Đã đặt lại toàn bộ tiến độ ôn tập thành công!");
  }

  resetFilter() {
    this.activeChapter = 'all';
    this.searchQuery = '';
    document.getElementById('chapterSelect').value = 'all';
    document.getElementById('searchInput').value = '';
    this.filterQuestions();
  }

  // --- Keyboard Shortcuts ---
  setupEventListeners() {
    window.addEventListener('keydown', (e) => {
      // Don't trigger when typing in search input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
        return;
      }

      const key = e.key.toUpperCase();

      if (this.currentMode === 'practice') {
        if (['A', 'B', 'C', 'D'].includes(key)) {
          this.chooseOption(key);
        } else if (['1', '2', '3', '4'].includes(key)) {
          const map = { '1': 'A', '2': 'B', '3': 'C', '4': 'D' };
          this.chooseOption(map[key]);
        } else if (e.key === 'ArrowLeft') {
          this.prevQuestion();
        } else if (e.key === 'ArrowRight') {
          this.nextQuestion();
        } else if (e.key === ' ') {
          e.preventDefault();
          this.revealAnswer();
        } else if (key === 'F' || key === 'S') {
          this.toggleBookmarkCurrent();
        }
      } else if (this.currentMode === 'exam' && this.examState.active) {
        if (['A', 'B', 'C', 'D'].includes(key)) {
          this.chooseExamOption(key);
        } else if (['1', '2', '3', '4'].includes(key)) {
          const map = { '1': 'A', '2': 'B', '3': 'C', '4': 'D' };
          this.chooseExamOption(map[key]);
        } else if (e.key === 'ArrowLeft') {
          this.prevExamQuestion();
        } else if (e.key === 'ArrowRight') {
          this.nextExamQuestion();
        }
      } else if (this.currentMode === 'flashcard') {
        if (e.key === ' ') {
          e.preventDefault();
          this.flipFlashcard();
        } else if (e.key === 'ArrowLeft') {
          this.prevFlashcard();
        } else if (e.key === 'ArrowRight') {
          this.nextFlashcard();
        }
      }
    });
  }

  renderChapterSelect() {
    // Select is populated in HTML
  }
}

// Global App Instance
let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new PhysicsApp();
});
