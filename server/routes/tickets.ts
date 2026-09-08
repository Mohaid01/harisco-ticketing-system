import { Response, Router } from 'express';

import type {
  AddTicketCommentRequestBody,
  AddTicketCommentResponse,
  ApiAuthRequest,
  ApiResponse,
  AssignTicketRequestBody,
  AssignTicketResponse,
  AuthRequest,
  CreateTicketRequestBody,
  CreateTicketResponse,
  DbActivityLog,
  DbComment,
  DbTicket,
  DeleteTicketResponse,
  TicketResponse,
  TicketsResponse,
  UpdateTicketRequestBody,
  UpdateTicketResponse,
  UpdateTicketStatusRequestBody,
  UpdateTicketStatusResponse,
} from '../types/index.ts';

import { getDb } from '../db.ts';
import { sendEmail } from '../email.ts';
import { authenticateToken } from '../middleware/auth.ts';
import { sseClients } from '../middleware/sse.ts';
import logger from '../utils/logger.ts';

const router = Router();

// GET /api/tickets/stream
router.get('/stream', authenticateToken, (req: AuthRequest, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  sseClients.add(res, req.user?.id);
});

// GET /api/tickets
router.get('/', authenticateToken, async (req: AuthRequest, res: ApiResponse<TicketsResponse>) => {
  const userId = req.user?.id;
  const userRole = req.user?.role;
  const isDepartmentHead = req.user?.isDepartmentHead;
  const userDepartment = req.user?.department;

  try {
    const db = getDb();
    let ticketsQuery = 'SELECT * FROM tickets';
    const queryParams: string[] = [];

    if (['executive', 'manager', 'it'].includes(userRole || '')) {
      // Do nothing, leaves query as "SELECT * FROM tickets"
    } else if (isDepartmentHead && userDepartment) {
      ticketsQuery += ' WHERE reporterId IN (SELECT id FROM users WHERE department = ?)';
      queryParams.push(userDepartment);
    } else if (userRole === 'employee' && userId) {
      ticketsQuery += ' WHERE reporterId = ?';
      queryParams.push(userId);
    } else {
      ticketsQuery += ' WHERE 1 = 0';
    }

    ticketsQuery += ' ORDER BY id DESC';

    const tickets = await db.all<DbTicket[]>(ticketsQuery, queryParams);

    if (tickets.length === 0) {
      return res.json([]);
    }

    const ticketIds = tickets.map((t) => t.id);
    const placeholders = ticketIds.map(() => '?').join(',');

    const fetchCommentsQuery = [
      'SELECT * FROM comments',
      'WHERE ticketId IN (' + placeholders + ')',
      'ORDER BY createdAt ASC',
    ].join(' ');
    const comments = await db.all<DbComment[]>(fetchCommentsQuery, ticketIds);

    const fetchLogsQuery = [
      'SELECT * FROM activity_logs',
      'WHERE ticketId IN (' + placeholders + ')',
      'ORDER BY timestamp ASC',
    ].join(' ');
    const logs = await db.all<DbActivityLog[]>(fetchLogsQuery, ticketIds);

    const ticketsMap: TicketResponse[] = tickets.map((ticket) => ({
      ...ticket,
      comments: comments.filter((c) => c.ticketId === ticket.id),
      activityLogs: logs.filter((l) => l.ticketId === ticket.id),
    }));

    return res.json(ticketsMap);
  } catch (error) {
    logger.error('Failed to fetch tickets:', error);
    return res.status(500).json({ error: 'Failed to retrieve support tickets.' });
  }
});

