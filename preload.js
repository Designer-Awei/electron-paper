/**
 * @description 预加载脚本，用于安全地暴露 API
 */
const { contextBridge } = require('electron');
const axios = require('axios');
const xml2js = require('xml2js');

/**
 * @description 从arXiv获取论文数据
 * @param {string} query - 搜索关键词
 * @param {Object} options - 搜索选项
 * @returns {Promise<Array>} 论文数据数组
 */
async function fetchArxivPapers(query, options = {}) {
    const {
        start = 0,
        maxResults = 20,
        dateStart,
        dateEnd
    } = options;

    try {
        // 构建基础查询
        const searchQuery = `search_query=all:${encodeURIComponent(query)}`;
        const url = `http://export.arxiv.org/api/query?${searchQuery}&start=${start}&max_results=${maxResults}&sortBy=submittedDate&sortOrder=descending`;
        
        console.log('请求 URL:', url);
        
        const response = await axios.get(url);
        console.log('API 响应状态:', response.status);
        
        const parser = new xml2js.Parser();
        const result = await parser.parseStringPromise(response.data);
        
        console.log('总结果数:', result.feed?.opensearch$totalResults?.[0]);
        
        if (!result.feed?.entry) {
            console.log('没有找到匹配的论文');
            return [];
        }

        // 获取所有论文
        let papers = result.feed.entry.map(entry => ({
            title: entry.title[0].replace(/\n/g, ' ').trim(),
            authors: entry.author.map(author => author.name[0]).join(', '),
            published: entry.published[0],
            summary: entry.summary[0].replace(/\n/g, ' ').trim(),
            link: entry.id[0],
            updated: entry.updated[0]
        }));

        // 如果指定了日期范围，在客户端进行过滤
        if (dateStart && dateEnd) {
            const startDate = new Date(dateStart);
            const endDate = new Date(dateEnd);
            papers = papers.filter(paper => {
                const paperDate = new Date(paper.published);
                return paperDate >= startDate && paperDate <= endDate;
            });
        }

        // 按发布日期降序排序
        papers.sort((a, b) => new Date(b.published) - new Date(a.published));

        return papers;
    } catch (error) {
        console.error('获取论文数据失败:', error);
        if (error.response) {
            console.error('API 错误响应:', error.response.status, error.response.data);
        }
        throw new Error('获取论文数据失败：' + (error.message || '未知错误'));
    }
}

// 暴露安全的API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
    versions: {
        node: () => process.versions.node,
        chrome: () => process.versions.chrome,
        electron: () => process.versions.electron
    },
    arxiv: {
        fetchPapers: fetchArxivPapers
    }
}); 