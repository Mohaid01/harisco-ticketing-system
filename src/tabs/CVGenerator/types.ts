export interface RepeaterRow {
  [key: string]: string;
}

export interface ExperienceRow {
  company: string;
  from: string;
  to: string;
  position: string;
  descriptions: string[];
  [key: string]: string | string[];
}

export interface FormData {
  postAppliedFor: string;
  code: string;
  noticePeriodDays: string;
  totalExpYears: string;
  totalExpMonths: string;
  totalExpAsOfMonth: string;
  totalExpAsOfYear: string;
  relevantExpYears: string;
  relevantExpMonths: string;
  relevantExpAsOfMonth: string;
  relevantExpAsOfYear: string;
  fullName: string;
  fatherName: string;
  dob: string;
  bloodGroup: string;
  phone: string;
  email: string;
  cnicNumber: string;
  cnicExpiry: string;
  passportNumber: string;
  passportExpiry: string;
  permanentAddress: string;
  emergencyContact1Name: string;
  emergencyContact1Relation: string;
  emergencyContact1Phone: string;
  emergencyContact2Name: string;
  emergencyContact2Relation: string;
  emergencyContact2Phone: string;
  dependantsSpouse: number;
  dependantsSons: number;
  dependantsDaughters: number;
  dependantsOthers: number;
  academicDetails: RepeaterRow[];
  certifications: RepeaterRow[];
  awards: RepeaterRow[];
  experience: ExperienceRow[];
  computerSkills: RepeaterRow[];
  foreignLanguages: RepeaterRow[];
  references: RepeaterRow[];
  photoPreview: string | null;
}

export interface CVGeneratorProps {
  currentUser: { id: string; name: string; email?: string; role: string };
  token: string;
}
