import React from 'react';

import { Award, Briefcase, FileText, Globe, GraduationCap, Laptop, Pencil, User, Users } from 'lucide-react';

import type { ExperienceRow, FormData, RepeaterRow } from '../types';

import './CVReviewSummary.css';

const NOT_SPECIFIED = '—';
const NO_ENTRIES_TEXT = 'No entries provided';
const ENTRY_LABEL = 'Entry';

interface CVReviewSummaryProps {
  data: FormData;
  onNavigateStep: (stepIndex: number) => void;
  onSubmit?: () => void;
  isSubmitting?: boolean;
}

const isNonEmptyRow = (row: Record<string, unknown>): boolean => {
  return Object.values(row).some((val) => {
    if (Array.isArray(val)) {
      return val.some((v) => typeof v === 'string' && v.trim().length > 0);
    }
    return typeof val === 'string' && val.trim().length > 0;
  });
};

export const CVReviewSummary: React.FC<CVReviewSummaryProps> = ({
  data,
  onNavigateStep,
  onSubmit,
  isSubmitting = false,
}) => {
  const validExperience = (data.experience || []).filter(isNonEmptyRow);
  const validAcademics = (data.academicDetails || []).filter(isNonEmptyRow);
  const validCertifications = (data.certifications || []).filter(isNonEmptyRow);
  const validAwards = (data.awards || []).filter(isNonEmptyRow);
  const validComputerSkills = (data.computerSkills || []).filter(isNonEmptyRow);
  const validLanguages = (data.foreignLanguages || []).filter(isNonEmptyRow);
  const validReferences = (data.references || []).filter(isNonEmptyRow);

  const formatExperienceDuration = (years: string, months: string, asOfMonth: string, asOfYear: string): string => {
    const y = years || '0';
    const m = months || '0';
    const asOf = asOfMonth && asOfYear ? ` (As of ${asOfMonth}/${asOfYear})` : '';
    return `${y} yr${y === '1' ? '' : 's'}, ${m} mo${m === '1' ? '' : 's'}${asOf}`;
  };

  const renderField = (label: string, value: string | undefined | null) => (
    <div className="cv-review-field">
      <span className="cv-review-field-label">{label}</span>
      <div className="cv-review-field-value">
        {value && String(value).trim() ? value : <span className="cv-review-field-fallback">{NOT_SPECIFIED}</span>}
      </div>
    </div>
  );

  return (
    <div className="cv-review-summary">
      <div className="cv-review-intro">
        <h3 className="cv-review-intro-title">Review Your Application</h3>
        <p className="cv-review-intro-text">
          Please carefully review all submitted information before final submission. Click Edit on any section to make
          updates.
        </p>
      </div>

      <div className="cv-review-section">
        <div className="cv-review-section-header">
          <div className="cv-review-section-title">
            <FileText className="w-4 h-4" />
            <h4>Job & Experience Overview</h4>
          </div>
          <div className="cv-review-section-badge">
            {validExperience.length} {validExperience.length === 1 ? 'entry' : 'entries'}
          </div>
          <button type="button" onClick={() => onNavigateStep(0)} className="cv-btn cv-btn-secondary">
            <Pencil className="w-3.5 h-3.5" />
            <span className="cv-btn-text">Edit</span>
          </button>
        </div>
        <div className="cv-review-grid cv-review-grid-3">
          {renderField('Post Applied For', data.postAppliedFor)}
          {renderField('Job Code', data.code)}
          {renderField('Notice Period', data.noticePeriodDays ? `${data.noticePeriodDays} Days` : undefined)}
          <div className="cv-review-field-span-2">
            {renderField(
              'Total Industry Experience',
              formatExperienceDuration(
                data.totalExpYears,
                data.totalExpMonths,
                data.totalExpAsOfMonth,
                data.totalExpAsOfYear
              )
            )}
          </div>
          <div className="cv-review-field-span-3">
            {renderField(
              'Job Relevant Experience',
              formatExperienceDuration(
                data.relevantExpYears,
                data.relevantExpMonths,
                data.relevantExpAsOfMonth,
                data.relevantExpAsOfYear
              )
            )}
          </div>
        </div>
      </div>

      <div className="cv-review-section">
        <div className="cv-review-section-header">
          <div className="cv-review-section-title">
            <User className="w-4 h-4" />
            <h4>Personal Details</h4>
          </div>
          <button type="button" onClick={() => onNavigateStep(0)} className="cv-btn cv-btn-secondary">
            <Pencil className="w-3.5 h-3.5" />
            <span className="cv-btn-text">Edit</span>
          </button>
        </div>
        <div className="cv-review-personal">
          {data.photoPreview ? (
            <div className="cv-review-photo-wrapper">
              <img src={data.photoPreview} alt="Candidate" className="cv-review-photo" />
              <span className="cv-review-photo-label">Photo Uploaded</span>
            </div>
          ) : (
            <div className="cv-review-photo-placeholder">
              <User className="w-6 h-6" />
              <span className="cv-review-photo-label">No Photo</span>
            </div>
          )}
          <div className="cv-review-grid cv-review-grid-3 cv-review-personal-grid">
            {renderField('Full Name', data.fullName)}
            {renderField("Father's Name", data.fatherName)}
            {renderField('Date of Birth', data.dob)}
            {renderField('Blood Group', data.bloodGroup)}
            {renderField('Phone Number', data.phone)}
            {renderField('Email Address', data.email)}
            {renderField('CNIC Number', data.cnicNumber)}
            {renderField('CNIC Expiry', data.cnicExpiry)}
            {renderField('Passport Number', data.passportNumber || undefined)}
            {renderField('Passport Expiry', data.passportExpiry || undefined)}
            <div className="cv-review-field-span-full">{renderField('Permanent Address', data.permanentAddress)}</div>
          </div>
        </div>

        <div className="cv-review-section-sub">
          <div className="cv-review-sub-title">Emergency Contacts</div>
          <div className="cv-review-grid cv-review-grid-2">
            <div>
              <div className="cv-review-sub-entry">
                <span className="cv-review-sub-label">1. {data.emergencyContact1Name || NOT_SPECIFIED}</span>
                <span className="cv-review-sub-text">({data.emergencyContact1Relation || NOT_SPECIFIED})</span>
                <span className="cv-review-sub-text">{data.emergencyContact1Phone || NOT_SPECIFIED}</span>
              </div>
              {(data.emergencyContact2Name || data.emergencyContact2Phone) && (
                <div className="cv-review-sub-entry cv-review-sub-entry-2">
                  <span className="cv-review-sub-label">2. {data.emergencyContact2Name || NOT_SPECIFIED}</span>
                  <span className="cv-review-sub-text">({data.emergencyContact2Relation || NOT_SPECIFIED})</span>
                  <span className="cv-review-sub-text">{data.emergencyContact2Phone || NOT_SPECIFIED}</span>
                </div>
              )}
            </div>
            <div className="cv-review-dependants">
              <div className="cv-review-sub-title">Dependants</div>
              <div className="cv-review-dependants-grid">
                <div className="cv-review-dependant-item">
                  <span className="cv-review-dependant-label">Spouse</span>
                  <span className="cv-review-dependant-value">{data.dependantsSpouse ?? 0}</span>
                </div>
                <div className="cv-review-dependant-item">
                  <span className="cv-review-dependant-label">Sons</span>
                  <span className="cv-review-dependant-value">{data.dependantsSons ?? 0}</span>
                </div>
                <div className="cv-review-dependant-item">
                  <span className="cv-review-dependant-label">Daughters</span>
                  <span className="cv-review-dependant-value">{data.dependantsDaughters ?? 0}</span>
                </div>
                <div className="cv-review-dependant-item">
                  <span className="cv-review-dependant-label">Others</span>
                  <span className="cv-review-dependant-value">{data.dependantsOthers ?? 0}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="cv-review-section">
        <div className="cv-review-section-header">
          <div className="cv-review-section-title">
            <Briefcase className="w-4 h-4" />
            <h4>Work Experience</h4>
          </div>
          <button type="button" onClick={() => onNavigateStep(1)} className="cv-btn cv-btn-secondary">
            <Pencil className="w-3.5 h-3.5" />
            <span className="cv-btn-text">Edit</span>
          </button>
        </div>
        {validExperience.length === 0 ? (
          <p className="cv-empty-text">{NO_ENTRIES_TEXT}</p>
        ) : (
          <div className="cv-review-list">
            {validExperience.map((exp, idx) => {
              const descriptions = Array.isArray(exp.descriptions)
                ? exp.descriptions.filter((d) => typeof d === 'string' && d.trim().length > 0)
                : [];

              return (
                <div key={idx} className="cv-review-exp-card">
                  <div className="cv-review-exp-header">
                    <span className="cv-review-entry-label">
                      {ENTRY_LABEL} {idx + 1}
                    </span>
                    <span className="cv-review-exp-dates">
                      {exp.from || NOT_SPECIFIED} — {exp.to || 'Present'}
                    </span>
                  </div>
                  <h5 className="cv-review-exp-title">
                    {exp.position || NOT_SPECIFIED}{' '}
                    <span className="cv-review-exp-company">at {exp.company || NOT_SPECIFIED}</span>
                  </h5>
                  {descriptions.length > 0 && (
                    <ul className="cv-review-exp-desc">
                      {descriptions.map((desc, dIdx) => (
                        <li key={dIdx}>{desc}</li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="cv-review-section">
        <div className="cv-review-section-header">
          <div className="cv-review-section-title">
            <GraduationCap className="w-4 h-4" />
            <h4>Academic Details</h4>
          </div>
          <button type="button" onClick={() => onNavigateStep(2)} className="cv-btn cv-btn-secondary">
            <Pencil className="w-3.5 h-3.5" />
            <span className="cv-btn-text">Edit</span>
          </button>
        </div>
        {validAcademics.length === 0 ? (
          <p className="cv-empty-text">{NO_ENTRIES_TEXT}</p>
        ) : (
          <div className="cv-review-grid cv-review-grid-2">
            {validAcademics.map((acad, idx) => (
              <div key={idx} className="cv-review-acad-card">
                <span className="cv-review-entry-label">
                  {ENTRY_LABEL} {idx + 1}
                </span>
                <span className="cv-review-acad-dates">
                  {acad.sessionFrom || NOT_SPECIFIED} — {acad.sessionTo || NOT_SPECIFIED}
                </span>
                <h5 className="cv-review-acad-title">{acad.degree || NOT_SPECIFIED}</h5>
                <p className="cv-review-acad-inst">{acad.institution || NOT_SPECIFIED}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="cv-review-section">
        <div className="cv-review-section-header">
          <div className="cv-review-section-title">
            <Award className="w-4 h-4" />
            <h4>Certifications</h4>
          </div>
          <button type="button" onClick={() => onNavigateStep(3)} className="cv-btn cv-btn-secondary">
            <Pencil className="w-3.5 h-3.5" />
            <span className="cv-btn-text">Edit</span>
          </button>
        </div>
        {validCertifications.length === 0 ? (
          <p className="cv-empty-text">{NO_ENTRIES_TEXT}</p>
        ) : (
          <div className="cv-review-grid cv-review-grid-3">
            {validCertifications.map((cert, idx) => (
              <div key={idx} className="cv-review-cert-card">
                <span className="cv-review-entry-label">
                  {ENTRY_LABEL} {idx + 1}
                </span>
                {cert.year && <span className="cv-review-cert-year">{cert.year}</span>}
                <h5 className="cv-review-cert-title">{cert.name || NOT_SPECIFIED}</h5>
                <p className="cv-review-acad-inst">{cert.institution || NOT_SPECIFIED}</p>
                {cert.body && <p className="cv-review-cert-body">Body: {cert.body}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="cv-review-section">
        <div className="cv-review-section-header">
          <div className="cv-review-section-title">
            <Award className="w-4 h-4" />
            <h4>Awards & Achievements</h4>
          </div>
          <button type="button" onClick={() => onNavigateStep(4)} className="cv-btn cv-btn-secondary">
            <Pencil className="w-3.5 h-3.5" />
            <span className="cv-btn-text">Edit</span>
          </button>
        </div>
        {validAwards.length === 0 ? (
          <p className="cv-empty-text">{NO_ENTRIES_TEXT}</p>
        ) : (
          <div className="cv-review-grid cv-review-grid-2">
            {validAwards.map((award, idx) => (
              <div key={idx} className="cv-review-award-card">
                <span className="cv-review-entry-label">
                  {ENTRY_LABEL} {idx + 1}
                </span>
                {award.year && <span className="cv-review-award-year">{award.year}</span>}
                <h5 className="cv-review-award-title">{award.institution || NOT_SPECIFIED}</h5>
                {award.body && <p className="cv-review-cert-body">Authorized Body: {award.body}</p>}
                {award.description && <p className="cv-review-award-desc">{award.description}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="cv-review-section">
        <div className="cv-review-section-header">
          <div className="cv-review-section-title">
            <Laptop className="w-4 h-4" />
            <h4>Computer Skills</h4>
          </div>
          <button type="button" onClick={() => onNavigateStep(5)} className="cv-btn cv-btn-secondary">
            <Pencil className="w-3.5 h-3.5" />
            <span className="cv-btn-text">Edit</span>
          </button>
        </div>
        {validComputerSkills.length === 0 ? (
          <p className="cv-empty-text">{NO_ENTRIES_TEXT}</p>
        ) : (
          <div className="cv-review-grid cv-review-grid-3">
            {validComputerSkills.map((skill, idx) => (
              <div key={idx} className="cv-review-skill-card">
                <span className="cv-review-skill-name">{skill.name || NOT_SPECIFIED}</span>
                <span className="cv-review-skill-level">{skill.level || NOT_SPECIFIED}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="cv-review-section">
        <div className="cv-review-section-header">
          <div className="cv-review-section-title">
            <Globe className="w-4 h-4" />
            <h4>Foreign Languages</h4>
          </div>
          <button type="button" onClick={() => onNavigateStep(6)} className="cv-btn cv-btn-secondary">
            <Pencil className="w-3.5 h-3.5" />
            <span className="cv-btn-text">Edit</span>
          </button>
        </div>
        {validLanguages.length === 0 ? (
          <p className="cv-empty-text">{NO_ENTRIES_TEXT}</p>
        ) : (
          <div className="cv-review-grid cv-review-grid-3">
            {validLanguages.map((lang, idx) => (
              <div key={idx} className="cv-review-lang-card">
                <h5 className="cv-review-lang-name">{lang.name || NOT_SPECIFIED}</h5>
                <div className="cv-review-lang-grid">
                  <div className="cv-review-lang-item">
                    <span className="cv-review-lang-label">Reading</span>
                    <span className="cv-review-lang-value">{lang.reading || NOT_SPECIFIED}</span>
                  </div>
                  <div className="cv-review-lang-item">
                    <span className="cv-review-lang-label">Writing</span>
                    <span className="cv-review-lang-value">{lang.writing || NOT_SPECIFIED}</span>
                  </div>
                  <div className="cv-review-lang-item">
                    <span className="cv-review-lang-label">Speaking</span>
                    <span className="cv-review-lang-value">{lang.speaking || NOT_SPECIFIED}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="cv-review-section">
        <div className="cv-review-section-header">
          <div className="cv-review-section-title">
            <Users className="w-4 h-4" />
            <h4>Professional References</h4>
          </div>
          <button type="button" onClick={() => onNavigateStep(7)} className="cv-btn cv-btn-secondary">
            <Pencil className="w-3.5 h-3.5" />
            <span className="cv-btn-text">Edit</span>
          </button>
        </div>
        {validReferences.length === 0 ? (
          <p className="cv-empty-text">{NO_ENTRIES_TEXT}</p>
        ) : (
          <div className="cv-review-grid cv-review-grid-3">
            {validReferences.map((ref, idx) => (
              <div key={idx} className="cv-review-ref-card">
                <span className="cv-review-entry-label">
                  {ENTRY_LABEL} {idx + 1}
                </span>
                <h5 className="cv-review-ref-name">{ref.name || NOT_SPECIFIED}</h5>
                <p className="cv-review-ref-mobile">{ref.mobile || NOT_SPECIFIED}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="cv-review-submit">
        <button onClick={onSubmit} disabled={isSubmitting} className="cv-btn cv-btn-primary cv-btn-submit">
          {isSubmitting ? 'Sending...' : 'Generate & Send CV'}
        </button>
      </div>
    </div>
  );
};

export type { RepeaterRow };
export type { ExperienceRow };
export default CVReviewSummary;
