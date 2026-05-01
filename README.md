# PulseLocal

PulseLocal 是一个本地桌面音乐播放器，使用 Electron、React、TypeScript、Vite、Tailwind CSS、Zustand 和 SQLite 构建。当前目标是先把本地音乐导入、metadata 扫描、播放、搜索、歌单和本地数据维护跑通，再逐步扩展歌词、托盘、快捷键、音频可视化等体验。

## 已实现功能

- 导入本地音乐文件夹、单个音频文件，支持拖拽导入。
- 扫描 `mp3`、`flac`、`wav`、`m4a`、`ogg`，读取 metadata、封面和歌词路径。
- 使用 SQLite 保存音乐库、播放历史、收藏、歌单和应用设置。
- 播放、暂停、上一首、下一首、进度拖动、音量、静音恢复、循环和随机模式。
- 歌曲列表、收藏、专辑网格、专辑详情、搜索页、播放队列和近期播放。
- 搜索框支持一键清空和 `Esc` 清空，搜索页支持最近搜索记录。
- 创建、重命名、删除歌单，歌单内排序，导入/导出 `.m3u` / `.m3u8`。
- 近期播放按歌曲去重展示，可移除某首歌的全部播放历史。
- 设置页支持音乐源管理、缺失源检查、数据库备份/体检/优化、诊断报告和 CSV 导出。
- Local Storage 区域可查看数据库大小、封面缓存大小、缓存文件数，并清理未使用封面缓存。
- 支持保存播放队列、播放进度、音量、静音前音量、播放模式和界面偏好。
- 临时断开的外接硬盘或网络盘会作为缺失源保留，不会直接清空对应歌曲、收藏和歌单关联。

## 开发环境

建议使用 Node.js 20+。

```bash
npm install
npm run dev
```

常用命令：

```bash
npm run build
npm run lint
npm run package
npm run dist
```

- `npm run dev`：同时启动 Vite、Electron 主进程编译和桌面窗口。
- `npm run build`：构建前端和 Electron 主进程。
- `npm run lint`：运行 TypeScript 类型检查。
- `npm run package`：生成未安装包目录，适合本地快速检查。
- `npm run dist`：通过 electron-builder 生成安装包。

## 打包注意事项

- Electron Builder 首次打包可能需要下载 Electron 运行时，请确保能访问 GitHub Releases。
- Windows 下如果项目路径包含空格，`better-sqlite3` 这类原生依赖重建可能出现工具链警告；建议把项目放在不含空格的路径下再执行 `npm run package` 或 `npm run dist`。

## 数据位置

运行时数据保存在 Electron 的 `userData` 目录中，包括：

- `music-player.db`：SQLite 数据库。
- `artwork-cache/`：提取出的本地封面缓存。

设置页的 Local Storage 区域可以打开数据目录、复制数据路径、备份数据库、检查数据库健康状态、优化数据库、清理未使用封面缓存、导出诊断报告和导出音乐库 CSV。

诊断报告会包含应用版本、平台、架构、Node/Electron 版本、数据库健康状态、音乐库统计、音乐源状态、最近扫描 warning 摘要和设置状态标记。

## 项目结构

```text
electron/          Electron 主进程、IPC、SQLite、扫描和系统服务
src/               React 渲染进程、页面、组件、状态和播放器逻辑
scripts/           本地脚本
assets/            默认资源和示例文件
public/            打包资源
```

## 注意事项

- 本应用只索引本地音频文件，不会删除磁盘上的音乐文件。
- 如果外接硬盘或网络盘临时断开，设置页会显示缺失源；重新连接后可重新扫描，或手动移除缺失源。
- `Clean Artwork` 只删除未被歌曲或歌单引用的封面缓存文件，不会删除音乐文件。
- M3U 导入会按路径匹配当前音乐库中已存在的歌曲，未导入音乐库的文件不会自动加入歌单。
- M3U 中的 `file://`、相对路径和本地绝对路径会尝试解析；`http://`、`https://` 等网络流地址会被跳过。
