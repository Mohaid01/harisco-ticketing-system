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
}

/**
 * Generates a Word (.docx) document using the sample-word.docx template as the base.
 * Placeholders in the template XML are replaced with actual values:
 *   {documentTitle}, {documentNumber}, {revision}, {entity}, {department},
 *   {docType}, {date}, {description}
 * The template's exact formatting (table borders, fonts, margins, logo, header/footer) is preserved.
 */
export const generateDocumentWord = async (params: GenerateWordParams): Promise<Uint8Array> => {
  const { documentId, revision, entityCode, departmentCode, docTypeCode, docDate, title, content } = params;

  const replacements: Record<string, string> = {
    '{documentTitle}': title,
    '{documentNumber}': documentId,
    '{revision}': revision,
    '{entity}': entityCode,
    '{department}': departmentCode,
    '{docType}': docTypeCode,
    '{date}': docDate,
    '{description}': content.description || '',
  };

  // Resolve the template asset URL (Vite copies it to dist during build)
  const templateUrl = new URL('../assets/sample-word.docx', import.meta.url).href;

  const response = await fetch(templateUrl);
  if (!response.ok) {
    throw new Error(`Failed to load Word template: ${response.statusText}`);
  }
  const templateBuffer = await response.arrayBuffer();

  // Load the docx as a zip
  const zip = await JSZip.loadAsync(templateBuffer);

  // Replace placeholders in every XML file inside the docx
  const promises: Promise<void>[] = [];
  zip.forEach((relativePath, file) => {
    if (file.dir || !file.name.endsWith('.xml')) return;
    promises.push(
      file.async('text').then((xmlContent) => {
        let newContent = xmlContent;
        for (const [placeholder, value] of Object.entries(replacements)) {
          newContent = newContent.replace(new RegExp(placeholder, 'g'), value);
        }
        zip.file(relativePath, newContent);
      })
    );
  });
  await Promise.all(promises);

  // Package the modified zip back into a docx (uint8array for browser)
  const newBuffer = await zip.generateAsync({ type: 'uint8array' });
  return newBuffer;
};

export const downloadWordBlob = (buffer: Uint8Array, fileName: string) => {
  const blob = new Blob([buffer as any], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileName}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
