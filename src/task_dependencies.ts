import { 
  Manifest, 
  FileItem, 
  Task, 
  TaskStateEnum, 
  FileItemStateEnum,
  FILE_TYPES
} from './types/manifest';

/**
 * Task dependency definition
 */
export interface TaskDependency {
  id: string;
  title: string;
  triggerCondition: (manifest: Manifest) => boolean;
  relatedOutput: string;
  createTask: (manifest: Manifest) => Partial<Task>;
}

/**
 * Map of task dependencies with their trigger conditions
 */
export const TASK_DEPENDENCIES: TaskDependency[] = [
  // 1. After fetch_info_json is done, trigger download_media
  {
    id: 'download_media',
    title: 'Download media',
    triggerCondition: (manifest: Manifest) => {
      // Check if fetch_info_json is done
      const fetchInfoTask = manifest.tasks.find(task => task.id === 'fetch_info_json');
      const infoJsonFile = manifest.fileManifest.find(file => file.type === FILE_TYPES.INFO_JSON);
      
      // Verify task is done and info.json file is ready
      return fetchInfoTask?.state === TaskStateEnum.enum.done && 
             infoJsonFile?.state === FileItemStateEnum.enum.ready &&
             // Ensure download_media doesn't already exist
             !manifest.tasks.some(task => task.id === 'download_media');
    },
    relatedOutput: FILE_TYPES.ORIGINAL_MEDIA,
    createTask: (manifest: Manifest) => {
      // Get quality from metadata if specified, or use "best" as default
      const quality = manifest.metadata.preferredQuality || 'best';
      
      return {
        id: 'download_media',
        title: `Download media (${quality})`,
        state: TaskStateEnum.enum.queued,
        percent: 0,
        relatedOutput: FILE_TYPES.ORIGINAL_MEDIA,
        context: { quality }
      };
    }
  },
  
  // 2. After original_media is ready, trigger extract_audio
  {
    id: 'extract_audio',
    title: 'Extract audio',
    triggerCondition: (manifest: Manifest) => {
      // Check if original_media is ready
      const originalMedia = manifest.fileManifest.find(file => file.type === FILE_TYPES.ORIGINAL_MEDIA);
      
      // Check if there's already a task for this
      const hasTask = manifest.tasks.some(task => task.id === 'extract_audio');
      
      // Ensure media is local (not iframe), ready, and no existing task
      return originalMedia?.state === FileItemStateEnum.enum.ready && 
             (originalMedia?.metadata as any)?.mediaType === 'local' &&
             !hasTask;
    },
    relatedOutput: FILE_TYPES.EXTRACTED_AUDIO,
    createTask: (manifest: Manifest) => {
      const originalMedia = manifest.fileManifest.find(file => file.type === FILE_TYPES.ORIGINAL_MEDIA);
      
      return {
        id: 'extract_audio',
        title: 'Extract audio',
        state: TaskStateEnum.enum.queued,
        percent: 0,
        relatedOutput: FILE_TYPES.EXTRACTED_AUDIO,
        context: {
          sourcePath: originalMedia?.path
        }
      };
    }
  },
  
  // 3. After extracted_audio is ready, trigger transcribe_whisperx
  {
    id: 'transcribe_whisperx',
    title: 'Transcribe audio with WhisperX',
    triggerCondition: (manifest: Manifest) => {
      // Check if extracted_audio is ready
      const extractedAudio = manifest.fileManifest.find(file => file.type === FILE_TYPES.EXTRACTED_AUDIO);
      
      // Check if there's already a task for this
      const hasTask = manifest.tasks.some(task => task.id === 'transcribe_whisperx');
      
      return extractedAudio?.state === FileItemStateEnum.enum.ready && !hasTask;
    },
    relatedOutput: FILE_TYPES.TRANSCRIPT_WHISPERX_JSON,
    createTask: (manifest: Manifest) => {
      // Use medium.en as default model unless specified in metadata
      const model = manifest.metadata.whisperxModel || 'medium.en';
      
      return {
        id: 'transcribe_whisperx',
        title: `Transcribe audio with WhisperX (${model})`,
        state: TaskStateEnum.enum.queued,
        percent: 0,
        relatedOutput: FILE_TYPES.TRANSCRIPT_WHISPERX_JSON,
        context: { model }
      };
    }
  },
  
  // 4. After both language VTTs are ready, trigger merge_transcripts
  {
    id: 'merge_transcripts',
    title: 'Merge transcripts',
    triggerCondition: (manifest: Manifest) => {
      // Check if both language VTTs are ready
      const enVtt = manifest.fileManifest.find(file => file.type === FILE_TYPES.TRANSCRIPT_EN_VTT);
      const zhVtt = manifest.fileManifest.find(file => file.type === FILE_TYPES.TRANSCRIPT_ZH_VTT);
      
      // Check if there's already a task for this
      const hasTask = manifest.tasks.some(task => task.id === 'merge_transcripts');
      
      return enVtt?.state === FileItemStateEnum.enum.ready &&
             zhVtt?.state === FileItemStateEnum.enum.ready && 
             !hasTask;
    },
    relatedOutput: FILE_TYPES.TRANSCRIPT_MERGED_VTT,
    createTask: (manifest: Manifest) => {
      return {
        id: 'merge_transcripts',
        title: 'Merge English and Chinese transcripts',
        state: TaskStateEnum.enum.queued,
        percent: 0,
        relatedOutput: FILE_TYPES.TRANSCRIPT_MERGED_VTT,
        context: null
      };
    }
  },
  
  // 5. After merged transcript is ready, trigger extract_text
  {
    id: 'extract_text',
    title: 'Extract text content',
    triggerCondition: (manifest: Manifest) => {
      // Check if merged transcript is ready
      const mergedVtt = manifest.fileManifest.find(file => file.type === FILE_TYPES.TRANSCRIPT_MERGED_VTT);
      
      // Check if there's already a task for this
      const hasTask = manifest.tasks.some(task => task.id === 'extract_text');
      
      return mergedVtt?.state === FileItemStateEnum.enum.ready && !hasTask;
    },
    relatedOutput: FILE_TYPES.TEXT_CONTENT_MD,
    createTask: (manifest: Manifest) => {
      return {
        id: 'extract_text',
        title: 'Convert transcript to markdown',
        state: TaskStateEnum.enum.queued,
        percent: 0,
        relatedOutput: FILE_TYPES.TEXT_CONTENT_MD,
        context: null
      };
    }
  },
  
  // 6. After text content is ready, trigger generate_rich_summary
  {
    id: 'generate_rich_summary',
    title: 'Generate rich summary',
    triggerCondition: (manifest: Manifest) => {
      // Check if text content is ready
      const textContent = manifest.fileManifest.find(file => file.type === FILE_TYPES.TEXT_CONTENT_MD);
      
      // Check if there's already a task for this
      const hasTask = manifest.tasks.some(task => task.id === 'generate_rich_summary');
      
      return textContent?.state === FileItemStateEnum.enum.ready && !hasTask;
    },
    relatedOutput: FILE_TYPES.SUMMARY_RICH_JSON,
    createTask: (manifest: Manifest) => {
      return {
        id: 'generate_rich_summary',
        title: 'Generate AI summary',
        state: TaskStateEnum.enum.queued,
        percent: 0,
        relatedOutput: FILE_TYPES.SUMMARY_RICH_JSON,
        context: null
      };
    }
  },
  
  // 7. After rich summary is ready, trigger extract_topics
  {
    id: 'extract_topics',
    title: 'Extract topic tags',
    triggerCondition: (manifest: Manifest) => {
      // Check if rich summary is ready
      const richSummary = manifest.fileManifest.find(file => file.type === FILE_TYPES.SUMMARY_RICH_JSON);
      
      // Check if there's already a task for this
      const hasTask = manifest.tasks.some(task => task.id === 'extract_topics');
      
      return richSummary?.state === FileItemStateEnum.enum.ready && !hasTask;
    },
    relatedOutput: FILE_TYPES.TOPIC_TAGS_JSON,
    createTask: (manifest: Manifest) => {
      return {
        id: 'extract_topics',
        title: 'Extract topic tags from summary',
        state: TaskStateEnum.enum.queued,
        percent: 0,
        relatedOutput: FILE_TYPES.TOPIC_TAGS_JSON,
        context: null
      };
    }
  },
  
  // 8. After summary_md is ready, trigger generate_speech_summary
  {
    id: 'generate_speech_summary',
    title: 'Generate speech summary',
    triggerCondition: (manifest: Manifest) => {
      // Check if summary_md is ready
      const summaryMd = manifest.fileManifest.find(file => file.type === FILE_TYPES.SUMMARY_MD);
      
      // Check if there's already a task for this
      const hasTask = manifest.tasks.some(task => task.id === 'generate_speech_summary');
      
      return summaryMd?.state === FileItemStateEnum.enum.ready && !hasTask;
    },
    relatedOutput: FILE_TYPES.SPEECH_SUMMARY_AUDIO,
    createTask: (manifest: Manifest) => {
      return {
        id: 'generate_speech_summary',
        title: 'Generate speech summary',
        state: TaskStateEnum.enum.queued,
        percent: 0,
        relatedOutput: FILE_TYPES.SPEECH_SUMMARY_AUDIO,
        context: null
      };
    }
  },
  
  // 9. After text_content_md is ready, trigger initialize_text_chat
  {
    id: 'initialize_text_chat',
    title: 'Initialize text chat',
    triggerCondition: (manifest: Manifest) => {
      // Check if text_content_md is ready
      const textContent = manifest.fileManifest.find(file => file.type === FILE_TYPES.TEXT_CONTENT_MD);
      
      // Check if there's already a task for this
      const hasTask = manifest.tasks.some(task => task.id === 'initialize_text_chat');
      
      return textContent?.state === FileItemStateEnum.enum.ready && !hasTask;
    },
    relatedOutput: FILE_TYPES.TEXT_CHAT_HISTORY_JSON,
    createTask: (manifest: Manifest) => {
      return {
        id: 'initialize_text_chat',
        title: 'Initialize AI text chat',
        state: TaskStateEnum.enum.queued,
        percent: 0,
        relatedOutput: FILE_TYPES.TEXT_CHAT_HISTORY_JSON,
        context: {
          model: 'deepseek-chat'
        }
      };
    }
  }
];

