import React, { useEffect, useRef } from 'react';

interface LocalVideoPlayerProps {
  url: string;
  isPlaying: boolean;
  volume: number;
  startTime: number;
  onTimeUpdate: (time: number) => void;
  onDurationChange: (duration: number) => void;
  onEnded?: () => void;
  setPlayerRef: (ref: HTMLVideoElement | null) => void;
  poster?: string;
  className?: string;
}

const LocalVideoPlayer: React.FC<LocalVideoPlayerProps> = ({
  url,
  isPlaying,
  volume,
  startTime,
  onTimeUpdate,
  onDurationChange,
  onEnded,
  setPlayerRef,
  poster,
  className = '',
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Set video reference for parent component
  useEffect(() => {
    if (videoRef.current) {
      setPlayerRef(videoRef.current);
    }

    return () => setPlayerRef(null);
  }, [setPlayerRef]);

  // Handle play/pause state changes
  useEffect(() => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.play().catch(err => {
        console.error('Error playing video:', err);
      });
    } else {
      videoRef.current.pause();
    }
  }, [isPlaying]);

  // Handle volume changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
    }
  }, [volume]);

  // Handle seek position changes
  useEffect(() => {
    if (videoRef.current && Math.abs(videoRef.current.currentTime - startTime) > 0.5) {
      videoRef.current.currentTime = startTime;
    }
  }, [startTime]);

  return (
    <video
      ref={videoRef}
      src={url}
      className={`w-full h-full object-contain ${className}`}
      poster={poster}
      preload="metadata"
      onTimeUpdate={(e) => onTimeUpdate(e.currentTarget.currentTime)}
      onDurationChange={(e) => onDurationChange(e.currentTarget.duration)}
      onEnded={onEnded}
      playsInline
    />
  );
};

export default LocalVideoPlayer; 