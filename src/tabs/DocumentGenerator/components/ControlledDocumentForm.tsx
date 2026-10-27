import React from 'react';

import type { ControlledDocumentData } from '../types';

interface ControlledDocumentFormProps {
  data: ControlledDocumentData;
  onChange: React.Dispatch<React.SetStateAction<ControlledDocumentData>>;
}

export const ControlledDocumentForm: React.FC<ControlledDocumentFormProps> = ({
  data,
  onChange,
}) => {
  const updateField = (field: keyof ControlledDocumentData, value: string) => {
    onChange((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="docgen-card">
      <div className="docgen-card-header">
        <div>
          <h3 className="docgen-card-title">Controlled Document Content</h3>
          <span className="docgen-card-subtitle">
            Document Title / Subject and Document Description for all 38 document types.
          </span>
        </div>
      </div>

      <div className="docgen-input-group" style={{ marginBottom: '1rem' }}>
        <label htmlFor="controlled-title" className="docgen-label">
          Document Title / Subject
        </label>
        <input
          id="controlled-title"
          type="text"
          className="docgen-input"
          value={data.title}
          onChange={(e) => updateField('title', e.target.value)}
          placeholder="e.g. Electrical Load Calculation Sheet - Building C"
          required
        />
      </div>

      <div className="docgen-input-group">
        <label htmlFor="controlled-description" className="docgen-label">
          Document Description
        </label>
        <textarea
          id="controlled-description"
          className="docgen-textarea"
          rows={8}
          value={data.description}
          onChange={(e) => updateField('description', e.target.value)}
          placeholder="State the purpose, scope, and key details of this controlled document."
        />
      </div>
    </div>
  );
};
