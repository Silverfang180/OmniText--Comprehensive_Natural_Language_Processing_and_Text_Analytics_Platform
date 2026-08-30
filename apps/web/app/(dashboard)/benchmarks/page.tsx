"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  TrendingUp,
  Percent,
  Cpu,
  Clock,
  Sparkles,
  RefreshCw,
  CheckCircle,
  HelpCircle,
  FolderOpen,
  ArrowRight,
  Shield,
  Loader,
  AlertCircle,
  Play,
  Check,
  ArrowLeft,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { EvidenceTag } from "@/components/nlp/EvidenceTag";

interface RegistryModel {
  id: number;
  task: string;
  model_id: string;
  version: string;
  is_active: boolean;
  is_fine_tuned: boolean;
  created_at: string;
}

interface BenchmarkResult {
  id: number;
  task: string;
  model_id: string;
  metric_name: string;
  metric_score: number;
  latency_ms: number;
  memory_mb: number;
  created_at: string;
}

interface BenchmarksData {
  registry: RegistryModel[];
  results: BenchmarkResult[];
}

const TASK_DISPLAY_NAMES: Record<string, string> = {
  summarization: "Summarization",
  sentiment: "Sentiment Analysis",
  ner: "Named Entity Recognition",
  classification: "Text Classification",
  keyword_extraction: "Keyword Extraction",
  semantic_search: "Semantic Search",
  question_answering: "Question Answering",
};

