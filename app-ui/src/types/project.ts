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
  flows: UserFlow[]; // Updated to use specific UserFlow type
}

// Types used in transformRequirementsToFlow
export interface UserFlow {
  id: number;
  name: string;
  description?: string; // Add description property
  steps: FlowStep[]; // Updated to use specific FlowStep type 
}

export interface FlowStep {
  id: number;
  name: string;
  high_level_requirements: HighLevelRequirement[]; // Updated to use specific HLR type
}

export interface HighLevelRequirement {
  id: number;
  requirement_text: string;
  low_level_requirements: LowLevelRequirement[]; // Updated to use specific LLR type
}

export interface LowLevelRequirement {
  id: number;
  requirement_text: string;
  tech_stack_details?: string;
  test_cases: TestCase[]; // Add test_cases property
}

export interface TestCase {
  id: number;
  description: string;
  expected_result: string | null;
  created_at: string;
}