import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import cron from 'node-cron';
import nodemailer from 'nodemailer';

const app = express();
const port = process.env.PORT || 8080;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_FILE = path.join(__dirname, 'data.json');

// --- Data Persistence ---
let appData = {
    simulations: {},
    reports: {},
    templates: {}
};

function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            appData = JSON.parse(data);
        }
    } catch (err) {
        console.error("Failed to load data:", err);
    }
}

function saveData() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(appData, null, 2));
    } catch (err) {
        console.error("Failed to save data:", err);
    }
}

loadData();

// --- Email Notification Logic ---
async function sendDailyReport() {
    const recipient = "kakumanu.ft262002@gmail.com";
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (!smtpHost || !smtpUser || !smtpPass) {
        console.warn("SMTP configuration missing. Skipping daily report email.");
        return;
    }

    const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort || '587'),
        secure: smtpPort === '465',
        auth: {
            user: smtpUser,
            pass: smtpPass,
        },
    });

    // Group reports by simulation ID
    const reportSummary = {};
    Object.values(appData.reports).forEach(report => {
        if (!reportSummary[report.simulationId]) {
            reportSummary[report.simulationId] = [];
        }
        reportSummary[report.simulationId].push(report);
    });

    let emailHtml = `
        <h1 style="color: #2563eb;">SimuHire Periodic Report</h1>
        <p>Generated on: ${new Date().toLocaleString()}</p>
    `;

    if (Object.keys(reportSummary).length === 0) {
        emailHtml += "<p>No simulations have been completed yet.</p>";
    } else {
        for (const [simId, reports] of Object.entries(reportSummary)) {
            const sim = appData.simulations[simId];
            emailHtml += `
                <div style="margin-bottom: 30px; border: 1px solid #e2e8f0; padding: 20px; border-radius: 8px;">
                    <h2 style="color: #1e293b; margin-top: 0;">Simulation: ${sim ? sim.jobTitle : simId}</h2>
                    <p><strong>ID:</strong> ${simId}</p>
                    <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                        <thead>
                            <tr style="background-color: #f8fafc;">
                                <th style="border: 1px solid #e2e8f0; padding: 8px; text-align: left;">Candidate Name</th>
                                <th style="border: 1px solid #e2e8f0; padding: 8px; text-align: left;">Email</th>
                                <th style="border: 1px solid #e2e8f0; padding: 8px; text-align: left;">Suitability Score</th>
                                <th style="border: 1px solid #e2e8f0; padding: 8px; text-align: left;">Recommendation</th>
                                <th style="border: 1px solid #e2e8f0; padding: 8px; text-align: left;">Completed At</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            reports.forEach(report => {
                emailHtml += `
                    <tr>
                        <td style="border: 1px solid #e2e8f0; padding: 8px;">${report.candidateName}</td>
                        <td style="border: 1px solid #e2e8f0; padding: 8px;">${report.candidateEmail}</td>
                        <td style="border: 1px solid #e2e8f0; padding: 8px;">${report.suitabilityScore}/10</td>
                        <td style="border: 1px solid #e2e8f0; padding: 8px;">${report.recommendation}</td>
                        <td style="border: 1px solid #e2e8f0; padding: 8px;">${new Date(report.completedAt).toLocaleString()}</td>
                    </tr>
                `;
            });

            emailHtml += `
                        </tbody>
                    </table>
                </div>
            `;
        }
    }

    try {
        await transporter.sendMail({
            from: `"SimuHire System" <${smtpUser}>`,
            to: recipient,
            subject: `SimuHire Periodic Report - ${new Date().toLocaleString()}`,
            html: emailHtml,
        });
        console.log("Periodic report email sent successfully to", recipient);
    } catch (err) {
        console.error("Failed to send periodic report email:", err);
    }
}

// Schedule the task for every 10 minutes
// Cron format: minute hour day-of-month month day-of-week
cron.schedule('*/10 * * * *', () => {
    console.log("Running scheduled periodic report task...");
    sendDailyReport();
});

// --- Middleware ---
app.use(express.json({ limit: '50mb' })); // Increase limit for file uploads

// Vite middleware for development
if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
    });
    app.use(vite.middlewares);
} else {
    app.use(express.static(path.join(__dirname, 'dist')));
}

// --- Schemas for JSON responses ---
const assetSchema = {
  type: Type.OBJECT,
  properties: {
    type: { type: Type.STRING, enum: ['infographic', 'email_thread', 'spreadsheet_data', 'document'] },
    title: { type: Type.STRING },
    content: { type: Type.STRING },
  },
  required: ['type', 'content'],
};

const taskSchema = {
  type: Type.OBJECT,
  properties: {
      id: { type: Type.STRING },
      title: { type: Type.STRING },
      description: { type: Type.STRING },
      asset: assetSchema,
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
        asset: assetSchema,
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
    asset: assetSchema,
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

app.get('/api/data', (req, res) => {
    res.json(appData);
});

app.post('/api/simulations', (req, res) => {
    const simulation = req.body;
    if (!simulation || !simulation.id) {
        return res.status(400).json({ error: "Invalid simulation data" });
    }
    appData.simulations[simulation.id] = simulation;
    saveData();
    res.json({ success: true });
});

app.post('/api/reports', (req, res) => {
    const { key, report } = req.body;
    if (!key || !report) {
        return res.status(400).json({ error: "Invalid report data" });
    }
    appData.reports[key] = report;
    saveData();
    res.json({ success: true });
});

app.post('/api/templates', (req, res) => {
    const template = req.body;
    if (!template || !template.id) {
        return res.status(400).json({ error: "Invalid template data" });
    }
    appData.templates[template.id] = template;
    saveData();
    res.json({ success: true });
});

app.delete('/api/templates/:id', (req, res) => {
    const { id } = req.params;
    if (appData.templates[id]) {
        delete appData.templates[id];
        saveData();
        res.json({ success: true });
    } else {
        res.status(404).json({ error: "Template not found" });
    }
});

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

Return the tasks as a JSON array of objects. Each object must have a "title", a "description", and a "type" ('TEXT', 'IMAGE', 'AUDIO', or 'VIDEO').

**CRITICAL REQUIREMENT:** If a task requires the candidate to analyze an external document (like an infographic, email, dataset, or memo), you **MUST** create and embed that document's content directly within the task object under an \`asset\` field. The \`asset\` object must have:
1. \`type\`: one of 'infographic', 'email_thread', 'spreadsheet_data', 'document'.
2. \`title\`: a short title for the asset (e.g., "Q3 Marketing Report").
3. \`content\`: a detailed, text-based representation of the asset. For an infographic, describe its key data points. For an email, write out the full email. For spreadsheet data, use markdown table format.

Job Title: ${jobTitle}
Job Description: ${jobDescription}`;
    
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
    const prompt = `You are an assistant helping a recruiter refine a work simulation.\n\nJob Title: ${jobTitle}\nJob Description: ${jobDescription}\n\nHere is the current list of tasks for the simulation:\n${JSON.stringify(currentTasks, null, 2)}\n\nThe recruiter has requested the following modification: "${modification}"\n\nPlease generate and return a new, complete list of tasks that incorporates this change. Maintain the JSON array format, where each task object has a "title", "description", and a "type" ('TEXT', 'IMAGE', 'AUDIO', or 'VIDEO'). Make the description clearly state the expected submission type. If a task requires an asset (like an email or document), you MUST include it in an 'asset' object as per the schema.`;

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
    const prompt = `You are an assistant helping a recruiter refine a single task within a work simulation.\n\nJob Title: ${jobTitle}\nJob Description: ${jobDescription}\n\nHere is the full list of existing tasks, for context, to avoid creating a duplicate:\n${JSON.stringify(otherTasks, null, 2)}\n\nHere is the specific task to be changed:\n${JSON.stringify(taskToChange, null, 2)}\n\nThe recruiter's instruction for this task is: "${instruction}"\n\nPlease generate ONLY the single, updated task based on this instruction. If the updated task requires an asset (like an email or document), include it in an 'asset' object. Return a single JSON object with "title", "description", and "type" ('TEXT', 'IMAGE', 'AUDIO', or 'VIDEO'). Make the description clear about what to submit.`;

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
    const prompt = `You are an assistant helping a recruiter create a work simulation.\n\nJob Title: ${jobTitle}\nJob Description: ${jobDescription}\n\nHere is the list of existing tasks. Please generate ONE new, distinct task that is not a repeat of the ones below:\n${JSON.stringify(existingTasks, null, 2)}\n\nReturn a single JSON object for the new task with "title", "description", and a "type" ('TEXT', 'IMAGE', 'AUDIO', or 'VIDEO'). The description must clearly explain the expected submission type. If the new task requires an asset (like an email or document), you MUST include it in an 'asset' object.`;

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
${task.asset ? `PROVIDED ASSET ("${task.asset.title || 'Context'}"):\n"""\n${task.asset.content}\n"""` : ''}
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

**BEHAVIORAL DATA & EVENT LOG**
- **Time Taken:** ${behavioralData.timeTakenSeconds} seconds
- **Total Time Allotted:** ${behavioralData.totalDurationSeconds} seconds
- **Submission Type:** ${behavioralData.submissionReason === 'auto' ? 'Session automatically submitted due to timeout.' : 'Candidate submitted manually.'}
- **Event Log:** A log of the candidate's actions is provided below. Use this to analyze their behavior.
  ${JSON.stringify(work.eventLog || [])}

**EVALUATION INSTRUCTIONS**
1.  **Task-Specific Analysis:** For each submitted task, evaluate the candidate's work.
    - For 'TEXT' submissions, use the provided 'EVALUATION CRITERIA' to score the written answer.
    - For 'IMAGE', 'AUDIO', or 'VIDEO' submissions, acknowledge that a file was submitted. Evaluate based on whether this action fulfills the task requirements described in the 'DESCRIPTION'. Assume the file content is appropriate unless there's a clear mismatch in file type. The core of this analysis is whether they followed the instructions to provide the correct *type* of deliverable.
2.  **Behavioral Analysis from Event Log**:
    - Analyze the timestamps to understand the candidate's pacing, time management, and how long they spent on each task (time between 'TASK_ANSWER_CHANGE' events for a taskId).
    - Analyze the frequency and timing of 'CHAT_MESSAGE_SENT' events to gauge their help-seeking behavior and independence.
    - A high number of 'TASK_ANSWER_CHANGE' events for a single task might indicate uncertainty or perfectionism.
3.  **Communication & Stress Management:** Analyze the chat logs and call transcript for clarity, professionalism, and tone. Correlate events with the client call ('CLIENT_CALL_START'/'CLIENT_CALL_END') to assess performance under pressure.
4.  **Synthesize and Score:** Combine all your findings into a holistic report. Provide specific examples in the "Strengths" and "Areas for Improvement" sections, referencing both submitted work and behaviors from the event log. All scores must be an integer out of 10.
5.  **FINAL RECOMMENDATION:** Based on ALL available data (work quality, communication, and behavioral data), provide a final hiring recommendation.
    - The 'Submission Type' provides important context. An 'auto' submission means the candidate ran out of time, which should be considered when evaluating their time management skills.
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