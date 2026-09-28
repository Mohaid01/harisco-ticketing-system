import { Response, Router } from 'express';

import type {
  AddHSECommentRequestBody,
  AddHSECommentResponse,
  ApiAuthRequest,
  ApiResponse,
  AssignHSETicketRequestBody,
  AssignHSETicketResponse,
  AuthRequest,
  CreateHSETicketRequestBody,
  CreateHSETicketResponse,
  DbHSEActivityLog,
  DbHSEComment,
  DbHSETicket,
  DeleteHSETicketResponse,
  HSETicketResponse,
  HSETicketsResponse,
  RevertHSEStatusResponse,
  UpdateHSEStatusRequestBody,
  UpdateHSEStatusResponse,
} from '../types/index.ts';

import { getDb } from '../db.ts';
import { sendEmail } from '../email.ts';
import { authenticateToken } from '../middleware/auth.ts';
import { sseClients } from '../middleware/sse.ts';
import logger from '../utils/logger.ts';

const router = Router();

function isHSEUser(user: { department?: string | null } | undefined): boolean {
  if (!user) return false;
  return user.department === 'HSE';
}

// GET /api/hse-tickets/stream
router.get('/stream', authenticateToken, (req: AuthRequest, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  sseClients.add(res, req.user?.id);
});

// GET /api/hse-tickets
router.get('/', authenticateToken, async (req: AuthRequest, res: ApiResponse<HSETicketsResponse>) => {
  const currentUser = req.user;

  if (!currentUser) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  try {
    const db = getDb();
    let query = 'SELECT * FROM hse_tickets';
    const params: (string | undefined)[] = [];

    if (currentUser.role === 'executive') {
      // Executives see all
    } else if (isHSEUser(currentUser)) {
      // HSE dept sees all
    } else {
      query += ' WHERE reporterId = ?';
      params.push(currentUser.id);
    }

    query += ' ORDER BY id DESC';

    const tickets = await db.all<DbHSETicket[]>(query, params);

    if (tickets.length === 0) {
      return res.json([]);
    }

    const ticketIds = tickets.map((t) => t.id);
    const placeholders = ticketIds.map(() => '?').join(',');

    const fetchCommentsQuery = [
      'SELECT * FROM hse_comments',
      'WHERE ticketId IN (' + placeholders + ')',
      'ORDER BY createdAt ASC',
    ].join(' ');
    const comments = await db.all<DbHSEComment[]>(fetchCommentsQuery, ticketIds);

    const fetchLogsQuery = [
      'SELECT * FROM hse_activity_logs',
      'WHERE ticketId IN (' + placeholders + ')',
      'ORDER BY timestamp ASC',
    ].join(' ');
    const logs = await db.all<DbHSEActivityLog[]>(fetchLogsQuery, ticketIds);

    const ticketsMap: HSETicketResponse[] = tickets.map((ticket) => ({
      ...ticket,
      comments: comments.filter((c) => c.ticketId === ticket.id),
      activityLogs: logs.filter((l) => l.ticketId === ticket.id),
    }));

    return res.json(ticketsMap);
  } catch (error) {
    logger.error('Failed to fetch HSE tickets:', error);
    return res.status(500).json({ error: 'Failed to retrieve HSE tickets.' });
  }
});

