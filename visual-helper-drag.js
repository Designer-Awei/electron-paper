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