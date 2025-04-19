import * as path from 'path';
import * as fs from 'fs';
import * as ffmpeg from 'fluent-ffmpeg';
import { Manifest, FILE_TYPES, TaskState, FileItemState } from '../../src/types/manifest';

// Logger utility for tracking progress and showing output
class Logger {
  log(message: string): void {
    console.log(message);
  }

  error(message: string): void {
    console.error(message);
  }

  progress(percent: number): void {
    console.log(JSON.stringify({ percent }));
  }
}

const logger = new Logger();

/**
 * Extract audio from video file using ffmpeg
 * @param manifestPath Path to the manifest file
 */
async function extractAudio(manifestPath: string): Promise<void> {
  try {
    logger.log('Starting audio extraction...');
    logger.progress(0);
    
    // Read the manifest file
    const manifestContent = await fs.promises.readFile(manifestPath, 'utf-8');
    const manifest: Manifest = JSON.parse(manifestContent);
    
    // Find the task for extracting audio
    const extractAudioTask = manifest.tasks.find(task => task.id === 'extract_audio');
    if (!extractAudioTask) {
      throw new Error('Extract audio task not found in manifest');
    }
    
    // Update task state to running
    extractAudioTask.state = 'running' as TaskState;
    extractAudioTask.startedAt = new Date().toISOString();
    extractAudioTask.percent = 5;
    await fs.promises.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    logger.progress(5);
    
    // Find original media file in the manifest
    const originalMediaFile = manifest.fileManifest.find(file => file.type === FILE_TYPES.ORIGINAL_MEDIA);
    
    if (!originalMediaFile) {
      throw new Error('Original media file not found in manifest');
    }
    
    if (originalMediaFile.state !== 'ready') {
      throw new Error('Original media file is not ready');
    }
    
    // Get the base directory from the manifest path
    const baseDir = path.dirname(manifestPath);
    
    // Get the full path to the video file
    const videoFilePath = path.join(baseDir, originalMediaFile.path);
    
    // Create audio directory if it doesn't exist
    const audioDir = path.join(baseDir, 'audio');
    await fs.promises.mkdir(audioDir, { recursive: true });
    
    // Set output audio file path
    const audioFilePath = path.join(audioDir, 'audio.wav');
    const relativeAudioPath = path.relative(baseDir, audioFilePath);
    
    logger.log(`Extracting audio from: ${videoFilePath}`);
    logger.log(`Output audio file: ${audioFilePath}`);
    
    // Extract audio using fluent-ffmpeg
    await new Promise<void>((resolve, reject) => {
      let lastProgress = 0;
      
      ffmpeg(videoFilePath)
        .output(audioFilePath)
        .audioFrequency(16000) // 16 kHz
        .audioChannels(1) // Mono
        .format('wav')
        .on('progress', (progress) => {
          // Only log progress every 10%
          const currentProgress = Math.floor(progress.percent);
          if (currentProgress >= lastProgress + 10) {
            lastProgress = currentProgress;
            const reportProgress = 10 + Math.floor(currentProgress * 0.8); // Scale to 10-90%
            logger.progress(reportProgress);
            extractAudioTask.percent = reportProgress;
          }
        })
        .on('end', () => {
          logger.log('Audio extraction completed');
          resolve();
        })
        .on('error', (err) => {
          logger.error(`Error extracting audio: ${err.message}`);
          reject(err);
        })
        .run();
    });
    
    // Calculate the size of the extracted audio file
    const stats = await fs.promises.stat(audioFilePath);
    const diskSize = stats.size;
    
    // Get audio duration
    const duration = await getAudioDuration(audioFilePath);
    
    // Update manifest with extracted audio file
    const extractedAudioFile = manifest.fileManifest.find(file => file.type === FILE_TYPES.EXTRACTED_AUDIO);
    
    if (extractedAudioFile) {
      // Update existing file entry
      extractedAudioFile.state = 'ready' as FileItemState;
      extractedAudioFile.path = relativeAudioPath;
      extractedAudioFile.version += 1;
      extractedAudioFile.metadata = {
        type: FILE_TYPES.EXTRACTED_AUDIO,
        duration,
        sampleRate: 16000,
        diskSize
      };
    } else {
      // Add new file entry
      manifest.fileManifest.push({
        type: FILE_TYPES.EXTRACTED_AUDIO,
        version: 1,
        path: relativeAudioPath,
        state: 'ready' as FileItemState,
        generatedBy: 'extract-audio',
        derivedFrom: [FILE_TYPES.ORIGINAL_MEDIA],
        metadata: {
          type: FILE_TYPES.EXTRACTED_AUDIO,
          duration,
          sampleRate: 16000,
          diskSize
        }
      });
    }
    
    // Update task state to done
    extractAudioTask.state = 'done' as TaskState;
    extractAudioTask.updatedAt = new Date().toISOString();
    extractAudioTask.percent = 100;
    
    // Update manifest file
    manifest.updatedAt = new Date().toISOString();
    await fs.promises.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    
    logger.progress(100);
    logger.log('Audio extraction and manifest update completed');
  } catch (error) {
    logger.error(`Failed to extract audio: ${error instanceof Error ? error.message : String(error)}`);
    
    try {
      // Read manifest again in case it was modified
      const manifestContent = await fs.promises.readFile(manifestPath, 'utf-8');
      const manifest: Manifest = JSON.parse(manifestContent);
      
      // Find the task and update its state to error
      const extractAudioTask = manifest.tasks.find(task => task.id === 'extract_audio');
      if (extractAudioTask) {
        extractAudioTask.state = 'error' as TaskState;
        extractAudioTask.error = error instanceof Error ? error.message : String(error);
        extractAudioTask.updatedAt = new Date().toISOString();
        
        // Update manifest file
        manifest.updatedAt = new Date().toISOString();
        await fs.promises.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
      }
    } catch (e) {
      logger.error(`Failed to update manifest with error: ${e instanceof Error ? e.message : String(e)}`);
    }
    
    process.exit(1);
  }
}

/**
 * Get audio duration using ffmpeg
 * @param audioFilePath Path to audio file
 * @returns Duration in seconds
 */
function getAudioDuration(audioFilePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(audioFilePath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }
      
      const duration = metadata.format.duration || 0;
      resolve(duration);
    });
  });
}

// Execute if this script is run directly
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length !== 1) {
    console.error('Usage: ts-node index.ts <path-to-manifest.json>');
    process.exit(1);
  }
  
  const manifestPath = args[0];
  extractAudio(manifestPath).catch(error => {
    console.error(`Unhandled error: ${error}`);
    process.exit(1);
  });
} 