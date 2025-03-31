/**
 * @description 渲染进程的主要逻辑
 */
console.log('renderer.js 脚本加载成功');

// 在文件顶部添加formatDate函数定义
/**
 * @description 格式化日期字符串
 * @param {String} dateString ISO格式的日期字符串
 * @returns {String} 格式化后的日期字符串 (YYYY-MM-DD)
 */
function formatDate(dateString) {
    if (!dateString) return '未知日期';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString; // 如果解析失败，返回原始字符串
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// 获取 DOM 元素
const searchInput = document.getElementById('searchInput');
const timeRange = document.getElementById('timeRange');
const maxResults = document.getElementById('maxResults');
const loadingDiv = document.getElementById('loading');
const errorDiv = document.getElementById('error');
const papersTableBody = document.getElementById('papersTableBody');
const searchButton = document.getElementById('searchButton');

// 获取新增的DOM元素
const searchField = document.getElementById('searchField');
const operator = document.getElementById('operator');
const addFieldBtn = document.getElementById('addFieldBtn');
const additionalFields = document.getElementById('additionalFields');
const sortBy = document.getElementById('sortBy');
const sortOrder = document.getElementById('sortOrder');
const prevPage = document.getElementById('prevPage');
const nextPage = document.getElementById('nextPage');
const pageInfo = document.getElementById('pageInfo');

// 获取标签页相关DOM元素
const mainSearchTab = document.getElementById('mainSearchTab');
const historySearchTab = document.getElementById('historySearchTab');
const favoritesTab = document.getElementById('favoritesTab');
const settingsTab = document.getElementById('settingsTab');
const knowledgeBaseTab = document.getElementById('knowledgeBaseTab');
const mainSearchContainer = document.getElementById('mainSearchContainer');
const historyContainer = document.getElementById('historyContainer');
const favoritesContainer = document.getElementById('favoritesContainer');
const settingsContainer = document.getElementById('settingsContainer');
const knowledgeBaseContainer = document.getElementById('knowledgeBaseContainer');

// 获取设置相关的DOM元素
const translateButton = document.getElementById('translateButton');
const apiKeyModal = document.getElementById('apiKeyModal');
const apiKeyInput = document.getElementById('apiKeyInput');
const saveApiKeyButton = document.getElementById('saveApiKey');
const cancelApiKeyButton = document.getElementById('cancelApiKey');
const closeModalButton = document.getElementById('closeModal');
const settingsApiKey = document.getElementById('settingsApiKey');
const settingsModelSelection = document.getElementById('settingsModelSelection');
const saveSettingsButton = document.getElementById('saveSettingsButton');
const settingsStatusMessage = document.getElementById('settingsStatusMessage');

// 获取知识库相关的DOM元素
const knowledgeBasePath = document.getElementById('knowledgeBasePath');
const selectKnowledgeBasePathButton = document.getElementById('selectKnowledgeBasePathButton');
const knowledgeBaseGrid = document.getElementById('knowledgeBaseGrid');

// 获取知识库详情页相关的DOM元素
const detailModal = document.getElementById('detailModal');
const closeDetailModal = document.getElementById('closeDetailModal');
const detailTitle = document.getElementById('detailTitle');
const detailAuthors = document.getElementById('detailAuthors');
const detailDate = document.getElementById('detailDate');
const detailCategories = document.getElementById('detailCategories');
const detailAbstract = document.getElementById('detailAbstract');
const detailNotes = document.getElementById('detailNotes');
const editNotesButton = document.getElementById('editNotesButton');
const notesViewMode = document.getElementById('notesViewMode');
const notesEditMode = document.getElementById('notesEditMode');
const notesTextarea = document.getElementById('notesTextarea');
const saveNotes = document.getElementById('saveNotes');
const cancelEditNotes = document.getElementById('cancelEditNotes');

// 获取导出相关的DOM元素
const selectAllPapers = document.getElementById('selectAllPapers');
const exportButton = document.getElementById('exportButton');
const paperExportPath = document.getElementById('paperExportPath');
const selectPathButton = document.getElementById('selectPathButton');
const exportModal = document.getElementById('exportModal');
const closeExportModal = document.getElementById('closeExportModal');
const cancelExport = document.getElementById('cancelExport');
const confirmExport = document.getElementById('confirmExport');
const exportMessage = document.getElementById('exportMessage');

// 获取导出选项弹窗相关的DOM元素
const exportOptionsModal = document.getElementById('exportOptionsModal');
const closeExportOptionsModal = document.getElementById('closeExportOptionsModal');
const exportToFile = document.getElementById('exportToFile');
const exportToKnowledgeBase = document.getElementById('exportToKnowledgeBase');

// 当前页码和每页数量
let currentPage = 1;
let totalResults = 0;
let apiTotalResults = 0; // 添加API返回的原始总结果数变量

// 添加变量来存储所有获取到的论文和全局状态
let allPapers = []; // 存储所有获取到的论文
let userLimitedTotal = 0; // 用户限制的总论文数
let selectedPaperIds = new Set(); // 存储被选中的论文ID（使用链接作为唯一标识）
let exportPath = ''; // 存储导出路径

// 翻译相关的状态
let isTranslated = false; // 当前是否处于翻译状态
let originalPapers = []; // 存储原始论文数据
let translatedPapers = []; // 存储已翻译的论文数据
let apiKey = null; // 存储当前API密钥
let lastUsedTranslationModel = null; // 存储上次使用的翻译模型
let isTranslationCancelled = false; // 控制翻译取消

// 知识库相关的全局变量
let knowledgeBaseItems = []; // 存储知识库中的所有论文条目
let currentDetailItem = null; // 当前查看详情的论文
let knowledgeBaseSavePath = ''; // 知识库存储路径

// 获取语言切换按钮
const toggleLanguageButton = document.getElementById('toggleLanguageButton');
const languageToggleContainer = document.getElementById('languageToggleContainer');

// 当前是否显示原文
let isShowingOriginal = false;

// 获取知识库导入/导出按钮
const importKnowledgeBase = document.getElementById('importKnowledgeBase');
const exportKnowledgeBase = document.getElementById('exportKnowledgeBase');

/**
 * @description 获取日期范围
 * @returns {Object} 开始和结束日期
 */
function getDateRange() {
    const now = new Date();
    const end = now.toISOString();
    let start = new Date();

    switch(timeRange.value) {
        case 'last_month':
            start.setMonth(start.getMonth() - 1);
            break;
        case 'last_3_months':
            start.setMonth(start.getMonth() - 3);
            break;
        case 'last_6_months':
            start.setMonth(start.getMonth() - 6);
            break;
        case 'last_year':
            start.setFullYear(start.getFullYear() - 1);
            break;
        default:
            start = new Date(2000, 0, 1); // 对于"所有时间"，使用较早的日期
    }

    return {
        start: start.toISOString(),
        end: end
    };
}

/**
 * @description 创建新的搜索字段行
 * @returns {HTMLDivElement} 搜索字段行元素
 */
function createSearchFieldRow() {
    const fieldRow = document.createElement('div');
    fieldRow.className = 'field-row';
    fieldRow.style.marginBottom = '0px'; // 设置为0以消除额外间距
    
    // 创建一个关系运算符选择器（AND/OR/NOT）
    const operatorSelect = document.createElement('select');
    operatorSelect.className = 'search-operator';
    operatorSelect.innerHTML = operator.innerHTML;
    
    const fieldGroup = document.createElement('div');
    fieldGroup.className = 'field-group';
    
    const select = document.createElement('select');
    select.className = 'search-field';
    select.setAttribute('autocomplete', 'off'); // 添加autocomplete="off"属性
    select.innerHTML = searchField.innerHTML;
    
    // 添加click事件处理，防止下拉框点击后立即关闭
    select.addEventListener('click', function(e) {
        // 仅阻止事件冒泡，让浏览器处理下拉框的展开和收起
        e.stopPropagation();
    });
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'search-input';
    input.placeholder = '输入搜索关键词...';
    
    // 创建按钮容器
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'button-container';
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'danger-button';
    removeBtn.textContent = '删除';
    removeBtn.onclick = () => fieldRow.remove();
    
    // 将按钮添加到按钮容器
    buttonContainer.appendChild(removeBtn);
    
    // 组装元素
    fieldRow.appendChild(operatorSelect);
    fieldGroup.appendChild(select);
    fieldGroup.appendChild(input);
    fieldRow.appendChild(fieldGroup);
    fieldRow.appendChild(buttonContainer);
    
    return fieldRow;
}

/**
 * @description 获取所有搜索条件
 * @returns {Array} 搜索条件数组
 */
function getSearchQueries() {
    const queries = [];
    
    // 添加主搜索字段
    const mainTerm = searchInput.value.trim();
    if (mainTerm) {
        queries.push({
            field: searchField.value,
            term: mainTerm,
            operator: '' // 第一个条件不需要运算符
        });
    }
    
    // 添加额外搜索字段
    const fieldRows = additionalFields.getElementsByClassName('field-row');
    Array.from(fieldRows).forEach(row => {
        const field = row.querySelector('.search-field').value;
        const term = row.querySelector('.search-input').value.trim();
        const operator = row.querySelector('.search-operator').value;
        
        if (term) {  // 只添加非空的搜索条件
            queries.push({ field, term, operator });
        }
    });
    
    // 如果没有任何有效的搜索条件，添加一个空条件
    if (queries.length === 0) {
        queries.push({
            field: 'all',
            term: '',  // 默认为空
            operator: '' // 第一个条件不需要运算符
        });
    }
    
    console.log('构建的搜索条件:', queries);
    return queries;
}

// 在搜索函数中添加保存历史记录的逻辑
const originalSearchPapers = window.searchPapers;
// 添加标志位，表示当前搜索是否来自历史记录应用
let isApplyingFromHistory = false;

window.searchPapers = async function() {
    // 获取当前搜索条件
    const searchData = {
        searchField: document.getElementById('searchField').value,
        searchInput: document.getElementById('searchInput').value,
        timeRange: document.getElementById('timeRange').value,
        sortBy: document.getElementById('sortBy').value,
        sortOrder: document.getElementById('sortOrder').value,
        maxResults: document.getElementById('maxResults').value,
        additionalFields: [] // 需要收集额外字段
    };
    
    // 收集额外搜索字段
    const fieldRows = document.getElementById('additionalFields').getElementsByClassName('field-row');
    Array.from(fieldRows).forEach(row => {
        const field = row.querySelector('.search-field').value;
        const term = row.querySelector('.search-input').value.trim();
        const operator = row.querySelector('.search-operator').value;
        
        if (term) {  // 只添加非空的搜索条件
            searchData.additionalFields.push({ field, term, operator });
        }
    });
    
    // 暂存搜索数据，但先不添加到历史记录
    // 我们会在搜索结果返回后，只有在有结果时才添加
    const tempSearchData = {...searchData};
    
    try {
    // 调用原始搜索函数
    const result = await originalSearchPapers();
    
    // 只有在搜索结果有效且不是从历史记录应用时，才添加到历史记录
    if (!isApplyingFromHistory && allPapers && allPapers.length > 0) {
        addToHistory(tempSearchData);
    }
    
    // 重置标志位
    isApplyingFromHistory = false;
    
    return result;
    } catch (error) {
        console.error('搜索出错:', error);
        isApplyingFromHistory = false;
        throw error; // 继续抛出错误以便上层处理
    }
};

/**
 * @description 搜索论文
 */
async function searchPapers() {
    console.log('开始搜索论文...');
    try {
        // 检查electronAPI是否存在
        if (!window.electronAPI) {
            throw new Error('API未正确加载，请重启应用程序');
        }
        
        // 检查fetchArxivPapers函数是否存在
        if (typeof window.electronAPI.fetchArxivPapers !== 'function') {
            throw new Error('fetchArxivPapers函数未找到，请重启应用程序');
        }
        
        // 如果有正在进行的翻译任务，中断它
        const translationProgressContainer = document.getElementById('translationProgressContainer');
        if (translationProgressContainer) {
            console.log('检测到正在进行的翻译任务，将其中断');
            // 设置取消标志
            isTranslationCancelled = true;
            // 移除进度条
            if (translationProgressContainer.parentNode) {
                translationProgressContainer.parentNode.removeChild(translationProgressContainer);
            }
        }
        
        // 显示加载状态
        loadingDiv.style.display = 'block';
        errorDiv.style.display = 'none';
        papersTableBody.innerHTML = '';
        
        // 重置当前页为第一页
        currentPage = 1;
        
        // 重置全局变量
        allPapers = [];
        totalResults = 0;
        apiTotalResults = 0;
        userLimitedTotal = 0;

        // 重置翻译相关状态
        isTranslated = false;
        originalPapers = [];
        translatedPapers = [];
        lastUsedTranslationModel = '';
        // 更新翻译按钮状态
        translateButton.textContent = '翻译';
        translateButton.classList.remove('active');
        translateButton.disabled = false; // 确保翻译按钮是启用状态

        // 获取搜索参数
        const queries = getSearchQueries();
        
        // 检查搜索条件是否为空
        if (!queries || queries.length === 0) {
            throw new Error('请输入搜索条件');
        }
        
        const dateRange = getDateRange();
        const perPage = 20; // 每页固定显示20篇
        
        // 获取用户设置的总结果数限制（不是每页显示数量）
        const userMaxResults = parseInt(maxResults.value);
        const maxResultsValue = isNaN(userMaxResults) ? 40 : userMaxResults;
        
        // 计算起始索引，注意 arXiv API 使用从0开始的索引
        const start = 0; // 总是从0开始，获取全部数据
        
        console.log('搜索参数:', {
            queries,
            dateRange,
            每页显示: perPage, // 固定值
            用户总限制: maxResultsValue, // 用户输入的值，限制总共返回多少结果
            起始位置: start,
            sortBy: sortBy.value,
            sortOrder: sortOrder.value
        });

        // 调用 API 获取论文数据（一次性获取所有用户限制的数据）
        const result = await window.electronAPI.fetchArxivPapers(queries, {
            start: start,
            maxResults: maxResultsValue, // 直接使用用户限制的结果数
            dateStart: dateRange.start,
            dateEnd: dateRange.end,
            sortBy: sortBy.value,
            sortOrder: sortOrder.value,
            totalMaxResults: maxResultsValue // 用户设定的总结果数限制
        });
        
        console.log('API 返回数据:', result);
        
        // 检查返回结果中是否包含错误
        if (result.error) {
            throw new Error(`API错误: ${result.error}`);
        }
        
        // 保存原始API总结果数
        if (typeof result.originalApiTotal === 'number') {
            apiTotalResults = result.originalApiTotal;
            console.log('设置API总结果数:', apiTotalResults);
        } else {
            apiTotalResults = 0;
            console.warn('API总结果数无效:', result.originalApiTotal);
        }
        
        // 保存用户限制后的总结果数
        if (typeof result.totalResults === 'number') {
            totalResults = result.totalResults;
            userLimitedTotal = totalResults; // 存储用户限制后的总数
            console.log('设置用户限制后总结果数:', userLimitedTotal);
        } else {
            // 尝试解析为数字
            const parsedTotal = parseInt(result.totalResults);
            totalResults = isNaN(parsedTotal) ? 0 : parsedTotal;
            userLimitedTotal = totalResults;
            console.log('解析用户限制后总结果数:', userLimitedTotal);
        }
        
        // 保存所有获取到的论文
        if (Array.isArray(result.papers)) {
            allPapers = result.papers; // 保存所有论文到全局变量
            console.log('获取到论文数量:', allPapers.length);
        } else {
            allPapers = [];
            console.warn('返回的论文数据无效');
        }
        
        console.log('搜索结果摘要:', {
            获取到论文数量: allPapers.length,
            API返回总数: apiTotalResults,
            用户限制后总数: userLimitedTotal,
            用户限制: maxResultsValue
        });

        if (allPapers.length === 0) {
            errorDiv.textContent = '未找到相关论文，请尝试修改搜索条件';
            errorDiv.style.display = 'block';
        } else {
            // 渲染当前页的论文数据
            renderPapers();
        }
        
        // 返回搜索结果，以便上层函数决定是否保存历史记录
        return {
            success: true,
            resultsCount: allPapers.length,
            apiTotalResults: apiTotalResults
        };
    } catch (error) {
        console.error('搜索论文失败:', error);
        errorDiv.textContent = '搜索论文失败: ' + (error.message || '未知错误');
        errorDiv.style.display = 'block';
        
        // 重置变量
        totalResults = 0;
        apiTotalResults = 0;
        userLimitedTotal = 0;
        allPapers = [];
        
        // 返回错误结果
        return {
            success: false,
            error: error.message || '未知错误'
        };
    } finally {
        // 无论成功还是失败，都更新分页状态并隐藏加载状态
        loadingDiv.style.display = 'none';
        updatePagination();
        
        // 确保没有元素覆盖搜索框
        // 延迟一会儿执行，确保DOM完全更新
        setTimeout(() => {
            // 确保加载遮罩完全隐藏
            loadingDiv.style.display = 'none';
            
            // 如果可能有其他动态创建的元素覆盖搜索框的情况，在这里处理
            // 例如，确保任何可能的模态框或浮层被隐藏
            const possibleOverlays = document.querySelectorAll('.translationProgress, .modal');
            possibleOverlays.forEach(overlay => {
                if (window.getComputedStyle(overlay).getPropertyValue('position') === 'fixed' || 
                    window.getComputedStyle(overlay).getPropertyValue('position') === 'absolute') {
                    overlay.style.display = 'none';
                }
            });
            
            // 确保搜索输入框是可交互的
            searchInput.style.pointerEvents = 'auto';
            searchInput.style.zIndex = '1';
        }, 100);
    }
}

/**
 * @description 渲染当前页的论文
 */
function renderPapers() {
    // 清空表格
    papersTableBody.innerHTML = '';
    
    // 清除错误信息
    errorDiv.style.display = 'none';
    
    const perPage = 20; // 每页固定显示20篇
    
    // 计算当前页应该显示的论文
    const startIndex = (currentPage - 1) * perPage;
    const endIndex = Math.min(startIndex + perPage, allPapers.length);
    
    console.log('渲染论文:', {
        当前页码: currentPage,
        开始索引: startIndex,
        结束索引: endIndex,
        总论文数: allPapers.length,
        用户限制总数: userLimitedTotal
    });
    
    // 获取当前页的论文
    const currentPagePapers = allPapers.slice(startIndex, endIndex);
    
    if (currentPagePapers.length === 0) {
        errorDiv.textContent = '当前页没有数据，请返回上一页';
        errorDiv.style.display = 'block';
        return;
    }
    
    // 渲染论文数据
    currentPagePapers.forEach((paper, index) => {
        const paperIndex = startIndex + index + 1;
        const row = document.createElement('tr');
        row.dataset.id = paper.id || paper.link; // 使用ID或链接作为标识符
        
        // 添加勾选框单元格（第1列）
        const checkboxCell = document.createElement('td');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = selectedPaperIds.has(paper.id || paper.link);
        checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
                selectedPaperIds.add(paper.id || paper.link);
            } else {
                selectedPaperIds.delete(paper.id || paper.link);
                // 如果取消选中某个论文，确保全选框不再被选中
                selectAllPapers.checked = false;
            }
        });
        checkboxCell.appendChild(checkbox);
        
        // 创建标题单元格（第2列）
        const titleCell = document.createElement('td');
        const titleContainer = document.createElement('div');
        titleContainer.style.display = 'flex';
        titleContainer.style.flexDirection = 'column';
        
        const titleDiv = document.createElement('div');
        titleDiv.className = 'title-cell';
        titleDiv.innerHTML = `<small style="color: #666;">[${paperIndex}]</small> ${paper.title}`;
        
        const categoryDiv = document.createElement('div');
        categoryDiv.style.marginTop = '5px';
        categoryDiv.style.fontSize = '0.8em';
        categoryDiv.style.color = '#666';
        categoryDiv.textContent = `分类: ${paper.categories.join(', ')}`;
        
        titleContainer.appendChild(titleDiv);
        titleContainer.appendChild(categoryDiv);
        titleCell.appendChild(titleContainer);
        
        // 创建作者单元格（第3列）
        const authorCell = document.createElement('td');
        const authorContainer = document.createElement('div');
        authorContainer.style.height = '100%';
        
        const authorDiv = document.createElement('div');
        authorDiv.className = 'authors-cell';
        authorDiv.textContent = paper.authors;
        
        // 将作者省略号始终显示在最后一行
        authorContainer.appendChild(authorDiv);
        authorCell.appendChild(authorContainer);
        
        // 创建日期单元格（第4列）
        const dateCell = document.createElement('td');
        dateCell.textContent = new Date(paper.published).toLocaleDateString('zh-CN');
        
        // 创建链接单元格（第5列）
        const linkCell = document.createElement('td');
        linkCell.className = 'link-cell';
        
        const link = document.createElement('a');
        link.href = paper.link;
        link.textContent = '查看';
        link.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                console.log('点击链接，尝试打开:', paper.link);
                const success = await window.electronAPI.openExternal(paper.link);
                if (!success) {
                    console.warn('通过API打开链接失败，尝试使用备用方法');
                    // 备用方法：尝试使用window.open
                    window.open(paper.link, '_blank');
                }
            } catch (error) {
                console.error('打开链接失败:', error);
                alert(`无法打开链接，请手动复制并在浏览器中打开: ${paper.link}`);
            }
        });
        
        linkCell.appendChild(link);
        
        // 创建摘要单元格（第6列）
        const summaryCell = document.createElement('td');
        
        const summaryDiv = document.createElement('div');
        summaryDiv.className = 'abstract-cell';
        summaryDiv.innerHTML = paper.summary;
        
        // 动态调整摘要区域高度和作者区域高度，根据标题高度
        setTimeout(() => {
            // 获取标题总高度（标题+分类）
            const titleTotalHeight = titleContainer.offsetHeight;
            // 标题最小高度设为112px（约8行文本）
            const minHeight = 112; // 默认8行约112px
            
            // 设置摘要区域高度为标题高度和最小高度中的较大值
            const summaryHeight = Math.max(titleTotalHeight, minHeight);
            summaryDiv.style.height = `${summaryHeight}px`;
            
            // 同时调整作者区域的高度，使其与摘要区域高度一致
            authorDiv.style.height = `${summaryHeight}px`;
            
            // 同时设置行的最小高度，确保一致性
            const rowHeight = summaryHeight + 24; // +24是为了算上padding
            row.style.minHeight = `${rowHeight}px`;

            // 如果标题过短，强制调整其容器的最小高度也达到8行
            if (titleTotalHeight < minHeight) {
                titleContainer.style.minHeight = `${minHeight}px`;
            }
        }, 50);
        
        summaryCell.appendChild(summaryDiv);
        
        // 将所有单元格添加到行，按照表头顺序依次添加
        row.appendChild(checkboxCell);  // 第1列：勾选框
        row.appendChild(titleCell);     // 第2列：标题
        row.appendChild(authorCell);    // 第3列：作者
        row.appendChild(dateCell);      // 第4列：日期
        row.appendChild(linkCell);      // 第5列：链接
        row.appendChild(summaryCell);   // 第6列：摘要
        
        papersTableBody.appendChild(row);
    });
    
    // 更新论文的选中状态
    updateCheckboxStates();
}

