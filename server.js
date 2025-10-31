import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const app = express();
const port = process.env.PORT || 8080;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Middleware ---
app.use(express.json({ limit: '50mb' })); // Increase limit for file uploads
app.use(express.static(path.join(__dirname, 'dist')));

// --- Schemas for JSON responses ---
const taskSchema = {
  type: Type.OBJECT,
  properties: {
      id: { type: Type.STRING },
      title: { type: Type.STRING },
      description: { type: Type.STRING },
      type: { type: Type.STRING, enum: ['TEXT', 'IMAGE', 'AUDIO', 'VIDEO'] },
  },
  required: ["id", "title", "description", "type"],
};

const groupsSchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING },
            tasks: { type: Type.ARRAY, items: taskSchema },
        },
        required: ["title", "tasks"],
    },
};

const tasksSchemaWithoutId = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
        title: { type: Type.STRING },
        description: { type: Type.STRING },
        type: { type: Type.STRING, enum: ['TEXT', 'IMAGE', 'AUDIO', 'VIDEO'] },
    },
    required: ["title", "description", "type"],
  },
};
const singleTaskSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    description: { type: Type.STRING },
    type: { type: Type.STRING, enum: ['TEXT', 'IMAGE', 'AUDIO', 'VIDEO'] },
   },
  required: ["title", "description", "type"],
};
const analysisSchema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
    areasForImprovement: { type: Type.ARRAY, items: { type: Type.STRING } },
    stressManagementScore: { type: Type.NUMBER },
    communicationScore: { type: Type.NUMBER },
    problemSolvingScore: { type: Type.NUMBER },
    recommendation: { type: Type.STRING, enum: ['HIRE', 'CONSIDER', 'NO_HIRE'] },
    suitabilityScore: { type: Type.NUMBER },
    recommendationReasoning: { type: Type.STRING },
  },
  required: [
    "summary", "strengths", "areasForImprovement", "stressManagementScore", "communicationScore", "problemSolvingScore",
    "recommendation", "suitabilityScore", "recommendationReasoning"
  ]
};

// --- API Endpoints ---

const getConfigError = () => ({
    error: "Configuration Error: The 'API_KEY' environment variable is missing on the server. Please check your hosting environment settings and ensure a variable named 'API_KEY' is set with your valid Gemini API key."
});

// Generic handler to wrap Gemini calls that expect a JSON response
async function handleApiCall(res, modelCall) {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        return res.status(500).json(getConfigError());
    }
    const ai = new GoogleGenAI({ apiKey });

    try {
        const response = await modelCall(ai);
        let text = response.text.trim();
        
        // Handle cases where the model wraps the JSON in ```json ... ```
        if (text.startsWith("```json")) {
            text = text.substring(7, text.length - 3).trim();
        } else if (text.startsWith("```")) {
            text = text.substring(3, text.length - 3).trim();
        }
        
        if (!text) {
             throw new Error("AI service returned an empty response.");
        }
        
        res.json(JSON.parse(text));
    } catch (error) {
        console.error("Gemini API call failed or response parsing failed:", error);
        res.status(500).json({ error: "An error occurred while communicating with the AI service. The response may not have been valid JSON." });
    }
}

// Generic handler for Gemini calls that expect a plain text response
async function handleTextApiCall(res, modelCall) {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        return res.status(500).json(getConfigError());
    }
    const ai = new GoogleGenAI({ apiKey });

    try {
        const response = await modelCall(ai);
        res.json({ text: response.text.trim() });
    } catch (error) {
        console.error("Gemini API call failed:", error);
        res.status(500).json({ error: "An error occurred while communicating with the AI service." });
    }
}


