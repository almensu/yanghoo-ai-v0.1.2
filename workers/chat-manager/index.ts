import fs from 'fs-extra';
import path from 'path';
import { glob } from 'glob';
import dayjs from 'dayjs';
import archiver from 'archiver';
import { createInterface } from 'readline';

// 创建日志记录器
const logger = {
  log: (message: string) => console.log(`[INFO] ${message}`),
  error: (message: string) => console.error(`[ERROR] ${message}`),
  warn: (message: string) => console.warn(`[WARN] ${message}`),
};

// 清单文件接口
interface ManifestFile {
  id: string;
  hashId: string;
  metadata: any;
  fileManifest: FileItem[];
  tasks: Task[];
  createdAt: string;
  updatedAt: string;
  schemaVersion: string;
}

interface FileItem {
  type: string;
  version: number;
  path: string;
  state: 'queued' | 'processing' | 'ready' | 'error' | 'purged';
  generatedBy: string;
  derivedFrom: string[];
  metadata: any;
}

interface Task {
  id: string;
  title: string;
  state: 'queued' | 'running' | 'done' | 'error';
  percent: number;
  relatedOutput?: string;
  startedAt?: string;
  updatedAt?: string;
  error?: string | null;
  context?: any;
}

// 聊天相关接口
interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: MessageContent[] | string;
  timestamp: number;
}

interface MessageContent {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
  };
}

