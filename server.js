/**
 * 智能学习助手 - 后端服务器
 * 
 * 启动方式：node server.js
 * 访问地址：http://localhost:3000
 * 局域网访问：http://本机IP:3000
 * 
 * 数据存储：data/ 目录下的 JSON 文件
 * 所有设备通过此服务器访问，数据统一存储在后端，实现多设备共享
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// ========== 配置 ==========
const PORT = 3000;
const DATA_DIR = path.join(__dirname, 'data');

// 数据文件路径
const DATA_FILES = {
  banks: path.join(DATA_DIR, 'banks.json'),
  questions: path.join(DATA_DIR, 'questions.json'),
  wrong: path.join(DATA_DIR, 'wrong.json'),
  records: path.join(DATA_DIR, 'records.json')
};

// MIME 类型映射
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.wasm': 'application/wasm',
  '.pdf': 'application/pdf'
};

// ========== 数据初始化 ==========
function initData() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  for (const [key, filePath] of Object.entries(DATA_FILES)) {
    if (!fs.existsSync(filePath)) {
      const initialData = {
        banks: [],
        questions: [],
        wrong: [],
        records: []
      };
      fs.writeFileSync(filePath, JSON.stringify(initialData[key], null, 2), 'utf-8');
    }
  }
}

// ========== 数据读写工具 ==========
function readData(name) {
  try {
    const raw = fs.readFileSync(DATA_FILES[name], 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeData(name, data) {
  fs.writeFileSync(DATA_FILES[name], JSON.stringify(data, null, 2), 'utf-8');
}

function generateId() {
  return Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
}

// ========== 路由处理 ==========

async function handleRequest(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // CORS 跨域支持（所有来源都允许）
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // ===== API 路由 =====

  // 获取统计数据
  if (pathname === '/api/stats' && method === 'GET') {
    const banks = readData('banks');
    const questions = readData('questions');
    const wrong = readData('wrong');

    // 按类型统计题目
    const typeStats = {};
    const typeLabels = { single: '单选', multiple: '多选', judgment: '判断', fill: '填空' };
    for (const q of questions) {
      const t = q.type || 'single';
      if (!typeStats[t]) typeStats[t] = { label: typeLabels[t] || t, count: 0 };
      typeStats[t].count++;
    }

    // 按题库统计
    const bankStats = {};
    for (const bank of banks) {
      if (bank.id) {
        bankStats[bank.id] = { name: bank.name, count: 0 };
      }
    }
    for (const q of questions) {
      if (bankStats[q.bankId]) {
        bankStats[q.bankId].count++;
      }
    }

    return sendJSON(res, {
      totalQuestions: questions.length,
      totalWrong: wrong.length,
      totalBanks: banks.length,
      typeStats,
      bankStats
    });
  }

  // ===== 题库管理 API =====

  // 获取所有题库
  if (pathname === '/api/banks' && method === 'GET') {
    const banks = readData('banks');
    const questions = readData('questions');

    // 计算每个题库的题目数量
    const result = banks.map(bank => ({
      ...bank,
      questionCount: questions.filter(q => q.bankId === bank.id).length
    }));

    return sendJSON(res, result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  }

  // 创建题库
  if (pathname === '/api/banks' && method === 'POST') {
    const body = await parseBody(req);
    const banks = readData('banks');

    const bank = {
      id: generateId(),
      name: body.name || '未命名题库',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    banks.push(bank);
    writeData('banks', banks);

    return sendJSON(res, bank, 201);
  }

  // 更新题库
  const putBankMatch = pathname.match(/^\/api\/banks\/(.+)$/);
  if (putBankMatch && method === 'PUT') {
    const bankId = putBankMatch[1];
    const body = await parseBody(req);
    const banks = readData('banks');

    const index = banks.findIndex(b => b.id === bankId);
    if (index === -1) return sendError(res, 404, '题库不存在');

    banks[index].name = body.name || banks[index].name;
    banks[index].updatedAt = new Date().toISOString();

    writeData('banks', banks);
    return sendJSON(res, banks[index]);
  }

  // 删除题库
  const deleteBankMatch = pathname.match(/^\/api\/banks\/(.+)$/);
  if (deleteBankMatch && method === 'DELETE') {
    const bankId = deleteBankMatch[1];
    let banks = readData('banks');
    let questions = readData('questions');

    banks = banks.filter(b => b.id !== bankId);
    questions = questions.filter(q => q.bankId !== bankId);

    writeData('banks', banks);
    writeData('questions', questions);

    return sendJSON(res, { success: true });
  }

  // ===== 题目管理 API =====

  // 获取题目
  if (pathname === '/api/questions' && method === 'GET') {
    const bankId = parsedUrl.query.bankId;
    const type = parsedUrl.query.type;
    let questions = readData('questions');

    if (bankId) questions = questions.filter(q => q.bankId === bankId);
    if (type) questions = questions.filter(q => q.type === type);

    return sendJSON(res, questions);
  }

  // 批量导入题目
  if (pathname === '/api/questions' && method === 'POST') {
    const body = await parseBody(req);
    const bankId = parsedUrl.query.bankId || body.bankId;

    if (!bankId) return sendError(res, 400, '缺少 bankId');
    if (!body.questions || !Array.isArray(body.questions)) return sendError(res, 400, '缺少题目数据');

    // 确认题库存在
    const banks = readData('banks');
    if (!banks.find(b => b.id === bankId)) return sendError(res, 404, '题库不存在');

    const questions = readData('questions');
    const newQuestions = body.questions.map(q => ({
      ...q,
      id: q.id || generateId(),
      bankId,
      createdAt: q.createdAt || new Date().toISOString()
    }));

    questions.push(...newQuestions);
    writeData('questions', questions);

    return sendJSON(res, { count: newQuestions.length, questions: newQuestions }, 201);
  }

  // 删除题目
  if (pathname === '/api/questions' && method === 'DELETE') {
    const body = await parseBody(req);
    const ids = body.ids || [];
    let questions = readData('questions');
    questions = questions.filter(q => !ids.includes(q.id));
    writeData('questions', questions);
    return sendJSON(res, { deleted: ids.length });
  }

  // ===== 错题 API =====

  // 获取错题
  if (pathname === '/api/wrong' && method === 'GET') {
    const wrong = readData('wrong');
    const questions = readData('questions');
    const result = wrong.map(w => {
      const q = questions.find(q => q.id === w.questionId);
      return { ...w, question: q || null };
    }).filter(w => w.question);
    return sendJSON(res, result);
  }

  // 添加错题
  if (pathname === '/api/wrong' && method === 'POST') {
    const body = await parseBody(req);
    const wrong = readData('wrong');

    if (!wrong.find(w => w.questionId === body.questionId)) {
      wrong.push({
        id: generateId(),
        questionId: body.questionId,
        userAnswer: body.userAnswer || '',
        createdAt: new Date().toISOString()
      });
      writeData('wrong', wrong);
    }

    return sendJSON(res, { success: true });
  }

  // 移除错题
  const deleteWrongMatch = pathname.match(/^\/api\/wrong\/(.+)$/);
  if (deleteWrongMatch && method === 'DELETE') {
    const questionId = deleteWrongMatch[1];
    let wrong = readData('wrong');
    wrong = wrong.filter(w => w.questionId !== questionId);
    writeData('wrong', wrong);
    return sendJSON(res, { success: true });
  }

  // ===== 学习记录 API =====

  // 获取学习记录
  if (pathname === '/api/records' && method === 'GET') {
    const records = readData('records');
    return sendJSON(res, records.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt)).slice(0, 50));
  }

  // 保存学习记录
  if (pathname === '/api/records' && method === 'POST') {
    const body = await parseBody(req);
    const records = readData('records');

    const record = {
      id: generateId(),
      mode: body.mode || 'practice',
      correctCount: body.correctCount || 0,
      totalCount: body.totalCount || 0,
      accuracy: body.accuracy || 0,
      duration: body.duration || 0,
      details: body.details || [],
      completedAt: body.completedAt || new Date().toISOString()
    };

    records.push(record);
    writeData('records', records);

    return sendJSON(res, record, 201);
  }

  // ===== 数据导出/导入 API =====

  // 导出全部数据
  if (pathname === '/api/export' && method === 'GET') {
    const data = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      banks: readData('banks'),
      questions: readData('questions'),
      wrong: readData('wrong'),
      records: readData('records')
    };
    return sendJSON(res, data);
  }

  // 导入全部数据
  if (pathname === '/api/import' && method === 'POST') {
    const body = await parseBody(req);

    if (body.banks) writeData('banks', body.banks);
    if (body.questions) writeData('questions', body.questions);
    if (body.wrong) writeData('wrong', body.wrong);
    if (body.records) writeData('records', body.records);

    return sendJSON(res, { success: true });
  }

  // ===== 多题库筛选 API =====
  if (pathname === '/api/questions/filter' && method === 'POST') {
    const body = await parseBody(req);
    const bankConfigs = body.bankConfigs || [];
    let allQuestions = [];

    if (bankConfigs.length === 0) {
      allQuestions = readData('questions');
    } else {
      const questions = readData('questions');
      for (const config of bankConfigs) {
        let filtered = questions.filter(q => q.bankId === config.bankId);
        if (config.types && config.types.length > 0) {
          filtered = filtered.filter(q => config.types.includes(q.type));
        }
        allQuestions.push(...filtered);
      }
    }

    return sendJSON(res, allQuestions);
  }

  // ===== 静态文件服务 =====
  return serveStaticFile(req, res, pathname);
}

// ========== 工具函数 ==========

function sendJSON(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function sendError(res, status, message) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ error: message }));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(new Error('JSON 解析失败'));
      }
    });
    req.on('error', reject);
  });
}

async function serveStaticFile(req, res, pathname) {
  // 默认首页
  if (pathname === '/') pathname = '/index.html';

  const filePath = path.join(__dirname, pathname);

  // 安全检查：防止目录穿越
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  try {
    const stat = await fs.promises.stat(filePath);
    if (!stat.isFile()) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  } catch {
    res.writeHead(404);
    res.end('Not Found');
  }
}

// ========== 启动服务器 ==========
initData();

const server = http.createServer(handleRequest);

server.listen(PORT, '0.0.0.0', () => {
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  let localIP = 'localhost';

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        localIP = net.address;
        break;
      }
    }
  }

  console.log('');
  console.log('=========================================');
  console.log('   智能学习助手 - 服务器已启动');
  console.log('=========================================');
  console.log('');
  console.log('  本地访问:   http://localhost:' + PORT);
  console.log('  网络访问:   http://' + localIP + ':' + PORT);
  console.log('');
  console.log('  局域网内其他设备（手机/平板/其他电脑）');
  console.log('  通过上方 "网络访问" 地址连接即可');
  console.log('');
  console.log('  数据存储在 data/ 目录下，所有设备共享');
  console.log('  Ctrl+C 停止服务器');
  console.log('=========================================');
  console.log('');
});
