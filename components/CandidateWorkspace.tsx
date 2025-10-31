
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Simulation, CandidateWork, PerformanceReport, Task } from '../types';
import { analyzeCandidatePerformance, getChatResponse } from '../services/geminiService';
import { ChatIcon, SpinnerIcon, ExclamationIcon, CheckCircleIcon } from './Icons';
import { ClientCallModal } from './ClientCallModal';

type TaskStatus = 'pending' | 'submitted';

interface CandidateWorkspaceProps {
  simulation: Simulation;
  onComplete: (completionData: { 
    reportData: Omit<PerformanceReport, 'simulationId' | 'candidateEmail' | 'candidateName' | 'timeTakenSeconds' | 'totalDurationSeconds' | 'completedAt'>,
    timeTakenSeconds: number 
  }, simulationId: string) => void;
}

const CandidateWorkspace: React.FC<CandidateWorkspaceProps> = ({ simulation, onComplete }) => {
  const [timeLeft, setTimeLeft] = useState(simulation.durationMinutes * 60);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCallModal, setShowCallModal] = useState(false);
  const [submissionReason, setSubmissionReason] = useState<'manual' | 'auto'>('manual');
  const [warningMessage, setWarningMessage] = useState(
    'Switching tabs or windows is not allowed. Your session will auto-submit after 2 switches.'
  );

  const [taskData, setTaskData] = useState<Record<string, { answer: string; status: TaskStatus }>>(
    () => Object.fromEntries(
      simulation.tasks.map(task => [task.id, { answer: '', status: 'pending' }])
    )
  );

  const workRef = useRef<Pick<CandidateWork, 'chatLogs' | 'callTranscript'>>({
    chatLogs: [{ author: 'AI', message: `Hello! I'm your AI assistant for this simulation. I'm here to act as a senior colleague. Feel free to ask me questions if you get stuck. Good luck!` }],
    callTranscript: 'N/A',
  });

  const switchCountRef = useRef(0);
  const timeLeftRef = useRef(simulation.durationMinutes * 60);
  const isSubmittingRef = useRef(false);

  const handleCallClose = (transcript: string) => {
    workRef.current.callTranscript = transcript;
    setShowCallModal(false);
  };

  const handleAnswerChange = (taskId: string, answer: string) => {
    if (taskData[taskId].status === 'pending') {
      setTaskData(prev => ({
        ...prev,
        [taskId]: { ...prev[taskId], answer },
      }));
    }
  };

  const handleSubmitTask = (taskId: string) => {
    if (window.confirm("You cannot edit this answer after submitting. Are you sure you want to submit?")) {
      setTaskData(prev => ({
        ...prev,
        [taskId]: { ...prev[taskId], status: 'submitted' },
      }));
    }
  };

  const submitWork = useCallback(async (reason: 'manual' | 'auto' = 'manual') => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    
    setTimeLeft(0); 

    setIsSubmitting(true);
    setSubmissionReason(reason);

    const timeTaken = simulation.durationMinutes * 60 - timeLeftRef.current;
    
    const finalWork: CandidateWork = {
        chatLogs: workRef.current.chatLogs,
        callTranscript: workRef.current.callTranscript,
        taskAnswers: Object.fromEntries(
            Object.entries(taskData)
                // Fix: Explicitly cast `data` to its known type.
                // TypeScript can sometimes fail to infer the correct type for values from Object.entries on a Record.
                .filter(([, data]) => (data as { status: TaskStatus }).status === 'submitted')
                .map(([id, data]) => [id, (data as { answer: string }).answer])
        )
    };

    try {
        const reportJson = await analyzeCandidatePerformance(
            { jobTitle: simulation.jobTitle, jobDescription: simulation.jobDescription, tasks: simulation.tasks },
            finalWork
        );
        onComplete({ reportData: JSON.parse(reportJson), timeTakenSeconds: timeTaken }, simulation.id);
    } catch (error) {
        console.error("Failed to submit and analyze work:", error);
        const errorReport = {
            summary: "Could not generate AI analysis due to a submission error.",
            strengths: [],
            areasForImprovement: ["The AI analysis service failed. The recruiter will review the raw data manually."],
            stressManagementScore: 0,
            communicationScore: 0,
            problemSolvingScore: 0,
        };
        onComplete({ reportData: errorReport, timeTakenSeconds: timeTaken }, simulation.id);
    }
  }, [simulation, onComplete, taskData]);


  // Effect for timer and auto-submission
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          submitWork('manual');
          return 0;
        }
        timeLeftRef.current = prev - 1;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [submitWork]);
  
  // Effect for tab switching detection
  useEffect(() => {
    const handleVisibilityChange = () => {
        if (document.visibilityState === 'hidden' && !isSubmittingRef.current) {
            const newCount = switchCountRef.current + 1;
            switchCountRef.current = newCount;

            if (newCount === 1) {
                setWarningMessage('Warning: You have switched away. 1 switch remaining.');
            } else if (newCount === 2) {
                setWarningMessage('Final Warning: Switching away again will end the simulation.');
            } else if (newCount > 2) {
                submitWork('auto');
            }
        }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [submitWork]);


  // Effect for scheduling the client call
  useEffect(() => {
    if (simulation.clientCallEnabled) {
      const minTime = simulation.clientCallTimeRange?.min ?? 10;
      const maxTime = simulation.clientCallTimeRange?.max ?? 50;

      if (minTime < maxTime) {
        const randomTimeInMinutes = Math.random() * (maxTime - minTime) + minTime;
        const randomCallTimeInMillis = randomTimeInMinutes * 60 * 1000;
        
        const callTimeout = setTimeout(() => {
            if (!isSubmittingRef.current) {
              setShowCallModal(true);
            }
        }, randomCallTimeInMillis);
        return () => clearTimeout(callTimeout);
      }
    }
  }, [simulation.clientCallEnabled, simulation.clientCallTimeRange]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {isSubmitting && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="text-center text-white flex flex-col items-center">
                <SpinnerIcon className="w-12 h-12 text-blue-400 mb-4" />
                <p className="text-2xl font-bold">
                  {submissionReason === 'auto'
                    ? 'Auto-Submitting Session...'
                    : 'Submitting and Analyzing...'}
                </p>
                <p className="text-slate-300">
                  {submissionReason === 'auto'
                    ? 'Session ended due to excessive tab switching.'
                    : 'Our AI is evaluating your performance. Please wait.'}
                </p>
            </div>
        </div>
      )}
      {showCallModal && <ClientCallModal jobTitle={simulation.jobTitle} onClose={handleCallClose} />}

      <div className="bg-yellow-500/20 border-b-2 border-yellow-500 text-yellow-300 p-2 text-center flex items-center justify-center gap-2">
          <ExclamationIcon className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-semibold">{warningMessage}</span>
      </div>

      <header className="flex-shrink-0 flex items-center justify-between p-4 bg-slate-800/50 border-b border-slate-700 rounded-t-lg">
        <div>
          <h2 className="text-xl font-bold">{simulation.jobTitle} Simulation</h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-lg font-mono bg-slate-700 px-3 py-1 rounded-md">
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </div>
          <button 
            onClick={() => submitWork('manual')}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition-colors"
          >
            Finish & Submit
          </button>
        </div>
      </header>

      <div className="flex-grow flex flex-col md:flex-row min-h-0">
        <main className="w-full md:w-2/3 p-4 bg-slate-900 overflow-y-auto">
          <h3 className="text-lg font-semibold mb-4 text-blue-300">Your Tasks</h3>
          <div className="space-y-6">
            {simulation.tasks.map(task => (
              <TaskAnswerCard
                key={task.id}
                task={task}
                data={taskData[task.id]}
                onAnswerChange={handleAnswerChange}
                onSubmit={handleSubmitTask}
              />
            ))}
          </div>
        </main>
        <aside className="w-full md:w-1/3 border-l border-slate-700 bg-slate-800 flex flex-col">
            <ChatTool workRef={workRef} simulation={simulation} />
        </aside>
      </div>
    </div>
  );
};

