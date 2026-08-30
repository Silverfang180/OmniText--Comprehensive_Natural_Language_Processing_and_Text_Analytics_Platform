"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  History, 
  Trash2, 
  ChevronDown, 
  ChevronUp, 
  Calendar, 
  Layers, 
  ExternalLink,
  ArrowRight,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { TaskResultCard } from "@/components/nlp/TaskResultCard";
import { SummaryView } from "@/components/nlp/SummaryView";
import { SentimentBadge } from "@/components/nlp/SentimentBadge";
import { NerHighlightView } from "@/components/nlp/NerHighlightView";

// Render classification and keywords inline in history details
interface Prediction {
  label: string;
  score: number;
}

interface Keyword {
  keyword: string;
  score: number;
}

interface AnalysisItem {
  id: string;
  text: string;
  tasks: string[];
  results: {
    summarization?: { summary_text: string; word_count: number };
    sentiment?: { label: string; score: number };
    ner?: { entities: Array<{ entity: string; label: string; start: number; end: number; confidence: number }> };
    classification?: { predictions: Prediction[] };
    keyword_extraction?: { keywords: Keyword[] };
  };
  meta: {
    latency_ms?: number;
    total_latency_ms?: number;
    model_ids?: Record<string, string>;
    latencies_ms?: Record<string, number>;
  };
  created_at: string;
}

