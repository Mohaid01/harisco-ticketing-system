import React, { useState } from 'react';

import type { AppUser } from '../../../types';
import type { DocumentSignOff } from '../types';

const HQ_ROLES = ['it', 'employee', 'manager', 'executive'];

interface SignOffSectionProps {
  signOff: DocumentSignOff;
  setSignOff: React.Dispatch<React.SetStateAction<DocumentSignOff>>;
  allUsers: AppUser[];
}

export const SignOffSection: React.FC<SignOffSectionProps> = ({
  signOff,
  setSignOff,
  allUsers,
}) => {
  const hqUsers = allUsers.filter((u) => HQ_ROLES.includes(u.role));

  const [searchPrepared, setSearchPrepared] = useState('');
  const [searchChecked, setSearchChecked] = useState('');
  const [searchApproved, setSearchApproved] = useState('');
  const [openPrepared, setOpenPrepared] = useState(false);
  const [openChecked, setOpenChecked] = useState(false);
  const [openApproved, setOpenApproved] = useState(false);

  const filteredPrepared = hqUsers.filter(
    (u) =>
      !searchPrepared ||
      u.name.toLowerCase().includes(searchPrepared.toLowerCase()) ||
      (u.designation || '').toLowerCase().includes(searchPrepared.toLowerCase())
  );

  const filteredChecked = hqUsers.filter(
    (u) =>
      !searchChecked ||
      u.name.toLowerCase().includes(searchChecked.toLowerCase()) ||
      (u.designation || '').toLowerCase().includes(searchChecked.toLowerCase())
  );

  const filteredApproved = hqUsers.filter(
    (u) =>
      !searchApproved ||
      u.name.toLowerCase().includes(searchApproved.toLowerCase()) ||
      (u.designation || '').toLowerCase().includes(searchApproved.toLowerCase())
  );

  const handleChange = (field: keyof DocumentSignOff, value: string) => {
    setSignOff((prev) => ({ ...prev, [field]: value }));
  };

  const selectUser = (
    field: keyof DocumentSignOff,
    user: AppUser,
    closeFn: () => void
  ) => {
    setSignOff((prev) => ({ ...prev, [field]: `${user.name} (${user.designation || ''})`.trimEnd()}));
    closeFn();
  };

  const renderSearchableSelect = ({
    field,
    value,
    filtered,
    searchTerm,
    setSearchTerm,
    setOpen,
    isOpen,
    label,
  }: {
    field: keyof DocumentSignOff;
    value: string;
    filtered: AppUser[];
    searchTerm: string;
    setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
    setOpen: React.Dispatch<React.SetStateAction<boolean>>;
    isOpen: boolean;
    label: string;
  }) => (
    <div className="docgen-input-group">
      <label htmlFor={`signoff-${field}`} className="docgen-label">
        {label}
      </label>
      <div className="inv-assignee-wrap" style={{ position: 'relative', width: '100%' }}>
        <input
          id={`signoff-${field}`}
          type="text"
          className="form-input inv-select-primary-bg"
          value={value || searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setOpen(true);
            if (!value) handleChange(field, '');
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={`Select ${label.toLowerCase()}`}
        />
        {isOpen && (
          <div className="inv-assignee-dropdown" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10 }}>
            {filtered.length === 0 ? (
              <div className="inv-assignee-empty">No matching HQ users available.</div>
            ) : (
              filtered.map((u) => (
                <div
                  key={u.id}
                  className={`inv-assignee-item ${value && value.includes(u.name) ? 'inv-assignee-item-active' : ''}`}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    selectUser(field, u, () => setOpen(false));
                  }}
                >
                  {u.name} ({u.designation || ''})
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="docgen-card">
      <div className="docgen-card-header">
        <div>
          <h3 className="docgen-card-title">Sign-Off &amp; Document Approval Matrix</h3>
          <span className="docgen-card-subtitle">Tri-tier verification and authorization lines</span>
        </div>
      </div>

      <div className="docgen-grid-3">
        {renderSearchableSelect({
          field: 'preparedByName',
          value: signOff.preparedByName,
          filtered: filteredPrepared,
          searchTerm: searchPrepared,
          setSearchTerm: setSearchPrepared,
          setOpen: setOpenPrepared,
          isOpen: openPrepared,
          label: 'Prepared By',
        })}
        {renderSearchableSelect({
          field: 'checkedByName',
          value: signOff.checkedByName,
          filtered: filteredChecked,
          searchTerm: searchChecked,
          setSearchTerm: setSearchChecked,
          setOpen: setOpenChecked,
          isOpen: openChecked,
          label: 'Checked / Reviewed By',
        })}
        {renderSearchableSelect({
          field: 'approvedByName',
          value: signOff.approvedByName,
          filtered: filteredApproved,
          searchTerm: searchApproved,
          setSearchTerm: setSearchApproved,
          setOpen: setOpenApproved,
          isOpen: openApproved,
          label: 'Approved By',
        })}
      </div>
    </div>
  );
};
