"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@clerk/nextjs";
import {
    X, Check, Loader2, Shield, Flame, Zap, Trophy, Bug, Code,
    FileText, TestTube, GraduationCap, Briefcase, Heart, Lightbulb,
    Sparkles,
} from "lucide-react";
import type { GitHubStats } from "@/lib/github";

const experienceLevels = [
    { id: "beginner", label: "Beginner", desc: "New to programming or open source", icon: Zap },
    { id: "intermediate", label: "Intermediate", desc: "Built projects, know Git", icon: Flame },
    { id: "advanced", label: "Advanced", desc: "Contribute to OSS regularly", icon: Shield },
    { id: "expert", label: "Expert", desc: "Maintain open source projects", icon: Trophy },
];

const contributionTypes = [
    { id: "bugfixes", label: "Bug Fixes", icon: Bug },
    { id: "features", label: "Features", icon: Code },
    { id: "docs", label: "Documentation", icon: FileText },
    { id: "testing", label: "Testing", icon: TestTube },
];

const goals = [
    { id: "learn", label: "Learn & Grow", icon: GraduationCap },
    { id: "portfolio", label: "Build Portfolio", icon: Briefcase },
    { id: "giveback", label: "Give Back", icon: Heart },
    { id: "career", label: "Get Hired", icon: Lightbulb },
];

// ── AI Analysis Engine ──────────────────────────────────────────────

interface AnalysisResult {
    level: string;
    score: number;
    reasoning: string[];
}

