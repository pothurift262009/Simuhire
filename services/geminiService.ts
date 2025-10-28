import { GoogleGenAI, Type } from "@google/genai";
import type { Task, CandidateWork, Simulation } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  // This is a placeholder check. In the target environment, API_KEY is assumed to be present.
  console.warn("API_KEY environment variable not set. Gemini API calls will fail.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY! });

const taskSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING },
      title: { type: Type.STRING },
      description: { type: Type.STRING },
    },
    required: ["id", "title", "description"],
  },
};

const singleTaskSchema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      description: { type: Type.STRING },
    },
    required: ["title", "description"],
};


const assignTaskIds = (tasks: Omit<Task, 'id'>[]): Task[] => {
    return tasks.map((task, index) => ({
        ...task,
        id: `task-${Date.now()}-${index}`
    }));
};

export const generateSimulationTasks = async (jobTitle: string, jobDescription: string): Promise<Task[]> => {
  try {
    const prompt = `Based on the following job role, generate 5 realistic and distinct tasks that a candidate would perform during a 1-hour work simulation. The tasks should test a range of skills relevant to the role.

Job Title: ${jobTitle}
Job Description: ${jobDescription}

Return the tasks as a JSON array.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: taskSchema,
      },
    });

    const tasks = JSON.parse(response.text);
    return assignTaskIds(tasks);

  } catch (error) {
    console.error("Error generating simulation tasks:", error);
    // Fallback to generic tasks if API fails
    return [
      { id: 'fallback-1', title: 'Review Project Brief', description: 'Read the attached project brief and summarize the key deliverables.' },
      { id: 'fallback-2', title: 'Draft a Client Email', description: 'Write an email to a client providing an update on their project status.' },
      { id: 'fallback-3', title: 'Analyze Data Set', description: 'Look at the provided spreadsheet and identify the top 3 trends.' },
      { id: 'fallback-4', title: 'Brainstorm Solutions', description: 'A project has been delayed. Brainstorm three potential solutions to get it back on track.' },
      { id: 'fallback-5', title: 'Prepare a Quick Report', description: 'Using the text editor, write a short report summarizing your findings from the data analysis.' }
    ];
  }
};

export const modifySimulationTasks = async (
  jobTitle: string,
  jobDescription: string,
  currentTasks: Task[],
  modification: string
): Promise<Task[]> => {
  try {
    const prompt = `You are an assistant helping a recruiter refine a work simulation.
    
Job Title: ${jobTitle}
Job Description: ${jobDescription}

Here is the current list of tasks for the simulation:
${JSON.stringify(currentTasks, null, 2)}

The recruiter has requested the following modification: "${modification}"

Please generate and return a new, complete list of tasks that incorporates this change. Maintain the same JSON format.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: taskSchema,
      },
    });

    const tasks = JSON.parse(response.text);
    return assignTaskIds(tasks);

  } catch (error) {
    console.error("Error modifying simulation tasks:", error);
    // On error, return the original tasks
    return currentTasks;
  }
};

export const regenerateOrModifySingleTask = async (
  jobTitle: string,
  jobDescription: string,
  allTasks: Task[],
  taskToChange: Task,
  instruction: string
): Promise<Omit<Task, 'id'>> => {
  const otherTasks = allTasks.filter(t => t.id !== taskToChange.id);
  
  const prompt = `You are an assistant helping a recruiter refine a single task within a work simulation.

Job Title: ${jobTitle}
Job Description: ${jobDescription}

Here is the full list of existing tasks, for context, to avoid creating a duplicate:
${JSON.stringify(otherTasks, null, 2)}

Here is the specific task to be changed:
${JSON.stringify(taskToChange, null, 2)}

The recruiter's instruction for this task is: "${instruction}"

Please generate ONLY the single, updated task based on this instruction. Do not return the whole list. Return a single JSON object with "title" and "description".`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: singleTaskSchema,
      },
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Error modifying single task:", error);
    // On error, return the original task content
    return { title: taskToChange.title, description: taskToChange.description };
  }
};

