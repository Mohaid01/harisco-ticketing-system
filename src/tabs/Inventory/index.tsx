import { Filter, HardDrive, Layers, Search, Trash2, UserCheck, UserPlus } from 'lucide-react';
import React, { useMemo, useState } from 'react';

import type { AppUser, Inventory, InventoryStatus } from '../../types';

import { LoadingSpinner } from '../../components/LoadingSpinner';
import { INVENTORY_CATEGORY_OPTIONS, INVENTORY_STATUS_LABELS, INVENTORY_STATUS_OPTIONS } from '../../constants';
import './Inventory.css';

interface InventoryTabProps {
  inventory: Inventory[];
  users: AppUser[];
  currentUser: AppUser;
  defaultSubTab?: 'all' | 'stocked' | 'assigned';
  defaultSearchQuery?: string;
  defaultCompanyFilter?: string;
  defaultEntityFilter?: string;
  onSubTabChange?: (tab: 'all' | 'stocked' | 'assigned') => void;
  onSearchChange?: (q: string) => void;
  onCompanyFilterChange?: (c: string) => void;
  onEntityFilterChange?: (e: string) => void;
  onRegisterClick: () => void;
  onAssignOpen: (inventoryId: string) => void;
  onUpdateInventory: (id: string, patch: { status?: InventoryStatus; assigned_user_id?: string | null }) => void;
  onDeleteInventory: (id: string) => void;
  loading?: boolean;
}

const inputFieldStyle: React.CSSProperties = {
  flex: '1',
  width: '100%',
  height: '38px',
  padding: '6px 12px',
  backgroundColor: 'var(--bg-primary)',
  boxSizing: 'border-box',
};

