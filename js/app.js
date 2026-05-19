/**
 * 主应用逻辑 - 升级版
 */
const App = {
  currentPage: 'home',
  confirmCallback: null,

  async init() {
    await DB.init();
    await this.updateHomeStats();
    this._setupGreeting();
  },

  navigate(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById('page-' + page);
    if (target) {
      target.classList.add('active');
      this.currentPage = page;
    }
    switch (page) {
      case 'home': this.updateHomeStats(); break;
      case 'import': ImportPage.init(); break;
      case 'practice-setup': PracticeSetup.init(); break;
      case 'exam-setup': ExamSetup.init(); break;
      case 'wrong-book': WrongBook.init(); break;
      case 'history': HistoryPage.init(); break;
      case 'bank-manage': BankManage.init(); break;
      case 'data-manage': DataManage.init(); break;
    }
    window.scrollTo(0, 0);
  },

  async updateHomeStats() {
    const stats = await DB.getStats();
    const banks = await DB.getAllBanks();
    const wrongCount = await DB.getWrongQuestionCount();

    // 题库概览
    const overview = document.getElementById('bank-overview');
    const overviewList = document.getElementById('bank-overview-list');
    if (banks.length > 0) {
      overview.classList.remove('hidden');
      overviewList.innerHTML = banks.slice(0, 4).map(bank => `
        <div class="bg-white rounded-xl p-3 border border-gray-100 text-center">
          <div class="text-lg font-bold text-primary-500">${bank.questionCount}</div>
          <div class="text-xs text-gray-500 truncate">${bank.name}</div>
        </div>
      `).join('');
    } else {
      overview.classList.add('hidden');
    }

    // 错题数量 - 新版UI（徽章和小圆点）
    const wrongBadge = document.getElementById('wrong-count-badge');
    const wrongDot = document.getElementById('wrong-count-dot');
    if (wrongCount > 0) {
      wrongBadge.classList.remove('hidden');
      wrongDot.classList.remove('hidden');
      document.getElementById('wrong-count').textContent = wrongCount;
      wrongDot.textContent = wrongCount > 99 ? '99+' : wrongCount;
    } else {
      wrongBadge.classList.add('hidden');
      wrongDot.classList.add('hidden');
    }

    // 统计
    const homeStats = document.getElementById('home-stats');
    if (stats.totalQuestions > 0 || stats.recordCount > 0) {
      homeStats.classList.remove('hidden');
      document.getElementById('stat-total').textContent = stats.totalQuestions;
      document.getElementById('stat-accuracy').textContent = stats.accuracy + '%';
      document.getElementById('stat-wrong').textContent = stats.wrongCount;
    } else {
      homeStats.classList.add('hidden');
    }

    // 加载示例题库
    if (stats.totalQuestions === 0) {
      await this.loadSampleData();
    }
  },

  async loadSampleData() {
    const samples = Parser.generateSampleQuestions();
    const bank = await DB.createBank('示例题库');
    await DB.addQuestions(samples, bank.id);
    await this.updateHomeStats();
    App.showToast('已加载12道示例题目', 'info');
  },

  _setupGreeting() {
    const hour = new Date().getHours();
    let greeting = '开始学习吧！';
    if (hour < 6) greeting = '夜深了，注意休息哦';
    else if (hour < 9) greeting = '早上好呀';
    else if (hour < 12) greeting = '上午好，学习效率最高的时候';
    else if (hour < 14) greeting = '中午好，休息一下再继续';
    else if (hour < 18) greeting = '下午好，继续加油';
    else if (hour < 22) greeting = '晚上好呀';
    document.getElementById('greeting-text').textContent = greeting;
  },

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    const colors = { info: 'bg-primary-500', success: 'bg-green-500', warning: 'bg-orange-500', error: 'bg-red-500' };
    toast.className = `toast-in ${colors[type]} text-white px-4 py-3 rounded-xl shadow-lg text-sm font-medium max-w-xs`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.remove('toast-in');
      toast.classList.add('toast-out');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  },

  showConfirm(title, message, onConfirm) {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    this.confirmCallback = onConfirm;
    document.getElementById('confirm-modal').classList.remove('hidden');
    document.getElementById('confirm-btn').onclick = () => {
      if (this.confirmCallback) this.confirmCallback();
      this.closeConfirmModal();
    };
  },

  closeConfirmModal() {
    document.getElementById('confirm-modal').classList.add('hidden');
    this.confirmCallback = null;
  }
};

