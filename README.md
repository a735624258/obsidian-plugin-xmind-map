# Obsidian XMind Style Mindmap

一个 Obsidian 插件，将 Markdown 笔记渲染为 XMind 风格的思维导图，支持双向实时同步编辑。

## 功能特性

- **XMind 风格渲染**：中心放射布局，彩色分支，平滑贝塞尔曲线连接
- **双向实时同步**：编辑导图自动更新 md，编辑 md 自动刷新导图
- **节点操作**：Tab 加子节点、Enter 加兄弟节点、Delete 删除、F2 编辑
- **正文预览**：点击节点上的金色三角图标展开正文预览框
- **跳转定位**：点击节点自动跳转到 md 文档对应标题位置
- **折叠控制**：中心节点左右两侧独立折叠（XMind 风格），支持一键折叠/展开
- **中心节点**：独立命名，存储在 `%%中心：xxx%%` 注释中，阅读模式不可见
- **Frontmatter 保护**：自动识别并保留 YAML frontmatter，不破坏文档元数据
- **SVG 导出**：一键导出当前导图为 SVG 文件

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Tab` | 添加子节点 |
| `Enter` | 添加兄弟节点 |
| `Delete` / `Backspace` | 删除节点 |
| `F2` 或双击 | 编辑节点文字 |
| `空格` | 折叠/展开子节点 |
| `+` / `-` | 放大/缩小 |
| `0` | 居中复位 |
| 滚轮 | 缩放 |
| 拖拽空白 | 平移画布 |

## 安装

1. 下载 `main.js`、`manifest.json`、`styles.css`
2. 放入 Obsidian 库的 `.obsidian/plugins/obsidian-xmind-map/` 目录
3. 设置 → 第三方插件 → 启用 "XMind Style Mindmap"

## 使用

1. 打开任意 Markdown 笔记
2. 点击侧边栏网络图标，或命令面板搜索"思维导图"
3. 导图自动渲染，双击中心节点可自定义标题

## Markdown 格式示例

```markdown
---
share_link: https://example.com
---
%%中心：个人成长体系%%
作者：某某

# 学习方法
- 费曼技巧
- 主动回忆
## 间隔重复
- 遗忘曲线
# 知识管理
- Obsidian
```

- `---` 之间的内容为 frontmatter，原样保留
- `%%中心：xxx%%` 为中心节点标题，阅读模式不可见
- `#` / `##` / `###` 标题映射为导图节点
- 标题下的正文内容可通过预览框查看

## 技术栈

- TypeScript + esbuild
- Obsidian Plugin API
- 纯 SVG 渲染，无第三方依赖

## License

MIT