/**
 * @description 更新分页状态
 */
function updatePagination() {
    const perPage = 20; // 每页固定显示20篇
    
    // 获取实际可用的论文数量
    const actualPapers = allPapers.length;
    
    // 计算总页数，确保至少为1页
    const totalPages = Math.max(1, Math.ceil(actualPapers / perPage));
    
    // 确保当前页码在有效范围内
    currentPage = Math.max(1, Math.min(parseInt(currentPage) || 1, totalPages));
    
    console.log('更新分页状态:', {
        当前页码: currentPage,
        总页数: totalPages,
        实际论文数量: actualPapers,
        用户限制总数: userLimitedTotal,
        API总结果数: apiTotalResults,
        每页显示: perPage
    });
    
    // 更新分页信息文本
    if (allPapers.length === 0) {
        // 初始状态或未找到结果时不显示分页信息
        pageInfo.textContent = '';
    } else {
        // 显示分页信息，包含API返回的总结果数、用户限制和实际获取到的论文数
        pageInfo.textContent = `第 ${currentPage} 页 / 共 ${totalPages} 页 (共 ${apiTotalResults} 条结果，显示 ${actualPapers} 条)`;
    }
    
    // 更新分页按钮状态
    prevPage.disabled = currentPage <= 1;
    nextPage.disabled = currentPage >= totalPages || actualPapers === 0;
}

// 添加事件监听器
addFieldBtn.addEventListener('click', () => {
    additionalFields.appendChild(createSearchFieldRow());
});

// 监听分页按钮点击
prevPage.addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage -= 1;
        console.log(`切换到上一页: ${currentPage}`);
        renderPapers(); // 重新渲染当前页的数据
        updatePagination();
    }
});

nextPage.addEventListener('click', () => {
    const perPage = 20; // 每页固定显示20篇
    const totalPages = Math.max(1, Math.ceil(allPapers.length / perPage));
    
    if (currentPage < totalPages) {
        currentPage += 1;
        console.log(`切换到下一页: ${currentPage}`);
        renderPapers(); // 重新渲染当前页的数据
        updatePagination();
    }
});

// 监听排序和每页数量变化
sortBy.addEventListener('change', () => {
    currentPage = 1;
    searchPapers();
});

sortOrder.addEventListener('change', () => {
    currentPage = 1;
    searchPapers();
});

// 监听每页数量变化
maxResults.addEventListener('change', () => {
    // 处理输入值，确保它在1-100之间
    let value = parseInt(maxResults.value);
    if (isNaN(value)) {
        value = 40; // 默认值
    }
    
    // 限制在1-100之间
    value = Math.min(Math.max(value, 1), 100);
    maxResults.value = value;
    
    console.log(`maxResults 值已更改为: ${value}`);
    
    currentPage = 1; // 重置到第一页
    searchPapers();
});

// 页面加载后初始化
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM 加载完成');
    // 初始化分页变量
    currentPage = 1;
    totalResults = 0;
    apiTotalResults = 0;
    userLimitedTotal = 0;
    allPapers = [];
    
    // 初始化用户输入
    if (!maxResults.value || isNaN(parseInt(maxResults.value))) {
        maxResults.value = 40;
    }
    
    // 修复搜索字段下拉框点击后立即关闭的问题
    if (searchField) {
        // 使用onclick事件，这比mousedown更适合处理下拉框
        searchField.addEventListener('click', function(e) {
            // 仅阻止事件冒泡，让浏览器处理下拉框的展开和收起
            e.stopPropagation();
        });
    }
    
    // 禁用分页按钮，直到有结果
    prevPage.disabled = true;
    nextPage.disabled = true;
    
    console.log('初始化状态:', {
        当前页码: currentPage,
        总结果数: totalResults,
        maxResults值: maxResults.value
    });
    
    // 更新分页状态
    updatePagination();
    
    // 渲染历史记录
    renderSearchHistory();
    
    // 清空历史按钮事件
    document.getElementById('clearHistory').addEventListener('click', () => {
        if (confirm('确定要清空所有搜索历史吗？')) {
            clearHistory();
        }
    });
    
    // 添加导航栏切换事件
    const mainSearchTab = document.getElementById('mainSearchTab');
    const historySearchTab = document.getElementById('historySearchTab');
    const favoritesTab = document.getElementById('favoritesTab');
    const mainSearchContainer = document.getElementById('mainSearchContainer');
    const historyContainer = document.getElementById('historyContainer');
    const favoritesContainer = document.getElementById('favoritesContainer');
    const mainSearchResults = document.getElementById('mainSearchResults');
    
    mainSearchTab.addEventListener('click', () => {
        mainSearchTab.classList.add('active');
        historySearchTab.classList.remove('active');
        favoritesTab.classList.remove('active');
        settingsTab.classList.remove('active');
        knowledgeBaseTab.classList.remove('active');
        
        mainSearchContainer.style.display = 'block';
        historyContainer.style.display = 'none';
        favoritesContainer.style.display = 'none';
        settingsContainer.style.display = 'none';
        knowledgeBaseContainer.style.display = 'none';
        
        // 显示搜索结果区域
        document.getElementById('mainSearchResults').style.display = 'block';
    });
    
    historySearchTab.addEventListener('click', () => {
        mainSearchTab.classList.remove('active');
        historySearchTab.classList.add('active');
        favoritesTab.classList.remove('active');
        settingsTab.classList.remove('active');
        knowledgeBaseTab.classList.remove('active');
        
        mainSearchContainer.style.display = 'none';
        historyContainer.style.display = 'block';
        favoritesContainer.style.display = 'none';
        settingsContainer.style.display = 'none';
        knowledgeBaseContainer.style.display = 'none';
        
        // 隐藏搜索结果区域
        document.getElementById('mainSearchResults').style.display = 'none';
        
        // 加载历史搜索记录
        renderSearchHistory();
    });
    
    favoritesTab.addEventListener('click', () => {
        mainSearchTab.classList.remove('active');
        historySearchTab.classList.remove('active');
        favoritesTab.classList.add('active');
        settingsTab.classList.remove('active');
        knowledgeBaseTab.classList.remove('active');
        
        mainSearchContainer.style.display = 'none';
        historyContainer.style.display = 'none';
        favoritesContainer.style.display = 'block';
        settingsContainer.style.display = 'none';
        knowledgeBaseContainer.style.display = 'none';
        
        // 隐藏搜索结果区域
        document.getElementById('mainSearchResults').style.display = 'none';
        
        // 加载收藏夹
        renderFavorites();
    });
    
    settingsTab.addEventListener('click', () => {
        mainSearchTab.classList.remove('active');
        historySearchTab.classList.remove('active');
        favoritesTab.classList.remove('active');
        settingsTab.classList.add('active');
        knowledgeBaseTab.classList.remove('active');
        
        mainSearchContainer.style.display = 'none';
        historyContainer.style.display = 'none';
        favoritesContainer.style.display = 'none';
        settingsContainer.style.display = 'block';
        knowledgeBaseContainer.style.display = 'none';
        
        // 隐藏搜索结果区域
        document.getElementById('mainSearchResults').style.display = 'none';
        
        loadSettings();
    });
    
    // 添加知识库标签页点击事件
    knowledgeBaseTab.addEventListener('click', () => {
        mainSearchTab.classList.remove('active');
        historySearchTab.classList.remove('active');
        favoritesTab.classList.remove('active');
        settingsTab.classList.remove('active');
        knowledgeBaseTab.classList.add('active');
        
        mainSearchContainer.style.display = 'none';
        historyContainer.style.display = 'none';
        favoritesContainer.style.display = 'none';
        settingsContainer.style.display = 'none';
        knowledgeBaseContainer.style.display = 'block';
        
        // 隐藏搜索结果区域
        document.getElementById('mainSearchResults').style.display = 'none';
        
        // 加载并渲染知识库
        renderKnowledgeBase();
    });
    
    // 确保翻译按钮有事件监听
    if (translateButton) {
        console.log('为翻译按钮添加事件监听器');
        translateButton.addEventListener('click', toggleTranslation);
    } else {
        console.error('无法找到翻译按钮元素!');
    }
    
    // 为设置界面中的外部链接添加点击事件
    const siliconFlowLink = document.getElementById('siliconFlowLink');
    if (siliconFlowLink) {
        siliconFlowLink.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                console.log('点击SiliconFlow链接');
                const url = 'https://cloud.siliconflow.cn/account/ak';
                const success = await window.electronAPI.openExternal(url);
                if (!success) {
                    console.warn('通过API打开链接失败，尝试使用备用方法');
                    // 备用方法：尝试使用window.open
                    window.open(url, '_blank');
                }
            } catch (error) {
                console.error('打开SiliconFlow链接失败:', error);
                alert('无法打开SiliconFlow链接，请手动访问: https://cloud.siliconflow.cn/account/ak');
            }
        });
    }
    
    // 为JSON转Excel工具链接添加点击事件
    const jsonToExcelLink = document.getElementById('jsonToExcelLink');
    if (jsonToExcelLink) {
        jsonToExcelLink.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                console.log('点击JSON转Excel链接');
                const url = 'https://wejson.cn/json2excel/';
                const success = await window.electronAPI.openExternal(url);
                if (!success) {
                    console.warn('通过API打开链接失败，尝试使用备用方法');
                    // 备用方法：尝试使用window.open
                    window.open(url, '_blank');
                }
            } catch (error) {
                console.error('打开JSON转Excel链接失败:', error);
                alert('无法打开JSON转Excel链接，请手动访问: https://wejson.cn/json2excel/');
            }
        });
    }
    
    // 确保搜索框始终可点击
    searchInput.addEventListener('click', (e) => {
        console.log('搜索框被点击');
        // 确保搜索框是焦点
        searchInput.focus();
        e.stopPropagation();
    });
    
    // 为searchInput的父元素添加点击事件，确保事件冒泡正常
    const searchGroup = searchInput.parentElement;
    if (searchGroup) {
        searchGroup.addEventListener('click', () => {
            // 如果点击了搜索组，也应将焦点设置到输入框
            searchInput.focus();
        });
    }
});

/**
 * @description 搜索历史管理
 */
const HISTORY_KEY = 'arxiv_search_history';
const MAX_HISTORY_ITEMS = 10;

/**
 * @description 获取搜索历史
 * @returns {Array} 搜索历史数组
 */
function getSearchHistory() {
    const history = localStorage.getItem(HISTORY_KEY);
    return history ? JSON.parse(history) : [];
}

/**
 * @description 保存搜索历史
 * @param {Array} history 搜索历史数组
 */
function saveSearchHistory(history) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

/**
 * @description 添加搜索记录到历史
 * @param {Object} searchData 搜索数据
 */
function addToHistory(searchData) {
    const history = getSearchHistory();
    const favorites = getFavorites();
    
    // 首先检查搜索条件是否与历史记录中的某项匹配
    // 或者是否与收藏夹中的某项匹配（仅检查核心搜索条件）
    const isDuplicate = history.some(item => isSameSearchCriteria(item, searchData)) || 
                         favorites.some(item => isSameSearchCriteria(item, searchData));
    
    // 如果是重复的搜索条件，则不添加到历史记录
    if (isDuplicate) {
        console.log('搜索条件重复或与收藏记录匹配，不添加到历史记录');
        return;
    }
    
    const newEntry = {
        ...searchData,
        timestamp: new Date().toISOString(),
        id: Date.now()
    };
    
    // 添加到历史记录开头
    history.unshift(newEntry);
    
    // 限制历史记录数量
    if (history.length > MAX_HISTORY_ITEMS) {
        history.pop();
    }
    
    saveSearchHistory(history);
    renderSearchHistory();
}

