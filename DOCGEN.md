# Haris & Co. — Document Generator (DOCGEN) Implementation Plan

> **Status:** Ratified & Approved Plan (Ready for Implementation when requested)  
> **Target Module:** `harisco-ticketing-system` Document Generator Tab  
> **Document Control:** `HC-IT-DOCGEN-PLAN-2601`  
> **Revision:** Rev 01  
> **Scope:** Final Architecture, Master Data Schemes, Database Design, UI Workflows, and PDF Layouts.

---

## 1. Executive Summary & Purpose

The **Document Generator** is an enterprise-grade document control, numbering, and generation system embedded inside the Haris & Co. Ticketing System (`harisco-ticketing-system`).

### Core Objectives
1. **Corporate Standard Compliance:** Enforce the official Haris & Co. **Corporate Revision Number Scheme** across all legal entities, departments, and document types.
2. **Automated Sequence & ID Generation:** Eliminate manual document numbering errors by automatically reserving and generating unique, collision-proof Document IDs with zero-padded sequence counters (`HC-{Entity}-{Department}-{DocType}-{YY}{SN}`).
3. **Professional Document Production:** Produce standardized, executive-ready documents:
   - **Excel (.xlsx):** Spreadsheet with Document Control Block (ID, Revision, Entity, Department, Doc Type, Date, Title, Description, Sign-Off).
   - **Word (.docx):** Word document with Document Control Box and Controlled Document Content (Title + Description), wrapped in Haris & Co. branding.
4. **Document Registry & Audit Trail:** Maintain a permanent, searchable Master Document Register (MDR) of all generated documents, download histories, and revision versions in SQLite with IT role-based access control (`screen_overrides`).

---

## 2. Ratified Document ID & Numbering Scheme

Based on alignment with Haris & Co. Corporate and Engineering standards, the unified ID format is:

```text
HC-{Entity}-{Department}-{DocType}-{SN}
```

### 2.1 Format Breakdown

| Component | Code Format | Description / Example |
| :--- | :---: | :--- |
| **Prefix** | `HC` | Harisco Control corporate prefix |
| **Entity** | `01` – `08` | Legal entity code (e.g. `01` for Head Office, `03` for Haris & Co Saudia) |
| **Department** | 3 Letters | Department / Discipline code (e.g. `ENG`, `COR`, `HSE`, `IT`) |
| **Doc Type** | 2 Letters | Standardized Document Type code (e.g. `LE`, `ME`, `TR`, `DR`, `SP`) |
| **Sequence (`SN`)** | 4 Digits | Zero-padded sequential counter starting at `0001` (expands to `1000+` if > 9999) |

- **Example 1 (Memo):** `HC-01-COR-ME-0001` *(Head Office — Corporate — Memo — Seq 0001)*
- **Example 2 (Letter):** `HC-03-BDV-LE-0002` *(Haris & Co Saudia — Business Development — Letter — Seq 0002)*
- **Example 3 (Drawing):** `HC-01-ENG-DR-0005` *(Head Office — Engineering — Drawing — Seq 0005)*
- **Example 4 (Transmittal):** `HC-04-PMT-TR-0001` *(Haris Engineering Saudia — Project Management — Transmittal — Seq 0001)*

The `year` field is stored in the database (`document_sequences`, `generated_documents`) for backward compatibility and audit purposes, but it is **not** part of the displayed Document ID string.

### 2.2 Revision Control
- **Revision Code:** Managed as a dedicated field: `Rev 00` (initial issue), `Rev 01`, `Rev 02`, or alphabetic `Rev A`, `Rev B` for preliminary engineering review.
- Displayed prominently in the Document Control Block on the generated PDF and stored in the database.
- A "Create Revision" action allows users to issue an updated version under the same Document ID, incrementing the revision tag and tracking version history.

### 2.3 Sequence Scope & Rules
- **Scope Key:** `Entity + Department + DocType` for ID generation; `year` column is stored in `document_sequences` and `generated_documents` tables for backward compatibility and audit tracking.
- **Atomic Counter:** Handled via SQLite transactions to guarantee that two users generating documents simultaneously will never receive duplicate sequence numbers.
- **No Yearly Reset:** Sequence numbers do not reset at the beginning of each calendar year — they continue incrementing per Entity + Department + DocType scope.

---

## 3. Master Reference Tables

