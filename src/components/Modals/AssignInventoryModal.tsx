import { X } from 'lucide-react';
import React, { useState } from 'react';

import type { AppUser, Inventory, InventoryCategory, InventoryEntity } from '../../types';

import { INVENTORY_ENTITY_OPTIONS } from '../../constants';
import { formatEmployeeCode, generateDeviceId } from '../../utils';

interface AssignInventoryModalProps {
  inventoryId: string;
  inventory: Inventory[];
  company: string;
  category: InventoryCategory;
  users: AppUser[];
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (inventoryId: string, entity: InventoryEntity | null, userId: string | null, deviceId: string, assignmentScope: 'user' | 'entity' | null, location: string | null) => void;
}

export const AssignInventoryModal: React.FC<AssignInventoryModalProps> = ({
  inventoryId,
  inventory,
  company,
  category,
  users,
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [entity, setEntity] = useState<InventoryEntity | null>(null);
  const [assignedUserId, setAssignedUserId] = useState<string | null>(null);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [assigneeInput, setAssigneeInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isInfrastructure, setIsInfrastructure] = useState(false);
  const [location, setLocation] = useState('');

  const activeUsers = users.filter((u) => u.is_active !== 0);
  const hqRoles = ['it', 'employee', 'manager', 'executive'];
  const factoryRoles = ['factory_employee', 'factory_it', 'factory_manager'];
  const externalRoles = ['external'];
  const entityRoleMap: Record<string, string[]> = {
    HQ: hqRoles,
    Factory: factoryRoles,
    External: externalRoles,
  };

  const matchesAssignee = (term: string, u: AppUser): boolean => {
    const t = term.toLowerCase().trim();
    if (!t) return true;
    const name = (u.name || '').toLowerCase();
    const username = (u.username || '').toLowerCase();
    if (name.includes(t) || username.includes(t)) return true;
    const digits = t.replace(/\D/g, '');
    if (digits) {
      const code = formatEmployeeCode(u.username || u.id);
      if (code.toLowerCase().includes(t)) return true;
      const codeDigits = code.replace(/\D/g, '');
      if (codeDigits.includes(digits)) return true;
    }
    return false;
  };

  const filteredAssignees = activeUsers.filter((u) => {
    const allowedRoles = entity ? entityRoleMap[entity] : [];
    if (allowedRoles.length > 0 && !allowedRoles.includes(u.role)) return false;
    return matchesAssignee(assigneeInput, u);
  });

  const generatedDeviceId = React.useMemo(() => {
    if (!category || !company.trim()) return '';
    return generateDeviceId({ manufacturer: company, category, inventory });
  }, [company, category, inventory]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!window.confirm('Are you sure you want to assign this asset?')) {
      return;
    }

    if (isInfrastructure && !location.trim()) {
      setErrorMsg('Location is required for infrastructure devices.');
      return;
    }

    await onSubmit(inventoryId, isInfrastructure ? entity : null, isInfrastructure ? null : assignedUserId, generatedDeviceId, isInfrastructure ? 'entity' : 'user', isInfrastructure ? location.trim() : null);
    setEntity(null);
    setAssignedUserId(null);
    setAssigneeInput('');
    setLocation('');
    setIsInfrastructure(false);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="panel-header inv-modal-header">
          <h2 className="panel-title inv-modal-title">Assign Asset to User</h2>
          <button
            id="btn-assign-inventory-modal-close"
            className="btn btn-secondary inv-modal-close-btn"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="inv-modal-body">
            {errorMsg && <div className="inv-error-msg">{errorMsg}</div>}

            <div className="inv-form-grid">
              <div className="form-group inv-span-2">
                <label htmlFor="assign-inventory-device-id-input" className="form-label">
                  Device ID
                </label>
                <input
                  id="assign-inventory-device-id-input"
                  type="text"
                  className="form-input"
                  placeholder="HC-Dell-Lap-0001"
                  value={generatedDeviceId}
                  readOnly
                  required
                />
              </div>

              <div className="form-group inv-span-2">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    id="assign-inventory-infrastructure-checkbox"
                    type="checkbox"
                    checked={isInfrastructure}
                    onChange={(e) => {
                      setIsInfrastructure(e.target.checked);
                      if (e.target.checked) {
                        setAssignedUserId(null);
                        setAssigneeInput('');
                      }
                    }}
                    className="form-checkbox"
                  />
                  Infrastructure (Entity-Level Device)
                </label>
              </div>

              <div className="form-group inv-span-2">
                <label htmlFor="assign-inventory-entity-select" className="form-label">
                  Entity{isInfrastructure ? ' *' : ''}
                </label>
                <select
                  id="assign-inventory-entity-select"
                  className="form-input inv-select-primary-bg"
                  value={entity ?? ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEntity(val ? (val as InventoryEntity) : null);
                    setAssignedUserId(null);
                    setAssigneeInput('');
                  }}
                  required={isInfrastructure}
                >
                  <option value="">-- Select Entity --</option>
                  {INVENTORY_ENTITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {isInfrastructure ? (
                <div className="form-group inv-span-2">
                  <label htmlFor="assign-inventory-location-input" className="form-label">
                    Location *
                  </label>
                  <input
                    id="assign-inventory-location-input"
                    type="text"
                    className="form-input"
                    value={location}
                    placeholder="e.g. Factory Floor A, HQ Building 2, Field Site 3"
                    onChange={(e) => setLocation(e.target.value)}
                    required
                  />
                </div>
              ) : (
                <div className="form-group inv-span-2">
                  <label htmlFor="assign-inventory-assignee-select" className="form-label">
                    Assignee (Optional)
                  </label>
                  <div id="assign-inventory-assignee-select" className="inv-assignee-wrap">
                    <input
                      id="assign-inventory-assignee-input"
                      type="text"
                      className="form-input inv-select-primary-bg"
                      disabled={!entity}
                      value={assigneeInput}
                      placeholder="-- Select User (Optional) --"
                      onChange={(e) => {
                        const val = e.target.value;
                        setAssigneeInput(val);
                        if (!val) setAssignedUserId(null);
                        setAssigneeOpen(true);
                      }}
                      onFocus={() => setAssigneeOpen(true)}
                      onBlur={() => setTimeout(() => setAssigneeOpen(false), 150)}
                    />
                    {assigneeOpen && (
                      <div className="inv-assignee-dropdown">
                        {filteredAssignees.length === 0 ? (
                          <div className="inv-assignee-empty">No matching users available.</div>
                        ) : (
                          filteredAssignees.map((u) => (
                            <div
                              key={u.id}
                              className={`inv-assignee-item ${assignedUserId === u.id ? 'inv-assignee-item-active' : ''}`}
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                setAssignedUserId(u.id);
                                setAssigneeInput(`${u.name} (${formatEmployeeCode(u.username || u.id)})`);
                                setAssigneeOpen(false);
                              }}
                            >
                              {u.name} ({formatEmployeeCode(u.username || u.id)})
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="inv-modal-footer">
            <button id="btn-assign-inventory-cancel" type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              id="btn-assign-inventory-submit"
              type="submit"
              className="btn btn-primary"
              disabled={!generatedDeviceId}
            >
              Assign Asset
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
