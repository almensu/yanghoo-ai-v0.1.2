import * as fs from 'fs';
import * as path from 'path';
import { Parser, WebVTTCue } from 'webvtt-parser';
import { Manifest, TaskState, FileItemState, FILE_TYPES } from '../../src/types/manifest';

interface Logger {
  log: (message: string) => void;
  error: (message: string) => void;
  progress: (percent: number) => void;
}

// Simple logger for the worker
const logger: Logger = {
  log: (message: string) => console.log(message),
  error: (message: string) => console.error(message),
  progress: (percent: number) => console.log(JSON.stringify({ percent }))
};

// Function to read and parse a VTT file
async function readVttFile(filePath: string): Promise<WebVTTCue[]> {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const parser = new Parser();
    const result = parser.parse(content);
    return result.cues;
  } catch (error) {
    logger.error(`Error reading VTT file: ${filePath}`);
    logger.error((error as Error).message);
    throw error;
  }
}

// Function to merge English and Chinese cues
function mergeCues(enCues: WebVTTCue[], zhCues: WebVTTCue[]): WebVTTCue[] {
  const mergedCues: WebVTTCue[] = [];
  const maxCues = Math.max(enCues.length, zhCues.length);
  
  // Create a timeline map for better alignment
  const timelineMap: Map<string, { en?: WebVTTCue; zh?: WebVTTCue }> = new Map();
  
  // Add English cues to the timeline map
  for (const cue of enCues) {
    const timeKey = `${cue.startTime.toFixed(3)}-${cue.endTime.toFixed(3)}`;
    const entry = timelineMap.get(timeKey) || {};
    entry.en = cue;
    timelineMap.set(timeKey, entry);
  }
  
  // Add Chinese cues to the timeline map or find the closest match
  for (const cue of zhCues) {
    const timeKey = `${cue.startTime.toFixed(3)}-${cue.endTime.toFixed(3)}`;
    
    if (timelineMap.has(timeKey)) {
      const entry = timelineMap.get(timeKey)!;
      entry.zh = cue;
    } else {
      // Find the closest matching English cue by time
      let closestTimeDiff = Number.MAX_VALUE;
      let closestTimeKey = '';
      
      for (const [key, entry] of timelineMap.entries()) {
        if (!entry.zh) {
          const [startStr, endStr] = key.split('-');
          const start = parseFloat(startStr);
          const end = parseFloat(endStr);
          
          const timeDiff = Math.abs(start - cue.startTime) + Math.abs(end - cue.endTime);
          if (timeDiff < closestTimeDiff && timeDiff < 1.0) { // Within 1 second threshold
            closestTimeDiff = timeDiff;
            closestTimeKey = key;
          }
        }
      }
      
      if (closestTimeKey) {
        const entry = timelineMap.get(closestTimeKey)!;
        entry.zh = cue;
      } else {
        // No close match found, create a new entry
        timelineMap.set(timeKey, { zh: cue });
      }
    }
  }
  
  // Convert the timeline map to merged cues
  for (const [timeKey, entry] of timelineMap.entries()) {
    const [startStr, endStr] = timeKey.split('-');
    const startTime = parseFloat(startStr);
    const endTime = parseFloat(endStr);
    
    const enText = entry.en ? entry.en.text : '';
    const zhText = entry.zh ? entry.zh.text : '';
    
    const mergedCue = new WebVTTCue();
    mergedCue.startTime = startTime;
    mergedCue.endTime = endTime;
    mergedCue.text = enText ? (zhText ? `${enText}\n${zhText}` : enText) : zhText;
    
    mergedCues.push(mergedCue);
  }
  
  // Sort cues by start time
  return mergedCues.sort((a, b) => a.startTime - b.startTime);
}

// Function to write merged cues to a VTT file
async function writeVttFile(filePath: string, cues: WebVTTCue[]): Promise<void> {
  try {
    let content = 'WEBVTT\n\n';
    
    for (const cue of cues) {
      const startTimeStr = formatTime(cue.startTime);
      const endTimeStr = formatTime(cue.endTime);
      
      content += `${startTimeStr} --> ${endTimeStr}\n${cue.text}\n\n`;
    }
    
    const dir = path.dirname(filePath);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(filePath, content);
  } catch (error) {
    logger.error(`Error writing VTT file: ${filePath}`);
    logger.error((error as Error).message);
    throw error;
  }
}

// Helper function to format time in VTT format
function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds - Math.floor(seconds)) * 1000);
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

