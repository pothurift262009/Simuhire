import React, { useState } from 'react';

interface CandidateStartProps {
  onStartSimulation: (simulationId: string) => void;
  error?: string;
}

const CandidateStart: React.FC<CandidateStartProps> = ({ onStartSimulation, error }) => {
  const [simulationId, setSimulationId] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (simulationId.trim()) {
      onStartSimulation(simulationId.trim());
    }
  };

  return (
    <div className="max-w-md mx-auto text-center">
      <h2 className="text-3xl font-bold mb-2">Candidate Portal</h2>
      <p className="text-slate-400 mb-8">Enter the simulation ID provided by your recruiter to begin.</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="text"
          value={simulationId}
          onChange={(e) => setSimulationId(e.target.value)}
          className="w-full bg-slate-700 border border-slate-600 rounded-md shadow-sm py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-center font-mono text-lg"
          placeholder="SIM-..."
        />
        {error && <p className="text-red-400 text-sm text-left">{error}</p>}
        <button
          type="submit"
          disabled={!simulationId.trim()}
          className="w-full py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-slate-500 disabled:cursor-not-allowed transition-colors"
        >
          Start Simulation
        </button>
      </form>
    </div>
  );
};

export default CandidateStart;