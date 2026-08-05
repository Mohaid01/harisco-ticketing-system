import { CheckCircle, Clock, MapPin, Plus, X, XCircle } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import type { AppUser, LeaveStatus, SiteDutyApplication } from '../types';
import { formatEmployeeCode } from '../utils';

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="badge badge-closed">
            <CheckCircle size={12} /> Approved
          </span>
        );
      case 'rejected':
        return (
          <span
            className="badge badge-danger"
            style={{
              backgroundColor: 'rgba(244, 63, 94, 0.1)',
              color: '#f43f5e',
              borderColor: 'rgba(244, 63, 94, 0.2)',
            }}
          >
            <XCircle size={12} /> Rejected
          </span>
        );
      default:
        return (
          <span className="badge badge-m-app">
            <Clock size={12} /> Pending
          </span>
        );
    }
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
        }}
      >
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
          <button
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            onClick={() => setShowApplyModal(true)}
          >
            <Plus size={16} /> Apply for Site Duty
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>Loading...</div>
      ) : (
        <div className="panel" style={{ padding: '20px' }}>
          <h2 className="panel-title" style={{ marginBottom: '16px' }}>
            <MapPin size={18} style={{ color: 'var(--color-primary)' }} />
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
                      <td style={{ fontWeight: 600 }}>
                        {duty.userName} <br />
                        <span
                          style={{
                            fontSize: '0.75rem',
                            color: 'var(--text-secondary)',
                            fontWeight: 'normal',
                          }}
                        >
                          {formatEmployeeCode(duty.userCode || duty.userId)}
                        </span>
                      </td>
                    )}
                    <td>{duty.siteName}</td>
                    <td>
                      {duty.startDate} to {duty.endDate}
                    </td>
                    <td style={{ maxWidth: '250px' }}>{duty.reason}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{new Date(duty.appliedAt).toLocaleDateString()}</td>
                    <td>{getStatusBadge(duty.status)}</td>
                    {canManageDuties && (
                      <td>
                        {duty.status === 'pending' && duty.userId !== currentUser.id ? (
                          <div style={{ display: 'flex', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
                            <button
                              className="btn btn-primary"
                              style={{
                                padding: '4px 8px',
                                fontSize: '0.75rem',
                              }}
                              onClick={() => handleUpdateStatus(duty.id, 'approved')}
                            >
                              Approve
                            </button>
                            <button
                              className="btn btn-danger"
                              style={{
                                padding: '4px 8px',
                                fontSize: '0.75rem',
                              }}
                              onClick={() => handleUpdateStatus(duty.id, 'rejected')}
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span
                            style={{
                              fontSize: '0.75rem',
                              color: 'var(--text-muted)',
                            }}
                          >
                            Processed
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {duties.length === 0 && (
                  <tr>
                    <td colSpan={canManageDuties ? 7 : 5} style={{ textAlign: 'center', padding: '40px' }}>
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
          <div className="modal-content" style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
            <div
              className="panel-header"
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--border-color)',
                margin: 0,
              }}
            >
              <h2 className="panel-title" style={{ fontSize: '1.15rem' }}>
                Apply for Site Duty
              </h2>
              <button
                className="btn btn-secondary"
                style={{
                  width: '32px',
                  height: '32px',
                  padding: 0,
                  borderRadius: '50%',
                }}
                onClick={() => setShowApplyModal(false)}
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleApply}>
              <div style={{ padding: '24px' }}>
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

                <div style={{ display: 'flex', gap: '16px' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Start Date</label>
                    <input
                      type="date"
                      className="form-input"
                      style={{
                        colorScheme: 'dark',
                      }}
                      value={startDate}
                      min={todayStr}
                      onChange={(e) => setStartDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">End Date</label>
                    <input
                      type="date"
                      className="form-input"
                      style={{
                        colorScheme: 'dark',
                      }}
                      value={endDate}
                      min={startDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Reason for Visit</label>
                  <textarea
                    className="form-input"
                    rows={3}
                    style={{ minHeight: '100px', resize: 'vertical' }}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Please provide a brief reason for your visit..."
                    required
                  />
                </div>
              </div>

              <div
                style={{
                  padding: '16px 24px',
                  borderTop: '1px solid var(--border-color)',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '12px',
                }}
              >
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