/**
 * Finds new tasks that should be created based on the current manifest state
 */
export function findTasksToTrigger(manifest: Manifest): Task[] {
  // Initialize array for new tasks
  const newTasks: Task[] = [];
  
  // Check each task dependency
  for (const dependency of TASK_DEPENDENCIES) {
    // Skip if condition not met
    if (!dependency.triggerCondition(manifest)) {
      continue;
    }
    
    // Create the task with all required fields
    const baseTask = dependency.createTask(manifest);
    const newTask: Task = {
      id: baseTask.id || dependency.id,
      title: baseTask.title || dependency.title,
      state: baseTask.state || TaskStateEnum.enum.queued,
      percent: baseTask.percent || 0,
      relatedOutput: baseTask.relatedOutput || dependency.relatedOutput,
      startedAt: null,
      updatedAt: null,
      error: null,
      context: baseTask.context || null
    };
    
    // Add the task to our list
    newTasks.push(newTask);
    
    // Also make sure the related output file exists in the manifest
    if (!manifest.fileManifest.some(file => file.type === newTask.relatedOutput)) {
      // Create fileItem placeholder
      const fileItem: FileItem = {
        type: newTask.relatedOutput,
        version: 1,
        path: getDefaultPathForFileType(newTask.relatedOutput),
        state: FileItemStateEnum.enum.queued,
        generatedBy: getDependencyToolName(dependency.id),
        derivedFrom: getDerivedFrom(dependency.id, manifest),
        metadata: null
      };
      
      // Track this file that needs to be added
      manifest.fileManifest.push(fileItem);
    }
  }
  
  return newTasks;
}

