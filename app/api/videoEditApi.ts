import { addTask } from './manifestApi';

// 片段类型
export interface VideoSegment {
  start: number;      // 开始时间（秒）
  end: number;        // 结束时间（秒）
  label?: string;     // 片段标签（选填）
  description?: string; // 片段描述（选填）
}

// 编辑器配置
export interface VideoEditConfig {
  segments: VideoSegment[];
  outputType: 'video' | 'timeline'; // 输出类型：生成视频或时间轴引用
  outputQuality?: string;          // 输出视频质量（如有）
  outputFormat?: string;           // 输出格式 (默认 mp4)
  keepOriginalAudio?: boolean;     // 是否保留原始音频
}

/**
 * 创建视频编辑任务
 */
export const createVideoEditTask = async (
  hashId: string, 
  config: VideoEditConfig
): Promise<string | null> => {
  try {
    // 添加任务
    const taskId = await addTask(hashId, {
      title: config.outputType === 'video' ? '提取视频片段' : '生成时间轴引用',
      state: 'queued',
      percent: 0,
      relatedOutput: config.outputType === 'video' ? 'edited_video' : 'timeline_reference_json',
      startedAt: null,
      updatedAt: null,
      error: null,
      context: { segments: config.segments.length }
    });
    
    if (!taskId) {
      throw new Error('添加任务失败');
    }
    
    // 创建编辑配置文件
    const response = await fetch(`/api/content/${hashId}/edit_config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...config,
        taskId
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create edit config: ${response.statusText}`);
    }
    
    // 触发任务执行
    const startResponse = await fetch(`/api/tasks/${hashId}/${taskId}/start`, {
      method: 'POST',
    });
    
    if (!startResponse.ok) {
      throw new Error(`Failed to start task: ${startResponse.statusText}`);
    }
    
    return taskId;
  } catch (error) {
    console.error('Error creating video edit task:', error);
    return null;
  }
};

/**
 * 获取任务状态
 */
export const getVideoEditTaskStatus = async (
  hashId: string, 
  taskId: string
): Promise<{
  state: string;
  percent: number;
  error: string | null;
} | null> => {
  try {
    const response = await fetch(`/api/tasks/${hashId}/${taskId}`);
    if (!response.ok) throw new Error(`Failed to fetch task status: ${response.statusText}`);
    
    const data = await response.json();
    return {
      state: data.state,
      percent: data.percent || 0,
      error: data.error
    };
  } catch (error) {
    console.error('Error fetching task status:', error);
    return null;
  }
}; 