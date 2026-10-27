import type { CodeItem } from './types';

export const DOC_PREFIX = 'HC';

export const REVISION_OPTIONS = ['Rev 00', 'Rev 01', 'Rev 02', 'Rev 03', 'Rev 04', 'Rev A', 'Rev B', 'Rev C'];

export const ENTITIES: CodeItem[] = [
  { code: '01', name: 'Head Office', description: 'Principal Corporate Headquarters' },
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
  { code: 'LE', name: 'Letter', category: 'Correspondence' },
  { code: 'ME', name: 'Memo', category: 'Correspondence' },
  { code: 'FX', name: 'Fax', category: 'Correspondence' },
  { code: 'TR', name: 'Transmittal', category: 'Correspondence' },
  { code: 'EM', name: 'Emails', category: 'Correspondence' },
  { code: 'NF', name: 'Information', category: 'Correspondence' },

  { code: 'CS', name: 'Calculation Sheet', category: 'Engineering' },
  { code: 'DB', name: 'Design Basis', category: 'Engineering' },
  { code: 'DR', name: 'Drawings', category: 'Engineering' },
  { code: 'DS', name: 'Data Sheets', category: 'Engineering' },
  { code: 'EL', name: 'Equipment List', category: 'Engineering' },
  { code: 'LI', name: 'Line List', category: 'Engineering' },
  { code: 'FC', name: 'Field Change Sheet', category: 'Engineering' },
  { code: 'SP', name: 'Specifications / Procedures', category: 'Engineering' },
  { code: 'ST', name: 'Standard Tables', category: 'Engineering' },

  { code: 'BQ', name: 'Bill of Material (Quantity)', category: 'Commercial' },
  { code: 'BU', name: 'Budgets', category: 'Commercial' },
  { code: 'CE', name: 'Cost Estimation', category: 'Commercial' },
  { code: 'CO', name: 'Change Order', category: 'Commercial' },
  { code: 'NV', name: 'Invoices', category: 'Commercial' },
  { code: 'PO', name: 'Purchase Orders', category: 'Commercial' },
  { code: 'PP', name: 'Proposal', category: 'Commercial' },
  { code: 'RQ', name: 'Requisitions', category: 'Commercial' },
  { code: 'TD', name: 'Tender Documents', category: 'Commercial' },
  { code: 'WE', name: 'Work Estimates', category: 'Commercial' },

  { code: 'TP', name: 'Inspection and Test Plans', category: 'Quality & HSE' },
  { code: 'OM', name: 'Operation Manual', category: 'Quality & HSE' },
  { code: 'PR', name: 'Progress Reports / Write Ups', category: 'Quality & HSE' },
  { code: 'RP', name: 'Reports', category: 'Quality & HSE' },
  { code: 'PL', name: 'Plan', category: 'Quality & HSE' },
  { code: 'SC', name: 'Schedules / Planning /', category: 'Quality & HSE' },

  { code: 'AL', name: 'List of Accessory', category: 'Maintenance & Lists' },
  { code: 'DC', name: 'Document Control Lists', category: 'Maintenance & Lists' },
  { code: 'SL', name: 'Spare Parts List', category: 'Maintenance & Lists' },
  { code: 'TL', name: 'Tool List', category: 'Maintenance & Lists' },
  { code: 'TM', name: 'Standard Templates', category: 'Maintenance & Lists' },
  { code: 'LM', name: 'List (Miscellaneous)', category: 'Maintenance & Lists' },
  { code: 'LL', name: 'Lubrication List', category: 'Maintenance & Lists' },
];

export const TRANSMITTAL_PURPOSES = [
  'For Information',
  'For Review & Approval',
  'For Construction',
  'As-Built',
  'For Tender / Pricing',
];