/**
 * @description 判断两个搜索条件是否匹配
 * @param {Object} item1 搜索条件1
 * @param {Object} item2 搜索条件2
 * @returns {Boolean} 是否匹配
 */
function isSameSearchCriteria(item1, item2) {
    // 检查主搜索字段和额外字段是否相同
    // 如果主搜索内容不同，或者搜索字段类型不同，则认为是不同的搜索
    if (item1.searchInput !== item2.searchInput || item1.searchField !== item2.searchField) {
        return false;
    }
    
    // 检查额外搜索字段是否匹配
    const additionalFields1 = item1.additionalFields || [];
    const additionalFields2 = item2.additionalFields || [];
    
    // 如果额外字段数量不同，认为是不同的搜索
    if (additionalFields1.length !== additionalFields2.length) {
        return false;
    }
    
    // 检查每个额外字段是否都匹配
    for (let i = 0; i < additionalFields1.length; i++) {
        const field1 = additionalFields1[i];
        const field2 = additionalFields2[i];
        
        if (field1.field !== field2.field || field1.term !== field2.term || field1.operator !== field2.operator) {
            return false;
        }
    }
    
    // 核心搜索内容匹配，现在检查是否仅有次要条件不同
    // 包括：时间范围、排序方式、排序顺序、结果限制
    const isOnlySecondaryDifferent = 
        (item1.timeRange !== item2.timeRange) ||
        (item1.sortBy !== item2.sortBy) ||
        (item1.sortOrder !== item2.sortOrder) ||
        (item1.maxResults !== item2.maxResults);
    
    // 如果只有次要条件不同，我们认为它们是相同的搜索
    // 返回true表示匹配，因此不会添加到历史记录
    return true; // 只要核心搜索条件匹配，就视为相同搜索
}

/**
 * @description 从历史记录中删除指定项
 * @param {number} id 历史记录ID
 */
function removeFromHistory(id) {
    const history = getSearchHistory();
    const newHistory = history.filter(item => item.id !== id);
    saveSearchHistory(newHistory);
    renderSearchHistory();
}

/**
 * @description 清空所有历史记录
 */
function clearHistory() {
    localStorage.removeItem(HISTORY_KEY);
    renderSearchHistory();
}

/**
 * @description 应用搜索条件到界面
 * @param {Object} searchItem 搜索条件项
 */
function applySearchConditions(searchItem) {
    // 设置搜索字段
    document.getElementById('searchField').value = searchItem.searchField;
    document.getElementById('searchInput').value = searchItem.searchInput;
    
    // 设置时间范围
    document.getElementById('timeRange').value = searchItem.timeRange;
    
    // 设置排序条件
    document.getElementById('sortBy').value = searchItem.sortBy;
    document.getElementById('sortOrder').value = searchItem.sortOrder;
    
    // 设置结果限制
    document.getElementById('maxResults').value = searchItem.maxResults;
    
    // 清空额外字段容器
    const additionalFieldsContainer = document.getElementById('additionalFields');
    additionalFieldsContainer.innerHTML = '';
    
    // 如果有额外的搜索字段，重新创建它们
    if (searchItem.additionalFields && searchItem.additionalFields.length > 0) {
        searchItem.additionalFields.forEach(field => {
            // 创建新的搜索字段行
            const fieldRow = createSearchFieldRow();
            
            // 设置搜索字段值
            const fieldSelect = fieldRow.querySelector('.search-field');
            const fieldInput = fieldRow.querySelector('.search-input');
            const fieldOperator = fieldRow.querySelector('.search-operator');
            
            if (fieldSelect) fieldSelect.value = field.field;
            if (fieldInput) fieldInput.value = field.term;
            if (fieldOperator) fieldOperator.value = field.operator;
            
            // 添加到额外字段容器
            additionalFieldsContainer.appendChild(fieldRow);
        });
    }
    
    // 切换到主搜索界面
    document.getElementById('mainSearchTab').click();
    
    // 执行搜索
    searchPapers();
}

/**
 * @description 应用历史记录中的搜索条件
 * @param {Object} historyItem 历史记录项
 */
function applyHistorySearch(historyItem) {
    // 设置标志位，表示当前搜索来自历史记录应用
    isApplyingFromHistory = true;
    
    // 将使用的历史记录移到顶部（更新时间戳）
    const history = getSearchHistory();
    const itemIndex = history.findIndex(item => item.id === historyItem.id);
    
    if (itemIndex !== -1) {
        // 从历史中移除这个项目
        const item = history.splice(itemIndex, 1)[0];
        
        // 更新时间戳
        item.timestamp = new Date().toISOString();
        
        // 添加到历史顶部
        history.unshift(item);
        
        // 保存更新后的历史
        saveSearchHistory(history);
        
        // 刷新历史显示
        renderSearchHistory();
    }
    
    // 应用搜索条件
    applySearchConditions(historyItem);
}

/**
 * @description 从收藏夹中应用搜索条件
 * @param {Object} favoriteItem 收藏记录项
 */
function applyFavoriteSearch(favoriteItem) {
    // 设置标志位，表示当前搜索来自收藏夹应用
    isApplyingFromHistory = true;
    
    // 将使用的收藏记录更新时间戳
    const favorites = getFavorites();
    const itemIndex = favorites.findIndex(item => item.id === favoriteItem.id);
    
    if (itemIndex !== -1) {
        // 从收藏夹中取出这个项目
        const item = favorites[itemIndex];
        
        // 更新时间戳
        item.timestamp = new Date().toISOString();
        
        // 保存更新后的收藏列表
        saveFavorites(favorites);
        
        // 刷新收藏夹显示
        renderFavorites();
    }
    
    // 应用搜索条件
    applySearchConditions(favoriteItem);
}

/**
 * @description 渲染搜索历史列表
 */
function renderSearchHistory() {
    const historyList = document.getElementById('historyList');
    const history = getSearchHistory();
    const favorites = getFavorites();
    
    if (history.length === 0) {
        historyList.innerHTML = '<div class="history-item">暂无搜索历史</div>';
        return;
    }
    
    historyList.innerHTML = '';
    
    history.forEach(item => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        historyItem.style.cursor = 'pointer';
        
        // 创建内容区域
        const contentDiv = document.createElement('div');
        contentDiv.className = 'history-content';
        
        // 构建显示的搜索条件文本
        const queryDiv = document.createElement('div');
        queryDiv.className = 'history-query';
        
        // 显示主搜索字段
        let queryText = `${item.searchInput}`;
        
        // 如果有额外字段，添加到查询文本中
        if (item.additionalFields && item.additionalFields.length > 0) {
            item.additionalFields.forEach(field => {
                queryText += ` ${field.operator} ${field.field}:${field.term}`;
            });
        }
        
        queryDiv.textContent = queryText;
        
        const conditionsDiv = document.createElement('div');
        conditionsDiv.className = 'history-conditions';
        conditionsDiv.textContent = `搜索字段: ${item.searchField} | 时间范围: ${item.timeRange} | 排序: ${item.sortBy} ${item.sortOrder} | 结果数: ${item.maxResults}`;
        
        const dateDiv = document.createElement('div');
        dateDiv.className = 'history-date';
        dateDiv.textContent = new Date(item.timestamp).toLocaleString();
        
        contentDiv.appendChild(queryDiv);
        contentDiv.appendChild(conditionsDiv);
        contentDiv.appendChild(dateDiv);
        
        // 创建操作按钮区域
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'history-actions';
        
        const favoriteButton = document.createElement('button');
        favoriteButton.className = 'favorite-button';
        favoriteButton.textContent = '收藏';
        favoriteButton.dataset.itemId = item.id;
        favoriteButton.addEventListener('click', function(event) {
            event.stopPropagation();
            const historyItem = history.find(h => h.id === parseInt(this.dataset.itemId));
            if (historyItem) {
                addToFavorites(historyItem);
            }
        });
        
        const applyButton = document.createElement('button');
        applyButton.className = 'secondary-button';
        applyButton.textContent = '应用';
        applyButton.dataset.itemId = item.id;
        applyButton.addEventListener('click', function(event) {
            event.stopPropagation();
            const historyItem = history.find(h => h.id === parseInt(this.dataset.itemId));
            if (historyItem) {
                applyHistorySearch(historyItem);
            }
        });
        
        const deleteButton = document.createElement('button');
        deleteButton.className = 'danger-button';
        deleteButton.textContent = '删除';
        deleteButton.dataset.itemId = item.id;
        deleteButton.addEventListener('click', function(event) {
            event.stopPropagation();
            removeFromHistory(parseInt(this.dataset.itemId));
        });
        
        actionsDiv.appendChild(favoriteButton);
        actionsDiv.appendChild(applyButton);
        actionsDiv.appendChild(deleteButton);
        
        historyItem.appendChild(contentDiv);
        historyItem.appendChild(actionsDiv);
        
        // 为整个历史记录项添加点击事件
        historyItem.addEventListener('click', function() {
            const historyItemObj = history.find(h => h.id === item.id);
            if (historyItemObj) {
                applyHistorySearch(historyItemObj);
            }
        });
        
        historyList.appendChild(historyItem);
    });
}

/**
 * @description 收藏夹管理
 */
const FAVORITES_KEY = 'arxiv_favorites';

/**
 * @description 获取收藏列表
 * @returns {Array} 收藏列表数组
 */
function getFavorites() {
    const favorites = localStorage.getItem(FAVORITES_KEY);
    return favorites ? JSON.parse(favorites) : [];
}

/**
 * @description 保存收藏列表
 * @param {Array} favorites 收藏列表数组
 */
function saveFavorites(favorites) {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
}

/**
 * @description 添加到收藏夹并从历史记录中移除
 * @param {Object} searchData 搜索数据
 */
function addToFavorites(searchData) {
    const favorites = getFavorites();
    
    // 检查是否已经收藏
    const isDuplicate = favorites.some(item => {
        return item.id === searchData.id;
    });
    
    if (!isDuplicate) {
        // 添加到收藏夹
        favorites.unshift(searchData);
        saveFavorites(favorites);
        
        // 从历史记录中移除
        const history = getSearchHistory();
        const newHistory = history.filter(item => item.id !== searchData.id);
        saveSearchHistory(newHistory);
        
        // 更新两个列表的显示
        renderFavorites();
        renderSearchHistory();
    }
}

/**
 * @description 从收藏夹中移除并添加回历史记录
 * @param {number} id 收藏项ID
 */
function removeFromFavorites(id) {
    const favorites = getFavorites();
    // 找到要移除的项目
    const favoriteItem = favorites.find(item => item.id === id);
    
    if (favoriteItem) {
        // 从收藏夹中移除
        const newFavorites = favorites.filter(item => item.id !== id);
        saveFavorites(newFavorites);
        
        // 添加回历史记录
        const history = getSearchHistory();
        history.unshift(favoriteItem);
        saveSearchHistory(history);
        
        // 更新显示
        renderFavorites();
        renderSearchHistory();
    } else {
        // 如果没有找到，只更新收藏夹显示
        renderFavorites();
    }
}

/**
 * @description 清空收藏夹
 */
function clearFavorites() {
    localStorage.removeItem(FAVORITES_KEY);
    renderFavorites();
}

/**
 * @description 渲染收藏夹列表
 */
function renderFavorites() {
    const favoritesList = document.getElementById('favoritesList');
    const favorites = getFavorites();
    
    if (favorites.length === 0) {
        favoritesList.innerHTML = '<div class="history-item">暂无收藏记录</div>';
        return;
    }
    
    favoritesList.innerHTML = '';
    
    favorites.forEach(item => {
        const favoriteItem = document.createElement('div');
        favoriteItem.className = 'history-item';
        favoriteItem.style.cursor = 'pointer';
        
        // 创建内容区域
        const contentDiv = document.createElement('div');
        contentDiv.className = 'history-content';
        
        // 构建显示的搜索条件文本
        const queryDiv = document.createElement('div');
        queryDiv.className = 'history-query';
        
        // 显示主搜索字段
        let queryText = `${item.searchInput}`;
        
        // 如果有额外字段，添加到查询文本中
        if (item.additionalFields && item.additionalFields.length > 0) {
            item.additionalFields.forEach(field => {
                queryText += ` ${field.operator} ${field.field}:${field.term}`;
            });
        }
        
        queryDiv.textContent = queryText;
        
        const conditionsDiv = document.createElement('div');
        conditionsDiv.className = 'history-conditions';
        conditionsDiv.textContent = `搜索字段: ${item.searchField} | 时间范围: ${item.timeRange} | 排序: ${item.sortBy} ${item.sortOrder} | 结果数: ${item.maxResults}`;
        
        const dateDiv = document.createElement('div');
        dateDiv.className = 'history-date';
        dateDiv.textContent = new Date(item.timestamp).toLocaleString();
        
        contentDiv.appendChild(queryDiv);
        contentDiv.appendChild(conditionsDiv);
        contentDiv.appendChild(dateDiv);
        
        // 创建操作按钮区域
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'history-actions';
        
        const applyButton = document.createElement('button');
        applyButton.className = 'secondary-button';
        applyButton.textContent = '应用';
        applyButton.dataset.itemId = item.id;
        applyButton.addEventListener('click', function(event) {
            event.stopPropagation();
            const favoriteItem = favorites.find(h => h.id === parseInt(this.dataset.itemId));
            if (favoriteItem) {
                applyHistorySearch(favoriteItem);
            }
        });
        
        const favoriteButton = document.createElement('button');
        favoriteButton.className = 'favorite-button active';
        favoriteButton.textContent = '已收藏';
        favoriteButton.dataset.itemId = item.id;
        favoriteButton.addEventListener('click', function(event) {
            event.stopPropagation();
            // 从收藏夹移除，添加回历史记录
            removeFromFavorites(parseInt(this.dataset.itemId));
        });
        
        // 更改按钮顺序，把已收藏按钮放在前面
        actionsDiv.appendChild(favoriteButton);
        actionsDiv.appendChild(applyButton);
        
        favoriteItem.appendChild(contentDiv);
        favoriteItem.appendChild(actionsDiv);
        
        // 为整个收藏项添加点击事件
        favoriteItem.addEventListener('click', function() {
            const favoriteItemObj = favorites.find(f => f.id === item.id);
            if (favoriteItemObj) {
                applyFavoriteSearch(favoriteItemObj);
            }
        });
        
        favoritesList.appendChild(favoriteItem);
    });
}

/**
 * @description 显示API密钥输入弹窗
 */
function showApiKeyModal() {
    apiKeyModal.style.display = 'flex';
    setTimeout(() => {
        apiKeyModal.classList.add('modal-open');
    }, 10);
}

/**
 * @description 隐藏API密钥输入弹窗
 */
function hideApiKeyModal() {
    apiKeyModal.classList.remove('modal-open');
    setTimeout(() => {
        apiKeyModal.style.display = 'none';
    }, 300);
}

/**
 * @description 保存API密钥
 * @returns {Promise<void>}
 */
async function saveApiKey() {
    const key = document.getElementById('apiKeyInput').value.trim();
    if (!key) {
        alert('API密钥不能为空');
        return;
    }

    try {
        // 更新为使用新的API
        const success = await window.electronAPI.saveApiKey(key);
        if (success) {
            apiKey = key;
            hideApiKeyModal();
            alert('API密钥保存成功');
        } else {
            alert('API密钥保存失败');
        }
    } catch (error) {
        console.error('保存API密钥失败:', error);
        alert('保存API密钥失败: ' + error.message);
    }
}

/**
 * @description 加载API密钥
 * @returns {Promise<string|null>}
 */
async function loadApiKey() {
    try {
        // 更新为使用新的API
        const key = await window.electronAPI.getApiKey();
        if (key) {
            apiKey = key;
            console.log('API密钥已加载');
        } else {
            console.log('没有找到保存的API密钥');
            apiKey = null;
        }
        return apiKey;
    } catch (error) {
        console.error('加载API密钥失败:', error);
        throw error;
    }
}

/**
 * @description 翻译文本
 * @param {string} text - 待翻译的文本
 * @returns {Promise<string>} 翻译后的文本
 */
async function translateText(text) {
    if (!text) return '';
    if (!apiKey) {
        apiKey = await loadApiKey();
        if (!apiKey) {
            showApiKeyModal();
            throw new Error('请先设置API密钥');
        }
    }
    
    try {
        // 获取当前选择的翻译模型
        const selectedModel = settingsModelSelection.value;
        console.log('当前使用的翻译模型:', selectedModel);
        
        // 更新为使用新的API
        const translated = await window.electronAPI.translateText(text, apiKey, selectedModel);
        
        // 清理翻译结果，删除开头的空白行
        const cleanedTranslation = translated.replace(/^\s*[\r\n]+/g, '');
        return cleanedTranslation;
    } catch (error) {
        console.error('翻译错误:', error);
        throw error;
    }
}

/**
 * @description 翻译所有论文
 * @param {Array} papers - 论文数组
 * @returns {Promise<Array>} 翻译后的论文数组
 */
