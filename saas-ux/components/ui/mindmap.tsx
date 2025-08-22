"use client";
import { mindMapI18n } from "components/ui/MindMapI18n";
import React, { useMemo, useEffect } from "react";
import ReactFlow, {
  Node,
  Edge,
  Position,
  useNodesState,
  useEdgesState,
  Handle,
} from "reactflow";
import "reactflow/dist/style.css";
import Image from "next/image";
import { Search, Accessibility, Gauge, ShieldCheck } from "lucide-react";

// ---------- Types ----------
export type Branch = { id: string; title: string; color: string; subs: string[] };
export type MindMapLocaleBundle = { core: string; branches: Branch[] };
export type MindMapI18n = Record<"en"|"de"|"es"|"fr"|"it"|"pt", MindMapLocaleBundle>;

// ---------- Dark/Light/System: follow <html> ----------
function useHtmlTheme() {
  const [isDark, setIsDark] = React.useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const update = () => {
      const htmlDark = el.classList.contains("dark");
      const htmlLight = el.classList.contains("light");
      const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setIsDark(htmlDark || (!htmlLight && systemDark));
    };
    update();
    const obs = new MutationObserver(update);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", update);
    return () => { obs.disconnect(); mq.removeEventListener("change", update); };
  }, []);
  return isDark;
}

// ---------- Node UI ----------
const CenterNode = ({ data }: any) => (
  <div className="rounded-full bg-transparent">
    <div className="rounded-full flex items-center justify-center" style={{ width: 48, height: 48 }}>
      <Image src="/360.svg" alt={data.label} width={48} height={48} />
    </div>
    <Handle id="top" type="source" position={Position.Top} style={{ opacity: 0 }} />
    <Handle id="right" type="source" position={Position.Right} style={{ opacity: 0 }} />
    <Handle id="bottom" type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    <Handle id="left" type="source" position={Position.Left} style={{ opacity: 0 }} />
  </div>
);

const BranchNode = ({ data }: any) => (
  <div
    className="px-4 py-2 rounded-full text-white font-semibold shadow-lg border flex items-center gap-2"
    style={{ background: data.color, borderColor: data.color }}
  >
    <span className="inline-flex items-center justify-center w-5 h-5">
      {data.icon}
    </span>
    <span>{data.label}</span>
    <Handle type="target" position={data.targetPosition} style={{ opacity: 0 }} />
    <Handle type="source" position={data.sourcePosition} style={{ opacity: 0 }} />
  </div>
);

const SubNode = ({ data }: any) => (
  <div
    className="px-3 py-1 rounded-full text-xs font-medium border bg-white/80 dark:bg-slate-800/70 backdrop-blur"
    style={{ color: data.color, borderColor: data.color }}
    title={data.label}
  >
    {data.label}
    <Handle type="target" position={data.targetPosition} style={{ opacity: 0 }} />
  </div>
);

const nodeTypes = { center: CenterNode, branch: BranchNode, sub: SubNode };

// ---------- Helpers ----------
function polar(cx: number, cy: number, r: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}
const sideFromAngle = (deg: number) =>
  Math.cos((deg * Math.PI) / 180) >= 0 ? "right" : "left";

function sourceHandleFromAngle(deg: number): "right" | "left" | "top" | "bottom" {
  const rad = (deg * Math.PI) / 180;
  const cx = Math.cos(rad);
  const sy = Math.sin(rad);
  if (Math.abs(cx) >= Math.abs(sy)) return cx >= 0 ? "right" : "left";
  return sy >= 0 ? "bottom" : "top";
}

// Estimate pill width (icon + text) so we can push long labels outward automatically.
// Tune the BASELINE & SCALE below if you change font/size.
const measure = (() => {
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  return (text: string) => {
    if (!canvas) {
      canvas = document.createElement("canvas");
      ctx = canvas.getContext("2d");
    }
    if (!ctx) return 120; // fallback
    // font should roughly match BranchNode: font-semibold, base size ~14–15px
    ctx.font = "600 15px Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto";
    const textWidth = ctx.measureText(text).width;
    const icon = 20;      // 20px box for the icon
    const gap = 8;        // gap between icon and text
    const padX = 16 * 2;  // px-4 left + right
    return Math.round(icon + gap + textWidth + padX);
  };
})();

