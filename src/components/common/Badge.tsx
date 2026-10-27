import React from 'react';
import { ProspectStatus, CallStatus, CallOutcome, FollowUpPriority, FollowUpStatus } from '../../types';

interface BadgeProps {
  children?: React.ReactNode;
  variant?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
  status?: ProspectStatus | CallStatus | CallOutcome | FollowUpPriority | FollowUpStatus | string;
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ 
  children, 
  variant, 
  status, 
  size = 'sm',
  className = '' 
}) => {
  // Determine variant based on known statuses if not explicitly provided
  let computedVariant: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'purple' = variant || 'neutral';

  if (!variant && status) {
    switch (status) {
      // Prospect statuses
      case 'New':
        computedVariant = 'info';
        break;
      case 'Attempted':
        computedVariant = 'warning';
        break;
      case 'In Discussion':
        computedVariant = 'purple';
        break;
      case 'Qualified':
        computedVariant = 'success';
        break;
      case 'Unqualified':
        computedVariant = 'danger';
        break;
      case 'Archived':
        computedVariant = 'neutral';
        break;

      // Call statuses
      case 'Not Started':
        computedVariant = 'neutral';
        break;
      case 'In Progress':
        computedVariant = 'warning';
        break;
      case 'Completed':
        computedVariant = 'success';
        break;

      // Call outcomes
      case 'Connected - Interested':
        computedVariant = 'success';
        break;
      case 'Connected - Follow-up Needed':
      case 'Connected - Follow-up Required':
        computedVariant = 'purple';
        break;
      case 'Connected - Not Interested':
        computedVariant = 'danger';
        break;
      case 'No Answer / Voicemail':
      case 'Left Voicemail':
      case 'Gatekeeper Blocked':
      case 'Callback Requested':
        computedVariant = 'warning';
        break;
      case 'Wrong Contact / Number':
        computedVariant = 'neutral';
        break;

      // Priorities
      case 'High':
        computedVariant = 'danger';
        break;
      case 'Medium':
        computedVariant = 'warning';
        break;
      case 'Low':
        computedVariant = 'neutral';
        break;

      // Follow-up statuses
      case 'Pending':
        computedVariant = 'warning';
        break;
      case 'Cancelled':
        computedVariant = 'neutral';
        break;

      default:
        computedVariant = 'neutral';
    }
  }

  const variantStyles = {
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
    info: 'bg-sky-50 text-sky-700 border-sky-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
    danger: 'bg-rose-50 text-rose-700 border-rose-200',
    purple: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  };

  const sizeStyles = {
    sm: 'text-xs px-2 py-0.5 font-medium rounded-md',
    md: 'text-sm px-2.5 py-1 font-medium rounded-lg',
  };

  const displayText = children || status;

  return (
    <span className={`inline-flex items-center gap-1.5 border leading-none tracking-tight ${variantStyles[computedVariant]} ${sizeStyles[size]} ${className}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      <span>{displayText}</span>
    </span>
  );
};
