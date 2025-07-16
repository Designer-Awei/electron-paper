// 可视化助手画布区交互逻辑
// 支持：滚轮上下平移、Ctrl+滚轮缩放、空格+左键拖动、单击选中图形、长按拖动图形

// 将shapes变量提升到IIFE外部，使其成为全局变量
let shapes = [];

// 将render函数提升到全局作用域
function render() {
  const canvas = document.getElementById('mainCanvas');
  if (!canvas) return;
  
  const area = document.getElementById('vhCanvasArea');
  if (area) {
    // 自适应尺寸
    const rect = area.getBoundingClientRect();
    if (canvas.width !== Math.round(rect.width) || canvas.height !== Math.round(rect.height)) {
      canvas.width = Math.round(rect.width);
      canvas.height = Math.round(rect.height);
    }
  }
  
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // 获取全局变量
  const offsetX = window._canvasOffsetX || 0;
  const offsetY = window._canvasOffsetY || 0;
  const scale = window._canvasScale || 1;
  
  ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
  
  // 绘制所有对象
  for (const shape of shapes) {
    if (shape.type === 'rect' || !shape.type) {
      ctx.fillStyle = '#fafafa';
      ctx.strokeStyle = shape.selected ? '#1976d2' : '#bbb';
      ctx.lineWidth = shape.selected ? 4 : 2;
      ctx.fillRect(shape.x, shape.y, shape.width, shape.height);
      ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
    } else if (shape.type === 'image' && shape._img) {
      try {
        ctx.drawImage(shape._img, shape.x, shape.y, shape.width, shape.height);
        // 选中边框
        if (shape.selected) {
          ctx.save();
          ctx.strokeStyle = '#1976d2';
          ctx.lineWidth = 4;
          ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
          ctx.restore();
        }
      } catch (err) {
        console.error('绘制图片失败:', err);
      }
    }
    
    // 绘制四角缩放手柄（仅选中时）
    if (shape.selected) {
      const HANDLE_SIZE = 12;
      ctx.save();
      ctx.fillStyle = '#1976d2';
      
      // 获取四个角的坐标
      const handles = [
        { x: shape.x, y: shape.y }, // 左上
        { x: shape.x + shape.width, y: shape.y }, // 右上
        { x: shape.x, y: shape.y + shape.height }, // 左下
        { x: shape.x + shape.width, y: shape.y + shape.height } // 右下
      ];
      
      for (const handle of handles) {
        ctx.fillRect(handle.x - HANDLE_SIZE/2, handle.y - HANDLE_SIZE/2, HANDLE_SIZE, HANDLE_SIZE);
      }
      ctx.restore();
    }
  }
  ctx.restore();
}

