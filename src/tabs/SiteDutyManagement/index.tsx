import { MapPin, Plus, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import type { AppUser, LeaveStatus, SiteDutyApplication } from '../../types';

import { LoadingSpinner } from '../../components/LoadingSpinner';
import { SiteDutyStatusBadge } from '../../components/SiteDutyManagement/SiteDutyStatusBadge';
import '../../index.css';
import { formatEmployeeCode } from '../../utils';
import './SiteDutyManagement.css';

interface SiteDutyManagementProps {
  currentUser: AppUser;
  token: string;
}

export const SiteDutyManagement: React.FC<SiteDutyManagementProps> = ({ currentUser, token }) => {
  const [duties, setDuties] = useState<SiteDutyApplication[]>([]);
  const [loading, setLoading] = useState(true);

  const [showApplyModal, setShowApplyModal] = useState(false);
  const [siteName, setSiteName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  const todayStr = new Date().toISOString().split('T')[0];

  const canManageDuties = currentUser.isDepartmentHead === 1 && currentUser.role !== 'executive';
  const canViewAll = canManageDuties || currentUser.role === 'executive';

  const fetchSiteDuties = async () => {
    try {
      const res = await fetch('/api/site-duties', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDuties(data);
      }
    } catch (e) {
      console.error('Failed to fetch site duties:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSiteDuties();
  }, [token]);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteName || !startDate || !endDate || !reason) {
      alert('All fields are required.');
      return;
    }

    if (startDate < todayStr) {
      alert('Start date cannot be earlier than today.');
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      alert('End date cannot be earlier than start date.');
      return;
    }

    try {
      const res = await fetch('/api/site-duties', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ siteName, startDate, endDate, reason }),
      });

      if (res.ok) {
        setShowApplyModal(false);
        setSiteName('');
        setStartDate('');
        setEndDate('');
        setReason('');
        fetchSiteDuties();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to submit site duty application.');
      }
    } catch (e) {
      console.error('Site duty submission error:', e);
      alert('Network error. Could not submit.');
    }
  };

  const handleUpdateStatus = async (id: string, status: LeaveStatus) => {
    if (!window.confirm(`Are you sure you want to mark this request as ${status}?`)) return;

    try {
      const res = await fetch(`/api/site-duties/${id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        fetchSiteDuties();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update status.');
      }
    } catch (e) {
      console.error('Status update error:', e);
    }
  };

  return (
    <div>
      <div className="site-duty-header">
        <div>
          <h1 className="page-title">Site Duty Management</h1>
          <p className="page-subtitle">
            {canManageDuties
              ? 'Review and approve employee site duty requests.'
              : currentUser.role === 'executive'
                ? 'Review all employee site duty applications.'
                : 'Apply for site duties and track your application status.'}
          </p>
        </div>
        {currentUser.role !== 'executive' && (
          <button className="btn btn-primary site-duty-header-btn" onClick={() => setShowApplyModal(true)}>
            <Plus size={16} /> Apply for Site Duty
          </button>
        )}
      </div>

      {loading ? (
        <LoadingSpinner type="table" rows={6} />
      ) : (
        <div className="panel site-duty-panel">
          <h2 className="panel-title site-duty-panel-header">
            <MapPin size={18} className="site-duty-panel-header-icon" />
            {canViewAll ? 'All Site Duty Requests' : 'Your Site Duty History'}
          </h2>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  {canViewAll && <th>Employee</th>}
                  <th>Site Name</th>
                  <th>Duration</th>
                  <th>Reason</th>
                  <th>Applied On</th>
                  <th>Status</th>
                  {canManageDuties && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {duties.map((duty) => (
                  <tr key={duty.id}>
                    {canViewAll && (
                      <td className="site-duty-applicant-name">
                        {duty.userName} <br />
                        <span className="site-duty-applicant-code">
                          {formatEmployeeCode(duty.userCode || duty.userId)}
                        </span>
                      </td>
                    )}
                    <td>{duty.siteName}</td>
                    <td className="site-duty-duration">
                      {duty.startDate} to {duty.endDate}
                    </td>
                    <td className="site-duty-reason" title={duty.reason}>
                      {duty.reason}
                    </td>
                    <td className="site-duty-date">{new Date(duty.appliedAt).toLocaleDateString()}</td>
                    <td>
                      <SiteDutyStatusBadge status={duty.status} />
                    </td>
                    {canManageDuties && (
                      <td>
                        {duty.status === 'pending' && duty.userId !== currentUser.id ? (
                          <div className="site-duty-actions" onClick={(e) => e.stopPropagation()}>
                            <button
                              className="btn btn-primary site-duty-btn-xs"
                              onClick={() => handleUpdateStatus(duty.id, 'approved')}
                            >
                              Approve
                            </button>
                            <button
                              className="btn btn-danger site-duty-btn-xs"
                              onClick={() => handleUpdateStatus(duty.id, 'rejected')}
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="site-duty-processed">Processed</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {duties.length === 0 && (
                  <tr>
                    <td colSpan={canManageDuties ? 7 : 5} className="site-duty-empty">
                      No site duty applications found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Apply Site Duty Modal */}
      {showApplyModal && (
        <div className="modal-overlay" onClick={() => setShowApplyModal(false)}>
          <div className="modal-content modal-content-medium" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-bar">
              <h2 className="panel-title modal-title-sm">Apply for Site Duty</h2>
              <button className="btn btn-secondary modal-close-btn-sm" onClick={() => setShowApplyModal(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleApply}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Site Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={siteName}
                    onChange={(e) => setSiteName(e.target.value)}
                    placeholder="E.g. DHA Phase 8 Project Site"
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group form-row-item">
                    <label className="form-label">Start Date</label>
                    <input
                      type="date"
                      className="form-input input-date-dark"
                      value={startDate}
                      min={todayStr}
                      onChange={(e) => setStartDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group form-row-item">
                    <label className="form-label">End Date</label>
                    <input
                      type="date"
                      className="form-input input-date-dark"
                      value={endDate}
                      min={startDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group form-group-last">
                  <label className="form-label">Reason for Visit</label>
                  <textarea
                    className="form-input form-textarea"
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Please provide a brief reason for your visit..."
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowApplyModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Submit Application
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
