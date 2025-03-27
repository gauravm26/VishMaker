// app-ui/src/types/project.ts

export interface Project {
  id: number;
  name: string;
  initial_prompt: string | null;
  created_at: string; // Dates are often strings over JSON
  updated_at: string | null;
}

// Type for creating a new project (matches API schema)
export interface ProjectCreatePayload {
  name: string;
  initial_prompt?: string | null;
}

// For use with the /requirements/{projectId} endpoint
export interface ProjectRequirementsResponse {
  project_id: number;
  flows: any[]; // Replace with more specific type if needed
}

// Types used in transformRequirementsToFlow
export interface UserFlow {
  id: number;
  name: string;
  steps: any[]; // Replace with more specific type if needed
}

export interface FlowStep {
  id: number;
  name: string;
  high_level_requirements: any[]; // Replace with more specific type if needed
}

export interface HighLevelRequirement {
  id: number;
  requirement_text: string;
  low_level_requirements: any[]; // Replace with more specific type if needed
}

export interface LowLevelRequirement {
  id: number;
  requirement_text: string;
  tech_stack_details?: string;
}
