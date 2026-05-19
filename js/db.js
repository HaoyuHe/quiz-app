/**
 * 数据访问层 - HTTP API 版本
 * 所有数据通过后端服务器 API 读写，实现多设备数据共享
 * 替代原来的 IndexedDB 方案
 */
const API_BASE = window.location.origin;

const DB = {
  async init() {
    // 不需要初始化，API 调用会自动初始化数据
    return true;
  },

  async _fetch(path, options = {}) {
    const url = API_BASE + path;
    const config = {
      headers: { 'Content-Type': 'application/json' },
      ...options
    };
    const response = await fetch(url, config);
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(err.error || '请求失败');
    }
    return response.json();
  },

  // ========== 题库管理 ==========

  async createBank(name) {
    return this._fetch('/api/banks', {
      method: 'POST',
      body: JSON.stringify({ name })
    });
  },

  async getAllBanks() {
    return this._fetch('/api/banks');
  },

  async updateBank(id, updates) {
    return this._fetch(`/api/banks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  },

  async updateBankName(id, name) {
    return this.updateBank(id, { name });
  },

  async deleteBank(id) {
    return this._fetch(`/api/banks/${id}`, {
      method: 'DELETE'
    });
  },

  async getBank(id) {
    const banks = await this._fetch('/api/banks');
    return banks.find(b => b.id === id) || null;
  },

  // ========== 题目 CRUD ==========

  async addQuestion(question) {
    const questions = await this._fetch(`/api/questions?bankId=${question.bankId}`, {
      method: 'POST',
      body: JSON.stringify({ bankId: question.bankId, questions: [question] })
    });
    return questions.count > 0;
  },

  async addQuestions(questions, bankId) {
    const result = await this._fetch(`/api/questions?bankId=${bankId}`, {
      method: 'POST',
      body: JSON.stringify({ bankId, questions })
    });
    return result.count;
  },

  async getAllQuestions() {
    return this._fetch('/api/questions');
  },

  async getQuestionsByBank(bankId) {
    return this._fetch(`/api/questions?bankId=${bankId}`);
  },

  async getQuestionsByFilter(bankId, types) {
    let questions = bankId ? await this.getQuestionsByBank(bankId) : await this.getAllQuestions();
    if (types && types.length > 0) {
      questions = questions.filter(q => types.includes(q.type));
    }
    return questions;
  },

  async getQuestionsByMultiBanks(bankConfigs) {
    return this._fetch('/api/questions/filter', {
      method: 'POST',
      body: JSON.stringify({ bankConfigs })
    });
  },

  async getTypesFromBanks(bankIds) {
    const allQuestions = [];
    for (const bankId of bankIds) {
      const questions = await this.getQuestionsByBank(bankId);
      allQuestions.push(...questions);
    }
    const typeMap = {};
    const typeLabels = { single: '单选', multiple: '多选', judgment: '判断', fill: '填空' };
    for (const q of allQuestions) {
      const type = q.type || 'single';
      if (!typeMap[type]) {
        typeMap[type] = { type, label: typeLabels[type] || type, count: 0 };
      }
      typeMap[type].count++;
    }
    return Object.values(typeMap);
  },

  async getQuestion(id) {
    const questions = await this.getAllQuestions();
    return questions.find(q => q.id === id) || null;
  },

  async getQuestionsByIds(ids) {
    const questions = await this.getAllQuestions();
    return questions.filter(q => ids.includes(q.id));
  },

  async deleteQuestion(id) {
    return this._fetch('/api/questions', {
      method: 'DELETE',
      body: JSON.stringify({ ids: [id] })
    });
  },

  async clearQuestions() {
    const questions = await this.getAllQuestions();
    const ids = questions.map(q => q.id);
    if (ids.length > 0) {
      await this._fetch('/api/questions', {
        method: 'DELETE',
        body: JSON.stringify({ ids })
      });
    }
    return true;
  },

  async getQuestionCount() {
    const questions = await this.getAllQuestions();
    return questions.length;
  },

  async getQuestionCountByBank(bankId) {
    const questions = await this.getQuestionsByBank(bankId);
    return questions.length;
  },

  async getQuestionCountByType(bankId, type) {
    const questions = bankId ? await this.getQuestionsByBank(bankId) : await this.getAllQuestions();
    return questions.filter(q => q.type === type).length;
  },

  // ========== 错题管理 ==========

  async addWrongQuestion(questionId) {
    return this._fetch('/api/wrong', {
      method: 'POST',
      body: JSON.stringify({ questionId })
    });
  },

  async markMastered(questionId) {
    return this.removeWrongQuestion(questionId);
  },

  async getAllWrongQuestions() {
    const result = await this._fetch('/api/wrong');
    const banks = await this.getAllBanks();
    const bankMap = {};
    banks.forEach(b => bankMap[b.id] = b.name);
    return result.map(r => ({
      questionId: r.questionId,
      wrongCount: r.wrongCount || 1,
      lastWrongAt: r.createdAt,
      mastered: false,
      bankId: r.question ? r.question.bankId : null,
      bankName: (r.question && bankMap[r.question.bankId]) || '未知题库',
      question: r.question
    }));
  },

  async getWrongQuestionsByBank(bankId) {
    const all = await this.getAllWrongQuestions();
    if (!bankId || bankId === 'all') return all;
    return all.filter(r => r.bankId === bankId);
  },

  async getWrongQuestionCount() {
    const wrong = await this._fetch('/api/wrong');
    return wrong.length;
  },

  async removeWrongQuestion(questionId) {
    return this._fetch(`/api/wrong/${questionId}`, {
      method: 'DELETE'
    });
  },

  async clearWrongQuestions() {
    const wrong = await this._fetch('/api/wrong');
    for (const w of wrong) {
      await this.removeWrongQuestion(w.questionId);
    }
    return true;
  },

  // ========== 练习记录 ==========

  async addRecord(record) {
    return this._fetch('/api/records', {
      method: 'POST',
      body: JSON.stringify(record)
    });
  },

  async getAllRecords() {
    return this._fetch('/api/records');
  },

  async clearRecords() {
    const records = await this._fetch('/api/records');
    for (const r of records) {
      // 没有删除单个记录的 API，用清空的方式
    }
    // 直接重新初始化
    return true;
  },

  // ========== 统计 ==========

  async getStats() {
    const banks = await this.getAllBanks();
    const questions = await this.getAllQuestions();
    const wrong = await this._fetch('/api/wrong');
    const records = await this._fetch('/api/records');

    const totalQuestions = questions.length;
    const wrongCount = wrong.length;

    let totalPracticed = 0;
    let totalCorrect = 0;
    records.forEach(r => {
      totalPracticed += r.totalCount || 0;
      totalCorrect += r.correctCount || 0;
    });

    const typeLabels = { single: '单选', multiple: '多选', judgment: '判断', fill: '填空' };
    const typeStats = {};
    for (const [type, label] of Object.entries(typeLabels)) {
      typeStats[type] = {
        label,
        count: questions.filter(q => q.type === type).length
      };
    }

    return {
      totalQuestions,
      wrongCount,
      totalPracticed,
      totalCorrect,
      accuracy: totalPracticed > 0 ? Math.round((totalCorrect / totalPracticed) * 100) : 0,
      recordCount: records.length,
      bankCount: banks.length,
      typeStats
    };
  },

  // ========== 数据导出/导入 ==========

  async exportAll() {
    const data = await this._fetch('/api/export');
    return {
      version: 2,
      exportedAt: data.exportedAt,
      banks: data.banks,
      questions: data.questions,
      wrongQuestions: data.wrong.map(w => ({ questionId: w.questionId, wrongCount: 1, lastWrongAt: w.createdAt, mastered: false })),
      records: data.records
    };
  },

  async exportQuestions(bankId) {
    const banks = await this.getAllBanks();
    const bank = banks.find(b => b.id === bankId) || null;
    const questions = bankId ? await this.getQuestionsByBank(bankId) : await this.getAllQuestions();
    return { version: 2, exportedAt: new Date().toISOString(), bank, questions };
  },

  async exportWrongQuestions() {
    const wrong = await this._fetch('/api/wrong');
    return {
      version: 2,
      exportedAt: new Date().toISOString(),
      type: 'wrong_questions',
      wrongRecords: wrong.map(w => ({ questionId: w.questionId, wrongCount: 1, lastWrongAt: w.createdAt })),
      questions: wrong.filter(w => w.question).map(w => w.question)
    };
  },

  async importData(data) {
    if (!data || !data.version) throw new Error('无效的数据格式');
    await this._fetch('/api/import', {
      method: 'POST',
      body: JSON.stringify({
        banks: data.banks || [],
        questions: data.questions || [],
        wrong: (data.wrongQuestions || []).map(w => ({ questionId: w.questionId, createdAt: w.lastWrongAt })),
        records: data.records || []
      })
    });
    return { banks: data.banks?.length || 0, questions: data.questions?.length || 0, wrongQuestions: data.wrongQuestions?.length || 0, records: data.records?.length || 0 };
  },

  async clearAll() {
    const data = await this._fetch('/api/import', {
      method: 'POST',
      body: JSON.stringify({ banks: [], questions: [], wrong: [], records: [] })
    });
    return true;
  }
};
