# yanghoo-ai-v0.1.2

内容工作室管道，基于Manifest规范v0.3.5构建。 

## 项目结构

- `storage/content-studio/` - 内容存储目录
  - `library.json` - 内容库索引文件，包含所有内容桶的元数据
  - `<hashId>/` - 每个内容桶目录（使用UUID作为唯一标识）
    - `manifest.json` - 内容桶的完整清单文件
    - 其他文件和目录...

## 核心功能组件

### 内容索引 (步骤3)

`src/updateLibrary.ts` 提供用于维护和更新 `library.json` 索引的功能：

- 扫描所有内容桶的 `manifest.json` 文件
- 提取展示层级的字段（标题、平台、状态等）
- 计算磁盘空间使用情况
- 维护内容标签和摘要
- 追踪媒体文件状态和质量

用法:

```bash
# 更新库索引
npx ts-node src/updateLibrary.ts
```

`library.json` 包含的关键字段:

- `hashId` - 内容桶的唯一标识
- `title` - 内容标题
- `platform` - 来源平台 (youtube, twitter等)
- `state` - 内容状态 (ingesting, processing, complete, error, purged)
- `diskSize` - 总磁盘占用空间
- `hasOriginalMedia` - 是否有原始媒体文件
- `tags` - 内容标签
- `summary` - 内容摘要

前端UI可以直接使用此索引文件，避免扫描整个文件系统来获取内容列表。 