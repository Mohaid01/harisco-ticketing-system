import React from 'react';

import logoFull from '../../assets/harisco-full-logo.png';

export const SidebarHeader: React.FC = () => {
  return (
    <div className="sidebar-header">
      <div className="logo-container">
        <img src={logoFull} alt="Harisco Logo" className="logo-full" />
      </div>
      <span className="sidebar-tagline">IT Support Operations</span>
    </div>
  );
};