/**
 * Get the proper derived from values for a task
 */
function getDerivedFrom(taskId: string, manifest: Manifest): string[] {
  switch (taskId) {
    case 'extract_audio':
      return [getPathForType(manifest, FILE_TYPES.ORIGINAL_MEDIA) || ''];
    case 'transcribe_whisperx':
      return [getPathForType(manifest, FILE_TYPES.EXTRACTED_AUDIO) || ''];
    case 'merge_transcripts':
      return [
        getPathForType(manifest, FILE_TYPES.TRANSCRIPT_EN_VTT) || '',
        getPathForType(manifest, FILE_TYPES.TRANSCRIPT_ZH_VTT) || ''
      ];
    case 'extract_text':
      return [getPathForType(manifest, FILE_TYPES.TRANSCRIPT_MERGED_VTT) || ''];
    case 'generate_rich_summary':
      return [getPathForType(manifest, FILE_TYPES.TEXT_CONTENT_MD) || ''];
    case 'extract_topics':
      return [getPathForType(manifest, FILE_TYPES.SUMMARY_RICH_JSON) || ''];
    case 'generate_speech_summary':
      return [getPathForType(manifest, FILE_TYPES.SUMMARY_MD) || ''];
    case 'initialize_text_chat':
      return [getPathForType(manifest, FILE_TYPES.TEXT_CONTENT_MD) || ''];
    default:
      return [];
  }
}

