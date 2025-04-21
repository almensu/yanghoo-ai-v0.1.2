import React, { useState, useEffect, useRef } from 'react';

interface VideoControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
}

const VideoControls: React.FC<VideoControlsProps> = ({
  isPlaying,
  currentTime,
  duration,
  volume,
  onPlayPause,
  onSeek,
  onVolumeChange,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [displayTime, setDisplayTime] = useState(currentTime);
  const [isVolumeOpen, setIsVolumeOpen] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);
  const volumeTimeout = useRef<NodeJS.Timeout | null>(null);

  // Format time as MM:SS
  const formatTime = (timeInSeconds: number): string => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  // Update display time when currentTime changes (if not dragging)
  useEffect(() => {
    if (!isDragging) {
      setDisplayTime(currentTime);
    }
  }, [currentTime, isDragging]);

  // Handle progress bar click/drag
  const handleProgressBarInteraction = (clientX: number) => {
    if (!progressRef.current) return;

    const rect = progressRef.current.getBoundingClientRect();
    const position = (clientX - rect.left) / rect.width;
    const newTime = Math.max(0, Math.min(position * duration, duration));
    
    setDisplayTime(newTime);
    if (!isDragging) {
      onSeek(newTime);
    }
  };

  // Handle mouse move during progress bar drag
  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      handleProgressBarInteraction(e.clientX);
    }
  };

  // Handle mouse up to end dragging
  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      onSeek(displayTime);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    }
  };

  // Add and remove event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, displayTime]);

  // Handle mouse down on progress bar
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    handleProgressBarInteraction(e.clientX);
  };

  // Handle volume icon click
  const handleVolumeIconClick = () => {
    // Toggle volume mute
    if (volume > 0) {
      onVolumeChange(0);
    } else {
      onVolumeChange(1);
    }
  };

  // Handle volume slider change
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    onVolumeChange(newVolume);
  };

  // Show volume controls on hover and hide after delay
  const showVolumeControls = () => {
    setIsVolumeOpen(true);
    if (volumeTimeout.current) {
      clearTimeout(volumeTimeout.current);
    }
  };

  const hideVolumeControls = () => {
    volumeTimeout.current = setTimeout(() => {
      setIsVolumeOpen(false);
    }, 2000);
  };

  // Calculate progress percentage
  const progressPercentage = (displayTime / duration) * 100 || 0;

  return (
    <div className="video-controls absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 text-white opacity-0 transition-opacity duration-300 hover:opacity-100">
      {/* Progress bar */}
      <div 
        ref={progressRef}
        className="progress-bar relative h-1 w-full cursor-pointer bg-gray-600 mb-2"
        onClick={(e) => handleProgressBarInteraction(e.clientX)}
        onMouseDown={handleMouseDown}
      >
        <div 
          className="progress-fill absolute left-0 top-0 h-full bg-blue-500"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>

      <div className="flex items-center justify-between">
        {/* Play/Pause button */}
        <button 
          className="play-pause-btn mr-4 rounded-full bg-transparent p-1 hover:bg-white/20"
          onClick={onPlayPause}
        >
          {isPlaying ? (
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          ) : (
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Time display */}
        <span className="time-display mr-4 text-sm">
          {formatTime(displayTime)} / {formatTime(duration)}
        </span>

        {/* Volume control */}
        <div 
          className="volume-control relative ml-auto flex items-center"
          onMouseEnter={showVolumeControls}
          onMouseLeave={hideVolumeControls}
        >
          <button 
            className="volume-btn rounded-full bg-transparent p-1 hover:bg-white/20"
            onClick={handleVolumeIconClick}
          >
            {volume === 0 ? (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
              </svg>
            ) : volume < 0.5 ? (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 9v6h4l5 5V4L11 9H7z" />
              </svg>
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
              </svg>
            )}
          </button>

          {/* Volume slider */}
          {isVolumeOpen && (
            <div className="volume-slider-container absolute bottom-full right-0 mb-2 rounded bg-black/80 p-2">
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={handleVolumeChange}
                className="volume-slider h-1 w-20 appearance-none rounded bg-gray-600"
              />
            </div>
          )}
        </div>

        {/* Fullscreen button */}
        <button 
          className="fullscreen-btn ml-4 rounded-full bg-transparent p-1 hover:bg-white/20"
          onClick={() => {
            // Fullscreen functionality would be implemented here
          }}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default VideoControls; 