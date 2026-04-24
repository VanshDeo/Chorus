import { Octokit } from "@octokit/rest";
import { logger } from "../../observability/logger";
import { retrieve } from "../../rag/retrieval/retriever";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_MODEL = "gemini-flash-latest";
const IGNORED_DIRS = new Set(["node_modules", "vendor", "dist", "build", ".next", "coverage", ".git"]);

type FallbackNode = {
    id: string;
    label: string;
    type: "cluster" | "module" | "config" | "component" | "service" | "function";
    description: string;
    layer: "ui" | "api" | "service" | "domain" | "data" | "infra" | "config";
    importance: number;
    complexity: number;
    size: number;
    tags: string[];
    parentId: string | null;
    children: string[];
    isExpandable: boolean;
    defaultExpanded: boolean;
    depth: number;
    childCount: number;
    visualHint: "folder-collapsed" | "file-collapsed" | "leaf-node";
};

type FallbackEdge = {
    source: string;
    target: string;
    relationship: "depends_on" | "calls" | "configures";
    strength: number;
    direction: "forward";
    visibleAtDepth: number;
};

function toId(prefix: string, value: string): string {
    return `${prefix}_${value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")}`;
}

function inferLayer(segment: string): FallbackNode["layer"] {
    const lower = segment.toLowerCase();
    if (["web", "ui", "app", "components", "pages"].some((part) => lower.includes(part))) return "ui";
    if (["api", "server", "routes", "controllers", "webhooks"].some((part) => lower.includes(part))) return "api";
    if (["db", "data", "schema", "models", "cache"].some((part) => lower.includes(part))) return "data";
    if (["infra", "docker", "deploy", "scripts"].some((part) => lower.includes(part))) return "infra";
    if (["config", "env", "settings"].some((part) => lower.includes(part))) return "config";
    if (["service", "worker", "jobs", "queue", "rag", "graph"].some((part) => lower.includes(part))) return "service";
    return "domain";
}

function inferNodeType(segment: string, depth: number): FallbackNode["type"] {
    const lower = segment.toLowerCase();
    if (depth === 0) return "cluster";
    if (["config", "env", "json", "yaml", "yml"].some((part) => lower.includes(part))) return "config";
    if (["component", "page", "layout"].some((part) => lower.includes(part))) return "component";
    if (["service", "worker", "job", "queue", "graph", "rag"].some((part) => lower.includes(part))) return "service";
    if (depth >= 2) return "function";
    return "module";
}

