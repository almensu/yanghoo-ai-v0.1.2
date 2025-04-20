import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ManifestProvider, useManifest } from '../state/context/ManifestContext';
import VideoPlayer, { VideoSource } from '../components/Controls/VideoPlayer';
import { Task, fetchManifest, getFileContent } from '../api/manifestApi';
import ReactMarkdown from 'react-markdown';

// 扩展VideoSource类型
interface ExtendedVideoSource extends VideoSource {
  mediaQuality?: string;
  dimensions?: { width: number; height: number };
  isPurged?: boolean;
  purgedReason?: string;
  purgedAt?: string;
}

// 富文本摘要类型
interface RichSummary {
  highlights: string[];
  importantTopics: Array<{
    name: string;
    description: string;
  }>;
  overview: string;
}

// 详情页内容组件
const DetailContent: React.FC = () => {
  const { manifest, isLoading, error, getFilesByType } = useManifest();
  const [markdown, setMarkdown] = useState<string>('');
  const [videoSource, setVideoSource] = useState<ExtendedVideoSource | null>(null);
  const [richSummary, setRichSummary] = useState<RichSummary | null>(null);
  const [plainSummary, setPlainSummary] = useState<string>('');
  const [audioSummary, setAudioSummary] = useState<string | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const navigate = useNavigate();

  // 加载文本内容
  useEffect(() => {
    const loadTextContent = async () => {
      if (!manifest) return;

      // 查找text_content_md文件
      const textFiles = getFilesByType('text_content_md');
      if (textFiles.length > 0 && textFiles[0].state === 'ready') {
        try {
          const content = await getFileContent(manifest.hashId, textFiles[0].path);
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

  // 加载摘要内容
  useEffect(() => {
    const loadSummaryContent = async () => {
      if (!manifest) return;

      // 加载富文本摘要
      const richSummaryFiles = getFilesByType('summary_rich_json');
      if (richSummaryFiles.length > 0 && richSummaryFiles[0].state === 'ready') {
        try {
          const content = await getFileContent(manifest.hashId, richSummaryFiles[0].path);
          if (content) {
            setRichSummary(JSON.parse(content));
          }
        } catch (err) {
          console.error('Error loading rich summary:', err);
        }
      }

      // 加载普通摘要
      const plainSummaryFiles = getFilesByType('summary_md');
      if (plainSummaryFiles.length > 0 && plainSummaryFiles[0].state === 'ready') {
        try {
          const content = await getFileContent(manifest.hashId, plainSummaryFiles[0].path);
          if (content) {
            setPlainSummary(content);
          }
        } catch (err) {
          console.error('Error loading plain summary:', err);
        }
      }

      // 加载语音摘要
      const audioSummaryFiles = getFilesByType('speech_summary_audio');
      if (audioSummaryFiles.length > 0 && audioSummaryFiles[0].state === 'ready') {
        setAudioSummary(`/api/content/${manifest.hashId}/${audioSummaryFiles[0].path}`);
      }
    };

    loadSummaryContent();
  }, [manifest, getFilesByType]);

  // 设置视频源
  useEffect(() => {
    if (!manifest) return;

    // 查找视频文件
    const videoFiles = getFilesByType('original_media');
    const infoFiles = getFilesByType('info_json');
    
    if (videoFiles.length > 0) {
      // 检查是否为已清理状态
      if (videoFiles[0].state === 'purged') {
        setVideoSource({
          type: 'other',
          url: '',
          platform: manifest.metadata?.platform || 'unknown',
          title: manifest.metadata?.title || 'Purged Video',
          thumbnailUrl: manifest.metadata?.thumbnailUrl,
          isPurged: true,
          purgedReason: videoFiles[0].metadata?.purgedReason 
            ? String(videoFiles[0].metadata.purgedReason) 
            : undefined,
          purgedAt: videoFiles[0].metadata?.purgedAt 
            ? String(videoFiles[0].metadata.purgedAt) 
            : undefined
        });
      } 
      // 本地视频
      else if (videoFiles[0].state === 'ready') {
        setVideoSource({
          type: 'local',
          url: `/api/content/${manifest.hashId}/${videoFiles[0].path}`,
          title: manifest.metadata?.title || 'Video',
          mediaQuality: videoFiles[0].metadata?.quality 
            ? String(videoFiles[0].metadata.quality) 
            : undefined,
          dimensions: videoFiles[0].metadata?.dimensions 
            ? videoFiles[0].metadata.dimensions as { width: number; height: number }
            : undefined
        });
      }
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

  // 播放语音摘要
  const toggleAudioSummary = () => {
    if (!audioSummary) return;
    
    if (!audioElement) {
      const audio = new Audio(audioSummary);
      audio.onended = () => setIsAudioPlaying(false);
      setAudioElement(audio);
      audio.play();
      setIsAudioPlaying(true);
    } else {
      if (isAudioPlaying) {
        audioElement.pause();
        setIsAudioPlaying(false);
      } else {
        audioElement.play();
        setIsAudioPlaying(true);
      }
    }
  };

  // 格式化时间戳
  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  // 格式化文件大小
  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return 'N/A';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (isLoading) {
    return (
      <div className="p-4 flex justify-center items-center min-h-[200px]">
        <div className="flex items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
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
  // 最近完成的任务
  const completedTasks = manifest.tasks.filter(task => task.state === 'done').slice(0, 5);
  // 失败的任务
  const failedTasks = manifest.tasks.filter(task => task.state === 'error').slice(0, 3);

  return (
    <div className="container mx-auto p-4">
      {/* 标题和面包屑导航 */}
      <div className="mb-6">
        <div className="flex items-center text-sm text-gray-500 mb-2">
          <button 
            className="hover:text-primary flex items-center"
            onClick={() => navigate('/')}
          >
            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            返回内容库
          </button>
          <span className="mx-2">›</span>
          <span className="truncate max-w-md">
            {manifest.metadata?.title || 'Untitled Content'}
          </span>
        </div>
        <h1 className="text-2xl font-bold">{manifest.metadata?.title || 'Untitled Content'}</h1>
        <p className="text-gray-500">{manifest.metadata?.description || ''}</p>
      </div>

      {/* 三栏布局 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 左侧 - 视频区域（占4/12） */}
        <div className="lg:col-span-4">
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {videoSource ? (
              <>
                {videoSource.isPurged ? (
                  <div className="aspect-video bg-gray-100 flex flex-col items-center justify-center p-4 text-center">
                    <div className="text-gray-400 mb-2">
                      <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </div>
                    <p className="text-gray-600 font-medium">此视频文件已被清理</p>
                    {videoSource.purgedReason && (
                      <p className="text-gray-500 text-sm mt-1">原因: {videoSource.purgedReason}</p>
                    )}
                    {videoSource.purgedAt && (
                      <p className="text-gray-500 text-sm mt-1">清理时间: {formatDate(videoSource.purgedAt)}</p>
                    )}
                    {videoSource.thumbnailUrl && (
                      <img 
                        src={videoSource.thumbnailUrl} 
                        alt="Video thumbnail" 
                        className="mt-4 max-w-full max-h-32 object-contain rounded"
                      />
                    )}
                  </div>
                ) : (
                  <VideoPlayer 
                    source={videoSource} 
                    className="w-full aspect-video" 
                  />
                )}
              </>
            ) : (
              <div className="w-full aspect-video bg-gray-200 flex items-center justify-center text-gray-400">
                无视频
              </div>
            )}
            
            {/* 处理进度条 */}
            {activeTasks.length > 0 && (
              <div className="p-3 bg-blue-50">
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium">处理中: {activeTasks[0].title}</span>
                  <span className="text-sm">{activeTasks[0].percent || 0}%</span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded">
                  <div 
                    className="h-2 bg-blue-500 rounded" 
                    style={{width: `${activeTasks[0].percent || 0}%`}}
                  ></div>
                </div>
              </div>
            )}
          </div>
          
          {/* 视频信息 */}
          {videoSource && (
            <div className="mt-4 bg-white rounded-lg shadow p-4">
              <h3 className="font-medium mb-2">视频信息</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-gray-500">平台</div>
                <div>{videoSource.platform || manifest.metadata?.platform || '本地文件'}</div>
                
                {videoSource.mediaQuality && (
                  <>
                    <div className="text-gray-500">质量</div>
                    <div>{videoSource.mediaQuality}</div>
                  </>
                )}
                
                {videoSource.dimensions && (
                  <>
                    <div className="text-gray-500">分辨率</div>
                    <div>{videoSource.dimensions.width}x{videoSource.dimensions.height}</div>
                  </>
                )}
                
                {manifest.metadata?.duration && (
                  <>
                    <div className="text-gray-500">时长</div>
                    <div>{Math.floor(manifest.metadata.duration / 60)}:{(manifest.metadata.duration % 60).toString().padStart(2, '0')}</div>
                  </>
                )}
                
                {manifest.metadata?.diskSize && (
                  <>
                    <div className="text-gray-500">文件大小</div>
                    <div>{formatFileSize(manifest.metadata.diskSize)}</div>
                  </>
                )}
              </div>
            </div>
          )}
          
          {/* 任务状态列表 */}
          <div className="mt-4 bg-white rounded-lg shadow p-4">
            <h3 className="font-medium mb-2">处理状态</h3>
            
            {/* 活动任务 */}
            {activeTasks.length > 0 && (
              <div className="mb-3">
                <h4 className="text-sm font-medium text-blue-600 mb-1">正在进行</h4>
                <div className="space-y-2">
                  {activeTasks.map((task) => (
                    <div key={task.id} className="flex justify-between text-sm p-1 bg-blue-50 rounded">
                      <span>{task.title}</span>
                      <span className={
                        task.state === 'running' ? 'text-blue-600' : 'text-yellow-600'
                      }>
                        {task.state === 'running' ? '运行中' : '队列中'}
                        {task.percent ? ` (${task.percent}%)` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* 已完成任务 */}
            {completedTasks.length > 0 && (
              <div className="mb-3">
                <h4 className="text-sm font-medium text-green-600 mb-1">已完成</h4>
                <div className="space-y-1">
                  {completedTasks.map((task) => (
                    <div key={task.id} className="flex justify-between text-sm">
                      <span>{task.title}</span>
                      <span className="text-green-600">完成</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* 失败任务 */}
            {failedTasks.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-red-600 mb-1">失败</h4>
                <div className="space-y-1">
                  {failedTasks.map((task) => (
                    <div key={task.id} className="flex justify-between text-sm">
                      <span>{task.title}</span>
                      <span className="text-red-600">错误</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* 中间 - 内容区域（占5/12） */}
        <div className="lg:col-span-5">
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-xl font-medium mb-4">内容文本</h2>
            {markdown ? (
              <div className="prose max-w-none">
                <ReactMarkdown>
                  {markdown}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="py-10 text-center">
                <p className="text-gray-500 italic">无文本内容或正在处理中</p>
                {activeTasks.some(task => 
                  ['extract_text', 'vtt_to_md', 'merge_transcripts'].includes(task.title)
                ) && (
                  <div className="mt-4 flex justify-center">
                    <div className="animate-pulse flex space-x-4 items-center">
                      <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
                      <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
                      <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
                      <p className="text-sm text-blue-500">文本内容处理中...</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* 右侧 - 摘要和元数据（占3/12） */}
        <div className="lg:col-span-3">
          {/* 摘要区域 */}
          <div className="bg-white rounded-lg shadow p-4 mb-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-medium">摘要</h2>
              
              {/* 语音摘要播放按钮 */}
              {audioSummary && (
                <button
                  className="flex items-center text-sm text-primary"
                  onClick={toggleAudioSummary}
                >
                  {isAudioPlaying ? (
                    <>
                      <svg className="w-5 h-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      暂停语音
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      播放语音
                    </>
                  )}
                </button>
              )}
            </div>
            
            {richSummary ? (
              <div>
                {/* 摘要概述 */}
                {richSummary.overview && (
                  <div className="mb-4">
                    <p className="text-gray-700">{richSummary.overview}</p>
                  </div>
                )}
                
                {/* 重点内容 */}
                {richSummary.highlights && richSummary.highlights.length > 0 && (
                  <div className="mb-4">
                    <h3 className="font-medium text-gray-700 mb-2">重点内容</h3>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      {richSummary.highlights.map((highlight, index) => (
                        <li key={index} className="text-gray-700">{highlight}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {/* 重要话题 */}
                {richSummary.importantTopics && richSummary.importantTopics.length > 0 && (
                  <div>
                    <h3 className="font-medium text-gray-700 mb-2">重要话题</h3>
                    <div className="space-y-3">
                      {richSummary.importantTopics.map((topic, index) => (
                        <div key={index} className="bg-gray-50 p-3 rounded-md">
                          <h4 className="font-medium text-gray-800">{topic.name}</h4>
                          <p className="text-sm text-gray-600 mt-1">{topic.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : plainSummary ? (
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown>
                  {plainSummary}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="py-6 text-center">
                <p className="text-gray-500 italic">无摘要内容或正在处理中</p>
                {activeTasks.some(task => 
                  ['generate_rich_summary', 'generate_speech_summary'].includes(task.title)
                ) && (
                  <div className="mt-4 flex justify-center">
                    <div className="animate-pulse flex space-x-4 items-center">
                      <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
                      <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
                      <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
                      <p className="text-sm text-blue-500">摘要生成中...</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* 元数据 */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-medium mb-3">元数据</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-gray-500">来源</div>
              <div>{manifest.metadata?.platform || 'unknown'}</div>
              
              <div className="text-gray-500">创建时间</div>
              <div>{formatDate(manifest.createdAt)}</div>
              
              <div className="text-gray-500">更新时间</div>
              <div>{formatDate(manifest.updatedAt)}</div>
              
              {manifest.metadata?.url && (
                <>
                  <div className="text-gray-500">原始链接</div>
                  <div className="truncate">
                    <a 
                      href={manifest.metadata.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {new URL(manifest.metadata.url).hostname}
                    </a>
                  </div>
                </>
              )}
            </div>
            
            {/* 标签 */}
            {manifest.metadata?.topics && manifest.metadata.topics.length > 0 && (
              <div className="mt-4">
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