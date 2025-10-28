import type { Task, CandidateWork, Simulation } from '../types';

const assignTaskIds = (tasks: Omit<Task, 'id'>[]): Task[] => {
    return tasks.map((task, index) => ({
        ...task,
        id: `task-${Date.now()}-${index}`
    }));
};

// Generic fetch handler for API calls
async function postApi<T>(endpoint: string, body: object, fallback: T): Promise<T> {
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            console.error(`API call to ${endpoint} failed with status ${response.status}`);
            return fallback;
        }
        return await response.json();
    } catch (error) {
        console.error(`Error fetching from ${endpoint}:`, error);
        return fallback;
    }
}

export const generateSimulationTasks = async (jobTitle: string, jobDescription: string): Promise<Task[]> => {
  const fallbackTasks: Task[] = [
      { id: 'fallback-1', title: 'Review Project Brief', description: 'Read the attached project brief and summarize the key deliverables.' },
      { id: 'fallback-2', title: 'Draft a Client Email', description: 'Write an email to a client providing an update on their project status.' },
      { id: 'fallback-3', title: 'Analyze Data Set', description: 'Look at the provided spreadsheet and identify the top 3 trends.' },
      { id: 'fallback-4', title: 'Brainstorm Solutions', description: 'A project has been delayed. Brainstorm three potential solutions to get it back on track.' },
      { id: 'fallback-5', title: 'Prepare a Quick Report', description: 'Using the text editor, write a short report summarizing your findings from the data analysis.' }
  ];
  
  const tasks = await postApi('/api/generate-tasks', { jobTitle, jobDescription }, []);
  // The server now returns tasks with IDs, but we keep assignTaskIds as a client-side fallback safety net.
  return tasks.length > 0 ? tasks : fallbackTasks;
};

export const modifySimulationTasks = async (
  jobTitle: string,
  jobDescription: string,
  currentTasks: Task[],
  modification: string
): Promise<Task[]> => {
  const tasks = await postApi('/api/modify-tasks', { jobTitle, jobDescription, currentTasks, modification }, []);
  return tasks.length > 0 ? tasks : currentTasks;
};

export const regenerateOrModifySingleTask = async (
  jobTitle: string,
  jobDescription: string,
  allTasks: Task[],
  taskToChange: Task,
  instruction: string
): Promise<Omit<Task, 'id'>> => {
  return await postApi('/api/regenerate-single-task', { jobTitle, jobDescription, allTasks, taskToChange, instruction }, { title: taskToChange.title, description: taskToChange.description });
};

export const generateSingleTask = async (
  jobTitle: string,
  jobDescription: string,
  existingTasks: Task[]
): Promise<Omit<Task, 'id'>> => {
    return await postApi('/api/generate-single-task', { jobTitle, jobDescription, existingTasks }, { title: "New Task (Error)", description: "Could not generate a new task. Please try again." });
};

export const analyzeCandidatePerformance = async (simulation: {jobTitle: string, jobDescription: string}, work: CandidateWork): Promise<string> => {
    const fallbackReport = {
        summary: "Could not generate AI analysis due to an error.",
        strengths: [],
        areasForImprovement: ["The AI analysis service failed. Please review the raw data manually."],
        stressManagementScore: 0,
        communicationScore: 0,
        problemSolvingScore: 0,
    };
    
    const report = await postApi('/api/analyze-performance', { simulation, work }, fallbackReport);
    return JSON.stringify(report);
};

export const getChatResponse = async (
  simulation: { jobTitle: string; tasks: Task[] },
  chatHistory: { author: 'Candidate' | 'AI'; message: string }[]
): Promise<string> => {
  const fallback = "I'm sorry, I'm having trouble connecting right now. Please try again in a moment.";
  const result = await postApi<{ text: string }>('/api/chat-response', { simulation, chatHistory }, { text: fallback });
  return result.text;
};

export const getClientCallResponse = async (
  jobTitle: string,
  chatHistory: { author: 'Client' | 'You'; text: string }[]
): Promise<string> => {
    const fallback = "Sorry, I think the line is breaking up. I'll have to call back later.";
    const result = await postApi<{ text: string }>('/api/client-call-response', { jobTitle, chatHistory }, { text: fallback });
    return result.text;
};
