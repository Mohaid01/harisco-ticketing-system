import { X } from 'lucide-react';
import React, { useState } from 'react';

import type { AppUser, Inventory, InventoryCategory, InventoryEntity } from '../../types';

import { INVENTORY_CATEGORY_OPTIONS, INVENTORY_ENTITY_OPTIONS } from '../../constants';
import { formatEmployeeCode, generateDeviceId, isValidDeviceId } from '../../utils';
interface RegisterInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: AppUser[];
  inventory?: Inventory[];
  onSubmit: (data: {
    company: string;
    entity?: InventoryEntity | null;
    category: InventoryCategory;
    details: string;
    device_id: string;
    sn_mac_address: string;
    assigned_user_id: string | null;
    attachment: string | null;
  }) => Promise<void>;
}

export const RegisterInventoryModal: React.FC<RegisterInventoryModalProps> = ({
  isOpen,
  onClose,
  users,
  inventory: inventoryProp = [],
  onSubmit,
}) => {
  const [company, setCompany] = useState('');
  const [entity, setEntity] = useState<InventoryEntity | null>(null);
  const [category, setCategory] = useState<InventoryCategory | null>(null);
  const [details, setDetails] = useState('');
  const [snMacAddress, setSnMacAddress] = useState('');
  const [assignedUserId, setAssignedUserId] = useState<string | null>(null);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [assigneeInput, setAssigneeInput] = useState('');
  const [attachment, setAttachment] = useState<string | null>(null);
  const [attachmentFileName, setAttachmentFileName] = useState<string | null>(null);
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

  const generatedDeviceId = React.useMemo(() => {
    if (!category || !company.trim()) return '';
    return generateDeviceId({ manufacturer: company, category, inventory: inventoryProp });
  }, [category, company, inventoryProp]);

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

  if (!isOpen) return null;

  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const maxSizeMB = 10;
    if (file.size > maxSizeMB * 1024 * 1024) {
      setErrorMsg(`Attachment size must be less than ${maxSizeMB}MB.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAttachment(reader.result as string);
      setAttachmentFileName(file.name);
      setErrorMsg(null);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const finalCompany = company.trim();
    const finalDetails = details.trim();
    const finalDeviceId = generatedDeviceId;
    const finalSnMacAddress = snMacAddress.trim();

    if (!category) {
      setErrorMsg('Category is required.');
      return;
    }
    if (!finalCompany) {
      setErrorMsg('Company is required.');
      return;
    }
    if (!finalDetails) {
      setErrorMsg('Details is required.');
      return;
    }
    if (!finalDeviceId) {
      setErrorMsg('Device ID is required.');
      return;
    }
    if (!isValidDeviceId(finalDeviceId)) {
      setErrorMsg('Device ID must follow the format HC-Manufacturer-Category-0001.');
      return;
    }
    if (!finalSnMacAddress) {
      setErrorMsg('SN/MAC Address is required.');
      return;
    }

    if (!window.confirm('Are you sure you want to register this asset?')) {
      return;
    }

    setErrorMsg(null);
    try {
      await onSubmit({
        company: company.trim(),
        entity,
        category,
        details: details.trim(),
        device_id: generatedDeviceId,
        sn_mac_address: snMacAddress.trim(),
        assigned_user_id: assignedUserId,
        attachment,
      });

      setCompany('');
      setEntity(null);
      setCategory(null);
      setDetails('');
      setSnMacAddress('');
      setAssignedUserId(null);
      setAssigneeInput('');
      setAttachment(null);
      setAttachmentFileName(null);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to register asset. Please try again.');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="panel-header inv-modal-header">
          <h2 className="panel-title inv-modal-title">Register New Asset</h2>
          <button
            id="btn-register-inventory-modal-close"
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
                <label htmlFor="inventory-device-id-input" className="form-label">
                  Device ID
                </label>
                <input
                  id="inventory-device-id-input"
                  type="text"
                  className="form-input"
                  placeholder="HC-Manufacturer-Category-0001"
                  value={generatedDeviceId}
                  readOnly
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="inventory-sn-mac-input" className="form-label">
                  SN / MAC Address
                </label>
                <input
                  id="inventory-sn-mac-input"
                  type="text"
                  className="form-input"
                  placeholder="e.g. ABC123456789 or AA:BB:CC:DD:EE:FF"
                  value={snMacAddress}
                  onChange={(e) => setSnMacAddress(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="inventory-category-select" className="form-label">
                  Category
                </label>
                <select
                  id="inventory-category-select"
                  className="form-input inv-select-primary-bg"
                  value={category ?? ''}
                  onChange={(e) => setCategory(e.target.value as InventoryCategory)}
                  required
                >
                  <option value="">-- Select Category --</option>
                  {INVENTORY_CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group inv-span-2">
                <label htmlFor="inventory-company-input" className="form-label">
                  Manufacturer
                </label>
                <input
                  id="inventory-company-input"
                  type="text"
                  className="form-input"
                  value={company}
                  onChange={(e) => setCompany(e.target.value.toUpperCase())}
                  required
                />
              </div>

              <div className="form-group inv-span-2">
                <label htmlFor="inventory-details-input" className="form-label">
                  Details
                </label>
                <textarea
                  id="inventory-details-input"
                  className="form-input"
                  style={{ minHeight: '5.3125rem', resize: 'vertical' }}
                  placeholder="e.g. Dell Latitude 5430, 16GB RAM, 512GB SSD, Windows 11, good condition"
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  required
                />
              </div>

              <div className="form-group inv-span-2">
                <label htmlFor="inventory-attachment-input" className="form-label">
                  Attachment (Optional)
                </label>
                <input
                  id="inventory-attachment-input"
                  type="file"
                  className="form-input"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                  onChange={handleAttachmentChange}
                />
                {attachmentFileName && <span className="inv-attachment-filename">{attachmentFileName}</span>}
              </div>
            </div>

            <div className="inv-form-grid">
              <div className="form-group inv-span-2">
                <label className="form-label">Assignment</label>
              </div>

              <div className="form-group inv-span-2">
                <label htmlFor="inventory-entity-select" className="form-label">
                  Entity
                </label>
                <select
                  id="inventory-entity-select"
                  className="form-input inv-select-primary-bg"
                  value={entity ?? ''}
                  onChange={(e) => {
                    setEntity(e.target.value as InventoryEntity);
                    setAssignedUserId(null);
                    setAssigneeInput('');
                  }}
                >
                  <option value="">-- Select Entity --</option>
                  {INVENTORY_ENTITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group inv-span-2">
                <label htmlFor="inventory-assignee-select" className="form-label">
                  Assignee (Optional)
                </label>
                <div id="inventory-assignee-select" className="inv-assignee-wrap">
                  <input
                    id="inventory-assignee-input"
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
            </div>
          </div>

          <div className="inv-modal-footer">
            <button id="btn-register-inventory-cancel" type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button id="btn-register-inventory-submit" type="submit" className="btn btn-primary">
              Register Asset
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
