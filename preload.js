/**
 * @description 预加载脚本，用于安全地暴露 API
 */
const { contextBridge, ipcRenderer } = require('electron');
const { app } = require('@electron/remote');
const axios = require('axios');
const xml2js = require('xml2js');
const fs = require('fs');
const path = require('path');
const { clipboard } = require('electron');
const { shell } = require('electron');

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
            console.log('开始获取arXiv论文，第', retryCount + 1, '次尝试');
            
            // 检查searchQueries是否有效
            if (!searchQueries || !Array.isArray(searchQueries) || searchQueries.length === 0) {
                throw new Error('搜索查询为空或格式不正确');
            }
            
            // 构建高级搜索查询
            const searchQuery = searchQueries.map((q, index) => {
                const { field, term, operator } = q;
                
                // 检查必要字段是否存在
                if (!field || !term) {
                    console.warn('缺少搜索字段或搜索词:', q);
                    return '';
                }
                
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
            }).filter(part => part !== '').join('+');
            
            // 检查最终查询字符串是否为空
            if (!searchQuery) {
                throw new Error('生成的搜索查询为空');
            }

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
            
            // 尝试使用axios进行请求
            let response;
            try {
                response = await axios.get(url, {
                    timeout: 30000, // 设置30秒超时
                    headers: {
                        'User-Agent': 'ElectronPaperApp/1.0.0' // 添加用户代理
                    }
                });
            } catch (axiosError) {
                console.error('Axios请求失败:', axiosError.message);
                // 特殊处理网络错误
                if (axiosError.code === 'ECONNREFUSED' || axiosError.code === 'ENOTFOUND') {
                    throw new Error('无法连接到arXiv服务器，请检查网络连接');
                } else if (axiosError.code === 'ETIMEDOUT') {
                    throw new Error('连接arXiv服务器超时，请稍后重试');
                } else {
                    throw axiosError; // 重新抛出以便外层捕获
                }
            }
            
            console.log('API 响应状态:', response.status);
            
            // 检查响应状态
            if (response.status !== 200) {
                throw new Error(`API返回错误状态码: ${response.status}`);
            }
            
            // 检查响应数据是否为XML
            if (!response.data || typeof response.data !== 'string' || !response.data.includes('<?xml')) {
                throw new Error('API返回数据格式错误，应为XML');
            }
            
            // 打印原始响应数据以便调试
            console.log('API 原始响应的前500个字符:', response.data.substring(0, 500));
            
            // 尝试使用xml2js解析XML
            let result;
            try {
                const parser = new xml2js.Parser();
                result = await parser.parseStringPromise(response.data);
            } catch (parseError) {
                console.error('XML解析失败:', parseError);
                throw new Error('解析API返回的XML数据失败');
            }
            
            // 检查result是否包含必要的feed属性
            if (!result || !result.feed) {
                throw new Error('解析后的数据缺少feed属性');
            }
            
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
 * @param {string} model - 翻译模型，默认为THUDM/glm-4-9b-chat
 * @returns {Promise<string>} 翻译后的文本
 */
async function translateText(text, apiKey, model = 'THUDM/glm-4-9b-chat') {
    try {
        if (!text) return '';
        if (!apiKey) throw new Error('缺少API密钥');
        
        // 确保文本不超过模型最大上下文长度
        const maxLength = 12000; // 保守估计，32k的三分之一左右
        const truncatedText = text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
        
        console.log(`使用模型 ${model} 进行翻译，文本长度: ${text.length} 字符`);
        
        const requestData = {
            model: model,
            messages: [
                { role: 'system', content: '你是一个专业的翻译助手，你的任务是将英文文本准确地翻译成中文，保持专业术语的准确性。只返回翻译结果，不要解释或添加任何其他内容。' },
                { role: 'user', content: `将以下文本翻译成中文：\n\n${truncatedText}` }
            ],
            max_tokens: 4000
        };
        
        console.log('发送翻译请求:', JSON.stringify(requestData).substring(0, 200) + '...');
        
        const response = await axios.post('https://api.siliconflow.cn/v1/chat/completions', requestData, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            timeout: 60000 // 增加超时时间到60秒
        });
        
        console.log('翻译API响应状态:', response.status);
        
        if (response.data && response.data.choices && response.data.choices.length > 0) {
            const translatedText = response.data.choices[0].message.content;
            console.log('翻译成功，返回内容长度:', translatedText.length);
            return translatedText;
        }
        
        console.error('API响应格式异常:', JSON.stringify(response.data));
        throw new Error('翻译API返回格式异常');
    } catch (error) {
        console.error('翻译失败:', error.message);
        if (error.response) {
            console.error('API错误状态码:', error.response.status);
            console.error('API错误详情:', JSON.stringify(error.response.data));
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
        console.log('开始保存文件到路径:', filePath);
        console.log('文件内容长度:', content.length);
        
        // 确保目录存在
        const dirPath = path.dirname(filePath);
        if (!fs.existsSync(dirPath)) {
            console.log('目录不存在，尝试创建:', dirPath);
            fs.mkdirSync(dirPath, { recursive: true });
        }
        
        // 写入文件
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('文件保存成功');
        return { success: true, path: filePath };
    } catch (error) {
        console.error('保存文件失败:', error);
        console.error('错误详情:', error.stack);
        return { success: false, error: error.message, path: filePath };
    }
}

