import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { Manifest, ManifestSchema, TaskStateEnum, FileItemStateEnum, FileItemState, Task } from './types/manifest';
import { updateLibrary } from './updateLibrary';
import { updateTaskDependencies } from './task_dependencies';

// Map of task IDs to worker paths and command configurations
const TASK_WORKER_MAP: Record<string, { 
  command: string; 
  args: (task: Task, hashId: string) => string[];
  cwd?: string;
}> = {
  'fetch_info_json': {
    command: 'python3',
    args: (task, hashId) => ['workers/yt-dlp/fetch_info.py', hashId],
  },
  'download_media': {
    command: 'python3',
    args: (task, hashId) => {
      const quality = task.context?.quality || 'best';
      return ['workers/yt-dlp/download_media.py', hashId, '--quality', quality];
    },
  },
  'extract_audio': {
    command: 'ts-node',
    args: (task, hashId) => ['workers/extract-audio/index.ts', hashId],
  },
  'transcribe_whisperx': {
    command: 'python3',
    args: (task, hashId) => {
      const model = task.context?.model || 'medium.en';
      return ['workers/whisperx/transcribe.py', hashId, '--model', model];
    },
  },
  'merge_transcripts': {
    command: 'ts-node',
    args: (task, hashId) => ['workers/merge-vtt/index.ts', hashId],
  },
  'extract_text': {
    command: 'ts-node',
    args: (task, hashId) => ['workers/vtt-to-md/index.ts', hashId],
  },
  'generate_rich_summary': {
    command: 'ts-node',
    args: (task, hashId) => ['workers/ai-summary/index.ts', hashId],
  },
  'extract_topics': {
    command: 'ts-node',
    args: (task, hashId) => ['workers/topic-extractor/index.ts', hashId],
  },
  'initialize_text_chat': {
    command: 'ts-node',
    args: (task, hashId) => ['workers/text-chat/index.ts', hashId],
  },
};

/**
 * Reads a manifest file from the specified hashId
 */