export const generateSingleTask = async (
  jobTitle: string,
  jobDescription: string,
  existingTasks: Task[]
): Promise<Omit<Task, 'id'>> => {
    const prompt = `You are an assistant helping a recruiter create a work simulation.

Job Title: ${jobTitle}
Job Description: ${jobDescription}

Here is the list of existing tasks. Please generate ONE new, distinct task that is not a repeat of the ones below:
${JSON.stringify(existingTasks, null, 2)}

Return a single JSON object for the new task with "title" and "description".`;
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: singleTaskSchema,
      },
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Error generating single task:", error);
    return { title: "New Task (Error)", description: "Could not generate a new task. Please try again." };
  }
};


export const analyzeCandidatePerformance = async (simulation: {jobTitle: string, jobDescription: string}, work: CandidateWork): Promise<string> => {
    try {
        const prompt = `
        Analyze the following candidate's work from a 1-hour job simulation for the role of a ${simulation.jobTitle}.
        Job Description: ${simulation.jobDescription}

        Candidate's Work:
        - Chat Logs: ${JSON.stringify(work.chatLogs)}
        - Text Editor Content: """${work.editorContent}"""
        - Email Draft: To: ${work.emailContent.to}, Subject: ${work.emailContent.subject}, Body: """${work.emailContent.body}"""
        - Sheet Data: ${JSON.stringify(work.sheetContent)}
        - Client Call Transcript: """${work.callTranscript}"""

        Evaluate the candidate's performance based on:
        1.  Problem-Solving: Assess their approach to tasks, logical reasoning, and quality of work in the editor, sheet, and email.
        2.  Communication: Evaluate the clarity, professionalism, and tone in their written (email, chat) and verbal (call transcript) communications.
        3.  Stress Management & Adaptability: Analyze how they handled the unexpected client call. Look for signs of panic, professionalism under pressure, and their ability to switch context.

        Provide a detailed performance report. Return a JSON object with the specified structure.
        Scores should be out of 10.
        `;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        summary: { type: Type.STRING },
                        strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
                        areasForImprovement: { type: Type.ARRAY, items: { type: Type.STRING } },
                        stressManagementScore: { type: Type.NUMBER },
                        communicationScore: { type: Type.NUMBER },
                        problemSolvingScore: { type: Type.NUMBER },
                    },
                    required: ["summary", "strengths", "areasForImprovement", "stressManagementScore", "communicationScore", "problemSolvingScore"]
                },
            },
        });
        
        return response.text;

    } catch (error) {
        console.error("Error analyzing performance:", error);
        return JSON.stringify({
            summary: "Could not generate AI analysis due to an error.",
            strengths: [],
            areasForImprovement: ["The AI analysis service failed. Please review the raw data manually."],
            stressManagementScore: 0,
            communicationScore: 0,
            problemSolvingScore: 0,
        });
    }
};

export const getChatResponse = async (
  simulation: { jobTitle: string; tasks: Task[] },
  chatHistory: { author: 'Candidate' | 'AI'; message: string }[]
): Promise<string> => {
  const historyString = chatHistory
    .map(entry => `${entry.author === 'Candidate' ? 'User' : 'Assistant'}: ${entry.message}`)
    .join('\n');

  const prompt = `You are a helpful AI assistant in a work simulation, acting as a senior colleague.
The candidate is performing a simulation for the role of: ${simulation.jobTitle}.

Their assigned tasks are:
${simulation.tasks.map(t => `- ${t.title}: ${t.description}`).join('\n')}

Below is the conversation history. The last message is from the candidate.
${historyString}

Your role is to provide concise, helpful guidance. Do not give away the answers to the tasks directly. Instead, prompt the candidate to think critically. Keep your responses brief and professional.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text.trim();
  } catch (error) {
    console.error("Error getting chat response:", error);
    return "I'm sorry, I'm having trouble connecting right now. Please try again in a moment.";
  }
};


// Base64 and Audio decoding helpers for Live API
export function decode(base64: string) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

export async function decodeAudioData(
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number,
): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    return buffer;
}