function analyzeGitHubProfile(stats: GitHubStats): AnalysisResult {
    let score = 0;
    const reasoning: string[] = [];

    // Contribution count
    const contribs = stats.contributions || 0;
    if (contribs >= 500) { score += 30; reasoning.push(`${contribs} contributions — very active`); }
    else if (contribs >= 200) { score += 20; reasoning.push(`${contribs} contributions — consistent`); }
    else if (contribs >= 50) { score += 10; reasoning.push(`${contribs} contributions — growing`); }
    else { score += 3; reasoning.push(`${contribs} contributions — getting started`); }

    // Repos
    const repos = stats.publicRepos || 0;
    if (repos >= 30) { score += 20; reasoning.push(`${repos} public repos — prolific builder`); }
    else if (repos >= 10) { score += 12; reasoning.push(`${repos} public repos — active builder`); }
    else if (repos >= 3) { score += 5; reasoning.push(`${repos} public repos — building foundation`); }
    else { score += 2; reasoning.push(`${repos} public repos`); }

    // Stars
    const stars = stats.totalStars || 0;
    if (stars >= 50) { score += 20; reasoning.push(`${stars} stars earned — community recognition`); }
    else if (stars >= 10) { score += 10; reasoning.push(`${stars} stars — noticed by others`); }
    else if (stars >= 1) { score += 4; reasoning.push(`${stars} star${stars > 1 ? "s" : ""} earned`); }

    // PRs
    const prs = stats.prsMerged || 0;
    if (prs >= 20) { score += 15; reasoning.push(`${prs} PRs merged — experienced contributor`); }
    else if (prs >= 5) { score += 8; reasoning.push(`${prs} PRs merged — active collaborator`); }
    else if (prs >= 1) { score += 3; reasoning.push(`${prs} PR${prs > 1 ? "s" : ""} merged`); }

    // Language diversity
    const langCount = Object.keys(stats.languages || {}).length;
    if (langCount >= 5) { score += 10; reasoning.push(`${langCount} languages — polyglot developer`); }
    else if (langCount >= 3) { score += 5; reasoning.push(`${langCount} languages used`); }

    // Account age
    if (stats.createdAt) {
        const years = (Date.now() - new Date(stats.createdAt).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
        if (years >= 5) { score += 10; reasoning.push(`${Math.floor(years)}yr GitHub veteran`); }
        else if (years >= 2) { score += 5; reasoning.push(`${Math.floor(years)}yr on GitHub`); }
    }

    // Map score to level
    let level: string;
    if (score >= 70) level = "expert";
    else if (score >= 45) level = "advanced";
    else if (score >= 20) level = "intermediate";
    else level = "beginner";

    return { level, score: Math.min(score, 100), reasoning };
}

// ── Component ───────────────────────────────────────────────────────

interface Props {
    open: boolean;
    onClose: () => void;
    ghStats?: GitHubStats | null;
}

export default function EditProfileModal({ open, onClose, ghStats }: Props) {
    const { user } = useUser();
    const [saving, setSaving] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

    const prefs = (user?.unsafeMetadata?.preferences as any) || {};
    const [experience, setExperience] = useState<string>(prefs.experience || "");
    const [contributions, setContributions] = useState<string[]>(prefs.contributions || []);
    const [goal, setGoal] = useState<string>(prefs.goal || "");

    useEffect(() => {
        if (open) {
            const p = (user?.unsafeMetadata?.preferences as any) || {};
            setExperience(p.experience || "");
            setContributions(p.contributions || []);
            setGoal(p.goal || "");
            setAnalysis(null);
        }
    }, [open, user]);

    const toggleContrib = (id: string) => {
        setContributions((prev) =>
            prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
        );
    };

    const runAnalysis = async () => {
        if (!ghStats) return;
        setAnalyzing(true);
        // Simulate brief analysis delay for polish
        await new Promise((r) => setTimeout(r, 1200));
        const result = analyzeGitHubProfile(ghStats);
        setAnalysis(result);
        setExperience(result.level);
        setAnalyzing(false);
    };

    const handleSave = async () => {
        if (!user) return;
        setSaving(true);
        try {
            await user.update({
                unsafeMetadata: {
                    ...user.unsafeMetadata,
                    preferences: {
                        ...(user.unsafeMetadata?.preferences as any),
                        experience,
                        contributions,
                        goal,
                    },
                },
            });
            onClose();
        } catch (err) {
            console.error("Failed to save:", err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <AnimatePresence>
            {open && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                        onClick={onClose}
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
                    >
                        <div className="w-full max-w-lg rounded-2xl border border-white/[0.08] bg-[#0c0c0e]/95 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.5)] pointer-events-auto overflow-hidden">
                            {/* Header */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
                                <h2 className="text-base font-semibold text-white">Edit Preferences</h2>
                                <button
                                    onClick={onClose}
                                    className="w-7 h-7 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] flex items-center justify-center text-white/40 hover:text-white transition"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="px-6 py-5 space-y-6 max-h-[60vh] overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.1) transparent" }}>
                                {/* Experience */}
                                <div>
                                    <div className="flex items-center justify-between mb-2.5">
                                        <label className="text-[10px] uppercase font-bold text-white/25 tracking-wider">
                                            Experience Level
                                        </label>
                                        {ghStats && (
                                            <button
                                                onClick={runAnalysis}
                                                disabled={analyzing}
                                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-gradient-to-r from-purple-500/15 to-blue-500/15 text-purple-300 border border-purple-500/20 hover:border-purple-500/40 hover:from-purple-500/20 hover:to-blue-500/20 transition-all disabled:opacity-50"
                                            >
                                                {analyzing ? (
                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                ) : (
                                                    <Sparkles className="w-3 h-3" />
                                                )}
                                                {analyzing ? "Analyzing..." : "AI Analyze"}
                                            </button>
                                        )}
                                    </div>

                                    {/* AI Result */}
                                    <AnimatePresence>
                                        {analysis && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: "auto" }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="mb-3 overflow-hidden"
                                            >
                                                <div className="p-3 rounded-xl bg-gradient-to-r from-purple-500/[0.08] to-blue-500/[0.08] border border-purple-500/15">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                                                        <span className="text-[11px] font-semibold text-purple-300">
                                                            AI suggests: {experienceLevels.find((l) => l.id === analysis.level)?.label}
                                                        </span>
                                                        <span className="ml-auto text-[10px] text-white/20 font-mono">{analysis.score}/100</span>
                                                    </div>
                                                    <div className="space-y-0.5">
                                                        {analysis.reasoning.map((r, i) => (
                                                            <div key={i} className="text-[10px] text-white/30 flex items-start gap-1.5">
                                                                <span className="text-purple-400/60 mt-px">›</span> {r}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    <div className="grid grid-cols-2 gap-2">
                                        {experienceLevels.map((lvl) => {
                                            const Icon = lvl.icon;
                                            const active = experience === lvl.id;
                                            const aiSuggested = analysis?.level === lvl.id;
                                            return (
                                                <button
                                                    key={lvl.id}
                                                    onClick={() => setExperience(lvl.id)}
                                                    className={`relative flex items-center gap-2.5 p-3 rounded-xl border transition-all duration-150 text-left ${
                                                        active
                                                            ? "bg-orange-500/10 border-orange-500/25 text-white"
                                                            : "bg-white/[0.03] border-white/[0.06] text-white/50 hover:bg-white/[0.06] hover:text-white/70"
                                                    }`}
                                                >
                                                    <Icon className={`w-4 h-4 shrink-0 ${active ? "text-orange-400" : "text-white/25"}`} />
                                                    <div>
                                                        <div className="text-xs font-semibold">{lvl.label}</div>
                                                        <div className="text-[10px] text-white/25 mt-0.5">{lvl.desc}</div>
                                                    </div>
                                                    {aiSuggested && !active && (
                                                        <Sparkles className="w-3 h-3 text-purple-400 absolute top-2 right-2" />
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Contribution Types */}
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-white/25 tracking-wider block mb-2.5">
                                        Contribution Style
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {contributionTypes.map((ct) => {
                                            const Icon = ct.icon;
                                            const active = contributions.includes(ct.id);
                                            return (
                                                <button
                                                    key={ct.id}
                                                    onClick={() => toggleContrib(ct.id)}
                                                    className={`flex items-center gap-2.5 p-3 rounded-xl border transition-all duration-150 text-left ${
                                                        active
                                                            ? "bg-orange-500/10 border-orange-500/25 text-white"
                                                            : "bg-white/[0.03] border-white/[0.06] text-white/50 hover:bg-white/[0.06] hover:text-white/70"
                                                    }`}
                                                >
                                                    <Icon className={`w-4 h-4 shrink-0 ${active ? "text-orange-400" : "text-white/25"}`} />
                                                    <span className="text-xs font-semibold">{ct.label}</span>
                                                    {active && <Check className="w-3 h-3 text-orange-400 ml-auto" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Goal */}
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-white/25 tracking-wider block mb-2.5">
                                        Primary Goal
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {goals.map((g) => {
                                            const Icon = g.icon;
                                            const active = goal === g.id;
                                            return (
                                                <button
                                                    key={g.id}
                                                    onClick={() => setGoal(g.id)}
                                                    className={`flex items-center gap-2.5 p-3 rounded-xl border transition-all duration-150 text-left ${
                                                        active
                                                            ? "bg-orange-500/10 border-orange-500/25 text-white"
                                                            : "bg-white/[0.03] border-white/[0.06] text-white/50 hover:bg-white/[0.06] hover:text-white/70"
                                                    }`}
                                                >
                                                    <Icon className={`w-4 h-4 shrink-0 ${active ? "text-orange-400" : "text-white/25"}`} />
                                                    <span className="text-xs font-semibold">{g.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-white/[0.06]">
                                <button
                                    onClick={onClose}
                                    className="px-4 py-2 rounded-xl text-xs font-semibold text-white/50 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="px-4 py-2 rounded-xl text-xs font-semibold text-black bg-gradient-to-r from-orange-500 to-amber-500 hover:brightness-110 transition disabled:opacity-50 flex items-center gap-1.5"
                                >
                                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
