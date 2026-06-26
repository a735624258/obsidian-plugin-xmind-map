import { Plugin, WorkspaceLeaf, ItemView, TFile, Notice, MarkdownView } from "obsidian";

export const VIEW_TYPE_XMIND = "xmind-mindmap-view";

/* ============================================================
 *  Types & Constants
 * ============================================================ */

interface MindNode {
	id: string;
	text: string;
	level: number; // 0 = root (H1), 1 = H2 ...
	children: MindNode[];
	collapsed: boolean;
	body: string; // non-heading lines attached to this node
	lineStart: number; // heading line number in source md (0-based), -1 if unknown
	bodyExpanded: boolean; // preview box expanded?
	leftCollapsed: boolean; // root only: left side collapsed
	rightCollapsed: boolean; // root only: right side collapsed
	// layout
	cx: number;
	cy: number;
	width: number;
	height: number;
	side: "root" | "left" | "right";
	color: string;
	// dom
	rectEl?: SVGRectElement;
	textEl?: SVGTextElement;
	groupEl?: SVGGElement;
}

const NODE_H = 34;
const H_GAP = 70;
const V_GAP = 14;
const NODE_PAD_X = 18;
const FONT_SIZE = 14;
const ROOT_FONT = 17;

// Preview box constants
const PREVIEW_MAX_LINES = 8;
const PREVIEW_LINE_H = 18;
const PREVIEW_PAD = 12;
const PREVIEW_MIN_W = 200;
const PREVIEW_LINK_H = 24;

// XMind classic 6-color palette
const BRANCH_COLORS = [
	"#5B8FF9",
	"#5AD8A6",
	"#F6BD16",
	"#7262FD",
	"#FF9D4D",
	"#78D3F8",
];

let _idCounter = 0;
const newId = () => `n${_idCounter++}`;

/* ============================================================
 *  Markdown <-> Tree
 *  - First line %%中心：xxx%% = center node title (hidden in reading mode)
 *  - Heading lines become child nodes
 * ============================================================ */

const CENTER_RE = /^%%中心[：:](.*)%%\s*$/;
const CENTER_PREFIX = "%%中心：";

/** Extract YAML frontmatter (--- ... ---) from the start of the file.
 *  Returns { frontmatter, body } where frontmatter includes the --- delimiters. */
function extractFrontmatter(md: string): { frontmatter: string; body: string } {
	const lines = md.split("\n");
	if (lines.length === 0 || lines[0].trim() !== "---") {
		return { frontmatter: "", body: md };
	}
	// find closing ---
	for (let i = 1; i < lines.length; i++) {
		if (lines[i].trim() === "---") {
			const fm = lines.slice(0, i + 1).join("\n");
			const rest = lines.slice(i + 1).join("\n");
			return { frontmatter: fm, body: rest };
		}
	}
	// no closing --- found, treat all as body
	return { frontmatter: "", body: md };
}

