import React from 'react';
import { PerformanceReport } from '../types';
import { CheckCircleIcon, ExclamationIcon, XIcon } from './Icons';
import { formatTime } from '../lib/utils';

interface PerformanceReportDisplayProps {
  report: PerformanceReport;
  onBackToHome: () => void;
}

const RecommendationCard: React.FC<{ report: PerformanceReport }> = ({ report }) => {
  const { recommendation, suitabilityScore, recommendationReasoning } = report;

  const verdictConfig = {
    HIRE: {
      text: 'Recommended for Hire',
      icon: <CheckCircleIcon className="w-8 h-8 text-green-400" />,
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/50',
      textColor: 'text-green-300',
    },
    CONSIDER: {
      text: 'Consider with Reservations',
      icon: <ExclamationIcon className="w-8 h-8 text-yellow-400" />,
      bgColor: 'bg-yellow-500/10',
      borderColor: 'border-yellow-500/50',
      textColor: 'text-yellow-300',
    },
    NO_HIRE: {
      text: 'Not Recommended',
      icon: <XIcon className="w-8 h-8 text-red-400" />,
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/50',
      textColor: 'text-red-300',
    },
  }[recommendation];

  if (!verdictConfig) {
      return null;
  }

  return (
    <div className={`p-6 rounded-2xl border ${verdictConfig.borderColor} ${verdictConfig.bgColor} mb-10`}>
      <h3 className="text-xl font-bold mb-4">AI Recommendation</h3>
      <div className="flex flex-col sm:flex-row items-center gap-6">
        <div className="flex flex-col items-center flex-shrink-0">
          {verdictConfig.icon}
          <p className={`mt-2 text-lg font-bold ${verdictConfig.textColor}`}>{verdictConfig.text}</p>
        </div>
        <div className="w-px bg-slate-600 self-stretch hidden sm:block"></div>
        <div className="flex-grow text-center sm:text-left">
          <p className="font-semibold text-slate-300">Suitability Score:</p>
          <p className="text-5xl font-extrabold text-white">{suitabilityScore}<span className="text-2xl text-slate-400">/10</span></p>
          <p className="mt-4 text-sm text-slate-400">{recommendationReasoning}</p>
        </div>
      </div>
    </div>
  );
};

const PerformanceReportDisplay: React.FC<PerformanceReportDisplayProps> = ({ report, onBackToHome }) => {
  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-400';
    if (score >= 5) return 'text-yellow-400';
    return 'text-red-400';
  };

  const ScoreCircle: React.FC<{ score: number, label: string }> = ({ score, label }) => (
    <div className="flex flex-col items-center">
        <div className={`relative w-32 h-32 rounded-full flex items-center justify-center bg-slate-800 border-4 ${getScoreColor(score).replace('text-', 'border-')}`}>
            <span className={`text-4xl font-bold ${getScoreColor(score)}`}>{score}</span>
            <span className="absolute bottom-6 text-sm text-slate-400">/ 10</span>
        </div>
        <p className="mt-3 font-semibold text-slate-300">{label}</p>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <h2 className="text-4xl font-extrabold text-center mb-4">Candidate Performance Report</h2>
      <div className="text-center text-slate-400 mb-10 flex flex-col sm:flex-row justify-center items-center gap-x-6 gap-y-2">
        <span><strong>Candidate:</strong> {report.candidateName}</span>
        <span className="hidden sm:inline text-slate-600">|</span>
        <span><strong>Time Taken:</strong> {formatTime(report.timeTakenSeconds)} / {formatTime(report.totalDurationSeconds)}</span>
      </div>

      <RecommendationCard report={report} />

      <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-lg">
        <h3 className="text-xl font-bold text-blue-400 mb-3">Overall Summary</h3>
        <p className="text-slate-300 leading-relaxed">{report.summary}</p>
      </div>

      <div className="grid md:grid-cols-3 gap-8 my-10 text-center">
        <ScoreCircle score={report.problemSolvingScore} label="Problem Solving" />
        <ScoreCircle score={report.communicationScore} label="Communication" />
        <ScoreCircle score={report.stressManagementScore} label="Stress Management" />
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
          <h3 className="text-lg font-bold text-green-400 mb-4">Strengths</h3>
          <ul className="list-disc list-inside space-y-2 text-slate-300">
            {report.strengths.map((item, index) => <li key={index}>{item}</li>)}
          </ul>
        </div>
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
          <h3 className="text-lg font-bold text-yellow-400 mb-4">Areas for Improvement</h3>
          <ul className="list-disc list-inside space-y-2 text-slate-300">
            {report.areasForImprovement.map((item, index) => <li key={index}>{item}</li>)}
          </ul>
        </div>
      </div>

      <div className="text-center mt-12">
        <button
          onClick={onBackToHome}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg transition-colors"
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  );
};

export default PerformanceReportDisplay;