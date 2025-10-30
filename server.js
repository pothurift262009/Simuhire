import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const app = express();
const port = process.env.PORT || 8080;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Middleware ---
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

// --- Schemas for JSON responses ---
const taskSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: { id: { type: Type.STRING }, title: { type: Type.STRING }, description: { type: Type.STRING } },
    required: ["id", "title", "description"],
  },
};
const singleTaskSchema = {
  type: Type.OBJECT,
  properties: { title: { type: Type.STRING }, description: { type: Type.STRING } },
  required: ["title", "description"],
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
  },
  required: ["summary", "strengths", "areasForImprovement", "stressManagementScore", "communicationScore", "problemSolvingScore"]
};

// --- API Endpoints ---

const getConfigError = () => ({
    error: "Configuration Error: The 'API_KEY' environment variable is missing on the server. Please go to your hosting provider's dashboard (e.g., Render), navigate to the 'Environment' settings for this service, and ensure a variable named 'API_KEY' is set with your valid Gemini API key."
});


// Generic handler to wrap Gemini calls that expect a JSON response
async function handleApiCall(res, modelCall) {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        console.error("FATAL: API_KEY environment variable not found or is empty.");
        console.error("Available environment variables on server:", Object.keys(process.env));
        return res.status(500).json(getConfigError());
    }
    try {
        const ai = new GoogleGenAI({ apiKey });
        const response = await modelCall(ai);
        // The Gemini SDK returns a 'text' property which is a stringified JSON
        res.json(JSON.parse(response.text));
    } catch (error) {
        console.error("Gemini API call failed:", error);
        res.status(500).json({ error: "An error occurred while communicating with the AI service." });
    }
}

// Generic handler for Gemini calls that expect a plain text response
async function handleTextApiCall(res, modelCall) {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        console.error("FATAL: API_KEY environment variable not found or is empty.");
        console.error("Available environment variables on server:", Object.keys(process.env));
        return res.status(500).json(getConfigError());
    }
    try {
        const ai = new GoogleGenAI({ apiKey });
        const response = await modelCall(ai);
        res.json({ text: response.text.trim() });
    } catch (error) {
        console.error("Gemini API call failed:", error);
        res.status(500).json({ error: "An error occurred while communicating with the AI service." });
    }
}


app.post('/api/generate-tasks', async (req, res) => {
    const { jobTitle, jobDescription } = req.body;
    const prompt = `Based on the following job role, generate 5 realistic and distinct tasks that a candidate would perform during a 1-hour work simulation. The tasks should test a range of skills relevant to the role.\n\nJob Title: ${jobTitle}\nJob Description: ${jobDescription}\n\nReturn the tasks as a JSON array. Each task must have a unique 'id' like 'task-1', 'task-2' etc.`;
    
    await handleApiCall(res, (ai) => ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: { responseMimeType: "application/json", responseSchema: taskSchema },
    }));
});

app.post('/api/modify-tasks', async (req, res) => {
    const { jobTitle, jobDescription, currentTasks, modification } = req.body;
    const prompt = `You are an assistant helping a recruiter refine a work simulation.\n\nJob Title: ${jobTitle}\nJob Description: ${jobDescription}\n\nHere is the current list of tasks for the simulation:\n${JSON.stringify(currentTasks, null, 2)}\n\nThe recruiter has requested the following modification: "${modification}"\n\nPlease generate and return a new, complete list of tasks that incorporates this change. Maintain the same JSON format, ensuring each task has a unique id.`;

    await handleApiCall(res, (ai) => ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: { responseMimeType: "application/json", responseSchema: taskSchema },
    }));
});

app.post('/api/regenerate-single-task', async (req, res) => {
    const { jobTitle, jobDescription, allTasks, taskToChange, instruction } = req.body;
    const otherTasks = allTasks.filter(t => t.id !== taskToChange.id);
    const prompt = `You are an assistant helping a recruiter refine a single task within a work simulation.\n\nJob Title: ${jobTitle}\nJob Description: ${jobDescription}\n\nHere is the full list of existing tasks, for context, to avoid creating a duplicate:\n${JSON.stringify(otherTasks, null, 2)}\n\nHere is the specific task to be changed:\n${JSON.stringify(taskToChange, null, 2)}\n\nThe recruiter's instruction for this task is: "${instruction}"\n\nPlease generate ONLY the single, updated task based on this instruction. Do not return the whole list. Return a single JSON object with "title" and "description".`;

    await handleApiCall(res, (ai) => ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: { responseMimeType: "application/json", responseSchema: singleTaskSchema },
    }));
});

