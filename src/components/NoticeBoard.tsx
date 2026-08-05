import { AlertTriangle, Archive, Clock, Eye, FileText, Info, Megaphone, Plus } from 'lucide-react';
import React, { useState } from 'react';

import type { AppUser, Notice, NoticeType } from '../types';

interface NoticeBoardProps {
  notices: Notice[];
  currentUser: AppUser;
  onCreateNoticeClick: () => void;
  onEditNoticeClick?: (noticeId: string) => void;
}

export const NoticeBoard: React.FC<NoticeBoardProps> = ({
  notices,
  currentUser,
  onCreateNoticeClick,
  onEditNoticeClick,
}) => {
  const isAdmin = currentUser.role !== 'employee';
  const [activeTab, setActiveTab] = useState<'active' | 'archive'>('active');
  const now = new Date();

  // Partitioning Logic (Active vs. Expired)
  const activeNotices = notices.filter((notice) => {
    if (!notice.expiresAt) return true;
    return new Date(notice.expiresAt) >= now;
  });

  const archivedNotices = notices.filter((notice) => {
    if (!notice.expiresAt) return false;
    return new Date(notice.expiresAt) < now;
  });

  // Outages sit at the absolute top of the timeline
  const sortedNotices = [...(isAdmin && activeTab === 'archive' ? archivedNotices : activeNotices)].sort((a, b) => {
    if (a.type === 'outage' && b.type !== 'outage') return -1;
    if (a.type !== 'outage' && b.type === 'outage') return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const getTagMeta = (type: NoticeType) => {
    switch (type) {
      case 'outage':
        return {
          label: 'Outage / Urgent',
          icon: <AlertTriangle size={14} />,
          style: {
            backgroundColor: 'rgba(220, 38, 38, 0.12)',
            color: '#ef4444',
          },
        };
      case 'maintenance':
        return {
          label: 'Maintenance',
          icon: <Clock size={14} />,
          style: {
            backgroundColor: 'rgba(245, 158, 11, 0.12)',
            color: '#f59e0b',
          },
        };
      case 'policy':
        return {
          label: 'Policy Update',
          icon: <FileText size={14} />,
          style: {
            backgroundColor: 'rgba(59, 130, 246, 0.12)',
            color: '#3b82f6',
          },
        };
      case 'general':
      default:
        return {
          label: 'General Info',
          icon: <Info size={14} />,
          style: {
            backgroundColor: 'rgba(20, 184, 166, 0.12)',
            color: '#14b8a6',
          },
        };
    }
  };

  return (
    <div className="notice-board-container">
      {/* Structural Header remains uniformly English LTR */}
      <div className="notice-header-row">
        <div className="notice-header-left">
          <h1
            className="page-title"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              margin: 0,
            }}
          >
            <Megaphone size={28} className="text-primary" /> Operations Notice Board
          </h1>
          <p className="page-subtitle" style={{ marginTop: '4px', marginBottom: 0 }}>
            Welcome back, <strong>{currentUser.name}</strong>. Stay updated with critical system alerts and internal
            announcements.
          </p>
        </div>

        {isAdmin && (
          <button
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            onClick={onCreateNoticeClick}
          >
            <Plus size={16} /> Post New Notice
          </button>
        )}
      </div>

      {/* Admin Historical View Switcher */}
      {isAdmin && (
        <div
          style={{
            display: 'flex',
            gap: '12px',
            marginBottom: '20px',
            borderBottom: '1px solid #2d3748',
            paddingBottom: '10px',
          }}
        >
          <button
            className={`btn ${activeTab === 'active' ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              fontSize: '0.85rem',
              padding: '6px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            onClick={() => setActiveTab('active')}
          >
            <Eye size={14} /> Active Board ({activeNotices.length})
          </button>
          <button
            className={`btn ${activeTab === 'archive' ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              fontSize: '0.85rem',
              padding: '6px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            onClick={() => setActiveTab('archive')}
          >
            <Archive size={14} /> Archived / Expired ({archivedNotices.length})
          </button>
        </div>
      )}

      {/* Notice Feed Stream */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {sortedNotices.map((notice) => {
          const meta = getTagMeta(notice.type);
          const isExpired = notice.expiresAt && new Date(notice.expiresAt) <= now;

          return (
            <div
              key={notice.id}
              className={`notice-card notice-card-${notice.type} ${isExpired ? 'notice-card-expired' : ''}`}
              style={{
                cursor: isAdmin && onEditNoticeClick ? 'pointer' : 'default',
              }}
              onClick={() => isAdmin && onEditNoticeClick && onEditNoticeClick(notice.id)}
            >
              {/* Notice Metadata Header (English LTR) */}
              <div className="notice-badge-section">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span
                    className="badge"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      ...meta.style,
                    }}
                  >
                    {meta.icon} {meta.label}
                  </span>
                </div>
                <div
                  style={{
                    textAlign: 'right',
                    fontSize: '0.78rem',
                    color: 'var(--text-muted, #a0aec0)',
                  }}
                >
                  <div>
                    {new Date(notice.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                  {notice.expiresAt && (
                    <div
                      style={{
                        fontSize: '0.72rem',
                        marginTop: '2px',
                        color: isExpired ? '#ef4444' : 'var(--text-muted)',
                      }}
                    >
                      {isExpired
                        ? 'Expired'
                        : `Expires: ${new Date(notice.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                    </div>
                  )}
                </div>
              </div>

              {/* BILINGUAL CONTENT AREA */}
              <div className="notice-content-area">
                {/* 1. English Content Block */}
                <div className="notice-lang-box ltr">
                  <span className="notice-lang-header">English Announcement</span>
                  <h2
                    style={{
                      margin: '0 0 6px 0',
                      fontSize: '1.1rem',
                      color: 'white',
                      fontWeight: 600,
                    }}
                  >
                    {notice.en.title}
                  </h2>
                  <p
                    style={{
                      margin: 0,
                      fontSize: '0.9rem',
                      color: 'var(--text-secondary, #e2e8f0)',
                      lineHeight: '1.5',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {notice.en.content}
                  </p>
                </div>

                {/* 2. Urdu Content Block (Strictly RTL & Right Aligned) */}
                {notice.ur?.title && (
                  <div className="notice-lang-box rtl">
                    <span className="notice-lang-header">اردو اعلان</span>
                    <h2
                      style={{
                        margin: '0 0 6px 0',
                        fontSize: '1.2rem',
                        color: 'white',
                        fontWeight: 600,
                        fontFamily: 'inherit',
                      }}
                    >
                      {notice.ur.title}
                    </h2>
                    <p
                      style={{
                        margin: 0,
                        fontSize: '1rem',
                        color: 'var(--text-secondary, #e2e8f0)',
                        lineHeight: '1.6',
                        whiteSpace: 'pre-wrap',
                        fontFamily: 'inherit',
                      }}
                    >
                      {notice.ur.content}
                    </p>
                  </div>
                )}
              </div>

              {/* Card Footer */}
              <div className="notice-footer">
                <span
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'start',
                    gap: '12px',
                  }}
                >
                  Posted by
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.78rem',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {notice?.authorAvatar ? (
                      <img
                        src={notice.authorAvatar}
                        alt={notice.authorName}
                        style={{
                          width: '64px',
                          height: '64px',
                          borderRadius: '50%',
                          objectFit: 'cover',
                          border: '1px solid var(--border-color)',
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '64px',
                          height: '64px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--color-primary-glow)',
                          border: '1px solid var(--border-color)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 600,
                          fontSize: '0.8rem',
                          color: 'white',
                        }}
                      />
                    )}
                    <strong>{notice.authorName}</strong>
                    {' | '}
                    {notice.authorDepartment} - {notice.authorDesignation}
                  </div>
                </span>
                {isAdmin && onEditNoticeClick && (
                  <span style={{ color: 'var(--color-primary-solid, #3b82f6)' }}>Click to edit notice</span>
                )}
              </div>
            </div>
          );
        })}

        {/* Empty State */}
        {sortedNotices.length === 0 && (
          <div
            className="panel"
            style={{
              textAlign: 'center',
              padding: '60px 20px',
              color: 'var(--text-secondary)',
            }}
          >
            <Megaphone size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
            <p style={{ margin: 0, fontSize: '0.95rem' }}>
              {activeTab === 'archive'
                ? 'The history archive is empty.'
                : 'No active notices broadcasted on the board right now.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
