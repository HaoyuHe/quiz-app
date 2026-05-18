/**
 * IndexedDB 数据库封装 - 升级版
 * 支持题库管理、题目关联题库、数据导出/导入
 */
const DB = {
  DB_NAME: 'QuizAppDB',
  DB_VERSION: 2,
  db: null,

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;

        if (!db.objectStoreNames.contains('banks')) {
          const bankStore = db.createObjectStore('banks', { keyPath: 'id' });
          bankStore.createIndex('name', 'name', { unique: true });
        }

        if (!db.objectStoreNames.contains('questions')) {
          const qStore = db.createObjectStore('questions', { keyPath: 'id' });
          qStore.createIndex('bankId', 'bankId', { unique: false });
          qStore.createIndex('type', 'type', { unique: false });
          qStore.createIndex('category', 'category', { unique: false });
        }

        if (!db.objectStoreNames.contains('wrongQuestions')) {
          const wStore = db.createObjectStore('wrongQuestions', { keyPath: 'questionId' });
          wStore.createIndex('mastered', 'mastered', { unique: false });
        }

        if (!db.objectStoreNames.contains('records')) {
          const rStore = db.createObjectStore('records', { keyPath: 'id' });
          rStore.createIndex('completedAt', 'completedAt', { unique: false });
          rStore.createIndex('mode', 'mode', { unique: false });
        }
      };

      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(this.db);
      };

      request.onerror = (e) => reject(e.target.error);
    });
  },

  _transaction(storeName, mode) {
    const tx = this.db.transaction(storeName, mode);
    return tx.objectStore(storeName);
  },

  // ========== 题库管理 ==========

  async createBank(name) {
    return new Promise((resolve, reject) => {
      const store = this._transaction('banks', 'readwrite');
      const bank = {
        id: 'bank_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        name,
        createdAt: new Date().toISOString(),
        questionCount: 0
      };
      const request = store.add(bank);
      request.onsuccess = () => resolve(bank);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  async getAllBanks() {
    const store = this._transaction('banks');
    const banks = await new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e.target.error);
    });
    for (const bank of banks) {
      bank.questionCount = await this.getQuestionCountByBank(bank.id);
    }
    return banks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  async updateBank(id, updates) {
    return new Promise((resolve, reject) => {
      const store = this._transaction('banks', 'readwrite');
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const bank = { ...getReq.result, ...updates };
        const putReq = store.put(bank);
        putReq.onsuccess = () => resolve(bank);
        putReq.onerror = (e) => reject(e.target.error);
      };
      getReq.onerror = (e) => reject(e.target.error);
    });
  },

  async deleteBank(id) {
    const questions = await this.getQuestionsByBank(id);
    const store = this._transaction('questions', 'readwrite');
    for (const q of questions) {
      store.delete(q.id);
    }
    return new Promise((resolve, reject) => {
      const bankStore = this._transaction('banks', 'readwrite');
      const request = bankStore.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = (e) => reject(e.target.error);
    });
  },

  async getBank(id) {
    return new Promise((resolve, reject) => {
      const store = this._transaction('banks');
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  // ========== 题目 CRUD ==========

  async addQuestion(question) {
    return new Promise((resolve, reject) => {
      const store = this._transaction('questions', 'readwrite');
      const request = store.add(question);
      request.onsuccess = () => {
        this._updateBankQuestionCount(question.bankId);
        resolve(question.id);
      };
      request.onerror = (e) => reject(e.target.error);
    });
  },

  async addQuestions(questions, bankId) {
    return new Promise((resolve, reject) => {
      const store = this._transaction('questions', 'readwrite');
      let count = 0;
      questions.forEach(q => {
        q.bankId = bankId;
        const request = store.add(q);
        request.onsuccess = () => count++;
        request.onerror = () => {};
      });
      const tx = store.transaction;
      tx.oncomplete = () => {
        this._updateBankQuestionCount(bankId);
        resolve(count);
      };
      tx.onerror = (e) => reject(e.target.error);
    });
  },

  async _updateBankQuestionCount(bankId) {
    if (!bankId) return;
    const count = await this.getQuestionCountByBank(bankId);
    await this.updateBank(bankId, { questionCount: count });
  },

  async getAllQuestions() {
    return new Promise((resolve, reject) => {
      const store = this._transaction('questions');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  async getQuestionsByBank(bankId) {
    return new Promise((resolve, reject) => {
      const store = this._transaction('questions');
      const index = store.index('bankId');
      const request = index.getAll(bankId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  async getQuestionsByFilter(bankId, types) {
    const questions = bankId ? await this.getQuestionsByBank(bankId) : await this.getAllQuestions();
    if (!types || types.length === 0) return questions;
    return questions.filter(q => types.includes(q.type));
  },

  /**
   * 多题库组合筛选
   * @param {Array} bankConfigs - 题库配置数组 [{bankId, types}]
   * @returns {Promise<Array>} 合并后的题目数组
   */
  async getQuestionsByMultiBanks(bankConfigs) {
    if (!bankConfigs || bankConfigs.length === 0) {
      return this.getAllQuestions();
    }

    const allQuestions = [];
    
    for (const config of bankConfigs) {
      const { bankId, types, count } = config;
      let questions = bankId 
        ? await this.getQuestionsByBank(bankId) 
        : await this.getAllQuestions();
      
      // 按类型筛选
      if (types && types.length > 0) {
        questions = questions.filter(q => types.includes(q.type));
      }
      
      // 如果指定了数量，随机抽取
      if (count && count > 0 && count < questions.length) {
        questions = this._shuffleArray(questions).slice(0, count);
      }
      
      allQuestions.push(...questions);
    }
    
    return allQuestions;
  },

  /**
   * 获取多个题库的所有题目类型（去重）
   * @param {Array} bankIds - 题库ID数组
   * @returns {Promise<Array>} 题目类型数组 [{type, label, count}]
   */
  async getTypesFromBanks(bankIds) {
    const allQuestions = [];
    
    for (const bankId of bankIds) {
      const questions = bankId 
        ? await this.getQuestionsByBank(bankId) 
        : await this.getAllQuestions();
      allQuestions.push(...questions);
    }
    
    // 统计各类型数量
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

  /**
   * 数组随机打乱
   */
  _shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },

  async getQuestion(id) {
    return new Promise((resolve, reject) => {
      const store = this._transaction('questions');
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  async getQuestionsByIds(ids) {
    const results = [];
    for (const id of ids) {
      const q = await this.getQuestion(id);
      if (q) results.push(q);
    }
    return results;
  },

  async deleteQuestion(id) {
    return new Promise((resolve, reject) => {
      const store = this._transaction('questions', 'readwrite');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = (e) => reject(e.target.error);
    });
  },

  async clearQuestions() {
    return new Promise((resolve, reject) => {
      const store = this._transaction('questions', 'readwrite');
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = (e) => reject(e.target.error);
    });
  },

  async getQuestionCount() {
    return new Promise((resolve, reject) => {
      const store = this._transaction('questions');
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  async getQuestionCountByBank(bankId) {
    return new Promise((resolve, reject) => {
      const store = this._transaction('questions');
      const index = store.index('bankId');
      const request = index.count(bankId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  async getQuestionCountByType(bankId, type) {
    const questions = bankId ? await this.getQuestionsByBank(bankId) : await this.getAllQuestions();
    return questions.filter(q => q.type === type).length;
  },

  // ========== 错题管理 ==========

  async addWrongQuestion(questionId) {
    return new Promise((resolve, reject) => {
      const store = this._transaction('wrongQuestions', 'readwrite');
      const existing = store.get(questionId);
      existing.onsuccess = () => {
        if (existing.result) {
          const updated = {
            ...existing.result,
            wrongCount: existing.result.wrongCount + 1,
            lastWrongAt: new Date().toISOString(),
            mastered: false
          };
          const updateReq = store.put(updated);
          updateReq.onsuccess = () => resolve(updated);
          updateReq.onerror = (e) => reject(e.target.error);
        } else {
          const record = {
            questionId,
            wrongCount: 1,
            lastWrongAt: new Date().toISOString(),
            mastered: false
          };
          const addReq = store.add(record);
          addReq.onsuccess = () => resolve(record);
          addReq.onerror = (e) => reject(e.target.error);
        }
      };
      existing.onerror = (e) => reject(e.target.error);
    });
  },

  async markMastered(questionId) {
    return new Promise((resolve, reject) => {
      const store = this._transaction('wrongQuestions', 'readwrite');
      const existing = store.get(questionId);
      existing.onsuccess = () => {
        if (existing.result) {
          const updated = { ...existing.result, mastered: true };
          const updateReq = store.put(updated);
          updateReq.onsuccess = () => resolve(updated);
          updateReq.onerror = (e) => reject(e.target.error);
        } else {
          resolve(null);
        }
      };
      existing.onerror = (e) => reject(e.target.error);
    });
  },

  async getAllWrongQuestions() {
    return new Promise((resolve, reject) => {
      const store = this._transaction('wrongQuestions');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result.filter(r => !r.mastered));
      request.onerror = (e) => reject(e.target.error);
    });
  },

  async getWrongQuestionCount() {
    return new Promise((resolve, reject) => {
      const store = this._transaction('wrongQuestions');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result.filter(r => !r.mastered).length);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  async removeWrongQuestion(questionId) {
    return new Promise((resolve, reject) => {
      const store = this._transaction('wrongQuestions', 'readwrite');
      const request = store.delete(questionId);
      request.onsuccess = () => resolve();
      request.onerror = (e) => reject(e.target.error);
    });
  },

  async clearWrongQuestions() {
    return new Promise((resolve, reject) => {
      const store = this._transaction('wrongQuestions', 'readwrite');
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = (e) => reject(e.target.error);
    });
  },

  // ========== 练习记录 ==========

  async addRecord(record) {
    return new Promise((resolve, reject) => {
      const store = this._transaction('records', 'readwrite');
      const request = store.add(record);
      request.onsuccess = () => resolve(record.id);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  async getAllRecords() {
    return new Promise((resolve, reject) => {
      const store = this._transaction('records');
      const request = store.getAll();
      request.onsuccess = () => {
        resolve(request.result.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt)));
      };
      request.onerror = (e) => reject(e.target.error);
    });
  },

  async clearRecords() {
    return new Promise((resolve, reject) => {
      const store = this._transaction('records', 'readwrite');
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = (e) => reject(e.target.error);
    });
  },

  // ========== 统计 ==========

  async getStats() {
    const banks = await this.getAllBanks();
    const totalQuestions = await this.getQuestionCount();
    const wrongCount = await this.getWrongQuestionCount();
    const records = await this.getAllRecords();

    let totalPracticed = 0;
    let totalCorrect = 0;
    records.forEach(r => {
      totalPracticed += r.totalCount;
      totalCorrect += r.correctCount;
    });

    const typeStats = {};
    const typeLabels = { single: '单选', multiple: '多选', judgment: '判断', fill: '填空' };
    for (const type of Object.keys(typeLabels)) {
      typeStats[type] = {
        label: typeLabels[type],
        count: await this.getQuestionCountByType(null, type)
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
    const banks = await this.getAllBanks();
    const questions = await this.getAllQuestions();
    const wrongQuestions = await this.getAllWrongQuestions();
    const records = await this.getAllRecords();

    return {
      version: 2,
      exportedAt: new Date().toISOString(),
      banks,
      questions,
      wrongQuestions,
      records
    };
  },

  async exportQuestions(bankId) {
    const bank = bankId ? await this.getBank(bankId) : null;
    const questions = bankId ? await this.getQuestionsByBank(bankId) : await this.getAllQuestions();

    return {
      version: 2,
      exportedAt: new Date().toISOString(),
      bank,
      questions
    };
  },

  async exportWrongQuestions() {
    const wrongRecords = await this.getAllWrongQuestions();
    const questionIds = wrongRecords.map(r => r.questionId);
    const questions = await this.getQuestionsByIds(questionIds);

    return {
      version: 2,
      exportedAt: new Date().toISOString(),
      type: 'wrong_questions',
      wrongRecords,
      questions
    };
  },

  async importData(data) {
    if (!data || !data.version) {
      throw new Error('无效的数据格式');
    }

    const tx = this.db.transaction(['banks', 'questions', 'wrongQuestions', 'records'], 'readwrite');
    let imported = { banks: 0, questions: 0, wrongQuestions: 0, records: 0 };

    if (data.banks) {
      for (const bank of data.banks) {
        try {
          tx.objectStore('banks').put(bank);
          imported.banks++;
        } catch (e) {}
      }
    }

    if (data.questions) {
      for (const q of data.questions) {
        try {
          tx.objectStore('questions').put(q);
          imported.questions++;
        } catch (e) {}
      }
    }

    if (data.wrongQuestions) {
      for (const w of data.wrongQuestions) {
        try {
          tx.objectStore('wrongQuestions').put(w);
          imported.wrongQuestions++;
        } catch (e) {}
      }
    }

    if (data.records) {
      for (const r of data.records) {
        try {
          tx.objectStore('records').put(r);
          imported.records++;
        } catch (e) {}
      }
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(imported);
      tx.onerror = (e) => reject(e.target.error);
    });
  },

  async clearAll() {
    await Promise.all([
      this.clearQuestions(),
      this.clearWrongQuestions(),
      this.clearRecords()
    ]);
    const store = this._transaction('banks', 'readwrite');
    store.clear();
  }
};
