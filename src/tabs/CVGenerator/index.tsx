import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Upload, Plus, Trash2 } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

import type { AppUser } from '../../types';
import type { ExperienceRow, FormData, RepeaterRow } from './types';

import CVInput from './components/CVInput';
import CVNumberInput from './components/CVNumberInput';
import CVReviewSummary from './components/CVReviewSummary';
import RepeaterSection from './components/RepeaterSection';
import { clearDraft, loadDraft, saveDraft } from './utils/draftStorage';
import { blobToBase64, downloadPdf, generateApplicationPdf } from './utils/pdfGenerator';

import './CVGenerator.css';

interface CVGeneratorProps {
  currentUser: AppUser;
  token: string;
}

const initialFormData: FormData = {
  postAppliedFor: '',
  code: '',
  noticePeriodDays: '',
  totalExpYears: '',
  totalExpMonths: '',
  totalExpAsOfMonth: '',
  totalExpAsOfYear: '',
  relevantExpYears: '',
  relevantExpMonths: '',
  relevantExpAsOfMonth: '',
  relevantExpAsOfYear: '',
  fullName: '',
  fatherName: '',
  dob: '',
  bloodGroup: '',
  phone: '',
  email: '',
  cnicNumber: '',
  cnicExpiry: '',
  passportNumber: '',
  passportExpiry: '',
  permanentAddress: '',
  emergencyContact1Name: '',
  emergencyContact1Relation: '',
  emergencyContact1Phone: '',
  emergencyContact2Name: '',
  emergencyContact2Relation: '',
  emergencyContact2Phone: '',
  dependantsSpouse: 0,
  dependantsSons: 0,
  dependantsDaughters: 0,
  dependantsOthers: 0,
  academicDetails: [],
  certifications: [],
  awards: [],
  experience: [],
  computerSkills: [],
  foreignLanguages: [],
  references: [],
  photoPreview: null,
};

const MONTHS = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }));
const YEARS = Array.from({ length: 51 }, (_, i) => 2026 - i);
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const SKILL_LEVELS = ['Basic', 'Good', 'Excellent'];
const LANGUAGE_PROFICIENCY = ['Basic', 'Good', 'Proficient'];

const base64ToFile = (base64: string, filename = 'photo.jpg'): File | null => {
  try {
    const [meta, data] = base64.split(',');
    const mimeMatch = meta.match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const binary = atob(data);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
    return new File([array], filename, { type: mime });
  } catch {
    return null;
  }
};

const compressImageFile = (file: File): Promise<{ preview: string; compressedFile: File } | null> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new window.Image();
      img.onload = () => {
        const maxSize = 400;
        let { width, height } = img;
        if (width > height) {
          if (width > maxSize) {
            height *= maxSize / width;
            width = maxSize;
          }
        } else if (height > maxSize) {
          width *= maxSize / height;
          height = maxSize;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.7);
          const restoredFile = base64ToFile(compressed, file.name || 'photo.jpg');
          if (restoredFile) {
            resolve({ preview: compressed, compressedFile: restoredFile });
          } else {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = reader.result as string;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
};

const formatCNIC = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  const limited = digits.slice(0, 13);
  if (limited.length <= 5) return limited;
  if (limited.length <= 12) return `${limited.slice(0, 5)}-${limited.slice(5)}`;
  return `${limited.slice(0, 5)}-${limited.slice(5, 12)}-${limited.slice(12)}`;
};

const validateRepeater = (rows: RepeaterRow[], fields: string[], sectionName: string, minEntries = 0): boolean => {
  if (rows.length < minEntries) {
    alert(`Please add at least ${minEntries} ${sectionName} entry${minEntries === 1 ? '' : 'ies'}.`);
    return false;
  }
  for (let i = 0; i < rows.length; i++) {
    for (let j = 0; j < fields.length; j++) {
      const field = fields[j];
      if (!rows[i][field]?.trim()) {
        alert(`Please fill all fields in ${sectionName} entry ${i + 1}.`);
        return false;
      }
    }
  }
  return true;
};

const validateRepeaterSilent = (rows: RepeaterRow[], fields: string[], minEntries = 0): boolean => {
  if (rows.length < minEntries) return false;
  for (let i = 0; i < rows.length; i++) {
    for (let j = 0; j < fields.length; j++) {
      const field = fields[j];
      if (!rows[i][field]?.trim()) return false;
    }
  }
  return true;
};