interface TaskAnswerCardProps {
  task: Task;
  data: { answer: string; status: TaskStatus };
  onAnswerChange: (taskId: string, answer: string) => void;
  onSubmit: (taskId: string) => void;
}

const TaskAnswerCard: React.FC<TaskAnswerCardProps> = ({ task, data, onAnswerChange, onSubmit }) => {
  const isSubmitted = data.status === 'submitted';
  return (
    <div className={`bg-slate-800/70 p-4 rounded-lg border ${isSubmitted ? 'border-green-500/50' : 'border-slate-700'}`}>
      <div className="flex justify-between items-start">
        <div>
          <p className="font-bold text-lg text-blue-300">{task.title}</p>
          <p className="text-sm text-slate-400 mt-1">{task.description}</p>
        </div>
        {isSubmitted && (
          <div className="flex items-center gap-2 text-green-400 font-semibold text-sm bg-green-500/10 px-3 py-1 rounded-full">
            <CheckCircleIcon className="w-5 h-5" />
            <span>Submitted</span>
          </div>
        )}
      </div>
      <div className="mt-4">
        <textarea
          value={data.answer}
          onChange={(e) => onAnswerChange(task.id, e.target.value)}
          placeholder={isSubmitted ? "This answer has been submitted." : "Type your answer here..."}
          disabled={isSubmitted}
          rows={6}
          className="w-full bg-slate-700 border border-slate-600 rounded-md p-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-800 disabled:text-slate-500"
        />
      </div>
      <div className="mt-3 flex justify-end">
        <button
          onClick={() => onSubmit(task.id)}
          disabled={isSubmitted || !data.answer.trim()}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-5 rounded-md text-sm transition-colors disabled:bg-slate-600 disabled:cursor-not-allowed"
        >
          Submit Task
        </button>
      </div>
    </div>
  );
};

