// dataAgent.js
// 数据可视化智能体核心模块，整合智能问答、智能绘图、数据检索、意图识别、数据计算等多agent能力
// 可直接在Electron主进程调用

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const fetch = require('node-fetch'); // 若在Electron主进程无fetch需npm install node-fetch
const os = require('os');

const DEFAULT_MODEL = 'THUDM/glm-4-9b-chat'; // 默认大模型名称，可根据实际情况修改

// ========== 工具函数 ==========
/**
 * 自动检测Python解释器路径，优先使用本地python_env/Scripts/python.exe，否则用系统python
 */
let PYTHON_PATH = 'python';
try {
  const localPython = path.join(__dirname, 'python_env', 'Scripts', 'python.exe');
  if (fs.existsSync(localPython)) {
    PYTHON_PATH = localPython;
  }
} catch {}

/**
 * @description 启动时自动清理历史残留的tmp_calc_*.py/json文件
 */
(function cleanOldTmpFiles() {
  const tmpDir = os.tmpdir();
  const files = fs.readdirSync(tmpDir);
  files.forEach(f => {
    if (/^tmp_calc_.*\.(py|json)$/.test(f)) {
      try { fs.unlinkSync(path.join(tmpDir, f)); } catch {}
    }
  });
})();

/**
 * 统一大模型API调用，参考visual-helper-drag.js和preload.js
 * @param {object} params - {model, apiKey, messages, ...}
 * @returns {Promise<object>} LLM返回结果
 */
async function callLLMWithRetry(params, maxRetry = 2) {
  let lastError = null;
  let tryMessages = params.messages || [];
  for (let i = 0; i <= maxRetry; i++) {
    try {
      const res = await callLLM({ ...params, messages: tryMessages, apiKey: params.apiKey });
      if (typeof res === 'string') {
        try { return { choices: [{ message: { content: res } }] }; } catch { return res; }
      }
      return res;
    } catch (e) {
      lastError = e;
      if (tryMessages.length > 1) {
        tryMessages = tryMessages.slice(1);
      } else {
        break;
      }
    }
  }
  throw lastError;
}

// ========== 数据检索与采样 ==========
async function retrieveData(rows, params) {
  return new Promise((resolve, reject) => {
    const tmpFile = path.join(process.cwd(), 'tmp_retrieve.json');
    fs.writeFileSync(tmpFile, JSON.stringify(rows, null, 2));
    // TODO: 修改为你实际的python脚本路径
    const py = spawn(PYTHON_PATH, [
      'backend/app/services/data_processing/retrieve_entry.py',
      tmpFile,
      JSON.stringify(params)
    ]);
    let output = '';
    py.stdout.on('data', (data) => { output += data.toString(); });
    py.stderr.on('data', (data) => { console.error('Python错误:', data.toString()); });
    py.on('close', (code) => {
      fs.unlinkSync(tmpFile);
      if (code === 0) {
        try { resolve(JSON.parse(output)); }
        catch (e) { reject(e); }
      } else {
        reject(new Error('Python检索脚本执行失败'));
      }
    });
  });
}

// ========== 意图识别 ==========
/**
 * @description 意图识别agent，严格对齐最佳实践，system prompt优化
 */
