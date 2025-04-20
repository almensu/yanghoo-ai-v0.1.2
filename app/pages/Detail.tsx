import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ManifestProvider, useManifest } from '../state/context/ManifestContext';
import VideoPlayer, { VideoSource } from '../components/Controls/VideoPlayer';
import { Task, fetchManifest, getFileContent } from '../api/manifestApi';

// 详情页内容组件
const DetailContent: React.FC = () => {
  const { manifest, isLoading, error, getFilesByType } = useManifest();
  const [markdown, setMarkdown] = useState<string>('');
  const [videoSource, setVideoSource] = useState<VideoSource | null>(null);
  const navigate = useNavigate();

  // 加载文本内容
  useEffect(() => {
    const loadTextContent = async () => {
      if (!manifest) return;

      // 查找text_content_md文件
      const textFiles = getFilesByType('text_content_md');
      if (textFiles.length > 0 && textFiles[0].state === 'ready') {
        try {
          const content = await getFileContent(manifest.hashId, textFiles[0].id);
          if (content) {
            setMarkdown(content);
          }
        } catch (err) {
          console.error('Error loading text content:', err);
        }
      }
    };

    loadTextContent();
  }, [manifest, getFilesByType]);

  // 设置视频源
  useEffect(() => {
    if (!manifest) return;

    // 查找视频文件
    const videoFiles = getFilesByType('original_media');
    const infoFiles = getFilesByType('info_json');
    
    if (videoFiles.length > 0 && videoFiles[0].state === 'ready') {
      // 本地视频
      setVideoSource({
        type: 'local',
        url: `/api/content/${manifest.hashId}/${videoFiles[0].id}`,
        title: manifest.metadata?.title || 'Video',
      });
    } else if (infoFiles.length > 0 && infoFiles[0].state === 'ready') {
      // 远程视频（从info.json中获取平台信息）
      const platform = manifest.metadata?.platform || 'unknown';
      
      if (platform === 'youtube' && manifest.metadata?.videoId) {
        setVideoSource({
          type: 'youtube',
          url: manifest.metadata.videoId,
          platform: 'youtube',
          title: manifest.metadata?.title || 'YouTube Video',
          thumbnailUrl: manifest.metadata?.thumbnailUrl,
        });
      } else if (platform === 'twitter' && manifest.metadata?.tweetId) {
        setVideoSource({
          type: 'twitter',
          url: manifest.metadata.tweetId,
          platform: 'twitter',
          title: manifest.metadata?.title || 'Twitter Video',
          thumbnailUrl: manifest.metadata?.thumbnailUrl,
        });
      } else {
        setVideoSource({
          type: 'other',
          url: '',
          platform: platform,
          title: manifest.metadata?.title || 'Video',
          thumbnailUrl: manifest.metadata?.thumbnailUrl,
        });
      }
    }
  }, [manifest, getFilesByType]);

  if (isLoading) {
    return (
      <div className="p-4 flex justify-center items-center min-h-[200px]">
        <div className="loading">
          <div className="loading-spinner"></div>
          <span className="ml-2">加载中...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4" role="alert">
          <p className="font-bold">错误</p>
          <p>{error}</p>
          <button 
            className="mt-2 bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-2 rounded"
            onClick={() => navigate('/')}
          >
            返回主页
          </button>
        </div>
      </div>
    );
  }

  if (!manifest) {
    return (
      <div className="p-4 text-center">
        <p className="text-gray-500">未找到内容</p>
        <button 
          className="mt-2 bg-primary hover:bg-primary/90 text-white font-bold py-1 px-4 rounded"
          onClick={() => navigate('/')}
        >
          返回主页
        </button>
      </div>
    );
  }

  // 获取活动任务
  const activeTasks = manifest.tasks.filter(task => task.state === 'running' || task.state === 'queued');

  return (
    <div className="container mx-auto p-4">
      {/* 标题 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{manifest.metadata?.title || 'Untitled Content'}</h1>
        <p className="text-gray-500">{manifest.metadata?.description || ''}</p>
      </div>

      {/* 三栏布局 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧 - 视频区域 */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {videoSource ? (
              <VideoPlayer source={videoSource} className="w-full aspect-video" />
            ) : (
              <div className="w-full aspect-video bg-gray-200 flex items-center justify-center text-gray-400">
                无视频
              </div>
            )}
            
            {/* 处理进度条 */}
            {activeTasks.length > 0 && (
              <div className="p-3 bg-blue-50">
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium">处理中: {activeTasks[0].type}</span>
                  <span className="text-sm">{activeTasks[0].metadata?.percent || 0}%</span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded">
                  <div 
                    className="h-2 bg-blue-500 rounded" 
                    style={{width: `${activeTasks[0].metadata?.percent || 0}%`}}
                  ></div>
                </div>
              </div>
            )}
          </div>
          
          {/* 任务状态列表 */}
          <div className="mt-4 bg-white rounded-lg shadow p-4">
            <h3 className="font-medium mb-2">处理状态</h3>
            <div className="space-y-2">
              {manifest.tasks.slice(0, 5).map((task) => (
                <div key={task.id} className="flex justify-between text-sm">
                  <span>{task.type}</span>
                  <span className={
                    task.state === 'done' ? 'text-green-600' :
                    task.state === 'running' ? 'text-blue-600' :
                    task.state === 'queued' ? 'text-yellow-600' :
                    'text-red-600'
                  }>
                    {
                      task.state === 'done' ? '完成' :
                      task.state === 'running' ? '运行中' :
                      task.state === 'queued' ? '队列中' :
                      '错误'
                    }
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* 中间 - 内容区域 */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-xl font-medium mb-4">内容文本</h2>
            {markdown ? (
              <div className="prose max-w-none">
                {markdown.split('\n').map((line, index) => (
                  <React.Fragment key={index}>
                    {line}
                    <br />
                  </React.Fragment>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 italic">无文本内容或正在处理中</p>
            )}
          </div>
        </div>
        
        {/* 右侧 - 摘要和元数据 */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-xl font-medium mb-4">摘要与元数据</h2>
            
            {/* 元数据 */}
            <div className="mb-4">
              <h3 className="font-medium text-gray-700 mb-2">元数据</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-gray-500">来源</div>
                <div>{manifest.metadata?.platform || 'unknown'}</div>
                
                <div className="text-gray-500">创建时间</div>
                <div>{new Date(manifest.createdAt).toLocaleString()}</div>
                
                <div className="text-gray-500">更新时间</div>
                <div>{new Date(manifest.updatedAt).toLocaleString()}</div>
                
                {manifest.metadata?.duration && (
                  <>
                    <div className="text-gray-500">时长</div>
                    <div>{Math.floor(manifest.metadata.duration / 60)}:{(manifest.metadata.duration % 60).toString().padStart(2, '0')}</div>
                  </>
                )}
                
                {manifest.metadata?.diskSize && (
                  <>
                    <div className="text-gray-500">文件大小</div>
                    <div>{(manifest.metadata.diskSize / (1024 * 1024)).toFixed(2)} MB</div>
                  </>
                )}
              </div>
            </div>
            
            {/* 标签 */}
            {manifest.metadata?.topics && manifest.metadata.topics.length > 0 && (
              <div className="mb-4">
                <h3 className="font-medium text-gray-700 mb-2">话题标签</h3>
                <div className="flex flex-wrap gap-2">
                  {manifest.metadata.topics.map((topic, index) => (
                    <span 
                      key={index}
                      className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// 包装组件，提供Context
const Detail: React.FC = () => {
  const { hashId } = useParams<{ hashId: string }>();
  
  if (!hashId) {
    return <div>无效的内容ID</div>;
  }

  return (
    <ManifestProvider hashId={hashId}>
      <DetailContent />
    </ManifestProvider>
  );
};

export default Detail; 