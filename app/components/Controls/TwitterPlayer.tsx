import React, { useEffect, useRef } from 'react';

interface TwitterPlayerProps {
  tweetId: string;
  onLoad?: () => void;
  className?: string;
}

// Define Twitter Widget API types
declare global {
  interface Window {
    twttr: {
      widgets: {
        load: (element?: HTMLElement) => Promise<any>;
        createTweet: (
          tweetId: string,
          element: HTMLElement,
          options?: any
        ) => Promise<HTMLElement>;
      };
    };
  }
}

const TwitterPlayer: React.FC<TwitterPlayerProps> = ({
  tweetId,
  onLoad,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Load Twitter Widget API
  useEffect(() => {
    // Function to load Twitter Widget API script
    const loadTwitterApi = () => {
      if (window.twttr) return Promise.resolve();

      return new Promise<void>((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://platform.twitter.com/widgets.js';
        script.async = true;
        script.onload = () => resolve();
        document.body.appendChild(script);
      });
    };

    const loadTweet = async () => {
      if (!containerRef.current) return;

      try {
        await loadTwitterApi();
        
        // Clear container before embedding
        containerRef.current.innerHTML = '';
        
        // Create tweet embed
        await window.twttr.widgets.createTweet(
          tweetId,
          containerRef.current,
          {
            align: 'center',
            conversation: 'none', // Hide conversation
            cards: 'hidden', // Show cards (images/videos)
            width: '100%',
            dnt: true, // Do not track
          }
        );

        // Call onLoad callback if provided
        if (onLoad) onLoad();
      } catch (error) {
        console.error('Error embedding Twitter content:', error);
      }
    };

    loadTweet();
  }, [tweetId, onLoad]);

  return (
    <div 
      ref={containerRef} 
      className={`twitter-embed-container overflow-hidden ${className}`}
    >
      {/* Tweet will be embedded here */}
      <div className="flex items-center justify-center min-h-[200px] text-gray-500">
        Loading tweet...
      </div>
    </div>
  );
};

export default TwitterPlayer; 