/**
 * @description 读取文件内容
 * @param {string} filePath - 文件路径
 * @returns {Object} 包含文件内容的对象
 */
function readFile(filePath) {
    try {
        console.log('开始读取文件:', filePath);
        
        // 检查文件是否存在
        if (!fs.existsSync(filePath)) {
            console.log('文件不存在:', filePath);
            return { success: false, error: '文件不存在', path: filePath };
        }
        
        // 读取文件内容
        const content = fs.readFileSync(filePath, 'utf8');
        console.log('文件读取成功，内容长度:', content.length);
        return { success: true, content, path: filePath };
    } catch (error) {
        console.error('读取文件失败:', error);
        console.error('错误详情:', error.stack);
        return { success: false, error: error.message, path: filePath };
    }
}

// 添加会话历史存储
let chatHistory = [];

/**
 * @description 调用SiliconFlow API进行对话
 * @param {string} message - 用户输入的消息
 * @param {string} apiKey - SiliconFlow API密钥
 * @param {string} model - 选择的模型
 * @returns {Promise<Object>} 返回AI的回复和搜索建议
 */
async function chatWithSiliconFlow(message, apiKey, model) {
    try {
        // 系统提示词，明确指导AI在回复中提供应用内检索建议
        let systemPrompt = `你是一位资深学术导师Awei，专门帮助研究人员梳理研究思路并使用本应用内的论文检索功能。

请先判断用户的问题类型：
1. 判断用户问题是一般性问题还是学术研究问题
2. 如果是一般性问题（例如日常问候、闲聊、非学术咨询等），请正常回答，不需要提供搜索建议
3. 如果是学术研究问题（涉及到论文、研究方向、学术概念、文献检索等），则按以下格式回复

首先，提供专业、准确、简洁的学术分析，基于你的专业知识回答用户的问题

---

提取适合检索的关键词

---

快捷检索选项：在回复的末尾提供2-3个适合在本应用内搜索的关键词，使用【关键词】格式标注，例如【机器学习】【深度学习】

不要建议用户访问外部数据库（如Google Scholar、IEEE Xplore等），因为用户当前已在使用的就是本应用的论文检索系统
你的关键词建议会自动转化为应用内的"快捷检索选项"，用户点击后会直接在应用内搜索

记住，只有学术相关问题才需要提供【】格式的关键词建议。对于一般性问题，请直接回答，不要添加这些格式化的建议。`;

        console.log('调用SiliconFlow API...');
        
        // 构建messages数组，包含历史对话
        const messages = [
            {
                role: "system",
                content: systemPrompt
            }
        ];
        
        // 添加历史对话记录，保留最近的10轮对话
        const recentHistory = chatHistory.slice(-10);
        messages.push(...recentHistory);
        
        // 添加当前用户消息
        messages.push({
            role: "user",
            content: message
        });
        
        // 使用SiliconFlow API 进行对话
        const response = await axios.post('https://api.siliconflow.cn/v1/chat/completions', {
            model: model,
            messages: messages,
            temperature: 0.7,
            max_tokens: 2000
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        const aiReply = response.data.choices[0].message.content;
        console.log('AI回复:', aiReply);
        
        // 将当前对话添加到历史记录
        chatHistory.push({
            role: "user",
            content: message
        });
        
        chatHistory.push({
            role: "assistant",
            content: aiReply
        });
        
        // 限制历史记录长度，最多保存10轮对话(20条消息)
        if (chatHistory.length > 20) {
            chatHistory = chatHistory.slice(-20);
        }
        
        // 提取搜索建议
        const searchSuggestions = extractSearchSuggestions(aiReply, message);
        
        return {
            reply: aiReply,
            searchSuggestions: searchSuggestions
        };
    } catch (error) {
        console.error('调用SiliconFlow API失败:', error);
        throw new Error(`与AI助手通信失败: ${error.message}`);
    }
}

/**
 * @description 从AI回复中提取搜索建议
 * @param {string} reply - AI的回复
 * @param {string} userMessage - 用户的原始消息
 * @returns {Array} 搜索建议数组
 */
function extractSearchSuggestions(reply, userMessage) {
    console.log('开始提取搜索建议，原始回复长度:', reply.length);
    
    // 判断消息类型：是否为学术相关的问题
    // 1. 基于用户消息判断
    const academicKeywords = ['论文', '检索', '关键词', '搜索', '文献', '研究', '学术', '查找', 
                             '期刊', '数据库', '引用', '方法论', '理论', '实验', '数据集', 
                             '算法', '模型', '分析', '综述', 'paper', 'research', 'keyword',
                             'algorithm', 'dataset', 'method', 'study', 'analysis', 'review'];
                             
    // 检查用户消息是否包含学术关键词
    const isAcademicQuery = academicKeywords.some(keyword => 
        userMessage.toLowerCase().includes(keyword.toLowerCase())
    );
    
    // 2. 基于AI回复判断 - 检查回复是否包含【】格式的关键词建议
    // 这是最直接的判断方式，如果AI认为这是学术问题，会添加关键词建议
    const hasSuggestionFormat = /【.+?】/.test(reply);
    
    // 3. 检查回复中是否包含常见的学术回复标记
    const hasAcademicResponseMarkers = 
        reply.includes('研究表明') || 
        reply.includes('学术观点') || 
        reply.includes('文献综述') || 
        reply.includes('研究方向') ||
        reply.includes('实验结果') ||
        reply.includes('理论基础') ||
        /\[\d+\]/.test(reply); // 引用标记 [1], [2] 等
    
    // 综合判断：如果是学术查询 或 回复包含关键词建议格式 或 回复包含学术标记，则提取搜索建议
    if (isAcademicQuery || hasSuggestionFormat || hasAcademicResponseMarkers) {
        console.log('检测到学术相关查询或回复，开始提取搜索建议');
        let suggestions = [];
        
        // 1. 首先尝试提取【】格式的建议（优先级最高）
        const bracketSuggestionRegex = /【(.+?)】/g;
        let match;
        while ((match = bracketSuggestionRegex.exec(reply)) !== null) {
            if (match[1] && match[1].trim()) {
                suggestions.push(match[1].trim());
                console.log('从【】格式提取到关键词:', match[1].trim());
            }
        }
        
        // 2. 如果没有找到【】格式的建议，尝试其他常见格式
        if (suggestions.length === 0) {
            console.log('未找到【】格式的建议，尝试其他格式');
            
            // 2.1 尝试提取"论文搜索建议/关键词建议:"后的内容
            const suggestionLabels = [
                '论文搜索建议', '搜索建议', '建议关键词', '推荐关键词', 
                '检索建议', '关键词推荐', '搜索关键词', '搜索词建议'
            ];
            
            // 构建包含所有可能标签的正则表达式
            const labelPattern = suggestionLabels.join('|');
            const suggestionSectionRegex = new RegExp(`(?:${labelPattern})[：:](.*?)(?=\\n\\n|$)`, 'gs');
            
            while ((match = suggestionSectionRegex.exec(reply)) !== null) {
                // 从这个部分提取关键词
                const keywordSection = match[1].trim();
                console.log('找到建议部分:', keywordSection);
                
                // 按常见分隔符分割
                const keywordList = keywordSection.split(/[,，、；;]/);
                suggestions.push(...keywordList.map(k => k.trim()).filter(k => k.length > 0));
            }
            
            // 2.2 尝试提取引号内的建议，如："xxx"
            if (suggestions.length === 0) {
                const quoteSuggestionRegex = /"([^"]+?)"/g;
                while ((match = quoteSuggestionRegex.exec(reply)) !== null) {
                    // 确保这看起来像搜索关键词而不是引用 (排除太长的字符串或包含句号的字符串)
                    if (match[1].length < 50 && !match[1].includes('。')) {
                        suggestions.push(match[1].trim());
                        console.log('从引号中提取到关键词:', match[1].trim());
                    }
                }
            }
            
            // 2.3 尝试提取包含"关键词"、"搜索词"后面的短语
            if (suggestions.length === 0) {
                const keywordRegex = /(?:关键词|搜索词|检索词|推荐词)[：:]\s*(.+?)(?=\n|$)/g;
                while ((match = keywordRegex.exec(reply)) !== null) {
                    const keywordList = match[1].split(/[,，、；;]/);
                    const keywords = keywordList.map(k => k.trim()).filter(k => k.length > 0 && k.length < 50);
                    suggestions.push(...keywords);
                    console.log('从关键词标记后提取到关键词:', keywords.join(', '));
                }
            }
        }
        
        // 如果上面的方法都没提取到，并且确实是学术问题，尝试从最后一段提取
        if (suggestions.length === 0 && isAcademicQuery) {
            const paragraphs = reply.split('\n\n');
            if (paragraphs.length > 0) {
                const lastParagraph = paragraphs[paragraphs.length - 1].trim();
                // 检查最后一段是否短并且不包含太多标点符号
                if (lastParagraph.length < 100 && 
                    (lastParagraph.match(/[,.;。，、；]/g) || []).length < 5) {
                    // 可能是关键词列表，按分隔符拆分
                    const possibleKeywords = lastParagraph.split(/[,，、；;]/);
                    const keywords = possibleKeywords.map(k => k.trim())
                                      .filter(k => k.length > 0 && k.length < 30);
                    
                    if (keywords.length > 0 && keywords.length <= 5) {
                        suggestions.push(...keywords);
                        console.log('从最后一段提取到可能的关键词:', keywords.join(', '));
                    }
                }
            }
        }
        
        // 去重并限制结果数量
        const uniqueSuggestions = [...new Set(suggestions)];
        const finalSuggestions = uniqueSuggestions
            .filter(s => s.length > 0 && s.length < 50) // 过滤掉太长或空的建议
            .slice(0, 3); // 最多返回3个建议
            
        console.log('最终提取的搜索建议:', finalSuggestions);
        return finalSuggestions;
    }
    
    console.log('非学术相关查询或AI未提供关键词建议，不返回搜索建议');
    return [];
}

