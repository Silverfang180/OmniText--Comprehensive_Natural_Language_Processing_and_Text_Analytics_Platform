"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Settings, LogOut, HelpCircle, ArrowRight } from "lucide-react";
import { Logo } from "./Logo";

export const NavBar: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const storedToken = localStorage.getItem("omnitext_token");
    const storedEmail = localStorage.getItem("omnitext_email");
    setToken(storedToken);
    setUserEmail(storedEmail);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("omnitext_token");
    localStorage.removeItem("omnitext_email");
    router.push("/login");
    setTimeout(() => {
      window.location.reload();
    }, 200);
  };

  const linkClass = (path: string) => {
    const isActive = pathname === path;
    return `text-xs font-semibold transition-colors py-1 ${
      isActive 
        ? "text-accent-primary border-b border-accent-primary" 
        : "text-text-secondary hover:text-text-primary"
    }`;
  };

  return (
    <header className="w-full bg-surface border-b border-border-default/60 py-3.5 px-4 sm:px-6 lg:px-8 mb-6">
      <div className="max-w-dashboard mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Brand Logo & Name */}
        <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
          <Logo size={28} className="text-text-primary" />
          <span className="font-serif font-semibold text-base text-text-primary tracking-tight">OmniText</span>
        </Link>

        {/* Navigation Groups */}
        {token ? (
          <div className="flex flex-wrap items-center justify-center gap-6">
            {/* Analyze Group */}
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline text-[9px] text-text-secondary uppercase font-bold tracking-wider">Analyze:</span>
              <Link href="/" className={linkClass("/")}>Quick</Link>
              <Link href="/search" className={linkClass("/search")}>Doc Intel</Link>
              <Link href="/analyze" className={linkClass("/analyze")}>History</Link>
            </div>

            {/* Divider */}
            <span className="hidden md:inline w-px h-3 bg-border-default/80" />

            {/* Documents Group */}
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline text-[9px] text-text-secondary uppercase font-bold tracking-wider">Docs:</span>
              <Link href="/documents" className={linkClass("/documents")}>Datasets</Link>
            </div>

            {/* Divider */}
            <span className="hidden md:inline w-px h-3 bg-border-default/80" />

            {/* Technical Group */}
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline text-[9px] text-text-secondary uppercase font-bold tracking-wider">Technical:</span>
              <Link href="/benchmarks" className={linkClass("/benchmarks")}>Benchmarks</Link>
              <Link href="/experiments" className={linkClass("/experiments")}>Experiments</Link>
            </div>

            {/* Settings & Logout */}
            <div className="flex items-center gap-3 pl-2 border-l border-border-default/60">
              <Link href="/settings" className={`p-1.5 rounded-lg transition-colors ${pathname === "/settings" ? "text-accent-primary" : "text-text-secondary hover:text-text-primary"}`} title="Settings">
                <Settings className="w-4 h-4" />
              </Link>
              <button onClick={handleLogout} className="p-1.5 rounded-lg text-text-secondary hover:text-danger transition-colors cursor-pointer" title="Sign Out">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4 text-xs">
            <Link href="/login" className="px-3.5 py-1.5 bg-accent-primary/10 hover:bg-accent-primary/20 text-accent-primary rounded-lg font-semibold flex items-center gap-1 transition-all">
              Sign In <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        )}
      </div>
    </header>
  );
};
