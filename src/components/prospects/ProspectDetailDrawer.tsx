import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Building2, 
  User, 
  Mail, 
  Phone, 
  Globe, 
  MapPin, 
  PhoneCall, 
  Edit3, 
  Trash2, 
  Factory, 
  Cpu,
  Clock
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { Prospect } from '../../types';
import { useData } from '../../context/DataContext';

interface ProspectDetailDrawerProps {
  prospect: Prospect | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (prospect: Prospect) => void;
  onDelete: (prospect: Prospect) => void;
}

export const ProspectDetailDrawer: React.FC<ProspectDetailDrawerProps> = ({
  prospect,
  isOpen,
  onClose,
  onEdit,
  onDelete,
}) => {
  const navigate = useNavigate();
  const { calls, followUps } = useData();

  if (!prospect) return null;

  const prospectCalls = calls.filter(c => c.prospectId === prospect.id);
  const prospectFollowUps = followUps.filter(f => f.prospectId === prospect.id);

  const handleStartCall = () => {
    onClose();
    navigate(`/workspace?prospectId=${prospect.id}`);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={prospect.companyName}
      description={prospect.industry}
      maxWidth="2xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button
            variant="ghost"
            size="sm"
            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
            icon={<Trash2 className="h-4 w-4" />}
            onClick={() => onDelete(prospect)}
          >
            Delete Prospect
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={<Edit3 className="h-4 w-4" />}
              onClick={() => {
                onClose();
                onEdit(prospect);
              }}
            >
              Edit Details
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<PhoneCall className="h-4 w-4" />}
              onClick={handleStartCall}
            >
              Launch Call Workspace
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Status and quick summary strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status:</span>
            <Badge status={prospect.status} size="md" />
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-500">
            {prospect.lastContactDate ? (
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-slate-400" />
                Last contacted: <strong className="text-slate-700">{prospect.lastContactDate}</strong>
              </span>
            ) : (
              <span className="text-amber-600 font-medium">Never contacted</span>
            )}
            <span className="hidden sm:inline text-slate-300">|</span>
            <span>Created: {new Date(prospect.createdAt).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Contact info grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-3 p-4 rounded-xl border border-slate-100 bg-white">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              Primary Contact
            </h4>
            <div>
              <p className="font-semibold text-slate-900 text-sm">
                {prospect.contactName || <span className="text-slate-400 italic font-normal">No contact name entered</span>}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {prospect.jobTitle || 'Role unknown'}
              </p>
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-1.5 text-xs">
              {prospect.email && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <a href={`mailto:${prospect.email}`} className="text-brand-600 hover:underline truncate">
                    {prospect.email}
                  </a>
                </div>
              )}
              {prospect.phone && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <a href={`tel:${prospect.phone}`} className="hover:text-slate-900">
                    {prospect.phone}
                  </a>
                </div>
              )}
              {!prospect.email && !prospect.phone && (
                <p className="text-xs text-slate-400 italic">No direct email or phone provided</p>
              )}
            </div>
          </div>

          <div className="space-y-3 p-4 rounded-xl border border-slate-100 bg-white">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" />
              Facility & Company Info
            </h4>
            <div className="space-y-1.5 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span>{prospect.location || 'Location unspecified'}</span>
              </div>
              {prospect.website && (
                <div className="flex items-center gap-2">
                  <Globe className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <a 
                    href={prospect.website} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="text-brand-600 hover:underline truncate"
                  >
                    {prospect.website.replace(/^https?:\/\//, '')}
                  </a>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Factory className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span>Size: {prospect.employeeCount || 'Unknown size'}</span>
              </div>
            </div>

            {prospect.manufacturingType && (
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-start gap-1.5 text-xs text-slate-700">
                  <Cpu className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span className="font-medium text-slate-800">{prospect.manufacturingType}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Notes & context */}
        {prospect.notes && (
          <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200/60">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Research & Known Operational Context
            </h4>
            <p className="text-xs sm:text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
              {prospect.notes}
            </p>
          </div>
        )}

        {/* Related Interactions summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-3.5 bg-white border border-slate-200/80 rounded-xl">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 flex items-center justify-between">
              <span>Calls Logged ({prospectCalls.length})</span>
            </h4>
            {prospectCalls.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No calls conducted yet.</p>
            ) : (
              <div className="space-y-2">
                {prospectCalls.map(c => (
                  <div key={c.id} className="text-xs p-2 rounded bg-slate-50 border border-slate-100 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-800 truncate max-w-[180px]">{c.callObjective}</p>
                      <p className="text-[11px] text-slate-400">{new Date(c.callDate).toLocaleDateString()}</p>
                    </div>
                    {c.outcome && <Badge status={c.outcome} size="sm" />}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-3.5 bg-white border border-slate-200/80 rounded-xl">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 flex items-center justify-between">
              <span>Follow-ups ({prospectFollowUps.length})</span>
            </h4>
            {prospectFollowUps.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No active follow-ups.</p>
            ) : (
              <div className="space-y-2">
                {prospectFollowUps.map(f => (
                  <div key={f.id} className="text-xs p-2 rounded bg-slate-50 border border-slate-100 flex items-center justify-between">
                    <div>
                      <p className={`font-medium truncate max-w-[180px] ${f.status === 'Completed' ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                        {f.task}
                      </p>
                      <p className="text-[11px] text-slate-400">Due: {f.dueDate}</p>
                    </div>
                    <Badge status={f.status} size="sm" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
