import { ManifestSchema } from '../../src/types/manifest';
import type { z } from 'zod';

export type Manifest = z.infer<typeof ManifestSchema>;
export type FileItem = Manifest['fileManifest'][0];
export type Task = Manifest['tasks'][0];

/**
 * Fetches a manifest.json file by its hashId
 */
export const fetchManifest = async (hashId: string): Promise<Manifest | null> => {
  try {
    const response = await fetch(`/api/manifest/${hashId}`);
    if (!response.ok) throw new Error(`Failed to fetch manifest: ${response.statusText}`);
    
    const data = await response.json();
    return data as Manifest;
  } catch (error) {
    console.error('Error fetching manifest:', error);
    return null;
  }
};

/**
 * Updates a specific file's state in the manifest
 */
export const updateFileState = async (
  hashId: string, 
  fileId: string, 
  state: FileItem['state'],
  metadata?: Record<string, any>
): Promise<boolean> => {
  try {
    const response = await fetch(`/api/manifest/${hashId}/file/${fileId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ state, metadata }),
    });
    
    if (!response.ok) throw new Error(`Failed to update file state: ${response.statusText}`);
    return true;
  } catch (error) {
    console.error('Error updating file state:', error);
    return false;
  }
};

/**
 * Updates a task's state in the manifest
 */
export const updateTaskState = async (
  hashId: string,
  taskId: string,
  state: Task['state'],
  context?: Record<string, any>
): Promise<boolean> => {
  try {
    const response = await fetch(`/api/manifest/${hashId}/task/${taskId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ state, context }),
    });
    
    if (!response.ok) throw new Error(`Failed to update task state: ${response.statusText}`);
    return true;
  } catch (error) {
    console.error('Error updating task state:', error);
    return false;
  }
};

/**
 * Adds a new task to the manifest
 */
export const addTask = async (
  hashId: string,
  task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string | null> => {
  try {
    const response = await fetch(`/api/manifest/${hashId}/task`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(task),
    });
    
    if (!response.ok) throw new Error(`Failed to add task: ${response.statusText}`);
    const data = await response.json();
    return data.taskId;
  } catch (error) {
    console.error('Error adding task:', error);
    return null;
  }
};

/**
 * Adds a new file entry to the manifest
 */
export const addFile = async (
  hashId: string,
  file: Omit<FileItem, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string | null> => {
  try {
    const response = await fetch(`/api/manifest/${hashId}/file`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(file),
    });
    
    if (!response.ok) throw new Error(`Failed to add file: ${response.statusText}`);
    const data = await response.json();
    return data.fileId;
  } catch (error) {
    console.error('Error adding file:', error);
    return null;
  }
};

/**
 * Gets the content of a specific file
 */
export const getFileContent = async (
  hashId: string,
  fileId: string
): Promise<string | null> => {
  try {
    const response = await fetch(`/api/content/${hashId}/${fileId}`);
    if (!response.ok) throw new Error(`Failed to fetch file content: ${response.statusText}`);
    
    const data = await response.text();
    return data;
  } catch (error) {
    console.error('Error fetching file content:', error);
    return null;
  }
};

/**
 * Purges a media file while keeping its metadata
 */
export const purgeMedia = async (hashId: string, reason: string): Promise<boolean> => {
  try {
    const response = await fetch(`/api/manifest/${hashId}/purge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason }),
    });
    
    if (!response.ok) throw new Error(`Failed to purge media: ${response.statusText}`);
    return true;
  } catch (error) {
    console.error('Error purging media:', error);
    return false;
  }
};

/**
 * Upgrades media quality
 */
export const upgradeMediaQuality = async (
  hashId: string, 
  targetQuality: string
): Promise<boolean> => {
  try {
    const response = await fetch(`/api/manifest/${hashId}/upgrade`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ targetQuality }),
    });
    
    if (!response.ok) throw new Error(`Failed to upgrade media: ${response.statusText}`);
    return true;
  } catch (error) {
    console.error('Error upgrading media:', error);
    return false;
  }
}; 