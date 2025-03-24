/**
 * @description 渲染进程的主要逻辑
 */
console.log('渲染进程已加载');

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
const mainSearchContainer = document.getElementById('mainSearchContainer');
const historyContainer = document.getElementById('historyContainer');
const favoritesContainer = document.getElementById('favoritesContainer');
const settingsContainer = document.getElementById('settingsContainer');

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
let apiKey = ''; // 存储当前API密钥
let lastUsedTranslationModel = ''; // 存储上次使用的翻译模型
let isTranslationCancelled = false; // 控制翻译取消

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
    select.innerHTML = searchField.innerHTML;
    
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
    
    // 调用原始搜索函数
    const result = await originalSearchPapers();
    
    // 只有在搜索结果有效且不是从历史记录应用时，才添加到历史记录
    if (!isApplyingFromHistory && allPapers && allPapers.length > 0) {
        addToHistory(tempSearchData);
    }
    
    // 重置标志位
    isApplyingFromHistory = false;
    
    return result;
};

/**
 * @description 搜索论文
 */
async function searchPapers() {
    console.log('开始搜索论文...');
    try {
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
            errorDiv.textContent = '未找到相关论文或API返回数据异常';
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
        link.addEventListener('click', (e) => {
            e.preventDefault();
            window.electronAPI.openExternal(paper.link);
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
        mainSearchContainer.style.display = 'block';
        mainSearchResults.style.display = 'block';
        historyContainer.style.display = 'none';
        favoritesContainer.style.display = 'none';
    });
    
    historySearchTab.addEventListener('click', () => {
        historySearchTab.classList.add('active');
        mainSearchTab.classList.remove('active');
        favoritesTab.classList.remove('active');
        historyContainer.style.display = 'block';
        mainSearchContainer.style.display = 'none';
        mainSearchResults.style.display = 'none';
        favoritesContainer.style.display = 'none';
        
        renderSearchHistory();
    });
    
    favoritesTab.addEventListener('click', () => {
        favoritesTab.classList.add('active');
        mainSearchTab.classList.remove('active');
        historySearchTab.classList.remove('active');
        favoritesContainer.style.display = 'block';
        mainSearchContainer.style.display = 'none';
        mainSearchResults.style.display = 'none';
        historyContainer.style.display = 'none';
        
        renderFavorites();
    });
});

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
 * @param {Object} searchData 搜索条件数据
 */
function addToHistory(searchData) {
    const history = getSearchHistory();
    
    // 检查是否有完全相同的搜索条件已存在于历史记录中
    const isDuplicate = history.some(item => {
        // 检查主要搜索条件是否相同
        const basicConditionsMatch = (
            item.searchField === searchData.searchField &&
            item.searchInput === searchData.searchInput &&
            item.timeRange === searchData.timeRange &&
            item.sortBy === searchData.sortBy &&
            item.sortOrder === searchData.sortOrder &&
            item.maxResults === searchData.maxResults
        );
        
        // 如果基本条件不匹配，直接返回false
        if (!basicConditionsMatch) return false;
        
        // 检查额外搜索字段是否匹配
        // 首先检查长度是否相同
        if ((item.additionalFields?.length || 0) !== (searchData.additionalFields?.length || 0)) {
            return false;
        }
        
        // 如果没有额外字段，则视为匹配
        if (!item.additionalFields || item.additionalFields.length === 0) {
            return true;
        }
        
        // 检查每个额外字段是否都匹配
        // 注意：这个实现假设额外字段的顺序也必须相同
        return item.additionalFields.every((field, index) => {
            const newField = searchData.additionalFields[index];
            return (
                field.field === newField.field &&
                field.term === newField.term &&
                field.operator === newField.operator
            );
        });
    });
    
    // 如果是重复的搜索条件，则不添加到历史记录
    if (isDuplicate) {
        console.log('搜索条件重复，不添加到历史记录');
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
    
    // 设置搜索字段
    document.getElementById('searchField').value = historyItem.searchField;
    document.getElementById('searchInput').value = historyItem.searchInput;
    
    // 设置时间范围
    document.getElementById('timeRange').value = historyItem.timeRange;
    
    // 设置排序条件
    document.getElementById('sortBy').value = historyItem.sortBy;
    document.getElementById('sortOrder').value = historyItem.sortOrder;
    
    // 设置结果限制
    document.getElementById('maxResults').value = historyItem.maxResults;
    
    // 清空额外字段容器
    const additionalFieldsContainer = document.getElementById('additionalFields');
    additionalFieldsContainer.innerHTML = '';
    
    // 如果有额外的搜索字段，重新创建它们
    if (historyItem.additionalFields && historyItem.additionalFields.length > 0) {
        historyItem.additionalFields.forEach(field => {
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
            const favoriteItemObj = favorites.find(h => h.id === item.id);
            if (favoriteItemObj) {
                applyHistorySearch(favoriteItemObj);
            }
        });
        
        favoritesList.appendChild(favoriteItem);
    });
}