export const InventoryTab: React.FC<InventoryTabProps> = ({
  inventory,
  users,
  currentUser,
  defaultSubTab,
  defaultSearchQuery,
  defaultCompanyFilter,
  defaultEntityFilter,
  onSubTabChange,
  onSearchChange,
  onCompanyFilterChange,
  onEntityFilterChange,
  onRegisterClick,
  onAssignOpen,
  onUpdateInventory,
  onDeleteInventory,
  loading = false,
}) => {
  const [internalSubTab, setInternalSubTab] = useState<'all' | 'stocked' | 'assigned'>('all');
  const [searchQuery, setSearchQuery] = useState<string>(defaultSearchQuery ?? '');
  const [companyFilter, setCompanyFilter] = useState<string>(defaultCompanyFilter ?? 'all');
  const [entityFilter, setEntityFilter] = useState<string>(defaultEntityFilter ?? 'all');

  const subTab = defaultSubTab ?? internalSubTab;

  const handleSubTabChange = (tab: 'all' | 'stocked' | 'assigned') => {
    setInternalSubTab(tab);
    onSubTabChange?.(tab);
  };

  const companies = useMemo(() => [...new Set(inventory.map((i) => i.company).filter(Boolean))].sort(), [inventory]);
  const entities = useMemo(() => [...new Set(inventory.map((i) => i.entity).filter(Boolean))].sort(), [inventory]);

  // Accurate counts across the whole inventory
  const allCount = inventory.length;
  const stockedCount = useMemo(
    () => inventory.filter((i) => (i.status || '').toLowerCase() === 'stocked').length,
    [inventory]
  );
  const assignedCount = useMemo(
    () => inventory.filter((i) => (i.status || '').toLowerCase() === 'assigned').length,
    [inventory]
  );

  const filteredInventory = useMemo(() => {
    let base = inventory;
    if (subTab === 'stocked') {
      base = inventory.filter((i) => (i.status || '').toLowerCase() === 'stocked');
    } else if (subTab === 'assigned') {
      base = inventory.filter((i) => (i.status || '').toLowerCase() === 'assigned');
    }

    const q = searchQuery.toLowerCase().trim();

    return base
      .filter((item) => {
        const matchesSearch =
          !q ||
          (item.device_id || '').toLowerCase().includes(q) ||
          (item.sn_mac_address || '').toLowerCase().includes(q) ||
          (item.company || '').toLowerCase().includes(q) ||
          (item.entity || '').toLowerCase().includes(q) ||
          (item.category || '').toLowerCase().includes(q) ||
          (item.details || '').toLowerCase().includes(q);
        const matchesCompany = companyFilter === 'all' || item.company === companyFilter;
        const matchesEntity = entityFilter === 'all' || item.entity === entityFilter;
        return matchesSearch && matchesCompany && matchesEntity;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [inventory, subTab, searchQuery, companyFilter, entityFilter]);

  const isIT = currentUser.role === 'it';

  const getStatusBadge = (status: InventoryStatus) => {
    const opt = INVENTORY_STATUS_OPTIONS.find((o) => o.value.toLowerCase() === (status || '').toLowerCase());
    return (
      <span
        className="badge"
        style={{
          backgroundColor: opt?.bg || 'rgba(100, 116, 139, 0.12)',
          color: opt?.color || '#64748b',
        }}
      >
        {INVENTORY_STATUS_LABELS[status] || status}
      </span>
    );
  };

  const getCategoryBadge = (category: string) => {
    const opt = INVENTORY_CATEGORY_OPTIONS.find((o) => o.value.toLowerCase() === (category || '').toLowerCase());
    return (
      <span
        className="badge"
        style={{
          backgroundColor: opt?.bg || 'rgba(100, 116, 139, 0.12)',
          color: opt?.color || '#64748b',
          fontSize: '0.75rem',
        }}
      >
        {opt?.label || category}
      </span>
    );
  };

  const getAssignedUserName = (assignedUserId: string | null, assignedUserName?: string | null) => {
    if (assignedUserName) return assignedUserName;
    if (!assignedUserId) return null;
    const user = users.find((u) => u.id === assignedUserId);
    return user ? user.name : assignedUserId;
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.275rem',
        }}
      >
        <div>
          <h1 className="page-title">Inventory Tracking</h1>
          <p className="page-subtitle">
            Manage company devices and hardware inventory across stocked, assigned, and active states.
          </p>
        </div>
        {isIT && (
          <button id="btn-register-inventory" className="btn btn-primary" onClick={onRegisterClick}>
            <UserPlus size={16} />
            Register Inventory
          </button>
        )}
      </div>

      {/* Sub-tab bar */}
      <div className="inventory-tab-bar">
        <button
          id="tab-all-inventory"
          className={`btn ${subTab === 'all' ? 'btn-primary' : 'btn-secondary'} inventory-tab-btn`}
          onClick={() => handleSubTabChange('all')}
        >
          <Layers size={14} /> All Inventory ({allCount})
        </button>
        <button
          id="tab-stocked-inventory"
          className={`btn ${subTab === 'stocked' ? 'btn-primary' : 'btn-secondary'} inventory-tab-btn`}
          onClick={() => handleSubTabChange('stocked')}
        >
          <HardDrive size={14} /> Stocked Inventory ({stockedCount})
        </button>
        <button
          id="tab-assigned-inventory"
          className={`btn ${subTab === 'assigned' ? 'btn-primary' : 'btn-secondary'} inventory-tab-btn`}
          onClick={() => handleSubTabChange('assigned')}
        >
          <UserCheck size={14} /> Assigned Inventory ({assignedCount})
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="panel" style={{ padding: '0.85rem 1.0625rem', marginBottom: '1.275rem' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px 16px',
            width: '100%',
            alignItems: 'center',
          }}
        >
          <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '220px' }}>
            <input
              id="search-inventory-input"
              type="text"
              placeholder="Search device ID, SN/MAC, company, category..."
              className="form-input"
              style={{
                width: '100%',
                paddingLeft: '36px',
                height: '38px',
                backgroundColor: 'var(--bg-primary)',
              }}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                onSearchChange?.(e.target.value);
              }}
            />
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: '0.6375rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '0 0 auto' }}>
            <Filter size={14} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Company:</span>
            <select
              id="filter-company-select"
              className="form-input"
              style={{ ...inputFieldStyle, height: '38px' }}
              value={companyFilter}
              onChange={(e) => {
                setCompanyFilter(e.target.value);
                onCompanyFilterChange?.(e.target.value);
              }}
            >
              <option value="all">All Companies</option>
              {companies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '0 0 auto' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Entity:</span>
            <select
              id="filter-entity-select"
              className="form-input"
              style={{ ...inputFieldStyle, height: '38px' }}
              value={entityFilter}
              onChange={(e) => {
                setEntityFilter(e.target.value);
                onEntityFilterChange?.(e.target.value);
              }}
            >
              <option value="all">All Entities</option>
              {entities.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* showing inventory count */}
      <span className="stat-desc" style={{ textAlign: 'right' }}>
        Showing {filteredInventory.length} of {inventory.length} inventory
      </span>

      {/* Inventory List Table */}
      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Device ID</th>
                <th>SN / MAC</th>
                <th>Company</th>
                <th>Entity</th>
                <th>Category</th>
                <th>Details</th>
                <th>Status</th>
                <th>Assigned To</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <LoadingSpinner type="table" rows={6} />
              ) : (
                filteredInventory.map((item) => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 'bold', width: '9rem' }}>{item.device_id}</td>
                    <td style={{ fontSize: '0.85rem' }}>{item.sn_mac_address}</td>
                    <td style={{ fontSize: '0.85rem' }}>{item.company}</td>
                    <td style={{ fontSize: '0.85rem' }}>{item.entity}</td>
                    <td>{getCategoryBadge(item.category)}</td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{item.details}</td>
                    <td>{getStatusBadge(item.status)}</td>
                    <td style={{ fontSize: '0.85rem' }}>
                      {item.assigned_user_id || item.assigned_user_name ? (
                        <span style={{ color: 'var(--text-primary)' }}>
                          {getAssignedUserName(item.assigned_user_id, item.assigned_user_name)}
                        </span>
                      ) : (
                        <span
                          style={{
                            color: 'var(--text-muted)',
                            fontStyle: 'italic',
                          }}
                        >
                          —
                        </span>
                      )}
                    </td>
                    <td style={{ display: 'flex', flexDirection: 'column', gap: '0.425rem' }}>
                      {(item.status === 'Stocked' || !item.assigned_user_id) && isIT && (
                        <button
                          className="btn btn-secondary"
                          style={{ width: '100%', padding: '0.3188rem 0.5313rem', fontSize: '0.75rem' }}
                          onClick={() => onAssignOpen(item.id)}
                        >
                          Assign
                        </button>
                      )}
                      {item.status === 'Assigned' && isIT && (
                        <button
                          className="btn btn-secondary"
                          style={{ width: '100%', padding: '0.3188rem 0.5313rem', fontSize: '0.75rem' }}
                          onClick={() => onUpdateInventory(item.id, { status: 'Stocked', assigned_user_id: null })}
                        >
                          Un-assign
                        </button>
                      )}
                      {isIT && (
                        <button
                          className="btn btn-danger"
                          style={{ width: '100%', padding: '0.3188rem 0.5313rem', fontSize: '0.75rem' }}
                          onClick={() => onDeleteInventory(item.id)}
                        >
                          <Trash2 size={12} />
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
              {filteredInventory.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    style={{
                      textAlign: 'center',
                      padding: '2.55rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {subTab === 'stocked'
                      ? 'No stocked inventory available.'
                      : subTab === 'assigned'
                        ? 'No assigned inventory.'
                        : 'No inventory items found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
