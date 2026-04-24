"use client";
import React, { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { ZoomIn, ZoomOut, Move } from "lucide-react";
import type { ArchNode, ArchGraph } from "@/types/ArchGraphTypes";
import { LAYER_COLORS } from "@/types/ArchGraphTypes";
import { cn } from "@/lib/utils";

interface ArchMindmap2DProps {
    graph: ArchGraph;
    selectedId: string | null;
    onSelectNode: (id: string) => void;
    expandedNodes: Set<string>;
    onToggleExpand: (id: string) => void;
}

interface LayoutNode extends ArchNode {
    x: number;
    y: number;
    width: number;
    height: number;
    visible: boolean;
}

const NODE_WIDTH = 180;
const NODE_HEIGHT = 44;
const VERTICAL_SPACING = 80;
const HORIZONTAL_SPACING = 40;

export default function ArchMindmap2D({
    graph,
    selectedId,
    onSelectNode,
    expandedNodes,
    onToggleExpand,
}: ArchMindmap2DProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    
    // Pan and Zoom state
    const [transform, setTransform] = useState({ x: 0, y: 50, scale: 0.9 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [hoveredId, setHoveredId] = useState<string | null>(null);

    // 1. Calculate Layout (Vertical Tree)
    const layoutNodes = useMemo(() => {
        const nodes: Map<string, LayoutNode> = new Map();
        const rootNodes = graph.nodes.filter(n => n.depth === 0);
        
        // Initial pass: determine visibility and count widths
        const calculateWidths = (nodeId: string): number => {
            const node = graph.nodes.find(n => n.id === nodeId);
            if (!node) return 0;
            
            const isExpanded = expandedNodes.has(nodeId);
            if (!isExpanded || node.children.length === 0) {
                return NODE_WIDTH + HORIZONTAL_SPACING;
            }
            
            let totalWidth = 0;
            node.children.forEach(childId => {
                totalWidth += calculateWidths(childId);
            });
            return Math.max(totalWidth, NODE_WIDTH + HORIZONTAL_SPACING);
        };

        // Second pass: assign positions
        const assignPositions = (nodeId: string, currentX: number, currentY: number, totalWidth: number) => {
            const node = graph.nodes.find(n => n.id === nodeId);
            if (!node) return;

            const x = currentX + totalWidth / 2 - NODE_WIDTH / 2;
            const y = currentY;

            nodes.set(nodeId, {
                ...node,
                x,
                y,
                width: NODE_WIDTH,
                height: NODE_HEIGHT,
                visible: true
            });

            const isExpanded = expandedNodes.has(nodeId);
            if (isExpanded) {
                let startX = currentX;
                node.children.forEach(childId => {
                    const childWidth = calculateWidths(childId);
                    assignPositions(childId, startX, y + VERTICAL_SPACING, childWidth);
                    startX += childWidth;
                });
            }
        };

        let currentStartX = 0;
        rootNodes.forEach(root => {
            const width = calculateWidths(root.id);
            assignPositions(root.id, currentStartX, 0, width);
            currentStartX += width;
        });

        return nodes;
    }, [graph.nodes, expandedNodes]);

    // 2. Rendering Logic
    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Clear and transform
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        ctx.translate(canvas.width / 2 + transform.x, transform.y);
        ctx.scale(transform.scale, transform.scale);

        // Draw Connections
        ctx.beginPath();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
        ctx.lineWidth = 1.5;
        
        layoutNodes.forEach((node) => {
            const isExpanded = expandedNodes.has(node.id);
            if (isExpanded) {
                node.children.forEach(childId => {
                    const child = layoutNodes.get(childId);
                    if (child) {
                        ctx.moveTo(node.x + node.width / 2, node.y + node.height);
                        // Cubic bezier for smooth curves
                        const cpY = (node.y + node.height + child.y) / 2;
                        ctx.bezierCurveTo(
                            node.x + node.width / 2, cpY,
                            child.x + child.width / 2, cpY,
                            child.x + child.width / 2, child.y
                        );
                    }
                });
            }
        });
        ctx.stroke();

        // Draw Nodes
        layoutNodes.forEach((node) => {
            const isSelected = selectedId === node.id;
            const isHovered = hoveredId === node.id;
            const layerColor = LAYER_COLORS[node.layer] || "#64748b";

            // Node Shadow/Glow
            if (isSelected || isHovered) {
                ctx.shadowBlur = 15;
                ctx.shadowColor = isSelected ? "rgba(249, 115, 22, 0.3)" : "rgba(255, 255, 255, 0.1)";
            } else {
                ctx.shadowBlur = 0;
            }

            // Node Body
            ctx.fillStyle = isSelected ? "#1a1a1a" : "#0d0d0d";
            ctx.strokeStyle = isSelected ? "#f97316" : (isHovered ? "rgba(255, 255, 255, 0.3)" : "rgba(255, 255, 255, 0.1)");
            ctx.lineWidth = isSelected ? 2 : 1;

            const radius = 12;
            ctx.beginPath();
            ctx.roundRect(node.x, node.y, node.width, node.height, radius);
            ctx.fill();
            ctx.stroke();

            // Layer Indicator (Dot)
            ctx.fillStyle = layerColor;
            ctx.beginPath();
            ctx.arc(node.x + 18, node.y + node.height / 2, 3, 0, Math.PI * 2);
            ctx.fill();

            // Text
            ctx.fillStyle = isSelected ? "#ffffff" : "#cbd5e1";
            ctx.font = "bold 11px Inter, sans-serif";
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            
            // Truncate text if too long
            let label = node.label;
            const maxTextWidth = node.width - 60;
            if (ctx.measureText(label).width > maxTextWidth) {
                while (ctx.measureText(label + "...").width > maxTextWidth && label.length > 0) {
                    label = label.slice(0, -1);
                }
                label += "...";
            }
            ctx.fillText(label, node.x + 32, node.y + node.height / 2);

            // Expand/Collapse Indicator
            if (node.isExpandable) {
                const isExpanded = expandedNodes.has(node.id);
                ctx.fillStyle = isExpanded ? "#f97316" : "#64748b";
                ctx.font = "12px sans-serif";
                ctx.textAlign = "center";
                ctx.fillText(isExpanded ? "−" : "+", node.x + node.width - 20, node.y + node.height / 2);
            }
        });
    }, [layoutNodes, transform, selectedId, hoveredId, expandedNodes]);

    // 3. Animation and Resizing
    useEffect(() => {
        const handleResize = () => {
            if (canvasRef.current && containerRef.current) {
                const { width, height } = containerRef.current.getBoundingClientRect();
                canvasRef.current.width = width * window.devicePixelRatio;
                canvasRef.current.height = height * window.devicePixelRatio;
                canvasRef.current.style.width = `${width}px`;
                canvasRef.current.style.height = `${height}px`;
                canvasRef.current.getContext("2d")?.scale(window.devicePixelRatio, window.devicePixelRatio);
                draw();
            }
        };

        window.addEventListener("resize", handleResize);
        handleResize();
        return () => window.removeEventListener("resize", handleResize);
    }, [draw]);

    useEffect(() => {
        draw();
    }, [draw]);

    // 4. Input Handling
    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return; // Only left click
        
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        
        const x = (e.clientX - rect.left - canvasRef.current!.width / (2 * window.devicePixelRatio) - transform.x) / transform.scale;
        const y = (e.clientY - rect.top - transform.y) / transform.scale;

        // Check for node clicks
        let clickedNodeId: string | null = null;
        layoutNodes.forEach((node) => {
            if (x >= node.x && x <= node.x + node.width && y >= node.y && y <= node.y + node.height) {
                clickedNodeId = node.id;
            }
        });

        if (clickedNodeId) {
            onSelectNode(clickedNodeId);
            // Check if clicked on the right side for expand/collapse
            const node = layoutNodes.get(clickedNodeId)!;
            if (node.isExpandable && x > node.x + node.width - 40) {
                onToggleExpand(clickedNodeId);
            }
        } else {
            setIsDragging(true);
            setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging) {
            setTransform(prev => ({
                ...prev,
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y
            }));
        } else {
            const rect = canvasRef.current?.getBoundingClientRect();
            if (!rect) return;
            const x = (e.clientX - rect.left - canvasRef.current!.width / (2 * window.devicePixelRatio) - transform.x) / transform.scale;
            const y = (e.clientY - rect.top - transform.y) / transform.scale;

            let foundId: string | null = null;
            layoutNodes.forEach((node) => {
                if (x >= node.x && x <= node.x + node.width && y >= node.y && y <= node.y + node.height) {
                    foundId = node.id;
                }
            });
            setHoveredId(foundId);
        }
    };

    const handleMouseUp = () => setIsDragging(false);

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.95 : 1.05;
        setTransform(prev => ({
            ...prev,
            scale: Math.min(Math.max(prev.scale * delta, 0.2), 3)
        }));
    };

    return (
        <div ref={containerRef} className="w-full h-full bg-[#050505] relative overflow-hidden group">
            <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
                className={cn(
                    "w-full h-full cursor-grab active:cursor-grabbing transition-opacity duration-300",
                    isDragging && "opacity-80"
                )}
            />

            {/* Canvas Controls */}
            <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-20">
                <button 
                    onClick={() => setTransform(prev => ({ ...prev, scale: Math.min(prev.scale * 1.2, 3) }))}
                    className="p-2.5 rounded-xl bg-[#0d0d0d]/60 backdrop-blur-md border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 transition-all shadow-xl"
                >
                    <ZoomIn className="w-4 h-4" />
                </button>
                <button 
                    onClick={() => setTransform(prev => ({ ...prev, scale: Math.max(prev.scale / 1.2, 0.2) }))}
                    className="p-2.5 rounded-xl bg-[#0d0d0d]/60 backdrop-blur-md border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 transition-all shadow-xl"
                >
                    <ZoomOut className="w-4 h-4" />
                </button>
                <button 
                    onClick={() => setTransform({ x: 0, y: 50, scale: 0.9 })}
                    className="p-2.5 rounded-xl bg-[#0d0d0d]/60 backdrop-blur-md border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 transition-all shadow-xl"
                >
                    <Move className="w-4 h-4" />
                </button>
            </div>

            {/* Legend/Hint */}
            <div className="absolute bottom-6 left-6 pointer-events-none">
                <div className="bg-[#0d0d0d]/40 backdrop-blur-md border border-white/5 rounded-lg px-3 py-1.5 flex items-center gap-4">
                    <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Canvas Active</span>
                    <div className="w-1 h-1 rounded-full bg-orange-500 animate-pulse" />
                </div>
            </div>
        </div>
    );
}
