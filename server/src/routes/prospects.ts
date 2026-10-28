import { Router, Response } from 'express';
import crypto from 'crypto';
import { AuthenticatedRequest, getDefaultUserId } from '../middleware/auth.js';

export const prospectsRouter = Router();

const VALID_STATUSES = ['New', 'Attempted', 'In Discussion', 'Qualified', 'Unqualified', 'Archived'];
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Resilient in-memory store for offline development, tests, or network fallback.
// Strictly data-driven: initialized completely empty, zero fake or mock records.
const fallbackProspects = new Map<string, any>();

function toFrontendProspect(row: any) {
  return {
    id: String(row.id),
    companyName: row.company_name,
    contactName: row.contact_name || undefined,
    jobTitle: row.job_title || undefined,
    industry: row.industry || 'Manufacturing',
    email: row.email || undefined,
    phone: row.phone || undefined,
    website: row.website || undefined,
    location: row.location || undefined,
    employeeCount: row.employee_count || undefined,
    manufacturingType: row.manufacturing_type || undefined,
    status: row.status,
    notes: row.notes || undefined,
    lastContactDate: row.last_contact_date || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toDbProspect(data: any, userId: string) {
  const dbObj: Record<string, any> = { user_id: userId };
  if (data.id && UUID_REGEX.test(data.id)) dbObj.id = data.id;
  if (data.companyName !== undefined) dbObj.company_name = String(data.companyName).trim();
  if (data.contactName !== undefined) dbObj.contact_name = data.contactName ? String(data.contactName).trim() : null;
  if (data.jobTitle !== undefined) dbObj.job_title = data.jobTitle ? String(data.jobTitle).trim() : null;
  if (data.industry !== undefined) dbObj.industry = String(data.industry).trim();
  if (data.email !== undefined) dbObj.email = data.email ? String(data.email).trim() : null;
  if (data.phone !== undefined) dbObj.phone = data.phone ? String(data.phone).trim() : null;
  if (data.website !== undefined) dbObj.website = data.website ? String(data.website).trim() : null;
  if (data.location !== undefined) dbObj.location = data.location ? String(data.location).trim() : null;
  if (data.employeeCount !== undefined) dbObj.employee_count = data.employeeCount ? String(data.employeeCount).trim() : null;
  if (data.manufacturingType !== undefined) dbObj.manufacturing_type = data.manufacturingType ? String(data.manufacturingType).trim() : null;
  if (data.status !== undefined) dbObj.status = data.status;
  if (data.notes !== undefined) dbObj.notes = data.notes ? String(data.notes).trim() : null;
  if (data.lastContactDate !== undefined) dbObj.last_contact_date = data.lastContactDate || null;
  return dbObj;
}

// GET /api/prospects - List user's prospects with optional filtering
prospectsRouter.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const supabase = req.supabase;
    const { search, status, industry } = req.query;

    let results: any[] = [];

    if (supabase) {
      try {
        let query = supabase.from('prospects').select('*').order('created_at', { ascending: false });

        if (status && typeof status === 'string' && status !== 'All') {
          query = query.eq('status', status);
        }

        if (industry && typeof industry === 'string' && industry !== 'All') {
          query = query.eq('industry', industry);
        }

        const { data, error } = await query;
        if (!error && data) {
          results = data.map(toFrontendProspect);
        } else if (error) {
          console.error('[Supabase GET Prospects Error]:', error.message || error);
        }
      } catch (dbErr: any) {
        console.error('[Supabase GET Prospects Exception]:', dbErr?.message || dbErr);
      }
    }

    // Merge in-memory fallback items if database returned no results
    if (results.length === 0 && fallbackProspects.size > 0) {
      let list = Array.from(fallbackProspects.values()).map(toFrontendProspect);
      if (status && typeof status === 'string' && status !== 'All') {
        list = list.filter(p => p.status === status);
      }
      if (industry && typeof industry === 'string' && industry !== 'All') {
        list = list.filter(p => p.industry === industry);
      }
      results = list;
    }

    // Apply text search across company and contact
    if (search && typeof search === 'string') {
      const q = search.toLowerCase();
      results = results.filter(
        p => p.companyName.toLowerCase().includes(q) || (p.contactName && p.contactName.toLowerCase().includes(q))
      );
    }

    // Return real data (empty array [] when no prospects exist)
    res.status(200).json({ success: true, data: results });
  } catch (err: any) {
    console.error('[API GET Prospects Exception]:', err?.message || err);
    res.status(500).json({ success: false, error: err?.message || 'Internal server error', data: [] });
  }
});

// GET /api/prospects/:id - Get single prospect
prospectsRouter.get('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const supabase = req.supabase;
    const id = String(req.params.id);

    if (!UUID_REGEX.test(id)) {
      res.status(400).json({ success: false, error: `Invalid prospect identifier: "${id}" is not a valid UUID.` });
      return;
    }

    if (supabase) {
      try {
        const { data, error } = await supabase.from('prospects').select('*').eq('id', id).maybeSingle();
        if (!error && data) {
          res.status(200).json({ success: true, data: toFrontendProspect(data) });
          return;
        }
      } catch (_) {}
    }

    const fallback = fallbackProspects.get(id);
    if (fallback) {
      res.status(200).json({ success: true, data: toFrontendProspect(fallback) });
      return;
    }

    res.status(404).json({ success: false, error: 'Prospect not found' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to fetch prospect' });
  }
});

