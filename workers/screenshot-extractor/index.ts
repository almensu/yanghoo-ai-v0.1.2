import fs from 'fs-extra';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import { parseManifest, updateTaskState, updateManifest } from '../../src/utils/manifest';
import { createLogger } from '../../src/utils/logger';

// 创建日志记录器
const logger = createLogger('screenshot-extractor');

// 截图配置类型
interface ScreenshotConfig {
  mode: 'interval' | 'uniform' | 'keyframe' | 'subtitle';
  interval?: number;   // 时间间隔模式的间隔（秒）
  count?: number;      // 均匀分布模式的数量
  taskId: string;      // 关联任务ID
  outputQuality?: number; // 截图质量 (1-100)
  imageFormat?: 'jpg' | 'png'; // 截图格式
}

/**
 * 检索字幕文件路径
 */
async function findSubtitleFile(baseDir: string): Promise<string | null> {
  const possiblePaths = [
    path.join(baseDir, 'transcripts', 'merged', 'transcript.vtt'),
    path.join(baseDir, 'transcripts', 'en', 'transcript.vtt'),
    path.join(baseDir, 'transcripts', 'whisperx', 'transcript.vtt')
  ];

  for (const subPath of possiblePaths) {
    if (await fs.pathExists(subPath)) {
      return subPath;
    }
  }

  return null;
}

/**
 * 解析VTT字幕文件提取时间点
 */
async function parseVTT(vttPath: string): Promise<{timestamps: number[], texts: string[]}> {
  const content = await fs.readFile(vttPath, 'utf-8');
  const lines = content.split('\n');
  
  const timestamps: number[] = [];
  const texts: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // 查找时间轴行 (格式: 00:00:10.500 --> 00:00:15.000)
    if (line.includes(' --> ')) {
      const [startTime] = line.split(' --> ');
      
      // 转换开始时间为秒
      timestamps.push(convertTimeToSeconds(startTime));
      
      // 获取字幕文本
      let text = '';
      let j = i + 1;
      while (j < lines.length && lines[j].trim() !== '' && !lines[j].includes(' --> ')) {
        text += (text ? ' ' : '') + lines[j].trim();
        j++;
      }
      
      texts.push(text);
    }
  }
  
  return { timestamps, texts };
}

/**
 * 将时间字符串转换为秒
 */
function convertTimeToSeconds(timeStr: string): number {
  const parts = timeStr.split(':');
  
  if (parts.length === 3) {
    // 格式: 00:00:10.500 (时:分:秒)
    return parseInt(parts[0], 10) * 3600 + 
           parseInt(parts[1], 10) * 60 + 
           parseFloat(parts[2]);
  } else if (parts.length === 2) {
    // 格式: 00:10.500 (分:秒)
    return parseInt(parts[0], 10) * 60 + parseFloat(parts[1]);
  }
  
  // 无法解析的格式返回0
  return 0;
}

/**
 * 格式化秒为时间戳字符串
 */
function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  
  return `${hours.toString().padStart(2, '0')}_${minutes.toString().padStart(2, '0')}_${secs.toString().padStart(2, '0')}_${ms.toString().padStart(3, '0')}`;
}

/**
 * 提取单张截图
 */
async function extractScreenshot(
  inputPath: string,
  outputPath: string,
  timestamp: number,
  quality: number = 80,
  format: 'jpg' | 'png' = 'jpg'
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    try {
      const command = ffmpeg(inputPath)
        .seekInput(timestamp)
        .frames(1)
        .output(outputPath)
        .outputOptions([
          `-q:v ${Math.min(Math.max(1, Math.round(31 - (quality * 0.3))), 31)}`, // 质量转换为FFmpeg尺度 (1-31)
        ]);

      // 设置输出格式
      if (format === 'jpg') {
        command.outputFormat('image2');
      } else {
        command.outputFormat('image2');
        command.outputOptions(['-pix_fmt rgb24']);
      }
      
      // 处理完成
      command.on('end', () => {
        logger.log(`截图提取完成: ${outputPath}`);
        resolve(true);
      });
      
      // 处理错误
      command.on('error', (err) => {
        logger.error(`提取截图出错: ${err.message}`);
        reject(err);
      });
      
      // 开始处理
      command.run();
    } catch (error) {
      logger.error(`创建FFmpeg命令出错: ${(error as Error).message}`);
      reject(error);
    }
  });
}

