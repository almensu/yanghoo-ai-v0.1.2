import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchLibrary, LibraryItem } from '../api/libraryApi';

const Home: React.FC = () => {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // 加载数据
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await fetchLibrary();
        setItems(data);
      } catch (err) {
        setError('加载数据失败，请重试');
        console.error('Error loading library:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // 切换视图模式
  const toggleViewMode = () => {
    setViewMode(viewMode === 'grid' ? 'list' : 'grid');
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <div className="loading">
          <div className="loading-spinner"></div>
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">内容库</h1>
        
        <div className="flex space-x-2">
          <button 
            className={`px-3 py-1 rounded ${viewMode === 'grid' ? 'bg-primary text-white' : 'bg-gray-200'}`}
            onClick={() => setViewMode('grid')}
          >
            网格视图
          </button>
          <button 
            className={`px-3 py-1 rounded ${viewMode === 'list' ? 'bg-primary text-white' : 'bg-gray-200'}`}
            onClick={() => setViewMode('list')}
          >
            列表视图
          </button>
        </div>
      </div>

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
            <Link to={`/${item.hashId}`} key={item.hashId}>
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
                  <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                    {item.platform}
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-medium text-lg mb-1 line-clamp-2">{item.title}</h3>
                  <div className="flex justify-between items-center mt-2">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                      item.state === 'ready' ? 'bg-green-100 text-green-800' :
                      item.state === 'processing' ? 'bg-blue-100 text-blue-800' :
                      item.state === 'error' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {
                        item.state === 'ready' ? '就绪' :
                        item.state === 'processing' ? '处理中' :
                        item.state === 'error' ? '错误' :
                        item.state === 'purged' ? '已清理' : '未知'
                      }
                    </span>
                    <span className="text-gray-500 text-sm">
                      {new Date(item.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">标题</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">平台</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">更新时间</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {items.map((item) => (
                <tr key={item.hashId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link to={`/${item.hashId}`} className="text-primary hover:underline">
                      {item.title}
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{item.platform}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                      item.state === 'ready' ? 'bg-green-100 text-green-800' :
                      item.state === 'processing' ? 'bg-blue-100 text-blue-800' :
                      item.state === 'error' ? 'bg-red-100 text-red-800' :
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(item.updatedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Home; 