// POST /api/hse-tickets
router.post(
  '/',
  authenticateToken,
  async (req: ApiAuthRequest<CreateHSETicketRequestBody>, res: ApiResponse<CreateHSETicketResponse>) => {
    const { description, category, justification } = req.body;

    if (!description || !category) {
      res.status(400).json({ error: 'Missing required ticket fields.' });
      return;
    }

    try {
      const db = getDb();

      const allTickets = await db.all<{ id: string }[]>('SELECT id FROM hse_tickets');
      let maxIndex = 0;
      for (const t of allTickets) {
        const match = t.id.match(/HCIT-HSE-(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxIndex) {
            maxIndex = num;
          }
        }
      }
      const index = maxIndex + 1;
      const ticketId = `HCIT-HSE-${index}`;

      const timestamp = new Date().toISOString();
      const reporterId = req.user?.id || '';
      const reporterName = req.user?.name || '';
      const reporterEmail = req.user?.email || '';
      const finalJustification = justification || '';

      await db.run(
        `INSERT INTO hse_tickets (
            id, description, category, status, justification, createdAt, updatedAt,
            reporterId, reporterName, reporterEmail, assigneeId, assigneeName, executiveId, executiveName, previousStatus
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL)`,
        [
          ticketId,
          description,
          category,
          'open',
          finalJustification,
          timestamp,
          timestamp,
          reporterId,
          reporterName,
          reporterEmail,
        ]
      );

      const logId = `log-${Date.now()}`;
      const activityLog: DbHSEActivityLog = {
        id: logId,
        ticketId,
        action: 'Ticket raised',
        timestamp,
        performedByName: reporterName,
        performedByRole: req.user?.role || 'employee',
      };

      await db.run(
        `INSERT INTO hse_activity_logs (
            id, ticketId, action, timestamp, performedByName, performedByRole
          ) VALUES (?, ?, ?, ?, ?, ?)`,
        [logId, ticketId, activityLog.action, timestamp, activityLog.performedByName, activityLog.performedByRole]
      );

      const response: CreateHSETicketResponse = {
        id: ticketId,
        description,
        category,
        status: 'open',
        justification: finalJustification,
        createdAt: timestamp,
        updatedAt: timestamp,
        reporterId,
        reporterName,
        reporterEmail,
        assigneeId: null,
        assigneeName: null,
        executiveId: null,
        executiveName: null,
        previousStatus: null,
        comments: [],
        activityLogs: [activityLog],
      };

      sseClients.broadcast(
        `data: ${JSON.stringify({ type: 'hse_ticket_update', action: 'created', data: response })}\n\n`,
        req.user?.id
      );
      res.status(201).json(response);
    } catch (error) {
      logger.error('Failed to create HSE ticket:', error);
      res.status(500).json({ error: 'Failed to create new HSE ticket.' });
    }
  }
);