/**
 * 提取关键帧截图
 */
async function extractKeyframes(
  inputPath: string,
  outputDir: string,
  quality: number = 80,
  format: 'jpg' | 'png' = 'jpg'
): Promise<string[]> {
  // 创建临时目录
  const tempDir = path.join(outputDir, 'temp_keyframes');
  await fs.ensureDir(tempDir);
  
  // 使用FFmpeg的场景检测过滤器提取关键帧
  return new Promise((resolve, reject) => {
    try {
      const outputPattern = path.join(tempDir, `keyframe_%04d.${format}`);
      
      // 创建命令
      const command = ffmpeg(inputPath)
        .outputOptions([
          '-vf', 'select=\'eq(pict_type,I)\'', // 选择I帧（关键帧）
          `-q:v ${Math.min(Math.max(1, Math.round(31 - (quality * 0.3))), 31)}`, // 质量设置
          '-vsync', 'vfr'  // 可变帧率输出
        ])
        .output(outputPattern);
      
      // 处理完成
      command.on('end', async () => {
        logger.log('关键帧提取完成');
        
        // 读取所有提取的帧文件
        const files = await fs.readdir(tempDir);
        const framePaths = files
          .filter(f => f.startsWith('keyframe_') && f.endsWith(`.${format}`))
          .map(f => path.join(tempDir, f))
          .sort(); // 确保顺序
        
        resolve(framePaths);
      });
      
      // 处理错误
      command.on('error', (err) => {
        logger.error(`提取关键帧出错: ${err.message}`);
        reject(err);
      });
      
      // 开始处理
      command.run();
    } catch (error) {
      logger.error(`创建FFmpeg命令出错: ${(error as Error).message}`);
      reject(error);
    }
  });
}

/**
 * 获取视频时长（秒）
 */
async function getVideoDuration(videoPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }
      
      if (metadata && metadata.format && metadata.format.duration) {
        resolve(metadata.format.duration);
      } else {
        reject(new Error('无法获取视频时长'));
      }
    });
  });
}

/**
 * 创建截图集合JSON文件
 */
async function createScreenshotCollection(
  screenshotFiles: {path: string, timestamp: number, subtitleText?: string}[],
  outputPath: string,
  title: string
): Promise<boolean> {
  try {
    const now = new Date().toISOString();
    
    const collectionData = {
      title: `${title} - 截图集合`,
      created: now,
      updated: now,
      count: screenshotFiles.length,
      screenshots: screenshotFiles.map((file, index) => ({
        id: `screenshot_${index + 1}`,
        filename: path.basename(file.path),
        timestamp: file.timestamp,
        subtitleText: file.subtitleText || '',
        notes: '',
        tags: []
      }))
    };
    
    await fs.writeJSON(outputPath, collectionData, { spaces: 2 });
    logger.log(`截图集合已生成: ${outputPath}`);
    return true;
  } catch (error) {
    logger.error(`生成截图集合出错: ${(error as Error).message}`);
    return false;
  }
}

/**
 * 创建ZIP压缩包
 */
async function createZipArchive(
  sourceDir: string,
  outputPath: string
): Promise<boolean> {
  try {
    const archiver = require('archiver');
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', {
      zlib: { level: 9 } // 最高压缩级别
    });
    
    output.on('close', () => {
      logger.log(`ZIP压缩包已创建: ${outputPath} (${archive.pointer()} bytes)`);
    });
    
    archive.on('error', (err: Error) => {
      throw err;
    });
    
    archive.pipe(output);
    archive.directory(sourceDir, false);
    await archive.finalize();
    
    return true;
  } catch (error) {
    logger.error(`创建ZIP压缩包出错: ${(error as Error).message}`);
    return false;
  }
}

/**
 * 主处理函数
 */
