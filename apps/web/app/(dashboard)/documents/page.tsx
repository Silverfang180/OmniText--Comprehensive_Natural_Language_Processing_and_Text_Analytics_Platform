"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  FolderOpen,
  Plus,
  Trash2,
  Upload,
  Calendar,
  AlertCircle,
  FileCode,
  CheckCircle,
  Loader,
  RefreshCw,
  FolderMinus,
  Sparkles,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface DocumentItem {
  id: number;
  dataset_id: number;
  filename: string;
  content_type: string;
  file_size: number;
  status: string; // pending, processing, completed, failed
  created_at: string;
}

interface DatasetItem {
  id: number;
  name: string;
  user_id: number;
  created_at: string;
}

export default function DatasetDocumentsPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);

  // Datasets State
  const [datasets, setDatasets] = useState<DatasetItem[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<DatasetItem | null>(null);
  const [datasetDocs, setDatasetDocs] = useState<DocumentItem[]>([]);
  
  // Loading and Error States
  const [loadingDatasets, setLoadingDatasets] = useState<boolean>(true);
  const [loadingDocs, setLoadingDocs] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Modal / Inputs State
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newDatasetName, setNewDatasetName] = useState<string>("");
  const [isCreatingDataset, setIsCreatingDataset] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Resolve Auth Token
  useEffect(() => {
    const storedToken = localStorage.getItem("omnitext_token");
    if (!storedToken) {
      router.push("/login");
    } else {
      setToken(storedToken);
      fetchDatasets(storedToken);
    }
  }, []);

  // Poll processing documents if any exist in the list
  useEffect(() => {
    if (!token || !selectedDataset || datasetDocs.length === 0) return;

    const hasProcessing = datasetDocs.some(
      (doc) => doc.status === "pending" || doc.status === "processing"
    );

    if (!hasProcessing) return;

    // Poll every 3 seconds
    const interval = setInterval(() => {
      fetchDatasetDocs(token, selectedDataset.id, false);
    }, 3000);

    return () => clearInterval(interval);
  }, [token, selectedDataset, datasetDocs]);

  // Actions
  const fetchDatasets = async (authToken: string) => {
    try {
      setLoadingDatasets(true);
      setError(null);
      const res = await apiClient<DatasetItem[]>("/api/v1/documents/datasets", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      setDatasets(res.data || []);
      
      // Auto-select first dataset if none selected
      if (res.data && res.data.length > 0 && !selectedDataset) {
        setSelectedDataset(res.data[0]);
        fetchDatasetDocs(authToken, res.data[0].id, true);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load datasets.");
    } finally {
      setLoadingDatasets(false);
    }
  };

  const fetchDatasetDocs = async (authToken: string, datasetId: number, showLoading = true) => {
    try {
      if (showLoading) setLoadingDocs(true);
      setUploadError(null);
      const res = await apiClient<{ id: number; name: string; documents: DocumentItem[] }>(
        `/api/v1/documents/datasets/${datasetId}`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );
      if (res.data) {
        setDatasetDocs(res.data.documents || []);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load dataset details.");
    } finally {
      if (showLoading) setLoadingDocs(false);
    }
  };

  const handleDatasetSelect = (dataset: DatasetItem) => {
    setSelectedDataset(dataset);
    setDatasetDocs([]);
    if (token) {
      fetchDatasetDocs(token, dataset.id, true);
    }
  };

  const handleCreateDataset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newDatasetName.trim()) return;

    try {
      setIsCreatingDataset(true);
      setError(null);
      const res = await apiClient<DatasetItem>("/api/v1/documents/datasets", {
        method: "POST",
        body: JSON.stringify({ name: newDatasetName }),
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.data) {
        setDatasets((prev) => [res.data!, ...prev]);
        setSelectedDataset(res.data);
        setNewDatasetName("");
        setShowCreateModal(false);
        fetchDatasetDocs(token, res.data.id, true);
      }
    } catch (err: any) {
      setError(err.message || "Failed to create dataset.");
    } finally {
      setIsCreatingDataset(false);
    }
  };

  const handleDeleteDataset = async (datasetId: number) => {
    if (!token) return;
    if (!confirm("Are you sure you want to delete this dataset? This will permanently delete all its documents and vectors.")) return;

    try {
      setError(null);
      await apiClient(`/api/v1/documents/datasets/${datasetId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const updated = datasets.filter((ds) => ds.id !== datasetId);
      setDatasets(updated);

      if (selectedDataset?.id === datasetId) {
        if (updated.length > 0) {
          setSelectedDataset(updated[0]);
          fetchDatasetDocs(token, updated[0].id, true);
        } else {
          setSelectedDataset(null);
          setDatasetDocs([]);
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to delete dataset.");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !token || !selectedDataset) return;

    const file = files[0];
    setUploadError(null);

    // Validate size limit (25MB)
    const MAX_SIZE = 25 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setUploadError("File exceeds the maximum limit of 25MB.");
      return;
    }

    // Validate extension
    const ext = file.name.split(".").pop()?.toLowerCase();
    const supported = ["txt", "pdf", "docx", "csv"];
    if (!ext || !supported.includes(ext)) {
      setUploadError("Unsupported file type. Please upload a .txt, .pdf, .docx, or .csv file.");
      return;
    }

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append("file", file);

      await apiClient(`/api/v1/documents/datasets/${selectedDataset.id}/upload`, {
        method: "POST",
        body: formData,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Refresh list immediately
      fetchDatasetDocs(token, selectedDataset.id, false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: any) {
      setUploadError(err.message || "Failed to upload document.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteDocument = async (documentId: number) => {
    if (!token || !selectedDataset) return;

    try {
      await apiClient(`/api/v1/documents/datasets/${selectedDataset.id}/documents/${documentId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setDatasetDocs((prev) => prev.filter((doc) => doc.id !== documentId));
    } catch (err: any) {
      setUploadError(err.message || "Failed to delete document.");
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-warning/10 text-warning animate-pulse">
            <Loader className="w-3 h-3 animate-spin" /> Pending
          </span>
        );
      case "processing":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-info/10 text-info">
            <Loader className="w-3 h-3 animate-spin" /> Ingesting
          </span>
        );
      case "completed":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-success/10 text-success">
            <CheckCircle className="w-3 h-3" /> Ready
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-danger/10 text-danger">
            <AlertCircle className="w-3 h-3" /> Error
          </span>
        );
      default:
        return null;
    }
  };

  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader className="w-8 h-8 text-accent-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-dashboard mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex flex-col md:flex-row items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-serif font-semibold text-text-primary mb-2">Datasets &amp; Documents</h1>
          <p className="text-sm text-text-secondary">
            Manage multi-format documents, partition vector spaces, and build semantic retrieval datasets.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-accent-primary hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Create Dataset
        </button>
      </div>

      {error && (
        <div className="p-4 bg-danger/10 border border-danger/30 rounded-lg text-sm text-danger flex items-center gap-2 mb-6">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Pane - Datasets List */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-surface border border-border-default rounded-xl p-4">
            <h2 className="text-sm font-semibold text-text-secondary mb-4 uppercase tracking-wider">
              Your Datasets
            </h2>
            {loadingDatasets ? (
              <div className="py-8 flex items-center justify-center">
                <Loader className="w-6 h-6 text-accent-primary animate-spin" />
              </div>
            ) : datasets.length === 0 ? (
              <div className="text-center py-10 px-4">
                <FolderMinus className="w-8 h-8 text-text-secondary/50 mx-auto mb-2" />
                <p className="text-sm text-text-secondary">No datasets found.</p>
                <p className="text-xs text-text-secondary/70 mt-1">Create one to start uploading.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {datasets.map((dataset) => (
                  <div
                    key={dataset.id}
                    onClick={() => handleDatasetSelect(dataset)}
                    className={`group w-full flex items-center justify-between p-3 rounded-lg border text-left cursor-pointer transition ${
                      selectedDataset?.id === dataset.id
                        ? "bg-accent-primary/5 border-accent-primary text-accent-primary"
                        : "bg-muted/30 border-border-default/60 hover:border-border-default text-text-primary"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <FolderOpen className={`w-4 h-4 flex-shrink-0 ${
                        selectedDataset?.id === dataset.id ? "text-accent-primary" : "text-text-secondary"
                      }`} />
                      <span className="text-sm font-medium truncate">{dataset.name}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteDataset(dataset.id);
                      }}
                      className="text-text-secondary hover:text-danger p-1 rounded opacity-0 group-hover:opacity-100 focus:opacity-100 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Pane - Dataset Details & Upload */}
        <div className="lg:col-span-8">
          {selectedDataset ? (
            <div className="bg-surface border border-border-default rounded-xl p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-border-default pb-4">
                <div>
                  <h3 className="text-xl font-semibold text-text-primary">{selectedDataset.name}</h3>
                  <div className="flex items-center gap-1.5 text-xs text-text-secondary mt-1">
                    <Calendar className="w-3.5 h-3.5" /> Created on{" "}
                    {new Date(selectedDataset.created_at).toLocaleDateString()}
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteDataset(selectedDataset.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-danger/30 text-danger hover:bg-danger/5 rounded-lg text-xs font-medium transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete Dataset
                </button>
              </div>

              {/* Upload Section */}
              <div>
                <h4 className="text-sm font-semibold text-text-primary mb-3">Upload Documents</h4>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed border-border-default hover:border-accent-primary/50 rounded-xl p-8 text-center cursor-pointer transition bg-muted/20 flex flex-col items-center justify-center gap-3 ${
                    isUploading ? "pointer-events-none opacity-60" : ""
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".txt,.pdf,.docx,.csv"
                    className="hidden"
                  />
                  {isUploading ? (
                    <>
                      <Loader className="w-8 h-8 text-accent-primary animate-spin" />
                      <p className="text-sm font-medium text-text-primary">Uploading and scheduling...</p>
                    </>
                  ) : (
                    <>
                      <div className="w-10 h-10 rounded-full bg-accent-primary/10 flex items-center justify-center text-accent-primary">
                        <Upload className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-text-primary">
                          Click to upload or drag &amp; drop
                        </p>
                        <p className="text-xs text-text-secondary mt-1">
                          TXT, PDF, DOCX, CSV up to 25MB
                        </p>
                      </div>
                    </>
                  )}
                </div>
                {uploadError && (
                  <div className="p-3 bg-danger/10 border border-danger/20 text-danger text-xs rounded-lg flex items-center gap-1.5 mt-2">
                    <AlertCircle className="w-4 h-4" />
                    <span>{uploadError}</span>
                  </div>
                )}
              </div>

              {/* Documents List */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-text-primary">Documents ({datasetDocs.length})</h4>
                  {datasetDocs.some(doc => doc.status === "pending" || doc.status === "processing") && (
                    <span className="flex items-center gap-1 text-xs text-accent-primary font-medium animate-pulse">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Processing status...
                    </span>
                  )}
                </div>

                {loadingDocs ? (
                  <div className="py-12 flex items-center justify-center">
                    <Loader className="w-6 h-6 text-accent-primary animate-spin" />
                  </div>
                ) : datasetDocs.length === 0 ? (
                  <div className="text-center py-12 border border-border-default/60 rounded-xl bg-muted/20">
                    <FileText className="w-8 h-8 text-text-secondary/40 mx-auto mb-2" />
                    <p className="text-sm text-text-secondary">No files in this dataset.</p>
                    <p className="text-xs text-text-secondary/70 mt-0.5">Upload a document above to begin ingestion.</p>
                  </div>
                ) : (
                  <div className="border border-border-default rounded-lg divide-y divide-border-default overflow-hidden">
                    {datasetDocs.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-4 bg-surface hover:bg-muted/10 transition"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-8 h-8 rounded bg-text-secondary/10 flex items-center justify-center text-text-secondary flex-shrink-0">
                            <FileCode className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-text-primary truncate" title={doc.filename}>
                              {doc.filename}
                            </p>
                            <p className="text-xs text-text-secondary mt-0.5">
                              {formatBytes(doc.file_size)} • {doc.content_type.split(";")[0]}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 flex-shrink-0">
                          {getStatusBadge(doc.status)}
                          <button
                            onClick={() => handleDeleteDocument(doc.id)}
                            className="text-text-secondary hover:text-danger p-1 rounded transition cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-96 border-2 border-dashed border-border-default rounded-xl flex flex-col items-center justify-center text-center p-6 bg-muted/15">
              <FolderOpen className="w-12 h-12 text-text-secondary/30 mb-3 animate-pulse" />
              <h3 className="text-base font-semibold text-text-primary mb-1">No Dataset Selected</h3>
              <p className="text-sm text-text-secondary max-w-sm">
                Select an existing dataset on the left or create a new one to manage vector documents.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal - Create Dataset */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-surface border border-border-default rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-slideUp">
            <div className="p-6 border-b border-border-default flex items-center justify-between">
              <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-accent-primary" /> Create New Dataset
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-text-secondary hover:text-text-primary text-sm font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
            <form onSubmit={handleCreateDataset} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
                  Dataset Name
                </label>
                <input
                  type="text"
                  required
                  value={newDatasetName}
                  onChange={(e) => setNewDatasetName(e.target.value)}
                  placeholder="e.g. Finance Reports 2026"
                  className="w-full px-3 py-2 border border-border-default rounded-lg focus:outline-none focus:border-accent-primary bg-muted/10 text-text-primary text-sm transition"
                />
              </div>
              <button
                type="submit"
                disabled={isCreatingDataset || !newDatasetName.trim()}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-accent-primary hover:bg-accent-hover disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition cursor-pointer"
              >
                {isCreatingDataset ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" /> Creating...
                  </>
                ) : (
                  "Create Dataset"
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
