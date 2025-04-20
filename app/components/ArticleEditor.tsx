import React, { useState, useEffect } from 'react';
import MDEditor from '@uiw/react-md-editor';
import { createArticle, updateArticle, getArticle, getArticles, deleteArticle } from '../api/manifestApi';

interface ArticleEditorProps {
  hashId: string;
  videoTimestamps?: { [key: string]: number }; // Map of text labels to timestamps for video references
}

interface Article {
  id: string;
  title: string;
  lastModified: string;
}

const ArticleEditor: React.FC<ArticleEditorProps> = ({ hashId, videoTimestamps }) => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [content, setContent] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load all articles on mount
  useEffect(() => {
    fetchArticles();
  }, [hashId]);

  // Load selected article when it changes
  useEffect(() => {
    if (selectedArticleId) {
      loadArticle(selectedArticleId);
    }
  }, [selectedArticleId]);

  const fetchArticles = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const articlesList = await getArticles(hashId);
      setArticles(articlesList);
      
      // Auto-select the first article if any exist
      if (articlesList.length > 0 && !selectedArticleId) {
        setSelectedArticleId(articlesList[0].id);
      }
    } catch (err) {
      setError('Failed to load articles');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadArticle = async (articleId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const article = await getArticle(hashId, articleId);
      if (article) {
        setContent(article.content);
        setTitle(article.title);
      }
    } catch (err) {
      setError('Failed to load article');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    setError(null);
    try {
      let success;
      
      if (isCreating) {
        success = await createArticle(hashId, content, title);
        if (success) {
          setIsCreating(false);
          await fetchArticles(); // Refresh the list to get the new article
        }
      } else if (selectedArticleId) {
        success = await updateArticle(hashId, selectedArticleId, content, title);
      }
      
      if (success) {
        setIsEditing(false);
      } else {
        setError('Failed to save article');
      }
    } catch (err) {
      setError('An error occurred while saving');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedArticleId) return;
    
    if (!window.confirm('Are you sure you want to delete this article?')) {
      return;
    }
    
    setIsLoading(true);
    setError(null);
    try {
      const success = await deleteArticle(hashId, selectedArticleId);
      if (success) {
        setSelectedArticleId(null);
        setContent('');
        setTitle('');
        await fetchArticles();
      } else {
        setError('Failed to delete article');
      }
    } catch (err) {
      setError('An error occurred while deleting');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewArticle = () => {
    setSelectedArticleId(null);
    setContent('');
    setTitle('');
    setIsCreating(true);
    setIsEditing(true);
  };

  const handleInsertTimestamp = (label: string) => {
    if (videoTimestamps && videoTimestamps[label]) {
      const timestamp = videoTimestamps[label];
      const minutes = Math.floor(timestamp / 60);
      const seconds = Math.floor(timestamp % 60);
      const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      
      const timestampMarkdown = `[${label} (${formattedTime})](${formattedTime})`;
      setContent((prevContent) => `${prevContent}\n${timestampMarkdown}`);
    }
  };

  const renderTimestampButtons = () => {
    if (!videoTimestamps) return null;
    
    return (
      <div className="mb-4">
        <p className="text-sm font-medium mb-2">Insert Timestamp:</p>
        <div className="flex flex-wrap gap-2">
          {Object.keys(videoTimestamps).map((label) => (
            <button
              key={label}
              onClick={() => handleInsertTimestamp(label)}
              className="px-2 py-1 bg-gray-200 text-xs rounded hover:bg-gray-300"
              disabled={!isEditing && !isCreating}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">笔记</h2>
        
        <div className="flex space-x-2">
          <button
            onClick={handleNewArticle}
            disabled={isLoading || (isEditing && isCreating)}
            className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 disabled:opacity-50"
          >
            新建笔记
          </button>
        </div>
      </div>
      
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-3 mb-4">
          {error}
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Article List */}
        <div className="md:col-span-1 border rounded-lg p-2 h-64 overflow-y-auto">
          <h3 className="font-medium mb-2">笔记列表</h3>
          {articles.length === 0 ? (
            <p className="text-gray-500 text-sm">暂无笔记</p>
          ) : (
            <ul className="space-y-1">
              {articles.map((article) => (
                <li 
                  key={article.id}
                  className={`p-2 rounded cursor-pointer ${
                    selectedArticleId === article.id 
                      ? 'bg-blue-100 border-blue-300' 
                      : 'hover:bg-gray-100'
                  }`}
                  onClick={() => {
                    if (!isEditing || window.confirm('放弃当前更改？')) {
                      setSelectedArticleId(article.id);
                      setIsCreating(false);
                      setIsEditing(false);
                    }
                  }}
                >
                  <div className="font-medium">{article.title}</div>
                  <div className="text-xs text-gray-500">
                    {new Date(article.lastModified).toLocaleString()}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        
        {/* Editor / Viewer */}
        <div className="md:col-span-2">
          {/* Title input */}
          {(isEditing || isCreating) ? (
            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">标题</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="笔记标题"
              />
            </div>
          ) : (
            selectedArticleId && <h3 className="text-lg font-medium mb-3">{title}</h3>
          )}
          
          {/* Timestamp toolbar */}
          {(isEditing || isCreating) && renderTimestampButtons()}
          
          {/* Editor / Content */}
          {(isCreating || (selectedArticleId && !isLoading)) && (
            <>
              {isEditing || isCreating ? (
                <MDEditor
                  value={content}
                  onChange={(val) => setContent(val || '')}
                  height={400}
                />
              ) : (
                <div className="border rounded-lg p-4 prose max-w-none h-96 overflow-y-auto">
                  <MDEditor.Markdown source={content} />
                </div>
              )}
              
              {/* Action buttons */}
              <div className="flex justify-end mt-4 space-x-2">
                {isEditing || isCreating ? (
                  <>
                    <button
                      onClick={() => {
                        if (isCreating) {
                          setIsCreating(false);
                          setSelectedArticleId(articles[0]?.id || null);
                        }
                        setIsEditing(false);
                      }}
                      className="px-3 py-1 border border-gray-300 rounded text-sm"
                      disabled={isLoading}
                    >
                      取消
                    </button>
                    <button
                      onClick={handleSave}
                      className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                      disabled={isLoading || !title.trim()}
                    >
                      保存
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleDelete}
                      className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                      disabled={isLoading}
                    >
                      删除
                    </button>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                      disabled={isLoading}
                    >
                      编辑
                    </button>
                  </>
                )}
              </div>
            </>
          )}
          
          {isLoading && (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
              <p className="ml-2">加载中...</p>
            </div>
          )}
          
          {!selectedArticleId && !isCreating && !isLoading && (
            <div className="text-center py-10">
              <p className="text-gray-500 mb-4">选择或创建笔记</p>
              <button
                onClick={handleNewArticle}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                新建笔记
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ArticleEditor; 