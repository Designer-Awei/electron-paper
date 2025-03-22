/**
 * @description 渲染进程的主要逻辑
 */
console.log('渲染进程已加载');

// 使用安全的 API 获取版本信息
const versions = window.electronAPI.versions;
console.log('Node.js 版本:', versions.node());
console.log('Chrome 版本:', versions.chrome());
console.log('Electron 版本:', versions.electron());

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

// 当前页码和每页数量
let currentPage = 1;
let totalResults = 0;
let apiTotalResults = 0; // 添加API返回的原始总结果数变量

// 添加变量来存储所有获取到的论文和全局状态
let allPapers = []; // 存储所有获取到的论文
let userLimitedTotal = 0; // 用户限制的总论文数

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
        const result = await window.electronAPI.arxiv.fetchPapers(queries, {
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
        
        // 创建标题单元格
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
        
        // 创建作者单元格
        const authorCell = document.createElement('td');
        const authorContainer = document.createElement('div');
        authorContainer.style.height = '100%';
        
        const authorDiv = document.createElement('div');
        authorDiv.className = 'authors-cell';
        authorDiv.textContent = paper.authors;
        
        // 将作者省略号始终显示在最后一行
        authorContainer.appendChild(authorDiv);
        authorCell.appendChild(authorContainer);
        
        // 创建日期单元格
        const dateCell = document.createElement('td');
        dateCell.textContent = new Date(paper.published).toLocaleDateString('zh-CN');
        
        // 创建链接单元格
        const linkCell = document.createElement('td');
        linkCell.className = 'link-cell';
        
        const link = document.createElement('a');
        link.href = paper.link;
        link.target = '_blank';
        link.textContent = '查看';
        
        linkCell.appendChild(link);
        
        // 创建摘要单元格
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
        
        // 将所有单元格添加到行
        row.appendChild(titleCell);
        row.appendChild(authorCell);
        row.appendChild(dateCell);
        row.appendChild(linkCell);
        row.appendChild(summaryCell);
        
        papersTableBody.appendChild(row);
    });
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