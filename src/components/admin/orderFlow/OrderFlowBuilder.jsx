"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  FiPlus,
  FiTrash2,
  FiSave,
  FiZoomIn,
  FiZoomOut,
  FiMaximize,
  FiArrowLeft,
  FiArrowRight,
  FiSettings,
  FiGrid,
  FiTool,
  FiX,
  FiCheck,
  FiLink,
  FiAlertCircle,
  FiChevronDown,
  FiChevronUp,
  FiMove,
} from "react-icons/fi";

// ─── رنگ‌ها بر اساس تم پروژه ───
const COLORS = {
  primary: "#004225",
  secondary: "#c9a84c",
  bg: "#f5f3f0",
  card: "#ffffff",
  border: "#e8e4df",
  sidebar: "#0d0d0d",
  muted: "#9c9189",
  category: "#3b82f6",
  service: "#8b5cf6",
  start: "#10b981",
  edge: "#94a3b8",
  edgeActive: "#004225",
};

const NODE_WIDTH = 220;
const NODE_HEIGHT = 80;

// ─── تولید ID منحصربه‌فرد ───
let _id = 1;
const genId = () => `node_${Date.now()}_${_id++}`;
const genEdgeId = () => `edge_${Date.now()}_${_id++}`;

// ─── نود شروع ثابت ───
const START_NODE = {
  id: "start",
  type: "start",
  label: "شروع سفارش",
  position: { x: 80, y: 200 },
  required: true,
};

