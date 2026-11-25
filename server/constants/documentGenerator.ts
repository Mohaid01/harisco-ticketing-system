export interface CodeItem {
  code: string;
  name: string;
  description?: string;
}

export const ENTITIES: CodeItem[] = [
  { code: '01', name: 'Head Office', description: 'Principal Executive Office' },
  { code: '02', name: 'Manufacturing Shop', description: 'Fabrication & Production Facility' },
  { code: '03', name: 'Haris & Co Saudia', description: 'Saudi Arabia Branch / Operations' },
  { code: '04', name: 'Haris Engineering Saudia', description: 'Engineering Services KSA' },
  { code: '05', name: 'Haris IT Company', description: 'Technology & Digital Solutions' },
  { code: '06', name: 'XYZ', description: 'Reserved Entity' },
  { code: '07', name: 'ABD', description: 'Reserved Entity' },
  { code: '08', name: 'GHT', description: 'Reserved Entity' },
];

export const DEPARTMENTS: CodeItem[] = [
  { code: 'COR', name: 'Corporate' },
  { code: 'ADM', name: 'Administration' },
  { code: 'HRC', name: 'Human Resource Capital' },
  { code: 'BDV', name: 'Business Development' },
  { code: 'HSE', name: 'Health, Safety and Environment' },
  { code: 'QUA', name: 'Quality Assurance' },
  { code: 'QUC', name: 'Quality Control' },
  { code: 'PMT', name: 'Project Management' },
  { code: 'CAS', name: 'Commissioning and After Sales' },
  { code: 'WRH', name: 'Warehouse' },
  { code: 'CSL', name: 'Commercial, Shipment, Logitics' },
  { code: 'ACF', name: 'Accounts & Finance' },
  { code: 'IAU', name: 'Internal Audit' },
  { code: 'IMS', name: 'Integration Management System' },
  { code: 'PRP', name: 'Proposal' },
  { code: 'PRC', name: 'Procurement' },
  { code: 'ENG', name: 'Engineering' },
  { code: 'PLN', name: 'Planning' },
];

export const DOCUMENT_TYPES: CodeItem[] = [
  { code: 'LE', name: 'Letter' },
  { code: 'ME', name: 'Memo' },
  { code: 'FX', name: 'Fax' },
  { code: 'TR', name: 'Transmittal' },
  { code: 'EM', name: 'Emails' },
  { code: 'AL', name: 'List of Accessory' },
  { code: 'BQ', name: 'Bill of Material (Quantity)' },
  { code: 'BU', name: 'Budgets' },
  { code: 'CE', name: 'Cost Estimation' },
  { code: 'CO', name: 'Change Order' },
  { code: 'CS', name: 'Calculation Sheet' },
  { code: 'DB', name: 'Design Basis' },
  { code: 'DC', name: 'Document Control Lists' },
  { code: 'DR', name: 'Drawings' },
  { code: 'DS', name: 'Data Sheets' },
  { code: 'EL', name: 'Equipment List' },
  { code: 'FC', name: 'Field Change Sheet' },
  { code: 'NF', name: 'Information' },
  { code: 'NV', name: 'Invoices' },
  { code: 'LI', name: 'Line List' },
  { code: 'TP', name: 'Inspection and Test Plans' },
  { code: 'WE', name: 'Work Estimates' },
  { code: 'OM', name: 'Operation Manual' },
  { code: 'PL', name: 'Plan' },
  { code: 'PO', name: 'Purchase Orders' },
  { code: 'PP', name: 'Proposal' },
  { code: 'PR', name: 'Progress Reports / Write Ups' },
  { code: 'RP', name: 'Reports' },
  { code: 'RQ', name: 'Requisitions' },
  { code: 'SC', name: 'Schedules / Planning /' },
  { code: 'SL', name: 'Spare Parts List' },
  { code: 'SP', name: 'Specifications / Procedures' },
  { code: 'ST', name: 'Standard Tables' },
  { code: 'TD', name: 'Tender Documents' },
  { code: 'TL', name: 'Tool List' },
  { code: 'TM', name: 'Standard Templates' },
  { code: 'LM', name: 'List (Miscellaneous)' },
  { code: 'LL', name: 'Lubrication List' },
];

export const DOC_PREFIX = 'HC';
