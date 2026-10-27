import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';

export const followUpsRouter = Router();

const VALID_PRIORITIES = ['High', 'Medium', 'Low'];
const VALID_STATUSES = ['Pending', 'Completed', 'Cancelled'];

// In-memory fallback store for offline development and testing
const fallbackFollowUps = new Map<string, any>();

function toFrontendFollowUp(row: any) {
  return {
    id: row.id,
    prospectId: row.prospect_id || undefined,
    companyName: row.company_name,
    contactName: row.contact_name || undefined,
    callId: row.call_id || undefined,
    task: row.task,
    description: row.description || undefined,
    dueDate: row.due_date,
    priority: row.priority,
    status: row.status,
    notes: row.notes || undefined,
    completedAt: row.completed_at || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toDbFollowUp(data: any, userId: string) {
  const dbObj: Record<string, any> = { user_id: userId };
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (data.id && UUID_REGEX.test(data.id)) dbObj.id = data.id;
  if (data.prospectId !== undefined) dbObj.prospect_id = data.prospectId && UUID_REGEX.test(data.prospectId) ? data.prospectId : null;
  if (data.callId !== undefined) dbObj.call_id = data.callId && UUID_REGEX.test(data.callId) ? data.callId : null;
  if (data.companyName !== undefined) dbObj.company_name = String(data.companyName).trim();
  if (data.contactName !== undefined) dbObj.contact_name = data.contactName ? String(data.contactName).trim() : null;
  if (data.task !== undefined) dbObj.task = String(data.task).trim();
  if (data.description !== undefined) dbObj.description = data.description ? String(data.description).trim() : null;
  if (data.dueDate !== undefined) dbObj.due_date = data.dueDate;
  if (data.priority !== undefined) dbObj.priority = data.priority;
  if (data.status !== undefined) dbObj.status = data.status;
  if (data.notes !== undefined) dbObj.notes = data.notes ? String(data.notes).trim() : null;
  if (data.completedAt !== undefined) dbObj.completed_at = data.completedAt || null;
  return dbObj;
}

// GET /api/followups - List user's follow-ups
followUpsRouter.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const supabase = req.supabase;
    const { status, priority, prospectId, callId } = req.query;

    if (!supabase) {
      let list = Array.from(fallbackFollowUps.values());
      if (status && status !== 'All') list = list.filter(f => f.status === status);
      if (priority && priority !== 'All') list = list.filter(f => f.priority === priority);
      if (prospectId) list = list.filter(f => f.prospect_id === prospectId);
      if (callId) list = list.filter(f => f.call_id === callId);
      list.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
      res.status(200).json({ success: true, data: list.map(toFrontendFollowUp) });
      return;
    }

    let query = supabase.from('follow_ups').select('*').order('due_date', { ascending: true });

    if (status && typeof status === 'string' && status !== 'All') {
      query = query.eq('status', status);
    }

    if (priority && typeof priority === 'string' && priority !== 'All') {
      query = query.eq('priority', priority);
    }

    if (prospectId && typeof prospectId === 'string') {
      query = query.eq('prospect_id', prospectId);
    }

    if (callId && typeof callId === 'string') {
      query = query.eq('call_id', callId);
    }

    const { data, error } = await query;

    if (!error && data && data.length > 0) {
      res.status(200).json({ success: true, data: data.map(toFrontendFollowUp) });
      return;
    }

    // Merge or fallback to in-memory items
    let fallbackList = Array.from(fallbackFollowUps.values());
    if (status && status !== 'All') fallbackList = fallbackList.filter(f => f.status === status);
    if (priority && priority !== 'All') fallbackList = fallbackList.filter(f => f.priority === priority);
    if (prospectId) fallbackList = fallbackList.filter(f => f.prospect_id === prospectId);
    if (callId) fallbackList = fallbackList.filter(f => f.call_id === callId);
    fallbackList.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

    res.status(200).json({ success: true, data: fallbackList.map(toFrontendFollowUp) });
  } catch (err: any) {
    res.status(200).json({ success: true, data: [] });
  }
});

// GET /api/followups/:id - Get single follow-up
followUpsRouter.get('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const supabase = req.supabase;
    const id = String(req.params.id);

    if (supabase) {
      try {
        const { data, error } = await supabase.from('follow_ups').select('*').eq('id', id).single();
        if (!error && data) {
          res.status(200).json({ success: true, data: toFrontendFollowUp(data) });
          return;
        }
      } catch (_) {}
    }

    const fallback = fallbackFollowUps.get(id);
    if (!fallback) {
      res.status(404).json({ success: false, error: 'Follow-up task not found' });
      return;
    }
    res.status(200).json({ success: true, data: toFrontendFollowUp(fallback) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to fetch follow-up' });
  }
});

