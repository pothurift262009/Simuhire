
import React, { useState, useMemo, useEffect } from 'react';
import { generateSimulationTasks, modifySimulationTasks, regenerateOrModifySingleTask, generateSingleTask } from '../services/geminiService';
import { Simulation, Tool, Task, PerformanceReport } from '../types';
import { PencilIcon, RefreshIcon, TrashIcon, PlusIcon, SpinnerIcon, ClipboardIcon, CalendarIcon, ClockIcon, CheckCircleIcon } from './Icons';

interface RecruiterDashboardProps {
  onCreateSimulation: (simulation: Simulation) => void;
  createdSimulation: Simulation | null;
  previousSimulations: Simulation[];
  completedReports: Record<string, PerformanceReport>;
  onViewReport: (report: PerformanceReport) => void;
}

type Step = 'form' | 'validate' | 'created';

const RecruiterDashboard: React.FC<RecruiterDashboardProps> = ({ onCreateSimulation, createdSimulation, previousSimulations, completedReports, onViewReport }) => {
  const [step, setStep] = useState<Step>('form');
  const [jobTitle, setJobTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [clientCallEnabled, setClientCallEnabled] = useState(true);
  const [callTimeMin, setCallTimeMin] = useState(10);
  const [callTimeMax, setCallTimeMax] = useState(50);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editInstruction, setEditInstruction] = useState('');
  const [taskSpecificLoading, setTaskSpecificLoading] = useState<Record<string, boolean>>({});

  const [showCustomTaskForm, setShowCustomTaskForm] = useState(false);
  const [customTaskTitle, setCustomTaskTitle] = useState('');
  const [customTaskDescription, setCustomTaskDescription] = useState('');
  
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // This effect ensures that when a new simulation is created and shown
  // in the "created!" screen, we reset to the main form view if the user
  // navigates away or another simulation is selected.
  useEffect(() => {
    if (createdSimulation) {
      const activeSimId = createdSimulation.id;
      if (previousSimulations.length > 0 && previousSimulations[0].id !== activeSimId) {
        // A new simulation has likely been created, reset the view
        setStep('form');
      }
    }
  }, [previousSimulations, createdSimulation]);

  const availableTools: Tool[] = [Tool.CHAT, Tool.EDITOR, Tool.SHEET, Tool.EMAIL];
  
  const isFormValid = useMemo(() => {
    if (!clientCallEnabled) return true;
    return callTimeMin < callTimeMax && callTimeMax <= durationMinutes;
  }, [clientCallEnabled, callTimeMin, callTimeMax, durationMinutes]);

  const handleGenerateTasks = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobTitle.trim() || !jobDescription.trim()) {
      setError('Job title and description cannot be empty.');
      return;
    }
    if (!isFormValid) {
        setError('Please fix the errors in the form before continuing.');
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
    const newSimulation: Omit<Simulation, 'recruiterEmail' | 'createdAt'> = {
        id: `SIM-${Date.now()}`,
        jobTitle,
        jobDescription,
        tasks,
        availableTools,
        clientCallEnabled,
        durationMinutes,
        ...(clientCallEnabled && {
            clientCallTimeRange: {
                min: callTimeMin,
                max: callTimeMax,
            }
        })
      };
      onCreateSimulation(newSimulation as Simulation);
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
  
  const handleCancelCustomTask = () => {
    setShowCustomTaskForm(false);
    setCustomTaskTitle('');
    setCustomTaskDescription('');
  };

  const handleSaveCustomTask = () => {
    if (!customTaskTitle.trim() || !customTaskDescription.trim()) {
      setError('Custom task title and description cannot be empty.');
      return;
    }
    setError('');
    const newTask: Task = {
      id: `task-${Date.now()}`,
      title: customTaskTitle.trim(),
      description: customTaskDescription.trim(),
    };
    setTasks((currentTasks) => [...currentTasks, newTask]);
    handleCancelCustomTask();
  };
  
  const handleCopyToClipboard = (id: string) => {
    navigator.clipboard.writeText(id).then(() => {
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const renderCreationContent = () => {
    if (step === 'created' && createdSimulation) {
        return (
             <div className="bg-slate-800 p-6 rounded-lg border border-green-500/50 text-center animate-fade-in mb-8">
                <h3 className="text-2xl font-bold text-green-400">Simulation Created!</h3>
                <p className="text-slate-300 mt-2">Share the following ID with your candidate:</p>
                <div className="mt-4 bg-slate-900 p-4 rounded-md font-mono text-xl text-yellow-300 break-all">
                    {createdSimulation.id}
                </div>
                 <button onClick={() => handleCopyToClipboard(createdSimulation.id)} className="mt-4 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-md text-sm transition-colors">
                    {copiedId === createdSimulation.id ? 'Copied!' : 'Copy ID'}
                </button>
                <p className="text-slate-400 mt-4 text-sm">Note: If you close this browser tab, you can find this simulation in your history below.</p>
                <button onClick={() => {
                  setStep('form');
                  setJobTitle('');
                  setJobDescription('');
                  setTasks([]);
                  setDurationMinutes(60);
                  setCallTimeMin(10);
                  setCallTimeMax(50);
                }} className="mt-6 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors">
                    Create Another Simulation
                </button>
            </div>
        )
    }

    if (step === 'validate') {
        return (
            <div className="bg-slate-800 p-8 rounded-lg border border-slate-700 relative animate-fade-in mb-8">
                 {isLoading && (
                    <div className="absolute inset-0 bg-slate-800/80 flex flex-col items-center justify-center z-10 rounded-lg">
                        <SpinnerIcon className="w-8 h-8 text-blue-400" />
                        <p className="text-white text-lg mt-3">Updating tasks...</p>
                    </div>
                )}
                 <h3 className="text-2xl font-bold mb-4">Validate & Refine Tasks</h3>
                 <p className="text-slate-400 mb-6">Review the generated tasks. Use the controls to refine them, or use the quick actions for broad changes.</p>

                 <div className="space-y-4 mb-6">
                    {tasks.map((task, index) => (
                      <div key={task.id} className="relative bg-slate-900/70 p-4 rounded-md border border-slate-700 transition-all duration-300">
                          {taskSpecificLoading[task.id] && (
                            <div className="absolute inset-0 bg-slate-900/80 flex flex-col items-center justify-center z-10 rounded-md">
                                <SpinnerIcon className="w-6 h-6 text-blue-400" />
                                <p className="mt-2 text-sm">Updating...</p>
                            </div>
                           )}
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
                 
                {showCustomTaskForm ? (
                    <div className="bg-slate-900/70 p-4 rounded-md border border-blue-500/50 space-y-3 mb-6 animate-fade-in">
                        <h4 className="font-semibold text-blue-300">Add Custom Task</h4>
                        <input
                            type="text"
                            placeholder="Task Title"
                            value={customTaskTitle}
                            onChange={(e) => setCustomTaskTitle(e.target.value)}
                            className="block w-full bg-slate-700 border border-slate-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                        <textarea
                            placeholder="Task Description"
                            value={customTaskDescription}
                            onChange={(e) => setCustomTaskDescription(e.target.value)}
                            className="block w-full bg-slate-700 border border-slate-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            rows={3}
                        />
                        <div className="flex justify-end gap-2">
                            <button onClick={handleCancelCustomTask} className="px-3 py-1 bg-slate-600 hover:bg-slate-500 rounded-md text-sm transition-colors">Cancel</button>
                            <button onClick={handleSaveCustomTask} className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded-md text-sm transition-colors">Save Task</button>
                        </div>
                    </div>
                ) : (
                    <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <button onClick={handleAddNewTask} disabled={isLoading} className="flex items-center justify-center gap-2 w-full px-4 py-2 border-2 border-dashed border-slate-600 hover:border-green-500 hover:text-green-400 rounded-md text-slate-400 text-sm transition-colors disabled:opacity-50">
                            <PlusIcon className="w-5 h-5"/>
                            Add AI-Generated Task
                        </button>
                        <button onClick={() => setShowCustomTaskForm(true)} disabled={isLoading} className="flex items-center justify-center gap-2 w-full px-4 py-2 border-2 border-dashed border-slate-600 hover:border-blue-500 hover:text-blue-400 rounded-md text-slate-400 text-sm transition-colors disabled:opacity-50">
                            <PencilIcon className="w-5 h-5"/>
                            Add Custom Task
                        </button>
                    </div>
                )}


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
        <div className="relative mb-8">
             <form onSubmit={handleGenerateTasks} className="space-y-6 bg-slate-800 p-8 rounded-lg border border-slate-700">
                <h2 className="text-2xl font-bold">Create New Simulation</h2>
                {isLoading && (
                    <div className="absolute inset-0 bg-slate-800/80 flex flex-col items-center justify-center z-10 rounded-lg">
                        <SpinnerIcon className="w-10 h-10 text-blue-400" />
                        <p className="text-white text-lg mt-4">Generating tasks...</p>
                        <p className="text-slate-400 text-sm">This may take a moment.</p>
                    </div>
                )}
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
                 <div>
                    <label htmlFor="duration" className="block text-sm font-medium text-slate-300">Simulation Duration (minutes)</label>
                    <input
                        type="number"
                        id="duration"
                        value={durationMinutes}
                        onChange={(e) => setDurationMinutes(Math.max(1, parseInt(e.target.value, 10)) || 1)}
                        className="mt-1 block w-full bg-slate-700 border border-slate-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        min="1"
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
                {clientCallEnabled && (
                    <div className="p-4 bg-slate-700/50 rounded-md animate-fade-in space-y-3">
                        <p className="text-sm font-medium text-slate-300">Client Call Timing</p>
                        <div className="flex items-center gap-4">
                            <div className="flex-1">
                                <label htmlFor="callTimeMin" className="block text-xs text-slate-400">Trigger after (min)</label>
                                <input
                                    type="number"
                                    id="callTimeMin"
                                    value={callTimeMin}
                                    onChange={(e) => setCallTimeMin(parseInt(e.target.value, 10) || 0)}
                                    className="mt-1 block w-full bg-slate-600 border border-slate-500 rounded-md py-1 px-2 text-white text-sm"
                                    min="0"
                                    max={durationMinutes}
                                />
                            </div>
                            <div className="text-slate-400 pt-4">and before</div>
                            <div className="flex-1">
                                <label htmlFor="callTimeMax" className="block text-xs text-slate-400">Max (min)</label>
                                <input
                                    type="number"
                                    id="callTimeMax"
                                    value={callTimeMax}
                                    onChange={(e) => setCallTimeMax(parseInt(e.target.value, 10) || 0)}
                                    className="mt-1 block w-full bg-slate-600 border border-slate-500 rounded-md py-1 px-2 text-white text-sm"
                                    min={callTimeMin}
                                    max={durationMinutes}
                                />
                            </div>
                        </div>
                        {callTimeMax > durationMinutes && <p className="text-xs text-yellow-400">Max call time cannot exceed simulation duration.</p>}
                        {callTimeMin >= callTimeMax && <p className="text-xs text-yellow-400">"Trigger after" time must be less than "Max" time.</p>}
                    </div>
                )}
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <div>
                <button
                    type="submit"
                    disabled={isLoading || !isFormValid}
                    className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-slate-500 disabled:cursor-not-allowed transition-colors"
                >
                    {isLoading ? 'Generating...' : 'Generate & Validate Tasks'}
                </button>
                </div>
            </form>
        </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold mb-8">Recruiter Dashboard</h2>
      
      {renderCreationContent()}
      
      <div className="mt-12">
        <h3 className="text-2xl font-bold mb-6">Previous Simulations</h3>
        {previousSimulations.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {previousSimulations.map(sim => {
              const report = completedReports[sim.id];
              const isCompleted = !!report;
              return (
                <div key={sim.id} className="bg-slate-800 rounded-lg border border-slate-700 p-5 flex flex-col justify-between">
                  <div>
                    <p className="font-bold text-lg text-blue-300">{sim.jobTitle}</p>
                    <div className="text-sm text-slate-400 mt-2 flex items-center gap-4">
                        <span className="flex items-center gap-1.5"><CalendarIcon className="w-4 h-4" /> Created: {new Date(sim.createdAt).toLocaleDateString()}</span>
                        {isCompleted ? (
                            <span className="flex items-center gap-1.5 text-green-400"><CheckCircleIcon className="w-4 h-4" /> Completed</span>
                        ) : (
                            <span className="flex items-center gap-1.5 text-yellow-400"><ClockIcon className="w-4 h-4" /> Pending</span>
                        )}
                    </div>
                    <div className="mt-3 flex items-center gap-2 bg-slate-900 p-2 rounded-md">
                        <span className="font-mono text-xs text-slate-400 flex-shrink-0">ID:</span>
                        <input type="text" readOnly value={sim.id} className="font-mono text-xs text-yellow-300 bg-transparent w-full focus:outline-none" />
                        <button onClick={() => handleCopyToClipboard(sim.id)} title="Copy ID" className="p-1 text-slate-400 hover:text-white transition-colors">
                            <ClipboardIcon className="w-4 h-4" />
                        </button>
                    </div>
                  </div>
                  {isCompleted && (
                     <button onClick={() => onViewReport(report)} className="mt-4 w-full text-center bg-green-600/20 text-green-300 border border-green-500/50 hover:bg-green-600/40 font-semibold py-2 px-4 rounded-md text-sm transition-colors">
                        View Report
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
            <div className="text-center py-10 px-6 bg-slate-800 rounded-lg border-2 border-dashed border-slate-700">
                <p className="text-slate-400">You haven't created any simulations yet.</p>
                <p className="text-slate-500 text-sm mt-2">Use the form above to get started.</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default RecruiterDashboard;
