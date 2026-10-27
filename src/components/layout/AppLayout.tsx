import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { ProspectFormModal } from '../prospects/ProspectFormModal';
import { FollowUpModal } from '../followups/FollowUpModal';
import { useData } from '../../context/DataContext';

export const AppLayout: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isProspectModalOpen, setIsProspectModalOpen] = useState(false);
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);

  const { addProspect, addFollowUp, isCallMode } = useData();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex">
      {/* Sidebar Navigation - completely hidden during Call Mode */}
      {!isCallMode && (
        <Sidebar 
          isOpen={mobileMenuOpen} 
          onClose={() => setMobileMenuOpen(false)} 
        />
      )}

      {/* Main Content Area - expands to full viewport without left padding gap in Call Mode */}
      <div className={`flex-1 ${!isCallMode ? 'lg:pl-52' : ''} flex flex-col min-w-0 w-full`}>
        {!isCallMode && (
          <TopBar
            onOpenMobileMenu={() => setMobileMenuOpen(true)}
            onOpenNewProspectModal={() => setIsProspectModalOpen(true)}
            onOpenNewFollowUpModal={() => setIsFollowUpModalOpen(true)}
          />
        )}

        {/* Dynamic page outlet */}
        <main className={`flex-1 w-full ${isCallMode ? 'p-2 sm:p-3 max-w-[1600px] mx-auto' : 'p-4 sm:p-5 lg:p-6 max-w-7xl mx-auto'}`}>
          <Outlet context={{
            openNewProspectModal: () => setIsProspectModalOpen(true),
            openNewFollowUpModal: () => setIsFollowUpModalOpen(true),
          }} />
        </main>
      </div>

      {/* Global Modals */}
      <ProspectFormModal
        isOpen={isProspectModalOpen}
        onClose={() => setIsProspectModalOpen(false)}
        onSubmit={(data) => {
          addProspect(data);
        }}
      />

      <FollowUpModal
        isOpen={isFollowUpModalOpen}
        onClose={() => setIsFollowUpModalOpen(false)}
        onSubmit={(data) => {
          addFollowUp(data);
        }}
      />
    </div>
  );
};
