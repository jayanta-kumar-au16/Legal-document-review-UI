 "use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, AlertCircle, ArrowDownToLine, ArrowRight, BadgeCheck, Bell, BookOpen,
  Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clock3,
  FileCheck2, FileText, Filter, FolderOpen, Gavel, Info, LayoutDashboard, LoaderCircle,
  MessageSquare, MoreHorizontal, PanelLeftClose, Plus, Search, Settings2, ShieldCheck,
  SlidersHorizontal, Sparkles, UploadCloud, X, XCircle
} from "lucide-react";

type Outcome = "pass" | "deviation" | "review_required" | "not_applicable" | "unable_to_evaluate";
type ReviewStatus = "pending" | "accepted" | "dismissed";
type Finding = {
  finding_id: string; rule_id: string; clause_type: string; finding_type: string;
  severity: "high" | "medium" | "low"; description: string; evidence: string;
  page?: number; section?: string; verified?: boolean; reason: string; suggested_action: string;
  confidence: string; status: ReviewStatus; review_comment?: string | null;
};
type Clause = { clause_type: string; status: string; summary: string; evidence: string; page?: number; section?: string };
type Review = {
  document_id: string; file_name?: string; playbook_id: string; playbook_version: string;
  status?: string; clauses: Clause[]; rule_results: { rule_id: string; clause_type: string; outcome: Outcome; reason: string }[];
  findings: Finding[]; warnings?: string[];
};
const initialReview: Review = { document_id: "", file_name: "", playbook_id: "", playbook_version: "", clauses: [], rule_results: [], findings: [] };
type Evidence = { excerpt: string; source: { page: number | null; section: string | null }; verified: boolean };
type Report = { metadata: { review_id: string; document_id: string; file_name: string; playbook_id: string; playbook_version: string; status: string }; clauses: { clause_type: string; status: string; summary: string | null; evidence: Evidence | null }[]; rule_results: Review["rule_results"]; findings: (Omit<Finding, "evidence" | "page" | "section" | "finding_type"> & { evidence: Evidence | null; comment: string | null })[]; warnings: { message: string }[] };
type Playbook = { playbook_id: string; name: string; version: string };
async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.success === false) throw new Error(body?.message || `Request failed (${response.status})`);
  if (!body || !("data" in body)) throw new Error("Unexpected backend response");
  return body.data as T;
}
function fromReport(report: Report): Review {
  return { ...report.metadata, rule_results: report.rule_results,
    clauses: report.clauses.map(c => ({ ...c, summary: c.summary || "", evidence: c.evidence?.excerpt || "", page: c.evidence?.source.page ?? undefined, section: c.evidence?.source.section ?? undefined })),
    findings: report.findings.map(f => ({ ...f, evidence: f.evidence?.excerpt || "No source excerpt available", page: f.evidence?.source.page ?? undefined, section: f.evidence?.source.section ?? undefined, verified: f.evidence?.verified ?? false, review_comment: f.comment, finding_type: report.rule_results.find(r => r.rule_id === f.rule_id)?.outcome || "review_required" })),
    warnings: report.warnings.map(w => w.message) };
}
const label = (value: string) => value.replaceAll("_", " ");
const pretty = (value: string) => label(value).replace(/\b\w/g, (c) => c.toUpperCase());
const outcomeClass = (value: string) => value === "pass" || value === "accepted" || value === "found" ? "green" : value === "deviation" || value === "high" ? "red" : value === "review_required" || value === "medium" || value === "pending" ? "amber" : "gray";

