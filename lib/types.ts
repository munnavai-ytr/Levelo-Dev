export interface ProjectFiles {
  'index.html': string;
  [key: string]: string;
}

export interface ProjectVersion {
  id: string;
  projectId: string;
  files: ProjectFiles;
  label: string;
  source: 'ai' | 'manual' | 'restore';
  prompt?: string;
  createdAt: any;
}

export interface GameProject {
  id: string;
  ownerId: string;
  title: string;
  files: ProjectFiles;
  chatMessages?: ChatMessage[];
  thumbnail?: string;
  createdAt: any;
  updatedAt: any;
}

export type DeviceMode = 'mobile' | 'tablet' | 'desktop';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  tags?: string[];
  status?: 'planning' | 'writing' | 'applying' | 'done' | 'error';
  errorType?: 'missing_key' | 'invalid_key' | 'rate_limit' | 'generic';
  appliedFiles?: string[];
}

export interface GeminiModelInfo {
  name: string;
  displayName: string;
  description?: string;
  supportedGenerationMethods?: string[];
}

export interface GameTemplate {
  id: string;
  name: string;
  description: string;
  tags: string[];
  genre: string;
  files: ProjectFiles;
}