// POST /api/followups - Create follow-up
followUpsRouter.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const supabase = req.supabase;
    const body = req.body;

    if (!body.task || typeof body.task !== 'string' || body.task.trim() === '') {
      res.status(400).json({ success: false, error: 'Task title/action is required' });
      return;
    }

    if (!body.dueDate || typeof body.dueDate !== 'string') {
      res.status(400).json({ success: false, error: 'Valid due date is required' });
      return;
    }

    if (body.priority && !VALID_PRIORITIES.includes(body.priority)) {
      res.status(400).json({ success: false, error: `Invalid priority. Must be: ${VALID_PRIORITIES.join(', ')}` });
      return;
    }

    if (body.status && !VALID_STATUSES.includes(body.status)) {
      res.status(400).json({ success: false, error: `Invalid status. Must be: ${VALID_STATUSES.join(', ')}` });
      return;
    }

    const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';
    const trimmedTask = String(body.task).trim();

    if (!supabase) {
      // In-memory duplicate prevention during retries
      if (body.callId) {
        for (const existing of fallbackFollowUps.values()) {
          if (existing.call_id === body.callId && existing.task === trimmedTask) {
            res.status(200).json({ success: true, data: toFrontendFollowUp(existing) });
            return;
          }
        }
      }
      const newId = body.id || crypto.randomUUID();
      const now = new Date().toISOString();
      const insertData = {
        id: newId,
        ...toDbFollowUp(body, userId),
        created_at: now,
        updated_at: now,
      };
      fallbackFollowUps.set(newId, insertData);
      res.status(201).json({ success: true, data: toFrontendFollowUp(insertData) });
      return;
    }

    // Duplicate prevention during retries
    if (body.callId) {
      try {
        const { data: existing } = await supabase
          .from('follow_ups')
          .select('*')
          .eq('call_id', body.callId)
          .eq('task', trimmedTask)
          .maybeSingle();

        if (existing) {
          res.status(200).json({ success: true, data: toFrontendFollowUp(existing) });
          return;
        }
      } catch (_) {}

      for (const existing of fallbackFollowUps.values()) {
        if (existing.call_id === body.callId && existing.task === trimmedTask) {
          res.status(200).json({ success: true, data: toFrontendFollowUp(existing) });
          return;
        }
      }
    }

    const insertData = toDbFollowUp(body, userId);
    const newId = body.id || crypto.randomUUID();
    const now = new Date().toISOString();
    const memoryRecord = {
      id: newId,
      ...insertData,
      created_at: now,
      updated_at: now,
    };

    const { data, error } = await supabase.from('follow_ups').insert(insertData).select().single();

    if (error || !data) {
      fallbackFollowUps.set(newId, memoryRecord);
      res.status(201).json({ success: true, data: toFrontendFollowUp(memoryRecord) });
      return;
    }

    fallbackFollowUps.set(String(data.id), data);
    res.status(201).json({ success: true, data: toFrontendFollowUp(data) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to create follow-up' });
  }
});

// PATCH /api/followups/:id - Update follow-up
followUpsRouter.patch('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const supabase = req.supabase;
    const id = String(req.params.id);
    const body = req.body;

    if (body.priority !== undefined && !VALID_PRIORITIES.includes(body.priority)) {
      res.status(400).json({ success: false, error: `Invalid priority. Must be: ${VALID_PRIORITIES.join(', ')}` });
      return;
    }

    if (body.status !== undefined && !VALID_STATUSES.includes(body.status)) {
      res.status(400).json({ success: false, error: `Invalid status. Must be: ${VALID_STATUSES.join(', ')}` });
      return;
    }

    const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';
    const updateData = toDbFollowUp(body, userId);
    delete updateData.user_id;

    if (body.status === 'Completed' && !updateData.completed_at) {
      updateData.completed_at = new Date().toISOString();
    } else if (body.status === 'Pending') {
      updateData.completed_at = null;
    }

    if (!supabase) {
      const existing = fallbackFollowUps.get(id);
      if (!existing) {
        res.status(404).json({ success: false, error: 'Follow-up not found' });
        return;
      }
      const updated = {
        ...existing,
        ...updateData,
        updated_at: new Date().toISOString(),
      };
      fallbackFollowUps.set(id, updated);
      res.status(200).json({ success: true, data: toFrontendFollowUp(updated) });
      return;
    }

    const { data, error } = await supabase
      .from('follow_ups')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      res.status(404).json({ success: false, error: error ? error.message : 'Follow-up not found or unauthorized' });
      return;
    }

    res.status(200).json({ success: true, data: toFrontendFollowUp(data) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to update follow-up' });
  }
});

// DELETE /api/followups/:id - Delete follow-up
followUpsRouter.delete('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const supabase = req.supabase;
    const id = String(req.params.id);

    if (!supabase) {
      if (!fallbackFollowUps.has(id)) {
        res.status(404).json({ success: false, error: 'Follow-up not found' });
        return;
      }
      fallbackFollowUps.delete(id);
      res.status(200).json({ success: true, message: 'Follow-up deleted successfully' });
      return;
    }

    const { error } = await supabase.from('follow_ups').delete().eq('id', id);

    if (error) {
      res.status(500).json({ success: false, error: error.message });
      return;
    }

    res.status(200).json({ success: true, message: 'Follow-up deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to delete follow-up' });
  }
});