async function translatePapers(papers) {
    if (!papers || papers.length === 0) {
        alert('没有可翻译的论文');
        return [];
    }
    
    if (!apiKey) {
        try {
            await loadApiKey();
        } catch (error) {
            console.error('加载API密钥失败:', error);
            alert('请先在设置中配置有效的API密钥');
            return [];
        }
    }
    
    // 获取当前选择的翻译模型
    const selectedModel = settingsModelSelection.value;
    
    // 如果当前要翻译的论文与上次翻译的论文相同，且使用相同的模型，则使用缓存的结果
    if (
        originalPapers && 
        originalPapers.length === papers.length && 
        JSON.stringify(papers.map(p => p.id)) === JSON.stringify(originalPapers.map(p => p.id)) &&
        selectedModel === lastUsedTranslationModel &&
        translatedPapers && 
        translatedPapers.length > 0
    ) {
        console.log('使用缓存的翻译结果');
        isTranslated = true;
        translateButton.textContent = isTranslated ? '显示原文' : '翻译';
        
        // 更新allPapers为翻译后的论文
        allPapers = [...translatedPapers];
        renderPapers();
        
        return translatedPapers;
    }
    
    // 创建取消标志
    let isCancelled = false;
    
    // 重置全局取消标志
    isTranslationCancelled = false;
    
    // 获取搜索表单和论文列表元素
    const searchForm = document.getElementById('mainSearchContainer');
    const resultsTable = document.getElementById('mainSearchResults');
    
    // 创建内嵌式翻译进度条容器
    const translationProgressContainer = document.createElement('div');
    translationProgressContainer.id = 'translationProgressContainer';
    translationProgressContainer.style.width = '100%';
    translationProgressContainer.style.padding = '15px';
    translationProgressContainer.style.marginBottom = '20px';
    translationProgressContainer.style.backgroundColor = '#f8f9fa';
    translationProgressContainer.style.borderRadius = '5px';
    translationProgressContainer.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
    
    // 进度条上部信息
    const progressHeader = document.createElement('div');
    progressHeader.style.display = 'flex';
    progressHeader.style.alignItems = 'center';
    progressHeader.style.marginBottom = '10px';
    
    // 左侧信息
    const progressInfo = document.createElement('div');
    const progressTitle = document.createElement('div');
    progressTitle.style.fontWeight = 'bold';
    progressTitle.style.marginBottom = '5px';
    progressTitle.textContent = '正在翻译论文';
    
    const modelInfo = document.createElement('div');
    modelInfo.style.fontSize = '13px';
    modelInfo.style.color = '#666';
    modelInfo.textContent = `使用模型: ${selectedModel}`;
    
    progressInfo.appendChild(progressTitle);
    progressInfo.appendChild(modelInfo);
    
    progressHeader.appendChild(progressInfo);
    
    // 进度信息
    const progressText = document.createElement('div');
    progressText.id = 'translationProgressText';
    progressText.textContent = `翻译中... 0/${papers.length} (0%)`;
    progressText.style.marginBottom = '10px';
    
    // 进度条
    const progressBarContainer = document.createElement('div');
    progressBarContainer.style.width = '100%';
    progressBarContainer.style.backgroundColor = '#e0e0e0';
    progressBarContainer.style.borderRadius = '4px';
    progressBarContainer.style.overflow = 'hidden';
    
    const progressBar = document.createElement('div');
    progressBar.id = 'translationProgressBar';
    progressBar.style.height = '6px';
    progressBar.style.width = '0%';
    progressBar.style.backgroundColor = '#4CAF50';
    progressBar.style.transition = 'width 0.3s';
    
    progressBarContainer.appendChild(progressBar);
    
    // 组装进度条容器
    translationProgressContainer.appendChild(progressHeader);
    translationProgressContainer.appendChild(progressText);
    translationProgressContainer.appendChild(progressBarContainer);
    
    // 插入到搜索表单和结果表格之间
    searchForm.parentNode.insertBefore(translationProgressContainer, resultsTable);
    
    try {
        console.log(`开始翻译${papers.length}篇论文，使用模型: ${selectedModel}`);
        
        // 记录本次使用的翻译模型
        lastUsedTranslationModel = selectedModel;
        
        // 保存原始论文数据的深拷贝
        originalPapers = JSON.parse(JSON.stringify(papers));
        
        // 创建一个深拷贝以避免修改原始数据
        const papersCopy = JSON.parse(JSON.stringify(papers));
        
        // 创建一个翻译进度计数器
        let translatedCount = 0;
        
        // 更新进度的函数
        const updateProgress = (count, total) => {
            const percent = Math.round((count / total) * 100);
            
            // 更新进度文本
            progressText.textContent = `翻译中... ${count}/${total} (${percent}%)`;
            
            // 更新进度条
            progressBar.style.width = `${percent}%`;
            
            // 更新标题
            document.title = `[翻译 ${count}/${total}] Electron Paper`;
        };
        
        // 实时更新翻译结果到界面的函数
        const updateUIWithTranslation = (paper, index) => {
            if (index >= 0 && index < allPapers.length) {
                // 更新全局数据中的这篇论文
                allPapers[index].title = paper.title;
                if (paper.summary) allPapers[index].summary = paper.summary;
                
                // 找到当前页面中对应的这篇论文（如果存在）
                const perPage = 20; // 每页固定显示20篇
                const startIndex = (currentPage - 1) * perPage;
                const endIndex = Math.min(startIndex + perPage, allPapers.length);
                
                // 检查这篇论文是否在当前页面上
                if (index >= startIndex && index < endIndex && isTranslated) {
                    console.log(`更新界面: 第${index+1}篇论文 (标题和摘要同时更新)`);
                    
                    // 计算在当前页面上的索引
                    const pageIndex = index - startIndex;
                    // 获取表格行
                    const rows = papersTableBody.querySelectorAll('tr');
                    if (pageIndex >= 0 && pageIndex < rows.length) {
                        try {
                            const row = rows[pageIndex];
                            // 更新标题单元格（第2列）
                            const titleCell = row.children[1];
                            if (titleCell) {
                                const titleDiv = titleCell.querySelector('.title-cell');
                                if (titleDiv) {
                                    const paperIndex = startIndex + pageIndex + 1;
                                    titleDiv.innerHTML = `<small style="color: #666;">[${paperIndex}]</small> ${paper.title}`;
                                }
                            }
                            
                            // 更新摘要单元格（第6列）
                            const summaryCell = row.children[5];
                            if (summaryCell && paper.summary) {
                                const summaryDiv = summaryCell.querySelector('.abstract-cell');
                                if (summaryDiv) {
                                    summaryDiv.innerHTML = paper.summary;
                                }
                            }
                        } catch (error) {
                            console.error('更新界面时出错:', error);
                        }
                    }
                }
            }
        };
        
        // 确保用户知道正在进行翻译
        isTranslated = true;
        translateButton.textContent = '显示原文';
        translateButton.classList.add('active');
        
        // 创建一个延迟函数
        const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
        
        // 逐篇翻译论文，实时更新界面
        for (let paperIndex = 0; paperIndex < papersCopy.length; paperIndex++) {
            if (isCancelled || isTranslationCancelled) {
                console.log('翻译已被用户取消');
                break;
            }
            
            const paper = papersCopy[paperIndex];
            console.log(`开始翻译第 ${paperIndex + 1}/${papersCopy.length} 篇论文`);
            
            try {
                // 创建论文的临时副本，避免更新未完成的翻译
                const paperCopy = { ...paper };
                
                // 翻译标题
                paperCopy.title = await translateText(paper.title);
                
                // 翻译摘要
                if (paper.summary) {
                    paperCopy.summary = await translateText(paper.summary);
                }
                
                // 翻译完成后，更新原始论文对象
                paper.title = paperCopy.title;
                if (paper.summary) {
                    paper.summary = paperCopy.summary;
                }
                
                // 添加短暂延迟，确保DOM更新有序进行
                await delay(50);
                
                // 在标题和摘要都翻译完成后，一次性更新界面
                updateUIWithTranslation(paper, paperIndex);
                
                // 更新翻译进度
                translatedCount++;
                updateProgress(translatedCount, papersCopy.length);
                
                // 将翻译结果保存到最终数组
                translatedPapers[paperIndex] = paper;
            } catch (error) {
                console.error(`翻译论文 ${paperIndex + 1} 失败:`, error);
                
                // 更新翻译进度
                translatedCount++;
                updateProgress(translatedCount, papersCopy.length);
            }
        }
        
        // 更新全局变量和状态
        if (!isCancelled && !isTranslationCancelled) {
            console.log('翻译完成，已更新显示');
        } else {
            console.log('翻译被取消，使用部分翻译结果');
        }
        
        // 更新页面状态
        if (isTranslated) {
            allPapers = papersCopy;
            renderPapers();
        }
        
        // 恢复原始标题
        document.title = 'Electron Paper';
        
        return isCancelled ? papers : papersCopy;
    } catch (error) {
        console.error('翻译论文时出错:', error);
        alert(`翻译失败: ${error.message}`);
        
        // 恢复原始标题
        document.title = 'Electron Paper';
        
        return papers; // 返回原始论文
    } finally {
        // 移除进度条
        if (translationProgressContainer && translationProgressContainer.parentNode) {
            translationProgressContainer.parentNode.removeChild(translationProgressContainer);
        }
        
        // 启用翻译按钮
        translateButton.disabled = false;
    }
}

/**
 * @description 切换翻译状态
 */
async function toggleTranslation() {
    try {
        console.log('触发翻译开关');
        
        // 如果没有论文数据，不执行任何操作
        if (allPapers.length === 0) {
            alert('没有可翻译的论文数据');
            return;
        }
        
        // 检查是否已经有API密钥
        if (!apiKey) {
            apiKey = await loadApiKey();
            
            // 如果仍然没有API密钥，显示输入弹窗
            if (!apiKey) {
                showApiKeyModal();
                return;
            }
        }
        
        // 获取当前选择的翻译模型
        const currentSelectedModel = settingsModelSelection.value;
        console.log('当前选择的模型:', currentSelectedModel, '上次使用的模型:', lastUsedTranslationModel);
        
        // 检测模型是否变更
        const modelChanged = lastUsedTranslationModel && currentSelectedModel !== lastUsedTranslationModel;
        if (modelChanged) {
            console.log('检测到模型已变更，将重新进行翻译');
        }
        
        if (!isTranslated) {
            // 切换UI状态，即使在翻译前也使用户知道现在是翻译状态
            isTranslated = true;
            translateButton.textContent = '显示原文';
            translateButton.classList.add('active');
            
            // 保存原始数据（如果尚未保存）
            if (originalPapers.length === 0) {
                originalPapers = JSON.parse(JSON.stringify(allPapers));
            }
            
            // 检查是否已有缓存的翻译结果，并且模型没有变更
            if (translatedPapers.length > 0 && !modelChanged) {
                // 检查当前论文数组是否与原始论文数组相同
                const isSamePaperSet = originalPapers.length === allPapers.length && 
                    originalPapers.every((paper, index) => 
                        paper.id === allPapers[index].id || paper.link === allPapers[index].link
                    );
                
                // 如果是相同的论文集合且使用的是相同的模型，直接使用缓存的翻译结果
                if (isSamePaperSet) {
                    console.log('使用缓存的翻译结果');
                    allPapers = JSON.parse(JSON.stringify(translatedPapers));
                    renderPapers();
                    return;
                }
            }
            
            // 执行翻译（当模型变更或没有缓存结果时）
            translateButton.disabled = true;
            
            try {
            // 执行非阻塞翻译，让界面保持响应
                console.log('开始调用translatePapers函数');
            translatePapers(allPapers).then(() => {
                console.log('翻译任务完成');
                translateButton.disabled = false;
            }).catch(error => {
                console.error('翻译任务出错:', error);
                translateButton.disabled = false;
                    alert(`翻译失败: ${error.message}`);
            });
            } catch (error) {
                console.error('触发翻译过程出错:', error);
                translateButton.disabled = false;
                alert(`翻译失败: ${error.message}`);
            }
            
            // 无需等待翻译完成，立即返回以保持界面响应
        } else {
            // 恢复原始数据
            if (originalPapers.length > 0) {
                allPapers = JSON.parse(JSON.stringify(originalPapers));
            }
            
            // 更新UI状态
            isTranslated = false;
            translateButton.textContent = '翻译';
            translateButton.classList.remove('active');
            
            // 重新渲染
            renderPapers();
        }
    } catch (error) {
        console.error('切换翻译状态时出错:', error);
        alert(`切换翻译状态失败: ${error.message}`);
        translateButton.disabled = false;
    }
}

/**
 * @description 显示状态消息
 * @param {HTMLElement} element - 状态消息元素
 * @param {string} message - 消息内容
 * @param {string} type - 消息类型（success 或 error）
 */
function showStatusMessage(element, message, type) {
    element.textContent = message;
    element.className = 'status-message ' + type;
    element.style.display = 'block';
    
    // 5秒后自动隐藏
    setTimeout(() => {
        element.style.display = 'none';
    }, 5000);
}

/**
 * @description 保存设置
 * @returns {Promise<boolean>}
 */
async function saveSettings() {
    try {
        // 获取表单值
        const newApiKey = document.getElementById('settingsApiKey').value.trim();
        const selectedModel = document.getElementById('settingsModelSelection').value;
        const exportPath = document.getElementById('paperExportPath').value;
        
        // 构建设置对象
        const settings = {
            apiKey: newApiKey,
            model: selectedModel,
            exportPath: exportPath
        };
        
        // 保存设置
        const success = await window.electronAPI.saveSettings(settings);
        
        if (success) {
            // 更新全局变量
            apiKey = newApiKey;
            
            // 显示成功消息
            showStatusMessage(document.getElementById('settingsStatusMessage'), '设置已保存', 'success');
            return true;
        } else {
            showStatusMessage(document.getElementById('settingsStatusMessage'), '保存设置失败', 'error');
            return false;
        }
    } catch (error) {
        console.error('保存设置失败:', error);
        showStatusMessage(document.getElementById('settingsStatusMessage'), '保存设置失败: ' + error.message, 'error');
        return false;
    }
}

/**
 * @description 加载设置
 * @returns {Promise<void>}
 */
async function loadSettings() {
    try {
        // 获取设置表单元素
        const settingsApiKey = document.getElementById('settingsApiKey');
        const settingsModelSelection = document.getElementById('settingsModelSelection');
        const paperExportPath = document.getElementById('paperExportPath');
        const knowledgeBasePath = document.getElementById('knowledgeBasePath');
        
        // 加载API密钥
        const key = await window.electronAPI.getApiKey();
        if (key) {
            settingsApiKey.value = key;
            apiKey = key;
        }
        
        // 加载翻译模型设置
        const savedModel = localStorage.getItem('translationModel');
        if (savedModel) {
            settingsModelSelection.value = savedModel;
            lastUsedTranslationModel = savedModel;
        }

        // 加载导出路径设置
        const savedExportPath = localStorage.getItem('exportPath');
        if (savedExportPath) {
            paperExportPath.value = savedExportPath;
            exportPath = savedExportPath;
        }
        
        // 加载知识库路径设置
        const savedKnowledgeBasePath = localStorage.getItem('knowledgeBasePath');
        if (savedKnowledgeBasePath) {
            knowledgeBasePath.value = savedKnowledgeBasePath;
            knowledgeBaseSavePath = savedKnowledgeBasePath;
        }

    } catch (error) {
        console.error('加载设置失败:', error);
    }
}

// 添加标签页切换逻辑
mainSearchTab.addEventListener('click', () => {
    mainSearchTab.classList.add('active');
    historySearchTab.classList.remove('active');
    favoritesTab.classList.remove('active');
    settingsTab.classList.remove('active');
    knowledgeBaseTab.classList.remove('active');
    
    mainSearchContainer.style.display = 'block';
    historyContainer.style.display = 'none';
    favoritesContainer.style.display = 'none';
    settingsContainer.style.display = 'none';
    knowledgeBaseContainer.style.display = 'none';
    
    // 显示搜索结果区域
    document.getElementById('mainSearchResults').style.display = 'block';
});

historySearchTab.addEventListener('click', () => {
    mainSearchTab.classList.remove('active');
    historySearchTab.classList.add('active');
    favoritesTab.classList.remove('active');
    settingsTab.classList.remove('active');
    knowledgeBaseTab.classList.remove('active');
    
    mainSearchContainer.style.display = 'none';
    historyContainer.style.display = 'block';
    favoritesContainer.style.display = 'none';
    settingsContainer.style.display = 'none';
    knowledgeBaseContainer.style.display = 'none';
    
    // 隐藏搜索结果区域
    document.getElementById('mainSearchResults').style.display = 'none';
    
    // 加载历史搜索记录
    renderSearchHistory();
});

favoritesTab.addEventListener('click', () => {
    mainSearchTab.classList.remove('active');
    historySearchTab.classList.remove('active');
    favoritesTab.classList.add('active');
    settingsTab.classList.remove('active');
    knowledgeBaseTab.classList.remove('active');
    
    mainSearchContainer.style.display = 'none';
    historyContainer.style.display = 'none';
    favoritesContainer.style.display = 'block';
    settingsContainer.style.display = 'none';
    knowledgeBaseContainer.style.display = 'none';
    
    // 隐藏搜索结果区域
    document.getElementById('mainSearchResults').style.display = 'none';
    
    // 加载收藏夹
    renderFavorites();
});

settingsTab.addEventListener('click', () => {
    mainSearchTab.classList.remove('active');
    historySearchTab.classList.remove('active');
    favoritesTab.classList.remove('active');
    settingsTab.classList.add('active');
    knowledgeBaseTab.classList.remove('active');
    
    mainSearchContainer.style.display = 'none';
    historyContainer.style.display = 'none';
    favoritesContainer.style.display = 'none';
    settingsContainer.style.display = 'block';
    knowledgeBaseContainer.style.display = 'none';
    
    // 隐藏搜索结果区域
    document.getElementById('mainSearchResults').style.display = 'none';
    
    loadSettings();
});

