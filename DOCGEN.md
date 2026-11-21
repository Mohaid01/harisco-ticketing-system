# Harisco Ticketing System — Document Generator Documentation

**File:** `docgen.md`  
**Module:** `src/tabs/DocumentGenerator/`  
**API:** `server/routes/document-generator.ts`  
**Owner:** Document Control / Engineering Documentation

---

## 1. Overview

The Document Generator (DocGen) is the corporate document control module of the Harisco Ticketing System. It enforces Haris & Co engineering numbering standards, issues official document IDs, maintains a Master Document Register (MDR), handles revision history with per-revision sign-off capture, and generates formatted Word documents from a `.docx` template.

**Core capabilities:**

- Auto-generated document IDs following the scheme `HC-<Entity>-<Department>-<DocType>-<Seq>`
- Master Document Register with search, filter, and pagination
- New document creation (title, description, appendix, form number)
- Tri-tier sign-off matrix (Prepared / Checked / Approved)
- Revision upload (.doc / .docx) with per-revision signer capture
- Word document generation from template with placeholder substitution
- Revision-table injection (incremental revision log top-to-bottom)

---

## 2. Directory Structure

```
src/tabs/DocumentGenerator/
├── index.tsx                  # Main container (registry + new document modal)
├── types.ts                   # TypeScript interfaces
├── constants.ts               # Entities, departments, document types, prefix
├── DocumentGenerator.css      # Module styles
├── utils/
│   └── wordGenerator.ts       # Word .docx generation logic
├── hooks/
│   ├── useDocumentGenerator.ts  # New document state & generation API calls
│   └── useDocumentRegistry.ts   # MDR fetch, filter, update revision
├── assets/
│   ├── word-new-template.docx   # Word generation template
│   └── sample-excel.xlsx        # (unused legacy)
└── components/
    ├── ControlledDocumentForm.tsx   # Title / description / appendix / form number
    ├── CorporateSchemeSelector.tsx  # Entity / dept / doc type / revision + ID preview
    ├── SignOffSection.tsx           # Tri-tier approval matrix (searchable user select)
    ├── NewDocumentModal.tsx         # "New Document" modal (wraps above 3)
    ├── DocumentRegistryTable.tsx    # MDR table + upload revision trigger
    ├── DocumentDetailModal.tsx      # Document details + revision history view
    └── UploadRevisionModal.tsx      # Revision file upload + per-revision sign-off
```

Server side:

```
server/
├── routes/document-generator.ts   # All REST API endpoints
├── constants/documentGenerator.ts # Server-side constants (entities, depts, types, prefix)
├── db.ts                          # SQLite schema + migrations (incl. docgen tables)
└── types/index.ts                 # Shared types (DocumentVersion, etc.)
```

---

## 3. Data Model

### 3.1 Database Tables

#### `generated_documents`

Stores each issued controlled document.

| Column             | Type    | Notes                                         |
| ------------------ | ------- | --------------------------------------------- |
| `id`               | TEXT PK | UUID                                          |
| `document_id`      | TEXT    | e.g. `HC-01-COR-LE-0001`                      |
| `entity_code`      | TEXT    | Entity code (`01`..`08`)                      |
| `department_code`  | TEXT    | Dept code (`COR`, `ADM`, `HSE`, ...)          |
| `doc_type_code`    | TEXT    | Doc type code (`LE`, `ME`, `CS`, ...)         |
| `year`             | TEXT    | 2-digit year (`26`)                           |
| `sequence_number`  | INTEGER | 4-digit sequence within entity/dept/type/year |
| `revision`         | TEXT    | e.g. `Rev 00`                                 |
| `title`            | TEXT    | Document title/subject                        |
| `prepared_by_id`   | TEXT    | User ID of preparer                           |
| `prepared_by_name` | TEXT    | Preparer name                                 |
| `checked_by_name`  | TEXT    | Checker name                                  |
| `approved_by_name` | TEXT    | Approver name                                 |
| `prepared_by_date` | TEXT    | Prepare date (ISO)                            |
| `checked_by_date`  | TEXT    | Check date (ISO)                              |
| `approved_by_date` | TEXT    | Approve date (ISO)                            |
| `doc_date`         | TEXT    | Document date                                 |
| `content_json`     | TEXT    | JSON of title/description/appendix/formNumber |
| `file_name`        | TEXT    | Stored file name                              |
| `created_at`       | TEXT    | ISO timestamp                                 |
| `updated_at`       | TEXT    | ISO timestamp                                 |

