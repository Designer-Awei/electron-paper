/**
 * 可视化助手项目导入导出功能
 * 支持：导出项目到文件夹或ZIP、导入项目文件夹、保存画布状态
 */
(function() {
  // DOM元素
  const visualImportBtn = document.getElementById('visualImportBtn');
  const visualExportBtn = document.getElementById('visualExportBtn');
  const projectTitleInput = document.getElementById('projectTitleInput');
  
  // 导出弹窗相关元素
  const visualExportModal = document.getElementById('visualExportModal');
  const closeVisualExportModal = document.getElementById('closeVisualExportModal');
  const visualExportPath = document.getElementById('visualExportPath');
  const selectVisualExportPathButton = document.getElementById('selectVisualExportPathButton');
  const visualProjectName = document.getElementById('visualProjectName');
  const visualExportFormat = document.getElementById('visualExportFormat');
  const visualProjectDescription = document.getElementById('visualProjectDescription');
  const visualExportMessage = document.getElementById('visualExportMessage');
  const cancelVisualExport = document.getElementById('cancelVisualExport');
  const confirmVisualExport = document.getElementById('confirmVisualExport');
  
  // 导入弹窗相关元素
  const visualImportModal = document.getElementById('visualImportModal');
  const closeVisualImportModal = document.getElementById('closeVisualImportModal');
  const visualImportPath = document.getElementById('visualImportPath');
  const selectVisualImportPathButton = document.getElementById('selectVisualImportPathButton');
  const visualImportMessage = document.getElementById('visualImportMessage');
  const cancelVisualImport = document.getElementById('cancelVisualImport');
  const confirmVisualImport = document.getElementById('confirmVisualImport');
  
  // 检查DOM元素是否存在
  if (!visualImportBtn || !visualExportBtn) return;
  
  /**
   * 显示消息
   * @param {HTMLElement} element 消息容器元素
   * @param {string} message 消息内容
   * @param {string} type 消息类型 ('success'|'error')
   */
  function showMessage(element, message, type) {
    if (!element) return;
    element.textContent = message;
    element.className = 'export-message';
    element.classList.add(type);
    element.style.display = 'block';
    element.style.backgroundColor = type === 'success' ? '#d4edda' : '#f8d7da';
    element.style.color = type === 'success' ? '#155724' : '#721c24';
    element.style.border = `1px solid ${type === 'success' ? '#c3e6cb' : '#f5c6cb'}`;
  }
  
  /**
   * 隐藏消息
   * @param {HTMLElement} element 消息容器元素
   */
  function hideMessage(element) {
    if (!element) return;
    element.style.display = 'none';
  }
  
  /**
   * 获取系统设置中的可视化项目存放路径
   * @returns {Promise<string>} 路径
   */
  async function getVisualProjectPath() {
    try {
      // 首先尝试从localStorage获取
      let path = localStorage.getItem('visualProjectPath');
      if (path) return path;
      
      // 如果localStorage没有，尝试从系统设置获取
      const settings = await window.electronAPI.getSettings();
      return settings?.visualProjectPath || '';
    } catch (error) {
      console.error('获取可视化项目路径失败:', error);
      return '';
    }
  }
  
  /**
   * 保存可视化项目存放路径到系统设置
   * @param {string} path 路径
   */
  async function saveVisualProjectPath(path) {
    try {
      if (!path) return;
      
      // 保存到localStorage
      localStorage.setItem('visualProjectPath', path);
      
      // 同时保存到系统设置
      const settings = await window.electronAPI.getSettings() || {};
      settings.visualProjectPath = path;
      await window.electronAPI.saveSettings(settings);
    } catch (error) {
      console.error('保存可视化项目路径失败:', error);
    }
  }
  
  /**
   * 获取画布状态
   * @returns {Object} 画布状态对象
   */
  function getCanvasState() {
    // 从window.shapes获取画布上的所有图形
    // 这里假设visual-helper-canvas.js中已经将shapes暴露为window.shapes
    const shapes = window.shapes || [];
    
    // 过滤出所有图片对象，并去掉_img属性（不需要序列化）
    return shapes.map(shape => {
      const { _img, ...rest } = shape;
      return rest;
    });
  }
  
  /**
   * 获取左侧对话历史
   * @returns {Array} 对话历史数组
   */
  function getLeftChatHistory() {
    const historyArea = document.getElementById('vhLeftHistory');
    if (!historyArea) return [];
    
    const messages = [];
    const userMsgs = historyArea.querySelectorAll('.vh-user-message');
    const botMsgs = historyArea.querySelectorAll('.vh-bot-message');
    
    // 按顺序合并用户和助手消息
    const allNodes = Array.from(historyArea.childNodes);
    allNodes.forEach(node => {
      if (node.classList?.contains('vh-user-message')) {
        messages.push({
          role: 'user',
          content: node.textContent
        });
      } else if (node.classList?.contains('vh-bot-message')) {
        messages.push({
          role: 'assistant',
          content: node.textContent
        });
      }
    });
    
    return messages;
  }
  
  /**
   * 获取右侧微调对话历史
   * @returns {Array} 对话历史数组
   */
  function getRightChatHistory() {
    const historyArea = document.getElementById('vhTuneHistory');
    if (!historyArea) return [];
    
    const messages = [];
    const allNodes = Array.from(historyArea.childNodes);
    allNodes.forEach(node => {
      if (node.classList?.contains('vh-user-message')) {
        messages.push({
          role: 'user',
          content: node.textContent
        });
      } else if (node.classList?.contains('vh-bot-message')) {
        messages.push({
          role: 'assistant',
          content: node.textContent
        });
      }
    });
    
    return messages;
  }
  
  /**
   * 获取上传的数据
   * @returns {Object} 数据对象
   */
  function getUploadedData() {
    // 尝试从不同的全局变量中获取数据
    let columns = [];
    let dataPreview = [];
    let data = [];
    
    // 尝试从window对象获取
    if (window.columns && Array.isArray(window.columns)) {
      columns = window.columns;
    }
    
    if (window.dataPreview && Array.isArray(window.dataPreview)) {
      dataPreview = window.dataPreview;
    }
    
    if (window.data && Array.isArray(window.data)) {
      data = window.data;
    }
    
    // 如果没有找到数据，尝试从onVisualHelperDataUpload函数中获取
    // 这个函数可能在visual-helper-drag.js中定义
    if ((!columns.length || !dataPreview.length || !data.length) && 
        typeof window.onVisualHelperDataUpload === 'function') {
      try {
        // 尝试获取上传的数据
        const uploadData = window._visualHelperUploadedData;
        if (uploadData) {
          if (uploadData.columns) columns = uploadData.columns;
          if (uploadData.dataPreview) dataPreview = uploadData.dataPreview;
          if (uploadData.data) data = uploadData.data;
        }
      } catch (error) {
        console.error('获取上传数据失败:', error);
      }
    }
    
    return {
      columns,
      dataPreview,
      data
    };
  }
  
  /**
   * 导出项目
   * @param {Object} options 导出选项
   * @returns {Promise<boolean>} 是否成功
   */
  async function exportProject(options) {
    try {
      const { path, name, format, description } = options;
      if (!path || !name) {
        throw new Error('路径和项目名称不能为空');
      }
      
      // 获取项目数据
      let uploadedData = getUploadedData();
      // 合并真实文件路径和文件名
      if (window._visualHelperUploadedData && window._visualHelperUploadedData.filePath) {
        uploadedData = {
          filePath: window._visualHelperUploadedData.filePath,
          fileName: window._visualHelperUploadedData.fileName
        };
      }
      const projectData = {
        name,
        description,
        createdAt: new Date().toISOString(),
        canvasState: getCanvasState(),
        leftChatHistory: getLeftChatHistory(),
        rightChatHistory: getRightChatHistory(),
        /**
         * @description 只保留 filePath 和 fileName 字段，彻底移除 data/columns/dataPreview 等内容
         */
        uploadedData
      };
      
      // 调用electron API导出项目
      const result = await window.electronAPI.exportVisualProject({
        path,
        name,
        format,
        data: projectData
      });
      
      if (result.success) {
        // 保存路径到设置
        await saveVisualProjectPath(path);
        return true;
      } else {
        throw new Error(result.error || '导出失败');
      }
    } catch (error) {
      console.error('导出项目失败:', error);
      throw error;
    }
  }
  
  /**
   * 导入项目
   * @param {string} path 项目路径
   * @returns {Promise<Object>} 项目数据
   */
  async function importProject(path) {
    try {
      if (!path) {
        throw new Error('项目路径不能为空');
      }
      
      // 调用electron API导入项目
      const result = await window.electronAPI.importVisualProject(path);
      
      if (result.success) {
        return result.data;
      } else {
        throw new Error(result.error || '导入失败');
      }
    } catch (error) {
      console.error('导入项目失败:', error);
      throw error;
    }
  }
  
  /**
   * 应用导入的项目数据
   * @param {Object} projectData 项目数据
   */
  function applyImportedProject(projectData) {
    try {
      // 设置项目标题
      if (projectData.name && projectTitleInput) {
        projectTitleInput.value = projectData.name;
      }
      
      // 恢复画布状态
      if (projectData.canvasState && Array.isArray(projectData.canvasState) && window.loadCanvasState) {
        // 预处理图片路径
        const processedState = projectData.canvasState.map(shape => {
          if (shape.type === 'image' && shape.src) {
            // 确保图片路径正确
            try {
              // 获取项目文件夹路径
              const projectPath = visualImportPath.value;
              
              // 如果是相对路径（不以file://、http://、https://开头，且不是绝对路径）
              if (!shape.src.startsWith('file://') && 
                  !shape.src.startsWith('http://') && 
                  !shape.src.startsWith('https://') &&
                  !shape.src.match(/^[A-Z]:\\/i) && 
                  !shape.src.startsWith('/')) {
                
                // 构建完整路径（使用正斜杠统一路径格式）
                const normalizedPath = projectPath.replace(/\\/g, '/');
                shape.src = `file:///${normalizedPath}/${shape.src}`;
                console.log('修复图片路径:', shape.src);
              }
              
              // 如果是plot_json中的png_path也需要修复
              if (shape.plot_json && shape.plot_json.png_path) {
                const pngPath = shape.plot_json.png_path;
                if (!pngPath.startsWith('file://') && 
                    !pngPath.startsWith('http://') && 
                    !pngPath.startsWith('https://') &&
                    !pngPath.match(/^[A-Z]:\\/i) && 
                    !pngPath.startsWith('/')) {
                  
                  const normalizedPath = projectPath.replace(/\\/g, '/');
                  shape.plot_json.png_path = `file:///${normalizedPath}/${pngPath}`;
                  console.log('修复plot_json中的png_path:', shape.plot_json.png_path);
                }
              }
            } catch (err) {
              console.error('处理图片路径失败:', err, shape);
            }
          }
          return shape;
        });
        
        // 延迟加载画布状态，确保DOM已经准备好
        setTimeout(() => {
          try {
            console.log('正在加载画布状态:', processedState);
            window.loadCanvasState(processedState);
            console.log('画布状态已加载');
          } catch (err) {
            console.error('加载画布状态失败:', err);
          }
        }, 1000); // 增加延迟时间，确保DOM完全加载
      }
      
      // 恢复对话历史
      if (projectData.leftChatHistory && Array.isArray(projectData.leftChatHistory) && window.loadLeftChatHistory) {
        setTimeout(() => {
          try {
            window.loadLeftChatHistory(projectData.leftChatHistory);
            console.log('左侧对话历史已加载');
          } catch (err) {
            console.error('加载左侧对话历史失败:', err);
          }
        }, 1000);
      }
      
      // 恢复微调对话历史
      if (projectData.rightChatHistory && Array.isArray(projectData.rightChatHistory) && window.loadRightChatHistory) {
        setTimeout(() => {
          try {
            window.loadRightChatHistory(projectData.rightChatHistory);
            console.log('右侧对话历史已加载');
          } catch (err) {
            console.error('加载右侧对话历史失败:', err);
          }
        }, 1000);
      }
      
      // 恢复上传的数据
      if (projectData.uploadedData) {
        setTimeout(() => {
          try {
            // 优先尝试加载data目录中的数据文件
            const projectPath = visualImportPath.value;
            
            // 使用electronAPI读取文件，而不是直接使用require
            window.electronAPI.readProjectDataFile(projectPath)
              .then(fileData => {
                if (fileData && fileData.success) {
                  console.log('找到数据文件:', fileData.fileName);
                  
                  // 创建File对象
                  let file;
                  
                  if (fileData.isCSV) {
                    // 对于CSV文件，确保使用UTF-8编码处理
                    const csvContent = new TextDecoder('utf-8').decode(fileData.content);
                    file = new File(
                      [csvContent], 
                      fileData.fileName, 
                      { type: 'text/csv' }
                    );
                  } else {
                    // Excel文件直接使用二进制内容
                    file = new File(
                      [fileData.content], 
                      fileData.fileName, 
                      { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
                    );
                  }
                  
                  // 直接调用handleVisualHelperFile函数加载数据
                  if (typeof window.handleVisualHelperFile === 'function') {
                    window.handleVisualHelperFile(file);
                    console.log('通过handleVisualHelperFile函数成功加载数据文件:', fileData.fileName);
                  }
                } else {
                  console.log('未找到数据文件或读取失败');
                  // 如果没有找到数据文件或加载失败，尝试使用uploadedData中的数据
                  if (projectData.uploadedData.data && Array.isArray(projectData.uploadedData.data)) {
                    if (window.onVisualHelperDataUpload) {
                      window.onVisualHelperDataUpload(projectData.uploadedData.data);
                      console.log('上传数据已恢复（通过data数组）');
                    }
                  }
                }
              })
              .catch(err => {
                console.error('读取项目数据文件失败:', err);
                // 出错后的兜底方案：如果有data数据，直接使用
                if (projectData.uploadedData.data && Array.isArray(projectData.uploadedData.data)) {
                  if (window.onVisualHelperDataUpload) {
                    window.onVisualHelperDataUpload(projectData.uploadedData.data);
                    console.log('上传数据已恢复（通过data数组兜底方案）');
                  }
                }
              });
          } catch (err) {
            console.error('恢复上传数据失败:', err);
            
            // 出错后的兜底方案：如果有data数据，直接使用
            if (projectData.uploadedData.data && Array.isArray(projectData.uploadedData.data)) {
              try {
                if (window.onVisualHelperDataUpload) {
                  window.onVisualHelperDataUpload(projectData.uploadedData.data);
                  console.log('上传数据已恢复（通过data数组兜底方案）');
                }
              } catch (innerErr) {
                console.error('兜底加载数据失败:', innerErr);
              }
            }
          }
        }, 1000);
      }
    } catch (error) {
      console.error('应用导入的项目数据失败:', error);
      throw error;
    }
  }
  
  // ========== 导出弹窗事件处理 ==========
  
  // 显示导出弹窗
  visualExportBtn.addEventListener('click', async () => {
    try {
      // 获取默认路径
      const defaultPath = await getVisualProjectPath();
      visualExportPath.value = defaultPath || '';
      
      // 获取项目标题作为默认项目名
      visualProjectName.value = projectTitleInput ? projectTitleInput.value : 'project';
      
      // 重置其他字段
      visualExportFormat.value = 'folder';
      visualProjectDescription.value = '';
      hideMessage(visualExportMessage);
      
      // 显示弹窗
      visualExportModal.style.display = 'flex';
      setTimeout(() => {
        visualExportModal.classList.add('modal-open');
        visualExportModal.querySelector('.export-modal-content').style.opacity = 1;
        visualExportModal.querySelector('.export-modal-content').style.transform = 'translateY(0)';
      }, 10);
    } catch (error) {
      console.error('显示导出弹窗失败:', error);
      alert('显示导出弹窗失败: ' + error.message);
    }
  });
  
  // 关闭导出弹窗
  function closeExportModal() {
    visualExportModal.classList.remove('modal-open');
    visualExportModal.querySelector('.export-modal-content').style.opacity = 0;
    visualExportModal.querySelector('.export-modal-content').style.transform = 'translateY(-20px)';
    setTimeout(() => {
      visualExportModal.style.display = 'none';
    }, 300);
  }
  
  // 关闭按钮
  closeVisualExportModal.addEventListener('click', closeExportModal);
  cancelVisualExport.addEventListener('click', closeExportModal);
  
  // 选择导出路径
  selectVisualExportPathButton.addEventListener('click', async () => {
    try {
      const result = await window.electronAPI.selectDirectory();
      if (result) {
        visualExportPath.value = result;
      }
    } catch (error) {
      console.error('选择导出路径失败:', error);
      showMessage(visualExportMessage, '选择导出路径失败: ' + error.message, 'error');
    }
  });
  
  // 确认导出
  confirmVisualExport.addEventListener('click', async () => {
    try {
      const path = visualExportPath.value;
      const name = visualProjectName.value;
      const format = visualExportFormat.value;
      const description = visualProjectDescription.value;
      
      if (!path) {
        showMessage(visualExportMessage, '请选择导出路径', 'error');
        return;
      }
      
      if (!name) {
        showMessage(visualExportMessage, '请输入项目名称', 'error');
        return;
      }
      
      // 禁用按钮，显示加载状态
      confirmVisualExport.disabled = true;
      confirmVisualExport.textContent = '导出中...';
      showMessage(visualExportMessage, '正在导出项目，请稍候...', 'success');
      
      // 执行导出
      await exportProject({ path, name, format, description });
      
      // 显示成功消息
      showMessage(visualExportMessage, '项目导出成功！', 'success');
      
      // 3秒后关闭弹窗
      setTimeout(() => {
        closeExportModal();
      }, 3000);
    } catch (error) {
      console.error('导出项目失败:', error);
      showMessage(visualExportMessage, '导出项目失败: ' + error.message, 'error');
    } finally {
      // 恢复按钮状态
      confirmVisualExport.disabled = false;
      confirmVisualExport.textContent = '导出';
    }
  });
  
  // ========== 导入弹窗事件处理 ==========
  
  // 显示导入弹窗
  visualImportBtn.addEventListener('click', () => {
    try {
      // 重置字段
      visualImportPath.value = '';
      hideMessage(visualImportMessage);
      
      // 显示弹窗
      visualImportModal.style.display = 'flex';
      setTimeout(() => {
        visualImportModal.classList.add('modal-open');
        visualImportModal.querySelector('.export-modal-content').style.opacity = 1;
        visualImportModal.querySelector('.export-modal-content').style.transform = 'translateY(0)';
      }, 10);
    } catch (error) {
      console.error('显示导入弹窗失败:', error);
      alert('显示导入弹窗失败: ' + error.message);
    }
  });
  
  // 关闭导入弹窗
  function closeImportModal() {
    visualImportModal.classList.remove('modal-open');
    visualImportModal.querySelector('.export-modal-content').style.opacity = 0;
    visualImportModal.querySelector('.export-modal-content').style.transform = 'translateY(-20px)';
    setTimeout(() => {
      visualImportModal.style.display = 'none';
    }, 300);
  }
  
  // 关闭按钮
  closeVisualImportModal.addEventListener('click', closeImportModal);
  cancelVisualImport.addEventListener('click', closeImportModal);
  
  // 选择导入路径
  selectVisualImportPathButton.addEventListener('click', async () => {
    try {
      const result = await window.electronAPI.selectDirectory();
      if (result) {
        visualImportPath.value = result;
      }
    } catch (error) {
      console.error('选择导入路径失败:', error);
      showMessage(visualImportMessage, '选择导入路径失败: ' + error.message, 'error');
    }
  });
  
  // 确认导入
  confirmVisualImport.addEventListener('click', async () => {
    try {
      const path = visualImportPath.value;
      
      if (!path) {
        showMessage(visualImportMessage, '请选择项目文件夹', 'error');
        return;
      }
      
      // 禁用按钮，显示加载状态
      confirmVisualImport.disabled = true;
      confirmVisualImport.textContent = '导入中...';
      showMessage(visualImportMessage, '正在导入项目，请稍候...', 'success');
      
      // 执行导入
      const projectData = await importProject(path);
      
      // 应用导入的项目数据
      applyImportedProject(projectData);
      
      // 显示成功消息
      showMessage(visualImportMessage, '项目导入成功！', 'success');
      
      // 3秒后关闭弹窗
      setTimeout(() => {
        closeImportModal();
      }, 3000);
    } catch (error) {
      console.error('导入项目失败:', error);
      showMessage(visualImportMessage, '导入项目失败: ' + error.message, 'error');
    } finally {
      // 恢复按钮状态
      confirmVisualImport.disabled = false;
      confirmVisualImport.textContent = '导入';
    }
  });
  
  // 初始化
  function init() {
    console.log('可视化助手项目导入导出功能已初始化');
  }
  
  // 在DOM加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(); 