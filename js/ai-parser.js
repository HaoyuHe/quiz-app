/**
 * AI 智能题库解析模块
 * 使用大模型 API 解析任意格式的 PDF/Word 文件
 */
const AIParser = {
  // 默认使用 OpenAI 兼容的 API 格式
  apiConfig: {
    baseUrl: localStorage.getItem('ai_api_url') || 'https://api.openai.com/v1',
    apiKey: localStorage.getItem('ai_api_key') || '',
    model: localStorage.getItem('ai_model') || 'gpt-4o-mini'
  },

  /**
   * 保存 API 配置
   */
  saveConfig(config) {
    this.apiConfig = { ...this.apiConfig, ...config };
    localStorage.setItem('ai_api_url', this.apiConfig.baseUrl);
    localStorage.setItem('ai_api_key', this.apiConfig.apiKey);
    localStorage.setItem('ai_model', this.apiConfig.model);
  },

  /**
   * 检查是否已配置 API
   */
  isConfigured() {
    return !!this.apiConfig.apiKey;
  },

  /**
   * 提取 PDF/Word 文本内容
   */
  async extractText(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    
    if (ext === 'docx') {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return result.value;
    } else if (ext === 'pdf') {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'libs/pdf.worker.min.js';
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const pages = [];
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        pages.push(content.items.map(item => item.str).join(' '));
      }
      
      return pages.join('\n');
    }
    
    throw new Error('不支持的文件格式');
  },

  /**
   * 使用 AI 解析题目
   */
  async parseWithAI(text, onProgress = () => {}) {
    if (!this.isConfigured()) {
      throw new Error('请先配置 AI API 密钥');
    }

    onProgress(10);

    const prompt = `请分析以下考试题目文本，提取每道题的结构化信息。

文本内容：
${text.substring(0, 15000)} ${text.length > 15000 ? '\n...(内容已截断)' : ''}

请按以下 JSON 格式返回解析结果：
{
  "questions": [
    {
      "question": "题目内容",
      "type": "single|multiple|judgment|fill", 
      "options": ["选项A", "选项B", "选项C", "选项D"],
      "answer": "答案",
      "explanation": "解析说明（如有）"
    }
  ]
}

说明：
- type: single=单选题, multiple=多选题, judgment=判断题, fill=填空题
- 判断题的 options 应为 ["正确", "错误"]
- 填空题的 options 为空数组 []
- 多选题的答案用逗号分隔，如 "A,B" 或 "A,B,C"

只返回 JSON，不要其他说明文字。`;

    onProgress(30);

    const response = await fetch(`${this.apiConfig.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiConfig.apiKey}`
      },
      body: JSON.stringify({
        model: this.apiConfig.model,
        messages: [
          { role: 'system', content: '你是一个专业的考试题目解析助手，擅长从各种格式的文本中提取结构化题目信息。' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 4000
      })
    });

    onProgress(60);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`API 请求失败: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    onProgress(80);

    // 提取 JSON
    let jsonStr = content;
    const jsonMatch = content.match(/```json\s*([\s\S]*?)```/) || 
                      content.match(/```\s*([\s\S]*?)```/) ||
                      content.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      jsonStr = jsonMatch[1] || jsonMatch[0];
    }

    const parsed = JSON.parse(jsonStr);
    const questions = parsed.questions || [];

    // 标准化题目格式
    const normalized = questions.map((q, idx) => ({
      id: 'q_' + Date.now() + '_' + idx,
      question: q.question || '',
      type: q.type || 'single',
      options: Array.isArray(q.options) ? q.options : [],
      answer: this.normalizeAnswer(q.answer, q.type),
      explanation: q.explanation || '',
      category: '',
      difficulty: 3,
      source: 'AI解析',
      createdAt: new Date().toISOString()
    }));

    onProgress(100);
    return normalized;
  },

  /**
   * 标准化答案格式
   */
  normalizeAnswer(answer, type) {
    if (!answer) return '';
    
    answer = String(answer).trim();
    
    if (type === 'single') {
      // 提取字母
      return answer.toUpperCase().replace(/[^A-F]/g, '').charAt(0) || answer;
    } else if (type === 'multiple') {
      // 多选：提取所有字母并去重
      const letters = answer.toUpperCase().match(/[A-F]/g) || [];
      return [...new Set(letters)].join('');
    } else if (type === 'judgment') {
      // 判断题标准化
      if (/^(正确|对|√|✓|T|true|是)$/i.test(answer)) return '正确';
      if (/^(错误|错|×|✗|F|false|否)$/i.test(answer)) return '错误';
      return answer;
    }
    
    return answer;
  },

  /**
   * 解析文件（优先使用 AI，失败则回退到规则解析）
   */
  async parseFile(file, useAI = true, onProgress = () => {}) {
    const text = await this.extractText(file);
    
    if (useAI && this.isConfigured()) {
      try {
        return await this.parseWithAI(text, onProgress);
      } catch (err) {
        console.warn('AI 解析失败，回退到规则解析:', err);
        onProgress(0);
        return Parser.parseFile(file, onProgress);
      }
    }
    
    return Parser.parseFile(file, onProgress);
  }
};
