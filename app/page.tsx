 "use client";

import { useMemo, useRef, useState } from "react";
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
  page: number; section: string; reason: string; suggested_action: string;
  confidence: string; status: ReviewStatus; review_comment?: string | null;
};
type Clause = { clause_type: string; status: string; summary: string; evidence: string; page?: number; section?: string };
type Review = {
  document_id: string; file_name?: string; playbook_id: string; playbook_version: string;
  status?: string; clauses: Clause[]; rule_results: { rule_id: string; clause_type: string; outcome: Outcome; reason: string }[];
  findings: Finding[]; warnings?: string[];
};
const initialFindings: Finding[] = [
  { finding_id: "F-004", rule_id: "R4", clause_type: "return_destruction", finding_type: "deviation", severity: "high", description: "Destruction of confidential information is not explicitly addressed.", evidence: "The Receiving Party shall return confidential information upon written request from the Disclosing Party.", page: 2, section: "Clause 4", reason: "The demo playbook requires both return and destruction to be addressed. Only return is explicit in the source.", suggested_action: "Ask the appropriate reviewer to confirm whether destruction obligations should be included.", confidence: "High", status: "pending" },
  { finding_id: "F-005", rule_id: "R5", clause_type: "governing_law", finding_type: "deviation", severity: "medium", description: "The governing-law clause does not identify a specific jurisdiction.", evidence: "This agreement shall be governed by applicable law.", page: 2, section: "Clause 5", reason: "The clause does not explicitly name the applicable jurisdiction.", suggested_action: "Ask the appropriate reviewer to confirm the intended jurisdiction.", confidence: "High", status: "pending" },
  { finding_id: "F-003", rule_id: "R3", clause_type: "duration", finding_type: "review_required", severity: "low", description: "The agreement states a one-year duration, but no duration threshold is configured.", evidence: "The obligations under this agreement shall continue for one year from the date of disclosure.", page: 2, section: "Clause 3", reason: "The duration was extracted, but the demo playbook does not define a threshold to evaluate it against.", suggested_action: "Have a reviewer assess the duration against the intended business context.", confidence: "Medium", status: "pending" }
];
const initialClauses: Clause[] = [
  { clause_type: "confidentiality", status: "found", summary: "The receiving party must protect confidential information and restrict disclosure.", evidence: "The Receiving Party shall protect all confidential information and shall not disclose it to third parties without prior written consent.", page: 1, section: "Clause 2" },
  { clause_type: "permitted_use", status: "found", summary: "Use is limited to evaluating a potential business relationship.", evidence: "The Receiving Party may use confidential information solely to evaluate a potential business relationship with the Disclosing Party.", page: 1, section: "Clause 1" },
  { clause_type: "exclusions", status: "not_found", summary: "No exclusions clause was identified in the extracted text.", evidence: "" },
  { clause_type: "duration", status: "found", summary: "Obligations continue for one year from disclosure.", evidence: "The obligations under this agreement shall continue for one year from the date of disclosure.", page: 2, section: "Clause 3" },
  { clause_type: "termination", status: "not_found", summary: "No termination clause was identified in the extracted text.", evidence: "" },
  { clause_type: "return_destruction", status: "found", summary: "Return is required upon written request; destruction is not explicit in this excerpt.", evidence: "The Receiving Party shall return confidential information upon written request from the Disclosing Party.", page: 2, section: "Clause 4" },
  { clause_type: "liability", status: "not_found", summary: "No liability clause was identified in the extracted text.", evidence: "" },
  { clause_type: "governing_law", status: "found", summary: "The clause does not name a specific jurisdiction.", evidence: "This agreement shall be governed by applicable law.", page: 2, section: "Clause 5" },
  { clause_type: "other", status: "not_found", summary: "No additional supported clause category was identified.", evidence: "" }
];
const initialReview: Review = {
  document_id: "DOC-001", file_name: "sample_nda_for_testing.pdf", playbook_id: "NDA-BASELINE", playbook_version: "1.0",
  status: "completed", clauses: initialClauses,
  rule_results: [
    { rule_id: "R1", clause_type: "confidentiality", outcome: "pass", reason: "A confidentiality obligation was identified." },
    { rule_id: "R2", clause_type: "permitted_use", outcome: "pass", reason: "Use is limited to evaluating a potential business relationship under the demo criteria." },
    { rule_id: "R3", clause_type: "duration", outcome: "review_required", reason: "One-year duration was extracted; no duration threshold is configured." },
    { rule_id: "R4", clause_type: "return_destruction", outcome: "deviation", reason: "Return is explicit; destruction is not explicitly addressed under the demo rule." },
    { rule_id: "R5", clause_type: "governing_law", outcome: "deviation", reason: "The clause says 'applicable law' but does not name a jurisdiction." }
  ],
  findings: initialFindings, warnings: []
};
const label = (value: string) => value.replaceAll("_", " ");
const pretty = (value: string) => label(value).replace(/\b\w/g, (c) => c.toUpperCase());
const outcomeClass = (value: string) => value === "pass" || value === "accepted" || value === "found" ? "green" : value === "deviation" || value === "high" ? "red" : value === "review_required" || value === "medium" || value === "pending" ? "amber" : "gray";