function buildFallbackArchitectureGraph(owner: string, repoName: string, filteredPaths: string[], githubToken?: string) {
    const topGroups = new Map<string, string[]>();

    for (const path of filteredPaths) {
        const parts = path.split("/").filter(Boolean);
        if (parts.length === 0) continue;
        const top = parts[0];
        const group = topGroups.get(top) ?? [];
        group.push(path);
        topGroups.set(top, group);
    }

    const sortedGroups = Array.from(topGroups.entries())
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 6);

    const nodes: FallbackNode[] = [];
    const edges: FallbackEdge[] = [];
    const rootNodes: string[] = [];

    for (const [groupName, groupPaths] of sortedGroups) {
        const clusterId = toId("cluster", groupName);
        rootNodes.push(clusterId);

        const clusterChildren: string[] = [];
        const secondLevelGroups = new Map<string, string[]>();

        for (const path of groupPaths.slice(0, 20)) {
            const parts = path.split("/").filter(Boolean);
            const second = parts[1] ?? parts[0];
            const list = secondLevelGroups.get(second) ?? [];
            list.push(path);
            secondLevelGroups.set(second, list);
        }

        nodes.push({
            id: clusterId,
            label: groupName,
            type: "cluster",
            description: `${groupName} is a top-level area in ${owner}/${repoName} containing ${groupPaths.length} relevant files.`,
            layer: inferLayer(groupName),
            importance: 0.9,
            complexity: Math.min(1, 0.3 + groupPaths.length / 40),
            size: Math.min(10, Math.max(4, Math.round(groupPaths.length / 5))),
            tags: [groupName, "top-level"],
            parentId: null,
            children: clusterChildren,
            isExpandable: true,
            defaultExpanded: false,
            depth: 0,
            childCount: 0,
            visualHint: "folder-collapsed",
        });

        const moduleEntries = Array.from(secondLevelGroups.entries())
            .sort((a, b) => b[1].length - a[1].length)
            .slice(0, 4);

        for (const [moduleName, modulePaths] of moduleEntries) {
            const moduleId = toId("mod", `${groupName}_${moduleName}`);
            clusterChildren.push(moduleId);

            const fileChildren: string[] = [];
            nodes.push({
                id: moduleId,
                label: moduleName,
                type: inferNodeType(moduleName, 1),
                description: `${moduleName} groups ${modulePaths.length} files under ${groupName}.`,
                layer: inferLayer(moduleName),
                importance: 0.7,
                complexity: Math.min(1, 0.25 + modulePaths.length / 20),
                size: Math.min(8, Math.max(3, Math.round(modulePaths.length / 3))),
                tags: [groupName, moduleName],
                parentId: clusterId,
                children: fileChildren,
                isExpandable: true,
                defaultExpanded: false,
                depth: 1,
                childCount: 0,
                visualHint: "folder-collapsed",
            });

            edges.push({
                source: clusterId,
                target: moduleId,
                relationship: "depends_on",
                strength: 0.7,
                direction: "forward",
                visibleAtDepth: 1,
            });

            for (const filePath of modulePaths.slice(0, 2)) {
                const fileName = filePath.split("/").pop() || filePath;
                const fileId = toId("file", filePath);
                fileChildren.push(fileId);

                nodes.push({
                    id: fileId,
                    label: fileName,
                    type: inferNodeType(fileName, 2),
                    description: `${fileName} is one of the representative files inside ${moduleName}.`,
                    layer: inferLayer(fileName),
                    importance: 0.5,
                    complexity: 0.3,
                    size: 3,
                    tags: [fileName],
                    parentId: moduleId,
                    children: [],
                    isExpandable: false,
                    defaultExpanded: false,
                    depth: 2,
                    childCount: 0,
                    visualHint: "leaf-node",
                });

                edges.push({
                    source: moduleId,
                    target: fileId,
                    relationship: "calls",
                    strength: 0.5,
                    direction: "forward",
                    visibleAtDepth: 2,
                });
            }
        }
    }

    for (let i = 0; i < rootNodes.length - 1; i++) {
        edges.push({
            source: rootNodes[i],
            target: rootNodes[i + 1],
            relationship: "depends_on",
            strength: 0.45,
            direction: "forward",
            visibleAtDepth: 0,
        });
    }

    for (const node of nodes) {
        node.childCount = node.children.length;
        node.isExpandable = node.children.length > 0;
        node.visualHint = node.children.length > 0 ? "folder-collapsed" : "leaf-node";
    }

    return {
        repository: `${owner}/${repoName}`,
        summary: `Fallback architecture map generated from repository structure for ${owner}/${repoName}.`,
        architecturePattern: "workspace-monorepo",
        systemType: "software-repository",
        complexityScore: Math.min(10, Math.max(3, Math.round(filteredPaths.length / 25))),
        progressiveStructure: {
            maxDepth: 2,
            rootNodes,
            defaultViewDepth: 0,
            expansionStrategy: "click-to-expand",
            recommendedStartNodes: rootNodes.slice(0, 2),
        },
        nodes,
        edges,
        visualization: {
            initialView: "clusters-only",
            cameraFocus: rootNodes[0] ?? "",
            layoutStyle: "hierarchical-tree",
            expansionAnimation: "zoom-and-unfold",
            collapseAnimation: "fold-and-zoom-out",
            expansionDuration: 350,
            layoutEngine: "force-directed-hierarchical",
        },
        tags: ["fallback", "structure-based", owner, repoName],
        metadata: {
            totalNodes: nodes.length,
            visibleNodesAtStart: rootNodes.length,
            maxDepthAvailable: 2,
            analysisConfidence: 0.62,
            warnings: [
                "Generated from repository structure because AI architecture synthesis was unavailable.",
            ],
        },
    };
}