async function detectIntent({ question, model = DEFAULT_MODEL, apiKey }) {
  // 新版prompt，提升general/calc/plot区分度
  const prompt = `请分析用户问题的意图，判断是以下哪种类型（只返回JSON格式的结果，不要解释）：\n1. plot: 需要绘图的问题，包含"画图""绘制""可视化""柱状图""饼图""折线图"等词语\n2. calc: 需要数据计算/分析的问题，包含"计算""求""统计""分析""最大""最小""平均""汇总"等词语\n3. general: 一般闲聊、问候、无关数据、非数据分析/非绘图的问题（如讲个笑话、介绍自己、编程示例、日常对话等）\n\n用户问题: "${question}"\n\n请返回格式如下：\n{"intent": "plot/calc/general"}`;
  const res = await callLLMWithRetry({
    model,
    apiKey,
    messages: [
      { role: 'system', content: '你是意图识别专家，只返回JSON格式结果' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.1,
    max_tokens: 32
  });
  try {
    const content = res.choices[0]?.message?.content || '';
    const result = JSON.parse(content.replace(/```json|```/g, '').trim());
    if (['plot', 'calc', 'general'].includes(result.intent)) {
      console.log('[意图识别] 用户问题:', question);
      console.log('[意图识别] 识别结果:', result.intent);
      return result.intent;
    }
  } catch (e) {
    console.error('[意图识别agent] JSON解析错误:', e);
  }
  return 'general';
}

// ========== 智能问答 ==========
// async function askQuestion({ ... }) { ... } // 禁用，防止calc链路误用LLM直接回复

// ========== 智能绘图 ==========
/**
 * 代码生成agent
 * @param {Object} params
 * @param {string} params.question 用户问题
 * @param {string[]} params.plotFields 字段名
 * @param {any[]} params.plotData 数据切片
 * @param {string} params.model LLM模型名
 * @param {string} params.apiKey API密钥
 * @returns {Promise<string>} Python代码
 */
async function plotCodeAgent({ question, plotFields, plotData, model, apiKey }) {
  /**
   * JSDoc: 生成Python绘图代码
   * - 只输出一段完整的Python代码（只允许使用seaborn或matplotlib，且优先使用seaborn。结尾plt.savefig('output.png', ...)），禁止plt.show()。
   * - 不包裹为JSON，不输出多余解释。
   */
  const prompt = `你是一名专业的数据可视化代码生成助手。请根据下方用户问题、字段名和数据切片，自动推理最适合的数据可视化方案，只输出一段完整的Python绘图代码（只允许使用seaborn或matplotlib，且优先使用seaborn。结尾必须是plt.savefig('output.png', ...)），禁止plt.show()，不要输出多余解释。只能用如下字段：${plotFields.join('、')}。数据示例：${JSON.stringify(plotData.slice(0,5), null, 2)}。用户问题：${question}`;
  const res = await callLLMWithRetry({
    model,
    apiKey,
    messages: [
      { role: 'system', content: '你是一名专业的数据可视化代码生成助手。只输出一段完整的Python绘图代码，禁止输出多余解释或JSON包裹。' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.3,
    max_tokens: 1024,
    top_p: 0.9,
    frequency_penalty: 0.3
  });
  // 直接返回原始内容，由后续逻辑解析python_code
  return res.choices[0]?.message?.content || '';
}

/**
 * 代码修复agent
 * @param {Object} params
 * @param {string} params.code 上次Python代码
 * @param {string} params.error 报错信息
 * @param {any[]} params.dataPreview 数据切片
 * @param {string} params.question 用户问题
 * @param {string} params.model LLM模型名
 * @param {string} params.apiKey API密钥
 * @param {number} [params.maxRetry=3] 最大重试次数
 * @param {function} [params.onStatus] 状态回调
 * @returns {Promise<string>} 修正后的Python代码
 */
async function codeRepairAgent({ code, error, dataPreview, question, model, apiKey, maxRetry = 3, onStatus, fields }) {
  let fixed = code;
  for (let i = 0; i < maxRetry; i++) {
    // 如果报错涉及全df聚合，自动补充提示
    let extraTip = '';
    if (/UFuncNoLoopError|must be str, not int|cannot perform|not supported between/.test(error)) {
      extraTip = '\n【重要提示】只能对后端传入的字段数组fields做聚合，不能对全df做max()/min()/sum()等操作。';
    }
    const prompt = `你是Python代码修复专家。请根据下方用户问题、错误信息和数据样本，修复给定的Python代码。只输出修正后的完整Python绘图代码（只允许使用seaborn或matplotlib，且优先使用seaborn。结尾plt.savefig('output.png', ...)），禁止plt.show()，不输出多余解释。\n用户问题: ${question}\n错误信息: ${error}${extraTip}\n数据样本: ${JSON.stringify(dataPreview.slice(0,2), null, 2)}\n原始代码:\n${fixed}`;
    const res = await callLLMWithRetry({
      model,
      apiKey,
      messages: [
        { role: 'system', content: '你是Python代码修复专家，只能输出Python代码，禁止输出多余解释或JSON包裹。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 1024
    });
    let content = res.choices[0]?.message?.content || '';
    let newCode = extractPurePythonCode(content);
    // 自动替换全df聚合为df[fields]聚合
    newCode = newCode.replace(/df\.(max|min|sum|mean)\s*\(/g, 'df[fields].$1(');
    fixed = newCode;
  }
  return fixed;
}

// ========== 字段提取与辅助函数 ==========
/**
 * @description 字段提取agent，优先用data[0]的字段，兜底时用Object.keys(data[0])，字段为空直接报错
 */
async function extractFieldsFromQuestion(question, allFields, dataRows, model = DEFAULT_MODEL, apiKey) {
  let fields = allFields && allFields.length ? allFields : (dataRows[0] ? Object.keys(dataRows[0]) : []);
  if (!fields.length) throw new Error('未检测到有效字段，请先上传包含表头的数据文件');
  const prompt = `你的任务是根据用户问题，从提供的可用字段[]中选取最相关的字段，放到"提取结果[]"下，只能返回与问题直接相关的字段（如"数学平均分"只返回"数学"），不要返回无关字段。\n用户问题: ${question}\n可用字段: ${JSON.stringify(fields, null, 2)}\n数据样本: ${JSON.stringify(dataRows?.slice(0,2)||[], null, 2)}\n提取结果: `;
  const res = await callLLMWithRetry({
    model,
    apiKey,
    messages: [
      { role: 'system', content: '你是字段提取agent，只返回JSON数组。' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.2,
    max_tokens: 128
  });
  let arrJson = res.choices[0]?.message?.content || '[]';
  try {
    arrJson = arrJson.replace(/```json|```/g, '').trim();
    let arr = JSON.parse(arrJson);
    arr = Array.isArray(arr) ? arr.filter(f => fields.includes(f)) : [];
    if (arr.length > 0) {
      console.log('[字段提取] 可用字段:', fields);
      console.log('[字段提取] 用户问题:', question);
      console.log('[字段提取] 提取结果:', arr);
      return arr;
    }
    // 兜底：只用所有数值型字段
    if (dataRows && dataRows.length > 0) {
      const sample = dataRows[0];
      const numericFields = Object.keys(sample).filter(k => typeof sample[k] === 'number');
      if (numericFields.length > 0) {
        console.log('[字段提取] 兜底字段:', numericFields);
        return numericFields;
      }
    }
    console.log('[字段提取] 兜底全部字段:', fields);
    return fields;
  } catch {
    console.log('[字段提取] JSON解析失败，返回全部字段:', fields);
    return fields;
  }
}

function getRelevantNumericFields(allFields, dataRows, question) {
  const sample = dataRows && dataRows.length > 0 ? dataRows[0] : {};
  const numericFields = Object.keys(sample).filter(k => typeof sample[k] === 'number');
  const keywords = ['分', '价', '金额', 'score', 'price', 'amount', 'total', 'sum'];
  return numericFields.filter(f =>
    keywords.some(kw => f.toLowerCase().includes(kw)) ||
    question.includes(f)
  );
}

function buildUniversalSystemPrompt(userFields, dataPreview, question) {
  return `你是一个数据分析专家。无论用户如何提问，你只能输出Python代码块（用\`\`\`python ... \`\`\`包裹），且代码最后必须有如下格式：\nresult = {\n  "字段1": 值1,\n  "字段2": 值2,\n  ...\n}\nprint(json.dumps(result, ensure_ascii=False))\n不能输出其他print语句或分析文本，否则会被判为错误。\n你只能直接使用变量 data（类型为 list[dict]，每个 dict 的 key 为字段名），禁止使用 pd.read_excel、open、os、path 等任何本地文件读取操作，不能写 data = pd.read_excel(...)、data = open(...) 等语句。\n【重要约束】：\n- 你只能对如下"相关字段"进行加和、平均、聚合等数值计算，不能加其他字段（如ID、序号、姓名等非数值字段）：\n  ${userFields.join('、')}\n- 不能用 row.values()、student.values()、dict.values() 等方式直接加所有字段，只能用 for f in fields 方式逐字段取值。\n- 相关字段的名称可能为中文、英文、拼音或缩写，请严格按给定字段名处理。\n数据示例（仅供参考）：\n${JSON.stringify(dataPreview, null, 2)}\n用户问题：${question}`;
}

/**
 * @description 执行数据计算Python代码，所有临时文件写入os.tmpdir()，finally强制删除
 * @param {Object} param0
 * @returns {Promise<any>}
 */
async function runPythonCalcCode({ code, data }) {
  return new Promise((resolve, reject) => {
    const tmpDir = os.tmpdir();
    const tmpData = path.join(tmpDir, `tmp_calc_data_${Date.now()}_${Math.random().toString(36).slice(2,8)}.json`);
    const tmpCode = path.join(tmpDir, `tmp_calc_code_${Date.now()}_${Math.random().toString(36).slice(2,8)}.py`);
    fs.writeFileSync(tmpData, JSON.stringify(data, null, 2), 'utf8');
    let safeCode = code;
    if (!/print\(json\.dumps\(result/.test(safeCode)) {
      safeCode += '\nprint(json.dumps(result, ensure_ascii=False))\n';
    }
    const pyCode = `import sys\nimport io\nsys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')\nsys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')\nimport json\nwith open(r'${tmpData}', 'r', encoding='utf-8') as f:\n    data = json.load(f)\n${safeCode}`;
    fs.writeFileSync(tmpCode, pyCode, 'utf8');
    const py = spawn(PYTHON_PATH, [tmpCode]);
    py.stdout.setEncoding('utf8');
    py.stderr.setEncoding('utf8');
    let output = '';
    py.stdout.on('data', (d) => { output += d.toString(); });
    py.stderr.on('data', (d) => { console.error('Python错误:', d.toString()); });
    py.on('close', (code) => {
      try { fs.unlinkSync(tmpData); } catch {}
      try { fs.unlinkSync(tmpCode); } catch {}
      if (code === 0) {
        try { resolve(JSON.parse(output)); }
        catch (e) { reject(e); }
      } else {
        reject(new Error('Python计算脚本执行失败'));
      }
    });
  });
}

// ========== 其它API路由整合为纯函数 ==========
/**
 * 智能问答主流程（复刻/qa/ask）
 * @param {Object} params
 * @param {string} params.question 用户问题
 * @param {any[]} params.data 数据
 * @param {string[]} [params.columns] 字段名
 * @param {any[]} [params.messages] 上下文消息
 * @param {string} [params.model] LLM模型名
 * @returns {Promise<{answer: any, code: string, result: any, source: string}|{error: string, code: string, detail: string}>}
 */
async function askQuestionAPI(params) { return askQuestion(params) }

/**
 * 意图识别API（复刻/qa/intent）
 * @param {string} question
 * @param {string} [model]
 * @returns {Promise<'plot'|'calc'|'general'>}
 */
async function detectIntentAPI(question, model) { return detectIntent({ question, model }) }

/**
 * 直接问答API（复刻/qa/answer）
 * @param {string} question
 * @param {string} [model]
 * @returns {Promise<string>} 直接LLM回复
 */
async function answerAPI(question, model = DEFAULT_MODEL, apiKey) {
  const res = await callLLMWithRetry({
    model,
    apiKey,
    messages: [
      { role: 'system', content: '你是一个专业数据分析师。' },
      { role: 'user', content: question }
    ],
    temperature: 0.3,
    max_tokens: 512
  });
  return res.choices[0]?.message?.content || '';
}

/**
 * 数据检索API（复刻/data/retrieve）
 * @param {any[]} rows
 * @param {any} params
 * @returns {Promise<any>} 检索/采样结果
 */
async function retrieveDataAPI(rows, params) { return retrieveData(rows, params) }

/**
 * @description 智能体主入口，自动分流到plot/calc/general链路
 * @param {Object} params
 * @param {string} params.question 用户问题
 * @param {string[]} params.columns 字段名
 * @param {any[]} params.dataPreview 前几行数据
 * @param {any[]} params.data 全量数据（仅Python用）
 * @param {string} params.model LLM模型名
 * @param {string} params.apiKey API密钥
 * @param {function} params.onStatus 链路状态回调（SSE风格）
 * @returns {Promise<any>}
 */
async function mainAgent({ question, columns, dataPreview, data, model, apiKey, onStatus }) {
  // 不再传递sessionId
  const safeOnStatus = (msg) => {
    onStatus(msg);
  };
  safeOnStatus({ type: 'intent', status: 'running' });
  const intent = await detectIntent({ question, model, apiKey });
  safeOnStatus({ type: 'intent', status: 'success', data: intent });
  if (intent === 'plot') {
    // 仅传递必要参数
    return await plotChain({ question, columns, dataPreview, data, model, apiKey, onStatus: safeOnStatus });
  } else if (intent === 'calc') {
    return await calcChain({ question, columns, dataPreview, data, model, apiKey, onStatus });
  } else {
    return await generalChain({ question, columns, dataPreview, data, model, apiKey });
  }
}

// plot链路（重构版，仅用代码生成和修复agent）
/**
 * @description 智能绘图主流程
 * @param {Object} params
 * @param {string} params.question 用户问题
 * @param {string[]} params.columns 字段名
 * @param {any[]} params.dataPreview 前几行数据
 * @param {any[]} params.data 全量数据
 * @param {string} params.model LLM模型名
 * @param {string} params.apiKey API密钥
 * @returns {Promise<{python_code: string, png_path: string}>}
 */
async function plotChain({ question, columns, dataPreview, data, model, apiKey }) {
  // 1. 字段提取
  const plotFields = await extractFieldsFromQuestion(
    question,
    columns || (data[0] ? Object.keys(data[0]) : []),
    data,
    model,
    apiKey
  );
  // 2. 代码生成
  let code = await plotCodeAgent({ question, plotFields, plotData: data, model, apiKey });
  let pngPath = null;
  let error = null;
  // 3. Python执行，失败则自动修复，最多重试3次
  for (let i = 0; i < 3; i++) {
    try {
      // 这里假设runPythonPlotCode返回{pngPath: string}
      const result = await runPythonPlotCode({ code, data });
      pngPath = result.pngPath || result.png_path || result;
      if (pngPath) break;
    } catch (err) {
      error = err;
      code = await codeRepairAgent({ code, error, dataPreview, question, model, apiKey });
    }
  }
  if (!pngPath) throw new Error('代码修复失败，未能生成图片');
  // 4. 返回python_code和png_path
  return { python_code: code, png_path: pngPath };
}

// calc链路（去除所有agent执行状态/进度回调相关代码，保持主流程简洁）
async function calcChain({ question, columns, dataPreview, data, model, apiKey }) {
  const fields = await extractFieldsFromQuestion(
    question,
    columns || (data[0] ? Object.keys(data[0]) : []),
    data,
    model,
    apiKey
  );
  let code = await calcCodeAgent({ question, fields, dataPreview, model, apiKey });
  let result, error;
  for (let i = 0; i < 3; i++) {
    try {
      result = await runPythonCalcCode({ code, data });
      break;
    } catch (err) {
      error = err;
      code = await codeRepairAgent({ code, error, dataPreview, question, model, apiKey });
    }
  }
  if (!result) throw new Error('代码修复失败');
  const analysis = await answerAgent({ result, question, model, apiKey });
  return { result, analysis };
}

// general链路
/**
 * @description 生成数据摘要（字段统计、极值、均值、唯一值等）
 * @param {string[]} columns - 字段名数组
 * @param {any[]} dataPreview - 前几行数据
 * @param {any[]} [allData] - 全量数据（可选）
 * @param {string} [fileName] - 数据文件名（可选）
 * @returns {string} 数据摘要文本
 */
function getDataSummaryText(columns, dataPreview, allData, fileName) {
  // 兼容老用法：只传rows
  let rows = allData && Array.isArray(allData) && allData.length > 0 ? allData : dataPreview;
  if (!rows || rows.length === 0) return '当前无数据。';
  const cols = columns && columns.length ? columns : Object.keys(rows[0] || {});
  let summary = '';
  if (fileName) {
    summary += `数据文件：${fileName}\n`;
  }
  summary += `当前上传数据共${rows.length}行，字段如下：\n`;
  for (const col of cols) {
    const values = rows.map(r => r[col]).filter(v => v !== undefined && v !== null && v !== '');
    const nums = values.map(v => typeof v === 'number' ? v : (typeof v === 'string' && !isNaN(Number(v)) ? Number(v) : null)).filter(v => typeof v === 'number');
    const type = nums.length === values.length && values.length > 0 ? '数值' : '文本';
    const uniqueCount = new Set(values).size;
    summary += `字段「${col}」：类型${type}，唯一值${uniqueCount}`;
    if (nums.length) {
      summary += `，最小值${Math.min(...nums)}，最大值${Math.max(...nums)}，均值${(nums.reduce((a,b)=>a+b,0)/nums.length).toFixed(2)}`;
    }
    summary += `，样本：${values.slice(0,3).join('，')}`;
    summary += '\n';
  }
  return summary;
}

/**
 * 通用问答链路（generalChain）
 * @param {Object} params
 * @returns {Promise<{answer: string}>}
 */
async function generalChain({ question, columns, dataPreview, data, model, apiKey, fileName }) {
  // 生成数据摘要文本
  let dataSummaryText = '';
  let hasData = Array.isArray(columns) && columns.length > 0 && Array.isArray(dataPreview) && dataPreview.length > 0;
  if (hasData) {
    dataSummaryText = getDataSummaryText(columns, dataPreview, data, fileName);
  } else {
    dataSummaryText = getDataSummaryText(columns, dataPreview, data, fileName); // 为空时也带文件名
  }
  // 优化后的system prompt
  const systemPrompt = `你是可视化数据分析助手，你可以看到用户上传的数据摘要。用户与你聊天时，可能需要你用到以下数据摘要：\n${dataSummaryText || '（当前无数据，用户还未上传数据）'}\n\n【重要约束】\n- 如果用户的问题需要用到数据摘要（如"请分析我的数据""你能看到我上传的数据吗"等），但数据摘要为空，请直接回复"请先上传数据"。\n- 如果用户的问题与数据无关（如闲聊、讲笑话等），则无需引用数据摘要，直接正常回复。\n- 如果用户已上传数据，且问题与数据相关，请结合数据摘要内容作答。\n`;
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: question }
  ];
  const result = await callLLM({ model, apiKey, messages });
  const answer = result.choices?.[0]?.message?.content || '';
  return { answer };
}

// LLM调用方式与可视化助手一致
async function callLLM({ model, apiKey, messages, temperature = 0.7, max_tokens = 1024, top_p = 0.9, frequency_penalty = 0 }) {
  if (!apiKey) {
    console.error('[callLLM] apiKey未传递!');
  }
  const res = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey
    },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      max_tokens,
      temperature,
      top_p,
      frequency_penalty
    })
  });
  const data = await res.json();
  if (data.error) {
    console.error('[callLLM] LLM接口返回错误:', data.error);
    throw new Error(data.error.message || JSON.stringify(data.error));
  }
  return data;
}

// figure json转png（直接在本文件内实现，无需额外脚本）
async function figJsonToPng(figJson) {
  const path = require('path');
  const fs = require('fs');
  const { spawn } = require('child_process');
  const pythonPath = path.join(__dirname, 'python_env', 'Scripts', 'python.exe');
  const tmpFig = path.join(process.cwd(), 'tmp_fig.json');
  const tmpPy = path.join(process.cwd(), 'tmp_fig2png.py');
  const pngPath = path.join(process.cwd(), 'tmp_fig.png');
  fs.writeFileSync(tmpFig, JSON.stringify(figJson, null, 2), 'utf8');
  const pyCode = `import sys, json\nimport plotly.io as pio\nwith open(r'${tmpFig}', 'r', encoding='utf-8') as f:\n    fig = json.load(f)\npio.write_image(fig, r'${pngPath}', format='png')\n`;
  fs.writeFileSync(tmpPy, pyCode, 'utf8');
  await new Promise((resolve, reject) => {
    const py = spawn(pythonPath, [tmpPy]);
    py.on('close', code => code === 0 ? resolve() : reject(new Error('fig2png失败')));
  });
  fs.unlinkSync(tmpFig);
  fs.unlinkSync(tmpPy);
  return pngPath;
}

/**
 * 通用LLM直接回复agent，完全复用callLLM
 * @param {Object} params
 * @param {string} params.question 用户问题
 * @param {string} params.model LLM模型名
 * @param {string} params.apiKey API密钥
 * @returns {Promise<string>} LLM回复内容
 */
async function directLLMAnswer({ question, model, apiKey, systemPrompt }) {
  const res = await callLLM({
    model,
    apiKey,
    messages: [
      { role: 'system', content: systemPrompt || '你是一个专业数据分析师。' },
      { role: 'user', content: question }
    ],
    temperature: 0.3,
    max_tokens: 512
  });
  if (typeof res === 'string') return res;
  return res.choices?.[0]?.message?.content || '';
}

/**
 * @description 数据计算代码生成agent，升级prompt，严格约束：只能对后端传入的fields字段数组做聚合，禁止对全df做max/min/sum等操作，输出必须能被json.dumps序列化
 */
async function calcCodeAgent({ question, fields, dataPreview, model, apiKey }) {
  const prompt = `你是数据分析代码专家。请根据用户问题和字段，生成可直接运行的pandas代码，严格只用下列字段，不要凭空创造字段，也不能写死字段名。\n【重要约束】你只能用如下代码创建DataFrame：df = pd.DataFrame(data)，其中data变量由后端注入全量数据，禁止将示例数据写入代码。示例数据仅供你理解字段类型。\n【禁止】禁止写 data = [...]，禁止将示例数据写入代码。\n【输出要求】所有聚合、统计、加和、最大、最小等操作只能对后端传入的字段数组fields做，不能对全df做max()/min()/sum()等操作，不能用df.max()、df.sum()等，必须用df[fields]或等价写法。字段名由后端动态传入，不能写死。输出必须以print(json.dumps(result, ensure_ascii=False))结尾，禁止多余print。\n【类型要求】如果 result 是 pandas 的 Series 或 DataFrame，必须先用 .to_dict() 转为 dict 后再输出；如果 result 是单个数字（如mean/sum/聚合），不要加.to_dict()，直接输出。输出内容必须能被json.dumps序列化。\n用户问题: ${question}\n目标字段: ${fields}\n数据样本: ${JSON.stringify(dataPreview.slice(0,2), null, 2)}`;
  const res = await callLLMWithRetry({
    model,
    apiKey,
    messages: [
      { role: 'system', content: '你是数据分析代码专家，只能输出Python代码块（用```python ... ```包裹），且代码最后必须有print(json.dumps(result, ensure_ascii=False))。' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.2,
    max_tokens: 1024
  });
  let code = extractPurePythonCode(res.choices[0]?.message?.content || '');
  // 强制删除所有 data = [...] 赋值
  code = code.replace(/data\s*=\s*\[([\s\S]*?)\];?/g, '');
  // 自动替换所有对df的全表聚合为df[fields]聚合，保证泛化
  code = code.replace(/df\.(max|min|sum|mean)\s*\(/g, 'df[fields].$1(');
  // 优化：只对Series/DataFrame加.to_dict()，标量不加
  code = code.replace(/(result\s*=\s*df\.[^\n;]+(mean|sum|groupby)\([^)]+\)[^\n;]*)/g, (m, g1) => {
    if (/to_dict\(\)/.test(g1)) return g1;
    if (/\[\[.*?\]\]/.test(g1) || /\['.*?'\]/.test(g1)) return g1 + '.to_dict()';
    return g1;
  });
  return code;
}

// 数据计算链路辅助agent
async function calcDataAgent({ question, plotFields, data, model, apiKey }) {
  // 只用dataPreview做prompt示例，Python执行始终用全量data
  const code = await calcCodeAgent({ question, fields: plotFields, dataPreview: data.slice(0,5), model, apiKey });
  // 关键：此处传递的data必须为全量数据
  const result = await runPythonCalcCode({ code, data });
  return result;
}

// 数据逻辑判断agent
/**
 * @description 数据逻辑判断agent，system prompt优化
 */
async function dataLogicAgent({ question, plotFields, dataPreview, model, apiKey }) {
  const prompt = `请判断下列用户问题和字段，是否需要对数据进行预处理（如分组、聚合、筛选等），只返回todo/both/none三种结果。\n用户问题：${question}\n字段：${plotFields.join('、')}\n数据示例：${JSON.stringify(dataPreview, null, 2)}`;
  const res = await callLLMWithRetry({
    model,
    apiKey,
    messages: [
      { role: 'system', content: '你是数据逻辑判断agent，只返回todo/both/none。' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.2,
    max_tokens: 32
  });
  const content = res.choices[0]?.message?.content || '';
  if (/todo|both|none/.test(content)) {
    console.log('[数据逻辑判断] 用户问题:', question);
    console.log('[数据逻辑判断] 字段:', plotFields);
    console.log('[数据逻辑判断] 判断结果:', content.match(/todo|both|none/)[0]);
    return content.match(/todo|both|none/)[0];
  }
  return 'none';
}

// 智能绘图数据状态判断
async function detectPlotDataStatus(question, plotFields, plotData, model) {
  // 简单用LLM判断
  return 'none';
}

// 智能代码生成agent
async function callCodeGenAgent(systemPrompt, question, model) {
  // 直接用LLM生成代码
  return systemPrompt + '\n# 代码生成示例';
}

// 判断代码块是否有result定义
function hasNoResultDefinition(code) {
  return !/result\s*=/.test(code);
}

// 错误信息提取
function getErrorMsg(e) {
  return e && e.message ? e.message : String(e);
}

// 代码自动执行辅助
async function runCodeWithAutoFieldCheck() {
  // 简化：直接返回null
  return null;
}

/**
 * @description 数据解释agent，输入为用户问题和真实结果，输出一段简明、专业的分析解释
 */
async function answerAgent({ result, question, model, apiKey }) {
  // 精简版：system prompt 只设定角色和风格，user prompt 只描述输入和输出要求
  const prompt = `用户问题：${question}\n分析结果：${JSON.stringify(result, null, 2)}\n请用自然语言给出简明分析。`;
  const res = await callLLMWithRetry({
    model,
    apiKey,
    messages: [
      { role: 'system', content: '你是一名专业的数据分析助手。请根据用户的问题和分析结果，直接用简洁、自然的中文向用户解释和分析数据，不要提及"代码执行"或"后台"等技术细节。' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.3,
    max_tokens: 512
  });
  const content = res.choices[0]?.message?.content || '';
  console.log('[结构化输出] 分析:', content);
  return content;
}

/**
 * @description 提取纯Python代码，去除```python ...```包裹
 * @param {string} content LLM返回内容
 * @returns {string} 纯代码
 */
function extractPurePythonCode(content) {
  const match = content.match(/```python([\s\S]*?)```/);
  return match ? match[1].trim() : content.replace(/```/g, '').trim();
}

// ========== 导出模块 ==========
module.exports = {
  retrieveData: retrieveDataAPI,
  detectIntent: detectIntentAPI,
  askQuestion: askQuestionAPI,
  answer: answerAPI,
  mainAgent,
  callLLM,
  // 其它需要导出的函数...
}; 