#### `document_versions`

Stores each uploaded revision file plus per-revision sign-off capture.

| Column             | Type    | Notes                               |
| ------------------ | ------- | ----------------------------------- |
| `id`               | TEXT PK | UUID                                |
| `document_id`      | TEXT FK | References `generated_documents.id` |
| `revision`         | TEXT    | Revision identifier                 |
| `file_name`        | TEXT    | Original uploaded filename          |
| `file_path`        | TEXT    | Relative stored path                |
| `file_size`        | INTEGER | Bytes                               |
| `uploaded_by`      | TEXT    | User ID who uploaded                |
| `uploaded_at`      | TEXT    | ISO timestamp                       |
| `note`             | TEXT    | Change note                         |
| `prepared_by_name` | TEXT    | Signer at revision time             |
| `checked_by_name`  | TEXT    | Signer at revision time             |
| `approved_by_name` | TEXT    | Signer at revision time             |
| `prepared_by_date` | TEXT    | Sign date at revision time          |
| `checked_by_date`  | TEXT    | Sign date at revision time          |
| `approved_by_date` | TEXT    | Sign date at revision time          |

#### `document_sequences`

Tracks the last sequence number per entity/department/docType/year combination for ID generation.

| Column            | Type    |
| ----------------- | ------- |
| `entity_code`     | TEXT    |
| `department_code` | TEXT    |
| `doc_type_code`   | TEXT    |
| `year`            | TEXT    |
| `last_sequence`   | INTEGER |
| `updated_at`      | TEXT    |

### 3.2 Migration Behavior

`server/db.ts` runs self-healing migrations on startup:

- Creates `document_versions` if missing
- Adds signer columns (`prepared_by_name`, `checked_by_name`, `approved_by_name`, `prepared_by_date`, `checked_by_date`, `approved_by_date`) to existing `document_versions` rows via `ALTER TABLE ... ADD COLUMN`
- Adds sign-off date columns to `generated_documents` if missing

---

## 4. Document Numbering Scheme

**Format:** `HC-<Entity>-<Department>-<DocType>-<Seq>`

Example: `HC-01-COR-LE-0001`

| Segment      | Source                             | Values                                                                 |
| ------------ | ---------------------------------- | ---------------------------------------------------------------------- |
| `HC`         | `DOC_PREFIX`                       | Fixed prefix                                                           |
| `Entity`     | `ENTITIES`                         | `01` Head Office, `02` Manufacturing Shop, `03` Haris & Co Saudia, ... |
| `Department` | `DEPARTMENTS`                      | `COR` Corporate, `ADM` Administration, `HSE` HSE, ...                  |
| `DocType`    | `DOCUMENT_TYPES`                   | `LE` Letter, `ME` Memo, `CS` Calculation Sheet, ...                    |
| `Seq`        | `document_sequences.last_sequence` | Zero-padded 4 digits (`0001`, `0002`, ...)                             |

The sequence is scoped per `(entity_code, department_code, doc_type_code, year)`. On each new document, the sequence increments by 1.

**Revision options:** `Rev 00`, `Rev 01`, `Rev 02`, `Rev 03`, `Rev 04`, `Rev A`, `Rev B`, `Rev C`

---

## 5. API Endpoints

All endpoints require Bearer token authentication (`Authorization: Bearer <token>`) and screen-access check for `document_generator` (IT role always has access; other roles need a `screen_overrides` row).

