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

// Function to format timestamp in a readable format (HH:MM:SS)
function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  } else {
    return `${minutes}:${String(secs).padStart(2, '0')}`;
  }
}

// Function to convert WebVTT cues to Markdown content
function convertCuesToMarkdown(cues: WebVTTCue[]): string {
  let markdownContent = '# Transcript\n\n';
  let currentParagraph = '';
  let lastTimestamp = 0;
  
  // Time interval between timestamps in the markdown (in seconds)
  const timestampInterval = 60; // Add timestamp every minute
  
  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];
    
    // Extract English and Chinese text
    const lines = cue.text.split('\n');
    const enText = lines[0] || '';
    const zhText = lines[1] || '';
    
    // Skip empty cues
    if (!enText && !zhText) continue;
    
    // Check if we should add a timestamp
    const shouldAddTimestamp = 
      i === 0 || // First cue always gets a timestamp
      cue.startTime >= lastTimestamp + timestampInterval || // Time interval passed
      currentParagraph.length > 500; // Paragraph getting too long
    
    if (shouldAddTimestamp) {
      // If there's existing content in the current paragraph, add it to markdown
      if (currentParagraph) {
        markdownContent += currentParagraph + '\n\n';
      }
      
      // Start new paragraph with timestamp
      lastTimestamp = cue.startTime;
      currentParagraph = `## [${formatTimestamp(cue.startTime)}]\n\n`;
    }
    
    // Add English and Chinese text to the current paragraph
    if (enText) {
      currentParagraph += enText + ' ';
    }
    
    // Optionally add Chinese text in italics or as a separate paragraph
    if (zhText) {
      currentParagraph += `\n\n*${zhText}*\n\n`;
    }
  }
  
  // Add the last paragraph
  if (currentParagraph) {
    markdownContent += currentParagraph;
  }
  
  return markdownContent;
}

// Function to calculate word count
function calculateWordCount(text: string): number {
  // Remove markdown symbols and count words
  const cleanText = text
    .replace(/\#\s+\[\d+:\d+(?::\d+)?\]/g, '') // Remove timestamps
    .replace(/\*([^*]+)\*/g, '$1') // Remove asterisks
    .replace(/\n/g, ' '); // Replace newlines with spaces
  
  // Split by spaces and filter out empty strings
  const words = cleanText.split(/\s+/).filter(word => word.length > 0);
  return words.length;
}

// Function to estimate reading time in minutes
function estimateReadingTime(wordCount: number): number {
  // Average reading speed: 200-250 words per minute
  const wordsPerMinute = 225;
  return Math.max(1, Math.ceil(wordCount / wordsPerMinute));
}

// Function to convert VTT to Markdown
async function convertVttToMarkdown(manifestPath: string): Promise<void> {
  try {
    logger.log('Starting VTT to Markdown conversion...');
    logger.progress(0);
    
    // Read the manifest file
    const manifestContent = await fs.promises.readFile(manifestPath, 'utf-8');
    const manifest: Manifest = JSON.parse(manifestContent);
    
    // Find the task for extracting text
    const extractTextTask = manifest.tasks.find(task => task.id === 'extract_text');
    if (!extractTextTask) {
      throw new Error('Extract text task not found in manifest');
    }
    
    // Update task state to running
    extractTextTask.state = 'running' as TaskState;
    extractTextTask.startedAt = new Date().toISOString();
    extractTextTask.percent = 10;
    await fs.promises.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    logger.progress(10);
    
    // Find merged VTT file in the manifest
    const mergedVttFile = manifest.fileManifest.find(file => file.type === FILE_TYPES.TRANSCRIPT_MERGED_VTT);
    
    if (!mergedVttFile) {
      throw new Error('Merged VTT file not found in manifest');
    }
    
    // Get the base directory from the manifest path
    const baseDir = path.dirname(manifestPath);
    
    // Get the full path to the VTT file
    const mergedVttPath = path.join(baseDir, mergedVttFile.path);
    
    logger.log(`Reading merged VTT from: ${mergedVttPath}`);
    
    // Read and parse the VTT file
    const cues = await readVttFile(mergedVttPath);
    logger.progress(30);
    
    // Convert the cues to Markdown
    const markdownContent = convertCuesToMarkdown(cues);
    logger.progress(50);
    
    // Calculate word count and reading time
    const wordCount = calculateWordCount(markdownContent);
    const readingTime = estimateReadingTime(wordCount);
    logger.progress(60);
    
    // Create the output directory and write the Markdown file
    const markdownDir = path.join(baseDir, 'text');
    const markdownPath = path.join(markdownDir, 'content.md');
    
    await fs.promises.mkdir(markdownDir, { recursive: true });
    await fs.promises.writeFile(markdownPath, markdownContent);
    logger.progress(80);
    
    // Update the manifest
    let textContentFile = manifest.fileManifest.find(file => file.type === FILE_TYPES.TEXT_CONTENT_MD);
    
    if (!textContentFile) {
      // Create a new file entry if it doesn't exist
      textContentFile = {
        type: FILE_TYPES.TEXT_CONTENT_MD,
        version: 1,
        path: 'text/content.md',
        state: 'ready' as FileItemState,
        generatedBy: 'vtt-to-md',
        derivedFrom: [mergedVttFile.path],
        metadata: {
          wordCount,
          estimatedReadingTime: readingTime
        } as any // Use type assertion to avoid type errors
      };
      manifest.fileManifest.push(textContentFile);
    } else {
      // Update existing file entry
      textContentFile.state = 'ready' as FileItemState;
      textContentFile.version += 1;
      if (textContentFile.metadata === null) {
        textContentFile.metadata = {
          wordCount,
          estimatedReadingTime: readingTime
        } as any; // Use type assertion to avoid type errors
      } else {
        textContentFile.metadata = {
          ...textContentFile.metadata,
          wordCount,
          estimatedReadingTime: readingTime
        } as any; // Use type assertion to avoid type errors
      }
    }
    
    // Update task state to done
    extractTextTask.state = 'done' as TaskState;
    extractTextTask.updatedAt = new Date().toISOString();
    extractTextTask.percent = 100;
    
    // Update manifest.updatedAt
    manifest.updatedAt = new Date().toISOString();
    
    // Write the updated manifest
    await fs.promises.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    logger.progress(100);
    
    logger.log('VTT to Markdown conversion completed successfully');
    logger.log(`Word count: ${wordCount}, Estimated reading time: ${readingTime} minutes`);
  } catch (error) {
    logger.error(`Error in convertVttToMarkdown: ${(error as Error).message}`);
    
    try {
      // Update task state to error in the manifest
      const manifestContent = await fs.promises.readFile(manifestPath, 'utf-8');
      const manifest: Manifest = JSON.parse(manifestContent);
      
      const extractTextTask = manifest.tasks.find(task => task.id === 'extract_text');
      if (extractTextTask) {
        extractTextTask.state = 'error' as TaskState;
        extractTextTask.updatedAt = new Date().toISOString();
        extractTextTask.error = (error as Error).message;
        
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

// Main function
async function main() {
  try {
    const manifestPath = process.argv[2];
    
    if (!manifestPath) {
      throw new Error('Manifest path not provided. Usage: npm start -- /path/to/manifest.json');
    }
    
    await convertVttToMarkdown(manifestPath);
    process.exit(0);
  } catch (error) {
    logger.error((error as Error).message);
    process.exit(1);
  }
}

// Run the main function
main(); 