/**
 * @description 显示API密钥输入弹窗
 */
function showApiKeyModal() {
    apiKeyModal.style.display = 'block';
}

/**
 * @description 隐藏API密钥输入弹窗
 */
function hideApiKeyModal() {
    apiKeyModal.style.display = 'none';
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
        await loadApiKey();
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
        return translated;
    } catch (error) {
        console.error('翻译错误:', error);
        alert(`翻译失败: ${error.message}`);
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
                    allPapers = translatedPapers;
                    renderPapers();
                    return;
                }
            }
            
            // 执行翻译（当模型变更或没有缓存结果时）
            translateButton.disabled = true;
            
            // 执行非阻塞翻译，让界面保持响应
            translatePapers(allPapers).then(() => {
                console.log('翻译任务完成');
                translateButton.disabled = false;
            }).catch(error => {
                console.error('翻译任务出错:', error);
                translateButton.disabled = false;
            });
            
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
        alert('翻译失败: ' + error.message);
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
        
        // 加载API密钥
        const key = await window.electronAPI.getApiKey();
        if (key) {
            settingsApiKey.value = key;
            apiKey = key;
        }
        
        // 加载翻译模型设置 (这部分可以根据需要扩展)
        // ... 

        // 加载导出路径设置 (这部分可以根据需要扩展)
        // ...

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
    
    mainSearchContainer.style.display = 'block';
    historyContainer.style.display = 'none';
    favoritesContainer.style.display = 'none';
    settingsContainer.style.display = 'none';
});

historySearchTab.addEventListener('click', () => {
    mainSearchTab.classList.remove('active');
    historySearchTab.classList.add('active');
    favoritesTab.classList.remove('active');
    settingsTab.classList.remove('active');
    
    mainSearchContainer.style.display = 'none';
    historyContainer.style.display = 'block';
    favoritesContainer.style.display = 'none';
    settingsContainer.style.display = 'none';
    
    renderSearchHistory();
});

favoritesTab.addEventListener('click', () => {
    mainSearchTab.classList.remove('active');
    historySearchTab.classList.remove('active');
    favoritesTab.classList.add('active');
    settingsTab.classList.remove('active');
    
    mainSearchContainer.style.display = 'none';
    historyContainer.style.display = 'none';
    favoritesContainer.style.display = 'block';
    settingsContainer.style.display = 'none';
    
    renderFavorites();
});

settingsTab.addEventListener('click', () => {
    mainSearchTab.classList.remove('active');
    historySearchTab.classList.remove('active');
    favoritesTab.classList.remove('active');
    settingsTab.classList.add('active');
    
    mainSearchContainer.style.display = 'none';
    historyContainer.style.display = 'none';
    favoritesContainer.style.display = 'none';
    settingsContainer.style.display = 'block';
    
    // 隐藏搜索结果区域
    document.getElementById('mainSearchResults').style.display = 'none';
    
    loadSettings();
});

// 保存设置按钮事件
saveSettingsButton.addEventListener('click', saveSettings);

// 修改之前的openSettings函数
async function openSettings() {
    settingsTab.click();
}

// 添加事件监听器
saveApiKeyButton.addEventListener('click', saveApiKey);
cancelApiKeyButton.addEventListener('click', hideApiKeyModal);
closeModalButton.addEventListener('click', hideApiKeyModal);

// 当窗口点击时，如果点击的是模态框外部，则关闭模态框
window.addEventListener('click', (event) => {
    if (event.target === apiKeyModal) {
        hideApiKeyModal();
    }
});

/**
 * @description 根据搜索结果更新表格内容
 * @param {Array} results 搜索结果数组
 */
