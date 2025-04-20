import React, { useState, useEffect } from 'react';
import LocalVideoPlayer from './LocalVideoPlayer';
import YouTubePlayer from './YouTubePlayer';
import TwitterPlayer from './TwitterPlayer';
import VideoControls from './VideoControls';

export type VideoSource = {
  type: 'local' | 'youtube' | 'twitter' | 'other';
  url: string;
  platform?: string;
  title?: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  poster?: string;
};

interface VideoPlayerProps {
  source: VideoSource;
  autoPlay?: boolean;
  onTimeUpdate?: (currentTime: number) => void;
  onEnded?: () => void;
  startTime?: number;
  className?: string;
}

/**
 * VideoPlayer component that handles different video types
 * Based on the video source type, it renders the appropriate player component
 */
const VideoPlayer: React.FC<VideoPlayerProps> = ({
  source,
  autoPlay = false,
  onTimeUpdate,
  onEnded,
  startTime = 0,
  className = '',
}) => {
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [currentTime, setCurrentTime] = useState(startTime);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [playerRef, setPlayerRef] = useState<HTMLVideoElement | null>(null);

  // Handle play/pause
  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  // Seek to a specific time
  const handleSeek = (time: number) => {
    setCurrentTime(time);
    if (playerRef && source.type === 'local') {
      playerRef.currentTime = time;
    }
  };

  // Handle volume change
  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    if (playerRef && source.type === 'local') {
      playerRef.volume = newVolume;
    }
  };

  // Update time display
  const handleTimeUpdate = (time: number) => {
    setCurrentTime(time);
    onTimeUpdate && onTimeUpdate(time);
  };

  // Determine which player component to render based on source type
  const renderPlayer = () => {
    switch (source.type) {
      case 'local':
        return (
          <LocalVideoPlayer
            url={source.url}
            isPlaying={isPlaying}
            volume={volume}
            startTime={currentTime}
            onTimeUpdate={handleTimeUpdate}
            onDurationChange={setDuration}
            onEnded={onEnded}
            setPlayerRef={setPlayerRef}
            poster={source.poster}
            className={className}
          />
        );
      case 'youtube':
        return (
          <YouTubePlayer
            videoId={source.url}
            isPlaying={isPlaying}
            volume={volume}
            currentTime={currentTime}
            onTimeUpdate={handleTimeUpdate}
            onDurationChange={setDuration}
            onEnded={onEnded}
            className={className}
          />
        );
      case 'twitter':
        return (
          <TwitterPlayer
            tweetId={source.url}
            onLoad={() => {}}
            className={className}
          />
        );
      default:
        return (
          <div className={`flex items-center justify-center bg-gray-200 ${className}`}>
            <p className="text-gray-600">
              Unsupported video type: {source.platform || source.type}
            </p>
            {source.thumbnailUrl && (
              <img 
                src={source.thumbnailUrl} 
                alt={source.title || 'Video thumbnail'} 
                className="max-w-full max-h-full"
              />
            )}
          </div>
        );
    }
  };

  return (
    <div className="video-player-container relative">
      {renderPlayer()}
      
      {/* Only show controls for supported player types */}
      {['local', 'youtube'].includes(source.type) && (
        <VideoControls
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          volume={volume}
          onPlayPause={togglePlay}
          onSeek={handleSeek}
          onVolumeChange={handleVolumeChange}
        />
      )}
    </div>
  );
};

export default VideoPlayer; 