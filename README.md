# XMind Style Mindmap

[![version](https://img.shields.io/github/v/tag/a735624258/obsidian-plugin-xmind-map?label=version&color=5B8FF9)](https://github.com/a735624258/obsidian-plugin-xmind-map/tags)
[![license](https://img.shields.io/github/license/a735624258/obsidian-plugin-xmind-map?color=5AD8A6)](LICENSE)
[![Obsidian](https://img.shields.io/badge/Obsidian-1.0.0%2B-7262FD)](https://obsidian.md)

> 把 Markdown 笔记的标题层级直接画成 XMind 风格思维导图：在侧边栏看全局、改结构，改动立刻写回原文件，正文改动也会实时回流到导图上。

**English** — Render any Markdown note as an XMind-style mind map inside Obsidian: radial layout, colored branches, editable nodes with two-way sync, body previews, and one-click SVG export.

| | |
|---|---|
| 当前版本 | v1.0.0 |
| 许可 | MIT |
| 平台 | Obsidian 桌面端（Windows / macOS / Linux），移动端不支持 |
| 支持范围 | Obsidian `1.0.0` 及以上（依据 `manifest.json` 的 `minAppVersion` / `isDesktopOnly`） |

---

## 1、为什么要做

Obsidian 的笔记是线性的：一篇几十个标题的笔记，在编辑器里只能从上往下读，**结构感全靠自己脑补**。

想看清结构，常见做法是把内容导出去、用别的思维导图工具再画一遍 —— 画完就和原笔记脱钩了，正文改一次，导图得重画一次。

这个插件把「标题层级」本身当数据源：**同一个文件，一边是 Markdown，一边是导图**，不需要导出，也不需要第二份副本。

## 2、它做什么

1. **画得出** —— `#` ~ `######` 按层级铺成中心放射布局，六个分支色循环取用，父子之间是贝塞尔曲线
2. **改得动** —— `Tab` 加子节点、`Enter` 加兄弟节点、`F2` 改名、`Delete` 删子树，每次操作立即写回 Markdown
3. **对得上** —— 面板开着时，文件被改动（别的编辑器、别的插件）自动重新解析刷新；点节点则跳回正文对应的标题
4. **看得细** —— 标题下的非标题行不丢：节点上的金色圆点展开正文预览框（最多 8 行 + 「查看详情 →」）
5. **收得起** —— 中心节点左右两侧各有折叠按钮，两边可以独立收展，也支持一键全部展开 / 折叠
6. **带得走** —— 一键导出 SVG，画布按实际内容裁剪、白底，可缩放不糊

## 3、怎么用

1. 打开一篇带标题的 Markdown 笔记
2. 点左侧功能区的 **network** 图标，或命令面板搜「打开当前笔记的思维导图」—— 导图在右侧面板打开
3. 双击中心节点改标题；选中节点后用 `Tab` / `Enter` 长出结构，`F2` 改名，`Delete` 删除
4. 点节点 → 左侧编辑器跳到对应标题；点节点上的金色圆点 → 展开该标题下的正文预览
5. 工具栏：刷新 / 展开全部 / 折叠全部 / 关闭预览 / 居中 / 放大 / 缩小 / 导出 SVG，右上角显示「文件名 · N 节点 · 已保存」

例子：

```markdown
%%中心：季度计划%%
# 目标
- 每周复盘一次
# 资源
- 参考笔记 A
- 参考笔记 B
```

打开导图后：「季度计划」居中，「目标」和「资源」分列左右；`- 每周复盘一次` 这类非标题行不占节点，而是挂进「目标」的正文预览（那个金色圆点）；再往 `# 目标` 下面写一个 `## 复盘模板`，导图就往外多长一层；点「资源」时编辑器跳到 `# 资源` 那一行。

| 快捷键 | 作用 |
|---|---|
| `Tab` | 给选中节点加子节点（没选中时加到中心节点） |
| `Enter` | 加一个兄弟节点（选中中心节点时等同加子节点） |
| `F2` / 双击节点 | 编辑节点文字（`Enter` 提交，`Esc` 取消） |
| `Delete` / `Backspace` | 删除选中节点及其子树（中心节点不可删） |
| `空格` | 折叠 / 展开选中节点（选中中心节点时两侧一起收展） |
| `+` `-` / 滚轮 | 放大 / 缩小（范围 0.2× ~ 3×） |
| `0` | 缩放复位并居中 |
| 拖拽空白处 | 平移画布 |

## 4、安装

### 4.1 三条路，按需要选一条

1. **要最新版** —— clone `main`，把三个文件拷进库里（`main.js` 是仓库里已提交的构建产物，不用自己编译）
   ```sh
   git clone https://github.com/a735624258/obsidian-plugin-xmind-map.git
   # 把 main.js / manifest.json / styles.css 拷到
   # <你的库>/.obsidian/plugins/obsidian-xmind-map/
   ```
2. **要固定版本** —— 用 tag `v1.0.0`
   ```sh
   git clone --branch v1.0.0 --depth 1 https://github.com/a735624258/obsidian-plugin-xmind-map.git
   # 或直接下 zip：
   # https://github.com/a735624258/obsidian-plugin-xmind-map/archive/refs/tags/v1.0.0.zip
   ```
3. **要改代码** —— clone 后自己构建（见 [6、开发](#6开发)）
   ```sh
   npm install && npm run build
   ```

> ⚠️ 插件没有上架 Obsidian 社区插件市场，只能在「第三方插件」里手动装。文件夹名用 `obsidian-xmind-map`（与 `manifest.json` 的 `id` 一致，别改名）。

### 4.2 装完要重启吗

| 情况 | 怎么办 |
|---|---|
| 首次安装 | 设置 → 第三方插件 → 关掉「限制模式」→ 刷新列表 → 启用 **XMind Style Mindmap**；列表里没出现就重新加载 Obsidian |
| 换了 `main.js` | 插件代码是加载时读进内存的：重载插件或重启 Obsidian 才生效，只重开笔记没用 |

### 4.3 卸载

1. 设置 → 第三方插件 → 关闭 **XMind Style Mindmap**
2. 删掉库里的 `.obsidian/plugins/obsidian-xmind-map/` 整个目录
3. 插件自己不在库里额外留文件（卸载即删干净）；导图上的编辑改的是笔记本身，要回退靠笔记自己的备份 / 版本控制；导出的 SVG 走浏览器下载

### 4.4 兼容性与已知坑

| 环境 | 状态 |
|---|---|
| Obsidian `1.0.0` 及以上（桌面端） | 支持（`minAppVersion: 1.0.0`） |
| Obsidian 移动端（iOS / Android） | 不支持（`isDesktopOnly: true`） |
| 第三方依赖 | 无，只用 Obsidian 官方 API |

1. **导图只认标题** —— 一篇没有任何 `#` 标题的笔记只会画出一个中心节点，全文落进它的正文预览
2. **中心标题在第一行** —— `%%中心：xxx%%` 是 Obsidian 注释（阅读模式看不见，文件里在）；删掉这行后中心节点显示占位文字，双击重命名即可
3. **中心节点删不掉** —— `Delete` 对它无效，它是整棵树的根
4. **跳转按标题文字找** —— 出现同名标题时，一律跳到第一个匹配位置
5. **没有撤销栈** —— 增删改会立即写回原文件（状态栏提示「已保存」），重要笔记先 commit / 备份

## 5、它是怎么做到的

```
[Markdown 文件]  标题行 + %%中心：xxx%% + 正文行
      ↓ parseMarkdown()：按 # 层级建树，非标题行挂到当前节点的 body
[树 MindNode]   ↓ layout()：中心节点两侧各分一半子节点，按子树高度纵向排布
      ↓ render()：纯 SVG 四层 <g> —— 连线层 / 节点层 / 按钮层 / 预览层
[键盘 · 鼠标]   Tab / Enter / F2 / Delete → 改树 → treeToMarkdown() → vault.modify 写回
      ↓ vault 的 modify 事件（不是自己触发时）→ 重新解析 → 画面刷新
```

1. **双向同步靠两个标志位** —— 自己写文件前置 `_saving`，`modify` 事件里直接跳过；正开着输入框编辑时也不打断（`editing`），避免「自己改自己」的循环
2. **frontmatter 原样保留** —— 读写都先把 `---` 块整段摘出、再拼回文件开头；中心标题用 Obsidian 注释存，不污染阅读模式
3. **纯 SVG、零运行时依赖** —— 外部依赖只有 `obsidian`：连线、节点、按钮、预览框都是 SVG 元素，颜色走 `var(--background-*)` 之类的主题变量，深浅色自动跟随
4. **重解析不丢状态** —— 折叠、正文展开、左右收起这些状态按节点路径暂存，刷新后还原，不会一点同步就弹回原样
5. **权限只到当前文件** —— 全程只 `vault.read` / `vault.modify` 当前打开的那一个笔记；不 import Node 或 electron API、不发网络请求、不碰插件目录以外的文件

## 6、开发

```sh
npm install        # 装依赖（esbuild + typescript + obsidian 类型定义）
npm run build      # main.ts → main.js（打包成 CJS，obsidian / electron / codemirror 全部 external）
npm run dev        # 同上，附带 sourcemap
npx tsc --noEmit   # 类型检查（tsconfig.json 开了 strict）
```

> ⚠️ 改完源码必须 `npm run build`：Obsidian 实际加载的是根目录的 `main.js`，直接手改 `main.js` 下次构建就被覆盖。

```
obsidian-plugin-xmind-map/
├── main.ts          # 全部源码：解析 / 布局 / 渲染 / 交互 / SVG 导出
├── main.js          # esbuild 构建产物（Obsidian 加载这个）
├── manifest.json    # 插件元信息：id / 版本 / minAppVersion / isDesktopOnly
├── styles.css       # 工具栏、节点、预览框、行内编辑输入框的样式
├── package.json     # build / dev 脚本与开发依赖
├── tsconfig.json    # strict + ES2020
├── package-lock.json
├── README.md
├── CHANGELOG.md
└── LICENSE
```

测试与构建结果（实跑）：

1. `npm install`、`npm run build` 通过，**构建产物与仓库里提交的 `main.js` 逐字节一致**
2. `npx tsc --noEmit` 在 `strict` 下**还有 7 处类型报错**（`MindNode | null` 的收窄、`ItemView.addChild` 重名、`leaf` 可能为 null），构建走 esbuild、不做类型检查，所以不影响出包 —— 欢迎 PR
3. 仓库**暂无自动化测试**（`package.json` 里没有 test 脚本）；手工验证方式是装进库、打开一篇带标题的笔记，把快捷键和工具栏按钮各点一遍

---

## 更新日志

最近 1 个版本：

- **v1.0.0** —— 首个版本：标题层级渲染成 XMind 风格导图，支持双向同步、左右独立折叠、正文预览、SVG 导出

> 之后只做过**纯文档**改动（重写 README、把更新日志拆到 `CHANGELOG.md`），**不单独占版本号**。版本速览与完整历史见 **[CHANGELOG.md](CHANGELOG.md)**。

---

MIT License · [LICENSE](LICENSE)