async function readManifest(hashId: string): Promise<Manifest> {
  const manifestPath = path.join(process.cwd(), 'storage', 'content-studio', hashId, 'manifest.json');
  
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifest not found for hashId: ${hashId}`);
  }
  
  const manifestData = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  
  try {
    return ManifestSchema.parse(manifestData);
  } catch (error) {
    console.error(`Invalid manifest structure for ${hashId}:`, error);
    throw new Error(`Invalid manifest structure for ${hashId}`);
  }
}

/**
 * Writes an updated manifest back to disk
 */
async function writeManifest(manifest: Manifest): Promise<void> {
  const manifestPath = path.join(
    process.cwd(), 
    'storage', 
    'content-studio', 
    manifest.hashId, 
    'manifest.json'
  );
  
  // Update the updatedAt timestamp
  manifest.updatedAt = new Date().toISOString();
  
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

/**
 * Updates a task in the manifest and related file item states
 */
function updateTask(
  manifest: Manifest, 
  taskId: string, 
  updates: Partial<Task>,
  fileItemUpdates?: { type: string; updates: { state?: FileItemState; [key: string]: any } }
): Manifest {
  const updatedManifest = { ...manifest };
  const timestamp = new Date().toISOString();
  
  // Update the task
  updatedManifest.tasks = updatedManifest.tasks.map(task => {
    if (task.id === taskId) {
      return { 
        ...task, 
        ...updates,
        updatedAt: timestamp 
      };
    }
    return task;
  });
  
  // Update related file item if specified
  if (fileItemUpdates) {
    updatedManifest.fileManifest = updatedManifest.fileManifest.map(item => {
      if (item.type === fileItemUpdates.type) {
        return { 
          ...item, 
          ...fileItemUpdates.updates 
        };
      }
      return item;
    });
  }
  
  return updatedManifest;
}

/**
 * Executes a worker for a specific task and updates the manifest based on progress
 */
async function executeWorker(
  manifest: Manifest, 
  task: Task
): Promise<void> {
  const { hashId } = manifest;
  const { id: taskId, relatedOutput } = task;
  
  // Get worker configuration
  const workerConfig = TASK_WORKER_MAP[taskId];
  if (!workerConfig) {
    console.error(`No worker configuration found for task ${taskId}`);
    
    // Update task to error state
    const updatedManifest = updateTask(
      manifest, 
      taskId, 
      { 
        state: TaskStateEnum.enum.error, 
        error: `No worker configuration found for task ${taskId}` 
      }
    );
    
    await writeManifest(updatedManifest);
    await updateLibrary();
    return;
  }
  
  // Update task to running state
  let updatedManifest = updateTask(
    manifest, 
    taskId, 
    { 
      state: TaskStateEnum.enum.running, 
      startedAt: new Date().toISOString(),
      percent: 0 
    },
    // Update related file output to processing state if it exists
    relatedOutput ? {
      type: relatedOutput,
      updates: { state: FileItemStateEnum.enum.processing }
    } : undefined
  );
  
  await writeManifest(updatedManifest);
  
  return new Promise((resolve, reject) => {
    // Spawn worker process
    const { command, args: getArgs, cwd } = workerConfig;
    const args = getArgs(task, hashId);
    
    console.log(`Executing worker: ${command} ${args.join(' ')}`);
    
    const worker = spawn(command, args, { 
      cwd: cwd || process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let stdoutBuffer = '';
    let stderrBuffer = '';
    
    // Collect stdout
    worker.stdout.on('data', (data) => {
      const chunk = data.toString();
      stdoutBuffer += chunk;
      
      // Look for JSON progress updates
      try {
        // Match JSON objects in the output
        const jsonMatches = chunk.match(/({.*})/g);
        
        if (jsonMatches) {
          for (const jsonStr of jsonMatches) {
            const progressData = JSON.parse(jsonStr);
            
            // Check if it contains percent
            if (typeof progressData.percent === 'number') {
              // Update task percent
              updatedManifest = updateTask(
                updatedManifest, 
                taskId, 
                { percent: progressData.percent }
              );
              
              // Write manifest updates periodically (every 10% or when data includes 'write')
              if (progressData.percent % 10 === 0 || progressData.write) {
                writeManifest(updatedManifest).catch(console.error);
              }
            }
          }
        }
      } catch (error) {
        // Ignore parsing errors for normal log output
      }
      
      console.log(`[${taskId}] ${chunk}`);
    });
    
    // Collect stderr
    worker.stderr.on('data', (data) => {
      const chunk = data.toString();
      stderrBuffer += chunk;
      console.error(`[${taskId}] Error: ${chunk}`);
    });
    
    // Handle process completion
    worker.on('close', async (code) => {
      console.log(`Worker for task ${taskId} exited with code ${code}`);
      
      if (code === 0) {
        // Task completed successfully
        updatedManifest = updateTask(
          updatedManifest, 
          taskId, 
          { 
            state: TaskStateEnum.enum.done, 
            percent: 100,
            error: null
          },
          // Update related file output to ready state if it exists
          relatedOutput ? {
            type: relatedOutput,
            updates: { state: FileItemStateEnum.enum.ready }
          } : undefined
        );
      } else {
        // Task failed
        updatedManifest = updateTask(
          updatedManifest, 
          taskId, 
          { 
            state: TaskStateEnum.enum.error, 
            error: stderrBuffer || `Worker exited with code ${code}`
          },
          // Update related file output to error state if it exists
          relatedOutput ? {
            type: relatedOutput,
            updates: { state: FileItemStateEnum.enum.error }
          } : undefined
        );
      }
      
      // Check for new tasks to trigger based on dependencies
      if (code === 0) {
        updatedManifest = updateTaskDependencies(updatedManifest);
      }
      
      // Write final manifest update
      await writeManifest(updatedManifest);
      
      // Update library.json
      await updateLibrary();
      
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Worker failed with code ${code}`));
      }
    });
    
    // Handle process errors
    worker.on('error', async (error) => {
      console.error(`Error executing worker for task ${taskId}:`, error);
      
      updatedManifest = updateTask(
        updatedManifest, 
        taskId, 
        { 
          state: TaskStateEnum.enum.error, 
          error: error.message
        },
        // Update related file output to error state if it exists
        relatedOutput ? {
          type: relatedOutput,
          updates: { state: FileItemStateEnum.enum.error }
        } : undefined
      );
      
      // No dependency updates on error
      
      await writeManifest(updatedManifest);
      await updateLibrary();
      
      reject(error);
    });
  });
}

