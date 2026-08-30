"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Key, 
  Plus, 
  Trash2, 
  AlertTriangle, 
  Copy, 
  Check, 
  Clock, 
  ChevronRight,
  ShieldCheck,
  User,
  ArrowLeft,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface APIKey {
  id: number;
  name: string;
  prefix: string;
  created_at: string;
  expires_at: string | null;
}

export default function SettingsPage() {
  const router = useRouter();
  
  // Auth state
  const [token, setToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // API keys state
  const [keys, setKeys] = useState<APIKey[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // New key inputs
  const [keyName, setKeyName] = useState<string>("");
  const [expiresIn, setExpiresIn] = useState<string>("30");

  // Plaintext key modal display
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    const storedToken = localStorage.getItem("omnitext_token");
    const storedEmail = localStorage.getItem("omnitext_email");
    if (!storedToken) {
      router.push("/login");
    } else {
      setToken(storedToken);
      setUserEmail(storedEmail);
      fetchKeys(storedToken);
    }
  }, []);

  const fetchKeys = async (authToken: string) => {
    try {
      setLoading(true);
      const response = await apiClient<APIKey[]>("/api/v1/auth/keys", {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });
      if (response.data) {
        setKeys(response.data);
      } else if (response.error) {
        setError(response.error.message);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load active API Keys.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName.trim()) return;

    setActionLoading(true);
    setError(null);
    setGeneratedKey(null);

    try {
      const response = await apiClient<any>("/api/v1/auth/keys", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: keyName,
          expires_in_days: expiresIn === "never" ? null : parseInt(expiresIn, 10),
        })
      });

      if (response.data) {
        setGeneratedKey(response.data.full_key);
        setKeyName("");
        if (token) fetchKeys(token);
      } else if (response.error) {
        setError(response.error.message);
      }
    } catch (err: any) {
      setError(err.message || "Failed to generate new API Key.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevokeKey = async (keyId: number) => {
    if (!confirm("Are you sure you want to revoke this API Key? Any application calling endpoints with this key will fail immediately.")) {
      return;
    }

    setActionLoading(true);
    setError(null);

    try {
      const response = await apiClient<any>(`/api/v1/auth/keys/${keyId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.data?.success) {
        if (token) fetchKeys(token);
      } else if (response.error) {
        setError(response.error.message);
      }
    } catch (err: any) {
      setError(err.message || "Failed to revoke API Key.");
    } finally {
      setActionLoading(false);
    }
  };

  const copyKey = () => {
    if (!generatedKey) return;
    navigator.clipboard.writeText(generatedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLogout = () => {
    localStorage.removeItem("omnitext_token");
    localStorage.removeItem("omnitext_email");
    router.push("/login");
    setTimeout(() => {
      window.location.reload();
    }, 300);
  };

  if (!token) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-text-secondary text-sm">Authenticating session...</p>
      </div>
    );
  }

  return (
    <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12 space-y-8">

      {/* Settings Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-default/60 pb-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-serif font-semibold tracking-tight text-text-primary">
            Workspace Settings
          </h1>
          <p className="text-xs text-text-secondary">
            Manage developer credentials and token parameters.
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="px-4 py-2 border border-border-default hover:bg-surface-raised rounded-lg text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors self-start"
        >
          Sign Out
        </button>
      </div>

      {/* Account summary Card */}
      <div className="bg-surface border border-border-default rounded-xl p-5 flex items-center gap-4">
        <div className="p-3 bg-accent-primary/10 rounded-lg text-accent-primary">
          <User className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Account Email</h4>
          <p className="text-sm font-medium text-text-primary">{userEmail || "loading..."}</p>
        </div>
      </div>

      {/* API Keys Configuration Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Create key form */}
        <div className="bg-surface border border-border-default rounded-xl p-5 space-y-4 self-start">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-2">
            <Key className="w-4 h-4 text-accent-primary" /> Generate New API Key
          </h3>
          <form className="space-y-4" onSubmit={handleCreateKey}>
            <div className="space-y-1">
              <label htmlFor="keyName" className="text-xs font-semibold text-text-secondary">Key Description</label>
              <input
                id="keyName"
                type="text"
                required
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                placeholder="production-service"
                className="w-full px-3 py-2 rounded-lg bg-surface-raised border border-border-default text-xs text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent-primary transition-colors"
              />
            </div>
            
            <div className="space-y-1">
              <label htmlFor="expiresIn" className="text-xs font-semibold text-text-secondary">Expiration</label>
              <select
                id="expiresIn"
                value={expiresIn}
                onChange={(e) => setExpiresIn(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-surface-raised border border-border-default text-xs text-text-primary focus:outline-none focus:border-accent-primary transition-colors"
              >
                <option value="7">7 Days</option>
                <option value="30">30 Days</option>
                <option value="90">90 Days</option>
                <option value="never">Never Expire</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={actionLoading || !keyName.trim()}
              className="w-full bg-accent-primary hover:bg-accent-hover text-white text-xs font-semibold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              {actionLoading ? "Generating..." : "Generate Key"}
            </button>
          </form>
        </div>

        {/* Right Side: Active keys listing */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* Plaintext token creation alert (Show once) */}
          {generatedKey && (
            <div className="p-5 bg-warning/5 border border-warning/35 rounded-xl space-y-3">
              <div className="flex items-start gap-2.5 text-warning">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider">Copy your API Key</h4>
                  <p className="text-xs text-text-secondary">
                    For security reasons, this token will only be shown once. Copy it now, as you won't be able to retrieve it again.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <code className="flex-1 block p-2.5 rounded bg-surface-raised border border-border-default text-xs font-mono select-all overflow-x-auto text-text-primary">
                  {generatedKey}
                </code>
                <button
                  onClick={copyKey}
                  className="px-3 rounded bg-accent-primary hover:bg-accent-hover text-white flex items-center justify-center gap-1.5 text-xs font-semibold transition-colors min-w-[90px]"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="p-4 bg-danger/10 border border-danger/20 rounded-xl text-xs text-danger">
              {error}
            </div>
          )}

          <div className="bg-surface border border-border-default rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Active developer keys ({keys.length})
            </h3>
            
            {loading ? (
              <div className="py-8 text-center text-xs text-text-secondary animate-pulse">
                Loading credentials...
              </div>
            ) : keys.length === 0 ? (
              <div className="py-8 text-center text-xs text-text-secondary">
                No active credentials. Generate one above to access API endpoints programmatically.
              </div>
            ) : (
              <div className="divide-y divide-border-default/45">
                {keys.map((key) => (
                  <div key={key.id} className="py-4 flex items-center justify-between gap-4 first:pt-0 last:pb-0">
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                        {key.name}
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-raised border text-text-secondary">
                          {key.prefix}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-text-secondary">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Created: {new Date(key.created_at).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" /> 
                          {key.expires_at 
                            ? `Expires: ${new Date(key.expires_at).toLocaleDateString()}` 
                            : "Never Expires"
                          }
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRevokeKey(key.id)}
                      disabled={actionLoading}
                      className="p-2 text-text-secondary hover:text-danger hover:bg-danger/10 rounded transition-all disabled:opacity-50"
                      title="Revoke Key"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
