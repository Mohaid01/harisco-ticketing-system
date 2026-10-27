import crypto from 'crypto';
import { Router } from 'express';

import type { ApiAuthRequest, AuthRequest } from '../types/index.ts';

import {
  DEPARTMENTS,
  DOC_PREFIX,
  DOCUMENT_TYPES,
  ENTITIES,
} from '../constants/documentGenerator.ts';
import { getDb } from '../db.ts';
import { authenticateToken } from '../middleware/auth.ts';
import logger from '../utils/logger.ts';

const router = Router();
const SCREEN_NAME = 'document_generator';

const checkAccess = async (userId: string, role: string): Promise<boolean> => {
  if (role === 'it') return true;
  const db = getDb();
  const override = await db.get(
    `SELECT so.user_id FROM screen_overrides so
     JOIN users u ON so.user_id = u.id
     WHERE so.screen_name = ? AND so.user_id = ? AND u.is_active = 1`,
    [SCREEN_NAME, userId]
  );
  return !!override;
};

router.get('/options', authenticateToken, async (req: AuthRequest, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized.' });

  const hasAccess = await checkAccess(user.id, user.role);
  if (!hasAccess) return res.status(403).json({ error: 'Access denied to Document Generator.' });

  res.json({
    entities: ENTITIES,
    departments: DEPARTMENTS,
    documentTypes: DOCUMENT_TYPES,
    prefix: DOC_PREFIX,
  });
});

router.get('/preview-id', authenticateToken, async (req: AuthRequest, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized.' });

  const hasAccess = await checkAccess(user.id, user.role);
  if (!hasAccess) return res.status(403).json({ error: 'Access denied.' });

  const entity = String(req.query.entity || '').trim();
  const department = String(req.query.department || '').trim().toUpperCase();
  const docType = String(req.query.docType || '').trim().toUpperCase();

  if (!entity || !department || !docType) {
    return res.status(400).json({ error: 'Missing required parameters: entity, department, docType.' });
  }

  try {
    const db = getDb();
    const row = await db.get<{ last_sequence: number }>(
      `SELECT last_sequence FROM document_sequences
       WHERE entity_code = ? AND department_code = ? AND doc_type_code = ?`,
      [entity, department, docType]
    );

    const nextSeq = (row?.last_sequence ?? 0) + 1;
    const paddedSeq = String(nextSeq).padStart(4, '0');
    const documentId = `${DOC_PREFIX}-${entity}-${department}-${docType}-${paddedSeq}`;

    res.json({
      documentId,
      sequenceNumber: nextSeq,
    });
  } catch (err) {
    logger.error('[docgen] Failed to preview document ID:', err);
    res.status(500).json({ error: 'Failed to preview document ID.' });
  }
});

interface GenerateRequestBody {
  entityCode: string;
  departmentCode: string;
  docTypeCode: string;
  year?: string;
  revision?: string;
  title: string;
  preparedByName: string;
  checkedByName?: string;
  approvedByName?: string;
  docDate: string;
  contentJson?: string;
}

