"use client";
import { useState } from "react";
import ArchVisualization from "@/components/visualization/ArchVisualization";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertCircle, Code, Play, Trash2, Beaker, Copy, Check } from "lucide-react";
import type { ArchGraph } from "@/types/ArchGraphTypes";

export default function ArchTestPage() {
    const [jsonInput, setJsonInput] = useState("");
    const [graph, setGraph] = useState<{ architecture: ArchGraph; repository: ArchGraph } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const handleRender = () => {
        if (!jsonInput.trim()) {
            setError("Please enter some JSON data first.");
            return;
        }
        try {
            const parsed = JSON.parse(jsonInput);
            
            // Check if it's the new dual-view structure
            if (parsed.architecture && parsed.repository) {
                setGraph(parsed);
            } else if (parsed.nodes && parsed.edges) {
                // Backward compatibility: use as both for testing
                setGraph({ architecture: parsed, repository: parsed });
            } else {
                throw new Error("Invalid format: Must be {architecture, repository} or {nodes, edges}.");
            }
            
            setError(null);
        } catch (err: any) {
            setError(err.message);
            setGraph(null);
        }
    };

    const handleClear = () => {
        setJsonInput("");
        setGraph(null);
        setError(null);
    };

    const handleCopySample = () => {
        // Just a hint for the user
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="flex flex-col gap-6 p-8 max-w-[1600px] mx-auto min-h-screen bg-[#050505]">
            <header className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-500/10 rounded-lg">
                        <Beaker className="w-5 h-5 text-orange-500" />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-white">Arch-Visualizer Laboratory</h1>
                </div>
                <p className="text-slate-400 max-w-2xl">
                    Test the frontend 3D rendering component in isolation. Run your backend test in the terminal, copy the result from <code className="text-orange-400 bg-orange-400/10 px-1 rounded text-xs">architecture_result.json</code>, and paste it here.
                </p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
                {/* Input Panel */}
                <Card className="lg:col-span-4 p-6 bg-[#0a0a0a] border-white/5 flex flex-col gap-4 h-[calc(100vh-220px)] sticky top-8">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
                            <Code className="w-4 h-4 text-orange-500" />
                            Input JSON
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={handleClear} className="text-slate-500 hover:text-white h-8">
                                <Trash2 className="w-3.5 h-3.5 mr-2" />
                                Clear
                            </Button>
                            <Button size="sm" onClick={handleRender} className="bg-orange-500 hover:bg-orange-600 text-white h-8 shadow-lg shadow-orange-500/20">
                                <Play className="w-3.5 h-3.5 mr-2" />
                                Render
                            </Button>
                        </div>
                    </div>

                    <div className="relative flex-1 group">
                        <textarea
                            value={jsonInput}
                            onChange={(e) => setJsonInput(e.target.value)}
                            placeholder='{ "repository": "owner/repo", "nodes": [...], "edges": [...] }'
                            className="w-full h-full bg-black/50 border border-white/10 rounded-xl p-4 text-[11px] font-mono text-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-500/30 focus:border-orange-500/30 resize-none transition-all placeholder:text-slate-700"
                        />
                    </div>

                    {error && (
                        <div className="flex items-start gap-3 p-3 bg-red-500/5 border border-red-500/20 rounded-xl text-xs text-red-400 animate-in fade-in zoom-in duration-200">
                            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                            <div className="flex flex-col gap-1">
                                <span className="font-bold">Parsing Error</span>
                                <span className="opacity-80">{error}</span>
                            </div>
                        </div>
                    )}
                </Card>

                {/* Preview Panel */}
                <div className="lg:col-span-8 flex flex-col gap-4">
                    {graph ? (
                        <div className="flex-1 min-h-[600px] animate-in fade-in slide-in-from-right-8 duration-700 ease-out">
                             <ArchVisualization data={graph as any} />
                        </div>
                    ) : (
                        <div className="flex-1 border border-dashed border-white/10 rounded-2xl bg-white/[0.01] flex flex-col items-center justify-center text-slate-600 gap-6 min-h-[600px]">
                            <div className="relative">
                                <div className="absolute inset-0 bg-orange-500/20 blur-3xl rounded-full" />
                                <Code className="w-16 h-16 opacity-20 relative z-10" />
                            </div>
                            <div className="flex flex-col items-center gap-2 text-center">
                                <h3 className="text-white font-medium">Ready for Simulation</h3>
                                <p className="text-sm text-slate-500 max-w-xs px-4">
                                    The 3D engine is on standby. Paste the architecture graph data on the left and click render to begin.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