function validateArchitectureGraph(graph: any, allPaths: Set<string>): string[] {
    const errors: string[] = [];
    if (!graph.nodes || !Array.isArray(graph.nodes)) {
        return ["Graph must have a 'nodes' array."];
    }
    const nodeIds = new Set(graph.nodes.map((n: any) => n.id));

    for (const node of graph.nodes) {
        // Validate path if provided
        if (node.path && !allPaths.has(node.path)) {
            // Check if it's a directory (allPaths contains both blobs and trees)
            if (!allPaths.has(node.path)) {
                errors.push(`Node '${node.id}' refers to non-existent path '${node.path}'.`);
            }
        }

        // Validate structure
        if (node.parentId && !nodeIds.has(node.parentId)) {
            errors.push(`Node '${node.id}' has a non-existent parentId '${node.parentId}'.`);
        }
        if (node.children && Array.isArray(node.children)) {
            for (const childId of node.children) {
                if (!nodeIds.has(childId)) {
                    errors.push(`Node '${node.id}' lists non-existent child '${childId}'.`);
                }
            }
        }
    }

    if (graph.edges && Array.isArray(graph.edges)) {
        for (const edge of graph.edges) {
            if (!nodeIds.has(edge.source)) {
                errors.push(`Edge source '${edge.source}' does not exist.`);
            }
            if (!nodeIds.has(edge.target)) {
                errors.push(`Edge target '${edge.target}' does not exist.`);
            }
        }
    }

    return errors;
}

