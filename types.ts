export enum Role {
  RECRUITER = 'recruiter',
  CANDIDATE = 'candidate',
}

export enum Page {
  HOME,
  AUTH,
  RECRUITER_DASHBOARD,
  CANDIDATE_START,
  CANDIDATE_WORKSPACE,
  PERFORMANCE_REPORT,
}

export enum Tool {
  CHAT = 'Chat',
  EDITOR = 'Text Editor',
  SHEET = 'Sheet',
  EMAIL = 'Email Composer',
}

export enum TaskType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  AUDIO = 'AUDIO',
  VIDEO = 'VIDEO',
}

export interface Task {
  id: string;
  title: string;
  description: string;
  asset?: {
    type: 'infographic' | 'email_thread' | 'spreadsheet_data' | 'document';
    content: string;
    title?: string;
  };
  evaluationCriteria?: string;
  type: TaskType;
}

export interface TaskGroup {
  id:string;
  title: string;
  tasks: Task[];
}

export interface Simulation {
  id:string;
  jobTitle: string;
  jobDescription: string;
  tasks: Task[];
  availableTools: Tool[];
  clientCallEnabled: boolean;
  durationMinutes: number;
  clientCallTimeRange?: { min: number; max: number };
  recruiterEmail: string;
  createdAt: string;
}

export interface SimulationTemplate {
  id: string;
  name: string;
  description: string;
  tasks: Task[];
  durationMinutes: number;
  clientCallEnabled: boolean;
  clientCallTimeRange?: { min: number; max: number };
  createdAt: string;
}

export interface TaskAnswer {
  type: TaskType;
  content: string; // Text answer or base64 data for files
  fileName?: string;
  fileType?: string;
}

export interface CandidateWork {
  // Maps task ID to the submitted answer. Only submitted tasks are included.
  taskAnswers: Record<string, TaskAnswer>;
  chatLogs: { author: 'Candidate' | 'AI'; message: string }[];
  callTranscript: string;
}

export enum RecommendationVerdict {
  HIRE = 'HIRE',
  CONSIDER = 'CONSIDER',
  NO_HIRE = 'NO_HIRE',
}

export interface PerformanceReport {
  summary: string;
  strengths: string[];
  areasForImprovement: string[];
  stressManagementScore: number;
  communicationScore: number;
  problemSolvingScore: number;
  recommendation: RecommendationVerdict;
  suitabilityScore: number;
  recommendationReasoning: string;
  simulationId: string;
  candidateEmail: string;
  candidateName: string;
  timeTakenSeconds: number;
  totalDurationSeconds: number;
  completedAt: string;
  submissionReason: 'manual' | 'auto';
}

export interface User {
  name: string;
  email: string;
  role: Role;
}