function parseMarkdown(md: string): { root: MindNode | null; centerTitle: string; frontmatter: string } {
	const { frontmatter, body: mdBody } = extractFrontmatter(md);
	const lines = mdBody.split("\n");
	const rootCandidates: MindNode[] = [];
	const stack: MindNode[] = []; // stack of nodes by level
	let centerTitle = "";
	let startIdx = 0;

	// check first line for center title
	if (lines.length > 0) {
		const cm = lines[0].match(CENTER_RE);
		if (cm) {
			centerTitle = cm[1].trim();
			startIdx = 1;
		}
	}

	const nodeOf = (line: string, level: number, lineNum: number): MindNode => ({
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
		color: "",
	});

	let preHeadingBody = ""; // lines before the first heading

	for (let i = startIdx; i < lines.length; i++) {
		const raw = lines[i];
		const m = raw.match(/^(#{1,6})\s+(.+)$/);
		if (m) {
			const level = m[1].length - 1; // H1->0
			const node = nodeOf(raw, level, i);
			// pop stack until parent has lower level
			while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
			if (stack.length === 0) {
				rootCandidates.push(node);
			} else {
				stack[stack.length - 1].children.push(node);
			}
			stack.push(node);
		} else {
			// attach to current node, or capture as pre-heading body
			if (stack.length) {
				const cur = stack[stack.length - 1];
				cur.body += (cur.body ? "\n" : "") + raw;
			} else {
				preHeadingBody += (preHeadingBody ? "\n" : "") + raw;
			}
		}
	}

	if (rootCandidates.length === 0) {
		// no headings at all — create root with no children, body = rest of file
		const body = lines.slice(startIdx).join("\n").trim();
		const root: MindNode = {
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
			cx: 0, cy: 0, width: 0, height: NODE_H, side: "root", color: "",
		};
		return { root, centerTitle, frontmatter };
	}

	// build root: centerTitle as root.text, H1 nodes as children
	// if single H1, demote it to child of root
	const root: MindNode = {
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
		cx: 0, cy: 0, width: 0, height: NODE_H, side: "root", color: "",
	};
	// shift all candidate levels up by 1 so H1 becomes level 1 (child of root)
	const shiftLevels = (n: MindNode, delta: number) => {
		n.level += delta;
		n.children.forEach((c) => shiftLevels(c, delta));
	};
	rootCandidates.forEach((c) => shiftLevels(c, 1));

	return { root, centerTitle, frontmatter };
}

function nodeToMarkdown(node: MindNode, indent: number = 0): string {
	let out = "";
	const hashes = "#".repeat(Math.max(1, indent + 1));
	out += `${hashes} ${node.text}\n`;
	if (node.body) out += node.body + "\n";
	for (const child of node.children) {
		out += nodeToMarkdown(child, indent + 1);
	}
	return out;
}

function treeToMarkdown(root: MindNode, frontmatter: string): string {
	let out = "";
	// frontmatter must be first (if exists)
	if (frontmatter) {
		out += frontmatter + "\n";
	}
	// center title (hidden comment)
	if (root.text) {
		out += `${CENTER_PREFIX}${root.text}%%\n`;
	}
	// root body (content before first heading) goes right after center title
	if (root.body) {
		out += root.body + "\n";
	}
	// children are level 1+, write as H1+ headings
	for (const child of root.children) {
		out += nodeToMarkdown(child, 0);
	}
	return out;
}

/* ============================================================
 *  Layout  (XMind-style: root center, children split L/R)
 * ============================================================ */

function measureText(text: string, fontSize: number): number {
	// approximate CJK ~ fontSize width, latin ~ 0.55
	let w = 0;
	for (const ch of text) {
		w += /[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(ch) ? fontSize : fontSize * 0.58;
	}
	return w;
}

function computeWidth(node: MindNode): number {
	const fs = node.level <= 0 ? ROOT_FONT : FONT_SIZE;
	const tw = measureText(node.text || "新节点", fs);
	return Math.max(60, tw + NODE_PAD_X * 2);
}

function measureSubtreeHeight(node: MindNode): number {
	const kids = visibleChildren(node);
	if (kids.length === 0) return NODE_H;
	let total = 0;
	for (const c of kids) total += measureSubtreeHeight(c);
	total += V_GAP * (kids.length - 1);
	return Math.max(total, NODE_H);
}

function assignColors(node: MindNode) {
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
			// grandchildren inherit parent color
			let j = 0;
			for (const gc of c.children) {
				gc.color = c.color;
				j++;
			}
		}
	}
	// recurse colors down (already set above, but ensure)
	for (const c of node.children) assignColors(c);
}

function layout(
	node: MindNode,
	cx: number,
	cy: number,
	side: "root" | "left" | "right",
) {
	node.cx = cx;
	node.cy = cy;
	node.side = side;
	node.width = computeWidth(node);
	node.height = NODE_H;

	const kids = visibleChildren(node);
	if (kids.length === 0) return;

	if (side === "root") {
		// assign sides first (before filtering by leftCollapsed/rightCollapsed)
		const allKids = node.collapsed ? [] : node.children;
		const leftCount = Math.ceil(allKids.length / 2);
		for (let i = 0; i < allKids.length; i++) {
			allKids[i].side = i < leftCount ? "left" : "right";
		}

		// now use visible kids filtered by side-collapse
		const leftKids = kids.filter((c) => c.side === "left");
		const rightKids = kids.filter((c) => c.side === "right");

		// left subtree total height
		let leftH = 0;
		for (const c of leftKids) leftH += measureSubtreeHeight(c);
		leftH += V_GAP * Math.max(0, leftKids.length - 1);
		let rightH = 0;
		for (const c of rightKids) rightH += measureSubtreeHeight(c);
		rightH += V_GAP * Math.max(0, rightKids.length - 1);
		const maxH = Math.max(leftH, rightH, NODE_H);

		// place left
		let ly = cy - leftH / 2;
		for (const c of leftKids) {
			const ch = measureSubtreeHeight(c);
			const ccy = ly + ch / 2;
			const ccx = cx - node.width / 2 - H_GAP - computeWidth(c) / 2;
			layout(c, ccx, ccy, "left");
			ly += ch + V_GAP;
		}
		// place right
		let ry = cy - rightH / 2;
		for (const c of rightKids) {
			const ch = measureSubtreeHeight(c);
			const ccy = ry + ch / 2;
			const ccx = cx + node.width / 2 + H_GAP + computeWidth(c) / 2;
			layout(c, ccx, ccy, "right");
			ry += ch + V_GAP;
		}
		// nudge root y to center of max block
		node.cy = cy;
	} else {
		// all children on same side
		let totalH = 0;
		for (const c of kids) totalH += measureSubtreeHeight(c);
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

/** get visible children of a node, respecting side-collapse for root */
function visibleChildren(node: MindNode): MindNode[] {
	if (node.collapsed) return [];
	const isRoot = node.level === 0 || node.level === -1;
	if (!isRoot) return node.children;
	// root: filter by side
	return node.children.filter((c) => {
		if (c.side === "left" && node.leftCollapsed) return false;
		if (c.side === "right" && node.rightCollapsed) return false;
		return true;
	});
}

function collectNodes(node: MindNode, out: MindNode[] = []): MindNode[] {
	out.push(node);
	for (const c of visibleChildren(node)) collectNodes(c, out);
	return out;
}

function collectVisibleLinks(
	node: MindNode,
	out: { parent: MindNode; child: MindNode }[] = [],
): { parent: MindNode; child: MindNode }[] {
	for (const c of visibleChildren(node)) {
		out.push({ parent: node, child: c });
		collectVisibleLinks(c, out);
	}
	return out;
}

/* ============================================================
 *  SVG Helpers
 * ============================================================ */

const NS = "http://www.w3.org/2000/svg";

function el<K extends keyof SVGElementTagNameMap>(
	tag: K,
	attrs: Record<string, string> = {},
): SVGElementTagNameMap[K] {
	const e = document.createElementNS(NS, tag) as SVGElementTagNameMap[K];
	for (const k in attrs) e.setAttribute(k, attrs[k]);
	return e;
}

function bezierPath(
	x1: number, y1: number, x2: number, y2: number,
): string {
	const dx = Math.abs(x2 - x1);
	const cx1 = x1 + (x2 > x1 ? dx * 0.5 : -dx * 0.5);
	const cx2 = x2 + (x2 > x1 ? -dx * 0.5 : dx * 0.5);
	return `M ${x1},${y1} C ${cx1},${y1} ${cx2},${y2} ${x2},${y2}`;
}

/** Split text into display lines that fit within maxWidth (approximate) */
function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
	const sourceLines = text.split("\n").filter((l) => l.trim() !== "");
	const result: string[] = [];
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
		if (current) result.push(current);
		if (result.length >= PREVIEW_MAX_LINES) break;
	}
	if (result.length > PREVIEW_MAX_LINES) {
		result.length = PREVIEW_MAX_LINES;
		result[PREVIEW_MAX_LINES - 1] += " ...";
	}
	return result;
}

/* ============================================================
 *  View
 * ============================================================ */

class XMindView extends ItemView {
	root: MindNode | null = null;
	file: TFile | null = null;

	svg: SVGSVGElement | null = null;
	linkLayer: SVGGElement | null = null;
	nodeLayer: SVGGElement | null = null;
	btnLayer: SVGGElement | null = null;
	previewLayer: SVGGElement | null = null;

	scale = 1;
	panX = 0;
	panY = 0;

	selected: MindNode | null = null;
	editing: MindNode | null = null;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType() { return VIEW_TYPE_XMIND; }
	getDisplayText() { return "思维导图"; }
	getIcon() { return "network"; }

	async onOpen() {
		const container = this.contentEl;
		container.empty();
		container.addClass("xmind-container");

		// toolbar
		const toolbar = container.createDiv({ cls: "xmind-toolbar" });
		const btnDefs: [string, () => void][] = [
			["刷新", () => this.reload()],
			["展开全部", () => this.expandAll()],
			["折叠全部", () => this.collapseAll()],
			["关闭预览", () => this.collapseAllPreviews()],
			["居中", () => this.centerView()],
			["放大", () => this.zoom(1.2)],
			["缩小", () => this.zoom(0.8)],
			["导出 SVG", () => this.exportSVG()],
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
		const info = toolbar.createDiv({ cls: "xmind-info", text: "未加载文件" });
		this.infoEl = info;

		// canvas
		const wrapper = container.createDiv({ cls: "xmind-canvas-wrapper" });
		wrapper.setAttribute("tabindex", "0");
		this.wrapperEl = wrapper;
		const svg = el("svg", { class: "xmind-svg" });
		svg.setAttribute("width", "100%");
		svg.setAttribute("height", "100%");
		wrapper.appendChild(svg);
		this.svg = svg;

		// defs for shadow filter
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

		// hint
		const hint = wrapper.createDiv({ cls: "xmind-hint" });
		hint.innerHTML = `<kbd>Tab</kbd>子节点 <kbd>Enter</kbd>兄弟 <kbd>Del</kbd>删除 <kbd>F2</kbd>编辑 <kbd>空格</kbd>折叠 <kbd>▶</kbd>预览正文 <kbd>滚轮</kbd>缩放 <kbd>拖拽</kbd>平移`;

		this.bindCanvasEvents();
		this.bindFileEvents();

		// try load current file
		await this.loadCurrentFile();
	}

	infoEl: HTMLElement | null = null;
	wrapperEl: HTMLElement | null = null;
	_saving = false; // flag: we are writing to the file, ignore the modify event
	_refEvent: () => void = () => {};
	_fileOpenRef: () => void = () => {};
	_firstLoad = true;
	_frontmatter = "";

	async loadCurrentFile() {
		const f = this.app.workspace.getActiveFile();
		if (!f || f.extension !== "md") {
			this.infoEl?.setText("请在 markdown 笔记中打开");
			return;
		}
		this.file = f;
		await this.reloadFromDisk();
	}

	async reloadFromDisk() {
		if (!this.file) return;
		const f = this.file;
		const md = await this.app.vault.read(f);

		// preserve expand/collapse state across reloads
		const oldState = this.captureState();
		const { root: parsedRoot, centerTitle, frontmatter } = parseMarkdown(md);
		this.root = parsedRoot;
		this._frontmatter = frontmatter;
		// root is always non-null now (parseMarkdown always returns a root)
		this.restoreState(oldState);
		assignColors(this.root);
		// only re-center on first load, not on live reloads
		if (this._firstLoad) {
			this.centerView();
			this._firstLoad = false;
		} else {
			this.render();
		}
		this.infoEl?.setText(`${f.basename} · ${collectNodes(this.root).length} 节点`);
	}

	/** capture collapse/bodyExpanded/sideCollapse state keyed by "level|text" */
	captureState(): Map<string, { collapsed: boolean; bodyExpanded: boolean; leftCollapsed: boolean; rightCollapsed: boolean }> {
		const map = new Map<string, { collapsed: boolean; bodyExpanded: boolean; leftCollapsed: boolean; rightCollapsed: boolean }>();
		if (!this.root) return map;
		const walk = (n: MindNode) => {
			const key = `${n.level}|${n.text}`;
			if (n.collapsed || n.bodyExpanded || n.leftCollapsed || n.rightCollapsed) {
				map.set(key, { collapsed: n.collapsed, bodyExpanded: n.bodyExpanded, leftCollapsed: n.leftCollapsed, rightCollapsed: n.rightCollapsed });
			}
			n.children.forEach(walk);
		};
		walk(this.root);
		return map;
	}

	restoreState(map: Map<string, { collapsed: boolean; bodyExpanded: boolean; leftCollapsed: boolean; rightCollapsed: boolean }>) {
		if (!this.root || map.size === 0) return;
		const walk = (n: MindNode) => {
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
		if (!this.root || !this.file) return;
		this._saving = true;
		const md = treeToMarkdown(this.root, this._frontmatter);
		await this.app.vault.modify(this.file, md);
		this.infoEl?.setText(
			`${this.file.basename} · ${collectNodes(this.root).length} 节点 · 已保存`,
		);
		// release flag shortly after; Obsidian fires the modify event synchronously
		setTimeout(() => { this._saving = false; }, 200);
	}

	/* ---------- render ---------- */

	centerView() {
		if (!this.root) return;
		assignColors(this.root);
		layout(this.root, 0, 0, "root");
		this.scale = 1;
		this.panX = this.wrapperEl!.clientWidth / 2;
		this.panY = this.wrapperEl!.clientHeight / 2;
		this.render();
	}

	render() {
		if (!this.root || !this.linkLayer || !this.nodeLayer || !this.btnLayer || !this.previewLayer) return;
		assignColors(this.root);
		layout(this.root, 0, 0, "root");

		this.linkLayer.innerHTML = "";
		this.nodeLayer.innerHTML = "";
		this.btnLayer.innerHTML = "";
		this.previewLayer.innerHTML = "";

		const nodes = collectNodes(this.root);
		const links = collectVisibleLinks(this.root);

		// links
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
				"stroke-width": Math.max(1.5, 3 - (child.level) * 0.4).toFixed(1).toString(),
				"stroke-linecap": "round",
			});
			this.linkLayer.appendChild(path);
		}

		// nodes
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
				filter: "url(#xmind-shadow)",
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
				fill: textColor,
			});
			text.textContent = n.text || (isRoot ? "（双击编辑）" : "新节点");
			if (!n.text && isRoot) {
				text.setAttribute("opacity", "0.4");
			}
			g.appendChild(text);
			n.textEl = text;

			// ---- body preview badge (if node has body) ----
			if (n.body && n.body.trim()) {
				// position: root → bottom center; left nodes → bottom-left; right nodes → bottom-right
				const isRootNode = n.level === 0 || n.level === -1;
				const isRightSide = n.side === "right";
				const badgeX = isRootNode ? n.cx : (isRightSide ? n.cx + rx - 2 : n.cx - rx + 2);
				const badgeY = isRootNode ? n.cy + ry + 10 : n.cy + ry - 2;
				const badgeG = el("g", { class: "xmind-body-toggle", "data-id": n.id });
				badgeG.style.pointerEvents = "all";

				// invisible hit area (bigger for easy clicking)
				const hit = el("rect", {
					x: (badgeX - 14).toFixed(1),
					y: (badgeY - 14).toFixed(1),
					width: "28",
					height: "28",
					fill: "transparent",
					"pointer-events": "all",
				});
				badgeG.appendChild(hit);

				// circle badge
				const badgeR = 9;
				const circle = el("circle", {
					cx: badgeX.toFixed(1),
					cy: badgeY.toFixed(1),
					r: String(badgeR),
					fill: "#F6BD16",
					stroke: "#1e1e2e",
					"stroke-width": "2",
					"pointer-events": "none",
				});
				badgeG.appendChild(circle);

				// icon inside: ▶/◀ (pointing outward) or ▼ when expanded
				const iconSize = 4;
				let iconPath: string;
				if (n.bodyExpanded) {
					// ▼ (down) when expanded
					iconPath = `M ${badgeX - iconSize},${badgeY - iconSize/2} L ${badgeX + iconSize},${badgeY - iconSize/2} L ${badgeX},${badgeY + iconSize} Z`;
				} else if (isRightSide) {
					// ▶ (right, outward) for right-side nodes
					iconPath = `M ${badgeX - iconSize/2},${badgeY - iconSize} L ${badgeX + iconSize},${badgeY} L ${badgeX - iconSize/2},${badgeY + iconSize} Z`;
				} else {
					// ◀ (left, outward) for left-side nodes
					iconPath = `M ${badgeX + iconSize/2},${badgeY - iconSize} L ${badgeX - iconSize},${badgeY} L ${badgeX + iconSize/2},${badgeY + iconSize} Z`;
				}
				const icon = el("path", {
					d: iconPath,
					fill: "#1e1e2e",
					"pointer-events": "none",
				});
				badgeG.appendChild(icon);

				badgeG.addEventListener("click", (e) => {
					e.stopPropagation();
					e.preventDefault();
					n.bodyExpanded = !n.bodyExpanded;
					this.render();
				});
				this.btnLayer!.appendChild(badgeG);
			}

			// ---- collapse buttons ----
			const isRootNode = n.level === 0 || n.level === -1;
			if (isRootNode) {
				// root: two buttons, left and right
				const hasLeftKids = n.children.some((c) => c.side === "left");
				const hasRightKids = n.children.some((c) => c.side === "right");
				if (hasLeftKids) {
					this.makeCollapseBtn(n, n.cx - n.width / 2, n.cy, "left");
				}
				if (hasRightKids) {
					this.makeCollapseBtn(n, n.cx + n.width / 2, n.cy, "right");
				}
			} else if (n.children.length > 0) {
				// non-root: single button on outer side
				const bx = n.cx + (n.side === "right" ? 1 : -1) * n.width / 2;
				this.makeCollapseBtn(n, bx, n.cy, "normal");
			}

			g.style.pointerEvents = "all";
			g.addEventListener("click", (e) => {
				e.stopPropagation();
				this.selectNode(n);
				// also jump to the heading in md editor
				this.jumpToNode(n);
			});
			g.addEventListener("dblclick", (e) => {
				e.stopPropagation();
				e.preventDefault();
				this.startEdit(n);
			});

			this.nodeLayer!.appendChild(g);
		}

		// ---- preview boxes (rendered last, on top) ----
		for (const n of nodes) {
			if (!n.bodyExpanded || !n.body.trim()) continue;
			this.renderPreviewBox(n);
		}

		this.applyTransform();
		this.infoEl?.setText(
			`${this.file?.basename ?? ""} · ${nodes.length} 节点`,
		);
	}

	renderPreviewBox(n: MindNode) {
		if (!this.previewLayer) return;

		const bodyLines = wrapText(n.body, PREVIEW_MIN_W - PREVIEW_PAD * 2, 12);
		const boxW = Math.max(PREVIEW_MIN_W, n.width + 40);
		const boxH = PREVIEW_PAD * 2 + bodyLines.length * PREVIEW_LINE_H + PREVIEW_LINK_H;

		// position: below the node, left-aligned with node left edge
		const boxX = n.cx - boxW / 2;
		const boxY = n.cy + n.height / 2 + 8;

		const pg = el("g", { class: "xmind-preview-box", "data-id": n.id });
		pg.style.pointerEvents = "all";

		// background
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
			"pointer-events": "all",
		});
		pg.appendChild(bg);

		// body text lines
		for (let i = 0; i < bodyLines.length; i++) {
			const lineText = el("text", {
				x: (boxX + PREVIEW_PAD).toFixed(1),
				y: (boxY + PREVIEW_PAD + (i + 1) * PREVIEW_LINE_H - 4).toFixed(1),
				"font-size": "12",
				"font-family": "var(--font-interface, sans-serif)",
				fill: "var(--text-normal, #ccc)",
				"pointer-events": "none",
			});
			lineText.textContent = bodyLines[i];
			pg.appendChild(lineText);
		}

		// "查看详情 →" link at bottom
		const linkY = boxY + boxH - PREVIEW_LINK_H / 2 + 2;
		const linkX = boxX + boxW - PREVIEW_PAD;
		const linkHit = el("rect", {
			x: (linkX - 70).toFixed(1),
			y: (linkY - 12).toFixed(1),
			width: "70",
			height: "20",
			fill: "transparent",
			"pointer-events": "all",
			cursor: "pointer",
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
			"pointer-events": "none",
		});
		linkText.textContent = "查看详情 →";
		pg.appendChild(linkText);

		// click "查看详情"
		linkHit.addEventListener("click", (e) => {
			e.stopPropagation();
			e.preventDefault();
			this.jumpToNode(n);
		});

		// ---- close button (✕) top-right of preview box ----
		const closeX = boxX + boxW - 14;
		const closeY = boxY + 14;
		const closeHit = el("rect", {
			x: (closeX - 10).toFixed(1),
			y: (closeY - 10).toFixed(1),
			width: "20",
			height: "20",
			fill: "transparent",
			"pointer-events": "all",
			cursor: "pointer",
		});
		pg.appendChild(closeHit);
		const closeSym = el("text", {
			x: closeX.toFixed(1),
			y: (closeY + 4).toFixed(1),
			"text-anchor": "middle",
			"font-size": "14",
			fill: "var(--text-muted, #888)",
			"pointer-events": "none",
		});
		closeSym.textContent = "✕";
		pg.appendChild(closeSym);
		closeHit.addEventListener("click", (e) => {
			e.stopPropagation();
			e.preventDefault();
			n.bodyExpanded = false;
			this.render();
		});

		// click on bg does nothing (already handled)
		bg.addEventListener("click", (e) => {
			e.stopPropagation();
		});

		this.previewLayer.appendChild(pg);
	}

	/* ---------- jump to md source ---------- */

	async jumpToNode(n: MindNode) {
		if (!this.file) return;

		// open the file in editor
		const leaf = this.app.workspace.getLeaf(false);
		await leaf.openFile(this.file, { mode: "source" });
		this.app.workspace.setActiveLeaf(leaf, { focus: true });

		// wait for editor to be ready
		setTimeout(() => {
			const view = leaf.view;
			if (!(view instanceof MarkdownView) || !view.editor) return;
			const editor = view.editor;

			// root node → jump to line 0 (center title line or file start)
			if (n === this.root) {
				editor.setCursor({ line: 0, ch: 0 });
				editor.scrollIntoView({ from: { line: 0, ch: 0 }, to: { line: 0, ch: 0 } }, true);
				this.app.workspace.revealLeaf(leaf);
				return;
			}

			// search for the heading line in current content
			const md = editor.getValue();
			const lines = md.split("\n");
			// node level 1 = H1 (#), level 2 = H2 (##), etc.
			const hashes = "#".repeat(Math.max(1, n.level));
			const targetPrefix = `${hashes} `;

			let foundLine = -1;
			if (n.lineStart >= 0 && n.lineStart < lines.length) {
				// try exact line first — just check it's a heading and contains text
				const ln = lines[n.lineStart];
				if (/^#{1,6}\s+/.test(ln) && ln.includes(n.text)) {
					foundLine = n.lineStart;
				}
			}
			if (foundLine < 0) {
				// fallback: search by text (any heading level that matches)
				for (let i = 0; i < lines.length; i++) {
					if (/^#{1,6}\s+/.test(lines[i]) && lines[i].includes(n.text)) {
						foundLine = i;
						break;
					}
				}
			}
			if (foundLine < 0) {
				new Notice("未找到对应位置");
				return;
			}

			editor.setCursor({ line: foundLine, ch: 0 });
			editor.scrollIntoView({ from: { line: foundLine, ch: 0 }, to: { line: foundLine, ch: 0 } }, true);
			this.app.workspace.revealLeaf(leaf);
		}, 150);
	}

	applyTransform() {
		if (!this.svg) return;
		const t = `translate(${this.panX.toFixed(1)},${this.panY.toFixed(1)}) scale(${this.scale.toFixed(3)})`;
		if (this.linkLayer) this.linkLayer.setAttribute("transform", t);
		if (this.nodeLayer) this.nodeLayer.setAttribute("transform", t);
		if (this.btnLayer) this.btnLayer.setAttribute("transform", t);
		if (this.previewLayer) this.previewLayer.setAttribute("transform", t);
	}

	/* ---------- interaction ---------- */

	makeCollapseBtn(n: MindNode, bx: number, by: number, mode: "left" | "right" | "normal") {
		const btnG = el("g", { class: "xmind-collapse-btn", "data-id": n.id });
		btnG.style.pointerEvents = "all";
		const hitArea = el("rect", {
			x: (bx - 12).toFixed(1),
			y: (by - 12).toFixed(1),
			width: "24",
			height: "24",
			fill: "transparent",
			"pointer-events": "all",
		});
		btnG.appendChild(hitArea);

		let isCollapsed = false;
		if (mode === "left") isCollapsed = n.leftCollapsed;
		else if (mode === "right") isCollapsed = n.rightCollapsed;
		else isCollapsed = n.collapsed;

		const btnCircle = el("circle", {
			cx: bx.toFixed(1),
			cy: by.toFixed(1),
			r: "9",
			fill: "#fff",
			stroke: n.color || "#999",
			"stroke-width": "2",
			opacity: isCollapsed ? "1" : "0.6",
			"pointer-events": "none",
		});
		btnG.appendChild(btnCircle);
		const sym = el("text", {
			x: bx.toFixed(1),
			y: (by + 3).toFixed(1),
			"text-anchor": "middle",
			"font-size": "12",
			fill: n.color || "#999",
			"font-weight": "bold",
			"pointer-events": "none",
		});
		sym.textContent = isCollapsed ? "+" : "−";
		btnG.appendChild(sym);

		btnG.addEventListener("click", (e) => {
			e.stopPropagation();
			e.preventDefault();
			if (mode === "left") n.leftCollapsed = !n.leftCollapsed;
			else if (mode === "right") n.rightCollapsed = !n.rightCollapsed;
			else n.collapsed = !n.collapsed;
			this.render();
		});
		this.btnLayer!.appendChild(btnG);
	}

	selectNode(n: MindNode | null) {
		this.selected = n;
		if (this.nodeLayer) {
			for (const g of Array.from(this.nodeLayer.children)) {
				g.classList.remove("selected");
			}
		}
		if (n && n.groupEl) n.groupEl.classList.add("selected");
	}

	bindFileEvents() {
		// when the current file is modified externally (or by us), reload the mindmap
		this.registerEvent(
			this.app.vault.on("modify", (file) => {
				if (this._saving) return;          // we caused it, skip
				if (this.editing) return;           // user is mid-edit, don't disrupt
				if (file !== this.file) return;     // not our file
				this.reloadFromDisk();
			}),
		);

		// when user switches to a different note, load that note
		this.registerEvent(
			this.app.workspace.on("file-open", (file) => {
				if (!file || file.extension !== "md") return;
				if (file === this.file) return; // same file, skip
				this.file = file;
				this._firstLoad = true; // re-center for new file
				this.reloadFromDisk();
			}),
		);
	}

	bindCanvasEvents() {
		const wrapper = this.wrapperEl!;
		let panning = false;
		let startX = 0, startY = 0, startPanX = 0, startPanY = 0;

		// Any mousedown in the view steals focus from the editor
		this.registerDomEvent(wrapper, "mousedown", (e: MouseEvent) => {
			// focus the canvas so keyboard events come here, not the editor
			wrapper.focus();

			const target = e.target as Element;
			if (target.closest(".xmind-node") || target.closest(".xmind-collapse-btn") || target.closest(".xmind-body-toggle") || target.closest(".xmind-preview-box")) return;
			panning = true;
			startX = e.clientX;
			startY = e.clientY;
			startPanX = this.panX;
			startPanY = this.panY;
			wrapper.classList.add("panning");
			this.selectNode(null);
		});

		this.registerDomEvent(window, "mousemove", (e: MouseEvent) => {
			if (!panning) return;
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

		this.registerDomEvent(wrapper, "wheel", (e: WheelEvent) => {
			e.preventDefault();
			const delta = e.deltaY < 0 ? 1.1 : 0.9;
			this.zoomAt(e.offsetX, e.offsetY, delta);
		}, { passive: false });

		// ---- keyboard: handle directly on the DOM, bypass Obsidian scope ----
		this.registerDomEvent(wrapper, "keydown", (e: KeyboardEvent) => {
			// if editing, let the input handle it
			if (this.editing) return;

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

	zoom(factor: number) {
		const w = this.wrapperEl!;
		this.zoomAt(w.clientWidth / 2, w.clientHeight / 2, factor);
	}

	zoomAt(px: number, py: number, factor: number) {
		const newScale = Math.min(3, Math.max(0.2, this.scale * factor));
		const real = newScale / this.scale;
		this.panX = px - (px - this.panX) * real;
		this.panY = py - (py - this.panY) * real;
		this.scale = newScale;
		this.applyTransform();
	}

	toggleCollapseSelected() {
		if (!this.selected) return;
		const n = this.selected;
		const isRoot = n.level === 0 || n.level === -1;
		if (isRoot) {
			// root: toggle both sides
			const both = n.leftCollapsed && n.rightCollapsed;
			if (both) { n.leftCollapsed = false; n.rightCollapsed = false; }
			else { n.leftCollapsed = true; n.rightCollapsed = true; }
		} else if (n.children.length) {
			n.collapsed = !n.collapsed;
		}
		this.render();
	}

	collapseAll() {
		if (!this.root) return;
		// collapse root sides (XMind style: only center node remains)
		this.root.leftCollapsed = true;
		this.root.rightCollapsed = true;
		// also collapse all sub-nodes
		const walk = (n: MindNode) => {
			if (n.children.length) n.collapsed = true;
			n.children.forEach(walk);
		};
		walk(this.root);
		this.root.collapsed = false;
		this.render();
	}

	expandAll() {
		if (!this.root) return;
		this.root.leftCollapsed = false;
		this.root.rightCollapsed = false;
		const walk = (n: MindNode) => { n.collapsed = false; n.children.forEach(walk); };
		walk(this.root);
		this.render();
	}

	collapseAllPreviews() {
		if (!this.root) return;
		const walk = (n: MindNode) => {
			n.bodyExpanded = false;
			n.children.forEach(walk);
		};
		walk(this.root);
		this.render();
	}

	findParent(target: MindNode, root: MindNode = this.root!): MindNode | null {
		for (const c of root.children) {
			if (c === target) return root;
			const r = this.findParent(target, c);
			if (r) return r;
		}
		return null;
	}

	addChild() {
		const sel = this.selected || this.root;
		if (!sel) return;
		const node: MindNode = {
			id: newId(), text: "新节点", level: sel.level + 1, children: [],
			collapsed: false, body: "", lineStart: -1, bodyExpanded: false, leftCollapsed: false, rightCollapsed: false,
			cx: 0, cy: 0, width: 0, height: NODE_H,
			side: "root", color: sel.color,
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
			// add child to root
			this.addChild();
			return;
		}
		const parent = this.findParent(this.selected);
		if (!parent) return;
		const idx = parent.children.indexOf(this.selected);
		const node: MindNode = {
			id: newId(), text: "新节点", level: this.selected.level, children: [],
			collapsed: false, body: "", lineStart: -1, bodyExpanded: false, leftCollapsed: false, rightCollapsed: false,
			cx: 0, cy: 0, width: 0, height: NODE_H,
			side: "root", color: this.selected.color,
		};
		parent.children.splice(idx + 1, 0, node);
		this.selected = node;
		this.render();
		this.save();
		this.startEdit(node);
	}

	deleteSelected() {
		if (!this.selected || this.selected === this.root) return;
		const parent = this.findParent(this.selected);
		if (!parent) return;
		const idx = parent.children.indexOf(this.selected);
		parent.children.splice(idx, 1);
		this.selected = parent;
		this.render();
		this.save();
	}

	startEdit(n: MindNode | null) {
		if (!n || !this.svg || !this.wrapperEl) return;
		// remove existing editor
		const ex = this.wrapperEl.querySelector(".xmind-edit-input") as HTMLInputElement | null;
		if (ex) ex.remove();
		this.editing = n;

		const input = document.createElement("input");
		input.className = "xmind-edit-input";
		input.value = n.text;

		// position: project node center to screen
		const screenX = this.panX + n.cx * this.scale;
		const screenY = this.panY + n.cy * this.scale;
		const w = Math.max(80, n.width * this.scale);
		input.style.left = (screenX - w / 2) + "px";
		input.style.top = (screenY - 16) + "px";
		input.style.width = w + "px";
		input.style.textAlign = "center";

		this.wrapperEl.appendChild(input);
		input.focus();
		input.select();

		const finish = (commit: boolean) => {
			if (commit) {
				n.text = input.value.trim() || "新节点";
				this.render();
				this.save();
			}
			this.editing = null;
			input.remove();
		};
		input.addEventListener("blur", () => finish(true));
		input.addEventListener("keydown", (e) => {
			if (e.key === "Enter") { e.preventDefault(); finish(true); }
			else if (e.key === "Escape") { e.preventDefault(); finish(false); }
			e.stopPropagation();
		});
	}

	exportSVG() {
		if (!this.svg) return;
		const clone = this.svg.cloneNode(true) as SVGSVGElement;
		// compute bbox
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
		// reset transform on layers
		for (const layer of ["xmind-link-layer", "xmind-node-layer", "xmind-btn-layer", "xmind-preview-layer"]) {
			const g = clone.querySelector("." + layer);
			if (g) g.removeAttribute("transform");
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
		new Notice("已导出 SVG");
	}

	async onClose() {
		const input = this.wrapperEl?.querySelector(".xmind-edit-input") as HTMLInputElement | null;
		if (input) input.blur();
	}
}

/* ============================================================
 *  Plugin
 * ============================================================ */

export default class XMindPlugin extends Plugin {
	async onload() {
		this.registerView(VIEW_TYPE_XMIND, (leaf) => new XMindView(leaf));

		this.addCommand({
			id: "open-xmind-view",
			name: "打开当前笔记的思维导图",
			callback: () => this.activateView(),
		});

		// ribbon icon
		this.addRibbonIcon("network", "思维导图", () => this.activateView());
	}

	async activateView() {
		const { workspace } = this.app;
		let leaf: WorkspaceLeaf | null = null;
		const existing = workspace.getLeavesOfType(VIEW_TYPE_XMIND);
		if (existing.length) {
			leaf = existing[0];
		} else {
			leaf = workspace.getRightLeaf(false);
			await leaf.setViewState({ type: VIEW_TYPE_XMIND, active: true });
		}
		workspace.revealLeaf(leaf);
		// trigger reload after view is ready
		setTimeout(() => {
			const view = leaf!.view as XMindView;
			view.reload();
		}, 100);
	}

	async onunload() {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_XMIND);
	}
}
