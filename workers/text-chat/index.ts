import * as fs from 'fs';
import * as path from 'path';
import { OpenAI } from 'openai';
import { Manifest, FileItemSchema, TaskSchema, FILE_TYPES, TASK_IDS } from '../../src/types/manifest';

// Configure OpenAI client with DeepSeek API
const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com'
});

// Message interface for chat history
interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: string;
}

// Text chat history interface
interface TextChatHistory {
  messages: Message[];
  model: string;
  title: string;
  templates: {
    [key: string]: {
      title: string;
      prompt: string;
    }
  };
}

async function main() {
  try {
    if (process.argv.length < 3) {
      console.error('Usage: ts-node index.ts <content-path>');
      process.exit(1);
    }

    const contentPath = process.argv[2];
    const manifestPath = path.join(contentPath, 'manifest.json');
    
    // Read and parse manifest
    const manifest: Manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    
    // Find the text content file
    const textContentFile = manifest.fileManifest.find(
      file => file.type === FILE_TYPES.TEXT_CONTENT_MD && file.state === 'ready'
    );
    
    if (!textContentFile) {
      throw new Error('No ready text_content_md file found in manifest');
    }
    
    console.log(JSON.stringify({ percent: 10 }));
    
    // Read the text content
    const textContent = fs.readFileSync(path.join(contentPath, textContentFile.path), 'utf-8');
    
    // Get content title from the manifest metadata or info.json
    let contentTitle = 'Untitled Content';
    
    // Try to get title from info.json if available
    const infoJsonFile = manifest.fileManifest.find(
      file => file.type === FILE_TYPES.INFO_JSON && file.state === 'ready'
    );
    
    if (infoJsonFile) {
      try {
        const infoJson = JSON.parse(fs.readFileSync(path.join(contentPath, infoJsonFile.path), 'utf-8'));
        contentTitle = infoJson.title || contentTitle;
      } catch (error) {
        console.error('Error reading info.json:', error);
      }
    }
    
    console.log(JSON.stringify({ percent: 30 }));
    
    // Create chat templates
    const chatTemplates = createChatTemplates(textContent);
    
    console.log(JSON.stringify({ percent: 50 }));
    
    // Initialize chat history
    const chatHistory = initializeTextChat(contentTitle, chatTemplates);
    
    // Ensure chats directory exists
    const chatsDir = path.join(contentPath, 'chats');
    fs.mkdirSync(chatsDir, { recursive: true });
    
    // Save chat history
    const chatHistoryPath = path.join(chatsDir, 'text_chat.json');
    fs.writeFileSync(chatHistoryPath, JSON.stringify(chatHistory, null, 2));
    
    console.log(JSON.stringify({ percent: 80 }));
    
    // Update manifest with new file
    updateManifest(manifest, chatHistoryPath, textContentFile.path, contentPath);
    
    console.log(JSON.stringify({ percent: 100 }));
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

function createChatTemplates(textContent: string): { [key: string]: { title: string; prompt: string } } {
  // Create template for common Q&A patterns
  return {
    'summarize': {
      title: 'Summarize the content',
      prompt: 'Please summarize the main points of this content.'
    },
    'explain': {
      title: 'Explain a concept',
      prompt: 'Please explain the following concept from the content: [CONCEPT]'
    },
    'analyze': {
      title: 'Analyze the arguments',
      prompt: 'Please analyze the main arguments presented in this content. What are the strengths and weaknesses?'
    },
    'compare': {
      title: 'Compare with other sources',
      prompt: 'How does this content compare to other perspectives on the same topic?'
    },
    'extract_key_quotes': {
      title: 'Extract key quotes',
      prompt: 'Please extract 3-5 key quotes from this content that best represent its main ideas.'
    },
    'simple_explanation': {
      title: 'Explain like I\'m five',
      prompt: 'Please explain the main ideas of this content in simple terms, as if explaining to a child.'
    },
    'practical_applications': {
      title: 'Practical applications',
      prompt: 'What are some practical applications or implications of the ideas discussed in this content?'
    }
  };
}

function initializeTextChat(contentTitle: string, templates: any): TextChatHistory {
  const now = new Date().toISOString();
  
  // Create system message that provides context about the content
  const systemMessage: Message = {
    role: 'system',
    content: `You are an AI assistant helping with questions about "${contentTitle}". The user has access to the full transcript, and you can discuss any aspect of the content. You can provide summaries, explanations, analyses, and other insights about the material.`,
    timestamp: now
  };
  
  // Create welcome message from the assistant
  const welcomeMessage: Message = {
    role: 'assistant',
    content: `I'm ready to discuss "${contentTitle}" with you. You can ask me to summarize key points, explain concepts, analyze arguments, or any other questions about the content. How can I help you today?`,
    timestamp: now
  };
  
  // Initialize chat history
  return {
    messages: [systemMessage, welcomeMessage],
    model: 'deepseek-chat',
    title: `Chat about: ${contentTitle}`,
    templates: templates
  };
}

function updateManifest(
  manifest: Manifest, 
  chatHistoryPath: string, 
  textContentPath: string,
  contentPath: string
) {
  const now = new Date().toISOString();
  const relativeChatHistoryPath = path.relative(contentPath, chatHistoryPath);
  
  // Add chat history to file manifest
  const chatHistoryFile = FileItemSchema.parse({
    type: FILE_TYPES.TEXT_CHAT_HISTORY_JSON,
    version: 1,
    path: relativeChatHistoryPath,
    state: 'ready',
    generatedBy: 'text-chat@0.1.0',
    derivedFrom: [textContentPath],
    metadata: {
      type: 'text_chat_history_json',
      model: 'deepseek-chat',
      messageCount: 2, // Initial system prompt and welcome message
      lastUpdated: now
    }
  });
  
  // Update task status
  let initializeTextChatTask = manifest.tasks.find(task => task.id === TASK_IDS.INITIALIZE_TEXT_CHAT);
  
  if (initializeTextChatTask) {
    // Update existing task
    initializeTextChatTask.state = 'done';
    initializeTextChatTask.percent = 100;
    initializeTextChatTask.updatedAt = now;
    initializeTextChatTask.relatedOutput = relativeChatHistoryPath;
  } else {
    // Create new task
    initializeTextChatTask = TaskSchema.parse({
      id: TASK_IDS.INITIALIZE_TEXT_CHAT,
      title: 'Initialize Text Chat',
      state: 'done',
      percent: 100,
      relatedOutput: relativeChatHistoryPath,
      startedAt: now,
      updatedAt: now,
      error: null,
      context: {
        model: 'deepseek-chat'
      }
    });
    manifest.tasks.push(initializeTextChatTask);
  }
  
  // Find and replace existing file or add new one
  const chatHistoryIndex = manifest.fileManifest.findIndex(file => file.type === FILE_TYPES.TEXT_CHAT_HISTORY_JSON);
  if (chatHistoryIndex >= 0) {
    manifest.fileManifest[chatHistoryIndex] = chatHistoryFile;
  } else {
    manifest.fileManifest.push(chatHistoryFile);
  }
  
  // Update manifest timestamp
  manifest.updatedAt = now;
  
  // Write updated manifest back to file
  fs.writeFileSync(path.join(contentPath, 'manifest.json'), JSON.stringify(manifest, null, 2));
}

// Function to export chat history to Markdown
function exportToMarkdown(chatHistory: TextChatHistory): string {
  let markdown = `# ${chatHistory.title}\n\n`;
  
  for (const message of chatHistory.messages) {
    // Skip system messages
    if (message.role === 'system') continue;
    
    const roleHeader = message.role === 'user' ? '## User' : '## Assistant';
    markdown += `${roleHeader}\n\n${message.content}\n\n`;
    
    // Add timestamp
    const date = new Date(message.timestamp);
    markdown += `*${date.toLocaleString()}*\n\n`;
  }
  
  return markdown;
}

// Call the main function
main().catch(console.error); 