// ========== 题库管理 ==========
const BankManage = {
  async init() {
    const banks = await DB.getAllBanks();
    const list = document.getElementById('bank-list');
    const empty = document.getElementById('bank-empty');

    if (banks.length === 0) {
      list.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }

    empty.classList.add('hidden');
    list.innerHTML = banks.map(bank => `
      <div class="bg-white rounded-xl p-4 border border-gray-100">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center">
              <svg class="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
            </div>
            <div>
              <h3 class="font-medium text-gray-800">${bank.name}</h3>
              <p class="text-sm text-gray-400">${bank.questionCount} 道题目</p>
            </div>
          </div>
          <div class="flex gap-2">
            <button onclick="BankManage.rename('${bank.id}')" class="p-2 hover:bg-gray-100 rounded-lg transition" title="重命名">
              <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            </button>
            <button onclick="BankManage.delete('${bank.id}')" class="p-2 hover:bg-red-50 rounded-lg transition" title="删除">
              <svg class="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
        </div>
      </div>
    `).join('');
  },

  async rename(bankId) {
    const bank = await DB.getBank(bankId);
    const newName = prompt('请输入新的题库名称：', bank.name);
    if (newName && newName.trim()) {
      await DB.updateBank(bankId, { name: newName.trim() });
      App.showToast('题库已重命名', 'success');
      this.init();
      App.updateHomeStats();
    }
  },

  async delete(bankId) {
    const bank = await DB.getBank(bankId);
    App.showConfirm(
      '确认删除题库？',
      `将删除"${bank.name}"及其中所有题目，此操作不可恢复！`,
      async () => {
        await DB.deleteBank(bankId);
        App.showToast('题库已删除', 'success');
        this.init();
        App.updateHomeStats();
      }
    );
  }
};