Base path: `/api/document-generator`

| Method | Endpoint                                      | Description                                                         |
| ------ | --------------------------------------------- | ------------------------------------------------------------------- |
| `GET`  | `/options`                                    | Returns entities, departments, document types, prefix               |
| `GET`  | `/preview-id?entity=&department=&docType=`    | Computes next document ID without saving                            |
| `POST` | `/generate`                                   | Create a new controlled document record                             |
| `GET`  | `/documents`                                  | List documents (filter by entity/department/docType/year/search)    |
| `GET`  | `/documents/:id`                              | Get single document by ID or document_id                            |
| `POST` | `/documents/:id/revision`                     | Update the revision of an existing document                         |
| `POST` | `/documents/:id/upload`                       | Upload a revision file (.doc/.docx, ≤15 MB) + per-revision sign-off |
| `GET`  | `/documents/:id/versions`                     | List all revision versions for a document (oldest→newest)           |
| `GET`  | `/documents/:id/versions/:versionId/download` | Download a specific revision file                                   |

### `POST /generate` body

| Field            | Type   | Required | Description                                                       |
| ---------------- | ------ | -------- | ----------------------------------------------------------------- |
| `entityCode`     | string | Yes      | Entity code                                                       |
| `departmentCode` | string | Yes      | Department code                                                   |
| `docTypeCode`    | string | Yes      | Document type code                                                |
| `title`          | string | Yes      | Document title                                                    |
| `year`           | string | No       | 2-digit year (default: current)                                   |
| `revision`       | string | No       | Revision (default: `Rev 00`)                                      |
| `preparedByName` | string | No       | Preparer name                                                     |
| `checkedByName`  | string | No       | Checker name                                                      |
| `approvedByName` | string | No       | Approver name                                                     |
| `preparedByDate` | string | No       | Prepare date ISO                                                  |
| `checkedByDate`  | string | No       | Check date ISO                                                    |
| `approvedByDate` | string | No       | Approve date ISO                                                  |
| `docDate`        | string | No       | Document date ISO                                                 |
| `contentJson`    | string | No       | JSON string of `{title, description, appendixNumber, formNumber}` |

### `POST /documents/:id/upload` (multipart/form-data)

| Field              | Type   | Required | Description                            |
| ------------------ | ------ | -------- | -------------------------------------- |
| `file`             | file   | No       | .doc or .docx, max 15 MB               |
| `revision`         | string | No       | Revision (auto-incremented if omitted) |
| `note`             | string | No       | Change note                            |
| `prepared_by_name` | string | No       | Signer name at revision time           |
| `checked_by_name`  | string | No       | Checker name at revision time          |
| `approved_by_name` | string | No       | Approver name at revision time         |
| `prepared_by_date` | string | No       | Sign date ISO                          |
| `checked_by_date`  | string | No       | Check date ISO                         |
| `approved_by_date` | string | No       | Approve date ISO                       |

---

## 6. Frontend Architecture

### 6.1 Main Container (`index.tsx`)

Renders two sub-tabs:

- **registry** — Master Document Register table
- **access** — Screen Access Manager (IT role only)

Provides the "New Document" button which opens `NewDocumentModal`. Handles:

- `handleSaveDraft` — calls `saveDraft()` (generates via API, registers document)
- `handleDownload` — calls `downloadDocument()` then generates Word .docx via `generateDocumentWord()` and downloads blob
- `handleDownloadWordFromRegistry` — generates Word for an existing registry record
- `handleViewDocument` — opens `DocumentDetailModal`

### 6.2 Hook: `useDocumentGenerator`

Manages new-document state:

- `entityCode`, `departmentCode`, `docTypeCode`, `year`, `revision` — dropdown selections
- `previewId` — auto-generated document ID (fetched from `/preview-id`)
- `docTitle` — document title
- `signOff` — `{preparedByName, checkedByName, approvedByName, preparedByDate, checkedByDate, approvedByDate}`
- `controlledData` — `{title, description, appendixNumber, formNumber}`
- `submitDocument()` / `saveDraft()` — POST to `/generate`
- `downloadDocument()` — triggers Word generation + blob download