export default function AnalyzeHistoryPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  
  // History list state
  const [items, setItems] = useState<AnalysisItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Pagination
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalRecords, setTotalRecords] = useState<number>(0);

  // Selected/Expanded item
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const storedToken = localStorage.getItem("omnitext_token");
    if (!storedToken) {
      router.push("/login");
    } else {
      setToken(storedToken);
      fetchHistory(storedToken, page);
    }
  }, [page]);

  const fetchHistory = async (authToken: string, currentPage: number) => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient<AnalysisItem[]>(`/api/v1/analyses?page=${currentPage}&size=10`, {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });
      if (response.data) {
        setItems(response.data);
        const pagination = (response.meta?.extra || {}) as any;
        setTotalPages(pagination.total_pages || 1);
        setTotalRecords(pagination.total_records || 0);
      } else if (response.error) {
        setError(response.error.message);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load analysis history.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this analysis from your history?")) return;

    try {
      const response = await apiClient<any>(`/api/v1/analyses/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.data?.success) {
        setExpandedId(null);
        if (token) fetchHistory(token, page);
      } else if (response.error) {
        alert(response.error.message);
      }
    } catch (err: any) {
      alert(err.message || "Failed to delete analysis record.");
    }
  };

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
    }
  };

  if (!token) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-text-secondary text-sm animate-pulse">Authenticating...</p>
      </div>
    );
  }

  return (
    <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12 space-y-8">

      {/* Header */}
      <div className="border-b border-border-default/60 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-serif font-semibold tracking-tight text-text-primary flex items-center gap-2.5">
            <History className="w-8 h-8 text-accent-primary" /> Analysis History
          </h1>
          <p className="text-xs text-text-secondary">
            View, inspect, and manage your saved multi-task document pipeline outcomes.
          </p>
        </div>
        <div className="text-xs text-text-secondary font-mono bg-surface-raised border border-border-default px-3 py-1.5 rounded-lg self-start">
          Total records: <span className="font-semibold text-text-primary">{totalRecords}</span>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-danger/10 border border-danger/20 rounded-xl flex items-start gap-2.5 text-xs text-danger">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Content Area */}
      {loading ? (
        <div className="space-y-4 animate-pulse">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-16 bg-surface border border-border-default rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-surface border border-border-default rounded-xl p-10 text-center space-y-4">
          <p className="text-sm text-text-secondary">
            You haven't saved any analysis tasks yet. Try running an analysis on the workspace page.
          </p>
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 bg-accent-primary hover:bg-accent-hover text-white text-xs font-semibold rounded-lg inline-flex items-center gap-2 transition-colors"
          >
            Go to Quick Analysis Workspace <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* History List Accordion */}
          {items.map((item) => {
            const isExpanded = expandedId === item.id;
            const excerpt = item.text.length > 90 ? `${item.text.slice(0, 90)}...` : item.text;
            const dateStr = new Date(item.created_at).toLocaleString();
            const latency = item.meta?.total_latency_ms || item.meta?.latency_ms || 0;

            return (
              <div 
                key={item.id} 
                className={`bg-surface border rounded-xl overflow-hidden transition-all ${
                  isExpanded ? "border-accent-primary ring-1 ring-accent-primary/20" : "border-border-default hover:border-border-default/90"
                }`}
              >
                {/* Header/Row */}
                <div 
                  onClick={() => toggleExpand(item.id)}
                  className="p-5 flex items-center justify-between gap-4 cursor-pointer select-none"
                >
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2 text-[10px] text-text-secondary">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {dateStr}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1 font-mono">
                        Latency: {latency.toFixed(1)} ms
                      </span>
                    </div>
                    <p className="text-xs text-text-primary font-medium truncate">
                      {excerpt}
                    </p>
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {item.tasks.map((task) => (
                        <span key={task} className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-surface-raised border text-text-secondary">
                          {task}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={(e) => handleDelete(e, item.id)}
                      className="p-2 text-text-secondary hover:text-danger hover:bg-danger/10 rounded transition-all"
                      title="Delete Record"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-text-secondary" /> : <ChevronDown className="w-4 h-4 text-text-secondary" />}
                  </div>
                </div>

                {/* Expanded Detail Panel */}
                {isExpanded && (
                  <div className="border-t border-border-default/60 p-5 bg-surface-raised/40 space-y-5">
                    {/* Full original input text */}
                    <div className="space-y-1.5">
                      <h4 className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                        Full Document Text
                      </h4>
                      <p className="text-xs text-text-primary bg-surface p-4 rounded-lg border border-border-default leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto">
                        {item.text}
                      </p>
                    </div>

                    {/* Results container */}
                    <div className="space-y-4 pt-2">
                      <h4 className="text-[10px] font-bold text-text-secondary uppercase tracking-wider border-b border-border-default/60 pb-1">
                        Pipeline Results
                      </h4>

                      {/* Summarization */}
                      {item.results.summarization && (
                        <TaskResultCard
                          title="Summarization"
                          modelId={item.meta?.model_ids?.summarization || "summarization-model"}
                          latencyMs={item.meta?.latencies_ms?.summarization || 0}
                        >
                          <SummaryView
                            summaryText={item.results.summarization.summary_text}
                            originalText={item.text}
                          />
                        </TaskResultCard>
                      )}

                      {/* Sentiment */}
                      {item.results.sentiment && (
                        <TaskResultCard
                          title="Sentiment Analysis"
                          modelId={item.meta?.model_ids?.sentiment || "sentiment-model"}
                          latencyMs={item.meta?.latencies_ms?.sentiment || 0}
                        >
                          <SentimentBadge
                            label={item.results.sentiment.label}
                            score={item.results.sentiment.score}
                          />
                        </TaskResultCard>
                      )}

                      {/* NER */}
                      {item.results.ner && (
                        <TaskResultCard
                          title="Named Entity Recognition (NER)"
                          modelId={item.meta?.model_ids?.ner || "ner-model"}
                          latencyMs={item.meta?.latencies_ms?.ner || 0}
                        >
                          <NerHighlightView
                            text={item.text}
                            entities={item.results.ner.entities}
                          />
                        </TaskResultCard>
                      )}

                      {/* Classification */}
                      {item.results.classification && (
                        <TaskResultCard
                          title="Zero-Shot Text Classification"
                          modelId={item.meta?.model_ids?.classification || "classification-model"}
                          latencyMs={item.meta?.latencies_ms?.classification || 0}
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-surface rounded-lg border border-border-default/50">
                            {item.results.classification.predictions.map((pred, idx) => (
                              <div key={idx} className="flex justify-between items-center text-xs">
                                <span className="font-semibold text-text-primary capitalize">{pred.label}</span>
                                <span className="font-mono text-text-secondary">{Math.round(pred.score * 100)}%</span>
                              </div>
                            ))}
                          </div>
                        </TaskResultCard>
                      )}

                      {/* Keywords */}
                      {item.results.keyword_extraction && (
                        <TaskResultCard
                          title="Keyword &amp; Keyphrase Extraction"
                          modelId={item.meta?.model_ids?.keyword_extraction || "keywords-model"}
                          latencyMs={item.meta?.latencies_ms?.keyword_extraction || 0}
                        >
                          <div className="flex flex-wrap gap-2 p-4 bg-surface rounded-lg border border-border-default/50">
                            {item.results.keyword_extraction.keywords.map((kw, idx) => (
                              <div 
                                key={idx} 
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-accent-primary/10 border border-accent-primary/25 text-xs text-accent-primary"
                                title={`Relevance: ${(kw.score * 100).toFixed(1)}%`}
                              >
                                <span className="font-semibold">{kw.keyword}</span>
                                <span className="text-[9px] opacity-75 font-mono">{(kw.score).toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        </TaskResultCard>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border-default/60 pt-6">
              <button
                onClick={() => setPage(p => Math.max(p - 1, 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded border text-xs font-semibold hover:bg-surface-raised disabled:opacity-50 transition-colors"
              >
                Previous
              </button>
              <span className="text-xs text-text-secondary">
                Page <span className="font-semibold text-text-primary">{page}</span> of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                disabled={page === totalPages}
                className="px-3 py-1.5 rounded border text-xs font-semibold hover:bg-surface-raised disabled:opacity-50 transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