export default function Home() {
  const [review, setReview] = useState<Review>(initialReview);
  const [selectedFinding, setSelectedFinding] = useState("F-004");
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

  async function uploadFile(file?: File) {
    if (!file) return;
    setError("");
    const ext = file.name.toLowerCase().split(".").pop();
    if (!["pdf", "docx"].includes(ext ?? "")) { setError("Unsupported file type. Upload a text-based PDF or DOCX file."); return; }
    if (file.size > 10 * 1024 * 1024) { setError("File is larger than the 10 MB limit."); return; }
    setUploading(true);
    try {
      const body = new FormData(); body.append("file", file);
      const response = await fetch("/api/documents", { method: "POST", body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Upload failed.");
      setReview((prev) => ({ ...prev, document_id: data.document_id, file_name: data.file_name || file.name, status: "uploaded", clauses: [], rule_results: [], findings: [] }));
      setSelectedFinding(""); setTab("text"); setShowUpload(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to upload document. Check the Python API connection."); }
    finally { setUploading(false); }
  }
  async function runReview() {
    setError(""); setReviewing(true);
    try {
      const response = await fetch("/api/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ document_id: review.document_id, playbook_id: "NDA-BASELINE" }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Review failed.");
      const result = data.review ?? data;
      setReview((prev) => ({ ...prev, ...result, file_name: result.file_name || prev.file_name }));
      setTab("findings"); setSelectedFinding(result.findings?.[0]?.finding_id ?? "");
    } catch (e) { setError(e instanceof Error ? e.message : "Review failed. Check the Python API connection."); }
    finally { setReviewing(false); }
  }
  async function updateFinding(status: ReviewStatus) {
    if (!selected) return;
    setError("");
    const old = selected.status;
    setReview((prev) => ({ ...prev, findings: prev.findings.map((f) => f.finding_id === selected.finding_id ? { ...f, status, review_comment: comment || f.review_comment } : f) }));
    try {
      const response = await fetch(`/api/reviews/${review.document_id}/findings/${selected.finding_id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, review_comment: comment || null }) });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || "Decision could not be saved."); }
    } catch (e) {
      // Demo UI can be used without the Python service; keep the local decision and explain the persistence limitation.
      setError(e instanceof Error ? `${e.message} The decision remains in this browser session only.` : "Could not persist decision; it remains local.");
    }
  }
  async function exportReview() {
    try {
      const response = await fetch(`/api/reviews/${review.document_id}/export?format=json`);
      if (!response.ok) throw new Error("Export API unavailable; downloading the current review from the UI.");
      const blob = await response.blob(); downloadBlob(blob, `${review.document_id}-review.json`);
    } catch {
      downloadBlob(new Blob([JSON.stringify(review, null, 2)], { type: "application/json" }), `${review.document_id}-review.json`);
    }
  }
  function downloadBlob(blob: Blob, name: string) { const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url); }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><ShieldCheck size={19}/></div><div><b>clausewise</b><span>LEGAL REVIEW AI</span></div><PanelLeftClose className="collapse" size={17}/></div>
        <div className="workspace"><div className="workspace-icon">L</div><div><b>Legal Ops Workspace</b><span>Prototype environment</span></div><ChevronDown size={15}/></div>
        <div className="nav-label">WORKSPACE</div>
        <button className="nav-item active"><LayoutDashboard size={17}/> Review dashboard</button>
        <button className="nav-item" onClick={() => setShowUpload(true)}><FolderOpen size={17}/> Documents <span className="nav-count">1</span></button>
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
          <div className="page-heading"><div><div className="eyebrow">LEGAL DOCUMENT INTELLIGENCE</div><h1>Review dashboard</h1><p>Review contract clauses, evaluate playbook rules, and keep a human in the loop.</p></div><div className="heading-actions"><button className="btn btn-secondary" onClick={exportReview}><ArrowDownToLine size={16}/> Export JSON</button><button className="btn btn-primary" onClick={() => setShowUpload(true)}><Plus size={17}/> New review</button></div></div>
          <div className="notice"><Info size={17}/><span><b>AI-assisted review only.</b> Findings are decision support, not legal advice or contract approval. Every finding requires human judgment.</span><button onClick={() => setError("Use synthetic or approved public documents only. Do not upload confidential legal documents to an unapproved model.")}>Learn more</button></div>
          {error && <div className="error-banner"><AlertCircle size={17}/><span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss"><X size={16}/></button></div>}
          <div className="section-title-row"><div><h2>Review overview</h2><p>Baseline playbook results for the selected document</p></div><div className="run-meta"><span className="live-dot"/>{review.status === "completed" ? "Review completed" : review.status === "uploaded" ? "Document uploaded" : "Sample data"} <span className="meta-divider"/> Playbook v{review.playbook_version}</div></div>
          <div className="stats-grid">
            <Stat icon={<FileText size={18}/>} label="Rules checked" value={String(review.rule_results.length || 5)} foot="NDA-BASELINE" tone="blue"/>
            <Stat icon={<BadgeCheck size={18}/>} label="Passed" value={String(counts.pass)} foot="Within demo criteria" tone="green"/>
            <Stat icon={<AlertCircle size={18}/>} label="Deviations" value={String(counts.deviations)} foot="Needs reviewer attention" tone="red"/>
            <Stat icon={<Clock3 size={18}/>} label="Review required" value={String(counts.needsReview)} foot={`${counts.pending} findings pending`} tone="amber"/>
          </div>
          <div className="document-card">
            <div className="doc-icon"><FileText size={23}/></div><div className="doc-main"><div className="doc-name">{review.file_name || "No document selected"} <span className={`badge ${review.status === "completed" ? "badge-green" : "badge-gray"}`}>{review.status === "completed" ? "Review complete" : review.status === "uploaded" ? "Uploaded" : "Sample"}</span></div><div className="doc-meta">Document ID: {review.document_id} <span>•</span> PDF / DOCX <span>•</span> Playbook: {review.playbook_id} v{review.playbook_version}</div></div><div className="doc-actions"><button className="btn btn-secondary btn-sm" onClick={() => setTab("text")}><FileText size={15}/> View extracted text</button><button className="btn btn-primary btn-sm" onClick={runReview} disabled={reviewing || !review.document_id}><Sparkles size={15}/>{reviewing ? "Reviewing…" : "Run review"}{reviewing && <LoaderCircle className="spin" size={14}/>}</button></div>
          </div>
          <div className="review-layout">
            <section className="panel results-panel">
              <div className="panel-header"><div><h2>Review results</h2><p>Inspect findings and supporting evidence</p></div><button className="icon-btn subtle" onClick={() => {setQuery("");setSeverity("all");setKind("all");setReviewStatus("all");}} aria-label="Reset filters"><SlidersHorizontal size={17}/></button></div>
              <div className="tabs">
                <button className={tab === "findings" ? "tab active-tab" : "tab"} onClick={() => setTab("findings")}>Findings <span>{review.findings.length}</span></button>
                <button className={tab === "clauses" ? "tab active-tab" : "tab"} onClick={() => setTab("clauses")}>Clauses <span>{review.clauses.length}</span></button>
                <button className={tab === "rules" ? "tab active-tab" : "tab"} onClick={() => setTab("rules")}>Rule results <span>{review.rule_results.length}</span></button>
                <button className={tab === "text" ? "tab active-tab" : "tab"} onClick={() => setTab("text")}>Text preview</button>
              </div>
              {tab === "findings" && <><div className="filter-row"><div className="search-box"><Search size={15}/><input placeholder="Search findings..." value={query} onChange={(e) => setQuery(e.target.value)}/></div><select value={severity} onChange={(e) => setSeverity(e.target.value)} aria-label="Filter severity"><option value="all">All severity</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select><select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Filter type"><option value="all">All types</option><option value="deviation">Deviation</option><option value="review_required">Review required</option></select><select value={reviewStatus} onChange={(e) => setReviewStatus(e.target.value)} aria-label="Filter status"><option value="all">All status</option><option value="pending">Pending</option><option value="accepted">Accepted</option><option value="dismissed">Dismissed</option></select></div>
                <div className="finding-list">{visibleFindings.map((f) => <button key={f.finding_id} className={`finding-row ${selectedFinding === f.finding_id ? "selected" : ""}`} onClick={() => {setSelectedFinding(f.finding_id);setComment(f.review_comment || "");}}><span className={`severity-mark ${f.severity}`}/><div className="finding-row-body"><div className="finding-title">{f.description}</div><div className="finding-sub">{f.rule_id} <span>•</span> {pretty(f.clause_type)}</div><div className="finding-row-bottom"><span className={`badge badge-${outcomeClass(f.finding_type)}`}>{pretty(f.finding_type)}</span><span className={`status-dot status-${f.status}`}/><span className="muted">{pretty(f.status)}</span></div></div><ChevronRight size={16} className="row-chevron"/></button>)}
                  {visibleFindings.length === 0 && <div className="empty-state"><Search size={23}/><b>No findings match these filters</b><span>Try clearing a filter or changing your search.</span></div>}
                </div>
              </>}
              {tab === "clauses" && <div className="table-list">{review.clauses.map((c) => <div className="table-row" key={c.clause_type}><div className="table-primary"><b>{pretty(c.clause_type)}</b><span>{c.summary}</span></div><span className={`badge badge-${outcomeClass(c.status)}`}>{pretty(c.status)}</span></div>)}</div>}
              {tab === "rules" && <div className="table-list">{review.rule_results.map((r) => <div className="table-row" key={r.rule_id}><div className="table-primary"><b>{r.rule_id} · {pretty(r.clause_type)}</b><span>{r.reason}</span></div><span className={`badge badge-${outcomeClass(r.outcome)}`}>{pretty(r.outcome)}</span></div>)}</div>}
              {tab === "text" && <div className="text-preview"><div className="text-preview-head"><FileText size={17}/><b>{review.file_name || "Extracted text"}</b><span>Source preview</span></div><div className="source-page"><div className="page-number">PAGE 1</div><h3>NON-DISCLOSURE AGREEMENT</h3><p className="fictional">Fictional sample for software demonstration only</p><p>This Agreement is entered into between Company A (&quot;Disclosing Party&quot;) and Company B (&quot;Receiving Party&quot;).</p><h4>Clause 1 — Purpose</h4><p>The Receiving Party may use confidential information solely to evaluate a potential business relationship with the Disclosing Party.</p><h4>Clause 2 — Confidentiality</h4><p>The Receiving Party shall protect all confidential information and shall not disclose it to third parties without prior written consent.</p><div className="page-number second">PAGE 2</div><h4>Clause 3 — Duration</h4><p>The obligations under this agreement shall continue for one year from the date of disclosure.</p><h4>Clause 4 — Return of Information</h4><p>The Receiving Party shall return confidential information upon written request from the Disclosing Party.</p><h4>Clause 5 — Governing Law</h4><p>This agreement shall be governed by applicable law.</p></div></div>}
              <div className="panel-footer"><span>Showing {tab === "findings" ? visibleFindings.length : tab === "clauses" ? review.clauses.length : tab === "rules" ? review.rule_results.length : "source"} {tab === "findings" ? "findings" : tab === "clauses" ? "clause categories" : tab === "rules" ? "rule results" : "text preview"}</span><span className="footer-verified"><ShieldCheck size={14}/> Evidence-backed review</span></div>
            </section>

            <aside className="panel detail-panel">
              {tab === "findings" && selected ? <><div className="detail-top"><div className="detail-label">FINDING DETAILS <span>{selected.finding_id}</span></div><button className="icon-btn subtle" aria-label="More finding options"><MoreHorizontal size={18}/></button></div><div className="detail-heading"><span className={`severity-mark large ${selected.severity}`}/><h2>{selected.description}</h2></div><div className="detail-badges"><span className={`badge badge-${outcomeClass(selected.finding_type)}`}>{pretty(selected.finding_type)}</span><span className={`badge badge-${outcomeClass(selected.severity)}`}>{pretty(selected.severity)} severity</span><span className="badge badge-outline">{selected.rule_id}</span></div>
                <div className="detail-section"><div className="detail-section-title"><span>Source evidence</span><button className="text-action" onClick={() => setTab("text")}>View source <ArrowRight size={13}/></button></div><blockquote>{selected.evidence}</blockquote><div className="source-ref"><FileText size={14}/><span>Page {selected.page} · {selected.section}</span><span className="verified"><CheckCircle2 size={13}/> Verified</span></div></div>
                <div className="detail-section"><div className="detail-section-title">Why this was flagged</div><p className="detail-copy">{selected.reason}</p></div><div className="detail-section"><div className="detail-section-title">Suggested next step</div><div className="suggestion"><div className="suggestion-icon"><MessageSquare size={16}/></div><p>{selected.suggested_action}</p></div></div>
                <div className="detail-section confidence-row"><span>AI confidence</span><b>{selected.confidence}</b><span className={`confidence-pill ${selected.confidence.toLowerCase()}`}><span/></span></div>
                <div className="review-decision"><div className="detail-section-title">Reviewer decision</div><div className="decision-buttons"><button className={selected.status === "accepted" ? "decision accepted-choice" : "decision"} onClick={() => updateFinding("accepted")}><Check size={15}/> Accept</button><button className={selected.status === "dismissed" ? "decision dismissed-choice" : "decision"} onClick={() => updateFinding("dismissed")}><X size={15}/> Dismiss</button><button className={selected.status === "pending" ? "decision pending-choice" : "decision"} onClick={() => updateFinding("pending")}><Clock3 size={15}/> Pending</button></div><textarea placeholder="Add a review comment (optional)..." value={comment} onChange={(e) => setComment(e.target.value)}/><button className="btn btn-primary save-comment" onClick={() => updateFinding(selected.status)}>Save decision &amp; comment</button></div>
              </> : <div className="detail-empty"><div className="detail-empty-icon"><Gavel size={23}/></div><h3>{tab === "findings" ? "Select a finding" : tab === "clauses" ? "Clause inventory" : tab === "rules" ? "Playbook rule results" : "Extracted document text"}</h3><p>{tab === "findings" ? "Choose a finding to inspect its evidence, rationale, and reviewer actions." : "Select a record on the left to inspect details."}</p></div>}
              <div className="detail-bottom"><ShieldCheck size={15}/><span>Human review required · Not legal advice</span></div>
            </aside>
          </div>
          <footer className="page-footer"><span>Clausewise AI <span>·</span> Prototype v0.1</span><span><span className="live-dot"/> All evidence should be verified against source text</span></footer>
        </div>
      </section>
      {showUpload && <div className="modal-backdrop" onClick={() => setShowUpload(false)}><div className="upload-modal" onClick={(e) => e.stopPropagation()}><div className="modal-heading"><div><h2>Start a new review</h2><p>Upload a text-based NDA to begin the review workflow.</p></div><button className="icon-btn" onClick={() => setShowUpload(false)} aria-label="Close"><X size={18}/></button></div><button className="drop-zone" onClick={() => fileRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => {e.preventDefault();void uploadFile(e.dataTransfer.files[0]);}}><div className="upload-icon"><UploadCloud size={25}/></div><b>{uploading ? "Uploading document…" : "Choose a file or drag it here"}</b><span>PDF or DOCX · Max 10 MB · Text-based documents only</span><span className="browse-label">Browse files</span>{uploading && <LoaderCircle className="spin" size={18}/>}</button><input ref={fileRef} type="file" accept=".pdf,.docx" hidden onChange={(e) => void uploadFile(e.target.files?.[0])}/>{error && <div className="modal-error"><AlertCircle size={15}/>{error}</div>}<div className="modal-note"><Info size={15}/> Use synthetic or approved public test documents only. Scanned PDFs and OCR are not supported in v1.</div><div className="modal-actions"><button className="btn btn-secondary" onClick={() => setShowUpload(false)}>Cancel</button><button className="btn btn-primary" disabled={uploading} onClick={() => fileRef.current?.click()}>{uploading ? "Uploading…" : "Select document"} <ArrowRight size={15}/></button></div></div></div>}
    </main>
  );
}
function Stat({ icon, label, value, foot, tone }: { icon: React.ReactNode; label: string; value: string; foot: string; tone: string }) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-foot">{foot}</div></div>;
}
