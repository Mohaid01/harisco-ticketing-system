import type { PDFPage, Font } from 'pdf-lib';

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

import type { ExperienceRow, FormData, RepeaterRow } from '../types';

import logo from '../../../assets/harisco-logo.png';

const blobToBase64 = async (blob: Blob): Promise<string> => {
  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const A4_WIDTH = 595;
const A4_HEIGHT = 842;
const MARGIN_LEFT = 60;
const MARGIN_RIGHT = 30;
const MARGIN_TOP = 120;
const MARGIN_BOTTOM = 60;
const CONTENT_WIDTH = A4_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

const BRAND_COLOR = rgb(14 / 255, 82 / 255, 155 / 255);
const BRAND_LIGHT = rgb(0.95, 0.97, 1);
const TEXT_COLOR = rgb(0.15, 0.15, 0.15);
const LABEL_COLOR = rgb(0.4, 0.4, 0.4);
const BORDER_COLOR = rgb(0.85, 0.85, 0.85);
const LETTERHEAD_YELLOW = rgb(242 / 255, 187 / 255, 19 / 255);

type PageWithFonts = PDFPage;

interface CheckNewPageResult {
  page: PageWithFonts;
  y: number;
}

const drawLetterhead = (page: PageWithFonts, logoImage: unknown, font: Font) => {
  page.drawRectangle({
    x: 0,
    y: A4_HEIGHT - 200,
    width: 25,
    height: 200,
    color: LETTERHEAD_YELLOW,
  });
  page.drawRectangle({ x: 0, y: 0, width: 25, height: A4_HEIGHT - 200, color: BRAND_COLOR });

  const today = new Date();
  const dateStr = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`;
  page.drawText(`Dated: ${dateStr}`, {
    x: MARGIN_LEFT,
    y: A4_HEIGHT - 40,
    size: 10,
    font,
    color: TEXT_COLOR,
  });

  if (logoImage) {
    const logoHeight = 40;
    const logoWidth =
      ((logoImage as { width: number; height: number }).width /
        (logoImage as { width: number; height: number }).height) *
      logoHeight;
    page.drawImage(logoImage, {
      x: A4_WIDTH - MARGIN_RIGHT - logoWidth,
      y: A4_HEIGHT - 60,
      width: logoWidth,
      height: logoHeight,
    });
  }
};

const wrapText = (
  text: string,
  maxWidth: number,
  font: { widthOfTextAtSize: (t: string, s: number) => number }
): string[] => {
  if (!text) return [];
  const FONT_SIZE = 9;
  const lines: string[] = [];

  const hardBreakWord = (word: string): string[] => {
    const broken: string[] = [];
    let current = '';
    for (const ch of word) {
      const test = current + ch;
      if (font.widthOfTextAtSize(test, FONT_SIZE) > maxWidth && current) {
        broken.push(current);
        current = ch;
      } else {
        current = test;
      }
    }
    if (current) broken.push(current);
    return broken.length ? broken : [word];
  };

  for (const hardLine of text.split('\n')) {
    const words = hardLine.split(' ');
    let currentLine = '';

    for (const word of words) {
      if (!word) continue;

      if (font.widthOfTextAtSize(word, FONT_SIZE) > maxWidth) {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = '';
        }
        const broken = hardBreakWord(word);
        broken.forEach((part, i) => {
          if (i < broken.length - 1) {
            lines.push(part);
          } else {
            currentLine = part;
          }
        });
        continue;
      }

      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (font.widthOfTextAtSize(testLine, FONT_SIZE) > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) lines.push(currentLine);
  }

  return lines.length ? lines : [''];
};

const formatDate = (dateStr: string | undefined | null): string => {
  if (!dateStr || dateStr.trim() === '') return 'N/A';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) {
    const [year, month, day] = dateStr.trim().split('-');
    return `${day}-${month}-${year}`;
  }
  return dateStr;
};

const drawSectionHeader = (page: PageWithFonts, title: string, yPos: number): number => {
  const headerHeight = 22;
  page.drawRectangle({
    x: MARGIN_LEFT,
    y: yPos - headerHeight,
    width: CONTENT_WIDTH,
    height: headerHeight,
    color: BRAND_COLOR,
  });
  page.drawText(title, {
    x: MARGIN_LEFT + 10,
    y: yPos - headerHeight + 6,
    size: 11,
    font: page.fontBold,
    color: rgb(1, 1, 1),
  });
  return yPos - headerHeight - 16;
};

const drawEntryHeader = (page: PageWithFonts, title: string, yPos: number): number => {
  const headerHeight = 18;
  page.drawRectangle({
    x: MARGIN_LEFT,
    y: yPos - headerHeight,
    width: CONTENT_WIDTH,
    height: headerHeight,
    color: BRAND_LIGHT,
  });
  page.drawText(title, {
    x: MARGIN_LEFT + 10,
    y: yPos - headerHeight + 5,
    size: 10,
    font: page.fontBold,
    color: BRAND_COLOR,
  });
  return yPos - headerHeight - 16;
};

const drawDivider = (page: PageWithFonts, y: number): number => {
  page.drawLine({
    start: { x: MARGIN_LEFT, y },
    end: { x: MARGIN_LEFT + CONTENT_WIDTH, y },
    color: BORDER_COLOR,
    thickness: 0.5,
  });
  return y - 10;
};

const checkNewPage = (
  pdfDoc: PDFDocument,
  page: PageWithFonts,
  y: number,
  requiredHeight: number,
  logoImage: unknown
): CheckNewPageResult => {
  if (y - requiredHeight < MARGIN_BOTTOM) {
    const newPage = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
    newPage.font = page.font;
    newPage.fontBold = page.fontBold;
    drawLetterhead(newPage, logoImage, page.font);
    return { page: newPage, y: A4_HEIGHT - MARGIN_TOP };
  }
  return { page, y };
};

const twoColumnFields = (
  pdfDoc: PDFDocument,
  page: PageWithFonts,
  logoImage: unknown,
  items: { label: string; value: string | number }[],
  yPos: number
): { page: PageWithFonts; y: number } => {
  const indent = 10;
  const colWidth = Math.floor((CONTENT_WIDTH - indent * 2 - 20) / 2);
  const labelWidth = 120;
  const valueWidth = colWidth - labelWidth - 6;
  const lineHeight = 13;
  const rowGap = 4;
  let currentY = yPos;

  for (let i = 0; i < items.length; i += 2) {
    const leftItem = items[i];
    const rightItem = items[i + 1];

    const leftVal =
      (!leftItem.value && leftItem.value !== 0) || String(leftItem.value).trim() === ''
        ? 'N/A'
        : String(leftItem.value);
    const leftLabelLines = wrapText(
      leftItem.label,
      labelWidth - 4,
      page.font as { widthOfTextAtSize: (t: string, s: number) => number }
    );
    const leftValueLines = wrapText(
      leftVal,
      valueWidth,
      page.font as { widthOfTextAtSize: (t: string, s: number) => number }
    );
    const leftLines = Math.max(leftLabelLines.length, leftValueLines.length);

    let rightLines = 0;
    let rightLabelLines: string[] = [];
    let rightValueLines: string[] = [];
    if (rightItem) {
      const rightVal =
        (!rightItem.value && rightItem.value !== 0) || String(rightItem.value).trim() === ''
          ? 'N/A'
          : String(rightItem.value);
      rightLabelLines = wrapText(
        rightItem.label,
        labelWidth - 4,
        page.font as { widthOfTextAtSize: (t: string, s: number) => number }
      );
      rightValueLines = wrapText(
        rightVal,
        valueWidth,
        page.font as { widthOfTextAtSize: (t: string, s: number) => number }
      );
      rightLines = Math.max(rightLabelLines.length, rightValueLines.length);
    }

    const rowLines = Math.max(leftLines, rightLines, 1);
    const rowHeight = rowLines * lineHeight + rowGap;

    const res = checkNewPage(pdfDoc, page, currentY, rowHeight + 4, logoImage);
    if (res.page !== page) {
      page = res.page;
      currentY = res.y;
    }

    const leftX = MARGIN_LEFT + indent;
    const rightX = MARGIN_LEFT + indent + colWidth + 20;

    leftLabelLines.forEach((line, li) =>
      page.drawText(line, {
        x: leftX,
        y: currentY - li * lineHeight,
        size: 9,
        font: page.font,
        color: LABEL_COLOR,
      })
    );
    leftValueLines.forEach((line, li) =>
      page.drawText(line, {
        x: leftX + labelWidth,
        y: currentY - li * lineHeight,
        size: 9,
        font: page.font,
        color: TEXT_COLOR,
      })
    );

    if (rightItem) {
      rightLabelLines.forEach((line, li) =>
        page.drawText(line, {
          x: rightX,
          y: currentY - li * lineHeight,
          size: 9,
          font: page.font,
          color: LABEL_COLOR,
        })
      );
      rightValueLines.forEach((line, li) =>
        page.drawText(line, {
          x: rightX + labelWidth,
          y: currentY - li * lineHeight,
          size: 9,
          font: page.font,
          color: TEXT_COLOR,
        })
      );
    }

    currentY -= rowHeight;
  }

  return { page, y: currentY - 6 };
};

const drawTable = (
  pdfDoc: PDFDocument,
  page: PageWithFonts,
  logoImage: unknown,
  columns: { header: string; width: number }[],
  rows: string[][],
  yPos: number
): { page: PageWithFonts; y: number } => {
  let currentY = yPos;
  const FONT_SIZE = 9;
  const LINE_H = 14;
  const PAD_X = 6;
  const PAD_TOP = 6;
  const PAD_BOT = 4;
  const HDR_H = 20;
  const font = page.font as { widthOfTextAtSize: (t: string, s: number) => number };
  let localPage = page;

  const doHeader = () => {
    const res = checkNewPage(pdfDoc, localPage, currentY, HDR_H + 8, logoImage);
    localPage = res.page;
    currentY = res.y;

    localPage.drawRectangle({
      x: MARGIN_LEFT,
      y: currentY - HDR_H,
      width: CONTENT_WIDTH,
      height: HDR_H,
      color: BRAND_LIGHT,
      borderColor: BORDER_COLOR,
      borderWidth: 0.5,
    });

    let hX = MARGIN_LEFT;
    columns.forEach((col) => {
      localPage.drawLine({
        start: { x: hX, y: currentY },
        end: { x: hX, y: currentY - HDR_H },
        color: BORDER_COLOR,
        thickness: 0.5,
      });
      localPage.drawText(col.header, {
        x: hX + PAD_X,
        y: currentY - HDR_H + PAD_BOT + 2,
        size: FONT_SIZE,
        font: localPage.fontBold,
        color: BRAND_COLOR,
      });
      hX += col.width;
    });
    localPage.drawLine({
      start: { x: hX, y: currentY },
      end: { x: hX, y: currentY - HDR_H },
      color: BORDER_COLOR,
      thickness: 0.5,
    });
    currentY -= HDR_H + 6;
  };

  if (rows.length > 0) {
    const firstRowWrapped = rows[0].map((text, idx) =>
      wrapText(text || 'N/A', Math.max(10, columns[idx].width - PAD_X * 2), font)
    );
    const firstRowMaxLines = Math.max(1, ...firstRowWrapped.map((w) => w.length));
    const firstRowH = PAD_TOP + firstRowMaxLines * LINE_H + PAD_BOT;
    const res = checkNewPage(pdfDoc, localPage, currentY, HDR_H + 8 + firstRowH + 8, logoImage);
    localPage = res.page;
    currentY = res.y;
    doHeader();
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const wrapped = row.map((text, idx) => wrapText(text || 'N/A', Math.max(10, columns[idx].width - PAD_X * 2), font));
    const maxLines = Math.max(1, ...wrapped.map((w) => w.length));
    const rowH = PAD_TOP + maxLines * LINE_H + PAD_BOT;

    const res = checkNewPage(pdfDoc, localPage, currentY, rowH + 8, logoImage);
    if (res.page !== localPage) {
      localPage = res.page;
      currentY = res.y;
      doHeader();
    }

    localPage.drawRectangle({
      x: MARGIN_LEFT,
      y: currentY - rowH,
      width: CONTENT_WIDTH,
      height: rowH,
      borderColor: BORDER_COLOR,
      borderWidth: 0.5,
    });

    let rX = MARGIN_LEFT;
    columns.forEach((col, idx) => {
      localPage.drawLine({
        start: { x: rX, y: currentY },
        end: { x: rX, y: currentY - rowH },
        color: BORDER_COLOR,
        thickness: 0.5,
      });

      wrapped[idx].forEach((line, li) => {
        const textY = currentY - PAD_TOP - li * LINE_H - (LINE_H - FONT_SIZE);
        localPage.drawText(line, {
          x: rX + PAD_X,
          y: textY,
          size: FONT_SIZE,
          font: localPage.font,
          color: TEXT_COLOR,
        });
      });

      rX += col.width;
    });
    localPage.drawLine({
      start: { x: rX, y: currentY },
      end: { x: rX, y: currentY - rowH },
      color: BORDER_COLOR,
      thickness: 0.5,
    });

    currentY -= rowH;
  }

  return { page: localPage, y: currentY - 8 };
};

const section = (
  pdfDoc: PDFDocument,
  page: PageWithFonts,
  logoImage: unknown,
  title: string,
  y: number
): { page: PageWithFonts; y: number } => {
  const res = checkNewPage(pdfDoc, page, y, 80, logoImage);
  const newPage = res.page;
  const newY = drawSectionHeader(newPage, title, res.y);
  return { page: newPage, y: newY };
};

export const generateApplicationPdf = async (data: FormData, photoFile?: File): Promise<Blob> => {
  const pdfDoc = await PDFDocument.create();
  let page: PageWithFonts = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]) as unknown as PageWithFonts;
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  page.font = font;
  page.fontBold = fontBold;

  const logoUrl = typeof logo === 'string' ? logo : (logo as { default?: string }).default || logo;
  let logoImage: unknown = null;
  try {
    const response = await fetch(logoUrl);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    logoImage = await pdfDoc.embedPng(buffer);
  } catch (err) {
    console.error('Failed to load logo for PDF:', err);
  }

  drawLetterhead(page, logoImage, font);

  let y = A4_HEIGHT - MARGIN_TOP;

  page.drawText('EMPLOYEE CV', {
    x: MARGIN_LEFT,
    y,
    size: 20,
    font: fontBold,
    color: BRAND_COLOR,
  });
  y -= 24;

  ({ page, y } = section(pdfDoc, page, logoImage, 'Job Information', y));

  const jobInfoItems: { label: string; value: string | number }[] = [
    { label: 'Position / Designation', value: data.postAppliedFor },
    { label: 'Code', value: data.code },
    { label: 'Notice Period (Days)', value: data.noticePeriodDays },
    {
      label: 'Total Experience',
      value: `${data.totalExpYears ?? ''}y ${data.totalExpMonths ?? ''}m`,
    },
    { label: 'Total Exp As Of', value: `${data.totalExpAsOfMonth}/${data.totalExpAsOfYear}` },
    { label: 'Relevant Exp As Of', value: `${data.relevantExpAsOfMonth}/${data.relevantExpAsOfYear}` },
    {
      label: 'Relevant Experience',
      value: `${data.relevantExpYears ?? ''}y ${data.relevantExpMonths ?? ''}m`,
    },
  ];
  ({ page, y } = twoColumnFields(pdfDoc, page, logoImage, jobInfoItems, y));
  y = drawDivider(page, y);

  ({ page, y } = section(pdfDoc, page, logoImage, 'Personal Details', y));
  const personalStartY = y;
  const colWidth = (CONTENT_WIDTH - 20) / 2;
  const rightColX = MARGIN_LEFT + 10 + colWidth + 10;
  const leftValueWidth = colWidth - 110;
  const lineHeight = 13;

  let photoImage: unknown = null;
  if (photoFile) {
    try {
      const arrayBuffer = await photoFile.arrayBuffer();
      const imageBuffer = new Uint8Array(arrayBuffer);
      const ext = photoFile.type.split('/')[1];
      if (ext === 'png') {
        photoImage = await pdfDoc.embedPng(imageBuffer);
      } else {
        photoImage = await pdfDoc.embedJpg(imageBuffer);
      }
    } catch (err) {
      console.error('Failed to embed photo in PDF:', err);
    }
  }

  const allLeftFields = [
    {
      label: 'Full Name',
      value: data.fullName || 'N/A',
    },
    { label: "Father's Name", value: data.fatherName || 'N/A' },
    { label: 'Date of Birth', value: formatDate(data.dob) },
    { label: 'Blood Group', value: data.bloodGroup || 'N/A' },
    { label: 'Phone', value: data.phone || 'N/A' },
    { label: 'Email', value: data.email || 'N/A' },
  ];

  let currentY = personalStartY;
  for (const field of allLeftFields) {
    const displayValue =
      field.value === null || field.value === undefined || String(field.value).trim() === ''
        ? 'N/A'
        : String(field.value);
    const valueLines = wrapText(
      displayValue,
      leftValueWidth,
      font as { widthOfTextAtSize: (t: string, s: number) => number }
    );
    page.drawText(field.label, {
      x: MARGIN_LEFT + 10,
      y: currentY,
      size: 9,
      font,
      color: LABEL_COLOR,
    });
    valueLines.forEach((line, li) => {
      page.drawText(line, {
        x: MARGIN_LEFT + 10 + 110,
        y: currentY - li * lineHeight,
        size: 9,
        font,
        color: TEXT_COLOR,
      });
    });
    currentY -= Math.max(1, valueLines.length) * lineHeight + 2;
  }

  currentY -= 6;
  page.drawText('CNIC', {
    x: MARGIN_LEFT + 10,
    y: currentY,
    size: 9,
    font: fontBold,
    color: LABEL_COLOR,
  });
  currentY -= 14;
  const cnicNumberDisplay = data.cnicNumber || 'N/A';
  const cnicNumberLines = wrapText(
    cnicNumberDisplay,
    leftValueWidth,
    font as { widthOfTextAtSize: (t: string, s: number) => number }
  );
  page.drawText('Number', {
    x: MARGIN_LEFT + 10,
    y: currentY,
    size: 9,
    font,
    color: LABEL_COLOR,
  });
  cnicNumberLines.forEach((line, li) => {
    page.drawText(line, {
      x: MARGIN_LEFT + 10 + 110,
      y: currentY - li * lineHeight,
      size: 9,
      font,
      color: TEXT_COLOR,
    });
  });
  currentY -= Math.max(1, cnicNumberLines.length) * lineHeight + 2;

  const cnicExpiryDisplay = formatDate(data.cnicExpiry);
  const cnicExpiryLines = wrapText(
    cnicExpiryDisplay,
    leftValueWidth,
    font as { widthOfTextAtSize: (t: string, s: number) => number }
  );
  page.drawText('Expiry', {
    x: MARGIN_LEFT + 10,
    y: currentY,
    size: 9,
    font,
    color: LABEL_COLOR,
  });
  cnicExpiryLines.forEach((line, li) => {
    page.drawText(line, {
      x: MARGIN_LEFT + 10 + 110,
      y: currentY - li * lineHeight,
      size: 9,
      font,
      color: TEXT_COLOR,
    });
  });
  currentY -= Math.max(1, cnicExpiryLines.length) * lineHeight + 2;

  currentY -= 6;
  page.drawText('Passport', {
    x: MARGIN_LEFT + 10,
    y: currentY,
    size: 9,
    font: fontBold,
    color: LABEL_COLOR,
  });
  currentY -= 14;
  const passportNumberDisplay = data.passportNumber || 'N/A';
  const passportNumberLines = wrapText(
    passportNumberDisplay,
    leftValueWidth,
    font as { widthOfTextAtSize: (t: string, s: number) => number }
  );
  page.drawText('Number', {
    x: MARGIN_LEFT + 10,
    y: currentY,
    size: 9,
    font,
    color: LABEL_COLOR,
  });
  passportNumberLines.forEach((line, li) => {
    page.drawText(line, {
      x: MARGIN_LEFT + 10 + 110,
      y: currentY - li * lineHeight,
      size: 9,
      font,
      color: TEXT_COLOR,
    });
  });
  currentY -= Math.max(1, passportNumberLines.length) * lineHeight + 2;

  const passportExpiryDisplay = formatDate(data.passportExpiry);
  const passportExpiryLines = wrapText(
    passportExpiryDisplay,
    leftValueWidth,
    font as { widthOfTextAtSize: (t: string, s: number) => number }
  );
  page.drawText('Expiry', {
    x: MARGIN_LEFT + 10,
    y: currentY,
    size: 9,
    font,
    color: LABEL_COLOR,
  });
  passportExpiryLines.forEach((line, li) => {
    page.drawText(line, {
      x: MARGIN_LEFT + 10 + 110,
      y: currentY - li * lineHeight,
      size: 9,
      font,
      color: TEXT_COLOR,
    });
  });
  currentY -= Math.max(1, passportExpiryLines.length) * lineHeight + 2;

  const personalDetailsHeight = personalStartY - currentY;

  if (photoImage) {
    const maxWidth = colWidth - 20;
    const targetHeight = personalDetailsHeight / 1.75;
    const aspectRatio =
      (photoImage as { width: number; height: number }).width /
      (photoImage as { width: number; height: number }).height;
    let drawWidth = targetHeight * aspectRatio;
    let drawHeight = targetHeight;
    if (drawWidth > maxWidth) {
      drawWidth = maxWidth;
      drawHeight = maxWidth / aspectRatio;
    }
    const imgX = rightColX + 10 + maxWidth - drawWidth;
    const imgY = personalStartY - drawHeight;
    page.drawImage(photoImage, { x: imgX, y: imgY, width: drawWidth, height: drawHeight });
  }

  y = currentY - 8;

  page.drawText('Dependants', {
    x: MARGIN_LEFT + 10,
    y,
    size: 9,
    font,
    color: LABEL_COLOR,
  });
  page.drawText(
    `Spouse: ${data.dependantsSpouse ?? 0}    Sons: ${data.dependantsSons ?? 0}    Daughters: ${data.dependantsDaughters ?? 0}    Others: ${data.dependantsOthers ?? 0}`,
    { x: MARGIN_LEFT + 10 + 110, y, size: 9, font, color: TEXT_COLOR }
  );
  y -= 14;

  const addrLines = wrapText(
    data.permanentAddress || 'N/A',
    CONTENT_WIDTH - 10 - 110,
    font as { widthOfTextAtSize: (t: string, s: number) => number }
  );
  page.drawText('Permanent Address', {
    x: MARGIN_LEFT + 10,
    y,
    size: 9,
    font,
    color: LABEL_COLOR,
  });
  addrLines.forEach((line, li) => {
    page.drawText(line, {
      x: MARGIN_LEFT + 10 + 110,
      y: y - li * 13,
      size: 9,
      font,
      color: TEXT_COLOR,
    });
  });
  y -= addrLines.length * 13 + 4;

  y = drawDivider(page, y);

  ({ page, y } = section(pdfDoc, page, logoImage, 'Emergency Contacts', y));
  if (data.emergencyContact1Name) {
    y = drawEntryHeader(page, 'Primary Contact', y);
    ({ page, y } = twoColumnFields(
      pdfDoc,
      page,
      logoImage,
      [
        { label: 'Name', value: data.emergencyContact1Name },
        { label: 'Relation', value: data.emergencyContact1Relation },
        { label: 'Phone', value: data.emergencyContact1Phone },
      ],
      y
    ));
  }
  if (data.emergencyContact2Name) {
    y = drawEntryHeader(page, 'Secondary Contact', y);
    ({ page, y } = twoColumnFields(
      pdfDoc,
      page,
      logoImage,
      [
        { label: 'Name', value: data.emergencyContact2Name },
        { label: 'Relation', value: data.emergencyContact2Relation },
        { label: 'Phone', value: data.emergencyContact2Phone },
      ],
      y
    ));
  }
  y = drawDivider(page, y);

  ({ page, y } = section(pdfDoc, page, logoImage, 'Professional Experience', y));
  if (data.experience?.length) {
    const cols = [
      { header: 'Company', width: 100 },
      { header: 'Position', width: 100 },
      { header: 'From', width: 60 },
      { header: 'To', width: 60 },
      { header: 'Description(s)', width: 185 },
    ];
    const rows: string[][] = data.experience.map((item: ExperienceRow) => {
      const descriptionsArray: string[] = Array.isArray(item.descriptions) ? item.descriptions : [];
      const descText = descriptionsArray.map((d: string, i: number) => `${i + 1}. ${d}`).join('\n');
      return [
        String(item.company || ''),
        String(item.position || ''),
        String(item.from || ''),
        String(item.to || ''),
        descText,
      ];
    });
    ({ page, y } = drawTable(pdfDoc, page, logoImage, cols, rows, y));
  } else {
    page.drawText('No experience', {
      x: MARGIN_LEFT + 10,
      y,
      size: 9,
      font,
      color: TEXT_COLOR,
    });
    y -= 14;
  }

  y = drawDivider(page, y);

  ({ page, y } = section(pdfDoc, page, logoImage, 'Academic Details', y));
  if (data.academicDetails?.length) {
    const cols = [
      { header: 'Degree/Certificate', width: 155 },
      { header: 'Institution', width: 170 },
      { header: 'Session From', width: 90 },
      { header: 'Session To', width: 90 },
    ];
    const rows: string[][] = data.academicDetails.map((item: RepeaterRow) => [
      String(item.degree || ''),
      String(item.institution || ''),
      String(item.sessionFrom || ''),
      String(item.sessionTo || ''),
    ]);
    ({ page, y } = drawTable(pdfDoc, page, logoImage, cols, rows, y));
  } else {
    page.drawText('No academic details', {
      x: MARGIN_LEFT + 10,
      y,
      size: 9,
      font,
      color: TEXT_COLOR,
    });
    y -= 14;
  }

  y = drawDivider(page, y);

  ({ page, y } = section(pdfDoc, page, logoImage, 'Certifications', y));
  if (data.certifications?.length) {
    const cols = [
      { header: 'Name', width: 150 },
      { header: 'Institution', width: 155 },
      { header: 'Year', width: 60 },
      { header: 'Body', width: 140 },
    ];
    const rows: string[][] = data.certifications.map((item: RepeaterRow) => [
      String(item.name || ''),
      String(item.institution || ''),
      String(item.year || ''),
      String(item.body || ''),
    ]);
    ({ page, y } = drawTable(pdfDoc, page, logoImage, cols, rows, y));
  } else {
    page.drawText('No certifications', {
      x: MARGIN_LEFT + 10,
      y,
      size: 9,
      font,
      color: TEXT_COLOR,
    });
    y -= 14;
  }

  y = drawDivider(page, y);

  ({ page, y } = section(pdfDoc, page, logoImage, 'Awards & Achievements', y));
  if (data.awards?.length) {
    const cols = [
      { header: 'Description', width: 150 },
      { header: 'Institution', width: 155 },
      { header: 'Year', width: 60 },
      { header: 'Body', width: 140 },
    ];
    const rows: string[][] = data.awards.map((item: RepeaterRow) => [
      String(item.description || ''),
      String(item.institution || ''),
      String(item.year || ''),
      String(item.body || ''),
    ]);
    ({ page, y } = drawTable(pdfDoc, page, logoImage, cols, rows, y));
  } else {
    page.drawText('No awards', {
      x: MARGIN_LEFT + 10,
      y,
      size: 9,
      font,
      color: TEXT_COLOR,
    });
    y -= 14;
  }

  y = drawDivider(page, y);

  ({ page, y } = section(pdfDoc, page, logoImage, 'Computer Skills', y));
  if (data.computerSkills?.length) {
    const cols = [
      { header: 'Skill Name', width: 365 },
      { header: 'Level', width: 140 },
    ];
    const rows: string[][] = data.computerSkills.map((item: RepeaterRow) => [
      String(item.name || ''),
      String(item.level || ''),
    ]);
    ({ page, y } = drawTable(pdfDoc, page, logoImage, cols, rows, y));
  } else {
    page.drawText('No computer skills', {
      x: MARGIN_LEFT + 10,
      y,
      size: 9,
      font,
      color: TEXT_COLOR,
    });
    y -= 14;
  }

  y = drawDivider(page, y);

  ({ page, y } = section(pdfDoc, page, logoImage, 'Foreign Languages', y));
  if (data.foreignLanguages?.length) {
    const cols = [
      { header: 'Language', width: 175 },
      { header: 'Reading', width: 110 },
      { header: 'Writing', width: 110 },
      { header: 'Speaking', width: 110 },
    ];
    const rows: string[][] = data.foreignLanguages.map((item: RepeaterRow) => [
      String(item.name || ''),
      String(item.reading || ''),
      String(item.writing || ''),
      String(item.speaking || ''),
    ]);
    ({ page, y } = drawTable(pdfDoc, page, logoImage, cols, rows, y));
  } else {
    page.drawText('No foreign languages', {
      x: MARGIN_LEFT + 10,
      y,
      size: 9,
      font,
      color: TEXT_COLOR,
    });
    y -= 14;
  }
  y = drawDivider(page, y);

  ({ page, y } = section(pdfDoc, page, logoImage, 'Professional References', y));
  if (data.references?.length) {
    const cols = [
      { header: 'Name', width: 252 },
      { header: 'Mobile', width: 253 },
    ];
    const rows: string[][] = data.references.map((item: RepeaterRow) => [
      String(item.name || ''),
      String(item.mobile || ''),
    ]);
    ({ page, y } = drawTable(pdfDoc, page, logoImage, cols, rows, y));
  } else {
    page.drawText('No references', {
      x: MARGIN_LEFT + 10,
      y,
      size: 9,
      font,
      color: TEXT_COLOR,
    });
    y -= 14;
  }

  y = drawDivider(page, y);

  const pages = pdfDoc.getPages();
  pages.forEach((pg: PageWithFonts, idx: number) => {
    pg.drawText(`Page ${idx + 1} of ${pages.length}`, {
      x: A4_WIDTH - MARGIN_RIGHT - 50,
      y: 20,
      size: 8,
      font,
      color: LABEL_COLOR,
    });
    pg.drawText('Generated by Harisco Ticketing System', {
      x: MARGIN_LEFT,
      y: 20,
      size: 8,
      font,
      color: LABEL_COLOR,
    });
  });

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
};

export { blobToBase64 };

export const downloadPdf = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
