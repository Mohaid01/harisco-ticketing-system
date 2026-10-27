import ExcelJS from 'exceljs';

interface GenerateExcelParams {
  documentId: string;
  revision: string;
  entityCode: string;
  departmentCode: string;
  docTypeCode: string;
  docDate: string;
  title: string;
  content: { title: string; description: string };
  preparedByName?: string;
  checkedByName?: string;
  approvedByName?: string;
}

const boldStyle = { bold: true } as const;
const thinBorder = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' },
} as const;

/**
 * Generates an Excel (.xlsx) with the requested layout:
 * Row 1: CONFIDENTIAL & PROPRIETARY — HARIS & CO. ALL RIGHTS RESERVED.
 * Document Details section: Doc No. | Doc Title | Doc Description
 * Sequence No.: just the 4-digit sequence number (e.g. 0001)
 * Revision Table: Revision | Date | Prepared By | Checked By | Approved By
 */
export const generateDocumentExcel = async ({
  documentId,
  revision,
  docDate,
  title,
  content,
  preparedByName = '',
  checkedByName = '',
  approvedByName = '',
}: GenerateExcelParams): Promise<Uint8Array> => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Controlled Document');

  // Row 1: CONFIDENTIAL header (top)
  sheet.mergeCells('A1:E1');
  const r1c1 = sheet.getCell('A1');
  r1c1.value = 'CONFIDENTIAL & PROPRIETARY — HARIS & CO. ALL RIGHTS RESERVED.';
  r1c1.font = { italic: true, size: 8, color: { argb: 'FF64748B' } };
  r1c1.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = 18;

  // Empty spacer row
  sheet.getRow(2).height = 10;

  // Document Details section header (bold headings only)
  const detailsHeaderRow = sheet.getRow(4);
  const detailsHeaders = ['Document No.', 'Document Title', 'Document Description', 'Sequence No.'];
  detailsHeaders.forEach((h, i) => {
    const cell = detailsHeaderRow.getCell(i + 1);
    cell.value = h;
    cell.font = boldStyle;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2BB13' } };
    cell.border = thinBorder;
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  detailsHeaderRow.height = 20;

  // Document Details data row
  const detailsDataRow = sheet.getRow(5);
  const seqNum = revision.match(/\d+/) ? revision.replace(/\D/g, '').padStart(4, '0') : '0001';
  const detailsData = [documentId, title, content.description || '', seqNum];
  detailsData.forEach((val, i) => {
    const cell = detailsDataRow.getCell(i + 1);
    cell.value = val;
    cell.border = thinBorder;
    cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
  });
  detailsDataRow.height = 30;

  // Empty spacer row
  sheet.getRow(6).height = 10;

  // Revision Table header (bold headings only)
  const revHeaderRow = sheet.getRow(7);
  const revHeaders = ['Revision', 'Date', 'Prepared By', 'Checked By', 'Approved By'];
  revHeaders.forEach((h, i) => {
    const cell = revHeaderRow.getCell(i + 1);
    cell.value = h;
    cell.font = boldStyle;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2BB13' } };
    cell.border = thinBorder;
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  revHeaderRow.height = 20;

  // Revision Table data row
  const revDataRow = sheet.getRow(8);
  const revData = [revision, docDate, preparedByName, checkedByName || '', approvedByName || ''];
  revData.forEach((val, i) => {
    const cell = revDataRow.getCell(i + 1);
    cell.value = val;
    cell.border = thinBorder;
    cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
  });
  revDataRow.height = 20;

  // Column widths
  sheet.getColumn('A').width = 24;
  sheet.getColumn('B').width = 40;
  sheet.getColumn('C').width = 40;
  sheet.getColumn('D').width = 24;
  sheet.getColumn('E').width = 24;

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as unknown as Uint8Array;
};

export const downloadExcelBlob = (buffer: Uint8Array, fileName: string) => {
  const blob = new Blob([buffer as any], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileName}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