function updateTable(results) {
    papersTableBody.innerHTML = '';
    console.log('更新表格，结果数量:', results.length);

    results.forEach(paper => {
        const row = document.createElement('tr');
        row.dataset.id = paper.id || paper.link; // 使用ID或链接作为标识符
        
        // 添加勾选框单元格 (第1列)
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
        row.appendChild(checkboxCell);

        // 标题单元格 (第2列)
        const titleCell = document.createElement('td');
        titleCell.className = 'title-cell';
        titleCell.textContent = paper.title;
        row.appendChild(titleCell);

        // 作者单元格 (第3列)
        const authorsCell = document.createElement('td');
        authorsCell.className = 'authors-cell';
        authorsCell.textContent = Array.isArray(paper.authors) ? paper.authors.join(', ') : paper.authors;
        row.appendChild(authorsCell);

        // 日期单元格 (第4列)
        const dateCell = document.createElement('td');
        dateCell.textContent = new Date(paper.published).toLocaleDateString();
        row.appendChild(dateCell);

        // 链接单元格 (第5列)
        const linkCell = document.createElement('td');
        linkCell.className = 'link-cell';
        
        const link = document.createElement('a');
        link.href = paper.link;
        link.textContent = '查看';
        link.addEventListener('click', (e) => {
            e.preventDefault();
            window.electronAPI.openExternal(paper.link);
        });
        
        linkCell.appendChild(link);
        row.appendChild(linkCell);

        // 摘要单元格 (第6列)
        const abstractCell = document.createElement('td');
        abstractCell.className = 'abstract-cell';
        abstractCell.textContent = paper.summary;
        row.appendChild(abstractCell);

        papersTableBody.appendChild(row);
    });

    // 更新论文的选中状态
    updateCheckboxStates();
}

/**
 * @description 更新全选和所有复选框的状态
 */
function updateCheckboxStates() {
    const checkboxes = papersTableBody.querySelectorAll('input[type="checkbox"]');
    const allChecked = checkboxes.length > 0 && Array.from(checkboxes).every(cb => cb.checked);
    selectAllPapers.checked = allChecked;
}

/**
 * @description 处理全选/取消全选
 */
selectAllPapers.addEventListener('change', function() {
    const isChecked = this.checked;
    
    // 修改：全选时选中所有论文，而不仅仅是当前页
    if (isChecked) {
        // 全选所有论文
        allPapers.forEach(paper => {
            selectedPaperIds.add(paper.id || paper.link);
        });
        
        // 更新当前页面上所有复选框
        const checkboxes = papersTableBody.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = true;
        });
    } else {
        // 取消全选
        selectedPaperIds.clear();
        
        // 更新当前页面上所有复选框
        const checkboxes = papersTableBody.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });
    }
    
    console.log(`全选状态: ${isChecked}, 选中论文数: ${selectedPaperIds.size}`);
});

/**
 * @description 格式化论文数据导出为JSON
 * @param {Boolean} translated 是否导出翻译后的数据
 * @returns {Object} 格式化后的论文数据
 */
function formatPapersForExport(translated = false) {
    // 确定使用哪个数据源 - 修复可能导致导出0篇的问题
    let papers;
    if (translated && isTranslated) {
        papers = allPapers; // 使用当前翻译后的数据
    } else if (originalPapers.length > 0) {
        papers = originalPapers; // 使用原始数据（如果有）
    } else {
        papers = allPapers; // 如果原始数据为空，则使用当前数据
    }
    
    // 检查papers是否有效
    if (!papers || papers.length === 0) {
        console.warn('formatPapersForExport: 未找到有效的论文数据');
        papers = allPapers; // 最终备选：使用全局allPapers
    }
    
    console.log(`准备导出，数据源：${papers === allPapers ? 'allPapers' : 'originalPapers'}, 数据量: ${papers.length}, 选中论文: ${selectedPaperIds.size}`);
    
    const selectedPapers = papers.filter(paper => selectedPaperIds.has(paper.id || paper.link));
    console.log(`过滤出选中论文: ${selectedPapers.length} 篇`);
    
    // 如果没有选中任何论文，默认导出全部
    const papersToExport = selectedPapers.length > 0 ? selectedPapers : papers;
    console.log(`最终导出论文数量: ${papersToExport.length} 篇`);
    
    // 去重处理 - 基于链接
    const uniquePapers = [];
    const linkSet = new Set();
    
    papersToExport.forEach(paper => {
        const paperLink = paper.link || '';
        if (!linkSet.has(paperLink)) {
            linkSet.add(paperLink);
            uniquePapers.push({
                title: paper.title,
                authors: paper.authors,
                published: paper.published,
                link: paper.link,
                summary: paper.summary,
                categories: paper.categories || [],
                translated: translated && isTranslated
            });
        }
    });
    
    console.log(`去重后导出论文数量: ${uniquePapers.length} 篇`);
    
    return {
        timestamp: new Date().toISOString(),
        count: uniquePapers.length,
        papers: uniquePapers
    };
}

