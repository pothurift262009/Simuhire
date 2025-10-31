
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
  // Maps task ID to the submitted answer. Only submitted tasks are included.
  taskAnswers: Record<string, string>;
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