// POST /api/tickets
router.post(
  '/',
  authenticateToken,
  async (req: ApiAuthRequest<CreateTicketRequestBody>, res: ApiResponse<CreateTicketResponse>) => {
    const { description, type, justification } = req.body;

    if (!description || !type || !justification) {
      res.status(400).json({ error: 'Missing required ticket fields.' });
      return;
    }

    try {
      const db = getDb();

      const allTickets = await db.all<{ id: string }[]>('SELECT id FROM tickets');
      let maxIndex = 0;
      for (const t of allTickets) {
        const match = t.id.match(/HCIT-TCK-(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxIndex) {
            maxIndex = num;
          }
        }
      }
      const index = maxIndex + 1;
      const ticketId = `HCIT-TCK-${index}`;

      const timestamp = new Date().toISOString();
      const reporterId = req.user?.id || '';
      const reporterName = req.user?.name || '';
      const reporterEmail = req.user?.email || '';

      await db.run(
        `INSERT INTO tickets (
            id, title, description, type, status, justification, createdAt, updatedAt, 
            reporterId, reporterName, reporterEmail, assigneeId, assigneeName, quotation
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)`,
        [
          ticketId,
          ticketId,
          description,
          type,
          'open',
          justification,
          timestamp,
          timestamp,
          reporterId,
          reporterName,
          reporterEmail,
        ]
      );

      const logId = `log-${Date.now()}`;
      const activityLog: DbActivityLog = {
        id: logId,
        ticketId,
        action: 'Ticket raised',
        timestamp,
        performedByName: reporterName,
        performedByRole: req.user?.role || 'employee',
      };

      await db.run(
        `INSERT INTO activity_logs (
            id, ticketId, action, timestamp, performedByName, performedByRole
          ) VALUES (?, ?, ?, ?, ?, ?)`,
        [logId, ticketId, activityLog.action, timestamp, activityLog.performedByName, activityLog.performedByRole]
      );

      if (req.user?.role === 'employee') {
        try {
          const itUsers = await db.all<{ email: string }[]>(
            "SELECT email FROM users WHERE role = 'it' AND email IS NOT NULL AND email != ''"
          );
          for (const itUser of itUsers) {
            sendEmail(
              itUser.email,
              `[New Ticket] ${ticketId} Raised by ${reporterName}`,
              `Hello,\n\nA new support ticket has been raised by ${reporterName} (${reporterEmail}).\n\nTicket ID: ${ticketId}\nType: ${type}\nDescription:\n${description}\n\nPlease log in to review and assign this ticket.`
            ).catch((err) => logger.error('Email send failed:', err));
          }
        } catch (err) {
          logger.error('Failed to query IT users for email notification:', err);
        }
      }

      const response: CreateTicketResponse = {
        id: ticketId,
        title: ticketId,
        description,
        type,
        status: 'open',
        justification,
        createdAt: timestamp,
        updatedAt: timestamp,
        reporterId,
        reporterName,
        reporterEmail,
        assigneeId: null,
        assigneeName: null,
        comments: [],
        activityLogs: [activityLog],
      };

      sseClients.broadcast(
        `data: ${JSON.stringify({ type: 'ticket_update', action: 'created', data: response })}\n\n`,
        req.user?.id
      );
      res.status(201).json(response);
    } catch (error) {
      logger.error('Failed to create ticket:', error);
      res.status(500).json({ error: 'Failed to create new ticket.' });
    }
  }
);

// POST /api/tickets/:id/status
router.post(
  '/:id/status',
  authenticateToken,
  async (req: ApiAuthRequest<UpdateTicketStatusRequestBody>, res: ApiResponse<UpdateTicketStatusResponse>) => {
    const ticketId = String(req.params.id);
    const { status, actionMessage, quotation } = req.body;

    if (!status || !actionMessage) {
      res.status(400).json({ error: 'Status and actionMessage are required.' });
      return;
    }

    try {
      const db = getDb();

      const ticket = await db.get('SELECT * FROM tickets WHERE id = ?', [ticketId]);
      if (!ticket) {
        res.status(404).json({ error: 'Ticket not found.' });
        return;
      }

      const timestamp = new Date().toISOString();

      if (quotation !== undefined) {
        await db.run('UPDATE tickets SET status = ?, updatedAt = ?, quotation = ? WHERE id = ?', [
          status,
          timestamp,
          quotation,
          ticketId,
        ]);
      } else {
        await db.run('UPDATE tickets SET status = ?, updatedAt = ? WHERE id = ?', [status, timestamp, ticketId]);
      }

      const logId = `log-${Date.now()}`;
      const newLog: DbActivityLog = {
        id: logId,
        ticketId,
        action: actionMessage,
        timestamp,
        performedByName: req.user?.name || '',
        performedByRole: req.user?.role || 'employee',
      };

      await db.run(
        `INSERT INTO activity_logs (
            id, ticketId, action, timestamp, performedByName, performedByRole
          ) VALUES (?, ?, ?, ?, ?, ?)`,
        [logId, ticketId, actionMessage, timestamp, newLog.performedByName, newLog.performedByRole]
      );

      if (status === 'awaiting_manager_approval') {
        try {
          const managers = await db.all<{ email: string }[]>(
            "SELECT email FROM users WHERE role = 'manager' AND email IS NOT NULL AND email != ''"
          );
          for (const mgr of managers) {
            sendEmail(
              mgr.email,
              `[Escalation Request] Ticket ${ticketId} Awaiting Manager Approval`,
              `Hello,\n\nA ticket has been escalated for your approval by ${req.user?.name || 'IT'}.\n\nTicket ID: ${ticketId}\nQuotation Amount: Rs ${quotation !== undefined ? quotation : ticket.quotation || 'N/A'}\nEscalation Message: ${actionMessage}\n\nPlease log in to review and approve this request.`
            ).catch((err) => logger.error('Email send failed:', err));
          }
        } catch (err) {
          logger.error('Failed to query managers for escalation email:', err);
        }
      }

      if (ticket.status === 'awaiting_manager_approval' && status === 'awaiting_handover') {
        if (ticket.assigneeId) {
          try {
            const assignee = await db.get<{ email: string }>(
              "SELECT email FROM users WHERE id = ? AND email IS NOT NULL AND email != ''",
              [ticket.assigneeId]
            );
            if (assignee && assignee.email) {
              sendEmail(
                assignee.email,
                `[Approved by Manager] Ticket ${ticketId} Ready for Handover`,
                `Hello,\n\nThe ticket assigned to you has been approved by the manager.\n\nTicket ID: ${ticketId}\nDescription: ${ticket.description}\n\nPlease proceed with the resolution work and handover.`
              ).catch((err) => logger.error('Email send failed:', err));
            }
          } catch (err) {
            logger.error('Failed to query assignee for approval email:', err);
          }
        }
      }

      const response: UpdateTicketStatusResponse = {
        success: true,
        status,
        updatedAt: timestamp,
        quotation: quotation !== undefined ? quotation : ticket.quotation,
        newLog,
      };

      sseClients.broadcast(
        `data: ${JSON.stringify({ type: 'ticket_update', action: 'status_changed', data: { id: ticketId, ...response } })}\n\n`,
        req.user?.id
      );
      res.json(response);
    } catch (error) {
      logger.error('Failed to update status:', error);
      res.status(500).json({ error: 'Failed to update ticket status.' });
    }
  }
);