app.post('/api/generate-tasks', async (req, res) => {
    const { jobTitle, jobDescription } = req.body;
    const prompt = `Based on the following job role, generate 5 realistic and distinct tasks that a candidate would perform during a work simulation. The tasks should test a range of skills. Critically, you MUST include a variety of task types. The available types are 'TEXT', 'IMAGE', 'AUDIO', and 'VIDEO'.
- A 'TEXT' task requires a written response.
- An 'IMAGE' task requires the candidate to upload a picture (e.g., a design mockup, a screenshot).
- An 'AUDIO' task requires an audio file upload (e.g., a recorded voice memo summary).
- A 'VIDEO' task requires a video file upload (e.g., a short screen recording or presentation).
Make the task descriptions clearly state what kind of submission is expected.

Job Title: ${jobTitle}
Job Description: ${jobDescription}

Return the tasks as a JSON array of objects. Each object must have a "title", a "description", and a "type" ('TEXT', 'IMAGE', 'AUDIO', or 'VIDEO').`;
    
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        return res.status(500).json(getConfigError());
    }
    const ai = new GoogleGenAI({ apiKey });

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: { 
                responseMimeType: "application/json", 
                responseSchema: tasksSchemaWithoutId,
                thinkingConfig: { thinkingBudget: 0 },
            },
        });
        
        let text = response.text.trim();
        if (text.startsWith("```json")) {
            text = text.substring(7, text.length - 3).trim();
        } else if (text.startsWith("```")) {
            text = text.substring(3, text.length - 3).trim();
        }

        if (!text) {
             throw new Error("AI service returned an empty response.");
        }

        const tasks = JSON.parse(text);
        const tasksWithIds = tasks.map((task, index) => ({
            ...task,
            id: `task-${Date.now()}-${index}`
        }));
        res.json(tasksWithIds);
    } catch (error) {
        console.error("Gemini API call failed in /api/generate-tasks:", error);
        res.status(500).json({ error: "An error occurred while communicating with the AI service." });
    }
});

app.post('/api/modify-tasks', async (req, res) => {
    const { jobTitle, jobDescription, currentTasks, modification } = req.body;
    const prompt = `You are an assistant helping a recruiter refine a work simulation.\n\nJob Title: ${jobTitle}\nJob Description: ${jobDescription}\n\nHere is the current list of tasks for the simulation:\n${JSON.stringify(currentTasks, null, 2)}\n\nThe recruiter has requested the following modification: "${modification}"\n\nPlease generate and return a new, complete list of tasks that incorporates this change. Maintain the JSON array format, where each task object has a "title", "description", and a "type" ('TEXT', 'IMAGE', 'AUDIO', or 'VIDEO'). Make the description clearly state the expected submission type.`;

    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        return res.status(500).json(getConfigError());
    }
    const ai = new GoogleGenAI({ apiKey });

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: { 
                responseMimeType: "application/json", 
                responseSchema: tasksSchemaWithoutId,
                thinkingConfig: { thinkingBudget: 0 },
            },
        });
        
        let text = response.text.trim();
        if (text.startsWith("```json")) {
            text = text.substring(7, text.length - 3).trim();
        } else if (text.startsWith("```")) {
            text = text.substring(3, text.length - 3).trim();
        }

        if (!text) {
             throw new Error("AI service returned an empty response.");
        }

        const tasks = JSON.parse(text);
        const tasksWithIds = tasks.map((task, index) => ({
            ...task,
            id: `task-${Date.now()}-${index}`
        }));
        res.json(tasksWithIds);
    } catch (error) {
        console.error("Gemini API call failed in /api/modify-tasks:", error);
        res.status(500).json({ error: "An error occurred while communicating with the AI service." });
    }
});

app.post('/api/regenerate-single-task', async (req, res) => {
    const { jobTitle, jobDescription, allTasks, taskToChange, instruction } = req.body;
    const otherTasks = allTasks.filter(t => t.id !== taskToChange.id);
    const prompt = `You are an assistant helping a recruiter refine a single task within a work simulation.\n\nJob Title: ${jobTitle}\nJob Description: ${jobDescription}\n\nHere is the full list of existing tasks, for context, to avoid creating a duplicate:\n${JSON.stringify(otherTasks, null, 2)}\n\nHere is the specific task to be changed:\n${JSON.stringify(taskToChange, null, 2)}\n\nThe recruiter's instruction for this task is: "${instruction}"\n\nPlease generate ONLY the single, updated task based on this instruction. Do not return the whole list. Return a single JSON object with "title", "description", and "type" ('TEXT', 'IMAGE', 'AUDIO', or 'VIDEO'). Make the description clear about what to submit.`;

    await handleApiCall(res, (genAI) => genAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: { 
            responseMimeType: "application/json", 
            responseSchema: singleTaskSchema,
            thinkingConfig: { thinkingBudget: 0 },
        },
    }));
});

app.post('/api/generate-single-task', async (req, res) => {
    const { jobTitle, jobDescription, existingTasks } = req.body;
    const prompt = `You are an assistant helping a recruiter create a work simulation.\n\nJob Title: ${jobTitle}\nJob Description: ${jobDescription}\n\nHere is the list of existing tasks. Please generate ONE new, distinct task that is not a repeat of the ones below:\n${JSON.stringify(existingTasks, null, 2)}\n\nReturn a single JSON object for the new task with "title", "description", and a "type" ('TEXT', 'IMAGE', 'AUDIO', or 'VIDEO'). The description must clearly explain the expected submission type.`;

    await handleApiCall(res, (genAI) => genAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: { 
            responseMimeType: "application/json", 
            responseSchema: singleTaskSchema,
            thinkingConfig: { thinkingBudget: 0 },
        },
    }));
});

