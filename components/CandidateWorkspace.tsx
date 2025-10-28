
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Simulation, Tool, CandidateWork, PerformanceReport } from '../types';
import { analyzeCandidatePerformance, getChatResponse } from '../services/geminiService';
import { ChatIcon, DocumentTextIcon, TableIcon, MailIcon, SpinnerIcon } from './Icons';
import { ClientCallModal } from './ClientCallModal';

interface CandidateWorkspaceProps {
  simulation: Simulation;
  onComplete: (completionData: { 
    reportData: Omit<PerformanceReport, 'simulationId' | 'candidateEmail' | 'candidateName' | 'timeTakenSeconds' | 'totalDurationSeconds' | 'completedAt'>,
    timeTakenSeconds: number 
  }, simulationId: string) => void;
}

const CandidateWorkspace: React.FC<CandidateWorkspaceProps> = ({ simulation, onComplete }) => {
  const [activeTool, setActiveTool] = useState<Tool>(simulation.availableTools[0]);
  const [timeLeft, setTimeLeft] = useState(simulation.durationMinutes * 60);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCallModal, setShowCallModal] = useState(false);

  const workRef = useRef<CandidateWork>({
    chatLogs: [{ author: 'AI', message: `Hello! I'm your AI assistant for this simulation. I'm here to act as a senior colleague. Feel free to ask me questions if you get stuck. Good luck!` }],
    editorContent: '',
    sheetContent: Array(10).fill(Array(5).fill('')),
    emailContent: { to: '', subject: '', body: '' },
    callTranscript: 'N/A',
  });

  const handleCallClose = (transcript: string) => {
    workRef.current.callTranscript = transcript;
    setShowCallModal(false);
  };

  const submitWork = useCallback(async (finalTimeLeft: number) => {
    setIsSubmitting(true);
    const timeTaken = simulation.durationMinutes * 60 - finalTimeLeft;
    try {
        const reportJson = await analyzeCandidatePerformance(
            { jobTitle: simulation.jobTitle, jobDescription: simulation.jobDescription },
            workRef.current
        );
        onComplete({ reportData: JSON.parse(reportJson), timeTakenSeconds: timeTaken }, simulation.id);
    } catch (error) {
        console.error("Failed to submit and analyze work:", error);
        // Fallback for submission error
        const errorReport = {
            summary: "Could not generate AI analysis due to a submission error.",
            strengths: [],
            areasForImprovement: ["The AI analysis service failed. The recruiter will review the raw data manually."],
            stressManagementScore: 0,
            communicationScore: 0,
            problemSolvingScore: 0,
        };
        onComplete({ reportData: errorReport, timeTakenSeconds: timeTaken }, simulation.id);
    } finally {
        setIsSubmitting(false);
    }
  }, [simulation, onComplete]);


  // Effect for timer and auto-submission
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          submitWork(0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
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
            setShowCallModal(true);
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
                <p className="text-2xl font-bold">Submitting and Analyzing...</p>
                <p className="text-slate-300">Our AI is evaluating your performance. Please wait.</p>
            </div>
        </div>
      )}
      {showCallModal && <ClientCallModal jobTitle={simulation.jobTitle} onClose={handleCallClose} />}

      <header className="flex-shrink-0 flex items-center justify-between p-4 bg-slate-800/50 border-b border-slate-700 rounded-t-lg">
        <div>
          <h2 className="text-xl font-bold">{simulation.jobTitle} Simulation</h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-lg font-mono bg-slate-700 px-3 py-1 rounded-md">
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </div>
          <button 
            onClick={() => submitWork(timeLeft)}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition-colors"
          >
            Submit
          </button>
        </div>
      </header>

      <div className="flex-grow flex flex-col md:flex-row min-h-0">
        <aside className="w-full md:w-1/3 p-4 border-r border-slate-700 overflow-y-auto bg-slate-800">
          <h3 className="text-lg font-semibold mb-4">Your Tasks</h3>
          <ul className="space-y-4">
            {simulation.tasks.map(task => (
              <li key={task.id} className="bg-slate-700/50 p-3 rounded-md">
                <p className="font-bold">{task.title}</p>
                <p className="text-sm text-slate-400 mt-1">{task.description}</p>
              </li>
            ))}
          </ul>
        </aside>

        <main className="w-full md:w-2/3 flex flex-col bg-slate-900 rounded-b-lg md:rounded-bl-none">
          <div className="flex-shrink-0 border-b border-slate-700">
            <nav className="flex space-x-1">
              {simulation.availableTools.map(tool => (
                <button
                  key={tool}
                  onClick={() => setActiveTool(tool)}
                  className={`px-4 py-3 text-sm font-medium flex items-center gap-2 ${activeTool === tool ? 'bg-slate-800 text-blue-400' : 'text-slate-400 hover:bg-slate-800/50'}`}
                >
                  {tool === Tool.CHAT && <ChatIcon className="w-5 h-5"/>}
                  {tool === Tool.EDITOR && <DocumentTextIcon className="w-5 h-5"/>}
                  {tool === Tool.SHEET && <TableIcon className="w-5 h-5"/>}
                  {tool === Tool.EMAIL && <MailIcon className="w-5 h-5"/>}
                  {tool}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex-grow p-4 overflow-y-auto">
            <ToolRenderer activeTool={activeTool} workRef={workRef} simulation={simulation} />
          </div>
        </main>
      </div>
    </div>
  );
};

interface ToolRendererProps {
  activeTool: Tool;
  workRef: React.MutableRefObject<CandidateWork>;
  simulation: Simulation;
}

const ToolRenderer: React.FC<ToolRendererProps> = ({ activeTool, workRef, simulation }) => {
  switch (activeTool) {
    case Tool.EDITOR:
      return <EditorTool workRef={workRef} />;
    case Tool.SHEET:
      return <SheetTool workRef={workRef} />;
    case Tool.EMAIL:
      return <EmailTool workRef={workRef} />;
    case Tool.CHAT:
    default:
      return <ChatTool workRef={workRef} simulation={simulation} />;
  }
};

const ChatTool: React.FC<{ workRef: React.MutableRefObject<CandidateWork>, simulation: Simulation }> = ({ workRef, simulation }) => {
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

    const aiResponse = await getChatResponse(
      { jobTitle: simulation.jobTitle, tasks: simulation.tasks },
      newMessages
    );

    const aiMessage = { author: 'AI' as const, message: aiResponse };
    const finalMessages = [...newMessages, aiMessage];
    setMessages(finalMessages);
    workRef.current.chatLogs = finalMessages;
    setIsAiTyping(false);
  };
    
    return (
        <div className="flex flex-col h-full">
            <div className="flex-grow overflow-y-auto p-4 space-y-4">
                {messages.map((msg, index) => (
                    <div key={index} className={`flex ${msg.author === 'Candidate' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-xs md:max-w-md lg:max-w-2xl px-4 py-2 rounded-lg ${msg.author === 'Candidate' ? 'bg-blue-600' : 'bg-slate-700'}`}>
                            <p className="text-white">{msg.message}</p>
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
            <form onSubmit={handleSend} className="flex-shrink-0 p-4 bg-slate-800/50">
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

const EditorTool: React.FC<{ workRef: React.MutableRefObject<CandidateWork> }> = ({ workRef }) => (
  <textarea 
    defaultValue={workRef.current.editorContent}
    onChange={e => workRef.current.editorContent = e.target.value}
    className="w-full h-full bg-slate-800 border border-slate-700 rounded-md p-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
    placeholder="Start writing your document..."
  />
);

const SheetTool: React.FC<{ workRef: React.MutableRefObject<CandidateWork> }> = ({ workRef }) => {
    const [sheetData, setSheetData] = useState(workRef.current.sheetContent);

    const handleCellChange = (rowIndex: number, colIndex: number, value: string) => {
        const newData = sheetData.map((row, rIdx) => 
            rIdx === rowIndex 
                ? row.map((cell, cIdx) => cIdx === colIndex ? value : cell)
                : row
        );
        setSheetData(newData);
        workRef.current.sheetContent = newData;
    };
    
    return (
        <div className="overflow-auto">
            <table className="w-full border-collapse">
                <thead>
                    <tr>
                        {['', 'A', 'B', 'C', 'D', 'E'].map(header => (
                            <th key={header} className="p-2 border border-slate-700 bg-slate-800 text-slate-400 font-bold">{header}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {sheetData.map((row, rIdx) => (
                        <tr key={rIdx}>
                            <td className="p-2 border border-slate-700 bg-slate-800 text-slate-400 font-bold text-center">{rIdx + 1}</td>
                            {row.map((cell, cIdx) => (
                                <td key={cIdx} className="border border-slate-700">
                                    <input 
                                        type="text"
                                        value={cell}
                                        onChange={(e) => handleCellChange(rIdx, cIdx, e.target.value)}
                                        className="w-full h-full bg-transparent p-2 text-white focus:outline-none focus:bg-slate-700"
                                    />
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
};

const EmailTool: React.FC<{ workRef: React.MutableRefObject<CandidateWork> }> = ({ workRef }) => (
  <div className="space-y-4">
    <input 
      type="email" 
      placeholder="To:"
      defaultValue={workRef.current.emailContent.to}
      onChange={e => workRef.current.emailContent.to = e.target.value}
      className="w-full bg-slate-800 border-b border-slate-700 p-2 text-white focus:outline-none focus:border-blue-500"
    />
    <input 
      type="text" 
      placeholder="Subject:" 
      defaultValue={workRef.current.emailContent.subject}
      onChange={e => workRef.current.emailContent.subject = e.target.value}
      className="w-full bg-slate-800 border-b border-slate-700 p-2 text-white focus:outline-none focus:border-blue-500"
    />
    <textarea 
      defaultValue={workRef.current.emailContent.body}
      onChange={e => workRef.current.emailContent.body = e.target.value}
      className="w-full h-96 bg-slate-800 border border-slate-700 rounded-md p-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      placeholder="Compose your email..."
    />
  </div>
);


export default CandidateWorkspace;