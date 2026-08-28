import {
  Activity,
  Bell,
  Building2,
  Calendar,
  ChevronDown,
  Factory,
  MapPin,
  Menu,
  Settings2,
  Ticket,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

import type { ActiveTab, AppUser, UserRole } from '../../types';

import logoFull from '../../assets/harisco-full-logo.png';
import { ROLE_LABELS } from '../../constants';
import { formatEmployeeCode } from '../../utils';
import './Sidebar.css';

interface HeaderProps {
  currentUser: AppUser;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onLogout: () => void;
  onChangePasswordClick: () => void;
}

interface MenuItem {
  id?: ActiveTab;
  label: string;
  icon: React.ElementType;
  roles: UserRole[];
  notAllowedDepartments?: string[];
  children?: MenuItem[];
}

const MENU_ITEMS: MenuItem[] = [
  {
    id: 'noticeboard',
    label: 'Noticeboard',
    icon: Bell,
    roles: ['it', 'employee', 'manager', 'executive'],
  },
  {
    label: 'Tickets',
    icon: Ticket,
    roles: ['it', 'employee', 'manager', 'executive'],
    children: [
      {
        id: 'tickets',
        label: 'IT',
        icon: Ticket,
        roles: ['it', 'employee', 'manager', 'executive'],
        notAllowedDepartments: ['Staff'],
      },
      {
        id: 'admin_tickets',
        label: 'Admin',
        icon: Activity,
        roles: ['it', 'executive', 'manager', 'employee'],
      },
    ],
  },
  {
    label: 'System',
    icon: Settings2,
    roles: ['it'],
    children: [
      {
        id: 'users',
        label: 'User Management',
        icon: Users,
        roles: ['it'],
      },
      {
        id: 'activity_log',
        label: 'Activity Logs',
        icon: Activity,
        roles: ['it', 'manager', 'executive'],
        notAllowedDepartments: ['Staff'],
      },
    ],
  },
  {
    label: 'HR',
    icon: Building2,
    roles: ['it', 'employee', 'manager', 'executive'],
    children: [
      {
        id: 'attendance',
        label: 'Attendance',
        icon: UserCheck,
        roles: ['it', 'employee', 'manager', 'executive'],
      },
      {
        id: 'leaves',
        label: 'Leave Management',
        icon: Calendar,
        roles: ['it', 'employee', 'manager', 'executive'],
      },
      {
        id: 'site_duties',
        label: 'Site Duties',
        icon: MapPin,
        roles: ['it', 'employee', 'manager', 'executive'],
        notAllowedDepartments: ['Staff'],
      },
    ],
  },
  {
    label: 'Factory',
    icon: Factory,
    roles: ['it', 'factory_it', 'factory_manager', 'factory_employee'],
    children: [
      {
        id: 'factory_attendance',
        label: 'Attendance',
        icon: UserCheck,
        roles: ['it', 'manager', 'factory_it', 'factory_manager', 'factory_employee'],
      },
      {
        id: 'factory_users',
        label: 'User Management',
        icon: Users,
        roles: ['it', 'factory_it'],
      },
    ],
  },
];

function isItemVisible(item: MenuItem, userRole: UserRole, userDepartment: string | undefined): boolean {
  if (!item.roles.includes(userRole)) return false;
  if (item.notAllowedDepartments?.includes(userDepartment ?? 'unknown')) return false;
  if (item.children) {
    return item.children.some((child) => isItemVisible(child, userRole, userDepartment));
  }
  return true;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  activeTab,
  setActiveTab,
  onLogout,
  onChangePasswordClick,
}) => {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(formatDate(new Date()));
  const [currentTime, setCurrentTime] = useState(formatTime(new Date()));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileUserMenuOpen, setMobileUserMenuOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const visibleItems = MENU_ITEMS.filter((item) => isItemVisible(item, currentUser.role, currentUser.department));

  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
    setOpenDropdown(null);
    setMobileMenuOpen(false);
  };

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => (prev.includes(label) ? prev.filter((g) => g !== label) : [...prev, label]));
  };

  const handleMouseEnter = (label: string) => {
    setOpenDropdown(label);
  };

  const handleMouseLeave = () => {
    setOpenDropdown(null);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentDate(formatDate(new Date()));
      setCurrentTime(formatTime(new Date()));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="app-header">
      {/* Row 1: Date | Title | Time */}
      <div className="header-top-strip">
        <span className="header-date">{currentDate}</span>
        <span className="header-title">Haris & Co. Dashboard</span>
        <span className="header-time">{currentTime}</span>
      </div>

      {/* Row 2: Logo | Nav | User Info */}
      <div className="header-main">
        {/* Mobile hamburger - visible on mobile only */}
        <button
          className="header-hamburger"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>

        <div className="header-section header-section-left">
          <div className="logo-container">
            <img src={logoFull} alt="Harisco Logo" className="logo-full" />
          </div>
        </div>

        {/* Desktop nav - centered */}
        <nav className="header-nav">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            if (item.children) {
              const isOpen = openDropdown === item.label;
              const visibleChildren = item.children.filter((child) =>
                isItemVisible(child, currentUser.role, currentUser.department)
              );
              if (visibleChildren.length === 0) return null;

              return (
                <div
                  key={item.label}
                  className="header-dropdown"
                  ref={dropdownRef}
                  onMouseEnter={() => handleMouseEnter(item.label)}
                  onMouseLeave={handleMouseLeave}
                >
                  <button
                    className={`header-nav-item ${isOpen ? 'active' : ''}`}
                    aria-haspopup="true"
                    aria-expanded={isOpen}
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                    <ChevronDown size={14} className={`dropdown-chevron ${isOpen ? 'open' : ''}`} />
                  </button>
                  <div className={`dropdown-menu ${isOpen ? 'open' : ''}`}>
                    {visibleChildren.map((child) => {
                      const ChildIcon = child.icon;
                      const isChildActive = child.id === activeTab;
                      return (
                        <button
                          key={child.id}
                          className={`dropdown-item ${isChildActive ? 'active' : ''}`}
                          onClick={() => child.id && handleTabChange(child.id)}
                        >
                          <ChildIcon size={16} />
                          <span>{child.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            }

            return (
              <button
                key={item.id}
                className={`header-nav-item ${activeTab === item.id ? 'active' : ''}`}
                onClick={() => item.id && handleTabChange(item.id)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="header-section header-section-right">
          {/* Desktop: full user info + actions */}
          <div className="header-desktop-actions">
            <div className="header-user-section">
              {currentUser.avatar ? (
                <img src={currentUser.avatar} alt={currentUser.name} className="header-user-avatar" />
              ) : (
                <div className="header-user-avatar-fallback">{getInitials(currentUser.name)}</div>
              )}
              <div className="header-user-info">
                <span className="header-user-name">{currentUser.name}</span>
                <span className="header-user-code">{formatEmployeeCode(currentUser.username || currentUser.id)}</span>
                <span className={`role-badge-pill role-badge-${currentUser.role.replace('factory_', '')}`}>
                  {ROLE_LABELS[currentUser.role]}
                </span>
              </div>
            </div>
            <div className="header-actions">
              <button
                id="btn-header-reset-password"
                className="btn btn-secondary header-action-btn"
                onClick={onChangePasswordClick}
              >
                <span className="btn-icon-only">
                  <svg
                    width="0.85rem"
                    height="0.85rem"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                  </svg>
                </span>
              </button>
              <button id="btn-header-logout" className="btn btn-danger header-action-btn" onClick={onLogout}>
                <span className="btn-icon-only">
                  <svg
                    width="0.85rem"
                    height="0.85rem"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                </span>
              </button>
            </div>
          </div>

          {/* Mobile: compact user button that reveals actions */}
          <div className="header-mobile-user">
            <button
              className="header-mobile-user-btn"
              onClick={() => setMobileUserMenuOpen(!mobileUserMenuOpen)}
              aria-label="User menu"
            >
              {currentUser.avatar ? (
                <img src={currentUser.avatar} alt={currentUser.name} className="header-user-avatar" />
              ) : (
                <div className="header-user-avatar-fallback">{getInitials(currentUser.name)}</div>
              )}
              <span className="header-mobile-user-name">{currentUser.name}</span>
              <ChevronDown size={14} className={`header-mobile-user-chevron ${mobileUserMenuOpen ? 'open' : ''}`} />
            </button>
            {mobileUserMenuOpen && (
              <div className="header-mobile-user-menu">
                <button
                  className="header-mobile-user-action"
                  onClick={() => {
                    onChangePasswordClick();
                    setMobileUserMenuOpen(false);
                  }}
                >
                  <svg width="0.85rem" height="0.85rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                  </svg>
                  <span>Change Password</span>
                </button>
                <button
                  className="header-mobile-user-action"
                  onClick={() => {
                    onLogout();
                    setMobileUserMenuOpen(false);
                  }}
                >
                  <svg width="0.85rem" height="0.85rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile off-canvas sidebar */}
      {mobileMenuOpen && (
        <>
          <div className="mobile-backdrop" onClick={() => setMobileMenuOpen(false)} />
          <aside className="mobile-sidebar">
            <div className="mobile-sidebar-header">
              <div className="logo-container">
                <img src={logoFull} alt="Harisco Logo" className="logo-full" />
              </div>
              <button className="mobile-sidebar-close" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu">
                <X size={22} />
              </button>
            </div>

            <nav className="mobile-sidebar-nav">
              {visibleItems.map((item) => {
                const Icon = item.icon;
                if (item.children) {
                  const visibleChildren = item.children.filter((child) =>
                    isItemVisible(child, currentUser.role, currentUser.department)
                  );
                  if (visibleChildren.length === 0) return null;

                  const isExpanded = expandedGroups.includes(item.label);

                  return (
                    <div key={item.label} className="mobile-sidebar-group">
                      <button className="mobile-sidebar-group-toggle" onClick={() => toggleGroup(item.label)}>
                        <Icon size={18} />
                        <span>{item.label}</span>
                        <ChevronDown size={16} className={`mobile-sidebar-chevron ${isExpanded ? 'open' : ''}`} />
                      </button>
                      {isExpanded && (
                        <div className="mobile-sidebar-children">
                          {visibleChildren.map((child) => {
                            const ChildIcon = child.icon;
                            const isChildActive = child.id === activeTab;
                            return (
                              <button
                                key={child.id}
                                className={`mobile-sidebar-item ${isChildActive ? 'active' : ''}`}
                                onClick={() => child.id && handleTabChange(child.id)}
                              >
                                <ChildIcon size={16} />
                                <span>{child.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <button
                    key={item.id}
                    className={`mobile-sidebar-item ${activeTab === item.id ? 'active' : ''}`}
                    onClick={() => item.id && handleTabChange(item.id)}
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="mobile-sidebar-footer">
              <div className="header-user-section">
                {currentUser.avatar ? (
                  <img src={currentUser.avatar} alt={currentUser.name} className="header-user-avatar" />
                ) : (
                  <div className="header-user-avatar-fallback">{getInitials(currentUser.name)}</div>
                )}
                <div className="header-user-info">
                  <span className="header-user-name">{currentUser.name}</span>
                  <span className="header-user-code">{formatEmployeeCode(currentUser.username || currentUser.id)}</span>
                  <span className={`role-badge-pill role-badge-${currentUser.role.replace('factory_', '')}`}>
                    {ROLE_LABELS[currentUser.role]}
                  </span>
                </div>
              </div>
              <div className="header-actions">
                <button
                  id="btn-header-reset-password"
                  className="btn btn-secondary header-action-btn"
                  onClick={onChangePasswordClick}
                >
                  <span className="btn-icon-only">
                    <svg
                      width="0.85rem"
                      height="0.85rem"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                    </svg>
                  </span>
                </button>
                <button id="btn-header-logout" className="btn btn-danger header-action-btn" onClick={onLogout}>
                  <span className="btn-icon-only">
                    <svg
                      width="0.85rem"
                      height="0.85rem"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                  </span>
                </button>
              </div>
            </div>
          </aside>
        </>
      )}
    </header>
  );
};