### 3.1 Entity Reference Table (Dropdown 1)

| Code | Entity Description | Operational Territory / Role |
| :---: | :--- | :--- |
| **01** | Head Office | Principal Executive Office |
| **02** | Manufacturing Shop | Fabrication & Production Facility |
| **03** | Haris & Co Saudia | Saudi Arabia Branch / Operations |
| **04** | Haris Engineering Saudia | Engineering Services KSA |
| **05** | Haris IT Company | Technology & Digital Solutions |
| **06** | XYZ | Reserved / Joint Venture / Future Entity |
| **07** | ABD | Reserved / Subsidiary / Future Entity |
| **08** | GHT | Reserved / Subsidiary / Future Entity |

---

### 3.2 Department / Discipline Reference Table (Dropdown 2)

| Code | Description | Functional Group |
| :---: | :--- | :--- |
| **COR** | Corporate | Executive & Governance |
| **ADM** | Administration | General Admin & Office Services |
| **HRC** | Human Resource Capital | Human Resources & Talent |
| **BDV** | Business Development | Commercial Growth & Client Relations |
| **HSE** | Health, Safety and Environment | Safety, Compliance & Environmental |
| **QUA** | Quality Assurance | QA Systems & Audits |
| **QUC** | Quality Control | QC Inspection & Verification |
| **PMT** | Project Management | Project Execution & Delivery |
| **CAS** | Commissioning and After Sales | Field Commissioning & Client Support |
| **WRH** | Warehouse | Stores & Inventory Control |
| **CSL** | Commercial, Shipment, Logistics | Supply Chain, Shipping & Customs |
| **ACF** | Accounts & Finance | Financial Management & Treasury |
| **IAU** | Internal Audit | Internal Financial & Ops Audit |
| **IMS** | Integration Management System | ISO / Integrated Mgmt Standards |
| **PRP** | Proposal | Bid Management & Estimations |
| **PRC** | Procurement | Purchasing & Vendor Sourcing |
| **ENG** | Engineering | Design, Technical & Drafting |
| **PLN** | Planning | Master Scheduling & Resource Planning |

---

### 3.3 Types Of Document Reference Table (Dropdown 3)

The 37 standard document types are categorized below:

#### A. Correspondence & Communication
| Code | Description | Specialized Phase 1 Form |
| :---: | :--- | :---: |
| **LE** | Letter | **Yes (Dedicated Layout)** |
| **ME** | Memo | **Yes (Dedicated Layout)** |
| **TR** | Transmittal | **Yes (Dedicated Layout)** |
| **FX** | Fax | Universal Sheet |
| **EM** | Emails | Universal Sheet |
| **NF** | Information | Universal Sheet |

#### B. Engineering, Design & Technical
| Code | Description | Specialized Phase 1 Form |
| :---: | :--- | :---: |
| **CS** | Calculation Sheet | Universal Sheet |
| **DB** | Design Basis | Universal Sheet |
| **DR** | Drawings | Universal Sheet |
| **DS** | Data Sheets | Universal Sheet |
| **EL** | Equipment List | Universal Sheet |
| **LI** | Line List | Universal Sheet |
| **FC** | Field Change Sheet | Universal Sheet |
| **SP** | Specifications / Procedures | Universal Sheet |
| **ST** | Standard Tables | Universal Sheet |

#### C. Commercial, Procurement & Estimations
| Code | Description | Specialized Phase 1 Form |
| :---: | :--- | :---: |
| **BQ** | Bill of Material (Quantity) | Universal Sheet |
| **BU** | Budgets | Universal Sheet |
| **CE** | Cost Estimation | Universal Sheet |
| **CO** | Change Order | Universal Sheet |
| **NV** | Invoices | Universal Sheet |
| **PO** | Purchase Orders | Universal Sheet |
| **PP** | Proposal | Universal Sheet |
| **RQ** | Requisitions | Universal Sheet |
| **TD** | Tender Documents | Universal Sheet |
| **WE** | Work Estimates | Universal Sheet |

#### D. Quality, HSE & Field Operations
| Code | Description | Specialized Phase 1 Form |
| :---: | :--- | :---: |
| **TP** | Inspection and Test Plans | Universal Sheet |
| **OM** | Operation Manual | Universal Sheet |
| **PR** | Progress Reports / Write Ups | Universal Sheet |
| **RP** | Reports | Universal Sheet |
| **PL** | Plan | Universal Sheet |
| **SC** | Schedules / Planning | Universal Sheet |

