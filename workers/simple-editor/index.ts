import fs from 'fs-extra';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import { parseManifest, updateTaskState, updateManifest } from '../../src/utils/manifest';
import { createLogger } from '../../src/utils/logger';

// 创建日志记录器
const logger = createLogger('simple-editor');

// 编辑时间段类型
interface Segment {
  start: number;      // 开始时间（秒）
  end: number;        // 结束时间（秒）
  label?: string;     // 片段标签（选填）
  description?: string; // 片段描述（选填）
}

// 编辑任务配置
interface EditConfig {
  segments: Segment[];
  outputType: 'video' | 'timeline'; // 输出类型：生成视频或时间轴引用
  outputQuality?: string;          // 输出视频质量（如有）
  outputFormat?: string;           // 输出格式 (默认 mp4)
  keepOriginalAudio?: boolean;     // 是否保留原始音频
  taskId: string;                  // 相关任务ID
}

/**
 * 解析VTT文件并提取所有时间信息
 */
async function parseVTT(vttPath: string): Promise<{startTimes: number[], endTimes: number[], texts: string[]}> {
  const content = await fs.readFile(vttPath, 'utf-8');
  const lines = content.split('\n');
  
  const startTimes: number[] = [];
  const endTimes: number[] = [];
  const texts: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // 查找时间轴行 (格式: 00:00:10.500 --> 00:00:15.000)
    if (line.includes(' --> ')) {
      const [startTime, endTime] = line.split(' --> ');
      
      // 转换时间格式为秒
      startTimes.push(convertTimeToSeconds(startTime));
      endTimes.push(convertTimeToSeconds(endTime));
      
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
  
  return { startTimes, endTimes, texts };
}

/**
 * 将时间字符串转换为秒
 * 支持格式: 00:00:10.500 或 00:10.500
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
 * 提取视频片段
 */
async function extractVideoSegment(
  inputPath: string, 
  outputPath: string, 
  segment: Segment, 
  outputFormat: string = 'mp4',
  keepAudio: boolean = true
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    try {
      const command = ffmpeg(inputPath)
        .setStartTime(segment.start)
        .setDuration(segment.end - segment.start);
      
      // 是否保留音频
      if (!keepAudio) {
        command.noAudio();
      }
      
      // 设置输出格式
      command.format(outputFormat);
      
      // 输出进度
      command.on('progress', (progress) => {
        logger.log(`处理进度: ${Math.round(progress.percent || 0)}%`);
        console.log(JSON.stringify({ percent: Math.round(progress.percent || 0) }));
      });
      
      // 处理完成
      command.on('end', () => {
        logger.log(`片段提取完成: ${outputPath}`);
        resolve(true);
      });
      
      // 处理错误
      command.on('error', (err) => {
        logger.error(`提取片段出错: ${err.message}`);
        reject(err);
      });
      
      // 开始处理
      command.save(outputPath);
    } catch (error) {
      logger.error(`创建FFmpeg命令出错: ${(error as Error).message}`);
      reject(error);
    }
  });
}

/**
 * 合并视频片段
 */
async function mergeVideoSegments(
  segmentPaths: string[], 
  outputPath: string, 
  outputFormat: string = 'mp4'
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    try {
      // 创建临时文件列表
      const listFilePath = path.join(path.dirname(outputPath), 'segments_list.txt');
      const listContent = segmentPaths.map(p => `file '${p}'`).join('\n');
      fs.writeFileSync(listFilePath, listContent);
      
      // 使用FFmpeg的concat demuxer合并视频
      const command = ffmpeg()
        .input(listFilePath)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .outputOptions(['-c', 'copy'])
        .format(outputFormat);
      
      // 输出进度
      command.on('progress', (progress) => {
        logger.log(`合并进度: ${Math.round(progress.percent || 0)}%`);
        console.log(JSON.stringify({ percent: Math.round(progress.percent || 0) }));
      });
      
      // 处理完成
      command.on('end', () => {
        logger.log(`视频合并完成: ${outputPath}`);
        // 清理临时文件
        fs.unlinkSync(listFilePath);
        resolve(true);
      });
      
      // 处理错误
      command.on('error', (err) => {
        logger.error(`合并视频出错: ${err.message}`);
        reject(err);
      });
      
      // 开始处理
      command.save(outputPath);
    } catch (error) {
      logger.error(`创建FFmpeg命令出错: ${(error as Error).message}`);
      reject(error);
    }
  });
}

/**
 * 生成时间轴引用文件
 */
async function generateTimelineReference(
  segments: Segment[],
  outputPath: string,
  videoTitle: string
): Promise<boolean> {
  try {
    const timelineData = {
      title: `${videoTitle} - 时间轴引用`,
      created: new Date().toISOString(),
      segments: segments.map(segment => ({
        start: segment.start,
        end: segment.end,
        label: segment.label || `片段 ${Math.floor(segment.start / 60)}:${(segment.start % 60).toString().padStart(2, '0')} - ${Math.floor(segment.end / 60)}:${(segment.end % 60).toString().padStart(2, '0')}`,
        description: segment.description || ''
      }))
    };
    
    await fs.writeJSON(outputPath, timelineData, { spaces: 2 });
    logger.log(`时间轴引用已生成: ${outputPath}`);
    return true;
  } catch (error) {
    logger.error(`生成时间轴引用出错: ${(error as Error).message}`);
    return false;
  }
}

