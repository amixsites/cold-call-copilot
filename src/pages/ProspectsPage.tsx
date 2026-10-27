import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  Filter, 
  Plus, 
  PhoneCall, 
  Edit3, 
  Trash2, 
  Eye, 
  Building2, 
  Mail, 
  Phone, 
  MapPin, 
  Clock
} from 'lucide-react';
import { Card, CardContent } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { EmptyState } from '../components/common/EmptyState';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { ProspectFormModal } from '../components/prospects/ProspectFormModal';
import { ProspectDetailDrawer } from '../components/prospects/ProspectDetailDrawer';
import { Prospect } from '../types';
import { useData } from '../context/DataContext';

export const ProspectsPage: React.FC = () => {
  const navigate = useNavigate();
  const { prospects, addProspect, updateProspect, deleteProspect } = useData();

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndustry, setSelectedIndustry] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');

  // Modal states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProspect, setEditingProspect] = useState<Prospect | null>(null);
  const [viewingProspect, setViewingProspect] = useState<Prospect | null>(null);
  const [deletingProspect, setDeletingProspect] = useState<Prospect | null>(null);

  // Industry options derived from existing data + presets
  const industries = useMemo(() => {
    const list = Array.from(new Set(prospects.map(p => p.industry))).filter(Boolean);
    return ['All', ...list];
  }, [prospects]);

  const statuses = ['All', 'New', 'Attempted', 'In Discussion', 'Qualified', 'Unqualified', 'Archived'];

  // Filtered prospects
  const filteredProspects = useMemo(() => {
    return prospects.filter((p) => {
      const matchesSearch = 
        p.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.contactName && p.contactName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.location && p.location.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesIndustry = selectedIndustry === 'All' || p.industry === selectedIndustry;
      const matchesStatus = selectedStatus === 'All' || p.status === selectedStatus;

      return matchesSearch && matchesIndustry && matchesStatus;
    });
  }, [prospects, searchQuery, selectedIndustry, selectedStatus]);

  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const handleEdit = (p: Prospect) => {
    setEditingProspect(p);
    setIsFormOpen(true);
  };

  const handleFormSubmit = (data: Omit<Prospect, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingProspect) {
      updateProspect(editingProspect.id, data);
      if (viewingProspect?.id === editingProspect.id) {
        setViewingProspect({ ...editingProspect, ...data, updatedAt: new Date().toISOString() });
      }
      setFeedbackMessage(`Updated prospect "${data.companyName}" successfully.`);
    } else {
      const created = addProspect(data);
      setFeedbackMessage(`Added prospect "${created.companyName}" successfully.`);
    }
    setEditingProspect(null);
    setTimeout(() => setFeedbackMessage(null), 3000);
  };

  const confirmDelete = () => {
    if (deletingProspect) {
      const name = deletingProspect.companyName;
      deleteProspect(deletingProspect.id);
      if (viewingProspect?.id === deletingProspect.id) {
        setViewingProspect(null);
      }
      setDeletingProspect(null);
      setFeedbackMessage(`Prospect "${name}" deleted.`);
      setTimeout(() => setFeedbackMessage(null), 3000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Manufacturing Prospects</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Review production facilities, tooling context, and contact stakeholders.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          icon={<Plus className="h-4 w-4" />}
          onClick={() => {
            setEditingProspect(null);
            setIsFormOpen(true);
          }}
        >
          Add New Prospect
        </Button>
      </div>

      {feedbackMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 rounded-xl flex items-center gap-2 animate-fadeIn">
          <span>{feedbackMessage}</span>
        </div>
      )}


      {/* Search & Filter Controls */}
      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4 items-center">
            {/* Search Box */}
            <div className="sm:col-span-5 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by company name, contact, or location..."
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

            {/* Filter: Industry */}
            <div className="sm:col-span-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-slate-400 shrink-0 hidden sm:block" />
                <select
                  value={selectedIndustry}
                  onChange={(e) => setSelectedIndustry(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {industries.map((ind) => (
                    <option key={ind} value={ind}>
                      {ind === 'All' ? 'All Industries' : ind}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Filter: Status */}
            <div className="sm:col-span-3">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {statuses.map((st) => (
                  <option key={st} value={st}>
                    {st === 'All' ? 'All Statuses' : st}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Prospects Table Card */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {filteredProspects.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={<Building2 className="h-8 w-8 text-slate-400" />}
                title={searchQuery || selectedIndustry !== 'All' || selectedStatus !== 'All' ? 'No matching prospects found' : 'No prospects found'}
                description={
                  searchQuery || selectedIndustry !== 'All' || selectedStatus !== 'All'
                    ? 'Try adjusting your search terms or clearing your industry and status filters.'
                    : 'Create a prospect to get started.'
                }
                action={
                  searchQuery || selectedIndustry !== 'All' || selectedStatus !== 'All' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedIndustry('All');
                        setSelectedStatus('All');
                      }}
                    >
                      Clear Filters
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<Plus className="h-4 w-4" />}
                      onClick={() => {
                        setEditingProspect(null);
                        setIsFormOpen(true);
                      }}
                    >
                      Add Prospect
                    </Button>
                  )
                }
              />
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                  <th className="py-3 px-4 sm:px-6">Company Name</th>
                  <th className="py-3 px-4">Contact & Role</th>
                  <th className="py-3 px-4 hidden md:table-cell">Industry</th>
                  <th className="py-3 px-4 hidden lg:table-cell">Contact Details</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 hidden sm:table-cell">Last Contact</th>
                  <th className="py-3 px-4 sm:px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                {filteredProspects.map((prospect) => (
                  <tr 
                    key={prospect.id} 
                    className="hover:bg-slate-50/80 transition-colors group"
                  >
                    {/* Company */}
                    <td className="py-3.5 px-4 sm:px-6">
                      <div className="font-semibold text-slate-900 group-hover:text-brand-700 transition-colors">
                        {prospect.companyName}
                      </div>
                      {prospect.location && (
                        <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                          <MapPin className="h-3 w-3" />
                          <span>{prospect.location}</span>
                        </div>
                      )}
                    </td>

                    {/* Contact Person & Job Title */}
                    <td className="py-3.5 px-4">
                      {prospect.contactName ? (
                        <div>
                          <div className="font-medium text-slate-800">{prospect.contactName}</div>
                          <div className="text-[11px] text-slate-500">{prospect.jobTitle || 'Role unknown'}</div>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-xs">Unassigned</span>
                      )}
                    </td>

                    {/* Industry */}
                    <td className="py-3.5 px-4 hidden md:table-cell text-xs text-slate-600">
                      <span className="px-2 py-1 bg-slate-100 rounded text-slate-700 font-medium">
                        {prospect.industry}
                      </span>
                    </td>

                    {/* Email / Phone */}
                    <td className="py-3.5 px-4 hidden lg:table-cell text-xs text-slate-500">
                      <div className="space-y-0.5">
                        {prospect.email && (
                          <div className="flex items-center gap-1.5 truncate max-w-[190px]">
                            <Mail className="h-3 w-3 text-slate-400 shrink-0" />
                            <a href={`mailto:${prospect.email}`} className="hover:text-brand-600 truncate">
                              {prospect.email}
                            </a>
                          </div>
                        )}
                        {prospect.phone && (
                          <div className="flex items-center gap-1.5">
                            <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                            <span>{prospect.phone}</span>
                          </div>
                        )}
                        {!prospect.email && !prospect.phone && (
                          <span className="text-slate-400 italic text-xs">None listed</span>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      <Badge status={prospect.status} size="sm" />
                    </td>

                    {/* Last Contact */}
                    <td className="py-3.5 px-4 hidden sm:table-cell text-xs text-slate-500">
                      {prospect.lastContactDate ? (
                        <span className="flex items-center gap-1 text-slate-600">
                          <Clock className="h-3 w-3 text-slate-400" />
                          {prospect.lastContactDate}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic text-xs">Never</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 sm:px-6 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="primary"
                          size="sm"
                          icon={<PhoneCall className="h-3.5 w-3.5" />}
                          onClick={() => navigate(`/workspace?prospectId=${prospect.id}`)}
                          title="Open in Call Workspace"
                          className="px-2 sm:px-2.5 py-1 text-xs"
                        >
                          <span className="hidden sm:inline">Call</span>
                        </Button>

                        <button
                          onClick={() => setViewingProspect(prospect)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                          title="View Details"
                          aria-label={`View ${prospect.companyName}`}
                        >
                          <Eye className="h-4 w-4" />
                        </button>

                        <button
                          onClick={() => handleEdit(prospect)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Edit Prospect"
                          aria-label={`Edit ${prospect.companyName}`}
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>

                        <button
                          onClick={() => setDeletingProspect(prospect)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete Prospect"
                          aria-label={`Delete ${prospect.companyName}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Prospect Detail Drawer */}
      <ProspectDetailDrawer
        prospect={viewingProspect}
        isOpen={!!viewingProspect}
        onClose={() => setViewingProspect(null)}
        onEdit={(p) => {
          setViewingProspect(null);
          handleEdit(p);
        }}
        onDelete={(p) => {
          setViewingProspect(null);
          setDeletingProspect(p);
        }}
      />

      {/* Prospect Form Modal (Add/Edit) */}
      <ProspectFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingProspect(null);
        }}
        onSubmit={handleFormSubmit}
        initialData={editingProspect}
      />

      {/* Confirmation Dialog on Delete */}
      <ConfirmDialog
        isOpen={!!deletingProspect}
        onClose={() => setDeletingProspect(null)}
        onConfirm={confirmDelete}
        title="Delete Prospect Record"
        message={`Are you sure you want to remove "${deletingProspect?.companyName}"? Associated historical calls will be preserved as archived records, and pending follow-ups will be safely unlinked.`}
        confirmLabel="Confirm Delete"
      />
    </div>
  );
};