export default function Home() {
  const [review, setReview] = useState<Review>(initialReview);
  const [selectedFinding, setSelectedFinding] = useState("");
  const [tab, setTab] = useState<"findings" | "clauses" | "rules" | "text">("findings");
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState("all");
  const [kind, setKind] = useState("all");
  const [reviewStatus, setReviewStatus] = useState("all");
  const [uploading, setUploading] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState("");
  const [comment, setComment] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const selected = review.findings.find((f) => f.finding_id === selectedFinding) ?? review.findings[0];
  const counts = useMemo(() => ({
    pass: review.rule_results.filter((r) => r.outcome === "pass").length,
    deviations: review.rule_results.filter((r) => r.outcome === "deviation").length,
    needsReview: review.rule_results.filter((r) => r.outcome === "review_required").length,
    pending: review.findings.filter((f) => f.status === "pending").length
  }), [review]);
  const visibleFindings = review.findings.filter((f) => {
    const matchesQuery = `${f.description} ${f.rule_id} ${f.clause_type} ${f.evidence}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (severity === "all" || f.severity === severity) && (kind === "all" || f.finding_type === kind) && (reviewStatus === "all" || f.status === reviewStatus);
  });

  const [reviewId, setReviewId] = useState("");
  const [pages, setPages] = useState<{ page: number | null; text: string }[]>([]);
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [playbookId, setPlaybookId] = useState("");
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const busy = uploading || reviewing || saving || extracting;
  useEffect(() => { api<{ playbooks: Playbook[]; default_playbook_id: string }>("/api/playbooks")
    .then(d => { setPlaybooks(d.playbooks); setPlaybookId(d.default_playbook_id); })
    .catch(e => setError(e.message)); }, []);
  useEffect(() => { setComment(selected?.review_comment || ""); }, [selected?.finding_id, selected?.review_comment]);
  async function uploadFile(file?: File) {
    if (!file || busy) return;
    setError("");
    if (!/\.(pdf|docx)$/i.test(file.name)) { setError("Upload a text-based PDF or DOCX file."); return; }
    if (!file.size || file.size > 10 * 1024 * 1024) { setError("Choose a non-empty file up to 10 MB."); return; }
    setUploading(true);
    try {
      const body = new FormData(); body.append("file", file);
      const data = await api<{ document_id: string; file_name: string; warnings: string[] }>("/api/documents", { method: "POST", body });
      setReview({ ...initialReview, document_id: data.document_id, file_name: data.file_name, status: "uploaded", warnings: data.warnings });
      setReviewId(""); setPages([]); setSelectedFinding(""); setComment(""); setTab("text"); setShowUpload(false);
      const text = await api<{ pages: typeof pages }>(`/api/documents/${encodeURIComponent(data.document_id)}/text`);
      setPages(text.pages);
    } catch (e) { setError(e instanceof Error ? e.message : "Upload failed"); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  }
  async function loadText() {
    setTab("text"); if (!review.document_id) return;
    try { setPages((await api<{ pages: typeof pages }>(`/api/documents/${encodeURIComponent(review.document_id)}/text`)).pages); }
    catch (e) { setError(e instanceof Error ? e.message : "Text preview failed"); }
  }
  async function runReview() {
    if (busy || !review.document_id) return;
    setError(""); setReviewing(true);
    try {
      const created = await api<{ review_id: string }>("/api/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ document_id: review.document_id, ...(playbookId ? { playbook_id: playbookId } : {}) }) });
      const report = await api<Report>(`/api/reviews/${encodeURIComponent(created.review_id)}`);
      setReview(fromReport(report)); setReviewId(created.review_id);
      setTab("findings"); setSelectedFinding(report.findings[0]?.finding_id || "");
    } catch (e) { setError(e instanceof Error ? e.message : "Review failed"); }
    finally { setReviewing(false); }
  }
  async function updateFinding(status: ReviewStatus) {
    if (!selected || !reviewId || busy) return;
    setError(""); setSaving(true);
    const findingId = selected.finding_id;
    try {
      const result = await api<{ status: ReviewStatus; comment: string | null }>(`/api/reviews/${encodeURIComponent(reviewId)}/findings/${encodeURIComponent(findingId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, comment: comment || null }) });
      setReview(prev => ({ ...prev, findings: prev.findings.map(f => f.finding_id === findingId ? { ...f, status: result.status, review_comment: result.comment } : f) }));
    } catch (e) { setError(e instanceof Error ? e.message : "Decision was not saved"); }
    finally { setSaving(false); }
  }
  async function extractClauses(method: string) {
    if (busy || !review.document_id) return;
    setExtracting(true); setError("");
    try {
      const data = await api<{ clauses: { clause_type: string; status: string; evidence: string; summary: string | null; source: { page: number | null; section: string | null } }[]; warnings: string[] }>(`/api/documents/${encodeURIComponent(review.document_id)}/clauses?method=${method}`);
      setReview(prev => ({ ...prev, clauses: data.clauses.map(c => ({ ...c, summary: c.summary || "", page: c.source.page ?? undefined, section: c.source.section ?? undefined })), warnings: data.warnings })); setTab("clauses");
    } catch (e) { setError(e instanceof Error ? e.message : "Clause extraction failed"); }
    finally { setExtracting(false); }
  }
  async function uploadPlaybook(file?: File) {
    if (!file || busy) return;
    setUploading(true); setError("");
    try {
      const body = new FormData(); body.append("file", file);
      const item = await api<Playbook>("/api/playbooks", { method: "POST", body });
      const list = await api<{ playbooks: Playbook[] }>("/api/playbooks");
      setPlaybooks(list.playbooks); setPlaybookId(item.playbook_id);
    } catch (e) { setError(e instanceof Error ? e.message : "Playbook upload failed"); }
    finally { setUploading(false); }
  }
  async function downloadPlaybook() {
    try { const data = await api<unknown>(`/api/playbooks/${encodeURIComponent(playbookId)}`); downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), `${playbookId}.json`); }
    catch (e) { setError(e instanceof Error ? e.message : "Playbook download failed"); }
  }
  async function exportReview() {
    if (!reviewId || busy) return;
    try { const data = await api<Report>(`/api/reviews/${encodeURIComponent(reviewId)}`); downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), `${reviewId}-review.json`); }
    catch (e) { setError(e instanceof Error ? e.message : "Export failed"); }
  }
  function downloadBlob(blob: Blob, name: string) { const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><ShieldCheck size={19}/></div><div><b>clausewise</b><span>LEGAL REVIEW AI</span></div><PanelLeftClose className="collapse" size={17}/></div>
        <div className="workspace"><div className="workspace-icon">L</div><div><b>Legal Ops Workspace</b><span>Prototype environment</span></div><ChevronDown size={15}/></div>
        <div className="nav-label">WORKSPACE</div>
        <button className="nav-item active"><LayoutDashboard size={17}/> Review dashboard</button>
        <button className="nav-item" disabled={busy} onClick={() => setShowUpload(true)}><FolderOpen size={17}/> Documents <span className="nav-count">{review.document_id ? 1 : 0}</span></button>
        <button className="nav-item" onClick={() => setTab("rules")}><BookOpen size={17}/> Review playbook</button>
        <button className="nav-item" onClick={() => setTab("clauses")}><FileCheck2 size={17}/> Clause inventory</button>
        <div className="nav-label nav-spaced">QUALITY &amp; SETTINGS</div>
        <button className="nav-item" onClick={() => setError("QA evaluation API is not configured in this UI scaffold yet.")}><Activity size={17}/> QA evaluation</button>
        <button className="nav-item" onClick={() => setError("Settings are part of the prototype backlog.")}><Settings2 size={17}/> Settings</button>
        <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><CircleHelp size={18}/></div><b>Need a hand?</b><p>Review the prototype guide and API contract.</p><button onClick={() => setError("See README.md for API contracts and setup instructions.")}>View documentation <ArrowRight size={13}/></button></div><div className="profile"><div className="avatar">QA</div><div><b>Demo Reviewer</b><span>Internal workspace</span></div><MoreHorizontal size={18}/></div></div>
      </aside>

      <section className="main-area">
        <header className="topbar"><div className="breadcrumbs">Workspace <ChevronRight size={14}/> <span>Review dashboard</span></div><div className="top-actions"><span className="env-pill"><span/> Prototype</span><button className="icon-btn" aria-label="Notifications"><Bell size={18}/></button><div className="avatar small">QA</div></div></header>
        <div className="page-content">
          <div className="page-heading"><div><div className="eyebrow">LEGAL DOCUMENT INTELLIGENCE</div><h1>Review dashboard</h1><p>Review contract clauses, evaluate playbook rules, and keep a human in the loop.</p></div><div className="heading-actions"><button className="btn btn-secondary" disabled={!reviewId || busy} onClick={exportReview}><ArrowDownToLine size={16}/> Export JSON</button><button className="btn btn-primary" disabled={busy} onClick={() => setShowUpload(true)}><Plus size={17}/> New review</button></div></div>
          <div className="notice"><Info size={17}/><span><b>AI-assisted review only.</b> Findings are decision support, not legal advice or contract approval. Every finding requires human judgment.</span><button onClick={() => setError("Use synthetic or approved public documents only. Do not upload confidential legal documents to an unapproved model.")}>Learn more</button></div>
          {error && <div className="error-banner"><AlertCircle size={17}/><span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss"><X size={16}/></button></div>}
          <div className="section-title-row"><div><h2>Review overview</h2><p>Baseline playbook results for the selected document</p></div><div className="run-meta"><span className="live-dot"/>{review.status === "completed" ? "Review completed" : review.status === "uploaded" ? "Document uploaded" : "Upload a document to start"} <span className="meta-divider"/> Playbook v{review.playbook_version}</div></div>
          <div className="stats-grid">
            <Stat icon={<FileText size={18}/>} label="Rules checked" value={String(review.rule_results.length)} foot={review.playbook_id || "No review yet"} tone="blue"/>
            <Stat icon={<BadgeCheck size={18}/>} label="Passed" value={String(counts.pass)} foot="Within playbook criteria" tone="green"/>
            <Stat icon={<AlertCircle size={18}/>} label="Deviations" value={String(counts.deviations)} foot="Needs reviewer attention" tone="red"/>
            <Stat icon={<Clock3 size={18}/>} label="Review required" value={String(counts.needsReview)} foot={`${counts.pending} findings pending`} tone="amber"/>
          </div>
          <div className="document-card">
            <div className="doc-icon"><FileText size={23}/></div><div className="doc-main"><div className="doc-name">{review.file_name || "No document selected"} <span className={`badge ${review.status === "completed" ? "badge-green" : "badge-gray"}`}>{review.status === "completed" ? "Review complete" : review.status === "uploaded" ? "Uploaded" : "No document"}</span></div><div className="doc-meta">Document ID: {review.document_id} <span>•</span> PDF / DOCX <span>•</span> Playbook: {review.playbook_id} v{review.playbook_version}</div></div><div className="doc-actions"><button className="btn btn-secondary btn-sm" onClick={() => void loadText()}><FileText size={15}/> View extracted text</button><button className="btn btn-primary btn-sm" onClick={runReview} disabled={busy || !review.document_id}><Sparkles size={15}/>{reviewing ? "Reviewing…" : "Run review"}{reviewing && <LoaderCircle className="spin" size={14}/>}</button></div>
          </div>
          <div className="integration-controls">
            <label>Playbook <select aria-label="Review playbook" disabled={busy} value={playbookId} onChange={e => setPlaybookId(e.target.value)}><option value="">Backend default</option>{playbooks.map(p => <option key={p.playbook_id} value={p.playbook_id}>{p.name} (v{p.version})</option>)}</select></label>
            <button className="btn btn-secondary btn-sm" disabled={!playbookId || busy} onClick={downloadPlaybook}>Download playbook JSON</button>
            <label className="btn btn-secondary btn-sm">Upload playbook JSON<input aria-label="Upload playbook JSON" type="file" accept=".json" disabled={busy} onChange={e => { void uploadPlaybook(e.target.files?.[0]); e.target.value = ""; }}/></label>
            <button className="btn btn-secondary btn-sm" disabled={busy || !review.document_id} onClick={() => extractClauses("manual")}>Extract clauses (manual)</button>
            <button className="btn btn-secondary btn-sm" disabled={busy || !review.document_id} onClick={() => extractClauses("llm")}>{extracting ? "Extracting…" : "Extract clauses (Open AI)"}</button>
          </div>
          {(review.warnings || []).map((w, i) => <div className="notice" key={i}>{w}</div>)}
          <div className="review-layout">
            <section className="panel results-panel">
              <div className="panel-header"><div><h2>Review results</h2><p>Inspect findings and supporting evidence</p></div><button className="icon-btn subtle" onClick={() => {setQuery("");setSeverity("all");setKind("all");setReviewStatus("all");}} aria-label="Reset filters"><SlidersHorizontal size={17}/></button></div>
              <div className="tabs">
                <button className={tab === "findings" ? "tab active-tab" : "tab"} onClick={() => setTab("findings")}>Findings <span>{review.findings.length}</span></button>
                <button className={tab === "clauses" ? "tab active-tab" : "tab"} onClick={() => setTab("clauses")}>Clauses <span>{review.clauses.length}</span></button>
                <button className={tab === "rules" ? "tab active-tab" : "tab"} onClick={() => setTab("rules")}>Rule results <span>{review.rule_results.length}</span></button>
                <button className={tab === "text" ? "tab active-tab" : "tab"} onClick={() => void loadText()}>Text preview</button>
              </div>
              {tab === "findings" && <><div className="filter-row"><div className="search-box"><Search size={15}/><input placeholder="Search findings..." value={query} onChange={(e) => setQuery(e.target.value)}/></div><select value={severity} onChange={(e) => setSeverity(e.target.value)} aria-label="Filter severity"><option value="all">All severity</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select><select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Filter type"><option value="all">All types</option><option value="deviation">Deviation</option><option value="review_required">Review required</option></select><select value={reviewStatus} onChange={(e) => setReviewStatus(e.target.value)} aria-label="Filter status"><option value="all">All status</option><option value="pending">Pending</option><option value="accepted">Accepted</option><option value="dismissed">Dismissed</option></select></div>
                <div className="finding-list">{visibleFindings.map((f) => <button key={f.finding_id} className={`finding-row ${selectedFinding === f.finding_id ? "selected" : ""}`} onClick={() => {setSelectedFinding(f.finding_id);setComment(f.review_comment || "");}}><span className={`severity-mark ${f.severity}`}/><div className="finding-row-body"><div className="finding-title">{f.description}</div><div className="finding-sub">{f.rule_id} <span>•</span> {pretty(f.clause_type)}</div><div className="finding-row-bottom"><span className={`badge badge-${outcomeClass(f.finding_type)}`}>{pretty(f.finding_type)}</span><span className={`status-dot status-${f.status}`}/><span className="muted">{pretty(f.status)}</span></div></div><ChevronRight size={16} className="row-chevron"/></button>)}
                  {visibleFindings.length === 0 && <div className="empty-state"><Search size={23}/><b>{reviewId ? "No findings match these filters" : "No review results yet"}</b><span>{reviewId ? "Try clearing a filter or changing your search." : "Upload a document, then run a review."}</span></div>}
                </div>
              </>}
              {tab === "clauses" && <div className="table-list">{review.clauses.map((c) => <div className="table-row" key={`${c.clause_type}-${review.clauses.indexOf(c)}`}><div className="table-primary"><b>{pretty(c.clause_type)}</b><span>{c.summary}</span><p style={{whiteSpace: "pre-wrap"}}>{c.evidence}</p><small>{c.page ? `Page ${c.page}` : ""} {c.section}</small></div><span className={`badge badge-${outcomeClass(c.status)}`}>{pretty(c.status)}</span></div>)}</div>}
              {tab === "rules" && <div className="table-list">{review.rule_results.map((r) => <div className="table-row" key={r.rule_id}><div className="table-primary"><b>{r.rule_id} · {pretty(r.clause_type)}</b><span>{r.reason}</span></div><span className={`badge badge-${outcomeClass(r.outcome)}`}>{pretty(r.outcome)}</span></div>)}</div>}
              {tab === "text" && <div className="text-preview"><div className="text-preview-head"><FileText size={17}/><b>{review.file_name || "Extracted text"}</b></div>{pages.length ? pages.map((p, i) => <div className="source-page" key={i}><div className="page-number">{p.page ? `PAGE ${p.page}` : "DOCUMENT TEXT"}</div><p style={{whiteSpace: "pre-wrap"}}>{p.text}</p></div>) : <p>Upload a document to preview its extracted text.</p>}</div>}
              <div className="panel-footer"><span>Showing {tab === "findings" ? visibleFindings.length : tab === "clauses" ? review.clauses.length : tab === "rules" ? review.rule_results.length : "source"} {tab === "findings" ? "findings" : tab === "clauses" ? "clause categories" : tab === "rules" ? "rule results" : "text preview"}</span><span className="footer-verified"><ShieldCheck size={14}/> Evidence-backed review</span></div>
            </section>

            <aside className="panel detail-panel">
              {tab === "findings" && selected ? <><div className="detail-top"><div className="detail-label">FINDING DETAILS <span>{selected.finding_id}</span></div><button className="icon-btn subtle" aria-label="More finding options"><MoreHorizontal size={18}/></button></div><div className="detail-heading"><span className={`severity-mark large ${selected.severity}`}/><h2>{selected.description}</h2></div><div className="detail-badges"><span className={`badge badge-${outcomeClass(selected.finding_type)}`}>{pretty(selected.finding_type)}</span><span className={`badge badge-${outcomeClass(selected.severity)}`}>{pretty(selected.severity)} severity</span><span className="badge badge-outline">{selected.rule_id}</span></div>
                <div className="detail-section"><div className="detail-section-title"><span>Source evidence</span><button className="text-action" onClick={() => void loadText()}>View source <ArrowRight size={13}/></button></div><blockquote>{selected.evidence}</blockquote><div className="source-ref"><FileText size={14}/><span>{selected.page ? `Page ${selected.page}` : "Page unavailable"} · {selected.section || "Section unavailable"}</span><span className="verified"><CheckCircle2 size={13}/> {selected.verified ? "Verified" : "Unverified"}</span></div></div>
                <div className="detail-section"><div className="detail-section-title">Why this was flagged</div><p className="detail-copy">{selected.reason}</p></div><div className="detail-section"><div className="detail-section-title">Suggested next step</div><div className="suggestion"><div className="suggestion-icon"><MessageSquare size={16}/></div><p>{selected.suggested_action}</p></div></div>
                <div className="detail-section confidence-row"><span>AI confidence</span><b>{selected.confidence}</b><span className={`confidence-pill ${selected.confidence.toLowerCase()}`}><span/></span></div>
                <div className="review-decision"><div className="detail-section-title">Reviewer decision</div><div className="decision-buttons"><button className={selected.status === "accepted" ? "decision accepted-choice" : "decision"} disabled={busy} onClick={() => updateFinding("accepted")}><Check size={15}/> Accept</button><button className={selected.status === "dismissed" ? "decision dismissed-choice" : "decision"} disabled={busy} onClick={() => updateFinding("dismissed")}><X size={15}/> Dismiss</button><button className={selected.status === "pending" ? "decision pending-choice" : "decision"} disabled={busy} onClick={() => updateFinding("pending")}><Clock3 size={15}/> Pending</button></div><textarea maxLength={2000} disabled={busy} placeholder="Add a review comment (optional)..." value={comment} onChange={(e) => setComment(e.target.value)}/><button className="btn btn-primary save-comment" disabled={busy} onClick={() => updateFinding(selected.status)}>Save decision &amp; comment</button></div>
              </> : <div className="detail-empty"><div className="detail-empty-icon"><Gavel size={23}/></div><h3>{tab === "findings" ? "Select a finding" : tab === "clauses" ? "Clause inventory" : tab === "rules" ? "Playbook rule results" : "Extracted document text"}</h3><p>{tab === "findings" ? "Choose a finding to inspect its evidence, rationale, and reviewer actions." : "Select a record on the left to inspect details."}</p></div>}
              <div className="detail-bottom"><ShieldCheck size={15}/><span>Human review required · Not legal advice</span></div>
            </aside>
          </div>
          <footer className="page-footer"><span>Clausewise AI <span>·</span> Prototype v0.1</span><span><span className="live-dot"/> All evidence should be verified against source text</span></footer>
        </div>
      </section>
      {showUpload && <div className="modal-backdrop" onClick={() => setShowUpload(false)}><div className="upload-modal" onClick={(e) => e.stopPropagation()}><div className="modal-heading"><div><h2>Start a new review</h2><p>Upload a text-based NDA to begin the review workflow.</p></div><button className="icon-btn" onClick={() => setShowUpload(false)} aria-label="Close"><X size={18}/></button></div><button disabled={busy} className="drop-zone" onClick={() => fileRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => {e.preventDefault();void uploadFile(e.dataTransfer.files[0]);}}><div className="upload-icon"><UploadCloud size={25}/></div><b>{uploading ? "Uploading document…" : "Choose a file or drag it here"}</b><span>PDF or DOCX · Max 10 MB · Text-based documents only</span><span className="browse-label">Browse files</span>{uploading && <LoaderCircle className="spin" size={18}/>}</button><input ref={fileRef} type="file" accept=".pdf,.docx" hidden onChange={(e) => void uploadFile(e.target.files?.[0])}/>{error && <div className="modal-error"><AlertCircle size={15}/>{error}</div>}<div className="modal-note"><Info size={15}/> Use synthetic or approved public test documents only. Scanned PDFs and OCR are not supported in v1.</div><div className="modal-actions"><button className="btn btn-secondary" onClick={() => setShowUpload(false)}>Cancel</button><button className="btn btn-primary" disabled={busy} onClick={() => fileRef.current?.click()}>{uploading ? "Uploading…" : "Select document"} <ArrowRight size={15}/></button></div></div></div>}
    </main>
  );
}
function Stat({ icon, label, value, foot, tone }: { icon: React.ReactNode; label: string; value: string; foot: string; tone: string }) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-foot">{foot}</div></div>;
}
