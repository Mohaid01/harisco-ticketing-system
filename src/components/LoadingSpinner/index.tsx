import React from 'react';

import './LoadingSpinner.css';

interface LoadingSpinnerProps {
  type?: 'spinner' | 'table' | 'cards' | 'list' | 'notices';
  rows?: number;
  message?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ type = 'spinner', rows = 6, message }) => {
  if (type === 'spinner') {
    return (
      <div className="spinner-container">
        <div className="spinner-circle" />
        {message && <span className="spinner-message">{message}</span>}
      </div>
    );
  }

  if (type === 'table') {
    return (
      <div className="panel spinner-table">
        <div className="table-wrapper">
          <table className="data-table">
            <tbody>
              {Array.from({ length: rows }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={100}>
                    <div className="skeleton spinner-table-skeleton" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (type === 'cards') {
    return (
      <div className="spinner-cards">
        {Array.from({ length: rows }).map((_, i) => (
          <div className="user-card spinner-card" key={i}>
            <div className="skeleton spinner-card-avatar" />
            <div className="skeleton spinner-card-line" />
            <div className="skeleton spinner-card-line-sm" />
            <div className="skeleton spinner-card-pill" />
            <div className="spinner-card-actions">
              <div className="skeleton spinner-card-btn" />
              <div className="skeleton spinner-card-btn" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'list') {
    return (
      <div className="spinner-list">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="spinner-list-item">
            <div className="skeleton spinner-list-avatar" />
            <div className="spinner-list-content">
              <div className="skeleton spinner-list-line" />
              <div className="skeleton spinner-list-line-sm" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'notices') {
    return (
      <div className="spinner-notices">
        {Array.from({ length: rows }).map((_, i) => (
          <div className="notice-card" key={i}>
            <div className="spinner-notice-header">
              <div className="skeleton spinner-notice-badge" />
              <div className="skeleton spinner-notice-date" />
            </div>
            <div className="skeleton spinner-notice-title" />
            <div className="skeleton spinner-notice-line" />
            <div className="skeleton spinner-notice-line-sm" />
            <div className="skeleton spinner-notice-line-xs" />
          </div>
        ))}
      </div>
    );
  }

  return null;
};
