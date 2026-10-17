import { Router } from 'express';

import type {
  ApiAuthRequest,
  ApiResponse,
  AuthRequest,
  AssignInventoryRequestBody,
  AssignInventoryResponse,
  CreateInventoryRequestBody,
  UpdateInventoryRequestBody,
  DbInventory,
  InventoryResponse,
  InventoriesResponse,
} from '../types/index.ts';

import { getDb } from '../db.ts';
import { authenticateToken } from '../middleware/auth.ts';
import { createInventorySchema, assignInventorySchema, updateInventorySchema } from '../schemas/index.ts';
import logger from '../utils/logger.ts';

const router = Router();

async function resolveUserAcrossTables(db: ReturnType<typeof getDb>, userId: string) {
  let u = await db.get<{ id: string; name: string }>('SELECT id, name FROM users WHERE id = ? AND is_active != 0', [
    userId,
  ]);
  if (!u) {
    u = await db.get<{ id: string; name: string }>(
      'SELECT id, name FROM factory_users WHERE id = ? AND is_active != 0',
      [userId]
    );
  }
  if (!u) {
    u = await db.get<{ id: string; name: string }>(
      'SELECT id, name FROM external_users WHERE id = ? AND is_active != 0',
      [userId]
    );
  }
  return u;
}

// GET /api/inventory — list inventory (with optional ?status= filter)
router.get('/', authenticateToken, async (req: AuthRequest, res: ApiResponse<InventoriesResponse>) => {
  const statusFilter = req.query.status as string | undefined;

  const validStatuses = ['Stocked', 'Assigned', 'Under Repair', 'Retired', 'Lost'];
  if (statusFilter && !validStatuses.includes(statusFilter)) {
    return res.status(400).json({ error: 'Invalid status filter.' });
  }

  try {
    const db = getDb();
    const queryParams: (string | undefined)[] = [];
    let query = 'SELECT * FROM inventory';

    if (statusFilter) {
      query += ' WHERE status = ?';
      queryParams.push(statusFilter);
    }

    query += ' ORDER BY created_at DESC';

    const inventory = await db.all<DbInventory[]>(query, queryParams);
    return res.json(inventory);
  } catch (error) {
    logger.error('Failed to fetch inventory:', error);
    return res.status(500).json({ error: 'Failed to retrieve inventory.' });
  }
});