// ========== 导入页面 ==========
const ImportPage = {
  parsedQuestions: [],
  currentBankName: '',
  _initialized: false,

  init() {
    // 加载 AI 配置
    const url = localStorage.getItem('ai_api_url') || '';
    const key = localStorage.getItem('ai_api_key') || '';
    const model = localStorage.getItem('ai_model') || '';
    
    if (url) document.getElementById('ai-api-url').value = url;
    if (key) document.getElementById('ai-api-key').value = key;
    if (model) document.getElementById('ai-model').value = model;

    // 只绑定一次事件
    if (!this._initialized) {
      this._setupDropZone();
      
      // 绑定 AI 启用切换
      const useAI = document.getElementById('use-ai-parse');
      const configPanel = document.getElementById('ai-config-panel');
      useAI.addEventListener('change', (e) => {
        configPanel.style.display = e.target.checked ? 'block' : 'none';
      });
      
      this._initialized = true;
    }
  },

  _setupDropZone() {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    if (!dropZone || !fileInput) return;

    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.docx') || f.name.endsWith('.pdf'));
      if (files.length > 0) ImportPage.handleFiles(files);
    });
    fileInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files);
      if (files.length > 0) ImportPage.handleFiles(files);
      fileInput.value = '';
    });
  },

  saveAIConfig() {
    const url = document.getElementById('ai-api-url').value.trim();
    const key = document.getElementById('ai-api-key').value.trim();
    const model = document.getElementById('ai-model').value.trim() || 'gpt-4o-mini';

    if (key) {
      AIParser.saveConfig({ baseUrl: url || 'https://api.openai.com/v1', apiKey: key, model });
      App.showToast('AI 配置已保存', 'success');
    } else {
      App.showToast('请输入 API 密钥', 'warning');
    }
  },

  async handleFiles(files) {
    const fileList = document.getElementById('file-list');
    const parseProgress = document.getElementById('parse-progress');
    const parsePreview = document.getElementById('parse-preview');
    const useAI = document.getElementById('use-ai-parse').checked;

    // 获取题库名称
    const nameInput = document.getElementById('bank-name-input');
    this.currentBankName = nameInput.value.trim() || files[0].name.replace(/\.(docx|pdf)$/i, '');

    fileList.classList.remove('hidden');
    fileList.innerHTML = files.map(f => `
      <div class="flex items-center gap-3 bg-white rounded-xl p-4 border border-gray-100">
        <div class="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center flex-shrink-0">
          <span class="text-xs font-bold text-primary-500">${f.name.split('.').pop().toUpperCase()}</span>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-gray-700 truncate">${f.name}</p>
          <p class="text-xs text-gray-400">${(f.size / 1024).toFixed(1)} KB</p>
        </div>
        <div class="file-status text-xs text-gray-400">等待解析</div>
      </div>
    `).join('');

    parseProgress.classList.remove('hidden');
    parsePreview.classList.add('hidden');
    this.parsedQuestions = [];

    for (let i = 0; i < files.length; i++) {
      const statusEls = fileList.querySelectorAll('.file-status');
      statusEls[i].textContent = useAI ? 'AI 解析中...' : '解析中...';
      statusEls[i].className = 'file-status text-xs text-primary-500 font-medium';

      try {
        const questions = await AIParser.parseFile(files[i], useAI, (percent) => {
          const totalProgress = Math.round(((i + percent / 100) / files.length) * 100);
          document.getElementById('parse-progress-bar').style.width = totalProgress + '%';
          document.getElementById('parse-progress-text').textContent = totalProgress + '%';
        });
        this.parsedQuestions.push(...questions);
        statusEls[i].textContent = `✓ ${questions.length}题`;
        statusEls[i].className = 'file-status text-xs text-green-500 font-medium';
      } catch (err) {
        statusEls[i].textContent = '✗ ' + err.message;
        statusEls[i].className = 'file-status text-xs text-red-500 font-medium';
      }
    }

    parseProgress.classList.add('hidden');

    if (this.parsedQuestions.length > 0) {
      this._showPreview();
    } else {
      App.showToast('未能解析出任何题目', 'warning');
    }
  },

  _showPreview() {
    const preview = document.getElementById('parse-preview');
    const previewList = document.getElementById('preview-list');
    const previewCount = document.getElementById('preview-count');

    preview.classList.remove('hidden');
    previewCount.textContent = `将导入到"${this.currentBankName}"，共 ${this.parsedQuestions.length} 道题目`;

    const typeLabels = { single: '单选', multiple: '多选', judgment: '判断', fill: '填空' };
    const typeColors = { single: 'bg-blue-100 text-blue-600', multiple: 'bg-purple-100 text-purple-600', judgment: 'bg-green-100 text-green-600', fill: 'bg-orange-100 text-orange-600' };

    previewList.innerHTML = this.parsedQuestions.slice(0, 10).map((q, idx) => `
      <div class="bg-white rounded-xl p-4 border border-gray-100">
        <div class="flex items-start gap-3">
          <span class="flex-shrink-0 w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-xs font-medium text-gray-500">${idx + 1}</span>
          <div class="flex-1 min-w-0">
            <span class="text-xs px-2 py-0.5 rounded-full ${typeColors[q.type] || 'bg-gray-100 text-gray-600'}">${typeLabels[q.type] || '未知'}</span>
            <p class="text-sm text-gray-700 line-clamp-2 mt-1">${q.question}</p>
          </div>
        </div>
      </div>
    `).join('');

    if (this.parsedQuestions.length > 10) {
      previewList.innerHTML += `<p class="text-center text-sm text-gray-400 py-2">还有 ${this.parsedQuestions.length - 10} 道题目...</p>`;
    }
  },

  async confirmImport() {
    try {
      const bank = await DB.createBank(this.currentBankName);
      const count = await DB.addQuestions(this.parsedQuestions, bank.id);
      App.showToast(`成功导入 ${count} 道题目到"${bank.name}"！`, 'success');
      this.parsedQuestions = [];
      this.currentBankName = '';
      document.getElementById('bank-name-input').value = '';
      App.navigate('home');
    } catch (err) {
      App.showToast('导入失败，请重试', 'error');
    }
  },

  cancelImport() {
    this.parsedQuestions = [];
    document.getElementById('parse-preview').classList.add('hidden');
    document.getElementById('file-list').classList.add('hidden');
  }
};