/**
 * @description 处理导出按钮点击
 */
exportButton.addEventListener('click', async function() {
    // 检查是否有论文数据
    if (allPapers.length === 0) {
        alert('没有可导出的论文数据，请先搜索论文');
        return;
    }
    
    // 检查是否有选中的论文
    if (selectedPaperIds.size === 0) {
        // 提示用户是否导出所有论文
        if (!confirm(`您当前没有选择任何论文，是否导出全部 ${allPapers.length} 篇论文？`)) {
            return;
        }
    }
    
    // 直接调用导出函数，不再需要先选择导出路径
    exportPapers();
});

/**
 * @description 显示导出消息
 * @param {String} message 消息内容
 * @param {String} type 消息类型 ('warning', 'success', 'error')
 */
function showExportMessage(message, type = 'warning') {
    exportMessage.textContent = message;
    exportMessage.className = `export-message export-${type}`;
    exportMessage.style.display = 'block';
    
    // 5秒后自动隐藏
    setTimeout(() => {
        exportMessage.style.display = 'none';
    }, 5000);
}

/**
 * @description 导出论文数据为JSON文件
 */
async function exportPapers() {
    try {
        console.log('开始导出论文...');
        
        // 检查是否有论文数据
        if (allPapers.length === 0) {
            alert('没有可导出的论文数据');
            return;
        }
        
        // 准备导出数据
        const isExportTranslated = isTranslated;
        const data = formatPapersForExport(isExportTranslated);
        
        // 创建默认文件名（包含日期和时间，精确到分钟）
        const now = new Date();
        const date = now.toISOString().slice(0, 10);
        const time = now.toTimeString().slice(0, 5).replace(':', '-');
        const defaultFileName = `arxiv-papers-${date}_${time}.json`;
        
        // 让用户输入自定义文件名
        console.log('请求用户输入文件名...');
        const fileNameInput = await window.electronAPI.showInputBox({
            title: '导出论文',
            prompt: '请输入文件名 (默认将使用日期时间)',
            defaultValue: defaultFileName,
            placeholder: '输入文件名 (无需扩展名)'
        });
        
        // 如果用户取消了操作，则中止导出
        if (!fileNameInput || fileNameInput.canceled) {
            console.log('用户取消了文件名输入');
            return;
        }
        
        // 确保文件名有.json扩展名
        let fileName = fileNameInput.value || defaultFileName;
        if (!fileName.toLowerCase().endsWith('.json')) {
            fileName += '.json';
        }
        
        // 选择保存目录
        console.log('请选择保存目录...');
        const saveDir = await window.electronAPI.selectDirectory();
        
        if (!saveDir) {
            console.log('用户取消了选择目录');
            return;
        }
        
        // 构建完整的文件路径
        const filePath = `${saveDir}/${fileName}`;
        console.log(`准备导出 ${data.count} 篇论文到: ${filePath}`);
        
        // 保存文件
        const saveResult = await window.electronAPI.saveFile(filePath, JSON.stringify(data, null, 2));
        
        if (saveResult && saveResult.success) {
            alert(`导出成功！已保存 ${data.count} 篇论文到:\n${saveResult.path || filePath}`);
        } else {
            alert(`导出失败：${saveResult && saveResult.error ? saveResult.error : '未知错误'}`);
        }
        
    } catch (error) {
        console.error('导出论文时出错:', error);
        alert(`导出失败: ${error.message}`);
    }
}

/**
 * @description 处理导出路径选择按钮
 */
