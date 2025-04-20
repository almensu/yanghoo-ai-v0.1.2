import React, { useEffect, useRef } from 'react';

interface YouTubePlayerProps {
  videoId: string;
  isPlaying: boolean;
  volume: number;
  currentTime: number;
  onTimeUpdate: (time: number) => void;
  onDurationChange: (duration: number) => void;
  onEnded?: () => void;
  className?: string;
}

// Define YouTube Player API types
declare global {
  interface Window {
    YT: {
      Player: any;
      PlayerState: {
        PLAYING: number;
        PAUSED: number;
        ENDED: number;
      };
      loaded: number;
    };
    onYouTubeIframeAPIReady: () => void;
  }
}

const YouTubePlayer: React.FC<YouTubePlayerProps> = ({
  videoId,
  isPlaying,
  volume,
  currentTime,
  onTimeUpdate,
  onDurationChange,
  onEnded,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const timeUpdateInterval = useRef<NodeJS.Timeout | null>(null);

  // Load YouTube API
  useEffect(() => {
    // Function to load YouTube API script
    const loadYouTubeApi = () => {
      if (window.YT && window.YT.Player) return;

      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

      // This function will be called by YouTube API when ready
      window.onYouTubeIframeAPIReady = initPlayer;
    };

    loadYouTubeApi();

    return () => {
      if (timeUpdateInterval.current) {
        clearInterval(timeUpdateInterval.current);
      }
    };
  }, []);

  // Initialize player
  const initPlayer = () => {
    if (!containerRef.current) return;
    
    playerRef.current = new window.YT.Player(containerRef.current, {
      videoId,
      playerVars: {
        autoplay: isPlaying ? 1 : 0,
        controls: 0,
        rel: 0,
        showinfo: 0,
        modestbranding: 1,
        iv_load_policy: 3,
      },
      events: {
        onReady: onPlayerReady,
        onStateChange: onPlayerStateChange,
      },
    });
  };

  // Handle player ready event
  const onPlayerReady = (event: any) => {
    if (playerRef.current) {
      // Set initial volume
      playerRef.current.setVolume(volume * 100);
      
      // Report duration
      const duration = playerRef.current.getDuration();
      onDurationChange(duration);
      
      // Seek to initial position
      if (currentTime > 0) {
        playerRef.current.seekTo(currentTime, true);
      }
      
      // Start time tracking interval
      startTimeTracking();
    }
  };

  // Handle player state changes
  const onPlayerStateChange = (event: any) => {
    if (event.data === window.YT.PlayerState.ENDED && onEnded) {
      onEnded();
    }
  };

  // Start tracking current time
  const startTimeTracking = () => {
    if (timeUpdateInterval.current) {
      clearInterval(timeUpdateInterval.current);
    }

    timeUpdateInterval.current = setInterval(() => {
      if (playerRef.current) {
        const currentTime = playerRef.current.getCurrentTime();
        onTimeUpdate(currentTime);
      }
    }, 250);
  };

  // Update player state when props change
  useEffect(() => {
    if (!playerRef.current) return;

    // Handle play/pause
    if (isPlaying) {
      playerRef.current.playVideo();
    } else {
      playerRef.current.pauseVideo();
    }
  }, [isPlaying]);

  // Handle volume changes
  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.setVolume(volume * 100);
    }
  }, [volume]);

  // Handle seeking
  useEffect(() => {
    if (playerRef.current && playerRef.current.seekTo) {
      const currentPlayerTime = playerRef.current.getCurrentTime();
      if (Math.abs(currentPlayerTime - currentTime) > 0.5) {
        playerRef.current.seekTo(currentTime, true);
      }
    }
  }, [currentTime]);

  return (
    <div className={`youtube-player-container ${className}`}>
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
};

export default YouTubePlayer; 