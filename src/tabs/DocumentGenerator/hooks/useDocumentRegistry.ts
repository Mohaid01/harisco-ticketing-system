import { useCallback, useEffect, useState } from 'react';

import type { GeneratedDocumentRecord } from '../types';

interface UseDocumentRegistryProps {
  token: string;
}

export const useDocumentRegistry = ({ token }: UseDocumentRegistryProps) => {
  const [documents, setDocuments] = useState<GeneratedDocumentRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [filterEntity, setFilterEntity] = useState<string>('');
  const [filterDepartment, setFilterDepartment] = useState<string>('');
  const [filterDocType, setFilterDocType] = useState<string>('');
  const [filterYear, setFilterYear] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (filterEntity) queryParams.set('entity', filterEntity);
      if (filterDepartment) queryParams.set('department', filterDepartment);
      if (filterDocType) queryParams.set('docType', filterDocType);
      if (filterYear) queryParams.set('year', filterYear);
      if (searchQuery.trim()) queryParams.set('search', searchQuery.trim());

      const res = await fetch(`/api/document-generator/documents?${queryParams.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error('Failed to fetch document registry');
      }

      const data = await res.json();
      setDocuments(data.documents || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error fetching registry');
    } finally {
      setLoading(false);
    }
  }, [filterEntity, filterDepartment, filterDocType, filterYear, searchQuery, token]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const updateRevision = async (documentId: string, newRevision: string) => {
    try {
      const res = await fetch(`/api/document-generator/documents/${encodeURIComponent(documentId)}/revision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ revision: newRevision }),
      });

      if (!res.ok) {
        throw new Error('Failed to update revision');
      }

      await fetchDocuments();
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  return {
    documents,
    loading,
    error,
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
    refreshDocuments: fetchDocuments,
    updateRevision,
  };
};
