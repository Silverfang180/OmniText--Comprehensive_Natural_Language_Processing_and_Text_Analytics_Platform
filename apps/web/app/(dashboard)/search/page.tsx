"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  FolderOpen,
  ArrowRight,
  Loader,
  AlertCircle,
  FileText,
  Percent,
  Sliders,
  Sparkles,
  BookOpen,
  HelpCircle,
  Lock,
  MessageSquareCode,
  CornerDownRight,
  Clipboard,
  ArrowLeft,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { QaAnswerCard } from "@/components/nlp/QaAnswerCard";

interface DatasetItem {
  id: number;
  name: string;
  user_id: number;
  created_at: string;
}

interface SearchResultItem {
  text: string;
  score: number;
  filename: string;
  chunk_index: number;
}

interface QAResponse {
  answer: string;
  score: number;
  start: number;
  end: number;
  source_passage: string;
  document_title?: string;
  match_score?: number;
}

export default function SearchAndQAPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"search" | "direct_qa">("search");
  const [token, setToken] = useState<string | null>(null);

  // Authentication Resolve
  useEffect(() => {
    const storedToken = localStorage.getItem("omnitext_token");
    if (storedToken) {
      setToken(storedToken);
      fetchDatasets(storedToken);
    } else {
      // Default to direct QA for unauthenticated visitors
      setActiveTab("direct_qa");
    }
  }, []);

  // --- Tab 1: Dataset Search & QA States ---
  const [datasets, setDatasets] = useState<DatasetItem[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [limit, setLimit] = useState<number>(5);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loadingDatasets, setLoadingDatasets] = useState<boolean>(false);
  const [datasetError, setDatasetError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Dataset-based QA States
  const [datasetQuestion, setDatasetQuestion] = useState<string>("");
  const [isDatasetQAing, setIsDatasetQAing] = useState<boolean>(false);
  const [datasetQAResponse, setDatasetQAResponse] = useState<QAResponse | null>(null);
  const [datasetQAError, setDatasetQAError] = useState<string | null>(null);

  // --- Tab 2: Direct Passage QA States ---
  const [directContext, setDirectContext] = useState<string>("");
  const [directQuestion, setDirectQuestion] = useState<string>("");
  const [isDirectQAing, setIsDirectQAing] = useState<boolean>(false);
  const [directQAResponse, setDirectQAResponse] = useState<QAResponse | null>(null);
  const [directQAError, setDirectQAError] = useState<string | null>(null);

  const fetchDatasets = async (authToken: string) => {
    try {
      setLoadingDatasets(true);
      setDatasetError(null);
      const res = await apiClient<DatasetItem[]>("/api/v1/documents/datasets", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = res.data || [];
      setDatasets(data);
      if (data.length > 0) {
        setSelectedDatasetId(data[0].id.toString());
      }
    } catch (err: any) {
      setDatasetError(err.message || "Failed to load datasets.");
    } finally {
      setLoadingDatasets(false);
    }
  };

  // Run Semantic Search
  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedDatasetId || !searchQuery.trim()) return;

    try {
      setIsSearching(true);
      setSearchError(null);
      setResults([]);
      // Clear previous dataset QA responses when running a new search
      setDatasetQAResponse(null);

      const res = await apiClient<SearchResultItem[]>("/api/v1/search", {
        method: "POST",
        body: JSON.stringify({
          dataset_id: parseInt(selectedDatasetId),
          query: searchQuery,
          limit: limit,
        }),
        headers: { Authorization: `Bearer ${token}` },
      });

      setResults(res.data || []);
    } catch (err: any) {
      setSearchError(err.message || "Failed to execute semantic search query.");
    } finally {
      setIsSearching(false);
    }
  };

  // Run QA over Dataset (combined workflow)
  const handleDatasetQASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedDatasetId || !datasetQuestion.trim()) return;

    try {
      setIsDatasetQAing(true);
      setDatasetQAError(null);
      setDatasetQAResponse(null);

      const res = await apiClient<QAResponse>("/api/v1/search/qa", {
        method: "POST",
        body: JSON.stringify({
          question: datasetQuestion,
          dataset_id: parseInt(selectedDatasetId),
        }),
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.error) {
        setDatasetQAError(res.error.message);
      } else {
        setDatasetQAResponse(res.data || null);
      }
    } catch (err: any) {
      setDatasetQAError(err.message || "Failed to query dataset QA.");
    } finally {
      setIsDatasetQAing(false);
    }
  };

  // Run QA directly over a single selected search passage (FR-29 combined search-then-QA)
  const handleQAOnPassage = async (passageText: string, filename: string, score: number) => {
    if (!token) return;
    try {
      setIsDatasetQAing(true);
      setDatasetQAError(null);
      setDatasetQAResponse(null);
      // Pre-fill the question input if empty
      const question = datasetQuestion.trim() || `Extract details from this passage`;
      if (!datasetQuestion.trim()) {
        setDatasetQuestion(question);
      }

      const res = await apiClient<QAResponse>("/api/v1/search/qa", {
        method: "POST",
        body: JSON.stringify({
          question: question,
          context: passageText,
        }),
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.error) {
        setDatasetQAError(res.error.message);
      } else {
        // Map source details to response metadata for consistent rendering
        if (res.data) {
          res.data.document_title = filename;
          res.data.match_score = score;
        }
        setDatasetQAResponse(res.data || null);
      }
    } catch (err: any) {
      setDatasetQAError(err.message || "Failed to query passage QA.");
    } finally {
      setIsDatasetQAing(false);
    }
  };

  // Run Direct QA (anonymous / ungated)
  const handleDirectQASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directContext.trim() || !directQuestion.trim()) return;

    try {
      setIsDirectQAing(true);
      setDirectQAError(null);
      setDirectQAResponse(null);

      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await apiClient<QAResponse>("/api/v1/search/qa", {
        method: "POST",
        body: JSON.stringify({
          question: directQuestion,
          context: directContext,
        }),
        headers,
      });

      if (res.error) {
        setDirectQAError(res.error.message);
      } else {
        setDirectQAResponse(res.data || null);
      }
    } catch (err: any) {
      setDirectQAError(err.message || "Failed to extract answer.");
    } finally {
      setIsDirectQAing(false);
    }
  };

  // Load sample passage for Direct QA
  const loadQAPropsSample = () => {
    setDirectContext(
      "Education has traditionally been structured around textbooks, exams, and predefined syllabi. " +
        "But over the years, voices from the tech world have challenged this approach, arguing that real learning " +
        "often happens outside rigid systems. One such perspective comes from Elon Musk, who has consistently " +
        "emphasised the importance of curiosity over conventional learning methods. His idea — 'Don’t just follow the syllabus, " +
        "follow your curiosity' — reflects a broader shift in how knowledge is being viewed."
    );
    setDirectQuestion("What does Elon Musk emphasise the importance of?");
    setDirectQAResponse(null);
    setDirectQAError(null);
  };

  const formatScorePercent = (score: number): string => {
    const normalized = Math.max(0, Math.min(100, Math.round(score * 100)));
    return `${normalized}%`;
  };

  const getScoreBadgeColor = (score: number): string => {
    if (score >= 0.75) return "bg-success/10 text-success border-success/20";
    if (score >= 0.5) return "bg-warning/10 text-warning border-warning/20";
    return "bg-text-secondary/10 text-text-secondary border-border-default";
  };

  // Search query term highlighting using --accent-secondary (ink-teal)
  const highlightSearchTerms = (text: string, query: string) => {
    if (!query.trim()) return text;
    const terms = query.split(/\s+/).filter(term => term.length > 2);
    if (terms.length === 0) return text;
    
    // Escape terms for safe regex parsing
    const escapedTerms = terms.map(t => t.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&"));
    const regex = new RegExp(`(${escapedTerms.join("|")})`, "gi");
    
    const parts = text.split(regex);
    return (
      <>
        {parts.map((part, i) => 
          regex.test(part) ? (
            <mark key={i} className="bg-accent-secondary/10 text-accent-secondary border-b border-accent-secondary/30 px-0.5 rounded font-medium decoration-clone">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
  };

  return (
    <div className="max-w-dashboard mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
<h1 className="text-3xl font-serif font-semibold text-text-primary mb-2">Document Intelligence</h1>
        <p className="text-sm text-text-secondary">
          Perform semantic search and extract factual answers directly from document text using neural semantic representations.
        </p>
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b border-border-default mb-8">
        <button
          onClick={() => setActiveTab("search")}
          className={`flex items-center gap-2 px-6 py-3 text-sm font-semibold border-b-2 transition -mb-px ${
            activeTab === "search"
              ? "border-accent-primary text-accent-primary"
              : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          <Search className="w-4 h-4" />
          Dataset Search & Q&A
        </button>
        <button
          onClick={() => setActiveTab("direct_qa")}
          className={`flex items-center gap-2 px-6 py-3 text-sm font-semibold border-b-2 transition -mb-px ${
            activeTab === "direct_qa"
              ? "border-accent-primary text-accent-primary"
              : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Direct Passage Q&A
        </button>
      </div>

      {/* --- TAB 1: DATASET SEARCH & QA (AUTHENTICATED) --- */}
      {activeTab === "search" && (
        <div className="space-y-6">
          {!token ? (
            <div className="text-center py-16 border border-border-default rounded-xl bg-surface p-8 max-w-lg mx-auto shadow-sm">
              <Lock className="w-12 h-12 text-text-secondary/40 mx-auto mb-4" />
              <h3 className="text-base font-semibold text-text-primary mb-2">Developer Account Required</h3>
              <p className="text-sm text-text-secondary mb-6">
                Authentication is required to create datasets, persist parsed documents, and query them using semantic vector spaces.
              </p>
              <button
                onClick={() => router.push("/login")}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent-primary hover:bg-accent-hover text-white rounded-lg text-sm font-semibold transition"
              >
                Sign In to Workspace <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : datasetError ? (
            <div className="p-4 bg-danger/10 border border-danger/30 rounded-lg text-sm text-danger flex items-center gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{datasetError}</span>
            </div>
          ) : loadingDatasets ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2">
              <Loader className="w-8 h-8 text-accent-primary animate-spin" />
              <p className="text-sm text-text-secondary">Loading datasets configuration...</p>
            </div>
          ) : datasets.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-border-default rounded-xl bg-surface p-6 max-w-lg mx-auto">
              <FolderOpen className="w-12 h-12 text-text-secondary/30 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-text-primary mb-1">No Datasets Available</h3>
              <p className="text-sm text-text-secondary mb-4">
                You need to create a dataset and upload documents before running queries.
              </p>
              <button
                onClick={() => router.push("/documents")}
                className="inline-flex items-center gap-2 px-4 py-2 bg-accent-primary hover:bg-accent-hover text-white rounded-lg text-sm font-semibold transition"
              >
                Go to Datasets <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Column: Semantic Search & QA Inputs */}
              <div className="lg:col-span-7 space-y-6">
                {/* Search Form */}
                <form
                  onSubmit={handleSearchSubmit}
                  className="bg-surface border border-border-default rounded-xl p-5 shadow-sm space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-border-default/50 pb-2">
                    <h3 className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-accent-primary" /> 1. Run Semantic Search
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-6">
                      <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                        Corpus Dataset
                      </label>
                      <select
                        value={selectedDatasetId}
                        onChange={(e) => setSelectedDatasetId(e.target.value)}
                        className="w-full pl-3 pr-8 py-2 border border-border-default rounded-lg focus:outline-none focus:border-accent-primary bg-surface text-text-primary text-sm appearance-none transition"
                      >
                        {datasets.map((ds) => (
                          <option key={ds.id} value={ds.id.toString()}>
                            {ds.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-6">
                      <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                        Matches (K)
                      </label>
                      <select
                        value={limit}
                        onChange={(e) => setLimit(parseInt(e.target.value))}
                        className="w-full pl-3 pr-8 py-2 border border-border-default rounded-lg focus:outline-none focus:border-accent-primary bg-surface text-text-primary text-sm appearance-none transition"
                      >
                        <option value={3}>K = 3</option>
                        <option value={5}>K = 5</option>
                        <option value={10}>K = 10</option>
                      </select>
                    </div>

                    <div className="md:col-span-12">
                      <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                        Search Query
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search for details, topics, or paragraphs..."
                          className="w-full pl-3 pr-10 py-2 border border-border-default rounded-lg focus:outline-none focus:border-accent-primary bg-surface text-text-primary text-sm transition"
                        />
                        <button
                          type="submit"
                          disabled={isSearching || !searchQuery.trim()}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-accent-primary hover:text-accent-hover disabled:opacity-30 transition"
                        >
                          {isSearching ? (
                            <Loader className="w-4 h-4 animate-spin" />
                          ) : (
                            <Search className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </form>

                {/* Combined QA Form */}
                <form
                  onSubmit={handleDatasetQASubmit}
                  className="bg-surface border border-border-default rounded-xl p-5 shadow-sm space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-border-default/50 pb-2">
                    <h3 className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
                      <HelpCircle className="w-4 h-4 text-accent-primary" /> 2. Ask Dataset Question (Extractive QA)
                    </h3>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                      Your Question
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={datasetQuestion}
                        onChange={(e) => setDatasetQuestion(e.target.value)}
                        placeholder="e.g. Who developed the theory of relativity?"
                        className="w-full pl-3 pr-10 py-2.5 border border-border-default rounded-lg focus:outline-none focus:border-accent-primary bg-surface text-text-primary text-sm transition"
                      />
                      <button
                        type="submit"
                        disabled={isDatasetQAing || !datasetQuestion.trim()}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-accent-primary hover:text-accent-hover disabled:opacity-30 transition"
                      >
                        {isDatasetQAing ? (
                          <Loader className="w-4.5 h-4.5 animate-spin" />
                        ) : (
                          <ArrowRight className="w-4.5 h-4.5" />
                        )}
                      </button>
                    </div>
                    <p className="text-[10px] text-text-secondary mt-1.5">
                      This scans your dataset using semantic search, identifies the most relevant passage, and extracts the exact factual span.
                    </p>
                  </div>
                </form>

                {searchError && (
                  <div className="p-4 bg-danger/10 border border-danger/30 rounded-lg text-sm text-danger flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <span>{searchError}</span>
                  </div>
                )}
              </div>

              {/* Right Column: Search Results & Extractive QA Output Card */}
              <div className="lg:col-span-5 space-y-6">
                {/* Extractive QA Card */}
                {isDatasetQAing && (
                  <div className="border border-border-default rounded-xl bg-surface p-6 shadow-sm flex flex-col items-center justify-center gap-3">
                    <Loader className="w-8 h-8 text-accent-primary animate-spin" />
                    <p className="text-sm font-semibold text-text-primary">Extracting answer...</p>
                    <p className="text-xs text-text-secondary">Running inference using DistilBERT model</p>
                  </div>
                )}

                {datasetQAError && (
                  <div className="p-4 bg-danger/10 border border-danger/30 rounded-lg text-sm text-danger flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <span>{datasetQAError}</span>
                  </div>
                )}

                {datasetQAResponse && (
                  <QaAnswerCard
                    question={datasetQuestion}
                    answer={datasetQAResponse.answer}
                    confidence={datasetQAResponse.score}
                    sourcePassage={datasetQAResponse.source_passage}
                    start={datasetQAResponse.start}
                    end={datasetQAResponse.end}
                    modelId="distilbert-base-cased-distilled-squad"
                    documentTitle={datasetQAResponse.document_title}
                    matchScore={datasetQAResponse.match_score}
                  />
                )}

                {/* Search Results List */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                    Semantic Search Results {results.length > 0 && `(${results.length})`}
                  </h3>

                  {isSearching ? (
                    <div className="py-16 border border-border-default rounded-xl bg-surface flex flex-col items-center justify-center gap-2">
                      <Loader className="w-6 h-6 text-accent-primary animate-spin" />
                      <p className="text-xs text-text-secondary">Searching corpus chunks...</p>
                    </div>
                  ) : results.length === 0 ? (
                    <div className="py-16 border border-border-default rounded-xl bg-surface flex flex-col items-center justify-center text-center p-6 text-xs text-text-secondary">
                      <Search className="w-8 h-8 text-text-secondary/20 mb-2 animate-pulse" />
                      <p>Run a search query to view relevant document passages.</p>
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                      {results.map((item, idx) => (
                        <div
                          key={idx}
                          className="border border-border-default hover:border-accent-secondary/20 bg-surface rounded-xl p-4 transition shadow-sm space-y-3"
                        >
                          <div className="flex items-center justify-between gap-2 border-b border-border-default/50 pb-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <FileText className="w-3.5 h-3.5 text-text-secondary flex-shrink-0" />
                              <span className="text-[10px] font-semibold text-text-primary truncate" title={item.filename}>
                                {item.filename}
                              </span>
                            </div>
                            <span
                              className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full border text-[10px] font-medium ${getScoreBadgeColor(
                                item.score
                              )}`}
                            >
                              {formatScorePercent(item.score)} Match
                            </span>
                          </div>
                          <p className="text-xs text-text-primary leading-relaxed font-sans line-clamp-4">
                            {highlightSearchTerms(item.text, searchQuery)}
                          </p>

                          <button
                            onClick={() => handleQAOnPassage(item.text, item.filename, item.score)}
                            className="inline-flex items-center gap-1.5 text-[10px] font-bold text-accent-secondary hover:text-accent-secondary/80 transition border border-accent-secondary/20 hover:border-accent-secondary px-2 py-1 rounded bg-accent-secondary/5 cursor-pointer"
                          >
                            <CornerDownRight className="w-3.5 h-3.5" /> Ask Question on this Passage
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- TAB 2: DIRECT PASSAGE QA (UNGATED / ANONYMOUS) --- */}
      {activeTab === "direct_qa" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Inputs Section */}
          <form
            onSubmit={handleDirectQASubmit}
            className="lg:col-span-7 bg-surface border border-border-default rounded-xl p-6 shadow-sm space-y-5"
          >
            <div className="flex items-center justify-between border-b border-border-default pb-3">
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-accent-primary" /> Direct Passage Question Answering
              </h3>
              <button
                type="button"
                onClick={loadQAPropsSample}
                className="inline-flex items-center gap-1 px-3 py-1 bg-surface border border-border-default hover:bg-border-default/30 rounded text-xs font-semibold text-text-primary transition cursor-pointer"
              >
                <Clipboard className="w-3.5 h-3.5" /> Load Sample Context
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider">
                Context Passage (Maximum 400 words)
              </label>
              <textarea
                required
                value={directContext}
                onChange={(e) => setDirectContext(e.target.value)}
                placeholder="Paste your source document context or text snippet here..."
                rows={8}
                className="w-full p-3 border border-border-default rounded-lg focus:outline-none focus:border-accent-primary bg-surface text-text-primary text-sm font-sans resize-none transition"
              />
              <div className="flex justify-between items-center text-[10px] text-text-secondary mt-1">
                <span>Character Count: {directContext.length}</span>
                <span
                  className={
                    directContext.split(/\s+/).filter(Boolean).length > 400
                      ? "text-danger font-semibold"
                      : ""
                  }
                >
                  Word Count: {directContext.split(/\s+/).filter(Boolean).length} / 400
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider">
                Extractive Question
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={directQuestion}
                  onChange={(e) => setDirectQuestion(e.target.value)}
                  placeholder="Ask a question that has a direct factual answer in the passage..."
                  className="w-full pl-3 pr-10 py-2.5 border border-border-default rounded-lg focus:outline-none focus:border-accent-primary bg-surface text-text-primary text-sm transition"
                />
                <button
                  type="submit"
                  disabled={
                    isDirectQAing ||
                    !directContext.trim() ||
                    !directQuestion.trim() ||
                    directContext.split(/\s+/).filter(Boolean).length > 400
                  }
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-accent-primary hover:text-accent-hover disabled:opacity-30 transition cursor-pointer"
                >
                  {isDirectQAing ? (
                    <Loader className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </form>

          {/* Results Output Section */}
          <div className="lg:col-span-5 space-y-6">
            {isDirectQAing && (
              <div className="border border-border-default rounded-xl bg-surface p-12 shadow-sm flex flex-col items-center justify-center gap-3">
                <Loader className="w-8 h-8 text-accent-primary animate-spin" />
                <p className="text-sm font-semibold text-text-primary">Extracting answer...</p>
                <p className="text-xs text-text-secondary">Running local token classification models</p>
              </div>
            )}

            {directQAError && (
              <div className="p-4 bg-danger/10 border border-danger/30 rounded-lg text-sm text-danger flex items-center gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>{directQAError}</span>
              </div>
            )}

            {directQAResponse ? (
              <QaAnswerCard
                question={directQuestion}
                answer={directQAResponse.answer}
                confidence={directQAResponse.score}
                sourcePassage={directQAResponse.source_passage}
                start={directQAResponse.start}
                end={directQAResponse.end}
                modelId="distilbert-base-cased-distilled-squad"
              />
            ) : (
              !isDirectQAing && (
                <div className="h-64 border border-border-default rounded-xl flex flex-col items-center justify-center text-center p-6 bg-surface">
                  <BookOpen className="w-10 h-10 text-text-secondary/20 mb-3 animate-pulse" />
                  <h3 className="text-sm font-semibold text-text-primary mb-1">Awaiting Context & Question</h3>
                  <p className="text-xs text-text-secondary max-w-xs">
                    Paste a text passage and ask a question on the left to extract the factual span directly with visual rendering.
                  </p>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