// PUT /api/tickets/:id
router.put(
  '/:id',
  authenticateToken,
  async (req: ApiAuthRequest<UpdateTicketRequestBody>, res: ApiResponse<UpdateTicketResponse>) => {
    if (req.user?.role !== 'it') {
      res.status(403).json({
        error: 'Forbidden. Ticket editing requires IT role.',
      });
      return;
    }

    const ticketId = String(req.params.id);
    const { description, type, justification } = req.body;

    if (!description || !type) {
      res.status(400).json({ error: 'Description and type are required.' });
      return;
    }

    try {
      const db = getDb();

      const ticket = await db.get('SELECT * FROM tickets WHERE id = ?', [ticketId]);
      if (!ticket) {
        res.status(404).json({ error: 'Ticket not found.' });
        return;
      }

      const timestamp = new Date().toISOString();

      await db.run('UPDATE tickets SET description = ?, type = ?, justification = ?, updatedAt = ? WHERE id = ?', [
        description,
        type,
        justification || '',
        timestamp,
        ticketId,
      ]);

      const logId = `log-${Date.now()}`;
      const newLog: DbActivityLog = {
        id: logId,
        ticketId,
        action: 'Ticket details updated by IT',
        timestamp,
        performedByName: req.user?.name || '',
        performedByRole: req.user?.role || 'it',
      };

      await db.run(
        `INSERT INTO activity_logs (
            id, ticketId, action, timestamp, performedByName, performedByRole
          ) VALUES (?, ?, ?, ?, ?, ?)`,
        [logId, ticketId, newLog.action, timestamp, newLog.performedByName, newLog.performedByRole]
      );

      const response: UpdateTicketResponse = {
        success: true,
        updatedAt: timestamp,
        newLog,
      };

      sseClients.broadcast(
        `data: ${JSON.stringify({ type: 'ticket_update', action: 'updated', data: { id: ticketId, description, type, justification: justification || '', updatedAt: timestamp } })}\n\n`,
        req.user?.id
      );
      res.json(response);
    } catch (error) {
      logger.error('Failed to edit ticket:', error);
      res.status(500).json({ error: 'Failed to edit ticket.' });
    }
  }
);

// DELETE /api/tickets/:id
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: ApiResponse<DeleteTicketResponse>) => {
  if (req.user?.role !== 'it') {
    res.status(403).json({
      error: 'Forbidden. Ticket deletion requires IT role.',
    });
    return;
  }

  const ticketId = String(req.params.id);

  try {
    const db = getDb();

    const ticket = await db.get('SELECT id FROM tickets WHERE id = ?', [ticketId]);
    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found.' });
      return;
    }

    await db.run('DELETE FROM comments WHERE ticketId = ?', [ticketId]);
    await db.run('DELETE FROM activity_logs WHERE ticketId = ?', [ticketId]);
    await db.run('DELETE FROM tickets WHERE id = ?', [ticketId]);

    sseClients.broadcast(
      `data: ${JSON.stringify({ type: 'ticket_update', action: 'deleted', data: { ticketId } })}\n\n`,
      req.user?.id
    );
    res.json({ success: true, message: 'Ticket deleted successfully.' });
  } catch (error) {
    logger.error('Failed to delete ticket:', error);
    res.status(500).json({ error: 'Failed to delete ticket.' });
  }
});

