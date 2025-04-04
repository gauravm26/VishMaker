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
  description?: string;
  project_id: number;
  created_at: string;
  high_level_requirement_list: HighLevelRequirement[]; // Match backend field name
}

export interface HighLevelRequirement {
  id: number;
  requirement_text: string;
  order: number;
  created_at: string;
  low_level_requirement_list: LowLevelRequirement[]; // Match backend field name
}

export interface LowLevelRequirement {
  id: number;
  requirement_text: string;
  tech_stack_details?: string;
  created_at: string;
  test_case_list: TestCase[]; // Match backend field name
}

export interface TestCase {
  id: number;
  description: string;
  expected_result: string | null;
  created_at: string;
}