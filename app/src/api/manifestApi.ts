import axios from 'axios';

// API基础URL
const API_BASE_URL = 'http://localhost:3001/api';

// 任务类型定义
export interface Task {
  id: string;
  title: string;
  state: 'queued' | 'running' | 'done' | 'error';
  createdAt: string;
  updatedAt: string;
  error?: string;
  progress?: number;
  percent?: number;
  relatedOutput?: string[];
  context?: Record<string, any>;
}

// 文件类型定义
export interface FileItem {
  id: string;
  type: string;
  state: 'queued' | 'processing' | 'ready' | 'error' | 'purged';
  path: string;
  createdAt: string;
  updatedAt: string;
  derivedFrom?: string;
  version?: number;
  metadata?: Record<string, any>;
}

// Manifest数据结构
export interface Manifest {
  schemaVersion: string;
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  url?: string;
  tasks: Task[];
  fileManifest: Record<string, FileItem>;
  metadata: {
    topics?: string[];
    [key: string]: any;
  };
}

// 获取Manifest
export const fetchManifest = async (hashId: string): Promise<Manifest> => {
  try {
    // 在实际环境中应该从API获取
    // const response = await axios.get(`${API_BASE_URL}/manifest/${hashId}`);
    // return response.data;
    
    // 临时返回模拟数据
    return {
      schemaVersion: "0.3.5",
      id: hashId,
      title: "示例内容",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tasks: [],
      fileManifest: {},
      metadata: {
        topics: ["示例", "测试"]
      }
    };
  } catch (error) {
    console.error("获取Manifest失败:", error);
    throw error;
  }
};

// 获取文件内容
export const getFileContent = async (hashId: string, fileId: string): Promise<string> => {
  try {
    // const response = await axios.get(`${API_BASE_URL}/${hashId}/file/${fileId}`);
    // return response.data;
    
    // 临时返回模拟数据
    return "示例文件内容";
  } catch (error) {
    console.error("获取文件内容失败:", error);
    throw error;
  }
};

// 任务选项
export interface TaskOptions {
  title: string;
  state?: 'queued' | 'running' | 'done' | 'error';
  percent?: number;
  relatedOutput?: string | string[];
  context?: Record<string, any>;
  [key: string]: any;
}

// 添加任务
export const addTask = async (hashId: string, taskTypeOrOptions: string | TaskOptions): Promise<string> => {
  try {
    // 处理两种不同的调用方式
    const options = typeof taskTypeOrOptions === 'string' 
      ? { type: taskTypeOrOptions } 
      : taskTypeOrOptions;

    // const response = await axios.post(`${API_BASE_URL}/${hashId}/task`, options);
    // return response.data.taskId;
    
    // 临时返回模拟数据
    return "task_" + Math.random().toString(36).substring(2, 9);
  } catch (error) {
    console.error("添加任务失败:", error);
    throw error;
  }
};

// 获取任务状态
export const getTaskStatus = async (hashId: string, taskId: string): Promise<any> => {
  try {
    // const response = await axios.get(`${API_BASE_URL}/${hashId}/task/${taskId}`);
    // return response.data;
    
    // 临时返回模拟数据
    return {
      id: taskId,
      state: Math.random() > 0.5 ? "running" : "done",
      progress: Math.floor(Math.random() * 100),
      percent: Math.floor(Math.random() * 100)
    };
  } catch (error) {
    console.error("获取任务状态失败:", error);
    throw error;
  }
};

// 创建文章
export const createArticle = async (hashId: string, title: string, content: string): Promise<string> => {
  try {
    // const response = await axios.post(`${API_BASE_URL}/${hashId}/article`, { title, content });
    // return response.data.articleId;
    
    // 临时返回模拟数据
    return "article_" + Math.random().toString(36).substring(2, 9);
  } catch (error) {
    console.error("创建文章失败:", error);
    throw error;
  }
};

// 更新文章
export const updateArticle = async (hashId: string, articleId: string, title: string, content: string): Promise<void> => {
  try {
    // await axios.put(`${API_BASE_URL}/${hashId}/article/${articleId}`, { title, content });
    console.log("文章已更新", articleId);
  } catch (error) {
    console.error("更新文章失败:", error);
    throw error;
  }
};

// 获取单篇文章
export const getArticle = async (hashId: string, articleId: string): Promise<any> => {
  try {
    // const response = await axios.get(`${API_BASE_URL}/${hashId}/article/${articleId}`);
    // return response.data;
    
    // 临时返回模拟数据
    return {
      id: articleId,
      title: "示例文章",
      content: "# 示例文章内容\n\n这是一篇示例文章。",
      createdAt: new Date().toISOString()
    };
  } catch (error) {
    console.error("获取文章失败:", error);
    throw error;
  }
};

// 获取所有文章
export const getArticles = async (hashId: string): Promise<any[]> => {
  try {
    // const response = await axios.get(`${API_BASE_URL}/${hashId}/articles`);
    // return response.data;
    
    // 临时返回模拟数据
    return [
      {
        id: "article1",
        title: "示例文章1",
        createdAt: new Date().toISOString()
      },
      {
        id: "article2",
        title: "示例文章2",
        createdAt: new Date().toISOString()
      }
    ];
  } catch (error) {
    console.error("获取所有文章失败:", error);
    throw error;
  }
};

// 删除文章
export const deleteArticle = async (hashId: string, articleId: string): Promise<boolean> => {
  try {
    // await axios.delete(`${API_BASE_URL}/${hashId}/article/${articleId}`);
    console.log("文章已删除", articleId);
    return true;
  } catch (error) {
    console.error("删除文章失败:", error);
    return false;
  }
}; 