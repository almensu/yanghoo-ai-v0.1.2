import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Manifest, fetchManifest, FileItem } from '../../api/manifestApi';

// 扩展Manifest接口以包含hashId属性
interface ExtendedManifest extends Manifest {
  hashId: string;
}

// 上下文类型定义
interface ManifestContextType {
  manifest: ExtendedManifest | null;
  loading: boolean;
  isLoading: boolean; // 添加别名，兼容旧代码
  error: string | null;
  refreshManifest: () => Promise<void>;
  getFilesByType: (type: string) => FileItem[]; // 添加按类型获取文件的方法
}

// 创建上下文
const ManifestContext = createContext<ManifestContextType>({
  manifest: null,
  loading: false,
  isLoading: false,
  error: null,
  refreshManifest: async () => {},
  getFilesByType: () => []
});

// 提供者属性
interface ManifestProviderProps {
  children: ReactNode;
  hashId: string;
}

// 上下文提供者组件
export const ManifestProvider: React.FC<ManifestProviderProps> = ({ children, hashId }) => {
  const [manifest, setManifest] = useState<ExtendedManifest | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 加载Manifest数据
  const loadManifest = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchManifest(hashId);
      
      // 确保manifest有hashId属性
      const extendedData: ExtendedManifest = {
        ...data,
        hashId
      };
      
      setManifest(extendedData);
    } catch (err) {
      console.error('加载Manifest失败:', err);
      setError('无法加载内容数据，请稍后重试。');
    } finally {
      setLoading(false);
    }
  };

  // 按类型获取文件
  const getFilesByType = (type: string): FileItem[] => {
    if (!manifest) return [];
    
    const result: FileItem[] = [];
    for (const [id, file] of Object.entries(manifest.fileManifest)) {
      if (file.type === type) {
        result.push({
          ...file,
          id
        });
      }
    }
    
    return result;
  };

  // 刷新Manifest数据
  const refreshManifest = async () => {
    await loadManifest();
  };

  // 初始加载
  useEffect(() => {
    if (hashId) {
      loadManifest();
    }
  }, [hashId]);

  // 提供上下文值
  const contextValue: ManifestContextType = {
    manifest,
    loading,
    isLoading: loading, // 添加别名，兼容旧代码
    error,
    refreshManifest,
    getFilesByType
  };

  return (
    <ManifestContext.Provider value={contextValue}>
      {children}
    </ManifestContext.Provider>
  );
};

// 自定义hook，方便消费组件使用
export const useManifest = () => {
  const context = useContext(ManifestContext);
  if (!context) {
    throw new Error('useManifest必须在ManifestProvider内部使用');
  }
  return context;
};

export default ManifestContext; 