interface ChatHistory {
  chatType: 'text' | 'image';
  sourceFile: string;
  model: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

interface ChatCollectionItem {
  id: string;
  type: 'text' | 'image';
  title: string;
  sourcePath: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ChatCollection {
  version: string;
  chats: ChatCollectionItem[];
  tags: { [tag: string]: string[] };
}

// 聊天搜索选项
interface ChatSearchOptions {
  type?: 'text' | 'image';
  query?: string;
  tags?: string[];
  dateRange?: {
    from?: string;
    to?: string;
  };
}

/**
 * 读取清单文件
 */
async function readManifest(manifestPath: string): Promise<ManifestFile> {
  try {
    return await fs.readJSON(manifestPath);
  } catch (error) {
    logger.error(`无法读取清单文件: ${error}`);
    throw error;
  }
}

/**
 * 保存清单文件
 */
async function saveManifest(manifest: ManifestFile, manifestPath: string): Promise<void> {
  try {
    await fs.writeJSON(manifestPath, manifest, { spaces: 2 });
    logger.log(`清单文件已更新: ${manifestPath}`);
  } catch (error) {
    logger.error(`保存清单文件失败: ${error}`);
    throw error;
  }
}

/**
 * 更新清单中的任务状态
 */
async function updateTaskState(
  manifest: ManifestFile,
  taskId: string,
  state: 'queued' | 'running' | 'done' | 'error',
  updates: Partial<Task> = {}
): Promise<void> {
  const task = manifest.tasks.find(t => t.id === taskId);
  if (!task) {
    logger.error(`找不到任务: ${taskId}`);
    return;
  }

  task.state = state;
  task.updatedAt = new Date().toISOString();
  
  if (state === 'running' && !task.startedAt) {
    task.startedAt = new Date().toISOString();
  }
  
  // 应用其他更新
  Object.assign(task, updates);
}

/**
 * 获取清单文件列表
 */
function getManifestPaths(rootDir: string): string[] {
  try {
    return glob.sync(path.join(rootDir, '**/manifest.json'));
  } catch (error) {
    logger.error(`查找清单文件失败: ${error}`);
    return [];
  }
}

/**
 * 读取聊天历史文件
 */
async function readChatHistory(chatPath: string): Promise<ChatHistory | null> {
  try {
    if (await fs.pathExists(chatPath)) {
      return await fs.readJSON(chatPath);
    }
    return null;
  } catch (error) {
    logger.error(`读取聊天历史失败: ${chatPath}: ${error}`);
    return null;
  }
}

/**
 * 保存聊天历史文件
 */
async function saveChatHistory(chatHistory: ChatHistory, chatPath: string): Promise<boolean> {
  try {
    await fs.ensureDir(path.dirname(chatPath));
    await fs.writeJSON(chatPath, chatHistory, { spaces: 2 });
    logger.log(`保存聊天历史成功: ${chatPath}`);
    return true;
  } catch (error) {
    logger.error(`保存聊天历史失败: ${chatPath}: ${error}`);
    return false;
  }
}

/**
 * 读取聊天集合文件
 */
async function readChatCollection(collectionPath: string): Promise<ChatCollection | null> {
  try {
    if (await fs.pathExists(collectionPath)) {
      return await fs.readJSON(collectionPath);
    }
    
    // 创建默认集合
    return {
      version: '1.0',
      chats: [],
      tags: {}
    };
  } catch (error) {
    logger.error(`读取聊天集合失败: ${collectionPath}: ${error}`);
    return null;
  }
}

/**
 * 保存聊天集合文件
 */
async function saveChatCollection(collection: ChatCollection, collectionPath: string): Promise<boolean> {
  try {
    await fs.ensureDir(path.dirname(collectionPath));
    await fs.writeJSON(collectionPath, collection, { spaces: 2 });
    logger.log(`保存聊天集合成功: ${collectionPath}`);
    return true;
  } catch (error) {
    logger.error(`保存聊天集合失败: ${collectionPath}: ${error}`);
    return false;
  }
}

/**
 * 查找所有聊天历史文件
 */
async function findAllChatFiles(rootDir: string): Promise<{textChats: string[], imageChats: string[]}> {
  try {
    const textChats = glob.sync(path.join(rootDir, '**/chats/text_chat*.json'));
    const imageChats = glob.sync(path.join(rootDir, '**/chats/image_chat*.json'));
    
    return { textChats, imageChats };
  } catch (error) {
    logger.error(`查找聊天历史文件失败: ${error}`);
    return { textChats: [], imageChats: [] };
  }
}

/**
 * 构建聊天集合
 */
async function buildChatCollection(rootDir: string): Promise<ChatCollection> {
  const collection: ChatCollection = {
    version: '1.0',
    chats: [],
    tags: {}
  };
  
  // 查找所有聊天历史文件
  const { textChats, imageChats } = await findAllChatFiles(rootDir);
  
  // 读取并处理文本聊天
  for (const chatPath of textChats) {
    const chatHistory = await readChatHistory(chatPath);
    if (!chatHistory) continue;
    
    const relativePath = path.relative(rootDir, chatPath);
    const chatId = `text-chat-${Date.now()}-${textChats.indexOf(chatPath)}`;
    
    // 计算消息数量
    const messageCount = chatHistory.messages.length;
    
    // 提取或生成标题
    let title = '文本内容分析';
    if (messageCount > 1 && typeof chatHistory.messages[1].content === 'string') {
      const userMessage = chatHistory.messages[1].content.toString();
      title = userMessage.length > 30 ? `${userMessage.substring(0, 30)}...` : userMessage;
    }
    
    // 添加到集合
    collection.chats.push({
      id: chatId,
      type: 'text',
      title,
      sourcePath: relativePath,
      messageCount,
      createdAt: chatHistory.createdAt || new Date().toISOString(),
      updatedAt: chatHistory.updatedAt || new Date().toISOString()
    });
  }
  
  // 读取并处理图像聊天
  for (const chatPath of imageChats) {
    const chatHistory = await readChatHistory(chatPath);
    if (!chatHistory) continue;
    
    const relativePath = path.relative(rootDir, chatPath);
    const chatId = `image-chat-${Date.now()}-${imageChats.indexOf(chatPath)}`;
    
    // 计算消息数量
    const messageCount = chatHistory.messages.length;
    
    // 提取或生成标题
    let title = '图像内容分析';
    
    // 添加到集合
    collection.chats.push({
      id: chatId,
      type: 'image',
      title,
      sourcePath: relativePath,
      messageCount,
      createdAt: chatHistory.createdAt || new Date().toISOString(),
      updatedAt: chatHistory.updatedAt || new Date().toISOString()
    });
  }
  
  return collection;
}

/**
 * 更新聊天集合
 */
async function updateChatCollection(manifestPath: string): Promise<boolean> {
  try {
    const baseDir = path.dirname(manifestPath);
    const collectionDir = path.join(baseDir, 'chats');
    const collectionPath = path.join(collectionDir, 'collection.json');
    
    // 创建聊天集合目录
    await fs.ensureDir(collectionDir);
    
    // 读取现有集合或创建新集合
    let collection = await readChatCollection(collectionPath) || {
      version: '1.0',
      chats: [],
      tags: {}
    };
    
    // 更新集合内容
    const { textChats, imageChats } = await findAllChatFiles(baseDir);
    const allChats = [...textChats, ...imageChats];
    
    // 移除不存在的聊天
    collection.chats = collection.chats.filter(chat => {
      const chatPath = path.join(baseDir, chat.sourcePath);
      return fs.existsSync(chatPath);
    });
    
    // 添加新的聊天
    for (const chatPath of allChats) {
      const relativePath = path.relative(baseDir, chatPath);
      
      // 检查是否已存在
      const existingChat = collection.chats.find(c => c.sourcePath === relativePath);
      if (existingChat) continue;
      
      const chatHistory = await readChatHistory(chatPath);
      if (!chatHistory) continue;
      
      const isTextChat = chatPath.includes('text_chat');
      const chatId = `${isTextChat ? 'text' : 'image'}-chat-${Date.now()}-${allChats.indexOf(chatPath)}`;
      
      // 计算消息数量
      const messageCount = chatHistory.messages.length;
      
      // 提取或生成标题
      let title = isTextChat ? '文本内容分析' : '图像内容分析';
      if (isTextChat && messageCount > 1 && typeof chatHistory.messages[1].content === 'string') {
        const userMessage = chatHistory.messages[1].content.toString();
        title = userMessage.length > 30 ? `${userMessage.substring(0, 30)}...` : userMessage;
      }
      
      // 添加到集合
      collection.chats.push({
        id: chatId,
        type: isTextChat ? 'text' : 'image',
        title,
        sourcePath: relativePath,
        messageCount,
        createdAt: chatHistory.createdAt || new Date().toISOString(),
        updatedAt: chatHistory.updatedAt || new Date().toISOString()
      });
    }
    
    // 更新标签 - 保留现有标签
    
    // 保存集合
    await saveChatCollection(collection, collectionPath);
    
    // 更新manifest
    const manifest = await readManifest(manifestPath);
    
    // 查找现有的chat_collection_json条目或创建新条目
    let collectionItem = manifest.fileManifest.find(f => f.type === 'chat_collection_json');
    
    if (!collectionItem) {
      // 创建新条目
      collectionItem = {
        type: 'chat_collection_json',
        version: 1,
        path: path.relative(baseDir, collectionPath),
        state: 'ready',
        generatedBy: 'chat-manager@1.0.0',
        derivedFrom: [],
        metadata: {
          chatCount: collection.chats.length,
          lastUpdated: new Date().toISOString()
        }
      };
      
      manifest.fileManifest.push(collectionItem);
    } else {
      // 更新现有条目
      collectionItem.version += 1;
      collectionItem.state = 'ready';
      collectionItem.metadata = {
        ...collectionItem.metadata,
        chatCount: collection.chats.length,
        lastUpdated: new Date().toISOString()
      };
    }
    
    // 更新任务状态
    let manageChatsTask = manifest.tasks.find(t => t.id === 'manage_chats');
    
    if (!manageChatsTask) {
      manageChatsTask = {
        id: 'manage_chats',
        title: '管理AI对话',
        state: 'done',
        percent: 100,
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        relatedOutput: collectionItem.path
      };
      
      manifest.tasks.push(manageChatsTask);
    } else {
      manageChatsTask.state = 'done';
      manageChatsTask.percent = 100;
      manageChatsTask.updatedAt = new Date().toISOString();
      manageChatsTask.relatedOutput = collectionItem.path;
    }
    
    // 保存manifest
    await saveManifest(manifest, manifestPath);
    
    return true;
  } catch (error) {
    logger.error(`更新聊天集合失败: ${error}`);
    return false;
  }
}

/**
 * 搜索聊天
 */
async function searchChats(collection: ChatCollection, options: ChatSearchOptions = {}): Promise<ChatCollectionItem[]> {
  try {
    let results = [...collection.chats];
    
    // 按类型筛选
    if (options.type) {
      results = results.filter(chat => chat.type === options.type);
    }
    
    // 按标签筛选
    if (options.tags && options.tags.length > 0) {
      const taggedChatIds: string[] = [];
      
      // 收集所有匹配标签的聊天ID
      for (const tag of options.tags) {
        const chatIds = collection.tags[tag] || [];
        taggedChatIds.push(...chatIds);
      }
      
      // 筛选包含任一标签的聊天
      results = results.filter(chat => taggedChatIds.includes(chat.id));
    }
    
    // 按日期范围筛选
    if (options.dateRange) {
      if (options.dateRange.from) {
        const fromDate = dayjs(options.dateRange.from);
        results = results.filter(chat => dayjs(chat.updatedAt).isAfter(fromDate) || dayjs(chat.updatedAt).isSame(fromDate));
      }
      
      if (options.dateRange.to) {
        const toDate = dayjs(options.dateRange.to);
        results = results.filter(chat => dayjs(chat.updatedAt).isBefore(toDate) || dayjs(chat.updatedAt).isSame(toDate));
      }
    }
    
    // 按查询内容搜索
    if (options.query) {
      // 这里需要加载聊天历史并搜索内容
      // 但这可能会很耗时，暂时只搜索标题
      const query = options.query.toLowerCase();
      results = results.filter(chat => chat.title.toLowerCase().includes(query));
    }
    
    return results;
  } catch (error) {
    logger.error(`搜索聊天失败: ${error}`);
    return [];
  }
}

/**
 * 导出聊天历史
 */
async function exportChat(baseDir: string, chatItem: ChatCollectionItem, outputPath: string): Promise<boolean> {
  try {
    const chatPath = path.join(baseDir, chatItem.sourcePath);
    
    // 读取聊天历史
    const chatHistory = await readChatHistory(chatPath);
    if (!chatHistory) {
      logger.error(`无法读取聊天历史: ${chatPath}`);
      return false;
    }
    
    // 如果是图像聊天，需要处理图像
    if (chatItem.type === 'image') {
      // 这里可以处理图像，如果需要的话
      // 例如，将base64图像转换为文件并打包
    }
    
    // 导出为JSON文件
    await fs.writeJSON(outputPath, chatHistory, { spaces: 2 });
    logger.log(`导出聊天历史成功: ${outputPath}`);
    
    return true;
  } catch (error) {
    logger.error(`导出聊天历史失败: ${error}`);
    return false;
  }
}

/**
 * 导出所有聊天历史为ZIP
 */
async function exportAllChats(baseDir: string, collection: ChatCollection, outputPath: string): Promise<boolean> {
  try {
    // 创建ZIP文件
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    // 设置事件
    output.on('close', () => {
      logger.log(`导出完成: ${outputPath} (${archive.pointer()} bytes)`);
    });
    
    archive.on('error', (err) => {
      throw err;
    });
    
    // 添加聊天集合文件
    archive.pipe(output);
    archive.append(JSON.stringify(collection, null, 2), { name: 'collection.json' });
    
    // 添加所有聊天历史文件
    for (const chat of collection.chats) {
      const chatPath = path.join(baseDir, chat.sourcePath);
      
      if (await fs.pathExists(chatPath)) {
        archive.file(chatPath, { name: `chats/${path.basename(chat.sourcePath)}` });
      }
    }
    
    // 完成归档
    await archive.finalize();
    
    return true;
  } catch (error) {
    logger.error(`导出所有聊天历史失败: ${error}`);
    return false;
  }
}

/**
 * 导入聊天历史
 */
async function importChat(chatPath: string, targetDir: string, collection: ChatCollection): Promise<boolean> {
  try {
    // 读取聊天历史
    const chatHistory = await readChatHistory(chatPath);
    if (!chatHistory) {
      logger.error(`无法读取聊天历史: ${chatPath}`);
      return false;
    }
    
    // 创建目标目录
    const chatDir = path.join(targetDir, 'chats');
    await fs.ensureDir(chatDir);
    
    // 生成文件名
    const chatType = chatHistory.chatType || 'text';
    const fileName = `${chatType}_chat_${Date.now()}.json`;
    const targetPath = path.join(chatDir, fileName);
    
    // 保存聊天历史
    await saveChatHistory(chatHistory, targetPath);
    
    // 更新聊天集合
    const relativePath = path.relative(targetDir, targetPath);
    const chatId = `${chatType}-chat-${Date.now()}`;
    
    // 计算消息数量
    const messageCount = chatHistory.messages.length;
    
    // 提取或生成标题
    let title = chatType === 'text' ? '文本内容分析' : '图像内容分析';
    if (chatType === 'text' && messageCount > 1 && typeof chatHistory.messages[1].content === 'string') {
      const userMessage = chatHistory.messages[1].content.toString();
      title = userMessage.length > 30 ? `${userMessage.substring(0, 30)}...` : userMessage;
    }
    
    // 添加到集合
    collection.chats.push({
      id: chatId,
      type: chatType === 'text' ? 'text' : 'image',
      title,
      sourcePath: relativePath,
      messageCount,
      createdAt: chatHistory.createdAt || new Date().toISOString(),
      updatedAt: chatHistory.updatedAt || new Date().toISOString()
    });
    
    return true;
  } catch (error) {
    logger.error(`导入聊天历史失败: ${error}`);
    return false;
  }
}

/**
 * 为聊天添加标签
 */
async function addTagToChat(collection: ChatCollection, chatId: string, tag: string): Promise<boolean> {
  try {
    // 检查聊天是否存在
    const chat = collection.chats.find(c => c.id === chatId);
    if (!chat) {
      logger.error(`聊天不存在: ${chatId}`);
      return false;
    }
    
    // 初始化标签数组（如果不存在）
    if (!collection.tags[tag]) {
      collection.tags[tag] = [];
    }
    
    // 添加标签（如果尚未添加）
    if (!collection.tags[tag].includes(chatId)) {
      collection.tags[tag].push(chatId);
    }
    
    return true;
  } catch (error) {
    logger.error(`添加标签失败: ${error}`);
    return false;
  }
}

/**
 * 从聊天中移除标签
 */
async function removeTagFromChat(collection: ChatCollection, chatId: string, tag: string): Promise<boolean> {
  try {
    // 检查标签是否存在
    if (!collection.tags[tag]) {
      return true; // 标签不存在，视为成功
    }
    
    // 移除标签
    collection.tags[tag] = collection.tags[tag].filter(id => id !== chatId);
    
    // 如果标签数组为空，删除标签
    if (collection.tags[tag].length === 0) {
      delete collection.tags[tag];
    }
    
    return true;
  } catch (error) {
    logger.error(`移除标签失败: ${error}`);
    return false;
  }
}

/**
 * 创建交互式命令行
 */
function createCLI() {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const rootDir = path.resolve('storage/content-studio');
  
  console.log('\nAI对话管理工具 v1.0.0');
  console.log('====================\n');
  
  async function showMenu() {
    console.log('\n选择操作:');
    console.log('1. 更新所有聊天集合');
    console.log('2. 查看聊天列表');
    console.log('3. 搜索聊天');
    console.log('4. 导出聊天');
    console.log('5. 导入聊天');
    console.log('6. 管理标签');
    console.log('0. 退出');
    
    rl.question('\n请选择: ', async (answer) => {
      switch (answer) {
        case '1':
          try {
            console.log('\n正在更新所有聊天集合...');
            const manifestPaths = getManifestPaths(rootDir);
            
            if (manifestPaths.length === 0) {
              console.log('\n没有找到manifest文件。');
              showMenu();
              return;
            }
            
            let successCount = 0;
            for (const manifestPath of manifestPaths) {
              const success = await updateChatCollection(manifestPath);
              if (success) successCount++;
            }
            
            console.log(`\n更新完成: 成功 ${successCount}/${manifestPaths.length}`);
          } catch (error) {
            console.error(`\n出错: ${error}`);
          }
          
          showMenu();
          break;
          
        case '2':
          try {
            console.log('\n请选择内容:');
            const manifestPaths = getManifestPaths(rootDir);
            
            if (manifestPaths.length === 0) {
              console.log('\n没有找到manifest文件。');
              showMenu();
              return;
            }
            
            manifestPaths.forEach((p, i) => {
              const dirName = path.basename(path.dirname(p));
              console.log(`${i + 1}. ${dirName}`);
            });
            
            rl.question('\n请选择(输入编号): ', async (num) => {
              const index = parseInt(num) - 1;
              if (isNaN(index) || index < 0 || index >= manifestPaths.length) {
                console.log('\n无效的选择。');
                showMenu();
                return;
              }
              
              const manifestPath = manifestPaths[index];
              const baseDir = path.dirname(manifestPath);
              const collectionPath = path.join(baseDir, 'chats', 'collection.json');
              
              // 读取聊天集合
              const collection = await readChatCollection(collectionPath);
              
              if (!collection || collection.chats.length === 0) {
                console.log('\n没有找到聊天历史。');
                showMenu();
                return;
              }
              
              console.log(`\n找到 ${collection.chats.length} 个聊天:`);
              
              collection.chats.forEach((chat, i) => {
                console.log(`\n${i + 1}. ${chat.title}`);
                console.log(`   类型: ${chat.type === 'text' ? '文本' : '图像'}`);
                console.log(`   消息数: ${chat.messageCount}`);
                console.log(`   更新时间: ${new Date(chat.updatedAt).toLocaleString()}`);
                
                // 显示标签
                const chatTags = Object.entries(collection.tags)
                  .filter(([tag, ids]) => ids.includes(chat.id))
                  .map(([tag]) => tag);
                
                if (chatTags.length > 0) {
                  console.log(`   标签: ${chatTags.join(', ')}`);
                }
              });
            });
          } catch (error) {
            console.error(`\n出错: ${error}`);
          }
          
          showMenu();
          break;
          
        default:
          console.log('\n功能暂未实现或无效的选项。');
          showMenu();
          break;
      }
    });
  }
  
  showMenu();
}

/**
 * 处理单个manifest
 */
async function processManifest(manifestPath: string): Promise<void> {
  try {
    logger.log(`处理manifest: ${manifestPath}`);
    
    // 更新聊天集合
    const success = await updateChatCollection(manifestPath);
    
    if (success) {
      logger.log('聊天集合更新成功');
    } else {
      logger.error('聊天集合更新失败');
    }
  } catch (error) {
    logger.error(`处理manifest失败: ${error}`);
  }
}

/**
 * 处理所有manifest
 */
async function processAllManifests(rootDir: string): Promise<void> {
  try {
    const manifestPaths = getManifestPaths(rootDir);
    
    if (manifestPaths.length === 0) {
      logger.warn('没有找到manifest文件');
      return;
    }
    
    logger.log(`找到 ${manifestPaths.length} 个manifest文件`);
    
    for (const manifestPath of manifestPaths) {
      await processManifest(manifestPath);
    }
    
    logger.log('所有manifest处理完成');
  } catch (error) {
    logger.error(`处理所有manifest失败: ${error}`);
  }
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // 交互式模式
    createCLI();
    return;
  }
  
