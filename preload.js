/**
 * @description 预加载脚本，用于安全地暴露 API
 */
const { contextBridge, ipcRenderer } = require('electron');
const { app } = require('@electron/remote');
const axios = require('axios');
const xml2js = require('xml2js');
const fs = require('fs');
const path = require('path');

/**
 * @description 从arXiv获取论文数据
 * @param {Array} searchQueries - 搜索条件数组
 * @param {Object} options - 搜索选项
 * @returns {Promise<Array>} 论文数据数组
 */
async function fetchArxivPapers(searchQueries, options = {}) {
    const {
        start = 0,
        maxResults = 20,
        dateStart,
        dateEnd,
        sortBy = 'submittedDate',
        sortOrder = 'descending',
        totalMaxResults = 100 // 添加总结果数限制参数
    } = options;

    // 添加重试相关参数
    const maxRetries = 3;
    let retryCount = 0;
    let lastError = null;

    while (retryCount < maxRetries) {
        try {
            // 构建高级搜索查询
            const searchQuery = searchQueries.map((q, index) => {
                const { field, term, operator } = q;
                
                // 检查是否是arXiv ID格式 (YYMM.nnnnn)
                const isArxivId = /^\d{4}\.\d{4,5}$/.test(term.trim());
                
                // 如果是arXiv ID格式，直接使用id:前缀进行精确搜索
                if (isArxivId) {
                    console.log('检测到arXiv ID格式:', term);
                    const formattedTerm = encodeURIComponent(term);
                    const queryPart = `id:${formattedTerm}`;
                    
                    // 第一个条件或空运算符不添加运算符前缀
                    if (index === 0 || !operator) {
                        return queryPart;
                    } else {
                        return `${operator}+${queryPart}`;
                    }
                }
                
                // 正常的字段搜索逻辑
                const prefix = field === 'all' ? 'all' : 
                              field === 'ti' ? 'ti' :
                              field === 'au' ? 'au' :
                              field === 'abs' ? 'abs' :
                              field === 'cat' ? 'cat' : 'all';
                
                // 处理短语搜索（包含空格的搜索词用引号包围）
                const formattedTerm = term.includes(' ') ? 
                    `"${encodeURIComponent(term)}"` : 
                    encodeURIComponent(term);
                
                // 构建查询部分
                const queryPart = `${prefix}:${formattedTerm}`;
                
                // 添加布尔运算符（第一个条件或空运算符不添加运算符前缀）
                if (index === 0 || !operator) {
                    return queryPart;
                } else {
                    return `${operator}+${queryPart}`;
                }
            }).join('+');

            // 不要一次请求太多数据，避免API限制
            // arXiv API 通常限制一次请求不超过100条
            const apiMaxResults = Math.min(100, totalMaxResults); // 使用用户指定的限制值，不再固定为40
            
            const url = `http://export.arxiv.org/api/query?search_query=${searchQuery}&start=${start}&max_results=${apiMaxResults}&sortBy=${sortBy}&sortOrder=${sortOrder}`;
            
            console.log('请求 URL:', url);
            console.log('请求参数:', {
                起始位置: start,
                请求数量: apiMaxResults, // 使用用户指定的限制值
                用户总限制: totalMaxResults,
                重试次数: retryCount,
                排序方式: sortBy,
                排序顺序: sortOrder
            });
            
            const response = await axios.get(url, {
                timeout: 30000, // 设置30秒超时
                headers: {
                    'User-Agent': 'ElectronPaperApp/1.0.0' // 添加用户代理
                }
            });
            
            console.log('API 响应状态:', response.status);
            
            // 打印原始响应数据以便调试
            console.log('API 原始响应的前500个字符:', response.data.substring(0, 500));
            
            const parser = new xml2js.Parser();
            const result = await parser.parseStringPromise(response.data);
            
            // 只打印结果的一部分，避免日志过大
            const resultSummary = {
                feed: {
                    ...result.feed,
                    entry: result.feed?.entry ? `包含 ${result.feed.entry.length} 条条目` : '无条目'
                }
            };
            console.log('解析后的数据摘要:', JSON.stringify(resultSummary, null, 2));
            
            // 获取总结果数（确保是数字）
            let totalResults = 0;
            let originalApiTotal = 0; // 存储API返回的总结果数
            
            if (result.feed && result.feed['opensearch:totalResults']) {
                const rawTotal = result.feed['opensearch:totalResults'][0];
                console.log('原始总结果数:', rawTotal);
                
                // 处理不同的数据结构
                if (typeof rawTotal === 'string') {
                    originalApiTotal = parseInt(rawTotal);
                } else if (typeof rawTotal === 'object') {
                    // 如果是对象，尝试获取 _._ 值
                    if (rawTotal._ && typeof rawTotal._ === 'string') {
                        originalApiTotal = parseInt(rawTotal._);
                    }
                }
                
                if (isNaN(originalApiTotal)) {
                    console.error('解析总结果数失败，原始值:', rawTotal);
                    originalApiTotal = 0;
                    totalResults = 0;
                } else {
                    console.log('API返回的原始总结果数:', originalApiTotal);
                    
                    // 限制总结果数为用户指定的数量
                    totalResults = Math.min(originalApiTotal, totalMaxResults);
                    console.log('限制后的总结果数:', totalResults);
                }
            } else {
                console.warn('找不到 opensearch:totalResults 字段');
            }
            
            // 检查是否有结果
            if (!result.feed?.entry || !Array.isArray(result.feed.entry) || result.feed.entry.length === 0) {
                console.log('没有找到匹配的论文');
                return {
                    papers: [],
                    totalResults: totalResults,
                    originalApiTotal: originalApiTotal // 返回原始API总结果数
                };
            }

            // 获取所有论文
            let papers = result.feed.entry.map(entry => ({
                title: entry.title[0].replace(/\n/g, ' ').trim(),
                authors: entry.author.map(author => author.name[0]).join(', '),
                published: entry.published[0],
                summary: entry.summary[0].replace(/\n/g, ' ').trim(),
                link: entry.id[0],
                updated: entry.updated[0],
                categories: entry.category ? entry.category.map(cat => cat.$.term) : []
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
            
            // 限制返回的论文数量不超过用户设置的总结果数
            if (papers.length > totalMaxResults) {
                papers = papers.slice(0, totalMaxResults);
                console.log(`限制返回的论文数量为: ${totalMaxResults}`);
            }

            console.log('返回数据:', {
                papers数量: papers.length,
                totalResults: totalResults,
                originalApiTotal: originalApiTotal,
                示例论文: papers.length > 0 ? {
                    标题: papers[0].title,
                    作者: papers[0].authors,
                    发布日期: papers[0].published
                } : '无'
            });

            return {
                papers,
                totalResults,
                originalApiTotal // 返回原始API总结果数
            };
        } catch (error) {
            lastError = error;
            retryCount++;
            console.error(`获取论文数据失败 (尝试 ${retryCount}/${maxRetries}):`);
            
            if (error.response) {
                console.error('API 错误响应:', error.response.status);
                console.error('请求 URL:', error.config.url);
                
                // 如果是502错误，可能是服务器过载，增加等待时间
                if (error.response.status === 502) {
                    const waitTime = 2000 * retryCount; // 递增等待时间
                    console.log(`遇到502错误，等待${waitTime/1000}秒后重试...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }
            } else if (error.code === 'ECONNABORTED') {
                console.error('请求超时，等待后重试');
                await new Promise(resolve => setTimeout(resolve, 3000));
            } else {
                console.error('未知错误:', error.message);
            }
            
            if (retryCount >= maxRetries) {
                break; // 达到最大重试次数，跳出循环
            }
        }
    }
    
    // 重试失败后抛出最后一个错误
    if (lastError) {
        console.error('达到最大重试次数，放弃重试');
        throw new Error('获取论文数据失败：' + (lastError.message || '未知错误'));
    }
}

/**
 * @description 获取API密钥
 * @returns {Promise<string|null>} API密钥或null
 */
async function getApiKey() {
    try {
        const configPath = path.join(app.getPath('userData'), 'config.json');
        if (fs.existsSync(configPath)) {
            const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            return configData.apiKey || null;
        }
    } catch (error) {
        console.error('获取API密钥失败:', error);
    }
    return null;
}

/**
 * @description 保存API密钥
 * @param {string} apiKey - API密钥
 * @returns {Promise<boolean>} 是否保存成功
 */
async function saveApiKey(apiKey) {
    try {
        const configPath = path.join(app.getPath('userData'), 'config.json');
        let configData = {};
        
        // 如果配置文件已存在，读取它
        if (fs.existsSync(configPath)) {
            configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }
        
        // 更新API密钥
        configData.apiKey = apiKey;
        
        // 保存回文件
        fs.writeFileSync(configPath, JSON.stringify(configData, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('保存API密钥失败:', error);
        return false;
    }
}

/**
 * @description 翻译文本
 * @param {string} text - 待翻译的文本
 * @param {string} apiKey - API密钥
 * @param {string} model - 翻译模型，默认为Qwen/Qwen2.5-7B-Instruct
 * @returns {Promise<string>} 翻译后的文本
 */
async function translateText(text, apiKey, model = 'Qwen/Qwen2.5-7B-Instruct') {
    try {
        // 确保文本不超过模型最大上下文长度
        const maxLength = 12000; // 保守估计，32k的三分之一左右
        const truncatedText = text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
        
        console.log(`使用模型 ${model} 进行翻译`);
        
        const response = await axios.post('https://api.siliconflow.cn/v1/chat/completions', {
            model: model, // 使用传入的模型参数
            messages: [
                { role: 'system', content: '你是一个专业的翻译助手，你的任务是将英文文本准确地翻译成中文，保持专业术语的准确性。只返回翻译结果，不要解释或添加任何其他内容。' },
                { role: 'user', content: `将以下文本翻译成中文：\n\n${truncatedText}` }
            ],
            max_tokens: 4000
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            }
        });
        
        if (response.data && response.data.choices && response.data.choices.length > 0) {
            return response.data.choices[0].message.content;
        }
        
        throw new Error('翻译API返回格式异常');
    } catch (error) {
        console.error('翻译失败:', error.message);
        if (error.response) {
            console.error('API错误:', error.response.data);
        }
        throw new Error('翻译失败：' + (error.response?.data?.error?.message || error.message));
    }
}

/**
 * @description 保存API密钥和翻译模型设置
 * @param {Object} settings - 设置对象
 * @returns {Promise<boolean>} 是否保存成功
 */
async function saveSettings(settings) {
    try {
        const configPath = path.join(app.getPath('userData'), 'config.json');
        let configData = {};
        
        // 如果配置文件已存在，读取它
        if (fs.existsSync(configPath)) {
            configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }
        
        // 更新配置
        configData = { ...configData, ...settings };
        
        // 保存配置
        fs.writeFileSync(configPath, JSON.stringify(configData, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('保存设置失败:', error);
        return false;
    }
}

/**
 * @description 选择目录
 * @returns {Promise<string|null>} 选择的目录路径或null
 */
async function selectDirectory() {
    try {
        const result = await ipcRenderer.invoke('select-directory');
        return result || null;
    } catch (error) {
        console.error('选择目录失败:', error);
        return null;
    }
}

/**
 * @description 保存文件
 * @param {string} filePath - 文件路径
 * @param {string} content - 文件内容
 * @returns {Promise<Object>} 保存结果
 */
async function saveFile(filePath, content) {
    try {
        fs.writeFileSync(filePath, content, 'utf8');
        return { success: true, path: filePath };
    } catch (error) {
        console.error('保存文件失败:', error);
        return { success: false, error: error.message, path: filePath };
    }
}

// 将 Electron API 暴露给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
    // arXiv API 相关
    fetchArxivPapers: (searchQueries, options) => fetchArxivPapers(searchQueries, options),
    
    // 设置相关
    getApiKey: () => ipcRenderer.invoke('get-api-key'),
    saveApiKey: (apiKey) => ipcRenderer.invoke('save-api-key', apiKey),
    saveSettings: (settings) => saveSettings(settings),
    
    // 模型调用相关
    translateText: (text, apiKey, model) => translateText(text, apiKey, model),
    
    // 文件操作相关
    selectDirectory: () => ipcRenderer.invoke('select-directory'),
    saveFile: (filePath, content) => saveFile(filePath, content),
    
    // 对话框相关
    showInputBox: (options) => ipcRenderer.invoke('dialog:showInputBox', options),
    
    // 外部链接相关
    openExternal: (url) => ipcRenderer.invoke('open-external', url),
    
    // 语言相关
    getLanguage: () => ipcRenderer.invoke('get-language'),
    onLanguageChanged: (callback) => ipcRenderer.on('language-changed', (_, language) => callback(language))
}); 