import React, { useState } from 'react';

import type { GeneratedDocumentRecord } from '../types';

import { DEPARTMENTS, ENTITIES, DOCUMENT_TYPES } from '../constants';
import { UploadRevisionModal } from './UploadRevisionModal';

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
  onDownloadWord: (doc: GeneratedDocumentRecord) => void;
  token: string;
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
  onDownloadWord,
  token,
}) => {
  const [uploadDoc, setUploadDoc] = useState<{
    id: string;
    document_id: string;
    revision: string;
    title: string;
  } | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const handleOpenUpload = (doc: GeneratedDocumentRecord) => {
    setUploadDoc({
      id: doc.id,
      document_id: doc.document_id,
      revision: doc.revision || 'Rev 00',
      title: doc.title,
    });
    setUploadOpen(true);
  };

  const handleUploadSuccess = () => {
    setUploadOpen(false);
    onRefresh();
  };

  return (
    <div className="docgen-card">
      <div className="docgen-card-header">
        <div>
          <h3 className="docgen-card-title">Master Document Register (MDR)</h3>
          <span className="docgen-card-subtitle">
            Complete registry of issued corporate documents
          </span>
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

          <button type="button" className="docgen-btn docgen-btn-secondary" onClick={onRefresh}>
            Refresh
          </button>
        </div>
      </div>

      <div className="docgen-table-wrap">
        <table className="docgen-table">
          <thead>
            <tr>
              <th>Doc Id</th>
              <th>Rev</th>
              <th>Doc Title</th>
              <th>Prepared By</th>
              <th>Date</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                  Loading Master Document Register...
                </td>
              </tr>
            ) : documents.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                  No documents found matching the filter criteria.
                </td>
              </tr>
            ) : (
              documents.map((doc) => (
                <tr key={doc.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#38bdf8' }}>
                    {doc.document_id}
                  </td>
                  <td style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{doc.revision}</td>
                  <td
                    style={{ maxWidth: '240px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                    title={doc.title}
                  >
                    {doc.title}
                  </td>
                  <td>{doc.prepared_by_name}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{doc.doc_date}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button
                      type="button"
                      className="docgen-btn docgen-btn-primary"
                      style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem', marginRight: '0.4rem' }}
                      onClick={() => onDownloadWord(doc)}
                    >
                      Download
                    </button>
                    <button
                      type="button"
                      className="docgen-btn docgen-btn-secondary"
                      style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem' }}
                      onClick={() => handleOpenUpload(doc)}
                    >
                      Upload Rev
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {uploadOpen && uploadDoc && (
        <UploadRevisionModal
          document={uploadDoc}
          token={token}
          isOpen={uploadOpen}
          onClose={() => setUploadOpen(false)}
          onSuccess={handleUploadSuccess}
        />
      )}
    </div>
  );
};
