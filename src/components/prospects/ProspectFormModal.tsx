import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Prospect, ProspectStatus } from '../../types';
import { validateProspectForm, ValidationErrors } from '../../lib/validation';

interface ProspectFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<Prospect, 'id' | 'createdAt' | 'updatedAt'>) => void;
  initialData?: Prospect | null;
}

const MANUFACTURING_INDUSTRIES = [
  'Precision CNC Machining',
  'Automotive OEM & Tier 1/2',
  'Plastics & Injection Molding',
  'Heavy Metal Fabrication & Welding',
  'Industrial Automation & Robotics',
  'Aerospace & Defense Components',
  'Hydraulics, Pumps & Valves',
  'Packaging Machinery',
  'Electronics & PCB Assembly',
  'Medical Device Manufacturing',
  'Other Manufacturing'
];

const PROSPECT_STATUSES: ProspectStatus[] = [
  'New',
  'Attempted',
  'In Discussion',
  'Qualified',
  'Unqualified',
  'Archived'
];

export const ProspectFormModal: React.FC<ProspectFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
}) => {
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [industry, setIndustry] = useState(MANUFACTURING_INDUSTRIES[0]);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [location, setLocation] = useState('');
  const [employeeCount, setEmployeeCount] = useState('');
  const [manufacturingType, setManufacturingType] = useState('');
  const [status, setStatus] = useState<ProspectStatus>('New');
  const [notes, setNotes] = useState('');

  // Validation and Submission State
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setCompanyName(initialData.companyName || '');
      setContactName(initialData.contactName || '');
      setJobTitle(initialData.jobTitle || '');
      setIndustry(initialData.industry || MANUFACTURING_INDUSTRIES[0]);
      setEmail(initialData.email || '');
      setPhone(initialData.phone || '');
      setWebsite(initialData.website || '');
      setLocation(initialData.location || '');
      setEmployeeCount(initialData.employeeCount || '');
      setManufacturingType(initialData.manufacturingType || '');
      setStatus(initialData.status || 'New');
      setNotes(initialData.notes || '');
    } else {
      setCompanyName('');
      setContactName('');
      setJobTitle('');
      setIndustry(MANUFACTURING_INDUSTRIES[0]);
      setEmail('');
      setPhone('');
      setWebsite('');
      setLocation('');
      setEmployeeCount('');
      setManufacturingType('');
      setStatus('New');
      setNotes('');
    }
    setErrors({});
    setIsSubmitting(false);
  }, [initialData, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const validationErrors = validateProspectForm({
      companyName,
      email,
      phone,
      website,
    });

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      onSubmit({
        companyName: companyName.trim(),
        contactName: contactName.trim() || undefined,
        jobTitle: jobTitle.trim() || undefined,
        industry,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        website: website.trim() ? (website.startsWith('http') ? website : `https://${website}`) : undefined,
        location: location.trim() || undefined,
        employeeCount: employeeCount.trim() || undefined,
        manufacturingType: manufacturingType.trim() || undefined,
        status,
        notes: notes.trim() || undefined,
        lastContactDate: initialData?.lastContactDate,
      });

      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Edit Prospect Record' : 'Add Manufacturing Prospect'}
      description="Record account information and plant operational details."
      maxWidth="2xl"
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
            {initialData ? 'Save Changes' : 'Create Prospect'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Core Company Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Company Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Apex Precision Machining Inc."
              className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 ${
                errors.companyName 
                  ? 'border-rose-400 focus:ring-rose-400 bg-rose-50/20' 
                  : 'border-slate-300 focus:ring-brand-500 focus:border-brand-500'
              }`}
            />
            {errors.companyName && (
              <p className="mt-1 text-xs text-rose-600">{errors.companyName}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Industry Vertical <span className="text-rose-500">*</span>
            </label>
            <select
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            >
              {MANUFACTURING_INDUSTRIES.map((ind) => (
                <option key={ind} value={ind}>
                  {ind}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Contact Person & Job Title */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Contact Person
            </label>
            <input
              type="text"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="e.g. Marcus Vance"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Job Title / Decision Role
            </label>
            <input
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="e.g. VP of Manufacturing Operations"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            />
          </div>
        </div>

        {/* Email & Phone */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Direct Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="m.vance@company.com"
              className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 ${
                errors.email 
                  ? 'border-rose-400 focus:ring-rose-400 bg-rose-50/20' 
                  : 'border-slate-300 focus:ring-brand-500 focus:border-brand-500'
              }`}
            />
            {errors.email && (
              <p className="mt-1 text-xs text-rose-600">{errors.email}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Phone Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 000-0000"
              className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 ${
                errors.phone 
                  ? 'border-rose-400 focus:ring-rose-400 bg-rose-50/20' 
                  : 'border-slate-300 focus:ring-brand-500 focus:border-brand-500'
              }`}
            />
            {errors.phone && (
              <p className="mt-1 text-xs text-rose-600">{errors.phone}</p>
            )}
          </div>
        </div>

        {/* Location & Website */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Plant / HQ Location
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Cleveland, OH"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Website
            </label>
            <input
              type="text"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://company.com"
              className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 ${
                errors.website 
                  ? 'border-rose-400 focus:ring-rose-400 bg-rose-50/20' 
                  : 'border-slate-300 focus:ring-brand-500 focus:border-brand-500'
              }`}
            />
            {errors.website && (
              <p className="mt-1 text-xs text-rose-600">{errors.website}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Status <span className="text-rose-500">*</span>
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ProspectStatus)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            >
              {PROSPECT_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Manufacturing Operations / Type Context */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Plant Capacity / Employees
            </label>
            <input
              type="text"
              value={employeeCount}
              onChange={(e) => setEmployeeCount(e.target.value)}
              placeholder="e.g. 100-250 employees / 2 shifts"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Primary Machinery / Manufacturing Type
            </label>
            <input
              type="text"
              value={manufacturingType}
              onChange={(e) => setManufacturingType(e.target.value)}
              placeholder="e.g. 5-axis CNCs, titanium milling"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Pre-Call Research Notes & Known Context
          </label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Document known equipment, recent expansions, press releases, or key pain points before reaching out..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 resize-none"
          />
        </div>
      </form>
    </Modal>
  );
};
