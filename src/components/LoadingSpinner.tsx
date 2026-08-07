import React from 'react';

interface LoadingSpinnerProps {
  type?: 'spinner' | 'table' | 'cards' | 'list' | 'notices';
  rows?: number;
  message?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ type = 'spinner', rows = 6, message }) => {
  if (type === 'spinner') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px', gap: '16px' }}>
        <div
          style={{
            width: '40px',
            height: '40px',
            border: '3px solid var(--border-color)',
            borderTopColor: 'var(--color-primary)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
        {message && <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{message}</span>}
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (type === 'table') {
    return (
      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrapper">
          <table className="data-table">
            <tbody>
              {Array.from({ length: rows }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={100}>
                    <div className="skeleton" style={{ width: '100%', height: '48px' }} />
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
      <div className="user-grid">
        {Array.from({ length: rows }).map((_, i) => (
          <div className="user-card" key={i}>
            <div className="skeleton" style={{ width: '72px', height: '72px', borderRadius: '50%', marginBottom: '12px' }} />
            <div className="skeleton" style={{ width: '120px', height: '18px', marginBottom: '8px' }} />
            <div className="skeleton" style={{ width: '160px', height: '14px', marginBottom: '16px' }} />
            <div className="skeleton" style={{ width: '80px', height: '28px', borderRadius: '4px', marginBottom: '16px' }} />
            <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
              <div className="skeleton" style={{ flex: 1, height: '36px', borderRadius: '4px' }} />
              <div className="skeleton" style={{ flex: 1, height: '36px', borderRadius: '4px' }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'list') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0' }}>
            <div className="skeleton" style={{ width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton" style={{ width: '60%', height: '16px', marginBottom: '8px' }} />
              <div className="skeleton" style={{ width: '40%', height: '14px' }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'notices') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div className="notice-card" key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div className="skeleton" style={{ width: '120px', height: '28px', borderRadius: '4px' }} />
              <div className="skeleton" style={{ width: '80px', height: '14px' }} />
            </div>
            <div className="skeleton" style={{ width: '60%', height: '22px', marginBottom: '12px' }} />
            <div className="skeleton" style={{ width: '100%', height: '16px', marginBottom: '8px' }} />
            <div className="skeleton" style={{ width: '90%', height: '16px', marginBottom: '8px' }} />
            <div className="skeleton" style={{ width: '40%', height: '16px' }} />
          </div>
        ))}
      </div>
    );
  }

  return null;
};