// Main function to merge subtitles
async function mergeSubtitles(manifestPath: string): Promise<void> {
  try {
    logger.log('Starting subtitle merging process...');
    logger.progress(0);
    
    // Read the manifest file
    const manifestContent = await fs.promises.readFile(manifestPath, 'utf-8');
    const manifest: Manifest = JSON.parse(manifestContent);
    
    // Find the task for merging transcripts
    const mergeTask = manifest.tasks.find(task => task.id === 'merge_transcripts');
    if (!mergeTask) {
      throw new Error('Merge transcripts task not found in manifest');
    }
    
    // Update task state to running
    mergeTask.state = 'running' as TaskState;
    mergeTask.startedAt = new Date().toISOString();
    mergeTask.percent = 10;
    await fs.promises.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    logger.progress(10);
    
    // Find English and Chinese VTT files in the manifest
    const enVttFile = manifest.fileManifest.find(file => file.type === FILE_TYPES.TRANSCRIPT_EN_VTT);
    const zhVttFile = manifest.fileManifest.find(file => file.type === FILE_TYPES.TRANSCRIPT_ZH_VTT);
    
    if (!enVttFile || !zhVttFile) {
      throw new Error('English or Chinese VTT files not found in manifest');
    }
    
    // Get the base directory from the manifest path
    const baseDir = path.dirname(manifestPath);
    
    // Get the full paths to the VTT files
    const enVttPath = path.join(baseDir, enVttFile.path);
    const zhVttPath = path.join(baseDir, zhVttFile.path);
    
    logger.log(`Reading English VTT from: ${enVttPath}`);
    logger.log(`Reading Chinese VTT from: ${zhVttPath}`);
    
    // Read and parse the VTT files
    const enCues = await readVttFile(enVttPath);
    logger.progress(30);
    const zhCues = await readVttFile(zhVttPath);
    logger.progress(50);
    
    // Merge the cues
    const mergedCues = mergeCues(enCues, zhCues);
    logger.progress(70);
    
    // Create the merged VTT file
    const mergedVttPath = path.join(baseDir, 'transcripts', 'merged', 'transcript.vtt');
    await writeVttFile(mergedVttPath, mergedCues);
    logger.progress(90);
    
    // Update the manifest
    let mergedVttFile = manifest.fileManifest.find(file => file.type === FILE_TYPES.TRANSCRIPT_MERGED_VTT);
    
    if (!mergedVttFile) {
      // Create a new file entry if it doesn't exist
      mergedVttFile = {
        type: FILE_TYPES.TRANSCRIPT_MERGED_VTT,
        version: 1,
        path: 'transcripts/merged/transcript.vtt',
        state: 'ready' as FileItemState,
        generatedBy: 'merge-vtt',
        derivedFrom: [enVttFile.path, zhVttFile.path],
        metadata: null
      };
      manifest.fileManifest.push(mergedVttFile);
    } else {
      // Update existing file entry
      mergedVttFile.state = 'ready' as FileItemState;
      mergedVttFile.version += 1;
    }
    
    // Update task state to done
    mergeTask.state = 'done' as TaskState;
    mergeTask.updatedAt = new Date().toISOString();
    mergeTask.percent = 100;
    
    // Update manifest.updatedAt
    manifest.updatedAt = new Date().toISOString();
    
    // Write the updated manifest
    await fs.promises.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    logger.progress(100);
    
    logger.log('Subtitle merging completed successfully');
  } catch (error) {
    logger.error(`Error in mergeSubtitles: ${(error as Error).message}`);
    
    try {
      // Update task state to error in the manifest
      const manifestContent = await fs.promises.readFile(manifestPath, 'utf-8');
      const manifest: Manifest = JSON.parse(manifestContent);
      
      const mergeTask = manifest.tasks.find(task => task.id === 'merge_transcripts');
      if (mergeTask) {
        mergeTask.state = 'error' as TaskState;
        mergeTask.updatedAt = new Date().toISOString();
        mergeTask.error = (error as Error).message;
        
        // Update manifest.updatedAt
        manifest.updatedAt = new Date().toISOString();
        
        await fs.promises.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
      }
    } catch (e) {
      logger.error(`Failed to update manifest with error state: ${(e as Error).message}`);
    }
    
    throw error;
  }
}

// Check if this module is being run directly
if (require.main === module) {
  // Get the manifest path from command line arguments
  const manifestPath = process.argv[2];
  
  if (!manifestPath) {
    logger.error('Manifest path not provided. Usage: ts-node index.ts <manifest-path>');
    process.exit(1);
  }
  
  mergeSubtitles(manifestPath)
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      logger.error(`Error: ${error.message}`);
      process.exit(1);
    });
} 