// Chorus v1.1 — Progressive Disclosure Architecture Types

export interface ArchNode {
    id: string;
    label: string;
    type:
    | "cluster"
    | "module"
    | "entry"
    | "service"
    | "controller"
    | "component"
    | "model"
    | "api"
    | "database"
    | "config"
    | "infra"
    | "function";
    description: string;
    layer: "ui" | "api" | "service" | "domain" | "data" | "infra" | "config";
    importance: number;
    complexity: number;
    size: number;
    tags: string[];

    // Progressive disclosure fields
    parentId: string | null;
    children: string[];
    isExpandable: boolean;
    defaultExpanded: boolean;
    depth: number;
    childCount: number;
    visualHint:
    | "folder-collapsed"
    | "folder-expanded"
    | "file-collapsed"
    | "file-expanded"
    | "leaf-node";

    // Legacy (kept for compat)
    cluster?: string;
    hierarchyLevel?: number;
    positionHint?: string;
}

export interface ArchEdge {
    source: string;
    target: string;
    relationship:
    | "imports"
    | "calls"
    | "depends_on"
    | "exposes_api"
    | "reads_from"
    | "writes_to"
    | "handles_request"
    | "extends"
    | "implements"
    | "configures"
    | "triggers"
    | "subscribes_to"
    | "publishes_to"
    | "authenticates_via"
    | "caches";
    strength: number;
    direction: "forward" | "bidirectional";
    visibleAtDepth: number;
    aggregatedCount?: number;
}

export interface ArchCluster {
    id: string;
    name: string;
    description?: string;
    nodeCount: number;
    primaryLayer: string;
}

export interface ProgressiveStructure {
    maxDepth: number;
    rootNodes: string[];
    defaultViewDepth: number;
    expansionStrategy: "click-to-expand";
    recommendedStartNodes?: string[];
}

export interface ArchVisualization {
    initialView: string;
    cameraFocus: string;
    layoutStyle: string;
    expansionAnimation: string;
    collapseAnimation: string;
    expansionDuration?: number;
    layoutEngine?: string;
    // Legacy
    progressiveLevels?: number[];
    stabilityHint?: string;
    colorScheme?: string;
}

export interface ArchMetadata {
    totalNodes: number;
    visibleNodesAtStart: number;
    maxDepthAvailable: number;
    analysisConfidence: number;
    warnings?: string[];
    assumptions?: string[];
}

export interface ArchGraph {
    repository: string;
    summary: string;
    architecturePattern: string;
    systemType: string;
    complexityScore: number;
    progressiveStructure: ProgressiveStructure;
    nodes: ArchNode[];
    edges: ArchEdge[];
    visualization: ArchVisualization;
    tags: string[];
    metadata: ArchMetadata;
    // Legacy
    dominantLayer?: string;
    recommendedEntryNode?: string;
    clusters?: ArchCluster[];
}

// Layer → color mapping
export const LAYER_COLORS: Record<string, string> = {
    ui: "#06b6d4",      // vibrant cyan
    api: "#f97316",     // bright orange
    service: "#8b5cf6", // vivid purple
    domain: "#f43f5e",  // rose red
    data: "#10b981",    // emerald green
    infra: "#3b82f6",   // royal blue
    config: "#f59e0b",  // amber/gold
};

export const NODE_TYPE_ICONS: Record<string, string> = {
    cluster: "📁",
    module: "📦",
    entry: "⚡",
    service: "⚙️",
    controller: "🎮",
    component: "🧩",
    model: "📋",
    api: "🔌",
    database: "🗄️",
    config: "⚙️",
    infra: "🏗️",
    function: "ƒ",
};

// Depth-based visual scaling
export const DEPTH_SCALE: Record<number, number> = {
    0: 1.0,    // clusters are full size
    1: 0.7,    // modules are 70%
    2: 0.5,    // files are 50%
    3: 0.35,   // functions are 35%
};
