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
})(); 