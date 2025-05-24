// 可视化助手画布区交互逻辑
// 支持：滚轮上下平移、Ctrl+滚轮缩放、空格+左键拖动、单击选中图形、长按拖动图形
(function() {
  const canvas = document.getElementById('mainCanvas');
  const viewport = document.getElementById('canvasViewport');
  const area = document.getElementById('vhCanvasArea');
  if (!canvas || !viewport || !area) return;

  let offsetX = 0, offsetY = 0; // 画布平移
  let scale = 1; // 画布缩放
  let dragging = false;
  let lastX = 0, lastY = 0;
  let spacePressed = false;

  // 图形数据，支持多图形
  const shapes = [
    { x: 100, y: 100, width: 200, height: 120, selected: false },
    { x: 400, y: 300, width: 180, height: 140, selected: false }
  ];
  let draggingShape = null;
  let dragOffsetX = 0, dragOffsetY = 0;
  let dragTimer = null;
  let isDragging = false;

  /**
   * 让canvas自适应父容器vhCanvasArea的实际宽高
   * 并在窗口resize时自动调整
   */
  function resizeCanvasToFit() {
    const rect = area.getBoundingClientRect();
    if (canvas.width !== Math.round(rect.width) || canvas.height !== Math.round(rect.height)) {
      canvas.width = Math.round(rect.width);
      canvas.height = Math.round(rect.height);
      render(); // 尺寸变化后立即刷新
    }
  }
  window.addEventListener('resize', () => {
    resizeCanvasToFit();
    render();
  });
  window.addEventListener('DOMContentLoaded', function() {
    resizeCanvasToFit();
    render();
  });

  /**
   * 判断点是否在图形内
   * @param {number} x
   * @param {number} y
   * @param {object} shape
   * @returns {boolean}
   */
  function isPointInShape(x, y, shape) {
    return x >= shape.x && x <= shape.x + shape.width &&
           y >= shape.y && y <= shape.y + shape.height;
  }

  /**
   * 渲染函数，实际内容可根据需求自定义
   * @returns {void}
   */
  function render() {
    resizeCanvasToFit();
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    // 绘制所有图形
    for (const shape of shapes) {
      ctx.fillStyle = '#fafafa';
      ctx.strokeStyle = shape.selected ? '#1976d2' : '#bbb';
      ctx.lineWidth = shape.selected ? 4 : 2;
      ctx.fillRect(shape.x, shape.y, shape.width, shape.height);
      ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
      if (shape.selected) {
        ctx.font = '18px sans-serif';
        ctx.fillStyle = '#1976d2';
        ctx.fillText('已选中', shape.x + 10, shape.y + 30);
      }
    }
    ctx.restore();
  }

  // 滚轮事件
  viewport.addEventListener('wheel', function(e) {
    if (e.ctrlKey) {
      // 缩放
      e.preventDefault();
      const prevScale = scale;
      scale += e.deltaY * -0.001;
      scale = Math.max(0.2, Math.min(3, scale));
      // 缩放中心为鼠标位置
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      offsetX = mx - (mx - offsetX) * (scale / prevScale);
      offsetY = my - (my - offsetY) * (scale / prevScale);
      render();
    } else {
      // 上下平移
      e.preventDefault();
      offsetY -= e.deltaY;
      render();
    }
  });

  // 空格键检测
  window.addEventListener('keydown', e => { if (e.code === 'Space') spacePressed = true; });
  window.addEventListener('keyup', e => { if (e.code === 'Space') spacePressed = false; });

  // 选中与拖动图形、画布平移
  canvas.addEventListener('mousedown', function(e) {
    if (e.button !== 0) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left - offsetX) / scale;
    const my = (e.clientY - rect.top - offsetY) / scale;
    // 空格+左键：画布平移
    if (spacePressed) {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      canvas.style.cursor = 'grab';
      return;
    }
    // 查找是否点中某个图形
    let found = false;
    for (const shape of shapes) {
      if (isPointInShape(mx, my, shape)) {
        found = true;
        shapes.forEach(s => s.selected = false);
        shape.selected = true;
        render();
        dragTimer = setTimeout(() => {
          draggingShape = shape;
          dragOffsetX = mx - shape.x;
          dragOffsetY = my - shape.y;
          isDragging = true;
        }, 180);
        break;
      }
    }
    if (!found) {
      shapes.forEach(s => s.selected = false);
      render();
    }
  });

  canvas.addEventListener('mouseup', function(e) {
    clearTimeout(dragTimer);
    isDragging = false;
    draggingShape = null;
    dragging = false;
    canvas.style.cursor = '';
  });

  canvas.addEventListener('mouseleave', function(e) {
    clearTimeout(dragTimer);
    isDragging = false;
    draggingShape = null;
    dragging = false;
    canvas.style.cursor = '';
  });

  canvas.addEventListener('mousemove', function(e) {
    if (dragging && spacePressed) {
      offsetX += e.clientX - lastX;
      offsetY += e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      render();
      return;
    }
    if (!isDragging || !draggingShape) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left - offsetX) / scale;
    const my = (e.clientY - rect.top - offsetY) / scale;
    draggingShape.x = mx - dragOffsetX;
    draggingShape.y = my - dragOffsetY;
    render();
  });

  // tab切换自动刷新画布
  const visualTab = document.getElementById('tab-visualhelper');
  if (visualTab) {
    visualTab.addEventListener('click', function() {
      setTimeout(() => {
        resizeCanvasToFit();
        render();
      }, 0);
    });
  }
  const visualContainer = document.getElementById('visualHelperContainer');
  if (visualContainer) {
    const observer = new MutationObserver(() => {
      if (visualContainer.style.display !== 'none' && visualContainer.offsetParent !== null) {
        resizeCanvasToFit();
        render();
      }
    });
    observer.observe(visualContainer, { attributes: true, attributeFilter: ['style', 'class'] });
  }

  // 初始化
  render();
})(); 