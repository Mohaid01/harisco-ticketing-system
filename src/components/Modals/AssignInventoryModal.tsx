import { X } from 'lucide-react';
import React, { useState } from 'react';

import type { AppUser, InventoryEntity } from '../../types';

import { INVENTORY_ENTITY_OPTIONS } from '../../constants';
import { formatEmployeeCode } from '../../utils';

interface AssignInventoryModalProps {
  inventoryId: string;
  users: AppUser[];
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (inventoryId: string, entity: InventoryEntity, userId: string | null, deviceId: string) => void;
}

export const AssignInventoryModal: React.FC<AssignInventoryModalProps> = ({
  inventoryId,
  users,
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [entity, setEntity] = useState<InventoryEntity | null>(null);
  const [assignedUserId, setAssignedUserId] = useState<string | null>(null);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [assigneeInput, setAssigneeInput] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const activeUsers = users.filter((u) => u.is_active !== 0);
  const hqRoles = ['it', 'employee', 'manager', 'executive'];
  const factoryRoles = ['factory_employee', 'factory_it', 'factory_manager'];
  const externalRoles = ['external'];
  const entityRoleMap: Record<InventoryEntity, string[]> = {
    HQ: hqRoles,
    Factory: factoryRoles,
    External: externalRoles,
    Others: [],
  };

  const filteredAssignees = activeUsers.filter((u) => {
    const allowedRoles = entity ? entityRoleMap[entity] : [];
    if (allowedRoles.length > 0 && !allowedRoles.includes(u.role)) return false;
    const term = assigneeInput.toLowerCase();
    return u.name.toLowerCase().includes(term) || (u.username || '').toLowerCase().includes(term);
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!entity) {
      setErrorMsg('Entity is required.');
      return;
    }

    if (!deviceId.trim()) {
      setErrorMsg('Device ID is required.');
      return;
    }

    setErrorMsg(null);
    await onSubmit(inventoryId, entity, assignedUserId, deviceId.trim());
    setEntity(null);
    setAssignedUserId(null);
    setAssigneeInput('');
    setDeviceId('');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div
          className="panel-header"
          style={{ padding: '1.0625rem 1.275rem', borderBottom: '0.0531rem solid var(--border-color)', margin: 0 }}
        >
          <h2 className="panel-title" style={{ fontSize: '1.15rem' }}>
            Assign Inventory to User
          </h2>
          <button
            id="btn-assign-inventory-modal-close"
            className="btn btn-secondary"
            style={{ width: '1.7rem', height: '1.7rem', padding: 0, borderRadius: '50%' }}
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ padding: '1.275rem' }}>
            {errorMsg && (
              <div
                style={{
                  backgroundColor: 'rgba(244, 63, 94, 0.15)',
                  border: '0.0531rem solid rgba(244, 63, 94, 0.3)',
                  color: '#f43f5e',
                  padding: '0.5313rem 0.7438rem',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '0.85rem',
                  fontSize: '0.85rem',
                }}
              >
                {errorMsg}
              </div>
            )}

            <div style={{ marginTop: '1rem', borderTop: '0.0531rem solid var(--border-color)', paddingTop: '0.85rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                <div className="form-group">
                  <label htmlFor="assign-inventory-entity-select" className="form-label">
                    Entity
                  </label>
                  <select
                    id="assign-inventory-entity-select"
                    className="form-input"
                    style={{ backgroundColor: 'var(--bg-primary)' }}
                    value={entity ?? ''}
                    onChange={(e) => {
                      setEntity(e.target.value as InventoryEntity);
                      setAssignedUserId(null);
                      setAssigneeInput('');
                    }}
                    required
                  >
                    <option value="" selected disabled>
                      -- Select Entity --
                    </option>
                    {INVENTORY_ENTITY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="assign-inventory-assignee-select" className="form-label">
                    Assignee (Optional)
                  </label>
                  <div
                    id="assign-inventory-assignee-select"
                    style={{
                      position: 'relative',
                      display: 'inline-block',
                      width: '100%',
                    }}
                  >
                    <input
                      id="assign-inventory-assignee-input"
                      type="text"
                      className="form-input"
                      style={{ backgroundColor: 'var(--bg-primary)' }}
                      disabled={!entity}
                      value={assignedUserId ? assigneeInput : ''}
                      placeholder="-- Select User (Optional) --"
                      onChange={(e) => {
                        setAssigneeInput(e.target.value);
                        setAssigneeOpen(true);
                      }}
                      onFocus={() => setAssigneeOpen(true)}
                      onBlur={() => setTimeout(() => setAssigneeOpen(false), 150)}
                    />
                    {assigneeOpen && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          backgroundColor: 'var(--bg-primary)',
                          border: '0.0531rem solid var(--border-color)',
                          borderRadius: 'var(--radius-md)',
                          zIndex: 50,
                          maxHeight: '12rem',
                          overflowY: 'auto',
                          boxShadow: '0 0.2656rem 0.5313rem rgba(0, 0, 0, 0.1)',
                        }}
                      >
                        {filteredAssignees.length === 0 ? (
                          <div style={{ padding: '0.5313rem 0.7438rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            No matching users available.
                          </div>
                        ) : (
                          filteredAssignees.map((u) => (
                            <div
                              key={u.id}
                              onClick={() => {
                                setAssignedUserId(u.id);
                                setAssigneeInput(`${u.name} (${formatEmployeeCode(u.username || u.id)})`);
                                setAssigneeOpen(false);
                              }}
                              style={{
                                padding: '0.5313rem 0.7438rem',
                                fontSize: '0.85rem',
                                cursor: 'pointer',
                                borderBottom: '0.0531rem solid var(--border-color)',
                                backgroundColor: assignedUserId === u.id ? 'rgba(14, 82, 155, 0.1)' : 'transparent',
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

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label htmlFor="assign-inventory-device-id-input" className="form-label">
                    Device ID
                  </label>
                  <input
                    id="assign-inventory-device-id-input"
                    type="text"
                    className="form-input"
                    placeholder="e.g. HC-HQ-Dell-Lap-0001"
                    value={deviceId}
                    onChange={(e) => setDeviceId(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '0.85rem 1.275rem',
              borderTop: '0.0531rem solid var(--border-color)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.6375rem',
            }}
          >
            <button id="btn-assign-inventory-cancel" type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              id="btn-assign-inventory-submit"
              type="submit"
              className="btn btn-primary"
              disabled={!entity || !deviceId.trim()}
            >
              Assign Inventory
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
