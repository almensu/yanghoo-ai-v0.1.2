import fs from 'fs-extra';
import path from 'path';
import { OpenAI } from 'openai';
import { ManifestFile, Task } from '../../types/manifest';

// 创建日志记录器
const logger = {
  info: (message: string) => console.log(`[INFO] ${message}`),
  error: (message: string) => console.error(`[ERROR] ${message}`),
};

// 获取DeepSeek API密钥
const apiKey = process.env.DEEPSEEK_API_KEY;
if (!apiKey) {
  logger.error('DEEPSEEK_API_KEY 环境变量未设置');
  process.exit(1);
}

// 初始化OpenAI客户端 (使用DeepSeek API)
const openai = new OpenAI({
  apiKey,
  baseURL: 'https://api.deepseek.com/v1',
});

// 聊天历史接口定义
interface ChatHistory {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
  derivedFrom: {
    task: string;
    source: string;
  };
  messages: ChatMessage[];
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: MessageContent[];
  timestamp: number;
}

interface MessageContent {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
  };
}

// 图像转base64函数
async function imageToBase64(imagePath: string): Promise<string> {
  try {
    const imageBuffer = await fs.readFile(imagePath);
    return `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
  } catch (error) {
    logger.error(`无法读取图像文件 ${imagePath}: ${error}`);
    throw error;
  }
}

// 系统提示词
const systemPrompt = `你是一位专业的视频分析助手，擅长分析视频截图并提供有价值的见解。
请根据提供的截图，分析以下内容：
1. 截图场景描述：画面中看到了什么
2. 对象识别：识别画面中的主要对象、人物、文本等
3. 视频类型推测：根据截图推测可能的视频类型和内容
4. 有价值信息提取：从截图中提取可能对用户有用的信息

请用中文回答，语言自然流畅，简明扼要地提供分析结果。`;

/**
 * 初始化图像AI对话
 * @param manifestPath 清单文件路径
 */
export async function initializeImageChat(manifestPath: string): Promise<void> {
  try {
    // 读取manifest文件
    const manifest: ManifestFile = await fs.readJSON(manifestPath);
    const workDir = path.dirname(manifestPath);
    
    // 查找initialize_image_chat任务
    const initTask = manifest.tasks.find(t => t.name === 'initialize_image_chat');
    if (!initTask) {
      logger.error('找不到initialize_image_chat任务');
      return;
    }
    
    // 更新任务状态为进行中
    initTask.state = 'processing';
    await fs.writeJSON(manifestPath, manifest, { spaces: 2 });
    
    // 查找screenshot任务
    const screenshotTask = manifest.tasks.find(t => t.name === 'screenshot_image');
    if (!screenshotTask || !screenshotTask.output || !screenshotTask.output.screenshots) {
      logger.error('找不到screenshot_image任务或其输出');
      return;
    }
    
    // 获取截图文件路径
    const screenshotFiles = screenshotTask.output.screenshots.map((screenshot: string) => 
      path.join(workDir, screenshot)
    );
    
    if (screenshotFiles.length === 0) {
      logger.error('没有找到截图文件');
      return;
    }
    
    logger.info(`找到 ${screenshotFiles.length} 个截图文件`);
    
    // 创建聊天历史目录
    const chatDir = path.join(workDir, 'chats');
    await fs.ensureDir(chatDir);
    
    const chatHistoryPath = path.join(chatDir, 'image_chat.json');
    
    // 转换图像为base64
    const imageBase64Promises = screenshotFiles.map(async (file) => {
      try {
        return await imageToBase64(file);
      } catch (error) {
        logger.error(`处理图像 ${file} 时出错: ${error}`);
        return null;
      }
    });
    
    const imageBase64List = (await Promise.all(imageBase64Promises)).filter(Boolean);
    
    if (imageBase64List.length === 0) {
      logger.error('所有图像处理失败');
      return;
    }
    
    // 创建用户提示
    const userPrompt = `我有 ${imageBase64List.length} 张视频截图，请帮我分析这些截图的内容。`;
    
    // 构建消息内容
    const messageContents: MessageContent[] = [
      { type: 'text', text: userPrompt }
    ];
    
    // 添加图像内容
    for (const imageBase64 of imageBase64List) {
      messageContents.push({
        type: 'image_url',
        image_url: {
          url: imageBase64 as string
        }
      });
    }
    
    // 创建系统消息和用户消息
    const systemMessage: ChatMessage = {
      role: 'system',
      content: [{ type: 'text', text: systemPrompt }],
      timestamp: Date.now()
    };
    
    const userMessage: ChatMessage = {
      role: 'user',
      content: messageContents,
      timestamp: Date.now()
    };
    
    // 调用DeepSeek API
    logger.info('正在调用DeepSeek API进行图像分析...');
    
    try {
      const response = await openai.chat.completions.create({
        model: 'deepseek-vision',
        messages: [
          { role: 'system', content: systemPrompt },
          { 
            role: 'user', 
            content: messageContents
          }
        ],
        max_tokens: 1000
      });
      
      // 获取AI回复
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: [{ 
          type: 'text', 
          text: response.choices[0]?.message?.content || '无法获取分析结果'
        }],
        timestamp: Date.now()
      };
      
      // 创建聊天历史
      const chatHistory: ChatHistory = {
        id: `image-chat-${Date.now()}`,
        name: '视频截图分析',
        created_at: Date.now(),
        updated_at: Date.now(),
        derivedFrom: {
          task: 'screenshot_image',
          source: screenshotTask.output.screenshots[0] || ''
        },
        messages: [systemMessage, userMessage, assistantMessage]
      };
      
      // 保存聊天历史
      await fs.writeJSON(chatHistoryPath, chatHistory, { spaces: 2 });
      logger.info(`聊天历史已保存至 ${chatHistoryPath}`);
      
      // 更新任务状态为完成
      if (initTask && initTask.output) {
        initTask.output.chat_history = 'chats/image_chat.json';
      } else if (initTask) {
        initTask.output = { chat_history: 'chats/image_chat.json' };
      }
      
      initTask.state = 'done';
      await fs.writeJSON(manifestPath, manifest, { spaces: 2 });
      
      logger.info('图像AI对话初始化完成');
    } catch (error) {
      logger.error(`调用DeepSeek API时出错: ${error}`);
      
      // 更新任务状态为失败
      initTask.state = 'failed';
      await fs.writeJSON(manifestPath, manifest, { spaces: 2 });
    }
  } catch (error) {
    logger.error(`初始化图像AI对话时出错: ${error}`);
  }
}

// 如果直接运行此脚本，执行初始化
if (require.main === module) {
  const manifestPath = process.argv[2];
  if (!manifestPath) {
    logger.error('请提供manifest文件路径');
    process.exit(1);
  }
  
  initializeImageChat(manifestPath)
    .then(() => {
      logger.info('图像AI对话初始化脚本执行完毕');
    })
    .catch((error) => {
      logger.error(`执行过程中出错: ${error}`);
      process.exit(1);
    });
} 