app.post('/api/group-tasks', async (req, res) => {
    const { tasks } = req.body;
    const prompt = `You are an expert hiring manager tasked with organizing a job simulation. Analyze the following list of tasks. Group them into logical categories based on the primary skill each task evaluates (e.g., "Client Communication & Follow-up", "Data Analysis & Reporting", "Strategic Planning").

For each group, provide a concise, descriptive title. Every task from the input list must be placed into exactly one group.

Return the result as a JSON array of group objects. Each object must have:
1. A "title" property (string) for the group name.
2. A "tasks" property (array) containing the full original task objects that belong to that group.

Existing Tasks:
${JSON.stringify(tasks, null, 2)}`;

    await handleApiCall(res, (genAI) => genAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: { responseMimeType: "application/json", responseSchema: groupsSchema },
    }));
});

app.post('/api/suggest-criteria', async (req, res) => {
    const { taskTitle, taskDescription } = req.body;
    const prompt = `You are an expert hiring manager. For a simulation task titled "${taskTitle}" with the description "${taskDescription}", suggest a concise, bullet-pointed list of evaluation criteria. This criteria will be used by an AI to score a candidate's response. Focus on 2-4 measurable outcomes. Start each point with a hyphen.`;

    await handleTextApiCall(res, (genAI) => genAI.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt }));
});


app.post('/api/analyze-performance', async (req, res) => {
    const { simulation, work, behavioralData } = req.body;
    const allTasks = simulation.tasks || [];

    const submittedTasksContent = allTasks
        .filter(task => work.taskAnswers && work.taskAnswers[task.id] !== undefined)
        .map(task => {
            const answer = work.taskAnswers[task.id];
            let answerContent = '';
            switch (answer.type) {
                case 'TEXT':
                    answerContent = `CANDIDATE'S SUBMITTED ANSWER (Text):\n"""\n${answer.content}\n"""`;
                    break;
                case 'IMAGE':
                case 'AUDIO':
                case 'VIDEO':
                    answerContent = `CANDIDATE'S SUBMISSION (${answer.type}):\nFile Name: ${answer.fileName}\nFile Type: ${answer.fileType}\n(NOTE: You cannot see the file contents. Evaluate based on the assumption that an appropriate file was uploaded as requested.)`;
                    break;
                default:
                    answerContent = 'Unknown submission type.';
            }
            return `
---
TASK: "${task.title}"
DESCRIPTION: ${task.description}
EXPECTED SUBMISSION TYPE: ${task.type}
EVALUATION CRITERIA: ${task.evaluationCriteria || 'Evaluate based on clarity, accuracy, and relevance to the task.'}
${answerContent}
---
`}).join('\n');

    const prompt = `You are an expert hiring manager analyzing a candidate's performance in a work simulation for the role of "${simulation.jobTitle}".

**CANDIDATE'S SUBMITTED WORK**
The candidate has provided the following submissions for their assigned tasks. Submissions can be text or file uploads (image, audio, video). For file uploads, you will only see the file name and type. You must assume the candidate uploaded a file relevant to the task and evaluate their performance based on the task description and the act of submission itself.

${submittedTasksContent.length > 0 ? submittedTasksContent : "The candidate did not submit answers for any tasks."}

**ADDITIONAL CONTEXT**
The following data should be used to evaluate broader skills like communication and adaptability:
- **AI Assistant Chat Log:** ${JSON.stringify(work.chatLogs)}
- **Client Call Transcript:** """${work.callTranscript}"""

**BEHAVIORAL DATA**
- **Time Taken:** ${behavioralData.timeTakenSeconds} seconds
- **Total Time Allotted:** ${behavioralData.totalDurationSeconds} seconds
- **Submission Type:** ${behavioralData.submissionReason === 'auto' ? 'Session automatically submitted due to timeout.' : 'Candidate submitted manually.'}

**EVALUATION INSTRUCTIONS**
1.  **Task-Specific Analysis:** For each submitted task, evaluate the candidate's work.
    - For 'TEXT' submissions, use the provided 'EVALUATION CRITERIA' to score the written answer.
    - For 'IMAGE', 'AUDIO', or 'VIDEO' submissions, acknowledge that a file was submitted. Evaluate based on whether this action fulfills the task requirements described in the 'DESCRIPTION'. Assume the file content is appropriate unless there's a clear mismatch in file type. The core of this analysis is whether they followed the instructions to provide the correct *type* of deliverable.
2.  **Communication Skills:** Analyze the chat logs and call transcript for clarity, professionalism, and tone.
3.  **Stress Management:** Analyze the call transcript to see how the candidate handled an unexpected, potentially stressful client interaction.
4.  **Synthesize and Score:** Combine your findings into a holistic report. Provide specific examples in the "Strengths" and "Areas for Improvement" sections. All scores must be an integer out of 10.
5.  **FINAL RECOMMENDATION:** Based on ALL available data (work quality, communication, and behavioral data), provide a final hiring recommendation.
    - The 'Submission Type' provides important context. An 'auto' submission means the candidate ran out of time, which should be considered when evaluating their time management skills. A 'manual' submission means they finished within the time limit. This is not a red flag but a data point.
    - The \`suitabilityScore\` must be an integer from 1 to 10.
    - The \`recommendation\` must be one of 'HIRE', 'CONSIDER', or 'NO_HIRE'.
    - The \`recommendationReasoning\` should be a concise, 1-2 sentence explanation for your final verdict.

Provide the final report as a JSON object with the specified structure.`;

    await handleApiCall(res, (genAI) => genAI.models.generateContent({
        model: "gemini-2.5-pro",
        contents: prompt,
        config: { responseMimeType: "application/json", responseSchema: analysisSchema },
    }));
});


