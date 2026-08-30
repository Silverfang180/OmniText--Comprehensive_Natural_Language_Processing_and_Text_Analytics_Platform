"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  Activity, 
  CheckCircle2, 
  Server, 
  Database, 
  ArrowRight, 
  Layers, 
  Search, 
  BarChart3, 
  AlertCircle,
  Play,
  RotateCcw,
  Copy,
  Download,
  Check,
  User,
  Settings,
  History,
  Sparkles,
  HelpCircle,
  ChevronRight
} from "lucide-react";
import { getSystemHealth, getDbHealth, SystemHealthData, DbHealthData, apiClient } from "@/lib/api-client";
import { TaskResultCard } from "@/components/nlp/TaskResultCard";
import { SummaryView } from "@/components/nlp/SummaryView";
import { SentimentBadge } from "@/components/nlp/SentimentBadge";
import { NerHighlightView } from "@/components/nlp/NerHighlightView";
import { Logo } from "@/components/nlp/Logo";

// Sample texts per Design.md §6
const SAMPLES = [
  {
    label: "Google History (NER & Summary Focus)",
    text: "Google was founded on September 4, 1998, by computer scientists Larry Page and Sergey Brin while they were PhD students at Stanford University in California. Together they own about 14 percent of its publicly traded shares and control 56 percent of the stockholder voting power through super-voting stock. The company went public via an initial public offering (IPO) in 2004. In 2015, Google was reorganized as a wholly owned subsidiary of Alphabet Inc."
  },
  {
    label: "Product Feedback (Sentiment Focus)",
    text: "This new smart assistant is absolutely incredible! The setup took less than two minutes, and the voice recognition works flawlessly from across the room. I was worried it might struggle with my accent, but it hasn't missed a beat. Highly recommended for anyone wanting a reliable smart home upgrade."
  }
];

