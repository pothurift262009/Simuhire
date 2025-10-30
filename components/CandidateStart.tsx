
import React, { useState } from 'react';
import { PerformanceReport, Simulation } from '../types';
import { CalendarIcon } from './Icons';

interface CandidateStartProps {
  onStartSimulation: (simulationId: string) => void;
  completedSimulations: { simulation: Simulation; report: PerformanceReport }[];
  onViewReport: (report: PerformanceReport) => void;
  error?: string;
}

const CandidateStart: React.FC<CandidateStartProps> = ({ onStartSimulation, completedSimulations, onViewReport, error }) => {
  const [simulationId, setSimulationId] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (simulationId.trim()) {
      onStartSimulation(simulationId.trim());
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-2">Candidate Portal</h2>
        <p className="text-slate-400 mb-8">Enter a simulation ID to begin, or review your past simulations below.</p>
      </div>

      <div className="bg-slate-800 p-8 rounded-lg border border-slate-700 mb-12">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label htmlFor="sim-id" className="sr-only">Simulation ID</label>
          <input
            id="sim-id"
            type="text"
            value={simulationId}
            onChange={(e) => setSimulationId(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded-md shadow-sm py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-center font-mono text-lg"
            placeholder="SIM-..."
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={!simulationId.trim()}
            className="w-full py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-slate-500 disabled:cursor-not-allowed transition-colors"
          >
            Start Simulation
          </button>
        </form>
      </div>

       <div>
        <h3 className="text-2xl font-bold mb-6">Completed Simulations</h3>
        {completedSimulations.length > 0 ? (
          <div className="space-y-4">
            {completedSimulations.map(({ simulation, report }) => (
                <div key={report.simulationId} className="bg-slate-800 rounded-lg border border-slate-700 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex-grow w-full">
                        <p className="font-bold text-lg text-blue-300">{simulation.jobTitle}</p>
                        <p className="text-sm text-slate-400 mt-1 flex items-center gap-1.5">
                            <CalendarIcon className="w-4 h-4"/>
                            Completed on {new Date(report.completedAt).toLocaleDateString()}
                        </p>
                    </div>
                    <button 
                        onClick={() => onViewReport(report)}
                        className="w-full sm:w-auto flex-shrink-0 bg-blue-600/80 hover:bg-blue-600 text-white font-semibold py-2 px-5 rounded-md text-sm transition-colors"
                    >
                        View Report
                    </button>
                </div>
            ))}
          </div>
        ) : (
            <div className="text-center py-10 px-6 bg-slate-800 rounded-lg border-2 border-dashed border-slate-700">
                <p className="text-slate-400">You haven't completed any simulations yet.</p>
                <p className="text-slate-500 text-sm mt-2">Enter an ID above to get started.</p>
            </div>
        )}
       </div>
    </div>
  );
};

export default CandidateStart;