// ========== 练习设置 ==========
const PracticeSetup = {
  async init() {
    const banks = await DB.getAllBanks();
    const container = document.getElementById('practice-banks-container');

    if (banks.length === 0) {
      container.innerHTML = '<p class="text-sm text-gray-500">暂无题库，请先导入</p>';
      return;
    }

    // 为每个题库创建选择卡片
    container.innerHTML = banks.map(bank => `
      <div class="bank-selector bg-gray-50 rounded-xl p-4 border border-gray-200" data-bank-id="${bank.id}">
        <label class="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" class="bank-checkbox w-5 h-5 rounded text-primary-500" value="${bank.id}" checked>
          <div class="flex-1">
            <span class="font-medium text-gray-800">${bank.name}</span>
            <span class="text-xs text-gray-400 ml-2">(${bank.questionCount}题)</span>
          </div>
        </label>
        <div class="type-filter mt-3 pl-8" id="types-${bank.id}">
          <p class="text-xs text-gray-500 mb-2">选择题型：</p>
          <div class="flex flex-wrap gap-2">
            <label class="flex items-center gap-1 text-sm">
              <input type="checkbox" class="type-checkbox" value="single" checked> 单选
            </label>
            <label class="flex items-center gap-1 text-sm">
              <input type="checkbox" class="type-checkbox" value="multiple" checked> 多选
            </label>
            <label class="flex items-center gap-1 text-sm">
              <input type="checkbox" class="type-checkbox" value="judgment" checked> 判断
            </label>
            <label class="flex items-center gap-1 text-sm">
              <input type="checkbox" class="type-checkbox" value="fill" checked> 填空
            </label>
          </div>
        </div>
      </div>
    `).join('');

    // 绑定题库选择切换事件
    container.querySelectorAll('.bank-checkbox').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const typeFilter = e.target.closest('.bank-selector').querySelector('.type-filter');
        typeFilter.style.opacity = e.target.checked ? '1' : '0.5';
        typeFilter.style.pointerEvents = e.target.checked ? 'auto' : 'none';
      });
    });
  },

  async start() {
    const count = parseInt(document.getElementById('practice-count').value);
    const container = document.getElementById('practice-banks-container');
    
    // 收集选中的题库配置
    const bankConfigs = [];
    container.querySelectorAll('.bank-selector').forEach(selector => {
      const checkbox = selector.querySelector('.bank-checkbox');
      if (checkbox.checked) {
        const bankId = checkbox.value;
        const types = Array.from(selector.querySelectorAll('.type-checkbox:checked')).map(cb => cb.value);
        if (types.length > 0) {
          bankConfigs.push({ bankId, types });
        }
      }
    });

    if (bankConfigs.length === 0) {
      App.showToast('请至少选择一个题库', 'warning');
      return;
    }

    // 获取多题库组合的题目
    const questions = await DB.getQuestionsByMultiBanks(bankConfigs);
    if (questions.length === 0) {
      App.showToast('没有符合条件的题目', 'warning');
      return;
    }

    // 如果题目数量超过设定值，随机抽取
    let selected = questions;
    if (questions.length > count) {
      selected = QuizEngine.drawQuestions(questions, count);
    }

    QuizEngine.createSession({ mode: 'practice', questionCount: selected.length });
    QuizEngine.session.questions = selected;

    QuizPage.init('practice');
    App.navigate('quiz');
  }
};

// ========== 考试设置 ==========
const ExamSetup = {
  async init() {
    const banks = await DB.getAllBanks();
    const container = document.getElementById('exam-banks-container');

    if (banks.length === 0) {
      container.innerHTML = '<p class="text-sm text-gray-500">暂无题库，请先导入</p>';
      return;
    }

    // 为每个题库创建选择卡片
    container.innerHTML = banks.map(bank => `
      <div class="bank-selector bg-gray-50 rounded-xl p-4 border border-gray-200" data-bank-id="${bank.id}">
        <label class="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" class="bank-checkbox w-5 h-5 rounded text-orange-500" value="${bank.id}" checked>
          <div class="flex-1">
            <span class="font-medium text-gray-800">${bank.name}</span>
            <span class="text-xs text-gray-400 ml-2">(${bank.questionCount}题)</span>
          </div>
        </label>
        <div class="type-filter mt-3 pl-8" id="exam-types-${bank.id}">
          <p class="text-xs text-gray-500 mb-2">选择题型：</p>
          <div class="flex flex-wrap gap-2">
            <label class="flex items-center gap-1 text-sm">
              <input type="checkbox" class="type-checkbox" value="single" checked> 单选
            </label>
            <label class="flex items-center gap-1 text-sm">
              <input type="checkbox" class="type-checkbox" value="multiple" checked> 多选
            </label>
            <label class="flex items-center gap-1 text-sm">
              <input type="checkbox" class="type-checkbox" value="judgment" checked> 判断
            </label>
            <label class="flex items-center gap-1 text-sm">
              <input type="checkbox" class="type-checkbox" value="fill" checked> 填空
            </label>
          </div>
        </div>
      </div>
    `).join('');

    // 绑定题库选择切换事件
    container.querySelectorAll('.bank-checkbox').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const typeFilter = e.target.closest('.bank-selector').querySelector('.type-filter');
        typeFilter.style.opacity = e.target.checked ? '1' : '0.5';
        typeFilter.style.pointerEvents = e.target.checked ? 'auto' : 'none';
      });
    });
  },

  async start() {
    const count = parseInt(document.getElementById('exam-count').value);
    const timeLimit = parseInt(document.getElementById('exam-time').value) * 60;
    const container = document.getElementById('exam-banks-container');
    
    // 收集选中的题库配置
    const bankConfigs = [];
    container.querySelectorAll('.bank-selector').forEach(selector => {
      const checkbox = selector.querySelector('.bank-checkbox');
      if (checkbox.checked) {
        const bankId = checkbox.value;
        const types = Array.from(selector.querySelectorAll('.type-checkbox:checked')).map(cb => cb.value);
        if (types.length > 0) {
          bankConfigs.push({ bankId, types });
        }
      }
    });

    if (bankConfigs.length === 0) {
      App.showToast('请至少选择一个题库', 'warning');
      return;
    }

    // 获取多题库组合的题目
    const questions = await DB.getQuestionsByMultiBanks(bankConfigs);
    if (questions.length === 0) {
      App.showToast('没有符合条件的题目', 'warning');
      return;
    }

    // 如果题目数量超过设定值，随机抽取
    let selected = questions;
    if (questions.length > count) {
      selected = QuizEngine.drawQuestions(questions, count);
    }

    QuizEngine.createSession({ mode: 'exam', questionCount: selected.length, timeLimit });
    QuizEngine.session.questions = selected;

    QuizPage.init('exam');
    App.navigate('quiz');
  }
};