// POST /api/tickets/:id/assign
router.post(
  '/:id/assign',
  authenticateToken,
  async (req: ApiAuthRequest<AssignTicketRequestBody>, res: ApiResponse<AssignTicketResponse>) => {
    const ticketId = String(req.params.id);
    const { assigneeId, assigneeName } = req.body;

    if (!assigneeId || !assigneeName) {
      res.status(400).json({ error: 'AssigneeId and assigneeName are required.' });
      return;
    }

    try {
      const db = getDb();

      const ticket = await db.get('SELECT * FROM tickets WHERE id = ?', [ticketId]);
      if (!ticket) {
        res.status(404).json({ error: 'Ticket not found.' });
        return;
      }

      const timestamp = new Date().toISOString();
      const newStatus = 'awaiting_it_approval';

      await db.run('UPDATE tickets SET assigneeId = ?, assigneeName = ?, status = ?, updatedAt = ? WHERE id = ?', [
        assigneeId,
        assigneeName,
        newStatus,
        timestamp,
        ticketId,
      ]);

      const logId = `log-${Date.now()}`;
      const actionText = `Assigned to ${assigneeName}`;
      const newLog: DbActivityLog = {
        id: logId,
        ticketId,
        action: actionText,
        timestamp,
        performedByName: req.user?.name || '',
        performedByRole: req.user?.role || 'it',
      };

      await db.run(
        `INSERT INTO activity_logs (
            id, ticketId, action, timestamp, performedByName, performedByRole
          ) VALUES (?, ?, ?, ?, ?, ?)`,
        [logId, ticketId, actionText, timestamp, newLog.performedByName, newLog.performedByRole]
      );

      const response: AssignTicketResponse = {
        success: true,
        assigneeId,
        assigneeName,
        status: newStatus,
        updatedAt: timestamp,
        newLog,
      };

      sseClients.broadcast(
        `data: ${JSON.stringify({ type: 'ticket_update', action: 'status_changed', data: { id: ticketId, ...response } })}\n\n`
      );
      res.json(response);
    } catch (error) {
      logger.error('Failed to assign ticket:', error);
      res.status(500).json({ error: 'Failed to assign ticket.' });
    }
  }
);

// POST /api/tickets/:id/comments
router.post(
  '/:id/comments',
  authenticateToken,
  async (req: ApiAuthRequest<AddTicketCommentRequestBody>, res: ApiResponse<AddTicketCommentResponse>) => {
    const ticketId = String(req.params.id);
    const { content } = req.body;

    if (!content || !content.trim()) {
      res.status(400).json({ error: 'Comment content cannot be empty.' });
      return;
    }

    try {
      const db = getDb();

      const ticket = await db.get('SELECT id FROM tickets WHERE id = ?', [ticketId]);
      if (!ticket) {
        res.status(404).json({ error: 'Ticket not found.' });
        return;
      }

      const commentId = `c-${Date.now()}`;
      const timestamp = new Date().toISOString();

      await db.run(
        `INSERT INTO comments (
            id, ticketId, authorId, authorName, authorRole, avatar, content, createdAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          commentId,
          ticketId,
          req.user?.id || '',
          req.user?.name || '',
          req.user?.role || 'employee',
          req.user?.avatar || '',
          content.trim(),
          timestamp,
        ]
      );

      await db.run('UPDATE tickets SET updatedAt = ? WHERE id = ?', [timestamp, ticketId]);

      const response: AddTicketCommentResponse = {
        id: commentId,
        ticketId,
        authorId: req.user?.id || '',
        authorName: req.user?.name || '',
        authorRole: req.user?.role || 'employee',
        avatar: req.user?.avatar || '',
        content: content.trim(),
        createdAt: timestamp,
      };

      sseClients.broadcast(
        `data: ${JSON.stringify({ type: 'ticket_update', action: 'commented', data: { ticketId, comment: response } })}\n\n`,
        req.user?.id
      );
      res.status(201).json(response);
    } catch (error) {
      logger.error('Failed to add comment:', error);
      res.status(500).json({ error: 'Failed to add comment to ticket.' });
    }
  }
);

export default router;
