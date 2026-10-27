import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Home } from 'lucide-react';
import { Button } from '../components/common/Button';
import { EmptyState } from '../components/common/EmptyState';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="py-16 max-w-lg mx-auto">
      <EmptyState
        icon={<AlertTriangle className="h-8 w-8 text-amber-500" />}
        title="Page not found"
        description="The screen you requested does not exist or has been moved."
        action={
          <Button
            variant="primary"
            icon={<Home className="h-4 w-4" />}
            onClick={() => navigate('/')}
          >
            Return to Dashboard
          </Button>
        }
      />
    </div>
  );
};