export default function HomePage() {
  // Auth state
  const [token, setToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Health states
  const [apiHealth, setApiHealth] = useState<SystemHealthData | null>(null);
  const [dbHealth, setDbHealth] = useState<DbHealthData | null>(null);
  const [healthLoading, setHealthLoading] = useState<boolean>(true);
  const [healthError, setHealthError] = useState<string | null>(null);

  // Analysis states
  const [inputText, setInputText] = useState<string>("");
  const [selectedTasks, setSelectedTasks] = useState<string[]>(["summarization", "sentiment", "ner"]);
  const [candidateLabels, setCandidateLabels] = useState<string>("technology, business, sports, entertainment, science, politics");
  
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisResults, setAnalysisResults] = useState<any>(null);
  const [analysisMeta, setAnalysisMeta] = useState<any>(null);
  
  // Copy to clipboard notification
  const [copiedTask, setCopiedTask] = useState<string | null>(null);

  useEffect(() => {
    // Check for user session
    const storedToken = localStorage.getItem("omnitext_token");
    const storedEmail = localStorage.getItem("omnitext_email");
    if (storedToken) {
      setToken(storedToken);
      setUserEmail(storedEmail);
    }

    async function checkHealth() {
      try {
        setHealthLoading(true);
        const [apiRes, dbRes] = await Promise.all([
          getSystemHealth().catch(() => ({ data: null, error: true })),
          getDbHealth().catch(() => ({ data: null, error: true })),
        ]);

        if (apiRes.data) {
          setApiHealth(apiRes.data);
        } else {
          setHealthError("Backend API is currently offline or unreachable.");
        }

        if (dbRes.data) {
          setDbHealth(dbRes.data);
        }
      } catch (err: unknown) {
        setHealthError("Failed to connect to backend health endpoints.");
      } finally {
        setHealthLoading(false);
      }
    }

    checkHealth();
  }, []);

  const handleTaskToggle = (task: string) => {
    if (selectedTasks.includes(task)) {
      setSelectedTasks(selectedTasks.filter(t => t !== task));
    } else {
      setSelectedTasks([...selectedTasks, task]);
    }
  };

  const loadSample = (sampleText: string) => {
    setInputText(sampleText);
    setAnalysisResults(null);
    setAnalysisMeta(null);
    setAnalysisError(null);
  };

  const handleReset = () => {
    setInputText("");
    setAnalysisResults(null);
    setAnalysisMeta(null);
    setAnalysisError(null);
  };

  const handleAnalyze = async () => {
    if (!inputText.trim()) {
      setAnalysisError("Please enter some text to analyze.");
      return;
    }
    if (selectedTasks.length === 0) {
      setAnalysisError("Please select at least one analysis task.");
      return;
    }

    setAnalyzing(true);
    setAnalysisError(null);
    setAnalysisResults(null);
    setAnalysisMeta(null);

    // Build task-specific options parameters
    const options: Record<string, any> = {};
    if (selectedTasks.includes("classification")) {
      const labels = candidateLabels
        .split(",")
        .map(l => l.trim().toLowerCase())
        .filter(l => l.length > 0);
      
      if (labels.length > 0) {
        options.classification = { candidate_labels: labels };
      }
    }

    try {
      const headers: Record<string, string> = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await apiClient<any>("/api/v1/analyses", {
        method: "POST",
        headers,
        body: JSON.stringify({
          text: inputText,
          tasks: selectedTasks,
          options: Object.keys(options).length > 0 ? options : undefined,
        }),
      });

      if (response.data) {
        setAnalysisResults(response.data);
        setAnalysisMeta(response.meta);
      } else if (response.error) {
        setAnalysisError(response.error.message);
      }
    } catch (err: any) {
      setAnalysisError(err.message || "Failed to execute text analysis request.");
    } finally {
      setAnalyzing(false);
    }
  };

  const copyToClipboard = (taskName: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTask(taskName);
    setTimeout(() => setCopiedTask(null), 2000);
  };

  const downloadJson = (taskName: string, data: any) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `omnitext-${taskName}-result.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <main className="flex-1 flex flex-col items-center justify-start px-4 sm:px-6 lg:px-8 py-10 max-w-5xl mx-auto w-full space-y-6">
      

      {/* Title Header */}
      <div className="text-center space-y-4 max-w-3xl flex flex-col items-center">
        <Logo size={64} className="text-text-primary mb-1" />
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border-default bg-surface text-xs text-text-secondary">
          <span className="w-2 h-2 rounded-full bg-accent-primary" />
          OmniText · NLP & Text Intelligence
        </div>
        <h1 className="text-4xl sm:text-5xl font-serif font-semibold tracking-tight text-text-primary">
          Turn text into useful intelligence.
        </h1>
        <p className="text-base text-text-secondary max-w-xl mx-auto leading-relaxed">
          Analyze, summarize, extract, search, and answer questions with modern NLP models.
        </p>
      </div>

      {/* Main Analysis Workspace */}
      <div className="w-full grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Inputs and Task Configuration */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-surface border border-border-default rounded-xl p-5 space-y-4">
            
            {/* Sample selectors */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] text-text-secondary font-bold uppercase tracking-wider mr-1">Load Sample:</span>
              {SAMPLES.map((sample, idx) => (
                <button
                  key={idx}
                  onClick={() => loadSample(sample.text)}
                  className="px-2.5 py-1 rounded bg-surface-raised hover:bg-border-default border border-border-default text-xs text-text-secondary hover:text-text-primary transition-colors"
                >
                  {sample.label}
                </button>
              ))}
            </div>

            {/* Main Text Input */}
            <div className="space-y-1.5">
              <label htmlFor="inputText" className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                Input Document Text
              </label>
              <textarea
                id="inputText"
                rows={8}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Enter or paste your document text here (max 10,000 characters)..."
                className="w-full rounded-lg bg-surface-raised border border-border-default p-4 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary transition-colors resize-none"
              />
              <div className="flex justify-between items-center text-xs text-text-secondary">
                <span>{inputText.length.toLocaleString()} / 10,000 characters</span>
                {inputText.length > 10000 && (
                  <span className="text-danger font-medium">Text exceeds the limit</span>
                )}
              </div>
            </div>

            {/* Task selector checkboxes */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider block">
                Select NLP Pipeline Tasks
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Summarization */}
                <label className={`p-3 rounded-lg border flex items-start gap-3 cursor-pointer select-none transition-all ${
                  selectedTasks.includes("summarization") 
                    ? "bg-accent-primary/5 border-accent-primary/45" 
                    : "bg-surface-raised border-border-default/80 hover:border-border-default"
                }`}>
                  <input
                    type="checkbox"
                    checked={selectedTasks.includes("summarization")}
                    onChange={() => handleTaskToggle("summarization")}
                    className="mt-1 h-3.5 w-3.5 rounded border-border-default accent-accent-primary text-accent-primary focus:ring-accent-primary focus:ring-offset-canvas"
                  />
                  <div className="space-y-0.5">
                    <div className="text-xs font-semibold text-text-primary">Summarization</div>
                    <div className="text-[10px] text-text-secondary leading-tight">Extract key sentences</div>
                  </div>
                </label>

                {/* Sentiment Analysis */}
                <label className={`p-3 rounded-lg border flex items-start gap-3 cursor-pointer select-none transition-all ${
                  selectedTasks.includes("sentiment") 
                    ? "bg-accent-primary/5 border-accent-primary/45" 
                    : "bg-surface-raised border-border-default/80 hover:border-border-default"
                }`}>
                  <input
                    type="checkbox"
                    checked={selectedTasks.includes("sentiment")}
                    onChange={() => handleTaskToggle("sentiment")}
                    className="mt-1 h-3.5 w-3.5 rounded border-border-default accent-accent-primary text-accent-primary focus:ring-accent-primary focus:ring-offset-canvas"
                  />
                  <div className="space-y-0.5">
                    <div className="text-xs font-semibold text-text-primary">Sentiment Analysis</div>
                    <div className="text-[10px] text-text-secondary leading-tight">Polarity &amp; confidence</div>
                  </div>
                </label>

                {/* Named Entity Recognition */}
                <label className={`p-3 rounded-lg border flex items-start gap-3 cursor-pointer select-none transition-all ${
                  selectedTasks.includes("ner") 
                    ? "bg-accent-primary/5 border-accent-primary/45" 
                    : "bg-surface-raised border-border-default/80 hover:border-border-default"
                }`}>
                  <input
                    type="checkbox"
                    checked={selectedTasks.includes("ner")}
                    onChange={() => handleTaskToggle("ner")}
                    className="mt-1 h-3.5 w-3.5 rounded border-border-default accent-accent-primary text-accent-primary focus:ring-accent-primary focus:ring-offset-canvas"
                  />
                  <div className="space-y-0.5">
                    <div className="text-xs font-semibold text-text-primary">Entity Extraction (NER)</div>
                    <div className="text-[10px] text-text-secondary leading-tight">Locate named entities</div>
                  </div>
                </label>

                {/* Zero-Shot Classification */}
                <label className={`p-3 rounded-lg border flex items-start gap-3 cursor-pointer select-none transition-all ${
                  selectedTasks.includes("classification") 
                    ? "bg-accent-primary/5 border-accent-primary/45" 
                    : "bg-surface-raised border-border-default/80 hover:border-border-default"
                }`}>
                  <input
                    type="checkbox"
                    checked={selectedTasks.includes("classification")}
                    onChange={() => handleTaskToggle("classification")}
                    className="mt-1 h-3.5 w-3.5 rounded border-border-default accent-accent-primary text-accent-primary focus:ring-accent-primary focus:ring-offset-canvas"
                  />
                  <div className="space-y-0.5">
                    <div className="text-xs font-semibold text-text-primary">Zero-Shot Classification</div>
                    <div className="text-[10px] text-text-secondary leading-tight">Categorize into custom topics</div>
                  </div>
                </label>

                {/* Keyword Extraction */}
                <label className={`p-3 rounded-lg border flex items-start gap-3 cursor-pointer select-none transition-all col-span-1 sm:col-span-2 ${
                  selectedTasks.includes("keyword_extraction") 
                    ? "bg-accent-primary/5 border-accent-primary/45" 
                    : "bg-surface-raised border-border-default/80 hover:border-border-default"
                }`}>
                  <input
                    type="checkbox"
                    checked={selectedTasks.includes("keyword_extraction")}
                    onChange={() => handleTaskToggle("keyword_extraction")}
                    className="mt-1 h-3.5 w-3.5 rounded border-border-default accent-accent-primary text-accent-primary focus:ring-accent-primary focus:ring-offset-canvas"
                  />
                  <div className="space-y-0.5">
                    <div className="text-xs font-semibold text-text-primary">Keyword &amp; Keyphrase Extraction</div>
                    <div className="text-[10px] text-text-secondary leading-tight">Identify main concepts with semantic embeddings</div>
                  </div>
                </label>
              </div>
            </div>

            {/* Zero shot parameters input (Show only if classification selected) */}
            {selectedTasks.includes("classification") && (
              <div className="p-4 bg-surface-raised border border-border-default rounded-lg space-y-1.5">
                <label htmlFor="labelsInput" className="text-xs font-bold text-text-secondary uppercase tracking-wider block">
                  Custom Zero-Shot Candidate Labels
                </label>
                <input
                  id="labelsInput"
                  type="text"
                  value={candidateLabels}
                  onChange={(e) => setCandidateLabels(e.target.value)}
                  placeholder="technology, sports, entertainment"
                  className="w-full px-3 py-2 rounded-lg bg-surface border border-border-default text-xs text-text-primary focus:outline-none focus:border-accent-primary transition-colors"
                />
                <p className="text-[10px] text-text-secondary leading-tight">
                  Separate custom categories with commas. The model will score input text against these tags.
                </p>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleAnalyze}
                disabled={analyzing || inputText.length > 10000}
                className="flex-1 bg-accent-primary hover:bg-accent-hover text-white text-xs font-semibold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                {analyzing ? "Executing Pipelines..." : "Analyze Document"}
              </button>
              <button
                onClick={handleReset}
                disabled={analyzing}
                className="px-4 py-2.5 rounded-lg border border-border-default hover:bg-surface-raised text-text-secondary hover:text-text-primary transition-colors text-xs font-semibold flex items-center gap-2 disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Clear
              </button>
            </div>

            {analysisError && (
              <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg flex items-start gap-2.5 text-xs text-danger">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{analysisError}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Diagnostics & Connection Status */}
        <div className="space-y-4">
          {/* Health check statuses */}
          <div className="bg-surface border border-border-default rounded-xl p-5 space-y-4">
            <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Workspace Diagnostics
            </h4>
            <div className="space-y-3">
              {/* API Connection */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-secondary">API Status</span>
                {healthLoading ? (
                  <span className="text-text-secondary animate-pulse">Ping...</span>
                ) : apiHealth ? (
                  <span className="text-success font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-success" /> Connected
                  </span>
                ) : (
                  <span className="text-danger font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-danger" /> Offline
                  </span>
                )}
              </div>

              {/* Database status */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-secondary">DB Status</span>
                {healthLoading ? (
                  <span className="text-text-secondary animate-pulse">Ping...</span>
                ) : dbHealth?.healthy ? (
                  <span className="text-success font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-success" /> Active
                  </span>
                ) : (
                  <span className="text-warning font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-warning" /> Offline
                  </span>
                )}
              </div>

              {/* Character Limit */}
              <div className="flex items-center justify-between text-xs border-t border-border-default/45 pt-3">
                <span className="text-text-secondary">Character Limit</span>
                <span className="text-text-primary font-mono">10,000 max</span>
              </div>

              {/* CPU mode constraint */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-secondary">Inference Target</span>
                <span className="text-text-primary font-mono">CPU Execution</span>
              </div>
            </div>
          </div>

          {/* Workflow stubs navigation */}
          <div className="bg-surface border border-border-default rounded-xl p-5 space-y-3 text-xs">
            <h4 className="font-semibold text-text-secondary uppercase tracking-wider">
              Document Workspace
            </h4>
            <div className="space-y-2.5">
              <Link href="/search" className="flex items-center justify-between text-text-secondary hover:text-text-primary transition-colors group">
                <span className="flex items-center gap-2">
                  <Search className="w-3.5 h-3.5" /> Semantic Search / QA
                </span>
                <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
              <Link href="/benchmarks" className="flex items-center justify-between text-text-secondary hover:text-text-primary transition-colors group">
                <span className="flex items-center gap-2">
                  <BarChart3 className="w-3.5 h-3.5" /> Model Benchmarks
                </span>
                <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Results View Section */}
      {(analyzing || analysisResults) && (
        <div className="w-full space-y-6">
          <div className="flex items-center justify-between border-b border-border-default pb-3">
            <h2 className="text-lg font-semibold text-text-primary">Analysis Results</h2>
            {analysisMeta && (
              <span className="text-xs text-text-secondary font-mono">
                Total pipeline latency: {analysisMeta.latency_ms.toFixed(1)} ms
              </span>
            )}
          </div>

          {/* Loader Pulses */}
          {analyzing && (
            <div className="space-y-4">
              {selectedTasks.map((task) => (
                <div key={task} className="bg-surface border border-border-default rounded-xl p-5 space-y-4 animate-pulse">
                  <div className="h-4 bg-surface-raised rounded w-1/4" />
                  <div className="space-y-2">
                    <div className="h-3 bg-surface-raised rounded w-full" />
                    <div className="h-3 bg-surface-raised rounded w-5/6" />
                    <div className="h-3 bg-surface-raised rounded w-4/5" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Render Result Cards */}
          {analysisResults && (
            <div className="space-y-4">
              
              {/* Autopush/Save notification */}
              {token && analysisMeta?.extra?.analysis_id && (
                <div className="p-3 bg-success/5 border border-success/20 rounded-xl text-xs text-success flex justify-between items-center">
                  <span>Run succeeded and has been persisted in your history.</span>
                  <Link href="/analyze" className="font-semibold underline flex items-center gap-1">
                    View History List <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
              )}

              {/* Summarization Card */}
              {analysisResults.summarization && (
                <TaskResultCard
                  title="Summarization"
                  modelId={analysisMeta?.extra?.model_ids?.summarization || "summarization-interim"}
                  latencyMs={analysisMeta?.extra?.latencies_ms?.summarization || 0}
                >
                  <div className="relative group/card">
                    <SummaryView
                      summaryText={analysisResults.summarization.summary_text}
                      originalText={inputText}
                    />
                    {/* Floating card tools */}
                    <div className="absolute top-0 right-0 flex items-center gap-1.5 opacity-0 group-hover/card:opacity-100 transition-opacity">
                      <button
                        onClick={() => copyToClipboard("summarization", analysisResults.summarization.summary_text)}
                        className="p-1.5 rounded hover:bg-surface-raised border border-border-default text-text-secondary hover:text-text-primary transition-colors"
                        title="Copy Summary"
                      >
                        {copiedTask === "summarization" ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => downloadJson("summarization", analysisResults.summarization)}
                        className="p-1.5 rounded hover:bg-surface-raised border border-border-default text-text-secondary hover:text-text-primary transition-colors"
                        title="Download JSON"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </TaskResultCard>
              )}

              {/* Sentiment Card */}
              {analysisResults.sentiment && (
                <TaskResultCard
                  title="Sentiment Analysis"
                  modelId={analysisMeta?.extra?.model_ids?.sentiment || "sentiment-interim"}
                  latencyMs={analysisMeta?.extra?.latencies_ms?.sentiment || 0}
                  confidence={analysisResults.sentiment.score}
                >
                  <div className="relative group/card flex justify-between items-center">
                    <SentimentBadge
                      label={analysisResults.sentiment.label}
                      score={analysisResults.sentiment.score}
                    />
                    <div className="flex items-center gap-1.5 opacity-0 group-hover/card:opacity-100 transition-opacity">
                      <button
                        onClick={() => copyToClipboard("sentiment", JSON.stringify(analysisResults.sentiment, null, 2))}
                        className="p-1.5 rounded hover:bg-surface-raised border border-border-default text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                        title="Copy Sentiment JSON"
                      >
                        {copiedTask === "sentiment" ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => downloadJson("sentiment", analysisResults.sentiment)}
                        className="p-1.5 rounded hover:bg-surface-raised border border-border-default text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                        title="Download JSON"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </TaskResultCard>
              )}

              {/* NER Card */}
              {analysisResults.ner && (
                <TaskResultCard
                  title="Named Entity Recognition (NER)"
                  modelId={analysisMeta?.extra?.model_ids?.ner || "ner-interim"}
                  latencyMs={analysisMeta?.extra?.latencies_ms?.ner || 0}
                >
                  <div className="relative group/card space-y-3">
                    <NerHighlightView
                      text={inputText}
                      entities={analysisResults.ner.entities}
                    />
                    <div className="absolute top-0 right-0 flex items-center gap-1.5 opacity-0 group-hover/card:opacity-100 transition-opacity">
                      <button
                        onClick={() => copyToClipboard("ner", JSON.stringify(analysisResults.ner, null, 2))}
                        className="p-1.5 rounded hover:bg-surface-raised border border-border-default text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                        title="Copy Entity JSON"
                      >
                        {copiedTask === "ner" ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => downloadJson("ner", analysisResults.ner)}
                        className="p-1.5 rounded hover:bg-surface-raised border border-border-default text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                        title="Download JSON"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </TaskResultCard>
              )}

              {/* Classification Card */}
              {analysisResults.classification && (
                <TaskResultCard
                  title="Zero-Shot Classification"
                  modelId={analysisMeta?.extra?.model_ids?.classification || "classification-interim"}
                  latencyMs={analysisMeta?.extra?.latencies_ms?.classification || 0}
                  confidence={analysisResults.classification.predictions[0]?.score}
                >
                  <div className="relative group/card space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-surface rounded-lg border border-border-default/50">
                      {analysisResults.classification.predictions.map((pred: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center text-xs">
                          <span className="font-semibold text-text-primary capitalize">{pred.label}</span>
                          <span className="font-mono text-text-secondary">{Math.round(pred.score * 100)}%</span>
                        </div>
                      ))}
                    </div>
                    
                    <div className="absolute top-0 right-0 flex items-center gap-1.5 opacity-0 group-hover/card:opacity-100 transition-opacity">
                      <button
                        onClick={() => copyToClipboard("classification", JSON.stringify(analysisResults.classification, null, 2))}
                        className="p-1.5 rounded hover:bg-surface-raised border border-border-default text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                        title="Copy Classification JSON"
                      >
                        {copiedTask === "classification" ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => downloadJson("classification", analysisResults.classification)}
                        className="p-1.5 rounded hover:bg-surface-raised border border-border-default text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                        title="Download JSON"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </TaskResultCard>
              )}

              {/* Keywords Card */}
              {analysisResults.keyword_extraction && (
                <TaskResultCard
                  title="Keyword &amp; Keyphrase Extraction"
                  modelId={analysisMeta?.extra?.model_ids?.keyword_extraction || "keyword_extraction-interim"}
                  latencyMs={analysisMeta?.extra?.latencies_ms?.keyword_extraction || 0}
                >
                  <div className="relative group/card space-y-3">
                    <div className="flex flex-wrap gap-2 p-4 bg-surface rounded-lg border border-border-default/50">
                      {analysisResults.keyword_extraction.keywords.map((kw: any, idx: number) => (
                        <div 
                          key={idx} 
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-info/10 border border-info/20 text-xs text-info"
                          title={`Relevance: ${(kw.score * 100).toFixed(1)}%`}
                        >
                          <span className="font-semibold">{kw.keyword}</span>
                          <span className="text-[9px] opacity-75 font-mono">{(kw.score).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="absolute top-0 right-0 flex items-center gap-1.5 opacity-0 group-hover/card:opacity-100 transition-opacity">
                      <button
                        onClick={() => copyToClipboard("keyword_extraction", JSON.stringify(analysisResults.keyword_extraction, null, 2))}
                        className="p-1.5 rounded hover:bg-surface-raised border border-border-default text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                        title="Copy Keywords JSON"
                      >
                        {copiedTask === "keyword_extraction" ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => downloadJson("keyword_extraction", analysisResults.keyword_extraction)}
                        className="p-1.5 rounded hover:bg-surface-raised border border-border-default text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                        title="Download JSON"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </TaskResultCard>
              )}

            </div>
          )}
        </div>
      )}
    </main>
  );
}
