import { Response, Router } from 'express';

import type {
  AddAdminCommentRequestBody,
  AddAdminCommentResponse,
  AdminTicketResponse,
  AdminTicketsResponse,
  ApiAuthRequest,
  ApiResponse,
  AuthRequest,
  CreateAdminTicketRequestBody,
  CreateAdminTicketResponse,
  DbAdminActivityLog,
  DbAdminComment,
  DbAdminTicket,
  DeleteAdminTicketResponse,
  RevertAdminTicketStatusResponse,
  UpdateAdminTicketRequestBody,
  UpdateAdminTicketResponse,
  UpdateAdminTicketStatusRequestBody,
  UpdateAdminTicketStatusResponse,
} from '../types/index.ts';

import { getDb } from '../db.ts';
import { authenticateToken } from '../middleware/auth.ts';
import { sseClients } from '../middleware/sse.ts';
import logger from '../utils/logger.ts';

const router = Router();

// GET /api/admin-tickets/stream
router.get('/stream', authenticateToken, (req: AuthRequest, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  sseClients.add(res, req.user?.id);
});

// GET /api/admin-tickets
router.get('/', authenticateToken, async (req: AuthRequest, res: ApiResponse<AdminTicketsResponse>) => {
  try {
    const db = getDb();
    const currentUser = req.user;

    if (!currentUser) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    let query = 'SELECT *, executiveId, executiveName, previousStatus FROM admin_tickets';
    const params: (string | undefined)[] = [];

    if (currentUser.role === 'employee') {
      query += ' WHERE reporterId = ?';
      params.push(currentUser.id);
    }

    query += ' ORDER BY createdAt DESC';

    const tickets = await db.all<DbAdminTicket[]>(query, params);

    if (tickets.length === 0) {
      return res.json([]);
    }

    const ticketIds = tickets.map((t) => t.id);
    const placeholders = ticketIds.map(() => '?').join(',');

    const queryText = [
      'SELECT * FROM admin_comments',
      'WHERE ticketId IN (' + placeholders + ')',
      'ORDER BY createdAt ASC',
    ].join(' ');

    const comments = await db.all<DbAdminComment[]>(queryText, ticketIds);

    const logQueryText = [
      'SELECT * FROM admin_activity_logs',
      'WHERE ticketId IN (' + placeholders + ')',
      'ORDER BY timestamp ASC',
    ].join(' ');

    const logs = await db.all<DbAdminActivityLog[]>(logQueryText, ticketIds);

    const ticketsMap: AdminTicketResponse[] = tickets.map((ticket) => ({
      ...ticket,
      comments: comments.filter((c) => c.ticketId === ticket.id),
      activityLogs: logs.filter((l) => l.ticketId === ticket.id),
    }));

    return res.json(ticketsMap);
  } catch (error) {
    logger.error('Failed to fetch admin tickets:', error);
    return res.status(500).json({ error: 'Failed to retrieve admin tickets.' });
  }
});

