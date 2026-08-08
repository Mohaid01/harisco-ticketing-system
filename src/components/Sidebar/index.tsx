import { Activity, Bell, Calendar, ClipboardList, MapPin, Ticket, UserCheck, Users } from 'lucide-react';
import React from 'react';

import type { ActiveTab, AppUser, MenuItems } from '../../types';

import './Sidebar.css';
import { SidebarFooter } from './SidebarFooter';
import { SidebarHeader } from './SidebarHeader';
import { SidebarNav } from './SidebarNav';

interface SidebarProps {
  currentUser: AppUser;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onLogout: () => void;
  onChangePasswordClick: () => void;
}

const MENU_ITEMS: MenuItems[] = [
  {
    id: 'noticeboard' as ActiveTab,
    label: 'Noticeboard',
    icon: Bell,
    roles: ['it', 'employee', 'manager', 'executive'],
  },
  {
    id: 'tickets' as ActiveTab,
    label: 'IT Tickets',
    icon: Ticket,
    roles: ['it', 'employee', 'manager', 'executive'],
    notAllowedDepartments: ['Staff'],
  },
  {
    id: 'admin_tickets' as ActiveTab,
    label: 'Admin Tickets',
    icon: ClipboardList,
    roles: ['it', 'executive', 'manager', 'employee'],
  },
  {
    id: 'users' as ActiveTab,
    label: 'HQ User Management',
    icon: Users,
    roles: ['it'],
  },
  {
    id: 'attendance' as ActiveTab,
    label: 'HQ Attendance',
    icon: UserCheck,
    roles: ['it', 'employee', 'manager', 'executive'],
  },
  {
    id: 'leaves' as ActiveTab,
    label: 'HQ Leave Management',
    icon: Calendar,
    roles: ['it', 'employee', 'manager', 'executive'],
  },
  {
    id: 'site_duties' as ActiveTab,
    label: 'HQ Site Duties',
    icon: MapPin,
    roles: ['it', 'employee', 'manager', 'executive'],
    notAllowedDepartments: ['Staff'],
  },
  {
    id: 'activity_log' as ActiveTab,
    label: 'Activity Logs',
    icon: Activity,
    roles: ['it', 'manager', 'executive'],
    notAllowedDepartments: ['Staff'],
  },
  {
    id: 'factory_users' as ActiveTab,
    label: 'Factory User Management',
    icon: Users,
    roles: ['it', 'factory_it'],
  },
  {
    id: 'factory_attendance' as ActiveTab,
    label: 'Factory Attendance',
    icon: UserCheck,
    roles: ['it', 'manager', 'factory_it', 'factory_manager', 'factory_employee'],
  },
];

export const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  activeTab,
  setActiveTab,
  onLogout,
  onChangePasswordClick,
}) => {
  const visibleItems = MENU_ITEMS.filter(
    (item) =>
      item.roles.includes(currentUser.role) &&
      !(item.notAllowedDepartments ?? []).includes(currentUser.department ?? 'unknown')
  );

  const getRoleBadgeClass = (role: string) => {
    return `role-badge-pill role-badge-${role.replace('factory_', '')}`;
  };

  return (
    <aside className="sidebar">
      <SidebarHeader />
      <SidebarNav items={visibleItems} activeTab={activeTab} onTabChange={setActiveTab} />
      <SidebarFooter
        currentUser={currentUser}
        getRoleBadgeClass={getRoleBadgeClass}
        onLogout={onLogout}
        onChangePasswordClick={onChangePasswordClick}
      />
    </aside>
  );
};
