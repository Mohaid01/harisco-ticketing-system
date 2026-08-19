import { SquarePen } from 'lucide-react';
import React from 'react';

import type { AppUser, Notice, NoticeType } from '../../types';

interface NoticeCardProps {
  notice: Notice;
  isAdmin: boolean;
  currentUser: AppUser;
  onEditNoticeClick?: (noticeId: string) => void;
  getTagMeta: (type: NoticeType) => {
    label: string;
    icon: React.ReactNode;
    className: string;
  };
}

export const NoticeCard: React.FC<NoticeCardProps> = ({
  notice,
  isAdmin,
  currentUser,
  onEditNoticeClick,
  getTagMeta,
}) => {
  const now = new Date();
  const meta = getTagMeta(notice.type);
  const isExpired = notice.expiresAt && new Date(notice.expiresAt) <= now;
  const isAuthor = notice.authorName === currentUser?.name;
  console.log(notice.authorName, currentUser?.name);

  return (
    <div
      className={`notice-card notice-card-${notice.type} ${isExpired ? 'notice-card-expired' : ''} ${(isAdmin || isAuthor) && onEditNoticeClick ? 'notice-card-clickable' : ''}`}
    >
      <div className="notice-badge-section">
        <div className="notice-badge-row">
          <span className={`badge ${meta.className}`}>
            {meta.icon} {meta.label}
          </span>
        </div>
        <div className="notice-meta-date">
          <div>
            {new Date(notice.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
          {notice.expiresAt && (
            <div className={`notice-meta-expires ${isExpired ? 'notice-meta-expires-expired' : ''}`}>
              {isExpired
                ? 'Expired'
                : `Expires: ${new Date(notice.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
            </div>
          )}
        </div>
      </div>

      <div className="notice-content-area">
        <div className="notice-lang-box ltr">
          <span className="notice-lang-header">English Announcement</span>
          <h2 className="notice-content-title">{notice.en.title}</h2>
          <p className="notice-content-text">{notice.en.content}</p>
        </div>

        {notice.ur?.title && (
          <div className="notice-lang-box rtl">
            <span className="notice-lang-header">اردو اعلان</span>
            <h2 className="notice-content-title-ur">{notice.ur.title}</h2>
            <p className="notice-content-text-ur">{notice.ur.content}</p>
          </div>
        )}
      </div>

      <div className="notice-footer">
        <span className="notice-author-row">
          Posted by
          <div className="notice-author-info">
            {notice?.authorAvatar ? (
              <img src={notice.authorAvatar} alt={notice.authorName} className="notice-author-avatar" />
            ) : (
              <div className="notice-author-avatar-placeholder">
                {notice.authorName
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2)}
              </div>
            )}
            <div>
              <strong className="notice-author-name">{notice.authorName}</strong>
              {' | '}
              {notice.authorDepartment} - {notice.authorDesignation}
            </div>
          </div>
        </span>
        {isAuthor && onEditNoticeClick && (
          <button className="btn btn-primary" onClick={() => onEditNoticeClick(notice.id)} title="Edit Notice">
            <SquarePen size={20} />
          </button>
        )}
      </div>
    </div>
  );
};
