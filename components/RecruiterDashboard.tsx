import React, { useState } from 'react';
import { generateSimulationTasks, modifySimulationTasks, regenerateOrModifySingleTask, generateSingleTask } from '../services/geminiService';
import { Simulation, Tool, Task } from '../types';
import { PencilIcon, RefreshIcon, TrashIcon, PlusIcon } from './Icons';

interface RecruiterDashboardProps {
  onCreateSimulation: (simulation: Simulation) => void;
  createdSimulation: Simulation | null;
}

type Step = 'form' | 'validate' | 'created';

const RecruiterDashboard: React.FC<RecruiterDashboardProps> = ({ onCreateSimulation, createdSimulation }) => {
  const [step, setStep] = useState<Step>('form');
  const [jobTitle, setJobTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [clientCallEnabled, setClientCallEnabled] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editInstruction, setEditInstruction] = useState('');
  const [taskSpecificLoading, setTaskSpecificLoading] = useState<Record<string, boolean>>({});

  const availableTools: Tool[] = [Tool.CHAT, Tool.EDITOR, Tool.SHEET, Tool.EMAIL];

  const handleGenerateTasks = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobTitle.trim() || !jobDescription.trim()) {
      setError('Job title and description cannot be empty.');
      return;
    }
    setError('');
    setIsLoading(true);

    try {
      const generatedTasks = await generateSimulationTasks(jobTitle, jobDescription);
      setTasks(generatedTasks);
      setStep('validate');
    } catch (err) {
      setError('Failed to generate tasks. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleModifyTasks = async (modification: string) => {
    setIsLoading(true);
    setError('');
    try {
        const modifiedTasks = await modifySimulationTasks(jobTitle, jobDescription, tasks, modification);
        setTasks(modifiedTasks);
    } catch (err) {
        setError('Failed to modify tasks. Please try again.');
        console.error(err);
    } finally {
        setIsLoading(false);
    }
  };
  
  const handleFinalizeSimulation = () => {
    const newSimulation: Simulation = {
        id: `SIM-${Date.now()}`,
        jobTitle,
        jobDescription,
        tasks,
        availableTools,
        clientCallEnabled,
        durationMinutes: 60,
      };
      onCreateSimulation(newSimulation);
      setStep('created');
  };

  const setTaskLoading = (taskId: string, isLoading: boolean) => {
    setTaskSpecificLoading(prev => ({ ...prev, [taskId]: isLoading }));
  };

  const handleRegenerateTask = async (taskToRegenerate: Task) => {
      setTaskLoading(taskToRegenerate.id, true);
      setError('');
      try {
          const newContent = await regenerateOrModifySingleTask(
              jobTitle,
              jobDescription,
              tasks,
              taskToRegenerate,
              "Regenerate this task completely to be something new and different."
          );
          setTasks(currentTasks => currentTasks.map(t => 
              t.id === taskToRegenerate.id ? { ...t, title: newContent.title, description: newContent.description } : t
          ));
      } catch (err) {
          setError('Failed to regenerate task.');
      } finally {
          setTaskLoading(taskToRegenerate.id, false);
      }
  };

  const handleDeleteTask = (taskId: string) => {
      setTasks(currentTasks => currentTasks.filter(t => t.id !== taskId));
  };

  const handleStartEdit = (task: Task) => {
      setEditingTaskId(task.id);
      setEditInstruction('');
  };

  const handleCancelEdit = () => {
      setEditingTaskId(null);
      setEditInstruction('');
  };

  const handleSaveChanges = async (taskToSave: Task) => {
      if (!editInstruction.trim()) return;
      setTaskLoading(taskToSave.id, true);
      setEditingTaskId(null);
      setError('');
      try {
          const newContent = await regenerateOrModifySingleTask(
              jobTitle,
              jobDescription,
              tasks,
              taskToSave,
              editInstruction
          );
          setTasks(currentTasks => currentTasks.map(t => 
              t.id === taskToSave.id ? { ...t, title: newContent.title, description: newContent.description } : t
          ));
      } catch (err) {
          setError('Failed to save changes.');
      } finally {
          setTaskLoading(taskToSave.id, false);
          setEditInstruction('');
      }
  };

  const handleAddNewTask = async () => {
      setIsLoading(true);
      setError('');
      try {
          const newTaskContent = await generateSingleTask(jobTitle, jobDescription, tasks);
          const newTask: Task = {
              ...newTaskContent,
              id: `task-${Date.now()}`
          };
          setTasks(currentTasks => [...currentTasks, newTask]);
      } catch (err) {
          setError('Failed to add a new task.');
      } finally {
          setIsLoading(false);
      }
  };


  const renderContent = () => {
    if (step === 'created' && createdSimulation) {
        return (
             <div className="bg-slate-800 p-6 rounded-lg border border-green-500/50 text-center animate-fade-in">
                <h3 className="text-2xl font-bold text-green-400">Simulation Created!</h3>
                <p className="text-slate-300 mt-2">Share the following ID with your candidate:</p>
                <div className="mt-4 bg-slate-900 p-4 rounded-md font-mono text-xl text-yellow-300 break-all">
                    {createdSimulation.id}
                </div>
                <p className="text-slate-400 mt-4 text-sm">Note: This ID is only valid for the current browser session.</p>
                <button onClick={() => {
                  setStep('form');
                  setJobTitle('');
                  setJobDescription('');
                  setTasks([]);
                }} className="mt-6 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors">
                    Create Another Simulation
                </button>
            </div>
        )
    }

    if (step === 'validate') {
        return (
            <div className="bg-slate-800 p-8 rounded-lg border border-slate-700 relative animate-fade-in">
                 {isLoading && <div className="absolute inset-0 bg-slate-800/80 flex items-center justify-center z-10 rounded-lg"><p className="text-white text-lg">Updating tasks...</p></div>}
                 <h3 className="text-2xl font-bold mb-4">Validate & Refine Tasks</h3>
                 <p className="text-slate-400 mb-6">Review the generated tasks. Use the controls to refine them, or use the quick actions for broad changes.</p>

                 <div className="space-y-4 mb-6">
                    {tasks.map((task, index) => (
                      <div key={task.id} className="relative bg-slate-900/70 p-4 rounded-md border border-slate-700 transition-all duration-300">
                          {taskSpecificLoading[task.id] && <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center z-10 rounded-md"><p>Updating...</p></div>}
                          <div className="flex justify-between items-start gap-4">
                              <div className="flex-grow">
                                  <p className="font-semibold text-blue-300">Task {index + 1}: {task.title}</p>
                                  <p className="text-sm text-slate-400 mt-1">{task.description}</p>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                  <button onClick={() => editingTaskId === task.id ? handleCancelEdit() : handleStartEdit(task)} title="Edit" className={`p-2 rounded-md transition-colors ${editingTaskId === task.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-700 hover:text-yellow-400'}`}><PencilIcon className="w-5 h-5"/></button>
                                  <button onClick={() => handleRegenerateTask(task)} title="Regenerate" className="p-2 text-slate-400 hover:bg-slate-700 hover:text-green-400 rounded-md transition-colors"><RefreshIcon className="w-5 h-5"/></button>
                                  <button onClick={() => handleDeleteTask(task.id)} title="Delete" className="p-2 text-slate-400 hover:bg-slate-700 hover:text-red-400 rounded-md transition-colors"><TrashIcon className="w-5 h-5"/></button>
                              </div>
                          </div>
                          {editingTaskId === task.id && (
                              <div className="mt-4 animate-fade-in">
                                  <label className="text-sm font-medium text-slate-300">Modification Instruction:</label>
                                  <textarea 
                                      value={editInstruction}
                                      onChange={(e) => setEditInstruction(e.target.value)}
                                      placeholder="e.g., Make this task focus more on data analysis"
                                      className="mt-1 block w-full bg-slate-700 border border-slate-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                      rows={2}
                                  />
                                  <div className="flex justify-end gap-2 mt-2">
                                      <button onClick={handleCancelEdit} className="px-3 py-1 bg-slate-600 hover:bg-slate-500 rounded-md text-sm transition-colors">Cancel</button>
                                      <button onClick={() => handleSaveChanges(task)} className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded-md text-sm transition-colors">Save Changes</button>
                                  </div>
                              </div>
                          )}
                      </div>
                  ))}
                 </div>

                 <button onClick={handleAddNewTask} disabled={isLoading} className="mb-6 flex items-center justify-center gap-2 w-full px-4 py-2 border-2 border-dashed border-slate-600 hover:border-blue-500 hover:text-blue-400 rounded-md text-slate-400 text-sm transition-colors disabled:opacity-50">
                    <PlusIcon className="w-5 h-5"/>
                    Add New Task
                </button>
                 
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <button onClick={() => handleModifyTasks("Increase the number of tasks by one.")} disabled={isLoading} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-md text-sm transition-colors disabled:opacity-50">More Questions</button>
                    <button onClick={() => handleModifyTasks("Decrease the number of tasks by one.")} disabled={isLoading} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-md text-sm transition-colors disabled:opacity-50">Fewer Questions</button>
                    <button onClick={() => handleModifyTasks("Increase the difficulty of the tasks for a senior-level candidate.")} disabled={isLoading} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-md text-sm transition-colors disabled:opacity-50">Increase Difficulty</button>
                    <button onClick={() => handleModifyTasks("Decrease the difficulty of the tasks for a junior-level candidate.")} disabled={isLoading} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-md text-sm transition-colors disabled:opacity-50">Decrease Difficulty</button>
                 </div>

                 {error && <p className="text-red-400 text-sm mb-4 text-center">{error}</p>}

                 <div className="flex justify-between items-center border-t border-slate-700 pt-6 mt-6">
                    <button onClick={() => setStep('form')} className="text-slate-400 hover:text-white transition-colors">Back</button>
                    <button onClick={handleFinalizeSimulation} className="py-3 px-6 bg-green-600 hover:bg-green-700 text-white font-bold rounded-md shadow-sm transition-colors disabled:opacity-50" disabled={tasks.length === 0}>
                        Finalize & Create Simulation ID
                    </button>
                 </div>
            </div>
        )
    }

    // Default step: 'form'
    return (
        <form onSubmit={handleGenerateTasks} className="space-y-6 bg-slate-800 p-8 rounded-lg border border-slate-700">
            <div>
            <label htmlFor="jobTitle" className="block text-sm font-medium text-slate-300">Job Title</label>
            <input
                type="text"
                id="jobTitle"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className="mt-1 block w-full bg-slate-700 border border-slate-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Senior Product Manager"
            />
            </div>
            <div>
            <label htmlFor="jobDescription" className="block text-sm font-medium text-slate-300">Job Description</label>
            <textarea
                id="jobDescription"
                rows={5}
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                className="mt-1 block w-full bg-slate-700 border border-slate-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Describe the key responsibilities and required skills for the role."
            />
            </div>
            <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-300">Enable Random Client Call?</span>
            <label htmlFor="clientCallToggle" className="inline-flex relative items-center cursor-pointer">
                <input 
                type="checkbox" 
                checked={clientCallEnabled}
                onChange={() => setClientCallEnabled(!clientCallEnabled)}
                id="clientCallToggle" 
                className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-600 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div>
            <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-slate-500 disabled:cursor-not-allowed transition-colors"
            >
                {isLoading ? 'Generating Tasks...' : 'Generate & Validate Tasks'}
            </button>
            </div>
        </form>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold mb-2">Recruiter Dashboard</h2>
      <p className="text-slate-400 mb-8">
        {step === 'form' ? 'Create a new workday simulation for a candidate.' : 'Validate and refine the generated tasks for the simulation.'}
      </p>
      {renderContent()}
    </div>
  );
};

export default RecruiterDashboard;