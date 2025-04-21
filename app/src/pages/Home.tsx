import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  fetchFilteredLibrary, 
  LibraryItem, 
  LibraryFilterOptions, 
  LibrarySortOptions,
  fetchAllTopics,
  fetchDiskStats,
  deleteContent
} from '../api/libraryApi';

const Home: React.FC = () => {
  // Data states
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [allTopics, setAllTopics] = useState<string[]>([]);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [diskStats, setDiskStats] = useState({
    totalSize: 0,
    mediaSize: 0,
    processedDataSize: 0,
    itemCount: 0
  });
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  
  // UI states
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteOptions, setDeleteOptions] = useState({
    keepProcessedData: false
  });
  
  // Filter states
  const [filters, setFilters] = useState<LibraryFilterOptions>({});
  const [sort, setSort] = useState<LibrarySortOptions>({
    field: 'updatedAt',
    direction: 'desc'
  });
  const [showFilters, setShowFilters] = useState(false);

  // 加载数据
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // 加载筛选后的内容库数据
        const data = await fetchFilteredLibrary(filters, sort);
        setItems(data);
        
        // 提取所有可用平台
        const uniquePlatforms = Array.from(new Set(data.map(item => item.platform)));
        setPlatforms(uniquePlatforms);
        
        // 加载所有标签
        const topics = await fetchAllTopics();
        setAllTopics(topics);
        
        // 加载磁盘使用统计
        const stats = await fetchDiskStats();
        setDiskStats(stats);
      } catch (err) {
        setError('加载数据失败，请重试');
        console.error('Error loading library:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [filters, sort]);

  // 处理筛选条件变更
  const handleFilterChange = (newFilters: Partial<LibraryFilterOptions>) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters
    }));
  };

  // 处理排序变更
  const handleSortChange = (field: LibrarySortOptions['field']) => {
    setSort(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // 处理选择/取消选择单个项目
  const handleSelectItem = (hashId: string) => {
    setSelectedItems(prev => 
      prev.includes(hashId) 
        ? prev.filter(id => id !== hashId)
        : [...prev, hashId]
    );
  };

  // 处理全选/取消全选
  const handleSelectAll = () => {
    if (selectedItems.length === items.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(items.map(item => item.hashId));
    }
  };

  // 处理删除确认
  const handleDeleteConfirm = async () => {
    try {
      setIsLoading(true);
      
      // 执行删除操作
      const deletePromises = selectedItems.map(hashId => 
        deleteContent(hashId)
      );
      
      await Promise.all(deletePromises);
      
      // 重新加载数据
      const updatedData = await fetchFilteredLibrary(filters, sort);
      setItems(updatedData);
      
      // 清除选中状态和关闭确认框
      setSelectedItems([]);
      setShowDeleteConfirm(false);
    } catch (err) {
      setError('删除资源失败，请重试');
      console.error('Error deleting content:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // 格式化文件大小显示
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (isLoading && items.length === 0) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex items-center justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
          <p className="ml-2">加载中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4" role="alert">
          <p className="font-bold">错误</p>
          <p>{error}</p>
          <button 
            className="mt-2 bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-2 rounded"
            onClick={() => window.location.reload()}
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      {/* 顶部控制栏 */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold">内容库</h1>
          <p className="text-sm text-gray-500">
            共 {items.length} 个项目，占用 {formatFileSize(diskStats.totalSize)}
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* 批量操作按钮 */}
          {selectedItems.length > 0 && (
            <div className="flex items-center mr-4">
              <span className="text-sm mr-2">已选择 {selectedItems.length} 项</span>
              <button 
                className="bg-red-500 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
                onClick={() => setShowDeleteConfirm(true)}
              >
                删除
              </button>
            </div>
          )}
          
          {/* 筛选按钮 */}
          <button
            className="flex items-center px-3 py-1 rounded border border-gray-300 text-sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            筛选
          </button>
          
          {/* 视图切换 */}
          <div className="flex space-x-1 border border-gray-300 rounded overflow-hidden">
            <button 
              className={`px-3 py-1 text-sm ${viewMode === 'grid' ? 'bg-primary text-white' : 'bg-white'}`}
              onClick={() => setViewMode('grid')}
            >
              网格
            </button>
            <button 
              className={`px-3 py-1 text-sm ${viewMode === 'list' ? 'bg-primary text-white' : 'bg-white'}`}
              onClick={() => setViewMode('list')}
            >
              列表
            </button>
          </div>
        </div>
      </div>
      
      {/* 筛选面板 */}
      {showFilters && (
        <div className="bg-gray-50 p-4 rounded-lg mb-6 border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 平台筛选 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">平台</label>
              <select 
                className="block w-full border border-gray-300 rounded py-1.5 px-3 bg-white"
                value={filters.platform as string || ''}
                onChange={(e) => handleFilterChange({ platform: e.target.value || undefined })}
              >
                <option value="">全部平台</option>
                {platforms.map(platform => (
                  <option key={platform} value={platform}>{platform}</option>
                ))}
              </select>
            </div>
            
            {/* 状态筛选 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
              <select 
                className="block w-full border border-gray-300 rounded py-1.5 px-3 bg-white"
                value={filters.state as string || ''}
                onChange={(e) => handleFilterChange({ state: e.target.value || undefined })}
              >
                <option value="">全部状态</option>
                <option value="ready">就绪</option>
                <option value="processing">处理中</option>
                <option value="error">错误</option>
                <option value="purged">已清理</option>
              </select>
            </div>
            
            {/* 排序方式 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">排序</label>
              <select 
                className="block w-full border border-gray-300 rounded py-1.5 px-3 bg-white"
                value={sort.field}
                onChange={(e) => handleSortChange(e.target.value as LibrarySortOptions['field'])}
              >
                <option value="updatedAt">更新时间</option>
                <option value="createdAt">创建时间</option>
                <option value="title">标题</option>
                <option value="diskSize">文件大小</option>
                <option value="viewCount">查看次数</option>
                <option value="lastViewedAt">上次查看</option>
              </select>
            </div>
            
            {/* 原始媒体筛选 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">媒体状态</label>
              <select 
                className="block w-full border border-gray-300 rounded py-1.5 px-3 bg-white"
                value={filters.hasOriginalMedia === undefined ? '' : filters.hasOriginalMedia ? 'true' : 'false'}
                onChange={(e) => {
                  const value = e.target.value;
                  handleFilterChange({ 
                    hasOriginalMedia: value === '' ? undefined : value === 'true'
                  });
                }}
              >
                <option value="">全部</option>
                <option value="true">有原始媒体</option>
                <option value="false">无原始媒体</option>
              </select>
            </div>
            
            {/* 标签筛选 - 下拉菜单 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">标签</label>
              <select 
                className="block w-full border border-gray-300 rounded py-1.5 px-3 bg-white"
                value={filters.topics as string || ''}
                onChange={(e) => handleFilterChange({ topics: e.target.value || undefined })}
              >
                <option value="">全部标签</option>
                {allTopics.map(topic => (
                  <option key={topic} value={topic}>{topic}</option>
                ))}
              </select>
            </div>
            
            {/* 搜索框 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">搜索</label>
              <input
                type="text"
                placeholder="搜索标题或描述"
                className="block w-full border border-gray-300 rounded py-1.5 px-3"
                value={filters.search || ''}
                onChange={(e) => handleFilterChange({ search: e.target.value || undefined })}
              />
            </div>
          </div>
          
          {/* 筛选操作按钮 */}
          <div className="mt-4 flex justify-end">
            <button
              className="px-3 py-1 rounded bg-gray-200 text-sm mr-2"
              onClick={() => {
                setFilters({});
                setSort({ field: 'updatedAt', direction: 'desc' });
              }}
            >
              重置筛选
            </button>
            <button
              className="px-3 py-1 rounded bg-primary text-white text-sm"
              onClick={() => setShowFilters(false)}
            >
              应用筛选
            </button>
          </div>
        </div>
      )}

      {/* 内容列表 */}
      {items.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-gray-500">没有找到内容</p>
          <p className="mt-2">
            <a href="#" className="text-primary hover:underline">添加新内容</a>
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => (
            <div key={item.hashId} className="relative group">
              {/* 选择框 */}
              <div className="absolute top-2 left-2 z-10">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  checked={selectedItems.includes(item.hashId)}
                  onChange={() => handleSelectItem(item.hashId)}
                />
              </div>
              
              <Link to={`/${item.hashId}`} className="block">
                <div className="card hover:shadow-lg transition-shadow duration-300">
                  <div className="aspect-video bg-gray-200 relative">
                    {item.thumbnailUrl ? (
                      <img 
                        src={item.thumbnailUrl} 
                        alt={item.title} 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        无缩略图
                      </div>
                    )}
                    
                    {/* 右下角平台标签 */}
                    <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                      {item.platform}
                    </div>
                    
                    {/* 右上角媒体质量标签 */}
                    {item.mediaQuality && (
                      <div className="absolute top-2 right-2 bg-blue-500/80 text-white text-xs px-1.5 py-0.5 rounded">
                        {item.mediaQuality}
                      </div>
                    )}
                    
                    {/* 已清理状态覆盖层 */}
                    {item.state === 'purged' && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="text-white font-medium">已清理媒体</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="p-4">
                    <h3 className="font-medium text-lg mb-1 line-clamp-2">{item.title}</h3>
                    
                    {/* 文件大小和时长信息 */}
                    <div className="flex items-center text-xs text-gray-500 mb-2">
                      <span className="mr-2">{formatFileSize(item.diskSize)}</span>
                      {item.duration && (
                        <span>
                          {Math.floor(item.duration / 60)}:{(item.duration % 60).toString().padStart(2, '0')}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex justify-between items-center mt-2">
                      {/* 状态标签 */}
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                        item.state === 'ready' ? 'bg-green-100 text-green-800' :
                        item.state === 'processing' ? 'bg-blue-100 text-blue-800' :
                        item.state === 'error' ? 'bg-red-100 text-red-800' :
                        item.state === 'purged' ? 'bg-gray-200 text-gray-700' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {
                          item.state === 'ready' ? '就绪' :
                          item.state === 'processing' ? '处理中' :
                          item.state === 'error' ? '错误' :
                          item.state === 'purged' ? '已清理' : '未知'
                        }
                      </span>
                      
                      {/* 更新时间 */}
                      <span className="text-gray-500 text-sm">
                        {new Date(item.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    checked={selectedItems.length === items.length && items.length > 0}
                    onChange={handleSelectAll}
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">标题</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">平台</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">大小</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">质量</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">更新时间</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {items.map((item) => (
                <tr key={item.hashId} className="hover:bg-gray-50">
                  <td className="px-3 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      checked={selectedItems.includes(item.hashId)}
                      onChange={() => handleSelectItem(item.hashId)}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {/* 缩略图 */}
                      <div className="flex-shrink-0 h-10 w-16 mr-3">
                        {item.thumbnailUrl ? (
                          <img src={item.thumbnailUrl} alt="" className="h-10 w-16 object-cover rounded" />
                        ) : (
                          <div className="h-10 w-16 bg-gray-200 rounded flex items-center justify-center">
                            <span className="text-xs text-gray-400">无图</span>
                          </div>
                        )}
                      </div>
                      
                      {/* 标题 */}
                      <div>
                        <Link to={`/${item.hashId}`} className="text-primary hover:underline">
                          {item.title}
                        </Link>
                        {item.duration && (
                          <div className="text-xs text-gray-500">
                            {Math.floor(item.duration / 60)}:{(item.duration % 60).toString().padStart(2, '0')}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{item.platform}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                      item.state === 'ready' ? 'bg-green-100 text-green-800' :
                      item.state === 'processing' ? 'bg-blue-100 text-blue-800' :
                      item.state === 'error' ? 'bg-red-100 text-red-800' :
                      item.state === 'purged' ? 'bg-gray-200 text-gray-700' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {
                        item.state === 'ready' ? '就绪' :
                        item.state === 'processing' ? '处理中' :
                        item.state === 'error' ? '错误' :
                        item.state === 'purged' ? '已清理' : '未知'
                      }
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {formatFileSize(item.diskSize)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {item.mediaQuality || (item.hasOriginalMedia ? '有' : '无')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(item.updatedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {/* 删除确认对话框 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">确认删除</h3>
            <p className="mb-4">
              确定要删除选中的 {selectedItems.length} 个项目吗？此操作无法撤销。
            </p>
            
            <div className="mb-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary mr-2"
                  checked={deleteOptions.keepProcessedData}
                  onChange={(e) => setDeleteOptions(prev => ({...prev, keepProcessedData: e.target.checked}))}
                />
                <span>保留处理结果（仅删除原始媒体文件）</span>
              </label>
            </div>
            
            <div className="flex justify-end space-x-2">
              <button
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                onClick={() => setShowDeleteConfirm(false)}
              >
                取消
              </button>
              <button
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                onClick={handleDeleteConfirm}
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home; 