# 资源管理工具

资源管理工具用于管理内容库的存储空间，支持清理媒体文件、统计磁盘使用情况，并更新库索引。

## 功能特性

- 磁盘使用统计：按文件类型、总大小统计存储空间使用情况
- 智能清理建议：根据文件大小和访问时间提供清理建议
- 灵活的清理策略：
  - 完全删除：删除所有内容
  - 保留处理结果：仅删除原始媒体文件，保留字幕、摘要等处理结果
- 自动更新清单和索引：
  - 更新manifest.json中的文件状态
  - 更新library.json以反映最新的内容状态
- 命令行界面：支持交互式和命令模式

## 安装

```bash
cd workers/resource-manager
npm install
```

## 使用方法

### 交互式模式

```bash
npx ts-node index.ts
```

将显示一个菜单，提供以下选项：
1. 显示磁盘使用统计
2. 生成清理建议
3. 清理单个内容
4. 批量清理内容
5. 更新库索引

### 命令模式

#### 统计磁盘使用情况

```bash
npx ts-node index.ts stats [内容库根目录]
```

#### 生成清理建议

```bash
npx ts-node index.ts suggestions [内容库根目录] [访问阈值天数] [大小阈值MB]
```

#### 清理单个内容

```bash
npx ts-node index.ts purge <manifest.json路径> [true|false]
```
- 第二个参数：true表示保留处理结果，false表示完全删除

#### 更新库索引

```bash
npx ts-node index.ts update-index [内容库根目录]
```

## 配置

内容库的根目录默认为`storage/content-studio`，可以通过命令行参数修改。

## Manifest规范

资源清理遵循Manifest规范中的要求：
- 当视频被删除时，更新`original_media.state`为'purged'
- 添加`purgedAt`和`purgedReason`元数据
- 更新`library.json`中的`hasOriginalMedia`状态

## API

该工具也提供API以供其他模块调用：

```typescript
import {
  calculateDiskStats,
  generateCleanupSuggestions,
  purgeContent,
  batchPurgeContent,
  updateLibraryIndex
} from './workers/resource-manager';
``` 