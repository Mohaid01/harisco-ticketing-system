import JSZip from 'jszip';

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
}

const COMPANY_NAME = 'HARIS & Co Engineering Concern Pvt Ltd.';

export const generateDocumentWord = async (params: GenerateWordParams): Promise<Uint8Array> => {
  const { revision, appendixNumber, formNumber, content } = params;

  const HARISCO_LOGO_URL = new URL('../assets/harisco-logo.png', import.meta.url).href;

  const values: Record<string, string> = {
    '{COMPANY_NAME}': COMPANY_NAME,
    '{DOCUMENT_TITLE}': content.title,
    '{DocumentTitle}': content.title,
    '{documentTitle}': content.title,
    '{APPENDIX}': appendixNumber,
    '{DOC_NUMBER}': formNumber,
    '{REVISION}': revision,
    '{documentRevision}': revision,
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

    console.log(`[WordGenerator] replaceAcrossRuns: ${nodes.length} nodes, combined text length: ${combinedText.length}`);
    console.log(`[WordGenerator] combined text sample:`, combinedText.substring(0, 500));

    const matches: Array<{ start: number; end: number; replacement: string; placeholder: string }> = [];
    for (const [placeholder, replacement] of Object.entries(values)) {
      const regex = new RegExp(placeholder, 'g');
      let match: RegExpExecArray | null;
      while ((match = regex.exec(combinedText)) !== null) {
        matches.push({ start: match.index, end: match.index + placeholder.length, replacement, placeholder });
        console.log(`[WordGenerator] Found placeholder '${placeholder}' at position ${match.index}`);
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

  // Resolve the template asset URL
  const templateUrl = new URL('../assets/word-new-template.docx', import.meta.url).href;
  console.log(`[WordGenerator] Template URL: ${templateUrl}`);

  const response = await fetch(templateUrl);
  if (!response.ok) {
    throw new Error(`Failed to load Word template: ${response.statusText}`);
  }
  const templateBuffer = await response.arrayBuffer();

  // Load the docx as a zip
  const zip = await JSZip.loadAsync(templateBuffer);

  const xmlFiles: string[] = [];
  zip.forEach((relativePath, file) => {
    if (!file.dir && file.name.endsWith('.xml')) {
      xmlFiles.push(relativePath);
    }
  });
  console.log(`[WordGenerator] XML files found:`, xmlFiles);

  // Replace placeholders in every XML file inside the docx
  const promises: Promise<void>[] = [];
  zip.forEach((relativePath, file) => {
    if (file.dir || !file.name.endsWith('.xml')) return;
    promises.push(
      file.async('text').then((xmlContent) => {
        console.log(`[WordGenerator] Processing ${relativePath}, length: ${xmlContent.length}`);
        let newContent = replaceWithinNodes(xmlContent);
        // Second pass: handle cross-run placeholders
        newContent = replaceAcrossRuns(newContent);
        zip.file(relativePath, newContent);
        console.log(`[WordGenerator] Finished ${relativePath}`);
      })
    );
  });
  await Promise.all(promises);

  // Package the modified zip back into a docx
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
