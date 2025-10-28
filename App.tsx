import React, { useState } from 'react';
import { Page, Role, Simulation, PerformanceReport } from './types';
import { BriefcaseIcon, UserIcon } from './components/Icons';
import RecruiterDashboard from './components/RecruiterDashboard';
import CandidateStart from './components/CandidateStart';
import CandidateWorkspace from './components/CandidateWorkspace';
import PerformanceReportDisplay from './components/PerformanceReport';

const App: React.FC = () => {
  const [page, setPage] = useState<Page>(Page.HOME);
  const [simulations, setSimulations] = useState<Record<string, Simulation>>({});
  const [activeSimulation, setActiveSimulation] = useState<Simulation | null>(null);
  const [activeReport, setActiveReport] = useState<PerformanceReport | null>(null);
  const [simulationError, setSimulationError] = useState('');

  const handleCreateSimulation = (simulation: Simulation) => {
    setSimulations(prev => ({ ...prev, [simulation.id]: simulation }));
    setActiveSimulation(simulation);
    setPage(Page.RECRUITER_DASHBOARD); // Stay on recruiter page to show ID
  };
  
  const handleStartSimulation = (simulationId: string) => {
    const simulation = simulations[simulationId];
    if (simulation) {
      setSimulationError(''); // Clear error on success
      setActiveSimulation(simulation);
      setPage(Page.CANDIDATE_WORKSPACE);
    } else {
      setSimulationError("Simulation ID not found. Please check the ID and try again.");
    }
  };

  const handleSimulationComplete = (report: PerformanceReport) => {
    setActiveReport(report);
    setPage(Page.PERFORMANCE_REPORT);
  };
  
  const resetToHome = () => {
    setPage(Page.HOME);
    setActiveSimulation(null);
    setActiveReport(null);
  };

  const renderContent = () => {
    switch (page) {
      case Page.RECRUITER_DASHBOARD:
        return <RecruiterDashboard onCreateSimulation={handleCreateSimulation} createdSimulation={activeSimulation}/>;
      case Page.CANDIDATE_START:
        return <CandidateStart onStartSimulation={handleStartSimulation} error={simulationError} />;
      case Page.CANDIDATE_WORKSPACE:
        if (!activeSimulation) {
            resetToHome();
            return null;
        }
        return <CandidateWorkspace simulation={activeSimulation} onComplete={handleSimulationComplete} />;
      case Page.PERFORMANCE_REPORT:
        if (!activeReport) {
            resetToHome();
            return null;
        }
        return <PerformanceReportDisplay report={activeReport} onBackToHome={resetToHome} />;
      case Page.HOME:
      default:
        return <RoleSelectionScreen setPage={setPage} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans">
        <header className="bg-slate-900/80 backdrop-blur-sm p-4 border-b border-slate-700 flex justify-between items-center">
            <h1 onClick={resetToHome} className="text-2xl font-bold text-blue-400 cursor-pointer">SimuHire</h1>
        </header>
        <main className="p-4 sm:p-6 md:p-8">
            {renderContent()}
        </main>
    </div>
  );
};

interface RoleSelectionScreenProps {
  setPage: (page: Page) => void;
}

const RoleSelectionScreen: React.FC<RoleSelectionScreenProps> = ({ setPage }) => (
  <div className="flex flex-col items-center justify-center text-center py-16">
    <h2 className="text-4xl font-extrabold mb-4">Welcome to SimuHire</h2>
    <p className="text-slate-400 max-w-2xl mb-12">
      The ultimate platform for realistic, AI-driven hiring simulations. Assess candidates in a true-to-life work environment and get deep performance insights.
    </p>
    <p className="text-xl font-semibold mb-6">Choose your role to begin:</p>
    <div className="flex flex-col sm:flex-row gap-6">
      <button onClick={() => setPage(Page.RECRUITER_DASHBOARD)} className="flex flex-col items-center justify-center p-8 bg-slate-800 border border-slate-700 rounded-lg w-64 h-64 hover:bg-blue-600 hover:border-blue-500 transition-all duration-300 transform hover:-translate-y-1">
        <BriefcaseIcon className="h-16 w-16 mb-4 text-blue-400" />
        <span className="text-2xl font-bold">I'm a Recruiter</span>
        <span className="text-slate-400 mt-2">Create a Simulation</span>
      </button>
      <button onClick={() => setPage(Page.CANDIDATE_START)} className="flex flex-col items-center justify-center p-8 bg-slate-800 border border-slate-700 rounded-lg w-64 h-64 hover:bg-green-600 hover:border-green-500 transition-all duration-300 transform hover:-translate-y-1">
        <UserIcon className="h-16 w-16 mb-4 text-green-400" />
        <span className="text-2xl font-bold">I'm a Candidate</span>
        <span className="text-slate-400 mt-2">Start a Simulation</span>
      </button>
    </div>
  </div>
);


export default App;