// ========== 答题页面 ==========
const QuizPage = {
  selectedAnswer: null,
  submitted: false,

  init(mode) {
    this.selectedAnswer = null;
    this.submitted = false;

    const session = QuizEngine.session;
    const modeLabel = document.getElementById('quiz-mode-label');
    const timerEl = document.getElementById('quiz-timer');

    modeLabel.textContent = mode === 'exam' ? '模拟考试' : mode === 'wrong' ? '错题练习' : '抽查练习';

    if (mode === 'exam') {
      timerEl.classList.remove('hidden');
      timerEl.classList.add('flex');
      this._updateTimerDisplay(session.timeRemaining);
      QuizEngine.startTimer(
        (remaining) => this._updateTimerDisplay(remaining),
        () => this._onTimeUp()
      );
    } else {
      timerEl.classList.add('hidden');
      timerEl.classList.remove('flex');
    }

    this._renderQuestion();
  },

  _updateTimerDisplay(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    const display = document.getElementById('timer-display');
    display.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    if (seconds <= 60) display.classList.add('timer-warning');
    else display.classList.remove('timer-warning');
  },

  _onTimeUp() {
    App.showToast('时间到！自动交卷', 'warning');
    this.finish();
  },

  _renderQuestion() {
    const question = QuizEngine.getCurrentQuestion();
    if (!question) return;

    // 多选题时 selectedAnswer 初始化为数组
    this.selectedAnswer = question.type === 'multiple' ? [] : null;
    this.submitted = false;

    const progress = QuizEngine.getProgress();
    document.getElementById('quiz-progress-bar').style.width = progress.percent + '%';
    document.getElementById('quiz-progress-text').textContent = `${progress.current}/${progress.total}`;
    document.getElementById('quiz-question-num').textContent = progress.current;
    document.getElementById('quiz-question-text').textContent = question.question;

    const typeLabels = { single: '单选题', multiple: '多选题', judgment: '判断题', fill: '填空题' };
    document.getElementById('quiz-type-tag').textContent = typeLabels[question.type] || '';

    const optionsEl = document.getElementById('quiz-options');
    const optionLabels = ['A', 'B', 'C', 'D', 'E', 'F'];

    if (question.type === 'fill') {
      optionsEl.innerHTML = `<div class="relative"><input type="text" id="fill-input" placeholder="请输入答案..." class="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:outline-none transition text-gray-700" oninput="QuizPage.selectedAnswer = this.value"></div>`;
    } else {
      optionsEl.innerHTML = question.options.map((opt, idx) => `
        <button class="option-btn w-full text-left px-4 py-3 border-2 border-gray-200 rounded-xl flex items-center gap-3 hover:border-primary-300 transition" onclick="QuizPage.selectOption('${optionLabels[idx]}', this)" data-option="${optionLabels[idx]}">
          <span class="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500">${optionLabels[idx]}</span>
          <span class="text-gray-700">${opt}</span>
        </button>
      `).join('');
    }

    document.getElementById('quiz-feedback').classList.add('hidden');
    document.getElementById('btn-submit').classList.remove('hidden');
    document.getElementById('btn-next').classList.add('hidden');
    document.getElementById('btn-finish').classList.add('hidden');
  },

  selectOption(option, el) {
    if (this.submitted) return;
    
    const question = QuizEngine.getCurrentQuestion();
    
    if (question.type === 'multiple') {
      // 多选题：支持多选/取消选择
      const idx = this.selectedAnswer.indexOf(option);
      if (idx > -1) {
        // 已选中，取消选择
        this.selectedAnswer.splice(idx, 1);
        el.classList.remove('selected');
      } else {
        // 未选中，添加选择
        this.selectedAnswer.push(option);
        el.classList.add('selected');
      }
      // 按字母顺序排序
      this.selectedAnswer.sort();
    } else {
      // 单选题/判断题：单选逻辑
      this.selectedAnswer = option;
      document.querySelectorAll('.option-btn').forEach(btn => btn.classList.remove('selected'));
      el.classList.add('selected');
    }
  },

  submitAnswer() {
    if (this.submitted) return;

    const question = QuizEngine.getCurrentQuestion();
    if (!question) return;

    if (question.type === 'fill') {
      const input = document.getElementById('fill-input');
      this.selectedAnswer = input ? input.value.trim() : '';
      if (!this.selectedAnswer) { App.showToast('请输入答案', 'warning'); return; }
    }

    // 多选题：把数组转为字符串
    let answerToSubmit = this.selectedAnswer;
    if (question.type === 'multiple') {
      if (this.selectedAnswer.length === 0) { App.showToast('请至少选择一个答案', 'warning'); return; }
      answerToSubmit = this.selectedAnswer.join('');
    }

    if (!this.selectedAnswer || (Array.isArray(this.selectedAnswer) && this.selectedAnswer.length === 0)) { 
      App.showToast('请选择答案', 'warning'); 
      return; 
    }

    this.submitted = true;
    const result = QuizEngine.submitAnswer(answerToSubmit);

    this._showFeedback(result);

    if (question.type !== 'fill') {
      const correctAnswers = result.correctAnswer.split('');
      const userAnswers = result.userAnswer ? result.userAnswer.split('') : [];
      document.querySelectorAll('.option-btn').forEach(btn => {
        btn.classList.add('disabled');
        const opt = btn.dataset.option;
        // 正确答案高亮
        if (correctAnswers.includes(opt)) {
          btn.classList.add('correct');
        }
        // 用户选错的标红
        if (userAnswers.includes(opt) && !correctAnswers.includes(opt)) {
          btn.classList.add('wrong');
        }
      });
    } else {
      const input = document.getElementById('fill-input');
      if (input) input.disabled = true;
    }

    document.getElementById('btn-submit').classList.add('hidden');
    if (result.isLast) {
      document.getElementById('btn-finish').classList.remove('hidden');
    } else {
      document.getElementById('btn-next').classList.remove('hidden');
    }

    if (!result.correct) {
      DB.addWrongQuestion(question.id);
    }
  },

  _matchJudgment(opt, answer) {
    const normalize = (s) => /^(正确|对|√|✓|T|TRUE)$/i.test(s) ? '正确' : '错误';
    return normalize(opt) === normalize(answer);
  },

  _showFeedback(result) {
    const feedbackEl = document.getElementById('quiz-feedback');
    const iconEl = document.getElementById('feedback-emoji');
    const textEl = document.getElementById('feedback-text');
    const explainEl = document.getElementById('feedback-explanation');

    feedbackEl.classList.remove('hidden');

    if (result.correct) {
      feedbackEl.className = 'rounded-xl p-4 mb-6 bg-green-50 border border-green-200 bounce-in';
      iconEl.textContent = '✅';
      textEl.textContent = QuizEngine.getEncouragement();
      textEl.className = 'font-semibold text-green-700';
      DB.markMastered(result.question.id);
    } else {
      feedbackEl.className = 'rounded-xl p-4 mb-6 bg-red-50 border border-red-200 bounce-in';
      iconEl.textContent = '❌';
      textEl.textContent = '答错了，没关系，记住正确答案！';
      textEl.className = 'font-semibold text-red-700';
    }

    let explainHTML = `<p class="font-medium text-gray-700">正确答案：${result.correctAnswer}</p>`;
    if (result.question.explanation) {
      explainHTML += `<p class="mt-1 text-gray-600">${result.question.explanation}</p>`;
    }
    explainEl.innerHTML = explainHTML;
  },

  nextQuestion() {
    if (QuizEngine.nextQuestion()) {
      this._renderQuestion();
    } else {
      this.finish();
    }
  },

  finish() {
    QuizEngine.stopTimer();
    const result = QuizEngine.finish();
    if (!result) return;
    DB.addRecord(result);
    ResultPage.show(result);
    App.navigate('result');
  },

  confirmExit() {
    document.getElementById('exit-modal').classList.remove('hidden');
  },

  closeExitModal() {
    document.getElementById('exit-modal').classList.add('hidden');
  },

  doExit() {
    QuizEngine.stopTimer();
    QuizEngine.session = null;
    document.getElementById('exit-modal').classList.add('hidden');
    App.navigate('home');
  }
};