router.post('/generate', authenticateToken, async (req: ApiAuthRequest<GenerateRequestBody>, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized.' });


  const hasAccess = await checkAccess(user.id, user.role);
  if (!hasAccess) return res.status(403).json({ error: 'Access denied.' });

  logger.info("CHECKPOINT 1");

  const {
    entityCode,
    departmentCode,
    docTypeCode,
    title,
    preparedByName,
    checkedByName,
    approvedByName,
    docDate,
    contentJson,
  } = req.body;

  const revision = (req.body.revision || 'Rev 00').trim();
  const currentYear = new Date().getFullYear().toString().slice(-2);
  const year = (req.body.year || currentYear).trim();

  if (!entityCode || !departmentCode || !docTypeCode || !title?.trim()) {
    return res.status(400).json({ error: 'Missing required fields: entityCode, departmentCode, docTypeCode, title.' });
  }

  const db = getDb();

  try {
    await db.exec('BEGIN IMMEDIATE');

    logger.info("CHECKPOINT 2");

    let seqRow = await db.get<{ last_sequence: number }>(
      `SELECT last_sequence FROM document_sequences
       WHERE entity_code = ? AND department_code = ? AND doc_type_code = ?`,
      [entityCode, departmentCode, docTypeCode]
    );

    logger.info("CHECKPOINT 3");


    let nextSeq = 1;
    const nowIso = new Date().toISOString();

    if (seqRow) {
      nextSeq = seqRow.last_sequence + 1;
      await db.run(
        `UPDATE document_sequences
         SET last_sequence = ?, updated_at = ?
         WHERE entity_code = ? AND department_code = ? AND doc_type_code = ? AND year = ?`,
        [nextSeq, nowIso, entityCode, departmentCode, docTypeCode, year]
      );
    } else {
      await db.run(
        `INSERT INTO document_sequences (entity_code, department_code, doc_type_code, year, last_sequence, updated_at)
         VALUES (?, ?, ?, ?, 1, ?)`,
        [entityCode, departmentCode, docTypeCode, year, nowIso]
      );
    }

    logger.info("CHECKPOINT 4");

    const paddedSeq = String(nextSeq).padStart(4, '0');
    const documentId = `${DOC_PREFIX}-${entityCode}-${departmentCode}-${docTypeCode}-${paddedSeq}`;
    const docUuid = crypto.randomUUID();
    const fileName = `${documentId}.pdf`;

    await db.run(
      `INSERT INTO generated_documents (
        id, document_id, entity_code, department_code, doc_type_code, year,
        sequence_number, revision, title, prepared_by_id, prepared_by_name,
        checked_by_name, approved_by_name, doc_date, content_json, file_name,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        docUuid,
        documentId,
        entityCode,
        departmentCode,
        docTypeCode,
        year,
        nextSeq,
        revision,
        title.trim(),
        user.id,
        preparedByName?.trim() || user.name,
        checkedByName?.trim() || null,
        approvedByName?.trim() || null,
        docDate || nowIso.split('T')[0],
        contentJson || null,
        fileName,
        nowIso,
        nowIso,
      ]
    );

    logger.info("CHECKPOINT 5");


    await db.exec('COMMIT');

    logger.info(`[docgen] Generated document ${documentId} by user ${user.username || user.name}`);

    return res.status(201).json({
      success: true,
      document: {
        id: docUuid,
        documentId,
        entityCode,
        departmentCode,
        docTypeCode,
        year,
        sequenceNumber: nextSeq,
        revision,
        title: title.trim(),
        preparedByName: preparedByName?.trim() || user.name,
        checkedByName: checkedByName?.trim() || null,
        approvedByName: approvedByName?.trim() || null,
        docDate: docDate || nowIso.split('T')[0],
        fileName,
        createdAt: nowIso,
      },
    });
  } catch (err) {
    await db.exec('ROLLBACK').catch(() => { });
    logger.error('[docgen] Error generating document:', err);
    return res.status(500).json({ error: 'Failed to generate document.' });
  }
});

router.get('/documents', authenticateToken, async (req: AuthRequest, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized.' });

  const hasAccess = await checkAccess(user.id, user.role);
  if (!hasAccess) return res.status(403).json({ error: 'Access denied.' });

  const entity = req.query.entity ? String(req.query.entity).trim() : null;
  const department = req.query.department ? String(req.query.department).trim().toUpperCase() : null;
  const docType = req.query.docType ? String(req.query.docType).trim().toUpperCase() : null;
  const year = req.query.year ? String(req.query.year).trim() : null;
  const search = req.query.search ? String(req.query.search).trim() : null;

  try {
    const db = getDb();
    let query = `SELECT * FROM generated_documents WHERE 1=1`;
    const params: (string | number)[] = [];

    if (entity) {
      query += ` AND entity_code = ?`;
      params.push(entity);
    }
    if (department) {
      query += ` AND department_code = ?`;
      params.push(department);
    }
    if (docType) {
      query += ` AND doc_type_code = ?`;
      params.push(docType);
    }
    if (year) {
      query += ` AND year = ?`;
      params.push(year);
    }
    if (search) {
      query += ` AND (document_id LIKE ? OR title LIKE ? OR prepared_by_name LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY created_at DESC LIMIT 200`;

    const documents = await db.all(query, params);
    res.json({ documents });
  } catch (err) {
    logger.error('[docgen] Failed to fetch documents:', err);
    res.status(500).json({ error: 'Failed to fetch documents.' });
  }
});

router.get('/documents/:id', authenticateToken, async (req: AuthRequest, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized.' });

  const hasAccess = await checkAccess(user.id, user.role);
  if (!hasAccess) return res.status(403).json({ error: 'Access denied.' });

  const docId = String(req.params.id);

  try {
    const db = getDb();
    const doc = await db.get(
      `SELECT * FROM generated_documents WHERE id = ? OR document_id = ?`,
      [docId, docId]
    );

    if (!doc) return res.status(404).json({ error: 'Document not found.' });

    res.json(doc);
  } catch (err) {
    logger.error('[docgen] Failed to fetch document:', err);
    res.status(500).json({ error: 'Failed to fetch document.' });
  }
});

router.post('/documents/:id/revision', authenticateToken, async (req: AuthRequest, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized.' });

  const hasAccess = await checkAccess(user.id, user.role);
  if (!hasAccess) return res.status(403).json({ error: 'Access denied.' });

  const docId = String(req.params.id);
  const newRevision = req.body?.revision ? String(req.body.revision).trim() : null;

  if (!newRevision) {
    return res.status(400).json({ error: 'New revision identifier is required.' });
  }

  try {
    const db = getDb();
    const existing = await db.get<{
      id: string;
      document_id: string;
      revision: string;
    }>(`SELECT id, document_id, revision FROM generated_documents WHERE id = ? OR document_id = ?`, [docId, docId]);

    if (!existing) return res.status(404).json({ error: 'Document not found.' });

    const nowIso = new Date().toISOString();
    await db.run(
      `UPDATE generated_documents SET revision = ?, updated_at = ? WHERE id = ?`,
      [newRevision, nowIso, existing.id]
    );

    logger.info(`[docgen] Document ${existing.document_id} revision updated to ${newRevision} by ${user.name}`);
    res.json({ success: true, documentId: existing.document_id, revision: newRevision });
  } catch (err) {
    logger.error('[docgen] Failed to update revision:', err);
    res.status(500).json({ error: 'Failed to update revision.' });
  }
});

export default router;
