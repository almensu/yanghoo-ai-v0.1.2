# 前端架构设计

## 技术栈
- React (CRA 原生脚手架)
- TypeScript
- DaisyUI (基于Tailwind CSS)

## 组件层级结构

```
app/
├── components/             # 共享组件库
│   ├── UI/                 # 基础UI组件
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Modal.tsx
│   │   ├── Tag.tsx
│   │   └── Progress.tsx
│   ├── Layout/             # 布局组件
│   │   ├── Header.tsx
│   │   ├── Sidebar.tsx
│   │   ├── Footer.tsx
│   │   └── ThreeColumnLayout.tsx
│   └── Controls/           # 交互控件
│       ├── VideoPlayer.tsx       # 支持本地和远程视频
│       ├── TranscriptViewer.tsx
│       ├── TopicTags.tsx
│       └── ProgressTracker.tsx   # 任务进度追踪器
├── pages/                  # 页面组件
│   ├── Home.tsx            # 主页(库列表)
│   └── Detail.tsx          # 详情页(三栏布局)
├── api/                    # API层
│   ├── manifestApi.ts      # Manifest读写接口
│   ├── libraryApi.ts       # Library操作接口
│   └── taskApi.ts          # 任务操作接口
├── state/                  # 状态管理
│   ├── context/            # React Context
│   │   ├── ManifestContext.tsx
│   │   └── UIContext.tsx
│   └── hooks/              # 自定义Hooks
│       ├── useManifest.ts
│       ├── useLibrary.ts
│       └── useTasks.ts
├── utils/                  # 工具函数
│   ├── formatters.ts       # 数据格式化
│   ├── validators.ts       # 数据验证
│   └── mediaUtils.ts       # 媒体处理
└── styles/                 # 全局样式
    ├── theme.css           # 主题变量
    └── global.css          # 全局样式
```

## 数据流向

1. **API层** → **状态层** → **视图层**
   - API层负责与后端交互，获取和更新数据
   - 状态层使用Context API管理全局状态
   - 视图层根据状态渲染UI

## 视频播放器设计

- 统一播放器接口，支持多种视频源:
  - 本地视频文件 (直接使用HTML5 video标签)
  - YouTube (使用iframe嵌入)
  - Twitter (使用Twitter embed API)
  - 其他平台 (根据info.json中的platform字段选择适当的播放器)
- 播放器组件结构:
  ```
  VideoPlayer/
  ├── VideoPlayer.tsx            # 主组件，根据视频类型选择合适的播放器
  ├── LocalVideoPlayer.tsx       # 本地视频播放器
  ├── YouTubePlayer.tsx          # YouTube播放器
  ├── TwitterPlayer.tsx          # Twitter播放器
  └── VideoControls.tsx          # 通用播放控制UI
  ```

## UI与Manifest对应关系

根据Manifest规范中的"UI Mapping Cheat-Sheet"，前端组件与FileItem类型的对应关系如下:

| UI区域 | 对应FileItem类型 | 组件 |
|--------|-----------------|------|
| 视频播放区 | original_media, info_json | VideoPlayer.tsx |
| 字幕显示区 | transcript_merged_vtt | TranscriptViewer.tsx |
| 文本内容区 | text_content_md | MarkdownViewer.tsx |
| 摘要区 | summary_md, summary_rich_json | SummaryViewer.tsx |
| 话题标签区 | topic_tags_json | TopicTags.tsx |
| 截图集区 | screenshot_collection_json, screenshot_image | ScreenshotGallery.tsx |
| 文章编辑区 | article_md | ArticleEditor.tsx |
| 文本对话区 | text_chat_history_json | TextChatInterface.tsx |
| 图像对话区 | image_chat_history_json | ImageChatInterface.tsx |

## 状态管理策略

使用React Context API创建三个主要Context:
1. **ManifestContext**: 管理当前内容的manifest数据
2. **LibraryContext**: 管理library.json数据和筛选/排序状态
3. **UIContext**: 管理UI状态(如当前页面、模态框、侧边栏等)

## 响应式设计

- 桌面优先设计，但支持平板和移动设备
- 关键断点:
  - 大屏(>1280px): 三栏布局
  - 中屏(768-1280px): 两栏布局
  - 小屏(<768px): 单栏布局，使用标签页切换内容

## 主题与样式变量

基于DaisyUI主题系统，定义以下全局变量:
- 主色调: 蓝色系 (#3b82f6)
- 强调色: 紫色系 (#8b5cf6)
- 中性色: 灰色系 (#e5e7eb)
- 文本色: 深灰 (#1f2937)
- 背景色: 浅灰 (#f9fafb)

支持深色模式自动切换。 