app.post('/api/chat-response', async (req, res) => {
    const { simulation, chatHistory } = req.body;
    const historyString = chatHistory.map(entry => `${entry.author === 'Candidate' ? 'User' : 'Assistant'}: ${entry.message}`).join('\n');
    const prompt = `You are a helpful AI assistant in a work simulation, acting as a senior colleague.\nThe candidate is performing a simulation for the role of: ${simulation.jobTitle}.\n\nTheir assigned tasks are:\n${simulation.tasks.map(t => `- ${t.title}: ${t.description}`).join('\n')}\n\nBelow is the conversation history. The last message is from the candidate.\n${historyString}\n\nYour role is to provide concise, helpful guidance. Do not give away the answers to the tasks directly. Instead, prompt the candidate to think critically. Keep your responses brief and professional.`;

    await handleTextApiCall(res, (genAI) => genAI.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt }));
});

app.post('/api/client-call-response', async (req, res) => {
    const { jobTitle, chatHistory } = req.body;
    const historyString = chatHistory.map(entry => `${entry.author === 'You' ? 'User' : 'Client'}: ${entry.text}`).join('\n');
    const systemInstruction = `You are a client calling an employee (${jobTitle}) with an urgent, slightly vague, and stressful problem. Be professional but firm. The goal is to test the employee's communication and problem-solving skills under pressure. The first message from the user is them answering your call.`;
    const prompt = `${systemInstruction}\n\nConversation history:\n${historyString}\n\nClient's turn to speak:`;

    await handleTextApiCall(res, (genAI) => genAI.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt }));
});

app.post('/api/support-chat-response', async (req, res) => {
    const { chatHistory } = req.body;
    
    const processedHistory = [...chatHistory];
    if (processedHistory.length > 0 && processedHistory[0].author === 'bot') {
        processedHistory.shift(); 
    }

    if (processedHistory.length === 0) {
        return res.json({ text: "I'm ready to help. What's your question?" });
    }

    const contents = processedHistory.map(entry => ({
        role: entry.author === 'user' ? 'user' : 'model',
        parts: [{ text: entry.message }],
    }));
    
    const systemInstruction = `You are a friendly and helpful support assistant for an application called SimuHire. SimuHire is an AI-powered workday simulation platform for hiring. 
    - Recruiters use it to create realistic job simulations to test candidates.
    - Candidates complete these simulations to showcase their skills.
    - Key features include AI task generation, a simulated workspace with tools (chat, email, editor, sheets), and AI-powered performance analysis.
    - Upcoming features include webcam proctoring and a secure desktop lockdown.
    
    Your primary role is to answer user questions about the application's features, how to use it, and general advice on hiring best practices.
    
    IMPORTANT RULE: If a user asks a question that seems like they are a candidate trying to get help or answers for their simulation tasks, you MUST NOT provide a direct answer. Instead, you should gently decline and remind them that the simulation is meant to assess their own skills. For example, you can say: "I can't help with specific answers for your simulation tasks, as that would defeat the purpose of the assessment. However, I can help you understand how to use the tools in the workspace!"`;

    await handleTextApiCall(res, (genAI) => genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: contents, // Use the processed, valid conversation history
        config: {
            systemInstruction,
        },
    }));
});


// --- Serve Frontend ---
// This catch-all route should be last.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`SimuHire server listening on http://localhost:${port}`);
});