// ========== 结果页面 ==========
const ResultPage = {
  currentResult: null,

  show(result) {
    this.currentResult = result;

    document.getElementById('result-correct').textContent = result.correctCount;
    document.getElementById('result-wrong').textContent = result.totalCount - result.correctCount;
    document.getElementById('result-accuracy').textContent = result.accuracy + '%';

    const minutes = Math.floor(result.duration / 60);
    const seconds = result.duration % 60;
    document.getElementById('result-time').textContent = `${minutes}:${String(seconds).padStart(2, '0')}`;

    const emojiEl = document.getElementById('result-emoji');
    const titleEl = document.getElementById('result-title');
    if (result.accuracy >= 90) {
      emojiEl.textContent = '🎉';
      titleEl.textContent = '太棒了！表现优秀！';
    } else if (result.accuracy >= 70) {
      emojiEl.textContent = '👍';
      titleEl.textContent = '不错，继续加油！';
    } else if (result.accuracy >= 50) {
      emojiEl.textContent = '💪';
      titleEl.textContent = '还需努力，别灰心！';
    } else {
      emojiEl.textContent = '📖';
      titleEl.textContent = '多复习一下，下次会更好！';
    }

    const wrongResults = result.results.filter(r => !r.correct);
    const wrongSection = document.getElementById('result-wrong-section');
    const wrongList = document.getElementById('result-wrong-list');
    const retryBtn = document.getElementById('btn-retry-wrong');

    if (wrongResults.length > 0) {
      wrongSection.classList.remove('hidden');
      retryBtn.classList.remove('hidden');
      wrongList.innerHTML = wrongResults.map(r => `
        <div class="bg-white rounded-xl p-4 border border-red-100">
          <p class="text-sm text-gray-700 mb-2">${r.question.question}</p>
          <div class="flex flex-wrap gap-2 text-xs">
            <span class="bg-red-50 text-red-500 px-2 py-1 rounded">你的答案: ${r.userAnswer || '未作答'}</span>
            <span class="bg-green-50 text-green-500 px-2 py-1 rounded">正确答案: ${r.question.answer}</span>
          </div>
          ${r.question.explanation ? `<p class="text-xs text-gray-500 mt-2">${r.question.explanation}</p>` : ''}
        </div>
      `).join('');
    } else {
      wrongSection.classList.add('hidden');
      retryBtn.classList.add('hidden');
    }
  },

  retryWrong() {
    if (!this.currentResult) return;
    const wrongIds = this.currentResult.results.filter(r => !r.correct).map(r => r.questionId);
    if (wrongIds.length === 0) {
      App.showToast('没有错题需要练习', 'info');
      return;
    }
    this._startWrongPractice(wrongIds);
  },

  async _startWrongPractice(questionIds) {
    const questions = await DB.getQuestionsByIds(questionIds);
    if (questions.length === 0) {
      App.showToast('错题已不存在', 'warning');
      return;
    }
    QuizEngine.createSession({ mode: 'wrong', questionCount: questions.length });
    QuizEngine.session.questions = questions;
    QuizPage.init('wrong');
    App.navigate('quiz');
  }
};

