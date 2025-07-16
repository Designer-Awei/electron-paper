// 可视化助手分割线拖动逻辑，兼容CSP
// JSDoc注释
/**
 * 左侧与画布区分隔条拖动
 */
(function() {
  const leftPanel = document.getElementById('vhLeftPanel');
  const divider = document.getElementById('vhDividerLeft');
  const minWidth = 220;
  const maxWidth = 500;
  let dragging = false;
  let startX = 0;
  let startWidth = 0;
  if (divider && leftPanel) {
    divider.addEventListener('mousedown', function(e) {
      e.preventDefault();
      dragging = true;
      divider.classList.add('active');
      document.body.style.cursor = 'col-resize';
      startX = e.clientX;
      startWidth = leftPanel.offsetWidth;
      document.body.setAttribute('data-resizing', 'true');
    });
    document.addEventListener('mousemove', function(e) {
      if (!dragging) return;
      e.preventDefault();
      let delta = e.clientX - startX;
      let newWidth = startWidth + delta;
      if (newWidth < minWidth) newWidth = minWidth;
      if (newWidth > maxWidth) newWidth = maxWidth;
      leftPanel.style.flex = `0 0 ${newWidth}px`;
      leftPanel.style.width = `${newWidth}px`;
    });
    document.addEventListener('mouseup', function() {
      if (dragging) {
        dragging = false;
        divider.classList.remove('active');
        document.body.style.cursor = '';
        document.body.removeAttribute('data-resizing');
      }
    });
  }
})();

/**
 * 画布区与微调区分隔条拖动
 */
(function() {
  const tuneArea = document.getElementById('vhTuneArea');
  const divider = document.getElementById('vhDividerRight');
  const minWidth = 200;
  const maxWidth = 500;
  let dragging = false;
  let startX = 0;
  let startWidth = 0;
  if (divider && tuneArea) {
    divider.addEventListener('mousedown', function(e) {
      e.preventDefault();
      dragging = true;
      divider.classList.add('active');
      document.body.style.cursor = 'col-resize';
      startX = e.clientX;
      startWidth = tuneArea.offsetWidth;
      document.body.setAttribute('data-resizing', 'true');
    });
    document.addEventListener('mousemove', function(e) {
      if (!dragging) return;
      e.preventDefault();
      let delta = startX - e.clientX;
      let newWidth = startWidth + delta;
      if (newWidth < minWidth) newWidth = minWidth;
      if (newWidth > maxWidth) newWidth = maxWidth;
      tuneArea.style.width = `${newWidth}px`;
    });
    document.addEventListener('mouseup', function() {
      if (dragging) {
        dragging = false;
        divider.classList.remove('active');
        document.body.style.cursor = '';
        document.body.removeAttribute('data-resizing');
      }
    });
  }
})();

/**
 * 左侧面板分区横向分割线拖动（百分比高度，flex-basis调整）
 * @description 拖动分割线时动态调整flex-basis百分比，保证总高度不变
 */
