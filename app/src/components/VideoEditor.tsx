import React, { useState, useEffect } from 'react';
import { VideoSegment, VideoEditConfig, createVideoEditTask, getVideoEditTaskStatus } from '../api/videoEditApi';

interface VideoEditorProps {
  hashId: string;
  videoPath?: string;
  videoType: 'local' | 'youtube' | 'twitter' | 'other';
  videoDuration?: number;
  subtitlesPath?: string;
}

interface Subtitle {
  startTime: number;
  endTime: number;
  text: string;
}

// 创建一个本地扩展接口，方便组件内部使用
interface EditorVideoSegment {
  id?: string; // 可选ID，新片段未保存时可能没有
  startTime: number;
  endTime: number;
  label: string;
  notes?: string;
}

const VideoEditor: React.FC<VideoEditorProps> = ({ 
  hashId, 
  videoPath, 
  videoType,
  videoDuration,
  subtitlesPath 
}) => {
  // 字幕数据
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  
  // 选中的片段 - 修复：使用EditorVideoSegment类型
  const [selectedSegments, setSelectedSegments] = useState<EditorVideoSegment[]>([]);
  
  // 新片段 - 修复：使用EditorVideoSegment类型
  const [newSegment, setNewSegment] = useState<EditorVideoSegment>({
    startTime: 0,
    endTime: videoDuration || 0,
    label: '',
    notes: ''
  });
  
  // 任务状态
  const [isProcessing, setIsProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState(0);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // 导出设置
  const [outputType, setOutputType] = useState<'video' | 'timeline'>(videoType === 'local' ? 'video' : 'timeline');
  const [outputFormat, setOutputFormat] = useState<'mp4' | 'webm' | 'gif'>('mp4'); // 修复：使用正确的联合类型
  const [keepAudio, setKeepAudio] = useState(true);

  // 载入字幕
  useEffect(() => {
    const loadSubtitles = async () => {
      if (!subtitlesPath) return;
      
      try {
        const response = await fetch(`/api/content/${hashId}/${subtitlesPath}`);
        if (!response.ok) throw new Error('字幕加载失败');
        
        const content = await response.text();
        const parsedSubtitles = parseVTT(content);
        setSubtitles(parsedSubtitles);
      } catch (error) {
        console.error('Error loading subtitles:', error);
      }
    };
    
    loadSubtitles();
  }, [hashId, subtitlesPath]);

  // 监控任务进度
  useEffect(() => {
    if (!currentTaskId || !isProcessing) return;
    
    const interval = setInterval(async () => {
      const status = await getVideoEditTaskStatus(hashId, currentTaskId);
      
      if (status) {
        setProcessProgress(status.percent);
        
        if (status.state === 'done') {
          setIsProcessing(false);
          clearInterval(interval);
        } else if (status.state === 'error') {
          setError(status.error || '任务处理失败');
          setIsProcessing(false);
          clearInterval(interval);
        }
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [currentTaskId, isProcessing, hashId]);

  /**
   * 解析VTT字幕
   */
  const parseVTT = (content: string): Subtitle[] => {
    const lines = content.split('\n');
    const subtitles: Subtitle[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // 查找时间轴行 (格式: 00:00:10.500 --> 00:00:15.000)
      if (line.includes(' --> ')) {
        const [startTime, endTime] = line.split(' --> ');
        
        // 获取字幕文本
        let text = '';
        let j = i + 1;
        while (j < lines.length && lines[j].trim() !== '' && !lines[j].includes(' --> ')) {
          text += (text ? ' ' : '') + lines[j].trim();
          j++;
        }
        
        subtitles.push({
          startTime: convertTimeToSeconds(startTime),
          endTime: convertTimeToSeconds(endTime),
          text
        });
      }
    }
    
    return subtitles;
  };

  /**
   * 将时间字符串转换为秒
   */
  const convertTimeToSeconds = (timeStr: string): number => {
    const parts = timeStr.split(':');
    
    if (parts.length === 3) {
      // 格式: 00:00:10.500 (时:分:秒)
      return parseInt(parts[0], 10) * 3600 + 
             parseInt(parts[1], 10) * 60 + 
             parseFloat(parts[2]);
    } else if (parts.length === 2) {
      // 格式: 00:10.500 (分:秒)
      return parseInt(parts[0], 10) * 60 + parseFloat(parts[1]);
    }
    
    // 无法解析的格式返回0
    return 0;
  };

  /**
   * 格式化秒为 mm:ss 格式
   */
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  /**
   * 添加片段
   */
  const addSegment = () => {
    // 验证 - 修复：使用正确的属性名
    if (newSegment.endTime <= newSegment.startTime) {
      setError('结束时间必须大于开始时间');
      return;
    }
    
    if (newSegment.endTime > (videoDuration || 0)) {
      setError('结束时间不能超过视频时长');
      return;
    }
    
    // 添加到列表
    setSelectedSegments([...selectedSegments, { ...newSegment }]);
    
    // 重置 - 修复：使用正确的属性名
    setNewSegment({
      startTime: 0,
      endTime: videoDuration || 0,
      label: '',
      notes: ''
    });
    
    setError(null);
  };

  /**
   * 移除片段
   */
  const removeSegment = (index: number) => {
    const newSegments = [...selectedSegments];
    newSegments.splice(index, 1);
    setSelectedSegments(newSegments);
  };

  /**
   * 从字幕中添加片段
   */
  const addSegmentFromSubtitle = (subtitle: Subtitle) => {
    setSelectedSegments([
      ...selectedSegments, 
      {
        startTime: subtitle.startTime,
        endTime: subtitle.endTime,
        label: subtitle.text.substring(0, 30) + (subtitle.text.length > 30 ? '...' : ''),
        notes: subtitle.text
      }
    ]);
  };

  /**
   * 开始处理视频
   */
  const startProcessing = async () => {
    if (isProcessing) return;
    
    if (selectedSegments.length === 0) {
      setError('请至少添加一个片段');
      return;
    }
    
    try {
      setIsProcessing(true);
      setProcessProgress(0);
      setError(null);
      
      // 创建API需要的格式
      const config: VideoEditConfig = {
        segments: selectedSegments.map(segment => ({
          id: segment.id || `segment_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          startTime: segment.startTime,
          endTime: segment.endTime,
          label: segment.label,
          notes: segment.notes
        })),
        outputFormat: outputFormat as 'mp4' | 'webm' | 'gif',
        quality: 'high',
        includeAudio: keepAudio,
        outputType
      };
      
      const taskId = await createVideoEditTask(hashId, config);
      setCurrentTaskId(taskId);
    } catch (err) {
      setError((err as Error).message);
      setIsProcessing(false);
    }
  };

  // 是否是本地视频
  const isLocalVideo = videoType === 'local';

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h2 className="text-xl font-bold mb-4">视频编辑器</h2>
      
      {error && (
        <div className="mb-4 bg-red-100 border-l-4 border-red-500 text-red-700 p-3">
          {error}
        </div>
      )}
      
      {/* 提示信息 */}
      {!isLocalVideo && (
        <div className="mb-4 bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-3">
          注意: 非本地视频只能创建时间轴引用，不能直接编辑视频。
        </div>
      )}
      
      {/* 字幕列表 */}
      {subtitles.length > 0 && (
        <div className="mb-4">
          <h3 className="font-medium mb-2">从字幕选择片段:</h3>
          <div className="max-h-64 overflow-y-auto border rounded p-2">
            {subtitles.map((subtitle, index) => (
              <div 
                key={index} 
                className="flex justify-between items-center p-2 hover:bg-gray-100 cursor-pointer"
                onClick={() => addSegmentFromSubtitle(subtitle)}
              >
                <span className="text-sm">{subtitle.text}</span>
                <span className="text-xs text-gray-500">
                  {formatTime(subtitle.startTime)} - {formatTime(subtitle.endTime)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* 手动添加片段 */}
      <div className="mb-4 border rounded p-3">
        <h3 className="font-medium mb-2">手动添加片段:</h3>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-sm font-medium mb-1">开始时间 (秒)</label>
            <input 
              type="number" 
              min="0" 
              max={videoDuration || 3600}
              value={newSegment.startTime}
              onChange={(e) => setNewSegment({...newSegment, startTime: parseFloat(e.target.value)})}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">结束时间 (秒)</label>
            <input 
              type="number" 
              min="0" 
              max={videoDuration || 3600}
              value={newSegment.endTime}
              onChange={(e) => setNewSegment({...newSegment, endTime: parseFloat(e.target.value)})}
              className="w-full border rounded px-3 py-2"
            />
          </div>
        </div>
        
        <div className="mb-3">
          <label className="block text-sm font-medium mb-1">标签</label>
          <input 
            type="text" 
            value={newSegment.label || ''}
            onChange={(e) => setNewSegment({...newSegment, label: e.target.value})}
            placeholder="片段标签（选填）"
            className="w-full border rounded px-3 py-2"
          />
        </div>
        
        <div className="mb-3">
          <label className="block text-sm font-medium mb-1">描述</label>
          <textarea 
            value={newSegment.notes || ''}
            onChange={(e) => setNewSegment({...newSegment, notes: e.target.value})}
            placeholder="片段描述（选填）"
            className="w-full border rounded px-3 py-2"
            rows={2}
          />
        </div>
        
        <button
          className="bg-blue-500 text-white rounded px-4 py-2 hover:bg-blue-600"
          onClick={addSegment}
        >
          添加片段
        </button>
      </div>
      
      {/* 已选择的片段 */}
      <div className="mb-4">
        <h3 className="font-medium mb-2">已选择的片段: {selectedSegments.length}</h3>
        {selectedSegments.length === 0 ? (
          <p className="text-gray-500 text-sm">尚未选择任何片段</p>
        ) : (
          <div className="border rounded overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">开始</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">结束</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">标签</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">操作</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {selectedSegments.map((segment, index) => (
                  <tr key={index}>
                    <td className="px-3 py-2 text-sm">{formatTime(segment.startTime)}</td>
                    <td className="px-3 py-2 text-sm">{formatTime(segment.endTime)}</td>
                    <td className="px-3 py-2 text-sm">{segment.label || `片段 ${index + 1}`}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        className="text-red-500 hover:text-red-700"
                        onClick={() => removeSegment(index)}
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      {/* 导出选项 */}
      <div className="mb-4 border rounded p-3">
        <h3 className="font-medium mb-2">导出选项:</h3>
        
        <div className="grid grid-cols-2 gap-4 mb-3">
          <div>
            <label className="block text-sm font-medium mb-1">输出类型</label>
            <select 
              className="w-full border rounded px-3 py-2"
              value={outputType}
              onChange={(e) => setOutputType(e.target.value as 'video' | 'timeline')}
              disabled={!isLocalVideo}
            >
              {isLocalVideo && <option value="video">生成视频文件</option>}
              <option value="timeline">生成时间轴引用</option>
            </select>
          </div>
          
          {outputType === 'video' && (
            <div>
              <label className="block text-sm font-medium mb-1">输出格式</label>
              <select 
                className="w-full border rounded px-3 py-2"
                value={outputFormat}
                onChange={(e) => setOutputFormat(e.target.value as 'mp4' | 'webm' | 'gif')}
              >
                <option value="mp4">MP4 (推荐)</option>
                <option value="webm">WebM</option>
                <option value="gif">GIF</option>
              </select>
            </div>
          )}
        </div>
        
        {outputType === 'video' && (
          <div className="mb-3">
            <label className="flex items-center">
              <input
                type="checkbox"
                className="mr-2"
                checked={keepAudio}
                onChange={(e) => setKeepAudio(e.target.checked)}
              />
              <span>保留原始音频</span>
            </label>
          </div>
        )}
      </div>
      
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
        </div>
      )}
      
      {/* 操作按钮 */}
      <div className="flex justify-end">
        <button
          className="bg-primary text-white rounded px-4 py-2 hover:bg-primary/90 disabled:bg-gray-400"
          onClick={startProcessing}
          disabled={isProcessing || selectedSegments.length === 0}
        >
          {isProcessing ? '处理中...' : '开始处理'}
        </button>
      </div>
    </div>
  );
};

export default VideoEditor; 