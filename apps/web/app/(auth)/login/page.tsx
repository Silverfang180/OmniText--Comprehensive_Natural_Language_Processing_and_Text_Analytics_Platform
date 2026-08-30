"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, Mail, AlertCircle, ArrowRight, Sparkles } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { Logo } from "@/components/nlp/Logo";

export default function LoginPage() {
  const router = useRouter();
  const [isRegister, setIsRegister] = useState<boolean>(false);
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("expired") === "true") {
        setError("Your session has expired. Please sign in again.");
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Please fill out all fields.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (isRegister) {
        // Register API call
        const response = await apiClient<any>("/api/v1/auth/register", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });

        if (response.error) {
          setError(response.error.message);
        } else {
          setSuccess("Account created successfully! You can now log in.");
          setIsRegister(false);
          setPassword("");
        }
      } else {
        // Login/Token API call (using urlencoded form data per standard OAuth2)
        const params = new URLSearchParams();
        params.append("username", email);
        params.append("password", password);

        const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const response = await fetch(`${API_BASE_URL}/api/v1/auth/token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params.toString(),
        });

        const data = await response.json();
        if (!response.ok) {
          setError(data.detail || "Authentication failed. Incorrect email or password.");
        } else {
          localStorage.setItem("omnitext_token", data.access_token);
          localStorage.setItem("omnitext_email", email);
          
          // Force a page reload or router redirect to dashboard
          router.push("/");
          setTimeout(() => {
            window.location.reload();
          }, 300);
        }
      }
    } catch (err: any) {
      setError(err.message || "An unexpected security exception occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-16 max-w-md mx-auto w-full">
      <div className="w-full space-y-8 bg-surface border border-border-default rounded-xl p-8 shadow-sm">
        
        {/* Brand Header */}
        <div className="text-center space-y-2 flex flex-col items-center">
          <div className="inline-flex p-1 bg-muted/30 text-text-primary rounded-lg mb-2">
            <Logo size={44} className="text-text-primary" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-text-primary">
            {isRegister ? "Create developer account" : "Sign in to workspace"}
          </h2>
          <p className="text-xs text-text-secondary">
            {isRegister 
              ? "Access full pipeline history and personal developer API keys."
              : "Welcome back. Enter credentials to load your workspace."
            }
          </p>
        </div>

        {/* Notifications */}
        {error && (
          <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg flex items-start gap-2.5 text-xs text-danger">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="p-3 bg-success/10 border border-success/20 rounded-lg text-xs text-success">
            {success}
          </div>
        )}

        {/* Auth Form */}
        <form className="space-y-4" onSubmit={handleSubmit}>
          {/* Email Input */}
          <div className="space-y-1">
            <label htmlFor="email" className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-text-secondary" />
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="developer@omnitext.ai"
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-surface-raised border border-border-default text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary transition-colors"
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="space-y-1">
            <label htmlFor="password" className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-text-secondary" />
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-surface-raised border border-border-default text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary transition-colors"
              />
            </div>
            {isRegister && (
              <p className="text-[10px] text-text-secondary">Must be at least 8 characters long.</p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent-primary hover:bg-accent-hover text-white text-sm font-semibold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 mt-6"
          >
            {loading ? "Please wait..." : isRegister ? "Register Account" : "Access Workspace"}
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        {/* Toggle Mode */}
        <div className="text-center pt-2">
          <button
            onClick={() => {
              setIsRegister(!isRegister);
              setError(null);
              setSuccess(null);
            }}
            className="text-xs text-accent-primary hover:text-accent-hover font-medium transition-colors"
          >
            {isRegister 
              ? "Already have an account? Sign in instead" 
              : "Don't have an account yet? Register one now"
            }
          </button>
        </div>

      </div>
    </main>
  );
}
