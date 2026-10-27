import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { FollowUp, FollowUpPriority, FollowUpStatus } from '../../types';
import { useData } from '../../context/DataContext';
import { validateFollowUpForm, ValidationErrors } from '../../lib/validation';

interface FollowUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<FollowUp, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void> | void;
  initialData?: FollowUp | null;
  defaultProspectId?: string;
  defaultCallId?: string;
  defaultTask?: string;
  defaultDueDate?: string;
  defaultPriority?: FollowUpPriority;
  defaultNotes?: string;
  title?: string;
  description?: string;
}

export const FollowUpModal: React.FC<FollowUpModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  defaultProspectId,
  defaultCallId,
  defaultTask,
  defaultDueDate,
  defaultPriority,
  defaultNotes,
  title,
  description,
}) => {
  const { prospects } = useData();

  const [prospectId, setProspectId] = useState('');
  const [task, setTask] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<FollowUpPriority>('Medium');
  const [status, setStatus] = useState<FollowUpStatus>('Pending');
  const [notes, setNotes] = useState('');

  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setProspectId(initialData.prospectId);
      setTask(initialData.task);
      setDueDate(initialData.dueDate);
      setPriority(initialData.priority);
      setStatus(initialData.status);
      setNotes(initialData.notes || '');
    } else {
      const selectedId = defaultProspectId || (prospects.length > 0 ? prospects[0].id : '');
      setProspectId(selectedId);
      setTask(defaultTask || '');
      const defaultDate = defaultDueDate || new Date(Date.now() + 86400000).toISOString().split('T')[0];
      setDueDate(defaultDate);
      setPriority(defaultPriority || 'Medium');
      setStatus('Pending');
      setNotes(defaultNotes || '');
    }
    setErrors({});
    setIsSubmitting(false);
  }, [
    initialData,
    defaultProspectId,
    defaultCallId,
    defaultTask,
    defaultDueDate,
    defaultPriority,
    defaultNotes,
    prospects,
    isOpen,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const validationErrors = validateFollowUpForm({
      prospectId,
      task,
      dueDate,
    });

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      const selectedProspect = prospects.find(p => p.id === prospectId);

      await onSubmit({
        prospectId,
        companyName: selectedProspect ? selectedProspect.companyName : 'Unknown Company',
        contactName: selectedProspect?.contactName,
        callId: defaultCallId || initialData?.callId,
        task: task.trim(),
        dueDate,
        priority,
        status,
        notes: notes.trim() || undefined,
      });

      onClose();
    } catch (err: any) {
      setErrors({ form: err?.message || 'Failed to save follow-up task. Please retry.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title || (initialData ? 'Edit Follow-up Task' : 'Schedule Follow-up Action')}
      description={description || 'Track post-call tasks, quote dispatches, and scheduled check-ins.'}
      maxWidth="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} type="button" disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={handleSubmit} 
            type="button" 
            isLoading={isSubmitting}
            disabled={isSubmitting}
          >
            {initialData ? 'Update Task' : 'Save Follow-up'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errors.form && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-semibold flex items-center gap-2">
            <span>{errors.form}</span>
          </div>
        )}
        {/* Associated Prospect */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Target Prospect & Account <span className="text-rose-500">*</span>
          </label>
          <select
            value={prospectId}
            onChange={(e) => setProspectId(e.target.value)}
            disabled={!!initialData}
            className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 ${
              errors.prospectId
                ? 'border-rose-400 focus:ring-rose-400'
                : 'border-slate-300 focus:ring-brand-500 focus:border-brand-500'
            }`}
          >
            <option value="">-- Select Prospect --</option>
            {prospects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.companyName} {p.contactName ? `(${p.contactName})` : ''} — {p.industry}
              </option>
            ))}
          </select>
          {errors.prospectId && (
            <p className="mt-1 text-xs text-rose-600">{errors.prospectId}</p>
          )}
        </div>

        {/* Task description */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Action / Task Description <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={task}
            onChange={(e) => setTask(e.target.value)}
            placeholder="e.g. Email CAD specifications for servo motor mounting plate"
            className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 ${
              errors.task
                ? 'border-rose-400 focus:ring-rose-400'
                : 'border-slate-300 focus:ring-brand-500 focus:border-brand-500'
            }`}
          />
          {errors.task && <p className="mt-1 text-xs text-rose-600">{errors.task}</p>}
        </div>

        {/* Due Date & Priority */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Due Date <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 ${
                errors.dueDate
                  ? 'border-rose-400 focus:ring-rose-400'
                  : 'border-slate-300 focus:ring-brand-500 focus:border-brand-500'
              }`}
            />
            {errors.dueDate && <p className="mt-1 text-xs text-rose-600">{errors.dueDate}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as FollowUpPriority)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as FollowUpStatus)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="Pending">Pending</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Additional Notes */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Task Context / Notes
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add relevant engineering constraints, contact reminders, or file references..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
          />
        </div>
      </form>
    </Modal>
  );
};
