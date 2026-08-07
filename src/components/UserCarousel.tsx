import React from 'react';
import { Users } from 'lucide-react';

interface UserCarouselProps {
  children: React.ReactNode;
  loading?: boolean;
}

export const UserCarousel: React.FC<UserCarouselProps> = ({ children, loading = false }) => {
  if (loading) {
    return (
      <div style={{ display: 'flex', gap: '20px', overflow: 'hidden', flex: 1 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div className="user-card" key={i} style={{ minWidth: '260px', flex: '0 0 auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
              <div className="skeleton" style={{ width: '72px', height: '72px', borderRadius: '50%' }} />
              <div className="skeleton" style={{ width: '120px', height: '18px' }} />
              <div className="skeleton" style={{ width: '80px', height: '14px' }} />
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                <div className="skeleton" style={{ width: '100%', height: '16px' }} />
                <div className="skeleton" style={{ width: '80%', height: '16px' }} />
              </div>
              <div className="skeleton" style={{ width: '90px', height: '28px', borderRadius: '20px', margin: '8px auto' }} />
              <div style={{ display: 'flex', gap: '8px', width: '100%', marginTop: 'auto' }}>
                <div className="skeleton" style={{ flex: 1, height: '36px', borderRadius: '4px' }} />
                <div className="skeleton" style={{ flex: 1, height: '36px', borderRadius: '4px' }} />
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
          padding: '60px 20px',
          color: 'var(--text-secondary)',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Users size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
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