  const command = args[0];
  const rootDir = args[1] || path.resolve('storage/content-studio');
  
  switch (command) {
    case 'update-all':
      await processAllManifests(rootDir);
      break;
      
    case 'update':
      if (args.length < 2) {
        logger.error('缺少manifest路径参数');
        console.log('用法: node index.js update <manifest.json路径>');
        break;
      }
      
      await processManifest(args[1]);
      break;
      
    case 'export':
      if (args.length < 3) {
        logger.error('缺少必要参数');
        console.log('用法: node index.js export <manifest.json路径> <输出路径>');
        break;
      }
      
      try {
        const manifestPath = args[1];
        const outputPath = args[2];
        const baseDir = path.dirname(manifestPath);
        const collectionPath = path.join(baseDir, 'chats', 'collection.json');
        
        // 读取聊天集合
        const collection = await readChatCollection(collectionPath);
        
        if (!collection) {
          logger.error('读取聊天集合失败');
          break;
        }
        
        // 导出所有聊天
        const success = await exportAllChats(baseDir, collection, outputPath);
        
        if (success) {
          logger.log(`导出成功: ${outputPath}`);
        } else {
          logger.error('导出失败');
        }
      } catch (error) {
        logger.error(`导出失败: ${error}`);
      }
      break;
      
    case 'import':
      if (args.length < 3) {
        logger.error('缺少必要参数');
        console.log('用法: node index.js import <聊天文件路径> <目标manifest路径>');
        break;
      }
      
      try {
        const chatPath = args[1];
        const manifestPath = args[2];
        const baseDir = path.dirname(manifestPath);
        const collectionPath = path.join(baseDir, 'chats', 'collection.json');
        
        // 读取聊天集合
        let collection = await readChatCollection(collectionPath);
        
        if (!collection) {
          collection = {
            version: '1.0',
            chats: [],
            tags: {}
          };
        }
        
        // 导入聊天
        const success = await importChat(chatPath, baseDir, collection);
        
        if (success) {
          // 保存聊天集合
          await saveChatCollection(collection, collectionPath);
          
          // 更新manifest
          await updateChatCollection(manifestPath);
          
          logger.log(`导入成功: ${chatPath}`);
        } else {
          logger.error('导入失败');
        }
      } catch (error) {
        logger.error(`导入失败: ${error}`);
      }
      break;
      
    default:
      console.log('未知命令。可用命令: update-all, update, export, import');
      break;
  }
}

// 执行主函数
if (require.main === module) {
  main().catch(err => {
    logger.error(`执行出错: ${err}`);
    process.exit(1);
  });
}

// 导出API
export {
  updateChatCollection,
  searchChats,
  exportChat,
  exportAllChats,
  importChat,
  addTagToChat,
  removeTagFromChat
}; 