/**
 * Get the path for a specific file type
 */
function getPathForType(manifest: Manifest, fileType: string): string {
  const file = manifest.fileManifest.find(f => f.type === fileType);
  return file?.path || getDefaultPathForFileType(fileType);
}

/**
 * Get the default tool name for a given task
 */
function getDependencyToolName(taskId: string): string {
  switch (taskId) {
    case 'download_media':
    case 'upgrade_media_quality':
      return 'yt-dlp@2024.12.04';
    case 'extract_audio':
      return 'ffmpeg@6.1';
    case 'transcribe_whisperx':
      return 'whisperx@1.0.0';
    case 'merge_transcripts':
      return 'merge-vtt@1.0.0';
    case 'extract_text':
      return 'vtt-to-md@1.0.0';
    case 'generate_rich_summary':
      return 'ai-summary@1.0.0';
    case 'extract_topics':
      return 'topic-extractor@1.0.0';
    case 'generate_speech_summary':
      return 'tts@1.0.0';
    case 'initialize_text_chat':
      return 'text-chat@1.0.0';
    default:
      return 'unknown@1.0.0';
  }
}

/**
 * Get the default path for a file type
 */
function getDefaultPathForFileType(fileType: string): string {
  switch (fileType) {
    case FILE_TYPES.ORIGINAL_MEDIA:
      return 'original/media.mp4';
    case FILE_TYPES.ORIGINAL_THUMBNAIL:
      return 'original/thumbnail.jpg';
    case FILE_TYPES.INFO_JSON:
      return 'original/info.json';
    case FILE_TYPES.TRANSCRIPT_EN_VTT:
      return 'transcripts/en.vtt';
    case FILE_TYPES.TRANSCRIPT_ZH_VTT:
      return 'transcripts/zh.vtt';
    case FILE_TYPES.TRANSCRIPT_WHISPERX_JSON:
      return 'transcripts/whisperx/transcript.json';
    case FILE_TYPES.TRANSCRIPT_MERGED_VTT:
      return 'transcripts/merged.vtt';
    case FILE_TYPES.TEXT_CONTENT_MD:
      return 'transcripts/content.md';
    case FILE_TYPES.SUMMARY_RICH_JSON:
      return 'summaries/rich_summary.json';
    case FILE_TYPES.SUMMARY_MD:
      return 'summaries/summary.md';
    case FILE_TYPES.EXTRACTED_AUDIO:
      return 'audio/audio.wav';
    case FILE_TYPES.SPEECH_SUMMARY_AUDIO:
      return 'audio/summary.mp3';
    case FILE_TYPES.TOPIC_TAGS_JSON:
      return 'metadata/topics.json';
    case FILE_TYPES.TEXT_CHAT_HISTORY_JSON:
      return 'chats/text_chat.json';
    case FILE_TYPES.IMAGE_CHAT_HISTORY_JSON:
      return 'chats/image_chat.json';
    case FILE_TYPES.CHAT_COLLECTION_JSON:
      return 'chats/collection.json';
    case FILE_TYPES.SCREENSHOT_COLLECTION_JSON:
      return 'screenshots/collection.json';
    case FILE_TYPES.ARTICLE_MD:
      return 'notes/article.md';
    default:
      return `${fileType}.data`;
  }
}

/**
 * Check manifest for task dependencies and queue any new tasks that should be triggered
 */
