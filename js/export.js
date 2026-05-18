/**
 * 导出模块
 * 支持 JSON 和 PDF 导出
 */
const Export = {

  /**
   * 导出错题本为 PDF
   */
  async exportWrongQuestionsPDF() {
    const wrongRecords = await DB.getAllWrongQuestions();
    if (wrongRecords.length === 0) {
      throw new Error('错题本为空');
    }

    const questionIds = wrongRecords.map(r => r.questionId);
    const questions = await DB.getQuestionsByIds(questionIds);

    // 生成 PDF 内容
    const content = this._generateWrongQuestionsContent(questions, wrongRecords);

    // 创建可下载的 HTML 文件（打印友好格式）
    this._downloadAsPrintableHTML(content, `错题本-${this._dateStr()}.html`);
  },

  /**
   * 生成错题内容
   */
  _generateWrongQuestionsContent(questions, wrongRecords) {
    const typeLabels = { single: '单选题', multiple: '多选题', judgment: '判断题', fill: '填空题' };
    const now = new Date().toLocaleString('zh-CN');

    let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>错题本</title>
  <style>
    @page { margin: 2cm; }
    body { font-family: "SimSun", "宋体", serif; font-size: 12pt; line-height: 1.8; color: #333; }
    h1 { text-align: center; font-size: 18pt; margin-bottom: 5px; }
    .subtitle { text-align: center; color: #666; margin-bottom: 20px; font-size: 10pt; }
    .question { margin-bottom: 25px; padding: 15px; border: 1px solid #ddd; border-radius: 5px; page-break-inside: avoid; }
    .question-header { display: flex; justify-content: space-between; margin-bottom: 10px; }
    .question-num { font-weight: bold; color: #1a73e8; }
    .question-type { color: #666; font-size: 10pt; }
    .question-text { margin-bottom: 10px; font-weight: bold; }
    .options { margin-left: 20px; margin-bottom: 10px; }
    .option { margin: 5px 0; }
    .answer { color: #e91e63; font-weight: bold; margin: 10px 0; padding: 10px; background: #fce4ec; border-radius: 5px; }
    .explanation { color: #666; font-size: 11pt; margin-top: 10px; padding: 10px; background: #f5f5f5; border-radius: 5px; }
    .wrong-count { color: #f44336; font-size: 10pt; }
    .footer { text-align: center; color: #999; font-size: 9pt; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; }
    @media print {
      .question { border: 1px solid #ccc; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <h1>错 题 本</h1>
  <p class="subtitle">导出时间：${now} | 共 ${questions.length} 道错题</p>

  ${questions.map((q, idx) => {
    const record = wrongRecords.find(r => r.questionId === q.id);
    const optionLabels = ['A', 'B', 'C', 'D', 'E', 'F'];
    let optionsHTML = '';

    if (q.type === 'judgment') {
      optionsHTML = '<div class="options">正确 / 错误</div>';
    } else if (q.options && q.options.length > 0) {
      optionsHTML = '<div class="options">' + q.options.map((opt, i) =>
        `<div class="option">${optionLabels[i]}. ${opt}</div>`
      ).join('') + '</div>';
    }

    return `
    <div class="question">
      <div class="question-header">
        <span class="question-num">第 ${idx + 1} 题</span>
        <span class="question-type">${typeLabels[q.type] || '未知题型'}</span>
      </div>
      <div class="question-text">${q.question}</div>
      ${optionsHTML}
      <div class="answer">正确答案：${q.answer}</div>
      ${q.explanation ? `<div class="explanation"><strong>解析：</strong>${q.explanation}</div>` : ''}
      <div class="wrong-count">错误次数：${record ? record.wrongCount : 1}</div>
    </div>
    `;
  }).join('')}

  <div class="footer">
    <p>由智能学习助手导出 | ${now}</p>
  </div>

  <div class="no-print" style="text-align: center; margin-top: 30px; padding: 20px;">
    <button onclick="window.print()" style="padding: 10px 30px; font-size: 14pt; background: #1a73e8; color: white; border: none; border-radius: 5px; cursor: pointer;">
      🖨️ 打印 / 另存为 PDF
    </button>
    <p style="color: #999; margin-top: 10px; font-size: 10pt;">提示：在打印对话框中可选择"另存为 PDF"</p>
  </div>
</body>
</html>`;

    return html;
  },

  _dateStr() {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  },

  _downloadAsPrintableHTML(content, filename) {
    const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
};