// POST /api/hse-tickets/:id/status
router.post(
  '/:id/status',
  authenticateToken,
  async (
    req: ApiAuthRequest<UpdateHSEStatusRequestBody>,
    res: ApiResponse<UpdateHSEStatusResponse>
  ) => {
    const ticketId = String(req.params.id);
    const { status, actionMessage, executiveId, executiveName } = req.body;

    if (!status || !actionMessage) {
      res.status(400).json({ error: 'Status and action message are required.' });
      return;
    }

    if (!isHSEUser(req.user)) {
      res.status(403).json({ error: 'Forbidden. Only HSE Department can update HSE ticket status.' });
      return;
    }

    try {
      const db = getDb();

      const ticket = await db.get<DbHSETicket>('SELECT * FROM hse_tickets WHERE id = ?', [ticketId]);
      if (!ticket) {
        res.status(404).json({ error: 'HSE ticket not found.' });
        return;
      }

      const timestamp = new Date().toISOString();

      const newStatus = status;

      if (status === 'escalated' && ticket.status !== 'open') {
        res.status(400).json({ error: 'Can only escalate from Open status.' });
        return;
      }

      if (status === 'in_progress' && ticket.status === 'rejected') {
        res.status(400).json({ error: 'Cannot move a rejected ticket to in progress.' });
        return;
      }

      if (status === 'in_progress' && ticket.status === 'open') {
        res.status(400).json({ error: 'Use assign endpoint to move from Open to In Progress.' });
        return;
      }

      if (status === 'rejected' && ticket.status !== 'escalated') {
        res.status(400).json({ error: 'Can only reject from Escalated status.' });
        return;
      }

      if (status === 'closed' && ticket.status !== 'in_progress') {
        res.status(400).json({ error: 'Can only close from In Progress status.' });
        return;
      }

      if (status === 'open' && ticket.status !== 'escalated') {
        res.status(400).json({ error: 'Can only revert to Open from Escalated status.' });
        return;
      }

      if (status === 'escalated') {
        await db.run('UPDATE hse_tickets SET status = ?, updatedAt = ?, previousStatus = ? WHERE id = ?', [
          newStatus,
          timestamp,
          ticket.status,
          ticketId,
        ]);
      } else if (status === 'rejected') {
        await db.run('UPDATE hse_tickets SET status = ?, updatedAt = ?, previousStatus = ? WHERE id = ?', [
          newStatus,
          timestamp,
          ticket.status,
          ticketId,
        ]);
      } else if (status === 'open') {
        await db.run('UPDATE hse_tickets SET status = ?, updatedAt = ?, previousStatus = ? WHERE id = ?', [
          newStatus,
          timestamp,
          ticket.status,
          ticketId,
        ]);
      } else {
        await db.run('UPDATE hse_tickets SET status = ?, updatedAt = ? WHERE id = ?', [
          newStatus,
          timestamp,
          ticketId,
        ]);
      }

      const logId = `log-${Date.now()}`;
      const newLog: DbHSEActivityLog = {
        id: logId,
        ticketId,
        action: actionMessage,
        timestamp,
        performedByName: req.user?.name || '',
        performedByRole: req.user?.role || 'employee',
      };

      await db.run(
        `INSERT INTO hse_activity_logs (
            id, ticketId, action, timestamp, performedByName, performedByRole
          ) VALUES (?, ?, ?, ?, ?, ?)`,
        [logId, ticketId, actionMessage, timestamp, newLog.performedByName, newLog.performedByRole]
      );

      if (status === 'escalated') {
        try {
          const hseManagers = await db.all<{ email: string }[]>(
            "SELECT email FROM users WHERE department = 'HSE' AND (role = 'manager' OR role = 'executive') AND email IS NOT NULL AND email != ''"
          );
          for (const mgr of hseManagers) {
            sendEmail(
              mgr.email,
              `[HSE Escalation] Ticket ${ticketId} Awaiting Executive Review`,
              `Hello,\n\nAn HSE ticket has been escalated for your review by ${req.user?.name || 'HSE User'}.\n\nTicket ID: ${ticketId}\nCategory: ${ticket.category}\nDescription:\n${ticket.description}\n\nPlease log in to review and approve or reject this request.`
            ).catch((err) => logger.error('Email send failed:', err));
          }
        } catch (err) {
          logger.error('Failed to query HSE managers for escalation email:', err);
        }
      }

      if (ticket.status === 'escalated' && status === 'rejected') {
        try {
          sendEmail(
            ticket.reporterEmail,
            `[HSE Ticket Rejected] ${ticketId}`,
            `Hello ${ticket.reporterName},\n\nYour HSE ticket has been rejected by ${req.user?.name || 'HSE Executive'}.\n\nTicket ID: ${ticketId}\nCategory: ${ticket.category}\n\nYou will need to raise a new ticket if you still need assistance.`
          ).catch((err) => logger.error('Email send failed:', err));
        } catch (err) {
          logger.error('Failed to send rejection email:', err);
        }
      }

      if (status === 'closed') {
        try {
          sendEmail(
            ticket.reporterEmail,
            `[HSE Ticket Closed] ${ticketId}`,
            `Hello ${ticket.reporterName},\n\nYour HSE ticket has been closed.\n\nTicket ID: ${ticketId}\nCategory: ${ticket.category}\n`
          ).catch((err) => logger.error('Email send failed:', err));
        } catch (err) {
          logger.error('Failed to send closure email:', err);
        }
      }

      if (ticket.assigneeId && status === 'in_progress') {
        try {
          sendEmail(
            ticket.reporterEmail,
            `[HSE Ticket Assigned] ${ticketId}`,
            `Hello,\n\nThe HSE ticket has been assigned.\n\nTicket ID: ${ticketId}\nAssignee: ${ticket.assigneeName}\n`
          ).catch((err) => logger.error('Email send failed:', err));
        } catch (err) {
          logger.error('Failed to send assign email:', err);
        }
      }

      const response: UpdateHSEStatusResponse = {
        success: true,
        status: newStatus,
        previousStatus: ticket.status,
        updatedAt: timestamp,
        executiveId: executiveId || ticket.executiveId || null,
        executiveName: executiveName || ticket.executiveName || null,
        newLog,
      };

      sseClients.broadcast(
        `data: ${JSON.stringify({ type: 'hse_ticket_update', action: 'status_changed', data: { id: ticketId, ...response } })}\n\n`,
        req.user?.id
      );
      res.json(response);
    } catch (error) {
      logger.error('Failed to update HSE ticket status:', error);
      res.status(500).json({ error: 'Failed to update HSE ticket status.' });
    }
  }
);