// 添加知识库标签页点击事件
knowledgeBaseTab.addEventListener('click', () => {
    mainSearchTab.classList.remove('active');
    historySearchTab.classList.remove('active');
    favoritesTab.classList.remove('active');
    settingsTab.classList.remove('active');
    knowledgeBaseTab.classList.add('active');
    
    mainSearchContainer.style.display = 'none';
    historyContainer.style.display = 'none';
    favoritesContainer.style.display = 'none';
    settingsContainer.style.display = 'none';
    knowledgeBaseContainer.style.display = 'block';
    
    // 隐藏搜索结果区域
    document.getElementById('mainSearchResults').style.display = 'none';
    
    // 加载并渲染知识库
    renderKnowledgeBase();
});

// 保存设置按钮事件
saveSettingsButton.addEventListener('click', saveSettings);

// 添加选择路径按钮事件监听
selectPathButton.addEventListener('click', async () => {
    try {
        // 使用selectDirectory方法选择文件夹
        const selectedPath = await window.electronAPI.selectDirectory();
        
        if (!selectedPath) {
            console.log('用户取消了选择文件夹操作');
            return;
        }
        
        // 保存选择的路径，添加末尾的斜杠/反斜杠
        const formattedPath = selectedPath + '\\';
        localStorage.setItem('paperExportPath', formattedPath);
        document.getElementById('paperExportPath').value = formattedPath;
        
        alert(`已设置默认导出路径为: ${formattedPath}`);
    } catch (error) {
        console.error('选择导出路径失败:', error);
        alert('选择导出路径失败: ' + error.message);
    }
});

// 添加选择知识库路径按钮事件监听
selectKnowledgeBasePathButton.addEventListener('click', async () => {
    try {
        // 使用selectDirectory方法选择文件夹
        const selectedPath = await window.electronAPI.selectDirectory();
        
        if (!selectedPath) {
            console.log('用户取消了选择知识库文件夹操作');
            return;
        }
        
        // 保存选择的路径，添加末尾的斜杠/反斜杠
        const formattedPath = selectedPath + '\\';
        document.getElementById('knowledgeBasePath').value = formattedPath;
        knowledgeBaseSavePath = formattedPath;
        localStorage.setItem('knowledgeBasePath', formattedPath);
        
        // 显示设置成功的提示
        alert(`已设置知识库存放路径为: ${formattedPath}`);
    } catch (error) {
        console.error('选择知识库路径失败:', error);
        alert('选择知识库路径失败: ' + error.message);
    }
});

// 修改之前的openSettings函数
async function openSettings() {
    settingsTab.click();
}

/**
 * @description 从本地存储加载知识库数据
 * @returns {Array} 知识库中的论文数据
 */
function loadKnowledgeBase() {
    try {
        // 尝试从localStorage获取知识库路径
        const savedPath = localStorage.getItem('knowledgeBasePath');
        console.log('从localStorage获取的知识库路径:', savedPath);
        
        if (savedPath) {
            knowledgeBaseSavePath = savedPath;
            knowledgeBasePath.value = savedPath;
            
            // 尝试从文件中读取知识库数据
            const filePath = `${savedPath}/knowledge-base.json`;
            try {
                console.log('尝试从文件读取知识库:', filePath);
                // 使用window.electronAPI.readFile函数的逻辑来读取文件
                if (window.electronAPI && typeof window.electronAPI.readFile === 'function') {
                    // 如果预加载脚本中提供了readFile函数，则使用它
                    const fileData = window.electronAPI.readFile(filePath);
                    if (fileData && fileData.success && fileData.content) {
                        console.log('从文件中成功加载知识库数据');
                        const parsedData = JSON.parse(fileData.content);
                        // 保存到localStorage以备不时之需
                        localStorage.setItem('knowledgeBase', JSON.stringify(parsedData.papers || []));
                        return parsedData.papers || [];
                    } else {
                        console.warn('文件读取失败或文件为空:', fileData);
                        // 确保在文件读取失败时也保留路径
                        localStorage.setItem('knowledgeBasePath', savedPath);
                    }
                } else {
                    console.error('window.electronAPI.readFile函数不可用');
                }
            } catch (fileError) {
                console.error('从文件读取知识库数据失败:', fileError);
                // 确保在文件读取失败时也保留路径
                localStorage.setItem('knowledgeBasePath', savedPath);
            }
        } else {
            console.log('未在localStorage中找到知识库路径');
        }
        
        // 如果从文件读取失败或没有保存路径，尝试从localStorage获取知识库数据
        const savedData = localStorage.getItem('knowledgeBase');
        if (savedData) {
            console.log('从localStorage加载知识库数据');
            return JSON.parse(savedData);
        }
        console.log('未找到知识库数据');
        return [];
    } catch (error) {
        console.error('加载知识库数据失败:', error);
        return [];
    }
}

/**
 * @description 保存知识库数据到本地存储
 * @param {Array} data 要保存的知识库数据
 * @returns {Boolean} 是否保存成功
 */
function saveKnowledgeBase(data) {
    try {
        localStorage.setItem('knowledgeBase', JSON.stringify(data));
        return true;
    } catch (error) {
        console.error('保存知识库数据失败:', error);
        return false;
    }
}

/**
 * @description 保存知识库数据到JSON文件
 * @returns {Promise<Boolean>} 是否保存成功
 */
async function saveKnowledgeBaseToFile() {
    try {
        console.log('开始保存知识库到文件');
        
        // 如果路径为空，请求用户选择
        if (!knowledgeBaseSavePath) {
            console.log('知识库路径为空，请求用户选择路径');
            const selectedPath = await window.electronAPI.selectDirectory();
            if (!selectedPath) {
                console.log('用户取消了选择路径');
                return false; // 用户取消了选择
            }
            // 添加末尾的斜杠/反斜杠
            const formattedPath = selectedPath + '\\';
            knowledgeBaseSavePath = formattedPath;
            knowledgeBasePath.value = formattedPath;
            localStorage.setItem('knowledgeBasePath', formattedPath);
            console.log('已设置新的知识库路径:', formattedPath);
            
            // 显示设置成功的提示
            alert(`已设置知识库存放路径为: ${formattedPath}`);
        }
        
        // 创建文件路径
        const filePath = `${knowledgeBaseSavePath}/knowledge-base.json`;
        console.log('将保存知识库到文件:', filePath);
        
        // 准备数据
        const data = {
            timestamp: new Date().toISOString(),
            count: knowledgeBaseItems.length,
            papers: knowledgeBaseItems
        };
        
        console.log(`准备保存 ${knowledgeBaseItems.length} 篇论文到知识库文件`);
        
        // 保存到文件
        const saveResult = await window.electronAPI.saveFile(filePath, JSON.stringify(data, null, 2));
        
        if (saveResult && saveResult.success) {
            console.log('知识库保存成功，文件路径:', saveResult.path);
            
            // 确保路径被保存到localStorage
            if (knowledgeBaseSavePath) {
                localStorage.setItem('knowledgeBasePath', knowledgeBaseSavePath);
                console.log('知识库路径已保存到localStorage:', knowledgeBaseSavePath);
            }
            
            return true;
        } else {
            console.error('保存知识库文件失败:', saveResult?.error || '未知错误');
            alert('保存知识库文件失败: ' + (saveResult?.error || '未知错误'));
            return false;
        }
    } catch (error) {
        console.error('保存知识库到文件失败:', error);
        alert('保存知识库到文件失败: ' + error.message);
        return false;
    }
}

/**
 * @description 将论文添加到知识库
 * @param {Array} papers 要添加的论文数组
 * @returns {Object} 包含添加结果的对象
 */
async function addToKnowledgeBase(papers) {
    try {
        console.log('执行addToKnowledgeBase函数，论文数量:', papers.length);
        
        // 先从localStorage获取知识库路径
        const savedPath = localStorage.getItem('knowledgeBasePath');
        if (savedPath) {
            knowledgeBaseSavePath = savedPath;
            knowledgeBasePath.value = savedPath;
        }
        
        // 加载现有知识库
        const existingItems = loadKnowledgeBase();
        console.log('已加载现有知识库，条目数量:', existingItems.length);
        knowledgeBaseItems = existingItems;
        
        // 记录成功添加的数量和重复的数量
        let addedCount = 0;
        let duplicateCount = 0;
        let duplicateTitles = [];
        
        // 创建链接集合用于去重
        const linkSet = new Set(existingItems.map(item => item.link));
        console.log('创建链接集合用于去重，集合大小:', linkSet.size);
        
        // 添加新论文，避免重复
        papers.forEach(paper => {
            if (!linkSet.has(paper.link)) {
                console.log('添加新论文:', paper.title);
                
                // 存储原始文本（英文）
                let originalTitle = paper.title;
                let originalSummary = paper.summary;
                
                // 存储翻译文本（中文）
                let translatedTitle = null;
                let translatedSummary = null;
                
                // 判断当前翻译状态和可能的翻译内容
                if (isTranslated) {
                    // 当前处于翻译状态，直接使用当前paper的title和summary作为翻译版本
                    translatedTitle = paper.title;
                    translatedSummary = paper.summary;
                    
                    // 从originalPapers中获取原文
                    const originalPaper = originalPapers.find(op => op.link === paper.link);
                    if (originalPaper) {
                        originalTitle = originalPaper.title;
                        originalSummary = originalPaper.summary;
                    }
                } else {
                    // 当前处于原文状态，但需要检查是否有翻译版本
                    // 检查translatedPapers中是否存在该论文的翻译版本
                    const translatedPaper = translatedPapers.find(tp => tp.link === paper.link);
                    if (translatedPaper) {
                        translatedTitle = translatedPaper.title;
                        translatedSummary = translatedPaper.summary;
                    }
                }
                
                // 确定在知识库中显示的内容（优先选择翻译版本）
                const displayTitle = translatedTitle || originalTitle;
                const displaySummary = translatedSummary || originalSummary;
                
                // 添加额外的知识库字段
                const knowledgePaper = {
                    ...paper,
                    // 使用优先的翻译版本作为显示内容
                    title: displayTitle,
                    summary: displaySummary,
                    // 额外的字段
                    addedDate: new Date().toISOString(),
                    isRead: false,
                    notes: '',
                    // 保存原始和翻译的内容，以便后续切换
                    originalTitle: originalTitle,
                    originalSummary: originalSummary,
                    translatedTitle: translatedTitle,
                    translatedSummary: translatedSummary,
                    // 标记是否有翻译版本
                    hasTranslation: Boolean(translatedTitle)
                };
                
                knowledgeBaseItems.push(knowledgePaper);
                linkSet.add(paper.link);
                addedCount++;
            } else {
                console.log('跳过重复论文:', paper.title);
                duplicateCount++;
                // 记录重复论文的标题，最多记录5个
                if (duplicateTitles.length < 5) {
                    // 获取论文标题，如果标题太长则截断
                    const title = paper.title.length > 50 ? paper.title.substring(0, 50) + '...' : paper.title;
                    duplicateTitles.push(title);
                }
            }
        });
        
        console.log(`处理完成，添加了 ${addedCount} 篇新论文，跳过 ${duplicateCount} 篇重复论文`);
        
        // 保存到本地存储
        const saveResult = saveKnowledgeBase(knowledgeBaseItems);
        console.log('保存到本地存储结果:', saveResult);
        
        // 保存到文件
        console.log('保存知识库到文件');
        const fileSaveResult = await saveKnowledgeBaseToFile();
        console.log('保存到文件结果:', fileSaveResult);
        
        // 重新渲染知识库
        console.log('在addToKnowledgeBase中渲染知识库');
        try {
            renderKnowledgeBase();
            console.log('知识库渲染成功');
        } catch (renderError) {
            console.error('知识库渲染失败:', renderError);
        }
        
        // 返回添加结果
        return {
            success: true,
            addedCount: addedCount,
            duplicateCount: duplicateCount,
            duplicateTitles: duplicateTitles
        };
    } catch (error) {
        console.error('添加到知识库失败:', error);
        return {
            success: false,
            error: error.message,
            addedCount: 0,
            duplicateCount: 0
        };
    }
}

/**
 * @description 渲染知识库内容
 * @returns {void}
 */
function renderKnowledgeBase() {
    try {
        // 先从localStorage获取知识库路径
        const savedPath = localStorage.getItem('knowledgeBasePath');
        if (savedPath) {
            knowledgeBaseSavePath = savedPath;
            knowledgeBasePath.value = savedPath;
        }
        
        // 确保当前知识库数据已加载
        knowledgeBaseItems = loadKnowledgeBase();
        
        console.log(`已加载知识库数据，当前有 ${knowledgeBaseItems.length} 篇论文`);
        
        // 确保知识库网格元素存在
        if (!knowledgeBaseGrid) {
            console.error('找不到知识库网格元素 (knowledgeBaseGrid)');
            return;
        }
        
        // 清空知识库网格
        knowledgeBaseGrid.innerHTML = '';
        
        // 如果没有论文，显示提示
        if (knowledgeBaseItems.length === 0) {
            console.log('知识库为空，显示提示信息');
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'history-item';
            emptyMsg.style.textAlign = 'center';
            emptyMsg.innerHTML = '<p>您的知识库中还没有论文。搜索并导出论文到知识库来开始收集吧！</p>';
            knowledgeBaseGrid.appendChild(emptyMsg);
            return;
        }

        console.log(`开始渲染 ${knowledgeBaseItems.length} 篇论文`);
        
        // 遍历并添加论文卡片
        knowledgeBaseItems.forEach(item => {
            // 创建卡片元素
            const card = document.createElement('div');
            card.className = 'knowledge-base-card';
            card.dataset.id = item.link;
            
            // 如果已读，添加已读标记
            if (item.isRead) {
                const readMark = document.createElement('div');
                readMark.className = 'read-mark';
                readMark.textContent = '已读';
                card.appendChild(readMark);
            }
            
            // 添加标题
            const title = document.createElement('div');
            title.className = 'card-title';
            title.textContent = item.title;
            card.appendChild(title);
            
            // 添加作者
            const authors = document.createElement('div');
            authors.className = 'card-authors';
            authors.textContent = item.authors;
            card.appendChild(authors);
            
            // 添加分类
            if (item.categories && item.categories.length > 0) {
                const categories = document.createElement('div');
                categories.className = 'card-categories';
                
                // 最多显示3个分类标签
                const displayCategories = item.categories.slice(0, 3);
                displayCategories.forEach(cat => {
                    const category = document.createElement('div');
                    category.className = 'card-category';
                    category.textContent = cat;
                    categories.appendChild(category);
                });
                
                card.appendChild(categories);
            }
            
            // 添加底部（日期和操作）
            const footer = document.createElement('div');
            footer.className = 'card-footer';
            
            // 添加日期
            const date = document.createElement('div');
            date.className = 'card-date';
            date.textContent = new Date(item.addedDate).toLocaleDateString();
            footer.appendChild(date);
            
            // 添加操作按钮
            const actions = document.createElement('div');
            actions.className = 'card-actions';
            
            // 已读/未读按钮
            const readBtn = document.createElement('button');
            readBtn.className = item.isRead ? 'card-button read' : 'card-button';
            readBtn.textContent = item.isRead ? '标为未读' : '标为已读';
            readBtn.onclick = (e) => {
                e.stopPropagation(); // 阻止事件冒泡
                updateKnowledgeBaseItemReadStatus(item.link, !item.isRead);
            };
            actions.appendChild(readBtn);
            
            // 删除按钮
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'card-button delete';
            deleteBtn.textContent = '删除';
            deleteBtn.onclick = (e) => {
                e.stopPropagation(); // 阻止事件冒泡
                if (confirm('确定要从知识库中删除这篇论文吗？')) {
                    removeFromKnowledgeBase(item.link);
                }
            };
            actions.appendChild(deleteBtn);
            
            footer.appendChild(actions);
            card.appendChild(footer);
            
            // 添加卡片点击事件
            card.addEventListener('click', () => {
                showKnowledgeBaseItemDetail(item.link);
            });
            
            // 将卡片添加到网格
            knowledgeBaseGrid.appendChild(card);
        });
        
        console.log('知识库渲染完成');
    } catch (error) {
        console.error('渲染知识库失败:', error);
        if (knowledgeBaseGrid) {
            knowledgeBaseGrid.innerHTML = '<div class="history-item" style="text-align: center;"><p>加载知识库时出错: ' + error.message + '</p></div>';
        }
    }
}

/**
 * @description 从知识库中移除论文
 * @param {String} id 要移除的论文ID（链接）
 * @returns {Boolean} 是否移除成功
 */
async function removeFromKnowledgeBase(id) {
    try {
        // 确保当前知识库数据已加载
        knowledgeBaseItems = loadKnowledgeBase();
        
        // 找到要删除的索引
        const index = knowledgeBaseItems.findIndex(item => item.link === id);
        
        if (index === -1) {
            console.error('找不到要删除的论文:', id);
            return false;
        }
        
        // 从数组中删除
        knowledgeBaseItems.splice(index, 1);
        
        // 保存更新后的数据
        saveKnowledgeBase(knowledgeBaseItems);
        
        // 保存到文件
        await saveKnowledgeBaseToFile();
        
        // 重新渲染知识库
        renderKnowledgeBase();
        
        return true;
    } catch (error) {
        console.error('从知识库中删除论文失败:', error);
        return false;
    }
}

