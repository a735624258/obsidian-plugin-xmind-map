"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  VIEW_TYPE_XMIND: () => VIEW_TYPE_XMIND,
  default: () => XMindPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var VIEW_TYPE_XMIND = "xmind-mindmap-view";
var NODE_H = 34;
var H_GAP = 70;
var V_GAP = 14;
var NODE_PAD_X = 18;
var FONT_SIZE = 14;
var ROOT_FONT = 17;
var PREVIEW_MAX_LINES = 8;
var PREVIEW_LINE_H = 18;
var PREVIEW_PAD = 12;
var PREVIEW_MIN_W = 200;
var PREVIEW_LINK_H = 24;
var BRANCH_COLORS = [
  "#5B8FF9",
  "#5AD8A6",
  "#F6BD16",
  "#7262FD",
  "#FF9D4D",
  "#78D3F8"
];
var _idCounter = 0;
var newId = () => `n${_idCounter++}`;
var CENTER_RE = /^%%中心[：:](.*)%%\s*$/;
var CENTER_PREFIX = "%%\u4E2D\u5FC3\uFF1A";
function extractFrontmatter(md) {
  const lines = md.split("\n");
  if (lines.length === 0 || lines[0].trim() !== "---") {
    return { frontmatter: "", body: md };
  }
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      const fm = lines.slice(0, i + 1).join("\n");
      const rest = lines.slice(i + 1).join("\n");
      return { frontmatter: fm, body: rest };
    }
  }
  return { frontmatter: "", body: md };
}
function parseMarkdown(md) {
  const { frontmatter, body: mdBody } = extractFrontmatter(md);
  const lines = mdBody.split("\n");
  const rootCandidates = [];
  const stack = [];
  let centerTitle = "";
  let startIdx = 0;
  if (lines.length > 0) {
    const cm = lines[0].match(CENTER_RE);
    if (cm) {
      centerTitle = cm[1].trim();
      startIdx = 1;
    }
  }
  const nodeOf = (line, level, lineNum) => ({
    id: newId(),
    text: line.replace(/^#{1,6}\s+/, "").trim(),
    level,
    children: [],
    collapsed: false,
    body: "",
    lineStart: lineNum,
    bodyExpanded: false,
    leftCollapsed: false,
    rightCollapsed: false,
    cx: 0,
    cy: 0,
    width: 0,
    height: NODE_H,
    side: "root",
    color: ""
  });
  let preHeadingBody = "";
  for (let i = startIdx; i < lines.length; i++) {
    const raw = lines[i];
    const m = raw.match(/^(#{1,6})\s+(.+)$/);
    if (m) {
      const level = m[1].length - 1;
      const node = nodeOf(raw, level, i);
      while (stack.length && stack[stack.length - 1].level >= level)
        stack.pop();
      if (stack.length === 0) {
        rootCandidates.push(node);
      } else {
        stack[stack.length - 1].children.push(node);
      }
      stack.push(node);
    } else {
      if (stack.length) {
        const cur = stack[stack.length - 1];
        cur.body += (cur.body ? "\n" : "") + raw;
      } else {
        preHeadingBody += (preHeadingBody ? "\n" : "") + raw;
      }
    }
  }
  if (rootCandidates.length === 0) {
    const body = lines.slice(startIdx).join("\n").trim();
    const root2 = {
      id: newId(),
      text: centerTitle,
      level: 0,
      children: [],
      collapsed: false,
      body,
      lineStart: -1,
      bodyExpanded: false,
      leftCollapsed: false,
      rightCollapsed: false,
      cx: 0,
      cy: 0,
      width: 0,
      height: NODE_H,
      side: "root",
      color: ""
    };
    return { root: root2, centerTitle, frontmatter };
  }
  const root = {
    id: newId(),
    text: centerTitle,
    level: 0,
    children: rootCandidates,
    collapsed: false,
    body: preHeadingBody,
    lineStart: -1,
    bodyExpanded: false,
    leftCollapsed: false,
    rightCollapsed: false,
    cx: 0,
    cy: 0,
    width: 0,
    height: NODE_H,
    side: "root",
    color: ""
  };
  const shiftLevels = (n, delta) => {
    n.level += delta;
    n.children.forEach((c) => shiftLevels(c, delta));
  };
  rootCandidates.forEach((c) => shiftLevels(c, 1));
  return { root, centerTitle, frontmatter };
}
function nodeToMarkdown(node, indent = 0) {
  let out = "";
  const hashes = "#".repeat(Math.max(1, indent + 1));
  out += `${hashes} ${node.text}
`;
  if (node.body)
    out += node.body + "\n";
  for (const child of node.children) {
    out += nodeToMarkdown(child, indent + 1);
  }
  return out;
}
function treeToMarkdown(root, frontmatter) {
  let out = "";
  if (frontmatter) {
    out += frontmatter + "\n";
  }
  if (root.text) {
    out += `${CENTER_PREFIX}${root.text}%%
`;
  }
  if (root.body) {
    out += root.body + "\n";
  }
  for (const child of root.children) {
    out += nodeToMarkdown(child, 0);
  }
  return out;
}
function measureText(text, fontSize) {
  let w = 0;
  for (const ch of text) {
    w += /[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(ch) ? fontSize : fontSize * 0.58;
  }
  return w;
}
function computeWidth(node) {
  const fs = node.level <= 0 ? ROOT_FONT : FONT_SIZE;
  const tw = measureText(node.text || "\u65B0\u8282\u70B9", fs);
  return Math.max(60, tw + NODE_PAD_X * 2);
}
function measureSubtreeHeight(node) {
  const kids = visibleChildren(node);
  if (kids.length === 0)
    return NODE_H;
  let total = 0;
  for (const c of kids)
    total += measureSubtreeHeight(c);
  total += V_GAP * (kids.length - 1);
  return Math.max(total, NODE_H);
}
function assignColors(node) {
  if (node.level === 0 || node.level === -1) {
    node.color = "#2D3A4A";
    let i = 0;
    for (const c of node.children) {
      c.color = BRANCH_COLORS[i % BRANCH_COLORS.length];
      i++;
    }
  }
  for (const c of node.children) {
    if (c.children.length) {
      let j = 0;
      for (const gc of c.children) {
        gc.color = c.color;
        j++;
      }
    }
  }
  for (const c of node.children)
    assignColors(c);
}
function layout(node, cx, cy, side) {
  node.cx = cx;
  node.cy = cy;
  node.side = side;
  node.width = computeWidth(node);
  node.height = NODE_H;
  const kids = visibleChildren(node);
  if (kids.length === 0)
    return;
  if (side === "root") {
    const allKids = node.collapsed ? [] : node.children;
    const leftCount = Math.ceil(allKids.length / 2);
    for (let i = 0; i < allKids.length; i++) {
      allKids[i].side = i < leftCount ? "left" : "right";
    }
    const leftKids = kids.filter((c) => c.side === "left");
    const rightKids = kids.filter((c) => c.side === "right");
    let leftH = 0;
    for (const c of leftKids)
      leftH += measureSubtreeHeight(c);
    leftH += V_GAP * Math.max(0, leftKids.length - 1);
    let rightH = 0;
    for (const c of rightKids)
      rightH += measureSubtreeHeight(c);
    rightH += V_GAP * Math.max(0, rightKids.length - 1);
    const maxH = Math.max(leftH, rightH, NODE_H);
    let ly = cy - leftH / 2;
    for (const c of leftKids) {
      const ch = measureSubtreeHeight(c);
      const ccy = ly + ch / 2;
      const ccx = cx - node.width / 2 - H_GAP - computeWidth(c) / 2;
      layout(c, ccx, ccy, "left");
      ly += ch + V_GAP;
    }
    let ry = cy - rightH / 2;
    for (const c of rightKids) {
      const ch = measureSubtreeHeight(c);
      const ccy = ry + ch / 2;
      const ccx = cx + node.width / 2 + H_GAP + computeWidth(c) / 2;
      layout(c, ccx, ccy, "right");
      ry += ch + V_GAP;
    }
    node.cy = cy;
  } else {
    let totalH = 0;
    for (const c of kids)
      totalH += measureSubtreeHeight(c);
    totalH += V_GAP * (kids.length - 1);
    let yy = cy - totalH / 2;
    for (const c of kids) {
      const ch = measureSubtreeHeight(c);
      const ccy = yy + ch / 2;
      const dir = side === "right" ? 1 : -1;
      const ccx = cx + dir * (node.width / 2 + H_GAP + computeWidth(c) / 2);
      layout(c, ccx, ccy, side);
      yy += ch + V_GAP;
    }
  }
}
function visibleChildren(node) {
  if (node.collapsed)
    return [];
  const isRoot = node.level === 0 || node.level === -1;
  if (!isRoot)
    return node.children;
  return node.children.filter((c) => {
    if (c.side === "left" && node.leftCollapsed)
      return false;
    if (c.side === "right" && node.rightCollapsed)
      return false;
    return true;
  });
}
function collectNodes(node, out = []) {
  out.push(node);
  for (const c of visibleChildren(node))
    collectNodes(c, out);
  return out;
}
function collectVisibleLinks(node, out = []) {
  for (const c of visibleChildren(node)) {
    out.push({ parent: node, child: c });
    collectVisibleLinks(c, out);
  }
  return out;
}
var NS = "http://www.w3.org/2000/svg";
function el(tag, attrs = {}) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs)
    e.setAttribute(k, attrs[k]);
  return e;
}
function bezierPath(x1, y1, x2, y2) {
  const dx = Math.abs(x2 - x1);
  const cx1 = x1 + (x2 > x1 ? dx * 0.5 : -dx * 0.5);
  const cx2 = x2 + (x2 > x1 ? -dx * 0.5 : dx * 0.5);
  return `M ${x1},${y1} C ${cx1},${y1} ${cx2},${y2} ${x2},${y2}`;
}
function wrapText(text, maxWidth, fontSize) {
  const sourceLines = text.split("\n").filter((l) => l.trim() !== "");
  const result = [];
  for (const src of sourceLines) {
    const clean = src.replace(/^[-*]\s+/, "").replace(/^>\s?/, "").trim();
    let current = "";
    for (const ch of clean) {
      const testW = measureText(current + ch, fontSize);
      if (testW > maxWidth && current.length > 0) {
        result.push(current);
        current = ch;
      } else {
        current += ch;
      }
    }
    if (current)
      result.push(current);
    if (result.length >= PREVIEW_MAX_LINES)
      break;
  }
  if (result.length > PREVIEW_MAX_LINES) {
    result.length = PREVIEW_MAX_LINES;
    result[PREVIEW_MAX_LINES - 1] += " ...";
  }
  return result;
}
var XMindView = class extends import_obsidian.ItemView {
  constructor(leaf) {
    super(leaf);
    this.root = null;
    this.file = null;
    this.svg = null;
    this.linkLayer = null;
    this.nodeLayer = null;
    this.btnLayer = null;
    this.previewLayer = null;
    this.scale = 1;
    this.panX = 0;
    this.panY = 0;
    this.selected = null;
    this.editing = null;
    this.infoEl = null;
    this.wrapperEl = null;
    this._saving = false;
    // flag: we are writing to the file, ignore the modify event
    this._refEvent = () => {
    };
    this._fileOpenRef = () => {
    };
    this._firstLoad = true;
    this._frontmatter = "";
  }
  getViewType() {
    return VIEW_TYPE_XMIND;
  }
  getDisplayText() {
    return "\u601D\u7EF4\u5BFC\u56FE";
  }
  getIcon() {
    return "network";
  }
  async onOpen() {
    const container = this.contentEl;
    container.empty();
    container.addClass("xmind-container");
    const toolbar = container.createDiv({ cls: "xmind-toolbar" });
    const btnDefs = [
      ["\u5237\u65B0", () => this.reload()],
      ["\u5C55\u5F00\u5168\u90E8", () => this.expandAll()],
      ["\u6298\u53E0\u5168\u90E8", () => this.collapseAll()],
      ["\u5173\u95ED\u9884\u89C8", () => this.collapseAllPreviews()],
      ["\u5C45\u4E2D", () => this.centerView()],
      ["\u653E\u5927", () => this.zoom(1.2)],
      ["\u7F29\u5C0F", () => this.zoom(0.8)],
      ["\u5BFC\u51FA SVG", () => this.exportSVG()]
    ];
    for (const [label, handler] of btnDefs) {
      const btn = toolbar.createEl("button", { text: label });
      this.registerDomEvent(btn, "click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        handler();
      });
    }
    const spacer = toolbar.createDiv({ cls: "xmind-spacer" });
    const info = toolbar.createDiv({ cls: "xmind-info", text: "\u672A\u52A0\u8F7D\u6587\u4EF6" });
    this.infoEl = info;
    const wrapper = container.createDiv({ cls: "xmind-canvas-wrapper" });
    wrapper.setAttribute("tabindex", "0");
    this.wrapperEl = wrapper;
    const svg = el("svg", { class: "xmind-svg" });
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    wrapper.appendChild(svg);
    this.svg = svg;
    const defs = el("defs");
    defs.innerHTML = `
			<filter id="xmind-shadow" x="-20%" y="-20%" width="140%" height="140%">
				<feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.18"/>
			</filter>`;
    svg.appendChild(defs);
    this.linkLayer = el("g", { class: "xmind-link-layer" });
    this.nodeLayer = el("g", { class: "xmind-node-layer" });
    this.btnLayer = el("g", { class: "xmind-btn-layer" });
    this.previewLayer = el("g", { class: "xmind-preview-layer" });
    svg.appendChild(this.linkLayer);
    svg.appendChild(this.nodeLayer);
    svg.appendChild(this.btnLayer);
    svg.appendChild(this.previewLayer);
    const hint = wrapper.createDiv({ cls: "xmind-hint" });
    hint.innerHTML = `<kbd>Tab</kbd>\u5B50\u8282\u70B9 <kbd>Enter</kbd>\u5144\u5F1F <kbd>Del</kbd>\u5220\u9664 <kbd>F2</kbd>\u7F16\u8F91 <kbd>\u7A7A\u683C</kbd>\u6298\u53E0 <kbd>\u25B6</kbd>\u9884\u89C8\u6B63\u6587 <kbd>\u6EDA\u8F6E</kbd>\u7F29\u653E <kbd>\u62D6\u62FD</kbd>\u5E73\u79FB`;
    this.bindCanvasEvents();
    this.bindFileEvents();
    await this.loadCurrentFile();
  }
  async loadCurrentFile() {
    const f = this.app.workspace.getActiveFile();
    if (!f || f.extension !== "md") {
      this.infoEl?.setText("\u8BF7\u5728 markdown \u7B14\u8BB0\u4E2D\u6253\u5F00");
      return;
    }
    this.file = f;
    await this.reloadFromDisk();
  }
  async reloadFromDisk() {
    if (!this.file)
      return;
    const f = this.file;
    const md = await this.app.vault.read(f);
    const oldState = this.captureState();
    const { root: parsedRoot, centerTitle, frontmatter } = parseMarkdown(md);
    this.root = parsedRoot;
    this._frontmatter = frontmatter;
    this.restoreState(oldState);
    assignColors(this.root);
    if (this._firstLoad) {
      this.centerView();
      this._firstLoad = false;
    } else {
      this.render();
    }
    this.infoEl?.setText(`${f.basename} \xB7 ${collectNodes(this.root).length} \u8282\u70B9`);
  }
  /** capture collapse/bodyExpanded/sideCollapse state keyed by "level|text" */
  captureState() {
    const map = /* @__PURE__ */ new Map();
    if (!this.root)
      return map;
    const walk = (n) => {
      const key = `${n.level}|${n.text}`;
      if (n.collapsed || n.bodyExpanded || n.leftCollapsed || n.rightCollapsed) {
        map.set(key, { collapsed: n.collapsed, bodyExpanded: n.bodyExpanded, leftCollapsed: n.leftCollapsed, rightCollapsed: n.rightCollapsed });
      }
      n.children.forEach(walk);
    };
    walk(this.root);
    return map;
  }
  restoreState(map) {
    if (!this.root || map.size === 0)
      return;
    const walk = (n) => {
      const key = `${n.level}|${n.text}`;
      const s = map.get(key);
      if (s) {
        n.collapsed = s.collapsed;
        n.bodyExpanded = s.bodyExpanded;
        n.leftCollapsed = s.leftCollapsed;
        n.rightCollapsed = s.rightCollapsed;
      }
      n.children.forEach(walk);
    };
    walk(this.root);
  }
  reload() {
    this.loadCurrentFile();
  }
  async save() {
    if (!this.root || !this.file)
      return;
    this._saving = true;
    const md = treeToMarkdown(this.root, this._frontmatter);
    await this.app.vault.modify(this.file, md);
    this.infoEl?.setText(
      `${this.file.basename} \xB7 ${collectNodes(this.root).length} \u8282\u70B9 \xB7 \u5DF2\u4FDD\u5B58`
    );
    setTimeout(() => {
      this._saving = false;
    }, 200);
  }
  /* ---------- render ---------- */
  centerView() {
    if (!this.root)
      return;
    assignColors(this.root);
    layout(this.root, 0, 0, "root");
    this.scale = 1;
    this.panX = this.wrapperEl.clientWidth / 2;
    this.panY = this.wrapperEl.clientHeight / 2;
    this.render();
  }
  render() {
    if (!this.root || !this.linkLayer || !this.nodeLayer || !this.btnLayer || !this.previewLayer)
      return;
    assignColors(this.root);
    layout(this.root, 0, 0, "root");
    this.linkLayer.innerHTML = "";
    this.nodeLayer.innerHTML = "";
    this.btnLayer.innerHTML = "";
    this.previewLayer.innerHTML = "";
    const nodes = collectNodes(this.root);
    const links = collectVisibleLinks(this.root);
    for (const { parent, child } of links) {
      const dir = child.side === "right" ? 1 : -1;
      const x1 = parent.cx + dir * parent.width / 2;
      const y1 = parent.cy;
      const x2 = child.cx - dir * child.width / 2;
      const y2 = child.cy;
      const path = el("path", {
        class: "xmind-link",
        d: bezierPath(x1, y1, x2, y2),
        stroke: child.color || "#999",
        "stroke-width": Math.max(1.5, 3 - child.level * 0.4).toFixed(1).toString(),
        "stroke-linecap": "round"
      });
      this.linkLayer.appendChild(path);
    }
    for (const n of nodes) {
      const g = el("g", { class: "xmind-node" + (n === this.selected ? " selected" : "") });
      g.setAttribute("data-id", n.id);
      n.groupEl = g;
      const isRoot = n.level === 0 || n.level === -1;
      const fs = isRoot ? ROOT_FONT : FONT_SIZE;
      const rx = n.width / 2;
      const ry = n.height / 2;
      let fill = "#fff";
      let stroke = n.color || "#999";
      let textColor = "#222";
      if (isRoot) {
        fill = n.color || "#2D3A4A";
        textColor = "#fff";
      } else if (n.level === 1) {
        fill = n.color;
        textColor = "#fff";
      } else {
        fill = "#fff";
        textColor = "#222";
        stroke = n.color || "#bbb";
      }
      const rect = el("rect", {
        class: "xmind-node-rect",
        x: (n.cx - rx).toFixed(1),
        y: (n.cy - ry).toFixed(1),
        width: n.width.toFixed(1),
        height: n.height.toFixed(1),
        rx: isRoot ? "8" : "6",
        fill,
        stroke,
        "stroke-width": isRoot ? "0" : "1.5",
        filter: "url(#xmind-shadow)"
      });
      g.appendChild(rect);
      n.rectEl = rect;
      const text = el("text", {
        class: "xmind-node-text",
        x: n.cx.toFixed(1),
        y: (n.cy + fs * 0.35).toFixed(1),
        "text-anchor": "middle",
        "font-size": String(fs),
        "font-weight": isRoot ? "700" : "500",
        fill: textColor
      });
      text.textContent = n.text || (isRoot ? "\uFF08\u53CC\u51FB\u7F16\u8F91\uFF09" : "\u65B0\u8282\u70B9");
      if (!n.text && isRoot) {
        text.setAttribute("opacity", "0.4");
      }
      g.appendChild(text);
      n.textEl = text;
      if (n.body && n.body.trim()) {
        const isRootNode2 = n.level === 0 || n.level === -1;
        const isRightSide = n.side === "right";
        const badgeX = isRootNode2 ? n.cx : isRightSide ? n.cx + rx - 2 : n.cx - rx + 2;
        const badgeY = isRootNode2 ? n.cy + ry + 10 : n.cy + ry - 2;
        const badgeG = el("g", { class: "xmind-body-toggle", "data-id": n.id });
        badgeG.style.pointerEvents = "all";
        const hit = el("rect", {
          x: (badgeX - 14).toFixed(1),
          y: (badgeY - 14).toFixed(1),
          width: "28",
          height: "28",
          fill: "transparent",
          "pointer-events": "all"
        });
        badgeG.appendChild(hit);
        const badgeR = 9;
        const circle = el("circle", {
          cx: badgeX.toFixed(1),
          cy: badgeY.toFixed(1),
          r: String(badgeR),
          fill: "#F6BD16",
          stroke: "#1e1e2e",
          "stroke-width": "2",
          "pointer-events": "none"
        });
        badgeG.appendChild(circle);
        const iconSize = 4;
        let iconPath;
        if (n.bodyExpanded) {
          iconPath = `M ${badgeX - iconSize},${badgeY - iconSize / 2} L ${badgeX + iconSize},${badgeY - iconSize / 2} L ${badgeX},${badgeY + iconSize} Z`;
        } else if (isRightSide) {
          iconPath = `M ${badgeX - iconSize / 2},${badgeY - iconSize} L ${badgeX + iconSize},${badgeY} L ${badgeX - iconSize / 2},${badgeY + iconSize} Z`;
        } else {
          iconPath = `M ${badgeX + iconSize / 2},${badgeY - iconSize} L ${badgeX - iconSize},${badgeY} L ${badgeX + iconSize / 2},${badgeY + iconSize} Z`;
        }
        const icon = el("path", {
          d: iconPath,
          fill: "#1e1e2e",
          "pointer-events": "none"
        });
        badgeG.appendChild(icon);
        badgeG.addEventListener("click", (e) => {
          e.stopPropagation();
          e.preventDefault();
          n.bodyExpanded = !n.bodyExpanded;
          this.render();
        });
        this.btnLayer.appendChild(badgeG);
      }
      const isRootNode = n.level === 0 || n.level === -1;
      if (isRootNode) {
        const hasLeftKids = n.children.some((c) => c.side === "left");
        const hasRightKids = n.children.some((c) => c.side === "right");
        if (hasLeftKids) {
          this.makeCollapseBtn(n, n.cx - n.width / 2, n.cy, "left");
        }
        if (hasRightKids) {
          this.makeCollapseBtn(n, n.cx + n.width / 2, n.cy, "right");
        }
      } else if (n.children.length > 0) {
        const bx = n.cx + (n.side === "right" ? 1 : -1) * n.width / 2;
        this.makeCollapseBtn(n, bx, n.cy, "normal");
      }
      g.style.pointerEvents = "all";
      g.addEventListener("click", (e) => {
        e.stopPropagation();
        this.selectNode(n);
        this.jumpToNode(n);
      });
      g.addEventListener("dblclick", (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.startEdit(n);
      });
      this.nodeLayer.appendChild(g);
    }
    for (const n of nodes) {
      if (!n.bodyExpanded || !n.body.trim())
        continue;
      this.renderPreviewBox(n);
    }
    this.applyTransform();
    this.infoEl?.setText(
      `${this.file?.basename ?? ""} \xB7 ${nodes.length} \u8282\u70B9`
    );
  }
  renderPreviewBox(n) {
    if (!this.previewLayer)
      return;
    const bodyLines = wrapText(n.body, PREVIEW_MIN_W - PREVIEW_PAD * 2, 12);
    const boxW = Math.max(PREVIEW_MIN_W, n.width + 40);
    const boxH = PREVIEW_PAD * 2 + bodyLines.length * PREVIEW_LINE_H + PREVIEW_LINK_H;
    const boxX = n.cx - boxW / 2;
    const boxY = n.cy + n.height / 2 + 8;
    const pg = el("g", { class: "xmind-preview-box", "data-id": n.id });
    pg.style.pointerEvents = "all";
    const bg = el("rect", {
      x: boxX.toFixed(1),
      y: boxY.toFixed(1),
      width: boxW.toFixed(1),
      height: boxH.toFixed(1),
      rx: "8",
      fill: "var(--background-secondary, #1e1e2e)",
      stroke: n.color || "#555",
      "stroke-width": "1",
      filter: "url(#xmind-shadow)",
      "pointer-events": "all"
    });
    pg.appendChild(bg);
    for (let i = 0; i < bodyLines.length; i++) {
      const lineText = el("text", {
        x: (boxX + PREVIEW_PAD).toFixed(1),
        y: (boxY + PREVIEW_PAD + (i + 1) * PREVIEW_LINE_H - 4).toFixed(1),
        "font-size": "12",
        "font-family": "var(--font-interface, sans-serif)",
        fill: "var(--text-normal, #ccc)",
        "pointer-events": "none"
      });
      lineText.textContent = bodyLines[i];
      pg.appendChild(lineText);
    }
    const linkY = boxY + boxH - PREVIEW_LINK_H / 2 + 2;
    const linkX = boxX + boxW - PREVIEW_PAD;
    const linkHit = el("rect", {
      x: (linkX - 70).toFixed(1),
      y: (linkY - 12).toFixed(1),
      width: "70",
      height: "20",
      fill: "transparent",
      "pointer-events": "all",
      cursor: "pointer"
    });
    pg.appendChild(linkHit);
    const linkText = el("text", {
      x: linkX.toFixed(1),
      y: linkY.toFixed(1),
      "text-anchor": "end",
      "font-size": "12",
      "font-family": "var(--font-interface, sans-serif)",
      fill: n.color || "#5B8FF9",
      "font-weight": "600",
      "pointer-events": "none"
    });
    linkText.textContent = "\u67E5\u770B\u8BE6\u60C5 \u2192";
    pg.appendChild(linkText);
    linkHit.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.jumpToNode(n);
    });
    const closeX = boxX + boxW - 14;
    const closeY = boxY + 14;
    const closeHit = el("rect", {
      x: (closeX - 10).toFixed(1),
      y: (closeY - 10).toFixed(1),
      width: "20",
      height: "20",
      fill: "transparent",
      "pointer-events": "all",
      cursor: "pointer"
    });
    pg.appendChild(closeHit);
    const closeSym = el("text", {
      x: closeX.toFixed(1),
      y: (closeY + 4).toFixed(1),
      "text-anchor": "middle",
      "font-size": "14",
      fill: "var(--text-muted, #888)",
      "pointer-events": "none"
    });
    closeSym.textContent = "\u2715";
    pg.appendChild(closeSym);
    closeHit.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      n.bodyExpanded = false;
      this.render();
    });
    bg.addEventListener("click", (e) => {
      e.stopPropagation();
    });
    this.previewLayer.appendChild(pg);
  }
  /* ---------- jump to md source ---------- */
  async jumpToNode(n) {
    if (!this.file)
      return;
    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(this.file, { mode: "source" });
    this.app.workspace.setActiveLeaf(leaf, { focus: true });
    setTimeout(() => {
      const view = leaf.view;
      if (!(view instanceof import_obsidian.MarkdownView) || !view.editor)
        return;
      const editor = view.editor;
      if (n === this.root) {
        editor.setCursor({ line: 0, ch: 0 });
        editor.scrollIntoView({ from: { line: 0, ch: 0 }, to: { line: 0, ch: 0 } }, true);
        this.app.workspace.revealLeaf(leaf);
        return;
      }
      const md = editor.getValue();
      const lines = md.split("\n");
      const hashes = "#".repeat(Math.max(1, n.level));
      const targetPrefix = `${hashes} `;
      let foundLine = -1;
      if (n.lineStart >= 0 && n.lineStart < lines.length) {
        const ln = lines[n.lineStart];
        if (/^#{1,6}\s+/.test(ln) && ln.includes(n.text)) {
          foundLine = n.lineStart;
        }
      }
      if (foundLine < 0) {
        for (let i = 0; i < lines.length; i++) {
          if (/^#{1,6}\s+/.test(lines[i]) && lines[i].includes(n.text)) {
            foundLine = i;
            break;
          }
        }
      }
      if (foundLine < 0) {
        new import_obsidian.Notice("\u672A\u627E\u5230\u5BF9\u5E94\u4F4D\u7F6E");
        return;
      }
      editor.setCursor({ line: foundLine, ch: 0 });
      editor.scrollIntoView({ from: { line: foundLine, ch: 0 }, to: { line: foundLine, ch: 0 } }, true);
      this.app.workspace.revealLeaf(leaf);
    }, 150);
  }
  applyTransform() {
    if (!this.svg)
      return;
    const t = `translate(${this.panX.toFixed(1)},${this.panY.toFixed(1)}) scale(${this.scale.toFixed(3)})`;
    if (this.linkLayer)
      this.linkLayer.setAttribute("transform", t);
    if (this.nodeLayer)
      this.nodeLayer.setAttribute("transform", t);
    if (this.btnLayer)
      this.btnLayer.setAttribute("transform", t);
    if (this.previewLayer)
      this.previewLayer.setAttribute("transform", t);
  }
  /* ---------- interaction ---------- */
  makeCollapseBtn(n, bx, by, mode) {
    const btnG = el("g", { class: "xmind-collapse-btn", "data-id": n.id });
    btnG.style.pointerEvents = "all";
    const hitArea = el("rect", {
      x: (bx - 12).toFixed(1),
      y: (by - 12).toFixed(1),
      width: "24",
      height: "24",
      fill: "transparent",
      "pointer-events": "all"
    });
    btnG.appendChild(hitArea);
    let isCollapsed = false;
    if (mode === "left")
      isCollapsed = n.leftCollapsed;
    else if (mode === "right")
      isCollapsed = n.rightCollapsed;
    else
      isCollapsed = n.collapsed;
    const btnCircle = el("circle", {
      cx: bx.toFixed(1),
      cy: by.toFixed(1),
      r: "9",
      fill: "#fff",
      stroke: n.color || "#999",
      "stroke-width": "2",
      opacity: isCollapsed ? "1" : "0.6",
      "pointer-events": "none"
    });
    btnG.appendChild(btnCircle);
    const sym = el("text", {
      x: bx.toFixed(1),
      y: (by + 3).toFixed(1),
      "text-anchor": "middle",
      "font-size": "12",
      fill: n.color || "#999",
      "font-weight": "bold",
      "pointer-events": "none"
    });
    sym.textContent = isCollapsed ? "+" : "\u2212";
    btnG.appendChild(sym);
    btnG.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (mode === "left")
        n.leftCollapsed = !n.leftCollapsed;
      else if (mode === "right")
        n.rightCollapsed = !n.rightCollapsed;
      else
        n.collapsed = !n.collapsed;
      this.render();
    });
    this.btnLayer.appendChild(btnG);
  }
  selectNode(n) {
    this.selected = n;
    if (this.nodeLayer) {
      for (const g of Array.from(this.nodeLayer.children)) {
        g.classList.remove("selected");
      }
    }
    if (n && n.groupEl)
      n.groupEl.classList.add("selected");
  }
  bindFileEvents() {
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (this._saving)
          return;
        if (this.editing)
          return;
        if (file !== this.file)
          return;
        this.reloadFromDisk();
      })
    );
    this.registerEvent(
      this.app.workspace.on("file-open", (file) => {
        if (!file || file.extension !== "md")
          return;
        if (file === this.file)
          return;
        this.file = file;
        this._firstLoad = true;
        this.reloadFromDisk();
      })
    );
  }
  bindCanvasEvents() {
    const wrapper = this.wrapperEl;
    let panning = false;
    let startX = 0, startY = 0, startPanX = 0, startPanY = 0;
    this.registerDomEvent(wrapper, "mousedown", (e) => {
      wrapper.focus();
      const target = e.target;
      if (target.closest(".xmind-node") || target.closest(".xmind-collapse-btn") || target.closest(".xmind-body-toggle") || target.closest(".xmind-preview-box"))
        return;
      panning = true;
      startX = e.clientX;
      startY = e.clientY;
      startPanX = this.panX;
      startPanY = this.panY;
      wrapper.classList.add("panning");
      this.selectNode(null);
    });
    this.registerDomEvent(window, "mousemove", (e) => {
      if (!panning)
        return;
      this.panX = startPanX + (e.clientX - startX);
      this.panY = startPanY + (e.clientY - startY);
      this.applyTransform();
    });
    this.registerDomEvent(window, "mouseup", () => {
      if (panning) {
        panning = false;
        wrapper.classList.remove("panning");
      }
    });
    this.registerDomEvent(wrapper, "wheel", (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1.1 : 0.9;
      this.zoomAt(e.offsetX, e.offsetY, delta);
    }, { passive: false });
    this.registerDomEvent(wrapper, "keydown", (e) => {
      if (this.editing)
        return;
      const key = e.key;
      let handled = true;
      switch (key) {
        case "Tab":
          this.addChild();
          break;
        case "Enter":
          this.addSibling();
          break;
        case "Delete":
        case "Backspace":
          this.deleteSelected();
          break;
        case " ":
          this.toggleCollapseSelected();
          break;
        case "F2":
          this.startEdit(this.selected);
          break;
        case "+":
        case "=":
          this.zoom(1.2);
          break;
        case "-":
          this.zoom(0.8);
          break;
        case "0":
          this.centerView();
          break;
        default:
          handled = false;
      }
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    });
  }
  zoom(factor) {
    const w = this.wrapperEl;
    this.zoomAt(w.clientWidth / 2, w.clientHeight / 2, factor);
  }
  zoomAt(px, py, factor) {
    const newScale = Math.min(3, Math.max(0.2, this.scale * factor));
    const real = newScale / this.scale;
    this.panX = px - (px - this.panX) * real;
    this.panY = py - (py - this.panY) * real;
    this.scale = newScale;
    this.applyTransform();
  }
  toggleCollapseSelected() {
    if (!this.selected)
      return;
    const n = this.selected;
    const isRoot = n.level === 0 || n.level === -1;
    if (isRoot) {
      const both = n.leftCollapsed && n.rightCollapsed;
      if (both) {
        n.leftCollapsed = false;
        n.rightCollapsed = false;
      } else {
        n.leftCollapsed = true;
        n.rightCollapsed = true;
      }
    } else if (n.children.length) {
      n.collapsed = !n.collapsed;
    }
    this.render();
  }
  collapseAll() {
    if (!this.root)
      return;
    this.root.leftCollapsed = true;
    this.root.rightCollapsed = true;
    const walk = (n) => {
      if (n.children.length)
        n.collapsed = true;
      n.children.forEach(walk);
    };
    walk(this.root);
    this.root.collapsed = false;
    this.render();
  }
  expandAll() {
    if (!this.root)
      return;
    this.root.leftCollapsed = false;
    this.root.rightCollapsed = false;
    const walk = (n) => {
      n.collapsed = false;
      n.children.forEach(walk);
    };
    walk(this.root);
    this.render();
  }
  collapseAllPreviews() {
    if (!this.root)
      return;
    const walk = (n) => {
      n.bodyExpanded = false;
      n.children.forEach(walk);
    };
    walk(this.root);
    this.render();
  }
  findParent(target, root = this.root) {
    for (const c of root.children) {
      if (c === target)
        return root;
      const r = this.findParent(target, c);
      if (r)
        return r;
    }
    return null;
  }
  addChild() {
    const sel = this.selected || this.root;
    if (!sel)
      return;
    const node = {
      id: newId(),
      text: "\u65B0\u8282\u70B9",
      level: sel.level + 1,
      children: [],
      collapsed: false,
      body: "",
      lineStart: -1,
      bodyExpanded: false,
      leftCollapsed: false,
      rightCollapsed: false,
      cx: 0,
      cy: 0,
      width: 0,
      height: NODE_H,
      side: "root",
      color: sel.color
    };
    sel.children.push(node);
    sel.collapsed = false;
    this.selected = node;
    this.render();
    this.save();
    this.startEdit(node);
  }
  addSibling() {
    if (!this.selected || this.selected === this.root) {
      this.addChild();
      return;
    }
    const parent = this.findParent(this.selected);
    if (!parent)
      return;
    const idx = parent.children.indexOf(this.selected);
    const node = {
      id: newId(),
      text: "\u65B0\u8282\u70B9",
      level: this.selected.level,
      children: [],
      collapsed: false,
      body: "",
      lineStart: -1,
      bodyExpanded: false,
      leftCollapsed: false,
      rightCollapsed: false,
      cx: 0,
      cy: 0,
      width: 0,
      height: NODE_H,
      side: "root",
      color: this.selected.color
    };
    parent.children.splice(idx + 1, 0, node);
    this.selected = node;
    this.render();
    this.save();
    this.startEdit(node);
  }
  deleteSelected() {
    if (!this.selected || this.selected === this.root)
      return;
    const parent = this.findParent(this.selected);
    if (!parent)
      return;
    const idx = parent.children.indexOf(this.selected);
    parent.children.splice(idx, 1);
    this.selected = parent;
    this.render();
    this.save();
  }
  startEdit(n) {
    if (!n || !this.svg || !this.wrapperEl)
      return;
    const ex = this.wrapperEl.querySelector(".xmind-edit-input");
    if (ex)
      ex.remove();
    this.editing = n;
    const input = document.createElement("input");
    input.className = "xmind-edit-input";
    input.value = n.text;
    const screenX = this.panX + n.cx * this.scale;
    const screenY = this.panY + n.cy * this.scale;
    const w = Math.max(80, n.width * this.scale);
    input.style.left = screenX - w / 2 + "px";
    input.style.top = screenY - 16 + "px";
    input.style.width = w + "px";
    input.style.textAlign = "center";
    this.wrapperEl.appendChild(input);
    input.focus();
    input.select();
    const finish = (commit) => {
      if (commit) {
        n.text = input.value.trim() || "\u65B0\u8282\u70B9";
        this.render();
        this.save();
      }
      this.editing = null;
      input.remove();
    };
    input.addEventListener("blur", () => finish(true));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        finish(true);
      } else if (e.key === "Escape") {
        e.preventDefault();
        finish(false);
      }
      e.stopPropagation();
    });
  }
  exportSVG() {
    if (!this.svg)
      return;
    const clone = this.svg.cloneNode(true);
    const nodes = this.root ? collectNodes(this.root) : [];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      minX = Math.min(minX, n.cx - n.width / 2);
      maxX = Math.max(maxX, n.cx + n.width / 2);
      minY = Math.min(minY, n.cy - n.height / 2);
      maxY = Math.max(maxY, n.cy + n.height / 2);
    }
    const pad = 40;
    const w = maxX - minX + pad * 2;
    const h = maxY - minY + pad * 2;
    clone.setAttribute("viewBox", `${minX - pad} ${minY - pad} ${w} ${h}`);
    clone.setAttribute("width", String(w));
    clone.setAttribute("height", String(h));
    for (const layer of ["xmind-link-layer", "xmind-node-layer", "xmind-btn-layer", "xmind-preview-layer"]) {
      const g = clone.querySelector("." + layer);
      if (g)
        g.removeAttribute("transform");
    }
    clone.setAttribute("style", "background:#fff");
    const data = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([data], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (this.file?.basename ?? "mindmap") + ".svg";
    a.click();
    URL.revokeObjectURL(url);
    new import_obsidian.Notice("\u5DF2\u5BFC\u51FA SVG");
  }
  async onClose() {
    const input = this.wrapperEl?.querySelector(".xmind-edit-input");
    if (input)
      input.blur();
  }
};
var XMindPlugin = class extends import_obsidian.Plugin {
  async onload() {
    this.registerView(VIEW_TYPE_XMIND, (leaf) => new XMindView(leaf));
    this.addCommand({
      id: "open-xmind-view",
      name: "\u6253\u5F00\u5F53\u524D\u7B14\u8BB0\u7684\u601D\u7EF4\u5BFC\u56FE",
      callback: () => this.activateView()
    });
    this.addRibbonIcon("network", "\u601D\u7EF4\u5BFC\u56FE", () => this.activateView());
  }
  async activateView() {
    const { workspace } = this.app;
    let leaf = null;
    const existing = workspace.getLeavesOfType(VIEW_TYPE_XMIND);
    if (existing.length) {
      leaf = existing[0];
    } else {
      leaf = workspace.getRightLeaf(false);
      await leaf.setViewState({ type: VIEW_TYPE_XMIND, active: true });
    }
    workspace.revealLeaf(leaf);
    setTimeout(() => {
      const view = leaf.view;
      view.reload();
    }, 100);
  }
  async onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_XMIND);
  }
};
