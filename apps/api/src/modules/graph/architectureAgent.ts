import { Octokit } from "@octokit/rest";
import { logger } from "../../observability/logger";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_MODEL = "gemini-2.5-flash";

export async function generateArchitectureGraph(
    owner: string,
    repoName: string,
    githubToken?: string
): Promise<any> {
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
        const IGNORED_DIRS = new Set(["node_modules", "vendor", "dist", "build", ".next", "coverage", ".git"]);
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

        // 4. Construct Gemini prompt
        const systemPrompt = `You are a Senior Software Architect analyzing raw repository directory structures.
Your objective is to generate an interactive JSON Architecture Graph data structure for the target repository.

You will be given:
1. Repository name: ${owner}/${repoName}
2. File tree snapshot (Truncated/Filtered if large).

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
`;

        const userPrompt = `Generate the architecture graph for the repository ${owner}/${repoName}.
Here is its file tree:
${finalPaths}
`;

        const geminiApiKey = process.env.GEMINI_API_KEY;
        if (!geminiApiKey) {
            throw new Error("Missing GEMINI_API_KEY");
        }

        const url = `${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent`;

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": geminiApiKey,
            },
            body: JSON.stringify({
                system_instruction: {
                    parts: [{ text: systemPrompt }],
                },
                contents: [
                    {
                        role: "user",
                        parts: [{ text: userPrompt }],
                    },
                ],
                generationConfig: {
                    temperature: 0.1,
                    responseMimeType: "application/json",
                },
            }),
        });

        if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`Gemini API error: ${response.status} - ${errBody}`);
        }

        const data = (await response.json()) as any;
        const outputJsonStr = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!outputJsonStr) {
            throw new Error("Unable to parse Gemini output");
        }

        let parsedData;
        try {
            parsedData = JSON.parse(outputJsonStr);
        } catch (e) {
            console.error("Gemini invalid JSON payload", outputJsonStr);
            throw new Error("Generated content was not valid JSON");
        }

        return parsedData;
    } catch (error) {
        logger.error({ error }, "Error generating architecture graph");
        throw error;
    }
}