// 暴露全局变量
window.render = render;

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
  
  // 保存全局变量，供render函数使用
  window._canvasOffsetX = offsetX;
  window._canvasOffsetY = offsetY;
  window._canvasScale = scale;

  // 新增：加载示例_4.py代码内容
  let example4Code = '';
  try {
    if (window.require) {
      const fs = window.require('fs');
      example4Code = fs.readFileSync('example_png/示例_4.py', 'utf-8');
    }
  } catch {}

  // 绑定json对象，便于前端直接获取
  const example4Json = {
    python_code: example4Code,
    png_path: 'example_png/示例_4.png'
  };

  const examplePngs = [
    { src: 'example_png/示例_1.png', x: 60, y: 60, width: 240, selected: false },
    { src: 'example_png/示例_3.png', x: 60, y: 270, width: 240, selected: false },
    // 新增：示例_4.png，绑定json对象
    { src: 'example_png/示例_4.png', x: 330, y: 60, width: 240, selected: false, plot_json: example4Json }
  ];

  // 画布图形数据，支持多图形和图片
  shapes = [
    ...examplePngs.map(img => ({
      ...img,
      type: 'image',
      height: 180, // 先给定一个默认高度，后续图片加载后自动修正
      _img: null // 缓存Image对象
    }))
    // 不再添加示例矩形
  ];

  // 加载图片并自动修正宽高
  shapes.forEach(shape => {
    if (shape.type === 'image') {
      const img = new window.Image();
      img.onload = function() {
        // 按宽度等比缩放
        const scale = shape.width / img.width;
        shape.height = img.height * scale;
        shape._img = img;
        render();
      };
      img.src = shape.src;
      shape._img = img;
    }
  });

  let draggingShape = null;
  let dragOffsetX = 0, dragOffsetY = 0;
  let dragTimer = null;
  let isDragging = false;

  // 新增：四角缩放手柄尺寸和类型
  const HANDLE_SIZE = 12;
  const HANDLE_TYPES = ['nw', 'ne', 'sw', 'se']; // 左上、右上、左下、右下
  let resizingShape = null;
  let resizeStart = null;
  let resizeOrigin = null;
  let resizeHandleType = null;
  let altCopyTimer = null;
  let isAltCopying = false;
  let altCopyShape = null;

  // 记录等比缩放初始参数
  let aspectResizeInfo = null;

  // 记录当前是否按下Alt
  let altPressed = false;

  /**
   * 撤回栈，保存shapes的历史快照
   * @type {Array<Array<object>>}
   */
  const undoStack = [];

  /**
   * 保存当前shapes快照到撤回栈
   */
  function pushUndo() {
    // 深拷贝，图片_img属性不拷贝
    const snapshot = shapes.map(s => {
      const { _img, ...rest } = s;
      return { ...rest };
    });
    undoStack.push(snapshot);
    // 限制撤回栈长度，防止内存泄漏
    if (undoStack.length > 50) undoStack.shift();
  }

  /**
   * 撤回到上一个快照
   */
  function undo() {
    if (undoStack.length === 0) return;
    const prev = undoStack.pop();
    // 恢复shapes内容
    shapes.length = 0;
    prev.forEach(s => {
      if (s.type === 'image') {
        // 重新加载图片
        const img = new window.Image();
        img.onload = function() { render(); };
        img.src = s.src;
        shapes.push({ ...s, _img: img });
      } else {
        shapes.push({ ...s });
      }
    });
    render();
  }

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
   * 获取四个角缩放手柄的坐标
   * @param {object} shape
   * @returns {Array<{x:number,y:number,type:string}>}
   */
  function getResizeHandles(shape) {
    return [
      { x: shape.x, y: shape.y, type: 'nw' },
      { x: shape.x + shape.width, y: shape.y, type: 'ne' },
      { x: shape.x, y: shape.y + shape.height, type: 'sw' },
      { x: shape.x + shape.width, y: shape.y + shape.height, type: 'se' }
    ];
  }

  /**
   * 判断点是否在某个缩放手柄内
   * @param {number} x
   * @param {number} y
   * @param {object} handle
   * @returns {boolean}
   */
  function isPointInHandle(x, y, handle) {
    return x >= handle.x - HANDLE_SIZE/2 && x <= handle.x + HANDLE_SIZE/2 &&
           y >= handle.y - HANDLE_SIZE/2 && y <= handle.y + HANDLE_SIZE/2;
  }

  /**
   * 渲染函数，支持绘制矩形和图片对象
   * @returns {void}
   */
  function innerRender() {
    // 更新全局变量
    window._canvasOffsetX = offsetX;
    window._canvasOffsetY = offsetY;
    window._canvasScale = scale;
    
    // 调用全局render函数
    render();
  }

  // 替换原来的render调用为innerRender
  function resizeCanvasToFit() {
    const rect = area.getBoundingClientRect();
    if (canvas.width !== Math.round(rect.width) || canvas.height !== Math.round(rect.height)) {
      canvas.width = Math.round(rect.width);
      canvas.height = Math.round(rect.height);
      innerRender(); // 尺寸变化后立即刷新
    }
  }
  window.addEventListener('resize', () => {
    resizeCanvasToFit();
    innerRender();
  });
  window.addEventListener('DOMContentLoaded', function() {
    resizeCanvasToFit();
    innerRender();
  });

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

  // 新增：Delete键删除选中图形
  window.addEventListener('keydown', function(e) {
    if (e.code === 'Delete') {
      const idx = shapes.findIndex(s => s.selected);
      if (idx !== -1) {
        pushUndo(); // 删除前保存快照
        shapes.splice(idx, 1);
        render();
      }
    }
  });

  // 选中与拖动图形、画布平移、缩放、Alt+拖动复制
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
    // Alt+左键长按：复制图形
    if (altPressed || e.altKey) {
      for (const shape of shapes) {
        if (isPointInShape(mx, my, shape)) {
          pushUndo(); // 复制前保存快照
          altCopyTimer = setTimeout(() => {
            altCopyShape = { ...shape, x: shape.x + 20, y: shape.y + 20, selected: true };
            shapes.forEach(s => s.selected = false);
            shapes.push(altCopyShape);
            isAltCopying = true;
            dragOffsetX = mx - altCopyShape.x;
            dragOffsetY = my - altCopyShape.y;
            render();
          }, 180);
          return;
        }
      }
    }
    // 检查是否点中缩放手柄
    for (const shape of shapes) {
      if (shape.selected) {
        for (const handle of getResizeHandles(shape)) {
          if (isPointInHandle(mx, my, handle)) {
            pushUndo(); // 缩放前保存快照
            resizingShape = shape;
            resizeStart = { x: mx, y: my };
            resizeOrigin = { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
            resizeHandleType = handle.type;
            canvas.style.cursor = handle.type+'-resize';
            // 记录等比缩放初始参数
            let anchorX, anchorY;
            switch (handle.type) {
              case 'nw': anchorX = shape.x + shape.width; anchorY = shape.y + shape.height; break;
              case 'ne': anchorX = shape.x; anchorY = shape.y + shape.height; break;
              case 'sw': anchorX = shape.x + shape.width; anchorY = shape.y; break;
              case 'se': anchorX = shape.x; anchorY = shape.y; break;
            }
            aspectResizeInfo = {
              anchorX, anchorY,
              width: shape.width,
              height: shape.height,
              dx0: Math.abs(resizeStart.x - anchorX),
              dy0: Math.abs(resizeStart.y - anchorY)
            };
            return;
          }
        }
      }
    }
    // 查找是否点中某个图形
    let found = false;
    for (const shape of shapes) {
      if (isPointInShape(mx, my, shape)) {
        found = true;
        shapes.forEach(s => s.selected = false);
        shape.selected = true;
        render();
        pushUndo(); // 选中后准备拖动，先保存快照
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
    clearTimeout(altCopyTimer);
    isDragging = false;
    draggingShape = null;
    dragging = false;
    resizingShape = null;
    resizeStart = null;
    resizeOrigin = null;
    resizeHandleType = null;
    isAltCopying = false;
    altCopyShape = null;
    canvas.style.cursor = '';
    aspectResizeInfo = null;
  });

  canvas.addEventListener('mouseleave', function(e) {
    clearTimeout(dragTimer);
    clearTimeout(altCopyTimer);
    isDragging = false;
    draggingShape = null;
    dragging = false;
    resizingShape = null;
    resizeStart = null;
    resizeOrigin = null;
    resizeHandleType = null;
    isAltCopying = false;
    altCopyShape = null;
    canvas.style.cursor = '';
    aspectResizeInfo = null;
  });

  canvas.addEventListener('mousemove', function(e) {
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left - offsetX) / scale;
    const my = (e.clientY - rect.top - offsetY) / scale;
    // 四角缩放
    if (resizingShape && resizeStart && resizeOrigin && resizeHandleType) {
      let dx = mx - resizeStart.x;
      let dy = my - resizeStart.y;
      let newX = resizeOrigin.x, newY = resizeOrigin.y, newW = resizeOrigin.width, newH = resizeOrigin.height;
      if (e.shiftKey && aspectResizeInfo) {
        // 以定位点为基准，鼠标点到定位点的距离
        let anchorX = aspectResizeInfo.anchorX;
        let anchorY = aspectResizeInfo.anchorY;
        let dxNow = Math.abs(mx - anchorX);
        let dyNow = Math.abs(my - anchorY);
        // 取主方向
        let scaleRatio = 1;
        if (aspectResizeInfo.dx0 >= aspectResizeInfo.dy0) {
          // 横向为主
          scaleRatio = dxNow / (aspectResizeInfo.dx0 || 1);
        } else {
          // 纵向为主
          scaleRatio = dyNow / (aspectResizeInfo.dy0 || 1);
        }
        scaleRatio = Math.max(0.1, scaleRatio); // 防止反向或为0
        let w0 = aspectResizeInfo.width, h0 = aspectResizeInfo.height;
        let newWidth = Math.max(30, w0 * scaleRatio);
        let newHeight = Math.max(30, h0 * scaleRatio);
        // 计算新x/y，保持定位点不变
        switch (resizeHandleType) {
          case 'nw':
            newX = anchorX - newWidth;
            newY = anchorY - newHeight;
            break;
          case 'ne':
            newX = anchorX;
            newY = anchorY - newHeight;
            break;
          case 'sw':
            newX = anchorX - newWidth;
            newY = anchorY;
            break;
          case 'se':
            newX = anchorX;
            newY = anchorY;
            break;
        }
        newW = newWidth;
        newH = newHeight;
      } else {
        // 非等比缩放，原逻辑
        const aspect = resizeOrigin.width / resizeOrigin.height;
        switch (resizeHandleType) {
          case 'nw': // 左上，定位右下
            newX = resizeOrigin.x + dx;
            newY = resizeOrigin.y + dy;
            newW = resizeOrigin.width - dx;
            newH = resizeOrigin.height - dy;
            break;
          case 'ne': // 右上，定位左下
            newY = resizeOrigin.y + dy;
            newW = resizeOrigin.width + dx;
            newH = resizeOrigin.height - dy;
            break;
          case 'sw': // 左下，定位右上
            newX = resizeOrigin.x + dx;
            newW = resizeOrigin.width - dx;
            newH = resizeOrigin.height + dy;
            break;
          case 'se': // 右下，定位左上
            newW = resizeOrigin.width + dx;
            newH = resizeOrigin.height + dy;
            break;
        }
        // 限制最小尺寸
        newW = Math.max(30, newW);
        newH = Math.max(30, newH);
        // 修正x/y防止反向拖动
        if (newW !== resizeOrigin.width && (resizeHandleType === 'nw' || resizeHandleType === 'sw')) {
          newX = resizeOrigin.x + (resizeOrigin.width - newW);
        }
        if (newH !== resizeOrigin.height && (resizeHandleType === 'nw' || resizeHandleType === 'ne')) {
          newY = resizeOrigin.y + (resizeOrigin.height - newH);
        }
      }
      resizingShape.x = newX;
      resizingShape.y = newY;
      resizingShape.width = newW;
      resizingShape.height = newH;
      render();
      return;
    }
    // Alt+拖动复制，允许拖动中动态切换
    if ((isAltCopying && altCopyShape) || (isDragging && (altPressed || e.altKey))) {
      // 如果不是复制状态但按下了Alt，则进入复制状态
      if (!isAltCopying && isDragging && (altPressed || e.altKey)) {
        // 复制当前拖动图形
        altCopyShape = { ...draggingShape, x: draggingShape.x + 20, y: draggingShape.y + 20, selected: true };
        shapes.forEach(s => s.selected = false);
        shapes.push(altCopyShape);
        isAltCopying = true;
        draggingShape = null;
      }
      if (isAltCopying && altCopyShape) {
        altCopyShape.x = mx - dragOffsetX;
        altCopyShape.y = my - dragOffsetY;
        canvas.style.cursor = 'copy';
        render();
        return;
      }
    }
    // 拖动画布
    if (dragging && spacePressed) {
      offsetX += e.clientX - lastX;
      offsetY += e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      canvas.style.cursor = 'grab';
      render();
      return;
    }
    // 拖动图形
    if (isDragging && draggingShape) {
      draggingShape.x = mx - dragOffsetX;
      draggingShape.y = my - dragOffsetY;
      canvas.style.cursor = altPressed || e.altKey ? 'copy' : '';
      render();
      return;
    }
    // 鼠标样式提示
    let hoverCursor = '';
    for (const shape of shapes) {
      if (shape.selected) {
        for (const handle of getResizeHandles(shape)) {
          if (isPointInHandle(mx, my, handle)) {
            switch (handle.type) {
              case 'nw': hoverCursor = 'nwse-resize'; break;
              case 'ne': hoverCursor = 'nesw-resize'; break;
              case 'sw': hoverCursor = 'nesw-resize'; break;
              case 'se': hoverCursor = 'nwse-resize'; break;
            }
            break;
          }
        }
      }
    }
    // Alt悬停时显示复制光标
    if (!hoverCursor && (altPressed || e.altKey)) hoverCursor = 'copy';
    canvas.style.cursor = hoverCursor;
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

  // 监听Ctrl+Z撤回
  window.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
      e.preventDefault();
      undo();
    }
  });

  // 初始化
  render();
})();

