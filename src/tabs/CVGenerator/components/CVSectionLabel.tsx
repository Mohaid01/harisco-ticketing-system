import React from 'react';

import './CVGenerator.css';

interface CVSectionLabelProps {
  children: React.ReactNode;
  className?: string;
}

export const CVSectionLabel: React.FC<CVSectionLabelProps> = ({ children, className = '' }) => (
  <h3 className={`cv-section-label ${className}`}>{children}</h3>
);
