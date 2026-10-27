import React from 'react';

import { DEPARTMENTS, ENTITIES, DOCUMENT_TYPES, REVISION_OPTIONS } from '../constants';

interface CorporateSchemeSelectorProps {
  entityCode: string;
  setEntityCode: (val: string) => void;
  departmentCode: string;
  setDepartmentCode: (val: string) => void;
  docTypeCode: string;
  setDocTypeCode: (val: string) => void;
  revision: string;
  setRevision: (val: string) => void;
  previewId: string;
  previewLoading: boolean;
}

export const CorporateSchemeSelector: React.FC<CorporateSchemeSelectorProps> = ({
  entityCode,
  setEntityCode,
  departmentCode,
  setDepartmentCode,
  docTypeCode,
  setDocTypeCode,
  revision,
  setRevision,
  previewId,
  previewLoading,
}) => {
  const selectedEntity = ENTITIES.find((e) => e.code === entityCode);
  const selectedDept = DEPARTMENTS.find((d) => d.code === departmentCode);
  const selectedDocType = DOCUMENT_TYPES.find((t) => t.code === docTypeCode);

  return (
    <div className="docgen-card">
      <div className="docgen-card-header">
        <div>
          <h3 className="docgen-card-title">Corporate Revision Number Scheme</h3>
          <span className="docgen-card-subtitle">
            Select entity, department, and document type to compute the official document number.
          </span>
        </div>
      </div>

      <div className="docgen-grid-4">
        <div className="docgen-input-group">
          <label htmlFor="scheme-entity" className="docgen-label">
            1. Entity
          </label>
          <select
            id="scheme-entity"
            className="docgen-select"
            value={entityCode}
            onChange={(e) => setEntityCode(e.target.value)}
          >
            {ENTITIES.map((ent) => (
              <option key={ent.code} value={ent.code}>
                {ent.code} — {ent.name}
              </option>
            ))}
          </select>
          {selectedEntity?.description && (
            <span className="docgen-input-hint">{selectedEntity.description}</span>
          )}
        </div>

        <div className="docgen-input-group">
          <label htmlFor="scheme-department" className="docgen-label">
            2. Department / Discipline
          </label>
          <select
            id="scheme-department"
            className="docgen-select"
            value={departmentCode}
            onChange={(e) => setDepartmentCode(e.target.value)}
          >
            {DEPARTMENTS.map((dept) => (
              <option key={dept.code} value={dept.code}>
                {dept.code} — {dept.name}
              </option>
            ))}
          </select>
          <span className="docgen-input-hint">Active: {selectedDept?.name}</span>
        </div>

        <div className="docgen-input-group">
          <label htmlFor="scheme-doctype" className="docgen-label">
            3. Types Of Doc ({DOCUMENT_TYPES.length})
          </label>
          <select
            id="scheme-doctype"
            className="docgen-select"
            value={docTypeCode}
            onChange={(e) => setDocTypeCode(e.target.value)}
          >
            {DOCUMENT_TYPES.map((type) => (
              <option key={type.code} value={type.code}>
                {type.code} — {type.name} {type.category ? `(${type.category})` : ''}
              </option>
            ))}
          </select>
          <span className="docgen-input-hint">
            Active: {selectedDocType?.name}
          </span>
        </div>

        <div className="docgen-input-group">
          <label htmlFor="scheme-revision" className="docgen-label">
            Revision
          </label>
          <select
            id="scheme-revision"
            className="docgen-select"
            value={revision}
            onChange={(e) => setRevision(e.target.value)}
          >
            {REVISION_OPTIONS.map((rev) => (
              <option key={rev} value={rev}>
                {rev}
              </option>
            ))}
          </select>
          <span className="docgen-input-hint">Initial Issue: Rev 00</span>
        </div>
      </div>

      <div style={{ marginTop: '1rem' }}>
        <div className="docgen-input-group">
          <label htmlFor="scheme-doc-id" className="docgen-label">
            Document ID (Auto-Generated)
          </label>
          <input
            id="scheme-doc-id"
            type="text"
            readOnly
            className="docgen-input docgen-input-id"
            value={previewLoading ? 'Generating...' : previewId || 'HC-01-COR-LE-0001'}
          />
        </div>
      </div>
    </div>
  );
};
