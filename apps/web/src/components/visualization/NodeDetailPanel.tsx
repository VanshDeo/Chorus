"use client";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { X, ArrowRight, FolderOpen, FolderClosed, FileText, ChevronRight } from "lucide-react";
import type { ArchNode, ArchGraph } from "@/types/ArchGraphTypes";
import { LAYER_COLORS, NODE_TYPE_ICONS } from "@/types/ArchGraphTypes";

const layerLabel: Record<string, string> = {
    ui: "UI Layer", api: "API Layer", service: "Service Layer", domain: "Domain Layer",
    data: "Data Layer", infra: "Infrastructure", config: "Configuration",
};

export default function NodeDetailPanel({
    graph,
    nodeId,
    expandedNodes,
    onToggleExpand,
    onClose,
}: {
    graph: ArchGraph;
    nodeId: string | null;
    expandedNodes: Set<string>;
    onToggleExpand: (id: string) => void;
    onClose: () => void;
}) {
    const node = nodeId ? graph.nodes.find((n) => n.id === nodeId) : null;
    const isExpanded = nodeId ? expandedNodes.has(nodeId) : false;
    const connectedEdges = nodeId
        ? graph.edges.filter((e) => e.source === nodeId || e.target === nodeId)
        : [];

    // Build breadcrumb path
    const breadcrumb: ArchNode[] = [];
    if (node) {
        let current: ArchNode | undefined = node;
        while (current) {
            breadcrumb.unshift(current);
            current = current.parentId
                ? graph.nodes.find((n) => n.id === current!.parentId)
                : undefined;
        }
    }

    // Get immediate children
    const children = node
        ? graph.nodes.filter((n) => n.parentId === nodeId)
        : [];

    return (
        <AnimatePresence>
            {node && (
                <motion.div
                    key="panel"
                    initial={{ x: 350, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 350, opacity: 0 }}
                    transition={{ type: "spring", damping: 25, stiffness: 200 }}
                    className="absolute top-0 right-0 w-[340px] h-full bg-[#0d0d0d]/80 backdrop-blur-3xl border-l border-white/10 overflow-y-auto z-20 shadow-[-20px_0_40px_rgba(0,0,0,0.5)]"
                >
                    {/* Header */}
                    <div className="p-6 border-b border-white/5 bg-white/[0.02]">
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-2xl border border-white/5">
                                    {NODE_TYPE_ICONS[node.type] ?? "📦"}
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-white leading-tight uppercase tracking-tight">{node.label}</h3>
                                    <span className="text-[9px] uppercase tracking-[0.2em] font-black text-orange-500 opacity-80">
                                        {node.type} • Level {node.depth}
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/10 transition-all border border-white/5"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed font-medium opacity-90">{node.description}</p>
                    </div>

                    {/* Breadcrumb */}
                    {breadcrumb.length > 1 && (
                        <div className="px-6 py-4 border-b border-white/5 bg-white/[0.01]">
                            <div className="flex items-center gap-1.5 text-[9px] flex-wrap font-black uppercase tracking-widest">
                                {breadcrumb.map((bc, i) => (
                                    <span key={bc.id} className="flex items-center gap-1.5">
                                        {i > 0 && <ChevronRight className="w-3 h-3 text-slate-700" />}
                                        <span className={bc.id === nodeId ? "text-orange-400" : "text-slate-600"}>
                                            {bc.label}
                                        </span>
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Expand/Collapse action */}
                    {node.isExpandable && (
                        <div className="px-6 py-4 border-b border-white/5">
                            <button
                                onClick={() => onToggleExpand(node.id)}
                                className={cn(
                                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-xs font-black uppercase tracking-widest border",
                                    isExpanded 
                                        ? "bg-orange-500/10 border-orange-500/20 text-orange-400" 
                                        : "bg-white/[0.03] border-white/5 text-slate-400 hover:bg-white/[0.06]"
                                )}
                            >
                                {isExpanded ? (
                                    <>
                                        <FolderOpen className="w-4 h-4" />
                                        <span>Collapse View</span>
                                        <span className="ml-auto opacity-50">{node.childCount}</span>
                                    </>
                                ) : (
                                    <>
                                        <FolderClosed className="w-4 h-4" />
                                        <span>Explore Subsystem</span>
                                        <span className="ml-auto opacity-50">{node.childCount}</span>
                                    </>
                                )}
                            </button>
                        </div>
                    )}

                    {/* Children list (when expanded) */}
                    {isExpanded && children.length > 0 && (
                        <div className="px-6 py-5 border-b border-white/5">
                            <h4 className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                <div className="w-2 h-px bg-slate-700" />
                                Sub-Components
                            </h4>
                            <div className="space-y-2">
                                {children.map((child) => (
                                    <button
                                        key={child.id}
                                        onClick={() => onToggleExpand(child.id)}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-transparent hover:border-white/5 hover:bg-white/[0.05] transition-all text-left group"
                                    >
                                        <div className="p-1.5 rounded-lg bg-white/5 text-slate-500 group-hover:text-orange-400 transition-colors">
                                            {child.isExpandable ? (
                                                <FolderClosed className="w-3.5 h-3.5" />
                                            ) : (
                                                <FileText className="w-3.5 h-3.5" />
                                            )}
                                        </div>
                                        <span className="text-[11px] text-slate-400 font-bold group-hover:text-white transition-colors truncate">{child.label}</span>
                                        <div
                                            className="ml-auto w-1.5 h-1.5 rounded-full shadow-[0_0_5px_currentColor]"
                                            style={{ backgroundColor: LAYER_COLORS[child.layer], color: LAYER_COLORS[child.layer] }}
                                        />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Metadata Section */}
                    <div className="px-6 py-6 border-b border-white/5 space-y-5 bg-white/[0.01]">
                        <div className="flex items-center justify-between">
                            <div className="flex flex-col">
                                <span className="text-[9px] text-slate-600 font-black uppercase tracking-widest mb-1">Architecture Layer</span>
                                <Badge
                                    className="rounded-full px-3 py-0.5 text-[9px] font-black uppercase tracking-widest border"
                                    style={{
                                        backgroundColor: `${LAYER_COLORS[node.layer]}10`,
                                        color: LAYER_COLORS[node.layer],
                                        borderColor: `${LAYER_COLORS[node.layer]}30`,
                                    }}
                                >
                                    {layerLabel[node.layer] ?? node.layer}
                                </Badge>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-[9px] text-slate-600 font-black uppercase tracking-widest mb-1">Node Status</span>
                                <span className="text-[10px] text-emerald-400 font-black uppercase tracking-widest bg-emerald-500/5 px-2 py-0.5 rounded-full border border-emerald-500/20">Verified</span>
                            </div>
                        </div>
                    </div>

                    {/* Metrics */}
                    <div className="px-5 py-4 border-b border-white/5 space-y-4">
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-xs text-slate-500 font-medium">Importance</span>
                                <span className="text-xs font-bold text-orange-400">
                                    {(node.importance * 100).toFixed(0)}%
                                </span>
                            </div>
                            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${node.importance * 100}%` }}
                                    transition={{ duration: 0.6 }}
                                    className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-500"
                                />
                            </div>
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-xs text-slate-500 font-medium">Complexity</span>
                                <span className="text-xs font-bold text-purple-400">
                                    {(node.complexity * 100).toFixed(0)}%
                                </span>
                            </div>
                            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${node.complexity * 100}%` }}
                                    transition={{ duration: 0.6, delay: 0.1 }}
                                    className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Connected Edges */}
                    {connectedEdges.length > 0 && (
                        <div className="px-5 py-4 border-b border-white/5">
                            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                                Connections ({connectedEdges.length})
                            </h4>
                            <div className="space-y-2">
                                {connectedEdges.slice(0, 8).map((edge, i) => {
                                    const isSource = edge.source === nodeId;
                                    const otherId = isSource ? edge.target : edge.source;
                                    const otherNode = graph.nodes.find((n) => n.id === otherId);
                                    return (
                                        <div key={i} className="flex items-center gap-2 text-xs bg-white/[0.03] rounded-lg px-3 py-2">
                                            <ArrowRight
                                                className={`w-3 h-3 flex-shrink-0 ${isSource ? "text-orange-400" : "text-blue-400 rotate-180"}`}
                                            />
                                            <span className="text-slate-300 truncate">{otherNode?.label ?? otherId}</span>
                                            <span className="ml-auto text-slate-600 text-[10px] flex-shrink-0">
                                                {edge.relationship}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Tags */}
                    {node.tags.length > 0 && (
                        <div className="px-5 py-4">
                            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Tags</h4>
                            <div className="flex flex-wrap gap-1.5">
                                {node.tags.map((tag) => (
                                    <Badge key={tag} className="bg-white/5 text-slate-400 border-white/10 text-[10px] px-2 py-0.5">
                                        {tag}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
}