export default function BenchmarksDashboard() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);

  // Data States
  const [registry, setRegistry] = useState<RegistryModel[]>([]);
  const [results, setResults] = useState<BenchmarkResult[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Promotion / Run States
  const [promotingModelId, setPromotingModelId] = useState<string | null>(null);
  const [isRunningBenchmark, setIsRunningBenchmark] = useState<boolean>(false);
  const [benchmarkJobId, setBenchmarkJobId] = useState<number | null>(null);
  const [runMessage, setRunMessage] = useState<string | null>(null);

  // Authentication Resolve
  useEffect(() => {
    const storedToken = localStorage.getItem("omnitext_token");
    if (!storedToken) {
      router.push("/login");
    } else {
      setToken(storedToken);
      fetchBenchmarks(storedToken);
    }
  }, []);

  const fetchBenchmarks = async (authToken: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient<BenchmarksData>("/api/v1/benchmarks", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.error) {
        setError(res.error.message);
      } else if (res.data) {
        setRegistry(res.data.registry || []);
        setResults(res.data.results || []);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load evaluation benchmarks.");
    } finally {
      setLoading(false);
    }
  };

  // Poll job status if a benchmark run is triggered
  useEffect(() => {
    if (!benchmarkJobId || !token) return;

    let intervalId = setInterval(async () => {
      try {
        const res = await apiClient<BenchmarksData>("/api/v1/benchmarks", {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        // Check if results count increased or query job logs
        if (res.data && res.data.results.length > results.length) {
          setRegistry(res.data.registry || []);
          setResults(res.data.results || []);
          setIsRunningBenchmark(false);
          setBenchmarkJobId(null);
          setRunMessage("Benchmarks executed successfully and winning models promoted!");
          clearInterval(intervalId);
        }
      } catch (err) {
        console.error("Polling error", err);
      }
    }, 3000);

    return () => clearInterval(intervalId);
  }, [benchmarkJobId, token, results]);

  const handleRunBenchmarks = async () => {
    if (!token) return;

    try {
      setIsRunningBenchmark(true);
      setRunMessage(null);
      setError(null);

      const res = await apiClient<any>("/api/v1/benchmarks/run", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.error) {
        setError(res.error.message);
        setIsRunningBenchmark(false);
      } else if (res.data) {
        setBenchmarkJobId(res.data.job_id);
        setRunMessage("Benchmarking job enqueued. Executing local test runs...");
      }
    } catch (err: any) {
      setError(err.message || "Failed to trigger benchmark runner.");
      setIsRunningBenchmark(false);
    }
  };

  const handlePromote = async (task: string, modelId: string) => {
    if (!token) return;

    try {
      setPromotingModelId(modelId);
      setError(null);

      const res = await apiClient<any>("/api/v1/benchmarks/promote", {
        method: "POST",
        body: JSON.stringify({ task, model_id: modelId }),
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.error) {
        setError(res.error.message);
      } else {
        // Optimistically update active model locally
        setRegistry((prev) =>
          prev.map((item) =>
            item.task === task
              ? { ...item, is_active: item.model_id === modelId }
              : item
          )
        );
      }
    } catch (err: any) {
      setError(err.message || "Failed to promote model.");
    } finally {
      setPromotingModelId(null);
    }
  };

  // Group registry and results by task
  const getTaskRegistry = (task: string) => {
    return registry.filter((r) => r.task === task);
  };

  const getTaskResults = (task: string) => {
    return results.filter((r) => r.task === task);
  };

  // Identify the best score/latency candidate for a task
  const getWinningModelId = (task: string): string => {
    const taskRes = getTaskResults(task);
    if (taskRes.length === 0) return "";
    
    // Sort descending by score, ascending by latency
    const sorted = [...taskRes].sort((a, b) => {
      if (b.metric_score !== a.metric_score) {
        return b.metric_score - a.metric_score;
      }
      return a.latency_ms - b.latency_ms;
    });
    return sorted[0].model_id;
  };

  if (loading && registry.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader className="w-8 h-8 text-accent-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-dashboard mx-auto px-4 sm:px-6 lg:px-8 py-10">
{/* Header Panel */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border-default pb-6 mb-8">
        <div>
          <h1 className="text-3xl font-serif font-semibold text-text-primary mb-2">Model Benchmarks</h1>
          <p className="text-sm text-text-secondary max-w-2xl">
            Compare candidate NLP models across all 7 task pipelines. Winning models are automatically identified using task-specific metrics and promoted to the active registry.
          </p>
        </div>

        <button
          onClick={handleRunBenchmarks}
          disabled={isRunningBenchmark}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent-primary hover:bg-accent-hover disabled:bg-accent-primary/50 text-white rounded-lg text-sm font-semibold transition cursor-pointer"
        >
          {isRunningBenchmark ? (
            <Loader className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          Refresh Benchmarks
        </button>
      </div>

      {/* Messaging / Alerts */}
      {error && (
        <div className="p-4 bg-danger/10 border border-danger/30 rounded-lg text-sm text-danger flex items-center gap-2 mb-6">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {runMessage && (
        <div className="p-4 bg-success/10 border border-success/30 rounded-lg text-sm text-success flex items-center gap-2 mb-6">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <span>{runMessage}</span>
        </div>
      )}

      {/* Grid of Task Benchmarks */}
      <div className="space-y-10">
        {Object.keys(TASK_DISPLAY_NAMES).map((taskKey) => {
          const taskRegistry = getTaskRegistry(taskKey);
          const taskResults = getTaskResults(taskKey);
          const winnerId = getWinningModelId(taskKey);

          return (
            <div
              key={taskKey}
              className="bg-surface border border-border-default rounded-xl overflow-hidden"
            >
              {/* Header Title */}
              <div className="p-5 border-b border-border-default/60 bg-muted/10 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-text-primary">
                    {TASK_DISPLAY_NAMES[taskKey]}
                  </h3>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Primary Metric: <span className="font-bold text-accent-primary">{taskResults[0]?.metric_name || "Accuracy"}</span>
                  </p>
                </div>

                {/* Show Active Model */}
                <div className="text-xs">
                  <span className="text-text-secondary font-medium">Currently Active:</span>{" "}
                  <span className="font-bold text-success px-2.5 py-1 rounded bg-success/10 border border-success/20 ml-1.5">
                    {taskRegistry.find((r) => r.is_active)?.model_id || "None"}
                  </span>
                </div>
              </div>

              {/* Candidates Comparison Table */}
              <div className="p-6">
                {taskRegistry.length === 0 ? (
                  <div className="py-8 text-center text-xs text-text-secondary">
                    No registry entries seeded. Refresh benchmarks to generate comparisons.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-border-default text-text-secondary font-semibold">
                          <th className="py-3 px-4 font-sans">Model Candidate</th>
                          <th className="py-3 px-4 font-sans text-right">Version</th>
                          <th className="py-3 px-4 font-sans text-right">Metric Score</th>
                          <th className="py-3 px-4 font-sans text-right">Latency</th>
                          <th className="py-3 px-4 font-sans text-right">Model Size</th>
                          <th className="py-3 px-4 font-sans text-right">Status / Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-default/40">
                        {taskRegistry.map((candidate) => {
                          const stats = taskResults.find((r) => r.model_id === candidate.model_id);
                          const isWinner = candidate.model_id === winnerId;
                          const isActive = candidate.is_active;

                          return (
                            <tr 
                              key={candidate.id}
                              className={`transition-colors hover:bg-muted/10 ${
                                isActive ? "bg-success/[0.02]" : isWinner ? "bg-accent-primary/[0.01]" : ""
                              }`}
                            >
                              <td className="py-3.5 px-4 font-medium text-text-primary">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold select-all">{candidate.model_id}</span>
                                  {isWinner && (
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.25 rounded-full text-[9px] font-bold bg-accent-primary/10 text-accent-primary border border-accent-primary/20">
                                      <Sparkles className="w-2.5 h-2.5" /> Winner
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                <EvidenceTag label={candidate.version} />
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                <div className="inline-flex items-center justify-end font-mono text-text-primary font-bold">
                                  {stats ? `${Math.round(stats.metric_score * 100)}%` : "--"}
                                </div>
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                <div className="inline-flex items-center justify-end font-mono text-text-secondary">
                                  {stats ? `${Math.round(stats.latency_ms)}ms` : "--"}
                                </div>
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                <div className="inline-flex items-center justify-end font-mono text-text-secondary">
                                  {stats ? `${Math.round(stats.memory_mb)}MB` : "--"}
                                </div>
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  {isActive ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-success/15 text-success border border-success/30">
                                      <Check className="w-3 h-3" /> Active
                                    </span>
                                  ) : (
                                    <button
                                      onClick={() => handlePromote(candidate.task, candidate.model_id)}
                                      disabled={promotingModelId !== null}
                                      className="inline-flex items-center gap-1 text-[10px] font-bold text-accent-primary hover:text-accent-hover disabled:opacity-40 transition border border-accent-primary/25 hover:border-accent-primary px-2 py-1 rounded bg-accent-primary/5 cursor-pointer"
                                    >
                                      {promotingModelId === candidate.model_id ? (
                                        <Loader className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <TrendingUp className="w-3 h-3" />
                                      )}
                                      Promote
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