// POST /api/admin-tickets
router.post(
  '/',
  authenticateToken,
  async (req: ApiAuthRequest<CreateAdminTicketRequestBody>, res: ApiResponse<CreateAdminTicketResponse>) => {
    const { description, category } = req.body;
    if (!description || !category) {
      res.status(400).json({ error: 'Description and category are required.' });
      return;
    }

    try {
      const db = getDb();

      const allTickets = await db.all<{ id: string }[]>('SELECT id FROM admin_tickets');
      let maxIndex = 0;
      for (const t of allTickets) {
        const match = t.id.match(/HCIT-ADM-(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxIndex) {
            maxIndex = num;
          }
        }
      }
      const index = maxIndex + 1;
      const ticketId = `HCIT-ADM-${index}`;

      const timestamp = new Date().toISOString();
      const reporterId = req.user?.id || '';
      const reporterName = req.user?.name || '';
      const reporterEmail = req.user?.email || '';

      await db.run(
        `INSERT INTO admin_tickets (
              id, description, category, status, createdAt, updatedAt,
              reporterId, reporterName, reporterEmail
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ticketId,
          description,
          category,
          'awaiting_admin_manager',
          timestamp,
          timestamp,
          reporterId,
          reporterName,
          reporterEmail,
        ]
      );

      const logId = `log-${Date.now()}`;
      await db.run(
        `INSERT INTO admin_activity_logs (
              id, ticketId, action, timestamp, performedByName, performedByRole
            ) VALUES (?, ?, ?, ?, ?, ?)`,
        [logId, ticketId, 'Ticket raised', timestamp, reporterName, req.user?.role || 'employee']
      );

      const response: CreateAdminTicketResponse = {
        id: ticketId,
        description,
        category,
        status: 'awaiting_admin_manager',
        createdAt: timestamp,
        updatedAt: timestamp,
        reporterId,
        reporterName,
        reporterEmail,
        comments: [],
        activityLogs: [
          {
            id: logId,
            ticketId,
            action: 'Ticket raised',
            timestamp,
            performedByName: reporterName,
            performedByRole: req.user?.role || 'employee',
          },
        ],
      };

      sseClients.broadcast(
        `data: ${JSON.stringify({ type: 'admin_ticket_update', action: 'created', data: response })}\n\n`,
        req.user?.id
      );
      res.status(201).json(response);
    } catch (error) {
      logger.error('Failed to create admin ticket:', error);
      res.status(500).json({ error: 'Failed to create admin ticket.' });
    }
  }
);

// POST /api/admin-tickets/:id/status
router.post(
  '/:id/status',
  authenticateToken,
  async (
    req: ApiAuthRequest<UpdateAdminTicketStatusRequestBody>,
    res: ApiResponse<UpdateAdminTicketStatusResponse>
  ) => {
    if (req.user?.role !== 'manager') {
      res.status(403).json({
        error: 'Forbidden. Only Admin Manager can update admin ticket status.',
      });
      return;
    }

    const ticketId = String(req.params.id);
    const { status, actionMessage, executiveId, executiveName } = req.body;

    if (!status || !actionMessage) {
      res.status(400).json({
        error: 'Status and actionMessage are required.',
      });
      return;
    }

    try {
      const db = getDb();

      const ticket = await db.get<DbAdminTicket>('SELECT * FROM admin_tickets WHERE id = ?', [ticketId]);
      if (!ticket) {
        res.status(404).json({ error: 'Admin ticket not found.' });
        return;
      }

      const timestamp = new Date().toISOString();

      if (status === 'awaiting_materials' && ticket.status === 'awaiting_executive') {
        if (!executiveId || !executiveName) {
          res.status(400).json({
            error: 'executiveId and executiveName are required when transitioning from Awaiting Executive.',
          });
          return;
        }

        await db.run(
          'UPDATE admin_tickets SET status = ?, previousStatus = ?, updatedAt = ?, executiveId = ?, executiveName = ? WHERE id = ?',
          [status, ticket.status, timestamp, executiveId, executiveName, ticketId]
        );

        const logId = `log-${Date.now()}`;
        const newLog: DbAdminActivityLog = {
          id: logId,
          ticketId,
          action: `Executive approved by ${executiveName} - Moved to Awaiting Materials`,
          timestamp,
          performedByName: req.user?.name || '',
          performedByRole: req.user?.role || 'manager',
        };

        await db.run(
          `INSERT INTO admin_activity_logs (
                id, ticketId, action, timestamp, performedByName, performedByRole
              ) VALUES (?, ?, ?, ?, ?, ?)`,
          [logId, ticketId, newLog.action, timestamp, newLog.performedByName, newLog.performedByRole]
        );

        const response: UpdateAdminTicketStatusResponse = {
          success: true,
          status,
          previousStatus: ticket.status,
          updatedAt: timestamp,
          executiveId,
          executiveName,
          newLog,
        };

        sseClients.broadcast(
          `data: ${JSON.stringify({ type: 'admin_ticket_update', action: 'status_changed', data: { id: ticketId, ...response } })}\n\n`,
          req.user?.id
        );
        res.json(response);
        return;
      }

      let updateQuery = 'UPDATE admin_tickets SET status = ?, previousStatus = ?, updatedAt = ?';
      const updateParams: (string | undefined)[] = [status, ticket.status, timestamp];

      if (executiveId && executiveName) {
        updateQuery += ', executiveId = ?, executiveName = ?';
        updateParams.push(executiveId, executiveName);
      }

      updateQuery += ' WHERE id = ?';
      updateParams.push(ticketId);

      await db.run(updateQuery, updateParams);

      const logId = `log-${Date.now()}`;
      const newLog: DbAdminActivityLog = {
        id: logId,
        ticketId,
        action: actionMessage,
        timestamp,
        performedByName: req.user?.name || '',
        performedByRole: req.user?.role || 'manager',
      };

      await db.run(
        `INSERT INTO admin_activity_logs (
              id, ticketId, action, timestamp, performedByName, performedByRole
            ) VALUES (?, ?, ?, ?, ?, ?)`,
        [logId, ticketId, actionMessage, timestamp, newLog.performedByName, newLog.performedByRole]
      );

      const response: UpdateAdminTicketStatusResponse = {
        success: true,
        status,
        previousStatus: ticket.status,
        updatedAt: timestamp,
        executiveId: executiveId || undefined,
        executiveName: executiveName || undefined,
        newLog,
      };

      sseClients.broadcast(
        `data: ${JSON.stringify({ type: 'admin_ticket_update', action: 'status_changed', data: { id: ticketId, ...response } })}\n\n`,
        req.user?.id
      );
      res.json(response);
    } catch (error) {
      logger.error('Failed to update admin ticket status:', error);
      res.status(500).json({ error: 'Failed to update admin ticket status.' });
    }
  }
);

// POST /api/admin-tickets/:id/revert-status
router.post(
  '/:id/revert-status',
  authenticateToken,
  async (req: AuthRequest, res: ApiResponse<RevertAdminTicketStatusResponse>) => {
    if (req.user?.role !== 'manager') {
      res.status(403).json({
        error: 'Forbidden. Only Admin Manager can revert admin ticket status.',
      });
      return;
    }

    const ticketId = String(req.params.id);

    try {
      const db = getDb();

      const ticket = await db.get<DbAdminTicket>('SELECT * FROM admin_tickets WHERE id = ?', [ticketId]);
      if (!ticket) {
        res.status(404).json({ error: 'Admin ticket not found.' });
        return;
      }

      if (!ticket.previousStatus) {
        res.status(400).json({
          error: 'Cannot revert: no previous status available. This ticket is already in its initial state.',
        });
        return;
      }

      const timestamp = new Date().toISOString();
      const revertedStatus = ticket.previousStatus;

      await db.run(
        'UPDATE admin_tickets SET status = ?, previousStatus = NULL, updatedAt = ? WHERE id = ?',
        [revertedStatus, timestamp, ticketId]
      );

      const logId = `log-${Date.now()}`;
      const newLog: DbAdminActivityLog = {
        id: logId,
        ticketId,
        action: `Status reverted to ${revertedStatus}`,
        timestamp,
        performedByName: req.user?.name || '',
        performedByRole: req.user?.role || 'manager',
      };

      await db.run(
        `INSERT INTO admin_activity_logs (
              id, ticketId, action, timestamp, performedByName, performedByRole
            ) VALUES (?, ?, ?, ?, ?, ?)`,
        [logId, ticketId, newLog.action, timestamp, newLog.performedByName, newLog.performedByRole]
      );

      const response: RevertAdminTicketStatusResponse = {
        success: true,
        status: revertedStatus,
        previousStatus: null,
        updatedAt: timestamp,
        newLog,
      };

      sseClients.broadcast(
        `data: ${JSON.stringify({ type: 'admin_ticket_update', action: 'status_reverted', data: { id: ticketId, ...response } })}\n\n`,
        req.user?.id
      );
      res.json(response);
    } catch (error) {
      logger.error('Failed to revert admin ticket status:', error);
      res.status(500).json({ error: 'Failed to revert admin ticket status.' });
    }
  }
);

// POST /api/admin-tickets/:id/comments
router.post(
  '/:id/comments',
  authenticateToken,
  async (req: ApiAuthRequest<AddAdminCommentRequestBody>, res: ApiResponse<AddAdminCommentResponse>) => {
    const ticketId = String(req.params.id);
    const { content } = req.body;

    if (!content || !content.trim()) {
      res.status(400).json({ error: 'Comment content cannot be empty.' });
      return;
    }

    try {
      const db = getDb();

      const ticket = await db.get<DbAdminTicket>('SELECT id FROM admin_tickets WHERE id = ?', [ticketId]);
      if (!ticket) {
        res.status(404).json({ error: 'Admin ticket not found.' });
        return;
      }

      const commentId = `c-${Date.now()}`;
      const timestamp = new Date().toISOString();

      await db.run(
        `INSERT INTO admin_comments (
              id, ticketId, authorId, authorName, authorRole, content, createdAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          commentId,
          ticketId,
          req.user?.id || '',
          req.user?.name || '',
          req.user?.role || 'employee',
          content.trim(),
          timestamp,
        ]
      );

      await db.run('UPDATE admin_tickets SET updatedAt = ? WHERE id = ?', [timestamp, ticketId]);

      const response: AddAdminCommentResponse = {
        id: commentId,
        ticketId,
        authorId: req.user?.id || '',
        authorName: req.user?.name || '',
        authorRole: req.user?.role || 'employee',
        content: content.trim(),
        createdAt: timestamp,
      };

      sseClients.broadcast(
        `data: ${JSON.stringify({ type: 'admin_ticket_update', action: 'commented', data: { ticketId, comment: response } })}\n\n`,
        req.user?.id
      );
      res.status(201).json(response);
    } catch (error) {
      logger.error('Failed to add comment to admin ticket:', error);
      res.status(500).json({ error: 'Failed to add comment.' });
    }
  }
);

