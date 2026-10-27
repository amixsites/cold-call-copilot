import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, className = '', onClick }) => {
  return (
    <div 
      onClick={onClick}
      className={`bg-white border border-slate-200/80 rounded-xl shadow-sm transition-all duration-150 ${onClick ? 'cursor-pointer hover:border-slate-300 hover:shadow' : ''} ${className}`}
    >
      {children}
    </div>
  );
};

interface CardHeaderProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  title,
  description,
  action,
  icon,
  className = '',
  children,
}) => {
  if (children) {
    return <div className={`p-4 sm:p-5 border-b border-slate-100 ${className}`}>{children}</div>;
  }

  return (
    <div className={`p-4 sm:p-5 border-b border-slate-100 flex items-start justify-between gap-4 ${className}`}>
      <div className="flex items-start gap-3 min-w-0">
        {icon && <div className="p-2 rounded-lg bg-slate-100 text-slate-700 shrink-0 mt-0.5">{icon}</div>}
        <div className="min-w-0">
          {title && <h3 className="font-semibold text-slate-900 text-sm sm:text-base truncate">{title}</h3>}
          {description && <p className="text-xs sm:text-sm text-slate-500 mt-0.5">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
};

export const CardContent: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => {
  return <div className={`p-4 sm:p-5 ${className}`}>{children}</div>;
};

export const CardFooter: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => {
  return <div className={`px-4 py-3 sm:px-5 sm:py-3.5 bg-slate-50/70 border-t border-slate-100 rounded-b-xl flex items-center justify-between gap-3 ${className}`}>{children}</div>;
};
