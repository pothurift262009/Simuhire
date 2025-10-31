import React from 'react';
import { Task } from '../types';
import { XIcon } from './Icons';

interface SimulationPreviewModalProps {
  jobTitle: string;
  tasks: Task[];
  onClose: () => void;
}

const SimulationPreviewModal: React.FC<SimulationPreviewModalProps> = ({ jobTitle, tasks, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 border border-slate-700 flex flex-col max-h-[90vh]">
        <header className="flex-shrink-0 flex items-center justify-between p-4 border-b border-slate-700">
          <div>
            <h3 className="text-xl font-bold text-white">Simulation Preview</h3>
            <p className="text-sm text-slate-400">This is how tasks will appear to the candidate.</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-700 transition-colors">
            <XIcon className="w-6 h-6" />
          </button>
        </header>
        
        <div className="flex-grow p-6 overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4 text-blue-300">{jobTitle} Tasks</h3>
            {tasks.length > 0 ? (
              <ul className="space-y-4">
                {tasks.map((task, index) => (
                  <li key={task.id} className="bg-slate-700/50 p-4 rounded-md">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        id={`preview-task-${task.id}`}
                        disabled
                        className="mt-1 h-5 w-5 rounded border-slate-500 text-blue-500 focus:ring-blue-500 bg-slate-800"
                        aria-labelledby={`preview-task-title-${task.id}`}
                      />
                      <div className="flex-1">
                        <p id={`preview-task-title-${task.id}`} className="font-bold">{index + 1}. {task.title}</p>
                        <p className="text-sm text-slate-400 mt-1">{task.description}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
                <div className="text-center py-10 px-6 bg-slate-900/50 rounded-lg border-2 border-dashed border-slate-700">
                    <p className="text-slate-400">No tasks have been generated yet.</p>
                    <p className="text-slate-500 text-sm mt-2">Go back and generate tasks to see a preview.</p>
                </div>
            )}
        </div>

        <footer className="flex-shrink-0 p-4 border-t border-slate-700 text-right">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              Close Preview
            </button>
        </footer>
      </div>
    </div>
  );
};

export default SimulationPreviewModal;
