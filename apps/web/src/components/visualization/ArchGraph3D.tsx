"use client";
import { useRef, useMemo, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text, Billboard, Line, Grid } from "@react-three/drei";
import * as THREE from "three";
import type { ArchNode, ArchGraph } from "@/types/ArchGraphTypes";
import { LAYER_COLORS, DEPTH_SCALE } from "@/types/ArchGraphTypes";

// ─── Layout: clusters in ring, children orbit around parent ───
function computePositions(
    visibleNodes: ArchNode[],
    allNodes: ArchNode[],
    expandedNodes: Set<string>
): Map<string, [number, number, number]> {
    const positions = new Map<string, [number, number, number]>();
    const nodeMap = new Map<string, ArchNode>();
    for (const n of allNodes) nodeMap.set(n.id, n);

    // Depth 0: arrange in a circle
    const rootNodes = visibleNodes.filter((n) => n.depth === 0);
    rootNodes.forEach((node, i) => {
        const angle = (i / rootNodes.length) * Math.PI * 2 - Math.PI / 2;
        const radius = 6;
        positions.set(node.id, [
            Math.cos(angle) * radius,
            0,
            Math.sin(angle) * radius,
        ]);
    });

    // Deeper nodes: orbit around parent
    const deeper = visibleNodes.filter((n) => n.depth > 0);
    deeper.sort((a, b) => a.depth - b.depth);

    for (const node of deeper) {
        const parentPos = node.parentId ? positions.get(node.parentId) : null;
        if (!parentPos) continue;

        const parent = node.parentId ? nodeMap.get(node.parentId) : null;
        const siblings = parent
            ? parent.children.filter((cid) => visibleNodes.some((vn) => vn.id === cid))
            : [];
        const idx = siblings.indexOf(node.id);
        const count = siblings.length;

        const childRadius = 4.0 / (node.depth * 0.5 + 1); // Increased radius for better spread
        const angleOffset = parent
            ? Math.atan2(parentPos[2], parentPos[0])
            : 0;
        const spread = Math.min(Math.PI * 1.8, (Math.PI * 2.5) / Math.max(2, count)); // Wider spread
        const startAngle = angleOffset - (spread * (count - 1)) / 2;
        const angle = startAngle + idx * spread;

        positions.set(node.id, [
            parentPos[0] + Math.cos(angle) * childRadius,
            parentPos[1] - (0.8 + Math.random() * 0.4), // Jitter Y slightly to prevent perfect stacking
            parentPos[2] + Math.sin(angle) * childRadius,
        ]);
    }

    return positions;
}

