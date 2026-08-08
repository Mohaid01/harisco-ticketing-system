import { Key, LogOut } from 'lucide-react';
import React from 'react';

import type { AppUser } from '../../types';

import { SidebarUserSection } from './SidebarUserSection';

interface SidebarFooterProps {
  currentUser: AppUser;
  getRoleBadgeClass: (role: string) => string;
  onLogout: () => void;
  onChangePasswordClick: () => void;
}

export const SidebarFooter: React.FC<SidebarFooterProps> = ({
  currentUser,
  getRoleBadgeClass,
  onLogout,
  onChangePasswordClick,
}) => {
  return (
    <div className="sidebar-footer sidebar-actions">
      <SidebarUserSection currentUser={currentUser} getRoleBadgeClass={getRoleBadgeClass} />
      <button
        id="btn-sidebar-reset-password"
        className="btn btn-secondary sidebar-action-btn sidebar-reset-btn"
        onClick={onChangePasswordClick}
      >
        <Key size={14} />
        Reset Password
      </button>
      <button id="btn-sidebar-logout" className="btn btn-danger sidebar-action-btn" onClick={onLogout}>
        <LogOut size={14} />
        Sign Out
      </button>
    </div>
  );
};
