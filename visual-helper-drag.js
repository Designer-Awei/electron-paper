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
  uploadArea.style.minHeight = '180px';
})();

/**
 * 可视化助手左侧图表生成区对话功能
 * 支持：发送按钮/回车发送，用户消息右侧绿色气泡，助手回复左侧白色气泡，自动滚动
 * @author AI
 */
(function() {
  // 全局对话历史
  let messages = [
    { role: 'system', content: '你是可视化助手，帮助用户生成和微调数据图表。' }
  ];

  // 获取开场介绍内容
  const opening = '你好，我是可视化助手，请告诉我你的绘图需求~';

  // DOM元素
  const inputArea = document.querySelector('#vhLeftInputArea .vh-input');
  const sendBtn = document.querySelector('#vhLeftInputArea .vh-send-btn');
  const historyArea = document.getElementById('vhLeftHistory');
  if (!inputArea || !sendBtn || !historyArea) return;

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
   * 渲染助手消息气泡（支持markdown和代码块，完全参考文献助手）
   * @param {string} text 助手回复内容（markdown）
   */
  function renderBotMessage(text) {
    const div = document.createElement('div');
    div.className = 'vh-bot-message';
    // 代码块正则
    const codeBlockRegex = /```([a-zA-Z0-9]*)\n([\s\S]*?)```/g;
    const inlineCodeRegex = /`([^`]+)`/g;
    let lastIndex = 0;
    let match;
    let hasCodeBlock = false;
    // 处理多行代码块
    while ((match = codeBlockRegex.exec(text)) !== null) {
      hasCodeBlock = true;
      // 添加代码块前的文本（支持markdown-it渲染）
      if (match.index > lastIndex) {
        const before = text.substring(lastIndex, match.index);
        if (window.markdownit) {
          const md = window.markdownit({ html: false, linkify: true, breaks: true });
          const html = md.render(before);
          const temp = document.createElement('div');
          temp.innerHTML = html;
          div.appendChild(temp);
        } else {
          const temp = document.createElement('div');
          temp.textContent = before;
          div.appendChild(temp);
        }
      }
      // 生成代码块容器
      const codeContainer = document.createElement('div');
      codeContainer.className = 'code-block-container';
      // 头部
      const codeHeader = document.createElement('div');
      codeHeader.className = 'code-block-header';
      // 语言标识
      const langSpan = document.createElement('span');
      langSpan.className = 'code-language';
      langSpan.textContent = match[1] ? match[1] : '代码';
      codeHeader.appendChild(langSpan);
      // 复制按钮
      const copyBtn = document.createElement('button');
      copyBtn.className = 'copy-code-button';
      copyBtn.innerHTML = '<i class="fas fa-copy"></i> 复制';
      const codeTextToCopy = match[2];
      copyBtn.onclick = function() {
        navigator.clipboard.writeText(codeTextToCopy).then(() => {
          copyBtn.innerHTML = '<i class="fas fa-check"></i> 已复制';
          setTimeout(() => { copyBtn.innerHTML = '<i class="fas fa-copy"></i> 复制'; }, 2000);
        }).catch(() => {
          copyBtn.innerHTML = '<i class="fas fa-times"></i> 复制失败';
          setTimeout(() => { copyBtn.innerHTML = '<i class="fas fa-copy"></i> 复制'; }, 2000);
        });
      };
      codeHeader.appendChild(copyBtn);
      codeContainer.appendChild(codeHeader);
      // 代码块本体
      const pre = document.createElement('pre');
      const code = document.createElement('code');
      if (match[1]) code.className = 'language-' + match[1];
      code.textContent = match[2];
      pre.appendChild(code);
      codeContainer.appendChild(pre);
      div.appendChild(codeContainer);
      lastIndex = match.index + match[0].length;
    }
    // 处理剩余文本（支持内联代码和markdown-it）
    if (lastIndex < text.length) {
      let rest = text.substring(lastIndex);
      if (window.markdownit) {
        const md = window.markdownit({ html: false, linkify: true, breaks: true });
        // 处理内联代码
        rest = rest.replace(inlineCodeRegex, '<span class="inline-code">$1</span>');
        const html = md.render(rest);
        const temp = document.createElement('div');
        temp.innerHTML = html;
        div.appendChild(temp);
      } else {
        const temp = document.createElement('div');
        temp.textContent = rest;
        div.appendChild(temp);
      }
    }
    // 代码高亮
    if (window.hljs) setTimeout(() => window.hljs.highlightAll(), 0);
    historyArea.appendChild(div);
    historyArea.scrollTop = historyArea.scrollHeight;
  }

  /**
   * 获取系统设置页的对话&绘图模型
   * @returns {string} 模型名
   */
  function getChatModel() {
    const sel = document.getElementById('settingsChatModelSelection');
    return sel ? sel.value : '';
  }

  /**
   * @description 加载API密钥（与文献助手一致）
   * @returns {Promise<string|null>} API密钥
   */
  async function loadApiKey() {
    try {
      const key = await window.electronAPI.getApiKey();
      if (key) {
        window.apiKey = key;
      } else {
        window.apiKey = null;
      }
      return window.apiKey;
    } catch (error) {
      throw error;
    }
  }

  /**
   * 调用大模型API，参考文献助手实现
   * @param {Array} msgList 消息历史
   * @param {string} model 模型名
   * @returns {Promise<string>} 助手回复
   */
  async function callLLM(msgList, model) {
    let apiKey = window.apiKey;
    if (!apiKey) {
      apiKey = await loadApiKey();
    }
    if (!apiKey) {
      alert('请先在设置中配置SiliconFlow API密钥');
      return;
    }
    try {
      const res = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + apiKey
        },
        body: JSON.stringify({
          model,
          messages: msgList,
          stream: false,
          max_tokens: 1024,
          temperature: 0.7,
          top_p: 0.9
        })
      });
      const data = await res.json();
      if (data.error) {
        return 'API错误：' + (data.error.message || JSON.stringify(data.error));
      }
      if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
        return data.choices[0].message.content;
      }
      return '助手未能理解您的需求，请重试。';
    } catch (e) {
      return '网络或API调用异常，请检查API密钥和网络连接。';
    }
  }

  /**
   * 摘要前4轮对话（8条消息）
   * @param {Array} msgList
   * @param {string} model
   * @returns {Promise<string>} 摘要内容
   */
  async function summarizeHistory(msgList, model) {
    // 只摘要前8条（4轮）
    const summaryPrompt = [
      { role: 'system', content: '请用简洁中文总结以下对话内容，便于后续AI理解用户需求：' },
      ...msgList.slice(1, 9)
    ];
    const summary = await callLLM(summaryPrompt, model);
    return summary;
  }

  /**
   * 发送消息主流程，带摘要记忆
   */
  async function handleSend() {
    const text = inputArea.value.trim();
    if (!text) return;
    renderUserMessage(text);
    inputArea.value = '';
    inputArea.disabled = true;
    renderBotMessage('助手正在思考...');
    historyArea.scrollTop = historyArea.scrollHeight;
    const model = getChatModel();
    // 追加用户消息到历史
    messages.push({ role: 'user', content: text });
    // 超过4轮（8条+system=9）自动摘要
    if (messages.length > 9) {
      const summary = await summarizeHistory(messages, model);
      // 用摘要替换前8条
      messages = [
        messages[0],
        { role: 'user', content: '对话摘要：' + summary },
        ...messages.slice(9)
      ];
    }
    // 调用助手
    const botReply = await callLLM(messages, model);
    // 追加助手回复到历史
    messages.push({ role: 'assistant', content: botReply });
    // 移除"助手正在思考..."
    const lastBot = historyArea.querySelector('.vh-bot-message:last-child');
    if (lastBot && lastBot.textContent === '助手正在思考...') {
      lastBot.remove();
    }
    renderBotMessage(botReply);
    inputArea.disabled = false;
    inputArea.focus();
    historyArea.scrollTop = historyArea.scrollHeight;
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
    });
  }
})();

/**
 * 可视化助手左侧"清空对话"按钮功能：点击后仅保留开场介绍气泡
 * @author AI
 */
(function() {
  // 选择所有class为secondary-button且内容为"清空对话"的按钮
  const clearBtns = Array.from(document.querySelectorAll('button.secondary-button'));
  const clearBtn = clearBtns.find(btn => btn.textContent.trim() === '清空对话');
  const historyArea = document.getElementById('vhLeftHistory');
  if (!clearBtn || !historyArea) return;

  // 开场介绍内容（与初始一致，如有变动请同步修改）
  const opening = '你好，我是可视化助手，请告诉我你的绘图需求~';

  clearBtn.addEventListener('click', function() {
    // 清空历史
    historyArea.innerHTML = '';
    // 重新插入开场介绍气泡
    const div = document.createElement('div');
    div.className = 'vh-bot-message';
    div.textContent = opening;
    historyArea.appendChild(div);
    historyArea.scrollTop = 0;
  });
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
        const data = new Uint8Array(e.target.result);
        const workbook = window.XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = window.XLSX.utils.sheet_to_json(sheet, { header: 1 });
        renderPreview(json, file.name);
        // 上传成功后缩小上传框高度
        dropZone.style.height = '140px';
      } catch (err) {
        preview.innerHTML = `<div style='color:#c00;padding:8px;'>文件解析失败: ${err.message}</div>`;
        dropZone.style.height = '140px';
      }
    };
    reader.onerror = function() {
      preview.innerHTML = `<div style='color:#c00;padding:8px;'>文件读取失败</div>`;
      dropZone.style.height = '140px';
    };
    reader.readAsArrayBuffer(file);
  }

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
    let html = `<div style='display:flex;align-items:center;justify-content:space-between;font-size:14px;color:#1976d2;margin-bottom:6px;'><span>${fileName} 预览</span><button id='vhUploadRemoveBtn' style='font-size:12px;color:#888;background:none;border:none;cursor:pointer;padding:2px 8px;'>删除</button></div>`;
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