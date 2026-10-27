import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  History,
  Search,
  Filter,
  PhoneCall,
  Clock,
  Eye,
  Calendar,
  AlertCircle,
  Building2,
  Edit3,
  Check,
  CheckCircle2,
  FileCheck2,
  HelpCircle,
  ShieldAlert,
  Save,
  X,
  Download,
} from 'lucide-react';
import { Card, CardContent } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { EmptyState } from '../components/common/EmptyState';
import { Modal } from '../components/common/Modal';
import { CallRecord, CallOutcome } from '../types';
import { useData } from '../context/DataContext';
import { formatDuration, formatDisplayDate } from '../lib/dateUtils';
import { api } from '../lib/api';
import { downloadTranscriptAsTxt } from '../lib/transcriptExport';

export const CallHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { calls, followUps, updateCallRecord, toggleFollowUpComplete, getProspectById } = useData();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Completed' | 'In Progress'>('All');
  const [outcomeFilter, setOutcomeFilter] = useState<string>('All');
  const [viewingCall, setViewingCall] = useState<CallRecord | null>(null);

  // In-modal editing state
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editNotes, setEditNotes] = useState('');
  const [editBusinessProblems, setEditBusinessProblems] = useState('');
  const [editEvidence, setEditEvidence] = useState('');
  const [editUnknowns, setEditUnknowns] = useState('');
  const [editObjections, setEditObjections] = useState('');
  const [editOutcome, setEditOutcome] = useState<CallOutcome | undefined>(undefined);
  const [editNextAction, setEditNextAction] = useState('');
  const [editSuccessMsg, setEditSuccessMsg] = useState<string | null>(null);

  const outcomes: string[] = [
    'All',
    'Connected - Interested',
    'Connected - Follow-up Required',
    'Connected - Follow-up Needed',
    'Connected - Not Interested',
    'No Answer / Voicemail',
    'Left Voicemail',
    'Gatekeeper Blocked',
    'Callback Requested',
  ];

  const filteredCalls = useMemo(() => {
    return calls.filter((c) => {
      const matchesSearch =
        c.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.contactName && c.contactName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        c.callObjective.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.notes.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.businessProblemNotes && c.businessProblemNotes.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus = statusFilter === 'All' || c.callStatus === statusFilter;
      const matchesOutcome = outcomeFilter === 'All' || c.outcome === outcomeFilter;

      return matchesSearch && matchesStatus && matchesOutcome;
    }).sort((a, b) => new Date(b.callDate).getTime() - new Date(a.callDate).getTime());
  }, [calls, searchQuery, statusFilter, outcomeFilter]);

  const handleOpenCallModal = (call: CallRecord) => {
    setViewingCall(call);
    setIsEditingNotes(false);
    setEditNotes(call.notes || '');
    setEditBusinessProblems(call.businessProblemNotes || '');
    setEditEvidence(call.evidenceNotes || '');
    setEditUnknowns(call.unknownsNotes || '');
    setEditObjections(call.objectionsNotes || '');
    setEditOutcome(call.outcome);
    setEditNextAction(call.nextAction || '');
    setEditSuccessMsg(null);
  };

  const handleSaveEditedNotes = () => {
    if (!viewingCall) return;

    updateCallRecord(viewingCall.id, {
      notes: editNotes.trim(),
      businessProblemNotes: editBusinessProblems.trim() || undefined,
      evidenceNotes: editEvidence.trim() || undefined,
      unknownsNotes: editUnknowns.trim() || undefined,
      objectionsNotes: editObjections.trim() || undefined,
      outcome: editOutcome,
      nextAction: editNextAction.trim() || undefined,
    });

    const updated = {
      ...viewingCall,
      notes: editNotes.trim(),
      businessProblemNotes: editBusinessProblems.trim() || undefined,
      evidenceNotes: editEvidence.trim() || undefined,
      unknownsNotes: editUnknowns.trim() || undefined,
      objectionsNotes: editObjections.trim() || undefined,
      outcome: editOutcome,
      nextAction: editNextAction.trim() || undefined,
    };
    setViewingCall(updated);
    setIsEditingNotes(false);
    setEditSuccessMsg('Call notes updated successfully.');
    setTimeout(() => setEditSuccessMsg(null), 3000);
  };

  const [downloadMsg, setDownloadMsg] = useState<string | null>(null);

  const handleDownloadHistoryTranscript = async () => {
    if (!viewingCall) return;
    try {
      const segments = await api.calls.getTranscript(viewingCall.id);
      if (!segments || segments.length === 0) {
        setDownloadMsg('No transcript segments recorded for this call session.');
        setTimeout(() => setDownloadMsg(null), 3500);
        return;
      }
      downloadTranscriptAsTxt({
        callId: viewingCall.id,
        companyName: viewingCall.companyName,
        contactName: viewingCall.contactName,
        callDate: viewingCall.callDate,
        durationSeconds: viewingCall.durationSeconds,
        segments,
        notes: viewingCall.notes || viewingCall.businessProblemNotes,
        outcome: viewingCall.outcome,
      });
      setDownloadMsg('Transcript downloaded successfully!');
      setTimeout(() => setDownloadMsg(null), 3000);
    } catch (err: any) {
      setDownloadMsg(`Failed to load transcript: ${err.message || 'Network error'}`);
      setTimeout(() => setDownloadMsg(null), 3500);
    }
  };

  const linkedFollowUps = viewingCall ? followUps.filter(f => f.callId === viewingCall.id) : [];
  const associatedProspect = viewingCall ? getProspectById(viewingCall.prospectId) : undefined;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Call History & Discovery Logs</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Review past sales conversations, recorded manufacturing constraints, and edit call notes in-place.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          icon={<PhoneCall className="h-4 w-4" />}
          onClick={() => navigate('/workspace')}
        >
          New Call
        </Button>
      </div>

      {/* Quick Summary Pill Tabs */}
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => setStatusFilter('All')}
          className={`p-3 rounded-xl border text-left transition-all ${statusFilter === 'All'
              ? 'bg-white border-brand-500 ring-2 ring-brand-100 shadow-sm'
              : 'bg-white/80 border-slate-200 hover:border-slate-300'
            }`}
        >
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">All Calls</span>
          <span className="text-xl font-bold text-slate-900 mt-0.5 block">{calls.length}</span>
        </button>

        <button
          onClick={() => setStatusFilter('Completed')}
          className={`p-3 rounded-xl border text-left transition-all ${statusFilter === 'Completed'
              ? 'bg-white border-emerald-500 ring-2 ring-emerald-100 shadow-sm'
              : 'bg-white/80 border-slate-200 hover:border-slate-300'
            }`}
        >
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Completed</span>
          <span className="text-xl font-bold text-emerald-600 mt-0.5 block">
            {calls.filter(c => c.callStatus === 'Completed').length}
          </span>
        </button>

        <button
          onClick={() => setStatusFilter('In Progress')}
          className={`p-3 rounded-xl border text-left transition-all ${statusFilter === 'In Progress'
              ? 'bg-white border-amber-500 ring-2 ring-amber-100 shadow-sm'
              : 'bg-white/80 border-slate-200 hover:border-slate-300'
            }`}
        >
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">In Progress</span>
          <span className="text-xl font-bold text-amber-600 mt-0.5 block">
            {calls.filter(c => c.callStatus === 'In Progress').length}
          </span>
        </button>
      </div>

      {/* Search & Filter Controls */}
      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4 items-center">
            <div className="sm:col-span-8 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search past calls by company, contact, objective, or notes..."
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

            <div className="sm:col-span-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-slate-400 shrink-0 hidden sm:block" />
                <select
                  value={outcomeFilter}
                  onChange={(e) => setOutcomeFilter(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {outcomes.map((oc) => (
                    <option key={oc} value={oc}>
                      {oc === 'All' ? 'All Call Outcomes' : oc}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calls List / Table Card */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {filteredCalls.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={<History className="h-8 w-8 text-slate-400" />}
                title={searchQuery || outcomeFilter !== 'All' || statusFilter !== 'All' ? 'No matching calls found' : 'No calls found'}
                description={
                  searchQuery || outcomeFilter !== 'All' || statusFilter !== 'All'
                    ? 'Try adjusting your search terms or clearing your filters.'
                    : 'Conduct your first cold call in the workspace to get started.'
                }
                action={
                  searchQuery || outcomeFilter !== 'All' || statusFilter !== 'All' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSearchQuery('');
                        setStatusFilter('All');
                        setOutcomeFilter('All');
                      }}
                    >
                      Reset Filters
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<PhoneCall className="h-4 w-4" />}
                      onClick={() => navigate('/workspace')}
                    >
                      Start First Call
                    </Button>
                  )
                }
              />
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                  <th className="py-3 px-4 sm:px-6">Prospect & Contact</th>
                  <th className="py-3 px-4">Date & Duration</th>
                  <th className="py-3 px-4">Status & Outcome</th>
                  <th className="py-3 px-4 hidden md:table-cell">Objective & Problem Notes</th>
                  <th className="py-3 px-4 hidden lg:table-cell">Next Action</th>
                  <th className="py-3 px-4 sm:px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                {filteredCalls.map((call) => (
                  <tr
                    key={call.id}
                    className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                    onClick={() => handleOpenCallModal(call)}
                  >
                    {/* Company & Contact */}
                    <td className="py-3.5 px-4 sm:px-6">
                      <div className="font-semibold text-slate-900 group-hover:text-brand-700 transition-colors">
                        {call.companyName}
                      </div>
                      <div className="text-xs text-slate-500">
                        {call.contactName || 'No contact specified'}
                      </div>
                    </td>

                    {/* Date & Duration */}
                    <td className="py-3.5 px-4 text-xs text-slate-600">
                      <div className="font-medium text-slate-800">
                        {formatDisplayDate(call.callDate)}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                        <Clock className="h-3 w-3" />
                        <span>{formatDuration(call.durationSeconds)}</span>
                      </div>
                    </td>

                    {/* Status & Outcome */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col items-start gap-1">
                        <Badge status={call.callStatus} size="sm" />
                        {call.outcome && <Badge status={call.outcome} size="sm" />}
                      </div>
                    </td>

                    {/* Objective & Problem Notes Preview */}
                    <td className="py-3.5 px-4 hidden md:table-cell text-xs max-w-xs">
                      <p className="font-medium text-slate-800 truncate">
                        {call.callObjective}
                      </p>
                      {call.businessProblemNotes ? (
                        <p className="text-amber-700 truncate mt-0.5">
                          Problem: {call.businessProblemNotes}
                        </p>
                      ) : (
                        <p className="text-slate-500 truncate mt-0.5 italic">
                          {call.notes}
                        </p>
                      )}
                    </td>

                    {/* Next Action */}
                    <td className="py-3.5 px-4 hidden lg:table-cell text-xs max-w-xs">
                      {call.nextAction ? (
                        <div>
                          <p className="text-slate-800 truncate font-medium">{call.nextAction}</p>
                          {call.followUpDate && (
                            <span className="text-[11px] text-brand-600">Due {call.followUpDate}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-xs">None scheduled</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 sm:px-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Eye className="h-4 w-4" />}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenCallModal(call);
                          }}
                        >
                          View
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Comprehensive Call Details & In-Place Editing Modal */}
      {viewingCall && (
        <Modal
          isOpen={!!viewingCall}
          onClose={() => setViewingCall(null)}
          title={`Call Record: ${viewingCall.companyName}`}
          description={`Logged on ${formatDisplayDate(viewingCall.callDate, true)} (${formatDuration(viewingCall.durationSeconds)})`}
          maxWidth="2xl"
          footer={
            <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-3">
              <div className="flex items-center gap-2">
                {associatedProspect && (
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<Building2 className="h-3.5 w-3.5" />}
                    onClick={() => {
                      setViewingCall(null);
                      navigate(`/prospects`);
                    }}
                  >
                    View Account
                  </Button>
                )}
                {viewingCall.callStatus === 'In Progress' && (
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<PhoneCall className="h-3.5 w-3.5" />}
                    onClick={() => {
                      setViewingCall(null);
                      navigate(`/workspace?prospectId=${viewingCall.prospectId}`);
                    }}
                  >
                    Resume in Workspace
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {isEditingNotes ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      icon={<X className="h-3.5 w-3.5" />}
                      onClick={() => setIsEditingNotes(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<Save className="h-3.5 w-3.5" />}
                      onClick={handleSaveEditedNotes}
                    >
                      Save Notes
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      icon={<Download className="h-3.5 w-3.5" />}
                      onClick={handleDownloadHistoryTranscript}
                    >
                      Download Transcript
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      icon={<Edit3 className="h-3.5 w-3.5" />}
                      onClick={() => setIsEditingNotes(true)}
                    >
                      Edit Notes
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setViewingCall(null)}
                    >
                      Close
                    </Button>
                  </>
                )}
              </div>
            </div>
          }
        >
          <div className="space-y-5 text-sm">
            {downloadMsg && (
              <div className="p-3 bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-800 rounded-lg flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0" />
                <span>{downloadMsg}</span>
              </div>
            )}
            {editSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 rounded-lg flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>{editSuccessMsg}</span>
              </div>
            )}

            {/* Meta Strip */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status:</span>
                <Badge status={viewingCall.callStatus} size="md" />
                {viewingCall.outcome && <Badge status={viewingCall.outcome} size="md" />}
              </div>

              <div className="text-xs text-slate-600">
                Contact: <strong className="text-slate-800">{viewingCall.contactName || 'Unassigned'}</strong>
              </div>
            </div>

            {/* Objective */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Call Objective
              </h4>
              <p className="text-slate-800 font-medium bg-slate-50/60 p-3 rounded-lg border border-slate-200/60">
                {viewingCall.callObjective}
              </p>
            </div>

            {/* In-Place Editable Mode vs View Mode */}
            {isEditingNotes ? (
              <div className="space-y-4 p-4 rounded-xl border border-brand-200 bg-brand-50/10">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-brand-800 uppercase tracking-wider">
                    Editing Call Discovery Notes
                  </span>
                  <span className="text-[11px] text-slate-500">Updates this call record in-place without duplicating</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Conversation Notes
                  </label>
                  <textarea
                    rows={4}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Stated Business Problems
                  </label>
                  <textarea
                    rows={2}
                    value={editBusinessProblems}
                    onChange={(e) => setEditBusinessProblems(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Evidence / Examples
                    </label>
                    <textarea
                      rows={2}
                      value={editEvidence}
                      onChange={(e) => setEditEvidence(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Unknowns & Objections
                    </label>
                    <textarea
                      rows={2}
                      value={editUnknowns}
                      onChange={(e) => setEditUnknowns(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Next Action
                  </label>
                  <input
                    type="text"
                    value={editNextAction}
                    onChange={(e) => setEditNextAction(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>
            ) : (
              <>
                {/* Stated Business Problem */}
                {viewingCall.businessProblemNotes && (
                  <div className="p-3.5 bg-amber-50/40 rounded-xl border border-amber-200/80">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-800 mb-1 flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                      Stated Business Problem / Operational Bottleneck
                    </h4>
                    <p className="text-slate-800 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">
                      {viewingCall.businessProblemNotes}
                    </p>
                  </div>
                )}

                {/* Evidence Notes */}
                {viewingCall.evidenceNotes && (
                  <div className="p-3.5 bg-blue-50/40 rounded-xl border border-blue-200/80">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-blue-800 mb-1 flex items-center gap-1.5">
                      <FileCheck2 className="h-3.5 w-3.5 text-blue-600" />
                      Evidence & Examples Cited
                    </h4>
                    <p className="text-slate-800 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">
                      {viewingCall.evidenceNotes}
                    </p>
                  </div>
                )}

                {/* Unknowns & Objections */}
                {(viewingCall.unknownsNotes || viewingCall.objectionsNotes) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {viewingCall.unknownsNotes && (
                      <div className="p-3 bg-indigo-50/40 rounded-xl border border-indigo-200/70">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-indigo-800 mb-1 flex items-center gap-1">
                          <HelpCircle className="h-3.5 w-3.5 text-indigo-600" />
                          Unknowns & Gaps
                        </h4>
                        <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                          {viewingCall.unknownsNotes}
                        </p>
                      </div>
                    )}

                    {viewingCall.objectionsNotes && (
                      <div className="p-3 bg-rose-50/40 rounded-xl border border-rose-200/70">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-rose-800 mb-1 flex items-center gap-1">
                          <ShieldAlert className="h-3.5 w-3.5 text-rose-600" />
                          Objections Noted
                        </h4>
                        <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                          {viewingCall.objectionsNotes}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Live Call Notes */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Conversation Notes
                  </h4>
                  <div className="p-3.5 bg-white rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-700 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                    {viewingCall.notes || <span className="text-slate-400 italic">No general notes recorded</span>}
                  </div>
                </div>

                {/* Linked Next Action & Follow-ups */}
                {viewingCall.nextAction && (
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1 flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-slate-500" />
                      Recorded Next Step
                    </h4>
                    <p className="text-slate-900 font-medium text-xs sm:text-sm">
                      {viewingCall.nextAction}
                    </p>
                    {viewingCall.followUpDate && (
                      <p className="text-xs text-slate-500 mt-1">
                        Target Date: <strong className="text-slate-700">{viewingCall.followUpDate}</strong>
                      </p>
                    )}
                  </div>
                )}

                {/* Display Associated Follow-up Tasks */}
                {linkedFollowUps.length > 0 && (
                  <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                      Associated Follow-up Tasks ({linkedFollowUps.length})
                    </h4>
                    <div className="space-y-2">
                      {linkedFollowUps.map(fu => (
                        <div key={fu.id} className="p-2.5 bg-white rounded-lg border border-slate-200 flex items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <button
                              onClick={() => toggleFollowUpComplete(fu.id)}
                              className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors ${fu.status === 'Completed' ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300'
                                }`}
                              title="Toggle completion"
                            >
                              {fu.status === 'Completed' && <Check className="h-3 w-3 stroke-[3]" />}
                            </button>
                            <span className={fu.status === 'Completed' ? 'line-through text-slate-400' : 'text-slate-800 font-medium'}>
                              {fu.task}
                            </span>
                          </div>
                          <Badge status={fu.status} size="sm" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
