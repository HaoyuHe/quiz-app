/**
 * 答题核心逻辑
 * 管理练习/考试流程、抽题、计时、批改
 */
const QuizEngine = {
  // 当前答题会话
  session: null,

  // 鼓励文案
  encouragements: [
    '答对了！继续保持！',
    '太棒了！你真厉害！',
    '完全正确！再接再厉！',
    '厉害了！这道题难不倒你！',
    '正确！你的知识很扎实！',
    '漂亮！就是这个答案！',
    '满分表现！继续保持！',
    '学霸就是你！',
    '答对了！你离满分又近了一步！',
    '太强了！正确无误！'
  ],

  /**
   * 创建练习/考试会话
   * @param {Object} options - { mode, questionCount, timeLimit, questionIds? }
   */
  createSession(options) {
    this.session = {
      id: 'session_' + Date.now(),
      mode: options.mode, // 'practice' | 'exam' | 'wrong'
      questions: [],       // 当前会话的题目
      currentIndex: 0,
      userAnswers: {},     // { questionId: answer }
      results: [],         // { questionId, userAnswer, correct, question }
      correctCount: 0,
      startTime: Date.now(),
      timeLimit: options.timeLimit || 0, // 秒，0表示不限时
      timeRemaining: options.timeLimit || 0,
      timerInterval: null,
      finished: false
    };
    return this.session;
  },

  /**
   * 随机抽题
   * @param {Array} allQuestions - 所有题目
   * @param {number} count - 抽题数量
   * @param {Array} specificIds - 指定题目ID（错题练习时使用）
   */
  drawQuestions(allQuestions, count, specificIds = null) {
    let pool = specificIds
      ? allQuestions.filter(q => specificIds.includes(q.id))
      : [...allQuestions];

    // Fisher-Yates 洗牌算法
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    return pool.slice(0, Math.min(count, pool.length));
  },

  /**
   * 获取当前题目
   */
  getCurrentQuestion() {
    if (!this.session || this.session.currentIndex >= this.session.questions.length) {
      return null;
    }
    return this.session.questions[this.session.currentIndex];
  },

  /**
   * 提交答案
   * @param {string} userAnswer - 用户答案
   * @returns {Object} { correct, question, userAnswer, correctAnswer, explanation }
   */
  submitAnswer(userAnswer) {
    if (!this.session) return null;

    const question = this.getCurrentQuestion();
    if (!question) return null;

    const correct = this._checkAnswer(question, userAnswer);

    this.session.userAnswers[question.id] = userAnswer;
    this.session.results.push({
      questionId: question.id,
      userAnswer,
      correct,
      question
    });

    if (correct) {
      this.session.correctCount++;
    }

    return {
      correct,
      question,
      userAnswer,
      correctAnswer: question.answer,
      explanation: question.explanation,
      isLast: this.session.currentIndex >= this.session.questions.length - 1
    };
  },

  /**
   * 检查答案是否正确
   */
  _checkAnswer(question, userAnswer) {
    if (!userAnswer && userAnswer !== 0) return false;

    const correctAnswer = String(question.answer).trim().toUpperCase();
    const ua = String(userAnswer).trim().toUpperCase();

    if (question.type === 'multiple') {
      // 多选题：排序后比较
      const normalize = (s) => s.replace(/[^A-F]/g, '').split('').sort().join('');
      return normalize(ua) === normalize(correctAnswer);
    }

    if (question.type === 'judgment') {
      // 判断题
      const normalizeJudge = (s) => {
        if (/^(正确|对|√|✓|T|TRUE)$/i.test(s)) return '正确';
        return '错误';
      };
      return normalizeJudge(ua) === normalizeJudge(correctAnswer);
    }

    // 单选题 / 填空题
    return ua === correctAnswer;
  },

  /**
   * 下一题
   * @returns {boolean} 是否还有下一题
   */
  nextQuestion() {
    if (!this.session) return false;
    this.session.currentIndex++;
    return this.session.currentIndex < this.session.questions.length;
  },

  /**
   * 开始计时
   * @param {Function} onTick - 每秒回调 (remainingSeconds)
   * @param {Function} onTimeUp - 时间到回调
   */
  startTimer(onTick, onTimeUp) {
    if (!this.session || this.session.timeLimit <= 0) return;

    this.session.timerInterval = setInterval(() => {
      this.session.timeRemaining--;
      onTick(this.session.timeRemaining);

      if (this.session.timeRemaining <= 0) {
        this.stopTimer();
        onTimeUp();
      }
    }, 1000);
  },

  /**
   * 停止计时
   */
  stopTimer() {
    if (this.session && this.session.timerInterval) {
      clearInterval(this.session.timerInterval);
      this.session.timerInterval = null;
    }
  },

  /**
   * 获取鼓励文案
   */
  getEncouragement() {
    return this.encouragements[Math.floor(Math.random() * this.encouragements.length)];
  },

  /**
   * 完成答题，返回结果摘要
   */
  finish() {
    this.stopTimer();
    if (!this.session) return null;

    this.session.finished = true;
    const duration = Math.round((Date.now() - this.session.startTime) / 1000);
    const totalCount = this.session.questions.length;
    const correctCount = this.session.correctCount;

    return {
      id: this.session.id,
      mode: this.session.mode,
      questions: this.session.questions,
      results: this.session.results,
      correctCount,
      totalCount,
      accuracy: totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0,
      duration,
      completedAt: new Date().toISOString()
    };
  },

  /**
   * 获取进度信息
   */
  getProgress() {
    if (!this.session) return { current: 0, total: 0, percent: 0 };
    const current = this.session.currentIndex + 1;
    const total = this.session.questions.length;
    return { current, total, percent: Math.round((current / total) * 100) };
  },

  /**
   * 获取用时（秒）
   */
  getElapsed() {
    if (!this.session) return 0;
    return Math.round((Date.now() - this.session.startTime) / 1000);
  }
};
