# AI对话管理工具

AI对话管理工具用于统一管理内容库中的所有AI对话历史，支持文本和图像对话的索引、搜索、导出和导入。

## 功能特性

- 对话索引：自动收集并索引所有文本和图像对话历史
- 对话搜索：基于类型、内容、标签和时间搜索对话
- 标签管理：为对话添加和移除标签，便于分类和检索
- 对话导出：支持导出单个对话或批量导出所有对话
- 对话导入：支持导入对话到指定内容
- 对话共享：允许在不同内容之间引用对话
- 对话统计：自动维护消息计数和最后更新时间

## 安装

```bash
cd workers/chat-manager
npm install
```

## 使用方法

### 交互式模式

```bash
npx ts-node index.ts
```

将显示一个菜单，提供以下选项：
1. 更新所有聊天集合
2. 查看聊天列表
3. 搜索聊天
4. 导出聊天
5. 导入聊天
6. 管理标签

### 命令模式

#### 更新所有聊天集合

```bash
npx ts-node index.ts update-all [内容库根目录]
```

#### 更新单个聊天集合

```bash
npx ts-node index.ts update <manifest.json路径>
```

#### 导出所有聊天

```bash
npx ts-node index.ts export <manifest.json路径> <输出路径>
```

#### 导入聊天

```bash
npx ts-node index.ts import <聊天文件路径> <目标manifest路径>
```

## 聊天集合格式

聊天集合文件(`chats/collection.json`)遵循以下格式：

```json
{
  "version": "1.0",
  "chats": [
    {
      "id": "text-chat-1",
      "type": "text",
      "title": "内容分析",
      "sourcePath": "chats/text_chat.json",
      "messageCount": 8,
      "createdAt": "2025-04-18T14:25:36Z",
      "updatedAt": "2025-04-18T14:28:12Z"
    },
    {
      "id": "image-chat-1",
      "type": "image",
      "title": "截图分析",
      "sourcePath": "chats/image_chat.json",
      "messageCount": 6,
      "createdAt": "2025-04-18T15:40:22Z",
      "updatedAt": "2025-04-18T15:43:05Z"
    }
  ],
  "tags": {
    "重要": ["text-chat-1"],
    "参考": ["image-chat-1"]
  }
}
```

## API

该工具也提供API以供其他模块调用：

```typescript
import {
  updateChatCollection,
  searchChats,
  exportChat,
  exportAllChats,
  importChat,
  addTagToChat,
  removeTagFromChat
} from './workers/chat-manager';
``` 