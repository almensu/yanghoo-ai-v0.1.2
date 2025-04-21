import React, { useState, useRef, useEffect } from 'react';

export interface VideoSource {
  type: 'local' | 'youtube' | 'twitter' | 'other';
  url: string;
  title?: string;
  poster?: string;
  platform?: string;
  thumbnailUrl?: string;
  mediaQuality?: string;
  isPurged?: boolean;
  purgedAt?: string;
  purgedReason?: string;
}

// 类型别名，用于Detail页面的扩展接口
export type ExtendedVideoSource = VideoSource;

interface VideoPlayerProps {
  source: VideoSource;
  width?: string | number;
  height?: string | number;
  autoPlay?: boolean;
  controls?: boolean;
  muted?: boolean;
  className?: string;
  subtitles?: {
    src: string;
    label: string;
    language: string;
  }[];
}

/**
 * VideoPlayer component that handles different video types
 * Based on the video source type, it renders the appropriate player component
 */
const VideoPlayer: React.FC<VideoPlayerProps> = ({
  source,
  width = '100%',
  height = 'auto',
  autoPlay = false,
  controls = true,
  muted = false,
  className = '',
  subtitles = []
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // 处理时间更新
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  // 处理元数据加载
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  // 显示嵌入式iframe
  const renderEmbed = () => {
    if (source.type === 'youtube') {
      // 从YouTube URL中提取视频ID
      const videoId = source.url.includes('v=') 
        ? new URLSearchParams(source.url.split('?')[1]).get('v')
        : source.url.split('/').pop();
        
      return (
        <iframe
          width={width}
          height={typeof height === 'number' ? height : 480}
          src={`https://www.youtube.com/embed/${videoId}?autoplay=${autoPlay ? 1 : 0}&mute=${muted ? 1 : 0}`}
          title={source.title || "YouTube video player"}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className={className}
        ></iframe>
      );
    } else if (source.type === 'twitter') {
      // 推特嵌入
      return (
        <blockquote className={`twitter-tweet ${className}`} data-conversation="none">
          <a href={source.url}>{source.title || "Twitter Content"}</a>
        </blockquote>
      );
    } else {
      // 其他嵌入类型
      return (
        <div className={`bg-gray-100 p-4 text-center rounded ${className}`}>
          <a 
            href={source.url} 
            target="_blank" 
            rel="noreferrer"
            className="text-blue-500 hover:underline"
          >
            {source.title || "View external content"}
          </a>
        </div>
      );
    }
  };

  // 本地视频播放器
  const renderLocalVideo = () => {
    return (
      <video
        ref={videoRef}
        width={width}
        height={height}
        poster={source.poster || source.thumbnailUrl}
        controls={controls}
        autoPlay={autoPlay}
        muted={muted}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        className={`max-w-full rounded ${className}`}
      >
        <source src={source.url} />
        {subtitles.map((subtitle, index) => (
          <track
            key={index}
            kind="subtitles"
            src={subtitle.src}
            label={subtitle.label}
            srcLang={subtitle.language}
          />
        ))}
        您的浏览器不支持HTML5视频标签。
      </video>
    );
  };

  return (
    <div className="video-player">
      {source.type === 'local' ? renderLocalVideo() : renderEmbed()}
    </div>
  );
};

export default VideoPlayer; 