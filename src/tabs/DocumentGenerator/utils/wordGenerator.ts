import JSZip from 'jszip';

import type { DocumentSignOff } from '../types';

interface DocumentVersion {
  id: string;
  document_id: string;
  revision: string;
  file_name: string;
  file_path: string;
  file_size: number;
  uploaded_by: string;
  uploaded_at: string;
  note: string | null;
}

interface GenerateWordParams {
  documentId: string;
  revision: string;
  entityCode: string;
  departmentCode: string;
  docTypeCode: string;
  docDate: string;
  title: string;
  content: { title: string; description: string };
  appendixNumber: string;
  formNumber: string;
  signOff: DocumentSignOff;
  versions: DocumentVersion[];
}

const COMPANY_NAME = 'HARIS & Co Engineering Concern Pvt Ltd.';

const getInitials = (name: string): string => {
  if (!name) return '';
  return name
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
};

const formatDateDDMMYYYY = (isoDate: string): string => {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return isoDate;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

export const generateDocumentWord = async (params: GenerateWordParams): Promise<Uint8Array> => {
  const { revision, appendixNumber, formNumber, content, signOff, versions } = params;

  const HARISCO_LOGO_URL = new URL('../assets/harisco-logo.png', import.meta.url).href;

  const latestVersion = versions.length > 0 ? versions[versions.length - 1] : null;

  const values: Record<string, string> = {
    '{COMPANY_NAME}': COMPANY_NAME,
    '{DOCUMENT_TITLE}': content.title,
    '{DocumentTitle}': content.title,
    '{documentTitle}': content.title,
    '{TITLE}': content.title,
    '{title}': content.title,
    '{DESCRIPTION}': content.description,
    '{Description}': content.description,
    '{description}': content.description,
    '{DOCUMENT DESCRIPTION}': content.description,
    '{APPENDIX}': appendixNumber,
    '{Appendix}': appendixNumber,
    '{appendix}': appendixNumber,
    '{DOC_NUMBER}': formNumber,
    '{DocNumber}': formNumber,
    '{docNumber}': formNumber,
    '{FORM_NUMBER}': formNumber,
    '{Document Number}': formNumber,
    '{REVISION}': revision,
    '{Revision}': revision,
    '{revision}': revision,
    '{DOCUMENT_ID}': params.documentId,
    '{DocumentId}': params.documentId,
    '{documentId}': params.documentId,
    '{ENTITY}': params.entityCode,
    '{Entity}': params.entityCode,
    '{entity}': params.entityCode,
    '{DEPARTMENT}': params.departmentCode,
    '{Department}': params.departmentCode,
    '{department}': params.departmentCode,
    '{DOC_TYPE}': params.docTypeCode,
    '{DocType}': params.docTypeCode,
    '{docType}': params.docTypeCode,
    '{DOC_DATE}': params.docDate,
    '{DocDate}': params.docDate,
    '{docDate}': params.docDate,
    '{PREPARED_BY}': signOff.preparedByName,
    '{PreparedBy}': signOff.preparedByName,
    '{preparedBy}': signOff.preparedByName,
    '{PREPARED_BY_INITIALS}': getInitials(signOff.preparedByName),
    '{CHECKED_BY}': signOff.checkedByName,
    '{CheckedBy}': signOff.checkedByName,
    '{checkedBy}': signOff.checkedByName,
    '{CHECKED_BY_INITIALS}': getInitials(signOff.checkedByName),
    '{APPROVED_BY}': signOff.approvedByName,
    '{ApprovedBy}': signOff.approvedByName,
    '{approvedBy}': signOff.approvedByName,
    '{APPROVED_BY_INITIALS}': getInitials(signOff.approvedByName),
    '{PREPARED_BY_DATE}': signOff.preparedByDate,
    '{PreparedByDate}': signOff.preparedByDate,
    '{preparedByDate}': signOff.preparedByDate,
    '{CHECKED_BY_DATE}': signOff.checkedByDate,
    '{CheckedByDate}': signOff.checkedByDate,
    '{checkedByDate}': signOff.checkedByDate,
    '{APPROVED_BY_DATE}': signOff.approvedByDate,
    '{APPROVED _BY_DATE}': signOff.approvedByDate,
    '{ApprovedByDate}': signOff.approvedByDate,
    '{approvedByDate}': signOff.approvedByDate,
    // Revision table placeholders (latest version data)
    '{REV_TABLE_REVISION}': latestVersion?.revision || revision,
    '{REV_TABLE_DATE}': latestVersion ? formatDateDDMMYYYY(latestVersion.uploaded_at) : formatDateDDMMYYYY(params.docDate),
    '{REV_TABLE_DESCRIPTION}': latestVersion?.note || content.description,
    '{REV_TABLE_PREPARED_BY}': signOff.preparedByName,
    '{REV_TABLE_PREPARED_BY_INITIALS}': getInitials(signOff.preparedByName),
    '{REV_TABLE_PREPARED_DATE}': signOff.preparedByDate,
    '{REV_TABLE_CHECKED_BY}': signOff.checkedByName,
    '{REV_TABLE_CHECKED_BY_INITIALS}': getInitials(signOff.checkedByName),
    '{REV_TABLE_CHECKED_DATE}': signOff.checkedByDate,
    '{REV_TABLE_APPROVED_BY}': signOff.approvedByName,
    '{REV_TABLE_APPROVED_BY_INITIALS}': getInitials(signOff.approvedByName),
    '{REV_TABLE_APPROVED_DATE}': signOff.approvedByDate,
    '{harisco logo}': HARISCO_LOGO_URL,
  };

  // Debug: log what values we're trying to replace
  console.log('[WordGenerator] Values to replace:', values);

  /**
   * Replace placeholders within each <w:t> text node individually.
   */
  function replaceWithinNodes(xml: string): string {
    const wTRegex = /<w:t([^>]*)>([\s\S]*?)<\/w:t>/g;
    let matchCount = 0;
    let replacedCount = 0;
    const result = xml.replace(wTRegex, (_match, attrs, text) => {
      matchCount++;
      let newText = text;
      for (const [placeholder, value] of Object.entries(values)) {
        if (newText.includes(placeholder)) {
          newText = newText.replace(new RegExp(placeholder, 'g'), value);
          replacedCount++;
        }
      }
      if (newText === text) return _match;
      return `<w:t${attrs}>${newText}</w:t>`;
    });
    console.log(`[WordGenerator] replaceWithinNodes: ${matchCount} w:t nodes, ${replacedCount} replacements`);
    return result;
  }

  /**
   * Replace placeholders that span multiple <w:t> runs.
   */
  function replaceAcrossRuns(xml: string): string {
    const wTRegex = /<w:t([^>]*)>([\s\S]*?)<\/w:t>/g;

    const nodes: Array<{
      openTag: string;
      text: string;
      textStart: number;
      textEnd: number;
    }> = [];

    let m: RegExpExecArray | null;
    while ((m = wTRegex.exec(xml)) !== null) {
      const attrs = m[1];
      const text = m[2];
      nodes.push({
        openTag: `<w:t${attrs}>`,
        text,
        textStart: m.index + `<w:t${attrs}>`.length,
        textEnd: m.index + `<w:t${attrs}>`.length + text.length,
      });
    }

    if (nodes.length === 0) return xml;

    let combinedText = '';
    const charToNode: number[] = [];
    nodes.forEach((node, i) => {
      for (let j = 0; j < node.text.length; j++) charToNode.push(i);
      combinedText += node.text;
    });

    const matches: Array<{ start: number; end: number; replacement: string; placeholder: string }> = [];
    for (const [placeholder, replacement] of Object.entries(values)) {
      const regex = new RegExp(placeholder, 'g');
      let match: RegExpExecArray | null;
      while ((match = regex.exec(combinedText)) !== null) {
        matches.push({ start: match.index, end: match.index + placeholder.length, replacement, placeholder });
      }
    }

    if (matches.length === 0) return xml;

    matches.sort((a, b) => b.start - a.start);

    const segments = nodes.map((n) => n.text);

    for (const match of matches) {
      const startNodeIdx = charToNode[match.start];
      const endNodeIdx = charToNode[match.end - 1];

      if (startNodeIdx === endNodeIdx) {
        let charsBefore = 0;
        for (let i = 0; i < startNodeIdx; i++) charsBefore += nodes[i].text.length;
        const offset = match.start - charsBefore;
        const len = match.end - match.start;
        segments[startNodeIdx] =
          segments[startNodeIdx].slice(0, offset) +
          match.replacement +
          segments[startNodeIdx].slice(offset + len);
        continue;
      }

      let beforeStart = 0;
      for (let i = 0; i < startNodeIdx; i++) beforeStart += nodes[i].text.length;
      const startOffset = match.start - beforeStart;

      let beforeEnd = 0;
      for (let i = 0; i < endNodeIdx; i++) beforeEnd += nodes[i].text.length;
      const endOffset = match.end - beforeEnd;

      const startPrefix = segments[startNodeIdx].slice(0, startOffset);
      const endSuffix = segments[endNodeIdx].slice(endOffset);

      segments[startNodeIdx] = startPrefix + match.replacement + endSuffix;

      for (let i = startNodeIdx + 1; i <= endNodeIdx; i++) segments[i] = '';
    }

    let result = xml;
    let offset = 0;
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (segments[i] !== node.text) {
        const pos = node.textStart + offset;
        result = result.slice(0, pos) + segments[i] + result.slice(pos + node.text.length);
        offset += segments[i].length - node.text.length;
      }
    }
    return result;
  }

  /**
   * Inject revision data into Table 0 data rows starting at Row 2.
   * Column mapping (9 columns):
   *   0: Rev, 1: Date, 2: Description, 3: Prepared by initials, 4: Prepared date,
   *   5: Checked by initials, 6: Checked date, 7: Approved by initials, 8: Approved date
   */
  function injectRevisionRows(xml: string): string {
    const tblStart = xml.indexOf('<w:tbl>');
    if (tblStart === -1) return xml;
    const tblEnd = xml.indexOf('</w:tbl>', tblStart);
    if (tblEnd === -1) return xml;

    const tableXml = xml.slice(tblStart, tblEnd + '</w:tbl>'.length);

    const rowRegex = /<w:tr[\s\S]*?<\/w:tr>/g;
    const rows: string[] = [];
    let rowMatch: RegExpExecArray | null;
    while ((rowMatch = rowRegex.exec(tableXml)) !== null) {
      rows.push(rowMatch[0]);
    }

    if (rows.length < 3) return xml;

    const getCells = (rowXml: string): string[] => {
      const cellRegex = /<w:tc[\s\S]*?<\/w:tc>/g;
      const cells: string[] = [];
      let m: RegExpExecArray | null;
      while ((m = cellRegex.exec(rowXml)) !== null) {
        cells.push(m[0]);
      }
      return cells;
    };

    const setCellText = (cellXml: string, value: string): string => {
      const wTRegex = /<w:t([^>]*)>([\s\S]*?)<\/w:t>/g;
      const hasTextNode = wTRegex.test(cellXml);
      if (!hasTextNode) {
        const tcClose = cellXml.indexOf('</w:tc>');
        if (tcClose === -1) return cellXml;
        const tcPrClose = cellXml.indexOf('</w:tcPr>');
        const insertPos = tcPrClose !== -1 ? tcPrClose + '</w:tcPr>'.length : tcClose;
        return (
          cellXml.slice(0, insertPos) +
          `<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve">${value}</w:t></w:r>` +
          cellXml.slice(insertPos)
        );
      }
      return cellXml.replace(wTRegex, (_match, attrs, oldText) => {
        return `<w:t${attrs}>${value}</w:t>`;
      });
    };

    const revisionRows: Array<{ revision: string; uploaded_at: string; note: string | null }> = [];
    if (versions.length > 0) {
      for (let i = versions.length - 1; i >= 0; i--) {
        revisionRows.push(versions[i]);
      }
    } else {
      revisionRows.push({
        revision,
        uploaded_at: params.docDate,
        note: content.description,
      });
    }

    let newTableXml = tableXml;
    for (let v = 0; v < revisionRows.length; v++) {
      const rowIdx = 2 + v;
      if (rowIdx >= rows.length) break;

      const version = revisionRows[v];
      const rowXml = rows[v];
      const cells = getCells(rowXml);

      if (cells.length < 9) continue;

      let newRowXml = rowXml;
      newRowXml = newRowXml.replace(cells[0], setCellText(cells[0], version.revision || ''));
      newRowXml = newRowXml.replace(cells[1], setCellText(cells[1], version.uploaded_at ? formatDateDDMMYYYY(version.uploaded_at) : ''));
      newRowXml = newRowXml.replace(cells[2], setCellText(cells[2], version.note || ''));
      newRowXml = newRowXml.replace(cells[3], setCellText(cells[3], getInitials(signOff.preparedByName)));
      newRowXml = newRowXml.replace(cells[4], setCellText(cells[4], signOff.preparedByDate || ''));
      newRowXml = newRowXml.replace(cells[5], setCellText(cells[5], getInitials(signOff.checkedByName)));
      newRowXml = newRowXml.replace(cells[6], setCellText(cells[6], signOff.checkedByDate || ''));
      newRowXml = newRowXml.replace(cells[7], setCellText(cells[7], getInitials(signOff.approvedByName)));
      newRowXml = newRowXml.replace(cells[8], setCellText(cells[8], signOff.approvedByDate || ''));

      newTableXml = newTableXml.replace(rowXml, newRowXml);
    }

    return xml.slice(0, tblStart) + newTableXml + xml.slice(tblEnd + '</w:tbl>'.length);
  }

  const templateUrl = new URL('../assets/word-new-template.docx', import.meta.url).href;
  console.log(`[WordGenerator] Template URL: ${templateUrl}`);

  const response = await fetch(templateUrl);
  if (!response.ok) {
    throw new Error(`Failed to load Word template: ${response.statusText}`);
  }
  const templateBuffer = await response.arrayBuffer();

  const zip = await JSZip.loadAsync(templateBuffer);

  const promises: Promise<void>[] = [];
  zip.forEach((relativePath, file) => {
    if (file.dir || !file.name.endsWith('.xml')) return;
    promises.push(
      file.async('text').then((xmlContent) => {
        console.log(`[WordGenerator] Processing ${relativePath}, length: ${xmlContent.length}`);
        let newContent = replaceWithinNodes(xmlContent);
        newContent = replaceAcrossRuns(newContent);
        zip.file(relativePath, newContent);
        console.log(`[WordGenerator] Finished ${relativePath}`);
      })
    );
  });
  await Promise.all(promises);

  const docXml = zip.file('word/document.xml');
  if (docXml) {
    try {
      let docContent = await docXml.async('text');
      docContent = injectRevisionRows(docContent);
      zip.file('word/document.xml', docContent);
      console.log('[WordGenerator] Injected revision rows into Table 0');
    } catch (err) {
      console.error('[WordGenerator] Table injection failed:', err);
    }
  }

  const newBuffer = await zip.generateAsync({ type: 'uint8array' });
  return newBuffer;
};

export const downloadWordBlob = (buffer: Uint8Array, fileName: string) => {
  const blob = new Blob([buffer as any], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileName}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
