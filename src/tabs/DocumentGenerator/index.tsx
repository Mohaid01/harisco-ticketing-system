import React, { useState } from 'react';

import type { DocumentGeneratorProps, GeneratedDocumentRecord } from './types';

import ScreenAccessManager from '../../components/ScreenAccessManager';
import { DocumentDetailModal } from './components/DocumentDetailModal';
import { DocumentRegistryTable } from './components/DocumentRegistryTable';
import { NewDocumentModal } from './components/NewDocumentModal';
import { useDocumentGenerator } from './hooks/useDocumentGenerator';
import { useDocumentRegistry } from './hooks/useDocumentRegistry';
import { downloadWordBlob, generateDocumentWord, type DocumentVersion } from './utils/wordGenerator';
import './DocumentGenerator.css';

type SubTab = 'registry' | 'access';

const triggerBlobDownload = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Download the newest stored revision file (one that was uploaded and merged
 * server-side, preserving page-2+ content). Returns true if a stored file was
 * served, false when there is none (caller should regenerate from template).
 */
const tryDownloadStoredVersion = async (
  docId: string,
  versions: DocumentVersion[],
  documentNo: string,
  token: string
): Promise<boolean> => {
  const latestStored = [...versions].reverse().find((v) => v.file_path && v.file_path.trim() !== '');
  if (!latestStored) return false;
  try {
    const res = await fetch(`/api/document-generator/documents/${docId}/versions/${latestStored.id}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return false;
    const blob = await res.blob();
    const safeRev = (latestStored.revision || '').trim() || 'Rev 00';
    triggerBlobDownload(blob, `${documentNo} - ${safeRev}.docx`);
    return true;
  } catch {
    return false;
  }
};

export const DocumentGenerator: React.FC<DocumentGeneratorProps> = ({ currentUser, token, allUsers }) => {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('registry');
  const [newDocumentOpen, setNewDocumentOpen] = useState<boolean>(false);
  const [detailDocId, setDetailDocId] = useState<string | null>(null);

  const {
    entityCode,
    setEntityCode,
    departmentCode,
    setDepartmentCode,
    docTypeCode,
    setDocTypeCode,
    revision,
    setRevision,
    previewId,
    signOff,
    setSignOff,
    controlledData,
    setControlledData,
    isSubmitting,
    errorMessage,
    successInfo,
    getContentPayload,
    saveDraft,
    downloadDocument,
  } = useDocumentGenerator({ currentUser, token });

  const {
    documents,
    loading: registryLoading,
    filterEntity,
    setFilterEntity,
    filterDepartment,
    setFilterDepartment,
    filterDocType,
    setFilterDocType,
    filterYear,
    setFilterYear,
    searchQuery,
    setSearchQuery,
    refreshDocuments,
  } = useDocumentRegistry({ token });

  const isIT = currentUser.role === 'it';

  const handleSaveDraft = async () => {
    const doc = await saveDraft();
    if (!doc) return;
    refreshDocuments();
    setNewDocumentOpen(false);
  };

  const handleDownload = async () => {
    const doc = await downloadDocument();
    if (!doc) return;

    try {
      const todayIso = doc.docDate || new Date().toISOString().split('T')[0];
      const content = getContentPayload();

      // Fetch revision versions for the revision table in Word
      let versions: DocumentVersion[] = [];
      try {
        const res = await fetch(`/api/document-generator/documents/${doc.id}/versions`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          versions = (data.versions || []) as DocumentVersion[];
        }
      } catch {
        versions = [];
      }

      // Prefer the stored (uploaded + merged) file so page-2+ content is preserved.
      const servedStored = await tryDownloadStoredVersion(doc.id, versions, doc.documentId, token);
      if (servedStored) {
        refreshDocuments();
        setNewDocumentOpen(false);
        return;
      }

      const bytes = await generateDocumentWord({
        documentId: doc.documentId,
        revision: doc.revision,
        entityCode: doc.entityCode,
        departmentCode: doc.departmentCode,
        docTypeCode: doc.docTypeCode,
        docDate: todayIso,
        title: doc.title,
        content,
        appendixNumber: content.appendixNumber,
        formNumber: content.formNumber,
        signOff: signOff,
        versions,
      });

      downloadWordBlob(bytes, `${doc.documentId} - ${doc.revision}`);
      refreshDocuments();
      setNewDocumentOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error generating Word document';
      alert('Word generation failed: ' + msg);
      console.error('Failed to build Word after registering:', err);
    }
  };

  const buildTemplateBytes = async (record: GeneratedDocumentRecord, versions: DocumentVersion[]) => {
    let parsedContent: { title: string; description: string; appendixNumber: string; formNumber: string } = {
      title: '',
      description: '',
      appendixNumber: '',
      formNumber: '',
    };
    try {
      if (record.content_json) {
        const parsed = JSON.parse(record.content_json) as {
          title?: string;
          description?: string;
          appendixNumber?: string;
          formNumber?: string;
        };
        parsedContent = {
          title: parsed.title ?? record.title,
          description: parsed.description ?? '',
          appendixNumber: parsed.appendixNumber ?? '',
          formNumber: parsed.formNumber ?? '',
        };
      } else {
        parsedContent = { title: record.title, description: '', appendixNumber: '', formNumber: '' };
      }
    } catch {
      parsedContent = { title: record.title, description: '', appendixNumber: '', formNumber: '' };
    }

    return generateDocumentWord({
      documentId: record.document_id,
      revision: record.revision,
      entityCode: record.entity_code,
      departmentCode: record.department_code,
      docTypeCode: record.doc_type_code,
      docDate: record.doc_date,
      title: record.title,
      appendixNumber: parsedContent.appendixNumber,
      formNumber: parsedContent.formNumber,
      content: parsedContent,
      signOff: {
        preparedByName: record.prepared_by_name,
        checkedByName: record.checked_by_name || '',
        approvedByName: record.approved_by_name || '',
        preparedByDate: record.prepared_by_date || '',
        checkedByDate: record.checked_by_date || '',
        approvedByDate: record.approved_by_date || '',
      },
      versions,
    });
  };

  const handleDownloadWordFromRegistry = async (record: GeneratedDocumentRecord) => {
    try {
      // Fetch revision versions for the revision table in Word
      let versions: DocumentVersion[] = [];
      try {
        const res = await fetch(`/api/document-generator/documents/${record.id}/versions`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          versions = (data.versions || []) as DocumentVersion[];
        }
      } catch {
        versions = [];
      }

      // Prefer the stored (uploaded + merged) file so page-2+ content is preserved.
      const servedStored = await tryDownloadStoredVersion(record.id, versions, record.document_id, token);
      if (servedStored) return;

      const bytes = await buildTemplateBytes(record, versions);
      downloadWordBlob(bytes, `${record.document_id} - ${record.revision}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error generating Word document';
      alert('Word generation failed: ' + msg);
      console.error('Failed to download existing document Word:', err);
    }
  };

  const handleDownloadVersion = async (record: GeneratedDocumentRecord, version: DocumentVersion) => {
    try {
      const safeRev = (version.revision || '').trim() || record.revision;
      if (version.file_path && version.file_path.trim() !== '') {
        const res = await fetch(`/api/document-generator/documents/${record.id}/versions/${version.id}/download`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to download revision file.');
        const blob = await res.blob();
        triggerBlobDownload(blob, `${record.document_id} - ${safeRev}.docx`);
        return;
      }
      // No stored file (e.g. the draft): regenerate from template with this revision only.
      const bytes = await buildTemplateBytes(record, []);
      downloadWordBlob(bytes, `${record.document_id} - ${safeRev}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error downloading revision';
      alert('Download failed: ' + msg);
      console.error('Failed to download revision:', err);
    }
  };

  const handleCloseModal = () => {
    setNewDocumentOpen(false);
  };

  const handleViewDocument = (doc: GeneratedDocumentRecord) => {
    setDetailDocId(doc.id);
  };

  return (
    <div className="docgen-container">
      <div className="docgen-header">
        <div>
          <h2 className="docgen-title">Corporate Document Generator</h2>
          <p className="docgen-subtitle">
            Enforce Haris &amp; Co. numbering standards, official letterheads, and master registry.
          </p>
        </div>

        <div className="docgen-tabs">
          <button type="button" className="docgen-btn docgen-btn-secondary" onClick={() => setNewDocumentOpen(true)}>
            New Document
          </button>
          <button
            type="button"
            className={`docgen-tab-btn ${activeSubTab === 'registry' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('registry')}
          >
            Document Registry
          </button>
          {isIT && (
            <button
              type="button"
              className={`docgen-tab-btn ${activeSubTab === 'access' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('access')}
            >
              Screen Access
            </button>
          )}
        </div>
      </div>

      {errorMessage && <div className="docgen-alert-error">{errorMessage}</div>}
      {successInfo && (
        <div className="docgen-alert-success">
          <span>Document {successInfo.documentId} registered and generated successfully.</span>
        </div>
      )}

      {activeSubTab === 'registry' && (
        <DocumentRegistryTable
          documents={documents}
          loading={registryLoading}
          filterEntity={filterEntity}
          setFilterEntity={setFilterEntity}
          filterDepartment={filterDepartment}
          setFilterDepartment={setFilterDepartment}
          filterDocType={filterDocType}
          setFilterDocType={setFilterDocType}
          filterYear={filterYear}
          setFilterYear={setFilterYear}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onRefresh={refreshDocuments}
          onViewDocument={handleViewDocument}
          token={token}
          currentUserName={currentUser.name}
          allUsers={allUsers}
        />
      )}

      {activeSubTab === 'access' && isIT && (
        <ScreenAccessManager
          screenName="document_generator"
          screenLabel="Document Generator"
          users={allUsers}
          currentUser={currentUser}
          token={token}
        />
      )}

      {newDocumentOpen && (
        <NewDocumentModal
          isOpen={newDocumentOpen}
          onClose={handleCloseModal}
          allUsers={allUsers}
          entityCode={entityCode}
          setEntityCode={setEntityCode}
          departmentCode={departmentCode}
          setDepartmentCode={setDepartmentCode}
          docTypeCode={docTypeCode}
          setDocTypeCode={setDocTypeCode}
          revision={revision}
          setRevision={setRevision}
          previewId={previewId}
          previewLoading={false}
          signOff={signOff}
          setSignOff={setSignOff}
          controlledData={controlledData}
          setControlledData={setControlledData}
          isSubmitting={isSubmitting}
          onSaveDraft={handleSaveDraft}
          onDownload={handleDownload}
        />
      )}

      {detailDocId && (
        <DocumentDetailModal
          key={detailDocId}
          isOpen={!!detailDocId}
          onClose={() => setDetailDocId(null)}
          document={documents.find((d) => d.id === detailDocId) || null}
          token={token}
          onDownloadLatest={handleDownloadWordFromRegistry}
          onDownloadVersion={handleDownloadVersion}
        />
      )}
    </div>
  );
};