/**
 * Find and run the next queued task for a specific hashId
 */
export async function runNextTask(hashId: string): Promise<boolean> {
  try {
    // Read the manifest
    const manifest = await readManifest(hashId);
    
    // Check for and add new tasks based on dependencies
    const updatedManifest = updateTaskDependencies(manifest);
    
    // Write back the manifest if it was updated
    if (updatedManifest !== manifest) {
      await writeManifest(updatedManifest);
    }
    
    // Find the first queued task
    const queuedTask = updatedManifest.tasks.find(task => task.state === TaskStateEnum.enum.queued);
    
    if (!queuedTask) {
      console.log(`No queued tasks found for ${hashId}`);
      return false;
    }
    
    console.log(`Found queued task: ${queuedTask.id} for ${hashId}`);
    
    // Execute the worker for this task
    await executeWorker(updatedManifest, queuedTask);
    
    return true;
  } catch (error) {
    console.error(`Error running next task for ${hashId}:`, error);
    return false;
  }
}

/**
 * Find and run all queued tasks for a specific hashId (one at a time)
 */
export async function runAllTasks(hashId: string): Promise<void> {
  let hasMoreTasks = true;
  
  while (hasMoreTasks) {
    hasMoreTasks = await runNextTask(hashId);
  }
  
  console.log(`Completed all available tasks for ${hashId}`);
}

/**
 * Run tasks for all content buckets in the library
 */
export async function runAllBucketTasks(): Promise<void> {
  const basePath = path.join(process.cwd(), 'storage', 'content-studio');
  
  if (!fs.existsSync(basePath)) {
    console.error('Content studio directory not found');
    return;
  }
  
  // Get all directories in the content-studio folder
  const directories = fs.readdirSync(basePath, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory() && dirent.name !== 'temp')
    .map(dirent => dirent.name);
  
  // Process each directory with a manifest.json
  for (const dir of directories) {
    const manifestPath = path.join(basePath, dir, 'manifest.json');
    
    if (fs.existsSync(manifestPath)) {
      console.log(`Processing tasks for bucket: ${dir}`);
      await runAllTasks(dir);
    }
  }
  
  console.log('Completed processing all buckets');
}

// Command-line interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];
  const hashId = args[1];
  
  if (command === 'run' && hashId) {
    console.log(`Running tasks for bucket ${hashId}`);
    runAllTasks(hashId)
      .then(() => console.log('Done'))
      .catch(console.error);
  } else if (command === 'next' && hashId) {
    console.log(`Running next task for bucket ${hashId}`);
    runNextTask(hashId)
      .then(result => console.log(result ? 'Task executed' : 'No tasks to run'))
      .catch(console.error);
  } else if (command === 'all') {
    console.log('Running tasks for all buckets');
    runAllBucketTasks()
      .then(() => console.log('All tasks completed'))
      .catch(console.error);
  } else {
    console.log('Usage:');
    console.log('  ts-node src/run_task.ts run <hashId> - Run all tasks for a specific bucket');
    console.log('  ts-node src/run_task.ts next <hashId> - Run next task for a specific bucket');
    console.log('  ts-node src/run_task.ts all - Run tasks for all buckets');
  }
} 