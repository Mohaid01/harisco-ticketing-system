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

      downloadWordBlob(bytes, doc.documentId);
      refreshDocuments();
      setNewDocumentOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error generating Word document';
      alert('Word generation failed: ' + msg);
      console.error('Failed to build Word after registering:', err);
    }
  };

  const handleDownloadWordFromRegistry = async (record: GeneratedDocumentRecord) => {
    try {
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

      const bytes = await generateDocumentWord({
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

      downloadWordBlob(bytes, record.document_id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error generating Word document';
      alert('Word generation failed: ' + msg);
      console.error('Failed to download existing document Word:', err);
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
          onDownloadWord={handleDownloadWordFromRegistry}
          onViewDocument={handleViewDocument}
          token={token}
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
        />
      )}
    </div>
  );
};
