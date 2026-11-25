import JSZip from 'jszip';

export interface RevisionTableRow {
  revision: string;
  date: string;
  note: string;
  preparedInitials: string;
  preparedDate: string;
  checkedInitials: string;
  checkedDate: string;
  approvedInitials: string;
  approvedDate: string;
}

const ROW_RE = /<w:tr[\s\S]*?<\/w:tr>/g;
const CELL_RE = /<w:tc[\s\S]*?<\/w:tc>/g;

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

/**
 * Locate the revision table within document.xml.
 * The first <w:tbl> is the title block; the revision table is the one that has
 * at least 3 rows and includes a 9-cell row. Returns [start, end) offsets.
 */
function findRevisionTable(xml: string): { start: number; end: number } | null {
  const tableRegex = /<w:tbl[\s\S]*?<\/w:tbl>/g;
  let fallback: { start: number; end: number } | null = null;
  let m: RegExpExecArray | null;
  while ((m = tableRegex.exec(xml)) !== null) {
    const tableXml = m[0];
    const rows: string[] = [];
    ROW_RE.lastIndex = 0;
    let r: RegExpExecArray | null;
    while ((r = ROW_RE.exec(tableXml)) !== null) rows.push(r[0]);
    if (rows.length < 3) continue;

    const hasNineCellRow = rows.some((rowXml) => {
      const cells = rowXml.match(CELL_RE);
      return cells ? cells.length === 9 : false;
    });

    if (hasNineCellRow) {
      return { start: m.index, end: m.index + tableXml.length };
    }
    if (!fallback) fallback = { start: m.index, end: m.index + tableXml.length };
  }
  return fallback;
}

function setCellText(cellXml: string, value: string): string {
  const escaped = escapeXml(value);
  const wTRegex = /<w:t(\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
  const hasTextNode = wTRegex.test(cellXml);
  if (hasTextNode) {
    let firstDone = false;
    return cellXml.replace(wTRegex, (_match, attrs = '') => {
      if (!firstDone) {
        firstDone = true;
        return `<w:t${attrs}>${escaped}</w:t>`;
      }
      return `<w:t${attrs}></w:t>`;
    });
  }

  // No text node: inject a run inside the first paragraph (runs must live in a <w:p>).
  const run = `<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:b/><w:bCs/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr><w:t xml:space="preserve">${escaped}</w:t></w:r>`;

  const selfClosing = cellXml.match(/<w:p\b[^>]*\/>/);
  if (selfClosing) {
    const pOpen = selfClosing[0].slice(0, -2) + '>';
    return cellXml.replace(selfClosing[0], pOpen + run + '</w:p>');
  }

  const pClose = cellXml.indexOf('</w:p>');
  if (pClose !== -1) {
    return cellXml.slice(0, pClose) + run + cellXml.slice(pClose);
  }

  const tcClose = cellXml.indexOf('</w:tc>');
  if (tcClose === -1) return cellXml;
  return cellXml.slice(0, tcClose) + `<w:p>${run}</w:p>` + cellXml.slice(tcClose);
}

/**
 * Rebuild the revision table of an uploaded .docx so that its data rows match
 * the supplied rows (newest first). Header rows (0-1) are preserved, the title
 * block and all page-2+ content are left untouched. Extra rows are cloned from
 * the last data row when the supplied row count exceeds the available rows.
 */
export async function mergeRevisionTable(buffer: Buffer, rows: RevisionTableRow[]): Promise<Buffer> {
  const zip = await JSZip.loadAsync(buffer);
  const docFile = zip.file('word/document.xml');
  if (!docFile) throw new Error('document.xml not found in uploaded file');

  let xml = await docFile.async('text');

  const bounds = findRevisionTable(xml);
  if (!bounds) throw new Error('Revision table not found in uploaded file');

  const tableXml = xml.slice(bounds.start, bounds.end);

  const rowsArr: string[] = [];
  ROW_RE.lastIndex = 0;
  let rm: RegExpExecArray | null;
  while ((rm = ROW_RE.exec(tableXml)) !== null) rowsArr.push(rm[0]);
  if (rowsArr.length < 3) throw new Error('Revision table has no data rows');

  const dataRows = rowsArr.slice(2);
  const pool = [...dataRows];
  while (pool.length < rows.length) {
    pool.push(pool[pool.length - 1]);
  }

  const newDataRows: string[] = [];
  for (let v = 0; v < rows.length; v++) {
    const data = rows[v];
    const rowXml = pool[v];
    const cells = rowXml.match(CELL_RE) || [];
    if (cells.length < 9) continue;

    let newRow = rowXml;
    newRow = newRow.replace(cells[0], setCellText(cells[0], data.revision));
    newRow = newRow.replace(cells[1], setCellText(cells[1], data.date));
    newRow = newRow.replace(cells[2], setCellText(cells[2], data.note));
    newRow = newRow.replace(cells[3], setCellText(cells[3], data.preparedInitials));
    newRow = newRow.replace(cells[4], setCellText(cells[4], data.preparedDate));
    newRow = newRow.replace(cells[5], setCellText(cells[5], data.checkedInitials));
    newRow = newRow.replace(cells[6], setCellText(cells[6], data.checkedDate));
    newRow = newRow.replace(cells[7], setCellText(cells[7], data.approvedInitials));
    newRow = newRow.replace(cells[8], setCellText(cells[8], data.approvedDate));
    newDataRows.push(newRow);
  }

  const firstDataRow = dataRows[0];
  const lastDataRow = dataRows[dataRows.length - 1];
  const startIdx = tableXml.indexOf(firstDataRow);
  const endIdx = tableXml.lastIndexOf(lastDataRow) + lastDataRow.length;
  if (startIdx === -1 || endIdx < startIdx) {
    throw new Error('Could not locate revision data rows');
  }

  const newTableXml = tableXml.slice(0, startIdx) + newDataRows.join('') + tableXml.slice(endIdx);
  xml = xml.slice(0, bounds.start) + newTableXml + xml.slice(bounds.end);

  zip.file('word/document.xml', xml);

  return zip.generateAsync({ type: 'nodebuffer' });
}