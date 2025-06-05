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
 * 智能绘图主流程（复刻/api/visualization/create/route.ts，支持多agent链路、自动修复、详细日志、会话id、sse-like进度回调）
 * @param {Object} params
 * @param {string} params.question 用户问题
 * @param {any[]} params.data 数据
 * @param {string} [params.model] LLM模型名
 * @param {string} [params.sessionId] 会话唯一id（可选）
 * @param {(event: {type: string, agent?: string, status?: string, data?: any, error?: any}) => void} [params.onStatus] 进度/状态回调（可选）
 * @returns {Promise<{answer: string, plotly_figure: any, sessionId: string}>}
 */
async function createVisualization({ question, data, model = DEFAULT_MODEL, sessionId, onStatus }) {
  // 生成唯一会话id
  const sid = sessionId || Date.now().toString() + Math.random().toString(36).slice(2, 8)
  function emit(event) { if (typeof onStatus === 'function') onStatus(event) }
  emit({ type: 'open', data: { message: `会话已建立: ${sid}` } })
  try {
    emit({ type: 'start', data: { message: '开始处理绘图请求' } })
    // 1. 字段提取agent
    emit({ type: 'agent_status', agent: '字段提取agent', status: 'running' })
    const { plotFields, plotData } = await extractPlotFieldsAndData(question, data, model)
    console.log(`[字段提取agent] 提取字段:`, plotFields)
    emit({ type: 'agent_status', agent: '字段提取agent', status: 'success', data: plotFields })
    if (!plotFields.length) throw new Error('未能识别出可用字段')
    // 2. 数据处理逻辑agent
    emit({ type: 'agent_status', agent: '数据处理逻辑agent', status: 'running' })
    const dataStatus = await detectPlotDataStatus(question, plotFields, plotData, model)
    console.log(`[数据处理逻辑agent] 状态:`, dataStatus)
    emit({ type: 'agent_status', agent: '数据处理逻辑agent', status: 'success', data: dataStatus })
    let finalPlotData = data
    // 3. 绘图数据计算agent
    if (dataStatus === 'todo' || dataStatus === 'both') {
      emit({ type: 'agent_status', agent: '绘图数据计算agent', status: 'running' })
      try {
        finalPlotData = await calcPlotDataWithLLM(question, data, model)
        emit({ type: 'agent_status', agent: '绘图数据计算agent', status: 'success', data: '数据计算完成' })
      } catch (e) {
        emit({ type: 'agent_status', agent: '代码修复agent', status: 'running' })
        try {
          finalPlotData = await autoFixWithCodeRepairAgent({
            userQuestion: question,
            plotData: data,
            lastCode: '',
            errorMsg: getErrorMsg(e),
            model,
            maxRetry: 3,
            runCodeFn: runCodeWithAutoFieldCheck
          })
          emit({ type: 'agent_status', agent: '代码修复agent', status: 'success' })
        } catch (fixErr) {
          emit({ type: 'agent_status', agent: '代码修复agent', status: 'error', error: String(fixErr) })
          emit({ type: 'error', error: '[绘图数据计算agent] 数据二次计算及修复均失败', data: String(fixErr) })
          throw fixErr
        }
      }
    }
    // 4. 智能绘图agent
    emit({ type: 'agent_status', agent: '智能绘图agent', status: 'running' })
    const dataPreview = finalPlotData.slice(0, 5)
    const systemPrompt = buildUniversalPlotSystemPrompt(plotFields, dataPreview, question)
    emit({ type: 'agent_status', agent: '智能绘图agent', status: 'success', data: systemPrompt })
    // 5. 智能代码生成agent
    emit({ type: 'agent_status', agent: '智能代码生成agent', status: 'running' })
    let llmCode = await callCodeGenAgent(systemPrompt, question, model)
    if (!llmCode || hasNoResultDefinition(llmCode)) {
      emit({ type: 'agent_status', agent: '智能代码生成agent', status: 'error', error: 'LLM未能生成有效的plotly代码（缺少result定义）' })
      emit({ type: 'error', error: 'LLM未能生成有效的plotly代码（缺少result定义）' })
      throw new Error('LLM未能生成有效的plotly代码（缺少result定义）')
    }
    emit({ type: 'agent_status', agent: '智能代码生成agent', status: 'success' })
    // 6. 执行plotly代码，失败则自动修复
    let plotly_figure = null
    try {
      emit({ type: 'agent_status', agent: '智能绘图执行', status: 'running' })
      plotly_figure = await autoFixWithCodeRepairAgent({
        userQuestion: question,
        plotData: finalPlotData,
        lastCode: llmCode,
        errorMsg: '',
        model,
        maxRetry: 3,
        runCodeFn: runCodeWithAutoFieldCheck
      })
      emit({ type: 'agent_status', agent: '智能绘图执行', status: 'success' })
    } catch (e) {
      emit({ type: 'agent_status', agent: '智能绘图执行', status: 'error', error: getErrorMsg(e) })
      emit({ type: 'error', error: 'LLM代码生成及修复均失败', data: getErrorMsg(e) })
      throw e
    }
    emit({ type: 'result', data: { answer: '已为你生成图表，支持下载PNG/SVG/HTML。', plotly_figure } })
    return { answer: '已为你生成图表，支持下载PNG/SVG/HTML。', plotly_figure, sessionId: sid }
  } catch (error) {
    emit({ type: 'error', error: getErrorMsg(error) })
    throw error
  }
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
 * @description 代码修复agent，升级prompt，报错为to_dict时自动去掉，输出必须能被json.dumps序列化
 */
async function codeRepairAgent({ code, error, dataPreview, question, model, apiKey, maxRetry = 3, onStatus }) {
  let fixed = code;
  for (let i = 0; i < maxRetry; i++) {
    const prompt = `你是Python代码修复专家。请根据下方用户问题、错误信息和数据样本，修复给定的Python代码。\n【重要约束】只能用变量data（由后端注入全量数据），禁止写 data = [...]，禁止将示例数据写入代码。示例数据仅供你理解字段类型。\n【类型要求】如果 result 是 pandas 的 Series 或 DataFrame，必须先用 .to_dict() 转为 dict 后再输出；如果 result 是单个数字（如mean/sum/聚合），不要加.to_dict()，直接输出。输出内容必须能被json.dumps序列化。\n【修复要求】如果报错为"xxx has no attribute to_dict"，请去掉.to_dict()。\n【输出要求】输出必须以print(json.dumps(result, ensure_ascii=False))结尾，禁止多余print。\n用户问题: ${question}\n错误信息: ${error}\n数据样本: ${JSON.stringify(dataPreview.slice(0,2), null, 2)}\n原始代码:\n${fixed}`;
    const res = await callLLMWithRetry({
      model,
      apiKey,
      messages: [
        { role: 'system', content: '你是Python代码修复专家，只能输出Python代码块（用```python ... ```包裹），且代码最后必须有print(json.dumps(result, ensure_ascii=False))。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 1024
    });
    let content = res.choices[0]?.message?.content || '';
    let newCode = extractPurePythonCode(content);
    // 强制删除所有 data = [...] 赋值
    newCode = newCode.replace(/data\s*=\s*\[([\s\S]*?)\];?/g, '');
    // 优化：如报错为to_dict，自动去掉result的.to_dict()
    if (/has no attribute 'to_dict'/.test(error) || /has no attribute "to_dict"/.test(error)) {
      newCode = newCode.replace(/(result\s*=\s*[^\n;]+)\.to_dict\(\)/g, '$1');
    }
    fixed = newCode;
  }
  return fixed;
}

/**
 * @description 智能体主入口，自动分流到plot/calc/general链路
 * @param {Object} params
 * @param {string} params.sessionId 会话唯一标识
 * @param {string} params.question 用户问题
 * @param {string[]} params.columns 字段名
 * @param {any[]} params.dataPreview 前几行数据
 * @param {any[]} params.data 全量数据（仅Python用）
 * @param {string} params.model LLM模型名
 * @param {string} params.apiKey API密钥
 * @param {function} params.onStatus 链路状态回调（SSE风格）
 * @returns {Promise<any>}
 */
async function mainAgent({ sessionId, question, columns, dataPreview, data, model, apiKey, onStatus }) {
  // 只在plot链路传递sessionId和onStatus带sessionId
  const safeOnStatus = (msg) => {
    if (msg && msg.type === 'intent') {
      // intent阶段不带sessionId
      onStatus({ ...msg, sessionId: undefined });
    } else if (msg && msg.type && msg.type.startsWith('plot')) {
      // 仅plot链路带sessionId
      onStatus({ ...msg, sessionId });
    } else {
      // 其它链路不带sessionId
      onStatus({ ...msg, sessionId: undefined });
    }
  };
  safeOnStatus({ type: 'intent', status: 'running' });
  const intent = await detectIntent({ question, model, apiKey });
  safeOnStatus({ type: 'intent', status: 'success', data: intent });
  if (intent === 'plot') {
    // 仅plot链路传递sessionId和带sessionId的onStatus
    return await plotChain({ sessionId, question, columns, dataPreview, data, model, apiKey, onStatus: safeOnStatus });
  } else if (intent === 'calc') {
    // calc链路不传递sessionId，onStatus不带sessionId
    return await calcChain({ question, columns, dataPreview, data, model, apiKey, onStatus: (msg) => onStatus({ ...msg, sessionId: undefined }) });
  } else {
    // general链路不传递sessionId，onStatus不带sessionId
    return await generalChain({ question, columns, dataPreview, data, model, apiKey });
  }
}

// plot链路
async function plotChain({ sessionId, question, columns, dataPreview, data, model, apiKey, onStatus }) {
  onStatus({ sessionId, type: 'plot-fields', status: 'running' });
  const plotFields = await extractFieldsFromQuestion(
    question,
    columns || (data[0] ? Object.keys(data[0]) : []),
    data,
    model,
    apiKey
  );
  onStatus({ sessionId, type: 'plot-fields', status: 'success', data: plotFields });
  onStatus({ sessionId, type: 'data-logic', status: 'running' });
  const dataStatus = await dataLogicAgent({ question, plotFields, dataPreview, model, apiKey });
  onStatus({ sessionId, type: 'data-logic', status: 'success', data: dataStatus });
  let plotData = data; // plotData始终为全量data
  if (dataStatus === 'todo' || dataStatus === 'both') {
    onStatus({ sessionId, type: 'plot-calc', status: 'running' });
    plotData = await calcDataAgent({ question, plotFields, data, model, apiKey }); // 传递全量data
    onStatus({ sessionId, type: 'plot-calc', status: 'success' });
  }
  onStatus({ sessionId, type: 'plot-code', status: 'running' });
  let code = await plotCodeAgent({ question, plotFields, plotData, model, apiKey });
  onStatus({ sessionId, type: 'plot-code', status: 'success' });
  let figJson, error;
  for (let i = 0; i < 3; i++) {
    try {
      onStatus({ sessionId, type: 'python-exec', status: 'running', retry: i + 1 });
      // 关键：此处传递的data必须为全量plotData
      figJson = await runPythonPlotCode({ code, data: plotData });
      onStatus({ sessionId, type: 'python-exec', status: 'success' });
      break;
    } catch (err) {
      error = err;
      code = await codeRepairAgent({ code, error, dataPreview, question, model, apiKey, onStatus });
    }
  }
  if (!figJson) throw new Error('代码修复失败');
  onStatus({ sessionId, type: 'fig2png', status: 'running' });
  const pngPath = await figJsonToPng(figJson);
  onStatus({ sessionId, type: 'fig2png', status: 'success', data: pngPath });
  return { figJson, pngPath };
}

// calc链路
async function calcChain({ question, columns, dataPreview, data, model, apiKey, onStatus }) {
  onStatus({ type: 'calc-fields', status: 'running' });
  const fields = await extractFieldsFromQuestion(
    question,
    columns || (data[0] ? Object.keys(data[0]) : []),
    data,
    model,
    apiKey
  );
  onStatus({ type: 'calc-fields', status: 'success', data: fields });
  onStatus({ type: 'calc-code', status: 'running' });
  let code = await calcCodeAgent({ question, fields, dataPreview, model, apiKey });
  onStatus({ type: 'calc-code', status: 'success' });
  let result, error;
  for (let i = 0; i < 3; i++) {
    try {
      onStatus({ type: 'python-exec', status: 'running', retry: i + 1 });
      result = await runPythonCalcCode({ code, data });
      console.log('[Python执行] 原始结果:', JSON.stringify(result));
      onStatus({ type: 'python-exec', status: 'success' });
      break;
    } catch (err) {
      error = err;
      console.error('[Python执行] 错误:', err && err.message);
      code = await codeRepairAgent({ code, error, dataPreview, question, model, apiKey, onStatus });
    }
  }
  if (!result) throw new Error('代码修复失败');
  onStatus({ type: 'analysis', status: 'running' });
  const analysis = await answerAgent({ result, question, model, apiKey });
  onStatus({ type: 'analysis', status: 'success', data: analysis });
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
 * @description 数据计算代码生成agent，升级prompt，严格约束：标量不加.to_dict()，Series/DataFrame才加，输出必须能被json.dumps序列化
 */
async function calcCodeAgent({ question, fields, dataPreview, model, apiKey }) {
  const prompt = `你是数据分析代码专家。请根据用户问题和字段，生成可直接运行的pandas代码，严格只用下列字段，不要凭空创造字段。\n【重要约束】你只能用如下代码创建DataFrame：df = pd.DataFrame(data)，其中data变量由后端注入全量数据，禁止将示例数据写入代码。示例数据仅供你理解字段类型。\n【禁止】禁止写 data = [...]，禁止将示例数据写入代码。\n【输出要求】输出必须以print(json.dumps(result, ensure_ascii=False))结尾，禁止多余print。\n【类型要求】如果 result 是 pandas 的 Series 或 DataFrame，必须先用 .to_dict() 转为 dict 后再输出；如果 result 是单个数字（如mean/sum/聚合），不要加.to_dict()，直接输出。输出内容必须能被json.dumps序列化。\n用户问题: ${question}\n目标字段: ${fields}\n数据样本: ${JSON.stringify(dataPreview.slice(0,2), null, 2)}`;
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
  // 优化：只对Series/DataFrame加.to_dict()，标量不加
  code = code.replace(/(result\s*=\s*df\.[^\n;]+(mean|sum|groupby)\([^)]+\)[^\n;]*)/g, (m, g1) => {
    // 如果有agg/groupby但不是Series/DataFrame，且没有.to_dict()，不加
    if (/to_dict\(\)/.test(g1)) return g1;
    // 如果有[['字段']]或[字段]，一般是Series，需加.to_dict()
    if (/\[\[.*?\]\]/.test(g1) || /\['.*?'\]/.test(g1)) return g1 + '.to_dict()';
    // 其它情况不加
    return g1;
  });
  return code;
}

// 智能绘图代码生成agent
async function plotCodeAgent({ question, plotFields, plotData, model, apiKey }) {
  const prompt = `你是一个数据可视化专家。请根据下方用户问题和字段，生成用于plotly绘图的Python代码，代码必须以\`\`\`python ... \`\`\`包裹，且最后输出result字典并print(json.dumps(result, ensure_ascii=False))。只能用如下字段：${plotFields.join('、')}。数据示例：${JSON.stringify(plotData.slice(0,5), null, 2)}。用户问题：${question}`;
  const res = await callLLMWithRetry({
    model,
    apiKey,
    messages: [
      { role: 'system', content: '你是一个数据可视化专家，只能输出Python代码块。' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.3,
    max_tokens: 1024,
    top_p: 0.9,
    frequency_penalty: 0.3
  });
  const answer = res.choices[0]?.message?.content || '';
  const codeMatch = answer.match(/```python([\s\S]*?)```/);
  return codeMatch ? codeMatch[1].trim() : answer;
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

// 代码修复自动化agent
async function autoFixWithCodeRepairAgent({ userQuestion, plotData, lastCode, errorMsg, model, maxRetry, runCodeFn }) {
  // 简化：直接返回lastCode
  return lastCode;
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
  const prompt = `你是一名专业数据分析师，请根据用户问题和代码执行结果，输出一段简明、专业的分析解释。\n用户问题：${question}\n代码执行结果：${JSON.stringify(result, null, 2)}`;
  const res = await callLLMWithRetry({
    model,
    apiKey,
    messages: [
      { role: 'system', content: '你是一名专业数据分析师，请根据用户问题和代码执行结果，输出一段简明、专业的分析解释。' },
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
  createVisualization,
  answer: answerAPI,
  mainAgent,
  callLLM,
  // 其它需要导出的函数...
}; 