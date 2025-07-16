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

/**
 * 将数据对象数组转换为CSV格式字符串
 * @param {Array<Object>} data - 数据对象数组
 * @returns {string} CSV格式字符串
 */
function convertToCSV(data) {
    if (!Array.isArray(data) || data.length === 0) {
        return '';
    }
    
    // 获取所有列名
    const columns = Object.keys(data[0]);
    
    // 创建CSV标题行
    const header = columns.join(',');
    
    // 创建数据行
    const rows = data.map(obj => {
        return columns.map(col => {
            // 处理特殊字符，如逗号、引号等
            const value = obj[col];
            const valueStr = value === null || value === undefined ? '' : String(value);
            
            // 如果值包含逗号、引号或换行符，则用引号包裹并处理内部引号
            if (valueStr.includes(',') || valueStr.includes('"') || valueStr.includes('\n')) {
                return `"${valueStr.replace(/"/g, '""')}"`;
            }
            return valueStr;
        }).join(',');
    });
    
    // 合并标题和数据行
    return [header, ...rows].join('\n');
}

/**
 * 解析CSV格式字符串为数据对象数组
 * @param {string} csvString - CSV格式字符串
 * @returns {Array<Object>} 数据对象数组
 */
function parseCSV(csvString) {
    if (!csvString || typeof csvString !== 'string') {
        return [];
    }
    
    // 分割行
    const lines = csvString.split(/\r?\n/);
    if (lines.length < 2) return [];
    
    // 第一行是标题
    const headers = parseCSVLine(lines[0]);
    
    // 解析数据行
    const result = [];
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue; // 跳过空行
        
        const values = parseCSVLine(lines[i]);
        if (values.length !== headers.length) {
            console.warn(`CSV行 ${i+1} 的列数与标题不匹配，跳过`);
            continue;
        }
        
        // 创建对象
        const obj = {};
        headers.forEach((header, index) => {
            // 尝试转换数字
            const value = values[index];
            if (value === '') {
                obj[header] = null;
            } else if (!isNaN(value) && value.trim() !== '') {
                obj[header] = Number(value);
            } else {
                obj[header] = value;
            }
        });
        
        result.push(obj);
    }
    
    return result;
}