(function() {
  const uploadArea = document.getElementById('vhUploadArea');
  const dividerTop = document.getElementById('vhLeftDividerTop');
  const historyDiv = document.getElementById('vhLeftHistory');
  const dividerBottom = document.getElementById('vhLeftDividerBottom');
  const inputArea = document.getElementById('vhLeftInputArea');
  const leftFlex = document.querySelector('.vh-left-flex');
  if (!uploadArea || !dividerTop || !historyDiv || !dividerBottom || !inputArea || !leftFlex) return;

  // 获取当前百分比
  function getPercents() {
    const total = leftFlex.clientHeight;
    const upload = uploadArea.offsetHeight;
    const history = historyDiv.offsetHeight;
    const input = inputArea.offsetHeight;
    return {
      upload: (upload / total) * 100,
      history: (history / total) * 100,
      input: (input / total) * 100
    };
  }
  // 设置百分比
  function setPercents(upload, history, input) {
    uploadArea.style.flexBasis = upload + '%';
    historyDiv.style.flexBasis = history + '%';
    inputArea.style.flexBasis = input + '%';
  }
  // 拖动顶部分割线
  let draggingTop = false;
  let startYTop = 0;
  let startUploadPercent = 0;
  let startHistoryPercent = 0;
  dividerTop.addEventListener('mousedown', function(e) {
    e.preventDefault();
    draggingTop = true;
    dividerTop.classList.add('active');
    document.body.style.cursor = 'row-resize';
    startYTop = e.clientY;
    const percents = getPercents();
    startUploadPercent = percents.upload;
    startHistoryPercent = percents.history;
    document.body.setAttribute('data-resizing', 'true');
  });
  document.addEventListener('mousemove', function(e) {
    if (!draggingTop) return;
    e.preventDefault();
    const total = leftFlex.clientHeight;
    const delta = ((e.clientY - startYTop) / total) * 100;
    let newUpload = startUploadPercent + delta;
    let newHistory = startHistoryPercent - delta;
    // 限制最小高度百分比
    if (newUpload < 8) { newHistory += newUpload - 8; newUpload = 8; }
    if (newHistory < 8) { newUpload += newHistory - 8; newHistory = 8; }
    const percents = getPercents();
    setPercents(newUpload, newHistory, percents.input);
  });
  document.addEventListener('mouseup', function() {
    if (draggingTop) {
      draggingTop = false;
      dividerTop.classList.remove('active');
      document.body.style.cursor = '';
      document.body.removeAttribute('data-resizing');
    }
  });
  // 拖动底部分割线
  let draggingBottom = false;
  let startYBottom = 0;
  let startHistoryPercent2 = 0;
  let startInputPercent = 0;
  dividerBottom.addEventListener('mousedown', function(e) {
    e.preventDefault();
    draggingBottom = true;
    dividerBottom.classList.add('active');
    document.body.style.cursor = 'row-resize';
    startYBottom = e.clientY;
    const percents = getPercents();
    startHistoryPercent2 = percents.history;
    startInputPercent = percents.input;
    document.body.setAttribute('data-resizing', 'true');
  });
  document.addEventListener('mousemove', function(e) {
    if (!draggingBottom) return;
    e.preventDefault();
    const total = leftFlex.clientHeight;
    const delta = ((e.clientY - startYBottom) / total) * 100;
    let newHistory = startHistoryPercent2 + delta;
    let newInput = startInputPercent - delta;
    if (newHistory < 8) { newInput += newHistory - 8; newHistory = 8; }
    if (newInput < 8) { newHistory += newInput - 8; newInput = 8; }
    const percents = getPercents();
    setPercents(percents.upload, newHistory, newInput);
  });
  document.addEventListener('mouseup', function() {
    if (draggingBottom) {
      draggingBottom = false;
      dividerBottom.classList.remove('active');
      document.body.style.cursor = '';
      document.body.removeAttribute('data-resizing');
    }
  });

  // 设置最大高度和滚动条样式
  uploadArea.style.overflowY = 'auto';
  uploadArea.style.maxHeight = 'calc(100vh - 120px)'; // 120px为预留顶部空间，可根据实际调整
  uploadArea.style.minHeight = '172px';
})();

/**
 * 可视化助手左侧图表生成区对话功能（重构：统一走dataAgent主流程，保留对话记忆和代码块渲染）
 * 支持：发送按钮/回车发送，用户消息右侧绿色气泡，助手回复左侧白色气泡，自动滚动，代码块可复制
 * @author AI
 */