async function callGeminiWithRetry(systemPrompt: string, messages: any[], apiKey: string): Promise<any> {
    const url = `${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent`;
    let response: any;
    let retries = 5;
    let delay = 3000;

    while (retries > 0) {
        response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": apiKey,
            },
            body: JSON.stringify({
                system_instruction: {
                    parts: [{ text: systemPrompt }],
                },
                contents: messages,
                generationConfig: {
                    temperature: 0.1,
                    responseMimeType: "application/json",
                },
            }),
        });

        if (response.status === 503 || response.status === 429) {
            const reason = response.status === 503 ? "busy" : "rate limited";
            console.log(`[ArchitectureAgent] Gemini API ${reason} (${response.status}), retrying in ${delay}ms... (${retries - 1} left)`);
            await new Promise(r => setTimeout(r, delay));
            retries--;
            delay *= 2;
            continue;
        }
        break;
    }

    if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${errBody}`);
    }

    const data = await response.json();
    const outputJsonStr = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!outputJsonStr) throw new Error("Unable to parse Gemini output");

    return JSON.parse(outputJsonStr.replace(/^```json\n?/, "").replace(/\n?```$/, "").trim());
}

export async function generateArchitectureGraph(
    repoId: string,
    owner: string,
    repoName: string,
    githubToken?: string
): Promise<{ architecture: any; repository: any }> {
    try {
        const octokit = new Octokit({
            auth: githubToken || process.env.GITHUB_TOKEN,
        });

        // 1. Fetch Repository Metadata for default branch
        const { data: repoData } = await octokit.repos.get({ owner, repo: repoName });
        const defaultBranch = repoData.default_branch;

        // 2. Fetch Recursive Git Tree
        const { data: treeData } = await octokit.git.getTree({
            owner,
            repo: repoName,
            tree_sha: defaultBranch,
            recursive: "1",
        });

        const allPaths = (treeData.tree || [])
            .filter((item) => item.type === "blob" || item.type === "tree")
            .map((item) => item.path || "");

        // 3. Filter paths to prevent massive token usage
        // Let's keep files up to a certain depth and ignore common massive directories
        const filteredPaths = allPaths.filter(p => {
            const parts = p.split('/');
            if (parts.some(part => IGNORED_DIRS.has(part))) return false;
            // Limit files very deep down to prevent tokens explosion
            // Keep all root files, keep up to depth 3
            if (parts.length > 4) return false;
            return true;
        });

        // Take max 1000 items to fit in context window comfortably
        const finalPaths = filteredPaths.slice(0, 1000).join('\n');

        // 4. NEW: RAG Context Retrieval
        let ragContext = "";
        try {
            const retrieval = await retrieve(
                "Provide an overview of the high-level architecture, core components, and main entry points of this repository.",
                {
                    repoId,
                    topK: 12,
                    candidateMultiplier: 3
                }
            );

            if (retrieval.chunks.length > 0) {
                ragContext = retrieval.chunks
                    .map((c, i) => `[Context ${i + 1}] File: ${c.filePath}\nContent:\n${c.content}\n`)
                    .join("\n---\n");

                logger.info({ repoId, chunkCount: retrieval.chunks.length }, "Architecture agent successfully retrieved RAG context");
            }
        } catch (ragErr) {
            logger.warn({ ragErr, repoId }, "RAG retrieval failed for architecture agent, falling back to tree-only context");
        }

        // 5. Construct Gemini prompt
        const systemPrompt = `You are a Senior Software Architect analyzing raw repository directory structures and core code snippets.
Your objective is to generate an interactive JSON Architecture Graph data structure for the target repository.

You will be given:
1. Repository name: ${owner}/${repoName}
2. File tree snapshot (Truncated/Filtered if large).
3. Grounded Context: Key code snippets and architectural summaries retrieved from the repository using RAG.

Output EXACTLY a JSON object matching the following TypeScript interface 'ArchGraph'. Do not include markdown code block formatting like \`\`\`json, return just the raw JSON. 

interface ArchNode {
    id: string; // Make it unique and url-friendly e.g. "mod_auth", "cluster_ui"
    label: string; // Human readable name
    type: "cluster" | "module" | "entry" | "service" | "controller" | "component" | "model" | "api" | "database" | "config" | "infra" | "function";
    description: string; // 1-2 sentence description
    layer: "ui" | "api" | "service" | "domain" | "data" | "infra" | "config";
    importance: number; // 0.1 to 1.0
    complexity: number; // 0.1 to 1.0
    size: number;
    tags: string[];
    path?: string | null; // The ACTUAL repository path if this node represents a real file or directory.

    // Progressive disclosure fields
    parentId: string | null; // Id of parent ArchNode (depth 1 inside depth 0, depth 2 inside depth 1)
    children: string[];      // Ids of children ArchNodes
    isExpandable: boolean;   // true if it has children
    defaultExpanded: boolean; // normally false
    depth: number;           // 0 for high-level concepts, 1 for modules, 2 for files/functions
    childCount: number;
    visualHint: "folder-collapsed" | "folder-expanded" | "file-collapsed" | "file-expanded" | "leaf-node";
}

interface ArchEdge {
    source: string; // id of source Node
    target: string; // id of target Node
    relationship: "imports" | "calls" | "depends_on" | "exposes_api" | "reads_from" | "writes_to" | "handles_request" | "extends" | "implements" | "configures" | "triggers" | "subscribes_to" | "publishes_to" | "authenticates_via" | "caches";
    strength: number; // 0.1 to 1.0
    direction: "forward" | "bidirectional";
    visibleAtDepth: number; // normally same as highest depth node
}

interface ArchVisualization {
    initialView: string; // e.g. "clusters-only"
    cameraFocus: string; // an id of a depth 0 node
    layoutStyle: string; // e.g. "hierarchical-tree"
    expansionAnimation: string; // e.g. "zoom-and-unfold"
    collapseAnimation: string; // e.g. "fold-and-zoom-out"
    expansionDuration: number; // e.g. 400
    layoutEngine: string; // e.g. "force-directed-hierarchical"
}

interface ArchMetadata {
    totalNodes: number;
    visibleNodesAtStart: number;
    maxDepthAvailable: number;
    analysisConfidence: number; // 0.1 to 1.0
    warnings?: string[];
}

interface ArchGraph {
    repository: string;
    summary: string;
    architecturePattern: string; // e.g. "layered", "microservices", "monolith"
    systemType: string;
    complexityScore: number;
    progressiveStructure: {
        maxDepth: number;
        rootNodes: string[]; // ids of depth 0 nodes
        defaultViewDepth: number;
        expansionStrategy: string;
        recommendedStartNodes: string[];
    };
    nodes: ArchNode[];
    edges: ArchEdge[];
    visualization: ArchVisualization;
    tags: string[];
    metadata: ArchMetadata;
}

Guidelines for Generation:
1. Try to generate at least 3-6 depth 0 "clusters" based on primary app domains (e.g., Core, Routing, Database, Client UI).
2. For each cluster, make 2-5 depth 1 "modules".
3. For each module, pick some interesting depth 2 "files".
4. Make sure edges connect logical dependencies (e.g., UI depends on Service, Service depends on Database). Ensure you connect nodes of similar depths for visible AtDepth rules or depth 0 interconnectivity.
5. All IDs must be unique across the entire nodes array.
6. The graph should realistically match the provided file tree structure.
7. CRITICAL: Every node that represents a specific directory or file MUST include the 'path' property matching exactly its path in the provided file tree.
`;

        const userPrompt = `Generate the architecture graph for the repository ${owner}/${repoName}.
Here is its file tree:
${finalPaths}

${ragContext ? `Here are some core architectural code snippets and summaries retrieved from the repository (Grounded Context):
${ragContext}` : ""}
`;

        const geminiApiKey = process.env.GEMINI_API_KEY;
        if (!geminiApiKey) {
            logger.warn("Missing GEMINI_API_KEY, using fallback architecture graph");
            const fallback = buildFallbackArchitectureGraph(owner, repoName, filteredPaths);
            return { architecture: fallback, repository: buildRepoMindmap(owner, repoName, allPaths) };
        }

        const pathSet = new Set(allPaths);
        let messages = [{ role: "user", parts: [{ text: userPrompt }] }];
        let finalGraph: any = null;
        let iteration = 0;
        const MAX_ITERATIONS = 3;

        while (iteration < MAX_ITERATIONS) {
            iteration++;
            try {
                const graph = await callGeminiWithRetry(systemPrompt, messages, geminiApiKey);
                const validationErrors = validateArchitectureGraph(graph, pathSet);

                if (validationErrors.length === 0) {
                    finalGraph = graph;
                    console.log(`[ArchitectureAgent] Graph validated successfully on iteration ${iteration}.`);
                    break;
                }

                console.warn(`[ArchitectureAgent] Validation failed on iteration ${iteration} with ${validationErrors.length} errors. Retrying...`);
                
                messages.push({ role: "model", parts: [{ text: JSON.stringify(graph) }] });
                messages.push({
                    role: "user",
                    parts: [{
                        text: `The generated architecture graph has the following structural or factual errors (hallucinations):
${validationErrors.slice(0, 15).join("\n")}
${validationErrors.length > 15 ? "...and more." : ""}

Please fix these errors and provide the complete, corrected JSON architecture graph. Ensure all 'path' fields match existing repository paths and all parent/child IDs are consistent.`
                    }]
                });

                // On the last iteration, if it still fails, we might just have to take it or fallback
                finalGraph = graph; 
            } catch (err) {
                logger.error({ err, iteration }, "Error in architecture generation iteration");
                if (iteration === 1) throw err; // If first pass fails completely, bubble up
                break;
            }
        }

        return {
            architecture: finalGraph,
            repository: buildRepoMindmap(owner, repoName, allPaths)
        };
    } catch (error) {
        console.error("Gemini Generation Error:", error);
        logger.error({ error: error instanceof Error ? error.message : error }, "Error generating architecture graph, using fallback");
        try {
            const octokit = new Octokit({
                auth: githubToken || process.env.GITHUB_TOKEN,
            });
            const { data: repoData } = await octokit.repos.get({ owner, repo: repoName });
            const { data: treeData } = await octokit.git.getTree({
                owner,
                repo: repoName,
                tree_sha: repoData.default_branch,
                recursive: "1",
            });
            const allPaths = (treeData.tree || [])
                .filter((item) => item.type === "blob" || item.type === "tree")
                .map((item) => item.path || "");
            const filteredPaths = allPaths.filter((p) => {
                const parts = p.split('/');
                return !parts.some((part) => IGNORED_DIRS.has(part)) && parts.length <= 4;
            });
            return {
                architecture: buildFallbackArchitectureGraph(owner, repoName, filteredPaths, githubToken),
                repository: buildRepoMindmap(owner, repoName, allPaths)
            };
        } catch (fallbackError) {
            logger.error({ fallbackError }, "Fallback architecture generation failed");
            throw fallbackError;
        }
    }
}