export default function OrderFlowBuilder({
  initialFlow = null,
  categories = [],
  onSave,
  isSaving = false,
}) {
  const [nodes, setNodes] = useState(
    initialFlow?.nodes
      ? [START_NODE, ...initialFlow.nodes]
      : [START_NODE]
  );
  const [edges, setEdges] = useState(initialFlow?.edges || []);
  const [selectedNode, setSelectedNode] = useState(null);
  const [dragging, setDragging] = useState(null); // { nodeId, offsetX, offsetY }
  const [connecting, setConnecting] = useState(null); // { fromId }
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panDragging, setPanDragging] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [showPanel, setShowPanel] = useState(true);
  const svgRef = useRef(null);
  const containerRef = useRef(null);

  // ─── محاسبه موقعیت روی canvas ───
  const toCanvas = useCallback(
    (clientX, clientY) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (clientX - rect.left - pan.x) / zoom,
        y: (clientY - rect.top - pan.y) / zoom,
      };
    },
    [pan, zoom]
  );

  // ─── Drag نودها ───
  const handleNodeMouseDown = useCallback(
    (e, nodeId) => {
      if (nodeId === "start") return;
      if (connecting) {
        // اتصال به نود دیگر
        if (connecting.fromId !== nodeId) {
          const edgeExists = edges.some(
            (ed) =>
              (ed.source === connecting.fromId && ed.target === nodeId) ||
              (ed.source === nodeId && ed.target === connecting.fromId)
          );
          if (!edgeExists) {
            setEdges((prev) => [
              ...prev,
              { id: genEdgeId(), source: connecting.fromId, target: nodeId, label: "" },
            ]);
          }
        }
        setConnecting(null);
        e.stopPropagation();
        return;
      }
      e.stopPropagation();
      const pos = toCanvas(e.clientX, e.clientY);
      const node = nodes.find((n) => n.id === nodeId);
      setDragging({
        nodeId,
        offsetX: pos.x - node.position.x,
        offsetY: pos.y - node.position.y,
      });
      setSelectedNode(nodeId);
    },
    [connecting, edges, nodes, toCanvas]
  );

  const handleMouseMove = useCallback(
    (e) => {
      if (dragging) {
        const pos = toCanvas(e.clientX, e.clientY);
        setNodes((prev) =>
          prev.map((n) =>
            n.id === dragging.nodeId
              ? {
                  ...n,
                  position: {
                    x: pos.x - dragging.offsetX,
                    y: pos.y - dragging.offsetY,
                  },
                }
              : n
          )
        );
      } else if (panDragging) {
        const dx = e.clientX - panDragging.lastX;
        const dy = e.clientY - panDragging.lastY;
        setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
        setPanDragging({ lastX: e.clientX, lastY: e.clientY });
      }
    },
    [dragging, panDragging, toCanvas]
  );

  const handleMouseUp = useCallback(() => {
    setDragging(null);
    setPanDragging(null);
  }, []);

  const handleCanvasMouseDown = useCallback(
    (e) => {
      if (connecting) {
        setConnecting(null);
        return;
      }
      if (e.target === svgRef.current || e.target.tagName === "svg") {
        setSelectedNode(null);
        setPanDragging({ lastX: e.clientX, lastY: e.clientY });
      }
    },
    [connecting]
  );

  // ─── حذف نود و لبه‌های مرتبط ───
  const deleteNode = useCallback((nodeId) => {
    if (nodeId === "start") return;
    setNodes((prev) => prev.filter((n) => n.id !== nodeId));
    setEdges((prev) =>
      prev.filter((e) => e.source !== nodeId && e.target !== nodeId)
    );
    setSelectedNode(null);
  }, []);

  const deleteEdge = useCallback((edgeId) => {
    setEdges((prev) => prev.filter((e) => e.id !== edgeId));
  }, []);

  // ─── افزودن نود ───
  const addNode = useCallback((type) => {
    const id = genId();
    const newNode = {
      id,
      type,
      label: type === "category" ? "دسته‌بندی جدید" : "خدمت جدید",
      required: false,
      position: {
        x: 100 + Math.random() * 300,
        y: 100 + Math.random() * 300,
      },
      ...(type === "category"
        ? { categoryId: null, allowVariantSelection: true }
        : { serviceName: "", serviceOptions: [] }),
    };
    setNodes((prev) => [...prev, newNode]);
    setSelectedNode(id);
  }, []);

  // ─── آپدیت نود ───
  const updateNode = useCallback((nodeId, updates) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === nodeId ? { ...n, ...updates } : n))
    );
  }, []);

  // ─── آپدیت آپشن‌های خدمت ───
  const addServiceOption = useCallback((nodeId) => {
    setNodes((prev) =>
      prev.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              serviceOptions: [
                ...(n.serviceOptions || []),
                { label: "", value: "", priceModifier: 0 },
              ],
            }
          : n
      )
    );
  }, []);

  const updateServiceOption = useCallback((nodeId, index, field, value) => {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id !== nodeId) return n;
        const opts = [...(n.serviceOptions || [])];
        opts[index] = { ...opts[index], [field]: value };
        return { ...n, serviceOptions: opts };
      })
    );
  }, []);

  const removeServiceOption = useCallback((nodeId, index) => {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id !== nodeId) return n;
        const opts = [...(n.serviceOptions || [])];
        opts.splice(index, 1);
        return { ...n, serviceOptions: opts };
      })
    );
  }, []);

  // ─── ذخیره ───
  const handleSave = useCallback(() => {
    const exportNodes = nodes.filter((n) => n.id !== "start");
    onSave?.({ nodes: exportNodes, edges });
  }, [nodes, edges, onSave]);

  // ─── Zoom با scroll ───
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    setZoom((z) => Math.max(0.3, Math.min(2, z - e.deltaY * 0.001)));
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  // ─── رندر لبه‌ها (SVG) ───
  const renderEdges = () =>
    edges.map((edge) => {
      const src = nodes.find((n) => n.id === edge.source);
      const tgt = nodes.find((n) => n.id === edge.target);
      if (!src || !tgt) return null;
      const x1 = src.position.x + NODE_WIDTH / 2;
      const y1 = src.position.y + NODE_HEIGHT / 2;
      const x2 = tgt.position.x + NODE_WIDTH / 2;
      const y2 = tgt.position.y + NODE_HEIGHT / 2;
      const cx1 = x1 + (x2 - x1) / 2;
      const cy1 = y1;
      const cx2 = x1 + (x2 - x1) / 2;
      const cy2 = y2;

      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;

      return (
        <g key={edge.id}>
          <path
            d={`M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`}
            fill="none"
            stroke={COLORS.edge}
            strokeWidth={2}
            markerEnd="url(#arrowhead)"
          />
          {/* دکمه حذف لبه */}
          <circle
            cx={midX}
            cy={midY}
            r={8}
            fill="white"
            stroke={COLORS.border}
            strokeWidth={1.5}
            style={{ cursor: "pointer" }}
            onClick={() => deleteEdge(edge.id)}
          />
          <text
            x={midX}
            y={midY + 4}
            textAnchor="middle"
            fontSize={10}
            fill="#ef4444"
            style={{ cursor: "pointer", pointerEvents: "none" }}
          >
            ×
          </text>
          {edge.label && (
            <text
              x={midX}
              y={midY - 14}
              textAnchor="middle"
              fontSize={10}
              fill={COLORS.muted}
            >
              {edge.label}
            </text>
          )}
        </g>
      );
    });

  // ─── رندر نودها ───
  const renderNodes = () =>
    nodes.map((node) => {
      const isSelected = selectedNode === node.id;
      const isStart = node.type === "start";
      const color = isStart
        ? COLORS.start
        : node.type === "category"
        ? COLORS.category
        : COLORS.service;

      return (
        <g
          key={node.id}
          transform={`translate(${node.position.x}, ${node.position.y})`}
          style={{ cursor: node.id === "start" ? "default" : "move" }}
          onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
        >
          {/* سایه */}
          <rect
            x={3}
            y={3}
            width={NODE_WIDTH}
            height={NODE_HEIGHT}
            rx={12}
            fill="rgba(0,0,0,0.08)"
          />
          {/* بدنه اصلی */}
          <rect
            width={NODE_WIDTH}
            height={NODE_HEIGHT}
            rx={12}
            fill="white"
            stroke={isSelected ? color : COLORS.border}
            strokeWidth={isSelected ? 2.5 : 1.5}
          />
          {/* نوار رنگی بالا */}
          <rect
            width={NODE_WIDTH}
            height={6}
            rx={12}
            fill={color}
            style={{ clipPath: "inset(0 0 -12px 0)" }}
          />

          {/* آیکون نوع */}
          <text x={16} y={36} fontSize={14} fill={color}>
            {isStart ? "▶" : node.type === "category" ? "⬡" : "⚙"}
          </text>

          {/* عنوان */}
          <text
            x={38}
            y={36}
            fontSize={12}
            fontWeight="bold"
            fill="#1e293b"
            fontFamily="Vazirmatn, sans-serif"
          >
            {node.label.length > 20
              ? node.label.slice(0, 20) + "…"
              : node.label}
          </text>

          {/* زیرعنوان */}
          <text
            x={38}
            y={52}
            fontSize={10}
            fill={COLORS.muted}
            fontFamily="Vazirmatn, sans-serif"
          >
            {isStart
              ? "نقطه شروع"
              : node.type === "category"
              ? categories.find((c) => c._id === node.categoryId)?.title ||
                "دسته‌بندی انتخاب نشده"
              : node.serviceName || "خدمت بدون نام"}
          </text>

          {/* تگ اجباری */}
          {node.required && !isStart && (
            <g transform={`translate(${NODE_WIDTH - 54}, 58)`}>
              <rect width={48} height={16} rx={8} fill="#fef3c7" />
              <text
                x={24}
                y={11}
                textAnchor="middle"
                fontSize={9}
                fill="#92400e"
                fontFamily="Vazirmatn, sans-serif"
              >
                اجباری
              </text>
            </g>
          )}

          {/* دکمه اتصال (خروجی) */}
          <circle
            cx={NODE_WIDTH}
            cy={NODE_HEIGHT / 2}
            r={8}
            fill={connecting?.fromId === node.id ? COLORS.primary : "white"}
            stroke={connecting?.fromId === node.id ? COLORS.primary : COLORS.border}
            strokeWidth={2}
            style={{ cursor: "crosshair" }}
            onClick={(e) => {
              e.stopPropagation();
              if (connecting?.fromId === node.id) {
                setConnecting(null);
              } else {
                setConnecting({ fromId: node.id });
              }
            }}
          />
          <text
            x={NODE_WIDTH}
            y={NODE_HEIGHT / 2 + 4}
            textAnchor="middle"
            fontSize={11}
            fill={connecting?.fromId === node.id ? "white" : COLORS.muted}
            style={{ pointerEvents: "none" }}
          >
            →
          </text>
        </g>
      );
    });

  const selectedNodeData = nodes.find((n) => n.id === selectedNode);

  return (
    <div
      className="flex h-full"
      style={{ fontFamily: "Vazirmatn, sans-serif", direction: "rtl" }}
    >
      {/* ─── Canvas ─── */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden"
        style={{ background: "#f8f9fb", minHeight: 600 }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseDown={handleCanvasMouseDown}
      >
        {/* شبکه پس‌زمینه */}
        <svg
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
          }}
        >
          <defs>
            <pattern
              id="grid"
              width={20 * zoom}
              height={20 * zoom}
              patternUnits="userSpaceOnUse"
              x={pan.x % (20 * zoom)}
              y={pan.y % (20 * zoom)}
            >
              <circle cx={1} cy={1} r={0.7} fill="#e2e8f0" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* پیام اتصال */}
        {connecting && (
          <div
            className="absolute top-4 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-xl text-sm font-bold text-white shadow-lg"
            style={{ background: COLORS.primary }}
          >
            روی نود مقصد کلیک کنید تا اتصال برقرار شود — یا روی بوم کلیک کنید برای لغو
          </div>
        )}

        {/* SVG اصلی گراف */}
        <svg
          ref={svgRef}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            overflow: "visible",
          }}
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth={10}
              markerHeight={7}
              refX={9}
              refY={3.5}
              orient="auto"
            >
              <polygon
                points="0 0, 10 3.5, 0 7"
                fill={COLORS.edge}
              />
            </marker>
          </defs>
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {renderEdges()}
            {renderNodes()}
          </g>
        </svg>

        {/* کنترل‌های zoom */}
        <div className="absolute bottom-4 left-4 flex flex-col gap-1 z-10">
          <button
            onClick={() => setZoom((z) => Math.min(2, z + 0.1))}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shadow-sm transition-all hover:scale-105"
            style={{ background: "white", border: `1px solid ${COLORS.border}`, color: COLORS.primary }}
          >
            +
          </button>
          <div
            className="w-8 h-7 rounded-md flex items-center justify-center text-xs font-bold"
            style={{ background: "white", border: `1px solid ${COLORS.border}`, color: COLORS.muted }}
          >
            {Math.round(zoom * 100)}%
          </div>
          <button
            onClick={() => setZoom((z) => Math.max(0.3, z - 0.1))}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shadow-sm transition-all hover:scale-105"
            style={{ background: "white", border: `1px solid ${COLORS.border}`, color: COLORS.primary }}
          >
            −
          </button>
          <button
            onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-xs shadow-sm transition-all hover:scale-105 mt-1"
            style={{ background: "white", border: `1px solid ${COLORS.border}`, color: COLORS.muted }}
            title="ریست دید"
          >
            ↺
          </button>
        </div>
      </div>

      {/* ─── پنل سمت راست ─── */}
      <div
        className="flex flex-col"
        style={{
          width: showPanel ? 320 : 40,
          borderLeft: `1px solid ${COLORS.border}`,
          background: "white",
          transition: "width 0.3s ease",
          overflow: "hidden",
        }}
      >
        {/* تاگل پنل */}
        <button
          onClick={() => setShowPanel((v) => !v)}
          className="flex items-center justify-center w-full py-2 hover:bg-gray-50 transition-colors"
          style={{ borderBottom: `1px solid ${COLORS.border}`, minHeight: 40 }}
        >
          {showPanel ? (
            <FiArrowRight size={16} style={{ color: COLORS.muted }} />
          ) : (
            <FiArrowLeft size={16} style={{ color: COLORS.muted }} />
          )}
        </button>

        {showPanel && (
          <div className="flex-1 overflow-y-auto" style={{ fontSize: 13 }}>
            {/* افزودن نود */}
            <div className="p-4" style={{ borderBottom: `1px solid ${COLORS.border}` }}>
              <p className="font-bold text-xs mb-3" style={{ color: COLORS.muted }}>
                افزودن نود جدید
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => addNode("category")}
                  className="flex-1 flex items-center gap-1.5 justify-center py-2 px-3 rounded-lg text-xs font-bold transition-all hover:opacity-90"
                  style={{ background: `${COLORS.category}15`, color: COLORS.category, border: `1px solid ${COLORS.category}30` }}
                >
                  <FiGrid size={13} />
                  دسته‌بندی
                </button>
                <button
                  onClick={() => addNode("service")}
                  className="flex-1 flex items-center gap-1.5 justify-center py-2 px-3 rounded-lg text-xs font-bold transition-all hover:opacity-90"
                  style={{ background: `${COLORS.service}15`, color: COLORS.service, border: `1px solid ${COLORS.service}30` }}
                >
                  <FiTool size={13} />
                  خدمت
                </button>
              </div>
            </div>

            {/* ویرایش نود انتخاب‌شده */}
            {selectedNodeData && selectedNodeData.id !== "start" && (
              <NodeEditor
                node={selectedNodeData}
                categories={categories}
                onUpdate={(updates) => updateNode(selectedNodeData.id, updates)}
                onDelete={() => deleteNode(selectedNodeData.id)}
                onAddOption={() => addServiceOption(selectedNodeData.id)}
                onUpdateOption={(i, f, v) =>
                  updateServiceOption(selectedNodeData.id, i, f, v)
                }
                onRemoveOption={(i) =>
                  removeServiceOption(selectedNodeData.id, i)
                }
              />
            )}

            {/* راهنما */}
            {!selectedNodeData && (
              <div className="p-4">
                <div className="rounded-xl p-4" style={{ background: "#f8f9fb", border: `1px solid ${COLORS.border}` }}>
                  <p className="font-bold text-xs mb-3" style={{ color: "#334155" }}>
                    راهنمای ساخت گراف
                  </p>
                  <div className="space-y-2 text-xs" style={{ color: COLORS.muted }}>
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5">①</span>
                      <span>نود دسته‌بندی یا خدمت اضافه کنید</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5">②</span>
                      <span>روی نود کلیک کنید تا ویرایش شود</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5">③</span>
                      <span>برای اتصال: دکمه <span className="font-bold">←</span> نود مبدا را بزنید سپس روی نود مقصد کلیک کنید</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5">④</span>
                      <span>برای حذف اتصال: روی دکمه <span style={{ color: "#ef4444" }}>×</span> وسط خط کلیک کنید</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5">⑤</span>
                      <span>نودها را با کشیدن جابجا کنید</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5">⑥</span>
                      <span>برای جابجایی بوم: فضای خالی را بکشید</span>
                    </div>
                  </div>
                </div>

                {/* خلاصه */}
                <div className="mt-4 rounded-xl p-3" style={{ background: `${COLORS.primary}08`, border: `1px solid ${COLORS.primary}20` }}>
                  <p className="font-bold text-xs mb-2" style={{ color: COLORS.primary }}>
                    خلاصه فرایند
                  </p>
                  <div className="text-xs space-y-1" style={{ color: COLORS.muted }}>
                    <p>تعداد نودها: <span className="font-bold text-gray-700">{nodes.length - 1}</span></p>
                    <p>تعداد اتصالات: <span className="font-bold text-gray-700">{edges.length}</span></p>
                    <p>
                      نودهای دسته‌بندی:{" "}
                      <span className="font-bold text-gray-700">
                        {nodes.filter((n) => n.type === "category").length}
                      </span>
                    </p>
                    <p>
                      نودهای خدمت:{" "}
                      <span className="font-bold text-gray-700">
                        {nodes.filter((n) => n.type === "service").length}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* دکمه ذخیره */}
        {showPanel && (
          <div className="p-4" style={{ borderTop: `1px solid ${COLORS.border}` }}>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 disabled:opacity-60"
              style={{ background: `linear-gradient(135deg, ${COLORS.primary}, #0a5c37)` }}
            >
              {isSaving ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  در حال ذخیره...
                </>
              ) : (
                <>
                  <FiSave size={15} />
                  ذخیره گراف
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── کامپوننت ویرایش نود ───
function NodeEditor({
  node,
  categories,
  onUpdate,
  onDelete,
  onAddOption,
  onUpdateOption,
  onRemoveOption,
}) {
  const isCategory = node.type === "category";
  const isService = node.type === "service";

  return (
    <div className="p-4 space-y-4">
      {/* هدر */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-xs"
            style={{
              background: isCategory ? COLORS.category : COLORS.service,
            }}
          >
            {isCategory ? "⬡" : "⚙"}
          </div>
          <span className="font-bold text-xs" style={{ color: "#334155" }}>
            ویرایش {isCategory ? "دسته‌بندی" : "خدمت"}
          </span>
        </div>
        <button
          onClick={onDelete}
          className="w-7 h-7 flex items-center justify-center rounded-lg transition-all hover:bg-red-50"
          style={{ color: "#ef4444", border: `1px solid #fecaca` }}
          title="حذف نود"
        >
          <FiTrash2 size={13} />
        </button>
      </div>

      {/* عنوان */}
      <div>
        <label className="block text-xs font-bold mb-1.5" style={{ color: COLORS.muted }}>
          عنوان نمایشی
        </label>
        <input
          type="text"
          value={node.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          className="w-full px-3 py-2 rounded-lg text-xs focus:outline-none transition-all"
          style={{
            border: `1px solid ${COLORS.border}`,
            fontFamily: "Vazirmatn, sans-serif",
            background: "#f8f9fb",
          }}
          placeholder="مثلا: انتخاب زه تنیس"
        />
      </div>

      {/* اجباری */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onUpdate({ required: !node.required })}
          className="w-9 h-5 rounded-full transition-all relative"
          style={{
            background: node.required ? COLORS.primary : COLORS.border,
          }}
        >
          <span
            className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
            style={{
              left: node.required ? "calc(100% - 1.1rem)" : "2px",
            }}
          />
        </button>
        <span className="text-xs font-bold" style={{ color: "#334155" }}>
          انتخاب اجباری
        </span>
      </div>

      {/* ─── ویژگی‌های دسته‌بندی ─── */}
      {isCategory && (
        <>
          <div>
            <label className="block text-xs font-bold mb-1.5" style={{ color: COLORS.muted }}>
              دسته‌بندی مرتبط
            </label>
            <select
              value={node.categoryId || ""}
              onChange={(e) => onUpdate({ categoryId: e.target.value || null })}
              className="w-full px-3 py-2 rounded-lg text-xs focus:outline-none transition-all"
              style={{
                border: `1px solid ${COLORS.border}`,
                fontFamily: "Vazirmatn, sans-serif",
                background: "#f8f9fb",
              }}
            >
              <option value="">انتخاب دسته‌بندی...</option>
              {categories.map((cat) => (
                <option key={cat._id} value={cat._id}>
                  {cat.title}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                onUpdate({ allowVariantSelection: !node.allowVariantSelection })
              }
              className="w-9 h-5 rounded-full transition-all relative"
              style={{
                background: node.allowVariantSelection
                  ? COLORS.category
                  : COLORS.border,
              }}
            >
              <span
                className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
                style={{
                  left: node.allowVariantSelection
                    ? "calc(100% - 1.1rem)"
                    : "2px",
                }}
              />
            </button>
            <span className="text-xs font-bold" style={{ color: "#334155" }}>
              انتخاب واریانت فعال باشد
            </span>
          </div>
        </>
      )}

      {/* ─── ویژگی‌های خدمت ─── */}
      {isService && (
        <>
          <div>
            <label className="block text-xs font-bold mb-1.5" style={{ color: COLORS.muted }}>
              نام خدمت
            </label>
            <input
              type="text"
              value={node.serviceName || ""}
              onChange={(e) => onUpdate({ serviceName: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-xs focus:outline-none transition-all"
              style={{
                border: `1px solid ${COLORS.border}`,
                fontFamily: "Vazirmatn, sans-serif",
                background: "#f8f9fb",
              }}
              placeholder="مثلا: زه‌کشی"
            />
          </div>

          {/* آپشن‌های خدمت */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold" style={{ color: COLORS.muted }}>
                آپشن‌ها
              </label>
              <button
                onClick={onAddOption}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold transition-all"
                style={{
                  background: `${COLORS.service}15`,
                  color: COLORS.service,
                  border: `1px solid ${COLORS.service}30`,
                }}
              >
                <FiPlus size={11} />
                افزودن
              </button>
            </div>

            {(!node.serviceOptions || node.serviceOptions.length === 0) && (
              <div
                className="text-center py-3 rounded-lg text-xs"
                style={{ background: "#f8f9fb", color: COLORS.muted, border: `1px dashed ${COLORS.border}` }}
              >
                هنوز آپشنی تعریف نشده
              </div>
            )}

            <div className="space-y-2 max-h-56 overflow-y-auto">
              {node.serviceOptions?.map((opt, i) => (
                <div
                  key={i}
                  className="p-2 rounded-lg"
                  style={{ background: "#f8f9fb", border: `1px solid ${COLORS.border}` }}
                >
                  <div className="flex items-center gap-1 mb-1.5">
                    <input
                      type="text"
                      value={opt.label}
                      onChange={(e) => onUpdateOption(i, "label", e.target.value)}
                      className="flex-1 px-2 py-1 rounded text-xs focus:outline-none"
                      style={{ border: `1px solid ${COLORS.border}`, fontFamily: "Vazirmatn, sans-serif" }}
                      placeholder="عنوان آپشن"
                    />
                    <button
                      onClick={() => onRemoveOption(i)}
                      className="w-6 h-6 flex items-center justify-center rounded text-red-400 hover:bg-red-50"
                    >
                      <FiX size={11} />
                    </button>
                  </div>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={opt.value}
                      onChange={(e) => onUpdateOption(i, "value", e.target.value)}
                      className="flex-1 px-2 py-1 rounded text-xs focus:outline-none"
                      style={{ border: `1px solid ${COLORS.border}`, fontFamily: "Vazirmatn, sans-serif" }}
                      placeholder="مقدار (مثلا: 25)"
                    />
                    <input
                      type="number"
                      value={opt.priceModifier}
                      onChange={(e) =>
                        onUpdateOption(i, "priceModifier", Number(e.target.value))
                      }
                      className="w-20 px-2 py-1 rounded text-xs focus:outline-none"
                      style={{ border: `1px solid ${COLORS.border}`, fontFamily: "Vazirmatn, sans-serif" }}
                      placeholder="تغییر قیمت"
                    />
                  </div>
                  <p className="text-[10px] mt-1" style={{ color: COLORS.muted }}>
                    تغییر قیمت (تومان): مثبت = افزایش، منفی = کاهش
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
