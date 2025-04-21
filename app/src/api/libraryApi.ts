import axios from 'axios';

// API基础URL
const API_BASE_URL = 'http://localhost:3001/api';

// 库项目类型定义
export interface LibraryItem {
  id: string;
  hashId: string;
  title: string;
  platform: string;
  url?: string;
  createdAt: string;
  updatedAt: string;
  diskSize: number;
  hasOriginalMedia: boolean;
  state: 'ready' | 'processing' | 'error' | 'purged';
  topics: string[];
  thumbnailUrl?: string;
  mediaQuality?: string;
  duration?: number;
}

// 筛选选项
export interface LibraryFilterOptions {
  platform?: string;
  hasMedia?: boolean;
  state?: string;
  topic?: string;
  topics?: string;
  searchTerm?: string;
  search?: string;
  hasOriginalMedia?: boolean;
}

// 排序选项
export interface LibrarySortOptions {
  field: 'createdAt' | 'updatedAt' | 'title' | 'diskSize';
  direction: 'asc' | 'desc';
}

// 获取所有内容
export const fetchLibraryItems = async (
  filters?: LibraryFilterOptions,
  sort?: LibrarySortOptions
): Promise<LibraryItem[]> => {
  try {
    // 实际环境中应该调用API
    // const response = await axios.get(`${API_BASE_URL}/library`, { params: { filters, sort } });
    // return response.data;
    
    // 临时返回模拟数据
    const mockItems: LibraryItem[] = Array.from({ length: 10 }).map((_, index) => ({
      id: `item_${index}`,
      hashId: `hash_${index}`,
      title: `示例内容 ${index + 1}`,
      platform: ['youtube', 'twitter', 'bilibili'][Math.floor(Math.random() * 3)],
      createdAt: new Date(Date.now() - Math.random() * 10000000000).toISOString(),
      updatedAt: new Date().toISOString(),
      diskSize: Math.floor(Math.random() * 1000) * 1024 * 1024, // 字节
      hasOriginalMedia: Math.random() > 0.3,
      state: ['ready', 'processing', 'error', 'purged'][Math.floor(Math.random() * 4)] as any,
      topics: ['技术', '科学', '历史', '艺术'].filter(() => Math.random() > 0.5),
      thumbnailUrl: `https://picsum.photos/id/${index + 10}/300/200`,
      mediaQuality: Math.random() > 0.5 ? ['1080p', '720p', '480p', '360p'][Math.floor(Math.random() * 4)] : undefined,
      duration: Math.random() > 0.3 ? Math.floor(Math.random() * 600) + 60 : undefined // 随机60-660秒
    }));
    
    return mockItems;
  } catch (error) {
    console.error("获取库内容失败:", error);
    throw error;
  }
};

// 获取筛选后的内容（兼容旧接口名称）
export const fetchFilteredLibrary = fetchLibraryItems;

// 获取所有标签
export const fetchAllTopics = async (): Promise<string[]> => {
  try {
    // const response = await axios.get(`${API_BASE_URL}/topics`);
    // return response.data;
    
    // 临时返回模拟数据
    return ['技术', '科学', '历史', '艺术', '教育', '娱乐', '政治', '经济'];
  } catch (error) {
    console.error("获取所有标签失败:", error);
    throw error;
  }
};

// 获取磁盘统计
export const fetchDiskStats = async (): Promise<any> => {
  try {
    // const response = await axios.get(`${API_BASE_URL}/disk-stats`);
    // return response.data;
    
    // 临时返回模拟数据
    return {
      totalSize: 100 * 1024 * 1024 * 1024, // 100 GB
      usedSize: 45 * 1024 * 1024 * 1024, // 45 GB
      items: {
        videos: 32 * 1024 * 1024 * 1024, // 32 GB
        audios: 8 * 1024 * 1024 * 1024, // 8 GB
        texts: 2 * 1024 * 1024 * 1024, // 2 GB
        other: 3 * 1024 * 1024 * 1024 // 3 GB
      }
    };
  } catch (error) {
    console.error("获取磁盘统计失败:", error);
    throw error;
  }
};

// 删除内容
export const deleteContent = async (hashId: string, options?: { keepProcessed?: boolean }): Promise<void> => {
  try {
    // await axios.delete(`${API_BASE_URL}/content/${hashId}`, { data: options });
    console.log(`内容已删除: ${hashId}, 选项:`, options);
  } catch (error) {
    console.error("删除内容失败:", error);
    throw error;
  }
};

// 格式化文件大小的辅助函数
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}; 