### 6.3 Hook: `useDocumentRegistry`

Manages the MDR:

- `documents`, `loading`, `error`
- Filters: `filterEntity`, `filterDepartment`, `filterDocType`, `filterYear`, `searchQuery`
- `refreshDocuments()` — GET `/documents`
- `updateRevision(documentId, newRevision)` — POST `/documents/:id/revision`

### 6.4 Components

| Component                 | Purpose                                                                 |
| ------------------------- | ----------------------------------------------------------------------- |
| `CorporateSchemeSelector` | Entity/dept/doctype/revision dropdowns + read-only document ID preview  |
| `ControlledDocumentForm`  | Title, description, appendix number, form/document number inputs        |
| `SignOffSection`          | Tri-tier approval matrix with searchable user selection from `allUsers` |
| `NewDocumentModal`        | Wraps the three above; Save Draft / Download buttons                    |
| `DocumentRegistryTable`   | MDR data table; per-row Download Word / Upload Revision / View actions  |
| `UploadRevisionModal`     | Revision file upload + per-revision sign-off capture                    |
| `DocumentDetailModal`     | Document metadata, sign-off matrix, revision history table              |

---

## 7. Revision Management

### 7.1 Creating a Document (Rev 00)

User fills entity/dept/doctype, title/description/appendix/form number, sign-off matrix, clicks **Download** (or **Save Draft**). The system:

1. Fetches/preview next document ID from `/preview-id`
2. POSTs to `/generate` → inserts into `generated_documents`
3. Generates Word .docx from `word-new-template.docx` with placeholders replaced
4. Downloads the `.docx` blob

### 7.2 Uploading a Revision

From the MDR table, click **Upload Rev** on a document. The `UploadRevisionModal` opens:

- Shows current revision and default next revision
- Optional file upload (.doc/.docx ≤15 MB)
- Optional change note
- **Per-revision sign-off**: Prepared/Checked/Approved name + date captured at upload time
- Submits multipart/form-data to `/documents/:id/upload`

Server:

- Inserts into `document_versions` with revision, file, note, and signer fields
- Updates `generated_documents.revision` to the new revision

### 7.3 Viewing Revision History

Open `DocumentDetailModal` (View button). Fetches `GET /documents/:id/versions` (oldest→newest) and renders a table of revision, change note, uploaded date.

### 7.4 Word Revision Table

The template contains Table 0 with 9 columns. On Word generation, `injectRevisionRows()` writes each version into successive rows starting at row 2:

| Col | Field                     |
| --- | ------------------------- |
| 0   | Revision                  |
| 1   | Date (DD-MM-YYYY)         |
| 2   | Description / Change Note |
| 3   | Prepared initials         |
| 4   | Prepared date             |
| 5   | Checked initials          |
| 6   | Checked date              |
| 7   | Approved initials         |
| 8   | Approved date             |

Versions are ordered **oldest→newest** so the revision log reads incrementally top-to-bottom. Per-revision signer data is used when available, falling back to current sign-off.

---

## 8. Word Document Generation

### 8.1 Template (`word-new-template.docx`)

A `.docx` file containing placeholder strings wrapped in `{}`. The generator loads it via `JSZip`, iterates all `.xml` parts, and substitutes placeholders with runtime values.

### 8.2 Placeholder Map (`wordGenerator.ts` `values` object)