/**
 * @description 导出知识库数据为自定义命名的JSON文件
 * @returns {Promise<boolean>} 是否导出成功
 */
async function exportKnowledgeBaseToCustomFile() {
    try {
        // 加载知识库数据
        const knowledgeData = loadKnowledgeBase();
        
        if (!knowledgeData || knowledgeData.length === 0) {
            alert('知识库为空，没有可导出的内容');
            return false;
        }
        
        // 获取当前日期和时间并格式化为 YYYY-MM-DD_HH-MM 格式
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const formattedDateTime = `${year}-${month}-${day}_${hours}-${minutes}`;
        
        // 弹出文件保存对话框
        const options = {
            title: '导出知识库',
            buttonLabel: '导出',
            defaultPath: `知识库导出_${formattedDateTime}.json`,
            filters: [
                { name: 'JSON文件', extensions: ['json'] }
            ]
        };
        
        const result = await window.electronAPI.showInputBox({
            type: 'file-save',
            options: options
        });
        
        if (!result || !result.filePath) {
            console.log('用户取消了导出操作');
            return false;
        }
        
        // 准备导出数据
        const exportData = {
            timestamp: new Date().toISOString(),
            count: knowledgeData.length,
            papers: knowledgeData
        };
        
        // 保存到用户选择的文件
        const saveResult = await window.electronAPI.saveFile(
            result.filePath, 
            JSON.stringify(exportData, null, 2)
        );
        
        if (!saveResult || !saveResult.success) {
            throw new Error('保存文件失败：' + (saveResult?.error || '未知错误'));
        }
        
        alert(`导出成功！\n已导出 ${knowledgeData.length} 篇论文到：\n${result.filePath}`);
        return true;
    } catch (error) {
        console.error('导出知识库失败:', error);
        alert('导出知识库失败: ' + error.message);
        return false;
    }
}

// 添加导入/导出按钮的事件监听器 - 添加到页面底部的事件初始化部分
importKnowledgeBase.addEventListener('click', importKnowledgeBaseFromFile);
exportKnowledgeBase.addEventListener('click', exportKnowledgeBaseToCustomFile);

// 监听回车键
searchInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        console.log('检测到回车键，开始搜索');
        currentPage = 1; // 重置页码
        searchPapers();
    }
});

// 监听搜索按钮点击
searchButton.addEventListener('click', () => {
    console.log('点击搜索按钮，开始搜索');
    currentPage = 1; // 重置页码
    searchPapers();
});

// 添加详情页笔记编辑按钮事件监听
editNotesButton.addEventListener('click', () => {
    notesViewMode.style.display = 'none';
    notesEditMode.style.display = 'block';
});

// 添加取消编辑笔记按钮事件监听
cancelEditNotes.addEventListener('click', () => {
    notesViewMode.style.display = 'block';
    notesEditMode.style.display = 'none';
    notesTextarea.value = currentDetailItem?.notes || '';
});

// 添加保存笔记按钮事件监听
saveNotes.addEventListener('click', async () => {
    if (!currentDetailItem) return;
    
    // 获取笔记内容
    const notes = notesTextarea.value.trim();
    
    // 更新当前项的笔记
    currentDetailItem.notes = notes;
    
    // 更新知识库数据
    const itemIndex = knowledgeBaseItems.findIndex(item => item.link === currentDetailItem.link);
    if (itemIndex !== -1) {
        knowledgeBaseItems[itemIndex].notes = notes;
        
        // 保存到本地存储
        saveKnowledgeBase(knowledgeBaseItems);
        
        // 同时保存到文件，确保重启软件后笔记不会丢失
        try {
            await saveKnowledgeBaseToFile();
            console.log('笔记已保存到本地文件');
        } catch (error) {
            console.error('保存笔记到文件失败:', error);
            alert('笔记已保存在本地，但保存到文件失败，重启软件后可能丢失。错误: ' + error.message);
        }
    }
    
    // 更新显示
    detailNotes.innerHTML = notes ? notes.replace(/\n/g, '<br>') : '<em>暂无笔记</em>';
    
    // 切回查看模式
    notesViewMode.style.display = 'block';
    notesEditMode.style.display = 'none';
});

// 添加关闭详情弹窗按钮事件监听
closeDetailModal.addEventListener('click', () => {
    detailModal.classList.remove('detail-open');
    setTimeout(() => {
        detailModal.style.display = 'none';
    }, 300);
});

/**
 * @description 更新知识库条目的已读/未读状态
 * @param {String} id 论文ID（链接）
 * @param {Boolean} isRead 是否已读
 * @returns {Boolean} 是否更新成功
 */
async function updateKnowledgeBaseItemReadStatus(id, isRead) {
    try {
        // 确保知识库数据已加载
        knowledgeBaseItems = loadKnowledgeBase();
        
        // 找到要更新的项
        const index = knowledgeBaseItems.findIndex(item => item.link === id);
        
        if (index === -1) {
            console.error('找不到要更新的论文:', id);
            return false;
        }
        
        // 更新阅读状态
        knowledgeBaseItems[index].isRead = isRead;
        
        // 保存更新后的数据
        saveKnowledgeBase(knowledgeBaseItems);
        
        // 保存到文件
        await saveKnowledgeBaseToFile();
        
        // 重新渲染知识库
        renderKnowledgeBase();
        
        return true;
    } catch (error) {
        console.error('更新阅读状态失败:', error);
        return false;
    }
}

/**
 * @description 显示知识库条目的详细信息
 * @param {String} id 论文ID（链接）
 * @returns {void}
 */
function showKnowledgeBaseItemDetail(id) {
    try {
        console.log("显示详情页，ID:", id);
        const item = knowledgeBaseItems.find(item => item.link === id);
        
        if (!item) {
            console.error('找不到对应ID的知识库项目:', id);
            return;
        }
        
        // 设置详情内容
        detailTitle.textContent = item.title;
        detailAuthors.textContent = item.authors;
        detailDate.textContent = formatDate(item.published);
        
        // 设置分类
        detailCategories.innerHTML = '';
        if (item.categories) {
            // 处理categories可能是字符串或数组的情况
            let categoriesArray = [];
            
            if (Array.isArray(item.categories)) {
                // 如果是数组，直接使用
                categoriesArray = item.categories;
            } else if (typeof item.categories === 'string') {
                // 如果是字符串，按逗号分隔
                categoriesArray = item.categories.split(', ');
            }
            
            // 创建分类标签
            categoriesArray.forEach(category => {
                const categoryElem = document.createElement('div');
                categoryElem.className = 'detail-category';
                categoryElem.textContent = category;
                detailCategories.appendChild(categoryElem);
            });
        }
        
        // 设置摘要（确保没有首行空白）
        let summaryText = item.summary;
        if (summaryText) {
            // 删除开头的空白行
            summaryText = summaryText.replace(/^\s*[\r\n]+/g, '');
        }
        detailAbstract.textContent = summaryText;
        
        // 设置笔记
        detailNotes.innerHTML = item.notes ? item.notes.replace(/\n/g, '<br>') : '<em>暂无笔记</em>';
        notesTextarea.value = item.notes || '';
        
        // 根据是否有翻译版本更新语言切换按钮状态
        if (item.hasTranslation) {
            toggleLanguageButton.style.display = 'block';
            toggleLanguageButton.textContent = '显示原文';
            toggleLanguageButton.dataset.showingTranslation = 'true';
            
            // 保存当前显示状态的引用
            currentDetailItem = item;
        } else {
            toggleLanguageButton.style.display = 'none';
        }
        
        // 设置原文链接按钮
        linkButton.onclick = () => {
            window.electronAPI.openExternal(item.link);
        };
        
        // 如果没有标记为已读，添加标记为已读按钮
        const existingMarkReadButton = document.getElementById('markReadButton');
        if (existingMarkReadButton) {
            existingMarkReadButton.remove();
        }
        
        const markReadButton = document.createElement('button');
        markReadButton.id = 'markReadButton';
        markReadButton.className = 'secondary-button';
        markReadButton.textContent = item.isRead ? '标记为未读' : '标记为已读';
        languageToggleContainer.appendChild(markReadButton);
        
        markReadButton.addEventListener('click', async () => {
            const newReadStatus = !item.isRead;
            await updateKnowledgeBaseItemReadStatus(id, newReadStatus);
            markReadButton.textContent = newReadStatus ? '标记为未读' : '标记为已读';
        });
        
        // 切换语言按钮事件
        toggleLanguageButton.onclick = () => {
            const showingTranslation = toggleLanguageButton.dataset.showingTranslation === 'true';
            
            if (showingTranslation) {
                // 切换到原文
                detailTitle.textContent = item.originalTitle;
                detailAbstract.textContent = item.originalSummary;
                toggleLanguageButton.textContent = '显示翻译';
                toggleLanguageButton.dataset.showingTranslation = 'false';
            } else {
                // 切换到翻译
                detailTitle.textContent = item.translatedTitle || item.title;
                
                // 清理翻译文本，确保没有首行空白
                let translatedSummary = item.translatedSummary || item.summary;
                if (translatedSummary) {
                    // 删除开头的空白行
                    translatedSummary = translatedSummary.replace(/^\s*[\r\n]+/g, '');
                }
                
                detailAbstract.textContent = translatedSummary;
                toggleLanguageButton.textContent = '显示原文';
                toggleLanguageButton.dataset.showingTranslation = 'true';
            }
        };
        
        // 显示弹窗
        detailModal.style.display = 'flex';
        setTimeout(() => {
            detailModal.classList.add('detail-open');
        }, 10);
        
    } catch (error) {
        console.error('显示详情页失败:', error);
    }
}

/**
 * @description 导入知识库数据
 * @returns {Promise<boolean>} 是否导入成功
 */
async function importKnowledgeBaseFromFile() {
    try {
        // 弹出文件选择对话框，选择JSON文件
        const options = {
            title: '选择知识库JSON文件',
            buttonLabel: '导入',
            properties: ['openFile'],
            filters: [
                { name: 'JSON文件', extensions: ['json'] }
            ]
        };
        
        const result = await window.electronAPI.showInputBox({
            type: 'file-open',
            options: options
        });
        
        if (!result || !result.filePath) {
            console.log('用户取消了导入操作');
            return false;
        }
        
        // 读取选择的JSON文件
        const fileData = window.electronAPI.readFile(result.filePath);
        if (!fileData || !fileData.success || !fileData.content) {
            throw new Error('读取文件失败：' + (fileData?.error || '未知错误'));
        }
        
        // 解析JSON数据
        let importedData;
        try {
            importedData = JSON.parse(fileData.content);
            
            // 验证JSON格式是否符合知识库要求
            if (!importedData.papers || !Array.isArray(importedData.papers)) {
                throw new Error('导入的文件格式不正确，缺少papers数组');
            }
        } catch (jsonError) {
            throw new Error('解析JSON文件失败：' + jsonError.message);
        }
        
        // 确认导入操作
        const confirmMessage = `确认导入？这将导入 ${importedData.papers.length} 篇论文。\n\n选择"合并"将保留当前知识库中的论文并添加新论文（重复的将被跳过）。\n选择"替换"将清空当前知识库并导入新的论文。`;
        
        const confirmResult = await window.electronAPI.showInputBox({
            type: 'confirm',
            options: {
                type: 'question',
                buttons: ['合并', '替换', '取消'],
                defaultId: 0,
                title: '确认导入',
                message: confirmMessage
            }
        });
        
        if (confirmResult === 2 || confirmResult === undefined) {
            console.log('用户取消了导入确认');
            return false;
        }
        
        // 根据用户选择执行不同的导入操作
        if (confirmResult === 0) { // 合并
            // 加载当前知识库
            const currentItems = loadKnowledgeBase();
            
            // 创建链接集合用于去重
            const existingLinks = new Set(currentItems.map(item => item.link));
            
            // 合并两个知识库，去除重复项
            let mergedItems = [...currentItems];
            let addedCount = 0;
            
            for (const paper of importedData.papers) {
                if (!existingLinks.has(paper.link)) {
                    mergedItems.push(paper);
                    existingLinks.add(paper.link);
                    addedCount++;
                }
            }
            
            knowledgeBaseItems = mergedItems;
            
            // 显示导入结果
            alert(`导入成功！\n合并了 ${importedData.papers.length} 篇论文，其中新增 ${addedCount} 篇。`);
        } else { // 替换
            knowledgeBaseItems = importedData.papers;
            
            // 显示导入结果
            alert(`导入成功！\n替换为 ${importedData.papers.length} 篇论文。`);
        }
        
        // 保存到本地存储
        saveKnowledgeBase(knowledgeBaseItems);
        
        // 保存到文件
        await saveKnowledgeBaseToFile();
        
        // 重新渲染知识库
        renderKnowledgeBase();
        
        return true;
    } catch (error) {
        console.error('导入知识库失败:', error);
        alert('导入知识库失败: ' + error.message);
        return false;
    }
}

/**
 * @description 更新所有复选框状态
 */
function updateCheckboxStates() {
    // 检查当前页上是否所有论文都被选中
    const checkboxes = papersTableBody.querySelectorAll('input[type="checkbox"]');
    const allChecked = checkboxes.length > 0 && 
                        Array.from(checkboxes).every(cb => cb.checked);
    
    // 更新"全选"复选框状态
    selectAllPapers.checked = allChecked;
}

// 添加全选复选框事件监听器
selectAllPapers.addEventListener('change', () => {
    const isChecked = selectAllPapers.checked;
    
    if (isChecked) {
        // 选择所有页面的论文（不只是当前页）
        allPapers.forEach(paper => {
            selectedPaperIds.add(paper.id || paper.link);
        });
    } else {
        // 清空所有选择
        selectedPaperIds.clear();
    }
    
    // 更新当前页面上的复选框状态
    const checkboxes = papersTableBody.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = isChecked;
    });
});

// 添加导出按钮事件监听器
exportButton.addEventListener('click', () => {
    // 获取选中的论文数量
    const selectedCount = document.querySelectorAll('#papersTableBody input[type="checkbox"]:checked').length;
    
    if (selectedCount === 0) {
        alert('请至少选择一篇论文来导出');
        return;
    }
    
    // 显示导出选项弹窗
    exportOptionsModal.style.display = 'flex';
    setTimeout(() => {
        exportOptionsModal.classList.add('modal-open');
    }, 10);
});

// 关闭导出选项弹窗
closeExportOptionsModal.addEventListener('click', () => {
    exportOptionsModal.classList.remove('modal-open');
    setTimeout(() => {
        exportOptionsModal.style.display = 'none';
    }, 300);
});

// 导出到JSON文件按钮
exportToFile.addEventListener('click', async () => {
    try {
        // 关闭导出选项弹窗
        exportOptionsModal.classList.remove('modal-open');
        setTimeout(() => {
            exportOptionsModal.style.display = 'none';
        }, 300);
        
        // 创建要导出的论文列表
        const selectedPapers = allPapers.filter(paper => 
            selectedPaperIds.has(paper.id || paper.link)
        );
        
        if (selectedPapers.length === 0) {
            alert('未选择任何论文，请先选择要导出的论文');
            return;
        }
        
        // 创建包含当前日期时间的默认文件名（精确到分钟）
        const now = new Date();
        const dateTimeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
        const defaultFilename = `arxiv论文导出_${dateTimeStr}.json`;
        
        // 获取从设置中保存的路径
        const savedPath = localStorage.getItem('paperExportPath');
        let finalPath = '';
        
        if (!savedPath) {
            // 如果没有保存的路径，显示文件保存对话框
            const options = {
                title: '导出选中的论文',
                buttonLabel: '导出',
                defaultPath: defaultFilename,
                filters: [
                    { name: 'JSON文件', extensions: ['json'] }
                ]
            };
            
            const result = await window.electronAPI.showInputBox({
                type: 'file-save',
                options: options
            });
            
            if (!result || !result.filePath) {
                console.log('用户取消了导出操作');
                return;
            }
            
            finalPath = result.filePath;
            
            // 询问用户是否保存此路径
            const savePath = confirm('是否将当前导出路径保存为默认路径？');
            if (savePath) {
                // 仅保存目录部分，不包括文件名
                const directoryPath = finalPath.substring(0, finalPath.lastIndexOf('\\') + 1);
                localStorage.setItem('paperExportPath', directoryPath);
                paperExportPath.value = directoryPath;
            }
        } else {
            // 使用保存的路径 + 默认文件名
            finalPath = savedPath + defaultFilename;
        }
        
        // 准备导出数据
        const exportData = {
            timestamp: new Date().toISOString(),
            count: selectedPapers.length,
            papers: selectedPapers
        };
        
        // 保存到文件
        const saveResult = await window.electronAPI.saveFile(
            finalPath, 
            JSON.stringify(exportData, null, 2)
        );
        
        if (!saveResult || !saveResult.success) {
            throw new Error('保存文件失败：' + (saveResult?.error || '未知错误'));
        }
        
        alert(`导出成功！\n已导出 ${selectedPapers.length} 篇论文到：\n${finalPath}`);
    } catch (error) {
        console.error('导出论文失败:', error);
        alert('导出论文失败: ' + error.message);
    }
});

// 关闭文件保存弹窗
closeExportModal.addEventListener('click', () => {
    exportModal.classList.remove('modal-open');
    setTimeout(() => {
        exportModal.style.display = 'none';
    }, 300);
});