export const CVGenerator: React.FC<CVGeneratorProps> = ({ token }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const formDataRef = useRef<FormData>({ ...initialFormData });

  const [postAppliedFor, setPostAppliedFor] = useState('');
  const [code, setCode] = useState('');
  const [noticePeriodDays, setNoticePeriodDays] = useState('');
  const [totalExpYears, setTotalExpYears] = useState('');
  const [totalExpMonths, setTotalExpMonths] = useState('');
  const [totalExpAsOfMonth, setTotalExpAsOfMonth] = useState('');
  const [totalExpAsOfYear, setTotalExpAsOfYear] = useState('');
  const [relevantExpYears, setRelevantExpYears] = useState('');
  const [relevantExpMonths, setRelevantExpMonths] = useState('');
  const [relevantExpAsOfMonth, setRelevantExpAsOfMonth] = useState('');
  const [relevantExpAsOfYear, setRelevantExpAsOfYear] = useState('');

  const [fullName, setFullName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [dob, setDob] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [cnicNumber, setCnicNumber] = useState('');
  const [cnicExpiry, setCnicExpiry] = useState('');
  const [passportNumber, setPassportNumber] = useState('');
  const [passportExpiry, setPassportExpiry] = useState('');
  const [permanentAddress, setPermanentAddress] = useState('');
  const [emgName1, setEmgName1] = useState('');
  const [emgRel1, setEmgRel1] = useState('');
  const [emgPhone1, setEmgPhone1] = useState('');
  const [emgName2, setEmgName2] = useState('');
  const [emgRel2, setEmgRel2] = useState('');
  const [emgPhone2, setEmgPhone2] = useState('');
  const [dependantsSpouse, setDependantsSpouse] = useState(0);
  const [dependantsSons, setDependantsSons] = useState(0);
  const [dependantsDaughters, setDependantsDaughters] = useState(0);
  const [dependantsOthers, setDependantsOthers] = useState(0);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [academicDetails, setAcademicDetails] = useState<RepeaterRow[]>([]);
  const [certifications, setCertifications] = useState<RepeaterRow[]>([]);
  const [awards, setAwards] = useState<RepeaterRow[]>([]);
  const [experience, setExperience] = useState<ExperienceRow[]>([]);
  const [computerSkills, setComputerSkills] = useState<RepeaterRow[]>([]);
  const [foreignLanguages, setForeignLanguages] = useState<RepeaterRow[]>([]);
  const [references, setReferences] = useState<RepeaterRow[]>([
    { name: '', mobile: '' },
    { name: '', mobile: '' },
    { name: '', mobile: '' },
  ]);

  const steps = [
    { id: 'header-personal', title: 'Personal Details', subtitle: 'Step 1 of 9' },
    { id: 'experience', title: 'Experience', subtitle: 'Step 2 of 9' },
    { id: 'academic', title: 'Academic Details', subtitle: 'Step 3 of 9' },
    { id: 'certifications', title: 'Certifications', subtitle: 'Step 4 of 9' },
    { id: 'awards', title: 'Awards & Achievements', subtitle: 'Step 5 of 9' },
    { id: 'computer', title: 'Computer Skills', subtitle: 'Step 6 of 9' },
    { id: 'languages', title: 'Foreign Languages', subtitle: 'Step 7 of 9' },
    { id: 'references', title: 'Professional References', subtitle: 'Step 8 of 9' },
    { id: 'review', title: 'Review & Submit', subtitle: 'Step 9 of 9' },
  ];

  useEffect(() => {
    const draft = loadDraft() as FormData | null;
    if (draft) {
      setPostAppliedFor(draft.postAppliedFor || '');
      setCode(draft.code || '');
      setNoticePeriodDays(draft.noticePeriodDays || '');
      setTotalExpYears(draft.totalExpYears || '');
      setTotalExpMonths(draft.totalExpMonths || '');
      setTotalExpAsOfMonth(draft.totalExpAsOfMonth || '');
      setTotalExpAsOfYear(draft.totalExpAsOfYear || '');
      setRelevantExpYears(draft.relevantExpYears || '');
      setRelevantExpMonths(draft.relevantExpMonths || '');
      setRelevantExpAsOfMonth(draft.relevantExpAsOfMonth || '');
      setRelevantExpAsOfYear(draft.relevantExpAsOfYear || '');
      setFullName(draft.fullName || '');
      setFatherName(draft.fatherName || '');
      setDob(draft.dob || '');
      setBloodGroup(draft.bloodGroup || '');
      setPhone(draft.phone || '');
      setEmail(draft.email || '');
      setCnicNumber(draft.cnicNumber || '');
      setCnicExpiry(draft.cnicExpiry || '');
      setPassportNumber(draft.passportNumber || '');
      setPassportExpiry(draft.passportExpiry || '');
      setPermanentAddress(draft.permanentAddress || '');
      setEmgName1(draft.emergencyContact1Name || '');
      setEmgRel1(draft.emergencyContact1Relation || '');
      setEmgPhone1(draft.emergencyContact1Phone || '');
      setEmgName2(draft.emergencyContact2Name || '');
      setEmgRel2(draft.emergencyContact2Relation || '');
      setEmgPhone2(draft.emergencyContact2Phone || '');
      setDependantsSpouse(draft.dependantsSpouse ?? 0);
      setDependantsSons(draft.dependantsSons ?? 0);
      setDependantsDaughters(draft.dependantsDaughters ?? 0);
      setDependantsOthers(draft.dependantsOthers ?? 0);
      setAcademicDetails(draft.academicDetails || []);
      setCertifications(draft.certifications || []);
      setAwards(draft.awards || []);
      const migratedExperience = (draft.experience || []).map((exp: Record<string, unknown>) => ({
        ...exp,
        descriptions: (Array.isArray(exp.descriptions)
          ? exp.descriptions
          : exp.description
            ? [exp.description]
            : []) as string[],
      })) as ExperienceRow[];
      setExperience(migratedExperience);
      setComputerSkills(draft.computerSkills || []);
      setForeignLanguages(draft.foreignLanguages || []);
      setReferences(
        draft.references || [
          { name: '', mobile: '' },
          { name: '', mobile: '' },
          { name: '', mobile: '' },
        ]
      );
      setPhotoPreview(draft.photoPreview || null);
      if (draft.photoPreview) {
        const restoredFile = base64ToFile(draft.photoPreview, `photo-${Date.now()}.jpg`);
        if (restoredFile) setPhotoFile(restoredFile);
      }
    }
  }, []);

  useEffect(() => {
    formDataRef.current = {
      postAppliedFor,
      code,
      noticePeriodDays,
      totalExpYears,
      totalExpMonths,
      totalExpAsOfMonth,
      totalExpAsOfYear,
      relevantExpYears,
      relevantExpMonths,
      relevantExpAsOfMonth,
      relevantExpAsOfYear,
      fullName,
      fatherName,
      dob,
      bloodGroup,
      phone,
      email,
      cnicNumber,
      cnicExpiry,
      passportNumber,
      passportExpiry,
      permanentAddress,
      emergencyContact1Name: emgName1,
      emergencyContact1Relation: emgRel1,
      emergencyContact1Phone: emgPhone1,
      emergencyContact2Name: emgName2,
      emergencyContact2Relation: emgRel2,
      emergencyContact2Phone: emgPhone2,
      dependantsSpouse,
      dependantsSons,
      dependantsDaughters,
      dependantsOthers,
      academicDetails,
      certifications,
      awards,
      experience,
      computerSkills,
      foreignLanguages,
      references,
      photoPreview,
    };

    const timer = setTimeout(() => {
      try {
        saveDraft(formDataRef.current as unknown as Record<string, unknown>);
      } catch (e) {
        console.error('Failed to save draft:', e);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [
    postAppliedFor,
    code,
    noticePeriodDays,
    totalExpYears,
    totalExpMonths,
    totalExpAsOfMonth,
    totalExpAsOfYear,
    relevantExpYears,
    relevantExpMonths,
    relevantExpAsOfMonth,
    relevantExpAsOfYear,
    fullName,
    fatherName,
    dob,
    bloodGroup,
    phone,
    email,
    cnicNumber,
    cnicExpiry,
    passportNumber,
    passportExpiry,
    permanentAddress,
    emgName1,
    emgRel1,
    emgPhone1,
    emgName2,
    emgRel2,
    emgPhone2,
    dependantsSpouse,
    dependantsSons,
    dependantsDaughters,
    dependantsOthers,
    academicDetails,
    certifications,
    awards,
    experience,
    computerSkills,
    foreignLanguages,
    references,
    photoPreview,
  ]);

  const validateStep = (step: number): boolean => {
    if (step === 0) {
      if (!fullName.trim()) {
        alert('Please fill your Full Name.');
        return false;
      }
      if (!fatherName.trim()) {
        alert("Please fill Father's Name.");
        return false;
      }
      if (!dob.trim()) {
        alert('Please fill Date of Birth.');
        return false;
      }
      if (!bloodGroup) {
        alert('Please select Blood Group.');
        return false;
      }
      if (!phone.trim()) {
        alert('Please fill Phone Number.');
        return false;
      }
      if (!email.trim()) {
        alert('Please fill Email.');
        return false;
      }
      if (!cnicNumber.trim() || !cnicExpiry.trim()) {
        alert('Please fill CNIC Number and Expiry.');
        return false;
      }
      if (!permanentAddress.trim()) {
        alert('Please fill Permanent Address.');
        return false;
      }
      if (!emgName1.trim() || !emgRel1.trim() || !emgPhone1.trim()) {
        alert('Please fill Emergency Contact 1.');
        return false;
      }
      if (!emgName2.trim() || !emgRel2.trim() || !emgPhone2.trim()) {
        alert('Please fill Emergency Contact 2.');
        return false;
      }
      if (!photoFile) {
        alert('Please upload your photo.');
        return false;
      }
      if (passportNumber.trim() && !passportExpiry.trim()) {
        alert('Please fill Passport Expiry.');
        return false;
      }
      if (passportExpiry.trim() && !passportNumber.trim()) {
        alert('Please fill Passport Number.');
        return false;
      }
    }
    if (step === 1) {
      if (experience.length === 0) {
        alert('Please add at least one experience entry.');
        return false;
      }
      for (let i = 0; i < experience.length; i++) {
        const row = experience[i];
        if (!row.company?.trim() || !row.from?.trim() || !row.to?.trim() || !row.position?.trim()) {
          alert(`Please fill all required fields in Experience entry ${i + 1}.`);
          return false;
        }
        const descs = row.descriptions || [];
        if (descs.length === 0 || !descs[0]?.trim()) {
          alert(`Please fill at least one Job Description in Experience entry ${i + 1}.`);
          return false;
        }
      }
    }
    if (step === 2) {
      if (!validateRepeater(academicDetails, ['degree', 'institution', 'sessionFrom', 'sessionTo'], 'Academic', 1))
        return false;
    }
    if (step === 3) {
      if (!validateRepeaterSilent(certifications, ['name', 'institution', 'year', 'body'])) {
        if (certifications.length > 0) {
          alert('Please fill all fields in Certification entries.');
          return false;
        }
      }
    }
    if (step === 4) {
      if (!validateRepeaterSilent(awards, ['description', 'institution', 'year', 'body'])) {
        if (awards.length > 0) {
          alert('Please fill all fields in Award entries.');
          return false;
        }
      }
    }
    if (step === 5) {
      if (!validateRepeaterSilent(computerSkills, ['name', 'level'])) {
        if (computerSkills.length > 0) {
          alert('Please fill all fields in Computer Skills entries.');
          return false;
        }
      }
    }
    if (step === 6) {
      if (!validateRepeaterSilent(foreignLanguages, ['name', 'reading', 'writing', 'speaking'])) {
        if (foreignLanguages.length > 0) {
          alert('Please fill all fields in Foreign Language entries.');
          return false;
        }
      }
    }
    if (step === 7) {
      if (!validateRepeater(references, ['name', 'mobile'], 'Reference', 3)) return false;
    }
    return true;
  };

  const isStepAccessible = (targetStep: number): boolean => {
    if (targetStep === 0) return true;
    for (let i = 0; i < targetStep; i++) {
      if (!validateStep(i)) return false;
    }
    return true;
  };

  useEffect(() => {
    const lenis = (window as unknown as { lenis?: { scrollTo: (t: number, opts?: unknown) => void } }).lenis;
    if (lenis) {
      lenis.scrollTo(0, { immediate: true });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentStep]);

  const goNext = () => {
    if (currentStep < steps.length - 1) {
      if (validateStep(currentStep)) {
        setCurrentStep(currentStep + 1);
      }
    } else {
      handleSubmit();
    }
  };

  const goPrev = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      compressImageFile(file).then((result) => {
        if (result) {
          setPhotoPreview(result.preview);
          setPhotoFile(result.compressedFile);
        }
      });
    }
  };

  const data: FormData = {
    postAppliedFor,
    code,
    noticePeriodDays,
    totalExpYears,
    totalExpMonths,
    totalExpAsOfMonth,
    totalExpAsOfYear,
    relevantExpYears,
    relevantExpMonths,
    relevantExpAsOfMonth,
    relevantExpAsOfYear,
    fullName,
    fatherName,
    dob,
    bloodGroup,
    phone,
    email,
    cnicNumber,
    cnicExpiry,
    passportNumber,
    passportExpiry,
    permanentAddress,
    emergencyContact1Name: emgName1,
    emergencyContact1Relation: emgRel1,
    emergencyContact1Phone: emgPhone1,
    emergencyContact2Name: emgName2,
    emergencyContact2Relation: emgRel2,
    emergencyContact2Phone: emgPhone2,
    dependantsSpouse,
    dependantsSons,
    dependantsDaughters,
    dependantsOthers,
    academicDetails,
    certifications,
    awards,
    experience,
    computerSkills,
    foreignLanguages,
    references,
    photoPreview,
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const pdfBlob = await generateApplicationPdf(data, photoFile || undefined);
      const pdfName = `CV_${fullName.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
      const base64Pdf = await blobToBase64(pdfBlob);

      const response = await fetch('/api/cv-generator/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          candidateName: fullName || 'Unknown Candidate',
          candidateEmail: email,
          pdfBase64: base64Pdf,
          fileName: pdfName,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send CV');
      }

      const result = await response.json();
      downloadPdf(pdfBlob, pdfName);
      alert(`CV sent successfully to ${result.sentCount} recipient(s).`);
      clearDraft();
      setIsSubmitted(true);
    } catch (error) {
      console.error(error);
      alert('Failed to generate/send CV. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepIndicators = () => (
    <div className="cv-generator-steps">
      {steps.map((step, idx) => {
        const isActive = currentStep === idx;
        const isCompleted = idx < currentStep;
        const isAccessible = isStepAccessible(idx);
        const isClickable = isAccessible || isCompleted;

        return (
          <button
            key={step.id}
            type="button"
            onClick={() => {
              if (isClickable) setCurrentStep(idx);
            }}
            disabled={!isClickable}
            className={`cv-generator-step ${isActive ? 'cv-generator-step-active' : ''} ${isCompleted ? 'cv-generator-step-completed' : ''} ${!isAccessible ? 'cv-generator-step-inactive' : ''}`}
          >
            {isCompleted ? (
              <Check className="w-3 h-3 mx-auto" />
            ) : (
              <span className="cv-generator-step-label">{idx + 1}</span>
            )}
            <span className="cv-generator-step-name">{step.title}</span>
          </button>
        );
      })}
    </div>
  );

  const renderJobInformationStep = () => (
    <div className="cv-step-card">
      <div className="cv-step-card-header">
        <h3 className="cv-step-card-title">
          <span>Step 1</span> Job Information & Personal Details
        </h3>
        <span className="cv-step-card-subtitle">{steps[0].subtitle}</span>
      </div>
      <div className="cv-step-form">
        <div className="cv-form-grid">
          <CVInput
            label="Post Applied For"
            value={postAppliedFor}
            onChange={(e) => setPostAppliedFor(e.target.value)}
            placeholder="e.g. Maintenance Engineer"
            name="postAppliedFor"
            required
          />
          <CVInput
            label="Code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. PME-JAD-002"
            name="code"
          />
        </div>

        <CVInput
          label="Notice Period (Days)"
          value={noticePeriodDays}
          onChange={(e) => setNoticePeriodDays(e.target.value)}
          placeholder="e.g. 30"
          name="noticePeriodDays"
          type="number"
        />

        <div className="cv-form-grid-md">
          <CVInput
            label="Full Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Full Name"
            name="fullName"
            required
          />
          <CVInput
            label="Father's Name"
            value={fatherName}
            onChange={(e) => setFatherName(e.target.value)}
            placeholder="Father's Name"
            name="fatherName"
            required
          />
        </div>

        <div className="cv-form-grid-md">
          <CVInput
            label="Date of Birth"
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            name="dob"
            required
          />
          <div>
            <label className="cv-input-label-sub">Blood Group</label>
            <select
              name="bloodGroup"
              value={bloodGroup}
              onChange={(e) => setBloodGroup(e.target.value)}
              className="cv-select"
              required
            >
              <option value="" className="bg-slate-900 text-white">
                Select
              </option>
              {BLOOD_GROUPS.map((bg) => (
                <option key={bg} value={bg} className="bg-slate-900 text-white">
                  {bg}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="cv-form-grid-md">
          <CVInput
            label="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+92 300 1234567"
            name="phone"
            required
          />
          <CVInput
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="example@harisco.com"
            name="email"
            required
          />
        </div>

        <div className="cv-form-grid-md">
          <CVInput
            label="Total Experience"
            placeholder="Years"
            type="number"
            value={totalExpYears}
            onChange={(e) => setTotalExpYears(e.target.value)}
            name="totalExpYears"
            compact
          />
          <CVInput
            label="Months"
            placeholder="Months"
            type="number"
            min={0}
            max={12}
            value={totalExpMonths}
            onChange={(e) => setTotalExpMonths(e.target.value)}
            name="totalExpMonths"
            compact
          />
        </div>

        <div className="cv-form-grid-md">
          <div>
            <label className="cv-input-label-sub">As Of Month</label>
            <select
              name="totalExpAsOfMonth"
              value={totalExpAsOfMonth}
              onChange={(e) => setTotalExpAsOfMonth(e.target.value)}
              className="cv-select"
            >
              <option value="" className="bg-slate-900 text-white">
                Month
              </option>
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value} className="bg-slate-900 text-white">
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="cv-input-label-sub">As Of Year</label>
            <select
              name="totalExpAsOfYear"
              value={totalExpAsOfYear}
              onChange={(e) => setTotalExpAsOfYear(e.target.value)}
              className="cv-select"
            >
              <option value="" className="bg-slate-900 text-white">
                Year
              </option>
              {YEARS.map((year) => (
                <option key={year} value={String(year)} className="bg-slate-900 text-white">
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="cv-form-grid-md">
          <CVInput
            label="Relevant Experience"
            placeholder="Years"
            type="number"
            value={relevantExpYears}
            onChange={(e) => setRelevantExpYears(e.target.value)}
            name="relevantExpYears"
            compact
          />
          <CVInput
            label="Months"
            placeholder="Months"
            type="number"
            min={0}
            max={12}
            value={relevantExpMonths}
            onChange={(e) => setRelevantExpMonths(e.target.value)}
            name="relevantExpMonths"
            compact
          />
        </div>

        <div className="cv-form-grid-md">
          <div>
            <label className="cv-input-label-sub">As Of Month</label>
            <select
              name="relevantExpAsOfMonth"
              value={relevantExpAsOfMonth}
              onChange={(e) => setRelevantExpAsOfMonth(e.target.value)}
              className="cv-select"
            >
              <option value="" className="bg-slate-900 text-white">
                Month
              </option>
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value} className="bg-slate-900 text-white">
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="cv-input-label-sub">As Of Year</label>
            <select
              name="relevantExpAsOfYear"
              value={relevantExpAsOfYear}
              onChange={(e) => setRelevantExpAsOfYear(e.target.value)}
              className="cv-select"
            >
              <option value="" className="bg-slate-900 text-white">
                Year
              </option>
              {YEARS.map((year) => (
                <option key={year} value={String(year)} className="bg-slate-900 text-white">
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="cv-form-grid-md">
          <CVInput
            label="CNIC Number"
            value={cnicNumber}
            onChange={(e) => setCnicNumber(formatCNIC(e.target.value))}
            placeholder="XXXXX-XXXXXXX-X"
            name="cnicNumber"
            required
          />
          <CVInput
            label="CNIC Expiry"
            type="date"
            value={cnicExpiry}
            onChange={(e) => setCnicExpiry(e.target.value)}
            name="cnicExpiry"
            required
          />
        </div>

        <div className="cv-form-grid-md">
          <CVInput
            label="Passport Number"
            value={passportNumber}
            onChange={(e) => setPassportNumber(e.target.value)}
            placeholder="Passport Number"
            name="passportNumber"
          />
          <CVInput
            label="Passport Expiry"
            type="date"
            value={passportExpiry}
            onChange={(e) => setPassportExpiry(e.target.value)}
            name="passportExpiry"
          />
        </div>

        <CVInput
          label="Permanent Address"
          isTextArea
          value={permanentAddress}
          onChange={(e) => setPermanentAddress(e.target.value)}
          placeholder="Full permanent address"
          name="permanentAddress"
          required
        />

        <div className="cv-form-grid-md">
          <CVInput
            label="Emergency Contact 1 Name"
            value={emgName1}
            onChange={(e) => setEmgName1(e.target.value)}
            placeholder="Full Name"
            name="emgName1"
            required
          />
          <CVInput
            label="Relation"
            value={emgRel1}
            onChange={(e) => setEmgRel1(e.target.value)}
            placeholder="e.g. Brother"
            name="emgRel1"
            required
          />
        </div>

        <div className="cv-form-grid-md">
          <CVInput
            label="Emergency Contact 1 Phone"
            value={emgPhone1}
            onChange={(e) => setEmgPhone1(e.target.value)}
            placeholder="+92 ..."
            name="emgPhone1"
            required
          />
          <CVInput
            label="Emergency Contact 2 Name"
            value={emgName2}
            onChange={(e) => setEmgName2(e.target.value)}
            placeholder="Full Name"
            name="emgName2"
            required
          />
        </div>

        <div className="cv-form-grid-md">
          <CVInput
            label="Emergency Contact 2 Relation"
            value={emgRel2}
            onChange={(e) => setEmgRel2(e.target.value)}
            placeholder="e.g. Sister"
            name="emgRel2"
            required
          />
          <CVInput
            label="Emergency Contact 2 Phone"
            value={emgPhone2}
            onChange={(e) => setEmgPhone2(e.target.value)}
            placeholder="+92 ..."
            name="emgPhone2"
            required
          />
        </div>

        <div className="cv-form-grid-md">
          <CVNumberInput label="Dependants - Spouse" value={dependantsSpouse} onChange={setDependantsSpouse} />
          <CVNumberInput label="Sons" value={dependantsSons} onChange={setDependantsSons} />
          <CVNumberInput label="Daughters" value={dependantsDaughters} onChange={setDependantsDaughters} />
          <CVNumberInput label="Others" value={dependantsOthers} onChange={setDependantsOthers} />
        </div>

        <div>
          <label className="cv-input-label-sub">Photo</label>
          <div className="cv-photo-upload">
            <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" id="photo-upload" />
            <label htmlFor="photo-upload" className="cv-photo-placeholder cursor-pointer">
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="Photo preview"
                  className="cv-photo-preview object-cover w-full h-full rounded"
                />
              ) : (
                <>
                  <Upload className="w-6 h-6" />
                  <span className="cv-photo-label">Click to upload photo</span>
                </>
              )}
            </label>
            {photoPreview && (
              <button
                type="button"
                onClick={() => {
                  setPhotoPreview(null);
                  setPhotoFile(null);
                }}
                className="cv-btn cv-btn-danger cv-btn-sm"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderExperienceStep = () => (
    <div className="cv-step-card">
      <div className="cv-step-card-header">
        <h3 className="cv-step-card-title">
          <span>Step 2</span> Professional Experience
        </h3>
        <span className="cv-step-card-subtitle">{steps[1].subtitle}</span>
      </div>
      <p className="cv-repeater-info">Put latest job first</p>
      <div className="space-y-4">
        {experience.map((row, index) => (
          <div key={index} className="cv-repeater-row">
            <div className="cv-repeater-row-header">
              <span className="cv-repeater-entry-label">Entry {index + 1}</span>
              <button
                type="button"
                onClick={() => setExperience(experience.filter((_, i) => i !== index))}
                disabled={experience.length <= 0}
                className="cv-btn cv-btn-danger"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div className="cv-repeater-grid">
              <div className="md:col-span-4">
                <CVInput
                  label="Company Name"
                  value={row.company || ''}
                  onChange={(e) => {
                    const updated = [...experience];
                    updated[index] = { ...updated[index], company: e.target.value };
                    setExperience(updated);
                  }}
                />
              </div>
              <div className="md:col-span-2">
                <CVInput
                  label="From"
                  type="date"
                  value={row.from || ''}
                  onChange={(e) => {
                    const updated = [...experience];
                    updated[index] = { ...updated[index], from: e.target.value };
                    setExperience(updated);
                  }}
                  className="pr-2"
                />
              </div>
              <div className="md:col-span-2">
                <CVInput
                  label="To"
                  type="date"
                  value={row.to || ''}
                  onChange={(e) => {
                    const updated = [...experience];
                    updated[index] = { ...updated[index], to: e.target.value };
                    setExperience(updated);
                  }}
                  className="pr-2"
                />
              </div>
              <div className="md:col-span-4">
                <CVInput
                  label="Position"
                  value={row.position || ''}
                  onChange={(e) => {
                    const updated = [...experience];
                    updated[index] = { ...updated[index], position: e.target.value };
                    setExperience(updated);
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="cv-input-label-default">Job Descriptions</label>
              {(Array.isArray(row.descriptions) ? row.descriptions : []).map((desc, descIndex) => (
                <div key={descIndex} className="flex gap-2 items-start">
                  <span className="cv-desc-counter">{descIndex + 1}.</span>
                  <div className="flex-1">
                    <CVInput
                      label=""
                      value={desc}
                      onChange={(e) => {
                        const updated = [...experience];
                        const descs = [...(updated[index].descriptions || [])];
                        descs[descIndex] = e.target.value;
                        updated[index] = { ...updated[index], descriptions: descs };
                        setExperience(updated);
                      }}
                      placeholder="Job Description"
                      subLabel
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const updated = [...experience];
                      const descs = (updated[index].descriptions || []).filter((_, j) => j !== descIndex);
                      updated[index] = { ...updated[index], descriptions: descs };
                      setExperience(updated);
                    }}
                    className="cv-btn cv-btn-danger"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  const updated = [...experience];
                  const descs = updated[index].descriptions || [];
                  if (descs.length < 10) {
                    updated[index] = {
                      ...updated[index],
                      descriptions: [...descs, ''],
                    };
                    setExperience(updated);
                  }
                }}
                className="cv-btn cv-btn-secondary cv-btn-sm gap-1"
              >
                <Plus className="w-4 h-4" />
                <span className="cv-btn-text">Add Job Description</span>
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => {
            if (experience.length < 10) {
              setExperience([...experience, { company: '', from: '', to: '', position: '', descriptions: [''] }]);
            }
          }}
          disabled={experience.length >= 10}
          className="cv-btn cv-btn-secondary gap-2"
        >
          <Plus className="w-4 h-4" />
          <span className="cv-btn-text">Add Entry</span>
        </button>
      </div>
    </div>
  );

  const renderAcademicStep = () => (
    <div className="cv-step-card">
      <div className="cv-step-card-header">
        <h3 className="cv-step-card-title">
          <span>Step 3</span> Academic Details
        </h3>
        <span className="cv-step-card-subtitle">{steps[2].subtitle}</span>
      </div>
      <RepeaterSection
        title="Academic Details"
        rows={academicDetails}
        setRows={setAcademicDetails}
        maxEntries={10}
        minEntries={1}
        fields={['degree', 'institution', 'sessionFrom', 'sessionTo']}
        labels={{
          degree: 'Degree/Certificate',
          institution: 'Institution',
          sessionFrom: 'Session From',
          sessionTo: 'Session To',
        }}
        hasDate={['sessionFrom', 'sessionTo']}
        gridCols={{
          degree: 'md:col-span-5',
          institution: 'md:col-span-4',
          sessionFrom: 'md:col-span-2',
          sessionTo: 'md:col-span-2',
        }}
      />
    </div>
  );

  const renderCertificationsStep = () => (
    <div className="cv-step-card">
      <div className="cv-step-card-header">
        <h3 className="cv-step-card-title">
          <span>Step 4</span> Certifications
        </h3>
        <span className="cv-step-card-subtitle">{steps[3].subtitle}</span>
      </div>
      <RepeaterSection
        title="Certifications"
        rows={certifications}
        setRows={setCertifications}
        maxEntries={10}
        fields={['name', 'institution', 'year', 'body']}
        labels={{ name: 'Name', institution: 'Institution', year: 'Year', body: 'Body' }}
        gridCols={{
          name: 'md:col-span-4',
          institution: 'md:col-span-4',
          year: 'md:col-span-1',
          body: 'md:col-span-3',
        }}
      />
    </div>
  );

  const renderAwardsStep = () => (
    <div className="cv-step-card">
      <div className="cv-step-card-header">
        <h3 className="cv-step-card-title">
          <span>Step 5</span> Awards & Achievements
        </h3>
        <span className="cv-step-card-subtitle">{steps[4].subtitle}</span>
      </div>
      <RepeaterSection
        title="Awards & Achievements"
        rows={awards}
        setRows={setAwards}
        maxEntries={10}
        fields={['description', 'institution', 'year', 'body']}
        labels={{ description: 'Description', institution: 'Institution', year: 'Year', body: 'Body' }}
        gridCols={{
          description: 'md:col-span-4',
          institution: 'md:col-span-4',
          year: 'md:col-span-1',
          body: 'md:col-span-3',
        }}
      />
    </div>
  );

  const renderComputerSkillsStep = () => (
    <div className="cv-step-card">
      <div className="cv-step-card-header">
        <h3 className="cv-step-card-title">
          <span>Step 6</span> Computer Skills
        </h3>
        <span className="cv-step-card-subtitle">{steps[5].subtitle}</span>
      </div>
      <RepeaterSection
        title="Computer Literacy Level"
        rows={computerSkills}
        setRows={setComputerSkills}
        maxEntries={10}
        fields={['name', 'level']}
        labels={{ name: 'Skill Name', level: 'Skill Level' }}
        hasSelect={{ level: SKILL_LEVELS }}
        gridCols={{ name: 'md:col-span-7', level: 'md:col-span-5' }}
      />
    </div>
  );

  const renderLanguagesStep = () => (
    <div className="cv-step-card">
      <div className="cv-step-card-header">
        <h3 className="cv-step-card-title">
          <span>Step 7</span> Foreign Languages
        </h3>
        <span className="cv-step-card-subtitle">{steps[6].subtitle}</span>
      </div>
      <RepeaterSection
        title="Foreign Languages Skill"
        rows={foreignLanguages}
        setRows={setForeignLanguages}
        maxEntries={10}
        fields={['name', 'reading', 'writing', 'speaking']}
        labels={{ name: 'Language', reading: 'Reading', writing: 'Writing', speaking: 'Speaking' }}
        hasSelect={{
          name: [
            'English',
            'Urdu',
            'Arabic',
            'Hindi',
            'French',
            'German',
            'Spanish',
            'Chinese',
            'Japanese',
            'Korean',
            'Persian',
            'Turkish',
            'Bengali',
            'Punjabi',
            'Pashto',
            'Sindhi',
            'Balochi',
            'Other',
          ],
          reading: LANGUAGE_PROFICIENCY,
          writing: LANGUAGE_PROFICIENCY,
          speaking: LANGUAGE_PROFICIENCY,
        }}
        gridCols={{
          name: 'md:col-span-3',
          reading: 'md:col-span-3',
          writing: 'md:col-span-3',
          speaking: 'md:col-span-3',
        }}
      />
    </div>
  );

  const renderReferencesStep = () => (
    <div className="cv-step-card">
      <div className="cv-step-card-header">
        <h3 className="cv-step-card-title">
          <span>Step 8</span> Professional References
        </h3>
        <span className="cv-step-card-subtitle">{steps[7].subtitle}</span>
      </div>
      <p className="cv-repeater-info">Please provide three professional references</p>
      <div className="cv-repeater-grid">
        {references.map((ref, index) => (
          <div key={index} className="md:col-span-4">
            <div className="cv-repeater-row">
              <div className="cv-repeater-row-header">
                <span className="cv-repeater-entry-label">Reference {index + 1}</span>
              </div>
              <CVInput
                label="Reference Name"
                value={ref.name || ''}
                onChange={(e) =>
                  setReferences((prev) => prev.map((r, i) => (i === index ? { ...r, name: e.target.value } : r)))
                }
                placeholder="Full Name"
                required
              />
              <CVInput
                label="Mobile Number"
                type="tel"
                value={ref.mobile || ''}
                onChange={(e) =>
                  setReferences((prev) => prev.map((r, i) => (i === index ? { ...r, mobile: e.target.value } : r)))
                }
                placeholder="+92 ..."
                required
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (isSubmitted) {
    return (
      <div className="cv-generator-container">
        <div className="cv-generator-success">
          <div className="cv-generator-success-icon">
            <Check className="w-16 h-16 text-green-500 mx-auto" />
          </div>
          <h2 className="cv-generator-success-title">CV Generated &amp; Sent</h2>
          <p className="cv-generator-success-message">
            Your CV PDF has been generated and sent to all IT users. A copy has also been downloaded to your device.
          </p>
          <button
            onClick={() => {
              clearDraft();
              window.location.reload();
            }}
            className="cv-btn cv-btn-primary"
          >
            Generate Another CV
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="cv-generator-container">
      <div className="cv-generator-header">
        <h1 className="cv-generator-title">CV Generator</h1>
      </div>

      {renderStepIndicators()}

      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          {currentStep === 0 && renderJobInformationStep()}
          {currentStep === 1 && renderExperienceStep()}
          {currentStep === 2 && renderAcademicStep()}
          {currentStep === 3 && renderCertificationsStep()}
          {currentStep === 4 && renderAwardsStep()}
          {currentStep === 5 && renderComputerSkillsStep()}
          {currentStep === 6 && renderLanguagesStep()}
          {currentStep === 7 && renderReferencesStep()}
          {currentStep === steps.length - 1 && (
            <CVReviewSummary
              data={data}
              onNavigateStep={setCurrentStep}
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {currentStep !== steps.length - 1 && (
        <div className="cv-form-actions">
          <button onClick={goPrev} disabled={currentStep === 0} className="cv-btn cv-btn-secondary">
            <ArrowLeft className="w-4 h-4" />
            Previous
          </button>
          <button onClick={goNext} className="cv-btn cv-btn-primary">
            Next
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
