import type { AppUser } from '../../types';

export interface CodeItem {
  code: string;
  name: string;
  description?: string;
  category?: string;
}

export interface DocumentGeneratorProps {
  currentUser: AppUser;
  token: string;
  allUsers: AppUser[];
}

export interface DocumentSignOff {
  preparedByName: string;
  checkedByName: string;
  approvedByName: string;
}

/**
 * Single controlled content shared by all 38 document types.
 * Phase 1: exactly two input fields — Document Title / Subject and Document Description.
 */
export interface ControlledDocumentData {
  title: string;
  description: string;
}

export interface GeneratedDocumentRecord {
  id: string;
  document_id: string;
  entity_code: string;
  department_code: string;
  doc_type_code: string;
  year: string;
  sequence_number: number;
  revision: string;
  title: string;
  prepared_by_id: string;
  prepared_by_name: string;
  checked_by_name: string | null;
  approved_by_name: string | null;
  doc_date: string;
  content_json: string | null;
  file_name: string;
  created_at: string;
  updated_at: string;
}