app.post('/api/generate-single-task', async (req, res) => {
    const { jobTitle, jobDescription, existingTasks } = req.body;
    const prompt = `You are an assistant helping a recruiter create a work simulation.\n\nJob Title: ${jobTitle}\nJob Description: ${jobDescription}\n\nHere is the list of existing tasks. Please generate ONE new, distinct task that is not a repeat of the ones below:\n${JSON.stringify(existingTasks, null, 2)}\n\nReturn a single JSON object for the new task with "title" and "description".`;

    await handleApiCall(res, (ai) => ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: { responseMimeType: "application/json", responseSchema: singleTaskSchema },
    }));
});

app.post('/api/analyze-performance', async (req, res) => {
    const { simulation, work } = req.body;
    const prompt = `Analyze the following candidate's work from a 1-hour job simulation for the role of a ${simulation.jobTitle}.\nJob Description: ${simulation.jobDescription}\n\nCandidate's Work:\n- Chat Logs: ${JSON.stringify(work.chatLogs)}\n- Text Editor Content: """${work.editorContent}"""\n- Email Draft: To: ${work.emailContent.to}, Subject: ${work.emailContent.subject}, Body: """${work.emailContent.body}"""\n- Sheet Data: ${JSON.stringify(work.sheetContent)}\n- Client Call Transcript: """${work.callTranscript}"""\n\nEvaluate the candidate's performance based on:\n1. Problem-Solving: Assess their approach to tasks, logical reasoning, and quality of work in the editor, sheet, and email.\n2. Communication: Evaluate the clarity, professionalism, and tone in their written (email, chat) and verbal (call transcript) communications.\n3. Stress Management & Adaptability: Analyze how they handled the unexpected client call. Look for signs of panic, professionalism under pressure, and their ability to switch context.\n\nProvide a detailed performance report. Return a JSON object with the specified structure. Scores should be out of 10.`;

    await handleApiCall(res, (ai) => ai.models.generateContent({
        model: "gemini-2.5-pro",
        contents: prompt,
        config: { responseMimeType: "application/json", responseSchema: analysisSchema },
    }));
});


app.post('/api/chat-response', async (req, res) => {
    const { simulation, chatHistory } = req.body;
    const historyString = chatHistory.map(entry => `${entry.author === 'Candidate' ? 'User' : 'Assistant'}: ${entry.message}`).join('\n');
    const prompt = `You are a helpful AI assistant in a work simulation, acting as a senior colleague.\nThe candidate is performing a simulation for the role of: ${simulation.jobTitle}.\n\nTheir assigned tasks are:\n${simulation.tasks.map(t => `- ${t.title}: ${t.description}`).join('\n')}\n\nBelow is the conversation history. The last message is from the candidate.\n${historyString}\n\nYour role is to provide concise, helpful guidance. Do not give away the answers to the tasks directly. Instead, prompt the candidate to think critically. Keep your responses brief and professional.`;

    await handleTextApiCall(res, (ai) => ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt }));
});

app.post('/api/client-call-response', async (req, res) => {
    const { jobTitle, chatHistory } = req.body;
    const historyString = chatHistory.map(entry => `${entry.author === 'You' ? 'User' : 'Client'}: ${entry.text}`).join('\n');
    const systemInstruction = `You are a client calling an employee (${jobTitle}) with an urgent, slightly vague, and stressful problem. Be professional but firm. The goal is to test the employee's communication and problem-solving skills under pressure. The first message from the user is them answering your call.`;
    const prompt = `${systemInstruction}\n\nConversation history:\n${historyString}\n\nClient's turn to speak:`;

    await handleTextApiCall(res, (ai) => ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt }));
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

    await handleTextApiCall(res, (ai) => ai.models.generateContent({
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