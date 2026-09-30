import React from 'react';

interface CVFieldsetProps {
  title: string;
  icon?: React.ReactNode;
  hint?: string;
  children: React.ReactNode;
}

export const CVFieldset: React.FC<CVFieldsetProps> = ({ title, icon, hint, children }) => (
  <section className="cv-fieldset">
    <div className="cv-fieldset-header">
      <h3 className="cv-fieldset-title">
        {icon}
        {title}
      </h3>
      {hint && <span className="cv-fieldset-hint">{hint}</span>}
    </div>
    <div className="cv-fieldset-body">{children}</div>
  </section>
);

export default CVFieldset;