const ChatTool: React.FC<{ workRef: React.MutableRefObject<Pick<CandidateWork, 'chatLogs'>>, simulation: Simulation }> = ({ workRef, simulation }) => {
  const [messages, setMessages] = useState(workRef.current.chatLogs);
  const [input, setInput] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const messagesEndRef = useRef<null | HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAiTyping]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isAiTyping) return;

    const userMessage = { author: 'Candidate' as const, message: input.trim() };
    const newMessages = [...messages, userMessage];
    
    setMessages(newMessages);
    workRef.current.chatLogs = newMessages;
    setInput('');
    setIsAiTyping(true);

    try {
        const aiResponse = await getChatResponse(
          { jobTitle: simulation.jobTitle, tasks: simulation.tasks },
          newMessages
        );
        const aiMessage = { author: 'AI' as const, message: aiResponse };
        const finalMessages = [...newMessages, aiMessage];
        setMessages(finalMessages);
        workRef.current.chatLogs = finalMessages;
    } catch (error) {
        const errorMessage = { author: 'AI' as const, message: "I'm sorry, I encountered an error. Please try again." };
        const finalMessages = [...newMessages, errorMessage];
        setMessages(finalMessages);
        workRef.current.chatLogs = finalMessages;
        console.error("Chat error:", error);
    } finally {
        setIsAiTyping(false);
    }
  };
    
  return (
      <div className="flex flex-col h-full">
          <header className="flex-shrink-0 p-4 border-b border-slate-700 flex items-center gap-2">
            <ChatIcon className="w-6 h-6 text-blue-400" />
            <h3 className="text-lg font-semibold">AI Assistant</h3>
          </header>
          <div className="flex-grow overflow-y-auto p-4 space-y-4">
              {messages.map((msg, index) => (
                  <div key={index} className={`flex ${msg.author === 'Candidate' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-xs px-4 py-2 rounded-lg ${msg.author === 'Candidate' ? 'bg-blue-600' : 'bg-slate-700'}`}>
                          <p className="text-white text-sm">{msg.message}</p>
                      </div>
                  </div>
              ))}
              {isAiTyping && (
                  <div className="flex justify-start">
                      <div className="bg-slate-700 px-4 py-2 rounded-lg">
                          <div className="flex items-center space-x-1">
                              <span className="text-white animate-pulse">.</span>
                              <span className="text-white animate-pulse delay-150">.</span>
                              <span className="text-white animate-pulse delay-300">.</span>
                          </div>
                      </div>
                  </div>
              )}
              <div ref={messagesEndRef} />
          </div>
          <form onSubmit={handleSend} className="flex-shrink-0 p-4 bg-slate-800/50 border-t border-slate-700">
              <div className="flex gap-2">
                  <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Ask your AI assistant..."
                      className="w-full bg-slate-700 border border-slate-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={isAiTyping}
                  />
                  <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:bg-slate-500" disabled={isAiTyping || !input.trim()}>
                      Send
                  </button>
              </div>
          </form>
      </div>
  )
}

export default CandidateWorkspace;