/**
 * 解析CSV行，处理引号、逗号等特殊情况
 * @param {string} line - CSV行
 * @returns {Array<string>} 字段值数组
 */
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            // 检查是否是转义的引号 ""
            if (i + 1 < line.length && line[i + 1] === '"') {
                current += '"';
                i++; // 跳过下一个引号
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            // 遇到逗号且不在引号内，添加当前值并重置
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    
    // 添加最后一个值
    result.push(current);
    
    return result;
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

// 读取项目数据文件
async function readProjectDataFile(projectPath) {
  try {
    const fs = require('fs');
    const path = require('path');
    
    // 检查data目录是否存在
    const dataDir = path.join(projectPath, 'data');
    if (!fs.existsSync(dataDir)) {
      console.log('项目中未找到data目录');
      return { success: false, error: '项目中未找到data目录' };
    }
    
    // 查找data目录中的CSV或Excel文件
    const files = fs.readdirSync(dataDir);
    const dataFile = files.find(file => 
      file.endsWith('.csv') || file.endsWith('.xlsx') || file.endsWith('.xls')
    );
    
    if (!dataFile) {
      console.log('data目录中未找到数据文件');
      return { success: false, error: 'data目录中未找到数据文件' };
    }
    
    console.log('找到数据文件:', dataFile);
    const fullPath = path.join(dataDir, dataFile);
    
    // 读取文件内容，使用UTF-8编码
    let fileContent;
    if (dataFile.endsWith('.csv')) {
      // 对于CSV文件，使用UTF-8编码读取
      fileContent = fs.readFileSync(fullPath, { encoding: 'utf-8' });
      
      // 检测BOM头并移除
      if (fileContent.charCodeAt(0) === 0xFEFF) {
        fileContent = fileContent.slice(1);
      }
      
      // 转换回Buffer以保持与Excel文件处理一致的接口
      fileContent = Buffer.from(fileContent);
    } else {
      // Excel文件直接读取二进制内容
      fileContent = fs.readFileSync(fullPath);
    }
    
    return {
      success: true,
      fileName: dataFile,
      content: fileContent,
      path: fullPath,
      isCSV: dataFile.endsWith('.csv')
    };
  } catch (error) {
    console.error('读取项目数据文件失败:', error);
    return { success: false, error: error.message };
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
    
    // 新增：导出可视化项目
    exportVisualProject: async (options) => {
        try {
            const { path: exportPath, name, format, data } = options;
            if (!exportPath || !name || !data) {
                return { success: false, error: '缺少必要参数' };
            }
            
            // 创建项目文件夹
            const projectDir = format === 'folder' 
                ? `${exportPath}/${name}`
                : `${exportPath}/${name}_temp`;
                
            try {
                // 确保目录存在
                if (!fs.existsSync(projectDir)) {
                    fs.mkdirSync(projectDir, { recursive: true });
                }
                
                // 创建images目录存放所有图片
                const imagesDir = path.join(projectDir, 'images');
                if (!fs.existsSync(imagesDir)) {
                    fs.mkdirSync(imagesDir, { recursive: true });
                }
                
                // 创建data目录存放所有数据文件
                const dataDir = path.join(projectDir, 'data');
                if (!fs.existsSync(dataDir)) {
                    fs.mkdirSync(dataDir, { recursive: true });
                }
            } catch (err) {
                console.error('创建项目目录失败:', err);
                return { success: false, error: '创建项目目录失败: ' + err.message };
            }
            
            // 保存项目索引文件前处理图片
            if (data.canvasState && Array.isArray(data.canvasState)) {
                console.log('处理导出画布状态中的图片，共', data.canvasState.length, '个项目');
                
                for (const shape of data.canvasState) {
                    if (shape.type === 'image') {
                        // 处理主图片路径
                        if (shape.src) {
                            try {
                                // 获取图片文件名
                                let srcPath = '';
                                let fileName = '';
                                
                                // 处理不同格式的路径
                                if (shape.src.startsWith('file://')) {
                                    // 移除file://前缀
                                    srcPath = shape.src.replace(/^file:\/\/\/?/i, '');
                                    fileName = path.basename(srcPath);
                                } else if (shape.src.startsWith('/') || shape.src.match(/^[A-Z]:\\/i)) {
                                    // 绝对路径
                                    srcPath = shape.src;
                                    fileName = path.basename(srcPath);
                                } else {
                                    // 相对路径，可能是example_png下的文件
                                    fileName = path.basename(shape.src);
                                    
                                    // 尝试从多个可能的位置查找源文件
                                    const possiblePaths = [
                                        shape.src, // 原始相对路径
                                        path.join(process.cwd(), shape.src), // 相对于当前工作目录
                                        path.join(process.cwd(), 'example_png', fileName) // 在example_png目录下查找
                                    ];
                                    
                                    // 查找第一个存在的文件路径
                                    for (const p of possiblePaths) {
                                        if (fs.existsSync(p)) {
                                            srcPath = p;
                                            break;
                                        }
                                    }
                                }
                                
                                // 目标路径始终在images目录下
                                const destPath = path.join(projectDir, 'images', fileName);
                                
                                // 如果找到了源文件，复制到images目录
                                if (srcPath && fs.existsSync(srcPath)) {
                                    fs.copyFileSync(srcPath, destPath);
                                    console.log(`已复制图片: ${srcPath} -> ${destPath}`);
                                    
                                    // 更新路径为相对路径
                                    shape.src = `images/${fileName}`;
                                    console.log(`已更新图片路径: ${shape.src}`);
                                } else {
                                    console.warn(`源图片文件不存在，无法复制: ${srcPath || shape.src}`);
                                }
                            } catch (err) {
                                console.error('处理图片文件失败:', err);
                                // 继续处理其他图片，不中断流程
                            }
                        }
                        
                        // 处理plot_json中的png_path
                        if (shape.plot_json && shape.plot_json.png_path) {
                            try {
                                // 获取图片文件名
                                let srcPath = '';
                                let fileName = '';
                                
                                const pngPath = shape.plot_json.png_path;
                                
                                // 处理不同格式的路径
                                if (pngPath.startsWith('file://')) {
                                    // 移除file://前缀
                                    srcPath = pngPath.replace(/^file:\/\/\/?/i, '');
                                    fileName = path.basename(srcPath);
                                } else if (pngPath.startsWith('/') || pngPath.match(/^[A-Z]:\\/i)) {
                                    // 绝对路径
                                    srcPath = pngPath;
                                    fileName = path.basename(srcPath);
                                } else {
                                    // 相对路径，可能是example_png下的文件
                                    fileName = path.basename(pngPath);
                                    
                                    // 尝试从多个可能的位置查找源文件
                                    const possiblePaths = [
                                        pngPath, // 原始相对路径
                                        path.join(process.cwd(), pngPath), // 相对于当前工作目录
                                        path.join(process.cwd(), 'example_png', fileName) // 在example_png目录下查找
                                    ];
                                    
                                    // 查找第一个存在的文件路径
                                    for (const p of possiblePaths) {
                                        if (fs.existsSync(p)) {
                                            srcPath = p;
                                            break;
                                        }
                                    }
                                }
                                
                                // 目标路径始终在images目录下
                                const destPath = path.join(projectDir, 'images', fileName);
                                
                                // 如果找到了源文件，复制到images目录
                                if (srcPath && fs.existsSync(srcPath)) {
                                    fs.copyFileSync(srcPath, destPath);
                                    console.log(`已复制PNG: ${srcPath} -> ${destPath}`);
                                    
                                    // 更新路径为相对路径
                                    shape.plot_json.png_path = `images/${fileName}`;
                                    console.log(`已更新PNG路径: ${shape.plot_json.png_path}`);
                                } else {
                                    console.warn(`源PNG文件不存在，无法复制: ${srcPath || pngPath}`);
                                }
                            } catch (err) {
                                console.error('处理plot_json中的PNG文件失败:', err);
                                // 继续处理其他图片，不中断流程
                            }
                        }
                    }
                }
            }
            
            // 处理上传的数据文件
            if (data.uploadedData) {
                try {
                    console.log('处理上传的数据文件');
                    
                    // 如果有原始数据文件路径
                    if (data.uploadedData.filePath) {
                        const srcPath = data.uploadedData.filePath;
                        const fileName = path.basename(srcPath);
                        const destPath = path.join(projectDir, 'data', fileName);
                        
                        // 如果源文件存在，复制到data目录
                        if (fs.existsSync(srcPath)) {
                            fs.copyFileSync(srcPath, destPath);
                            console.log(`已复制数据文件: ${srcPath} -> ${destPath}`);
                            
                            // 更新路径为相对路径
                            data.uploadedData.filePath = `data/${fileName}`;
                        } else {
                            console.warn(`源数据文件不存在: ${srcPath}`);
                            
                            // 如果源文件不存在，尝试将数据内容保存为CSV
                            if (data.uploadedData.data && Array.isArray(data.uploadedData.data)) {
                                // 生成默认文件名
                                const defaultFileName = `data_${Date.now()}.csv`;
                                const defaultPath = path.join(projectDir, 'data', defaultFileName);
                                
                                // 将数据转换为CSV格式
                                const csvContent = convertToCSV(data.uploadedData.data);
                                fs.writeFileSync(defaultPath, csvContent, 'utf8');
                                console.log(`已生成数据文件: ${defaultPath}`);
                                
                                // 更新路径为相对路径
                                data.uploadedData.filePath = `data/${defaultFileName}`;
                            }
                        }
                    } else if (data.uploadedData.data && Array.isArray(data.uploadedData.data)) {
                        // 如果没有原始文件路径但有数据内容，生成CSV文件
                        const defaultFileName = `data_${Date.now()}.csv`;
                        const defaultPath = path.join(projectDir, 'data', defaultFileName);
                        
                        // 将数据转换为CSV格式
                        const csvContent = convertToCSV(data.uploadedData.data);
                        fs.writeFileSync(defaultPath, csvContent, 'utf8');
                        console.log(`已生成数据文件: ${defaultPath}`);
                        
                        // 更新路径为相对路径
                        data.uploadedData.filePath = `data/${defaultFileName}`;
                    }
                } catch (err) {
                    console.error('处理数据文件失败:', err);
                    // 继续流程，不中断
                }
            }
            
            // 保存项目索引文件
            const indexPath = path.join(projectDir, 'project.json');
            try {
                fs.writeFileSync(indexPath, JSON.stringify(data, null, 2), 'utf8');
            } catch (err) {
                console.error('保存项目索引文件失败:', err);
                return { success: false, error: '保存项目索引文件失败: ' + err.message };
            }
            
            // 如果是ZIP格式，打包为ZIP文件
            if (format === 'zip') {
                try {
                    // 调用系统命令打包为ZIP
                    const zipPath = `${exportPath}/${name}.zip`;
                    await ipcRenderer.invoke('zip-directory', projectDir, zipPath);
                    
                    // 删除临时文件夹
                    fs.rmdirSync(projectDir, { recursive: true });
                    
                    return { success: true, path: zipPath };
                } catch (err) {
                    console.error('创建ZIP文件失败:', err);
                    return { success: false, error: '创建ZIP文件失败: ' + err.message };
                }
            }
            
            return { success: true, path: projectDir };
        } catch (error) {
            console.error('导出可视化项目失败:', error);
            return { success: false, error: error.message };
        }
    },
    
    // 新增：导入可视化项目
    importVisualProject: async (projectPath) => {
        try {
            if (!projectPath) {
                return { success: false, error: '项目路径不能为空' };
            }
            
            // 检查项目文件夹是否存在
            if (!fs.existsSync(projectPath)) {
                return { success: false, error: '项目文件夹不存在' };
            }
            
            // 检查project.json文件是否存在
            const indexPath = path.join(projectPath, 'project.json');
            if (!fs.existsSync(indexPath)) {
                return { success: false, error: '项目索引文件不存在' };
            }
            
            // 读取项目索引文件
            let projectData;
            try {
                const indexContent = fs.readFileSync(indexPath, 'utf8');
                projectData = JSON.parse(indexContent);
            } catch (err) {
                console.error('读取项目索引文件失败:', err);
                return { success: false, error: '读取项目索引文件失败: ' + err.message };
            }
            
            // 检查images目录是否存在
            const imagesDir = path.join(projectPath, 'images');
            const hasImagesDir = fs.existsSync(imagesDir);
            
            // 检查data目录是否存在
            const dataDir = path.join(projectPath, 'data');
            const hasDataDir = fs.existsSync(dataDir);
            
            console.log('项目路径:', projectPath);
            console.log('images目录是否存在:', hasImagesDir);
            console.log('data目录是否存在:', hasDataDir);
            
            // 处理项目中的图片路径
            if (projectData.canvasState && Array.isArray(projectData.canvasState)) {
                console.log('处理画布状态中的图片路径，共', projectData.canvasState.length, '个项目');
                
                for (const shape of projectData.canvasState) {
                    if (shape.type === 'image') {
                        // 处理主图片路径
                        if (shape.src) {
                            try {
                                console.log('处理图片路径:', shape.src);
                                
                                // 如果是相对路径，检查文件是否存在
                                if (!shape.src.startsWith('file://') && 
                                    !shape.src.startsWith('http://') && 
                                    !shape.src.startsWith('https://') && 
                                    !shape.src.startsWith('/') && 
                                    !shape.src.match(/^[A-Z]:\\/i)) {
                                    
                                    // 构建完整路径（使用正斜杠统一路径格式）
                                    const normalizedPath = projectPath.replace(/\\/g, '/');
                                    shape.src = `file:///${normalizedPath}/${shape.src}`;
                                    console.log('修复图片路径:', shape.src);
                                }
                            } catch (err) {
                                console.error('处理图片路径失败:', err, shape);
                            }
                        }
                        
                        // 处理plot_json中的png_path
                        if (shape.plot_json && shape.plot_json.png_path) {
                            try {
                                const pngPath = shape.plot_json.png_path;
                                console.log('处理plot_json中的png路径:', pngPath);
                                
                                // 如果是相对路径，检查文件是否存在
                                if (!pngPath.startsWith('file://') && 
                                    !pngPath.startsWith('http://') && 
                                    !pngPath.startsWith('https://') && 
                                    !pngPath.startsWith('/') && 
                                    !pngPath.match(/^[A-Z]:\\/i)) {
                                    
                                    // 构建完整路径（使用正斜杠统一路径格式）
                                    const normalizedPath = projectPath.replace(/\\/g, '/');
                                    shape.plot_json.png_path = `file:///${normalizedPath}/${pngPath}`;
                                    console.log('修复plot_json中的png_path:', shape.plot_json.png_path);
                                }
                            } catch (err) {
                                console.error('处理plot_json中的png路径失败:', err);
                            }
                        }
                    }
                }
            }
            
            // 处理上传的数据文件
            if (projectData.uploadedData) {
                try {
                    console.log('处理上传的数据文件');
                    
                    // 如果有数据文件路径
                    if (projectData.uploadedData.filePath) {
                        const filePath = projectData.uploadedData.filePath;
                        console.log('数据文件路径:', filePath);
                        
                        // 如果是相对路径，构建完整路径
                        if (!filePath.startsWith('file://') && 
                            !filePath.startsWith('http://') && 
                            !filePath.startsWith('https://') && 
                            !filePath.startsWith('/') && 
                            !filePath.match(/^[A-Z]:\\/i)) {
                            
                            // 构建完整路径
                            const fullPath = path.join(projectPath, filePath);
                            console.log('完整数据文件路径:', fullPath);
                            
                            // 检查文件是否存在
                            if (fs.existsSync(fullPath)) {
                                console.log('数据文件存在，尝试加载数据');
                                
                                // 读取CSV文件
                                const content = fs.readFileSync(fullPath, 'utf8');
                                
                                // 解析CSV数据
                                const parsedData = parseCSV(content);
                                if (parsedData && parsedData.length > 0) {
                                    projectData.uploadedData.data = parsedData;
                                    console.log('成功加载数据，行数:', parsedData.length);
                                }
                            } else {
                                console.warn('数据文件不存在:', fullPath);
                            }
                        }
                    }
                } catch (err) {
                    console.error('处理数据文件失败:', err);
                    // 继续流程，不中断
                }
            }
            
            return { success: true, data: projectData };
        } catch (error) {
            console.error('导入可视化项目失败:', error);
            return { success: false, error: error.message };
        }
    },
    
    // 获取系统设置
    getSettings: async () => {
        try {
            const configPath = path.join(app.getPath('userData'), 'config.json');
            if (fs.existsSync(configPath)) {
                const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                return configData;
            }
            return {};
        } catch (error) {
            console.error('获取系统设置失败:', error);
            return {};
        }
    },

    // 读取项目数据文件
    readProjectDataFile: async (projectPath) => {
        return await readProjectDataFile(projectPath);
    }
}); 