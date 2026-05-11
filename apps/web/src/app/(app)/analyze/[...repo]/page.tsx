"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

export default function AnalyzeRepoPage() {
    const router = useRouter();
    const pathname = usePathname();
    const originalPath = pathname?.replace("/analyze/", "");
    
    useEffect(() => {
        if (originalPath) {
            router.replace(`/analyze?repo=${encodeURIComponent(originalPath)}`);
        }
    }, [router, originalPath]);

    return (
        <div className="flex h-screen items-center justify-center bg-[#050505]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
        </div>
    );
}
