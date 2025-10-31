
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

export interface Task {
  id: string;
  title: string;
  description: string;
}

export interface TaskGroup {
  id: string;
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

export interface CandidateWork {
  chatLogs: { author: 'Candidate' | 'AI'; message: string }[];
  editorContent: string;
  sheetContent: string[][];
  emailContent: { to: string; subject: string; body: string };
  callTranscript: string;
  completedTaskIds: string[];
}

export interface PerformanceReport {
  summary: string;
  strengths: string[];
  areasForImprovement: string[];
  stressManagementScore: number;
  communicationScore: number;
  problemSolvingScore: number;
  simulationId: string;
  candidateEmail: string;
  candidateName: string;
  timeTakenSeconds: number;
  totalDurationSeconds: number;
  completedAt: string;
}

export interface User {
  name: string;
  email: string;
  role: Role;
}