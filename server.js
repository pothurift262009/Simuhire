import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/generative-ai';

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Middleware ---
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

// --- Gemini Setup ---
const geminiApiKey = process.env.GEMINI_API_KEY;
if (!geminiApiKey) {
    console.error("FATAL ERROR: GEMINI_API_KEY environment variable is not set.");
}
// IMPORTANT: The @google/generative-ai package is used on the server.
const ai = new GoogleGenAI({ apiKey: geminiApiKey });

// --- Schemas for JSON responses (moved from frontend) ---
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

// Generic handler to wrap Gemini calls
async function handleApiCall(res, logic) {
    if (!geminiApiKey) {
        return res.status(500).json({ error: "Server is not configured with a Gemini API key." });
    }
    try {
        const result = await logic();
        // The Gemini SDK returns a 'text' property which is a stringified JSON
        res.json(JSON.parse(result));
    } catch (error) {
        console.error("Gemini API call failed:", error);
        res.status(500).json({ error: "An error occurred while communicating with the AI service." });
    }
}

app.post('/api/generate-tasks', async (req, res) => {
    const { jobTitle, jobDescription } = req.body;
    const prompt = `Based on the following job role, generate 5 realistic and distinct tasks that a candidate would perform during a 1-hour work simulation. The tasks should test a range of skills relevant to the role.\n\nJob Title: ${jobTitle}\nJob Description: ${jobDescription}\n\nReturn the tasks as a JSON array.`;
    
    await handleApiCall(res, async () => {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: { responseMimeType: "application/json", responseSchema: taskSchema },
        });
        return response.text;
    });
});

app.post('/api/modify-tasks', async (req, res) => {
    const { jobTitle, jobDescription, currentTasks, modification } = req.body;
    const prompt = `You are an assistant helping a recruiter refine a work simulation.\n\nJob Title: ${jobTitle}\nJob Description: ${jobDescription}\n\nHere is the current list of tasks for the simulation:\n${JSON.stringify(currentTasks, null, 2)}\n\nThe recruiter has requested the following modification: "${modification}"\n\nPlease generate and return a new, complete list of tasks that incorporates this change. Maintain the same JSON format.`;

    await handleApiCall(res, async () => {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: { responseMimeType: "application/json", responseSchema: taskSchema },
        });
        return response.text;
    });
});

app.post('/api/regenerate-single-task', async (req, res) => {
    const { jobTitle, jobDescription, allTasks, taskToChange, instruction } = req.body;
    const otherTasks = allTasks.filter(t => t.id !== taskToChange.id);
    const prompt = `You are an assistant helping a recruiter refine a single task within a work simulation.\n\nJob Title: ${jobTitle}\nJob Description: ${jobDescription}\n\nHere is the full list of existing tasks, for context, to avoid creating a duplicate:\n${JSON.stringify(otherTasks, null, 2)}\n\nHere is the specific task to be changed:\n${JSON.stringify(taskToChange, null, 2)}\n\nThe recruiter's instruction for this task is: "${instruction}"\n\nPlease generate ONLY the single, updated task based on this instruction. Do not return the whole list. Return a single JSON object with "title" and "description".`;

    await handleApiCall(res, async () => {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: { responseMimeType: "application/json", responseSchema: singleTaskSchema },
        });
        return response.text;
    });
});

app.post('/api/generate-single-task', async (req, res) => {
    const { jobTitle, jobDescription, existingTasks } = req.body;
    const prompt = `You are an assistant helping a recruiter create a work simulation.\n\nJob Title: ${jobTitle}\nJob Description: ${jobDescription}\n\nHere is the list of existing tasks. Please generate ONE new, distinct task that is not a repeat of the ones below:\n${JSON.stringify(existingTasks, null, 2)}\n\nReturn a single JSON object for the new task with "title" and "description".`;

    await handleApiCall(res, async () => {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: { responseMimeType: "application/json", responseSchema: singleTaskSchema },
        });
        return response.text;
    });
});

app.post('/api/analyze-performance', async (req, res) => {
    const { simulation, work } = req.body;
    const prompt = `Analyze the following candidate's work from a 1-hour job simulation for the role of a ${simulation.jobTitle}.\nJob Description: ${simulation.jobDescription}\n\nCandidate's Work:\n- Chat Logs: ${JSON.stringify(work.chatLogs)}\n- Text Editor Content: """${work.editorContent}"""\n- Email Draft: To: ${work.emailContent.to}, Subject: ${work.emailContent.subject}, Body: """${work.emailContent.body}"""\n- Sheet Data: ${JSON.stringify(work.sheetContent)}\n- Client Call Transcript: """${work.callTranscript}"""\n\nEvaluate the candidate's performance based on:\n1. Problem-Solving: Assess their approach to tasks, logical reasoning, and quality of work in the editor, sheet, and email.\n2. Communication: Evaluate the clarity, professionalism, and tone in their written (email, chat) and verbal (call transcript) communications.\n3. Stress Management & Adaptability: Analyze how they handled the unexpected client call. Look for signs of panic, professionalism under pressure, and their ability to switch context.\n\nProvide a detailed performance report. Return a JSON object with the specified structure. Scores should be out of 10.`;

    await handleApiCall(res, async () => {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: prompt,
            config: { responseMimeType: "application/json", responseSchema: analysisSchema },
        });
        return response.text;
    });
});

// Text-only API call (doesn't need JSON parsing)
async function handleTextApiCall(res, logic) {
    if (!geminiApiKey) {
        return res.status(500).json({ error: "Server is not configured with a Gemini API key." });
    }
    try {
        const result = await logic();
        res.json({ text: result });
    } catch (error) {
        console.error("Gemini API call failed:", error);
        res.status(500).json({ error: "An error occurred while communicating with the AI service." });
    }
}

app.post('/api/chat-response', async (req, res) => {
    const { simulation, chatHistory } = req.body;
    const historyString = chatHistory.map(entry => `${entry.author === 'Candidate' ? 'User' : 'Assistant'}: ${entry.message}`).join('\n');
    const prompt = `You are a helpful AI assistant in a work simulation, acting as a senior colleague.\nThe candidate is performing a simulation for the role of: ${simulation.jobTitle}.\n\nTheir assigned tasks are:\n${simulation.tasks.map(t => `- ${t.title}: ${t.description}`).join('\n')}\n\nBelow is the conversation history. The last message is from the candidate.\n${historyString}\n\nYour role is to provide concise, helpful guidance. Do not give away the answers to the tasks directly. Instead, prompt the candidate to think critically. Keep your responses brief and professional.`;

    await handleTextApiCall(res, async () => {
        const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
        return response.text.trim();
    });
});

app.post('/api/client-call-response', async (req, res) => {
    const { jobTitle, chatHistory } = req.body;
    const historyString = chatHistory.map(entry => `${entry.author === 'You' ? 'User' : 'Client'}: ${entry.text}`).join('\n');
    const systemInstruction = `You are a client calling an employee (${jobTitle}) with an urgent, slightly vague, and stressful problem. Be professional but firm. The goal is to test the employee's communication and problem-solving skills under pressure. The first message from the user is them answering your call.`;
    const prompt = `${systemInstruction}\n\nConversation history:\n${historyString}\n\nClient's turn to speak:`;

    await handleTextApiCall(res, async () => {
        const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
        return response.text.trim();
    });
});


// --- Serve Frontend ---
// This catch-all route should be last.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`SimuHire server listening on http://localhost:${port}`);
});
