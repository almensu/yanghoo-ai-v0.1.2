import type { Task } from './manifestApi';

/**
 * Task progress update from backend workers
 */
export interface TaskProgress {
  percent: number;
  status?: string;
  error?: string;
}

/**
 * Starts a specific task by ID
 */
export const startTask = async (hashId: string, taskId: string): Promise<boolean> => {
  try {
    const response = await fetch(`/api/task/${hashId}/${taskId}/start`, {
      method: 'POST',
    });
    
    if (!response.ok) throw new Error(`Failed to start task: ${response.statusText}`);
    return true;
  } catch (error) {
    console.error('Error starting task:', error);
    return false;
  }
};

/**
 * Cancels a running task
 */
export const cancelTask = async (hashId: string, taskId: string): Promise<boolean> => {
  try {
    const response = await fetch(`/api/task/${hashId}/${taskId}/cancel`, {
      method: 'POST',
    });
    
    if (!response.ok) throw new Error(`Failed to cancel task: ${response.statusText}`);
    return true;
  } catch (error) {
    console.error('Error canceling task:', error);
    return false;
  }
};

/**
 * Gets the current progress of a task
 */
export const getTaskProgress = async (
  hashId: string,
  taskId: string
): Promise<TaskProgress | null> => {
  try {
    const response = await fetch(`/api/task/${hashId}/${taskId}/progress`);
    if (!response.ok) throw new Error(`Failed to get task progress: ${response.statusText}`);
    
    const data = await response.json();
    return data as TaskProgress;
  } catch (error) {
    console.error('Error getting task progress:', error);
    return null;
  }
};

/**
 * Retries a failed task
 */
export const retryTask = async (hashId: string, taskId: string): Promise<boolean> => {
  try {
    const response = await fetch(`/api/task/${hashId}/${taskId}/retry`, {
      method: 'POST',
    });
    
    if (!response.ok) throw new Error(`Failed to retry task: ${response.statusText}`);
    return true;
  } catch (error) {
    console.error('Error retrying task:', error);
    return false;
  }
};

/**
 * Fetches the list of pending and running tasks for a specific content
 */
export const getActiveTasks = async (hashId: string): Promise<Task[]> => {
  try {
    const response = await fetch(`/api/task/${hashId}/active`);
    if (!response.ok) throw new Error(`Failed to get active tasks: ${response.statusText}`);
    
    const data = await response.json();
    return data as Task[];
  } catch (error) {
    console.error('Error getting active tasks:', error);
    return [];
  }
};

/**
 * Fetches task history for a specific content
 */
export const getTaskHistory = async (
  hashId: string,
  limit: number = 20,
  offset: number = 0
): Promise<Task[]> => {
  try {
    const response = await fetch(
      `/api/task/${hashId}/history?limit=${limit}&offset=${offset}`
    );
    
    if (!response.ok) throw new Error(`Failed to get task history: ${response.statusText}`);
    
    const data = await response.json();
    return data as Task[];
  } catch (error) {
    console.error('Error getting task history:', error);
    return [];
  }
};

/**
 * Triggers a specific task by type (useful for manual operations)
 */
export const triggerTask = async (
  hashId: string,
  taskType: string,
  options?: Record<string, any>
): Promise<string | null> => {
  try {
    const response = await fetch(`/api/task/${hashId}/trigger/${taskType}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: options ? JSON.stringify(options) : undefined,
    });
    
    if (!response.ok) throw new Error(`Failed to trigger task: ${response.statusText}`);
    
    const data = await response.json();
    return data.taskId;
  } catch (error) {
    console.error('Error triggering task:', error);
    return null;
  }
}; 