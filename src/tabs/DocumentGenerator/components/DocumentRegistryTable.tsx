import React, { useState } from 'react';

import type { GeneratedDocumentRecord } from '../types';

import { DEPARTMENTS, ENTITIES, DOCUMENT_TYPES, REVISION_OPTIONS } from '../constants';

interface DocumentRegistryTableProps {
  documents: GeneratedDocumentRecord[];
  loading: boolean;
  filterEntity: string;
  setFilterEntity: (val: string) => void;
  filterDepartment: string;
  setFilterDepartment: (val: string) => void;
  filterDocType: string;
  setFilterDocType: (val: string) => void;
  filterYear: string;
  setFilterYear: (val: string) => void;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  onRefresh: () => void;
  onDownloadExcel: (doc: GeneratedDocumentRecord) => void;
  onDownloadWord: (doc: GeneratedDocumentRecord) => void;
  onUpdateRevision: (docId: string, newRev: string) => Promise<boolean>;
}

export const DocumentRegistryTable: React.FC<DocumentRegistryTableProps> = ({
  documents,
  loading,
  filterEntity,
  setFilterEntity,
  filterDepartment,
  setFilterDepartment,
  filterDocType,
  setFilterDocType,
  filterYear,
  setFilterYear,
  searchQuery,
  setSearchQuery,
  onRefresh,
  onDownloadExcel,
  onDownloadWord,
  onUpdateRevision,
}) => {
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [selectedRev, setSelectedRev] = useState<string>('Rev 01');

  const handleOpenRevModal = (doc: GeneratedDocumentRecord) => {
    setEditingDocId(doc.id);
    const currRev = doc.revision || 'Rev 00';
    if (currRev.startsWith('Rev 0')) {
      const num = parseInt(currRev.replace('Rev 0', ''), 10);
      setSelectedRev(`Rev 0${num + 1}`);
    } else {
      setSelectedRev('Rev 01');
    }
  };

  const handleConfirmRevision = async () => {
    if (!editingDocId) return;
    await onUpdateRevision(editingDocId, selectedRev);
    setEditingDocId(null);
  };

  return (
    <div className="docgen-card">
      <div className="docgen-card-header">
        <div>
          <h3 className="docgen-card-title">Master Document Register (MDR)</h3>
          <span className="docgen-card-subtitle">Complete registry of issued corporate documents and revision histories</span>
        </div>
      </div>

      <div className="docgen-registry-toolbar">
        <div style={{ flex: 1, minWidth: '220px' }}>
          <input
            type="text"
            className="docgen-input"
            placeholder="Search by Document ID, Title, or Prepared By..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="docgen-registry-filters">
          <select
            className="docgen-select"
            style={{ width: 'auto' }}
            value={filterEntity}
            onChange={(e) => setFilterEntity(e.target.value)}
          >
            <option value="">All Entities</option>
            {ENTITIES.map((e) => (
              <option key={e.code} value={e.code}>
                {e.code} — {e.name}
              </option>
            ))}
          </select>

          <select
            className="docgen-select"
            style={{ width: 'auto' }}
            value={filterDepartment}
            onChange={(e) => setFilterDepartment(e.target.value)}
          >
            <option value="">All Departments</option>
            {DEPARTMENTS.map((d) => (
              <option key={d.code} value={d.code}>
                {d.code} — {d.name}
              </option>
            ))}
          </select>

          <select
            className="docgen-select"
            style={{ width: 'auto' }}
            value={filterDocType}
            onChange={(e) => setFilterDocType(e.target.value)}
          >
            <option value="">All Doc Types</option>
            {DOCUMENT_TYPES.map((t) => (
              <option key={t.code} value={t.code}>
                {t.code} — {t.name}
              </option>
            ))}
          </select>

          <input
            type="text"
            className="docgen-input"
            placeholder="Year (26)"
            style={{ width: '85px' }}
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
          />

          <button
            type="button"
            className="docgen-btn docgen-btn-secondary"
            onClick={onRefresh}
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="docgen-table-wrap">
        <table className="docgen-table">
          <thead>
            <tr>
              <th>Document ID</th>
              <th>Rev</th>
              <th>Entity</th>
              <th>Dept</th>
              <th>Type</th>
              <th>Document Title</th>
              <th>Prepared By</th>
              <th>Date</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                  Loading Master Document Register...
                </td>
              </tr>
            ) : documents.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                  No documents found matching the filter criteria.
                </td>
              </tr>
            ) : (
              documents.map((doc) => (
                <tr key={doc.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#38bdf8' }}>
                    {doc.document_id}
                  </td>
                  <td style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {doc.revision}
                  </td>
                  <td>{doc.entity_code}</td>
                  <td>{doc.department_code}</td>
                  <td>{doc.doc_type_code}</td>
                  <td style={{ maxWidth: '240px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={doc.title}>
                    {doc.title}
                  </td>
                  <td>{doc.prepared_by_name}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{doc.doc_date}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button
                      type="button"
                      className="docgen-btn docgen-btn-secondary"
                      style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem', marginRight: '0.4rem' }}
                      onClick={() => onDownloadExcel(doc)}
                    >
                      Excel
                    </button>
                    <button
                      type="button"
                      className="docgen-btn docgen-btn-primary"
                      style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem' }}
                      onClick={() => onDownloadWord(doc)}
                    >
                      Word
                    </button>
                    <button
                      type="button"
                      className="docgen-btn docgen-btn-secondary"
                      style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem', marginLeft: '0.4rem' }}
                      onClick={() => handleOpenRevModal(doc)}
                    >
                      Rev
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editingDocId && (
        <div className="docgen-modal-backdrop">
          <div className="docgen-modal-box">
            <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              Update Document Revision
            </h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Select new revision tag for {documents.find((d) => d.id === editingDocId)?.document_id}
            </p>
            <div className="docgen-input-group" style={{ marginBottom: '1.25rem' }}>
              <label htmlFor="modal-rev-select" className="docgen-label">Revision</label>
              <select
                id="modal-rev-select"
                className="docgen-select"
                value={selectedRev}
                onChange={(e) => setSelectedRev(e.target.value)}
              >
                {REVISION_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem' }}>
              <button
                type="button"
                className="docgen-btn docgen-btn-secondary"
                onClick={() => setEditingDocId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="docgen-btn docgen-btn-primary"
                onClick={handleConfirmRevision}
              >
                Save Revision
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