confirmExport.addEventListener('click', async function() {
    try {
        const selectedPath = await window.electronAPI.selectDirectory();
        if (selectedPath) {
            exportPath = selectedPath;
            paperExportPath.value = selectedPath;
            
            // 保存到本地存储
            localStorage.setItem('paperExportPath', selectedPath);
            
            // 关闭弹窗并执行导出
            exportModal.style.display = 'none';
            exportPapers();
        }
    } catch (error) {
        console.error('选择导出路径时出错:', error);
        showExportMessage(`选择路径失败: ${error.message}`, 'error');
    }
});

/**
 * @description 处理设置页面中的选择路径按钮
 */
selectPathButton.addEventListener('click', async function() {
    try {
        const selectedPath = await window.electronAPI.selectDirectory();
        if (selectedPath) {
            exportPath = selectedPath;
            paperExportPath.value = selectedPath;
            
            // 保存到本地存储
            localStorage.setItem('paperExportPath', selectedPath);
            
            // 显示成功消息
            settingsStatusMessage.textContent = '导出路径已成功保存';
            settingsStatusMessage.className = 'status-message success';
            settingsStatusMessage.style.display = 'block';
            
            // 3秒后隐藏消息
            setTimeout(() => {
                settingsStatusMessage.style.display = 'none';
            }, 3000);
        }
    } catch (error) {
        console.error('选择导出路径时出错:', error);
        settingsStatusMessage.textContent = `选择路径失败: ${error.message}`;
        settingsStatusMessage.className = 'status-message error';
        settingsStatusMessage.style.display = 'block';
    }
});

/**
 * @description 处理导出弹窗关闭
 */
function closeExportModalHandler() {
    exportModal.style.display = 'none';
    exportMessage.style.display = 'none';
}

closeExportModal.addEventListener('click', closeExportModalHandler);
cancelExport.addEventListener('click', closeExportModalHandler);

// 加载保存的导出路径
document.addEventListener('DOMContentLoaded', function() {
    const savedPath = localStorage.getItem('paperExportPath');
    if (savedPath) {
        exportPath = savedPath;
        paperExportPath.value = savedPath;
    }
    
    // 确保按钮事件监听器正确绑定
    console.log('正在绑定翻译和导出按钮事件...');
    
    // 绑定翻译按钮事件
    const translateBtn = document.getElementById('translateButton');
    if (translateBtn) {
        // 先移除可能的旧事件监听器，防止重复绑定
        translateBtn.removeEventListener('click', toggleTranslation);
        // 然后添加新的事件监听器
        translateBtn.addEventListener('click', toggleTranslation);
        console.log('翻译按钮事件已绑定');
    } else {
        console.error('未找到翻译按钮元素');
    }
    
    // 绑定导出按钮事件
    const exportBtn = document.getElementById('exportButton');
    if (exportBtn) {
        // 先移除可能的旧事件监听器，防止重复绑定
        const exportHandler = async function() {
            console.log('导出按钮被点击');
            // 检查是否有论文数据
            if (!allPapers || allPapers.length === 0) {
                alert('没有可导出的论文数据，请先搜索论文');
                return;
            }
            
            // 检查是否有选中的论文
            if (selectedPaperIds.size === 0) {
                // 提示用户是否导出所有论文
                if (!confirm(`您当前没有选择任何论文，是否导出全部 ${allPapers.length} 篇论文？`)) {
                    return;
                }
            }
            
            // 直接调用导出函数
            exportPapers();
        };
        
        // 先移除所有现有的click事件处理程序
        exportBtn.replaceWith(exportBtn.cloneNode(true));
        // 重新获取元素引用
        const newExportBtn = document.getElementById('exportButton');
        // 添加唯一的事件处理程序
        newExportBtn.addEventListener('click', exportHandler);
        console.log('导出按钮事件已绑定');
    } else {
        console.error('未找到导出按钮元素');
    }
});

// 更新搜索输入框提示
searchInput.placeholder = '输入关键词或arXiv ID (如2502.14776)';

