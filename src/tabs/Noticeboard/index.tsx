import { AlertTriangle, Archive, Clock, Eye, FileText, Info, Megaphone, Plus } from 'lucide-react';
import React, { useState } from 'react';

import type { AppUser, Notice, NoticeType } from '../../types';

import { LoadingSpinner } from '../../components/LoadingSpinner';
import { NoticeCard } from '../../components/Noticeboard/NoticeCard';
import './Noticeboard.css';

interface NoticeBoardProps {
  notices: Notice[];
  currentUser: AppUser;
  onCreateNoticeClick: () => void;
  onEditNoticeClick?: (noticeId: string) => void;
  loading?: boolean;
}

export const NoticeBoard: React.FC<NoticeBoardProps> = ({
  notices,
  currentUser,
  onCreateNoticeClick,
  onEditNoticeClick,
  loading = false,
}) => {
  const isAdmin = currentUser.role !== 'employee';
  const [activeTab, setActiveTab] = useState<'active' | 'archive'>('active');
  const now = new Date();

  const activeNotices = notices.filter((notice) => {
    if (!notice.expiresAt) return true;
    return new Date(notice.expiresAt) >= now;
  });

  const archivedNotices = notices.filter((notice) => {
    if (!notice.expiresAt) return false;
    return new Date(notice.expiresAt) < now;
  });

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
          className: 'notice-badge-outage',
        };
      case 'maintenance':
        return {
          label: 'Maintenance',
          icon: <Clock size={14} />,
          className: 'notice-badge-maintenance',
        };
      case 'policy':
        return {
          label: 'Policy Update',
          icon: <FileText size={14} />,
          className: 'notice-badge-policy',
        };
      case 'general':
      default:
        return {
          label: 'General Info',
          icon: <Info size={14} />,
          className: 'notice-badge-general',
        };
    }
  };

  return (
    <div className="noticeboard-container">
      <div className="notice-header-row">
        <div className="notice-header-left">
          <h1 className="notice-header-title">
            <Megaphone size={28} className="text-primary" /> Operations Notice Board
          </h1>
          <p className="notice-header-subtitle">
            Welcome back, <strong>{currentUser.name}</strong>. Stay updated with critical system alerts and internal
            announcements.
          </p>
        </div>

        {isAdmin && (
          <button className="btn btn-primary notice-post-btn" onClick={onCreateNoticeClick}>
            <Plus size={16} /> Post New Notice
          </button>
        )}
      </div>

      {isAdmin && (
        <div className="notice-tab-bar">
          <button
            className={`btn ${activeTab === 'active' ? 'btn-primary' : 'btn-secondary'} notice-tab-btn`}
            onClick={() => setActiveTab('active')}
          >
            <Eye size={14} /> Active Board ({activeNotices.length})
          </button>
          <button
            className={`btn ${activeTab === 'archive' ? 'btn-primary' : 'btn-secondary'} notice-tab-btn`}
            onClick={() => setActiveTab('archive')}
          >
            <Archive size={14} /> Archived / Expired ({archivedNotices.length})
          </button>
        </div>
      )}

      {loading ? (
        <LoadingSpinner type="notices" rows={4} />
      ) : (
        <div className="notice-feed">
          {sortedNotices.map((notice) => (
            <NoticeCard
              key={notice.id}
              notice={notice}
              isAdmin={isAdmin}
              onEditNoticeClick={onEditNoticeClick}
              getTagMeta={getTagMeta}
            />
          ))}

          {sortedNotices.length === 0 && (
            <div className="notice-empty">
              <Megaphone size={40} className="notice-empty-icon" />
              <p className="notice-empty-text">
                {activeTab === 'archive'
                  ? 'The history archive is empty.'
                  : 'No active notices broadcasted on the board right now.'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