/**
 * 可视化助手画布区渲染PNG和绑定figJson
 * @param {string} pngPath - 本地PNG图片路径
 * @param {object} figJson - plotly图表json
 */
window.renderVisualHelperPngAndFig = function(pngPath, figJson) {
  const canvas = document.getElementById('mainCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const img = new window.Image();
  img.onload = function() {
    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // 居中自适应绘制
    let scale = Math.min(canvas.width / img.width, canvas.height / img.height, 1);
    let drawW = img.width * scale;
    let drawH = img.height * scale;
    let dx = (canvas.width - drawW) / 2;
    let dy = (canvas.height - drawH) / 2;
    ctx.drawImage(img, dx, dy, drawW, drawH);
  };
  img.src = 'file://' + pngPath;
  window.currentPngPath = pngPath;
  window.currentFigJson = figJson;
};

/**
 * 监听window.currentPngPath和window.currentFigJson变化，自动渲染
 * 可在plot链路结果返回时调用window.renderVisualHelperPngAndFig(pngPath, figJson)
 */
// 由visual-helper-drag.js在plot链路返回时调用

/**
 * 上传/解析数据后，务必调用window.onVisualHelperDataUpload(jsonData)
 * 这样全局columns、dataPreview、data才能被后续链路正确使用
 */
// 暴露shapes变量，供项目导入导出功能使用
window.shapes = shapes;

/**
 * 加载画布状态
 * @param {Array} canvasState 画布状态数组
 */
window.loadCanvasState = function(canvasState) {
  try {
    console.log('开始加载画布状态:', canvasState);
    if (!canvasState || !Array.isArray(canvasState) || !canvasState.length) {
      console.warn('画布状态为空或格式不正确');
      return;
    }
    
    // 清空当前画布
    shapes.length = 0;
    
    // 加载新的状态
    canvasState.forEach((shape, index) => {
      try {
        if (shape.type === 'image') {
          console.log(`加载图片 ${index}:`, shape.src);
          const img = new window.Image();
          
          // 添加加载成功和失败的处理
          img.onload = function() {
            console.log(`图片 ${index} 加载成功:`, shape.src);
            render();
          };
          
          img.onerror = function(err) {
            console.error(`图片 ${index} 加载失败:`, shape.src, err);
            
            // 尝试修复路径
            if (shape.src && !shape.src.startsWith('data:')) {
              console.log('尝试修复图片路径...');
              
              // 移除file://前缀，使用相对路径
              let newSrc = shape.src.replace(/^file:\/\/\/?/i, '');
              
              // 只保留文件名部分
              if (newSrc.includes('/')) {
                const fileName = newSrc.split('/').pop();
                if (fileName) {
                  console.log('尝试从images目录加载:', fileName);
                  
                  // 只尝试从images目录加载
                  const imagePath = `images/${fileName}`;
                  console.log('尝试路径:', imagePath);
                  img.src = imagePath;
                  return;
                }
              }
              
              // 如果没有文件名，尝试使用原始相对路径
              console.log('尝试使用相对路径:', newSrc);
              img.src = newSrc;
            }
          };
          
          // 设置图片源
          img.src = shape.src;
          
          shapes.push({
            ...shape,
            _img: img
          });
        } else {
          shapes.push({...shape});
        }
      } catch (err) {
        console.error(`处理画布状态项 ${index} 失败:`, err);
      }
    });
    
    // 触发渲染
    render();
    console.log('画布状态加载完成');
  } catch (err) {
    console.error('加载画布状态失败:', err);
  }
};

/**
 * 加载左侧对话历史
 * @param {Array} chatHistory 对话历史数组
 */
window.loadLeftChatHistory = function(chatHistory) {
  if (!chatHistory || !Array.isArray(chatHistory) || !chatHistory.length) return;
  
  const historyArea = document.getElementById('vhLeftHistory');
  if (!historyArea) return;
  
  // 清空当前历史
  historyArea.innerHTML = '';
  
  // 加载新的历史
  chatHistory.forEach(msg => {
    const div = document.createElement('div');
    if (msg.role === 'user') {
      div.className = 'vh-user-message';
    } else {
      div.className = 'vh-bot-message';
    }
    div.textContent = msg.content;
    historyArea.appendChild(div);
  });
  
  // 滚动到底部
  historyArea.scrollTop = historyArea.scrollHeight;
};

/**
 * 加载右侧对话历史
 * @param {Array} chatHistory 对话历史数组
 */
window.loadRightChatHistory = function(chatHistory) {
  if (!chatHistory || !Array.isArray(chatHistory) || !chatHistory.length) return;
  
  const historyArea = document.getElementById('vhTuneHistory');
  if (!historyArea) return;
  
  // 清空当前历史
  historyArea.innerHTML = '';
  
  // 加载新的历史
  chatHistory.forEach(msg => {
    const div = document.createElement('div');
    if (msg.role === 'user') {
      div.className = 'vh-user-message';
    } else {
      div.className = 'vh-bot-message';
    }
    div.textContent = msg.content;
    historyArea.appendChild(div);
  });
  
  // 滚动到底部
  historyArea.scrollTop = historyArea.scrollHeight;
}; 