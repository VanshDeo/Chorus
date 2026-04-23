"use client";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2, Rocket } from "lucide-react";

export default function OnboardingGuard({ children }: { children: React.ReactNode }) {
    const { isLoaded, isSignedIn, user } = useUser();
    const router = useRouter();
    const [status, setStatus] = useState<"loading" | "pass" | "new_user" | "redirect">("loading");

    useEffect(() => {
        if (!isLoaded) return;

        // Not signed in — let Clerk middleware handle auth
        if (!isSignedIn || !user) {
            setStatus("pass");
            return;
        }

        // Check Clerk user metadata for onboarding completion
        const onboardingComplete = user.unsafeMetadata?.onboardingComplete === true;
        if (onboardingComplete) {
            setStatus("pass");
        } else {
            // New user detected — show welcome message then redirect
            setStatus("new_user");
        }
    }, [isLoaded, isSignedIn, user]);

    // After showing "new user" message for 2.5s, redirect to onboarding
    useEffect(() => {
        if (status === "new_user") {
            const timer = setTimeout(() => {
                setStatus("redirect");
                router.replace("/onboarding");
            }, 2500);
            return () => clearTimeout(timer);
        }
    }, [status, router]);

    // Loading state
    if (status === "loading") {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#0A0A0A]">
                <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
            </div>
        );
    }

    // New user welcome screen
    if (status === "new_user") {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#0A0A0A] gap-5 animate-in fade-in duration-500">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-2xl shadow-orange-500/30">
                    <Rocket className="w-10 h-10 text-white" />
                </div>
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-white mb-2">
                        Welcome, {user?.firstName || user?.username || "Explorer"}! 👋
                    </h1>
                    <p className="text-slate-400 text-sm max-w-sm">
                        Looks like you&apos;re new here. Let&apos;s set up your profile so we can find the perfect open source projects for you.
                    </p>
                </div>
                <div className="flex items-center gap-2 mt-2">
                    <Loader2 className="w-4 h-4 text-orange-400 animate-spin" />
                    <span className="text-xs text-slate-500">Preparing your onboarding...</span>
                </div>
            </div>
        );
    }

    // Redirecting
    if (status === "redirect") {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#0A0A0A]">
                <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
            </div>
        );
    }

    return <>{children}</>;
}
