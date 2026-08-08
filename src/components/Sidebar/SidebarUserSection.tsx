import React from 'react';

import type { AppUser } from '../../types';

import { ROLE_LABELS } from '../../constants';
import { formatEmployeeCode } from '../../utils';
import './Sidebar.css';

interface SidebarUserSectionProps {
  currentUser: AppUser;
  getRoleBadgeClass: (role: string) => string;
}

export const SidebarUserSection: React.FC<SidebarUserSectionProps> = ({ currentUser, getRoleBadgeClass }) => {
  return (
    <div className="sidebar-user-section">
      {currentUser.avatar ? (
        <img src={currentUser.avatar} alt={currentUser.name} className="sidebar-user-avatar" />
      ) : (
        <div className="sidebar-user-avatar-fallback">
          {currentUser.name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2)}
        </div>
      )}
      <div className="sidebar-user-info">
        <span className="sidebar-user-name">{currentUser.name}</span>
        <span className="sidebar-user-code">
          Employee Code: {formatEmployeeCode(currentUser.username || currentUser.id)}
        </span>
        <div>
          <span className={getRoleBadgeClass(currentUser.role)}>{ROLE_LABELS[currentUser.role]}</span>
        </div>
      </div>
    </div>
  );
};
