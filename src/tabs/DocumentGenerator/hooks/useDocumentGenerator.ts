import { useCallback, useEffect, useState } from 'react';

import type { AppUser } from '../../../types';
import type { ControlledDocumentData, DocumentSignOff } from '../types';

import { DOC_PREFIX } from '../constants';

interface UseDocumentGeneratorProps {
  currentUser: AppUser;
  token: string;
}

export const useDocumentGenerator = ({ currentUser, token }: UseDocumentGeneratorProps) => {
  const currentYear = new Date().getFullYear().toString().slice(-2);
  const todayIso = new Date().toISOString().split('T')[0];

  const [entityCode, setEntityCode] = useState<string>('01');
  const [departmentCode, setDepartmentCode] = useState<string>('COR');
  const [docTypeCode, setDocTypeCode] = useState<string>('LE');
  const [year, setYear] = useState<string>(currentYear);
  const [revision, setRevision] = useState<string>('Rev 00');

  const [previewId, setPreviewId] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);

  const [docTitle, setDocTitle] = useState<string>('');

  const [signOff, setSignOff] = useState<DocumentSignOff>({
    preparedByName: currentUser.name,
    checkedByName: '',
    approvedByName: '',
  });

  // Single controlled content shared by all document types.
  const [controlledData, setControlledData] = useState<ControlledDocumentData>({
    title: '',
    description: '',
  });
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{
    documentId: string;
    fileName: string;
  } | null>(null);

  useEffect(() => {
    let isCancelled = false;
    const fetchPreview = async () => {
      if (!entityCode || !departmentCode || !docTypeCode) return;
      setPreviewLoading(true);
      try {
        const res = await fetch(
          `/api/document-generator/preview-id?entity=${encodeURIComponent(entityCode)}&department=${encodeURIComponent(
            departmentCode
          )}&docType=${encodeURIComponent(docTypeCode)}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (res.ok && !isCancelled) {
          const data = await res.json();
          setPreviewId(data.documentId);
        }
      } catch {
        if (!isCancelled) {
          setPreviewId(`${DOC_PREFIX}-${entityCode}-${departmentCode}-${docTypeCode}-0001`);
        }
      } finally {
        if (!isCancelled) setPreviewLoading(false);
      }
    };

    fetchPreview();
    return () => {
      isCancelled = true;
    };
  }, [entityCode, departmentCode, docTypeCode, year, token]);

  const getEffectiveTitle = useCallback((): string => {
    return docTitle.trim() || 'Controlled Corporate Document';
  }, [docTitle]);

  const getContentPayload = useCallback((): ControlledDocumentData => {
    return controlledData;
  }, [controlledData]);

  const submitDocument = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessInfo(null);

    const title = getEffectiveTitle();
    const content = getContentPayload();

    try {
      const res = await fetch('/api/document-generator/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          entityCode,
          departmentCode,
          docTypeCode,
          year,
          revision,
          title,
          preparedByName: signOff.preparedByName,
          checkedByName: signOff.checkedByName,
          approvedByName: signOff.approvedByName,
          docDate: todayIso,
          contentJson: JSON.stringify(content),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to generate document');
      }

      const data = await res.json();
      setSuccessInfo({
        documentId: data.document.documentId,
        fileName: data.document.fileName,
      });

      return data.document;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred';
      setErrorMessage(msg);
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    entityCode,
    setEntityCode,
    departmentCode,
    setDepartmentCode,
    docTypeCode,
    setDocTypeCode,
    year,
    setYear,
    revision,
    setRevision,
    previewId,
    previewLoading,
    docTitle,
    setDocTitle,
    signOff,
    setSignOff,
    controlledData,
    setControlledData,
    isSubmitting,
    errorMessage,
    successInfo,
    getEffectiveTitle,
    getContentPayload,
    submitDocument,
  };
};
