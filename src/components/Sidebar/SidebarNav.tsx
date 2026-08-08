import React from 'react';

import type { ActiveTab, MenuItems } from '../../types';

interface SidebarNavProps {
  items: MenuItems[];
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({ items, activeTab, onTabChange }) => {
  return (
    <nav className="sidebar-nav">
      <ul className="sidebar-menu">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <li key={item.id}>
              <button
                id={`sidebar-tab-${item.id}`}
                className={`sidebar-item ${isActive ? 'active' : ''}`}
                onClick={() => onTabChange(item.id)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