// ---------- Component ----------
export default function Mindmap({
  i18n = mindMapI18n,
  locale = "en",
  center = { x: 0, y: 0 },
}: {
  i18n?: MindMapI18n;
  locale?: keyof MindMapI18n;
  center?: { x: number; y: number };
}) {
  const bundle = i18n[locale] ?? i18n.en;
  const isDark = useHtmlTheme();
  const theme = isDark ? "dark" : "light";

  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // icons for the four agents (SEO, Accessibility, Performance, Security)
    const icons = [
      <Search key="seo" className="w-5 h-5" />,
      <Accessibility key="a11y" className="w-5 h-5" />,
      <Gauge key="perf" className="w-5 h-5" />,
      <ShieldCheck key="sec" className="w-5 h-5" />,
    ];

    // center
    nodes.push({
      id: "core",
      type: "center",
      position: { x: center.x, y: center.y },
      data: { label: bundle.core },
    });

    // Layout
    const baseBranchRadius = 220;          // baseline distance from logo
    const baselinePill = 130;              // expected pill width before any offset (tweak here)
    const widthToRadiusScale = 0.45;       // how strongly width affects radius (tweak here)
    const leftBias = 6;                    // extra px for left-side branches (tweak here)
    const branchAngles = [210, 330, 150, 30]; // SEO, Accessibility, Performance, Security

    bundle.branches.forEach((b, idx) => {
      const a = branchAngles[idx % branchAngles.length];

      // --- Auto offset based on rendered pill width ---
      const pillW = measure(b.title);
      const extra = Math.max(0, (pillW - baselinePill) * widthToRadiusScale);

      // slight preference for left side to look balanced visually
      const side = sideFromAngle(a);
      const sideExtra = side === "left" ? leftBias : 0;

      const r = baseBranchRadius + extra + sideExtra;
      const { x, y } = polar(center.x, center.y, r, a);

      const branchId = `branch-${b.id}`;
      const branchSource = side === "right" ? Position.Right : Position.Left;
      const branchTarget = side === "right" ? Position.Left : Position.Right;

      nodes.push({
        id: branchId,
        type: "branch",
        position: { x, y },
        data: {
          label: b.title,
          color: b.color,
          icon: icons[idx % icons.length],
          sourcePosition: branchSource,
          targetPosition: branchTarget,
        },
      });

      // core → branch: clean bow curve, from the nearest logo handle
      edges.push({
        id: `e-core-${b.id}`,
        source: "core",
        target: branchId,
        sourceHandle: sourceHandleFromAngle(a),
        type: "bezier",
        style: { stroke: b.color, strokeWidth: 2, opacity: 0.7 },
      });

      // children: generous fan around the branch
      const subBaseR = 180;   // bring children nearer/farther
      const arc = 200;        // spread children more/less
      const start = a - arc / 2;
      const step = arc / Math.max(1, b.subs.length - 1);

      b.subs.forEach((label, sIdx) => {
        const sa = start + sIdx * step;
        const childR = subBaseR + (sIdx % 4) * 6;
        const { x: sx, y: sy } = polar(x, y, childR, sa);
        const subId = `sub-${b.id}-${sIdx}`;
        const dx = sx - x;
        const subTarget = dx >= 0 ? Position.Left : Position.Right;

        nodes.push({
          id: subId,
          type: "sub",
          position: { x: sx, y: sy },
          data: { label, color: b.color, targetPosition: subTarget },
        });

        edges.push({
          id: `e-${b.id}-${sIdx}`,
          source: branchId,
          target: subId,
          type: "smoothstep",
          style: { stroke: b.color, opacity: 0.45 },
        });
      });
    });

    return { nodes, edges };
  }, [i18n, locale, center]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  return (
    <div className={isDark ? "dark" : ""} data-theme={theme}>
      <div className="w-full h-[640px]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          defaultEdgeOptions={{ type: "bezier" }}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.4 }}
          nodesDraggable={false}
          elementsSelectable={false}
          panOnDrag={false}
          panOnScroll={false}
          zoomOnScroll={false}
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
          proOptions={{ hideAttribution: true }}
        />
      </div>
      <style jsx global>{`
        .react-flow__pane,
        .react-flow__node,
        .react-flow__edge {
          cursor: default !important;
        }
      `}</style>
    </div>
  );
}
