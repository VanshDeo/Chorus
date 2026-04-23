import Sidebar from "@/components/layout/Sidebar";
import TopNavbar from "@/components/layout/TopNavbar";
import OnboardingGuard from "@/components/auth/OnboardingGuard";

export default function AppLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <OnboardingGuard>
            <div className="flex h-screen overflow-hidden">
                {/* Left Sidebar */}
                <Sidebar />

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col relative overflow-hidden">
                    <TopNavbar />
                    <main className="flex-1 overflow-y-auto w-full">{children}</main>
                </div>
            </div>
        </OnboardingGuard>
    );
}
