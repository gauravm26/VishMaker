// LLM Service for processing text with AI models
// Handles requirements generation, project creation, and other AI-powered features

import apiClient from './apiClient';

export interface LlmResponse {
  result: string;
  modelName?: string;
  modelId?: string;
  generated_uiids?: string[];
  message?: string;
  status?: string;
}

export interface LlmRequestOptions {
  componentId: string;
  text: string;
  projectId?: number;
  saveToDatabase?: boolean;
  onProgress?: (update: string) => void;
  parentUiid?: string;
}

// LLM Service class
class LlmServiceClass {
  /**
   * Process text with LLM for various components
   * @param componentId - The component identifier (e.g., 'genReqUserFlow', 'genReqHighLevel')
   * @param text - The input text to process
   * @param projectId - Optional project ID for database operations
   * @param saveToDatabase - Whether to save results to database
   * @param onProgress - Optional progress callback
   * @param parentUiid - Optional parent UIID for hierarchical relationships
   * @returns Promise<LlmResponse>
   */
  async processWithLlm(
    componentId: string,
    text: string,
    projectId?: number,
    saveToDatabase: boolean = false,
    onProgress?: (update: string) => void,
    parentUiid?: string
  ): Promise<LlmResponse> {
    try {
      // Send progress update
      onProgress?.('Initializing LLM processing...');

      // Prepare request payload
      const payload = {
        component_id: componentId,
        text: text,
        project_id: projectId,
        save_to_database: saveToDatabase,
        parent_uiid: parentUiid
      };

      // Send progress update
      onProgress?.('Sending request to LLM service...');

      // Make API call using apiClient to ensure proper base URL and authentication
      const data = await apiClient<LlmResponse>('/llm/process', {
        method: 'POST',
        body: payload,
        requireAuth: true // LLM calls should require authentication
      });

      // Send progress update
      onProgress?.('Processing response...');

      // Send final progress update
      onProgress?.('LLM processing completed successfully!');

      return {
        result: data.result || '',
        modelName: data.modelName,
        modelId: data.modelId,
        generated_uiids: data.generated_uiids || [],
        message: data.message || 'Success',
        status: data.status || 'success'
      };

    } catch (error) {
      console.error('LLM processing failed:', error);
      onProgress?.(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      throw error;
    }
  }

  /**
   * Generate project requirements from a prompt
   * @param prompt - The project description prompt
   * @param onProgress - Optional progress callback
   * @returns Promise<LlmResponse>
   */
  async generateProjectRequirements(
    prompt: string,
    onProgress?: (update: string) => void
  ): Promise<LlmResponse> {
    return this.processWithLlm(
      'genReqUserFlow',
      prompt,
      undefined,
      false,
      onProgress
    );
  }

  /**
   * Refine existing text with AI
   * @param componentId - The component to use for refinement
   * @param text - The text to refine
   * @param onProgress - Optional progress callback
   * @returns Promise<LlmResponse>
   */
  async refineText(
    componentId: string,
    text: string,
    onProgress?: (update: string) => void
  ): Promise<LlmResponse> {
    return this.processWithLlm(
      componentId,
      text,
      undefined,
      false,
      onProgress
    );
  }

  /**
   * Generate requirements for a specific project
   * @param componentId - The component identifier
   * @param text - The input text
   * @param projectId - The project ID
   * @param parentUiid - Optional parent UIID
   * @param onProgress - Optional progress callback
   * @returns Promise<LlmResponse>
   */
  async generateProjectRequirementsWithSave(
    componentId: string,
    text: string,
    projectId: number,
    parentUiid?: string,
    onProgress?: (update: string) => void
  ): Promise<LlmResponse> {
    return this.processWithLlm(
      componentId,
      text,
      projectId,
      true,
      onProgress,
      parentUiid
    );
  }
}

// Export singleton instance
const LlmService = new LlmServiceClass();
export default LlmService;
