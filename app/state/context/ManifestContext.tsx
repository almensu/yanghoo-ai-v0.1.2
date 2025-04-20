import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import {
  Manifest,
  FileItem,
  Task,
  fetchManifest,
  updateFileState,
  updateTaskState,
} from '../../api/manifestApi';

type ManifestContextType = {
  manifest: Manifest | null;
  isLoading: boolean;
  error: string | null;
  files: FileItem[];
  tasks: Task[];
  refreshManifest: () => Promise<void>;
  updateFile: (fileId: string, state: FileItem['state'], metadata?: Record<string, any>) => Promise<boolean>;
  updateTask: (taskId: string, state: Task['state'], context?: Record<string, any>) => Promise<boolean>;
  getFileById: (fileId: string) => FileItem | undefined;
  getFilesByType: (type: string) => FileItem[];
  getTaskById: (taskId: string) => Task | undefined;
  getTasksByType: (type: string) => Task[];
  getActiveTask: () => Task | undefined;
};

const ManifestContext = createContext<ManifestContextType | undefined>(undefined);

export const ManifestProvider: React.FC<{
  children: React.ReactNode;
  hashId: string;
}> = ({ children, hashId }) => {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch initial manifest data
  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await fetchManifest(hashId);
      setManifest(data);
    } catch (err) {
      setError(`Failed to load manifest: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Load manifest when hashId changes
  useEffect(() => {
    fetchData();
  }, [hashId]);

  // Refresh manifest data
  const refreshManifest = async () => {
    await fetchData();
  };

  // Update file state
  const updateFile = async (
    fileId: string,
    state: FileItem['state'],
    metadata?: Record<string, any>
  ): Promise<boolean> => {
    try {
      const success = await updateFileState(hashId, fileId, state, metadata);
      if (success) {
        await refreshManifest();
      }
      return success;
    } catch (err) {
      setError(`Failed to update file: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  };

  // Update task state
  const updateTask = async (
    taskId: string,
    state: Task['state'],
    context?: Record<string, any>
  ): Promise<boolean> => {
    try {
      const success = await updateTaskState(hashId, taskId, state, context);
      if (success) {
        await refreshManifest();
      }
      return success;
    } catch (err) {
      setError(`Failed to update task: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  };

  // Helper function to get a file by its ID
  const getFileById = (fileId: string): FileItem | undefined => {
    return manifest?.fileManifest.find((file) => file.id === fileId);
  };

  // Helper function to get files by their type
  const getFilesByType = (type: string): FileItem[] => {
    return manifest?.fileManifest.filter((file) => file.type === type) || [];
  };

  // Helper function to get a task by its ID
  const getTaskById = (taskId: string): Task | undefined => {
    return manifest?.tasks.find((task) => task.id === taskId);
  };

  // Helper function to get tasks by their type
  const getTasksByType = (type: string): Task[] => {
    return manifest?.tasks.filter((task) => task.type === type) || [];
  };

  // Get the currently active task (first running task found)
  const getActiveTask = (): Task | undefined => {
    return manifest?.tasks.find((task) => task.state === 'running');
  };

  // Memoize files and tasks arrays
  const files = useMemo(() => manifest?.fileManifest || [], [manifest]);
  const tasks = useMemo(() => manifest?.tasks || [], [manifest]);

  const value = {
    manifest,
    isLoading,
    error,
    files,
    tasks,
    refreshManifest,
    updateFile,
    updateTask,
    getFileById,
    getFilesByType,
    getTaskById,
    getTasksByType,
    getActiveTask,
  };

  return <ManifestContext.Provider value={value}>{children}</ManifestContext.Provider>;
};

// Custom hook to use the manifest context
export const useManifest = (): ManifestContextType => {
  const context = useContext(ManifestContext);
  if (context === undefined) {
    throw new Error('useManifest must be used within a ManifestProvider');
  }
  return context;
};

export default ManifestContext; 