export function updateTaskDependencies(manifest: Manifest): Manifest {
  // Find tasks to trigger
  const newTasks = findTasksToTrigger(manifest);
  
  // If no new tasks, return unchanged manifest
  if (newTasks.length === 0) {
    return manifest;
  }
  
  // Create a new manifest with added tasks
  const updatedManifest = {
    ...manifest,
    tasks: [...manifest.tasks, ...newTasks],
    updatedAt: new Date().toISOString()
  };
  
  console.log(`Added ${newTasks.length} new tasks: ${newTasks.map(t => t.id).join(', ')}`);
  
  return updatedManifest;
}

/**
 * Create a manual task for upgrading media quality
 */
export function createUpgradeMediaQualityTask(
  manifest: Manifest, 
  targetQuality: 'best' | '1080p' | '720p' | '360p'
): Task {
  const originalMedia = manifest.fileManifest.find(f => f.type === FILE_TYPES.ORIGINAL_MEDIA);
  const previousQuality = (originalMedia?.metadata as any)?.quality || 'unknown';
  
  return {
    id: 'upgrade_media_quality',
    title: `Upgrade video to ${targetQuality}`,
    state: TaskStateEnum.enum.queued,
    percent: 0,
    relatedOutput: FILE_TYPES.ORIGINAL_MEDIA,
    startedAt: null,
    updatedAt: null,
    error: null,
    context: {
      previousQuality,
      targetQuality,
      preserveProcessing: true
    }
  };
}

/**
 * Create a manual task for purging media
 */
export function createPurgeMediaTask(
  manifest: Manifest,
  options: {
    keepResults?: boolean;
    keepThumbnail?: boolean;
    reason: string;
  }
): Task {
  const title = options.keepResults 
    ? 'Delete original media but keep processing results'
    : 'Delete all content and processing results';
  
  return {
    id: 'purge_media',
    title,
    state: TaskStateEnum.enum.queued,
    percent: 0,
    relatedOutput: FILE_TYPES.ORIGINAL_MEDIA,
    startedAt: null,
    updatedAt: null,
    error: null,
    context: {
      keepResults: options.keepResults || false,
      keepThumbnail: options.keepThumbnail || false,
      reason: options.reason
    }
  };
}

/**
 * Create a manual task for extracting screenshots
 */
export function createExtractScreenshotsTask(
  manifest: Manifest,
  options: {
    type: 'interval' | 'uniform' | 'keyframe' | 'subtitle';
    interval?: number; // For interval type (seconds)
    count?: number;    // For uniform type (number of screenshots)
  }
): Task {
  let title = 'Extract screenshots';
  if (options.type === 'interval' && options.interval) {
    title = `Extract screenshots every ${options.interval} seconds`;
  } else if (options.type === 'uniform' && options.count) {
    title = `Extract ${options.count} uniformly distributed screenshots`;
  } else if (options.type === 'keyframe') {
    title = 'Extract screenshots from key frames';
  } else if (options.type === 'subtitle') {
    title = 'Extract screenshots at subtitle timestamps';
  }
  
  return {
    id: 'extract_screenshots',
    title,
    state: TaskStateEnum.enum.queued,
    percent: 0,
    relatedOutput: FILE_TYPES.SCREENSHOT_COLLECTION_JSON,
    startedAt: null,
    updatedAt: null,
    error: null,
    context: {
      screenshotType: options.type,
      params: {
        interval: options.interval || 60,
        count: options.count || 10
      }
    }
  };
}

/**
 * Create a task for initializing image chat for a screenshot
 */
export function createInitializeImageChatTask(
  manifest: Manifest,
  screenshotPath: string
): Task {
  return {
    id: 'initialize_image_chat',
    title: 'Initialize AI image chat',
    state: TaskStateEnum.enum.queued,
    percent: 0,
    relatedOutput: FILE_TYPES.IMAGE_CHAT_HISTORY_JSON,
    startedAt: null,
    updatedAt: null,
    error: null,
    context: {
      screenshotPath,
      model: 'deepseek-chat'
    }
  };
}

/**
 * Create a task for managing all chats (creating chat_collection_json)
 */
export function createManageChatsTask(manifest: Manifest): Task {
  return {
    id: 'manage_chats',
    title: 'Organize chat collection',
    state: TaskStateEnum.enum.queued,
    percent: 0,
    relatedOutput: FILE_TYPES.CHAT_COLLECTION_JSON,
    startedAt: null,
    updatedAt: null,
    error: null,
    context: null
  };
} 