import fs from 'fs-extra';
import { Manifest, Task } from '../types/manifest';
import { createLogger } from './logger';

const logger = createLogger('manifest-utils');

/**
 * 解析manifest.json文件
 */
export async function parseManifest(path: string): Promise<Manifest> {
  try {
    const content = await fs.readFile(path, 'utf-8');
    return JSON.parse(content) as Manifest;
  } catch (error) {
    logger.error(`解析Manifest出错: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * 更新manifest.json文件
 */
export async function updateManifest(manifest: Manifest, path?: string): Promise<void> {
  try {
    const manifestPath = path || `${process.cwd()}/manifest.json`;
    
    // 更新时间戳
    manifest.updatedAt = new Date().toISOString();
    
    // 写入文件
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
    logger.log(`Manifest已更新: ${manifestPath}`);
  } catch (error) {
    logger.error(`更新Manifest出错: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * 更新任务状态
 */
export async function updateTaskState(
  manifest: Manifest,
  taskId: string,
  state: Task['state'],
  context: { [key: string]: any } = {}
): Promise<void> {
  // 查找任务
  const task = manifest.tasks.find(t => t.id === taskId);
  
  if (!task) {
    logger.error(`找不到任务: ${taskId}`);
    throw new Error(`找不到任务: ${taskId}`);
  }
  
  // 更新状态
  task.state = state;
  
  // 设置状态相关时间
  if (state === 'running' && !task.startedAt) {
    task.startedAt = new Date().toISOString();
  }
  
  // 更新任务上下文
  if (context.percent !== undefined) {
    task.percent = context.percent;
  }
  
  if (context.error !== undefined) {
    task.error = context.error;
  }
  
  // 合并其他上下文数据
  task.context = {
    ...(task.context || {}),
    ...context
  };
  
  // 更新时间戳
  task.updatedAt = new Date().toISOString();
  
  // 更新manifest
  logger.log(`任务状态已更新: ${taskId} -> ${state}`);
  
  // 输出JSON格式进度更新，供上层应用解析
  if (context.percent !== undefined) {
    console.log(JSON.stringify({ percent: context.percent }));
  }
} 