// POST /api/hse-tickets/:id/assign
router.post(
  '/:id/assign',
  authenticateToken,
  async (req: ApiAuthRequest<AssignHSETicketRequestBody>, res: ApiResponse<AssignHSETicketResponse>) => {
  if (!isHSEUser(req.user)) {
    res.status(403).json({ error: 'Forbidden. Only HSE Department can assign HSE tickets.' });
    return;
  }

  const ticketId = String(req.params.id);
  const { assigneeId, assigneeName } = req.body;

    if (!assigneeId || !assigneeName) {
      res.status(400).json({ error: 'AssigneeId and assigneeName are required.' });
      return;
    }

    try {
      const db = getDb();

      const ticket = await db.get<DbHSETicket>('SELECT * FROM hse_tickets WHERE id = ?', [ticketId]);
      if (!ticket) {
        res.status(404).json({ error: 'HSE ticket not found.' });
        return;
      }

      if (ticket.status !== 'open') {
        res.status(400).json({ error: 'Can only assign from Open status.' });
        return;
      }

      const timestamp = new Date().toISOString();
      const newStatus = 'in_progress';

      await db.run('UPDATE hse_tickets SET assigneeId = ?, assigneeName = ?, status = ?, updatedAt = ? WHERE id = ?', [
        assigneeId,
        assigneeName,
        newStatus,
        timestamp,
        ticketId,
      ]);

      const logId = `log-${Date.now()}`;
      const actionText = `Assigned to ${assigneeName}`;
      const newLog: DbHSEActivityLog = {
        id: logId,
        ticketId,
        action: actionText,
        timestamp,
        performedByName: req.user?.name || '',
        performedByRole: req.user?.role || 'employee',
      };

      await db.run(
        `INSERT INTO hse_activity_logs (
            id, ticketId, action, timestamp, performedByName, performedByRole
          ) VALUES (?, ?, ?, ?, ?, ?)`,
        [logId, ticketId, actionText, timestamp, newLog.performedByName, newLog.performedByRole]
      );

      const assigneeUser = await db.get<{ email: string; name: string }>(
        'SELECT email, name FROM users WHERE id = ? AND email IS NOT NULL AND email != ?',
        [assigneeId, '']
      );

      if (assigneeUser && assigneeUser.email) {
        try {
          sendEmail(
            assigneeUser.email,
            `[HSE Ticket Assigned] ${ticketId}`,
            `Hello ${assigneeUser.name},\n\nYou have been assigned to HSE ticket ${ticketId}.\n\nCategory: ${ticket.category}\nDescription: ${ticket.description}\n\nPlease log in to start working on this ticket.`
          ).catch((err) => logger.error('Email send failed:', err));
        } catch (err) {
          logger.error('Failed to send assignment email:', err);
        }
      }

      const response: AssignHSETicketResponse = {
        success: true,
        assigneeId,
        assigneeName,
        status: newStatus,
        updatedAt: timestamp,
        newLog,
      };

      sseClients.broadcast(
        `data: ${JSON.stringify({ type: 'hse_ticket_update', action: 'status_changed', data: { id: ticketId, ...response } })}\n\n`,
        req.user?.id
      );
      res.json(response);
    } catch (error) {
      logger.error('Failed to assign HSE ticket:', error);
      res.status(500).json({ error: 'Failed to assign HSE ticket.' });
    }
  }
);