#### E. Maintenance, Materials & Lists
| Code | Description | Specialized Phase 1 Form |
| :---: | :--- | :---: |
| **AL** | List of Accessory | Universal Sheet |
| **DC** | Document Control Lists | Universal Sheet |
| **SL** | Spare Parts List | Universal Sheet |
| **TL** | Tool List | Universal Sheet |
| **LL** | Lubrication List | Universal Sheet |
| **LM** | List (Miscellaneous) | Universal Sheet |
| **TM** | Standard Templates | Universal Sheet |

---

## 4. Phase 1 Document Layouts

### 4.1 Controlled Document Content (All 38 Doc Types)

Every document type shares the same controlled content form — there are no per-type dedicated layouts (Letter/Memo/Transmittal/Universal are merged into one). The content section contains exactly two input fields:

1. **Document Title / Subject** — free-text title or subject line.
2. **Document Description** — multi-paragraph description / executive overview.

The Document Control Box surrounding the content displays:
- Document ID (`HC-{Entity}-{Department}-{DocType}-{YY}{SN}`)
- Revision (`Rev 00`, `Rev 01`, …)
- Issue Date
- Entity, Department, Doc Type
- Year & Sequence

No References/Attachments table and no Tri-Approval sign-off box in Phase 1. Those are deferred to a later phase.

---

## 5. System Architecture & Tech Stack

```mermaid
graph TD
    SubGraph UI["Frontend (React 19 + TypeScript + Framer Motion)"]
        Sidebar["Sidebar Nav ('Document Generator')"]
        AccessGate["ScreenAccessManager (IT Managed via screen_overrides)"]
        TabContainer["DocumentGenerator Tab Container"]
        
        SubTab1["New Document (Form & Live Preview)"]
        SubTab2["Master Document Register (MDR)"]
        SubTab3["Access Management (IT Only)"]
        
        CorporateDropdowns["Corporate Scheme Selectors\n(Entity, Dept, DocType)"]
        LiveIdBadge["Real-Time Document ID Display\n(HC-01-ENG-DR-0001)"]
        DynamicForm["Controlled Document Content\n(Title + Description)"]
        ExcelGenerator["Excel (.xlsx) Generation\n(exceljs)"]
        WordGenerator["Word (.docx) Generation\n(docx)"]
    end

    subgraph Server ["Backend (Node.js + Express 5)"]
        AuthMiddleware["authenticateToken & Role Security"]
        DocRoutes["/api/document-generator/*"]
        
        NextIdEndpoint["GET /preview-id"]
        GenerateEndpoint["POST /generate-and-register"]
        ListEndpoint["GET /documents"]
        RevisionEndpoint["POST /documents/:id/revision"]
    end

    subgraph Database ["SQLite Database (WAL Mode)"]
        SeqTable[("document_sequences\n(entity_code, department_code, doc_type_code, year, last_sequence)")]
        DocTable[("generated_documents\n(id, document_id, entity_code, department_code, doc_type_code, year, sequence_number, title, ...)")]
        AuditLog[("activity_logs\n(actor, action, timestamp)")]
    end

    Sidebar --> AccessGate --> TabContainer
    TabContainer --> SubTab1 & SubTab2 & SubTab3
    SubTab1 --> CorporateDropdowns --> LiveIdBadge
    SubTab1 --> DynamicForm --> ExcelGenerator
    SubTab1 --> DynamicForm --> WordGenerator
    
    NextIdEndpoint --> SeqTable
    GenerateEndpoint --> SeqTable
    GenerateEndpoint --> DocTable
    GenerateEndpoint --> AuditLog
    SubTab2 --> ListEndpoint --> DocTable
```

---

## 6. Database Schema Design (SQLite)

### 6.1 `document_sequences` Table
Guarantees atomic, collision-free sequence numbers across concurrent requests.

```sql
CREATE TABLE IF NOT EXISTS document_sequences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_code TEXT NOT NULL,
  department_code TEXT NOT NULL,
  doc_type_code TEXT NOT NULL,
  year TEXT NOT NULL,
  last_sequence INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  UNIQUE(entity_code, department_code, doc_type_code, year)
);
```

