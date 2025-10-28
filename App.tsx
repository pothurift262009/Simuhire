
import React, { useState, useEffect, useMemo } from 'react';
import { Page, Role, Simulation, PerformanceReport, User } from './types';
import AuthScreen from './components/Auth';
import RecruiterDashboard from './components/RecruiterDashboard';
import CandidateStart from './components/CandidateStart';
import CandidateWorkspace from './components/CandidateWorkspace';
import PerformanceReportDisplay from './components/PerformanceReport';

const App: React.FC = () => {
  const [page, setPage] = useState<Page>(Page.HOME);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [allSimulations, setAllSimulations] = useState<Record<string, Simulation>>({});
  const [allReports, setAllReports] = useState<Record<string, PerformanceReport>>({});

  const [activeSimulation, setActiveSimulation] = useState<Simulation | null>(null);
  const [activeReport, setActiveReport] = useState<PerformanceReport | null>(null);
  const [simulationError, setSimulationError] = useState('');

  useEffect(() => {
    // Load persisted data on component mount
    const storedSimulations = localStorage.getItem('simuHireSimulations');
    if (storedSimulations) {
      setAllSimulations(JSON.parse(storedSimulations));
    }
    const storedReports = localStorage.getItem('simuHireReports');
    if (storedReports) {
      setAllReports(JSON.parse(storedReports));
    }

    const storedUser = sessionStorage.getItem('simuHireUser');
    if (storedUser) {
      const user: User = JSON.parse(storedUser);
      setCurrentUser(user);
      if (user.role === Role.RECRUITER) {
        setPage(Page.RECRUITER_DASHBOARD);
      } else {
        setPage(Page.CANDIDATE_START);
      }
    }
  }, []);


  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    sessionStorage.setItem('simuHireUser', JSON.stringify(user));
    if (user.role === Role.RECRUITER) {
      setPage(Page.RECRUITER_DASHBOARD);
    } else {
      setPage(Page.CANDIDATE_START);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    sessionStorage.removeItem('simuHireUser');
    resetToHome();
  };

  const handleCreateSimulation = (simulation: Simulation) => {
    if (!currentUser) return;
    const fullSimulation: Simulation = {
      ...simulation,
      recruiterEmail: currentUser.email,
      createdAt: new Date().toISOString(),
    };

    const updatedSimulations = { ...allSimulations, [fullSimulation.id]: fullSimulation };
    setAllSimulations(updatedSimulations);
    localStorage.setItem('simuHireSimulations', JSON.stringify(updatedSimulations));
    
    setActiveSimulation(fullSimulation);
    // This state is just to show the "Created!" screen in RecruiterDashboard
    setPage(Page.RECRUITER_DASHBOARD);
  };
  
  const handleStartSimulation = (simulationId: string) => {
    const simulation = allSimulations[simulationId];
    if (simulation) {
      // Prevent candidate from re-taking a completed simulation
      if (allReports[simulationId]) {
        setSimulationError("This simulation has already been completed.");
        return;
      }
      setSimulationError('');
      setActiveSimulation(simulation);
      setPage(Page.CANDIDATE_WORKSPACE);
    } else {
      setSimulationError("Simulation ID not found. Please check the ID and try again.");
    }
  };

  const handleSimulationComplete = (
    completionData: {
      reportData: Omit<PerformanceReport, 'simulationId' | 'candidateEmail' | 'candidateName' | 'timeTakenSeconds' | 'totalDurationSeconds' | 'completedAt'>,
      timeTakenSeconds: number,
    },
    simulationId: string
  ) => {
    if (!currentUser || !activeSimulation) return;
    const fullReport: PerformanceReport = {
      ...completionData.reportData,
      simulationId,
      candidateEmail: currentUser.email,
      candidateName: currentUser.name,
      timeTakenSeconds: completionData.timeTakenSeconds,
      totalDurationSeconds: activeSimulation.durationMinutes * 60,
      completedAt: new Date().toISOString(),
    };

    const updatedReports = { ...allReports, [simulationId]: fullReport };
    setAllReports(updatedReports);
    localStorage.setItem('simuHireReports', JSON.stringify(updatedReports));

    setActiveReport(fullReport);
    setPage(Page.PERFORMANCE_REPORT);
  };

  const handleViewReport = (report: PerformanceReport) => {
    setActiveReport(report);
    setPage(Page.PERFORMANCE_REPORT);
  };
  
  const resetToHome = () => {
    setPage(Page.HOME);
    setActiveSimulation(null);
    setActiveReport(null);
  };

  const recruiterSimulations = useMemo(() => {
    if (!currentUser || currentUser.role !== Role.RECRUITER) return [];
    return Object.values(allSimulations)
      .filter(sim => sim.recruiterEmail === currentUser.email)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [allSimulations, currentUser]);

  const candidateCompletedSimulations = useMemo(() => {
    if (!currentUser || currentUser.role !== Role.CANDIDATE) return [];
    return Object.values(allReports)
      .filter(report => report.candidateEmail === currentUser.email)
      .map(report => ({
        report,
        simulation: allSimulations[report.simulationId]
      }))
      .filter(item => item.simulation) // Ensure simulation data exists
      .sort((a, b) => new Date(b.report.completedAt).getTime() - new Date(a.report.completedAt).getTime());
  }, [allReports, allSimulations, currentUser]);

  const renderContent = () => {
    if (!currentUser) {
      switch (page) {
        case Page.AUTH:
          return <AuthScreen onLoginSuccess={handleLoginSuccess} />;
        case Page.HOME:
        default:
          return <HomeScreen onNavigate={() => setPage(Page.AUTH)} />;
      }
    }

    // Authenticated Routes
    switch (page) {
      case Page.RECRUITER_DASHBOARD:
        if (currentUser.role !== Role.RECRUITER) { handleLogout(); return null; }
        return <RecruiterDashboard 
          onCreateSimulation={handleCreateSimulation} 
          createdSimulation={activeSimulation}
          previousSimulations={recruiterSimulations}
          completedReports={allReports}
          onViewReport={handleViewReport}
        />;
      
      case Page.CANDIDATE_START:
        if (currentUser.role !== Role.CANDIDATE) { handleLogout(); return null; }
        return <CandidateStart 
          onStartSimulation={handleStartSimulation} 
          error={simulationError} 
          completedSimulations={candidateCompletedSimulations}
          onViewReport={handleViewReport}
        />;
      
      case Page.CANDIDATE_WORKSPACE:
        if (currentUser.role !== Role.CANDIDATE || !activeSimulation) {
            resetToHome();
            return null;
        }
        return <CandidateWorkspace simulation={activeSimulation} onComplete={handleSimulationComplete} />;
      
      case Page.PERFORMANCE_REPORT:
        if (!activeReport) {
            resetToHome();
            return null;
        }
        return <PerformanceReportDisplay report={activeReport} onBackToHome={currentUser.role === Role.RECRUITER ? () => setPage(Page.RECRUITER_DASHBOARD) : () => setPage(Page.CANDIDATE_START)} />;
      
      default:
        // If user is logged in but on a public page, redirect them
        if (currentUser.role === Role.RECRUITER) {
          setPage(Page.RECRUITER_DASHBOARD);
        } else {
          setPage(Page.CANDIDATE_START);
        }
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans">
        <header className="bg-slate-900/80 backdrop-blur-sm p-4 border-b border-slate-700 flex justify-between items-center sticky top-0 z-20">
            <h1 onClick={currentUser ? undefined : resetToHome} className={`text-2xl font-bold text-blue-400 ${!currentUser ? 'cursor-pointer' : ''}`}>SimuHire</h1>
            {currentUser && (
              <div className="flex items-center gap-4">
                <span className="text-sm text-slate-300 hidden sm:block">{currentUser.name}</span>
                <button onClick={handleLogout} className="bg-slate-700 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-md text-sm transition-colors">
                  Logout
                </button>
              </div>
            )}
        </header>
        <main className="p-4 sm:p-6 md:p-8">
            {renderContent()}
        </main>
    </div>
  );
};

interface HomeScreenProps {
  onNavigate: () => void;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigate }) => (
  <div className="flex flex-col items-center justify-center text-center py-16">
    <h2 className="text-4xl font-extrabold mb-4">Welcome to SimuHire</h2>
    <p className="text-slate-400 max-w-2xl mb-12">
      The ultimate platform for realistic, AI-driven hiring simulations. Assess candidates in a true-to-life work environment and get deep performance insights.
    </p>
    <button onClick={onNavigate} className="px-10 py-4 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-all duration-300 transform hover:-translate-y-1 text-xl">
      Get Started
    </button>
  </div>
);


export default App;