// ========== 错题本 ==========
const WrongBook = {
  async init() {
    const wrongRecords = await DB.getAllWrongQuestions();
    const emptyEl = document.getElementById('wrong-empty');
    const listEl = document.getElementById('wrong-list');
    const practiceBtn = document.getElementById('btn-practice-wrong');
    const exportPdfBtn = document.getElementById('btn-export-wrong-pdf');

    if (wrongRecords.length === 0) {
      emptyEl.classList.remove('hidden');
      listEl.innerHTML = '';
      practiceBtn.classList.add('hidden');
      exportPdfBtn.classList.add('hidden');
      return;
    }

    emptyEl.classList.add('hidden');
    practiceBtn.classList.remove('hidden');
    exportPdfBtn.classList.remove('hidden');

    const questionIds = wrongRecords.map(r => r.questionId);
    const questions = await DB.getQuestionsByIds(questionIds);

    const typeLabels = { single: '单选', multiple: '多选', judgment: '判断', fill: '填空' };

    listEl.innerHTML = questions.map(q => {
      const record = wrongRecords.find(r => r.questionId === q.id);
      return `
        <div class="bg-white rounded-xl p-4 border border-gray-100">
          <div class="flex items-start justify-between gap-3">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">${typeLabels[q.type] || '未知'}</span>
                <span class="text-xs text-red-400">错${record ? record.wrongCount : 0}次</span>
              </div>
              <p class="text-sm text-gray-700">${q.question}</p>
              <p class="text-xs text-green-500 mt-1">答案: ${q.answer}</p>
            </div>
            <button onclick="WrongBook.removeWrong('${q.id}')" class="flex-shrink-0 p-2 hover:bg-gray-100 rounded-lg transition text-gray-400 hover:text-red-500">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        </div>
      `;
    }).join('');
  },

  async practiceWrong() {
    const wrongRecords = await DB.getAllWrongQuestions();
    if (wrongRecords.length === 0) {
      App.showToast('没有错题需要练习', 'info');
      return;
    }
    const questionIds = wrongRecords.map(r => r.questionId);
    ResultPage._startWrongPractice(questionIds);
  },

  async removeWrong(questionId) {
    await DB.removeWrongQuestion(questionId);
    App.showToast('已从错题本移除', 'success');
    this.init();
  },

  async exportPDF() {
    try {
      await Export.exportWrongQuestionsPDF();
      App.showToast('PDF导出成功', 'success');
    } catch (err) {
      App.showToast('PDF导出失败：' + err.message, 'error');
    }
  }
};

