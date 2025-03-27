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
 * @description 分析用户问题是否需要联网搜索
 * @param {string} question - 用户问题
 * @returns {boolean} 是否需要联网
 */
function needsWebSearch(question) {
    const webSearchKeywords = [
        '最新', '最近', '新闻', '进展', '发展', '趋势', '现状',
        '比较', '区别', '优缺点', '评测', '评价', '如何选择',
        '市场', '价格', '排名', '推荐', '热门', '怎么样', 
        '联网', '搜索', '查询', '查找', '寻找'
    ];
    
    return webSearchKeywords.some(keyword => question.includes(keyword));
}

/**
 * @description 进行网络搜索
 * @param {string} query - 搜索查询
 * @returns {Promise<string>} 搜索结果
 */
async function webSearch(query) {
    try {
        console.log('执行网络搜索:', query);
        
        // 首先尝试使用必应搜索API
        try {
            const response = await axios.get(`https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}`, {
                headers: {
                    'Ocp-Apim-Subscription-Key': process.env.BING_API_KEY || 'YOUR_BING_API_KEY'
                }
            });
            
            // 如果没有结果，返回提示信息
            if (!response.data.webPages || !response.data.webPages.value || response.data.webPages.value.length === 0) {
                return '未找到相关搜索结果';
            }
            
            // 提取搜索结果
            const results = response.data.webPages.value.slice(0, 5).map(result => {
                return `标题: ${result.name}\n摘要: ${result.snippet}\n链接: ${result.url}\n`;
            });
            
            return results.join('\n');
        } catch (bingError) {
            console.error('必应搜索API失败:', bingError);
            // 继续尝试其他方法
        }
        
        // 备选方案1: 使用维基百科API
        try {
            const wikiResponse = await axios.get(`https://zh.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`, {
                headers: {
                    'User-Agent': 'ElectronPaperApp/1.0.0'
                }
            });
            
            if (wikiResponse.data && wikiResponse.data.query && wikiResponse.data.query.search && wikiResponse.data.query.search.length > 0) {
                const wikiResults = wikiResponse.data.query.search.slice(0, 3).map(result => {
                    // 移除HTML标签
                    const snippet = result.snippet.replace(/<\/?[^>]+(>|$)/g, "");
                    return `标题: ${result.title}\n摘要: ${snippet}\n链接: https://zh.wikipedia.org/wiki/${encodeURIComponent(result.title)}\n`;
                });
                
                return `维基百科搜索结果:\n\n${wikiResults.join('\n')}`;
            }
        } catch (wikiError) {
            console.error('维基百科API失败:', wikiError);
        }
        
        // 备选方案2: 使用自定义搜索服务 (例如谷歌自定义搜索)
        try {
            const googleResponse = await axios.get(`https://customsearch.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_API_KEY || 'YOUR_GOOGLE_API_KEY'}&cx=${process.env.GOOGLE_CX || 'YOUR_GOOGLE_CX'}&q=${encodeURIComponent(query)}`, {
                headers: {
                    'User-Agent': 'ElectronPaperApp/1.0.0'
                }
            });
            
            if (googleResponse.data && googleResponse.data.items && googleResponse.data.items.length > 0) {
                const googleResults = googleResponse.data.items.slice(0, 3).map(item => {
                    return `标题: ${item.title}\n摘要: ${item.snippet}\n链接: ${item.link}\n`;
                });
                
                return `搜索结果:\n\n${googleResults.join('\n')}`;
            }
        } catch (googleError) {
            console.error('谷歌自定义搜索API失败:', googleError);
        }
        
        // 备选方案3: 直接获取特定网站内容 (无需浏览器)
        try {
            // 获取知乎搜索页面
            const zhihuResponse = await axios.get(`https://www.zhihu.com/api/v4/search_v3?t=general&q=${encodeURIComponent(query)}&correction=1&offset=0&limit=5&lc_idx=0&show_all_topics=0`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });
            
            if (zhihuResponse.data && zhihuResponse.data.data && zhihuResponse.data.data.length > 0) {
                const zhihuResults = zhihuResponse.data.data.slice(0, 3).map(item => {
                    const title = item.highlight?.title || item.object?.title || '无标题';
                    const excerpt = item.highlight?.description || item.object?.excerpt || '无摘要';
                    const url = item.object?.url || `https://www.zhihu.com/question/${item.object?.id}`;
                    
                    return `标题: ${title}\n摘要: ${excerpt}\n链接: ${url}\n`;
                });
                
                return `知乎相关内容:\n\n${zhihuResults.join('\n')}`;
            }
        } catch (zhihuError) {
            console.error('知乎API调用失败:', zhihuError);
        }
        
        // 最终备选: 仅提供一个简单的搜索建议
        return `无法获取在线搜索结果，建议您使用以下关键词手动搜索:\n\n1. ${query}\n2. ${query} 资料\n3. ${query} 最新信息`;
        
    } catch (error) {
        console.error('网络搜索综合失败:', error);
        return '搜索过程中出现错误，请稍后再试。';
    }
}

