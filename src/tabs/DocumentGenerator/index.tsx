import React, { useState } from 'react';

import type { DocumentGeneratorProps, GeneratedDocumentRecord } from './types';

import ScreenAccessManager from '../../components/ScreenAccessManager';
import { CorporateSchemeSelector } from './components/CorporateSchemeSelector';
import { ControlledDocumentForm } from './components/ControlledDocumentForm';
import { SignOffSection } from './components/SignOffSection';
import { DocumentRegistryTable } from './components/DocumentRegistryTable';
import { useDocumentGenerator } from './hooks/useDocumentGenerator';
import { useDocumentRegistry } from './hooks/useDocumentRegistry';
import { downloadExcelBlob, generateDocumentExcel } from './utils/excelGenerator';
import { downloadWordBlob, generateDocumentWord } from './utils/wordGenerator';
import './DocumentGenerator.css';

type SubTab = 'generate' | 'registry' | 'access';

export const DocumentGenerator: React.FC<DocumentGeneratorProps> = ({ currentUser, token, allUsers }) => {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('generate');

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
    submitDocument,
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
    updateRevision,
  } = useDocumentRegistry({ token });

  const isIT = currentUser.role === 'it';

  const handleGenerateExcelAndDownload = async () => {
    const doc = await submitDocument();
    if (!doc) return;

    try {
      const todayIso = doc.docDate || new Date().toISOString().split('T')[0];
      const content = getContentPayload();

      const bytes = await generateDocumentExcel({
        documentId: doc.documentId,
        revision: doc.revision,
        entityCode: doc.entityCode,
        departmentCode: doc.departmentCode,
        docTypeCode: doc.docTypeCode,
        docDate: todayIso,
        title: doc.title,
        content,
        preparedByName: signOff.preparedByName,
        checkedByName: signOff.checkedByName,
        approvedByName: signOff.approvedByName,
      });

      downloadExcelBlob(bytes, doc.documentId);
      refreshDocuments();
    } catch (err) {
      console.error('Failed to build Excel after registering:', err);
    }
  };

  const handleGenerateWordAndDownload = async () => {
    const doc = await submitDocument();
    if (!doc) return;

    try {
      const todayIso = doc.docDate || new Date().toISOString().split('T')[0];
      const content = getContentPayload();

      const bytes = await generateDocumentWord({
        documentId: doc.documentId,
        revision: doc.revision,
        entityCode: doc.entityCode,
        departmentCode: doc.departmentCode,
        docTypeCode: doc.docTypeCode,
        docDate: todayIso,
        title: doc.title,
        content,
      });

      downloadWordBlob(bytes, doc.documentId);
      refreshDocuments();
    } catch (err) {
      console.error('Failed to build Word after registering:', err);
    }
  };

  const handleDownloadExcelFromRegistry = async (record: GeneratedDocumentRecord) => {
    try {
      let parsedContent: { title: string; description: string } = { title: '', description: '' };
      try {
        if (record.content_json) {
          const parsed = JSON.parse(record.content_json) as { title?: string; description?: string };
          parsedContent = {
            title: parsed.title ?? record.title,
            description: parsed.description ?? '',
          };
        } else {
          parsedContent = { title: record.title, description: '' };
        }
      } catch {
        parsedContent = { title: record.title, description: '' };
      }

      const bytes = await generateDocumentExcel({
        documentId: record.document_id,
        revision: record.revision,
        entityCode: record.entity_code,
        departmentCode: record.department_code,
        docTypeCode: record.doc_type_code,
        docDate: record.doc_date,
        title: record.title,
        content: parsedContent,
        preparedByName: record.prepared_by_name,
        checkedByName: record.checked_by_name || '',
        approvedByName: record.approved_by_name || '',
      });

      downloadExcelBlob(bytes, record.document_id);
    } catch (err) {
      console.error('Failed to download existing document Excel:', err);
    }
  };

  const handleDownloadWordFromRegistry = async (record: GeneratedDocumentRecord) => {
    try {
      let parsedContent: { title: string; description: string } = { title: '', description: '' };
      try {
        if (record.content_json) {
          const parsed = JSON.parse(record.content_json) as { title?: string; description?: string };
          parsedContent = {
            title: parsed.title ?? record.title,
            description: parsed.description ?? '',
          };
        } else {
          parsedContent = { title: record.title, description: '' };
        }
      } catch {
        parsedContent = { title: record.title, description: '' };
      }

      const bytes = await generateDocumentWord({
        documentId: record.document_id,
        revision: record.revision,
        entityCode: record.entity_code,
        departmentCode: record.department_code,
        docTypeCode: record.doc_type_code,
        docDate: record.doc_date,
        title: record.title,
        content: parsedContent,
      });

      downloadWordBlob(bytes, record.document_id);
    } catch (err) {
      console.error('Failed to download existing document Word:', err);
    }
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
          <button
            type="button"
            className={`docgen-tab-btn ${activeSubTab === 'generate' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('generate')}
          >
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

      {activeSubTab === 'generate' && (
        <>
          <CorporateSchemeSelector
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
          />

          <ControlledDocumentForm data={controlledData} onChange={setControlledData} />

          <SignOffSection signOff={signOff} setSignOff={setSignOff} allUsers={allUsers} />

          <div className="docgen-actions">
            <div>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Target Document ID:{' '}
                <strong style={{ fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>
                  {previewId || 'HC-01-COR-LE-0001'}
                </strong>{' '}
                ({revision})
              </span>
            </div>
            <div className="docgen-actions-right">
              <button
                type="button"
                className="docgen-btn docgen-btn-secondary"
                onClick={handleGenerateExcelAndDownload}
                disabled={isSubmitting}
              >
                Download Excel
              </button>
              <button
                type="button"
                className="docgen-btn docgen-btn-primary"
                onClick={handleGenerateWordAndDownload}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Registering...' : 'Download Word'}
              </button>
            </div>
          </div>
        </>
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
          onDownloadExcel={handleDownloadExcelFromRegistry}
          onDownloadWord={handleDownloadWordFromRegistry}
          onUpdateRevision={updateRevision}
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
    </div>
  );
};