/**
 * 主处理函数
 */
async function processVideoEdit(manifestPath: string): Promise<void> {
  try {
    logger.log('开始视频编辑处理...');
    const manifest = await parseManifest(manifestPath);
    
    // 检查是否存在配置文件
    const configPath = path.join(path.dirname(manifestPath), 'edit_config.json');
    if (!await fs.pathExists(configPath)) {
      throw new Error('缺少编辑配置文件: edit_config.json');
    }
    
    // 读取配置
    const config: EditConfig = await fs.readJSON(configPath);
    
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
    const outputDir = path.join(baseDir, 'edited');
    await fs.ensureDir(outputDir);
    
    // 处理配置中的每个片段
    if (config.outputType === 'video') {
      // 视频输出
      const tempSegments: string[] = [];
      let totalSegments = config.segments.length;
      
      for (let i = 0; i < config.segments.length; i++) {
        const segment = config.segments[i];
        const segmentPath = path.join(outputDir, `temp_segment_${i}.${config.outputFormat || 'mp4'}`);
        
        // 更新进度
        const segmentProgressStart = (i / totalSegments) * 100;
        const segmentProgressEnd = ((i + 1) / totalSegments) * 100;
        await updateTaskState(manifest, config.taskId, 'running', { 
          percent: Math.round(segmentProgressStart) 
        });
        
        // 提取片段
        await extractVideoSegment(
          videoPath, 
          segmentPath, 
          segment, 
          config.outputFormat || 'mp4',
          config.keepOriginalAudio !== false
        );
        
        tempSegments.push(segmentPath);
        
        // 更新进度
        await updateTaskState(manifest, config.taskId, 'running', { 
          percent: Math.round(segmentProgressEnd) 
        });
      }
      
      // 合并所有片段
      if (tempSegments.length > 0) {
        const outputPath = path.join(outputDir, `edited_video.${config.outputFormat || 'mp4'}`);
        
        // 更新进度
        await updateTaskState(manifest, config.taskId, 'running', { 
          percent: 90,
          message: '正在合并片段...'
        });
        
        // 合并片段
        await mergeVideoSegments(tempSegments, outputPath, config.outputFormat || 'mp4');
        
        // 清理临时文件
        for (const tempPath of tempSegments) {
          await fs.remove(tempPath);
        }
        
        // 更新任务状态
        await updateTaskState(manifest, config.taskId, 'running', { percent: 95 });
        
        // 添加文件到manifest
        const relativeOutputPath = path.relative(baseDir, outputPath);
        const fileId = `edited_video_${Date.now()}`;
        
        manifest.fileManifest.push({
          type: 'edited_video',
          version: 1,
          path: relativeOutputPath,
          state: 'ready',
          generatedBy: config.taskId,
          derivedFrom: [videoFile.path],
          metadata: {
            segments: config.segments,
            outputFormat: config.outputFormat || 'mp4',
            outputQuality: config.outputQuality,
            diskSize: (await fs.stat(outputPath)).size
          }
        });
        
        // 更新manifest
        await updateManifest(manifest);
        
        // 完成任务
        await updateTaskState(manifest, config.taskId, 'done', { 
          percent: 100,
          outputFile: fileId
        });
        
        logger.log('视频编辑处理完成!');
      }
    } else {
      // 生成时间轴引用
      const outputPath = path.join(outputDir, 'timeline_reference.json');
      
      // 更新进度
      await updateTaskState(manifest, config.taskId, 'running', { percent: 50 });
      
      // 生成时间轴引用
      const videoTitle = manifest.metadata?.title || 'Untitled Video';
      await generateTimelineReference(config.segments, outputPath, videoTitle);
      
      // 添加文件到manifest
      const relativeOutputPath = path.relative(baseDir, outputPath);
      const fileId = `timeline_reference_${Date.now()}`;
      
      manifest.fileManifest.push({
        type: 'timeline_reference_json',
        version: 1,
        path: relativeOutputPath,
        state: 'ready',
        generatedBy: config.taskId,
        derivedFrom: [videoFile.path],
        metadata: {
          segments: config.segments
        }
      });
      
      // 更新manifest
      await updateManifest(manifest);
      
      // 完成任务
      await updateTaskState(manifest, config.taskId, 'done', { 
        percent: 100,
        outputFile: fileId
      });
      
      logger.log('时间轴引用生成完成!');
    }
  } catch (error) {
    logger.error(`视频编辑处理出错: ${(error as Error).message}`);
    
    // 获取manifest和任务ID
    try {
      const manifest = await parseManifest(manifestPath);
      const configPath = path.join(path.dirname(manifestPath), 'edit_config.json');
      if (await fs.pathExists(configPath)) {
        const config: EditConfig = await fs.readJSON(configPath);
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
  await processVideoEdit(manifestPath);
}

// 执行主函数
main().catch(error => {
  logger.error(`程序出错: ${error.message}`);
  process.exit(1);
}); 