// POST /api/inventory — create a new inventory record
router.post(
  '/',
  authenticateToken,
  async (req: ApiAuthRequest<CreateInventoryRequestBody>, res: ApiResponse<InventoryResponse>) => {
    if (req.user?.role !== 'it') {
      return res.status(403).json({ error: 'Forbidden. Inventory management requires IT role.' });
    }

    const parsed = createInventorySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.message || 'Invalid inventory data.' });
    }

    const { company, entity, category, details, device_id, sn_mac_address, assigned_user_id, attachment } = parsed.data;

    try {
      const db = getDb();

      // Uniqueness pre-check
      const existingDevice = await db.get<{ id: string }>('SELECT id FROM inventory WHERE device_id = ?', [device_id]);
      if (existingDevice) {
        return res.status(409).json({ error: 'Device ID already exists.' });
      }

      const existingSnMac = await db.get<{ id: string }>('SELECT id FROM inventory WHERE sn_mac_address = ?', [
        sn_mac_address,
      ]);
      if (existingSnMac) {
        return res.status(409).json({ error: 'SN/MAC Address already exists.' });
      }

      const timestamp = new Date().toISOString();
      const id = `inv-${Date.now()}`;
      let status: DbInventory['status'] = 'Stocked';
      let assigned_user_name: string | null = null;

      if (assigned_user_id) {
        const assignee = await resolveUserAcrossTables(db, assigned_user_id);
        if (!assignee) {
          return res.status(400).json({ error: 'Assigned user not found or inactive.' });
        }
        status = 'Assigned';
        assigned_user_name = assignee.name;
      }

      await db.run(
        `INSERT INTO inventory (
            id, company, entity, category, details, device_id, sn_mac_address, status,
            assigned_user_id, assigned_user_name, attachment, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          company,
          entity,
          category,
          details,
          device_id,
          sn_mac_address,
          status,
          assigned_user_id ?? null,
          assigned_user_name,
          attachment ?? null,
          timestamp,
          timestamp,
        ]
      );

      const response: InventoryResponse = {
        id,
        company,
        entity,
        category,
        details,
        device_id,
        sn_mac_address,
        status,
        assigned_user_id: assigned_user_id ?? null,
        assigned_user_name,
        attachment: attachment ?? null,
        created_at: timestamp,
        updated_at: timestamp,
      };

      return res.status(201).json(response);
    } catch (error) {
      logger.error('Failed to create inventory:', error);
      if (
        error instanceof Error &&
        (error.message.includes('UNIQUE') || error.message.includes('SQLITE_CONSTRAINT_UNIQUE'))
      ) {
        return res.status(409).json({ error: 'Device ID or SN/MAC Address already exists.' });
      }
      return res.status(500).json({ error: 'Failed to create inventory.' });
    }
  }
);

// PUT /api/inventory/:id/assign — assign an inventory item to a user
router.put(
  '/:id/assign',
  authenticateToken,
  async (req: ApiAuthRequest<AssignInventoryRequestBody>, res: ApiResponse<AssignInventoryResponse>) => {
    if (req.user?.role !== 'it') {
      return res.status(403).json({ error: 'Forbidden. Inventory assignment requires IT role.' });
    }

    const inventoryId = String(req.params.id);
    const parsed = assignInventorySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.message || 'User ID is required.' });
    }

    const { userId } = parsed.data;

    try {
      const db = getDb();

      const inventory = await db.get<DbInventory>('SELECT * FROM inventory WHERE id = ?', [inventoryId]);
      if (!inventory) {
        return res.status(404).json({ error: 'Inventory item not found.' });
      }

      const assignee = await resolveUserAcrossTables(db, userId);
      if (!assignee) {
        return res.status(400).json({ error: 'User not found or inactive.' });
      }

      const timestamp = new Date().toISOString();

      await db.run(
        'UPDATE inventory SET status = ?, assigned_user_id = ?, assigned_user_name = ?, updated_at = ? WHERE id = ?',
        ['Assigned', userId, assignee.name, timestamp, inventoryId]
      );

      const response: AssignInventoryResponse = {
        success: true,
        id: inventoryId,
        status: 'Assigned',
        assigned_user_id: userId,
        assigned_user_name: assignee.name,
        updated_at: timestamp,
      };

      return res.json(response);
    } catch (error) {
      logger.error('Failed to assign inventory:', error);
      return res.status(500).json({ error: 'Failed to assign inventory.' });
    }
  }
);

// PATCH /api/inventory/:id — update inventory record (e.g. status, assignment, details)
router.patch(
  '/:id',
  authenticateToken,
  async (req: ApiAuthRequest<UpdateInventoryRequestBody>, res: ApiResponse<InventoryResponse>) => {
    if (req.user?.role !== 'it') {
      return res.status(403).json({ error: 'Forbidden. Inventory management requires IT role.' });
    }

    const inventoryId = String(req.params.id);
    const parsed = updateInventorySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.message || 'Invalid update data.' });
    }

    try {
      const db = getDb();
      const existing = await db.get<DbInventory>('SELECT * FROM inventory WHERE id = ?', [inventoryId]);
      if (!existing) {
        return res.status(404).json({ error: 'Inventory item not found.' });
      }

      const patch = parsed.data;
      let assigned_user_name = existing.assigned_user_name;
      let assigned_user_id = existing.assigned_user_id;

      if ('assigned_user_id' in patch) {
        if (patch.assigned_user_id) {
          const assignee = await resolveUserAcrossTables(db, patch.assigned_user_id);
          if (!assignee) {
            return res.status(400).json({ error: 'Assigned user not found or inactive.' });
          }
          assigned_user_id = patch.assigned_user_id;
          assigned_user_name = assignee.name;
        } else {
          assigned_user_id = null;
          assigned_user_name = null;
        }
      }

      // If status changed to Stocked and no explicit assigned_user_id was passed, unassign
      const status = patch.status !== undefined ? patch.status : existing.status;
      if (status === 'Stocked' && !('assigned_user_id' in patch)) {
        assigned_user_id = null;
        assigned_user_name = null;
      }

      const company = patch.company ?? existing.company;
      const entity = patch.entity ?? existing.entity;
      const category = patch.category ?? existing.category;
      const details = patch.details ?? existing.details;
      const device_id = patch.device_id ?? existing.device_id;
      const sn_mac_address = patch.sn_mac_address ?? existing.sn_mac_address;
      const attachment = patch.attachment !== undefined ? patch.attachment : existing.attachment;
      const updated_at = new Date().toISOString();

      await db.run(
        `UPDATE inventory SET
          company = ?, entity = ?, category = ?, details = ?, device_id = ?,
          sn_mac_address = ?, status = ?, assigned_user_id = ?, assigned_user_name = ?,
          attachment = ?, updated_at = ?
         WHERE id = ?`,
        [
          company,
          entity,
          category,
          details,
          device_id,
          sn_mac_address,
          status,
          assigned_user_id,
          assigned_user_name,
          attachment,
          updated_at,
          inventoryId,
        ]
      );

      const updatedItem: InventoryResponse = {
        id: inventoryId,
        company,
        entity,
        category,
        details,
        device_id,
        sn_mac_address,
        status,
        assigned_user_id,
        assigned_user_name,
        attachment,
        created_at: existing.created_at,
        updated_at,
      };

      return res.json(updatedItem);
    } catch (error) {
      logger.error('Failed to update inventory:', error);
      return res.status(500).json({ error: 'Failed to update inventory.' });
    }
  }
);

// DELETE /api/inventory/:id — delete inventory record
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: ApiResponse<{ success: boolean }>) => {
  if (req.user?.role !== 'it') {
    return res.status(403).json({ error: 'Forbidden. Inventory management requires IT role.' });
  }

  const inventoryId = String(req.params.id);

  try {
    const db = getDb();
    const existing = await db.get<{ id: string }>('SELECT id FROM inventory WHERE id = ?', [inventoryId]);
    if (!existing) {
      return res.status(404).json({ error: 'Inventory item not found.' });
    }

    await db.run('DELETE FROM inventory WHERE id = ?', [inventoryId]);
    return res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete inventory:', error);
    return res.status(500).json({ error: 'Failed to delete inventory.' });
  }
});

export default router;
