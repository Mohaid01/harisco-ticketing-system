import { CircleCheckBig, Edit, Filter, HardDrive, Layers, Search, Trash, UserCheck, UserPlus, X } from 'lucide-react';
import React, { useMemo, useState } from 'react';

import type { AppUser, Inventory, InventoryCategory, InventoryEntity, InventoryStatus } from '../../types';

import { LoadingSpinner } from '../../components/LoadingSpinner';
import {
  INVENTORY_CATEGORY_OPTIONS,
  INVENTORY_ENTITY_OPTIONS,
  INVENTORY_STATUS_LABELS,
  INVENTORY_STATUS_OPTIONS,
} from '../../constants';
import { generateDeviceId } from '../../utils';
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
  onUpdateInventory: (
    id: string,
    patch: {
      status?: InventoryStatus;
      assigned_user_id?: string | null;
      company?: string;
      entity?: InventoryEntity | null;
      category?: InventoryCategory;
      details?: string;
      sn_mac_address?: string;
      device_id?: string;
    }
  ) => void;
  onDeleteInventory: (id: string) => void;
  onRowClick?: (inventory: Inventory) => void;
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
  onRowClick,
  loading = false,
}) => {
  const [internalSubTab, setInternalSubTab] = useState<'all' | 'stocked' | 'assigned'>('all');
  const [searchQuery, setSearchQuery] = useState<string>(defaultSearchQuery ?? '');
  const [companyFilter, setCompanyFilter] = useState<string>(defaultCompanyFilter ?? 'all');
  const [entityFilter, setEntityFilter] = useState<string>(defaultEntityFilter ?? 'all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<Inventory> | null>(null);

  const subTab = defaultSubTab ?? internalSubTab;

  const handleSubTabChange = (tab: 'all' | 'stocked' | 'assigned') => {
    setInternalSubTab(tab);
    onSubTabChange?.(tab);
  };

  const companies = useMemo(() => [...new Set(inventory.map((i) => i.company).filter(Boolean))].sort(), [inventory]);
  const entities = useMemo(
    () => [...new Set(inventory.map((i) => i.entity).filter(Boolean))].sort() as InventoryEntity[],
    [inventory]
  );

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

  const isIT = currentUser.role === 'it' || currentUser.role === 'factory_it';
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

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

  const getAssignedUserName = (
    assignedUserId: string | null,
    assignedUserName?: string | null,
    userMapLocal?: Map<string, AppUser>
  ) => {
    if (assignedUserName) return assignedUserName;
    if (!assignedUserId) return null;
    const user = userMapLocal ? userMapLocal.get(assignedUserId) : users.find((u) => u.id === assignedUserId);
    return user ? user.name : assignedUserId;
  };

  const handleEditOpen = (item: Inventory) => {
    setEditingId(item.id);
    setEditDraft({ ...item });
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditDraft(null);
  };

  const handleEditSave = async (item: Inventory) => {
    if (!editDraft) return;
    const { company: manufacturer = item.company, category = item.category } = editDraft;
    const regeneratedDeviceId = generateDeviceId({
      manufacturer,
      category,
      inventory,
    });

    const changes: {
      status?: InventoryStatus;
      assigned_user_id?: string | null;
      company?: string;
      entity?: InventoryEntity | null;
      category?: InventoryCategory;
      details?: string;
      sn_mac_address?: string;
      device_id?: string;
    } = {};

    if (editDraft.company !== undefined && editDraft.company !== item.company) changes.company = editDraft.company;
    if (editDraft.entity !== undefined && editDraft.entity !== item.entity) changes.entity = editDraft.entity;
    if (editDraft.category !== undefined && editDraft.category !== item.category) changes.category = editDraft.category;
    if (editDraft.details !== undefined && editDraft.details !== item.details) changes.details = editDraft.details;
    if (editDraft.sn_mac_address !== undefined && editDraft.sn_mac_address !== item.sn_mac_address)
      changes.sn_mac_address = editDraft.sn_mac_address;
    if (editDraft.status !== undefined && editDraft.status !== item.status) changes.status = editDraft.status;
    if (regeneratedDeviceId !== item.device_id) changes.device_id = regeneratedDeviceId;

    await onUpdateInventory(item.id, changes);
    setEditingId(null);
    setEditDraft(null);
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
          <h1 className="page-title">Asset Tracking</h1>
          <p className="page-subtitle">
            Manage company devices and hardware assets across stocked, assigned, and active states.
          </p>
        </div>
        {isIT && (
          <button id="btn-register-inventory" className="btn btn-primary" onClick={onRegisterClick}>
            <UserPlus size={16} />
            Register Asset
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
          <Layers size={14} /> All Assets ({allCount})
        </button>
        <button
          id="tab-stocked-inventory"
          className={`btn ${subTab === 'stocked' ? 'btn-primary' : 'btn-secondary'} inventory-tab-btn`}
          onClick={() => handleSubTabChange('stocked')}
        >
          <HardDrive size={14} /> Stocked Assets ({stockedCount})
        </button>
        <button
          id="tab-assigned-inventory"
          className={`btn ${subTab === 'assigned' ? 'btn-primary' : 'btn-secondary'} inventory-tab-btn`}
          onClick={() => handleSubTabChange('assigned')}
        >
          <UserCheck size={14} /> Assigned Assets ({assignedCount})
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
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
              Manufacturer:
            </span>
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
              <option value="all">All Manufacturer</option>
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
      <span className="stat-desc inventory-stat-desc">
        Showing {filteredInventory.length} of {inventory.length} assets
      </span>

      {/* Inventory List Table */}
      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrapper inventory-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Device ID</th>
                <th>SN / MAC</th>
                <th>Manufacturer</th>
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
                filteredInventory.map((item) => {
                  const isEditing = editingId === item.id;
                  const draft = editDraft || {};
                  return (
                    <tr
                      key={item.id}
                      onClick={isEditing ? undefined : () => onRowClick?.(item)}
                      style={{ cursor: isEditing || !onRowClick ? 'default' : 'pointer' }}
                    >
                      <td className="inventory-device-id">
                        {isEditing ? (
                          <input
                            className="form-input"
                            style={{ width: '100%', height: '38px', backgroundColor: 'var(--bg-primary)' }}
                            value={draft.device_id ?? item.device_id}
                            readOnly
                          />
                        ) : (
                          item.device_id
                        )}
                      </td>
                      <td style={{ fontSize: '0.85rem' }}>
                        {isEditing ? (
                          <input
                            className="form-input"
                            style={{ width: '100%', height: '38px', backgroundColor: 'var(--bg-primary)' }}
                            value={draft.sn_mac_address ?? item.sn_mac_address}
                            onChange={(e) => setEditDraft({ ...draft, sn_mac_address: e.target.value })}
                          />
                        ) : (
                          item.sn_mac_address
                        )}
                      </td>
                      <td style={{ fontSize: '0.85rem' }}>
                        {isEditing ? (
                          <input
                            className="form-input"
                            style={{ width: '100%', height: '38px', backgroundColor: 'var(--bg-primary)' }}
                            value={draft.company ?? item.company}
                            onChange={(e) => setEditDraft({ ...draft, company: e.target.value })}
                          />
                        ) : (
                          item.company
                        )}
                      </td>
                      <td style={{ fontSize: '0.85rem' }}>
                        {isEditing ? (
                          <select
                            className="form-input"
                            style={{ width: '100%', height: '38px', backgroundColor: 'var(--bg-primary)' }}
                            value={draft.entity ?? item.entity ?? ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditDraft({ ...draft, entity: val ? (val as InventoryEntity) : null });
                            }}
                          >
                            <option value="">-- Select Entity --</option>
                            {INVENTORY_ENTITY_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          item.entity || 'N/A'
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <select
                            className="form-input"
                            style={{ width: '100%', height: '38px', backgroundColor: 'var(--bg-primary)' }}
                            value={draft.category ?? item.category}
                            onChange={(e) => setEditDraft({ ...draft, category: e.target.value as InventoryCategory })}
                          >
                            {INVENTORY_CATEGORY_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          getCategoryBadge(item.category)
                        )}
                      </td>
                      <td className="leave-reason" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {isEditing ? (
                          <input
                            className="form-input"
                            style={{ width: '100%', height: '38px', backgroundColor: 'var(--bg-primary)' }}
                            value={draft.details ?? item.details}
                            onChange={(e) => setEditDraft({ ...draft, details: e.target.value })}
                          />
                        ) : (
                          item.details
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <select
                            className="form-input"
                            style={{ width: '100%', height: '38px', backgroundColor: 'var(--bg-primary)' }}
                            value={draft.status ?? item.status}
                            onChange={(e) => setEditDraft({ ...draft, status: e.target.value as InventoryStatus })}
                          >
                            {INVENTORY_STATUS_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {INVENTORY_STATUS_LABELS[opt.value as InventoryStatus] || opt.value}
                              </option>
                            ))}
                          </select>
                        ) : (
                          getStatusBadge(item.status)
                        )}
                      </td>
                      <td style={{ fontSize: '0.85rem' }}>
                        {item.assigned_user_id || item.assigned_user_name ? (
                          <span style={{ color: 'var(--text-primary)' }}>
                            {getAssignedUserName(item.assigned_user_id, item.assigned_user_name, userMap)}
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
                      <td className="actions-cell" style={{ verticalAlign: 'middle' }}>
                        {isEditing ? (
                          <>
                            <button
                              className="btn btn-primary"
                              style={{ width: '2.2rem', height: '1.875rem', padding: 0, marginRight: '4px' }}
                              aria-label="Save changes"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditSave(item);
                              }}
                            >
                              <CircleCheckBig size={12} />
                            </button>
                            <button
                              className="btn btn-secondary"
                              style={{ width: '2.2rem', height: '1.875rem', padding: 0 }}
                              aria-label="Cancel edit"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditCancel();
                              }}
                            >
                              <X size={12} />
                            </button>
                          </>
                        ) : (
                          <>
                            {(item.status === 'Stocked' || !item.assigned_user_id) && isIT && (
                              <button
                                className="btn btn-secondary"
                                style={{ width: '2.2rem', height: '1.875rem', padding: 0, marginRight: '4px' }}
                                aria-label="Edit asset"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditOpen(item);
                                }}
                              >
                                <Edit size={14} />
                              </button>
                            )}
                            {(item.status === 'Stocked' || !item.assigned_user_id) && isIT && (
                              <button
                                className="btn btn-secondary"
                                style={{ width: '2.2rem', height: '1.875rem', padding: 0 }}
                                aria-label="Assign asset"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onAssignOpen(item.id);
                                }}
                              >
                                <UserPlus size={14} />
                              </button>
                            )}
                            {item.status === 'Assigned' && isIT && (
                              <button
                                className="btn btn-secondary"
                                style={{ width: '2.2rem', height: '1.875rem', padding: 0 }}
                                aria-label="Un-assign inventory"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!window.confirm('Are you sure you want to un-assign this asset?')) {
                                    return;
                                  }
                                  onUpdateInventory(item.id, { status: 'Stocked', assigned_user_id: null });
                                }}
                              >
                                <CircleCheckBig size={14} />
                              </button>
                            )}
                            {isIT && (
                              <button
                                className="btn btn-danger"
                                style={{ width: '2.2rem', height: '1.875rem', padding: 0 }}
                                aria-label="Delete inventory"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (
                                    !window.confirm(
                                      'Are you sure you want to delete this asset? This cannot be undone.'
                                    )
                                  ) {
                                    return;
                                  }
                                  onDeleteInventory(item.id);
                                }}
                              >
                                <Trash size={14} />
                              </button>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
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
                      ? 'No stocked assets available.'
                      : subTab === 'assigned'
                        ? 'No assigned assets.'
                        : 'No asset items found.'}
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
