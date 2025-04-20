/**
 * Library Item represents an entry in the library.json file
 * It contains presentation-level metadata for each content bucket
 */
export interface LibraryItem {
  hashId: string;
  title: string;
  description?: string;
  platform: string;
  url: string;
  thumbnailUrl?: string;
  diskSize: number;
  hasOriginalMedia: boolean;
  state: 'processing' | 'ready' | 'error' | 'purged';
  topics?: string[];
  createdAt: string;
  updatedAt: string;
  mediaQuality?: string;
  duration?: number;
  viewCount?: number;
  lastViewedAt?: string;
}

export interface LibraryFilterOptions {
  platform?: string | string[];
  state?: string | string[];
  topics?: string | string[];
  hasOriginalMedia?: boolean;
  dateRange?: {
    from?: string;
    to?: string;
  };
  search?: string;
}

export interface LibrarySortOptions {
  field: 'title' | 'createdAt' | 'updatedAt' | 'lastViewedAt' | 'diskSize' | 'viewCount';
  direction: 'asc' | 'desc';
}

/**
 * Fetches the entire library index
 */
export const fetchLibrary = async (): Promise<LibraryItem[]> => {
  try {
    const response = await fetch('/api/library');
    if (!response.ok) throw new Error(`Failed to fetch library: ${response.statusText}`);
    
    const data = await response.json();
    return data as LibraryItem[];
  } catch (error) {
    console.error('Error fetching library:', error);
    return [];
  }
};

/**
 * Fetches a filtered and sorted version of the library
 */
export const fetchFilteredLibrary = async (
  filters?: LibraryFilterOptions,
  sort?: LibrarySortOptions
): Promise<LibraryItem[]> => {
  try {
    // Build query parameters
    const params = new URLSearchParams();
    
    if (filters) {
      if (filters.platform) {
        const platforms = Array.isArray(filters.platform) 
          ? filters.platform 
          : [filters.platform];
        platforms.forEach(p => params.append('platform', p));
      }
      
      if (filters.state) {
        const states = Array.isArray(filters.state) 
          ? filters.state 
          : [filters.state];
        states.forEach(s => params.append('state', s));
      }
      
      if (filters.topics) {
        const topics = Array.isArray(filters.topics) 
          ? filters.topics 
          : [filters.topics];
        topics.forEach(t => params.append('topic', t));
      }
      
      if (filters.hasOriginalMedia !== undefined) {
        params.append('hasOriginalMedia', filters.hasOriginalMedia.toString());
      }
      
      if (filters.dateRange?.from) {
        params.append('from', filters.dateRange.from);
      }
      
      if (filters.dateRange?.to) {
        params.append('to', filters.dateRange.to);
      }
      
      if (filters.search) {
        params.append('search', filters.search);
      }
    }
    
    if (sort) {
      params.append('sortField', sort.field);
      params.append('sortDirection', sort.direction);
    }
    
    const queryString = params.toString();
    const url = `/api/library${queryString ? `?${queryString}` : ''}`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch filtered library: ${response.statusText}`);
    
    const data = await response.json();
    return data as LibraryItem[];
  } catch (error) {
    console.error('Error fetching filtered library:', error);
    return [];
  }
};

/**
 * Updates an item's view count and last viewed timestamp
 */
export const updateItemViewStats = async (hashId: string): Promise<boolean> => {
  try {
    const response = await fetch(`/api/library/${hashId}/view`, {
      method: 'POST',
    });
    
    if (!response.ok) throw new Error(`Failed to update view stats: ${response.statusText}`);
    return true;
  } catch (error) {
    console.error('Error updating view stats:', error);
    return false;
  }
};

/**
 * Deletes content by its hashId
 */
export const deleteContent = async (hashId: string): Promise<boolean> => {
  try {
    const response = await fetch(`/api/library/${hashId}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) throw new Error(`Failed to delete content: ${response.statusText}`);
    return true;
  } catch (error) {
    console.error('Error deleting content:', error);
    return false;
  }
};

/**
 * Gets all unique topics from the library for filtering
 */
export const fetchAllTopics = async (): Promise<string[]> => {
  try {
    const response = await fetch('/api/library/topics');
    if (!response.ok) throw new Error(`Failed to fetch topics: ${response.statusText}`);
    
    const data = await response.json();
    return data as string[];
  } catch (error) {
    console.error('Error fetching topics:', error);
    return [];
  }
};

/**
 * Gets disk usage statistics
 */
export const fetchDiskStats = async (): Promise<{
  totalSize: number;
  mediaSize: number;
  processedDataSize: number;
  itemCount: number;
}> => {
  try {
    const response = await fetch('/api/library/stats');
    if (!response.ok) throw new Error(`Failed to fetch disk stats: ${response.statusText}`);
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching disk stats:', error);
    return {
      totalSize: 0,
      mediaSize: 0,
      processedDataSize: 0,
      itemCount: 0,
    };
  }
}; 