| Placeholder                                                   | Source                                      |
| ------------------------------------------------------------- | ------------------------------------------- |
| `{Revision}` / `{revision}`                                   | `revision` param                            |
| `{DOC_DATE}` / `{docDate}`                                    | `docDate` param                             |
| `{DESCRIPTION}` / `{description}`                             | `content.description`                       |
| `{PREPARED_BY}` / `{preparedBy}`                              | `signOff.preparedByName`                    |
| `{PREPARED_BY_DATE}` / `{preparedByDate}`                     | `signOff.preparedByDate`                    |
| `{CHECKED_BY}` / `{checkedBy}`                                | `signOff.checkedByName`                     |
| `{CHECKED_BY_DATE}` / `{checkedByDate}`                       | `signOff.checkedByDate`                     |
| `{APPROVED_BY}` / `{approvedBy}`                              | `signOff.approvedByName`                    |
| `{APPROVED _BY_DATE}` / `{approvedByDate}`                    | `signOff.approvedByDate`                    |
| `{APPENDIX}` / `{appendix}`                                   | `appendixNumber`                            |
| `{DOC_NUMBER}` / `{docNumber}` / `{Document Number}`          | `formNumber`                                |
| `{TITLE}` / `{title}` / `{DocumentTitle}` / `{documentTitle}` | `content.title`                             |
| `{COMPANY_NAME}`                                              | `'HARIS & Co Engineering Concern Pvt Ltd.'` |
| `{REV_TABLE_*}`                                               | Latest version data (rev table summary)     |
| `{harisco logo}`                                              | Logo URL                                    |

Revision-table placeholders (`{REV_TABLE_REVISION}`, `{REV_TABLE_DATE}`, `{REV_TABLE_DESCRIPTION}`, etc.) reflect the **latest** version only.

### 8.3 Revision Table Injection

`injectRevisionRows()` operates on Table 0:

- Locates `<w:tbl>...</w:tbl>`
- Reads all `<w:tr>` rows
- For each version (oldest→newest), writes into `rows[2 + v]`
- Stops when `rowIdx >= rows.length` (extra versions beyond table rows are not written)

**Note:** The template's table must have at least N+2 rows (2 header + N revisions) to accommodate all versions.

### 8.4 Two-Pass Replacement

1. `replaceWithinNodes()` — replaces placeholders contained entirely within a single `<w:t>` node
2. `replaceAcrossRuns()` — replaces placeholders that span multiple `<w:t>` runs (combines all text, finds matches, rewrites segments)

---

## 9. Constants Reference

### Entities (`src/tabs/DocumentGenerator/constants.ts`)

| Code | Name                     |
| ---- | ------------------------ |
| `01` | Head Office              |
| `02` | Manufacturing Shop       |
| `03` | Haris & Co Saudia        |
| `04` | Haris Engineering Saudia |
| `05` | Haris IT Company         |
| `06` | XYZ (Reserved)           |
| `07` | ABD (Reserved)           |
| `08` | GHT (Reserved)           |

### Departments

`COR`, `ADM`, `HRC`, `BDV`, `HSE`, `QUA`, `QUC`, `PMT`, `CAS`, `WRH`, `CSL`, `ACF`, `IAU`, `IMS`, `PRP`, `PRC`, `ENG`, `PLN`

### Document Types (by category)

**Correspondence:** `LE` Letter, `ME` Memo, `FX` Fax, `TR` Transmittal, `EM` Emails, `NF` Information

**Engineering:** `CS` Calculation Sheet, `DB` Design Basis, `DR` Drawings, `DS` Data Sheets, `EL` Equipment List, `LI` Line List, `FC` Field Change Sheet, `SP` Specifications / Procedures, `ST` Standard Tables

**Commercial:** `BQ` Bill of Material, `BU` Budgets, `CE` Cost Estimation, `CO` Change Order, `NV` Invoices, `PO` Purchase Orders, `PP` Proposal, `RQ` Requisitions, `TD` Tender Documents, `WE` Work Estimates

**Quality & HSE:** `TP` Inspection and Test Plans, `OM` Operation Manual, `PR` Progress Reports, `RP` Reports, `PL` Plan, `SC` Schedules / Planning

**Maintenance & Lists:** `AL` List of Accessory, `DC` Document Control Lists, `SL` Spare Parts List, `TL` Tool List, `TM` Standard Templates, `LM` List (Miscellaneous), `LL` Lubrication List

