import { Calendar, Plus, X } from 'lucide-react';
import React, { startTransition, useCallback, useEffect, useState } from 'react';

import type { AppUser, LeaveApplication, LeaveCategory, LeaveStatus } from '../../types';

import { LeaveStatusBadge } from '../../components/LeaveManagement/LeaveStatusBadge';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import '../../index.css';
import { formatEmployeeCode } from '../../utils';
import './LeaveManagement.css';

interface LeaveManagementProps {
  currentUser: AppUser;
  token: string;
}

export const LeaveManagement: React.FC<LeaveManagementProps> = ({ currentUser, token }) => {
  const [leaves, setLeaves] = useState<LeaveApplication[]>([]);
  const [loading, setLoading] = useState(true);

  const [showApplyModal, setShowApplyModal] = useState(false);
  const [category, setCategory] = useState<LeaveCategory>('casual');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  const todayStr = new Date().toISOString().split('T')[0];

  const canManageLeaves =
    currentUser.role === 'manager' || currentUser.role === 'executive' || currentUser.isDepartmentHead === 1;
  const canViewAll = canManageLeaves;

  const fetchLeaves = useCallback(() => {
    if (!token) return;

    startTransition(() => {
      setLoading(true);
    });

    fetch('/api/leaves', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error('Network error');
      })
      .then((data) => {
        setLeaves(data);
      })
      .catch((e) => {
        console.error('Failed to fetch leaves:', e);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token]);

  useEffect(() => {
    fetchLeaves();
  }, [fetchLeaves]);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || !startDate || !endDate || !reason) {
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
      const res = await fetch('/api/leaves', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ category, startDate, endDate, reason }),
      });

      if (res.ok) {
        setShowApplyModal(false);
        setCategory('casual');
        setStartDate('');
        setEndDate('');
        setReason('');
        fetchLeaves();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to submit leave.');
      }
    } catch (e) {
      console.error('Leave submission error:', e);
      alert('Network error. Could not submit.');
    }
  };

  const handleUpdateStatus = async (id: string, status: LeaveStatus) => {
    if (!window.confirm(`Are you sure you want to mark this request as ${status}?`)) return;

    try {
      const res = await fetch(`/api/leaves/${id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        fetchLeaves();
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
      <div className="leave-header">
        <div>
          <h1 className="page-title">Leave Management</h1>
          <p className="page-subtitle">
            {canManageLeaves
              ? 'Review and approve employee leave requests.'
              : currentUser.role === 'executive'
                ? 'Review all employee leave applications.'
                : 'Apply for leaves and track your application status.'}
          </p>
        </div>
        {currentUser.role !== 'executive' && (
          <button className="btn btn-primary leave-header-btn" onClick={() => setShowApplyModal(true)}>
            <Plus size={16} /> Apply for Leave
          </button>
        )}
      </div>

      {loading ? (
        <LoadingSpinner type="table" rows={6} />
      ) : (
        <div className="panel leave-panel">
          <h2 className="panel-title leave-panel-header">
            <Calendar size={18} className="leave-panel-header-icon" />
            {canViewAll ? 'All Leave Requests' : 'Your Leave History'}
          </h2>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  {canViewAll ? <th>Employee</th> : <></>}
                  <th>Category</th>
                  <th>Duration</th>
                  <th>Reason</th>
                  <th>Applied On</th>
                  <th>Status</th>
                  {canManageLeaves ? <th>Actions</th> : <></>}
                </tr>
              </thead>
              <tbody>
                {leaves.map((leave) => (
                  <tr key={leave.id}>
                    {canViewAll ? (
                      <td className="leave-applicant-name">
                        {leave.userName} <br />
                        <span className="leave-applicant-code">
                          {formatEmployeeCode(leave.userCode || leave.userId)}
                        </span>
                      </td>
                    ) : (
                      <></>
                    )}
                    <td className="leave-category">{leave.category}</td>
                    <td className="leave-duration">
                      {leave.startDate} to {leave.endDate}
                    </td>
                    <td className="leave-reason" title={leave.reason}>
                      {leave.reason}
                    </td>
                    <td className="leave-date">{new Date(leave.appliedAt).toLocaleDateString()}</td>
                    <td>
                      <LeaveStatusBadge status={leave.status} />
                    </td>
                    {canManageLeaves && (
                      <td>
                        {leave.status === 'pending' && leave.userId !== currentUser.id ? (
                          <div className="leave-actions" onClick={(e) => e.stopPropagation()}>
                            <button
                              className="btn btn-primary leave-btn-xs"
                              onClick={() => handleUpdateStatus(leave.id, 'approved')}
                            >
                              Approve
                            </button>
                            <button
                              className="btn btn-danger leave-btn-xs"
                              onClick={() => handleUpdateStatus(leave.id, 'rejected')}
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="leave-processed">Processed</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {leaves.length === 0 && (
                  <tr>
                    <td colSpan={canManageLeaves ? 7 : 5} className="leave-empty">
                      No leave applications found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Apply Leave Modal */}
      {showApplyModal && (
        <div className="modal-overlay" onClick={() => setShowApplyModal(false)}>
          <div className="modal-content modal-content-medium" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-bar">
              <h2 className="panel-title modal-title-sm">Apply for Leave</h2>
              <button className="btn btn-secondary modal-close-btn-sm" onClick={() => setShowApplyModal(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleApply}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Leave Category</label>
                  <select
                    className="form-input input-date-dark"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as LeaveCategory)}
                    required
                  >
                    <option value="casual">Casual Leave</option>
                    <option value="annual">Annual Leave</option>
                    <option value="medical">Medical Leave</option>
                  </select>
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
                  <label className="form-label">Reason</label>
                  <textarea
                    className="form-input form-textarea"
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Please provide a brief reason for your leave..."
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