(function() {
  // 全局对话历史
  let messages = [
    { role: 'system', content: '你是可视化助手，帮助用户生成和微调数据图表。' }
  ];
  // 全局数据缓存
  let columns = [];
  let dataPreview = [];
  let data = [];
  let model = '';
  let apiKey = '';

  // 在模块顶部声明全局变量
  let dataAgentResultListener = null;
  let dataAgentErrorListener = null;

  // DOM元素
  const inputArea = document.querySelector('#vhLeftInputArea .vh-input');
  const sendBtn = document.querySelector('#vhLeftInputArea .vh-send-btn');
  const historyArea = document.getElementById('vhLeftHistory');
  const canvasImg = document.getElementById('mainCanvasImg'); // 假设画布区有img标签
  if (!inputArea || !sendBtn || !historyArea) return;

  /**
   * 解析上传数据，提取字段名和预览数据
   * @param {Array} jsonData 上传后的二维数组或对象数组
   */
  function handleUploadData(jsonData) {
    if (!jsonData || !jsonData.length) return;
    if (Array.isArray(jsonData[0])) {
      // csv/excel二维数组
      columns = jsonData[0];
      dataPreview = jsonData.slice(1, 6).map(row => {
        const obj = {};
        columns.forEach((col, i) => obj[col] = row[i]);
        return obj;
      });
      data = jsonData.slice(1).map(row => {
        const obj = {};
        columns.forEach((col, i) => obj[col] = row[i]);
        return obj;
      });
    } else {
      // 对象数组
      columns = Object.keys(jsonData[0]);
      dataPreview = jsonData.slice(0, 5);
      data = jsonData;
    }
    
    // 存储数据到全局变量，供导出功能使用
    window._visualHelperUploadedData = {
      columns,
      dataPreview,
      data
    };
  }
  // 假设有上传/解析回调
  window.onVisualHelperDataUpload = handleUploadData;

  /**
   * 获取系统设置页的对话&绘图模型和API Key
   */
  async function getModelAndApiKey() {
    const modelSel = document.getElementById('settingsChatModelSelection');
    model = modelSel ? modelSel.value : '';
    apiKey = await window.electronAPI.getApiKey();
    if (!apiKey) apiKey = '';
  }

  /**
   * 渲染用户消息气泡
   * @param {string} text 用户输入内容
   */
  function renderUserMessage(text) {
    const div = document.createElement('div');
    div.className = 'vh-user-message';
    div.textContent = text;
    historyArea.appendChild(div);
    historyArea.scrollTop = historyArea.scrollHeight;
  }

  /**
   * 去除常见markdown强调符号，仅保留纯文本
   * @param {string} md
   * @returns {string}
   */
  function stripMarkdown(md) {
    if (!md) return '';
    // 去除加粗/斜体/下划线
    let text = md.replace(/(\*\*|__)(.*?)\1/g, '$2');
    text = text.replace(/(\*|_)(.*?)\1/g, '$2');
    // 去除标题（#）
    text = text.replace(/^#+\s*/gm, '');
    // 去除引用符号
    text = text.replace(/^>\s*/gm, '');
    // 去除无序/有序列表符号
    text = text.replace(/^\s*([-*+]|\d+\.)\s+/gm, '');
    // 去除多余空行
    text = text.replace(/\n{3,}/g, '\n\n');
    return text;
  }

  /**
   * 渲染助手消息气泡（分离渲染多行代码块与内联代码，参考文献助手addMessage实现）
   * @param {string} text 助手回复内容（markdown）
   */
  function renderBotMessage(text) {
    // 新增日志输出
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const preview = (text || '').length > 200 ? (text.slice(0, 200) + '...') : text;
    console.log(`[图表生成助手] 回复输出（${hh}:${mm}:${ss}）：${preview}`);
    const div = document.createElement('div');
    div.className = 'vh-bot-message';
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    // 先去除markdown强调符号
    const cleanedText = stripMarkdown(text.trim());
    const trimmedText = cleanedText;
    // 1. 优先处理多行代码块
    const codeBlockRegex = /```([a-zA-Z]*)\n([\s\S]*?)```/g;
    const inlineCodeRegex = /`([^`]+)`/g;
    let lastIndex = 0;
    let match;
    let hasCodeBlock = false;
    // 处理多行代码块
    while ((match = codeBlockRegex.exec(trimmedText)) !== null) {
      hasCodeBlock = true;
      // 代码块前的普通文本
      if (match.index > lastIndex) {
        const textBefore = trimmedText.substring(lastIndex, match.index);
        // 处理内联代码
        if (inlineCodeRegex.test(textBefore)) {
          let inlineLastIndex = 0;
          let inlineMatch;
          let textContent = '';
          inlineCodeRegex.lastIndex = 0;
          while ((inlineMatch = inlineCodeRegex.exec(textBefore)) !== null) {
            if (inlineMatch.index > inlineLastIndex) {
              textContent += textBefore.substring(inlineLastIndex, inlineMatch.index);
            }
            textContent += `<span class="inline-code">${inlineMatch[1]}</span>`;
            inlineLastIndex = inlineMatch.index + inlineMatch[0].length;
          }
          if (inlineLastIndex < textBefore.length) {
            textContent += textBefore.substring(inlineLastIndex);
          }
          const textNode = document.createElement('div');
          textNode.innerHTML = textContent;
          messageContent.appendChild(textNode);
        } else {
          const textNode = document.createElement('div');
          textNode.textContent = textBefore;
          messageContent.appendChild(textNode);
        }
      }
      // 代码块本体
      const codeContainer = document.createElement('div');
      codeContainer.className = 'code-block-container';
      const codeHeader = document.createElement('div');
      codeHeader.className = 'code-block-header';
      const languageSpan = document.createElement('span');
      languageSpan.className = 'code-language';
      const language = match[1].trim() || '代码';
      languageSpan.textContent = language;
      codeHeader.appendChild(languageSpan);
      // 复制按钮
      const copyButton = document.createElement('button');
      copyButton.className = 'copy-code-button';
      copyButton.textContent = '复制';
      const codeTextToCopy = match[2];
      copyButton.onclick = function() {
        if (window.electronAPI && window.electronAPI.copyToClipboard) {
          window.electronAPI.copyToClipboard(codeTextToCopy)
            .then(() => {
              copyButton.textContent = '已复制';
              setTimeout(() => { copyButton.textContent = '复制'; }, 2000);
            })
            .catch(err => {
              console.error('复制失败:', err);
              copyButton.textContent = '复制失败';
              setTimeout(() => { copyButton.textContent = '复制'; }, 2000);
            });
        } else {
          // 回退方案
          try {
            const textArea = document.createElement('textarea');
            textArea.value = codeTextToCopy;
            textArea.style.position = 'fixed';
            textArea.style.left = '-9999px';
            textArea.style.top = '-9999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            if (successful) {
              copyButton.textContent = '已复制';
            } else {
              copyButton.textContent = '复制失败';
            }
            setTimeout(() => { copyButton.textContent = '复制'; }, 2000);
          } catch (err) {
            console.error('复制失败:', err);
            copyButton.textContent = '复制失败';
            setTimeout(() => { copyButton.textContent = '复制'; }, 2000);
          }
        }
      };
      codeHeader.appendChild(copyButton);
      codeContainer.appendChild(codeHeader);
      // 代码块内容
      const codeBlock = document.createElement('pre');
      const code = document.createElement('code');
      if (language && language !== '代码') {
        code.className = `language-${language}`;
      }
      code.textContent = match[2];
      codeBlock.appendChild(code);
      codeContainer.appendChild(codeBlock);
      messageContent.appendChild(codeContainer);
      lastIndex = match.index + match[0].length;
    }
    // 处理最后一段剩余文本
    if (lastIndex < trimmedText.length) {
      const remainingText = trimmedText.substring(lastIndex);
      if (inlineCodeRegex.test(remainingText)) {
        let inlineLastIndex = 0;
        let inlineMatch;
        let textContent = '';
        inlineCodeRegex.lastIndex = 0;
        while ((inlineMatch = inlineCodeRegex.exec(remainingText)) !== null) {
          if (inlineMatch.index > inlineLastIndex) {
            textContent += remainingText.substring(inlineLastIndex, inlineMatch.index);
          }
          textContent += `<span class="inline-code">${inlineMatch[1]}</span>`;
          inlineLastIndex = inlineMatch.index + inlineMatch[0].length;
        }
        if (inlineLastIndex < remainingText.length) {
          textContent += remainingText.substring(inlineLastIndex);
        }
        const textNode = document.createElement('div');
        textNode.innerHTML = textContent;
        messageContent.appendChild(textNode);
      } else {
        const textNode = document.createElement('div');
        textNode.textContent = remainingText;
        messageContent.appendChild(textNode);
      }
    }
    // 如果没有代码块但有内联代码，直接用span渲染内联代码
    if (!hasCodeBlock && inlineCodeRegex.test(trimmedText)) {
      let inlineLastIndex = 0;
      let inlineMatch;
      let textContent = '';
      inlineCodeRegex.lastIndex = 0;
      while ((inlineMatch = inlineCodeRegex.exec(trimmedText)) !== null) {
        if (inlineMatch.index > inlineLastIndex) {
          textContent += trimmedText.substring(inlineLastIndex, inlineMatch.index);
        }
        textContent += `<span class="inline-code">${inlineMatch[1]}</span>`;
        inlineLastIndex = inlineMatch.index + inlineMatch[0].length;
      }
      if (inlineLastIndex < trimmedText.length) {
        textContent += trimmedText.substring(inlineLastIndex);
      }
      messageContent.innerHTML = textContent;
    }
    div.appendChild(messageContent);
    historyArea.appendChild(div);
    historyArea.scrollTop = historyArea.scrollHeight;
  }

  /**
   * 摘要前3轮对话（6条消息）
   * @param {Array} msgList
   * @param {string} model
   * @returns {Promise<string>} 摘要内容
   */
  async function summarizeHistory(msgList, model) {
    // 只摘要前6条（3轮）
    const summaryPrompt = [
      { role: 'system', content: '请用简洁中文总结以下对话内容，便于后续AI理解用户需求：' },
      ...msgList.slice(1, 7)
    ];
    // 这里直接用dataAgent的callLLM
    const summary = await window.electronAPI.runDataAgentSummary(summaryPrompt, model, apiKey);
    return summary;
  }

  /**
   * 发送消息主流程，带摘要记忆，统一走dataAgent
   * 注意：发送给意图识别等agent的question参数始终为最新用户输入，不附带历史记忆
   */
  async function handleSend() {
    const text = inputArea.value.trim();
    if (!text) return;
    renderUserMessage(text);
    inputArea.value = '';
    inputArea.disabled = true;
    renderBotMessage('助手正在思考...');
    historyArea.scrollTop = historyArea.scrollHeight;
    await getModelAndApiKey();
    // 追加用户消息到历史
    messages.push({ role: 'user', content: text });
    // 检查apiKey
    if (!apiKey) {
      // 移除"助手正在思考..."气泡
      const botMessages = historyArea.querySelectorAll('.vh-bot-message');
      botMessages.forEach(msg => { if (msg.textContent === '助手正在思考...') msg.remove(); });
      renderBotMessage('请先在系统设置中配置SiliconFlow API密钥。');
      inputArea.disabled = false;
      inputArea.focus();
      historyArea.scrollTop = historyArea.scrollHeight;
      return;
    }
    // 超过3轮（6条+system=7）自动摘要
    if (messages.length > 7) {
      const summary = await summarizeHistory(messages, model);
      // 用摘要替换前6条
      messages = [
        messages[0],
        { role: 'user', content: '对话摘要：' + summary },
        ...messages.slice(7)
      ];
    }
    // 发送前彻底移除所有监听器，防止多次注册
    if (window.electronAPI.removeAllDataAgentListeners) {
      window.electronAPI.removeAllDataAgentListeners();
    }
    // 只传递最新用户输入给智能体主流程（如意图识别agent等）
    window.electronAPI.runDataAgent({
      question: text, // 始终为最新用户输入
      columns,
      dataPreview,
      data,
      model,
      apiKey
    });
    // 监听链路状态
    window.electronAPI.onDataAgentStatus(function(msg) {
      // 可根据msg.type/status渲染进度
    });
    // 注册新的监听器
    dataAgentResultListener = function({ figJson, pngPath, result, analysis, answer }) {
      // 移除"助手正在思考..."气泡
      const lastBot = historyArea.querySelector('.vh-bot-message:last-child');
      if (lastBot && lastBot.textContent === '助手正在思考...') {
        lastBot.remove();
      }
      if (pngPath) {
        // 渲染到画布
        if (canvasImg) canvasImg.src = 'file://' + pngPath;
        window.currentFigJson = figJson;
        renderBotMessage('已为你生成图表，支持下载PNG/SVG/HTML。');
      } else if (analysis) {
        renderBotMessage(analysis);
      } else if (answer) {
        renderBotMessage(answer);
      } else if (result) {
        renderBotMessage(JSON.stringify(result));
      }
      // 追加助手回复到历史
      if (analysis) {
        messages.push({ role: 'assistant', content: analysis });
      } else if (answer) {
        messages.push({ role: 'assistant', content: answer });
      }
      inputArea.disabled = false;
      inputArea.focus();
      historyArea.scrollTop = historyArea.scrollHeight;
      // 监听到一次后立即移除监听器
      if (window.electronAPI.removeAllDataAgentListeners) {
        window.electronAPI.removeAllDataAgentListeners();
      }
      dataAgentResultListener = null;
    };
    window.electronAPI.onDataAgentResult(dataAgentResultListener);
    window.electronAPI.__vhResultListener = dataAgentResultListener;
    dataAgentErrorListener = function({ error }) {
      // 移除所有"助手正在思考..."气泡
      const botMessages = historyArea.querySelectorAll('.vh-bot-message');
      botMessages.forEach(msg => {
        if (msg.textContent === '助手正在思考...') msg.remove();
      });
      // 检查是否已存在错误气泡，避免重复渲染
      const lastBot = historyArea.querySelector('.vh-bot-message:last-child');
      if (lastBot && lastBot.textContent && lastBot.textContent.startsWith('智能体链路出错：')) {
        // 已有错误气泡，不再重复渲染
        inputArea.disabled = false;
        inputArea.focus();
        historyArea.scrollTop = historyArea.scrollHeight;
        return;
      }
      renderBotMessage('智能体链路出错：' + error);
      inputArea.disabled = false;
      inputArea.focus();
      historyArea.scrollTop = historyArea.scrollHeight;
      if (window.electronAPI.removeAllDataAgentListeners) {
        window.electronAPI.removeAllDataAgentListeners();
      }
      dataAgentErrorListener = null;
    };
    window.electronAPI.onDataAgentError(dataAgentErrorListener);
    window.electronAPI.__vhErrorListener = dataAgentErrorListener;
  }

  // 发送按钮事件
  sendBtn.addEventListener('click', handleSend);
  // 回车发送
  inputArea.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  // 清空对话时重置messages
  const clearBtns = Array.from(document.querySelectorAll('button.secondary-button'));
  const clearBtn = clearBtns.find(btn => btn.textContent.trim() === '清空对话');
  if (clearBtn) {
    clearBtn.addEventListener('click', function() {
      messages = [
        { role: 'system', content: '你是可视化助手，帮助用户生成和微调数据图表。' }
      ];
      historyArea.innerHTML = '';
      const div = document.createElement('div');
      div.className = 'vh-bot-message';
      div.textContent = '你好，我是可视化助手，请告诉我你的绘图需求~';
      historyArea.appendChild(div);
      historyArea.scrollTop = 0;
    });
  }
})();

/**
 * 数据上传与预览区：支持csv/excel文件拖拽和点击上传，解析后预览前10行
 */
(function() {
  const dropZone = document.getElementById('vhUploadDropZone');
  const preview = document.getElementById('vhUploadPreview');
  if (!dropZone || !preview || !window.XLSX) return;

  // 拖拽样式
  dropZone.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.style.borderColor = '#1976d2';
    dropZone.style.background = '#e3f2fd';
    dropZone.style.color = '#1976d2';
  });
  dropZone.addEventListener('dragleave', e => {
    e.preventDefault();
    dropZone.style.borderColor = '#bbb';
    dropZone.style.background = '#fff';
    dropZone.style.color = '#888';
  });
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.style.borderColor = '#bbb';
    dropZone.style.background = '#fff';
    dropZone.style.color = '#888';
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });
  // 点击上传
  dropZone.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.xls,.xlsx';
    input.onchange = e => {
      if (input.files && input.files[0]) handleFile(input.files[0]);
    };
    input.click();
  });

  /**
   * 解析文件并渲染预览
   * @param {File} file
   */
  function handleFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        let json;
        
        if (file.name.endsWith('.csv')) {
          // 对于CSV文件，使用UTF-8编码读取
          const csvContent = e.target.result;
          // 使用XLSX库解析CSV
          const workbook = window.XLSX.read(csvContent, { type: 'string', raw: true });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          json = window.XLSX.utils.sheet_to_json(sheet, { header: 1 });
        } else {
          // Excel文件使用二进制方式读取
          const data = new Uint8Array(e.target.result);
          const workbook = window.XLSX.read(data, { type: 'array' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          json = window.XLSX.utils.sheet_to_json(sheet, { header: 1 });
        }
        
        renderPreview(json, file.name);
        // 上传成功后缩小上传框高度
        dropZone.style.height = '80px';
        // 关键：通知全局数据已上传
        window.onVisualHelperDataUpload(json);
      } catch (err) {
        preview.innerHTML = `<div style='color:#c00;padding:8px;'>文件解析失败: ${err.message}</div>`;
        dropZone.style.height = '140px';
      }
    };
    reader.onerror = function() {
      preview.innerHTML = `<div style='color:#c00;padding:8px;'>文件读取失败</div>`;
      dropZone.style.height = '140px';
    };
    
    // 根据文件类型选择不同的读取方式
    if (file.name.endsWith('.csv')) {
      reader.readAsText(file, 'utf-8'); // 使用UTF-8编码读取CSV文件
    } else {
      reader.readAsArrayBuffer(file); // 二进制读取Excel文件
    }
  }
  
  // 将handleFile函数暴露为全局函数，以便在导入项目时能够直接调用
  window.handleVisualHelperFile = handleFile;

  /**
   * 渲染表格预览，含删除按钮
   * @param {Array} json 二维数组
   * @param {string} fileName 文件名
   */
  function renderPreview(json, fileName) {
    if (!json || !json.length) {
      preview.innerHTML = `<div style='color:#c00;padding:8px;'>未解析到有效数据</div>`;
      dropZone.style.height = '140px';
      return;
    }
    const header = json[0];
    const rows = json.slice(1, 11); // 前10行
    let html = `<div style='display:flex;align-items:center;justify-content:space-between;font-size:14px;color:#1976d2;margin-bottom:6px;'>`;
    html += `<span style='max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block;vertical-align:middle;'>${fileName} 预览</span>`;
    html += `<button id='vhUploadRemoveBtn' style='font-size:13px;color:#fff;background:#1976d2;border:none;border-radius:6px;padding:2px 16px;cursor:pointer;white-space:nowrap;line-height:1.8;min-width:44px;box-shadow:0 1px 2px rgba(0,0,0,0.04);transition:background 0.2s;'>删除</button>`;
    html += `</div>`;
    // 计算表格最小宽度，避免字段重叠
    const minTableWidth = Math.max(header.length * 60, 480);
    html += `<div style='overflow-x:auto;overflow-y:auto;max-height:220px;'><table style='border-collapse:collapse;width:auto;min-width:${minTableWidth}px;font-size:13px;background:#fff;'>`;
    html += '<thead><tr>' + header.map(h => `<th style='border:1px solid #eee;padding:4px 8px;background:#f5f5f5;min-width:60px;max-width:120px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'>${h}</th>`).join('') + '</tr></thead>';
    html += '<tbody>' + rows.map(row => '<tr>' + header.map((_,i) => `<td style='border:1px solid #eee;padding:4px 8px;min-width:60px;max-width:120px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'>${row[i] ?? ''}</td>`).join('') + '</tr>').join('') + '</tbody>';
    html += '</table></div>';
    if (json.length > 11) html += `<div style='color:#888;font-size:12px;margin-top:4px;'>共${json.length-1}行，仅显示前10行</div>`;
    preview.innerHTML = html;
    // 删除按钮事件
    const removeBtn = document.getElementById('vhUploadRemoveBtn');
    if (removeBtn) {
      removeBtn.onclick = function() {
        preview.innerHTML = '';
        dropZone.style.height = '140px';
      };
    }
  }
})();

/**
 * 图表微调区右侧对话功能（无记忆，每次只发单轮，气泡样式与左侧一致）
 * 支持：发送按钮/回车发送，用户消息右侧绿色气泡，助手回复左侧白色气泡，自动滚动，代码块可复制
 */
(function() {
  // DOM元素
  const inputArea = document.querySelector('#vhTuneInputArea .vh-input');
  const sendBtn = document.querySelector('#vhTuneInputArea .vh-send-btn');
  const historyArea = document.getElementById('vhTuneHistory');
  const clearBtn = Array.from(document.querySelectorAll('#vhTuneArea .secondary-button'))
    .find(btn => btn.textContent.trim() === '清空对话');
  if (!inputArea || !sendBtn || !historyArea) return;

  // 获取模型和API Key（与左侧一致）
  async function getModelAndApiKey() {
    const modelSel = document.getElementById('settingsChatModelSelection');
    const model = modelSel ? modelSel.value : '';
    const apiKey = await window.electronAPI.getApiKey();
    return { model, apiKey: apiKey || '' };
  }

  // 渲染用户气泡
  function renderUserMessage(text) {
    const div = document.createElement('div');
    div.className = 'vh-user-message';
    div.textContent = text;
    historyArea.appendChild(div);
    historyArea.scrollTop = historyArea.scrollHeight;
  }

  // 渲染助手气泡（支持代码块、复制按钮，复用stripMarkdown/代码块渲染逻辑）
  function stripMarkdown(md) {
    if (!md) return '';
    let text = md.replace(/(\*\*|__)(.*?)\1/g, '$2');
    text = text.replace(/(\*|_)(.*?)\1/g, '$2');
    text = text.replace(/^#+\s*/gm, '');
    text = text.replace(/^>\s*/gm, '');
    text = text.replace(/^\s*([-*+]|\d+\.)\s+/gm, '');
    text = text.replace(/\n{3,}/g, '\n\n');
    return text;
  }
  function renderBotMessage(text) {
    const div = document.createElement('div');
    div.className = 'vh-bot-message';
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    const cleanedText = stripMarkdown(text.trim());
    const codeBlockRegex = /```([a-zA-Z]*)\n([\s\S]*?)```/g;
    const inlineCodeRegex = /`([^`]+)`/g;
    let lastIndex = 0, match, hasCodeBlock = false;
    while ((match = codeBlockRegex.exec(cleanedText)) !== null) {
      hasCodeBlock = true;
      if (match.index > lastIndex) {
        const textBefore = cleanedText.substring(lastIndex, match.index);
        if (inlineCodeRegex.test(textBefore)) {
          let inlineLastIndex = 0, inlineMatch, textContent = '';
          inlineCodeRegex.lastIndex = 0;
          while ((inlineMatch = inlineCodeRegex.exec(textBefore)) !== null) {
            if (inlineMatch.index > inlineLastIndex) {
              textContent += textBefore.substring(inlineLastIndex, inlineMatch.index);
            }
            textContent += `<span class="inline-code">${inlineMatch[1]}</span>`;
            inlineLastIndex = inlineMatch.index + inlineMatch[0].length;
          }
          if (inlineLastIndex < textBefore.length) {
            textContent += textBefore.substring(inlineLastIndex);
          }
          const textNode = document.createElement('div');
          textNode.innerHTML = textContent;
          messageContent.appendChild(textNode);
        } else {
          const textNode = document.createElement('div');
          textNode.textContent = textBefore;
          messageContent.appendChild(textNode);
        }
      }
      // 代码块本体
      const codeContainer = document.createElement('div');
      codeContainer.className = 'code-block-container';
      const codeHeader = document.createElement('div');
      codeHeader.className = 'code-block-header';
      const languageSpan = document.createElement('span');
      languageSpan.className = 'code-language';
      const language = match[1].trim() || '代码';
      languageSpan.textContent = language;
      codeHeader.appendChild(languageSpan);
      // 复制按钮
      const copyButton = document.createElement('button');
      copyButton.className = 'copy-code-button';
      copyButton.textContent = '复制';
      const codeTextToCopy = match[2];
      copyButton.onclick = function() {
        if (window.electronAPI && window.electronAPI.copyToClipboard) {
          window.electronAPI.copyToClipboard(codeTextToCopy)
            .then(() => {
              copyButton.textContent = '已复制';
              setTimeout(() => { copyButton.textContent = '复制'; }, 2000);
            })
            .catch(err => {
              copyButton.textContent = '复制失败';
              setTimeout(() => { copyButton.textContent = '复制'; }, 2000);
            });
        }
      };
      codeHeader.appendChild(copyButton);
      codeContainer.appendChild(codeHeader);
      const pre = document.createElement('pre');
      pre.textContent = codeTextToCopy;
      codeContainer.appendChild(pre);
      messageContent.appendChild(codeContainer);
      lastIndex = match.index + match[0].length;
    }
    if (!hasCodeBlock) {
      // 处理内联代码
      let textContent = '';
      let inlineLastIndex = 0, inlineMatch;
      inlineCodeRegex.lastIndex = 0;
      while ((inlineMatch = inlineCodeRegex.exec(cleanedText)) !== null) {
        if (inlineMatch.index > inlineLastIndex) {
          textContent += cleanedText.substring(inlineLastIndex, inlineMatch.index);
        }
        textContent += `<span class=\"inline-code\">${inlineMatch[1]}</span>`;
        inlineLastIndex = inlineMatch.index + inlineMatch[0].length;
      }
      if (inlineLastIndex < cleanedText.length) {
        textContent += cleanedText.substring(inlineLastIndex);
      }
      const textNode = document.createElement('div');
      textNode.innerHTML = textContent;
      messageContent.appendChild(textNode);
    }
    div.appendChild(messageContent);
    historyArea.appendChild(div);
    historyArea.scrollTop = historyArea.scrollHeight;
  }

  // 发送消息
  async function handleSend() {
    const text = inputArea.value.trim();
    if (!text) return;
    renderUserMessage(text);
    inputArea.value = '';
    inputArea.disabled = true;
    renderBotMessage('助手正在思考...');
    historyArea.scrollTop = historyArea.scrollHeight;
    const { model, apiKey } = await getModelAndApiKey();
    if (!apiKey) {
      // 移除思考气泡
      const botMessages = historyArea.querySelectorAll('.vh-bot-message');
      botMessages.forEach(msg => { if (msg.textContent === '助手正在思考...') msg.remove(); });
      renderBotMessage('请先在系统设置中配置SiliconFlow API密钥。');
      inputArea.disabled = false;
      inputArea.focus();
      historyArea.scrollTop = historyArea.scrollHeight;
      return;
    }
    // 只发单轮，无记忆
    window.electronAPI.runDataAgent({
      question: text,
      columns: [],
      dataPreview: [],
      data: [],
      model,
      apiKey
    });
    window.electronAPI.onDataAgentResult(function({ analysis, answer, result }) {
      // 移除思考气泡
      const lastBot = historyArea.querySelector('.vh-bot-message:last-child');
      if (lastBot && lastBot.textContent === '助手正在思考...') lastBot.remove();
      if (analysis) renderBotMessage(analysis);
      else if (answer) renderBotMessage(answer);
      else if (result) renderBotMessage(JSON.stringify(result));
      inputArea.disabled = false;
      inputArea.focus();
      historyArea.scrollTop = historyArea.scrollHeight;
      window.electronAPI.removeAllDataAgentListeners && window.electronAPI.removeAllDataAgentListeners();
    });
    window.electronAPI.onDataAgentError(function({ error }) {
      // 移除思考气泡
      const botMessages = historyArea.querySelectorAll('.vh-bot-message');
      botMessages.forEach(msg => { if (msg.textContent === '助手正在思考...') msg.remove(); });
      renderBotMessage('智能体链路出错：' + error);
      inputArea.disabled = false;
      inputArea.focus();
      historyArea.scrollTop = historyArea.scrollHeight;
      window.electronAPI.removeAllDataAgentListeners && window.electronAPI.removeAllDataAgentListeners();
    });
  }

  // 发送按钮/回车发送
  sendBtn.addEventListener('click', handleSend);
  inputArea.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  // 清空对话
  if (clearBtn) {
    clearBtn.addEventListener('click', function() {
      historyArea.innerHTML = '';
      const div = document.createElement('div');
      div.className = 'vh-bot-message';
      div.textContent = '你好，我是图表微调助手，可以根据你的输入，修改画布中被选中的图表代码。';
      historyArea.appendChild(div);
      historyArea.scrollTop = 0;
    });
  }
})();

// 右侧微调区气泡样式修正，插入全局样式
(function() {
  const style = document.createElement('style');
  style.innerHTML = `
  #vhTuneHistory {
    display: flex;
    flex-direction: column;
    align-items: stretch;
  }
  #vhTuneHistory .vh-bot-message,
  #vhTuneHistory .vh-user-message {
    display: inline-block;
    max-width: 75%;
  }
  #vhTuneHistory .vh-bot-message {
    align-self: flex-start;
    background: #fff;
    color: #222;
    border-radius: 12px 12px 12px 0;
    padding: 10px 15px;
    margin-bottom: 10px;
    font-size: 15px;
    line-height: 1.6;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    text-align: justify;
    word-break: break-word;
    border: 1px solid #e0e0e0;
    margin-left: 0;
    margin-right: auto;
  }
  #vhTuneHistory .vh-user-message {
    align-self: flex-end;
    background: #1aad19;
    color: #fff;
    border-radius: 12px 12px 0 12px;
    padding: 10px 15px;
    margin-bottom: 10px;
    font-size: 15px;
    line-height: 1.6;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    text-align: justify;
    word-break: break-word;
    border: 1px solid #c6e5b1;
    margin-right: 0;
    margin-left: auto;
  }
  `;
  document.head.appendChild(style);
})(); 