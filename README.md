# Clausewise — Legal Document Review AI UI

A Next.js UI scaffold based on `Legal_Document_Review_AI_Prototype_Specification.pdf`. It provides a review dashboard, sample NDA results, clause inventory, rule results, evidence panel, reviewer decisions, filters, document upload, and JSON export.

## Stack

- Next.js 15 App Router + React + TypeScript
- Lucide icons
- Next.js route handlers proxy requests to a Python API
- Python backend owns parsing, clause extraction, playbook evaluation, evidence validation, findings, persistence, and QA metrics

## Run locally

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

Open `http://localhost:3000`.

Set `PYTHON_API_BASE_URL` in `.env.local` to the base URL of your Python service (default `http://localhost:8000`). Restart Next.js after changing environment variables.

## Python API contract expected by the UI

The specification's suggested endpoints are used as the integration contract:

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/documents` | Multipart upload, field name `file`; returns `document_id`, `file_name`, `extraction_status` |
| GET | `/api/documents/{id}/text` | Extracted text preview with page/section references (add this UI wiring as needed) |
| POST | `/api/reviews` | JSON `{ "document_id": "...", "playbook_id": "NDA-BASELINE" }`; returns review report |
| GET | `/api/reviews/{id}` | Fetch report (can be added for refresh/reload) |
| PATCH | `/api/reviews/{id}/findings/{findingId}` | JSON `{ "status": "pending" \| "accepted" \| "dismissed", "review_comment": "..." }` |
| GET | `/api/reviews/{id}/export?format=json` | JSON export |

The UI calls Python through same-origin Next.js route handlers so the Python service does not need to expose CORS to the browser. The base URL stays server-side.

## Expected review response shape

```json
{
  "document_id": "DOC-001",
  "file_name": "sample_nda_for_testing.pdf",
  "playbook_id": "NDA-BASELINE",
  "playbook_version": "1.0",
  "status": "completed",
  "clauses": [
    {
      "clause_type": "governing_law",
      "status": "found",
      "summary": "The clause does not name a specific jurisdiction.",
      "evidence": "This agreement shall be governed by applicable law.",
      "page": 2,
      "section": "Clause 5"
    }
  ],
  "rule_results": [
    {
      "rule_id": "R5",
      "clause_type": "governing_law",
      "outcome": "deviation",
      "reason": "The clause does not name a jurisdiction."
    }
  ],
  "findings": [
    {
      "finding_id": "F-005",
      "rule_id": "R5",
      "clause_type": "governing_law",
      "finding_type": "deviation",
      "severity": "medium",
      "description": "The governing-law clause does not identify a specific jurisdiction.",
      "evidence": "This agreement shall be governed by applicable law.",
      "page": 2,
      "section": "Clause 5",
      "reason": "The clause does not explicitly name the applicable jurisdiction.",
      "suggested_action": "Ask the appropriate reviewer to confirm the intended jurisdiction.",
      "confidence": "high",
      "status": "pending",
      "review_comment": null
    }
  ],
  "warnings": []
}
```

## Important notes

- The default dashboard uses **illustrative sample data** from the specification; it is not a live AI result.
- Upload and review require a running Python service. The UI shows an actionable connection error if the service is not reachable.
- For uploaded documents, the Python response must follow the documented schema. The UI can display source preview using the sample text for the included demo, but wiring uploaded-document text preview to `GET /api/documents/{id}/text` is a follow-up integration task.
- Frontend validation is convenience only. Repeat extension, MIME, size, readability, and schema validation on the Python backend.
- The prototype must use synthetic or approved public sample documents only. It must not provide legal advice, approve contracts, or imply legal correctness.
- No OCR is implemented; scanned PDFs are outside v1 scope.
- The external Google font import is cosmetic; remove it from `app/globals.css` if the environment requires no external network access.
