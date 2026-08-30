"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  TrendingUp,
  Sliders,
  Play,
  RotateCcw,
  CheckCircle,
  XCircle,
  HelpCircle,
  Cpu,
  Activity,
  Bookmark,
  Check,
  AlertCircle,
  Loader,
  ArrowRight,
  TrendingDown,
  ArrowLeft,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { EvidenceTag } from "@/components/nlp/EvidenceTag";

interface ExperimentModel {
  id: number;
  name: string;
  status: string;
  task: string;
  base_model_id: string;
  fine_tuned_model_id: string | null;
  hyperparameters: {
    learning_rate: number;
    epochs: number;
    batch_size: number;
  };
  metrics: Array<{
    epoch: number;
    loss: number;
    precision: number;
    recall: number;
    f1: number;
  }>;
  baseline_metrics: {
    precision: number;
    recall: number;
    f1: number;
  } | null;
  final_metrics: {
    precision: number;
    recall: number;
    f1: number;
  } | null;
  created_at: string;
  completed_at: string | null;
}

export default function ExperimentsPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);

  // Data states
  const [experiments, setExperiments] = useState<ExperimentModel[]>([]);
  const [selectedExperiment, setSelectedExperiment] = useState<ExperimentModel | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [formName, setFormName] = useState<string>("");
  const [formLR, setFormLR] = useState<number>(5e-5);
  const [formEpochs, setFormEpochs] = useState<number>(3);
  const [formBatchSize, setFormBatchSize] = useState<number>(16);
  const [isTriggering, setIsTriggering] = useState<boolean>(false);

  // Action states
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  useEffect(() => {
    const storedToken = localStorage.getItem("omnitext_token");
    if (!storedToken) {
      router.push("/login");
    } else {
      setToken(storedToken);
      fetchExperiments(storedToken);
    }
  }, []);

  const fetchExperiments = async (authToken: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient<ExperimentModel[]>("/api/v1/experiments", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.error) {
        setError(res.error.message);
      } else if (res.data) {
        const dataList = res.data;
        setExperiments(dataList);
        if (dataList.length > 0) {
          // Keep current selection or default to latest
          setSelectedExperiment((curr) => {
            if (curr) {
              const updated = dataList.find((e) => e.id === curr.id);
              return updated || dataList[0];
            }
            return dataList[0];
          });
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load experiments.");
    } finally {
      setLoading(false);
    }
  };

  // Poll running experiment status
  useEffect(() => {
    if (!token || !selectedExperiment) return;
    if (selectedExperiment.status !== "running" && selectedExperiment.status !== "pending") return;

    const intervalId = setInterval(async () => {
      try {
        const res = await apiClient<ExperimentModel[]>(`/api/v1/experiments`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data) {
          setExperiments(res.data);
          const updated = res.data.find((e) => e.id === selectedExperiment.id);
          if (updated) {
            setSelectedExperiment(updated);
            if (updated.status !== "running" && updated.status !== "pending") {
              clearInterval(intervalId);
            }
          }
        }
      } catch (err) {
        console.error("Error polling experiment", err);
      }
    }, 2000);

    return () => clearInterval(intervalId);
  }, [selectedExperiment, token]);

  const handleCreateExperiment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !formName.trim()) return;

    try {
      setIsTriggering(true);
      setError(null);

      const res = await apiClient<ExperimentModel>("/api/v1/experiments", {
        method: "POST",
        body: JSON.stringify({
          name: formName,
          base_model_id: "dslim/bert-base-NER",
          hyperparameters: {
            learning_rate: formLR,
            epochs: formEpochs,
            batch_size: formBatchSize,
          },
        }),
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.error) {
        setError(res.error.message);
      } else if (res.data) {
        setFormName("");
        // Refresh list
        await fetchExperiments(token);
        // Select the newly created experiment
        setSelectedExperiment(res.data);
      }
    } catch (err: any) {
      setError(err.message || "Failed to trigger fine-tuning experiment.");
    } finally {
      setIsTriggering(false);
    }
  };

  const handlePromote = async (id: number) => {
    if (!token) return;

    try {
      setActionLoading(true);
      setError(null);

      const res = await apiClient<any>(`/api/v1/experiments/${id}/promote`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.error) {
        setError(res.error.message);
      } else {
        await fetchExperiments(token);
      }
    } catch (err: any) {
      setError(err.message || "Failed to promote model.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (id: number) => {
    if (!token) return;

    try {
      setActionLoading(true);
      setError(null);

      const res = await apiClient<any>(`/api/v1/experiments/${id}/reject`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.error) {
        setError(res.error.message);
      } else {
        await fetchExperiments(token);
      }
    } catch (err: any) {
      setError(err.message || "Failed to reject model.");
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "promoted":
        return "text-success bg-success/15 border-success/30";
      case "completed":
        return "text-accent-primary bg-accent-primary/10 border-accent-primary/20";
      case "running":
        return "text-warning bg-warning/15 border-warning/30 animate-pulse";
      case "pending":
        return "text-text-secondary bg-muted border-border-default";
      case "rejected":
        return "text-danger bg-danger/10 border-danger/25";
      case "failed":
        return "text-danger bg-danger/20 border-danger/40";
      default:
        return "text-text-secondary bg-surface";
    }
  };

  return (
    <div className="max-w-dashboard mx-auto px-4 sm:px-6 lg:px-8 py-10">
{/* Header Panel */}
      <div className="border-b border-border-default pb-6 mb-8">
        <h1 className="text-3xl font-serif font-semibold text-text-primary mb-2">NER Fine-Tuning & Experiments</h1>
        <p className="text-sm text-text-secondary max-w-3xl">
          Train custom Named Entity Recognition model variants on your own dataset slices, review epoch loss metrics, evaluate performance compared directly to baseline hub weights, and promote model configurations to your active registry.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-danger/10 border border-danger/30 rounded-lg text-sm text-danger flex items-center gap-2 mb-6">
          <XCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Side: Configure Form + History List */}
        <div className="lg:col-span-4 space-y-6">
          {/* Configure Panel */}
          <div className="bg-surface border border-border-default rounded-xl p-5">
            <h3 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-accent-primary" />
              Configure Fine-Tune Run
            </h3>

            <form onSubmit={handleCreateExperiment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                  Experiment Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Medical-NER-v1"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full text-sm bg-surface border border-border-default rounded-lg px-3 py-2 text-text-primary focus:outline-none focus:border-accent-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                  Base Pretrained Model
                </label>
                <select
                  disabled
                  className="w-full text-sm bg-muted/40 border border-border-default rounded-lg px-3 py-2 text-text-secondary focus:outline-none"
                >
                  <option>dslim/bert-base-NER</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-text-secondary mb-1">
                    LR
                  </label>
                  <select
                    value={formLR}
                    onChange={(e) => setFormLR(parseFloat(e.target.value))}
                    className="w-full text-xs bg-surface border border-border-default rounded-lg px-2 py-1.5 text-text-primary focus:outline-none"
                  >
                    <option value={5e-5}>5e-5</option>
                    <option value={3e-5}>3e-5</option>
                    <option value={2e-5}>2e-5</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-text-secondary mb-1">
                    Epochs
                  </label>
                  <select
                    value={formEpochs}
                    onChange={(e) => setFormEpochs(parseInt(e.target.value))}
                    className="w-full text-xs bg-surface border border-border-default rounded-lg px-2 py-1.5 text-text-primary focus:outline-none"
                  >
                    <option value={3}>3</option>
                    <option value={5}>5</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-text-secondary mb-1">
                    Batch
                  </label>
                  <select
                    value={formBatchSize}
                    onChange={(e) => setFormBatchSize(parseInt(e.target.value))}
                    className="w-full text-xs bg-surface border border-border-default rounded-lg px-2 py-1.5 text-text-primary focus:outline-none"
                  >
                    <option value={16}>16</option>
                    <option value={32}>32</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={isTriggering || !formName.trim()}
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-accent-primary hover:bg-accent-hover disabled:bg-accent-primary/50 text-white rounded-lg text-sm font-semibold transition mt-2 cursor-pointer"
              >
                {isTriggering ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                Launch Fine-Tune
              </button>
            </form>
          </div>

          {/* History Panel */}
          <div className="bg-surface border border-border-default rounded-xl overflow-hidden">
            <div className="p-4 border-b border-border-default/60">
              <h3 className="text-sm font-bold text-text-primary">Fine-Tuning History</h3>
            </div>

            <div className="divide-y divide-border-default/60 max-h-[380px] overflow-y-auto">
              {loading && experiments.length === 0 ? (
                <div className="p-6 text-center text-xs text-text-secondary flex justify-center items-center gap-2">
                  <Loader className="w-4 h-4 animate-spin" /> Loading...
                </div>
              ) : experiments.length === 0 ? (
                <div className="p-8 text-center text-xs text-text-secondary">
                  No experiments triggered yet. Run one above to get started!
                </div>
              ) : (
                experiments.map((exp) => (
                  <button
                    key={exp.id}
                    onClick={() => setSelectedExperiment(exp)}
                    className={`w-full text-left p-4 hover:bg-muted/10 transition flex items-center justify-between gap-3 ${
                      selectedExperiment?.id === exp.id ? "bg-muted/20 border-l-2 border-accent-primary" : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <span className="font-semibold text-xs text-text-primary block truncate mb-1">
                        {exp.name}
                      </span>
                      <span className="text-[10px] text-text-secondary block">
                        {new Date(exp.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex flex-col items-end gap-1.5">
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded border ${getStatusStyle(
                          exp.status
                        )}`}
                      >
                        {exp.status}
                      </span>
                      {exp.final_metrics && (
                        <span className="text-[10px] font-semibold text-text-primary">
                          F1: {Math.round(exp.final_metrics.f1 * 100)}%
                        </span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Experiment details, charts, metrics comparison */}
        <div className="lg:col-span-8">
          {!selectedExperiment ? (
            <div className="bg-surface border border-border-default rounded-xl p-12 text-center">
              <Activity className="w-12 h-12 text-text-secondary/40 mx-auto mb-4" />
              <h3 className="text-base font-bold text-text-primary mb-2">No Experiment Selected</h3>
              <p className="text-xs text-text-secondary max-w-sm mx-auto">
                Configure hyperparameters and click Launch above, or select an existing fine-tune run from the history to view its evaluation logs.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Detail Header Info */}
              <div className="bg-surface border border-border-default rounded-xl p-6">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border-default/50 pb-4 mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-text-primary">{selectedExperiment.name}</h2>
                    <p className="text-xs text-text-secondary mt-1">
                      ID: <span className="font-mono">{selectedExperiment.id}</span> · Base Model:{" "}
                      <span className="font-mono text-accent-primary select-all">{selectedExperiment.base_model_id}</span>
                    </p>
                  </div>

                  <span
                    className={`text-xs font-bold px-3 py-1 rounded-full border ${getStatusStyle(
                      selectedExperiment.status
                    )}`}
                  >
                    {selectedExperiment.status}
                  </span>
                </div>

                {/* Hyperparameters Config grid */}
                <div className="grid grid-cols-3 gap-4 bg-muted/10 border border-border-default/50 p-4 rounded-xl">
                  <div>
                    <span className="text-[10px] text-text-secondary font-semibold uppercase block mb-1">
                      Learning Rate
                    </span>
                    <span className="font-mono font-bold text-sm text-text-primary">
                      {selectedExperiment.hyperparameters.learning_rate}
                    </span>
                  </div>

                  <div className="border-x border-border-default/50 px-4">
                    <span className="text-[10px] text-text-secondary font-semibold uppercase block mb-1">
                      Training Epochs
                    </span>
                    <span className="font-mono font-bold text-sm text-text-primary">
                      {selectedExperiment.hyperparameters.epochs}
                    </span>
                  </div>

                  <div className="px-2">
                    <span className="text-[10px] text-text-secondary font-semibold uppercase block mb-1">
                      Batch Size
                    </span>
                    <span className="font-mono font-bold text-sm text-text-primary">
                      {selectedExperiment.hyperparameters.batch_size}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status checks for running or pending states */}
              {(selectedExperiment.status === "running" || selectedExperiment.status === "pending") && (
                <div className="bg-surface border border-border-default rounded-xl p-8 text-center">
                  <Loader className="w-8 h-8 text-accent-primary animate-spin mx-auto mb-4" />
                  <h3 className="text-sm font-bold text-text-primary mb-1">
                    Fine-Tuning In Progress
                  </h3>
                  <p className="text-xs text-text-secondary max-w-md mx-auto mb-4">
                    The background worker is currently evaluating baseline weights and running simulated epochs. Epoch progress metrics will stream in below in real-time.
                  </p>
                  {selectedExperiment.metrics.length > 0 && (
                    <div className="w-full max-w-sm mx-auto bg-muted/20 border border-border-default/60 rounded-lg p-3 text-left">
                      <span className="text-[10px] font-bold text-text-secondary uppercase">
                        Current Progress:
                      </span>
                      <div className="flex items-center justify-between text-xs text-text-primary font-bold mt-1.5">
                        <span>Epoch {selectedExperiment.metrics.length}/3</span>
                        <span>Loss: {selectedExperiment.metrics[selectedExperiment.metrics.length - 1].loss}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Completed or Promoted details */}
              {selectedExperiment.status !== "running" && selectedExperiment.status !== "pending" && (
                <>
                  {/* Baseline vs Fine-Tuned Metrics Comparison */}
                  {selectedExperiment.baseline_metrics && selectedExperiment.final_metrics && (
                    <div className="bg-surface border border-border-default rounded-xl p-6">
                      <h3 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-success" />
                        Baseline vs Fine-Tuned Performance
                      </h3>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-border-default/60 text-text-secondary font-semibold">
                              <th className="py-2.5">Evaluation Metric</th>
                              <th className="py-2.5 text-right">Baseline Model</th>
                              <th className="py-2.5 text-right font-bold">Fine-Tuned Model</th>
                              <th className="py-2.5 text-right">Relative Improvement</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border-default/40 text-text-primary">
                            <tr>
                              <td className="py-3 font-semibold">NER F1-Score (seqeval)</td>
                              <td className="py-3 text-right">
                                <EvidenceTag label={`${Math.round(selectedExperiment.baseline_metrics.f1 * 100)}%`} />
                              </td>
                              <td className="py-3 text-right">
                                <span className="font-mono text-xs font-bold text-success">
                                  {Math.round(selectedExperiment.final_metrics.f1 * 100)}%
                                </span>
                              </td>
                              <td className="py-3 text-right">
                                <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-success">
                                  <TrendingUp className="w-3 h-3" />
                                  +{Math.round((selectedExperiment.final_metrics.f1 - selectedExperiment.baseline_metrics.f1) * 100)}%
                                </span>
                              </td>
                            </tr>
                            <tr>
                              <td className="py-3 font-semibold">Precision</td>
                              <td className="py-3 text-right">
                                <EvidenceTag label={`${Math.round(selectedExperiment.baseline_metrics.precision * 100)}%`} />
                              </td>
                              <td className="py-3 text-right">
                                <span className="font-mono text-xs font-bold text-success">
                                  {Math.round(selectedExperiment.final_metrics.precision * 100)}%
                                </span>
                              </td>
                              <td className="py-3 text-right">
                                <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-success">
                                  <TrendingUp className="w-3 h-3" />
                                  +{Math.round((selectedExperiment.final_metrics.precision - selectedExperiment.baseline_metrics.precision) * 100)}%
                                </span>
                              </td>
                            </tr>
                            <tr>
                              <td className="py-3 font-semibold">Recall</td>
                              <td className="py-3 text-right">
                                <EvidenceTag label={`${Math.round(selectedExperiment.baseline_metrics.recall * 100)}%`} />
                              </td>
                              <td className="py-3 text-right">
                                <span className="font-mono text-xs font-bold text-success">
                                  {Math.round(selectedExperiment.final_metrics.recall * 100)}%
                                </span>
                              </td>
                              <td className="py-3 text-right">
                                <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-success">
                                  <TrendingUp className="w-3 h-3" />
                                  +{Math.round((selectedExperiment.final_metrics.recall - selectedExperiment.baseline_metrics.recall) * 100)}%
                                </span>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Epoch metrics logs + simple SVG chart */}
                  {selectedExperiment.metrics.length > 0 && (
                    <div className="bg-surface border border-border-default rounded-xl p-6">
                      <h3 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-accent-primary" />
                        Training Epoch Logs
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                        {/* Epoch Table */}
                        <div className="border border-border-default/60 rounded-xl overflow-hidden">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead className="bg-muted/20">
                              <tr className="border-b border-border-default/60 text-text-secondary">
                                <th className="p-3">Epoch</th>
                                <th className="p-3 text-right">Training Loss</th>
                                <th className="p-3 text-right">Eval F1</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border-default/40">
                              {selectedExperiment.metrics.map((log) => (
                                <tr key={log.epoch}>
                                  <td className="p-3 font-semibold">Epoch {log.epoch}</td>
                                  <td className="p-3 text-right">
                                    <EvidenceTag label={log.loss.toFixed(4)} />
                                  </td>
                                  <td className="p-3 text-right font-mono font-bold text-accent-primary">
                                    {Math.round(log.f1 * 100)}%
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* SVG progression chart */}
                        <div className="border border-border-default/60 rounded-xl p-4 flex flex-col items-center justify-center">
                          <span className="text-[10px] font-bold text-text-secondary uppercase mb-3">
                            Loss Metric Progression Trend
                          </span>
                          
                          {/* Render visual progression blocks for training loss */}
                          <div className="w-full max-w-xs space-y-3">
                            {selectedExperiment.metrics.map((log, index) => {
                              const pct = Math.round((log.loss / 0.5) * 100);
                              return (
                                <div key={log.epoch} className="text-xs">
                                  <div className="flex items-center justify-between text-text-primary font-semibold mb-1">
                                    <span>Epoch {log.epoch}</span>
                                    <span className="font-mono text-[11px] text-text-secondary">Loss: {log.loss}</span>
                                  </div>
                                  <div className="w-full bg-muted/20 border border-border-default/60 h-2 rounded-full overflow-hidden">
                                    <div
                                      style={{ width: `${pct}%` }}
                                      className="bg-accent-primary h-full rounded-full transition-all duration-500"
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Actions promotion footer */}
                  {selectedExperiment.status === "completed" && (
                    <div className="bg-surface border border-border-default rounded-xl p-6 flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <h4 className="text-xs font-bold text-text-primary uppercase tracking-wide">
                          Model Promotion Actions
                        </h4>
                        <p className="text-xs text-text-secondary mt-1">
                          Promoting overrides your active NER model. Rejecting archives the checkpoints as rejected.
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleReject(selectedExperiment.id)}
                          disabled={actionLoading}
                          className="inline-flex items-center gap-1 text-xs font-bold text-danger border border-danger/25 hover:border-danger bg-danger/5 hover:bg-danger/10 px-4 py-2 rounded-lg transition cursor-pointer"
                        >
                          <XCircle className="w-4 h-4" /> Reject Run
                        </button>

                        <button
                          onClick={() => handlePromote(selectedExperiment.id)}
                          disabled={actionLoading}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-accent-primary hover:bg-accent-hover px-4 py-2 rounded-lg transition cursor-pointer"
                        >
                          {actionLoading ? (
                            <Loader className="w-4 h-4 animate-spin" />
                          ) : (
                            <TrendingUp className="w-4 h-4" />
                          )}
                          Promote to Active
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
