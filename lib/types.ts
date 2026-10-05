export interface ProjectFiles {
  'index.html': string;
  [key: string]: string;
}

export interface GameProject {
  id: string;
  ownerId: string;
  title: string;
  files: ProjectFiles;
  chatMessages?: ChatMessage[];
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
