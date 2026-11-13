import React, { useState } from 'react';

import type { AppUser } from '../../../types';
import type { DocumentSignOff } from '../types';

interface SignOffSectionProps {
  signOff: DocumentSignOff;
  setSignOff: React.Dispatch<React.SetStateAction<DocumentSignOff>>;
  allUsers: AppUser[];
}

export const SignOffSection: React.FC<SignOffSectionProps> = ({ signOff, setSignOff, allUsers }) => {
  const [searchPrepared, setSearchPrepared] = useState('');
  const [searchChecked, setSearchChecked] = useState('');
  const [searchApproved, setSearchApproved] = useState('');
  const [openPrepared, setOpenPrepared] = useState(false);
  const [openChecked, setOpenChecked] = useState(false);
  const [openApproved, setOpenApproved] = useState(false);

  const filteredPrepared = allUsers.filter(
    (u) =>
      !searchPrepared ||
      u.name.toLowerCase().includes(searchPrepared.toLowerCase()) ||
      (u.designation || '').toLowerCase().includes(searchPrepared.toLowerCase())
  );

  const filteredChecked = allUsers.filter(
    (u) =>
      !searchChecked ||
      u.name.toLowerCase().includes(searchChecked.toLowerCase()) ||
      (u.designation || '').toLowerCase().includes(searchChecked.toLowerCase())
  );

  const filteredApproved = allUsers.filter(
    (u) =>
      !searchApproved ||
      u.name.toLowerCase().includes(searchApproved.toLowerCase()) ||
      (u.designation || '').toLowerCase().includes(searchApproved.toLowerCase())
  );

  const handleChange = (field: keyof DocumentSignOff, value: string) => {
    setSignOff((prev) => ({ ...prev, [field]: value }));
  };

  const selectUser = (field: keyof DocumentSignOff, user: AppUser, closeFn: () => void) => {
    const designation = user.designation || '';
    const label = user.name + ' (' + designation + ')';
    setSignOff((prev) => ({ ...prev, [field]: label }));
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
          value={searchTerm || value}
          onChange={(e) => {
            const val = e.target.value;
            setSearchTerm(val);
            setOpen(true);
            handleChange(field, val);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={`Select ${label.toLowerCase()}`}
        />
        {isOpen && (
          <div
            className="inv-assignee-dropdown"
            style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10 }}
          >
            {filtered.length === 0 ? (
              <div className="inv-assignee-empty">No matching users available.</div>
            ) : (
              filtered.map((u) => (
                <div
                  key={u.id}
                  className={`inv-assignee-item ${value && value.includes(u.name) ? 'inv-assignee-item-active' : ''}`}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    selectUser(field, u, () => {
                      setOpen(false);
                      setSearchTerm('');
                    });
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.425rem' }}>
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
          <div className="docgen-input-group">
            <label htmlFor="signoff-preparedByDate" className="docgen-label">
              Prepared Date
            </label>
            <input
              id="signoff-preparedByDate"
              type="date"
              className="form-input"
              value={signOff.preparedByDate || ''}
              onChange={(e) => handleChange('preparedByDate', e.target.value)}
            />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.425rem' }}>
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
          <div className="docgen-input-group">
            <label htmlFor="signoff-checkedByDate" className="docgen-label">
              Checked / Reviewed Date
            </label>
            <input
              id="signoff-checkedByDate"
              type="date"
              className="form-input"
              value={signOff.checkedByDate || ''}
              onChange={(e) => handleChange('checkedByDate', e.target.value)}
            />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.425rem' }}>
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
          <div className="docgen-input-group">
            <label htmlFor="signoff-approvedByDate" className="docgen-label">
              Approved Date
            </label>
            <input
              id="signoff-approvedByDate"
              type="date"
              className="form-input"
              value={signOff.approvedByDate || ''}
              onChange={(e) => handleChange('approvedByDate', e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
