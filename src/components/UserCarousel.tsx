import { Users } from 'lucide-react';
import React from 'react';

interface UserCarouselProps {
  children: React.ReactNode;
  loading?: boolean;
}

export const UserCarousel: React.FC<UserCarouselProps> = ({ children, loading = false }) => {
  if (loading) {
    return (
      <div style={{ display: 'flex', gap: '1.0625rem', overflow: 'hidden', flex: 1 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div className="user-card" key={i} style={{ minWidth: '13.8125rem', flex: '0 0 auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.7438rem' }}>
              <div className="skeleton" style={{ width: '3.825rem', height: '3.825rem', borderRadius: '50%' }} />
              <div className="skeleton" style={{ width: '6.375rem', height: '0.9563rem' }} />
              <div className="skeleton" style={{ width: '4.25rem', height: '0.7438rem' }} />
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.425rem', marginTop: '0.425rem' }}>
                <div className="skeleton" style={{ width: '100%', height: '0.85rem' }} />
                <div className="skeleton" style={{ width: '80%', height: '0.85rem' }} />
              </div>
              <div
                className="skeleton"
                style={{ width: '4.7813rem', height: '1.4875rem', borderRadius: '1.0625rem', margin: '0.425rem auto' }}
              />
              <div style={{ display: 'flex', gap: '0.425rem', width: '100%', marginTop: 'auto' }}>
                <div className="skeleton" style={{ flex: 1, height: '1.9125rem', borderRadius: '0.2125rem' }} />
                <div className="skeleton" style={{ flex: 1, height: '1.9125rem', borderRadius: '0.2125rem' }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  const items = React.Children.toArray(children);

  if (items.length === 0) {
    return (
      <div
        className="panel"
        style={{
          textAlign: 'center',
          padding: '3.1875rem 1.0625rem',
          color: 'var(--text-secondary)',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Users size={40} style={{ opacity: 0.3, marginBottom: '0.6375rem' }} />
        <p style={{ margin: 0, fontSize: '0.95rem' }}>No users found.</p>
      </div>
    );
  }

  return (
    <div className="user-carousel-container" style={{ flex: 1, minHeight: 0 }}>
      <div className="user-carousel-track">
        {items.map((child, index) => (
          <div className="user-carousel-item" key={index}>
            {child}
          </div>
        ))}
      </div>
    </div>
  );
};