// 导出到知识库按钮
exportToKnowledgeBase.addEventListener('click', async () => {
    try {
        // 关闭导出选项弹窗
        exportOptionsModal.classList.remove('modal-open');
        setTimeout(() => {
            exportOptionsModal.style.display = 'none';
        }, 300);
        
        // 创建要导出的论文列表
        const selectedPapers = allPapers.filter(paper => 
            selectedPaperIds.has(paper.id || paper.link)
        );
        
        // 调用添加到知识库的函数
        const result = await addToKnowledgeBase(selectedPapers);
        
        if (result.success) {
            let message = '';
            
            if (result.addedCount > 0 && result.duplicateCount === 0) {
                // 只有添加成功的论文
                message = `已成功添加 ${result.addedCount} 篇论文到知识库！`;
            } else if (result.addedCount === 0 && result.duplicateCount > 0) {
                // 只有重复的论文
                message = `所选的 ${result.duplicateCount} 篇论文已存在于知识库中，未添加新论文。`;
                if (result.duplicateTitles.length > 0) {
                    message += `\n\n包括：\n${result.duplicateTitles.join('\n')}`;
                    if (result.duplicateCount > result.duplicateTitles.length) {
                        message += `\n以及其他 ${result.duplicateCount - result.duplicateTitles.length} 篇论文...`;
                    }
                }
            } else {
                // 有添加成功和重复的论文
                message = `已成功添加 ${result.addedCount} 篇论文到知识库！\n跳过了 ${result.duplicateCount} 篇已存在的论文。`;
                if (result.duplicateTitles.length > 0) {
                    message += `\n\n已存在的论文包括：\n${result.duplicateTitles.join('\n')}`;
                    if (result.duplicateCount > result.duplicateTitles.length) {
                        message += `\n以及其他 ${result.duplicateCount - result.duplicateTitles.length} 篇论文...`;
                    }
                }
            }
            
            // 显示提示弹窗
            alert(message);
        } else {
            throw new Error(result.error || '添加到知识库失败，未知错误');
        }
    } catch (error) {
        console.error('添加到知识库失败:', error);
        alert('添加到知识库失败: ' + error.message);
    }
});

// 取消导出按钮事件
cancelExport.addEventListener('click', () => {
    exportModal.classList.remove('modal-open');
    setTimeout(() => {
        exportModal.style.display = 'none';
    }, 300);
});

// 选择文件夹按钮事件
confirmExport.addEventListener('click', async () => {
    try {
        // 隐藏弹窗
        exportModal.classList.remove('modal-open');
        setTimeout(() => {
            exportModal.style.display = 'none';
        }, 300);
        
        // 调用选择文件夹的API
        const result = await window.electronAPI.showInputBox({
            type: 'directory',
            options: {
                title: '选择导出文件夹',
                buttonLabel: '选择此文件夹'
            }
        });
        
        if (!result || !result.filePath) {
            console.log('用户取消了选择文件夹操作');
            return;
        }
        
        // 保存选择的路径
        const selectedPath = result.filePath + '\\';
        localStorage.setItem('paperExportPath', selectedPath);
        paperExportPath.value = selectedPath;
        
        alert(`已设置默认导出路径为: ${selectedPath}`);
    } catch (error) {
        console.error('选择导出路径失败:', error);
        alert('选择导出路径失败: ' + error.message);
    }
});

/**
 * @description 聊天相关功能
 */
let isRecording = false;
// 删除未使用的媒体录制相关变量
// let mediaRecorder = null;
// let audioChunks = [];

// 获取DOM元素
let chatContainer, chatSidebar, summonButton, minimizeButton, expandButton;
let chatInput, voiceButton, sendButton, chatMessages;
let adjustChatContainerPosition; // 声明为全局函数变量

// 隐藏聊天框
function hideChat() {
    if (!chatContainer || !chatSidebar) return;
    
    // 移除可见性类
    chatContainer.classList.remove('visible');
    // 添加侧边栏可见性类
    chatSidebar.classList.add('visible');
    
    // 强制重绘以确保过渡效果正常
    void chatContainer.offsetHeight;
    void chatSidebar.offsetHeight;
}

// 显示聊天框
function showChat() {
    if (!chatContainer || !chatSidebar) return;
    
    // 添加可见性类
    chatContainer.classList.add('visible');
    // 移除侧边栏可见性类
    chatSidebar.classList.remove('visible');
    
    // 强制重绘以确保过渡效果正常
    void chatContainer.offsetHeight;
    void chatSidebar.offsetHeight;
}

// 完全关闭聊天
function closeChat() {
    if (!chatContainer || !chatSidebar) return;
    chatContainer.classList.remove('visible');
    setTimeout(() => {
        chatContainer.style.display = 'none';
        chatSidebar.classList.remove('visible');
    }, 300);
}

// 自动调整输入框高度
function adjustInputHeight() {
    if (!chatInput) return;
    chatInput.style.height = 'auto';
    const newHeight = Math.min(chatInput.scrollHeight, parseInt(getComputedStyle(chatInput).maxHeight));
    chatInput.style.height = `${newHeight}px`;
}

// 初始化聊天界面
function initChat() {
    // 获取所有需要的DOM元素
    chatContainer = document.getElementById('chatContainer');
    chatSidebar = document.getElementById('chatSidebar');
    chatInput = document.getElementById('chatInput');
    chatMessages = document.getElementById('chatMessages');
    
    // 检查所有必需的DOM元素是否存在
    if (!chatContainer || !chatSidebar || !chatInput || !chatMessages) {
        console.error('聊天组件初始化失败：部分DOM元素未找到');
        return;
    }
    
    // 初始化界面状态
    hideChat();
    
    // 添加欢迎消息
    addMessage('你好！我是你的学术导师Awei。我可以帮你：\n1. 推荐论文检索关键词\n2. 分析研究方向\n3. 解答学术问题\n请问有什么可以帮你的吗？', 'bot');
    
    // 绑定事件监听器
    document.getElementById('summonAwei').addEventListener('click', showChat);
    document.getElementById('minimizeChat').addEventListener('click', hideChat);
    chatSidebar.addEventListener('click', showChat);
    
    // 绑定其他事件监听器
    document.getElementById('sendMessage').addEventListener('click', sendMessage);
    document.getElementById('voiceInput').addEventListener('mousedown', startRecording);
    document.getElementById('voiceInput').addEventListener('mouseup', stopRecording);
    document.getElementById('voiceInput').addEventListener('mouseleave', stopRecording);
    document.getElementById('clearChatHistory').addEventListener('click', clearChatHistory);
    
    // 绑定输入框事件
    chatInput.addEventListener('input', adjustInputHeight);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
}

// 在DOM加载完成后初始化聊天功能
document.addEventListener('DOMContentLoaded', () => {
    // 初始化基本界面
    initChat();
    // 或者使用新的聊天功能初始化（根据需要选择使用）
    // initChatFeatures();
});