/**
 * @description 清除聊天历史记录
 * @returns {boolean} 操作是否成功
 */
function clearChatHistory() {
    try {
        chatHistory = [];
        console.log('聊天历史已清除');
        return true;
    } catch (error) {
        console.error('清除聊天历史失败:', error);
        return false;
    }
}

// 将 Electron API 暴露给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
    // arXiv API 相关
    fetchArxivPapers: async (searchQueries, options) => {
        try {
            console.log('预加载脚本：调用fetchArxivPapers', { searchQueries, options });
            return await fetchArxivPapers(searchQueries, options);
        } catch (error) {
            console.error('预加载脚本：fetchArxivPapers执行失败:', error.message);
            // 返回一个带错误信息的对象，而不是直接抛出错误
            return {
                papers: [],
                totalResults: 0,
                originalApiTotal: 0,
                error: error.message
            };
        }
    },
    
    // 设置相关
    getApiKey: () => ipcRenderer.invoke('get-api-key'),
    saveApiKey: (apiKey) => ipcRenderer.invoke('save-api-key', apiKey),
    saveSettings: (settings) => saveSettings(settings),
    
    // 模型调用相关
    translateText: (text, apiKey, model) => translateText(text, apiKey, model),
    
    // 文件操作相关
    selectDirectory: () => ipcRenderer.invoke('select-directory'),
    saveFile: (filePath, content) => saveFile(filePath, content),
    readFile: (filePath) => readFile(filePath),
    
    // 对话框相关
    showInputBox: (options) => ipcRenderer.invoke('dialog:showInputBox', options),
    
    // 外部链接相关
    openExternal: async (url) => {
        try {
            console.log('预加载脚本：调用openExternal', url);
            return await ipcRenderer.invoke('open-external', url);
        } catch (error) {
            console.error('预加载脚本：openExternal执行失败:', error.message);
            return false;
        }
    },
    
    // 语言相关
    getLanguage: () => ipcRenderer.invoke('get-language'),
    onLanguageChanged: (callback) => ipcRenderer.on('language-changed', (_, language) => callback(language)),
    
    // 聊天相关API
    chatWithAI: async (message, apiKey, model) => {
        try {
            return await chatWithSiliconFlow(message, apiKey, model);
        } catch (error) {
            console.error('AI对话失败:', error);
            throw error;
        }
    },
    
    // 清除聊天历史
    clearChatHistory: () => clearChatHistory(),
    
    // 添加剪贴板操作函数
    copyToClipboard: async (text) => {
        try {
            clipboard.writeText(text);
            return Promise.resolve(true);
        } catch (error) {
            console.error('复制到剪贴板失败:', error);
            return Promise.reject(error);
        }
    },
    /**
     * @description 打开文件所在文件夹并选中文件
     * @param {string} fullPath - 文件完整路径
     */
    showItemInFolder: (fullPath) => shell.showItemInFolder(fullPath),
    runDataAgent: (params) => ipcRenderer.send('data-agent:run', params),
    onDataAgentStatus: (callback) => ipcRenderer.on('data-agent:status', (_, msg) => callback(msg)),
    onDataAgentResult: (callback) => ipcRenderer.on('data-agent:result', (_, msg) => callback(msg)),
    onDataAgentError: (callback) => ipcRenderer.on('data-agent:error', (_, msg) => callback(msg)),
    runDataAgentSummary: (messages, model, apiKey) => ipcRenderer.invoke('data-agent:summary', { messages, model, apiKey }),
    // 新增：移除所有 data-agent 监听器
    removeAllDataAgentListeners: () => {
        ipcRenderer.removeAllListeners('data-agent:result');
        ipcRenderer.removeAllListeners('data-agent:error');
    },
}); 