async function processScreenshots(manifestPath: string): Promise<void> {
  try {
    logger.log('开始截图提取处理...');
    const manifest = await parseManifest(manifestPath);
    
    // 检查是否存在配置文件
    const configPath = path.join(path.dirname(manifestPath), 'screenshot_config.json');
    if (!await fs.pathExists(configPath)) {
      throw new Error('缺少截图配置文件: screenshot_config.json');
    }
    
    // 读取配置
    const config: ScreenshotConfig = await fs.readJSON(configPath);
    
    // 更新任务状态为运行中
    await updateTaskState(manifest, config.taskId, 'running', { percent: 0 });
    
    // 检查原始视频文件是否存在
    const videoFiles = manifest.fileManifest.filter(f => 
      f.type === 'original_media' && f.state === 'ready'
    );
    
    if (videoFiles.length === 0) {
      throw new Error('找不到可用的原始视频文件');
    }
    
    // 获取视频文件路径
    const videoFile = videoFiles[0];
    const baseDir = path.dirname(manifestPath);
    const videoPath = path.join(baseDir, videoFile.path);
    
    if (!await fs.pathExists(videoPath)) {
      throw new Error(`视频文件不存在: ${videoPath}`);
    }
    
    // 创建输出目录
    const screenshotsDir = path.join(baseDir, 'screenshots');
    await fs.ensureDir(screenshotsDir);
    
    // 获取视频时长
    const videoDuration = await getVideoDuration(videoPath);
    logger.log(`视频时长: ${videoDuration}秒`);
    
    // 提取截图的时间点列表
    let timestamps: number[] = [];
    let subtitleTexts: string[] = [];
    
    // 根据不同模式生成时间点
    switch (config.mode) {
      case 'interval':
        // 时间间隔模式
        const interval = config.interval || 60; // 默认60秒
        for (let time = 0; time < videoDuration; time += interval) {
          timestamps.push(time);
        }
        logger.log(`时间间隔模式: 每${interval}秒提取一张，共${timestamps.length}张`);
        break;
        
      case 'uniform':
        // 均匀分布模式
        const count = config.count || 10; // 默认10张
        const step = videoDuration / (count + 1);
        for (let i = 1; i <= count; i++) {
          timestamps.push(step * i);
        }
        logger.log(`均匀分布模式: 提取${count}张`);
        break;
        
      case 'keyframe':
        // 关键帧模式 - 这个稍后处理
        logger.log('关键帧模式');
        break;
        
      case 'subtitle':
        // 字幕时间点模式
        const subtitlePath = await findSubtitleFile(baseDir);
        if (!subtitlePath) {
          throw new Error('找不到字幕文件');
        }
        
        const subtitleData = await parseVTT(subtitlePath);
        timestamps = subtitleData.timestamps;
        subtitleTexts = subtitleData.texts;
        logger.log(`字幕时间点模式: 找到${timestamps.length}个时间点`);
        break;
    }
    
    // 处理关键帧模式的特殊情况
    let screenshotFiles: {path: string, timestamp: number, subtitleText?: string}[] = [];
    
    if (config.mode === 'keyframe') {
      // 更新任务状态
      await updateTaskState(manifest, config.taskId, 'running', { 
        percent: 10,
        message: '正在提取关键帧...'
      });
      
      // 提取关键帧
      const keyframePaths = await extractKeyframes(
        videoPath,
        screenshotsDir,
        config.outputQuality || 80,
        config.imageFormat || 'jpg'
      );
      
      // 移动文件并重命名
      for (let i = 0; i < keyframePaths.length; i++) {
        const srcPath = keyframePaths[i];
        // 我们需要估算每个关键帧的时间点，但这不准确
        // 这里简单地假设关键帧均匀分布
        const estimatedTime = (i / (keyframePaths.length - 1)) * videoDuration;
        const newFileName = `keyframe_${formatTimestamp(estimatedTime)}.${config.imageFormat || 'jpg'}`;
        const destPath = path.join(screenshotsDir, newFileName);
        
        await fs.move(srcPath, destPath, { overwrite: true });
        
        screenshotFiles.push({
          path: destPath,
          timestamp: estimatedTime
        });
        
        // 更新进度
        const progress = Math.round(10 + (80 * (i / keyframePaths.length)));
        await updateTaskState(manifest, config.taskId, 'running', { percent: progress });
      }
      
      // 清理临时目录
      await fs.remove(path.join(screenshotsDir, 'temp_keyframes'));
    } else {
      // 常规模式提取截图
      for (let i = 0; i < timestamps.length; i++) {
        const timestamp = timestamps[i];
        const fileName = `screenshot_${formatTimestamp(timestamp)}.${config.imageFormat || 'jpg'}`;
        const outputPath = path.join(screenshotsDir, fileName);
        
        // 更新进度
        const progress = Math.round(5 + (85 * (i / timestamps.length)));
        await updateTaskState(manifest, config.taskId, 'running', { percent: progress });
        
        // 提取截图
        await extractScreenshot(
          videoPath,
          outputPath,
          timestamp,
          config.outputQuality || 80,
          config.imageFormat || 'jpg'
        );
        
        // 添加到文件列表
        screenshotFiles.push({
          path: outputPath,
          timestamp,
          subtitleText: config.mode === 'subtitle' ? subtitleTexts[i] : undefined
        });
      }
    }
    
    // 更新任务状态
    await updateTaskState(manifest, config.taskId, 'running', { 
      percent: 90,
      message: '正在创建截图集合...'
    });
    
    // 创建截图集合JSON
    const collectionPath = path.join(screenshotsDir, 'collection.json');
    const videoTitle = manifest.metadata?.title || 'Untitled Video';
    await createScreenshotCollection(screenshotFiles, collectionPath, videoTitle);
    
    // 创建ZIP压缩包
    const zipPath = path.join(screenshotsDir, 'screenshots.zip');
    await createZipArchive(screenshotsDir, zipPath);
    
    // 更新 manifest
    // 添加screenshot_collection_json
    const collectionRelativePath = path.relative(baseDir, collectionPath);
    manifest.fileManifest.push({
      type: 'screenshot_collection_json',
      version: 1,
      path: collectionRelativePath,
      state: 'ready',
      generatedBy: config.taskId,
      derivedFrom: [videoFile.path],
      metadata: {
        count: screenshotFiles.length,
        mode: config.mode,
        interval: config.interval,
        quality: config.outputQuality || 80,
        format: config.imageFormat || 'jpg'
      }
    });
    
    // 添加ZIP文件
    const zipRelativePath = path.relative(baseDir, zipPath);
    manifest.fileManifest.push({
      type: 'screenshot_zip',
      version: 1,
      path: zipRelativePath,
      state: 'ready',
      generatedBy: config.taskId,
      derivedFrom: [videoFile.path],
      metadata: {
        count: screenshotFiles.length,
        diskSize: (await fs.stat(zipPath)).size
      }
    });
    
    // 为每个截图添加文件项
    for (let i = 0; i < screenshotFiles.length; i++) {
      const screenshot = screenshotFiles[i];
      const relativePath = path.relative(baseDir, screenshot.path);
      
      manifest.fileManifest.push({
        type: 'screenshot_image',
        version: 1,
        path: relativePath,
        state: 'ready',
        generatedBy: config.taskId,
        derivedFrom: [videoFile.path],
        metadata: {
          timestamp: screenshot.timestamp,
          subtitleText: screenshot.subtitleText || '',
          tags: [],
          notes: ''
        }
      });
    }
    
    // 更新manifest
    await updateManifest(manifest, manifestPath);
    
    // 完成任务
    await updateTaskState(manifest, config.taskId, 'done', { 
      percent: 100,
      outputFiles: {
        collection: collectionRelativePath,
        zip: zipRelativePath,
        screenshots: screenshotFiles.length
      }
    });
    
    logger.log('截图提取处理完成!');
  } catch (error) {
    logger.error(`截图提取处理出错: ${(error as Error).message}`);
    
    // 获取manifest和任务ID
    try {
      const manifest = await parseManifest(manifestPath);
      const configPath = path.join(path.dirname(manifestPath), 'screenshot_config.json');
      if (await fs.pathExists(configPath)) {
        const config: ScreenshotConfig = await fs.readJSON(configPath);
        // 更新任务状态为错误
        await updateTaskState(manifest, config.taskId, 'error', { 
          error: (error as Error).message 
        });
      }
    } catch (err) {
      logger.error(`更新任务状态出错: ${(err as Error).message}`);
    }
    
    process.exit(1);
  }
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    logger.error('用法: node index.js <manifest.json路径>');
    process.exit(1);
  }
  
  const manifestPath = args[0];
  await processScreenshots(manifestPath);
}

// 执行主函数
main().catch(error => {
  logger.error(`程序出错: ${error.message}`);
  process.exit(1);
}); 