// ─── Animated Node ───
function GraphNode({
    node,
    position,
    isSelected,
    isHovered,
    isExpanded,
    onSelect,
    onHover,
    onUnhover,
}: {
    node: ArchNode;
    position: [number, number, number];
    isSelected: boolean;
    isHovered: boolean;
    isExpanded: boolean;
    onSelect: (id: string) => void;
    onHover: (id: string) => void;
    onUnhover: () => void;
}) {
    const groupRef = useRef<THREE.Group>(null!);
    const meshRef = useRef<THREE.Mesh>(null!);
    const glowRef = useRef<THREE.Mesh>(null!);
    const targetPos = useRef(new THREE.Vector3(...position));
    const color = LAYER_COLORS[node.layer] || "#888888";
    const scale = DEPTH_SCALE[node.depth] ?? 0.5;
    const baseRadius = (0.35 + node.size * 0.05) * scale; // Slightly larger nodes
    const active = isSelected || isHovered;

    // Update target when position changes
    targetPos.current.set(...position);

    useFrame((_, delta) => {
        // Smooth position interpolation
        if (groupRef.current) {
            groupRef.current.position.lerp(targetPos.current, delta * 5);
        }
        // Rotate main mesh
        if (meshRef.current) {
            meshRef.current.rotation.y += delta * (node.depth === 0 ? 0.15 : 0.3);
            if (active) {
                meshRef.current.rotation.x += delta * 0.5;
            }
        }
        // Glow scale
        if (glowRef.current) {
            const s = active ? 1 : 0;
            glowRef.current.scale.x += (s - glowRef.current.scale.x) * delta * 6;
            glowRef.current.scale.y += (s - glowRef.current.scale.y) * delta * 6;
            glowRef.current.scale.z += (s - glowRef.current.scale.z) * delta * 6;
        }
    });

    return (
        <group ref={groupRef} position={position}>
            {/* Glow */}
            <mesh ref={glowRef} scale={[0, 0, 0]}>
                <sphereGeometry args={[baseRadius * 2.8, 16, 16]} />
                <meshBasicMaterial color={color} transparent opacity={0.1} depthWrite={false} />
            </mesh>

            {/* Main shape */}
            <mesh
                ref={meshRef}
                onClick={(e) => { e.stopPropagation(); onSelect(node.id); }}
                onPointerOver={(e) => { e.stopPropagation(); onHover(node.id); document.body.style.cursor = "pointer"; }}
                onPointerOut={() => { onUnhover(); document.body.style.cursor = "default"; }}
            >
                {node.type === "cluster" ? (
                    <dodecahedronGeometry args={[baseRadius, 0]} />
                ) : node.depth <= 1 ? (
                    <icosahedronGeometry args={[baseRadius, 1]} />
                ) : (
                    <sphereGeometry args={[baseRadius, 16, 16]} />
                )}
                <meshStandardMaterial
                    color={color}
                    emissive={color}
                    emissiveIntensity={active ? 1.2 : isExpanded ? 0.6 : 0.3}
                    roughness={0.2}
                    metalness={0.6}
                    transparent
                    opacity={active ? 1 : 0.9}
                />
            </mesh>

            {/* Selection ring */}
            {isSelected && (
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[baseRadius * 1.8, baseRadius * 2.0, 32]} />
                    <meshBasicMaterial color="#ffffff" transparent opacity={0.5} side={THREE.DoubleSide} />
                </mesh>
            )}

            {/* Expand indicator for expandable nodes */}
            {node.isExpandable && !isExpanded && (
                <mesh position={[baseRadius + 0.15, -baseRadius - 0.15, 0]}>
                    <sphereGeometry args={[0.08, 16, 16]} />
                    <meshBasicMaterial color="#f97316" />
                </mesh>
            )}

            {/* Label with improved legibility */}
            <Billboard follow lockX={false} lockY={false} lockZ={false}>
                {/* Subtle dark backing for label */}
                <mesh position={[0, baseRadius + 0.28, -0.01]}>
                   <planeGeometry args={[node.label.length * 0.12 + 0.4, 0.4]} />
                   <meshBasicMaterial color="#000000" transparent opacity={0.5} depthWrite={false} />
                </mesh>
                <Text
                    position={[0, baseRadius + 0.28, 0]}
                    fontSize={0.24 * (scale + 0.3)}
                    color={active ? "#ffffff" : "#cbd5e1"}
                    anchorX="center"
                    anchorY="bottom"
                    maxWidth={4}
                    font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfMZhrib2Bg-4.woff"
                >
                    {node.label}
                </Text>
                {/* Child count badge */}
                {node.isExpandable && node.childCount > 0 && (
                    <Text
                        position={[0, -(baseRadius + 0.2), 0]}
                        fontSize={0.16}
                        color={isExpanded ? "#f97316" : "#94a3b8"}
                        anchorX="center"
                        anchorY="top"
                        fontWeight="bold"
                    >
                        {isExpanded ? "▼" : "▶"} {node.childCount}
                    </Text>
                )}
            </Billboard>
        </group>
    );
}

// ─── Edge using drei Line ───
function GraphEdge({
    from,
    to,
    strength,
    color,
}: {
    from: [number, number, number];
    to: [number, number, number];
    strength: number;
    color: string;
}) {
    const points = useMemo(() => {
        const start = new THREE.Vector3(...from);
        let end = new THREE.Vector3(...to);

        // Prevent 0-length edges which cause NaN tangents in Line2 and crash WebGL
        if (start.distanceTo(end) < 0.001) {
            end.add(new THREE.Vector3(0.01, 0.01, 0.01));
        }

        const mid = start.clone().lerp(end, 0.5);
        mid.y += start.distanceTo(end) * 0.12;
        return new THREE.QuadraticBezierCurve3(start, mid, end).getPoints(20);
    }, [from, to]);

    return (
        <Line
            points={points}
            color={color}
            transparent
            opacity={strength * 0.4}
            lineWidth={1.5}
        />
    );
}

// ─── Orbit ring (decorative) ───
function OrbitRing({ radius, opacity = 0.05 }: { radius: number; opacity?: number }) {
    const points = useMemo(() => {
        const pts: THREE.Vector3[] = [];
        for (let i = 0; i <= 64; i++) {
            const angle = (i / 64) * Math.PI * 2;
            pts.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
        }
        return pts;
    }, [radius]);

    return <Line points={points} color="#ffffff" transparent opacity={opacity} lineWidth={1} />;
}

// ─── Particles ───
function Particles({ count = 40 }: { count?: number }) {
    const ref = useRef<THREE.Points>(null!);
    const geometry = useMemo(() => {
        const arr = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            arr[i * 3] = (Math.random() - 0.5) * 30;
            arr[i * 3 + 1] = (Math.random() - 0.5) * 12;
            arr[i * 3 + 2] = (Math.random() - 0.5) * 30;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(arr, 3));
        return geo;
    }, [count]);

    useFrame((_, delta) => {
        if (ref.current) ref.current.rotation.y += delta * 0.008;
    });

    return (
        <points ref={ref} geometry={geometry}>
            <pointsMaterial color="#f97316" size={0.035} transparent opacity={0.25} sizeAttenuation />
        </points>
    );
}

