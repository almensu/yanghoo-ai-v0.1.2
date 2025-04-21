import React, { useState, useEffect } from 'react';
import { addTask, TaskOptions } from '../api/manifestApi';

interface ScreenshotExtractorProps {
  hashId: string;
  videoPath?: string;
  videoType: 'local' | 'youtube' | 'twitter' | 'other';
  videoDuration?: number;
  onScreenshotsReady?: (collectionPath: string) => void;
}

interface Screenshot {
  id: string;
  filename: string;
  timestamp: number;
  subtitleText?: string;
  notes?: string;
  tags?: string[];
  selected?: boolean;
}

const ScreenshotExtractor: React.FC<ScreenshotExtractorProps> = ({ 
  hashId, 
  videoPath, 
  videoType,
  videoDuration,
  onScreenshotsReady
}) => {
  // 截图提取模式
  const [mode, setMode] = useState<'interval' | 'uniform' | 'keyframe' | 'subtitle'>('interval');
  
  // 截图参数
  const [interval, setInterval] = useState(60); // 间隔秒数
  const [count, setCount] = useState(10);       // 均匀分布数量
  const [outputQuality, setOutputQuality] = useState(80); // 输出质量
  const [imageFormat, setImageFormat] = useState<'jpg' | 'png'>('jpg'); // 图片格式
  
  // 任务状态
  const [isProcessing, setIsProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState(0);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // 截图预览数据
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [selectedScreenshots, setSelectedScreenshots] = useState<string[]>([]);
  
  // 已抽取的截图集合路径
  const [collectionPath, setCollectionPath] = useState<string | null>(null);
  
  // 监控任务进度
  useEffect(() => {
    if (!currentTaskId || !isProcessing) return;
    
    // 设置间隔定时器
    let intervalId: number | null = null;
    
    const fetchStatus = async () => {
      try {
        const response = await fetch(`/api/tasks/${hashId}/${currentTaskId}`);
        
        if (!response.ok) {
          throw new Error('获取任务状态失败');
        }
        
        const status = await response.json();
        
        setProcessProgress(status.percent || 0);
        
        if (status.state === 'done') {
          setIsProcessing(false);
          
          // 加载截图集合
          if (status.context?.outputFiles?.collection) {
            setCollectionPath(status.context.outputFiles.collection);
            await loadScreenshotCollection(status.context.outputFiles.collection);
            if (onScreenshotsReady) {
              onScreenshotsReady(status.context.outputFiles.collection);
            }
          }
          
          // 清除定时器
          if (intervalId !== null) {
            window.clearInterval(intervalId);
          }
        } else if (status.state === 'error') {
          setError(status.error || '截图提取失败');
          setIsProcessing(false);
          
          // 清除定时器
          if (intervalId !== null) {
            window.clearInterval(intervalId);
          }
        }
      } catch (error) {
        console.error('监控任务进度出错:', error);
      }
    };
    
    // 设置定时器，正确保存返回的ID
    intervalId = window.setInterval(fetchStatus, 1000);
    
    // 返回清理函数
    return () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };
  }, [currentTaskId, isProcessing, hashId, onScreenshotsReady]);
  
  /**
   * 加载截图集合
   */
  const loadScreenshotCollection = async (collectionPath: string) => {
    try {
      const response = await fetch(`/api/content/${hashId}/${collectionPath}`);
      
      if (!response.ok) {
        throw new Error('加载截图集合失败');
      }
      
      const data = await response.json();
      
      if (data.screenshots && Array.isArray(data.screenshots)) {
        setScreenshots(data.screenshots.map((s: any) => ({
          ...s,
          selected: false
        })));
      }
    } catch (error) {
      console.error('加载截图集合出错:', error);
      setError('加载截图集合失败');
    }
  };
  
  /**
   * 开始提取截图
   */
  const startExtraction = async () => {
    if (isProcessing) return;
    
    // 验证参数
    if (mode === 'interval' && (interval <= 0 || interval > (videoDuration || 3600))) {
      setError('请输入有效的时间间隔');
      return;
    }
    
    if (mode === 'uniform' && (count <= 0 || count > 100)) {
      setError('请输入有效的截图数量 (1-100)');
      return;
    }
    
    try {
      setIsProcessing(true);
      setProcessProgress(0);
      setError(null);
      setScreenshots([]);
      setSelectedScreenshots([]);
      
      // 创建截图配置
      const configData = {
        mode,
        interval: mode === 'interval' ? interval : undefined,
        count: mode === 'uniform' ? count : undefined,
        outputQuality,
        imageFormat
      };
      
      // 保存截图配置文件
      const configResponse = await fetch(`/api/content/${hashId}/screenshot_config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(configData),
      });
      
      if (!configResponse.ok) {
        throw new Error(`保存截图配置失败: ${configResponse.statusText}`);
      }
      
      // 创建任务选项
      const taskOptions: TaskOptions = {
        title: '提取视频截图',
        state: 'queued',
        percent: 0,
        relatedOutput: 'screenshot_collection_json',
        context: { 
          mode, 
          interval: mode === 'interval' ? interval : undefined,
          count: mode === 'uniform' ? count : undefined
        }
      };
      
      // 添加任务
      const taskId = await addTask(hashId, taskOptions);
      
      if (!taskId) {
        throw new Error('添加任务失败');
      }
      
      // 更新任务ID到配置文件
      const updateConfigResponse = await fetch(`/api/content/${hashId}/screenshot_config`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ taskId }),
      });
      
      if (!updateConfigResponse.ok) {
        throw new Error(`更新任务ID到配置失败: ${updateConfigResponse.statusText}`);
      }
      
      // 触发任务执行
      const startResponse = await fetch(`/api/tasks/${hashId}/${taskId}/start`, {
        method: 'POST',
      });
      
      if (!startResponse.ok) {
        throw new Error(`启动任务失败: ${startResponse.statusText}`);
      }
      
      setCurrentTaskId(taskId);
    } catch (err) {
      setError((err as Error).message);
      setIsProcessing(false);
    }
  };
  
  /**
   * 选择/取消选择截图
   */
  const toggleSelectScreenshot = (id: string) => {
    setSelectedScreenshots(prev => 
      prev.includes(id) 
        ? prev.filter(itemId => itemId !== id)
        : [...prev, id]
    );
  };
  
  /**
   * 全选/取消全选
   */
  const toggleSelectAll = () => {
    if (selectedScreenshots.length === screenshots.length) {
      setSelectedScreenshots([]);
    } else {
      setSelectedScreenshots(screenshots.map(s => s.id));
    }
  };
  
  /**
   * 下载选定的截图
   */
  const downloadSelectedScreenshots = () => {
    if (selectedScreenshots.length === 0) {
      setError('请至少选择一张截图');
      return;
    }
    
    // 下载完整ZIP包
    window.open(`/api/content/${hashId}/screenshots/screenshots.zip`, '_blank');
  };
  
  /**
   * 格式化时间戳显示
   */
  const formatTimestamp = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // 是否是本地视频
  const isLocalVideo = videoType === 'local';
  
  // 如果不是本地视频，不允许提取截图
  if (!isLocalVideo) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-xl font-bold mb-4">截图提取工具</h2>
        <div className="mb-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-3">
          非本地视频不支持截图提取功能。请先下载视频到本地。
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h2 className="text-xl font-bold mb-4">截图提取工具</h2>
      
      {error && (
        <div className="mb-4 bg-red-100 border-l-4 border-red-500 text-red-700 p-3">
          {error}
        </div>
      )}
      
      {!isProcessing && !collectionPath && (
        <div className="mb-4 border rounded p-3">
          <h3 className="font-medium mb-2">提取设置:</h3>
          
          {/* 提取模式选择 */}
          <div className="mb-3">
            <label className="block text-sm font-medium mb-1">提取模式</label>
            <select 
              className="w-full border rounded px-3 py-2"
              value={mode}
              onChange={(e) => setMode(e.target.value as any)}
            >
              <option value="interval">时间间隔模式</option>
              <option value="uniform">均匀分布模式</option>
              <option value="keyframe">关键帧模式</option>
              <option value="subtitle">字幕时间点模式</option>
            </select>
            
            <p className="text-sm text-gray-500 mt-1">
              {mode === 'interval' && '每隔指定的秒数提取一张截图'}
              {mode === 'uniform' && '在视频时长内均匀分布指定数量的截图'}
              {mode === 'keyframe' && '提取视频的关键帧作为截图'}
              {mode === 'subtitle' && '在每个字幕的开始时间点提取截图'}
            </p>
          </div>
          
          {/* 模式特定参数 */}
          {mode === 'interval' && (
            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">时间间隔 (秒)</label>
              <input 
                type="number" 
                min="1" 
                max={videoDuration}
                value={interval}
                onChange={(e) => setInterval(Math.max(1, parseInt(e.target.value)))}
                className="w-full border rounded px-3 py-2"
              />
            </div>
          )}
          
          {mode === 'uniform' && (
            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">截图数量</label>
              <input 
                type="number" 
                min="1" 
                max="100"
                value={count}
                onChange={(e) => setCount(Math.max(1, parseInt(e.target.value)))}
                className="w-full border rounded px-3 py-2"
              />
            </div>
          )}
          
          {/* 通用输出选项 */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-sm font-medium mb-1">输出质量</label>
              <select 
                className="w-full border rounded px-3 py-2"
                value={outputQuality}
                onChange={(e) => setOutputQuality(parseInt(e.target.value))}
              >
                <option value="60">低 (60%)</option>
                <option value="80">中 (80%)</option>
                <option value="95">高 (95%)</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">图片格式</label>
              <select 
                className="w-full border rounded px-3 py-2"
                value={imageFormat}
                onChange={(e) => setImageFormat(e.target.value as 'jpg' | 'png')}
              >
                <option value="jpg">JPG (推荐)</option>
                <option value="png">PNG (无损)</option>
              </select>
            </div>
          </div>
          
          <button
            className="bg-primary text-white rounded px-4 py-2 hover:bg-primary/90"
            onClick={startExtraction}
          >
            开始提取
          </button>
        </div>
      )}
      
      {/* 处理进度 */}
      {isProcessing && (
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">处理进度:</label>
          <div className="w-full bg-gray-200 rounded">
            <div 
              className="bg-blue-500 text-white text-center py-1 text-xs rounded"
              style={{ width: `${processProgress}%` }}
            >
              {processProgress}%
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-1">正在提取截图，请稍候...</p>
        </div>
      )}
      
      {/* 截图预览区域 */}
      {screenshots.length > 0 && (
        <div className="mt-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-medium">截图预览 ({screenshots.length}张)</h3>
            
            <div className="flex items-center space-x-2">
              <button
                className="text-sm text-primary hover:underline"
                onClick={toggleSelectAll}
              >
                {selectedScreenshots.length === screenshots.length ? '取消全选' : '全选'}
              </button>
              
              <button
                className="bg-primary text-white rounded px-3 py-1 text-sm hover:bg-primary/90 disabled:bg-gray-400"
                onClick={downloadSelectedScreenshots}
                disabled={selectedScreenshots.length === 0}
              >
                下载选中截图
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
            {screenshots.map((screenshot) => (
              <div 
                key={screenshot.id} 
                className={`border rounded overflow-hidden ${
                  selectedScreenshots.includes(screenshot.id) ? 'border-primary ring-2 ring-primary/30' : 'border-gray-200'
                }`}
                onClick={() => toggleSelectScreenshot(screenshot.id)}
              >
                <div className="aspect-video bg-gray-100 relative">
                  <img 
                    src={`/api/content/${hashId}/screenshots/${screenshot.filename}`} 
                    alt={`Screenshot at ${formatTimestamp(screenshot.timestamp)}`} 
                    className="w-full h-full object-cover"
                  />
                  
                  {/* 时间戳标签 */}
                  <div className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                    {formatTimestamp(screenshot.timestamp)}
                  </div>
                  
                  {/* 选择标记 */}
                  {selectedScreenshots.includes(screenshot.id) && (
                    <div className="absolute top-1 left-1">
                      <div className="bg-primary text-white rounded-full w-5 h-5 flex items-center justify-center">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* 字幕文本（如果有） */}
                {screenshot.subtitleText && (
                  <div className="p-2">
                    <p className="text-xs text-gray-700 line-clamp-2">{screenshot.subtitleText}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ScreenshotExtractor; 