// 添加消息到聊天框
function addMessage(text, type) {
    const messageContainer = document.createElement('div');
    messageContainer.className = `message ${type}-message`;
    
    // 创建消息内容元素
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    
    // 处理多行文本，避免首行空白问题
    const trimmedText = text.trim();
    
    // 检测是否含有代码块
    if (type === 'bot' && (trimmedText.includes('```') || trimmedText.includes('`'))) {
        // 使用正则表达式解析代码块
        const codeBlockRegex = /```([a-zA-Z]*)\n([\s\S]*?)```/g;
        const inlineCodeRegex = /`([^`]+)`/g;
        
        let lastIndex = 0;
        let match;
        let hasCodeBlock = false;
        
        // 处理代码块
        while ((match = codeBlockRegex.exec(trimmedText)) !== null) {
            hasCodeBlock = true;
            
            // 添加代码块前的文本
            if (match.index > lastIndex) {
                const textBefore = trimmedText.substring(lastIndex, match.index);
                const textNode = document.createElement('div');
                textNode.textContent = textBefore;
                messageContent.appendChild(textNode);
            }
            
            // 创建代码块容器
            const codeContainer = document.createElement('div');
            codeContainer.className = 'code-block-container';
            
            // 创建代码块头部
            const codeHeader = document.createElement('div');
            codeHeader.className = 'code-block-header';
            
            // 语言标识
            const languageSpan = document.createElement('span');
            languageSpan.className = 'code-language';
            const language = match[1].trim() || '代码';
            languageSpan.textContent = language;
            codeHeader.appendChild(languageSpan);
            
            // 复制按钮
            const copyButton = document.createElement('button');
            copyButton.className = 'copy-code-button';
            copyButton.innerHTML = '<i class="fas fa-copy"></i> 复制';
            // 将代码文本存储为变量，避免在回调函数中引用match[2]
            const codeTextToCopy = match[2];
            copyButton.onclick = function() {
                // 使用Electron的IPC机制来复制文本
                if (window.electronAPI && window.electronAPI.copyToClipboard) {
                    window.electronAPI.copyToClipboard(codeTextToCopy)
                        .then(() => {
                            copyButton.innerHTML = '<i class="fas fa-check"></i> 已复制';
                            setTimeout(() => {
                                copyButton.innerHTML = '<i class="fas fa-copy"></i> 复制';
                            }, 2000);
                        })
                        .catch(err => {
                            console.error('复制失败:', err);
                            copyButton.innerHTML = '<i class="fas fa-times"></i> 复制失败';
                            setTimeout(() => {
                                copyButton.innerHTML = '<i class="fas fa-copy"></i> 复制';
                            }, 2000);
                        });
                } else {
                    // 回退方案：尝试使用document.execCommand
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
                            copyButton.innerHTML = '<i class="fas fa-check"></i> 已复制';
                        } else {
                            copyButton.innerHTML = '<i class="fas fa-times"></i> 复制失败';
                        }
                        setTimeout(() => {
                            copyButton.innerHTML = '<i class="fas fa-copy"></i> 复制';
                        }, 2000);
                    } catch (err) {
                        console.error('复制失败:', err);
                        copyButton.innerHTML = '<i class="fas fa-times"></i> 复制失败';
                        setTimeout(() => {
                            copyButton.innerHTML = '<i class="fas fa-copy"></i> 复制';
                        }, 2000);
                    }
                }
            };
            codeHeader.appendChild(copyButton);
            
            // 添加头部到容器
            codeContainer.appendChild(codeHeader);
            
            // 创建代码块
            const codeBlock = document.createElement('pre');
            const code = document.createElement('code');
            if (language && language !== '代码') {
                code.className = `language-${language}`;
            }
            code.textContent = match[2];
            codeBlock.appendChild(code);
            codeContainer.appendChild(codeBlock);
            
            // 添加代码块到消息
            messageContent.appendChild(codeContainer);
            
            lastIndex = match.index + match[0].length;
        }
        
        // 添加剩余文本
        if (lastIndex < trimmedText.length) {
            const remainingText = trimmedText.substring(lastIndex);
            const textNode = document.createElement('div');
            
            // 处理内联代码
            if (inlineCodeRegex.test(remainingText)) {
                let inlineLastIndex = 0;
                let inlineMatch;
                let textContent = '';
                
                inlineCodeRegex.lastIndex = 0; // 重置正则表达式的lastIndex
                while ((inlineMatch = inlineCodeRegex.exec(remainingText)) !== null) {
                    // 添加内联代码前的文本
                    if (inlineMatch.index > inlineLastIndex) {
                        textContent += remainingText.substring(inlineLastIndex, inlineMatch.index);
                    }
                    
                    // 添加内联代码
                    textContent += `<span class="inline-code">${inlineMatch[1]}</span>`;
                    
                    inlineLastIndex = inlineMatch.index + inlineMatch[0].length;
                }
                
                // 添加剩余文本
                if (inlineLastIndex < remainingText.length) {
                    textContent += remainingText.substring(inlineLastIndex);
                }
                
                textNode.innerHTML = textContent;
            } else {
                textNode.textContent = remainingText;
            }
            
            messageContent.appendChild(textNode);
        }
        
        // 如果没有找到代码块，但有内联代码，处理内联代码
        if (!hasCodeBlock && inlineCodeRegex.test(trimmedText)) {
            let inlineLastIndex = 0;
            let inlineMatch;
            let textContent = '';
            
            inlineCodeRegex.lastIndex = 0; // 重置正则表达式的lastIndex
            while ((inlineMatch = inlineCodeRegex.exec(trimmedText)) !== null) {
                // 添加内联代码前的文本
                if (inlineMatch.index > inlineLastIndex) {
                    textContent += trimmedText.substring(inlineLastIndex, inlineMatch.index);
                }
                
                // 添加内联代码
                textContent += `<span class="inline-code">${inlineMatch[1]}</span>`;
                
                inlineLastIndex = inlineMatch.index + inlineMatch[0].length;
            }
            
            // 添加剩余文本
            if (inlineLastIndex < trimmedText.length) {
                textContent += trimmedText.substring(inlineLastIndex);
            }
            
            messageContent.innerHTML = textContent;
        }
    } else {
        // 普通文本，需要处理Markdown格式
        if (type === 'bot') {
            // 检测是否为初始欢迎消息
            const isWelcomeMessage = trimmedText.includes('你好！我是你的学术导师Awei') && 
                                     trimmedText.includes('推荐论文检索关键词') &&
                                     trimmedText.includes('解答学术问题');
            
            // 检查并处理分隔线 - 使用更强的检测正则表达式
            if (trimmedText.includes('---')) {
                // 记录console日志，辅助调试
                console.log('检测到分隔线，开始处理分隔线');
                console.log('原始文本:', trimmedText);
                
                // 清空现有内容
                messageContent.innerHTML = '';
                
                // 将文本按分隔线分割，使用更准确的正则
                const parts = trimmedText.split(/(-{3,})/g);
                console.log('分割后的部分:', parts);
                
                // 处理分割后的各个部分
                // 跟踪是否已经添加了一个分隔线
                let hasAddedSeparator = false;
                
                for (let i = 0; i < parts.length; i++) {
                    const part = parts[i].trim();
                    
                    // 跳过空部分
                    if (!part) continue;
                    
                    // 如果部分是纯分隔线
                    if (/^-{3,}$/.test(part)) {
                        // 只添加第一个分隔线，忽略后续的分隔线
                        if (!hasAddedSeparator) {
                            console.log('添加分隔线元素');
                            const hr = document.createElement('hr');
                            messageContent.appendChild(hr);
                            hasAddedSeparator = true;
                        }
                    }
                    // 处理文本内容部分
                    else {
                        console.log('处理文本部分:', part);
                        const textNode = document.createElement('div');
                        
                        // 去除可能的系统提示文字
                        let processedText = part;
                        
                        // 去除"首先"开头的提示词 - 增强版正则表达式
                        processedText = processedText.replace(/^首先，?\s*(提供专业、准确、简洁的学术分析|分析如下)[，：,:，:；;]?\s*/i, '');
                        
                        // 去除"提取"开头的提示词 - 增强版正则表达式
                        processedText = processedText.replace(/^(提取|下面是)适合(检索|搜索)的关键词[：:，,；;]?\s*/i, '');
                        
                        // 去掉"快捷检索选项："前缀 - 增强版正则表达式
                        processedText = processedText.replace(/^(快捷[检搜]索选项|[检搜]索建议)[：:，,；;]?\s*/i, '快捷检索选项：');
                        
                        // 过滤Markdown标记，但如果是欢迎消息则保留序号
                        if (isWelcomeMessage) {
                            // 只过滤一部分Markdown符号，保留序号格式
                            textNode.textContent = processedText.replace(/(\*\*|__|\*|_|~~|##|###|####|#####|######)/g, '');
                        } else {
                            // 完全过滤Markdown符号，包括序号（除非是欢迎消息）
                            // 修改正则表达式，确保不会在行首留下空格
                            textNode.textContent = processedText
                                // 先处理行首的Markdown序号和符号
                                .replace(/^\s*(\d+\.|\-|\+|\*)\s+/gm, '')
                                // 再处理其他Markdown格式符号
                                .replace(/(\*\*|__|\*|_|~~|##|###|####|#####|######)/g, '');
                        }
                        
                        messageContent.appendChild(textNode);
                    }
                }
            } else {
                // 没有分隔线的普通文本
                let processedText = trimmedText;
                
                // 去除"首先"开头的提示词 - 增强版正则表达式
                processedText = processedText.replace(/^首先，?\s*(提供专业、准确、简洁的学术分析|分析如下)[，：,:，:；;]?\s*/i, '');
                
                // 去除"提取"开头的提示词 - 增强版正则表达式
                processedText = processedText.replace(/^(提取|下面是)适合(检索|搜索)的关键词[：:，,；;]?\s*/i, '');
                
                // 去掉"快捷检索选项："前缀 - 增强版正则表达式
                processedText = processedText.replace(/^(快捷[检搜]索选项|[检搜]索建议)[：:，,；;]?\s*/i, '快捷检索选项：');
                
                // 过滤Markdown标记，但如果是欢迎消息则保留序号
                if (isWelcomeMessage) {
                    // 只过滤一部分Markdown符号，保留序号格式
                    messageContent.textContent = processedText.replace(/(\*\*|__|\*|_|~~|##|###|####|#####|######)/g, '');
                } else {
                    // 完全过滤Markdown符号，包括序号
                    // 修改正则表达式，确保不会在行首留下空格
                    messageContent.textContent = processedText
                        // 先处理行首的Markdown序号和符号
                        .replace(/^\s*(\d+\.|\-|\+|\*)\s+/gm, '')
                        // 再处理其他Markdown格式符号
                        .replace(/(\*\*|__|\*|_|~~|##|###|####|#####|######)/g, '');
                }
            }
        } else {
            // 用户消息直接设置内容，不处理Markdown
            messageContent.textContent = trimmedText;
        }
    }
    
    messageContainer.appendChild(messageContent);
    
    // 如果是机器人消息，检查是否包含搜索建议
    if (type === 'bot') {
        // 提取【】格式的搜索建议
        const suggestions = [];
        const bracketRegex = /【(.+?)】/g;
        let match;
        
        while ((match = bracketRegex.exec(trimmedText)) !== null) {
            if (match[1] && match[1].trim()) {
                suggestions.push(match[1].trim());
            }
        }
        
        // 如果有提取到搜索建议，创建快捷检索选项区域
        if (suggestions.length > 0) {
            // 判断回复是否与学术相关
            const isAcademicResponse = containsAcademicContent(trimmedText);
            
            if (isAcademicResponse) {
                const suggestionsDiv = document.createElement('div');
                suggestionsDiv.className = 'search-suggestions';
                
                // 添加标题
                const titleDiv = document.createElement('div');
                titleDiv.className = 'suggestions-title';
                titleDiv.textContent = '快捷检索选项';
                suggestionsDiv.appendChild(titleDiv);
                
                // 创建一个新的容器来包含按钮，并设置为块级元素以便换行
                const buttonsContainer = document.createElement('div');
                buttonsContainer.className = 'suggestion-buttons-container';
                buttonsContainer.style.display = 'block';
                buttonsContainer.style.marginTop = '12px';  // 从8px增加到12px
                suggestionsDiv.appendChild(buttonsContainer);
                
                // 添加每个检索选项按钮到新容器中，而不是直接添加到suggestionsDiv
                suggestions.forEach(suggestion => {
                    const suggestionButton = document.createElement('button');
                    suggestionButton.className = 'search-suggestion';
                    suggestionButton.textContent = suggestion;
                    suggestionButton.style.margin = '4px';  // 添加外边距增加按钮间距
                    suggestionButton.onclick = () => {
                        // 使用和历史搜索相同的方式应用到搜索表单
                        applySuggestion(suggestion);
                    };
                    buttonsContainer.appendChild(suggestionButton);
                });
                
                messageContainer.appendChild(suggestionsDiv);
            }
        }
    }
    
    chatMessages.appendChild(messageContainer);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // 返回消息容器元素，以便后续能够引用和删除
    return messageContainer;
}

/**
 * @description 判断回复内容是否与学术相关
 * @param {string} text - 回复文本
 * @returns {boolean} 是否与学术相关
 */
function containsAcademicContent(text) {
    // 学术相关的关键词
    const academicKeywords = [
        '论文', '研究', '文献', '学术', '科学', '理论', '方法', '实验', 
        '数据', '分析', '结果', '观点', '综述', '引用', '参考文献',
        '期刊', '会议', '发表', '出版', '作者', '贡献', '发现',
        'paper', 'research', 'study', 'analysis', 'method', 'theory'
    ];
    
    // 检查是否包含学术关键词
    const containsKeywords = academicKeywords.some(keyword => 
        text.toLowerCase().includes(keyword.toLowerCase())
    );
    
    // 检查是否包含学术标记
    const containsAcademicMarkers = 
        text.includes('研究表明') || 
        text.includes('学术观点') || 
        text.includes('文献综述') ||
        /\[\d+\]/.test(text) || // 引用标记 [1], [2] 等
        /\(\d{4}\)/.test(text); // 年份标记 (2020) 等
    
    return containsKeywords || containsAcademicMarkers;
}

// 发送消息
async function sendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;
    
    // 添加用户消息
    addMessage(message, 'user');
    chatInput.value = '';
    chatInput.style.height = 'auto'; // 重置输入框高度
    
    try {
        // 获取API密钥和模型设置
        if (!apiKey) {
            apiKey = await loadApiKey();
        }
        
        // 获取当前选择的翻译模型作为聊天模型
        const model = settingsModelSelection.value || 'deepseek-ai/DeepSeek-V2';
        
        if (!apiKey) {
            addMessage('请先在设置中配置SiliconFlow API密钥。', 'bot');
            return;
        }
        
        // 显示正在输入状态
        const loadingMessage = addMessage('正在思考...', 'bot');
        
        // 调用AI助手
        const response = await window.electronAPI.chatWithAI(message, apiKey, model);
        
        // 移除"正在思考"消息（添加检查）
        if (loadingMessage && loadingMessage.parentNode === chatMessages) {
            chatMessages.removeChild(loadingMessage);
        }
        
        // 处理AI回复
        let replyContent = response.reply;
        
        // 检查是否有搜索建议，如果有且回复中未包含，则将其添加到回复中
        if (response.searchSuggestions && response.searchSuggestions.length > 0) {
            console.log('接收到搜索建议:', response.searchSuggestions);
            
            // 检查回复中是否已包含搜索建议格式的内容
            const hasSuggestionFormat = /【.+?】/.test(replyContent);
            
            // 检查问题是否与学术相关
            const isAcademicMessage = containsAcademicContent(message) || containsAcademicContent(replyContent);
            
            if (!hasSuggestionFormat && isAcademicMessage) {
                // 在回复末尾添加搜索建议
                if (!replyContent.endsWith('\n')) {
                    replyContent += '\n\n';
                } else if (!replyContent.endsWith('\n\n')) {
                    replyContent += '\n';
                }
                
                // 添加搜索建议，使用【】格式，确保与addMessage函数中的解析匹配
                response.searchSuggestions.forEach(suggestion => {
                    replyContent += `【${suggestion}】 `;
                });
            }
        } else {
            console.log('未检测到搜索建议');
        }
        
        // 添加完整回复
        addMessage(replyContent, 'bot');
        
        // 如果这是用户的第一次提问，添加上下文记忆提示
        if (chatMessages.querySelectorAll('.user-message').length === 1) {
            const contextHintMessage = document.createElement('div');
            contextHintMessage.className = 'context-hint';
            contextHintMessage.textContent = '提示：我会记住我们的对话，你可以接着上下文继续提问';
            chatMessages.appendChild(contextHintMessage);
            
            // 3秒后淡出提示
            setTimeout(() => {
                contextHintMessage.classList.add('fade-out');
                setTimeout(() => {
                    if (contextHintMessage.parentNode === chatMessages) {
                        chatMessages.removeChild(contextHintMessage);
                    }
                }, 1000);
            }, 3000);
        }
    } catch (error) {
        console.error('发送消息失败:', error);
        addMessage('抱歉，出现了一些问题：' + error.message, 'bot');
    }
}

// 应用搜索建议到搜索表单
async function applySuggestion(suggestion) {
    try {
        console.log('应用搜索建议到搜索表单:', suggestion);
        
        // 翻译中文关键词为英文
        let translatedSuggestion = suggestion;
        try {
            // 检查是否包含中文字符
            if (/[\u4e00-\u9fa5]/.test(suggestion)) {
                console.log('检测到中文关键词，开始翻译');
                
                // 获取API密钥和翻译模型
                if (!apiKey) {
                    apiKey = await loadApiKey();
                }
                
                if (!apiKey) {
                    throw new Error('请先在设置中配置SiliconFlow API密钥');
                }
                
                // 使用当前选择的翻译模型
                const model = settingsModelSelection.value || 'deepseek-ai/DeepSeek-V2';
                
                // 构建翻译提示词
                const prompt = `请将以下中文学术关键词翻译成英文。只需要给出翻译结果，不要解释：\n${suggestion}`;
                
                // 调用翻译API
                const response = await window.electronAPI.chatWithAI(prompt, apiKey, model);
                
                // 提取翻译结果（去除可能的额外解释和标点符号）
                translatedSuggestion = response.reply.trim()
                    .replace(/^["']|["']$/g, '') // 移除首尾引号
                    .replace(/[.,;，。；]$/g, '') // 移除末尾标点
                    .split('\n')[0]; // 只取第一行
                
                console.log('翻译结果:', translatedSuggestion);
            }
        } catch (translationError) {
            console.error('翻译关键词时出错:', translationError);
            // 如果翻译失败，使用原始关键词
            translatedSuggestion = suggestion;
        }
        
        // 创建一个搜索条件对象
        const searchData = {
            searchField: 'all',  // 默认搜索所有字段
            searchInput: translatedSuggestion,  // 使用翻译后的关键词
            timeRange: document.getElementById('timeRange')?.value || '30',
            sortBy: document.getElementById('sortBy')?.value || 'relevance',
            sortOrder: document.getElementById('sortOrder')?.value || 'descending',
            maxResults: document.getElementById('maxResults')?.value || '50',
            additionalFields: []
        };
        
        // 切换到主搜索标签页
        const mainSearchTab = document.getElementById('mainSearchTab');
        if (mainSearchTab) {
            console.log('切换到主搜索标签页');
            mainSearchTab.click();
        } else {
            console.error('找不到主搜索标签页元素');
        }
        
        // 应用搜索条件并执行搜索
        setTimeout(() => {
            try {
                // 使用与历史记录相同的应用函数
                applySearchConditions(searchData);
                
                // 显示成功提示，包含原始关键词和翻译结果
                const searchForm = document.querySelector('.search-form');
                if (searchForm) {
                    const successMessage = document.createElement('div');
                    successMessage.className = 'search-suggestion-applied';
                    
                    // 如果有翻译，显示原文和译文
                    const messageText = suggestion !== translatedSuggestion ?
                        `已应用检索词: "${suggestion}" (译为: "${translatedSuggestion}")` :
                        `已应用检索词: "${suggestion}"`;
                    
                    successMessage.textContent = messageText;
                    successMessage.style.cssText = `
                        padding: 8px 12px;
                        background-color: #e3f9e3;
                        color: #2e7d32;
                        border-radius: 4px;
                        margin: 10px 0;
                        font-size: 14px;
                        opacity: 1;
                        transition: opacity 0.5s ease;
                    `;
                    
                    // 插入到搜索表单前面
                    searchForm.parentNode.insertBefore(successMessage, searchForm);
                    
                    // 3秒后淡出
                    setTimeout(() => {
                        successMessage.style.opacity = '0';
                        setTimeout(() => {
                            if (successMessage.parentNode) {
                                successMessage.parentNode.removeChild(successMessage);
                            }
                        }, 500);
                    }, 3000);
                }
                
                console.log('搜索建议应用成功');
            } catch (innerError) {
                console.error('应用搜索条件时出错:', innerError);
            }
        }, 300);
    } catch (error) {
        console.error('应用搜索建议失败:', error);
        // 显示错误提示
        const errorMessage = document.createElement('div');
        errorMessage.className = 'search-suggestion-error';
        errorMessage.textContent = `应用检索词失败: ${error.message}`;
        errorMessage.style.cssText = `
            padding: 8px 12px;
            background-color: #ffebee;
            color: #c62828;
            border-radius: 4px;
            margin: 10px 0;
            font-size: 14px;
        `;
        
        const searchForm = document.querySelector('.search-form');
        if (searchForm) {
            searchForm.parentNode.insertBefore(errorMessage, searchForm);
            setTimeout(() => {
                if (errorMessage.parentNode) {
                    errorMessage.parentNode.removeChild(errorMessage);
                }
            }, 3000);
        }
    }
}

// 语音输入相关
async function startRecording() {
    try {
        const voiceButton = document.getElementById('voiceInput');
        if (!voiceButton) {
            console.error('语音按钮元素未找到');
            return;
        }
        
        // 显示按钮状态变化，但不执行实际录音
        isRecording = true;
        voiceButton.textContent = '松开结束';
        voiceButton.classList.add('recording');
        
        // 显示开发中消息
        addMessage('语音功能正在开发中', 'bot');
    } catch (error) {
        console.error('语音功能开发中:', error);
        isRecording = false;
        const voiceButton = document.getElementById('voiceInput');
        if (voiceButton) {
            voiceButton.textContent = '按住说话';
            voiceButton.classList.remove('recording');
        }
    }
}

function stopRecording() {
    try {
        const voiceButton = document.getElementById('voiceInput');
        if (!voiceButton) {
            console.error('语音按钮元素未找到');
            return;
        }
        
        console.log('停止录音');
        
        // 重置按钮状态
        isRecording = false;
        voiceButton.textContent = '按住说话';
        voiceButton.classList.remove('recording');
    } catch (error) {
        console.error('停止录音时出错:', error);
    }
}

// 绑定事件监听
summonButton.addEventListener('click', showChat);
minimizeButton.addEventListener('click', hideChat);
expandButton.addEventListener('click', showChat);
sendButton.addEventListener('click', sendMessage);

chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

voiceButton.addEventListener('mousedown', startRecording);
voiceButton.addEventListener('mouseup', stopRecording);
voiceButton.addEventListener('mouseleave', stopRecording);

/**
 * @description 初始化聊天功能
 */
function initChatFeatures() {
    // 获取DOM元素
    const chatContainer = document.getElementById('chatContainer');
    const chatSidebar = document.getElementById('chatSidebar');
    const summonButton = document.getElementById('summonAwei');
    const minimizeButton = document.getElementById('minimizeChat');
    const chatInput = document.getElementById('chatInput');
    const voiceButton = document.getElementById('voiceInput'); // 修正ID
    const sendButton = document.getElementById('sendMessage'); // 修正ID
    const chatMessages = document.getElementById('chatMessages');
    const clearHistoryButton = document.getElementById('clearChatHistory'); // 添加清除历史按钮

    if (!chatContainer || !chatSidebar || !summonButton || !minimizeButton || 
        !chatInput || !voiceButton || !sendButton || !chatMessages) {
        console.error('聊天组件初始化失败：部分DOM元素未找到');
        return;
    }

    // 初始化聊天界面
    chatContainer.style.display = 'flex';
    chatContainer.classList.remove('visible');
    chatSidebar.style.display = 'block';

    // 添加欢迎消息
    addMessage('你好！我是你的学术导师Awei。我可以帮你：\n1. 推荐论文检索关键词\n2. 分析研究方向\n3. 解答学术问题\n请问有什么可以帮你的吗？', 'bot');

    // 自动调整输入框高度
    function adjustInputHeight() {
        chatInput.style.height = 'auto';
        const newHeight = Math.min(chatInput.scrollHeight, parseInt(getComputedStyle(chatInput).maxHeight));
        chatInput.style.height = `${newHeight}px`;
    }

    // 显示聊天框
    function showChat() {
        chatContainer.style.display = 'flex';
        setTimeout(() => {
            chatContainer.classList.add('visible');
        }, 10);
        chatSidebar.style.display = 'none';
    }

    // 隐藏聊天框
    function hideChat() {
        chatContainer.classList.remove('visible');
        setTimeout(() => {
            chatSidebar.style.display = 'block';
        }, 300);
    }

    // 绑定事件监听器
    summonButton.addEventListener('click', showChat);
    minimizeButton.addEventListener('click', hideChat);
    chatSidebar.addEventListener('click', showChat);
    chatInput.addEventListener('input', adjustInputHeight);
    sendButton.addEventListener('click', sendMessage);
    
    // 添加清除历史按钮事件
    if (clearHistoryButton) {
        clearHistoryButton.addEventListener('click', clearChatHistory);
    }
    
    // 语音输入相关事件 - 保留UI交互但不执行实际录音
    voiceButton.addEventListener('mousedown', startRecording);
    voiceButton.addEventListener('mouseup', stopRecording);
    voiceButton.addEventListener('mouseleave', stopRecording);

    // 回车发送消息
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
}

// 清除聊天历史
async function clearChatHistory() {
    try {
        // 调用预加载脚本中的清除历史函数
        const success = await window.electronAPI.clearChatHistory();
        
        // 清空聊天界面
        if (chatMessages) {
            chatMessages.innerHTML = '';
            
            // 添加一个新的欢迎消息
            addMessage('你好！我是你的学术导师Awei。我可以帮你：\n1. 推荐论文检索关键词\n2. 分析研究方向\n3. 解答学术问题\n请问有什么可以帮你的吗？', 'bot');
            
            console.log('聊天历史已清除');
        }
        
        // 显示成功或失败消息
        if (success) {
            console.log('清除历史记录成功');
        } else {
            console.error('清除历史记录失败');
        }
    } catch (error) {
        console.error('清除聊天历史时出错:', error);
    }
}

// 为快捷检索选项添加更好的样式
const searchSuggestionStyles = document.createElement('style');
searchSuggestionStyles.textContent = `
.search-suggestions {
  margin-top: 12px;
  padding: 12px 15px;
  background-color: #f0f6ff;
  border-radius: 8px;
  border-left: 4px solid #4a90e2;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.suggestions-title {
  font-weight: bold;
  margin-bottom: 10px;
  color: #333;
  font-size: 14px;
  display: flex;
  align-items: center;
}

.suggestions-title:before {
  content: '';
  display: inline-block;
  width: 16px;
  height: 16px;
  margin-right: 8px;
  background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%234a90e2"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>');
  background-repeat: no-repeat;
  background-size: contain;
}

.search-suggestion {
  display: inline-block;
  margin: 5px 8px 5px 0;
  padding: 8px 15px;
  background-color: #e3f0ff;
  color: #2c6cb6;
  border: 1px solid #c6dcf1;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.search-suggestion:hover {
  background-color: #d0e5ff;
  color: #1a4f99;
  transform: translateY(-2px);
  box-shadow: 0 3px 6px rgba(0,0,0,0.15);
}

.search-suggestion:active {
  transform: translateY(0);
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
  background-color: #c2dcff;
}
`;
document.head.appendChild(searchSuggestionStyles);