// DELETE /api/admin-tickets/:id
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: ApiResponse<DeleteAdminTicketResponse>) => {
  const ticketId = String(req.params.id);

  try {
    const db = getDb();

    const ticket = await db.get<DbAdminTicket>('SELECT id FROM admin_tickets WHERE id = ?', [ticketId]);
    if (!ticket) {
      res.status(404).json({ error: 'Admin ticket not found.' });
      return;
    }

    await db.run('DELETE FROM admin_tickets WHERE id = ?', [ticketId]);

    const response: DeleteAdminTicketResponse = {
      success: true,
      message: 'Admin ticket deleted successfully.',
    };

    sseClients.broadcast(
      `data: ${JSON.stringify({ type: 'admin_ticket_update', action: 'deleted', data: { ticketId } })}\n\n`,
      req.user?.id
    );
    res.json(response);
  } catch (error) {
    logger.error('Failed to delete admin ticket:', error);
    res.status(500).json({ error: 'Failed to delete admin ticket.' });
  }
});

// PUT /api/admin-tickets/:id
router.put(
  '/:id',
  authenticateToken,
  async (req: ApiAuthRequest<UpdateAdminTicketRequestBody>, res: ApiResponse<UpdateAdminTicketResponse>) => {
    if (req.user?.role !== 'manager') {
      res.status(403).json({
        error: 'Forbidden. Only Admin Manager can edit admin tickets.',
      });
      return;
    }

    const ticketId = String(req.params.id);
    const { description, category } = req.body;

    if (!description) {
      res.status(400).json({ error: 'Description is required.' });
      return;
    }

    try {
      const db = getDb();

      const ticket = await db.get<DbAdminTicket>('SELECT * FROM admin_tickets WHERE id = ?', [ticketId]);
      if (!ticket) {
        res.status(404).json({ error: 'Admin ticket not found.' });
        return;
      }

      const timestamp = new Date().toISOString();

      await db.run('UPDATE admin_tickets SET description = ?, category = ?, updatedAt = ? WHERE id = ?', [
        description,
        category,
        timestamp,
        ticketId,
      ]);

      const logId = `log-${Date.now()}`;
      const newLog: DbAdminActivityLog = {
        id: logId,
        ticketId,
        action: 'Ticket details updated by Admin Manager',
        timestamp,
        performedByName: req.user?.name || '',
        performedByRole: req.user?.role || 'manager',
      };

      await db.run(
        `INSERT INTO admin_activity_logs (
              id, ticketId, action, timestamp, performedByName, performedByRole
            ) VALUES (?, ?, ?, ?, ?, ?)`,
        [logId, ticketId, newLog.action, timestamp, newLog.performedByName, newLog.performedByRole]
      );

      const response: UpdateAdminTicketResponse = {
        success: true,
        updatedAt: timestamp,
        newLog,
      };

      sseClients.broadcast(
        `data: ${JSON.stringify({ type: 'admin_ticket_update', action: 'updated', data: { id: ticketId, description, category, updatedAt: timestamp } })}\n\n`,
        req.user?.id
      );
      res.json(response);
    } catch (error) {
      logger.error('Failed to edit admin ticket:', error);
      res.status(500).json({ error: 'Failed to edit admin ticket.' });
    }
  }
);

export default router;
