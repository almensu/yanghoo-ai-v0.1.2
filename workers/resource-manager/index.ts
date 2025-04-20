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

// 资源清理选项
interface PurgeOptions {
  keepResults: boolean;
  keepThumbnail: boolean;
  reason: 'disk_space' | 'user_request' | 'backup' | 'other';
  preserveLowQuality?: boolean;
  note?: string;
}

// 磁盘使用统计
interface DiskStats {
  totalSize: number;
  mediaSize: number;
  processedDataSize: number;
  thumbnailSize: number;
  byType: { [type: string]: number };
  itemCount: number;
}

// 清理建议项接口
interface CleanupSuggestion {
  hashId: string;
  title: string;
  size: number;
  formattedSize: string;
  lastAccessed?: string;
  path: string;
  reason: 'large_file' | 'old_file';
  manifestPath: string;
}

// 库项目接口
interface LibraryIndexItem {
  hashId: string;
  title: string;
  platform: string;
  duration: number;
  quality: string;
  thumbnail: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  summary: string;
  state: 'ingesting' | 'processing' | 'complete' | 'error' | 'purged';
  diskSize: number;
  hasOriginalMedia: boolean;
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
 * 计算文件大小
 */
async function getFileSize(filePath: string): Promise<number> {
  try {
    const stats = await fs.stat(filePath);
    return stats.size;
  } catch (error) {
    return 0;
  }
}

/**
 * 格式化文件大小为易读形式
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 扫描目录获取大小
 */
async function getDirectorySize(dirPath: string): Promise<number> {
  try {
    const files = await fs.readdir(dirPath);
    
    const sizes = await Promise.all(
      files.map(async file => {
        const filePath = path.join(dirPath, file);
        const stats = await fs.stat(filePath);
        
        if (stats.isDirectory()) {
          return getDirectorySize(filePath);
        } else {
          return stats.size;
        }
      })
    );
    
    return sizes.reduce((acc, size) => acc + size, 0);
  } catch (error) {
    logger.error(`计算目录大小失败: ${error}`);
    return 0;
  }
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
 * 计算内容库的磁盘使用情况
 */
async function calculateDiskStats(rootDir: string): Promise<DiskStats> {
  const stats: DiskStats = {
    totalSize: 0,
    mediaSize: 0,
    processedDataSize: 0,
    thumbnailSize: 0,
    byType: {},
    itemCount: 0
  };
  
  const manifestPaths = getManifestPaths(rootDir);
  stats.itemCount = manifestPaths.length;
  
  for (const manifestPath of manifestPaths) {
    try {
      const manifest = await readManifest(manifestPath);
      const baseDir = path.dirname(manifestPath);
      
      for (const file of manifest.fileManifest) {
        if (file.state === 'purged') continue;
        
        const filePath = path.join(baseDir, file.path);
        let fileSize = 0;
        
        try {
          fileSize = await getFileSize(filePath);
        } catch (error) {
          continue; // 跳过不存在的文件
        }
        
        // 总大小
        stats.totalSize += fileSize;
        
        // 按类型统计
        if (!stats.byType[file.type]) {
          stats.byType[file.type] = 0;
        }
        stats.byType[file.type] += fileSize;
        
        // 分类统计
        if (file.type === 'original_media') {
          stats.mediaSize += fileSize;
        } else if (file.type === 'original_thumbnail') {
          stats.thumbnailSize += fileSize;
        } else {
          stats.processedDataSize += fileSize;
        }
      }
    } catch (error) {
      logger.error(`处理清单文件 ${manifestPath} 时出错: ${error}`);
    }
  }
  
  return stats;
}

/**
 * 生成清理建议
 */
async function generateCleanupSuggestions(rootDir: string, thresholdDays = 30, sizeMB = 500): Promise<CleanupSuggestion[]> {
  const suggestions: CleanupSuggestion[] = [];
  const manifestPaths = getManifestPaths(rootDir);
  
  for (const manifestPath of manifestPaths) {
    try {
      const manifest = await readManifest(manifestPath);
      const baseDir = path.dirname(manifestPath);
      
      // 查找媒体文件
      const mediaFile = manifest.fileManifest.find(f => f.type === 'original_media' && f.state === 'ready');
      
      if (!mediaFile) continue;
      
      const mediaPath = path.join(baseDir, mediaFile.path);
      let fileSize = 0;
      
      try {
        fileSize = await getFileSize(mediaPath);
      } catch (error) {
        continue; // 跳过不存在的文件
      }
      
      // 检查大小和最后访问时间
      const fileSizeMB = fileSize / (1024 * 1024);
      const lastAccessed = mediaFile.metadata?.lastAccessed 
        ? dayjs(mediaFile.metadata.lastAccessed)
        : null;
      
      const isOld = lastAccessed 
        ? dayjs().diff(lastAccessed, 'day') > thresholdDays
        : false;
      
      const isLarge = fileSizeMB > sizeMB;
      
      if (isLarge || isOld) {
        suggestions.push({
          hashId: manifest.hashId,
          title: manifest.metadata?.title || 'Untitled',
          size: fileSize,
          formattedSize: formatFileSize(fileSize),
          lastAccessed: mediaFile.metadata?.lastAccessed,
          path: mediaPath,
          reason: isLarge ? 'large_file' : 'old_file',
          manifestPath
        });
      }
    } catch (error) {
      logger.error(`处理清单文件 ${manifestPath} 时出错: ${error}`);
    }
  }
  
  // 按大小排序
  return suggestions.sort((a, b) => b.size - a.size);
}

/**
 * 重写library.json索引
 */
async function updateLibraryIndex(rootDir: string): Promise<void> {
  const libraryPath = path.join(rootDir, 'library.json');
  const manifestPaths = getManifestPaths(rootDir);
  
  const libraryItems: LibraryIndexItem[] = [];
  
  for (const manifestPath of manifestPaths) {
    try {
      const manifest = await readManifest(manifestPath);
      const baseDir = path.dirname(manifestPath);
      
      // 查找媒体文件
      const mediaFile = manifest.fileManifest.find(f => f.type === 'original_media');
      if (!mediaFile) continue;
      
      // 查找缩略图
      const thumbnailFile = manifest.fileManifest.find(f => f.type === 'original_thumbnail');
      
      // 计算文件夹总大小
      const totalSize = await getDirectorySize(baseDir);
      
      // 查找标签
      const topicsFile = manifest.fileManifest.find(f => f.type === 'topic_tags_json');
      let topics = [];
      
      if (topicsFile) {
        try {
          const topicsPath = path.join(baseDir, topicsFile.path);
          const topicsData = await fs.readJSON(topicsPath);
          topics = topicsData.tags || [];
        } catch (error) {
          // 忽略错误
        }
      }
      
      // 查找摘要
      const summaryFile = manifest.fileManifest.find(f => f.type === 'summary_rich_json');
      let summary = '';
      
      if (summaryFile) {
        try {
          const summaryPath = path.join(baseDir, summaryFile.path);
          const summaryData = await fs.readJSON(summaryPath);
          if (summaryData.highlights && summaryData.highlights.length > 0) {
            summary = summaryData.highlights[0];
          }
        } catch (error) {
          // 忽略错误
        }
      }
      
      // 创建库条目
      libraryItems.push({
        hashId: manifest.hashId,
        title: manifest.metadata?.title || 'Untitled',
        platform: manifest.metadata?.platform || 'unknown',
        duration: mediaFile.metadata?.duration || 0,
        quality: mediaFile.metadata?.quality || 'unknown',
        thumbnail: thumbnailFile ? path.join(baseDir, thumbnailFile.path) : '',
        createdAt: manifest.createdAt || new Date().toISOString(),
        updatedAt: manifest.updatedAt || new Date().toISOString(),
        tags: topics,
        summary: summary || '',
        state: manifest.tasks.some(t => t.state === 'error') ? 'error' : 
               manifest.tasks.some(t => t.state === 'running') ? 'processing' : 
               mediaFile.state === 'purged' ? 'purged' : 'complete',
        diskSize: totalSize,
        hasOriginalMedia: mediaFile.state !== 'purged'
      });
    } catch (error) {
      logger.error(`处理清单文件 ${manifestPath} 时出错: ${error}`);
    }
  }
  
  // 创建库索引
  const library = {
    schemaVersion: '0.3.5',
    updatedAt: new Date().toISOString(),
    items: libraryItems
  };
  
  // 保存库索引
  await fs.writeJSON(libraryPath, library, { spaces: 2 });
  logger.log(`库索引已更新: ${libraryPath}`);
}

/**
 * 备份媒体文件
 */
async function backupMediaFile(filePath: string, backupDir: string): Promise<string | null> {
  try {
    // 创建备份目录
    await fs.ensureDir(backupDir);
    
    // 创建备份文件名
    const fileName = path.basename(filePath);
    const backupPath = path.join(backupDir, `${fileName}.backup_${Date.now()}.zip`);
    
    // 创建ZIP流
    const output = fs.createWriteStream(backupPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    // 设置事件
    output.on('close', () => {
      logger.log(`备份完成: ${backupPath} (${archive.pointer()} bytes)`);
    });
    
    archive.on('error', (err) => {
      throw err;
    });
    
    // 添加文件到压缩包
    archive.pipe(output);
    archive.file(filePath, { name: fileName });
    await archive.finalize();
    
    return backupPath;
  } catch (error) {
    logger.error(`备份文件失败: ${error}`);
    return null;
  }
}

/**
 * 清理单个内容
 */
async function purgeContent(manifestPath: string, options: PurgeOptions): Promise<boolean> {
  try {
    const manifest = await readManifest(manifestPath);
    const baseDir = path.dirname(manifestPath);
    
    // 查找媒体文件
    const mediaFile = manifest.fileManifest.find(f => f.type === 'original_media' && f.state === 'ready');
    
    if (!mediaFile) {
      logger.error('未找到可清理的媒体文件');
      return false;
    }
    
    // 记录原始信息
    const originalMetadata = { ...mediaFile.metadata };
    
    // 查找缩略图
    const thumbnailFile = manifest.fileManifest.find(f => f.type === 'original_thumbnail');
    
    // 查找或创建purge_media任务
    let purgeTask = manifest.tasks.find(t => t.id === 'purge_media');
    
    if (!purgeTask) {
      purgeTask = {
        id: 'purge_media',
        title: '删除原始媒体但保留处理结果',
        state: 'running',
        percent: 0,
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        relatedOutput: mediaFile.path,
        context: {
          keepResults: options.keepResults,
          keepThumbnail: options.keepThumbnail,
          reason: options.reason
        }
      };
      
      manifest.tasks.push(purgeTask);
    } else {
      purgeTask.state = 'running';
      purgeTask.percent = 0;
      purgeTask.updatedAt = new Date().toISOString();
      purgeTask.context = {
        keepResults: options.keepResults,
        keepThumbnail: options.keepThumbnail,
        reason: options.reason
      };
    }
    
    // 更新清单
    await saveManifest(manifest, manifestPath);
    
    // 媒体文件路径
    const mediaPath = path.join(baseDir, mediaFile.path);
    
    try {
      if (await fs.pathExists(mediaPath)) {
        // 备份文件
        const backupDir = path.join(baseDir, '.backups');
        const backupPath = await backupMediaFile(mediaPath, backupDir);
        
        // 删除原始媒体文件
        await fs.remove(mediaPath);
        logger.log(`已删除媒体文件: ${mediaPath}`);
        
        // 更新任务状态
        purgeTask.percent = 50;
        purgeTask.updatedAt = new Date().toISOString();
        
        // 如果不保留缩略图，也删除它
        if (!options.keepThumbnail && thumbnailFile) {
          const thumbnailPath = path.join(baseDir, thumbnailFile.path);
          if (await fs.pathExists(thumbnailPath)) {
            await fs.remove(thumbnailPath);
            logger.log(`已删除缩略图: ${thumbnailPath}`);
            
            // 更新缩略图状态
            thumbnailFile.state = 'purged';
            thumbnailFile.metadata = {
              ...thumbnailFile.metadata,
              purgedAt: new Date().toISOString(),
              purgedReason: options.reason
            };
          }
        }
      } else {
        logger.warn(`媒体文件不存在: ${mediaPath}`);
      }
      
      // 更新媒体文件状态为purged
      mediaFile.state = 'purged';
      mediaFile.metadata = {
        ...originalMetadata,
        quality: originalMetadata.quality || 'unknown',
        mediaType: originalMetadata.mediaType || 'local',
        duration: originalMetadata.duration || 0,
        dimensions: originalMetadata.dimensions || { width: 0, height: 0 },
        diskSize: 0,
        purgedAt: new Date().toISOString(),
        purgedReason: options.reason,
        hasOriginalMedia: false
      };
      
      // 完成任务
      purgeTask.state = 'done';
      purgeTask.percent = 100;
      purgeTask.updatedAt = new Date().toISOString();
      
      // 保存更新的清单
      await saveManifest(manifest, manifestPath);
      
      return true;
    } catch (error) {
      // 错误处理
      logger.error(`清理内容失败: ${error}`);
      
      purgeTask.state = 'error';
      purgeTask.error = `${error}`;
      purgeTask.updatedAt = new Date().toISOString();
      
      await saveManifest(manifest, manifestPath);
      
      return false;
    }
  } catch (error) {
    logger.error(`处理清单文件失败: ${error}`);
    return false;
  }
}

/**
 * 清理多个内容
 */
async function batchPurgeContent(manifestPaths: string[], options: PurgeOptions): Promise<{ success: number, failed: number }> {
  let success = 0;
  let failed = 0;
  
  for (const manifestPath of manifestPaths) {
    const result = await purgeContent(manifestPath, options);
    
    if (result) {
      success++;
    } else {
      failed++;
    }
  }
  
  return { success, failed };
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
  
  console.log('\n资源管理工具 v1.0.0');
  console.log('===================\n');
  
  function showMenu() {
    console.log('\n选择操作:');
    console.log('1. 显示磁盘使用统计');
    console.log('2. 生成清理建议');
    console.log('3. 清理单个内容');
    console.log('4. 批量清理内容');
    console.log('5. 更新库索引');
    console.log('0. 退出');
    
    rl.question('\n请选择: ', async (answer) => {
      switch (answer) {
        case '1':
          try {
            console.log('\n正在计算磁盘使用情况...');
            const stats = await calculateDiskStats(rootDir);
            
            console.log('\n磁盘使用统计:');
            console.log(`总大小: ${formatFileSize(stats.totalSize)}`);
            console.log(`媒体文件: ${formatFileSize(stats.mediaSize)} (${((stats.mediaSize / stats.totalSize) * 100).toFixed(2)}%)`);
            console.log(`处理数据: ${formatFileSize(stats.processedDataSize)} (${((stats.processedDataSize / stats.totalSize) * 100).toFixed(2)}%)`);
            console.log(`缩略图: ${formatFileSize(stats.thumbnailSize)} (${((stats.thumbnailSize / stats.totalSize) * 100).toFixed(2)}%)`);
            console.log(`内容数量: ${stats.itemCount}`);
            
            console.log('\n按类型统计:');
            for (const [type, size] of Object.entries(stats.byType)) {
              console.log(`${type}: ${formatFileSize(size)} (${((size / stats.totalSize) * 100).toFixed(2)}%)`);
            }
          } catch (error) {
            console.error(`\n出错: ${error}`);
          }
          
          showMenu();
          break;
          
        case '2':
          try {
            console.log('\n正在生成清理建议...');
            const suggestions = await generateCleanupSuggestions(rootDir);
            
            if (suggestions.length === 0) {
              console.log('\n没有找到需要清理的内容。');
            } else {
              console.log(`\n找到 ${suggestions.length} 个可清理的内容:`);
              
              suggestions.forEach((item, index) => {
                console.log(`\n${index + 1}. ${item.title}`);
                console.log(`   大小: ${item.formattedSize}`);
                console.log(`   路径: ${item.path}`);
                console.log(`   原因: ${item.reason === 'large_file' ? '大文件' : '长期未访问'}`);
                
                if (item.lastAccessed) {
                  console.log(`   最后访问: ${item.lastAccessed}`);
                }
              });
            }
          } catch (error) {
            console.error(`\n出错: ${error}`);
          }
          
          showMenu();
          break;
          
        case '3':
          rl.question('\n输入要清理的内容的hashId: ', async (hashId) => {
            try {
              const manifestPaths = getManifestPaths(rootDir);
              const targetPath = manifestPaths.find(p => {
                const dirName = path.basename(path.dirname(p));
                return dirName === hashId;
              });
              
              if (!targetPath) {
                console.log(`\n找不到hashId为 ${hashId} 的内容`);
                showMenu();
                return;
              }
              
              console.log('\n清理选项:');
              console.log('1. 完全删除（删除所有内容）');
              console.log('2. 仅删除原始媒体（保留处理结果）');
              
              rl.question('\n请选择清理方式: ', async (option) => {
                const keepResults = option === '2';
                
                const confirmation = await new Promise<string>((resolve) => {
                  rl.question(`\n确认要${keepResults ? '删除原始媒体并保留处理结果' : '完全删除内容'}? (y/n): `, resolve);
                });
                
                if (confirmation.toLowerCase() === 'y') {
                  console.log('\n正在清理内容...');
                  
                  const result = await purgeContent(targetPath, {
                    keepResults,
                    keepThumbnail: keepResults,
                    reason: 'user_request'
                  });
                  
                  if (result) {
                    console.log('\n内容已成功清理!');
                    
                    // 更新库索引
                    await updateLibraryIndex(rootDir);
                  } else {
                    console.log('\n清理内容失败。');
                  }
                } else {
                  console.log('\n操作已取消。');
                }
                
                showMenu();
              });
            } catch (error) {
              console.error(`\n出错: ${error}`);
              showMenu();
            }
          });
          break;
          
        case '4':
          try {
            console.log('\n正在生成清理建议...');
            const suggestions = await generateCleanupSuggestions(rootDir);
            
            if (suggestions.length === 0) {
              console.log('\n没有找到需要清理的内容。');
              showMenu();
              return;
            }
            
            console.log(`\n找到 ${suggestions.length} 个可清理的内容:`);
            
            suggestions.forEach((item, index) => {
              console.log(`\n${index + 1}. ${item.title}`);
              console.log(`   大小: ${item.formattedSize}`);
              console.log(`   原因: ${item.reason === 'large_file' ? '大文件' : '长期未访问'}`);
            });
            
            rl.question('\n输入要清理的内容编号(多个用逗号分隔): ', async (input) => {
              const indices = input.split(',').map(i => parseInt(i.trim()) - 1);
              
              if (indices.some(i => isNaN(i) || i < 0 || i >= suggestions.length)) {
                console.log('\n无效的编号。');
                showMenu();
                return;
              }
              
              const selectedItems = indices.map(i => suggestions[i]);
              
              console.log('\n清理选项:');
              console.log('1. 完全删除（删除所有内容）');
              console.log('2. 仅删除原始媒体（保留处理结果）');
              
              rl.question('\n请选择清理方式: ', async (option) => {
                const keepResults = option === '2';
                
                const manifestPaths = selectedItems.map(item => item.manifestPath);
                
                const confirmation = await new Promise<string>((resolve) => {
                  rl.question(`\n确认要批量${keepResults ? '删除原始媒体并保留处理结果' : '完全删除内容'}? (y/n): `, resolve);
                });
                
                if (confirmation.toLowerCase() === 'y') {
                  console.log('\n正在批量清理内容...');
                  
                  const result = await batchPurgeContent(manifestPaths, {
                    keepResults,
                    keepThumbnail: keepResults,
                    reason: 'user_request'
                  });
                  
                  console.log(`\n批量清理结果: 成功 ${result.success}, 失败 ${result.failed}`);
                  
                  // 更新库索引
                  await updateLibraryIndex(rootDir);
                } else {
                  console.log('\n操作已取消。');
                }
                
                showMenu();
              });
            });
          } catch (error) {
            console.error(`\n出错: ${error}`);
            showMenu();
          }
          break;
          
        case '5':
          try {
            console.log('\n正在更新库索引...');
            await updateLibraryIndex(rootDir);
            console.log('\n库索引已更新。');
          } catch (error) {
            console.error(`\n出错: ${error}`);
          }
          
          showMenu();
          break;
          
        case '0':
          console.log('\n再见!');
          rl.close();
          break;
          
        default:
          console.log('\n无效的选项。');
          showMenu();
          break;
      }
    });
  }
  
  showMenu();
}

// 命令行参数处理
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // 交互式模式
    createCLI();
    return;
  }
  
  const command = args[0];
  
  switch (command) {
    case 'stats': {
      // 显示磁盘使用统计
      const rootDir = args[1] || path.resolve('storage/content-studio');
      const stats = await calculateDiskStats(rootDir);
      
      console.log(`总大小: ${formatFileSize(stats.totalSize)}`);
      console.log(`媒体文件: ${formatFileSize(stats.mediaSize)}`);
      console.log(`处理数据: ${formatFileSize(stats.processedDataSize)}`);
      console.log(`内容数量: ${stats.itemCount}`);
      break;
    }
    
    case 'suggestions': {
      // 生成清理建议
      const rootDir = args[1] || path.resolve('storage/content-studio');
      const threshold = args[2] ? parseInt(args[2]) : 30;
      const sizeThreshold = args[3] ? parseInt(args[3]) : 500;
      
      const suggestions = await generateCleanupSuggestions(rootDir, threshold, sizeThreshold);
      
      console.log(`找到 ${suggestions.length} 个可清理的内容:`);
      
      suggestions.forEach((item, index) => {
        console.log(`\n${index + 1}. ${item.title}`);
        console.log(`   大小: ${item.formattedSize}`);
        console.log(`   路径: ${item.path}`);
        console.log(`   原因: ${item.reason === 'large_file' ? '大文件' : '长期未访问'}`);
      });
      break;
    }
    
    case 'purge': {
      // 清理内容
      if (args.length < 2) {
        console.log('用法: node index.js purge <manifest.json路径> [keepResults]');
        break;
      }
      
      const manifestPath = args[1];
      const keepResults = args[2] === 'true';
      
      console.log(`清理内容: ${manifestPath}`);
      console.log(`保留处理结果: ${keepResults}`);
      
      const result = await purgeContent(manifestPath, {
        keepResults,
        keepThumbnail: keepResults,
        reason: 'user_request'
      });
      
      console.log(`清理${result ? '成功' : '失败'}`);
      
      // 更新库索引
      const rootDir = path.resolve('storage/content-studio');
      await updateLibraryIndex(rootDir);
      break;
    }
    
    case 'update-index': {
      // 更新库索引
      const rootDir = args[1] || path.resolve('storage/content-studio');
      await updateLibraryIndex(rootDir);
      console.log('库索引已更新。');
      break;
    }
    
    default:
      console.log('未知命令。可用命令: stats, suggestions, purge, update-index');
      break;
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error('执行出错:', err);
    process.exit(1);
  });
}

// 导出API
export {
  calculateDiskStats,
  generateCleanupSuggestions,
  purgeContent,
  batchPurgeContent,
  updateLibraryIndex
}; 