// POST /api/hse-tickets/:id/revert-status
router.post(
  '/:id/revert-status',
  authenticateToken,
  async (req: AuthRequest, res: ApiResponse<RevertHSEStatusResponse>) => {
    if (!isHSEUser(req.user)) {
      res.status(403).json({ error: 'Forbidden. Only HSE Department can revert HSE ticket status.' });
      return;
    }

    const ticketId = String(req.params.id);

    try {
      const db = getDb();

      const ticket = await db.get<DbHSETicket>('SELECT * FROM hse_tickets WHERE id = ?', [ticketId]);
      if (!ticket) {
        res.status(404).json({ error: 'HSE ticket not found.' });
        return;
      }

      if (!ticket.previousStatus) {
        res.status(400).json({ error: 'Cannot revert: this ticket has no previous status.' });
        return;
      }

      const timestamp = new Date().toISOString();
      const revertedStatus = ticket.previousStatus;

      await db.run('UPDATE hse_tickets SET status = ?, previousStatus = NULL, updatedAt = ? WHERE id = ?', [
        revertedStatus,
        timestamp,
        ticketId,
      ]);

      const logId = `log-${Date.now()}`;
      const newLog: DbHSEActivityLog = {
        id: logId,
        ticketId,
        action: `Status reverted to ${revertedStatus}`,
        timestamp,
        performedByName: req.user?.name || '',
        performedByRole: req.user?.role || 'employee',
      };

      await db.run(
        `INSERT INTO hse_activity_logs (
            id, ticketId, action, timestamp, performedByName, performedByRole
          ) VALUES (?, ?, ?, ?, ?, ?)`,
        [logId, ticketId, newLog.action, timestamp, newLog.performedByName, newLog.performedByRole]
      );

      const response: RevertHSEStatusResponse = {
        success: true,
        status: revertedStatus,
        previousStatus: null,
        updatedAt: timestamp,
        newLog,
      };

      sseClients.broadcast(
        `data: ${JSON.stringify({ type: 'hse_ticket_update', action: 'status_reverted', data: { id: ticketId, ...response } })}\n\n`,
        req.user?.id
      );
      res.json(response);
    } catch (error) {
      logger.error('Failed to revert HSE ticket status:', error);
      res.status(500).json({ error: 'Failed to revert HSE ticket status.' });
    }
  }
);

// POST /api/hse-tickets/:id/comments
router.post(
  '/:id/comments',
  authenticateToken,
  async (req: ApiAuthRequest<AddHSECommentRequestBody>, res: ApiResponse<AddHSECommentResponse>) => {
    const ticketId = String(req.params.id);
    const { content } = req.body;

    if (!content || !content.trim()) {
      res.status(400).json({ error: 'Comment content cannot be empty.' });
      return;
    }

    try {
      const db = getDb();

      const ticket = await db.get<DbHSETicket>('SELECT id FROM hse_tickets WHERE id = ?', [ticketId]);
      if (!ticket) {
        res.status(404).json({ error: 'HSE ticket not found.' });
        return;
      }

      const commentId = `c-${Date.now()}`;
      const timestamp = new Date().toISOString();

      await db.run(
        `INSERT INTO hse_comments (
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

      await db.run('UPDATE hse_tickets SET updatedAt = ? WHERE id = ?', [timestamp, ticketId]);

      const response: AddHSECommentResponse = {
        id: commentId,
        ticketId,
        authorId: req.user?.id || '',
        authorName: req.user?.name || '',
        authorRole: req.user?.role || 'employee',
        content: content.trim(),
        createdAt: timestamp,
      };

      sseClients.broadcast(
        `data: ${JSON.stringify({ type: 'hse_ticket_update', action: 'commented', data: { ticketId, comment: response } })}\n\n`,
        req.user?.id
      );
      res.status(201).json(response);
    } catch (error) {
      logger.error('Failed to add comment to HSE ticket:', error);
      res.status(500).json({ error: 'Failed to add comment to HSE ticket.' });
    }
  }
);

// DELETE /api/hse-tickets/:id
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: ApiResponse<DeleteHSETicketResponse>) => {
  if (!isHSEUser(req.user)) {
    res.status(403).json({
      error: 'Forbidden. Only HSE Department can delete HSE tickets.',
    });
    return;
  }

  const ticketId = String(req.params.id);

  try {
    const db = getDb();

    const ticket = await db.get<{ id: string }>('SELECT id FROM hse_tickets WHERE id = ?', [ticketId]);
    if (!ticket) {
      res.status(404).json({ error: 'HSE ticket not found.' });
      return;
    }

    await db.run('DELETE FROM hse_comments WHERE ticketId = ?', [ticketId]);
    await db.run('DELETE FROM hse_activity_logs WHERE ticketId = ?', [ticketId]);
    await db.run('DELETE FROM hse_tickets WHERE id = ?', [ticketId]);

    sseClients.broadcast(
      `data: ${JSON.stringify({ type: 'hse_ticket_update', action: 'deleted', data: { ticketId } })}\n\n`,
      req.user?.id
    );
    res.json({ success: true, message: 'HSE ticket deleted successfully.' });
  } catch (error) {
    logger.error('Failed to delete HSE ticket:', error);
    res.status(500).json({ error: 'Failed to delete HSE ticket.' });
  }
});

export default router;
