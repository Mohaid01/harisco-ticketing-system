import React from 'react';

import type { AppUser } from '../../types';

interface CVGeneratorProps {
  currentUser: AppUser;
}

export const CVGenerator: React.FC<CVGeneratorProps> = ({ currentUser }) => {
  return (
    <div>
      <div style={{ marginBottom: '1.275rem' }}>
        <h1 className="page-title">CV Generator</h1>
        <p className="page-subtitle">
          Generate a professional CV based on your profile and ticketing activity.
        </p>
      </div>

      <div className="panel" style={{ padding: '1.275rem' }}>
        <div style={{ padding: '1.275rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: '0.5rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          CV generation features are coming soon.
        </div>
      </div>
    </div>
  );
};
