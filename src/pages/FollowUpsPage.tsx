import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Plus, 
  Calendar, 
  CheckCircle2, 
  Building2, 
  Trash2, 
  Edit3, 
  Check,
  PhoneCall,
  RotateCcw
} from 'lucide-react';
import { Card, CardContent } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { EmptyState } from '../components/common/EmptyState';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { FollowUpModal } from '../components/followups/FollowUpModal';
import { FollowUp } from '../types';
import { useData } from '../context/DataContext';
import { isOverdue, isDueToday, isDueSoon, formatDisplayDate } from '../lib/dateUtils';

export const FollowUpsPage: React.FC = () => {
  const { 
    followUps, 
    toggleFollowUpComplete, 
    updateFollowUp, 
    addFollowUp, 
    deleteFollowUp 
  } = useData();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Pending' | 'Overdue' | 'Completed'>('All');
  const [priorityFilter, setPriorityFilter] = useState<string>('All');
  const [dueDateFilter, setDueDateFilter] = useState<'All' | 'Overdue' | 'Due Today' | 'Due Soon'>('All');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFollowUp, setEditingFollowUp] = useState<FollowUp | null>(null);
  const [deletingFollowUp, setDeletingFollowUp] = useState<FollowUp | null>(null);

  // Filtering
  const filteredFollowUps = useMemo(() => {
    return followUps.filter((item) => {
      const matchesSearch =
        item.task.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.contactName && item.contactName.toLowerCase().includes(searchQuery.toLowerCase()));

      const taskIsOverdue = isOverdue(item.dueDate, item.status);
      const taskIsToday = isDueToday(item.dueDate) && item.status === 'Pending';
      const taskIsSoon = isDueSoon(item.dueDate) && item.status === 'Pending';

      let matchesStatus = true;
      if (statusFilter === 'Pending') matchesStatus = item.status === 'Pending';
      else if (statusFilter === 'Completed') matchesStatus = item.status === 'Completed';
      else if (statusFilter === 'Overdue') matchesStatus = taskIsOverdue;

      const matchesPriority = priorityFilter === 'All' || item.priority === priorityFilter;

      let matchesDueDate = true;
      if (dueDateFilter === 'Overdue') matchesDueDate = taskIsOverdue;
      else if (dueDateFilter === 'Due Today') matchesDueDate = taskIsToday;
      else if (dueDateFilter === 'Due Soon') matchesDueDate = taskIsSoon;

      return matchesSearch && matchesStatus && matchesPriority && matchesDueDate;
    });
  }, [followUps, searchQuery, statusFilter, priorityFilter, dueDateFilter]);

  const handleEdit = (fu: FollowUp) => {
    setEditingFollowUp(fu);
    setIsModalOpen(true);
  };

  const handleModalSubmit = (data: Omit<FollowUp, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingFollowUp) {
      updateFollowUp(editingFollowUp.id, data);
    } else {
      addFollowUp(data);
    }
    setEditingFollowUp(null);
  };

  const confirmDelete = () => {
    if (deletingFollowUp) {
      deleteFollowUp(deletingFollowUp.id);
      setDeletingFollowUp(null);
    }
  };

  const pendingCount = followUps.filter(f => f.status === 'Pending').length;
  const overdueCount = followUps.filter(f => isOverdue(f.dueDate, f.status)).length;
  const completedCount = followUps.filter(f => f.status === 'Completed').length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Follow-up Tasks</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Coordinate technical quotes, case studies, and scheduled calls with manufacturing buyers.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          icon={<Plus className="h-4 w-4" />}
          onClick={() => {
            setEditingFollowUp(null);
            setIsModalOpen(true);
          }}
        >
          Add Follow-up Task
        </Button>
      </div>

      {/* Quick Summary Pill Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => {
            setStatusFilter('All');
            setDueDateFilter('All');
          }}
          className={`p-3.5 rounded-xl border text-left transition-all ${
            statusFilter === 'All' && dueDateFilter === 'All'
              ? 'bg-white border-brand-500 ring-2 ring-brand-100 shadow-sm'
              : 'bg-white/80 border-slate-200 hover:border-slate-300'
          }`}
        >
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">All Tasks</span>
          <span className="text-xl font-bold text-slate-900 mt-0.5 block">{followUps.length}</span>
        </button>

        <button
          onClick={() => {
            setStatusFilter('Pending');
            setDueDateFilter('All');
          }}
          className={`p-3.5 rounded-xl border text-left transition-all ${
            statusFilter === 'Pending' && dueDateFilter === 'All'
              ? 'bg-white border-brand-500 ring-2 ring-brand-100 shadow-sm'
              : 'bg-white/80 border-slate-200 hover:border-slate-300'
          }`}
        >
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Pending</span>
          <span className="text-xl font-bold text-amber-700 mt-0.5 block">{pendingCount}</span>
        </button>

        <button
          onClick={() => {
            setStatusFilter('Overdue');
            setDueDateFilter('All');
          }}
          className={`p-3.5 rounded-xl border text-left transition-all ${
            statusFilter === 'Overdue'
              ? 'bg-white border-rose-500 ring-2 ring-rose-100 shadow-sm'
              : 'bg-white/80 border-slate-200 hover:border-slate-300'
          }`}
        >
          <span className="text-[11px] font-semibold text-rose-500 uppercase tracking-wider block">Overdue</span>
          <span className="text-xl font-bold text-rose-600 mt-0.5 block">{overdueCount}</span>
        </button>

        <button
          onClick={() => {
            setStatusFilter('Completed');
            setDueDateFilter('All');
          }}
          className={`p-3.5 rounded-xl border text-left transition-all ${
            statusFilter === 'Completed'
              ? 'bg-white border-emerald-500 ring-2 ring-emerald-100 shadow-sm'
              : 'bg-white/80 border-slate-200 hover:border-slate-300'
          }`}
        >
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Completed</span>
          <span className="text-xl font-bold text-emerald-600 mt-0.5 block">{completedCount}</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4 items-center">
            <div className="sm:col-span-6 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tasks by description, company, or contact name..."
                className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-300 text-sm placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="sm:col-span-3">
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="All">All Priorities</option>
                <option value="High">High Priority</option>
                <option value="Medium">Medium Priority</option>
                <option value="Low">Low Priority</option>
              </select>
            </div>

            <div className="sm:col-span-3">
              <select
                value={dueDateFilter}
                onChange={(e) => setDueDateFilter(e.target.value as any)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="All">All Due Dates</option>
                <option value="Overdue">Overdue Tasks</option>
                <option value="Due Today">Due Today</option>
                <option value="Due Soon">Due Next 3 Days</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Follow-up Tasks List Card */}
      <Card>
        <CardContent className="p-0">
          {filteredFollowUps.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={<CheckCircle2 className="h-8 w-8 text-slate-400" />}
                title={searchQuery || statusFilter !== 'All' || priorityFilter !== 'All' || dueDateFilter !== 'All' ? 'No matching follow-ups found' : 'No follow-up tasks found'}
                description={
                  searchQuery || statusFilter !== 'All' || priorityFilter !== 'All' || dueDateFilter !== 'All'
                    ? 'Try adjusting your search terms or filters.'
                    : 'Add a follow-up task to get started.'
                }
                action={
                  searchQuery || statusFilter !== 'All' || priorityFilter !== 'All' || dueDateFilter !== 'All' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSearchQuery('');
                        setStatusFilter('All');
                        setPriorityFilter('All');
                        setDueDateFilter('All');
                      }}
                    >
                      Reset Filters
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<Plus className="h-4 w-4" />}
                      onClick={() => {
                        setEditingFollowUp(null);
                        setIsModalOpen(true);
                      }}
                    >
                      Create First Task
                    </Button>
                  )
                }
              />
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredFollowUps.map((item) => {
                const isCompleted = item.status === 'Completed';
                const overdue = isOverdue(item.dueDate, item.status);
                const today = isDueToday(item.dueDate) && !isCompleted;

                return (
                  <div
                    key={item.id}
                    className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                      isCompleted ? 'bg-slate-50/50 hover:bg-slate-50' : 'hover:bg-slate-50/80 bg-white'
                    }`}
                  >
                    {/* Left: Checkbox & Task details */}
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      <button
                        onClick={() => toggleFollowUpComplete(item.id)}
                        className={`mt-0.5 h-5 w-5 rounded-md border flex items-center justify-center shrink-0 transition-all focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                          isCompleted
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'border-slate-300 hover:border-slate-400 bg-white'
                        }`}
                        title={isCompleted ? 'Click to reopen task' : 'Click to mark complete'}
                        aria-label={`Toggle task "${item.task}"`}
                      >
                        {isCompleted && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                      </button>

                      <div className="space-y-1 min-w-0 flex-1">
                        <p
                          className={`text-sm sm:text-base font-semibold leading-snug ${
                            isCompleted ? 'line-through text-slate-400' : 'text-slate-900'
                          }`}
                        >
                          {item.task}
                        </p>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className="font-semibold text-slate-800 flex items-center gap-1">
                            <Building2 className="h-3.5 w-3.5 text-slate-400" />
                            {item.companyName}
                          </span>
                          {item.contactName && <span>({item.contactName})</span>}
                          <span>•</span>
                          <span
                            className={`flex items-center gap-1 font-medium ${
                              overdue
                                ? 'text-rose-600 font-semibold'
                                : today
                                ? 'text-amber-600 font-semibold'
                                : 'text-slate-600'
                            }`}
                          >
                            <Calendar className="h-3.5 w-3.5" />
                            {today ? 'Due Today' : overdue ? `Overdue (${formatDisplayDate(item.dueDate)})` : `Due ${formatDisplayDate(item.dueDate)}`}
                          </span>

                          {item.callId && (
                            <>
                              <span>•</span>
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium text-[11px] flex items-center gap-1">
                                <PhoneCall className="h-3 w-3" />
                                From Call
                              </span>
                            </>
                          )}
                        </div>

                        {item.notes && (
                          <p className="text-xs text-slate-500 mt-1 italic line-clamp-2">
                            "{item.notes}"
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right: Badges & Actions */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-slate-100">
                      <div className="flex items-center gap-2">
                        <Badge status={item.priority} size="sm" />
                        <Badge status={item.status} size="sm" />
                      </div>

                      <div className="flex items-center gap-1">
                        {isCompleted && (
                          <button
                            onClick={() => toggleFollowUpComplete(item.id)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Re-open task"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleEdit(item)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Edit Task"
                          aria-label={`Edit ${item.task}`}
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeletingFollowUp(item)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete Task"
                          aria-label={`Delete ${item.task}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Follow-up Add / Edit Modal */}
      <FollowUpModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingFollowUp(null);
        }}
        onSubmit={handleModalSubmit}
        initialData={editingFollowUp}
      />

      {/* Confirmation Dialog on Delete */}
      <ConfirmDialog
        isOpen={!!deletingFollowUp}
        onClose={() => setDeletingFollowUp(null)}
        onConfirm={confirmDelete}
        title="Delete Follow-up Task"
        message={`Are you sure you want to delete the task: "${deletingFollowUp?.task}"?`}
        confirmLabel="Confirm Delete"
      />
    </div>
  );
};
