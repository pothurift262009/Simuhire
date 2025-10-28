import React, { useState, useEffect, useMemo } from 'react';
import { Page, Role, Simulation, PerformanceReport, User } from './types';
import AuthScreen from './components/Auth';
import RecruiterDashboard from './components/RecruiterDashboard';
import CandidateStart from './components/CandidateStart';
import CandidateWorkspace from './components/CandidateWorkspace';
import PerformanceReportDisplay from './components/PerformanceReport';
import { BriefcaseIcon, UserIcon, CheckCircleIcon, PencilIcon, ClipboardIcon, CurrencyDollarIcon, TrendingUpIcon, UserGroupIcon, VideoCameraIcon, ShieldCheckIcon, DesktopComputerIcon, ExclamationIcon } from './components/Icons';
import ChatBot from './components/ChatBot';

const App: React.FC = () => {
  const [page, setPage] = useState<Page>(Page.HOME);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [allSimulations, setAllSimulations] = useState<Record<string, Simulation>>({});
  const [allReports, setAllReports] = useState<Record<string, PerformanceReport>>({});

  const [activeSimulation, setActiveSimulation] = useState<Simulation | null>(null);
  const [activeReport, setActiveReport] = useState<PerformanceReport | null>(null);
  const [simulationError, setSimulationError] = useState('');
  const [showWarningModal, setShowWarningModal] = useState<string | null>(null);

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
      setShowWarningModal(simulationId);
    } else {
      setSimulationError("Simulation ID not found. Please check the ID and try again.");
    }
  };

  const confirmAndStartSimulation = () => {
    if (!showWarningModal) return;
    const simulation = allSimulations[showWarningModal];
    if (simulation) {
        setActiveSimulation(simulation);
        setPage(Page.CANDIDATE_WORKSPACE);
        setShowWarningModal(null);
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
        {showWarningModal && (
          <PreSimulationWarningModal
            onConfirm={confirmAndStartSimulation}
            onCancel={() => setShowWarningModal(null)}
          />
        )}
        <main className="p-4 sm:p-6 md:p-8">
            {renderContent()}
        </main>
        <ChatBot />
    </div>
  );
};

interface PreSimulationWarningModalProps {
  onConfirm: () => void;
  onCancel: () => void;
}

const PreSimulationWarningModal: React.FC<PreSimulationWarningModalProps> = ({ onConfirm, onCancel }) => (
  <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 backdrop-blur-sm animate-fade-in">
    <div className="bg-slate-800 rounded-2xl shadow-2xl p-8 w-full max-w-lg mx-4 border border-yellow-500/50">
      <div className="text-center">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-yellow-500/20 mb-4">
          <ExclamationIcon className="h-8 w-8 text-yellow-400" />
        </div>
        <h3 className="text-2xl font-bold text-white">Important Rules</h3>
        <p className="text-slate-400 mt-2">Please read the following rules carefully before starting.</p>
      </div>
      <ul className="mt-6 space-y-3 text-slate-300 list-disc list-inside">
        <li>This simulation must be completed in a single session.</li>
        <li>
          <strong>Tab or window switching is prohibited.</strong> Your browser activity will be monitored.
        </li>
        <li>
          If you switch away from this window more than twice, your session will be
          <strong> automatically submitted</strong>, regardless of your progress.
        </li>
        <li>Ensure you have a stable internet connection before you begin.</li>
      </ul>
      <div className="mt-8 flex flex-col sm:flex-row-reverse gap-3">
        <button
          onClick={onConfirm}
          className="w-full sm:w-auto px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors duration-200"
        >
          I Understand, Start Simulation
        </button>
        <button
          onClick={onCancel}
          className="w-full sm:w-auto px-6 py-3 bg-slate-600 text-white font-semibold rounded-lg hover:bg-slate-700 transition-colors duration-200"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
);