/**
 * Builds a literal mindmap of the repository structure (folders/files).
 */
function buildRepoMindmap(owner: string, repoName: string, allPaths: string[]): any {
    const nodes: any[] = [];
    const edges: any[] = [];
    const nodeMap = new Map<string, any>();

    // 1. Root Node
    const rootId = "repo_root";
    const root = {
        id: rootId,
        label: repoName,
        type: "cluster",
        description: `Root directory of ${owner}/${repoName}`,
        layer: "infra",
        importance: 1.0,
        complexity: 0.5,
        size: 8,
        tags: ["root"],
        parentId: null,
        children: [],
        isExpandable: true,
        defaultExpanded: true,
        depth: 0,
        childCount: 0,
        visualHint: "folder-collapsed",
        path: ""
    };
    nodes.push(root);
    nodeMap.set("", rootId);

    // 2. Process all paths to build tree
    // We'll limit depth to 3 for the mindmap to keep it performant
    for (const path of allPaths) {
        const parts = path.split('/');
        if (parts.length > 4) continue; // Limit depth

        let currentPath = "";
        for (let i = 0; i < parts.length; i++) {
            const segment = parts[i];
            const parentPath = currentPath;
            currentPath = currentPath ? `${currentPath}/${segment}` : segment;

            if (nodeMap.has(currentPath)) continue;

            const isDir = i < parts.length - 1 || allPaths.some(p => p.startsWith(currentPath + '/'));
            const id = `repo_${currentPath.replace(/[^a-z0-9]/gi, '_')}`;
            const parentId = nodeMap.get(parentPath) || rootId;

            const node = {
                id,
                label: segment,
                type: isDir ? "cluster" : "module",
                description: `Path: ${currentPath}`,
                layer: inferLayer(segment),
                importance: 0.5 - (i * 0.1),
                complexity: 0.2,
                size: isDir ? 5 - i : 3,
                tags: [isDir ? "folder" : "file"],
                parentId: parentId,
                children: [],
                isExpandable: isDir,
                defaultExpanded: i === 0,
                depth: i + 1,
                childCount: 0,
                visualHint: isDir ? "folder-collapsed" : "leaf-node",
                path: currentPath
            };

            nodes.push(node);
            nodeMap.set(currentPath, id);

            // Link to parent
            const parentNode = nodes.find(n => n.id === parentId);
            if (parentNode) {
                parentNode.children.push(id);
                parentNode.childCount++;
                edges.push({
                    source: parentId,
                    target: id,
                    relationship: "depends_on",
                    strength: 0.5,
                    direction: "forward",
                    visibleAtDepth: i + 1
                });
            }
        }
    }

    return {
        repository: `${owner}/${repoName}`,
        summary: `Structural mindmap of ${owner}/${repoName}`,
        architecturePattern: "file-tree",
        systemType: "repository-structure",
        complexityScore: 5,
        progressiveStructure: {
            maxDepth: 4,
            rootNodes: [rootId],
            defaultViewDepth: 1,
            expansionStrategy: "hierarchical",
            recommendedStartNodes: [rootId]
        },
        nodes,
        edges,
        visualization: {
            initialView: "mindmap",
            cameraFocus: rootId,
            layoutStyle: "hierarchical-tree",
            expansionAnimation: "zoom-and-unfold",
            collapseAnimation: "fold-and-zoom-out",
            expansionDuration: 300,
            layoutEngine: "force-directed"
        },
        tags: ["structure", "mindmap"],
        metadata: {
            totalNodes: nodes.length,
            visibleNodesAtStart: 10,
            maxDepthAvailable: 4,
            analysisConfidence: 1.0
        }
    };
}
