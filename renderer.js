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
 * @description 搜索论文
 */
async function searchPapers() {
    console.log('开始搜索论文...');
    try {
        // 显示加载状态
        loadingDiv.style.display = 'block';
        errorDiv.style.display = 'none';
        papersTableBody.innerHTML = '';

        // 获取搜索参数
        const query = searchInput.value.trim() || 'LLM';
        const dateRange = getDateRange();
        const max = Math.min(Math.max(parseInt(maxResults.value) || 20, 1), 100);
        
        console.log('搜索参数:', {
            query,
            dateRange,
            maxResults: max
        });

        // 调用 API 获取论文数据
        const papers = await window.electronAPI.arxiv.fetchPapers(query, {
            start: 0,
            maxResults: max,
            dateStart: dateRange.start,
            dateEnd: dateRange.end
        });
        
        console.log('获取到论文数量:', papers.length);

        if (papers.length === 0) {
            errorDiv.textContent = '未找到相关论文';
            errorDiv.style.display = 'block';
            return;
        }

        // 渲染论文数据
        papers.forEach((paper, index) => {
            console.log(`渲染第 ${index + 1} 篇论文:`, paper.title);
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <div style="height: 100%; display: flex; flex-direction: column;">
                        <div class="title-cell" style="flex: 0 0 auto;">${paper.title}</div>
                    </div>
                </td>
                <td>
                    <div style="height: 100%; display: flex; flex-direction: column;">
                        <div class="authors-cell" style="flex: 0 0 auto;">${paper.authors}</div>
                    </div>
                </td>
                <td>${new Date(paper.published).toLocaleDateString('zh-CN')}</td>
                <td class="link-cell">
                    <a href="${paper.link}" target="_blank">查看</a>
                </td>
                <td>
                    <div class="abstract-cell">${paper.summary}</div>
                </td>
            `;
            papersTableBody.appendChild(row);
        });
    } catch (error) {
        console.error('搜索论文失败:', error);
        errorDiv.textContent = '搜索论文失败: ' + (error.message || '未知错误');
        errorDiv.style.display = 'block';
    } finally {
        loadingDiv.style.display = 'none';
    }
}

// 页面加载完成后自动搜索
document.addEventListener('DOMContentLoaded', () => {
    console.log('页面加载完成，开始初始搜索');
    searchPapers();
});

// 监听回车键
searchInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        console.log('检测到回车键，开始搜索');
        searchPapers();
    }
});

// 监听搜索按钮点击
searchButton.addEventListener('click', () => {
    console.log('点击搜索按钮，开始搜索');
    searchPapers();
}); 