// 初始化页面
document.addEventListener('DOMContentLoaded', function() {
    // 获取语言设置
    window.electronAPI.getLanguage()
        .then(language => {
            console.log('当前语言设置:', language);
            // 可以根据语言设置修改界面
        })
        .catch(error => {
            console.error('获取语言设置失败:', error);
        });
    
    // 监听语言变更事件
    window.electronAPI.onLanguageChanged(language => {
        console.log('语言已变更为:', language);
        // 可以根据语言设置修改界面
    });
    
    // 处理设置页面的外部链接
    const siliconFlowLink = document.getElementById('siliconFlowLink');
    if (siliconFlowLink) {
        siliconFlowLink.addEventListener('click', function(e) {
            e.preventDefault();
            window.electronAPI.openExternal('https://cloud.siliconflow.cn/account/ak')
                .then(success => {
                    if (!success) {
                        console.error('打开SiliconFlow链接失败');
                    }
                })
                .catch(error => {
                    console.error('打开外部链接时出错:', error);
                });
        });
    }
    
    const jsonToExcelLink = document.getElementById('jsonToExcelLink');
    if (jsonToExcelLink) {
        jsonToExcelLink.addEventListener('click', function(e) {
            e.preventDefault();
            window.electronAPI.openExternal('https://wejson.cn/json2excel/')
                .then(success => {
                    if (!success) {
                        console.error('打开JSON转Excel链接失败');
                    }
                })
                .catch(error => {
                    console.error('打开外部链接时出错:', error);
                });
        });
    }
    
    const searchButton = document.getElementById('searchButton');
    const clearHistoryButton = document.getElementById('clearHistory');
    const exportButton = document.getElementById('exportButton');
    
    // 按钮事件绑定
    if (searchButton) {
        searchButton.addEventListener('click', () => {
            console.log('点击搜索按钮，开始搜索');
            currentPage = 1; // 重置页码
            searchPapers();
        });
    }
    
    if (clearHistoryButton) {
        clearHistoryButton.addEventListener('click', () => {
            if (confirm('确定要清空所有历史记录吗？')) {
                localStorage.removeItem('searchHistory');
                historyList.innerHTML = '<p>暂无历史记录</p>';
                console.log('历史记录已清空');
            }
        });
    }
    
    if (exportButton) {
        // 先移除可能的旧事件监听器，防止重复绑定
        const exportHandler = async function() {
            console.log('导出按钮被点击');
            // 检查是否有论文数据
            if (!allPapers || allPapers.length === 0) {
                alert('没有可导出的论文数据，请先搜索论文');
                return;
            }
            
            // 检查是否有选中的论文
            if (selectedPaperIds.size === 0) {
                // 提示用户是否导出所有论文
                if (!confirm(`您当前没有选择任何论文，是否导出全部 ${allPapers.length} 篇论文？`)) {
                    return;
                }
            }
            
            // 直接调用导出函数
            exportPapers();
        };
        
        // 先移除所有现有的click事件处理程序
        exportButton.replaceWith(exportButton.cloneNode(true));
        // 重新获取元素引用
        const newExportBtn = document.getElementById('exportButton');
        // 添加唯一的事件处理程序
        if (newExportBtn) {
            newExportBtn.addEventListener('click', exportHandler);
            console.log('导出按钮事件已绑定');
        } else {
            console.error('未找到导出按钮元素');
        }
    }
    
    // 加载历史搜索记录
    renderSearchHistory();
    // 加载收藏夹
    renderFavorites();
    // 更新标签页状态
    updateTabState();
});

/**
 * @description 更新标签页状态
 * @returns {void}
 */
function updateTabState() {
    // 获取所有标签页和内容区域
    const tabs = {
        mainSearch: {
            tab: mainSearchTab,
            container: mainSearchContainer
        },
        history: {
            tab: historySearchTab,
            container: historyContainer
        },
        favorites: {
            tab: favoritesTab,
            container: favoritesContainer
        },
        settings: {
            tab: settingsTab,
            container: settingsContainer
        }
    };

    // 查找当前激活的标签
    const activeTab = Object.values(tabs).find(({tab}) => 
        tab && tab.classList.contains('active')
    );

    // 如果没有激活的标签，默认激活主搜索标签
    if (!activeTab) {
        tabs.mainSearch.tab.classList.add('active');
        tabs.mainSearch.container.style.display = 'block';
        return;
    }

    // 更新所有标签页的显示状态
    Object.values(tabs).forEach(({tab, container}) => {
        if (tab === activeTab.tab) {
            container.style.display = 'block';
        } else {
            container.style.display = 'none';
        }
    });
}