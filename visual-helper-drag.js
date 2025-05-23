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
 * 左侧面板分区横向分割线拖动（上下拖动改变高度占比）
 */
(function() {
  const leftPanel = document.getElementById('vhLeftPanel');
  if (!leftPanel) return;
  // 获取分区
  const uploadWrapper = leftPanel.querySelector('.vh-upload-wrapper');
  const divider1 = leftPanel.children[1]; // 第一个2px分割线
  const historyDiv = document.getElementById('vhLeftHistory');
  const divider2 = leftPanel.children[3]; // 第二个2px分割线
  const inputArea = document.getElementById('vhLeftInputArea');
  if (!uploadWrapper || !divider1 || !historyDiv || !divider2 || !inputArea) return;

  // 拖动第一个分割线，调整上传区和历史区高度
  let dragging1 = false;
  let startY1 = 0;
  let startUploadHeight = 0;
  let startHistoryHeight1 = 0;
  divider1.style.cursor = 'row-resize';
  divider1.addEventListener('mousedown', function(e) {
    e.preventDefault();
    dragging1 = true;
    divider1.classList.add('active');
    document.body.style.cursor = 'row-resize';
    startY1 = e.clientY;
    startUploadHeight = uploadWrapper.offsetHeight;
    startHistoryHeight1 = historyDiv.offsetHeight;
    document.body.setAttribute('data-resizing', 'true');
  });
  document.addEventListener('mousemove', function(e) {
    if (!dragging1) return;
    e.preventDefault();
    const delta = e.clientY - startY1;
    let newUploadHeight = startUploadHeight + delta;
    let newHistoryHeight = startHistoryHeight1 - delta;
    // 限制最小高度
    if (newUploadHeight < 60) newUploadHeight = 60;
    if (newHistoryHeight < 40) newHistoryHeight = 40;
    uploadWrapper.style.flex = `0 0 ${newUploadHeight}px`;
    uploadWrapper.style.height = `${newUploadHeight}px`;
    historyDiv.style.flexBasis = `${newHistoryHeight}px`;
  });
  document.addEventListener('mouseup', function() {
    if (dragging1) {
      dragging1 = false;
      divider1.classList.remove('active');
      document.body.style.cursor = '';
      document.body.removeAttribute('data-resizing');
    }
  });

  // 拖动第二个分割线，调整历史区和输入区高度
  let dragging2 = false;
  let startY2 = 0;
  let startHistoryHeight2 = 0;
  let startInputHeight = 0;
  divider2.style.cursor = 'row-resize';
  divider2.addEventListener('mousedown', function(e) {
    e.preventDefault();
    dragging2 = true;
    divider2.classList.add('active');
    document.body.style.cursor = 'row-resize';
    startY2 = e.clientY;
    startHistoryHeight2 = historyDiv.offsetHeight;
    startInputHeight = inputArea.offsetHeight;
    document.body.setAttribute('data-resizing', 'true');
  });
  document.addEventListener('mousemove', function(e) {
    if (!dragging2) return;
    e.preventDefault();
    const delta = e.clientY - startY2;
    let newHistoryHeight = startHistoryHeight2 + delta;
    let newInputHeight = startInputHeight - delta;
    // 限制最小高度
    if (newHistoryHeight < 40) newHistoryHeight = 40;
    if (newInputHeight < 56) newInputHeight = 56;
    historyDiv.style.flexBasis = `${newHistoryHeight}px`;
    inputArea.style.flex = `0 0 ${newInputHeight}px`;
    inputArea.style.height = `${newInputHeight}px`;
  });
  document.addEventListener('mouseup', function() {
    if (dragging2) {
      dragging2 = false;
      divider2.classList.remove('active');
      document.body.style.cursor = '';
      document.body.removeAttribute('data-resizing');
    }
  });
})(); 