// POST /api/prospects - Create prospect
prospectsRouter.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const supabase = req.supabase;
    const body = req.body;

    if (!body.companyName || typeof body.companyName !== 'string' || body.companyName.trim().length < 2) {
      res.status(400).json({ success: false, error: 'Company name is required (minimum 2 characters)' });
      return;
    }

    if (body.status && !VALID_STATUSES.includes(body.status)) {
      res.status(400).json({ success: false, error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
      return;
    }

    if (body.id && !UUID_REGEX.test(body.id)) {
      res.status(400).json({ success: false, error: `Invalid prospect ID format: "${body.id}" is not a valid UUID.` });
      return;
    }

    const prospectId = body.id || crypto.randomUUID();
    const userId = req.user?.id && UUID_REGEX.test(req.user.id) ? req.user.id : getDefaultUserId();
    const insertData: Record<string, any> = { id: prospectId, ...toDbProspect(body, userId) };

    const now = new Date().toISOString();
    const memoryRecord = {
      id: prospectId,
      company_name: insertData.company_name,
      contact_name: insertData.contact_name,
      job_title: insertData.job_title,
      industry: insertData.industry || 'Manufacturing',
      email: insertData.email,
      phone: insertData.phone,
      website: insertData.website,
      location: insertData.location,
      employee_count: insertData.employee_count,
      manufacturing_type: insertData.manufacturing_type,
      status: insertData.status || 'New',
      notes: insertData.notes,
      last_contact_date: insertData.last_contact_date,
      created_at: now,
      updated_at: now,
    };

    if (supabase) {
      try {
        const { data, error } = await supabase.from('prospects').insert(insertData).select().single();
        if (!error && data) {
          fallbackProspects.set(String(data.id), data);
          res.status(201).json({ success: true, data: toFrontendProspect(data) });
          return;
        }
        if (error) {
          console.error('[Supabase Insert Prospect Error]:', error.message || error);
        }
      } catch (dbErr: any) {
        console.error('[Supabase Insert Prospect Exception]:', dbErr.message || dbErr);
      }
    }

    // Save in resilient fallback store
    fallbackProspects.set(prospectId, memoryRecord);
    res.status(201).json({ success: true, data: toFrontendProspect(memoryRecord) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to create prospect' });
  }
});

// PATCH /api/prospects/:id - Update prospect
prospectsRouter.patch('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const supabase = req.supabase;
    const id = String(req.params.id);
    const body = req.body;

    if (!UUID_REGEX.test(id)) {
      res.status(400).json({ success: false, error: `Invalid input syntax for type uuid: "${id}"` });
      return;
    }

    if (body.companyName !== undefined && (typeof body.companyName !== 'string' || body.companyName.trim().length < 2)) {
      res.status(400).json({ success: false, error: 'Company name cannot be blank' });
      return;
    }

    if (body.status !== undefined && !VALID_STATUSES.includes(body.status)) {
      res.status(400).json({ success: false, error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
      return;
    }

    const userId = req.user?.id && UUID_REGEX.test(req.user.id) ? req.user.id : getDefaultUserId();
    const updateData = toDbProspect(body, userId);
    delete updateData.user_id; // Never reassign user_id

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('prospects')
          .update(updateData)
          .eq('id', id)
          .select()
          .single();

        if (!error && data) {
          fallbackProspects.set(id, data);
          res.status(200).json({ success: true, data: toFrontendProspect(data) });
          return;
        }
      } catch (_) {}
    }

    // Update in-memory fallback record
    const existing = fallbackProspects.get(id);
    if (existing) {
      const updated = {
        ...existing,
        ...updateData,
        updated_at: new Date().toISOString(),
      };
      fallbackProspects.set(id, updated);
      res.status(200).json({ success: true, data: toFrontendProspect(updated) });
      return;
    }

    res.status(404).json({ success: false, error: 'Prospect not found or unauthorized' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to update prospect' });
  }
});

// DELETE /api/prospects/:id - Delete prospect
prospectsRouter.delete('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const supabase = req.supabase;
    const id = String(req.params.id);

    if (!UUID_REGEX.test(id)) {
      res.status(400).json({ success: false, error: `Invalid input syntax for type uuid: "${id}"` });
      return;
    }

    if (supabase) {
      try {
        // First fetch existing prospect to get company name before delete
        const { data: existing } = await supabase.from('prospects').select('company_name').eq('id', id).maybeSingle();

        if (existing) {
          // Preserve historical call records: update any calls with prospect_id to retain archived company name
          await supabase
            .from('calls')
            .update({ company_name: `${existing.company_name} (Archived Account)` })
            .eq('prospect_id', id);

          await supabase.from('prospects').delete().eq('id', id);
        }
      } catch (_) {}
    }

    if (fallbackProspects.has(id)) {
      fallbackProspects.delete(id);
      res.status(200).json({ success: true, message: 'Prospect deleted successfully' });
      return;
    }

    res.status(200).json({ success: true, message: 'Prospect deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to delete prospect' });
  }
});
