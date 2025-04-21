import axios from 'axios';

// API基础URL
const API_BASE_URL = 'http://localhost:3001/api';

// 视频片段定义
export interface VideoSegment {
  id: string;
  startTime: number; // 秒
  endTime: number; // 秒
  label: string;
  notes?: string;
  
  // 兼容组件使用的属性名
  start?: number; // 等同于startTime
  end?: number; // 等同于endTime
  description?: string; // 等同于notes
}

// 视频编辑配置
export interface VideoEditConfig {
  segments: VideoSegment[];
  outputFormat: 'mp4' | 'webm' | 'gif';
  quality: 'high' | 'medium' | 'low';
  includeAudio: boolean;
  outputType?: string; // 添加outputType属性
}

// 创建视频编辑任务
export const createVideoEditTask = async (
  hashId: string,
  config: VideoEditConfig
): Promise<string> => {
  try {
    // 实际环境中应该调用API
    // const response = await axios.post(`${API_BASE_URL}/${hashId}/video-edit`, config);
    // return response.data.taskId;
    
    // 临时返回模拟数据
    return "video_edit_" + Math.random().toString(36).substring(2, 9);
  } catch (error) {
    console.error("创建视频编辑任务失败:", error);
    throw error;
  }
};

// 获取视频编辑任务状态
export const getVideoEditTaskStatus = async (
  hashId: string,
  taskId: string
): Promise<any> => {
  try {
    // const response = await axios.get(`${API_BASE_URL}/${hashId}/video-edit/${taskId}`);
    // return response.data;
    
    // 临时返回模拟数据
    return {
      id: taskId,
      state: Math.random() > 0.5 ? "running" : "done",
      progress: Math.floor(Math.random() * 100)
    };
  } catch (error) {
    console.error("获取视频编辑任务状态失败:", error);
    throw error;
  }
};

// 获取视频信息（例如时长、分辨率等）
export const getVideoInfo = async (hashId: string): Promise<any> => {
  try {
    // const response = await axios.get(`${API_BASE_URL}/${hashId}/video-info`);
    // return response.data;
    
    // 临时返回模拟数据
    return {
      duration: 120, // 秒
      width: 1280,
      height: 720,
      fps: 30,
      codec: "h264"
    };
  } catch (error) {
    console.error("获取视频信息失败:", error);
    throw error;
  }
}; 