### 6.2 `generated_documents` Table
Master register of all generated corporate documents.

```sql
CREATE TABLE IF NOT EXISTS generated_documents (
  id TEXT PRIMARY KEY,                       -- UUID v4
  document_id TEXT UNIQUE NOT NULL,          -- e.g. HC-01-ENG-DR-0001
  entity_code TEXT NOT NULL,                 -- e.g. 01
  department_code TEXT NOT NULL,             -- e.g. ENG
  doc_type_code TEXT NOT NULL,               -- e.g. DR
  year TEXT NOT NULL,                        -- e.g. 26
  sequence_number INTEGER NOT NULL,          -- e.g. 1
  revision TEXT NOT NULL DEFAULT 'Rev 00',   -- e.g. Rev 00, Rev 01
  title TEXT NOT NULL,                       -- Document Subject/Title
  prepared_by_id TEXT NOT NULL,              -- FK users.id
  checked_by_name TEXT,                      -- Reviewer Name
  approved_by_name TEXT,                     -- Approver Name
  doc_date TEXT NOT NULL,                    -- Document issue date (ISO)
  content_json TEXT,                         -- Form inputs & document body
  file_name TEXT NOT NULL,                   -- e.g. HC-01-ENG-DR-0001.pdf
  created_at TEXT NOT NULL,                  -- ISO Timestamp
  updated_at TEXT NOT NULL,                  -- ISO Timestamp
  FOREIGN KEY (prepared_by_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_gen_docs_entity ON generated_documents(entity_code);
CREATE INDEX IF NOT EXISTS idx_gen_docs_dept ON generated_documents(department_code);
CREATE INDEX IF NOT EXISTS idx_gen_docs_doctype ON generated_documents(doc_type_code);
CREATE INDEX IF NOT EXISTS idx_gen_docs_year ON generated_documents(year);
```

---

## 7. Step-by-Step Implementation Roadmap

When authorized to proceed with implementation, development will follow these 5 clear phases:

### Phase 1: Database & Sequence Engine
- Add `document_sequences` and `generated_documents` table creation in [server/db.ts](file:///home/shae/Repos/harisco-ticketing-system/server/db.ts).
- Implement atomic sequence counter in `server/routes/document-generator.ts` with collision prevention.
- Register router in `server/index.ts`.

### Phase 2: Frontend Scheme Selectors & State Management
- Create `src/tabs/DocumentGenerator/` folder structure.
- Build `CorporateSchemeSelector.tsx` dropdowns (Entity, Department, DocType) with live search and descriptions.
- Implement live ID generator badge that computes previews without burning sequence numbers.

### Phase 3: Single Controlled Document Form Template
- Create `src/tabs/DocumentGenerator/components/ControlledDocumentForm.tsx` with exactly two content inputs:
  - Document Title / Subject
  - Document Description
- Replaces the previous four per-type templates (`LetterForm`, `MemoForm`, `TransmittalForm`, `UniversalDocumentForm`) — one generic form serves all 38 doc types.
- Add Document Control Box around the content (ID, Revision, Issue Date, Entity, Dept, Doc Type, Year, Sequence).

### Phase 4: Excel & Word Document Generation
- Create `src/tabs/DocumentGenerator/utils/excelGenerator.ts` using `exceljs`.
  - Document Control Block: Document ID, Revision, Document Type, Entity, Department, Issue Date, Title / Subject, Description, Prepared By, Checked / Reviewed By, Approved By.
  - Confidentiality footer.
- Create `src/tabs/DocumentGenerator/utils/wordGenerator.ts` using `docx`.
  - Document Control Box with shaded header row + Controlled Document Content (Title + Description).
  - Confidentiality footer.
- Live download buttons for Excel (.xlsx) and Word (.docx); no PDF generation.

### Phase 5: Master Document Register (MDR), RBAC & Navigation
- Build `DocumentRegistryTable.tsx` for searching, filtering, and re-downloading documents.
- Implement "Create Revision" workflow.
- Integrate with `ScreenAccessManager` and `screen_overrides` with `screen_name = 'document_generator'`.
- Add menu item to [src/components/Sidebar/index.tsx](file:///home/shae/Repos/harisco-ticketing-system/src/components/Sidebar/index.tsx) with Lucide icon.

---
*Created by AI Pair Programmer for Haris & Co. Engineering & Corporate Documentation System.*