interface HomeScreenProps {
  onNavigate: () => void;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigate }) => (
  <div className="space-y-24 md:space-y-32 text-slate-300 overflow-x-hidden animate-fade-in">
    {/* Hero Section */}
    <section className="text-center pt-16 pb-8 md:pt-24 md:pb-12">
      <h2 className="text-5xl md:text-7xl font-extrabold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-teal-300">
        The Future of Hiring is Here.
      </h2>
      <p className="max-w-3xl mx-auto text-lg md:text-xl text-slate-400 mb-12">
        Go beyond resumes. SimuHire uses AI-powered workday simulations to reveal true candidate potential, ensuring you hire the best fit, every time.
      </p>
      <button onClick={onNavigate} className="px-10 py-4 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-all duration-300 transform hover:-translate-y-1 text-xl shadow-lg shadow-blue-600/30">
        Get Started
      </button>
    </section>

    {/* Features Section */}
    <section className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-start px-4">
      {/* For Companies */}
      <div className="space-y-8 p-8 bg-slate-800/50 rounded-2xl border border-slate-700">
        <div className="flex items-center gap-4">
          <BriefcaseIcon className="w-10 h-10 text-blue-400" />
          <h3 className="text-4xl font-bold">For Companies</h3>
        </div>
        <p className="text-slate-400">
          Stop guessing and start knowing. Our platform gives you the tools to make data-driven hiring decisions with confidence.
        </p>
        <ul className="space-y-6">
          <li className="flex items-start gap-4">
            <PencilIcon className="w-6 h-6 text-blue-400 mt-1 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-white">AI-Powered Simulation Creation</h4>
              <p className="text-slate-400 text-sm">Describe the job, and our AI instantly generates a suite of realistic tasks, tailored to the role's specific needs.</p>
            </div>
          </li>
          <li className="flex items-start gap-4">
            <ClipboardIcon className="w-6 h-6 text-blue-400 mt-1 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-white">In-Depth Performance Analysis</h4>
              <p className="text-slate-400 text-sm">Receive a comprehensive report analyzing problem-solving, communication, and stress management, complete with scores and actionable insights.</p>
            </div>
          </li>
          <li className="flex items-start gap-4">
            <CheckCircleIcon className="w-6 h-6 text-blue-400 mt-1 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-white">Reduce Bias, Increase Quality</h4>
              <p className="text-slate-400 text-sm">Assess every candidate on the same objective criteria, focusing on real skills over resume keywords to build a stronger, more diverse team.</p>
            </div>
          </li>
        </ul>
      </div>

      {/* For Candidates */}
      <div className="space-y-8 p-8 bg-slate-800/50 rounded-2xl border border-slate-700 mt-0 md:mt-12">
        <div className="flex items-center gap-4">
          <UserIcon className="w-10 h-10 text-green-400" />
          <h3 className="text-4xl font-bold">For Candidates</h3>
        </div>
        <p className="text-slate-400">
          Your skills are your greatest asset. SimuHire provides the stage for you to shine and land the job you deserve.
        </p>
        <ul className="space-y-6">
          <li className="flex items-start gap-4">
            <BriefcaseIcon className="w-6 h-6 text-green-400 mt-1 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-white">Show, Don't Just Tell</h4>
              <p className="text-slate-400 text-sm">Move past bullet points. Demonstrate your real-world problem-solving abilities in a simulated environment that mirrors the actual job.</p>
            </div>
          </li>
          <li className="flex items-start gap-4">
            <CheckCircleIcon className="w-6 h-6 text-green-400 mt-1 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-white">A Fair & Objective Opportunity</h4>
              <p className="text-slate-400 text-sm">Compete on a level playing field where your performance is the only thing that matters, analyzed consistently and without bias.</p>
            </div>
          </li>
          <li className="flex items-start gap-4">
            <UserIcon className="w-6 h-6 text-green-400 mt-1 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-white">Experience the Role Firsthand</h4>
              <p className="text-slate-400 text-sm">Get a genuine feel for the day-to-day responsibilities and challenges of the role, ensuring it's the right fit for you.</p>
            </div>
          </li>
        </ul>
      </div>
    </section>

    {/* ROI Section */}
    <section className="max-w-6xl mx-auto text-center px-4">
      <h3 className="text-4xl font-bold mb-4">Drive Real Business Impact</h3>
      <p className="text-slate-400 mb-12 max-w-3xl mx-auto">Our platform translates into measurable gains for your bottom line, backed by data from our clients.</p>
      <div className="grid md:grid-cols-3 gap-8 text-left">
        {/* Card 1: Cost Savings */}
        <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700 space-y-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 rounded-lg">
              <CurrencyDollarIcon className="w-8 h-8 text-blue-400" />
            </div>
            <span className="text-5xl font-extrabold text-white">50%</span>
          </div>
          <h4 className="text-xl font-semibold text-white">Reduction in Hiring Costs</h4>
          <p className="text-slate-400 text-sm">
            Slash hiring costs by up to 50% by eliminating lengthy interview rounds and minimizing reliance on expensive external agencies. This translates to an average saving of $20,000 per senior hire.
          </p>
        </div>
        {/* Card 2: Quality of Hire */}
        <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700 space-y-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-500/10 rounded-lg">
              <TrendingUpIcon className="w-8 h-8 text-green-400" />
            </div>
            <span className="text-5xl font-extrabold text-white">65%</span>
          </div>
          <h4 className="text-xl font-semibold text-white">Increase in Hire Performance</h4>
          <p className="text-slate-400 text-sm">
            Candidates hired through SimuHire demonstrate a 65% higher performance rating in their first year and ramp up 30% faster, directly boosting team productivity and project outcomes.
          </p>
        </div>
        {/* Card 3: Retention */}
        <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700 space-y-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-yellow-500/10 rounded-lg">
              <UserGroupIcon className="w-8 h-8 text-yellow-400" />
            </div>
            <span className="text-5xl font-extrabold text-white">75%</span>
          </div>
          <h4 className="text-xl font-semibold text-white">Decrease in Early Attrition</h4>
          <p className="text-slate-400 text-sm">
            Ensure long-term success and cultural fit. Our realistic job previews lead to a 75% reduction in turnover within the first 6 months, saving an average of $50,000 in replacement costs.
          </p>
        </div>
      </div>
    </section>

    {/* How It Works Section */}
    <section className="max-w-5xl mx-auto text-center px-4">
      <h3 className="text-4xl font-bold mb-4">Simple, Powerful, Effective</h3>
      <p className="text-slate-400 mb-12 max-w-2xl mx-auto">Three simple steps to revolutionize your hiring process.</p>
      <div className="grid md:grid-cols-3 gap-8 text-left">
        <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700">
          <p className="text-blue-400 font-bold mb-2">Step 1</p>
          <h4 className="text-xl font-semibold text-white mb-2">Create & Customize</h4>
          <p className="text-slate-400 text-sm">Recruiters define the job role. Our AI generates a simulation which can be refined and customized in seconds.</p>
        </div>
        <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700">
          <p className="text-blue-400 font-bold mb-2">Step 2</p>
          <h4 className="text-xl font-semibold text-white mb-2">Candidate Performs</h4>
          <p className="text-slate-400 text-sm">Candidates immerse themselves in a realistic workspace with tools like email, chat, and editors to complete their tasks.</p>
        </div>
        <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700">
          <p className="text-blue-400 font-bold mb-2">Step 3</p>
          <h4 className="text-xl font-semibold text-white mb-2">AI Analyzes & Reports</h4>
          <p className="text-slate-400 text-sm">Upon completion, our AI analyzes the candidate's work and delivers a detailed performance report to the recruiter.</p>
        </div>
      </div>
    </section>

    {/* Proctoring Features Section */}
    <section className="max-w-5xl mx-auto text-center px-4">
      <h3 className="text-4xl font-bold mb-4">The Future of Proctoring <span className="text-sm align-middle font-medium bg-blue-500/20 text-blue-300 rounded-full px-3 py-1 ml-2">Coming Soon</span></h3>
      <p className="text-slate-400 mb-12 max-w-3xl mx-auto">We're enhancing simulation integrity with advanced, AI-powered proctoring to ensure a fair and secure environment for every candidate.</p>
      <div className="grid md:grid-cols-3 gap-8 text-left">
        <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700 space-y-3">
          <div className="p-3 bg-purple-500/10 rounded-lg inline-block">
            <VideoCameraIcon className="w-8 h-8 text-purple-400" />
          </div>
          <h4 className="text-xl font-semibold text-white">External Camera Detection</h4>
          <p className="text-slate-400 text-sm">Our system will detect if external or virtual webcams are used and can halt the simulation to prevent unauthorized assistance.</p>
        </div>
        <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700 space-y-3">
          <div className="p-3 bg-purple-500/10 rounded-lg inline-block">
            <ShieldCheckIcon className="w-8 h-8 text-purple-400" />
          </div>
          <h4 className="text-xl font-semibold text-white">AI Gaze & Environment Analysis</h4>
          <p className="text-slate-400 text-sm">Intelligent AI monitors candidate gaze and background activity to ensure they are not receiving external help from notes or other people.</p>
        </div>
        <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700 space-y-3">
          <div className="p-3 bg-purple-500/10 rounded-lg inline-block">
            <DesktopComputerIcon className="w-8 h-8 text-purple-400" />
          </div>
          <h4 className="text-xl font-semibold text-white">Secure Desktop Lockdown</h4>
          <p className="text-slate-400 text-sm">SimuHire will be able to close all other applications and browser tabs, creating a focused, cheat-proof testing environment.</p>
        </div>
      </div>
    </section>
    
    {/* Final CTA */}
    <section className="text-center py-16">
        <h3 className="text-4xl font-extrabold mb-4">Ready to Hire with Insight?</h3>
        <p className="text-slate-400 max-w-2xl mx-auto mb-12">
            Join the companies and candidates who are embracing a smarter way to hire and get hired.
        </p>
        <button onClick={onNavigate} className="px-10 py-4 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-all duration-300 transform hover:-translate-y-1 text-xl shadow-lg shadow-blue-600/30">
            Start Your First Simulation
        </button>
    </section>

    {/* Footer */}
    <footer className="border-t border-slate-700 py-8 text-center text-slate-500">
        <div className="max-w-6xl mx-auto px-4">
            <p className="font-bold text-xl text-slate-300 mb-4">SimuHire</p>
            <p className="mb-4">For inquiries, partnerships, or support, please reach out.</p>
            <div className="flex justify-center gap-6 mb-6">
                <a href="mailto:contact@simuhire.com" className="hover:text-blue-400 transition-colors">contact@simuhire.com</a>
                <a href="tel:+1234567890" className="hover:text-blue-400 transition-colors">+1 (234) 567-890</a>
            </div>
            <p className="text-sm">&copy; {new Date().getFullYear()} SimuHire. All Rights Reserved. Built with passion and AI.</p>
        </div>
    </footer>
  </div>
);


export default App;