// ─── Background ───
function Background() {
    const { scene } = useThree();
    useMemo(() => { scene.background = new THREE.Color("#0a0a0a"); }, [scene]);
    return null;
}

// ─── Scene ───
function Scene({
    graph,
    visibleNodes,
    visibleEdges,
    expandedNodes,
    selectedId,
    hoveredId,
    onSelect,
    onHover,
    onUnhover,
    autoRotate,
}: {
    graph: ArchGraph;
    visibleNodes: ArchNode[];
    visibleEdges: typeof graph.edges;
    expandedNodes: Set<string>;
    selectedId: string | null;
    hoveredId: string | null;
    onSelect: (id: string) => void;
    onHover: (id: string) => void;
    onUnhover: () => void;
    autoRotate: boolean;
}) {
    const positions = useMemo(
        () => computePositions(visibleNodes, graph.nodes, expandedNodes),
        [visibleNodes, graph.nodes, expandedNodes]
    );

    const nodeMap = useMemo(() => {
        const m = new Map<string, ArchNode>();
        for (const n of graph.nodes) m.set(n.id, n);
        return m;
    }, [graph.nodes]);

    return (
        <>
            <Background />
            <ambientLight intensity={0.2} />
            <pointLight position={[15, 20, 15]} intensity={1.5} color="#ffffff" castShadow />
            <pointLight position={[-15, -10, -15]} intensity={0.5} color="#3b82f6" />
            <spotLight position={[0, 20, 0]} intensity={1} angle={0.6} penumbra={1} color="#f97316" />

            <OrbitRing radius={6} opacity={0.04} />
            <OrbitRing radius={12} opacity={0.02} />

            <Particles count={100} />
            
            {/* Grid Floor */}
            <Grid
                position={[0, -10, 0]}
                args={[100, 100]}
                cellSize={1}
                cellThickness={0.5}
                cellColor="#1e293b"
                sectionSize={5}
                sectionThickness={1}
                sectionColor="#334155"
                fadeDistance={50}
                fadeStrength={1}
                infiniteGrid
            />

            {/* Edges */}
            {visibleEdges.map((edge, i) => {
                const from = positions.get(edge.source);
                const to = positions.get(edge.target);
                if (!from || !to) return null;
                const srcNode = nodeMap.get(edge.source);
                const c = srcNode ? (LAYER_COLORS[srcNode.layer] || "#888") : "#888";
                return <GraphEdge key={`e-${i}`} from={from} to={to} strength={edge.strength} color={c} />;
            })}

            {/* Nodes */}
            {visibleNodes.map((node) => {
                const pos = positions.get(node.id);
                if (!pos) return null;
                return (
                    <GraphNode
                        key={node.id}
                        node={node}
                        position={pos}
                        isSelected={selectedId === node.id}
                        isHovered={hoveredId === node.id}
                        isExpanded={expandedNodes.has(node.id)}
                        onSelect={onSelect}
                        onHover={onHover}
                        onUnhover={onUnhover}
                    />
                );
            })}

            <OrbitControls
                enablePan
                enableZoom
                enableRotate
                autoRotate={autoRotate}
                autoRotateSpeed={0.15}
                maxDistance={40}
                minDistance={2}
                makeDefault
            />
        </>
    );
}

// ─── Exported component ───
export default function ArchGraph3D({
    graph,
    visibleNodes,
    visibleEdges,
    expandedNodes,
    selectedId,
    hoveredId,
    onSelectNode,
    onHoverNode,
    onUnhoverNode,
    autoRotate,
}: {
    graph: ArchGraph;
    visibleNodes: ArchNode[];
    visibleEdges: typeof graph.edges;
    expandedNodes: Set<string>;
    selectedId: string | null;
    hoveredId: string | null;
    onSelectNode: (id: string) => void;
    onHoverNode: (id: string) => void;
    onUnhoverNode: () => void;
    autoRotate: boolean;
}) {
    return (
        <div style={{ width: "100%", height: "100%", background: "#0a0a0a" }}>
            <Canvas
                camera={{ position: [10, 6, 10], fov: 50 }}
                gl={{
                    antialias: true,
                    alpha: false,
                    powerPreference: "default",
                    failIfMajorPerformanceCaveat: false,
                }}
                onCreated={({ gl }) => {
                    gl.setClearColor("#0a0a0a");
                    const canvas = gl.domElement;
                    canvas.addEventListener("webglcontextlost", (e) => {
                        e.preventDefault();
                    });
                }}
            >
                <Suspense fallback={null}>
                    <Scene
                        graph={graph}
                        visibleNodes={visibleNodes}
                        visibleEdges={visibleEdges}
                        expandedNodes={expandedNodes}
                        selectedId={selectedId}
                        hoveredId={hoveredId}
                        onSelect={onSelectNode}
                        onHover={onHoverNode}
                        onUnhover={onUnhoverNode}
                        autoRotate={autoRotate}
                    />
                </Suspense>
            </Canvas>
        </div>
    );
}