// ========== 学习记录 ==========
const HistoryPage = {
  async init() {
    const records = await DB.getAllRecords();
    const emptyEl = document.getElementById('history-empty');
    const listEl = document.getElementById('history-list');

    if (records.length === 0) {
      emptyEl.classList.remove('hidden');
      listEl.innerHTML = '';
      return;
    }

    emptyEl.classList.add('hidden');

    const modeLabels = { practice: '抽查练习', exam: '模拟考试', wrong: '错题练习' };
    const modeColors = { practice: 'bg-green-100 text-green-600', exam: 'bg-orange-100 text-orange-600', wrong: 'bg-red-100 text-red-600' };

    listEl.innerHTML = records.map(r => {
      const date = new Date(r.completedAt);
      const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
      const minutes = Math.floor(r.duration / 60);
      const seconds = r.duration % 60;

      return `
        <div class="bg-white rounded-xl p-4 border border-gray-100">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs px-2 py-0.5 rounded-full ${modeColors[r.mode] || 'bg-gray-100 text-gray-600'}">${modeLabels[r.mode] || '练习'}</span>
            <span class="text-xs text-gray-400">${dateStr}</span>
          </div>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-4 text-sm">
              <span class="text-gray-600">答对 <strong class="text-green-500">${r.correctCount}</strong>/${r.totalCount}</span>
              <span class="text-gray-600">正确率 <strong class="text-primary-500">${r.accuracy}%</strong></span>
              <span class="text-gray-400">用时 ${minutes}:${String(seconds).padStart(2, '0')}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }
};

// ========== 数据管理 ==========
const DataManage = {
  async init() {
    // nothing to init
  },

  async exportAll() {
    const data = await DB.exportAll();
    this._downloadJSON(data, `quiz-backup-${this._dateStr()}.json`);
    App.showToast('数据导出成功', 'success');
  },

  async exportWrongJSON() {
    const data = await DB.exportWrongQuestions();
    this._downloadJSON(data, `wrong-questions-${this._dateStr()}.json`);
    App.showToast('错题导出成功', 'success');
  },

  async exportWrongPDF() {
    try {
      await Export.exportWrongQuestionsPDF();
      App.showToast('PDF导出成功', 'success');
    } catch (err) {
      App.showToast('PDF导出失败：' + err.message, 'error');
    }
  },

  async handleImportFile(file) {
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const imported = await DB.importData(data);
      App.showToast(`导入成功：${imported.banks}个题库，${imported.questions}道题目`, 'success');
      App.navigate('home');
    } catch (err) {
      App.showToast('导入失败：' + err.message, 'error');
    }
  },

  confirmClearAll() {
    App.showConfirm(
      '确认清除全部数据？',
      '将删除所有题库、题目、错题本和学习记录，此操作不可恢复！',
      async () => {
        await DB.clearAll();
        App.showToast('全部数据已清除', 'success');
        App.navigate('home');
      }
    );
  },

  _dateStr() {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  },

  _downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
};

// ========== 初始化 ==========
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await App.init();
    // 不再注册 Service Worker，由后端服务器负责
  } catch (err) {
    console.error('初始化失败:', err);
  }
});