### Revision Options

`Rev 00`, `Rev 01`, `Rev 02`, `Rev 03`, `Rev 04`, `Rev A`, `Rev B`, `Rev C`

---

## 10. Access Control

Screen name: `document_generator`

- **IT role** (`role === 'it'`): full access to all endpoints
- **Other roles**: requires a row in `screen_overrides` where `screen_name = 'document_generator'` and `user_id = <current user>` and the user is active

Checked via `checkAccess()` in `server/routes/document-generator.ts` on every endpoint.

---

## 11. Usage Workflow

### Create a New Document

1. Click **New Document**
2. Select Entity, Department, Document Type, Revision (document ID auto-previews)
3. Enter Document Title, Description, Appendix Number, Form Number
4. Select Prepared / Checked / Approved signers and dates
5. Click **Download** → generates Word .docx and registers the document
6. (Optional) Click **Save Draft** to register without downloading

### Upload a Revision

1. Open **Document Registry** tab
2. Find the document, click **Upload Rev**
3. Select revision (auto-increments from current)
4. Optional: attach .doc/.docx file (≤15 MB)
5. Optional: change note
6. **Important:** Fill Prepared/Checked/Approved name + date to capture signers at revision time
7. Click **Upload Revision**

### View / Download Existing

1. From MDR table:
   - **Download** → regenerates Word .docx with latest data + revision table
   - **Upload Rev** → open revision upload modal
   - **View** → open document detail modal (metadata, sign-off matrix, revision history)

### Filter the Registry

Use the toolbar filters: Entity, Department, Doc Type, Year, and free-text search (searches Document ID, Title, Prepared By).

---

## 12. TypeScript Interfaces (`types.ts`)

```ts
export interface DocumentSignOff {
  preparedByName: string;
  checkedByName: string;
  approvedByName: string;
  preparedByDate: string;
  checkedByDate: string;
  approvedByDate: string;
}

export interface ControlledDocumentData {
  title: string;
  description: string;
  appendixNumber: string;
  formNumber: string;
}

export interface GeneratedDocumentRecord {
  id: string;
  document_id: string;
  entity_code: string;
  department_code: string;
  doc_type_code: string;
  year: string;
  sequence_number: number;
  revision: string;
  title: string;
  prepared_by_id: string;
  prepared_by_name: string;
  checked_by_name: string | null;
  approved_by_name: string | null;
  prepared_by_date: string | null;
  checked_by_date: string | null;
  approved_by_date: string | null;
  doc_date: string;
  content_json: string | null;
  file_name: string;
  created_at: string;
  updated_at: string;
}
```

Server `DocumentVersion` (from `server/types/index.ts`):

```ts
export interface DocumentVersion {
  id: string;
  document_id: string;
  revision: string;
  file_name: string;
  file_path: string;
  file_size: number;
  uploaded_by: string;
  uploaded_at: string;
  note: string | null;
  prepared_by_name?: string | null;
  checked_by_name?: string | null;
  approved_by_name?: string | null;
  prepared_by_date?: string | null;
  checked_by_date?: string | null;
  approved_by_date?: string | null;
}
```

---

## 13. Known Limitations

1. **Revision table row capacity:** The Word template's Table 0 must have enough data rows (≥ 2 header + number of revisions). Extra versions beyond available rows are silently dropped.
2. **Per-revision signers for old versions:** Versions uploaded before the signer-capture feature was added will fall back to the current sign-off in the revision table (no historical signer data exists).
3. **Single file per version:** Only one .doc/.docx file can be attached per revision upload.
4. **No PDF generation:** The `file_name` stored is `.pdf` but generation produces `.docx`; this is a legacy naming convention.

---

## 14. Verification Commands

```bash
# TypeScript typecheck
npm run typecheck

# Lint
npm run lint

# Build
npm run build
```

---

_End of documentation_
