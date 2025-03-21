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
    } catch (error) {
        console.error('搜索论文失败:', error);
        errorDiv.textContent = '搜索论文失败: ' + (error.message || '未知错误');
        errorDiv.style.display = 'block';
        
        // 重置变量
        totalResults = 0;
        apiTotalResults = 0;
        userLimitedTotal = 0;
        allPapers = [];
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