/**
 * @description 使用puppeteer爬取网页内容 (仅在必要时使用)
 * @param {string} url - 要爬取的网页URL
 * @returns {Promise<string>} 返回网页内容
 */
async function crawlWebContent(url) {
    try {
        // 首先尝试直接用axios获取内容 (无需浏览器)
        try {
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                },
                timeout: 10000
            });
            
            // 如果能直接获取HTML，解析简单内容
            if (response.data && typeof response.data === 'string') {
                const text = response.data
                    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
                    .replace(/<[^>]+>/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();
                
                // 提取有用的部分 (前2000字符已足够)
                return text.substring(0, 2000);
            }
        } catch (axiosError) {
            console.warn('无法直接获取网页内容，尝试使用浏览器:', axiosError.message);
        }
        
        // 只有在绝对必要时才使用puppeteer
        const puppeteer = require('puppeteer-core');
        
        // 尝试使用本地已安装的Chrome
        const browserPaths = {
            win32: [
                'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
                `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
                `${process.env.ProgramFiles}\\Microsoft\\Edge\\Application\\msedge.exe`,
                `${process.env.LOCALAPPDATA}\\Microsoft\\Edge\\Application\\msedge.exe`
            ]
        };
        
        const possiblePaths = browserPaths[process.platform] || [];
        let executablePath = null;
        
        for (const path of possiblePaths) {
            if (fs.existsSync(path)) {
                executablePath = path;
                break;
            }
        }
        
        if (!executablePath) {
            console.error('无法找到本地安装的Chrome或Edge浏览器');
            return '无法访问网页内容，请确保你的系统安装了Chrome或Edge浏览器';
        }
        
        // 启动浏览器
        const browser = await puppeteer.launch({
            headless: true,
            executablePath,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        // 创建新页面
        const page = await browser.newPage();
        
        // 设置用户代理
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        
        // 访问URL
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
        
        // 提取页面内容
        const content = await page.evaluate(() => {
            // 获取搜索结果列表（针对Bing搜索结果的选择器，可能需要根据实际网页结构调整）
            const results = Array.from(document.querySelectorAll('.b_algo, .g'));
            
            if (results.length > 0) {
                // 提取每个结果的标题、摘要和链接
                return results.slice(0, 5).map(result => {
                    const titleElement = result.querySelector('h2 a, h3 a');
                    const title = titleElement ? titleElement.textContent.trim() : '';
                    const url = titleElement ? titleElement.getAttribute('href') : '';
                    const snippet = result.querySelector('.b_caption p, .VwiC3b') ? 
                        result.querySelector('.b_caption p, .VwiC3b').textContent.trim() : '';
                    
                    return `标题: ${title}\n摘要: ${snippet}\n链接: ${url}\n`;
                }).join('\n');
            } else {
                // 如果找不到搜索结果，获取页面全部文本
                return document.body.innerText.substring(0, 2000);
            }
        });
        
        // 关闭浏览器
        await browser.close();
        
        return content || '未找到相关搜索结果';
    } catch (error) {
        console.error('网页爬取失败:', error);
        return '无法获取网页内容，请确保已安装Chrome或Edge浏览器';
    }
}

/**
 * @description 调用SiliconFlow API进行对话
 * @param {string} message - 用户输入的消息
 * @param {string} apiKey - SiliconFlow API密钥
 * @param {string} model - 选择的模型
 * @returns {Promise<Object>} 返回AI的回复和搜索建议
 */
async function chatWithSiliconFlow(message, apiKey, model) {
    try {
        // 判断是否需要联网搜索
        const requiresWebSearch = needsWebSearch(message);
        let systemPrompt = `你是一位资深学术导师，专门帮助研究人员进行文献检索和学术研究。你的回答应该专业、准确，并且富有洞察力。
请注意以下要求：
1. 如果用户询问有关论文检索或关键词的问题，请提供3个具体的搜索建议，格式为：【搜索建议1】、【搜索建议2】、【搜索建议3】
2. 回答要简洁明了，避免冗长
3. 如果需要列出步骤或方法，请使用序号标注`;
        
        let userMessage = message;
        
        // 如果需要联网搜索，添加网络搜索结果
        if (requiresWebSearch) {
            console.log('检测到需要联网搜索的问题');
            try {
                const webResults = await webSearch(message);
                systemPrompt += `\n此外，用户的问题需要最新信息，我提供了以下搜索结果供你参考。请基于这些结果给出准确的回答。`;
                userMessage = `${message}\n\n以下是相关的网络搜索结果：\n${webResults}`;
            } catch (searchError) {
                console.error('联网搜索失败:', searchError);
                // 如果搜索失败，仍然继续处理，但不添加搜索结果
            }
        }
        
        console.log('调用SiliconFlow API...');
        
        // 使用SiliconFlow API 进行对话
        const response = await axios.post('https://api.siliconflow.cn/v1/chat/completions', {
            model: model,
            messages: [
                {
                    role: "system",
                    content: systemPrompt
                },
                {
                    role: "user",
                    content: userMessage
                }
            ],
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
        
        // 处理搜索建议
        let searchSuggestions = [];
        if (message.includes('论文') || message.includes('检索') || message.includes('关键词') || message.includes('搜索')) {
            // 从回复中提取搜索建议
            const suggestionRegex = /【(.+?)】/g;
            let match;
            while ((match = suggestionRegex.exec(aiReply)) !== null) {
                searchSuggestions.push(match[1]);
            }
            
            // 如果没有找到搜索建议但是应该有，则尝试生成
            if (searchSuggestions.length === 0) {
                // 再次请求API生成搜索建议
                try {
                    const suggestResponse = await axios.post('https://api.siliconflow.cn/v1/chat/completions', {
                        model: model,
                        messages: [
                            {
                                role: "system",
                                content: "你是一位学术助手，请针对用户的问题提供3个简洁的论文搜索关键词组合，格式为【关键词1】【关键词2】【关键词3】，不要有其他格式和解释"
                            },
                            {
                                role: "user",
                                content: message
                            }
                        ],
                        temperature: 0.7,
                        max_tokens: 100
                    }, {
                        headers: {
                            'Authorization': `Bearer ${apiKey}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    const suggestText = suggestResponse.data.choices[0].message.content;
                    const extraSuggestions = suggestText.match(/【(.+?)】/g);
                    if (extraSuggestions) {
                        searchSuggestions = extraSuggestions.map(s => s.replace(/【|】/g, ''));
                    }
                } catch (suggestError) {
                    console.error('获取额外搜索建议失败:', suggestError);
                }
            }
        }
        
        return {
            reply: aiReply,
            searchSuggestions: searchSuggestions
        };
    } catch (error) {
        console.error('调用SiliconFlow API失败:', error);
        throw new Error(`与AI助手通信失败: ${error.message}`);
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
    
    // 添加剪贴板操作函数
    copyToClipboard: async (text) => {
        try {
            clipboard.writeText(text);
            return Promise.resolve(true);
        } catch (error) {
            console.error('复制到剪贴板失败:', error);
            return Promise.reject(error);
        }
    }
}); 