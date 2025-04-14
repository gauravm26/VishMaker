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
  uiid?: string;
}

export interface HighLevelRequirement {
  id: number;
  name: string; // Changed from requirement_text to match backend
  description?: string; // Added to match backend
  order: number;
  created_at: string;
  low_level_requirement_list: LowLevelRequirement[]; // Match backend field name
  uiid?: string;
}

export interface LowLevelRequirement {
  id: number;
  name: string; // Changed from requirement_text to match backend
  description?: string; // Changed from tech_stack_details to match backend
  created_at: string;
  test_case_list: TestCase[]; // Match backend field name
  uiid?: string;
}

export interface TestCase {
  id: number;
  name: string; // Changed from description to match backend
  description?: string; // Changed from expected_result to match backend
  created_at: string;
  uiid?: string;
}

// For code generation feature
export interface BuildFeatureRequest {
  project_id: number;
  test_case_id: string;
  test_name: string;
  test_description: string;
  parent_uiid?: string;
  additional_context?: Record<string, any>;
}

export interface CodeFile {
  filename: string;
  content: string;
  language?: string;
}

export interface BuildFeatureResponse {
  success: boolean;
  message: string;
  code_files?: CodeFile[];
  generated_uiids?: string[];
  error?: string;
  test_metadata?: Record<string, any>;
}