/**
 * 文件解析模块
 * 支持 Word(.docx) 和 PDF 文件解析，提取结构化题目
 */
const Parser = {

  /**
   * 解析文件，返回结构化题目数组
   * @param {File} file - 上传的文件对象
   * @param {Function} onProgress - 进度回调 (percent: 0-100)
   * @returns {Promise<Array>} 题目数组
   */
  async parseFile(file, onProgress = () => {}) {
    const ext = file.name.split('.').pop().toLowerCase();
    onProgress(10);

    let text = '';
    if (ext === 'docx') {
      text = await this._parseDocx(file);
    } else if (ext === 'pdf') {
      text = await this._parsePdf(file);
    } else {
      throw new Error('不支持的文件格式，请上传 .docx 或 .pdf 文件');
    }

    onProgress(60);
    const questions = this._extractQuestions(text, file.name);
    onProgress(100);
    return questions;
  },

  /**
   * 解析 Word (.docx) 文件
   */
  async _parseDocx(file) {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  },

  /**
   * 解析 PDF 文件
   */
  async _parsePdf(file) {
    // 设置 pdf.js worker（使用本地文件）
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'libs/pdf.worker.min.js';

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const strings = content.items.map(item => item.str);
      pages.push(strings.join(' '));
    }

    return pages.join('\n');
  },

  /**
   * 从文本中提取结构化题目
   * 支持多种常见格式
   */
  _extractQuestions(text, source) {
    const questions = [];
    
    // 预处理：为缺少题号但紧跟选项的行补上题号
    const lines = text.split('\n');
    let lastQuestionNum = 0;
    const processedLines = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const numMatch = line.match(/^(\d+)[、.．)）]\s*/);
      
      if (numMatch) {
        lastQuestionNum = parseInt(numMatch[1]);
        processedLines.push(lines[i]);
      } else if (
        line.length > 10 &&
        !numMatch &&
        !line.match(/^[A-F][\.．\s]/) &&
        !line.match(/^(?:答案|正确答案)/) &&
        !line.match(/^◦/) &&
        !line.match(/^(?:单选|多选|判断|填空)/)
      ) {
        // 检查上一行是否是题目内容的延续（非选项、非答案、非空行）
        const prevLine = (i > 0) ? lines[i - 1].trim() : '';
        const isContinuation = prevLine.length > 5 &&
          !prevLine.match(/^[A-F][\.．\s]/) &&
          !prevLine.match(/^(?:答案|正确答案)/) &&
          !prevLine.match(/^◦/);
        
        if (isContinuation) {
          // 这是上一题的内容延续，不补题号
          processedLines.push(lines[i]);
          continue;
        }
        
        // 检查下一行是否是选项
        const nextLine = (i + 1 < lines.length) ? lines[i + 1].trim() : '';
        if (nextLine.match(/^[A-F][\.．\s]/)) {
          lastQuestionNum++;
          processedLines.push(`${lastQuestionNum}、${line}`);
          continue;
        }
        processedLines.push(lines[i]);
      } else {
        processedLines.push(lines[i]);
      }
    }
    
    const processedText = processedLines.join('\n');

    // 按题号拆分
    const questionBlocks = processedText.split(/(?=\n\s*\d+[、.．)）]\s*)/);
    
    for (const block of questionBlocks) {
      const q = this._parseQuestionBlock(block.trim(), source);
      if (q) {
        questions.push(q);
      }
    }

    return questions;
  },

  /**
   * 解析单个题目块
   * 支持多种格式：
   * 1. 括号答案格式：1、题目内容（B）\nA.选项\nB.选项
   * 2. 标准格式：1、题目内容\nA.选项\n答案：B
   * 3. 判断题：1、题目内容（√）
   * 4. 填空题：1、题目内容（24）
   */
  _parseQuestionBlock(block, source) {
    if (!block || block.length < 5) return null;

    const lines = block.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length < 1) return null;

    let questionText = '';
    let options = [];
    let answer = '';
    let explanation = '';
    let type = 'single'; // 默认单选

    const firstLine = lines[0];

    // 检查第一行是否是题号开头（支持 1、1. 1）
    const questionNumberMatch = firstLine.match(/^(\d+)[、.．)）]\s*/);
    if (!questionNumberMatch) return null;

    // 提取题目内容（第一行）
    let firstLineContent = firstLine.replace(/^\d+[、.．)）]\s*/, '').trim();

    // 检查题目行末尾是否有括号答案，如 （B）(ABC) (√) (×) (24)
    const bracketAnswerMatch = firstLineContent.match(/[（(]\s*([A-D]{1,4}|[√×]|\d+)[）)]\s*$/);

    if (bracketAnswerMatch) {
      answer = bracketAnswerMatch[1].trim();
      // 移除题目中的答案括号（用非捕获组包裹答案部分）
      questionText = firstLineContent.replace(/[（(]\s*(?:[A-D]{1,4}|[√×]|\d+)[）)]\s*$/, '').trim();

      // 移除末尾的句号（如果有）
      questionText = questionText.replace(/[。\.]$/, '');
    } else {
      questionText = firstLineContent;
    }

    if (!questionText) return null;

    let i = 1; // 从第二行开始处理

    // 收集多行题目内容（选项行之前的所有非选项行）
    while (i < lines.length) {
      const line = lines[i];
      // 检测是否是选项行
      const isOptionLine = line.match(/^([A-F])[\.．\s]\s*.+/);
      if (!isOptionLine) {
        // 不是选项行 → 追加到题目内容
        questionText += ' ' + line;
        i++;
      } else {
        break;
      }
    }

    // 提取选项（A. B. C. D. 格式或 A B C D 空格格式）
    while (i < lines.length) {
      const line = lines[i];
      // 检测选项行: A. / B. / C. / D.（支持中英文点号或空格）
      const optionMatch = line.match(/^([A-F])[\.．\s]\s*(.+)$/);
      if (optionMatch) {
        options.push(optionMatch[2].trim());
        i++;
      } else {
        break;
      }
    }

    // 如果没有在题目行找到答案，尝试从后续行提取
    if (!answer && i < lines.length) {
      for (let j = i; j < lines.length; j++) {
        const line = lines[j];
        const answerMatch = line.match(/^(?:答案|正确答案)[\s:：]\s*(.+)/);
        if (answerMatch) {
          answer = answerMatch[1].trim();
          break;
        }
      }
    }

    // 判断题检测：选项为正确/错误 或 答案含正确/错误
    const isJudgmentOptions = options.length === 2 && options.every(o => /正确|错误/.test(o));
    if (isJudgmentOptions) {
      type = 'judgment';
      // 处理答案格式：B错误 → 错误, A正确 → 正确
      if (answer) {
        const judgmentMap = { '正确': '正确', '错误': '错误', '√': '正确', '×': '错误', 'A': '正确', 'B': '错误' };
        const answerLetter = answer.replace(/[^AB]/g, '');
        const answerText = answer.replace(/[^正确错误]/g, '');
        if (answerText === '正确' || answerText === '错误') {
          answer = answerText;
        } else if (judgmentMap[answerLetter]) {
          answer = judgmentMap[answerLetter];
        }
      }
      options = ['正确', '错误'];
    }

    // 如果没有选项但有答案，可能是填空题或判断题
    if (options.length === 0) {
      if (/^[√×]$/.test(answer)) {
        // 判断题
        type = 'judgment';
        options = ['正确', '错误'];
        answer = answer === '√' ? '正确' : '错误';
      } else if (/^\d+$/.test(answer)) {
        // 填空题（数字答案）
        type = 'fill';
        // 填空题不需要选项
      } else if (answer) {
        // 其他填空题
        type = 'fill';
      } else {
        // 没有答案也没有选项，可能是非题目内容
        return null;
      }
    } else {
      // 有选项，判断是单选还是多选
      const cleanAnswer = answer ? answer.toUpperCase().replace(/[^A-Z]/g, '') : '';
      if (/^[A-D]{2,4}$/.test(cleanAnswer)) {
        type = 'multiple';
      }
    }

    // 标准化答案格式
    if (type === 'single' && answer) {
      answer = answer.toUpperCase().replace(/[^A-D]/g, '');
    } else if (type === 'multiple' && answer) {
      // 多选答案保持字母，去除分隔符
      answer = answer.toUpperCase().replace(/[^A-F]/g, '');
    }

    // 生成唯一ID
    const id = 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    return {
      id,
      question: questionText,
      type,
      options: options.length > 0 ? options : [],
      answer,
      explanation,
      category: '', // 知识点分类（可后续手动设置）
      difficulty: 3, // 默认中等难度
      source: source || '手动录入',
      createdAt: new Date().toISOString()
    };
  },

  /**
   * 生成示例题目（用于测试）
   */
  generateSampleQuestions() {
    const samples = [
      {
        id: 'sample_1',
        question: 'HTML中，哪个标签用于定义最大的标题？',
        type: 'single',
        options: ['<heading>', '<h6>', '<h1>', '<head>'],
        answer: 'C',
        explanation: '<h1>标签定义HTML中最大的标题，<h6>定义最小的标题。',
        category: 'HTML基础',
        difficulty: 1,
        source: '示例题库',
        createdAt: new Date().toISOString()
      },
      {
        id: 'sample_2',
        question: 'CSS中，以下哪个属性用于改变文本颜色？',
        type: 'single',
        options: ['text-color', 'font-color', 'color', 'text-style'],
        answer: 'C',
        explanation: 'CSS的color属性用于设置文本的前景色（文本颜色）。',
        category: 'CSS基础',
        difficulty: 1,
        source: '示例题库',
        createdAt: new Date().toISOString()
      },
      {
        id: 'sample_3',
        question: 'JavaScript中，typeof null 的返回值是什么？',
        type: 'single',
        options: ['"null"', '"undefined"', '"object"', '"boolean"'],
        answer: 'C',
        explanation: '这是JavaScript的一个历史遗留bug，typeof null 返回 "object"。',
        category: 'JavaScript基础',
        difficulty: 2,
        source: '示例题库',
        createdAt: new Date().toISOString()
      },
      {
        id: 'sample_4',
        question: '以下哪些是JavaScript的基本数据类型？（多选）',
        type: 'multiple',
        options: ['String', 'Number', 'Array', 'Boolean', 'Object', 'Undefined'],
        answer: 'ABDF',
        explanation: 'JavaScript的基本数据类型包括：String、Number、Boolean、Undefined、Null、Symbol、BigInt。Array和Object是引用类型。',
        category: 'JavaScript基础',
        difficulty: 2,
        source: '示例题库',
        createdAt: new Date().toISOString()
      },
      {
        id: 'sample_5',
        question: 'HTTP状态码404表示什么？',
        type: 'single',
        options: ['服务器内部错误', '请求成功', '资源未找到', '请求被拒绝'],
        answer: 'C',
        explanation: '404 Not Found 表示服务器无法找到请求的资源。',
        category: '网络基础',
        difficulty: 1,
        source: '示例题库',
        createdAt: new Date().toISOString()
      },
      {
        id: 'sample_6',
        question: 'TCP协议是面向连接的协议。',
        type: 'judgment',
        options: ['正确', '错误'],
        answer: '正确',
        explanation: 'TCP（传输控制协议）是面向连接的、可靠的传输层协议，通过三次握手建立连接。',
        category: '网络基础',
        difficulty: 2,
        source: '示例题库',
        createdAt: new Date().toISOString()
      },
      {
        id: 'sample_7',
        question: '在CSS中，display: flex 和 display: grid 的区别是什么？',
        type: 'single',
        options: ['没有区别', 'Flex是一维布局，Grid是二维布局', 'Grid是一维布局，Flex是二维布局', 'Flex只能水平排列'],
        answer: 'B',
        explanation: 'Flexbox是一维布局模型（沿主轴方向），Grid是二维布局模型（同时控制行和列）。',
        category: 'CSS进阶',
        difficulty: 3,
        source: '示例题库',
        createdAt: new Date().toISOString()
      },
      {
        id: 'sample_8',
        question: '以下哪个方法可以阻止事件冒泡？',
        type: 'single',
        options: ['event.preventDefault()', 'event.stopPropagation()', 'event.cancelBubble()', 'event.stopEvent()'],
        answer: 'B',
        explanation: 'event.stopPropagation() 用于阻止事件冒泡，而 event.preventDefault() 用于阻止默认行为。',
        category: 'JavaScript进阶',
        difficulty: 3,
        source: '示例题库',
        createdAt: new Date().toISOString()
      },
      {
        id: 'sample_9',
        question: 'React中，useState Hook返回一个包含两个元素的数组，第一个是状态值，第二个是更新函数。',
        type: 'judgment',
        options: ['正确', '错误'],
        answer: '正确',
        explanation: 'const [state, setState] = useState(initialValue) 是useState的标准用法。',
        category: 'React',
        difficulty: 2,
        source: '示例题库',
        createdAt: new Date().toISOString()
      },
      {
        id: 'sample_10',
        question: 'Git中，用于查看提交历史的命令是？',
        type: 'single',
        options: ['git status', 'git log', 'git diff', 'git show'],
        answer: 'B',
        explanation: 'git log 命令用于查看项目的提交历史记录。',
        category: '开发工具',
        difficulty: 1,
        source: '示例题库',
        createdAt: new Date().toISOString()
      },
      {
        id: 'sample_11',
        question: 'SQL中，用于删除表中所有数据但保留表结构的语句是？',
        type: 'single',
        options: ['DROP TABLE', 'DELETE FROM', 'TRUNCATE TABLE', 'REMOVE TABLE'],
        answer: 'C',
        explanation: 'TRUNCATE TABLE 用于快速删除表中所有行，比 DELETE 更快且重置自增ID。DROP TABLE 会删除整个表。',
        category: '数据库',
        difficulty: 2,
        source: '示例题库',
        createdAt: new Date().toISOString()
      },
      {
        id: 'sample_12',
        question: '以下哪些是有效的HTTP请求方法？（多选）',
        type: 'multiple',
        options: ['GET', 'POST', 'SEND', 'PUT', 'DELETE', 'FETCH'],
        answer: 'ABDE',
        explanation: 'HTTP标准请求方法包括：GET、POST、PUT、DELETE、PATCH、HEAD、OPTIONS等。SEND和FETCH不是标准HTTP方法。',
        category: '网络基础',
        difficulty: 2,
        source: '示例题库',
        createdAt: new Date().toISOString()
      }
    ];
    return samples;
  }
};
